const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  share: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'joined'], default: 'pending' },
});

const shareSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collegeDomain: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    splitType: { type: String, enum: ['equal', 'custom', 'percentage'], default: 'equal' },
    members: [memberSchema],
    pendingRequests: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

shareSchema.index({ host: 1, status: 1 });
shareSchema.index({ collegeDomain: 1, status: 1 });

module.exports = mongoose.model('Share', shareSchema);
