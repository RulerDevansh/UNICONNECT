const cron = require('node-cron');
const Share = require('../models/Share');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { getIO } = require('./socketService');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cleanup completed shares, expired auctions, and old data.
 *
 * Behaviour:
 * - After departure/deadline: chats deleted, pending/rejected requests cleared.
 * - Share history kept for 30 days, then permanently removed.
 * - Expired auctions are finalised (winner determined or listing archived).
 *
 * Runs every 30 seconds so auction endings are processed promptly.
 */

// ── Share helpers ──────────────────────────────────────────────

/** Delete all chats & messages linked to the given share IDs. */
const deleteShareChats = async (shareIds) => {
  const chats = await Chat.find({ shareRef: { $in: shareIds } }, '_id');
  if (chats.length) {
    const chatIds = chats.map((c) => c._id);
    await Message.deleteMany({ chat: { $in: chatIds } });
    await Chat.deleteMany({ _id: { $in: chatIds } });
  }
};

/** Clear pending & rejected requests on shares that have expired. */
const clearExpiredRequests = async (shares) => {
  for (const share of shares) {
    if (share.pendingRequests.length > 0 || share.rejectedRequests.length > 0) {
      share.pendingRequests = [];
      share.rejectedRequests = [];
      await share.save();
    }
  }
};

/**
 * For food/other shares: if minimum participants not met, cancel all joined
 * members and notify them.
 */
const cancelIfMinNotMet = async (shares, minField, labelPrefix) => {
  for (const share of shares) {
    const minRequired = share[minField];
    if (!minRequired) continue;

    const joinedCount = share.members.filter((m) => m.status === 'joined').length;
    if (joinedCount >= minRequired) continue;

    let dirty = false;
    for (const member of share.members) {
      if (member.status === 'joined') {
        member.status = 'cancelled';
        dirty = true;
        await Notification.create({
          user: member.user._id || member.user,
          type: 'minimum_not_met',
          title: `${labelPrefix} Cancelled - Minimum Not Met`,
          message: `Your ${labelPrefix.toLowerCase()} "${share.name}" has been cancelled because minimum ${minRequired} persons were required but only ${joinedCount} joined.`,
          shareRef: share._id,
        });
      }
    }
    if (dirty) await share.save();
  }
};

/**
 * Generic handler for recently-expired shares (past deadline but < 30 days).
 * Clears requests, optionally cancels under-minimum members, deletes chats.
 */
const cleanupRecentShares = async (query, { minField, labelPrefix } = {}) => {
  const populateOpts = minField ? 'members.user' : '';
  const shares = populateOpts
    ? await Share.find(query).populate('members.user', 'name email')
    : await Share.find(query);
  if (!shares.length) return;

  await clearExpiredRequests(shares);
  if (minField) await cancelIfMinNotMet(shares, minField, labelPrefix);

  const shareIds = shares.map((s) => s._id);
  await deleteShareChats(shareIds);
};

/** Delete shares (and any remaining chats) older than 30 days. */
const purgeOldShares = async (query) => {
  const shares = await Share.find(query);
  if (!shares.length) return;

  const shareIds = shares.map((s) => s._id);
  await deleteShareChats(shareIds);
  await Share.deleteMany({ _id: { $in: shareIds } });
};

// ── Main job ───────────────────────────────────────────────────

const startCleanupService = () => {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

      // 1. Purge transactions older than 30 days
      await Transaction.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });

      // 2. Recently-expired cab trips (departed but < 30 days)
      await cleanupRecentShares({
        shareType: 'cab',
        departureTime: { $lt: now, $gte: thirtyDaysAgo },
      });

      // 3. Recently-expired food orders
      await cleanupRecentShares(
        { shareType: 'food', deadlineTime: { $lt: now, $gte: thirtyDaysAgo } },
        { minField: 'minPersons', labelPrefix: 'Order' },
      );

      // 4. Recently-expired other shares
      await cleanupRecentShares(
        { shareType: 'other', otherDeadline: { $lt: now, $gte: thirtyDaysAgo } },
        { minField: 'otherMinPersons', labelPrefix: 'Share' },
      );

      // 5. Purge shares older than 30 days
      await purgeOldShares({ shareType: 'cab', departureTime: { $lt: thirtyDaysAgo } });
      await purgeOldShares({ shareType: 'food', deadlineTime: { $lt: thirtyDaysAgo } });
      await purgeOldShares({ shareType: 'other', otherDeadline: { $lt: thirtyDaysAgo } });

      // 6. Expired auctions
      const expiredAuctions = await Listing.find({
        listingType: 'auction',
        'auction.status': { $in: [null, 'active'] },
        'auction.endTime': { $lte: now },
      })
        .populate('seller', 'name email')
        .populate('auction.currentBid.bidder', 'name email');

      for (const listing of expiredAuctions) {
        const hasBids =
          Array.isArray(listing.auction?.bidders) && listing.auction.bidders.length > 0;

        if (hasBids) {
          listing.auction.status = 'ended';
          const winnerDoc = listing.auction.currentBid?.bidder;
          const winnerId = winnerDoc?._id || winnerDoc;
          const finalBid = listing.auction.currentBid?.amount || 0;
          listing.auction.winner = winnerId;
          await listing.save();

          const io = getIO();
          if (io) {
            io.to(`auction:${listing._id}`).emit('auction:end', {
              listingId: listing._id,
            });
            io.to(`user:${winnerId}`).emit('auction:won', {
              listingId: listing._id,
              finalBid,
              title: listing.title,
            });
            io.to(`user:${listing.seller._id}`).emit('auction:winner', {
              listingId: listing._id,
              finalBid,
              winner: {
                _id: winnerId,
                name: winnerDoc?.name,
                email: winnerDoc?.email,
              },
              title: listing.title,
            });
          }

          const winnerNotif = await Notification.create({
            user: winnerId,
            type: 'auction_won',
            title: 'Auction Won',
            message: `You won the auction for "${listing.title}" with ₹${finalBid}`,
          });
          if (io && winnerNotif) {
            io.to(`user:${winnerId}`).emit('notification', winnerNotif);
          }

          const sellerNotif = await Notification.create({
            user: listing.seller._id,
            type: 'auction_ended',
            title: 'Auction Ended',
            message: `Your auction listing "${listing.title}" ended. Winner bid: ₹${finalBid}`,
          });
          if (io && sellerNotif) {
            io.to(`user:${listing.seller._id}`).emit('notification', sellerNotif);
          }

          await Transaction.create({
            listing: listing._id,
            buyer: winnerId,
            seller: listing.seller._id,
            amount: finalBid,
            transactionType: 'auction',
            status: 'approved',
            paymentStatus: 'not_paid',
            listingSnapshot: {
              title: listing.title,
              price: listing.price,
              images: listing.images || [],
              category: listing.category,
              description: listing.description,
            },
          });
        } else {
          await Listing.findByIdAndUpdate(listing._id, {
            status: 'archived',
            'auction.status': 'ended',
          });

          const io = getIO();
          if (io) {
            io.to(`auction:${listing._id}`).emit('auction:end', {
              winner: null,
              finalBid: 0,
              listingId: listing._id,
            });
          }

          await Notification.create({
            user: listing.seller._id,
            type: 'auction_no_bids',
            title: 'Auction Ended',
            message: `Your auction listing "${listing.title}" ended with no bids.`,
          });
        }
      }
    } catch (_err) {
      // cleanup errors are non-fatal
    }
  });
};

module.exports = { startCleanupService };
