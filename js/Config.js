// ============================================================
// Derangiquarium — Config.js
// All balance numbers and world constants live here (§3.6 of the
// build spec). No magic numbers in system files — Engine/Entities/
// Grid/Systems/UI all import what they need from this file.
// ============================================================

// ---- World & coordinate constants (§3.3) ----
export const TILE_SIZE = 32; // px per tile — every coordinate transform is built on this
// Shrunk from 160 to 60 tiles (5120px -> 1920px), per direct request — "reduce
// the width of the tank to just the width of a full screen monitor, there
// doesn't need to be a left or right movement of the viewport. Only up and
// down." 1920px matches a common full-HD monitor width almost exactly; on a
// wider/taller window the shortfall reads as empty margin either side
// (Engine.js's updateCamera centers the world horizontally instead of
// pinning it to the left edge when WORLD_W < the viewport), and on a
// narrower one it's cropped slightly — inherent to any fixed-width world,
// same tradeoff a print page or a fixed-width game canvas always makes.
// Horizontal camera panning (WASD/arrow-key and horizontal wheel/trackpad)
// is removed entirely in Engine.js — camera.x is now purely derived from the
// viewport width, never accumulated from input. See also Ambience.js's
// BUBBLE_COUNT/SEAWEED_COUNT, both scaled down by the same ~0.375 ratio so
// bubble/seaweed density (per px of width) stays what it was before, rather
// than reading 2.67x busier crammed into a much narrower column.
// 56 tiles — narrowed 2 tiles further on each side per direct follow-up
// request ("reduce the width of the tank... 2 tiles narrower on both
// sides"), from the 60 an earlier pass shrank it to. Nothing else needed
// touching for this: the whole coordinate system is derived from this one
// constant (Engine.js's updateCamera centers the world around it, Mound.js's
// MOUND_X is WORLD_W/2, every random spawn position in Ambience.js is
// Math.random()*WORLD_W) with no fixed absolute-pixel reference anywhere, so
// shrinking it narrows both edges symmetrically for free.
export const WORLD_TILES_W = 56;
// Per direct request ("shorter tank, 18 tile city and 20% shorter upper
// tank, keeping the seaweed the same height") — both halves of the tank
// shrink: the seabed city drops from 20 rows to 18, and the water column
// above it drops from 27 rows to 22 (27 * 0.8 = 21.6, rounded to the
// nearest whole tile — there's no such thing as a fractional tile row).
// Then, per a LATER direct follow-up request ("reduce the starting height
// to 16 tiles"), the base city height shrinks again, 18 -> 16 (the water
// column is untouched by this second pass). Seaweed itself needs no change
// to "keep the same height" through either pass — Ambience.js's
// SEAWEED_MIN/MAX_HEIGHT are already fixed pixel values anchored to
// SEABED_FLOOR_Y (the water/seabed boundary), not a fraction of the water
// column, so they automatically stay exactly as tall as before; they just
// reach higher up the (now shorter) column in relative terms.
//
// ---- Tank Expansion (Tank Points upgrade progression) ----
// Per direct request: a 5-tier Tank Upgrades panel purchase, each tier
// permanently adding TANK_EXPANSION_ROWS_PER_TIER more buildable seabed rows
// onto the bottom of the city (16 -> 26 at tier 5, per the same "reduce
// starting height to 16... upgrades can make the full height 26" request
// that shrank the base above — TANK_EXPANSION_ROWS_PER_TIER *
// TANK_EXPANSION_MAX_TIER stayed 2*5=10 either way, only the BASE moved).
// Rather than resizing state.level.grid at runtime (WORLD_TILES_H/
// WORLD_TILES_W are read as hard array-bounds checks in 40+ places across
// Grid.js alone — actually growing the array live would mean re-auditing
// every one of them, the exact scope that got "narrow the tank" skipped
// earlier), the grid is allocated at its FULLY-EXPANDED size up front and a
// separate, additive gate — state.level.tankExpansionTier, see Grid.js's
// getUnlockedSeabedRowEnd — controls how much of that already-allocated
// space is actually reachable: canPlaceTile rejects building beyond the
// unlocked line. Per a LATER direct follow-up request ("the actual bottom
// of the tank needs to be the correct bottom height instead of always stuck
// at [the max]... objects should fall just the unlocked tiles"), the
// not-yet-unlocked rows are no longer just fogged-but-scrollable-into either
// — Grid.js's getUnlockedWorldH is now the REAL runtime bottom every
// camera/physics/render calculation uses (WORLD_TILES_H/WORLD_H below are
// ONLY the fixed max the grid array/absolute bounds checks are sized to),
// so the locked rows are never actually reachable or visible at all until
// unlocked, the same as if the tank simply ended there.
export const TANK_EXPANSION_ROWS_PER_TIER = 2;
export const TANK_EXPANSION_MAX_TIER = 5;
export const TANK_EXPANSION_UPGRADE_COSTS = [15, 30, 50, 75, 100]; // Tank Points, cost of tiers 1..5 respectively — scaled above Fish Movement's top cost (35) since this is a bigger, permanent structural unlock
export const WORLD_TILES_H = 38 + TANK_EXPANSION_ROWS_PER_TIER * TANK_EXPANSION_MAX_TIER; // 48 — fully-expanded size (22 water + 26 city); see tank expansion comment above for how much of this is actually unlocked/reachable at any given tier
// The last row unlocked at tier 0 (22 water rows + 16 base city rows - 1) —
// Grid.js's getUnlockedSeabedRowEnd adds TANK_EXPANSION_ROWS_PER_TIER *
// state.level.tankExpansionTier on top of this.
export const TANK_EXPANSION_BASE_ROW_END = WORLD_TILES_H - 1 - TANK_EXPANSION_ROWS_PER_TIER * TANK_EXPANSION_MAX_TIER;
export const WORLD_W = WORLD_TILES_W * TILE_SIZE; // 1792px
export const WORLD_H = WORLD_TILES_H * TILE_SIZE; // fully-expanded max — see Grid.js's getUnlockedWorldH for the real runtime bottom

export const SEABED_ROW_START = 22; // first seabed tile row; rows 0-21 are water column
export const SEABED_ROW_END = WORLD_TILES_H - 1; // last seabed tile row (47, at the fully-expanded max)
export const SEABED_FLOOR_Y = SEABED_ROW_START * TILE_SIZE; // world-y of the water/seabed boundary — Phase 1 renders this as a flat floor, Phase 2 replaces it with real tiles, but everything reads this one constant
// A pure-visual strip the camera can scroll past the world's real bottom
// edge (WORLD_H) into, per direct request — a permanent home for the fixed
// bottom tool-bar (see UI.js/index.html's #bottom-tool-bar) that never
// covers real gameplay content, even when the player's scrolled all the way
// down. Deliberately NOT extra tile rows — state.level.grid stays exactly
// WORLD_TILES_H rows, so nothing can ever be built down there (canPlaceTile
// already rejects any row >= WORLD_TILES_H) and no new physics/grid code is
// needed at all. Grid.js's renderSeabedGrid already fills the seabed color
// all the way to the bottom of the canvas regardless of true world bounds,
// so this buffer reads as "the same city floor" for free; the only new
// render step is the black gradient Grid.js's renderCameraBottomBuffer adds
// on top. Cut from 220 to 156 (2 tiles' worth of px) per an earlier direct
// request that the buffer "is a little too tall" — those 2 tiles moved into
// WORLD_TILES_H above instead, as real buildable seabed rather than dead
// visual padding. Cut again, 156 -> 100, per a later direct request ("it's
// too tall right now... just slightly bigger than the toolbar") — this time
// NOT compensated by moving tiles into WORLD_TILES_H, since this pass is
// purely "make the buffer itself shorter," not "reclaim buildable space."
// Bumped back up slightly, 100 -> 105 (+5%), per a still-later direct
// request ("make the toolbar area at the bottom 5% taller"), then again,
// 105 -> 126 (+20%), per direct request once items started falling all the
// way to the world's real bottom edge instead of stopping partway down at
// the old Rocky Shelf — "add a small visual buffer now that everything will
// fall to the bottom of the tank." See Grid.js's renderCameraBottomBuffer
// for what fills it.
export const CAMERA_BOTTOM_BUFFER_PX = 126;
// The old Rocky Shelf — a fixed rest height 4 tiles above the world's
// absolute bottom that nothing (coins, Science Bubbles, Food, Waste) fell
// past, splitting the seabed into a visually distinct "city" and
// "underground" — is gone entirely per direct request ("remove the upper
// and lower sections of the city... make it all the same section... food,
// money, waste, and science should all fall to the very bottom of the
// tank"). Grid.js's sweepVertical now stops everything at WORLD_H itself
// instead; the underground/city split is now purely a color gradient on one
// unified fill (see Grid.js's renderSeabedGrid), no physical barrier at all.

// ---- Seabed grid tile types (Phase 2) ----
// state.level.grid is a full WORLD_TILES_H x WORLD_TILES_W array of these
// ids (rows 0-26 exist but are never placed into — only SEABED_ROW_START.. are
// reachable from build mode). Absolute indexing (not seabed-relative) keeps
// every row/col calc a single division by TILE_SIZE, no offset to remember.
export const TILE_EMPTY = 'empty'; // passable — items fall straight through
export const TILE_PLATFORM = 'platform'; // solid — items land and rest on top. Purely an optional routing aid now (a cheap flat surface to catch a falling item before a Fan/Processor grabs it) — placement no longer requires anything to anchor to it; see Grid.js's canPlaceTile.
// Four Half Platform variants, per direct request — each a real 45-degree
// ramp wedge occupying only the solid triangular half of the tile (see
// Grid.js's RAMP_TRIANGLE_VERTS for the exact collision geometry — a genuine
// circle-vs-triangle collision, not a flat top). Left/Right are the
// "floor-level" pair, cut along the tile's own natural (top-left -> bottom-
// right / top-right -> bottom-left) diagonal, tall on one side tapering to
// nothing on the other — Right is tall-left/open-top-right (an object
// sliding down its slope moves down-and-RIGHT), Left is the mirror
// (down-and-LEFT). Top Left/Top Right are each the exact COMPLEMENTARY
// triangle within the same square, mirrored across that same diagonal —
// solid where Right/Left are open and vice versa — per direct request ("Top
// Left and Top Right, as mirrored versions (along the diagonal line) of the
// 2 half platforms currently... act like the other two corner pieces
// opposite the left and right platforms"). Together, Right+TopRight (or
// Left+TopLeft) exactly tile a full square split along one diagonal, which
// is what makes all 4 usable as a real routing system: a Top piece deflects
// something falling from above sideways, a Bottom (Left/Right) piece
// deflects something moving along the floor up onto/off of a ledge — mixed
// together they can route an item through a zigzag "pipe" of ramps. All 5
// Platform variants share one shop slot (BUILDING_FAMILIES.platform) and
// cycle by clicking it again or pressing R while one is selected — see
// UI.js's cycleSelectedBuildingFamily.
export const TILE_PLATFORM_HALF_LEFT = 'platform_half_left';
export const TILE_PLATFORM_HALF_RIGHT = 'platform_half_right';
export const TILE_PLATFORM_HALF_TOPLEFT = 'platform_half_topleft';
export const TILE_PLATFORM_HALF_TOPRIGHT = 'platform_half_topright';
export const TILE_COLLECTOR = 'collector'; // solid — the base Processor: items landing here are immediately consumed (coins auto-banked)
export const TILE_COLLECTOR_ELECTRIC = 'collector_electric'; // solid — Electric Processor, faster processing, draws power — see PROCESSOR_STATS
export const TILE_COLLECTOR_ADVANCED = 'collector_advanced'; // solid — Advanced Processor, bought in the Science Lab — see PROCESSOR_STATS
export const TILE_FAN_T2 = 'fan_t2'; // solid — Rudimentary Fan (unlocked at the Mound's Tier 1.75, free, short reach/low force)
export const TILE_FAN_T3 = 'fan_t3'; // solid — Electric Fan (Tier 3, draws power, medium reach/force)
export const TILE_FAN_T4 = 'fan_t4'; // solid — Turbo Fan (Tier 4, draws power, long reach/extreme force)
// Auto-Feeder — REMOVED, per direct request ("have the refinery completely
// replace the auto-feeder"). The Refinery's own 4-tier family (below) now
// fills the exact "Waste -> Food" role the Auto-Feeder used to, at every
// tier the Auto-Feeder used to have plus a new top Bio-Refinery tier.
// ---- Turrets (Alien Invasion) ----
// Placed exactly like a Collector or Auto-Feeder (same simple single-click
// flow, same placement rule — see canPlaceTile, nothing turret-specific
// needed there). Unlike those two, a Turret has no aim/intake side at all —
// it auto-targets whatever alien is nearest within TURRET_STATS[type].range,
// same "no directional input side" simplification the Collector/Auto-Feeder
// just got. The Waste Turret is granted at Tier 1 alongside Platform itself
// (unlockedByDefault: true — see its BUILDING_TYPES row), per direct
// request ("give the waste turret at the very beginning of the game with
// the platforms") — the only weapon against aliens before the Science Lab
// exists. Electric/Advanced Turret are Science Lab purchases, same pattern
// as Electric/Advanced Fan.
export const TILE_TURRET_WASTE = 'turret_waste'; // solid — free from the start; ammo comes from consumed Waste, see WASTE_TURRET_SHOTS_PER_WASTE/WASTE_TURRET_MAX_WASTE
export const TILE_TURRET_ELECTRIC = 'turret_electric'; // solid — Science Lab purchase (requires the Eel), unlimited ammo, draws power per shot
export const TILE_TURRET_ADVANCED = 'turret_advanced'; // solid — Science Lab purchase (requires the Electric Turret), strongest tier
// ---- Storage Chest ----
// Per direct request — a pure buffer building: auto-locks onto whichever
// item type first touches it (like the Refinery's own first-touch recipe
// lock), holds up to STORAGE_CHEST_CAPACITY[type] of that ONE type, and only
// ever gives them back via a player-armed auto-trickle (a drag gesture, see
// main.js) or the chest popup's "Clear Chest" button — never automatically.
// Tier 1 is the reward for the Mound's own $75 "tease" step, no longer a
// pure joke (see Mound.js's crackMound); Tiers 2/3 are Science Lab
// purchases gated on Bubble Cap 20/40 respectively (see SCIENCE_LAB_UPGRADES'
// storage_chest_t2/_t3 below).
export const TILE_STORAGE_CHEST = 'storage_chest';
export const TILE_STORAGE_CHEST_T2 = 'storage_chest_t2';
export const TILE_STORAGE_CHEST_T3 = 'storage_chest_t3';
// Per direct spec (30/60/100) — Grid.js's updateBuildings reads this by the
// tile's own type for its intake cap; UI.js's chest popup reads it too, for
// the live "N / Capacity" readout.
export const STORAGE_CHEST_CAPACITY = {
  [TILE_STORAGE_CHEST]: 30,
  [TILE_STORAGE_CHEST_T2]: 60,
  [TILE_STORAGE_CHEST_T3]: 100,
};

// ---- Bio-Building production chain (Bio-Sludge -> Biomass -> Mutagen Paste / Blue Science) ----
// Four new buildings, each a single standalone tier (no family stacking).
// Granted two different ways: the Refinery via the real Tier 1->2 Mound
// crack (TIER_UNLOCKS[2]) — it's the foundational recycler the rest of the
// chain builds on, and its own two recipes (Waste->Food, a straight
// alternative to the Auto-Feeder; Bio-Sludge->Biomass) are both usable well
// before the Science Lab exists, so there's no reason to gate it behind the
// Lab too. The other three are Science Lab nodes — see SCIENCE_LAB_UPGRADES.
// Refinery family — 3 tiers now (base/Electric/Advanced), per direct
// request replacing the Auto-Feeder entirely. Every tier: single input, 2
// possible recipes (Waste->Food, Bio-Sludge->Biomass, Bio-Sludge taking
// ALIEN_DNA_REFINERY_TIME_MULTIPLIER longer than the Waste recipe) — see
// Grid.js's updateBuildings and REFINERY_STATS below. The base tier is
// granted at the real Tier 1->2 Mound crack (unchanged); Electric/Advanced
// are Science Lab purchases (see SCIENCE_LAB_UPGRADES). The old 4th tier,
// Ultra Refinery (TILE_REFINERY_BIO), is removed entirely per direct
// request ("remove the Ultra Refinery from the game") — Bio Refinery
// (TILE_REFINERY_ADVANCED) now occupies its old slot in the Science Lab
// tree, at its old cost, with its old stats (see SCIENCE_LAB_UPGRADES'
// bio_refinery node and REFINERY_STATS below).
export const TILE_REFINERY = 'refinery';
export const TILE_REFINERY_ELECTRIC = 'refinery_electric';
export const TILE_REFINERY_ADVANCED = 'refinery_advanced';
// Manufacturer — replaces the old single-purpose Bio-Feeder/Bio-Combuster
// buildings with ONE building whose behavior is chosen after placement via a
// recipe pop-up menu (see UI.js's openRecipeMenu) — per direct request,
// "combine the bio-feeder and the bio-combustor into the same building...
// in the form of recipes." Does nothing and draws no power until a recipe is
// picked. See MANUFACTURER_RECIPES/MANUFACTURER_ITEM_PROCESS_MS below.
export const TILE_MANUFACTURER = 'manufacturer';
// Power Plant — renamed from Bio-Reactor, per direct request, and given the
// same recipe-pop-up makeover as the Manufacturer. Consumes one fuel item
// (Food/Biomass/Blue Science, whichever recipe is selected) for a flat power
// dump into the grid — not an item router at all. See POWER_PLANT_RECIPES
// below.
export const TILE_POWER_PLANT = 'power_plant';

// Fish stay clear of the outer edges of the water column when spawning —
// both the random spawn position on a shop purchase in UI.js, and (for
// left/right/top only) the movement clamp in Entities.js, use these bounds.
// The BOTTOM movement bound is deliberately not FISH_MAX_Y: fish need to be
// able to swim all the way down to the true floor (SEABED_FLOOR_Y) to reach
// food/coins resting there, even though they still won't spawn that low.
export const FISH_HORIZONTAL_MARGIN_FRACTION = 0.10; // stays clear of the outer 10% on the left and right
export const FISH_VERTICAL_MARGIN_FRACTION = 0.05; // stays clear of the outer 5% on the top and bottom (of the water column, not the full world)
export const FISH_MIN_X = WORLD_W * FISH_HORIZONTAL_MARGIN_FRACTION;
export const FISH_MAX_X = WORLD_W * (1 - FISH_HORIZONTAL_MARGIN_FRACTION);
export const FISH_MIN_Y = SEABED_FLOOR_Y * FISH_VERTICAL_MARGIN_FRACTION;
// Per direct report ("aliens can spawn too high vertically so they are not
// on the screen when they spawn... make it so they will always spawn 10%
// lower than the top of the tank so they don't end up behind the HUD/
// Chat") — a separate, more generous floor than FISH_MIN_Y's 5% specifically
// for where an alien portal is allowed to roll (Systems.js's spawnAlienWave).
// Purely a spawn-position minimum, not a movement clamp — same "spawn-only"
// relationship FISH_MIN_Y already has to fish movement.
export const ALIEN_SPAWN_MIN_Y = SEABED_FLOOR_Y * 0.10;
export const FISH_MAX_Y = SEABED_FLOOR_Y * (1 - FISH_VERTICAL_MARGIN_FRACTION); // spawn-only now — see note above
// A shop purchase spawns within whatever's currently on screen (camera
// position + viewport size, from state.camera), inset by this much on each
// side — not just "somewhere in the tank," which could land far off camera
// and read as the fish never having appeared at all.
export const FISH_SPAWN_VIEW_INSET_FRACTION = 0.15;

// ---- Simulation timing (§3.4) ----
export const SIM_HZ = 60;
export const SIM_DT_MS = 1000 / SIM_HZ; // fixed sim step; gravity/physics must always use this, never a variable rAF delta
export const MAX_FRAME_SKIP = 15; // max fixed steps per rendered frame; must clear the top TIME_SCALE_STEPS entry (10) with headroom so 10x speed never gets clamped, while still bounding a post-stall catch-up burst
export const TIME_SCALE_STEPS = [0, 1, 2, 5, 10]; // cycled by +/- ; 0 = pause
export const DEFAULT_TIME_SCALE_INDEX = 1; // starts at 1x

// ---- Camera (§3.3) ----
export const CAMERA_PAN_SPEED = 500; // world px/sec for WASD/arrow pan
export const CAMERA_WATER_COLUMN_FIT_FRACTION = 0.85; // the default zoom fits the water column into this fraction of the viewport height (not all of it) — the remaining 15% shows a peek of the seabed city below, so resting items don't look like they float at the bottom edge and the player can see there's more to scroll to
// Panning is deliberately never triggered by mouse position (edge-scroll)
// — it kept firing by accident during normal play (moving toward the
// bottom of the screen to click a coin, etc). The mouse wheel is the other
// way to pan, alongside WASD/arrows; this scales its raw pixel delta.
export const CAMERA_SCROLL_SENSITIVITY = 0.7;

// ---- Physics ----
// Coins are dense metal — they sink straight down at this rate.
export const GRAVITY = 88; // world px/sec^2 fall acceleration — 20% slower than the original 110, part of a general de-frantic-ing pass
export const MAX_FALL_SPEED = 72; // terminal velocity, px/sec — 20% slower than the original 90
// Food is a light pellet the water pushes around — falls at half a coin's
// rate and wavers side to side as it sinks instead of dropping straight
// down. See FOOD_WAVE_* below.
export const FOOD_GRAVITY = 33; // 25% slower again on top of the earlier 20% cut (was 44) — part of a general de-pacing pass, see CLAUDE.md
export const FOOD_MAX_FALL_SPEED = 27; // 25% slower again on top of the earlier 20% cut (was 36)
// Food sways continuously as it falls — a straight sine wobble on its
// horizontal velocity, the same underlying idea Ambience.js's bubbles
// already use for their own left-right drift, per direct request to make
// the two consistent. Replaces an earlier "discrete scheduled sway bursts
// timed against an estimated total fall duration" scheme that didn't hold
// up — the estimate went wrong the moment a Fan actually touched the
// pellet's real trajectory, and pre-scheduling events up front made the
// whole thing rigid to begin with. This version needs no schedule at all:
// item.fallTime just accumulates every tick it's in open water (unchanged),
// and swayVx is recomputed fresh from it and a per-item random phase every
// single tick — self-correcting no matter what the item's actual fall looks
// like. FOOD_SWAY_AMPLITUDE is the peak sideways speed; FOOD_SWAY_FREQUENCY
// is in full left-right-left cycles per second.
export const FOOD_SWAY_AMPLITUDE = 24; // px/sec — the peak, only actually reached at the crest of a sway burst; see FOOD_SWAY_ENVELOPE_FREQUENCY below
export const FOOD_SWAY_FREQUENCY = 0.22; // Hz — was 0.35, slowed down per direct request for "less frequently"
// Per direct request ("less frequently and more sporadically"), the sway
// isn't one constant-amplitude wobble any more — a second, much slower sine
// (the "envelope") modulates the amplitude via max(0, sin(...))^2, so any
// given stretch of the fall alternates between long near-zero-sway
// stretches and shorter swelling-then-fading bursts of actual wobble,
// reading as occasional/sporadic rather than continuous — without
// reintroducing the fragile pre-scheduled-events system this replaced
// (still just a function of fallTime + a random phase, recomputed fresh
// every tick, nothing scheduled up front to go stale).
export const FOOD_SWAY_ENVELOPE_FREQUENCY = 0.06; // Hz — one swell-and-fade cycle takes ~16-17 seconds
// Waste gets the same treatment but "to a less degree" per direct request —
// it's a denser byproduct, not a light drifting pellet, so it should read
// as barely swaying rather than genuinely wavering.
export const WASTE_SWAY_AMPLITUDE = 9; // px/sec
export const WASTE_SWAY_FREQUENCY = 0.3; // Hz

// ---- Seabed grid item physics (Phase 2) ----
// Once an item's y crosses SEABED_FLOOR_Y, Grid.js takes over its motion
// from Entities.js's plain gravity (see Grid.js's stepItemOnGrid). Falling
// still uses the item's own GRAVITY/MAX_FALL_SPEED or FOOD_GRAVITY/
// FOOD_MAX_FALL_SPEED — these three below are the tile-interaction speeds.
export const GRID_SWEEP_SUBSTEP = TILE_SIZE / 4; // px — every swept move is walked in steps this small, so a fast-falling item can never skip clean over a landing tile in one step, at any of the fall speeds above
// ---- Directional Fans (Seabed Platform architecture) ----
// A Fan is a directional force emitter, not a landing-triggered launcher —
// see CLAUDE.md's "Directional Fans" section. Its aim angle is captured once
// at placement time (locked toward wherever the cursor was within the tile
// when it was placed — see Grid.js's placeTile/UI build-drag flow) and
// stored per-instance in state.level.buildingData, since a plain grid-cell
// id string has nowhere to hold it. Every tick, Grid.js's computeFanForce
// sums a force vector from every powered fan whose cone currently contains a
// given item — this applies everywhere, not just the seabed band, since a
// fan's whole point is launching items back up into open water where fish
// are. The cone is a fixed-direction blow (uniform along the fan's aim
// angle, not radiating outward from its center like an explosion), narrowing
// force linearly to 0 at max range.
export const FAN_CONE_HALF_ANGLE_DEG = 28; // total cone width = 2x this = 56° (was 15/30°, then 20/40°, then 25/50° — widened slightly again per direct request)
// Placeholder balance per tier, same as every other economy/physics constant
// in this file — tune once real playtesting exists. Power cost is drawn
// unconditionally while a Fan is placed (Grid.js's computeCurrentPowerDemand)
// — tracked/displayed on the electricity HUD but never actually gates
// anything, same as every other not-yet-power-gated Electric building.
//
// Turbo Fan force cut from 1100 to 440, per direct request ("same range,
// but less powerful") — reverse-engineered from two explicit hover targets:
// at equilibrium, a suspended item's weight (mass * GRAVITY) exactly
// balances the Fan's force at that distance (force decays linearly to 0 at
// maxRange — see computeFanForce), so hoverFraction = 1 - (mass * GRAVITY) /
// maxForce. Solving maxForce so a coin (mass 3) hovers at the requested 40%
// of range gives maxForce = 3*88 / 0.6 = 440 — and that SAME 440 also lands
// Waste (mass 1) almost exactly at the requested 80% (1 - 88/440 = 0.8,
// exact), which is a strong signal 440 is the intended number rather than a
// coincidence. Food (mass 0.3, much lighter) ends up hovering near 94% —
// close to the water's surface at the far edge of the range, consistent
// with "food floats near the top" even though it doesn't land on the exact
// same percentage as Waste (a single force value can't put two different
// masses at identical equilibrium points; Waste's 80% match was prioritized
// since it was named explicitly alongside the coin figure).
export const FAN_T2_MAX_FORCE = 260; // Rudimentary Fan — force magnitude at the emitter (see Grid.js's a = F/mass integration). Originally deliberately too weak to hover a coin at all when coin mass was 3 (3*88=264 > 260); after the coin-mass retune (now 2, weight 176 < 260), a coin CAN hover under this tier — see the mass-retune comment above ITEM_MASS_BY_TYPE for the current numbers.
export const FAN_T2_MAX_RANGE = 320; // px — 10 tiles (was 3, then 5, then 6, then 7, then 9; +1 more tile per direct request, the 7th such increase this session)
export const FAN_T2_POWER_COST = 0; // per direct request — "the rudimentary fan takes 0mw electricity"
export const FAN_T3_MAX_FORCE = 320; // Electric Fan — cut 520 -> 350, now 320 per direct request, alongside the T4 cut and mass retune below — sits between Rudimentary (260) and Turbo (400)
export const FAN_T3_MAX_RANGE = 496; // px — 15.5 tiles (was 5.5, then 8.5, then 9.5, then 10.5, then 13.5; +2 more tiles)
export const FAN_T3_POWER_COST = 2; // doubled from 1 per direct request ("make all the buildings take twice as much electricity as they do right now")
export const FAN_T4_MAX_FORCE = 400; // Turbo Fan — cut 1100 -> 440, now 400 per direct request, alongside the T3 cut and mass retune above
export const FAN_T4_MAX_RANGE = 640; // px — 20 tiles, unchanged per direct request ("the same range, but less powerful")
export const FAN_T4_POWER_COST = 6; // doubled from 3 per direct request ("make all the buildings take twice as much electricity as they do right now")

// ---- Shared building output point ----
// Every non-Fan, non-Turret building that ejects a physical item (Refinery,
// Manufacturer, and — historically — the now-removed Auto-Feeder) uses the
// exact same fixed point: straight up from the tile's own center, this
// fraction of a tile out — "make it so the collectors and auto-feeders
// output on top, by default." Renamed from AUTO_FEEDER_PORT_OFFSET_FRACTION
// now that the Auto-Feeder itself is gone (replaced by the Refinery family).
// Real bug, found and fixed after a direct report ("the output bounces on
// top of the building"): at the old 0.5 (exactly the tile's own top edge),
// a freshly-spawned item's CENTER sits precisely on the solid tile's own
// boundary — its lower half is still embedded inside the solid tile, which
// the very next item-vs-tile overlap resolution shoves clear with a single
// hard, visible "pop" (confirmed directly: a Food item jumped ~6.5px
// upward in exactly one tick right after spawning). That pop is easy to
// miss for a building with ordinary open seabed above it, but reads as an
// obvious bounce for a building sitting in the CITY'S OWN TOPMOST row,
// where the same shove launches the item clean across the water/seabed
// physics boundary into open water, which then has to pull it back down
// through a completely different gravity profile. Bumped to 0.9 (28.8px
// from center, ~12.8px of genuine clearance above the tile's edge) so every
// current item type (max radius 10, Biomass/Bio-Sludge) spawns fully
// outside the solid tile's footprint from the very first tick — nothing
// left to shove clear, so there's no pop to begin with.
export const BUILDING_OUTPUT_PORT_OFFSET_FRACTION = 0.9; // fraction of TILE_SIZE — how far above the tile's center the fixed output point sits

