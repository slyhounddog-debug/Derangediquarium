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
  POWER_PLANT_RECIPES,
  POWER_PLANT_STATS,
  PROCESS_DOTS_COUNT,
  HUNGER_SEEK_THRESHOLD,
  CATALYST_BUFF_MULTIPLIER,
  CATALYST_BUFF_MULTIPLIER_MUTAGEN,
  CATALYST_FLASH_DURATION_MS,
  WASTE_TURRET_SHOTS_PER_WASTE,
  WASTE_TURRET_MAX_AMMO,
  WASTE_TURRET_MAX_WASTE,
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
  PLATFORM_FLAT_COST,
  BUILDING_COST_GROWTH_RATE_TIER1,
  BUILDING_COST_GROWTH_RATE_TIER2,
  BUILDING_COST_GROWTH_RATE_TIER3,
  NOTIFICATION_LOG_MAX,
  CLEANLINESS_MAX,
  CLEANLINESS_PER_WASTE_EVENT,
  CAMERA_BOTTOM_BUFFER_PX,
} from './Config.js';
import { worldToScreen } from './Engine.js';
import { playBuildPlace, playDemolish, playTurretShoot, playIntake, playDispense } from './Sound.js';

// One-time story/tutorial notifications — see state.level.tutorialFlags and
// CLAUDE.md's "Story & Tutorial Notifications" section.
const FIRST_BUILDING_PLACED_MESSAGE = "You just placed your first piece of seabed hardware. Welcome to factory brain — there's no swimming back from this now.";
const FIRST_FAN_PLACED_MESSAGE = 'fancy fan....oooo you fancy';

