import { reference, buildFn, REFERENCE_SRC, runLockstep, timeIt, SCENARIOS } from './harness.mjs';
// sanity: the reference run against a fresh copy of itself must be bit-exact (proves the harness itself is deterministic)
const ref2 = buildFn(REFERENCE_SRC);
for (const s of Object.keys(SCENARIOS)) { const r = runLockstep(ref2, s, 150); console.log('self-check', s, r.ok ? 'EXACT' : JSON.stringify(r)); }
for (const s of Object.keys(SCENARIOS)) console.log('reference ms/tick (2 iters)', s.padEnd(12), timeIt(reference, s).toFixed(3));
