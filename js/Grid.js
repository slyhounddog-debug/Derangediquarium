// Grid.js — seabed tile array, gravity/fan-force physics for items once they
// reach the seabed, ramp/collector/auto-feeder routing, platform anchoring.
// Owns state.level.grid and state.level.buildingData.
// Forbidden: no fish logic, no camera math.

import {
  TILE_SIZE,
  WORLD_TILES_W,
  WORLD_TILES_H,
  WORLD_H,
  SEABED_ROW_START,
  TILE_EMPTY,
  TILE_PLATFORM,
  TILE_RAMP_LEFT,
  TILE_RAMP_RIGHT,
  TILE_COLLECTOR,
  TILE_FAN_T2,
  TILE_FAN_T3,
  TILE_FAN_T4,
  TILE_AUTO_FEEDER,
  BUILDING_TYPES,
  TILE_REFUND_FRACTION,
  GRID_SWEEP_SUBSTEP,
  RAMP_NUDGE_DISTANCE,
  ITEM_LOST_BELOW_WORLD_MARGIN_PX,
  ITEM_HORIZONTAL_DAMPING,
  ITEM_COLLISION_ITERATIONS,
  ITEM_MIN_HORIZONTAL_PUSH_FRACTION,
  ITEM_PUSH_IMPULSE_SPEED,
  ITEM_MAX_PUSH_PER_STEP,
  ITEM_PUSH_IMPULSE_MIN_OVERLAP,
  ITEM_ON_ITEM_LANDING_VY_CAP,
  COLLECTOR_PROCESS_DURATION_MS,
  COLLECTOR_PULL_STRENGTH,
  COLLECTOR_PROCESSING_MASS,
  COLLECTOR_CIRCLE_RADIUS_FRACTION,
  FAN_CONE_HALF_ANGLE_DEG,
  FAN_T2_MAX_FORCE, FAN_T2_MAX_RANGE, FAN_T2_POWER_COST,
  FAN_T3_MAX_FORCE, FAN_T3_MAX_RANGE, FAN_T3_POWER_COST,
  FAN_T4_MAX_FORCE, FAN_T4_MAX_RANGE, FAN_T4_POWER_COST,
  AUTO_FEEDER_INTAKE_RADIUS,
  AUTO_FEEDER_PROCESS_DURATION_MS,
  AUTO_FEEDER_PORT_OFFSET_FRACTION,
  NOTIFICATION_LOG_MAX,
  CLEANLINESS_MAX,
  CLEANLINESS_PER_WASTE_EVENT,
} from './Config.js';
import { worldToScreen } from './Engine.js';

// One-time story/tutorial notifications — see state.level.tutorialFlags and
// CLAUDE.md's "Story & Tutorial Notifications" section.
const FIRST_BUILDING_PLACED_MESSAGE = "You just placed your first piece of seabed hardware. Welcome to factory brain — there's no swimming back from this now.";
const FIRST_FAN_PLACED_MESSAGE = 'fancy fan....oooo you fancy';

function pushGridNotification(state, text) {
  const notifications = state.level.notifications;
  notifications.push({ id: notifications.length + 1, text, elapsed: state.level.elapsed });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
}

// Tiles an item's fall (or rise) is arrested by. Ramps are deliberately NOT
// solid — see RAMP_NUDGE_DISTANCE's comment in Config.js: they're a
// pass-through nudge, not a surface anything lands or rests on.
const SOLID_TILES = new Set([TILE_PLATFORM, TILE_COLLECTOR, TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4, TILE_AUTO_FEEDER]);
const RAMP_TILES = new Set([TILE_RAMP_LEFT, TILE_RAMP_RIGHT]);
const FAN_TILES = new Set([TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4]);

// Per-tier fan stats, keyed by tile id — Grid.js's own lookup table (not
// duplicated onto BUILDING_TYPES, which is presentation/shop data).
const FAN_STATS = {
  [TILE_FAN_T2]: { maxForce: FAN_T2_MAX_FORCE, maxRange: FAN_T2_MAX_RANGE, powerCost: FAN_T2_POWER_COST },
  [TILE_FAN_T3]: { maxForce: FAN_T3_MAX_FORCE, maxRange: FAN_T3_MAX_RANGE, powerCost: FAN_T3_POWER_COST },
  [TILE_FAN_T4]: { maxForce: FAN_T4_MAX_FORCE, maxRange: FAN_T4_MAX_RANGE, powerCost: FAN_T4_POWER_COST },
};
const FAN_CONE_HALF_ANGLE_RAD = (FAN_CONE_HALF_ANGLE_DEG * Math.PI) / 180;

