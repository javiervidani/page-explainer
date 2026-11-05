# Backlog

Ideas that are decided as "later". Not started. Date format: YYYY-MM-DD.

## Talkdeck: generic lesson player (heavy change) — 2026-11-05

Owner: the Pi chat (`javierpi-mellow-book`), in a separate chat, later. Proposal by the Pi chat:

- **Lesson contract:** one short spec of what the player accepts: required fields, allowed layouts and style keys, how audio and image paths are written, a format version (`version: 1`). Must include the fields we added: `show`, `source`, `subtitle`, `bullets`, `steps`, `layout` from the player's list only; `script` and `plan` stay out of `built.json`.
- **`lesson_validate`:** checks required fields, layout and style names, that every audio and image file exists, and the version. Reports what is wrong and in which slide.
- **Lessons outside the code folder:** a setting such as `TALKDECK_DATA`.
- **`?lesson=<link or path>`:** load a lesson's `built.json` from an address; media paths relative to it. Only allowed hosts, no free file paths (`../`), no access token shown in the link.
- **Player safe against a bad lesson:** a clear message instead of a blank screen; skip a missing picture or audio for one slide.
- **`lesson_publish` validates first** and refuses a lesson that does not fit.

Suggested order (Pi chat): contract and `lesson_validate`, then the lessons folder setting, then `?lesson=`.

Not now: the focus is getting the 13 lessons built and published (see below).

## Current focus: lessons online

1. Put `curriculum-talkdeck-slides-v2.md` on the Pi (`data/plan/`).
2. Import the 13 lessons (no audio, no pictures, no paid calls), then build audio.
3. Pictures: 11 screenshots (Gemini and NotebookLM through the extension; Claude, Kidgeni, Fliki and Scratch by hand) and 52 generated pictures (paid; each needs Javier's yes).
4. `lesson_publish` with `dryRun: true`, then for real, per lesson, only when Javier asks.
