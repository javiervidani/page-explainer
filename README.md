# Page Explainer (MCP server)

An MCP server (Node.js + Express + Playwright) with one tool, `explain_page`.
Give it a public URL; it opens the page in headless Chromium and returns the
page's visible text plus a link to a full-page screenshot. The calling model
(Claude, GPT, ...) writes the explanation itself, so **no LLM API key is needed**
in this phase.

## Tools

| Tool | What it does |
|---|---|
| `explain_page({ url, viewport?, fullPage? })` | Visible text (about 20,000 characters) plus a link to a screenshot. `viewport` is `desktop` (1280x800, default) or `mobile` (390x844). `fullPage: false` shoots only the visible screen. |
| `page_outline({ url, viewport? })` | The regions of the page (header, navigation, sidebars, main, footer, forms, or the big layout blocks when the page has few landmarks). Each has a label, a CSS `selector`, its `box` in page pixels and a text snippet. Also the headings, buttons, page size and text direction (`rtl` for Hebrew or Arabic). |
| `capture_area({ url, selector? , region?, viewport?, fullPage? })` | One area of the page as an **inline JPEG image** the model can see, plus the text inside that area. Choose it with a CSS selector (from `page_outline`) or a `region` `{ x, y, width, height }` in page pixels. With neither you get the visible screen. Areas taller than 2000 px are cut, and the reply says which `region` to request next. A copy is saved under `/shots/<uuid>.jpg`. |

Typical use: `page_outline` first, then `capture_area` on the part you want explained.
The loaded page is kept for about a minute (see "Page cache"), so follow-up calls on the same page are quick. Pages behind a login are not supported, and content inside
iframes or shadow DOM may not appear in the outline.

Errors come back as MCP tool errors: invalid or blocked URL, bad selector or area (400),
page timeout after 30 s (408), queue full (429), or a generic failure.

Also: `GET /health` returns `{ "ok": true }`.

## Run locally

```bash
npm install
npx playwright install chromium    # add --with-deps on a Linux server (as root)
cp .env.example .env               # edit as needed
npm start                          # http://localhost:3000
```

The MCP endpoint is `POST /mcp` (Streamable HTTP, stateless). Try it:

```bash
curl -X POST http://localhost:3000/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"explain_page","arguments":{"url":"https://example.com"}}}'
```

## Connect a client

- **Claude Code:** `claude mcp add --transport http page-explainer https://YOUR-DOMAIN/mcp --header "x-api-key: YOUR_KEY"`
- **Claude / GPT / other clients:** add a remote MCP server with URL `https://YOUR-DOMAIN/mcp`
  and, if `API_KEY` is set, send it as `x-api-key` or `Authorization: Bearer <key>`.
  Remote MCP in web apps needs the public HTTPS URL, not localhost.

## API keys with expiry

Open the main page (`/`), enter the admin password, optionally a name (it appears in the usage log),
choose 1, 7, 30 or 90 days and click **Generate key**. The page also shows a **connector URL**
(`/mcp?key=...`) for connector screens that only take a URL; it contains the key, so keep it private. The key is shown once; only its hash is stored in
`data/keys.json` (git-ignored). Expired keys stop working immediately. The
permanent `API_KEY` env var, if set, keeps working. Wrong-password attempts are
limited to 10 per hour per IP.

## Page cache

After a call the loaded page is kept in memory for 60 seconds, so `page_outline` followed by
`capture_area` (or `explain_page`) does not load the page again. A kept page belongs to one key and one
window size, is offline while idle, and is closed after the idle time, after 5 minutes in total, or when
more than 3 pages are kept (the oldest goes first). Every call still checks the URL again. Replies say
when a kept page was reused, and `refresh: true` on any tool loads the page again. The usage log has a
`cache` field (`hit`, `miss` or `off`). Kept pages use memory, so on a small server lower
`PAGE_CACHE_MAX` or set it to 0.

## Usage log (CPU, memory, bandwidth)

Every `explain_page` call writes one line to the console and to `data/usage-YYYY-MM-DD.jsonl`
(kept 30 days by `scripts/cleanup.js`). Fields: `key` (the label), `ip`, `target` (host and path),
`tool`, `status`, `totalMs`, `queueMs`, `jobMs`, `cpuBrowserMs` (Chromium and its helpers), `cpuNodeMs`,
`peakBrowserMb` (PSS, sampled twice a second), `peakNodeMb`, `concurrent`, `cache`, `bytesDownloaded`
(from the target site, decoded size), `requests`, `screenshotBytes`, `bytesToClient` (reply size, including an inline image).

```bash
node scripts/usage-report.js 7     # totals per key for the last 7 days
```

