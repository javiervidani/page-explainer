# From a real screen to a Talkdeck slide

How one slide of a lesson is made with auto mode (T5), PageLens and Talkdeck. Tried on 2026-10-31 with the lesson
`zz-capture-test` (slide 1: "סקירה קולית", slide 2: "מצגת").

## The flow

| # | Who | What happens | Tool | MCP server |
|---|---|---|---|---|
| 1 | Author | Opens the Gemini Notebook with Studio visible | | |
| 2 | Author | Presses "🤖 מצב אוטומטי" in the team extension. A red banner shows a 6-digit code | | |
| 3 | Author | Sends the code to the chat | | |
| 4 | Chat | Asks the extension for the button names on the screen | `remote_labels` | PageLens (team) |
| 5 | Chat | Picks the name to mark from the list | none | the chat's own choice |
| 6 | Chat | Asks for the capture: `code`, `project`, `find` (names, best first), optional `scope`, `note` | `remote_capture` | PageLens (team) |
| 7 | Server | Queues the command under the code | none | PageLens server code behind step 6 |
| 8 | Extension | Takes the command, finds the button, draws the yellow frame (no click), hides panel and banner, takes the picture | none | the Chrome extension, not MCP |
| 9 | Server | Saves the picture as the next step of the project | none | PageLens server code |
| 10 | Chat | Gets the picture link (valid 1 hour) | `list_captures` / `get_capture` | PageLens (team) |
| 11 | Chat | Adds the slide: `title`, `text` (spoken), `screen` (different from the title), `layout: "snapshot"`, `source`, `show.text` | `slide_add` | Talkdeck |
| 12 | Chat | Gives Talkdeck the link; the Pi downloads the picture itself | `slide_image_upload` (`url`, `layout`, `source`) | Talkdeck |
| 13 | Chat | Renders the voice and prepares the player, then waits for the job | `lesson_build`, `job_status` | Talkdeck |
| 14 | Author | Opens the player link and looks at it | `lesson_preview_link` | Talkdeck |

Steps 1-3 and 14 are the author's. Steps 4-13 are the chat's.

## Where each part runs

- **PageLens MCP** (steps 4, 6, 10): `https://pagelens.datashellv.com/mcp`, on Plesk. The three tools above need a team key.
- **Talkdeck MCP** (steps 11-14): on the Pi, through the tunnel at `mcp.datashellv.com`.
- **Not MCP:** step 8 is the extension. Steps 7 and 9 are PageLens server code (`services/remote/`, `routes/remote.js`) that the tools reach.
- Only `lesson_create` (once per lesson) and `lesson_preview_link` are Talkdeck tools outside the loop above.

## The picture never goes through the chat

In step 12 the chat passes only a link, `https://pagelens.datashellv.com/captures/<id>/image?exp=<unix>&sig=<code>`. The Pi downloads it.
That is why the link is signed and lasts one hour, and why `pagelens.datashellv.com` must be in the Pi's `TALKDECK_IMAGE_HOSTS`
(it is by default). Limits on the Pi side: https only, no login or port in the link, no private addresses, 15 s, 5 MB, jpg/png/webp
checked by bytes.

## Safeguards (step 2 to 9)

- The chat needs the live 6-digit code, so it only works while the author has auto mode on.
- At most 30 minutes (the server enforces it too), at most 60 commands per session, and the stop button on the banner ends it.
- Mark and save only: nothing is clicked or typed. The author opens each screen; the chat asks for one capture per screen.
- A picture is refused unless the notebook tab is in front.
- The saved picture has the yellow frame but not the panel or the banner.

## Rules for a good slide

- `title` and `screen` must differ, and no text is baked into the picture.
- `layout: "snapshot"` shows the whole screen at the right, clear of the avatar. `source` is the short line under it.
- `show.text` holds the button names the kids' extension frames while the slide is spoken (use the names from `remote_labels`).
- Run `lesson_build` after every picture change, or the player shows the old one.

## Results of the first real run

- `remote_labels` returned 38 names from the real page; `remote_capture` marked "סקירה קולית" and "מצגת".
- `slide_image_upload` gave `{"bytes":150297,"type":"jpg","layout":"snapshot"}` and the build had no missing audio or picture.
- Player at 1280x800: whole picture at the right, avatar clear, title below once, source line shown.
- Seen, not fixed yet: the screenshot fills about 60% of the slide, so its text is small (a cropped capture would help), and the
  kids' extension's owl button shows in the corner of a capture if both extensions are on.

## Troubleshooting the extension (found on the first run)

- "ההרחבה עודכנה, והדף הזה עדיין ישן": a tab opened before an update keeps the old page script. Reload the tab (or open a new one).
- The pink message "לחצו פעם אחת על סמל ההרחבה": click the extension itself in the browser's 🧩 menu once (Edge hides it until
  pinned). Auto mode then starts and the panel stays open.
- The "📋 יומן" button in the panel copies the log (worker and page lines, no key, no pictures) to paste into a chat.

## Shortcuts (server 1.7.0, extension 0.3.0)

- **`crop: true`** in `remote_capture`: only the part around the marked button or panel is saved (at least 480x320 CSS pixels, with a
  small margin, never outside the window). The text is bigger on a slide. The yellow frame's saved box moves with the crop, so
  `get_capture` still gives positions in the picture's own units.
- **`shots: [...]`** in `remote_capture`: up to 5 pictures of the same open screen in one call, each with its own `find`, `scope`,
  `note` and `crop`. One shot keeps the old answer; several give `{saved, shots:[{ok,id,marked|error}]}`. A shot that is not found
  says why, and the others are still saved.
- **`lesson_from_captures(project)`** (team key, changes nothing): one draft slide per saved screen, in saved order, with `title`
  (the marked button), `layout: "snapshot"`, `source`, `show.text`, `screen` (the author's note) and the picture link. `text` (the
  narration) is empty on purpose. The chat writes it, makes `screen` differ from `title`, then calls `slide_add`,
  `slide_image_upload` and `lesson_build` as in steps 11-13.
