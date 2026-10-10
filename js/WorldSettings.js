// WorldSettings.js — per-run "world settings": the Easy / Normal / Challenge presets and the individual
// sliders behind the New Game dialog's World Settings button (see WorldSettingsUI.js and CLAUDE.md's
// "World Settings" section).
//
// A world is defined by a map { ruleId: number }. Anything not in the map is at its default, and a world with
// no non-default values is "Normal" — unmodified, so it can earn achievements. Each rule below knows how to
// push its number into the game's data: either by patching numbers in the Config.js tables in place (every
// patched number's original is remembered the first time this module loads, before anything has been
// changed, so applying a new world always starts from the real defaults) or, for the handful of plain
// constants, through Config.js's setWorldScalar (those are `export let`, so every importing module sees the
// new value live).
//
// The map is stored in state.meta.worldSettings (a save is one world — see Save.js), and applyWorldSettings()
// is called whenever a run starts, a save is loaded, or the settings are changed. Per direct request the
// limits are deliberately extreme but kept inside what the game can actually run: nothing here can make a
// number NaN, zero where the game divides by it, or large enough to freeze the simulation.

import {
  SPECIES, BUILDING_TYPES, ALIEN_ARCHETYPES, SCIENCE_LAB_UPGRADES, MOUND_CRACK_COST,
  FOOD_HUNGER_RELIEF_BY_LEVEL, FOOD_QUALITY_UPGRADE_COSTS, FISH_MOVEMENT_UPGRADE_COSTS, TANK_EXPANSION_UPGRADE_COSTS,
  TURRET_STATS, PROCESSOR_STATS, REFINERY_STATS, MANUFACTURER_ITEM_PROCESS_MS, MANUFACTURER_ITEM_POWER_COST_MW, POWER_PLANT_RECIPES,
  setWorldScalar, worldScalarDefault, recomputeWorldDerived,
} from './Config.js';

// ---- numeric targets inside the Config.js tables ----
// Every numeric leaf under `root` whose key passes `keyTest` (and whose containing row passes `rowTest`), with
// its original value remembered so the rule can always be re-applied from the default.
function collect(root, keyTest, rowTest) {
  const out = [];
  const walk = (node, row) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => { if (typeof v === 'number') { if (keyTest(i, node)) out.push({ parent: node, key: i, base: v }); } else if (v && typeof v === 'object') walk(v, row); });
    } else if (node && typeof node === 'object') {
      const here = (node.id !== undefined || node.name !== undefined) ? node : row;
      if (rowTest && !rowTest(here, node)) return;
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === 'number') { if (keyTest(k, node)) out.push({ parent: node, key: k, base: v }); } else if (v && typeof v === 'object') walk(v, here);
      }
    }
  };
  walk(root, null);
  return out;
}
const keys = (...names) => (k) => names.includes(k);
const anyKey = () => true;

const T = {
  speciesCost: collect(SPECIES, keys('cost')),
  speciesHunger: collect(SPECIES, keys('hungerRate')),
  speciesCoinValue: collect(SPECIES, keys('dropValue')),
  // dropInterval is also a Science brew / eat-cooldown timer on some species; scaling those with the "coin
  // speed" rule is the right behaviour — it is every species' production cycle
  speciesCoinInterval: collect(SPECIES, keys('dropInterval')),
  speciesPixelsPerMW: collect(SPECIES, keys('pixelsPerMW')),
  buildingCost: collect(BUILDING_TYPES, keys('cost'), (row) => !(row && typeof row.id === 'string' && row.id.startsWith('platform'))),
  labCosts: collect(SCIENCE_LAB_UPGRADES, keys('scienceCost', 'scienceGreenCost', 'goldCost')),
  moundCracks: collect(MOUND_CRACK_COST, anyKey),
  foodRelief: collect(FOOD_HUNGER_RELIEF_BY_LEVEL, anyKey),
  tankUpgradeCosts: [...collect(FOOD_QUALITY_UPGRADE_COSTS, anyKey), ...collect(FISH_MOVEMENT_UPGRADE_COSTS, anyKey), ...collect(TANK_EXPANSION_UPGRADE_COSTS, anyKey)],
  alienHp: collect(ALIEN_ARCHETYPES, keys('hpMin', 'hpMax')),
  alienDamage: collect(ALIEN_ARCHETYPES, keys('fishDamagePerSec')),
  alienSpeed: collect(ALIEN_ARCHETYPES, keys('speed')),
  turretDamage: collect(TURRET_STATS, keys('damage')),
  turretRate: collect(TURRET_STATS, keys('shotsPerSec')),
  buildingTimes: [...collect(PROCESSOR_STATS, keys('coinMs', 'scienceMs', 'scienceGreenMs')), ...collect(REFINERY_STATS, keys('foodProcessMs')), ...collect(MANUFACTURER_ITEM_PROCESS_MS, anyKey)],
  powerUse: [...collect(PROCESSOR_STATS, keys('powerCostPerSecCoin', 'powerCostPerSecScience')), ...collect(REFINERY_STATS, keys('powerCostPerSec')), ...collect(MANUFACTURER_ITEM_POWER_COST_MW, anyKey), ...collect(TURRET_STATS, keys('powerCostPerShot'))],
  powerOutput: collect(POWER_PLANT_RECIPES, keys('powerOutputMw')),
};

