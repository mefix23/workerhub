// Skill tiers moderators can give to a profile (lowest -> highest).
const TIERS = [
  { slug: 'low', label: 'Низкий' },
  { slug: 'below_avg', label: 'Ниже среднего' },
  { slug: 'avg', label: 'Средний' },
  { slug: 'above_avg', label: 'Выше среднего' },
  { slug: 'high', label: 'Высокий' },
  { slug: 'excellent', label: 'Отличный' },
];

const TIER_SLUGS = TIERS.map((t) => t.slug);

function tierLabel(slug) {
  const t = TIERS.find((x) => x.slug === slug);
  return t ? t.label : null;
}

module.exports = { TIERS, TIER_SLUGS, tierLabel };
