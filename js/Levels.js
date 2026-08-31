// Levels.js — LEVELS data array, level load/unload, win/lose conditions.
// Levels are data, not code (§3.2): each entry defines starting money,
// which species/buildings are available, win conditions, alien waves, and
// meta rewards granted on completion.

import { SPECIES_LIST, BUILDING_LIST } from './Config.js';
import { createGrid } from './Grid.js';

// The very first entry in state.level.notifications, pushed at level load
// rather than shown as a UI-layer fallback string — this is what makes it
// survive in the expandable scrollback log (UI.js's updateNotificationTicker)
// even once real notifications start pushing past it, instead of just
// vanishing the moment anything else happens. See CLAUDE.md's "Story &
// Tutorial Notifications" section.
const WELCOME_MESSAGE = 'Welcome to the tank';

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
    science: 0, // Science Bubbles banked so far — level-scoped like money now that Science is a real collected resource (see Entities.js's createScience/bankScience), not a permanent meta counter

    cleanliness: 100, // 0-100, clamped — real now (Phase 3): Entities.js/Grid.js adjust it whenever Waste spawns or gets cleaned up, see Config.js's CLEANLINESS_* comment. No gameplay effect from a low value yet (fish stress/toxicity is still unbuilt) — this is the live-tracked value + HUD feedback half of the system
    powerSupply: 0, // MW capacity accumulated so far from Generator fish — see Entities.js's updateFish GENERATOR branch
    powerDemand: 0, // unused directly any more — Grid.js's computeCurrentPowerDemand computes this live instead; kept for shape-compat with older docs
    powerHistory: [], // rolling { demand, supply } samples, one per real sim-second, capped at POWER_HISTORY_MAX — see main.js's update()
    entities: [],
    items: [],
    floatingTexts: [], // transient "+$N" pickup readouts — not physics items, never touched by Grid.js routing
    grid: createGrid(), // 2D tile array, all TILE_EMPTY — see Grid.js
    buildingData: {}, // sparse "row,col" -> { type, angle, ... } map for buildings that need per-instance data the grid's bare type-id strings can't hold (Fans' aim angle, Auto-Feeder's absorb/process state) — see Grid.js's placeTile/removeTile
    gridStats: { itemsRoutedTotal: 0 }, // lifetime count of items consumed by a Collector tile, for the debug overlay's throughput readout
    tier: 1, // 1-5, Mound-driven progression — see Mound.js and CLAUDE.md's "Tier Progression & The Mound"; level-scoped like everything else here, even though the meta-unlocks a previous crack granted stay permanent
    moundTeased: false, // has the Mound's first "throw money" attempt already happened this level? — see Mound.js's crackMound/getMoundNextCost. A pure no-op joke again — the Rudimentary Fan moved to its own paid "Tier 1.75" step below, per direct request
    fanUnlockPurchased: false, // "Tier 1.75" — the $500 step (after the tease, before the real Tier 1->2 crack) that grants ONLY the Rudimentary Fan — see Mound.js's crackMound/getMoundNextCost and Config.js's FAN_UNLOCK_COST
    autoFeederUnlockPurchased: false, // "Tier 2.5" — the $2500 step (after the real Tier 1->2 crack, before the real Tier 2->3 crack) that grants ONLY the Auto-Feeder — see Config.js's AUTO_FEEDER_UNLOCK_COST
    notifications: [{ id: 1, text: WELCOME_MESSAGE, elapsed: 0 }], // rolling log for UI.js's ticker — { id, text, elapsed }, capped at NOTIFICATION_LOG_MAX. Seeded with the welcome message as a real entry (not a UI fallback) so it survives in the scrollback log
    tankPoints: { total: 0, available: 0 }, // earned by Entities.js on fish adult-growth transitions, spent in UI.js's Tank Upgrades panel — see CLAUDE.md's "Tank Points & Tank Upgrades"
    upgrades: { foodQuality: 0, fishMovement: 0, foodCapacity: 0, fishMergingUnlocked: false }, // purchased Tank Upgrade levels, 0 = not yet bought; read live by Entities.js, not baked into fish/food at creation time. fishMergingUnlocked is a one-time flag, not a level — see Config.js's FISH_MERGING_UNLOCK_COST
    // One-time story/tutorial notification gates — see CLAUDE.md's "Story &
    // Tutorial Notifications". Level-scoped like everything else here, so a
    // restart replays them (matching moundTeased/the Tank Point tutorial's
    // own existing one-shot pattern).
    tutorialFlags: {
      firstFishBought: false,
      firstFishDied: false,
      firstBuildingPlaced: false,
      firstCombine: false,
      firstFanPlaced: false,
      moneyMilestone1k: false,
      escapePressed: false, // set true the first time Escape is ever pressed, regardless of context — read by the 2-minute dare check and the "made ya look" follow-up
      escapeDareShown: false,
      firstChatClosed: false, // fires the "you found the chat" gag on the first CLOSE of the log, not the first open — see UI.js's notificationLatest click handler
      cleanlinessWarningShown: false, // fires once cleanliness first crosses below CLEANLINESS_WARNING_THRESHOLD — see Entities.js's adjustCleanliness
      firstSplice: false, // Phase 4 — first successful Gene-Splicing drag, see Entities.js's spliceFish
    },
    lifetimeMoneyEarned: 0, // real in-play income only (coins banked) — NOT the starting endowment or the bankruptcy bailout gift; see Entities.js's bankMoney and Config.js's MONEY_MILESTONE_1K
    fishVanishTimer: 0, // ms remaining on the "you found the chat" gag — see Entities.js's updateEntities; every fish freezes in place (not just hidden) and stops rendering while this is > 0
    bankruptcyActive: false, // true while "no fish + can't afford anything" is CURRENTLY true, so the bailout/game-over response only fires once per fresh occurrence of that condition, not every tick it holds — see Systems.js's updateStoryTriggers
    bankruptciesTriggered: 0, // 0 = never happened, 1 = the one-time $100 bailout already used, 2+ = game over
    gameOver: false, // set true on the second bankruptcy — main.js's update() stops simulating while this is true, same as state.ui.paused, but Escape still opens the pause menu so Restart stays reachable
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
