const db = require('../config/db');
const Profile = require('../models/Profile');
const { TIER_SLUGS } = require('../constants/tiers');

// Profiles waiting for a decision (oldest first), with everything a
// moderator needs to judge them.
function listQueue(req, res, next) {
  try {
    const rows = db
      .prepare(
        `SELECT p.id, p.name, p.title, p.avatar_url, p.role_title, p.description, p.services_text, p.media, p.tier,
                p.price_cents, p.currency, p.contact, p.tags, p.created_at, p.updated_at,
                u.id AS user_id, u.username, u.is_blocked,
                (SELECT COUNT(*) FROM warnings w WHERE w.user_id = u.id) AS warn_count
         FROM profiles p
         JOIN users u ON u.id = p.user_id
         WHERE p.status = 'pending'
         ORDER BY p.updated_at ASC, p.id ASC
         LIMIT 100`
      )
      .all();
    const profiles = rows.map((r) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags) : [],
      media: r.media ? JSON.parse(r.media) : [],
    }));
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

// All profiles (published and hidden) with their owner, for the staff panel.
// The avatar is left out on purpose: it can be large and isn't needed here.
function listProfiles(req, res, next) {
  try {
    const profiles = db
      .prepare(
        `SELECT p.id, p.name, p.title, p.role_title, p.status, p.is_active, p.reject_reason, p.tier, p.created_at,
                substr(COALESCE(p.services_text, p.description), 1, 160) AS description,
                u.id AS user_id, u.username, u.is_blocked
         FROM profiles p
         JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 300`
      )
      .all();
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
}

// Hide a profile from the catalog ('rejected') or publish it again ('approved').
function setProfileStatus(req, res, next) {
  try {
    const status = req.body && req.body.status;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус.' });
    }
    const existing = Profile.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Анкета не найдена.' });

    const reason = String((req.body && req.body.reason) || '').trim().slice(0, 200);
    Profile.setStatus(existing.id, status, reason);
    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
}

// Give a profile a skill tier, or clear it (tier = null).
function setProfileTier(req, res, next) {
  try {
    const tier = req.body ? req.body.tier : null;
    if (tier !== null && tier !== '' && !TIER_SLUGS.includes(tier)) {
      return res.status(400).json({ error: 'Неверный тир.' });
    }
    const existing = Profile.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Анкета не найдена.' });
    Profile.setTier(existing.id, tier || null);
    res.json({ ok: true, tier: tier || null });
  } catch (err) {
    next(err);
  }
}

function deleteProfile(req, res, next) {
  try {
    const existing = Profile.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Анкета не найдена.' });

    // Deleting a profile also deletes its orders, so refuse while money may
    // still be held for it. Hiding the profile works in that case.
    if (Profile.hasActiveOrders(existing.id)) {
      return res.status(409).json({
        error: 'Нельзя удалить: по анкете есть активные заказы. Скройте её вместо удаления.',
      });
    }
    Profile.remove(existing.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listQueue, listProfiles, setProfileStatus, setProfileTier, deleteProfile };
