// MCP server definition. Three tools:
//   explain_page  - text of a page plus a screenshot link
//   page_outline  - the regions of a page (header, sidebar, main, ...) with selectors and positions
//   capture_area  - one region as an image the model can see, plus the text inside it
// The calling model (Claude, GPT, ...) writes the explanation itself from what we return.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { capturePage, getOutline, captureArea } = require('../services/browser');
const { enqueue, getRunning } = require('../services/queue');
const { startMeasure, logUsage } = require('../services/usage');

// Absolute screenshot links need the public origin, e.g. https://example.com
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const MAX_OUTLINE_CHARS = 15000;

const urlField = z.string().describe('Public http(s) URL of the page');
const viewportField = z
  .enum(['desktop', 'mobile'])
  .optional()
  .describe("Window size: 'desktop' (1280x800, default) or 'mobile' (390x844)");

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
      screenshotBytes: stats.screenshotBytes || 0,
      bytesToClient: replyBytes,                   // size of the tool reply (text + inline image)
    });
  }
}

// `ctx` says who is calling: { keyLabel, ip }. It only goes into the usage log.
function createMcpServer(ctx = {}) {
  const server = new McpServer({ name: 'page-explainer', version: require('../package.json').version });

  server.registerTool(
    'explain_page',
    {
      title: 'Explain web page',
      description:
        'Opens a public web page in a headless browser and returns its visible text plus a ' +
        'link to a screenshot. Use the text to explain what the page is, its main sections and ' +
        'key points in clear, simple language. To look at one part of the page as an image, use ' +
        'page_outline and then capture_area.',
      inputSchema: {
        url: urlField,
        viewport: viewportField,
        fullPage: z.boolean().optional().describe('true (default): screenshot of the whole page; false: only the visible screen'),
      },
    },
    ({ url, viewport, fullPage }) => runTool('explain_page', url, ctx, async (stats) => {
      const { text, screenshotFile, finalUrl } = await capturePage(url, stats, { viewport, fullPage });
      const body = text.length < 200
        ? `${text}\n\n[Note: the extracted text is very short; the page may be incomplete or script-rendered.]`
        : text;
      return {
        content: [{
          type: 'text',
          text: `URL: ${finalUrl}\nScreenshot: ${BASE_URL}/shots/${screenshotFile}\n\n--- PAGE TEXT ---\n${body}`,
        }],
      };
    })
  );

  server.registerTool(
    'page_outline',
    {
      title: 'Outline of a web page',
      description:
        'Opens a public web page and lists its main regions (header, navigation, sidebars, main ' +
        'content, footer, forms...). Each region has a label, a CSS selector, its position and size ' +
        'in pixels and a text snippet, plus the headings and buttons of the page. Use it first when ' +
        'you need to look at or explain one part of a page, then call capture_area with a selector.',
      inputSchema: { url: urlField, viewport: viewportField },
    },
    ({ url, viewport }) => runTool('page_outline', url, ctx, async (stats) => {
      const { finalUrl, outline } = await getOutline(url, stats, { viewport });
      let json = JSON.stringify({ url: finalUrl, ...outline }, null, 1);
      if (json.length > MAX_OUTLINE_CHARS) json = `${json.slice(0, MAX_OUTLINE_CHARS)}\n... [outline cut]`;
      return {
        content: [{
          type: 'text',
          text: `${json}\n\nNext: call capture_area with the same url and a region's "selector" (or its "box" as region) to see it as an image. Pages whose content sits inside iframes or shadow DOM may show fewer regions.`,
        }],
      };
    })
  );

  server.registerTool(
    'capture_area',
    {
      title: 'Screenshot of one area of a web page',
      description:
        'Opens a public web page and returns an image of ONE area, plus the text inside it. Choose the ' +
        'area with a CSS selector (get selectors from page_outline) or with a region in page pixels. ' +
        'With neither, you get the visible screen (or the whole page with fullPage true). Areas taller ' +
        'than 2000px are cut: call again with a region whose y continues where the image ended.',
      inputSchema: {
        url: urlField,
        selector: z.string().max(300).optional().describe('CSS selector of the area, e.g. "aside" or "#sources"'),
        region: z
          .object({
            x: z.number().min(0),
            y: z.number().min(0),
            width: z.number().min(10).max(1600),
            height: z.number().min(10).max(2000),
          })
          .optional()
          .describe('Area in page pixels from the top-left corner of the whole page (used when no selector is given)'),
        viewport: viewportField,
        fullPage: z.boolean().optional().describe('With no selector or region: capture the whole page instead of the visible screen'),
      },
    },
    ({ url, selector, region, viewport, fullPage }) => runTool('capture_area', url, ctx, async (stats) => {
      const r = await captureArea(url, { selector, region, fullPage }, stats, { viewport });
      const c = r.clip;
      const notes = [
        `URL: ${r.finalUrl}`,
        `Area: ${r.what}; image covers x=${c.x}, y=${c.y}, width=${c.width}, height=${c.height} (page height ${r.pageHeight}px)`,
        `Saved copy: ${BASE_URL}/shots/${r.file}`,
      ];
      if (r.cut) {
        notes.push(`The area is ${r.boxHeight}px tall and was cut. To continue, call again with region { x: ${c.x}, y: ${c.y + c.height}, width: ${c.width}, height: ${Math.min(2000, r.pageHeight - (c.y + c.height))} }.`);
      }
      notes.push('', '--- TEXT IN THIS AREA ---', r.text || '(no text found in this area)');
      return {
        content: [
          { type: 'text', text: notes.join('\n') },
          { type: 'image', data: r.image, mimeType: 'image/jpeg' },
        ],
      };
    })
  );

  return server;
}

module.exports = { createMcpServer };
