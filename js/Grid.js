// Grid.js — seabed tile array, gravity/fan-force physics for items once they
// reach the seabed, collector/auto-feeder routing, building placement rules.
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
  TILE_PLATFORM_HALF_LEFT,
  TILE_PLATFORM_HALF_RIGHT,
  TILE_PLATFORM_HALF_TOPLEFT,
  TILE_PLATFORM_HALF_TOPRIGHT,
  TILE_COLLECTOR,
  TILE_COLLECTOR_ELECTRIC,
  TILE_COLLECTOR_ADVANCED,
  TILE_FAN_T2,
  TILE_FAN_T3,
  TILE_FAN_T4,
  TILE_TURRET_WASTE,
  TILE_TURRET_ELECTRIC,
  TILE_TURRET_ADVANCED,
  TILE_REFINERY,
  TILE_REFINERY_ELECTRIC,
  TILE_REFINERY_ADVANCED,
  TILE_MANUFACTURER,
  TILE_POWER_PLANT,
  TILE_STORAGE_CHEST,
  TILE_STORAGE_CHEST_T2,
  TILE_STORAGE_CHEST_T3,
  STORAGE_CHEST_CAPACITY,
  STORAGE_CHEST_TRICKLE_INTERVAL_MAX_MS,
  STORAGE_CHEST_TRICKLE_INTERVAL_MIN_MS,
  STORAGE_CHEST_CLEAR_INTERVAL_MS,
  BUILDING_TYPES,
  PROCESSOR_STATS,
  TURRET_STATS,
  TURRET_AMMO_TILES,
  TURRET_FIRE_RATE_UPGRADE_MULTIPLIER,
  REFINERY_STATS,
  ALIEN_DNA_REFINERY_TIME_MULTIPLIER,
  MANUFACTURER_RECIPES,
  MANUFACTURER_ITEM_PROCESS_MS,
  MANUFACTURER_INPUT_COLOR_BY_TYPE,
  MANUFACTURER_ITEM_POWER_COST_MW,
  FOOD_COLOR,
  BIOMASS_COLOR,
  BIOMASS_COLOR_CORE,
  ALIEN_DNA_COLOR,
  MUTAGEN_PASTE_COLOR,
  ALIEN_EGG_COLOR,
  ALIEN_EGG_RING_COLOR,
  SCIENCE_ITEM_COLOR_A,
  SCIENCE_ITEM_COLOR_B,
  SCIENCE_GREEN_COLOR_A,
  SCIENCE_GREEN_COLOR_B,
  POWER_PLANT_RECIPES,
  POWER_PLANT_STATS,
  PROCESS_DOTS_COUNT,
  BUILDING_UPTIME_SAMPLE_INTERVAL_MS,
  BUILDING_UPTIME_SAMPLE_COUNT,
  HUNGER_SEEK_THRESHOLD,
  CATALYST_BUFF_MULTIPLIER,
  CATALYST_BUFF_MULTIPLIER_MUTAGEN,
  CATALYST_FLASH_DURATION_MS,
  WASTE_TURRET_SHOTS_PER_WASTE,
  WASTE_TURRET_MAX_AMMO,
  WASTE_TURRET_MAX_WASTE,
  BIOMASS_TURRET_SHOTS_PER_AMMO,
  BIOMASS_TURRET_DAMAGE_MULTIPLIER,
  TILE_REFUND_FRACTION,
  GRID_SWEEP_SUBSTEP,
  ITEM_HORIZONTAL_DAMPING,
  ITEM_COLLISION_ITERATIONS,
  ITEM_MIN_HORIZONTAL_PUSH_FRACTION,
  ITEM_PUSH_IMPULSE_SPEED,
  ITEM_MAX_PUSH_PER_STEP,
  ITEM_PUSH_IMPULSE_MIN_OVERLAP,
  ITEM_ON_ITEM_LANDING_VY_CAP,
  COLLECTOR_PULL_STRENGTH,
  COLLECTOR_PROCESSING_MASS,
  COLLECTOR_CIRCLE_RADIUS_FRACTION,
  FAN_CONE_HALF_ANGLE_DEG,
  FAN_T2_MAX_FORCE, FAN_T2_MAX_RANGE, FAN_T2_POWER_COST,
  FAN_T3_MAX_FORCE, FAN_T3_MAX_RANGE, FAN_T3_POWER_COST,
  FAN_T4_MAX_FORCE, FAN_T4_MAX_RANGE, FAN_T4_POWER_COST,
  BUILDING_OUTPUT_PORT_OFFSET_FRACTION,
  POWER_SHORTAGE_STALLED_THRESHOLD,
  PLATFORM_FLAT_COST,
  BUILDING_COST_GROWTH_RATE_TIER1,
  BUILDING_COST_GROWTH_RATE_TIER2,
  BUILDING_COST_GROWTH_RATE_TIER3,
  CLEANLINESS_MAX,
  CLEANLINESS_PER_WASTE_EVENT,
  CAMERA_BOTTOM_BUFFER_PX,
} from './Config.js';
import { worldToScreen } from './Engine.js';
import { playBuildPlace, playDemolish, playTurretShoot, playIntake, playDispense } from './Sound.js';
import { pushGameNotification } from './Notifications.js';

// One-time story/tutorial notifications — see state.level.tutorialFlags and
// CLAUDE.md's "Story & Tutorial Notifications" section.
const FIRST_BUILDING_PLACED_MESSAGE = "You just placed your first piece of seabed hardware. Welcome to factory brain — there's no swimming back from this now.";
const FIRST_FAN_PLACED_MESSAGE = 'fancy fan....oooo you fancy';

// A thin wrapper around Notifications.js's own pushGameNotification — the
// one real, shared implementation of the push+cap+dedupe+timestamp logic
// (see that file's own comment) — kept as a same-named local helper per
// CLAUDE.md's Rolling Notification Log convention.
function pushGridNotification(state, text) {
  pushGameNotification(state, text);
}

// Tiles an item's fall (or rise) is arrested by.
const COLLECTOR_TILES = new Set([TILE_COLLECTOR, TILE_COLLECTOR_ELECTRIC, TILE_COLLECTOR_ADVANCED]);
export const TURRET_TILES = new Set([TILE_TURRET_WASTE, TILE_TURRET_ELECTRIC, TILE_TURRET_ADVANCED]);
// Refinery — 4 real tiers now (replacing the old Auto-Feeder family); the
// Manufacturer/Power Plant are each a single standalone tile (no tiers), kept
// as 1-member Sets for the same uniform `.has(type)` shape every other
// building-type-group check in this file already uses.
const REFINERY_TILES = new Set([TILE_REFINERY, TILE_REFINERY_ELECTRIC, TILE_REFINERY_ADVANCED]);
const MANUFACTURER_TILES = new Set([TILE_MANUFACTURER]);
// Every building that "holds" an item in place while it processes (visually
// pulled to the tile's own center and disintegrating — see
// renderDisintegrateEffect/stepHeldItem below), per direct request ("when
// collectors/processors pull in objects to process, have the object
// disintegrate... add this same animation to refineries and manufacturers,
// having them pull items into the center of them"). The Collector already
// had its own pull-to-center hold (item.collectorProgressMs, see
// stepCollectorProcessing above) from an earlier pass, so it's included here
// purely for stepHeldItem's release-check/isHeld query, not given a second
// hold mechanism of its own.
const HOLDABLE_ITEM_TILES = new Set([...COLLECTOR_TILES, ...REFINERY_TILES, ...MANUFACTURER_TILES]);
const POWER_PLANT_TILES = new Set([TILE_POWER_PLANT]);
// The 3 Storage Chest tiers — see this file's own "Storage Chest" section
// further down (placeTile's buildingData branch, updateBuildings' intake/
// trickle/clear scan) for the full mechanic.
const STORAGE_CHEST_TILES = new Set([TILE_STORAGE_CHEST, TILE_STORAGE_CHEST_T2, TILE_STORAGE_CHEST_T3]);
const SOLID_TILES = new Set([
  TILE_PLATFORM, TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4,
  ...COLLECTOR_TILES, ...TURRET_TILES,
  ...REFINERY_TILES, ...MANUFACTURER_TILES, ...POWER_PLANT_TILES,
  ...STORAGE_CHEST_TILES,
]);
const FAN_TILES = new Set([TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4]);
// All 5 Platform variants share the same flat cost — see getBuildingCost/
// computeBlueprintCost's own PLATFORM_FLAT_COST checks below.
const PLATFORM_FLAT_COST_TILES = new Set([
  TILE_PLATFORM, TILE_PLATFORM_HALF_LEFT, TILE_PLATFORM_HALF_RIGHT,
  TILE_PLATFORM_HALF_TOPLEFT, TILE_PLATFORM_HALF_TOPRIGHT,
]);

// ---- Half Platform ramps — real 45-degree wedge collision ----
// Deliberately NOT added to SOLID_TILES: a flat "is this whole tile solid"
// check is wrong for a ramp, which is only solid across half its own tile
// (a right triangle), not the full square — see resolveRampCollision below,
// the ONE place any ramp's own wedge is ever collided with, called
// uniformly regardless of which direction an item is approaching from, or
// which of the 4 ramp orientations it's hitting.
//
// TWO real bugs were found and fixed here, both reported directly after an
// earlier version of this section shipped:
//   1. "An item pushed along the ground into a ramp stops dead and never
//      moves again, no matter how much Fan force keeps pushing it." Root
//      cause: the ramp's own solid-side test keyed off `rowAt(item.y)` —
//      the tile row containing the item's CENTER. But an item resting on
//      (or sliding along) a normal floor tile always has its center ONE
//      ROW ABOVE that floor tile (sweepVertical's own landing code sets
//      `item.y = row*TILE_SIZE - item.radius`, always inside row-1 since
//      radius < TILE_SIZE) — so right at a ramp's own tall vertical face
//      (exactly where the collision most needs to fire), the item's
//      center-derived row resolves to the EMPTY row above the ramp, not the
//      ramp's own row, and the whole wedge silently had zero collision
//      thickness there. The earlier version also only ever checked ONE
//      exact tile (the one the item's center happened to be in that tick),
//      so a fast horizontal push could tunnel straight through a ramp's
//      entire column within a single tick before ever "arriving" inside its
//      cell.
//   2. "Objects can pass through the bottom and vertical sides of the
//      ramp — it's a one-way line, not a full triangle." Root cause: the
//      old check only ever measured distance to the sloped hypotenuse
//      (treated as an infinite line) — the wedge's other two straight edges
//      (the tall vertical face, and the flat bottom) had no collision of
//      their own at all.
// Fixed by rebuilding this as genuine circle-vs-triangle collision
// (resolveRampCollisionAt), checked against every ramp tile whose own
// square footprint could possibly overlap the item's real circular body —
// not just the one tile its center happens to sit in — via a small
// neighborhood scan (resolveRampCollision) sized off the item's own radius.
// This naturally makes the FULL triangle solid: whichever of its 3 edges
// (the slope, the wall, or the floor) is actually nearest to the circle is
// found by pure geometry, with no separate per-edge special-casing — and it
// naturally fixes the "resting height is one row up" gap too, since the
// scan checks the row the ramp tile itself is actually in, not just
// whatever row the item's center happens to occupy. Called once per
// substep of BOTH the horizontal and vertical movement passes (see
// sweepHorizontal/sweepVertical below), so a fast Fan-driven push can't
// tunnel past a ramp's column within one big step either.
//
// Geometry, in tile-LOCAL coordinates (0,0 = top-left corner, y increases
// downward matching this game's own world-Y convention throughout). Right
// and Left are the "floor-level" pair — cut along the tile's own natural
// corner-to-corner diagonal, tall on one side tapering to nothing on the
// other. Top Left/Top Right are each the exact COMPLEMENTARY triangle
// within the same square, mirrored across that same diagonal — solid where
// Right/Left are open and vice versa — see Config.js's own comment above
// TILE_PLATFORM_HALF_LEFT for the full rationale (why this pairing is what
// makes all 4 usable together as a routing "pipe" system).
// Each array's middle vertex (index 1) is always the wedge's own right-angle
// corner, with index 0/2 being the two ends of the sloped hypotenuse — a
// pure rendering convenience (renderPlatformRamp below draws the highlight
// stroke as a straight line between verts[0] and verts[2]) that has no
// effect on the collision math above, which checks all 3 edges regardless
// of winding order.
const RAMP_TRIANGLE_LOCAL_VERTS = {
  [TILE_PLATFORM_HALF_RIGHT]: [[0, 0], [0, TILE_SIZE], [TILE_SIZE, TILE_SIZE]],
  [TILE_PLATFORM_HALF_LEFT]: [[TILE_SIZE, 0], [TILE_SIZE, TILE_SIZE], [0, TILE_SIZE]],
  [TILE_PLATFORM_HALF_TOPRIGHT]: [[0, 0], [TILE_SIZE, 0], [TILE_SIZE, TILE_SIZE]],
  [TILE_PLATFORM_HALF_TOPLEFT]: [[TILE_SIZE, 0], [0, 0], [0, TILE_SIZE]],
};

// A gentle bounce, not a real elastic collision — per direct spec, "it
// should be able to bounce slightly off the platform if coming at it from a
// more perpendicular-ish angle," not stick or fully absorb every hit.
const RAMP_BOUNCE_RESTITUTION = 0.25;

// Nearest point on segment (ax,ay)-(bx,by) to point (px,py) — the building
// block for real circle-vs-triangle collision below.
function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq > 0 ? ((px - ax) * abx + (py - ay) * aby) / lenSq : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return { x: ax + t * abx, y: ay + t * aby };
}
function triangleEdgeSign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}
function pointInTriangle(px, py, verts) {
  const [[ax, ay], [bx, by], [cx, cy]] = verts;
  const d1 = triangleEdgeSign(px, py, ax, ay, bx, by);
  const d2 = triangleEdgeSign(px, py, bx, by, cx, cy);
  const d3 = triangleEdgeSign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// THE one place a Half Platform ramp's own solid wedge is ever collided
// with for one specific tile — real circle-vs-triangle collision, not a
// direction-specific special case. Finds whichever of the triangle's 3
// edges (the sloped surface, the tall wall, or the flat bottom) is
// genuinely closest to the item's own circular body — a pure geometric
// fact, never a hand-picked angle threshold — and resolves against THAT
// edge/corner uniformly: position is corrected straight out along the
// resulting normal by the exact penetration depth, and the item's CURRENT
// velocity (whatever integrateItemForces already produced this tick —
// gravity, Fan force, drag, all baked in) is decomposed into a component
// running along that surface (tangent) and one running into/out of it
// (normal). The tangential component is preserved completely — a
// frictionless surface never robs momentum from motion already running
// along it, which is what lets a Fan-pushed item sliding along the ground
// translate that speed into genuinely climbing/sliding across the ramp
// instead of just stopping. The normal component only gets a small bounce
// (RAMP_BOUNCE_RESTITUTION) if it was actively driving further into the
// surface; if already separating (a Fan blowing the item back off, say),
// it's left completely untouched. This is one continuous formula for every
// possible angle/edge of contact — a nearly head-on hit against the wall or
// floor edge just happens to put most of its incoming speed on the normal
// axis (and so mostly bounces), a nearly-parallel one along the slope puts
// almost none there (and so barely changes at all, reading as a smooth
// glide-on), and everything in between (including a corner) falls out of
// the exact same math with no separate threshold or branch anywhere.
// Nothing here can glue an item to the ramp either, since it's a pure
// geometric overlap test re-run fresh every substep with no persistent
// "attached" state: an item on a genuinely separating trajectory just stops
// registering an overlap at all on the very next check.
function resolveRampCollisionAt(item, state, tileType, col, row) {
  const localVerts = RAMP_TRIANGLE_LOCAL_VERTS[tileType];
  if (!localVerts) return false;
  // Filtered out for this item's type — see platformIgnoresItem's own
  // comment. Passes straight through this ramp's wedge with zero collision,
  // same as walking through empty air.
  if (platformIgnoresItem(state, tileType, col, row, item.type)) return false;
  const anchorX = col * TILE_SIZE;
  const anchorY = row * TILE_SIZE;
  const verts = localVerts.map(([lx, ly]) => [anchorX + lx, anchorY + ly]);

  let bestDist = Infinity;
  let bestDx = 0;
  let bestDy = 0;
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = verts[i];
    const [bx, by] = verts[(i + 1) % 3];
    const cp = closestPointOnSegment(item.x, item.y, ax, ay, bx, by);
    const dx = item.x - cp.x;
    const dy = item.y - cp.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) { bestDist = dist; bestDx = dx; bestDy = dy; }
  }

  const inside = pointInTriangle(item.x, item.y, verts);
  let nx;
  let ny;
  let penetration;
  if (inside) {
    // Deeply embedded (a big single step, or an item spawned inside) — push
    // OUT the way it came: the vector from the nearest edge TO the item
    // points further INTO the shape while inside, so the true escape
    // direction is the negation of that.
    penetration = item.radius + bestDist;
    if (bestDist > 1e-6) { nx = -bestDx / bestDist; ny = -bestDy / bestDist; } else { nx = 0; ny = -1; }
  } else {
    if (bestDist >= item.radius) return false; // not touching this tile's wedge at all
    penetration = item.radius - bestDist;
    if (bestDist > 1e-6) { nx = bestDx / bestDist; ny = bestDy / bestDist; } else { nx = 0; ny = -1; }
  }

  item.x += nx * penetration;
  item.y += ny * penetration;
  const tx = -ny;
  const ty = nx;
  const vNormal = item.vx * nx + item.vy * ny;
  const vTangent = item.vx * tx + item.vy * ty;
  const newVNormal = vNormal < 0 ? -vNormal * RAMP_BOUNCE_RESTITUTION : vNormal;
  item.vx = vTangent * tx + newVNormal * nx;
  item.vy = vTangent * ty + newVNormal * ny;
  return true;
}

// Scans every ramp tile whose own square footprint could possibly overlap
// the item's actual circular body — not just the one tile its center
// happens to sit in, which used to leave a ramp's own tall wall/floor edges
// with effectively zero collision thickness for anything resting one row
// above them (see this section's own module comment) — and resolves
// against each one found. Called once per substep of both the horizontal
// and vertical movement passes.
function resolveRampCollision(item, state) {
  const grid = state.level.grid;
  const minCol = colAt(item.x - item.radius);
  const maxCol = colAt(item.x + item.radius);
  const minRow = rowAt(item.y - item.radius);
  const maxRow = rowAt(item.y + item.radius);
  let resolvedAny = false;
  for (let row = minRow; row <= maxRow; row++) {
    if (!grid[row]) continue;
    for (let col = minCol; col <= maxCol; col++) {
      if (col < 0 || col >= grid[row].length) continue;
      const tile = grid[row][col];
      if (!RAMP_TRIANGLE_LOCAL_VERTS[tile]) continue;
      if (resolveRampCollisionAt(item, state, tile, col, row)) resolvedAny = true;
    }
  }
  return resolvedAny;
}

// ---- Full Platform (TILE_PLATFORM) side/bottom collision ----
// Per direct report ("the full platforms should work the same as the half
// platforms where objects can't pass through the bottom or sides of them —
// right now objects will glitch only on the full platforms if they touch
// the sides and bottoms of a full platform, but the half platforms work
// correctly"). Root cause is the exact same one the big comment above this
// ramp section already documents as "Bug #1" for ramps, just never also
// fixed for the plain rectangular case: sweepVertical/sweepHorizontal's own
// SOLID_TILES-based flat checks only ever test ONE point — the bottom of
// the circle (for landing on TOP) or the item's own center row (for a
// horizontal block) — so an item approaching from below (its LEADING edge
// is its own TOP, never tested) or sliding in at a height one row above a
// platform (same "resting fish's center row is the EMPTY row above the
// floor" gap ramps already had) sails straight through with zero collision
// on those two edges. TILE_PLATFORM deliberately stays in SOLID_TILES
// itself (isSolid()/building-placement/every other non-physics use of it
// elsewhere in this file is untouched) — this only ADDS a genuine circle-
// vs-rectangle resolution alongside the existing flat check, exactly
// mirroring resolveRampCollision/resolveRampCollisionAt's own real-geometry
// approach but for a full square instead of a triangle. The existing flat
// top-landing check still runs first and returns early on a normal fall
// from directly above, so this never fights it over a routine landing —
// it only ever fires for the side/bottom contacts the flat check misses.
function resolvePlatformCollisionAt(item, state, tileType, col, row) {
  if (tileType !== TILE_PLATFORM) return false;
  if (platformIgnoresItem(state, tileType, col, row, item.type)) return false;
  const left = col * TILE_SIZE;
  const top = row * TILE_SIZE;
  const right = left + TILE_SIZE;
  const bottom = top + TILE_SIZE;
  const closestX = Math.min(Math.max(item.x, left), right);
  const closestY = Math.min(Math.max(item.y, top), bottom);
  const dx = item.x - closestX;
  const dy = item.y - closestY;
  const distSq = dx * dx + dy * dy;
  let nx;
  let ny;
  let penetration;
  if (distSq > 1e-9) {
    if (distSq >= item.radius * item.radius) return false; // not touching this tile's square at all
    const dist = Math.sqrt(distSq);
    nx = dx / dist;
    ny = dy / dist;
    penetration = item.radius - dist;
  } else {
    // Center is exactly inside the rectangle (a big single step, or an item
    // spawned inside) — escape along whichever of the 4 edges is nearest,
    // the standard AABB-vs-circle "deeply embedded" resolution.
    const distLeft = item.x - left;
    const distRight = right - item.x;
    const distTop = item.y - top;
    const distBottom = bottom - item.y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    if (minDist === distLeft) { nx = -1; ny = 0; penetration = item.radius + distLeft; }
    else if (minDist === distRight) { nx = 1; ny = 0; penetration = item.radius + distRight; }
    else if (minDist === distTop) { nx = 0; ny = -1; penetration = item.radius + distTop; }
    else { nx = 0; ny = 1; penetration = item.radius + distBottom; }
  }
  item.x += nx * penetration;
  item.y += ny * penetration;
  const tx = -ny;
  const ty = nx;
  const vNormal = item.vx * nx + item.vy * ny;
  const vTangent = item.vx * tx + item.vy * ty;
  const newVNormal = vNormal < 0 ? -vNormal * RAMP_BOUNCE_RESTITUTION : vNormal;
  item.vx = vTangent * tx + newVNormal * nx;
  item.vy = vTangent * ty + newVNormal * ny;
  return true;
}

// Same neighborhood-scan shape as resolveRampCollision, checking every
// TILE_PLATFORM tile whose square footprint could overlap the item's
// circular body — not just whatever single tile/row a naive point check
// would happen to land on.
function resolvePlatformCollision(item, state) {
  const grid = state.level.grid;
  const minCol = colAt(item.x - item.radius);
  const maxCol = colAt(item.x + item.radius);
  const minRow = rowAt(item.y - item.radius);
  const maxRow = rowAt(item.y + item.radius);
  let resolvedAny = false;
  for (let row = minRow; row <= maxRow; row++) {
    if (!grid[row]) continue;
    for (let col = minCol; col <= maxCol; col++) {
      if (col < 0 || col >= grid[row].length) continue;
      if (grid[row][col] !== TILE_PLATFORM) continue;
      if (resolvePlatformCollisionAt(item, state, grid[row][col], col, row)) resolvedAny = true;
    }
  }
  return resolvedAny;
}

