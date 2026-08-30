// Grid.js — seabed tile array, gravity/slope physics for items once they
// reach the seabed, ramp/blaster/collector routing. Owns state.level.grid.
// Forbidden: no fish logic, no camera math.

import {
  TILE_SIZE,
  WORLD_TILES_W,
  WORLD_TILES_H,
  WORLD_H,
  SEABED_ROW_START,
  SEABED_FLOOR_Y,
  TILE_EMPTY,
  TILE_WALL,
  TILE_RAMP_LEFT,
  TILE_RAMP_RIGHT,
  TILE_COLLECTOR,
  TILE_BLASTER,
  BUILDING_TYPES,
  TILE_REFUND_FRACTION,
  GRID_SWEEP_SUBSTEP,
  RAMP_NUDGE_DISTANCE,
  BLASTER_LAUNCH_MIN_FRACTION,
  BLASTER_LAUNCH_MAX_DEPTH_BONUS,
  BLASTER_LAUNCH_ANGLE_MAX_DEG,
  BLASTER_TOP_CORNER_RADIUS_FRACTION,
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
} from './Config.js';
import { worldToScreen } from './Engine.js';

// Tiles an item's fall (or rise) is arrested by. Ramps are deliberately NOT
// solid — see RAMP_NUDGE_DISTANCE's comment in Config.js: they're a
// pass-through nudge, not a surface anything lands or rests on.
const SOLID_TILES = new Set([TILE_WALL, TILE_COLLECTOR, TILE_BLASTER]);
const RAMP_TILES = new Set([TILE_RAMP_LEFT, TILE_RAMP_RIGHT]);

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

// Past the world's side/top edges reads as TILE_WALL (nothing needs to fall
// off the sides). Past the *bottom* edge reads as TILE_EMPTY instead — there
// is deliberately no floor down there any more: an item that reaches it just
// keeps falling, and stepItemOnGrid deletes it once it's fallen
// ITEM_LOST_BELOW_WORLD_MARGIN_PX past WORLD_H (see that function). An
// unbuilt level doesn't catch anything for free any more; the player has to
// build something to actually keep an item.
function tileAt(grid, x, y) {
  const row = rowAt(y);
  const col = colAt(x);
  if (col < 0 || col >= WORLD_TILES_W) return TILE_WALL;
  if (row < 0) return TILE_WALL;
  if (row >= WORLD_TILES_H) return TILE_EMPTY;
  return grid[row][col];
}

// col/row here are tile indices, not world px — used by build-mode UI/main.js.
export function getTile(grid, col, row) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  return grid[row][col];
}

export function worldToTile(x, y) {
  return { col: colAt(x), row: rowAt(y) };
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
  return { ok: true, reason: null };
}

export function placeTile(state, col, row, buildingId) {
  const check = canPlaceTile(state, col, row, buildingId);
  if (!check.ok) return false;
  state.level.money -= BUILDING_TYPES[buildingId].cost;
  state.level.grid[row][col] = buildingId;
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
  if (building) state.level.money += Math.floor(building.cost * TILE_REFUND_FRACTION);
  return true;
}

// T debug key — cycles the tile under the cursor through every building type
// (plus empty) for free, ignoring cost/occupancy. A quick way to lay out a
// test course without spending the level's money.
const CHEAT_CYCLE = [TILE_EMPTY, TILE_WALL, TILE_RAMP_LEFT, TILE_RAMP_RIGHT, TILE_COLLECTOR, TILE_BLASTER];
export function cycleTileCheat(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return;
  const current = state.level.grid[row][col];
  const idx = CHEAT_CYCLE.indexOf(current);
  state.level.grid[row][col] = CHEAT_CYCLE[(idx + 1) % CHEAT_CYCLE.length];
}