// Per direct request: an item ejected by a Refinery or Manufacturer now
// launches slightly upward off the output point instead of appearing there
// with zero velocity — "launches the object upwards slightly, like 1-3
// tiles worth depending on the mass of the object being launched." A
// lighter item (Food/Mutagen Paste, mass 0.3) launches the full 3 tiles;
// the heaviest current output (Biomass/Bio-Sludge, mass 4) only launches 1
// — everything else (Science/Green Science at 2.8, Alien Egg at 2) falls
// linearly in between by its own mass. See Entities.js's
// applyProductionLaunch, which solves the classic v = sqrt(2*g*h) kinematic
// for whichever gravity constant that item type actually falls under (Food/
// Mutagen Paste use their own gentler FOOD_GRAVITY, everything else the
// shared GRAVITY) so the requested tile height is what actually plays out
// once real physics takes back over, not just an arbitrary velocity number.
export const PRODUCTION_LAUNCH_MIN_TILES = 1; // the heaviest current output (mass >= PRODUCTION_LAUNCH_MASS_MAX)
export const PRODUCTION_LAUNCH_MAX_TILES = 3; // the lightest current output (mass <= PRODUCTION_LAUNCH_MASS_MIN)
export const PRODUCTION_LAUNCH_MASS_MIN = 0.3; // Food/Mutagen Paste's own mass — see ITEM_MASS_BY_TYPE
export const PRODUCTION_LAUNCH_MASS_MAX = 4; // Biomass/Bio-Sludge's own mass — see ITEM_MASS_BY_TYPE

// ---- Storage Chest trickle/clear physics ----
// Per direct request ("make the distance the chests spits out objects
// variable based on the distance away the cursor gets from the chest during
// the drag") — replaces the earlier "same force the other buildings have"
// fixed-magnitude launch entirely. main.js's aim-drag gesture (both the
// left-drag auto-trickle arm and the right-drag instant-clear) measures its
// own live WORLD-space drag distance in tiles and clamps it into
// [STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES, STORAGE_CHEST_MAX_TRICKLE_
// DISTANCE_TILES[tier]] — a straight 1:1 mapping (drag 5 tiles away, it
// spits 5 tiles away), no separate "how far is a full-power drag" constant
// needed. Entities.js's applyDistanceLaunch converts that tile count into an
// actual launch speed via the drag-only "total distance traveled under pure
// exponential decay" formula (distance = speed / drag, so speed = distance *
// drag) — deliberately NOT the full gravity-inclusive rise-height inversion
// applyProductionLaunch/launchSpeedForHeight use elsewhere in this file,
// since that formula is specifically a VERTICAL-only model; a chest can aim
// any angle, and gravity's effect on total travel distance varies by angle
// in a way that formula doesn't account for. This is a simplification (real
// gravity still curves the actual trajectory after launch), consistent with
// every other launch calc in this game already being an approximation, not
// full projectile simulation.
export const STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES = 1;
export const STORAGE_CHEST_MAX_TRICKLE_DISTANCE_TILES = {
  [TILE_STORAGE_CHEST]: 8,
  [TILE_STORAGE_CHEST_T2]: 12,
  [TILE_STORAGE_CHEST_T3]: 16,
};
// Interpolated by fill fraction (count/capacity) — a nearly-empty chest
// barely trickles, a full one drains fast, so a player watching it fill back
// up doesn't have to babysit an on/off switch.
export const STORAGE_CHEST_TRICKLE_INTERVAL_MAX_MS = 4000; // at ~0% full
export const STORAGE_CHEST_TRICKLE_INTERVAL_MIN_MS = 500; // at 100% full
// The right-click-drag "clear" gesture (replacing the old Clear Chest
// button entirely, per direct request) staggers its ejections at this fixed
// interval per item rather than all at once — "spitting them as fast as
// possible without colliding with themselves." A max-capacity Tier 3 chest
// (100) at 20ms apart finishes in ~2s; a smaller chest finishes
// proportionally faster.
export const STORAGE_CHEST_CLEAR_INTERVAL_MS = 20;
// Defensive-only fallback inside Grid.js's ejectOneFromChest — every real
// caller now always supplies a fresh angle (both the trickle and the
// right-drag clear are only ever armed BY a drag, which inherently produces
// one), so this should never actually fire in normal play any more. Kept as
// a "don't let items clip together" no-direction escape hatch regardless —
// small, fixed, and deliberately NOT distance/mass-based like a real launch.
export const STORAGE_CHEST_SCATTER_LAUNCH_SPEED = 50;
// Per direct report ("if you choose the direct corners as the spit
// direction, the storage chest will grab the object immediately back in
// after shooting it") — a diagonal ejection's spawn point sits much closer
// to the chest's own touch radius than a cardinal one does (a square's
// corner-to-edge geometry), so a purely geometric spawn-offset fix would
// need re-tuning per angle. A time-based cooldown sidesteps that entirely:
// Grid.js's intake scan now skips re-absorbing any item still within this
// window of its own ejection (tracked per-item-id on the chest itself, see
// buildingData's recentEjections). The "Clear Chest" gesture gets a longer
// cooldown, per direct request ("a full second delay on the same object if
// the chest is cleared out") — a full dump ejects many items in quick
// succession along a shared-ish direction, so they need more room to
// separate before any one of them could plausibly drift back into range.
export const STORAGE_CHEST_TRICKLE_REGRAB_COOLDOWN_MS = 500;
export const STORAGE_CHEST_CLEAR_REGRAB_COOLDOWN_MS = 1000;

// A Collector doesn't bank an item the instant it lands any more — it visibly
// draws it in toward the tile's center and holds it there for that tile's
// PROCESSOR_STATS-derived duration (coin vs Science Bubble, tier-scaled —
// see that table below) before actually consuming it (Grid.js's
// stepCollectorProcessing), so the single-item-at-a-time bottleneck that was
// always the design intent (see the "Items can't stack" note on why a
// Collector can only receive the one item touching it) is now something the
// player can actually *see* happening, not just infer. COLLECTOR_PULL_STRENGTH
// is an exponential ease-toward-center rate (per second) — high enough that
// an off-center landing visibly glides to the middle well within the first
// second, not a hard snap. COLLECTOR_PROCESSING_MASS temporarily overrides
// the item's real mass for resolveItemCollisions while it's being processed
// (restored once consumed/interrupted) so it barely budges if something else
// piles into it mid-process, without needing to special-case it out of
// collision resolution entirely — new arrivals still visibly bank up around
// it instead of overlapping it.
export const COLLECTOR_PULL_STRENGTH = 10; // 1/sec ease rate toward the tile's center
export const COLLECTOR_PROCESSING_MASS = 1000;
export const COLLECTOR_CIRCLE_RADIUS_FRACTION = 0.32; // fraction of TILE_SIZE — the drawing-in point rendered in the tile's center
// A Collector pulls from a plain intake-radius scan around its own tile
// center instead of consuming whatever happens to land on top of it via
// ordinary gravity — per direct request, ANY side counts now (no more
// angle-gated "intake side," same retirement as the Auto-Feeder's above), so
// an item just has to genuinely touch the tile (within COLLECTOR_INTAKE_RADIUS
// of its center) to get pulled in, from any direction.
export const COLLECTOR_INTAKE_RADIUS = TILE_SIZE * 0.65;

// Items can no longer be "lost" at all, per direct request — every side,
// the top, and the bottom of the world are now hard barriers (see
// Entities.js's clampItemToWorldWalls and Grid.js's sweepVertical), so
// nothing an item does can ever put it somewhere unreachable/deleted any
// more. The old ITEM_LOST_BELOW_WORLD_MARGIN_PX/ITEM_LOST_COLOR
// constants and every "fell off the bottom, gone" code path they drove are
// removed entirely.

// Items in the seabed band can't occupy the same space, and this is a live,
// continuous simulation, not a one-shot "settle and freeze" — every item is
// re-checked against gravity, the tiles beneath it, and every other nearby
// item on every tick for as long as it exists, the same as a pile of actual
// coins would be. Dropping a coin onto a stack pushes the whole stack, which
// can shove coins at the bottom off the edge of whatever they were resting
// on; nothing is ever permanently anchored just because it came to rest
// once — knock its support out (push it, or remove the tile under it) and
// it falls again like anything else. This is deliberate: a single Collector
// tile can only actually receive the one item currently touching it —
// everything else piles up and spills, so a real factory needs width
// (multiple Collectors, Fans routing overflow) to keep up, not just one tile under a
// firehose.
//
// Mass drives how much an item moves when it collides with another —
// ITEM_MASS_BY_TYPE below, not item.radius (a coin's radius is about value
// tier/visibility, not weight) — AND how strongly a Fan's force actually
// accelerates it (a_fan = F/mass, see Grid.js's integrateItemForces). Food
// is much lighter than a coin on purpose: a coin barely notices bumping
// into a food pellet, while a food pellet gets shoved completely out of the
// way by a coin.
//
// ---- 5 Weight Classes (Architectural Update: Alien DNA/Biomass/5-Class
// Physics), per direct spec — every item type sits in exactly one class,
// strictly ordered by mass so each class's own described handling
// ("readily caught by weak fans" vs "needs a T3 Electric Fan") actually
// holds true relative to its neighbors:
//   Class 1 Buoyant       (food, mutagen_paste)      — lightest, also gets
//                                                       its own gentler
//                                                       FOOD_GRAVITY/
//                                                       FOOD_MAX_FALL_SPEED
//                                                       profile (see below),
//                                                       not just a low mass
//   Class 2 Ultra-Light   (waste)                     — bumped 0.5 -> 1.2 per
//                                                       direct request (it
//                                                       used to sit too close
//                                                       to Food's own mass to
//                                                       route the two apart
//                                                       under a Fan) —
//                                                       noticeably heavier
//                                                       than Food now, still
//                                                       clearly below Coin
//   Class 3 Standard      (coin, alien_egg)           — cut 3 -> 1.5 -> 1.8,
//                                                       now 2 per direct
//                                                       request — sinks
//                                                       predictably, routes
//                                                       smoothly under a
//                                                       standard Fan
//   Class 4 Medium-Heavy  (science, science_green)    — cut 9 -> 4 -> 3, now
//                                                       2.8 per direct
//                                                       request; denser than
//                                                       coins, needs sustained
//                                                       Fan coverage
//   Class 5 Heavy         (alien_dna, biomass)         — cut 7 -> 5, now 4 per
//                                                       direct request;
//                                                       heaviest; needs a T3
//                                                       Electric Fan (or
//                                                       stronger) to move any
//                                                       real horizontal
//                                                       distance without a
//                                                       Ramp
// Classes 2-5 all share the same GRAVITY/MAX_FALL_SPEED fall profile
// (gravity is mass-independent, same as real gravity — only Fan
// responsiveness differs by mass) — only Class 1 deviates, with its own
// slower, wavering fall.
export const ITEM_MASS_BY_TYPE = {
  food: 0.3, mutagen_paste: 0.3, // Class 1 — Buoyant
  waste: 1.2, // Class 2 — Ultra-Light (was 1, then 0.5 — bumped again per direct request, "the waste is too close to the food in mass so you can't properly route them separately using fans")
  coin: 2, alien_egg: 2, // Class 3 — Standard (coin was 3, then 1.5, then 1.8, now 2 per direct request) — the Alien Egg "weighs as much as a coin," per direct spec, so it moves with it
  science: 2.8, science_green: 2.8, // Class 4 — Medium-Heavy (was 9, then 4, then 3, now 2.8 per direct request)
  alien_dna: 4, biomass: 4, // Class 5 — Heavy (was 7, then 5, now 4 per direct request, alongside the T3/T4 Fan force cuts below)
};

// ---- Platform item filters ----
// Per direct request: every Platform variant (the flat tile and all 4 Half
// Platform ramps alike) can be turned into a collision filter instead of the
// plain "always solid" default — left-clicking a placed one opens a small
// pop-up (UI.js's openPlatformFilterMenu) listing every item type in the
// game with a green-check/red-x toggle. This list is the single source of
// truth both that pop-up and Grid.js's own collision-skip check
// (platformIgnoresItem) read from, so the two can never drift apart — it
// mirrors main.js's own DRAGGABLE_ITEM_TYPES exactly (every item type that
// physically exists in the game), just paired with a display label/icon.
export const PLATFORM_FILTER_ITEM_TYPES = [
  { id: 'coin', label: 'Coins', icon: '🪙' },
  { id: 'food', label: 'Food', icon: '🍖' },
  { id: 'waste', label: 'Waste', icon: '🗑️' },
  { id: 'science', label: 'Blue Science', icon: '🔬' },
  { id: 'science_green', label: 'Green Science', icon: '🟢' },
  { id: 'alien_dna', label: 'Bio-Sludge', icon: '🧫' },
  { id: 'biomass', label: 'Biomass', icon: '🟩' },
  { id: 'mutagen_paste', label: 'Mutagen Paste', icon: '🩷' },
  { id: 'alien_egg', label: 'Alien Egg', icon: '🥚' },
];
// vx decays by this factor every tick — without damping, a single bump
// would leave an item drifting sideways forever instead of a jostled pile
// settling back down, the way real friction would.
export const ITEM_HORIZONTAL_DAMPING = 0.82;
// Sub-passes of item-item overlap resolution run per tick, so a push at the
// top of a stack can propagate down through several layers within a single
// tick instead of only one layer moving per tick (which would make a tall
// pile feel unresponsive/laggy to a new arrival).
export const ITEM_COLLISION_ITERATIONS = 4;
// A collision resolved exactly along the true center-to-center line is what
// makes an off-center landing roll toward whichever side it's actually
// leaning, proportional to how far off-center it landed — that continuity
// is what reads as natural rolling instead of sliding. The only case that
// needs help is a landing close enough to dead-center that the true
// direction is nearly pure vertical, which would otherwise balance forever
// on the peak instead of toppling (an unstable equilibrium a real coin
// wouldn't actually hold, but our simulation has no physical noise to break
// the tie with). So this is a *floor*, not a clamp: pushDirection leaves the
// true angle alone whenever the true horizontal component already exceeds
// it, and only substitutes a fixed small nudge for the near-dead-center
// case. An earlier version clamped every landing whose vertical component
// exceeded 0.6 down to the *same* fixed diagonal regardless of true offset —
// which meant a landing 2% off-center and one 40% off-center resolved
// identically, reading as items sliding along a fixed-angle "flat ceiling"
// rather than rolling proportionally to where they actually landed.
export const ITEM_MIN_HORIZONTAL_PUSH_FRACTION = 0.15;
// Below this true overlap depth (before ITEM_MAX_PUSH_PER_STEP clamps it),
// a collision is treated as ongoing resting contact — not a fresh hit — and
// skips the velocity impulse (position correction alone still keeps it
// non-overlapping). Without this, an item resting on top of *another item*
// (as opposed to a tile) kept re-triggering full-strength impulses forever:
// stepItemOnGrid's gravity integration runs unconditionally every tick (see
// its module comment), but only a real *tile* landing zeroes vy
// (sweepVertical) — landing on another item never does, so a stacked item's
// vy kept climbing under gravity every tick, caught each time by the
// positional correction, which is a full-speed "impact" every single tick
// forever. That, not just the angle, was the main source of items visibly
// creeping/bumping sideways while sitting on top of a pile.
export const ITEM_PUSH_IMPULSE_MIN_OVERLAP = 0.5;
// When an item lands on top of *another item* rather than a tile, its vy is
// clamped down to this instead of fully zeroed. Fully zeroing it (this used
// to be a hard 0) made re-penetration each tick vanishingly small — under
// 0.03px — so the corrective push proportional to that overlap was too tiny
// to actually finish rolling an off-center coin down to open ground; a
// landing that should read as "rolls off in about a second" instead took
// upward of 20 simulated seconds to visibly move at all. A small residual
// fall speed keeps the settle brisk (a few tenths of a second) without
// reopening the original bug, since it's still far below MAX_FALL_SPEED —
// nowhere near enough to regenerate a large, ITEM_MAX_PUSH_PER_STEP-clamped
// overlap every tick the way an unclamped full-speed fall did.
export const ITEM_ON_ITEM_LANDING_VY_CAP = 24;
// Caps how far a single pairwise resolution can reposition an item, no
// matter how deep the true overlap is. Two coins created at (almost) the
// same spot — e.g. a tight fish swarm dropping coins on top of each other
// in open water, where nothing separates them until they cross into the
// seabed band together — can arrive already overlapping by nearly their
// full diameter; resolving that in one uncapped shot flung a coin clear
// across the seabed line into open water, where it kept whatever velocity
// it had as a free ballistic projectile (looked like a coin launching
// itself into the water for no reason). Clamping the correction means a
// severe overlap just takes a few more ticks (still resolved well within a
// second, since ITEM_COLLISION_ITERATIONS reruns every tick) to visibly
// settle apart instead of teleporting.
export const ITEM_MAX_PUSH_PER_STEP = 3;
// A fixed, bounded velocity kick (not proportional to overlap depth) given
// to an item's vx every time a collision correction moves it — this is what
// makes a shoved item keep drifting for a moment afterward instead of
// snapping straight into place and stopping dead, without risking an
// unbounded speed if a correction ever happens to be large. Kept small on
// purpose: this used to be 20, which — reapplied every tick a new arrival
// kept pressing into the pile — could add up to a lateral speed faster than
// the item's own fall speed, visibly "shoving" coins sideways in a straight
// line until they walked off the far edge of whatever they were resting on.
// The actual anti-stacking separation comes from the positional correction
// above (bounded by the overlap depth, so it can't run away); this impulse
// is now just enough residual motion to read as a gentle settle, not a push.
export const ITEM_PUSH_IMPULSE_SPEED = 3;

// ---- Economy & feeding ----
export const FOOD_COST = 3; // $ per food pellet, matches the Buy Food shop entry — lowered from 5 so the early economy isn't so punishing to get rolling
export const FOOD_RADIUS = 6.6; // px, visual + despawn-on-floor check — 10% bigger (was 6) per direct request ("increase the size of all the objects by 10%")
// Per direct request ("make the food color slightly lighter to a pink
// salmon color, and make sure all the food icons throughout the game
// match") — was a flat red (#e74c3c); still clearly distinct from coins
// (bronze/silver/gold/diamond), waste (gray), and science (blue/purple),
// just a lighter, warmer pink-salmon tone instead. Every food-colored icon
// in the game (the item itself, the Food tool's own toolbar icon, hunger
// indicators, stats-panel rows) all read this one constant — see this
// constant's own reference list — so changing it here is the single source
// of truth EXCEPT for css/style.css's .tool-icon-food, which can't import a
// JS constant and has to be kept in sync by hand (see its own comment).
export const FOOD_COLOR = '#ff9b8a';
// Stationary-to-Waste (Entities.js's updateFood): replaces the old
// FOOD_FLOOR_GRACE_MS despawn-on-the-floor mechanic and the Food Capacity
// cap alike, per direct request — instead of limiting how much food can
// exist or silently despawning an ignored pellet, a pellet that hasn't
// moved more than FOOD_STATIONARY_MOVE_TOLERANCE_PX from its own last
// "genuinely moving" position in FOOD_STATIONARY_TO_WASTE_MS turns into a
// real Waste item at its own spot instead — "if it moves within that
// window it restarts the countdown" falls out of the tolerance check
// directly (a Fan visibly wobbling a held pellet keeps resetting it, the
// same as if the player nudged it themselves).
export const FOOD_STATIONARY_TO_WASTE_MS = 30000; // 50% longer again (was 20000) per direct request ("make food take 50% longer to turn into waste")
export const FOOD_STATIONARY_MOVE_TOLERANCE_PX = 4; // small enough to still catch real movement, large enough to ignore sub-pixel collision-resolution jitter on something genuinely resting
// A "stale" visual phase, per direct request — once a pellet's own
// stationaryTimer crosses this fraction of FOOD_STATIONARY_TO_WASTE_MS
// (75%, so 22.5s into the 30s countdown), main.js's render tints it toward
// FOOD_STALE_COLOR instead of its normal FOOD_COLOR, reading as "starting to
// look stale." Needs no extra state of its own — stationaryTimer already
// resets to 0 the instant the pellet moves more than
// FOOD_STATIONARY_MOVE_TOLERANCE_PX (a Fan nudge, or the player dragging it),
// so the gray tint reading straight off that same timer means "the color
// resets" the moment it's moved falls out for free, per direct spec.
export const FOOD_STALE_FRACTION = 0.75;
export const FOOD_STALE_COLOR = '#9a9a90';
export const COIN_RADIUS = 11; // px, base visual radius (bronze size) — 10% bigger again (was 10) per direct request ("increase the size of all the objects by 10%")
export const COIN_CLICK_RADIUS_MULTIPLIER = 1.9; // click hit-test radius is each coin's own (tier-scaled) radius times this — 90% bigger than the coin itself (was 60%, bumped again per direct request), so a click doesn't have to be pixel-perfect (and doesn't get misread as a food-placement click on a miss). Purely a hit-test radius — the coin's actual drawn/collision size (COIN_RADIUS) is untouched. tryBankCoinAt still only ever banks the first match it finds per click and returns immediately, so an overlapping pair of these bigger radii still can't bank two coins on one click.
export const CHEAT_GRANT_AMOUNT = 10000; // $ granted by the M debug key
export const CHEAT_TANK_POINTS_GRANT_AMOUNT = 20; // Tank Points also granted by the M debug key, so testing the Tank Upgrades panel doesn't require grinding fish growth
export const CHEAT_SCIENCE_GRANT_AMOUNT = 500; // Science Bubbles also granted by the M debug key, so testing the Science Lab's tech tree doesn't require grinding an Octopus's real brew-and-collect cycle
export const CHEAT_SCIENCE_GREEN_GRANT_AMOUNT = 500; // Green Science too, per direct request ("so I can test those things") — same flat amount as blue Science above, granted alongside it by the M debug key
export const CHEAT_FISHY_GEMS_GRANT_AMOUNT = 100; // per direct request ("make it so M debug hotkey gives me fishy gems") — comfortably covers even the priciest single hat (30) several times over, so testing the Customization panel doesn't require grinding real achievement claims first

// Coin color + size tier by value — checked in ascending order, first match
// wins. Entities.js's getCoinTier()/getCoinColor() do the lookup; kept here
// as data per §3.6. sizeMultiplier scales COIN_RADIUS for that tier.
export const COIN_TIERS = [
  { maxValue: 5, color: '#cd7f32', sizeMultiplier: 1.0 }, // bronze, 1-5
  { maxValue: 12, color: '#c0c0c0', sizeMultiplier: 1.05 }, // silver, 6-12, 5% bigger
  { maxValue: 30, color: '#ffd700', sizeMultiplier: 1.10 }, // gold, 13-30, 10% bigger
  { maxValue: Infinity, color: '#b9f2ff', sizeMultiplier: 1.15 }, // diamond, 31+, 15% bigger
];
// Per direct request ("make the diamond colored coins more visually unique...
// look more like a circular gem than a coin") — main.js's item render loop
// special-cases the diamond tier (getCoinTier(item.value).maxValue ===
// Infinity) with a faceted radial-gradient gem render instead of the flat
// single-color fill every other coin tier gets. Two gradient stops plus a
// bright sparkle highlight, not a flat fill — reads as a cut gem rather than
// a coin-shaped disc.
export const DIAMOND_GEM_COLOR_CORE = '#eafcff';
export const DIAMOND_GEM_COLOR_EDGE = '#7fd0e8';

// ---- Waste (Phase 3 — two sources) ----
// A third item type alongside food/coin. Spawned two ways: (1) a basic
// (unpowered) Collector consuming an item — "a basic collector poops out
// sludge when collecting a coin," per the design update — and (2) directly
// by any non-Scavenger fish, on its own periodic timer (`WASTE_POOP_INTERVAL_MS`
// below), independent of any building — literal fish poop, per direct
// request. Falls/routes using the exact same Grid.js tile physics as a
// coin, but isn't click-bankable — Suckerfish (its real Scavenger behavior,
// see the SPECIES table below) and the Auto-Feeder are what actually
// consume it, each restoring CLEANLINESS_PER_WASTE_EVENT of cleanliness
// when they do. Electric buildings (Tier 4+) skip producing the
// Collector-side of it entirely, once they exist.
// A flat 8.8 now, not a Food-relative formula — per direct request ("increase
// the size of the waste by an additional amount, so it matches the current
// size of the science objects"), superseding the old "10% bigger than Food"
// relationship entirely: Waste now matches SCIENCE_ITEM_RADIUS exactly
// (both 8.8, after science's own 10% bump below), on top of every item's
// blanket 10% size increase.
export const WASTE_RADIUS = 8.8;
// Generalized from Waste-only to every item type (coin/food/waste/science),
// per direct request ("make it so that every object can be clicked and
// dragged around, just like waste") — the hit-test radius for grabbing ANY
// item to drag, same "bigger than the drawn size" precedent as
// COIN_CLICK_RADIUS_MULTIPLIER, so a drag doesn't need to start
// pixel-perfect. See main.js's updateItemDrag.
export const ITEM_DRAG_CLICK_RADIUS_MULTIPLIER = 1.6;
// How far the cursor has to move (screen px, mousedown to mouseup) before a
// press-on-an-item gesture counts as a genuine drag rather than a plain
// click — below this, the click passes through untouched so Coin/Science's
// existing bank-on-click behavior still fires normally; at or above it, the
// click is suppressed so a real drag-and-release doesn't ALSO bank/place
// something at the drop point. Same "6px" threshold the Science Lab tree's
// own drag-vs-click disambiguation already uses (UI.js's
// LAB_TREE_DRAG_THRESHOLD_PX).
export const ITEM_DRAG_MOVE_THRESHOLD_PX = 6;
export const WASTE_GRAVITY = GRAVITY; // sinks like a coin, not a drifting food pellet
export const WASTE_MAX_FALL_SPEED = MAX_FALL_SPEED;
// Shifted from a plain olive-green (#6b8e4e) to a genuine brown, per direct
// request ("change the color of waste to be slightly more brown so its
// different from biomass") — the old olive sat too close to Biomass's own
// green family to tell apart on the seabed at a glance.
export const WASTE_COLOR = '#8a6f45';
// Flat hunger relief for a Scavenger fish (Suckerfish) eating a Waste item —
// deliberately NOT tied to the Food Quality Tank Upgrade tree, which is
// themed around player-bought Food pellets specifically, not scavenged waste.
export const WASTE_HUNGER_RELIEF = 70;
// How often a non-Scavenger fish poops out a Waste item directly at its own
// position, mirroring the existing coin-drop-timer pattern exactly (see
// Entities.js's updateFish) — a flat rate for every such species regardless
// of size/species, placeholder balance like every other timing constant
// here, tune once real playtesting exists. Scavenger fish (Suckerfish)
// don't poop — they're the one eating this, not producing it.
export const WASTE_POOP_INTERVAL_MS = 39683; // waste production 30% SLOWER per direct request ("all fish produce waste 30% slower") — was 27778, itself 10% less frequent than the original 25000. This single flat constant is what every non-Scavenger species pops on, so this one change covers "all fish" at once — see CLAUDE.md's Waste section for why this is intentionally NOT per-species.

// ---- Science (physical resource) ----
// Per direct request, Science is no longer an instant number added straight
// to a bank the moment a Researcher fish's timer fires — it's a real
// falling/routable item now, exactly like a coin: it has to be banked by
// clicking it OR pulled into a Collector's intake, same as ITEM_MASS_BY_TYPE
// above already reflects (9 — 3x a coin's mass, so it needs real Fan muscle
// to move). Visually a "magical bubble" — drawn with a two-tone purple/blue
// fill plus a bright highlight ring in main.js's item-render loop, not a
// flat single color like a coin/food/waste — SCIENCE_ITEM_COLOR_A/B are the
// two tones that blend across it. Slightly smaller than a bronze coin
// (COIN_RADIUS = 10) per direct request.
export const SCIENCE_ITEM_RADIUS = 8.8; // 10% bigger (was 8) per direct request ("increase the size of all the objects by 10%") — Waste is now pinned to match this exact value, see WASTE_RADIUS above
export const SCIENCE_ITEM_COLOR_A = '#b98bff'; // purple
export const SCIENCE_ITEM_COLOR_B = '#5fc9ff'; // blue — matches the existing SCIENCE_COLOR used for floating text/HUD accents
// While a Researcher fish (Science Octopus) is mid-cycle toward producing its
// next physical Science bubble, a small "+0.1 🔬" floating text pops above it
// every time it crosses another tenth of its current stage's cycle — pure
// progress feedback, not an actual resource grant (nothing is banked until
// the physical bubble itself is later collected) — per direct request, so a
// full-minute-plus wait doesn't read as "nothing is happening."
export const SCIENCE_PROGRESS_TICKS = 10;

// ---- Green Science (Bio-Combuster's upgraded output) ----
// Physically identical in every way to a blue Science Bubble — same
// click-bank-or-Collector-routing rule ("Must be routed into a Collector to
// be added to active science reserves," per direct spec — click-banking is
// also supported for consistency with blue Science, since nothing in the
// spec forbids it and every other physical resource in this game supports
// both) — just its own separate state.level.scienceGreen reserve and a
// visually distinct green-toned bubble instead of purple/blue, so the two
// resources read apart at a glance. Weight Class 4, same mass as blue
// Science — see ITEM_MASS_BY_TYPE.
export const SCIENCE_GREEN_ITEM_RADIUS = SCIENCE_ITEM_RADIUS;
export const SCIENCE_GREEN_COLOR_A = '#8bffa0'; // light green
export const SCIENCE_GREEN_COLOR_B = '#3fd66f'; // deeper green
export const SCIENCE_GREEN_COLOR = '#3fd66f'; // HUD/floating-text accent, mirrors SCIENCE_COLOR's role for blue