// Per-tier fan stats, keyed by tile id — Grid.js's own lookup table (not
// duplicated onto BUILDING_TYPES, which is presentation/shop data).
export const FAN_STATS = {
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
// *bottom* edge reads as TILE_EMPTY instead, but that's not a way out either
// — sweepVertical's own hard stop at WORLD_H (see that function) always
// catches an item right at the world's real floor, built or not.
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

// Per direct request ("if there's multiple buildings stacked vertically
// that all output objects, the object... needs to output from the top of
// the top building, instead of getting stuck in the middle buildings") —
// walks straight up from a building's own row while each cell directly
// above it is ALSO solid (another building occupying it), stopping at the
// first empty/non-solid cell (or the top of the seabed). Used by the
// Refinery/Manufacturer output-point calculation below so an ejected item's
// fixed spawn point anchors to the TOPMOST building in a vertical stack
// instead of clipping straight into whatever's directly above the one
// actually doing the ejecting.
function topOfBuildingStackRow(state, col, row) {
  let topRow = row;
  while (topRow - 1 >= SEABED_ROW_START && isSolid(state.level.grid[topRow - 1][col])) {
    topRow--;
  }
  return topRow;
}

// ---- Platform item filters ----
// Per direct request: every Platform variant (the flat tile AND all 4 Half
// Platform ramps) can be turned into a collision filter — UI.js's
// openPlatformFilterMenu edits `state.level.buildingData`'s `filterItems`
// (array of item type ids) field for that tile. Whitelist-only, per a later
// direct simplification ("only have whitelisting for the filters... by
// default have all the objects look like they are blacklisted... if you
// click them, they toggle to a green checkmark") — every item type starts
// OUT of the list (shown red-X in the pop-up, still collides normally,
// exactly like a plain Platform always has) and only the ones the player
// explicitly clicks into the list (shown green-check) pass through with
// zero collision, as if the tile were plain open air for that one item
// type. This is checked centrally by isSolidForItem below, the one gate
// every solid-tile collision check (sweepVertical/sweepHorizontal/
// applyItemPush) and the ramp wedge's own resolveRampCollisionAt both go
// through, rather than a separate special-case at each site. A fresh
// Platform's `filterItems` starts empty, which is why it behaves exactly
// like it always has until the player actually opens the pop-up and adds
// something to the list.
function platformIgnoresItem(state, tileType, col, row, itemType) {
  if (!PLATFORM_FLAT_COST_TILES.has(tileType)) return false;
  const data = state.level.buildingData[buildingKey(col, row)];
  if (!data) return false;
  return data.filterItems.includes(itemType);
}

// The one gate every flat-solid-tile collision check goes through now — a
// plain isSolid(tile) check UNLESS `tile` is a Platform with an active
// filter that ignores this specific item, in which case it behaves exactly
// like empty space for that one item (see platformIgnoresItem above).
function isSolidForItem(state, tile, col, row, itemType) {
  if (!isSolid(tile)) return false;
  if (platformIgnoresItem(state, tile, col, row, itemType)) return false;
  return true;
}

// col/row here are tile indices, not world px — used by build-mode UI/main.js.
export function getTile(grid, col, row) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  return grid[row][col];
}

export function worldToTile(x, y) {
  return { col: colAt(x), row: rowAt(y) };
}

// Returns the "row,col" buildingData key of a Manufacturer/Power Plant tile
// at this world point, or null — used by main.js's click handler to open
// UI.js's recipe pop-up menu (openRecipeMenu) whenever the player clicks
// either of these two recipe-driven buildings.
export function getRecipeBuildingKeyAt(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  const type = state.level.grid[row][col];
  if (!MANUFACTURER_TILES.has(type) && !POWER_PLANT_TILES.has(type)) return null;
  return buildingKey(col, row);
}

// Returns the "row,col" buildingData key of a placed Platform (any of its 5
// variants) OR a Fan at this world point, or null — used by main.js's click
// handler to open UI.js's item-filter pop-up (openPlatformFilterMenu)
// instead of the generic building-info one every other placed building
// gets, per direct request ("turn ALL the platforms into object filters...
// when you left click a platform, it opens the filter modal"), later
// extended to Fans too ("make fans work as filters the same as platforms,
// with a filter modal when you click on them") — same `filterItems` field,
// same pop-up, same drag-copy mechanic (copyPlatformFilter), just applied
// to computeFanForce's per-item force loop for a Fan instead of collision
// for a Platform. Kept under its original Platform-only name (this file has
// a LOT of call sites already reading it) rather than a renamed/duplicated
// pair of functions.
export function getPlatformFilterKeyAt(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  const type = state.level.grid[row][col];
  if (!PLATFORM_FLAT_COST_TILES.has(type) && !FAN_TILES.has(type)) return null;
  return buildingKey(col, row);
}

// A placed Storage Chest tile (any tier) at this world point, or null — used
// by main.js's click handler to open UI.js's chest popup, and by its own
// chest-aim mousedown handler to tell whether a press landed on one at all.
export function getChestKeyAt(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  const type = state.level.grid[row][col];
  if (!STORAGE_CHEST_TILES.has(type)) return null;
  return buildingKey(col, row);
}

// Arms (or re-aims) a chest's auto-trickle — called once, at mouseup, by
// main.js's chest-aim drag gesture. Resets trickleTimerMs to 0 so the very
// first ejection along the newly-chosen direction fires almost immediately
// rather than waiting out a stale leftover countdown from before this call.
export function armChestTrickle(state, key, angle) {
  const data = state.level.buildingData[key];
  if (!data) return;
  data.trickleActive = true;
  data.trickleAngle = angle;
  data.trickleTimerMs = 0;
}

// The chest popup's "Stop Trickle" button — per direct design, only ever
// pauses trickleActive; trickleAngle is deliberately left alone so a later
// re-drag (or a "Clear Chest" press) still has a real remembered direction
// to reuse instead of falling back to the random scatter.
export function stopChestTrickle(state, key) {
  const data = state.level.buildingData[key];
  if (!data) return;
  data.trickleActive = false;
}

// The chest popup's "Clear Chest" button — per direct request, doesn't dump
// everything on the same tick; just arms `clearing`, which updateBuildings'
// own chest branch above drains at STORAGE_CHEST_CLEAR_INTERVAL_MS per item
// (aimed along trickleAngle if one's ever been set, otherwise a random
// low-force scatter — see ejectOneFromChest).
export function clearChestContents(state, key) {
  const data = state.level.buildingData[key];
  if (!data || data.count <= 0) return;
  data.clearing = true;
  data.clearTimerMs = 0;
}

// Returns { key, type } for ANY placed building tile at this world point
// (Manufacturer/Power Plant included), or null — used by main.js's click
// handler to open UI.js's generic building-info pop-up (openBuildingInfoMenu)
// per direct request ("any building can be quickly clicked on to see what it
// is and what it does"). Manufacturer/Power Plant are still checked and
// handled FIRST by getRecipeBuildingKeyAt above (their own recipe pop-up
// already shows this same shop-style info, see UI.js's openRecipeMenu) — a
// caller should only fall back to this one once that check has already come
// back null, so the two pop-ups never both fire for the same click.
export function getBuildingInfoKeyAt(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return null;
  const type = state.level.grid[row][col];
  if (type === TILE_EMPTY) return null;
  return { key: buildingKey(col, row), type };
}

// Live count of tiles of one exact type currently on the grid — what
// getBuildingCost scales off of. Counted fresh every call rather than
// tracked as a running counter, same "no separate bookkeeping to keep in
// sync" approach the Economy Fish dynamic pricing already uses (a demolished
// tile brings the next one's price back down automatically).
export function countPlacedOfType(grid, buildingId) {
  let n = 0;
  for (let r = SEABED_ROW_START; r < WORLD_TILES_H; r++) {
    for (let c = 0; c < WORLD_TILES_W; c++) {
      if (grid[r][c] === buildingId) n++;
    }
  }
  return n;
}

// Whether a base Waste Turret is already placed — per direct request, the
// post-alien guided tutorial's own "place a Waste Turret" leg only runs if
// there isn't one yet (see Systems.js's updatePostAlienTutorial). Only the
// base tier counts — Electric/Advanced Turrets don't consume Waste as ammo
// at all (unlimited ammo, a power cost instead — see TURRET_STATS' own
// comment), so they're not a substitute for "learn to feed a Waste Turret."
export function hasWasteTurretPlaced(state) {
  for (const key in state.level.buildingData) {
    if (state.level.buildingData[key].type === TILE_TURRET_WASTE) return true;
  }
  return false;
}

// Finds the nearest Waste Turret (first one found — there's realistically
// only ever one during the tutorial this feeds) and its target Waste item —
// shared by UI.js's guided-tutorial spotlight (which needs both positions to
// draw one circle encompassing them) and main.js's ghost-waste animation/
// drag-completion check, so all three always agree on the exact same target
// pair rather than each picking independently. Returns null if there's no
// Waste Turret at all; `waste` is null (turret still populated) if none
// exists yet either.
//
// The Waste target LOCKS onto whichever item is first picked
// (state.level.wasteDragTutorialTargetId) instead of re-resolving "nearest
// to the Turret" fresh every call — per direct report, re-picking every
// frame let a fresh piece of Waste that happened to fall closer to the
// Turret steal the spotlight/ghost-animation destination out from under
// whatever the player was already lining up to grab, and the tutorial's own
// spotlight circle (centered on the two targets) would jump along with it,
// meaning a click aimed at the original piece could land outside the
// overlay's clickable hole and get swallowed instead of reaching the
// canvas. The lock is cleared (falls through to a fresh pick) if the
// tracked item is ever gone — absorbed some other way — and reset to null
// whenever the drag step itself starts or ends (see UI.js's
// startTutorialFlow/advanceTutorialFlow and main.js's Escape-skip handler).
export function findNearestWasteTurretAndWaste(state) {
  let turret = null;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    if (data.type !== TILE_TURRET_WASTE) continue;
    const [row, col] = key.split(',').map(Number);
    turret = { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
    break;
  }
  if (!turret) return null;

  if (state.level.wasteDragTutorialTargetId !== null) {
    const locked = state.level.items.find(
      (item) => item.id === state.level.wasteDragTutorialTargetId && item.type === 'waste'
    );
    if (locked) return { turret, waste: locked };
    state.level.wasteDragTutorialTargetId = null;
  }

  let waste = null;
  let wasteDist = Infinity;
  for (const item of state.level.items) {
    if (item.type !== 'waste') continue;
    const d = Math.hypot(item.x - turret.x, item.y - turret.y);
    if (d < wasteDist) { wasteDist = d; waste = item; }
  }
  if (waste) state.level.wasteDragTutorialTargetId = waste.id;
  return { turret, waste };
}

// Which compounding rate a building's live cost climbs at, tiered off its
// own BASE cost — see Config.js's comment above BUILDING_COST_GROWTH_RATE_TIER1
// for the exact thresholds/rationale.
function buildingCostGrowthRate(baseCost) {
  if (baseCost > 200) return BUILDING_COST_GROWTH_RATE_TIER3;
  if (baseCost > 100) return BUILDING_COST_GROWTH_RATE_TIER2;
  return BUILDING_COST_GROWTH_RATE_TIER1;
}

// Every building's live shop cost — Platform (any of its 3 variants — see
// PLATFORM_FLAT_COST_TILES) is a flat PLATFORM_FLAT_COST regardless of how
// many exist; every other building's cost compounds at its own tiered rate
// for each tile of that exact type already placed, rounded up — see
// Config.js's comment above PLATFORM_FLAT_COST for the full rationale.
export function getBuildingCost(state, buildingId) {
  const building = BUILDING_TYPES[buildingId];
  if (!building) return Infinity;
  if (PLATFORM_FLAT_COST_TILES.has(buildingId)) return PLATFORM_FLAT_COST;
  const n = countPlacedOfType(state.level.grid, buildingId);
  return Math.ceil(building.cost * Math.pow(buildingCostGrowthRate(building.cost), n));
}

// Returns { ok, reason } rather than a bare bool so the build-mode UI can
// show *why* a placement is invalid (ghost preview tint, tooltip, etc).
// `ignoreCost` skips the affordability check entirely — used by the
// right-click-to-move mechanic (main.js's movingBuilding/pickUpBuildingForMove/
// putDownMovedBuilding below), since relocating an already-owned building is
// always free regardless of the player's current balance.
export function canPlaceTile(state, col, row, buildingId, ignoreCost = false) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) {
    return { ok: false, reason: 'out of bounds' };
  }
  if (state.level.grid[row][col] !== TILE_EMPTY) return { ok: false, reason: 'occupied' };
  const building = BUILDING_TYPES[buildingId];
  if (!building) return { ok: false, reason: 'unknown building' };
  if (!ignoreCost && state.level.money < getBuildingCost(state, buildingId)) return { ok: false, reason: 'cannot afford' };
  return { ok: true, reason: null };
}

// Real bug fixed, per direct report: a moved Refinery/Manufacturer/Power
// Plant used to carry its ENTIRE buildingData object forward untouched,
// including whatever it was mid-processing — data.progressMs sitting
// partway to completion, and data.heldItemId/lockedRecipe still pointing at
// the exact item that had just been physically released back into normal
// physics (see pickUpBuildingForMove below). Once progressMs finished
// counting up at the NEW location, updateBuildings still tried to "finish"
// that same item id and spawn its output — even though the real item was by
// then floating somewhere completely unrelated, not touching the building
// at all — making it silently vanish from the world for no visible reason.
// Per direct spec ("the building should reset any processing/held items
// completely... the only thing preserved is the recipe when moving a
// building"), a move now resets every in-progress field back to the exact
// same fresh/idle shape placeTile itself would give a brand-new tile of
// that type, carrying over ONLY the player's own chosen recipeId (there's
// nothing to choose again if it already had one). A Fan/Collector's own
// data (`{ type, angle }`) has no processing state to reset in the first
// place, and a Turret's `ammo`/`cooldownMs` are already-banked resource
// state, not a reference to any specific held item — both pass through
// completely untouched.
function resetBuildingProcessingState(type, data) {
  if (!data) return null;
  if (MANUFACTURER_TILES.has(type)) {
    const recipe = MANUFACTURER_RECIPES[data.recipeId];
    return {
      type, recipeId: data.recipeId, pendingInputs: recipe ? [...recipe.inputs] : [],
      processing: false, currentItemType: null, progressMs: 0, ghostFlashTimerMs: 0, heldItemId: null,
    };
  }
  if (POWER_PLANT_TILES.has(type)) {
    return { type, recipeId: data.recipeId, fueled: false, progressMs: 0 };
  }
  if (REFINERY_TILES.has(type)) {
    return { type, lockedRecipe: null, progressMs: 0, heldItemId: null };
  }
  return data;
}

// The "pick up" half of right-click-to-move (main.js's movingBuilding) — per
// direct request ("make it so that all other buildings can be right
// clicked... it creates a ghost copy of the building on the cursor"). Clears
// the tile and its buildingData entry with no refund and no sound (unlike
// removeTile, a genuine demolish), resets any in-progress processing state
// (see resetBuildingProcessingState above), and hands the caller back
// everything needed to put it down again elsewhere. Returns null if there
// was nothing there to pick up. Releasing an item the building was
// mid-processing/holding back to normal physics needs no extra code here at
// all — per direct request ("moving any building spits out the items being
// processed or held, if any") — clearing the buildingData entry (and the
// tile's own type) is already exactly what stepHeldItem/
// stepCollectorProcessing's own defensive "the tile got torn down mid-hold"
// fallback checks for, the same safety net a real demolish already relies on.
export function pickUpBuildingForMove(state, col, row) {
  const type = getTile(state.level.grid, col, row);
  if (type === TILE_EMPTY) return null;
  const key = buildingKey(col, row);
  const data = resetBuildingProcessingState(type, state.level.buildingData[key] || null);
  state.level.grid[row][col] = TILE_EMPTY;
  delete state.level.buildingData[key];
  return { type, data };
}

// The "put down" half — places a previously-picked-up building back at a
// (possibly new, possibly the exact same) location, completely free, with
// whatever data pickUpBuildingForMove handed back (already stripped of any
// in-progress processing state by resetBuildingProcessingState above — a
// Fan/Collector's angle and a Turret's ammo/cooldown are real exceptions,
// carried over exactly as-is). Returns the same { ok, reason } shape
// canPlaceTile does, so callers can show a real failure reason
// (handleBuildPlacementFailure) without a placement actually happening.
export function putDownMovedBuilding(state, col, row, buildingId, data) {
  const check = canPlaceTile(state, col, row, buildingId, true);
  if (!check.ok) return check;
  state.level.grid[row][col] = buildingId;
  if (data) state.level.buildingData[buildingKey(col, row)] = data;
  return check;
}

// `angle` (radians, atan2 convention: 0 = +x/right, +y is down) is only
// functionally meaningful for Fans now — it's the aim direction locked in
// at placement (see UI/main.js's build-drag, which derives it from the
// cursor's exact sub-tile position). Stored in state.level.buildingData,
// keyed by "row,col", since the grid array itself only holds a bare type id
// string. The Collector still gets an `angle` field written below purely
// for historical/shape consistency — it has no directional intake/output of
// its own any more (removed along with the Auto-Feeder's own aim, see
// updateBuildings' collector intake scan below.
export function placeTile(state, col, row, buildingId, angle = 0) {
  const check = canPlaceTile(state, col, row, buildingId);
  if (!check.ok) return false;
  state.level.money -= getBuildingCost(state, buildingId);
  state.level.grid[row][col] = buildingId;
  state.meta.stats.buildingsPlaced += 1; // buildings_placed_10/50 achievements
  state.level.lastPurchaseAtMs = state.level.elapsed; // see Systems.js's updateIdlePurchaseHint
  if (FAN_TILES.has(buildingId)) {
    // filterItems: [] — per direct request ("make fans work as filters the
    // same as platforms"), same whitelist-of-ignored-types shape/semantics
    // as a Platform's own filterItems (see platformIgnoresItem's comment),
    // just applied to computeFanForce's own per-item force loop instead of
    // collision. Empty by default, so a fresh Fan blows every item type
    // exactly as it always has until the player opens its filter pop-up.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, angle, filterItems: [] };
  } else if (COLLECTOR_TILES.has(buildingId)) {
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, angle };
  } else if (TURRET_TILES.has(buildingId)) {
    // No player-chosen `angle` — a turret auto-targets, it doesn't have one.
    // `aimAngle` is different: a purely visual field (renderTurretIcon's own
    // gun arm), continuously overwritten by updateBuildings' turret branch
    // toward whatever the nearest living alien is, every tick one exists —
    // defaults to straight up (-PI/2) so a freshly-placed turret with no
    // target yet still points somewhere sensible (up into the water column,
    // where aliens actually are) instead of sideways. `ammo` matters for any
    // tile in TURRET_AMMO_TILES (Waste + Electric Waste Turret — both start
    // empty, have to be fed, see updateBuildings' turret intake scan);
    // Advanced ignores it entirely (unlimited ammo, a power cost instead).
    // `cooldownMs` counts down to the next shot regardless of tier — see
    // updateBuildings' turret-fire branch. `ammoWaste`/`ammoBiomass` are two
    // separate counters, not one pool, since Biomass ammo deals more damage
    // per shot than Waste (see BIOMASS_TURRET_DAMAGE_MULTIPLIER) — both
    // start empty.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, ammoWaste: 0, ammoBiomass: 0, cooldownMs: 0, aimAngle: -Math.PI / 2 };
  } else if (REFINERY_TILES.has(buildingId)) {
    // No `angle` — same fixed top-center output every recipe-driven building
    // shares (see updateBuildings). lockedRecipe is null while idle, else
    // 'waste_to_food' | 'dna_to_biomass' — set the instant its one input is
    // absorbed, cleared again once that recipe's output ejects. heldItemId
    // (null while idle) is the id of whichever item is currently being
    // pulled to center and disintegrated — see stepHeldItem/updateBuildings.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, lockedRecipe: null, progressMs: 0, heldItemId: null };
  } else if (MANUFACTURER_TILES.has(buildingId)) {
    // Does nothing (and draws no power) until a recipe is picked via UI.js's
    // recipe pop-up menu — recipeId stays null until then. pendingInputs is
    // whichever of that recipe's 2 ingredient types haven't been absorbed
    // yet THIS cycle (reset to a fresh copy of the recipe's own `inputs`
    // array every time a recipe is picked/cleared, or a full cycle
    // completes) — only one item may be absorbed/mid-process at a time (see
    // updateBuildings), so `processing`/`currentItemType`/`progressMs`/
    // `heldItemId` (the id of whichever item is currently being pulled to
    // center and disintegrated) track that single in-flight item.
    // `ghostFlashTimerMs` drives the periodic "still need this ingredient"
    // ghost-icon flash — see renderManufacturerGhostFlash below.
    state.level.buildingData[buildingKey(col, row)] = {
      type: buildingId, recipeId: null, pendingInputs: [], processing: false,
      currentItemType: null, progressMs: 0, ghostFlashTimerMs: 0, heldItemId: null,
    };
  } else if (POWER_PLANT_TILES.has(buildingId)) {
    // Same "does nothing until a recipe is picked" rule as the Manufacturer,
    // but a single-fuel-item recipe, not a 2-ingredient one — fueled flips
    // true the instant its one fuel item is absorbed, then progressMs counts
    // up (unpowered — it's the thing GENERATING power) to the recipe's own
    // durationMs before crediting powerOutputMw and resetting.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, recipeId: null, fueled: false, progressMs: 0 };
  } else if (PLATFORM_FLAT_COST_TILES.has(buildingId)) {
    // Every Platform variant (flat + all 4 ramps) can be turned into an item
    // filter — see platformIgnoresItem's own comment above. filterItems
    // starts empty (a plain, always-solid Platform) until the player opens
    // UI.js's openPlatformFilterMenu and whitelists something.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, filterItems: [] };
  } else if (STORAGE_CHEST_TILES.has(buildingId)) {
    // lockedItemType stays null until the first item actually touches it —
    // see updateBuildings' own chest scan below, same first-touch-locks
    // precedent the Refinery's lockedRecipe already established. trickleAngle
    // is null (not 0, a real rightward angle) specifically so "has the
    // player ever armed a direction" is its own distinguishable state, read
    // by UI.js's chest popup and Grid.js's clearChestContents (the random-
    // scatter-vs-aimed fallback for "Clear Chest"). coinValueSum only ever
    // matters while lockedItemType === 'coin' (a coin's own value varies per
    // instance, unlike every other storable type) — kept on every chest
    // uniformly rather than conditionally, harmless dead weight otherwise.
    state.level.buildingData[buildingKey(col, row)] = {
      type: buildingId, lockedItemType: null, count: 0, coinValueSum: 0,
      trickleActive: false, trickleAngle: null,
      clearing: false, clearTimerMs: 0,
    };
  }
  if (!state.level.tutorialFlags.firstBuildingPlaced) {
    state.level.tutorialFlags.firstBuildingPlaced = true;
    pushGridNotification(state, FIRST_BUILDING_PLACED_MESSAGE);
  }
  if (FAN_TILES.has(buildingId) && !state.level.tutorialFlags.firstFanPlaced) {
    state.level.tutorialFlags.firstFanPlaced = true;
    pushGridNotification(state, FIRST_FAN_PLACED_MESSAGE);
  }
  playBuildPlace();
  return true;
}

