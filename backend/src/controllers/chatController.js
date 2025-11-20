const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Listing = require('../models/Listing');

/**
 * @route GET /api/chats
 */
const listChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({ participants: req.user.id })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('participants', 'name email role avatar');
    res.json(chats);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/chats/:id/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat || !chat.participants.map((id) => id.toString()).includes(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const messages = await Message.find({ chat: req.params.id })
      .sort('createdAt')
      .populate('sender', 'name email role avatar');
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/chats
 * @body { userId }
 */
const createChat = async (req, res, next) => {
  try {
    const { userId, listingId } = req.body;
    if (!userId && !listingId) {
      return res.status(400).json({ message: 'Recipient required' });
    }

    let targetUserId = userId;
    let listingRef = null;

    if (listingId) {
      const listing = await Listing.findById(listingId).select('seller');
      if (!listing) {
        return res.status(404).json({ message: 'Listing not found' });
      }
      listingRef = listing._id;
      targetUserId = listing.seller?.toString();
    }

    if (!targetUserId) {
      return res.status(400).json({ message: 'Recipient required' });
    }

    if (req.user.id === targetUserId) {
      return res.status(400).json({ message: 'Cannot chat with self' });
    }

    const participantsCriteria = { participants: { $all: [req.user.id, targetUserId], $size: 2 } };
    let query = participantsCriteria;
    if (listingRef) {
      query = { ...participantsCriteria, listingRef };
    } else {
      query = {
        ...participantsCriteria,
        $or: [{ listingRef: { $exists: false } }, { listingRef: null }],
      };
    }

    const exists = await Chat.findOne(query).populate('participants', 'name email role avatar');
    if (exists) {
      return res.json(exists);
    }

    const chat = await Chat.create({
      participants: [req.user.id, targetUserId],
      isGroup: false,
      listingRef: listingRef || undefined,
    });
    await chat.populate('participants', 'name email role avatar');
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
};

module.exports = { listChats, getMessages, createChat };