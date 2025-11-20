const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  createOffer,
  updateOfferStatus,
  listOffersForListing,
} = require('../controllers/offerController');

router.post('/', auth(), createOffer);
router.put('/:id', auth(), updateOfferStatus);
router.get('/listing/:listingId', auth(), listOffersForListing);

module.exports = router;
