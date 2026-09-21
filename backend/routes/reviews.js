const express = require('express');
const { remove } = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.delete('/:id', requireAuth, remove);

module.exports = router;
