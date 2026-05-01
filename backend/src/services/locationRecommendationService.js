const axios = require('axios');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Share = require('../models/Share');

/**
 * Get location-based recommendations from ML service
 * Returns nearby listings and shares sorted by distance
 */
const getLocationBasedRecommendations = async ({
  userId,
  maxDistanceKm = 10,
  limit = 5,
}) => {
  try {
    const mlServiceUrl = process.env.ML_SERVICE_URL;
    if (!mlServiceUrl) {
      // ML service unavailable - return empty (graceful degradation)
      return { listings: [], shares: [] };
    }

    // Get user location
    const user = await User.findById(userId).select('location collegeDomain').lean();
    if (!user || !user.location || user.location.latitude == null || user.location.longitude == null) {
      return { listings: [], shares: [] };
    }

    const now = new Date();

    const isShareActive = (share) => {
      const joinedMembersCount = share.members?.filter((member) => member.status === 'joined').length || 0;

      if (share.shareType === 'cab') {
        if (share.bookingDeadline && new Date(share.bookingDeadline) < now) return false;
        if (share.maxPassengers && joinedMembersCount >= share.maxPassengers) return false;
      }

      if (share.shareType === 'food') {
        if (share.deadlineTime && new Date(share.deadlineTime) < now) return false;
        if (share.maxPersons && joinedMembersCount >= share.maxPersons) return false;
      }

      if (share.shareType === 'other') {
        if (share.otherDeadline && new Date(share.otherDeadline) < now) return false;
        if (share.otherMaxPersons && joinedMembersCount >= share.otherMaxPersons) return false;
      }

      return true;
    };

    // Get all active listings and shares for user's college domain
    const [allListings, allShares] = await Promise.all([
      Listing.find({
        collegeDomain: user.collegeDomain,
        status: { $nin: ['archived', 'sold', 'blocked', 'flagged'] },
        'location.latitude': { $exists: true, $ne: null },
        'location.longitude': { $exists: true, $ne: null },
      })
        .select('_id title price category condition location images')
        .lean(),
      Share.find({
        collegeDomain: user.collegeDomain,
        status: 'open',
        'location.latitude': { $exists: true, $ne: null },
        'location.longitude': { $exists: true, $ne: null },
      })
        .select('_id name shareType totalAmount location bookingDeadline deadlineTime otherDeadline maxPassengers maxPersons otherMaxPersons members')
        .lean(),
    ]);

    const filteredShares = allShares.filter(isShareActive);

    // Call ML service for location-based recommendations
    const { data } = await axios.post(
      `${mlServiceUrl}/predict/location-based-recommendations`,
      {
        user_location: {
          latitude: user.location.latitude,
          longitude: user.location.longitude,
          address: user.location.address || '',
        },
        listings: allListings,
        shares: filteredShares,
        max_distance_km: maxDistanceKm,
        limit,
      },
      { timeout: 10000 }
    );

    // Build id lists + distance maps from ML response
    const listingIds = [];
    const shareIds = [];
    const distanceById = new Map();

    for (const item of data) {
      if (item?.id) {
        distanceById.set(String(item.id), item.distance_km);
      }
      if (item?.type === 'listing' && item?.id) {
        listingIds.push(String(item.id));
      }
      if (item?.type === 'share' && item?.id) {
        shareIds.push(String(item.id));
      }
    }

    const [listingDocs, shareDocs] = await Promise.all([
      listingIds.length
        ? Listing.find({ _id: { $in: listingIds } })
            .select('title description price category condition listingType auction rental images seller status')
            .lean()
        : [],
      shareIds.length
        ? Share.find({ _id: { $in: shareIds } })
            .populate('members.user', 'name email')
            .populate('pendingRequests', 'name email')
            .populate('rejectedRequests.user', 'name email')
            .populate('host', 'name email')
            .lean()
        : [],
    ]);

    const listingById = new Map(listingDocs.map((doc) => [String(doc._id), doc]));
    const shareById = new Map(shareDocs.map((doc) => [String(doc._id), doc]));

    const listings = listingIds
      .map((id) => {
        const doc = listingById.get(id);
        if (!doc) return null;
        return {
          ...doc,
          distance_km: distanceById.get(id),
        };
      })
      .filter(Boolean);

    const shares = shareIds
      .map((id) => {
        const doc = shareById.get(id);
        if (!doc) return null;
        return {
          ...doc,
          distance_km: distanceById.get(id),
        };
      })
      .filter(Boolean);

    return { listings, shares };
  } catch (err) {
    // Log error but don't throw - graceful degradation
    console.error('Error getting location-based recommendations:', err.message);
    return { listings: [], shares: [] };
  }
};

module.exports = {
  getLocationBasedRecommendations,
};
