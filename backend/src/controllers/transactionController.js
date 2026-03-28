const Transaction = require('../models/Transaction');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { getIO } = require('../services/socketService');

const SAFE_CURRENCY = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const DAY_MS = 24 * 60 * 60 * 1000;

const calculateRentalDays = (startDate, endDate) => {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / DAY_MS);
};

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
  } catch (_err) {
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

    const isRentalListing = listing.listingType === 'rental';
    const requestedType = req.body.transactionType || 'buy_request';

    if (isRentalListing && requestedType !== 'rental_booking') {
      return res.status(422).json({ message: 'Rental listings require transactionType rental_booking' });
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

    let rentalStartDate = null;
    let rentalEndDate = null;
    let rentalDays = null;

    if (isRentalListing) {
      rentalStartDate = req.body.rentalStartDate ? new Date(req.body.rentalStartDate) : null;
      rentalEndDate = req.body.rentalEndDate ? new Date(req.body.rentalEndDate) : null;

      if (!rentalStartDate || Number.isNaN(rentalStartDate.getTime()) || !rentalEndDate || Number.isNaN(rentalEndDate.getTime())) {
        return res.status(422).json({ message: 'Valid rental start and end dates are required' });
      }

      if (rentalEndDate <= rentalStartDate) {
        return res.status(422).json({ message: 'Rental end date must be after start date' });
      }

      rentalDays = calculateRentalDays(rentalStartDate, rentalEndDate);
      const minimumDays = Number(listing.rental?.minimumDays || 1);
      if (rentalDays < minimumDays) {
        return res.status(422).json({ message: `Minimum rental duration is ${minimumDays} day(s)` });
      }

      if (listing.rental?.availableFrom && rentalStartDate < new Date(listing.rental.availableFrom)) {
        return res.status(422).json({ message: 'Rental start date is before listing availability window' });
      }

      if (listing.rental?.availableUntil && rentalEndDate > new Date(listing.rental.availableUntil)) {
        return res.status(422).json({ message: 'Rental end date is outside listing availability window' });
      }

      const overlapTransaction = await Transaction.findOne({
        listing: listing._id,
        transactionType: 'rental_booking',
        status: { $in: ['pending', 'approved', 'payment_sent', 'payment_received'] },
        rentalStartDate: { $lt: rentalEndDate },
        rentalEndDate: { $gt: rentalStartDate },
      });

      if (overlapTransaction) {
        return res.status(409).json({ message: 'Selected rental dates conflict with another booking request' });
      }
    }

    const offer = req.body.offer ? await Offer.findById(req.body.offer) : null;
    if (offer && offer.listing.toString() !== listing._id.toString()) {
      return res.status(422).json({ message: 'Offer does not belong to listing' });
    }

    const securityDeposit = isRentalListing ? Number(listing.rental?.securityDeposit || 0) : 0;

    const transaction = await Transaction.create({
      listing: listing._id,
      buyer: req.user.id,
      seller: listing.seller,
      amount: isRentalListing
        ? rentalDays * Number(listing.rental?.ratePerDay || listing.price || 0)
        : (offer?.amount || listing.price),
      offer: offer?._id,
      transactionType: isRentalListing ? 'rental_booking' : requestedType,
      rentalStartDate,
      rentalEndDate,
      rentalDays,
      depositAmount: securityDeposit,
      depositStatus: isRentalListing ? (securityDeposit > 0 ? 'pending' : 'not_required') : 'not_required',
      rentalStatus: isRentalListing ? 'requested' : 'requested',
      status: 'pending',
      paymentStatus: 'not_paid',
      listingSnapshot: {
        title: listing.title,
        price: listing.price,
        images: listing.images || [],
        category: listing.category,
        description: listing.description,
      },
    });

    await transaction.populate('buyer', 'name email');
    await transaction.populate('listing', 'title price images');

    await sendNotification({
      userId: listing.seller,
      type: isRentalListing ? 'rental_request_created' : 'buy_request_created',
      title: isRentalListing ? 'New rental request' : 'New buy request',
      message: isRentalListing
        ? `${transaction.buyer?.name || 'A renter'} requested ${listing.title} from ${new Date(rentalStartDate).toLocaleDateString()} to ${new Date(rentalEndDate).toLocaleDateString()} for ${SAFE_CURRENCY(transaction.amount)}.`
        : `${transaction.buyer?.name || 'A buyer'} wants to purchase ${listing.title} for ${SAFE_CURRENCY(transaction.amount)}.`,
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
    
    const { status, rentalAction } = req.body;
    const sellerId = transaction.seller?._id?.toString?.() || transaction.seller?.toString();
    const buyerId = transaction.buyer?._id?.toString?.() || transaction.buyer?.toString();
    const isSeller = sellerId === req.user.id;
    const isBuyer = buyerId === req.user.id;
    const listingId = transaction.listing?._id || transaction.listing;
    const listingTitle = transaction.listing?.title || 'your listing';
    const buyerName = transaction.buyer?.name || 'Buyer';
    const sellerName = transaction.seller?.name || 'Seller';
    const isRentalRequest = transaction.transactionType === 'rental_booking';

    if (isRentalRequest && rentalAction) {
      if (!isSeller && rentalAction !== 'raise_dispute') {
        return res.status(403).json({ message: 'Only owner can perform this rental action' });
      }

      if (rentalAction === 'mark_active') {
        if (transaction.status !== 'approved' || transaction.rentalStatus !== 'approved') {
          return res.status(400).json({ message: 'Rental can be started only after approval' });
        }
        transaction.rentalStatus = 'active';
        if (transaction.depositAmount > 0 && transaction.depositStatus === 'pending') {
          transaction.depositStatus = 'held';
        }
        await sendNotification({
          userId: buyerId,
          type: 'rental_started',
          title: 'Rental started',
          message: `${sellerName} marked your rental for ${listingTitle} as active.`,
          listingId,
          transactionId: transaction._id,
        });
      } else if (rentalAction === 'confirm_return') {
        if (transaction.rentalStatus !== 'active') {
          return res.status(400).json({ message: 'Rental return can be confirmed only from active status' });
        }
        transaction.rentalStatus = transaction.depositStatus === 'held' ? 'returned' : 'closed';
        transaction.returnConfirmedBySeller = true;
        transaction.returnConfirmedAt = new Date();
        if (transaction.rentalStatus === 'closed') {
          transaction.status = 'completed';
        }
        await sendNotification({
          userId: buyerId,
          type: 'rental_return_confirmed',
          title: 'Rental return confirmed',
          message: `${sellerName} confirmed return for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        });
      } else if (rentalAction === 'release_deposit') {
        if (transaction.depositStatus !== 'held' || transaction.rentalStatus !== 'returned') {
          return res.status(400).json({ message: 'Deposit can be released only after return confirmation' });
        }
        transaction.depositStatus = 'released';
        transaction.rentalStatus = 'closed';
        transaction.status = 'completed';
        await sendNotification({
          userId: buyerId,
          type: 'rental_deposit_released',
          title: 'Deposit released',
          message: `${sellerName} released security deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        });
      } else if (rentalAction === 'raise_dispute') {
        if (!isBuyer && !isSeller) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        transaction.disputeStatus = 'open';
        const recipientId = isBuyer ? sellerId : buyerId;
        await sendNotification({
          userId: recipientId,
          type: 'rental_dispute_opened',
          title: 'Rental dispute opened',
          message: `${isBuyer ? buyerName : sellerName} raised a dispute for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        });
      } else if (rentalAction === 'resolve_dispute_release') {
        if (!isSeller) {
          return res.status(403).json({ message: 'Only owner can resolve rental disputes' });
        }
        if (transaction.disputeStatus !== 'open') {
          return res.status(400).json({ message: 'No open dispute to resolve' });
        }
        transaction.disputeStatus = 'resolved';
        if (transaction.depositStatus === 'held' || transaction.depositStatus === 'pending') {
          transaction.depositStatus = 'released';
        }
        transaction.rentalStatus = 'closed';
        transaction.status = 'completed';
        await sendNotification({
          userId: buyerId,
          type: 'rental_dispute_resolved',
          title: 'Rental dispute resolved',
          message: `${sellerName} resolved dispute and released deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        });
      } else if (rentalAction === 'resolve_dispute_forfeit') {
        if (!isSeller) {
          return res.status(403).json({ message: 'Only owner can resolve rental disputes' });
        }
        if (transaction.disputeStatus !== 'open') {
          return res.status(400).json({ message: 'No open dispute to resolve' });
        }
        transaction.disputeStatus = 'resolved';
        transaction.depositStatus = 'forfeited';
        transaction.rentalStatus = 'closed';
        transaction.status = 'completed';
        await sendNotification({
          userId: buyerId,
          type: 'rental_deposit_forfeited',
          title: 'Deposit forfeited',
          message: `${sellerName} resolved dispute and forfeited deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        });
      } else {
        return res.status(400).json({ message: 'Invalid rental action' });
      }

      await transaction.save();
      await transaction.populate('buyer', 'name email');
      await transaction.populate('seller', 'name email');
      await transaction.populate('listing', 'title price images listingType');
      return res.json(transaction);
    }

    if (!isSeller && !isBuyer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Seller approves or rejects the buy request
    if (status === 'approved' && isSeller && transaction.status === 'pending') {
      transaction.status = 'approved';
      if (isRentalRequest) transaction.rentalStatus = 'approved';
      await sendNotification({
        userId: buyerId,
        type: isRentalRequest ? 'rental_request_approved' : 'buy_request_approved',
        title: isRentalRequest ? 'Rental request approved' : 'Buy request approved',
        message: `${sellerName} approved your ${isRentalRequest ? 'rental' : 'buy'} request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    } else if (status === 'rejected' && isSeller && (transaction.status === 'pending' || transaction.status === 'approved')) {
      transaction.status = 'rejected';
      // Delete related chat/messages for this listing and buyer
      try {
        const chats = await Chat.find({ listingRef: transaction.listing._id, participants: transaction.buyer }, '_id');
        if (chats.length) {
          const chatIds = chats.map((chat) => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
          await Chat.deleteMany({ _id: { $in: chatIds } });
        }
      } catch (_err) {
        // chat cleanup is best-effort
      }
      await sendNotification({
        userId: buyerId,
        type: isRentalRequest ? 'rental_request_rejected' : 'buy_request_rejected',
        title: isRentalRequest ? 'Rental request rejected' : 'Buy request rejected',
        message: `${sellerName} rejected your ${isRentalRequest ? 'rental' : 'buy'} request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    }
    // Buyer withdraws/cancels the request
    else if (status === 'withdrawn' && isBuyer && (transaction.status === 'pending' || transaction.status === 'approved')) {
      transaction.status = 'withdrawn';
      // Delete related chat/messages for this listing and buyer
      try {
        const chats = await Chat.find({ listingRef: transaction.listing._id, participants: transaction.buyer }, '_id');
        if (chats.length) {
          const chatIds = chats.map((chat) => chat._id);
          await Message.deleteMany({ chat: { $in: chatIds } });
          await Chat.deleteMany({ _id: { $in: chatIds } });
        }
      } catch (_err) {
        // chat cleanup is best-effort
      }
      await sendNotification({
        userId: sellerId,
        type: isRentalRequest ? 'rental_request_withdrawn' : 'buy_request_withdrawn',
        title: isRentalRequest ? 'Renter withdrew request' : 'Buyer withdrew request',
        message: `${buyerName} withdrew their ${isRentalRequest ? 'rental' : 'buy'} request for ${listingTitle}.`,
        listingId,
        transactionId: transaction._id,
      });
    }
    else if (isRentalRequest && ['payment_sent', 'payment_received'].includes(status)) {
      return res.status(400).json({ message: 'Payment status updates are not enabled for rental requests yet' });
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
      
      // For auctions/bidding, keep listing visible until completion.
      // For buy-now/offer-based, hide after payment received.
      if (transaction.transactionType !== 'auction') {
        const listing = await Listing.findById(transaction.listing._id);
        if (listing) {
          listing.status = 'sold';
          await listing.save();
        }
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
          for (const chat of chats) {
            try {
              await Message.deleteMany({ chat: chat._id });
              await Chat.findByIdAndDelete(chat._id);
            } catch (_err) {
              // chat cleanup is best-effort
            }
          }
        } catch (_err) {
          // chat cleanup is best-effort
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
