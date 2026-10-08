// Usage: node bench/compare.cjs <A tag> <B tag>   -> side-by-side of two result files (medians), B relative to A.
const fs = require('fs');
const path = require('path');
const load = (t) => JSON.parse(fs.readFileSync(path.join(__dirname, 'results', t + '.json'), 'utf8'));
const [A, B] = [load(process.argv[2]), load(process.argv[3])];
const pct = (a, b) => (a ? ((b - a) / a * 100).toFixed(0).padStart(4) + '%' : '   - ');
const cols = [['intervalAvg', 'frame ms'], ['p99', 'p99'], ['fps', 'fps'], ['mainTask', 'main ms'], ['updateMs', 'upd ms'], ['renderMs', 'rend ms'], ['gpuBusyMsPerFrame', 'gpu ms']];
console.log(`${A.tag}  ->  ${B.tag}`);
console.log('scenario'.padEnd(13) + cols.map(([, l]) => l.padStart(18)).join(''));
for (const id of Object.keys(A.scenarios)) {
  const a = A.scenarios[id], b = B.scenarios[id];
  if (!b) continue;
  console.log(id.padEnd(13) + cols.map(([k]) => `${String(a[k]).padStart(6)} > ${String(b[k]).padStart(6)} ${pct(a[k], b[k])}`.padStart(18)).join(''));
}
