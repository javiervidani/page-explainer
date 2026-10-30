// Tool explain_page: the text of a page plus a screenshot link.
const { z } = require('zod');
const { capturePage } = require('../../services/browser');
const { runTool } = require('../runTool');
const { BASE_URL, urlField, viewportField, refreshField, reuseNote } = require('../fields');

function registerExplainPage(server, ctx) {
  server.registerTool(
    'explain_page',
    {
      title: 'Explain web page',
      description:
        'Opens a public web page in a headless browser and returns its visible text plus a ' +
        'link to a screenshot. Use the text to explain what the page is, its main sections and ' +
        'key points in clear, simple language. To look at one part of the page as an image, use ' +
        'page_outline and then capture_area.',
      inputSchema: {
        url: urlField,
        viewport: viewportField,
        fullPage: z.boolean().optional().describe('true (default): screenshot of the whole page; false: only the visible screen'),
        refresh: refreshField,
      },
    },
    ({ url, viewport, fullPage, refresh }) => runTool('explain_page', url, ctx, async (stats) => {
      const { text, screenshotFile, finalUrl } = await capturePage(url, stats, { viewport, fullPage, refresh, cacheOwner: ctx.keyLabel });
      const body = text.length < 200
        ? `${text}\n\n[Note: the extracted text is very short; the page may be incomplete or script-rendered.]`
        : text;
      return {
        content: [{
          type: 'text',
          text: `URL: ${finalUrl}\n${reuseNote(stats)}Screenshot: ${BASE_URL}/shots/${screenshotFile}\n\n--- PAGE TEXT ---\n${body}`,
        }],
      };
    })
  );
}

module.exports = { registerExplainPage };
