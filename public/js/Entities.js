// Entities.js — Food, Coin, and the single species-driven Fish entity.
// Owns state.level.entities and state.level.items contents and their
// per-tick behavior. Forbidden: no rendering (main.js's render pass owns
// that), no tile placement (Grid.js owns that).

import {
  SPECIES,
  FOOD_RADIUS,
  FOOD_COST,
  FOOD_FLOOR_GRACE_MS,
  COIN_RADIUS,
  COIN_CLICK_RADIUS_MULTIPLIER,
  FISH_EAT_RADIUS,
  HUNGER_MAX,
  HUNGER_SEEK_THRESHOLD,
  FOOD_HUNGER_RELIEF_BY_LEVEL,
  FISH_VERTICAL_DAMPING,
  WANDER_INTERVAL_MIN_S,
  WANDER_INTERVAL_MAX_S,
  GRAVITY,
  MAX_FALL_SPEED,
  FOOD_GRAVITY,
  FOOD_MAX_FALL_SPEED,
  FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL,
  FOOD_WAVE_SPEED,
  FOOD_WAVE_COUNT_MIN,
  FOOD_WAVE_COUNT_MAX,
  FOOD_WAVE_PERIOD_MIN_S,
  FOOD_WAVE_PERIOD_MAX_S,
  COIN_TIERS,
  PICKUP_TEXT_LIFETIME_MS,
  PICKUP_TEXT_RISE_SPEED,
  FISH_SEEK_SPEED_MULTIPLIER,
  FISH_MOVEMENT_UPGRADE_SPEED_BONUS,
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
  ITEM_MASS_BY_TYPE,
  FOOD_MAX_ON_SCREEN_BASE,
  FOOD_CAPACITY_UPGRADE_INCREMENT,
} from './Config.js';
import { stepItemOnGrid, resolveItemCollisions } from './Grid.js';

let _nextId = 1;
function nextId() {
  return _nextId++;
}

// How long a straight drop from startY to the floor would take under food's
// physics — used only to spread this pellet's sway bursts across its fall,
// not for the actual per-tick motion (that's still driven by real gravity).
function estimateFoodFallTime(startY) {
  const distance = Math.max(0, SEABED_FLOOR_Y - startY);
  const timeToTerminal = FOOD_MAX_FALL_SPEED / FOOD_GRAVITY;
  const distanceToTerminal = (FOOD_MAX_FALL_SPEED * FOOD_MAX_FALL_SPEED) / (2 * FOOD_GRAVITY);
  if (distance <= distanceToTerminal) return Math.sqrt((2 * distance) / FOOD_GRAVITY);
  return timeToTerminal + (distance - distanceToTerminal) / FOOD_MAX_FALL_SPEED;
}

// A handful of distinct sway bursts (not continuous wavering) scattered
// across the fall — one roughly-even slot per burst, jittered within the
// first part of its slot so the burst's own period has room to play out.
function createSwayEvents(fallTime) {
  const count = FOOD_WAVE_COUNT_MIN + Math.floor(Math.random() * (FOOD_WAVE_COUNT_MAX - FOOD_WAVE_COUNT_MIN + 1));
  const slotWidth = fallTime / count;
  const events = [];
  for (let i = 0; i < count; i++) {
    const period = FOOD_WAVE_PERIOD_MIN_S + Math.random() * (FOOD_WAVE_PERIOD_MAX_S - FOOD_WAVE_PERIOD_MIN_S);
    const startTime = slotWidth * i + Math.random() * slotWidth * 0.4;
    events.push({ startTime, endTime: startTime + period, period, phase: Math.random() * Math.PI * 2 });
  }
  return events;
}

// Returns the pellet's current sideways speed: 0 unless fallTime falls
// inside one of its scheduled sway bursts, in which case it's mid-sine-wave.
function currentSwayVx(item) {
  for (const ev of item.swayEvents) {
    if (item.fallTime >= ev.startTime && item.fallTime < ev.endTime) {
      const localT = item.fallTime - ev.startTime;
      return FOOD_WAVE_SPEED * Math.sin((localT / ev.period) * 2 * Math.PI + ev.phase);
    }
  }
  return 0;
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
    restingOnFloor: false,
    floorTimer: 0,
    fallTime: 0,
    swayEvents: createSwayEvents(estimateFoodFallTime(y)),
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
  return { id: nextId(), type: 'waste', x, y, vx: 0, vy: 0, radius: WASTE_RADIUS, mass: ITEM_MASS_BY_TYPE.waste, resting: false };
}

