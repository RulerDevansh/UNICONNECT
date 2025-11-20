const User = require('../models/User');

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

module.exports = { getProfile, updateProfile, listUsers, lookupUsers };
