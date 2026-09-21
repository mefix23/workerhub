const crypto = require('crypto');
const db = require('../config/db');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Warning = require('../models/Warning');
const Coins = require('../models/Coins');
const { isStaff } = require('../middleware/auth');

// Staff only (admins and moderators). Moderators don't get to see emails.
function listUsers(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    const rows = db
      .prepare(
        `SELECT u.id, u.username, u.email, u.role, u.is_blocked, u.is_moderator, u.created_at,
                u.coins,
                (SELECT COUNT(*) FROM profiles p WHERE p.user_id = u.id) AS profiles_count,
                (SELECT COUNT(*) FROM warnings w WHERE w.user_id = u.id) AS warn_count
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

// Who may punish whom: nobody punishes themselves or an admin, and only an
// admin can punish a moderator.
function punishError(req, target) {
  if (target.id === req.user.id) return [400, 'Нельзя сделать это с самим собой.'];
  if (target.role === 'admin') return [403, 'Администратора наказать нельзя.'];
  if (target.is_moderator && req.user.role !== 'admin') {
    return [403, 'Модератора может наказать только администратор.'];
  }
  return null;
}

// Staff: give an account a warning (WARN). The 3rd warning blocks the account.
function warnUser(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });

    const denied = punishError(req, target);
    if (denied) return res.status(denied[0]).json({ error: denied[1] });

    const reason = String((req.body && req.body.reason) || '').trim();
    if (reason.length < 3 || reason.length > 200) {
      return res.status(400).json({ error: 'Укажи причину предупреждения (3–200 символов).' });
    }

    Warning.add(target.id, req.user.id, reason);
    const warnCount = Warning.count(target.id);

    let blocked = !!target.is_blocked;
    if (warnCount >= Warning.MAX && !blocked) {
      User.setBlocked(target.id, true);
      blocked = true;
    }
    res.json({ warn_count: warnCount, max: Warning.MAX, blocked });
  } catch (err) {
    next(err);
  }
}

// Admin only: remove the most recent warning.
function removeLastWarning(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
    if (!Warning.removeLast(target.id)) {
      return res.status(404).json({ error: 'У пользователя нет предупреждений.' });
    }
    res.json({ warn_count: Warning.count(target.id), max: Warning.MAX });
  } catch (err) {
    next(err);
  }
}

// Public account page (own or somebody else's).
// - everyone sees: username, join date, published profiles
// - the owner and staff also see: all profiles with statuses, WARN list
// - only the owner sees his own email
function getPublic(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });

    const self = !!req.user && req.user.id === target.id;
    const staff = isStaff(req.user);
    const allProfiles = Profile.listByUser(target.id);

    const profiles =
      self || staff
        ? allProfiles
        : target.is_blocked
        ? []
        : allProfiles.filter((p) => p.status === 'approved' && p.is_active === 1);

    const user = {
      id: target.id,
      username: target.username,
      created_at: target.created_at,
      role: target.role,
      is_moderator: target.is_moderator,
      is_blocked: target.is_blocked,
    };
    if (self) {
      user.email = target.email;
      user.coins = Coins.balance(target.id);
    }

    const body = { user, profiles, is_self: self };
    if (self || staff) {
      body.max_warnings = Warning.MAX;
      body.warnings = Warning.listByUser(target.id).map((w) => ({
        id: w.id,
        reason: w.reason,
        created_at: w.created_at,
        // moderators' names are only shown to other staff
        issued_by_name: staff ? w.issued_by_name : undefined,
      }));
      body.warn_count = body.warnings.length;
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
}

// Admin only: give coins to an account (for tests, contests, compensation).
function grantCoins(req, res, next) {
  try {
    const target = findTarget(req);
    if (!target) return res.status(404).json({ error: 'Пользователь не найден.' });
    const amount = Number(req.body && req.body.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      return res.status(400).json({ error: 'Сумма: целое число от 1 до 10000.' });
    }
    Coins.add(target.id, amount, `Выдано администратором (${req.user.username})`);
    res.json({ coins: Coins.balance(target.id) });
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

module.exports = {
  listUsers,
  setBlocked,
  setModerator,
  claimAdmin,
  warnUser,
  removeLastWarning,
  getPublic,
  grantCoins,
};
