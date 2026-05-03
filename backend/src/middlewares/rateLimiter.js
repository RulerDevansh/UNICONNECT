const rateWindow = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX || 120);
const buckets = new Map();

const createRateLimiter = (windowMs, max) => {
  const scopedBuckets = new Map();
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of scopedBuckets) {
      if (now > bucket.expires) scopedBuckets.delete(key);
    }
  }, windowMs * 2);
  cleanupTimer.unref?.();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const bucket = scopedBuckets.get(key) || { count: 0, expires: now + windowMs };
    if (now > bucket.expires) {
      bucket.count = 0;
      bucket.expires = now + windowMs;
    }
    bucket.count += 1;
    scopedBuckets.set(key, bucket);
    if (bucket.count > max) {
      return res.status(429).json({ message: 'Too many requests' });
    }
    next();
  };
};

// Periodically remove expired buckets to prevent memory leak.
// `unref` lets tests/short-lived scripts exit naturally.
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.expires) buckets.delete(key);
  }
}, rateWindow * 2);
cleanupTimer.unref?.();

const rateLimiter = (req, res, next) => {
  const key = req.ip;
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, expires: now + rateWindow };
  if (now > bucket.expires) {
    bucket.count = 0;
    bucket.expires = now + rateWindow;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > maxRequests) {
    return res.status(429).json({ message: 'Too many requests' });
  }
  next();
};

const resendVerificationLimiter = createRateLimiter(15000, 1);

module.exports = { rateLimiter, createRateLimiter, resendVerificationLimiter };
