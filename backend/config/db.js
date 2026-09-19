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

// Apply schema.sql idempotently on every boot (all statements use CREATE TABLE IF NOT EXISTS).
const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
