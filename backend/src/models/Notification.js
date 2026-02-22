const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'order_cancelled',
        'request_approved',
        'request_rejected',
        'share_full',
        'minimum_not_met',
        'new_message',
        'auction_bid',
        'auction_won',
        'auction_ended',
        'auction_no_bids',
        'bidding_won',
        'bidding_ended',
        'bidding_no_bids',
        'buy_request_created',
        'buy_request_approved',
        'buy_request_rejected',
        'buy_request_withdrawn',
        'buy_request_payment_sent',
        'buy_request_payment_received',
        'buy_request_completed',
        'buy_request_cancelled',
        'share_join_request',
        'share_request_approved',
        'share_request_rejected',
        'share_member_cancelled',
        'share_completed',
        'share_member_joined',
        'share_updated',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    shareRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Share',
    },
    listingRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
    },
    transactionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
