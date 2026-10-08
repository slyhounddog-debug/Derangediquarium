// PROTOTYPE experiment: does "pile sleeping" (see proto/mkproto.mjs) behave like the current game, and how much does it save?
//
//   node tools/bench/sim/pile.mjs [scenario ...] [--settle N] [--after N] [--sleep-after N] [--refresh N]
//
// For each scenario the CURRENT committed code (OLD) and the patched prototype (PROTO) run the real updateEntities() from the same save with
// identical seeded randomness, first for `settle` ticks (piles form), then an event is applied identically to both and they run `after` more
// ticks. Reports, at checkpoints: ms per step (both), how many items are asleep in PROTO, and how far each item has drifted from where OLD has
// it (max / p95 / mean, and how many are further than 1px / 3px / 10px apart), plus items that sit clearly higher than in OLD (= "floating").
// Scenarios: settle, poke, remove-base, remove-building, fan-on, giant, giant-poke
import './nodestubs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractOldJs, repo } from './oldtree.mjs';
import { makeProtoJs } from './proto/mkproto.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d, float) => { const i = args.indexOf(n); return i >= 0 ? (float ? parseFloat(args[i + 1]) : parseInt(args[i + 1], 10)) : d; };
const named = args.filter((a, i) => !a.startsWith('--') && !/^--/.test(args[i - 1] || ''));
const ALL = ['settle', 'poke', 'remove-base', 'remove-building', 'fan-on', 'giant', 'giant-poke'];
const scenarios = named.length ? named : ALL;
const SETTLE = opt('--settle', 1500);
const AFTER = opt('--after', 600);

const oldJs = extractOldJs();
const protoJs = makeProtoJs({ sleepAfter: opt('--sleep-after', 30), refreshSteps: opt('--refresh', 20), calmEps: opt('--calm-eps', 0.02, true), cheapRemoval: args.includes('--cheap-removal') });
const load = async (js) => ({ E: await import(pathToFileURL(path.join(js, 'Entities.js')).href), G: await import(pathToFileURL(path.join(js, 'Grid.js')).href), C: await import(pathToFileURL(path.join(js, 'Config.js')).href) });
const OLD = await load(oldJs);
const PROTO = await load(protoJs);
const dt = OLD.C.SIM_DT_MS;

const rngFor = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const baseSave = JSON.parse(fs.readFileSync(path.join(here, '../fixtures/stress.json'), 'utf8'));

function makeSide(name, mod, save) {
  return {
    name, mod, ms: [], clock: 1e6, rng: rngFor(555),
    state: { meta: JSON.parse(JSON.stringify(save.meta)), level: JSON.parse(JSON.stringify(save.level)), camera: { x: 0, y: 0, zoom: 1600 / 1792, viewWidth: 1792, viewHeight: 950 / (1600 / 1792) }, ui: {}, debug: {} },
  };
}
function step(side) {
  Math.random = side.rng;
  const t = side.clock;
  performance.now = () => t; Date.now = () => Math.floor(t);
  const t0 = process.hrtime.bigint();
  side.mod.E.updateEntities(side.state, dt);
  side.ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  side.clock += dt;
  side.state.level.elapsed += dt;
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

function compare(a, b) {
  const byId = new Map(a.state.level.items.map((it) => [it.id, it]));
  const d = [];
  let higher = 0, missing = 0;
  for (const it of b.state.level.items) {
    const o = byId.get(it.id);
    if (!o) { missing++; continue; }
    d.push(Math.hypot(it.x - o.x, it.y - o.y));
    if (it.y < o.y - 3) higher++; // clearly higher on screen than the same item in the real game
  }
  d.sort((x, y) => x - y);
  const p = (q) => d[Math.min(d.length - 1, Math.floor(d.length * q))] ?? 0;
  const only = a.state.level.items.length - (d.length);
  return { n: d.length, max: d[d.length - 1] ?? 0, p95: p(0.95), mean: mean(d), over1: d.filter((x) => x > 1).length, over3: d.filter((x) => x > 3).length, over10: d.filter((x) => x > 10).length, higher, itemCountDiff: b.state.level.items.length - a.state.level.items.length, missing, only };
}

// the item with the most neighbours, i.e. the middle of the densest pile
function densest(items) {
  let best = null, bestN = -1;
  for (const it of items) {
    if (it.y < 600) continue;
    let n = 0;
    for (const o of items) { const dx = o.x - it.x, dy = o.y - it.y; if (dx * dx + dy * dy < 60 * 60) n++; }
    if (n > bestN) { bestN = n; best = it; }
  }
  return best;
}

const events = {
  settle: () => {},
  poke(sides) { // drop coins from above onto the densest pile
    for (const s of sides) { const c = densest(s.state.level.items); const k = [[-14, -140], [0, -190], [16, -240], [-6, -290], [8, -340]]; k.forEach(([dx, dy], i) => { const coin = s.mod.E.createCoin(c.x + dx, c.y + dy, 5); coin.id = 900000 + i; s.state.level.items.push(coin); }); }
  },
  'remove-base'(sides) { // consume the lowest items of the densest pile (what a collector/turret/fish eating from the bottom does)
    for (const s of sides) { const c = densest(s.state.level.items); const near = s.state.level.items.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < 70).sort((x, y) => y.y - x.y).slice(0, 4); for (const o of near) s.state.level.items.splice(s.state.level.items.indexOf(o), 1); }
  },
  'remove-building'(sides) { // demolish the platform tile with the most items on top of it
    for (const s of sides) {
      const lv = s.state.level; let best = null, bestN = -1;
      for (const key of Object.keys(lv.buildingData)) {
        if (!lv.buildingData[key].type.startsWith('platform')) continue;
        const [row, col] = key.split(',').map(Number); const cx = col * 32 + 16, cy = row * 32 + 16;
        const n = lv.items.filter((o) => Math.abs(o.x - cx) < 40 && o.y < cy && o.y > cy - 60).length;
        if (n > bestN) { bestN = n; best = [row, col, key]; }
      }
      if (best) { lv.grid[best[0]][best[1]] = 'empty'; delete lv.buildingData[best[2]]; }
    }
  },
  'fan-on'(sides) { // a strong fan switched on under the densest pile
    for (const s of sides) { const c = densest(s.state.level.items); const col = Math.floor(c.x / 32), row = Math.min(36, Math.floor(c.y / 32) + 2); s.state.level.grid[row][col] = 'fan_t4'; s.state.level.buildingData[`${row},${col}`] = { type: 'fan_t4', angle: -Math.PI / 2, filterItems: [] }; }
  },
};
events['giant-poke'] = events.poke;
events.giant = () => {};

