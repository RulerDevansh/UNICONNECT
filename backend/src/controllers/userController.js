const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Share = require('../models/Share');

/**
 * @route GET /api/users/me
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/users/me
 */
const updateProfile = async (req, res, next) => {
  try {
    const updates = (({ name, preferences }) => ({ name, preferences }))(req.body);
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/users (admin)
 */
const listUsers = async (_req, res, next) => {
  try {
    const users = await User.find().select('name email role collegeDomain verified');
    res.json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/users/lookup?q=email
 */
const lookupUsers = async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const users = await User.find({
      collegeDomain: req.user.collegeDomain,
      email: { $regex: query, $options: 'i' },
      _id: { $ne: req.user.id },
    })
      .limit(5)
      .select('name email');
    res.json(users);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/users/me/history
 * @description Get user's buying, selling, and cab sharing history
 */
const getUserHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get buying history (transactions where user is buyer and status is completed)
    const buyingHistory = await Transaction.find({ 
      buyer: userId,
      status: 'completed'
    })
      .populate('listing', 'title price images category')
      .populate('seller', 'name email')
      .sort('-createdAt')
      .limit(50)
      .lean();

    // Get selling history (transactions where user is seller and status is completed)
    const sellingHistory = await Transaction.find({ 
      seller: userId,
      status: 'completed'
    })
      .populate('listing', 'title price images category')
      .populate('buyer', 'name email')
      .sort('-createdAt')
      .limit(50)
      .lean();

    // Merge listing data with snapshot for deleted listings
    const mergeListing = (transaction) => {
      if (!transaction.listing && transaction.listingSnapshot) {
        transaction.listing = transaction.listingSnapshot;
      }
      return transaction;
    };

    const buyingHistoryMerged = buyingHistory.map(mergeListing);
    const sellingHistoryMerged = sellingHistory.map(mergeListing);

    // Get sharing history
    // Only show completed trips/orders (where departure/deadline time has passed)
    const now = new Date();

    // Get cab trips where user was host (may be deleted by cleanup service)
    const cabSharingAsHost = await Share.find({ 
      host: userId,
      shareType: 'cab',
      departureTime: { $lt: now }
    })
      .populate('members.user', 'name email')
      .sort('-departureTime')
      .limit(25);

    // Get cab trips where user was member
    const cabSharingAsMember = await Share.find({ 
      'members.user': userId,
      shareType: 'cab',
      departureTime: { $lt: now }
    })
      .populate('host', 'name email')
      .populate('members.user', 'name email')
      .sort('-departureTime')
      .limit(25);

    // Get food orders where user was host (may be deleted by cleanup service)
    const foodSharingAsHost = await Share.find({ 
      host: userId,
      shareType: 'food',
      deadlineTime: { $lt: now }
    })
      .populate('members.user', 'name email')
      .sort('-deadlineTime')
      .limit(25);

    // Get food orders where user was member
    const foodSharingAsMember = await Share.find({ 
      'members.user': userId,
      shareType: 'food',
      deadlineTime: { $lt: now }
    })
      .populate('host', 'name email')
      .populate('members.user', 'name email')
      .sort('-deadlineTime')
      .limit(25);

    // Get other shares where user was host (may be deleted by cleanup service)
    const otherSharingAsHost = await Share.find({ 
      host: userId,
      shareType: 'other',
      otherDeadline: { $lt: now }
    })
      .populate('members.user', 'name email')
      .sort('-otherDeadline')
      .limit(25);

    // Get other shares where user was member
    const otherSharingAsMember = await Share.find({ 
      'members.user': userId,
      shareType: 'other',
      otherDeadline: { $lt: now }
    })
      .populate('host', 'name email')
      .populate('members.user', 'name email')
      .sort('-otherDeadline')
      .limit(25);

    res.json({
      buyingHistory: buyingHistoryMerged,
      sellingHistory: sellingHistoryMerged,
      cabSharing: {
        asHost: cabSharingAsHost,
        asMember: cabSharingAsMember,
      },
      foodSharing: {
        asHost: foodSharingAsHost,
        asMember: foodSharingAsMember,
      },
      otherSharing: {
        asHost: otherSharingAsHost,
        asMember: otherSharingAsMember,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile, listUsers, lookupUsers, getUserHistory };
