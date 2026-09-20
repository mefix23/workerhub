const express = require('express');
const rateLimit = require('express-rate-limit');
const { listUsers, setBlocked, setModerator, claimAdmin } = require('../controllers/userController');
const { requireAuth, requireAdmin, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Slows down guessing of the admin setup key.
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/claim-admin', requireAuth, claimLimiter, claimAdmin);

router.get('/', requireAuth, requireStaff, listUsers);
router.patch('/:id/block', requireAuth, requireStaff, setBlocked);
router.patch('/:id/moderator', requireAuth, requireAdmin, setModerator);

module.exports = router;
