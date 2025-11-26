const Transaction = require('../models/Transaction');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { getIO } = require('../services/socketService');

const SAFE_CURRENCY = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const sendNotification = async ({ userId, type, title, message, listingId, transactionId }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      listingRef: listingId,
      transactionRef: transactionId,
    });
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }
    return notification;
  } catch (err) {
    console.error('Failed to dispatch notification:', err.message || err);
    return null;
  }
};

/**
 * @route POST /api/transactions
 * @body { listing, offer, transactionType }
 * @description Create a buy request or offer-based transaction
 */
const createTransaction = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.body.listing);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() === req.user.id) {
      return res.status(403).json({ message: 'Seller cannot buy own listing' });
    }
    if (listing.status !== 'active') {
      return res.status(400).json({ message: 'Listing is not available for purchase' });
    }

    // Check if there's already a pending transaction for this buyer and listing
    const existingTransaction = await Transaction.findOne({
      listing: listing._id,
      buyer: req.user.id,
      status: { $in: ['pending', 'approved', 'payment_received'] },
    });
    if (existingTransaction) {
      return res.status(400).json({ message: 'You already have a pending request for this listing' });
    }

    const offer = req.body.offer ? await Offer.findById(req.body.offer) : null;
    if (offer && offer.listing.toString() !== listing._id.toString()) {
      return res.status(422).json({ message: 'Offer does not belong to listing' });
    }

    const transaction = await Transaction.create({
      listing: listing._id,
      buyer: req.user.id,
      seller: listing.seller,
      amount: offer?.amount || listing.price,
      offer: offer?._id,
      transactionType: req.body.transactionType || 'buy_request',
      status: 'pending',
      paymentStatus: 'not_paid',
    });

    await transaction.populate('buyer', 'name email');
    await transaction.populate('listing', 'title price images');

    await sendNotification({
      userId: listing.seller,
      type: 'buy_request_created',
      title: 'New buy request',
      message: `${transaction.buyer?.name || 'A buyer'} wants to purchase ${listing.title} for ${SAFE_CURRENCY(transaction.amount)}.`,
      listingId: listing._id,
      transactionId: transaction._id,
    });

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/transactions/:id
 * @body { status, paymentStatus }
 * @description Update transaction status (approve, reject, mark payment received, complete)
 */