// ---- Item physics — swept fall, ramps, blasters, collectors ----
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
  if (!SOLID_TILES.has(tileAt(grid, targetX, item.y))) item.x = targetX; // don't shove it into a wall — it'll just keep moving through this row untouched instead
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
    if (SOLID_TILES.has(tile)) {
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

// Fires an item back up into the water column. Launch height is a fraction
// of the tank's height (SEABED_FLOOR_Y): BLASTER_LAUNCH_MIN_FRACTION at the
// shallowest possible placement, rising toward + BLASTER_LAUNCH_MAX_DEPTH_BONUS
// the deeper into the city the Blaster sits, maxing out at the very bottom
// row (0.5 + 0.15 = 0.65 — see Config.js). The speed needed to reach that
// apex under this item's own gravity is the standard v = sqrt(2 * g * h) —
// once set, the existing gravity integration in both this file and
// Entities.js's open-water branch decelerates it through the arc with no
// special-casing needed either way.
//
// The shot isn't purely vertical: `col`'s tile spans world-x
// [col*TILE_SIZE, (col+1)*TILE_SIZE), and item.x's position within that
// range (relative to the tile's center) at the moment of landing linearly
// maps to an angle up to BLASTER_LAUNCH_ANGLE_MAX_DEG off vertical, in the
// direction of that offset — dead-center hits launch straight up, an item
// that landed near the tile's left/right edge tilts that far toward that
// side instead.
function launchFromBlaster(item, row, col, physics) {
  const depthIntoCity = row * TILE_SIZE - SEABED_FLOOR_Y;
  const maxDepth = (WORLD_TILES_H - 1) * TILE_SIZE - SEABED_FLOOR_Y; // depth of the very bottom row
  const depthRatio = maxDepth > 0 ? Math.max(0, Math.min(1, depthIntoCity / maxDepth)) : 0;
  const launchFraction = BLASTER_LAUNCH_MIN_FRACTION + BLASTER_LAUNCH_MAX_DEPTH_BONUS * depthRatio;
  const launchHeight = launchFraction * SEABED_FLOOR_Y;
  const speed = Math.sqrt(2 * physics.gravity * launchHeight);

  const tileCenterX = col * TILE_SIZE + TILE_SIZE / 2;
  const offsetFraction = Math.max(-1, Math.min(1, (item.x - tileCenterX) / (TILE_SIZE / 2)));
  const angleRad = offsetFraction * BLASTER_LAUNCH_ANGLE_MAX_DEG * (Math.PI / 180);

  item.vy = -speed * Math.cos(angleRad);
  item.vx = speed * Math.sin(angleRad);
}

// A Collector doesn't bank an item the instant it lands — it starts a
// COLLECTOR_PROCESS_DURATION_MS hold (see stepCollectorProcessing), visibly
// drawing the item in toward the tile's center first. A Wall just holds it.
// Ramps never reach here — they're not in SOLID_TILES, so sweepVertical
// never reports a "landing" on one (see applyRampNudge instead). A Blaster
// relaunches it upward.
function handleLanding(item, grid, tile, row, col, physics) {
  if (tile === TILE_BLASTER) {
    launchFromBlaster(item, row, col, physics);
    return 'falling'; // rising now, not resting — see launchFromBlaster
  }
  if (tile === TILE_COLLECTOR) {
    item.collectorCenterX = col * TILE_SIZE + TILE_SIZE / 2;
    item.collectorCenterY = row * TILE_SIZE + TILE_SIZE / 2;
    item.collectorProgressMs = 0;
    item.collectorOriginalMass = item.mass;
    item.mass = COLLECTOR_PROCESSING_MASS; // barely budges if something else piles into it mid-process — see Config.js's comment
    return 'processing';
  }
  return 'resting'; // TILE_WALL, or the implicit world-boundary wall
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
// they reach the seabed" Grid.js owns per the module split. `physics` is
// the item's own { gravity, maxFallSpeed } (FOOD_*/WASTE_*/coin constants),
// so this stays item-type-agnostic. Unlike the tile-landing side of this
// (which is event-driven — you only *land* once), this runs unconditionally
// every tick for every seabed item, resting or not: there's no "settled,
// stop simulating" state any more, because a resting item still needs
// gravity to keep testing whether its support is still there, and still
// needs to react if resolveItemCollisions shoves it sideways off of it —
// see CLAUDE.md's "Items can't stack, and can fall off the bottom" for why.
// The caller interprets the returned status:
//   'falling'    — still in motion (includes rising off a Blaster), no change needed
//   'resting'    — has support directly beneath it *this tick* (re-evaluated every tick, not a one-way flip)
//   'processing' — being drawn into a Collector's center, not yet consumed — caller leaves it alone
//   'consumed'   — a Collector finished processing it; caller removes it from the array
//   'lost'       — fell off the bottom of the world; caller removes it from the array, no payout
export function stepItemOnGrid(item, state, dt, physics) {
  if (item.y > WORLD_H + ITEM_LOST_BELOW_WORLD_MARGIN_PX) return 'lost';

  const grid = state.level.grid;

  if (item.collectorProgressMs != null) return stepCollectorProcessing(item, grid, dt);

  // Horizontal: damped drift from any recent item-item pushes (resolveItemCollisions
  // below is what actually sets vx — this just integrates and decays it, and
  // stops it dead against a solid tile rather than letting it tunnel sideways).
  item.vx = (item.vx || 0) * ITEM_HORIZONTAL_DAMPING;
  const nextX = item.x + item.vx * dt;
  if (SOLID_TILES.has(tileAt(grid, nextX, item.y))) item.vx = 0;
  else item.x = nextX;

  // Vertical: gravity + swept tile landing, unchanged from before.
  item.vy = Math.min((item.vy || 0) + physics.gravity * dt, physics.maxFallSpeed);
  const result = sweepVertical(item, grid, item.vy * dt);
  if (result.landed) return handleLanding(item, grid, result.tile, result.row, result.col, physics);

  return 'falling';
}

// ---- Item-item collision (seabed band only) — continuous, not one-shot.
// Every seabed item is checked against every other one, every tick,
// regardless of whether either was "resting" — nothing is ever permanently
// anchored just because it came to rest once. Dropping an item onto a pile
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
  if (SOLID_TILES.has(tileAt(grid, nx, ny))) return; // don't tunnel the correction into a wall — it'll get another chance next tick/iteration
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
// to compare each item against every other one, not just tiles.
export function resolveItemCollisions(state) {
  const grid = state.level.grid;
  const seabedItems = state.level.items.filter((it) => it.y >= SEABED_FLOOR_Y);

  for (let iter = 0; iter < ITEM_COLLISION_ITERATIONS; iter++) {
    for (let i = 0; i < seabedItems.length; i++) {
      const a = seabedItems[i];
      for (let j = i + 1; j < seabedItems.length; j++) {
        const b = seabedItems[j];

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
      renderTileShape(ctx, type, building.color, screen.x, screen.y, size);
    }
  }
}

// A Ramp draws as a triangle pointing the direction it nudges items — a
// left-pointing wedge for TILE_RAMP_LEFT, right-pointing for
// TILE_RAMP_RIGHT — instead of a plain square, so its effect on anything
// passing through reads visually at a glance. A Blaster gets a slightly
// rounded top (BLASTER_TOP_CORNER_RADIUS_FRACTION of the tile size) — its
// bottom stays square, since it's still sitting flush on whatever's below
// it, only the top (the end it fires out of) is rounded. A Collector gets a
// circle in its center — the point stepCollectorProcessing actually draws
// items into while it holds them for COLLECTOR_PROCESS_DURATION_MS. Every
// other building type is still a plain square.
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
  } else if (type === TILE_BLASTER) {
    const radius = size * BLASTER_TOP_CORNER_RADIUS_FRACTION;
    ctx.roundRect(x, y, size, size, [radius, radius, 0, 0]);
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

// Build-mode cursor preview — a translucent square at the snapped tile under
// the cursor, tinted green if placing there is currently valid or red if
// not (occupied, out of bounds, or unaffordable).
export function renderBuildGhost(ctx, state, worldX, worldY, buildingId) {
  const { col, row } = worldToTile(worldX, worldY);
  const check = canPlaceTile(state, col, row, buildingId);
  const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
  const size = TILE_SIZE * state.camera.zoom;
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = check.ok ? '#8fe0b8' : '#ff6b6b';
  ctx.fillRect(screen.x, screen.y, size, size);
  ctx.globalAlpha = 1;
}
