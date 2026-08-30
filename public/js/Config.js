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
export const TILE_WALL = 'wall'; // solid — items land and rest on top
export const TILE_RAMP_LEFT = 'ramp_left'; // solid — items land then slide down-left
export const TILE_RAMP_RIGHT = 'ramp_right'; // solid — items land then slide down-right
export const TILE_COLLECTOR = 'collector'; // solid — items landing here are immediately consumed (coins auto-banked)
export const TILE_BLASTER = 'blaster'; // solid — items land here and immediately relaunch straight up into the water column instead of resting (see BLASTER_LAUNCH_* below)

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
// a Blaster) keeps rising — and crossing into a Ramp tile's row applies a
// single one-tile-width horizontal shift in that ramp's direction, exactly
// once per row (RAMP_NUDGE_DISTANCE, tracked via item.rampNudgedRow so it
// doesn't re-trigger every tick while still passing through the same row).
export const RAMP_NUDGE_DISTANCE = TILE_SIZE;
// A Blaster relaunches whatever lands on it back up into the water column.
// Launch height is a fraction of the water column's height (SEABED_FLOOR_Y):
// BLASTER_LAUNCH_MIN_FRACTION at the shallowest possible placement (right at
// the top of the seabed), rising toward BLASTER_LAUNCH_MIN_FRACTION +
// BLASTER_LAUNCH_MAX_DEPTH_BONUS as the Blaster is placed deeper into the
// city, maxing out at the very bottom row (0.5 + 0.15 = 0.65 — i.e. even a
// Blaster at the literal bottom of the city still only reaches 65% of the
// tank's height, comfortably inside it). The launch velocity needed to reach
// that height (v = sqrt(2 * gravity * height)) is computed per-item in
// Grid.js since it depends on that item's own gravity constant (a coin and a
// waste blob don't fall at the same rate). The shot isn't purely vertical:
// BLASTER_LAUNCH_ANGLE_MAX_DEG splits that speed into a small sideways
// component based on exactly where across the tile the item landed — dead
// center launches straight up, landing at the tile's left/right edge tilts
// the shot up to this many degrees off vertical in that direction — so a
// stream of coins landing slightly differently across the tile fans out a
// little instead of every shot retracing the exact same vertical line.
export const BLASTER_LAUNCH_MIN_FRACTION = 0.5;
export const BLASTER_LAUNCH_MAX_DEPTH_BONUS = 0.15;
export const BLASTER_LAUNCH_ANGLE_MAX_DEG = 7;
export const BLASTER_TOP_CORNER_RADIUS_FRACTION = 0.28; // fraction of TILE_SIZE — how rounded the Blaster's top two corners render (bottom stays square, it's still sitting flush on the tile below it)

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

// ---- Waste (Tier 2 scaffold — byproduct of basic/unpowered buildings) ----
// A third item type alongside food/coin. Spawned by Entities.js whenever a
// basic (currently the only kind that exists) Collector consumes an item —
// "a basic collector poops out sludge when collecting a coin," per the
// design update. Falls/routes using the exact same Grid.js tile physics as
// a coin, but isn't click-bankable and nothing currently consumes it (that's
// Suckerfish's real Scavenger behavior + real toxicity math, Phase 3) — it
// just accumulates, which is the intended pressure to reach Tier 3's
// Electric buildings (they skip producing it entirely).
export const WASTE_RADIUS = 5;
export const WASTE_GRAVITY = GRAVITY; // sinks like a coin, not a drifting food pellet
export const WASTE_MAX_FALL_SPEED = MAX_FALL_SPEED;
export const WASTE_COLOR = '#6b8e4e';

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

// All upgrade trees are simple linear ladders bought with Tank Points,
// index 0 = cost of level 1 (must already be at level N-1 to buy level N —
// UI.js enforces this, not Config.js), sharing one much steeper 5-level cost
// curve (was a flat [1,2,3,4] 4-level ladder — bumped up and extended a
// level per direct request that upgrades felt too cheap/fast to max out).
// Placeholder balance otherwise, same as every other economy constant here —
// tune once real playtesting exists.
export const TANK_UPGRADE_COSTS = [2, 5, 15, 30, 50]; // Tank Points

export const FISH_MOVEMENT_UPGRADE_COSTS = TANK_UPGRADE_COSTS;
export const FISH_MOVEMENT_UPGRADE_MAX_LEVEL = FISH_MOVEMENT_UPGRADE_COSTS.length;
// Every SPECIES row's swimSpeed below is already reduced by exactly this
// much from its originally-tuned value — buying Level 1 restores the
// original speed; Level 2-5 push past it. Applied live (not baked into a
// fish at spawn time) so buying a level speeds up every fish already in the
// tank immediately, not just future spawns — see Entities.js's
// effectiveSwimSpeed().
export const FISH_MOVEMENT_UPGRADE_SPEED_BONUS = 5; // px/sec per level

