// main.js — entry point. Owns the root state object's initial shape, loads
// the first level through the real level-load path, and wires the rAF loop.
// Forbidden: no gameplay logic, no direct entity manipulation — that all
// happens in Entities.js/Levels.js, called from here.

import {
  SPECIES,
  SPECIES_LIST,
  BUILDING_LIST,
  BUILDING_TYPES,
  FISH_COLORS,
  FISH_BASE_SIZE,
  HUNGER_SEEK_THRESHOLD,
  HUNGER_CRITICAL_THRESHOLD,
  TIME_SCALE_STEPS,
  DEFAULT_TIME_SCALE_INDEX,
  CHEAT_GRANT_AMOUNT,
  CHEAT_TANK_POINTS_GRANT_AMOUNT,
  CHEAT_SCIENCE_GRANT_AMOUNT,
  SIM_DT_MS,
  MAX_FRAME_SKIP,
  SEABED_FLOOR_Y,
  CAMERA_WATER_COLUMN_FIT_FRACTION,
  PICKUP_TEXT_LIFETIME_MS,
  FOOD_COLOR,
  WASTE_COLOR,
  TILE_EMPTY,
  TILE_SIZE,
  TILE_FAN_T2,
  TILE_FAN_T3,
  TILE_FAN_T4,
  TILE_REFUND_FRACTION,
  NOTIFICATION_LOG_MAX,
  CLEANLINESS_MAX,
  SCIENCE_LAB_UPGRADES,
  SCIENCE_ITEM_COLOR_A,
  SCIENCE_ITEM_COLOR_B,
  POWER_HISTORY_MAX,
  SCIENCE_CAP_BY_LEVEL,
  MOUND_MAX_TIER,
  ALIEN_CLICK_DAMAGE,
  ALIEN_RADIUS,
  ALIEN_COLOR,
  ALIEN_HEALTH_BAR_WIDTH,
  ALIEN_HEALTH_BAR_HEIGHT,
  ALIEN_COUNTDOWN_START_MS,
  ALIEN_PORTAL_OPEN_MS,
  ALIEN_PORTAL_CLOSE_MS,
  ALIEN_PORTAL_RADIUS,
  ALIEN_HIT_FLASH_MS,
  ALIEN_HIT_FLASH_COLOR,
  ALIEN_HIT_BOUNCE_SCALE,
  ALIEN_DEATH_EFFECT_DURATION_MS,
  ALIEN_CLICK_RADIUS_MULTIPLIER,
  TURRET_PROJECTILE_RADIUS,
  TURRET_PROJECTILE_COLOR,
  COIN_RADIUS,
  COIN_BLOCKED_EFFECT_DURATION_MS,
  WORLD_H,
  CAMERA_BOTTOM_BUFFER_PX,
  WASTE_RADIUS,
  WASTE_DRAG_GHOST_CYCLE_MS,
  WASTE_DRAG_CLICK_RADIUS_MULTIPLIER,
  BUILDING_FAMILIES,
} from './Config.js';
import { worldToScreen, screenToWorld, createInput, updateCamera, createGameLoop } from './Engine.js';
import { loadLevel, LEVELS } from './Levels.js';
import { updateStoryTriggers } from './Systems.js';
import { updateAmbience, renderAmbience } from './Ambience.js';
import { resumeAudio, playAlienHit } from './Sound.js';
import {
  updateEntities,
  trySpawnFood,
  trySpawnPurchasedFish,
  tryBankCoinAt,
  tryBankScienceAt,
  spawnFishCheat,
  getCoinColor,
  getFishPurchaseCost,
  findFishAt,
  isCombinableFish,
  canCombineFish,
  combineFish,
  isSpliceSource,
  canSpliceFish,
  spliceFish,
} from './Entities.js';
import {
  renderSeabedGrid,
  renderBuildGhost,
  placeTile,
  removeTile,
  cycleTileCheat,
  worldToTile,
  angleFromTileToPoint,
  canPlaceTile,
  getBuildingCost,
  getTile,
  computeCurrentPowerDemand,
  findNearestWasteTurretAndWaste,
} from './Grid.js';
import { isPointOnMound, crackMound, renderMound, centerCameraOnMound, isPointOnScienceLab, renderScienceLab } from './Mound.js';
import { drawFish } from './FishRenderer.js';
import { oneShotShimmerProgress, drawShimmerSweep, shimmerFadeAlpha } from './Shimmer.js';
import {
  initUI,
  updateHUD,
  updateDebugOverlay,
  updateNotificationTicker,
  refreshShopPanel,
  toggleShopCollapse,
  toggleTankPanel,
  openMoundMenu,
  closeMoundMenu,
  isMoundMenuOpen,
  openLabMenu,
  closeLabMenu,
  isLabMenuOpen,
  closeLabPurchaseModal,
  isLabPurchaseModalOpen,
  flashMoneyInsufficient,
  selectTool,
  initStartScreen,
  scheduleShopButtonReminder,
  cancelActiveTool,
  advanceTutorialFlow,
  closeSidePanels,
} from './UI.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Browsers refuse to let an AudioContext make sound until a real user
// gesture — resumeAudio() also kicks off the looping background music the
// first time it's called, so this single pair of one-time listeners is all
// both SFX and music need to unlock.
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

// One-shot title splash (see index.html/style.css's #splash-screen). The
// title itself grows/fades in and back out via a pure CSS animation on
// #splash-title; each letter ALSO gets its own independent bounce, which
// needs a per-letter <span> to animate individually — built here from the
// element's plain text rather than hardcoded in index.html, so the markup
// stays just the word itself. GROW_IN_DURATION_S must match splash-grow-fade's
// own 25% keyframe (4.5s total * 0.25) so letters don't start bouncing until
// the word has actually finished growing in.
//
// The per-letter spans are still built eagerly here at load — but per
// direct request, #splash-screen itself starts fully invisible (not just
// "not yet animating" — see its own opacity:0 in style.css) and the
// animation doesn't start automatically either: both are gated on a single
// .play class added to #splash-screen (not #splash-title — see style.css's
// descendant selectors) by triggerSplash() below, once the player actually
// clicks Start on the new start screen, not on page load. This also means
// the splash can never bleed through the start screen's blurred backdrop
// the way it could while only the animation (not the visibility) was gated.
const splashScreen = document.getElementById('splash-screen');
const splashTitle = splashScreen.querySelector('#splash-title');
const SPLASH_GROW_IN_DURATION_S = 1.125;
const SPLASH_LETTER_STAGGER_S = 0.06;
const splashLetters = [...splashTitle.textContent];
splashTitle.textContent = '';
for (const [i, char] of splashLetters.entries()) {
  const span = document.createElement('span');
  span.className = 'splash-letter';
  span.textContent = char;
  span.style.animationDelay = `${SPLASH_GROW_IN_DURATION_S + i * SPLASH_LETTER_STAGGER_S}s`;
  splashTitle.appendChild(span);
}
const START_TUTORIAL_DELAY_AFTER_SPLASH_MS = 2000; // per direct request (cut from 3000) — the game-start guided tutorial no longer starts the instant Start is clicked; it waits this long after the splash screen has actually finished fading away
splashTitle.addEventListener('animationend', (e) => {
  if (e.target !== splashTitle) return; // ignore bubbled per-letter animationend events, only the title's own grow-fade ending means it's done
  splashScreen.remove();
  setTimeout(() => {
    if (!state.level.tutorialFlags.startTutorialShown) {
      state.level.tutorialFlags.startTutorialShown = true;
      state.level.tutorialFlow = { id: 'start', step: 'shop' };
    }
  }, START_TUTORIAL_DELAY_AFTER_SPLASH_MS);
});
function triggerSplash() {
  splashScreen.classList.add('play');
}

// ---- Root state (§3.1) — plain, JSON-serializable, meta/level split ----
const state = {
  meta: {
    buildingsUnlocked: BUILDING_LIST.filter((b) => b.unlockedByDefault).map((b) => b.id),
    speciesUnlocked: SPECIES_LIST.filter((s) => s.unlockedByDefault).map((s) => s.id),
    labUpgradesPurchased: [], // ids from Config.js's SCIENCE_LAB_UPGRADES — permanent like every other meta unlock, tracked separately from what each node actually grants so UI.js's tree can check prerequisites uniformly regardless of whether a node grants a species or a building
    levelsCompleted: [],
    settings: { soundOn: true },
  },
  level: null, // built by loadLevel below — never construct this inline (see Levels.js)
  // zoom/viewWidth/viewHeight are fit to the water column by fitCameraZoom()
  // below, once the canvas has a real size. viewWidth/viewHeight are the
  // current viewport's size in world units (canvas size / zoom) — UI.js
  // uses them to spawn purchased fish somewhere actually on screen.
  camera: { x: 0, y: 0, zoom: 1, viewWidth: 0, viewHeight: 0 },
  ui: {
    selectedTool: 'food', // which click-tool a canvas click performs; only 'food' exists until Phase 2 adds tile placement
    shopCollapsed: true, // shop starts tucked away — just the toggle button — so it doesn't clutter the view
    tankPanelCollapsed: true, // Tank Upgrades panel starts tucked away too — shares the shop's on-screen slot, only one is ever expanded (see UI.js's toggleShopCollapse/toggleTankPanel)
    paused: false, // pause menu open/closed (Escape); update() below skips simulating entirely while true
    // False until the player clicks "Start" on the new first-launch start
    // screen (UI.js's initStartScreen) — update() below checks this ahead of
    // (and independently from) `paused`, so the tank sits fully frozen (but
    // still rendered, blurred behind the start overlay) until then. Ambience
    // (bubbles/seaweed) is deliberately NOT gated on this — see update()'s
    // own comment — so the blurred tank still reads as alive behind the menu.
    gameStarted: false,
    // Set by Entities.js's updateFish the instant a fish's coin-drop cycle is
    // blocked by the Coin Cap — a plain cross-module state flag rather than
    // Entities.js importing UI.js directly (which would be circular, since
    // UI.js already imports plenty from Entities.js), read and cleared by
    // UI.js's updateHUD on its very next frame to trigger the "shake red"
    // flash on the Coin HUD readout. See Config.js's COIN_CAP_BY_LEVEL.
    coinCapFlashPending: false,
    // Same cross-module-flag pattern as coinCapFlashPending above, set by
    // Grid.js's updateBuildings the instant a Waste Turret's ammo actually
    // goes up (Grid.js importing UI.js directly would be circular, since
    // UI.js already imports from Grid.js) — read and cleared by UI.js's
    // updateHUD to advance the 'postalien'/'wastedrag' guided-tutorial
    // flows' "drag Waste into the Turret" step.
    wasteTurretAmmoGainedPending: false,
    // Small red reason text shown just above the cursor after a failed
    // building-placement attempt ("Can't afford") — see
    // showBuildError/handleBuildPlacementFailure and render()'s draw call.
    // null (or elapsed past BUILD_ERROR_TEXT_DURATION_MS) means nothing's
    // shown right now.
    buildErrorText: null,
    buildErrorElapsedMs: 0,
  },
  debug: {
    overlayVisible: false,
    timeScaleIndex: DEFAULT_TIME_SCALE_INDEX,
    selectedSpecies: 'guppy',
    cursorWorld: { x: 0, y: 0 },
  },
};

