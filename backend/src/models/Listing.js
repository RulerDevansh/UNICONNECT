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
    tags: [{ type: String }],
    images: [imageSchema],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collegeDomain: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'active', 'flagged', 'sold', 'archived'],
      default: 'active',
    },
    auction: {
      isAuction: { type: Boolean, default: false },
      startBid: Number,
      currentBid: { amount: Number, bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } },
      endTime: Date,
      bidders: [
        {
          bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          amount: Number,
          createdAt: Date,
        },
      ],
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
