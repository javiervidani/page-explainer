// Remote capture sessions live in files under data/remote/<code>/ (not in memory), because the hosting may run
// several copies of the app and they all have to see the same session. Writes go to a temp file first, then rename.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', 'data', 'remote');
const CODE = /^\d{6}$/;
const ID = /^[a-f0-9]{12}$/;

const isCode = (c) => CODE.test(String(c));
const isId = (i) => ID.test(String(i));
const dirOf = (code) => {
  if (!isCode(code)) throw new Error('bad session code');
  return path.join(ROOT, code);
};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

const readSession = (code) => (isCode(code) ? readJson(path.join(dirOf(code), 'session.json')) : null);
const writeSession = (s) => writeJson(path.join(dirOf(s.code), 'session.json'), s);

function allSessions() {
  let names = [];
  try { names = fs.readdirSync(ROOT); } catch { return []; }
  return names.filter(isCode).map(readSession).filter(Boolean);
}

function removeSession(code) {
  fs.rmSync(dirOf(code), { recursive: true, force: true });
}

module.exports = { ROOT, isCode, isId, dirOf, writeJson, readJson, readSession, writeSession, allSessions, removeSession };
