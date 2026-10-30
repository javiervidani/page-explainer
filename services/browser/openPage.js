// Opens a page safely: every request and every redirect hop goes through the URL guard.
const { assertSafeUrl, UrlError } = require('../urlGuard');
const { TimeoutError } = require('./errors');
const { getBrowser } = require('./launch');
const { PAGE_TIMEOUT_MS, NETWORKIDLE_CAP_MS, MAX_REDIRECTS, VIEWPORTS } = require('./constants');

const isRedirect = (res) => [301, 302, 303, 307, 308].includes(res.status()) && !!res.headers()['location'];

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

module.exports = { openPage };
