# Backlog

## Product direction (decided)
- **Main goal:** help the owner's kids learn how to use LLM tools such as NotebookLM and image creation tools.
- **Audience now:** public use, starting with the family. Internal company systems and employee form help are **not started** (see "Later: companies").
- **Where the explanations live:** full lessons written by the owner, added later. Until then the answers appear in a chat (Claude or GPT through the connector).
- **Logged-in tools (NotebookLM, image tools):** read in the kid's own Chrome through an extension, not by the server (see "Chrome extension").

Order is roughly the order I would do things. Update the status as work moves.

## Done
- [x] MCP server over Streamable HTTP with the `explain_page` tool (text + screenshot link)
- [x] SSRF protection (every request and redirect hop is checked), queue (2 running, 10 waiting), rate limit
- [x] Plesk deployment through Git webhook, `deploy.sh`, `/health` with version
- [x] Main page: generate expiring API keys (1, 7, 30 or 90 days) behind an admin password
- [x] Team testing: key label per person, connector URL (`/mcp?key=...`) for URL-only connector screens
- [x] Usage log per call: CPU, memory, bandwidth (`data/usage-*.jsonl`, `node scripts/usage-report.js`)
- [x] Code split into folders, no file over 200 lines (`services/browser/`, `mcp/tools/`, `extension/content/`), checked by `node scripts/check-file-size.js`
- [x] Short page cache: the loaded page is kept about 60 seconds per key, URL and viewport (max 3 pages, offline while idle), so `page_outline` then `capture_area` does not reload it; `refresh: true` forces a reload; usage log has a `cache` field
- [x] Explain parts of a page: `page_outline` (regions with selectors and positions, headings, buttons, RTL detection) and `capture_area` (one area by CSS selector or pixel region, returned as an inline image plus the text inside it); `explain_page` got `viewport` (desktop or mobile) and `fullPage` options

## Now: team testing (Claude connector)
- [ ] Set `PUBLIC_BASE_URL` in Plesk so screenshot links are absolute
- [ ] Switch the `pagelens` app to Node 20.20.2 in Plesk Node.js Manager
- [ ] Add the connector in Claude.ai (Settings > Connectors > Add custom connector) with the connector URL, and confirm tools show up and a page gets explained. Not verified yet: Claude.ai may behave differently from the plain HTTP clients I tested.
- [ ] Each team member gets their own labelled, short-lived key
- [ ] Read the usage report after a few days and decide limits (see "Cost and abuse controls")

## Page parts (follow-ups)
- [ ] Look inside iframes and shadow DOM (modern web apps hide content there, so the outline shows fewer regions)
- [ ] Pick an area by visible text or role (for example "the button named Subscribe"), not only by selector
- [ ] `scroll` option to capture content that only loads while scrolling (lazy loading)
- [ ] Pages behind a login (needs cookies or a browser extension; security review first)

## Chrome extension
Why: tools like NotebookLM need a login. In the kid's own browser the session is already there, nothing secret leaves the computer, and the server cannot (and should not) do it.
- [x] Decided: Hebrew, ages 6 and 9, NotebookLM first, kid's own supervised PC with extensions allowed
- [x] First version in `extension/` (Manifest V3): owl button, lesson list, step by step panel, yellow frame on the part of the page each step talks about, read aloud (Hebrew voice), "a bit more" text, stars for finished lessons, panel side, no network requests; tested on a mock of the NotebookLM layout
- [x] Lessons are plain JSON files the owner can edit (`extension/lessons/`), see `extension/README.md`
- [ ] Try it on the real NotebookLM and fix the button names in the lessons (labels were taken from screenshots and guesses)
- [ ] Owner reviews and rewrites the Hebrew lesson text; add the real lessons
- [ ] Lesson for an image creation tool (which one first?)
- [ ] Check there is a Hebrew voice on the kids' PC for read aloud
- [ ] Optional later: "ask about this page" with an LLM, with the parent's consent and no personal data sent
- [ ] Chrome Web Store later if it is shared outside the family
- [ ] Check the age rules of each tool and what the supervised accounts allow

