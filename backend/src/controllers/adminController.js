const Listing = require('../models/Listing');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../services/socketService');
const { paginate } = require('../utils/pagination');
const { createAuditLog } = require('../services/auditService');

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
  } catch {
    return null;
  }
};

/**
 * @route GET /api/admin/flagged
 */
const getFlaggedListings = async (req, res, next) => {
  try {
    const { page, limit, sort } = paginate(req.query);
    const { status, category, reason, q, flagged, source } = req.query;
    const filter = {};

    if (flagged !== undefined) {
      filter['moderation.flagged'] = flagged === 'true';
    } else {
      filter['moderation.flagged'] = true;
    }
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (reason) filter['moderation.reason'] = { $regex: reason, $options: 'i' };
    if (source) filter['moderation.source'] = source;
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      score: { 'moderation.score': -1 },
    };
    const sortBy = sortMap[sort] || sortMap.newest;

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate('seller', 'name email')
        .populate('moderation.reportedBy', 'name email')
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit),
      Listing.countDocuments(filter),
    ]);

    res.json({
      data: listings,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/admin/disputes
 */
const getRentalDisputes = async (req, res, next) => {
  try {
    const { page, limit, sort } = paginate(req.query);
    const { status = 'open', q } = req.query;

    const filter = {
      transactionType: 'rental_booking',
      disputeStatus: status === 'all' ? { $in: ['open', 'resolved'] } : status,
    };

    if (!['open', 'resolved', 'all'].includes(status)) {
      return res.status(400).json({ message: 'Invalid dispute status filter' });
    }

    if (q) {
      const userIds = await User.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }).distinct('_id');

      filter.$or = [
        { 'listingSnapshot.title': { $regex: q, $options: 'i' } },
        { buyer: { $in: userIds } },
        { seller: { $in: userIds } },
      ];
    }

    const sortMap = {
      newest: { updatedAt: -1 },
      oldest: { updatedAt: 1 },
    };
    const sortBy = sortMap[sort] || sortMap.newest;

    const [disputes, total] = await Promise.all([
      Transaction.find(filter)
        .populate('listing', 'title images listingType')
        .populate('buyer', 'name email')
        .populate('seller', 'name email')
        .populate('disputeResolution.resolvedBy', 'name email')
        .sort(sortBy)
        .skip((page - 1) * limit)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      data: disputes,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/admin/disputes/:id/resolve
 * @body { action: 'release'|'forfeit', notes }
 */
const resolveRentalDispute = async (req, res, next) => {
  try {
    const { action, notes } = req.body;
    if (!['release', 'forfeit'].includes(action)) {
      return res.status(400).json({ message: 'Invalid dispute resolution action' });
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate('listing', 'title')
      .populate('buyer', 'name email')
      .populate('seller', 'name email');

    if (!transaction) return res.status(404).json({ message: 'Dispute transaction not found' });
    if (transaction.transactionType !== 'rental_booking') {
      return res.status(400).json({ message: 'Only rental disputes can be resolved here' });
    }
    if (transaction.disputeStatus !== 'open') {
      return res.status(400).json({ message: 'Dispute is not open' });
    }

    transaction.disputeStatus = 'resolved';
    transaction.rentalStatus = 'closed';
    transaction.status = 'completed';
    transaction.disputeResolution = {
      action,
      notes: (notes || '').trim(),
      resolvedAt: new Date(),
      resolvedBy: req.user.id,
    };

    if (action === 'release') {
      if (['held', 'pending'].includes(transaction.depositStatus)) {
        transaction.depositStatus = 'released';
      }
    } else {
      transaction.depositStatus = 'forfeited';
    }

    await transaction.save();

    await transaction.populate('disputeResolution.resolvedBy', 'name email');

    const listingId = transaction.listing?._id || transaction.listing;
    const listingTitle = transaction.listing?.title || transaction.listingSnapshot?.title || 'listing';
    const buyerId = transaction.buyer?._id || transaction.buyer;
    const sellerId = transaction.seller?._id || transaction.seller;

    if (action === 'release') {
      await Promise.all([
        sendNotification({
          userId: buyerId,
          type: 'rental_dispute_resolved',
          title: 'Rental dispute resolved',
          message: `Admin resolved dispute and released deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        }),
        sendNotification({
          userId: sellerId,
          type: 'rental_dispute_resolved',
          title: 'Rental dispute resolved',
          message: `Admin resolved dispute and released deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        }),
      ]);
    } else {
      await Promise.all([
        sendNotification({
          userId: buyerId,
          type: 'rental_deposit_forfeited',
          title: 'Deposit forfeited',
          message: `Admin resolved dispute and forfeited deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        }),
        sendNotification({
          userId: sellerId,
          type: 'rental_dispute_resolved',
          title: 'Rental dispute resolved',
          message: `Admin resolved dispute and forfeited deposit for ${listingTitle}.`,
          listingId,
          transactionId: transaction._id,
        }),
      ]);
    }

    await createAuditLog({
      actorId: req.user.id,
      action: 'rental.dispute.resolve.admin',
      targetType: 'Transaction',
      targetId: transaction._id,
      details: {
        resolution: action,
        notes: notes || '',
      },
      req,
    });

    res.json(transaction);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/admin/flagged/:id
 * @body { action: 'approve'|'block'|'ban', notes }
 */
const reviewListing = async (req, res, next) => {
  try {
    const { action, notes } = req.body;
    if (!['approve', 'block', 'ban'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const listing = await Listing.findById(req.params.id).populate('seller', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    listing.status = action === 'approve' ? 'active' : 'blocked';
    listing.moderation.flagged = false;
    listing.moderation.action = action;
    listing.moderation.reviewNotes = notes || '';
    listing.moderation.reviewedBy = req.user.id;
    listing.moderation.reviewedAt = new Date();

    await listing.save();

    if (listing.seller) {
      await sendNotification({
        userId: listing.seller._id || listing.seller,
        type: action === 'approve'
          ? 'listing_moderation_approved'
          : action === 'ban'
            ? 'listing_moderation_banned'
            : 'listing_moderation_blocked',
        title: action === 'approve'
          ? 'Listing approved'
          : action === 'ban'
            ? 'Listing banned'
            : 'Listing blocked',
        message: action === 'approve'
          ? `Your listing "${listing.title}" was approved and is now active.`
          : action === 'ban'
            ? `Your listing "${listing.title}" was banned by the admin team.`
            : `Your listing "${listing.title}" was blocked by moderation.`,
        listingId: listing._id,
      });
    }

    if (listing.moderation?.reportedBy) {
      const reporterMessage = action === 'approve'
        ? `Thanks for your report. The listing ("${listing.title}") was approved after review. Please report only genuine issues.`
        : `Thanks for your report. The listing ("${listing.title}") was ${action === 'ban' ? 'banned' : 'blocked'} by the admin team.`;
      await sendNotification({
        userId: listing.moderation.reportedBy,
        type: action === 'approve'
          ? 'listing_moderation_approved'
          : action === 'ban'
            ? 'listing_moderation_banned'
            : 'listing_moderation_blocked',
        title: action === 'approve'
          ? 'Reported listing approved'
          : action === 'ban'
            ? 'Reported listing banned'
            : 'Reported listing blocked',
        message: reporterMessage,
        listingId: listing._id,
      });
    }

    await createAuditLog({
      actorId: req.user.id,
      action: 'listing.review',
      targetType: 'Listing',
      targetId: listing._id,
      details: { action, notes },
      req,
    });

    res.json(listing);
  } catch (err) {
    next(err);
  }
};

const buildDateFilter = (start, end) => {
  const range = {};
  if (start) range.$gte = new Date(start);
  if (end) range.$lte = new Date(end);
  return Object.keys(range).length ? range : null;
};

/**
 * @route GET /api/admin/analytics/overview
 */
const getAnalyticsOverview = async (_req, res, next) => {
  try {
    const [
      users,
      listings,
      transactions,
      flaggedListings,
      suspendedUsers,
      openDisputes,
      resolvedDisputes,
    ] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Transaction.countDocuments(),
      Listing.countDocuments({ 'moderation.flagged': true }),
      User.countDocuments({ suspended: true }),
      Transaction.countDocuments({ transactionType: 'rental_booking', disputeStatus: 'open' }),
      Transaction.countDocuments({ transactionType: 'rental_booking', disputeStatus: 'resolved' }),
    ]);

    res.json({
      users,
      listings,
      transactions,
      flaggedListings,
      suspendedUsers,
      openDisputes,
      resolvedDisputes,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/admin/analytics/trends
 */
const getAnalyticsTrends = async (req, res, next) => {
  try {
    const { start, end, bucket = 'day' } = req.query;
    const range = buildDateFilter(start, end);
    const format = bucket === 'week' ? '%Y-%U' : '%Y-%m-%d';

    const buildPipeline = (match = {}) => {
      const timeMatch = range ? { createdAt: range } : {};
      return [
        { $match: { ...match, ...timeMatch } },
        { $group: { _id: { $dateToString: { format, date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ];
    };

    const [users, listings, transactions] = await Promise.all([
      User.aggregate(buildPipeline()),
      Listing.aggregate(buildPipeline()),
      Transaction.aggregate(buildPipeline()),
    ]);

    res.json({ users, listings, transactions, bucket });
  } catch (err) {
    next(err);
  }
};

/**
 * @route PATCH /api/admin/users/:id/suspension
 */
const updateUserSuspension = async (req, res, next) => {
  try {
    const { suspended, reason } = req.body;
    if (suspended === undefined) {
      return res.status(400).json({ message: 'Suspended flag is required' });
    }

    const update = {
      suspended: !!suspended,
      suspendedReason: suspended ? reason || '' : '',
      suspendedAt: suspended ? new Date() : null,
      suspendedBy: suspended ? req.user.id : null,
    };

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select(
      'name email role suspended suspendedReason'
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    await sendNotification({
      userId: user._id,
      type: suspended ? 'user_suspended' : 'user_unsuspended',
      title: suspended ? 'Account suspended' : 'Account reinstated',
      message: suspended
        ? `Your account has been suspended by the admin team.${reason ? ` Reason: ${reason}` : ''}`
        : 'Your account has been reinstated.',
    });

    await createAuditLog({
      actorId: req.user.id,
      action: 'user.suspension.update',
      targetType: 'User',
      targetId: user._id,
      details: { suspended: !!suspended, reason },
      req,
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/admin/users/:id/warn
 * @body { reason }
 */
const sendUserWarning = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id).select('name email');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const message = reason
      ? `This is a warning from the admin team. Reason: ${reason}`
      : 'This is a warning from the admin team.';

    await sendNotification({
      userId: user._id,
      type: 'user_warning',
      title: 'Account warning',
      message,
    });

    await createAuditLog({
      actorId: req.user.id,
      action: 'user.warning',
      targetType: 'User',
      targetId: user._id,
      details: { reason },
      req,
    });

    res.json({ message: 'Warning sent' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/admin/metrics
 */
const getMetrics = async (req, res, next) => {
  return getAnalyticsOverview(req, res, next);
};

module.exports = {
  getFlaggedListings,
  getRentalDisputes,
  resolveRentalDispute,
  reviewListing,
  getAnalyticsOverview,
  getAnalyticsTrends,
  updateUserSuspension,
  getMetrics,
  sendUserWarning,
};
