const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const { proxyRecommendations } = require('../services/moderationService');

router.post('/recommendations', auth(), async (req, res, next) => {
  try {
    const data = await proxyRecommendations(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
