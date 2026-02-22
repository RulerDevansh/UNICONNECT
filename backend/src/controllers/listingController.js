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
const { getIO } = require('../services/socketService');

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
      .populate('seller', 'name email')
      .populate('auction.winner', 'name email');
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
      
      // For auction listings, set price to startBid
      listingData.price = Number(req.body.auction.startBid);

      // Validate auction dates
      if (listingData.auction.endTime <= new Date()) {
        return res.status(422).json({ message: 'End auction time must be in the future' });
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
    
    // Parse JSON strings from FormData (when image uploads are included)
    if (updates.auction && typeof updates.auction === 'string') {
      try {
        updates.auction = JSON.parse(updates.auction);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid auction data format' });
      }
    }
    
    if (updates.tags) {
      updates.tags = Array.isArray(updates.tags)
        ? updates.tags
        : updates.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    
    // Handle new image uploads from req.files
    if (req.files && req.files.length > 0) {
      // Delete all old images from Cloudinary
      for (const oldImage of listing.images) {
        try {
          await deleteImage(oldImage.publicId);
        } catch (_err) {
          // best-effort cleanup
        }
      }
      
      // Upload new images
      const newImages = [];
      for (const file of req.files) {
        const tempPath = path.join(TEMP_DIR, `${Date.now()}-${file.originalname}`);
        try {
          await fs.promises.writeFile(tempPath, file.buffer);
          const { url, publicId } = await uploadImage(tempPath, 'uniconnect/listings');
          newImages.push({ url, publicId });
        } finally {
          try {
            await fs.promises.unlink(tempPath);
          } catch (_err) {
            // best-effort cleanup
          }
        }
      }
      
      // Check for alcohol in primary image (first image)
      if (newImages.length > 0 && newImages[0]?.url) {
        const alcoholResult = await applyAlcoholScan({
          listing,
          sellerId: req.user.id,
          imageUrl: newImages[0].url,
        });
        
        if (alcoholResult?.blocked) {
          // Delete the newly uploaded images since they're blocked
          for (const img of newImages) {
            try {
              await deleteImage(img.publicId);
            } catch (_err) {
              // best-effort cleanup
            }
          }
          
          return res.status(400).json({
            message: BEER_BLOCK_MESSAGE,
            reason: 'beer_bottle_detected',
            details: {
              predicted_label: alcoholResult.predicted_label,
              confidence: alcoholResult.confidence,
            },
          });
        }
      }
      
      // Update listing images
      listing.images = newImages;
      delete updates.images; // Remove from updates to avoid overwriting
    } else if (updates.images && Array.isArray(updates.images)) {
      // Handle image updates from request body (URLs provided)
      const oldPublicIds = listing.images
        .filter(img => !updates.images.some(newImg => newImg.publicId === img.publicId))
        .map(img => img.publicId);
      
      // Delete old images from Cloudinary
      for (const publicId of oldPublicIds) {
        try {
          await deleteImage(publicId);
        } catch (_err) {
          // best-effort cleanup
        }
      }
      
      // Check for alcohol in primary image (first image)
      if (updates.images.length > 0 && updates.images[0]?.url) {
        const primaryImageUrl = updates.images[0].url;
        const alcoholResult = await applyAlcoholScan({
          listing,
          sellerId: req.user.id,
          imageUrl: primaryImageUrl,
        });
        
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
      }
    }
    
    // For auction listings, preserve existing bids and update only allowed fields
    if (updates.listingType === 'auction' && updates.auction) {
      const newStartBid = Number(updates.auction.startBid);
      const newEndTime = updates.auction.endTime ? new Date(updates.auction.endTime) : null;
      
      // Update only the editable auction fields, preserve the rest
      if (listing.auction) {
        const currentBidAmount = listing.auction.currentBid?.amount || 0;
        const hasBids = currentBidAmount > 0 || (listing.auction.bidders && listing.auction.bidders.length > 0);
        
        // If there are active bids, restrict what can be updated
        if (hasBids) {
          // Cannot change startBid if bids exist
          if (newStartBid !== listing.auction.startBid) {
            return res.status(422).json({ 
              message: 'Cannot change starting bid after bids have been placed' 
            });
          }
          
          // Can only extend end time, not shorten it
          if (newEndTime && newEndTime < listing.auction.endTime) {
            return res.status(422).json({ 
              message: 'Cannot shorten auction end time after bids have been placed. You can only extend it.' 
            });
          }
        }
        
        // Validate: endTime cannot be in the past
        if (newEndTime && newEndTime <= new Date()) {
          return res.status(422).json({ 
            message: 'End time must be in the future' 
          });
        }
        
        listing.auction.isAuction = true;
        listing.auction.startBid = newStartBid;
        if (newEndTime) {
          listing.auction.endTime = newEndTime;
        }
        // Keep existing: currentBid, bidders, highestBidPerUser, winner, status
      } else {
        // New auction listing - validate endTime
        if (newEndTime && newEndTime <= new Date()) {
          return res.status(422).json({ 
            message: 'End time must be in the future' 
          });
        }
        
        listing.auction = {
          isAuction: true,
          startBid: newStartBid,
          endTime: newEndTime,
          status: 'active',
          bidders: [],
          highestBidPerUser: new Map(),
        };
      }
      updates.price = newStartBid;
      // Remove auction from updates to avoid overwriting
      delete updates.auction;
    }
    
    // Capture before Object.assign overwrites listing.status
    const statusChangedToSold = updates.status === 'sold' && listing.status !== 'sold';

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
    await listing.save();
    if (statusChangedToSold) {
      const chats = await Chat.find({ listingRef: listing._id }, '_id');
      if (chats.length) {
        const chatIds = chats.map((chat) => chat._id);
        await Message.deleteMany({ chat: { $in: chatIds } });
        await Chat.deleteMany({ _id: { $in: chatIds } });
      }
    }
    
    // Notify auction room of updates
    if (listing.listingType === 'auction') {
      const io = getIO();
      if (io) {
        const highestMap = listing.auction?.highestBidPerUser;
        let highestObj = {};
        if (highestMap && typeof highestMap.forEach === 'function') {
          highestMap.forEach((val, key) => { highestObj[key] = val; });
        }
        io.to(`auction:${listing._id}`).emit('auction:update', {
          listingId: listing._id.toString(),
          currentBid: listing.auction?.currentBid || null,
          highestBidPerUser: highestObj,
        });
        // Emit listing refresh event to all viewers
        io.to(`listing:${listing._id}`).emit('listing:refresh', {
          listingId: listing._id.toString(),
        });
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
        deleteImage(publicId).catch(() => { /* best-effort */ })
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
