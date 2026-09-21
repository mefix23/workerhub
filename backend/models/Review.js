const db = require('../config/db');

const Review = {
  create({ profileId, authorId, rating, text }) {
    const info = db
      .prepare('INSERT INTO reviews (profile_id, author_id, rating, text) VALUES (?, ?, ?, ?)')
      .run(profileId, authorId, rating, text);
    return Review.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  },

  findByAuthorProfile(profileId, authorId) {
    return db
      .prepare('SELECT * FROM reviews WHERE profile_id = ? AND author_id = ?')
      .get(profileId, authorId);
  },

  listApproved(profileId, limit = 50) {
    return db
      .prepare(
        `SELECT r.id, r.rating, r.text, r.created_at, r.author_id, u.username AS author_name
         FROM reviews r JOIN users u ON u.id = r.author_id
         WHERE r.profile_id = ? AND r.status = 'approved'
         ORDER BY r.id DESC LIMIT ?`
      )
      .all(profileId, limit);
  },

  summary(profileId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS count, ROUND(AVG(rating), 1) AS avg
         FROM reviews WHERE profile_id = ? AND status = 'approved'`
      )
      .get(profileId);
    return { count: row.count, avg: row.count ? row.avg : null };
  },

  pendingCountByAuthor(authorId) {
    return db
      .prepare(`SELECT COUNT(*) AS n FROM reviews WHERE author_id = ? AND status = 'pending'`)
      .get(authorId).n;
  },

  // Reviews waiting for a moderator (oldest first).
  queue(limit = 100) {
    return db
      .prepare(
        `SELECT r.id, r.rating, r.text, r.created_at, r.profile_id,
                p.name AS profile_name, p.title AS profile_title,
                r.author_id, u.username AS author_name
         FROM reviews r
         JOIN profiles p ON p.id = r.profile_id
         JOIN users u ON u.id = r.author_id
         WHERE r.status = 'pending'
         ORDER BY r.id ASC LIMIT ?`
      )
      .all(limit);
  },

  setStatus(id, status, reason) {
    db.prepare('UPDATE reviews SET status = ?, reject_reason = ? WHERE id = ?').run(
      status,
      status === 'rejected' && reason ? reason : null,
      id
    );
    return Review.findById(id);
  },

  // True only the first time (so approving again can't pay twice).
  markRewarded(id) {
    return db.prepare('UPDATE reviews SET reward_paid = 1 WHERE id = ? AND reward_paid = 0').run(id).changes > 0;
  },

  remove(id) {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  },
};

module.exports = Review;
