// Express entry point (Plesk startup file).
require('dotenv').config();
const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpServer } = require('./mcp/server');
const { closeBrowser } = require('./services/browser');
const { createKey, verifyKey, ALLOWED_DAYS } = require('./services/keys');
const { version } = require('./package.json');

const startedAt = new Date().toISOString();
// deploy.sh writes the deploy time here; absent when running locally.
let deployedAt = null;
try { deployedAt = require('node:fs').readFileSync(path.join(__dirname, '.deployed-at'), 'utf8').trim(); } catch {}

const app = express();
app.set('trust proxy', 1); // behind Plesk's nginx/Apache, so req.ip is the real client
app.use(express.json({ limit: '1mb' }));

// version = code version (bumped on each push); startedAt = when this process started.
app.get('/health', (req, res) => res.json({ ok: true, version, startedAt, deployedAt }));
app.use('/shots', express.static(path.join(__dirname, 'public', 'shots')));

// Auth for /mcp. Accepted: the permanent API_KEY env var, or a generated key that has not expired.
// With neither API_KEY nor ADMIN_PASSWORD configured the endpoint is open (local development).
const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function requireApiKey(req, res, next) {
  const master = process.env.API_KEY;
  if (!master && !process.env.ADMIN_PASSWORD) return next();
  const bearer = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const given = req.get('x-api-key') || bearer;
  if (given && ((master && safeEqual(given, master)) || verifyKey(given))) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Behind Cloudflare the real client IP is in CF-Connecting-IP; otherwise use Express's req.ip.
const clientIp = (req) => ipKeyGenerator(req.get('cf-connecting-ip') || req.ip);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN) || 30,
  keyGenerator: clientIp,
  handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
});

// Main page and key generation (protected by ADMIN_PASSWORD).
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));

// Strict limit so the admin password cannot be guessed by brute force.
const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: clientIp,
  handler: (req, res) => res.status(429).json({ error: 'Too many attempts, try again later' }),
});

app.post('/admin/keys', adminLimiter, (req, res) => {
  const admin = process.env.ADMIN_PASSWORD;
  if (!admin) return res.status(503).json({ error: 'Key generation is not enabled on this server' });
  const { password, days } = req.body || {};
  if (typeof password !== 'string' || !safeEqual(password, admin)) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  if (!ALLOWED_DAYS.includes(days)) return res.status(400).json({ error: 'Invalid expiry' });
  res.set('Cache-Control', 'no-store');
  res.json(createKey(days));
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