// ---- Bio-Building production chain: physical item types ----
// alien_dna: dropped by a defeated alien (Entities.js's updateAlien), OR
// made at the Manufacturer via the Bio-Sludge recipe (Food+Waste) — both
// paths produce this exact same item/type now, per direct request ("change
// all other mentions of Alien DNA to Bio-Sludge... to make it clear it's a
// pre-refined version of the Biomass"): displayed as "Bio-Sludge" wherever
// it's named, but the internal type string stays `alien_dna` (unchanged, so
// none of the physics/collision/drag code needed to change) — the old
// standalone `bio_pellets` item type this recipe used to produce is retired
// entirely, since it never had a use anywhere else in the game and Alien
// DNA/Bio-Sludge already does (the Refinery's Bio-Sludge->Biomass recipe).
// Yield from a kill still scales with the alien's own tier — see
// ALIEN_ARCHETYPES' dnaYield below. biomass: the Refinery's Bio-Sludge-
// recipe output, and the shared 2nd ingredient every Mutagen-Paste/Blue-
// Science recipe needs. mutagen_paste: the Mutagen Paste recipe's own
// output, Food+Biomass. All three fall/route through the exact same seabed
// physics every other item already uses (see Grid.js's stepItemOnGrid) —
// only their mass (ITEM_MASS_BY_TYPE), radius, and color are unique to each.
// ALIEN_DNA_RADIUS matches BIOMASS_RADIUS exactly, per direct request — a
// Refinery converts one directly into the other, so the two are sized (and
// weighed — see ITEM_MASS_BY_TYPE's shared Class 5 entry) identically.
export const ALIEN_DNA_RADIUS = 10;
export const ALIEN_DNA_COLOR = '#7cff5a'; // acid green — reads as "alien"/organic/raw, distinct from every other item's color family
export const BIOMASS_RADIUS = 10; // bumped from 9 alongside the recolor below, per direct request ("change biomass size")
// A richer, more settled green than Bio-Sludge's own raw acid-green — per
// direct request ("visually distinct and more interesting, and visually
// close to bio-sludge so it's obvious bio-sludge is the pre-refined
// version"). Paired with BIOMASS_COLOR_CORE below in main.js's own dedicated
// two-tone gradient render (replacing the old flat single-color fill every
// other item type still gets) — the core color is deliberately
// ALIEN_DNA_COLOR itself, so Biomass literally has Bio-Sludge's own color
// glowing at its center, tying the two together directly rather than just
// via a similar hue. Brightened per a later direct request ("make the
// biomass slightly brighter green so it's a little closer to the
// bio-sludge") — blended about 30% of the way from the original #3f8a34
// toward ALIEN_DNA_COLOR's own acid-green, close enough to read as kin
// without becoming the same color (the core gradient stop already IS
// ALIEN_DNA_COLOR exactly, so the two colors staying distinct at the edge
// is what keeps the gradient itself readable as a gradient).
export const BIOMASS_COLOR = '#51ad3f';
export const BIOMASS_COLOR_CORE = ALIEN_DNA_COLOR;
export const MUTAGEN_PASTE_RADIUS = FOOD_RADIUS; // Class 1, same size class as Food
export const MUTAGEN_PASTE_COLOR = '#e64de0'; // vivid magenta/pink — unmistakably not plain Food, matches its "high-value" framing
// Same "hard, silent safety cap" precedent as WASTE_MAX_ON_SCREEN above —
// alien_dna in particular can arrive in bursts (several aliens dying in a
// short window each dropping a multi-item yield, or a burst of Bio-Sludge
// recipes finishing back to back), so it gets the identical protection
// against runaway item counts / collapsing framerate.
export const ALIEN_DNA_MAX_ON_SCREEN = 80;
export const BIOMASS_MAX_ON_SCREEN = 80;

// Alien Egg — the Manufacturer's new Alien Egg recipe output (Blue Science +
// Food), per direct spec. Weighs exactly as much as a coin (Class 3, see
// ITEM_MASS_BY_TYPE above), so it needs the same real Fan muscle a coin does
// to route around — but still falls/routes through the ordinary
// GRAVITY/MAX_FALL_SPEED profile every non-Buoyant item shares (it's a solid
// heavy object, not a Food-style floater). Fully draggable like every other
// item (see main.js's DRAGGABLE_ITEM_TYPES).
export const ALIEN_EGG_RADIUS = 9.5;
export const ALIEN_EGG_COLOR = '#c9a86b'; // a mottled tan/olive shell color, distinct from every other item's color family
export const ALIEN_EGG_RING_COLOR = '#7cff5a'; // the countdown-to-hatch progress ring, matching Alien DNA's own acid-green "alien" accent
// How long the egg sits inert before hatching, per direct spec ("it will
// stay as an egg for 30 seconds"). Entities.js's updateAlienEgg counts this
// up itself (item.hatchTimer) rather than routing through any of the
// existing canSpawnMore* item-count safety caps — an egg is a single object
// with a bounded lifetime, not a source of runaway item-count growth the way
// alien_dna/waste bursts are.
export const ALIEN_EGG_HATCH_MS = 30000;
// The hatched alien's own grace period, per direct spec ("an invulnerability
// buffer for 20 seconds... and 20 seconds of it not generating waste") —
// both halves share this one duration (Entities.js's createAlien sets
// alien.spawnProtectionUntilMs = elapsed + this, checked by every damage
// site — main.js's click handler, Grid.js's turret targeting,
// updateTurretProjectiles' impact — and by updateAlien's own poop timer).
export const ALIEN_EGG_HATCH_INVULN_MS = 20000;
// A hatched egg that started inside the seabed city (the Manufacturer that
// laid it is a city building) can't just teleport into open water — aliens
// are otherwise hard-clamped out of the city entirely (see updateAlien's own
// SEABED_FLOOR_Y clamp). Per direct spec ("have it slowly swim up... when it
// first spawns"), a freshly-hatched alien instead rises at this flat speed
// (px/sec, deliberately slow/gentle) until it clears the seabed line, fully
// overriding its normal wander/chase AI for that short window — see
// updateAlien's own alien.risingToSurface branch.
export const ALIEN_EGG_RISE_SPEED = 40;
// Fish prioritize Mutagen Paste over standard Food when hungry, per direct
// spec — Entities.js's findNearestFoodOrMutagen checks for ANY Mutagen
// Paste in the tank first (not just a nearby one) and only falls back to
// the nearest plain Food if none exists at all.
//
// A flat, generous hunger relief — deliberately not tied to the Food
// Quality Tank Upgrade tree (same reasoning as WASTE_HUNGER_RELIEF: that
// tree is themed around player-BOUGHT Food specifically), and generous
// enough to actually read as "high-value" against FOOD_HUNGER_RELIEF_BY_LEVEL's
// own unupgraded 60.
export const MUTAGEN_PASTE_HUNGER_RELIEF = 90;
// Non-Adult fish that eat Mutagen Paste instantly become an Adult, no matter
// what stage they were at (per direct request — a full replacement of the
// old "advance ONE growth stage" behavior); an Adult instead gets a
// temporary coin-drop multiplier with a glowing visual — see Entities.js's
// updateFish eat branch.
export const MUTAGEN_PASTE_COIN_MULTIPLIER = 2;
// Per direct request ("make mutagen paste last until fed again or the
// second stage of hunger, instead of the first hunger stage") —
// fish.mutagenBuffActive now clears at HUNGER_CRITICAL_THRESHOLD (the "!!"
// stage), not HUNGER_SEEK_THRESHOLD (the "!" stage) — see updateFish's own
// buff-clear check, right at the top of the function. Genuinely re-eating
// Mutagen Paste before then still refreshes the buff exactly as before.

// ---- Cleanliness (Phase 3) ----
// state.level.cleanliness (0-100, clamped) is a real, live value now instead
// of a static placeholder — every Waste item that spawns costs
// CLEANLINESS_PER_WASTE_EVENT; every Waste item cleaned back up (a
// Scavenger fish eating it, or an Auto-Feeder absorbing it) restores the
// same amount, so cleanliness is effectively a running tally of
// spawned-vs-cleaned waste, scaled into a 0-100 band. UI.js's updateHUD
// detects which direction it just moved (the same lastValue-comparison
// pattern already used for the money HUD) and flashes #hud-cleanliness red
// (dropping) or green (rising) accordingly — see the shared .flash-spend/
// .flash-pickup classes in style.css. No gameplay effect from a low value
// yet (fish stress/toxicity is still unbuilt, later Phase 3+ scope) — this
// is the visible-feedback half of the system.
export const CLEANLINESS_MAX = 100;
export const CLEANLINESS_PER_WASTE_EVENT = 0.25; // was 0.5 (itself cut from an original 4) — halved again per direct request ("waste counts as .25% cleanliness instead of .5%")
// A hard, silent safety cap on how many Waste items can exist in the world
// at once — real bug fix, per direct report ("when the aliens have been on
// screen for a while without being killed, the game gets super laggy and
// gets down to 1 frame per second"). Root cause: Waste, unlike Coins/
// Science, never had ANY cap — every alien poops one every
// ALIEN_POOP_INTERVAL_MS (2s) with no cap on how long it survives, and up
// to ALIEN_MAX_ALIVE (20) can be alive at once, so a genuinely neglected
// wave can add waste far faster than a player would ever have generated it
// from fish poop alone (which is what this tank's item counts were
// originally tuned against). Grid.js's resolveItemCollisions is O(n²) per
// tick — once total item count climbs into the hundreds, that cost alone
// is enough to collapse the framerate. Applied at every Waste-spawning call
// site (fish poop, alien poop, the Collector/Processor byproduct, and food
// rotting into Waste) via a plain "already at the cap? skip this spawn,
// silently" check — deliberately no player-facing feedback (unlike the
// Coin/Science caps, which are core resources the player is meant to
// actively manage; this is purely a performance safety valve, not a new
// mechanic). Generous enough that reaching it already represents a badly
// neglected tank under any normal circumstance.
export const WASTE_MAX_ON_SCREEN = 200;
// The first time cleanliness crosses below this (a one-shot tutorial gate,
// see state.level.tutorialFlags.cleanlinessWarningShown), Entities.js's
// adjustCleanliness posts CLEANLINESS_WARNING_MESSAGE to the notification
// ticker. The message itself hints that a dirty tank slows fish coin
// production — that gameplay consequence isn't actually wired up yet (same
// "value is live-tracked, downstream effect is still unbuilt" state
// cleanliness has been in since Phase 3 — see that section in CLAUDE.md),
// this is foreshadowing text only, per direct request for the message as
// written.
export const CLEANLINESS_WARNING_THRESHOLD = 90;
export const CLEANLINESS_WARNING_MESSAGE =
  'Looking a little dirty in there champ. The dirtier your tank is, the less money your fish produce. If only there was a way to clean it......';
// The first-ever Bio-Sludge (alien_dna) item, per direct request — worded
// differently depending on whether the Refinery is already unlocked (it's
// granted by the Mound's real Tier 1->2 crack), since a player who hasn't
// reached that yet has nothing to actually DO with the Bio-Sludge yet, and
// should be nudged back toward the Mound instead of toward a building they
// don't have. See Entities.js's maybeAnnounceFirstBioSludge.
export const FIRST_BIO_SLUDGE_WITH_REFINERY_MESSAGE =
  "Ooh, fresh Bio-Sludge! You've already got a Refinery sitting there looking useful — throw it in and see what dribbles out the other end.";
export const FIRST_BIO_SLUDGE_NO_REFINERY_MESSAGE =
  "You've got yourself some Bio-Sludge and absolutely nothing to do with it yet. That mound sitting in your seabed looks suspiciously like it's hiding the answer.";
// The #hud-cleanliness/#shop-cleanliness readout's text color is a live
// gradient between these two, per direct request — bright blue at 100%
// fading to a brown at 0%. CLEANLINESS_COLOR_DIRTY is deliberately the
// exact same hex as WASTE_COLOR above (kept in sync when that color was
// later changed from olive to brown) — a dirty tank reading the color of
// the Waste causing it is a nice, free bit of visual reinforcement.
// UI.js's cleanlinessColor(pct) does the actual RGB lerp every frame.
export const CLEANLINESS_COLOR_CLEAN = '#4fc3f7';
export const CLEANLINESS_COLOR_DIRTY = '#8a6f45';

// Real gameplay detriment of a dirty tank, per direct request ("make it so
// that tank dirtiness correlates to just fish producing less money. They
// produce half as much money at 0% cleanliness") — replaces an earlier
// version of this same mechanic that also slowed hunger AND stretched the
// coin-drop interval; per this later direct request ("JUST fish producing
// less money"), dirtiness now affects ONLY a FEEDER fish's coin VALUE — the
// old hunger-rate/interval-stretch effects are gone entirely — and scales
// smoothly across the WHOLE 0-100% range (no dead zone above a threshold —
// the old version only kicked in below 50%). Entities.js's
// cleanlinessMoneyMultiplier(state) returns the live 0.5-1.0 multiplier
// (CLEANLINESS_MIN_MONEY_FRACTION at 0% clean, 1.0 at 100% clean), applied
// directly to a coin's own dropValue in updateFish's real coin-drop branch
// and to computeTheoreticalGoldPerMinute's own stat.
export const CLEANLINESS_MIN_MONEY_FRACTION = 0.5; // at 0% cleanliness, fish produce half as much money

// ---- Floating pickup text ----
export const PICKUP_TEXT_LIFETIME_MS = 900; // how long a "+$N" pickup readout stays on screen after a coin is banked
export const PICKUP_TEXT_RISE_SPEED = 40; // px/sec it drifts upward while visible

// ---- Fish ----
export const FISH_BASE_SIZE = 32; // px at growth scale 1.0
export const FISH_EAT_RADIUS = 22; // px distance at which a seeking fish eats its food target
export const FISH_SEEK_SPEED_MULTIPLIER = 1.5; // fish move this much faster than their base swimSpeed only while actively chasing food (top speed) — wandering stays at the base pace so they still meander around the tank
export const HUNGER_MAX = 100;
export const HUNGER_SEEK_THRESHOLD = 47; // hunger value at which a fish starts hunting for food instead of wandering — shows the "!" indicator
export const HUNGER_CRITICAL_FRACTION = 0.6; // how far from HUNGER_SEEK_THRESHOLD to HUNGER_MAX the second, more urgent indicator kicks in
export const HUNGER_CRITICAL_THRESHOLD = HUNGER_SEEK_THRESHOLD + HUNGER_CRITICAL_FRACTION * (HUNGER_MAX - HUNGER_SEEK_THRESHOLD); // hunger value at which the fish is close enough to starving to need immediate attention — shows the escalated indicator
// Per direct request ("have the hunger sound that plays when they first
// enter the second stage of hunger play 3 more times before the fish dies,
// with less time in-between each of the 4 chimes as the starvation death
// gets closer") — 4 total chimes (index 0 is the original "just entered
// critical" one), each value a fraction of the way from
// HUNGER_CRITICAL_THRESHOLD (0) to HUNGER_MAX (1). Gaps between successive
// fractions shrink (0.45, 0.30, 0.18) so the chimes audibly speed up as
// death nears; the last one sits at 0.93, not 1.0, so it doesn't land right
// on top of playFishDeath's own distinct death sound. See Entities.js's
// updateFish.
export const FISH_HUNGER_CHIME_FRACTIONS = [0, 0.45, 0.75, 0.93];
// Per direct request ("have the second hunger visual exclamation marks
// bounce, slowly at first, and then after the second hunger warning chime
// of the 4 that play, have the bouncing get much more aggressive so the
// eyes are drawn to the fish") — the "!!" critical-hunger indicator
// (main.js's render) bounces on a repeating half-sine (always jumping UP
// from its rest position, like a real bounce, not a symmetric float).
// Slow/gentle while fish.hungerChimesPlayed is still 1 (the first chime,
// which fires the instant hunger crosses into critical, already happened by
// then), switching to fast/big once it reaches 2 (right as the SECOND chime
// plays) — see Entities.js's updateFish for hungerChimesPlayed itself.
export const HUNGER_ICON_BOUNCE_SLOW_PERIOD_MS = 900;
export const HUNGER_ICON_BOUNCE_SLOW_AMPLITUDE_PX = 2;
export const HUNGER_ICON_BOUNCE_FAST_PERIOD_MS = 220;
export const HUNGER_ICON_BOUNCE_FAST_AMPLITUDE_PX = 7;
// A pellet relieves a flat amount of hunger, looked up by the current Food
// Quality upgrade level (state.level.upgrades.foodQuality, 0-4 — see Tank
// Points & Tank Upgrades below). Index 0 is the un-upgraded baseline (60 —
// bumped up from 55 to compensate for the flat rate having no scaling with
// current hunger); each level after that is roughly a 20-25% bump, capping
// at level 4 (100 — a single feed can fully clear even max hunger). Relief
// is not clamped to the fish's current hunger — if it exceeds what's left,
// hunger goes negative, an "overfed" state (see FISH_OVERFEED_STREAK_TARGET
// below — 3 overfeeds in a row instantly grows the fish to adult).
export const FOOD_HUNGER_RELIEF_BY_LEVEL = [60, 65, 75, 85, 100, 115]; // index 0 = unupgraded; 6 entries now that Food Quality goes to level 5, see FOOD_QUALITY_UPGRADE_COSTS
// Eating a pellet also advances that fish's coin-drop timer by this fraction
// of its current stage's dropInterval — e.g. a 20s cycle fed at the 10s mark
// (50% of 20s) immediately drops a coin and restarts the 20s cycle. Makes
// feeding feel like it's what produces the coins, not just a side effect of
// waiting. Now scales with the Food Quality upgrade level instead of the
// upgrade slowing food's fall speed — starts at 25%, +10% per level, capping
// at 75% at max level. The coin-drop timer itself is allowed to overfill
// past its threshold (Entities.js's updateFish subtracts the interval rather
// than resetting to 0 on a drop), so a big feed-bonus jump can both trigger
// an instant coin AND leave the next one arriving sooner, the same way
// hunger is allowed to go negative from an overfed pellet.
export const COIN_TIMER_FEED_BONUS_FRACTION_BY_LEVEL = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75];
// How many Food-fed "overfeeds" in a row (a feed whose flat relief pushes
// hunger negative) instantly grow a non-adult fish straight to adult on that
// same feed — per direct request, rewards feeding a fish before it's really
// hungry. Resets to 0 on any feed that doesn't overfeed. See Entities.js's
// updateFish (fish.overfeedStreak) and FOOD_HUNGER_RELIEF_BY_LEVEL above.
export const FISH_OVERFEED_STREAK_TARGET = 3;
// Same idea, for a non-Scavenger fish's Waste poop timer — per direct
// request ("make it so that food fills up the waste meter of a fish by
// 25%, if the fish produces waste, similar to how food also makes money
// produce faster"). Deliberately a separate, smaller fraction from the
// coin-timer bonus above (25%, not 50%) — feeding shouldn't speed up
// dirtying the tank as much as it speeds up getting paid.
export const WASTE_TIMER_FEED_BONUS_FRACTION = 0.25;
// Design rule: no species should reach the seek-threshold faster than every
// 13.2s (i.e. hungerRate should stay <= HUNGER_SEEK_THRESHOLD/13.2 = 3.56).
// hungerRate is flat per species now (growth stage no longer accelerates
// feeding cadence — mid/adult used to get hungry faster than baby; that's
// been removed so hunger pacing is the same across a fish's whole life).
export const FISH_VERTICAL_DAMPING = 0.5; // fish drift less on the vertical axis than horizontal, reads more like swimming than bouncing
export const WANDER_INTERVAL_MIN_S = 1; // seconds between random direction changes while not seeking food
export const WANDER_INTERVAL_MAX_S = 2;

// A mid- or adult-stage fish gets a fin (a small one at mid, growing at
// adult — still smaller than the single fixed size this used to be) that
// wags faster the faster the fish is currently moving (TAIL_WAG_RATE
// converts px/sec of speed into radians/sec of tail phase), so it reads as
// swimming rather than gliding. Only the adult stage also gets an eye.
export const TAIL_LENGTH_RATIO = 0.40; // adult fin length, relative to FISH_BASE_SIZE*scale — 10% shorter than the previous 0.44
export const TAIL_WIDTH_RATIO = 0.28; // adult fin base half-width, relative to size — 10% narrower than the previous 0.31
export const TAIL_SWING_RATIO = 0.35; // how far the fin tip swings off-center, relative to size
export const TAIL_WAG_RATE = 0.24; // radians of fin phase per (px/sec of fish speed) per second — 10% slower than the previous 0.27
export const MID_STAGE_FIN_SCALE = 0.5; // mid-stage fin size, as a fraction of the adult fin's TAIL_LENGTH_RATIO/TAIL_WIDTH_RATIO

// Only the adult (final growth stage) gets an eye that tracks whichever is
// closer, the cursor or the nearest food — the pupil offsets within its
// socket toward that point. Growth now reads visually: baby = plain body,
// mid = small fin only, adult = bigger fin + eye.
export const EYE_OFFSET_X_RATIO = 0.22; // eye socket position toward the front (facing direction), relative to size
export const EYE_OFFSET_Y_RATIO = 0.12; // eye socket position above center, relative to size
export const EYE_SOCKET_RADIUS_RATIO = 0.14; // white of the eye, relative to size
export const EYE_PUPIL_RADIUS_RATIO = 0.07; // pupil, relative to size
export const EYE_PUPIL_OFFSET_RATIO = 0.5; // how far the pupil can travel from the socket's center, as a fraction of the socket radius

// ---- Tank Points & Tank Upgrades (Phase 2) ----
// state.level.tankPoints = { total, available } — level-scoped like every
// other progression currency introduced this phase (Tier, money), not
// state.meta: a restart wipes both back to 0 same as everything else in
// state.level. Entities.js awards TANK_POINT_PER_ADULT_FISH every time a
// fish's growth stage transitions into its final (adult) stage — never at
// creation time, so Shift+G/cheat-spawning an already-grown fish can't farm
// points. `available` is what purchases spend; `total` never decreases
// (lifetime-earned, in case a later phase wants it for stats/achievements).
export const TANK_POINT_PER_ADULT_FISH = 1;
export const TANK_POINT_COLOR = '#ffcc4d'; // floating "+1 Tank Point!" text color, and the panel's accent

// Food Quality's own 5-level cost ladder — was a flat [1,2,3,4] 4-level
// ladder, bumped up and extended a level per direct request that upgrades
// felt too cheap/fast to max out. Placeholder balance, same as every other
// economy constant here — tune once real playtesting exists. Per a later
// direct request ("make it cost 1 tank point for the first upgrade" — Food
// Quality is now the Tank Upgrades panel's first card and the Tank Point
// tutorial's own target, replacing the removed Coin Capacity in both roles),
// level 1's cost dropped from 2 to 1, same "always affordable off a
// player's very first-ever Tank Point" reasoning the old Coin Capacity
// node's own level-1 discount used.
export const FOOD_QUALITY_UPGRADE_COSTS = [1, 5, 15, 30, 50]; // Tank Points
export const FOOD_QUALITY_UPGRADE_MAX_LEVEL = FOOD_QUALITY_UPGRADE_COSTS.length;
// FOOD_HUNGER_RELIEF_BY_LEVEL and COIN_TIMER_FEED_BONUS_FRACTION_BY_LEVEL
// above are the other two halves of Food Quality — food no longer falls
// slower per level (per direct request, replaced by the coin-timer bonus
// scaling instead).

// Fish Movement and Food Capacity share a separate, much longer and cheaper
// 9-level ladder — per direct request, several more levels than Food
// Quality's 5 but far cheaper per level, so these two read as a steady
// trickle of small wins rather than Food Quality's steeper climb. Index 0 =
// cost of level 1 (must already be at level N-1 to buy level N — UI.js
// enforces this, not Config.js). Placeholder balance, same as every other
// economy constant here — tune once real playtesting exists. (Used to be
// shared with Food Capacity's own cost table, back when that upgrade
// existed — see the retired-mechanic note further down.)
export const FISH_MOVEMENT_UPGRADE_COSTS = [1, 3, 6, 10, 15, 20, 25, 30, 35]; // Tank Points
export const FISH_MOVEMENT_UPGRADE_MAX_LEVEL = FISH_MOVEMENT_UPGRADE_COSTS.length;
// Every SPECIES row's swimSpeed below is already reduced by exactly this
// much from its originally-tuned value — buying Level 1 restores the
// original speed; every level after pushes past it. Applied live (not baked
// into a fish at spawn time) so buying a level speeds up every fish already
// in the tank immediately, not just future spawns — see Entities.js's
// effectiveSwimSpeed(). Left as a flat px/sec bonus per level (not a
// percentage) per direct request to leave this mechanic's formula alone.
export const FISH_MOVEMENT_UPGRADE_SPEED_BONUS = 5; // px/sec per level
// A flat 10% speed bump across every species, applied once at the single
// choke point every fish speed calc already reads through
// (Entities.js's effectiveSwimSpeed) rather than editing all 18 SPECIES
// rows' swimSpeed individually — per direct request. Stacks with the Fish
// Movement Tank Upgrade bonus above (the whole sum gets the 10%, not just
// the base stat).
export const FISH_SPEED_MULTIPLIER = 1.1;

// Food Capacity cap and its Tank Upgrade (FOOD_MAX_ON_SCREEN_BASE,
// FOOD_CAPACITY_UPGRADE_*) are retired entirely, per direct request —
// replaced below by FOOD_STATIONARY_TO_WASTE_MS, a mechanic that doesn't
// limit how much food can exist at all, just how long an ignored pellet
// sticks around before it stops being food.

// Coin Cap is gone entirely, per direct request ("Remove the coin cap limit
// from the game completely, and the upgrades for it") — a fish's coin drop
// is never blocked any more (see Entities.js's updateFish), so there's no
// cap table/upgrade-cost table/max-level constant left to read here at all.
// Two one-time Tank Upgrade unlocks, per direct request — same shape as the
// old (now-removed) Fish Merging card: a flat cost, a boolean flag in
// state.level.upgrades, no leveled ladder. "Electricity Graph" gates the
// #hud-power click-to-open rolling graph popup AND its dropdown arrow (the mw
// text readout itself still shows unconditionally once Electric Eel is
// unlocked, unaffected — only the graph/arrow are hidden behind this);
// "Wave Countdown" gates the Alien Wave/timer lines in the new Tab-toggled
// Base Stats panel (UI.js's statsPanel) instead of a HUD readout — per
// direct request, alien wave/timer moved off the HUD entirely. The old
// "Gold/min Stat" Tank Upgrade is gone entirely, per a later direct request
// ("give the player access to that info from the very beginning, so remove
// it from the tank upgrade as well") — Gold/min is now an unconditional line
// in the Base Stats panel, no purchase needed.
export const ELECTRICITY_GRAPH_UNLOCK_COST = 2; // Tank Points
export const WAVE_COUNTDOWN_UNLOCK_COST = 3; // Tank Points

// Used by the Science Cap HUD readout (UI.js's updateHUD) — the live
// count/max ratio at or above which the readout pulses red continuously, per
// direct request. Used to also gate the now-removed Coin Cap readout the
// same way; Science Cap is the only cap left in the game.
export const CAP_WARNING_THRESHOLD_FRACTION = 0.8;

// Science ("Bubble") Cap — upgraded exclusively through the Science Lab
// instead of Tank Points — per direct request. Priced like every other Lab
// node (both Science AND gold at once). Originally a single leveled card
// above the branching tree; per a later direct request ("change the max
// science upgrades so each one is a separate icon... instead of 5 times on
// the same icon") it became 5 chained one-time nodes INSIDE the tree instead
// (`science_cap_1..5` in SCIENCE_LAB_UPGRADES) — these two cost arrays are
// what those nodes' scienceCost/goldCost read from, one index each. The
// `science_cap_1` node ("Bubble Cap 10") was later removed entirely, per
// direct request — the player now starts with 10 already allowed (index 0
// below) — so `SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[0]`/`_GOLD_COSTS[0]` (its
// own cost pair) are unused now; left in place rather than reshuffling the
// array and every remaining node's (`science_cap_2`..`_5`) own fixed index
// into it. Per direct request ("double the bubble cap limit across the
// board — start with 20, first upgrade is 40, then 60, then 80, then 100")
// the whole table is doubled from its old 10/20/30/40/50 progression; the
// science half of every node's own cost is also doubled (gold left
// untouched) — see this array's own values vs. the old 10/20/35/60/100.
export const SCIENCE_CAP_BY_LEVEL = [20, 40, 60, 80, 100]; // index 0 = unupgraded default
export const SCIENCE_CAP_UPGRADE_SCIENCE_COSTS = [20, 40, 70, 120, 200]; // placeholder balance, tune once real playtesting exists; index 0 unused, see comment above
export const SCIENCE_CAP_UPGRADE_GOLD_COSTS = [500, 1500, 3500, 7500, 15000]; // untouched — per direct request, only science costs doubled, gold stays the same

// The old "Defensive Capabilities" locked placeholder card is gone from the
// Tank Upgrades panel entirely, per direct request — click damage/turret
// fire-rate upgrades now live in the Science Lab's own tree instead (see
// SCIENCE_LAB_UPGRADES' turret_fire_rate_1/_2 nodes) rather than a second,
// duplicate slot here.

// ---- Shop preview canvas ----
// The species preview in the shop draws a live, stationary adult-stage fish
// (via FishRenderer.js's drawFish, the same one the real tank uses) instead
// of a plain color swatch. It idles in place: tail wagging continuously,
// periodically flipping which way it's "facing" so it doesn't look frozen.
export const SHOP_PREVIEW_CANVAS_SIZE = 60; // px, both width and height of the preview <canvas>
export const SHOP_PREVIEW_TAIL_PHASE_RATE = 8; // radians/sec — a fixed idle wag rate, since this fish never actually moves so there's no real "speed" to derive it from
export const SHOP_PREVIEW_FLIP_MIN_S = 2; // shortest time before the preview flips facing direction
export const SHOP_PREVIEW_FLIP_MAX_S = 4; // longest time before it flips

// ---- Presentation ----
export const FISH_COLORS = {
  guppy: '#ffa94d',
  dartfin: '#4dd2ff',
  blimpfish: '#ff8a65', // was purple (#c77dff) — pinkish-orange now, per direct request; Octopus took over the purple slot instead
  // The 3 utility species previously had no entry here at all (silently
  // falling back to FishRenderer.js's plain white default) — per direct
  // request, each now gets its own distinct, thematic color: Suckerfish
  // teal/green, Electric Eel yellow, Science Octopus purple.
  suckerfish: '#2dd4a5',
  electric_eel: '#ffd93d',
  octopus: '#a663ff',
};

