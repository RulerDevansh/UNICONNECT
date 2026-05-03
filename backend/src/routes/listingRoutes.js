const router = require('express').Router();
const multer = require('multer');
const { auth, optionalAuth } = require('../middlewares/authMiddleware');
const { handleValidation } = require('../middlewares/validateMiddleware');
const { listingValidationRules } = require('../utils/validators');
const {
  listMyListings,
  listListings,
  getListing,
  createListing,
  updateListing,
  uploadListingImage,
  deleteListing,
  requestListingReview,
} = require('../controllers/listingController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
});

router.get('/', listListings);
router.get('/me', auth(), listMyListings);
router.get('/:id', optionalAuth(), getListing);
router.post('/', auth(), listingValidationRules(), handleValidation, createListing);
router.put('/:id', auth(), upload.array('images', 5), updateListing);
router.delete('/:id', auth(), deleteListing);
router.post('/:id/images', auth(), upload.single('image'), uploadListingImage);
router.post('/:id/review', auth(), requestListingReview);

module.exports = router;
