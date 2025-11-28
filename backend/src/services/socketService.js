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
        const listing = await Listing.findById(listingId).populate('seller', 'name');
        if (!listing || listing.listingType !== 'auction') return;
        const highestMap = listing.auction?.highestBidPerUser;
        let highestObj = {};
        if (highestMap && typeof highestMap.forEach === 'function') {
          highestMap.forEach((val, key) => { highestObj[key] = val; });
        }
        socket.emit('auction:update', {
          listingId,
          currentBid: listing.auction?.currentBid || null,
          highestBidPerUser: highestObj,
        });
      } catch (err) {
        console.error('bidding:join error:', err);
      }
    });

    socket.on('auction:bid', async ({ listingId, amount }) => {
      try {
        const listing = await Listing.findById(listingId).exec();
        if (!listing || listing.listingType !== 'auction') {
          socket.emit('auction:error', { message: 'Auction not available' });
          return;
        }

        const sellerId = listing.seller?.toString();
        if (sellerId === socket.user.id) {
          socket.emit('auction:error', { message: 'Seller cannot bid on own listing' });
          return;
        }

        const endTime = listing.auction?.endTime ? new Date(listing.auction.endTime) : null;
        if (!endTime || endTime <= new Date()) {
          socket.emit('auction:error', { message: 'Auction period ended' });
          return;
        }

        const minAcceptable = Math.max(
          Number(listing.auction?.startBid || 0),
          Number(listing.auction?.currentBid?.amount || 0) + 1
        );
        if (amount < minAcceptable) {
          socket.emit('auction:error', { message: `Value must be greater than or equal to ${minAcceptable}.` });
          return;
        }

        listing.auction = listing.auction || {};
        listing.auction.currentBid = { amount, bidder: socket.user.id, timestamp: new Date() };
        listing.auction.bidders = listing.auction.bidders || [];
        listing.auction.bidders.push({ user: socket.user.id, amount, timestamp: new Date() });
        listing.auction.highestBidPerUser = listing.auction.highestBidPerUser || new Map();
        const prev = listing.auction.highestBidPerUser.get(socket.user.id) || 0;
        if (amount > prev) listing.auction.highestBidPerUser.set(socket.user.id, amount);

        await listing.save();

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
      } catch (err) {
        console.error('auction:bid error:', err);
        socket.emit('auction:error', { message: 'Failed to place bid' });
      }
    });
  });
};

const getIO = () => ioInstance;

module.exports = { initSocket, getIO };