const db = require('../config/db');
const Profile = require('../models/Profile');

// All profiles (published and hidden) with their owner, for the staff panel.
// The avatar is left out on purpose: it can be large and isn't needed here.
function listProfiles(req, res, next) {
  try {
    const profiles = db
      .prepare(
        `SELECT p.id, p.name, p.role_title, p.status, p.created_at,
                substr(p.description, 1, 160) AS description,
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

    Profile.setStatus(existing.id, status);
    res.json({ ok: true, status });
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

module.exports = { listProfiles, setProfileStatus, deleteProfile };
