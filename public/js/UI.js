// UI.js — shop panel, HUD, debug overlay. Reads state, writes only via
// explicit user actions (buy, toggle). Forbidden: no simulation logic —
// this module must never tick hunger, gravity, or timers itself.

import {
  SEABED_FLOOR_Y,
  FISH_MIN_X,
  FISH_MAX_X,
  FISH_MIN_Y,
  FISH_MAX_Y,
  FISH_SPAWN_VIEW_INSET_FRACTION,
  FOOD_COST,
  FISH_COLORS,
  SHOP_PREVIEW_CANVAS_SIZE,
  SHOP_PREVIEW_TAIL_PHASE_RATE,
  SHOP_PREVIEW_FLIP_MIN_S,
  SHOP_PREVIEW_FLIP_MAX_S,
  MOUND_HEIGHT_PX,
  FOOD_QUALITY_UPGRADE_COSTS,
  FOOD_QUALITY_UPGRADE_MAX_LEVEL,
  FOOD_HUNGER_RELIEF_BY_LEVEL,
  FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL,
  FISH_MOVEMENT_UPGRADE_COSTS,
  FISH_MOVEMENT_UPGRADE_MAX_LEVEL,
  FISH_MOVEMENT_UPGRADE_SPEED_BONUS,
  FOOD_CAPACITY_UPGRADE_COSTS,
  FOOD_CAPACITY_UPGRADE_MAX_LEVEL,
  FOOD_CAPACITY_UPGRADE_INCREMENT,
  FOOD_MAX_ON_SCREEN_BASE,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings, loadLevel } from './Levels.js';
import { spawnFishCheat } from './Entities.js';
import { getTile, worldToTile } from './Grid.js';
import { worldToScreen } from './Engine.js';
import { centerCameraOnMound, canCrackMound, crackMound, getMoundNextCost, MOUND_X } from './Mound.js';
import { drawFish } from './FishRenderer.js';

const MOUND_MENU_GAP_PX = 12; // screen px of breathing room between the popup's bottom edge and the Mound's top edge
const MOUND_MENU_TRANSITION_MS = 220; // must match #mound-menu's CSS transition duration

let els = null;
let currentPreviewSpecies = null; // species currently shown in the in-panel preview, if any
let currentPreviewBuilding = null; // building currently shown in the in-panel preview, if any — mutually exclusive with currentPreviewSpecies
let lastMoney = null; // previous frame's money, to detect gain vs spend for the flash animation
let notificationLogExpanded = false;
let lastRenderedNotificationCount = -1; // rebuild the log list only when it actually changes, not every frame
let moundMenuOpen = false;
let moundMenuClosing = false; // true while the shrink-back transition is still playing, before it's actually hidden
let moundMenuCloseTimer = null;

// Preview canvas idle-swim animation state — runs its own rAF loop,
// independent of the game's fixed-timestep sim, since it's purely
// decorative and has nothing to do with simulation state.
let previewAnimHandle = null;
let previewTailPhase = 0;
let previewFacing = 1;
let previewFlipTimer = 0;
let previewLastFrameTime = null;

