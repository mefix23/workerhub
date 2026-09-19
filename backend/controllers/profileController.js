const Profile = require('../models/Profile');
const { toCents } = require('../utils/money');
const { ROLE_SLUGS } = require('../constants/roles');

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
    if (!profile || profile.status !== 'approved') {
      // Owners can still view their own pending/rejected profile.
      if (!profile || !req.user || profile.user_id !== req.user.id) {
        return res.status(404).json({ error: 'Profile not found.' });
      }
    }
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

    const profile = Profile.create({
      userId: req.user.id,
      name: String(b.name).trim(),
      avatarUrl: b.avatarUrl ? String(b.avatarUrl).trim() : null,
      roles: b.roles,
      description: String(b.description).trim(),
      services: b.services,
      priceCents,
      currency: b.currency || 'RUB',
      contact: String(b.contact).trim(),
      portfolio: b.portfolio,
      tags: b.tags,
      // MVP: auto-approved. Structure already supports manual moderation
      // (status can be set to 'pending' here once an admin review step exists).
      status: 'approved',
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

    const profile = Profile.update(existing.id, {
      name: String(b.name).trim(),
      avatarUrl: b.avatarUrl ? String(b.avatarUrl).trim() : null,
      roles: b.roles,
      description: String(b.description).trim(),
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

function myProfiles(req, res, next) {
  try {
    const profiles = Profile.listByUser(req.user.id);
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, myProfiles };
