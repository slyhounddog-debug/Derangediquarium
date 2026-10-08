// node tools/bench/sim/mkbuildings.mjs -> fixtures/buildings.json
// The stress save plus a handful of items of every kind placed RIGHT AGAINST every building, so collector / turret / refinery /
// manufacturer / power-plant intake, processing and uptime paths all fire within the first seconds of a lockstep run
// (the plain stress save drops items from the water column and nothing reaches the buildings for a long time).
import './nodestubs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const E = await import(pathToFileURL(path.join(here, '../../../js/Entities.js')).href);
const save = JSON.parse(fs.readFileSync(path.join(here, '../fixtures/stress.json'), 'utf8'));
let seed = 99;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rnd;

const makers = [
  (x, y) => E.createCoin(x, y, 1 + Math.floor(rnd() * 12)),
  (x, y) => E.createCoin(x, y, 150),
  (x, y) => E.createScience(x, y),
  (x, y) => E.createScienceGreen(x, y),
  (x, y) => E.createWaste(x, y),
  (x, y) => E.createFood(x, y),
  (x, y) => E.createBiomass(x, y),
  (x, y) => E.createAlienDna(x, y),
  (x, y) => E.createMutagenPaste(x, y),
];
const T = 32;
let id = 20000;
const added = [];
for (const key of Object.keys(save.level.buildingData)) {
  const [row, col] = key.split(',').map(Number);
  const cx = col * T + T / 2, cy = row * T + T / 2;
  const spots = [[0, -T / 2 - 6], [-T / 2 - 6, 0], [T / 2 + 6, 0], [4, -T / 2 - 2], [-4, -T / 2 - 14], [0, T / 2 + 8]];
  spots.forEach(([dx, dy], i) => {
    const item = makers[(i + row + col) % makers.length](cx + dx, cy + dy);
    item.id = id++;
    added.push(item);
  });
}
// low ammo so the turrets' own intake has work to do
for (const data of Object.values(save.level.buildingData)) if ('ammoWaste' in data) { data.ammoWaste = 0; data.ammoBiomass = 0; }
save.level.items.push(...added);
fs.writeFileSync(path.join(here, '../fixtures/buildings.json'), JSON.stringify(save));
console.log(`buildings.json written: +${added.length} items around ${Object.keys(save.level.buildingData).length} buildings (${save.level.items.length} items total)`);
