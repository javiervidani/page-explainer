// Playwright wrapper: open a page, read its visible text, take a full-page screenshot.
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

const isRedirect = (res) => [301, 302, 303, 307, 308].includes(res.status()) && !!res.headers()['location'];

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
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close();
}

// Opens `rawUrl` and returns { text, screenshotFile, finalUrl }.
async function capturePage(rawUrl) {
  const startUrl = await assertSafeUrl(rawUrl);
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

    await context.route('**/*', async (route) => {
      const req = route.request();
      const isMainNav = req.isNavigationRequest() && req.frame() === page.mainFrame();
      const proto = new URL(req.url()).protocol;
      if (proto === 'data:' || proto === 'blob:' || proto === 'about:') return route.continue();
      try {
        if (!(await isSafe(req.url()))) throw new UrlError('Blocked address');
        let response = await route.fetch({ maxRedirects: 0 });
        for (let hop = 0; hop < MAX_REDIRECTS && isRedirect(response); hop++) {
          const next = new URL(response.headers()['location'], response.url()).href;
          if (!(await isSafe(next))) throw new UrlError('Redirect to a blocked address');
          if (isMainNav) {
            redirectTarget = next; // the caller re-navigates to it
            return await route.fulfill({ status: 200, contentType: 'text/html', body: '' });
          }
          response = await route.fetch({ url: next, maxRedirects: 0 });
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

    const raw = await page.innerText('body');
    const text = raw.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim().slice(0, MAX_TEXT_CHARS);

    const screenshotFile = `${crypto.randomUUID()}.png`;
    await fs.mkdir(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS_DIR, screenshotFile), fullPage: true });

    return { text, screenshotFile, finalUrl: page.url() };
  } finally {
    await context.close(); // always release the context
  }
}

module.exports = { capturePage, closeBrowser, SHOTS_DIR, TimeoutError };
