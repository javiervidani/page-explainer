// Simple concurrency limiter: at most MAX_RUNNING jobs at once,
// at most MAX_WAITING more in line; beyond that we reject (429).
const MAX_RUNNING = 2;
const MAX_WAITING = 10;

let running = 0;
const waiting = [];

class QueueFullError extends Error {
  constructor() {
    super('Server is busy, try again later');
    this.status = 429;
  }
}

function next() {
  if (running < MAX_RUNNING && waiting.length > 0) {
    running++;
    waiting.shift()();
  }
}

// Runs `job` (an async function) when a slot is free.
async function enqueue(job) {
  if (running >= MAX_RUNNING && waiting.length >= MAX_WAITING) {
    throw new QueueFullError();
  }
  await new Promise((resolve) => {
    waiting.push(resolve);
    next();
  });
  try {
    return await job();
  } finally {
    running--;
    next();
  }
}

const getRunning = () => running;

module.exports = { enqueue, getRunning, QueueFullError };
