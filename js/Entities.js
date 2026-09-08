// Entities.js — Food, Coin, and the single species-driven Fish entity.
// Owns state.level.entities and state.level.items contents and their
// per-tick behavior. Forbidden: no rendering (main.js's render pass owns
// that), no tile placement (Grid.js owns that).

import {
  SPECIES,
  SPECIES_LIST,
  FOOD_RADIUS,
  FOOD_COST,
  FOOD_STATIONARY_TO_WASTE_MS,
  FOOD_STATIONARY_MOVE_TOLERANCE_PX,
  COIN_RADIUS,
  COIN_CLICK_RADIUS_MULTIPLIER,
  FISH_EAT_RADIUS,
  HUNGER_MAX,
  HUNGER_SEEK_THRESHOLD,
  HUNGER_CRITICAL_THRESHOLD,
  FOOD_HUNGER_RELIEF_BY_LEVEL,
  FISH_VERTICAL_DAMPING,
  WANDER_INTERVAL_MIN_S,
  WANDER_INTERVAL_MAX_S,
  GRAVITY,
  MAX_FALL_SPEED,
  FOOD_GRAVITY,
  FOOD_MAX_FALL_SPEED,
  FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL,
  FOOD_SWAY_AMPLITUDE,
  FOOD_SWAY_FREQUENCY,
  FOOD_SWAY_ENVELOPE_FREQUENCY,
  WASTE_SWAY_AMPLITUDE,
  WASTE_SWAY_FREQUENCY,
  COIN_TIERS,
  PICKUP_TEXT_LIFETIME_MS,
  PICKUP_TEXT_RISE_SPEED,
  FISH_SEEK_SPEED_MULTIPLIER,
  FISH_MOVEMENT_UPGRADE_SPEED_BONUS,
  FISH_SPEED_MULTIPLIER,
  TAIL_WAG_RATE,
  COIN_TIMER_FEED_BONUS_FRACTION,
  WASTE_TIMER_FEED_BONUS_FRACTION,
  SEABED_FLOOR_Y,
  FISH_MIN_X,
  FISH_MAX_X,
  FISH_MIN_Y,
  WASTE_RADIUS,
  WASTE_GRAVITY,
  WASTE_MAX_FALL_SPEED,
  TANK_POINT_PER_ADULT_FISH,
  TANK_POINT_COLOR,
  NOTIFICATION_LOG_MAX,
  WORLD_W,
  ITEM_MASS_BY_TYPE,
  FISH_BASE_SIZE,
  ECONOMY_SPECIES_IDS,
  DYNAMIC_PRICED_SPECIES_IDS,
  ECONOMY_FISH_COST_GROWTH_RATE,
  FISH_SCALING_LAB_ID,
  FISH_STAR_TIER_MAX,
  FISH_STAR_TIER_VALUE_MULTIPLIER,
  FISH_STAR_TIER_HUNGER_MULTIPLIER,
  FISH_STAR_COLOR,
  FISH_DRAG_HIT_RADIUS_FRACTION,
  MONEY_MILESTONE_1K,
  WASTE_HUNGER_RELIEF,
  WASTE_POOP_INTERVAL_MS,
  CLEANLINESS_MAX,
  CLEANLINESS_PER_WASTE_EVENT,
  CLEANLINESS_WARNING_THRESHOLD,
  CLEANLINESS_WARNING_MESSAGE,
  SCIENCE_COLOR,
  POWER_COLOR,
  UTILITY_SPECIES_IDS,
  SCIENCE_ITEM_RADIUS,
  SCIENCE_PROGRESS_TICKS,
  COIN_CAP_BY_LEVEL,
  SCIENCE_CAP_BY_LEVEL,
  ALIEN_AWARENESS_RADIUS,
  ALIEN_FOOD_AWARENESS_RADIUS,
  ALIEN_CHASE_CHANCE,
  ALIEN_FLEE_CHANCE,
  ALIEN_WANDER_INTERVAL_MIN_S,
  ALIEN_WANDER_INTERVAL_MAX_S,
  ALIEN_POOP_INTERVAL_MS,
  ALIEN_INCOME_BLOCK_RADIUS,
  ALIEN_PORTAL_OPEN_MS,
  ALIEN_PORTAL_CLOSE_MS,
  FISH_BLOCKED_TINT_MS,
  ALIEN_DEATH_EFFECT_DURATION_MS,
  ALIEN_HIT_FLASH_MS,
  TURRET_PROJECTILE_SPEED,
  TURRET_PROJECTILE_HIT_RADIUS,
  PRODUCTION_BLOCKED_EFFECT_DURATION_MS,
  WASTE_MAX_ON_SCREEN,
  ALIEN_RADIUS,
  ALIEN_CLICK_RADIUS_MULTIPLIER,
  ALIEN_FOOD_BLOCK_DURATION_MS,
  ALIEN_ARCHETYPES,
  ALIEN_DNA_RADIUS,
  ALIEN_DNA_COLOR,
  ALIEN_DNA_MAX_ON_SCREEN,
  BIOMASS_RADIUS,
  BIOMASS_COLOR,
  BIOMASS_MAX_ON_SCREEN,
  MUTAGEN_PASTE_RADIUS,
  MUTAGEN_PASTE_COLOR,
  MUTAGEN_PASTE_COIN_MULTIPLIER,
  MUTAGEN_PASTE_HUNGER_RELIEF,
  SCIENCE_GREEN_ITEM_RADIUS,
  SCIENCE_GREEN_COLOR,
  EEL_BLIMP_BATTERY_CAPACITY_MW,
  EEL_BLIMP_BATTERY_CAPACITY_MUTAGEN_MW,
  EEL_BLIMP_MUTAGEN_PRODUCTION_MULTIPLIER,
  BUFFER_FISH_MAGNET_RADIUS,
  BUFFER_FISH_MAGNET_FORCE,
  CLEANLINESS_STRESS_THRESHOLD,
  CLEANLINESS_STRESS_MAX_HUNGER_MULTIPLIER,
  CLEANLINESS_STRESS_MAX_INTERVAL_MULTIPLIER,
  ELECTRIC_SUCKER_FOOD_INTERVAL_MS,
  SCIENCE_ALIEN_DNA_INTERVAL_MS,
  ALIEN_EGG_RADIUS,
  ALIEN_EGG_HATCH_MS,
  ALIEN_EGG_HATCH_INVULN_MS,
  ALIEN_EGG_RISE_SPEED,
  ALIEN_MAX_ALIVE,
  BOSS_HP_MULTIPLIER,
  BOSS_RADIUS,
  BOSS_SPEED,
  BOSS_COLOR,
  BOSS_MINION_SPAWN_INTERVAL_MS,
  BOSS_MINION_SPAWN_COUNT,
  BOSS_DEATH_SCIENCE_COUNT,
  BOSS_DEATH_SCIENCE_GREEN_COUNT,
} from './Config.js';
import { stepItemOnGrid, resolveItemCollisions, computeFanForce, integrateItemForces, updateBuildings } from './Grid.js';
// Sound is a fire-and-forget side effect at the moment something already
// happened — the same pattern this file already uses for floatingTexts/
// notifications, just for audio instead of a visual/text readout.
import { playPurchase, playFoodPlace, playEat, playFishDeath, playCoinBank, playTankPoint, playProductionBlocked, playHunger, playAlienHit, playAlienDeath, playDispense } from './Sound.js';

let _nextId = 1;
function nextId() {
  return _nextId++;
}

// Filled by updateFood, flushed into state.level.items by updateEntities
// right after its own state.level.items.filter(...) call completes — see
// updateFood's own comment for why it can't push a new Waste item directly
// from inside that filter's callback.
const pendingFoodToWasteSpawns = [];

// Same "filled during a filter callback, flushed right after" pattern —
// updateAlien can't push a new alien directly into state.level.entities from
// inside updateEntities' own state.level.entities.filter(...) callback (the
// array reference gets reassigned to filter's OWN result the moment that
// call returns, silently dropping anything pushed onto the pre-reassignment
// array mid-callback) — so the Mother Alien Fish's minion-spawn timer queues
// { x, y, archetypeId } records here instead, flushed by updateEntities
// right after its entities filter completes.
const pendingBossMinionSpawns = [];

// Same array-mutation-during-filter workaround as pendingBossMinionSpawns
// above, for the turret tutorial's own "another alien instantly spawns"
// moment (see updateAlien's death branch) — a single { x, y, hp,
// archetypeId } record, flushed by updateEntities right after its own
// entities.filter completes.
const pendingTurretTutorialAlienSpawns = [];

// state.level.cleanliness (0-100) — every Waste item that spawns costs
// CLEANLINESS_PER_WASTE_EVENT, every one cleaned back up (a Scavenger fish
// eating it here, or an Auto-Feeder absorbing it in Grid.js's
// updateBuildings) restores the same amount. UI.js's updateHUD detects
// which direction the value just moved (same pattern already used for the
// money HUD) and flashes #hud-cleanliness accordingly — no explicit
// "trigger the flash" call needed here, just changing the value.
function adjustCleanliness(state, delta) {
  const before = state.level.cleanliness;
  state.level.cleanliness = Math.max(0, Math.min(CLEANLINESS_MAX, before + delta));
  // One-shot warning the first time cleanliness actually crosses below the
  // threshold (not just "is currently below it") — a plain `< THRESHOLD`
  // check without the `before >=` guard would also fire on every subsequent
  // waste event while already dirty, not just the first crossing.
  if (
    before >= CLEANLINESS_WARNING_THRESHOLD &&
    state.level.cleanliness < CLEANLINESS_WARNING_THRESHOLD &&
    !state.level.tutorialFlags.cleanlinessWarningShown
  ) {
    state.level.tutorialFlags.cleanlinessWarningShown = true;
    pushStoryNotification(state, CLEANLINESS_WARNING_MESSAGE);
  }
}

// Real gameplay detriment of a dirty tank, per direct request — see
// Config.js's CLEANLINESS_STRESS_* constants for the full rationale. Returns
// 0 (no stress) at or above CLEANLINESS_STRESS_THRESHOLD, scaling linearly
// up to 1 (maximum stress) at 0% cleanliness. Used by updateFish to slow
// coin production and speed up hunger.
function cleanlinessStressFactor(state) {
  const cleanliness = state.level.cleanliness;
  if (cleanliness >= CLEANLINESS_STRESS_THRESHOLD) return 0;
  return (CLEANLINESS_STRESS_THRESHOLD - cleanliness) / CLEANLINESS_STRESS_THRESHOLD;
}

// A sine wobble on horizontal velocity — same underlying idea Ambience.js's
// bubbles already use for their own left-right drift, per direct request.
// Self-correcting no matter what the item's actual fall looks like (a Fan
// shove, item-item collisions, etc.) since it's just a function of elapsed
// fallTime and a per-item random phase, recomputed fresh every tick —
// nothing pre-scheduled to go stale. The amplitude itself is further
// modulated by a much slower second sine (the "envelope", squared so it
// never goes negative) — per direct request that the sway read as
// occasional/sporadic bursts rather than one continuous wave.
function currentSwayVx(item, amplitude, frequency, envelopeFrequency) {
  const envelope = Math.max(0, Math.sin(item.fallTime * envelopeFrequency * 2 * Math.PI + item.swayPhase * 0.3));
  return amplitude * envelope * envelope * Math.sin(item.fallTime * frequency * 2 * Math.PI + item.swayPhase);
}

export function createFood(x, y) {
  return {
    id: nextId(),
    type: 'food',
    x,
    y,
    vx: 0, // seabed-band item-item collision drift (Grid.js); the open-water sway above is separate and only applies before that
    vy: 0,
    radius: FOOD_RADIUS,
    mass: ITEM_MASS_BY_TYPE.food, // deliberately much lighter than a coin — see Config.js's ITEM_MASS_BY_TYPE
    // Stationary-to-Waste tracking (see updateFood) — stationaryOriginX/Y is
    // the last position this pellet was seen meaningfully moving from;
    // stationaryTimer counts up while it stays within
    // FOOD_STATIONARY_MOVE_TOLERANCE_PX of that point.
    stationaryOriginX: x,
    stationaryOriginY: y,
    stationaryTimer: 0,
    fallTime: 0,
    swayPhase: Math.random() * Math.PI * 2,
  };
}

// bronze/silver/gold/diamond by value — used to size and color the coin
// itself, and to color its pickup text, so all three always agree.
export function getCoinTier(value) {
  for (const tier of COIN_TIERS) {
    if (value <= tier.maxValue) return tier;
  }
  return COIN_TIERS[COIN_TIERS.length - 1];
}

export function getCoinColor(value) {
  return getCoinTier(value).color;
}

export function createCoin(x, y, value) {
  const tier = getCoinTier(value);
  const radius = COIN_RADIUS * tier.sizeMultiplier;
  const mass = ITEM_MASS_BY_TYPE.coin * tier.sizeMultiplier; // a gold/diamond coin is a little heavier than a bronze one, same scale as its size
  return { id: nextId(), type: 'coin', x, y, vx: 0, vy: 0, radius, mass, value, resting: false };
}

// Byproduct of a basic (unpowered) Collector consuming an item — see
// Config.js's WASTE_* comment and CLAUDE.md's Tier Progression & The Mound
// section. Falls/routes through the same Grid.js tile physics as a coin,
// but isn't click-bankable and nothing currently consumes it.
export function createWaste(x, y) {
  return {
    id: nextId(), type: 'waste', x, y, vx: 0, vy: 0, radius: WASTE_RADIUS, mass: ITEM_MASS_BY_TYPE.waste, resting: false,
    fallTime: 0, swayPhase: Math.random() * Math.PI * 2, // a light sway while falling through open water, same mechanism as Food's — see currentSwayVx
  };
}

// A physical Science Bubble — falls/routes exactly like a coin (straight
// gravity, no sway), just lighter-looking (SCIENCE_ITEM_RADIUS, smaller than
// a bronze coin) and much heavier (ITEM_MASS_BY_TYPE.science = 9, 3x a
// coin's mass) — per direct request, Science is now "an actual resource,
// like coins," not an instant number added the moment a Researcher fish's
// timer fires. Always worth exactly 1 when banked (see bankScience below);
// unlike a coin there's no value tier to size/color it by.
export function createScience(x, y) {
  return { id: nextId(), type: 'science', x, y, vx: 0, vy: 0, radius: SCIENCE_ITEM_RADIUS, mass: ITEM_MASS_BY_TYPE.science, resting: false };
}

// A green Science Bubble — the Bio-Combuster's upgraded output. Physically
// and mechanically identical to a blue one (see createScience above): falls
// exactly like a coin, click-bankable or Collector-routed, always worth 1
// when banked (bankScienceGreen below) — only its own separate reserve
// (state.level.scienceGreen) and its color differ.
export function createScienceGreen(x, y) {
  return { id: nextId(), type: 'science_green', x, y, vx: 0, vy: 0, radius: SCIENCE_GREEN_ITEM_RADIUS, mass: ITEM_MASS_BY_TYPE.science_green, resting: false };
}

// Dropped by a defeated alien (Weight Class 5 — Heavy), OR made at the
// Manufacturer via the Bio-Sludge recipe (Food+Waste) — see
// createAlien/updateAlien's death branch for the yield-scaled multi-drop,
// and Grid.js's Manufacturer branch for the recipe path. Displayed as
// "Bio-Sludge" everywhere now (the type string itself stays `alien_dna`,
// unchanged, per direct request — see Config.js's own comment on this type).
// The Refinery's "Bio-Sludge -> Biomass" recipe is the only thing that ever
// consumes it (Grid.js's updateBuildings).
export function createAlienDna(x, y) {
  return { id: nextId(), type: 'alien_dna', x, y, vx: 0, vy: 0, radius: ALIEN_DNA_RADIUS, mass: ITEM_MASS_BY_TYPE.alien_dna, resting: false };
}

// The Refinery's Bio-Sludge-recipe output, and the shared 2nd ingredient
// every Mutagen-Paste/Blue-Science recipe needs (Weight Class 5 — Heavy,
// same as Bio-Sludge — it's refined FROM it, so it stays in that class).
export function createBiomass(x, y) {
  return { id: nextId(), type: 'biomass', x, y, vx: 0, vy: 0, radius: BIOMASS_RADIUS, mass: ITEM_MASS_BY_TYPE.biomass, resting: false };
}

