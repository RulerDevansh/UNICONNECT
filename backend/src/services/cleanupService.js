const cron = require('node-cron');
const Share = require('../models/Share');
const Chat = require('../models/Chat');

/**
 * Cleanup old completed cab sharing trips (30+ days after departure)
 * Runs every hour to check and delete old trips
 * 
 * Behavior:
 * - When user cancels: Trip data is preserved, only member is removed
 * - After departure time: Trip history remains visible for 30 days
 * - After 30 days: Trip and chat data are permanently deleted
 * 
 * This allows users to:
 * 1. View trip details even after cancellation (until departure)
 * 2. Access trip history for 30 days after completion
 * 3. Keep chat history for post-trip communication
 */
const startCleanupService = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      // Find cab shares where departure time was more than 30 days ago
      const oldShares = await Share.find({
        shareType: 'cab',
        departureTime: { $lt: thirtyDaysAgo }
      });

      if (oldShares.length > 0) {
        const shareIds = oldShares.map(share => share._id);
        
        // Delete associated chats (including cancelled member conversations)
        await Chat.deleteMany({ shareRef: { $in: shareIds } });
        
        // Delete old shares (including those with cancelled members)
        const result = await Share.deleteMany({
          _id: { $in: shareIds }
        });

        console.log(`Cleanup: Deleted ${result.deletedCount} old cab sharing trips (30+ days after departure)`);
      }
    } catch (error) {
      console.error('Cleanup service error:', error);
    }
  });

  console.log('Cleanup service started - runs every hour to clean up trips 30+ days after departure');
};

module.exports = { startCleanupService };