export function createGrid() {
  const grid = [];
  for (let r = 0; r < WORLD_TILES_H; r++) grid.push(new Array(WORLD_TILES_W).fill(TILE_EMPTY));
  return grid;
}

function colAt(x) {
  return Math.floor(x / TILE_SIZE);
}
function rowAt(y) {
  return Math.floor(y / TILE_SIZE);
}
function buildingKey(col, row) {
  return `${row},${col}`;
}

// Past the world's side/top edges reads as TILE_PLATFORM-equivalent solid
// (nothing needs to fall off the sides — reuses the same "wall" behavior via
// SOLID_TILES.has check below returning true for this sentinel). Past the
// *bottom* edge reads as TILE_EMPTY instead — there is deliberately no floor
// down there any more: an item that reaches it just keeps falling, and
// stepItemOnGrid deletes it once it's fallen ITEM_LOST_BELOW_WORLD_MARGIN_PX
// past WORLD_H (see that function). An unbuilt level doesn't catch anything
// for free any more; the player has to build something to actually keep an
// item.
const BOUNDARY_WALL = '__boundary_wall__'; // not a real BUILDING_TYPES entry — only ever compared against via SOLID_TILES.has below, which is checked with a manual `|| tile === BOUNDARY_WALL` at each call site that needs it
function tileAt(grid, x, y) {
  const row = rowAt(y);
  const col = colAt(x);
  if (col < 0 || col >= WORLD_TILES_W) return BOUNDARY_WALL;
  if (row < 0) return BOUNDARY_WALL;
  if (row >= WORLD_TILES_H) return TILE_EMPTY;
  return grid[row][col];
}
function isSolid(tile) {
  return tile === BOUNDARY_WALL || SOLID_TILES.has(tile);
}

// col/row here are tile indices, not world px — used by build-mode UI/main.js.
export function getTile(grid, col, row) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  return grid[row][col];
}

export function worldToTile(x, y) {
  return { col: colAt(x), row: rowAt(y) };
}

// A non-Platform building must be adjacent (up/down/left/right) to a
// Platform tile, or sit directly on the world's absolute bottom row (the
// true seabed floor, resting on solid ground with nothing needed to anchor
// to). Platform itself is exempt — it's what everything else anchors to, so
// it has to be placeable on its own.
function isAnchored(grid, col, row, buildingId) {
  if (buildingId === TILE_PLATFORM) return true;
  if (row === WORLD_TILES_H - 1) return true; // resting on the literal seabed floor
  const neighbors = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
  for (const [r, c] of neighbors) {
    if (r < 0 || r >= WORLD_TILES_H || c < 0 || c >= WORLD_TILES_W) continue;
    if (grid[r][c] === TILE_PLATFORM) return true;
  }
  return false;
}

// Returns { ok, reason } rather than a bare bool so the build-mode UI can
// show *why* a placement is invalid (ghost preview tint, tooltip, etc).
export function canPlaceTile(state, col, row, buildingId) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) {
    return { ok: false, reason: 'out of bounds' };
  }
  if (state.level.grid[row][col] !== TILE_EMPTY) return { ok: false, reason: 'occupied' };
  const building = BUILDING_TYPES[buildingId];
  if (!building) return { ok: false, reason: 'unknown building' };
  if (state.level.money < building.cost) return { ok: false, reason: 'cannot afford' };
  if (!isAnchored(state.level.grid, col, row, buildingId)) {
    return { ok: false, reason: 'must be anchored to a Platform or the seabed floor' };
  }
  return { ok: true, reason: null };
}

// `angle` (radians, atan2 convention: 0 = +x/right, +y is down) is only
// meaningful for Fans and the Auto-Feeder — it's the direction locked in at
// placement (see UI/main.js's build-drag, which derives it from the cursor's
// exact sub-tile position). Stored in state.level.buildingData, keyed by
// "row,col", since the grid array itself only holds a bare type id string.
export function placeTile(state, col, row, buildingId, angle = 0) {
  const check = canPlaceTile(state, col, row, buildingId);
  if (!check.ok) return false;
  state.level.money -= BUILDING_TYPES[buildingId].cost;
  state.level.grid[row][col] = buildingId;
  if (FAN_TILES.has(buildingId)) {
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, angle };
  } else if (buildingId === TILE_AUTO_FEEDER) {
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, angle, absorbing: false, progressMs: 0 };
  }
  if (!state.level.tutorialFlags.firstBuildingPlaced) {
    state.level.tutorialFlags.firstBuildingPlaced = true;
    pushGridNotification(state, FIRST_BUILDING_PLACED_MESSAGE);
  }
  if (FAN_TILES.has(buildingId) && !state.level.tutorialFlags.firstFanPlaced) {
    state.level.tutorialFlags.firstFanPlaced = true;
    pushGridNotification(state, FIRST_FAN_PLACED_MESSAGE);
  }
  return true;
}

