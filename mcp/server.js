// MCP server definition. Three tools (each in mcp/tools/):
//   explain_page  - text of a page plus a screenshot link
//   page_outline  - the regions of a page (header, sidebar, main, ...) with selectors and positions
//   capture_area  - one region as an image the model can see, plus the text inside it
// Team keys also get list_captures and get_capture (screens saved by the team extension) the remote_* tools (auto mode) and lesson_from_captures (draft slides).
// The calling model (Claude, GPT, ...) writes the explanation itself from what we return.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { registerExplainPage } = require('./tools/explainPage');
const { registerPageOutline } = require('./tools/pageOutline');
const { registerCaptureArea } = require('./tools/captureArea');
const { registerListCaptures } = require('./tools/listCaptures');
const { registerGetCapture } = require('./tools/getCapture');
const { registerRemoteCapture } = require('./tools/remoteCapture');
const { registerLessonFromCaptures } = require('./tools/lessonFromCaptures');

// `ctx` says who is calling: { keyLabel, ip }. It only goes into the usage log.
function createMcpServer(ctx = {}) {
  const server = new McpServer({ name: 'page-explainer', version: require('../package.json').version });
  registerExplainPage(server, ctx);
  registerPageOutline(server, ctx);
  registerCaptureArea(server, ctx);
  if (ctx.isTeam) {
    registerListCaptures(server);
    registerGetCapture(server);
    registerRemoteCapture(server);
    registerLessonFromCaptures(server);
  }
  return server;
}

module.exports = { createMcpServer };
