// node tools/bench/mklooks.cjs -> fixtures/looks.json: the stress save with every fish look the sprite cache has to handle
// (all star tiers, hungry/critical tint, baby/mid stages, dying fish, an equipped hat).
const fs = require('fs'); const path = require('path');
const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stress.json'), 'utf8'));
const fish = s.level.entities.filter((e) => e.type === 'fish');
fish.forEach((f, i) => {
  f.starTier = 1 + (i % 4);
  if (i % 3 === 1) f.hunger = 60; else if (i % 3 === 2) f.hunger = 95;
  if (i % 7 === 3) f.stage = 0; else if (i % 7 === 5) f.stage = 1;
  if (i === 8 || i === 17) { f.dying = true; f.deathElapsedMs = 2800; f.deathFacing = i === 8 ? 1 : -1; }
});
s.meta.equippedHatId = process.argv[2] || 'witch_hat';
fs.writeFileSync(path.join(__dirname, 'fixtures', 'looks.json'), JSON.stringify(s));
console.log('looks.json written;', fish.length, 'fish, hat', s.meta.equippedHatId);
