// Remote capture, extension side: the team extension turns auto mode on (gets a code), asks for work, answers, and stops.
// The chat side is in mcp/tools/remoteCapture.js. Every route is team-only and only for the key that armed the session.
const express = require('express');
const rateLimit = require('express-rate-limit');
const sessions = require('../services/remote/sessions');
const queue = require('../services/remote/queue');

const WAIT_MS = 20000; // how long a request for work waits before answering "nothing yet"

function remoteRoutes({ requireApiKey, requireTeam, clientIp }) {
  const router = express.Router();
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    keyGenerator: clientIp,
    handler: (req, res) => res.status(429).json({ error: 'Too many requests' }),
  });
  router.use(limiter, requireApiKey, requireTeam, express.json({ limit: '200kb' }));

  // The code has to be a live session of the key making the request.
  const own = (req, res, next) => {
    const code = String(req.query.code || req.body?.code || '');
    const s = sessions.active(code);
    if (!s || s.ownerId !== req.keyInfo.id) return res.status(404).json({ error: 'No active session with that code' });
    req.session = s;
    next();
  };
  const fail = (res, err) => res.status(err.status || 500).json({ error: err.status ? err.message : 'Remote capture failed' });

  router.post('/arm', (req, res) => {
    const s = sessions.arm({ id: req.keyInfo.id, label: req.keyInfo.label }, req.body?.minutes);
    res.set('Cache-Control', 'no-store').status(201).json({ code: s.code, armedUntil: s.armedUntil });
  });

  router.get('/next', own, async (req, res) => {
    try {
      sessions.touch(req.session.code);
      const command = await queue.claim(req.session.code, WAIT_MS);
      res.set('Cache-Control', 'no-store').json({ command, armedUntil: req.session.armedUntil });
    } catch (err) { fail(res, err); }
  });

  router.post('/result', own, (req, res) => {
    try {
      const { id, result } = req.body || {};
      queue.complete(req.session.code, String(id), { ok: result?.ok === true, ...JSON.parse(JSON.stringify(result || {})) });
      res.json({ ok: true });
    } catch (err) { fail(res, err); }
  });

  router.post('/stop', own, (req, res) => {
    sessions.disarm(req.session.code, 'stopped');
    res.json({ ok: true });
  });

  return router;
}

module.exports = { remoteRoutes };
