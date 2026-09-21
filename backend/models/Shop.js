const db = require('../config/db');
const Coins = require('./Coins');

const Shop = {
  owned(userId) {
    return new Set(
      db.prepare('SELECT item_id FROM user_items WHERE user_id = ?').all(userId).map((r) => r.item_id)
    );
  },

  has(userId, itemId) {
    return !!db
      .prepare('SELECT 1 FROM user_items WHERE user_id = ? AND item_id = ?')
      .get(userId, itemId);
  },

  // Returns 'ok' | 'owned' | 'funds'. Money and item change together.
  buy(userId, item) {
    return db.transaction(() => {
      if (Shop.has(userId, item.id)) return 'owned';
      if (!Coins.spend(userId, item.price, `Покупка: ${item.name}`)) return 'funds';
      db.prepare('INSERT INTO user_items (user_id, item_id) VALUES (?, ?)').run(userId, item.id);
      return 'ok';
    })();
  },
};

module.exports = Shop;
