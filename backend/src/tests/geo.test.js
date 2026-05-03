const {
  buildGeoPoint,
  getBoundingBox,
  haversineDistanceKm,
  roundDistanceKm,
} = require('../utils/geo');

describe('geo utilities', () => {
  it('builds GeoJSON points as longitude-latitude for MongoDB', () => {
    expect(buildGeoPoint(18.6298, 73.7997)).toEqual({
      type: 'Point',
      coordinates: [73.7997, 18.6298],
    });
  });

  it('calculates haversine distance in kilometers', () => {
    const distance = haversineDistanceKm(18.6298, 73.7997, 18.6414, 73.8217);
    expect(roundDistanceKm(distance)).toBeCloseTo(2.66, 1);
  });

  it('creates a bounded search box around a coordinate', () => {
    const box = getBoundingBox({ latitude: 18.6298, longitude: 73.7997, radiusKm: 10 });
    expect(box.minLat).toBeLessThan(18.6298);
    expect(box.maxLat).toBeGreaterThan(18.6298);
    expect(box.minLon).toBeLessThan(73.7997);
    expect(box.maxLon).toBeGreaterThan(73.7997);
  });
});
