const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const { getIO } = require('../services/socketService');

async function placeBid(req, res, next) {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(422).json({ message: 'Bid amount must be a positive number' });
    }

    const listing = await Listing.findById(listingId).exec();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const sellerId = listing.seller?.toString();
    if (sellerId === userId) {
      return res.status(403).json({ message: 'Sellers cannot bid on their own listings' });
    }

    if (listing.listingType !== 'auction') {
      return res.status(400).json({ message: 'Listing is not an auction type' });
    }

    const endTime = listing.auction?.endTime ? new Date(listing.auction.endTime) : null;
    if (!endTime || endTime <= new Date()) {
      return res.status(400).json({ message: 'Auction period has ended' });
    }

    const minAcceptable = Math.max(
      Number(listing.auction?.startBid || 0),
      Number(listing.auction?.currentBid?.amount || 0) + 1
    );
    if (amount < minAcceptable) {
      return res.status(422).json({ message: `Bid must be at least ${minAcceptable}` });
    }

    // Update current bid and append bidder history
    listing.auction = listing.auction || {};
    listing.auction.currentBid = {
      amount,
      bidder: userId,
      timestamp: new Date(),
    };
    listing.auction.bidders = listing.auction.bidders || [];
    listing.auction.bidders.push({ user: userId, amount, timestamp: new Date() });
    listing.auction.highestBidPerUser = listing.auction.highestBidPerUser || new Map();
    listing.auction.highestBidPerUser.set(userId, amount);

    await listing.save();

    const io = getIO();
    if (io) {
      const highestMap = listing.auction.highestBidPerUser;
      let highestObj = {};
      if (highestMap && typeof highestMap.forEach === 'function') {
        highestMap.forEach((val, key) => { highestObj[key] = val; });
      }
      io.to(`auction:${listingId}`).emit('auction:update', {
        listingId,
        currentBid: listing.auction.currentBid,
        highestBidPerUser: highestObj,
      });
    }

    return res.status(200).json({ message: 'Bid placed', currentBid: listing.auction.currentBid });
  } catch (err) {
    next(err);
  }
}

async function getBiddingStatus(req, res, next) {
  try {
    const { listingId } = req.params;
    const listing = await Listing.findById(listingId).exec();
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.listingType !== 'auction') {
      return res.status(400).json({ message: 'Listing is not an auction type' });
    }
    const yourHighestBid = listing.auction?.highestBidPerUser?.get?.(req.user.id) || 0;
    // Determine if caller is the winner after end, and whether the transaction is still open
    let isWinner = false;
    let finalBid = listing.auction?.currentBid?.amount || 0;
    let winnerOpen = false;
    if (listing.auction?.status === 'ended') {
      const winnerId = listing.auction?.winner?.toString?.() || String(listing.auction?.winner || '');
      if (winnerId && winnerId === String(req.user.id)) {
        isWinner = true;
        try {
          const tx = await Transaction.findOne({
            listing: listing._id,
            buyer: req.user.id,
            transactionType: 'auction',
          }).sort({ createdAt: -1 }).lean();
          winnerOpen = !!(tx && tx.status !== 'completed');
          if (tx?.amount != null) finalBid = tx.amount;
        } catch (_) {
          // ignore tx lookup failures
        }
      }
    }
    return res.json({
      startBid: listing.auction?.startBid || 0,
      endTime: listing.auction?.endTime || null,
      currentBid: listing.auction?.currentBid || null,
      yourHighestBid,
      biddersCount: Array.isArray(listing.auction?.bidders) ? listing.auction.bidders.length : 0,
      status: listing.auction?.status || 'active',
      isWinner,
      finalBid,
      winnerOpen,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { placeBid, getBiddingStatus };
