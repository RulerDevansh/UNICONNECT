const EARTH_RADIUS_KM = 6371;

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasCoordinates = (location = {}) => (
  toFiniteNumber(location.latitude) !== null
  && toFiniteNumber(location.longitude) !== null
);

const buildGeoPoint = (latitude, longitude) => {
  const lat = toFiniteNumber(latitude);
  const lon = toFiniteNumber(longitude);
  if (lat === null || lon === null) return undefined;

  return {
    type: 'Point',
    coordinates: [lon, lat],
  };
};

const normalizeLocationGeo = (location = {}) => {
  const point = buildGeoPoint(location.latitude, location.longitude);
  if (!point) return location;

  return {
    ...location,
    geo: point,
  };
};

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const startLat = toFiniteNumber(lat1);
  const startLon = toFiniteNumber(lon1);
  const endLat = toFiniteNumber(lat2);
  const endLon = toFiniteNumber(lon2);
  if ([startLat, startLon, endLat, endLon].some((value) => value === null)) {
    return null;
  }

  const dLat = (endLat - startLat) * (Math.PI / 180);
  const dLon = (endLon - startLon) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(startLat * (Math.PI / 180))
      * Math.cos(endLat * (Math.PI / 180))
      * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const roundDistanceKm = (distanceKm) => {
  const distance = toFiniteNumber(distanceKm);
  if (distance === null) return null;
  return Math.round(distance * 100) / 100;
};

const getBoundingBox = ({ latitude, longitude, radiusKm }) => {
  const lat = toFiniteNumber(latitude);
  const lon = toFiniteNumber(longitude);
  const radius = toFiniteNumber(radiusKm);
  if (lat === null || lon === null || radius === null || radius <= 0) return null;

  const latDelta = radius / 111.32;
  const cosLat = Math.max(Math.abs(Math.cos(lat * (Math.PI / 180))), 0.000001);
  const lonDelta = radius / (111.32 * cosLat);

  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLon: Math.max(-180, lon - Math.abs(lonDelta)),
    maxLon: Math.min(180, lon + Math.abs(lonDelta)),
  };
};

module.exports = {
  EARTH_RADIUS_KM,
  toFiniteNumber,
  hasCoordinates,
  buildGeoPoint,
  normalizeLocationGeo,
  haversineDistanceKm,
  roundDistanceKm,
  getBoundingBox,
};
