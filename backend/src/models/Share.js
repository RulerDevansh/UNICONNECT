const mongoose = require('mongoose');
const { buildGeoPoint } = require('../utils/geo');

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
    hostContribution: { type: Number, default: 0 },
    
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
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      geo: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
      },
      address: { type: String },
      accuracy: { type: Number },
      source: { type: String, enum: ['browser', 'manual'], default: 'manual' },
      updatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

shareSchema.pre('validate', function syncLocationGeo(next) {
  if (this.location) {
    const point = buildGeoPoint(this.location.latitude, this.location.longitude);
    this.location.geo = point;
  }
  next();
});

shareSchema.index({ host: 1, status: 1 });
shareSchema.index({ collegeDomain: 1, status: 1 });
shareSchema.index({ collegeDomain: 1, status: 1, 'location.latitude': 1, 'location.longitude': 1 });
shareSchema.index({ collegeDomain: 1, status: 1, 'location.geo': '2dsphere' });

module.exports = mongoose.model('Share', shareSchema);