export function createPickupText(x, y, text, color) {
  return { id: nextId(), type: 'pickupText', x, y, text, color, age: 0 };
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
  return def.swimSpeed + FISH_MOVEMENT_UPGRADE_SPEED_BONUS * state.level.upgrades.fishMovement;
}

export function createFish(speciesId, x, y, state, { grown = false } = {}) {
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
    wanderTimer: 0,
    tailPhase: 0, // only rendered once fully grown; advances faster the faster the fish is currently moving
  };
}

// Food Capacity Tank Upgrade: how many food pellets can exist at once — see
// Config.js's FOOD_MAX_ON_SCREEN_BASE. Counts state.level.items directly
// rather than tracking a running total, since food is removed from that
// array in several different places (eaten, despawned, lost) and a cached
// counter would drift out of sync with any of them.
export function effectiveFoodCapacity(state) {
  return FOOD_MAX_ON_SCREEN_BASE + FOOD_CAPACITY_UPGRADE_INCREMENT * state.level.upgrades.foodCapacity;
}

export function trySpawnFood(state, x, y) {
  if (state.level.money < FOOD_COST) return false;
  const currentFoodCount = state.level.items.reduce((n, item) => n + (item.type === 'food' ? 1 : 0), 0);
  if (currentFoodCount >= effectiveFoodCapacity(state)) return false;
  state.level.money -= FOOD_COST;
  state.level.items.push(createFood(x, y));
  return true;
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
      state.level.money += item.value;
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

// While item.y < SEABED_FLOOR_Y it's still in open water and falls exactly
// as before. Once it crosses that boundary, Grid.js's stepItemOnGrid owns
// its motion for the rest of its life (tile collision, ramps, blasters,
// collectors, item-item drift) — see Grid.js's module comment for why the
// split falls there, and CLAUDE.md's "Items can't stack, and can fall off
// the bottom" for why this now runs every tick forever instead of stopping
// once an item is first marked resting: resting is re-evaluated fresh every
// tick (there's no "settled, stop simulating" state any more), so an item
// that's knocked off whatever it was resting on by resolveItemCollisions
// picks the fall back up on its very next step, the same as if a tile had
// been removed out from under it. `spawned` collects any new items these
// produce (Waste, on a Collector consuming this one) — pushed there instead
// of straight into state.level.items because this runs inside
// updateEntities's filter callback over that same array, and
// Array.prototype.filter only visits the length it captured at the start;
// anything pushed onto the live array mid-pass would silently be dropped
// once the filter's result replaces it. See updateEntities below.
function updateFood(item, state, dtMs, spawned) {
  const dt = dtMs / 1000;
  // Food Quality Tank Upgrade: each purchased level sinks 5% slower (both
  // the acceleration and the terminal velocity scale down together, so the
  // whole fall profile shrinks rather than just capping speed later).
  const sinkMultiplier = 1 - FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL * state.level.upgrades.foodQuality;
  const gravity = FOOD_GRAVITY * sinkMultiplier;
  const maxFallSpeed = FOOD_MAX_FALL_SPEED * sinkMultiplier;
  if (item.y < SEABED_FLOOR_Y) {
    item.vy = Math.min(item.vy + gravity * dt, maxFallSpeed);
    item.fallTime += dt;
    const vx = currentSwayVx(item);
    item.x += vx * dt;
    item.y += item.vy * dt;
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, { gravity, maxFallSpeed });
  if (status === 'consumed') {
    state.level.gridStats.itemsRoutedTotal += 1;
    spawned.push(createWaste(item.x, item.y)); // a basic Collector is unpowered and dirty — see Config.js's WASTE_* comment
    return false;
  }
  if (status === 'lost') return false; // fell off the bottom of the world — gone silently, same as food already does elsewhere

  item.restingOnFloor = status === 'resting';
  if (item.restingOnFloor) {
    item.floorTimer += dtMs;
    if (item.floorTimer >= FOOD_FLOOR_GRACE_MS) return false; // a nearby fish had its chance and didn't take it
  } else {
    item.floorTimer = 0; // knocked around (or never landed yet) — the grace period only counts time spent genuinely settled
  }
  return true;
}

function updateCoin(item, state, dtMs, spawned) {
  const dt = dtMs / 1000;
  if (item.y < SEABED_FLOOR_Y) {
    item.vy = Math.min(item.vy + GRAVITY * dt, MAX_FALL_SPEED);
    item.y += item.vy * dt;
    // vx only ever comes from a Blaster's angled launch (see Grid.js's
    // launchFromBlaster) or residual seabed item-item drift — open water has
    // nothing to collide with, so it's just carried through unchanged, a
    // plain ballistic arc with no horizontal damping.
    item.x += (item.vx || 0) * dt;
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, { gravity: GRAVITY, maxFallSpeed: MAX_FALL_SPEED });
  if (status === 'consumed') {
    state.level.money += item.value;
    state.level.floatingTexts.push(createPickupText(item.x, item.y, `+$${item.value}`, getCoinColor(item.value)));
    state.level.gridStats.itemsRoutedTotal += 1;
    spawned.push(createWaste(item.x, item.y)); // a basic Collector is unpowered and dirty — see Config.js's WASTE_* comment
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

// Waste has no click-bank and nothing consumes it yet (Phase 3) — it just
// falls/routes like a coin and piles up wherever it lands. If it does reach
// a Collector, it's silently removed with no money and no further waste
// spawned (no waste-spawns-waste loop).
function updateWaste(item, state, dtMs) {
  const dt = dtMs / 1000;
  if (item.y < SEABED_FLOOR_Y) {
    item.vy = Math.min(item.vy + WASTE_GRAVITY * dt, WASTE_MAX_FALL_SPEED);
    item.y += item.vy * dt;
    item.x += (item.vx || 0) * dt; // see updateCoin's comment — same open-water ballistic carry-through
    return true;
  }
  const status = stepItemOnGrid(item, state, dt, { gravity: WASTE_GRAVITY, maxFallSpeed: WASTE_MAX_FALL_SPEED });
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

function wander(fish, def, state, dt) {
  fish.wanderTimer -= dt;
  if (fish.wanderTimer <= 0) {
    const angle = Math.random() * Math.PI * 2;
    const speed = effectiveSwimSpeed(def, state);
    fish.vx = Math.cos(angle) * speed;
    fish.vy = Math.sin(angle) * speed * FISH_VERTICAL_DAMPING;
    fish.wanderTimer = WANDER_INTERVAL_MIN_S + Math.random() * (WANDER_INTERVAL_MAX_S - WANDER_INTERVAL_MIN_S);
  }
}

const TANK_POINT_TUTORIAL_MESSAGE =
  "A fish just grew up — that's your first Tank Point ⭐! Spend Tank Points in the Tank Upgrades panel (the button below the Shop) on better food, faster fish, and more.";

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
  if (isFirst) {
    const notifications = state.level.notifications;
    notifications.push({ id: notifications.length + 1, text: TANK_POINT_TUTORIAL_MESSAGE, elapsed: state.level.elapsed });
    if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
  }
}

// Returns false if the fish should be removed (starved).
function updateFish(fish, state, dtMs) {
  const def = SPECIES[fish.speciesId];
  const dt = dtMs / 1000;

  fish.hunger = Math.min(HUNGER_MAX, fish.hunger + def.hungerRate * dt);
  if (fish.hunger >= HUNGER_MAX) return false; // starves if hunger maxes out

  if (fish.hunger >= HUNGER_SEEK_THRESHOLD) {
    const target = findNearestFood(state.level.items, fish.x, fish.y);
    if (target) {
      const dx = target.x - fish.x;
      const dy = target.y - fish.y;
      const dist = Math.hypot(dx, dy) || 1;
      const seekSpeed = effectiveSwimSpeed(def, state) * FISH_SEEK_SPEED_MULTIPLIER; // top speed — only while actively chasing food
      fish.vx = (dx / dist) * seekSpeed;
      fish.vy = (dy / dist) * seekSpeed;
      if (dist <= FISH_EAT_RADIUS) {
        const idx = state.level.items.indexOf(target);
        if (idx !== -1) state.level.items.splice(idx, 1);
        // Food Quality Tank Upgrade: relief is a flat lookup by purchased
        // level, no longer clamped to the fish's current hunger — a
        // higher-quality pellet than the fish actually needed pushes hunger
        // negative (an "overfed" state; no bonus effect reads it yet).
        const relief = FOOD_HUNGER_RELIEF_BY_LEVEL[state.level.upgrades.foodQuality];
        fish.hunger -= relief;
        // Eating fills the coin-drop timer too, so feeding feels like it's
        // what produces the coins — a 20s cycle fed halfway through jumps
        // straight to a drop and restarts the cycle.
        fish.dropTimer += def.growthStages[fish.stage].dropInterval * COIN_TIMER_FEED_BONUS_FRACTION;
        fish.totalFeeds += 1;
        const wasAdult = fish.stage === def.growthStages.length - 1;
        fish.stage = stageIndexForFeeds(def, fish.totalFeeds);
        if (!wasAdult && fish.stage === def.growthStages.length - 1) {
          awardTankPoint(state, fish);
        }
      }
    } else {
      wander(fish, def, state, dt);
    }
  } else {
    wander(fish, def, state, dt);
  }

  fish.x += fish.vx * dt;
  fish.y += fish.vy * dt;

  if (fish.x < FISH_MIN_X) { fish.x = FISH_MIN_X; fish.vx = Math.abs(fish.vx); }
  if (fish.x > FISH_MAX_X) { fish.x = FISH_MAX_X; fish.vx = -Math.abs(fish.vx); }
  if (fish.y < FISH_MIN_Y) { fish.y = FISH_MIN_Y; fish.vy = Math.abs(fish.vy); }
  // Bottom bound is the true floor, not FISH_MAX_Y's 5% spawn margin — fish
  // need to be able to swim all the way down to reach food/coins resting
  // right on the seabed. Only spawning stays clear of that bottom margin.
  if (fish.y > SEABED_FLOOR_Y) { fish.y = SEABED_FLOOR_Y; fish.vy = -Math.abs(fish.vy); }

  const speed = Math.hypot(fish.vx, fish.vy);
  fish.tailPhase = (fish.tailPhase + speed * TAIL_WAG_RATE * dt) % (Math.PI * 2);

  const stageDef = def.growthStages[fish.stage];
  fish.dropTimer += dtMs;
  if (fish.dropTimer >= stageDef.dropInterval) {
    fish.dropTimer = 0;
    state.level.items.push(createCoin(fish.x, fish.y, stageDef.dropValue));
  }

  return true;
}

function updatePickupText(item, dtMs) {
  item.age += dtMs;
  item.y -= PICKUP_TEXT_RISE_SPEED * (dtMs / 1000);
  return item.age < PICKUP_TEXT_LIFETIME_MS;
}

export function updateEntities(state, dtMs) {
  const spawned = []; // Waste items produced this tick — see updateFood/updateCoin's comment for why these can't be pushed straight into state.level.items mid-filter
  state.level.items = state.level.items.filter((item) => {
    if (item.type === 'food') return updateFood(item, state, dtMs, spawned);
    if (item.type === 'coin') return updateCoin(item, state, dtMs, spawned);
    if (item.type === 'waste') return updateWaste(item, state, dtMs);
    return true;
  });
  if (spawned.length) state.level.items.push(...spawned);
  resolveItemCollisions(state); // items in the seabed band can't overlap — see Grid.js's module comment

  state.level.floatingTexts = state.level.floatingTexts.filter((ft) => updatePickupText(ft, dtMs));

  state.level.entities = state.level.entities.filter((entity) => {
    if (entity.type === 'fish') return updateFish(entity, state, dtMs);
    return true;
  });
}
