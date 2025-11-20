const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { sendVerificationEmail } = require('../services/emailService');

/**
 * @route POST /api/auth/register
 * @body {name,email,password}
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const collegeDomain = email.includes('@') ? email.split('@')[1] : '';
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, collegeDomain });
    if (process.env.NODE_ENV !== 'production') {
      user.verified = true;
      await user.save();
    } else {
      await sendVerificationEmail(user);
    }

    res.status(201).json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.verified) return res.status(403).json({ message: 'Please verify email' });

    const payload = { id: user._id, role: user.role, collegeDomain: user.collegeDomain };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
    await user.save();

    res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'Invalid session' });
    const stored = user.refreshTokens.find((entry) => entry.token === refreshToken);
    if (!stored) return res.status(401).json({ message: 'Invalid session' });
    const payload = { id: user._id, role: user.role, collegeDomain: user.collegeDomain };
    const accessToken = generateAccessToken(payload);
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(200).json({ message: 'Logged out' });
    const decoded = jwt.decode(refreshToken);
    const user = await User.findById(decoded?.id);
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== refreshToken);
      await user.save();
    }
    res.json({ message: 'Session cleared' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout };
