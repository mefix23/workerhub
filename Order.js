const db = require('../config/db');

const Order = {
  create({ buyerId, profileId, sellerId, serviceDescription, priceCents, currency }) {
    const stmt = db.prepare(`
      INSERT INTO orders (buyer_id, profile_id, seller_id, service_description, price_cents, currency, status)
      VALUES (?, ?, ?, ?, ?, ?, 'created')
    `);
    const info = stmt.run(buyerId, profileId, sellerId, serviceDescription, priceCents, currency);
    return Order.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  },

  listForUser(userId) {
    return db
      .prepare(
        `SELECT * FROM orders WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC`
      )
      .all(userId, userId);
  },

  setStatus(id, status) {
    db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      status,
      id
    );
    return Order.findById(id);
  },
};

module.exports = Order;
