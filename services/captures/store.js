// Saved screens: one image file and one small JSON file per screen, in data/captures/.
// Kept 30 days (CAPTURE_DAYS) and then removed by scripts/cleanup.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DIR = path.join(__dirname, '..', '..', 'data', 'captures');
const DAY_MS = 24 * 60 * 60 * 1000;
const keepDays = () => Number(process.env.CAPTURE_DAYS) || 30;

const ID = /^[a-f0-9]{24}$/;
const isId = (id) => ID.test(String(id));

// Saves an upload (from parseUpload). Returns the details that were stored.
function saveCapture(upload, createdBy) {
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const now = Date.now();
  const meta = {
    id,
    project: upload.project,
    note: upload.note,
    target: upload.target,
    labels: upload.labels,
    page: upload.page,
    mimeType: upload.mimeType,
    ext: upload.ext,
    bytes: upload.image.length,
    createdBy,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + keepDays() * DAY_MS).toISOString(),
  };
  fs.writeFileSync(path.join(DIR, `${id}.${upload.ext}`), upload.image, { mode: 0o600 });
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(meta), { mode: 0o600 });
  return meta;
}

function allCaptures() {
  let names = [];
  try { names = fs.readdirSync(DIR); } catch { return []; }
  const out = [];
  for (const n of names.filter((x) => x.endsWith('.json'))) {
    try { out.push(JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'))); } catch { /* skip a broken file */ }
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first = the order of the steps
}

const listProject = (project) => allCaptures().filter((c) => c.project === project);

function listProjects() {
  const byProject = new Map();
  for (const c of allCaptures()) {
    const p = byProject.get(c.project) || { project: c.project, count: 0, first: c.createdAt, last: c.createdAt };
    p.count++;
    p.last = c.createdAt;
    byProject.set(c.project, p);
  }
  return [...byProject.values()];
}

function getCapture(id) {
  if (!isId(id)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8'));
    return { meta, file: path.join(DIR, `${id}.${meta.ext}`) };
  } catch {
    return null;
  }
}

// Removes screens older than `days`. Returns how many were removed.
function removeOlderThan(days = keepDays()) {
  let removed = 0;
  for (const c of allCaptures()) {
    if (Date.now() - Date.parse(c.createdAt) <= days * DAY_MS) continue;
    for (const f of [`${c.id}.json`, `${c.id}.${c.ext}`]) fs.rmSync(path.join(DIR, f), { force: true });
    removed++;
  }
  return removed;
}

// Disk used by saved screens, in bytes.
function storageBytes() {
  try { return fs.readdirSync(DIR).reduce((sum, n) => sum + fs.statSync(path.join(DIR, n)).size, 0); } catch { return 0; }
}

module.exports = { saveCapture, listProject, listProjects, getCapture, removeOlderThan, storageBytes, isId };
