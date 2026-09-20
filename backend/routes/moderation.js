const express = require('express');
const { listProfiles, setProfileStatus, deleteProfile } = require('../controllers/moderationController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireStaff);

router.get('/profiles', listProfiles);
router.patch('/profiles/:id/status', setProfileStatus);
router.delete('/profiles/:id', deleteProfile);

module.exports = router;
