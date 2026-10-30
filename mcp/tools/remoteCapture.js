// Tools remote_labels and remote_capture (team keys only): ask the author's team extension, while its auto mode is on,
// for the names on the screen, or to mark a button and save the screen. Nothing is clicked or typed.
// The author reads you a 6-digit code from the banner in the browser; without it nothing works.
const { z } = require('zod');
const { run } = require('../../services/remote/queue');
const { status } = require('../../services/remote/sessions');
const { asText } = require('./listCaptures');

const code = z.string().regex(/^\d{6}$/).describe('The 6-digit code the author reads from the banner of the extension (auto mode)');
const toError = (err) => ({ isError: true, content: [{ type: 'text', text: err.status ? err.message : 'Remote capture failed' }] });

function registerRemoteCapture(server) {
  server.registerTool(
    'remote_labels',
    {
      title: 'Names on the author\'s screen (auto mode)',
      description:
        'Asks the team extension, while the author has auto mode on, for the button and panel names visible on the open ' +
        'Gemini Notebook tab. Use it to know the exact names before remote_capture. Needs the 6-digit code from the author.',
      inputSchema: { code },
    },
    async ({ code: c }) => {
      try {
        const r = await run(c, 'labels', {});
        return r.ok ? asText({ labels: r.labels, page: r.page }) : toError(Object.assign(new Error(r.error || 'The extension could not do that'), { status: 409 }));
      } catch (err) { return toError(err); }
    }
  );

  server.registerTool(
    'remote_capture',
    {
      title: 'Mark a button and save the screen (auto mode)',
      description:
        'Asks the team extension (auto mode on) to find a button or panel by name on the open Gemini Notebook tab, draw the ' +
        'yellow frame on it and save the screen into a project, like the author pressing Save. It never clicks anything: the ' +
        'author opens the right screen, you ask for one capture per screen. `find` is a list of names to try in order (use ' +
        'remote_labels first). The saved screen is listed by list_captures. Needs the 6-digit code from the author.',
      inputSchema: {
        code,
        project: z.string().min(1).max(40).describe('Lesson project name the screen is saved into'),
        find: z.array(z.string().min(1).max(40)).min(1).max(5).describe('Button or panel names to look for, best first (as shown on screen)'),
        scope: z.enum(['element', 'panel']).optional().describe("'panel' frames the whole panel that holds the name"),
        note: z.string().max(500).optional().describe('Short note saved with the screen (what this step is about)'),
      },
    },
    async ({ code: c, ...args }) => {
      try {
        const r = await run(c, 'capture', args);
        if (!r.ok) return toError(Object.assign(new Error(r.error || 'The extension could not do that'), { status: 409 }));
        return asText({ saved: true, id: r.id, marked: r.marked, project: args.project, secondsLeft: status(c).secondsLeft });
      } catch (err) { return toError(err); }
    }
  );
}

module.exports = { registerRemoteCapture };