loadLevel(state, LEVELS[0].id);

// Zooms out so the water column (y=0..SEABED_FLOOR_Y) fits within
// CAMERA_WATER_COLUMN_FIT_FRACTION of the viewport height — deliberately a
// bit less than 100%, so a sliver of the seabed city is always visible
// below it. That keeps feeding/collecting free of vertical panning while
// still cueing that there's a city to scroll down to. Never zooms in past
// 1x on a tall window; recomputed on every resize.
function fitCameraZoom() {
  state.camera.zoom = Math.min(1, (canvas.height * CAMERA_WATER_COLUMN_FIT_FRACTION) / SEABED_FLOOR_Y);
  state.camera.viewWidth = canvas.width / state.camera.zoom;
  state.camera.viewHeight = canvas.height / state.camera.zoom;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  fitCameraZoom();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
centerCameraOnMound(state.camera); // one-time — not inside resizeCanvas, so a later window resize mid-play doesn't yank the camera back to the Mound

// ---- Input wiring ----
const input = createInput(canvas);

// Economy Fish Combining (Tier 2) drag state — see Entities.js's
// isCombinableFish/canCombineFish/combineFish and CLAUDE.md's "Economy Fish
// Combining/Splicing" section. draggedFishId is set on mousedown if the
// press landed on a legal combine SOURCE (economy species, Adult, not
// already at the tier cap); while set, update() below snaps that fish's
// position to the cursor every tick (freezing its own AI movement in the
// process, since the override runs after updateEntities) and render()
// highlights whatever fish is currently under the cursor green/red.
// fishDragArmed mirrors "a drag started this press" for exactly one
// browser 'click' event — the native click always fires after mouseup on
// the same element regardless of how far the mouse moved in between, so
// without this guard, starting a drag on a fish would ALSO trigger the
// click handler below (banking a coin / spawning food / opening the Mound
// menu) at the release point.
let draggedFishId = null;
let fishDragArmed = false;

input.mouseDownHandlers.push((sx, sy) => {
  fishDragArmed = false;
  if (state.ui.paused) return;
  // Combining/splicing now requires the dedicated Merge tool (🧤) to be
  // selected first — per direct request, this no longer fires just because
  // a mousedown happened to land on an eligible fish while some other tool
  // was active (Food, a building, Demolish). See UI.js's tool-merge-btn.
  if (state.ui.selectedTool !== 'merge') return;
  const world = screenToWorld(sx, sy, state.camera);
  const fish = findFishAt(state, world.x, world.y);
  // A fish can be a legal drag SOURCE for either interaction — Economy Fish
  // Combining or (Phase 4) Gene-Splicing — the two are mutually exclusive
  // per fish (a combine source is always an economy species, a splice
  // source is always a utility species, and neither set overlaps), so
  // there's no ambiguity about which one mouseup below should attempt.
  if (fish && (isCombinableFish(state, fish) || isSpliceSource(state, fish))) {
    draggedFishId = fish.id;
    fishDragArmed = true;
  }
});

input.mouseUpHandlers.push((sx, sy) => {
  if (draggedFishId == null) return;
  const world = screenToWorld(sx, sy, state.camera);
  const dragged = state.level.entities.find((e) => e.id === draggedFishId);
  const target = findFishAt(state, world.x, world.y, draggedFishId);
  if (dragged && target) {
    if (canCombineFish(state, dragged, target)) combineFish(state, dragged, target);
    else if (canSpliceFish(state, dragged, target)) spliceFish(state, dragged, target);
  }
  draggedFishId = null;
});

// Whether the "drag Waste into the Turret" guided-tutorial step is the one
// currently active — shared by the mousedown-arming gate below, update()'s
// tutorial freeze gate, and the ghost-Waste render code, so all three agree
// on exactly the same condition instead of drifting out of sync (an earlier
// version duplicated this check three times).
function isWasteDragTutorialStepActive(state) {
  return (
    (state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'dragwaste') ||
    (state.level.tutorialFlow?.id === 'wastedrag' && state.level.tutorialFlow.step === 'drag')
  );
}

// Waste dragging (city only) — per direct request. Mirrors the Economy Fish
// combine-drag pattern above (draggedFishId/fishDragArmed), just for a
// single Waste item instead of a fish, with no tool requirement (grabbing a
// piece of Waste directly always works, regardless of the currently
// selected tool — nothing was asked for gating this behind one). Only one
// piece of Waste can ever be dragged at a time (a second mousedown on
// another piece while one's already held is impossible anyway, since
// releasing the first is what clears draggedWasteId). updateWasteDrag
// (called from update(), after updateEntities — same "override whatever
// this tick's normal physics did" ordering updateFishDrag already uses)
// snaps the item's position to the cursor and zeroes its velocity every
// tick; Grid.js's resolveItemCollisions (which runs inside updateEntities,
// unconditionally over every item every tick regardless of who's currently
// "controlling" its position — see CLAUDE.md's "Items can't stack" section)
// then pushes every other nearby item out of the way of wherever the
// dragged waste currently sits, one tick behind, same as a dragged fish
// already causes for anything it swims through — no special-casing needed
// there at all. A Waste Turret/Auto-Feeder's own intake scan (Grid.js's
// updateBuildings) is equally untouched: it already just looks for an
// eligible Waste item within its intake radius each tick regardless of any
// drag state (gated only on "not already mid-process," same as always), so
// a dragged piece that drifts close enough still gets pulled in and
// spliced out of state.level.items normally — updateWasteDrag just needs to
// notice the item is gone and clear the drag, same as updateFishDrag
// already does for a fish that starves mid-drag.
let draggedWasteId = null;
let wasteDragArmed = false;

input.mouseDownHandlers.push((sx, sy) => {
  // A guided tutorial normally blocks starting a Waste drag like every
  // other input mechanic (see the general tutorial-flow hotkey-swallow
  // block in the keydown handler) — EXCEPT for the one tutorial step this
  // drag exists to teach in the first place, which would otherwise make the
  // step's own mechanic completely unusable while it's active. Per direct
  // report ("make it so the waste can actually be dragged during the
  // tutorial").
  if (state.ui.paused || (state.level.tutorialFlow && !isWasteDragTutorialStepActive(state))) return;
  if (draggedFishId != null) return; // a fish-drag already claimed this press
  const world = screenToWorld(sx, sy, state.camera);
  if (world.y < SEABED_FLOOR_Y) return; // city only, per direct request
  const waste = state.level.items.find(
    (item) => item.type === 'waste' && Math.hypot(item.x - world.x, item.y - world.y) <= WASTE_RADIUS * WASTE_DRAG_CLICK_RADIUS_MULTIPLIER
  );
  if (waste) {
    draggedWasteId = waste.id;
    wasteDragArmed = true;
  }
});

input.mouseUpHandlers.push(() => {
  // Deliberately doesn't touch the dragged item's vx/vy — updateWasteDrag
  // (below) already leaves it carrying real, cursor-derived velocity every
  // tick it's held, so letting go here just hands that off to the normal
  // seabed physics (Grid.js's stepItemOnGrid/integrateItemForces) to carry
  // on from, same as if gravity/drag had been acting on it the whole time.
  draggedWasteId = null;
});

function updateWasteDrag() {
  if (draggedWasteId == null) return;
  const dragged = state.level.items.find((item) => item.id === draggedWasteId && item.type === 'waste');
  if (!dragged) { draggedWasteId = null; return; } // absorbed by a Turret/Auto-Feeder (or otherwise removed) mid-drag
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const dtSec = SIM_DT_MS / 1000;
  // Per direct request ("when a player is dragging waste around and lets
  // go, the waste still has the same momentum from when the player is
  // holding it... the player should essentially be able to throw waste back
  // up into the tank"): velocity is derived from the cursor's own raw
  // world-space movement each tick — using `world.y` (unclamped) rather
  // than the item's actual clamped position below — so a fast upward swing
  // right at the city boundary still registers real upward speed even
  // though the item's own on-screen position can't visually follow the
  // cursor up past that boundary while still held (see the clamp right
  // after). On release, this last-computed vx/vy just carries straight into
  // the normal per-tick gravity+drag integration every seabed item already
  // gets (Grid.js's stepItemOnGrid/integrateItemForces) — nothing extra is
  // needed for it to keep flying, arc, and gradually decelerate.
  dragged.vx = (world.x - dragged.x) / dtSec;
  dragged.vy = (world.y - dragged.y) / dtSec;
  dragged.x = world.x;
  dragged.y = Math.max(world.y, SEABED_FLOOR_Y); // stays in the city while actively held — can't drag it back up into open water (only the carried-over velocity above can take it there, on release)
  dragged.resting = false;
}

// Fan placement is a two-click flow, not a single click: click 1 arms
// aiming at a valid cell (the tile isn't placed yet), then the ghost
// rotates live with the cursor from that cell's fixed position until click
// 2 confirms the angle and actually places it — per direct request, so a
// fan's direction is a deliberate second decision rather than baked into
// the same click that chose its location. fanAimingCell is self-healing:
// it's only ever honored while state.ui.selectedTool still matches the
// building id it was armed for, so switching tools (or the S/P/Escape
// shortcuts, or clicking a different shop icon) implicitly cancels it
// without any of those call sites needing to know this state exists.
const FAN_BUILDING_IDS = [TILE_FAN_T2, TILE_FAN_T3, TILE_FAN_T4];
let fanAimingCell = null; // { col, row, buildingId } | null

function isFanAimingActive() {
  return fanAimingCell != null && state.ui.selectedTool === `build:${fanAimingCell.buildingId}`;
}

// Per direct request: a Build or Demolish tool can't do anything in open
// water anyway — every building still has to be placed within the seabed
// band, and there's nothing to demolish up there — so the cursor icon,
// ghost preview, and click behavior all default back to Food while hovering
// open water with one of those two tools selected. Crucially,
// state.ui.selectedTool itself is NEVER changed by this — only what a
// click/hover DOES is reinterpreted — so a building stays armed exactly as
// selected the moment the cursor comes back down to the seabed, no need to
// reselect it in the shop. Fish
// and Merge are deliberately excluded, since both are genuinely used in
// open water and should stay exactly as selected everywhere. Shared by the
// click handler, updateBuildDrag, the cursor icon, and the ghost-preview
// render branch below, so all four can never drift out of sync with each
// other.
function effectiveToolAt(worldY) {
  const rawTool = state.ui.selectedTool;
  if (worldY < SEABED_FLOOR_Y && (rawTool.startsWith('build:') || rawTool === 'demolish')) return 'food';
  return rawTool;
}

input.clickHandlers.push((sx, sy) => {
  if (fishDragArmed) { fishDragArmed = false; return; } // this click followed a fish-combine drag gesture — don't also bank/feed/mound-click at the release point
  if (wasteDragArmed) { wasteDragArmed = false; return; } // same, for a Waste-drag gesture
  const world = screenToWorld(sx, sy, state.camera);

  // Alien Invasion: clicking a living alien always does ALIEN_CLICK_DAMAGE,
  // regardless of the currently selected tool — same "always works,
  // whatever's selected" precedent coin-banking (below) already has.
  // Checked first so it can't be shadowed by a build/demolish tool's own
  // early-return branches.
  for (const entity of state.level.entities) {
    if (entity.type !== 'alien' || entity.hp <= 0) continue;
    if (Math.hypot(entity.x - world.x, entity.y - world.y) <= ALIEN_RADIUS * ALIEN_CLICK_RADIUS_MULTIPLIER) {
      entity.hp -= ALIEN_CLICK_DAMAGE;
      entity.hitFlashMs = ALIEN_HIT_FLASH_MS; // per direct request — a hit flashes red and "bounces," read back by the render loop below
      // Only the "still alive" hit sound — a killing click instead gets
      // Entities.js's playAlienDeath from updateAlien's own death branch the
      // very next tick, so a fatal click doesn't fire both sounds at once.
      if (entity.hp > 0) playAlienHit();
      // The cinematic first-alien intro (see UI.js's TUTORIAL_FLOWS' 'alienintro'
      // flow) is just this exact same click-damage path with a guided
      // spotlight overlaid on top — during it, the overlay's own clip-path
      // hole only ever lets a click reach the canvas near the intro alien in
      // the first place, so this same loop is what actually damages it; this
      // just also ends the flow once it does.
      advanceTutorialFlow(state, 'alienintro', 'click');
      return;
    }
  }

  // A Fan's click-2 confirmation must work regardless of where the
  // confirming click lands — including open water, e.g. aiming a Fan's
  // cone straight up into the water column, a completely normal thing to
  // do — so this is checked BEFORE the open-water "defaults to Food"
  // override below, and can never be shadowed by it. isFanAimingActive()
  // already self-heals against a tool switch (see its own comment), so
  // this is only ever true while the exact fan that was armed is still the
  // selected tool.
  if (isFanAimingActive()) {
    const buildingId = fanAimingCell.buildingId;
    const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, world.x, world.y);
    const confirmCheck = canPlaceTile(state, fanAimingCell.col, fanAimingCell.row, buildingId);
    if (!confirmCheck.ok) handleBuildPlacementFailure(confirmCheck.reason);
    placeTile(state, fanAimingCell.col, fanAimingCell.row, buildingId, angle);
    fanAimingCell = null;
    return;
  }

  // Per direct request, a Build/Demolish tool defaults to Food while the
  // click lands in open water — see effectiveToolAt's own comment. Every
  // branch below reads this instead of state.ui.selectedTool directly.
  const effectiveTool = effectiveToolAt(world.y);

  if (effectiveTool.startsWith('build:')) {
    const buildingId = effectiveTool.slice('build:'.length);
    if (FAN_BUILDING_IDS.includes(buildingId)) {
      // Click 1: arm aiming at this cell if it's actually a legal placement —
      // no tile placed yet, no money spent yet.
      const { col, row } = worldToTile(world.x, world.y);
      const check = canPlaceTile(state, col, row, buildingId);
      if (check.ok) fanAimingCell = { col, row, buildingId };
      else handleBuildPlacementFailure(check.reason);
      return; // either way, a fan-tool click never falls through to mound/coin/food
    }
  }

  if (effectiveTool === 'demolish') {
    const { col, row } = worldToTile(world.x, world.y);
    removeTile(state, col, row);
    return;
  }

  // Per direct request: a coin or Science Bubble sitting in front of (i.e.
  // overlapping) the Mound/Science Lab's own click area gets the click
  // consumed on IT first — the Mound is ignored entirely that click, not
  // just deprioritized — so banking something isn't ever mistaken for a
  // Mound-menu-open because it happened to be resting in the wrong spot.
  // Checked ahead of the Mound/Lab hit-tests below (previously the other
  // way around).
  if (tryBankCoinAt(state, world.x, world.y)) return; // clicking a coin always banks it, regardless of selected tool
  if (tryBankScienceAt(state, world.x, world.y)) return; // same for a Science Bubble
  if (isPointOnMound(state, world.x, world.y)) { openMoundMenu(state); return; } // opens the "Throw money at it" popup — see UI.js
  if (isPointOnScienceLab(state, world.x, world.y)) { openLabMenu(state); return; } // Phase 4 — the Mound's replacement once it's fully shattered
  if (effectiveTool === 'food') {
    const reason = trySpawnFood(state, world.x, world.y);
    if (reason === 'no_money') flashMoneyInsufficient(state);
    return;
  }
  // A purchased fish is placed with a click, exactly like a building — see
  // Entities.js's trySpawnPurchasedFish and UI.js's selectSpeciesForPreview
  // (which sets this tool instead of arming a Buy button any more).
  if (effectiveTool.startsWith('fish:')) {
    const result = trySpawnPurchasedFish(state, effectiveTool.slice('fish:'.length), world.x, world.y);
    if (result === 'no_money') flashMoneyInsufficient(state);
    else if (result === 'spawned') advanceTutorialFlow(state, 'start', 'buyfish'); // game-start guided tutorial's final step
    return;
  }
  // Non-fan build-mode placement doesn't happen here — see the mousedown/
  // drag handling in update() below, which also covers a single un-dragged
  // click for those building types.
});

