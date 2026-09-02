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
export const WORLD_TILES_W = 60; // world width in tiles — was 160
// World height in tiles — 47, up from 45 per direct request ("allow for 4
// lines of buildings under the rocky shelf line instead of 2"). The water
// column (SEABED_ROW_START and up) is untouched; the 2 extra rows are pure
// seabed, added below the existing bottom edge specifically so ROCK_SHELF_Y
// below lands at the exact same absolute pixel height it always has (see its
// own comment) — the tank's visible silhouette doesn't shift at all, there's
// just more real floor beneath the shelf now. CAMERA_BOTTOM_BUFFER_PX is
// shrunk by the same 2 tiles' worth of px below so the combined scrollable
// depth (WORLD_H + the buffer) stays exactly what it was before, per direct
// request to "keep the height of the tank and visual buffer the same."
export const WORLD_TILES_H = 47;
export const WORLD_W = WORLD_TILES_W * TILE_SIZE; // 1920px
export const WORLD_H = WORLD_TILES_H * TILE_SIZE; // 1504px

export const SEABED_ROW_START = 27; // first seabed tile row; rows 0-26 are water column
export const SEABED_ROW_END = WORLD_TILES_H - 1; // last seabed tile row (46)
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
export const TILE_COLLECTOR = 'collector'; // solid — the base Processor: items landing here are immediately consumed (coins auto-banked)
export const TILE_COLLECTOR_ELECTRIC = 'collector_electric'; // solid — Electric Processor, faster processing, draws power — see PROCESSOR_STATS
export const TILE_COLLECTOR_ADVANCED = 'collector_advanced'; // solid — Advanced Processor, bought in the Science Lab — see PROCESSOR_STATS
export const TILE_FAN_T2 = 'fan_t2'; // solid — Rudimentary Fan (unlocked at the Mound's Tier 1.75, free, short reach/low force)
export const TILE_FAN_T3 = 'fan_t3'; // solid — Electric Fan (Tier 3, draws power, medium reach/force)
export const TILE_FAN_T4 = 'fan_t4'; // solid — Turbo Fan (Tier 4, draws power, long reach/extreme force)
export const TILE_AUTO_FEEDER = 'auto_feeder'; // solid — absorbs Waste pushed into its intake side, dispenses Food from the opposite side
export const TILE_AUTO_FEEDER_ELECTRIC = 'auto_feeder_electric'; // solid — Electric Auto-Feeder — see AUTO_FEEDER_STATS
export const TILE_AUTO_FEEDER_ADVANCED = 'auto_feeder_advanced'; // solid — Advanced Auto-Feeder, bought in the Science Lab — see AUTO_FEEDER_STATS
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
export const FAN_T2_MAX_FORCE = 260; // Rudimentary Fan — force magnitude at the emitter (see Grid.js's a = F/mass integration). Deliberately still too weak to hover a coin at all (3*88=264 > 260) — "struggles to lift a coin," unchanged.
export const FAN_T2_MAX_RANGE = 320; // px — 10 tiles (was 3, then 5, then 6, then 7, then 9; +1 more tile per direct request, the 7th such increase this session)
export const FAN_T2_POWER_COST = 0; // per direct request — "the rudimentary fan takes 0mw electricity"
export const FAN_T3_MAX_FORCE = 350; // Electric Fan — cut from 520, per direct request to rebalance the middle tier now that Turbo dropped to 440 (520 would otherwise have been the STRONGEST fan, backwards); sits clearly between Rudimentary (260) and Turbo (440)
export const FAN_T3_MAX_RANGE = 496; // px — 15.5 tiles (was 5.5, then 8.5, then 9.5, then 10.5, then 13.5; +2 more tiles)
export const FAN_T3_POWER_COST = 1; // per direct request — "the mid takes 1mw always"
export const FAN_T4_MAX_FORCE = 440; // Turbo Fan — see the hover-math comment above; was 1100 ("extreme thrust"), now a real but gentler suspension force
export const FAN_T4_MAX_RANGE = 640; // px — 20 tiles, unchanged per direct request ("the same range, but less powerful")
export const FAN_T4_POWER_COST = 3; // per direct request — "the advanced takes 3mw always"

// ---- Auto-Feeder ----
// No longer aimed at all, per direct request ("let's remove the arrows and
// the need for a specific input side") — Grid.js's updateBuildings absorbs
// any Waste item within AUTO_FEEDER_INTAKE_RADIUS of the tile's own CENTER,
// from any side, as long as it isn't already mid-hold on something else (see
// isNearBuildingCenter, which replaced the old angle-gated isOnIntakeSide
// entirely). After however many completed AUTO_FEEDER_STATS[type].wasteProcessMs
// holds that tier's wasteRequired calls for, it dispenses one Food item at a
// fixed point above the tile's top edge (AUTO_FEEDER_PORT_OFFSET_FRACTION of
// a tile out from center, now always straight up rather than angle-derived —
// "make it so the collectors and auto-feeders output on top, by default")
// with zero velocity — a Fan can then pick it back up and launch it into the
// water column, same as any other item.
export const AUTO_FEEDER_INTAKE_RADIUS = TILE_SIZE * 0.6;
export const AUTO_FEEDER_PORT_OFFSET_FRACTION = 0.5; // fraction of TILE_SIZE — how far above the tile's center the fixed output point sits

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

// Items no longer rest at the world's bottom edge — with nothing built to
// catch it, a coin just keeps falling and is deleted once it's fallen this
// far past WORLD_H, so it reads as "fell off the bottom of the screen"
// rather than popping out of existence at an invisible line. This is what
// makes leaving coins unrouted actually costly instead of a free pile the
// player can click at their leisure — see CLAUDE.md's item-collision note.
export const ITEM_LOST_BELOW_WORLD_MARGIN_PX = TILE_SIZE * 2;
export const ITEM_LOST_COLOR = '#ff9999'; // muted red "Lost!" floating text when a coin falls off the bottom — a coin is worth telling the player about; food/waste vanish silently, same as they already do elsewhere

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
// tier/visibility, not weight). Food is much lighter than a coin on purpose:
// a coin barely notices bumping into a food pellet, while a food pellet
// gets shoved completely out of the way by a coin.
// science: a new physical item type (see "Science as a physical resource"
// below) — 3x a coin's mass per direct request, so it needs real Fan muscle
// to route, same spirit as the existing coin/food/waste hierarchy.
export const ITEM_MASS_BY_TYPE = { food: 0.3, coin: 3, waste: 1, science: 9 };
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
export const FOOD_RADIUS = 6; // px, visual + despawn-on-floor check
export const FOOD_COLOR = '#ffb238'; // orange — was a green (#8bc34a) close enough to WASTE_COLOR's olive-green to be hard to tell apart at a glance; per direct request, distinct now
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
export const FOOD_STATIONARY_TO_WASTE_MS = 20000; // doubled from 10000 per direct request ("make food take twice as long to turn to waste")
export const FOOD_STATIONARY_MOVE_TOLERANCE_PX = 4; // small enough to still catch real movement, large enough to ignore sub-pixel collision-resolution jitter on something genuinely resting
export const COIN_RADIUS = 10; // px, base visual radius (bronze size) — 25% bigger than the original 8, easier to see and aim at
export const COIN_CLICK_RADIUS_MULTIPLIER = 1.9; // click hit-test radius is each coin's own (tier-scaled) radius times this — 90% bigger than the coin itself (was 60%, bumped again per direct request), so a click doesn't have to be pixel-perfect (and doesn't get misread as a food-placement click on a miss). Purely a hit-test radius — the coin's actual drawn/collision size (COIN_RADIUS) is untouched. tryBankCoinAt still only ever banks the first match it finds per click and returns immediately, so an overlapping pair of these bigger radii still can't bank two coins on one click.
export const CHEAT_GRANT_AMOUNT = 10000; // $ granted by the M debug key
export const CHEAT_TANK_POINTS_GRANT_AMOUNT = 20; // Tank Points also granted by the M debug key, so testing the Tank Upgrades panel doesn't require grinding fish growth
export const CHEAT_SCIENCE_GRANT_AMOUNT = 500; // Science Bubbles also granted by the M debug key, so testing the Science Lab's tech tree doesn't require grinding an Octopus's real brew-and-collect cycle

