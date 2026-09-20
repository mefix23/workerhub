const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = path.resolve(
  process.cwd(),
  process.env.DATABASE_FILE || './database/workerhub.sqlite'
);

// Make sure the database directory exists before opening the file.
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// On hosting with a temporary disk the file is gone after every restart: bring
// the latest backup back first (only does something when BACKUP_* is set).
require('../utils/backup').restoreSync(DB_FILE);

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema.sql idempotently on every boot (all statements use CREATE TABLE IF NOT EXISTS,
// so this only ever creates tables that don't exist yet — it never touches existing data).
const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// --- Lightweight migrations for columns added after the initial release ---
// CREATE TABLE IF NOT EXISTS above can't add a column to a table that already
// exists (e.g. a `profiles` table created before the `roles` column existed
// on a previously deployed database), so handle that explicitly here. Every
// migration checks first and is a no-op if already applied — safe to run on
// every boot, and it never drops or rewrites existing rows.
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

if (!columnExists('profiles', 'roles')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN roles TEXT NOT NULL DEFAULT '[]'`);
  // Backfill: best-effort guess at a role slug from the old free-text role_title,
  // so existing profiles aren't left with an empty roles list. Anything that
  // doesn't match a known role is simply left with an empty array — the
  // profile owner can pick real roles next time they edit their profile.
  const ROLE_GUESSES = [
    ['gp', '%gp%'],
    ['gp', '%gameplay%'],
    ['deco', '%deco%'],
    ['host', '%host%'],
    ['playtest', '%playtest%'],
    ['playtest', '%play test%'],
    ['music_maker', '%music%'],
  ];
  const rows = db.prepare(`SELECT id, role_title FROM profiles WHERE roles = '[]'`).all();
  const update = db.prepare(`UPDATE profiles SET roles = ? WHERE id = ?`);
  for (const row of rows) {
    const lower = (row.role_title || '').toLowerCase();
    const match = ROLE_GUESSES.find(([, pattern]) =>
      lower.includes(pattern.replace(/%/g, ''))
    );
    if (match) update.run(JSON.stringify([match[0]]), row.id);
  }
}

// Moderators are a flag on the account (kept separate from `role`, whose
// CHECK constraint only allows 'user' / 'admin' and can't be altered in SQLite).
if (!columnExists('users', 'is_moderator')) {
  db.exec(`ALTER TABLE users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0`);
}

// Profile title ("Название анкеты"), owner on/off switch (REQ—ON / REQ—OFF)
// and the reason shown to the owner when a moderator rejects a profile.
if (!columnExists('profiles', 'title')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN title TEXT`);
}
if (!columnExists('profiles', 'is_active')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`);
}
if (!columnExists('profiles', 'reject_reason')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN reject_reason TEXT`);
}

// "Услуги" text (the profile description field is now "Описание"), the works
// gallery (1-5 photos/video links, JSON) and the skill tier set by moderators.
if (!columnExists('profiles', 'services_text')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN services_text TEXT`);
}
if (!columnExists('profiles', 'media')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN media TEXT`);
}
if (!columnExists('profiles', 'tier')) {
  db.exec(`ALTER TABLE profiles ADD COLUMN tier TEXT`);
}

// Warnings (WARN) given to accounts by staff. 3 warnings = account blocked.
db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issued_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
`);

// Start saving snapshots of the database (only when BACKUP_* is configured).
require('../utils/backup').start(db);

module.exports = db;