// ---- Species table (§4) ----
// Fish is a single species-driven entity (Entities.js). Adding a species
// means adding a row here plus, at most, one small behavior function —
// never a new class hierarchy.
// Behavior tags: FEEDER, SCAVENGER, GENERATOR, RESEARCHER — the four in active
// use. HUNTER and GRID_WALKER are held over from an early draft and currently
// unassigned to any species; Phase 5+ combat direction is undefined pending a
// future design pass (see CLAUDE.md "Species Roster & Progression").
// A hybrid's `behavior` array is the union of its two parents' tags — see the
// `parents` field below.
export const SPECIES = {
  // ---- Tier 1 — Feeding (Phase 1, unlocked from the start) ----
  guppy: {
    id: 'guppy', name: 'Guppy', tier: 1, cost: 15, // cut from 20 per direct request
    description: 'The baseline. Cheap, sturdy, drops coins steadily.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 35, // px/sec — 5 below the original 40; the Level 1 Fish Movement Tank Upgrade restores it, see Config.js's FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 300000, // ms, not enforced until a later phase
    hungerRate: 1.218, // hunger points/sec — 25% slower again per direct request ("all fish get hungrier 25% slower"); was 1.624
    // Per direct request ("fish spawn coins at the same rate as adult, they
    // are just worth more value...") — every stage shares the ADULT's own
    // dropInterval, so growing up no longer speeds up production at all,
    // only raises the payout. Coin value cut twice since: first to a flat
    // $7/$10/$13 ("range from 7-13 instead of 8-16"), then down again to
    // $5/$7/$9 per direct request ("too close to the blimpfish in economy")
    // — Guppy is meant to read as the cheap/low-value baseline, clearly
    // below Blimpfish's own values. Most recently, per direct request
    // ("make coins worth ~25% more but drop ~80% as often, for all fish"),
    // dropValue *= 1.25 and dropInterval /= 0.8 (same "rate-based" ÷X
    // convention this file already uses for "X% as often" — see e.g.
    // WASTE_POOP_INTERVAL_MS's own comment) across all 3 base feeders.
    // Per direct request ("make the fish coin values 15-20% more, the game
    // scales slightly too slowly right now") — a flat 1.2x on top of the
    // prior pass's numbers, same convention as every other "% more" comment
    // in this file (dropValue *= 1.2, dropInterval untouched).
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 24228, dropValue: 7.5 }, // stage 1: hatchling
      { feedsRequired: 2, scale: 0.75, dropInterval: 24228, dropValue: 10.5 }, // stage 2: juvenile
      { feedsRequired: 4, scale: 1.0, dropInterval: 24228, dropValue: 13.5 }, // stage 3: adult
    ],
    // Per-species multiplier on the flat WASTE_POOP_INTERVAL_MS fish-poop
    // timer (Entities.js's updateFish) — omitted here since Guppy IS the
    // baseline every other multiplier below is described relative to (an
    // implicit 1, via `|| 1` at the read site).
    unlockedByDefault: true,
  },
  dartfin: {
    id: 'dartfin', name: 'Dartfin', tier: 1, cost: 8, // cut from 10 per direct request
    description: 'Cheaper and faster. Frequent low-value coins reward density.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 65, // -5, see FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 240000,
    hungerRate: 0.948, // 25% slower again per direct request — was 1.264 — lowest coin value of the three, so it's the least demanding to keep fed
    // Per direct request, flat baby/mid/adult dropValue of 3/4/5 (replacing
    // the old 0.5x/0.75x/1.0x-of-adult scaling) — a simple, easy-to-read
    // progression rather than a computed fraction. dropInterval retuned to
    // 16500ms (up from 11728) to land the effective $/min back in the
    // originally-requested "about 10-19" band despite the new, slightly
    // higher dropValues: baby ~$10.9/min, mid ~$14.5/min, adult ~$18.2/min
    // (dropValue/dropInterval*60000) — still shared flatly across all 3
    // stages, same "same rate as adult the whole time, only value climbs"
    // mechanic every base feeder uses.
    // Per direct request ("make the fish coin values 15-20% more") — flat
    // 1.2x on dropValue, same as every other coin-dropping base feeder.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 16500, dropValue: 3.6 }, // hatchling
      { feedsRequired: 2, scale: 0.75, dropInterval: 16500, dropValue: 4.8 }, // juvenile
      { feedsRequired: 4, scale: 1.0, dropInterval: 16500, dropValue: 6 }, // adult — still the high-frequency coin firehose of the three, just slightly less so
    ],
    // 10% slower waste production than Guppy, per direct request — same
    // "÷(1-x)" convention this codebase already uses for "X% slower"
    // (see e.g. WASTE_POOP_INTERVAL_MS's own ÷0.7 "30% slower" comment
    // elsewhere in this file), applied as a per-species multiplier on the
    // shared WASTE_POOP_INTERVAL_MS baseline instead of a flat override, so
    // it stays correctly relative if that shared constant is ever retuned.
    wastePoopIntervalMultiplier: 1 / 0.9,
    unlockedByDefault: true,
  },
  blimpfish: {
    id: 'blimpfish', name: 'Blimpfish', tier: 1, cost: 40, // cut from 60 per direct request
    description: 'Expensive and sluggish. Voracious appetite, rare high-value coins.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 17, // 10% faster than the original 20, then -5, see FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 360000,
    hungerRate: 1.554, // 25% slower again per direct request — was 2.072 — highest coin value of the three, so it's still the most demanding to keep fed
    // Same "share the adult's own dropInterval" treatment as Guppy/Dartfin
    // above — every stage fires at the same interval, that old per-stage
    // speed-up (41852/35802/29259) is gone. Baby dropValue was tuned to land
    // at ~$26/min before the pass below; per direct request ("make coins
    // worth ~25% more but drop ~80% as often, for all fish"), dropValue *=
    // 1.25 and dropInterval /= 0.8 across all 3 stages, same as every other
    // feeder — the effective $/min for each stage scales by the same net
    // 1.25/0.8 = 1.5625x this produces everywhere.
    // Per direct request ("make the fish coin values 15-20% more") — flat
    // 1.2x on dropValue, same as every other coin-dropping base feeder.
    growthStages: [
      { feedsRequired: 0, scale: 0.6, dropInterval: 36574, dropValue: 19.05 }, // hatchling
      { feedsRequired: 2, scale: 0.8, dropInterval: 36574, dropValue: 24.75 }, // juvenile
      { feedsRequired: 4, scale: 1.0, dropInterval: 36574, dropValue: 33 }, // adult
    ],
    // 5% faster waste production than Guppy, per direct request — same
    // per-species multiplier mechanism as Dartfin's own (slower) one above,
    // just the "faster" ("*(1-x)") side of the same convention.
    wastePoopIntervalMultiplier: 0.95,
    unlockedByDefault: true,
  },

  // ---- Utility base species (Phase 3-4 scaffold, data only) ----
  // unlockPhase marks when each row is intended to become reachable — see
  // CLAUDE.md "Species Roster & Progression" for the full rollout schedule.
  // None of these are in speciesUnlocked yet (unlockedByDefault: false), so
  // they're inert until a later phase's unlock logic adds them.
  // The 3 utility species now grow up through the same feed-driven 3-stage
  // ladder the base feeders use (baby/mid/adult, feedsRequired 0/2/4) instead
  // of a single fixed-adult stage — per direct request ("utility fish should
  // grow up too"). Only the numbers FishRenderer.js's growth-shape switch and
  // Entities.js's behavior-scaling read differ from a base feeder: baby and
  // mid both use the SAME (slower/juvenile) behavior numbers — the request
  // only ever gave a baby figure and an adult figure, never a separate mid
  // one, so mid is grouped with baby functionally (still a juvenile) even
  // though it's a visually distinct growth stage. Only an Adult (final
  // stage) may be used as a Gene-Splicing source — see Entities.js's
  // isSpliceSource.
  suckerfish: {
    id: 'suckerfish', name: 'Suckerfish', tier: 2, unlockPhase: 3, cost: 20, // cut from 25 per direct request
    description: 'Only eats Waste, never Food — keeps the tank clean. Cannot die from hunger.',
    behavior: ['SCAVENGER'], dropType: 'waste_cleared',
    swimSpeed: 30, lifespan: 300000,
    hungerRate: 0.609, // 25% slower again per direct request — was 0.812. Entities.js's updateFish targets Waste items (never Food) for any species carrying the SCAVENGER tag. Deliberately flat across all 3 stages (unlike dropInterval below) — per direct request, a baby eats less OFTEN than an adult but still starves on the same overall clock.
    // dropInterval is repurposed for a Scavenger as its EAT COOLDOWN — the
    // minimum time between two waste-eating events, not a coin-drop timer
    // (dropValue stays 0, unused) — see Entities.js's updateFish SCAVENGER
    // branch. Quadrupled from the old 35s baby/mid / 25s adult, capped at
    // "up to 3 times/min" per direct request — both bounds land on the same
    // 20000ms floor (35000/4=8750 and 25000/4=6250 both undercut the 20000ms
    // cap, so the cap wins for every stage), which also unifies baby/mid/adult
    // onto one eating rate. hungerRate (below) is deliberately untouched —
    // "make it take just as long as it currently does to die from starvation."
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 20000, dropValue: 0 },
      { feedsRequired: 2, scale: 0.75, dropInterval: 20000, dropValue: 0 },
      { feedsRequired: 4, scale: 1.0, dropInterval: 20000, dropValue: 0 },
    ],
    unlockedByDefault: false,
  },
  electric_eel: {
    id: 'electric_eel', name: 'Electric Eel', tier: 2, unlockPhase: 3, cost: 35, // cut from 80 per direct request
    description: 'Primary MW supply based on movement speed. Must be fed to keep generating.',
    behavior: ['GENERATOR'], dropType: 'power',
    swimSpeed: 20, lifespan: 300000, hungerRate: 0.582, // 25% slower again per direct request — was 0.776
    // pixelsPerMW replaces the old timer+speed-multiplier scheme for a pure
    // Generator, per direct request ("makes baby eels generate 1mw per pixel
    // swam, and adults generate 2MW per pixel swam") — a literal
    // distance-traveled meter instead of an indirect speed ratio, so a faster
    // eel (upgrades, seek-chases) naturally generates faster with no separate
    // multiplier needed. Lower pixelsPerMW = more MW per pixel, so "1MW per
    // pixel" is pixelsPerMW: 1 and "2MW per pixel" is pixelsPerMW: 0.5 — cut
    // from the old 10/5 (which was 1MW per 10px / 1MW per 5px). See
    // Entities.js's updateFish GENERATOR branch/fish.distanceAccumPx.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, pixelsPerMW: 1 },
      { feedsRequired: 2, scale: 0.75, pixelsPerMW: 1 },
      { feedsRequired: 4, scale: 1.0, pixelsPerMW: 0.5 },
    ],
    unlockedByDefault: false,
  },
  octopus: {
    id: 'octopus', name: 'Science Octopus', tier: 3, unlockPhase: 4, cost: 60, // cut from 90 per direct request
    description: 'Slowly brews Science Bubbles — requires a Collector building to gather them.',
    behavior: ['RESEARCHER'], dropType: 'science_blue',
    swimSpeed: 25, lifespan: 300000, hungerRate: 0.468, // 25% slower again per direct request — was 0.624
    // dropInterval is now a real long brew cycle, not a short speed-scaled
    // tick — per direct request ("a full minute at base... every 70 seconds
    // as a baby, every 50 seconds as an adult"). dropValue is the number of
    // physical Science bubbles spawned once the cycle completes (always 1
    // here) — see Entities.js's updateFish RESEARCHER branch and
    // SCIENCE_PROGRESS_TICKS for the "+0.1" progress-bubble feedback shown
    // every tenth of the way through.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 70000, dropValue: 1 },
      { feedsRequired: 2, scale: 0.75, dropInterval: 70000, dropValue: 1 },
      { feedsRequired: 4, scale: 1.0, dropInterval: 50000, dropValue: 1 },
    ],
    unlockedByDefault: false,
  },

  // ---- Gene-Splicing hybrids — completely reworked, per direct request ----
  // The old 12-hybrid roster (3 "tracks" × feeder/utility-utility
  // combinatorics, each just a generic behavior-tag union with scaled stats)
  // is gone entirely, replaced by exactly 3 hybrids, each a genuinely unique
  // hand-built mechanic rather than a formula. `parents: [utilityId,
  // economyId]` is unchanged — Entities.js's getHybridSpeciesId still
  // reverse-looks-up a SPECIES row by this field, so the drag-a-utility-
  // fish-onto-an-adult-economy-fish splice interaction itself needed no
  // code changes at all, only new data here. `behavior` is deliberately NOT
  // the union of both parents' tags any more for any of these three — each
  // one's real mechanic is hand-implemented in Entities.js/Grid.js by
  // checking `fish.speciesId` directly (see updateFish's dedicated
  // branches), so the generic FEEDER/
  // SCAVENGER/GENERATOR/RESEARCHER production paths would only get in the
  // way if left on. Buffer Fish is the one exception, keeping the
  // SCAVENGER tag — its bespoke "eats Waste, produces Food" mechanic is
  // layered ON TOP of the ordinary Suckerfish-style eat-cooldown/targeting
  // that tag already provides, rather than replacing it.
  // Renamed 'Eel-Blimp' -> 'Blimp-Battery' -> 'Battery fish' across two
  // separate direct requests — the id (eel_blimp) is left alone both times,
  // an internal identifier other code/nodes reference, not a player-facing
  // "mention."
  eel_blimp: {
    id: 'eel_blimp', name: 'Battery fish', tier: 4, unlockPhase: 4, cost: 130,
    description: 'Electric Eel × Blimpfish — a living 1GW battery for the power grid. Stores surplus generation and covers shortfalls before efficiency ever drops. Feed it Mutagen Paste for double production and a temporary 2GW capacity boost.',
    behavior: [], dropType: 'battery', parents: ['electric_eel', 'blimpfish'],
    swimSpeed: 19, lifespan: 300000, hungerRate: 1.068,
    // pixelsPerMW drives its own bespoke power-generation mechanic (see
    // updateFish's speciesId==='eel_blimp' branch) — same distance-traveled
    // formula the Electric Eel itself uses, at its adult rate.
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropValue: 0, pixelsPerMW: 0.5 }],
    unlockedByDefault: false,
  },
  // Renamed 'Buffer Fish' -> 'Magnet Fish' per direct request — the id
  // (buffer_fish) is left alone, an internal identifier other code/nodes
  // reference, not a player-facing "mention." Its magnet is no longer
  // Waste-only either, per that same direct request ("make it so the buffer
  // fish can attract any object the same way they attract waste, when
  // turned on in the modal") — see Entities.js's fish.magnetFilterItems and
  // main.js's right-click filter modal (openMagnetFishFilterMenu).
  buffer_fish: {
    id: 'buffer_fish', name: 'Magnet Fish', tier: 4, unlockPhase: 4, cost: 70,
    description: 'Suckerfish × Guppy — right-click it to toggle its magnet on/off (single-click opens its info instead), then hold a long left-click on it to choose what it attracts (Waste by default). Still eats Waste like a Suckerfish, but converts what it eats into Food instead of just relieving its own hunger.',
    behavior: ['SCAVENGER'], dropType: 'waste_to_food', parents: ['suckerfish', 'guppy'],
    swimSpeed: 33, lifespan: 300000, hungerRate: 0.914,
    // dropInterval is this pure Scavenger's eat cooldown, same "up to 3
    // times/min" cap every other pure Scavenger shares.
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 20000, dropValue: 0 }],
    unlockedByDefault: false,
  },
  // Two more bespoke hybrids, per direct spec. Both keep the SCAVENGER/
  // RESEARCHER tag their real-production parent already carries — the
  // click-toggle mechanic is a bonus layered on top, not a full behavior
  // replacement, same "Buffer Fish keeps eating Waste, just also makes Food"
  // precedent the original 3 hybrids already established.
  // Renamed 'Zap Sucker' -> 'Feeder Fish' per direct request, alongside a
  // real mechanic change to match — see updateFish's own comment on the
  // isPureGenerator branch for the "no power while making food" half.
  zap_sucker: {
    id: 'zap_sucker', name: 'Feeder Fish', tier: 4, unlockPhase: 4, cost: 90,
    description: 'Electric Eel × Suckerfish — right-click it to toggle its automatic Food dispenser on/off (single-click opens its info instead). While OFF, it generates power like an Electric Eel; while ON, it spits out one Food item every 6 seconds (no feeding required to trigger it) and generates no power at all. Still eats Waste either way.',
    behavior: ['SCAVENGER', 'GENERATOR'], dropType: 'auto_food', parents: ['electric_eel', 'suckerfish'],
    swimSpeed: 30, lifespan: 300000, hungerRate: 0.9,
    // pixelsPerMW (Generator half) and dropInterval (Scavenger eat-cooldown
    // half) both reuse the exact fields the two parent mechanics already
    // read — see updateFish's isPureGenerator/isPureScavenger branches.
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 20000, dropValue: 0, pixelsPerMW: 1 }],
    unlockedByDefault: false,
  },
  // `parents: ['octopus', 'alien_t1']` — per direct request ("you shouldn't
  // be able to purchase it from the shop, it's strictly a hybrid"), a real
  // hybrid now, not a directly-buyable species. This is a deliberate,
  // narrow reuse of the `parents` field purely so the shop's existing
  // `!s.parents` filter hides it like every other hybrid — the actual splice
  // (Entities.js's canSpliceOctopusWithAlien/spliceOctopusWithAlien) is a
  // bespoke, alien-aware pair of functions, NOT the standard
  // getHybridSpeciesId/createHybridFish fish+fish pipeline (an alien entity
  // has no speciesId/starTier for that pipeline to carry over), so this
  // field is never actually read by that reverse lookup in practice.
  // Obtained by dragging a grown Science Octopus onto a living Tier 1 alien
  // that specifically hatched from an Alien Egg (Entities.js's own
  // hatchedFromEgg flag) — an ordinary wave-spawned Tier 1 does NOT qualify.
  xeno_octopus: {
    id: 'xeno_octopus', name: 'Bio Fish', tier: 4, unlockPhase: 4, cost: 100, parents: ['octopus', 'alien_t1'], // renamed from 'Xeno Octopus' per direct request; id left alone, same precedent as eel_blimp's own rename
    description: 'A hybrid of an Alien and a Science Octopus — not purchasable directly. Drag a grown Octopus onto a Tier 1 alien that hatched from an Alien Egg (an ordinary wave-spawned alien won\'t do) to splice them together. Right-click it to toggle Bio-Sludge mode (single-click opens its info instead) — while on, it brews and spits out Bio-Sludge every 8 seconds instead of Science Bubbles. Still needs to be fed like any other fish.',
    behavior: ['RESEARCHER'], dropType: 'science_blue',
    swimSpeed: 25, lifespan: 300000, hungerRate: 0.468,
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 70000, dropValue: 1 },
      { feedsRequired: 2, scale: 0.75, dropInterval: 70000, dropValue: 1 },
      { feedsRequired: 4, scale: 1.0, dropInterval: 50000, dropValue: 1 },
    ],
    unlockedByDefault: false,
  },
};

export const SPECIES_LIST = Object.values(SPECIES);

// ---- Buildings (Phase 2, Seabed Platform architecture) ----
// Every placeable seabed tile is a data row here, same pattern as SPECIES —
// adding a building means adding a row, not new placement code. `cost` is
// spent from state.level.money on placement (UI.js); removing a tile refunds
// cost * TILE_REFUND_FRACTION. `color` drives both the build-palette icon and
// the placed tile's render (Grid.js) and ghost-preview (main.js).
// unlockedByDefault is false across the board — nothing is available at
// level start. See TIER_UNLOCKS below for what the Mound grants at each
// tier, and Mound.js.
//
// Placement: any building can be placed on any empty tile anywhere in the
// seabed band (Grid.js's canPlaceTile — bounds/occupancy/cost are the only
// checks left) — nothing needs to anchor to a Platform or the seabed floor
// any more. Per direct request, buildings can "float" freely in the city;
// Platform itself is now purely an optional routing aid (a cheap flat
// surface to catch falling items before a Fan/Processor grabs them), not a
// structural requirement anything else depends on.
// Full refund on removal (100%, not a fraction any more) — per direct
// request, since removal is a deliberate action (hovering a building with
// the Food tool and pressing D — see main.js's updateKeyDDelete, which
// replaced the old standalone Demolish tool entirely) rather than an
// always-available right-click, there's no risk of it being used as a free
// item-conveyor exploit the way a partial-refund policy was originally
// hedging against.
export const TILE_REFUND_FRACTION = 1.0;
// Every building's shop cost is dynamic, mirroring the Economy Fish
// dynamic-pricing pattern (compounding, not additive) — per direct request.
// Platform is a flat $3 regardless of how many are already placed. Every
// other building's live cost is `base * rate^N`, N = how many of that exact
// type are already placed on the grid (Grid.js's getBuildingCost, counted
// live off state.level.grid every call, same "no separate counter to keep
// in sync" approach the fish pricing already uses — demolishing one brings
// the next one's cost back down), rounded UP. `rate` itself is tiered off
// the building's own BASE cost, per direct spec: 3% for a base cost of
// $100 or less, 6% for $101-200, 9% above $200 — a $300 Manufacturer scales
// noticeably faster than a $15 Rudimentary Fan. Tile *removal* still
// refunds off this exact live formula (evaluated while the tile being
// removed still counts toward its own N — see Grid.js's removeTile), not a
// separately-tracked original cost.
export const PLATFORM_FLAT_COST = 3;
export const BUILDING_COST_GROWTH_RATE_TIER1 = 1.03; // base cost <= $100
export const BUILDING_COST_GROWTH_RATE_TIER2 = 1.06; // base cost $101-200
export const BUILDING_COST_GROWTH_RATE_TIER3 = 1.09; // base cost > $200
export const BUILDING_TYPES = {
  [TILE_PLATFORM]: {
    id: TILE_PLATFORM, name: 'Platform', icon: '🧱', cost: PLATFORM_FLAT_COST,
    description: 'Solid floor. Items land and rest on top — cheap, optional item routing. Click to filter which items pass through. Press R to cycle platform shape.',
    color: '#dba36f', unlockedByDefault: true, // available from level start, unchanged — no longer load-bearing for whether anything ELSE can be placed, though (see canPlaceTile's own comment)
  },
  // Same material/cost as plain Platform (see getBuildingCost's own
  // PLATFORM_FLAT_COST check, extended to cover both of these) — just a
  // different shape: a real 45-degree wedge, solid only below its own
  // sloped surface. Per direct request, unlocked from level start same as
  // the flat Platform.
  [TILE_PLATFORM_HALF_LEFT]: {
    id: TILE_PLATFORM_HALF_LEFT, name: 'Half Platform - Left', icon: '◺', cost: PLATFORM_FLAT_COST,
    description: 'A 45° ramp — deflects anything that lands on it down and to the left.',
    color: '#dba36f', unlockedByDefault: true,
  },
  [TILE_PLATFORM_HALF_RIGHT]: {
    id: TILE_PLATFORM_HALF_RIGHT, name: 'Half Platform - Right', icon: '◹', cost: PLATFORM_FLAT_COST,
    description: 'A 45° ramp — deflects anything that lands on it down and to the right.',
    color: '#dba36f', unlockedByDefault: true,
  },
  [TILE_PLATFORM_HALF_TOPLEFT]: {
    id: TILE_PLATFORM_HALF_TOPLEFT, name: 'Half Platform - Top Left', icon: '◸', cost: PLATFORM_FLAT_COST,
    description: 'A 45° ramp, solid at the top — deflects anything that hits it down and to the right.',
    color: '#dba36f', unlockedByDefault: true,
  },
  [TILE_PLATFORM_HALF_TOPRIGHT]: {
    id: TILE_PLATFORM_HALF_TOPRIGHT, name: 'Half Platform - Top Right', icon: '◿', cost: PLATFORM_FLAT_COST,
    description: 'A 45° ramp, solid at the top — deflects anything that hits it down and to the left.',
    color: '#dba36f', unlockedByDefault: true,
  },
  // Renamed back to plain "Collector" per direct request (an earlier pass
  // had renamed this "Electric Collector" while it briefly drew no power;
  // per a later direct request it's back to costing a small amount again —
  // see PROCESSOR_STATS[TILE_COLLECTOR], 2mw on a coin/4mw on Science). The
  // two tiers above it keep their own already-established names (Advanced/
  // Bio Collector) unchanged. Base cost unchanged at 40.
  [TILE_COLLECTOR]: {
    id: TILE_COLLECTOR, name: 'Collector', icon: '🧲', cost: 40,
    description: 'Auto-banks coins and Science touching it. Draws 2-4mw while collecting.',
    color: '#8fe0b8', unlockedByDefault: false,
  },
  [TILE_COLLECTOR_ELECTRIC]: {
    id: TILE_COLLECTOR_ELECTRIC, name: 'Advanced Collector', icon: '🧲', cost: 60,
    description: 'Faster than the base Collector. Costs less power on a coin than on Science.',
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_COLLECTOR_ADVANCED]: {
    id: TILE_COLLECTOR_ADVANCED, name: 'Bio Collector', icon: '🧲', cost: 150,
    description: 'The fastest Collector money can buy.',
    color: '#c9a8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T2]: {
    id: TILE_FAN_T2, name: 'Rudimentary Fan', icon: '🌀', cost: 15,
    description: `Blows a cone of force wherever you aim it — you can filter what gets blown. Free, but short reach (${FAN_T2_MAX_RANGE}px) and weak — struggles to lift a coin. Press G to hide/show every fan's cone.`,
    color: '#9fd8ff', unlockedByDefault: true, // per direct request — no longer gated behind the Mound's old paid "Tier 1.75" step, available from level start alongside Platform/Waste Turret
  },
  [TILE_FAN_T3]: {
    id: TILE_FAN_T3, name: 'Electric Fan', icon: '💨', cost: 45,
    description: `Draws power for medium reach (${FAN_T3_MAX_RANGE}px) — enough to route most coins. Press G to hide/show every fan's cone.`,
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T4]: {
    id: TILE_FAN_T4, name: 'Turbo Fan', icon: '🌪️', cost: 120,
    description: `Longest reach (${FAN_T4_MAX_RANGE}px), gentle enough to suspend a coin mid-air. Draws power. Press G to hide/show every fan's cone.`,
    color: '#2f7fd6', unlockedByDefault: false,
  },
  [TILE_TURRET_WASTE]: {
    id: TILE_TURRET_WASTE, name: 'Waste Turret', icon: '🔫', cost: 40,
    // Per direct request ("change the description of turrets to mention
    // biomass as well") — Biomass now doubles as premium ammo (see
    // BIOMASS_TURRET_DAMAGE_MULTIPLIER/BIOMASS_TURRET_SHOTS_PER_AMMO), for
    // any tile in TURRET_AMMO_TILES (this tier and Electric, below).
    description: 'Auto-fires on the nearest alien with global range. Feeds itself from any Waste (or Biomass, for more damage per shot) touching it.',
    color: '#9c8a6b', unlockedByDefault: true, // free from the start, alongside Platform — the only defense before the Science Lab exists
  },
  [TILE_TURRET_ELECTRIC]: {
    id: TILE_TURRET_ELECTRIC, name: 'Electric Waste Turret', icon: '🔫', cost: 55,
    description: 'Faster and harder-hitting than the Waste Turret with global range. Needs BOTH Waste (or Biomass) ammo and power to fire.',
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_TURRET_ADVANCED]: {
    id: TILE_TURRET_ADVANCED, name: 'Advanced Turret', icon: '🔫', cost: 130,
    description: 'The strongest turret with global range — fastest, hardest-hitting.',
    color: '#c9a8ff', unlockedByDefault: false,
  },
  // Renamed per direct request, same reasoning/shift as the Collector family
  // above — the base tier now draws real power (see
  // REFINERY_STATS[TILE_REFINERY].powerCostPerSec), so it's "Electric" now;
  // every tier above it shifted up one name (old Electric -> Advanced, old
  // Advanced -> Bio). The tier that used to exist above THAT ("Ultra
  // Refinery," gated behind Green Science Tech) is gone entirely per a later
  // direct request ("remove the Ultra Refinery from the game") — Bio
  // Refinery (TILE_REFINERY_ADVANCED) now occupies its old slot/cost/stats
  // instead, making it the new top tier; see REFINERY_STATS and
  // SCIENCE_LAB_UPGRADES' bio_refinery node. Base cost cut 80 -> 30 per
  // direct request.
  [TILE_REFINERY]: {
    id: TILE_REFINERY, name: 'Electric Refinery', icon: '⚗️', cost: 30,
    description: 'Refines Waste -> Food, or Bio-Sludge -> Biomass. One item at a time.',
    color: '#b8a888', unlockedByDefault: false,
  },
  [TILE_REFINERY_ELECTRIC]: {
    id: TILE_REFINERY_ELECTRIC, name: 'Advanced Refinery', icon: '⚗️', cost: 140,
    description: 'Processes Waste (and Bio-Sludge) faster than the Electric Refinery. Draws power while working.',
    color: '#4fd6e0', unlockedByDefault: false,
  },
  [TILE_REFINERY_ADVANCED]: {
    id: TILE_REFINERY_ADVANCED, name: 'Bio Refinery', icon: '⚗️', cost: 400,
    description: 'The fastest Refinery in the game.',
    color: '#ffd76f', unlockedByDefault: false,
  },
  [TILE_MANUFACTURER]: {
    id: TILE_MANUFACTURER, name: 'Manufacturer', icon: '🏭', cost: 125, // cut from 300 per direct request, to compensate for its own tier-2 (6%, base cost $101-200) compounding cost curve
    description: 'Pick a recipe by clicking it once placed. Does nothing until a recipe is chosen.',
    color: '#e690e0', unlockedByDefault: false,
  },
  [TILE_POWER_PLANT]: {
    id: TILE_POWER_PLANT, name: 'Power Plant', icon: '☢️', cost: 350,
    description: 'Pick a fuel recipe by clicking it once placed: Food (20mw/15s), Biomass (40mw/20s), or Blue Science (100mw/30s). Does nothing until a recipe is chosen.',
    color: '#6fff8a', unlockedByDefault: false,
  },
  // Granted by the Mound's $75 tease (see Mound.js's crackMound) rather than
  // unlockedByDefault — the whole point of that step is for THIS to be what
  // finally comes out of it.
  [TILE_STORAGE_CHEST]: {
    id: TILE_STORAGE_CHEST, name: 'Storage Chest', icon: '📦', cost: 20,
    description: `Auto-locks onto the first item type that touches it, holding up to ${STORAGE_CHEST_CAPACITY[TILE_STORAGE_CHEST]}. Drag away from it to aim, then release to start trickling its contents back out.`,
    color: '#c9915a', unlockedByDefault: false,
  },
  [TILE_STORAGE_CHEST_T2]: {
    id: TILE_STORAGE_CHEST_T2, name: 'Storage Chest II', icon: '📦', cost: 60,
    description: `Same as the Storage Chest, just bigger — holds up to ${STORAGE_CHEST_CAPACITY[TILE_STORAGE_CHEST_T2]}.`,
    color: '#8fa8c9', unlockedByDefault: false,
  },
  [TILE_STORAGE_CHEST_T3]: {
    id: TILE_STORAGE_CHEST_T3, name: 'Storage Chest III', icon: '📦', cost: 120,
    description: `The largest Storage Chest — holds up to ${STORAGE_CHEST_CAPACITY[TILE_STORAGE_CHEST_T3]}.`,
    color: '#c9a8ff', unlockedByDefault: false,
  },
};
export const BUILDING_LIST = Object.values(BUILDING_TYPES);
// Buildings that share one shop slot instead of each getting their own icon
// — per direct request, the 3 Fan tiers "stack" into a single spot: UI.js's
// buildBuildPalette shows one button (whichever tier is currently selected
// for that family, defaulting to the highest-unlocked whenever the palette
// rebuilds) with small dots indicating there's more than one option, and
// clicking it again while already selected cycles to the next unlocked tier
// instead of doing nothing. Every building not listed in any family here
// keeps its own single slot, unchanged. Keyed by an arbitrary family id, not
// a tile id, since no single member is "the" family.
export const BUILDING_FAMILIES = {
  fan: [TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4],
  collector: [TILE_COLLECTOR, TILE_COLLECTOR_ELECTRIC, TILE_COLLECTOR_ADVANCED],
  refinery: [TILE_REFINERY, TILE_REFINERY_ELECTRIC, TILE_REFINERY_ADVANCED],
  turret: [TILE_TURRET_WASTE, TILE_TURRET_ELECTRIC, TILE_TURRET_ADVANCED],
  chest: [TILE_STORAGE_CHEST, TILE_STORAGE_CHEST_T2, TILE_STORAGE_CHEST_T3],
  // Not a cost/power tier ladder like the 4 families above — all 5 variants
  // are unlocked from level start and cost the same flat $3 (see
  // getBuildingCost's own PLATFORM_FLAT_COST check). Ordered so the plain
  // flat Platform lands LAST — this family's own "highest unlocked" default
  // (see UI.js's buildBuildPalette, `memberIds[memberIds.length - 1]`) —
  // so clicking the shop slot for the very first time still defaults to
  // the flat Platform everyone's used to, with the four ramps reachable by
  // clicking again (or pressing R) to cycle.
  platform: [TILE_PLATFORM_HALF_LEFT, TILE_PLATFORM_HALF_RIGHT, TILE_PLATFORM_HALF_TOPLEFT, TILE_PLATFORM_HALF_TOPRIGHT, TILE_PLATFORM],
};

