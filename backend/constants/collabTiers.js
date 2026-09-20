// A "collab" is a Geometry Dash-style collaboration part that a GP'er builds
// and sells access/rights to at increasing stages of completion. Once the GP
// part reaches 100%, a decorator can add decoration on top, pushing the
// total completion (and price tiers) past 100%.
//
// GP_TIERS: completion of the raw gameplay part (0-100).
// DECO_TIERS: completion of decoration layered on top of a finished (100%) GP
// part. Displayed/stored as 125/150/175/200 to represent "100% GP + decoration".

const GP_TIERS = [10, 25, 50, 75, 100];
const DECO_TIERS = [125, 150, 175, 200];
const ALL_TIERS = [...GP_TIERS, ...DECO_TIERS];

function tierKind(tier) {
  return GP_TIERS.includes(tier) ? 'gp' : DECO_TIERS.includes(tier) ? 'deco' : null;
}

function isValidTier(tier) {
  return ALL_TIERS.includes(tier);
}

module.exports = { GP_TIERS, DECO_TIERS, ALL_TIERS, tierKind, isValidTier };
