const db = require('../config/db');

const ProfileRequest = {
  create(profileId, buyerId, message) {
    const info = db
      .prepare('INSERT INTO profile_requests (profile_id, buyer_id, message) VALUES (?, ?, ?)')
      .run(profileId, buyerId, message);
    return ProfileRequest.findById(info.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM profile_requests WHERE id = ?').get(id);
  },

  existsFor(profileId, buyerId) {
    return !!db
      .prepare('SELECT 1 FROM profile_requests WHERE profile_id = ? AND buyer_id = ?')
      .get(profileId, buyerId);
  },

  // Requests received on a profile, for its owner.
  listForProfile(profileId) {
    return db
      .prepare(
        `SELECT r.id, r.message, r.status, r.created_at, r.buyer_id, u.username AS buyer_name
         FROM profile_requests r JOIN users u ON u.id = r.buyer_id
         WHERE r.profile_id = ? ORDER BY r.id DESC`
      )
      .all(profileId);
  },

  markSeen(profileId) {
    db.prepare(`UPDATE profile_requests SET status = 'seen' WHERE profile_id = ? AND status = 'new'`).run(profileId);
  },

  newCountForOwner(userId) {
    return db
      .prepare(
        `SELECT COUNT(*) AS n FROM profile_requests r
         JOIN profiles p ON p.id = r.profile_id
         WHERE p.user_id = ? AND r.status = 'new'`
      )
      .get(userId).n;
  },
};

module.exports = ProfileRequest;
