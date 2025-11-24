const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  share: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'joined', 'cancelled'], default: 'pending' },
});

const rejectedRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: 'Trip fully occupied' },
  rejectedAt: { type: Date, default: Date.now },
});

const shareSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collegeDomain: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    splitType: { type: String, enum: ['equal', 'custom', 'percentage'], default: 'equal' },
    hostContribution: { type: Number, default: 0 }, // Amount host is willing to pay
    
    // Sharing type
    shareType: { type: String, enum: ['cab', 'food', 'product', 'other'], default: 'other' },
    
    // Cab sharing fields
    fromCity: String,
    toCity: String,
    departureTime: Date,
    arrivalTime: Date,
    bookingDeadline: Date,
    maxPassengers: Number,
    vehicleType: String,
    
    // Food sharing fields
    foodItems: String,
    quantity: Number,
    minPersons: Number,
    maxPersons: Number,
    deadlineTime: Date,
    
    // Product sharing fields
    productName: String,
    productCategory: String,
    bulkQuantity: Number,
    pricePerUnit: Number,
    
    // Other sharing fields
    category: String,
    otherMinPersons: Number,
    otherMaxPersons: Number,
    otherDeadline: Date,
    
    members: [memberSchema],
    pendingRequests: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    rejectedRequests: {
      type: [rejectedRequestSchema],
      default: [],
    },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

shareSchema.index({ host: 1, status: 1 });
shareSchema.index({ collegeDomain: 1, status: 1 });

module.exports = mongoose.model('Share', shareSchema);