// Refunds a fraction of the removed building's cost — computed off its
// current live cost (getBuildingCost, evaluated before this tile is actually
// removed from the count) rather than its static base cost, so a full-refund
// (TILE_REFUND_FRACTION = 1.0) place-then-immediately-demolish stays exactly
// cost-neutral even at a higher placed count, instead of refunding less than
// the dynamic price actually paid. Never removes a tile an item happens to
// be riding mid-tick; physics only ever reads the grid at the start of an
// item's step, so a same-tick removal is safe either way.
export function removeTile(state, col, row) {
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return false;
  const existing = state.level.grid[row][col];
  if (existing === TILE_EMPTY) return false;
  const building = BUILDING_TYPES[existing];
  const liveCost = getBuildingCost(state, existing);
  state.level.grid[row][col] = TILE_EMPTY;
  delete state.level.buildingData[buildingKey(col, row)];
  if (building) state.level.money += Math.floor(liveCost * TILE_REFUND_FRACTION);
  playDemolish();
  return true;
}

// Sets a building's recipe to exactly `next` (null clears it), resetting
// whatever was already absorbed/mid-process — ingredients only make sense
// in the context of the recipe that wanted them. Shared by UI.js's
// toggleBuildingRecipe (the recipe pop-up's own click-to-toggle) and
// copyBuildingRecipe (the drag-to-copy mechanic), plus placeBlueprint below,
// so none of the three can ever drift out of sync on what "picking a
// recipe" actually resets. Lives here rather than in UI.js (which owns the
// other two call sites) specifically so placeBlueprint can reach it too
// without a circular import — UI.js already imports heavily from Grid.js,
// so the dependency only works in this direction.
export function applyRecipeToBuilding(data, next) {
  data.recipeId = next;
  if (data.type === TILE_MANUFACTURER) {
    data.pendingInputs = next ? [...MANUFACTURER_RECIPES[next].inputs] : [];
    data.processing = false;
    data.currentItemType = null;
    data.progressMs = 0;
    data.ghostFlashTimerMs = 0;
  } else {
    data.fueled = false;
    data.progressMs = 0;
  }
}

// ---- Blueprint tool ("Stamp") — per direct request: click-and-drag a box
// over a built area to copy every building inside it, then paste that whole
// layout somewhere else in one click. Mostly a LAYOUT copy, not an instance
// copy — captureBlueprint records each cell's building type, (for a Fan
// specifically) its own aim angle, and (for a Manufacturer/Power Plant) its
// currently-picked recipeId, relative to the selection box's own top-left
// corner; every OTHER building's in-progress state (a Turret's ammo, a
// Refinery's mid-hold item) is still NOT carried over, since pasting a
// stamp is a genuine fresh purchase per building — recipes are the one
// deliberate exception, per direct request ("make it so the blueprint tool
// copies recipes to the newly placed buildings from their respective copied
// building") — a freshly-stamped Manufacturer/Power Plant with no recipe
// picked does nothing at all until you open its pop-up, which made a large
// stamped factory layout tedious to re-configure by hand every single time.
export function captureBlueprint(state, colA, rowA, colB, rowB) {
  const minCol = Math.min(colA, colB);
  const maxCol = Math.max(colA, colB);
  const minRow = Math.min(rowA, rowB);
  const maxRow = Math.max(rowA, rowB);
  const cells = [];
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const type = getTile(state.level.grid, col, row);
      if (!type || type === TILE_EMPTY) continue;
      const data = state.level.buildingData[buildingKey(col, row)];
      cells.push({
        dCol: col - minCol, dRow: row - minRow, buildingId: type,
        angle: (data && data.angle) || 0,
        recipeId: (data && (MANUFACTURER_TILES.has(type) || POWER_PLANT_TILES.has(type))) ? data.recipeId : null,
      });
    }
  }
  return cells;
}

// Renders every captured cell as a translucent ghost anchored at
// (baseCol, baseRow) — a cell's OWN real occupancy/bounds check (ignoreCost
// — see computeBlueprintCost's own comment on why) tints it red regardless,
// but even a genuinely empty cell now ALSO shows red the instant the
// STAMP AS A WHOLE isn't affordable — per direct request ("if you can't
// afford the entire blueprint, don't allow any of it to be placed"), so the
// ghost never shows a misleadingly all-green preview for a paste that's
// about to be silently rejected in full by placeBlueprint below.
export function renderBlueprintGhost(ctx, state, baseCol, baseRow, cells) {
  const canAffordWhole = computeBlueprintCost(state, baseCol, baseRow, cells) <= state.level.money;
  for (const cell of cells) {
    const col = baseCol + cell.dCol;
    const row = baseRow + cell.dRow;
    const check = canPlaceTile(state, col, row, cell.buildingId, true);
    const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
    const size = TILE_SIZE * state.camera.zoom;
    const color = BUILDING_TYPES[cell.buildingId].color;
    ctx.save();
    ctx.globalAlpha = 0.6;
    renderTileShape(ctx, cell.buildingId, color, screen.x, screen.y, size, { angle: cell.angle });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = check.ok && canAffordWhole ? '#7cff5a' : '#ff5a5a';
    ctx.fillRect(screen.x, screen.y, size, size);
    ctx.restore();
  }
}

// Commits a blueprint stamp at (baseCol, baseRow) — per direct request
// ("if you can't afford the entire blueprint, don't allow any of the
// blueprint to be placed, instead of buying what can be afforded"), this is
// now genuinely all-or-nothing on cost: if the stamp's real total (every
// cell that COULD physically go down, occupancy/bounds permitting — see
// computeBlueprintCost) exceeds current money, nothing is placed at all and
// nothing is spent. Once that gate passes, the actual placement loop still
// silently skips any individual cell that's occupied/out of bounds — "for
// placement where there are no overlapping buildings" — since that's a
// genuinely different concern (can't build there at all) from affordability
// (could build there, just not paid for). Returns the list of cells
// actually placed so main.js can push one Ctrl+Z undo entry per real
// placement, same as any other individual building purchase.
export function placeBlueprint(state, baseCol, baseRow, cells) {
  const totalCost = computeBlueprintCost(state, baseCol, baseRow, cells);
  if (totalCost > state.level.money) return [];
  const placedCells = [];
  for (const cell of cells) {
    const col = baseCol + cell.dCol;
    const row = baseRow + cell.dRow;
    const check = canPlaceTile(state, col, row, cell.buildingId);
    if (!check.ok) continue;
    if (placeTile(state, col, row, cell.buildingId, cell.angle)) {
      // Carries the captured recipe over to the freshly-placed instance —
      // see captureBlueprint's own comment. placeTile already gave it a
      // fresh, recipe-less buildingData entry; applyRecipeToBuilding both
      // sets recipeId and resets the same pendingInputs/fueled/progress
      // fields a real recipe pick always does, so the new building starts
      // exactly as if the player had just picked it by hand.
      if (cell.recipeId) {
        const data = state.level.buildingData[buildingKey(col, row)];
        if (data) applyRecipeToBuilding(data, cell.recipeId);
      }
      placedCells.push({ col, row, buildingId: cell.buildingId });
    }
  }
  return placedCells;
}

// Live total cost of pasting a captured stamp at (baseCol, baseRow) — per
// direct request, shown as a cost bubble while the stamp follows the
// cursor, AND the one source of truth placeBlueprint's own all-or-nothing
// affordability gate checks against. A cell is only ever excluded from this
// total for a genuine "can't build there at all" reason — occupied, out of
// bounds — checked with ignoreCost:true deliberately, so an individual
// cell's own real-time affordability against not-yet-decremented money
// never silently drops it from the count (the whole point of this total is
// to answer "what would the ENTIRE stamp cost," not "what does whatever
// happens to already be affordable cost"). Mirrors getBuildingCost's own
// compounding formula, but tracks a hypothetical extra count per building
// type AS IT WALKS THE LIST — placeBlueprint places cells one at a time, so
// a stamp with several of the exact same building genuinely costs more for
// the 2nd/3rd/... one than the live grid count alone would suggest, since
// each successive placement raises the next one's own live cost the same
// way placing them one at a time by hand would.
export function computeBlueprintCost(state, baseCol, baseRow, cells) {
  let total = 0;
  const extraCounts = {};
  for (const cell of cells) {
    const col = baseCol + cell.dCol;
    const row = baseRow + cell.dRow;
    if (!canPlaceTile(state, col, row, cell.buildingId, true).ok) continue;
    const building = BUILDING_TYPES[cell.buildingId];
    if (!building) continue;
    if (PLATFORM_FLAT_COST_TILES.has(cell.buildingId)) { total += PLATFORM_FLAT_COST; continue; }
    const extra = extraCounts[cell.buildingId] || 0;
    const n = countPlacedOfType(state.level.grid, cell.buildingId) + extra;
    total += Math.ceil(building.cost * Math.pow(buildingCostGrowthRate(building.cost), n));
    extraCounts[cell.buildingId] = extra + 1;
  }
  return total;
}

// T debug key — cycles the tile under the cursor through every building type
// (plus empty) for free, ignoring cost/occupancy/anchoring. Fans default to
// pointing straight up (toward the water column) since that's the most
// useful direction to test filtration with.
const CHEAT_CYCLE = [
  TILE_EMPTY, TILE_PLATFORM, TILE_PLATFORM_HALF_LEFT, TILE_PLATFORM_HALF_RIGHT,
  TILE_PLATFORM_HALF_TOPLEFT, TILE_PLATFORM_HALF_TOPRIGHT,
  TILE_COLLECTOR, TILE_COLLECTOR_ELECTRIC, TILE_COLLECTOR_ADVANCED,
  TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4,
  TILE_TURRET_WASTE, TILE_TURRET_ELECTRIC, TILE_TURRET_ADVANCED,
  TILE_REFINERY, TILE_REFINERY_ELECTRIC, TILE_REFINERY_ADVANCED,
  TILE_MANUFACTURER, TILE_POWER_PLANT,
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
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE, filterItems: [] };
  } else if (COLLECTOR_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE };
  } else if (TURRET_TILES.has(next)) {
    // Cheat-cycled turrets start pre-loaded with max ammo (any ammo-consuming
    // tier — see TURRET_AMMO_TILES) so testing combat doesn't require
    // grinding real Waste first.
    state.level.buildingData[buildingKey(col, row)] = { type: next, ammoWaste: TURRET_AMMO_TILES.has(next) ? WASTE_TURRET_MAX_AMMO : 0, ammoBiomass: 0, cooldownMs: 0, aimAngle: -Math.PI / 2 };
  } else if (REFINERY_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, lockedRecipe: null, progressMs: 0, heldItemId: null };
  } else if (MANUFACTURER_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = {
      type: next, recipeId: null, pendingInputs: [], processing: false,
      currentItemType: null, progressMs: 0, ghostFlashTimerMs: 0, heldItemId: null,
    };
  } else if (POWER_PLANT_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, recipeId: null, fueled: false, progressMs: 0 };
  } else if (PLATFORM_FLAT_COST_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, filterItems: [] };
  }
}

// R hotkey, second half — per direct request: hovering an already-PLACED
// Platform (any of its 5 variants) and pressing R cycles it in place, for
// free, to the next variant — "only when not selected on a building" (see
// main.js's KeyR handler, which only calls this while no build:/fish: tool
// is currently armed; while one IS armed, R instead cycles the SHOP
// selection via UI.js's cycleSelectedBuildingFamily). Carries the tile's own
// item filter (filterItems — see platformIgnoresItem's own comment) across
// the cycle: swapping which SHAPE a Platform is doesn't change what it's
// configured to let through, so there's nothing to reset here, only the
// grid's own type string and the buildingData entry's own `type` field
// (kept in sync with it, same as every other building).
const PLATFORM_CYCLE = [
  TILE_PLATFORM, TILE_PLATFORM_HALF_LEFT, TILE_PLATFORM_HALF_RIGHT,
  TILE_PLATFORM_HALF_TOPLEFT, TILE_PLATFORM_HALF_TOPRIGHT,
];
export function cyclePlatformAt(state, worldX, worldY) {
  const { col, row } = worldToTile(worldX, worldY);
  if (row < SEABED_ROW_START || row >= WORLD_TILES_H || col < 0 || col >= WORLD_TILES_W) return false;
  const current = state.level.grid[row][col];
  const idx = PLATFORM_CYCLE.indexOf(current);
  if (idx === -1) return false; // not a Platform tile at all
  const next = PLATFORM_CYCLE[(idx + 1) % PLATFORM_CYCLE.length];
  state.level.grid[row][col] = next;
  const key = buildingKey(col, row);
  const data = state.level.buildingData[key];
  if (data) data.type = next;
  else state.level.buildingData[key] = { type: next, filterItems: [] };
  return true;
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
  const efficiency = state.level.powerEfficiency;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const stats = FAN_STATS[data.type];
    if (!stats) continue; // not a fan (e.g. the Auto-Feeder's own buildingData entry)
    // Per direct request ("make fans work as filters the same as
    // platforms") — a Fan whitelists which item types it IGNORES, same
    // filterItems shape/semantics as a Platform's own (see
    // platformIgnoresItem's comment): empty by default (blows everything,
    // exactly like a Fan always has), and an item type only stops being
    // affected once the player explicitly checks it into the pop-up.
    if (data.filterItems && data.filterItems.includes(item.type)) continue;
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
    // A free Fan (Rudimentary, powerCost 0) always runs at full force — only
    // a power-costing tier (Electric/Turbo) gets throttled by the live grid
    // efficiency, same "only power-costing buildings are affected at all"
    // rule every other building below follows.
    const magnitude = stats.maxForce * (1 - dist / stats.maxRange) * (stats.powerCost > 0 ? efficiency : 1);
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

// Sub-steps every swept move in chunks no larger than GRID_SWEEP_SUBSTEP so
// a landing tile can never be skipped over in a single step, regardless of
// how fast the item is currently moving in either direction (this is what
// makes it "swept" rather than a plain end-of-tick position check, which
// could tunnel through a tile if a future speed constant ever got fast
// enough to clear one in a single tick).
function sweepVertical(item, state, dy) {
  const grid = state.level.grid;
  const steps = Math.max(1, Math.ceil(Math.abs(dy) / GRID_SWEEP_SUBSTEP));
  const stepY = dy / steps;
  for (let i = 0; i < steps; i++) {
    const nextBottom = item.y + stepY + item.radius;
    const tile = tileAt(grid, item.x, nextBottom);
    const row = rowAt(nextBottom);
    const col = colAt(item.x);
    // A Half Platform ramp is deliberately never "solid" for this flat
    // top-of-tile check (see SOLID_TILES's own comment) — its own sloped
    // collision is resolved uniformly, for every direction of approach, by
    // resolveRampCollision below, called once per substep so a fast fall
    // can't tunnel past a ramp's surface within one big step. isSolidForItem
    // (not plain isSolid) also lets a Platform's own item filter (see that
    // function's own comment) skip this flat check entirely for a filtered
    // item type — passes straight through as if the tile were empty.
    if (isSolidForItem(state, tile, col, row, item.type)) {
      item.y = row * TILE_SIZE - item.radius; // rest exactly on top of the tile, not overshot into it
      item.vy = 0;
      return { landed: true, tile, row, col };
    }
    // The world's absolute bottom, WORLD_H — nothing built here, just a hard
    // stop so EVERY uncaught item (coin, Science, Food, or Waste) always
    // comes to rest there instead of falling off the bottom of the world and
    // being permanently lost. Per direct request, this replaced the old mid-
    // height Rocky Shelf stop entirely — "remove the upper and lower
    // sections of the city... food, money, waste, and science should all
    // fall to the very bottom of the tank" — so there's no longer an
    // intermediate barrier partway down; everything now falls all the way
    // to the true floor. Only triggers while actually falling into it
    // (stepY > 0) — an item already resting here that a Fan built nearby is
    // actively pushing back up has stepY < 0 and sails right through,
    // unaffected. A real tile placed anywhere above this line (a Collector,
    // a Platform) still catches an item first via the isSolid check above,
    // same as always — this is only the fallback for whatever nothing else
    // caught, which is also why stepItemOnGrid's 'lost' status below stays
    // effectively unreachable through normal gravity: kept purely as a
    // defensive fallback (see its own comment).
    if (stepY > 0 && nextBottom >= WORLD_H) {
      item.y = WORLD_H - item.radius;
      item.vy = 0;
      return { landed: true, tile: null, row: rowAt(WORLD_H), col: colAt(item.x) };
    }
    item.y += stepY;
    // Real Half Platform ramp collision — see resolveRampCollision's own
    // comment. Checked once per substep (not just once at the end of the
    // whole tick) so a fast fall can't tunnel past a ramp's own surface
    // within a single big step the way a plain end-of-tick check could.
    resolveRampCollision(item, state);
    // Full Platform side/bottom collision — see resolvePlatformCollision's
    // own comment. This is what catches an item rising into a platform's
    // underside (the flat check just above only ever tests the item's
    // BOTTOM edge, so a moving-up item's real leading edge, its own top,
    // was never being tested against anything).
    resolvePlatformCollision(item, state);
  }
  return { landed: false };
}

// Sub-steps horizontal movement in GRID_SWEEP_SUBSTEP-sized chunks — the
// same anti-tunneling guarantee sweepVertical already had, now extended to
// horizontal motion too. Per direct report, a fan pushing an item fast
// enough along the ground used to be able to cross an entire ramp tile's
// column within a single big step, before the (old, exact-tile-only) ramp
// check ever got a chance to fire — see this file's Half Platform ramps
// section for the full writeup. Solid-tile blocking is still the exact same
// single-point check as before (preserving the existing, deliberate
// "items glide smoothly across a row of same-height solid tiles" behavior,
// since every building in this game is exactly one tile tall) —
// resolveRampCollision is what's new here, called after every substep so a
// ramp's own wedge (now a real, full-triangle collision — see that
// function's own comment) is caught mid-slide rather than only once per
// whole tick.
function sweepHorizontal(item, state, dx) {
  const grid = state.level.grid;
  const steps = Math.max(1, Math.ceil(Math.abs(dx) / GRID_SWEEP_SUBSTEP));
  const stepX = dx / steps;
  for (let i = 0; i < steps; i++) {
    const nextX = item.x + stepX;
    if (isSolidForItem(state, tileAt(grid, nextX, item.y), colAt(nextX), rowAt(item.y), item.type)) {
      item.vx = 0;
      break;
    }
    item.x = nextX;
    resolveRampCollision(item, state);
    // Full Platform side/bottom collision — see resolvePlatformCollision's
    // own comment. This is what catches an item sliding in at a height one
    // row above a platform (its own center-row-based flat check above,
    // `rowAt(item.y)`, misses the platform's row entirely in exactly that
    // case, the same "resting item's center is one row above the floor it's
    // resting on" gap Half Platform ramps used to have too).
    resolvePlatformCollision(item, state);
  }
}

// A landing on top of any solid tile — including a Collector now — just
// rests there, the same as a Platform. A Collector no longer starts
// processing purely from something landing on top of it; per direct request,
// it only pulls items in from its designated intake side (see
// beginCollectorProcessing/updateBuildings' Collector scan below), the same
// way the Auto-Feeder already worked — top-landing isn't a valid entry
// point for either any more.
function handleLanding() {
  return 'resting'; // TILE_PLATFORM, a Collector, a Fan, the Auto-Feeder, or the implicit world-boundary wall
}

// Runs every tick an item is mid-collection instead of the normal
// fall/rise physics — eases it toward the Collector tile's stored center
// (COLLECTOR_PULL_STRENGTH, an exponential approach so an off-center landing
// visibly glides in rather than snapping) and counts up toward
// its own PROCESSOR_STATS-derived target before finally reporting 'consumed'. If the
// Collector tile itself gets torn down mid-process, this bails out and hands
// the item back to normal physics next tick, restoring its real mass, rather
// than leaving it frozen forever at a now-empty spot.
// Catalyst Fish's "linked building runs faster" mechanic — per direct spec,
// scans state.level.entities for a living catalyst_fish whose own
// linkedBuildingKey matches, returning 1 (no buff at all) if none is linked,
// or if the linked fish IS currently hungry (per spec, "when the fish isn't
// hungry" — HUNGER_SEEK_THRESHOLD is the same "actively seeking food" line
// every other hunger-gated mechanic in this game already uses). A non-hungry
// link gets CATALYST_BUFF_MULTIPLIER (1.5x), raised to
// CATALYST_BUFF_MULTIPLIER_MUTAGEN (1.75x) while that fish is under its own
// Mutagen Paste buff. Called fresh at every progress-advancing site
// (Collector/Refinery/Manufacturer/Power Plant/Turret) rather than
// precomputed once per tick — entity/building counts are small enough in
// this game that an O(entities) scan per call is negligible.
export function getCatalystSpeedMultiplier(state, buildingKey) {
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish' || entity.speciesId !== 'catalyst_fish') continue;
    if (entity.linkedBuildingKey !== buildingKey) continue;
    if (entity.hunger >= HUNGER_SEEK_THRESHOLD) return 1;
    return entity.mutagenBuffActive ? CATALYST_BUFF_MULTIPLIER_MUTAGEN : CATALYST_BUFF_MULTIPLIER;
  }
  return 1;
}

// Applies globally to EVERY turret tier at once, per direct request
// ("increase all turrets firerate by 20%... increase it by another 20%") —
// stacks multiplicatively, one +20% per Lab node actually purchased (up to
// 1.2*1.2 = 1.44x with both). See Config.js's turret_fire_rate_1/_2 and
// TURRET_STATS' own base shotsPerSec, cut to compensate.
function getTurretFireRateMultiplier(state) {
  let multiplier = 1;
  if (state.meta.labUpgradesPurchased.includes('turret_fire_rate_1')) multiplier *= TURRET_FIRE_RATE_UPGRADE_MULTIPLIER;
  if (state.meta.labUpgradesPurchased.includes('turret_fire_rate_2')) multiplier *= TURRET_FIRE_RATE_UPGRADE_MULTIPLIER;
  return multiplier;
}

function stepCollectorProcessing(item, state, dt) {
  const grid = state.level.grid;
  const tileType = tileAt(grid, item.collectorCenterX, item.collectorCenterY);
  if (!COLLECTOR_TILES.has(tileType)) {
    item.mass = item.collectorOriginalMass;
    item.collectorProgressMs = null;
    return 'falling';
  }
  const powerCost = getCollectorPowerCostForItem(PROCESSOR_STATS[tileType], item.type);
  // Per direct request ("if a building accepts an object for processing and
  // then runs out of power, keep the object in the building — the only way
  // to get that object out is for the building to be moved") — no ejection
  // here at all any more, sustained shortage or not. appliedEfficiency
  // below already drops to 0 (zero progress this tick) once powerEfficiency
  // falls under POWER_SHORTAGE_STALLED_THRESHOLD, which is what actually
  // stalls a held item's processing; intake (hasEnoughPowerToOperate, at
  // this Collector's OWN scan in updateBuildings below) is the only place
  // power still gates anything, so an item is never accepted in the first
  // place without at least 50% grid power.
  item.x += (item.collectorCenterX - item.x) * COLLECTOR_PULL_STRENGTH * dt;
  item.y += (item.collectorCenterY - item.y) * COLLECTOR_PULL_STRENGTH * dt;
  // A free base Collector (both power rates 0) always finishes at full
  // speed; an Advanced/Bio tier's progress runs slower between the stalled
  // threshold and 100% efficiency (the ejection check above only fires
  // below it) — matches "buildings using electricity should stop working"
  // once supply can't cover demand at all, while still allowing a genuine
  // partial shortfall to just slow things down rather than halt them.
  const appliedEfficiency = powerCost > 0 ? state.level.powerEfficiency : 1;
  // A linked, non-hungry Catalyst Fish speeds this exact tile up — see
  // getCatalystSpeedMultiplier's own comment. The key is derived from the
  // item's own stored collector center, since this runs per-ITEM (called
  // from stepItemOnGrid), not from updateBuildings' own per-tile loop.
  const buildingKey = `${Math.floor(item.collectorCenterY / TILE_SIZE)},${Math.floor(item.collectorCenterX / TILE_SIZE)}`;
  const catalystMultiplier = getCatalystSpeedMultiplier(state, buildingKey);
  item.collectorProgressMs += dt * 1000 * appliedEfficiency * catalystMultiplier;
  // Target duration is resolved once, at the moment processing started (see
  // beginCollectorProcessing) — coin vs Science Bubble, and which tier of
  // Processor tile, per PROCESSOR_STATS.
  if (item.collectorProgressMs >= item.collectorTargetMs) {
    item.mass = item.collectorOriginalMass;
    return 'consumed';
  }
  return 'processing';
}

