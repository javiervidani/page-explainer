// Public API of the browser code: three jobs on a page, plus shutdown.
//   capturePage - text and a screenshot file
//   getOutline  - the regions of the page
//   captureArea - one area as an image
const { capturePage } = require('./jobs/capturePage');
const { getOutline } = require('./jobs/getOutline');
const { captureArea } = require('./jobs/captureArea');
const { closeLaunched } = require('./launch');
const { dropAll } = require('./pageCache');
const { SHOTS_DIR } = require('./constants');
const { InputError, TimeoutError } = require('./errors');

async function closeBrowser() {
  dropAll();
  await closeLaunched();
}

module.exports = { capturePage, getOutline, captureArea, closeBrowser, SHOTS_DIR, TimeoutError, InputError };
