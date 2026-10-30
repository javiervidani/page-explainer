// The yellow frame that sits on the part of the page the current step talks about.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const { isShown } = KH.util;

  // Puts the frame on the target (or hides it when there is none or it is off screen).
  function placeSpot() {
    const s = KH.state;
    const spot = KH.ui.spot;
    const el = s.target;
    if (!el || !el.isConnected || !s.open || !s.lesson) { spot.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    spot.hidden = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
    Object.assign(spot.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
  }

  // Runs a few times a second: (re)finds the target when the page changes, keeps the frame on it.
  function tick() {
    const s = KH.state;
    if (!s.open || !s.lesson) { KH.ui.spot.hidden = true; return; }
    const step = s.lesson.steps[s.step];
    const lost = !s.target || !s.target.isConnected || !isShown(s.target);
    if (step.show && lost && Date.now() - s.lastSearch > 800) {
      s.lastSearch = Date.now();
      s.target = KH.finder.findTarget(step.show);
      if (s.target && !s.scrolled) {
        s.scrolled = true;
        s.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      KH.views.setStatus(s.target ? '' : 'לא מצאתי את זה על המסך. אולי צריך ללחוץ על משהו קודם? אפשר לבקש עזרה ממבוגר. 🙂');
    }
    placeSpot();
  }

  KH.spotlight = { placeSpot, tick };
})();
