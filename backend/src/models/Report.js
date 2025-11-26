const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    message: String,
    reason: {
      type: String,
      enum: ['spam', 'fraud', 'policy', 'other', 'beer_bottle_detected'],
      default: 'other',
    },
    status: { type: String, enum: ['open', 'reviewed', 'resolved'], default: 'open' },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
