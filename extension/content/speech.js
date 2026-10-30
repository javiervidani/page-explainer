// Reads text aloud in Hebrew, if the computer has a Hebrew voice. `onEnd` runs when the speech is over;
// `onFail` runs when there is no voice or it could not speak (a lesson that plays by itself then goes on silently).
(() => {
  const KH = (window.KidHelper = window.KidHelper || {});

  KH.speech = {
    stop() {
      try { speechSynthesis.cancel(); } catch { /* no speech on this computer */ }
    },
    speak(text, { onEnd, onFail } = {}) {
      try {
        speechSynthesis.cancel();
        const voices = speechSynthesis.getVoices(); // can still be empty while Chrome loads them: then just try
        if (voices.length > 0 && !voices.some((v) => v.lang.toLowerCase().startsWith('he'))) {
          KH.views.setStatus('אין במחשב הזה קול בעברית להקראה.');
          if (onFail) onFail();
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'he-IL';
        u.rate = 0.9;
        if (onEnd) u.onend = onEnd;
        if (onFail) u.onerror = (e) => { if (e.error !== 'canceled' && e.error !== 'interrupted') onFail(); };
        speechSynthesis.speak(u);
      } catch {
        if (onFail) onFail();
      }
    },
  };
})();
