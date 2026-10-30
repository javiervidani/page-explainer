// Runs one tool call for every tool: queue, measuring, error handling and the usage log.
const { enqueue, getRunning } = require('../services/queue');
const { startMeasure, logUsage } = require('../services/usage');

// Runs one tool call: waits in the queue, measures the job, turns errors into tool errors and
// writes the usage log. `job(stats)` returns { content, textBytes? } (the MCP reply).
async function runTool(tool, url, ctx, job) {
  const t0 = Date.now();
  const stats = {};
  let metrics = null;
  let status = 200;
  let replyBytes = 0;
  try {
    // Measure only the time the job actually runs, not the time spent waiting in the queue.
    const reply = await enqueue(async () => {
      const m = startMeasure(getRunning);
      stats.sample = m.sample;
      try {
        return await job(stats);
      } finally {
        metrics = m.stop();
      }
    });
    for (const c of reply.content) replyBytes += Buffer.byteLength(c.type === 'text' ? c.text : c.data);
    return reply;
  } catch (err) {
    // Known errors (400/408/429) carry their own message. For anything else the caller
    // (already authenticated) gets the error text (one line, capped), which is enough to
    // diagnose server problems such as a missing browser; the full error goes to the log.
    status = err.status || 500;
    let message = err.message;
    if (!err.status) {
      console.error(`${tool} failed:`, err.message);
      message = `Failed to load the page: ${String(err.message).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('<launching>')).join(' | ').slice(0, 900)}`;
    }
    replyBytes = Buffer.byteLength(message);
    return { isError: true, content: [{ type: 'text', text: message }] };
  } finally {
    let target = '';
    try { const u = new URL(url); target = u.host + u.pathname; } catch { target = String(url).slice(0, 100); }
    logUsage({
      ts: new Date().toISOString(),
      tool,
      key: ctx.keyLabel || '',
      ip: ctx.ip || '',
      target, // host and path only: query strings can hold secrets
      status,
      totalMs: Date.now() - t0,
      queueMs: metrics ? Date.now() - t0 - metrics.jobMs : null,
      ...(metrics || {}),
      bytesDownloaded: stats.bytesDownloaded || 0, // from the target site (decoded size)
      requests: stats.requests || 0,
      cache: stats.cache || '',                    // hit: page reused, miss: loaded and kept, off: not kept
      screenshotBytes: stats.screenshotBytes || 0,
      bytesToClient: replyBytes,                   // size of the tool reply (text + inline image)
    });
  }
}

module.exports = { runTool };
