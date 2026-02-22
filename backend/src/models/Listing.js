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
      enum: ['buy-now', 'offer', 'auction'],
      default: 'buy-now',
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
    },
  },
  { timestamps: true }
);

listingSchema.index({ title: 'text', description: 'text', tags: 'text' });
listingSchema.index({ category: 1, collegeDomain: 1, status: 1 });

module.exports = mongoose.model('Listing', listingSchema);