// Generic "held by a Refinery/Manufacturer, being pulled to its center and
// disintegrated" step, per direct request — mirrors stepCollectorProcessing's
// own pull-to-center physics, but deliberately carries NO completion timer of
// its own: unlike a Collector-held item (which tracks collectorProgressMs
// directly on the ITEM, since a Collector needs nothing else), a
// Refinery/Manufacturer already tracks its own progress on the BUILDING
// (data.progressMs, keyed by whatever recipe/ingredient is locked in) — this
// function's only job is to keep the item physically at the tile's center and
// visible (so renderDisintegrateEffect has something to erode) for exactly as
// long as updateBuildings' own Refinery/Manufacturer branch still claims it
// (data.heldItemId === item.id). The actual splice-out-of-state.level.items
// happens there too, the instant that branch's own progress timer completes —
// this function never removes the item itself, only reports 'processing'
// until it's gone. If the tile is torn down (or somehow stops claiming this
// exact item) mid-hold, releases it back to normal physics with its real mass
// restored, same defensive shape stepCollectorProcessing already has.
function stepHeldItem(item, state, dt) {
  const grid = state.level.grid;
  const tileType = tileAt(grid, item.heldCenterX, item.heldCenterY);
  const data = state.level.buildingData[item.heldByKey];
  if (!data || !HOLDABLE_ITEM_TILES.has(tileType) || data.heldItemId !== item.id) {
    item.mass = item.heldOriginalMass;
    item.heldByKey = null;
    return 'falling';
  }
  item.x += (item.heldCenterX - item.x) * COLLECTOR_PULL_STRENGTH * dt;
  item.y += (item.heldCenterY - item.y) * COLLECTOR_PULL_STRENGTH * dt;
  return 'processing';
}

// Single entry point main.js's item render loop calls to find out "is this
// item currently mid-process, and how far along" — per direct request ("have
// the object disintegrate while it's being processed... with the amount
// processed matching the amount disintegrated"), returns a 0-1 fraction (0 =
// untouched, 1 = fully processed) or null if the item isn't being held by
// anything at all. Unifies both hold mechanisms this file has: a Collector
// tracks its own progress directly on the item (collectorProgressMs/
// collectorTargetMs, see stepCollectorProcessing), while a Refinery/
// Manufacturer tracks it on the BUILDING instead (data.progressMs against
// whichever recipe/ingredient duration currently applies) — this function is
// what looks up the right one so the render side doesn't need to know which
// building type is involved.
export function getItemDisintegrateFraction(state, item) {
  if (item.collectorProgressMs != null && item.collectorTargetMs > 0) {
    return Math.max(0, Math.min(1, item.collectorProgressMs / item.collectorTargetMs));
  }
  if (item.heldByKey == null) return null;
  const data = state.level.buildingData[item.heldByKey];
  if (!data) return null;
  if (REFINERY_TILES.has(data.type)) {
    const stats = REFINERY_STATS[data.type];
    const isDna = data.lockedRecipe === 'dna_to_biomass';
    const targetMs = isDna ? stats.foodProcessMs * ALIEN_DNA_REFINERY_TIME_MULTIPLIER : stats.foodProcessMs;
    return targetMs > 0 ? Math.max(0, Math.min(1, data.progressMs / targetMs)) : 0;
  }
  if (MANUFACTURER_TILES.has(data.type)) {
    const targetMs = MANUFACTURER_ITEM_PROCESS_MS[data.currentItemType];
    return targetMs > 0 ? Math.max(0, Math.min(1, data.progressMs / targetMs)) : 0;
  }
  return null;
}

