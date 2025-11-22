const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  createTransaction,
  updateTransactionStatus,
  listTransactions,
  getPendingRequests,
  getMyRequests,
} = require('../controllers/transactionController');

router.post('/', auth(), createTransaction);
router.put('/:id', auth(), updateTransactionStatus);
router.get('/', auth(), listTransactions);
router.get('/requests', auth(), getPendingRequests);
router.get('/my-requests', auth(), getMyRequests);

module.exports = router;
