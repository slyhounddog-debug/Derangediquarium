// node tools/bench/sim/calmcheck.mjs [ticks=2400] -> in the CURRENT game, how still is a settling carpet of 1000 items? (per-tick movement histogram)
import './nodestubs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { extractOldJs } from './oldtree.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const total = parseInt(process.argv[2] || '2400', 10);
const js = extractOldJs();
const E = await import(pathToFileURL(path.join(js, 'Entities.js')).href);
const C = await import(pathToFileURL(path.join(js, 'Config.js')).href);
const save = JSON.parse(fs.readFileSync(path.join(here, '../fixtures/stress.json'), 'utf8'));
for (const row of save.level.grid) row.fill('empty'); save.level.buildingData = {}; save.level.entities = [];
let seed = 31; const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const proto = save.level.items.filter((i) => i.type === 'coin' || i.type === 'waste');
save.level.items = Array.from({ length: 1000 }, (_, i) => { const t = JSON.parse(JSON.stringify(proto[i % proto.length])); t.id = 1000 + i; t.x = 120 + r() * 1550; t.y = 650 + r() * 450; t.vx = t.vy = 0; t.sleeping = false; t.restTicks = 0; return t; });
const state = { meta: save.meta, level: save.level, camera: { x: 0, y: 0, zoom: 0.8929, viewWidth: 1792, viewHeight: 1064 }, ui: {}, debug: {} };
let s = 555; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
let clock = 1e6; performance.now = () => clock; Date.now = () => Math.floor(clock);
let prev = new Map(state.level.items.map((i) => [i.id, [i.x, i.y]]));
console.log('tick   items  moving>0.02px  >0.1px  >0.5px   mean-move   max-y(lowest)   asleep(existing sleep system)');
for (let t = 1; t <= total; t++) {
  E.updateEntities(state, C.SIM_DT_MS); clock += C.SIM_DT_MS; state.level.elapsed += C.SIM_DT_MS;
  if (t % 200 === 0) {
    let a = 0, b = 0, c = 0, sum = 0, n = 0, sl = 0, maxy = 0;
    const cur = new Map();
    for (const it of state.level.items) { const p = prev.get(it.id); cur.set(it.id, [it.x, it.y]); if (it.sleeping) sl++; if (it.y > maxy) maxy = it.y; if (!p) continue; const d = Math.hypot(it.x - p[0], it.y - p[1]); n++; sum += d; if (d > 0.02) a++; if (d > 0.1) b++; if (d > 0.5) c++; }
    console.log(String(t).padStart(5), String(n).padStart(6), String(a).padStart(10), String(b).padStart(9), String(c).padStart(8), (sum / n).toFixed(4).padStart(11), maxy.toFixed(0).padStart(12), String(sl).padStart(12));
  }
  if (t % 200 === 199) prev = new Map(state.level.items.map((i) => [i.id, [i.x, i.y]]));
}
