# WORKERHUB

Минималистичный каталог исполнителей (freelance/services marketplace). MVP с полноценным backend, базой данных SQLite, авторизацией и демо-системой заказов с удержанием оплаты (escrow).

Стиль: чёрный / белый / серый, крупная типографика, без лишних анимаций.

## Стек

- **Backend:** Node.js + Express
- **База данных:** SQLite (через `better-sqlite3`) — файл лежит в `database/workerhub.sqlite`, схема — в `database/schema.sql`
- **Авторизация:** JWT + bcrypt (пароли хешируются, в открытом виде не хранятся)
- **Frontend:** статические HTML/CSS/vanilla JS (без сборщика), раздаётся тем же Express-сервером

## Быстрый старт

```bash
npm install
cp .env.example .env
npm run seed     # создаёт демо-пользователей и демо-анкеты (необязательно, но удобно)
npm start
```

Открой **http://localhost:3000**

Для разработки с автоперезапуском:

```bash
npm run dev
```

### Демо-аккаунты (после `npm run seed`)

| Email | Пароль |
|---|---|
| mefix@example.com | password123 |
| anna@example.com | password123 |
| kirill@example.com | password123 |
| lena@example.com | password123 |
| buyer@example.com | password123 |

## Переменные окружения (`.env`)

См. `.env.example`. Ключевые:

- `JWT_SECRET` — обязательно смени на длинную случайную строку перед реальным использованием (`openssl rand -hex 32`)
- `DATABASE_FILE` — путь к файлу SQLite
- `WITHDRAWAL_HOLD_DAYS` — задержка перед доступностью вывода средств (по умолчанию 3 дня)

## Структура проекта

```
backend/
  config/db.js          # подключение к SQLite, применение schema.sql при старте
  models/                # User, Profile, Order, Balance, Transaction, Withdrawal
  controllers/            # бизнес-логика по каждой сущности
  routes/                 # express-роуты /api/*
  middleware/             # auth (JWT), validate (валидация входных данных), errorHandler
  server.js               # точка входа
database/
  schema.sql              # DDL всех таблиц
  seed.js                 # тестовые данные
public/
  index.html, catalog.html, profile.html, create.html, login.html, register.html
  css/style.css
  js/                     # api-клиент, рендер карточек, страниц и т.д.
```

## API

Все ответы — JSON. Защищённые роуты требуют заголовок `Authorization: Bearer <token>`.

### Auth
- `POST /api/auth/register` `{ username, email, password }`
- `POST /api/auth/login` `{ email, password }`
- `GET /api/auth/me` (auth)

### Профили
- `GET /api/profiles?q=&category=&maxPrice=` — список опубликованных анкет с поиском/фильтром
- `GET /api/profiles/:id` — одна анкета
- `GET /api/profiles/mine` (auth) — анкеты текущего пользователя
- `POST /api/profiles` (auth) — создать анкету (в MVP публикуется сразу автоматически; поле `status` уже поддерживает `pending` для будущей ручной модерации)

### Заказы и эскроу (демо)
- `POST /api/orders` (auth) `{ profileId, serviceDescription }` → статус `created`
- `GET /api/orders` (auth) — мои заказы (как покупатель и как исполнитель)
- `GET /api/orders/:id` (auth)
- `POST /api/orders/:id/pay` (auth, покупатель) → `created → paid`, деньги «удерживаются» (демо-провайдер, `payment_hold`)
- `POST /api/orders/:id/start` (auth, исполнитель) → `paid → in_progress`
- `POST /api/orders/:id/complete` (auth, покупатель) → `→ completed`, средства становятся доступны исполнителю (`payment_release`)
- `POST /api/orders/:id/cancel` (auth) → `→ cancelled`, при необходимости — `refund`
- `GET /api/orders/balance` (auth) — баланс (`available_cents`, `pending_cents`)
- `POST /api/orders/withdrawals` (auth) `{ amountCents }` — запрос на вывод (демо, с задержкой `WITHDRAWAL_HOLD_DAYS`)
- `GET /api/orders/withdrawals` (auth) — история выводов

### Админка (заготовка)
- `GET /api/users` (auth, role=admin)
- `PATCH /api/users/:id/block` (auth, role=admin) `{ blocked: true|false }`

> ⚠️ **О платежах:** реальная обработка денег НЕ реализована. Все операции с балансом проходят через `provider: 'demo'` и работают только внутри базы данных сервера — это моделирует полный жизненный цикл сделки (создание → оплата → удержание → выполнение → релиз → вывод), но не двигает настоящие деньги. Архитектура (отдельные таблицы `payments`, `balances`, `withdrawals`, `transactions`, целочисленные копейки) готова к подключению реального провайдера (например, ЮKassa, Stripe, CloudPayments): нужно заменить тело контроллера `pay()` в `backend/controllers/orderController.js` на вызов API провайдера и подтверждать статус по вебхуку, а не сразу.

## Безопасность, уже реализованная в MVP

- Пароли хешируются через bcrypt, нигде не хранятся в открытом виде
- JWT с настраиваемым сроком жизни
- Все операции с балансом выполняются только на сервере внутри SQL-транзакций — с клиента баланс изменить нельзя
- Валидация всех входных данных на сервере (длины полей, типы, форматы)
- `helmet` (заголовки безопасности), `cors`, ограничение размера тела запроса (`express.json({ limit: '200kb' })`)
- Rate limiting: общий лимит на `/api/*` + более строгий лимит на `/api/auth/*`
- Параметризованные SQL-запросы (`better-sqlite3` prepared statements) — защита от SQL-инъекций
- Экранирование пользовательского текста на фронтенде (`escapeHtml`) — защита от XSS
- Проверка владения ресурсом (нельзя заказать свою же анкету, нельзя оплатить чужой заказ и т.д.) и роли (`requireAdmin`) на каждом защищённом эндпоинте

## Что уже заложено в архитектуру на будущее (не реализовано полностью в MVP)

- Ручная модерация анкет (`pending` / `approved` / `rejected` — колонка и статусы уже есть)
- Полноценная админ-панель (эндпоинты-заготовки в `routes/users.js`, схема готова под жалобы/блокировки)
- Отзывы, рейтинг, счётчик выполненных заказов у анкеты
- Реальный платёжный провайдер вместо демо-эскроу
- Фильтры каталога по категориям/цене (backend уже принимает `category` и `maxPrice`, осталось добавить UI)

## Технические заметки

- Деньги везде хранятся как целые числа в минимальных единицах валюты (копейки), никогда как float.
- SQLite выбран для максимально простого локального запуска без установки отдельной СУБД. Для продакшена с высокой нагрузкой замените `better-sqlite3` на PostgreSQL — схема (`database/schema.sql`) написана на стандартном SQL и переносится с минимальными изменениями (типы `TEXT`/`INTEGER` → эквиваленты `VARCHAR`/`BIGINT`, `datetime('now')` → `NOW()`).

## Самый простой запуск в интернете

В репозитории уже есть `render.yaml` для Render. Он автоматически задаёт Node.js, команду запуска, health-check и безопасно генерируемый `JWT_SECRET`.

Для бесплатного демо подходит Render Web Service. Важно: бесплатный Render использует временную файловую систему, поэтому локальная SQLite-база сбрасывается при перезапуске/засыпании/новом деплое. Для прототипа это нормально; для реального проекта базу позже нужно вынести в PostgreSQL или другое постоянное хранилище.

Если `SEED_DEMO_DATA=true`, при пустой базе автоматически создаются демо-анкеты и тестовые аккаунты.
