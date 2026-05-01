const Report = require('../models/Report');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getIO } = require('../services/socketService');

const notifyAdminsListingFlagged = async ({ listing, reason, source }) => {
  try {
    const admins = await User.find({ role: 'admin' }, '_id').lean();
    if (!admins.length) return;
    const io = getIO();
    const payload = {
      type: 'listing_flagged_admin',
      title: 'Listing flagged for review',
      message: `${listing.title} flagged (${source || 'report'}${reason ? `: ${reason}` : ''}).`,
      listingRef: listing._id,
    };
    await Promise.all(
      admins.map((admin) => Notification.create({ user: admin._id, ...payload }))
    );
    if (io) {
      admins.forEach((admin) => {
        io.to(`user:${admin._id.toString()}`).emit('notification', payload);
      });
    }
  } catch {
    // best-effort
  }
};

/**
 * @route POST /api/reports
 * @body { listing, reason, message }
 */
const createReport = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.body.listing);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const allowedReasons = ['spam', 'fraud', 'policy', 'other', 'beer_bottle_detected'];
    const rawReason = (req.body.reason || '').toString().trim();
    const reason = allowedReasons.includes(rawReason) ? rawReason : 'other';
    const message = (req.body.message || '').toString().trim();
    const reportReason = rawReason || reason;

    const report = await Report.create({
      reporter: req.user.id,
      listing: req.body.listing,
      message,
      reason,
    });

    listing.status = 'blocked';
    listing.moderation = listing.moderation || {};
    listing.moderation.flagged = true;
    listing.moderation.reason = reason || listing.moderation.reason || 'user_report';
    listing.moderation.source = 'report';
    listing.moderation.reportReason = reportReason;
    listing.moderation.reportMessage = message;
    listing.moderation.reportedBy = req.user.id;
    listing.moderation.reportedAt = new Date();
    await listing.save();

    await notifyAdminsListingFlagged({
      listing,
      reason: reportReason,
      source: 'report',
    });

    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

module.exports = { createReport };