// ---- Processor (Collector) tiers ----
// coinMs/scienceMs are how long a single held coin/Blue-Science item takes
// to fully process — Grid.js's updateBuildings/beginCollectorProcessing
// read these by the placed tile's own type. scienceGreenMs is Green
// Science's OWN, separately-tuned duration, per direct request ("green
// science takes 30 seconds for the base collector... 20 seconds for the
// advanced... 12 seconds for the bio collector") — it used to just share
// scienceMs; now every tier gets its own explicit value instead.
// powerCostPerSecCoin/powerCostPerSecScience are drawn only while the tile
// is actively processing that exact kind of item, never while idle/empty,
// and not gated on actual power availability, same not-yet-power-gated
// precedent every other Electric building in this codebase already
// follows — split into two rates per direct request ("the advanced and bio
// collector take half as much energy when collecting coins"), so the
// shop/Lab preview shows a real min-max range (10-20mw/s, 20-40mw/s) rather
// than one flat number. The base tier (plain "Collector" again — see
// BUILDING_TYPES' own comment on the rename) draws NO power at all any
// more, on either kind of item, per direct request.
// The Collector no longer produces Waste at all, on any tier — per direct
// request, it's now a pure banking convenience with no dirty-automation
// downside; the old wasteEveryMs background clock (and its
// state.level.buildingData wasteAccumMs field) is removed entirely, not just
// zeroed. coinMs set to the exact requested 9/6/4 seconds across the 3 tiers.
export const PROCESSOR_STATS = {
  [TILE_COLLECTOR]: { coinMs: 9000, scienceMs: 20000, scienceGreenMs: 30000, powerCostPerSecCoin: 2, powerCostPerSecScience: 4 },
  [TILE_COLLECTOR_ELECTRIC]: { coinMs: 6000, scienceMs: 15000, scienceGreenMs: 20000, powerCostPerSecCoin: 10, powerCostPerSecScience: 20 },
  [TILE_COLLECTOR_ADVANCED]: { coinMs: 4000, scienceMs: 9000, scienceGreenMs: 12000, powerCostPerSecCoin: 20, powerCostPerSecScience: 40 },
};

// ---- Turrets (Alien Invasion) ----
// Exact numbers per direct request: "the waste turret... shoot 1.5 times per
// second, that do 4 damage each shot... The electric turret takes 2mw per
// shot, shoots 2 times per second, and does 6 damage per shot. The advanced
// turret takes 3mw per shot, shoots three times a second, and does 8 damage
// per shot." `powerCostPerSec` for the electric tiers is derived from their
// own per-shot cost × fire rate (2mw × 2/sec = 4, 3mw × 3/sec = 9) so it
// slots into computeCurrentPowerDemand the same way every other Electric
// building's "while actively doing something" draw already does — the
// Waste Turret has none, it runs on ammo instead.
//
// Range used to be a hard TURRET_RANGE (480px) cutoff on target search — per
// direct report ("the waste turrets don't currently shoot at the aliens
// unless they are super close") and direct request ("make it so turrets
// have global range"), that's gone entirely: a turret now always targets
// the nearest LIVING alien anywhere in the level, full stop (Grid.js's
// updateBuildings, no distance check on the search at all). What used to
// provide "reach" is now a real projectile instead (see the
// TURRET_PROJECTILE_* constants below) — the travel time is what makes a
// far-off shot feel like it has distance to cover, not a range gate that
// silently refuses to fire.
// powerCostPerShot doubled across every nonzero tier per direct request
// ("make all the buildings take twice as much electricity as they do right
// now") — 2->4 (Electric), 3->6 (Advanced). powerCostPerShot is the real,
// player-facing number (what the shop displays, per a later direct request
// to show power "per shot, instead of per second") — powerCostPerSec is
// still kept alongside it, purely derived (powerCostPerShot * shotsPerSec),
// for computeCurrentPowerDemand's own rate-based math.
// powerCostPerShot bumped again per direct request ("make the waste turret
// take 6MW per shot and the advanced turret take 15MW per shot") — read as
// the Electric Waste Turret (the base Waste Turret stays free/ammo-only, per
// its own long-standing "runs on ammo instead" design; "waste turret" here
// most plausibly means its Electric tier, the only other turret with "waste"
// in its current name) going 4->6, and the Advanced Turret 6->15.
// powerCostPerSec is still the derived rate (powerCostPerShot * shotsPerSec)
// computeCurrentPowerDemand needs.
// Base shotsPerSec cut again (1.75->1.5, 2->1.75, 3->2.5) per direct
// request, "to compensate" for the two new Turret Fire Rate Lab nodes below
// (each a flat +20%, applied multiplicatively at fire time — see Grid.js's
// getTurretFireRateMultiplier) — fully upgraded, a turret ends up FASTER
// than its old un-upgraded rate (1.5*1.2*1.2=2.16 > 1.75, 1.75*1.44=2.52 >
// 2, 2.5*1.44=3.6 > 3), so this is a temporary nerf for a player who hasn't
// bought either node yet, with genuine net-positive payoff once both are.
// powerCostPerSec recomputed to match the new base shotsPerSec (unaffected
// by the two Lab nodes — those only change fire RATE, not power draw per
// shot, so a fully-upgraded turret does draw its power faster in real time,
// same as it always would from firing more often, with no separate field
// needed to track that).
// powerCostPerShot bumped again per direct request ("make the advanced
// turret take 40mw a shot instead of 15, and make the electric waste turret
// take 10mw a shot") — Electric Waste Turret 6->10, Advanced Turret 15->40;
// powerCostPerSec recomputed to match (powerCostPerShot * shotsPerSec), same
// as every earlier tuning pass here.
export const TURRET_STATS = {
  [TILE_TURRET_WASTE]: { shotsPerSec: 1.5, damage: 2, powerCostPerShot: 0, powerCostPerSec: 0 },
  [TILE_TURRET_ELECTRIC]: { shotsPerSec: 1.75, damage: 6, powerCostPerShot: 10, powerCostPerSec: 17.5 },
  [TILE_TURRET_ADVANCED]: { shotsPerSec: 2.5, damage: 8, powerCostPerShot: 40, powerCostPerSec: 100 },
};
// Which turret tiers consume Waste (or Biomass) as ammo (gating whether they
// can fire at all, alongside the fire-rate cooldown) — per direct request,
// the Electric tier ("Electric Waste Turret") now needs BOTH Waste ammo AND
// power to shoot, not unlimited ammo any more; the Advanced tier stays
// ammo-FREE (never gated on this set — see `hasAmmo` in Grid.js's
// updateBuildings), but per a later direct request it can now optionally
// take Biomass too, through its own entirely separate small pool — see
// ADVANCED_TURRET_MAX_BIOMASS_AMMO/ADVANCED_TURRET_BIOMASS_DAMAGE below,
// which deliberately don't live in this Set/the Waste+Biomass system above
// at all (different cap, different per-shot damage rule, no Waste option).
export const TURRET_AMMO_TILES = new Set([TILE_TURRET_WASTE, TILE_TURRET_ELECTRIC]);
// Each of the two Turret Fire Rate Lab nodes (turret_fire_rate_1/_2, in
// SCIENCE_LAB_UPGRADES) applies this exact same +20% multiplicatively —
// see Grid.js's getTurretFireRateMultiplier, which stacks it once per node
// actually purchased (up to 1.2*1.2 = 1.44x total with both).
export const TURRET_FIRE_RATE_UPGRADE_MULTIPLIER = 1.2;
// Waste Turret ammo — per direct request: "each waste gives it 10 shots and
// it can hold 5 waste (with dots indicating each waste/10 ammo)." Consumes a
// touching Waste item exactly like an Auto-Feeder absorbs one (Grid.js's
// updateBuildings), converting it straight to ammo rather than holding it
// for a timed process — there's no "processing duration" for a turret's own
// intake, only the fire-rate cooldown on the OUTPUT side.
export const WASTE_TURRET_SHOTS_PER_WASTE = 10;
export const WASTE_TURRET_MAX_WASTE = 5; // -> 50 max stored shots from Waste alone
// Biomass doubles as a premium ammo source for any TURRET_AMMO_TILES tier —
// per direct request, it's strictly better than Waste ammo: 50% more damage
// per shot and 15 shots per unit loaded instead of Waste's 10. Tracked as a
// separate counter from Waste ammo (Grid.js's data.ammoBiomass alongside
// data.ammoWaste) rather than one generic pool, since the two need to keep
// dealing different damage per shot even once loaded — updateBuildings'
// turret-fire branch spends from the Biomass pool first whenever it's
// non-empty (using the better ammo you just loaded should feel immediate,
// not saved for "later"), falling back to Waste once it runs dry. Both
// pools share the same WASTE_TURRET_MAX_AMMO combined-shots cap so loading
// stays a meaningful choice rather than just stacking two full reserves.
export const BIOMASS_TURRET_SHOTS_PER_AMMO = 15;
export const BIOMASS_TURRET_DAMAGE_MULTIPLIER = 1.5;
// Per direct report ("make sure the turrets aren't capped at 50 shots too,
// in case they use biomass, it should be able to hold up to 75 shots") — a
// real bug fix, not just a bump: this used to be WASTE_TURRET_SHOTS_PER_WASTE
// * WASTE_TURRET_MAX_WASTE (10*5=50), the exact same cap whether a fully
// Waste-loaded turret (5 waste * 10 = 50, legitimately maxed) OR a fully
// Biomass-loaded one (5 biomass * 15 = 75 shots' worth) held it — the
// Biomass case was silently capped 25 shots short of what 5 units of its own
// premium ammo should have been worth. Deliberately no longer DERIVED from
// WASTE_TURRET_MAX_WASTE at all (a flat number instead) — Waste alone still
// naturally tops out at 50 (still only 5 Waste items ever needed), this cap
// only ever matters once Biomass is involved.
export const WASTE_TURRET_MAX_AMMO = 75;
// ---- Advanced Turret's own optional Biomass-only ammo ----
// Per direct request ("make it so that advanced turrets can accept just
// biomass as ammo, and hold up to 5. The advanced turrets dont need biomass
// to shoot, but if it does have biomass, those shots do 14 damage a shot")
// — a deliberately separate, much smaller system from the Waste+Biomass one
// above: no Waste option at all, no per-unit shots conversion (each absorbed
// Biomass item is worth exactly 1 shot here, not
// BIOMASS_TURRET_SHOTS_PER_AMMO's 15), a flat replacement damage rather than
// a multiplier on the Advanced Turret's own base damage (TURRET_STATS' own
// `damage: 8`), and — critically — never gates firing at all (the Advanced
// Turret isn't in TURRET_AMMO_TILES, so `hasAmmo` in Grid.js's
// updateBuildings is unconditionally true for it regardless of this pool);
// it only ever changes what a shot fired WHILE this pool is non-empty does
// extra damage. Tracked on the tile as data.ammoBiomassAdvanced, spent
// before falling back to the turret's own free/ammo-less base-damage shot,
// same "use the better ammo you just loaded immediately" precedent
// BIOMASS_TURRET_DAMAGE_MULTIPLIER's own comment already established.
export const ADVANCED_TURRET_MAX_BIOMASS_AMMO = 5;
export const ADVANCED_TURRET_BIOMASS_DAMAGE = 14;
// Retired in favor of a real circle-vs-tile touch test (Grid.js's
// isTouchingBuildingTile) — per direct report, this fixed radius left the
// tile's own corners (including the top edge) under-covered, so waste
// resting there wasn't recognized as "touching" even though it visibly was.

// A turret's shot is a real, visible, homing projectile (Entities.js's
// createTurretProjectile/updateTurretProjectiles) — Grid.js's updateBuildings
// only ever decides a shot fired (target, damage, cooldown, ammo) and hands
// that off via a spawn-point-style return value (the same "Grid.js returns
// data, the real owner constructs it" split already used for Food/Waste
// spawn points), rather than applying damage instantly the way the old
// hitscan version did. Per direct request ("it should never miss") the
// projectile HOMES on its target's live position every tick rather than
// flying a fixed straight line, so a moving alien can't dodge it — damage
// only actually applies the tick it visually reaches the target (within
// TURRET_PROJECTILE_HIT_RADIUS), and if that target is somehow already dead
// by then (e.g. a second turret/a click killed it first), the shot just
// fizzles with no damage rather than erroring or double-counting.
export const TURRET_PROJECTILE_SPEED = 900; // px/sec — fast enough that even a full-tank-width shot arrives well under a second
export const TURRET_PROJECTILE_HIT_RADIUS = 14; // px — "arrived" tolerance, a little larger than a bare point so it doesn't need frame-perfect overlap
export const TURRET_PROJECTILE_RADIUS = 4; // px, visual size of the bolt itself
export const TURRET_PROJECTILE_COLOR = '#ffe066'; // a bright, easy-to-track yellow — distinct from every alien/fish/item color already in use

// ---- Refinery family (replaces the Auto-Feeder) ----
// foodProcessMs is how long the Waste->Food recipe takes on that tier, per
// direct spec (20 -> 14 -> 9 -> 5 seconds across the 4 tiers); the Alien
// DNA->Biomass recipe takes ALIEN_DNA_REFINERY_TIME_MULTIPLIER times as long
// on the SAME tile (Grid.js's updateBuildings computes this at runtime
// rather than storing a second constant per tier, since it's always a flat
// 50% multiple of the food time). The base tier (now "Electric Refinery")
// draws 5mw while refining, per direct request — the same generic
// `stats.powerCostPerSec > 0` gate every other tier already uses (see
// updateBuildings/computeCurrentPowerDemand) applies here automatically,
// needing no code change; every tier draws power only while actively
// processing an absorbed item.
export const ALIEN_DNA_REFINERY_TIME_MULTIPLIER = 1.5;
// Per direct request: Advanced Refinery's own waste time cut 14s -> 10s
// (its Bio-Sludge time falls out of the same ALIEN_DNA_REFINERY_TIME_MULTIPLIER
// formula every tier already uses — 10000 * 1.5 = 15000, exactly the
// requested "15 seconds," no separate field needed) and its power draw
// raised 10 -> 15mw/sec. Bio Refinery inherits the old Ultra Refinery's
// exact stats (5000ms/30mw) now that it occupies Ultra's old top-tier slot.
export const REFINERY_STATS = {
  [TILE_REFINERY]: { foodProcessMs: 20000, powerCostPerSec: 5 },
  [TILE_REFINERY_ELECTRIC]: { foodProcessMs: 10000, powerCostPerSec: 15 },
  [TILE_REFINERY_ADVANCED]: { foodProcessMs: 5000, powerCostPerSec: 30 },
};

// ---- Manufacturer recipes ----
// Per direct spec: the Manufacturer does nothing (and draws no power) until
// one of these recipes is picked via its click-to-open pop-up menu
// (UI.js's openRecipeMenu) — `inputs` lists the 2 ingredient item types it
// needs (order doesn't matter, whichever touches first gets absorbed and
// processed first), `output` is the item type it ejects once both have been
// absorbed AND processed. `labNodeId` is the SCIENCE_LAB_UPGRADES node that
// must be purchased before this recipe can even be selected — Grid.js's
// updateBuildings/UI.js's recipe menu both check
// state.meta.labUpgradesPurchased.includes(recipe.labNodeId).
// `powerCostMultiplier`, when present, would scale a recipe's power draw
// while it's actively processing — Grid.js's computeCurrentPowerDemand falls
// back to 1x for any recipe that omits it, which is every recipe today. The
// Alien Egg recipe used to set this to 2x ("takes twice as much electricity
// while running"), back when every ingredient drew the same flat rate; per
// direct request, now that MANUFACTURER_ITEM_POWER_COST_MW already prices
// power per INGREDIENT type, a second, recipe-level multiplier on top of
// that is redundant — Alien Egg (Blue Science + Food) follows the exact same
// per-ingredient cost every other recipe already does, no special case.
// Per direct request, all 3 of the original recipes are now named after
// their own OUTPUT item (matching the pattern the Alien Egg recipe already
// followed) — 'Bio-Feeder'/'Bio-Combustor'/'Bio-Pellets' were flavor names
// for the OLD standalone buildings these recipes replaced, and no longer
// describe what a player actually gets. The object keys themselves (used
// internally as recipeId/labNodeId-adjacent identifiers) are left alone
// except bio_pellets -> bio_sludge, which is a real merge, not just a
// rename — see that entry's own comment below.
// Per direct request, the display order (MANUFACTURER_RECIPE_LIST below,
// object key insertion order) is: Bio-Sludge, Mutagen Paste, Blue Science,
// Alien Egg, Green Science.
export const MANUFACTURER_RECIPES = {
  // Per direct request ("change all other mentions of Alien DNA to
  // Bio-Sludge... to make it clear it's a pre-refined version of the
  // Biomass") — the old standalone `bio_pellets` item (which had no use
  // anywhere else in the game) is retired entirely and this recipe's output
  // is merged into the exact same item Alien DNA already is (type
  // `alien_dna`, just displayed as "Bio-Sludge" everywhere now — see
  // ALIEN_DNA_COLOR/_RADIUS's own comments). This also gives the recipe's
  // output a real downstream use it never had before: the Refinery's
  // existing Alien-DNA(Bio-Sludge)->Biomass recipe.
  // Per direct request ("remove the bio-sludge recipe from the science lab,
  // and have it unlocked for the player right when they unlock the
  // manufacturer") — labNodeId: null means "always available the instant
  // the Manufacturer itself is unlocked," same as POWER_PLANT_RECIPES.food's
  // own null. The old recipe_bio_sludge Lab node is deleted entirely — see
  // SCIENCE_LAB_UPGRADES' own comment for where its former dependents
  // (power_plant_biomass, hybrid_zap_sucker) now point instead.
  bio_sludge: {
    id: 'bio_sludge', name: 'Bio-Sludge', icon: '🧫', color: ALIEN_DNA_COLOR,
    inputs: ['food', 'waste'], output: 'alien_dna', labNodeId: null,
    description: 'Food + Waste -> Bio-Sludge',
  },
  // Object key order drives the recipe pop-up's own display order
  // (MANUFACTURER_RECIPE_LIST = Object.values(...) below) — Blue Science
  // and Mutagen Paste swapped positions per direct request ("switch the
  // recipe order... so blue science is the second recipe").
  bio_combustor: {
    id: 'bio_combustor', name: 'Blue Science', icon: '🔥', color: '#ff9f5a',
    inputs: ['waste', 'biomass'], output: 'science', labNodeId: 'recipe_bio_combustor',
    description: 'Waste + Biomass -> Blue Science',
  },
  bio_feeder: {
    id: 'bio_feeder', name: 'Mutagen Paste', icon: '🩷', color: '#e690e0',
    inputs: ['food', 'biomass'], output: 'mutagen_paste', labNodeId: 'recipe_bio_feeder',
    description: 'Food + Biomass -> Mutagen Paste',
  },
  alien_egg: {
    id: 'alien_egg', name: 'Alien Egg', icon: '🥚', color: '#c9a86b',
    inputs: ['science', 'food'], output: 'alien_egg', labNodeId: 'recipe_alien_egg',
    description: 'Blue Science + Food -> Alien Egg',
  },
  // Real bug fix, found during a balance/logic audit pass: Green Science had
  // NO way to be earned in actual gameplay at all — an earlier batch
  // deliberately retired the Bio-Combustor's old "absorb Science instead of
  // Waste and self-upgrade the output" branch (correctly, since a fixed
  // icon-per-recipe model has no room for that any more), but nothing was
  // ever added back in its place. This restores production as its own clean
  // recipe, using the exact Blue-Science-+-Biomass ingredient pair the old
  // upgraded branch already used, gated behind the Science Lab's
  // green_science_tech node (now itself the merged Green Science Recipe
  // unlock — see that node's own comment) so it's only ever available once
  // that's researched — matching every other green-science-adjacent node's
  // own gating.
  green_science: {
    id: 'green_science', name: 'Green Science', icon: '🟢', color: SCIENCE_GREEN_COLOR,
    inputs: ['science', 'biomass'], output: 'science_green', labNodeId: 'green_science_tech',
    description: 'Blue Science + Biomass -> Green Science',
  },
};
export const MANUFACTURER_RECIPE_LIST = Object.values(MANUFACTURER_RECIPES);
// Per direct spec: "at base, manufacturers will take time to process each
// type of item depending on what it's processing" — a flat per-ITEM-TYPE
// duration, not a per-recipe one; a recipe's total cycle time is just the
// sum of its 2 ingredients' own durations (e.g. Bio-Sludge: food 8s + waste
// 5s = 13s total), since the two are processed one at a time in sequence
// (see updateBuildings — only one item may be absorbed/mid-process at once).
// Retuned per a later direct request (was waste 2000/food 4000/biomass
// 8000/science 6000).
export const MANUFACTURER_ITEM_PROCESS_MS = { waste: 5000, food: 8000, biomass: 12000, science: 16000 };
// Per direct request, the Manufacturer's power draw is no longer a flat
// rate — it depends on WHICH ingredient it's currently processing (heavier
// items cost more to crunch), drawn only while actively processing an
// absorbed ingredient, same "only while working" rule every other Electric
// building follows. The shop/Lab-preview's own stat shows this as a plain
// min-max range (buildingStatsHtml); the recipe pop-up menu shows the full
// per-item breakdown (UI.js's manufacturerPowerBreakdownHtml), since that's
// the one place a player is actually choosing which recipe (and therefore
// which ingredients) to run.
export const MANUFACTURER_ITEM_POWER_COST_MW = { waste: 10, food: 15, biomass: 25, science: 35 };
export const MANUFACTURER_STATS = {
  [TILE_MANUFACTURER]: {},
};

// ---- Power Plant recipes (renamed from Bio-Reactor) ----
// A single-fuel-item recipe now, not a router — absorbs exactly one item of
// `inputs[0]`'s type, then after `durationMs` credits `powerOutputMw` as one
// lump sum into state.level.powerGenAccumMw (same non-battery accumulator
// every Electric Eel feeds). `labNodeId: null` means "always available the
// moment the building itself is unlocked" (the Food recipe, granted by the
// same Lab node that grants the building) — Biomass/Blue Science each need
// their OWN separate Lab node purchased first, per spec.
export const POWER_PLANT_RECIPES = {
  food: {
    id: 'food', name: 'Food', icon: '🍖', color: '#ffb238',
    inputs: ['food'], powerOutputMw: 20, durationMs: 15000, labNodeId: null,
    description: 'Food -> 20mw for 15s',
  },
  biomass: {
    id: 'biomass', name: 'Biomass', icon: '🟩', color: BIOMASS_COLOR,
    inputs: ['biomass'], powerOutputMw: 40, durationMs: 20000, labNodeId: 'power_plant_biomass',
    description: 'Biomass -> 40mw for 20s',
  },
  science: {
    id: 'science', name: 'Blue Science', icon: '🔬', color: '#5fb8ff',
    inputs: ['science'], powerOutputMw: 100, durationMs: 30000, labNodeId: 'power_plant_science',
    description: 'Blue Science -> 100mw for 30s',
  },
};
export const POWER_PLANT_RECIPE_LIST = Object.values(POWER_PLANT_RECIPES);
// A GENERATOR, not a consumer — never appears in computeCurrentPowerDemand
// at all (same as the Electric Eel fish doesn't), so there's no
// powerCostPerSec field here; Grid.js's getBuildingCurrentPowerDraw returns
// a NEGATIVE number for a Power Plant instead (currently generating), so it
// never gets counted as demand by anything that only checks `> 0`.
export const POWER_PLANT_STATS = {
  [TILE_POWER_PLANT]: {},
};

// ---- Vertical processing-progress dots (Processors, Manufacturer, Refineries, Power Plant) ----
// Per direct request: a small column of 4 dots on the tile's left edge,
// visualizing how far along the CURRENT item/fuel is through processing.
// Processors/Manufacturer/Refineries light up bottom-to-top as progress
// climbs (bottom dot at 20%, ..., top dot at 80%+); the Power Plant instead
// starts fully lit the instant fuel is absorbed and turns off top-to-bottom
// as that fuel is consumed (top dot off at 20% used, ..., bottom dot off at
// 80%+ used) — see Grid.js's renderProcessDots.
export const PROCESS_DOTS_COUNT = 4;

// ---- Building uptime tracking (Grid.js's updateBuildings) ----
// A rolling 3-minute (180000ms) window, sampled every BUILDING_UPTIME_
// SAMPLE_INTERVAL_MS (5s) into a fixed-length circular buffer of per-window
// active-fractions — per direct request, shown on a building's own info
// pop-up as "Uptime (3 min): N%". 36 samples * 5000ms = 180000ms exactly.
export const BUILDING_UPTIME_SAMPLE_INTERVAL_MS = 5000;
export const BUILDING_UPTIME_SAMPLE_COUNT = 36;

// ---- Tier Progression & The Mound (Phase 2) ----
// See CLAUDE.md's "Tier Progression & The Mound" section for the full
// design. The very first "throw money" attempt (at MOUND_TEASE_COST) is a
// red herring — it spends the money but doesn't crack anything, just a
// notification joke (Mound.js's crackMound, gated on
// state.level.moundTeased). MOUND_CRACK_COST[tier] is the $ spent to
// actually crack FROM that tier to the next, once teased (placeholder
// balance, same as every other economy constant here — tune once real
// playtesting exists).
// TIER_UNLOCKS[tier]
// is what gets permanently granted into state.meta the first time that tier
// is reached.
//
// Full sequence, per direct request — a second rework, this time
// deliberately shrinking the Mound down to a short on-ramp rather than the
// game's whole progression arc, since Science (the Lab's own branching tech
// tree, see SCIENCE_LAB_UPGRADES below) is now meant to be "the end all game
// goal" instead: Tier 1 (start) -> Tier 1.5 tease ($150, nothing, a pure
// joke) -> Tier 1.75 ($500, Rudimentary Fan only) -> real Tier 1->2 crack
// ($1000, Processor + Science Octopus) -> Tier 2.5 ($2500, Auto-Feeder
// only) -> real Tier 2->3 crack ($5000, the Mound shatters completely,
// revealing the Science Lab — grants nothing on its own beyond the reveal).
// Everything past that point — Suckerfish, Electric Eel, every Electric/
// Advanced building — moves into the Lab's own paid tech tree, no longer
// tied to Mound progress at all. MOUND_MAX_TIER dropped from 4 to 3
// accordingly.
export const MOUND_MAX_TIER = 3; // reaching this shatters the Mound completely into the Science Lab instead of cracking further
export const MOUND_TEASE_COST = 75; // cut from 150 per direct request — still a pure Tier 1 no-op joke, just cheaper
// The old paid "Tier 1.75" step (FAN_UNLOCK_COST, $500, granted ONLY the
// Rudimentary Fan) is gone entirely, per direct request — the Rudimentary
// Fan is unlocked from level start now instead (BUILDING_TYPES'
// unlockedByDefault, alongside Platform/Waste Turret, below).
export const MOUND_CRACK_COST = { 1: 500, 2: 1500 }; // 1: Tier 1->2 (Collector + Refinery + Octopus), cut from 1000 per direct request; 2: Tier 2->3 (shatters into the Science Lab, grants nothing directly), cut from 5000 per a later direct request
export const MOUND_WIDTH_TILES = 4.4; // how many seabed tiles wide its clickable footprint is — 10% bigger than the original 4
export const MOUND_HEIGHT_PX = 62; // how far it mounds up above the seabed surface — 10% bigger than the original 56
// Platform, the Waste Turret, and the Rudimentary Fan are all NOT tier-gated
// at all — see BUILDING_TYPES' unlockedByDefault below — per direct request
// each is available from level start rather than waiting on any crack.
export const TIER_UNLOCKS = {
  2: {
    // Per direct request, this crack now grants Electric Eel instead of
    // Science Octopus — Octopus moved (back) into the Science Lab as one of
    // its 3 new root purchases (gold-only, no Bubble Cap gate — see
    // SCIENCE_LAB_UPGRADES.octopus), and Electric Eel moved off the Lab
    // entirely onto the Mound, so every node that used to require the Lab's
    // own `eel` purchase now requires Bubble Cap 20 instead (see that
    // section's own comment for the full reasoning).
    species: ['electric_eel'],
    // The base Refinery is granted here rather than through the Science Lab
    // (unlike its Electric/Advanced/Bio tiers) — it's the foundational
    // recycler the whole chain is built on, and both its recipes (Waste->
    // Food; Bio-Sludge->Biomass) are usable well before the Lab exists, so
    // gating it behind Lab research would just waste it.
    buildings: [TILE_COLLECTOR, TILE_REFINERY],
  },
  // Tier 3 has no entry here at all — the real Tier 2->3 crack's only
  // effect is shattering the Mound (state.level.tier >= MOUND_MAX_TIER),
  // which reveals the Science Lab (Mound.js's isPointOnScienceLab/
  // renderScienceLab) — every further species/building unlock happens
  // through SCIENCE_LAB_UPGRADES below instead, per direct request to
  // "fundamentally shift from the mound being the end all game goal to
  // science being the end all game goal."
};

