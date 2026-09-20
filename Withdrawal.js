const db = require('../config/db');

const Withdrawal = {
  create({ userId, amountCents, availableAt }) {
    const stmt = db.prepare(`
      INSERT INTO withdrawals (user_id, amount_cents, status, available_at)
      VALUES (?, ?, 'pending', ?)
    `);
    const info = stmt.run(userId, amountCents, availableAt);
    return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(info.lastInsertRowid);
  },

  listForUser(userId) {
    return db
      .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY requested_at DESC')
      .all(userId);
  },

  setStatus(id, status) {
    db.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').run(status, id);
    return db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id);
  },
};

module.exports = Withdrawal;
