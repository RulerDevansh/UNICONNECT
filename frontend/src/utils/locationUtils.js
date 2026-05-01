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

/**
 * Calculate centroid of a list of coordinates
 * @param {Array} points - Array of { latitude, longitude } objects
 * @returns {Object} - { latitude, longitude } of centroid
 */
export const calculateCentroid = (points) => {
  if (!points || points.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  const sum = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + (p.latitude || 0),
      longitude: acc.longitude + (p.longitude || 0),
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
};

/**
 * Simple k-means clustering for geographical points
 * @param {Array} points - Array of { id, latitude, longitude, ...rest } objects
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations (default 10)
 * @returns {Array} - Array of clusters, each containing array of points
 */
export const kMeansClustering = (points, k = 3, maxIterations = 10) => {
  if (!points || points.length === 0 || k <= 0) {
    return [];
  }

  // Limit k to number of points
  const numClusters = Math.min(k, points.length);

  // Initialize centroids randomly from points
  const centroids = [];
  const indices = new Set();
  while (centroids.length < numClusters) {
    const idx = Math.floor(Math.random() * points.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      centroids.push({
        latitude: points[idx].latitude,
        longitude: points[idx].longitude,
      });
    }
  }

  let clusters = [];
  let previousCentroids = null;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Assign points to nearest centroid
    clusters = Array.from({ length: numClusters }, () => []);
    for (const point of points) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < centroids.length; i++) {
        const dist = haversineDistance(
          point.latitude,
          point.longitude,
          centroids[i].latitude,
          centroids[i].longitude
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      clusters[nearestIdx].push(point);
    }

    // Calculate new centroids
    const newCentroids = clusters.map((cluster) => calculateCentroid(cluster));

    // Check for convergence
    const converged = previousCentroids && previousCentroids.every((prev, idx) => {
      const dist = haversineDistance(
        prev.latitude,
        prev.longitude,
        newCentroids[idx].latitude,
        newCentroids[idx].longitude
      );
      return dist < 0.1; // Convergence threshold in km
    });

    centroids.splice(0, centroids.length, ...newCentroids);
    previousCentroids = JSON.parse(JSON.stringify(newCentroids));

    if (converged) break;
  }

  return clusters;
};
