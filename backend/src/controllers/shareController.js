const Share = require('../models/Share');
const Chat = require('../models/Chat');
const { calculateSplit } = require('../utils/splitCalculator');

/**
 * @route POST /api/shares
 * @body { name, description, totalAmount, splitType }
 */
/**
 * @route GET /api/shares
 */
const listShares = async (req, res, next) => {
  try {
    const shares = await Share.find({ collegeDomain: req.user.collegeDomain })
      .populate('members.user', 'name email')
      .populate('pendingRequests', 'name email')
      .populate('host', 'name email')
      .sort('-createdAt');
    res.json(shares);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/shares/:id
 */
const getShare = async (req, res, next) => {
  try {
    const share = await Share.findById(req.params.id).populate('members.user', 'name email');
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.collegeDomain !== req.user.collegeDomain) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(share);
  } catch (err) {
    next(err);
  }
};

const createShare = async (req, res, next) => {
  try {
    if (Number(req.body.totalAmount) <= 0) {
      return res.status(422).json({ message: 'totalAmount must be positive' });
    }

    const share = await Share.create({
      ...req.body,
      host: req.user.id,
      collegeDomain: req.user.collegeDomain,
      members: [{ user: req.user.id, status: 'joined' }],
    });
    await Chat.create({
      participants: [req.user.id],
      isGroup: true,
      shareRef: share._id,
    });
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/join
 */
const requestJoin = async (req, res, next) => {
  try {
    const share = await Share.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.collegeDomain !== req.user.collegeDomain) {
      return res.status(403).json({ message: 'College domain mismatch' });
    }
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share closed' });
    }
    if (share.members.some((member) => member.user.toString() === req.user.id)) {
      return res.status(400).json({ message: 'Already a member' });
    }
    if (share.pendingRequests.some((id) => id.toString() === req.user.id)) {
      return res.status(409).json({ message: 'Already requested' });
    }
    share.pendingRequests.push(req.user.id);
    await share.save();
    res.json({ message: 'Request submitted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/approve
 * @body { userId }
 */
const approveMember = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share closed' });
    }
    const userId = req.body.userId;
    if (share.members.some((member) => member.user.toString() === userId)) {
      return res.status(400).json({ message: 'Already member' });
    }
    if (!share.pendingRequests.some((id) => id.toString() === userId)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    share.pendingRequests = share.pendingRequests.filter((id) => id.toString() !== userId);
    share.members.push({ user: userId, status: 'joined' });
    await share.save();
    await Chat.findOneAndUpdate(
      { shareRef: share._id },
      { $addToSet: { participants: userId } },
      { upsert: true }
    );
    res.json(share);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/finalize
 * @body { overrides?: [{ userId, share, percentage }] }
 */
const finalizeShare = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share already closed' });
    }
    share.members = calculateSplit(share, req.body.overrides || []);
  share.markModified('members');
    share.status = 'closed';
    await share.save();
    res.json(share);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listShares,
  getShare,
  createShare,
  requestJoin,
  approveMember,
  finalizeShare,
};
