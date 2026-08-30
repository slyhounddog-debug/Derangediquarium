// ============================================================
// Derangiquarium — Config.js
// All balance numbers and world constants live here (§3.6 of the
// build spec). No magic numbers in system files — Engine/Entities/
// Grid/Systems/UI all import what they need from this file.
// ============================================================

// ---- World & coordinate constants (§3.3) ----
export const TILE_SIZE = 32; // px per tile — every coordinate transform is built on this
export const WORLD_TILES_W = 160; // world width in tiles
export const WORLD_TILES_H = 45; // world height in tiles
export const WORLD_W = WORLD_TILES_W * TILE_SIZE; // 5120px
export const WORLD_H = WORLD_TILES_H * TILE_SIZE; // 1440px

export const SEABED_ROW_START = 27; // first seabed tile row; rows 0-26 are water column
export const SEABED_ROW_END = WORLD_TILES_H - 1; // last seabed tile row (44)
export const SEABED_FLOOR_Y = SEABED_ROW_START * TILE_SIZE; // world-y of the water/seabed boundary — Phase 1 renders this as a flat floor, Phase 2 replaces it with real tiles, but everything reads this one constant

// ---- Seabed grid tile types (Phase 2) ----
// state.level.grid is a full WORLD_TILES_H x WORLD_TILES_W array of these
// ids (rows 0-26 exist but are never placed into — only SEABED_ROW_START.. are
// reachable from build mode). Absolute indexing (not seabed-relative) keeps
// every row/col calc a single division by TILE_SIZE, no offset to remember.
export const TILE_EMPTY = 'empty'; // passable — items fall straight through
export const TILE_PLATFORM = 'platform'; // solid — items land and rest on top. The structural anchor: every other building must be placed adjacent to a Platform (or directly on the world's bottom row) — see BUILDING_TYPES' anchoring rule and Grid.js's canPlaceTile.
export const TILE_RAMP_LEFT = 'ramp_left'; // solid — items land then slide down-left
export const TILE_RAMP_RIGHT = 'ramp_right'; // solid — items land then slide down-right
export const TILE_COLLECTOR = 'collector'; // solid — items landing here are immediately consumed (coins auto-banked)
export const TILE_FAN_T2 = 'fan_t2'; // solid — Rudimentary Fan (Tier 2, free, short reach/low force)
export const TILE_FAN_T3 = 'fan_t3'; // solid — Electric Fan (Tier 3, draws power, medium reach/force)
export const TILE_FAN_T4 = 'fan_t4'; // solid — Turbo Fan (Tier 4, draws power, long reach/extreme force)
export const TILE_AUTO_FEEDER = 'auto_feeder'; // solid — absorbs Waste pushed into its intake side, dispenses Food from the opposite side

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
// Food doesn't sway continuously — it mostly falls straight, with a handful
// of distinct sway bursts scattered across the drop (count and each burst's
// period are randomized per pellet so it reads as organic, not mechanical).
export const FOOD_WAVE_SPEED = 31; // px/sec, peak sideways speed during an active sway burst — drifts the pellet roughly ±15-25px off a straight line per burst (varies with that burst's period)
export const FOOD_WAVE_COUNT_MIN = 2; // fewest sway bursts over a full fall
export const FOOD_WAVE_COUNT_MAX = 4; // most sway bursts over a full fall
export const FOOD_WAVE_PERIOD_MIN_S = 3; // shortest a single sway burst (one full left-right-left cycle) can last
export const FOOD_WAVE_PERIOD_MAX_S = 5; // longest a single sway burst can last

