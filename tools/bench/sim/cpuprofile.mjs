// node tools/bench/sim/cpuprofile.mjs <file.cpuprofile> [topN]
// Summarizes a V8 .cpuprofile (from `node --cpu-prof tools/bench/sim/lockstep.mjs --solo`): INCLUSIVE time per function (callees
// included), SELF time per function, and self time per source line (V8 credits inlined callee code to the line it was inlined at).
import fs from 'node:fs';

const p = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const top = parseInt(process.argv[3] || '30', 10);
const dtTotal = p.timeDeltas.reduce((a, b) => a + b, 0);
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const counts = new Map();
p.samples.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
const usPerSample = dtTotal / p.samples.length;
const name = (cf, line) => `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${line ?? cf.lineNumber + 1}`;
const noise = /^\(|child_process|spawnSync|execSync|node:|lockstep|compileSourceTextModule/;

const self = new Map();
const lines = new Map();
const incl = new Map();
for (const [id, c] of counts) {
  const n = byId.get(id);
  const k = name(n.callFrame);
  self.set(k, (self.get(k) || 0) + c * usPerSample);
  for (const t of n.positionTicks || []) {
    const lk = name(n.callFrame, t.line);
    lines.set(lk, (lines.get(lk) || 0) + t.ticks * usPerSample);
  }
  const seen = new Set();
  for (let cur = id; cur != null; cur = parent.get(cur)) {
    const ik = name(byId.get(cur).callFrame);
    if (!seen.has(ik)) { seen.add(ik); incl.set(ik, (incl.get(ik) || 0) + c * usPerSample); }
  }
}
const fmt = (m) => [...m.entries()]
  .filter(([k]) => !noise.test(k))
  .sort((a, b) => b[1] - a[1]).slice(0, top)
  .map(([k, v]) => `${((v / dtTotal) * 100).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`).join('\n');
console.log('INCLUSIVE time (callees included):\n' + fmt(incl) + '\n');
console.log('SELF time by function:\n' + fmt(self) + '\n');
console.log('SELF time by source line (inlined code is credited to the line it was inlined at):\n' + fmt(lines));
