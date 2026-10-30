// Tool get_capture: one saved screen as an image, with the author's note and the button that was marked.
const fs = require('node:fs');
const { z } = require('zod');
const { getCapture } = require('../../services/captures/store');
const { signedPath } = require('../../services/captures/signing');
const { BASE_URL } = require('../fields');
const { LINK_SECONDS } = require('./listCaptures');

function registerGetCapture(server) {
  server.registerTool(
    'get_capture',
    {
      title: 'Look at one saved screen',
      description:
        'Returns one screen saved by the team extension: the image (with the yellow frame on the button the author ' +
        'marked), the author\'s note, the marked button (its name and position in the picture), the names of the buttons ' +
        'and headings that were visible, and an image link that works for an hour. Use it to write a lesson step.',
      inputSchema: {
        id: z.string().max(40).describe('Screen id from list_captures'),
        image: z.boolean().optional().describe('false: details and link only, without the picture (default true)'),
      },
    },
    ({ id, image }) => {
      const found = getCapture(id);
      if (!found) return { isError: true, content: [{ type: 'text', text: 'No saved screen with that id (it may have been removed after 30 days).' }] };
      const { meta } = found;
      const details = {
        id: meta.id,
        project: meta.project,
        note: meta.note,
        markedButton: meta.target,
        visibleButtonNames: meta.labels,
        page: meta.page,
        savedBy: meta.createdBy,
        savedAt: meta.createdAt,
        removedAfter: meta.expiresAt,
        imageUrl: `${BASE_URL}${signedPath(meta.id, LINK_SECONDS)}`,
      };
      const content = [{ type: 'text', text: JSON.stringify(details, null, 1) }];
      if (image !== false) content.push({ type: 'image', data: fs.readFileSync(found.file).toString('base64'), mimeType: meta.mimeType });
      return { content };
    }
  );
}

module.exports = { registerGetCapture };
