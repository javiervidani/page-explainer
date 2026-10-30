// The page side of the log: keeps its own lines too, because the worker may be the very thing that does not answer.
(() => {
  const LM = (window.LessonMaker = window.LessonMaker || {});
  const mine = [];

  function log(text) {
    mine.push(`${new Date().toISOString().slice(11, 19)} page ${text}`);
    if (mine.length > 40) mine.shift();
    try { chrome.runtime.sendMessage({ type: 'logAdd', where: 'page', text }).catch(() => {}); } catch { /* extension reloaded */ }
  }

  // Copies the worker's lines and the page's lines, so the text can be pasted into a chat.
  async function copy() {
    let worker = ['(the worker did not answer)'];
    try { worker = (await chrome.runtime.sendMessage({ type: 'logGet' })).lines || []; } catch (e) { worker = [`(the worker did not answer: ${e.message})`]; }
    const text = [`version ${chrome.runtime.getManifest().version}, ${location.hostname}`, '-- worker --', ...worker, '-- page --', ...mine].join('\n');
    try { await navigator.clipboard.writeText(text); LM.actions.setStatus('היומן הועתק. הדביקו אותו בשיחה.', 'ok'); } catch { LM.actions.setStatus(text.slice(-300), 'bad'); }
  }

  LM.log = log;
  LM.logCopy = copy;
})();
