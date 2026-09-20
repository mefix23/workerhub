const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// A token only names the user by numeric id. If the database is ever reset
// (e.g. on free hosting with a temporary disk), ids start again from 1 and an
// old token would suddenly open somebody else's account. So a token is only
// accepted if it was issued after the account it points to was created.
function tokenIsForThisAccount(payload, user) {
  const created = Date.parse(String(user.created_at).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(created) || !payload || typeof payload.iat !== 'number') return true;
  return payload.iat >= Math.floor(created / 1000);
}

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

    if (!user || !tokenIsForThisAccount(payload, user)) {
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
      if (user && !user.is_blocked && tokenIsForThisAccount(payload, user)) req.user = user;
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

// Admins and moderators.
function isStaff(user) {
  return !!user && (user.role === 'admin' || user.is_moderator === 1);
}

function requireStaff(req, res, next) {
  if (!isStaff(req.user)) {
    return res.status(403).json({ error: 'Staff access required.' });
  }
  next();
}

module.exports = { requireAuth, optionalAuth, requireAdmin, requireStaff, isStaff };
