// Service worker of the team extension: takes the picture of the tab and sends it to PageLens.
// The upload is made here (not in the page) so the page can never see the key.

async function settings() {
  const { address = '', key = '' } = await chrome.storage.local.get(['address', 'key']);
  return { base: address.trim().replace(/\/+$/, ''), key: key.trim() };
}

// Takes the visible tab as a JPEG and uploads it with the details the page collected.
async function saveCapture(payload, sender) {
  const { base, key } = await settings();
  if (!base || !key) return { error: 'חסרות הגדרות: כתובת PageLens ומפתח צוות. פתחו את ההגדרות (⚙️).' };
  let image;
  try {
    image = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 85 });
  } catch (err) {
    // Chrome allows taking the picture only after the person clicked the extension's toolbar icon on this tab.
    if (/activeTab|all_urls/.test(err.message)) return { error: 'כדי לצלם, לחצו פעם אחת על סמל ההרחבה (📸) בסרגל הכלים של הדפדפן, ואז שמרו שוב.' };
    return { error: `לא הצלחתי לצלם את המסך: ${err.message}` };
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
  if (msg && msg.type === 'openSettings') chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
});