// The Mutagen Paste recipe's output (Food + Biomass) — Weight Class 1, Buoyant, same
// physics profile as plain Food (see updateMutagenPaste's own sway/gravity,
// mirroring updateFood exactly). Fish prioritize this over standard Food
// when hungry, and its eat effect differs by growth stage — see
// updateFish's eat branch for the full mechanic.
export function createMutagenPaste(x, y) {
  return {
    id: nextId(), type: 'mutagen_paste', x, y, vx: 0, vy: 0, radius: MUTAGEN_PASTE_RADIUS, mass: ITEM_MASS_BY_TYPE.mutagen_paste, resting: false,
    fallTime: 0, swayPhase: Math.random() * Math.PI * 2,
  };
}

// The Manufacturer's Alien Egg recipe output (Blue Science + Food) — Weight
// Class 3, same mass as a coin per direct spec. hatchTimer counts up toward
// ALIEN_EGG_HATCH_MS (see updateAlienEgg below); nothing else about it is
// unique — it falls/routes/drags exactly like every other item its class.
export function createAlienEgg(x, y) {
  return { id: nextId(), type: 'alien_egg', x, y, vx: 0, vy: 0, radius: ALIEN_EGG_RADIUS, mass: ITEM_MASS_BY_TYPE.alien_egg, resting: false, hatchTimer: 0 };
}

export function createPickupText(x, y, text, color) {
  return { id: nextId(), type: 'pickupText', x, y, text, color, age: 0 };
}

// Alien Invasion — see Config.js's ALIEN_* constants and CLAUDE.md-pending
// notes. Systems.js's updateAlienWaves owns wave TIMING/scheduling and
// pushes { x, y, hp, archetypeId, openAtMs, spawned, spawnedAtMs } records
// into state.level.alienPortals; this file owns the actual entity (creation,
// AI, poop, removal) per Entities.js's own "Fish, Alien, Food, Item" scope.
// updateEntities below is what actually turns a due portal into a real
// alien — kept here rather than in Systems.js so no circular import is
// needed (Systems.js writing plain portal data into state needs no import
// of this file at all).
//
// Dynamic Alien Archetypes (Architectural Update): archetypeId looks up the
// tier's full stat profile in ALIEN_ARCHETYPES and copies its speed/radius/
// color/dnaYield onto the instance as plain fields — every other module
// (updateAlien's own movement below, main.js's click hit-test/rendering,
// Grid.js's turret targeting) reads these straight off the alien entity
// rather than re-looking-up the archetype table itself, keeping the "plain
// serializable instance data" contract intact. Falls back to the lowest
// tier if archetypeId is missing/unrecognized, same defensive-fallback
// precedent as every other lookup-by-id in this codebase.
export function createAlien(x, y, hp, archetypeId) {
  const archetype = ALIEN_ARCHETYPES.find((a) => a.id === archetypeId) || ALIEN_ARCHETYPES[0];
  return {
    id: nextId(),
    type: 'alien',
    x, y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    archetypeId: archetype.id,
    speed: archetype.speed,
    radius: archetype.radius,
    color: archetype.color,
    dnaYield: archetype.dnaYield,
    wanderTimer: 0, // 0 so the very first tick immediately picks a heading, same as fish's own wanderTimer
    poopTimer: 0,
    hitFlashMs: 0, // counts down from ALIEN_HIT_FLASH_MS whenever damage is applied (Grid.js's Turret branch, main.js's click handler) — drives the red-flash/bounce read by main.js's render
    spawnProtectionUntilMs: 0, // Alien-Egg-hatched aliens only — see updateAlienEgg; a normal wave-spawned alien never has this set past 0, so every damage-site check below is a no-op for it
    risingToSurface: false, // Alien-Egg-hatched aliens only, and only when the egg hatched inside the seabed city — overrides all normal AI/movement in updateAlien until it clears SEABED_FLOOR_Y
    isBoss: false, // Mother Alien Fish only — see createMotherAlienFish below; drives updateAlien's minion-spawn timer, main.js's top-middle boss health bar instead of a per-alien one, and the special death sequence
    minionSpawnTimerMs: 0, // Mother Alien Fish only
  };
}

// The end-game boss — per direct spec, "10x harder than a tier 5 alien,"
// applied to ALIEN_ARCHETYPES' own top tier's hpMin/hpMax range rather than
// a hand-tuned bespoke number, so it automatically stays "10x a Tier 5" if
// that base archetype is ever rebalanced. Otherwise a plain alien entity
// (same type: 'alien', reusing every existing alien mechanic — movement,
// turret targeting, click damage, hit-flash — for free) with `isBoss: true`
// as the one flag that changes its behavior: see updateAlien's own isBoss
// branches for the minion-spawning timer and the special death sequence.
export function createMotherAlienFish(x, y) {
  const t5 = ALIEN_ARCHETYPES[ALIEN_ARCHETYPES.length - 1];
  const hpMin = t5.hpMin * BOSS_HP_MULTIPLIER;
  const hpMax = t5.hpMax * BOSS_HP_MULTIPLIER;
  const hp = hpMin + Math.floor(Math.random() * (hpMax - hpMin + 1));
  return {
    id: nextId(), type: 'alien', x, y, vx: 0, vy: 0, hp, maxHp: hp,
    archetypeId: 'mother_alien_fish', speed: BOSS_SPEED, radius: BOSS_RADIUS, color: BOSS_COLOR,
    dnaYield: 0, // no ordinary Alien DNA drop on death — see updateAlien's isBoss death branch for its own Science-burst instead
    wanderTimer: 0, poopTimer: 0, hitFlashMs: 0, spawnProtectionUntilMs: 0, risingToSurface: false,
    isBoss: true, minionSpawnTimerMs: 0,
  };
}

// Same idea as findNearestFood/findNearestWaste, but scoped to a max radius
// (aliens shouldn't "sense" a fish clear across the tank) and targeting
// live fish entities instead of items.
function findNearestFishWithin(entities, x, y, radius) {
  let best = null;
  let bestDistSq = radius * radius;
  for (const e of entities) {
    if (e.type !== 'fish') continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDistSq) { bestDistSq = d; best = e; }
  }
  return best;
}

// Mirror of findNearestFishWithin, targeting living aliens instead — used by
// updateFish for both the flee-bias (wander) and the coin-production-block/
// gray-tint check.
function findNearestAlienWithin(entities, x, y, radius) {
  let best = null;
  let bestDistSq = radius * radius;
  for (const e of entities) {
    if (e.type !== 'alien' || e.hp <= 0) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDistSq) { bestDistSq = d; best = e; }
  }
  return best;
}

// Both aliens and fish are deliberately "kinda dumb" at predator/prey, per
// direct request — neither ever hard-locks onto a straight pursuit/flee
// line. ALIEN_CHASE_CHANCE gates whether this wander cycle even considers
// the nearest fish at all; when it does, the new heading is biased toward
// it by a random angle offset rather than aimed dead-on.
function updateAlien(alien, state, dtMs) {
  if (alien.hp <= 0) {
    // Per direct request, killing an alien gets its own visual instead of
    // just vanishing — a short expanding/fading burst, fully decoupled from
    // the alien entity itself (which is removed right here), same
    // independent-particle pattern state.level.floatingTexts already uses.
    state.level.alienDeathEffects.push({ x: alien.x, y: alien.y, age: 0, color: alien.color, big: alien.isBoss });
    playAlienDeath();
    // Mother Alien Fish's own death sequence, per direct spec — "have the
    // boss exploded and turn into a bunch of green and blue science (ignore
    // the bubble cap at this point so it will spawn a bunch of science)."
    // Pushed directly rather than through the usual canSpawnMore*/Bubble-Cap
    // checks every OTHER science-producing site respects, since the spec
    // explicitly calls out ignoring the cap here. Doesn't fall through to
    // the ordinary alien death bookkeeping below (dnaYield is 0 anyway,
    // aliensKilledCount deliberately doesn't count the boss — the end-game
    // stats modal reports defeating it as its own separate highlight
    // instead — see main.js's showGameOverModal).
    if (alien.isBoss) {
      for (let i = 0; i < BOSS_DEATH_SCIENCE_COUNT; i++) {
        const jitterX = alien.x + (Math.random() - 0.5) * alien.radius * 2;
        const jitterY = alien.y + (Math.random() - 0.5) * alien.radius * 2;
        state.level.items.push(createScience(jitterX, jitterY));
      }
      for (let i = 0; i < BOSS_DEATH_SCIENCE_GREEN_COUNT; i++) {
        const jitterX = alien.x + (Math.random() - 0.5) * alien.radius * 2;
        const jitterY = alien.y + (Math.random() - 0.5) * alien.radius * 2;
        state.level.items.push(createScienceGreen(jitterX, jitterY));
      }
      // Picked up by main.js's updateBossSequence to start the
      // "slowly fade in a game over modal" countdown — see
      // Config.js's BOSS_DEFEATED_MODAL_DELAY_MS.
      state.level.bossDefeatedAtMs = state.level.elapsed;
      return false;
    }
    // Dynamic Alien Archetypes: drops alien.dnaYield separate, discrete
    // alien_dna items (a Tier 5's "bulk/dense" yield reads as a genuine
    // shower of items, not one item carrying a hidden value field) — same
    // "loop and push N physical items" pattern the Science Octopus's own
    // multi-bubble brew already uses, each nudged a few px apart so they
    // don't all spawn on the exact same point. Capped by
    // canSpawnMoreAlienDna (see Config.js's ALIEN_DNA_MAX_ON_SCREEN) the
    // same "silent performance safety valve" way canSpawnMoreWaste already
    // protects against a neglected-tank item pile-up.
    for (let i = 0; i < alien.dnaYield; i++) {
      if (!canSpawnMoreAlienDna(state)) break;
      const jitterX = alien.x + (Math.random() - 0.5) * alien.radius * 1.5;
      const jitterY = alien.y + (Math.random() - 0.5) * alien.radius * 1.5;
      state.level.items.push(createAlienDna(jitterX, jitterY));
    }
    state.level.aliensKilledCount += 1; // end-game stats modal only — see main.js's showGameOverModal
    // The very first alien ever killed triggers the turret tutorial's own
    // cinematic setup, per direct spec ("right after they kill the first
    // alien, another one instantly spawns, and 1 second later it triggers
    // the turret tutorial... so you instantly see the benefits of the
    // turret"): a fresh Tier-1 alien is queued (pendingTurretTutorialAlienSpawns
    // — same array-mutation-during-filter workaround pendingBossMinionSpawns
    // already uses, since this runs inside updateEntities' own
    // entities.filter callback) and `turretTutorialAlienAppearedAtMs` is set
    // the instant it's actually flushed into a real entity, below — Systems.js's
    // updateTurretTutorialTrigger starts the 'postalien' flow
    // TURRET_TUTORIAL_DELAY_MS after that.
    if (state.level.firstAlienKilledAtMs === null) {
      state.level.firstAlienKilledAtMs = state.level.elapsed;
      const archetype = ALIEN_ARCHETYPES[0]; // Tier 1 — same gentle intro tier the very first wave's own lone alien already uses
      pendingTurretTutorialAlienSpawns.push({
        x: FISH_MIN_X + Math.random() * (FISH_MAX_X - FISH_MIN_X),
        y: FISH_MIN_Y + Math.random() * (SEABED_FLOOR_Y * 0.7 - FISH_MIN_Y),
        hp: archetype.hpMin + Math.floor(Math.random() * (archetype.hpMax - archetype.hpMin + 1)),
        archetypeId: archetype.id,
      });
    }
    // Per direct request ("so you don't accidentally place 4 food after
    // killing a fish"): Food can't be placed for ALIEN_FOOD_BLOCK_DURATION_MS
    // within what was the alien's own clickable radius — a rapid-click kill
    // very often ends with a couple of leftover clicks landing right where
    // the alien just was, which used to plant a small cluster of unwanted
    // Food pellets there. See trySpawnFood's isInAlienFoodBlockZone check;
    // expired zones are lazily filtered out there rather than aged every
    // tick, since nothing else ever needs to read this list.
    state.level.alienFoodBlockZones.push({ x: alien.x, y: alien.y, expiresAtMs: state.level.elapsed + ALIEN_FOOD_BLOCK_DURATION_MS });
    return false;
  }
  // Frozen in place for the whole duration of the turret tutorial (its full
  // 'postalien' walkthrough AND the standalone 'wastedrag' fallback) — per
  // direct request ("make sure the alien and everything is paused during
  // the turret tutorial"). Placed after the hp<=0 death branch above (so a
  // kill still processes normally if it somehow happens) but before
  // everything else — no movement, no attacking, no poop timer — so the
  // demo alien sits still as a safe, guaranteed target until the player
  // actually finishes arming the turret on it.
  const tutorialFlow = state.level.tutorialFlow;
  if (tutorialFlow && (tutorialFlow.id === 'postalien' || tutorialFlow.id === 'wastedrag')) return true;
  const dt = dtMs / 1000;

  if (alien.hitFlashMs > 0) alien.hitFlashMs = Math.max(0, alien.hitFlashMs - dtMs);

  // Alien-Egg hatch: a freshly-hatched alien that started inside the seabed
  // city rises straight up at a slow, fixed speed until it clears the
  // surface, per direct spec ("have it slowly swim up... when it first
  // spawns") — completely overrides wander/chase/eat/poop for as long as
  // this is true, since the normal SEABED_FLOOR_Y clamp further down would
  // otherwise snap it up to the boundary INSTANTLY the very first tick
  // (fine for a wave-spawned alien, which is never placed below that line in
  // the first place, but would defeat the whole point of a visible slow
  // ascent here).
  if (alien.risingToSurface) {
    alien.vx = 0;
    alien.vy = -ALIEN_EGG_RISE_SPEED;
    alien.y += alien.vy * dt;
    if (alien.y <= SEABED_FLOOR_Y) {
      alien.y = SEABED_FLOOR_Y;
      alien.risingToSurface = false;
    }
    return true;
  }

  alien.wanderTimer -= dt;
  if (alien.wanderTimer <= 0) {
    alien.wanderTimer = ALIEN_WANDER_INTERVAL_MIN_S + Math.random() * (ALIEN_WANDER_INTERVAL_MAX_S - ALIEN_WANDER_INTERVAL_MIN_S);
    const targetFish = Math.random() < ALIEN_CHASE_CHANCE
      ? findNearestFishWithin(state.level.entities, alien.x, alien.y, ALIEN_AWARENESS_RADIUS)
      : null;
    // Narrowed from ±0.35*PI (63°) to ±0.2*PI (36°) per direct report that
    // aliens didn't read as drawn to fish at all — a wide wobble on top of
    // an already-infrequent chase roll made the bias nearly invisible; still
    // enough spread to stay "kinda dumb," not a dead-on lock.
    const angle = targetFish
      ? Math.atan2(targetFish.y - alien.y, targetFish.x - alien.x) + (Math.random() - 0.5) * (Math.PI * 0.4)
      : Math.random() * Math.PI * 2;
    alien.vx = Math.cos(angle) * alien.speed;
    alien.vy = Math.sin(angle) * alien.speed * FISH_VERTICAL_DAMPING;
  }

  // Per direct request ("make it so aliens will go towards food only if
  // it's close to them and eat the food") — a much tighter radius than
  // ALIEN_AWARENESS_RADIUS (which governs fish-chasing), checked fresh every
  // tick (not just on a wander re-roll) so an alien can react the instant
  // Food drifts genuinely close. Overrides whatever heading wander just
  // picked above — an opportunistic snack takes priority over wandering,
  // but only ever when Food is actually nearby.
  const nearbyFood = findNearestFood(state.level.items, alien.x, alien.y);
  if (nearbyFood && Math.hypot(nearbyFood.x - alien.x, nearbyFood.y - alien.y) <= ALIEN_FOOD_AWARENESS_RADIUS) {
    const dx = nearbyFood.x - alien.x;
    const dy = nearbyFood.y - alien.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist <= alien.radius + FOOD_RADIUS) {
      const idx = state.level.items.indexOf(nearbyFood);
      if (idx !== -1) state.level.items.splice(idx, 1);
    } else {
      alien.vx = (dx / dist) * alien.speed;
      alien.vy = (dy / dist) * alien.speed * FISH_VERTICAL_DAMPING;
    }
  }

  alien.x += alien.vx * dt;
  alien.y += alien.vy * dt;

  if (alien.x < FISH_MIN_X) { alien.x = FISH_MIN_X; alien.vx = Math.abs(alien.vx); }
  if (alien.x > FISH_MAX_X) { alien.x = FISH_MAX_X; alien.vx = -Math.abs(alien.vx); }
  if (alien.y < FISH_MIN_Y) { alien.y = FISH_MIN_Y; alien.vy = Math.abs(alien.vy); }
  if (alien.y > SEABED_FLOOR_Y) { alien.y = SEABED_FLOOR_Y; alien.vy = -Math.abs(alien.vy); } // aliens can't swim into the seabed city either, same rule as fish

  // Mother Alien Fish only — "spawns extra aliens out of its mouth every
  // couple seconds," per direct spec. Queued into pendingBossMinionSpawns
  // (see that array's own comment) rather than pushed directly into
  // state.level.entities, since this runs from inside updateEntities' own
  // entities.filter(...) callback. Still respects ALIEN_MAX_ALIVE (counting
  // both already-alive aliens and any of THIS tick's own queued-but-not-yet-
  // flushed minions, so a fast timer can't sneak a burst past the cap).
  if (alien.isBoss) {
    alien.minionSpawnTimerMs += dtMs;
    if (alien.minionSpawnTimerMs >= BOSS_MINION_SPAWN_INTERVAL_MS) {
      alien.minionSpawnTimerMs -= BOSS_MINION_SPAWN_INTERVAL_MS;
      const aliveCount = state.level.entities.reduce((n, e) => n + (e.type === 'alien' && e.hp > 0 ? 1 : 0), 0);
      const room = Math.max(0, ALIEN_MAX_ALIVE - aliveCount - pendingBossMinionSpawns.length);
      const spawnCount = Math.min(BOSS_MINION_SPAWN_COUNT, room);
      for (let i = 0; i < spawnCount; i++) {
        const archetype = ALIEN_ARCHETYPES[Math.floor(Math.random() * 2)]; // Tier 1 or 2 minions only, never as tough as the boss itself
        const hp = archetype.hpMin + Math.floor(Math.random() * (archetype.hpMax - archetype.hpMin + 1));
        pendingBossMinionSpawns.push({
          x: alien.x + (Math.random() - 0.5) * alien.radius,
          y: alien.y + (Math.random() - 0.5) * alien.radius,
          hp, archetypeId: archetype.id,
        });
      }
    }
  }

  // Alien-Egg hatch grace period — per direct spec, a freshly-hatched alien
  // doesn't produce Waste for its first ALIEN_EGG_HATCH_INVULN_MS. Its
  // poopTimer still accumulates underneath (not reset/paused), so it doesn't
  // immediately spawn a burst of Waste the instant protection lapses.
  const stillProtected = alien.spawnProtectionUntilMs > state.level.elapsed;
  alien.poopTimer += dtMs;
  if (!stillProtected && alien.poopTimer >= ALIEN_POOP_INTERVAL_MS) {
    alien.poopTimer = 0;
    // canSpawnMoreWaste: see Config.js's WASTE_MAX_ON_SCREEN — this is the
    // single biggest source of runaway item counts (up to ALIEN_MAX_ALIVE
    // aliens all pooping every couple seconds, indefinitely, if left
    // unfought), so it's the most important of the 4 call sites this cap
    // gates.
    if (canSpawnMoreWaste(state)) {
      state.level.items.push(createWaste(alien.x, alien.y));
      adjustCleanliness(state, -CLEANLINESS_PER_WASTE_EVENT);
    }
  }

  return true;
}

