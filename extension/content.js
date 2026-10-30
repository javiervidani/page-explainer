// Kid helper: a floating panel with short lessons, and a frame that highlights the part of the
// page each step talks about. Everything happens in this page, on this computer: nothing is sent
// anywhere, and the text of the notebook is never read (only button and panel names are looked up).
(() => {
  if (window.__kidHelper) return; // already running in this page
  window.__kidHelper = true;

  const STORE_KEY = 'kidHelper';
  const state = {
    lessons: [],
    lesson: null,        // the lesson being shown, or null for the lesson list
    step: 0,
    open: false,
    side: 'left',        // which bottom corner the panel sits in
    done: {},            // lesson id -> true, shown as a star
    more: false,         // "a bit more" text open
    autoRead: false,
    target: null,        // the page element the current step points at
    scrolled: false,
    lastSearch: 0,
    status: '',
  };

  // ---------- small helpers ----------

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

  function save() {
    try {
      chrome.storage.local.set({ [STORE_KEY]: { done: state.done, side: state.side, autoRead: state.autoRead } });
    } catch { /* storage is optional */ }
  }

  // ---------- finding the part of the page a step talks about ----------

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
      if (!el || host.contains(el) || !isShown(el)) return;
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

  // ---------- the highlight frame ----------

  const spot = h('div', { class: 'spot', hidden: true });

  function placeSpot() {
    const el = state.target;
    if (!el || !el.isConnected || !state.open || !state.lesson) { spot.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const pad = 6;
    const outside = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
    spot.hidden = outside;
    Object.assign(spot.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
  }

  // Runs a few times a second: (re)finds the target when the page changes, keeps the frame on it.
  function tick() {
    if (!state.open || !state.lesson) { spot.hidden = true; return; }
    const step = state.lesson.steps[state.step];
    if (step.show && (!state.target || !state.target.isConnected || !isShown(state.target)) && Date.now() - state.lastSearch > 800) {
      state.lastSearch = Date.now();
      state.target = findTarget(step.show);
      if (state.target && !state.scrolled) {
        state.scrolled = true;
        state.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setStatus(state.target ? '' : 'לא מצאתי את זה על המסך. אולי צריך ללחוץ על משהו קודם? אפשר לבקש עזרה ממבוגר. 🙂');
    }
    placeSpot();
  }

  // ---------- panel ----------

  const panel = h('div', { class: 'panel', dir: 'rtl', lang: 'he', hidden: true });
  const launcher = h('button', { class: 'launcher', title: 'עוזר הלמידה', 'aria-label': 'עוזר הלמידה', onclick: () => setOpen(!state.open) }, '🦉');
  let statusEl = null;

  function setStatus(text) {
    state.status = text;
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.hidden = !text;
    }
  }

  function setOpen(open) {
    state.open = open;
    if (!open) speechSynthesis.cancel();
    render();
  }

  function speak(text) {
    try {
      speechSynthesis.cancel();
      if (!speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('he'))) {
        setStatus('אין במחשב הזה קול בעברית להקראה.');
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch { /* no speech on this computer */ }
  }

  function openLesson(lesson) {
    state.lesson = lesson;
    goTo(0);
  }

  function goTo(i) {
    state.step = i;
    state.more = false;
    state.target = null;
    state.scrolled = false;
    state.lastSearch = 0;
    state.status = '';
    render();
    const step = state.lesson.steps[i];
    if (state.autoRead) speak(`${step.title}. ${step.text}`);
    tick();
  }

  function finishLesson() {
    state.done[state.lesson.id] = true;
    save();
    state.lesson = null;
    state.target = null;
    speechSynthesis.cancel();
    render();
  }

  function header(title, emoji) {
    return h('div', { class: 'head' },
      h('span', { class: 'title' }, `${emoji} ${title}`),
      h('button', { class: 'icon', title: 'להזיז לצד השני', 'aria-label': 'להזיז לצד השני', onclick: () => { state.side = state.side === 'left' ? 'right' : 'left'; save(); render(); } }, '↔️'),
      h('button', { class: 'icon', title: 'לסגור', 'aria-label': 'לסגור', onclick: () => setOpen(false) }, '✖️'),
    );
  }

  function renderList() {
    const lessons = state.lessons.filter((l) => l.site === location.hostname);
    panel.append(header('עוזר הלמידה', '🦉'));
    panel.append(h('p', { class: 'text' }, 'מה נלמד היום?'));
    if (lessons.length === 0) panel.append(h('p', { class: 'note' }, 'אין עדיין שיעורים לאתר הזה.'));
    for (const l of lessons) {
      panel.append(h('button', { class: 'card', onclick: () => openLesson(l) },
        h('span', { class: 'big' }, l.emoji || '📘'),
        h('span', { class: 'cardtext' }, h('b', {}, l.title), h('small', {}, l.age || '')),
        state.done[l.id] ? h('span', { class: 'star', title: 'סיימנו!' }, '⭐') : null,
      ));
    }
  }

  function renderStep() {
    const lesson = state.lesson;
    const step = lesson.steps[state.step];
    const last = state.step === lesson.steps.length - 1;
    panel.append(header(lesson.title, lesson.emoji || '📘'));

    panel.append(h('div', { class: 'dots', 'aria-hidden': 'true' },
      lesson.steps.map((_, i) => h('i', { class: i === state.step ? 'on' : i < state.step ? 'past' : '' }))));
    panel.append(h('p', { class: 'count' }, `שלב ${state.step + 1} מתוך ${lesson.steps.length}`));
    panel.append(h('h2', { class: 'stepTitle' }, step.title));
    panel.append(h('p', { class: 'text' }, step.text));
    if (state.more && step.more) panel.append(h('p', { class: 'more' }, step.more));

    statusEl = h('p', { class: 'note', role: 'status', hidden: !state.status }, state.status);
    panel.append(statusEl);

    const tools = h('div', { class: 'tools' },
      h('button', { class: 'tool', onclick: () => speak(`${step.title}. ${step.text}${state.more && step.more ? `. ${step.more}` : ''}`) }, '🔊 להקריא'),
      step.show ? h('button', { class: 'tool', onclick: () => { state.target = null; state.scrolled = false; state.lastSearch = 0; tick(); } }, '👀 הראה לי') : null,
      step.more ? h('button', { class: 'tool', onclick: () => { state.more = !state.more; render(); } }, state.more ? '💡 פחות' : '💡 עוד קצת') : null,
      h('button', { class: `tool ${state.autoRead ? 'active' : ''}`, title: 'להקריא כל שלב אוטומטית', onclick: () => { state.autoRead = !state.autoRead; save(); render(); } }, state.autoRead ? '🔊 קריאה: פועלת' : '🔇 קריאה: כבויה'),
    );
    panel.append(tools);

    panel.append(h('div', { class: 'nav' },
      state.step > 0
        ? h('button', { class: 'nextprev', onclick: () => goTo(state.step - 1) }, '→ הקודם')
        : h('button', { class: 'nextprev', onclick: () => { state.lesson = null; state.target = null; render(); } }, '→ לרשימה'),
      last
        ? h('button', { class: 'primary', onclick: finishLesson }, 'סיימתי! ⭐')
        : h('button', { class: 'primary', onclick: () => goTo(state.step + 1) }, 'הבא ←'),
    ));
  }

  function render() {
    panel.textContent = '';
    statusEl = null;
    launcher.hidden = state.open;
    panel.hidden = !state.open;
    if (!state.open) { spot.hidden = true; return; }
    panel.className = `panel ${state.side}`;
    if (state.lesson) renderStep();
    else renderList();
    placeSpot();
  }

  // ---------- look ----------

  const css = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif; }
    [hidden] { display: none !important; }
    .launcher { position: fixed; bottom: 18px; left: 18px; width: 60px; height: 60px; border-radius: 50%; border: 3px solid #fff;
      background: #6c4ff5; font-size: 32px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35); z-index: 2147483646; }
    .launcher:hover { background: #5a3de0; }
    .panel { position: fixed; bottom: 18px; width: 360px; max-width: calc(100vw - 36px); max-height: calc(100vh - 36px); overflow: auto;
      background: #fffdf5; color: #222; border: 4px solid #6c4ff5; border-radius: 22px; padding: 14px 16px 16px; font-size: 19px; line-height: 1.45;
      box-shadow: 0 8px 28px rgba(0,0,0,.4); z-index: 2147483646; }
    .panel.left { left: 18px; } .panel.right { right: 18px; }
    .head { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
    .title { flex: 1; font-weight: 700; font-size: 18px; color: #4b34c9; }
    .icon { border: 0; background: #eee; border-radius: 10px; width: 38px; height: 38px; font-size: 18px; cursor: pointer; }
    .dots { display: flex; gap: 5px; margin: 6px 0 2px; }
    .dots i { width: 12px; height: 12px; border-radius: 50%; background: #ddd; display: block; }
    .dots i.past { background: #9d8cf7; } .dots i.on { background: #6c4ff5; outline: 3px solid #cfc7fb; }
    .count { margin: 4px 0 0; font-size: 14px; color: #666; }
    .stepTitle { margin: 4px 0 6px; font-size: 26px; line-height: 1.25; color: #222; }
    .text { margin: 0 0 8px; font-size: 21px; }
    .more { margin: 0 0 8px; padding: 10px 12px; background: #fff3c4; border-radius: 12px; font-size: 18px; }
    .note { margin: 6px 0; padding: 8px 10px; background: #ffe3e3; border-radius: 12px; font-size: 16px; }
    .tools { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .tool { border: 2px solid #6c4ff5; background: #fff; color: #4b34c9; border-radius: 12px; padding: 8px 12px; font-size: 16px; cursor: pointer; }
    .tool.active { background: #e9e4ff; }
    .nav { display: flex; gap: 10px; margin-top: 6px; }
    .nav button { flex: 1; min-height: 52px; border-radius: 14px; font-size: 20px; font-weight: 700; cursor: pointer; }
    .nextprev { border: 2px solid #6c4ff5; background: #fff; color: #4b34c9; }
    .primary { border: 0; background: #6c4ff5; color: #fff; }
    .primary:hover { background: #5a3de0; }
    .card { display: flex; align-items: center; gap: 12px; width: 100%; margin: 8px 0; padding: 12px; text-align: right;
      border: 2px solid #cfc7fb; background: #fff; border-radius: 16px; cursor: pointer; font-size: 20px; }
    .card:hover { background: #f3f0ff; border-color: #6c4ff5; }
    .big { font-size: 38px; } .cardtext { flex: 1; display: flex; flex-direction: column; } .cardtext small { color: #666; font-size: 14px; }
    .star { font-size: 28px; }
    .spot { position: fixed; z-index: 2147483645; pointer-events: none; border: 5px solid #ffcc00; border-radius: 14px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.35), 0 0 18px 6px rgba(255,204,0,.8); animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 50% { border-color: #ff8a00; box-shadow: 0 0 0 9999px rgba(0,0,0,.35), 0 0 26px 10px rgba(255,138,0,.9); } }
  `;

  // ---------- start ----------

  const host = h('div', { id: 'kid-helper-root' });
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet(); // a constructed sheet works even where pages restrict inline styles
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  root.append(spot, launcher, panel);
  document.documentElement.append(host);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') setOpen(!state.open);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) setOpen(false); });
  setInterval(tick, 300);
  addEventListener('resize', placeSpot);
  addEventListener('scroll', placeSpot, true);

  Promise.all([
    chrome.storage.local.get(STORE_KEY).catch(() => ({})),
    chrome.runtime.sendMessage({ type: 'lessons' }).catch(() => []),
  ]).then(([stored, lessons]) => {
    const saved = (stored && stored[STORE_KEY]) || {};
    state.done = saved.done || {};
    state.side = saved.side === 'right' ? 'right' : 'left';
    state.autoRead = !!saved.autoRead;
    state.lessons = Array.isArray(lessons) ? lessons : [];
    render();
  });
})();
