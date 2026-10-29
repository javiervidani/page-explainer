// MCP server definition: one tool, `explain_page`.
// The calling model (Claude, GPT, ...) writes the explanation itself from the text we return.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { capturePage } = require('../services/browser');
const { enqueue, getRunning } = require('../services/queue');
const { startMeasure, logUsage } = require('../services/usage');

// Absolute screenshot links need the public origin, e.g. https://example.com
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

// `ctx` says who is calling: { keyLabel, ip }. It only goes into the usage log.
function createMcpServer(ctx = {}) {
  const server = new McpServer({ name: 'page-explainer', version: require('../package.json').version });

  server.registerTool(
    'explain_page',
    {
      title: 'Explain web page',
      description:
        'Opens a public web page in a headless browser and returns its visible text plus a ' +
        'link to a full-page screenshot. Use the text to explain what the page is, its main ' +
        'sections and key points in clear, simple language.',
      inputSchema: { url: z.string().describe('Public http(s) URL of the page') },
    },
    async ({ url }) => {
      const t0 = Date.now();
      const stats = {};
      let metrics = null;
      let status = 200;
      let textBytes = 0;
      try {
        // Measure only the time the job actually runs, not the time spent waiting in the queue.
        const { text, screenshotFile, finalUrl } = await enqueue(async () => {
          const m = startMeasure(getRunning);
          stats.sample = m.sample;
          try {
            return await capturePage(url, stats);
          } finally {
            metrics = m.stop();
          }
        });
        const screenshotUrl = `${BASE_URL}/shots/${screenshotFile}`;
        const body = text.length < 200
          ? `${text}\n\n[Note: the extracted text is very short; the page may be incomplete or script-rendered.]`
          : text;
        const reply = `URL: ${finalUrl}\nScreenshot: ${screenshotUrl}\n\n--- PAGE TEXT ---\n${body}`;
        textBytes = Buffer.byteLength(reply);
        return { content: [{ type: 'text', text: reply }] };
      } catch (err) {
        // Known errors (400/408/429) carry their own message. For anything else the caller
        // (already authenticated) gets the error text (one line, capped), which is enough to
        // diagnose server problems such as a missing browser; the full error goes to the log.
        status = err.status || 500;
        let message = err.message;
        if (!err.status) {
          console.error('explain_page failed:', err.message);
          message = `Failed to load the page: ${String(err.message).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('<launching>')).join(' | ').slice(0, 900)}`;
        }
        textBytes = Buffer.byteLength(message);
        return { isError: true, content: [{ type: 'text', text: message }] };
      } finally {
        let target = '';
        try { const u = new URL(url); target = u.host + u.pathname; } catch { target = String(url).slice(0, 100); }
        logUsage({
          ts: new Date().toISOString(),
          key: ctx.keyLabel || '',
          ip: ctx.ip || '',
          target, // host and path only: query strings can hold secrets
          status,
          totalMs: Date.now() - t0,
          queueMs: metrics ? Date.now() - t0 - metrics.jobMs : null,
          ...(metrics || {}),
          bytesDownloaded: stats.bytesDownloaded || 0, // from the target site (decoded size)
          requests: stats.requests || 0,
          screenshotBytes: stats.screenshotBytes || 0,
          bytesToClient: textBytes,                    // size of the tool reply
        });
      }
    }
  );

  return server;
}

module.exports = { createMcpServer };
