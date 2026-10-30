// Job 3: one area of the page as a JPEG, chosen by CSS `selector` or by `region` {x, y, width, height}
// in page coordinates. With neither: the visible screen (or the whole page when `fullPage` is true).
// Returns the image bytes (base64), the text inside the area and a note when the area was cut.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { withPage } = require('../withPage');
const { cleanText } = require('../textUtil');
const { InputError } = require('../errors');
const { textInRegion } = require('../pageScripts/textInRegion');
const { SHOTS_DIR, MAX_AREA_HEIGHT, MAX_AREA_WIDTH, MAX_AREA_TEXT_CHARS, JPEG_BYTES_SOFT, JPEG_BYTES_HARD } = require('../constants');

async function captureArea(rawUrl, { selector, region, fullPage } = {}, stats = {}, options = {}) {
  return withPage(rawUrl, options, stats, async (page) => {
    const size = await page.evaluate(() => ({
      screenW: window.innerWidth,
      screenH: window.innerHeight,
      pageW: Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0),
      pageH: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
    }));

    let box;     // the whole area asked for, in page coordinates
    let text;
    let what;
    if (selector) {
      let handle;
      try { handle = await page.$(selector); } catch { throw new InputError('Invalid CSS selector'); }
      if (!handle) throw new InputError(`No element matches "${selector.slice(0, 80)}". Use page_outline to get selectors.`);
      const found = await handle.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height, text: el.innerText || '' };
      });
      if (found.width < 2 || found.height < 2) throw new InputError('That element is not visible (zero size)');
      box = { x: found.x, y: found.y, width: found.width, height: found.height };
      text = found.text;
      what = `element ${selector}`;
    } else if (region) {
      box = { x: region.x, y: region.y, width: region.width, height: region.height };
      text = await page.evaluate(textInRegion, box);
      what = 'region';
    } else if (fullPage) {
      box = { x: 0, y: 0, width: size.pageW, height: size.pageH };
      text = await page.innerText('body');
      what = 'full page';
    } else {
      box = { x: 0, y: 0, width: size.screenW, height: size.screenH };
      text = await page.evaluate(textInRegion, box);
      what = 'visible screen';
    }

    // Keep the image a sensible size: cut very tall or wide areas and say so.
    const clip = {
      x: Math.max(0, Math.round(box.x)),
      y: Math.max(0, Math.round(box.y)),
      width: Math.min(Math.round(box.width), MAX_AREA_WIDTH),
      height: Math.min(Math.round(box.height), MAX_AREA_HEIGHT),
    };
    if (clip.y >= size.pageH) throw new InputError(`The page is only ${size.pageH}px tall; y=${clip.y} is below it`);
    clip.height = Math.min(clip.height, size.pageH - clip.y); // the clip must stay inside the page
    clip.width = Math.min(clip.width, Math.max(size.pageW - clip.x, 1));
    const cut = Math.round(box.height) > clip.height || Math.round(box.width) > clip.width;

    if (stats.sample) stats.sample();
    const shoot = (quality) => page.screenshot({ type: 'jpeg', quality, fullPage: true, clip });
    let image = await shoot(80);
    if (image.length > JPEG_BYTES_SOFT) image = await shoot(55);
    if (image.length > JPEG_BYTES_HARD) throw new InputError('That area is too large to send as an image; choose a smaller selector or region');

    const file = `${crypto.randomUUID()}.jpg`;
    await fs.mkdir(SHOTS_DIR, { recursive: true });
    await fs.writeFile(path.join(SHOTS_DIR, file), image);
    stats.screenshotBytes = image.length;

    return {
      finalUrl: page.url(),
      what,
      clip,
      cut,
      boxHeight: Math.round(box.height),
      pageHeight: size.pageH,
      text: cleanText(text).slice(0, MAX_AREA_TEXT_CHARS),
      file,
      image: image.toString('base64'),
    };
  });
}

module.exports = { captureArea };
