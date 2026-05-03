const { verifyAccessToken } = require('../config/jwt');

const ROLE_CAPABILITIES = {
  admin: ['*'],
  user: [],
};

const hasCapability = (role, capability) => {
  if (!role) return false;
  if (capability === 'admin-only') return role === 'admin';
  if (role === 'admin') return true;
  return ROLE_CAPABILITIES[role]?.includes(capability) || false;
};

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
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const optionalAuth = () => (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next();

  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Public routes should still work when an old/invalid token is attached.
  }

  return next();
};

const authorizeCapabilities = (capabilities = []) => (req, res, next) => {
  if (!capabilities.length) return next();
  const role = req.user?.role;
  const allowed = capabilities.some((cap) => hasCapability(role, cap));
  if (!allowed) return res.status(403).json({ message: 'Forbidden' });
  return next();
};

module.exports = { auth, optionalAuth, authorizeCapabilities, ROLE_CAPABILITIES, hasCapability };
