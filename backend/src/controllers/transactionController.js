const Transaction = require('../models/Transaction');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');

/**
 * @route POST /api/transactions
 * @body { listing, offer }
 */
const createTransaction = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.body.listing);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() === req.user.id) {
      return res.status(403).json({ message: 'Seller cannot buy own listing' });
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
    });
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/transactions/:id
 * @body { status }
 */
const updateTransactionStatus = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Not found' });
    if (![transaction.seller.toString(), transaction.buyer.toString()].includes(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    transaction.status = req.body.status;
    await transaction.save();
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

module.exports = { createTransaction, updateTransactionStatus, listTransactions };
