// Signed, expiring image links: /captures/<id>/image?exp=<unix seconds>&sig=<code>.
// Only someone who was given the link (by a tool answer) can open the image, and only until it expires.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SECRET_FILE = path.join(__dirname, '..', '..', 'data', 'capture-secret');
let secret = null;

// CAPTURE_SECRET from the environment, or a random secret created once and kept in data/.
function getSecret() {
  if (secret) return secret;
  if (process.env.CAPTURE_SECRET) return (secret = process.env.CAPTURE_SECRET);
  try { secret = fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch { /* not created yet */ }
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
    fs.writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  }
  return secret;
}

const code = (id, exp) => crypto.createHmac('sha256', getSecret()).update(`${id}.${exp}`).digest('hex').slice(0, 32);

// Path (with query) of a link to the image that works for `ttlSeconds`.
function signedPath(id, ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `/captures/${id}/image?exp=${exp}&sig=${code(id, exp)}`;
}

function verifySignature(id, exp, sig) {
  if (!/^\d{1,12}$/.test(String(exp)) || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(code(id, exp));
  const got = Buffer.from(String(sig || ''));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

module.exports = { signedPath, verifySignature };
