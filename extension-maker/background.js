// Service worker of the team extension: takes the picture of the tab and sends it to PageLens.
// The upload is made here (not in the page) so the page can never see the key.
importScripts('log.js', 'remote.js'); // the log, then auto mode (the calls to the server)

const SITES = ['notebooklm.google.com', 'notebook.google.com'];

// captureVisibleTab photographs whatever tab is in front, so first make sure that is the notebook tab that asked.
async function checkVisible(senderTab) {
  const tab = await chrome.tabs.get(senderTab.id);
  let host = '';
  try { host = new URL(tab.url).hostname; } catch { /* no address */ }
  if (!tab.active || !SITES.includes(host)) return 'הלשונית של המחברת אינה בחזית, לכן לא מצלמים.';
  return '';
}


async function settings() {
  const { address = '', key = '' } = await chrome.storage.local.get(['address', 'key']);
  return { base: address.trim().replace(/\/+$/, ''), key: key.trim() };
}

// Keeps only payload.crop (CSS pixels) of the picture. The frame's box moves with it, and the page size becomes the crop's size,
// so the box positions stay in the picture's own units.
async function cropImage(dataUrl, payload) {
  const c = payload.crop;
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scale = bitmap.width / payload.page.width;
  const canvas = new OffscreenCanvas(Math.round(c.width * scale), Math.round(c.height * scale));
  canvas.getContext('2d').drawImage(bitmap, Math.round(c.x * scale), Math.round(c.y * scale), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const target = payload.target && { ...payload.target, box: { ...payload.target.box, x: payload.target.box.x - c.x, y: payload.target.box.y - c.y } };
  return { image: `data:image/jpeg;base64,${btoa(binary)}`, payload: { ...payload, crop: null, target, page: { ...payload.page, width: c.width, height: c.height } } };
}

// Takes the visible tab as a JPEG and uploads it with the details the page collected.
async function saveCapture(payload, sender) {
  const { base, key } = await settings();
  if (!base || !key) return { error: 'חסרות הגדרות: כתובת PageLens ומפתח צוות. פתחו את ההגדרות (⚙️).' };
  const hidden = await checkVisible(sender.tab).catch(() => 'לא הצלחתי לבדוק את הלשונית.');
  if (hidden) return { error: hidden };
  let image;
  try {
    image = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 85 });
  } catch (err) {
    // Chrome allows taking the picture only after the person clicked the extension's toolbar icon on this tab.
    if (/activeTab|all_urls/.test(err.message)) return { error: 'כדי לצלם, לחצו פעם אחת על סמל ההרחבה (📸) בסרגל הכלים של הדפדפן, ואז שמרו שוב.' };
    return { error: `לא הצלחתי לצלם את המסך: ${err.message}` };
  }
  if (payload.crop) {
    try {
      const cropped = await cropImage(image, payload);
      image = cropped.image;
      payload = cropped.payload;
    } catch (err) {
      logEvent('worker', `crop failed, saving the whole screen: ${err.message}`);
    }
  }
  let res;
  try {
    res = await fetch(`${base}/captures`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ ...payload, mimeType: 'image/jpeg', image }),
    });
  } catch {
    return { error: 'לא הצלחתי להגיע לשרת. בדקו את הכתובת ואת החיבור לאינטרנט.' };
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) return { error: 'המפתח שגוי או שפג תוקפו.' };
  if (res.status === 403) return { error: 'המפתח הזה אינו מפתח צוות. בקשו מפתח צוות.' };
  if (!res.ok) return { error: body.error || `השרת ענה ${res.status}` };
  return { ok: true, ...body };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'saveCapture') {
    saveCapture(msg.payload, sender).then(sendResponse, (err) => sendResponse({ error: err.message }));
    return true; // the answer comes later
  }
  if (msg && msg.type && msg.type.startsWith('log')) {
    logMessage(msg).then(sendResponse, () => sendResponse({ lines: [] }));
    return true;
  }
  if (msg && msg.type && msg.type.startsWith('remote')) {
    remoteMessage(msg, sender).then(sendResponse, (err) => sendResponse({ error: err.message }));
    return true;
  }
  if (msg && msg.type === 'openSettings') chrome.runtime.openOptionsPage();
});

// The icon normally opens or closes the panel. After auto mode was refused for lack of permission, the next click is the
// permission itself (activeTab), so it must not close the panel: it asks the page to try again instead.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  const retry = needGrant.delete(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: retry ? 'retryArm' : 'toggle' }).catch(() => {});
});