// Refunds a fraction of the removed building's cost — never removes a tile
// an item happens to be riding mid-tick; physics only ever reads the grid at
// the start of an item's step, so a same-tick removal is safe either way.
export function removeTile(state, col, row) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return false;
  const existing = state.level.grid[row][col];
  if (existing === TILE_EMPTY) return false;
  const building = BUILDING_TYPES[existing];
  state.level.grid[row][col] = TILE_EMPTY;
  delete state.level.buildingData[buildingKey(col, row)];
  if (building) state.level.money += Math.floor(building.cost * TILE_REFUND_FRACTION);
  return true;
}

// T debug key — cycles the tile under the cursor through every building type
// (plus empty) for free, ignoring cost/occupancy/anchoring. Fans/Auto-Feeder
// default to pointing straight up (toward the water column) since that's the
// most useful direction to test filtration with.
const CHEAT_CYCLE = [
  TILE_EMPTY, TILE_PLATFORM, TILE_RAMP_LEFT, TILE_RAMP_RIGHT, TILE_COLLECTOR,
  TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4, TILE_AUTO_FEEDER,
];
const CHEAT_DEFAULT_ANGLE = -Math.PI / 2; // straight up
export function cycleTileCheat(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return;
  const current = state.level.grid[row][col];
  const idx = CHEAT_CYCLE.indexOf(current);
  const next = CHEAT_CYCLE[(idx + 1) % CHEAT_CYCLE.length];
  state.level.grid[row][col] = next;
  delete state.level.buildingData[buildingKey(col, row)];
  if (FAN_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE };
  } else if (next === TILE_AUTO_FEEDER) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE, absorbing: false, progressMs: 0 };
  }
}

// ---- Directional Fan force field ----
// Sums a force vector from every Fan whose cone currently contains `item`,
// regardless of whether the item is in open water or the seabed band — a
// Fan's whole purpose is launching things back up into the water column, so
// its influence isn't confined to seabed-band physics. The cone blows in a
// FIXED direction (the fan's own aim angle), uniformly across its width —
// not radiating outward from the fan's position like an explosion — with
// force decaying linearly to 0 at maxRange. No occlusion: a Platform or
// another building between the fan and the item doesn't block the cone
// (a deliberate simplification, not an oversight).
export function computeFanForce(state, item) {
  let fx = 0;
  let fy = 0;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const stats = FAN_STATS[data.type];
    if (!stats) continue; // not a fan (e.g. the Auto-Feeder's own buildingData entry)
    const [row, col] = key.split(',').map(Number);
    const fanX = col * TILE_SIZE + TILE_SIZE / 2;
    const fanY = row * TILE_SIZE + TILE_SIZE / 2;
    const dx = item.x - fanX;
    const dy = item.y - fanY;
    const dist = Math.hypot(dx, dy);
    if (dist > stats.maxRange) continue;
    const angleToItem = Math.atan2(dy, dx);
    let angleDiff = angleToItem - data.angle;
    angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff)); // normalize to [-PI, PI]
    if (Math.abs(angleDiff) > FAN_CONE_HALF_ANGLE_RAD) continue;
    const magnitude = stats.maxForce * (1 - dist / stats.maxRange);
    fx += Math.cos(data.angle) * magnitude;
    fy += Math.sin(data.angle) * magnitude;
  }
  return { fx, fy };
}

// Unified force integrator used for BOTH open-water motion (called from
// Entities.js) and seabed-band motion (called below, inside
// stepItemOnGrid) — the same physics apply everywhere so a Fan's push
// doesn't behave differently depending which side of SEABED_FLOOR_Y an item
// happens to be on.
//
// Gravity is F_gravity = mass * g, so a_gravity = F_gravity / mass = g —
// mass-independent, same as real gravity, same as this game's fall behavior
// always was. Fan thrust IS mass-dependent (a_fan = F_fan / mass), which is
// the whole point of the Mass Hierarchy: a heavy coin barely accelerates
// under a given fan force while a light food pellet leaps away.
//
// Drag is linear (a_drag = -drag * v), derived per item type from its own
// existing gravity/maxFallSpeed ratio so an un-pushed item's fall still
// converges to exactly the same terminal velocity as before this system
// existed — physics.gravity/physics.maxFallSpeed already encodes that ratio
// (e.g. GRAVITY/MAX_FALL_SPEED for a coin), reused here rather than adding a
// separate drag constant per item type.
export function integrateItemForces(item, dt, physics, fanForce) {
  const drag = physics.gravity / physics.maxFallSpeed;
  const ax = fanForce.fx / item.mass - drag * (item.vx || 0);
  const ay = fanForce.fy / item.mass + physics.gravity - drag * (item.vy || 0);
  item.vx = (item.vx || 0) + ax * dt;
  item.vy = (item.vy || 0) + ay * dt;
}

