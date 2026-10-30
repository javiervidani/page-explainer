// The elements the helper puts on the page (inside a shadow root, so the page's own styles cannot touch them).
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const { h } = KH.util;

  const host = h('div', { id: 'kid-helper-root' });
  const root = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet(); // a constructed sheet works even where pages restrict inline styles
  sheet.replaceSync(KH.css);
  root.adoptedStyleSheets = [sheet];

  KH.ui = {
    host,
    root,
    spot: h('div', { class: 'spot', hidden: true }),
    panel: h('div', { class: 'panel', dir: 'rtl', lang: 'he', hidden: true }),
    launcher: h('button', {
      class: 'launcher', title: 'עוזר הלמידה', 'aria-label': 'עוזר הלמידה',
      onclick: () => KH.actions.setOpen(!KH.state.open),
    }, '🦉'),
    statusEl: null, // the message line of the current step, set by the views
  };
})();