// ---- Seabed grid item physics (Phase 2) ----
// Once an item's y crosses SEABED_FLOOR_Y, Grid.js takes over its motion
// from Entities.js's plain gravity (see Grid.js's stepItemOnGrid). Falling
// still uses the item's own GRAVITY/MAX_FALL_SPEED or FOOD_GRAVITY/
// FOOD_MAX_FALL_SPEED — these three below are the tile-interaction speeds.
export const GRID_SWEEP_SUBSTEP = TILE_SIZE / 4; // px — every swept move is walked in steps this small, so a fast-falling item can never skip clean over a landing tile in one step, at any of the fall speeds above
// A Ramp is a pass-through nudge, not a surface an item rests or slides on —
// it doesn't arrest vertical motion at all (an earlier version had items
// "land" on a ramp and ride a fixed-speed 45-degree slope down it, which
// read as a sticky conveyor belt rather than something that just deflects
// what's already moving through it). Instead: an item's vy is left
// completely alone — falling through keeps falling, rising through (e.g. off
// a Fan's push) keeps rising — and crossing into a Ramp tile's row applies a
// single one-tile-width horizontal shift in that ramp's direction, exactly
// once per row (RAMP_NUDGE_DISTANCE, tracked via item.rampNudgedRow so it
// doesn't re-trigger every tick while still passing through the same row).
export const RAMP_NUDGE_DISTANCE = TILE_SIZE;
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
export const FAN_CONE_HALF_ANGLE_DEG = 20; // total cone width = 2x this = 40° (was 15/30° — widened slightly per direct request)
// Placeholder balance per tier, same as every other economy/physics constant
// in this file — tune once real playtesting exists. Power cost is only
// tracked into state.level.powerDemand for now (Systems.js's real power
// grid/supply is Phase 3 scope, not yet implemented — see its module
// header), so an Electric/Turbo Fan still runs unconditionally today, same
// as every other not-yet-power-gated Electric building in the codebase.
export const FAN_T2_MAX_FORCE = 260; // Rudimentary Fan — force magnitude at the emitter (see Grid.js's a = F/mass integration)
export const FAN_T2_MAX_RANGE = 224; // px — 7 tiles (was 3, then 5, then 6; +1 more tile per direct request, the 5th such increase this session)
export const FAN_T2_POWER_COST = 0;
export const FAN_T3_MAX_FORCE = 520; // Electric Fan
export const FAN_T3_MAX_RANGE = 336; // px — 10.5 tiles (was 5.5, then 8.5, then 9.5; +1 more tile)
export const FAN_T3_POWER_COST = 5;
export const FAN_T4_MAX_FORCE = 1100; // Turbo Fan — extreme thrust, enough to clear a heavy coin across a ledge on its own
export const FAN_T4_MAX_RANGE = 480; // px — 15 tiles (was 10, then 13, then 14; +1 more tile)
export const FAN_T4_POWER_COST = 14;

// ---- Auto-Feeder ----
// Placed and aimed the same way as a Fan (angle locked at placement) — its
// aim is the OUTPUT direction; the intake sits directly opposite. Grid.js's
// updateBuildings absorbs any Waste item that drifts within
// AUTO_FEEDER_INTAKE_RADIUS of the intake point (typically pushed there by a
// Fan) and, after AUTO_FEEDER_PROCESS_DURATION_MS, dispenses one Food item
// at the output point with zero velocity — a Fan can then pick it back up
// and launch it into the water column, same as any other item.
export const AUTO_FEEDER_INTAKE_RADIUS = TILE_SIZE * 0.6;
export const AUTO_FEEDER_PROCESS_DURATION_MS = 2000;
export const AUTO_FEEDER_PORT_OFFSET_FRACTION = 0.5; // fraction of TILE_SIZE — how far outside the tile's center the intake/output points sit, along the aim axis

