// Playwright wrapper. One safe page-opening routine (withPage) used by three jobs:
// capturePage (text + screenshot), getOutline (page regions) and captureArea (one area as an image).
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { assertSafeUrl, UrlError } = require('./urlGuard');

const SHOTS_DIR = path.join(__dirname, '..', 'public', 'shots');
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

const isRedirect = (res) => [301, 302, 303, 307, 308].includes(res.status()) && !!res.headers()['location'];

// A problem with what the caller asked for (bad selector, area too large, ...): reported as 400.
class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Page took too long to load');
    this.status = 408;
  }
}

// One shared browser; relaunched if it died.
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) return b;
    browserPromise = null;
  }
  // Set PW_NO_SANDBOX=1 only if Chromium refuses to start on the server.
  // --disable-dev-shm-usage avoids crashes when /dev/shm is tiny, as on many shared hosts.
  const args = ['--disable-dev-shm-usage'];
  if (process.env.PW_NO_SANDBOX === '1') args.push('--no-sandbox');
  // Optional: use an already-installed Chromium instead of Playwright's own download.
  const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
  browserPromise = chromium.launch({ args, executablePath });
  return browserPromise;
}

async function closeBrowser() {
  for (const key of [...kept.keys()]) dropKept(key);
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close();
}

// Opens a page safely (every request and redirect hop checked) and returns { context, page, holder }.
// `holder.stats` is where bandwidth is counted; a kept page gets a new holder.stats on each reuse.
async function openPage(startUrl, options, stats) {
  const holder = { stats };
  const browser = await getBrowser();
  const context = await browser.newContext(VIEWPORTS[options.viewport] || VIEWPORTS.desktop);
  try {
    // SSRF guard: every request the page makes must pass the URL guard, and redirects are
    // followed by us (never by Chromium) so that every hop is checked too.
    let blockedMain = false;
    let redirectTarget = null; // set when the main navigation answered with a safe redirect
    const verdicts = new Map(); // host -> Promise<boolean>, so each host is resolved once
    const isSafe = (u) => {
      const host = new URL(u).host;
      if (!verdicts.has(host)) verdicts.set(host, assertSafeUrl(u).then(() => true, () => false));
      return verdicts.get(host);
    };

    // Bandwidth: every response body passes through us, so we can count what was downloaded.
    const countBytes = async (response) => {
      holder.stats.bytesDownloaded += (await response.body()).length;
      holder.stats.requests++;
    };

    await context.route('**/*', async (route) => {
      const req = route.request();
      const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame();
      const proto = new URL(req.url()).protocol;
      if (proto === 'data:' || proto === 'blob:' || proto === 'about:') return route.continue();
      try {
        if (!(await isSafe(req.url()))) throw new UrlError('Blocked address');
        let response = await route.fetch({ maxRedirects: 0 });
        await countBytes(response);
        for (let hop = 0; hop < MAX_REDIRECTS && isRedirect(response); hop++) {
          const next = new URL(response.headers()['location'], response.url()).href;
          if (!(await isSafe(next))) throw new UrlError('Redirect to a blocked address');
          if (isMainNav) {
            redirectTarget = next; // the caller re-navigates to it
            return await route.fulfill({ status: 200, contentType: 'text/html', body: '' });
          }
          response = await route.fetch({ url: next, maxRedirects: 0 });
          await countBytes(response);
        }
        return await route.fulfill({ response });
      } catch (err) {
        if (err instanceof UrlError && isMainNav) blockedMain = true;
        return route.abort('blockedbyclient').catch(() => {});
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    // Navigate, re-navigating by hand for each (checked) redirect.
    let target = startUrl.href;
    for (let hop = 0; ; hop++) {
      redirectTarget = null;
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      } catch (err) {
        if (blockedMain) throw new UrlError('Page redirected to a blocked address');
        if (err.name === 'TimeoutError') throw new TimeoutError();
        throw err;
      }
      if (blockedMain) throw new UrlError('Page redirected to a blocked address');
      if (!redirectTarget) break;
      if (hop >= MAX_REDIRECTS) throw new UrlError('Too many redirects');
      target = redirectTarget;
    }
    // Short extra wait for late content; ignore if it never goes idle.
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_CAP_MS }).catch(() => {});
    if (blockedMain) throw new UrlError('Page redirected to a blocked address');

    return { context, page, holder };
  } catch (err) {
    await context.close().catch(() => {}); // loading failed: release the context
    throw err;
  }
}

