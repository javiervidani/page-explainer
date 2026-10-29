// API keys with an expiry date, stored in data/keys.json.
// Only a SHA-256 hash of each key is stored, so a leaked file does not reveal the keys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const FILE = path.join(__dirname, '..', 'data', 'keys.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_DAYS = [1, 7, 30, 90];

const hash = (key) => crypto.createHash('sha256').update(key).digest('hex');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return []; // no file yet
  }
}

// Write to a temp file then rename, so a crash never leaves a half-written file.
function save(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(list), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}

// Creates a key valid for `days` days. The plain key is returned once and never stored.
function createKey(days) {
  if (!ALLOWED_DAYS.includes(days)) throw new Error('Invalid expiry');
  const key = `pl_${crypto.randomBytes(32).toString('base64url')}`;
  const expiresAt = Date.now() + days * DAY_MS;
  const now = Date.now();
  const list = load().filter((k) => k.expiresAt > now); // drop expired keys while we are here
  list.push({ hash: hash(key), expiresAt });
  save(list);
  return { key, expiresAt };
}

function verifyKey(key) {
  if (!key) return false;
  const h = hash(key);
  const now = Date.now();
  return load().some((k) => k.hash === h && k.expiresAt > now);
}

module.exports = { createKey, verifyKey, ALLOWED_DAYS };
