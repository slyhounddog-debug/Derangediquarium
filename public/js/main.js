// main.js — entry point. Owns the root state object's initial shape, loads
// the first level through the real level-load path, and wires the rAF loop.
// Forbidden: no gameplay logic, no direct entity manipulation — that all
// happens in Entities.js/Levels.js, called from here.

import {
  SPECIES,
  SPECIES_LIST,
  BUILDING_LIST,
  FISH_BASE_SIZE,
  HUNGER_SEEK_THRESHOLD,
  HUNGER_CRITICAL_THRESHOLD,
  TIME_SCALE_STEPS,
  DEFAULT_TIME_SCALE_INDEX,
  CHEAT_GRANT_AMOUNT,
  CHEAT_TANK_POINTS_GRANT_AMOUNT,
  SIM_DT_MS,
  MAX_FRAME_SKIP,
  SEABED_FLOOR_Y,
  CAMERA_WATER_COLUMN_FIT_FRACTION,
  PICKUP_TEXT_LIFETIME_MS,
  WASTE_COLOR,
} from './Config.js';
import { worldToScreen, screenToWorld, createInput, updateCamera, createGameLoop } from './Engine.js';
import { loadLevel, LEVELS } from './Levels.js';
import { updateEntities, trySpawnFood, tryBankCoinAt, spawnFishCheat, getCoinColor } from './Entities.js';
import { renderSeabedGrid, renderBuildGhost, placeTile, removeTile, cycleTileCheat, worldToTile } from './Grid.js';
import { isPointOnMound, crackMound, renderMound, centerCameraOnMound } from './Mound.js';
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
} from './UI.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---- Root state (§3.1) — plain, JSON-serializable, meta/level split ----
const state = {
  meta: {
    scienceTotal: 0,
    techUnlocked: [],
    buildingsUnlocked: BUILDING_LIST.filter((b) => b.unlockedByDefault).map((b) => b.id),
    speciesUnlocked: SPECIES_LIST.filter((s) => s.unlockedByDefault).map((s) => s.id),
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

input.clickHandlers.push((sx, sy) => {
  const world = screenToWorld(sx, sy, state.camera);
  if (isPointOnMound(state, world.x, world.y)) { openMoundMenu(state); return; } // opens the "Throw money at it" popup — see UI.js
  if (tryBankCoinAt(state, world.x, world.y)) return; // clicking a coin always banks it, regardless of selected tool
  if (state.ui.selectedTool === 'food') {
    trySpawnFood(state, world.x, world.y);
  }
  // Build-mode placement doesn't happen here — see the mousedown/drag
  // handling in update() below, which also covers a single un-dragged click.
});

// Right-click always removes whatever tile is under the cursor, regardless
// of the selected tool — mirrors how clicking a coin always banks it above.
input.rightClickHandlers.push((sx, sy) => {
  if (state.ui.paused) return;
  const world = screenToWorld(sx, sy, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  removeTile(state, col, row);
});

// Build-mode drag-placement: while the left button is held and a build tool
// is selected, place a tile under the cursor once per tile cell entered
// (not once per physics tick) so dragging across several cells lays a row
// without re-spending money on a cell it's already sitting over.
let lastBuildCell = null;

input.keydownHandlers.push((e) => {
  if (e.code === 'Escape') { // opens/closes any time, even while paused
    if (isMoundMenuOpen()) { closeMoundMenu(); return; } // close whatever's on top first, rather than opening the pause menu behind/over it
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
    case 'KeyM': // grant $10,000 and 20 Tank Points, for testing both the Mound and the Tank Upgrades panel without grinding
      state.level.money += CHEAT_GRANT_AMOUNT;
      state.level.tankPoints.total += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      state.level.tankPoints.available += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      break;
    case 'KeyG': { // spawn selected species at cursor; Shift+G spawns fully grown
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      spawnFishCheat(state, state.debug.selectedSpecies, world.x, world.y, e.shiftKey);
      break;
    }
    case 'KeyU': // unlock all species, buildings, and tech
      state.meta.speciesUnlocked = SPECIES_LIST.map((s) => s.id);
      state.meta.buildingsUnlocked = BUILDING_LIST.map((b) => b.id);
      refreshShopPanel(state);
      break;
    case 'KeyK': // clear all items
      state.level.items = [];
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
    case 'KeyN': // force-crack the Mound to the next real tier, free — skips the tease if it hasn't happened yet, so this always advances a tier rather than sometimes just spending the press on the joke
      state.level.money += CHEAT_GRANT_AMOUNT;
      state.level.moundTeased = true;
      crackMound(state);
      refreshShopPanel(state);
      break;
  }
});

initUI(state);

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

// Places a tile at the cursor once per newly-entered cell while the left
// button is held and a build tool is selected — see the input wiring above
// for why this lives here instead of on the click handler.
function updateBuildDrag() {
  if (!input.mouseDown) {
    lastBuildCell = null;
    return;
  }
  if (!input.mouse.inside || !state.ui.selectedTool.startsWith('build:')) return;
  const buildingId = state.ui.selectedTool.slice('build:'.length);
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  const cellKey = `${col},${row}`;
  if (cellKey === lastBuildCell) return;
  lastBuildCell = cellKey;
  placeTile(state, col, row, buildingId);
}

function update(dtMs) {
  if (state.ui.paused) return; // frozen behind the pause menu — render() still runs so the tank stays visible

  updateCamera(state.camera, input, canvas, dtMs);
  updateBuildDrag();
  updateEntities(state, dtMs);
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
}

function render() {
  fpsCounter++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = fpsCounter;
    fpsCounter = 0;
    lastFpsTime = now;
  }

  ctx.fillStyle = '#1c5f8a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  renderSeabedGrid(ctx, state, canvas.width, canvas.height);
  renderMound(ctx, state);

  if (state.ui.selectedTool.startsWith('build:') && input.mouse.inside && !state.ui.paused) {
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    renderBuildGhost(ctx, state, world.x, world.y, state.ui.selectedTool.slice('build:'.length));
  }

  for (const item of state.level.items) {
    const pos = worldToScreen(item.x, item.y, state.camera);
    if (pos.x < -20 || pos.x > canvas.width + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue; // cull offscreen
    ctx.beginPath();
    ctx.fillStyle = item.type === 'food' ? '#8bc34a' : item.type === 'waste' ? WASTE_COLOR : getCoinColor(item.value);
    ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
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

  for (const fish of state.level.entities) {
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

    drawFish(ctx, pos.x, pos.y, fish.speciesId, fish.stage, facing, fish.tailPhase, eyeDirection);

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
