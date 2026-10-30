// What the maker panel shows now, and the few settings it remembers on this computer.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});

  LM.state = {
    open: false,
    side: 'right',     // the kids' helper lives at the bottom left, so this one starts on the right
    project: '',
    note: '',
    picking: false,    // waiting for a click on the button to mark
    hover: null,       // element under the cursor while picking
    target: null,      // the marked element
    targetLabel: '',
    busy: false,
    remote: null,      // auto mode: { code, until, count } while it is on
    status: '',
    statusKind: '',    // 'ok' or 'bad'
  };

  LM.store = {
    save() {
      const s = LM.state;
      try { chrome.storage.local.set({ project: s.project, side: s.side }); } catch { /* optional */ }
    },
    async load() {
      const s = LM.state;
      try {
        const saved = await chrome.storage.local.get(['project', 'side']);
        s.project = saved.project || '';
        s.side = saved.side === 'left' ? 'left' : 'right';
      } catch { /* start fresh */ }
    },
  };
})();