// A Ramp doesn't arrest vertical motion at all — see RAMP_NUDGE_DISTANCE's
// comment in Config.js. Whatever row of the grid an item's center currently
// sits in, if that's a Ramp tile, it gets shoved sideways by exactly one
// tile width in that ramp's direction — once per row, tracked via
// item.rampNudgedRow so a slow-moving item lingering in the same row for
// several ticks doesn't get re-nudged every tick (that would read as rapid
// stuttering, not "moved one tile"). Clearing rampNudgedRow the moment the
// item is no longer sitting in a ramp row at all means it's free to be
// nudged again by a *different* ramp encountered later — including a second
// ramp of the same direction placed right below the first, which just
// chains the push (a reasonable, not specially-blocked, way to move
// something further than one tile).
function applyRampNudge(item, grid) {
  const row = rowAt(item.y);
  const col = colAt(item.x);
  if (row < 0 || row >= grid.length) {
    item.rampNudgedRow = null;
    return;
  }
  const tile = grid[row][col];
  if (!RAMP_TILES.has(tile)) {
    item.rampNudgedRow = null;
    return;
  }
  if (item.rampNudgedRow === row) return; // already nudged for this row — don't repeat every tick while still passing through it
  const dir = tile === TILE_RAMP_LEFT ? -1 : 1;
  const targetX = item.x + dir * RAMP_NUDGE_DISTANCE;
  if (!isSolid(tileAt(grid, targetX, item.y))) item.x = targetX; // don't shove it into a wall — it'll just keep moving through this row untouched instead
  item.rampNudgedRow = row;
}

// Sub-steps every swept move in chunks no larger than GRID_SWEEP_SUBSTEP so
// a landing tile (or a Ramp row) can never be skipped over in a single step,
// regardless of how fast the item is currently moving in either direction
// (this is what makes it "swept" rather than a plain end-of-tick position
// check, which could tunnel through a tile if a future speed constant ever
// got fast enough to clear one in a single tick).
function sweepVertical(item, grid, dy) {
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / GRID_SWEEP_SUBSTEP));
  const stepY = dy / steps;
  for (let i = 0; i < steps; i++) {
    const nextBottom = item.y + stepY + item.radius;
    const tile = tileAt(grid, item.x, nextBottom);
    if (isSolid(tile)) {
      const row = rowAt(nextBottom);
      item.y = row * TILE_SIZE - item.radius; // rest exactly on top of the tile, not overshot into it
      item.vy = 0;
      return { landed: true, tile, row, col: colAt(item.x) };
    }
    item.y += stepY;
    applyRampNudge(item, grid); // every sub-step, not just once at the end of the tick — otherwise a fast enough item could cross an entire ramp row within one tick without this ever seeing it sitting inside that row
  }
  return { landed: false };
}

// A Collector doesn't bank an item the instant it lands — it starts a
// COLLECTOR_PROCESS_DURATION_MS hold (see stepCollectorProcessing), visibly
// drawing the item in toward the tile's center first. A Platform/Fan/
// Auto-Feeder just holds it (a Fan pointed away from vertical will actively
// blow it back off, since the force field still applies to anything resting
// in its cone). Ramps never reach here — they're not in SOLID_TILES, so
// sweepVertical never reports a "landing" on one (see applyRampNudge
// instead).
function handleLanding(item, grid, tile, row, col) {
  if (tile === TILE_COLLECTOR) {
    item.collectorCenterX = col * TILE_SIZE + TILE_SIZE / 2;
    item.collectorCenterY = row * TILE_SIZE + TILE_SIZE / 2;
    item.collectorProgressMs = 0;
    item.collectorOriginalMass = item.mass;
    item.mass = COLLECTOR_PROCESSING_MASS; // barely budges if something else piles into it mid-process — see Config.js's comment
    return 'processing';
  }
  return 'resting'; // TILE_PLATFORM, a Fan, the Auto-Feeder, or the implicit world-boundary wall
}

