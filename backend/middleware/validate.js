const { ROLE_SLUGS } = require('../constants/roles');
const { ALL_TIERS } = require('../constants/collabTiers');

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

// Accepts numbers and numeric strings, including ones typed with a comma
// decimal separator (common on ru-RU keyboards), e.g. "500,50".
function isPositiveNumber(v) {
  if (typeof v === 'string') v = v.trim().replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

// Avatar: either a small image encoded as a data URL (uploaded from the
// create form and shrunk in the browser) or a plain http(s) link.
const MAX_AVATAR = 150000;
function isValidAvatar(v) {
  if (v === undefined || v === null || v === '') return true;
  if (typeof v !== 'string' || v.length > MAX_AVATAR) return false;
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return true;
  return v.length <= 500 && /^https?:\/\/\S+$/.test(v);
}

// Works gallery: 1-5 items, each a small photo (data URL) or a video link.
function isValidMedia(list) {
  if (!Array.isArray(list) || list.length < 1 || list.length > 5) return false;
  return list.every((m) => {
    if (!m || typeof m.url !== 'string') return false;
    if (m.type === 'image') {
      return m.url.length <= 320000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.url);
    }
    if (m.type === 'video') {
      return m.url.length <= 300 && /^https?:\/\/\S+$/.test(m.url);
    }
    return false;
  });
}

function isStringArray(v, max = 30, itemMax = 100) {
  if (v === undefined || v === null) return true;
  return (
    Array.isArray(v) &&
    v.length <= max &&
    v.every((item) => typeof item === 'string' && item.length <= itemMax)
  );
}

function isRoleArray(v) {
  return (
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= ROLE_SLUGS.length &&
    v.every((slug) => ROLE_SLUGS.includes(slug))
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

function trimmedLength(v) {
  return typeof v === 'string' ? v.trim().length : 0;
}

function validateProfileCreate(req, res, next) {
  const b = req.body || {};
  const bad = (error) => res.status(400).json({ error });

  const nameLen = trimmedLength(b.name);
  if (nameLen < 2 || nameLen > 80) {
    return bad('Имя / ник: от 2 до 80 символов.');
  }
  const titleLen = trimmedLength(b.title);
  if (titleLen < 3 || titleLen > 80) {
    return bad('Название анкеты: от 3 до 80 символов.');
  }
  if (!isRoleArray(b.roles)) {
    return bad('Выбери хотя бы одну роль.');
  }
  const services = typeof b.servicesText === 'string' ? b.servicesText.trim() : '';
  if (services.length < 30 || services.length > MAX_LONG) {
    return bad(`Услуги: опиши подробнее, от 30 до ${MAX_LONG} символов.`);
  }
  if (new Set(services.toLowerCase().replace(/\s/g, '')).size < 6) {
    return bad('Услуги выглядят как случайный набор символов. Напиши нормально.');
  }
  // "Описание" is optional.
  if (
    b.description !== undefined &&
    b.description !== null &&
    (typeof b.description !== 'string' || b.description.length > MAX_LONG)
  ) {
    return bad('Описание слишком длинное.');
  }
  if (!isValidMedia(b.media)) {
    return bad('Добавь от 1 до 5 фото или ссылок на видео с твоими работами.');
  }
  const contactLen = trimmedLength(b.contact);
  if (contactLen < 3 || contactLen > 200) {
    return bad('Укажи контакт (Telegram // discord), минимум 3 символа.');
  }
  if (b.price === undefined || b.price === null || String(b.price).trim() === '' || !isPositiveNumber(b.price)) {
    return bad('Укажи цену: число, 0 или больше.');
  }
  if (!isValidAvatar(b.avatarUrl)) {
    return res.status(400).json({ error: 'Некорректный аватар: нужна картинка PNG, JPG или WebP (не слишком большая).' });
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

function validateCollabCreate(req, res, next) {
  const b = req.body || {};
  if (!isNonEmptyString(b.title, 120)) {
    return res.status(400).json({ error: 'Title is required (max 120 characters).' });
  }
  if (!isNonEmptyString(b.description, MAX_LONG)) {
    return res.status(400).json({ error: `Description is required (max ${MAX_LONG} characters).` });
  }
  if (!Array.isArray(b.gpTiers) || !b.gpTiers.length) {
    return res.status(400).json({ error: 'At least one GP price tier is required.' });
  }
  for (const t of b.gpTiers) {
    if (![10, 25, 50, 75, 100].includes(Number(t.tierPercent)) || !isPositiveNumber(t.price)) {
      return res.status(400).json({ error: 'Invalid GP tier percent or price.' });
    }
  }
  if (b.decoTiers) {
    if (!Array.isArray(b.decoTiers)) {
      return res.status(400).json({ error: 'decoTiers must be a list.' });
    }
    for (const t of b.decoTiers) {
      if (![125, 150, 175, 200].includes(Number(t.tierPercent)) || !isPositiveNumber(t.price)) {
        return res.status(400).json({ error: 'Invalid Deco tier percent or price.' });
      }
    }
  }
  next();
}

function validateCollabPurchase(req, res, next) {
  const b = req.body || {};
  if (!ALL_TIERS.includes(Number(b.tierPercent))) {
    return res.status(400).json({ error: 'Invalid tier percent.' });
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileCreate,
  validateOrderCreate,
  validateCollabCreate,
  validateCollabPurchase,
};
