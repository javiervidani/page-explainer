// The commands a chat sends to the armed extension, and the answers. One file per command and per answer.
// Only two kinds exist, and neither clicks or types: "labels" (names visible on screen) and "capture" (mark a button, save the screen).
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const store = require('./store');
const { active, status, RemoteError } = require('./sessions');

const MAX_COMMANDS = 60;          // per session
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Checks and cleans what a chat asked for. Throws RemoteError(400) when it is not allowed.
function cleanCommand(type, args = {}) {
  if (type === 'labels') return {};
  if (type !== 'capture') throw new RemoteError('unknown command', 400);
  const find = (Array.isArray(args.find) ? args.find : []).map((f) => str(f, 40)).filter(Boolean).slice(0, 5);
  if (!find.length) throw new RemoteError('find: give 1 to 5 button or panel names', 400);
  const project = str(args.project, 40).replace(/[^\p{L}\p{N} ._-]/gu, '').trim();
  if (!project) throw new RemoteError('project: a name is required', 400);
  return { find, scope: args.scope === 'panel' ? 'panel' : 'element', note: str(args.note, 500), project };
}

// Puts a command in the queue. The session has to be armed and the extension has to be asking for work.
function enqueue(code, type, args) {
  const st = status(code);
  if (!st.armed) throw new RemoteError('There is no active auto mode with that code. Ask the author to turn it on in the extension and read you the code.');
  if (!st.connected) throw new RemoteError('The extension is not answering. Is the NotebookLM tab open and in front, with auto mode on?');
  const session = active(code);
  if (session.commands >= MAX_COMMANDS) throw new RemoteError('This session reached its limit of commands. Ask the author to start a new one.');
  const command = { id: crypto.randomBytes(6).toString('hex'), type, args: cleanCommand(type, args), createdAt: Date.now() };
  session.commands++;
  store.writeSession(session);
  store.writeJson(path.join(store.dirOf(code), 'cmd', `${command.id}.json`), command);
  return command.id;
}

// The extension asks for work: waits up to `waitMs` for a command and hands it over once (renaming the file is the claim).
async function claim(code, waitMs) {
  const dir = store.dirOf(code);
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && active(code)) {
    let names = [];
    try { names = fs.readdirSync(path.join(dir, 'cmd')).filter((n) => n.endsWith('.json')).sort(); } catch { /* gone */ }
    for (const n of names) {
      try {
        fs.renameSync(path.join(dir, 'cmd', n), path.join(dir, 'claimed', n));
      } catch { continue; } // another copy of the app took it
      const command = store.readJson(path.join(dir, 'claimed', n));
      if (command && Date.now() - command.createdAt < 90000) return command;
    }
    await sleep(400);
  }
  return null;
}

// The extension answers a command it claimed.
function complete(code, id, result) {
  if (!store.isId(id) || !fs.existsSync(path.join(store.dirOf(code), 'claimed', `${id}.json`))) throw new RemoteError('unknown command', 404);
  store.writeJson(path.join(store.dirOf(code), 'res', `${id}.json`), result);
}

// The chat waits for the answer.
async function waitResult(code, id, timeoutMs = 45000) {
  const file = path.join(store.dirOf(code), 'res', `${id}.json`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = store.readJson(file);
    if (result) return result;
    await sleep(300);
  }
  throw new RemoteError('The extension did not answer in time.', 504);
}

// Ask the extension and wait for the answer.
async function run(code, type, args) {
  return waitResult(code, enqueue(code, type, args));
}

module.exports = { enqueue, claim, complete, waitResult, run, cleanCommand };