function pushGridNotification(state, text) {
  const notifications = state.level.notifications;
  notifications.push({ id: notifications.length + 1, text, elapsed: state.level.elapsed });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
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
const SOLID_TILES = new Set([
  TILE_PLATFORM, TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4,
  ...COLLECTOR_TILES, ...TURRET_TILES,
  ...REFINERY_TILES, ...MANUFACTURER_TILES, ...POWER_PLANT_TILES,
]);
const FAN_TILES = new Set([TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4]);

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

// Whether ANYTHING has been built on the grid, of any type — per direct
// request, gates the Demolish tool (nothing to gray a hammer icon for on an
// empty seabed). Deliberately a real tile scan, not a shortcut off
// state.level.buildingData's key count — a lone Platform never gets a
// buildingData entry at all (only Fans/Processors/Auto-Feeders/Turrets need
// one, for their per-instance angle/ammo/etc — see placeTile below), so that
// shortcut would wrongly report "nothing built" on a Platform-only grid.
// Early-returns on the first hit, so this stays cheap even on a busy grid.
export function hasAnyBuildingPlaced(state) {
  const grid = state.level.grid;
  for (let r = SEABED_ROW_START; r < WORLD_TILES_H; r++) {
    for (let c = 0; c < WORLD_TILES_W; c++) {
      if (grid[r][c] !== TILE_EMPTY) return true;
    }
  }
  return false;
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

// Every building's live shop cost — Platform is a flat PLATFORM_FLAT_COST
// regardless of how many exist; every other building's cost compounds at
// its own tiered rate for each tile of that exact type already placed,
// rounded up — see Config.js's comment above PLATFORM_FLAT_COST for the
// full rationale.
export function getBuildingCost(state, buildingId) {
  const building = BUILDING_TYPES[buildingId];
  if (!building) return Infinity;
  if (buildingId === TILE_PLATFORM) return PLATFORM_FLAT_COST;
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

// The "pick up" half of right-click-to-move (main.js's movingBuilding) — per
// direct request ("make it so that all other buildings can be right
// clicked... it creates a ghost copy of the building on the cursor"). Clears
// the tile and its buildingData entry with no refund and no sound (unlike
// removeTile, a genuine demolish), and hands the caller back everything
// needed to put it down again elsewhere unchanged. Returns null if there was
// nothing there to pick up. Deliberately does NOT need to do anything special
// to release an item the building was mid-processing/holding — per direct
// request ("moving any building spits out the items being processed or
// held, if any") — clearing the buildingData entry (and the tile's own type)
// is already exactly what stepHeldItem/stepCollectorProcessing's own
// defensive "the tile got torn down mid-hold" fallback checks for, so
// whatever it was holding is handed back to normal physics automatically on
// its very next tick, the same safety net a real demolish already relies on.
export function pickUpBuildingForMove(state, col, row) {
  const type = getTile(state.level.grid, col, row);
  if (type === TILE_EMPTY) return null;
  const key = buildingKey(col, row);
  const data = state.level.buildingData[key] || null;
  state.level.grid[row][col] = TILE_EMPTY;
  delete state.level.buildingData[key];
  return { type, data };
}

// The "put down" half — places a previously-picked-up building back at a
// (possibly new, possibly the exact same) location, completely free, with
// its own saved buildingData carried over untouched (ammo, recipe, progress,
// angle, etc.). Returns the same { ok, reason } shape canPlaceTile does, so
// callers can show a real failure reason (handleBuildPlacementFailure)
// without a placement actually happening.
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
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, angle };
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
    // updateBuildings' turret-fire branch.
    state.level.buildingData[buildingKey(col, row)] = { type: buildingId, ammo: 0, cooldownMs: 0, aimAngle: -Math.PI / 2 };
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

// T debug key — cycles the tile under the cursor through every building type
// (plus empty) for free, ignoring cost/occupancy/anchoring. Fans default to
// pointing straight up (toward the water column) since that's the most
// useful direction to test filtration with.
const CHEAT_CYCLE = [
  TILE_EMPTY, TILE_PLATFORM,
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
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE };
  } else if (COLLECTOR_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, angle: CHEAT_DEFAULT_ANGLE };
  } else if (TURRET_TILES.has(next)) {
    // Cheat-cycled turrets start pre-loaded with max ammo (any ammo-consuming
    // tier — see TURRET_AMMO_TILES) so testing combat doesn't require
    // grinding real Waste first.
    state.level.buildingData[buildingKey(col, row)] = { type: next, ammo: TURRET_AMMO_TILES.has(next) ? WASTE_TURRET_MAX_AMMO : 0, cooldownMs: 0, aimAngle: -Math.PI / 2 };
  } else if (REFINERY_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, lockedRecipe: null, progressMs: 0, heldItemId: null };
  } else if (MANUFACTURER_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = {
      type: next, recipeId: null, pendingInputs: [], processing: false,
      currentItemType: null, progressMs: 0, ghostFlashTimerMs: 0, heldItemId: null,
    };
  } else if (POWER_PLANT_TILES.has(next)) {
    state.level.buildingData[buildingKey(col, row)] = { type: next, recipeId: null, fueled: false, progressMs: 0 };
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
  const efficiency = state.level.powerEfficiency;
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
  }
  return { landed: false };
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
  item.x += (item.collectorCenterX - item.x) * COLLECTOR_PULL_STRENGTH * dt;
  item.y += (item.collectorCenterY - item.y) * COLLECTOR_PULL_STRENGTH * dt;
  // A free base Collector (powerCostPerSec 0) always finishes at full speed;
  // an Electric/Advanced tier's progress genuinely stalls at 0% grid
  // efficiency instead of just running slower forever — matches "buildings
  // using electricity should stop working" once supply can't cover demand.
  const appliedEfficiency = PROCESSOR_STATS[tileType].powerCostPerSec > 0 ? state.level.powerEfficiency : 1;
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
  const grid = state.level.grid;

  if (item.collectorProgressMs != null) return stepCollectorProcessing(item, state, dt);
  // A Refinery/Manufacturer-held item never reports 'consumed' from here —
  // updateBuildings' own Refinery/Manufacturer branch is what actually
  // splices it out of state.level.items, the instant ITS OWN progress timer
  // (tracked on the building, not the item) completes. See stepHeldItem's
  // own comment for why the two mechanisms differ.
  if (item.heldByKey != null) return stepHeldItem(item, state, dt);

  const fanForce = computeFanForce(state, item);
  integrateItemForces(item, dt, physics, fanForce);

  // Horizontal: swept against solid tiles so it can't tunnel sideways into one.
  const nextX = item.x + item.vx * dt;
  if (isSolid(tileAt(grid, nextX, item.y))) item.vx = 0;
  else item.x = nextX;

  // Vertical: swept tile landing, same as before.
  const result = sweepVertical(item, grid, item.vy * dt);
  if (result.landed) return handleLanding();

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

