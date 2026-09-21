const express = require('express');
const {
  listQueue,
  listProfiles,
  setProfileStatus,
  setProfileTier,
  deleteProfile,
  listReviews,
  setReviewStatus,
} = require('../controllers/moderationController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireStaff);

router.get('/queue', listQueue);
router.get('/profiles', listProfiles);
router.patch('/profiles/:id/status', setProfileStatus);
router.patch('/profiles/:id/tier', setProfileTier);
router.get('/reviews', listReviews);
router.patch('/reviews/:id/status', setReviewStatus);
router.delete('/profiles/:id', deleteProfile);

module.exports = router;
