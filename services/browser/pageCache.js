// Kept pages.
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

// Closes every kept page (used when the server shuts down).
function dropAll() {
  for (const key of [...kept.keys()]) dropKept(key);
}

const cacheEnabled = CACHE_MAX > 0;

module.exports = { cacheEnabled, closeEntry, dropKept, takeKept, keepPage, dropAll };