export function initUI(state) {
  els = {
    hud: document.getElementById('hud'),
    money: document.getElementById('hud-money'),
    cleanliness: document.getElementById('hud-cleanliness'),
    shopPanel: document.getElementById('shop-panel'),
    shopCollapseBtn: document.getElementById('shop-collapse-btn'),
    shopMoney: document.getElementById('shop-money'),
    shopGrid: document.getElementById('shop-species-grid'),
    previewEmpty: document.getElementById('shop-preview-empty'),
    previewContent: document.getElementById('shop-preview-content'),
    previewCanvas: document.getElementById('shop-preview-canvas'),
    previewName: document.getElementById('shop-preview-name'),
    previewDesc: document.getElementById('shop-preview-desc'),
    previewBuyBtn: document.getElementById('shop-preview-buy'),
    toolFoodBtn: document.getElementById('tool-food-btn'),
    buildToolGrid: document.getElementById('build-tool-grid'),
    toolTooltip: document.getElementById('tool-tooltip'),
    pauseOverlay: document.getElementById('pause-overlay'),
    pauseMain: document.getElementById('pause-main'),
    pauseSettings: document.getElementById('pause-settings'),
    pauseResumeBtn: document.getElementById('pause-resume-btn'),
    pauseRestartBtn: document.getElementById('pause-restart-btn'),
    pauseSettingsBtn: document.getElementById('pause-settings-btn'),
    pauseSettingsBackBtn: document.getElementById('pause-settings-back-btn'),
    debugOverlay: document.getElementById('debug-overlay'),
    debugLines: document.getElementById('debug-lines'),
    notificationLatest: document.getElementById('notification-latest'),
    notificationLog: document.getElementById('notification-log'),
    moundOverlay: document.getElementById('mound-overlay'),
    moundMenuAnchor: document.getElementById('mound-menu-anchor'),
    moundMenu: document.getElementById('mound-menu'),
    moundThrowBtn: document.getElementById('mound-throw-btn'),
    moundCancelBtn: document.getElementById('mound-cancel-btn'),
    tankPanel: document.getElementById('tank-panel'),
    tankCollapseBtn: document.getElementById('tank-collapse-btn'),
    tankPointsDisplay: document.getElementById('tank-points-display'),
    tankUpgradeList: document.getElementById('tank-upgrade-list'),
  };

  els.moundThrowBtn.addEventListener('click', () => {
    if (!canCrackMound(state)) return;
    crackMound(state);
    refreshShopPanel(state);
    closeMoundMenu();
  });
  els.moundCancelBtn.addEventListener('click', () => closeMoundMenu());
  els.moundOverlay.addEventListener('click', (e) => {
    if (e.target === els.moundOverlay) closeMoundMenu(); // clicked the backdrop, not the card
  });

  els.notificationLatest.addEventListener('click', () => {
    notificationLogExpanded = !notificationLogExpanded;
    els.notificationLog.classList.toggle('hidden', !notificationLogExpanded);
    lastRenderedNotificationCount = -1; // force a rebuild next update so it's populated the instant it opens
  });

  els.toolFoodBtn.addEventListener('click', () => {
    state.ui.selectedTool = 'food';
    updateToolbar(state);
  });

  els.shopCollapseBtn.addEventListener('click', () => toggleShopCollapse(state));
  els.tankCollapseBtn.addEventListener('click', () => toggleTankPanel(state));

  els.pauseResumeBtn.addEventListener('click', () => closePauseMenu(state));
  els.pauseRestartBtn.addEventListener('click', () => restartLevel(state));
  els.pauseSettingsBtn.addEventListener('click', showPauseSettings);
  els.pauseSettingsBackBtn.addEventListener('click', showPauseMain);
  els.pauseOverlay.addEventListener('click', (e) => {
    if (e.target === els.pauseOverlay) closePauseMenu(state); // clicked the backdrop, not the card
  });

  // Belt-and-suspenders alongside the defensive strip in updateShopCollapse:
  // clean up the flash class as soon as the animation actually finishes, so
  // it's never sitting there waiting to be accidentally replayed later.
  const clearFlashClass = (e) => e.target.classList.remove('money-flash-pickup', 'money-flash-spend');
  els.money.addEventListener('animationend', clearFlashClass);
  els.shopMoney.addEventListener('animationend', clearFlashClass);

  els.previewBuyBtn.addEventListener('click', () => {
    if (!currentPreviewSpecies || state.level.money < currentPreviewSpecies.cost) return;
    state.level.money -= currentPreviewSpecies.cost;
    const { x, y } = randomVisibleSpawnPoint(state);
    spawnFishCheat(state, currentPreviewSpecies.id, x, y, false);
    // Stays populated with the same species — buying several in a row
    // doesn't need re-clicking its icon each time.
  });

  updateToolbar(state);
  updateShopCollapse(state);
  updateTankPanelCollapse(state);
  buildShopPanel(state);
  buildBuildPalette(state);
  buildTankPanel(state);
}

// Called by the collapse button and the S hotkey (wired in main.js) alike,
// so both paths share one place that actually flips the state. Expanding
// the shop auto-collapses the Tank panel — they share the same on-screen
// slot (see the CSS comment on #shop-panel, #tank-panel), so at most one is
// ever expanded.
export function toggleShopCollapse(state) {
  state.ui.shopCollapsed = !state.ui.shopCollapsed;
  if (!state.ui.shopCollapsed) {
    state.ui.tankPanelCollapsed = true;
    updateTankPanelCollapse(state);
  }
  updateShopCollapse(state);
}

