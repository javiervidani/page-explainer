// Summarises data/usage-*.jsonl per key. Usage: node scripts/usage-report.js [days=7]
const fs = require('node:fs');
const path = require('node:path');

const days = Number(process.argv[2]) || 7;
const dir = path.join(__dirname, '..', 'data');
const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const rows = new Map(); // key label -> totals
let files = [];
try { files = fs.readdirSync(dir).filter((n) => /^usage-.*\.jsonl$/.test(n) && n.slice(6, 16) >= since).sort(); } catch {}

for (const name of files) {
  for (const line of fs.readFileSync(path.join(dir, name), 'utf8').split('\n')) {
    if (!line) continue;
    let r;
    try { r = JSON.parse(line); } catch { continue; }
    const t = rows.get(r.key || '(none)') || { calls: 0, hits: 0, overlap: 0, failed: 0, cpuS: 0, peakMb: 0, downMb: 0, shotMb: 0, sec: 0 };
    t.calls++;
    if (r.status !== 200) t.failed++;
    if (r.concurrent > 1) t.overlap++;
    if (r.cache === 'hit') t.hits++;
    t.cpuS += ((r.cpuBrowserMs || 0) + (r.cpuNodeMs || 0)) / 1000;
    t.peakMb = Math.max(t.peakMb, (r.peakBrowserMb || 0) + (r.peakNodeMb || 0));
    t.downMb += (r.bytesDownloaded || 0) / 1048576;
    t.shotMb += (r.screenshotBytes || 0) / 1048576;
    t.sec += (r.totalMs || 0) / 1000;
    rows.set(r.key || '(none)', t);
  }
}

// 'overlapped' calls shared the browser with another call, so their CPU/memory figures overlap
// and the totals overstate slightly. Memory is PSS (Chromium) + RSS (Node).
console.log(`Usage since ${since} (${files.length} log file(s))`);
if (rows.size === 0) process.exit(0);
console.table(Object.fromEntries([...rows].map(([k, t]) => [k, {
  calls: t.calls,
  failed: t.failed,
  'cache hits': t.hits,
  overlapped: t.overlap,
  'cpu s': +t.cpuS.toFixed(1),
  'peak MB': +t.peakMb.toFixed(0),
  'downloaded MB': +t.downMb.toFixed(1),
  'screenshots MB': +t.shotMb.toFixed(1),
  'wall s': +t.sec.toFixed(1),
}])));
