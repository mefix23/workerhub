// Small dependency-free validators. Keeps every field length-capped and
// type-checked before it ever reaches a SQL statement or gets rendered back
// to another user (helps prevent XSS payloads sitting unbounded in the DB).

const MAX_SHORT = 200;
const MAX_LONG = 4000;

function isNonEmptyString(v, max = MAX_SHORT) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function isOptionalString(v, max = MAX_SHORT) {
  return v === undefined || v === null || (typeof v === 'string' && v.length <= max);
}

function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= MAX_SHORT;
}

function isPositiveNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

function isStringArray(v, max = 30, itemMax = 100) {
  if (v === undefined || v === null) return true;
  return (
    Array.isArray(v) &&
    v.length <= max &&
    v.every((item) => typeof item === 'string' && item.length <= itemMax)
  );
}

function validateRegister(req, res, next) {
  const { username, email, password } = req.body || {};
  if (!isNonEmptyString(username, 40) || !/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-40 characters (letters, numbers, _ . -).' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  next();
}

function validateProfileCreate(req, res, next) {
  const b = req.body || {};
  if (!isNonEmptyString(b.name, 80)) {
    return res.status(400).json({ error: 'Name is required (max 80 characters).' });
  }
  if (!isNonEmptyString(b.roleTitle, 100)) {
    return res.status(400).json({ error: 'Role/profession is required (max 100 characters).' });
  }
  if (!isNonEmptyString(b.description, MAX_LONG)) {
    return res.status(400).json({ error: `Description is required (max ${MAX_LONG} characters).` });
  }
  if (!isNonEmptyString(b.contact, 200)) {
    return res.status(400).json({ error: 'Contact info is required.' });
  }
  if (!isPositiveNumber(b.price)) {
    return res.status(400).json({ error: 'Price must be a non-negative number.' });
  }
  if (!isOptionalString(b.avatarUrl, 500)) {
    return res.status(400).json({ error: 'Avatar URL is too long.' });
  }
  if (!isStringArray(b.services)) {
    return res.status(400).json({ error: 'Services must be a list of short strings.' });
  }
  if (!isStringArray(b.tags, 15, 30)) {
    return res.status(400).json({ error: 'Tags must be a list of short strings.' });
  }
  if (!isStringArray(b.portfolio, 15, 300)) {
    return res.status(400).json({ error: 'Portfolio must be a list of links.' });
  }
  next();
}

function validateOrderCreate(req, res, next) {
  const b = req.body || {};
  if (!Number.isInteger(Number(b.profileId))) {
    return res.status(400).json({ error: 'profileId is required.' });
  }
  if (!isNonEmptyString(b.serviceDescription, MAX_LONG)) {
    return res.status(400).json({ error: 'A description of the order is required.' });
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileCreate,
  validateOrderCreate,
};
