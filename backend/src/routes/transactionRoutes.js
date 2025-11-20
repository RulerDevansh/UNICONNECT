const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  createTransaction,
  updateTransactionStatus,
  listTransactions,
} = require('../controllers/transactionController');

router.post('/', auth(), createTransaction);
router.put('/:id', auth(), updateTransactionStatus);
router.get('/', auth(), listTransactions);

module.exports = router;
