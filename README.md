# Page Explainer (MCP server)

An MCP server (Node.js + Express + Playwright) with one tool, `explain_page`.
Give it a public URL; it opens the page in headless Chromium and returns the
page's visible text plus a link to a full-page screenshot. The calling model
(Claude, GPT, ...) writes the explanation itself, so **no LLM API key is needed**
in this phase.

## Tool

`explain_page({ url })` returns text containing the final URL, a screenshot URL
(`/shots/<uuid>.png`) and the page text (capped at ~20,000 characters).
Errors come back as MCP tool errors: invalid or blocked URL (400), page timeout
after 30 s (408), queue full (429), or a generic failure.

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

Open the main page (`/`), enter the admin password, choose 1, 7, 30 or 90 days and
click **Generate key**. The key is shown once; only its hash is stored in
`data/keys.json` (git-ignored). Expired keys stop working immediately. The
permanent `API_KEY` env var, if set, keeps working. Wrong-password attempts are
limited to 10 per hour per IP.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (Plesk sets it) |
| `PUBLIC_BASE_URL` | Public origin, e.g. `https://example.com`; used to build absolute screenshot links |
| `API_KEY` | Optional permanent key. `/mcp` requires a key in `x-api-key` or `Authorization: Bearer` whenever `API_KEY` or `ADMIN_PASSWORD` is set |
| `ADMIN_PASSWORD` | Password for the key generator on the main page. If empty, generation is disabled |
| `RATE_LIMIT_PER_MIN` | Requests per IP per minute on `/mcp` (default 30) |
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
2. Over SSH as root, once: `npx playwright install --with-deps chromium`
   (run it as the same user as the app, or set `PW_CHROMIUM_PATH`).
3. In the Node.js panel add environment variables: `PUBLIC_BASE_URL`, `ADMIN_PASSWORD` (and optionally `API_KEY`), and `PW_NO_SANDBOX=1` only if needed.
4. Serve the domain over HTTPS (Let's Encrypt in Plesk). Plesk provides `PORT`.
5. **Scheduled Tasks:** run `node scripts/cleanup.js` daily (deletes screenshots older than 24 h).
6. Check `https://YOUR-DOMAIN/health`.

## Project layout

```
deploy.sh            Plesk post-deployment script
app.js               Express entry: /, /admin/keys, /health, /shots, /mcp
views/index.html    Main page (key generator)
mcp/server.js        MCP server and the explain_page tool
services/urlGuard.js URL validation and SSRF protection
services/browser.js  Playwright: open page, extract text, screenshot
services/keys.js    Generated API keys with expiry
services/queue.js    Concurrency limiter (2 running, 10 waiting)
scripts/cleanup.js   Removes screenshots older than 24 h
```

## Next phase

REST `POST /explain` with `services/llm.js` (provider still to be chosen),
returning `{ explanation, screenshotUrl }`.
