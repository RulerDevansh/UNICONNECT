const router = require('express').Router();
const { auth } = require('../middlewares/authMiddleware');
const {
  listShares,
  getShare,
  createShare,
  requestJoin,
  approveMember,
  finalizeShare,
} = require('../controllers/shareController');

router.use(auth());
router.get('/', listShares);
router.get('/:id', getShare);
router.post('/', createShare);
router.post('/:id/join', requestJoin);
router.post('/:id/approve', approveMember);
router.post('/:id/finalize', finalizeShare);

module.exports = router;
