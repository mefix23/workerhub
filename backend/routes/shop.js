const express = require('express');
const { overview, buy, daily } = require('../controllers/shopController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, overview);
router.post('/buy', requireAuth, buy);
router.post('/daily', requireAuth, daily);

module.exports = router;
