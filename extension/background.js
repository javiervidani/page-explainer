// Service worker: loads the lesson files and passes the toolbar-button click to the page.
// Lessons are read here (inside the extension), so web pages can never fetch them.

async function loadLessons() {
  const index = await (await fetch(chrome.runtime.getURL('lessons/index.json'))).json();
  const lessons = [];
  for (const file of index.lessons) {
    try {
      lessons.push(await (await fetch(chrome.runtime.getURL(`lessons/${file}`))).json());
    } catch (err) {
      console.warn(`Lesson file "${file}" could not be read:`, err.message); // one bad file must not hide the others
    }
  }
  return lessons;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'lessons') {
    loadLessons().then(sendResponse, () => sendResponse([]));
    return true; // the answer comes later
  }
});

// Clicking the toolbar icon shows or hides the helper on the current tab.
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {}); // pages without the helper: ignore
});
