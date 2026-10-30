// Settings page: PageLens address and team key (kept only in this browser).
const $ = (id) => document.getElementById(id);
const say = (text, ok) => { $('msg').textContent = text; $('msg').className = ok ? 'ok' : 'bad'; };
const clean = (a) => a.trim().replace(/\/+$/, '');

chrome.storage.local.get(['address', 'key']).then(({ address, key }) => {
  $('address').value = address || 'https://pagelens.datashellv.com';
  $('key').value = key || '';
});

// Chrome asks for permission to talk to a server the first time we use it.
async function allowServer(address) {
  const origin = `${new URL(address).origin}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

$('save').addEventListener('click', async () => {
  try {
    const address = clean($('address').value);
    new URL(address); // throws when it is not an address
    if (!(await allowServer(address))) return say('לא אושרה גישה לכתובת הזאת.', false);
    await chrome.storage.local.set({ address, key: $('key').value.trim() });
    say('נשמר ✓', true);
  } catch {
    say('הכתובת אינה תקינה.', false);
  }
});

// Asks the server for its tool list: a team key also sees the tools for saved screens.
$('test').addEventListener('click', async () => {
  try {
    const res = await fetch(`${clean($('address').value)}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'x-api-key': $('key').value.trim() },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    if (res.status === 401) return say('המפתח שגוי או שפג תוקפו.', false);
    if (!res.ok) return say(`השרת ענה ${res.status}`, false);
    const team = (await res.text()).includes('list_captures');
    say(team ? 'החיבור תקין ✓ זה מפתח צוות.' : 'החיבור תקין, אבל זה לא מפתח צוות: אי אפשר לשמור מסכים.', team);
  } catch {
    say('לא הצלחתי להגיע לשרת (בדקו את הכתובת, ושמרו כדי לאשר גישה).', false);
  }
});
