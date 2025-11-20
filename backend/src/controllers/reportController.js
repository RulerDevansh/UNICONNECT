const Report = require('../models/Report');

/**
 * @route POST /api/reports
 * @body { listing, reason, message }
 */
const createReport = async (req, res, next) => {
  try {
    const report = await Report.create({
      reporter: req.user.id,
      listing: req.body.listing,
      message: req.body.message,
      reason: req.body.reason,
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
};

module.exports = { createReport };
