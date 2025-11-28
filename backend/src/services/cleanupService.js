const cron = require('node-cron');
const Share = require('../models/Share');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Listing = require('../models/Listing');

/**
 * Cleanup old completed cab sharing trips and food orders (30+ days after departure/deadline)
 * rejected requests and chats after departure/deadline time
 * Runs every 5 minutes to check and delete old shares, chats, and clean rejected requests
 * 
 * Behavior:
 * - When user cancels: Share data is preserved, only member is removed
 * - When share is full: Rejected requests are kept until departure/deadline time
 * - After departure/deadline time: Group chats are deleted immediately
 * - After departure/deadline time: Rejected requests are cleaned up immediately
 * - After departure/deadline time: Share history remains visible for 30 days
 * - After 30 days: Share data is permanently deleted
 * 
 * This allows users to:
 * 1. View share details even after cancellation (until departure/deadline)
 * 2. See their rejected request status until the share completes
 * 3. Access share history for 30 days after completion
 */
const startCleanupService = () => {
  // Run every 30 seconds to check for completed shares and cleanup (especially for instant bidding/auction end)
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      // Cleanup buy requests and transactions older than 30 days
      const Transaction = require('../models/Transaction');
      const oldTransactions = await Transaction.find({
        createdAt: { $lt: thirtyDaysAgo }
      });
      if (oldTransactions.length > 0) {
        const transactionIds = oldTransactions.map(t => t._id);
        await Transaction.deleteMany({ _id: { $in: transactionIds } });
        console.log(`Cleanup: Deleted ${transactionIds.length} transactions older than 30 days`);
      }
      
      // 1. Find cab trips that have departed (but not older than 30 days)
      const departedShares = await Share.find({
        shareType: 'cab',
        departureTime: { $lt: now, $gte: thirtyDaysAgo }
      });

      if (departedShares.length > 0) {
        // Clear pending and rejected requests after departure
        for (const share of departedShares) {
          if (share.pendingRequests.length > 0 || share.rejectedRequests.length > 0) {
            share.pendingRequests = [];
            share.rejectedRequests = [];
            await share.save();
            console.log(`Cleanup: Cleared pending/rejected requests from cab trip "${share.name}" after departure`);
          }
        }
        
        const departedShareIds = departedShares.map(share => share._id);
        
        // Find chats to delete and their messages
        const chatsToDelete = await Chat.find({ shareRef: { $in: departedShareIds } });
        const chatIds = chatsToDelete.map(chat => chat._id);
        
        // Delete messages first
        if (chatIds.length > 0) {
          const messageDeleteResult = await Message.deleteMany({ chat: { $in: chatIds } });
          if (messageDeleteResult.deletedCount > 0) {
            console.log(`Cleanup: Deleted ${messageDeleteResult.deletedCount} messages from departed cab trips`);
          }
        }
        
        // Delete group chats for departed trips
        const chatDeleteResult = await Chat.deleteMany({ shareRef: { $in: departedShareIds } });
        if (chatDeleteResult.deletedCount > 0) {
          console.log(`Cleanup: Deleted ${chatDeleteResult.deletedCount} group chats for departed cab trips`);
        }
        
        // Clean up rejected requests from departed trips
        let rejectedCleanupCount = 0;
        for (const share of departedShares) {
          if (share.rejectedRequests && share.rejectedRequests.length > 0) {
            share.rejectedRequests = [];
            await share.save();
            rejectedCleanupCount++;
          }
        }
        if (rejectedCleanupCount > 0) {
          console.log(`Cleanup: Cleared rejected requests from ${rejectedCleanupCount} departed cab trips`);
        }
      }
      
      // 2. Find food orders that have passed deadline (but not older than 30 days)
      const completedFoodShares = await Share.find({
        shareType: 'food',
        deadlineTime: { $lt: now, $gte: thirtyDaysAgo }
      }).populate('members.user', 'name email');

      if (completedFoodShares.length > 0) {
        const Notification = require('../models/Notification');
        
        // Check for orders that don't meet minimum persons requirement
        for (const share of completedFoodShares) {
          const joinedCount = share.members.filter(m => m.status === 'joined').length;
          
          // Clear pending and rejected requests after deadline
          if (share.pendingRequests.length > 0 || share.rejectedRequests.length > 0) {
            share.pendingRequests = [];
            share.rejectedRequests = [];
            await share.save();
            console.log(`Cleanup: Cleared pending/rejected requests from food order "${share.name}" after deadline`);
          }
          
          // If minimum persons not met, cancel all joined members
          if (share.minPersons && joinedCount < share.minPersons) {
            let cancelledCount = 0;
            
            for (const member of share.members) {
              if (member.status === 'joined') {
                member.status = 'cancelled';
                cancelledCount++;
                
                // Create notification for cancelled member
                await Notification.create({
                  user: member.user._id || member.user,
                  type: 'minimum_not_met',
                  title: 'Order Cancelled - Minimum Not Met',
                  message: `Your food order "${share.name}" has been cancelled because minimum ${share.minPersons} persons were required but only ${joinedCount} joined.`,
                  shareRef: share._id,
                });
              }
            }
            
            if (cancelledCount > 0) {
              await share.save();
              console.log(`Cleanup: Cancelled ${cancelledCount} members from food order "${share.name}" (minimum ${share.minPersons} not met, only ${joinedCount} joined)`);
            }
          }
        }
        
        const completedShareIds = completedFoodShares.map(share => share._id);
        
        // Find chats to delete and their messages
        const chatsToDelete = await Chat.find({ shareRef: { $in: completedShareIds } });
        const chatIds = chatsToDelete.map(chat => chat._id);
        
        // Delete messages first
        if (chatIds.length > 0) {
          const messageDeleteResult = await Message.deleteMany({ chat: { $in: chatIds } });
          if (messageDeleteResult.deletedCount > 0) {
            console.log(`Cleanup: Deleted ${messageDeleteResult.deletedCount} messages from completed food orders`);
          }
        }
        
        // Delete group chats for completed food orders
        const chatDeleteResult = await Chat.deleteMany({ shareRef: { $in: completedShareIds } });
        if (chatDeleteResult.deletedCount > 0) {
          console.log(`Cleanup: Deleted ${chatDeleteResult.deletedCount} group chats for completed food orders`);
        }
        
        // Clean up rejected requests from completed orders
        let rejectedCleanupCount = 0;
        for (const share of completedFoodShares) {
          if (share.rejectedRequests && share.rejectedRequests.length > 0) {
            share.rejectedRequests = [];
            await share.save();
            rejectedCleanupCount++;
          }
        }
        if (rejectedCleanupCount > 0) {
          console.log(`Cleanup: Cleared rejected requests from ${rejectedCleanupCount} completed food orders`);
        }
      }
      
      // 3. Find cab shares where departure time was more than 30 days ago
      const oldCabShares = await Share.find({
        shareType: 'cab',
        departureTime: { $lt: thirtyDaysAgo }
      });

      if (oldCabShares.length > 0) {
        const shareIds = oldCabShares.map(share => share._id);
        
        // Find and delete any remaining chats and messages (should already be deleted at departure)
        const remainingChats = await Chat.find({ shareRef: { $in: shareIds } });
        if (remainingChats.length > 0) {
          const chatIds = remainingChats.map(chat => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
        }
        await Chat.deleteMany({ shareRef: { $in: shareIds } });
        
        // Delete old shares (including those with cancelled members)
        const result = await Share.deleteMany({
          _id: { $in: shareIds }
        });

        console.log(`Cleanup: Deleted ${result.deletedCount} old cab sharing trips (30+ days after departure)`);
      }
      
      // 4. Find food shares where deadline time was more than 30 days ago
      const oldFoodShares = await Share.find({
        shareType: 'food',
        deadlineTime: { $lt: thirtyDaysAgo }
      });

      if (oldFoodShares.length > 0) {
        const shareIds = oldFoodShares.map(share => share._id);
        
        // Find and delete any remaining chats and messages (should already be deleted at deadline)
        const remainingChats = await Chat.find({ shareRef: { $in: shareIds } });
        if (remainingChats.length > 0) {
          const chatIds = remainingChats.map(chat => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
        }
        await Chat.deleteMany({ shareRef: { $in: shareIds } });
        
        // Delete old shares (including those with cancelled members)
        const result = await Share.deleteMany({
          _id: { $in: shareIds }
        });

        console.log(`Cleanup: Deleted ${result.deletedCount} old food orders (30+ days after deadline)`);
      }
      
      // 5. Find other shares that have passed deadline (but not older than 30 days)
      const completedOtherShares = await Share.find({
        shareType: 'other',
        otherDeadline: { $lt: now, $gte: thirtyDaysAgo }
      }).populate('members.user', 'name email');

      if (completedOtherShares.length > 0) {
        const Notification = require('../models/Notification');
        
        // Check for shares that don't meet minimum persons requirement
        for (const share of completedOtherShares) {
          const joinedCount = share.members.filter(m => m.status === 'joined').length;
          
          // Clear pending and rejected requests after deadline
          if (share.pendingRequests.length > 0 || share.rejectedRequests.length > 0) {
            share.pendingRequests = [];
            share.rejectedRequests = [];
            await share.save();
            console.log(`Cleanup: Cleared pending/rejected requests from other share "${share.name}" after deadline`);
          }
          
          // If minimum persons not met, cancel all joined members
          if (share.otherMinPersons && joinedCount < share.otherMinPersons) {
            let cancelledCount = 0;
            
            for (const member of share.members) {
              if (member.status === 'joined') {
                member.status = 'cancelled';
                cancelledCount++;
                
                // Create notification for cancelled member
                await Notification.create({
                  user: member.user._id || member.user,
                  type: 'minimum_not_met',
                  title: 'Share Cancelled - Minimum Not Met',
                  message: `Your share "${share.name}" has been cancelled because minimum ${share.otherMinPersons} persons were required but only ${joinedCount} joined.`,
                  shareRef: share._id,
                });
              }
            }
            
            if (cancelledCount > 0) {
              await share.save();
              console.log(`Cleanup: Cancelled ${cancelledCount} members from other share "${share.name}" (minimum ${share.otherMinPersons} not met, only ${joinedCount} joined)`);
            }
          }
        }
        
        const completedShareIds = completedOtherShares.map(share => share._id);
        
        // Find chats to delete and their messages
        const chatsToDelete = await Chat.find({ shareRef: { $in: completedShareIds } });
        const chatIds = chatsToDelete.map(chat => chat._id);
        
        // Delete messages first
        if (chatIds.length > 0) {
          const messageDeleteResult = await Message.deleteMany({ chat: { $in: chatIds } });
          if (messageDeleteResult.deletedCount > 0) {
            console.log(`Cleanup: Deleted ${messageDeleteResult.deletedCount} messages from completed other shares`);
          }
        }
        
        // Delete group chats for completed other shares
        const chatDeleteResult = await Chat.deleteMany({ shareRef: { $in: completedShareIds } });
        if (chatDeleteResult.deletedCount > 0) {
          console.log(`Cleanup: Deleted ${chatDeleteResult.deletedCount} group chats for completed other shares`);
        }
        
        // Clean up rejected requests from completed shares
        let rejectedCleanupCount = 0;
        for (const share of completedOtherShares) {
          if (share.rejectedRequests && share.rejectedRequests.length > 0) {
            share.rejectedRequests = [];
            await share.save();
            rejectedCleanupCount++;
          }
        }
        if (rejectedCleanupCount > 0) {
          console.log(`Cleanup: Cleared rejected requests from ${rejectedCleanupCount} completed other shares`);
        }
      }
      
      // 6. Find other shares where deadline was more than 30 days ago
      const oldOtherShares = await Share.find({
        shareType: 'other',
        otherDeadline: { $lt: thirtyDaysAgo }
      });

      if (oldOtherShares.length > 0) {
        const shareIds = oldOtherShares.map(share => share._id);
        
        // Find and delete any remaining chats and messages (should already be deleted at deadline)
        const remainingChats = await Chat.find({ shareRef: { $in: shareIds } });
        if (remainingChats.length > 0) {
          const chatIds = remainingChats.map(chat => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
        }
        await Chat.deleteMany({ shareRef: { $in: shareIds } });
        
        // Delete old shares (including those with cancelled members)
        const result = await Share.deleteMany({
          _id: { $in: shareIds }
        });

        console.log(`Cleanup: Deleted ${result.deletedCount} old other shares (30+ days after deadline)`);
      }

      // Auction cleanup logic
      const Notification = require('../models/Notification');
      
      // Find expired auctions
      const expiredAuctions = await Listing.find({
        listingType: 'auction',
        'auction.isAuction': true,
        'auction.status': 'active',
        'auction.endTime': { $lte: now },
      }).populate('seller', 'name email')
        .populate('auction.currentBid.bidder', 'name email');

      for (const listing of expiredAuctions) {
        const hasBids = listing.auction.bidders && listing.auction.bidders.length > 0;

        if (hasBids) {
          // Auction has bids - mark as ended, notify winner and seller
          listing.auction.status = 'ended';
          listing.auction.winner = listing.auction.currentBid.bidder._id || listing.auction.currentBid.bidder;
          listing.status = 'sold';
          await listing.save();

          const winner = listing.auction.currentBid.bidder;
          const finalBid = listing.auction.currentBid.amount;
          const winnerId = winner._id || winner;

          // Emit socket event to auction room
          const { getIO } = require('./socketService');
          const io = getIO();
          if (io) {
            // Emit to entire auction room with winner details
            // Frontend will check if current user is the winner
            io.to(`auction:${listing._id}`).emit('auction:end', {
              winner: winnerId,
              winnerDetails: {
                _id: winnerId,
                name: winner.name,
                email: winner.email
              },
              finalBid: finalBid,
              listingId: listing._id
            });
          }

          // Notify winner
          await Notification.create({
            user: winnerId,
            type: 'auction_won',
            title: 'Auction Won',
            message: `🎉 Congratulations! You won the auction for "${listing.title}" with a bid of ₹${finalBid}`,
            link: `/listings/${listing._id}`,
          });

          // Notify seller
          await Notification.create({
            user: listing.seller._id,
            type: 'auction_ended',
            title: 'Auction Ended',
            message: `Your auction "${listing.title}" has ended. Winner: ${winner.name || winner.email} with bid ₹${finalBid}`,
            link: `/listings/${listing._id}`,
          });

          // Create transaction record with listing snapshot
          await Transaction.create({
            listing: listing._id,
            buyer: winnerId,
            seller: listing.seller._id,
            amount: finalBid,
            transactionType: 'auction',
            status: 'completed',
            paymentStatus: 'not_paid',
            listingSnapshot: {
              title: listing.title,
              price: listing.price,
              images: listing.images || [],
              category: listing.category,
              description: listing.description,
            },
          });

          console.log(`Auction ended: "${listing.title}" - Winner: ${winner.name}, Bid: ₹${finalBid}`);

          // Schedule removal after 5 minutes
          setTimeout(async () => {
            try {
              await Listing.findByIdAndUpdate(listing._id, { status: 'archived' });
              console.log(`Archived auction "${listing.title}" after 5 minutes`);
            } catch (err) {
              console.error('Error archiving auction:', err);
            }
          }, 5 * 60 * 1000);

        } else {
          // No bids - instant removal and notify seller
          await Listing.findByIdAndUpdate(listing._id, { 
            status: 'archived',
            'auction.status': 'ended' 
          });

          // Emit socket event for no bids
          const { getIO } = require('./socketService');
          const io = getIO();
          if (io) {
            io.to(`auction:${listing._id}`).emit('auction:end', {
              winner: null,
              finalBid: 0,
              listingId: listing._id
            });
          }

          await Notification.create({
            user: listing.seller._id,
            type: 'auction_no_bids',
            title: 'Auction Ended - No Bids',
            message: `Your auction "${listing.title}" ended with no bids.`,
            link: `/my-listings`,
          });

          console.log(`Auction removed (no bids): "${listing.title}"`);
        }
      }

      // Bidding cleanup logic (independent from auction)
      const expiredBidding = await Listing.find({
        listingType: 'bidding',
        'auction.status': { $in: [null, 'active'] },
        'auction.endTime': { $lte: now },
      })
        .populate('seller', 'name email')
        .populate('auction.currentBid.bidder', 'name email');

      for (const listing of expiredBidding) {
        const hasBids = Array.isArray(listing.auction?.bidders) && listing.auction.bidders.length > 0;

        if (hasBids) {
          listing.auction.status = 'ended';
          const winnerDoc = listing.auction.currentBid?.bidder;
          const winnerId = winnerDoc?._id || winnerDoc;
          const finalBid = listing.auction.currentBid?.amount || 0;
          listing.auction.winner = winnerId;
          // Keep listing visible until seller completes the transaction
          await listing.save();

          const { getIO } = require('./socketService');
          const io = getIO();
          if (io) {
            // Notify room that bidding ended (no winner details broadcast)
            io.to(`bidding:${listing._id}`).emit('bidding:end', {
              listingId: listing._id,
            });
            // Winner-only message
            io.to(`user:${winnerId}`).emit('bidding:won', {
              listingId: listing._id,
              finalBid,
              title: listing.title,
            });
            // Seller-only winner details
            io.to(`user:${listing.seller._id}`).emit('bidding:winner', {
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
            type: 'bidding_won',
            title: 'Bidding Won',
            message: `You won the bidding for "${listing.title}" with ₹${finalBid}`,
            link: `/listings/${listing._id}`,
          });
          if (io && winnerNotif) {
            io.to(`user:${winnerId}`).emit('notification', winnerNotif);
          }

          const sellerNotif = await Notification.create({
            user: listing.seller._id,
            type: 'bidding_ended',
            title: 'Bidding Ended',
            message: `Your bidding listing "${listing.title}" ended. Winner bid: ₹${finalBid}`,
            link: `/listings/${listing._id}`,
          });
          if (io && sellerNotif) {
            io.to(`user:${listing.seller._id}`).emit('notification', sellerNotif);
          }

          await Transaction.create({
            listing: listing._id,
            buyer: winnerId,
            seller: listing.seller._id,
            amount: finalBid,
            // Reuse 'auction' transaction flow so seller completes later
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
          // Do not auto-archive; seller will complete to remove from marketplace
        } else {
          await Listing.findByIdAndUpdate(listing._id, {
            status: 'archived',
            'auction.status': 'ended',
          });

          const { getIO } = require('./socketService');
          const io = getIO();
          if (io) {
            io.to(`bidding:${listing._id}`).emit('bidding:end', {
              winner: null,
              finalBid: 0,
              listingId: listing._id,
            });
          }

          await Notification.create({
            user: listing.seller._id,
            type: 'bidding_no_bids',
            title: 'Bidding Ended - No Bids',
            message: `Your bidding listing "${listing.title}" ended with no bids.`,
            link: `/my-listings`,
          });
        }
      }

    } catch (error) {
      console.error('Cleanup service error:', error);
    }
  });

  console.log('Cleanup service started - runs every 5 minutes to clean up completed shares, expired auctions, and delete old data');
};

module.exports = { startCleanupService };
