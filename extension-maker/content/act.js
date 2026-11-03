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
    const r = hit.el.getBoundingClientRect();
    const info = { tag: hit.el.tagName.toLowerCase(), disabled: !!hit.el.disabled, ariaDisabled: hit.el.getAttribute('aria-disabled'), box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
    if (!isSend) return { ok: true, pressed: label, labels: LM.labels.collectLabels(), element: info };
    // Sending: if the text is still in the box, the click did not send it. Try the Enter key, as a person could.
    const box = LM.finder.find([QUESTION_BOX], 'element', true);
    const left = () => (box && box.el ? String(box.el.value ?? box.el.innerText ?? '').trim().length : 0);
    let sentBy = left() ? 'none' : 'click';
    if (sentBy === 'none') {
      for (const type of ['keydown', 'keypress', 'keyup']) box.el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      await sleep(800);
      sentBy = left() ? 'none' : 'enter';
    }
    return { ok: true, pressed: label, sentBy, textLeftInBox: left(), element: info, labels: LM.labels.collectLabels() };
  }

  // Types into the notebook's question box only. It does not send: that is a separate press of "שליחה".
  // Typed like a keyboard does (select what is there, insert the new text), so the page's own code notices it and wakes its buttons.
  async function fill(el, value) {
    el.focus();
    if (el.matches('textarea,input')) el.select();
    else document.getSelection().selectAllChildren(el);
    const inserted = document.execCommand('insertText', false, value);
    if (!inserted && el.matches('textarea,input')) { // an older way, if the browser refused
      const proto = el.matches('textarea') ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(300); // the page may enable its buttons a moment later
  }

  async function type({ text }) {
    if (!s.remote.act) return off;
    if (s.remote.typed >= MAX_TYPED) return { ok: false, error: `This session reached its limit of ${MAX_TYPED} typed texts.` };
    const box = LM.finder.find([QUESTION_BOX], 'element', true);
    const el = box && box.el;
    if (!el || !el.matches('textarea,input,[contenteditable],[role=textbox]')) return { ok: false, error: 'The notebook question box is not on screen.' };
    const value = String(text || '').slice(0, MAX_TEXT);
    await fill(el, value);
    s.remote.typed++;
    s.remote.typedAt = Date.now();
    noteLast(`הוקלד בתיבת השאלה: ${value.slice(0, 40)}${value.length > 40 ? '…' : ''}`);
    return { ok: true, typed: value.length };
  }

  // Text for a new source: typed only into the paste-text box of the open "add source" window, never anywhere else on the page.
  // The window is the last open dialog; its box must be named like a paste-text box. If it is not found, the names of the boxes
  // in the dialog are returned, so the rule can be adjusted without guessing.
  const MAX_SOURCE_TEXT = 4000;
  const SOURCE_HINTS = ['הדבק', 'הדבקת', 'טקסט', 'paste', 'text'];
  async function typeSource({ text }) {
    if (!s.remote.act) return off;
    if (s.remote.typed >= MAX_TYPED) return { ok: false, error: `This session reached its limit of ${MAX_TYPED} typed texts.` };
    const dialogs = [...document.querySelectorAll('[role=dialog],[aria-modal=true],mat-dialog-container,.mat-mdc-dialog-container')].filter(LM.util.isShown);
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return { ok: false, error: 'No window is open. Press "הוספת מקור" and the paste-text option first.' };
    const boxes = [...dialog.querySelectorAll('textarea,input:not([type=checkbox]):not([type=radio]):not([type=file]),[contenteditable=true],[role=textbox]')].filter(LM.util.isShown);
    const nameOf = (el) => LM.util.labelOf(el) + ' ' + (el.getAttribute('placeholder') || '');
    const hits = boxes.filter((el) => SOURCE_HINTS.some((w) => nameOf(el).toLowerCase().includes(w)));
    if (hits.length !== 1) return { ok: false, error: hits.length ? 'More than one paste-text box in the window.' : 'No paste-text box found in the open window.', boxes: boxes.map(nameOf).map((n) => LM.util.clean(n)).slice(0, 10) };
    const value = String(text || '').slice(0, MAX_SOURCE_TEXT);
    await fill(hits[0], value);
    s.remote.typed++;
    noteLast(`הוקלד מקור: ${value.slice(0, 40)}${value.length > 40 ? '…' : ''}`);
    return { ok: true, typed: value.length };
  }

  // Arrow keys only, and only while a presentation is open on screen (its "close" button is there). A slideshow changes slide on
  // these keys, and a chat cannot press them by hand. No other key can be sent.
  const KEYS = { next: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }, previous: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 } };
  const MAX_KEYS = 60;
  async function pressKey({ direction, times }) {
    if (!s.remote.act) return off;
    const k = KEYS[direction];
    if (!k) return { ok: false, error: 'direction must be "next" or "previous"' };
    if (!LM.finder.find(['סגירת המצגת'], 'element', true)) return { ok: false, error: 'Arrow keys work only while a presentation is open (the page must show "סגירת המצגת").' };
    const n = Math.min(Math.max(Number(times) || 1, 1), 5);
    if ((s.remote.keys || 0) + n > MAX_KEYS) return { ok: false, error: `This session reached its limit of ${MAX_KEYS} arrow key presses.` };
    const target = document.activeElement || document.body;
    for (let i = 0; i < n; i++) {
      for (const type of ['keydown', 'keyup']) {
        target.dispatchEvent(new KeyboardEvent(type, { ...k, which: k.keyCode, bubbles: true, cancelable: true, composed: true }));
      }
      await sleep(500);
    }
    s.remote.keys = (s.remote.keys || 0) + n;
    noteLast(`חץ: ${direction === 'next' ? 'הבא' : 'הקודם'} ×${n}`);
    return { ok: true, key: k.key, times: n };
  }

  LM.act = { readText, press, type, typeSource, pressKey, MAX_PRESSES };
})();
