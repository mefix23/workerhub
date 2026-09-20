const crypto = require('crypto');
const db = require('../config/db');
const User = require('../models/User');

// Staff only (admins and moderators). Moderators don't get to see emails.
function listUsers(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.email, u.role, u.is_blocked, u.is_moderator, u.created_at,
                (SELECT COUNT(*) FROM profiles p WHERE p.user_id = u.id) AS profiles_count
         FROM users u
         ORDER BY u.created_at DESC, u.id DESC`
      )
      .all();
    const users = rows.map((u) => (isAdmin ? u : { ...u, email: null }));
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

function findTarget(req) {
  const id = parseInt(req.params.id, 10);
  return Number.isInteger(id) ? User.findById(id) : null;
}

function setBlocked(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });

    if (target.id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя.' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Администратора заблокировать нельзя.' });
    }
    if (target.is_moderator && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Модератора может заблокировать только администратор.' });
    }

    const blocked = !!(req.body && req.body.blocked);
    const user = User.setBlocked(target.id, blocked);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// Admin only.
function setModerator(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
    if (target.role === 'admin') {
      return res.status(400).json({ error: 'Администратору роль модератора не нужна.' });
    }

    const moderator = !!(req.body && req.body.moderator);
    const user = User.setModerator(target.id, moderator);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// Any logged-in user can become admin by sending the secret key that is set
// in the ADMIN_SETUP_KEY environment variable on the server.
function claimAdmin(req, res, next) {
  try {
    const expected = process.env.ADMIN_SETUP_KEY;
    if (!expected) {
      return res.status(503).json({ error: 'Ключ администратора не настроен на сервере.' });
    }

    const given = String((req.body && req.body.key) || '');
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Неверный ключ.' });
    }

    const user = User.makeAdmin(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, setBlocked, setModerator, claimAdmin };
