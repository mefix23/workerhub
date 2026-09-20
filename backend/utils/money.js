// All money is stored and passed around the server as an integer number of
// minor currency units (e.g. kopecks). Never use floats for money.

function toCents(majorUnitsValue) {
  const n = Number(majorUnitsValue);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function centsToMajor(cents) {
  return Math.round(cents) / 100;
}

module.exports = { toCents, centsToMajor };