function stageIndexForFeeds(speciesDef, totalFeeds) {
  let idx = 0;
  for (let i = 0; i < speciesDef.growthStages.length; i++) {
    if (totalFeeds >= speciesDef.growthStages[i].feedsRequired) idx = i;
  }
  return idx;
}

// def.swimSpeed alone is the un-upgraded baseline (already reduced by
// FISH_MOVEMENT_UPGRADE_SPEED_BONUS in Config.js's SPECIES table) — this
// applies the currently-purchased Fish Movement Tank Upgrade level live, so
// buying a level speeds up every fish already in the tank immediately, not
// just future spawns. Read wherever swimSpeed drives actual movement.
function effectiveSwimSpeed(def, state) {
  return (def.swimSpeed + FISH_MOVEMENT_UPGRADE_SPEED_BONUS * state.level.upgrades.fishMovement) * FISH_SPEED_MULTIPLIER;
}

export function createFish(speciesId, x, y, state, { grown = false, starTier = 1, dropValueOverride = null } = {}) {
  const def = SPECIES[speciesId];
  const totalFeeds = grown ? def.growthStages[def.growthStages.length - 1].feedsRequired : 0;
  const speed = effectiveSwimSpeed(def, state);
  return {
    id: nextId(),
    type: 'fish',
    speciesId,
    x,
    y,
    vx: (Math.random() * 2 - 1) * speed,
    vy: (Math.random() * 2 - 1) * speed * FISH_VERTICAL_DAMPING,
    hunger: grown ? 20 : 40,
    totalFeeds,
    stage: stageIndexForFeeds(def, totalFeeds),
    dropTimer: 0,
    poopTimer: 0, // WASTE_POOP_INTERVAL_MS — a non-Scavenger fish poops out Waste directly on this timer, see updateFish
    eatCooldownRemainingMs: 0, // Scavenger only — see updateFish's SCAVENGER eat branch; a growth-stage's dropInterval is reused as the eat cooldown
    distanceAccumPx: 0, // pure-Generator only — pixels swum since the last MW produced, see updateFish's GENERATOR branch
    powerTextAccumMw: 0, // pure-Generator only — MW banked toward the next once-per-second floating text, see updateFish's GENERATOR branch
    powerTextTimerMs: 0, // pure-Generator only — counts up to 1000ms before flushing powerTextAccumMw into a floating text
    researchTickIndex: 0, // pure-Researcher only — which tenth of the current brew cycle's "+0.1" progress bubbles have already fired, see updateFish's RESEARCHER branch
    hungerCriticalSfxPlayed: false, // plays playHunger() once per crossing into HUNGER_CRITICAL_THRESHOLD, reset once hunger drops back below it (e.g. after eating) — see updateFish
    alienNearby: false, // recomputed every tick in updateFish — true while a living alien is within ALIEN_INCOME_BLOCK_RADIUS, driving both the coin-production block and the continuous gray tint (main.js's render)
    capBlockedTintRemainingMs: 0, // counts down from FISH_BLOCKED_TINT_MS whenever a coin drop is blocked by the Coin Cap — the OTHER (timed) source of the gray tint, see triggerProductionBlocked
    mutagenBuffActive: false, // Adult-only Mutagen Paste buff — see updateFish's eat branch; cleared once hunger crosses back into HUNGER_CRITICAL_THRESHOLD
    magnetOn: false, // Buffer Fish only — toggled by clicking the fish (main.js's click handler); pulls nearby Waste toward it while true, see computeBufferFishMagnetForce
    linkedBuildingKey: null, // Catalyst Fish only — the "row,col" buildingData key it's currently linked to, or null; set by main.js's catalyst link-click flow, read by Grid.js's getCatalystSpeedMultiplier
    autoFoodOn: false, // Feeder Fish only — toggled by clicking the fish; while true, dispenses a real Food item every ELECTRIC_SUCKER_FOOD_INTERVAL_MS with no feeding required (and generates no power meanwhile — see updateFish's isPureGenerator branch) — see updateFish's own dedicated timer block
    autoFoodTimerMs: 0, // Feeder Fish only — counts up toward ELECTRIC_SUCKER_FOOD_INTERVAL_MS, only while autoFoodOn is true
    alienDnaModeOn: false, // Xeno Octopus only — toggled by clicking the fish; while true, replaces the normal Science brew cycle with a fixed SCIENCE_ALIEN_DNA_INTERVAL_MS timer producing Bio-Sludge instead — see updateFish's isPureResearcher branch
    wanderTimer: 0,
    tailPhase: 0, // only rendered once fully grown; advances faster the faster the fish is currently moving
    // Economy Fish Combining (Tier 2) — see CLAUDE.md's "Economy Fish
    // Combining/Splicing" section. starTier only ever exceeds 1 on an economy
    // species fish produced by combineFish() below (always already Adult);
    // every other fish (freshly bought, cheat-spawned, non-economy species)
    // stays at the default 1, which is a no-op multiplier everywhere it's read.
    starTier,
    // Set only by createHybridFish()'s value-carry-over pipeline — when
    // present, updateFish uses this directly instead of the species row's
    // static dropValue (which would otherwise ignore whatever star tier the
    // economy parent had reached before being spliced). null for every
    // ordinary fish.
    dropValueOverride,
    // Per direct request, a fish shimmers/gleams the moment it's created —
    // covers a freshly purchased-and-placed fish AND a combine/splice
    // result, since combineFish/createHybridFish both create the new fish
    // through this exact function, one choke point for all of it. Also
    // (re)set on a growth-stage transition — see updateFish. Read by
    // main.js's render loop via Shimmer.js's oneShotShimmerProgress;
    // state.level.elapsed is always defined by the time any fish is ever
    // created (level load seeds it to 0 first).
    shimmerStartedAt: state.level.elapsed,
  };
}

// Coin/Science Cap: how many of that item type may exist in state.level.items
// at once — counts EVERY item of the type anywhere in the tank, seabed city
// included, since the whole point is "how many currently-unbanked drops
// exist in the world," not "how many are still reachable by a fish." Checked
// by updateFish right before a coin/Science Bubble would spawn — see
// triggerProductionBlocked below for what happens when the cap's already
// been hit. (Food has no equivalent cap or HUD readout any more — both were
// retired per direct request, the cap replaced entirely by the
// stationary-to-Waste mechanic in updateFood below.)
export function countTankItemsByType(state, type) {
  let n = 0;
  for (const item of state.level.items) {
    if (item.type === type) n++;
  }
  return n;
}

// Blimp-Battery's battery role — summed fresh each call (same "no separate
// bookkeeping to keep in sync" pattern as getBuildingCost/
// countLivingFishOfSpecies elsewhere) from every LIVING one's own
// current capacity, which is higher while its own mutagenBuffActive is true
// ("a temporary battery boost to 2GW for the fish while it's fed" — per
// spec, the boost is per-fish, not a tank-wide flag). Called once per real
// second from main.js's power-sampling block.
export function computeEelBlimpBatteryCapacityMw(state) {
  let total = 0;
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish' || entity.speciesId !== 'eel_blimp') continue;
    total += entity.mutagenBuffActive ? EEL_BLIMP_BATTERY_CAPACITY_MUTAGEN_MW : EEL_BLIMP_BATTERY_CAPACITY_MW;
  }
  return total;
}

// A silent safety cap on total Waste in the world — see Config.js's
// WASTE_MAX_ON_SCREEN for the full performance-bug rationale. Checked at
// every Waste-spawning call site (fish poop, alien poop, the Collector/
// Processor byproduct, food rotting into Waste) — deliberately no
// player-facing feedback when it blocks a spawn, unlike the Coin/Science
// caps, since this exists purely to keep item counts (and so
// Grid.js's O(n²) resolveItemCollisions) bounded, not as a mechanic.
function canSpawnMoreWaste(state) {
  return countTankItemsByType(state, 'waste') < WASTE_MAX_ON_SCREEN;
}

// Same silent safety-cap precedent as canSpawnMoreWaste above, for the two
// Weight-Class-5 Bio-chain items — alien_dna in particular can arrive in
// bursts (several aliens dying in a short window, each dropping a
// multi-item yield), so it gets the identical protection.
function canSpawnMoreAlienDna(state) {
  return countTankItemsByType(state, 'alien_dna') < ALIEN_DNA_MAX_ON_SCREEN;
}
function canSpawnMoreBiomass(state) {
  return countTankItemsByType(state, 'biomass') < BIOMASS_MAX_ON_SCREEN;
}

// Coin Cap Tank Upgrade — state.level.upgrades.coinCapLevel indexes straight
// into COIN_CAP_BY_LEVEL (an array of absolute values, not a base+increment
// formula, since the requested progression — 10/25/50/100/250/500 — isn't an
// even arithmetic step).
export function effectiveCoinCapacity(state) {
  return COIN_CAP_BY_LEVEL[state.level.upgrades.coinCapLevel];
}

// Science Cap — bought in the Science Lab instead of as a Tank Upgrade (see
// UI.js's Lab modal), but reads the exact same way.
export function effectiveScienceCapacity(state) {
  return SCIENCE_CAP_BY_LEVEL[state.level.upgrades.scienceCapLevel];
}

// Per direct request ("make sure green science counts towards the bubble
// cap when on screen") — Green Science Bubbles now count against the exact
// same cap Blue Science does, not a separate unbounded pool. Used wherever
// "how much of the Bubble Cap is currently used" matters.
export function countScienceCapacityUsed(state) {
  return countTankItemsByType(state, 'science') + countTankItemsByType(state, 'science_green');
}

// Called the instant a fish's drop cycle completes but its resource is
// already at its active cap. `resource` is only ever 'coin' or 'science';
// only the coin case also arms the HUD's "shake red" cue
// (state.ui.coinCapFlashPending, read and cleared by UI.js's updateHUD next
// frame — Entities.js has no reason to import UI.js just for this one flag,
// so it's a plain state write, same as every other system-to-system signal
// in this codebase that isn't a direct function call) — per direct request,
// only the Coin HUD element shakes on a blocked coin, Science has no
// equivalent HUD-shake ask. Both resources now share the same "on fire,
// disintegrating" particle effect — per direct request ("instead of the
// bubble icon that shows up when the fish can't spawn coins, make it look
// like a coin on fire that disintegrates"), later extended to Science too
// ("use a science icon and do that animation when the science bubble cap is
// reached") — pushed into state.level.productionBlockedEffects (tagged with
// `resource` so main.js's render knows which icon to burn) and rendered/aged
// the same "detached particle, independent of the fish" way
// alienDeathEffects already is (see Config.js's
// PRODUCTION_BLOCKED_EFFECT_DURATION_MS, updateProductionBlockedEffects
// below, and main.js's render). The old muted "🫧" floatingText bubble
// Science used before this is gone entirely.
function triggerProductionBlocked(state, fish, stageDef, resource) {
  state.level.productionBlockedEffects.push({
    x: fish.x, y: fish.y - FISH_BASE_SIZE * stageDef.scale * 0.6, age: 0, resource,
  });
  playProductionBlocked();
  if (resource === 'coin') state.ui.coinCapFlashPending = true;
  // Per direct request, a fish also flashes gray for exactly
  // FISH_BLOCKED_TINT_MS the moment a drop is blocked by its cap — the same
  // visual cue an alien blocking production continuously uses (see
  // fish.alienNearby), just timed instead of proximity-driven.
  fish.capBlockedTintRemainingMs = FISH_BLOCKED_TINT_MS;
}

const FOOD_ROT_WARNING_MESSAGE = "Careful now, food that's chilling too long rots into waste";

// One-shot tutorial nudge for the stationary-to-Waste mechanic — per direct
// request, fires the FIRST time either of two things happens: 5 Food items
// exist at once, or a pellet actually finishes rotting into Waste. Whichever
// comes first shows the message; the flag then blocks the other one from
// showing it again. Called from trySpawnFood (the count case) and updateFood
// (the actual-rot case) below.
function maybeWarnFoodRot(state) {
  if (state.level.tutorialFlags.foodRotWarningShown) return;
  state.level.tutorialFlags.foodRotWarningShown = true;
  pushStoryNotification(state, FOOD_ROT_WARNING_MESSAGE);
}

// Returns a reason string rather than a bare bool so callers can react
// differently to each failure — main.js flashes the money HUD red on
// 'no_money'. No capacity check any more — see the module comment above
// countTankItemsByType.
// Lazily prunes expired zones as a side effect of checking — cheap enough
// (at most a handful of zones ever exist at once, each living 1s) that a
// dedicated per-tick age/cull pass (like alienDeathEffects gets) isn't
// worth it; nothing else ever reads this array.
function isInAlienFoodBlockZone(state, x, y) {
  const zones = state.level.alienFoodBlockZones;
  const now = state.level.elapsed;
  state.level.alienFoodBlockZones = zones.filter((z) => z.expiresAtMs > now);
  const radius = ALIEN_RADIUS * ALIEN_CLICK_RADIUS_MULTIPLIER;
  return state.level.alienFoodBlockZones.some((z) => Math.hypot(z.x - x, z.y - y) <= radius);
}

