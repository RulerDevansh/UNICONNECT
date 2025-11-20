const router = require('express').Router();
const { getProfile, updateProfile, listUsers, lookupUsers } = require('../controllers/userController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/me', auth(), getProfile);
router.put('/me', auth(), updateProfile);
router.get('/lookup', auth(), lookupUsers);
router.get('/', auth(['admin']), listUsers);

module.exports = router;
