// Deletes screenshots older than 24 hours and usage logs older than 30 days. Run daily as a Plesk scheduled task:
//   node scripts/cleanup.js
const fs = require('node:fs/promises');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'public', 'shots');
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

(async () => {
  let removed = 0;
  for (const name of await fs.readdir(DIR)) {
    if (!name.endsWith('.png')) continue; // keep .gitkeep etc.
    const file = path.join(DIR, name);
    const { mtimeMs } = await fs.stat(file);
    if (Date.now() - mtimeMs > MAX_AGE_MS) {
      await fs.unlink(file);
      removed++;
    }
  }
  console.log(`Removed ${removed} old screenshot(s)`);

  // Usage logs (data/usage-YYYY-MM-DD.jsonl)
  const dataDir = path.join(__dirname, '..', 'data');
  let logsRemoved = 0;
  for (const name of await fs.readdir(dataDir).catch(() => [])) {
    if (!/^usage-.*\.jsonl$/.test(name)) continue;
    const file = path.join(dataDir, name);
    if (Date.now() - (await fs.stat(file)).mtimeMs > 30 * MAX_AGE_MS) {
      await fs.unlink(file);
      logsRemoved++;
    }
  }
  console.log(`Removed ${logsRemoved} old usage log(s)`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
