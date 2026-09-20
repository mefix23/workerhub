const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  listUsers,
  setBlocked,
  setModerator,
  claimAdmin,
  warnUser,
  removeLastWarning,
  getPublic,
} = require('../controllers/userController');
const { requireAuth, optionalAuth, requireAdmin, requireStaff } = require('../middleware/auth');

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
router.post('/:id/warn', requireAuth, requireStaff, warnUser);
router.delete('/:id/warnings/last', requireAuth, requireAdmin, removeLastWarning);
router.get('/:id/public', optionalAuth, getPublic);

module.exports = router;
