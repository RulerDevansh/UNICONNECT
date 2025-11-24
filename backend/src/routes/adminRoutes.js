const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  getFlaggedListings,
  reviewListing,
  getReports,
  getMetrics,
} = require('../controllers/adminController');

router.use(auth(['admin']));
router.get('/flagged', getFlaggedListings);
router.post('/flagged/:id', reviewListing);
router.get('/reports', getReports);
router.get('/metrics', getMetrics);

module.exports = router;
