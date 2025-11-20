const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const { listChats, getMessages, createChat } = require('../controllers/chatController');

router.use(auth());
router.get('/', listChats);
router.get('/:id/messages', getMessages);
router.post('/', createChat);

module.exports = router;
