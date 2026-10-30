# Synchronized lessons

A lesson that **plays by itself** in the kids' extension: for each step it shows a slide, frames the real button on the
NotebookLM page, tells the narration, waits a moment and moves on. The child can pause, go back or forward, and replay.
The same lesson also exists as slides in Talkdeck, with the same wording and pictures.

## The example

| Where | What |
|---|---|
| Extension | `extension/lessons/notebooklm-synced-demo.json` ("שיעור מנוגן: סקירה קולית", 4 steps, pictures in `lessons/media/synced-demo/`) |
| Talkdeck | lesson id `lesson`, "דוגמה: שיעור מנוגן – סקירה קולית", Hebrew, voice `Osnat4`, 4 slides, audio rendered and built |

Open the lesson in the extension and press its card: it starts playing. Steps 2 and 3 put the yellow frame on the Studio panel and
on the "סקירה קולית" button while the narration is told.

## How a step is written (extension lesson file)

```json
{
  "id": "my-synced-lesson",
  "sites": ["notebooklm.google.com", "notebook.google.com"],
  "title": "…", "emoji": "▶️", "age": "גיל 6 ומעלה",
  "autoplay": true,
  "pauseSeconds": 1.5,
  "steps": [
    {
      "title": "…",
      "text": "Short text shown on the panel.",
      "narration": "What is told aloud (defaults to text).",
      "slide": "media/my-lesson/2.jpg",
      "audio": "media/my-lesson/2.mp3",
      "show": { "text": ["סטודיו", "Studio"], "scope": "panel" }
    }
  ]
}
```

- `autoplay: true` makes the lesson start playing when it is opened. The child gets ⏸ / ▶️ and the usual next and back buttons.
- `slide` and `audio` are paths inside `extension/lessons/`. Slides show above the step title.
- With `audio`, the step ends when the sound ends. Without it the browser's Hebrew voice tells `narration`. With no voice either, the
  step stays about as long as it takes to read (at least 3 seconds), so the lesson always keeps going.
- `pauseSeconds` is the wait after each step. `show` works as in the other lessons (frame on a button or panel).

## From Talkdeck to the extension (lesson pack)

The extension never talks to Talkdeck: it stays offline. Instead a lesson is **exported as a pack** into `extension/lessons/`:
the lesson file, one picture and one audio file per slide. Talkdeck keeps its built files on the machine where it runs
(for example `data/<lesson id>/images/slide1.jpg`, `built.json`), so the owner copies them, or an export script on that machine does.
The audio file names are not visible through the connector, so this step is still manual.

## What is not done yet

- An **export script** (Talkdeck lesson, or saved screens, to an extension lesson file with pictures and audio)
- The Talkdeck player and the extension running side by side and following each other live (needs the player to report the current slide)
- Real pictures: the example uses simple generated slides; real ones come from the lesson maker's saved screens
