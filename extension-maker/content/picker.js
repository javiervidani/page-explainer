// "Mark the button": while picking, the element under the cursor gets a dashed frame and a click chooses it
// (the page does not get that click). The chosen element keeps a solid yellow frame, which is part of the picture.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const { labelOf } = LM.util;

  const CONTROL = 'button,[role=button],[role=tab],[role=menuitem],a[href],label,input,textarea,select';
  const BLOCKED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];

  // Puts the frame on the hovered element (while picking) or on the marked one.
  function placeFrame() {
    const s = LM.state;
    const spot = LM.ui.spot;
    const el = s.picking ? s.hover : s.target;
    if (!el || !el.isConnected || !(s.open || s.remote)) { spot.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    spot.hidden = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
    spot.className = s.picking ? 'spot hover' : 'spot';
    Object.assign(spot.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
  }

  // The element under the cursor, unless that is our own panel.
  function underCursor(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return !el || el === LM.ui.host ? null : el;
  }

  function onMove(e) {
    const el = underCursor(e);
    if (el) {
      LM.state.hover = el.closest(CONTROL) || el;
      placeFrame();
    }
  }

  function onBlocked(e) {
    if (e.target === LM.ui.host) return; // our own panel keeps working
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type !== 'click') return;
    const el = underCursor(e);
    if (!el) return;
    const s = LM.state;
    s.target = el.closest(CONTROL) || el;
    s.targetLabel = labelOf(s.target);
    stop();
    LM.views.render();
  }

  function onKey(e) {
    if (e.key === 'Escape') { stop(); LM.views.render(); }
  }

  function start() {
    LM.state.picking = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('keydown', onKey, true);
    for (const t of BLOCKED) document.addEventListener(t, onBlocked, true);
    placeFrame();
  }

  function stop() {
    LM.state.picking = false;
    LM.state.hover = null;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('keydown', onKey, true);
    for (const t of BLOCKED) document.removeEventListener(t, onBlocked, true);
    placeFrame();
  }

  LM.picker = { start, stop, placeFrame };
})();
