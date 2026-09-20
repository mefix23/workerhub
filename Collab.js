const db = require('../config/db');

function serializeCollab(row, tiers = []) {
  if (!row) return row;
  return {
    ...row,
    gp_tiers: tiers.filter((t) => t.kind === 'gp'),
    deco_tiers: tiers.filter((t) => t.kind === 'deco'),
  };
}

const Collab = {
  create({ creatorId, title, description, gpTiers }) {
    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO collabs (creator_id, title, description, gp_percent, deco_percent, status)
           VALUES (?, ?, ?, 0, 0, 'gp_in_progress')`
        )
        .run(creatorId, title, description);
      const collabId = info.lastInsertRowid;

      const insertTier = db.prepare(
        `INSERT INTO collab_tiers (collab_id, tier_percent, kind, price_cents, is_available)
         VALUES (?, ?, 'gp', ?, 1)`
      );
      for (const t of gpTiers) {
        insertTier.run(collabId, t.tierPercent, t.priceCents);
      }
      return collabId;
    });

    const id = tx();
    return Collab.findById(id);
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM collabs WHERE id = ?').get(id);
    if (!row) return null;
    const tiers = db.prepare('SELECT * FROM collab_tiers WHERE collab_id = ? ORDER BY tier_percent').all(id);
    return serializeCollab(row, tiers);
  },

  list({ status, limit = 60, offset = 0 } = {}) {
    let sql = `SELECT * FROM collabs`;
    const params = {};
    if (status) {
      sql += ` WHERE status = @status`;
      params.status = status;
    }
    sql += ` ORDER BY created_at DESC LIMIT @limit OFFSET @offset`;
    params.limit = limit;
    params.offset = offset;

    const rows = db.prepare(sql).all(params);
    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const allTiers = db
      .prepare(`SELECT * FROM collab_tiers WHERE collab_id IN (${placeholders})`)
      .all(...ids);

    return rows.map((row) =>
      serializeCollab(
        row,
        allTiers.filter((t) => t.collab_id === row.id)
      )
    );
  },

  listByCreator(userId) {
    const rows = db
      .prepare('SELECT * FROM collabs WHERE creator_id = ? OR decorator_id = ? ORDER BY created_at DESC')
      .all(userId, userId);
    return rows.map((row) => Collab.findById(row.id));
  },

  // A decorator attaches deco pricing tiers once the GP part is 100% complete.
  attachDecoTiers({ collabId, decoratorId, decoTiers }) {
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE collabs SET decorator_id = ?, status = 'deco_in_progress', updated_at = datetime('now') WHERE id = ?`
      ).run(decoratorId, collabId);

      const insertTier = db.prepare(
        `INSERT INTO collab_tiers (collab_id, tier_percent, kind, price_cents, is_available)
         VALUES (?, ?, 'deco', ?, 1)`
      );
      for (const t of decoTiers) {
        insertTier.run(collabId, t.tierPercent, t.priceCents);
      }
    });
    tx();
    return Collab.findById(collabId);
  },

  // Move the collab's GP/deco completion forward. Called after a purchase so
  // the listing reflects the highest tier reached so far.
  bumpProgress(collabId, tierPercent) {
    const collab = db.prepare('SELECT * FROM collabs WHERE id = ?').get(collabId);
    if (!collab) return null;

    let gp = collab.gp_percent;
    let deco = collab.deco_percent;
    let status = collab.status;

    if (tierPercent <= 100) {
      gp = Math.max(gp, tierPercent);
      status = gp >= 100 ? 'gp_complete' : 'gp_in_progress';
    } else {
      deco = Math.max(deco, tierPercent - 100);
      status = deco >= 100 ? 'complete' : 'deco_in_progress';
    }

    db.prepare(
      `UPDATE collabs SET gp_percent = ?, deco_percent = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(gp, deco, status, collabId);

    return Collab.findById(collabId);
  },

  getTier(collabId, tierPercent) {
    return db
      .prepare('SELECT * FROM collab_tiers WHERE collab_id = ? AND tier_percent = ?')
      .get(collabId, tierPercent);
  },

  recordPurchase({ collabId, tierPercent, buyerId, sellerId, priceCents }) {
    const info = db
      .prepare(
        `INSERT INTO collab_purchases (collab_id, tier_percent, buyer_id, seller_id, price_cents, status)
         VALUES (?, ?, ?, ?, ?, 'paid')`
      )
      .run(collabId, tierPercent, buyerId, sellerId, priceCents);
    return db.prepare('SELECT * FROM collab_purchases WHERE id = ?').get(info.lastInsertRowid);
  },

  purchasesForUser(userId) {
    return db
      .prepare(
        `SELECT * FROM collab_purchases WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC`
      )
      .all(userId, userId);
  },

  purchasesForCollab(collabId) {
    return db
      .prepare('SELECT * FROM collab_purchases WHERE collab_id = ? ORDER BY created_at DESC')
      .all(collabId);
  },
};

module.exports = Collab;