// Coin color + size tier by value — checked in ascending order, first match
// wins. Entities.js's getCoinTier()/getCoinColor() do the lookup; kept here
// as data per §3.6. sizeMultiplier scales COIN_RADIUS for that tier.
export const COIN_TIERS = [
  { maxValue: 5, color: '#cd7f32', sizeMultiplier: 1.0 }, // bronze, 1-5
  { maxValue: 12, color: '#c0c0c0', sizeMultiplier: 1.05 }, // silver, 6-12, 5% bigger
  { maxValue: 30, color: '#ffd700', sizeMultiplier: 1.10 }, // gold, 13-30, 10% bigger
  { maxValue: Infinity, color: '#b9f2ff', sizeMultiplier: 1.15 }, // diamond, 31+, 15% bigger
];

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
export const WASTE_RADIUS = FOOD_RADIUS * 1.1; // per direct request, "10% bigger than food" — replaces the old "25% bigger than the original 5" sizing, now pinned to Food's own radius instead of a standalone number
export const WASTE_DRAG_CLICK_RADIUS_MULTIPLIER = 1.6; // hit-test radius for grabbing a piece of Waste to drag — same "bigger than the drawn size" precedent as COIN_CLICK_RADIUS_MULTIPLIER, so a drag doesn't need to start pixel-perfect
export const WASTE_GRAVITY = GRAVITY; // sinks like a coin, not a drifting food pellet
export const WASTE_MAX_FALL_SPEED = MAX_FALL_SPEED;
export const WASTE_COLOR = '#6b8e4e';
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
export const SCIENCE_ITEM_RADIUS = 8;
export const SCIENCE_ITEM_COLOR_A = '#b98bff'; // purple
export const SCIENCE_ITEM_COLOR_B = '#5fc9ff'; // blue — matches the existing SCIENCE_COLOR used for floating text/HUD accents
// While a Researcher fish (Science Octopus) is mid-cycle toward producing its
// next physical Science bubble, a small "+0.1 🔬" floating text pops above it
// every time it crosses another tenth of its current stage's cycle — pure
// progress feedback, not an actual resource grant (nothing is banked until
// the physical bubble itself is later collected) — per direct request, so a
// full-minute-plus wait doesn't read as "nothing is happening."
export const SCIENCE_PROGRESS_TICKS = 10;

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
  'Looking a little dirty in there champ. The dirtier your tank is, the less often your fish produce money. If only there was a way to clean it......';
// The #hud-cleanliness/#shop-cleanliness readout's text color is a live
// gradient between these two, per direct request — bright blue at 100%
// fading to an olive green at 0%. CLEANLINESS_COLOR_DIRTY is deliberately
// the exact same hex as WASTE_COLOR above — a dirty tank reading the color
// of the Waste causing it is a nice, free bit of visual reinforcement.
// UI.js's cleanlinessColor(pct) does the actual RGB lerp every frame.
export const CLEANLINESS_COLOR_CLEAN = '#4fc3f7';
export const CLEANLINESS_COLOR_DIRTY = '#6b8e4e';

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
// A pellet relieves a flat amount of hunger, looked up by the current Food
// Quality upgrade level (state.level.upgrades.foodQuality, 0-4 — see Tank
// Points & Tank Upgrades below). Index 0 is the un-upgraded baseline; each
// level after that is roughly a 20-25% bump, capping at level 4 (100 — a
// single feed can fully clear even max hunger). Relief is no longer clamped
// to the fish's current hunger — if it exceeds what's left, hunger goes
// negative, an "overfed" state Entities.js leaves alone for now (no bonus
// wired up yet; a future phase can read a negative value as a buff).
export const FOOD_HUNGER_RELIEF_BY_LEVEL = [55, 65, 75, 85, 100, 115]; // index 0 = unupgraded; 6 entries now that Food Quality goes to level 5, see FOOD_QUALITY_UPGRADE_COSTS
// Eating a pellet also advances that fish's coin-drop timer by this fraction
// of its current stage's dropInterval — e.g. a 20s cycle fed at the 10s mark
// (50% of 20s) immediately drops a coin and restarts the 20s cycle. Makes
// feeding feel like it's what produces the coins, not just a side effect of
// waiting. TODO(later phase): restrict this bonus to manually-dropped food
// only, once automated feeders exist, to keep active play worth doing.
export const COIN_TIMER_FEED_BONUS_FRACTION = 0.5;
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

// Food Quality's own 5-level cost ladder — unchanged (was a flat [1,2,3,4]
// 4-level ladder — bumped up and extended a level per direct request that
// upgrades felt too cheap/fast to max out). Placeholder balance, same as
// every other economy constant here — tune once real playtesting exists.
export const FOOD_QUALITY_UPGRADE_COSTS = [2, 5, 15, 30, 50]; // Tank Points
export const FOOD_QUALITY_UPGRADE_MAX_LEVEL = FOOD_QUALITY_UPGRADE_COSTS.length;
export const FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL = 0.10; // 10% slower fall per level (both FOOD_GRAVITY and FOOD_MAX_FALL_SPEED scale down) — doubled from 5%, part of the same slower-pacing pass as FOOD_GRAVITY/FOOD_MAX_FALL_SPEED above; applied live in Entities.js's updateFood
// FOOD_HUNGER_RELIEF_BY_LEVEL above is the other half of Food Quality.

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

// Coin Cap: how many Coin items can exist in state.level.items at once — per
// direct request, now that the Rocky Shelf keeps every coin in the tank
// forever instead of letting an uncaught one eventually fall off the bottom
// and vanish, there needs to be an explicit ceiling instead or a fish's
// passive production could pile up unboundedly. Checked in Entities.js's
// updateFish right before a coin would spawn (effectiveCoinCapacity(state) —
// state.level.upgrades.coinCapLevel indexes straight into COIN_CAP_BY_LEVEL,
// same "array of absolute values, not a base+increment formula" shape as
// FOOD_HUNGER_RELIEF_BY_LEVEL uses, since these steps aren't an even
// arithmetic progression). Upgraded exclusively through a Tank Upgrade (Tank
// Points) — see COIN_CAP_UPGRADE_COSTS, mirroring Food Capacity's own
// leveled-cap pattern exactly, just gating Coins instead of Food and with no
// "only while in open water" carve-out (a coin resting in the seabed city
// still very much counts as an "active drop" the player hasn't banked yet).
export const COIN_CAP_BY_LEVEL = [10, 25, 50, 100, 250, 500]; // index 0 = unupgraded default
export const COIN_CAP_UPGRADE_COSTS = [1, 8, 20, 45, 80]; // Tank Points — level 1 cut from 3 to 1 per direct request, so a player can afford it off their very first-ever Tank Point (see the new Tank Point tutorial flow in UI.js); levels 2+ untouched, placeholder balance like every other economy constant here
export const COIN_CAP_UPGRADE_MAX_LEVEL = COIN_CAP_UPGRADE_COSTS.length;

// Shared by both the Coin Cap and Science Cap HUD readouts (UI.js's
// updateHUD) — the live count/max ratio at or above which the readout
// pulses red continuously, per direct request.
export const CAP_WARNING_THRESHOLD_FRACTION = 0.8;

