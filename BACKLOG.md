# Backlog

Order is roughly the order I would do things. Update the status as work moves.

## Done
- [x] MCP server over Streamable HTTP with the `explain_page` tool (text + screenshot link)
- [x] SSRF protection (every request and redirect hop is checked), queue (2 running, 10 waiting), rate limit
- [x] Plesk deployment through Git webhook, `deploy.sh`, `/health` with version
- [x] Main page: generate expiring API keys (1, 7, 30 or 90 days) behind an admin password
- [x] Team testing: key label per person, connector URL (`/mcp?key=...`) for URL-only connector screens
- [x] Usage log per call: CPU, memory, bandwidth (`data/usage-*.jsonl`, `node scripts/usage-report.js`)

## Now: team testing (Claude connector)
- [ ] Set `PUBLIC_BASE_URL` in Plesk so screenshot links are absolute
- [ ] Switch the `pagelens` app to Node 20.20.2 in Plesk Node.js Manager
- [ ] Add the connector in Claude.ai (Settings > Connectors > Add custom connector) with the connector URL, and confirm tools show up and a page gets explained. Not verified yet: Claude.ai may behave differently from the plain HTTP clients I tested.
- [ ] Each team member gets their own labelled, short-lived key
- [ ] Read the usage report after a few days and decide limits (see "Cost and abuse controls")

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

## Ideas
- [ ] `mode` parameter on `explain_page`: `text` only or text with an LLM explanation (needs the REST phase work)
- [ ] Return the screenshot inline (base64) as an option
- [ ] Node 22 on the server
