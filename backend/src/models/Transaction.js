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
      enum: ['pending', 'approved', 'payment_sent', 'payment_received', 'completed', 'rejected', 'withdrawn', 'cancelled', 'disputed'],
      default: 'pending',
    },
    transactionType: {
      type: String,
      enum: ['buy_request', 'offer_based', 'auction'],
      default: 'buy_request',
    },
    paymentStatus: {
      type: String,
      enum: ['not_paid', 'paid', 'refunded'],
      default: 'not_paid',
    },
    cancellationReason: {
      type: String,
    },
    listingSnapshot: {
      title: String,
      price: Number,
      images: [{ url: String, publicId: String }],
      category: String,
      description: String,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ seller: 1, buyer: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
