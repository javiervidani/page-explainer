// Tools remote_labels and remote_capture (team keys only): ask the author's team extension, while its auto mode is on,
// for the names on the screen, or to mark a button and save the screen. Nothing is clicked or typed.
// The author reads you a 6-digit code from the banner in the browser; without it nothing works.
const { z } = require('zod');
const { run } = require('../../services/remote/queue');
const { status } = require('../../services/remote/sessions');
const { asText } = require('./listCaptures');

const code = z.string().regex(/^\d{6}$/).describe('The 6-digit code the author reads from the banner of the extension (auto mode)');
// Some clients send every value as text, so "true" is accepted as true and a JSON text as a list.
const asBool = (v) => (v === 'true' ? true : v === 'false' ? false : v);
const asList = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return v; } };

// One shot: what to look for and how to take it.
const shotFields = {
  find: z.preprocess(asList, z.array(z.string().min(1).max(40)).min(1).max(5).optional()).describe('Button or panel names to look for, best first (as shown on screen)'),
  scope: z.enum(['element', 'panel']).optional().describe("'panel' frames the whole panel that holds the name"),
  note: z.string().max(500).optional().describe('Short note saved with the screen (what this step is about)'),
  crop: z.preprocess(asBool, z.boolean().optional()).describe('true: save only the part of the screen around the marked button or panel (bigger text on a slide)'),
};
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
        'remote_labels first). The saved screen is listed by list_captures. With `crop: true` only the part around the marked ' +
        'button or panel is saved, so the text is bigger on a slide; with `shots` you take several pictures of the same open screen ' +
        '(one frame each) in one call. Needs the 6-digit code from the author.',
      inputSchema: {
        code,
        project: z.string().min(1).max(40).describe('Lesson project name the screen is saved into'),
        ...shotFields,
        shots: z.preprocess(asList, z.array(z.object(shotFields)).min(1).max(5).optional()).describe(
          'Several pictures of the same open screen in one call, each with its own frame (each shot has find, scope, note, crop). ' +
          'Use it instead of the fields above.'),
      },
    },
    async ({ code: c, ...args }) => {
      try {
        const r = await run(c, 'capture', args);
        if (!r.ok && !(r.shots || []).some((x) => x.ok)) return toError(Object.assign(new Error(r.error || (r.shots && r.shots[0].error) || 'The extension could not do that'), { status: 409 }));
        const left = status(c).secondsLeft;
        // One shot keeps the old answer shape; several give a list (a shot that failed says why, the others are saved).
        if (r.shots.length === 1) return asText({ saved: true, id: r.shots[0].id, marked: r.shots[0].marked, project: args.project, secondsLeft: left });
        return asText({ saved: r.shots.filter((x) => x.ok).length, project: args.project, shots: r.shots, secondsLeft: left });
      } catch (err) { return toError(err); }
    }
  );
}

module.exports = { registerRemoteCapture };
