const express = require('express');
const {
  create,
  getById,
  listMine,
  pay,
  start,
  complete,
  cancel,
  getBalance,
  requestWithdrawal,
  listWithdrawals,
} = require('../controllers/orderController');
const { validateOrderCreate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', listMine);
router.post('/', validateOrderCreate, create);
router.get('/balance', getBalance);
router.get('/withdrawals', listWithdrawals);
router.post('/withdrawals', requestWithdrawal);

router.get('/:id', getById);
router.post('/:id/pay', pay);
router.post('/:id/start', start);
router.post('/:id/complete', complete);
router.post('/:id/cancel', cancel);

module.exports = router;
