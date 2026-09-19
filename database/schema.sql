-- WORKERHUB database schema (SQLite)
-- Money is always stored as an integer in the minor currency unit (kopecks/cents).
-- Never store money as REAL/float.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_blocked    INTEGER NOT NULL DEFAULT 0 CHECK (is_blocked IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  avatar_url    TEXT,
  role_title    TEXT NOT NULL,
  description   TEXT NOT NULL,
  services      TEXT,                 -- JSON-encoded array of strings
  price_cents   INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'RUB',
  contact       TEXT NOT NULL,
  portfolio     TEXT,                 -- JSON-encoded array of links
  tags          TEXT,                 -- JSON-encoded array of strings
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id         INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_description TEXT NOT NULL,
  price_cents        INTEGER NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'RUB',
  status             TEXT NOT NULL DEFAULT 'created'
                       CHECK (status IN ('created', 'paid', 'in_progress', 'completed', 'cancelled')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'RUB',
  provider     TEXT NOT NULL DEFAULT 'demo',
  status       TEXT NOT NULL DEFAULT 'held'
                 CHECK (status IN ('held', 'released', 'refunded')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS balances (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_cents INTEGER NOT NULL DEFAULT 0,
  pending_cents   INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'available', 'completed', 'rejected')),
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  available_at TEXT
);

-- Immutable ledger of every balance-affecting event. Balances are always derived
-- from server-side logic that writes here; clients can never edit a balance directly.
CREATE TABLE IF NOT EXISTS transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN (
                      'payment_hold', 'payment_release', 'withdrawal_pending',
                      'withdrawal_completed', 'refund'
                    )),
  amount_cents    INTEGER NOT NULL,
  related_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