// Runs every tick an item is mid-collection instead of the normal
// fall/rise physics — eases it toward the Collector tile's stored center
// (COLLECTOR_PULL_STRENGTH, an exponential approach so an off-center landing
// visibly glides in rather than snapping) and counts up toward
// COLLECTOR_PROCESS_DURATION_MS before finally reporting 'consumed'. If the
// Collector tile itself gets torn down mid-process, this bails out and hands
// the item back to normal physics next tick, restoring its real mass, rather
// than leaving it frozen forever at a now-empty spot.
function stepCollectorProcessing(item, grid, dt) {
  if (tileAt(grid, item.collectorCenterX, item.collectorCenterY) !== TILE_COLLECTOR) {
    item.mass = item.collectorOriginalMass;
    item.collectorProgressMs = null;
    return 'falling';
  }
  item.x += (item.collectorCenterX - item.x) * COLLECTOR_PULL_STRENGTH * dt;
  item.y += (item.collectorCenterY - item.y) * COLLECTOR_PULL_STRENGTH * dt;
  item.collectorProgressMs += dt * 1000;
  if (item.collectorProgressMs >= COLLECTOR_PROCESS_DURATION_MS) {
    item.mass = item.collectorOriginalMass;
    return 'consumed';
  }
  return 'processing';
}

// Called by Entities.js's updateFood/updateCoin/updateWaste every tick an
// item's y has crossed SEABED_FLOOR_Y — this is the "physics for items once
// they reach the seabed" Grid.js owns per the module split. `physics` is the
// item's own { gravity, maxFallSpeed } (FOOD_*/WASTE_*/coin constants), so
// this stays item-type-agnostic. Unlike the tile-landing side of this (which
// is event-driven — you only *land* once), this runs unconditionally every
// tick for every seabed item, resting or not: there's no "settled, stop
// simulating" state any more, because a resting item still needs gravity
// (and any active fan force) to keep testing whether its support is still
// there, and still needs to react if resolveItemCollisions shoves it
// sideways off of it — see CLAUDE.md's "Items can't stack, and can fall off
// the bottom" for why. The caller interprets the returned status:
//   'falling'    — still in motion (includes rising off a fan's push), no change needed
//   'resting'    — has support directly beneath it *this tick* (re-evaluated every tick, not a one-way flip)
//   'processing' — being drawn into a Collector's center, not yet consumed — caller leaves it alone
//   'consumed'   — a Collector finished processing it; caller removes it from the array
//   'lost'       — fell off the bottom of the world; caller removes it from the array, no payout
export function stepItemOnGrid(item, state, dt, physics) {
  if (item.y > WORLD_H + ITEM_LOST_BELOW_WORLD_MARGIN_PX) return 'lost';

  const grid = state.level.grid;

  if (item.collectorProgressMs != null) return stepCollectorProcessing(item, grid, dt);

  const fanForce = computeFanForce(state, item);
  integrateItemForces(item, dt, physics, fanForce);

  // Horizontal: swept against solid tiles so it can't tunnel sideways into one.
  const nextX = item.x + item.vx * dt;
  if (isSolid(tileAt(grid, nextX, item.y))) item.vx = 0;
  else item.x = nextX;

  // Vertical: swept tile landing, same as before.
  const result = sweepVertical(item, grid, item.vy * dt);
  if (result.landed) return handleLanding(item, grid, result.tile, result.row, result.col);

  return 'falling';
}

// ---- Auto-Feeder ----
// Ticked once per frame from Entities.js's updateEntities (alongside
// resolveItemCollisions) — separate from the event-driven Collector because
// this needs to actively scan for nearby Waste rather than wait for
// something to land on it. Directly removes absorbed Waste from
// state.level.items (an exception to the usual "Grid.js returns a status,
// Entities.js mutates the array" split — justified the same way
// resolveItemCollisions already directly mutates item positions/velocities
// in place). Newly-dispensed Food is NOT created here, to avoid a circular
// import with Entities.js's createFood — instead this returns an array of
// spawn points `{ x, y }` for the caller to actually construct.
export function updateBuildings(state, dtMs) {
  const spawnPoints = [];
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    if (data.type !== TILE_AUTO_FEEDER) continue;
    const [row, col] = key.split(',').map(Number);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;
    const intakeX = centerX - Math.cos(data.angle) * TILE_SIZE * AUTO_FEEDER_PORT_OFFSET_FRACTION;
    const intakeY = centerY - Math.sin(data.angle) * TILE_SIZE * AUTO_FEEDER_PORT_OFFSET_FRACTION;
    const outputX = centerX + Math.cos(data.angle) * TILE_SIZE * AUTO_FEEDER_PORT_OFFSET_FRACTION;
    const outputY = centerY + Math.sin(data.angle) * TILE_SIZE * AUTO_FEEDER_PORT_OFFSET_FRACTION;

    if (!data.absorbing) {
      const items = state.level.items;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type !== 'waste') continue;
        const d = Math.hypot(it.x - intakeX, it.y - intakeY);
        if (d <= AUTO_FEEDER_INTAKE_RADIUS) {
          items.splice(i, 1);
          // "Buildings" pushing cleanliness back up (see CLAUDE.md's
          // Cleanliness section) — the Auto-Feeder is the one currently
          // built, mirroring Entities.js's identical Suckerfish-eating case.
          state.level.cleanliness = Math.min(CLEANLINESS_MAX, state.level.cleanliness + CLEANLINESS_PER_WASTE_EVENT);
          data.absorbing = true;
          data.progressMs = 0;
          break;
        }
      }
    } else {
      data.progressMs += dtMs;
      if (data.progressMs >= AUTO_FEEDER_PROCESS_DURATION_MS) {
        data.absorbing = false;
        data.progressMs = 0;
        spawnPoints.push({ x: outputX, y: outputY });
      }
    }
  }
  return spawnPoints;
}

