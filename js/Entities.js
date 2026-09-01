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
  ITEM_LOST_COLOR,
  WORLD_H,
  WORLD_W,
  ITEM_MASS_BY_TYPE,
  FISH_BASE_SIZE,
  ECONOMY_SPECIES_IDS,
  DYNAMIC_PRICED_SPECIES_IDS,
  ECONOMY_FISH_COST_GROWTH_RATE,
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
  GENE_SPLICING_LAB_ID,
  SCIENCE_ITEM_RADIUS,
  SCIENCE_PROGRESS_TICKS,
  COIN_CAP_BY_LEVEL,
  SCIENCE_CAP_BY_LEVEL,
  PRODUCTION_BLOCKED_COLOR,
  FISH_VANISH_DURATION_MS,
  ALIEN_AWARENESS_RADIUS,
  ALIEN_CHASE_CHANCE,
  ALIEN_FLEE_CHANCE,
  ALIEN_SPEED,
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
} from './Config.js';
import { stepItemOnGrid, resolveItemCollisions, computeFanForce, integrateItemForces, updateBuildings } from './Grid.js';
// Sound is a fire-and-forget side effect at the moment something already
// happened — the same pattern this file already uses for floatingTexts/
// notifications, just for audio instead of a visual/text readout.
import { playPurchase, playFoodPlace, playEat, playFishDeath, playCoinBank, playTankPoint, playProductionBlocked, playHunger } from './Sound.js';

let _nextId = 1;
function nextId() {
  return _nextId++;
}

// Filled by updateFood, flushed into state.level.items by updateEntities
// right after its own state.level.items.filter(...) call completes — see
// updateFood's own comment for why it can't push a new Waste item directly
// from inside that filter's callback.
const pendingFoodToWasteSpawns = [];

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

export function createPickupText(x, y, text, color) {
  return { id: nextId(), type: 'pickupText', x, y, text, color, age: 0 };
}

