const express = require('express');
const { list, openWith, getMessages, send, unread } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/unread', requireAuth, unread);
router.post('/open', requireAuth, openWith);
router.get('/:id', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, send);

module.exports = router;
