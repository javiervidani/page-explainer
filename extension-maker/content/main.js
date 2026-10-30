// Start-up: put the maker on the page, listen for the toolbar button, load the remembered settings.
(() => {
  const LM = window.LessonMaker;
  if (LM.started) return; // never start twice in one page
  LM.started = true;

  const { ui, state } = LM;
  ui.root.append(ui.spot, ui.launcher, ui.panel, ui.banner);
  document.documentElement.append(ui.host);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') LM.actions.setOpen(!state.open);
  });
  setInterval(LM.picker.placeFrame, 250);
  addEventListener('resize', LM.picker.placeFrame);
  addEventListener('scroll', LM.picker.placeFrame, true);

  LM.store.load().then(() => LM.views.render());
})();
