const User = require('../models/User');
const Listing = require('../models/Listing');
const Share = require('../models/Share');

/**
 * Update user's location
 */
const normalizeLocationPayload = ({ latitude, longitude, address, accuracy, source }) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    latitude: lat,
    longitude: lon,
    address: address || '',
    accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : undefined,
    source: source === 'browser' ? 'browser' : 'manual',
    updatedAt: new Date(),
  };
};

const updateUserLocation = async (userId, payload) => {
  const location = normalizeLocationPayload(payload || {});
  if (!userId || !location) {
    return null;
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { location },
      { new: true }
    ).lean();

    return user?.location || null;
  } catch (err) {
    console.error('Error updating user location:', err);
    return null;
  }
};

/**
 * Update listing's location
 */
const updateListingLocation = async (listingId, payload) => {
  const location = normalizeLocationPayload(payload || {});
  if (!listingId || !location) {
    return null;
  }

  try {
    const listing = await Listing.findByIdAndUpdate(
      listingId,
      { location },
      { new: true }
    ).lean();

    return listing?.location || null;
  } catch (err) {
    console.error('Error updating listing location:', err);
    return null;
  }
};

/**
 * Update share's location
 */
const updateShareLocation = async (shareId, payload) => {
  const location = normalizeLocationPayload(payload || {});
  if (!shareId || !location) {
    return null;
  }

  try {
    const share = await Share.findByIdAndUpdate(
      shareId,
      { location },
      { new: true }
    ).lean();

    return share?.location || null;
  } catch (err) {
    console.error('Error updating share location:', err);
    return null;
  }
};

module.exports = {
  updateUserLocation,
  updateListingLocation,
  updateShareLocation,
};
