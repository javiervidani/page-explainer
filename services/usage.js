// Per-call resource usage: measures CPU, memory and bandwidth of one browser job and logs it.
// Logs go to the console and to data/usage-YYYY-MM-DD.jsonl (one JSON object per line).
// Read them with: node scripts/usage-report.js [days]
const fs = require('node:fs');
const path = require('node:path');

const LOG_DIR = path.join(__dirname, '..', 'data');
const CLK_TCK = 100;   // clock ticks per second on Linux
const PAGE_BYTES = 4096;
const SAMPLE_MS = 500; // how often memory is sampled while a job runs

// Memory of one process in bytes. PSS splits shared pages between the processes that share them,
// so summing it over Chromium's many processes is fair; plain RSS would count shared pages repeatedly.
// Falls back to RSS when smaps_rollup is not readable.
function memoryOf(pid) {
  try {
    const m = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+) kB/m);
    if (m) return Number(m[1]) * 1024;
  } catch {}
  try { return Number(fs.readFileSync(`/proc/${pid}/statm`, 'utf8').split(' ')[1]) * PAGE_BYTES; } catch { return 0; }
}

// CPU ticks and memory of every process below this Node process (that is Chromium and its
// helpers), read from /proc. Returns null where /proc is missing (not Linux).
function sampleBrowserTree() {
  let names;
  try { names = fs.readdirSync('/proc'); } catch { return null; }
  const procs = new Map(); // pid -> { ppid, ticks }
  for (const n of names) {
    if (!/^\d+$/.test(n)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${n}/stat`, 'utf8');
      // The command name may contain spaces or ')', so split after the LAST ')'.
      // Field numbers from proc(5) minus 3: ppid=f[1], utime=f[11], stime=f[12], cutime=f[13], cstime=f[14]
      const f = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      procs.set(Number(n), { ppid: Number(f[1]), ticks: +f[11] + +f[12] + +f[13] + +f[14] });
    } catch { /* process ended while we were reading */ }
  }
  // Walk down from this process.
  const tree = [];
  const queue = [process.pid];
  while (queue.length) {
    const parent = queue.pop();
    for (const [pid, p] of procs) {
      if (p.ppid === parent) { tree.push(pid); queue.push(pid); }
    }
  }
  let ticks = 0;
  let rss = 0;
  for (const pid of tree) {
    ticks += procs.get(pid).ticks;
    rss += memoryOf(pid);
  }
  return { ticks, rss };
}

const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;

// Call at the start of a job; call stop() when it ends (also on failure) to get the numbers.
// With 2 jobs running at once the shared Chromium makes CPU/memory overlap, so `concurrent` is reported.
function startMeasure(getConcurrency) {
  const startedAt = Date.now();
  const cpu0 = process.cpuUsage();
  const tree0 = sampleBrowserTree();
  let peakBrowser = tree0 ? tree0.rss : 0;
  let peakNode = process.memoryUsage().rss; // Node's own memory (RSS)
  let concurrent = getConcurrency();

  const sample = () => {
    const t = sampleBrowserTree();
    if (t) peakBrowser = Math.max(peakBrowser, t.rss);
    peakNode = Math.max(peakNode, process.memoryUsage().rss);
    concurrent = Math.max(concurrent, getConcurrency());
    return t;
  };
  const timer = setInterval(sample, SAMPLE_MS);

  return {
    sample, // also called by the browser code just before the screenshot (the heaviest moment)
    stop() {
      clearInterval(timer);
      const tree1 = sample();
      const cpu = process.cpuUsage(cpu0);
      return {
        jobMs: Date.now() - startedAt,
        cpuBrowserMs: tree0 && tree1 ? Math.max(0, Math.round(((tree1.ticks - tree0.ticks) * 1000) / CLK_TCK)) : null,
        cpuNodeMs: Math.round((cpu.user + cpu.system) / 1000),
        peakBrowserMb: tree0 ? mb(peakBrowser) : null,
        peakNodeMb: mb(peakNode),
        concurrent,
      };
    },
  };
}

function logUsage(record) {
  const line = JSON.stringify(record);
  console.log('usage', line);
  const file = path.join(LOG_DIR, `usage-${record.ts.slice(0, 10)}.jsonl`);
  fs.mkdir(LOG_DIR, { recursive: true }, () => fs.appendFile(file, `${line}\n`, () => {}));
}

module.exports = { startMeasure, logUsage };
