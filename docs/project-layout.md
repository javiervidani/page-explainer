# Project layout

Rule: **no file is longer than 200 lines**, and logic lives in folders by what it does.
`node scripts/check-file-size.js` checks it.

```
app.js                      Express entry: /, /admin/keys, /health, /shots, /mcp, /captures
routes/captures.js          Upload of saved screens (team keys) and signed image links
deploy.sh                   Plesk post-deployment script
views/index.html            Main page (key generator)

mcp/                        The MCP server
  server.js                 Creates the server and registers the tools
  runTool.js                Every tool call: queue, measuring, errors, usage log
  fields.js                 Input fields shared by the tools, public address
  tools/                    One file per tool: explainPage, pageOutline, captureArea,
                            listCaptures, getCapture (team keys only)

services/
  urlGuard.js               URL validation and SSRF protection
  keys.js                   Generated API keys with expiry
  queue.js                  Concurrency limiter (2 running, 10 waiting)
  captures/                 Saved lesson screens: store, validate, signing
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
extension-maker/            Team extension: mark a button, save the screen to PageLens
docs/                       lesson-maker.md: how the team makes lessons
  manifest.json, background.js
  content/                  The helper on the page, one file per job (see extension/README.md)
  lessons/                  Lesson files (plain JSON)
```
