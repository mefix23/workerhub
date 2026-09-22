const db = require('../config/db');

const Notification = {
  create({ userId, type, actorId, workId, body }) {
    // Don't notify yourself
    if (actorId && Number(actorId) === Number(userId)) return null;
    const info = db
      .prepare(
        `INSERT INTO notifications (user_id, type, actor_id, work_id, body)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(userId, type, actorId || null, workId || null, body);
    return Notification.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db
      .prepare(
        `SELECT n.*, u.username AS actor_name
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.id = ?`
      )
      .get(id);
  },

  listForUser(userId, limit = 40) {
    return db
      .prepare(
        `SELECT n.*, u.username AS actor_name
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.user_id = ?
         ORDER BY n.id DESC
         LIMIT ?`
      )
      .all(userId, limit);
  },

  unreadCount(userId) {
    return db
      .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(userId).n;
  },

  markRead(userId, ids) {
    if (!ids || !ids.length) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(
        userId
      );
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`
    ).run(userId, ...ids.map(Number));
  },
};

module.exports = Notification;