export function trySpawnFood(state, x, y) {
  // Food can only be dropped in open water, never directly into the seabed
  // city — per direct request, after going back and forth on whether to
  // allow it for city-interaction purposes. Doesn't touch where Food ends
  // UP once it's fallen there naturally (still routes/rests on tiles as
  // normal) — only where a fresh pellet can be manually placed.
  if (y >= SEABED_FLOOR_Y) return 'in_city';
  if (isInAlienFoodBlockZone(state, x, y)) return 'alien_zone';
  if (state.level.money < FOOD_COST) return 'no_money';
  state.level.money -= FOOD_COST;
  state.level.items.push(createFood(x, y));
  state.level.foodPurchasedCount += 1; // end-game stats modal only — see main.js's showGameOverModal
  playFoodPlace();
  const foodCount = state.level.items.reduce((n, i) => n + (i.type === 'food' ? 1 : 0), 0);
  if (foodCount >= 5) maybeWarnFoodRot(state);
  return 'spawned';
}

const FIRST_FISH_BOUGHT_MESSAGE = "You bought your first fish! Please remember to feed it occasionally. It's not a decoration. Probably.";

// A purchased fish is now placed with a click, the same as a building —
// there's no separate "Buy" button/preview-window purchase step any more,
// per direct request. Same reason-string contract as trySpawnFood so
// main.js's click handler can react the same way (only flash something on
// the specific 'no_money' case, not silently no-op). Blocks placement inside
// the seabed city for the same reason Food does — a fish can never swim down
// there anyway (see updateFish's Y clamp), so dropping one there would just
// spawn it somewhere it immediately gets pushed out of.
export function trySpawnPurchasedFish(state, speciesId, x, y) {
  if (y >= SEABED_FLOOR_Y) return 'in_city';
  const cost = getFishPurchaseCost(state, speciesId);
  if (state.level.money < cost) return 'no_money';
  state.level.money -= cost;
  state.level.entities.push(createFish(speciesId, x, y, state, { grown: false }));
  playPurchase();
  if (!state.level.tutorialFlags.firstFishBought) {
    state.level.tutorialFlags.firstFishBought = true;
    pushStoryNotification(state, FIRST_FISH_BOUGHT_MESSAGE);
  }
  return 'spawned';
}

const MONEY_MILESTONE_1K_MESSAGE = '1k money? Bruh save some for the fishes';

// Routes every real in-play coin gain (click-banked or auto-Collected —
// NOT the starting endowment, NOT the bankruptcy bailout gift, see
// Systems.js) through one place so the lifetime-earned milestone check
// only needs to live in one spot. `state.level.money` itself still just
// tracks the current spendable balance, same as before — this adds a
// second, monotonically-increasing counter alongside it.
function bankMoney(state, amount) {
  state.level.money += amount;
  state.level.lifetimeMoneyEarned += amount;
  if (!state.level.tutorialFlags.moneyMilestone1k && state.level.lifetimeMoneyEarned >= MONEY_MILESTONE_1K) {
    state.level.tutorialFlags.moneyMilestone1k = true;
    const notifications = state.level.notifications;
    notifications.push({ id: notifications.length + 1, text: MONEY_MILESTONE_1K_MESSAGE, elapsed: state.level.elapsed });
    if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
  }
}

// Science's own banked resource — level-scoped like money (state.level.science),
// not state.meta, matching money's own scope now that Science is a real
// collected currency rather than a permanent meta counter. No lifetime/
// milestone tracking needed, unlike bankMoney — nothing currently reads one.
function bankScience(state, amount) {
  state.level.science += amount;
  state.level.lifetimeScienceEarned += amount; // end-game stats modal only — see main.js's showGameOverModal
}

// Green Science's own separate reserve (state.level.scienceGreen) — mirrors
// bankScience exactly, just a distinct pool so the Bio-Reactor's own
// scienceGreenCost purchases and the Bio-Combuster's upgraded recipe don't
// touch the blue Science total at all.
function bankScienceGreen(state, amount) {
  state.level.scienceGreen += amount;
  state.level.lifetimeScienceGreenEarned += amount; // end-game stats modal only — see main.js's showGameOverModal
}

export function tryBankScienceAt(state, worldX, worldY) {
  const items = state.level.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type !== 'science') continue;
    const dx = item.x - worldX;
    const dy = item.y - worldY;
    const clickRadius = item.radius * COIN_CLICK_RADIUS_MULTIPLIER;
    if (dx * dx + dy * dy <= clickRadius * clickRadius) {
      bankScience(state, 1);
      state.level.floatingTexts.push(createPickupText(item.x, item.y, '+1 🔬', SCIENCE_COLOR));
      items.splice(i, 1);
      return true;
    }
  }
  return false;
}

// Mirrors tryBankScienceAt exactly, for a green Science Bubble — per spec,
// green Science "must be routed into a Collector to increment green
// science storage," but nothing prohibits a plain click either, and every
// other physical resource in this game supports both, so this stays
// consistent with tryBankScienceAt rather than special-casing green Science
// as click-only-blocked.
export function tryBankScienceGreenAt(state, worldX, worldY) {
  const items = state.level.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type !== 'science_green') continue;
    const dx = item.x - worldX;
    const dy = item.y - worldY;
    const clickRadius = item.radius * COIN_CLICK_RADIUS_MULTIPLIER;
    if (dx * dx + dy * dy <= clickRadius * clickRadius) {
      bankScienceGreen(state, 1);
      state.level.floatingTexts.push(createPickupText(item.x, item.y, '+1 🔬', SCIENCE_GREEN_COLOR));
      items.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function tryBankCoinAt(state, worldX, worldY) {
  const items = state.level.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type !== 'coin') continue;
    const dx = item.x - worldX;
    const dy = item.y - worldY;
    const clickRadius = item.radius * COIN_CLICK_RADIUS_MULTIPLIER;
    if (dx * dx + dy * dy <= clickRadius * clickRadius) {
      bankMoney(state, item.value);
      playCoinBank();
      const color = getCoinColor(item.value);
      state.level.floatingTexts.push(createPickupText(item.x, item.y, `+$${item.value}`, color));
      items.splice(i, 1);
      return true;
    }
  }
  return false;
}

export function spawnFishCheat(state, speciesId, x, y, grown) {
  if (!SPECIES[speciesId]) return;
  state.level.entities.push(createFish(speciesId, x, y, state, { grown }));
}

// ---- Economy Fish Dynamic Purchase Cost (Tier 2) ----
// Current_Cost = base cost * (ECONOMY_FISH_COST_GROWTH_RATE ^ N), N = how
// many living fish of that EXACT species (any star tier) are currently in
// the tank — see Config.js's ECONOMY_FISH_COST_GROWTH_RATE. N is computed
// live off state.level.entities every call rather than tracked as a running
// counter, so a death/combine/purchase is reflected the instant it happens
// with no separate bookkeeping to keep in sync. The exact-id match is also
// what keeps a hybrid from ever counting toward its own parent species'
// scarcity — a Buffer Fish's speciesId is 'buffer_fish', never 'guppy', so
// it simply never matches here, satisfying "hybrid fish do not count
// towards the limit" with no extra filtering needed.
export function countLivingFishOfSpecies(state, speciesId) {
  let n = 0;
  for (const entity of state.level.entities) {
    if (entity.type === 'fish' && entity.speciesId === speciesId) n++;
  }
  return n;
}

// Dynamic pricing covers every id in DYNAMIC_PRICED_SPECIES_IDS — the 3
// economy species plus, per direct request, the 3 utility species too
// ("make sure all the utility fish also get more expensive with each fish
// on screen"). Hybrids were never purchasable in the shop to begin with
// (they're pulled from the buyable grid entirely — see UI.js's
// buildShopPanel), so this function is never even called for one; their
// SPECIES.cost is only ever read as-is by anything that still wants it.
// Halves the growth rate's own SCALING (the amount above 1.0), not the rate
// itself — per direct spec ("reduces the price scaling for fish to half the
// scaling amount it is now... 1.2x would make it 1.1x"), computed off
// whatever ECONOMY_FISH_COST_GROWTH_RATE actually is rather than a
// hardcoded second constant, so this stays correct if that base rate is
// ever retuned again. Applies the instant the Fish Scaling lab node is
// bought — getFishPurchaseCost (below) always reads it live, so it takes
// effect on every already-placed species' price immediately, no re-roll
// needed.
export function effectiveFishCostGrowthRate(state) {
  const scaling = ECONOMY_FISH_COST_GROWTH_RATE - 1;
  const hasFishScaling = state.meta.labUpgradesPurchased.includes(FISH_SCALING_LAB_ID);
  return 1 + (hasFishScaling ? scaling / 2 : scaling);
}

export function getFishPurchaseCost(state, speciesId) {
  const def = SPECIES[speciesId];
  if (!DYNAMIC_PRICED_SPECIES_IDS.includes(speciesId)) return def.cost;
  const n = countLivingFishOfSpecies(state, speciesId);
  return Math.round(def.cost * Math.pow(effectiveFishCostGrowthRate(state), n));
}

// ---- Economy Fish Combining/Splicing (Tier 2) ----
// Hit-tests state.level.entities for the nearest fish within
// FISH_DRAG_HIT_RADIUS_FRACTION of the fish's own current on-screen size —
// used by main.js's drag-to-combine mousedown/mouseup and its live
// hover-target check. `excludeId`, when given, skips that one fish entirely
// (the caller's own dragged fish — necessary once that fish's position is
// being snapped to the cursor each tick, otherwise it would always be its
// own nearest match and hide whatever it's actually hovering over).
export function findFishAt(state, worldX, worldY, excludeId = null) {
  let best = null;
  let bestDist = Infinity;
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish' || entity.id === excludeId) continue;
    const def = SPECIES[entity.speciesId];
    const size = FISH_BASE_SIZE * def.growthStages[entity.stage].scale;
    const hitRadius = size * FISH_DRAG_HIT_RADIUS_FRACTION;
    const dx = entity.x - worldX;
    const dy = entity.y - worldY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= hitRadius * hitRadius && d2 < bestDist) {
      bestDist = d2;
      best = entity;
    }
  }
  return best;
}

// The Pipette Tool ("Smart Copy") — per direct request, hovering a fish and
// pressing Q arms that exact species as the current tool, same as clicking
// its shop icon. Deliberately uses the FULL fish size as the hit radius
// (fraction 1.0), not findFishAt's own 0.6 (FISH_DRAG_HIT_RADIUS_FRACTION) —
// "give the fish an activation radius that's as big as the shimmer/shine
// effect, so it's easier to select a fish" — main.js's own shimmer clip
// circle around a fish is drawn at exactly this same unshrunk size.
export function findFishForPipetteAt(state, worldX, worldY) {
  let best = null;
  let bestDist = Infinity;
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish') continue;
    const def = SPECIES[entity.speciesId];
    const size = FISH_BASE_SIZE * def.growthStages[entity.stage].scale;
    const dx = entity.x - worldX;
    const dy = entity.y - worldY;
    const d2 = dx * dx + dy * dy;
    if (d2 <= size * size && d2 < bestDist) {
      bestDist = d2;
      best = entity;
    }
  }
  return best;
}

// Whether a fish is a legal SOURCE for starting a combine-drag — always
// available now, per direct request (the old fishMergingUnlocked Tank
// Upgrade gate is gone entirely): the fish just needs to be an economy
// species, Adult, and not already at the combining cap (a Tier-4 fish has
// nothing left to combine into).
export function isCombinableFish(state, fish) {
  if (!fish || fish.type !== 'fish') return false;
  if (!ECONOMY_SPECIES_IDS.includes(fish.speciesId)) return false;
  const def = SPECIES[fish.speciesId];
  if (fish.stage !== def.growthStages.length - 1) return false; // Adult only
  if ((fish.starTier || 1) >= FISH_STAR_TIER_MAX) return false;
  return true;
}

// Whether dropping `a` onto `b` (or vice versa) is a legal combine: both
// must independently qualify as combinable (see isCombinableFish), be two
// distinct entities, the exact same species, and the exact same star tier —
// per the design spec's prerequisite. Symmetric in a/b.
export function canCombineFish(state, a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (!isCombinableFish(state, a) || !isCombinableFish(state, b)) return false;
  if (a.speciesId !== b.speciesId) return false;
  if ((a.starTier || 1) !== (b.starTier || 1)) return false;
  return true;
}

const FIRST_COMBINE_MESSAGE =
  "You just smooshed two fish into one bigger, shinier fish. They're fine. Probably. It's basically fusion, and fusion is science, and science is great.";

// Consumes both fish and spawns one Adult fish of the next star tier at
// their midpoint — see Config.js's FISH_STAR_TIER_VALUE_MULTIPLIER for the
// resulting coin-value scaling (applied live in updateFish, not baked in
// here, since it's derived from starTier + the species' own adult
// dropValue every time a coin is dropped). Returns the new fish, or null if
// the pair isn't actually a legal combine (defensive — callers should
// already have checked canCombineFish).
export function combineFish(state, a, b) {
  if (!canCombineFish(state, a, b)) return null;
  const newTier = (a.starTier || 1) + 1;
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const speciesId = a.speciesId;

  const idxA = state.level.entities.indexOf(a);
  if (idxA !== -1) state.level.entities.splice(idxA, 1);
  const idxB = state.level.entities.indexOf(b);
  if (idxB !== -1) state.level.entities.splice(idxB, 1);

  const fish = createFish(speciesId, x, y, state, { grown: true, starTier: newTier });
  state.level.entities.push(fish);
  state.level.floatingTexts.push(
    createPickupText(x, y, `${newTier}★ ${SPECIES[speciesId].name}!`, FISH_STAR_COLOR)
  );
  if (!state.level.tutorialFlags.firstCombine) {
    state.level.tutorialFlags.firstCombine = true;
    pushStoryNotification(state, FIRST_COMBINE_MESSAGE);
  }
  return fish;
}

// ---- T5 Hybridization value carry-over pipeline ----
// The actual drag-a-utility-fish-onto-an-economy-fish interaction isn't
// built yet (Phase 4/5 scope — see CLAUDE.md's Species Roster &
// Progression). These two functions are the ready-to-call pipeline for when
// it is: getEconomyAdultDropValue resolves what a specific economy fish
// instance's coin drop is actually worth right now (its species' base adult
// dropValue, scaled by its current star tier — the same formula updateFish
// uses live), and createHybridFish spends an economy fish + a utility
// species id and produces the correct hybrid with that value carried over
// into dropValueOverride, rather than the hybrid SPECIES row's static
// placeholder dropValue.
export function getEconomyAdultDropValue(speciesId, starTier) {
  const def = SPECIES[speciesId];
  const adultDropValue = def.growthStages[def.growthStages.length - 1].dropValue;
  // Math.ceil — see updateFish's identical rounding for why: a higher star
  // tier's 1.5^N scaling rarely lands on a whole dollar.
  return Math.ceil(adultDropValue * Math.pow(FISH_STAR_TIER_VALUE_MULTIPLIER, (starTier || 1) - 1));
}

// Hybrid SPECIES rows store `parents: [utilitySpeciesId, economySpeciesId]`
// (see Config.js's Gene-Splicing hybrids) — reverse-looked-up here rather
// than hardcoding a second id map, so a future new hybrid row needs no
// change here.
export function getHybridSpeciesId(economySpeciesId, utilitySpeciesId) {
  for (const s of SPECIES_LIST) {
    if (s.parents && s.parents[0] === utilitySpeciesId && s.parents[1] === economySpeciesId) return s.id;
  }
  return null;
}

export function createHybridFish(state, economyFish, utilitySpeciesId) {
  const hybridId = getHybridSpeciesId(economyFish.speciesId, utilitySpeciesId);
  if (!hybridId) return null;
  const carriedValue = getEconomyAdultDropValue(economyFish.speciesId, economyFish.starTier || 1);
  const fish = createFish(hybridId, economyFish.x, economyFish.y, state, { grown: true, dropValueOverride: carriedValue });
  return fish;
}

// ---- Gene-Splicing drag interaction (Phase 4) ----
// The pipeline above (getHybridSpeciesId/createHybridFish) already existed
// as unwired scaffolding — this is what actually wires it up. Deliberately
// one-directional, same as combineFish's drag: `utilityFish` is always the
// one the player picks up and drags, `targetFish` is always the one it's
// dropped onto (mirrors main.js's Economy Fish Combining mousedown/mouseup,
// which now checks this alongside canCombineFish). A dragged fish that
// doesn't qualify as a splice source just isn't picked up in the first
// place — see main.js.

