// Auto mode, service-worker side: arm, ask for work, answer, stop. Loaded by background.js (importScripts).
// The loop itself runs in the notebook tab, so closing the tab ends it; the key stays here.

async function remoteCall(path, method, body, timeoutMs) {
  const { base, key } = await settings();
  if (!base || !key) return { error: 'חסרות הגדרות: כתובת PageLens ומפתח צוות. פתחו את ההגדרות (⚙️).' };
  let res;
  try {
    res = await fetch(`${base}/remote/${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { error: 'לא הצלחתי להגיע לשרת.' };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) return { error: 'המפתח שגוי או שפג תוקפו.', fatal: true };
  if (res.status === 403) return { error: 'המפתח הזה אינו מפתח צוות.', fatal: true };
  if (res.status === 404) return { gone: true };
  if (!res.ok) return { error: data.error || `השרת ענה ${res.status}` };
  return data;
}

async function remoteMessage(msg, sender) {
  if (msg.type === 'remoteArm') {
    // Try a picture first (not kept): if Chrome does not allow it, the author hears it now, not in the middle of a chat.
    const hidden = await checkVisible(sender.tab).catch(() => 'לא הצלחתי לבדוק את הלשונית.');
    if (hidden) return { error: hidden };
    try {
      await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 20 });
    } catch {
      return { error: 'כדי להפעיל מצב אוטומטי, לחצו פעם אחת על סמל ההרחבה (📸) בסרגל הכלים, ואז נסו שוב.' };
    }
    const r = await remoteCall('arm', 'POST', { minutes: 30 }, 15000);
    return r.code ? { code: r.code, armedUntil: r.armedUntil } : r;
  }
  if (msg.type === 'remoteNext') return remoteCall(`next?code=${encodeURIComponent(msg.code)}`, 'GET', null, 35000);
  if (msg.type === 'remoteResult') return remoteCall('result', 'POST', { code: msg.code, id: msg.id, result: msg.result }, 15000);
  if (msg.type === 'remoteStop') return remoteCall('stop', 'POST', { code: msg.code }, 15000);
  return { error: 'unknown message' };
}
