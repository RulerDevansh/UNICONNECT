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
      // Leave any previously joined chat room before joining the new one
      for (const room of socket.rooms) {
        if (room.startsWith('chat:')) socket.leave(room);
      }
      socket.join(`chat:${chatId}`);
    });

    socket.on('ping', (callback) => {
      // Respond to heartbeat ping
      if (callback) callback({ pong: true });
    });

    socket.on('leaveChat', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    socket.on('typing', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing', { user: socket.user.id });
    });

    socket.on('message', async ({ chatId, content }, callback) => {
      try {
        // Validate chat exists and user is participant
        const chat = await Chat.findById(chatId);
        if (!chat) {
          const error = 'Chat not found';
          if (callback) callback({ success: false, error });
          socket.emit('message:error', { error });
          return;
        }

        if (!chat.participants.map(p => p.toString()).includes(socket.user.id)) {
          const error = 'Forbidden';
          if (callback) callback({ success: false, error });
          socket.emit('message:error', { error });
          return;
        }

        // Create and save message
        const message = await Message.create({
          chat: chatId,
          sender: socket.user.id,
          content,
        });
        
        // Update chat last message time
        await Chat.findByIdAndUpdate(
          chatId, 
          { lastMessageAt: new Date() },
          { new: true }
        );
        
        // Populate sender info
        await message.populate('sender', 'name email avatar');
        
        // Acknowledge to sender with message ID for confirmation
        if (callback) {
          callback({ success: true, messageId: message._id });
        }
        
        // Broadcast message to all users in chat room
        io.to(`chat:${chatId}`).emit('message', message);
        
        // Create notifications for users NOT in the chat room
        const recipients = chat.participants
          .filter(p => p._id.toString() !== socket.user.id)
          .map(p => p._id);
        
        if (recipients.length > 0) {
          const senderName = message.sender?.name || 'Someone';
          const chatRoom = `chat:${chatId}`;
          const socketsInRoom = await io.in(chatRoom).fetchSockets();
          const userIdsInRoom = new Set(socketsInRoom.map(s => s.user?.id));

          for (const recipientId of recipients) {
            const recipientStr = recipientId.toString();
            // Skip notification if the recipient is already viewing this chat
            if (userIdsInRoom.has(recipientStr)) continue;

            // Signal the Chat page to show the blue dot for this chat
            io.to(`user:${recipientStr}`).emit('chat:unread', { chatId });

            const notification = await Notification.create({
              user: recipientId,
              type: 'new_message',
              title: 'New Message',
              message: `${senderName} sent you a message`,
              shareRef: chat.shareRef || null
            });
            
            io.to(`user:${recipientStr}`).emit('notification', notification);
          }
        }
      } catch (err) {
        const error = err.message || 'Failed to save message';
        if (callback) callback({ success: false, error });
        socket.emit('message:error', { error });
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

    socket.on('joinListing', ({ listingId }) => {
      socket.join(`listing:${listingId}`);
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
      } catch {
        // non-fatal
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
      } catch {
        socket.emit('auction:error', { message: 'Failed to place bid' });
      }
    });
  });
};

const getIO = () => ioInstance;

module.exports = { initSocket, getIO };
