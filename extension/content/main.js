// Start-up: put the helper on the page, listen for the toolbar button and the Escape key, load the lessons.
(() => {
  const KH = window.KidHelper;
  if (KH.started) return; // never start twice in one page
  KH.started = true;

  const { ui, state } = KH;
  ui.root.append(ui.spot, ui.launcher, ui.panel);
  document.documentElement.append(ui.host);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') KH.actions.setOpen(!state.open);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.open) KH.actions.setOpen(false);
  });
  setInterval(KH.spotlight.tick, 300);
  addEventListener('resize', KH.spotlight.placeSpot);
  addEventListener('scroll', KH.spotlight.placeSpot, true);

  Promise.all([
    KH.store.load(),
    chrome.runtime.sendMessage({ type: 'lessons' }).catch(() => []),
  ]).then(([, lessons]) => {
    state.lessons = Array.isArray(lessons) ? lessons : [];
    KH.views.render();
  });
})();