// Alien Invasion — see Config.js's ALIEN_* constants and CLAUDE.md-pending
// notes. Systems.js's updateAlienWaves owns wave TIMING/scheduling and
// pushes { x, y, hp, openAtMs, spawned, spawnedAtMs } records into
// state.level.alienPortals; this file owns the actual entity (creation, AI,
// poop, removal) per Entities.js's own "Fish, Alien, Food, Item" scope.
// updateEntities below is what actually turns a due portal into a real
// alien — kept here rather than in Systems.js so no circular import is
// needed (Systems.js writing plain portal data into state needs no import
// of this file at all).
export function createAlien(x, y, hp) {
  return {
    id: nextId(),
    type: 'alien',
    x, y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    wanderTimer: 0, // 0 so the very first tick immediately picks a heading, same as fish's own wanderTimer
    poopTimer: 0,
    hitFlashMs: 0, // counts down from ALIEN_HIT_FLASH_MS whenever damage is applied (Grid.js's Turret branch, main.js's click handler) — drives the red-flash/bounce read by main.js's render
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
    state.level.alienDeathEffects.push({ x: alien.x, y: alien.y, age: 0 });
    return false;
  }
  const dt = dtMs / 1000;

  if (alien.hitFlashMs > 0) alien.hitFlashMs = Math.max(0, alien.hitFlashMs - dtMs);

  alien.wanderTimer -= dt;
  if (alien.wanderTimer <= 0) {
    alien.wanderTimer = ALIEN_WANDER_INTERVAL_MIN_S + Math.random() * (ALIEN_WANDER_INTERVAL_MAX_S - ALIEN_WANDER_INTERVAL_MIN_S);
    const targetFish = Math.random() < ALIEN_CHASE_CHANCE
      ? findNearestFishWithin(state.level.entities, alien.x, alien.y, ALIEN_AWARENESS_RADIUS)
      : null;
    const angle = targetFish
      ? Math.atan2(targetFish.y - alien.y, targetFish.x - alien.x) + (Math.random() - 0.5) * (Math.PI * 0.7)
      : Math.random() * Math.PI * 2;
    alien.vx = Math.cos(angle) * ALIEN_SPEED;
    alien.vy = Math.sin(angle) * ALIEN_SPEED * FISH_VERTICAL_DAMPING;
  }

  alien.x += alien.vx * dt;
  alien.y += alien.vy * dt;

  if (alien.x < FISH_MIN_X) { alien.x = FISH_MIN_X; alien.vx = Math.abs(alien.vx); }
  if (alien.x > FISH_MAX_X) { alien.x = FISH_MAX_X; alien.vx = -Math.abs(alien.vx); }
  if (alien.y < FISH_MIN_Y) { alien.y = FISH_MIN_Y; alien.vy = Math.abs(alien.vy); }
  if (alien.y > SEABED_FLOOR_Y) { alien.y = SEABED_FLOOR_Y; alien.vy = -Math.abs(alien.vy); } // aliens can't swim into the seabed city either, same rule as fish

  alien.poopTimer += dtMs;
  if (alien.poopTimer >= ALIEN_POOP_INTERVAL_MS) {
    alien.poopTimer = 0;
    state.level.items.push(createWaste(alien.x, alien.y));
    adjustCleanliness(state, -CLEANLINESS_PER_WASTE_EVENT);
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
    researchTickIndex: 0, // pure-Researcher only — which tenth of the current brew cycle's "+0.1" progress bubbles have already fired, see updateFish's RESEARCHER branch
    hungerCriticalSfxPlayed: false, // plays playHunger() once per crossing into HUNGER_CRITICAL_THRESHOLD, reset once hunger drops back below it (e.g. after eating) — see updateFish
    alienNearby: false, // recomputed every tick in updateFish — true while a living alien is within ALIEN_INCOME_BLOCK_RADIUS, driving both the coin-production block and the continuous gray tint (main.js's render)
    capBlockedTintRemainingMs: 0, // counts down from FISH_BLOCKED_TINT_MS whenever a coin drop is blocked by the Coin Cap — the OTHER (timed) source of the gray tint, see triggerProductionBlocked
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

// Called the instant a fish's drop cycle completes but its resource is
// already at its active cap, per direct request ("do NOT spawn the item...
// render a brief bubble-pop/full-belly indicator... play a distinct muted/
// blocked sound effect"). Reuses the existing floatingText particle system
// (same one every other "something happened here" readout in this file
// already uses) rather than a new render path — a muted "🫧" above the
// fish's head instead of a normal +$/+🔬 gain readout. `resource` is only
// ever 'coin' or 'science'; only the coin case also arms the HUD's "shake
// red" cue (state.ui.coinCapFlashPending, read and cleared by UI.js's
// updateHUD next frame — Entities.js has no reason to import UI.js just for
// this one flag, so it's a plain state write, same as every other
// system-to-system signal in this codebase that isn't a direct function
// call) — per direct request, only the Coin HUD element shakes on a blocked
// coin, Science has no equivalent HUD-shake ask.
function triggerProductionBlocked(state, fish, stageDef, resource) {
  state.level.floatingTexts.push(
    createPickupText(fish.x, fish.y - FISH_BASE_SIZE * stageDef.scale * 0.6, '🫧', PRODUCTION_BLOCKED_COLOR)
  );
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
export function trySpawnFood(state, x, y) {
  // Food can only be dropped in open water, never directly into the seabed
  // city — per direct request, after going back and forth on whether to
  // allow it for city-interaction purposes. Doesn't touch where Food ends
  // UP once it's fallen there naturally (still routes/rests on tiles as
  // normal) — only where a fresh pellet can be manually placed.
  if (y >= SEABED_FLOOR_Y) return 'in_city';
  if (state.level.money < FOOD_COST) return 'no_money';
  state.level.money -= FOOD_COST;
  state.level.items.push(createFood(x, y));
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
// scarcity — a Scrub Guppy's speciesId is 'scrub_guppy', never 'guppy', so
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
export function getFishPurchaseCost(state, speciesId) {
  const def = SPECIES[speciesId];
  if (!DYNAMIC_PRICED_SPECIES_IDS.includes(speciesId)) return def.cost;
  const n = countLivingFishOfSpecies(state, speciesId);
  return Math.round(def.cost * Math.pow(ECONOMY_FISH_COST_GROWTH_RATE, n));
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

// Whether a fish is a legal SOURCE for starting a combine-drag: fish merging
// itself has to be unlocked (state.level.upgrades.fishMergingUnlocked — a
// one-time Tank Upgrade purchase, not a Tier unlock any more, see Config.js's
// FISH_MERGING_UNLOCK_COST), the fish an economy species, Adult, and not
// already at the combining cap (a Tier-4 fish has nothing left to combine
// into).
export function isCombinableFish(state, fish) {
  if (!state.level.upgrades.fishMergingUnlocked) return false;
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

const FISH_VANISH_REAPPEAR_MESSAGE = 'JK! You should have seen your face tho';

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
// deliberately just a coarse "has splicing been unlocked at all" pre-check.
// The fine-grained "is THIS specific hybrid combination unlocked" check
// can't happen here — there's no target yet — so it lives in canSpliceFish
// below instead, once both fish are known.
export function isSpliceSource(state, fish) {
  if (!state.meta.labUpgradesPurchased.includes(GENE_SPLICING_LAB_ID)) return false;
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
  // Per direct request, each hybrid combination is its own individual
  // Science Lab purchase now (see SCIENCE_LAB_UPGRADES' scrub_*/volt_*/
  // scholar_* leaf nodes) — pushed into speciesUnlocked the exact same way
  // eel/suckerfish/octopus already are, so this is the one place that
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
// own per-tick open-water branch, right after integrating vx. Clamps to the
// item's own radius in from each edge (reads as bumping the glass, not
// overlapping it) and zeroes vx once it does, so a Fan/sway push doesn't
// keep reapplying against a wall it can't cross.
function clampItemToWorldWalls(item) {
  const margin = item.radius || 0;
  if (item.x < margin) {
    item.x = margin;
    if (item.vx < 0) item.vx = 0;
  } else if (item.x > WORLD_W - margin) {
    item.x = WORLD_W - margin;
    if (item.vx > 0) item.vx = 0;
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
    if (status === 'lost') return false; // fell off the bottom of the world — gone silently
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
    // Waste is no longer spawned per individual item consumed — a Processor
    // now produces it on its own continuously-running background clock
    // instead (Grid.js's updateBuildings, PROCESSOR_STATS' wasteEveryMs),
    // per direct request ("produce 1 waste every N seconds it's
    // processing," not "one waste per item").
    return false;
  }
  if (status === 'lost') {
    // Fell off the bottom of the world with nothing built to catch it — no
    // payout, just a small readout planted at the world's bottom edge (not
    // the item's actual, off-screen-by-now position) so it reads as "you
    // lost that" rather than a silent disappearance that looks like a bug.
    state.level.floatingTexts.push(createPickupText(item.x, WORLD_H, 'Lost!', ITEM_LOST_COLOR));
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
    return false;
  }
  if (status === 'lost') {
    state.level.floatingTexts.push(createPickupText(item.x, WORLD_H, 'Lost!', ITEM_LOST_COLOR));
    return false;
  }
  item.resting = status === 'resting';
  return true;
}

// Waste has no click-bank and nothing consumes it yet (Phase 3) — it just
// falls/routes like a coin and piles up wherever it lands. If it does reach
// a Collector, it's silently removed with no money and no further waste
// spawned (no waste-spawns-waste loop).
function updateWaste(item, state, dtMs) {
  const dt = dtMs / 1000;
  const physics = { gravity: WASTE_GRAVITY, maxFallSpeed: WASTE_MAX_FALL_SPEED };
  if (item.y < SEABED_FLOOR_Y) {
    const fanForce = computeFanForce(state, item);
    integrateItemForces(item, dt, physics, fanForce);
    item.fallTime += dt;
    const swayVx = currentSwayVx(item, WASTE_SWAY_AMPLITUDE, WASTE_SWAY_FREQUENCY, FOOD_SWAY_ENVELOPE_FREQUENCY);
    item.y += item.vy * dt;
    item.x += (item.vx + swayVx) * dt;
    clampItemToWorldWalls(item);
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, physics);
  if (status === 'consumed' || status === 'lost') return false;
  item.resting = status === 'resting';
  return true;
}

function findNearestFood(items, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.type !== 'food') continue;
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
  if (isFirst) pushStoryNotification(state, TANK_POINT_TUTORIAL_MESSAGE);
}

// Returns false if the fish should be removed (starved).
function updateFish(fish, state, dtMs) {
  const def = SPECIES[fish.speciesId];
  const dt = dtMs / 1000;

  // A higher star tier is also less hungry — compounding 10%-per-tier
  // reduction, same ^(starTier-1) pattern as the coin-value multiplier below.
  // starTier defaults to 1 (a no-op ^0 = 1x) for every fish that's never been
  // combined, same as everywhere else star tier is read.
  const hungerRate = def.hungerRate * Math.pow(FISH_STAR_TIER_HUNGER_MULTIPLIER, (fish.starTier || 1) - 1);
  fish.hunger = Math.min(HUNGER_MAX, fish.hunger + hungerRate * dt);
  if (fish.hunger >= HUNGER_MAX) {
    playFishDeath();
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

  // Alien Invasion reactions, per direct request: a fish near a living alien
  // usually (not always — see wander's own ALIEN_FLEE_CHANCE bias) tries to
  // move away from it, and can't produce a coin at all while this close
  // (checked below, only on the coin-drop branch — waste/science/power are
  // untouched). fish.alienNearby also drives the continuous gray tint in
  // main.js's render, separate from the timed Coin-Cap-blocked tint below.
  const nearbyAlien = findNearestAlienWithin(state.level.entities, fish.x, fish.y, ALIEN_AWARENESS_RADIUS);
  fish.alienNearby = !!(nearbyAlien && Math.hypot(nearbyAlien.x - fish.x, nearbyAlien.y - fish.y) <= ALIEN_INCOME_BLOCK_RADIUS);
  if (fish.capBlockedTintRemainingMs > 0) fish.capBlockedTintRemainingMs = Math.max(0, fish.capBlockedTintRemainingMs - dtMs);

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
      : findNearestFood(state.level.items, fish.x, fish.y);
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
        if (isScavenger) {
          // Flat relief, deliberately not tied to the Food Quality Tank
          // Upgrade tree — that tree is themed around player-bought Food
          // specifically, not scavenged Waste. Cleaning up a Waste item
          // also restores cleanliness — the other half of the "buildings
          // and Suckerfish push cleanliness back up" pairing with the
          // per-Waste-spawn penalty above.
          fish.hunger -= WASTE_HUNGER_RELIEF;
          adjustCleanliness(state, CLEANLINESS_PER_WASTE_EVENT);
          if (isPureScavenger) fish.eatCooldownRemainingMs = def.growthStages[fish.stage].dropInterval;
        } else {
          // Food Quality Tank Upgrade: relief is a flat lookup by purchased
          // level, no longer clamped to the fish's current hunger — a
          // higher-quality pellet than the fish actually needed pushes hunger
          // negative (an "overfed" state; no bonus effect reads it yet).
          const relief = FOOD_HUNGER_RELIEF_BY_LEVEL[state.level.upgrades.foodQuality];
          fish.hunger -= relief;
        }
        // Eating fills the coin-drop timer too, so feeding feels like it's
        // what produces the coins — a 20s cycle fed halfway through jumps
        // straight to a drop and restarts the cycle. Not meaningful for a
        // Scavenger (it doesn't use dropTimer at all — see the eat-cooldown
        // branch above), so skipped for it.
        if (!isScavenger) fish.dropTimer += def.growthStages[fish.stage].dropInterval * COIN_TIMER_FEED_BONUS_FRACTION;
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
      // event, so no extra feedback fires for that case).
      const scienceRoom = effectiveScienceCapacity(state) - countTankItemsByType(state, 'science');
      if (scienceRoom <= 0) {
        triggerProductionBlocked(state, fish, stageDef, 'science');
      } else {
        const spawnCount = Math.min(Math.max(1, stageDef.dropValue), scienceRoom);
        for (let i = 0; i < spawnCount; i++) {
          state.level.items.push(createScience(fish.x, fish.y));
        }
      }
    }
  } else if (isPureGenerator) {
    // Distance-based, per direct request ("produces 1MW per 10 pixels swam
    // as a baby, and 1MW per 5 pixels as an adult") — a literal
    // pixels-traveled meter instead of an indirect speed-vs-baseline ratio,
    // so a faster eel (Fish Movement upgrades, a seek-chase's speed boost)
    // naturally generates faster with no separate multiplier needed. `speed`
    // (computed above for the tail-wag) already reflects all of that.
    // Accumulates every tick unconditionally, not gated behind any timer.
    // A hybrid without its own pixelsPerMW field (Scrub-Eel, still
    // single-stage) falls back to the eel's own adult rate.
    const pixelsPerMW = stageDef.pixelsPerMW || 5;
    fish.distanceAccumPx += speed * dt;
    while (fish.distanceAccumPx >= pixelsPerMW) {
      fish.distanceAccumPx -= pixelsPerMW;
      state.level.powerSupply += 1;
      state.level.floatingTexts.push(createPickupText(fish.x, fish.y, '+1 ⚡', POWER_COLOR));
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
    if (fish.dropTimer >= stageDef.dropInterval && fish.alienNearby) {
      fish.dropTimer = 0;
    } else if (fish.dropTimer >= stageDef.dropInterval) {
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
      const dropValue = fish.dropValueOverride != null
        ? fish.dropValueOverride
        : Math.ceil(stageDef.dropValue * Math.pow(FISH_STAR_TIER_VALUE_MULTIPLIER, (fish.starTier || 1) - 1));
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
      state.level.items.push(createWaste(fish.x, fish.y));
      adjustCleanliness(state, -CLEANLINESS_PER_WASTE_EVENT);
    }
  }

  return true;
}

function updatePickupText(item, dtMs) {
  item.age += dtMs;
  item.y -= PICKUP_TEXT_RISE_SPEED * (dtMs / 1000);
  return item.age < PICKUP_TEXT_LIFETIME_MS;
}

// "You found the chat" gag (UI.js's notification-log expand handler starts
// the DELAY, not the vanish itself — see fishVanishDelayMs below) — every
// fish freezes exactly as it was (position, hunger, coin-drop timer,
// everything) for FISH_VANISH_DURATION_MS by simply skipping updateFish
// entirely while the timer is running, then resumes on its own the tick the
// timer reaches 0. main.js's render() separately skips drawing any fish for
// the same duration — this function only owns the freeze/timer, not the
// "invisible" part.
//
// Per direct request, the vanish itself doesn't start the instant the chat
// closes any more — fishVanishDelayMs counts down first (FISH_VANISH_DELAY_MS,
// set by UI.js), so the "curiosity kills the fish" line gets a beat to land
// before anything visibly happens. The delay and the real vanish timer are
// deliberately two separate fields rather than one repurposed countdown —
// main.js's render loop and this function's own "is anything frozen right
// now" checks only ever look at fishVanishTimer, so nothing needs to learn
// about the delay's existence except this one function that resolves it.
function updateFishVanish(state, dtMs) {
  if (state.level.fishVanishDelayMs > 0) {
    state.level.fishVanishDelayMs = Math.max(0, state.level.fishVanishDelayMs - dtMs);
    if (state.level.fishVanishDelayMs === 0) state.level.fishVanishTimer = FISH_VANISH_DURATION_MS; // the delay just elapsed — start the real vanish now
    return;
  }
  if (state.level.fishVanishTimer <= 0) return;
  state.level.fishVanishTimer = Math.max(0, state.level.fishVanishTimer - dtMs);
  if (state.level.fishVanishTimer === 0) pushStoryNotification(state, FISH_VANISH_REAPPEAR_MESSAGE);
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
      state.level.entities.push(createAlien(portal.x, portal.y, portal.hp));
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
    const dx = target.x - shot.x;
    const dy = target.y - shot.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= TURRET_PROJECTILE_HIT_RADIUS) {
      target.hp -= shot.damage;
      target.hitFlashMs = ALIEN_HIT_FLASH_MS; // per direct request — a hit flashes red and "bounces," read back by main.js's render
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

export function updateEntities(state, dtMs) {
  updateFishVanish(state, dtMs);
  updateAlienPortals(state);
  updateAlienDeathEffects(state, dtMs);
  pendingFoodToWasteSpawns.length = 0; // updateFood (below) fills this — see its own comment for why it can't push into state.level.items directly
  state.level.items = state.level.items.filter((item) => {
    if (item.type === 'food') return updateFood(item, state, dtMs);
    if (item.type === 'coin') return updateCoin(item, state, dtMs);
    if (item.type === 'science') return updateScience(item, state, dtMs);
    if (item.type === 'waste') return updateWaste(item, state, dtMs);
    return true;
  });

  // Processor: banks coins/Science on its own per-item hold (each item's own
  // per-tick step above reports 'consumed'); also now produces Waste on a
  // continuously-running background clock. Auto-Feeder: absorbs nearby
  // Waste, dispenses Food from its output port once its tier's required
  // number of loads have processed. See Grid.js's updateBuildings — it
  // returns spawn points rather than constructing the items itself, to
  // avoid a circular import (createFood/createWaste live here).
  const { foodSpawnPoints, wasteSpawnPoints, turretShots } = updateBuildings(state, dtMs);
  for (const point of foodSpawnPoints) state.level.items.push(createFood(point.x, point.y));
  for (const point of wasteSpawnPoints) state.level.items.push(createWaste(point.x, point.y));
  for (const point of pendingFoodToWasteSpawns) state.level.items.push(createWaste(point.x, point.y));
  for (const shot of turretShots) state.level.turretProjectiles.push(createTurretProjectile(shot));
  // Runs before the entities filter loop below, same as the old direct-
  // mutation turret code did, so a lethal hit lands and gets cleaned up in
  // the same tick rather than lingering a frame at 0 hp.
  updateTurretProjectiles(state, dtMs);

  resolveItemCollisions(state); // items in the seabed band can't overlap — see Grid.js's module comment

  state.level.floatingTexts = state.level.floatingTexts.filter((ft) => updatePickupText(ft, dtMs));

  state.level.entities = state.level.entities.filter((entity) => {
    if (entity.type === 'fish') return state.level.fishVanishTimer > 0 ? true : updateFish(entity, state, dtMs);
    if (entity.type === 'alien') return updateAlien(entity, state, dtMs);
    return true;
  });
}