// Starts the same pull-to-center hold stepCollectorProcessing eases through
// every tick — previously only ever kicked off by a top-landing event
// (handleLanding); now triggered by updateBuildings' intake scan below
// instead, since a Collector no longer accepts a plain top-landing as a
// valid entry at all.
function beginCollectorProcessing(item, centerX, centerY, tileType) {
  item.collectorCenterX = centerX;
  item.collectorCenterY = centerY;
  item.collectorProgressMs = 0;
  // A coin and a Science Bubble take different amounts of time on the same
  // tile, and that time shrinks per tier — see Config.js's PROCESSOR_STATS.
  // Green Science shares blue's own scienceMs (see the intake scan above).
  const stats = PROCESSOR_STATS[tileType];
  item.collectorTargetMs = (item.type === 'science' || item.type === 'science_green') ? stats.scienceMs : stats.coinMs;
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
  const items = state.level.items;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const [row, col] = key.split(',').map(Number);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;

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
      // Refill — sucks in any Waste item touching it, same radius-from-center
      // intake pattern the Collector/Auto-Feeder just got, converting it
      // straight to WASTE_TURRET_SHOTS_PER_WASTE ammo instead of holding it
      // for a timed process. Applies to any tile in TURRET_AMMO_TILES (the
      // Waste Turret AND the Electric Waste Turret, per direct request — it
      // "takes waste as ammo just like the waste turret"); the Advanced tier
      // never reads `ammo` at all — unlimited ammo, a power cost instead.
      if (TURRET_AMMO_TILES.has(data.type) && data.ammo < WASTE_TURRET_MAX_AMMO) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.type !== 'waste') continue;
          // A real touch test, not a fixed radius-from-center — see
          // isTouchingBuildingTile's own comment for why: a waste item
          // resting near a corner (including the top edge, which used to
          // sit just outside the old fixed-radius check) still counts.
          if (isTouchingBuildingTile(centerX, centerY, it.x, it.y, it.radius)) {
            items.splice(i, 1);
            data.ammo = Math.min(WASTE_TURRET_MAX_AMMO, data.ammo + WASTE_TURRET_SHOTS_PER_WASTE);
            playIntake();
            // Cross-module flag (UI.js reads/clears it next frame — see
            // main.js's state.ui.wasteTurretAmmoGainedPending for why this
            // isn't just a direct call) — advances the "drag Waste into the
            // Turret" guided-tutorial step, regardless of whether this
            // particular Waste got here by an active drag or just drifted
            // in naturally.
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
      const hasAmmo = !TURRET_AMMO_TILES.has(data.type) || data.ammo > 0;
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
          turretShots.push({ x: centerX, y: centerY, targetId: nearestAlien.id, damage: turretStats.damage });
          nearestAlien.reservedDamage = (nearestAlien.reservedDamage || 0) + turretStats.damage;
          data.cooldownMs = 1000 / (turretStats.shotsPerSec * getTurretFireRateMultiplier(state));
          if (TURRET_AMMO_TILES.has(data.type)) data.ammo -= 1;
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
    // center, same fixed point the old Auto-Feeder always used.
    const bioOutputX = centerX;
    const bioOutputY = centerY - TILE_SIZE * BUILDING_OUTPUT_PORT_OFFSET_FRACTION;

    if (REFINERY_TILES.has(data.type)) {
      const stats = REFINERY_STATS[data.type];
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
        // Every ingredient type now costs SOME power to process (10-35mw,
        // see MANUFACTURER_ITEM_POWER_COST_MW) — unlike before, there's no
        // "unpowered" case left to special-case here, so this always
        // applies the grid's live efficiency while actively processing.
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
  }
  return { foodSpawnPoints, wasteSpawnPoints, turretShots, bioSpawnPoints };
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
      const activelyProcessing = items.some(
        (it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY
      );
      if (activelyProcessing) demand += PROCESSOR_STATS[data.type].powerCostPerSec;
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
          renderTurretAmmoDots(ctx, screen.x, screen.y, size, data.ammo, camera.zoom);
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
        if (getBuildingPowerCost(type, data) > 0) {
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
function renderTileShape(ctx, type, color, x, y, size, data) {
  if (type === TILE_PLATFORM) {
    renderBrickPattern(ctx, x, y, size, color);
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
  } else if (REFINERY_TILES.has(type)) {
    renderRefineryIcon(ctx, x, y, size, color);
    renderTierBadge(ctx, type, x, y, size);
  } else if (type === TILE_MANUFACTURER) {
    renderManufacturerIcon(ctx, x, y, size, color);
  } else if (type === TILE_POWER_PLANT) {
    renderPowerPlantIcon(ctx, x, y, size, color);
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

// A small "not drawing power" badge in the Manufacturer's bottom-right
// corner — a dark circle, a dim lightning bolt, and a red slash through it,
// same visual language renderPowerShortageOverlay's own stalled badge
// already established (crossed lightning = "not running"), just scoped to
// this ONE tile's own instantaneous draw rather than grid-wide supply.
function renderManufacturerIdleBadge(ctx, x, y, size, zoom) {
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
  ctx.fillText('⚡', cx, cy);
  ctx.strokeStyle = '#ff5a5a';
  ctx.lineWidth = Math.max(1, 1.3 * zoom);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy + r * 0.6);
  ctx.lineTo(cx + r * 0.6, cy - r * 0.6);
  ctx.stroke();
  ctx.restore();
}

// 5 dots on the Waste Turret — one per stored Waste unit, per direct
// request ("with dots indicating each waste/10 ammo"). Ammo drains one shot
// at a time (not in clean blocks of 10), so a dot stays "lit" until the very
// last shot of its own 10-shot block is spent — Math.ceil, not a plain
// division — reading as "how many loads are still stored" rather than
// jumping to the next dot down mid-block.
function renderTurretAmmoDots(ctx, x, y, size, ammo, zoom) {
  const litDots = Math.ceil(ammo / WASTE_TURRET_SHOTS_PER_WASTE);
  const dotRadius = Math.max(1.5, size * 0.055);
  const gap = dotRadius * 2.6;
  const totalWidth = (WASTE_TURRET_MAX_WASTE - 1) * gap;
  const startX = x + size / 2 - totalWidth / 2;
  const dotY = y + size * 0.14;
  for (let i = 0; i < WASTE_TURRET_MAX_WASTE; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = i < litDots ? '#ffe066' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.max(0.5, zoom * 0.5);
    ctx.stroke();
  }
}

// A tile's own power draw rate RIGHT NOW, regardless of building type — 0
// for a free tier, a non-power building, or (for the Manufacturer
// specifically) one that isn't actively processing an ingredient this tick.
// Shared by the render overlay below and anywhere else that just needs
// "does this specific tile cost power at all." `data` is only actually read
// for the Manufacturer's own per-item rate — every other lookup is a flat,
// data-independent constant.
function getBuildingPowerCost(type, data) {
  if (FAN_STATS[type]) return FAN_STATS[type].powerCost;
  if (PROCESSOR_STATS[type]) return PROCESSOR_STATS[type].powerCostPerSec;
  if (REFINERY_STATS[type]) return REFINERY_STATS[type].powerCostPerSec;
  if (TURRET_STATS[type]) return TURRET_STATS[type].powerCostPerSec;
  if (MANUFACTURER_TILES.has(type)) {
    return data && data.processing ? MANUFACTURER_ITEM_POWER_COST_MW[data.currentItemType] || 0 : 0;
  }
  // POWER_PLANT_STATS has no powerCostPerSec field at all (it's a generator,
  // never a consumer) — falls through to the 0 default below.
  return 0;
}

// Below this live grid efficiency, a power-costing building has genuinely
// stopped doing useful work (not just running a bit slower) — see Grid.js's
// computePowerEfficiency and every applied-efficiency gate above (Fan force,
// Processor/Refinery/Manufacturer progress, Turret cooldown).
const POWER_SHORTAGE_STALLED_THRESHOLD = 0.15;

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
  ctx.fillRect(screen.x, screen.y, size, size);
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
