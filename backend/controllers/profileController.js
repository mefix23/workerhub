const Profile = require('../models/Profile');
const User = require('../models/User');
const Shop = require('../models/Shop');
const { findItem } = require('../constants/shop');
const Favorite = require('../models/Favorite');
const db = require('../config/db');
const ProfileRequest = require('../models/ProfileRequest');
const { toCents } = require('../utils/money');
const { ROLE_SLUGS } = require('../constants/roles');
const { isStaff } = require('../middleware/auth');

const MAX_PROFILES_PER_USER = 5;
const MAX_PENDING_PER_USER = 2;

function list(req, res, next) {
  try {
    const { q, category, maxPrice, limit, offset } = req.query;
    let { role } = req.query; // ?role=gp or ?role=gp,deco
    const roles = role
      ? String(role)
          .split(',')
          .map((r) => r.trim())
          .filter((r) => ROLE_SLUGS.includes(r))
      : undefined;

    const profiles = Profile.list({
      q: q ? String(q).slice(0, 100) : undefined,
      roles: roles && roles.length ? roles : undefined,
      category: category ? String(category).slice(0, 50) : undefined,
      maxPrice: maxPrice ? toCents(maxPrice) : undefined,
      limit: limit ? Math.min(parseInt(limit, 10) || 60, 100) : 60,
      offset: offset ? parseInt(offset, 10) || 0 : 0,
    });
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });

    const owner = User.findById(profile.user_id);
    const canSeeAll = !!req.user && (profile.user_id === req.user.id || isStaff(req.user));
    const isPublic =
      profile.status === 'approved' && profile.is_active === 1 && owner && !owner.is_blocked;

    // Unpublished, switched-off (REQ—OFF) or blocked-owner profiles are only
    // visible to their owner and to staff.
    if (!isPublic && !canSeeAll) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (!canSeeAll) delete profile.reject_reason;

    profile.owner = owner ? { id: owner.id, username: owner.username } : null;
    if (req.user) profile.is_favorited = Favorite.has(req.user.id, profile.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const b = req.body || {};
    const priceCents = toCents(b.price);
    if (priceCents === null) {
      return res.status(400).json({ error: 'Invalid price.' });
    }

    // Anti-spam limits.
    if (Profile.countByUser(req.user.id) >= MAX_PROFILES_PER_USER) {
      return res.status(409).json({
        error: `Максимум ${MAX_PROFILES_PER_USER} анкет на аккаунт. Удали ненужную, чтобы создать новую.`,
      });
    }
    if (Profile.countPendingByUser(req.user.id) >= MAX_PENDING_PER_USER) {
      return res.status(409).json({
        error: `У тебя уже ${MAX_PENDING_PER_USER} анкеты на проверке. Дождись решения модератора.`,
      });
    }

    const profile = Profile.create({
      userId: req.user.id,
      name: String(b.name).trim(),
      title: String(b.title).trim(),
      avatarUrl: b.avatarUrl ? String(b.avatarUrl).trim() : null,
      roles: b.roles,
      description: String(b.description || '').trim(),
      servicesText: String(b.servicesText).trim(),
      media: b.media,
      services: b.services,
      priceCents,
      currency: b.currency || 'RUB',
      contact: String(b.contact).trim(),
      portfolio: b.portfolio,
      tags: b.tags,
      // New profiles wait for a moderator ("Выложить" / "Отклонить").
      status: 'pending',
    });

    res.status(201).json({ profile });
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    const existing = Profile.findById(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const b = req.body || {};
    const priceCents = toCents(b.price);
    if (priceCents === null) {
      return res.status(400).json({ error: 'Invalid price.' });
    }

    // Editing sends the profile back to moderation (status -> pending).
    const profile = Profile.update(existing.id, {
      name: String(b.name).trim(),
      title: String(b.title).trim(),
      avatarUrl: b.avatarUrl ? String(b.avatarUrl).trim() : null,
      roles: b.roles,
      description: String(b.description || '').trim(),
      servicesText: String(b.servicesText).trim(),
      media: b.media,
      services: b.services,
      priceCents,
      currency: b.currency || existing.currency,
      contact: String(b.contact).trim(),
      portfolio: b.portfolio,
      tags: b.tags,
    });

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const existing = Profile.findById(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    // Deleting a profile also deletes its orders (ON DELETE CASCADE), so we
    // refuse while money may still be held in escrow for this profile.
    if (Profile.hasActiveOrders(existing.id)) {
      return res.status(409).json({
        error: 'Нельзя удалить анкету: по ней есть активные заказы (оплаченные или в работе). Сначала завершите или отмените их.',
      });
    }
    Profile.remove(existing.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Owner switch: REQ—ON / REQ—OFF.
function setActive(req, res, next) {
  try {
    const existing = Profile.findById(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    const active = !!(req.body && req.body.active);
    const profile = Profile.setActive(existing.id, active);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// Owner picks decorations (background / font / frame) he has bought.
// An empty value = default look.
function setAppearance(req, res, next) {
  try {
    const existing = Profile.findById(req.params.id);
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const b = req.body || {};
    const next_ = { bg: existing.bg, font: existing.font, frame: existing.frame };
    for (const type of ['bg', 'font', 'frame']) {
      if (!(type in b)) continue;
      const id = b[type];
      if (id === null || id === '') {
        next_[type] = null;
        continue;
      }
      const item = findItem(id);
      if (!item || item.type !== type || !Shop.has(req.user.id, item.id)) {
        return res.status(400).json({ error: 'Этот предмет тебе недоступен. Сначала купи его в магазине.' });
      }
      next_[type] = item.id;
    }

    const profile = Profile.setAppearance(existing.id, next_);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

// Same "can this person see the profile" rule used elsewhere.
function isPublicProfile(profile) {
  if (!profile) return false;
  const owner = User.findById(profile.user_id);
  return profile.status === 'approved' && profile.is_active === 1 && !!owner && !owner.is_blocked;
}

// ---------- favorites ----------

function toggleFavorite(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    if (!isPublicProfile(profile)) return res.status(404).json({ error: 'Анкета не найдена.' });
    if (profile.user_id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя добавить свою анкету в избранное.' });
    }
    const favorited = Favorite.toggle(req.user.id, profile.id);
    res.json({ favorited });
  } catch (err) {
    next(err);
  }
}

function myFavorites(req, res, next) {
  try {
    res.json({ profiles: Favorite.listForUser(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// ---------- "leave a request" (replaces the old order button) ----------
// The buyer sends a short message; the creator sees it on his own profile
// page and reaches out via the contact shown on the anketa. No money moves.

const MAX_PENDING_REQUESTS_PER_BUYER = 10;

function createRequest(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    if (!isPublicProfile(profile)) return res.status(404).json({ error: 'Анкета не найдена.' });
    if (profile.user_id === req.user.id) {
      return res.status(400).json({ error: 'Нельзя оставить заявку на свою анкету.' });
    }
    if (ProfileRequest.existsFor(profile.id, req.user.id)) {
      return res.status(409).json({ error: 'Ты уже оставлял заявку этому креатору по этой анкете.' });
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 5 || message.length > 500) {
      return res.status(400).json({ error: 'Опиши, что нужно: от 5 до 500 символов.' });
    }

    const open = db_requestCount(req.user.id);
    if (open >= MAX_PENDING_REQUESTS_PER_BUYER) {
      return res.status(429).json({ error: 'Слишком много заявок за раз. Попробуй позже.' });
    }

    const request = ProfileRequest.create(profile.id, req.user.id, message);
    res.status(201).json({ request: { id: request.id } });
  } catch (err) {
    next(err);
  }
}

// Owner: requests received on one of his profiles.
function listRequests(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    if (!profile || profile.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Анкета не найдена.' });
    }
    const requests = ProfileRequest.listForProfile(profile.id);
    ProfileRequest.markSeen(profile.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

function myProfiles(req, res, next) {
  try {
    const profiles = Profile.listByUser(req.user.id);
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

function db_requestCount(buyerId) {
  return db.prepare('SELECT COUNT(*) AS n FROM profile_requests WHERE buyer_id = ?').get(buyerId).n;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  setActive,
  setAppearance,
  toggleFavorite,
  myFavorites,
  createRequest,
  listRequests,
  myProfiles,
};
