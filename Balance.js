const db = require('../config/db');

const Balance = {
  // Ensures a balances row exists, then returns it.
  getOrCreate(userId) {
    db.prepare(
      `INSERT OR IGNORE INTO balances (user_id, available_cents, pending_cents) VALUES (?, 0, 0)`
    ).run(userId);
    return db.prepare('SELECT * FROM balances WHERE user_id = ?').get(userId);
  },

  // All balance mutation happens here, on the server, driven only by internal
  // order/withdrawal state transitions — never directly from a client request.
  addPending(userId, cents) {
    Balance.getOrCreate(userId);
    db.prepare(
      `UPDATE balances SET pending_cents = pending_cents + ?, updated_at = datetime('now') WHERE user_id = ?`
    ).run(cents, userId);
  },

  movePendingToAvailable(userId, cents) {
    Balance.getOrCreate(userId);
    db.prepare(
      `UPDATE balances
         SET pending_cents = MAX(pending_cents - ?, 0),
             available_cents = available_cents + ?,
             updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(cents, cents, userId);
  },

  deductAvailable(userId, cents) {
    Balance.getOrCreate(userId);
    db.prepare(
      `UPDATE balances
         SET available_cents = MAX(available_cents - ?, 0),
             updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(cents, userId);
  },
};

module.exports = Balance;
