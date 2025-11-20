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
      const current = auctions.get(listingId) || { amount: listing.auction.startBid };
      if (amount <= current.amount) {
        socket.emit('auction:rejected', { reason: 'Bid too low' });
        return;
      }
      const bid = { amount, bidder: socket.user.id, createdAt: new Date() };
      auctions.set(listingId, bid);
      listing.auction.currentBid = { amount, bidder: socket.user.id };
      listing.auction.bidders.push(bid);
      await listing.save();
      io.to(`auction:${listingId}`).emit('auction:bid', bid);
    });

    socket.on('auction:end', async ({ listingId }) => {
      const listing = await Listing.findById(listingId);
      if (!listing || listing.seller.toString() !== socket.user.id) return;
      listing.auction.isAuction = false;
      await listing.save();
      const finalBid = auctions.get(listingId);
      io.to(`auction:${listingId}`).emit('auction:ended', finalBid);
      auctions.delete(listingId);
    });
  });
};

module.exports = { initSocket, auctions };
