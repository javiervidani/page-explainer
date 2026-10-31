// Downloads of the two Chrome extensions, as ZIP files made from the folders of this repository (so they are always the deployed version).
// Both are safe to hand out: neither holds a key. The team extension only works with a team key typed in its settings.
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { zipFolder, listFiles } = require('../services/zip');

const ROOT = path.join(__dirname, '..');
const EXTENSIONS = [
  { id: 'helper', dir: 'extension', file: 'learning-helper', title: 'Learning helper (for the children)', note: 'Short lessons in Hebrew on NotebookLM / Gemini Notebook, with a yellow frame on the button.' },
  { id: 'lesson-maker', dir: 'extension-maker', file: 'lesson-maker', title: 'Lesson maker (for the team)', note: 'Marks a button and saves the screen to PageLens. Needs a team key in its settings.' },
];
const cache = new Map(); // id -> { stamp, zip }

function describe(ext) {
  const dir = path.join(ROOT, ext.dir);
  const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
  const stamp = listFiles(dir).map((f) => `${f.name}:${fs.statSync(f.file).mtimeMs}`).join('|');
  return { dir, version, stamp };
}

function downloadsRoutes({ clientIp }) {
  const router = express.Router();
  router.use(rateLimit({ windowMs: 60 * 1000, limit: 20, keyGenerator: clientIp, handler: (req, res) => res.status(429).json({ error: 'Too many requests' }) }));

  // The list the main page shows.
  router.get('/', (req, res) => {
    res.json(EXTENSIONS.map((e) => ({ id: e.id, title: e.title, note: e.note, version: describe(e).version, url: `/downloads/${e.id}.zip` })));
  });

  router.get('/:id.zip', (req, res) => {
    const ext = EXTENSIONS.find((e) => e.id === req.params.id);
    if (!ext) return res.status(404).json({ error: 'No such download' });
    const { dir, version, stamp } = describe(ext);
    let hit = cache.get(ext.id);
    if (!hit || hit.stamp !== stamp) {
      hit = { stamp, zip: zipFolder(dir) };
      cache.set(ext.id, hit);
    }
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${ext.file}-${version}.zip"`, 'Cache-Control': 'no-cache' });
    res.send(hit.zip);
  });

  return router;
}

module.exports = { downloadsRoutes };