// A stable (non-flickering) per-item "erosion" dot pattern, cached by item
// id — per direct request ("deleting random pixels while it's being
// processed"), a real per-pixel canvas manipulation (putImageData every
// frame, for every held item) would be needlessly expensive for a purely
// decorative effect; this fakes the same read at a fraction of the cost, the
// same "cheap fake over a genuinely expensive per-pixel op" precedent
// Ambience.js's seaweed blur already established. Generated ONCE per item
// (cached, not regenerated every frame) so which speckles are still visible
// at a given fraction stays exactly the same from frame to frame — only the
// COUNT shown shrinks as `fraction` climbs, in the same fixed left-to-right
// array order every time, which is what keeps the dissolve looking like
// genuine erosion instead of random flicker.
const disintegrateDotCache = new Map(); // itemId -> [{dx, dy, size}, ...]
const DISINTEGRATE_DOT_COUNT = 46;
const DISINTEGRATE_CACHE_MAX_ENTRIES = 500; // safety valve against unbounded growth over a very long session — evicts the oldest entry (Map iterates in insertion order) once exceeded, cheap enough to check every miss
function getDisintegrateDots(itemId, radius) {
  let dots = disintegrateDotCache.get(itemId);
  if (dots) return dots;
  if (disintegrateDotCache.size >= DISINTEGRATE_CACHE_MAX_ENTRIES) {
    disintegrateDotCache.delete(disintegrateDotCache.keys().next().value);
  }
  dots = [];
  for (let i = 0; i < DISINTEGRATE_DOT_COUNT; i++) {
    // Uniform-in-circle sampling (sqrt of a uniform radius fraction), not a
    // naive uniform (dx, dy) box-reject — otherwise dots would visibly
    // cluster toward the center instead of spreading evenly across the disc.
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius * 0.92;
    dots.push({ dx: Math.cos(angle) * r, dy: Math.sin(angle) * r, size: 1.2 + Math.random() * 1.6 });
  }
  disintegrateDotCache.set(itemId, dots);
  return dots;
}
// Called from main.js's item render loop in place of an item's own normal
// shape while it's mid-process. Cache entries for items that no longer exist
// pile up slowly (one per item ever processed, a handful of numbers each) —
// not worth actively pruning given this game's real item churn.
export function renderDisintegrateEffect(ctx, x, y, radius, color, fraction, itemId) {
  const dots = getDisintegrateDots(itemId, radius);
  const visibleCount = Math.round(dots.length * (1 - fraction));
  ctx.fillStyle = color;
  for (let i = 0; i < visibleCount; i++) {
    const d = dots[i];
    ctx.beginPath();
    ctx.arc(x + d.dx, y + d.dy, d.size, 0, Math.PI * 2);
    ctx.fill();
  }
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
//   'processing' — being drawn into a Collector/Refinery/Manufacturer's
//                  center, not yet consumed — caller leaves it alone
//   'consumed'   — a Collector finished processing it; caller removes it from the array
// There is no 'lost' status any more — per direct request, every item is
// caught by a hard boundary (sweepVertical's own stop at WORLD_H, plus the
// side/top walls every item now respects — see clampItemToWorldWalls in
// Entities.js) rather than ever being deleted for falling somewhere
// unreachable.
export function stepItemOnGrid(item, state, dt, physics) {
  if (item.collectorProgressMs != null) return stepCollectorProcessing(item, state, dt);
  // A Refinery/Manufacturer-held item never reports 'consumed' from here —
  // updateBuildings' own Refinery/Manufacturer branch is what actually
  // splices it out of state.level.items, the instant ITS OWN progress timer
  // (tracked on the building, not the item) completes. See stepHeldItem's
  // own comment for why the two mechanisms differ.
  if (item.heldByKey != null) return stepHeldItem(item, state, dt);

  const fanForce = computeFanForce(state, item);
  integrateItemForces(item, dt, physics, fanForce);

  // Horizontal: swept in GRID_SWEEP_SUBSTEP-sized sub-steps (sweepHorizontal)
  // against solid tiles, so a fast push can't tunnel sideways through one in
  // a single big step. A Half Platform ramp is deliberately never "solid"
  // for the flat check — it can always be moved into freely, the same as
  // open air — its own wedge is instead resolved uniformly for every
  // direction of approach by resolveRampCollision, called after every
  // substep (see that function's own comment for the two real bugs this
  // fixed — an item permanently stuck dead against a ramp no matter how much
  // Fan force kept pushing it, and being able to pass straight through a
  // ramp's own tall wall/floor edges).
  sweepHorizontal(item, state, item.vx * dt);

  // Vertical: swept tile landing (also resolves any Half Platform ramp
  // contact along the way, once per substep — see sweepVertical/
  // resolveRampCollision).
  const result = sweepVertical(item, state, item.vy * dt);
  if (result.landed) {
    return handleLanding();
  }

  return 'falling';
}

// A proper circle-vs-tile-square touch test, used by every building's own
// intake scan (Collector, Refinery, Manufacturer, Power Plant, Waste
// Turret) — per direct report, an earlier fixed radius-from-center check
// left the tile's own corners AND top edge under-covered: an item resting
// near a corner sits roughly TILE_SIZE*0.5*sqrt(2) (~22.6px) from center,
// farther than a same-sized intake radius reaches even though the item is
// visibly touching the tile, and the same gap shows up for an item resting
// flush on top (see CLAUDE.md's "buildings don't accept items from the
// top" fix). This instead measures the distance from the item's center to
// the CLOSEST point on the tile's own square footprint, so anything
// genuinely touching the tile from any side — including a corner or
// straight down from directly above — registers, regardless of where
// exactly it landed. Also replaced the old approach-angle "intake side"
// check entirely (a dot-product test against the building's aim
// direction) — per an earlier direct request ("let's remove the arrows and
// the need for a specific input side... will suck any appropriate item
// touching it"), simple touch-proximity is all that's checked now.
// Real bug, found and fixed after a direct report ("Powerplants... won't
// accept food"): an item resting flush against a tile's surface — by FAR
// the single most common way anything ever touches a building, since
// that's exactly what "landed on it" physics produces — settles at a
// position that is mathematically EXACTLY `half + itemRadius` away from
// center, and floating-point rounding on that subtraction/hypot chain can
// land a few ULPs on the wrong side of that exact boundary (confirmed
// directly: a real settled Food item measured 6.600000000000023 against a
// 6.6 radius, failing a strict `<=` by 2.3e-14). Once an item is at rest —
// not moving, nothing left to nudge it back onto the "touching" side — that
// failure is PERMANENT, not a one-tick fluke, so the intake silently never
// fires again. TOUCH_EPSILON_PX is a small, deliberately generous tolerance
// that absorbs both this exact float error and any similar near-miss.
const TOUCH_EPSILON_PX = 0.5;
function isTouchingBuildingTile(centerX, centerY, itemX, itemY, itemRadius) {
  const half = TILE_SIZE / 2;
  const dx = Math.max(Math.abs(itemX - centerX) - half, 0);
  const dy = Math.max(Math.abs(itemY - centerY) - half, 0);
  return Math.hypot(dx, dy) <= itemRadius + TOUCH_EPSILON_PX;
}

// A Collector's power draw depends on WHAT it's currently holding, not just
// which tier it is — per direct request ("the advanced and bio collector
// take half as much energy when collecting coins"), Blue and Green Science
// both draw the tile's own full `powerCostPerSecScience` rate, a coin draws
// the (on the power-costing tiers, exactly half) `powerCostPerSecCoin` rate.
// Shared by stepCollectorProcessing (the efficiency-gate check),
// computeCurrentPowerDemand, and getBuildingCurrentPowerDraw so the three
// can never disagree about which rate applies.
function getCollectorPowerCostForItem(stats, itemType) {
  return (itemType === 'science' || itemType === 'science_green') ? stats.powerCostPerSecScience : stats.powerCostPerSecCoin;
}

// Shared by the Collector/Refinery/Manufacturer branches below — per direct
// request ("Manufacturers and collectors should spit out objects if they
// don't have enough energy to run"), extended to the Refinery too since it
// holds an item mid-cycle via the exact same mechanism and would otherwise
// be left stuck stalling forever in the identical situation. True whenever
// a building that costs `powerCostPerSec` mw genuinely has enough live grid
// power to keep operating right now — reuses the same
// POWER_SHORTAGE_STALLED_THRESHOLD the power-shortage visual overlay
// (further down this file) already treats as "genuinely stopped, not just
// running slower," so the two can't disagree about what counts as "enough."
function hasEnoughPowerToOperate(state, powerCostPerSec) {
  return powerCostPerSec <= 0 || state.level.powerEfficiency >= POWER_SHORTAGE_STALLED_THRESHOLD;
}

// Per direct request ("make sure the no power visual indicator is on the
// building so the player knows why the building isn't accepting the
// object") — getBuildingCurrentPowerDraw only reports power a building is
// drawing THIS tick, which is 0 for a Collector/Refinery/Manufacturer
// sitting idle specifically BECAUSE the intake gates above
// (hasEnoughPowerToOperate) are refusing to start a new hold — exactly the
// situation a player most needs the shortage overlay to explain, and the
// one case the old `currentDraw > 0` render gate silently missed. This
// checks "would this tile type ever draw power at all," not "is it
// drawing right now," so the render call below can also light the overlay
// up on a building that's idle only because it's blocked from accepting.
function tileHasAnyPowerCost(type) {
  if (COLLECTOR_TILES.has(type)) {
    const stats = PROCESSOR_STATS[type];
    return stats.powerCostPerSecCoin > 0 || stats.powerCostPerSecScience > 0;
  }
  if (REFINERY_TILES.has(type)) return REFINERY_STATS[type].powerCostPerSec > 0;
  if (MANUFACTURER_TILES.has(type)) return true; // every ingredient type costs power, see MANUFACTURER_ITEM_POWER_COST_MW
  return false;
}

// Starts the same pull-to-center hold stepCollectorProcessing eases through
// every tick — previously only ever kicked off by a top-landing event
// (handleLanding); now triggered by updateBuildings' intake scan below
// instead, since a Collector no longer accepts a plain top-landing as a
// valid entry at all.
function beginCollectorProcessing(item, centerX, centerY, tileType) {
  item.collectorCenterX = centerX;
  item.collectorCenterY = centerY;
  item.collectorProgressMs = 0;
  // A coin, a Blue Science Bubble, and a Green Science Bubble all take
  // different amounts of time on the same tile, and each shrinks
  // independently per tier — see Config.js's PROCESSOR_STATS. Green Science
  // used to just share Blue's own scienceMs; per direct request it now has
  // its own explicit, separately-tuned scienceGreenMs.
  const stats = PROCESSOR_STATS[tileType];
  item.collectorTargetMs = item.type === 'science_green' ? stats.scienceGreenMs
    : item.type === 'science' ? stats.scienceMs
    : stats.coinMs;
  item.collectorOriginalMass = item.mass;
  item.mass = COLLECTOR_PROCESSING_MASS; // barely budges if something else piles into it mid-process — see Config.js's comment
}

// ---- Collector + Auto-Feeder intake scans ----
// Ticked once per frame from Entities.js's updateEntities (alongside
// resolveItemCollisions) — both are scan-driven rather than landing-event-
// driven, since each needs to actively pull in whatever's nearby on its
// intake side rather than wait for something to fall onto its top. The
// Collector directly mutates matched items in place (beginCollectorProcessing
// above; stepItemOnGrid picks the hold up on that item's own next per-tick
// step, same as it always has). The Auto-Feeder directly removes absorbed
// Waste from state.level.items (an exception to the usual "Grid.js returns a
// status, Entities.js mutates the array" split — justified the same way
// resolveItemCollisions already directly mutates item positions/velocities
// in place). Newly-dispensed Food is NOT created here, to avoid a circular
// import with Entities.js's createFood — instead this returns an array of
// spawn points `{ x, y }` for the caller to actually construct.
// Returns { foodSpawnPoints, wasteSpawnPoints, turretShots, bioSpawnPoints }
// — Entities.js constructs the actual Food/Waste/Bio-chain items and turret
// projectiles from these (circular-import avoidance, same reasoning as
// before — createTurretProjectile/createBiomass/etc. live in Entities.js
// alongside createFood/createWaste), banking coins/Science itself when
// stepCollectorProcessing (called from each item's own per-tick step)
// reports 'consumed'. bioSpawnPoints entries carry an itemType alongside
// { x, y } since the Refinery/Bio-Combuster can each eject more than one
// kind of output depending on which recipe locked in.
export function updateBuildings(state, dtMs) {
  const foodSpawnPoints = [];
  const wasteSpawnPoints = [];
  const turretShots = [];
  const bioSpawnPoints = [];
  const chestSpawnPoints = [];
  const items = state.level.items;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const [row, col] = key.split(',').map(Number);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;

    // Rolling 3-minute uptime tracking, per direct request ("efficiency
    // based on a rolling 3 minutes... for players optimizing layouts") —
    // read from the tile's OWN state as it stood at the top of this tick
    // (before any of the branches below mutate it), which lags the exact
    // instant something starts/stops by at most one tick — negligible
    // against a 5-second sample granularity. Skipped for Platform (no
    // meaningful "uptime" concept) and anything without a real
    // active/idle distinction.
    if (
      COLLECTOR_TILES.has(data.type) || REFINERY_TILES.has(data.type) ||
      MANUFACTURER_TILES.has(data.type) || POWER_PLANT_TILES.has(data.type) ||
      TURRET_TILES.has(data.type) || FAN_TILES.has(data.type)
    ) {
      updateBuildingUptimeTracking(state, data.type, data, centerX, centerY, dtMs);
    }

    if (COLLECTOR_TILES.has(data.type)) {
      // Only one item processes at a time per Collector tile — skip the scan
      // entirely if this tile already has one mid-hold, so a second item
      // drifting into range while the first is still easing toward center
      // doesn't also get pulled onto the same spot. Coins and both Science
      // colors are valid intake — per direct request, a Collector's stats
      // are specifically "1 coin every Xs, 1 science every Ys," not a
      // generic item eater; Food/Waste/Bio-chain items landing on top just
      // rest there. Green Science shares blue's own scienceMs duration (see
      // beginCollectorProcessing below) — per spec, it's routed into a
      // Collector the exact same way blue Science already is.
      let anyProcessing = items.some(
        (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
      );
      if (!anyProcessing) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.type !== 'coin' && it.type !== 'science' && it.type !== 'science_green') continue;
          if (it.collectorProgressMs != null) continue;
          // A real circle-vs-tile-square touch test, not a fixed radius from
          // center — per direct request ("make sure the Collector will
          // actually pull in any coin touching it on any side, correctly").
          // The old COLLECTOR_INTAKE_RADIUS (TILE_SIZE*0.65 ≈ 20.8px) sat
          // short of the tile's own corner distance (TILE_SIZE*0.5*sqrt(2)
          // ≈ 22.6px), so a coin resting near a corner or the top edge could
          // be visibly touching the tile without ever registering as "near
          // enough" — the exact same bug class already fixed for the Waste
          // Turret's own intake via this same helper.
          if (isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) {
            // Doesn't even start a new hold while genuinely out of power —
            // otherwise stepCollectorProcessing's own ejection above would
            // spit it right back out next tick, and this same scan would
            // just re-grab it again the tick after that, flickering forever.
            if (!hasEnoughPowerToOperate(state, getCollectorPowerCostForItem(PROCESSOR_STATS[data.type], it.type))) continue;
            beginCollectorProcessing(it, centerX, centerY, data.type);
            anyProcessing = true;
            playIntake();
            break;
          }
        }
      }
      // The Collector no longer produces any Waste byproduct at all, on any
      // tier — per direct request, it's now a pure banking convenience with
      // no dirty-automation downside (the old wasteAccumMs background clock
      // is removed entirely, not just zeroed).
      continue;
    }

    if (TURRET_TILES.has(data.type)) {
      // Refill — sucks in any Waste OR Biomass item touching it, same
      // radius-from-center intake pattern the Collector/Auto-Feeder just
      // got. Applies to any tile in TURRET_AMMO_TILES (the Waste Turret AND
      // the Electric Waste Turret, per direct request — it "takes waste as
      // ammo just like the waste turret"); the Advanced tier never reads
      // ammo at all — unlimited ammo, a power cost instead. Waste and
      // Biomass are tracked as two separate counters (ammoWaste/ammoBiomass)
      // since Biomass is strictly better ammo — 50% more damage per shot and
      // 15 shots per unit instead of Waste's 10 (BIOMASS_TURRET_SHOTS_PER_AMMO/
      // BIOMASS_TURRET_DAMAGE_MULTIPLIER) — so the two can't just merge into
      // one flat shot count. Both pools share the one combined-shots cap
      // (WASTE_TURRET_MAX_AMMO) so stockpiling both isn't free.
      const totalAmmo = data.ammoWaste + data.ammoBiomass;
      if (TURRET_AMMO_TILES.has(data.type) && totalAmmo < WASTE_TURRET_MAX_AMMO) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.type !== 'waste' && it.type !== 'biomass') continue;
          // A real touch test, not a fixed radius-from-center — see
          // isTouchingBuildingTile's own comment for why: a waste item
          // resting near a corner (including the top edge, which used to
          // sit just outside the old fixed-radius check) still counts.
          if (isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) {
            items.splice(i, 1);
            if (it.type === 'biomass') {
              data.ammoBiomass = Math.min(WASTE_TURRET_MAX_AMMO - data.ammoWaste, data.ammoBiomass + BIOMASS_TURRET_SHOTS_PER_AMMO);
            } else {
              data.ammoWaste = Math.min(WASTE_TURRET_MAX_AMMO - data.ammoBiomass, data.ammoWaste + WASTE_TURRET_SHOTS_PER_WASTE);
            }
            playIntake();
            // Cross-module flag (UI.js reads/clears it next frame — see
            // main.js's state.ui.wasteTurretAmmoGainedPending for why this
            // isn't just a direct call) — advances the "drag Waste into the
            // Turret" guided-tutorial step, regardless of whether this
            // particular ammo got here by an active drag or just drifted in
            // naturally.
            state.ui.wasteTurretAmmoGainedPending = true;
            break;
          }
        }
      }

      // Fire — cooldown-gated, auto-targets the NEAREST living alien
      // anywhere in the level (no player-chosen aim, and — per direct
      // request — no range cutoff at all any more; see TURRET_STATS' own
      // comment for why). Aliens live in state.level.entities, same array
      // fish do; Grid.js reading their positions for a plain nearest-search
      // is the same kind of thing this function already does reading
      // state.level.items for an intake scan, not "fish logic" in the sense
      // CLAUDE.md's module boundary forbids. Unlike the old hitscan version,
      // this does NOT touch alien.hp directly any more — it only records
      // that a shot fired (pushed into turretShots, returned below) for
      // Entities.js to spawn a real homing projectile from; damage lands
      // only once that projectile actually connects. data.firing (read by
      // computeCurrentPowerDemand above) is still recomputed fresh every
      // tick, true only on a tick a shot actually fires.
      const turretStats = TURRET_STATS[data.type];
      // Per direct request ("make it so electric and advanced turrets can't
      // shoot unless there's enough electricity being generated or stored.
      // No efficiency reduction for turrets, they just don't work unless
      // there's enough electricity") — the cooldown always ticks down at
      // full speed now, completely unaffected by grid efficiency (unlike
      // Fan force/Collector/Refinery/Manufacturer progress, which genuinely
      // slow down); firing itself is a hard binary gate instead, requiring
      // FULL power availability (powerEfficiency === 1, i.e. the grid — Eels
      // plus whatever a Blimp-Battery is covering — meets 100% of
      // total demand this second) rather than just "> 0." A free tier
      // (Waste Turret) never checks this at all. A linked, non-hungry
      // Catalyst Fish still speeds the cooldown up regardless — that's a
      // genuine bonus, not tied to grid power at all, so it doesn't
      // contradict "no efficiency reduction" above.
      data.cooldownMs = Math.max(0, data.cooldownMs - dtMs * getCatalystSpeedMultiplier(state, key));
      const hasAmmo = !TURRET_AMMO_TILES.has(data.type) || data.ammoWaste + data.ammoBiomass > 0;
      const hasPower = turretStats.powerCostPerSec <= 0 || state.level.powerEfficiency >= 1;
      // Found every tick regardless of the firing gate below (cooldown/ammo/
      // power) — per direct request, the turret's own drawn arm pivots to
      // track its live target continuously, not just at the instant it
      // fires, so this can't be scoped inside the `if` the way it used to be
      // when only the shot itself needed it. data.aimAngle (read by
      // renderTurretIcon) is only ever updated when a real target exists —
      // with none, the arm just holds whatever direction it last pointed.
      let nearestAlien = null;
      let nearestDist = Infinity;
      for (const entity of state.level.entities) {
        // spawnProtectionUntilMs: a freshly Alien-Egg-hatched alien is
        // invulnerable for its first ALIEN_EGG_HATCH_INVULN_MS (see
        // Entities.js's updateAlienEgg/createAlien) — turrets don't waste
        // shots targeting something they can't hurt.
        if (entity.type !== 'alien' || entity.hp <= 0) continue;
        if (entity.spawnProtectionUntilMs > state.level.elapsed) continue;
        // Per direct request — a target already covered by damage from
        // shots OTHER turrets (or this same one, an earlier cycle) already
        // have in flight isn't a valid target any more, so every turret
        // that would otherwise also pile onto it instead looks past it to
        // whatever real target remains (or fires at nothing this tick, if
        // there isn't one) — see createAlien's own comment on
        // reservedDamage and updateTurretProjectiles' release of it once a
        // shot actually lands or fizzles.
        if (entity.hp - (entity.reservedDamage || 0) <= 0) continue;
        const d = Math.hypot(entity.x - centerX, entity.y - centerY);
        if (d <= nearestDist) {
          nearestAlien = entity;
          nearestDist = d;
        }
      }
      if (nearestAlien) data.aimAngle = Math.atan2(nearestAlien.y - centerY, nearestAlien.x - centerX);
      if (data.cooldownMs <= 0 && hasAmmo && hasPower) {
        if (nearestAlien) {
          // Spends from the Biomass pool first whenever it's non-empty (see
          // BIOMASS_TURRET_DAMAGE_MULTIPLIER's own comment) — the better
          // ammo you just loaded takes effect immediately rather than
          // sitting saved behind whatever Waste is already loaded.
          const usingBiomass = TURRET_AMMO_TILES.has(data.type) && data.ammoBiomass > 0;
          const shotDamage = usingBiomass ? turretStats.damage * BIOMASS_TURRET_DAMAGE_MULTIPLIER : turretStats.damage;
          turretShots.push({ x: centerX, y: centerY, targetId: nearestAlien.id, damage: shotDamage });
          nearestAlien.reservedDamage = (nearestAlien.reservedDamage || 0) + shotDamage;
          data.cooldownMs = 1000 / (turretStats.shotsPerSec * getTurretFireRateMultiplier(state));
          if (TURRET_AMMO_TILES.has(data.type)) {
            if (usingBiomass) data.ammoBiomass -= 1;
            else data.ammoWaste -= 1;
          }
          playTurretShoot();
          // A turret's own power draw is a single-tick pulse (one shot),
          // not a sustained state a once-a-second snapshot can reliably
          // catch — see state.level.turretPowerDemandAccumMw's own comment
          // in Levels.js for why this accumulates the real energy of every
          // shot instead. Waste Turret has powerCostPerShot 0, so this is a
          // no-op for it, same as it always was demand-free.
          if (turretStats.powerCostPerShot > 0) state.level.turretPowerDemandAccumMw += turretStats.powerCostPerShot;
        }
      }
      continue;
    }

    // Refinery/Manufacturer both eject items straight up from their own
    // center, same fixed point the old Auto-Feeder always used — EXCEPT the
    // anchor row is the TOPMOST building in this tile's own vertical stack
    // (topOfBuildingStackRow), not necessarily this tile's own row, so a
    // stack of several buildings on top of each other ejects clear above
    // all of them instead of spawning the item inside/against whatever's
    // directly above the one actually processing it.
    const outputAnchorRow = topOfBuildingStackRow(state, col, row);
    const bioOutputX = centerX;
    const bioOutputY = outputAnchorRow * TILE_SIZE + TILE_SIZE / 2 - TILE_SIZE * BUILDING_OUTPUT_PORT_OFFSET_FRACTION;

    if (REFINERY_TILES.has(data.type)) {
      const stats = REFINERY_STATS[data.type];
      // Doesn't even start a new hold while genuinely out of power — same
      // reasoning as the Collector's own intake gate above, so a
      // power-costing tier that can't run right now doesn't grab-then-
      // immediately-eject the same item every tick.
      if (data.lockedRecipe === null && !hasEnoughPowerToOperate(state, stats.powerCostPerSec)) {
        continue;
      }
      if (data.lockedRecipe === null) {
        // Rejects incoming items while actively processing (satisfied by
        // only ever scanning here, while idle) — and if both Bio-Sludge
        // (type `alien_dna`) and Waste touch on the exact same tick,
        // Bio-Sludge takes priority, per spec. Scanned as two separate
        // single-pass searches (not one mixed loop) specifically so it can
        // always be checked and claimed first regardless of array order.
        // Per direct request ("have the object disintegrate while it's
        // being processed... pull items into the center of them"), the
        // matched item is HELD (pulled to center, visually disintegrating —
        // see stepHeldItem/renderDisintegrateEffect) rather than spliced out
        // immediately; the actual removal happens below, once this recipe's
        // own progress timer completes.
        let dnaIdx = -1;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type === 'alien_dna' && isTouchingBuildingTile(centerX, centerY, items[i].x, items[i].y, items[i].radius)) { dnaIdx = i; break; }
        }
        if (dnaIdx !== -1) {
          const it = items[dnaIdx];
          it.heldByKey = key;
          it.heldCenterX = centerX;
          it.heldCenterY = centerY;
          it.heldOriginalMass = it.mass;
          it.mass = COLLECTOR_PROCESSING_MASS;
          data.heldItemId = it.id;
          data.lockedRecipe = 'dna_to_biomass';
          data.progressMs = 0;
          playIntake();
        } else {
          let wasteIdx = -1;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'waste' && isTouchingBuildingTile(centerX, centerY, items[i].x, items[i].y, items[i].radius)) { wasteIdx = i; break; }
          }
          if (wasteIdx !== -1) {
            const it = items[wasteIdx];
            it.heldByKey = key;
            it.heldCenterX = centerX;
            it.heldCenterY = centerY;
            it.heldOriginalMass = it.mass;
            it.mass = COLLECTOR_PROCESSING_MASS;
            data.heldItemId = it.id;
            // "Buildings" pushing cleanliness back up (see CLAUDE.md's
            // Cleanliness section) — the Refinery inherits this from the
            // Auto-Feeder it replaced, mirroring Entities.js's identical
            // Suckerfish-eating case. Credited on PICKUP, same as before —
            // holding the item a while longer before actually removing it
            // doesn't change when the tank gets credit for it.
            state.level.cleanliness = Math.min(CLEANLINESS_MAX, state.level.cleanliness + CLEANLINESS_PER_WASTE_EVENT);
            data.lockedRecipe = 'waste_to_food';
            data.progressMs = 0;
            playIntake();
          }
        }
      } else {
        // Per direct request ("if a building accepts an object for
        // processing and then runs out of power, keep the object in the
        // building — the only way to get that object out is for the
        // building to be moved") — no mid-cycle ejection any more. Running
        // out of power mid-hold just stalls progress at 0 (efficiency below
        // drops to 0 once powerEfficiency falls under
        // POWER_SHORTAGE_STALLED_THRESHOLD) rather than releasing the held
        // item back to physics; intake (hasEnoughPowerToOperate, just above)
        // is still the only place power gates anything, so a hold is never
        // even started without at least 50% grid power in the first place.
        const efficiency = stats.powerCostPerSec > 0 ? state.level.powerEfficiency : 1;
        data.progressMs += dtMs * efficiency * getCatalystSpeedMultiplier(state, key);
        // Bio-Sludge -> Biomass takes ALIEN_DNA_REFINERY_TIME_MULTIPLIER
        // times as long as the same tile's own Waste -> Food recipe, per
        // direct spec ("50% longer for alien DNA").
        const isDna = data.lockedRecipe === 'dna_to_biomass';
        const targetMs = isDna ? stats.foodProcessMs * ALIEN_DNA_REFINERY_TIME_MULTIPLIER : stats.foodProcessMs;
        if (data.progressMs >= targetMs) {
          // The held item (if it's still actually there — see stepHeldItem's
          // own defensive release check) finally gets removed right here,
          // the same instant the real output is ejected.
          const heldIdx = items.findIndex((it) => it.id === data.heldItemId);
          if (heldIdx !== -1) items.splice(heldIdx, 1);
          data.heldItemId = null;
          bioSpawnPoints.push({ x: bioOutputX, y: bioOutputY, itemType: isDna ? 'biomass' : 'food' });
          playDispense();
          data.lockedRecipe = null;
          data.progressMs = 0;
        }
      }
      continue;
    }

    if (MANUFACTURER_TILES.has(data.type)) {
      // Does nothing at all (and draws no power) until a recipe is picked
      // via UI.js's recipe pop-up menu — per direct spec.
      if (data.recipeId === null) continue;
      const recipe = MANUFACTURER_RECIPES[data.recipeId];
      if (!data.processing) {
        // Only ONE item may be absorbed/mid-process at a time — scans for
        // any item whose type is still in this cycle's own pendingInputs
        // list (whichever of the recipe's 2 ingredients haven't been
        // absorbed yet), touching the tile. Order doesn't matter — whichever
        // eligible type touches first gets absorbed first.
        // Ghost-icon flash timer — ticks only while genuinely idle waiting on
        // the recipe's SECOND ingredient (the first already fully absorbed
        // and processed, pendingInputs down to just the other one), reset to
        // 0 the instant that's no longer true — see
        // renderManufacturerGhostFlash below for what actually reads this,
        // per direct request ("the other item for the recipe flashes
        // briefly as a ghost icon... to indicate which item is still
        // needed").
        data.ghostFlashTimerMs = data.pendingInputs.length === 1 ? data.ghostFlashTimerMs + dtMs : 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const pendingIdx = data.pendingInputs.indexOf(it.type);
          if (pendingIdx === -1) continue;
          if (isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) {
            // Doesn't even start a new hold while genuinely out of power —
            // same reasoning as the Collector/Refinery's own intake gates
            // above, so it doesn't grab-then-immediately-eject every tick.
            if (!hasEnoughPowerToOperate(state, MANUFACTURER_ITEM_POWER_COST_MW[it.type] || 0)) continue;
            // Held (pulled to center, disintegrating), not spliced yet — see
            // the identical treatment in the Refinery branch above.
            it.heldByKey = key;
            it.heldCenterX = centerX;
            it.heldCenterY = centerY;
            it.heldOriginalMass = it.mass;
            it.mass = COLLECTOR_PROCESSING_MASS;
            data.heldItemId = it.id;
            data.pendingInputs.splice(pendingIdx, 1);
            data.processing = true;
            data.currentItemType = it.type;
            data.progressMs = 0;
            data.ghostFlashTimerMs = 0; // the second ingredient just arrived — nothing left to remind the player about
            playIntake();
            break;
          }
        }
      } else {
        // Per direct request ("if a building accepts an object for
        // processing and then runs out of power, keep the object in the
        // building — the only way to get that object out is for the
        // building to be moved") — no mid-process ejection any more; running
        // out of power just stalls progress (efficiency 0 below) instead of
        // spitting the ingredient back out. Every ingredient type now costs
        // SOME power to process (10-35mw, see MANUFACTURER_ITEM_POWER_COST_MW)
        // — unlike before, there's no "unpowered" case left to special-case
        // here, so this always applies the grid's live efficiency while
        // actively processing.
        const efficiency = state.level.powerEfficiency;
        data.progressMs += dtMs * efficiency * getCatalystSpeedMultiplier(state, key);
        // Per direct spec: a flat duration by ITEM TYPE, not by recipe —
        // waste 2s, food 4s, biomass 8s at base.
        if (data.progressMs >= MANUFACTURER_ITEM_PROCESS_MS[data.currentItemType]) {
          // The held ingredient is only actually removed now, right as its
          // own hold time finishes — see the Refinery branch's identical
          // comment for why the removal happens here, not at absorption.
          const heldIdx = items.findIndex((it) => it.id === data.heldItemId);
          if (heldIdx !== -1) items.splice(heldIdx, 1);
          data.heldItemId = null;
          data.processing = false;
          data.currentItemType = null;
          data.progressMs = 0;
          if (data.pendingInputs.length === 0) {
            // Both ingredients processed — eject the recipe's output and
            // start a fresh cycle.
            bioSpawnPoints.push({ x: bioOutputX, y: bioOutputY, itemType: recipe.output });
            playDispense();
            data.pendingInputs = [...recipe.inputs];
          }
          // else: pendingInputs is down to 1 — the ghost-flash timer above
          // starts counting again next tick, now that this ingredient is
          // genuinely done (not just absorbed) and data.processing is false.
        }
      }
      continue;
    }

    if (POWER_PLANT_TILES.has(data.type)) {
      // Same "does nothing until a recipe is picked" rule as the
      // Manufacturer — no fuel scan, no power draw, until then.
      if (data.recipeId === null) continue;
      const recipe = POWER_PLANT_RECIPES[data.recipeId];
      if (!data.fueled) {
        // A single-fuel-item recipe now, not an "either/or" router — only
        // the recipe's own inputs[0] type is accepted.
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.type !== recipe.inputs[0]) continue;
          if (isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) {
            items.splice(i, 1);
            data.fueled = true;
            data.progressMs = 0;
            playIntake();
            break;
          }
        }
      } else {
        // Never power-gated itself — it's the thing GENERATING power, not
        // drawing it — but a linked, non-hungry Catalyst Fish still speeds
        // it up like any other building.
        const rate = getCatalystSpeedMultiplier(state, key);
        data.progressMs += dtMs * rate;
        // Per direct request ("powerplants should produce the EXACT same
        // thing as electric eels — the same resource/utility pool should be
        // used for both"): credits state.level.powerGenAccumMw
        // CONTINUOUSLY over the whole burn, at recipe.powerOutputMw's own
        // rate, instead of dumping the entire cycle's worth as one lump sum
        // only once progressMs finally crosses durationMs. A recipe's own
        // description ("Biomass -> 40mw for 20s") already reads as a
        // sustained 40mw output for 20 seconds, not a single 800 MW-second
        // pulse after 20 silent seconds — and since main.js's own
        // once-a-second power sampler reads + resets this same accumulator
        // every real second (see its own comment), the old lump-sum version
        // meant a Power Plant contributed ZERO measurable supply for
        // literally every second of its cycle except the one it happened to
        // finish in, reading to the player as "does nothing." This is the
        // exact same incremental-credit shape Entities.js's Electric Eel
        // branch already uses (`powerGenAccumMw += 1` per distance step) —
        // both sources now feed the identical shared accumulator the same
        // continuous way.
        state.level.powerGenAccumMw += recipe.powerOutputMw * (dtMs / 1000) * rate;
        if (data.progressMs >= recipe.durationMs) {
          data.fueled = false;
          data.progressMs = 0;
        }
      }
      continue;
    }

    // ---- Storage Chest: intake, auto-trickle, and "Clear Chest" ----
    // Per direct request. Three independent things happen here every tick:
    // (1) intake — instantly absorbs (no hold/disintegrate delay, it
    // "slurps") any touching item of its locked type, or locks onto
    // whichever type touches first if still empty/unlocked, up to capacity;
    // (2) auto-trickle — while armed (main.js's drag gesture sets
    // trickleActive/trickleAngle), ejects one stored item at a time on a
    // timer that speeds up the fuller the chest is; (3) "Clear Chest" — a
    // manual dump, staggered at a fixed interval rather than all at once,
    // aimed the same way the trickle would be if a direction's ever been
    // armed, otherwise scattered randomly at low force (see
    // clearChestContents below for how `clearing` gets armed).
    if (STORAGE_CHEST_TILES.has(data.type)) {
      const capacity = STORAGE_CHEST_CAPACITY[data.type];
      if (data.count < capacity) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.collectorProgressMs != null || it.heldByKey != null) continue; // already claimed by another building's own hold this tick
          if (data.lockedItemType !== null && it.type !== data.lockedItemType) continue;
          if (!isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) continue;
          if (data.lockedItemType === null) data.lockedItemType = it.type;
          if (it.type === 'coin') data.coinValueSum += it.value;
          items.splice(i, 1);
          data.count += 1;
          playIntake();
          // Cross-module flag — Grid.js can't call UI.js's advanceTutorialFlow
          // directly (same reasoning main.js's own state.ui.wasteTurretAmmoGainedPending
          // already documents), so this is polled and consumed by UI.js's
          // updateHUD instead. A no-op unless the 'chest' flow's own
          // 'feedwaste' step happens to be active right now.
          state.ui.chestItemAbsorbedPending = true;
          break; // one absorb per tick per chest — same "don't eat 3 at once" pacing every other intake scan in this file already follows
        }
      }
      // Auto-trickle — armed by main.js's armChestTrickle (the drag gesture),
      // stopped by stopChestTrickle. Interval interpolates between the MAX
      // (near-empty) and MIN (full) constants by fill fraction, recomputed
      // fresh each time an item actually ejects so it keeps pace as the
      // chest drains.
      if (data.trickleActive && data.count > 0) {
        data.trickleTimerMs = (data.trickleTimerMs || 0) - dtMs;
        if (data.trickleTimerMs <= 0) {
          const fillFraction = data.count / capacity;
          const intervalMs = STORAGE_CHEST_TRICKLE_INTERVAL_MAX_MS
            - fillFraction * (STORAGE_CHEST_TRICKLE_INTERVAL_MAX_MS - STORAGE_CHEST_TRICKLE_INTERVAL_MIN_MS);
          data.trickleTimerMs = intervalMs;
          chestSpawnPoints.push(ejectOneFromChest(data, centerX, centerY, 'aimed'));
        }
      }
      // "Clear Chest" — staggers every currently-held item out at a fixed
      // interval (STORAGE_CHEST_CLEAR_INTERVAL_MS) instead of dumping them
      // all on the same tick, per direct request ("space out the spitting
      // slightly so it happens over a second or two"). Runs independently of
      // (and can overlap with) the auto-trickle above — nothing stops both
      // draining the chest at once if a player triggers Clear mid-trickle.
      if (data.clearing && data.count > 0) {
        data.clearTimerMs -= dtMs;
        if (data.clearTimerMs <= 0) {
          data.clearTimerMs = STORAGE_CHEST_CLEAR_INTERVAL_MS;
          chestSpawnPoints.push(ejectOneFromChest(data, centerX, centerY, data.trickleAngle === null ? 'scatter' : 'aimed'));
        }
      }
      if (data.count <= 0) {
        data.clearing = false;
        data.lockedItemType = null; // fully empty — free to auto-lock onto a fresh type next
      }
      continue;
    }
  }
  return { foodSpawnPoints, wasteSpawnPoints, turretShots, bioSpawnPoints, chestSpawnPoints };
}

// Shared by the auto-trickle and "Clear Chest" branches above — decrements
// the chest's own count (and, for a coin, its value pool) by exactly one
// unit and returns the spawn-point record Entities.js's updateEntities
// consumes to actually materialize it (see this file's own header comment
// on why item construction itself lives there, not here — avoiding a
// circular import). `mode` is 'aimed' (launches along data.trickleAngle,
// production-launch force) or 'scatter' (a fresh random angle, low fixed
// force) — see Entities.js's applyDirectionalLaunch/applyScatterLaunch.
function ejectOneFromChest(data, centerX, centerY, mode) {
  const angle = mode === 'aimed' ? data.trickleAngle : Math.random() * Math.PI * 2;
  const spawnX = centerX + Math.cos(angle) * TILE_SIZE * 0.8;
  const spawnY = centerY + Math.sin(angle) * TILE_SIZE * 0.8;
  let coinValue = null;
  if (data.lockedItemType === 'coin') {
    coinValue = Math.max(1, Math.round(data.coinValueSum / data.count));
    data.coinValueSum -= coinValue;
  }
  data.count -= 1;
  return { x: spawnX, y: spawnY, itemType: data.lockedItemType, mode, angle, coinValue };
}

