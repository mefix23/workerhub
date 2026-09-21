const db = require('../config/db');
const { REWARDS } = require('../constants/shop');

const DAY = 24 * 60 * 60;

const Coins = {
  REWARDS,

  balance(userId) {
    const row = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    return row ? row.coins : 0;
  },

  // Adds (or removes, if negative) coins and writes a line in the ledger.
  add(userId, amount, reason) {
    db.transaction(() => {
      db.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').run(amount, userId);
      db.prepare('INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)').run(
        userId,
        amount,
        reason
      );
    })();
  },

  // Takes coins only if the balance is enough. Returns true on success.
  spend(userId, amount, reason) {
    return db.transaction(() => {
      const res = db
        .prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?')
        .run(amount, userId, amount);
      if (!res.changes) return false;
      db.prepare('INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)').run(
        userId,
        -amount,
        reason
      );
      return true;
    })();
  },

  history(userId, limit = 10) {
    return db
      .prepare(
        `SELECT amount, reason, created_at FROM coin_transactions
         WHERE user_id = ? ORDER BY id DESC LIMIT ?`
      )
      .all(userId, limit);
  },

  // Seconds until the daily bonus can be taken again (0 = available now).
  dailyWaitSeconds(userId) {
    const row = db
      .prepare(
        `SELECT CASE WHEN last_daily IS NULL THEN 0
                     ELSE CAST(strftime('%s', last_daily) AS INTEGER) + ${DAY} - CAST(strftime('%s', 'now') AS INTEGER)
                END AS wait
         FROM users WHERE id = ?`
      )
      .get(userId);
    return row ? Math.max(0, row.wait) : 0;
  },

  // Once per 24 hours. The check and the update are ONE statement, so two
  // quick taps can't both succeed.
  claimDaily(userId) {
    return db.transaction(() => {
      const res = db
        .prepare(
          `UPDATE users SET coins = coins + ?, last_daily = datetime('now')
           WHERE id = ? AND (last_daily IS NULL
                 OR CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', last_daily) AS INTEGER) >= ${DAY})`
        )
        .run(REWARDS.daily, userId);
      if (!res.changes) return false;
      db.prepare('INSERT INTO coin_transactions (user_id, amount, reason) VALUES (?, ?, ?)').run(
        userId,
        REWARDS.daily,
        'Ежедневный бонус'
      );
      return true;
    })();
  },
};

module.exports = Coins;
