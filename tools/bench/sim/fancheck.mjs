// node tools/bench/sim/fancheck.mjs [samples=200000]
// computeFanForce, committed version vs working tree, on random items and random fans — including items placed exactly on the
// cone's edge, at the range limit, and on the fan's centre. Every fx/fy must be bit-identical.
import './nodestubs.mjs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractOldJs, repo } from './oldtree.mjs';

const samples = parseInt(process.argv[2] || '200000', 10);
const oldJs = extractOldJs();
const A = await import(pathToFileURL(path.join(oldJs, 'Grid.js')).href);
const B = await import(pathToFileURL(path.join(repo, 'js/Grid.js')).href);
const C = await import(pathToFileURL(path.join(repo, 'js/Config.js')).href);
let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const TILE = 32, FAN_TYPES = ['fan_t2', 'fan_t3', 'fan_t4'];
const HALF = (C.FAN_CONE_HALF_ANGLE_DEG ?? 30) * Math.PI / 180;

function makeState() {
  const buildingData = {};
  for (let i = 0; i < 8; i++) {
    const row = 22 + Math.floor(rnd() * 14), col = 3 + Math.floor(rnd() * 48);
    buildingData[`${row},${col}`] = { type: FAN_TYPES[Math.floor(rnd() * 3)], angle: (rnd() * 2 - 1) * Math.PI, filterItems: rnd() < 0.3 ? ['coin'] : [], rangePct: rnd() < 0.5 ? 100 : 10 + Math.floor(rnd() * 90) };
  }
  buildingData['30,30'] = { type: 'collector', angle: 0 }; // not a fan: must be ignored
  return { level: { buildingData, powerEfficiency: 0.3 + rnd() * 0.7, items: [] } };
}
const sa = makeState(); seed = 4242; const sb = makeState(); // identical copies
const fans = Object.entries(sa.level.buildingData).filter(([, d]) => d.type.startsWith('fan'));
const TYPES = ['coin', 'waste', 'food', 'science'];
let bad = 0, inCone = 0;
for (let n = 0; n < samples; n++) {
  const [key, data] = fans[Math.floor(rnd() * fans.length)];
  const [row, col] = key.split(',').map(Number);
  const fx = col * TILE + TILE / 2, fy = row * TILE + TILE / 2;
  const range = (C.FAN_STATS?.[data.type]?.maxRange ?? 300) * Math.max(0.01, Math.min(1, (data.rangePct ?? 100) / 100));
  let ang, dist;
  const mode = n % 6;
  if (mode === 0) { ang = data.angle + HALF; dist = rnd() * range; }              // exactly on the cone edge
  else if (mode === 1) { ang = data.angle - HALF; dist = rnd() * range; }
  else if (mode === 2) { ang = data.angle + (rnd() * 2 - 1) * HALF * 1.2; dist = range * (1 + (rnd() - 0.5) * 1e-9); } // range limit
  else if (mode === 3) { ang = data.angle + HALF + (rnd() < 0.5 ? 1 : -1) * 1e-10; dist = rnd() * range; } // a hair either side of the edge
  else if (mode === 4) { ang = 0; dist = 0; }                                       // on the fan's centre
  else { ang = rnd() * Math.PI * 2; dist = rnd() * range * 1.3; }
  const item = { type: TYPES[n % 4], x: fx + Math.cos(ang) * dist, y: fy + Math.sin(ang) * dist, mass: 1 };
  const ra = A.computeFanForce(sa, item), rb = B.computeFanForce(sb, { ...item });
  if (!Object.is(ra.fx, rb.fx) || !Object.is(ra.fy, rb.fy)) { if (bad++ < 5) console.log('MISMATCH', n, mode, item, ra, rb); }
  if (ra.fx !== 0 || ra.fy !== 0) inCone++;
}
console.log(bad === 0 ? `IDENTICAL: ${samples} random items vs ${fans.length} fans (${inCone} were inside a cone and pushed)` : `${bad} MISMATCHES`);
process.exitCode = bad ? 1 : 0;
