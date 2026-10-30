// What the helper currently shows, and what it remembers between visits (only on this computer).
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const STORE_KEY = 'kidHelper';

  KH.state = {
    lessons: [],
    lesson: null,        // the lesson being shown, or null for the lesson list
    step: 0,
    open: false,
    side: 'left',        // which bottom corner the panel sits in
    done: {},            // lesson id -> true, shown as a star
    more: false,         // "a bit more" text open
    autoRead: false,
    playing: false,      // a lesson that plays by itself is running
    target: null,        // the page element the current step points at
    scrolled: false,
    lastSearch: 0,
    status: '',
  };

  KH.store = {
    save() {
      const s = KH.state;
      try {
        chrome.storage.local.set({ [STORE_KEY]: { done: s.done, side: s.side, autoRead: s.autoRead } });
      } catch { /* storage is optional */ }
    },
    async load() {
      const s = KH.state;
      try {
        const saved = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
        s.done = saved.done || {};
        s.side = saved.side === 'right' ? 'right' : 'left';
        s.autoRead = !!saved.autoRead;
      } catch { /* start fresh */ }
    },
  };
})();
