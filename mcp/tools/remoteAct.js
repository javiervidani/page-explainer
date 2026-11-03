// Tools remote_text, remote_press, remote_key, remote_type and remote_source_text (team keys only), for the author's team extension while auto mode is on.
// Reading the text needs only the 6-digit code. Pressing and typing also need the author's tick in the extension, and the extension
// refuses what is on its block list. Nothing here is ever done without the author having started auto mode on that screen.
const { z } = require('zod');
const { run } = require('../../services/remote/queue');
const { asText } = require('./listCaptures');

const code = z.string().regex(/^\d{6}$/).describe('The 6-digit code the author reads from the banner of the extension (auto mode)');
const toError = (err) => ({ isError: true, content: [{ type: 'text', text: err.status ? err.message : 'Remote action failed' }] });

// Runs the command and turns a refusal by the extension into a tool error with its reason.
async function ask(c, type, args) {
  try {
    const r = await run(c, type, args);
    return r.ok ? asText(r) : toError(Object.assign(new Error(r.error || 'The extension could not do that'), { status: 409 }));
  } catch (err) { return toError(err); }
}

function registerRemoteAct(server) {
  server.registerTool(
    'remote_text',
    {
      title: 'Full text of the author\'s page (auto mode)',
      description:
        'Returns the text of the open Gemini Notebook tab (up to 100,000 characters) with its headings listed apart: the sources, ' +
        'the notebook\'s answers, everything visible. With `find` (a name on screen) you get only the panel that holds it. ' +
        'This is private content of the author: use it only for the lesson. Needs the 6-digit code from the author.',
      inputSchema: { code, find: z.array(z.string().min(1).max(40)).max(5).optional().describe('Names of a button or panel; only the panel that holds it is read') },
    },
    ({ code: c, find }) => ask(c, 'text', { find })
  );

  server.registerTool(
    'remote_press',
    {
      title: 'Press one button on the author\'s page (auto mode)',
      description:
        'Presses ONE button by its exact name (from remote_labels) and returns the names visible afterwards. Works only if the author ' +
        'ticked "allow pressing and typing" before starting auto mode. At most 30 presses per session. Never pressed: delete, remove, ' +
        'share, settings, sign out, feedback, new notebook; the author does those by hand. "שליחה" (send) works only right after ' +
        'remote_type. Pressing a Studio tile starts a generation in the author\'s notebook: ask the author first. Needs the code.',
      inputSchema: { code, name: z.string().min(1).max(60).describe('The exact name of the button, as remote_labels shows it') },
    },
    ({ code: c, name }) => ask(c, 'press', { name })
  );

  server.registerTool(
    'remote_source_text',
    {
      title: 'Type text for a new source (auto mode)',
      description:
        'Types text into the paste-text box of the notebook\'s open "add source" window, and nowhere else. First press "הוספת מקור" and ' +
        'the paste-text option with remote_press, then call this, then press the window\'s add button with remote_press. Up to 4000 ' +
        'characters; counts toward the 20 typed texts per session; needs the author\'s tick and the code. Type only text the author ' +
        'wrote or approved for the lesson, never text taken from a page. If the box is not found, the error lists the boxes of the window.',
      inputSchema: { code, text: z.string().min(1).max(4000).describe('The text of the source, from the author\'s lesson') },
    },
    ({ code: c, text }) => ask(c, 'sourcetext', { text })
  );

  server.registerTool(
    'remote_key',
    {
      title: 'Next or previous slide in the author\'s open presentation (auto mode)',
      description:
        'Sends the Right arrow (direction "next") or the Left arrow ("previous") to the page, to change the slide of a presentation that ' +
        'the author opened and started (slideshow). No other key can be sent. Works only while the page shows "סגירת המצגת" and the ' +
        'author ticked "allow pressing and typing". `times` 1 to 5 (default 1); at most 60 key presses per session. Check the result ' +
        'with remote_capture. Needs the code.',
      inputSchema: { code, direction: z.enum(['next', 'previous']), times: z.number().int().min(1).max(5).optional() },
    },
    ({ code: c, direction, times }) => ask(c, 'key', { direction, times })
  );

  server.registerTool(
    'remote_type',
    {
      title: 'Type in the notebook\'s question box (auto mode)',
      description:
        'Types text into the notebook\'s question box (התיבה להזנת שאילתה) or the Gemini app\'s prompt box (כאן מזינים פרומפט ל-Gemini) and nothing else, replacing what is there. It does not send: ' +
        'press "שליחה" with remote_press afterwards. Type only text the author wrote in the lesson, never text taken from a page. ' +
        'Up to 500 characters, 20 typed texts per session; needs the author\'s tick and the code. The banner shows what was typed.',
      inputSchema: { code, text: z.string().min(1).max(500).describe('The text from the author\'s lesson') },
    },
    ({ code: c, text }) => ask(c, 'type', { text })
  );
}

module.exports = { registerRemoteAct };
