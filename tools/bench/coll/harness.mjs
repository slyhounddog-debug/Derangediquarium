// Offline A/B harness for Grid.js's resolveItemCollisions. Extracts the REAL source text from Grid.js as the reference,
// runs candidate rewrites in lockstep from identical items, and requires bit-exact equality of every item field.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..').split(path.sep).join('/');
const C = await import(pathToFileURL(PROJECT + '/js/Config.js').href);
const gridSrc = fs.readFileSync(process.env.REF_GRID || (PROJECT + '/js/Grid.js'), 'utf8');

const FLOOR_Y = 1100, WORLD_W = C.WORLD_TILES_W * C.TILE_SIZE;
const WALL = '__boundary_wall__';
// stub tile world: boundary walls, a seabed floor, and a platform ledge so piles form on both
function tileAt(grid, x, y) {
  if (x < 0 || x >= WORLD_W || y < 0) return WALL;
  if (y >= FLOOR_Y) return 'solid';
  if (x >= 400 && x < 640 && y >= 900 && y < 932) return 'solid';
  return 'empty';
}
const isSolidForItem = (state, tile) => tile === 'solid' || tile === WALL;
const colAt = (x) => Math.floor(x / C.TILE_SIZE);
const rowAt = (y) => Math.floor(y / C.TILE_SIZE);

const DEPS = ['ITEM_COLLISION_ITERATIONS', 'ITEM_MIN_HORIZONTAL_PUSH_FRACTION', 'ITEM_PUSH_IMPULSE_SPEED', 'ITEM_MAX_PUSH_PER_STEP', 'ITEM_PUSH_IMPULSE_MIN_OVERLAP', 'ITEM_ON_ITEM_LANDING_VY_CAP', 'WORLD_TILES_W', 'WORLD_TILES_H', 'TILE_SIZE'];
function build(src) {
  const fn = new Function(...DEPS, 'tileAt', 'isSolidForItem', 'colAt', 'rowAt', 'SLEEP_NEIGHBOR_RANGE_PX', src.replace(/\bexport function/g, 'function') + '\nreturn resolveItemCollisions;');
  return fn(...DEPS.map((k) => C[k]), tileAt, isSolidForItem, colAt, rowAt, 3);
}
const a0 = gridSrc.indexOf('function applyItemPush(');
const a1 = gridSrc.indexOf('// ---- Rendering ----');
export const REFERENCE_SRC = gridSrc.slice(a0, a1);
export const buildFn = build;
export const reference = build(REFERENCE_SRC);

// deterministic RNG
export function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const TYPES = [['coin', 12.1, 2.1], ['waste', 8.8, 1.2], ['food', 7.26, 0.3], ['alien_dna', 10, 4]];
function mk(id, type, x, y) { const t = TYPES.find((q) => q[0] === type); return { id, type, x, y, vx: 0, vy: 0, radius: t[1], mass: t[2], resting: false, touching: false, sleeping: false, restTicks: 0 }; }

// Scenarios: how to seed the initial items and whether to keep dropping more
export const SCENARIOS = {
  uniform1000: (r) => Array.from({ length: 1000 }, (_, i) => mk(i + 1, TYPES[Math.floor(r() * 4)][0], 80 + r() * 1630, 40 + r() * 800)),
  pile600: (r) => Array.from({ length: 600 }, (_, i) => mk(i + 1, TYPES[Math.floor(r() * 4)][0], 700 + r() * 220, 300 + r() * 700)),
  overlap800: (r) => Array.from({ length: 800 }, (_, i) => mk(i + 1, TYPES[Math.floor(r() * 4)][0], 900 + r() * 40, 900 + r() * 40)), // absurdly overcrowded, heavy initial overlap
  ledge400: (r) => Array.from({ length: 400 }, (_, i) => mk(i + 1, TYPES[Math.floor(r() * 4)][0], 380 + r() * 280, 500 + r() * 400)),
};

// Minimal per-tick integration so piles actually form and jitter the way the real game's would
function integrate(items, state) {
  for (const it of items) {
    it.vy = Math.min(it.vy + 0.6, 14);
    it.vx = (it.vx || 0) * 0.92;
    let nx = it.x + it.vx, ny = it.y + it.vy;
    if (tileAt(null, nx, ny + it.radius) !== 'empty') { if (tileAt(null, nx, ny + it.radius) === 'solid') { ny = Math.floor((ny + it.radius) / 4) * 4 - it.radius; it.vy = 0; } }
    if (nx < it.radius) nx = it.radius; if (nx > WORLD_W - it.radius) nx = WORLD_W - it.radius;
    it.x = nx; it.y = ny;
  }
}
const FIELDS = ['x', 'y', 'vx', 'vy', 'touching', 'sleeping', 'restTicks'];
export function runLockstep(candidateFn, scenarioName, ticks, iterationsList = [4, 2], ignore = new Set()) {
  const make = SCENARIOS[scenarioName];
  const SEED = Number(process.env.SEED || 7); const itemsRef = make(rng(SEED)), itemsCand = make(rng(SEED));
  const sRef = { level: { items: itemsRef } }, sCand = { level: { items: itemsCand } };
  const extraRng = rng(99);
  for (let t = 0; t < ticks; t++) {
    const iters = iterationsList[t % iterationsList.length];
    if (t % 5 === 0 && t < ticks / 2) { // keep dropping a few new ones on top, like fish output does
      for (let k = 0; k < 4; k++) { const type = TYPES[Math.floor(extraRng() * 4)][0], x = 500 + extraRng() * 700, id = 100000 + t * 10 + k; itemsRef.push(mk(id, type, x, 60)); itemsCand.push(mk(id, type, x, 60)); }
    }
    integrate(itemsRef, sRef); integrate(itemsCand, sCand);
    reference(sRef, iters); candidateFn(sCand, iters);
    for (let i = 0; i < itemsRef.length; i++) if (!ignore.has(i)) for (const f of FIELDS) if (!Object.is(itemsRef[i][f], itemsCand[i][f])) return { ok: false, tick: t, item: i, field: f, ref: itemsRef[i][f], cand: itemsCand[i][f] };
  }
  return { ok: true, n: itemsRef.length };
}

export function timeIt(fn, scenarioName, warmTicks = 120, measureTicks = 200, iters = 2) {
  const items = SCENARIOS[scenarioName](rng(7)); const state = { level: { items } };
  for (let t = 0; t < warmTicks; t++) { integrate(items, state); fn(state, iters); }
  const t0 = process.hrtime.bigint();
  for (let t = 0; t < measureTicks; t++) { integrate(items, state); fn(state, iters); }
  const total = Number(process.hrtime.bigint() - t0) / 1e6;
  // subtract integrate cost
  const items2 = SCENARIOS[scenarioName](rng(7)); const st2 = { level: { items: items2 } };
  for (let t = 0; t < warmTicks; t++) { integrate(items2, st2); fn(st2, iters); }
  const u0 = process.hrtime.bigint(); for (let t = 0; t < measureTicks; t++) integrate(items2, st2); const integ = Number(process.hrtime.bigint() - u0) / 1e6;
  return (total - integ) / measureTicks;
}
