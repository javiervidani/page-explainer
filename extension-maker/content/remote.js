// Auto mode: the author turns it on, gets a 6-digit code (shown in a banner), and a chat that knows the code can ask this page for
// two things: the names on the screen, and "mark this button and save the screen". Nothing is clicked or typed.
// Safeguards: opt-in each time, at most 30 minutes (the server enforces it too), a banner with a stop button, this page only.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const s = LM.state;
  const { h } = LM.util;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // After the extension is updated, an open tab keeps the old page script, and sendMessage then throws at once
  // (not only as a rejected promise), so both cases are caught here.
  const failed = (m, e) => {
    LM.log(`${m.type} failed: ${e.message}`);
    const stale = /context invalidated/i.test(e.message);
    return { error: stale ? 'ההרחבה עודכנה, והדף הזה עדיין ישן. רעננו את הדף (F5) ואז נסו שוב.' : `ההרחבה לא הגיבה (${String(e.message).slice(0, 60)}). נסו לרענן את הדף.` };
  };
  const send = async (m) => { try { return await chrome.runtime.sendMessage(m); } catch (e) { return failed(m, e); } };
  let timer = null;
  let timeEl = null;
  let countEl = null;

  const minutes = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  function buildBanner(run) {
    const b = LM.ui.banner;
    timeEl = h('b');
    countEl = h('span');
    b.textContent = '';
    b.append(
      h('span', { class: 'dot' }, '🔴 מצב אוטומטי פעיל'),
      h('span', {}, 'קוד לשיחה: ', h('b', { class: 'code' }, run.code)),
      h('span', {}, 'נשאר ', timeEl),
      countEl,
      h('button', { class: 'stop', onclick: () => stop('המצב האוטומטי נעצר.') }, '⏹ עצור'),
    );
    b.hidden = false;
  }

  function paint() {
    if (!s.remote) return;
    timeEl.textContent = document.hidden ? `${minutes(s.remote.until - Date.now())} (הלשונית ברקע)` : minutes(s.remote.until - Date.now());
    countEl.textContent = s.remote.count ? `· ${s.remote.count} בקשות` : '';
  }

  async function start() {
    if (s.remote || s.busy) return;
    LM.actions.setStatus('מפעיל מצב אוטומטי...');
    LM.views.render();
    LM.log('auto mode: start pressed');
    const r = await send({ type: 'remoteArm' });
    LM.log(r.code ? 'auto mode: armed' : `auto mode: not armed, ${r.error || 'no answer'}`);
    if (!r || !r.code) {
      LM.actions.setStatus((r && r.error) || 'לא הצלחתי להפעיל.', 'bad');
      return LM.views.render();
    }
    const run = (s.remote = { code: r.code, until: r.armedUntil, count: 0 });
    buildBanner(run);
    paint();
    timer = setInterval(() => (Date.now() >= run.until ? stop('עברו 30 דקות, המצב האוטומטי נעצר.') : paint()), 1000);
    LM.actions.setStatus('');
    LM.views.render();
    loop(run);
  }

  function stop(why) {
    const run = s.remote;
    if (!run) return;
    s.remote = null;
    clearInterval(timer);
    LM.ui.banner.hidden = true;
    send({ type: 'remoteStop', code: run.code });
    LM.actions.setStatus(why || 'המצב האוטומטי נעצר.');
    LM.picker.placeFrame();
    LM.views.render();
  }

  async function loop(run) {
    while (s.remote === run) {
      const r = await send({ type: 'remoteNext', code: run.code });
      if (s.remote !== run) return;
      if (r.gone || r.fatal) return stop(r.fatal ? r.error : 'המצב האוטומטי הסתיים בשרת.');
      if (r.error) { await sleep(3000); continue; }
      if (r.command) {
        const result = await handle(r.command);
        run.count++;
        paint();
        await send({ type: 'remoteResult', code: run.code, id: r.command.id, result });
      }
    }
  }

  async function handle(cmd) {
    if (document.hidden) return { ok: false, error: 'הלשונית של המחברת ברקע. בקשו מהכותב להעביר אותה לחזית.' };
    if (cmd.type === 'labels') return { ok: true, labels: LM.labels.collectLabels(), page: location.hostname };
    if (cmd.type === 'capture') return capture(cmd.args);
    return { ok: false, error: 'unknown command' };
  }

  // Marks the named button (or panel) with the yellow frame, takes the picture, puts everything back as it was.
  async function capture({ find, scope, note, project }) {
    if (s.busy) return { ok: false, error: 'The author is saving a screen right now. Try again in a moment.' };
    const found = LM.finder.find(find, scope);
    if (!found) return { ok: false, error: `Not found on screen: ${find.join(', ')}. Use remote_labels to see the names.` };
    const before = { target: s.target, label: s.targetLabel };
    found.el.scrollIntoView({ block: 'nearest' });
    s.target = found.el;
    s.targetLabel = LM.util.labelOf(found.el);
    LM.picker.placeFrame();
    await sleep(150);
    const r = await LM.actions.takePicture({ project, note, target: s.target, targetLabel: s.targetLabel });
    const marked = s.targetLabel;
    s.target = before.target;
    s.targetLabel = before.label;
    LM.picker.placeFrame();
    return r && r.ok ? { ok: true, id: r.id, marked } : { ok: false, error: (r && r.error) || 'The extension could not save the screen.' };
  }

  LM.remote = { start, stop };
})();
