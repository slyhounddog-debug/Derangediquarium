// Reproduces the bug in Node: load a saved level, run the sim so fish drop items, count duplicate ids — committed code vs fixed code.
import './nodestubs.mjs';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractOldJs } from './oldtree.mjs';
const save = JSON.parse(fs.readFileSync(new URL('../fixtures/stress.json', import.meta.url), 'utf8'));
// a realistic save: items and fish carry ids from an earlier session, including small ones
let n = 0; for (const it of save.level.items) it.id = 1 + n++; // unique ids 1..N, exactly what a real save holds after a long session
async function run(label, jsDir, reconcile) {
  const E = await import(pathToFileURL(jsDir + '/Entities.js').href + '?' + label);
  const C = await import(pathToFileURL(jsDir + '/Config.js').href + '?' + label);
  const state = { meta: JSON.parse(JSON.stringify(save.meta)), level: JSON.parse(JSON.stringify(save.level)), camera: { x: 0, y: 0, zoom: 1, viewWidth: 1792, viewHeight: 1064 }, ui: {}, debug: {} };
  const dupsBefore = dupCount(state.level.items);
  if (reconcile) E.reconcileIdsAfterLoad(state.level);
  let s = 7; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let t = 0; t < 3000; t++) { E.updateEntities(state, C.SIM_DT_MS); state.level.elapsed += C.SIM_DT_MS; }
  const ids = state.level.items.map((i) => i.id);
  console.log(`${label.padEnd(14)} items ${state.level.items.length}  duplicate ids before ${dupsBefore} / after 3000 ticks ${dupCount(state.level.items)}  (fish dup ${dupCount(state.level.entities)})`);
}
function dupCount(list) { const seen = new Set(); let d = 0; for (const o of list) { if (seen.has(o.id)) d++; else seen.add(o.id); } return d; }
await run('committed code', extractOldJs(), false);
await run('fixed code', fileURLToPath(new URL('../../../js', import.meta.url)), true);
