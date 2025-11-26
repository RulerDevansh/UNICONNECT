const fs = require('fs');
const path = require('path');
const Listing = require('../models/Listing');
const Offer = require('../models/Offer');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Report = require('../models/Report');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { paginate } = require('../utils/pagination');
const { validateListingFilters } = require('../utils/validators');
const { callModeration, checkAlcoholImage } = require('../services/moderationService');

const TEMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const BEER_BLOCK_MESSAGE = 'Your listing appears to contain an abusive product and cannot be posted. If you think this is an error, request review.';
const TEXT_BLOCK_MESSAGE = 'Your listing appears to contain blocked keywords and cannot be posted. If you think this is an error, request review.';

const ensureBeerBottleReport = async (listingId, reporterId) => {
  const existing = await Report.findOne({ listing: listingId, reason: 'beer_bottle_detected', status: 'open' }).lean();
  if (existing) return existing;
  return Report.create({
    reporter: reporterId,
    listing: listingId,
    reason: 'beer_bottle_detected',
    message: 'Automated moderation: beer bottle detected by ML.',
  });
};

const applyAlcoholScan = async ({ listing, sellerId, imageUrl }) => {
  if (!imageUrl) return null;
  const detection = await checkAlcoholImage(imageUrl);
  if (!detection) return null;

  listing.mlConfidence = detection.confidence ?? listing.mlConfidence;
  listing.mlPredictionLabel = detection.predicted_label || listing.mlPredictionLabel;
  listing.mlFlag = Boolean(detection.blocked || detection.flagged || detection.needs_review);
  listing.mlNeedsReview = Boolean(detection.needs_review);

  if (detection.blocked) {
    const alreadyBlocked = listing.status === 'blocked';
    listing.status = 'blocked';
    await ensureBeerBottleReport(listing._id, sellerId);
    if (!alreadyBlocked) {
      if (!listing.moderation) listing.moderation = {};
      listing.moderation.flagged = true;
      listing.moderation.reason = 'beer_bottle_detected';
    }
  }
  return detection;
};