// A Collector doesn't bank an item the instant it lands any more — it visibly
// draws it in toward the tile's center and holds it there for a full
// COLLECTOR_PROCESS_DURATION_MS before actually consuming it (Grid.js's
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
export const COLLECTOR_PROCESS_DURATION_MS = 3000;
export const COLLECTOR_PULL_STRENGTH = 10; // 1/sec ease rate toward the tile's center
export const COLLECTOR_PROCESSING_MASS = 1000;
export const COLLECTOR_CIRCLE_RADIUS_FRACTION = 0.32; // fraction of TILE_SIZE — the drawing-in point rendered in the tile's center

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
// (ramps, multiple Collectors) to keep up, not just one tile under a
// firehose.
//
// Mass drives how much an item moves when it collides with another —
// ITEM_MASS_BY_TYPE below, not item.radius (a coin's radius is about value
// tier/visibility, not weight). Food is much lighter than a coin on purpose:
// a coin barely notices bumping into a food pellet, while a food pellet
// gets shoved completely out of the way by a coin.
export const ITEM_MASS_BY_TYPE = { food: 0.3, coin: 3, waste: 1 };
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
export const FOOD_FLOOR_GRACE_MS = 1000; // ms an uneaten pellet rests on the floor before despawning — a last chance for a nearby hungry fish instead of an instant, silent loss of the cost
export const COIN_RADIUS = 10; // px, base visual radius (bronze size) — 25% bigger than the original 8, easier to see and aim at
export const COIN_CLICK_RADIUS_MULTIPLIER = 1.1; // click hit-test radius is each coin's own (tier-scaled) radius times this — a forgiving margin that scales with the coin's actual drawn size
export const CHEAT_GRANT_AMOUNT = 10000; // $ granted by the M debug key
export const CHEAT_TANK_POINTS_GRANT_AMOUNT = 20; // Tank Points also granted by the M debug key, so testing the Tank Upgrades panel doesn't require grinding fish growth

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
export const WASTE_RADIUS = 5;
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
export const WASTE_POOP_INTERVAL_MS = 25000;

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
export const CLEANLINESS_PER_WASTE_EVENT = 4;

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
// economy constant here — tune once real playtesting exists.
export const FISH_MOVEMENT_FOOD_CAPACITY_UPGRADE_COSTS = [1, 3, 6, 10, 15, 20, 25, 30, 35]; // Tank Points

export const FISH_MOVEMENT_UPGRADE_COSTS = FISH_MOVEMENT_FOOD_CAPACITY_UPGRADE_COSTS;
export const FISH_MOVEMENT_UPGRADE_MAX_LEVEL = FISH_MOVEMENT_UPGRADE_COSTS.length;
// Every SPECIES row's swimSpeed below is already reduced by exactly this
// much from its originally-tuned value — buying Level 1 restores the
// original speed; every level after pushes past it. Applied live (not baked
// into a fish at spawn time) so buying a level speeds up every fish already
// in the tank immediately, not just future spawns — see Entities.js's
// effectiveSwimSpeed(). Left as a flat px/sec bonus per level (not a
// percentage) per direct request to leave this mechanic's formula alone.
export const FISH_MOVEMENT_UPGRADE_SPEED_BONUS = 5; // px/sec per level