// ---- Kept pages -------------------------------------------------------------------------------
// After a call the loaded page is kept for a short time, so that page_outline followed by
// capture_area does not load the page again. Kept pages belong to one key and are offline while
// idle (no background traffic). Settings: PAGE_CACHE_TTL_S (idle seconds, default 60),
// PAGE_CACHE_MAX (pages kept, default 3, 0 = off), PAGE_CACHE_MAX_AGE_S (default 300).
const CACHE_TTL_MS = (Number(process.env.PAGE_CACHE_TTL_S) || 60) * 1000;
const CACHE_MAX = process.env.PAGE_CACHE_MAX === undefined || process.env.PAGE_CACHE_MAX === '' ? 3 : Number(process.env.PAGE_CACHE_MAX);
const CACHE_MAX_AGE_MS = (Number(process.env.PAGE_CACHE_MAX_AGE_S) || 300) * 1000;

const kept = new Map(); // key -> { context, page, holder, openedAt, timer }

const closeEntry = (entry) => {
  clearTimeout(entry.timer);
  return entry.context.close().catch(() => {});
};

function dropKept(key) {
  const entry = kept.get(key);
  if (!entry) return;
  kept.delete(key);
  closeEntry(entry);
}

// Takes a usable page out of the cache (it is back in the cache when the call ends).
function takeKept(key) {
  const entry = kept.get(key);
  if (!entry) return null;
  kept.delete(key);
  clearTimeout(entry.timer);
  if (entry.page.isClosed() || Date.now() - entry.openedAt > CACHE_MAX_AGE_MS) {
    closeEntry(entry);
    return null;
  }
  return entry;
}

async function keepPage(key, entry) {
  if (kept.has(key)) return closeEntry(entry); // another call kept the same page meanwhile
  while (kept.size >= CACHE_MAX) dropKept(kept.keys().next().value); // oldest first
  try { await entry.context.setOffline(true); } catch { return closeEntry(entry); }
  entry.timer = setTimeout(() => dropKept(key), CACHE_TTL_MS);
  entry.timer.unref();
  kept.set(key, entry);
}

// Opens `rawUrl` (or reuses the kept page) and runs `fn(page)` on it.
// options: viewport ('desktop' | 'mobile'), cacheOwner (who the kept page belongs to),
// refresh (true = load again instead of reusing). `stats` gets bytesDownloaded, requests, cache.
async function withPage(rawUrl, options, stats, fn) {
  stats.bytesDownloaded = 0;
  stats.requests = 0;
  const startUrl = await assertSafeUrl(rawUrl); // checked on every call, also for kept pages
  const useCache = CACHE_MAX > 0 && !!options.cacheOwner;
  const key = useCache ? `${options.cacheOwner}|${options.viewport || 'desktop'}|${startUrl.href}` : null;

  if (key && options.refresh) dropKept(key);
  let entry = key ? takeKept(key) : null;
  if (entry) {
    stats.cache = 'hit';
    entry.holder.stats = stats;
    await entry.context.setOffline(false).catch(() => {});
    await entry.page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  } else {
    stats.cache = key ? 'miss' : 'off';
    entry = await openPage(startUrl, options, stats);
  }

  try {
    return await fn(entry.page);
  } finally {
    // A failed call (for example an unknown selector) leaves a good page behind: keep it.
    if (key && !entry.page.isClosed()) await keepPage(key, entry);
    else await closeEntry(entry);
  }
}


const cleanText = (raw) => raw.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

// Job 1: visible text plus a screenshot saved as a file (PNG). `fullPage` false = visible screen only.
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