// Whether a tile is genuinely "doing work" this tick, for uptime tracking —
// deliberately the same signal (or a close analogue of it) every other
// active/idle check elsewhere in this file already uses, so "uptime" can't
// silently disagree with what the process dots/active-machine pulse/power-
// shortage overlay already consider "on." A Fan has no idle state at all
// (it draws its full force/cost unconditionally the entire time it's
// placed), so it's always counted active; a Turret's own draw is bursty
// (see computeCurrentPowerDemand's own comment on why it's excluded from
// that function) — "active" here means genuinely ready to fire (cooldown
// elapsed, ammo in hand), not the instantaneous tick a shot happens to go
// out on, which would otherwise read as near-0% uptime even for a turret
// that's constantly busy.
function isBuildingActiveForUptime(state, type, data, centerX, centerY) {
  if (FAN_TILES.has(type)) return true;
  if (COLLECTOR_TILES.has(type)) {
    return state.level.items.some(
      (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
    );
  }
  if (REFINERY_TILES.has(type)) return data.lockedRecipe !== null;
  if (MANUFACTURER_TILES.has(type)) return !!data.processing;
  if (POWER_PLANT_TILES.has(type)) return !!data.fueled && data.recipeId !== null;
  if (TURRET_TILES.has(type)) {
    const hasAmmo = !TURRET_AMMO_TILES.has(type) || data.ammoWaste + data.ammoBiomass > 0;
    return data.cooldownMs <= 0 && hasAmmo;
  }
  return false;
}

// Accumulates active-time within the current BUILDING_UPTIME_SAMPLE_
// INTERVAL_MS window, pushing one fraction (0-1) into a fixed-length
// circular buffer every time that window elapses — a real rolling window,
// not an exponential decay approximation, per direct request ("efficiency
// based on a rolling 3 minutes"). Lazily initializes its own tracking
// fields the first time it sees a tile (rather than needing every placeTile/
// cycleTileCheat branch updated to pre-seed them) — safe since a plain
// `data.uptimeSamples === undefined` check can never collide with a
// genuine save/load round-trip (JSON has no way to represent `undefined` in
// the first place, so a loaded save's field is always either a real array
// or simply absent, both of which this check already treats as "needs
// initializing").
function updateBuildingUptimeTracking(state, type, data, centerX, centerY, dtMs) {
  if (data.uptimeSamples === undefined) {
    data.uptimeSamples = [];
    data.uptimeSampleTimerMs = 0;
    data.uptimeActiveMs = 0;
  }
  if (isBuildingActiveForUptime(state, type, data, centerX, centerY)) data.uptimeActiveMs += dtMs;
  data.uptimeSampleTimerMs += dtMs;
  if (data.uptimeSampleTimerMs >= BUILDING_UPTIME_SAMPLE_INTERVAL_MS) {
    data.uptimeSamples.push(data.uptimeActiveMs / data.uptimeSampleTimerMs);
    if (data.uptimeSamples.length > BUILDING_UPTIME_SAMPLE_COUNT) data.uptimeSamples.shift();
    data.uptimeSampleTimerMs = 0;
    data.uptimeActiveMs = 0;
  }
}

// Exported for UI.js's building-info pop-up — the average of whatever
// samples have accumulated so far (not necessarily a full 3 minutes' worth
// yet on a freshly-placed building), or null if none exist at all (shown as
// "still warming up" rather than a misleading 0%).
export function getBuildingUptimeFraction(data) {
  if (!data || !data.uptimeSamples || data.uptimeSamples.length === 0) return null;
  const sum = data.uptimeSamples.reduce((a, b) => a + b, 0);
  return sum / data.uptimeSamples.length;
}

// Live, moment-to-moment sum of every currently-DRAWING power-consuming
// building — a Fan draws its cost unconditionally while placed (existing
// precedent), a Processor/Auto-Feeder only while actively holding/processing
// something. Recomputed fresh every call rather than tracked as a running
// total (same "no separate bookkeeping to keep in sync" pattern as
// getBuildingCost/countLivingFishOfSpecies elsewhere) — cheap, since
// state.level.buildingData is never more than a few dozen entries. Not
// gated on state.level.powerSupply at all — see Config.js's Directional Fans
// comment for why power draw has never actually throttled anything in this
// codebase; this is purely the "current usage" half of the HUD readout.
//
// Turrets are deliberately NOT included here — a turret's power draw is a
// single-tick pulse (one shot), not a sustained per-tick state like every
// other building this function checks, so a plain snapshot read once a real
// second (main.js's own power-sampling block, the only caller of this
// function) would almost always land on a tick the turret ISN'T actively
// firing and undercount its true demand to near zero — exactly the bug
// behind "Electric/Advanced Turrets fire even with no electricity." Turret
// demand is tracked separately as a running accumulator instead
// (state.level.turretPowerDemandAccumMw, credited the instant each shot
// actually fires — see updateBuildings' own turret-fire branch) and added
// in by main.js alongside this function's own return value.
export function computeCurrentPowerDemand(state) {
  let demand = 0;
  const items = state.level.items;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    if (FAN_TILES.has(data.type)) {
      demand += FAN_STATS[data.type].powerCost;
    } else if (COLLECTOR_TILES.has(data.type)) {
      const [row, col] = key.split(',').map(Number);
      const centerX = col * TILE_SIZE + TILE_SIZE / 2;
      const centerY = row * TILE_SIZE + TILE_SIZE / 2;
      const activeItem = items.find(
        (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
      );
      if (activeItem) demand += getCollectorPowerCostForItem(PROCESSOR_STATS[data.type], activeItem.type);
    } else if (REFINERY_TILES.has(data.type)) {
      // Every tier — including the base (now "Electric Refinery") — only
      // draws while actively processing a locked recipe, same "only while
      // actually doing something" rule.
      if (data.lockedRecipe !== null) demand += REFINERY_STATS[data.type].powerCostPerSec;
    } else if (MANUFACTURER_TILES.has(data.type)) {
      // Only draws while actively processing an absorbed ingredient — no
      // draw at all while idle/no-recipe/waiting for the next item. The
      // Alien Egg recipe specifically draws double, per direct spec — see
      // MANUFACTURER_RECIPES.alien_egg's own powerCostMultiplier field.
      if (data.processing) {
        const recipe = MANUFACTURER_RECIPES[data.recipeId];
        const multiplier = (recipe && recipe.powerCostMultiplier) || 1;
        demand += (MANUFACTURER_ITEM_POWER_COST_MW[data.currentItemType] || 0) * multiplier;
      }
    }
    // Power Plant is a GENERATOR, not a consumer — never appears in demand,
    // same as the Electric Eel fish — intentionally has no branch here.
  }
  return demand;
}

// Power efficiency — a real throughput multiplier for every power-costing
// building now, per direct request ("if the power usage exceeds, make the
// buildings less efficient... 3 eels generating 100MW, 10 buildings that
// require 133MW, the buildings would have ~75% enough electricity, so
// (100-75=25, times 2 = 50%) the buildings would run at 50% efficiency").
// ratio is supply/demand capped at 1 (can't be "more than fully supplied"),
// deficitPercent is how far short of 100% that ratio falls, and efficiency
// drops TWICE as fast as the raw deficit — clamped to [0, 100] so a total
// power loss (0 supply against any real demand) genuinely floors at 0%, not
// a negative number. demand <= 0 is a special case (nothing is even trying
// to draw power) rather than a divide-by-zero — full efficiency, since
// there's nothing to be inefficient about.
export function computePowerEfficiency(supplyMw, demandMw) {
  if (demandMw <= 0) return 1;
  const ratio = Math.min(1, supplyMw / demandMw);
  const deficitPercent = 100 - ratio * 100;
  const efficiencyPercent = Math.max(0, Math.min(100, 100 - deficitPercent * 2));
  return efficiencyPercent / 100;
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
function applyItemPush(state, item, dx, dy, massFraction, rawOverlap) {
  const nx = item.x + dx;
  const ny = item.y + dy;
  // isSolidForItem (not plain isSolid) — a Platform filtering this item's
  // type out entirely shouldn't block the correction either; see that
  // function's own comment.
  if (isSolidForItem(state, tileAt(state.level.grid, nx, ny), colAt(nx), rowAt(ny), item.type)) return; // don't tunnel the correction into a wall — it'll get another chance next tick/iteration
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
        applyItemPush(state, a, -nx * overlap * aFrac, -ny * overlap * aFrac, aFrac * 2, rawOverlap);
        applyItemPush(state, b, nx * overlap * bFrac, ny * overlap * bFrac, bFrac * 2, rawOverlap);
      }
    }
  }
}

// ---- Rendering ----
// A small speckled noise tile, generated once and cached as a repeating
// CanvasPattern — gives the flat seabed fill some grain/texture instead of
// reading as a single flat color, per direct request. Deliberately simple:
// tiled in plain screen space (not re-anchored to world coordinates as the
// camera pans), since the speckle is subtle/low-opacity background noise —
// a perfectly world-locked version would need to track the pattern's own
// transform against camera.x/zoom every frame for a purely decorative
// texture nobody is meant to consciously track while panning.
let cityTexturePattern = null;
function getCityTexturePattern(ctx) {
  if (cityTexturePattern) return cityTexturePattern;
  const tile = document.createElement('canvas');
  tile.width = 48;
  tile.height = 48;
  const tctx = tile.getContext('2d');
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * 48;
    const y = Math.random() * 48;
    const r = 0.6 + Math.random() * 1.7;
    tctx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.09)';
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }
  cityTexturePattern = ctx.createPattern(tile, 'repeat');
  return cityTexturePattern;
}

// The underground biome's own speckle texture, mirroring getCityTexturePattern
// above exactly (same generation technique, cached the same way) but in a
// cooler, darker palette — a few pale blue-grey mineral flecks mixed in with
// the dark speckle instead of the city's plain black/white — so it reads as
// "a deeper rock version" of the same city grain, not an unrelated pattern.
let undergroundTexturePattern = null;
function getUndergroundTexturePattern(ctx) {
  if (undergroundTexturePattern) return undergroundTexturePattern;
  const tile = document.createElement('canvas');
  tile.width = 48;
  tile.height = 48;
  const tctx = tile.getContext('2d');
  for (let i = 0; i < 55; i++) {
    const x = Math.random() * 48;
    const y = Math.random() * 48;
    const r = 0.6 + Math.random() * 1.7;
    tctx.fillStyle = Math.random() < 0.7 ? 'rgba(0, 0, 0, 0.22)' : 'rgba(150, 175, 195, 0.14)';
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }
  undergroundTexturePattern = ctx.createPattern(tile, 'repeat');
  return undergroundTexturePattern;
}

// The jagged Rocky Shelf (a hard physical barrier partway down, splitting
// the seabed into a visually distinct "city" and "underground") is gone
// entirely — per direct request, "remove the upper and lower sections of
// the city... make it all the same section," with the only remaining trace
// of the old two-tone look being a plain top-to-bottom color gradient on
// the single unified fill (see renderSeabedGrid above). sweepVertical's own
// hard stop moved from the old ROCK_SHELF_Y down to WORLD_H, the world's
// real bottom edge.

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

  // Base seabed color behind every tile, including empty ones, so the grid
  // still reads as "ground" before anything's been built on it. Deliberately
  // NOT gated on rowStart <= rowEnd (only the real tile loop below is) — the
  // camera can now scroll CAMERA_BOTTOM_BUFFER_PX past the world's real
  // bottom edge into a pure-visual buffer strip (see Config.js), and this
  // fill needs to keep covering the screen there too so the buffer "looks
  // the same as the rest of the city background," per direct request.
  //
  // Per direct request, the old two-tone "city" (above the Rocky Shelf) /
  // "underground" (below it) split — with a jagged rock ledge as a hard
  // physical barrier in between — is gone entirely: "remove the upper and
  // lower sections of the city, make it all the same section... food,
  // money, waste, and science should all fall to the very bottom of the
  // tank" (see sweepVertical's own updated stop, now at WORLD_H instead of
  // the old ROCK_SHELF_Y). What's left of the two-tone look is purely a
  // color gradient across the same single fill — top stop is the old city
  // color, bottom stop (at the world's real bottom edge) is the old
  // underground color — one continuous surface, not two.
  const topOfSeabed = worldToScreen(0, SEABED_ROW_START * TILE_SIZE, camera);
  const bottomOfWorld = worldToScreen(0, WORLD_H, camera);
  const seabedGradient = ctx.createLinearGradient(0, topOfSeabed.y, 0, bottomOfWorld.y);
  seabedGradient.addColorStop(0, '#4a3624');
  seabedGradient.addColorStop(1, '#3d3122');
  ctx.fillStyle = seabedGradient;
  ctx.fillRect(0, Math.max(0, topOfSeabed.y), canvasWidth, canvasHeight);
  ctx.fillStyle = '#6b4f34';
  ctx.fillRect(0, Math.max(0, topOfSeabed.y), canvasWidth, 4); // seabed surface highlight line

  ctx.save();
  ctx.fillStyle = getCityTexturePattern(ctx);
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, Math.max(0, topOfSeabed.y) + 4, canvasWidth, canvasHeight);
  ctx.restore();

  renderCameraBottomBuffer(ctx, camera, canvasWidth, canvasHeight);

  // The real tile loop is skipped (not the whole function) once every real
  // tile row is off-screen — e.g. scrolled down into the camera buffer
  // strip above — but renderFanIndicators still needs to run regardless,
  // same reasoning as its own comment below: a Fan's cone can reach well
  // past its own tile, so it shouldn't disappear just because this culled
  // loop found nothing to draw.
  if (rowStart <= rowEnd) {
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
        // A pulsing glow whenever a linked, non-hungry Catalyst Fish is
        // actively buffing this exact tile — per direct spec ("give the
        // buffed building a visual glow so it's obvious it's buffed").
        if (data && getCatalystSpeedMultiplier(state, buildingKey(col, row)) > 1) {
          renderCatalystGlow(ctx, screen.x, screen.y, size, state.level.elapsed);
        }
        // A brief brighter flash on either a fresh Catalyst Fish link or a
        // re-click revealing an existing one — see main.js's click handler.
        if (data && data.catalystFlashUntilMs > state.level.elapsed) {
          const flashT = (data.catalystFlashUntilMs - state.level.elapsed) / CATALYST_FLASH_DURATION_MS;
          ctx.save();
          ctx.globalAlpha = Math.max(0, flashT);
          ctx.strokeStyle = '#ffe066';
          ctx.lineWidth = 4;
          ctx.strokeRect(screen.x, screen.y, size, size);
          ctx.restore();
        }
        // Fans are drawn separately below (renderFanIndicators), over EVERY
        // fan in state.level.buildingData rather than just the on-screen-tile-
        // culled ones this loop already skipped past — a Fan's cone can reach
        // tiles/water well beyond its own tile, so its own tile scrolling off
        // screen doesn't mean its effective range has too. Collector/Turret
        // no longer have a direction indicator to draw at all — see
        // renderDirectionIndicator's own comment on why (they suck in
        // anything touching them from any side now, no "input side" any more).
        if (data) {
          const dotsInfo = computeProcessDotsInfo(state, type, data, col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
          if (dotsInfo) {
            renderProcessDots(ctx, screen.x, screen.y, size, camera.zoom, dotsInfo.fraction, dotsInfo.mode);
            // A gentle pulsing outline whenever a Refinery/Collector/
            // Manufacturer/Power Plant is actively working — per direct
            // request ("have the refineries, collectors, manufacturer, and
            // the powerplant pulse slightly when in use... so it's visually
            // obvious which machines are running"). Reuses the exact same
            // "actively processing" signal computeProcessDotsInfo already
            // derives for the process-progress dots above (a non-null
            // result IS the "in use" condition for all 4 building families),
            // so there's no separate per-type active-check to keep in sync.
            renderActiveMachinePulse(ctx, screen.x, screen.y, size, state.level.elapsed);
          }
        }
        if (data && TURRET_AMMO_TILES.has(type)) {
          renderTurretAmmoDots(ctx, screen.x, screen.y, size, data.ammoWaste, data.ammoBiomass, camera.zoom);
        }
        if (data && MANUFACTURER_TILES.has(type) && data.recipeId !== null) {
          renderManufacturerIngredientLights(ctx, screen.x, screen.y, size, data);
          renderManufacturerGhostFlash(ctx, screen.x, screen.y, size, camera.zoom, data);
        }
        // Per direct request ("add in a un-powered visual indicator on the
        // manufacturer") — distinct from renderPowerShortageOverlay below
        // (which is about the GRID being short on supply): this shows
        // whenever the Manufacturer itself simply isn't drawing any power
        // AT ALL this tick — no recipe picked yet, or idle between
        // ingredients — so an inactive Manufacturer doesn't look
        // indistinguishable from one that's genuinely working.
        if (data && MANUFACTURER_TILES.has(type) && !data.processing) {
          renderManufacturerIdleBadge(ctx, screen.x, screen.y, size, camera.zoom);
        }
        // A stalled-building status glyph, per direct request ("a small
        // status glyph over buildings that are stalled... visible from a
        // zoomed-out view instead of only on hover") — a Refinery with
        // nothing locked in (idle, waiting for Waste/Bio-Sludge to touch
        // it), a Power Plant with no recipe picked, and an ammo-tier Turret
        // that's run dry. The Manufacturer's own equivalent (above) already
        // shipped earlier under a different name; these three round out the
        // exact examples named in the request.
        if (data && REFINERY_TILES.has(type) && data.lockedRecipe === null) {
          renderStalledBadge(ctx, screen.x, screen.y, size, camera.zoom, '⏳');
        }
        if (data && POWER_PLANT_TILES.has(type) && data.recipeId === null) {
          renderStalledBadge(ctx, screen.x, screen.y, size, camera.zoom, '⏳');
        }
        if (data && TURRET_AMMO_TILES.has(type) && data.ammoWaste + data.ammoBiomass <= 0) {
          renderStalledBadge(ctx, screen.x, screen.y, size, camera.zoom, '🗑️');
        }
        const currentPowerDraw = getBuildingCurrentPowerDraw(state, type, data, col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2);
        const blockedFromAccepting = tileHasAnyPowerCost(type) && state.level.powerEfficiency < POWER_SHORTAGE_STALLED_THRESHOLD;
        if (currentPowerDraw > 0 || blockedFromAccepting) {
          renderPowerShortageOverlay(ctx, screen.x, screen.y, size, camera.zoom, state.level.powerEfficiency, state.level.elapsed);
        }
      }
    }
  }

  renderFanIndicators(ctx, state, canvasWidth, canvasHeight);
}

// The camera can now scroll CAMERA_BOTTOM_BUFFER_PX past the world's real
// bottom edge (see Config.js) into a pure-visual strip — a permanent home
// for the fixed bottom tool-bar that never covers real gameplay content.
// The seabed fill/texture above already covers it for free (that fill runs
// to the bottom of the canvas regardless of true world bounds), so on top of
// that this draws: a flat highlight strip exactly at WORLD_H — per direct
// request ("add in a rock line to the bottom of the city like the
// transition from the tank to the city [i.e. flat/solid, NOT the jagged
// Rocky Shelf]") — marking the city's real bottom edge the same "solid fill
// + thin lighter strip" way renderSeabedGrid's own SEABED_ROW_START line
// already does, then the buffer's own fill below that line.
//
// That fill has been through several passes: the original request was a
// fade ("the gradient shouldn't go over the entire city part, just the new
// part added onto the bottom"), then a request changed it to a flat
// #000000 hard break ("the gradient to black... should be changed to a hard
// break from the bottom tank to the toolbar"), then a first polish pass
// swapped the flat black for a plain 2-stop gradient + texture — which per
// direct follow-up report still "looks mostly like a flat black area." This
// pass keeps the hard EDGE (the highlight strip above is that seam —
// nothing fades across it) but genuinely earns "polished, not flat, matches
// the aesthetic of the rest of the game": a richer 3-stop gradient (a real
// visible mid-tone band, not just a top-to-bottom fade), a row of evenly-
// spaced machined rivets (deliberately NOT randomly jittered like the
// organic Rocky Shelf — reads as an engineered panel) each with their own
// tiny lit/shadowed bevel, a soft warm glow suggesting ambient light
// bleeding up from the toolbar's own equipment, and a second, fainter seam
// line partway down for real structure beyond a single gradient.
const BUFFER_RIVET_SPACING = TILE_SIZE * 1.5;
const BUFFER_RIVET_RADIUS = 3;
function renderCameraBottomBuffer(ctx, camera, canvasWidth, canvasHeight) {
  const topScreenY = worldToScreen(0, WORLD_H, camera).y;
  const bottomScreenY = worldToScreen(0, WORLD_H + CAMERA_BOTTOM_BUFFER_PX, camera).y;
  if (topScreenY > canvasHeight || bottomScreenY < 0) return; // buffer strip entirely off-screen

  const clampedTop = Math.max(0, topScreenY);
  const clampedBottom = Math.min(canvasHeight, bottomScreenY);
  const bufferHeight = clampedBottom - clampedTop;

  // Softened per direct request ("change the texture of the toolbar to be
  // slightly less aggressive/obtrusive") — the gradient's darkest stop
  // lightened and pulled closer to its lighter neighbors (a narrower overall
  // range reads as less of a stark plunge to near-black), the texture
  // overlay/glow/rivets all toned down alongside it, all further down.
  const gradient = ctx.createLinearGradient(0, topScreenY, 0, bottomScreenY);
  gradient.addColorStop(0, '#332619');
  gradient.addColorStop(0.45, '#241a10');
  gradient.addColorStop(1, '#160f09');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, clampedTop, canvasWidth, bufferHeight);

  ctx.save();
  ctx.fillStyle = getUndergroundTexturePattern(ctx);
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, clampedTop, canvasWidth, bufferHeight);
  ctx.restore();

  if (bufferHeight > 4) {
    ctx.save();
    const glowGradient = ctx.createRadialGradient(
      canvasWidth / 2, clampedTop, 0,
      canvasWidth / 2, clampedTop, canvasWidth * 0.42
    );
    glowGradient.addColorStop(0, 'rgba(255, 200, 120, 0.1)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, clampedTop, canvasWidth, bufferHeight);
    ctx.restore();
  }

  if (topScreenY >= 0) {
    ctx.fillStyle = '#4a3d2e';
    ctx.fillRect(0, topScreenY, canvasWidth, Math.max(2, 3 * camera.zoom));
  }

  // Evenly-spaced rivets just below the boundary line.
  const rivetScreenY = topScreenY + Math.max(10, 14 * camera.zoom);
  if (rivetScreenY >= -10 && rivetScreenY <= canvasHeight + 10) {
    const worldLeft = camera.x;
    const worldRight = camera.x + canvasWidth / camera.zoom;
    const firstRivetX = Math.floor(worldLeft / BUFFER_RIVET_SPACING) * BUFFER_RIVET_SPACING;
    for (let wx = firstRivetX; wx <= worldRight + BUFFER_RIVET_SPACING; wx += BUFFER_RIVET_SPACING) {
      const screenX = worldToScreen(wx, 0, camera).x;
      const r = Math.max(1.5, BUFFER_RIVET_RADIUS * camera.zoom);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.arc(screenX, rivetScreenY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 220, 180, 0.22)';
      ctx.arc(screenX - r * 0.3, rivetScreenY - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A second, fainter seam line partway down the buffer's own height.
  const seamY = topScreenY + bufferHeight * 0.55;
  if (seamY >= 0 && seamY <= canvasHeight) {
    const seamThickness = Math.max(1, 1 * camera.zoom);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, seamY, canvasWidth, seamThickness);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, seamY + seamThickness, canvasWidth, Math.max(1, 2 * camera.zoom));
  }
}

// Draws every Fan's cone + aim arrow regardless of whether its own tile is
// currently within the viewport's tile-culled range (see renderSeabedGrid's
// loop above) — a Fan's cone can reach FAN_T2/T3/T4_MAX_RANGE well past its
// own tile, so scrolling the fan itself off screen shouldn't make an
// on-screen portion of its push area disappear too, per direct bug report.
// Culled by a simple bounding-box check (the fan's screen center plus/minus
// its max range against the canvas rect) rather than per-tile visibility —
// cheap, and only over-draws a little for a fan whose full circle could
// reach the viewport but whose actual narrow cone doesn't quite, which is
// visually harmless.
function renderFanIndicators(ctx, state, canvasWidth, canvasHeight) {
  const { camera } = state;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    if (!FAN_TILES.has(data.type)) continue;
    const [row, col] = key.split(',').map(Number);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;
    const screen = worldToScreen(centerX, centerY, camera);
    const range = FAN_STATS[data.type].maxRange * camera.zoom;
    if (
      screen.x + range < 0 || screen.x - range > canvasWidth ||
      screen.y + range < 0 || screen.y - range > canvasHeight
    ) continue;
    const size = TILE_SIZE * camera.zoom;
    renderDirectionIndicator(ctx, data.type, screen.x - size / 2, screen.y - size / 2, size, data.angle, camera.zoom);
  }
}

