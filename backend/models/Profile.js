const db = require('../config/db');
const { labelsForSlugs } = require('../constants/roles');
const { tierLabel } = require('../constants/tiers');

// Everything except the (large) works gallery, for lists.
const LIST_COLUMNS = `id, user_id, name, title, avatar_url, role_title, roles, description,
  services_text, services, price_cents, currency, contact, portfolio, tags, status,
  is_active, reject_reason, tier, created_at, updated_at`;

function serializeRow(row) {
  if (!row) return row;
  const roles = row.roles ? JSON.parse(row.roles) : [];
  return {
    ...row,
    media: row.media ? JSON.parse(row.media) : undefined,
    tier_label: tierLabel(row.tier),
    services: row.services ? JSON.parse(row.services) : [],
    portfolio: row.portfolio ? JSON.parse(row.portfolio) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    roles,
    role_labels: labelsForSlugs(roles),
  };
}

const Profile = {
  create(data) {
    const roles = data.roles || [];
    // role_title is kept only as a legacy, human-readable fallback (used by
    // older search code paths and as a plain-text summary); the `roles`
    // column is the source of truth going forward.
    const roleTitle = data.roleTitle || labelsForSlugs(roles).join(', ') || 'Creator';

    const stmt = db.prepare(`
      INSERT INTO profiles
        (user_id, name, title, avatar_url, role_title, roles, description, services_text, media,
         services, price_cents, currency, contact, portfolio, tags, status)
      VALUES (@userId, @name, @title, @avatarUrl, @roleTitle, @roles, @description, @servicesText, @media,
              @services, @priceCents, @currency, @contact, @portfolio, @tags, @status)
    `);
    const info = stmt.run({
      userId: data.userId,
      name: data.name,
      title: data.title || null,
      avatarUrl: data.avatarUrl || null,
      roleTitle,
      roles: JSON.stringify(roles),
      description: data.description || '',
      servicesText: data.servicesText || null,
      media: JSON.stringify(data.media || []),
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

  update(id, data) {
    const roles = data.roles || [];
    const roleTitle = data.roleTitle || labelsForSlugs(roles).join(', ') || 'Creator';

    db.prepare(`
      UPDATE profiles SET
        name = @name, title = @title, avatar_url = @avatarUrl, role_title = @roleTitle, roles = @roles,
        description = @description, services_text = @servicesText, media = @media,
        services = @services, price_cents = @priceCents,
        currency = @currency, contact = @contact, portfolio = @portfolio, tags = @tags,
        status = 'pending', reject_reason = NULL,
        updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id,
      name: data.name,
      title: data.title || null,
      avatarUrl: data.avatarUrl || null,
      roleTitle,
      roles: JSON.stringify(roles),
      description: data.description || '',
      servicesText: data.servicesText || null,
      media: JSON.stringify(data.media || []),
      services: JSON.stringify(data.services || []),
      priceCents: data.priceCents,
      currency: data.currency || 'RUB',
      contact: data.contact,
      portfolio: JSON.stringify(data.portfolio || []),
      tags: JSON.stringify(data.tags || []),
    });
    return Profile.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    return serializeRow(row);
  },

  // List approved profiles, optionally filtered by a search string across
  // name / description / role_title / tags, by one or more role slugs, and
  // by price.
  list({ q, roles, category, maxPrice, limit = 60, offset = 0 } = {}) {
    // Only published profiles whose owner switched them ON (REQ—ON) and whose
    // owner isn't blocked.
    let sql = `SELECT ${LIST_COLUMNS} FROM profiles WHERE status = 'approved' AND is_active = 1
               AND user_id NOT IN (SELECT id FROM users WHERE is_blocked = 1)`;
    const params = {};

    if (q) {
      sql += ` AND (name LIKE @q OR title LIKE @q OR description LIKE @q OR services_text LIKE @q OR role_title LIKE @q OR tags LIKE @q)`;
      params.q = `%${q}%`;
    }
    if (roles && roles.length) {
      // Match a profile that has ANY of the requested role slugs.
      // roles is stored as a JSON array string, e.g. ["gp","deco"], so a
      // simple LIKE '%"gp"%' is enough given slugs never contain quotes.
      sql += ` AND (${roles.map((_, i) => `roles LIKE @role${i}`).join(' OR ')})`;
      roles.forEach((r, i) => {
        params[`role${i}`] = `%"${r}"%`;
      });
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
      .prepare(`SELECT ${LIST_COLUMNS} FROM profiles WHERE user_id = ? ORDER BY created_at DESC`)
      .all(userId);
    return rows.map(serializeRow);
  },

  // True if any order for this profile is paid or in progress (money may be
  // held in escrow), in which case the profile must not be deleted.
  hasActiveOrders(id) {
    const row = db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE profile_id = ? AND status IN ('paid', 'in_progress')`)
      .get(id);
    return row.n > 0;
  },

  remove(id) {
    return db.prepare('DELETE FROM profiles WHERE id = ?').run(id).changes > 0;
  },

  // `reason` is only kept for rejected profiles (shown to the owner).
  setStatus(id, status, reason) {
    db.prepare(
      `UPDATE profiles SET status = ?, reject_reason = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, status === 'rejected' && reason ? reason : null, id);
    return Profile.findById(id);
  },

  // Owner switch: REQ—ON (1) / REQ—OFF (0).
  setActive(id, active) {
    db.prepare(`UPDATE profiles SET is_active = ? WHERE id = ?`).run(active ? 1 : 0, id);
    return Profile.findById(id);
  },

  // Skill tier chosen by a moderator (null = not rated yet).
  setTier(id, tier) {
    db.prepare(`UPDATE profiles SET tier = ? WHERE id = ?`).run(tier || null, id);
    return Profile.findById(id);
  },

  countByUser(userId) {
    return db.prepare('SELECT COUNT(*) AS n FROM profiles WHERE user_id = ?').get(userId).n;
  },

  countPendingByUser(userId) {
    return db
      .prepare(`SELECT COUNT(*) AS n FROM profiles WHERE user_id = ? AND status = 'pending'`)
      .get(userId).n;
  },
};

module.exports = Profile;
