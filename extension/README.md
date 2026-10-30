# עוזר הלמידה (Learning Helper), Chrome extension

A helper for children learning to use AI tools. It adds a small owl button to the page. The button
opens short lessons in Hebrew, and each step highlights the button or area it talks about.
First tool: **NotebookLM**, also called Gemini Notebook (`notebooklm.google.com` and `notebook.google.com`). Made for ages 6 and 9: big text, short sentences,
a "read it to me" button, and an optional "a bit more" text for the older child.

## Install (on the child's computer, supervised)

1. Get the `extension` folder onto the computer: on GitHub use **Code > Download ZIP**, then unzip it
   and open the `extension` folder inside (or use the ZIP the project owner sent you).
2. In Chrome open `chrome://extensions` (in Edge: `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder (the one that contains `manifest.json`).
5. Open NotebookLM (reload the tab if it was already open). The owl button appears at the bottom left. The toolbar icon also shows or hides it.

Chrome may show a note about developer-mode extensions when it starts; that is normal for an extension
that is not from the Chrome Web Store. If the computer uses a supervised or school account, extensions
may need a parent's or administrator's approval, or may be blocked.

After you edit a lesson file: on `chrome://extensions` press the refresh arrow on the extension, then reload
the NotebookLM tab.

## What the child sees

- Press the owl, choose a lesson, then go step by step with **הבא / הקודם**.
- **👀 הראה לי** puts a yellow frame on the button or panel the step is about and scrolls to it.
- **🔊 להקריא** reads the step aloud (needs a Hebrew voice on the computer; "קריאה" turns on automatic reading).
- **💡 עוד קצת** opens a longer explanation.
- **↔️** moves the panel to the other side, **✖️** or the Escape key closes it.
- Finished lessons get a ⭐ (remembered on this computer only).

## Privacy

Everything runs inside the page on the computer. The extension makes **no network requests**, has no
analytics, and does not read the notebook's content: it only looks up the names of buttons and panels to
place the frame. The only thing stored (in Chrome's local storage) is which lessons are finished, which side
the panel is on and the reading setting. It asks Chrome for one permission, `storage`, and only runs on
`notebooklm.google.com` and `notebook.google.com`.

## Writing and editing lessons (no coding)

Lessons are plain text files in `lessons/`. Add a new file and list it in `lessons/index.json`.
Open a lesson file in any text editor; keep the quotes, commas and brackets exactly as they are.

```json
{
  "id": "my-lesson",
  "sites": ["notebooklm.google.com", "notebook.google.com"],
  "title": "Lesson name",
  "emoji": "📓",
  "age": "גיל 6 ומעלה",
  "steps": [
    {
      "title": "Step title",
      "text": "Short text for the youngest child.",
      "more": "Longer text for the older child (optional).",
      "show": { "text": ["Hebrew button name", "English button name"], "scope": "panel" }
    }
  ]
}
```

- `id` must be unique (it remembers the finished star). `sites` is the list of addresses (without `https://`) where the lesson is shown. A new address also has to be added to `matches` in `manifest.json`.
- `show` is optional. Leave it out for a step with only text.
- `show.text` is a list of words that appear on the button, heading or input box. Put the Hebrew and the
  English names, because the page language may change. The helper finds a visible match.
- `show.scope: "panel"` highlights the whole panel around a heading (use it for "Sources" or "Studio").
- If the page cannot be matched, the child sees "I could not find it on the screen" and can continue.
  To find the right word, open NotebookLM and copy the exact text of the button.
- Advanced: `show.selector` takes a CSS selector, which is tried first.

## How the code is organised

No file is longer than 200 lines. The files in `content/` load in the order listed in `manifest.json`
and share one object, `window.KidHelper`:

| File | Job |
|---|---|
| `util.js` | small helpers (building elements, checking visibility) |
| `state.js` | what is shown now, and what is remembered on this computer |
| `styles.js` | how the panel and the yellow frame look |
| `ui.js` | the elements put on the page (in a shadow root) |
| `speech.js` | reading a step aloud |
| `finder.js` | finding the button or panel a step talks about |
| `spotlight.js` | the yellow frame |
| `actions.js` | what happens when something is pressed |
| `views.js` | drawing the lesson list and the steps |
| `main.js` | starting everything |

`background.js` loads the lesson files and handles the toolbar button.

## Notes

- The lesson text was written as a first draft: please read it and change anything that does not match how
  you speak to your children, or what NotebookLM currently shows.
- It was tested on a mock page built like NotebookLM (Hebrew and English labels), not on the real,
  logged-in NotebookLM. Button names in the real page may differ; fix them in the lesson files.
- Google changes NotebookLM often. If a frame stops finding a button, update that step's `show.text`.
- Ask an adult before adding sources to a notebook, and do not add personal information.
