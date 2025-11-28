const express = require('express');
const { auth } = require('../middlewares/authMiddleware');
const { placeBid, getBiddingStatus } = require('../controllers/biddingController');

const router = express.Router();

router.get('/:listingId', auth(), getBiddingStatus);
router.post('/:listingId/bids', auth(), placeBid);

module.exports = router;