// Whether a fish is a legal splice-drag SOURCE — checked on mousedown,
// before any target is even known (mirrors isCombinableFish's role for the
// Economy Fish Combining drag). Any of the 3 utility species — but now,
// per direct request ("only the adults can be used for hybridization," now
// that utility fish actually grow up through stages instead of spawning
// pre-grown), the utility fish itself must also be Adult, same requirement
// canSpliceFish already places on the TARGET below.
//
// Gene-Splicing is a Science Lab purchase now, not a standalone Tank
// Upgrade flag — GENE_SPLICING_LAB_ID is only the tree's ROOT node (grants
// nothing by itself, see Config.js's SCIENCE_LAB_UPGRADES), so this is
// deliberately just a coarse "is this even a valid splice source shape at
// all" pre-check. The fine-grained "is THIS specific hybrid combination
// unlocked" check can't happen here — there's no target yet — so it lives
// in canSpliceFish below instead, once both fish are known.
//
// Per direct request, splicing is no longer gated behind a standalone
// "unlock splicing" purchase at all (the old gene_splicing root node is
// gone) — each of the 3 real hybrids now gates purely off its own flat
// Bubble Cap requirement in SCIENCE_LAB_UPGRADES, checked by canSpliceFish's
// own `speciesUnlocked.includes(hybridId)` line below. So a grown utility
// fish can always be PICKED UP as a potential splice source; whether the
// actual drop succeeds depends entirely on that per-pair check.
export function isSpliceSource(state, fish) {
  if (!fish || fish.type !== 'fish') return false;
  if (!UTILITY_SPECIES_IDS.includes(fish.speciesId)) return false;
  const def = SPECIES[fish.speciesId];
  return fish.stage === def.growthStages.length - 1;
}

export function canSpliceFish(state, utilityFish, targetFish) {
  if (!targetFish || !utilityFish || utilityFish.id === targetFish.id) return false;
  if (!isSpliceSource(state, utilityFish) || targetFish.type !== 'fish') return false;
  const targetDef = SPECIES[targetFish.speciesId];
  // Splicing requires an adult target — see CLAUDE.md's Gene-Splicing note:
  // a feeder-based hybrid's carried-over coin value is read off the
  // target's own adult dropValue, so a hatchling/juvenile target has
  // nothing meaningful to carry over yet.
  if (targetFish.stage !== targetDef.growthStages.length - 1) return false;
  const hybridId = getHybridSpeciesId(targetFish.speciesId, utilityFish.speciesId);
  if (!hybridId) return false;
  // Each of the 3 hybrids is its own individual Science Lab purchase (see
  // SCIENCE_LAB_UPGRADES' hybrid_buffer_fish/hybrid_eel_blimp/
  // hybrid_catalyst_fish nodes) — pushed into speciesUnlocked the exact same
  // way eel/suckerfish/octopus already are, so this is the one place that
  // actually needs to check, rather than a blanket "splicing exists" flag.
  return state.meta.speciesUnlocked.includes(hybridId);
}

const FIRST_SPLICE_MESSAGE =
  "Whoa, actual gene-splicing. Science says this is fine. Science has been wrong before, but let's not think about that too hard.";

// Consumes both fish (same as combineFish) and spawns the resulting hybrid
// at their midpoint. Returns the new fish, or null if the pair isn't
// actually a legal splice (defensive — callers should already have checked
// canSpliceFish).
export function spliceFish(state, utilityFish, targetFish) {
  if (!canSpliceFish(state, utilityFish, targetFish)) return null;
  const x = (utilityFish.x + targetFish.x) / 2;
  const y = (utilityFish.y + targetFish.y) / 2;
  const hybrid = createHybridFish(state, targetFish, utilityFish.speciesId);
  if (!hybrid) return null;
  hybrid.x = x;
  hybrid.y = y;

  const idxU = state.level.entities.indexOf(utilityFish);
  if (idxU !== -1) state.level.entities.splice(idxU, 1);
  const idxT = state.level.entities.indexOf(targetFish);
  if (idxT !== -1) state.level.entities.splice(idxT, 1);
  state.level.entities.push(hybrid);

  state.level.floatingTexts.push(createPickupText(x, y, 'Spliced!', TANK_POINT_COLOR));
  if (!state.level.tutorialFlags.firstSplice) {
    state.level.tutorialFlags.firstSplice = true;
    pushStoryNotification(state, FIRST_SPLICE_MESSAGE);
  }
  return hybrid;
}

// The first pair of two fish currently on screen that could legally be
// combined (or null) — per direct request, drives both the Merge tool's
// grayed-out/available state (via hasAnyMergeOpportunity below) and the
// first-time merge guided tutorial's trigger (Systems.js's
// updateMergeTutorialTrigger) and its target-pair spotlight (see
// resolveMergeTutorialPair below). O(n^2) over the fish on screen, same
// cost class as this game's other per-tick pairwise scans (e.g. Grid.js's
// item collision resolution) — the fish count is small enough this is
// never a real expense.
export function findCombinablePair(state) {
  const fish = state.level.entities.filter((e) => e.type === 'fish');
  for (let i = 0; i < fish.length; i++) {
    for (let j = i + 1; j < fish.length; j++) {
      if (canCombineFish(state, fish[i], fish[j])) return [fish[i], fish[j]];
    }
  }
  return null;
}

// Whether ANY two fish on screen could currently be combined OR spliced —
// the Merge tool handles both interactions, so its availability has to
// cover both, not just combining (see UI.js's isMergeToolAvailable).
export function hasAnyMergeOpportunity(state) {
  if (findCombinablePair(state)) return true;
  const fish = state.level.entities.filter((e) => e.type === 'fish');
  for (const a of fish) {
    for (const b of fish) {
      if (a.id !== b.id && canSpliceFish(state, a, b)) return true;
    }
  }
  return false;
}

// Resolves the two fish the first-time merge guided tutorial's "drag" step
// should spotlight — locks onto whichever pair `findCombinablePair` first
// found (state.level.mergeTutorialTargetIds, just the two fish ids) rather
// than re-picking fresh every frame, same "don't let a newly-eligible pair
// steal the spotlight mid-step" fix already applied to the waste-drag
// tutorial (see Grid.js's findNearestWasteTurretAndWaste for the identical
// reasoning). Falls back to a fresh pick if the locked pair is no longer
// valid (one of them merged with something else, died, etc.).
export function resolveMergeTutorialPair(state) {
  const ids = state.level.mergeTutorialTargetIds;
  if (ids) {
    const a = state.level.entities.find((e) => e.id === ids[0] && e.type === 'fish');
    const b = state.level.entities.find((e) => e.id === ids[1] && e.type === 'fish');
    if (a && b && canCombineFish(state, a, b)) return [a, b];
    state.level.mergeTutorialTargetIds = null;
  }
  const pair = findCombinablePair(state);
  if (pair) state.level.mergeTutorialTargetIds = [pair[0].id, pair[1].id];
  return pair;
}

// While item.y < SEABED_FLOOR_Y it's still in open water — gravity plus any
// active Fan force (Grid.js's computeFanForce/integrateItemForces, which
// apply everywhere, not just the seabed band). Once it crosses that
// boundary, Grid.js's stepItemOnGrid owns its motion for the rest of its
// life (tile collision, collectors, Auto-Feeder intake, item-item
// drift) — see Grid.js's module comment for why the
// split falls there, and CLAUDE.md's "Items can't stack, and can fall off
// the bottom" for why this now runs every tick forever instead of stopping
// once an item is first marked resting: resting is re-evaluated fresh every
// tick (there's no "settled, stop simulating" state any more), so an item
// that's knocked off whatever it was resting on by resolveItemCollisions
// picks the fall back up on its very next step, the same as if a tile had
// been removed out from under it.
// Per direct request ("make the sides act as walls preventing items from
// leaving or falling") — now that the world is a single fixed screen width
// with no horizontal camera panning at all (see Engine.js's updateCamera),
// an item drifting past either edge would scroll off to where the player
// could never see or reach it again. The seabed band already can't be
// crossed horizontally (Grid.js's tileAt reads any out-of-column tile as a
// solid BOUNDARY_WALL sentinel); open water has no tile grid to bound it the
// same way, so this is the equivalent for it — called from each item type's
// own per-tick open-water branch, right after integrating vx/vy. Clamps to
// the item's own radius in from each edge (reads as bumping the glass, not
// overlapping it) and zeroes the offending velocity component once it does,
// so a Fan/sway/throw push doesn't keep reapplying against a wall it can't
// cross. The TOP edge (y=0) got the identical treatment per a later direct
// request ("make the top of the tank a hard barrier like the other 3
// sides") — a strong enough Fan/Turbo Fan push, or a hard upward throw via
// the item-drag mechanic, could otherwise carry an item above the world
// entirely, same unreachable-forever problem the side walls already solved.
// The BOTTOM edge doesn't need an equivalent here: this function only ever
// runs from the open-water branch (item.y < SEABED_FLOOR_Y, well above
// WORLD_H), and once an item crosses into the seabed band, Grid.js's
// sweepVertical already hard-stops it at WORLD_H unconditionally.
function clampItemToWorldWalls(item) {
  const margin = item.radius || 0;
  if (item.x < margin) {
    item.x = margin;
    if (item.vx < 0) item.vx = 0;
  } else if (item.x > WORLD_W - margin) {
    item.x = WORLD_W - margin;
    if (item.vx > 0) item.vx = 0;
  }
  if (item.y < margin) {
    item.y = margin;
    if (item.vy < 0) item.vy = 0;
  }
}

function updateFood(item, state, dtMs) {
  const dt = dtMs / 1000;
  // Food Quality Tank Upgrade: each purchased level sinks 5% slower (both
  // the acceleration and the terminal velocity scale down together, so the
  // whole fall profile shrinks rather than just capping speed later).
  const sinkMultiplier = 1 - FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL * state.level.upgrades.foodQuality;
  const gravity = FOOD_GRAVITY * sinkMultiplier;
  const maxFallSpeed = FOOD_MAX_FALL_SPEED * sinkMultiplier;
  const physics = { gravity, maxFallSpeed };
  if (item.y < SEABED_FLOOR_Y) {
    // Fan force applies everywhere, not just the seabed band — see Grid.js's
    // computeFanForce/integrateItemForces. The continuous sway is a
    // separate flavor effect layered on top of (not replacing) the physics
    // vx, so a Fan-launched pellet still wavers a little as it rises/falls.
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.fallTime += dt;
    const swayVx = currentSwayVx(item, FOOD_SWAY_AMPLITUDE, FOOD_SWAY_FREQUENCY, FOOD_SWAY_ENVELOPE_FREQUENCY);
    item.x += (item.vx + swayVx) * dt;
    item.y += item.vy * dt;
    clampItemToWorldWalls(item);
  } else {
    const status = stepItemOnGrid(item, state, dt, physics);
    if (status === 'consumed') {
      // A Processor only ever accepts coins/Science now (Grid.js's
      // updateBuildings), so Food can no longer actually reach this branch —
      // left in place defensively rather than removed, same as any other
      // status this switch already handles.
      state.level.gridStats.itemsRoutedTotal += 1;
      return false;
    }
  }

  // Stationary-to-Waste: per direct request, replacing the old capacity cap
  // (FOOD_MAX_ON_SCREEN_BASE/the Food Capacity Tank Upgrade, both retired)
  // entirely — instead of limiting how much food can exist at once, a
  // pellet that's gone FOOD_STATIONARY_TO_WASTE_MS (20s) without moving more
  // than FOOD_STATIONARY_MOVE_TOLERANCE_PX from where it last genuinely
  // moved turns into a real Waste item at its own position, rather than
  // just despawning — an ignored pellet still costs the player something
  // (a bit of cleanliness) instead of evaporating for free. Position-based,
  // not velocity-based, so "moves within that window restarts the
  // countdown" falls out naturally: a Fan visibly wobbling a held pellet
  // keeps resetting its own origin every tick it actually sways, the same
  // as if the player had nudged it themselves; only something genuinely
  // motionless (typically resting untouched on a tile) ever finishes the
  // countdown. Pushes into pendingFoodToWasteSpawns rather than
  // state.level.items directly — this function runs inside
  // updateEntities' state.level.items.filter(...), so a direct push here
  // wouldn't be captured by that filter's own result (see updateEntities'
  // own foodSpawnPoints/wasteSpawnPoints for the identical reason/pattern).
  const movedPx = Math.hypot(item.x - item.stationaryOriginX, item.y - item.stationaryOriginY);
  if (movedPx > FOOD_STATIONARY_MOVE_TOLERANCE_PX) {
    item.stationaryOriginX = item.x;
    item.stationaryOriginY = item.y;
    item.stationaryTimer = 0;
  } else {
    item.stationaryTimer += dtMs;
    if (item.stationaryTimer >= FOOD_STATIONARY_TO_WASTE_MS) {
      pendingFoodToWasteSpawns.push({ x: item.x, y: item.y });
      maybeWarnFoodRot(state); // the other half of the one-shot gate above — see its own comment
      return false;
    }
  }
  return true;
}

function updateCoin(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    // Fan force applies everywhere, not just the seabed band — see Grid.js's
    // computeFanForce/integrateItemForces. A coin's high mass means it needs
    // strong or overlapping fan coverage to actually clear a ledge.
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') {
    bankMoney(state, item.value);
    playCoinBank();
    state.level.floatingTexts.push(createPickupText(item.x, item.y, `+$${item.value}`, getCoinColor(item.value)));
    state.level.gridStats.itemsRoutedTotal += 1;
    // The Collector no longer produces any Waste byproduct at all, on any
    // tier — per direct request, banking a coin here is now completely
    // clean (see PROCESSOR_STATS' own comment in Config.js).
    return false;
  }
  item.resting = status === 'resting'; // informational only — re-evaluated fresh every tick, doesn't stop future physics
  return true;
}

// Mirrors updateCoin exactly (straight gravity, no sway, Fan-pushable via
// its own heavy mass) — the only differences are what 'consumed' pays out
// (Science, not money) and that it has no per-item value tier to read.
function updateScience(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') {
    bankScience(state, 1);
    state.level.floatingTexts.push(createPickupText(item.x, item.y, '+1 🔬', SCIENCE_COLOR));
    state.level.gridStats.itemsRoutedTotal += 1;
    playDispense(); // a Processor finishing a Science Bubble's hold — the coin equivalent already has its own playCoinBank blip, so this is the "output" sound that path was missing
    return false;
  }
  item.resting = status === 'resting';
  return true;
}

// Waste has no click-bank and nothing consumes it yet (Phase 3) — it just
// falls/routes like a coin and piles up wherever it lands. If it does reach
// a Collector, it's silently removed with no money and no further waste
// spawned (no waste-spawns-waste loop).
// Buffer Fish's click-toggled magnet (fish.magnetOn) — sums an attraction
// force from every living, magnet-ON Buffer Fish within
// BUFFER_FISH_MAGNET_RADIUS, same linear-falloff-to-0-at-range shape a Fan's
// own cone force already uses (see Grid.js's computeFanForce), just radial
// (pulling straight toward the fish) rather than a fixed-direction cone.
// Waste-only, and open-water-only — a Buffer Fish can never swim into the
// seabed city any more than any other fish can, so Waste that's already
// settled down there is just as unreachable to this as to a normal
// Suckerfish eating it directly. Returns the same { fx, fy } shape
// computeFanForce does so the two can be summed before integrateItemForces.
function computeBufferFishMagnetForce(state, item) {
  let fx = 0;
  let fy = 0;
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish' || entity.speciesId !== 'buffer_fish' || !entity.magnetOn) continue;
    const dx = entity.x - item.x;
    const dy = entity.y - item.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0 || dist > BUFFER_FISH_MAGNET_RADIUS) continue;
    const magnitude = BUFFER_FISH_MAGNET_FORCE * (1 - dist / BUFFER_FISH_MAGNET_RADIUS);
    fx += (dx / dist) * magnitude;
    fy += (dy / dist) * magnitude;
  }
  return { fx, fy };
}

function updateWaste(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: WASTE_GRAVITY, maxFallSpeed: WASTE_MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    const magnetForce = computeBufferFishMagnetForce(state, item);
    const totalForce = { fx: fanForce.fx + magnetForce.fx, fy: fanForce.fy + magnetForce.fy };
    integrateItemForces(item, dt, physics, totalForce);
    item.fallTime += dt;
    const swayVx = currentSwayVx(item, WASTE_SWAY_AMPLITUDE, WASTE_SWAY_FREQUENCY, FOOD_SWAY_ENVELOPE_FREQUENCY);
    item.y += item.vy * dt;
    item.x += (item.vx + swayVx) * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') return false;
  item.resting = status === 'resting';
  return true;
}

