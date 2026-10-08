import fs from 'node:fs';
import { buildFn, runLockstep, SCENARIOS, reference, timeIt } from './harness.mjs';
// reference = ORIGINAL Grid.js (backup, via REF_GRID); candidate = the real, current project Grid.js
const cur = fs.readFileSync(new URL('../../../js/Grid.js', import.meta.url), 'utf8');
const src = cur.slice(cur.indexOf('function applyItemPush('), cur.indexOf('// ---- Rendering ----'));
const f = buildFn(src);
let all = true, runs = 0;
for (const seed of (process.env.SEEDS || '7,21,33').split(',').map(Number)) {
  process.env.SEED = String(seed);
  for (const iters of [[4], [2], [4, 2, 3]]) for (const s of Object.keys(SCENARIOS)) {
    const r = runLockstep(f, s, Number(process.env.TICKS || 500), iters); runs++;
    if (!r.ok) { all = false; console.log('DIFF', seed, JSON.stringify(iters), s, JSON.stringify(r)); }
  }
}
console.log(all ? `PASS: project Grid.js is bit-exact vs the ORIGINAL Grid.js in all ${runs} lockstep runs` : 'FAIL');
for (const s of Object.keys(SCENARIOS)) console.log(s.padEnd(12), 'original', timeIt(reference, s).toFixed(2), 'new', timeIt(f, s).toFixed(2), 'ms/tick');
