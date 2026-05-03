/**
 * Calculate distance between two geographic coordinates using the Haversine formula
 * Returns distance in kilometers
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in kilometers
 */
export const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const hasCoordinates = (location) => (
  Number.isFinite(Number(location?.latitude)) && Number.isFinite(Number(location?.longitude))
);

export const getDistanceKm = (fromLocation, toLocation) => {
  if (!hasCoordinates(fromLocation) || !hasCoordinates(toLocation)) return null;

  return haversineDistance(
    Number(fromLocation.latitude),
    Number(fromLocation.longitude),
    Number(toLocation.latitude),
    Number(toLocation.longitude)
  );
};

export const formatDistanceKm = (distanceKm) => {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return null;
  return `${distanceKm.toFixed(1)} km away`;
};
