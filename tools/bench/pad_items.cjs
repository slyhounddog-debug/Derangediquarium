// Pads the cheat-built save up to ~1000 items by cloning the game's own items at random water-column positions.
const fs = require('fs');
const s = JSON.parse(fs.readFileSync(__dirname + '/fixtures/stress_raw.json', 'utf8'));
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const tpl = {}; for (const it of s.level.items) (tpl[it.type] ||= []).push(it);
const mix = [['coin', 0.40], ['waste', 0.45], ['food', 0.08], ['alien_dna', 0.07]].filter(([t]) => tpl[t]);
let id = 2000; const out = [...s.level.items];
while (out.length < 1000) {
  let r = rnd(), t = mix[mix.length - 1][0]; for (const [k, p] of mix) { if (r < p) { t = k; break; } r -= p; }
  const base = tpl[t][Math.floor(rnd() * tpl[t].length)];
  const c = JSON.parse(JSON.stringify(base));
  c.id = id++; c.x = 80 + rnd() * 1630; c.y = 40 + rnd() * 680; c.vx = 0; c.vy = 0;
  for (const k of ['rollPrevX', 'stepX', 'sleepX', 'stationaryOriginX', 'spinStationaryOriginX']) if (k in c) c[k] = c.x;
  for (const k of ['stepY', 'sleepY', 'stationaryOriginY', 'spinStationaryOriginY']) if (k in c) c[k] = c.y;
  if ('resting' in c) c.resting = false; if ('sleeping' in c) c.sleeping = false; if ('touching' in c) c.touching = false; if ('restTicks' in c) c.restTicks = 0;
  out.push(c);
}
s.level.items = out;
fs.writeFileSync(__dirname + '/fixtures/stress.json', JSON.stringify(s));
const kinds = {}; for (const it of out) kinds[it.type] = (kinds[it.type] || 0) + 1;
console.log('items', out.length, kinds, 'fish', s.level.entities.filter((e) => e.type === 'fish').length, 'buildings', Object.keys(s.level.buildingData).length);
