# מכין השיעורים (Lesson Maker), Chrome and Edge extension for the team

For the team that builds lessons for the kids. On NotebookLM (`notebooklm.google.com`, `notebook.google.com`) you
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
two things only: the button and panel names on screen (`remote_labels`), and "mark this button and save the screen"
(`remote_capture`). It **never clicks or types**: you open each screen, the chat asks for one picture per screen.

- You turn it on each time. A red banner at the top shows a 6-digit **code**, the time left and a stop button.
- Tell the chat the code. Without it nothing works, and the code only lives while auto mode is on.
- It stops by itself after 30 minutes (the server enforces this too), when you press stop, or when you close the tab.
- It works only while the notebook tab is in front; the picture is refused if another tab is in front.
- Before it starts, it tries one picture to be sure Chrome allows it. If not, click the 📸 icon in the toolbar once and retry.

## Permissions

`storage` (settings), `activeTab` (the picture, after you click the icon) and access to NotebookLM and the PageLens
address. The key is kept only in this browser and is sent only to the PageLens address you entered.

## Code layout

No file is longer than 200 lines. `background.js` takes the picture and uploads it; `options.*` is the settings page;
`content/` holds the panel, one file per job (`picker.js` marks the button, `labels.js` collects the names,
`actions.js` saves, `views.js` draws). Auto mode: `content/finder.js` (finds a button by name), `content/remote.js`
(the loop and the banner), `remote.js` (the calls to the server, in the service worker).
