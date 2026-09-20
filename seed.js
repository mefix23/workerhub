require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');
const Collab = require('../backend/models/Collab');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;

const demoUsers = [
  { username: 'mefix', email: 'mefix@example.com', password: 'password123' },
  { username: 'anna_deco', email: 'anna@example.com', password: 'password123' },
  { username: 'devkirill', email: 'kirill@example.com', password: 'password123' },
  { username: 'lena_host', email: 'lena@example.com', password: 'password123' },
  { username: 'nick_music', email: 'nick@example.com', password: 'password123' },
  { username: 'buyer_demo', email: 'buyer@example.com', password: 'password123' },
];

// Geometry Dash-community themed demo profiles, one per role (mefix has two).
const demoProfiles = [
  {
    owner: 'mefix',
    name: 'mefix',
    roles: ['gp'],
    description:
      'Делаю геймплейные парты для коллабов: cube/ship/wave секции, таймингованные под музыку. Быстро, аккуратно, без затянутых правок.',
    services: ['GP-парт', 'Таймингование под музыку', 'Базовая структура уровня'],
    price: 500,
    contact: '@mefix_tg',
    tags: ['gp', 'gameplay', 'geometry dash'],
    portfolio: ['https://example.com/portfolio/mefix'],
  },
  {
    owner: 'mefix',
    name: 'mefix (playtest)',
    roles: ['playtest'],
    description:
      'Проверяю склеенный GP+deco на баги, секретные способы и читерские пути. Подробный отчёт с таймкодами.',
    services: ['Баг-тест', 'Поиск секретных путей', 'Отчёт с таймкодами'],
    price: 150,
    contact: '@mefix_tg',
    tags: ['playtest', 'qa'],
    portfolio: [],
  },
  {
    owner: 'anna_deco',
    name: 'Anna Deco',
    roles: ['deco'],
    description:
      'Декорирую GP-парты: 3D-блоки, свет, партиклы. Работаю поверх чужого геймплея, не ломая его структуру.',
    services: ['3D-деко', 'Свет и партиклы', 'Цветовая палитра под стиль'],
    price: 700,
    contact: 'anna.deco@example.com',
    tags: ['deco', 'decoration'],
    portfolio: ['https://example.com/portfolio/anna'],
  },
  {
    owner: 'devkirill',
    name: 'Kirill',
    roles: ['gp', 'deco'],
    description:
      'Делаю и геймплей, и деко — можно заказать парт под ключ, без стыковки двух разных стилей.',
    services: ['GP под ключ', 'Деко под ключ', 'Полный парт'],
    price: 1200,
    contact: '@devkirill',
    tags: ['gp', 'deco', 'full part'],
    portfolio: ['https://github.com/example/devkirill'],
  },
  {
    owner: 'lena_host',
    name: 'Lena',
    roles: ['host'],
    description:
      'Хостю коллабы: собираю состав, слежу за дедлайнами, свожу финальный уровень. Опыт — 6 успешных коллабов.',
    services: ['Сборка состава', 'Контроль дедлайнов', 'Финальная сборка уровня'],
    price: 0,
    contact: '@lena_host',
    tags: ['host', 'coordination'],
    portfolio: [],
  },
  {
    owner: 'nick_music',
    name: 'Nick',
    roles: ['music_maker'],
    description:
      'Пишу оригинальную музыку под коллабы в разных стилях: electro, dubstep, orchestral. NCS-совместимо.',
    services: ['Оригинальный трек', 'Лицензия под коллаб'],
    price: 900,
    contact: '@nick_music',
    tags: ['music', 'music maker'],
    portfolio: ['https://soundcloud.com/example/nick'],
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

    const roleTitle = p.roles.join(', ');

    db.prepare(
      `INSERT INTO profiles
        (user_id, name, avatar_url, role_title, roles, description, services, price_cents, currency, contact, portfolio, tags, status)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'RUB', ?, ?, ?, 'approved')`
    ).run(
      userId,
      p.name,
      roleTitle,
      JSON.stringify(p.roles),
      p.description,
      JSON.stringify(p.services),
      p.price * 100,
      p.contact,
      JSON.stringify(p.portfolio),
      JSON.stringify(p.tags)
    );
    console.log(`Created profile for ${p.name}`);
  }

  // Demo collab: mefix lists a GP part with tiered pricing, anna_deco has
  // already attached deco tiers on top, and buyer_demo bought the 50% GP tier
  // — so the UI has something interesting to show right after seeding.
  const existingCollab = db.prepare(`SELECT id FROM collabs WHERE title = ?`).get('Layout Part 3 — Cube/Ship');
  if (!existingCollab) {
    const collab = Collab.create({
      creatorId: userIds.mefix,
      title: 'Layout Part 3 — Cube/Ship',
      description: 'Средней сложности парт: cube секция + короткий ship. Под электро-трек, 145 BPM.',
      gpTiers: [
        { tierPercent: 10, priceCents: 5000 },
        { tierPercent: 25, priceCents: 12000 },
        { tierPercent: 50, priceCents: 25000 },
        { tierPercent: 75, priceCents: 40000 },
        { tierPercent: 100, priceCents: 60000 },
      ],
    });

    Collab.attachDecoTiers({
      collabId: collab.id,
      decoratorId: userIds.anna_deco,
      decoTiers: [
        { tierPercent: 125, priceCents: 20000 },
        { tierPercent: 150, priceCents: 35000 },
        { tierPercent: 175, priceCents: 50000 },
        { tierPercent: 200, priceCents: 70000 },
      ],
    });

    const tier50 = Collab.getTier(collab.id, 50);
    Collab.recordPurchase({
      collabId: collab.id,
      tierPercent: 50,
      buyerId: userIds.buyer_demo,
      sellerId: userIds.mefix,
      priceCents: tier50.price_cents,
    });
    Collab.bumpProgress(collab.id, 50);

    console.log('Created demo collab "Layout Part 3 — Cube/Ship" with GP+Deco tiers and one purchase.');
  }

  console.log('\nSeed complete. Demo accounts (email / password): ');
  demoUsers.forEach((u) => console.log(`  ${u.email} / ${u.password}`));
}

run();
