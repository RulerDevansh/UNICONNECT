const jwt = require('jsonwebtoken');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Listing = require('../models/Listing');
const Notification = require('../models/Notification');

let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;
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
    socket.join(`user:${socket.user.id}`);

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
      
      // Update chat last message time
      const chat = await Chat.findByIdAndUpdate(
        chatId, 
        { lastMessageAt: new Date() },
        { new: true }
      ).populate('participants', '_id name');
      
      await message.populate('sender', 'name email');
      io.to(`chat:${chatId}`).emit('message', message);
      
      // Create notification for other participants
      if (chat && chat.participants) {
        const recipients = chat.participants
          .filter(p => p._id.toString() !== socket.user.id)
          .map(p => p._id);
        
        if (recipients.length > 0) {
          const senderName = message.sender?.name || 'Someone';
          
          // Create notification for each recipient
          for (const recipientId of recipients) {
            const notification = await Notification.create({
              user: recipientId,
              type: 'new_message',
              title: 'New Message',
              message: `${senderName} sent you a message`,
              shareRef: chat.shareRef || null
            });
            
            // Emit notification to recipient
            io.to(`user:${recipientId}`).emit('notification', notification);
          }
        }
      }
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

    // Auction handlers
    socket.on('auction:join', async ({ listingId }) => {
      socket.join(`auction:${listingId}`);
      
      try {
        const listing = await Listing.findById(listingId)
          .populate('seller', 'name email')
          .populate('auction.currentBid.bidder', 'name email')
          .populate('auction.bidders.user', 'name email');
        
        if (!listing || !listing.auction?.isAuction) return;

        socket.emit('auction:update', {
          currentBid: listing.auction.currentBid?.amount || 0,
          bidder: listing.auction.currentBid?.bidder,
          allBids: listing.auction.bidders || [],
        });
      } catch (err) {
        console.error('auction:join error:', err);
      }
    });

    socket.on('auction:bid', async ({ listingId, amount }) => {
      try {
        const listing = await Listing.findById(listingId)
          .populate('seller', 'name email')
          .populate('auction.bidders.user', 'name email');
        
        if (!listing || !listing.auction?.isAuction) {
          socket.emit('auction:error', { message: 'Auction not found or inactive' });
          return;
        }

        // Check if auction has ended
        if (new Date() > new Date(listing.auction.endTime)) {
          socket.emit('auction:error', { message: 'Auction has ended' });
          return;
        }

        // Seller cannot bid
        if (listing.seller._id.toString() === socket.user.id) {
          socket.emit('auction:error', { message: 'Seller cannot bid on their own auction' });
          return;
        }

        // Validate bid amount
        const currentHighest = listing.auction.currentBid?.amount || 0;
        const minBid = currentHighest > 0 ? currentHighest + 1 : listing.auction.startBid;
        
        if (amount < minBid) {
          socket.emit('auction:error', { message: `Bid must be at least ₹${minBid}` });
          return;
        }

        // Add bid
        listing.auction.bidders.push({
          user: socket.user.id,
          amount,
          timestamp: new Date(),
        });

        // Update current bid
        listing.auction.currentBid = {
          amount,
          bidder: socket.user.id,
          timestamp: new Date(),
        };

        // Update highestBidPerUser Map
        if (!listing.auction.highestBidPerUser) {
          listing.auction.highestBidPerUser = new Map();
        }
        const currentUserHighest = listing.auction.highestBidPerUser.get(socket.user.id) || 0;
        if (amount > currentUserHighest) {
          listing.auction.highestBidPerUser.set(socket.user.id, amount);
        }

        await listing.save();

        // Populate bidders for response
        await listing.populate('auction.bidders.user', 'name email');
        await listing.populate('auction.currentBid.bidder', 'name email');

        // Notify all users in auction room
        io.to(`auction:${listingId}`).emit('auction:update', {
          currentBid: amount,
          bidder: listing.auction.currentBid.bidder,
          allBids: listing.auction.bidders,
        });

        // Notify seller
        await Notification.create({
          user: listing.seller._id,
          type: 'auction_bid',
          message: `New bid of ₹${amount} placed on your auction: ${listing.title}`,
          link: `/listings/${listing._id}`,
        });

      } catch (err) {
        console.error('auction:bid error:', err);
        socket.emit('auction:error', { message: 'Failed to place bid' });
      }
    });
  });
};

const getIO = () => ioInstance;

module.exports = { initSocket, getIO };