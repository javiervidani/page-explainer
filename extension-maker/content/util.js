// Small helpers shared by the content files. Each file adds its part to one shared object,
// window.LessonMaker (content files of one extension share a page world but not variables).
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});

  // Builds elements without innerHTML (some sites forbid it).
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  function isShown(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  // The name of a control or panel, short enough to be a name and never a piece of the notebook's text.
  function labelOf(el) {
    const named = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title');
    if (named) return clean(named).slice(0, 80);
    const text = clean(el.innerText || el.textContent);
    if (text && text.length <= 60) return text;
    const heading = el.querySelector('h1,h2,h3,h4,[role=heading]');
    if (heading && clean(heading.textContent)) return clean(heading.textContent).slice(0, 60);
    return el.tagName.toLowerCase();
  }

  LM.util = { h, clean, isShown, labelOf };
})();