// Demolishing now requires the Demolish tool to be selected (see UI.js's
// tool-demolish-btn) — right-click alone no longer removes tiles
// unconditionally the way it used to. Kept as a convenience alias for
// left-click while that tool is active, not a separate always-on shortcut.
input.rightClickHandlers.push((sx, sy) => {
  if (state.ui.paused) return;
  if (state.ui.selectedTool !== 'demolish') return;
  const world = screenToWorld(sx, sy, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  removeTile(state, col, row);
});

// Build-mode drag-placement: while the left button is held and a build tool
// is selected, place a tile under the cursor once per tile cell entered
// (not once per physics tick) so dragging across several cells lays a row
// without re-spending money on a cell it's already sitting over.
let lastBuildCell = null;

// Demolish-mode drag-removal — per direct request ("click and drag over
// multiple buildings to delete them quickly, so you don't have to click each
// one"), mirrors updateBuildDrag's own "once per newly-entered cell, not
// once per physics tick" shape exactly, just calling removeTile instead of
// placeTile. removeTile is already a safe no-op on an empty cell (returns
// false, no refund/sound — see Grid.js), so this doesn't need its own
// occupancy check before calling it.
let lastDemolishCell = null;

// Story trigger: the first time Escape is EVER pressed (tracked ahead of
// every early-return below, so closing the Mound popup or cancelling a Fan
// aim both still count) — if the 2-minute dare already fired
// (tutorialFlags.escapeDareShown, see Systems.js's updateEscapeDare), this
// is the "gotcha" follow-up. See CLAUDE.md's "Story & Tutorial Notifications".
const MADE_YA_LOOK_MESSAGE = 'Made ya look. tehe';
function pushMainNotification(text) {
  const notifications = state.level.notifications;
  notifications.push({ id: notifications.length + 1, text, elapsed: state.level.elapsed });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
}

// Per direct request: any failed building-placement attempt shows a small
// red reason above the cursor ("Can't afford"). Shared by every placement-
// attempt call site (the Fan's two-click aim flow and updateBuildDrag's
// single-click-or-drag flow below) so the behavior can't drift between them.
// Per a later direct request, buildings no longer need to anchor to a
// Platform at all (Grid.js's canPlaceTile dropped that check entirely — see
// its own comment), so the "Needs Platform" branch this function used to
// have, and the one-time explanatory notification it posted, are gone.
const BUILD_ERROR_TEXT_DURATION_MS = 1100; // how long the cursor text stays up before render() stops drawing it

function showBuildError(text) {
  state.ui.buildErrorText = text;
  state.ui.buildErrorElapsedMs = 0;
}

function handleBuildPlacementFailure(reason) {
  if (reason === 'cannot afford') {
    flashMoneyInsufficient(state);
    showBuildError("Can't afford");
  }
}

input.keydownHandlers.push((e) => {
  // Nothing's running yet — the start screen (or its Settings/Help
  // sub-views) is the only thing on screen, and it has its own buttons for
  // navigating back, not Escape.
  if (!state.ui.gameStarted) return;
  // The debug overlay toggle is a pure observability tool, not a gameplay
  // action — deliberately never blocked by anything below (the cinematic
  // intro/tutorial-flow gates included), so it's always reachable for QA.
  if (e.code === 'Backquote') { state.debug.overlayVisible = !state.debug.overlayVisible; return; }
  // Escape can always skip an active guided tutorial — per direct request
  // ("make sure escape can actually skip any tutorial"), checked here,
  // ahead of the general tutorial-flow hotkey block below, so it's the one
  // exception to "every hotkey is swallowed during a tutorial." Just clears
  // the flow outright — UI.js's updateTutorialOverlay reacts on the very
  // next frame (hides the overlay/text), same as a normal completion.
  if (e.code === 'Escape' && state.level.tutorialFlow) {
    state.level.tutorialFlow = null;
    state.level.wasteDragTutorialTargetId = null; // clear any locked drag-Waste target — see Grid.js's findNearestWasteTurretAndWaste
    return;
  }
  // Guided tutorial flows (see UI.js's TUTORIAL_FLOWS) swallow every OTHER
  // hotkey, same reasoning as the cinematic intro above — the overlay's own
  // click-through "hole" is the only interaction that should work.
  if (state.level.tutorialFlow) return;
  if (e.code === 'Escape') {
    // Per direct request, Escape no longer opens the pause menu — that's now
    // the dedicated #pause-toggle-btn button (top-right, below the HUD).
    // Escape's new job: close whatever popup is on top (or the Shop/Tank
    // Upgrades panel, if one's open), and cancel an armed build/demolish/
    // merge tool back to Food. A no-op beyond that if none of those apply
    // (Food or a fish selection stay armed).
    if (!state.level.tutorialFlags.escapePressed) {
      state.level.tutorialFlags.escapePressed = true;
      if (state.level.tutorialFlags.escapeDareShown) pushMainNotification(MADE_YA_LOOK_MESSAGE);
    }
    if (isMoundMenuOpen()) { closeMoundMenu(); return; }
    if (isLabPurchaseModalOpen()) { closeLabPurchaseModal(); return; }
    if (isLabMenuOpen()) { closeLabMenu(); return; }
    if (isFanAimingActive()) {
      fanAimingCell = null; // cancel the pending aim...
      cancelActiveTool(state); // ...and the armed Fan tool itself, back to Food — a Fan is still a "building selected" per direct request
      return;
    }
    closeSidePanels(state); // per direct request — Escape also closes the Shop/Tank Upgrades panel if one's open
    cancelActiveTool(state);
    return;
  }
  if (state.ui.paused) return; // swallow every other key while the pause menu is open

  switch (e.code) {
    case 'Equal':
    case 'NumpadAdd': // + — faster
      state.debug.timeScaleIndex = Math.min(TIME_SCALE_STEPS.length - 1, state.debug.timeScaleIndex + 1);
      break;
    case 'Minus':
    case 'NumpadSubtract': // - — slower / pause at 0x
      state.debug.timeScaleIndex = Math.max(0, state.debug.timeScaleIndex - 1);
      break;
    case 'KeyM': // grant $10,000, 20 Tank Points, and 500 Science, for testing the Mound/Tank Upgrades/Science Lab without grinding
      state.level.money += CHEAT_GRANT_AMOUNT;
      state.level.tankPoints.total += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      state.level.tankPoints.available += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      state.level.science += CHEAT_SCIENCE_GRANT_AMOUNT;
      break;
    case 'KeyG': { // spawn selected species at cursor; Shift+G spawns fully grown
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      spawnFishCheat(state, state.debug.selectedSpecies, world.x, world.y, e.shiftKey);
      break;
    }
    case 'KeyU': // unlock all species, buildings, and every Science Lab tree node (including the whole Gene-Splicing hybrid tree)
      state.meta.speciesUnlocked = SPECIES_LIST.map((s) => s.id);
      state.meta.buildingsUnlocked = BUILDING_LIST.map((b) => b.id);
      state.meta.labUpgradesPurchased = Object.keys(SCIENCE_LAB_UPGRADES);
      // Marking every science_cap_* node "purchased" above doesn't itself
      // apply their grants (that side effect only lives in UI.js's
      // buyLabUpgrade, which this cheat deliberately bypasses) — set the
      // level directly too so the cheat's "everything unlocked" promise
      // actually holds for the Bubble Cap chain, not just its tree buttons.
      state.level.upgrades.scienceCapLevel = SCIENCE_CAP_BY_LEVEL.length - 1;
      refreshShopPanel(state);
      break;
    case 'KeyK': // clear all items
      state.level.items = [];
      break;
    case 'Digit1': // Food — matches the fixed bottom tool-bar's own 1/2/3 hotkeys
      selectTool(state, 'food');
      break;
    case 'Digit2': // Demolish
      selectTool(state, 'demolish');
      break;
    case 'Digit3': // Merge
      selectTool(state, 'merge');
      break;
    case 'KeyS': // toggle-collapse the shop panel
      toggleShopCollapse(state);
      break;
    case 'KeyP': // toggle-collapse the Tank Upgrades panel
      toggleTankPanel(state);
      break;
    case 'KeyT': { // cycle the tile under the cursor through every building type, free
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      cycleTileCheat(state, world.x, world.y);
      break;
    }
    case 'KeyN': { // force-crack the Mound to the next real tier, free
      // Previously pre-set moundTeased/fanUnlockPurchased/autoFeederUnlockPurchased
      // to true and called crackMound() once — but crackMound's own grant
      // branches are each gated on the matching flag still being FALSE
      // (`!state.level.fanUnlockPurchased`, etc.), so forcing them true
      // first made every one of those branches skip itself, and crackMound
      // fell straight through to a bare tier increment with nothing
      // granted. That silently ate the Rudimentary Fan/Auto-Feeder grants
      // every time this cheat was used — a real bug, not just a testing
      // quirk, since it made the debug cheat lie about what a real
      // playthrough actually unlocks. Fixed by calling the REAL
      // crackMound() repeatedly (topping up money before each call so
      // affordability is never the blocker) until the tier genuinely
      // advances — this walks through the tease/Fan-grant/Auto-Feeder-grant
      // sub-steps for real, exactly like a player clicking the Mound
      // several times would, with zero duplicated knowledge of what each
      // step grants.
      const startTier = state.level.tier;
      let guard = 0;
      while (state.level.tier === startTier && state.level.tier < MOUND_MAX_TIER && guard < 10) {
        state.level.money += CHEAT_GRANT_AMOUNT;
        crackMound(state);
        guard++;
      }
      refreshShopPanel(state);
      break;
    }
    case 'KeyY': // force the next Alien Invasion wave to start right now, for testing without waiting out a real ALIEN_WAVE_INTERVAL_MIN/MAX_MS gap
      state.level.alienNextWaveAtMs = state.level.elapsed;
      break;
  }
});

initUI(state);

// First-launch start screen (index.html's #start-overlay) — Start un-gates
// the sim loop (state.ui.gameStarted, checked in update() below) and kicks
// off the title splash, which used to play automatically on load but per
// direct request now waits for this instead.
initStartScreen(state, () => {
  state.ui.gameStarted = true;
  triggerSplash();
  scheduleShopButtonReminder(state); // per direct request — bounces the shop toggle until it's opened for the first time
  // Game-start guided tutorial (Shop -> Guppy -> buy your first fish) no
  // longer starts here — see the splashTitle 'animationend' handler above,
  // which now starts it START_TUTORIAL_DELAY_AFTER_SPLASH_MS after the
  // splash has actually finished fading away, per direct request.
});

// ---- Perf counters for the debug overlay ----
let fpsCounter = 0;
let fpsDisplay = 0;
let lastFpsTime = performance.now();

let stepsCounter = 0;
let stepsDisplay = 0;
let lastStepsTime = performance.now();

// items-routed-per-minute: samples state.level.gridStats.itemsRoutedTotal
// (incremented by Entities.js whenever a Collector consumes an item) once a
// second and extrapolates to a per-minute rate, same pattern as fps/steps.
let itemsRoutedLastTotal = 0;
let itemsRoutedPerMinDisplay = 0;
let lastItemsRoutedSampleTime = performance.now();

// Electricity HUD/graph: samples current power demand once per real
// sim-second (ticked off dtMs, so it still paces correctly under the debug
// time-scale cheat) into state.level.powerHistory — see UI.js's electricity
// readout/graph popup and Config.js's POWER_HISTORY_MAX.
let powerSampleAccumMs = 0;

// Places a tile at the cursor once per newly-entered cell while the left
// button is held and a build tool is selected — see the input wiring above
// for why this lives here instead of on the click handler.
function updateBuildDrag() {
  if (!input.mouseDown) {
    lastBuildCell = null;
    return;
  }
  if (draggedFishId != null || draggedWasteId != null) return; // a fish-combine or Waste drag is in progress — don't also place tiles under it
  if (!input.mouse.inside || !state.ui.selectedTool.startsWith('build:')) return;
  const buildingId = state.ui.selectedTool.slice('build:'.length);
  if (FAN_BUILDING_IDS.includes(buildingId)) return; // Fans go through the two-click aiming flow in the click handler above, not drag-placement
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  // Per direct request, a build tool can't place anything in open water —
  // the click handler's own effectiveToolAt already treats a plain click up
  // there as Food instead; this just makes sure the drag-placement path
  // (which is what actually places most buildings — see this function's own
  // header comment) never even attempts (and fails) a building placement in
  // the same spot, which would otherwise flash a spurious "out of bounds"
  // error every tick while dragging through open water.
  if (world.y < SEABED_FLOOR_Y) return;
  const { col, row } = worldToTile(world.x, world.y);
  const cellKey = `${col},${row}`;
  if (cellKey === lastBuildCell) return;
  lastBuildCell = cellKey;
  // Auto-Feeder's aim locks toward wherever the cursor is within the tile
  // at the moment it's placed — see Grid.js's angleFromTileToPoint. Ignored
  // for every other building type.
  const angle = angleFromTileToPoint(col, row, world.x, world.y);
  const check = canPlaceTile(state, col, row, buildingId);
  if (!check.ok) handleBuildPlacementFailure(check.reason);
  const placed = placeTile(state, col, row, buildingId, angle);
  // Post-alien guided tutorial's final step — any successful Turret
  // placement (the family's currently-armed tier, forced to the base Waste
  // Turret when this step's own icon was selected — see UI.js's
  // buildFamilyButton) completes the flow. Checked by family membership
  // rather than one exact tile id so it's not brittle if the player happens
  // to place a different tier.
  if (placed && BUILDING_FAMILIES.turret.includes(buildingId)) {
    advanceTutorialFlow(state, 'postalien', 'place');
  }
}

// Demolish-mode drag-removal — see lastDemolishCell's own comment above.
function updateDemolishDrag() {
  if (!input.mouseDown) {
    lastDemolishCell = null;
    return;
  }
  if (draggedFishId != null || draggedWasteId != null) return; // a fish-combine or Waste drag is in progress — don't also demolish under it
  if (!input.mouse.inside) return;
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  if (effectiveToolAt(world.y) !== 'demolish') return;
  const { col, row } = worldToTile(world.x, world.y);
  const cellKey = `${col},${row}`;
  if (cellKey === lastDemolishCell) return;
  lastDemolishCell = cellKey;
  removeTile(state, col, row);
}

// Runs every tick a combine-drag is active (after updateEntities, so this
// unconditionally overrides whatever that tick's normal AI/physics did),
// snapping the dragged fish's position to the cursor and zeroing its
// velocity — the visual "you're holding this fish" feedback the drag
// interaction needs. If the dragged fish stopped existing mid-drag (e.g. it
// starved the same tick), this just clears the drag rather than erroring.
function updateFishDrag() {
  if (draggedFishId == null) return;
  const dragged = state.level.entities.find((e) => e.id === draggedFishId);
  if (!dragged) { draggedFishId = null; return; }
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  dragged.x = world.x;
  dragged.y = world.y;
  dragged.vx = 0;
  dragged.vy = 0;
}

// Mirrors Engine.js's own updateCamera vertical clamp (camera.y's max is
// WORLD_H + CAMERA_BOTTOM_BUFFER_PX - viewH) to answer "is the camera
// currently panned all the way down" — used by the post-alien guided
// tutorial's "scroll" step to know when to advance/skip itself.
function isScrolledToBottom(state) {
  const viewH = canvas.height / state.camera.zoom;
  const maxY = Math.max(0, WORLD_H + CAMERA_BOTTOM_BUFFER_PX - viewH);
  return state.camera.y >= maxY - 1;
}

function update(dtMs) {
  // Ambience (bubbles/seaweed) deliberately does NOT run before the game
  // has started — the start screen's #start-overlay blurs the tank behind
  // it with a real backdrop-filter (a compositor-level blur, recomputed
  // every frame the content behind it changes), so a continuously-animating
  // scene under a full-viewport blur risked a genuinely laggy/unresponsive
  // page on slower hardware, which could easily read as "nothing can be
  // clicked" and "it never goes away" — not because the click handlers
  // were broken, but because the page itself was struggling to keep up.
  // Freezing ambience means the blurred backdrop is one static frame the
  // compositor only has to blur once, not forty times a second, while still
  // satisfying "the tank blurry behind it" — it's just not animating.
  if (state.ui.gameStarted) updateAmbience(dtMs);
  if (!state.ui.gameStarted) return; // frozen until the player clicks Start on the first-launch start screen — render() still runs (a static frame), same "frozen but visible" pattern the pause menu already uses
  if (state.ui.paused) return; // frozen behind the pause menu — render() still runs so the tank stays visible
  if (state.level.gameOver) return; // lost — frozen the same way, but via a separate flag so Escape still reaches the pause menu's Restart without also un-freezing a lost game (see Systems.js's updateBankruptcy)
  // The cinematic first-alien intro ('alienintro' in UI.js's TUTORIAL_FLOWS)
  // is the one guided-tutorial flow that freezes EVERYTHING, camera panning
  // included — per direct request, "the whole game pauses" — unlike every
  // other flow (see the general tutorialFlow check below, which
  // deliberately keeps camera/build-drag alive for the scroll/place steps).
  // Checked here, before updateCamera even runs. Defensive: if the target
  // alien is somehow already gone (shouldn't happen — nothing can kill it
  // while everything's frozen except the click that also ends this flow),
  // clear the flow instead of soft-locking the game frozen forever.
  if (state.level.tutorialFlow?.id === 'alienintro') {
    const alien = state.level.entities.find((e) => e.id === state.level.firstAlienIntroTargetId && e.type === 'alien' && e.hp > 0);
    if (!alien) state.level.tutorialFlow = null;
    return;
  }

  updateCamera(state.camera, input, canvas, dtMs);
  updateBuildDrag();
  updateDemolishDrag();
  // Guided tutorial flows (see UI.js's TUTORIAL_FLOWS) freeze everything
  // else below — fish AI, coin/waste production, aliens, elapsed time —
  // deliberately NOT camera panning or build-drag placement above, since the
  // "scroll" and "place" steps need both to keep working while a flow is
  // active. The overlay's own clip-path "hole" is what restricts WHICH
  // clicks actually reach anything (see UI.js's updateTutorialOverlay).
  if (state.level.tutorialFlow) {
    // The "scroll" step's advance condition isn't a click — there's nothing
    // to click for "pan the camera" — so it's checked here, every tick,
    // resolving the instant the camera reaches the bottom (immediately, with
    // no visible flash of the arrows, if it was already there when this step
    // started).
    if (state.level.tutorialFlow.id === 'postalien' && state.level.tutorialFlow.step === 'scroll' && isScrolledToBottom(state)) {
      state.level.tutorialFlow.step = 'place';
    }
    // The "drag Waste into the Turret" step needs the WHOLE simulation
    // running normally, not just camera/build-drag like every other step's
    // exemption — dragging itself is driven by updateWasteDrag below, but
    // actually getting absorbed depends on updateEntities' own turret-
    // intake scan (deep inside Grid.js's updateBuildings), which needs real
    // per-tick execution to ever fire at all. Falls through to the normal
    // path below instead of freezing — updateStoryTriggers' own tutorial
    // triggers all self-gate on state.level.tutorialFlow already being set
    // (this exact flow), so nothing else can start while this runs.
    if (!isWasteDragTutorialStepActive(state)) return;
  }
  if (state.ui.buildErrorText) {
    state.ui.buildErrorElapsedMs += dtMs;
    if (state.ui.buildErrorElapsedMs >= BUILD_ERROR_TEXT_DURATION_MS) state.ui.buildErrorText = null;
  }
  updateEntities(state, dtMs);
  updateFishDrag();
  updateWasteDrag();
  updateStoryTriggers(state);
  state.level.elapsed += dtMs;

  stepsCounter++;
  const now = performance.now();
  if (now - lastStepsTime >= 1000) {
    stepsDisplay = stepsCounter;
    stepsCounter = 0;
    lastStepsTime = now;
  }
  if (now - lastItemsRoutedSampleTime >= 1000) {
    const delta = state.level.gridStats.itemsRoutedTotal - itemsRoutedLastTotal;
    itemsRoutedPerMinDisplay = delta * 60;
    itemsRoutedLastTotal = state.level.gridStats.itemsRoutedTotal;
    lastItemsRoutedSampleTime = now;
  }

  powerSampleAccumMs += dtMs;
  if (powerSampleAccumMs >= 1000) {
    powerSampleAccumMs -= 1000;
    const history = state.level.powerHistory;
    history.push({ demand: computeCurrentPowerDemand(state), supply: state.level.powerSupply });
    if (history.length > POWER_HISTORY_MAX) history.shift();
  }
}

// The open-water background — a vertical gradient (lighter at the top,
// deeper/darker toward the bottom) instead of a single flat fill, and
// overall lightened from the original flat #1c5f8a, per direct request.
// Also responds live to state.level.cleanliness: at 100% it's the full
// lightened gradient; toward 0% both stops darken by DIRTY_DARKEN_FACTOR —
// "not a ton, but enough to notice." Recomputed every frame (cleanliness
// and canvas size can both change) rather than cached, same as every other
// per-frame canvas style in this render pass.
const WATER_TOP_CLEAN = { r: 58, g: 138, b: 184 };
const WATER_BOTTOM_CLEAN = { r: 32, g: 100, b: 145 };
const DIRTY_DARKEN_FACTOR = 0.82; // at 0% cleanliness, colors scale down to 82% of their clean brightness
function waterBackgroundGradient(ctx, canvasHeight, cleanliness) {
  const darken = DIRTY_DARKEN_FACTOR + (1 - DIRTY_DARKEN_FACTOR) * (cleanliness / CLEANLINESS_MAX);
  const top = `rgb(${Math.round(WATER_TOP_CLEAN.r * darken)}, ${Math.round(WATER_TOP_CLEAN.g * darken)}, ${Math.round(WATER_TOP_CLEAN.b * darken)})`;
  const bottom = `rgb(${Math.round(WATER_BOTTOM_CLEAN.r * darken)}, ${Math.round(WATER_BOTTOM_CLEAN.g * darken)}, ${Math.round(WATER_BOTTOM_CLEAN.b * darken)})`;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  return gradient;
}

// Alien hit-flash — per direct request ("aliens flash red and bounce when
// they take damage"). ALIEN_COLOR is a hex string everywhere else it's used
// (Grid.js's tier badges, etc.), so it's parsed to an {r,g,b} triple once
// here rather than adding a shared hex-parsing helper for this one call
// site — same "computed once at module scope" precedent as WATER_TOP_CLEAN
// above.
const ALIEN_COLOR_RGB = {
  r: parseInt(ALIEN_COLOR.slice(1, 3), 16),
  g: parseInt(ALIEN_COLOR.slice(3, 5), 16),
  b: parseInt(ALIEN_COLOR.slice(5, 7), 16),
};
function lerpRgbToString(from, to, t) {
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// An alien's body — reworked per direct request ("rework the alien fish so
// they are not flat, and so they match the same style of the fish") from a
// single flat circle into an oval body + trailing tail fin + dorsal spikes,
// with the same darker-underside/glossy-highlight "pop more, less flat"
// pass FishRenderer.js's own drawFish already gives every real fish. `color`
// is whatever the caller already resolved (including the hit-flash blend),
// `facing` is ±1 (which way the alien is currently moving), used to trail
// the tail fin and highlight the same direction a fish's own facing would.
// `gazeAngle` (radians, world-space atan2 toward the nearest fish — see the
// render loop below) drives the single cyclops eye's pupil, per direct
// request ("one eye like a cyclops... with a pupil that looks at the
// closest fish").
function drawAlienBody(ctx, x, y, radius, facing, color, gazeAngle) {
  ctx.save();

  // Tail fin, trailing behind the direction of travel.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.moveTo(x - facing * radius * 1.15, y);
  ctx.lineTo(x - facing * radius * 0.55, y - radius * 0.5);
  ctx.lineTo(x - facing * radius * 0.55, y + radius * 0.5);
  ctx.closePath();
  ctx.fill();

  // Main body — an oval, not a perfect circle.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.05, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // A few dorsal spikes along the top — the one purely "alien/sea-monster"
  // flourish, keeping it visually distinct from an ordinary fish silhouette
  // despite sharing the same shading language.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  for (let i = -1; i <= 1; i++) {
    const sx = x + i * radius * 0.32;
    ctx.beginPath();
    ctx.moveTo(sx, y - radius * 0.95);
    ctx.lineTo(sx - radius * 0.12, y - radius * 0.55);
    ctx.lineTo(sx + radius * 0.12, y - radius * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  // Darker underside + glossy highlight — the same treatment every fish
  // body already gets.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + radius * 0.32, radius * 0.8, radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x - facing * radius * 0.28, y - radius * 0.35, radius * 0.32, radius * 0.18, -0.3 * facing, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.05, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.stroke();

  // A single cyclops eye, centered where the two separate eyes used to sit
  // and bigger than either of them was — per direct request. A dark pupil
  // sits inside it, offset toward gazeAngle (the nearest fish, computed by
  // the caller) so it visibly tracks whatever's closest, clamped well
  // inside the eye's own edge so it never pokes out of the socket.
  const eyeX = x;
  const eyeY = y - radius * 0.15;
  const eyeRadius = radius * 0.34;
  ctx.fillStyle = '#ff5b5b';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const pupilOffset = eyeRadius * 0.4;
  const pupilRadius = eyeRadius * 0.42;
  const pupilX = eyeX + Math.cos(gazeAngle) * pupilOffset;
  const pupilY = eyeY + Math.sin(gazeAngle) * pupilOffset;
  ctx.fillStyle = '#1a0505';
  ctx.beginPath();
  ctx.arc(pupilX, pupilY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
  // A tiny glossy highlight on the pupil so it doesn't read as a flat dot.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(pupilX - pupilRadius * 0.3, pupilY - pupilRadius * 0.3, pupilRadius * 0.32, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Cursor changes to match the active tool — a hammer for Demolish, a glove
// for the new Merge tool — per direct request. Built as a small inline SVG
// data-URI cursor (an emoji rendered onto a tiny canvas-less SVG) rather
// than a real cursor image asset, same "no external file, generate it"
// spirit as this project's synthesized audio. Only ever written to the DOM
// when the tool actually changed, not every frame.
function emojiCursorCss(emoji, hotspotX = 4, hotspotY = 26) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text x='0' y='26' font-size='26'>${emoji}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
}
// The Food tool's cursor is a plain colored dot instead of an emoji — per
// direct request ("make the cursor look like the food"), matching the same
// FOOD_COLOR circle the shop's own Food icon (.tool-icon-food) and every
// dropped pellet already use, rather than reaching for an unrelated emoji.
// Hotspot centered on the circle so it aims precisely at the placement point.
function circleCursorCss(color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='10' cy='10' r='8' fill='${color}' stroke='rgba(0,0,0,0.35)' stroke-width='1.5'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 10 10, auto`;
}
const CURSOR_BY_TOOL = {
  // Per direct report, the default hotspot (near the bottom of the glyph —
  // roughly where the handle's grip end sits) read as "the click point is in
  // the middle of the icon." (13, 8) was measured directly off a rendered
  // 32x32 copy of this exact glyph/font-size (a small offscreen-canvas pixel
  // scan for the topmost non-transparent pixel, then nudged a few px down
  // into the solid head shape) — it sits at the top of the hammer's head,
  // not its very tip corner.
  demolish: emojiCursorCss('🔨', 13, 8),
  merge: emojiCursorCss('🧤'),
  food: circleCursorCss(FOOD_COLOR),
};
let lastCursorTool = null;
function updateCanvasCursor() {
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const effectiveTool = effectiveToolAt(world.y);
  const cursorKey = CURSOR_BY_TOOL[effectiveTool] ? effectiveTool : 'default';
  if (cursorKey === lastCursorTool) return;
  lastCursorTool = cursorKey;
  canvas.style.cursor = CURSOR_BY_TOOL[cursorKey] || '';
}

function render() {
  updateCanvasCursor();
  fpsCounter++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = fpsCounter;
    fpsCounter = 0;
    lastFpsTime = now;
  }

  ctx.fillStyle = waterBackgroundGradient(ctx, canvas.height, state.level.cleanliness);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Ambience (bubbles/seaweed) renders immediately after the plain
  // background fill and before anything else — per direct request, it
  // needs to sit behind the seabed/city, the Mound/Science Lab, and every
  // building/item/fish drawn later in this function, not just behind the
  // fish/items the way it was before.
  renderAmbience(ctx, state, canvas.width, canvas.height);

  renderSeabedGrid(ctx, state, canvas.width, canvas.height);
  renderMound(ctx, state);
  renderScienceLab(ctx, state);

  // Shared by every ghost-preview branch below, and — via effectiveToolAt —
  // what makes a Build/Demolish tool's ghost simply not show at all while
  // hovering open water (no branch below ever matches 'food', so the chain
  // falls through with nothing drawn, exactly matching the plain Food
  // tool's own "just the cursor, no ghost" look — see effectiveToolAt's
  // own comment for the full rationale).
  const hoverWorld = input.mouse.inside ? screenToWorld(input.mouse.x, input.mouse.y, state.camera) : null;
  const hoverEffectiveTool = hoverWorld ? effectiveToolAt(hoverWorld.y) : state.ui.selectedTool;

  if (isFanAimingActive() && input.mouse.inside && !state.ui.paused) {
    // Click 1 already happened — the ghost stays fixed at the armed cell
    // and only its aim rotates with the cursor, until click 2 confirms it.
    // Deliberately NOT gated by hoverEffectiveTool — aiming an already-armed
    // Fan up into open water is normal and its ghost should still track the
    // cursor there, same reasoning as the click handler's own click-2 path.
    const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, hoverWorld.x, hoverWorld.y);
    const cellCenterX = fanAimingCell.col * TILE_SIZE + TILE_SIZE / 2;
    const cellCenterY = fanAimingCell.row * TILE_SIZE + TILE_SIZE / 2;
    renderBuildGhost(ctx, state, cellCenterX, cellCenterY, fanAimingCell.buildingId, angle);
  } else if (hoverEffectiveTool.startsWith('build:') && input.mouse.inside && !state.ui.paused) {
    const world = hoverWorld;
    const buildingId = hoverEffectiveTool.slice('build:'.length);
    const { col, row } = worldToTile(world.x, world.y);
    const angle = angleFromTileToPoint(col, row, world.x, world.y);
    // showCone: false — this is the plain-hover phase, before a Fan's
    // placement cell has actually been armed by click 1 (see the
    // isFanAimingActive() branch above for that real aiming step). The
    // angle here is just wherever the cursor happens to be relative to
    // whatever tile it's currently over, not a deliberate aim decision yet,
    // so per direct report ("visually confusing to have the cone moving
    // around while trying to choose the fan location") no cone shows until
    // the location itself is actually confirmed.
    renderBuildGhost(ctx, state, world.x, world.y, buildingId, angle, false);
  } else if (hoverEffectiveTool === 'demolish' && input.mouse.inside && !state.ui.paused) {
    // Ghost-mode preview of whatever's under the cursor, plus the refund
    // it'll pay out — TILE_REFUND_FRACTION is 1.0 (a full refund) per
    // direct request, since removal now requires deliberately picking this
    // tool rather than being an always-available right-click. Refund is read
    // off the tile's current live/dynamic cost (getBuildingCost), matching
    // what removeTile actually pays out — see Grid.js's comment there.
    const world = hoverWorld;
    const { col, row } = worldToTile(world.x, world.y);
    const tile = getTile(state.level.grid, col, row);
    if (tile && tile !== TILE_EMPTY) {
      const screen = worldToScreen(col * TILE_SIZE, row * TILE_SIZE, state.camera);
      const size = TILE_SIZE * state.camera.zoom;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(screen.x, screen.y, size, size);
      ctx.globalAlpha = 1;
      const refund = Math.floor(getBuildingCost(state, tile) * TILE_REFUND_FRACTION);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`+$${refund}`, screen.x + 2, screen.y - 4);
    }
  } else if (state.ui.selectedTool.startsWith('fish:') && input.mouse.inside && !state.ui.paused) {
    // A real baby (hatchling-stage) fish of the selected species, at reduced
    // opacity, instead of a plain colored circle — per direct request, so
    // the ghost actually previews what's about to spawn. Validity is still
    // shown the same way a building ghost's red/green tint works: a soft
    // colored ring behind the fish (red if this click wouldn't actually
    // place it — unaffordable, or inside the seabed city where a fish could
    // never reach/stay; green if it would).
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const speciesId = state.ui.selectedTool.slice('fish:'.length);
    const affordable = state.level.money >= getFishPurchaseCost(state, speciesId);
    const ok = affordable && world.y < SEABED_FLOOR_Y;
    const screen = worldToScreen(world.x, world.y, state.camera);
    const hatchlingScale = SPECIES[speciesId].growthStages[0].scale;
    const size = FISH_BASE_SIZE * hatchlingScale * state.camera.zoom;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = ok ? '#4dff88' : '#ff4d4d';
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.75;
    const ghostTailPhase = (performance.now() / 300) % (Math.PI * 2);
    drawFish(ctx, screen.x, screen.y, speciesId, 0, 1, ghostTailPhase, { x: 1, y: 0 });
    ctx.globalAlpha = 1;
  }

  for (const item of state.level.items) {
    const pos = worldToScreen(item.x, item.y, state.camera);
    if (pos.x < -20 || pos.x > canvas.width + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue; // cull offscreen

    if (item.type === 'science') {
      // "Magical bubble" — a purple-to-blue radial blend plus a bright rim
      // ring, per direct request, instead of the flat single-color fill
      // every other item type gets below. A real ctx.createRadialGradient
      // is fine here (unlike a ctx.filter, which is the actually expensive
      // one — see Ambience.js's seaweed blur note) since it's just one more
      // fillStyle, no per-pixel filter pass.
      const gradient = ctx.createRadialGradient(
        pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.1,
        pos.x, pos.y, item.radius
      );
      gradient.addColorStop(0, SCIENCE_ITEM_COLOR_B);
      gradient.addColorStop(1, SCIENCE_ITEM_COLOR_A);
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const itemColor = item.type === 'food' ? FOOD_COLOR : item.type === 'waste' ? WASTE_COLOR : getCoinColor(item.value);
    ctx.beginPath();
    ctx.fillStyle = itemColor;
    ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    // A thin darker rim plus a small glossy highlight — per direct request
    // that items "pop more and look less flat" than a single flat fill,
    // same treatment FishRenderer.js's drawFish gets for its own body.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(pos.x - item.radius * 0.32, pos.y - item.radius * 0.32, item.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const ft of state.level.floatingTexts) {
    const pos = worldToScreen(ft.x, ft.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -20 || pos.y > canvas.height + 20) continue; // cull offscreen
    const alpha = 1 - ft.age / PICKUP_TEXT_LIFETIME_MS;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(ft.text, pos.x - 12, pos.y);
    ctx.globalAlpha = 1;
  }

  const cursorWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);

  // Economy Fish Combining / Gene-Splicing: while a drag is active, find
  // whatever fish is currently under the cursor (excluding the dragged fish
  // itself — it's been snapped to the cursor's exact position by
  // updateFishDrag, so without excluding it, it would always be its own
  // nearest match) and check whether dropping here would be a legal combine
  // OR splice — whichever applies depends on what's being dragged, same as
  // the mouseup handler above — for the green/red highlight drawn in the
  // fish loop below.
  let combineHoverTargetId = null;
  let combineHoverValid = false;
  if (draggedFishId != null) {
    const dragged = state.level.entities.find((e) => e.id === draggedFishId);
    if (dragged) {
      const hoverTarget = findFishAt(state, cursorWorld.x, cursorWorld.y, draggedFishId);
      if (hoverTarget) {
        combineHoverTargetId = hoverTarget.id;
        combineHoverValid = canCombineFish(state, dragged, hoverTarget) || canSpliceFish(state, dragged, hoverTarget);
      }
    }
  }

  // "You found the chat" gag: every fish is frozen (Entities.js's
  // updateFishVanish/updateEntities) AND hidden for FISH_VANISH_DURATION_MS
  // — skip the whole draw loop rather than each fish individually, since
  // nothing about them should be visible, not even the hunger indicator.
  for (const fish of state.level.fishVanishTimer > 0 ? [] : state.level.entities) {
    if (fish.type !== 'fish') continue; // state.level.entities also holds Alien Invasion aliens now — rendered separately below
    const pos = worldToScreen(fish.x, fish.y, state.camera);
    if (pos.x < -60 || pos.x > canvas.width + 60 || pos.y < -60 || pos.y > canvas.height + 60) continue; // cull offscreen
    const def = SPECIES[fish.speciesId];
    const size = FISH_BASE_SIZE * def.growthStages[fish.stage].scale;
    const facing = fish.vx >= 0 ? 1 : -1;
    const isFullyGrown = fish.stage === def.growthStages.length - 1;

    // Eye direction must be a normalized unit vector, not a raw target
    // point — drawFish has no way to verify a target's coordinate space
    // matches (pos.x, pos.y), so the direction is resolved here instead,
    // from world-space positions (fish.x/y, food/cursor), before normalizing.
    let eyeDirection = null;
    if (isFullyGrown) {
      let nearestFood = null;
      let nearestFoodDist = Infinity;
      for (const item of state.level.items) {
        if (item.type !== 'food') continue;
        const d = Math.hypot(item.x - fish.x, item.y - fish.y);
        if (d < nearestFoodDist) { nearestFoodDist = d; nearestFood = item; }
      }
      const cursorDist = Math.hypot(cursorWorld.x - fish.x, cursorWorld.y - fish.y);
      const lookTarget = nearestFood && nearestFoodDist < cursorDist ? nearestFood : cursorWorld;
      const dx = lookTarget.x - fish.x;
      const dy = lookTarget.y - fish.y;
      const dist = Math.hypot(dx, dy) || 1;
      eyeDirection = { x: dx / dist, y: dy / dist };
    }

    // Slightly green once a fish is hungry enough to actively seek food (the
    // same threshold that already shows the "!" indicator below) — a
    // little more green past the "!!" critical threshold — per direct
    // request that a hungry fish should visibly look a bit unwell.
    const sickness = fish.hunger >= HUNGER_CRITICAL_THRESHOLD ? 0.35 : fish.hunger >= HUNGER_SEEK_THRESHOLD ? 0.18 : 0;
    // Alien Invasion: a fish reads as gray while it can't currently produce
    // money — either a living alien is close by (continuous) or it just had
    // a coin drop blocked by the Coin Cap (timed, ~1s) — see Entities.js's
    // fish.alienNearby/capBlockedTintRemainingMs.
    const grayed = (fish.alienNearby || fish.capBlockedTintRemainingMs > 0) ? 0.55 : 0;
    drawFish(ctx, pos.x, pos.y, fish.speciesId, fish.stage, facing, fish.tailPhase, eyeDirection, fish.starTier || 1, sickness, grayed);

    // Shimmer/gleam, per direct request — placed, grown a stage, or
    // merged/spliced (all three set fish.shimmerStartedAt, see Entities.js's
    // createFish/updateFish). Clipped to a circle around the fish's own
    // silhouette so the sweep can't paint into the water around it.
    const shimmerT = oneShotShimmerProgress(fish.shimmerStartedAt, state.level.elapsed);
    if (shimmerT !== null) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = shimmerFadeAlpha(shimmerT); // per direct report — eases in/out over 0.3s instead of snapping on/off
      drawShimmerSweep(ctx, shimmerT, pos.x - size, pos.y - size, size * 2, size * 2);
      ctx.restore();
    }

    // Economy Fish Combining: a soft ring around the fish currently being
    // dragged, and a green/red ring around whatever it's hovering over.
    if (fish.id === draggedFishId) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fish.id === combineHoverTargetId) {
      ctx.strokeStyle = combineHoverValid ? '#4dff88' : '#ff4d4d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (fish.hunger >= HUNGER_CRITICAL_THRESHOLD) {
      ctx.fillStyle = '#ff3b3b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('!!', pos.x - 6, pos.y - size * 0.5 - 4);
    } else if (fish.hunger >= HUNGER_SEEK_THRESHOLD) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '10px sans-serif';
      ctx.fillText('!', pos.x - 2, pos.y - size * 0.5 - 4);
    }
  }

  // Alien Invasion: portals (animated open, hold, then close — see
  // Entities.js's updateAlienPortals for the timing this mirrors) and
  // aliens themselves (with a health bar above each), rendered as their own
  // pass after fish. Portals are plain state.level.alienPortals data
  // (Systems.js's spawnAlienWave), not entities.
  for (const portal of state.level.alienPortals) {
    const pos = worldToScreen(portal.x, portal.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    const elapsed = state.level.elapsed;
    // 0-1 "how open" the portal currently reads — ramps in over its own
    // ALIEN_PORTAL_OPEN_MS delay, then ramps back out over ALIEN_PORTAL_CLOSE_MS
    // once its alien has actually spawned (see Entities.js's updateAlienPortals).
    const t = !portal.spawned
      ? Math.min(1, Math.max(0, (elapsed - portal.openAtMs) / ALIEN_PORTAL_OPEN_MS))
      : Math.max(0, 1 - (elapsed - portal.spawnedAtMs) / ALIEN_PORTAL_CLOSE_MS);
    if (t <= 0) continue;
    const radius = ALIEN_PORTAL_RADIUS * state.camera.zoom * t;
    if (radius <= 0.5) continue;
    ctx.save();
    ctx.globalAlpha = 0.85 * t;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, radius * 0.15, pos.x, pos.y, radius);
    gradient.addColorStop(0, 'rgba(190, 100, 230, 0.9)');
    gradient.addColorStop(1, 'rgba(90, 20, 130, 0.05)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220, 170, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  for (const alien of state.level.entities) {
    if (alien.type !== 'alien' || alien.hp <= 0) continue;
    const pos = worldToScreen(alien.x, alien.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    const baseRadius = ALIEN_RADIUS * state.camera.zoom;
    // Hit flash + "bounce": both decay together over ALIEN_HIT_FLASH_MS —
    // flashFrac (1 at the instant of a hit, decaying to 0) drives the red
    // color blend directly; the bounce is a scale-punch (grows then
    // shrinks back to 1x, peaking at the midpoint) rather than a position
    // offset, since displacing an already-moving alien would just read as a
    // stutter. Only the body/eyes scale with it — the health bar stays
    // anchored off the unscaled baseRadius so it doesn't jitter.
    const flashFrac = alien.hitFlashMs / ALIEN_HIT_FLASH_MS;
    const bounceProgress = 1 - flashFrac; // 0 (just hit) -> 1 (flash fully decayed)
    const bounceScaleMul = alien.hitFlashMs > 0 ? 1 + ALIEN_HIT_BOUNCE_SCALE * Math.sin(bounceProgress * Math.PI) : 1;
    const radius = baseRadius * bounceScaleMul;
    const color = flashFrac > 0 ? lerpRgbToString(ALIEN_COLOR_RGB, ALIEN_HIT_FLASH_COLOR, flashFrac) : ALIEN_COLOR;
    const facing = alien.vx >= 0 ? 1 : -1;
    // Nearest fish, for the cyclops eye's pupil to track — a plain O(n)
    // scan over entities is cheap enough here (at most ALIEN_MAX_ALIVE
    // aliens, each doing this once per frame). Falls back to looking
    // straight ahead (the alien's own facing direction) if no fish exist.
    let nearestFish = null;
    let nearestDist = Infinity;
    for (const other of state.level.entities) {
      if (other.type !== 'fish') continue;
      const d = Math.hypot(other.x - alien.x, other.y - alien.y);
      if (d < nearestDist) { nearestDist = d; nearestFish = other; }
    }
    const gazeAngle = nearestFish ? Math.atan2(nearestFish.y - alien.y, nearestFish.x - alien.x) : (facing > 0 ? 0 : Math.PI);
    drawAlienBody(ctx, pos.x, pos.y, radius, facing, color, gazeAngle);

    const barW = ALIEN_HEALTH_BAR_WIDTH * state.camera.zoom;
    const barH = ALIEN_HEALTH_BAR_HEIGHT * state.camera.zoom;
    const barX = pos.x - barW / 2;
    const barY = pos.y - baseRadius - barH - 8;
    const barRadius = barH / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barRadius);
    ctx.fillStyle = 'rgba(20, 8, 8, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = Math.max(0.5, 0.6 * state.camera.zoom);
    ctx.stroke();
    const hpFrac = Math.max(0, alien.hp / alien.maxHp);
    if (hpFrac > 0) {
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barH, barW * hpFrac), barH, barRadius);
      const barGradient = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      barGradient.addColorStop(0, '#ff9a8a');
      barGradient.addColorStop(1, '#e0392b');
      ctx.fillStyle = barGradient;
      ctx.fill();
    }
    ctx.restore();
  }

  // Turret projectiles — a small bright bolt plus a short motion trail
  // (a fading line back toward where it came from, cheap to compute since
  // the trail is just the bolt's own current heading, no extra state kept
  // per projectile). state.level.turretProjectiles is plain data (Entities.js's
  // updateTurretProjectiles), not entities.
  for (const shot of state.level.turretProjectiles) {
    const pos = worldToScreen(shot.x, shot.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const target = state.level.entities.find((e) => e.id === shot.targetId && e.type === 'alien');
    const radius = TURRET_PROJECTILE_RADIUS * state.camera.zoom;
    if (target) {
      const dx = target.x - shot.x;
      const dy = target.y - shot.y;
      const dist = Math.hypot(dx, dy) || 1;
      const trailX = pos.x - (dx / dist) * radius * 3;
      const trailY = pos.y - (dy / dist) * radius * 3;
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.5)';
      ctx.lineWidth = Math.max(1, radius);
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = TURRET_PROJECTILE_COLOR;
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Alien death burst — a short expanding ring plus a handful of outward
  // particles at fixed angles (no per-effect random state needs storing;
  // the angles alone already read as an even burst), fading out over
  // ALIEN_DEATH_EFFECT_DURATION_MS. Purely decorative — see Entities.js's
  // updateAlien/updateAlienDeathEffects for the age-and-cull side of this.
  for (const effect of state.level.alienDeathEffects) {
    const pos = worldToScreen(effect.x, effect.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    const t = effect.age / ALIEN_DEATH_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    const ringRadius = ALIEN_RADIUS * state.camera.zoom * (1 + t * 1.6);
    ctx.strokeStyle = `rgb(${ALIEN_HIT_FLASH_COLOR.r}, ${ALIEN_HIT_FLASH_COLOR.g}, ${ALIEN_HIT_FLASH_COLOR.b})`;
    ctx.lineWidth = Math.max(1, 2.5 * state.camera.zoom * (1 - t));
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    const particleDist = ALIEN_RADIUS * state.camera.zoom * (0.4 + t * 1.8);
    ctx.fillStyle = 'rgba(90, 45, 107, 0.9)'; // ALIEN_COLOR, flat — the burst reads as the alien itself scattering
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const px = pos.x + Math.cos(angle) * particleDist;
      const py = pos.y + Math.sin(angle) * particleDist;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, 3 * state.camera.zoom * (1 - t)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // "Coin on fire, disintegrating" — per direct request, replacing the old
  // plain bubble-pop icon for a blocked COIN drop specifically (a blocked
  // Science brew still uses the original bubble floatingText). A shrinking
  // gold coin with a couple of flickering flame licks above it and a few
  // dark ember/ash flecks drifting up and outward as it crumbles, all
  // fading together over COIN_BLOCKED_EFFECT_DURATION_MS. Purely
  // decorative — see Entities.js's triggerProductionBlocked/
  // updateCoinBlockedEffects for the trigger and age-and-cull side of this.
  for (const effect of state.level.coinBlockedEffects) {
    const pos = worldToScreen(effect.x, effect.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const t = effect.age / COIN_BLOCKED_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    const radius = COIN_RADIUS * state.camera.zoom * (1 - t * 0.5); // shrinks as it burns down
    ctx.save();
    ctx.globalAlpha = alpha;

    // A couple of flickering flame licks fanned above the coin — a radial
    // gradient teardrop per flame, no ctx.filter (see Ambience.js's own
    // blur-filter perf note — a real filter here would be the same mistake).
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i - 1) * 0.6;
      const flicker = Math.sin(effect.age * 0.02 + i * 2.1) * radius * 0.25;
      const flameLen = radius * (1.1 + 0.35 * Math.sin(effect.age * 0.03 + i));
      const fx = pos.x + Math.cos(angle) * radius * 0.3 + flicker;
      const fy = pos.y + Math.sin(angle) * radius * 0.3 - flameLen * 0.5;
      const flameGradient = ctx.createRadialGradient(fx, fy, 0, fx, fy, flameLen);
      flameGradient.addColorStop(0, 'rgba(255, 235, 130, 0.9)');
      flameGradient.addColorStop(0.5, 'rgba(255, 140, 40, 0.75)');
      flameGradient.addColorStop(1, 'rgba(200, 40, 20, 0)');
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.ellipse(fx, fy, flameLen * 0.4, flameLen, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // The coin itself — a plain gold disc with a darker rim, shrinking.
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 70, 10, 0.6)';
    ctx.lineWidth = Math.max(1, radius * 0.15);
    ctx.stroke();

    // Crumbling ash/ember flecks, drifting up and outward from the coin as
    // it disintegrates (t drives both how far out and how far up).
    ctx.fillStyle = `rgba(90, 60, 30, ${alpha})`;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const dist = radius * (0.6 + t * 1.8);
      const px = pos.x + Math.cos(angle) * dist;
      const py = pos.y + Math.sin(angle) * dist - t * 10 * state.camera.zoom;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, 2 * state.camera.zoom * (1 - t)), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Small red "Can't afford" reason text, glued to the
  // cursor's own screen position (not a world point — this is pure UI
  // feedback, drawn in plain screen space like every other ctx.fillText
  // call in this function already is) — see handleBuildPlacementFailure.
  // Fades out over its last third of BUILD_ERROR_TEXT_DURATION_MS rather
  // than cutting off abruptly.
  if (state.ui.buildErrorText && input.mouse.inside) {
    const fadeStart = BUILD_ERROR_TEXT_DURATION_MS * 0.66;
    const alpha = state.ui.buildErrorElapsedMs <= fadeStart
      ? 1
      : Math.max(0, 1 - (state.ui.buildErrorElapsedMs - fadeStart) / (BUILD_ERROR_TEXT_DURATION_MS - fadeStart));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff3b3b';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.ui.buildErrorText, input.mouse.x, input.mouse.y - 22);
    ctx.restore();
  }

  // The cinematic first-alien intro's spotlight is drawn by UI.js's
  // #tutorial-overlay now (a real clip-path DOM hole, same as every other
  // guided-tutorial step) instead of a bespoke canvas destination-out
  // gradient — per direct report that the two "seemed different," this
  // unifies them into the exact same mechanism, called from updateHUD below.

  // Ghost Waste animation — per direct request, a translucent Waste circle
  // loops from the target Waste's own position to the target Waste
  // Turret's while the "drag Waste into the Turret" guided-tutorial step is
  // active, showing the player exactly what to do. Hidden the instant they
  // actually grab the real one (draggedWasteId != null) — the whole point
  // was showing WHERE to drag, not competing for attention once they're
  // already doing it.
  if (isWasteDragTutorialStepActive(state) && draggedWasteId == null) {
    const target = findNearestWasteTurretAndWaste(state);
    if (target && target.waste) {
      const t = (state.level.elapsed % WASTE_DRAG_GHOST_CYCLE_MS) / WASTE_DRAG_GHOST_CYCLE_MS;
      const worldX = target.waste.x + (target.turret.x - target.waste.x) * t;
      const worldY = target.waste.y + (target.turret.y - target.waste.y) * t;
      const screen = worldToScreen(worldX, worldY, state.camera);
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = WASTE_COLOR;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, WASTE_RADIUS * state.camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  updateHUD(state);
  updateNotificationTicker(state);
  state.debug.cursorWorld = cursorWorld;
  updateDebugOverlay(state, {
    fps: fpsDisplay,
    stepsPerSec: stepsDisplay,
    timeScale: TIME_SCALE_STEPS[state.debug.timeScaleIndex],
    itemsRoutedPerMin: itemsRoutedPerMinDisplay,
  });
}

createGameLoop({
  update,
  render,
  getTimeScale: () => TIME_SCALE_STEPS[state.debug.timeScaleIndex],
  simDtMs: SIM_DT_MS,
  maxFrameSkip: MAX_FRAME_SKIP,
});
