// Reads a step aloud in Hebrew, if the computer has a Hebrew voice.
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});

  KH.speech = {
    stop() {
      try { speechSynthesis.cancel(); } catch { /* no speech on this computer */ }
    },
    speak(text) {
      try {
        speechSynthesis.cancel();
        if (!speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('he'))) {
          KH.views.setStatus('אין במחשב הזה קול בעברית להקראה.');
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'he-IL';
        u.rate = 0.9;
        speechSynthesis.speak(u);
      } catch { /* no speech on this computer */ }
    },
  };
})();
