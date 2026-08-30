// Levels.js — LEVELS data array, level load/unload, win/lose conditions.
// Levels are data, not code (§3.2): each entry defines starting money,
// which species/buildings are available, win conditions, alien waves, and
// meta rewards granted on completion.

import { SPECIES_LIST, BUILDING_LIST } from './Config.js';
import { createGrid } from './Grid.js';

// winConditions/waveSchedule/rewards are unused until later phases wire up
// their evaluation — they exist now so a level's shape never has to change
// later, and Phase 1 still loads through this same real path.
export const LEVELS = [
  {
    id: 'level1',
    name: 'The First Tank',
    startingMoney: 100, // enough for ~2 guppies or a mixed opening buy
    // Every species/building this level could ever offer, across all 4
    // Tiers — the Mound (Mound.js) is what actually reveals them over the
    // course of a playthrough via state.meta.speciesUnlocked/
    // buildingsUnlocked, so this allow-list itself doesn't need to be
    // narrower than "everything the game currently has."
    allowedSpecies: SPECIES_LIST.map((s) => s.id),
    allowedBuildings: BUILDING_LIST.map((b) => b.id),
    winConditions: [{ type: 'moneyReached', amount: 500 }], // not evaluated until Phase 5
    waveSchedule: [], // Phase 5
    rewards: { species: [], buildings: [], tech: [] }, // granted on completion, Phase 5
  },
];

export function getLevel(levelId) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level id: ${levelId}`);
  return level;
}

// Rebuilds state.level from scratch using a level definition. This is the
// ONLY place state.level should be constructed — never hand-build it
// inline elsewhere. Does not touch state.meta: writing meta fields here
// would be the exact "level code touching meta state" bug §3.1 warns about.
export function loadLevel(state, levelId) {
  const def = getLevel(levelId);
  state.level = {
    levelId: def.id,
    levelName: def.name,
    money: def.startingMoney,
    cleanliness: 100, // placeholder — Phase 3 wires this to real toxicity
    powerSupply: 0,
    powerDemand: 0,
    entities: [],
    items: [],
    floatingTexts: [], // transient "+$N" pickup readouts — not physics items, never touched by Grid.js routing
    grid: createGrid(), // 2D tile array, all TILE_EMPTY — see Grid.js
    gridStats: { itemsRoutedTotal: 0 }, // lifetime count of items consumed by a Collector tile, for the debug overlay's throughput readout
    tier: 1, // 1-4, Mound-driven progression — see Mound.js and CLAUDE.md's "Tier Progression & The Mound"; level-scoped like everything else here, even though the meta-unlocks a previous crack granted stay permanent
    moundTeased: false, // has the Mound's first (fake, no-op) "throw money" attempt already happened this level? — see Mound.js's crackMound/getMoundNextCost
    notifications: [], // rolling log for UI.js's ticker — { id, text, elapsed }, capped at NOTIFICATION_LOG_MAX
    tankPoints: { total: 0, available: 0 }, // earned by Entities.js on fish adult-growth transitions, spent in UI.js's Tank Upgrades panel — see CLAUDE.md's "Tank Points & Tank Upgrades"
    upgrades: { foodQuality: 0, fishMovement: 0, foodCapacity: 0 }, // purchased Tank Upgrade levels, 0 = not yet bought; read live by Entities.js, not baked into fish/food at creation time
    waveTimer: 0,
    elapsed: 0,
  };
  state.camera.x = 0;
  state.camera.y = 0;
}

// Gated by both the level's allow-list and meta unlocks, per §4.
export function getAvailableSpecies(state) {
  const level = getLevel(state.level.levelId);
  return SPECIES_LIST.filter(
    (s) => level.allowedSpecies.includes(s.id) && state.meta.speciesUnlocked.includes(s.id)
  );
}

// Same gating pattern as getAvailableSpecies, for the Phase 2 build palette.
export function getAvailableBuildings(state) {
  const level = getLevel(state.level.levelId);
  return BUILDING_LIST.filter(
    (b) => level.allowedBuildings.includes(b.id) && state.meta.buildingsUnlocked.includes(b.id)
  );
}
