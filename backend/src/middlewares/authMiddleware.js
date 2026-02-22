const { verifyAccessToken } = require('../config/jwt');

const auth = (roles = []) => (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = verifyAccessToken(token);
    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = { auth };
