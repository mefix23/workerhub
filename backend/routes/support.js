const express = require('express');
const {
  createTicket,
  myTickets,
  allTickets,
  getTicket,
  addMessage,
  setStatus,
} = require('../controllers/supportController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/tickets', myTickets);
router.post('/tickets', createTicket);
router.get('/admin/tickets', requireStaff, allTickets); // before "/tickets/:id"
router.get('/tickets/:id', getTicket);
router.post('/tickets/:id/messages', addMessage);
router.patch('/tickets/:id/status', setStatus);

module.exports = router;
