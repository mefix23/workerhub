const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = path.resolve(
  process.cwd(),
  process.env.DATABASE_FILE || './database/workerhub.sqlite'
);

// Make sure the database directory exists before opening the file.
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

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

module.exports = db;
