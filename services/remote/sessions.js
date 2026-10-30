// A remote capture session: the author turns on "auto mode" in the team extension, which gets a 6-digit code and shows it
// in a banner. A chat has to quote that code to ask the extension for anything, so nobody can use it without the author.
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const store = require('./store');

const MAX_MINUTES = 30;
const CONNECTED_MS = 45000;   // the extension counts as "there" if it asked for work within this time
const KEEP_MS = 24 * 60 * 60 * 1000;

class RemoteError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

// Starts a session for `owner` ({ id, label } of the team key the extension uses). An owner has one session at a time.
function arm(owner, minutes) {
  const now = Date.now();
  for (const s of store.allSessions()) {
    if (s.ownerId === owner.id || now - s.armedUntil > KEEP_MS) disarm(s.code, 'replaced');
  }
  let code;
  do { code = String(crypto.randomInt(100000, 1000000)); } while (store.readSession(code));
  const minutesOk = Math.min(Math.max(Number(minutes) || MAX_MINUTES, 1), MAX_MINUTES);
  const session = { code, ownerId: owner.id, ownerLabel: owner.label || owner.id, armedUntil: now + minutesOk * 60000, lastSeen: 0, commands: 0 };
  store.writeSession(session);
  for (const d of ['cmd', 'claimed', 'res']) fs.mkdirSync(path.join(store.dirOf(code), d), { recursive: true });
  return session;
}

// The session if it exists and has not ended or expired, else null.
function active(code) {
  const s = store.readSession(code);
  return s && s.armedUntil > Date.now() ? s : null;
}

// Ends a session at once. Commands still waiting get the answer "stopped".
function disarm(code, why = 'stopped') {
  const s = store.readSession(code);
  if (!s) return false;
  const dir = store.dirOf(code);
  for (const d of ['cmd', 'claimed']) {
    let names = [];
    try { names = fs.readdirSync(path.join(dir, d)); } catch { /* none */ }
    for (const n of names) store.writeJson(path.join(dir, 'res', n), { ok: false, error: `the author ${why} the session` });
  }
  s.armedUntil = 0;
  store.writeSession(s);
  return true;
}

function touch(code) {
  const s = store.readSession(code);
  if (s) { s.lastSeen = Date.now(); store.writeSession(s); }
}

function status(code) {
  const s = store.readSession(code);
  if (!s) return { exists: false, armed: false, connected: false, secondsLeft: 0 };
  const armed = s.armedUntil > Date.now();
  return {
    exists: true,
    armed,
    connected: armed && Date.now() - s.lastSeen < CONNECTED_MS,
    secondsLeft: armed ? Math.round((s.armedUntil - Date.now()) / 1000) : 0,
    commands: s.commands,
    owner: s.ownerLabel,
  };
}

module.exports = { arm, active, disarm, touch, status, RemoteError, MAX_MINUTES };
