const fs = require('fs');
const path = require('path');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const { uploadImage } = require('../config/cloudinary');
const { paginate } = require('../utils/pagination');
const { validateListingFilters } = require('../utils/validators');
const { callModeration } = require('../services/moderationService');

const TEMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const buildQuery = (query) => {
  const filters = validateListingFilters(query);
  const mongoQuery = { status: { $ne: 'archived' } };
  if (filters.collegeDomain) mongoQuery.collegeDomain = filters.collegeDomain;
  if (filters.category) mongoQuery.category = filters.category;
  if (filters.condition) mongoQuery.condition = filters.condition;
  if (filters.q) mongoQuery.$text = { $search: filters.q };
  if (filters.tags?.length) mongoQuery.tags = { $in: filters.tags };
  if (filters.priceMin || filters.priceMax) {
    mongoQuery.price = {};
    if (filters.priceMin) mongoQuery.price.$gte = filters.priceMin;
    if (filters.priceMax) mongoQuery.price.$lte = filters.priceMax;
  }
  return mongoQuery;
};

/**
 * @route GET /api/listings/me
 */
const listMyListings = async (req, res, next) => {
  try {
    const listings = await Listing.find({ seller: req.user.id }).sort('-createdAt');
    res.json(listings);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/listings
 * @query q, category, tags, priceMin, priceMax, condition, collegeId, sort, page, limit
 * @returns {Object} { data: Listing[], page, pages, total }
 */
const listListings = async (req, res, next) => {
  try {
    const { page, limit, sort } = paginate(req.query);
    const sortMap = {
      newest: { createdAt: -1 },
      priceAsc: { price: 1 },
      priceDesc: { price: -1 },
    };
    const mongoQuery = buildQuery(req.query);
    const listings = await Listing.find(mongoQuery)
      .populate('seller', 'name email')
      .sort(sortMap[sort] || sortMap.newest)
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await Listing.countDocuments(mongoQuery);
    res.json({ data: listings, page, pages: Math.ceil(total / limit), total });
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/listings/:id
 * @returns {Listing}
 */
const getListing = async (req, res, next) => {
  try {
    const listing = await Listing.findById(req.params.id).populate('seller', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/listings
 * @body {title, description, price, category, listingType, auction, tags[]}
 * @returns {Listing}
 */
const createListing = async (req, res, next) => {
  try {
    if (req.body.listingType === 'auction') {
      if (!req.body.auction?.startBid || !req.body.auction?.endTime) {
        return res.status(422).json({ message: 'Auction requires startBid and endTime' });
      }
    }

    const normalizedTags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
        ? req.body.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];

    const auctionData = req.body.listingType === 'auction' && req.body.auction
      ? { ...req.body.auction, isAuction: true, bidders: [] }
      : {};

    const listing = await Listing.create({
      ...req.body,
      seller: req.user.id,
      collegeDomain: req.user.collegeDomain,
      tags: normalizedTags,
      listingType: req.body.listingType || 'buy-now',
      auction: auctionData,
    });

    const moderation = await callModeration({
      text: `${listing.title} ${listing.description}`,
      metadata: { listingId: listing._id },
    });
    listing.moderation = moderation;
    if (moderation.flagged) {
      listing.status = 'flagged';
    }
    await listing.save();

    res.status(201).json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/listings/:id
 * @returns {Listing}
 */
const updateListing = async (req, res, next) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const updates = { ...req.body };
    if (updates.tags) {
      updates.tags = Array.isArray(updates.tags)
        ? updates.tags
        : updates.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    Object.assign(listing, updates);
    if (listing.listingType === 'auction') {
      if (!listing.auction?.startBid || !listing.auction?.endTime) {
        return res.status(422).json({ message: 'Auction requires startBid and endTime' });
      }
      listing.auction.isAuction = true;
    }
    listing.moderation = await callModeration({
      text: `${listing.title} ${listing.description}`,
      metadata: { listingId: listing._id },
    });
    if (listing.moderation.flagged) {
      listing.status = 'flagged';
    } else if (listing.status === 'flagged') {
      listing.status = 'active';
    }

    await listing.save();
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/listings/:id/images
 * @description Accepts multipart/form-data with `image` file; returns Cloudinary url/publicId
 */
const uploadListingImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Image required' });

    const tempPath = path.join(TEMP_DIR, `${Date.now()}-${req.file.originalname}`);
    await fs.promises.writeFile(tempPath, req.file.buffer);
    try {
      const { url, publicId } = await uploadImage(tempPath, 'uniconnect/listings');
      res.json({ url, publicId });
    } finally {
      await fs.promises.unlink(tempPath);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @route DELETE /api/listings/:id
 */
const deleteListing = async (req, res, next) => {
  try {
    const listing = await Listing.findOneAndDelete({ _id: req.params.id, seller: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Not found' });
    await Offer.deleteMany({ listing: listing._id });

    const chats = await Chat.find({ listingRef: listing._id }, '_id');
    if (chats.length) {
      const chatIds = chats.map((chat) => chat._id);
      await Message.deleteMany({ chat: { $in: chatIds } });
      await Chat.deleteMany({ _id: { $in: chatIds } });
    }

    res.json({ message: 'Listing deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listListings,
  listMyListings,
  getListing,
  createListing,
  updateListing,
  uploadListingImage,
  deleteListing,
};