// Science Cap: the same idea as Coin Cap above, but for Science Bubble items
// and upgraded exclusively through the Science Lab instead of Tank Points —
// per direct request. Priced like every other Lab node (both Science AND
// gold at once). Originally a single leveled card above the branching tree;
// per a later direct request ("change the max science upgrades so each one
// is a separate icon... instead of 5 times on the same icon") it's now 5
// chained one-time nodes INSIDE the tree instead (`science_cap_1..5` below,
// in SCIENCE_LAB_UPGRADES) — these two cost arrays are what those 5 nodes'
// scienceCost/goldCost read from, one index each, so the progression itself
// is unchanged, just its presentation.
export const SCIENCE_CAP_BY_LEVEL = [5, 10, 20, 30, 40, 50]; // index 0 = unupgraded default
export const SCIENCE_CAP_UPGRADE_SCIENCE_COSTS = [10, 20, 35, 60, 100]; // placeholder balance, tune once real playtesting exists
export const SCIENCE_CAP_UPGRADE_GOLD_COSTS = [500, 1500, 3500, 7500, 15000];

// Fish Merging (Economy Fish Combining's drag-to-combine interaction) is a
// Tank Upgrade now, not a Tier unlock — a one-time, unleveled purchase
// (state.level.upgrades.fishMergingUnlocked, false until bought) rather than
// a 0-N ladder like the three above. Entities.js's isCombinableFish checks
// this flag before anything else; dynamic economy-fish pricing itself is
// unaffected (that was never actually tier-gated in code, only in an older
// doc pass — see CLAUDE.md) — only the drag-combine interaction is gated.
export const FISH_MERGING_UNLOCK_COST = 5; // Tank Points, flat, one-time — cut from 10 per direct request

