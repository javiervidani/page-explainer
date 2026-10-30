// Plays a lesson by itself: for each step it shows the slide, frames the button on the page, tells the
// narration (an audio file from the lesson, or the browser's Hebrew voice), waits a moment and goes on.
// The child can pause, go back or forward at any time. Lessons made from Talkdeck bring their own audio.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});
  const s = KH.state;

  let timer = null;
  let audio = null;
  let token = 0; // changes whenever playback restarts, so a late "finished" from an old step is ignored

  function clear() {
    clearTimeout(timer);
    timer = null;
    KH.speech.stop();
    if (audio) { audio.pause(); audio = null; }
    token++;
  }

  function next() {
    if (!s.playing || !s.lesson) return;
    if (s.step >= s.lesson.steps.length - 1) KH.actions.finishLesson();
    else KH.actions.goTo(s.step + 1);
  }

  // Tells the narration of the current step, then goes on to the next step.
  function playStep() {
    clear();
    if (!s.playing || !s.lesson) return;
    const step = s.lesson.steps[s.step];
    const mine = token;
    const text = step.narration || step.text;

    const advance = () => {
      if (mine !== token || !s.playing) return; // an old step, or paused
      token++;                                  // each step moves on only once
      clearTimeout(timer);
      timer = setTimeout(next, (s.lesson.pauseSeconds ?? 1.5) * 1000);
    };
    // No voice or audio: keep going after a time that fits the text, so the child can read the slide.
    const silent = () => {
      if (mine !== token) return;
      clearTimeout(timer);
      timer = setTimeout(advance, Math.max(3000, text.length * 70));
    };

    timer = setTimeout(advance, Math.max(8000, text.length * 150)); // safety: some computers never report the end
    if (step.audio) {
      audio = new Audio(chrome.runtime.getURL(`lessons/${step.audio}`));
      audio.onended = advance;
      audio.onerror = silent;
      audio.play().catch(silent);
    } else {
      KH.speech.speak(text, { onEnd: advance, onFail: silent });
    }
  }

  function setPlaying(on) {
    s.playing = on;
    if (on) playStep();
    else clear();
  }

  KH.player = {
    playStep,
    setPlaying,
    stop() { s.playing = false; clear(); },
  };
})();
