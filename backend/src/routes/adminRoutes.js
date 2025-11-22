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

// Manual trigger for auction cleanup (for testing)
router.post('/cleanup-auctions', async (req, res) => {
  try {
    const Listing = require('../models/Listing');
    const now = new Date();
    const expiredListings = await Listing.find({
      $or: [
        { 'auction.isAuction': true },
        { listingType: 'auction', status: 'active' }
      ],
      'auction.endTime': { $lte: now }
    });
    
    const deleted = [];
    const ended = [];
    
    for (const listing of expiredListings) {
      const hasBids = listing.auction.bidders && listing.auction.bidders.length > 0;
      if (!hasBids) {
        await Listing.findByIdAndDelete(listing._id);
        deleted.push(listing._id);
      } else {
        listing.auction.isAuction = false;
        await listing.save();
        ended.push(listing._id);
      }
    }
    
    res.json({ 
      message: 'Cleanup completed',
      deleted: deleted.length,
      ended: ended.length,
      deletedIds: deleted,
      endedIds: ended
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
