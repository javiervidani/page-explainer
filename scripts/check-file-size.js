// Fails when a source file is longer than 200 lines. Run: node scripts/check-file-size.js
// Keeps files small and the logic in folders. The lock file and images are skipped.
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const MAX_LINES = 200;
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && fs.existsSync(f) && !/(package-lock\.json|\.png|\.jpe?g|\.gitkeep)$/.test(f));

const tooLong = files
  .map((f) => ({ f, lines: fs.readFileSync(f, 'utf8').split('\n').length }))
  .filter((x) => x.lines > MAX_LINES)
  .sort((a, b) => b.lines - a.lines);

if (tooLong.length === 0) {
  console.log(`OK: all ${files.length} files are ${MAX_LINES} lines or shorter`);
} else {
  for (const x of tooLong) console.log(`${x.lines} lines  ${x.f}`);
  console.log(`\n${tooLong.length} file(s) over ${MAX_LINES} lines: split them into folders by what they do`);
  process.exit(1);
}
