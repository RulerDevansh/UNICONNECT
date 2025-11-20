const Listing = require('../models/Listing');
const Report = require('../models/Report');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * @route GET /api/admin/flagged
 */
const getFlaggedListings = async (_req, res, next) => {
  try {
    const listings = await Listing.find({ 'moderation.flagged': true });
    res.json(listings);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/admin/flagged/:id
 * @body { action: 'approve'|'ban' }
 */
const reviewListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    listing.status = req.body.action === 'ban' ? 'archived' : 'active';
    listing.moderation.flagged = false;
    await listing.save();
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/admin/reports
 */
const getReports = async (_req, res, next) => {
  try {
    const reports = await Report.find().populate('listing', 'title').populate('reporter', 'name email');
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/admin/metrics
 */
const getMetrics = async (_req, res, next) => {
  try {
    const [users, listings, transactions] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Transaction.countDocuments(),
    ]);
    res.json({ users, listings, transactions });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFlaggedListings, reviewListing, getReports, getMetrics };