// ---- Item-item collision (everywhere, not just the seabed band) —
// continuous, not one-shot. Originally scoped to the seabed band only (open
// water had nothing to collide with there before Fans existed), but a Fan
// can now hold items suspended in open water indefinitely (see "Directional
// Fans" in CLAUDE.md) — without collision there too, a stream of coins held
// at the same point in a Fan's cone just overlapped infinitely instead of
// spreading out, since nothing ever pushed them apart. Every item is
// checked against every other one, every tick, regardless of whether either
// was "resting" — nothing is ever permanently anchored just because it came
// to rest once. Dropping an item onto a pile
// pushes the whole pile (weighted by relative mass — ITEM_MASS_BY_TYPE in
// Config.js, not radius; food is much lighter than a coin on purpose, so a
// coin barely notices bumping a food pellet while shoving it well clear),
// which can knock items at the edge of whatever they were resting on right
// off it — stepItemOnGrid picks that up next tick the same way it would any
// other unsupported item, and it falls again.
//
// Runs ITEM_COLLISION_ITERATIONS sub-passes per tick so a push at the top
// of a stack can propagate down through several layers within one tick.
// Resolution is a direct positional correction (guarantees no overlap
// remains immediately after, which is what keeps this stable no matter how
// deep a stack gets) plus a small fixed velocity kick (ITEM_PUSH_IMPULSE_SPEED)
// so a shoved item keeps drifting for a moment afterward instead of
// snapping into place and stopping dead; ITEM_HORIZONTAL_DAMPING (applied
// in stepItemOnGrid above) is what brings that drift back to a stop.
// massFraction is the same weighting used for the positional correction
// (the other item's mass / total mass — see resolveItemCollisions), scaled
// so the two items' fractions sum to 2 and an equal-mass pair reproduces
// the plain ITEM_PUSH_IMPULSE_SPEED. Without this the velocity kick would
// land at a fixed speed regardless of mass, which — since repeated impulses
// dominate a multi-tick shove far more than the one-shot positional
// correction does — made a coin drift sideways almost as far as the food it
// hit despite being ~10x heavier. Weighting it too is what actually makes
// heavy items barely react while light ones go flying.
//
// rawOverlap (the true, unclamped overlap depth) gates the velocity impulse
// separately from the positional correction — see
// ITEM_PUSH_IMPULSE_MIN_OVERLAP's comment for why a tiny residual overlap
// (ongoing resting contact, not a fresh hit) shouldn't keep adding velocity.
// A push with a meaningfully negative dy (this item is being resolved
// *upward*, away from something beneath it) also zeroes the item's vy the
// same way landing on a solid tile already does (sweepVertical) — without
// this, an item resting on top of *another item* never has its fall speed
// reset, so gravity keeps accelerating it into a full-speed "impact" every
// single tick forever, which is what actually produced the "riding along
// the top surface" look, more than the push angle ever did.
function applyItemPush(grid, item, dx, dy, massFraction, rawOverlap) {
  const nx = item.x + dx;
  const ny = item.y + dy;
  if (isSolid(tileAt(grid, nx, ny))) return; // don't tunnel the correction into a wall — it'll get another chance next tick/iteration
  item.x = nx;
  item.y = ny;
  // Landed on top of another item — clamp (not zero) its fall speed so it
  // still settles briskly. See ITEM_ON_ITEM_LANDING_VY_CAP's comment: fully
  // zeroing this made re-penetration per tick (and thus the corrective
  // sideways roll) far too small to finish in a reasonable time.
  if (dy < -0.01 && item.vy > ITEM_ON_ITEM_LANDING_VY_CAP) item.vy = ITEM_ON_ITEM_LANDING_VY_CAP;
  if (rawOverlap < ITEM_PUSH_IMPULSE_MIN_OVERLAP) return; // resting contact noise, not a fresh hit — position alone is enough
  const mag = Math.hypot(dx, dy) || 1;
  item.vx = (item.vx || 0) + (dx / mag) * ITEM_PUSH_IMPULSE_SPEED * massFraction;
}

