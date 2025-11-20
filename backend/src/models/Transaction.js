const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    offer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'completed', 'disputed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ seller: 1, buyer: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
