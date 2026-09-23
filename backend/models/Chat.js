const db = require('../config/db');

function pairIds(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? [x, y] : [y, x];
}

const Chat = {
  // Find existing conversation between two users, or create one.
  getOrCreate(userId, otherId) {
    if (Number(userId) === Number(otherId)) {
      const err = new Error('Нельзя начать чат с самим собой.');
      err.status = 400;
      throw err;
    }
    const [a, b] = pairIds(userId, otherId);
    let row = db
      .prepare('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?')
      .get(a, b);
    if (!row) {
      const info = db
        .prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)')
        .run(a, b);
      row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
    }
    return row;
  },

  findById(id) {
    return db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  },

  // List conversations for a user with peer info + last message + unread count.
  listForUser(userId) {
    const rows = db
      .prepare(
        `SELECT c.id, c.updated_at,
                CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END AS peer_id,
                u.username AS peer_name,
                (SELECT body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
                (SELECT created_at FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_at,
                (SELECT COUNT(*) FROM chat_messages m
                  WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0) AS unread
         FROM conversations c
         JOIN users u ON u.id = CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END
         WHERE c.user_a = ? OR c.user_b = ?
         ORDER BY c.updated_at DESC`
      )
      .all(userId, userId, userId, userId, userId);
    return rows;
  },

  isParticipant(conv, userId) {
    return conv && (conv.user_a === userId || conv.user_b === userId);
  },

  messages(conversationId, limit = 100, afterId = 0) {
    if (afterId) {
      return db
        .prepare(
          `SELECT m.id, m.sender_id, m.body, m.is_read, m.created_at, u.username AS sender_name
           FROM chat_messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.conversation_id = ? AND m.id > ?
           ORDER BY m.id ASC
           LIMIT ?`
        )
        .all(conversationId, afterId, limit);
    }
    return db
      .prepare(
        `SELECT m.id, m.sender_id, m.body, m.is_read, m.created_at, u.username AS sender_name
         FROM chat_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.conversation_id = ?
         ORDER BY m.id DESC
         LIMIT ?`
      )
      .all(conversationId, limit)
      .reverse();
  },

  send(conversationId, senderId, body) {
    const text = String(body || '').trim();
    if (text.length < 1 || text.length > 2000) {
      const err = new Error('Сообщение: от 1 до 2000 символов.');
      err.status = 400;
      throw err;
    }
    return db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO chat_messages (conversation_id, sender_id, body) VALUES (?, ?, ?)'
        )
        .run(conversationId, senderId, text);
      db.prepare(
        `UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`
      ).run(conversationId);
      return db
        .prepare(
          `SELECT m.id, m.sender_id, m.body, m.is_read, m.created_at, u.username AS sender_name
           FROM chat_messages m JOIN users u ON u.id = m.sender_id
           WHERE m.id = ?`
        )
        .get(info.lastInsertRowid);
    })();
  },

  markRead(conversationId, readerId) {
    db.prepare(
      `UPDATE chat_messages SET is_read = 1
       WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`
    ).run(conversationId, readerId);
  },

  unreadTotal(userId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS n FROM chat_messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE (c.user_a = ? OR c.user_b = ?)
           AND m.sender_id != ?
           AND m.is_read = 0`
      )
      .get(userId, userId, userId);
    return row ? row.n : 0;
  },
};


// ---- Global lobby (one room for all users) ----
Chat.lobbyList = function (limit = 80, afterId = 0) {
  if (afterId) {
    return db
      .prepare(
        `SELECT m.id, m.user_id, m.body, m.created_at, u.username AS author_name
         FROM lobby_messages m JOIN users u ON u.id = m.user_id
         WHERE m.id > ?
         ORDER BY m.id ASC
         LIMIT ?`
      )
      .all(afterId, limit);
  }
  return db
    .prepare(
      `SELECT m.id, m.user_id, m.body, m.created_at, u.username AS author_name
       FROM lobby_messages m JOIN users u ON u.id = m.user_id
       ORDER BY m.id DESC
       LIMIT ?`
    )
    .all(limit)
    .reverse();
};

Chat.lobbySend = function (userId, body) {
  const text = String(body || '').trim();
  if (text.length < 1 || text.length > 500) {
    const err = new Error('Сообщение: от 1 до 500 символов.');
    err.status = 400;
    throw err;
  }
  const info = db
    .prepare('INSERT INTO lobby_messages (user_id, body) VALUES (?, ?)')
    .run(userId, text);
  return db
    .prepare(
      `SELECT m.id, m.user_id, m.body, m.created_at, u.username AS author_name
       FROM lobby_messages m JOIN users u ON u.id = m.user_id
       WHERE m.id = ?`
    )
    .get(info.lastInsertRowid);
};

module.exports = Chat;
