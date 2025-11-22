const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Listing = require('../models/Listing');

const auctions = new Map(); // In production store in Redis or DB for durability.

const initSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('auth required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinChat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    socket.on('typing', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing', { user: socket.user.id });
    });

    socket.on('message', async ({ chatId, content }) => {
      const message = await Message.create({
        chat: chatId,
        sender: socket.user.id,
        content,
      });
      await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });
      await message.populate('sender', 'name email');
      io.to(`chat:${chatId}`).emit('message', message);
    });

    socket.on('message:read', async ({ chatId, messageId }) => {
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { readBy: socket.user.id } },
        { new: true }
      );
      if (message) {
        io.to(`chat:${chatId}`).emit('message:read', { messageId, userId: socket.user.id });
      }
    });

    socket.on('joinShareRoom', (shareId) => {
      socket.join(`share:${shareId}`);
    });

    socket.on('share:message', async ({ shareId, content }) => {
      const chat = await Chat.findOneAndUpdate(
        { shareRef: shareId },
        { $setOnInsert: { participants: [socket.user.id], isGroup: true, shareRef: shareId } },
        { upsert: true, new: true }
      );
      const message = await Message.create({ chat: chat._id, sender: socket.user.id, content });
      await message.populate('sender', 'name email');
      io.to(`share:${shareId}`).emit('share:message', message);
    });

    socket.on('auction:join', (listingId) => {
      socket.join(`auction:${listingId}`);
    });

    socket.on('auction:start', async ({ listingId, startBid, endTime }) => {
      const listing = await Listing.findById(listingId);
      if (!listing || listing.seller.toString() !== socket.user.id) return;
      listing.auction = {
        isAuction: true,
        startBid,
        endTime,
        currentBid: { amount: startBid },
        bidders: [],
      };
      await listing.save();
      auctions.set(listingId, { amount: startBid });
      io.to(`auction:${listingId}`).emit('auction:started', {
        listingId,
        startBid,
        endTime,
      });
    });

    socket.on('auction:bid', async ({ listingId, amount }) => {
      const listing = await Listing.findById(listingId);
      if (!listing?.auction?.isAuction) return;
      
      // Get current highest bid from memory or DB
      const currentHighest = auctions.get(listingId)?.amount 
        || listing.auction.currentBid?.amount 
        || listing.auction.startBid;

      if (amount <= currentHighest) {
        socket.emit('auction:rejected', { reason: 'Bid too low' });
        return;
      }
      
      const bid = { amount, bidder: socket.user.id, createdAt: new Date() };
      auctions.set(listingId, bid);
      
      listing.auction.currentBid = { amount, bidder: socket.user.id };
      listing.auction.bidders.push(bid);
      await listing.save();
      
      // Populate bidder info for frontend display
      const populatedListing = await listing.populate('auction.currentBid.bidder', 'name email');
      const bidderInfo = populatedListing.auction.currentBid.bidder;

      io.to(`auction:${listingId}`).emit('auction:bid', { ...bid, bidderName: bidderInfo?.name });
    });

    socket.on('auction:end', async ({ listingId }) => {
      const listing = await Listing.findById(listingId);
      if (!listing || listing.seller.toString() !== socket.user.id) return;
      
      listing.auction.isAuction = false;
      await listing.save();
      
      const finalBid = listing.auction.currentBid;
      io.to(`auction:${listingId}`).emit('auction:ended', finalBid);
      auctions.delete(listingId);
    });
  });

  // Periodic check for expired auctions
  setInterval(async () => {
    try {
      const now = new Date();
      const expiredListings = await Listing.find({
        $or: [
          { 'auction.isAuction': true },
          { listingType: 'auction', status: 'active' }
        ],
        'auction.endTime': { $lte: now }
      }).populate('auction.currentBid.bidder');

      console.log(`[Auction Cleanup] Checking ${expiredListings.length} expired auctions at ${now.toISOString()}`);

      for (const listing of expiredListings) {
        // Check if auction has any bids (excluding the initial startBid placeholder)
        const hasBids = listing.auction.bidders && listing.auction.bidders.length > 0;
        
        console.log(`[Auction ${listing._id}] EndTime: ${listing.auction.endTime}, HasBids: ${hasBids}, Bidders: ${listing.auction.bidders?.length || 0}`);
        
        if (!hasBids) {
          // No bids received - delete the listing from database
          await Listing.findByIdAndDelete(listing._id);
          
          io.to(`auction:${listing._id}`).emit('auction:cancelled', {
            listingId: listing._id.toString(),
            reason: 'No bids received'
          });
          
          auctions.delete(listing._id.toString());
          console.log(`[Auction ${listing._id}] ✅ DELETED - no bids received`);
        } else {
          // Has bids - mark auction as ended
          listing.auction.isAuction = false;
          await listing.save();

          const winner = listing.auction.currentBid?.bidder;
          const finalAmount = listing.auction.currentBid?.amount;

          io.to(`auction:${listing._id}`).emit('auction:ended', {
            amount: finalAmount,
            winner: winner?._id,
            winnerName: winner?.name
          });

          // Notify the winner specifically if they are connected
          // We can't easily find their socket without a user->socket map, 
          // but the room emission covers the active UI.
          // Ideally, we would create a notification in the DB here.
          
          auctions.delete(listing._id.toString());
          console.log(`Auction ${listing._id} ended. Winner: ${winner?.name}`);
        }
      }
    } catch (err) {
      console.error('Error checking expired auctions:', err);
    }
  }, 60000); // Check every minute
};

module.exports = { initSocket, auctions };