// Lightens (positive t) or darkens (negative t) a "#rrggbb" hex color by a
// flat fraction of 255 per channel, clamped to a valid byte range — the one
// small color-math helper every hand-drawn building icon below shares for
// its own shading/highlight/rivet work (this file had no such helper before
// building icons needed real depth beyond the flat diagonal bevel).
function shadeHexColor(hex, t) {
  const num = parseInt(hex.slice(1), 16);
  const delta = Math.round(255 * t);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + delta);
  const g = clamp(((num >> 8) & 0xff) + delta);
  const b = clamp((num & 0xff) + delta);
  return `rgb(${r}, ${g}, ${b})`;
}

// A diagonal highlight/shadow bevel across a square tile's own bounds — a
// lighter top-left triangle, a darker bottom-right one — per direct request
// that buildings "pop more and look less flat" than a single flat fill.
// Cheap (two extra filled triangles, no gradients/filters) so it's safe to
// run every building, every frame.
function renderSquareBevel(ctx, x, y, size) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.closePath();
  ctx.fill();
}

// A small corner badge distinguishing the Electric/Advanced/Bio tier of a
// building from its base version — per direct request that each tier "look
// unique... but still identifiable as the same type of building." Shared by
// the Processor, Refinery, and Turret families: a yellow lightning bolt for
// Electric, a purple star for Advanced, a green DNA helix for the Refinery's
// top Bio tier, nothing for the base tier — layered on top of the same base
// shape (square+bevel, plus the Processor's own center circle) rather than a
// bespoke silhouette per tier, which is what keeps each tier reading as
// "still a Processor/Refinery" at a glance.
// A plain bevelled square (same base every un-special-cased building tile
// already gets) plus 3 pieces of live state: a dark "lid seam" so it reads
// as a chest at a glance, a fill-level bar along the bottom (count/capacity
// — empty until something's actually stored), and a small triangle arrow
// rotated to trickleAngle while the auto-trickle is armed, the same
// at-a-glance "this is actively doing something" language the pulsing
// time-control buttons already use elsewhere in this game.
function renderChestIcon(ctx, x, y, size, color, data) {
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.fill();
  ctx.stroke();
  renderSquareBevel(ctx, x, y, size);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + size * 0.08, y + size * 0.38);
  ctx.lineTo(x + size * 0.92, y + size * 0.38);
  ctx.stroke();

  if (data) {
    const capacity = STORAGE_CHEST_CAPACITY[data.type];
    const fillFraction = capacity > 0 ? Math.min(1, data.count / capacity) : 0;
    const barX = x + size * 0.12;
    const barY = y + size * 0.62;
    const barW = size * 0.76;
    const barH = size * 0.18;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(barX, barY, barW, barH);
    if (fillFraction > 0) {
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(barX, barY, barW * fillFraction, barH);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    if (data.trickleActive && data.trickleAngle !== null) {
      const cx = x + size / 2;
      const cy = y + size * 0.2;
      const r = size * 0.15;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(data.trickleAngle);
      ctx.fillStyle = '#4dff88';
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.6, -r * 0.6);
      ctx.lineTo(-r * 0.6, r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

function renderTierBadge(ctx, type, x, y, size) {
  if (type === TILE_COLLECTOR_ELECTRIC || type === TILE_REFINERY_ELECTRIC || type === TILE_TURRET_ELECTRIC) {
    ctx.fillStyle = '#fff04d';
    ctx.font = `${Math.max(8, size * 0.34)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', x + size * 0.82, y + size * 0.2);
  } else if (type === TILE_COLLECTOR_ADVANCED || type === TILE_REFINERY_ADVANCED || type === TILE_TURRET_ADVANCED) {
    ctx.fillStyle = '#e8c8ff';
    ctx.font = `${Math.max(8, size * 0.34)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', x + size * 0.82, y + size * 0.2);
  }
}

// ---- Hand-drawn per-family building icons ----
// Replaces the old flat "square + a large centered shop-icon glyph" look
// with real drawn machine shapes, per a direct reference screenshot (a
// riveted armor-plate turret/collector housing, a vented fan blade, a
// copper still for the Refinery, a small factory building for the
// Manufacturer, and 3 cooling towers for the Power Plant). Deliberately
// simplified vector approximations, not sprite-accurate reproductions —
// "it doesn't have to be exact... simpler is ok" — built from the same
// cheap layered-fill/stroke techniques (no ctx.filter) every other
// decorative render in this file already uses. Each tier within a family
// still shares its own function unchanged — only the tile's own configured
// `color` (passed in) and the corner tier badge (renderTierBadge) tell tiers
// apart, same as before this rework.

// Shared riveted armor-plate housing — the Turret and Collector families'
// common base look. A framed inset border plus 4 corner rivets; the caller
// draws whatever sits in the center (Turret's own raised diamond boss,
// Collector's existing dark "eye" circle).
function renderArmorPlateBase(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeRect(x, y, size, size);
  renderSquareBevel(ctx, x, y, size);

  const frame = size * 0.09;
  ctx.strokeStyle = shadeHexColor(color, -0.32);
  ctx.lineWidth = Math.max(1, size * 0.045);
  ctx.strokeRect(x + frame, y + frame, size - frame * 2, size - frame * 2);
  ctx.strokeStyle = shadeHexColor(color, 0.22);
  ctx.lineWidth = Math.max(1, size * 0.018);
  const inset2 = frame + ctx.lineWidth;
  ctx.strokeRect(x + inset2, y + inset2, size - inset2 * 2, size - inset2 * 2);

  const rivetR = size * 0.045;
  const rivetInset = size * 0.16;
  const corners = [
    [x + rivetInset, y + rivetInset],
    [x + size - rivetInset, y + rivetInset],
    [x + rivetInset, y + size - rivetInset],
    [x + size - rivetInset, y + size - rivetInset],
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.fillStyle = shadeHexColor(color, -0.38);
    ctx.arc(cx, cy, rivetR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = shadeHexColor(color, 0.32);
    ctx.arc(cx - rivetR * 0.3, cy - rivetR * 0.3, rivetR * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Turret: the armor plate above, a raised diamond boss, and a gun arm
// pivoting on the center bolt — per direct request ("add an arm to the
// center of the turret... keep the visuals as is otherwise... have the arm
// be able to pivot towards the alien it's aiming at"). aimAngle comes from
// the tile's own buildingData (updateBuildings' turret branch overwrites it
// every tick toward whichever living alien is currently nearest, defaulting
// to straight up — see placeTile's own turret init) — the one part of this
// icon that reflects live gameplay state instead of being fixed decoration.
function renderTurretIcon(ctx, x, y, size, color, aimAngle) {
  renderArmorPlateBase(ctx, x, y, size, color);
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.26;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = shadeHexColor(color, 0.18);
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.strokeStyle = shadeHexColor(color, -0.4);
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  const armLength = size * 0.42;
  const armWidth = size * 0.13;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(aimAngle || -Math.PI / 2);
  ctx.fillStyle = shadeHexColor(color, -0.2);
  ctx.fillRect(0, -armWidth / 2, armLength, armWidth);
  ctx.strokeStyle = shadeHexColor(color, -0.5);
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.strokeRect(0, -armWidth / 2, armLength, armWidth);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(0, -armWidth / 2, armLength, armWidth * 0.3);
  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, -0.45);
  ctx.arc(armLength, 0, armWidth * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, -0.42);
  ctx.arc(cx, cy, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, 0.3);
  ctx.arc(cx - size * 0.02, cy - size * 0.02, size * 0.03, 0, Math.PI * 2);
  ctx.fill();
}

// Fan: a vented housing with a pinwheel of curved blades, framed the same
// way the armor plate is. Purely the BASE shape a Fan tile sits on — its own
// aim arrow and force cone (renderDirectionIndicator/renderFanIndicators)
// still render in a completely separate pass on top of this, unchanged.
function renderFanVentBase(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeRect(x, y, size, size);
  renderSquareBevel(ctx, x, y, size);

  const frame = size * 0.07;
  ctx.strokeStyle = shadeHexColor(color, -0.3);
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.strokeRect(x + frame, y + frame, size - frame * 2, size - frame * 2);

  const cx = x + size / 2;
  const cy = y + size / 2;
  const outerR = size * 0.36;
  const innerR = size * 0.1;

  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, -0.22);
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  const bladeCount = 6;
  ctx.fillStyle = shadeHexColor(color, 0.35);
  for (let i = 0; i < bladeCount; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i / bladeCount) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(outerR * 0.55, -outerR * 0.35, outerR * 0.85, 0);
    ctx.quadraticCurveTo(outerR * 0.55, outerR * 0.15, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, -0.42);
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = shadeHexColor(color, 0.25);
  ctx.arc(cx - innerR * 0.25, cy - innerR * 0.25, innerR * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// Refinery: a small copper pot-still apparatus (two connected drums with
// conical caps, a control panel with a valve wheel) sitting on the tile's
// own configured color as backdrop — the copper palette itself is fixed
// regardless of tier color, since it's meant to read as "brass machinery,"
// not a tinted panel.
const REFINERY_COPPER = '#c9863a';
const REFINERY_COPPER_DARK = '#8a5a24';
const REFINERY_COPPER_LIGHT = '#e6b06a';
function renderRefineryIcon(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeRect(x, y, size, size);
  renderSquareBevel(ctx, x, y, size);

  const baseY = y + size * 0.86;
  ctx.fillStyle = shadeHexColor(color, -0.28);
  ctx.fillRect(x + size * 0.08, baseY, size * 0.84, size * 0.1);

  const drawStill = (cx, bodyW, bodyH, headH) => {
    const bodyX = cx - bodyW / 2;
    const bodyTop = baseY - bodyH;
    ctx.fillStyle = REFINERY_COPPER;
    ctx.fillRect(bodyX, bodyTop, bodyW, bodyH);
    ctx.strokeStyle = REFINERY_COPPER_DARK;
    ctx.lineWidth = Math.max(1, size * 0.015);
    ctx.strokeRect(bodyX, bodyTop, bodyW, bodyH);
    ctx.beginPath();
    ctx.moveTo(bodyX, bodyTop);
    ctx.lineTo(cx, bodyTop - headH);
    ctx.lineTo(bodyX + bodyW, bodyTop);
    ctx.closePath();
    ctx.fillStyle = REFINERY_COPPER_LIGHT;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(bodyX + bodyW * 0.15, bodyTop, bodyW * 0.16, bodyH);
    return { bodyTop, bodyX, bodyW };
  };

  const leftStill = drawStill(x + size * 0.34, size * 0.24, size * 0.36, size * 0.15);
  const rightStill = drawStill(x + size * 0.68, size * 0.17, size * 0.24, size * 0.1);

  ctx.strokeStyle = REFINERY_COPPER_DARK;
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(leftStill.bodyX + leftStill.bodyW, leftStill.bodyTop + leftStill.bodyW * 0.35);
  ctx.lineTo(rightStill.bodyX, rightStill.bodyTop + rightStill.bodyW * 0.35);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = REFINERY_COPPER_DARK;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.arc(x + size * 0.2, baseY + size * 0.05, size * 0.045, 0, Math.PI * 2);
  ctx.stroke();
}

// Manufacturer: a small factory building — a slanted roof, a chimney, and a
// couple of window/door details — on the tile's own configured color.
function renderManufacturerIcon(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeRect(x, y, size, size);
  renderSquareBevel(ctx, x, y, size);

  const wallColor = shadeHexColor(color, 0.18);
  const roofColor = shadeHexColor(color, -0.38);
  const chimneyColor = shadeHexColor(color, -0.22);

  ctx.fillStyle = chimneyColor;
  ctx.fillRect(x + size * 0.24, y + size * 0.14, size * 0.14, size * 0.36);
  ctx.strokeStyle = shadeHexColor(color, -0.48);
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.strokeRect(x + size * 0.24, y + size * 0.14, size * 0.14, size * 0.36);

  const buildingX = x + size * 0.18;
  const buildingY = y + size * 0.46;
  const buildingW = size * 0.68;
  const buildingH = size * 0.4;
  ctx.fillStyle = wallColor;
  ctx.fillRect(buildingX, buildingY, buildingW, buildingH);
  ctx.strokeStyle = shadeHexColor(color, -0.32);
  ctx.strokeRect(buildingX, buildingY, buildingW, buildingH);

  ctx.beginPath();
  ctx.moveTo(buildingX - size * 0.03, buildingY);
  ctx.lineTo(buildingX + buildingW * 0.4, buildingY - size * 0.12);
  ctx.lineTo(buildingX + buildingW + size * 0.03, buildingY);
  ctx.closePath();
  ctx.fillStyle = roofColor;
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = shadeHexColor(color, -0.38);
  ctx.fillRect(buildingX + buildingW * 0.15, buildingY + buildingH * 0.35, buildingW * 0.18, buildingH * 0.4);
  ctx.fillRect(buildingX + buildingW * 0.62, buildingY + buildingH * 0.35, buildingW * 0.18, buildingH * 0.4);
}

// Power Plant: 3 rounded-top cooling towers of varying height, joined by a
// base pipe, on the tile's own configured color.
function renderPowerPlantIcon(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.strokeRect(x, y, size, size);
  renderSquareBevel(ctx, x, y, size);

  const towerColor = shadeHexColor(color, 0.2);
  const towerDark = shadeHexColor(color, -0.32);
  const towerCount = 3;
  const towerW = size * 0.18;
  const gap = size * 0.06;
  const totalW = towerCount * towerW + (towerCount - 1) * gap;
  const startX = x + (size - totalW) / 2;
  const baseY = y + size * 0.82;

  for (let i = 0; i < towerCount; i++) {
    const tx = startX + i * (towerW + gap);
    const th = size * (0.34 + (i === 1 ? 0.13 : 0)); // middle tower slightly taller
    const ty = baseY - th;
    ctx.fillStyle = towerColor;
    ctx.fillRect(tx, ty, towerW, th);
    ctx.strokeStyle = towerDark;
    ctx.lineWidth = Math.max(1, size * 0.015);
    ctx.strokeRect(tx, ty, towerW, th);
    ctx.beginPath();
    ctx.ellipse(tx + towerW / 2, ty, towerW / 2, towerW * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadeHexColor(color, 0.35);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(tx + towerW * 0.15, ty + towerW * 0.3, towerW * 0.2, th * 0.6);
  }

  ctx.strokeStyle = towerDark;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(startX + towerW / 2, baseY);
  ctx.lineTo(startX + totalW - towerW / 2, baseY);
  ctx.stroke();
}

// Real drawn item art marking a Manufacturer/Power Plant's chosen recipe —
// not a generic swatch or a copy of the recipe's own emoji. Duplicated here
// rather than imported, same "Grid.js can't reach into main.js/UI.js's own
// per-item render code" reasoning UI.js's own drawItemIconCanvas already
// documents for the identical need — simplified to a flat/gradient circle
// (or, for the Alien Egg, its own shell-plus-ring look) rather than every
// exact highlight/rim detail those two files draw, since this renders small.
// Only ever called with one of the 7 item types an actual Manufacturer
// output or Power Plant fuel can be (see MANUFACTURER_RECIPES/
// POWER_PLANT_RECIPES) — anything else falls through to the plain Food look.
function renderRecipeItemIcon(ctx, itemType, cx, cy, r) {
  if (itemType === 'science' || itemType === 'science_green') {
    const colorA = itemType === 'science_green' ? SCIENCE_GREEN_COLOR_A : SCIENCE_ITEM_COLOR_A;
    const colorB = itemType === 'science_green' ? SCIENCE_GREEN_COLOR_B : SCIENCE_ITEM_COLOR_B;
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, colorA);
    grad.addColorStop(1, colorB);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.stroke();
    return;
  }
  if (itemType === 'biomass') {
    const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    grad.addColorStop(0, BIOMASS_COLOR_CORE);
    grad.addColorStop(1, BIOMASS_COLOR);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.stroke();
    return;
  }
  if (itemType === 'alien_egg') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.72, r, 0, 0, Math.PI * 2);
    ctx.fillStyle = ALIEN_EGG_COLOR;
    ctx.fill();
    ctx.strokeStyle = ALIEN_EGG_RING_COLOR;
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.stroke();
    return;
  }
  // Bio-Sludge (alien_dna), Mutagen Paste, or Food — a plain flat-filled
  // circle plus a dark rim and a small glossy highlight.
  const flatColor = itemType === 'mutagen_paste' ? MUTAGEN_PASTE_COLOR
    : itemType === 'alien_dna' ? ALIEN_DNA_COLOR
    : FOOD_COLOR;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = flatColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();
}

// A recipe identifier marking a Manufacturer/Power Plant's chosen recipe —
// shown ONLY once one is actually chosen. Originally a small painted
// signage plaque (a wooden plank behind the icon); per direct follow-up
// request ("remove the plaque from the recipe identifiers... leave just the
// object, and increase the size of the object identifier"), the plank/
// frame/grain-lines/rivets are gone entirely — just the recipe's own real
// item icon (renderRecipeItemIcon above), on its own, at roughly double its
// former radius now that it's no longer boxed into a small plaque. The item
// shown is whatever the recipe actually revolves around: a Manufacturer
// recipe's own `output`, or — since a Power Plant recipe has no output item
// at all, it credits power directly — its fuel `inputs[0]` instead, the
// exact same convention the recipe pop-up's own real-item icons already
// established (see UI.js's refreshRecipeMenu).
function renderRecipeIcon(ctx, type, x, y, size, data) {
  if (!data || data.recipeId == null) return;
  const recipe = type === TILE_MANUFACTURER ? MANUFACTURER_RECIPES[data.recipeId]
    : type === TILE_POWER_PLANT ? POWER_PLANT_RECIPES[data.recipeId]
    : null;
  if (!recipe) return;
  const itemType = type === TILE_MANUFACTURER ? recipe.output : recipe.inputs[0];

  // Deliberately shifted toward the tile's bottom-left, not centered — the
  // bottom-right corner is already home to the "stalled" badge
  // (renderStalledBadge, an idle/no-recipe Manufacturer or Power Plant), and
  // a recipe can genuinely be chosen while still idle between ingredients,
  // so the two would otherwise visually collide right when both are true;
  // this position also stays clear of the left-edge process-progress dots
  // and the Manufacturer's own center ghost-flash circle.
  const cx = x + size * 0.34;
  const cy = y + size * 0.86;
  const r = size * 0.14;
  renderRecipeItemIcon(ctx, itemType, cx, cy, r);
}

// Platform's own distinct look, per direct request ("make the platforms
// look more like simple bricks") — replaces the generic bevel-square shape
// every other building starts from. A real 2-row offset brick course (a
// classic running-bond pattern, the same reason real brickwork staggers its
// joints) drawn as mortar lines over the tile's own base fill, plus a soft
// per-brick highlight/shadow pair for a little dimension — matching this
// game's general "not flat" aesthetic without reusing the diagonal bevel
// look every other building keeps.
function renderBrickPattern(ctx, x, y, size, color) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  const rows = 2;
  const rowH = size / rows;
  const bricksPerRow = 2;
  const brickW = size / bricksPerRow;
  const mortarWidth = Math.max(1, size * 0.045);

  for (let r = 0; r < rows; r++) {
    const rowY = y + r * rowH;
    const offset = (r % 2 === 0) ? 0 : brickW / 2;
    // A subtle highlight along each brick's own top edge, then a darker
    // mortar line beneath it — this is what gives the individual bricks
    // (not just the tile as a whole) a little raised pop.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x, rowY, size, mortarWidth);
    for (let bx = -brickW; bx < size + brickW; bx += brickW) {
      const lx = x + bx + offset;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(lx - mortarWidth / 2, rowY, mortarWidth, rowH);
    }
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(x, y + size - mortarWidth, size, mortarWidth);
  ctx.restore();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
}

// A Half Platform's real look — literally half of the same brick material,
// clipped to its own actual collision wedge (RAMP_TRIANGLE_LOCAL_VERTS, the
// exact same vertices resolveRampCollisionAt collides against) rather than a
// separate, only-vaguely-related icon — one shared function for all 4
// orientations. A bright highlight stroke along the exposed hypotenuse — the
// real sliding surface an item lands on — makes the sloped face read
// clearly as distinct from a flat Platform's square top.
function renderPlatformRamp(ctx, x, y, size, color, tileType) {
  const localVerts = RAMP_TRIANGLE_LOCAL_VERTS[tileType];
  const verts = localVerts.map(([lx, ly]) => [x + (lx / TILE_SIZE) * size, y + (ly / TILE_SIZE) * size]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(verts[0][0], verts[0][1]);
  ctx.lineTo(verts[1][0], verts[1][1]);
  ctx.lineTo(verts[2][0], verts[2][1]);
  ctx.closePath();
  ctx.clip();
  renderBrickPattern(ctx, x, y, size, color);
  ctx.restore();
  ctx.strokeStyle = shadeHexColor(color, 0.35);
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  // The hypotenuse always runs between verts[0] and verts[2] — see
  // RAMP_TRIANGLE_LOCAL_VERTS's own comment on why verts[1] is always the
  // right-angle corner.
  ctx.moveTo(verts[0][0], verts[0][1]);
  ctx.lineTo(verts[2][0], verts[2][1]);
  ctx.stroke();
}

// Small green-checkmark badge showing that a Platform (any of its 5
// variants) currently has at least one item type whitelisted through it —
// per direct request ("Add a visual indicator on any platform that's
// currently acting as any filter"). A plain Platform with nothing
// whitelisted (data.filterItems empty, the default every fresh one starts
// with — behaviorally identical to an ordinary solid Platform) shows
// nothing at all, same as it always has. Fixed to the tile's own top-left
// corner regardless of which of the 4 ramp orientations it is — a
// consistent spot across all 5 variants reads more clearly at a glance than
// trying to dodge each wedge's own open corner.
function renderPlatformFilterBadge(ctx, x, y, size, data) {
  if (!data || !data.filterItems || data.filterItems.length === 0) return;
  const r = Math.max(3, size * 0.16);
  const cx = x + size * 0.2;
  const cy = y + size * 0.2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 190, 110, 0.94)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `${Math.max(8, size * 0.22)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('✓', cx, cy + 0.5);
  ctx.restore();
}

// Dispatches to each family's own hand-drawn icon function above — per
// direct request, replacing the old flat-square-plus-shop-icon-glyph look
// (which needed a click to tell buildings apart) with a real drawn machine
// shape per family. Platform keeps its own brick pattern; the Collector's
// existing center circle (the real point stepCollectorProcessing draws held
// items into) now sits on top of the shared armor-plate housing it shares
// with Turret, instead of a plain square; the Fan's own vent-blade base
// still sits fully underneath its own separately-rendered aim arrow/force
// cone (renderFanIndicators/renderDirectionIndicator), unchanged. Every tier
// within a family still shares its own function unchanged — only the tile's
// own configured `color` and the corner tier badge (renderTierBadge) tell
// tiers apart, same as before this rework. The progress/ammo/ingredient
// dots, the machine-active pulse, the power-shortage overlay, and the
// Catalyst glow are all separate render passes (see the per-tile render
// loop above) and are completely untouched by this dispatch.
//
// Exported (not just used internally) because it's a pure function of its
// own arguments — no `state` needed anywhere in it or anything it calls —
// so UI.js also calls it directly to draw a real, tiny preview of a
// building's actual look wherever the shop/Lab used to show a flat emoji
// instead (per direct request), with `data` simply omitted there (only
// Turret's own aim-arm angle reads it, defaulting to straight up).
export function renderTileShape(ctx, type, color, x, y, size, data) {
  if (type === TILE_PLATFORM) {
    renderBrickPattern(ctx, x, y, size, color);
    renderPlatformFilterBadge(ctx, x, y, size, data);
    return;
  }
  if (RAMP_TRIANGLE_LOCAL_VERTS[type]) {
    renderPlatformRamp(ctx, x, y, size, color, type);
    renderPlatformFilterBadge(ctx, x, y, size, data);
    return;
  }
  if (COLLECTOR_TILES.has(type)) {
    renderArmorPlateBase(ctx, x, y, size, color);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.arc(x + size / 2, y + size / 2, size * COLLECTOR_CIRCLE_RADIUS_FRACTION, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shadeHexColor(color, -0.4);
    ctx.lineWidth = Math.max(1, size * 0.03);
    ctx.stroke();
    renderTierBadge(ctx, type, x, y, size);
  } else if (TURRET_TILES.has(type)) {
    renderTurretIcon(ctx, x, y, size, color, data && data.aimAngle);
    renderTierBadge(ctx, type, x, y, size);
  } else if (FAN_TILES.has(type)) {
    renderFanVentBase(ctx, x, y, size, color);
    renderTierBadge(ctx, type, x, y, size);
    // Per direct request ("add a matching visual to the fans that are
    // filtering items") — the exact same green-checkmark badge a filtering
    // Platform already gets; renderPlatformFilterBadge is a pure function of
    // data.filterItems, nothing Platform-specific in it, so it works
    // unchanged here.
    renderPlatformFilterBadge(ctx, x, y, size, data);
  } else if (REFINERY_TILES.has(type)) {
    renderRefineryIcon(ctx, x, y, size, color);
    renderTierBadge(ctx, type, x, y, size);
  } else if (type === TILE_MANUFACTURER) {
    renderManufacturerIcon(ctx, x, y, size, color);
    renderRecipeIcon(ctx, type, x, y, size, data);
  } else if (type === TILE_POWER_PLANT) {
    renderPowerPlantIcon(ctx, x, y, size, color);
    renderRecipeIcon(ctx, type, x, y, size, data);
  } else if (STORAGE_CHEST_TILES.has(type)) {
    // No renderTierBadge here — it only knows the Collector/Refinery/Turret
    // families' own tile constants, and each chest tier already reads as
    // distinct from its own BUILDING_TYPES color (bronze/steel/purple)
    // without needing one.
    renderChestIcon(ctx, x, y, size, color, data);
  } else {
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.fill();
    ctx.stroke();
    renderSquareBevel(ctx, x, y, size);
    renderTierBadge(ctx, type, x, y, size);
  }
}

// A column of PROCESS_DOTS_COUNT (4) dots down the left edge of a
// Processor/Manufacturer/Refinery/Power Plant tile, per direct request.
// Thresholds are fixed at 20/40/60/80%, NOT count-derived (4 dots divide a
// 0-100% range into 5 steps, not 4) — see each mode's own comment below.
const PROCESS_DOT_THRESHOLDS = [0.2, 0.4, 0.6, 0.8];

// Resolves what (if anything) a given placed tile should show this frame —
// null hides the dots entirely (nothing currently processing/fueled). Reads
// state.level.items directly for the Collector case, mirroring
// computeCurrentPowerDemand's own identical "find the item mid-hold on this
// exact tile" scan.
function computeProcessDotsInfo(state, type, data, centerX, centerY) {
  if (COLLECTOR_TILES.has(type)) {
    const activeItem = state.level.items.find(
      (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
    );
    if (!activeItem) return null;
    return { fraction: activeItem.collectorProgressMs / activeItem.collectorTargetMs, mode: 'fill' };
  }
  if (REFINERY_TILES.has(type)) {
    if (data.lockedRecipe === null) return null;
    const stats = REFINERY_STATS[type];
    const targetMs = data.lockedRecipe === 'dna_to_biomass' ? stats.foodProcessMs * ALIEN_DNA_REFINERY_TIME_MULTIPLIER : stats.foodProcessMs;
    return { fraction: data.progressMs / targetMs, mode: 'fill' };
  }
  if (MANUFACTURER_TILES.has(type)) {
    if (!data.processing) return null;
    return { fraction: data.progressMs / MANUFACTURER_ITEM_PROCESS_MS[data.currentItemType], mode: 'fill' };
  }
  if (POWER_PLANT_TILES.has(type)) {
    if (!data.fueled || data.recipeId === null) return null;
    return { fraction: data.progressMs / POWER_PLANT_RECIPES[data.recipeId].durationMs, mode: 'drain' };
  }
  return null;
}

// `mode: 'fill'` (Processor/Manufacturer/Refinery) lights up bottom-to-top
// as progress climbs — the bottom dot at 20%, ..., the top dot at 80%+.
// `mode: 'drain'` (Power Plant) starts fully lit the instant fuel is
// absorbed and turns OFF top-to-bottom as that fuel is consumed — the top
// dot off at 20% used, ..., the bottom dot off at 80%+ used.
function renderProcessDots(ctx, x, y, size, zoom, fraction, mode) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const dotRadius = Math.max(1.5, size * 0.055);
  const gap = dotRadius * 2.6;
  const totalHeight = (PROCESS_DOTS_COUNT - 1) * gap;
  const startY = y + size / 2 - totalHeight / 2;
  const dotX = x + size * 0.14;
  for (let i = 0; i < PROCESS_DOTS_COUNT; i++) {
    const fromBottom = PROCESS_DOTS_COUNT - 1 - i; // i=0 is the TOP dot, i=count-1 is the BOTTOM dot
    const lit = mode === 'drain' ? clamped < PROCESS_DOT_THRESHOLDS[i] : clamped >= PROCESS_DOT_THRESHOLDS[fromBottom];
    const dotY = startY + i * gap;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = lit ? '#ffe066' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(0.5, zoom * 0.5);
    ctx.stroke();
  }
}

// A soft pulsing gold outline around a Catalyst-Fish-buffed building — per
// direct spec ("give the buffed building a visual glow so it's obvious it's
// buffed"). Pulses via elapsed time so it reads as "active" rather than a
// static highlight, same "sin(elapsed/x)" pulse technique
// renderPowerShortageOverlay's own stalled-badge already uses.
function renderCatalystGlow(ctx, x, y, size, elapsedMs) {
  const pulse = 0.55 + 0.45 * Math.sin(elapsedMs / 260);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ffe066';
  ctx.shadowBlur = 10;
  ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
  ctx.restore();
}

// A gentle, subtle pulse on a Refinery/Collector/Manufacturer/Power Plant
// while it's actively processing something — per direct request. Originally
// just a pulsing border outline; per a later direct report ("increase the
// visibility of the pulsing, so most of the building pulses instead of just
// the border"), most of the tile's own body now pulses too — a translucent
// fill layered on top of the tile's already-drawn icon/shape, kept low-alpha
// enough that the icon underneath stays legible through it, with the
// original border riding the exact same pulse for a stronger edge. Still a
// different color and a much gentler peak alpha than renderCatalystGlow
// above (a soft white/cyan "machine humming" cue, low-key enough to sit
// quietly on every currently-working building at once without the screen
// turning into a light show), and the same slower period so it doesn't
// compete visually with the Catalyst Fish's own buff glow.
function renderActiveMachinePulse(ctx, x, y, size, elapsedMs) {
  const pulse = 0.25 + 0.25 * Math.sin(elapsedMs / 420); // 0-0.5, same range/period as before
  ctx.save();
  ctx.fillStyle = '#dff6ff';
  ctx.globalAlpha = pulse * 0.55; // a fraction of the border's own alpha — covers most of the body without burying the icon drawn underneath it
  ctx.fillRect(x + 2, y + 2, size - 4, size - 4);
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = '#dff6ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#dff6ff';
  ctx.shadowBlur = 6;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.restore();
}

// Two small lights on the Manufacturer, separate from the 4 vertical
// process-progress dots above — one per recipe ingredient SLOT, replacing
// an earlier single "first ingredient processed" light. Per direct request
// ("add in a second dot... so it's visually obvious when an item still
// needs to go in the manufacturer") — a slot lights up once its own
// ingredient type has been fully absorbed AND finished processing (not in
// data.pendingInputs any more, AND not the one currently mid-process via
// data.currentItemType — so the ingredient actively being crunched right
// now doesn't prematurely read as "done"). Stacked on the opposite (right)
// edge from the vertical dots so the two indicators never overlap.
function renderManufacturerIngredientLights(ctx, x, y, size, data) {
  const recipe = MANUFACTURER_RECIPES[data.recipeId];
  if (!recipe) return;
  const r = Math.max(1.5, size * 0.06);
  for (let i = 0; i < recipe.inputs.length; i++) {
    const type = recipe.inputs[i];
    const done = !data.pendingInputs.includes(type) && data.currentItemType !== type;
    ctx.beginPath();
    ctx.arc(x + size * 0.86, y + size * (0.14 + i * 0.2), r, 0, Math.PI * 2);
    ctx.fillStyle = done ? '#7cff5a' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// A periodic "ghost icon" flash of whichever ingredient the Manufacturer is
// still waiting on — per direct request ("when one item has been processed
// ... the other item for the recipe flashes briefly as a ghost icon onto
// the manufacturer every once in a while to indicate which item is still
// needed"). Reuses each item type's own established flat color
// (MANUFACTURER_INPUT_COLOR_BY_TYPE) rather than a mismatched emoji, since
// items themselves are plain colored shapes in this game, not icons — reads
// as a translucent preview of the exact item that needs to touch the tile.
// Driven by data.ghostFlashTimerMs (ticked in updateBuildings above, only
// while genuinely awaiting a second ingredient): flashes for the first
// MANUFACTURER_GHOST_FLASH_DURATION_MS of every
// MANUFACTURER_GHOST_FLASH_INTERVAL_MS-long cycle, repeating for as long as
// that ingredient is still missing.
const MANUFACTURER_GHOST_FLASH_INTERVAL_MS = 2000; // halved from 4000 per direct request ("blink the needed item twice as much as it does now")
const MANUFACTURER_GHOST_FLASH_DURATION_MS = 700;
function renderManufacturerGhostFlash(ctx, x, y, size, zoom, data) {
  if (data.processing || data.pendingInputs.length !== 1) return;
  const phase = data.ghostFlashTimerMs % MANUFACTURER_GHOST_FLASH_INTERVAL_MS;
  if (phase >= MANUFACTURER_GHOST_FLASH_DURATION_MS) return;
  const t = phase / MANUFACTURER_GHOST_FLASH_DURATION_MS; // 0..1 across the flash's own lifetime
  const alpha = Math.sin(t * Math.PI); // fades in, peaks at the midpoint, fades back out — no hard pop/cut
  const color = MANUFACTURER_INPUT_COLOR_BY_TYPE[data.pendingInputs[0]];
  if (!color) return;
  const r = size * 0.22;
  ctx.save();
  ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * zoom);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.stroke();
  ctx.restore();
}

// A small "something needs your attention" badge in a tile's bottom-right
// corner — a dark circle, a dim glyph, and a red slash through it — per
// direct request ("a small status glyph over buildings that are stalled...
// so problems are visible from a zoomed-out view instead of only on
// hover"). Generalized from the Manufacturer's own original "not drawing
// power" badge (see renderManufacturerIdleBadge below, its one remaining
// caller) into a shared renderer any stalled-building check can reuse with
// its own glyph.
function renderStalledBadge(ctx, x, y, size, zoom, glyph) {
  const r = Math.max(2, size * 0.14);
  const cx = x + size * 0.84;
  const cy = y + size * 0.84;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 40, 40, 0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `${Math.max(8, size * 0.2)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d8d8d8';
  ctx.fillText(glyph, cx, cy);
  ctx.strokeStyle = '#ff5a5a';
  ctx.lineWidth = Math.max(1, 1.3 * zoom);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy + r * 0.6);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.6);
  ctx.stroke();
  ctx.restore();
}

// The Manufacturer's own original stalled badge (crossed lightning bolt =
// "not drawing power AT ALL right now") — kept as its own named wrapper
// since its one call site already reads by this name; every other stalled-
// building check below calls renderStalledBadge directly with its own
// glyph instead.
function renderManufacturerIdleBadge(ctx, x, y, size, zoom) {
  renderStalledBadge(ctx, x, y, size, zoom, '⚡');
}

// 5 dots on the Waste Turret — one per stored Waste unit, per direct
// request ("with dots indicating each waste/10 ammo"). Ammo drains one shot
// at a time (not in clean blocks of 10), so a dot stays "lit" until the very
// last shot of its own 10-shot block is spent — Math.ceil, not a plain
// division — reading as "how many loads are still stored" rather than
// jumping to the next dot down mid-block. Now two pools (Waste/Biomass, see
// BIOMASS_TURRET_SHOTS_PER_AMMO) — Biomass's own lit dots are drawn first
// and tinted its own green (matching BIOMASS_COLOR) since the fire branch
// spends that pool first, so the dot that's about to burn down next is
// always the leftmost one.
function renderTurretAmmoDots(ctx, x, y, size, ammoWaste, ammoBiomass, zoom) {
  const biomassDots = Math.ceil(ammoBiomass / BIOMASS_TURRET_SHOTS_PER_AMMO);
  const wasteDots = Math.ceil(ammoWaste / WASTE_TURRET_SHOTS_PER_WASTE);
  const litDots = Math.min(WASTE_TURRET_MAX_WASTE, biomassDots + wasteDots);
  const dotRadius = Math.max(1.5, size * 0.055);
  const gap = dotRadius * 2.6;
  const totalWidth = (WASTE_TURRET_MAX_WASTE - 1) * gap;
  const startX = x + size / 2 - totalWidth / 2;
  const dotY = y + size * 0.14;
  for (let i = 0; i < WASTE_TURRET_MAX_WASTE; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = i >= litDots ? 'rgba(0, 0, 0, 0.35)' : i < biomassDots ? BIOMASS_COLOR : '#ffe066';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(0.5, zoom * 0.5);
    ctx.stroke();
  }
}

// A tile's own power draw RIGHT NOW — not merely what its TYPE is
// configured to cost — per direct report ("buildings should only show the
// low/no power indicator if it is currently using electricity... reserve
// that indicator for buildings that are actively trying to draw power").
// The old version of this function returned a flat per-type constant
// regardless of whether the building was doing anything at all that tick,
// so an idle Collector/Refinery with nothing to process (or a Manufacturer
// with no recipe picked) showed the shortage overlay any time the grid
// itself was short, even though it wasn't drawing — or trying to draw — a
// single watt at that moment. Mirrors computeCurrentPowerDemand's own
// per-type "is this genuinely drawing" conditions exactly (a Fan is the one
// type with no idle state — see that function's own reasoning — so it
// always counts), so the render overlay below and computeCurrentPowerDemand
// can never disagree about what's actually pulling from the grid. Exported
// — UI.js's building-info pop-up reads this exact live number for its own
// "Consuming Xmw" readout, so that surface can't drift from this one either.
export function getBuildingCurrentPowerDraw(state, type, data, centerX, centerY) {
  if (FAN_TILES.has(type)) return FAN_STATS[type].powerCost;
  if (COLLECTOR_TILES.has(type)) {
    const activeItem = state.level.items.find(
      (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
    );
    return activeItem ? getCollectorPowerCostForItem(PROCESSOR_STATS[type], activeItem.type) : 0;
  }
  if (REFINERY_TILES.has(type)) return data && data.lockedRecipe !== null ? REFINERY_STATS[type].powerCostPerSec : 0;
  if (MANUFACTURER_TILES.has(type)) {
    if (!data || !data.processing) return 0;
    const recipe = MANUFACTURER_RECIPES[data.recipeId];
    const multiplier = (recipe && recipe.powerCostMultiplier) || 1;
    return (MANUFACTURER_ITEM_POWER_COST_MW[data.currentItemType] || 0) * multiplier;
  }
  if (TURRET_TILES.has(type)) {
    const stats = TURRET_STATS[type];
    if (!stats || stats.powerCostPerSec <= 0) return 0;
    // Bursty, not continuous — see computeCurrentPowerDemand's own comment
    // on why a turret's real demand is tracked as a running accumulator
    // instead of a per-tick snapshot. "Actively trying to draw power" here
    // means genuinely ready to fire (cooldown elapsed, ammo in hand) and
    // only blocked by the power gate itself — not idly waiting on its own
    // cooldown or simply out of ammo. Deliberately doesn't re-run the
    // nearest-alien search updateBuildings' own fire branch does (an
    // expensive scan this render pass shouldn't repeat per tile every
    // frame) — "ready to fire" is close enough to "trying."
    const hasAmmo = !TURRET_AMMO_TILES.has(type) || (data && data.ammoWaste + data.ammoBiomass > 0);
    return data && data.cooldownMs <= 0 && hasAmmo ? stats.powerCostPerSec : 0;
  }
  if (POWER_PLANT_TILES.has(type)) {
    // A generator, not a consumer — negative means "currently generating,"
    // distinct from 0 (idle/no recipe), so a caller that only cares about
    // consumption (e.g. the shortage overlay's own `> 0` check) naturally
    // ignores it.
    if (!data || !data.fueled || data.recipeId === null) return 0;
    return -(POWER_PLANT_RECIPES[data.recipeId].powerOutputMw);
  }
  return 0;
}


// A visibly obvious cue that a power-costing building is under-supplied —
// per direct request ("make it visually obvious when buildings aren't
// running because of electricity"). A soft red tint scales continuously with
// the deficit (invisible at 100% efficiency, strongest at 0%) so a partial
// slowdown still reads as "something's wrong" without needing to be a full
// stall; once efficiency drops low enough that the building has genuinely
// stopped, a pulsing lightning-bolt-with-slash badge makes that unambiguous
// rather than leaving the player to guess whether a faint tint means "a
// little behind" or "completely dead."
function renderPowerShortageOverlay(ctx, x, y, size, zoom, efficiency, elapsedMs) {
  const deficit = 1 - efficiency;
  if (deficit <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = 0.12 + deficit * 0.4;
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(x, y, size, size);
  ctx.restore();
  if (efficiency < POWER_SHORTAGE_STALLED_THRESHOLD) {
    const pulse = 0.55 + 0.45 * Math.sin(elapsedMs / 220);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.font = `${Math.max(10, size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', x + size / 2, y + size / 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, 2.6 * zoom);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.16, y + size * 0.84);
    ctx.lineTo(x + size * 0.84, y + size * 0.16);
    ctx.stroke();
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = Math.max(1, 1.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(x + size * 0.16, y + size * 0.84);
    ctx.lineTo(x + size * 0.84, y + size * 0.16);
    ctx.stroke();
    ctx.restore();
  }
}

// Fan-only now, per direct request ("all the arrows on the buildings are
// impossible to see and plan around. Let's remove the arrows and the need
// for a specific input side") — the Collector/Auto-Feeder/Turret's own
// two-arrow indicator (output + intake) is gone entirely, since those three
// building types no longer have a directional "input side" at all: Grid.js's
// updateBuildings now pulls in any eligible item touching them from ANY
// side (see isOnIntakeSide's retirement and the plain-radius intake checks
// there), so there's nothing left to indicate. A Fan still has a genuine
// aim direction the player actually chooses (its whole mechanic is a
// directional force cone), so it keeps its cone + aim arrow — `showCone`
// (default true) lets a caller suppress even that: per direct request, the
// Fan's ghost preview during the FIRST click's plain hover phase (before a
// placement cell is actually armed — see main.js's build-ghost render
// branch) draws no cone at all, since the angle at that point is just
// wherever the mouse happens to be relative to whatever tile it's currently
// over, not a real aim decision yet, and a cone swinging around during that
// phase read as "visually confusing... while trying to choose the fan
// location" per direct report. Once click 1 arms a cell (main.js's
// isFanAimingActive() branch), the cone reappears and rotates live with the
// cursor for the real aiming step.
function renderDirectionIndicator(ctx, type, x, y, size, angle, zoom, showCone = true) {
  if (!FAN_TILES.has(type) || !showCone) return;
  const cx = x + size / 2;
  const cy = y + size / 2;
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
// not (occupied, out of bounds, or unaffordable). `angle`/
// `showCone` (only relevant for a Fan now — see renderDirectionIndicator's
// own comment) draw the same aim cone the placed version gets, live-
// following the cursor's exact position within the tile. `showCone`
// defaults true; main.js passes false specifically for a Fan's plain-hover
// ghost, before a placement cell has actually been armed.
export function renderBuildGhost(ctx, state, worldX, worldY, buildingId, angle, showCone = true, ignoreCost = false) {
  const { col, row } = worldToTile(worldX, worldY);
  const check = canPlaceTile(state, col, row, buildingId, ignoreCost);
  const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
  const size = TILE_SIZE * state.camera.zoom;
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = check.ok ? '#8fe0b8' : '#ff6b6b';
  const localVerts = RAMP_TRIANGLE_LOCAL_VERTS[buildingId];
  if (localVerts) {
    // A Half Platform occupies only half its tile — the old plain fillRect
    // ghost showed a full square regardless, which didn't match the real
    // triangular wedge that actually gets placed. Draw the same triangle the
    // real tile renders (renderPlatformRamp) instead, so the ghost preview is
    // a true preview of the shape, not just where it'll sit.
    const verts = localVerts.map(([lx, ly]) => [screen.x + (lx / TILE_SIZE) * size, screen.y + (ly / TILE_SIZE) * size]);
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    ctx.lineTo(verts[1][0], verts[1][1]);
    ctx.lineTo(verts[2][0], verts[2][1]);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(screen.x, screen.y, size, size);
  }
  ctx.globalAlpha = 1;
  if (check.ok && FAN_TILES.has(buildingId)) {
    renderDirectionIndicator(ctx, buildingId, screen.x, screen.y, size, angle, state.camera.zoom, showCone);
  }
}

// The right-click-to-move mechanic's own ghost — per direct request, "a
// ghost copy of the building" rather than the plain flat-colored square
// renderBuildGhost's own new-placement ghost uses: a translucent copy of
// the ACTUAL building's hand-drawn art (renderTileShape, the exact same
// per-family icons a real placed tile renders with), snapped to the tile
// grid the same way every other ghost preview already does. `ignoreCost` is
// always true here (a move never costs money) — per direct clarification,
// the building's own ORIGINAL tile counts as a perfectly valid destination
// too, which falls out for free: main.js's pickUpBuildingForMove already
// vacated it the moment the move began, so canPlaceTile sees it as
// ordinary empty space like anywhere else. Tinted green when the hovered
// tile is currently legal, red otherwise.
export function renderMoveGhost(ctx, state, worldX, worldY, buildingId, buildingData) {
  const { col, row } = worldToTile(worldX, worldY);
  const check = canPlaceTile(state, col, row, buildingId, true);
  const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
  const size = TILE_SIZE * state.camera.zoom;
  const color = BUILDING_TYPES[buildingId].color;
  ctx.save();
  ctx.globalAlpha = 0.6;
  renderTileShape(ctx, buildingId, color, screen.x, screen.y, size, buildingData);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = check.ok ? '#7cff5a' : '#ff5a5a';
  ctx.fillRect(screen.x, screen.y, size, size);
  ctx.restore();
}

// Angle (atan2 convention) from a tile's center to an arbitrary world point
// — used by main.js's build-drag flow to derive a Fan/Auto-Feeder's aim from
// exactly where the cursor is within the tile at the moment of placement.
export function angleFromTileToPoint(col, row, worldX, worldY) {
  const cx = col * TILE_SIZE + TILE_SIZE / 2;
  const cy = row * TILE_SIZE + TILE_SIZE / 2;
  return Math.atan2(worldY - cy, worldX - cx);
}