// alien_dna and biomass — Weight Class 5 (Heavy), same straight-gravity fall
// as a coin (no sway — a Class 5 item is dense/heavy, not a light drifting
// flavor item like Food/Waste). Neither is ever click-bankable and neither
// is a valid Collector intake (Grid.js's Collector scan only ever looks for
// coin/science/science_green) — the ONLY way either is ever removed from
// state.level.items is Grid.js's Refinery/Bio-Feeder/Bio-Combuster/
// Bio-Reactor intake scans directly splicing it out (same pattern the
// Auto-Feeder/Turret-ammo intakes already use), so the 'consumed' check
// below is purely defensive, matching updateWaste's own identical guard.
function updateAlienDna(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') return false;
  item.resting = status === 'resting';
  return true;
}

function updateBiomass(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') return false;
  item.resting = status === 'resting';
  return true;
}

// The Manufacturer's Alien Egg recipe output — see createAlienEgg. Falls/
// routes/drags exactly like a coin (Class 3), but also counts up its own
// hatchTimer every tick regardless of resting state; once it crosses
// ALIEN_EGG_HATCH_MS it hatches into a real, live Tier-1 alien at its
// current position instead of continuing as an item — spliced out of
// state.level.items (return false) the same tick the alien is pushed into
// state.level.entities. See Config.js's ALIEN_EGG_HATCH_MS/
// _HATCH_INVULN_MS/_RISE_SPEED for the exact numbers/rationale.
function updateAlienEgg(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
  } else {
    const status = stepItemOnGrid(item, state, dt, physics);
    if (status === 'consumed') return false; // defensive — nothing currently consumes a raw egg via a building intake
    item.resting = status === 'resting';
  }
  item.hatchTimer += dtMs;
  if (item.hatchTimer >= ALIEN_EGG_HATCH_MS) {
    const archetype = ALIEN_ARCHETYPES[0]; // always a Tier 1 alien, per direct spec
    const hp = Math.round(archetype.hpMin + Math.random() * (archetype.hpMax - archetype.hpMin));
    const alien = createAlien(item.x, item.y, hp, archetype.id);
    alien.spawnProtectionUntilMs = state.level.elapsed + ALIEN_EGG_HATCH_INVULN_MS;
    // Only needs to rise if it hatched while still inside the seabed city
    // (the Manufacturer that laid the egg is a city building) — an egg
    // dragged up into open water first just hatches there normally, no rise
    // needed.
    alien.risingToSurface = item.y > SEABED_FLOOR_Y;
    state.level.entities.push(alien);
    return false;
  }
  return true;
}

// Weight Class 1 (Buoyant) — same slower gravity + gentle sway as Food (see
// updateFood above), just without Food's own stationary-to-Waste timer
// (that's a Food-specific balance mechanic, not something Mutagen Paste
// needs — its own consumption path is entirely fish-eating, handled in
// updateFish's eat branch, which splices it out of state.level.items
// directly the same way findNearestFood's own target already gets eaten).
function updateMutagenPaste(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: FOOD_GRAVITY, maxFallSpeed: FOOD_MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.fallTime += dt;
    const swayVx = currentSwayVx(item, FOOD_SWAY_AMPLITUDE, FOOD_SWAY_FREQUENCY, FOOD_SWAY_ENVELOPE_FREQUENCY);
    item.x += (item.vx + swayVx) * dt;
    item.y += item.vy * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') return false;
  item.resting = status === 'resting';
  return true;
}

// Mirrors updateScience exactly (see that function's own comment) — the
// only differences are the separate scienceGreen reserve it banks into and
// its own SCIENCE_GREEN_COLOR floating text.
function updateScienceGreen(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed') {
    bankScienceGreen(state, 1);
    state.level.floatingTexts.push(createPickupText(item.x, item.y, '+1 🔬', SCIENCE_GREEN_COLOR));
    state.level.gridStats.itemsRoutedTotal += 1;
    playDispense();
    return false;
  }
  item.resting = status === 'resting';
  return true;
}

// Per direct request ("make it so the fish not follow food once the food is
// in the city") — excludes any Food resting at/past SEABED_FLOOR_Y. A fish
// can never physically swim down there anyway (see updateFish's own
// unconditional Y clamp), so without this filter a fish could "lock onto" a
// pellet that fell into the city and just hover uselessly at the seabed
// line forever instead of picking a reachable target (or wandering).
function findNearestFood(items, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.type !== 'food' || item.y >= SEABED_FLOOR_Y) continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

// Mirrors findNearestFood exactly, targeting Mutagen Paste instead — same
// city-exclusion filter and reasoning.
function findNearestMutagenPaste(items, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.type !== 'mutagen_paste' || item.y >= SEABED_FLOOR_Y) continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

// Per direct spec ("Fish prioritize mutagen_paste over standard food items
// when hungry") — any Mutagen Paste anywhere in the tank wins over even a
// CLOSER plain Food pellet, not just a nearest-of-both-pools comparison;
// only falls back to findNearestFood once no Mutagen Paste exists at all.
function findNearestFoodOrMutagen(items, x, y) {
  return findNearestMutagenPaste(items, x, y) || findNearestFood(items, x, y);
}

// Same search, targeting Waste instead — a Scavenger species (Suckerfish;
// see the SCAVENGER behavior tag) eats ONLY this, never Food, per direct
// request. Mirrors findNearestFood exactly rather than sharing one
// parameterized function, since the two are simple enough that a shared
// abstraction wouldn't save much and would need a type-string param at
// every call site anyway.
function findNearestWaste(items, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.type !== 'waste') continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

// nearbyAlien (optional) is the closest living alien within
// ALIEN_AWARENESS_RADIUS, if any — see updateFish. Usually, not always,
// biases the new heading AWAY from it (ALIEN_FLEE_CHANCE) rather than a
// strict retreat, matching the aliens' own "kinda dumb" chase bias.
function wander(fish, def, state, dt, nearbyAlien) {
  fish.wanderTimer -= dt;
  if (fish.wanderTimer <= 0) {
    const speed = effectiveSwimSpeed(def, state);
    let angle;
    if (nearbyAlien && Math.random() < ALIEN_FLEE_CHANCE) {
      angle = Math.atan2(fish.y - nearbyAlien.y, fish.x - nearbyAlien.x) + (Math.random() - 0.5) * (Math.PI * 0.7);
    } else {
      angle = Math.random() * Math.PI * 2;
    }
    fish.vx = Math.cos(angle) * speed;
    fish.vy = Math.sin(angle) * speed * FISH_VERTICAL_DAMPING;
    fish.wanderTimer = WANDER_INTERVAL_MIN_S + Math.random() * (WANDER_INTERVAL_MAX_S - WANDER_INTERVAL_MIN_S);
  }
}

const TANK_POINT_TUTORIAL_MESSAGE =
  "A fish just grew up — that's your first Tank Point ⭐! Spend it in the Tank Upgrades panel (the button below the Shop) on faster fish, better food, and other things your fish will take completely for granted.";

const FIRST_FISH_DEATH_MESSAGE =
  'Your fish is now swimming with the fishes. Oh wait...it just starved. You might want to try feeding your fish.';

// Shared by every one-time story/tutorial notification below (Tank Points,
// first fish death, etc.) — same push+cap pattern Mound.js's own
// pushNotification uses. Kept as a duplicated inline helper rather than a
// shared exported utility per CLAUDE.md's Rolling Notification Log section:
// "any system can push a { text } onto state.level.notifications... see
// either writer for the pattern."
function pushStoryNotification(state, text) {
  const notifications = state.level.notifications;
  notifications.push({ id: notifications.length + 1, text, elapsed: state.level.elapsed });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
}

// Every subsequent Tank Point just gets the usual small floating text; only
// the very first one also explains what Tank Points even are, via the
// rolling notification ticker (same state.level.notifications log Mound.js
// writes to — any system can push to it, see CLAUDE.md's Rolling
// Notification Log section).
function awardTankPoint(state, fish) {
  const isFirst = state.level.tankPoints.total === 0;
  state.level.tankPoints.total += TANK_POINT_PER_ADULT_FISH;
  state.level.tankPoints.available += TANK_POINT_PER_ADULT_FISH;
  state.level.floatingTexts.push(createPickupText(fish.x, fish.y, '+1 Tank Point!', TANK_POINT_COLOR));
  playTankPoint();
  if (isFirst) {
    pushStoryNotification(state, TANK_POINT_TUTORIAL_MESSAGE);
    // Per direct request: the first-ever Tank Point also kicks off a guided
    // tutorial (Tank Upgrades -> Coin Capacity's buy button) — see UI.js's
    // TUTORIAL_FLOWS/updateTutorialOverlay. Gated the same one-time way
    // every other tutorial trigger in this file already is, and only if the
    // start-of-game tutorial isn't still active (it always finishes first —
    // a fish can't reach Adult before the player has even bought one).
    if (!state.level.tutorialFlags.tankPointTutorialShown && !state.level.tutorialFlow) {
      state.level.tutorialFlags.tankPointTutorialShown = true;
      state.level.tutorialFlow = { id: 'tankpoint', step: 'tankbtn' };
    }
  }
}