// ---- Science Lab tech tree (Phase 4+) ----
// A real branching dependency web, per direct request ("should look like a
// web of unlocks branching from the unlocks that are barring them
// before"), replacing the old flat "buy Gene-Splicing / buy 2 Advanced
// buildings" list. Every node costs BOTH Science Bubbles and gold — a
// deliberate first in this game's economy, tying the Lab's whole tree to
// two resources at once so it reads as the game's real end-goal sink.
// `requires` lists prerequisite node ids that must already be purchased
// (state.meta.labUpgradesPurchased) before this one can be bought — UI.js's
// Lab popup renders this as an actual node-link tree (one column per
// dependency depth, connector lines drawn between related nodes), not just
// disabled buttons, so the shape of the tree is visible at a glance. Bubble
// Cap 20 (science_cap_2, below) deliberately requires all 3 of the tree's
// new roots at once (Suckerfish, Science Octopus, Bubble Cap 10) — per
// direct request — so its node has three incoming connector lines instead
// of a single linear chain. `grants` is the same { species, buildings } shape
// TIER_UNLOCKS entries use (plus a newer `scienceCapLevel` field the
// `science_cap_*` chain below uses — see its own comment) — UI.js's
// buyLabUpgrade pushes each into state.meta/state.level the same way
// Mound.js's crackMound already does for species/buildings.
export const SCIENCE_LAB_UPGRADES = {
  // ---- The tree's new roots, per direct request ----
  // Suckerfish, Science Octopus, and Bubble Cap 10 are now the only 3 things
  // purchasable from a fresh Lab, all costing gold ONLY (scienceCost: 0 —
  // labNodeCostText/labNodeHasEnoughScience in UI.js both special-case a
  // zero scienceCost to omit the Blue-Science half of the cost display
  // entirely, so these three genuinely read as gold-only, not "0 science").
  // Science Octopus moved here from the Mound's own Tier 2 crack (which now
  // grants Electric Eel instead — see TIER_UNLOCKS above) so it's a real
  // Lab purchase like every other utility species; Electric Eel itself is
  // no longer a Lab node at all. Bubble Cap 20 (science_cap_2, below) is the
  // ONE thing gated behind all 3 of these together — "once all of those
  // have been unlocked, it leads to just the bubble cap 20" — and every
  // node that used to require the Lab's own `eel` purchase now requires
  // Bubble Cap 20 instead, since that's the new gate standing in for "the
  // Eel line is up and running" once Eel itself moved to the Mound.
  suckerfish: {
    id: 'suckerfish', name: 'Suckerfish', icon: '🐠', scienceCost: 0, goldCost: 1000,
    requires: [], grants: { species: ['suckerfish'] },
  },
  octopus: {
    id: 'octopus', name: 'Science Octopus', icon: '🐙', scienceCost: 0, goldCost: 1500,
    requires: [], grants: { species: ['octopus'] },
  },
  electric_fan: {
    id: 'electric_fan', name: 'Electric Fan', icon: '💨', scienceCost: 40, goldCost: 2500,
    requires: ['science_cap_2'], grants: { buildings: [TILE_FAN_T3] },
  },
  // Grants TILE_COLLECTOR_ELECTRIC, now displayed "Advanced Collector" (see
  // BUILDING_TYPES' Collector-family rename) — the node's own `name` field
  // is kept in sync with that display name; its internal id stays
  // `electric_collector`, an opaque identifier other nodes' `requires`
  // arrays reference, not a player-facing "mention."
  electric_collector: {
    id: 'electric_collector', name: 'Advanced Collector', icon: '🧲', scienceCost: 100, goldCost: 5000,
    requires: ['science_cap_2'], grants: { buildings: [TILE_COLLECTOR_ELECTRIC] },
  },
  // Grants TILE_REFINERY_ELECTRIC, now displayed "Advanced Refinery" (see
  // BUILDING_TYPES' Refinery-family rename) — same "keep the id, sync the
  // display name" treatment as electric_collector above.
  electric_refinery: {
    id: 'electric_refinery', name: 'Advanced Refinery', icon: '⚗️', scienceCost: 60, goldCost: 5000,
    requires: ['science_cap_2'], grants: { buildings: [TILE_REFINERY_ELECTRIC] },
  },
  advanced_fan: {
    id: 'advanced_fan', name: 'Advanced Fan', icon: '🌪️', scienceCost: 200, goldCost: 15000,
    requires: ['electric_fan'], grants: { buildings: [TILE_FAN_T4] },
  },
  // Grants TILE_COLLECTOR_ADVANCED, now displayed "Bio Collector."
  advanced_collector: {
    id: 'advanced_collector', name: 'Bio Collector', icon: '🧲', scienceCost: 500, goldCost: 25000,
    requires: ['electric_collector'], grants: { buildings: [TILE_COLLECTOR_ADVANCED] },
  },
  // Per direct request — Tier 1 Storage Chest is granted by the Mound's own
  // $75 tease (see Mound.js), not the Lab; these 2 nodes are its only
  // further upgrades, each gated behind a single Bubble Cap milestone and
  // nothing else, same single-requirement shape as electric_collector above
  // (already precedent for "gated on just one science_cap_N node").
  storage_chest_t2: {
    id: 'storage_chest_t2', name: 'Storage Chest II', icon: '📦', scienceCost: 80, goldCost: 4500,
    requires: ['science_cap_2'], grants: { buildings: [TILE_STORAGE_CHEST_T2] },
  },
  storage_chest_t3: {
    id: 'storage_chest_t3', name: 'Storage Chest III', icon: '📦', scienceCost: 140, goldCost: 16000,
    requires: ['science_cap_4'], grants: { buildings: [TILE_STORAGE_CHEST_T3] },
  },
  // The Waste Turret needs no node at all — it's unlockedByDefault: true,
  // same as Platform (see BUILDING_TYPES), free from the very start.
  electric_turret: {
    id: 'electric_turret', name: 'Electric Turret', icon: '🔫', scienceCost: 50, goldCost: 3000,
    requires: ['science_cap_2'], grants: { buildings: [TILE_TURRET_ELECTRIC] },
  },
  advanced_turret: {
    id: 'advanced_turret', name: 'Advanced Turret', icon: '🔫', scienceCost: 240, goldCost: 18000,
    requires: ['electric_turret'], grants: { buildings: [TILE_TURRET_ADVANCED] },
  },
  // Two new turret fire-rate Lab nodes, per direct request — each a flat
  // +20% to EVERY turret's fire rate (applied multiplicatively at fire
  // time, see Grid.js's getTurretFireRateMultiplier/TURRET_STATS' own base
  // shotsPerSec cut to compensate). Node I costs the same resources the now
  // deprecated recipe_bio_sludge node used to (per direct spec, "similar
  // resources as the now-deprecated bio-sludge recipe"), gated behind
  // Bubble Cap 30 like that node was; Node II requires Green Science Tech
  // AND Node I, and costs Green Science too (additive, same half-of-blue
  // convention every other Green-Science-gated node already follows).
  turret_fire_rate_1: {
    id: 'turret_fire_rate_1', name: 'Turret Fire Rate I', icon: '🔥', scienceCost: 100, goldCost: 9000,
    description: "Increases every turret's fire rate by 20%.",
    requires: ['science_cap_3'], grants: {},
  },
  // Per direct request, gated behind Bubble Cap 50 now instead of Green
  // Science Tech (still additionally requires Turret Fire Rate I, unchanged).
  turret_fire_rate_2: {
    id: 'turret_fire_rate_2', name: 'Turret Fire Rate II', icon: '🔥', scienceCost: 140, scienceGreenCost: 70, goldCost: 15000,
    description: "Increases every turret's fire rate by another 20%, on top of Turret Fire Rate I.",
    requires: ['science_cap_5', 'turret_fire_rate_1'], grants: {},
  },

  // ---- Manufacturer & Power Plant production chain ----
  // Per direct request, the old standalone Bio-Feeder/Bio-Combuster
  // buildings are gone, replaced by the Manufacturer (one building, 3
  // selectable recipes) and the renamed Power Plant (one building, 3
  // selectable fuel recipes). Both buildings now require Bubble Cap 20 only
  // (see the tree-roots comment above for why) — Manufacturer no longer
  // separately requires Suckerfish, since reaching Bubble Cap 20 already
  // requires it transitively.
  manufacturer: {
    id: 'manufacturer', name: 'Manufacturer', icon: '🏭', scienceCost: 70, goldCost: 5000,
    requires: ['science_cap_2'], grants: { buildings: [TILE_MANUFACTURER] },
  },
  power_plant: {
    id: 'power_plant', name: 'Power Plant', icon: '☢️', scienceCost: 70, goldCost: 5000,
    // Grants the building AND (implicitly — POWER_PLANT_RECIPES.food.labNodeId
    // is null) its Food recipe at once.
    requires: ['science_cap_2'], grants: { buildings: [TILE_POWER_PLANT] },
  },
  // Per direct request, Mutagen Paste/Bio-Sludge/Alien Egg all moved off
  // requiring the Manufacturer+Power Plant buildings directly onto Bubble
  // Cap 30 (science_cap_3, below) as their one and only requirement instead
  // — reaching Bubble Cap 30 already requires the Manufacturer itself (see
  // that node's own `requires`), so the dependency chain is still intact,
  // just gated one step further up the tree. Names match each recipe's own
  // MANUFACTURER_RECIPES.name; the object's own id/key is left as
  // `recipe_bio_feeder` (an internal identifier other nodes' `requires`
  // arrays reference, not a player-facing "mention").
  // Per direct request, requires just the Manufacturer to be unlocked now
  // (not Bubble Cap 30) — the same reasoning as Bio-Sludge's own null
  // labNodeId above: reaching the Manufacturer already implies everything
  // this recipe needs exists, so gating it a further step up the Bubble Cap
  // chain was pure friction.
  recipe_bio_feeder: {
    id: 'recipe_bio_feeder', name: 'Mutagen Paste Recipe', icon: '🩷', scienceCost: 90, goldCost: 7000,
    description: 'Unlocks the Manufacturer\'s Food+Biomass recipe, producing Mutagen Paste. Feeding it to a non-Adult fish instantly grows it to Adult; feeding it to an already-Adult fish instead gives a temporary 2x coin-drop buff with a glowing visual.',
    requires: ['manufacturer'], grants: {},
  },
  // Per direct request, now requires Bubble Cap 30 AND the Alien Egg recipe
  // (instead of the Manufacturer/Power Plant buildings directly).
  recipe_bio_combustor: {
    id: 'recipe_bio_combustor', name: 'Blue Science Recipe', icon: '🔥', scienceCost: 80, goldCost: 6000,
    requires: ['science_cap_3', 'recipe_alien_egg'], grants: {},
  },
  // Per direct request, merged with the old standalone recipe_green_science
  // node — "it didn't make sense to have a green science node that unlocked
  // another node for the green science recipe." This node (id kept as
  // green_science_tech so every existing dependent's `requires` array —
  // turret_fire_rate_2 no longer among them, see below, but power_plant_science/
  // bio_refinery/mother_alien_fish still are — stays valid with zero other
  // changes needed) IS the Green Science recipe unlock now, not a separate
  // prerequisite for one. Grants nothing structural itself
  // (`grants: {}`) — MANUFACTURER_RECIPES.green_science's own `labNodeId`
  // points directly at this id, so buying this node is what makes that
  // recipe selectable, the same "presence in labUpgradesPurchased IS the
  // unlock" pattern every other pure-recipe node in this tree already uses.
  // Moved from Bubble Cap 30 to Bubble Cap 40, per direct request.
  green_science_tech: {
    id: 'green_science_tech', name: 'Green Science Recipe', icon: '🟢', scienceCost: 120, goldCost: 8000,
    requires: ['recipe_bio_combustor', 'science_cap_4'], grants: {},
  },
  // The old recipe_bio_sludge node (Bubble Cap 30 gated, previously named
  // recipe_bio_pellets/'Bio-Pellets Recipe' before that) is REMOVED entirely,
  // per direct request ("remove the bio-sludge recipe from the science lab,
  // and have it unlocked for the player right when they unlock the
  // manufacturer. Nothing in the science lab should be dependent on the
  // bio-sludge") — see MANUFACTURER_RECIPES.bio_sludge's own `labNodeId:
  // null`, which now grants it automatically the instant the Manufacturer
  // building itself is unlocked. Its former dependents were repointed
  // directly at `manufacturer` instead (power_plant_biomass and
  // hybrid_zap_sucker, below) — reaching the Manufacturer already implies
  // Bio-Sludge exists, so nothing downstream lost any real gating.
  // New Manufacturer recipe, per direct spec — Blue Science + Food -> a
  // physical, draggable Alien Egg that hatches into a live Tier-1 alien
  // after ALIEN_EGG_HATCH_MS (see MANUFACTURER_RECIPES.alien_egg and
  // Entities.js's updateAlienEgg). Also moved onto Bubble Cap 30 alone, per
  // direct request, same reasoning as Bio-Sludge above.
  // Per direct request, requires just the Manufacturer to be unlocked now
  // (not Bubble Cap 30) — same reasoning as recipe_bio_feeder above.
  recipe_alien_egg: {
    id: 'recipe_alien_egg', name: 'Alien Egg Recipe', icon: '🥚', scienceCost: 110, goldCost: 10000,
    requires: ['manufacturer'], grants: {},
  },
  // The Power Plant's Biomass recipe is locked behind the Manufacturer's
  // Bio-Sludge recipe, per direct spec; its Blue Science recipe is locked
  // behind Green Science Tech.
  power_plant_biomass: {
    id: 'power_plant_biomass', name: 'Power Plant: Biomass', icon: '🟩', scienceCost: 100, goldCost: 10000,
    requires: ['power_plant', 'manufacturer'], grants: {},
  },
  // Requires Green Science Tech to be unlocked, so per direct request it
  // ALSO costs Green Science itself now (in addition to Blue), at half the
  // Blue amount — scienceGreenCost is additive, not exclusive, see
  // labNodeHasEnoughScience's comment in UI.js.
  power_plant_science: {
    id: 'power_plant_science', name: 'Power Plant: Blue Science', icon: '🔬', scienceCost: 140, scienceGreenCost: 70, goldCost: 15000,
    requires: ['power_plant', 'green_science_tech'], grants: {},
  },
  // Bio Refinery — the top Refinery tier now that Ultra Refinery is gone
  // entirely, per direct request ("remove the Ultra Refinery... have the
  // Bio refinery take its place in the science lab with the same costs
  // that the ultra refinery has now"). This node's own id/scienceCost/
  // scienceGreenCost/goldCost/requires are ALL untouched from when it used
  // to grant the now-deleted Ultra Refinery — only `name` and
  // `grants.buildings` changed, so "same costs" holds by construction
  // rather than by re-typing the same numbers a second time. The old
  // `advanced_refinery` node (which used to grant this exact building,
  // requiring only `electric_refinery`) is deleted outright — Bio Refinery
  // now has exactly one home in the tree, this one.
  bio_refinery: {
    id: 'bio_refinery', name: 'Bio Refinery', icon: '⚗️', scienceCost: 200, scienceGreenCost: 100, goldCost: 20000,
    requires: ['green_science_tech'], grants: { buildings: [TILE_REFINERY_ADVANCED] },
  },

  // ---- Gene-Splicing hybrids — completely reworked, per direct request ----
  // The old gene_splicing root + 3 "track" gates (suckerfish_hybrids/
  // electric_hybrids/science_hybrids) + 12 leaf nodes are gone entirely.
  // Splicing itself is no longer a purchasable unlock at all — dragging a
  // grown utility fish onto a compatible grown economy fish always at least
  // ATTEMPTS a splice now (Entities.js's isSpliceSource dropped its old
  // GENE_SPLICING_LAB_ID gate); what actually gates each of the 3 real
  // hybrids is just its own flat Bubble Cap requirement below, exactly like
  // any other node. `canSpliceFish` still checks
  // `state.meta.speciesUnlocked.includes(hybridId)` per specific pair, so a
  // combination with no matching hybrid (or a locked one) simply never
  // resolves — no separate "splicing enabled" flag needed anywhere.
  // Moved onto Bubble Cap 30 as its one and only requirement, per direct
  // request — Suckerfish is already required transitively (Bubble Cap 30
  // requires the Manufacturer and Bubble Cap 20, and Bubble Cap 20 requires
  // Suckerfish itself), so dropping the separate direct requirement here
  // doesn't loosen anything.
  hybrid_buffer_fish: {
    id: 'hybrid_buffer_fish', name: 'Magnet Fish', icon: '🧲', scienceCost: 40, goldCost: 4000,
    requires: ['science_cap_3'], grants: { species: ['buffer_fish'] },
  },
  // Per direct request ("Have the only requirement for the Blimp-Battery be
  // the Powerplant building"), regated off the 'power_plant' lab node (the
  // one that grants the Power Plant building itself) instead of a Bubble Cap
  // tier — thematically tighter anyway, since a Blimp-Battery is a power-grid
  // fish.
  hybrid_eel_blimp: {
    id: 'hybrid_eel_blimp', name: 'Battery fish', icon: '🔋', scienceCost: 60, goldCost: 8000,
    requires: ['power_plant'], grants: { species: ['eel_blimp'] },
  },
  // Two more hybrids, per direct request — each gated behind a Manufacturer
  // recipe instead of a Bubble Cap tier, since both are thematically tied to
  // that production chain rather than raw research depth. Feeder Fish
  // (Electric Eel × Suckerfish) is spliced like the hybrid above it (both
  // parents are real fish, via the standard getHybridSpeciesId pipeline);
  // Bio Fish (Octopus × a Tier 1 Alien-Egg-hatched alien) is spliced too,
  // per a later direct request, just via its own bespoke alien-aware
  // splice pair (Entities.js's canSpliceOctopusWithAlien/
  // spliceOctopusWithAlien) rather than that standard fish+fish pipeline —
  // see xeno_octopus's own SPECIES row comment for why.
  // Per direct request ("Have the only requirement for the feeder fish be
  // the mutagen paste recipe"), regated off 'recipe_bio_feeder' (the node
  // that unlocks the Mutagen Paste recipe) instead of a Bubble Cap tier.
  hybrid_zap_sucker: {
    id: 'hybrid_zap_sucker', name: 'Feeder Fish', icon: '🔌', scienceCost: 70, goldCost: 9000,
    requires: ['recipe_bio_feeder'], grants: { species: ['zap_sucker'] },
  },
  hybrid_xeno_octopus: {
    id: 'hybrid_xeno_octopus', name: 'Bio Fish', icon: '👽', scienceCost: 90, goldCost: 12000,
    requires: ['recipe_alien_egg'], grants: { species: ['xeno_octopus'] },
  },

  // ---- Bubble (Science) Capacity chain ----
  // Per direct request ("change the max science upgrades so each one is a
  // separate icon to upgrade along the science lab upgrade path, instead of
  // 5 times on the same icon") — replaces the old standalone leveled Bubble
  // Capacity card with chained one-time nodes, each requiring the previous
  // and raising state.level.upgrades.scienceCapLevel by 1 via this new
  // `grants.scienceCapLevel` field (UI.js's buyLabUpgrade applies it the
  // same way it already applies grants.species/grants.buildings). Costs
  // read straight from SCIENCE_CAP_UPGRADE_SCIENCE_COSTS/_GOLD_COSTS above.
  //
  // The old Bubble Cap 10 node (`science_cap_1`) is removed entirely, per
  // direct request — the player now starts with 10 Science already allowed
  // on screen (see SCIENCE_CAP_BY_LEVEL's own comment, index 0), so there's
  // nothing left for a "raise it to 10" node to actually do. Every node
  // below is unrenumbered from before (still `science_cap_2`..`_5`, "Bubble
  // Cap 20"..."Bubble Cap 50") since those ids/names already matched the
  // CAP VALUE they grant, not a purchase-order index — nothing needed to
  // shift. `SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[0]`/`_GOLD_COSTS[0]` (the old
  // Bubble Cap 10's own cost pair) are simply unused now, left in place
  // rather than reshuffling the array and every other node's fixed index
  // into it.
  //
  // Each node's `description` is now a fixed, hand-written string (not
  // derived from `state.level.upgrades.scienceCapLevel` at all) — per
  // direct request ("make each bubble cap node description... static...
  // so it doesn't dynamically change depending on what I have unlocked").
  // UI.js's openLabPurchaseModal reads this directly instead of computing a
  // live "current -> next" figure off the player's own progress.
  //
  // Per direct request, Bubble Cap 20 is the thing gated behind the tree's
  // remaining 2 roots together (Suckerfish, Science Octopus).
  science_cap_2: {
    id: 'science_cap_2', name: 'Bubble Cap 40', icon: '🫧',
    description: 'Raises the Science Bubble cap from 20 to 40 — how many can exist unbanked in the tank at once before an Octopus\'s brew is blocked.',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[1], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[1],
    requires: ['suckerfish', 'octopus'], grants: { scienceCapLevel: 1 },
  },
  // Per direct request, "the 2 requirements for bubble cap 30 is the
  // manufacturer and the bubble cap 20."
  science_cap_3: {
    id: 'science_cap_3', name: 'Bubble Cap 60', icon: '🫧',
    description: 'Raises the Science Bubble cap from 40 to 60 — how many can exist unbanked in the tank at once before an Octopus\'s brew is blocked.',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[2], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[2],
    requires: ['manufacturer', 'science_cap_2'], grants: { scienceCapLevel: 1 },
  },
  science_cap_4: {
    id: 'science_cap_4', name: 'Bubble Cap 80', icon: '🫧',
    description: 'Raises the Science Bubble cap from 60 to 80 — how many can exist unbanked in the tank at once before an Octopus\'s brew is blocked.',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[3], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[3],
    requires: ['science_cap_3'], grants: { scienceCapLevel: 1 },
  },
  science_cap_5: {
    id: 'science_cap_5', name: 'Bubble Cap 100', icon: '🫧',
    description: 'Raises the Science Bubble cap from 80 to 100 — how many can exist unbanked in the tank at once before an Octopus\'s brew is blocked.',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[4], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[4],
    requires: ['science_cap_4'], grants: { scienceCapLevel: 1 },
  },
  // Pure economy modifier, per direct request — grants nothing structural
  // (no species/building/capacity level), just gates a permanent discount
  // applied wherever dynamic fish pricing is computed (Entities.js's
  // effectiveFishCostGrowthRate/getFishPurchaseCost), checked the same
  // "presence in labUpgradesPurchased IS the unlock" way GREEN_SCIENCE_LAB_ID
  // already is.
  fish_scaling: {
    id: 'fish_scaling', name: 'Fish Scaling', icon: '📉',
    scienceCost: 300, scienceGreenCost: 150, goldCost: 25000,
    requires: ['science_cap_5'],
    grants: {},
  },
  // ---- The end-game secret: Escape the Fish Tank (internally still
  // "Mother Alien Fish" throughout the rest of the codebase — the boss
  // entity/mechanic keeps that name; only this node's own display name and
  // description changed, per direct request, same "keep the identifier,
  // change what's shown" precedent every other rename in this project
  // follows) ----
  // Per direct spec, a genuine mystery node — `mystery: true` (read by
  // UI.js's buildLabTree/refreshLabTree/openLabPurchaseModal) hides its own
  // name/icon/cost/description behind a plain "???" for as long as its
  // `requires` aren't all met, even though every OTHER node in this tree is
  // fully previewable while still locked. `requires` is deliberately every
  // node gated behind Green Science Tech (directly or transitively —
  // power_plant_science and bio_refinery still are, though the old separate
  // recipe_green_science node this list used to also include is gone now,
  // merged into green_science_tech itself) plus Bubble Cap 50, per spec
  // ("everything that's locked behind the green science node purchased
  // first, and the bubble cap 50"). Catalyst Fish (`hybrid_catalyst_fish`)
  // used to also be a direct requirement here — removed per a later direct
  // request, so the boss no longer depends on that specific hybrid at all.
  // Buying it doesn't grant a species/building/scienceCapLevel like every
  // other node — its `grants.triggersBossFight` is a special one-off flag
  // UI.js's buyLabUpgrade checks for and hands off to main.js's
  // startBossSequence instead of the normal grant-application path.
  mother_alien_fish: {
    id: 'mother_alien_fish', name: 'Escape the Fish Tank', icon: '👹', mystery: true,
    description: 'Win the game! Definitely no need to be loaded on turret power. *Glub**Glub* Thats how you wink as a fish.',
    scienceCost: 500, scienceGreenCost: 200, goldCost: 50000,
    requires: ['green_science_tech', 'power_plant_science', 'bio_refinery', 'science_cap_5'],
    grants: { triggersBossFight: true },
  },
};
export const SCIENCE_LAB_UPGRADE_LIST = Object.values(SCIENCE_LAB_UPGRADES);

// ---- Phase 4: Science Lab & Gene-Splicing ----
// The Science Lab (Mound.js's renderScienceLab/isPointOnScienceLab) replaces
// the Mound once it shatters at MOUND_MAX_TIER — see SCIENCE_LAB_UPGRADES
// above for its full purchasable tree, including the Gene-Splicing hybrid
// sub-tree (root + 3 tracks + 12 individual hybrid nodes). Gene-Splicing
// itself is dragging a utility fish (Suckerfish/Electric Eel/Science
// Octopus) onto an eligible Adult fish to spawn the matching hybrid — see
// Entities.js's canSpliceFish/spliceFish and the existing T5 value-carry-over
// pipeline (getEconomyAdultDropValue/getHybridSpeciesId/createHybridFish) it's
// built on top of.
// Once Electric Eel is unlocked, the HUD shows a live electricity readout
// (current draw / accumulated capacity, like Food's current/cap) that
// updates once per real sim-second — main.js samples
// Grid.js's computeCurrentPowerDemand + state.level.powerSupply into
// state.level.powerHistory every second, capped at this many entries (a
// rolling one-minute window, one point per second) for the small graph
// popup UI.js shows when the HUD readout is clicked. See main.js's update().
export const POWER_HISTORY_MAX = 60;

// "Presence in state.meta.labUpgradesPurchased IS the unlock" flag id for
// Green Science Tech — checked directly wherever something needs to know
// whether Green Science research has happened at all (the Bio-Refinery/
// Power Plant Blue Science Lab nodes' own `requires` arrays already handle
// their own gating declaratively; this constant is for the couple of spots
// that need the same check outside the tree itself).
export const GREEN_SCIENCE_LAB_ID = 'green_science_tech';

// Same "presence in state.meta.labUpgradesPurchased IS the unlock" pattern
// as GREEN_SCIENCE_LAB_ID above — per direct request, halves the dynamic
// fish-pricing growth curve's own scaling (see Entities.js's
// effectiveFishCostGrowthRate/getFishPurchaseCost) the instant it's bought,
// applying immediately to every species' live shop price.
export const FISH_SCALING_LAB_ID = 'fish_scaling';

// ---- Hybrid Mechanics (Battery fish, Magnet Fish) ----
// Each hybrid gets a genuinely unique, hand-built mechanic (see the SPECIES
// table's own comment above) rather than a generic behavior-tag formula —
// these are the tunable numbers each one reads directly by speciesId.
// Constant names below still say EEL_BLIMP/BUFFER_FISH (the species' own
// internal ids, unchanged since their display names were renamed to
// "Battery fish"/"Magnet Fish" — same "keep the internal identifier, change
// what's shown" precedent every other rename in this project follows).
// Catalyst Fish's own linking mechanic (CATALYST_BUFF_MULTIPLIER etc.) was
// removed along with the species itself, per direct request ("Remove the
// catalyst fish from the game completely").

// Battery fish: acts as a living battery for the whole power grid (see
// main.js's once-per-second power-sampling block and Entities.js's
// computeEelBlimpBatteryCapacityMw). Each living one contributes this much
// capacity normally, or the buffed amount while its own mutagenBuffActive is
// true — capacities are summed across every living one, so 2 fish (1 fed, 1
// not) contribute 1000+2000=3000 total.
export const EEL_BLIMP_BATTERY_CAPACITY_MW = 1000; // 1GW
export const EEL_BLIMP_BATTERY_CAPACITY_MUTAGEN_MW = 2000; // 2GW while fed
// Mutagen Paste also doubles the fish's own power PRODUCTION (its bespoke
// distance-traveled generation, same mechanic the Electric Eel itself
// uses) — see updateFish's speciesId === 'eel_blimp' branch.
export const EEL_BLIMP_MUTAGEN_PRODUCTION_MULTIPLIER = 2;

// Buffer Fish: a Suckerfish-style Waste-eater that turns what it eats into
// Food instead of just relieving its own hunger (see updateFish's
// buffer_fish eat branch), plus a click-toggled magnet
// (fish.magnetOn, toggled by main.js's canvas click handler) that
// continuously pulls any Waste within this radius toward the fish, same
// linear-falloff-to-0-at-range shape a Fan's own cone force already uses —
// see Entities.js's computeBufferFishMagnetForce.
export const BUFFER_FISH_MAGNET_RADIUS = 346; // px — 260 * 1.33, per direct request ("Increase the range of the magnet fish by 33%")
export const BUFFER_FISH_MAGNET_FORCE = 220; // force magnitude at the fish's own position, decaying linearly to 0 at MAGNET_RADIUS

// Feeder Fish: click it to toggle an automatic Food dispenser (fish.autoFoodOn,
// toggled by main.js's click handler) — while on, it spits out one real Food
// item every ELECTRIC_SUCKER_FOOD_INTERVAL_MS with no feeding required to
// trigger it, and generates no power at all while doing so; while off, it
// generates power like a plain Electric Eel instead (see updateFish's
// isPureGenerator branch and fish.autoFoodTimerMs).
export const ELECTRIC_SUCKER_FOOD_INTERVAL_MS = 6000;
// Bio Fish: click it to toggle Bio-Sludge mode (fish.alienDnaModeOn) —
// while on, its normal long Science brew cycle is replaced entirely by a
// fixed SCIENCE_ALIEN_DNA_INTERVAL_MS timer that spits out one Bio-Sludge
// (type `alien_dna`) item instead of a Science Bubble, per spec ("every 8
// seconds instead of science"). See updateFish's isPureResearcher branch.
export const SCIENCE_ALIEN_DNA_INTERVAL_MS = 8000;

export const SCIENCE_COLOR = '#5fc9ff';
export const POWER_COLOR = '#ffd23f';

