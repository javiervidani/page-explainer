// Limits and window sizes shared by the browser code.
const path = require('node:path');

const SHOTS_DIR = path.join(__dirname, '..', '..', 'public', 'shots');
const PAGE_TIMEOUT_MS = 30000;
const NETWORKIDLE_CAP_MS = 5000;
const MAX_TEXT_CHARS = 20000;
const MAX_REDIRECTS = 10;
const MAX_AREA_HEIGHT = 2000;      // px; taller areas are cut (models downscale very tall images)
const MAX_AREA_WIDTH = 1600;       // px
const MAX_AREA_TEXT_CHARS = 6000;
const JPEG_BYTES_SOFT = 1200000;   // retry at lower quality above this
const JPEG_BYTES_HARD = 2500000;   // refuse above this

// Browser window sizes the tools can ask for.
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

module.exports = {
  SHOTS_DIR, PAGE_TIMEOUT_MS, NETWORKIDLE_CAP_MS, MAX_TEXT_CHARS, MAX_REDIRECTS,
  MAX_AREA_HEIGHT, MAX_AREA_WIDTH, MAX_AREA_TEXT_CHARS, JPEG_BYTES_SOFT, JPEG_BYTES_HARD, VIEWPORTS,
};
