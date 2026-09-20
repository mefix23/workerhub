const express = require('express');
const {
  create,
  list,
  getById,
  mine,
  attachDeco,
  purchase,
  myPurchases,
} = require('../controllers/collabController');
const { validateCollabCreate, validateCollabPurchase } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', list);
router.get('/mine', requireAuth, mine);
router.get('/purchases', requireAuth, myPurchases);
router.get('/:id', getById);
router.post('/', requireAuth, validateCollabCreate, create);
router.post('/:id/deco', requireAuth, attachDeco);
router.post('/:id/purchase', requireAuth, validateCollabPurchase, purchase);

module.exports = router;
