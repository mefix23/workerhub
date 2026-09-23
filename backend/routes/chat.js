const express = require('express');
const {
  list,
  openWith,
  getMessages,
  send,
  unread,
  lobbyGet,
  lobbySend,
} = require('../controllers/chatController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/lobby', optionalAuth, lobbyGet);
router.post('/lobby', requireAuth, lobbySend);

router.get('/', requireAuth, list);
router.get('/unread', requireAuth, unread);
router.post('/open', requireAuth, openWith);
router.get('/:id', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, send);

module.exports = router;
