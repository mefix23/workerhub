const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// Requires a valid Bearer token. Rejects blocked users.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    const user = User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    if (user.is_blocked) {
      return res.status(403).json({ error: 'This account has been blocked.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Populates req.user if a valid token is present, but never rejects the request.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      const user = User.findById(payload.sub);
      if (user && !user.is_blocked) req.user = user;
    } catch (err) {
      // Ignore invalid tokens for optional auth.
    }
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin };
