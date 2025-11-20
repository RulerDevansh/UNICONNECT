const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const { createReport } = require('../controllers/reportController');

router.post('/', auth(), createReport);

module.exports = router;