// Returns false if the fish should be removed (starved).
function updateFish(fish, state, dtMs) {
  const def = SPECIES[fish.speciesId];
  const dt = dtMs / 1000;

  // Alien Invasion reactions — moved to the very top of the function, per
  // direct request, so fish.alienNearby reflects THIS tick's proximity (not
  // last tick's) everywhere below that reads it, including the hunger-rate
  // calc right after this. A fish near a living alien usually (not always —
  // see wander's own ALIEN_FLEE_CHANCE bias) tries to move away from it, and
  // can't produce a coin at all while this close (checked below, only on
  // the coin-drop branch). fish.alienNearby also drives the continuous gray
  // tint in main.js's render, separate from the timed Coin-Cap-blocked tint
  // below, AND (per direct request) now halves Suckerfish's own hunger
  // accumulation, halves how often the Feeder Fish/Xeno Octopus hybrids
  // produce Food/Bio-Sludge, and halves electricity production for every
  // Generator fish/hybrid — see each of those sites' own comments.
  const nearbyAlien = findNearestAlienWithin(state.level.entities, fish.x, fish.y, ALIEN_AWARENESS_RADIUS);
  fish.alienNearby = !!(nearbyAlien && Math.hypot(nearbyAlien.x - fish.x, nearbyAlien.y - fish.y) <= ALIEN_INCOME_BLOCK_RADIUS);
  if (fish.capBlockedTintRemainingMs > 0) fish.capBlockedTintRemainingMs = Math.max(0, fish.capBlockedTintRemainingMs - dtMs);

  // A higher star tier is also less hungry — compounding 10%-per-tier
  // reduction, same ^(starTier-1) pattern as the coin-value multiplier below.
  // starTier defaults to 1 (a no-op ^0 = 1x) for every fish that's never been
  // combined, same as everywhere else star tier is read.
  // A dirty tank stresses fish — see Config.js's CLEANLINESS_STRESS_*
  // constants and cleanlinessStressFactor above. A no-op (factor 0) at or
  // above the threshold, same as every other not-yet-relevant multiplier in
  // this codebase's formulas.
  const stress = cleanlinessStressFactor(state);
  // Per direct request ("suckerfish hunger should go up half as fast when
  // next to aliens") — a Suckerfish near a living alien gets hungry more
  // slowly, which indirectly means it seeks out Waste less often while an
  // alien lingers nearby (the same "aliens quietly disrupt your economy"
  // theme the coin-block/food-production halving below share, just applied
  // to Suckerfish's own non-production role).
  const alienHungerMultiplier = (fish.speciesId === 'suckerfish' && fish.alienNearby) ? 0.5 : 1;
  const hungerRate = def.hungerRate * Math.pow(FISH_STAR_TIER_HUNGER_MULTIPLIER, (fish.starTier || 1) - 1)
    * (1 + stress * (CLEANLINESS_STRESS_MAX_HUNGER_MULTIPLIER - 1)) * alienHungerMultiplier;
  fish.hunger = Math.min(HUNGER_MAX, fish.hunger + hungerRate * dt);
  if (fish.hunger >= HUNGER_MAX) {
    playFishDeath();
    state.level.fishDiedCount += 1; // end-game stats modal only — see main.js's showGameOverModal
    if (!state.level.tutorialFlags.firstFishDied) {
      state.level.tutorialFlags.firstFishDied = true;
      pushStoryNotification(state, FIRST_FISH_DEATH_MESSAGE);
    }
    return false; // starves if hunger maxes out
  }

  // Plays playHunger() once per crossing INTO the second, more urgent
  // hunger stage (HUNGER_CRITICAL_THRESHOLD — the same threshold that shows
  // the "!!" indicator in main.js's render), per direct request. Edge-
  // triggered, not per-frame: the flag resets once hunger drops back below
  // the threshold (feeding, typically), so the growl can fire again next
  // time this fish gets that hungry, but doesn't repeat every tick while it
  // stays hungry.
  if (fish.hunger >= HUNGER_CRITICAL_THRESHOLD) {
    if (!fish.hungerCriticalSfxPlayed) {
      fish.hungerCriticalSfxPlayed = true;
      playHunger();
    }
  } else {
    fish.hungerCriticalSfxPlayed = false;
  }

  // Mutagen Paste's Adult buff (2x coin drop + a glow, see the eat branch
  // below) clears "as soon as the fish transitions back to the hungry
  // state," per direct spec — checked here, every tick, rather than only at
  // the moment hunger crosses the threshold, so it can't linger a tick
  // stale.
  // Per direct request ("make mutagen paste last until fed again or the
  // second stage of hunger, instead of the first") — clears at
  // HUNGER_CRITICAL_THRESHOLD (the "!!" stage) now, not HUNGER_SEEK_THRESHOLD
  // (the "!" stage); genuinely eating Mutagen Paste again before then still
  // refreshes it exactly as before.
  if (fish.mutagenBuffActive && fish.hunger >= HUNGER_CRITICAL_THRESHOLD) fish.mutagenBuffActive = false;

  // Feeder Fish's auto-food dispenser — a completely independent timer from
  // every other production mechanic, per direct spec ("spits out food
  // automatically... without needing to be fed"): it doesn't gate on
  // hunger, eating, or any of the isPureX branches below, it just ticks
  // whenever toggled on (fish.autoFoodOn, main.js's click handler) and
  // spawns a real Food item once it crosses ELECTRIC_SUCKER_FOOD_INTERVAL_MS.
  // Its power generation is the OTHER half of the toggle — see the
  // isPureGenerator branch further down, which this fish's speciesId is
  // deliberately excluded from while autoFoodOn is true. Per direct request
  // ("the hybrids that produce food and bio-sludge should produce half as
  // often when next to alien fish"), the timer itself advances at half
  // speed while alienNearby — takes 2x as long to fill, not a flat pause.
  if (fish.speciesId === 'zap_sucker' && fish.autoFoodOn) {
    fish.autoFoodTimerMs += dtMs * (fish.alienNearby ? 0.5 : 1);
    if (fish.autoFoodTimerMs >= ELECTRIC_SUCKER_FOOD_INTERVAL_MS) {
      fish.autoFoodTimerMs -= ELECTRIC_SUCKER_FOOD_INTERVAL_MS;
      state.level.items.push(createFood(fish.x, fish.y));
    }
  }

  const isScavenger = def.behavior.includes('SCAVENGER'); // Suckerfish (and any future SCAVENGER species) eats ONLY Waste, never Food
  // A SCAVENGER+FEEDER hybrid (Scrub-Guppy/Dartfin/Blimpfish) still eats
  // Waste like any Scavenger, but its dropInterval is claimed for coin-drop
  // timing instead (see the passive-production branch below) — so unlike a
  // pure Scavenger (Suckerfish itself), it must NOT have an eat cooldown
  // carved out of that same field.
  const isPureScavenger = isScavenger && !def.behavior.includes('FEEDER');

  // A Scavenger's growth-stage dropInterval is repurposed as its EAT
  // COOLDOWN (see Config.js's suckerfish rows) — the minimum time between
  // two waste-eating events, ticking down every frame regardless of whether
  // it's currently near a target. Per direct request: a baby eats less
  // OFTEN than an adult, but hungerRate itself (checked above) never varies
  // by stage, so starvation timing is unaffected either way.
  if (fish.eatCooldownRemainingMs > 0) fish.eatCooldownRemainingMs = Math.max(0, fish.eatCooldownRemainingMs - dtMs);

  if (fish.hunger >= HUNGER_SEEK_THRESHOLD) {
    const target = isScavenger
      ? findNearestWaste(state.level.items, fish.x, fish.y)
      : findNearestFoodOrMutagen(state.level.items, fish.x, fish.y);
    if (target) {
      const dx = target.x - fish.x;
      const dy = target.y - fish.y;
      const dist = Math.hypot(dx, dy) || 1;
      const seekSpeed = effectiveSwimSpeed(def, state) * FISH_SEEK_SPEED_MULTIPLIER; // top speed — only while actively chasing food
      fish.vx = (dx / dist) * seekSpeed;
      fish.vy = (dy / dist) * seekSpeed;
      // A Scavenger still swims right up to a Waste item on cooldown (so it
      // doesn't look frozen/broken) but can't actually eat it until the
      // cooldown clears — the eat action itself is what's gated, not the
      // seek/approach behavior above.
      const onEatCooldown = isPureScavenger && fish.eatCooldownRemainingMs > 0;
      if (dist <= FISH_EAT_RADIUS && !onEatCooldown) {
        const idx = state.level.items.indexOf(target);
        if (idx !== -1) state.level.items.splice(idx, 1);
        playEat();
        const isMutagenPaste = target.type === 'mutagen_paste';
        // Mutagen Paste's growth effect is a full replacement for the
        // standard incremental feeds-required climb below, not an addition
        // to it — handled entirely in this branch, then skips the shared
        // totalFeeds/stageIndexForFeeds tail via skipStandardGrowth.
        let skipStandardGrowth = false;
        if (isScavenger) {
          // Flat relief, deliberately not tied to the Food Quality Tank
          // Upgrade tree — that tree is themed around player-bought Food
          // specifically, not scavenged Waste. Cleaning up a Waste item
          // also restores cleanliness — the other half of the "buildings
          // and Suckerfish push cleanliness back up" pairing with the
          // per-Waste-spawn penalty above.
          fish.hunger -= WASTE_HUNGER_RELIEF;
          adjustCleanliness(state, CLEANLINESS_PER_WASTE_EVENT);
          // Buffer Fish's own bespoke twist on ordinary Scavenger eating —
          // per direct spec ("still eats waste like a normal suckerfish, but
          // turns it into food instead") — a real Food item spawns at the
          // fish's own position on top of the normal hunger relief above,
          // not instead of it.
          if (fish.speciesId === 'buffer_fish') {
            state.level.items.push(createFood(fish.x, fish.y));
          }
          // eatCooldownMs overrides dropInterval when present — needed for a
          // hybrid (Scrub-Topus) that's ALSO a pure Researcher/Generator and
          // so already reads dropInterval for its own unrelated production
          // cycle; every other pure Scavenger has no such conflict and just
          // falls back to dropInterval as before.
          if (isPureScavenger) {
            const stage = def.growthStages[fish.stage];
            fish.eatCooldownRemainingMs = stage.eatCooldownMs ?? stage.dropInterval;
          }
        } else if (isMutagenPaste) {
          // Per direct spec: a Non-Adult fish instantly advances ONE growth
          // stage (not straight to adult); an Adult instead gets a
          // temporary 2x coin-drop buff with a glowing visual
          // (mutagenBuffActive, read by main.js's render and the coin-drop
          // branch further below) — cleared the moment the fish transitions
          // back to the hungry state (checked at the top of this function).
          fish.hunger -= MUTAGEN_PASTE_HUNGER_RELIEF;
          skipStandardGrowth = true;
          const wasAdultAlready = fish.stage === def.growthStages.length - 1;
          if (!wasAdultAlready) {
            fish.stage = Math.min(fish.stage + 1, def.growthStages.length - 1);
            // Keeps totalFeeds consistent with the stage this just jumped
            // to, so a later ordinary Food feed's own stageIndexForFeeds
            // recompute can't accidentally walk the stage back down.
            fish.totalFeeds = Math.max(fish.totalFeeds, def.growthStages[fish.stage].feedsRequired);
            fish.shimmerStartedAt = state.level.elapsed; // a real stage advance, same "shimmers when it grows" rule every other growth path follows
            if (fish.stage === def.growthStages.length - 1) awardTankPoint(state, fish);
          } else {
            fish.mutagenBuffActive = true;
          }
        } else {
          // Food Quality Tank Upgrade: relief is a flat lookup by purchased
          // level, no longer clamped to the fish's current hunger — a
          // higher-quality pellet than the fish actually needed pushes hunger
          // negative (an "overfed" state; no bonus effect reads it yet).
          const relief = FOOD_HUNGER_RELIEF_BY_LEVEL[state.level.upgrades.foodQuality];
          fish.hunger -= relief;
        }
        if (!skipStandardGrowth) {
          // Eating fills the coin-drop timer too, so feeding feels like it's
          // what produces the coins — a 20s cycle fed halfway through jumps
          // straight to a drop and restarts the cycle. Not meaningful for a
          // Scavenger (it doesn't use dropTimer at all — see the eat-cooldown
          // branch above), so skipped for it.
          if (!isScavenger) fish.dropTimer += def.growthStages[fish.stage].dropInterval * COIN_TIMER_FEED_BONUS_FRACTION;
          // Same idea for the Waste poop timer, per direct request ("food
          // fills up the waste meter of a fish by 25%, if the fish produces
          // waste") — only meaningful for a fish that actually poops
          // (non-Scavenger, same condition as updateFish's own poop-timer
          // branch below), using that exact same per-species interval
          // formula so the bonus fraction always applies to the fish's real
          // current cycle length, not a flat guess.
          if (!isScavenger) fish.poopTimer += WASTE_POOP_INTERVAL_MS * (def.wastePoopIntervalMultiplier || 1) * WASTE_TIMER_FEED_BONUS_FRACTION;
          fish.totalFeeds += 1;
          const wasAdult = fish.stage === def.growthStages.length - 1;
          const prevStage = fish.stage;
          fish.stage = stageIndexForFeeds(def, fish.totalFeeds);
          // Per direct request, a fish shimmers whenever it "grows in size" —
          // a real stage advance (hatchling->juvenile->adult), not just any
          // feed (most feeds don't cross a stage boundary).
          if (fish.stage > prevStage) fish.shimmerStartedAt = state.level.elapsed;
          if (!wasAdult && fish.stage === def.growthStages.length - 1) {
            awardTankPoint(state, fish);
          }
        }
      }
    } else {
      wander(fish, def, state, dt, nearbyAlien);
    }
  } else {
    wander(fish, def, state, dt, nearbyAlien);
  }

  fish.x += fish.vx * dt;
  fish.y += fish.vy * dt;

  if (fish.x < FISH_MIN_X) { fish.x = FISH_MIN_X; fish.vx = Math.abs(fish.vx); }
  if (fish.x > FISH_MAX_X) { fish.x = FISH_MAX_X; fish.vx = -Math.abs(fish.vx); }
  if (fish.y < FISH_MIN_Y) { fish.y = FISH_MIN_Y; fish.vy = Math.abs(fish.vy); }
  // Fish can never swim down into the seabed city itself — SEABED_FLOOR_Y
  // is a hard ceiling on how deep they go, by design: this is the entire
  // reason Fans exist, to push Food/Waste that's landed deep in a factory
  // back up into reach. (A brief attempt to let a fish dive to whatever
  // depth its current target was actually resting at was reverted per
  // direct correction — that's not a bug, it's the intended loop.)
  if (fish.y > SEABED_FLOOR_Y) { fish.y = SEABED_FLOOR_Y; fish.vy = -Math.abs(fish.vy); }

  const speed = Math.hypot(fish.vx, fish.vy);
  fish.tailPhase = (fish.tailPhase + speed * TAIL_WAG_RATE * dt) % (Math.PI * 2);

  const stageDef = def.growthStages[fish.stage];
  // A pure Researcher or Generator (RESEARCHER/GENERATOR without also FEEDER
  // — Science Octopus, Electric Eel, and the utility-utility hybrids that
  // carry one of those tags without the other: Scrub-Topus, Scrub-Eel;
  // Volt-Topus checks RESEARCHER first and only ever produces Science, a
  // deliberate one-resource-per-fish simplification) each get their own
  // dedicated mechanism now, per direct request — neither is speed-scaled
  // off a timer any more (that whole approach is superseded below). A
  // Scholar/Volt hybrid (RESEARCHER or GENERATOR *and* FEEDER) still
  // produces its carried-over coin value in the plain coin-drop branch
  // instead; it doesn't also produce Science/Power on top, same as before.
  const isPureResearcher = def.behavior.includes('RESEARCHER') && !def.behavior.includes('FEEDER');
  const isPureGenerator = def.behavior.includes('GENERATOR') && !def.behavior.includes('FEEDER');

  // Checked in this order deliberately — Volt-Topus carries BOTH tags (pure
  // Generator and pure Researcher at once) and, per the original design,
  // only ever produces Science, never Power, "a deliberate one-resource-
  // per-fish simplification." Researcher must stay first for that to hold.
  if (isPureResearcher) {
    // Xeno Octopus's Bio-Sludge mode, per direct spec ("spits out alien DNA
    // every 8 seconds instead of science" — Alien DNA is now displayed as
    // Bio-Sludge everywhere, see Config.js's own comment on the alien_dna
    // type) — a full replacement of the normal long brew cycle below with a
    // short fixed timer, while toggled on. Still needs to be fed like any
    // other fish (nothing here changes hunger/starvation) — only what its
    // dropTimer produces changes.
    if (fish.speciesId === 'xeno_octopus' && fish.alienDnaModeOn) {
      // Per direct request ("the hybrids that produce food and bio-sludge
      // should produce half as often when next to alien fish") — same
      // half-speed-timer treatment the Feeder Fish's own dispenser gets.
      fish.dropTimer += dtMs * (fish.alienNearby ? 0.5 : 1);
      if (fish.dropTimer >= SCIENCE_ALIEN_DNA_INTERVAL_MS) {
        fish.dropTimer = 0;
        if (canSpawnMoreAlienDna(state)) {
          state.level.items.push(createAlienDna(fish.x, fish.y));
        }
      }
      // Deliberately no `return` here — falls through past the rest of this
      // if-block to the shared poop-timer logic below, same as every other
      // pure Researcher/Generator branch already does; only what dropTimer
      // produces is different in this mode, not the rest of the fish's tick.
    } else {
    // A real long brew cycle now, per direct request ("a full minute at
    // base... every 70 seconds as a baby, every 50 as an adult") — dropTimer
    // still counts up toward stageDef.dropInterval exactly like a coin
    // fish's does, but instead of an instant resource grant, it (a) posts a
    // small "+0.1 🔬" progress bubble every time it crosses another tenth of
    // the cycle (pure feedback — nothing is actually banked yet), and (b)
    // spawns `dropValue` real, physical Science Bubbles once the cycle
    // completes, which still have to be collected like a coin — see
    // Entities.js's createScience/updateScience and Grid.js's Processor.
    fish.dropTimer += dtMs;
    const tickIntervalMs = stageDef.dropInterval / SCIENCE_PROGRESS_TICKS;
    const currentTickIndex = Math.min(SCIENCE_PROGRESS_TICKS - 1, Math.floor(fish.dropTimer / tickIntervalMs));
    if (currentTickIndex > fish.researchTickIndex) {
      fish.researchTickIndex = currentTickIndex;
      state.level.floatingTexts.push(createPickupText(fish.x, fish.y - FISH_BASE_SIZE * stageDef.scale * 0.6, '+0.1 🔬', SCIENCE_COLOR));
    }
    if (fish.dropTimer >= stageDef.dropInterval) {
      fish.dropTimer = 0;
      fish.researchTickIndex = 0;
      // Science Cap: if the tank's already full, the whole brew is blocked —
      // nothing spawns, the fish gets the blocked feedback once. Otherwise
      // it spawns up to dropValue bubbles but stops early the instant the
      // cap fills mid-batch (a partial payout isn't itself a "blocked"
      // event, so no extra feedback fires for that case). Green Science
      // counts against this same cap now too, per direct request ("make sure
      // green science counts towards the bubble cap when on screen") — see
      // countScienceCapacityUsed.
      const scienceRoom = effectiveScienceCapacity(state) - countScienceCapacityUsed(state);
      if (scienceRoom <= 0) {
        triggerProductionBlocked(state, fish, stageDef, 'science');
      } else {
        const spawnCount = Math.min(Math.max(1, stageDef.dropValue), scienceRoom);
        for (let i = 0; i < spawnCount; i++) {
          state.level.items.push(createScience(fish.x, fish.y));
        }
      }
    }
    }
  } else if ((isPureGenerator && !(fish.speciesId === 'zap_sucker' && fish.autoFoodOn)) || fish.speciesId === 'eel_blimp') {
    // Distance-based, per direct request ("produces 1MW per 10 pixels swam
    // as a baby, and 1MW per 5 pixels as an adult") — a literal
    // pixels-traveled meter instead of an indirect speed-vs-baseline ratio,
    // so a faster eel (Fish Movement upgrades, a seek-chase's speed boost)
    // naturally generates faster with no separate multiplier needed. `speed`
    // (computed above for the tail-wag) already reflects all of that.
    // Accumulates every tick unconditionally, not gated behind any timer.
    // A hybrid without its own pixelsPerMW field falls back to the eel's own
    // adult rate. Blimp-Battery shares this exact mechanism by speciesId
    // (bypassing the normal "GENERATOR+FEEDER is impure, doesn't generate"
    // rule every other hybrid follows — its whole point per direct spec is
    // to generate power) — Mutagen Paste doubles its production by simply
    // filling the distance meter EEL_BLIMP_MUTAGEN_PRODUCTION_MULTIPLIER
    // times faster for the same real distance swum.
    // Feeder Fish (zap_sucker) is the one exception carved out of the outer
    // branch condition above, per direct request ("make it so it only
    // generates power when toggled off, when making food it makes no
    // power") — while its dispenser is on, this whole branch is skipped
    // entirely (falls through to the plain-Scavenger no-op below, since it's
    // also isPureScavenger), so distanceAccumPx doesn't even accrue while
    // making food — no banked credit suddenly cashes out the moment it's
    // toggled back to generator mode.
    const pixelsPerMW = stageDef.pixelsPerMW || 5;
    const productionMultiplier = (fish.speciesId === 'eel_blimp' && fish.mutagenBuffActive) ? EEL_BLIMP_MUTAGEN_PRODUCTION_MULTIPLIER : 1;
    // Per direct request ("when aliens are close to electric fish and
    // hybrids that produce electricity, make them produce half as much
    // electricity") — halves the rate distance credit accrues, so it takes
    // twice as long to reach pixelsPerMW rather than flat-out blocking
    // production the way the coin-drop branch below does.
    const alienProximityMultiplier = fish.alienNearby ? 0.5 : 1;
    fish.distanceAccumPx += speed * dt * productionMultiplier * alienProximityMultiplier;
    while (fish.distanceAccumPx >= pixelsPerMW) {
      fish.distanceAccumPx -= pixelsPerMW;
      // Power is not a battery — this only feeds the CURRENT in-progress
      // real second's generation total (main.js reads and resets it once a
      // second into state.level.powerHistory/powerEfficiency); nothing here
      // accumulates forever any more. See Levels.js's powerGenAccumMw.
      state.level.powerGenAccumMw += 1;
      // Per direct request ("a pop up text every one second with the amount
      // of MW produced that second, instead of a pop up text every time it
      // produces 1 mw") — actual generation above is still fully real-time
      // and un-batched; only the FLOATING TEXT display is queued up and
      // flushed once a second below, so a fast-swimming fish producing
      // several MW within one second shows one combined "+N ⚡" instead of
      // a flurry of "+1"s.
      fish.powerTextAccumMw += 1;
    }
    fish.powerTextTimerMs += dtMs;
    if (fish.powerTextTimerMs >= 1000) {
      fish.powerTextTimerMs -= 1000; // subtract rather than reset to 0, so a slight overshoot doesn't compound into drift over a long session
      if (fish.powerTextAccumMw > 0) {
        state.level.floatingTexts.push(createPickupText(fish.x, fish.y, `+${fish.powerTextAccumMw} ⚡`, POWER_COLOR));
        fish.powerTextAccumMw = 0;
      }
    }
  } else if (!isPureScavenger) {
    // Every plain FEEDER and Gene-Splicing hybrid (feeder-based or
    // utility-utility) still drops a coin on this timer, unchanged. A
    // SCAVENGER+FEEDER hybrid (Scrub-Guppy/Dartfin/Blimpfish) falls through
    // to here too — its dropInterval is a coin timer, not an eat cooldown.
    fish.dropTimer += dtMs;
    // Per direct request, a fish can't produce money at all while close to a
    // living alien — no coin, no cap-blocked feedback either (that's
    // reserved for a genuine cap-full block); the continuous gray tint
    // (fish.alienNearby, set above) is the only feedback for this case. The
    // cycle still resets rather than holding at the threshold, so the fish
    // doesn't instantly drop a coin the moment the alien wanders off.
    // A dirty tank makes a fish produce money less OFTEN, not less money per
    // drop — per the cleanliness warning's own wording ("the less often your
    // fish produce money"), stretching the interval rather than shrinking
    // the payout. stress is 0 (no-op) above CLEANLINESS_STRESS_THRESHOLD.
    const dirtyIntervalMultiplier = 1 + stress * (CLEANLINESS_STRESS_MAX_INTERVAL_MULTIPLIER - 1);
    const effectiveDropInterval = stageDef.dropInterval * dirtyIntervalMultiplier;
    if (fish.dropTimer >= effectiveDropInterval && fish.alienNearby) {
      fish.dropTimer = 0;
    } else if (fish.dropTimer >= effectiveDropInterval) {
      fish.dropTimer = 0;
      // A hybrid's dropValueOverride (T5 value carry-over pipeline) already
      // reflects its economy parent's tier-scaled value in full — using it
      // directly, not layering the starTier multiplier on top again, since a
      // hybrid fish's own starTier is always the unused default (1). Every
      // other fish scales its species row's stage dropValue by its own star
      // tier (a no-op ^0 = 1x for the overwhelming majority that never
      // combined) — see Config.js's FISH_STAR_TIER_VALUE_MULTIPLIER.
      // Math.ceil: a higher star tier's 1.8^N scaling almost never lands on
      // a whole dollar (e.g. a Tier-3 fish's 5 * 1.8^2 = 16.2) — round up
      // to the next whole coin value rather than handing out a fractional
      // amount, per direct request.
      // Mutagen Paste's Adult buff (fish.mutagenBuffActive — see the eat
      // branch above) multiplies the final coin value on top of everything
      // else, star tier included — applied last, after Math.ceil, so it
      // always lands on a whole number regardless of the base value's own
      // rounding.
      const mutagenMultiplier = fish.mutagenBuffActive ? MUTAGEN_PASTE_COIN_MULTIPLIER : 1;
      const dropValue = (fish.dropValueOverride != null
        ? fish.dropValueOverride
        : Math.ceil(stageDef.dropValue * Math.pow(FISH_STAR_TIER_VALUE_MULTIPLIER, (fish.starTier || 1) - 1))) * mutagenMultiplier;
      // Skip entirely for a $0 drop (any not-yet-behavior-wired species) — a
      // worthless coin still lands on a Processor like any other, which is
      // actively counterproductive busywork for no payout. A genuine drop is
      // then gated by the Coin Cap — at the cap, nothing spawns and the fish
      // shows the blocked feedback instead.
      if (dropValue > 0) {
        if (countTankItemsByType(state, 'coin') >= effectiveCoinCapacity(state)) {
          triggerProductionBlocked(state, fish, stageDef, 'coin');
        } else {
          state.level.items.push(createCoin(fish.x, fish.y, dropValue));
        }
      }
    }
  }
  // (isScavenger falls through here with no passive drop at all — Suckerfish
  // produces nothing on a timer; its whole job is the eat-cooldown-gated
  // Waste consumption handled in the seek/eat branch above.)

  // Fish poop: any non-Scavenger fish drops a Waste item directly at its
  // own position on a periodic timer, independent of the Collector-byproduct
  // path above — literal fish poop, per direct request. Suckerfish (and any
  // other SCAVENGER species) don't poop — they're the ones cleaning this up,
  // not producing it. The interval is WASTE_POOP_INTERVAL_MS scaled by an
  // optional per-species wastePoopIntervalMultiplier (Config.js — Dartfin
  // 10% slower, Blimpfish 5% faster than Guppy, per direct request);
  // defaults to 1 (Guppy's own baseline, and every species without an
  // explicit override) via the `|| 1` fallback.
  if (!isScavenger) {
    fish.poopTimer += dtMs;
    const wastePoopInterval = WASTE_POOP_INTERVAL_MS * (def.wastePoopIntervalMultiplier || 1);
    if (fish.poopTimer >= wastePoopInterval) {
      fish.poopTimer = 0;
      if (canSpawnMoreWaste(state)) { // see Config.js's WASTE_MAX_ON_SCREEN
        state.level.items.push(createWaste(fish.x, fish.y));
        adjustCleanliness(state, -CLEANLINESS_PER_WASTE_EVENT);
      }
    }
  }

  return true;
}

