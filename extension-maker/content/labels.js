// The names of the controls and panel titles visible on screen. Names only: long texts (the notebook's
// own words) are left out, and so are typed values; inputs contribute only their placeholder or label.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const { clean, isShown } = LM.util;

  const CONTROLS = 'button,[role=button],[role=tab],[role=menuitem],[role=link],a[href],input,textarea,select,[aria-label]';

  function collectLabels() {
    const seen = new Set();
    const out = [];
    const add = (text, max) => {
      const t = clean(text);
      if (t && t.length <= max && !seen.has(t) && out.length < 120) { seen.add(t); out.push(t); }
    };
    for (const el of document.body.querySelectorAll(CONTROLS)) {
      if (LM.ui.host.contains(el) || !isShown(el)) continue;
      const isField = el.matches('input,textarea,select');
      add(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || (isField ? '' : el.innerText), 40);
    }
    // Panel titles are short headings; a long heading is the notebook's own title, so it is skipped.
    for (const el of document.body.querySelectorAll('h1,h2,h3,[role=heading]')) {
      if (isShown(el) && !LM.ui.host.contains(el)) add(el.innerText, 24);
    }
    return out;
  }

  LM.labels = { collectLabels };
})();
