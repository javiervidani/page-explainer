// Small helpers shared by the other content files. Each content file adds its part to one shared
// object, window.KidHelper (content files of one extension share a page world but not variables).
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});

  // Builds elements without innerHTML (some sites forbid it).
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  function isShown(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  KH.util = { h, norm, isShown };
})();