const buildQuery = (query) => {
  const filters = validateListingFilters(query);
  const mongoQuery = { status: { $nin: ['archived', 'sold', 'blocked'] } };
  if (filters.collegeDomain) mongoQuery.collegeDomain = filters.collegeDomain;
  if (filters.category) mongoQuery.category = filters.category;
  if (filters.condition) mongoQuery.condition = filters.condition;
  if (filters.q) {
    // Use regex search instead of text index for better compatibility
    mongoQuery.$or = [
      { title: { $regex: filters.q, $options: 'i' } },
      { description: { $regex: filters.q, $options: 'i' } },
      { tags: { $regex: filters.q, $options: 'i' } }
    ];
  }
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
    // Exclude sold and archived listings from My Listings view
    const listings = await Listing.find({ 
      seller: req.user.id,
      status: { $nin: ['sold', 'archived'] }
    }).sort('-createdAt');
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
    const listing = await Listing.findById(req.params.id)
      .populate('seller', 'name email');
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    
    res.json(listing);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/listings
 * @body {title, description, price, category, listingType, tags[]}
 * @returns {Listing}
 */
const createListing = async (req, res, next) => {
  try {

    const normalizedTags = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tags === 'string'
        ? req.body.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [];

    const listingData = {
      ...req.body,
      seller: req.user.id,
      collegeDomain: req.user.collegeDomain,
      tags: normalizedTags,
      listingType: req.body.listingType || 'buy-now',
    };

    // Handle auction data
    if (req.body.listingType === 'auction' && req.body.auction) {
      listingData.auction = {
        isAuction: true,
        startBid: Number(req.body.auction.startBid),
        endTime: new Date(req.body.auction.endTime),
        status: 'active',
        bidders: [],
        highestBidPerUser: new Map(),
      };

      // Validate auction dates
      if (listingData.auction.endTime <= new Date()) {
        return res.status(422).json({ message: 'Auction end time must be in the future' });
      }
    }

    const listing = await Listing.create(listingData);

    const primaryImageUrl = listing.images?.[0]?.url || req.body.primaryImageUrl || req.body.imageUrl;
    const alcoholResult = await applyAlcoholScan({ listing, sellerId: req.user.id, imageUrl: primaryImageUrl });
    const blockedByAlcohol = Boolean(alcoholResult?.blocked);

    const moderation = await callModeration({
      text: `${listing.title} ${listing.description}`,
      metadata: { listingId: listing._id },
    });
    if (blockedByAlcohol) {
      listing.moderation = {
        ...moderation,
        flagged: true,
        reason: 'beer_bottle_detected',
      };
    } else {
      listing.moderation = moderation;
    }
    const textBlocked = !blockedByAlcohol && Boolean(moderation.flagged);
    if (textBlocked) {
      listing.status = 'blocked';
    }
    await listing.save();

    if (alcoholResult?.blocked) {
      return res.status(400).json({
        message: BEER_BLOCK_MESSAGE,
        reason: 'beer_bottle_detected',
        details: {
          predicted_label: alcoholResult.predicted_label,
          confidence: alcoholResult.confidence,
        },
      });
    }

    if (textBlocked) {
      return res.status(400).json({
        message: TEXT_BLOCK_MESSAGE,
        reason: listing.moderation?.reason || 'text_flagged',
      });
    }

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
    listing.moderation = await callModeration({
      text: `${listing.title} ${listing.description}`,
      metadata: { listingId: listing._id },
    });
    const textBlocked = Boolean(listing.moderation.flagged);
    if (textBlocked) {
      listing.status = 'blocked';
    } else if (listing.status === 'blocked') {
      listing.status = 'active';
    }

    // If status is being set to 'sold', delete related chats/messages
    const statusChangedToSold = updates.status === 'sold' && listing.status !== 'sold';
    await listing.save();
    if (statusChangedToSold) {
      const chats = await Chat.find({ listingRef: listing._id }, '_id');
      if (chats.length) {
        const chatIds = chats.map((chat) => chat._id);
        await Message.deleteMany({ chat: { $in: chatIds } });
        await Chat.deleteMany({ _id: { $in: chatIds } });
      }
    }
    if (textBlocked) {
      return res.status(400).json({
        message: TEXT_BLOCK_MESSAGE,
        reason: listing.moderation?.reason || 'text_flagged',
      });
    }

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
    const listing = await Listing.findOne({ _id: req.params.id, seller: req.user.id });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const tempPath = path.join(TEMP_DIR, `${Date.now()}-${req.file.originalname}`);
    await fs.promises.writeFile(tempPath, req.file.buffer);
    try {
      const { url, publicId } = await uploadImage(tempPath, 'uniconnect/listings');
      const isPrimaryUpload = listing.images.length === 0;
      listing.images.push({ url, publicId });

      let alcoholResult = null;
      if (isPrimaryUpload && listing.images[0]?.url) {
        alcoholResult = await applyAlcoholScan({
          listing,
          sellerId: req.user.id,
          imageUrl: listing.images[0].url,
        });
      }

      await listing.save();

      if (alcoholResult?.blocked) {
        return res.status(400).json({
          message: BEER_BLOCK_MESSAGE,
          reason: 'beer_bottle_detected',
          details: {
            predicted_label: alcoholResult.predicted_label,
            confidence: alcoholResult.confidence,
          },
        });
      }

      res.json({ url, publicId, images: listing.images });
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

    const publicIds = (listing.images || [])
      .map((img) => img?.publicId)
      .filter(Boolean);
    await Promise.all(
      publicIds.map((publicId) =>
        deleteImage(publicId).catch((err) => {
          console.warn('Failed to delete Cloudinary image', publicId, err.message);
        })
      )
    );

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
