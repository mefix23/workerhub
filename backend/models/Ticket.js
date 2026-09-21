const db = require('../config/db');

const Ticket = {
  create(userId, subject, body) {
    return db.transaction(() => {
      const info = db.prepare('INSERT INTO tickets (user_id, subject) VALUES (?, ?)').run(userId, subject);
      const id = Number(info.lastInsertRowid);
      db.prepare('INSERT INTO ticket_messages (ticket_id, author_id, is_staff, body) VALUES (?, ?, 0, ?)').run(
        id,
        userId,
        body
      );
      return id;
    })();
  },

  findById(id) {
    return db
      .prepare(
        `SELECT t.*, u.username FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.id = ?`
      )
      .get(id);
  },

  // Extra columns: number of messages and whether the last word is the user's
  // (= the ticket is waiting for staff).
  _listSql(where) {
    return `SELECT t.id, t.subject, t.status, t.created_at, t.updated_at, t.user_id, u.username,
              (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS messages_count,
              CASE WHEN t.status = 'open' AND
                        (SELECT is_staff FROM ticket_messages m WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) = 0
                   THEN 1 ELSE 0 END AS awaiting_staff
            FROM tickets t JOIN users u ON u.id = t.user_id
            ${where}
            ORDER BY t.updated_at DESC, t.id DESC LIMIT 200`;
  },

  listByUser(userId) {
    return db.prepare(Ticket._listSql('WHERE t.user_id = ?')).all(userId);
  },

  listAll(status) {
    if (status === 'open' || status === 'closed') {
      return db.prepare(Ticket._listSql('WHERE t.status = ?')).all(status);
    }
    return db.prepare(Ticket._listSql('')).all();
  },

  openCountByUser(userId) {
    return db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND status = 'open'`).get(userId).n;
  },

  messages(ticketId) {
    return db
      .prepare(
        `SELECT m.id, m.body, m.is_staff, m.created_at, m.author_id, u.username AS author_name
         FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id
         WHERE m.ticket_id = ? ORDER BY m.id ASC`
      )
      .all(ticketId);
  },

  messageCount(ticketId) {
    return db.prepare('SELECT COUNT(*) AS n FROM ticket_messages WHERE ticket_id = ?').get(ticketId).n;
  },

  addMessage(ticketId, authorId, isStaff, body) {
    db.transaction(() => {
      db.prepare('INSERT INTO ticket_messages (ticket_id, author_id, is_staff, body) VALUES (?, ?, ?, ?)').run(
        ticketId,
        authorId,
        isStaff ? 1 : 0,
        body
      );
      db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).run(ticketId);
    })();
  },

  setStatus(id, status) {
    db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
  },
};

module.exports = Ticket;
