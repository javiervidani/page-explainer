// Job 2: the regions of a page.
const { withPage } = require('../withPage');
const { collectOutline } = require('../pageScripts/collectOutline');

async function getOutline(rawUrl, stats = {}, options = {}) {
  return withPage(rawUrl, options, stats, async (page) => {
    if (stats.sample) stats.sample();
    return { finalUrl: page.url(), outline: await page.evaluate(collectOutline) };
  });
}

module.exports = { getOutline };
