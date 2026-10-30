// Runs inside the page (Playwright serialises it), so it must not use anything from outside.
// Finds the main regions of the page: landmarks (header, nav, main, aside, ...) and, when a page
// has few of those, the big layout blocks. Positions are in page coordinates (CSS pixels).
function collectOutline() {
  const MAX_REGIONS = 30;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sx = window.scrollX;
  const sy = window.scrollY;
  const doc = document.documentElement;
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/[^\w-]/g, '\\$&'));

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  // Shortest chain of tag names (with :nth-of-type) that finds exactly this element.
  const isUnique = (sel, el) => {
    try { return document.querySelectorAll(sel).length === 1 && document.querySelector(sel) === el; } catch { return false; }
  };
  const cssPath = (el) => {
    const parts = [];
    for (let node = el; node && node.nodeType === 1 && node !== doc; node = node.parentElement) {
      if (node.id && isUnique('#' + esc(node.id), node)) {
        parts.unshift('#' + esc(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      if (isUnique(parts.join(' > '), el)) break;
    }
    return parts.join(' > ');
  };

  const ROLE_BY_TAG = { header: 'banner', nav: 'navigation', main: 'main', aside: 'complementary', footer: 'contentinfo', form: 'form', article: 'article', section: 'section', dialog: 'dialog' };
  const roleOf = (el) => el.getAttribute('role') || ROLE_BY_TAG[el.tagName.toLowerCase()] || el.tagName.toLowerCase();

  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria).slice(0, 80);
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => clean(n.textContent)).join(' ');
      if (t) return t.slice(0, 80);
    }
    const h = el.querySelector('h1,h2,h3,h4,[role=heading]');
    if (h && clean(h.textContent)) return clean(h.textContent).slice(0, 80);
    return clean(el.innerText).slice(0, 60);
  };

  const found = []; // { el, role, r }
  const seen = new Set();
  const add = (el, role) => {
    if (seen.has(el) || !visible(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 2000) return; // ignore tiny things
    seen.add(el);
    found.push({ el, role, r });
  };

  document.querySelectorAll('header, nav, main, aside, footer, form, article, section, dialog, [role=banner], [role=navigation], [role=main], [role=complementary], [role=contentinfo], [role=search], [role=region], [role=dialog], [role=tablist], [role=toolbar]')
    .forEach((el) => add(el, roleOf(el)));

  // Apps built from plain <div>s have few landmarks: walk down from <body> and take the big blocks.
  if (found.length < 4) {
    const big = (el) => {
      const r = el.getBoundingClientRect();
      return visible(el) && r.width >= 120 && r.height >= 80 && r.width * r.height >= vw * vh * 0.03;
    };
    const walk = (el, depth) => {
      if (depth > 5) return;
      const kids = Array.from(el.children).filter(big);
      if (kids.length === 1) return walk(kids[0], depth + 1); // a wrapper: look inside it
      kids.forEach((k) => { add(k, 'block'); walk(k, depth + 1); });
    };
    walk(document.body, 0);
  }

  // Drop a region that is just a wrapper with the same size as one that contains it.
  const area = (x) => x.r.width * x.r.height;
  const kept = [];
  [...found].sort((a, b) => area(b) - area(a)).forEach((x) => {
    if (!kept.some((k) => k.el.contains(x.el) && area(k) / area(x) < 1.08)) kept.push(x);
  });
  const top = kept.slice(0, MAX_REGIONS)
    .sort((a, b) => (Math.round(a.r.top / 20) - Math.round(b.r.top / 20)) || (a.r.left - b.r.left));

  const regions = top.map((x, i) => ({
    n: i + 1,
    role: x.role,
    label: labelOf(x.el),
    selector: cssPath(x.el),
    box: { x: Math.round(x.r.left + sx), y: Math.round(x.r.top + sy), width: Math.round(x.r.width), height: Math.round(x.r.height) },
    chars: clean(x.el.innerText).length,
    snippet: clean(x.el.innerText).slice(0, 140),
  }));

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).filter(visible).slice(0, 40).map((h) => ({
    level: Number(h.tagName[1]),
    text: clean(h.textContent).slice(0, 100),
    y: Math.round(h.getBoundingClientRect().top + sy),
  }));

  const seenLabels = new Set();
  const buttons = [];
  document.querySelectorAll('button, [role=button], input[type=submit], input[type=button]').forEach((b) => {
    if (!visible(b)) return;
    const t = clean(b.getAttribute('aria-label') || b.innerText || b.value).slice(0, 40);
    if (t && !seenLabels.has(t) && buttons.length < 25) { seenLabels.add(t); buttons.push(t); }
  });

  const count = (sel) => Array.from(document.querySelectorAll(sel)).filter(visible).length;
  return {
    title: document.title,
    language: doc.lang || '',
    direction: getComputedStyle(doc).direction, // 'rtl' for Hebrew / Arabic pages
    screen: { width: vw, height: vh },
    page: { width: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0), height: Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0) },
    regions,
    headings,
    buttons,
    counts: { links: count('a[href]'), inputs: count('input, textarea, select'), images: count('img') },
  };
}

module.exports = { collectOutline };
