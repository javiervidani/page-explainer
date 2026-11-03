# מכין השיעורים (Lesson Maker), Chrome and Edge extension for the team

For the team that builds lessons for the kids. On NotebookLM (`notebooklm.google.com`, `notebook.google.com`) and the Gemini chat app (`gemini.google.com/app`) you
**mark a button**, write a note, and **save the screen** to PageLens. The saved picture has the yellow frame on the
marked button. Later, in a chat, Claude reads the saved screens and builds the lesson (see `docs/lesson-maker.md`).

This extension is separate from the kids' extension (`extension/`). The kids' one has no upload code and no keys.

## Install (team computers)

1. Get the `extension-maker` folder (Download ZIP from GitHub, or the ZIP the project owner sent).
2. Open `chrome://extensions` (Edge: `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and
   choose the `extension-maker` folder (the one with `manifest.json`).
3. Open the extension's **settings** (⚙️ in the panel, or the extension's details page) and enter:
   - the PageLens address, for example `https://pagelens.datashellv.com`
   - your **team key**: on the PageLens main page, enter the admin password and tick **Team key** before generating it
4. Press **Save**, then **Test connection**. It should say "זה מפתח צוות".

## Using it

1. Open NotebookLM and click the extension's icon (📸) in the browser toolbar. **This click is needed once per page:**
   Chrome only lets an extension take a picture of a tab after you click its icon on that tab.
2. Write the **project name** (the lesson), for example `מכירים את NotebookLM`. It is remembered.
3. For each step of the lesson:
   - press **🎯 סמן כפתור** and click the button or panel the step is about (the page does not get the click)
   - write a short **note**: what the child must do or understand
   - press **📸 שמור מסך**. The panel hides itself for the picture, so only the page and the yellow frame are saved.
4. The message "נשמר ✓ זה שלב N" confirms it. Steps are in the order you saved them.

## What is saved

On PageLens, for 30 days, then deleted automatically:

- the picture of the visible part of the tab (with the yellow frame on the marked button)
- your note, the project name and who saved it
- the marked button's name and its position in the picture
- the **names** of the buttons, inputs and panel titles visible on screen. Long texts (such as the notebook's own
  title) and typed values are left out. This list gives the exact words for the kids' lesson files.
- the page's address without the part after `?`, its title and the window size

**The picture shows whatever is on the screen.** Do not save screens that show personal information, and use test
notebooks where you can.

## Auto mode (a chat marks and saves the screens)

The button "🤖 מצב אוטומטי" in the panel lets a chat (Claude with the PageLens connector and a **team** key) ask this page for
to mark and save screens (`remote_labels`, `remote_capture`) and to read the page text (`remote_text`). By default it **never clicks
or types**: you open each screen. If you tick **"גם ללחוץ על כפתורים ולהקליד בתיבת השאלה"** before starting, the chat may also
press one button at a time (`remote_press`) and type in the question box (`remote_type`), with the limits below.

- You turn it on each time. A red banner at the top shows a 6-digit **code**, the time left and a stop button.
- Tell the chat the code. Without it nothing works, and the code only lives while auto mode is on.
- It stops by itself after 30 minutes (the server enforces this too), when you press stop, or when you close the tab.
- It works only while the notebook tab is in front; the picture is refused if another tab is in front.
- Before it starts, it tries one picture to be sure Chrome allows it. If not, click the 📸 icon in the toolbar once and retry.
- `remote_text({ code, find? })` returns the text of the page (up to 100,000 characters) and its headings. It is private content: it only goes to the chat that has the code.
- With the tick (the banner shows "✋ לחיצה והקלדה מותרות"): `remote_press({ code, name })` presses one button by its **exact** name (30 per session)
  and returns the names on screen afterwards. `remote_type({ code, text })` types up to 500 characters into the notebook's question box
  (`התיבה להזנת שאילתה`) or the Gemini app's prompt box (`כאן מזינים פרומפט ל-Gemini`) and nothing else (20 per session). Sending is a press of `שליחה`, allowed only right after a typed text, once.
  The extension refuses these, so the author does them by hand: delete, remove, share, settings, sign out, the good/bad feedback buttons and "new notebook".
  The banner shows each press and what was typed.
- `remote_source_text({ code, text })` types up to 4000 characters into the paste-text box of the open "add source" window, and nowhere else (the window is the last open dialog and the box must be named like a paste-text box; if not found, the error lists the boxes). Flow: `remote_press` "הוספת מקור", the paste-text option, `remote_source_text`, then the window's add button. Counts toward the 20 typed texts.
- `remote_key({ code, direction: "next" | "previous", times? })` sends the Right or Left arrow (nothing else) to change the slide while a presentation is open
  (the page must show `סגירת המצגת`). Needs the tick; 60 key presses per session. The author starts the slideshow with a real click (full screen needs one).

## Permissions

`storage` (settings), `activeTab` (the picture, after you click the icon) and access to NotebookLM and the PageLens
address. The key is kept only in this browser and is sent only to the PageLens address you entered.

## Code layout

No file is longer than 200 lines. `background.js` takes the picture and uploads it; `options.*` is the settings page;
`content/` holds the panel, one file per job (`picker.js` marks the button, `labels.js` collects the names,
`actions.js` saves, `views.js` draws). Auto mode: `content/finder.js` (finds a button by name), `content/remote.js`
(the loop and the banner), `remote.js` (the calls to the server, in the service worker).
