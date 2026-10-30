// Tool list_captures: the lesson projects saved by the team extension, or the screens of one project.
const { z } = require('zod');
const { listProject, listProjects } = require('../../services/captures/store');
const { signedPath } = require('../../services/captures/signing');
const { BASE_URL } = require('../fields');

const LINK_SECONDS = Number(process.env.CAPTURE_LINK_TTL_S) || 3600;

const asText = (value) => ({ content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] });

function registerListCaptures(server) {
  server.registerTool(
    'list_captures',
    {
      title: 'List saved screens for lessons',
      description:
        'Lists the projects that have screens saved by the team lesson-maker extension. Give a project name to list its ' +
        'screens in the order they were saved (the order of the lesson steps). Each screen has an id, the note the author ' +
        'wrote, the button the author marked, and a link to the image that works for an hour (other services can download ' +
        'it). Use get_capture to look at one screen.',
      inputSchema: { project: z.string().max(40).optional().describe('Project name; leave out to list all projects') },
    },
    ({ project }) => {
      if (!project) {
        const projects = listProjects();
        return asText(projects.length ? projects : 'No screens have been saved yet.');
      }
      const items = listProject(project).map((c, i) => ({
        step: i + 1,
        id: c.id,
        note: c.note,
        markedButton: c.target ? c.target.label : null,
        buttonNamesSaved: c.labels.length,
        savedBy: c.createdBy,
        savedAt: c.createdAt,
        imageUrl: `${BASE_URL}${signedPath(c.id, LINK_SECONDS)}`,
      }));
      return asText(items.length ? items : `No screens saved in project "${project}".`);
    }
  );
}

module.exports = { registerListCaptures, LINK_SECONDS, asText };
