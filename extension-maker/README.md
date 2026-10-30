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

## Permissions

`storage` (settings), `activeTab` (the picture, after you click the icon) and access to NotebookLM and the PageLens
address. The key is kept only in this browser and is sent only to the PageLens address you entered.

## Code layout

No file is longer than 200 lines. `background.js` takes the picture and uploads it; `options.*` is the settings page;
`content/` holds the panel, one file per job (`picker.js` marks the button, `labels.js` collects the names,
`actions.js` saves, `views.js` draws).
