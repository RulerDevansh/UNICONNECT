const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    type: { type: String, enum: ['offer', 'bid'], default: 'offer' },
    notes: String,
  },
  { timestamps: true }
);

offerSchema.index({ listing: 1, buyer: 1 });

module.exports = mongoose.model('Offer', offerSchema);
