// Draws the maker panel.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const { h } = LM.util;
  const a = LM.actions;

  function render() {
    const s = LM.state;
    const { panel, launcher } = LM.ui;
    panel.textContent = '';
    launcher.hidden = s.open;
    panel.hidden = !s.open;
    if (!s.open) { LM.picker.placeFrame(); return; }
    panel.className = `panel ${s.side}`;

    panel.append(h('div', { class: 'head' },
      h('span', { class: 'title' }, '📸 מכין השיעורים'),
      h('button', { class: 'icon', title: 'הגדרות', 'aria-label': 'הגדרות', onclick: () => a.openSettings() }, '⚙️'),
      h('button', { class: 'icon', title: 'להזיז לצד השני', 'aria-label': 'להזיז לצד השני', onclick: () => a.toggleSide() }, '↔️'),
      h('button', { class: 'icon', title: 'לסגור', 'aria-label': 'לסגור', onclick: () => a.setOpen(false) }, '✖️'),
    ));

    panel.append(h('label', { for: 'lm-project' }, 'שם הפרויקט (השיעור)'));
    panel.append(h('input', {
      id: 'lm-project', value: s.project, placeholder: 'למשל: מכירים את NotebookLM',
      oninput: (e) => { s.project = e.target.value; LM.store.save(); },
    }));

    panel.append(h('label', { for: 'lm-note' }, 'הערה לשלב הזה'));
    panel.append(h('textarea', {
      id: 'lm-note', value: s.note, placeholder: 'מה הילד צריך לעשות או להבין בשלב הזה?',
      oninput: (e) => { s.note = e.target.value; },
    }));

    panel.append(h('div', { class: 'marked' }, s.target ? `🎯 סומן: "${s.targetLabel}"` : 'לא סומן כפתור (אפשר לשמור גם בלי)'));
    panel.append(h('div', { class: 'row' },
      h('button', { class: s.picking ? 'on' : '', onclick: () => a.togglePick() }, s.picking ? '✋ ביטול בחירה' : '🎯 סמן כפתור'),
      s.target ? h('button', { onclick: () => a.clearTarget() }, '🗑️ בטל סימון') : null,
    ));
    if (s.picking) panel.append(h('p', { class: 'hint' }, 'לחצו על הכפתור במסך. (Esc לביטול)'));

    panel.append(h('button', { class: 'save', disabled: s.busy, onclick: () => a.save() }, s.busy ? 'שומר...' : '📸 שמור מסך'));
    if (s.status) panel.append(h('p', { class: `status ${s.statusKind}`, role: 'status' }, s.status));
    LM.picker.placeFrame();
  }

  LM.views = { render };
})();
