const rateWindow = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const maxRequests = Number(process.env.RATE_LIMIT_MAX || 120);
const buckets = new Map();

// Periodically remove expired buckets to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.expires) buckets.delete(key);
  }
}, rateWindow * 2);

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

module.exports = { rateLimiter };