function mul(targets, v, round) {
  for (const t of targets) {
    let x = t.base * v;
    if (round === 'int') x = t.base > 0 ? Math.max(1, Math.round(x)) : 0; // a price/cost never rounds a real cost down to nothing
    else if (round === 'round') x = Math.round(x);
    t.parent[t.key] = x;
  }
}
function div(targets, v, round) {
  for (const t of targets) {
    const x = t.base / v;
    t.parent[t.key] = round ? Math.max(1, Math.round(x)) : x;
  }
}
const sd = worldScalarDefault;
function scalarMul(name, v, round) {
  const x = sd(name) * v;
  setWorldScalar(name, round === 'int' ? Math.max(1, Math.round(x)) : round === 'round' ? Math.round(x) : x);
}

// ---- the rules ----
// kind 'mult': a multiplier, default 1 (shown as ×1.5). kind 'abs': an absolute number in its own unit.
// `scalars` lists the Config scalars a rule touches so the restore step can put them back.
const MULT = { min: 0.1, max: 10, step: 0.05 };
export const WORLD_GROUPS = [
  { id: 'economy', label: 'Money & prices' },
  { id: 'fish', label: 'Fish' },
  { id: 'aliens', label: 'Aliens' },
  { id: 'base', label: 'Defence & buildings' },
  { id: 'progress', label: 'Progression' },
];

