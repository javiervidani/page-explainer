// Express entry point (Plesk startup file).
require('dotenv').config();
const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpServer } = require('./mcp/server');
const { closeBrowser } = require('./services/browser');

const app = express();
app.set('trust proxy', 1); // behind Plesk's nginx/Apache, so req.ip is the real client
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/shots', express.static(path.join(__dirname, 'public', 'shots')));

// Optional API key (x-api-key header or "Authorization: Bearer <key>").
function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) return next();
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const given = req.get('x-api-key') || bearer;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN) || 30,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
});

// MCP over Streamable HTTP, stateless: a fresh server + transport per request.
app.post('/mcp', limiter, requireApiKey, async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  }
});

// Stateless mode has no SSE stream or sessions to manage.
const notAllowed = (req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

const port = process.env.PORT || 3000;
const httpServer = app.listen(port, () => console.log(`page-explainer listening on ${port}`));

async function shutdown() {
  httpServer.close();
  await closeBrowser().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
