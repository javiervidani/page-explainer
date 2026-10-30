// Draws the panel: the lesson list, or one step of a lesson.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const { h } = KH.util;
  const a = KH.actions;

  // The pink message line (for example "I could not find it on the screen").
  function setStatus(text) {
    KH.state.status = text;
    const el = KH.ui.statusEl;
    if (el) {
      el.textContent = text;
      el.hidden = !text;
    }
  }

  function header(title, emoji) {
    return h('div', { class: 'head' },
      h('span', { class: 'title' }, `${emoji} ${title}`),
      h('button', { class: 'icon', title: 'להזיז לצד השני', 'aria-label': 'להזיז לצד השני', onclick: () => a.toggleSide() }, '↔️'),
      h('button', { class: 'icon', title: 'לסגור', 'aria-label': 'לסגור', onclick: () => a.setOpen(false) }, '✖️'),
    );
  }

  function renderList(panel) {
    const s = KH.state;
    const lessons = s.lessons.filter((l) => [].concat(l.sites || l.site || []).includes(location.hostname));
    panel.append(header('עוזר הלמידה', '🦉'));
    panel.append(h('p', { class: 'text' }, 'מה נלמד היום?'));
    if (lessons.length === 0) panel.append(h('p', { class: 'note' }, 'אין עדיין שיעורים לאתר הזה.'));
    for (const l of lessons) {
      panel.append(h('button', { class: 'card', onclick: () => a.openLesson(l) },
        h('span', { class: 'big' }, l.emoji || '📘'),
        h('span', { class: 'cardtext' }, h('b', {}, l.title), h('small', {}, [l.age, l.autoplay ? '▶️ שיעור מנוגן' : ''].filter(Boolean).join(' · '))),
        s.done[l.id] ? h('span', { class: 'star', title: 'סיימנו!' }, '⭐') : null,
      ));
    }
  }

  function renderStep(panel) {
    const s = KH.state;
    const lesson = s.lesson;
    const step = lesson.steps[s.step];
    const last = s.step === lesson.steps.length - 1;
    panel.append(header(lesson.title, lesson.emoji || '📘'));

    panel.append(h('div', { class: 'dots', 'aria-hidden': 'true' },
      lesson.steps.map((_, i) => h('i', { class: i === s.step ? 'on' : i < s.step ? 'past' : '' }))));
    panel.append(h('p', { class: 'count' }, `שלב ${s.step + 1} מתוך ${lesson.steps.length}`));
    if (step.slide) panel.append(h('img', { class: 'slide', src: chrome.runtime.getURL(`lessons/${step.slide}`), alt: step.title }));
    panel.append(h('h2', { class: 'stepTitle' }, step.title));
    panel.append(h('p', { class: 'text' }, step.text));
    if (s.more && step.more) panel.append(h('p', { class: 'more' }, step.more));

    KH.ui.statusEl = h('p', { class: 'note', role: 'status', hidden: !s.status }, s.status);
    panel.append(KH.ui.statusEl);

    panel.append(h('div', { class: 'tools' },
      lesson.autoplay ? h('button', { class: `tool ${s.playing ? 'active' : ''}`, onclick: () => a.togglePlay() }, s.playing ? '⏸ עצור' : '▶️ נגן') : null,
      h('button', { class: 'tool', onclick: () => a.readStep() }, '🔊 להקריא'),
      step.show ? h('button', { class: 'tool', onclick: () => a.showAgain() }, '👀 הראה לי') : null,
      step.more ? h('button', { class: 'tool', onclick: () => a.toggleMore() }, s.more ? '💡 פחות' : '💡 עוד קצת') : null,
      h('button', { class: `tool ${s.autoRead ? 'active' : ''}`, title: 'להקריא כל שלב אוטומטית', onclick: () => a.toggleAutoRead() },
        s.autoRead ? '🔊 קריאה: פועלת' : '🔇 קריאה: כבויה'),
    ));

    panel.append(h('div', { class: 'nav' },
      s.step > 0
        ? h('button', { class: 'nextprev', onclick: () => a.goTo(s.step - 1) }, '→ הקודם')
        : h('button', { class: 'nextprev', onclick: () => a.backToList() }, '→ לרשימה'),
      last
        ? h('button', { class: 'primary', onclick: () => a.finishLesson() }, 'סיימתי! ⭐')
        : h('button', { class: 'primary', onclick: () => a.goTo(s.step + 1) }, 'הבא ←'),
    ));
  }

  // Redraws everything from the current state.
  function render() {
    const s = KH.state;
    const { panel, launcher, spot } = KH.ui;
    panel.textContent = '';
    KH.ui.statusEl = null;
    launcher.hidden = s.open;
    panel.hidden = !s.open;
    if (!s.open) { spot.hidden = true; return; }
    panel.className = `panel ${s.side}`;
    if (s.lesson) renderStep(panel);
    else renderList(panel);
    KH.spotlight.placeSpot();
  }

  KH.views = { render, setStatus };
})();
