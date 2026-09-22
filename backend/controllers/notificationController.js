const Notification = require('../models/Notification');

function list(req, res, next) {
  try {
    const notifications = Notification.listForUser(req.user.id);
    const unread = Notification.unreadCount(req.user.id);
    res.json({ notifications, unread });
  } catch (err) {
    next(err);
  }
}

function unread(req, res, next) {
  try {
    res.json({ unread: Notification.unreadCount(req.user.id) });
  } catch (err) {
    next(err);
  }
}

function markRead(req, res, next) {
  try {
    const ids = req.body && Array.isArray(req.body.ids) ? req.body.ids : null;
    Notification.markRead(req.user.id, ids);
    res.json({ ok: true, unread: Notification.unreadCount(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, unread, markRead };
