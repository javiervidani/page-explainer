// What a chat may do on the page in auto mode, beyond marking and saving: read the page text, press a button, type in the question box.
// Pressing and typing are off unless the author ticked "allow" before starting auto mode, and they have narrow limits:
// a button is pressed only by its exact name, never one on the block list (delete, remove, share, settings, sign out, feedback, new
// notebook), typing goes only to the notebook's question box, and "send" works only right after text was typed this way.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const s = LM.state;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const MAX_PRESSES = 30;
  const MAX_TYPED = 20;
  const MAX_TEXT = 500;
  const MAX_PAGE_TEXT = 100000;
  const BLOCKED = ['מחיק', 'מחק', 'הסר', 'שיתוף', 'שתף', 'הגדרות', 'התנתק', 'יציאה', 'יצירת notebook', 'הסיכום טוב', 'הסיכום לא טוב',
    'delete', 'remove', 'share', 'settings', 'sign out', 'log out', 'feedback'];
  const QUESTION_BOX = 'התיבה להזנת שאילתה';
  const SEND = 'שליחה';

  const off = { ok: false, error: 'Pressing and typing are off in this session. Ask the author to tick "allow pressing and typing" and start auto mode again.' };
  const noteLast = (text) => { s.remote.last = text; if (LM.remote && LM.remote.paint) LM.remote.paint(); };
  const isBlocked = (label) => BLOCKED.some((w) => label.toLowerCase().includes(w));

  // The text of the page, or of the panel that holds `find`. Headings are listed apart. Nothing is changed.
  function readText({ find }) {
    let root = document.body;
    if (find && find.length) {
      const hit = LM.finder.find(find, 'panel');
      if (!hit) return { ok: false, error: `Not found on screen: ${find.join(', ')}. Use remote_labels to see the names.` };
      root = hit.el;
    }
    const full = root.innerText || '';
    const headings = [...root.querySelectorAll('h1,h2,h3,[role=heading]')].filter(LM.util.isShown).map((e) => LM.util.clean(e.innerText)).filter(Boolean).slice(0, 80);
    return { ok: true, title: document.title.slice(0, 120), path: location.pathname, headings, text: full.slice(0, MAX_PAGE_TEXT), truncated: full.length > MAX_PAGE_TEXT };
  }

  async function press({ name }) {
    if (!s.remote.act) return off;
    if (s.remote.presses >= MAX_PRESSES) return { ok: false, error: `This session reached its limit of ${MAX_PRESSES} presses.` };
    if (isBlocked(name)) return { ok: false, error: `"${name}" is on the block list (delete, remove, share, settings, sign out, feedback, new notebook). The author must press it by hand.` };
    const hit = LM.finder.find([name], 'element', true);
    if (!hit) return { ok: false, error: `No button with exactly the name "${name}" on screen. Use remote_labels to see the names.` };
    const label = LM.util.labelOf(hit.el);
    if (isBlocked(label)) return { ok: false, error: `"${label}" is on the block list. The author must press it by hand.` };
    const isSend = label === SEND || name === SEND;
    if (isSend && !(s.remote.typedAt && Date.now() - s.remote.typedAt < 120000)) return { ok: false, error: 'Send is allowed only right after remote_type put text in the question box.' };
    if (hit.el.disabled || hit.el.getAttribute('aria-disabled') === 'true') return { ok: false, error: `"${label}" is disabled right now.` };
    hit.el.scrollIntoView({ block: 'nearest' });
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) hit.el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    hit.el.click();
    s.remote.presses++;
    if (isSend) s.remote.typedAt = 0;
    noteLast(`לחיצה: ${label}`);
    await sleep(800); // let the page react before the names are read again
    return { ok: true, pressed: label, labels: LM.labels.collectLabels() };
  }

  // Types into the notebook's question box only. It does not send: that is a separate press of "שליחה".
  async function type({ text }) {
    if (!s.remote.act) return off;
    if (s.remote.typed >= MAX_TYPED) return { ok: false, error: `This session reached its limit of ${MAX_TYPED} typed texts.` };
    const box = LM.finder.find([QUESTION_BOX], 'element', true);
    const el = box && box.el;
    if (!el || !el.matches('textarea,input,[contenteditable],[role=textbox]')) return { ok: false, error: 'The notebook question box is not on screen.' };
    const value = String(text || '').slice(0, MAX_TEXT);
    el.focus();
    // Typed like a keyboard does (select what is there, insert the new text), so the page's own code notices it and wakes its send button.
    if (el.matches('textarea,input')) el.select();
    else document.getSelection().selectAllChildren(el);
    const inserted = document.execCommand('insertText', false, value);
    if (!inserted && el.matches('textarea,input')) { // an older way, if the browser refused
      const proto = el.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(300); // the page may enable its send button a moment later
    s.remote.typed++;
    s.remote.typedAt = Date.now();
    noteLast(`הוקלד בתיבת השאלה: ${value.slice(0, 40)}${value.length > 40 ? '…' : ''}`);
    return { ok: true, typed: value.length };
  }

  LM.act = { readText, press, type, MAX_PRESSES };
})();