function updatePickupText(item, dtMs) {
  item.age += dtMs;
  item.y -= PICKUP_TEXT_RISE_SPEED * (dtMs / 1000);
  return item.age < PICKUP_TEXT_LIFETIME_MS;
}

// Turns a due alien-wave portal into a real alien entity, and cleans up
// portals once their close animation has finished. Systems.js's
// updateAlienWaves owns the TIMING (when a wave starts, how many portals,
// each one's HP/stagger) and only ever pushes/reads plain data into
// state.level.alienPortals — no import of this file needed there. This is
// the one place that data becomes a real entity, kept here (not Systems.js)
// per this file's own "Fish, Alien, Food, Item" ownership.
function updateAlienPortals(state) {
  const elapsed = state.level.elapsed;
  for (const portal of state.level.alienPortals) {
    if (!portal.spawned && elapsed >= portal.openAtMs + ALIEN_PORTAL_OPEN_MS) {
      portal.spawned = true;
      portal.spawnedAtMs = elapsed;
      const alien = createAlien(portal.x, portal.y, portal.hp, portal.archetypeId);
      state.level.entities.push(alien);
      // Cinematic first-alien intro — per direct request, the very first
      // alien to ever spawn (wave 1 is forced to exactly one, see
      // Systems.js's spawnAlienWave) freezes the whole game and spotlights
      // itself until the player clicks it — but only once it's actually
      // been alive and visibly moving on screen for a beat first (per
      // direct request), not the instant it spawns. This just records WHEN
      // it appeared; Systems.js's updateStoryTriggers checks the delay and
      // actually starts the 'alienintro' tutorial flow once it elapses.
      // One-time, ever, via tutorialFlags.firstAlienIntroShown.
      if (!state.level.tutorialFlags.firstAlienIntroShown) {
        state.level.tutorialFlags.firstAlienIntroShown = true;
        state.level.firstAlienIntroTargetId = alien.id;
        state.level.firstAlienIntroAppearedAtMs = state.level.elapsed;
      }
    }
  }
  state.level.alienPortals = state.level.alienPortals.filter(
    (p) => !p.spawned || elapsed < p.spawnedAtMs + ALIEN_PORTAL_CLOSE_MS
  );
}

// A turret's shot — see Config.js's TURRET_PROJECTILE_* comment for why
// this exists instead of the old instant-hitscan damage. Grid.js's
// updateBuildings only ever decides a shot fired and hands back
// { x, y, targetId, damage } (the same "Grid.js returns data, the real
// owner constructs it" split already used for Food/Waste spawn points);
// this is that data turned into a real, independently-ticked projectile.
export function createTurretProjectile({ x, y, targetId, damage }) {
  return { id: nextId(), type: 'turretProjectile', x, y, targetId, damage };
}

// Homes on its target alien's LIVE position every tick — per direct request
// ("it should never miss") — rather than flying a fixed straight line, so a
// moving alien can't dodge it. Damage only actually applies once the
// projectile visually reaches the target (within TURRET_PROJECTILE_HIT_RADIUS);
// if the target's already dead/gone by then (a second turret or a click
// killed it first), the shot just fizzles with no damage rather than
// erroring or double-counting.
function updateTurretProjectiles(state, dtMs) {
  const dt = dtMs / 1000;
  state.level.turretProjectiles = state.level.turretProjectiles.filter((shot) => {
    const target = state.level.entities.find((e) => e.id === shot.targetId && e.type === 'alien' && e.hp > 0);
    if (!target) return false; // target already gone — fizzle, no damage, no error
    // Defensive — Grid.js's own targeting search already excludes an
    // invulnerable (Alien-Egg-hatch grace period) alien, so a shot should
    // never actually be aimed at one in practice; still fizzle harmlessly
    // rather than apply damage if it somehow is.
    if (target.spawnProtectionUntilMs > state.level.elapsed) return false;
    const dx = target.x - shot.x;
    const dy = target.y - shot.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= TURRET_PROJECTILE_HIT_RADIUS) {
      target.hp -= shot.damage;
      target.hitFlashMs = ALIEN_HIT_FLASH_MS; // per direct request — a hit flashes red and "bounces," read back by main.js's render
      // Only the "still alive" hit sound here — a killing blow instead gets
      // playAlienDeath from updateAlien's own death branch next tick, so a
      // fatal hit doesn't fire both sounds on top of each other.
      if (target.hp > 0) playAlienHit();
      return false; // consumed on impact
    }
    const travel = Math.min(dist, TURRET_PROJECTILE_SPEED * dt);
    shot.x += (dx / dist) * travel;
    shot.y += (dy / dist) * travel;
    return true;
  });
}

// Ages/culls the death-burst effects updateAlien pushes on an alien's last
// tick — pure decoration, no gameplay meaning, same "age past a fixed
// lifetime and drop" pattern updatePickupText already uses for floatingTexts.
function updateAlienDeathEffects(state, dtMs) {
  state.level.alienDeathEffects = state.level.alienDeathEffects.filter((effect) => {
    effect.age += dtMs;
    return effect.age < ALIEN_DEATH_EFFECT_DURATION_MS;
  });
}

// Same age-and-cull pattern, for the "on fire, disintegrating" effect
// triggerProductionBlocked pushes when a coin OR science drop is blocked by
// its cap — see Config.js's PRODUCTION_BLOCKED_EFFECT_DURATION_MS and
// main.js's render.
function updateProductionBlockedEffects(state, dtMs) {
  state.level.productionBlockedEffects = state.level.productionBlockedEffects.filter((effect) => {
    effect.age += dtMs;
    return effect.age < PRODUCTION_BLOCKED_EFFECT_DURATION_MS;
  });
}

export function updateEntities(state, dtMs) {
  updateAlienPortals(state);
  updateAlienDeathEffects(state, dtMs);
  updateProductionBlockedEffects(state, dtMs);
  pendingFoodToWasteSpawns.length = 0; // updateFood (below) fills this — see its own comment for why it can't push into state.level.items directly
  state.level.items = state.level.items.filter((item) => {
    if (item.type === 'food') return updateFood(item, state, dtMs);
    if (item.type === 'coin') return updateCoin(item, state, dtMs);
    if (item.type === 'science') return updateScience(item, state, dtMs);
    if (item.type === 'science_green') return updateScienceGreen(item, state, dtMs);
    if (item.type === 'waste') return updateWaste(item, state, dtMs);
    if (item.type === 'alien_dna') return updateAlienDna(item, state, dtMs);
    if (item.type === 'biomass') return updateBiomass(item, state, dtMs);
    if (item.type === 'mutagen_paste') return updateMutagenPaste(item, state, dtMs);
    if (item.type === 'alien_egg') return updateAlienEgg(item, state, dtMs);
    return true;
  });

  // Processor: banks coins/Science on its own per-item hold (each item's own
  // per-tick step above reports 'consumed'); also now produces Waste on a
  // continuously-running background clock. Auto-Feeder: absorbs nearby
  // Waste, dispenses Food from its output port once its tier's required
  // number of loads have processed. Refinery/Bio-Feeder/Bio-Combuster: the
  // new Bio-Building chain, see Grid.js's updateBuildings — bioSpawnPoints
  // carries an itemType alongside each { x, y } since these buildings can
  // eject more than one kind of output depending on which recipe locked in.
  // Bio-Reactor produces no item at all (it's a power generator, not a
  // router) so it needs no spawn-point handling here. All of this returns
  // spawn points rather than constructing the items itself, to avoid a
  // circular import (createFood/createWaste/etc. live here).
  const { foodSpawnPoints, wasteSpawnPoints, turretShots, bioSpawnPoints } = updateBuildings(state, dtMs);
  for (const point of foodSpawnPoints) state.level.items.push(createFood(point.x, point.y));
  // canSpawnMoreWaste checked per-item (not once before the loop) so a
  // batch of several at once still respects the cap precisely — see
  // Config.js's WASTE_MAX_ON_SCREEN.
  for (const point of wasteSpawnPoints) { if (canSpawnMoreWaste(state)) state.level.items.push(createWaste(point.x, point.y)); }
  for (const point of pendingFoodToWasteSpawns) { if (canSpawnMoreWaste(state)) state.level.items.push(createWaste(point.x, point.y)); }
  // Both science-type outputs (the Bio-Combustor's Blue or Green recipe) are
  // gated by the Bubble Cap now too, per direct request — see
  // countScienceCapacityUsed for why Green counts against the same cap Blue
  // does, not a separate unbounded pool. A blocked brew here just silently
  // doesn't eject (same "no player-facing feedback" precedent every other
  // building-side cap check already follows, unlike a fish's own capped
  // production which does show a blocked-effect).
  for (const point of bioSpawnPoints) {
    if (point.itemType === 'food') state.level.items.push(createFood(point.x, point.y));
    else if (point.itemType === 'biomass') { if (canSpawnMoreBiomass(state)) state.level.items.push(createBiomass(point.x, point.y)); }
    // The Manufacturer's Bio-Sludge recipe (Food+Waste) outputs 'alien_dna' —
    // the same item type killing an alien drops, merged per direct request
    // (see Config.js's MANUFACTURER_RECIPES.bio_sludge comment) — so it
    // shares the exact same spawn-cap check every alien-drop Bio-Sludge
    // already uses.
    else if (point.itemType === 'alien_dna') { if (canSpawnMoreAlienDna(state)) state.level.items.push(createAlienDna(point.x, point.y)); }
    else if (point.itemType === 'mutagen_paste') state.level.items.push(createMutagenPaste(point.x, point.y));
    else if (point.itemType === 'science') { if (countScienceCapacityUsed(state) < effectiveScienceCapacity(state)) state.level.items.push(createScience(point.x, point.y)); }
    else if (point.itemType === 'science_green') { if (countScienceCapacityUsed(state) < effectiveScienceCapacity(state)) state.level.items.push(createScienceGreen(point.x, point.y)); }
    else if (point.itemType === 'alien_egg') state.level.items.push(createAlienEgg(point.x, point.y));
  }
  for (const shot of turretShots) state.level.turretProjectiles.push(createTurretProjectile(shot));
  // Runs before the entities filter loop below, same as the old direct-
  // mutation turret code did, so a lethal hit lands and gets cleaned up in
  // the same tick rather than lingering a frame at 0 hp.
  updateTurretProjectiles(state, dtMs);

  resolveItemCollisions(state); // items in the seabed band can't overlap — see Grid.js's module comment

  state.level.floatingTexts = state.level.floatingTexts.filter((ft) => updatePickupText(ft, dtMs));

  pendingBossMinionSpawns.length = 0; // updateAlien (below) fills this — see that array's own comment for why it can't push into state.level.entities directly
  pendingTurretTutorialAlienSpawns.length = 0;
  state.level.entities = state.level.entities.filter((entity) => {
    if (entity.type === 'fish') return updateFish(entity, state, dtMs);
    if (entity.type === 'alien') return updateAlien(entity, state, dtMs);
    return true;
  });
  for (const spawn of pendingBossMinionSpawns) {
    state.level.entities.push(createAlien(spawn.x, spawn.y, spawn.hp, spawn.archetypeId));
  }
  for (const spawn of pendingTurretTutorialAlienSpawns) {
    state.level.entities.push(createAlien(spawn.x, spawn.y, spawn.hp, spawn.archetypeId));
    // The 1-second countdown to the turret tutorial starts from the moment
    // this alien genuinely exists on screen, not from the moment its
    // predecessor died — see Systems.js's updateTurretTutorialTrigger.
    state.level.turretTutorialAlienAppearedAtMs = state.level.elapsed;
  }
}
