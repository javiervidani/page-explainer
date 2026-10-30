// Saved screens for the team: upload from the team extension, and signed links to read an image.
const express = require('express');
const rateLimit = require('express-rate-limit');
const { parseUpload } = require('../services/captures/validate');
const { saveCapture, getCapture, listProject } = require('../services/captures/store');
const { verifySignature } = require('../services/captures/signing');

// `auth` = { requireApiKey, requireTeam, clientIp } from app.js.
function capturesRoutes({ requireApiKey, requireTeam, clientIp }) {
  const router = express.Router();

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    keyGenerator: clientIp,
    handler: (req, res) => res.status(429).json({ error: 'Too many uploads, wait a minute' }),
  });

  // Upload one screen. Own JSON parser: screens are bigger than the 1 MB the rest of the app accepts.
  router.post('/', uploadLimiter, requireApiKey, requireTeam, express.json({ limit: '5mb' }), (req, res) => {
    try {
      const meta = saveCapture(parseUpload(req.body), req.keyInfo.label || req.keyInfo.id);
      res.status(201).json({ id: meta.id, project: meta.project, createdAt: meta.createdAt, expiresAt: meta.expiresAt, inProject: listProject(meta.project).length });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error('capture upload failed:', err.message);
      res.status(500).json({ error: 'Could not save the screen' });
    }
  });

  // The image itself, for a link made by a tool (see mcp/tools/getCapture.js).
  router.get('/:id/image', (req, res) => {
    const found = getCapture(req.params.id);
    if (!found || !verifySignature(req.params.id, req.query.exp, req.query.sig)) {
      return res.status(403).json({ error: 'This link is not valid or has expired' });
    }
    res.set({ 'Cache-Control': 'private, max-age=300', 'Content-Type': found.meta.mimeType, 'X-Content-Type-Options': 'nosniff' });
    res.sendFile(found.file);
  });

  return router;
}

module.exports = { capturesRoutes };
