const Chat = require('../models/Chat');
const User = require('../models/User');

function list(req, res, next) {
  try {
    const conversations = Chat.listForUser(req.user.id);
    const unread_total = Chat.unreadTotal(req.user.id);
    res.json({ conversations, unread_total });
  } catch (err) {
    next(err);
  }
}

// Start or open a conversation with another user by id.
function openWith(req, res, next) {
  try {
    const otherId = Number(req.body && req.body.userId);
    if (!Number.isInteger(otherId) || otherId < 1) {
      return res.status(400).json({ error: 'userId обязателен.' });
    }
    const other = User.findById(otherId);
    if (!other) return res.status(404).json({ error: 'Пользователь не найден.' });
    if (other.is_blocked) {
      return res.status(403).json({ error: 'Этот пользователь заблокирован.' });
    }

    const conv = Chat.getOrCreate(req.user.id, otherId);
    const messages = Chat.messages(conv.id);
    Chat.markRead(conv.id, req.user.id);

    res.json({
      conversation: {
        id: conv.id,
        peer_id: otherId,
        peer_name: other.username,
        updated_at: conv.updated_at,
      },
      messages,
    });
  } catch (err) {
    next(err);
  }
}

function getMessages(req, res, next) {
  try {
    const conv = Chat.findById(req.params.id);
    if (!Chat.isParticipant(conv, req.user.id)) {
      return res.status(404).json({ error: 'Чат не найден.' });
    }
    const afterId = Number(req.query.after) || 0;
    const messages = Chat.messages(conv.id, 100, afterId);
    if (!afterId) Chat.markRead(conv.id, req.user.id);

    const peerId = conv.user_a === req.user.id ? conv.user_b : conv.user_a;
    const peer = User.findById(peerId);

    res.json({
      conversation: {
        id: conv.id,
        peer_id: peerId,
        peer_name: peer ? peer.username : '?',
        updated_at: conv.updated_at,
      },
      messages,
    });
  } catch (err) {
    next(err);
  }
}

function send(req, res, next) {
  try {
    const conv = Chat.findById(req.params.id);
    if (!Chat.isParticipant(conv, req.user.id)) {
      return res.status(404).json({ error: 'Чат не найден.' });
    }
    const message = Chat.send(conv.id, req.user.id, req.body && req.body.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

function unread(req, res, next) {
  try {
    res.json({ unread_total: Chat.unreadTotal(req.user.id) });
  } catch (err) {
    next(err);
  }
}


function lobbyGet(req, res, next) {
  try {
    const afterId = Number(req.query.after) || 0;
    const messages = Chat.lobbyList(80, afterId);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

function lobbySend(req, res, next) {
  try {
    const message = Chat.lobbySend(req.user.id, req.body && req.body.body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, openWith, getMessages, send, unread, lobbyGet, lobbySend };