// Item-type -> flat color, keyed by every possible Manufacturer recipe
// ingredient — used by Grid.js's ghost-icon flash (renderManufacturerGhostFlash)
// to render a translucent preview of whichever ingredient is still needed,
// reusing each item's own established color rather than a mismatched
// generic swatch. See CLAUDE.md's Manufacturer section for the mechanic.
export const MANUFACTURER_INPUT_COLOR_BY_TYPE = {
  food: FOOD_COLOR,
  waste: WASTE_COLOR,
  biomass: BIOMASS_COLOR,
  science: SCIENCE_COLOR,
};
// A blocked COIN (or, per a later direct request, SCIENCE) drop gets its own
// dedicated "on fire, disintegrating" effect — per direct request ("instead
// of the bubble icon that shows up when the fish can't spawn coins, make it
// look like a coin on fire that disintegrates"), later extended to Science
// too ("use a science icon and do that animation when the science bubble cap
// is reached"). Entities.js's triggerProductionBlocked pushes a
// { x, y, age, resource } record into state.level.productionBlockedEffects
// (resource is 'coin' or 'science', read by main.js's render to decide which
// icon burns in the middle of the shared flame/ember treatment); this is how
// long it lives before aging out, same "detached particle, independent of
// the fish" pattern ALIEN_DEATH_EFFECT_DURATION_MS already established. The
// old muted "🫧" floating bubble-pop cue this replaced for Science (and the
// PRODUCTION_BLOCKED_COLOR it was drawn in) is retired entirely — both
// resources share this one effect now, nothing reads that color any more.
export const PRODUCTION_BLOCKED_EFFECT_DURATION_MS = 800;

// ---- Fish mouth bubbles (Entities.js's emitFishBubble/updateFishBubbleEffects) ----
// Per direct request — a small, purely decorative bubble every fish
// occasionally lets out of its mouth, duplicating the same rise-and-wobble
// look Ambience.js's own background bubbles already use, just as a
// detached, one-shot transient effect (state.level.fishBubbleEffects, same
// "push it, age it, cull it" pattern as alienDeathEffects/
// productionBlockedEffects) rather than a fixed recycling pool, since each
// one has to spawn wherever its own fish currently is.
export const FISH_BUBBLE_INTERVAL_MIN_MS = 3000; // re-rolled after every emission (including the hunger-triggered one), so intervals never resync across fish. Cut from 5-20s to 3-10s per direct request, "increase the amount of bubbles from fish."
export const FISH_BUBBLE_INTERVAL_MAX_MS = 10000;
// Per direct spec ("a small chance after .5 seconds for a second bubble
// with a non-identical size/direction as the first") — rolled once per
// FIRST bubble emitted (never for the hunger-triggered one, which is
// already a guaranteed extra bubble of its own), never stacking further.
export const FISH_BUBBLE_SECOND_CHANCE = 0.25;
export const FISH_BUBBLE_SECOND_DELAY_MS = 500;
// Per direct request ("make it so the bubbles from fish also travel all the
// way to the top before disappearing") — no longer a fixed short lifetime.
// Now the same "rise until near the water's surface" pattern
// BUILDING_BUBBLE_LIFETIME_MS/BUILDING_BUBBLE_TOP_MARGIN_PX already use below
// (Entities.js's updateFishBubbleEffects culls once within
// FISH_BUBBLE_TOP_MARGIN_PX of y=0), just with its own values: a fish can
// sit right down near the seabed floor (FISH_MAX_Y, much deeper than most
// buildings ever get placed), so at the slowest roll of
// FISH_BUBBLE_RISE_SPEED_MIN this constant needs enough headroom to actually
// reach the top from there rather than acting as the real cutoff — it's
// still nominally just a safety ceiling for the (rare) case a bubble somehow
// never gets there.
export const FISH_BUBBLE_LIFETIME_MS = 40000;
export const FISH_BUBBLE_TOP_MARGIN_PX = 40; // culled once within this many px of the water's top (y=0), same margin as BUILDING_BUBBLE_TOP_MARGIN_PX
export const FISH_BUBBLE_RISE_SPEED_MIN = 18;
export const FISH_BUBBLE_RISE_SPEED_MAX = 34;
export const FISH_BUBBLE_RADIUS_MIN = 1.5;
export const FISH_BUBBLE_RADIUS_MAX = 4.5;

// A running building's own bubble (main.js's updateBuildingBubbles) reuses
// the same transient effect LIST as a fish's mouth bubble (state.level.
// fishBubbleEffects), but per direct follow-up requests needs its own,
// bigger/further-rising look — same "rise until near the top, OR this
// lifetime elapses as a safety ceiling" cull Entities.js's
// updateFishBubbleEffects now applies to a fish's own bubble too (see
// FISH_BUBBLE_LIFETIME_MS/FISH_BUBBLE_TOP_MARGIN_PX above), just with its
// own bigger radius/rise-speed range below.
// Radius matches Ambience.js's own background bubbles ("closer to the
// background bubbles in size", per direct request) rather than the
// smaller fish mouth-bubble range.
export const BUILDING_BUBBLE_LIFETIME_MS = 20000;
export const BUILDING_BUBBLE_TOP_MARGIN_PX = 40; // culled once within this many px of the water's top (y=0)
export const BUILDING_BUBBLE_RISE_SPEED_MIN = 16;
export const BUILDING_BUBBLE_RISE_SPEED_MAX = 42;
export const BUILDING_BUBBLE_RADIUS_MIN = 3;
export const BUILDING_BUBBLE_RADIUS_MAX = 7;
// "Slightly dependent on the size of the fish," per direct spec — not a
// direct multiplier (a baby fish still gets a real, visible bubble, just a
// somewhat smaller one on average) — see emitFishBubble's own sizeFactor.
export const FISH_BUBBLE_SIZE_FISH_SCALE_WEIGHT = 0.35;
export const FISH_BUBBLE_MOUTH_OFFSET_FRACTION = 0.42; // how far forward of the fish's own center (as a fraction of its on-screen size) the bubble spawns, in whichever direction it's currently facing
// The 3 utility species — the only valid splice SOURCES (dragged onto an
// eligible target, never the other way around, to keep the interaction
// symmetric with Economy Fish Combining's own single-direction drag). Also
// used to keep Entities.js's Science-production branch (RESEARCHER species
// without FEEDER also in their behavior list) and Config.js's own species
// rows in one place conceptually, even though that branch derives its
// condition from the behavior tags directly rather than this list.
export const UTILITY_SPECIES_IDS = ['suckerfish', 'electric_eel', 'octopus'];

// ---- Economy Fish Combining/Splicing (Tier 2) ----
// The 3 base feeder species — the only ones star-tier COMBINING applies to
// (dynamic PRICING is broader, see DYNAMIC_PRICED_SPECIES_IDS below).
// Named "economy fish" in the design spec to distinguish them from the
// utility species (Suckerfish/Electric Eel/Science Octopus) and their
// hybrids, which never combine.
export const ECONOMY_SPECIES_IDS = ['guppy', 'dartfin', 'blimpfish'];
// Dynamic pricing (see ECONOMY_FISH_COST_GROWTH_RATE below) — originally
// just the 3 economy species, extended per direct request to also cover the
// 3 utility species ("make sure all the utility fish also get more
// expensive with each fish on screen"). Deliberately NOT the hybrids —
// Entities.js's countLivingFishOfSpecies already only ever matches a fish's
// own EXACT speciesId, so a Buffer Fish (id 'buffer_fish') was never going
// to count toward Guppy's own scarcity anyway; nothing extra needed to
// enforce "hybrid fish do not count towards the limit."
export const DYNAMIC_PRICED_SPECIES_IDS = [...ECONOMY_SPECIES_IDS, ...UTILITY_SPECIES_IDS];
// Current_Cost = species.cost * (ECONOMY_FISH_COST_GROWTH_RATE ^ N), where N
// is how many living fish of that exact species (any star tier) are
// currently in state.level.entities — see Entities.js's
// getFishPurchaseCost. Buying one immediately raises the cost of the next;
// one dying, starving, or being consumed by a combine lowers N (and so the
// cost) again, since N is always computed live off the current entity list
// rather than tracked as a running counter. Applies to every id in
// DYNAMIC_PRICED_SPECIES_IDS, economy and utility alike — the name predates
// utility fish getting the same treatment, kept as-is rather than renamed.
export const ECONOMY_FISH_COST_GROWTH_RATE = 1.25; // was 1.4, reduced per direct request for a gentler cost curve

// Two Adult economy fish of the exact same species AND exact same star tier
// can be combined (dragged onto each other) into one Adult fish of the next
// tier — see Entities.js's canCombineFish/combineFish and main.js's drag
// handling. Tier 1 is the standard, freshly-purchased fish (no visual
// change); each combine step multiplies the adult coin dropValue by
// FISH_STAR_TIER_VALUE_MULTIPLIER over the previous tier's, capped at
// FISH_STAR_TIER_MAX (a Tier-4 pair can no longer be combined further).
// FISH_STAR_COUNT_BY_TIER is the number of stars FishRenderer.js overlays on
// the adult sprite per tier — deliberately NOT a plain tier-1 count (Tier 2
// jumps straight to 2 stars, not 1), per the design spec's exact table.
export const FISH_STAR_TIER_MAX = 4;
export const FISH_STAR_TIER_VALUE_MULTIPLIER = 2; // was 1.8 (before that 1.5) — raised per direct request so a Tier 4 fish makes exactly double a Tier 3 fish of the same species (and each tier step doubles the previous, since this is a flat per-step multiplier — see Entities.js's Math.pow(FISH_STAR_TIER_VALUE_MULTIPLIER, starTier - 1) usage)
// Each combine step also makes the resulting fish 10% less hungry than the
// previous tier (compounding, same ^(starTier-1) pattern as the value
// multiplier above) — see Entities.js's updateFish, applied to def.hungerRate
// before the per-tick hunger accumulation. Waste production (both the
// Collector byproduct and the direct fish-poop timer) deliberately does NOT
// scale with star tier at all — see WASTE_POOP_INTERVAL_MS/Entities.js's
// poop block — so a Tier-4 fish still only ever poops the same single Waste
// item per interval as a Tier-1 adult, per direct request.
export const FISH_STAR_TIER_HUNGER_MULTIPLIER = 0.9;
export const FISH_STAR_COUNT_BY_TIER = { 1: 0, 2: 2, 3: 3, 4: 4 };
export const FISH_STAR_COLOR = '#ffd700';
export const FISH_STAR_OUTER_RADIUS_RATIO = 0.09; // fraction of the fish's current size
export const FISH_STAR_INNER_RADIUS_FRACTION = 0.45; // fraction of a star's own outer radius
export const FISH_STAR_SPACING_RATIO = 2.4; // fraction of a star's outer radius, between star centers
export const FISH_STAR_Y_OFFSET_RATIO = 0.55; // how far above the fish's center the star row sits, relative to size
// Hit-test radius (as a fraction of the fish's current on-screen size) used
// by main.js's drag-to-combine mousedown/mouseup and the live hover-target
// check — generous enough to grab a fish without needing pixel precision,
// same spirit as COIN_CLICK_RADIUS_MULTIPLIER above. Raised from 0.6 to 1.0
// per direct request ("make the adult fish have a bigger clickable area for
// merging") — since only Adult-stage fish are ever legal merge/splice
// targets in the first place (canCombineFish/canSpliceFish both require it),
// this reads as "the whole visible fish body is clickable" for exactly the
// fish this tool is ever actually used on, matching the same full-size
// (fraction 1.0) precedent findFishForPipetteAt already established for
// "easier to select."
export const FISH_DRAG_HIT_RADIUS_FRACTION = 1.0;

// ---- Rolling notification log ----
export const NOTIFICATION_LOG_MAX = 50; // oldest entries drop off past this many

// ---- Story triggers (Systems.js/Entities.js/UI.js/Grid.js/main.js) ----
// A grab-bag of one-time and periodic narrative beats layered on top of the
// Rolling Notification Log — see CLAUDE.md's "Story & Tutorial
// Notifications" for the full list and rationale. Grouped here since they're
// all placeholder-balance/timing numbers in the same spirit as everything
// else in this file, even though their triggers live in several modules.
export const BANKRUPTCY_BAILOUT_AMOUNT = 100; // $ granted the first time the player has no fish left AND can't afford anything in the shop — see Systems.js's updateStoryTriggers
export const MONEY_MILESTONE_1K = 1000; // lifetime money EARNED (not current balance) that triggers the one-time "save some for the fishes" notification — see Entities.js's bankMoney
// Per direct request ("right after they kill the first alien, another one
// instantly spawns, and 1 second later it triggers the turret tutorial...
// so you instantly see the benefits of the turret") — replaces the old
// flat 10s-after-first-kill delay (which fired with no alien necessarily
// still on screen) with a much shorter delay timed off the REPLACEMENT
// alien's own appearance instead (Entities.js's updateEntities sets
// state.level.turretTutorialAlienAppearedAtMs the instant it spawns) — see
// Systems.js's updateTurretTutorialTrigger.
export const TURRET_TUTORIAL_DELAY_MS = 1000;
// Per direct request ("give the player 25 gold right at the step of the
// tutorial where they buy the turret... make sure to mention it in the
// text") — granted the instant the 'postalien' flow's 'scroll' step
// resolves into its 'place' step (main.js's update()), matching the Waste
// Turret's own base cost (BUILDING_TYPES[TILE_TURRET_WASTE].cost) exactly,
// so the step is always affordable regardless of how the player already
// spent their starting money.
export const TURRET_TUTORIAL_GOLD_GRANT = 40;
export const TURRET_TUTORIAL_GOLD_GRANT_MESSAGE = "Here's 40 gold — go place that turret.";
// Per direct request ("the tutorial can break if there's no waste on
// screen... produce a waste slightly left from middle in the city, and make
// that the waste that's used for the dragging part") — both paths that lead
// into the "drag Waste into the Turret" step (the full 'postalien' walk-
// through's own 'place' -> 'dragwaste' transition, and the standalone
// 'wastedrag' flow for a player who already had a Turret) now spawn this
// exact deterministic Waste item and lock the tutorial's target onto it
// directly (Entities.js's spawnTurretTutorialWaste), instead of hoping a
// real fish had already pooped one out somewhere nearby — the previous
// "wait for organic Waste to exist" approach could leave the drag step with
// nothing to drag (a degenerate, hole-less spotlight) if none ever
// happened to be sitting in the city yet. A few tiles left of the city's
// own horizontal center (POST_ALIEN_TURRET_SPOT sits exactly on it) and
// comfortably above the very bottom row that spot's own Turret occupies, so
// there's a real, visible drag distance to cover.
export const TURRET_TUTORIAL_WASTE_X = WORLD_W / 2 - TILE_SIZE * 4;
export const TURRET_TUTORIAL_WASTE_Y = WORLD_H - TILE_SIZE * 5;
export const ALIEN_INTRO_DELAY_MS = 1000; // per direct request, the cinematic first-alien intro no longer triggers the instant the alien spawns — it has to actually be alive and visibly moving on screen for this long first (Entities.js's updateAlienPortals records when it appeared; Systems.js's updateStoryTriggers checks this delay before starting the 'alienintro' guided-tutorial flow)
export const ALIEN_FOOD_BLOCK_DURATION_MS = 1000; // per direct request ("so you don't accidentally place 4 food after killing a fish") — Food can't be placed within a just-killed alien's old click radius for this long; see Entities.js's trySpawnFood/isInAlienFoodBlockZone
export const WASTE_DRAG_TUTORIAL_WAIT_MS = 1000; // per direct request — if the player already placed a Waste Turret before the post-alien tutorial would fire, it waits this long after Waste first appears in the city before teaching just the "drag Waste into it" step — see Systems.js's updatePostAlienTutorial
export const WASTE_DRAG_GHOST_CYCLE_MS = 1400; // one full waste->turret sweep of the "drag me here" ghost animation shown during that tutorial step — see main.js's render()
export const POST_ALIEN_TUTORIAL_MESSAGE = "Now that's I'm talking about. A little firepower never hurt no one."; // per direct request's exact wording — posted once the player finishes placing the guided Waste Turret
// ---- Storage Chest guided tutorial ("chest" flow, UI.js's TUTORIAL_FLOWS) ----
// Triggered once, directly from Mound.js's crackMound the moment the $75
// tease grants the Tier 1 chest — same "shop -> select -> place -> drag"
// shape as the postalien/turret tutorial, minus its 'scroll' step (the
// player's camera is already centered on the Mound right where this fires,
// so there's nothing to scroll to first). See UI.js's POST_MOUND_CHEST_SPOT
// for where the tutorial's own chest gets placed.
export const CHEST_TUTORIAL_GOLD_GRANT = 20; // per direct request — matches the Tier 1 chest's own $20 cost exactly, same "always affordable regardless of how the player already spent their starting money" reasoning TURRET_TUTORIAL_GOLD_GRANT uses
export const CHEST_TUTORIAL_GOLD_GRANT_MESSAGE = "Here's 20 gold — go place that chest.";
// A few tiles left of POST_MOUND_CHEST_SPOT (UI.js) — same "deterministic
// spawn, locked as the tutorial's own drag target" reasoning as
// TURRET_TUTORIAL_WASTE_X/Y above, so the "drag Waste into the Chest" step
// always has something real to grab regardless of whether organic Waste
// happens to be nearby.
export const CHEST_TUTORIAL_WASTE_X = WORLD_W / 2 + TILE_SIZE;
export const CHEST_TUTORIAL_WASTE_Y = SEABED_FLOOR_Y + TILE_SIZE * 2;
export const CHEST_TUTORIAL_MESSAGE = "Now you've got somewhere to stash the overflow — drag away from any chest and let go whenever you want it trickling back out.";
// Per direct request ("make the clickable area 8 full tiles around the
// placed chest") — only during the 'trickle' step's own aim-drag mousedown
// (main.js's getChestKeyNear call), so a slightly-off-target press during
// the FIRST time a player ever sees this gesture still grabs the tutorial's
// chest instead of silently doing nothing. Ordinary (non-tutorial) chest
// drags are unaffected — those still require landing on the chest's own
// tile exactly, same as ever.
export const CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES = 8;
// Per direct request ("add in a chat a one time message when a fish or
// building hasn't been purchased for 60 seconds that they should check out
// the achievements to get ideas on how to progress") — see Systems.js's
// updateIdlePurchaseHint, which tracks state.level.lastPurchaseAtMs.
export const IDLE_PURCHASE_HINT_DELAY_MS = 60000;
export const IDLE_PURCHASE_HINT_MESSAGE = "Not sure what to do next? Check the Achievements tab (🎖️) — it's full of ideas for how to keep growing your tank.";

// ---- Power/Bio-Sludge/Biomass story tips ----
// Per direct request: an occasional (not guaranteed every time), randomly-
// gated chat nudge while buildings are actively power-starved — checked
// every POWER_WARNING_CHECK_INTERVAL_MS regardless of outcome (Systems.js's
// updatePowerWarnings), with only a POWER_WARNING_CHANCE odds of actually
// posting each time the condition holds, so it reads as occasional
// commentary rather than a metronome. Two distinct messages for the two
// distinct states state.level.powerEfficiency can represent: a full outage
// (0, real demand against zero effective supply) vs. a partial shortfall
// (anywhere in between).
export const POWER_WARNING_CHECK_INTERVAL_MS = 30000;
export const POWER_WARNING_CHANCE = 0.35;
export const POWER_WARNING_NONE_MESSAGE = "Some of your buildings are just sitting there with zero juice. Might want to add some electricity to the grid.";
export const POWER_WARNING_PARTIAL_MESSAGE = "Your grid's running short — buildings are chugging along slower than they could. A bit more electricity would help.";
// One-time tip, per direct request — fires once more than 5 Bio-Sludge
// (alien_dna) items are sitting in the tank at once, but only for a player
// who doesn't have a Manufacturer yet (the tip's whole point is nudging them
// toward getting one, so it'd be a non sequitur once they already have it).
export const BIO_SLUDGE_PILE_MESSAGE = "That's a lot of Bio-Sludge piling up out there. A Manufacturer could actually put it to use.";
export const BIO_SLUDGE_PILE_THRESHOLD = 5;
// One-time tip, per direct request — fires the first time a Biomass item is
// ever created (the Refinery's own Alien-DNA/Bio-Sludge -> Biomass recipe).
export const FIRST_BIOMASS_MESSAGE = "Ooh, fresh Biomass. That'd go nicely with some Blue Science from the Manufacturer.";

// ---- Autosave (Save.js) ----
// Per direct request — a background save every 5 minutes of real elapsed sim
// time, on top of the existing manual pause-menu Save button. See
// Systems.js's updateAutosave/Levels.js's nextAutosaveAtMs.
export const AUTOSAVE_INTERVAL_MS = 300000; // 5 minutes

// ---- Alien Invasion (Aliens.js) ----
// A "wave" is one spawn burst — a handful of aliens emerging from portals at
// once, after which the timer restarts for the next one. Difficulty scales
// with how many waves have already spawned THIS level
// (state.level.alienWavesSpawned, level-scoped like Tier/money — resets on
// restart): wave SIZE ramps linearly from its EARLY values up to its LATE
// ones across ALIEN_WAVE_DIFFICULTY_RAMP_WAVES waves, then holds steady —
// per direct request ("start with... only a couple spawning, and eventually
// have 10-15 spawn"). HP is no longer a single scaled number at all — see
// "Dynamic Alien Archetypes" below, which replaces it with 5 distinct
// alien tiers, each with its own fixed stat profile, rolled via a weighted
// mix that shifts across this exact same wave-progress axis.
// Per direct request, the wave-to-wave gap is no longer a flat random 3-5
// minute range — it now ramps deterministically with difficulty, same
// ALIEN_WAVE_DIFFICULTY_RAMP_WAVES progress axis every other wave-scaling
// number here already uses: 3.5 minutes between waves at the very start of a
// level, stretching out to 4.5 minutes once the ramp is fully maxed out (see
// Systems.js's waveIntervalMsAt). No more per-wave randomness on top — the
// two anchor points ARE the exact numbers requested, not a range to roll
// within.
export const ALIEN_WAVE_INTERVAL_EARLY_MS = 210000; // 3.5 minutes
export const ALIEN_WAVE_INTERVAL_LATE_MS = 270000; // 4.5 minutes
// Per direct request (originally "1 minute earlier," then a further "30
// seconds earlier" on top of that — 90000 total), subtracted only from the
// very first wave's own initial countdown seed (Levels.js's loadLevel) —
// every wave after the first still uses the plain ramped interval above,
// unaffected.
export const ALIEN_FIRST_WAVE_EARLY_MS = 90000;
// The very first wave's one alien is deliberately biased away from the right
// portion of the water column, per direct bug report — the HUD pill cluster
// sits fixed top-right on screen the whole game, and a portal rolled anywhere
// in the full FISH_MIN_X..FISH_MAX_X range could land underneath it, where
// the cinematic intro's spotlight hole would be visually correct but the
// click itself would hit the (non-interactive) HUD element instead of ever
// reaching the canvas below it. Clamping the first alien to the left portion
// of the range keeps it clear of that corner regardless of its Y roll.
export const ALIEN_FIRST_WAVE_SAFE_X_FRACTION = 0.6;
// Per direct request ("alien progression gets too hard too fast, it should
// take hours before the last tier of alien shows up") — this is the same
// progress axis ALIEN_TIER_MIX_KEYFRAMES rides (Systems.js's
// alienDifficultyT = alienWavesSpawned / this), so raising it stretches out
// both the wave-size/frequency ramp AND the tier mix together. At the old
// value of 10, Tier 5 (Leviathan) already had a 5% spawn chance by wave 8
// (t=0.75) — well under an hour in. At 48, with waves landing roughly every
// ~4 minutes on average (ALIEN_WAVE_INTERVAL_EARLY_MS/_LATE_MS), that same
// t=0.75 point (Tier 5's first appearance) lands around wave 36, ~2.5 hours
// into a level, and the ramp doesn't fully max out (heavy Tier 4/5) until
// close to 4 hours.
export const ALIEN_WAVE_DIFFICULTY_RAMP_WAVES = 48;
export const ALIEN_WAVE_COUNT_EARLY_MIN = 2;
export const ALIEN_WAVE_COUNT_EARLY_MAX = 3;
export const ALIEN_WAVE_COUNT_LATE_MIN = 10;
export const ALIEN_WAVE_COUNT_LATE_MAX = 15;

// ---- Dynamic Alien Archetypes (Architectural Update) ----
// Replaces the old single generic alien (one HP range scaled by wave
// progress) with 5 distinct tiers, each a real archetype with its own
// health, speed, DNA yield, size, and color — per direct spec ("higher tier
// aliens have higher health, faster movement... and drop significantly
// more alien_dna"). hpMin/hpMax still give each tier a little natural
// per-instance variance (Systems.js's spawnAlienWave rolls within it), same
// as the old flat range did; every other field is fixed per tier.
// Placeholder balance, like every other economy/combat number in this file
// — tune once real playtesting exists.
// fishDamagePerSec: per direct spec, each tier does progressively more
// damage per second (once per second, not continuously — see
// ALIEN_FISH_DAMAGE_INTERVAL_MS) to any fish it's touching — 5 for the
// lowest tier up to 35 for the highest, evenly stepped across all 5.
// Per direct request ("more visually distinct alien tiers, change the looks
// and coloring more between different tiers") — the old palette was a
// single brightness ramp through one purple/magenta hue family, which read
// as "the same alien, slightly lighter" rather than genuinely different
// tiers. Now each tier gets its own real hue family (main.js's
// drawAlienBody reads these fields directly, no per-tier special-casing
// there): `spikes` (dorsal-spike count, 1-5, one visible per tier),
// `bodyWidthMul`/`bodyHeightMul` (scale the body ellipse's own base ratios —
// Scout stays a plain round blob, Stalker stretches leaner/sleeker to match
// its name, Behemoth/Leviathan both bulk up), and `glow` (a soft outer aura
// for the top two tiers only, so they read as visibly more dangerous at a
// glance even in a mixed-tier wave, not just via the health bar).
// Per direct request ("aliens do slightly too much damage" / "higher tiers
// give too much bio-sludge"): fishDamagePerSec is cut a flat 20% across
// every tier (5/12.5/20/27.5/35 -> 4/10/16/22/28, still evenly stepped) —
// slightly softer without changing the relative tier-to-tier ramp. dnaYield
// is flattened at the top end instead of a uniform cut, since the complaint
// was specifically "higher tiers" (1/2/4/7/12 -> 1/2/3/5/7) — Tier 1/2 are
// untouched, Tier 3-5 each pull back toward a gentler curve.
export const ALIEN_ARCHETYPES = [
  { id: 'alien_t1', tier: 1, name: 'Alien Scout', hpMin: 20, hpMax: 30, speed: 40, dnaYield: 1, radius: 16, color: '#5a2d6b', fishDamagePerSec: 4, spikes: 1, bodyWidthMul: 1.0, bodyHeightMul: 1.0, glow: false },
  { id: 'alien_t2', tier: 2, name: 'Alien Brute', hpMin: 40, hpMax: 55, speed: 46, dnaYield: 2, radius: 18, color: '#3d4a8f', fishDamagePerSec: 10, spikes: 2, bodyWidthMul: 1.08, bodyHeightMul: 1.08, glow: false },
  { id: 'alien_t3', tier: 3, name: 'Alien Stalker', hpMin: 65, hpMax: 85, speed: 54, dnaYield: 3, radius: 20, color: '#2d8f6e', fishDamagePerSec: 16, spikes: 3, bodyWidthMul: 1.3, bodyHeightMul: 0.8, glow: false },
  { id: 'alien_t4', tier: 4, name: 'Alien Behemoth', hpMin: 95, hpMax: 130, speed: 62, dnaYield: 5, radius: 23, color: '#c4522a', fishDamagePerSec: 22, spikes: 4, bodyWidthMul: 1.18, bodyHeightMul: 1.18, glow: true },
  { id: 'alien_t5', tier: 5, name: 'Alien Leviathan', hpMin: 150, hpMax: 220, speed: 70, dnaYield: 7, radius: 27, color: '#ff33dd', fishDamagePerSec: 28, spikes: 5, bodyWidthMul: 1.32, bodyHeightMul: 0.92, glow: true },
];
// The rolling wave-mix weight curve — per direct spec's 5-phase description
// (Early 100% T1 -> Mid-Early T1/T2 -> Mid T1/T2/T3 -> Late phases out T1,
// mostly T3/T4 with occasional T2/rare T5 -> End Game heavy T4/T5 with a
// few residual T3). Each keyframe's weights array is one entry per
// ALIEN_ARCHETYPES tier (index 0 = tier 1 ... index 4 = tier 5) and always
// sums to 1 — Systems.js's alienTierWeightsAt linearly interpolates between
// the two keyframes bracketing the current wave-progress t (the exact same
// 0..1 progress alienDifficultyT already computes from
// state.level.alienWavesSpawned / ALIEN_WAVE_DIFFICULTY_RAMP_WAVES, reused
// here rather than adding a second, separately-tuned ramp), then
// rollAlienArchetype picks one tier via a weighted random draw against that
// interpolated curve — so the mix drifts smoothly through every phase
// instead of ever hard-swapping from one tier straight to the next.
export const ALIEN_TIER_MIX_KEYFRAMES = [
  { t: 0, weights: [1, 0, 0, 0, 0] }, // Early Game — 100% Tier 1
  { t: 0.25, weights: [0.6, 0.4, 0, 0, 0] }, // Mid-Early — Tier 1/2 mix
  { t: 0.5, weights: [0.34, 0.33, 0.33, 0, 0] }, // Mid Game — Tier 1/2/3 mix
  { t: 0.75, weights: [0, 0.15, 0.35, 0.45, 0.05] }, // Late Game — Tier 1 phased out, mostly Tier 3/4, occasional Tier 2, rare Tier 5
  { t: 1, weights: [0, 0, 0.15, 0.45, 0.4] }, // End Game — heavy Tier 4/5, a few residual Tier 3s
];
// Hard ceiling on simultaneously-alive aliens (plus any not-yet-opened
// portal, so a burst can't sneak past it) — nothing about "waves ramp up to
// 10-15 aliens" was ever meant to mean aliens stack UNBOUNDED across
// multiple un-cleared waves. Without this, a neglected tank's alien count
// (each one pooping a Waste item every ALIEN_POOP_INTERVAL_MS forever, see
// below) climbs without limit over a long session, and Grid.js's
// resolveItemCollisions is O(items^2) per tick — that combination is what
// causes the framerate to gradually collapse the longer aliens go
// un-fought. See Systems.js's spawnAlienWave, which shrinks (or skips) a
// wave's spawn count to whatever room is left under this cap rather than
// always spawning its full rolled amount.
export const ALIEN_MAX_ALIVE = 20;

