const db = require('../config/db');

function serialize(row, viewerId) {
  if (!row) return null;
  const liked = viewerId
    ? !!db
        .prepare('SELECT 1 FROM work_likes WHERE work_id = ? AND user_id = ?')
        .get(row.id, viewerId)
    : false;
  const likes = db.prepare('SELECT COUNT(*) AS n FROM work_likes WHERE work_id = ?').get(row.id).n;
  const comments = db
    .prepare('SELECT COUNT(*) AS n FROM work_comments WHERE work_id = ?')
    .get(row.id).n;
  return {
    id: row.id,
    user_id: row.user_id,
    caption: row.caption || '',
    video_url: row.video_url,
    source: row.source,
    mime: row.mime,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    author_name: row.author_name || null,
    likes_count: likes,
    comments_count: comments,
    liked_by_me: liked,
  };
}

const Work = {
  create({ userId, caption, videoUrl, source, mime, sizeBytes }) {
    const info = db
      .prepare(
        `INSERT INTO works (user_id, caption, video_url, source, mime, size_bytes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, caption || '', videoUrl, source || 'upload', mime || null, sizeBytes || null);
    return Work.findById(info.lastInsertRowid, userId);
  },

  findById(id, viewerId) {
    const row = db
      .prepare(
        `SELECT w.*, u.username AS author_name
         FROM works w JOIN users u ON u.id = w.user_id
         WHERE w.id = ?`
      )
      .get(id);
    return serialize(row, viewerId);
  },

  // Feed: newest first
  feed({ limit = 20, offset = 0, viewerId } = {}) {
    const rows = db
      .prepare(
        `SELECT w.*, u.username AS author_name
         FROM works w JOIN users u ON u.id = w.user_id
         ORDER BY w.created_at DESC, w.id DESC
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset);
    return rows.map((r) => serialize(r, viewerId));
  },

  listByUser(userId, viewerId) {
    const rows = db
      .prepare(
        `SELECT w.*, u.username AS author_name
         FROM works w JOIN users u ON u.id = w.user_id
         WHERE w.user_id = ?
         ORDER BY w.created_at DESC, w.id DESC`
      )
      .all(userId);
    return rows.map((r) => serialize(r, viewerId));
  },

  remove(id, userId) {
    const row = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
    if (!row) return null;
    if (row.user_id !== userId) return false;
    db.prepare('DELETE FROM works WHERE id = ?').run(id);
    return row;
  },

  toggleLike(workId, userId) {
    const existing = db
      .prepare('SELECT 1 FROM work_likes WHERE work_id = ? AND user_id = ?')
      .get(workId, userId);
    if (existing) {
      db.prepare('DELETE FROM work_likes WHERE work_id = ? AND user_id = ?').run(workId, userId);
      return { liked: false };
    }
    db.prepare('INSERT INTO work_likes (work_id, user_id) VALUES (?, ?)').run(workId, userId);
    return { liked: true };
  },

  listComments(workId, limit = 50) {
    return db
      .prepare(
        `SELECT c.id, c.work_id, c.user_id, c.body, c.created_at, u.username AS author_name
         FROM work_comments c JOIN users u ON u.id = c.user_id
         WHERE c.work_id = ?
         ORDER BY c.id ASC
         LIMIT ?`
      )
      .all(workId, limit);
  },

  addComment(workId, userId, body) {
    const text = String(body || '').trim();
    if (text.length < 1 || text.length > 500) {
      const err = new Error('Комментарий: от 1 до 500 символов.');
      err.status = 400;
      throw err;
    }
    const info = db
      .prepare('INSERT INTO work_comments (work_id, user_id, body) VALUES (?, ?, ?)')
      .run(workId, userId, text);
    return db
      .prepare(
        `SELECT c.id, c.work_id, c.user_id, c.body, c.created_at, u.username AS author_name
         FROM work_comments c JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .get(info.lastInsertRowid);
  },
};

module.exports = Work;
