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
} from './Config.js';
import { worldToScreen, screenToWorld, createInput, updateCamera, createGameLoop } from './Engine.js';
import { loadLevel, LEVELS } from './Levels.js';
import { updateStoryTriggers } from './Systems.js';
import { updateAmbience, renderAmbience } from './Ambience.js';
import { resumeAudio } from './Sound.js';
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
  rotateBuilding,
  worldToTile,
  angleFromTileToPoint,
  canPlaceTile,
  getBuildingCost,
  getTile,
  computeCurrentPowerDemand,
} from './Grid.js';
import { isPointOnMound, crackMound, renderMound, centerCameraOnMound, isPointOnScienceLab, renderScienceLab } from './Mound.js';
import { drawFish } from './FishRenderer.js';
import {
  initUI,
  updateHUD,
  updateDebugOverlay,
  updateNotificationTicker,
  refreshShopPanel,
  toggleShopCollapse,
  toggleTankPanel,
  togglePauseMenu,
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
splashTitle.addEventListener('animationend', (e) => {
  if (e.target === splashTitle) splashScreen.remove(); // ignore bubbled per-letter animationend events, only the title's own grow-fade ending means it's done
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
    // Small red reason text shown just above the cursor after a failed
    // building-placement attempt ("Can't afford" / "Needs Platform") — see
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

input.clickHandlers.push((sx, sy) => {
  if (fishDragArmed) { fishDragArmed = false; return; } // this click followed a fish-combine drag gesture — don't also bank/feed/mound-click at the release point
  const world = screenToWorld(sx, sy, state.camera);

  if (state.ui.selectedTool.startsWith('build:')) {
    const buildingId = state.ui.selectedTool.slice('build:'.length);
    if (FAN_BUILDING_IDS.includes(buildingId)) {
      if (isFanAimingActive()) {
        // Click 2: confirm the angle (from the armed cell's center to
        // wherever the cursor is NOW, not necessarily back over that cell)
        // and actually place the tile.
        const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, world.x, world.y);
        const confirmCheck = canPlaceTile(state, fanAimingCell.col, fanAimingCell.row, buildingId);
        if (!confirmCheck.ok) handleBuildPlacementFailure(confirmCheck.reason);
        placeTile(state, fanAimingCell.col, fanAimingCell.row, buildingId, angle);
        fanAimingCell = null;
        return;
      }
      // Click 1: arm aiming at this cell if it's actually a legal placement —
      // no tile placed yet, no money spent yet.
      const { col, row } = worldToTile(world.x, world.y);
      const check = canPlaceTile(state, col, row, buildingId);
      if (check.ok) fanAimingCell = { col, row, buildingId };
      else handleBuildPlacementFailure(check.reason);
      return; // either way, a fan-tool click never falls through to mound/coin/food
    }
  }

  if (state.ui.selectedTool === 'demolish') {
    const { col, row } = worldToTile(world.x, world.y);
    removeTile(state, col, row);
    return;
  }

  if (isPointOnMound(state, world.x, world.y)) { openMoundMenu(state); return; } // opens the "Throw money at it" popup — see UI.js
  if (isPointOnScienceLab(state, world.x, world.y)) { openLabMenu(state); return; } // Phase 4 — the Mound's replacement once it's fully shattered
  if (tryBankCoinAt(state, world.x, world.y)) return; // clicking a coin always banks it, regardless of selected tool
  if (tryBankScienceAt(state, world.x, world.y)) return; // same for a Science Bubble
  if (state.ui.selectedTool === 'food') {
    const reason = trySpawnFood(state, world.x, world.y);
    if (reason === 'no_money') flashMoneyInsufficient(state);
    return;
  }
  // A purchased fish is placed with a click, exactly like a building — see
  // Entities.js's trySpawnPurchasedFish and UI.js's selectSpeciesForPreview
  // (which sets this tool instead of arming a Buy button any more).
  if (state.ui.selectedTool.startsWith('fish:')) {
    if (trySpawnPurchasedFish(state, state.ui.selectedTool.slice('fish:'.length), world.x, world.y) === 'no_money') {
      flashMoneyInsufficient(state);
    }
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
// red reason above the cursor ("Can't afford" / "Needs Platform"), and the
// very first time a placement fails specifically for lacking a Platform to
// anchor to, that also posts a one-time explanatory HUD notification —
// mirrors every other "first X" story beat's pattern (see CLAUDE.md's
// "Story & Tutorial Notifications"). Shared by every placement-attempt call
// site (the Fan's two-click aim flow and updateBuildDrag's single-click-or-
// drag flow below) so the behavior can't drift between them.
const PLATFORM_NEEDED_MESSAGE =
  "You're gonna need platform for that. Can't have your buildings floating, we are all about our commitment to realistic physics";
const BUILD_ERROR_TEXT_DURATION_MS = 1100; // how long the cursor text stays up before render() stops drawing it

function showBuildError(text) {
  state.ui.buildErrorText = text;
  state.ui.buildErrorElapsedMs = 0;
}

function handleBuildPlacementFailure(reason) {
  if (reason === 'cannot afford') {
    flashMoneyInsufficient(state);
    showBuildError("Can't afford");
  } else if (reason === 'must be anchored to a Platform or the seabed floor') {
    showBuildError('Needs Platform');
    if (!state.level.tutorialFlags.firstPlatformNeeded) {
      state.level.tutorialFlags.firstPlatformNeeded = true;
      pushMainNotification(PLATFORM_NEEDED_MESSAGE);
    }
  }
}

input.keydownHandlers.push((e) => {
  // Nothing's running yet — the start screen (or its Settings/Help
  // sub-views) is the only thing on screen, and it has its own buttons for
  // navigating back, not Escape.
  if (!state.ui.gameStarted) return;
  if (e.code === 'Escape') { // opens/closes any time, even while paused
    if (!state.level.tutorialFlags.escapePressed) {
      state.level.tutorialFlags.escapePressed = true;
      if (state.level.tutorialFlags.escapeDareShown) pushMainNotification(MADE_YA_LOOK_MESSAGE);
    }
    if (isMoundMenuOpen()) { closeMoundMenu(); return; } // close whatever's on top first, rather than opening the pause menu behind/over it
    if (isLabPurchaseModalOpen()) { closeLabPurchaseModal(); return; } // closes the confirmation modal first — it sits on top of the tree
    if (isLabMenuOpen()) { closeLabMenu(); return; } // same, for the Science Lab's popup
    if (isFanAimingActive()) { fanAimingCell = null; return; } // cancel the pending Fan placement instead of opening the pause menu on top of it
    togglePauseMenu(state);
    return;
  }
  if (state.ui.paused) return; // swallow every other key while the pause menu is open

  switch (e.code) {
    case 'Backquote': // ` — toggle debug overlay
      state.debug.overlayVisible = !state.debug.overlayVisible;
      break;
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
    case 'KeyR': { // rotate the Collector/Auto-Feeder under the cursor 90° — see Grid.js's rotateBuilding
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      rotateBuilding(state, world.x, world.y);
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
  if (draggedFishId != null) return; // a fish-combine drag is in progress — don't also place tiles under it
  if (!input.mouse.inside || !state.ui.selectedTool.startsWith('build:')) return;
  const buildingId = state.ui.selectedTool.slice('build:'.length);
  if (FAN_BUILDING_IDS.includes(buildingId)) return; // Fans go through the two-click aiming flow in the click handler above, not drag-placement
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
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
  placeTile(state, col, row, buildingId, angle);
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

  updateCamera(state.camera, input, canvas, dtMs);
  updateBuildDrag();
  if (state.ui.buildErrorText) {
    state.ui.buildErrorElapsedMs += dtMs;
    if (state.ui.buildErrorElapsedMs >= BUILD_ERROR_TEXT_DURATION_MS) state.ui.buildErrorText = null;
  }
  updateEntities(state, dtMs);
  updateFishDrag();
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

// Cursor changes to match the active tool — a hammer for Demolish, a glove
// for the new Merge tool — per direct request. Built as a small inline SVG
// data-URI cursor (an emoji rendered onto a tiny canvas-less SVG) rather
// than a real cursor image asset, same "no external file, generate it"
// spirit as this project's synthesized audio. Only ever written to the DOM
// when the tool actually changed, not every frame.
function emojiCursorCss(emoji) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><text x='0' y='26' font-size='26'>${emoji}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 4 26, auto`;
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
const CURSOR_BY_TOOL = { demolish: emojiCursorCss('🔨'), merge: emojiCursorCss('🧤'), food: circleCursorCss(FOOD_COLOR) };
let lastCursorTool = null;
function updateCanvasCursor() {
  const cursorKey = CURSOR_BY_TOOL[state.ui.selectedTool] ? state.ui.selectedTool : 'default';
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

  if (isFanAimingActive() && input.mouse.inside && !state.ui.paused) {
    // Click 1 already happened — the ghost stays fixed at the armed cell
    // and only its aim rotates with the cursor, until click 2 confirms it.
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, world.x, world.y);
    const cellCenterX = fanAimingCell.col * TILE_SIZE + TILE_SIZE / 2;
    const cellCenterY = fanAimingCell.row * TILE_SIZE + TILE_SIZE / 2;
    renderBuildGhost(ctx, state, cellCenterX, cellCenterY, fanAimingCell.buildingId, angle);
  } else if (state.ui.selectedTool.startsWith('build:') && input.mouse.inside && !state.ui.paused) {
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const buildingId = state.ui.selectedTool.slice('build:'.length);
    const { col, row } = worldToTile(world.x, world.y);
    const angle = angleFromTileToPoint(col, row, world.x, world.y);
    renderBuildGhost(ctx, state, world.x, world.y, buildingId, angle);
  } else if (state.ui.selectedTool === 'demolish' && input.mouse.inside && !state.ui.paused) {
    // Ghost-mode preview of whatever's under the cursor, plus the refund
    // it'll pay out — TILE_REFUND_FRACTION is 1.0 (a full refund) per
    // direct request, since removal now requires deliberately picking this
    // tool rather than being an always-available right-click. Refund is read
    // off the tile's current live/dynamic cost (getBuildingCost), matching
    // what removeTile actually pays out — see Grid.js's comment there.
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
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
    drawFish(ctx, pos.x, pos.y, fish.speciesId, fish.stage, facing, fish.tailPhase, eyeDirection, fish.starTier || 1, sickness);

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

  // Small red "Can't afford"/"Needs Platform" reason text, glued to the
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
