// The elements the maker puts on the page (inside a shadow root, so the page's own styles cannot touch them).
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const { h } = LM.util;

  const host = h('div', { id: 'lesson-maker-root' });
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet(); // a constructed sheet works even where pages restrict inline styles
  sheet.replaceSync(LM.css);
  root.adoptedStyleSheets = [sheet];

  LM.ui = {
    host,
    root,
    spot: h('div', { class: 'spot', hidden: true }),
    banner: h('div', { class: 'banner', dir: 'rtl', lang: 'he', role: 'status', hidden: true }),
    panel: h('div', { class: 'panel', dir: 'rtl', lang: 'he', hidden: true }),
    launcher: h('button', {
      class: 'launcher', title: 'מכין השיעורים', 'aria-label': 'מכין השיעורים',
      onclick: () => LM.actions.setOpen(!LM.state.open),
    }, '📸'),
  };
})();
