const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: String,
  publicId: String,
});

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ['physical', 'digital', 'ticket', 'merch'],
      required: true,
    },
    condition: {
      type: String,
      enum: ['new', 'like-new', 'good', 'fair', 'poor'],
      default: 'good',
    },
    listingType: {
      type: String,
      enum: ['buy-now', 'offer', 'auction', 'rental'],
      default: 'buy-now',
    },
    rental: {
      ratePerDay: { type: Number, min: 0 },
      securityDeposit: { type: Number, min: 0, default: 0 },
      availableFrom: { type: Date },
      availableUntil: { type: Date },
      minimumDays: { type: Number, min: 1, default: 1 },
    },
    auction: {
      isAuction: { type: Boolean, default: false },
      startBid: { type: Number, min: 0 },
      endTime: { type: Date },
      currentBid: {
        amount: { type: Number, default: 0 },
        bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date },
      },
      bidders: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          amount: { type: Number },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      highestBidPerUser: { type: Map, of: Number },
      winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: {
        type: String,
        enum: ['active', 'ended', 'cancelled'],
        default: 'active',
      },
    },
    tags: [{ type: String }],
    images: [imageSchema],
    mlFlag: { type: Boolean, default: false },
    mlPredictionLabel: { type: String },
    mlConfidence: { type: Number },
    mlNeedsReview: { type: Boolean, default: false },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collegeDomain: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'flagged', 'sold', 'archived', 'blocked'],
      default: 'active',
    },
    moderation: {
      flagged: { type: Boolean, default: false },
      score: Number,
      reason: String,
      source: { type: String, enum: ['system', 'report', 'review_request'] },
      reportReason: String,
      reportMessage: String,
      action: { type: String, enum: ['approve', 'block', 'ban'] },
      reviewNotes: String,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reportedAt: { type: Date },
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String },
      accuracy: { type: Number },
      source: { type: String, enum: ['browser', 'manual'], default: 'manual' },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

listingSchema.index({ title: 'text', description: 'text', tags: 'text' });
listingSchema.index({ category: 1, collegeDomain: 1, status: 1 });
listingSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

module.exports = mongoose.model('Listing', listingSchema);
