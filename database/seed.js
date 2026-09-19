require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

const demoUsers = [
  { username: 'mefix', email: 'mefix@example.com', password: 'password123' },
  { username: 'anna_design', email: 'anna@example.com', password: 'password123' },
  { username: 'devkirill', email: 'kirill@example.com', password: 'password123' },
  { username: 'photo_lena', email: 'lena@example.com', password: 'password123' },
  { username: 'buyer_demo', email: 'buyer@example.com', password: 'password123' },
];

const demoProfiles = [
  {
    owner: 'mefix',
    name: 'mefix',
    roleTitle: 'Графический дизайнер',
    description:
      'Делаю логотипы, айдентику и упаковку для небольших брендов. Работаю быстро, слушаю задачу, не насилую бриф лишними правками.',
    services: ['Логотип', 'Айдентика', 'Упаковка'],
    price: 500,
    contact: '@mefix_tg',
    tags: ['дизайн', 'логотип', 'брендинг'],
    portfolio: ['https://example.com/portfolio/mefix'],
  },
  {
    owner: 'anna_design',
    name: 'Anna K.',
    roleTitle: 'UI/UX дизайнер',
    description:
      'Проектирую интерфейсы для веб- и мобильных продуктов: от исследования до кликабельного прототипа в Figma.',
    services: ['UI-дизайн', 'UX-исследование', 'Прототип в Figma'],
    price: 3500,
    contact: 'anna.k@example.com',
    tags: ['ui', 'ux', 'figma'],
    portfolio: ['https://example.com/portfolio/anna'],
  },
  {
    owner: 'devkirill',
    name: 'Kirill Dev',
    roleTitle: 'Fullstack-разработчик',
    description:
      'Node.js, React, PostgreSQL. Делаю MVP под ключ: от архитектуры до деплоя. Есть опыт с платёжными интеграциями.',
    services: ['Backend на Node.js', 'Frontend на React', 'Деплой'],
    price: 8000,
    contact: '@devkirill',
    tags: ['разработка', 'node.js', 'react'],
    portfolio: ['https://github.com/example/devkirill'],
  },
  {
    owner: 'photo_lena',
    name: 'Lena Photo',
    roleTitle: 'Фотограф',
    description:
      'Предметная и портретная съёмка. Обработка в своём стиле, без пересвеченных фото и десяти фильтров подряд.',
    services: ['Предметная съёмка', 'Портретная съёмка', 'Ретушь'],
    price: 2000,
    contact: '@lena_photo',
    tags: ['фото', 'съёмка', 'ретушь'],
    portfolio: ['https://example.com/portfolio/lena'],
  },
];

function run() {
  const insertBalance = db.prepare(
    `INSERT OR IGNORE INTO balances (user_id, available_cents, pending_cents) VALUES (?, 0, 0)`
  );

  const userIds = {};
  for (const u of demoUsers) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (existing) {
      userIds[u.username] = existing.id;
      continue;
    }
    const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
    const info = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(u.username, u.email, hash);
    userIds[u.username] = info.lastInsertRowid;
    insertBalance.run(info.lastInsertRowid);
    console.log(`Created user ${u.username} (${u.email} / ${u.password})`);
  }

  for (const p of demoProfiles) {
    const userId = userIds[p.owner];
    const alreadyExists = db
      .prepare('SELECT id FROM profiles WHERE user_id = ? AND name = ?')
      .get(userId, p.name);
    if (alreadyExists) continue;

    db.prepare(
      `INSERT INTO profiles
        (user_id, name, avatar_url, role_title, description, services, price_cents, currency, contact, portfolio, tags, status)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'RUB', ?, ?, ?, 'approved')`
    ).run(
      userId,
      p.name,
      p.roleTitle,
      p.description,
      JSON.stringify(p.services),
      p.price * 100,
      p.contact,
      JSON.stringify(p.portfolio),
      JSON.stringify(p.tags)
    );
    console.log(`Created profile for ${p.name}`);
  }

  console.log('\nSeed complete. Demo accounts (email / password): ');
  demoUsers.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
}

run();