function updateShopCollapse(state) {
  els.shopPanel.classList.toggle('collapsed', state.ui.shopCollapsed);
  els.shopCollapseBtn.classList.toggle('panel-toggle-active', !state.ui.shopCollapsed); // which of the two toggle buttons is "pressed" needs to be obvious at a glance since both stay visible regardless of panel state
  els.hud.classList.toggle('hidden', !state.ui.shopCollapsed); // money lives in the shop panel while it's open
  // CSS animations don't run on a display:none element, and if the flash
  // class is still attached when it's redisplayed, the animation restarts
  // from scratch — so toggling the shop could replay a stale pickup/spend
  // flash that has nothing to do with this toggle. Strip it defensively on
  // every toggle rather than relying solely on it finishing naturally.
  els.money.classList.remove('money-flash-pickup', 'money-flash-spend');
  els.shopMoney.classList.remove('money-flash-pickup', 'money-flash-spend');
  // The preview canvas is invisible while collapsed — no point animating
  // it. Resume on expand if a species is already selected; a building
  // preview has no animation to resume, just redraw its static swatch.
  if (state.ui.shopCollapsed) stopPreviewAnimation();
  else if (currentPreviewSpecies) startPreviewAnimation();
  else if (currentPreviewBuilding) renderPreviewCanvas();
}

// Mirrors toggleShopCollapse/updateShopCollapse exactly, for the Tank
// Upgrades panel's own button and its P hotkey (wired in main.js).
export function toggleTankPanel(state) {
  state.ui.tankPanelCollapsed = !state.ui.tankPanelCollapsed;
  if (!state.ui.tankPanelCollapsed) {
    state.ui.shopCollapsed = true;
    updateShopCollapse(state);
  }
  updateTankPanelCollapse(state);
}

function updateTankPanelCollapse(state) {
  els.tankPanel.classList.toggle('collapsed', state.ui.tankPanelCollapsed);
  els.tankCollapseBtn.classList.toggle('panel-toggle-active', !state.ui.tankPanelCollapsed);
  if (!state.ui.tankPanelCollapsed) refreshTankPanel(state); // populate it fresh the moment it opens, not just on the next frame's updateHUD
}

// Called by the Escape key (wired in main.js) — toggles open/closed, always
// landing back on the main options (not mid-settings) when it opens.
// state.ui.paused also freezes the sim: main.js's update() checks it and
// skips simulating entirely while true, so the tank sits frozen behind it.
export function togglePauseMenu(state) {
  state.ui.paused = !state.ui.paused;
  if (state.ui.paused) showPauseMain();
  els.pauseOverlay.classList.toggle('hidden', !state.ui.paused);
}

function closePauseMenu(state) {
  state.ui.paused = false;
  els.pauseOverlay.classList.add('hidden');
}

// Opened by main.js's click handler when isPointOnMound(...) hits — replaces
// the Mound's old "crack immediately, or nudge a can't-afford notification"
// click behavior entirely with this popup, positioned right next to the
// Mound and flying out of it rather than a centered, dimmed modal. Doesn't
// freeze the sim (state.ui.paused) — it's a lightweight decision popup, not
// a full pause state, same as the shop staying live while open.
export function openMoundMenu(state) {
  moundMenuOpen = true;
  moundMenuClosing = false;
  if (moundMenuCloseTimer !== null) { clearTimeout(moundMenuCloseTimer); moundMenuCloseTimer = null; }
  els.moundOverlay.classList.remove('hidden');
  refreshMoundThrowButton(state);
  updateMoundMenuPosition(state); // position it correctly before the reveal so it doesn't flash at (0,0) first

  // Force it to start from the shrunk-down state, then strip that class off
  // on the next paint so the CSS transition actually animates the grow —
  // same forced-reflow trick playMoneyFlash uses to restart an animation.
  els.moundMenu.classList.add('mound-menu-closed');
  void els.moundMenu.offsetWidth;
  els.moundMenu.classList.remove('mound-menu-closed');
}

// Plays the shrink-back-into-the-Mound transition, then actually hides the
// overlay once it's finished (matching MOUND_MENU_TRANSITION_MS) instead of
// vanishing instantly.
export function closeMoundMenu() {
  if (!moundMenuOpen) return;
  moundMenuOpen = false;
  moundMenuClosing = true;
  els.moundMenu.classList.add('mound-menu-closed');
  moundMenuCloseTimer = setTimeout(() => {
    els.moundOverlay.classList.add('hidden');
    moundMenuClosing = false;
    moundMenuCloseTimer = null;
  }, MOUND_MENU_TRANSITION_MS);
}