## Lesson maker for the team
Goal: the team builds lessons for the kids from real screens. Team members save screens from NotebookLM, and in a chat Claude turns them into a Talkdeck slide lesson (and into the step file for the kids' extension).

Decisions
- Two separate extensions: the kids' extension (no upload code, no keys, no network) and the team extension `extension-maker/`
- A saved screen includes the yellow frame on the marked button; the maker's own panel is hidden for the picture
- Talkdeck is the owner's own project, so it can be changed to accept an image link
- Captures are kept 30 days, then deleted; only team keys can save or read them

Done
- [x] PageLens: `POST /captures` (team keys, size and rate limits), stored in `data/captures/` with note, marked button (name and position), visible button names, page info
- [x] PageLens: tools `list_captures` and `get_capture` (only for team keys), image links that expire (1 hour) and cannot be guessed
- [x] PageLens: 30-day cleanup and storage report in `scripts/cleanup.js`; "Team key" option on the key page
- [x] Team extension: mark a button, note, save screen (frame in the picture, panel hidden), settings page with connection test
- [x] Recipe for the team and the Talkdeck change, in `docs/lesson-maker.md`

Open
- [ ] **Talkdeck (the owner's side):** `slide_image_upload` accepts an image `url` (details in `docs/lesson-maker.md`)
- [ ] Try the whole path on the real NotebookLM: save screens, make a Talkdeck lesson, make the kids' step file
- [ ] Possibly: delete a saved screen from a chat, rename or reorder steps, blur private parts before saving
- [ ] Optional: ask for the picture permission once in settings so the toolbar click is not needed for each page

## Synchronized lessons
Idea: a lesson plays while the extension follows it on the real page: slide and narration in the panel, yellow frame on the button, in step. Details in `docs/synchronized-lessons.md`.

Done
- [x] Kids' extension plays lessons by itself (`autoplay`): slide, narration (audio file or Hebrew voice, or timed silence), frame, pause and play, back and forward
- [x] First example: `notebooklm-synced-demo` in the extension, and the same lesson in Talkdeck (lesson id `lesson`, voice Osnat4, audio built)

Open
- [ ] Try it on the real NotebookLM and on the kids' PC (Hebrew voice, speed, whether the child follows)
- [ ] Export script: Talkdeck lesson (or saved screens) to an extension lesson file with pictures and audio (Talkdeck's built files live on its own machine)
- [ ] Decide whether the Talkdeck player and the extension should also follow each other live (needs the player to report the current slide and accept "go to slide"; Google's page may refuse to show an outside player, so a lesson pack is the safer way)
- [ ] Decide what happens when the child does something different from the lesson (wait, skip, or ask)

## Later: companies (do not start)
- [ ] Help employees with internal systems and forms (extension for logged-in internal tools, guidance on the page)
- [ ] `page_forms` tool: every field of a form (label, required, type, help text, buttons) so a model can explain how to fill it
- [ ] Company login (Google or Microsoft), company rules and instructions, admin page, audit logs
- [ ] Privacy for forms: never send typed values or password and card fields; short retention
- [ ] Self-hosted option for companies that need it

## Key management
- [ ] List keys (label, created, expires, last used, calls) on the main page
- [ ] Revoke a key
- [ ] Per-key rate limit and daily quota, using the usage log
- [ ] Rotate or renew a key without losing its label

## Human access
- [ ] **Login with Google** (OpenID Connect) for the main page, replacing the single admin password
- [ ] Self-service: a signed-in user creates and sees only their own keys
- [ ] Allow-list of emails or domains while in private testing
- [ ] Small database (SQLite) for users, keys and usage instead of JSON files

## Connectors and agents
- [ ] OAuth 2.1 for MCP connectors, so "Connect" in Claude or ChatGPT works without pasting a key: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, dynamic client registration, `/authorize` (uses the Google login), `/token`. The MCP SDK has helpers for this. The tokens are the same expiring tokens as today.
- [ ] Agents and programs use the same tokens as a Bearer header
- [ ] Optional agent self-registration: needs an invite code from a human, or a small free quota with strict per-IP limits. No open minting of keys.
- [ ] Check ChatGPT connector requirements (auth types it accepts)

## Cost and abuse controls
- [ ] Limit total bytes and number of requests per page (stop huge downloads); skip video and large media
- [ ] Daily quota per key for CPU seconds and bandwidth, based on real numbers from the usage log
- [ ] Alert when the server is under load or a key spikes
- [ ] Hardening against DNS rebinding (connect to the checked IP address)
- [ ] Cloudflare: WAF rule that lets `/mcp` through (bot protection can block AI clients)
- [ ] Usage log: wire bytes (compressed size), per-job CPU without overlap, rotation is already 30 days via `scripts/cleanup.js`

## REST phase (after MCP)
- [ ] Choose the LLM provider (Claude, OpenAI or another) and where the key lives
- [ ] `services/llm.js`: `explainPage({ url, text })` with timeout and error handling
- [ ] `POST /explain` returning `{ explanation, screenshotUrl }`, same auth, queue and limits as MCP
- [ ] Error codes 400 / 408 / 429 / 500 with `{ "error": "message" }`
- [ ] README and tests for the REST route

## Before publishing
- [ ] Decide who the users are (team only, customers, public) and whether it is free or paid
- [ ] Privacy policy and terms (the service fetches pages on behalf of users and logs usage)
- [ ] Decide what is logged and for how long (IP address, target host and path)
- [ ] Uptime monitoring on `/health`, backups of `data/`
- [ ] Move keys and usage to the database; remove `?key=` URLs in favour of OAuth
- [ ] Security review (SSRF tests, rate limits, headers such as CSP on the main page)
- [ ] Listing or documentation page for users; support contact

## More ideas (not planned yet)
Tools
- [ ] `page_data(url)`: structured data the page already contains (JSON-LD, Open Graph, meta tags, tables, price and brand fields). Cheaper and more reliable than reading the screenshot, and it would have answered the product questions directly.
- [ ] `find_in_page(url, text)`: find where a word or phrase appears and return the region, selector and an image of it
- [ ] `page_text(url, selector)`: only the text of one element (no image), for when the image is not needed
- [ ] `page_links(url)`: the links of the page (text, destination, which region they are in), so a model can choose where to look next
- [ ] Accessibility snapshot (the page's ARIA tree) as a compact, model-friendly alternative to the outline
- [ ] Numbered overlay: a screenshot with region numbers drawn on it, so the model can say "region 3" instead of a selector
- [ ] Limited interaction (expand a section, switch a tab, scroll to a position) without form submission or purchases
- [ ] PDF, image and plain-text URLs: explain a linked PDF or image, not only HTML pages
- [ ] Export the page as a PDF

Quality of the result
- [ ] Hide cookie banners and fixed overlays for the screenshot (they covered part of the Amazon page)
- [ ] Locale options: language (`Accept-Language`), time zone and colour scheme (dark or light). The server's country still decides which regional store or content a site shows.
- [ ] More device sizes: tablet, small phone, and a custom width
- [ ] Sharper small text: 2x pixel density option for `capture_area`, PNG for small text areas
- [ ] Text-only mode that skips images, fonts and media to save bandwidth and CPU
- [ ] Optional `timeoutSeconds` per call

Operations and control
- [ ] Per-key allow-list or block-list of domains
- [ ] Usage page for admins (the usage report in the browser, with charts)
- [ ] Restart Chromium after a number of pages or when memory grows too high
- [ ] Notice to the model when a site shows a block page or a "continue" screen to automated visitors, instead of returning that page as if it were the content

## Ideas
- [ ] `mode` parameter on `explain_page`: `text` only or text with an LLM explanation (needs the REST phase work)
- [ ] Node 22 on the server