// Uses the TRUE center-to-center angle whenever it already has a meaningful
// horizontal component, so an item rolls toward whichever side it's
// actually leaning, proportional to how far off-center it landed — that
// continuity is what reads as rolling rather than sliding. Only a landing
// close enough to dead-center to be a genuine unstable-equilibrium case (no
// real horizontal lean at all) gets a small fixed nudge substituted in, so
// nothing balances on the peak forever; the horizontal sign for that nudge
// is picked from the two items' ids so it's stable across ticks instead of
// jittering. Applied symmetrically to both items in a pair (not just
// whichever one "arrived"), since neither is a fixed anchor any more.
//
// An earlier version instead *clamped* every landing whose vertical
// component exceeded a threshold down to one fixed diagonal — which meant a
// landing 2% off-center and one 40% off-center resolved identically,
// reading as items sliding along a fixed-angle "flat ceiling" rather than
// rolling proportionally to where they actually landed.
function pushDirection(a, b, dx, dy, dist) {
  let nx = dx / dist;
  let ny = dy / dist;
  if (Math.abs(nx) < ITEM_MIN_HORIZONTAL_PUSH_FRACTION) {
    const sign = (a.id + b.id) % 2 === 0 ? 1 : -1;
    nx = sign * ITEM_MIN_HORIZONTAL_PUSH_FRACTION;
    ny = (ny < 0 ? -1 : 1) * Math.sqrt(1 - ITEM_MIN_HORIZONTAL_PUSH_FRACTION * ITEM_MIN_HORIZONTAL_PUSH_FRACTION);
  }
  return { nx, ny };
}

// Called once per tick from Entities.js's updateEntities, after every
// item's individual tile-physics step (including any Waste just spawned
// this tick) — a separate whole-array pass since resolving overlaps needs
// to compare each item against every other one, not just tiles. Runs over
// every item in state.level.items, open water or seabed alike — see the
// module comment above for why this isn't seabed-only any more.
export function resolveItemCollisions(state) {
  const grid = state.level.grid;
  const items = state.level.items;

  for (let iter = 0; iter < ITEM_COLLISION_ITERATIONS; iter++) {
    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      for (let j = i + 1; j < items.length; j++) {
        const b = items[j];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist >= minDist) continue;
        if (dist < 0.001) dist = 0.001; // centers coincide — nudge along an arbitrary stable axis instead of dividing by zero

        const { nx, ny } = pushDirection(a, b, dx, dy, dist); // direction from a to b
        const rawOverlap = minDist - dist;
        // Clamped per pairwise resolution, not the true overlap depth — see
        // ITEM_MAX_PUSH_PER_STEP's comment for why (near-coincident spawns
        // teleporting across the seabed boundary in one shot).
        const overlap = Math.min(rawOverlap, ITEM_MAX_PUSH_PER_STEP);

        // Heavier moves less: a's push fraction comes from b's mass and
        // vice versa, so a light food pellet gets shoved well clear of a
        // heavy coin while the coin barely shifts.
        const totalMass = a.mass + b.mass;
        const aFrac = b.mass / totalMass;
        const bFrac = a.mass / totalMass;
        applyItemPush(grid, a, -nx * overlap * aFrac, -ny * overlap * aFrac, aFrac * 2, rawOverlap);
        applyItemPush(grid, b, nx * overlap * bFrac, ny * overlap * bFrac, bFrac * 2, rawOverlap);
      }
    }
  }
}

// ---- Rendering ----
export function renderSeabedGrid(ctx, state, canvasWidth, canvasHeight) {
  const { camera } = state;
  const grid = state.level.grid;

  // Only iterate the tile columns/rows actually on screen, not the whole grid.
  const topLeft = { x: camera.x, y: camera.y };
  const bottomRight = { x: camera.x + canvasWidth / camera.zoom, y: camera.y + canvasHeight / camera.zoom };
  const colStart = Math.max(0, colAt(topLeft.x) - 1);
  const colEnd = Math.min(WORLD_TILES_W - 1, colAt(bottomRight.x) + 1);
  const rowStart = Math.max(SEABED_ROW_START, rowAt(topLeft.y) - 1);
  const rowEnd = Math.min(WORLD_TILES_H - 1, rowAt(bottomRight.y) + 1);

  if (rowStart > rowEnd) return; // seabed entirely below/above the current view

  // Base seabed color behind every tile, including empty ones, so the grid
  // still reads as "ground" before anything's been built on it.
  const topOfSeabed = worldToScreen(0, SEABED_ROW_START * TILE_SIZE, camera);
  ctx.fillStyle = '#4a3624';
  ctx.fillRect(0, Math.max(0, topOfSeabed.y), canvasWidth, canvasHeight);
  ctx.fillStyle = '#6b4f34';
  ctx.fillRect(0, Math.max(0, topOfSeabed.y), canvasWidth, 4); // seabed surface highlight line

  for (let row = rowStart; row <= rowEnd; row++) {
    for (let col = colStart; col <= colEnd; col++) {
      const type = grid[row][col];
      if (type === TILE_EMPTY) continue;
      const building = BUILDING_TYPES[type];
      if (!building) continue;
      const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, camera);
      const size = TILE_SIZE * camera.zoom;
      const data = state.level.buildingData[buildingKey(col, row)];
      renderTileShape(ctx, type, building.color, screen.x, screen.y, size, data);
      if (data && (FAN_TILES.has(type) || type === TILE_AUTO_FEEDER)) {
        renderDirectionIndicator(ctx, type, screen.x, screen.y, size, data.angle, camera.zoom);
      }
    }
  }
}

