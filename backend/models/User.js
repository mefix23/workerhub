const db = require('../config/db');

const PUBLIC_FIELDS = 'id, username, email, role, is_blocked, is_moderator, coins, created_at';

const User = {
  create({ username, email, passwordHash }) {
    const stmt = db.prepare(
      `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`
    );
    const info = stmt.run(username, email, passwordHash);
    return User.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`).get(id);
  },

  findByEmailWithPassword(email) {
    return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  },

  findByUsername(username) {
    return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE username = ?`).get(username);
  },

  emailExists(email) {
    return !!db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email);
  },

  usernameExists(username) {
    return !!db.prepare(`SELECT 1 FROM users WHERE username = ?`).get(username);
  },

  setModerator(id, isModerator) {
    db.prepare(`UPDATE users SET is_moderator = ? WHERE id = ?`).run(isModerator ? 1 : 0, id);
    return User.findById(id);
  },

  makeAdmin(id) {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(id);
    return User.findById(id);
  },

  setBlocked(id, isBlocked) {
    db.prepare(`UPDATE users SET is_blocked = ? WHERE id = ?`).run(isBlocked ? 1 : 0, id);
    return User.findById(id);
  },
};

module.exports = User;