// Warnings + the on-screen countdown — per direct request ("plenty of HUD
// chat message warnings, and a countdown timer from 10 seconds that shows up
// at the top of the screen when there's 10 seconds left").
export const ALIEN_WARNING_MS_1 = 60000; // first chat-log warning, 60s out
export const ALIEN_WARNING_MS_2 = 30000; // second chat-log warning, 30s out
export const ALIEN_COUNTDOWN_START_MS = 10000; // the visible on-screen "10... 9... 8..." banner takes over from here
// How far ahead of an incoming wave the Battle music starts fading in, per
// direct request ("have the Game music fade out and the Battle music fade
// in when there's 3 seconds of a count-down for aliens left") — main.js's
// per-tick music-state check compares this against the same
// alienNextWaveAtMs - elapsed countdown the on-screen banner above already
// reads. Sound.js's own crossfade duration is set to match this exactly, so
// Battle reaches full volume right as the wave actually spawns.
export const ALIEN_MUSIC_BATTLE_LEAD_MS = 3000;
export const ALIEN_WARNING_MESSAGE_1 = "Something's stirring out past the reef... probably nothing.";
export const ALIEN_WARNING_MESSAGE_2 = "Uh oh, I'm reading movement out there. Get your turrets ready.";
// Per direct request, waves 2 and 3 get a slightly reworded version of the
// 30s warning instead of a verbatim repeat; wave 1 still gets the original
// wording above. Both go silent entirely after wave 3 — see
// ALIEN_WARNING_MAX_WAVES and Systems.js's updateAlienWaves.
export const ALIEN_WARNING_MESSAGE_2_REPEAT = "Uh oh, I'm picking up movement again. Get your turrets ready.";
export const ALIEN_WARNING_MAX_WAVES = 3; // no more upcoming-wave chat warnings once this many waves have already spawned
export const ALIEN_FIRST_WAVE_TIP_MESSAGE = "Aliens incoming! Click 'em for 1 damage a pop, or let a turret handle it. While they're alive they'll poop waste and scare nearby fish off their coins, so don't dawdle.";
// Per direct request ("add a chat message after the first alien wave
// letting the player know the aliens can be distracted from the fish with
// food") — posted once, right after the very first wave is fully cleared
// (Systems.js's updateAlienWaves, the same moment alienWaveActive flips back
// to false for the first time), since that's when the player has just
// finished dealing with their first real encounter and is most likely to
// actually retain a tip about handling the next one differently.
export const ALIEN_FOOD_DISTRACTION_TIP_MESSAGE = "Psst — aliens are suckers for a free meal. Toss down some Food and watch 'em beeline for it instead of your fish.";

// ---- Mother Alien Fish (end-game boss) ----
// Per direct spec — a one-time purchase in the Science Lab (see
// SCIENCE_LAB_UPGRADES.mother_alien_fish) triggers a 16-second cinematic
// reveal before the boss itself actually appears (Entities.js's
// createMotherAlienFish) — see main.js's updateBossSequence for the actual
// state machine, all driven off one running state.level.bossIntroTimerMs
// clock rather than a separate timer per beat. Per direct request, this
// replaces the earlier, much shorter "wait 2s, shake + flash white, spawn"
// version entirely — the screen shake is gone (not part of the new script),
// and the flash is now a real, deliberate multi-second white fade instead of
// a quick blink.
//
// Timeline (all in ms from the moment the purchase triggers it) — reordered
// per a direct follow-up request so the reveal message posts right as the
// music finishes fading OUT (not after the boss track has already faded
// back in), leaving a genuine stretch of silence before the boss music
// starts. Beat durations were rebalanced twice more in later follow-ups
// (silence cut, post-music wait extended, then the white fade-in extended
// twice in a row) so the boss track gets more real playing time before the
// screen turns white — the shape below and every constant/comment beneath
// it already reflect the latest pass (a 17-second total), not any of the
// earlier 15s/16s versions:
//   [0, BOSS_MUSIC_FADE_OUT_MS)                        — Game/Battle fade OUT
//                                                        (Sound.js's
//                                                        triggerBossMusic)
//   BOSS_INTRO_MESSAGE_AT_MS                           — the reveal chat
//                                                        line posts, once,
//                                                        right as the
//                                                        fade-out finishes
//   [BOSS_INTRO_MESSAGE_AT_MS, BOSS_MUSIC_FADE_IN_START_MS) — BOSS_SILENCE_WAIT_MS
//                                                        of genuine silence —
//                                                        Game/Battle are
//                                                        already at 0, Boss
//                                                        hasn't started
//                                                        fading in yet
//   [BOSS_MUSIC_FADE_IN_START_MS, +BOSS_MUSIC_FADE_IN_MS) — Boss music fades IN
//   [that point, BOSS_WHITE_FADE_IN_START_MS)          — BOSS_POST_MUSIC_WAIT_MS
//                                                        more, music now
//                                                        playing normally
//   [BOSS_WHITE_FADE_IN_START_MS, BOSS_SPAWN_MS)       — screen turns white
//   BOSS_SPAWN_MS                                      — boss spawns; white
//                                                        immediately starts
//                                                        fading back out over
//                                                        BOSS_WHITE_FADE_OUT_MS
export const BOSS_MUSIC_FADE_OUT_MS = 3000; // "3 second fade out"
export const BOSS_INTRO_MESSAGE_AT_MS = BOSS_MUSIC_FADE_OUT_MS; // "then the chat message" — right as the fade-out finishes, not after the boss track has already faded back in
export const BOSS_INTRO_MESSAGE = 'Seems like something was supposed to happen...';
export const BOSS_SILENCE_WAIT_MS = 3000; // cut from 5000 per direct request ("reduce the time on the silence to 3 seconds") — Game/Battle have already faded to 0 and Boss hasn't started fading in yet
export const BOSS_MUSIC_FADE_IN_START_MS = BOSS_INTRO_MESSAGE_AT_MS + BOSS_SILENCE_WAIT_MS; // 3000 + 3000 = 6000
export const BOSS_MUSIC_FADE_IN_MS = 1000; // "then a 1 second song fade in"
export const BOSS_POST_MUSIC_WAIT_MS = 5000; // raised from 4000 per direct request ("increase the wait after the fade in on the boss music to 5 seconds before the fade to white starts") — so the boss song has longer to play before the white fade-in starts
export const BOSS_WHITE_FADE_IN_START_MS = BOSS_MUSIC_FADE_IN_START_MS + BOSS_MUSIC_FADE_IN_MS + BOSS_POST_MUSIC_WAIT_MS; // 6000 + 1000 + 5000 = 12000
export const BOSS_WHITE_FADE_IN_MS = 5000; // raised from 4000 per direct request ("increase the fade to white time to 5 seconds for a total of 17 seconds") — was raised from 3000 to 4000 the pass before this one for the same "boss song has longer to play" reason
export const BOSS_SPAWN_MS = BOSS_WHITE_FADE_IN_START_MS + BOSS_WHITE_FADE_IN_MS; // 12000 + 5000 = 17000 — "a total of 17 seconds," matches exactly
// "Then the white goes away and the boss appears" — no duration was given
// for the white clearing itself (unchanged by this pass), so this stays a
// deliberately short, snappy reveal (much quicker than the 3s fade-in)
// rather than a second long fade, so the boss's actual appearance reads as
// the payoff moment, not another slow transition.
export const BOSS_WHITE_FADE_OUT_MS = 1000;
// "A big ole alien enemy that's 10x harder than a tier 5 alien" — applied to
// the existing Tier 5 archetype's own hpMin/hpMax range (150-220 -> 1500-2200),
// not a bespoke stat block, so the boss automatically stays "10x a Tier 5"
// even if that base archetype is ever rebalanced later.
export const BOSS_HP_MULTIPLIER = 10;
export const BOSS_RADIUS = 90;
export const BOSS_SPEED = 28; // slow and lumbering, "big ole" per spec
export const BOSS_COLOR = '#3a0d42';
// "spawns extra aliens out of its mouth every couple seconds" — minions are
// plain Tier 1/2 aliens (ALIEN_ARCHETYPES[0]/[1]), still counted against
// ALIEN_MAX_ALIVE like any other alien so the same anti-framerate-collapse
// ceiling still holds even during the boss fight.
export const BOSS_MINION_SPAWN_INTERVAL_MS = 4000;
export const BOSS_MINION_SPAWN_COUNT = 2;
// On death: "have the boss exploded and turn into a bunch of green and blue
// science (ignore the bubble cap at this point so it will spawn a bunch of
// science)" — see Entities.js's updateAlien death branch, isBoss case.
export const BOSS_DEATH_SCIENCE_COUNT = 12; // blue Science bubbles
export const BOSS_DEATH_SCIENCE_GREEN_COUNT = 12; // Green Science bubbles
// "...and then slowly fade in a game over modal" — the delay between the
// death-burst finishing and the stats modal starting its fade-in, plus the
// fade's own duration (read by main.js/UI.js's showGameOverModal, and by
// style.css's #game-over-overlay transition).
export const BOSS_DEFEATED_MODAL_DELAY_MS = 2000;
export const BOSS_DEFEATED_MODAL_FADE_MS = 2500;
// "have a universal boss health bar at the top middle of the screen instead
// of over the boss's head" — a DOM element (UI.js's updateBossHealthBar),
// not drawn on the canvas like a normal alien's own health bar, so it can
// sit fixed at a screen position regardless of where the boss actually is
// in the world.
export const BOSS_HEALTH_BAR_WIDTH = 420;
export const BOSS_HEALTH_BAR_HEIGHT = 26;

// AI — deliberately not a strict chase/flee, per direct request ("both the
// aliens and the fish are gonna be kinda dumb at being predator/prey, so
// don't make them strictly move towards the target fish or away from the
// alien"). Each time an alien/fish picks a new wander target (its existing
// WANDER_INTERVAL_* cadence for fish, ALIEN_WANDER_INTERVAL_* below for
// aliens), a fresh coin flip against these chances decides whether that
// particular wander happens to bias toward the nearest threat/prey (alien)
// or away from it (fish) instead of a plain random direction — never a
// hard-locked pursuit/retreat.
// ALIEN_CHASE_CHANCE raised 0.5->0.85, ALIEN_AWARENESS_RADIUS 260->420, and
// the wander interval shortened (1-2.5s -> 0.6-1.5s) per direct report that
// aliens "don't seem drawn to fish at all" — the old combination (only a
// coin-flip's chance of even considering a fish, re-rolled at most once
// every ~1.75s on average, noticing fish only within a fairly tight radius)
// made the chase bias read as nearly imperceptible in normal play. Still
// deliberately not a hard lock — see this section's own comment above — the
// per-pick random angle offset (Entities.js's updateAlien) still keeps it
// "kinda dumb," just far more often and more responsively pointed at a fish
// when one's actually nearby.
export const ALIEN_CHASE_CHANCE = 0.85;
export const ALIEN_FLEE_CHANCE = 0.65;
export const ALIEN_AWARENESS_RADIUS = 420; // px — how close a fish/alien has to be to the other before either reacts to it at all
export const ALIEN_SPEED = 40; // px/sec — fallback only now (Entities.js's createAlien copies each archetype's own `speed` onto the alien instance; this is just what an unrecognized/missing archetypeId falls back to)
export const ALIEN_WANDER_INTERVAL_MIN_S = 0.6;
export const ALIEN_WANDER_INTERVAL_MAX_S = 1.5;

export const ALIEN_CLICK_DAMAGE = 1; // per direct request — "clicking on them for 1 damage each"
// Same "hit-test radius bigger than the drawn radius" pattern as
// COIN_CLICK_RADIUS_MULTIPLIER — per direct request ("the clickable area
// for the aliens is 50% larger than the actual visual radius... so they are
// easier to click"). Purely a hit-test multiplier, applied to each alien's
// own instance radius (alien.radius, from its archetype) now rather than a
// flat ALIEN_RADIUS.
export const ALIEN_CLICK_RADIUS_MULTIPLIER = 1.5;
export const ALIEN_INCOME_BLOCK_RADIUS = 90; // px — a fish this close to a LIVING alien produces no coin on its drop timer at all, see Entities.js's updateFish
// Originally a much tighter radius than ALIEN_AWARENESS_RADIUS (fish-chasing)
// — "make it so aliens will go towards food only if it's close to them and
// eat the food." Raised to match ALIEN_AWARENESS_RADIUS exactly per a later
// direct request ("make all aliens prioritize food over fish") — Entities.js's
// updateAlien checks for nearby Food AFTER the wander-cycle's fish-chase
// roll and unconditionally overrides whatever heading that roll picked, so
// equalizing the two radii means food genuinely wins outright any time both
// a fish and Food are within the same detection range, rather than only
// within a much smaller sub-area. Checked fresh every tick (unlike the
// fish-chase bias, which only re-rolls on a wander cycle) so an alien can
// react the instant Food drifts into range. ALIEN_FOOD_EAT_RADIUS isn't a
// flat constant — Entities.js's updateAlien computes it as the alien's own
// instance radius plus FOOD_RADIUS, since alien size varies by archetype.
export const ALIEN_FOOD_AWARENESS_RADIUS = ALIEN_AWARENESS_RADIUS;
export const ALIEN_RADIUS = 16; // px — fallback only now, same role as ALIEN_SPEED above; every real alien's own radius/color come from its archetype (ALIEN_ARCHETYPES), copied onto the instance by Entities.js's createAlien
export const ALIEN_COLOR = '#5a2d6b'; // dark purple — fallback only, matches ALIEN_ARCHETYPES[0]'s own color (Tier 1)
export const ALIEN_HEALTH_BAR_WIDTH = 30;
export const ALIEN_HEALTH_BAR_HEIGHT = 4;

// ---- Fish Health (aliens can now hurt/kill fish, per direct request) ----
// Flat by growth stage, not by species — baby/mid/adult, regardless of which
// of the 18 SPECIES rows a fish is. Entities.js's maxHpForStage resolves any
// species' own stage count generically (stage 0 = baby, the LAST stage =
// adult, anything in between = mid), so this works unchanged for a 3-stage
// base feeder/utility fish or a hybrid with a different stage count alike.
export const FISH_HEALTH_BABY = 75;
export const FISH_HEALTH_MID = 100;
export const FISH_HEALTH_ADULT = 125;
// Damage is applied once per second (not continuously scaled by dt) to every
// fish a living, non-hatch-grace-period alien is currently touching — see
// Entities.js's updateAlien. Each archetype's own rate lives on its
// ALIEN_ARCHETYPES row (fishDamagePerSec); the boss isn't one of those 5
// tiers, so it gets its own flat rate below instead.
export const ALIEN_FISH_DAMAGE_INTERVAL_MS = 1000;
export const BOSS_FISH_DAMAGE_PER_SEC = 50; // above Tier 5's 35, matching the boss's "far deadlier than any wave alien" flavor without a full 10x multiply (its other stats — see BOSS_SPEED's own comment — are individually hand-tuned too, not a uniform scale-up)
// Per direct request: fish don't regenerate AT ALL while any alien is alive
// anywhere in the level, but once the last one dies, every damaged fish
// heals back to full over this long — a flat rate (maxHp / this duration),
// so a barely-scratched fish tops off well under 5 seconds while a nearly-
// dead one takes the full stretch. See Entities.js's updateFish.
export const FISH_HEALTH_REGEN_DURATION_MS = 5000;
// A fish's health bar only ever renders while it's actually missing health
// (main.js's render loop) — smaller than an alien's own bar (ALIEN_HEALTH_BAR_
// WIDTH/HEIGHT above) and a different color (green-to-red gradient) so the
// two can't be confused for one another even when both are on screen at once.
export const FISH_HEALTH_BAR_WIDTH = 22;
export const FISH_HEALTH_BAR_HEIGHT = 3.5;

// ---- Fish death animation ----
// Per direct request: a fish no longer just vanishes the instant it starves
// or an alien finishes it off — it plays a short death animation first (see
// Entities.js's updateDyingFish, called from updateFish once fish.dying is
// set at either death-trigger site). It turns fully gray immediately (via
// main.js's render passing grayed=1 while fish.dying), drifts gently upward
// toward the tank's ceiling for FISH_DEATH_RISE_DURATION_MS, then fades out
// over the following FISH_DEATH_FADE_DURATION_MS before the entity is
// actually removed from state.level.entities — the rise itself continues
// unbroken through the fade too, so the whole thing reads as one continuous
// drift rather than a stop-then-fade.
export const FISH_DEATH_RISE_DURATION_MS = 2500;
export const FISH_DEATH_FADE_DURATION_MS = 1200;
export const FISH_DEATH_TOTAL_DURATION_MS = FISH_DEATH_RISE_DURATION_MS + FISH_DEATH_FADE_DURATION_MS;
export const FISH_DEATH_RISE_SPEED = 16; // px/sec — a slow, limp upward drift, not a swim
export const FISH_DEATH_CEILING_MARGIN_PX = 20; // how close to the world's true top edge (y=0) it's allowed to drift, same "small margin, not flush against the glass" idea as the tank's own item-boundary clamps

// Hit feedback + death animation, per direct request ("aliens flash red and
// bounce when they take damage, which a visual animation when they get
// killed"). Set on the alien itself (Entities.js's createAlien/updateAlien)
// the moment either damage source (Grid.js's Turret branch, main.js's
// click handler) reduces its hp — main.js's render reads it back to blend
// the body color toward ALIEN_HIT_FLASH_COLOR and apply a brief scale-punch
// "bounce," both decaying to nothing over this same window.
export const ALIEN_HIT_FLASH_MS = 220;
export const ALIEN_HIT_FLASH_COLOR = { r: 255, g: 59, b: 59 }; // #ff3b3b, pre-split for main.js's per-frame RGB lerp
export const ALIEN_HIT_BOUNCE_SCALE = 0.35; // peak extra scale (1 + this, at the midpoint of the flash) during the hit bounce
// A short expanding/fading burst played at an alien's last position the
// instant it dies (Entities.js's updateAlien pushes one into
// state.level.alienDeathEffects, main.js renders and ages them) — fully
// decoupled from the alien entity itself, which is removed from
// state.level.entities immediately, same "independent particle" pattern
// state.level.floatingTexts already uses for pickup text.
export const ALIEN_DEATH_EFFECT_DURATION_MS = 500;

// A fish tints gray under two conditions — per direct request ("make fish
// visually turn a gray color when they aren't producing coins, and make
// them turn this color for 1 second as well if they try to produce a coin
// but the coin max is reached"): continuously, for as long as it's within
// ALIEN_INCOME_BLOCK_RADIUS of a living alien (refreshed every tick that
// stays true, so it reads as a steady tint, not a flicker), or for exactly
// this long, one-shot, the moment a coin-drop is blocked by the Coin Cap.
export const FISH_BLOCKED_TINT_MS = 1000;

// Portals — temporary animated spawn points, per direct request ("have
// alien fish spawn in from animated temporary portals that open to let them
// through"). One portal per alien in a wave, staggered so a whole wave
// doesn't pop in on the exact same instant.
export const ALIEN_PORTAL_OPEN_MS = 900; // grow-in duration before the alien actually emerges
export const ALIEN_PORTAL_CLOSE_MS = 700; // shrink-out duration after it emerges
export const ALIEN_PORTAL_RADIUS = 26;
export const ALIEN_PORTAL_STAGGER_MS = 350; // gap between each alien's own portal opening, within one wave

// ---- Achievements, Fishy Gems, and hats ----
// Per direct request: a permanent (state.meta-scoped) achievement system
// whose only reward is Fishy Gems — a currency that ONLY ever appears in the
// Achievements/Customization panels and the end-game screen, never the main
// HUD — spent in the Customization panel on cosmetic hats. Achievements are
// a mix of "natural" ones (a lifetime counter that just climbs during normal
// play — money earned, aliens killed, buildings placed, etc., tracked in
// state.meta.stats — see Levels.js/Entities.js/Grid.js/Systems.js for each
// counter's own increment site) and a handful that need genuine deliberate
// setup (saving a fish right at the brink of starving, sustaining a power
// deficit/surplus for a full continuous minute, recovering the tank's
// cleanliness after letting it get genuinely dirty, stockpiling a lot of
// Science on screen at once). Every achievement resolves to one generic
// `stats[statField] >= threshold` check (Systems.js's updateAchievements),
// even the "specific setup" ones — their own dedicated tracking logic just
// writes into a matching stats field (a best-ever streak in ms, a one-shot
// 0/1 flag) instead of a plain incrementing counter, so the achievement
// table itself never needs to know which kind of stat it's reading.
export const ACHIEVEMENT_GEM_REWARD_BY_TIER = { easy: 5, medium: 10, hard: 20 };

export const ACHIEVEMENTS = {
  money_1k: { id: 'money_1k', name: 'Pocket Change', description: 'Earn $1,000 total.', tier: 'easy', statField: 'moneyEarned', threshold: 1000 },
  money_10k: { id: 'money_10k', name: 'Nice Little Nest Egg', description: 'Earn $10,000 total.', tier: 'medium', statField: 'moneyEarned', threshold: 10000 },
  money_100k: { id: 'money_100k', name: 'Tank Tycoon', description: 'Earn $100,000 total.', tier: 'hard', statField: 'moneyEarned', threshold: 100000 },
  alien_kills_10: { id: 'alien_kills_10', name: 'First Blood', description: 'Kill 10 aliens.', tier: 'easy', statField: 'alienKills', threshold: 10 },
  alien_kills_50: { id: 'alien_kills_50', name: 'Exterminator', description: 'Kill 50 aliens.', tier: 'medium', statField: 'alienKills', threshold: 50 },
  alien_kills_200: { id: 'alien_kills_200', name: 'Xenocide', description: 'Kill 200 aliens.', tier: 'hard', statField: 'alienKills', threshold: 200 },
  turret_kills_25: { id: 'turret_kills_25', name: 'Automated Defense', description: 'Get 25 alien kills specifically from turrets.', tier: 'medium', statField: 'turretKills', threshold: 25 },
  tank_points_10: { id: 'tank_points_10', name: 'Growing Up', description: 'Earn 10 Tank Points.', tier: 'easy', statField: 'tankPointsEarned', threshold: 10 },
  tank_points_50: { id: 'tank_points_50', name: 'Fully Grown', description: 'Earn 50 Tank Points.', tier: 'medium', statField: 'tankPointsEarned', threshold: 50 },
  buildings_placed_10: { id: 'buildings_placed_10', name: 'Handy', description: 'Place 10 buildings.', tier: 'easy', statField: 'buildingsPlaced', threshold: 10 },
  buildings_placed_50: { id: 'buildings_placed_50', name: 'Factory Brain', description: 'Place 50 buildings.', tier: 'medium', statField: 'buildingsPlaced', threshold: 50 },
  hybrids_created_1: { id: 'hybrids_created_1', name: 'Mad Scientist', description: 'Splice your first hybrid fish.', tier: 'easy', statField: 'hybridsCreated', threshold: 1 },
  hybrids_created_5: { id: 'hybrids_created_5', name: 'Gene Pool', description: 'Splice 5 hybrid fish.', tier: 'medium', statField: 'hybridsCreated', threshold: 5 },
  waves_survived_5: { id: 'waves_survived_5', name: 'Holding the Line', description: 'Survive 5 alien waves.', tier: 'easy', statField: 'wavesSurvived', threshold: 5 },
  waves_survived_20: { id: 'waves_survived_20', name: 'Siege Breaker', description: 'Survive 20 alien waves.', tier: 'hard', statField: 'wavesSurvived', threshold: 20 },
  // Replaces the old "Proud Parent" (raise 10 fish to adulthood) per direct
  // request — that one was functionally a duplicate of Growing Up (earn 10
  // Tank Points), since a Tank Point is earned exactly once per fish
  // reaching adulthood (TANK_POINT_PER_ADULT_FISH = 1 each), so the two
  // conditions could never actually diverge from one another.
  four_star_fish: { id: 'four_star_fish', name: 'Four-Star General', description: 'Combine a fish all the way up to 4-star.', tier: 'medium', statField: 'fourStarFishAchieved', threshold: 1 },
  science_banked_50: { id: 'science_banked_50', name: 'Lab Assistant', description: 'Bank 50 Science Bubbles.', tier: 'medium', statField: 'scienceBanked', threshold: 50 },
  fish_saved_10: { id: 'fish_saved_10', name: 'Lifeguard', description: 'Save 10 fish from starving by feeding them right at the brink.', tier: 'hard', statField: 'fishSaved', threshold: 10 },
  power_deficit_60s: { id: 'power_deficit_60s', name: 'Brownout', description: 'Under-produce electricity (demand exceeding supply) for a continuous 60 seconds.', tier: 'hard', statField: 'powerDeficitStreakBestMs', threshold: 60000 },
  power_surplus_60s: { id: 'power_surplus_60s', name: 'Overcharged', description: 'Produce at least double the electricity your grid needs, continuously, for 60 seconds.', tier: 'hard', statField: 'powerSurplusStreakBestMs', threshold: 60000 },
  cleanliness_recovery: { id: 'cleanliness_recovery', name: 'Spring Cleaning', description: 'Clean the tank back up to 99% after letting it drop below 90%.', tier: 'medium', statField: 'cleanlinessRecoveryDone', threshold: 1 },
  science_onscreen_10: { id: 'science_onscreen_10', name: 'Bubble Trouble', description: 'Have 10 Science Bubbles on screen at once.', tier: 'easy', statField: 'sciencePeakOnScreen', threshold: 10 },
  science_onscreen_25: { id: 'science_onscreen_25', name: 'Bubble Bath', description: 'Have 25 Science Bubbles on screen at once.', tier: 'medium', statField: 'sciencePeakOnScreen', threshold: 25 },
  science_onscreen_50: { id: 'science_onscreen_50', name: 'Bubble Apocalypse', description: 'Have 50 Science Bubbles on screen at once.', tier: 'hard', statField: 'sciencePeakOnScreen', threshold: 50 },
};
export const ACHIEVEMENT_LIST = Object.values(ACHIEVEMENTS);

// 12 hats ("at least a dozen," per direct spec). Costs were reworked per a
// later direct request ("make it so the more expensive hats are a little
// cheaper, so they don't have such a range in cost, and so the total Fishy
// gem cost for all of them is closer to 80% (about ~216 gems) of the total
// fishy gems that can be earned instead of the 94% it is now") — a plain
// linear ramp from 12 to 24 gems (a 12-gem spread, down from the original
// 12-30/18-gem spread) across all 12 hats sums to EXACTLY 216, i.e. exactly
// 80% of the 270 gems every achievement combined pays out (see
// ACHIEVEMENT_GEM_REWARD_BY_TIER's own total). `none` is the always-
// available, free default (no hat) — not counted toward "a dozen different
// hats," since it isn't really a hat.
//
// Two hats were swapped out entirely per a direct visual complaint ("I
// don't like [Static Spike/Star Struck] visually... swap the static spike
// for an actual shark fin, the current [shark_fin] one just doesn't look
// like it at all") — see FishRenderer.js's own comment on drawSharkFin/
// drawWitchHat/drawPartyHat for the full story: the OLD `shark_fin` hat's
// own drawn shape genuinely reads as a witch's hat (not a fin at all), so
// it's renamed `witch_hat` here instead of redrawn; `shark_fin` is now a
// brand new id with a real fin-shaped drawing, taking over Static Spike's
// old slot in the cost ramp; `party_hat` is a new id replacing Star Struck.
export const HATS = {
  none: { id: 'none', name: 'No Hat', icon: '🚫', gemCost: 0 },
  guppy_cap: { id: 'guppy_cap', name: "Lil' Guppy Cap", icon: '🧢', gemCost: 12 },
  fancy_fin: { id: 'fancy_fin', name: 'Fancy Fin Top Hat', icon: '🎩', gemCost: 13 },
  beach_bum: { id: 'beach_bum', name: 'Beach Bum Sun Hat', icon: '👒', gemCost: 14 },
  incognito: { id: 'incognito', name: 'Incognito Disguise', icon: '🥸', gemCost: 15 },
  turret_tech: { id: 'turret_tech', name: 'Turret Tech Helmet', icon: '🪖', gemCost: 16 },
  bubble_scholar: { id: 'bubble_scholar', name: 'Bubble Scholar Cap', icon: '🎓', gemCost: 17 },
  lucky_clover: { id: 'lucky_clover', name: 'Lucky Clover', icon: '🍀', gemCost: 19 },
  witch_hat: { id: 'witch_hat', name: "Witch's Hat", icon: '🧙', gemCost: 20 },
  pumpkin_head: { id: 'pumpkin_head', name: 'Pumpkin Head', icon: '🎃', gemCost: 21 },
  party_hat: { id: 'party_hat', name: 'Party Hat', icon: '🎉', gemCost: 22 },
  shark_fin: { id: 'shark_fin', name: 'Shark Fin', icon: '🦈', gemCost: 23 },
  tank_royalty: { id: 'tank_royalty', name: 'Tank Royalty Crown', icon: '👑', gemCost: 24 },
};
export const HAT_LIST = Object.values(HATS).filter((h) => h.id !== 'none');

// Continuous-streak achievements (power deficit/surplus) need a live,
// once-a-second sample of demand vs supply — reusing the exact cadence
// main.js's own HUD power-history sampler already runs on, rather than a
// second timer. ACHIEVEMENT_POWER_SURPLUS_RATIO is the "at least double"
// threshold power_surplus_60s's own description names directly.
export const ACHIEVEMENT_POWER_SURPLUS_RATIO = 2;

// Below this live grid efficiency, a power-costing building has genuinely
// stopped doing useful work (not just running a bit slower) — see Grid.js's
// computePowerEfficiency and every applied-efficiency gate (Fan force,
// Processor/Refinery/Manufacturer progress, Turret cooldown). Moved here
// from Grid.js (was module-private) since main.js's own once-a-second power
// sampler needs to read it too, for the power-shortage visual overlay.
// Per direct request ("buildings should only pull in objects if they have
// enough power to process the object") — raised from an earlier 0.15 to
// 0.5. Gates ONLY intake (Grid.js's hasEnoughPowerToOperate) — per a later
// direct follow-up ("if a building accepts an object for processing and
// then runs out of power, keep the object in the building — the only way
// to get that object out is for the building to be moved"), running out of
// power mid-hold no longer ejects anything; it just stalls progress at 0
// (every processing loop's own applied-efficiency multiplier already does
// that for free) until either power recovers or the building is moved.
export const POWER_SHORTAGE_STALLED_THRESHOLD = 0.5;
// Spring Cleaning's own two thresholds, named directly in its description —
// "drop below 90%" arms it, "back up to 99%" completes it.
export const ACHIEVEMENT_CLEANLINESS_ARM_THRESHOLD = 90;
export const ACHIEVEMENT_CLEANLINESS_COMPLETE_THRESHOLD = 99;
