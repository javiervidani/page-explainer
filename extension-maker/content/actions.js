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
  function collectPayload() {
    const r = s.target && s.target.isConnected ? s.target.getBoundingClientRect() : null;
    return {
      project: s.project.trim(),
      note: s.note.trim(),
      target: r ? { label: s.targetLabel, box: { x: r.left, y: r.top, width: r.width, height: r.height } } : null,
      labels: LM.labels.collectLabels(),
      page: {
        host: location.hostname, path: location.pathname, title: document.title,
        width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio,
      },
    };
  }

  // Hides this panel (so it is not in the picture; the yellow frame stays), takes the picture and uploads it.
  async function save() {
    if (s.busy) return;
    if (!s.project.trim()) { setStatus('כתבו קודם שם פרויקט (שם השיעור).', 'bad'); return LM.views.render(); }
    s.busy = true;
    if (s.picking) LM.picker.stop();
    LM.ui.panel.hidden = true;
    LM.ui.launcher.hidden = true;
    await sleep(250); // let the page repaint without the panel
    let result;
    try {
      result = await chrome.runtime.sendMessage({ type: 'saveCapture', payload: collectPayload() });
    } catch (err) {
      result = { error: 'ההרחבה לא הגיבה. נסו לרענן את הדף.' };
    }
    s.busy = false;
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

  LM.actions = { setOpen, togglePick, clearTarget, toggleSide, openSettings, save, setStatus };
})();
