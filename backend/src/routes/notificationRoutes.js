const express = require('express');
const Notification = require('../models/Notification');
const { auth } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @route GET /api/notifications
 * @desc Get user's notifications
 */
router.get('/', auth(), async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('shareRef', 'name shareType')
      .sort('-createdAt')
      .limit(50);
    
    res.json(notifications);
  } catch (err) {
    next(err);
  }
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get count of unread notifications
 */
router.get('/unread-count', auth(), async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user.id,
      read: false 
    });
    
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 */
router.put('/:id/read', auth(), async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

/**
 * @route PUT /api/notifications/mark-all-read
 * @desc Mark all notifications as read
 */
router.put('/mark-all-read', auth(), async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/notifications/clear-all
 * @desc Delete all notifications for user
 */
router.delete('/clear-all', auth(), async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user.id });
    res.json({ message: 'All notifications cleared' });
  } catch (err) {
    next(err);
  }
});

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a notification
 */
router.delete('/:id', auth(), async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
