const express = require('express');
const { listUsers, setBlocked } = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/', listUsers);
router.patch('/:id/block', setBlocked);

module.exports = router;
