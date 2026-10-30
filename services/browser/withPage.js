// Runs a job on a page: reuses the kept page when there is one, otherwise opens it.
const { assertSafeUrl } = require('../urlGuard');
const { openPage } = require('./openPage');
const { cacheEnabled, closeEntry, dropKept, takeKept, keepPage } = require('./pageCache');

// Opens `rawUrl` (or reuses the kept page) and runs `fn(page)` on it.
// options: viewport ('desktop' | 'mobile'), cacheOwner (who the kept page belongs to),
// refresh (true = load again instead of reusing). `stats` gets bytesDownloaded, requests, cache.
async function withPage(rawUrl, options, stats, fn) {
  stats.bytesDownloaded = 0;
  stats.requests = 0;
  const startUrl = await assertSafeUrl(rawUrl); // checked on every call, also for kept pages
  const useCache = cacheEnabled && !!options.cacheOwner;
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

module.exports = { withPage };
