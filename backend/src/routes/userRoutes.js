const router = require('express').Router();
const { getProfile, updateProfile, changePassword, listUsers, lookupUsers, getUserHistory } = require('../controllers/userController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/me', auth(), getProfile);
router.put('/me', auth(), updateProfile);
router.put('/me/password', auth(), changePassword);
router.get('/me/history', auth(), getUserHistory);
router.get('/lookup', auth(), lookupUsers);
router.get('/', auth(['admin']), listUsers);

module.exports = router;
