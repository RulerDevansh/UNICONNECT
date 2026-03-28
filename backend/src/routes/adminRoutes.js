const router = require('express').Router();
const { auth, authorizeCapabilities } = require('../middlewares/authMiddleware');
const {
  getFlaggedListings,
  getRentalDisputes,
  resolveRentalDispute,
  reviewListing,
  getAnalyticsOverview,
  getAnalyticsTrends,
  updateUserSuspension,
  getMetrics,
  sendUserWarning,
} = require('../controllers/adminController');
const { listUsers } = require('../controllers/userController');

router.use(auth());
router.get('/flagged', authorizeCapabilities(['listings.review']), getFlaggedListings);
router.get('/disputes', authorizeCapabilities(['admin-only']), getRentalDisputes);
router.post('/disputes/:id/resolve', authorizeCapabilities(['admin-only']), resolveRentalDispute);
router.post('/flagged/:id', authorizeCapabilities(['listings.review']), reviewListing);
router.get('/analytics/overview', authorizeCapabilities(['analytics.view']), getAnalyticsOverview);
router.get('/analytics/trends', authorizeCapabilities(['analytics.view']), getAnalyticsTrends);
router.get('/users', authorizeCapabilities(['admin-only']), listUsers);
router.patch('/users/:id/suspension', authorizeCapabilities(['admin-only']), updateUserSuspension);
router.post('/users/:id/warn', authorizeCapabilities(['admin-only']), sendUserWarning);
router.get('/metrics', authorizeCapabilities(['analytics.view']), getMetrics);

module.exports = router;
