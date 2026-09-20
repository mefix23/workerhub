// Keeps the SQLite database alive on hosting with a temporary disk (Render
// free plan wipes the disk on every restart / sleep).
//
// How it works (all optional - only active when the three BACKUP_* variables
// are set):
//   * on boot, if there is no database file yet, the newest backup is
//     downloaded, decrypted and put in place BEFORE the database is opened;
//   * while the site runs, every ~30 s it checks whether anything changed and
//     if so uploads a fresh encrypted snapshot;
//   * on shutdown (SIGTERM) it uploads a final snapshot.
//
// The snapshots are gzip-compressed and encrypted with AES-256-GCM (key from
// BACKUP_KEY) and stored as assets of one release in a PRIVATE GitHub
// repository, so no Git history piles up and nobody can read the data
// without the key.
//
//   BACKUP_GITHUB_TOKEN  fine-grained token with "Contents: read & write" on that repo
//   BACKUP_GITHUB_REPO   e.g. mefix23/workerhub-data
//   BACKUP_KEY           any long secret string (lose it = lose the backups!)
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const TAG = 'workerhub-data';
const MAGIC = Buffer.from('WHB1');

function config() {
  const token = process.env.BACKUP_GITHUB_TOKEN;
  const repo = process.env.BACKUP_GITHUB_REPO;
  const secret = process.env.BACKUP_KEY;
  if (!token || !repo || !secret) return null;
  return {
    token,
    repo,
    secret,
    api: (process.env.BACKUP_API_BASE || 'https://api.github.com').replace(/\/$/, ''),
    upload: (process.env.BACKUP_UPLOAD_BASE || 'https://uploads.github.com').replace(/\/$/, ''),
  };
}

const log = (...a) => console.log('[backup]', ...a);

// ---------- encryption ----------

function deriveKey(secret) {
  return crypto.scryptSync(secret, 'workerhub-backup-v1', 32);
}

function pack(buf, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(zlib.gzipSync(buf)), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), enc]);
}

function unpack(buf, secret) {
  if (buf.length < 4 + 12 + 16 || !buf.subarray(0, 4).equals(MAGIC)) {
    throw new Error('Backup file has an unknown format.');
  }
  const iv = buf.subarray(4, 16);
  const tag = buf.subarray(16, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  try {
    return zlib.gunzipSync(Buffer.concat([decipher.update(buf.subarray(32)), decipher.final()]));
  } catch (err) {
    throw new Error('Cannot decrypt the backup: BACKUP_KEY is probably different from the one it was made with.');
  }
}

// ---------- GitHub API ----------

function headers(cfg, extra) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'workerhub-backup',
    ...extra,
  };
}

async function gh(cfg, method, url, { body, extra } = {}) {
  const res = await fetch(url, {
    method,
    headers: headers(cfg, extra),
    body,
    signal: AbortSignal.timeout(60000),
  });
  return res;
}

async function findRelease(cfg) {
  const res = await gh(cfg, 'GET', `${cfg.api}/repos/${cfg.repo}/releases/tags/${TAG}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub: cannot read releases (HTTP ${res.status}). Check the token and repo name.`);
  return res.json();
}