CPU and memory come from `/proc`, so they exist on Linux only (otherwise they are `null`).
The browser is shared: when two calls overlap (`concurrent` above 1) their CPU and memory figures
overlap too, so totals are slightly too high.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (Plesk sets it) |
| `PUBLIC_BASE_URL` | Public origin, e.g. `https://example.com`; used to build absolute screenshot links |
| `API_KEY` | Optional permanent key. `/mcp` requires a key in `x-api-key` or `Authorization: Bearer` whenever `API_KEY` or `ADMIN_PASSWORD` is set |
| `ADMIN_PASSWORD` | Password for the key generator on the main page. If empty, generation is disabled |
| `RATE_LIMIT_PER_MIN` | Requests per IP per minute on `/mcp` (default 30) |
| `PAGE_CACHE_TTL_S` | Seconds a page is kept after its last use (default 60) |
| `PAGE_CACHE_MAX` | Pages kept at the same time, 0 turns the cache off (default 3) |
| `PAGE_CACHE_MAX_AGE_S` | Longest time a page is kept in total (default 300) |
| `PW_NO_SANDBOX` | Set to `1` only if Chromium will not start without `--no-sandbox` |
| `PW_CHROMIUM_PATH` | Optional path to an already-installed Chromium |

Never commit `.env`.

## Security

- Only `http`/`https`. Hostnames are resolved and loopback, private, link-local,
  carrier-NAT and metadata ranges (IPv4 and IPv6) are rejected.
- Every browser request is checked, and redirects are followed manually so each
  hop is validated. Known limit: DNS can change between our check and Chromium's
  connection (DNS rebinding).
- At most 2 pages are processed at once, up to 10 wait; beyond that: 429.
- Rate limiting per IP, optional API key.

## Deploy on Plesk (IONOS)

1. Connect the repo in Plesk **Git**; under *Enable post deployment actions* enter `bash deploy.sh` (installs dependencies and Chromium, then restarts the app). In **Node.js**, set the application root and startup file `app.js`.
2. Node 20 or newer must be installed in Plesk (Tools & Settings > Updates > Add/Remove Components > Node.js); `deploy.sh` picks 22, then 20 automatically. Over SSH as root, once: `npx playwright install --with-deps chromium`
   (run it as the same user as the app, or set `PW_CHROMIUM_PATH`).
3. In the Node.js panel add environment variables: `PUBLIC_BASE_URL`, `ADMIN_PASSWORD` (and optionally `API_KEY`), and `PW_NO_SANDBOX=1` only if needed.
4. Serve the domain over HTTPS (Let's Encrypt in Plesk). Plesk provides `PORT`.
5. **Scheduled Tasks:** run `node scripts/cleanup.js` daily (deletes screenshots older than 24 h).
6. Check `https://YOUR-DOMAIN/health`.

## Checking that a push is live

`GET /health` returns `{ ok, version, startedAt, deployedAt }`. `version` comes from
`package.json` and is bumped on every push, so it tells you which code the server runs;
`startedAt` shows when the app last restarted.

```bash
bash scripts/check-deploy.sh https://YOUR-DOMAIN        # waits until /health shows the repo's version
```

For pushes to deploy by themselves, in Plesk open **Git** > your repository > settings,
set the deploy mode to **Automatic**, copy the **Webhook URL** and add it in GitHub under
*Settings > Webhooks* (content type `application/json`, push events only).
Without the webhook, click **Pull Updates** in Plesk after each push.

## Chrome extension for kids

`extension/` holds a separate Chrome extension (not part of the server) with Hebrew lessons for NotebookLM, for
children aged 6 to 9. See `extension/README.md` for installing it and writing lessons.

## Project layout

Rule: **no file is longer than 200 lines**, and logic lives in folders by what it does.
`node scripts/check-file-size.js` checks it.

```
app.js                      Express entry: /, /admin/keys, /health, /shots, /mcp
deploy.sh                   Plesk post-deployment script
views/index.html            Main page (key generator)

mcp/                        The MCP server
  server.js                 Creates the server and registers the tools
  runTool.js                Every tool call: queue, measuring, errors, usage log
  fields.js                 Input fields shared by the tools, public address
  tools/                    One file per tool: explainPage, pageOutline, captureArea

services/
  urlGuard.js               URL validation and SSRF protection
  keys.js                   Generated API keys with expiry
  queue.js                  Concurrency limiter (2 running, 10 waiting)
  usage.js                  Measures and logs CPU, memory, bandwidth per call
  browser/                  Playwright
    index.js                Public API: capturePage, getOutline, captureArea, closeBrowser
    launch.js               The one shared Chromium
    openPage.js             Opens a page safely (every request and redirect hop is checked)
    pageCache.js            Pages kept for about a minute
    withPage.js             Reuses a kept page or opens one
    constants.js, errors.js, textUtil.js
    jobs/                   capturePage, getOutline, captureArea
    pageScripts/            Code that runs inside the page: collectOutline, textInRegion

scripts/                    check-deploy.sh, check-file-size.js, cleanup.js, usage-report.js

extension/                  Chrome extension: Hebrew lessons for kids (separate from the server)
  manifest.json, background.js
  content/                  The helper on the page, one file per job (see extension/README.md)
  lessons/                  Lesson files (plain JSON)
```

## Next phase

See `BACKLOG.md` for the full plan. Next after team testing:

REST `POST /explain` with `services/llm.js` (provider still to be chosen),
returning `{ explanation, screenshotUrl }`.
