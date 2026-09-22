const express = require('express');
const { list, unread, markRead } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, list);
router.get('/unread', requireAuth, unread);
router.post('/read', requireAuth, markRead);

module.exports = router;