export const WORLD_RULES = [
  // ---- economy ----
  { id: 'startMoney', group: 'economy', label: 'Starting money', desc: 'Gold you begin the run with.', kind: 'abs', def: 100, min: 20, max: 10000, step: 10, unit: '$', scalars: ['STARTING_MONEY'], apply: (v) => setWorldScalar('STARTING_MONEY', Math.round(v)) },
  { id: 'fishPrice', group: 'economy', label: 'Fish prices', desc: 'What every fish costs in the Shop.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.speciesCost, v, 'int') },
  { id: 'fishPriceGrowth', group: 'economy', label: 'Fish price rise per fish owned', desc: 'Each fish of a kind you own makes the next one cost this many times more (1.00 = never rises).', kind: 'abs', def: 1.3, min: 1, max: 3, step: 0.01, unit: '×', scalars: ['ECONOMY_FISH_COST_GROWTH_RATE', 'FISH_SCALING_COST_GROWTH_RATE'],
    apply: (v) => { setWorldScalar('ECONOMY_FISH_COST_GROWTH_RATE', v); setWorldScalar('FISH_SCALING_COST_GROWTH_RATE', 1 + (v - 1) * (sd('FISH_SCALING_COST_GROWTH_RATE') - 1) / (sd('ECONOMY_FISH_COST_GROWTH_RATE') - 1)); } },
  { id: 'buildingPrice', group: 'economy', label: 'Building prices', desc: 'What buildings cost (Platforms stay a flat price).', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.buildingCost, v, 'int') },
  { id: 'buildingPriceGrowth', group: 'economy', label: 'Building price rise per copy', desc: 'How quickly each extra copy of a building gets pricier. 0 = every copy costs the same.', kind: 'mult', def: 1, min: 0, max: 5, step: 0.1, scalars: ['BUILDING_COST_GROWTH_RATE_TIER1', 'BUILDING_COST_GROWTH_RATE_TIER2', 'BUILDING_COST_GROWTH_RATE_TIER3'],
    apply: (v) => { for (const n of ['BUILDING_COST_GROWTH_RATE_TIER1', 'BUILDING_COST_GROWTH_RATE_TIER2', 'BUILDING_COST_GROWTH_RATE_TIER3']) setWorldScalar(n, 1 + (sd(n) - 1) * v); } },
  { id: 'foodPrice', group: 'economy', label: 'Food price', desc: 'Gold per Food pellet.', kind: 'abs', def: 3, min: 1, max: 30, step: 1, unit: '$', scalars: ['FOOD_COST'], apply: (v) => setWorldScalar('FOOD_COST', Math.round(v)) },
  { id: 'coinValue', group: 'economy', label: 'Coin value', desc: 'How much gold every coin your fish drop is worth.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.speciesCoinValue, v) },
  { id: 'coinSpeed', group: 'economy', label: 'Coin production speed', desc: 'How fast fish (and Octopuses and Eels) finish a production cycle.', kind: 'mult', def: 1, min: 0.25, max: 5, step: 0.05, apply: (v) => div(T.speciesCoinInterval, v, true) },
  { id: 'sellRefund', group: 'economy', label: 'Sell refund', desc: 'Fraction of a building’s price you get back when you delete it.', kind: 'abs', def: 1, min: 0, max: 1, step: 0.05, unit: '', scalars: ['TILE_REFUND_FRACTION'], apply: (v) => setWorldScalar('TILE_REFUND_FRACTION', v) },
  { id: 'mergeBonus', group: 'economy', label: 'Merged-fish coin bonus', desc: 'Each merge tier multiplies a fish’s coin value by this (1 = merging gives no bonus).', kind: 'abs', def: 2, min: 1, max: 4, step: 0.1, unit: '×', scalars: ['FISH_STAR_TIER_VALUE_MULTIPLIER'], apply: (v) => setWorldScalar('FISH_STAR_TIER_VALUE_MULTIPLIER', v) },
  { id: 'dirtyPenalty', group: 'economy', label: 'Coin value in a filthy tank', desc: 'What coins are worth when the tank is 0% clean (100% clean is always full value). Lower = a dirty tank hurts more.', kind: 'abs', def: 0.5, min: 0.05, max: 1, step: 0.05, unit: '×', scalars: ['CLEANLINESS_MIN_MONEY_FRACTION'], apply: (v) => setWorldScalar('CLEANLINESS_MIN_MONEY_FRACTION', v) },
  // ---- fish ----
  { id: 'hunger', group: 'fish', label: 'Hunger speed', desc: 'How fast fish get hungry. Lower is gentler, higher means constant feeding.', kind: 'mult', def: 1, min: 0.1, max: 5, step: 0.05, apply: (v) => mul(T.speciesHunger, v) },
  { id: 'foodStrength', group: 'fish', label: 'Food filling power', desc: 'How much hunger one Food pellet (or Waste, or Mutagen Paste) relieves.', kind: 'mult', def: 1, min: 0.25, max: 4, step: 0.05, scalars: ['WASTE_HUNGER_RELIEF', 'MUTAGEN_PASTE_HUNGER_RELIEF'],
    apply: (v) => { mul(T.foodRelief, v, 'round'); scalarMul('WASTE_HUNGER_RELIEF', v, 'round'); scalarMul('MUTAGEN_PASTE_HUNGER_RELIEF', v, 'round'); } },
  { id: 'fishHealth', group: 'fish', label: 'Fish health', desc: 'Hit points of baby, mid-size and adult fish.', kind: 'mult', def: 1, min: 0.25, max: 10, step: 0.05, scalars: ['FISH_HEALTH_BABY', 'FISH_HEALTH_MID', 'FISH_HEALTH_ADULT'],
    apply: (v) => { for (const n of ['FISH_HEALTH_BABY', 'FISH_HEALTH_MID', 'FISH_HEALTH_ADULT']) scalarMul(n, v, 'int'); } },
  { id: 'wasteAmount', group: 'fish', label: 'Fish waste', desc: 'How much Waste fish make. Higher fills the tank with Waste faster.', kind: 'mult', def: 1, min: 0.25, max: 5, step: 0.05, scalars: ['WASTE_POOP_INTERVAL_MS'], apply: (v) => setWorldScalar('WASTE_POOP_INTERVAL_MS', Math.max(1000, Math.round(sd('WASTE_POOP_INTERVAL_MS') / v))) },
  // ---- aliens ----
  { id: 'alienHp', group: 'aliens', label: 'Alien health', desc: 'Hit points of every alien tier.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.alienHp, v, 'int') },
  { id: 'bossHp', group: 'aliens', label: 'Boss health', desc: 'The final boss’s health, on top of the alien health setting.', kind: 'mult', def: 1, ...MULT, scalars: ['BOSS_HP_MULTIPLIER'], apply: (v) => scalarMul('BOSS_HP_MULTIPLIER', v, 'int') },
  { id: 'alienDamage', group: 'aliens', label: 'Alien damage to fish', desc: 'How hard aliens and the boss bite. 0 = harmless.', kind: 'mult', def: 1, min: 0, max: 5, step: 0.05, scalars: ['BOSS_FISH_DAMAGE_PER_SEC'], apply: (v) => { mul(T.alienDamage, v); scalarMul('BOSS_FISH_DAMAGE_PER_SEC', v); } },
  { id: 'alienSpeed', group: 'aliens', label: 'Alien speed', desc: 'How fast aliens and the boss swim.', kind: 'mult', def: 1, min: 0.3, max: 3, step: 0.05, scalars: ['BOSS_SPEED'], apply: (v) => { mul(T.alienSpeed, v); scalarMul('BOSS_SPEED', v); } },
  { id: 'waveSize', group: 'aliens', label: 'Wave size', desc: 'How many aliens come in each wave.', kind: 'mult', def: 1, min: 0.25, max: 5, step: 0.05, scalars: ['ALIEN_WAVE_COUNT_EARLY_MIN', 'ALIEN_WAVE_COUNT_EARLY_MAX', 'ALIEN_WAVE_COUNT_LATE_MIN', 'ALIEN_WAVE_COUNT_LATE_MAX'],
    apply: (v) => { for (const n of ['ALIEN_WAVE_COUNT_EARLY_MIN', 'ALIEN_WAVE_COUNT_EARLY_MAX', 'ALIEN_WAVE_COUNT_LATE_MIN', 'ALIEN_WAVE_COUNT_LATE_MAX']) scalarMul(n, v, 'int'); } },
  { id: 'waveGap', group: 'aliens', label: 'Time between waves', desc: 'Lower = waves come faster (this also brings the first wave sooner).', kind: 'mult', def: 1, min: 0.2, max: 4, step: 0.05, scalars: ['ALIEN_WAVE_INTERVAL_EARLY_MS', 'ALIEN_WAVE_INTERVAL_LATE_MS', 'ALIEN_FIRST_WAVE_EARLY_MS'],
    apply: (v) => {
      const early = Math.round(sd('ALIEN_WAVE_INTERVAL_EARLY_MS') * v);
      setWorldScalar('ALIEN_WAVE_INTERVAL_EARLY_MS', early);
      setWorldScalar('ALIEN_WAVE_INTERVAL_LATE_MS', Math.round(sd('ALIEN_WAVE_INTERVAL_LATE_MS') * v));
      // the first wave arrives (early gap - this) after the start, so keep that gap scaled the same way
      setWorldScalar('ALIEN_FIRST_WAVE_EARLY_MS', Math.round(early - (sd('ALIEN_WAVE_INTERVAL_EARLY_MS') - sd('ALIEN_FIRST_WAVE_EARLY_MS')) * v));
    } },
  { id: 'waveRamp', group: 'aliens', label: 'Waves until full difficulty', desc: 'How many waves it takes for wave size, spacing and alien tiers to reach their hardest. Lower ramps up fast.', kind: 'abs', def: 48, min: 5, max: 200, step: 1, unit: 'waves', scalars: ['ALIEN_WAVE_DIFFICULTY_RAMP_WAVES'], apply: (v) => setWorldScalar('ALIEN_WAVE_DIFFICULTY_RAMP_WAVES', Math.round(v)) },
  { id: 'maxAliens', group: 'aliens', label: 'Most aliens at once', desc: 'A hard cap on aliens alive together (higher can slow a weak computer).', kind: 'abs', def: 20, min: 4, max: 30, step: 1, unit: '', scalars: ['ALIEN_MAX_ALIVE'], apply: (v) => setWorldScalar('ALIEN_MAX_ALIVE', Math.round(v)) },
  // ---- defence & buildings ----
  { id: 'turretDamage', group: 'base', label: 'Turret damage', desc: 'Damage of every turret shot.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.turretDamage, v) },
  { id: 'turretRate', group: 'base', label: 'Turret fire rate', desc: 'How often turrets shoot.', kind: 'mult', def: 1, min: 0.25, max: 5, step: 0.05, apply: (v) => mul(T.turretRate, v) },
  { id: 'buildingSpeed', group: 'base', label: 'Building speed', desc: 'How fast Collectors, Refineries and Factories work.', kind: 'mult', def: 1, min: 0.2, max: 5, step: 0.05, apply: (v) => div(T.buildingTimes, v, true) },
  { id: 'powerUse', group: 'base', label: 'Electricity used', desc: 'Power drawn by buildings and turret shots. 0 = everything is free to run.', kind: 'mult', def: 1, min: 0, max: 5, step: 0.05, apply: (v) => mul(T.powerUse, v) },
  { id: 'powerOutput', group: 'base', label: 'Electricity made', desc: 'Power from Power Plants and Electric Eels.', kind: 'mult', def: 1, min: 0.1, max: 10, step: 0.05, apply: (v) => { mul(T.powerOutput, v); div(T.speciesPixelsPerMW, v); } },
  // ---- progression ----
  { id: 'labCost', group: 'progress', label: 'Science Lab prices', desc: 'Gold, Science and Green Science cost of every Lab unlock.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.labCosts, v, 'int') },
  { id: 'moundCost', group: 'progress', label: 'Mound prices', desc: 'What it costs to crack open the Mound.', kind: 'mult', def: 1, ...MULT, scalars: ['MOUND_TEASE_COST'], apply: (v) => { mul(T.moundCracks, v, 'int'); scalarMul('MOUND_TEASE_COST', v, 'int'); } },
  { id: 'upgradeCost', group: 'progress', label: 'Tank Upgrade prices', desc: 'Tank Point cost of the Tank Upgrades and tank expansions.', kind: 'mult', def: 1, ...MULT, apply: (v) => mul(T.tankUpgradeCosts, v, 'int') },
  { id: 'tankPoints', group: 'progress', label: 'Tank Points per adult fish', desc: 'Tank Points earned each time a fish grows up.', kind: 'abs', def: 1, min: 1, max: 10, step: 1, unit: '', scalars: ['TANK_POINT_PER_ADULT_FISH'], apply: (v) => setWorldScalar('TANK_POINT_PER_ADULT_FISH', Math.round(v)) },
];
const RULE_BY_ID = Object.fromEntries(WORLD_RULES.map((r) => [r.id, r]));
const ALL_SCALARS = [...new Set(WORLD_RULES.flatMap((r) => r.scalars || []))];
const ALL_TARGETS = Object.values(T).flat();

// ---- presets ----
// Only the values that differ from Normal are listed. Easy is gentler on every front; Challenge is tighter on
// every front (and cheaper to start in, so the early game is a squeeze rather than a stall).
export const WORLD_PRESETS = {
  easy: { label: 'Easy', desc: 'More gold, cheaper everything, slower hunger, and smaller, slower, weaker alien waves.',
    values: { startMoney: 250, fishPrice: 0.7, fishPriceGrowth: 1.2, buildingPrice: 0.75, coinValue: 1.4, hunger: 0.7, foodStrength: 1.25, fishHealth: 1.5, dirtyPenalty: 0.75, labCost: 0.7, moundCost: 0.7, upgradeCost: 0.7,
      alienHp: 0.6, alienDamage: 0.5, alienSpeed: 0.85, waveSize: 0.6, waveGap: 1.5, waveRamp: 80, turretDamage: 1.5, buildingSpeed: 1.25 } },
  normal: { label: 'Normal', desc: 'The game as designed. Achievements and Fishy Gems can be earned.', values: {} },
  challenge: { label: 'Challenge', desc: 'Pricier, hungrier and stingier, with bigger, faster, tougher alien waves.',
    values: { startMoney: 60, fishPrice: 1.3, fishPriceGrowth: 1.45, buildingPrice: 1.3, coinValue: 0.8, hunger: 1.35, foodStrength: 0.85, fishHealth: 0.75, dirtyPenalty: 0.25, sellRefund: 0.5, labCost: 1.4, moundCost: 1.3, upgradeCost: 1.4,
      alienHp: 1.7, alienDamage: 1.6, alienSpeed: 1.15, waveSize: 1.6, waveGap: 0.65, waveRamp: 24, turretDamage: 0.85 } },
};

// ---- reading / normalising a world ----
const EPS = 1e-9;
const clampRule = (rule, x) => Math.min(rule.max, Math.max(rule.min, Number.isFinite(+x) ? +x : rule.def));

// The full { ruleId: value } map for a stored world (missing/old/garbage values fall back to the default,
// and every value is forced inside its rule's limits, so a hand-edited save can never feed the game nonsense).
export function worldValues(ws) {
  const out = {};
  const stored = (ws && ws.values) || {};
  for (const r of WORLD_RULES) out[r.id] = stored[r.id] === undefined ? r.def : clampRule(r, stored[r.id]);
  return out;
}
export function defaultWorldValues() { return Object.fromEntries(WORLD_RULES.map((r) => [r.id, r.def])); }
export function presetWorldValues(presetId) { return worldValues({ values: (WORLD_PRESETS[presetId] || WORLD_PRESETS.normal).values }); }
export function isRuleModified(rule, value) { return Math.abs(value - rule.def) > EPS; }
export function isWorldModified(ws) {
  const v = worldValues(ws);
  return WORLD_RULES.some((r) => isRuleModified(r, v[r.id]));
}
// Per direct request, a save that has EVER had modified World Settings can never earn achievements again — setting
// everything back to Normal does not undo it. meta.worldEverModified is the permanent mark (set when a modified world
// is started or loaded, or when a modified world is saved into a slot from the Load Game screen); this is the one
// question every "may this save earn achievements?" check asks.
export function isRunTainted(meta) {
  return !!(meta && (meta.worldEverModified || isWorldModified(meta.worldSettings)));
}
// Which preset (if any) a values map matches exactly — 'custom' otherwise.
export function matchingPreset(values) {
  for (const [id] of Object.entries(WORLD_PRESETS)) {
    const p = presetWorldValues(id);
    if (WORLD_RULES.every((r) => Math.abs(p[r.id] - values[r.id]) <= EPS)) return id;
  }
  return 'custom';
}
// What gets stored in state.meta.worldSettings: only the non-default values (a Normal world stores nothing).
export function makeWorldSettings(values) {
  const stored = {};
  for (const r of WORLD_RULES) if (isRuleModified(r, values[r.id])) stored[r.id] = +(+values[r.id]).toPrecision(8);
  return Object.keys(stored).length ? { preset: matchingPreset(values), values: stored } : undefined;
}
export function worldSettingsLabel(ws) {
  if (!ws || !isWorldModified(ws)) return 'Normal';
  return WORLD_PRESETS[ws.preset] ? WORLD_PRESETS[ws.preset].label : 'Custom';
}

// ---- applying ----
function restoreDefaults() {
  for (const t of ALL_TARGETS) t.parent[t.key] = t.base;
  for (const n of ALL_SCALARS) setWorldScalar(n, sd(n));
}
// Puts the game's numbers into the state described by `ws` (undefined = Normal). Safe to call any number of
// times in any order — it always starts from the real defaults.
export function applyWorldSettings(ws) {
  restoreDefaults();
  const v = worldValues(ws);
  for (const r of WORLD_RULES) if (isRuleModified(r, v[r.id])) r.apply(v[r.id]);
  recomputeWorldDerived();
}
export function ruleById(id) { return RULE_BY_ID[id]; }