export const FOOD_QUALITY_UPGRADE_COSTS = TANK_UPGRADE_COSTS;
export const FOOD_QUALITY_UPGRADE_MAX_LEVEL = FOOD_QUALITY_UPGRADE_COSTS.length;
export const FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL = 0.10; // 10% slower fall per level (both FOOD_GRAVITY and FOOD_MAX_FALL_SPEED scale down) — doubled from 5%, part of the same slower-pacing pass as FOOD_GRAVITY/FOOD_MAX_FALL_SPEED above; applied live in Entities.js's updateFood
// FOOD_HUNGER_RELIEF_BY_LEVEL above is the other half of Food Quality.

// Food Capacity: how many food pellets can exist in state.level.items at
// once (checked in Entities.js's trySpawnFood — spawning is refused past
// this, regardless of money, same as any other affordability gate). Starts
// deliberately tight (FOOD_MAX_ON_SCREEN_BASE) so early-game feeding is a
// real constraint the player has to work around, not just spam; each
// purchased level raises the cap by FOOD_CAPACITY_UPGRADE_INCREMENT.
export const FOOD_MAX_ON_SCREEN_BASE = 2;
export const FOOD_CAPACITY_UPGRADE_INCREMENT = 2; // per level — base 2 -> 4 -> 6 -> 8 -> 10 -> 12 at max level
export const FOOD_CAPACITY_UPGRADE_COSTS = TANK_UPGRADE_COSTS;
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
    description: 'Eats waste before it decays into toxicity.',
    behavior: ['SCAVENGER'], dropType: 'waste_cleared',
    swimSpeed: 30, lifespan: 300000, hungerRate: 0.85, // -20%, part of a general de-pacing pass — was 1.06
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

// ---- Buildings (Phase 2) ----
// Every placeable seabed tile is a data row here, same pattern as SPECIES —
// adding a building means adding a row, not new placement code. `cost` is
// spent from state.level.money on placement (UI.js); removing a tile refunds
// cost * TILE_REFUND_FRACTION. `color` drives both the build-palette icon and
// the placed tile's render (Grid.js) and ghost-preview (main.js).
// unlockedByDefault is false across the board now — nothing is available at
// level start any more. All 6 unlock together when the Mound cracks to Tier
// 2 (see CLAUDE.md's Tier Progression & The Mound section, TIER_UNLOCKS
// below, and Mound.js) instead of the old "available from square one."
export const TILE_REFUND_FRACTION = 0.5;
export const BUILDING_TYPES = {
  [TILE_WALL]: {
    id: TILE_WALL, name: 'Wall', icon: '🧱', cost: 5,
    description: 'Solid floor. Items land and rest on top — collect them by hand until something routes them onward.',
    color: '#dba36f', unlockedByDefault: false, // warm terracotta, not the muddy gray-brown this used to be — that read as "disabled" against the pastel palette
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
  [TILE_BLASTER]: {
    id: TILE_BLASTER, name: 'Blaster', icon: '🚀', cost: 25,
    description: 'Launches whatever lands on it back up toward the surface, angled slightly by where it landed — deeper placements reach higher, up to 65% of the tank.',
    color: '#ff8a65', unlockedByDefault: false,
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
// playtesting exists; Tier 3->4 in particular is priced as though it needs
// "a whole system" behind it, not just a bigger number). TIER_UNLOCKS[tier]
// is what gets permanently granted into state.meta the first time that tier
// is reached.
export const MOUND_MAX_TIER = 4; // reaching this shatters the Mound completely (Tier 4 reveal) instead of cracking further
export const MOUND_TEASE_COST = 150;
export const MOUND_CRACK_COST = { 1: 1000, 2: 5000, 3: 25000 };
export const MOUND_WIDTH_TILES = 4.4; // how many seabed tiles wide its clickable footprint is — 10% bigger than the original 4
export const MOUND_HEIGHT_PX = 62; // how far it mounds up above the seabed surface — 10% bigger than the original 56
export const TIER_UNLOCKS = {
  2: { species: ['suckerfish'], buildings: [TILE_WALL, TILE_RAMP_LEFT, TILE_RAMP_RIGHT, TILE_COLLECTOR, TILE_BLASTER] },
  // Tier 3/4 species are listed even though their buildings/mechanics aren't
  // built yet (Phase 3/4 alignment, not Phase 2 coding scope) — reaching
  // them today just makes these purchasable early with no real
  // Generator/Researcher/splicing behavior behind them yet, same inert-
  // scaffold situation every not-yet-behavior-wired species has been in.
  3: { species: ['electric_eel'], buildings: [] },
  4: {
    species: [
      'octopus', 'scrub_guppy', 'volt_guppy', 'scholar_guppy',
      'scrub_dartfin', 'volt_dartfin', 'scholar_dartfin',
      'scrub_blimpfish', 'volt_blimpfish', 'scholar_blimpfish',
      'scrub_eel', 'scrub_topus', 'volt_topus',
    ],
    buildings: [],
  },
};

// ---- Rolling notification log ----
export const NOTIFICATION_LOG_MAX = 50; // oldest entries drop off past this many