async function ensureRelease(cfg) {
  const found = await findRelease(cfg);
  if (found) return found;
  const res = await gh(cfg, 'POST', `${cfg.api}/repos/${cfg.repo}/releases`, {
    body: JSON.stringify({
      tag_name: TAG,
      name: 'WorkerHub data',
      body: 'Encrypted database backups. Do not delete.',
      prerelease: true,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `GitHub: cannot create the backup release (HTTP ${res.status}). Does the repo exist, is it initialised (has a README) and does the token have "Contents: write"?`
    );
  }
  return res.json();
}

async function listAssets(cfg, releaseId) {
  const res = await gh(cfg, 'GET', `${cfg.api}/repos/${cfg.repo}/releases/${releaseId}/assets?per_page=100`);
  if (!res.ok) throw new Error(`GitHub: cannot list backups (HTTP ${res.status}).`);
  const assets = await res.json();
  return assets.filter((a) => /^db-\d+\.enc$/.test(a.name)).sort((a, b) => a.name.localeCompare(b.name));
}

async function uploadSnapshot(cfg, releaseId, data) {
  const name = `db-${String(Date.now()).padStart(15, '0')}.enc`;
  const res = await gh(cfg, 'POST', `${cfg.upload}/repos/${cfg.repo}/releases/${releaseId}/assets?name=${name}`, {
    body: data,
    extra: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(data.length) },
  });
  if (!res.ok) throw new Error(`GitHub: upload failed (HTTP ${res.status}).`);
}

async function pruneOld(cfg, releaseId, keep = 3) {
  const assets = await listAssets(cfg, releaseId);
  for (const a of assets.slice(0, Math.max(0, assets.length - keep))) {
    await gh(cfg, 'DELETE', `${cfg.api}/repos/${cfg.repo}/releases/assets/${a.id}`);
  }
}

async function downloadAsset(cfg, assetId) {
  const res = await gh(cfg, 'GET', `${cfg.api}/repos/${cfg.repo}/releases/assets/${assetId}`, {
    extra: { Accept: 'application/octet-stream' },
  });
  if (!res.ok) throw new Error(`GitHub: download failed (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

// ---------- restore (runs before the database is opened) ----------

async function restoreToFile(file) {
  const cfg = config();
  if (!cfg) return 'disabled';

  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const release = await findRelease(cfg);
      const assets = release ? await listAssets(cfg, release.id) : [];
      if (!assets.length) {
        log('no backup found yet - starting with an empty database');
        return 'empty';
      }
      const newest = assets[assets.length - 1];
      const packed = await downloadAsset(cfg, newest.id);
      const db = unpack(packed, cfg.secret);
      const tmp = `${file}.restore`;
      fs.writeFileSync(tmp, db);
      fs.renameSync(tmp, file);
      log(`database restored from ${newest.name} (${db.length} bytes)`);
      return 'restored';
    } catch (err) {
      lastErr = err;
      log(`restore attempt ${attempt} failed: ${err.message}`);
      if (/BACKUP_KEY/.test(err.message)) break; // retrying won't help
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

// Called from db.js. The database opens synchronously, so the async download
// is done in a small child process. If backups are configured but the restore
// fails we STOP (crash) on purpose: starting with an empty database would
// later overwrite the good backup with nothing.
function restoreSync(file) {
  if (!config() || fs.existsSync(file)) return;
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'restore-cli.js'), file], {
      stdio: 'inherit',
      timeout: 5 * 60 * 1000,
      env: process.env,
    });
  } catch (err) {
    throw new Error('Could not restore the database from backup - refusing to start with an empty one.');
  }
}

// ---------- periodic backup ----------

let started = false;

function start(db) {
  const cfg = config();
  if (!cfg || started) return;
  started = true;

  const changes = () => db.prepare('SELECT total_changes() AS n').get().n;
  let lastBackedUp = -1; // -1 => first tick makes an initial backup
  let busy = false;

  async function backupNow() {
    if (busy) return;
    const current = changes();
    if (current === lastBackedUp) return;
    busy = true;
    const tmp = path.join(os.tmpdir(), `wh-${process.pid}-${Date.now()}.sqlite`);
    try {
      db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
      const data = pack(fs.readFileSync(tmp), cfg.secret);
      const release = await ensureRelease(cfg);
      await uploadSnapshot(cfg, release.id, data);
      await pruneOld(cfg, release.id, 3);
      lastBackedUp = current;
      log(`snapshot uploaded (${data.length} bytes)`);
    } catch (err) {
      log(`snapshot failed, will retry: ${err.message}`);
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
      busy = false;
    }
  }

  const interval = parseInt(process.env.BACKUP_INTERVAL_SECONDS, 10) || 30;
  const timer = setInterval(backupNow, interval * 1000);
  timer.unref();
  setTimeout(backupNow, 5000).unref();

  let closing = false;
  async function onExit(signal) {
    if (closing) return;
    closing = true;
    log(`${signal} received - saving a final snapshot`);
    // wait for a running upload to finish, then make the last one
    for (let i = 0; i < 40 && busy; i += 1) await new Promise((r) => setTimeout(r, 500));
    await backupNow();
    process.exit(0);
  }
  process.on('SIGTERM', () => onExit('SIGTERM'));
  process.on('SIGINT', () => onExit('SIGINT'));

  log(`enabled (repo ${cfg.repo}, every ${interval}s when something changed)`);
}

module.exports = { restoreToFile, restoreSync, start, pack, unpack, config };
