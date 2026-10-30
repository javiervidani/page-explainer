// Errors the browser code throws. `status` is the HTTP-like code the tools report.
// A problem with what the caller asked for (bad selector, area too large, ...): reported as 400.
class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Page took too long to load');
    this.status = 408;
  }
}

module.exports = { InputError, TimeoutError };