function giantSave() { // no buildings, no fish: 1000 coins/waste raining over the whole floor so they carpet it
  const save = JSON.parse(JSON.stringify(baseSave));
  for (const row of save.level.grid) row.fill('empty');
  save.level.buildingData = {}; save.level.entities = [];
  let seed = 31; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const proto = save.level.items.filter((i) => i.type === 'coin' || i.type === 'waste');
  save.level.items = Array.from({ length: 1000 }, (_, i) => { const t = JSON.parse(JSON.stringify(proto[i % proto.length])); t.id = 1000 + i; t.x = 120 + r() * 1550; t.y = 650 + r() * 450; t.vx = t.vy = 0; t.resting = false; t.sleeping = false; t.restTicks = 0; t.touching = false; for (const k of ['stepX', 'sleepX', 'rollPrevX']) if (k in t) t[k] = t.x; for (const k of ['stepY', 'sleepY']) if (k in t) t[k] = t.y; return t; });
  return save;
}

const fmt = (c) => `max ${c.max.toFixed(2)}px  p95 ${c.p95.toFixed(2)}  mean ${c.mean.toFixed(3)}  | >1px: ${c.over1}  >3px: ${c.over3}  >10px: ${c.over10}  | higher-than-real(>3px): ${c.higher}${c.itemCountDiff ? '  ITEM COUNT DIFF ' + c.itemCountDiff : ''}`;

for (const name of scenarios) {
  const save = name.startsWith('giant') ? giantSave() : baseSave;
  const A = makeSide('OLD', OLD, save), B = makeSide('PROTO', PROTO, save);
  console.log(`\n=== ${name}  (${save.level.items.length} items; settle ${SETTLE} ticks${name === 'settle' ? '' : ', then event, then ' + AFTER + ' ticks'})`);
  const report = (label, from) => {
    const a = A.ms.slice(from), b = B.ms.slice(from);
    const c = compare(A, B);
    console.log(`${label.padEnd(16)} ms/step OLD ${mean(a).toFixed(2)}  PROTO ${mean(b).toFixed(2)} (${((mean(b) / mean(a) - 1) * 100).toFixed(0)}%) | asleep ${PROTO.G.getPileSleeperCount()}/${B.state.level.items.length} | ${fmt(c)}`);
  };
  const total = name === 'settle' ? SETTLE + AFTER : SETTLE + AFTER;
  let mark = 0;
  for (let t = 0; t < total; t++) {
    if (t === SETTLE && name !== 'settle') { events[name]([A, B]); mark = A.ms.length; }
    if (t % 2 === 0) { step(A); step(B); } else { step(B); step(A); }
    if (name === 'settle' ? (t + 1) % 300 === 0 : (t + 1 === SETTLE || t + 1 === SETTLE + 30 || t + 1 === SETTLE + 150 || t + 1 === total)) {
      report(`tick ${t + 1}`, name === 'settle' ? Math.max(0, t - 299) : (t + 1 <= SETTLE ? Math.max(0, t - 299) : mark));
    }
  }
}
