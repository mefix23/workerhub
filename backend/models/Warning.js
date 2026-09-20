const db = require('../config/db');

const MAX_WARNINGS = 3;

const Warning = {
  MAX: MAX_WARNINGS,

  add(userId, issuedBy, reason) {
    db.prepare(`INSERT INTO warnings (user_id, issued_by, reason) VALUES (?, ?, ?)`).run(
      userId,
      issuedBy,
      reason
    );
  },

  count(userId) {
    return db.prepare(`SELECT COUNT(*) AS n FROM warnings WHERE user_id = ?`).get(userId).n;
  },

  listByUser(userId) {
    return db
      .prepare(
        `SELECT w.id, w.reason, w.created_at, u.username AS issued_by_name
         FROM warnings w
         LEFT JOIN users u ON u.id = w.issued_by
         WHERE w.user_id = ?
         ORDER BY w.id ASC`
      )
      .all(userId);
  },

  // Removes the most recent warning. Returns false if there was none.
  removeLast(userId) {
    const row = db
      .prepare(`SELECT id FROM warnings WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
      .get(userId);
    if (!row) return false;
    db.prepare(`DELETE FROM warnings WHERE id = ?`).run(row.id);
    return true;
  },
};

module.exports = Warning;
