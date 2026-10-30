// Job 1: visible text plus a screenshot saved as a file (PNG).
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { withPage } = require('../withPage');
const { cleanText } = require('../textUtil');
const { SHOTS_DIR, MAX_TEXT_CHARS } = require('../constants');

async function capturePage(rawUrl, stats = {}, options = {}) {
  return withPage(rawUrl, options, stats, async (page) => {
    const text = cleanText(await page.innerText('body')).slice(0, MAX_TEXT_CHARS);
    const screenshotFile = `${crypto.randomUUID()}.png`;
    await fs.mkdir(SHOTS_DIR, { recursive: true });
    if (stats.sample) stats.sample(); // memory is usually highest just before the screenshot
    const shotPath = path.join(SHOTS_DIR, screenshotFile);
    await page.screenshot({ path: shotPath, fullPage: options.fullPage !== false });
    stats.screenshotBytes = (await fs.stat(shotPath)).size;
    return { text, screenshotFile, finalUrl: page.url() };
  });
}

module.exports = { capturePage };
