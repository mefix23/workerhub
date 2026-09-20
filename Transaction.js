const db = require('../config/db');

const Transaction = {
  record({ userId, type, amountCents, relatedOrderId = null }) {
    const stmt = db.prepare(`
      INSERT INTO transactions (user_id, type, amount_cents, related_order_id)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(userId, type, amountCents, relatedOrderId);
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  },

  listForUser(userId, limit = 100) {
    return db
      .prepare(
        `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
      )
      .all(userId, limit);
  },
};

module.exports = Transaction;
