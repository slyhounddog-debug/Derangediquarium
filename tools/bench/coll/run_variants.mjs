import { reference, buildFn, runLockstep, timeIt, SCENARIOS } from './harness.mjs';
import * as V from './variants.mjs';
const names = Object.keys(V).filter((k) => k !== 'PREFIX');
const only = process.argv[2];
const fns = {};
for (const k of names) if (!only || only === k) fns[k] = buildFn(V[k]);
console.log('ms per tick (2 iterations)  |  bit-exact equality vs the reference over 300 ticks');
console.log('scenario'.padEnd(13), 'REF'.padStart(8), ...Object.keys(fns).map((k) => k.padStart(8)), '  equality');
for (const s of Object.keys(SCENARIOS)) {
  const ref = timeIt(reference, s);
  const row = [], eq = [];
  for (const [k, f] of Object.entries(fns)) {
    row.push(timeIt(f, s).toFixed(2).padStart(8));
    const r = runLockstep(f, s, 300);
    eq.push(k + ':' + (r.ok ? 'EXACT' : `DIFF@t${r.tick}.${r.field}`));
  }
  console.log(s.padEnd(13), ref.toFixed(2).padStart(8), ...row, ' ', eq.join(' '));
}
