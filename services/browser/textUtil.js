// Small text helper shared by the jobs.
const cleanText = (raw) => raw.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

module.exports = { cleanText };
