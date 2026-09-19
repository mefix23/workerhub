const db = require('../config/db');

function serializeRow(row) {
  if (!row) return row;
  return {
    ...row,
    services: row.services ? JSON.parse(row.services) : [],
    portfolio: row.portfolio ? JSON.parse(row.portfolio) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
  };
}

const Profile = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO profiles
        (user_id, name, avatar_url, role_title, description, services,
         price_cents, currency, contact, portfolio, tags, status)
      VALUES (@userId, @name, @avatarUrl, @roleTitle, @description, @services,
              @priceCents, @currency, @contact, @portfolio, @tags, @status)
    `);
    const info = stmt.run({
      userId: data.userId,
      name: data.name,
      avatarUrl: data.avatarUrl || null,
      roleTitle: data.roleTitle,
      description: data.description,
      services: JSON.stringify(data.services || []),
      priceCents: data.priceCents,
      currency: data.currency || 'RUB',
      contact: data.contact,
      portfolio: JSON.stringify(data.portfolio || []),
      tags: JSON.stringify(data.tags || []),
      // MVP auto-publishes profiles. The status column + values already
      // support manual moderation for when an admin panel is added later.
      status: data.status || 'approved',
    });
    return Profile.findById(info.lastInsertRowid);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return serializeRow(row);
  },

  // List approved profiles, optionally filtered by a search string across
  // name / description / role_title / tags, and by category/price.
  list({ q, category, maxPrice, limit = 60, offset = 0 } = {}) {
    let sql = `SELECT * FROM profiles WHERE status = 'approved'`;
    const params = {};

    if (q) {
      sql += ` AND (name LIKE @q OR description LIKE @q OR role_title LIKE @q OR tags LIKE @q)`;
      params.q = `%${q}%`;
    }
    if (category) {
      sql += ` AND tags LIKE @category`;
      params.category = `%${category}%`;
    }
    if (maxPrice !== undefined && maxPrice !== null) {
      sql += ` AND price_cents <= @maxPrice`;
      params.maxPrice = maxPrice;
    }

    sql += ` ORDER BY created_at DESC LIMIT @limit OFFSET @offset`;
    params.limit = limit;
    params.offset = offset;

    const rows = db.prepare(sql).all(params);
    return rows.map(serializeRow);
  },

  listByUser(userId) {
    const rows = db
      .prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
    return rows.map(serializeRow);
  },

  setStatus(id, status) {
    db.prepare(`UPDATE profiles SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      status,
      id
    );
    return Profile.findById(id);
  },
};

module.exports = Profile;
