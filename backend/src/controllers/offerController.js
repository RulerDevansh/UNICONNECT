const Offer = require('../models/Offer');
const Listing = require('../models/Listing');

/**
 * @route POST /api/offers
 * @body { listing: ObjectId, amount: Number, notes?: string }
 * @returns Offer document
 */
const createOffer = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.body.listing);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() === req.user.id) {
      return res.status(403).json({ message: 'Cannot offer on own listing' });
    }

    if (Number(req.body.amount) <= 0) {
      return res.status(422).json({ message: 'Offer must be positive' });
    }

    const offer = await Offer.create({
      listing: listing._id,
      buyer: req.user.id,
      amount: req.body.amount,
      type: listing.listingType === 'auction' ? 'bid' : 'offer',
      notes: req.body.notes,
    });

    res.status(201).json(offer);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/offers/:id
 * @body { status: 'pending'|'accepted'|'rejected'|'withdrawn' }
 */
const updateOfferStatus = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id).populate('listing');
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    if (offer.listing.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only seller can update' });
    }

    const allowed = ['pending', 'accepted', 'rejected', 'withdrawn'];
    if (!allowed.includes(req.body.status)) {
      return res.status(422).json({ message: 'Invalid status' });
    }
    offer.status = req.body.status;
    await offer.save();
    res.json(offer);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/offers/listing/:listingId (seller only)
 */
const listOffersForListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.listingId);
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    if (listing.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only owner can view offers' });
    }
    const offers = await Offer.find({ listing: req.params.listingId })
      .populate('buyer', 'name email')
      .sort('-createdAt');
    res.json(offers);
  } catch (err) {
    next(err);
  }
};

module.exports = { createOffer, updateOfferStatus, listOffersForListing };