// Food Capacity: how many food pellets can exist in state.level.items at
// once (checked in Entities.js's trySpawnFood — spawning is refused past
// this, regardless of money, same as any other affordability gate). Starts
// deliberately tight (FOOD_MAX_ON_SCREEN_BASE) so early-game feeding is a
// real constraint the player has to work around, not just spam; each
// purchased level raises the cap by FOOD_CAPACITY_UPGRADE_INCREMENT — cut
// from 2 to 1 per level now that there are 9 levels instead of 5, so the cap
// still tops out at a comparable place (2 -> 11 at max level) rather than
// nearly doubling.
export const FOOD_MAX_ON_SCREEN_BASE = 2;
export const FOOD_CAPACITY_UPGRADE_INCREMENT = 1; // per level — base 2 -> 3 -> 4 -> ... -> 11 at max level (9 levels)
export const FOOD_CAPACITY_UPGRADE_COSTS = FISH_MOVEMENT_FOOD_CAPACITY_UPGRADE_COSTS;
export const FOOD_CAPACITY_UPGRADE_MAX_LEVEL = FOOD_CAPACITY_UPGRADE_COSTS.length;

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
  blimpfish: '#c77dff',
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
    id: 'guppy', name: 'Guppy', tier: 1, cost: 20,
    description: 'The baseline. Cheap, sturdy, drops coins steadily.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 35, // px/sec — 5 below the original 40; the Level 1 Fish Movement Tank Upgrade restores it, see Config.js's FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 300000, // ms, not enforced until a later phase
    hungerRate: 2.03, // hunger points/sec — 20% lower than the original 2.54, part of a general de-pacing pass; hungry ~every 23s now, flat across all growth stages
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 30200, dropValue: 5 }, // stage 1: hatchling — 10% less frequent than before; feeding fills the timer, see COIN_TIMER_FEED_BONUS_FRACTION
      { feedsRequired: 3, scale: 0.75, dropInterval: 24200, dropValue: 5 }, // stage 2: juvenile — was 8; the baby->adult raw value now barely grows at all, the ~1.9x lifetime income bump comes almost entirely from dropInterval shrinking, not dropValue climbing (see the Species Roster & Progression note on this rebalance)
      { feedsRequired: 6, scale: 1.0, dropInterval: 15700, dropValue: 5 }, // stage 3: adult — was 13; baby->adult income ratio is now ~1.9x (was ~5x), matching the "closer to double, not 4-6x" rebalance
    ],
    unlockedByDefault: true,
  },
  dartfin: {
    id: 'dartfin', name: 'Dartfin', tier: 1, cost: 12,
    description: 'Cheaper and faster. Frequent low-value coins reward density.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 65, // -5, see FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 240000,
    hungerRate: 1.58, // 20% lower than the original 1.98, part of a general de-pacing pass; hungry ~every 30s now — lowest coin value of the three, so it's the least demanding to keep fed
    growthStages: [
      { feedsRequired: 0, scale: 0.5, dropInterval: 18150, dropValue: 3 },
      { feedsRequired: 3, scale: 0.75, dropInterval: 11400, dropValue: 3 }, // was 5 — see the baby->adult rebalance note on Guppy above; dropValue stays flat, dropInterval alone carries the growth curve
      { feedsRequired: 6, scale: 1.0, dropInterval: 7600, dropValue: 3 }, // was 5 — baby->adult income ratio is now ~2.4x (was ~4x); high-frequency coin firehose despite low feeding demand; the Phase 2 throughput stress test
    ],
    unlockedByDefault: true,
  },
  blimpfish: {
    id: 'blimpfish', name: 'Blimpfish', tier: 1, cost: 60,
    description: 'Expensive and sluggish. Voracious appetite, rare high-value coins.',
    behavior: ['FEEDER'], dropType: 'coin',
    swimSpeed: 17, // 10% faster than the original 20, then -5, see FISH_MOVEMENT_UPGRADE_SPEED_BONUS
    lifespan: 360000,
    hungerRate: 2.59, // 20% lower than the original 3.24, part of a general de-pacing pass; hungry ~every 18s now — highest coin value of the three, so it's the most demanding to keep fed
    growthStages: [
      { feedsRequired: 0, scale: 0.6, dropInterval: 33900, dropValue: 16 },
      { feedsRequired: 3, scale: 0.8, dropInterval: 29000, dropValue: 17 }, // was 29 — Blimpfish's dropInterval alone only shrinks ~1.4x baby->adult (unlike Guppy/Dartfin's ~2x+), so unlike those two this one needs a modest dropValue bump too to reach the "closer to double" target
      { feedsRequired: 6, scale: 1.0, dropInterval: 23700, dropValue: 22 }, // was 40 — baby->adult income ratio is now ~2.0x (was ~3.6x); still rewards feeding discipline with the biggest payout of the three, just not a 2.5x-in-raw-value jump any more
    ],
    unlockedByDefault: true,
  },

  // ---- Utility base species (Phase 3-4 scaffold, data only) ----
  // unlockPhase marks when each row is intended to become reachable — see
  // CLAUDE.md "Species Roster & Progression" for the full rollout schedule.
  // None of these are in speciesUnlocked yet (unlockedByDefault: false), so
  // they're inert until a later phase's unlock logic adds them.
  suckerfish: {
    id: 'suckerfish', name: 'Suckerfish', tier: 2, unlockPhase: 3, cost: 25,
    description: 'Only eats Waste, never Food — cleans up after the rest of the tank instead of adding to the mess.',
    behavior: ['SCAVENGER'], dropType: 'waste_cleared',
    swimSpeed: 30, lifespan: 300000,
    hungerRate: 1.015, // exactly half of Guppy's 2.03, per direct request — Entities.js's updateFish targets Waste items (never Food) for any species carrying the SCAVENGER tag
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 10000, dropValue: 0 }],
    unlockedByDefault: false,
  },
  electric_eel: {
    id: 'electric_eel', name: 'Electric Eel', tier: 2, unlockPhase: 3, cost: 80,
    description: 'Primary MW supply. Must be fed to keep generating.',
    behavior: ['GENERATOR'], dropType: 'power',
    swimSpeed: 20, lifespan: 300000, hungerRate: 0.97, // -20%, part of a general de-pacing pass — was 1.21
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 5000, dropValue: 0 }],
    unlockedByDefault: false,
  },
  octopus: {
    id: 'octopus', name: 'Science Octopus', tier: 3, unlockPhase: 4, cost: 90,
    description: 'Drops Blue Science Bubbles when swimming near a Research Hub.',
    behavior: ['RESEARCHER'], dropType: 'science_blue',
    swimSpeed: 25, lifespan: 300000, hungerRate: 0.78, // -20%, part of a general de-pacing pass — was 0.98
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 15000, dropValue: 1 }],
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
    swimSpeed: 33, lifespan: 300000, hungerRate: 1.44, // -20%, part of a general de-pacing pass — was 1.80
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 12850, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note: a splice can only happen on an adult fish, and inherits 1.2x that fish's adult coin value
    unlockedByDefault: false,
  },
  scrub_dartfin: {
    id: 'scrub_dartfin', name: 'Scrub Dartfin', tier: 4, unlockPhase: 4, cost: 37,
    description: 'Suckerfish-spliced Dartfin — fast waste cleanup, frequent small coins.',
    behavior: ['SCAVENGER', 'FEEDER'], dropType: 'waste_cleared', parents: ['suckerfish', 'dartfin'],
    swimSpeed: 48, lifespan: 300000, hungerRate: 1.22, // -20%, part of a general de-pacing pass — was 1.52
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 8800, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  scrub_blimpfish: {
    id: 'scrub_blimpfish', name: 'Scrub Blimpfish', tier: 4, unlockPhase: 4, cost: 85,
    description: 'Suckerfish-spliced Blimpfish — slow but thorough, big coins and a clean tank.',
    behavior: ['SCAVENGER', 'FEEDER'], dropType: 'waste_cleared', parents: ['suckerfish', 'blimpfish'],
    swimSpeed: 24, lifespan: 300000, hungerRate: 1.72, // -20%, part of a general de-pacing pass — was 2.15
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 16850, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  volt_guppy: {
    id: 'volt_guppy', name: 'Volt Guppy', tier: 4, unlockPhase: 4, cost: 100,
    description: 'Electric Eel-spliced Guppy — generates MW alongside its usual coin drops.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'guppy'],
    swimSpeed: 28, lifespan: 300000, hungerRate: 1.50, // -20%, part of a general de-pacing pass — was 1.88
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 10350, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  volt_dartfin: {
    id: 'volt_dartfin', name: 'Volt Dartfin', tier: 4, unlockPhase: 4, cost: 92,
    description: 'Electric Eel-spliced Dartfin — a fast, low-cost trickle of power and coins.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'dartfin'],
    swimSpeed: 43, lifespan: 300000, hungerRate: 1.28, // -20%, part of a general de-pacing pass — was 1.60
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 6300, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  volt_blimpfish: {
    id: 'volt_blimpfish', name: 'Volt Blimpfish', tier: 4, unlockPhase: 4, cost: 140,
    description: 'Electric Eel-spliced Blimpfish — slow, heavy-feeding hybrid with big power output.',
    behavior: ['GENERATOR', 'FEEDER'], dropType: 'power', parents: ['electric_eel', 'blimpfish'],
    swimSpeed: 19, lifespan: 300000, hungerRate: 1.78, // -20%, part of a general de-pacing pass — was 2.23
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 14350, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  scholar_guppy: {
    id: 'scholar_guppy', name: 'Scholar Guppy', tier: 4, unlockPhase: 4, cost: 110,
    description: 'Science Octopus-spliced Guppy — drops Blue Science alongside coins.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'guppy'],
    swimSpeed: 30, lifespan: 300000, hungerRate: 1.41, // -20%, part of a general de-pacing pass — was 1.76
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 15350, dropValue: 6 }], // 1.2x Guppy's adult dropValue (5) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  scholar_dartfin: {
    id: 'scholar_dartfin', name: 'Scholar Dartfin', tier: 4, unlockPhase: 4, cost: 102,
    description: 'Science Octopus-spliced Dartfin — quick, cheap research on the move.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'dartfin'],
    swimSpeed: 45, lifespan: 300000, hungerRate: 1.18, // -20%, part of a general de-pacing pass — was 1.48
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 11300, dropValue: 4 }], // 1.2x Dartfin's adult dropValue (3) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  scholar_blimpfish: {
    id: 'scholar_blimpfish', name: 'Scholar Blimpfish', tier: 4, unlockPhase: 4, cost: 150,
    description: 'Science Octopus-spliced Blimpfish — slow but valuable, big coins and big science.',
    behavior: ['RESEARCHER', 'FEEDER'], dropType: 'science_blue', parents: ['octopus', 'blimpfish'],
    swimSpeed: 21, lifespan: 300000, hungerRate: 1.69, // -20%, part of a general de-pacing pass — was 2.11
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 19350, dropValue: 26 }], // 1.2x Blimpfish's adult dropValue (22) — see CLAUDE.md's Gene-Splicing note
    unlockedByDefault: false,
  },
  scrub_eel: {
    id: 'scrub_eel', name: 'Scrub-Eel', tier: 4, unlockPhase: 4, cost: 105,
    description: 'Suckerfish-Eel splice — keeps the tank clean while powering the grid.',
    behavior: ['SCAVENGER', 'GENERATOR'], dropType: 'waste_cleared+power', parents: ['suckerfish', 'electric_eel'],
    swimSpeed: 25, lifespan: 300000, hungerRate: 0.91, // -20%, part of a general de-pacing pass — was 1.14
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 7500, dropValue: 0 }],
    unlockedByDefault: false,
  },
  scrub_topus: {
    id: 'scrub_topus', name: 'Scrub-Topus', tier: 4, unlockPhase: 4, cost: 115,
    description: 'Suckerfish-Octopus splice — clears waste while trickling Blue Science.',
    behavior: ['SCAVENGER', 'RESEARCHER'], dropType: 'waste_cleared+science_blue', parents: ['suckerfish', 'octopus'],
    swimSpeed: 28, lifespan: 300000, hungerRate: 0.82, // -20%, part of a general de-pacing pass — was 1.02
    growthStages: [{ feedsRequired: 0, scale: 1.0, dropInterval: 12500, dropValue: 1 }],
    unlockedByDefault: false,
  },
  volt_topus: {
    id: 'volt_topus', name: 'Volt-Topus', tier: 4, unlockPhase: 4, cost: 170,
    description: 'Eel-Octopus splice — powers the grid and researches at the same time.',
    behavior: ['GENERATOR', 'RESEARCHER'], dropType: 'power+science_blue', parents: ['electric_eel', 'octopus'],
    swimSpeed: 23, lifespan: 300000, hungerRate: 0.88, // -20%, part of a general de-pacing pass — was 1.10
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
// Placement Constraint: nothing here can float freely in open water. Every
// building except Platform itself must be placed adjacent (up/down/left/
// right) to a Platform tile, or directly on the world's absolute bottom row
// (the true seabed floor) — enforced by Grid.js's canPlaceTile. Platform is
// the one exception: it places freely anywhere in the seabed band, same as
// the old Wall did, since it's the thing everything else anchors to.
// Full refund on removal (100%, not a fraction any more) — per direct
// request, since removal is now a deliberate Demolish-tool action (see
// UI.js's tool-demolish-btn) rather than an always-available right-click,
// there's no risk of it being used as a free item-conveyor exploit the way
// a partial-refund policy was originally hedging against.
export const TILE_REFUND_FRACTION = 1.0;
export const BUILDING_TYPES = {
  [TILE_PLATFORM]: {
    id: TILE_PLATFORM, name: 'Platform', icon: '🧱', cost: 5,
    description: 'Solid structural floor. Items land and rest on top. Every other building must be anchored to a Platform (or the seabed floor) to be placed.',
    color: '#dba36f', unlockedByDefault: true, // available from level start — every other building needs one to anchor to, so it can't be gated behind any Mound tier
  },
  [TILE_RAMP_LEFT]: {
    id: TILE_RAMP_LEFT, name: 'Ramp Left', icon: '↙️', cost: 8,
    description: "Doesn't stop anything passing through it, up or down — just nudges it one tile left, like a gentle fan.",
    color: '#ffcf6b', unlockedByDefault: false,
  },
  [TILE_RAMP_RIGHT]: {
    id: TILE_RAMP_RIGHT, name: 'Ramp Right', icon: '↘️', cost: 8,
    description: "Doesn't stop anything passing through it, up or down — just nudges it one tile right, like a gentle fan.",
    color: '#ffb04d', unlockedByDefault: false,
  },
  [TILE_COLLECTOR]: {
    id: TILE_COLLECTOR, name: 'Collector', icon: '🧲', cost: 12,
    description: 'Auto-banks any coin that reaches it — no clicking required. Unpowered, so it leaves a little waste behind each time.',
    color: '#8fe0b8', unlockedByDefault: false,
  },
  [TILE_FAN_T2]: {
    id: TILE_FAN_T2, name: 'Rudimentary Fan', icon: '🌀', cost: 15,
    description: `Blows a narrow cone of force in whatever direction you aim it at placement. Free to run, but short reach (${FAN_T2_MAX_RANGE}px) and low force — struggles to lift a coin.`,
    color: '#9fd8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T3]: {
    id: TILE_FAN_T3, name: 'Electric Fan', icon: '💨', cost: 45,
    description: `Draws a little power from the grid for medium reach (${FAN_T3_MAX_RANGE}px) and force — enough to route most coins.`,
    color: '#5fb8ff', unlockedByDefault: false,
  },
  [TILE_FAN_T4]: {
    id: TILE_FAN_T4, name: 'Turbo Fan', icon: '🌪️', cost: 120,
    description: `Extreme thrust and long reach (${FAN_T4_MAX_RANGE}px) — clears even a heavy coin over a ledge on its own. Draws moderate power.`,
    color: '#2f7fd6', unlockedByDefault: false,
  },
  [TILE_AUTO_FEEDER]: {
    id: TILE_AUTO_FEEDER, name: 'Auto-Feeder', icon: '♻️', cost: 35,
    description: 'Absorbs Waste pushed into its intake side and dispenses Food from the opposite side — aim it the same way as a Fan.',
    color: '#c9e88f', unlockedByDefault: false,
  },
};
export const BUILDING_LIST = Object.values(BUILDING_TYPES);

// ---- Tier Progression & The Mound (Phase 2) ----
// See CLAUDE.md's "Tier Progression & The Mound" section for the full
// design. The very first "throw money" attempt (at MOUND_TEASE_COST) is a
// red herring — it spends the money but doesn't crack anything, just a
// notification joke (Mound.js's crackMound, gated on
// state.level.moundTeased). MOUND_CRACK_COST[tier] is the $ spent to
// actually crack FROM that tier to the next, once teased (placeholder
// balance, same as every other economy constant here — tune once real
// playtesting exists; Tier 4->5 in particular is priced steeply (50000) as
// though it needs "a whole system" behind it, not just a bigger number).
// TIER_UNLOCKS[tier]
// is what gets permanently granted into state.meta the first time that tier
// is reached.
export const MOUND_MAX_TIER = 5; // reaching this shatters the Mound completely (Tier 5 reveal) instead of cracking further — shifted from 4 to make room for the new Tier 2 (Economy Fish Combining) below
export const MOUND_TEASE_COST = 150; // unchanged — the tease is still a Tier 1 no-op regardless of how many tiers exist above it
// Crack costs 1/2/3 are unchanged from before the tier shift (1000/5000/25000
// for 1->2, 2->3, 3->4); 4 (2->3... — see TIER_UNLOCKS below for exactly what
// each transition now grants) is new, priced at the explicitly requested
// 50000 for the final crack into Tier 5 (Hybridization).
export const MOUND_CRACK_COST = { 1: 1000, 2: 5000, 3: 25000, 4: 50000 };
export const MOUND_WIDTH_TILES = 4.4; // how many seabed tiles wide its clickable footprint is — 10% bigger than the original 4
export const MOUND_HEIGHT_PX = 62; // how far it mounds up above the seabed surface — 10% bigger than the original 56
// All tiers shifted up by +1 from their original numbering (old T2->new T3,
// old T3->new T4, old T4->new T5) to make room for a new Tier 2 dedicated to
// Economy Fish Combining/Splicing and dynamic economy-fish pricing (both
// mechanics, not unlocks — gated on state.level.tier >= 2 wherever they're
// read, see ECONOMY_SPECIES_IDS/FISH_STAR_TIER_MAX below). Platform itself
// is NOT tier-gated at all any more — see BUILDING_TYPES' unlockedByDefault
// above — since every other building needs one to anchor to, per direct
// request it's available from level start rather than waiting on any crack.
// Collector and Auto-Feeder moved to Tier 3 (alongside the Ramps and
// Suckerfish) per the same request. The Rudimentary Fan isn't granted by a
// TIER_UNLOCKS entry at all any more — it moved even earlier, to the Mound's
// first "throw money" tease itself (the informal "Tier 1.5" step, before
// state.level.tier even reaches 2) — see Mound.js's crackMound.
export const TIER_UNLOCKS = {
  2: {
    species: [],
    buildings: [], // Rudimentary Fan already granted by the Tier 1.5 tease — this crack's only effect is flipping state.level.tier to 2, which is what gates Economy Fish Combining
  },
  3: {
    species: ['suckerfish'],
    buildings: [TILE_RAMP_LEFT, TILE_RAMP_RIGHT, TILE_COLLECTOR, TILE_AUTO_FEEDER],
  },
  // Tier 4/5 species are listed even though some of their mechanics aren't
  // built yet (Phase 3/4 alignment, not Phase 2 coding scope) — reaching
  // them today just makes these purchasable early with no real
  // Generator/Researcher/splicing behavior behind them yet, same inert-
  // scaffold situation every not-yet-behavior-wired species has been in. The
  // Electric/Turbo Fans ARE fully functional the moment they unlock, unlike
  // those still-scaffolded species/behaviors.
  4: { species: ['electric_eel'], buildings: [TILE_FAN_T3] },
  5: {
    species: [
      'octopus', 'scrub_guppy', 'volt_guppy', 'scholar_guppy',
      'scrub_dartfin', 'volt_dartfin', 'scholar_dartfin',
      'scrub_blimpfish', 'volt_blimpfish', 'scholar_blimpfish',
      'scrub_eel', 'scrub_topus', 'volt_topus',
    ],
    buildings: [TILE_FAN_T4],
  },
};

// ---- Economy Fish Combining/Splicing (Tier 2) ----
// The 3 base feeder species — the only ones dynamic pricing and star-tier
// combining apply to. Named "economy fish" in the design spec to
// distinguish them from the utility species (Suckerfish/Electric Eel/
// Science Octopus) and their hybrids, which are priced/handled normally.
export const ECONOMY_SPECIES_IDS = ['guppy', 'dartfin', 'blimpfish'];
// Current_Cost = species.cost * (ECONOMY_FISH_COST_GROWTH_RATE ^ N), where N
// is how many living fish of that exact species (any star tier) are
// currently in state.level.entities — see Entities.js's
// getEconomyFishCost(). Buying one immediately raises the cost of the next;
// one dying, starving, or being consumed by a combine lowers N (and so the
// cost) again, since N is always computed live off the current entity list
// rather than tracked as a running counter.
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
export const ESCAPE_DARE_DELAY_MS = 120000; // 2 minutes of state.level.elapsed with Escape never pressed before the "press escape, I dare you" notification fires
export const FISH_VANISH_DURATION_MS = 2500; // ms every fish freezes (position/hunger/coin-timer all frozen, not just hidden) and stops rendering, the first time the notification log is ever expanded
