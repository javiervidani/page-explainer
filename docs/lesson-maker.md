# Lesson maker: from saved screens to a Talkdeck lesson

How the team turns screens from NotebookLM into a lesson for the kids.

## 1. One-time setup

1. On the PageLens main page create a **team key** for each person (tick "Team key", give a name).
2. Each person installs the lesson-maker extension and enters the address and key (`extension-maker/README.md`).
3. In Claude, the PageLens connector (with that team key in its URL) shows two extra tools:
   `list_captures` and `get_capture`. Normal keys do not see them.

## 2. Save the screens

Open NotebookLM, click the 📸 icon, choose a project name, and for each step mark the button, write a note and save.
Steps are kept in the order they were saved. Screens are deleted after 30 days.

## 3. Make the lesson in a chat

Use a chat with both connectors (PageLens and Talkdeck). Example request:

> Use PageLens `list_captures` for the project "מכירים את NotebookLM". Look at every screen with `get_capture`.
> Create a Talkdeck lesson in Hebrew (language `he`) for children aged 6 to 9 with one slide per screen, in the same
> order: a short title, short simple narration that says what to press (use the marked button's name and the note), and
> short text for the screen. Attach each screen's picture to its slide using the screen's `imageUrl`, then build the lesson.

Ask for a second result from the same screens when you want it:

> Now write the step file for the kids' extension (`extension/lessons/…json`) for the same project: one step per screen,
> `title`, `text` (short, for age 6), `more` (for age 9) and `show.text` with the marked button's name in Hebrew.

## 4. What Talkdeck must support (change on the Talkdeck side)

Today `slide_image_upload` takes only `data` (base64), which is too large to pass through a chat. Add a `url` option:

- `slide_image_upload({ id, index, url })` downloads the picture itself and stores it like `data`
- accept `https://` only, and only from hosts you list (for example the PageLens address); refuse anything else, so
  the option cannot be used to make Talkdeck call internal addresses
- time limit about 15 seconds, size limit 5 MB, and check the answer is `image/jpeg`, `image/png` or `image/webp`
- do not follow redirects to other hosts

PageLens links look like `https://pagelens.datashellv.com/captures/<id>/image?exp=…&sig=…`. They work **for one hour**
(`CAPTURE_LINK_TTL_S`), so ask for the lesson soon after listing the screens. `get_capture` and `list_captures` create a
fresh link each time they are called.

## 5. Good to know

- A saved screen can show private notebooks: use test notebooks and do not save personal information.
- The marked button's position is in CSS pixels of the visible window (`page.width`, `page.height`); the picture can be
  larger when the screen is high-resolution (`page.pixelRatio`).
- Screens, notes and key labels are in `data/captures/` on the PageLens server (not in git). `scripts/cleanup.js`
  removes screens after 30 days (`CAPTURE_DAYS`) and prints how much space they use.

## 6. Auto mode: the chat chooses the buttons (team keys)

Instead of the author marking each button, the author turns on **auto mode** in the extension and reads the 6-digit code from
the red banner to the chat. Two more tools then appear for team keys:

- `remote_labels({ code })` returns the button and panel names visible on the author's open tab.
- `remote_capture({ code, project, find: ["סקירה קולית"], scope?, note? })` marks the first name found (yellow frame),
  saves the screen into the project, and returns the capture id. `list_captures` lists it like any other screen.

Rules: it never clicks or types (the author opens each screen); 30 minutes at most; 60 requests per session; only the
notebook tab while it is in front; the author can stop it at any moment. A session is a folder in `data/remote/<code>/`
(a command and an answer per file), so several app copies see the same session.
