const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const listingRoutes = require('./routes/listingRoutes');
const offerRoutes = require('./routes/offerRoutes');
const biddingRoutes = require('./routes/biddingRoutes');
const shareRoutes = require('./routes/shareRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const mlProxyRoutes = require('./routes/mlProxyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { errorHandler } = require('./middlewares/errorMiddleware');
const { xssClean } = require('./middlewares/xssMiddleware');
const { corsOriginCallback } = require('./config/cors');

const app = express();

app.use(helmet());
app.use(cors({
  origin: corsOriginCallback,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xssClean);
app.use(rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 120,
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/bidding', biddingRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ml', mlProxyRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(errorHandler);

module.exports = app;
