// Tool capture_area: one area of a page as an image the model can see, plus the text inside it.
const { z } = require('zod');
const { captureArea } = require('../../services/browser');
const { runTool } = require('../runTool');
const { BASE_URL, urlField, viewportField, refreshField, reuseNote } = require('../fields');

function registerCaptureArea(server, ctx) {
  server.registerTool(
    'capture_area',
    {
      title: 'Screenshot of one area of a web page',
      description:
        'Opens a public web page and returns an image of ONE area, plus the text inside it. Choose the ' +
        'area with a CSS selector (get selectors from page_outline) or with a region in page pixels. ' +
        'With neither, you get the visible screen (or the whole page with fullPage true). Areas taller ' +
        'than 2000px are cut: call again with a region whose y continues where the image ended.',
      inputSchema: {
        url: urlField,
        selector: z.string().max(300).optional().describe('CSS selector of the area, e.g. "aside" or "#sources"'),
        region: z
          .object({
            x: z.number().min(0),
            y: z.number().min(0),
            width: z.number().min(10).max(1600),
            height: z.number().min(10).max(2000),
          })
          .optional()
          .describe('Area in page pixels from the top-left corner of the whole page (used when no selector is given)'),
        viewport: viewportField,
        fullPage: z.boolean().optional().describe('With no selector or region: capture the whole page instead of the visible screen'),
        refresh: refreshField,
      },
    },
    ({ url, selector, region, viewport, fullPage, refresh }) => runTool('capture_area', url, ctx, async (stats) => {
      const r = await captureArea(url, { selector, region, fullPage }, stats, { viewport, refresh, cacheOwner: ctx.keyLabel });
      const c = r.clip;
      const notes = [
        `URL: ${r.finalUrl}`,
        `Area: ${r.what}; image covers x=${c.x}, y=${c.y}, width=${c.width}, height=${c.height} (page height ${r.pageHeight}px)`,
        `Saved copy: ${BASE_URL}/shots/${r.file}`,
      ];
      if (r.cut) {
        notes.push(`The area is ${r.boxHeight}px tall and was cut. To continue, call again with region { x: ${c.x}, y: ${c.y + c.height}, width: ${c.width}, height: ${Math.min(2000, r.pageHeight - (c.y + c.height))} }.`);
      }
      if (stats.cache === 'hit') notes.push(reuseNote(stats).trim());
      notes.push('', '--- TEXT IN THIS AREA ---', r.text || '(no text found in this area)');
      return {
        content: [
          { type: 'text', text: notes.join('\n') },
          { type: 'image', data: r.image, mimeType: 'image/jpeg' },
        ],
      };
    })
  );
}

module.exports = { registerCaptureArea };
