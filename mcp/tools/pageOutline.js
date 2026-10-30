// Tool page_outline: the regions of a page with selectors and positions.
const { getOutline } = require('../../services/browser');
const { runTool } = require('../runTool');
const { urlField, viewportField, refreshField, reuseNote } = require('../fields');

const MAX_OUTLINE_CHARS = 15000;

function registerPageOutline(server, ctx) {
  server.registerTool(
    'page_outline',
    {
      title: 'Outline of a web page',
      description:
        'Opens a public web page and lists its main regions (header, navigation, sidebars, main ' +
        'content, footer, forms...). Each region has a label, a CSS selector, its position and size ' +
        'in pixels and a text snippet, plus the headings and buttons of the page. Use it first when ' +
        'you need to look at or explain one part of a page, then call capture_area with a selector.',
      inputSchema: { url: urlField, viewport: viewportField, refresh: refreshField },
    },
    ({ url, viewport, refresh }) => runTool('page_outline', url, ctx, async (stats) => {
      const { finalUrl, outline } = await getOutline(url, stats, { viewport, refresh, cacheOwner: ctx.keyLabel });
      let json = JSON.stringify({ url: finalUrl, ...outline }, null, 1);
      if (json.length > MAX_OUTLINE_CHARS) json = `${json.slice(0, MAX_OUTLINE_CHARS)}\n... [outline cut]`;
      return {
        content: [{
          type: 'text',
          text: `${reuseNote(stats)}${json}\n\nNext: call capture_area with the same url and a region's "selector" (or its "box" as region) to see it as an image. Pages whose content sits inside iframes or shadow DOM may show fewer regions.`,
        }],
      };
    })
  );
}

module.exports = { registerPageOutline };