// Read by main.js's Escape handler so Escape closes this popup first rather
// than opening the pause menu on top of it.
export function isMoundMenuOpen() {
  return moundMenuOpen;
}

// Tracks the Mound's live on-screen position so the popup stays glued to it
// even if the player pans the camera while it's open (nothing freezes
// panning just because this is up). Called every render frame it's open,
// from updateHUD.
function updateMoundMenuPosition(state) {
  const anchorWorld = { x: MOUND_X, y: SEABED_FLOOR_Y - MOUND_HEIGHT_PX };
  const screen = worldToScreen(anchorWorld.x, anchorWorld.y, state.camera);
  els.moundMenuAnchor.style.left = `${screen.x}px`;
  els.moundMenuAnchor.style.top = `${screen.y - MOUND_MENU_GAP_PX}px`;
}

// Re-checked every frame the popup is open (from updateHUD) so the button
// live-updates if money changes while the player is deciding — same pattern
// as refreshPreviewBuyButton.
function refreshMoundThrowButton(state) {
  const cost = getMoundNextCost(state);
  const affordable = state.level.money >= cost;
  els.moundThrowBtn.textContent = `$${cost}`;
  els.moundThrowBtn.disabled = !affordable;
}

function showPauseMain() {
  els.pauseMain.classList.remove('hidden');
  els.pauseSettings.classList.add('hidden');
}

function showPauseSettings() {
  els.pauseMain.classList.add('hidden');
  els.pauseSettings.classList.remove('hidden');
}

// Rebuilds state.level from scratch via the real level-load path (same one
// Phase 5's campaign flow will use) — wipes items/entities/money, leaves
// state.meta (persisted progress) untouched, per the meta/level split.
function restartLevel(state) {
  loadLevel(state, state.level.levelId);
  centerCameraOnMound(state.camera); // loadLevel resets camera.x to 0 — re-center on the Mound, same as the initial load
  refreshShopPanel(state);
  closePauseMenu(state);
}

// Highlights whichever click-tool is active. Food still gets its own small
// tooltip (just a price, no separate window needed for one line); buildings
// show their info in the shared shop-preview window instead (see
// selectBuildingForPreview) so this only needs to track the selected state.
function updateToolbar(state) {
  const foodSelected = state.ui.selectedTool === 'food';
  els.toolFoodBtn.classList.toggle('selected', foodSelected);
  els.toolTooltip.classList.toggle('hidden', !foodSelected);
  if (foodSelected) els.toolTooltip.textContent = `Food $${FOOD_COST}`;

  for (const btn of els.buildToolGrid.children) {
    btn.classList.toggle('selected', state.ui.selectedTool === btn.dataset.tool);
  }
}

// Rebuilt whenever available buildings might have changed (init, U cheat
// key) — same pattern as buildShopPanel/refreshShopPanel below.
function buildBuildPalette(state) {
  els.buildToolGrid.innerHTML = '';
  for (const building of getAvailableBuildings(state)) {
    const btn = document.createElement('button');
    btn.className = 'tool-btn tool-btn-build';
    btn.title = building.name;
    btn.textContent = building.icon;
    btn.dataset.tool = `build:${building.id}`;
    btn.style.setProperty('--tile-color', building.color);
    btn.addEventListener('click', () => selectBuildingForPreview(state, building));
    els.buildToolGrid.appendChild(btn);
  }
}

// Pure stat readouts, current level in red -> next level in green — no
// mention of design intent (no "deliberately reduced," "restores original,"
// etc.), just the numbers a level actually changes. Maxed out has no "next"
// to show, so it's just the current stats plain. Returned as HTML (not
// plain text) for the color spans — refreshTankPanel sets it via innerHTML;
// every value going in is a computed number, nothing user-supplied.
function describeFoodQualityLevel(level) {
  const relief = FOOD_HUNGER_RELIEF_BY_LEVEL[level];
  const sinkPct = Math.round(FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL * level * 100);
  if (level >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) {
    return `Food fills ${relief} hunger, sinks ${sinkPct}% slower.`;
  }
  const nextRelief = FOOD_HUNGER_RELIEF_BY_LEVEL[level + 1];
  const nextSinkPct = Math.round(FOOD_QUALITY_SINK_SPEED_REDUCTION_PER_LEVEL * (level + 1) * 100);
  return (
    `Food fills <span class="stat-current">${relief} hunger</span> → <span class="stat-next">${nextRelief} hunger</span>, ` +
    `sinks <span class="stat-current">${sinkPct}% slower</span> → <span class="stat-next">${nextSinkPct}% slower</span>.`
  );
}

