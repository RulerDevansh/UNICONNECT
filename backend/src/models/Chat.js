const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isGroup: { type: Boolean, default: false },
    shareRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Share' },
    listingRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
    lastMessageAt: Date,
  },
  { timestamps: true }
);

chatSchema.index({ participants: 1 });

module.exports = mongoose.model('Chat', chatSchema);
