// Single source of truth for creator roles used across the whole app.
// `slug` is what's stored in the database and sent over the API.
// `label` is what's shown to users. Never hardcode either one elsewhere —
// import ROLES / ROLE_SLUGS / ROLE_LABEL_BY_SLUG instead, so frontend,
// backend and database always agree on the same values.

const ROLES = [
  { slug: 'gp', label: 'GP' },
  { slug: 'deco', label: 'Deco' },
  { slug: 'host', label: 'Host' },
  { slug: 'playtest', label: 'Play test' },
  { slug: 'music_maker', label: 'Music maker' },
];

const ROLE_SLUGS = ROLES.map((r) => r.slug);

const ROLE_LABEL_BY_SLUG = ROLES.reduce((acc, r) => {
  acc[r.slug] = r.label;
  return acc;
}, {});

function isValidRoleSlug(slug) {
  return ROLE_SLUGS.includes(slug);
}

function labelsForSlugs(slugs) {
  return (slugs || []).map((s) => ROLE_LABEL_BY_SLUG[s] || s);
}

module.exports = { ROLES, ROLE_SLUGS, ROLE_LABEL_BY_SLUG, isValidRoleSlug, labelsForSlugs };
