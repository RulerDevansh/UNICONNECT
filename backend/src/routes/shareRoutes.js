const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  listShares,
  getShare,
  createShare,
  requestJoin,
  cancelRequest,
  approveMember,
  finalizeShare,
  updateShare,
  deleteShare,
} = require('../controllers/shareController');

router.use(auth());
router.get('/', listShares);
router.get('/:id', getShare);
router.post('/', createShare);
router.post('/:id/join', requestJoin);
router.post('/:id/cancel', cancelRequest);
router.post('/:id/approve', approveMember);
router.post('/:id/finalize', finalizeShare);
router.put('/:id', updateShare);
router.delete('/:id', deleteShare);

module.exports = router;
