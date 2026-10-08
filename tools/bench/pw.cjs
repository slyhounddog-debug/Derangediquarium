// Finds Playwright without making it a project dependency (the game itself only needs express).
// Order: a normal `require('playwright')`, then $PLAYWRIGHT_PATH, then any copy `npx playwright ...` left in the npm cache.
const fs = require('fs');
const path = require('path');
const os = require('os');

function find() {
  try { return require('playwright'); } catch { /* fall through */ }
  if (process.env.PLAYWRIGHT_PATH && fs.existsSync(process.env.PLAYWRIGHT_PATH)) return require(process.env.PLAYWRIGHT_PATH);
  const roots = [path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'), path.join(os.homedir(), '.npm', '_npx')];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      const p = path.join(root, dir, 'node_modules', 'playwright');
      if (fs.existsSync(p)) return require(p);
    }
  }
  throw new Error('Playwright not found. Run `npm i -D playwright` (then `npx playwright install chromium`) or set PLAYWRIGHT_PATH to its folder.');
}
module.exports = find();