function describeFishMovementLevel(level) {
  const speed = FISH_MOVEMENT_UPGRADE_SPEED_BONUS * level;
  if (level >= FISH_MOVEMENT_UPGRADE_MAX_LEVEL) {
    return `Swim speed +${speed} px/sec.`;
  }
  const nextSpeed = FISH_MOVEMENT_UPGRADE_SPEED_BONUS * (level + 1);
  return `Swim speed <span class="stat-current">+${speed} px/sec</span> → <span class="stat-next">+${nextSpeed} px/sec</span>.`;
}

function describeFoodCapacityLevel(level) {
  const cap = FOOD_MAX_ON_SCREEN_BASE + FOOD_CAPACITY_UPGRADE_INCREMENT * level;
  if (level >= FOOD_CAPACITY_UPGRADE_MAX_LEVEL) {
    return `Up to ${cap} food on screen at once.`;
  }
  const nextCap = cap + FOOD_CAPACITY_UPGRADE_INCREMENT;
  return `Up to <span class="stat-current">${cap} food</span> → <span class="stat-next">${nextCap} food</span> on screen at once.`;
}

// Builds a single card's DOM once and returns references to the parts that
// change over time (level readout, description, buy button) — refreshTankPanel
// mutates these in place every frame the panel's open, rather than rebuilding
// the whole list (which would fight the shop's own established rebuild-on-
// unlock-change pattern for no reason, since these three cards never change
// which ones exist, only their level/cost).
function createUpgradeCard(name, icon) {
  const card = document.createElement('div');
  card.className = 'tank-upgrade-card';
  const nameEl = document.createElement('div');
  nameEl.className = 'tank-upgrade-name';
  nameEl.textContent = `${icon} ${name}`;
  const levelEl = document.createElement('div');
  levelEl.className = 'tank-upgrade-level';
  const descEl = document.createElement('div');
  descEl.className = 'tank-upgrade-desc';
  const buyBtn = document.createElement('button');
  buyBtn.className = 'tank-upgrade-buy';
  card.append(nameEl, levelEl, descEl, buyBtn);
  return { card, levelEl, descEl, buyBtn };
}

let tankCards = null; // { foodQuality, fishMovement, foodCapacity } — each { card, levelEl, descEl, buyBtn }

function buildTankPanel(state) {
  els.tankUpgradeList.innerHTML = '';
  const foodQuality = createUpgradeCard('Food Quality', '🍽️');
  const fishMovement = createUpgradeCard('Fish Movement', '🏊');
  const foodCapacity = createUpgradeCard('Food Capacity', '🧺');
  tankCards = { foodQuality, fishMovement, foodCapacity };

  foodQuality.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.foodQuality;
    if (level >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) return;
    const cost = FOOD_QUALITY_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.foodQuality += 1;
    refreshTankPanel(state);
  });
  fishMovement.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.fishMovement;
    if (level >= FISH_MOVEMENT_UPGRADE_MAX_LEVEL) return;
    const cost = FISH_MOVEMENT_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.fishMovement += 1;
    refreshTankPanel(state);
  });
  foodCapacity.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.foodCapacity;
    if (level >= FOOD_CAPACITY_UPGRADE_MAX_LEVEL) return;
    const cost = FOOD_CAPACITY_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.foodCapacity += 1;
    refreshTankPanel(state);
  });

  els.tankUpgradeList.append(foodQuality.card, fishMovement.card, foodCapacity.card);

  // Defensive Capabilities: shown per the design update's Phase 2 UI-shell
  // scope, but locked — there's no alien system to upgrade yet (Phase 5).
  const defensive = document.createElement('div');
  defensive.className = 'tank-upgrade-card locked';
  defensive.innerHTML =
    '<div class="tank-upgrade-name">🛡️ Defensive Capabilities</div>' +
    '<div class="tank-upgrade-desc">Boosts click damage against invading aliens. Unlocks once alien waves do (a future update).</div>';
  els.tankUpgradeList.appendChild(defensive);

  refreshTankPanel(state);
}