// A Ramp draws as a triangle pointing the direction it nudges items — a
// left-pointing wedge for TILE_RAMP_LEFT, right-pointing for
// TILE_RAMP_RIGHT — instead of a plain square, so its effect on anything
// passing through reads visually at a glance. A Collector gets a circle in
// its center — the point stepCollectorProcessing actually draws items into
// while it holds them for COLLECTOR_PROCESS_DURATION_MS. A Fan/Auto-Feeder
// is a plain square here (renderDirectionIndicator draws its aim on top).
// Every other building type is a plain square too.
function renderTileShape(ctx, type, color, x, y, size) {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  if (type === TILE_RAMP_LEFT || type === TILE_RAMP_RIGHT) {
    if (type === TILE_RAMP_LEFT) {
      ctx.moveTo(x + size, y); // top-right
      ctx.lineTo(x + size, y + size); // bottom-right
      ctx.lineTo(x, y + size / 2); // apex, pointing left
    } else {
      ctx.moveTo(x, y); // top-left
      ctx.lineTo(x, y + size); // bottom-left
      ctx.lineTo(x + size, y + size / 2); // apex, pointing right
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === TILE_COLLECTOR) {
    ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.arc(x + size / 2, y + size / 2, size * COLLECTOR_CIRCLE_RADIUS_FRACTION, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.stroke();
  }
}

// Draws a small arrow (Fan aim) or an intake/output arrow pair (Auto-Feeder)
// plus, for Fans, a translucent cone showing their live area of effect —
// makes the invisible force field/routing direction actually visible.
function renderDirectionIndicator(ctx, type, x, y, size, angle, zoom) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  if (FAN_TILES.has(type)) {
    const stats = FAN_STATS[type];
    const range = stats.maxRange * zoom;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, angle - FAN_CONE_HALF_ANGLE_RAD, angle + FAN_CONE_HALF_ANGLE_RAD);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(1, 2 * zoom);
  ctx.beginPath();
  const len = size * 0.32;
  ctx.moveTo(cx - Math.cos(angle) * len * 0.4, cy - Math.sin(angle) * len * 0.4);
  ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  ctx.stroke();
  ctx.restore();
}

// Build-mode cursor preview — a translucent square at the snapped tile under
// the cursor, tinted green if placing there is currently valid or red if
// not (occupied, out of bounds, unaffordable, or unanchored). `angle` (only
// relevant for Fans/Auto-Feeder) draws the same aim indicator as the placed
// version, live-following the cursor's exact position within the tile.
export function renderBuildGhost(ctx, state, worldX, worldY, buildingId, angle) {
  const { col, row } = worldToTile(worldX, worldY);
  const check = canPlaceTile(state, col, row, buildingId);
  const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
  const size = TILE_SIZE * state.camera.zoom;
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = check.ok ? '#8fe0b8' : '#ff6b6b';
  ctx.fillRect(screen.x, screen.y, size, size);
  ctx.globalAlpha = 1;
  if (check.ok && (FAN_TILES.has(buildingId) || buildingId === TILE_AUTO_FEEDER)) {
    renderDirectionIndicator(ctx, buildingId, screen.x, screen.y, size, angle, state.camera.zoom);
  }
}

// Angle (atan2 convention) from a tile's center to an arbitrary world point
// — used by main.js's build-drag flow to derive a Fan/Auto-Feeder's aim from
// exactly where the cursor is within the tile at the moment of placement.
export function angleFromTileToPoint(col, row, worldX, worldY) {
  const cx = col * TILE_SIZE + TILE_SIZE / 2;
  const cy = row * TILE_SIZE + TILE_SIZE / 2;
  return Math.atan2(worldY - cy, worldX - cx);
}
