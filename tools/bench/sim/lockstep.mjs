// Simulation equivalence + CPU benchmark, in plain Node (no browser).
//
//   node tools/bench/sim/lockstep.mjs [fixture=stress.json] [ticks=300] [--ref <dir containing the OLD js/ folder>] [--time]
//
// Runs the game's REAL updateEntities() (items, buildings, fish, aliens, ...) for `ticks` fixed 60Hz steps from a
// save fixture, twice: once with the OLD code and once with the CURRENT working tree, each with its own identically
// seeded Math.random stream and a fake clock. After every step the whole `state.level` of both is compared bit for bit
// (JSON of every number). Any difference prints the first diverging path and exits 1.
//   - OLD code: by default `git archive HEAD js` extracted to a temp folder, i.e. "what is committed". Use --ref to compare
//     against any other copy (e.g. a checkout of an earlier commit).
//   - --time also reports ms per simulation step for each side (alternating, so machine noise hits both equally).
// First run it with the same code on both sides (--self) to prove the harness itself is deterministic.
import './nodestubs.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--ref'));
const fixture = positional[0] || 'stress.json';
const ticks = parseInt(positional[1] || '300', 10);

// ---- the two code trees ----
let oldJs;
if (flag('--self')) { // a separate copy of the current tree, so the two sides share no module-level state
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsanity_sim_self_'));
  fs.cpSync(path.join(repo, 'js'), path.join(dir, 'js'), { recursive: true });
  oldJs = path.join(dir, 'js');
} else if (opt('--ref')) oldJs = path.join(path.resolve(opt('--ref')), 'js');
else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsanity_sim_old_'));
  const files = execSync('git ls-tree -r --name-only HEAD js', { cwd: repo }).toString().split(/\r?\n/).filter(Boolean);
  for (const f of files) { // plain git show per file (git archive | tar mis-parses a Windows drive letter)
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execSync(`git show HEAD:${f}`, { cwd: repo, maxBuffer: 64 * 1024 * 1024 }));
  }
  oldJs = path.join(dir, 'js');
}
const newJs = path.join(repo, 'js');
const load = async (jsDir) => ({
  entities: await import(pathToFileURL(path.join(jsDir, 'Entities.js')).href),
  config: await import(pathToFileURL(path.join(jsDir, 'Config.js')).href),
});
const oldSide = await load(oldJs);
const newSide = await load(newJs);

// ---- state ----
const save = JSON.parse(fs.readFileSync(path.join(here, '..', 'fixtures', fixture), 'utf8'));
const makeState = () => ({
  meta: JSON.parse(JSON.stringify(save.meta)),
  level: JSON.parse(JSON.stringify(save.level)),
  camera: { x: 0, y: 0, zoom: 1600 / 1792, viewWidth: 1792, viewHeight: 950 / (1600 / 1792) },
  ui: {},
  debug: {},
});

// ---- deterministic randomness and clock (per side) ----
const rngFor = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const sides = [
  { name: 'OLD', mod: oldSide, state: makeState(), rng: rngFor(1234), clock: 1e6, ms: 0 },
  { name: 'NEW', mod: newSide, state: makeState(), rng: rngFor(1234), clock: 1e6, ms: 0 },
];
// --magnets N: add N Buffer Fish with their magnet ON (pulling waste, coins and food) through the game's own spawn
// function, so the Magnet Fish force path is exercised (the stress save has none).
const magnets = parseInt(opt('--magnets') || '0', 10);
for (const side of sides) {
  Math.random = rngFor(77);
  for (let i = 0; i < magnets; i++) {
    side.mod.entities.spawnFishCheat(side.state, 'buffer_fish', 500 + i * 380, 380, true);
    const fish = side.state.level.entities[side.state.level.entities.length - 1];
    fish.magnetOn = true;
    fish.magnetFilterItems = ['waste', 'coin', 'food'];
  }
}
const dt = oldSide.config.SIM_DT_MS;
const realNow = performance.now.bind(performance);
const step = (side) => {
  Math.random = side.rng;
  const fake = side.clock;
  performance.now = () => fake;
  Date.now = () => Math.floor(fake);
  const t0 = process.hrtime.bigint();
  side.mod.entities.updateEntities(side.state, dt);
  side.ms += Number(process.hrtime.bigint() - t0) / 1e6;
  side.clock += dt;
  state_elapsed(side);
};
// The game's own update() advances the level clock right after updateEntities; do the same (both sides identically).
const state_elapsed = (side) => { side.state.level.elapsed += dt; };

const first = (a, b, p = '') => {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${p}: array vs object`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const d = first(a[k], b[k], p + '.' + k); if (d) return d; }
  return null;
};

// --solo: only the current code, no comparison (for CPU profiling: node --cpu-prof tools/bench/sim/lockstep.mjs --solo)
if (flag('--solo')) {
  for (let t = 0; t < ticks; t++) step(sides[1]);
  console.log(`solo: ${ticks} steps, ${(sides[1].ms / ticks).toFixed(3)} ms per step; ${sides[1].state.level.items.length} items`);
  process.exit(0);
}
let diverged = null;
for (let t = 0; t < ticks && !diverged; t++) {
  // alternate who goes first so timing noise is symmetric
  if (t % 2 === 0) { step(sides[0]); step(sides[1]); } else { step(sides[1]); step(sides[0]); }
  const a = JSON.stringify(sides[0].state.level), b = JSON.stringify(sides[1].state.level);
  if (a !== b) diverged = { tick: t, where: first(JSON.parse(a), JSON.parse(b), 'level') };
}
Math.random = Math.random; performance.now = realNow;

const lv = sides[1].state.level;
const before = save.level;
const activity = `money ${Math.round(before.money)} -> ${Math.round(lv.money)}, science ${before.science} -> ${lv.science}, items ${before.items.length} -> ${lv.items.length}, lifetime money earned ${Math.round(before.lifetimeMoneyEarned || 0)} -> ${Math.round(lv.lifetimeMoneyEarned || 0)}`;
if (diverged) {
  console.log(`DIVERGED at tick ${diverged.tick}: ${diverged.where}`);
  process.exitCode = 1;
} else {
  console.log(`IDENTICAL: ${ticks} steps from ${fixture}; ${lv.items.length} items, ${lv.entities.length} entities, ${Object.keys(lv.buildingData).length} buildings at the end (money ${Math.round(lv.money)}).`);
  console.log('activity: ' + activity);
}
if (flag('--time') || flag('--self')) console.log(`ms per step: OLD ${(sides[0].ms / ticks).toFixed(3)}   NEW ${(sides[1].ms / ticks).toFixed(3)}   (${((sides[1].ms / sides[0].ms - 1) * 100).toFixed(1)}%)`);
