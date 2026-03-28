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
      enum: ['pending', 'approved', 'payment_sent', 'payment_received', 'completed', 'rejected', 'withdrawn', 'cancelled'],
      default: 'pending',
    },
    transactionType: {
      type: String,
      enum: ['buy_request', 'offer_based', 'auction', 'rental_booking'],
      default: 'buy_request',
    },
    rentalStartDate: {
      type: Date,
    },
    rentalEndDate: {
      type: Date,
    },
    rentalDays: {
      type: Number,
      min: 1,
    },
    depositAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    depositStatus: {
      type: String,
      enum: ['not_required', 'pending', 'held', 'released', 'forfeited'],
      default: 'not_required',
    },
    rentalStatus: {
      type: String,
      enum: ['requested', 'approved', 'active', 'returned', 'closed'],
      default: 'requested',
    },
    disputeStatus: {
      type: String,
      enum: ['none', 'open', 'resolved'],
      default: 'none',
    },
    disputeResolution: {
      action: {
        type: String,
        enum: ['release', 'forfeit'],
      },
      notes: {
        type: String,
        default: '',
      },
      resolvedAt: {
        type: Date,
      },
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    },
    returnConfirmedBySeller: {
      type: Boolean,
      default: false,
    },
    returnConfirmedAt: {
      type: Date,
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
