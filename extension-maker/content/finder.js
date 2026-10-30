// Finds a button or panel on screen by its name, for auto mode. Looks only; it never clicks.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const { clean, isShown, labelOf } = LM.util;

  const NAMED = 'button,[role=button],[role=tab],[role=menuitem],[role=link],a[href],[aria-label],h1,h2,h3,[role=heading]';
  const norm = (s) => clean(s).toLowerCase();

  // A bit larger than the element: the box that holds it, up to a panel size (never most of the window).
  function panelOf(el) {
    let cur = el;
    for (let i = 0; i < 6 && cur.parentElement && cur.parentElement !== document.body; i++) {
      const r = cur.parentElement.getBoundingClientRect();
      if (r.width > innerWidth * 0.6 || r.height > innerHeight * 0.9) break;
      cur = cur.parentElement;
      if (r.width >= 220 && r.height >= 160) break;
    }
    return cur;
  }

  // The first name that matches wins; an exact name beats a name that only contains the words.
  function find(names, scope) {
    const all = [...document.body.querySelectorAll(NAMED)].filter((e) => !LM.ui.host.contains(e) && isShown(e));
    const labels = new Map(all.map((e) => [e, norm(labelOf(e))]));
    for (const name of names) {
      const want = norm(name);
      if (!want) continue;
      const hit = all.find((e) => labels.get(e) === want) || all.find((e) => labels.get(e).length <= 60 && labels.get(e).includes(want));
      if (hit) return { el: scope === 'panel' ? panelOf(hit) : hit, name };
    }
    return null;
  }

  LM.finder = { find };
})();
