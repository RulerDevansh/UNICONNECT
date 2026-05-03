const User = require('../models/User');
const Listing = require('../models/Listing');
const Share = require('../models/Share');
const {
  buildGeoPoint,
  getBoundingBox,
  hasCoordinates,
  haversineDistanceKm,
  roundDistanceKm,
} = require('../utils/geo');

const DEFAULT_MAX_DISTANCE_KM = 10;
const MAX_DISTANCE_KM = 10;

const clampDistance = (distanceKm) => {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance <= 0) return DEFAULT_MAX_DISTANCE_KM;
  return Math.min(distance, MAX_DISTANCE_KM);
};

const addById = (map, docs = []) => {
  docs.forEach((doc) => {
    if (doc?._id) map.set(String(doc._id), doc);
  });
};

const withDistance = ({ docs, userLocation, maxDistanceKm, limit, filter = () => true }) => {
  const userLat = Number(userLocation.latitude);
  const userLon = Number(userLocation.longitude);

  return docs
    .filter(filter)
    .map((doc) => {
      const distance = haversineDistanceKm(
        userLat,
        userLon,
        doc.location?.latitude,
        doc.location?.longitude
      );
      return {
        ...doc,
        distance_km: roundDistanceKm(distance),
      };
    })
    .filter((doc) => doc.distance_km !== null && doc.distance_km <= maxDistanceKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
};

const findNearbyDocuments = async ({
  Model,
  baseQuery,
  select,
  populate = [],
  userLocation,
  maxDistanceKm,
  limit,
  filter,
}) => {
  const geoPoint = buildGeoPoint(userLocation.latitude, userLocation.longitude);
  const candidateLimit = Math.max(limit * 12, 100);
  const docsById = new Map();
  const runQuery = (query) => {
    let cursor = Model.find(query).select(select);
    populate.forEach((entry) => {
      cursor = cursor.populate(entry);
    });
    return cursor.limit(candidateLimit).lean();
  };

  if (geoPoint) {
    try {
      const geoDocs = await runQuery({
        ...baseQuery,
        'location.geo': {
          $nearSphere: {
            $geometry: geoPoint,
            $maxDistance: maxDistanceKm * 1000,
          },
        },
      });
      addById(docsById, geoDocs);
    } catch {
      // If the 2dsphere index is still building in a local/dev DB, the
      // bounded lat/lon query below keeps nearby results available.
    }
  }

  const bounds = getBoundingBox({
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
    radiusKm: maxDistanceKm,
  });

  if (bounds) {
    const boundedDocs = await runQuery({
      ...baseQuery,
      'location.latitude': { $gte: bounds.minLat, $lte: bounds.maxLat },
      'location.longitude': { $gte: bounds.minLon, $lte: bounds.maxLon },
    });
    addById(docsById, boundedDocs);
  }

  return withDistance({
    docs: Array.from(docsById.values()),
    userLocation,
    maxDistanceKm,
    limit,
    filter,
  });
};

/**
 * Get nearby products and shares using indexed geo queries plus Haversine
 * distance. No ML clustering is used for this path.
 */
const getLocationBasedRecommendations = async ({
  userId,
  maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
  limit = 5,
}) => {
  try {
    const user = await User.findById(userId).select('location collegeDomain').lean();
    if (!user || !hasCoordinates(user.location)) {
      return { listings: [], shares: [] };
    }

    const maxDistance = clampDistance(maxDistanceKm);
    const resultLimit = Math.min(Number(limit) || 5, 20);
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

    const [listings, shares] = await Promise.all([
      findNearbyDocuments({
        Model: Listing,
        baseQuery: {
          collegeDomain: user.collegeDomain,
          status: 'active',
        },
        select: 'title description price category condition listingType auction rental images seller status location',
        userLocation: user.location,
        maxDistanceKm: maxDistance,
        limit: resultLimit,
      }),
      findNearbyDocuments({
        Model: Share,
        baseQuery: {
          collegeDomain: user.collegeDomain,
          status: 'open',
        },
        select: '_id name description shareType totalAmount splitType host location fromCity toCity departureTime arrivalTime bookingDeadline maxPassengers vehicleType foodItems quantity minPersons maxPersons deadlineTime category otherMinPersons otherMaxPersons otherDeadline members pendingRequests rejectedRequests status createdAt',
        populate: [
          { path: 'members.user', select: 'name email' },
          { path: 'pendingRequests', select: 'name email' },
          { path: 'rejectedRequests.user', select: 'name email' },
          { path: 'host', select: 'name email' },
        ],
        userLocation: user.location,
        maxDistanceKm: maxDistance,
        limit: resultLimit,
        filter: isShareActive,
      }),
    ]);

    return { listings, shares };
  } catch (err) {
    // Log error but don't throw - graceful degradation for the Home page.
    console.error('Error getting location-based recommendations:', err.message);
    return { listings: [], shares: [] };
  }
};

module.exports = {
  getLocationBasedRecommendations,
};
