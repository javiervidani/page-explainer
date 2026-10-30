// Runs inside the page (Playwright serialises it), so it must not use anything from outside.
// Text of the text nodes whose centre lies inside the region (page coordinates).
function textInRegion(reg) {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  for (let i = 0; i < 20000 && (node = walker.nextNode()); i++) {
    const t = node.nodeValue.trim();
    if (!t || !node.parentElement) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cx = r.left + window.scrollX + r.width / 2;
    const cy = r.top + window.scrollY + r.height / 2;
    if (cx >= reg.x && cx <= reg.x + reg.width && cy >= reg.y && cy <= reg.y + reg.height) out.push(t);
  }
  return out.join('\n');
}

module.exports = { textInRegion };
