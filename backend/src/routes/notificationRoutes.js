const express = require('express');
const { auth } = require('../middlewares/authMiddleware');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead,
  clearAll,
  deleteNotification,
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', auth(), getNotifications);
router.get('/unread-count', auth(), getUnreadCount);
router.put('/:id/read', auth(), markAsRead);
router.put('/mark-all-read', auth(), markAllRead);
router.delete('/clear-all', auth(), clearAll);
router.delete('/:id', auth(), deleteNotification);

module.exports = router;
