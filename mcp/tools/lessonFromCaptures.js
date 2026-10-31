// Tool lesson_from_captures (team keys only): turns the saved screens of a project into a draft list of slides for Talkdeck.
// It writes nothing anywhere: the chat adds the narration and then calls Talkdeck's slide_add and slide_image_upload.
const { z } = require('zod');
const { listProject } = require('../../services/captures/store');
const { signedPath } = require('../../services/captures/signing');
const { BASE_URL } = require('../fields');
const { LINK_SECONDS, asText } = require('./listCaptures');

const NOTEBOOK_HOSTS = ['notebook.google.com', 'notebooklm.google.com'];
const sourceOf = (page) => (page && NOTEBOOK_HOSTS.includes(page.host) ? 'Gemini Notebook' : (page && page.host) || '');

function registerLessonFromCaptures(server) {
  server.registerTool(
    'lesson_from_captures',
    {
      title: 'Draft lesson slides from saved screens',
      description:
        'Turns the saved screens of a project into a draft list of Talkdeck slides, in the order they were saved. Each draft has ' +
        'a title (the marked button), `layout: "snapshot"`, `source`, `show.text` (the marked button) and the picture link (valid ' +
        'one hour). The narration `text` is left for you to write, and `screen` must differ from `title`. Then for each draft call ' +
        'Talkdeck slide_add (without imageUrl) and slide_image_upload with the imageUrl, and lesson_build once at the end. ' +
        'This tool changes nothing.',
      inputSchema: { project: z.string().min(1).max(40).describe('Project name (see list_captures)') },
    },
    ({ project }) => {
      const screens = listProject(project);
      if (!screens.length) return asText(`No screens saved in project "${project}".`);
      const slides = screens.map((c, i) => ({
        index: i,
        captureId: c.id,
        title: c.target ? c.target.label : c.page && c.page.title ? c.page.title.slice(0, 40) : `Screen ${i + 1}`,
        text: '',
        screen: c.note || '',
        layout: 'snapshot',
        source: sourceOf(c.page),
        ...(c.target ? { show: { text: [c.target.label] } } : {}),
        imageUrl: `${BASE_URL}${signedPath(c.id, LINK_SECONDS)}`,
      }));
      return asText({
        project,
        slides,
        todo: 'Write `text` (what is said aloud) for every slide and make `screen` a different, short line from `title`. ' +
          'Then slide_add each slide (without captureId and imageUrl), slide_image_upload with its imageUrl, and lesson_build.',
      });
    }
  );
}

module.exports = { registerLessonFromCaptures };
