// What happens when the author presses something: open or close, mark a button, save the screen.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const s = LM.state;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function setOpen(open) {
    s.open = open;
    if (!open && s.picking) LM.picker.stop();
    LM.views.render();
  }

  function setStatus(text, kind = '') {
    s.status = text;
    s.statusKind = kind;
  }

  function togglePick() {
    if (s.picking) LM.picker.stop();
    else LM.picker.start();
    LM.views.render();
  }

  function clearTarget() {
    s.target = null;
    s.targetLabel = '';
    LM.views.render();
  }

  function toggleSide() {
    s.side = s.side === 'left' ? 'right' : 'left';
    LM.store.save();
    LM.views.render();
  }

  function openSettings() {
    chrome.runtime.sendMessage({ type: 'openSettings' });
  }

  // Everything the server needs besides the picture. Box positions are in the picture's own (CSS pixel) units.
  function collectPayload({ project, note, target, targetLabel, crop }) {
    const r = target && target.isConnected ? target.getBoundingClientRect() : null;
    return {
      project: project.trim(),
      note: (note || '').trim(),
      target: r ? { label: targetLabel, box: { x: r.left, y: r.top, width: r.width, height: r.height } } : null,
      crop: crop || null, // the background part keeps only this box of the picture (and moves the frame's box with it)
      labels: LM.labels.collectLabels(),
      page: {
        host: location.hostname, path: location.pathname, title: document.title,
        width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio,
      },
    };
  }

  // Hides the maker (so it is not in the picture; the yellow frame stays), takes the picture and uploads it.
  async function takePicture(details) {
    s.busy = true;
    if (s.picking) LM.picker.stop();
    LM.ui.panel.hidden = true;
    LM.ui.launcher.hidden = true;
    LM.ui.banner.hidden = true;
    await sleep(250); // let the page repaint without the panel
    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: 'saveCapture', payload: collectPayload(details) });
    } catch (err) {
      result = { error: 'ההרחבה לא הגיבה. נסו לרענן את הדף.' };
    }
    s.busy = false;
    LM.ui.banner.hidden = !s.remote;
    return result;
  }

  // The author pressed "save screen".
  async function save() {
    if (s.busy) return;
    if (!s.project.trim()) { setStatus('כתבו קודם שם פרויקט (שם השיעור).', 'bad'); return LM.views.render(); }
    const result = await takePicture(s);
    if (result && result.ok) {
      s.note = '';
      s.target = null;
      s.targetLabel = '';
      setStatus(`נשמר ✓ זה שלב ${result.inProject} בפרויקט "${result.project}"`, 'ok');
    } else {
      setStatus((result && result.error) || 'השמירה נכשלה.', 'bad');
    }
    LM.views.render();
  }

  LM.actions = { setOpen, togglePick, clearTarget, toggleSide, openSettings, save, takePicture, setStatus };
})();