// Re-checked every frame the panel is open (from updateHUD), same pattern
// as refreshPreviewBuyButton/refreshMoundThrowButton — level/cost/afford
// state can all change while the player has it open.
function refreshTankPanel(state) {
  if (!tankCards) return;
  const { foodQuality, fishMovement, foodCapacity } = tankCards;
  const available = state.level.tankPoints.available;

  const fqLevel = state.level.upgrades.foodQuality;
  foodQuality.levelEl.textContent = `Level ${fqLevel} / ${FOOD_QUALITY_UPGRADE_MAX_LEVEL}`;
  foodQuality.descEl.innerHTML = describeFoodQualityLevel(fqLevel);
  if (fqLevel >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) {
    foodQuality.buyBtn.textContent = 'Maxed out';
    foodQuality.buyBtn.disabled = true;
  } else {
    const cost = FOOD_QUALITY_UPGRADE_COSTS[fqLevel];
    foodQuality.buyBtn.textContent = `Buy Level ${fqLevel + 1} — ${cost} 🏆`;
    foodQuality.buyBtn.disabled = available < cost;
  }

  const fmLevel = state.level.upgrades.fishMovement;
  fishMovement.levelEl.textContent = `Level ${fmLevel} / ${FISH_MOVEMENT_UPGRADE_MAX_LEVEL}`;
  fishMovement.descEl.innerHTML = describeFishMovementLevel(fmLevel);
  if (fmLevel >= FISH_MOVEMENT_UPGRADE_MAX_LEVEL) {
    fishMovement.buyBtn.textContent = 'Maxed out';
    fishMovement.buyBtn.disabled = true;
  } else {
    const cost = FISH_MOVEMENT_UPGRADE_COSTS[fmLevel];
    fishMovement.buyBtn.textContent = `Buy Level ${fmLevel + 1} — ${cost} 🏆`;
    fishMovement.buyBtn.disabled = available < cost;
  }

  const fcLevel = state.level.upgrades.foodCapacity;
  foodCapacity.levelEl.textContent = `Level ${fcLevel} / ${FOOD_CAPACITY_UPGRADE_MAX_LEVEL}`;
  foodCapacity.descEl.innerHTML = describeFoodCapacityLevel(fcLevel);
  if (fcLevel >= FOOD_CAPACITY_UPGRADE_MAX_LEVEL) {
    foodCapacity.buyBtn.textContent = 'Maxed out';
    foodCapacity.buyBtn.disabled = true;
  } else {
    const cost = FOOD_CAPACITY_UPGRADE_COSTS[fcLevel];
    foodCapacity.buyBtn.textContent = `Buy Level ${fcLevel + 1} — ${cost} 🏆`;
    foodCapacity.buyBtn.disabled = available < cost;
  }

  els.tankPointsDisplay.textContent = `🏆 ${available}`;
}

// A purchased fish spawns somewhere actually visible right now — inset a
// bit from the current camera view's edges, clamped to the overall bounds
// fish are allowed to roam in — rather than "anywhere in the tank," which
// could land far off camera and look like the purchase did nothing.
function randomVisibleSpawnPoint(state) {
  const { x: camX, y: camY, viewWidth, viewHeight } = state.camera;
  const insetX = viewWidth * FISH_SPAWN_VIEW_INSET_FRACTION;
  const insetY = viewHeight * FISH_SPAWN_VIEW_INSET_FRACTION;
  const minX = Math.max(FISH_MIN_X, camX + insetX);
  const maxX = Math.min(FISH_MAX_X, camX + viewWidth - insetX);
  const minY = Math.max(FISH_MIN_Y, camY + insetY);
  const maxY = Math.min(FISH_MAX_Y, camY + viewHeight - insetY);
  return {
    x: minX + Math.random() * Math.max(0, maxX - minX),
    y: minY + Math.random() * Math.max(0, maxY - minY),
  };
}

// Clicking a species icon populates this in-panel preview with its
// description and the actual Buy action — it doesn't buy directly. That
// way there's one obvious way to buy, not two (an icon and a per-row
// button that did the same thing), and no separate modal to open/close.
function selectSpeciesForPreview(state, species) {
  state.debug.selectedSpecies = species.id; // keeps the G debug key in sync with what's being previewed
  currentPreviewSpecies = species;
  currentPreviewBuilding = null;
  els.previewEmpty.classList.add('hidden');
  els.previewContent.classList.remove('hidden');
  els.previewBuyBtn.classList.remove('hidden');
  els.previewName.textContent = `${species.name} — $${species.cost}`;
  els.previewDesc.textContent = species.description;
  refreshPreviewBuyButton(state);
  startPreviewAnimation();
}

