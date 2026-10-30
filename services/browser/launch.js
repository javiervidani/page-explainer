// The one shared Chromium. Started on first use and started again if it died.
const { chromium } = require('playwright');

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

async function closeLaunched() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close();
}

module.exports = { getBrowser, closeLaunched };
