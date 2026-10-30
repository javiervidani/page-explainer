// Finds the part of the page a lesson step talks about, by the name of a button, heading or input.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const { norm, isShown } = KH.util;

  // Looks for a visible element by its label (text, aria-label, placeholder or title), in Hebrew or
  // English, because the page language can differ. Returns the element or null.
  function findTarget(show) {
    if (!show) return null;
    if (show.selector) {
      try {
        const el = document.querySelector(show.selector);
        if (el && isShown(el)) return el;
      } catch { /* bad selector in a lesson: fall through to the text search */ }
    }
    const wanted = (show.text || []).map(norm).filter(Boolean);
    if (wanted.length === 0) return null;

    let best = null;
    let bestScore = Infinity;
    const consider = (el, text, slack) => {
      if (!el || KH.ui.host.contains(el) || !isShown(el)) return;
      for (const w of wanted) {
        if (text === w) { if (0 < bestScore) { best = el; bestScore = 0; } }
        else if (text.includes(w) && text.length - w.length <= slack) {
          const score = text.length - w.length;
          if (score < bestScore) { best = el; bestScore = score; }
        }
      }
    };

    // Visible texts (walking the text nodes is much cheaper than looking at every element).
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(), i = 0; n && i < 60000; n = walker.nextNode(), i++) {
      const t = norm(n.nodeValue);
      if (t && t.length <= 80) consider(n.parentElement, t, 25);
    }
    // Labels that are not text: aria-label, placeholder, title.
    for (const el of document.body.querySelectorAll('[aria-label],[placeholder],[title]')) {
      for (const a of ['aria-label', 'placeholder', 'title']) {
        const v = norm(el.getAttribute(a));
        if (v) consider(el, v, 40);
      }
    }
    if (!best) return null;

    // A label alone inside a wrapper (a <span> in a <div> that looks like a button): point at the wrapper.
    const own = norm(best.textContent);
    for (let i = 0; own && i < 4 && best.parentElement && best.parentElement !== document.body; i++) {
      const parent = best.parentElement;
      const r = parent.getBoundingClientRect();
      if (norm(parent.textContent) !== own || r.width >= 700 || r.height >= 260) break;
      best = parent;
    }
    // A word inside a button: point at the whole button.
    const control = best.closest('button,[role=button],a,[role=tab],[role=menuitem],label');
    if (control && isShown(control)) {
      const r = control.getBoundingClientRect();
      if (r.width < 700 && r.height < 260) best = control;
    }
    // A panel title: point at the whole panel (the nearest big box around it).
    if (show.scope === 'panel') {
      for (let el = best; el && el !== document.body; el = el.parentElement) {
        const r = el.getBoundingClientRect();
        if (r.width >= 220 && r.height >= 300) { best = el; break; }
      }
    }
    return best;
  }

  KH.finder = { findTarget };
})();
