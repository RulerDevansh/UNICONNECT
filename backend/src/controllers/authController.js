const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

/** Generate a secure 6-digit numeric OTP */
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

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

    const code = generateOTP();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = await User.create({
      name,
      email,
      password,
      collegeDomain,
      emailVerificationCode: code,
      emailVerificationExpires: expires,
    });

    await sendVerificationEmail(user, code);

    res.status(201).json({
      message: 'Registration successful. A 6-digit verification code has been sent to your email.',
      email: user.email,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/verify-email
 * @body {email, code}
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.status(200).json({ message: 'Email already verified. Please log in.' });

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({ message: 'No verification code found. Request a new one.' });
    }
    if (new Date() > user.emailVerificationExpires) {
      return res.status(400).json({ message: 'Verification code expired. Please request a new one.' });
    }
    if (user.emailVerificationCode !== code.trim()) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    user.verified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/resend-verification
 * @body {email}
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.verified) return res.status(400).json({ message: 'Email is already verified' });

    const code = generateOTP();
    user.emailVerificationCode = code;
    user.emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user, code);

    res.json({ message: 'A new verification code has been sent to your email.' });
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

/**
 * @route POST /api/auth/forgot-password
 * @body {email}
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond generically to prevent user enumeration
    if (!user || !user.verified) {
      return res.json({ message: 'If this email is registered and verified, a reset code has been sent.' });
    }

    const code = generateOTP();
    user.passwordResetCode = code;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    await sendPasswordResetEmail(user, code);

    res.json({ message: 'If this email is registered and verified, a reset code has been sent.' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/auth/reset-password
 * @body {email, code, newPassword}
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.passwordResetCode || !user.passwordResetExpires) {
      return res.status(400).json({ message: 'No reset code found. Please request a new one.' });
    }
    if (new Date() > user.passwordResetExpires) {
      return res.status(400).json({ message: 'Reset code expired. Please request a new one.' });
    }
    if (user.passwordResetCode !== code.trim()) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }

    user.password = newPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = []; // invalidate all sessions
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, verifyEmail, resendVerification, forgotPassword, resetPassword };