// Buildings share the exact same preview window as species (same box, same
// name/description layout) — just no Buy button, since clicking a building
// icon arms it as the active build tool immediately rather than requiring a
// separate purchase step (cost is spent per-tile on placement instead).
function selectBuildingForPreview(state, building) {
  currentPreviewBuilding = building;
  currentPreviewSpecies = null;
  stopPreviewAnimation(); // no idle-swim animation for a building — it's a static tile icon
  els.previewEmpty.classList.add('hidden');
  els.previewContent.classList.remove('hidden');
  els.previewBuyBtn.classList.add('hidden');
  els.previewName.textContent = `${building.name} — $${building.cost}`;
  els.previewDesc.textContent = building.description;
  renderPreviewCanvas();
  state.ui.selectedTool = `build:${building.id}`;
  updateToolbar(state);
}

// A live, idling adult-stage fish (same drawFish the real tank uses)
// instead of a plain color swatch — tail wagging continuously, flipping
// which way it's "facing" at a random interval so it doesn't look frozen,
// even though it never actually moves from the center of the canvas.
function startPreviewAnimation() {
  if (previewAnimHandle !== null) return; // already running
  previewLastFrameTime = performance.now();
  previewFlipTimer = SHOP_PREVIEW_FLIP_MIN_S + Math.random() * (SHOP_PREVIEW_FLIP_MAX_S - SHOP_PREVIEW_FLIP_MIN_S);

  const tick = (now) => {
    const dt = Math.min(0.1, (now - previewLastFrameTime) / 1000); // clamp so a stalled tab doesn't jump the animation
    previewLastFrameTime = now;

    previewTailPhase = (previewTailPhase + SHOP_PREVIEW_TAIL_PHASE_RATE * dt) % (Math.PI * 2);
    previewFlipTimer -= dt;
    if (previewFlipTimer <= 0) {
      previewFacing *= -1;
      previewFlipTimer = SHOP_PREVIEW_FLIP_MIN_S + Math.random() * (SHOP_PREVIEW_FLIP_MAX_S - SHOP_PREVIEW_FLIP_MIN_S);
    }

    renderPreviewCanvas();
    previewAnimHandle = requestAnimationFrame(tick);
  };
  previewAnimHandle = requestAnimationFrame(tick);
}

function stopPreviewAnimation() {
  if (previewAnimHandle !== null) {
    cancelAnimationFrame(previewAnimHandle);
    previewAnimHandle = null;
  }
}

