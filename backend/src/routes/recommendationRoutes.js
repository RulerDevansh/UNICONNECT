const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const { getLocationBasedRecommendations } = require('../services/locationRecommendationService');

/**
 * GET /api/recommendations/nearby
 * Get nearby listings and shares based on user location
 */
router.get('/nearby', auth(), async (req, res, next) => {
  try {
    const { maxDistanceKm = 10, limit = 5 } = req.query;
    
    const recommendations = await getLocationBasedRecommendations({
      userId: req.user.id,
      maxDistanceKm: Math.min(Number(maxDistanceKm) || 10, 10),
      limit: Math.min(Number(limit) || 5, 20),
    });

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
