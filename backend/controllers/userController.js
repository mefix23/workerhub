const db = require('../config/db');
const User = require('../models/User');

// Admin-only. The full admin panel (approving profiles, viewing orders,
// payments, withdrawals, complaints) is out of scope for the MVP, but this
// endpoint plus the requireAdmin middleware show the intended shape.
function listUsers(req, res, next) {
  try {
    const users = db
      .prepare('SELECT id, username, email, role, is_blocked, created_at FROM users ORDER BY created_at DESC')
      .all();
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

function setBlocked(req, res, next) {
  try {
    const { blocked } = req.body;
    const user = User.setBlocked(req.params.id, !!blocked);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, setBlocked };