function renderPreviewCanvas() {
  const ctx = els.previewCanvas.getContext('2d');
  const c = SHOP_PREVIEW_CANVAS_SIZE / 2;
  ctx.clearRect(0, 0, SHOP_PREVIEW_CANVAS_SIZE, SHOP_PREVIEW_CANVAS_SIZE);
  if (currentPreviewSpecies) {
    const def = currentPreviewSpecies;
    const adultStage = def.growthStages.length - 1;
    const eyeDirection = { x: previewFacing, y: 0 }; // looks ahead in whichever direction it's "swimming"
    drawFish(ctx, c, c, def.id, adultStage, previewFacing, previewTailPhase, eyeDirection);
  } else if (currentPreviewBuilding) {
    // A static tile swatch (no idle animation) — matches the canvas's own
    // circular crop rather than a mismatched square peeking out past it.
    ctx.fillStyle = currentPreviewBuilding.color;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.round(SHOP_PREVIEW_CANVAS_SIZE * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentPreviewBuilding.icon, c, c + 1);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}

// Re-checked every frame (from updateHUD) so the button live-updates if
// money changes while a species happens to be previewed.
function refreshPreviewBuyButton(state) {
  if (!currentPreviewSpecies) return;
  const affordable = state.level.money >= currentPreviewSpecies.cost;
  els.previewBuyBtn.disabled = !affordable;
  els.previewBuyBtn.textContent = affordable ? 'Buy' : "Can't afford";
}

function buildShopPanel(state) {
  els.shopGrid.innerHTML = '';
  for (const species of getAvailableSpecies(state)) {
    const btn = document.createElement('button');
    btn.className = 'species-icon-btn';
    btn.title = species.name;
    btn.style.setProperty('--species-color', FISH_COLORS[species.id] || '#ffffff');
    if (state.debug.selectedSpecies === species.id) btn.classList.add('selected');

    const priceTag = document.createElement('span');
    priceTag.className = 'species-icon-price';
    priceTag.textContent = `$${species.cost}`;
    btn.appendChild(priceTag);

    btn.addEventListener('click', () => {
      for (const b of els.shopGrid.children) b.classList.remove('selected');
      btn.classList.add('selected');
      selectSpeciesForPreview(state, species);
    });

    els.shopGrid.appendChild(btn);
  }
}

// Called after state.meta.speciesUnlocked/buildingsUnlocked changes (e.g.
// the U cheat key) so newly unlocked species/buildings show up without a
// page reload.
export function refreshShopPanel(state) {
  buildShopPanel(state);
  buildBuildPalette(state);
  updateToolbar(state);
}

// Restarts a CSS animation even if it's already playing (e.g. two quick
// purchases in a row) by removing the class, forcing a reflow, then
// re-adding it — simply re-adding an already-present class is a no-op.
function playMoneyFlash(el, className) {
  el.classList.remove('money-flash-pickup', 'money-flash-spend');
  void el.offsetWidth;
  el.classList.add(className);
}

export function updateHUD(state) {
  const money = state.level.money;
  const moneyText = `💰 $${Math.floor(money)}`;
  els.money.textContent = moneyText;
  els.shopMoney.textContent = moneyText;
  els.cleanliness.textContent = `✨ ${Math.round(state.level.cleanliness)}%`;
  refreshPreviewBuyButton(state);
  if (moundMenuOpen) refreshMoundThrowButton(state);
  if (moundMenuOpen || moundMenuClosing) updateMoundMenuPosition(state); // keeps tracking through the shrink-back so it doesn't jump right as it starts closing
  if (!state.ui.tankPanelCollapsed) refreshTankPanel(state);

  if (lastMoney !== null && money !== lastMoney) {
    const className = money > lastMoney ? 'money-flash-pickup' : 'money-flash-spend';
    // Only flash whichever readout is actually visible right now — a
    // display:none element doesn't run CSS animations at all, so flashing
    // the hidden one would just leave the class stuck there unfired,
    // waiting to wrongly replay the next time the shop toggles.
    playMoneyFlash(state.ui.shopCollapsed ? els.money : els.shopMoney, className);
  }
  lastMoney = money;
}

export function updateDebugOverlay(state, stats) {
  els.debugOverlay.classList.toggle('hidden', !state.debug.overlayVisible);
  if (!state.debug.overlayVisible) return;

  const cursor = state.debug.cursorWorld;
  let tileUnderCursor = 'water';
  if (cursor.y >= SEABED_FLOOR_Y) {
    const { col, row } = worldToTile(cursor.x, cursor.y);
    const tile = getTile(state.level.grid, col, row);
    tileUnderCursor = tile === null ? 'out of bounds' : tile;
  }

  els.debugLines.textContent = [
    `FPS: ${stats.fps}`,
    `Sim steps/s: ${stats.stepsPerSec}`,
    `Entities: ${state.level.entities.length}`,
    `Items: ${state.level.items.length}`,
    `Items routed/min: ${stats.itemsRoutedPerMin} (${state.level.gridStats.itemsRoutedTotal} total)`,
    `Camera: ${Math.round(state.camera.x)}, ${Math.round(state.camera.y)}`,
    `Cursor world: ${Math.round(cursor.x)}, ${Math.round(cursor.y)}`,
    `Tile under cursor: ${tileUnderCursor}`,
    `Time scale: ${stats.timeScale}x`,
    `Selected species (G): ${state.debug.selectedSpecies}`,
    `Selected tool: ${state.ui.selectedTool}`,
    `Tier: ${state.level.tier} (N cracks the Mound free)`,
  ].join('\n');
}

// Latest notification always shows in the collapsed pill; the expanded log
// (click to toggle) lists recent messages newest-first. Only rebuilds the
// log's DOM when the notification count actually changed, not every frame.
export function updateNotificationTicker(state) {
  const notifications = state.level.notifications;
  const latest = notifications[notifications.length - 1];
  els.notificationLatest.textContent = latest ? latest.text : 'Welcome to the tank.';

  if (!notificationLogExpanded || notifications.length === lastRenderedNotificationCount) return;
  lastRenderedNotificationCount = notifications.length;
  els.notificationLog.innerHTML = '';
  for (let i = notifications.length - 1; i >= 0; i--) {
    const line = document.createElement('div');
    line.className = 'notification-line';
    line.textContent = notifications[i].text;
    els.notificationLog.appendChild(line);
  }
}
