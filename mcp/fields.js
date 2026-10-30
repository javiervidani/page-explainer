// Input fields shared by the tools, and the public address used in links.
const { z } = require('zod');

// Absolute screenshot links need the public origin, e.g. https://example.com
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

const urlField = z.string().describe('Public http(s) URL of the page');
const viewportField = z
  .enum(['desktop', 'mobile'])
  .optional()
  .describe("Window size: 'desktop' (1280x800, default) or 'mobile' (390x844)");

const refreshField = z
  .boolean()
  .optional()
  .describe('true: load the page again. By default a page opened in the last minute by the same key is reused, so its content can be up to a minute old');

// Said in the reply when a kept page was reused, so the model knows the content may be slightly old.
const reuseNote = (stats) => (stats.cache === 'hit' ? 'Note: this page was reused from a call made a moment ago (up to 1 minute old). Use refresh: true to reload it.\n' : '');

module.exports = { BASE_URL, urlField, viewportField, refreshField, reuseNote };
