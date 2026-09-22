const db = require('../config/db');

const Favorite = {
  has(userId, profileId) {
    return !!db
      .prepare('SELECT 1 FROM favorites WHERE user_id = ? AND profile_id = ?')
      .get(userId, profileId);
  },

  // Returns the new state (true = now favorited).
  toggle(userId, profileId) {
    if (Favorite.has(userId, profileId)) {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND profile_id = ?').run(userId, profileId);
      return false;
    }
    db.prepare('INSERT INTO favorites (user_id, profile_id) VALUES (?, ?)').run(userId, profileId);
    return true;
  },

  // Favorited profiles for a user, newest first. Only what a card needs.
  listForUser(userId) {
    return db
      .prepare(
        `SELECT p.id, p.user_id, p.name, p.title, p.avatar_url, p.role_title, p.roles,
                p.services_text, p.description, p.price_cents, p.currency, p.status, p.is_active,
                p.bg, p.font, p.frame, p.tier,
                (SELECT COUNT(*) FROM reviews r WHERE r.profile_id = p.id AND r.status = 'approved') AS rating_count,
                (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.profile_id = p.id AND r.status = 'approved') AS rating_avg,
                f.created_at AS favorited_at
         FROM favorites f
         JOIN profiles p ON p.id = f.profile_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`
      )
      .all(userId);
  },
};

module.exports = Favorite;