// Runs inside the page (it is serialised by Playwright, so it must not use anything from this file).
// Finds the main regions of the page: landmarks (header, nav, main, aside, ...) and, when a page
// has few of those, the big layout blocks. Returns positions in page coordinates (CSS pixels).
function collectOutline() {
  const MAX_REGIONS = 30;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = window.scrollX;
  const sy = window.scrollY;
  const doc = document.documentElement;
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/[^\w-]/g, '\\$&'));

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  // Shortest chain of tag names (with :nth-of-type) that finds exactly this element.
  const isUnique = (sel, el) => {
    try { return document.querySelectorAll(sel).length === 1 && document.querySelector(sel) === el; } catch { return false; }
  };
  const cssPath = (el) => {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== doc; node = node.parentElement) {
      if (node.id && isUnique('#' + esc(node.id), node)) {
        parts.unshift('#' + esc(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      if (isUnique(parts.join(' > '), el)) break;
    }
    return parts.join(' > ');
  };

  const ROLE_BY_TAG = { header: 'banner', nav: 'navigation', main: 'main', aside: 'complementary', footer: 'contentinfo', form: 'form', article: 'article', section: 'section', dialog: 'dialog' };
  const roleOf = (el) => el.getAttribute('role') || ROLE_BY_TAG[el.tagName.toLowerCase()] || el.tagName.toLowerCase();

  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria).slice(0, 80);
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => clean(n.textContent)).join(' ');
      if (t) return t.slice(0, 80);
    }
    const h = el.querySelector('h1,h2,h3,h4,[role=heading]');
    if (h && clean(h.textContent)) return clean(h.textContent).slice(0, 80);
    return clean(el.innerText).slice(0, 60);
  };

  const found = []; // { el, role, r }
  const seen = new Set();
  const add = (el, role) => {
    if (seen.has(el) || !visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 2000) return; // ignore tiny things
    seen.add(el);
    found.push({ el, role, r });
  };

  document.querySelectorAll('header, nav, main, aside, footer, form, article, section, dialog, [role=banner], [role=navigation], [role=main], [role=complementary], [role=contentinfo], [role=search], [role=region], [role=dialog], [role=tablist], [role=toolbar]')
    .forEach((el) => add(el, roleOf(el)));

  // Apps built from plain <div>s have few landmarks: walk down from <body> and take the big blocks.
  if (found.length < 4) {
    const big = (el) => {
      const r = el.getBoundingClientRect();
      return visible(el) && r.width >= 120 && r.height >= 80 && r.width * r.height >= vw * vh * 0.03;
    };
    const walk = (el, depth) => {
      if (depth > 5) return;
      const kids = Array.from(el.children).filter(big);
      if (kids.length === 1) return walk(kids[0], depth + 1); // a wrapper: look inside it
      kids.forEach((k) => { add(k, 'block'); walk(k, depth + 1); });
    };
    walk(document.body, 0);
  }

  // Drop a region that is just a wrapper with the same size as one that contains it.
  const area = (x) => x.r.width * x.r.height;
  const kept = [];
  [...found].sort((a, b) => area(b) - area(a)).forEach((x) => {
    if (!kept.some((k) => k.el.contains(x.el) && area(k) / area(x) < 1.08)) kept.push(x);
  });
  const top = kept.slice(0, MAX_REGIONS)
    .sort((a, b) => (Math.round(a.r.top / 20) - Math.round(b.r.top / 20)) || (a.r.left - b.r.left));

  const regions = top.map((x, i) => ({
    n: i + 1,
    role: x.role,
    label: labelOf(x.el),
    selector: cssPath(x.el),
    box: { x: Math.round(x.r.left + sx), y: Math.round(x.r.top + sy), width: Math.round(x.r.width), height: Math.round(x.r.height) },
    chars: clean(x.el.innerText).length,
    snippet: clean(x.el.innerText).slice(0, 140),
  }));

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).filter(visible).slice(0, 40).map((h) => ({
    level: Number(h.tagName[1]),
    text: clean(h.textContent).slice(0, 100),
    y: Math.round(h.getBoundingClientRect().top + sy),
  }));

  const seenLabels = new Set();
  const buttons = [];
  document.querySelectorAll('button, [role=button], input[type=submit], input[type=button]').forEach((b) => {
    if (!visible(b)) return;
    const t = clean(b.getAttribute('aria-label') || b.innerText || b.value).slice(0, 40);
    if (t && !seenLabels.has(t) && buttons.length < 25) { seenLabels.add(t); buttons.push(t); }
  });

  const count = (sel) => Array.from(document.querySelectorAll(sel)).filter(visible).length;
  return {
    title: document.title,
    language: doc.lang || '',
    direction: getComputedStyle(doc).direction, // 'rtl' for Hebrew / Arabic pages
    screen: { width: vw, height: vh },
    page: { width: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0), height: Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0) },
    regions,
    headings,
    buttons,
    counts: { links: count('a[href]'), inputs: count('input, textarea, select'), images: count('img') },
  };
}

// Job 2: the regions of a page.
async function getOutline(rawUrl, stats = {}, options = {}) {
  return withPage(rawUrl, options, stats, async (page) => {
    if (stats.sample) stats.sample();
    return { finalUrl: page.url(), outline: await page.evaluate(collectOutline) };
  });
}

// Runs inside the page: text of the text nodes whose centre lies inside the region (page coordinates).
function textInRegion(reg) {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  for (let i = 0; i < 20000 && (node = walker.nextNode()); i++) {
    const t = node.nodeValue.trim();
    if (!t || !node.parentElement) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cx = r.left + window.scrollX + r.width / 2;
    const cy = r.top + window.scrollY + r.height / 2;
    if (cx >= reg.x && cx <= reg.x + reg.width && cy >= reg.y && cy <= reg.y + reg.height) out.push(t);
  }
  return out.join('\n');
}

// Job 3: one area of the page as a JPEG, chosen by CSS `selector` or by `region` {x, y, width, height}
// in page coordinates. With neither: the visible screen (or the whole page when `fullPage` is true).
// Returns the image bytes (base64), the text inside the area and a note when the area was cut.
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

module.exports = { capturePage, getOutline, captureArea, closeBrowser, SHOTS_DIR, TimeoutError, InputError };
