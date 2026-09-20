const express = require('express');
const { list, getById, create, update, remove, myProfiles } = require('../controllers/profileController');
const { validateProfileCreate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', list);
router.get('/mine', requireAuth, myProfiles);
router.get('/:id', optionalAuth, getById);
router.post('/', requireAuth, validateProfileCreate, create);
router.put('/:id', requireAuth, validateProfileCreate, update);
router.delete('/:id', requireAuth, remove);

module.exports = router;
