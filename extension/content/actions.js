// What happens when the child presses something: open or close, change step, finish a lesson, settings.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const s = KH.state;

  function setOpen(open) {
    s.open = open;
    if (!open) KH.speech.stop();
    KH.views.render();
  }

  function goTo(i) {
    s.step = i;
    s.more = false;
    s.target = null;
    s.scrolled = false;
    s.lastSearch = 0;
    s.status = '';
    KH.views.render();
    const step = s.lesson.steps[i];
    if (s.autoRead) KH.speech.speak(`${step.title}. ${step.text}`);
    KH.spotlight.tick();
  }

  function openLesson(lesson) {
    s.lesson = lesson;
    goTo(0);
  }

  function backToList() {
    s.lesson = null;
    s.target = null;
    KH.views.render();
  }

  function finishLesson() {
    s.done[s.lesson.id] = true;
    KH.store.save();
    KH.speech.stop();
    backToList();
  }

  function readStep() {
    const step = s.lesson.steps[s.step];
    KH.speech.speak(`${step.title}. ${step.text}${s.more && step.more ? `. ${step.more}` : ''}`);
  }

  // "Show me" again: look for the target again and scroll to it.
  function showAgain() {
    s.target = null;
    s.scrolled = false;
    s.lastSearch = 0;
    KH.spotlight.tick();
  }

  function toggleSide() {
    s.side = s.side === 'left' ? 'right' : 'left';
    KH.store.save();
    KH.views.render();
  }

  function toggleAutoRead() {
    s.autoRead = !s.autoRead;
    KH.store.save();
    KH.views.render();
  }

  function toggleMore() {
    s.more = !s.more;
    KH.views.render();
  }

  KH.actions = { setOpen, goTo, openLesson, backToList, finishLesson, readStep, showAgain, toggleSide, toggleAutoRead, toggleMore };
})();