// Defensive Capabilities (click damage/offense vs invading aliens) has no
// system to upgrade yet — Phase 5 aliens don't exist. The Tank Upgrades
// panel still shows this as a fourth card (Phase 2 UI shell scope), just
// locked/non-interactive until then.

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
    // dropInterval (19382), so growing up no longer speeds up production at
    // all, only raises the payout. Coin value cut twice since: first to a
    // flat $7/$10/$13 ("range from 7-13 instead of 8-16"), then down again
    // to $5/$7/$9 per direct request ("too close to the blimpfish in
    // economy") — Guppy is meant to read as the cheap/low-value baseline,
    // clearly below Blimpfish's $12.7/$16.5/$22.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 19382, dropValue: 5 }, // stage 1: hatchling
      { feedsRequired: 3, scale: 0.75, dropInterval: 19382, dropValue: 7 }, // stage 2: juvenile
      { feedsRequired: 6, scale: 1.0, dropInterval: 19382, dropValue: 9 }, // stage 3: adult
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
    // Same "share the adult's own dropInterval, scale only the value ~2x
    // baby-to-adult" treatment as Guppy above — adult dropValue (3) is
    // unchanged, only the per-stage split and the now-flat interval are new.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 9382, dropValue: 1.5 }, // hatchling — half the adult value
      { feedsRequired: 3, scale: 0.75, dropInterval: 9382, dropValue: 2.25 }, // juvenile — three-quarters
      { feedsRequired: 6, scale: 1.0, dropInterval: 9382, dropValue: 3 }, // adult — still the high-frequency coin firehose of the three, just slightly less so
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
    // above — every stage fires at the adult's own 29259ms, that old
    // per-stage speed-up (41852/35802/29259) is gone. Baby dropValue tuned
    // per a direct follow-up ("make it so the starting blimpfish coin value
    // makes it closer to 26 money/min as a baby, and keep the adult the
    // same") — 12.7 lands right at ~$26.04/min (12.7 / 29259 * 60000);
    // adult (22) and juvenile (16.5) are unchanged from the prior pass.
    growthStages: [
      { feedsRequired: 0, scale: 0.6, dropInterval: 29259, dropValue: 12.7 }, // hatchling — ~$26/min
      { feedsRequired: 3, scale: 0.8, dropInterval: 29259, dropValue: 16.5 }, // juvenile
      { feedsRequired: 6, scale: 1.0, dropInterval: 29259, dropValue: 22 }, // adult — unchanged per direct request
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
  // ladder the base feeders use (baby/mid/adult, feedsRequired 0/3/6) instead
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
    description: 'Only eats Waste, never Food — keeps the tank clean.',
    behavior: ['SCAVENGER'], dropType: 'waste_cleared',
    swimSpeed: 30, lifespan: 300000,
    hungerRate: 0.609, // 25% slower again per direct request — was 0.812. Entities.js's updateFish targets Waste items (never Food) for any species carrying the SCAVENGER tag. Deliberately flat across all 3 stages (unlike dropInterval below) — per direct request, a baby eats less OFTEN than an adult but still starves on the same overall clock.
    // dropInterval is repurposed for a Scavenger as its EAT COOLDOWN — the
    // minimum time between two waste-eating events, not a coin-drop timer
    // (dropValue stays 0, unused) — see Entities.js's updateFish SCAVENGER
    // branch. 35s baby/mid, 25s adult, per direct request ("every 35 seconds
    // as a baby but every 25 seconds as an adult").
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 35000, dropValue: 0 },
      { feedsRequired: 3, scale: 0.75, dropInterval: 35000, dropValue: 0 },
      { feedsRequired: 6, scale: 1.0, dropInterval: 25000, dropValue: 0 },
    ],
    unlockedByDefault: false,
  },
  electric_eel: {
    id: 'electric_eel', name: 'Electric Eel', tier: 2, unlockPhase: 3, cost: 35, // cut from 80 per direct request
    description: 'Primary MW supply. Must be fed to keep generating.',
    behavior: ['GENERATOR'], dropType: 'power',
    swimSpeed: 20, lifespan: 300000, hungerRate: 0.582, // 25% slower again per direct request — was 0.776
    // pixelsPerMW replaces the old timer+speed-multiplier scheme for a pure
    // Generator, per direct request ("produces 1MW per 10 pixels swam as a
    // baby, and 1MW per 5 pixels as an adult") — a literal distance-traveled
    // meter instead of an indirect speed ratio, so a faster eel (upgrades,
    // seek-chases) naturally generates faster with no separate multiplier
    // needed. See Entities.js's updateFish GENERATOR branch/fish.distanceAccumPx.
    growthStages: [
      { feedsRequired: 0, scale: 0.5, pixelsPerMW: 10 },
      { feedsRequired: 3, scale: 0.75, pixelsPerMW: 10 },
      { feedsRequired: 6, scale: 1.0, pixelsPerMW: 5 },
    ],
    unlockedByDefault: false,
  },
  octopus: {
    id: 'octopus', name: 'Science Octopus', tier: 3, unlockPhase: 4, cost: 60, // cut from 90 per direct request
    description: 'Slowly brews Science Bubbles — collect them like coins.',
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
      { feedsRequired: 3, scale: 0.75, dropInterval: 70000, dropValue: 1 },
      { feedsRequired: 6, scale: 1.0, dropInterval: 50000, dropValue: 1 },
    ],
    unlockedByDefault: false,
  },

  // ---- Gene-Splicing hybrids (Phase 4 scaffold, data only) ----
  // Each hybrid is Suckerfish/Electric Eel/Science Octopus spliced onto
  // another species — see CLAUDE.md for the 3x3 feeder-combo + C(3,2)
  // utility-combo = 12 combinatorics. `parents: [id, id]` records the two
  // source species for the Phase 4 splicing UI; nothing reads it before
  // then. `behavior` is the union of both parents' tags. Stats below are
  // simple averages of the two parents' stats — a placeholder scaffold to
  // be re-tuned once Phase 3/4 actually implements scavenge/power/science
  // behavior (today every fish, hybrid or not, just drops a plain coin on
  // its dropInterval — dropType is documentation only until then).
  scrub_guppy: {
    id: 'scrub_guppy', name: 'Scrub Guppy', tier: 4, unlockPhase: 4, cost: 45,
    description: 'Suckerfish-spliced Guppy — clears waste on its rounds, still drops coins.',
    behavior: ['SCAVENGER', 'FEEDER'], dropType: 'waste_cleared', parents: ['suckerfish', 'guppy'],
    swimSpeed: 33, lifespan: 300000, hungerRate: 0.864, // 25% slower again per direct request — was 1.152
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 15864, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note: a splice can only happen on an adult fish, and inherits 1.2x that fish's adult coin value. Money production 10% slower again per direct request — was 14278
    unlockedByDefault: false,
  },
  scrub_dartfin: {
    id: 'scrub_dartfin', name: 'Scrub Dartfin', tier: 4, unlockPhase: 4, cost: 37,
    description: 'Suckerfish-spliced Dartfin — fast waste cleanup, frequent small coins.',
    behavior: ['SCAVENGER', 'FEEDER'], dropType: 'waste_cleared', parents: ['suckerfish', 'dartfin'],
    swimSpeed: 48, lifespan: 300000, hungerRate: 0.732, // 25% slower again per direct request — was 0.976
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 10864, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 9778
    unlockedByDefault: false,
  },
  scrub_blimpfish: {
    id: 'scrub_blimpfish', name: 'Scrub Blimpfish', tier: 4, unlockPhase: 4, cost: 85,
    description: 'Suckerfish-spliced Blimpfish — slow but thorough, big coins and a clean tank.',
    behavior: ['SCAVENGER', 'FEEDER'], dropType: 'waste_cleared', parents: ['suckerfish', 'blimpfish'],
    swimSpeed: 24, lifespan: 300000, hungerRate: 1.032, // 25% slower again per direct request — was 1.376
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 20802, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 18722
    unlockedByDefault: false,
  },
  volt_guppy: {
    id: 'volt_guppy', name: 'Volt Guppy', tier: 4, unlockPhase: 4, cost: 100,
    description: 'Electric Eel-spliced Guppy — generates MW alongside its usual coin drops.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'guppy'],
    swimSpeed: 28, lifespan: 300000, hungerRate: 0.9, // 25% slower again per direct request — was 1.2
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 12778, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 11500
    unlockedByDefault: false,
  },
  volt_dartfin: {
    id: 'volt_dartfin', name: 'Volt Dartfin', tier: 4, unlockPhase: 4, cost: 92,
    description: 'Electric Eel-spliced Dartfin — a fast, low-cost trickle of power and coins.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'dartfin'],
    swimSpeed: 43, lifespan: 300000, hungerRate: 0.768, // 25% slower again per direct request — was 1.024
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 7778, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 7000
    unlockedByDefault: false,
  },
  volt_blimpfish: {
    id: 'volt_blimpfish', name: 'Volt Blimpfish', tier: 4, unlockPhase: 4, cost: 140,
    description: 'Electric Eel-spliced Blimpfish — slow, heavy-feeding hybrid with big power output.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'blimpfish'],
    swimSpeed: 19, lifespan: 300000, hungerRate: 1.068, // 25% slower again per direct request — was 1.424
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 17716, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 15944
    unlockedByDefault: false,
  },
  scholar_guppy: {
    id: 'scholar_guppy', name: 'Scholar Guppy', tier: 4, unlockPhase: 4, cost: 110,
    description: 'Science Octopus-spliced Guppy — drops Blue Science alongside coins.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'guppy'],
    swimSpeed: 30, lifespan: 300000, hungerRate: 0.846, // 25% slower again per direct request — was 1.128
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 18951, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 17056
    unlockedByDefault: false,
  },
  scholar_dartfin: {
    id: 'scholar_dartfin', name: 'Scholar Dartfin', tier: 4, unlockPhase: 4, cost: 102,
    description: 'Science Octopus-spliced Dartfin — quick, cheap research on the move.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'dartfin'],
    swimSpeed: 45, lifespan: 300000, hungerRate: 0.708, // 25% slower again per direct request — was 0.944
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 13951, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 12556
    unlockedByDefault: false,
  },
  scholar_blimpfish: {
    id: 'scholar_blimpfish', name: 'Scholar Blimpfish', tier: 4, unlockPhase: 4, cost: 150,
    description: 'Science Octopus-spliced Blimpfish — slow but valuable, big coins and big science.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'blimpfish'],
    swimSpeed: 21, lifespan: 300000, hungerRate: 1.014, // 25% slower again per direct request — was 1.352
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 23889, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note. Money production 10% slower again per direct request — was 21500
    unlockedByDefault: false,
  },
  scrub_eel: {
    id: 'scrub_eel', name: 'Scrub-Eel', tier: 4, unlockPhase: 4, cost: 105,
    description: 'Suckerfish-Eel splice — keeps the tank clean while powering the grid.',
    behavior: ['SCAVENGER', 'GENERATOR'], dropType: 'waste_cleared+power', parents: ['suckerfish', 'electric_eel'],
    swimSpeed: 25, lifespan: 300000, hungerRate: 0.546, // 25% slower again per direct request — was 0.728
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 7500, dropValue: 0 }],
    unlockedByDefault: false,
  },
  scrub_topus: {
    id: 'scrub_topus', name: 'Scrub-Topus', tier: 4, unlockPhase: 4, cost: 115,
    description: 'Suckerfish-Octopus splice — clears waste while trickling Blue Science.',
    behavior: ['SCAVENGER', 'RESEARCHER'], dropType: 'waste_cleared+science_blue', parents: ['suckerfish', 'octopus'],
    swimSpeed: 28, lifespan: 300000, hungerRate: 0.492, // 25% slower again per direct request — was 0.656
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 12500, dropValue: 1 }],
    unlockedByDefault: false,
  },
  volt_topus: {
    id: 'volt_topus', name: 'Volt-Topus', tier: 4, unlockPhase: 4, cost: 170,
    description: 'Eel-Octopus splice — powers the grid and researches at the same time.',
    behavior: ['GENERATOR', 'RESEARCHER'], dropType: 'power+science_blue', parents: ['electric_eel', 'octopus'],
    swimSpeed: 23, lifespan: 300000, hungerRate: 0.528, // 25% slower again per direct request — was 0.704
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 10000, dropValue: 1 }],
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
// request, since removal is now a deliberate Demolish-tool action (see
// UI.js's tool-demolish-btn) rather than an always-available right-click,
// there's no risk of it being used as a free item-conveyor exploit the way
// a partial-refund policy was originally hedging against.
export const TILE_REFUND_FRACTION = 1.0;
// Every building's shop cost is dynamic now, mirroring the Economy Fish
// dynamic-pricing pattern but additive instead of multiplicative — per
// direct request. Platform is a flat $3 regardless of how many are already
// placed. Every other building's live cost is its base
// BUILDING_TYPES cost plus BUILDING_COST_INCREMENT for each tile of that
// exact type already placed on the grid (Grid.js's getBuildingCost, counted
// live off state.level.grid every call, same "no separate counter to keep in
// sync" approach the fish pricing already uses — demolishing one brings the
// next one's cost back down). Tile *removal* still refunds off the tile's
// original placed cost (stored implicitly by BUILDING_TYPES[type].cost at
// demolish time — see Grid.js's removeTile), not today's live price.
export const PLATFORM_FLAT_COST = 3;
export const BUILDING_COST_INCREMENT = 1;
export const BUILDING_TYPES = {
  [TILE_PLATFORM]: {
    id: TILE_PLATFORM, name: 'Platform', icon: '🧱', cost: PLATFORM_FLAT_COST,
    description: 'Solid floor. Items land and rest on top — cheap, optional item routing.',
    color: '#dba36f', unlockedByDefault: true, // available from level start, unchanged — no longer load-bearing for whether anything ELSE can be placed, though (see canPlaceTile's own comment)
  },
  [TILE_COLLECTOR]: {
    id: TILE_COLLECTOR, name: 'Processor', icon: '🧲', cost: 12,
    description: 'Auto-banks coins and Science pulled into its intake. Unpowered — leaves Waste behind.',
    color: '#8fe0b8', unlockedByDefault: false,
  },
  [TILE_COLLECTOR_ELECTRIC]: {
    id: TILE_COLLECTOR_ELECTRIC, name: 'Electric Processor', icon: '🧲', cost: 60,
    description: 'Faster than the base Processor, less Waste. Draws power while holding an item.',
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_COLLECTOR_ADVANCED]: {
    id: TILE_COLLECTOR_ADVANCED, name: 'Advanced Processor', icon: '🧲', cost: 150,
    description: 'The fastest Processor money can buy.',
    color: '#c9a8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T2]: {
    id: TILE_FAN_T2, name: 'Rudimentary Fan', icon: '🌀', cost: 15,
    description: `Blows a cone of force wherever you aim it. Free, but short reach (${FAN_T2_MAX_RANGE}px) and weak — struggles to lift a coin.`,
    color: '#9fd8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T3]: {
    id: TILE_FAN_T3, name: 'Electric Fan', icon: '💨', cost: 45,
    description: `Draws power for medium reach (${FAN_T3_MAX_RANGE}px) — enough to route most coins.`,
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T4]: {
    id: TILE_FAN_T4, name: 'Turbo Fan', icon: '🌪️', cost: 120,
    description: `Longest reach (${FAN_T4_MAX_RANGE}px), gentle enough to suspend a coin mid-air. Draws power.`,
    color: '#2f7fd6', unlockedByDefault: false,
  },
  [TILE_AUTO_FEEDER]: {
    id: TILE_AUTO_FEEDER, name: 'Auto-Feeder', icon: '♻️', cost: 35,
    description: 'Absorbs Waste on one side, dispenses Food on the other. Aim it like a Fan.',
    color: '#c9e88f', unlockedByDefault: false,
  },
  [TILE_AUTO_FEEDER_ELECTRIC]: {
    id: TILE_AUTO_FEEDER_ELECTRIC, name: 'Electric Auto-Feeder', icon: '♻️', cost: 90,
    description: 'Processes Waste faster than the base Auto-Feeder. Draws power while working.',
    color: '#4fd6e0', unlockedByDefault: false, // was #7fd6a8 — too close to the base Processor's own #8fe0b8 (both light minty greens), per direct report; this is a distinct cyan/teal instead
  },
  [TILE_AUTO_FEEDER_ADVANCED]: {
    id: TILE_AUTO_FEEDER_ADVANCED, name: 'Advanced Auto-Feeder', icon: '♻️', cost: 200,
    description: 'The fastest Auto-Feeder — least Waste per Food.',
    color: '#ffd76f', unlockedByDefault: false,
  },
  [TILE_TURRET_WASTE]: {
    id: TILE_TURRET_WASTE, name: 'Waste Turret', icon: '🔫', cost: 25,
    description: 'Auto-fires on the nearest alien. Feeds itself from any Waste touching it.',
    color: '#9c8a6b', unlockedByDefault: true, // free from the start, alongside Platform — the only defense before the Science Lab exists
  },
  [TILE_TURRET_ELECTRIC]: {
    id: TILE_TURRET_ELECTRIC, name: 'Electric Turret', icon: '🔫', cost: 55,
    description: 'Faster and harder-hitting than the Waste Turret, unlimited ammo. Draws power per shot.',
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_TURRET_ADVANCED]: {
    id: TILE_TURRET_ADVANCED, name: 'Advanced Turret', icon: '🔫', cost: 130,
    description: 'The strongest turret — fastest, hardest-hitting.',
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
  auto_feeder: [TILE_AUTO_FEEDER, TILE_AUTO_FEEDER_ELECTRIC, TILE_AUTO_FEEDER_ADVANCED],
  turret: [TILE_TURRET_WASTE, TILE_TURRET_ELECTRIC, TILE_TURRET_ADVANCED],
};

// ---- Processor (Collector) tiers & Auto-Feeder tiers ----
// Per direct request, both buildings now have 3 tiers with real distinct
// timing/power numbers instead of one flat behavior — Grid.js's
// updateBuildings/beginCollectorProcessing read these by the placed tile's
// own type. coinMs/scienceMs are how long a single held coin/Science item
// takes to fully process (replaces the old flat COLLECTOR_PROCESS_DURATION_MS
// — a coin and a Science bubble now take different amounts of time on the
// same tile). wasteEveryMs is a separate, continuously-running background
// clock: every wasteEveryMs of TOTAL time this tile has spent actively
// holding an item (any item, running the whole time it's non-idle, not reset
// between individual items), it spawns one Waste at the tile's center — see
// Grid.js's updateBuildings. powerCostPerSec is drawn only while the tile is
// actively processing something (Collector) or actively processing an
// absorbed Waste load (Auto-Feeder) — not while idle/empty, and not gated on
// actual power availability, same not-yet-power-gated precedent every other
// Electric building in this codebase already follows.
export const PROCESSOR_STATS = {
  [TILE_COLLECTOR]: { coinMs: 6000, scienceMs: 20000, wasteEveryMs: 10000, powerCostPerSec: 0 },
  [TILE_COLLECTOR_ELECTRIC]: { coinMs: 4000, scienceMs: 15000, wasteEveryMs: 12000, powerCostPerSec: 10 },
  [TILE_COLLECTOR_ADVANCED]: { coinMs: 3000, scienceMs: 9000, wasteEveryMs: 15000, powerCostPerSec: 20 },
};
// wasteProcessMs is how long ONE absorbed Waste item takes to finish
// processing before the next can be absorbed; wasteRequired is how many
// completed absorptions are needed before a Food item is finally dispensed —
// Grid.js's updateBuildings lights one of `wasteRequired` dots (per direct
// request) each time a load finishes, resetting once Food dispenses.
// powerCostPerSec is drawn only while actively processing an absorbed load,
// not while idle waiting for the next one.
export const AUTO_FEEDER_STATS = {
  [TILE_AUTO_FEEDER]: { wasteProcessMs: 20000, wasteRequired: 3, powerCostPerSec: 0 },
  [TILE_AUTO_FEEDER_ELECTRIC]: { wasteProcessMs: 12000, wasteRequired: 3, powerCostPerSec: 5 },
  [TILE_AUTO_FEEDER_ADVANCED]: { wasteProcessMs: 10000, wasteRequired: 2, powerCostPerSec: 10 },
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
export const TURRET_STATS = {
  [TILE_TURRET_WASTE]: { shotsPerSec: 1.5, damage: 4, powerCostPerSec: 0 },
  [TILE_TURRET_ELECTRIC]: { shotsPerSec: 2, damage: 6, powerCostPerSec: 4 },
  [TILE_TURRET_ADVANCED]: { shotsPerSec: 3, damage: 8, powerCostPerSec: 9 },
};
// Waste Turret ammo — per direct request: "each waste gives it 10 shots and
// it can hold 5 waste (with dots indicating each waste/10 ammo)." Consumes a
// touching Waste item exactly like an Auto-Feeder absorbs one (Grid.js's
// updateBuildings), converting it straight to ammo rather than holding it
// for a timed process — there's no "processing duration" for a turret's own
// intake, only the fire-rate cooldown on the OUTPUT side.
export const WASTE_TURRET_SHOTS_PER_WASTE = 10;
export const WASTE_TURRET_MAX_WASTE = 5; // -> 50 max stored shots
export const WASTE_TURRET_MAX_AMMO = WASTE_TURRET_SHOTS_PER_WASTE * WASTE_TURRET_MAX_WASTE;
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
export const MOUND_TEASE_COST = 150; // unchanged — the tease is still a Tier 1 no-op regardless of how many tiers exist above it
// "Tier 1.75" — a paid step between the tease and the real Tier 1->2 crack:
// $500, grants ONLY the Rudimentary Fan, still without advancing
// state.level.tier. Tracked by state.level.fanUnlockPurchased (Levels.js),
// checked the same way moundTeased already is — see Mound.js's
// getMoundNextCost/crackMound.
export const FAN_UNLOCK_COST = 500;
// "Tier 2.5" — the same kind of paid sub-step, but sitting between the real
// Tier 1->2 and Tier 2->3 cracks instead: $2500 (was $5000 in an earlier
// pass, cut per direct request), grants ONLY the Auto-Feeder, still without
// advancing state.level.tier past 2. Tracked by
// state.level.autoFeederUnlockPurchased (Levels.js).
export const AUTO_FEEDER_UNLOCK_COST = 2500;
export const MOUND_CRACK_COST = { 1: 1000, 2: 5000 }; // 1: Tier 1->2 (Processor + Octopus); 2: Tier 2->3 (shatters into the Science Lab, grants nothing directly)
export const MOUND_WIDTH_TILES = 4.4; // how many seabed tiles wide its clickable footprint is — 10% bigger than the original 4
export const MOUND_HEIGHT_PX = 62; // how far it mounds up above the seabed surface — 10% bigger than the original 56
// Platform itself is NOT tier-gated at all — see BUILDING_TYPES'
// unlockedByDefault above — per direct request it's available from level
// start rather than waiting on any crack (unrelated to whether anything
// else needs to anchor to it — see canPlaceTile's own comment). The
// Rudimentary Fan isn't granted by a
// TIER_UNLOCKS entry at all — it's granted by the Mound's paid "Tier 1.75"
// step (FAN_UNLOCK_COST, $500); the Auto-Feeder likewise isn't granted here
// — it's the paid "Tier 2.5" step (AUTO_FEEDER_UNLOCK_COST, $2500). Both
// are separate steps after their respective real crack, still without
// advancing state.level.tier — see Mound.js's getMoundNextCost/crackMound.
export const TIER_UNLOCKS = {
  2: {
    species: ['octopus'], // per direct request — Octopus moved off the Science Lab (it's the one utility species that doesn't gate anything ELSE in the Lab's tree) onto the Mound itself, so the Lab's tree starts truly empty and every one of its 8 nodes is a real choice
    buildings: [TILE_COLLECTOR], // Auto-Feeder is its own separate "Tier 2.5" paid step, not part of this crack — see AUTO_FEEDER_UNLOCK_COST above
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
// disabled buttons, so the shape of the tree is visible at a glance. The
// Electric Auto-Feeder deliberately requires BOTH `eel` and `suckerfish` —
// per direct request ("make sure the two branch together so it's obviously
// that both the eel and suckerfish are requirements") — so its node has two
// incoming connector lines, one from each parent, instead of a single
// linear chain. `grants` is the same { species, buildings } shape
// TIER_UNLOCKS entries use (plus a newer `scienceCapLevel` field the
// `science_cap_*` chain below uses — see its own comment) — UI.js's
// buyLabUpgrade pushes each into state.meta/state.level the same way
// Mound.js's crackMound already does for species/buildings.
export const SCIENCE_LAB_UPGRADES = {
  // Per direct request, Eel/Suckerfish are no longer tree roots — both now
  // require Bubble Cap 10 (science_cap_1, declared further down this same
  // object) first. labNodeDepth (UI.js) computes column placement purely
  // from `requires` depth, so this alone re-lays the tree with the capacity
  // chain now feeding INTO the two utility species rather than sitting
  // beside them as an unrelated branch.
  eel: {
    id: 'eel', name: 'Electric Eel', icon: '🐍', scienceCost: 10, goldCost: 1000,
    requires: ['science_cap_1'], grants: { species: ['electric_eel'] },
  },
  suckerfish: {
    id: 'suckerfish', name: 'Suckerfish', icon: '🐠', scienceCost: 15, goldCost: 1000,
    requires: ['science_cap_1'], grants: { species: ['suckerfish'] },
  },
  electric_fan: {
    id: 'electric_fan', name: 'Electric Fan', icon: '💨', scienceCost: 20, goldCost: 2500,
    requires: ['eel'], grants: { buildings: [TILE_FAN_T3] },
  },
  electric_collector: {
    id: 'electric_collector', name: 'Electric Processor', icon: '🧲', scienceCost: 50, goldCost: 5000,
    requires: ['eel'], grants: { buildings: [TILE_COLLECTOR_ELECTRIC] },
  },
  electric_auto_feeder: {
    id: 'electric_auto_feeder', name: 'Electric Auto-Feeder', icon: '♻️', scienceCost: 30, goldCost: 5000,
    requires: ['eel', 'suckerfish'], grants: { buildings: [TILE_AUTO_FEEDER_ELECTRIC] },
  },
  advanced_fan: {
    id: 'advanced_fan', name: 'Advanced Fan', icon: '🌪️', scienceCost: 100, goldCost: 15000,
    requires: ['electric_fan'], grants: { buildings: [TILE_FAN_T4] },
  },
  advanced_collector: {
    id: 'advanced_collector', name: 'Advanced Processor', icon: '🧲', scienceCost: 250, goldCost: 25000,
    requires: ['electric_collector'], grants: { buildings: [TILE_COLLECTOR_ADVANCED] },
  },
  advanced_auto_feeder: {
    id: 'advanced_auto_feeder', name: 'Advanced Auto-Feeder', icon: '♻️', scienceCost: 150, goldCost: 15000,
    requires: ['electric_auto_feeder'], grants: { buildings: [TILE_AUTO_FEEDER_ADVANCED] },
  },
  // The Waste Turret needs no node at all — it's unlockedByDefault: true,
  // same as Platform (see BUILDING_TYPES), free from the very start.
  electric_turret: {
    id: 'electric_turret', name: 'Electric Turret', icon: '🔫', scienceCost: 25, goldCost: 3000,
    requires: ['eel'], grants: { buildings: [TILE_TURRET_ELECTRIC] },
  },
  advanced_turret: {
    id: 'advanced_turret', name: 'Advanced Turret', icon: '🔫', scienceCost: 120, goldCost: 18000,
    requires: ['electric_turret'], grants: { buildings: [TILE_TURRET_ADVANCED] },
  },

  // ---- Gene-Splicing hybrid tree ----
  // Splicing used to be a single flat Tank Upgrade purchase that unlocked
  // every hybrid species at once (GENE_SPLICING_TANK_POINT_COST, now
  // retired); per direct request it's this whole sub-tree instead.
  // `gene_splicing` is the root — costs Science/gold like every other node
  // but grants nothing on its own, purely a prerequisite gate ("the first
  // upgrade is just a pre-requisite to unlocking each hybrid fish") —
  // requires `eel` AND `suckerfish` already purchased, which transitively
  // gates every hybrid purchase behind both utility species ("make the
  // purchase of the suckerfish and eel as requirements for all the hybrid
  // purchases") without repeating that pair on all 12 leaf nodes below: once
  // gene_splicing is bought, eel/suckerfish are guaranteed already owned, so
  // nothing further down the tree needs to re-check them. The 3 "track"
  // nodes beneath it (one per hybrid combination type, grouped the same way
  // their species ids already are — `scrub_*` = Suckerfish-parented,
  // `volt_*` = Electric Eel-parented, `scholar_*` = Octopus-parented) also
  // grant nothing by themselves, just gate access to their own individual
  // hybrid nodes ("each locked behind an upgrade... that doesn't unlock
  // anything by itself, just gives access to those hybrid tracks"). Every
  // individual hybrid node costs a flat 25 Science / $5000 and grants
  // exactly its one species into speciesUnlocked, mirroring `eel`/
  // `suckerfish` above — Entities.js's canSpliceFish checks that array
  // directly for the specific resulting hybrid id, not a blanket flag.
  // Also requires Bubble Cap 20 (science_cap_2) now, per direct request —
  // stacks on top of the existing eel/suckerfish requirement rather than
  // replacing it.
  gene_splicing: {
    id: 'gene_splicing', name: 'Gene-Splicing', icon: '🧬', scienceCost: 10, goldCost: 1000,
    requires: ['eel', 'suckerfish', 'science_cap_2'], grants: {},
  },
  suckerfish_hybrids: {
    id: 'suckerfish_hybrids', name: 'Suckerfish Hybrids', icon: '🧹', scienceCost: 10, goldCost: 1000,
    requires: ['gene_splicing'], grants: {},
  },
  electric_hybrids: {
    id: 'electric_hybrids', name: 'Electric Hybrids', icon: '🔌', scienceCost: 10, goldCost: 1000,
    requires: ['gene_splicing'], grants: {},
  },
  // No longer gated behind Bubble Capacity — per direct request, only
  // Eel/Suckerfish (science_cap_1) and Gene-Splicing (science_cap_2, see
  // above) require a Bubble Cap purchase; Science Hybrids just needs
  // Gene-Splicing itself, same as its Suckerfish/Electric sibling tracks.
  science_hybrids: {
    id: 'science_hybrids', name: 'Science Hybrids', icon: '🎓', scienceCost: 10, goldCost: 1000,
    requires: ['gene_splicing'], grants: {},
  },
  scrub_guppy: {
    id: 'scrub_guppy', name: 'Scrub Guppy', icon: '🧹', scienceCost: 25, goldCost: 5000,
    requires: ['suckerfish_hybrids'], grants: { species: ['scrub_guppy'] },
  },
  scrub_dartfin: {
    id: 'scrub_dartfin', name: 'Scrub Dartfin', icon: '🧹', scienceCost: 25, goldCost: 5000,
    requires: ['suckerfish_hybrids'], grants: { species: ['scrub_dartfin'] },
  },
  scrub_blimpfish: {
    id: 'scrub_blimpfish', name: 'Scrub Blimpfish', icon: '🧹', scienceCost: 25, goldCost: 5000,
    requires: ['suckerfish_hybrids'], grants: { species: ['scrub_blimpfish'] },
  },
  scrub_eel: {
    id: 'scrub_eel', name: 'Scrub-Eel', icon: '🧹', scienceCost: 25, goldCost: 5000,
    requires: ['suckerfish_hybrids'], grants: { species: ['scrub_eel'] },
  },
  scrub_topus: {
    id: 'scrub_topus', name: 'Scrub-Topus', icon: '🧹', scienceCost: 25, goldCost: 5000,
    requires: ['suckerfish_hybrids'], grants: { species: ['scrub_topus'] },
  },
  volt_guppy: {
    id: 'volt_guppy', name: 'Volt Guppy', icon: '🔌', scienceCost: 25, goldCost: 5000,
    requires: ['electric_hybrids'], grants: { species: ['volt_guppy'] },
  },
  volt_dartfin: {
    id: 'volt_dartfin', name: 'Volt Dartfin', icon: '🔌', scienceCost: 25, goldCost: 5000,
    requires: ['electric_hybrids'], grants: { species: ['volt_dartfin'] },
  },
  volt_blimpfish: {
    id: 'volt_blimpfish', name: 'Volt Blimpfish', icon: '🔌', scienceCost: 25, goldCost: 5000,
    requires: ['electric_hybrids'], grants: { species: ['volt_blimpfish'] },
  },
  volt_topus: {
    id: 'volt_topus', name: 'Volt-Topus', icon: '🔌', scienceCost: 25, goldCost: 5000,
    requires: ['electric_hybrids'], grants: { species: ['volt_topus'] },
  },
  scholar_guppy: {
    id: 'scholar_guppy', name: 'Scholar Guppy', icon: '🎓', scienceCost: 25, goldCost: 5000,
    requires: ['science_hybrids'], grants: { species: ['scholar_guppy'] },
  },
  scholar_dartfin: {
    id: 'scholar_dartfin', name: 'Scholar Dartfin', icon: '🎓', scienceCost: 25, goldCost: 5000,
    requires: ['science_hybrids'], grants: { species: ['scholar_dartfin'] },
  },
  scholar_blimpfish: {
    id: 'scholar_blimpfish', name: 'Scholar Blimpfish', icon: '🎓', scienceCost: 25, goldCost: 5000,
    requires: ['science_hybrids'], grants: { species: ['scholar_blimpfish'] },
  },

  // ---- Bubble (Science) Capacity chain ----
  // Per direct request ("change the max science upgrades so each one is a
  // separate icon to upgrade along the science lab upgrade path, instead of
  // 5 times on the same icon") — replaces the old standalone leveled Bubble
  // Capacity card with 5 chained one-time nodes, each requiring the previous
  // and raising state.level.upgrades.scienceCapLevel by 1 via this new
  // `grants.scienceCapLevel` field (UI.js's buyLabUpgrade applies it the
  // same way it already applies grants.species/grants.buildings). Costs
  // read straight from SCIENCE_CAP_UPGRADE_SCIENCE_COSTS/_GOLD_COSTS above —
  // the exact same 5-level progression, just expressed as 5 nodes instead of
  // one button pressed 5 times.
  science_cap_1: {
    id: 'science_cap_1', name: 'Bubble Cap 10', icon: '🫧',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[0], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[0],
    requires: [], grants: { scienceCapLevel: 1 },
  },
  science_cap_2: {
    id: 'science_cap_2', name: 'Bubble Cap 20', icon: '🫧',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[1], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[1],
    requires: ['science_cap_1'], grants: { scienceCapLevel: 1 },
  },
  science_cap_3: {
    id: 'science_cap_3', name: 'Bubble Cap 30', icon: '🫧',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[2], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[2],
    requires: ['science_cap_2'], grants: { scienceCapLevel: 1 },
  },
  science_cap_4: {
    id: 'science_cap_4', name: 'Bubble Cap 40', icon: '🫧',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[3], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[3],
    requires: ['science_cap_3'], grants: { scienceCapLevel: 1 },
  },
  science_cap_5: {
    id: 'science_cap_5', name: 'Bubble Cap 50', icon: '🫧',
    scienceCost: SCIENCE_CAP_UPGRADE_SCIENCE_COSTS[4], goldCost: SCIENCE_CAP_UPGRADE_GOLD_COSTS[4],
    requires: ['science_cap_4'], grants: { scienceCapLevel: 1 },
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

// The root node of the Gene-Splicing hybrid tree (see SCIENCE_LAB_UPGRADES
// above) — Entities.js's isSpliceSource checks
// state.meta.labUpgradesPurchased.includes(GENE_SPLICING_LAB_ID) as its
// coarse "has splicing been unlocked AT ALL" gate before a utility fish can
// even be picked up for a drag; canSpliceFish then checks the SPECIFIC
// resulting hybrid's own species-unlock status for the fine-grained gate.
// Replaces the old GENE_SPLICING_TECH_ID/state.meta.techUnlocked flag now
// that splicing is a Science Lab purchase, not a standalone Tank Upgrade.
export const GENE_SPLICING_LAB_ID = 'gene_splicing';

export const SCIENCE_COLOR = '#5fc9ff';
export const POWER_COLOR = '#ffd23f';
// A muted blue-grey "🫧" floating bubble-pop, planted above a fish's head the
// instant a blocked-by-cap SCIENCE brew completes — per direct request, a
// "full-belly" visual cue that production was blocked rather than the item
// just silently not appearing. Deliberately desaturated/muted compared to
// every other floating text color in this game (all of which signal a
// genuine gain) so it reads as "nothing happened" at a glance, not another
// reward. The equivalent blocked-COIN cue no longer uses this at all — see
// COIN_BLOCKED_EFFECT_DURATION_MS below.
export const PRODUCTION_BLOCKED_COLOR = '#9fb0c2';
// A blocked COIN drop gets its own dedicated "coin on fire, disintegrating"
// effect instead of the plain bubble above — per direct request ("instead
// of the bubble icon that shows up when the fish can't spawn coins, make it
// look like a coin on fire that disintegrates"). Entities.js's
// triggerProductionBlocked pushes a { x, y, age } record into
// state.level.coinBlockedEffects; this is how long it lives before aging
// out, same "detached particle, independent of the fish" pattern
// ALIEN_DEATH_EFFECT_DURATION_MS already established.
export const COIN_BLOCKED_EFFECT_DURATION_MS = 800;
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
// own EXACT speciesId, so a Scrub Guppy (id 'scrub_guppy') was never going
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
export const FISH_STAR_TIER_VALUE_MULTIPLIER = 1.8; // was 1.5, raised per direct request
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
// same spirit as COIN_CLICK_RADIUS_MULTIPLIER above.
export const FISH_DRAG_HIT_RADIUS_FRACTION = 0.6;

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
export const ALIEN_TUTORIAL_DELAY_MS = 10000; // 10s of state.level.elapsed after the first alien is ever killed (Entities.js's updateAlien sets state.level.firstAlienKilledAtMs) before the post-alien "arm up" guided tutorial starts — see Systems.js's updateStoryTriggers
export const ALIEN_INTRO_DELAY_MS = 1000; // per direct request, the cinematic first-alien intro no longer triggers the instant the alien spawns — it has to actually be alive and visibly moving on screen for this long first (Entities.js's updateAlienPortals records when it appeared; Systems.js's updateStoryTriggers checks this delay before starting the 'alienintro' guided-tutorial flow)
export const ALIEN_FOOD_BLOCK_DURATION_MS = 1000; // per direct request ("so you don't accidentally place 4 food after killing a fish") — Food can't be placed within a just-killed alien's old click radius for this long; see Entities.js's trySpawnFood/isInAlienFoodBlockZone
export const WASTE_DRAG_TUTORIAL_WAIT_MS = 1000; // per direct request — if the player already placed a Waste Turret before the post-alien tutorial would fire, it waits this long after Waste first appears in the city before teaching just the "drag Waste into it" step — see Systems.js's updatePostAlienTutorial
export const WASTE_DRAG_GHOST_CYCLE_MS = 1400; // one full waste->turret sweep of the "drag me here" ghost animation shown during that tutorial step — see main.js's render()
export const POST_ALIEN_TUTORIAL_MESSAGE = "Now that's I'm talking about. A little firepower never hurt no one."; // per direct request's exact wording — posted once the player finishes placing the guided Waste Turret
// ---- Alien Invasion (Aliens.js) ----
// A "wave" is one spawn burst — a handful of aliens emerging from portals at
// once, after which the timer restarts for the next one. Difficulty scales
// with how many waves have already spawned THIS level
// (state.level.alienWavesSpawned, level-scoped like Tier/money — resets on
// restart): count and HP both ramp linearly from their EARLY values up to
// their LATE ones across ALIEN_WAVE_DIFFICULTY_RAMP_WAVES waves, then hold
// steady — per direct request ("start with 20-30 health with only a couple
// spawning, and eventually have 10-15 spawn with 60-100 health").
export const ALIEN_WAVE_INTERVAL_MIN_MS = 180000; // 3 minutes
export const ALIEN_WAVE_INTERVAL_MAX_MS = 300000; // 5 minutes
export const ALIEN_WAVE_DIFFICULTY_RAMP_WAVES = 10;
export const ALIEN_WAVE_COUNT_EARLY_MIN = 2;
export const ALIEN_WAVE_COUNT_EARLY_MAX = 3;
export const ALIEN_WAVE_COUNT_LATE_MIN = 10;
export const ALIEN_WAVE_COUNT_LATE_MAX = 15;
export const ALIEN_HP_EARLY_MIN = 20;
export const ALIEN_HP_EARLY_MAX = 30;
export const ALIEN_HP_LATE_MIN = 60;
export const ALIEN_HP_LATE_MAX = 100;
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
export const ALIEN_WARNING_MESSAGE_1 = "Something's stirring out past the reef... probably nothing.";
export const ALIEN_WARNING_MESSAGE_2 = "Uh oh, I'm reading movement out there. Get your turrets ready.";
export const ALIEN_FIRST_WAVE_TIP_MESSAGE = "Aliens incoming! Click 'em for 1 damage a pop, or let a turret handle it. While they're alive they'll poop waste and scare nearby fish off their coins, so don't dawdle.";

// AI — deliberately not a strict chase/flee, per direct request ("both the
// aliens and the fish are gonna be kinda dumb at being predator/prey, so
// don't make them strictly move towards the target fish or away from the
// alien"). Each time an alien/fish picks a new wander target (its existing
// WANDER_INTERVAL_* cadence for fish, ALIEN_WANDER_INTERVAL_* below for
// aliens), a fresh coin flip against these chances decides whether that
// particular wander happens to bias toward the nearest threat/prey (alien)
// or away from it (fish) instead of a plain random direction — never a
// hard-locked pursuit/retreat.
export const ALIEN_CHASE_CHANCE = 0.5;
export const ALIEN_FLEE_CHANCE = 0.65;
export const ALIEN_AWARENESS_RADIUS = 260; // px — how close a fish/alien has to be to the other before either reacts to it at all
export const ALIEN_SPEED = 40; // px/sec, base wander/chase speed
export const ALIEN_WANDER_INTERVAL_MIN_S = 1;
export const ALIEN_WANDER_INTERVAL_MAX_S = 2.5;

export const ALIEN_CLICK_DAMAGE = 1; // per direct request — "clicking on them for 1 damage each"
// Same "hit-test radius bigger than the drawn radius" pattern as
// COIN_CLICK_RADIUS_MULTIPLIER — per direct request ("the clickable area
// for the aliens is 50% larger than the actual visual radius... so they are
// easier to click"). Purely a hit-test change; ALIEN_RADIUS (the drawn/
// collision size) is untouched.
export const ALIEN_CLICK_RADIUS_MULTIPLIER = 1.5;
export const ALIEN_POOP_INTERVAL_MS = 4000; // was 2000 — doubled again per direct request, further softening the population cap's own worst-case waste-production rate (see ALIEN_MAX_ALIVE's comment)
export const ALIEN_INCOME_BLOCK_RADIUS = 90; // px — a fish this close to a LIVING alien produces no coin on its drop timer at all, see Entities.js's updateFish
export const ALIEN_RADIUS = 16; // px, base visual/hit-test size
export const ALIEN_COLOR = '#5a2d6b'; // dark purple, visually distinct from every fish color
export const ALIEN_HEALTH_BAR_WIDTH = 30;
export const ALIEN_HEALTH_BAR_HEIGHT = 4;

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