const updateTransactionStatus = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('listing')
      .populate('buyer', 'name email')
      .populate('seller', 'name email');
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    
    const { status } = req.body;
    const sellerId = transaction.seller?._id?.toString?.() || transaction.seller?.toString();
    const buyerId = transaction.buyer?._id?.toString?.() || transaction.buyer?.toString();
    const isSeller = sellerId === req.user.id;
    const isBuyer = buyerId === req.user.id;
    const listingId = transaction.listing?._id || transaction.listing;
    const listingTitle = transaction.listing?.title || 'your listing';
    const buyerName = transaction.buyer?.name || 'Buyer';
    const sellerName = transaction.seller?.name || 'Seller';

    if (!isSeller && !isBuyer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Seller approves or rejects the buy request
    if (status === 'approved' && isSeller && transaction.status === 'pending') {
      transaction.status = 'approved';
      await sendNotification({
        userId: buyerId,
        type: 'buy_request_approved',
        title: 'Buy request approved',
        message: `${sellerName} approved your buy request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    } else if (status === 'rejected' && isSeller && (transaction.status === 'pending' || transaction.status === 'approved')) {
      transaction.status = 'rejected';
      // Delete related chat/messages for this listing and buyer
      try {
        const Chat = require('../models/Chat');
        const Message = require('../models/Message');
        const chats = await Chat.find({ listingRef: transaction.listing._id, participants: transaction.buyer }, '_id');
        if (chats.length) {
          const chatIds = chats.map((chat) => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
          await Chat.deleteMany({ _id: { $in: chatIds } });
        }
      } catch (err) {
        console.error('Error during chat cleanup for rejected request:', err);
      }
      await sendNotification({
        userId: buyerId,
        type: 'buy_request_rejected',
        title: 'Buy request rejected',
        message: `${sellerName} rejected your buy request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    }
    // Buyer withdraws/cancels the request
    else if (status === 'withdrawn' && isBuyer && (transaction.status === 'pending' || transaction.status === 'approved')) {
      transaction.status = 'withdrawn';
      // Delete related chat/messages for this listing and buyer
      try {
        const Chat = require('../models/Chat');
        const Message = require('../models/Message');
        const chats = await Chat.find({ listingRef: transaction.listing._id, participants: transaction.buyer }, '_id');
        if (chats.length) {
          const chatIds = chats.map((chat) => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
          await Chat.deleteMany({ _id: { $in: chatIds } });
        }
      } catch (err) {
        console.error('Error during chat cleanup for withdrawn request:', err);
      }
      await sendNotification({
        userId: sellerId,
        type: 'buy_request_withdrawn',
        title: 'Buyer withdrew request',
        message: `${buyerName} withdrew their buy request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    }
    // Buyer marks payment as sent
    else if (status === 'payment_sent' && isBuyer && transaction.status === 'approved') {
      transaction.status = 'payment_sent';
      await sendNotification({
        userId: sellerId,
        type: 'buy_request_payment_sent',
        title: 'Payment sent',
        message: `${buyerName} marked payment as sent for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    }
    // Seller confirms payment received
    else if (status === 'payment_received' && isSeller && transaction.status === 'payment_sent') {
      transaction.status = 'payment_received';
      transaction.paymentStatus = 'paid';
      await sendNotification({
        userId: buyerId,
        type: 'buy_request_payment_received',
        title: 'Payment confirmed',
        message: `${sellerName} confirmed your payment for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
      
      // Hide the listing from marketplace
      const listing = await Listing.findById(transaction.listing._id);
      if (listing) {
        listing.status = 'sold';
        await listing.save();
      }
      
      // Cancel all other pending/approved/payment_sent transactions for the same listing
      const otherTransactions = await Transaction.find({
        listing: transaction.listing._id,
        _id: { $ne: transaction._id },
        status: { $in: ['pending', 'approved', 'payment_sent'] }
      });

      for (const otherTx of otherTransactions) {
        const hadPaid = otherTx.status === 'payment_sent';
        otherTx.status = 'cancelled';
        otherTx.cancellationReason = 'Product sold to another buyer';
        // If the other buyer had already sent payment, mark it for refund
        if (hadPaid) {
          otherTx.paymentStatus = 'refunded';
        }
        await otherTx.save();

        await sendNotification({
          userId: otherTx.buyer,
          type: 'buy_request_cancelled',
          title: 'Buy request cancelled',
          message: `Your buy request for ${listingTitle} was cancelled because the product was sold to another buyer.`,
          listingId,
          transactionId: otherTx._id,
        });
      }
    }
    // Seller marks as completed (product delivered)
    else if (status === 'completed' && isSeller && transaction.status === 'payment_received') {
      transaction.status = 'completed';
      
      // Store listing snapshot and delete the listing
      const listing = await Listing.findById(transaction.listing._id);
      if (listing) {
        // Save listing details in transaction for history
        transaction.listingSnapshot = {
          title: listing.title,
          price: listing.price,
          images: listing.images,
          category: listing.category,
          description: listing.description,
        };
        // Delete chats associated with this listing
        try {
          const chats = await Chat.find({ listingRef: transaction.listing._id });
          let deletedChats = 0, deletedMessages = 0;
          for (const chat of chats) {
            try {
              const msgResult = await Message.deleteMany({ chat: chat._id });
              deletedMessages += msgResult.deletedCount || 0;
              await Chat.findByIdAndDelete(chat._id);
              deletedChats++;
            } catch (err) {
              console.error(`Error deleting chat/messages for chat ${chat._id}:`, err);
            }
          }
          console.log(`Cleanup: Deleted ${deletedChats} chats and ${deletedMessages} messages for completed listing ${transaction.listing._id}`);
        } catch (err) {
          console.error('Error during chat cleanup for completed listing:', err);
        }
        // Delete the listing from database
        await Listing.findByIdAndDelete(transaction.listing._id);
      }

      await sendNotification({
        userId: buyerId,
        type: 'buy_request_completed',
        title: 'Purchase completed',
        message: `${sellerName} marked the transaction for ${listingTitle} as completed.`,
        listingId,
        transactionId: transaction._id,
      });
    } else {
      return res.status(400).json({ message: 'Invalid status transition' });
    }

    await transaction.save();
    await transaction.populate('buyer', 'name email');
    await transaction.populate('seller', 'name email');
    await transaction.populate('listing', 'title price images');

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/transactions
 */
const listTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ buyer: req.user.id }, { seller: req.user.id }],
    })
      .populate('listing', 'title price')
      .sort('-createdAt');
    res.json(transactions);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/transactions/requests
 * @description Get all buy requests for seller's listings (all statuses)
 */
const getPendingRequests = async (req, res, next) => {
  try {
    const requests = await Transaction.find({
      seller: req.user.id,
    })
      .populate('buyer', 'name email')
      .populate('listing', 'title price images')
      .sort('-createdAt');
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/transactions/my-requests
 * @description Get buyer's own buy requests
 */
const getMyRequests = async (req, res, next) => {
  try {
    const requests = await Transaction.find({
      buyer: req.user.id,
    })
      .populate('seller', 'name email')
      .populate('listing', 'title price images')
      .sort('-createdAt');
    res.json(requests);
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  createTransaction, 
  updateTransactionStatus, 
  listTransactions,
  getPendingRequests,
  getMyRequests,
};
