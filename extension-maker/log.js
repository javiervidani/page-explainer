// A short log kept in chrome.storage.local (last 80 lines) so a problem can be seen without opening the developer tools.
// The panel's "📋 יומן" button copies it. It holds times, steps and error texts, never the key or a picture.
const LOG_KEY = 'lmLog';

async function logEvent(where, text) {
  try {
    const { lmLog = [] } = await chrome.storage.local.get(LOG_KEY);
    lmLog.push(`${new Date().toISOString().slice(11, 19)} ${where} ${String(text).replace(/\s+/g, ' ').slice(0, 200)}`);
    await chrome.storage.local.set({ [LOG_KEY]: lmLog.slice(-80) });
  } catch { /* the log must never break the extension */ }
}

async function logMessage(msg) {
  if (msg.type === 'logAdd') { await logEvent(msg.where || 'page', msg.text); return { ok: true }; }
  if (msg.type === 'logClear') { await chrome.storage.local.remove(LOG_KEY); return { ok: true }; }
  const { lmLog = [] } = await chrome.storage.local.get(LOG_KEY);
  return { lines: lmLog };
}

logEvent('worker', `started, version ${chrome.runtime.getManifest().version}`);
