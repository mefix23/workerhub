const express = require('express');
const { ROLES } = require('../constants/roles');
const { GP_TIERS, DECO_TIERS } = require('../constants/collabTiers');

const router = express.Router();

router.get('/roles', (req, res) => {
  res.json({ roles: ROLES });
});

router.get('/collab-tiers', (req, res) => {
  res.json({ gpTiers: GP_TIERS, decoTiers: DECO_TIERS });
});

module.exports = router;
