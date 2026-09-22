const express = require('express');
const {
  list,
  getById,
  create,
  update,
  remove,
  setActive,
  setAppearance,
  toggleFavorite,
  myFavorites,
  createRequest,
  listRequests,
  myProfiles,
} = require('../controllers/profileController');
const { listForProfile, create: createReview } = require('../controllers/reviewController');
const { validateProfileCreate } = require('../middleware/validate');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', list);
router.get('/mine', requireAuth, myProfiles);
router.get('/favorites/mine', requireAuth, myFavorites);
router.get('/:id', optionalAuth, getById);
router.post('/', requireAuth, validateProfileCreate, create);
router.put('/:id', requireAuth, validateProfileCreate, update);
router.patch('/:id/active', requireAuth, setActive);
router.patch('/:id/appearance', requireAuth, setAppearance);
router.post('/:id/favorite', requireAuth, toggleFavorite);
router.post('/:id/requests', requireAuth, createRequest);
router.get('/:id/requests', requireAuth, listRequests);
router.get('/:id/reviews', optionalAuth, listForProfile);
router.post('/:id/reviews', requireAuth, createReview);
router.delete('/:id', requireAuth, remove);

module.exports = router;
