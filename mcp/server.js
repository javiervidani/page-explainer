// MCP server definition: one tool, `explain_page`.
// The calling model (Claude, GPT, ...) writes the explanation itself from the text we return.
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');
const { capturePage } = require('../services/browser');
const { enqueue } = require('../services/queue');

// Absolute screenshot links need the public origin, e.g. https://example.com
const BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

function createMcpServer() {
  const server = new McpServer({ name: 'page-explainer', version: '1.0.0' });

  server.registerTool(
    'explain_page',
    {
      title: 'Explain web page',
      description:
        'Opens a public web page in a headless browser and returns its visible text plus a ' +
        'link to a full-page screenshot. Use the text to explain what the page is, its main ' +
        'sections and key points in clear, simple language.',
      inputSchema: { url: z.string().describe('Public http(s) URL of the page') },
    },
    async ({ url }) => {
      try {
        const { text, screenshotFile, finalUrl } = await enqueue(() => capturePage(url));
        const screenshotUrl = `${BASE_URL}/shots/${screenshotFile}`;
        const body = text.length < 200
          ? `${text}\n\n[Note: the extracted text is very short; the page may be incomplete or script-rendered.]`
          : text;
        return {
          content: [{
            type: 'text',
            text: `URL: ${finalUrl}\nScreenshot: ${screenshotUrl}\n\n--- PAGE TEXT ---\n${body}`,
          }],
        };
      } catch (err) {
        // Known errors (400/408/429) carry a safe message; hide details of anything else.
        const message = err.status ? err.message : 'Failed to load the page';
        if (!err.status) console.error('explain_page failed:', err.message);
        return { isError: true, content: [{ type: 'text', text: message }] };
      }
    }
  );

  return server;
}

module.exports = { createMcpServer };
