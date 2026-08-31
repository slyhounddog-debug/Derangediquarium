// UI.js — shop panel, HUD, debug overlay. Reads state, writes only via
// explicit user actions (buy, toggle). Forbidden: no simulation logic —
// this module must never tick hunger, gravity, or timers itself.

import {
  SEABED_FLOOR_Y,
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
  NOTIFICATION_LOG_MAX,
  FISH_VANISH_DURATION_MS,
  BUILDING_FAMILIES,
  BUILDING_TYPES,
  FISH_MERGING_UNLOCK_COST,
  CLEANLINESS_MAX,
  CLEANLINESS_COLOR_CLEAN,
  CLEANLINESS_COLOR_DIRTY,
  GENE_SPLICING_TECH_ID,
  GENE_SPLICING_TANK_POINT_COST,
  PROCESSOR_STATS,
  AUTO_FEEDER_STATS,
  POWER_HISTORY_MAX,
  SCIENCE_LAB_UPGRADES,
  SCIENCE_LAB_UPGRADE_LIST,
  SPECIES_LIST,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings, loadLevel } from './Levels.js';
import { getFishPurchaseCost, effectiveFoodCapacity, countTankFood } from './Entities.js';
import { getTile, worldToTile, getBuildingCost, FAN_STATS } from './Grid.js';
import { worldToScreen } from './Engine.js';
import { centerCameraOnMound, canCrackMound, crackMound, getMoundNextCost, MOUND_X } from './Mound.js';
import { drawFish } from './FishRenderer.js';
import { playUpgrade, setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume, playPanelOpen, playPanelClose } from './Sound.js';

const MOUND_MENU_GAP_PX = 12; // screen px of breathing room between the popup's bottom edge and the Mound's top edge
const MOUND_MENU_TRANSITION_MS = 220; // must match #mound-menu's CSS transition duration
const LAB_MENU_TRANSITION_MS = 220; // must match #lab-modal's CSS transition duration — see openLabMenu/closeLabMenu below

// One-time story/tutorial notification — see state.level.tutorialFlags and
// CLAUDE.md's "Story & Tutorial Notifications" section. (First-fish-bought
// moved to Entities.js's trySpawnPurchasedFish, since buying is now a canvas
// click rather than a UI.js button handler.)
const FOUND_THE_CHAT_MESSAGE = 'You found the chat. Curiosity kills the fish.';

let els = null;
let currentPreviewSpecies = null; // species currently shown in the in-panel preview, if any
let currentPreviewBuilding = null; // building currently shown in the in-panel preview, if any — mutually exclusive with currentPreviewSpecies
let lastMoney = null; // previous frame's money, to detect gain vs spend for the flash animation
let lastCleanliness = null; // previous frame's cleanliness, same purpose
let notificationLogExpanded = false;
let lastRenderedNotificationCount = -1; // rebuild the log list only when it actually changes, not every frame
let lastPillNotificationCount = null; // separate from the above — tracks the pill's own bounce/shimmer trigger regardless of whether the log is expanded; null means "not yet initialized," so the very first real notification on page load doesn't bounce
let moundMenuOpen = false;
let moundMenuClosing = false; // true while the shrink-back transition is still playing, before it's actually hidden
let moundMenuCloseTimer = null;
let labMenuOpen = false;
let labMenuClosing = false;
let labMenuCloseTimer = null;
let powerGraphOpen = false; // the small rolling-graph popup under the electricity HUD readout — see #hud-power's click listener
// familyId -> currently-selected tile id within that family (see Config.js's
// BUILDING_FAMILIES) — reset to the highest-unlocked tier every time
// buildBuildPalette rebuilds (init, the U cheat key, a Mound crack), then
// only changed by re-clicking an already-selected family slot to cycle it.
let familySelectedTier = {};

// Preview canvas idle-swim animation state — runs its own rAF loop,
// independent of the game's fixed-timestep sim, since it's purely
// decorative and has nothing to do with simulation state.
let previewAnimHandle = null;
let previewTailPhase = 0;
let previewFacing = 1;
let previewFlipTimer = 0;
let previewLastFrameTime = null;

// A soft light sweep plays across every `.sheen-target` element on its own
// random 5-30s cycle — per direct request, applied broadly across the HUD/
// shop/panels (see index.html/UI.js for which elements carry the class).
// Each element gets its own independent setTimeout chain (not a single
// shared ticker) so they visibly glimmer out of sync with each other rather
// than all sweeping in lockstep. `dataset.sheenScheduled` guards against
// double-scheduling the same still-alive element across repeated
// scheduleSheenAll() calls (every shop/palette/panel rebuild calls it again
// for whatever's new); `el.isConnected` is what actually stops a chain once
// its element has been torn out by one of those same rebuilds (innerHTML =
// '' disconnects the old nodes, so their chains just quietly stop
// rescheduling themselves instead of needing explicit teardown).
const SHEEN_MIN_INTERVAL_MS = 5000;
const SHEEN_MAX_INTERVAL_MS = 30000;
function scheduleSheen(el) {
  if (!el || el.dataset.sheenScheduled) return;
  el.dataset.sheenScheduled = '1';
  const fire = () => {
    if (!el.isConnected) return;
    el.classList.remove('sheen-play');
    void el.offsetWidth; // forced reflow — restarts the CSS animation even if it's somehow still attached
    el.classList.add('sheen-play');
    setTimeout(fire, SHEEN_MIN_INTERVAL_MS + Math.random() * (SHEEN_MAX_INTERVAL_MS - SHEEN_MIN_INTERVAL_MS));
  };
  setTimeout(fire, SHEEN_MIN_INTERVAL_MS + Math.random() * (SHEEN_MAX_INTERVAL_MS - SHEEN_MIN_INTERVAL_MS));
}
function scheduleSheenAll() {
  document.querySelectorAll('.sheen-target').forEach(scheduleSheen);
}

export function initUI(state) {
  els = {
    hud: document.getElementById('hud'),
    money: document.getElementById('hud-money'),
    food: document.getElementById('hud-food'),
    cleanliness: document.getElementById('hud-cleanliness'),
    power: document.getElementById('hud-power'),
    powerGraph: document.getElementById('hud-power-graph'),
    powerGraphCanvas: document.getElementById('hud-power-graph-canvas'),
    shopPanel: document.getElementById('shop-panel'),
    shopCollapseBtn: document.getElementById('shop-collapse-btn'),
    shopMoney: document.getElementById('shop-money'),
    shopFood: document.getElementById('shop-food'),
    shopCleanliness: document.getElementById('shop-cleanliness'),
    shopPower: document.getElementById('shop-power'),
    shopGrid: document.getElementById('shop-species-grid'),
    previewEmpty: document.getElementById('shop-preview-empty'),
    previewContent: document.getElementById('shop-preview-content'),
    previewCanvas: document.getElementById('shop-preview-canvas'),
    previewName: document.getElementById('shop-preview-name'),
    previewDesc: document.getElementById('shop-preview-desc'),
    previewStats: document.getElementById('shop-preview-stats'),
    previewHint: document.getElementById('shop-preview-hint'),
    toolFoodBtn: document.getElementById('tool-food-btn'),
    toolDemolishBtn: document.getElementById('tool-demolish-btn'),
    toolMergeBtn: document.getElementById('tool-merge-btn'),
    buildToolGrid: document.getElementById('build-tool-grid'),
    toolTooltip: document.getElementById('tool-tooltip'),
    pauseOverlay: document.getElementById('pause-overlay'),
    pauseMenu: document.getElementById('pause-menu'),
    pauseMain: document.getElementById('pause-main'),
    pauseSettings: document.getElementById('pause-settings'),
    pauseResumeBtn: document.getElementById('pause-resume-btn'),
    pauseRestartBtn: document.getElementById('pause-restart-btn'),
    pauseSettingsBtn: document.getElementById('pause-settings-btn'),
    pauseSettingsBackBtn: document.getElementById('pause-settings-back-btn'),
    musicVolumeSlider: document.getElementById('music-volume-slider'),
    sfxVolumeSlider: document.getElementById('sfx-volume-slider'),
    debugOverlay: document.getElementById('debug-overlay'),
    debugLines: document.getElementById('debug-lines'),
    notificationLatest: document.getElementById('notification-latest'),
    notificationLog: document.getElementById('notification-log'),
    moundOverlay: document.getElementById('mound-overlay'),
    moundMenuAnchor: document.getElementById('mound-menu-anchor'),
    moundMenu: document.getElementById('mound-menu'),
    moundThrowBtn: document.getElementById('mound-throw-btn'),
    moundCancelBtn: document.getElementById('mound-cancel-btn'),
    labOverlay: document.getElementById('lab-overlay'),
    labModal: document.getElementById('lab-modal'),
    labScienceReadout: document.getElementById('lab-science-readout'),
    labCloseBtn: document.getElementById('lab-close-btn'),
    labTreeWrap: document.getElementById('lab-tree-wrap'),
    labTreeCanvas: document.getElementById('lab-tree-canvas'),
    labTreeColumns: document.getElementById('lab-tree-columns'),
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

  // Gene-Splicing moved to the Tank Upgrades panel (see buildTankPanel) — no
  // longer purchased here, per direct request ("unlocked through the tank
  // upgrades... instead of unlocked through mound tiers"). Every other
  // Science Lab purchase (Suckerfish, Electric Eel, every Electric/Advanced
  // building) is now data-driven off Config.js's SCIENCE_LAB_UPGRADES — see
  // buildLabTree/buyLabUpgrade below, which wire up all 8 node buttons at
  // once instead of one bespoke handler per building.
  els.labCloseBtn.addEventListener('click', () => closeLabMenu());
  els.labOverlay.addEventListener('click', (e) => {
    if (e.target === els.labOverlay) closeLabMenu();
  });

  els.notificationLatest.addEventListener('click', () => {
    notificationLogExpanded = !notificationLogExpanded;
    els.notificationLog.classList.toggle('hidden', !notificationLogExpanded);
    lastRenderedNotificationCount = -1; // force a rebuild next update so it's populated the instant it opens
    // Story trigger: the first time the log is ever CLOSED again (not
    // opened) — per direct request, so the player has actually read
    // whatever's in there before the "curiosity kills the fish" gag lands,
    // rather than firing the instant they open it. Only on the
    // expanded->collapsed transition, which can only happen after it's
    // been opened at least once already. See CLAUDE.md's "Story & Tutorial
    // Notifications".
    if (!notificationLogExpanded && !state.level.tutorialFlags.firstChatClosed) {
      state.level.tutorialFlags.firstChatClosed = true;
      const notifications = state.level.notifications;
      notifications.push({ id: notifications.length + 1, text: FOUND_THE_CHAT_MESSAGE, elapsed: state.level.elapsed });
      if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
      state.level.fishVanishTimer = FISH_VANISH_DURATION_MS; // every fish freezes + hides for a few seconds — see Entities.js's updateFishVanish and main.js's render()
    }
  });

  els.toolFoodBtn.addEventListener('click', () => {
    state.ui.selectedTool = 'food';
    updateToolbar(state);
  });
  els.toolDemolishBtn.addEventListener('click', () => {
    state.ui.selectedTool = 'demolish';
    updateToolbar(state);
  });
  // Merge tool (🧤) — combining/splicing fish now requires this to be
  // selected first, per direct request, instead of firing on any mousedown
  // that happened to land on an eligible fish regardless of tool.
  els.toolMergeBtn.addEventListener('click', () => {
    state.ui.selectedTool = 'merge';
    updateToolbar(state);
  });

  els.shopCollapseBtn.addEventListener('click', () => toggleShopCollapse(state));
  els.tankCollapseBtn.addEventListener('click', () => toggleTankPanel(state));

  els.pauseResumeBtn.addEventListener('click', () => closePauseMenu(state));
  els.pauseRestartBtn.addEventListener('click', () => restartLevel(state));
  els.pauseSettingsBtn.addEventListener('click', () => { showPauseSettings(); playPanelOpen(); });
  els.pauseSettingsBackBtn.addEventListener('click', () => { showPauseMain(); playPanelClose(); });
  els.pauseOverlay.addEventListener('click', (e) => {
    if (e.target === els.pauseOverlay) closePauseMenu(state); // clicked the backdrop, not the card
  });

  // Electricity readout — click toggles the rolling graph popup underneath
  // it (same dropdown-under-pill pattern #notification-log already uses).
  // #hud (and so #hud-power inside it) is only ever visible while the shop
  // is closed — see updateShopCollapse — so this is automatically only
  // clickable then, per direct request ("only when the shop is closed").
  // #shop-power is a plain, non-interactive readout.
  els.power.addEventListener('click', () => {
    powerGraphOpen = !powerGraphOpen;
    els.powerGraph.classList.toggle('hidden', !powerGraphOpen);
    if (powerGraphOpen) renderPowerGraph(state);
    (powerGraphOpen ? playPanelOpen : playPanelClose)();
  });

  els.musicVolumeSlider.value = String(Math.round(getMusicVolume() * 100));
  els.sfxVolumeSlider.value = String(Math.round(getSfxVolume() * 100));
  els.musicVolumeSlider.addEventListener('input', () => setMusicVolume(Number(els.musicVolumeSlider.value) / 100));
  els.sfxVolumeSlider.addEventListener('input', () => setSfxVolume(Number(els.sfxVolumeSlider.value) / 100));

  // Belt-and-suspenders alongside the defensive strip in updateShopCollapse:
  // clean up the flash class as soon as the animation actually finishes, so
  // it's never sitting there waiting to be accidentally replayed later.
  const clearFlashClass = (e) => e.target.classList.remove('flash-pickup', 'flash-spend');
  els.money.addEventListener('animationend', clearFlashClass);
  els.shopMoney.addEventListener('animationend', clearFlashClass);
  els.food.addEventListener('animationend', clearFlashClass);
  els.cleanliness.addEventListener('animationend', clearFlashClass);
  els.shopFood.addEventListener('animationend', clearFlashClass);
  els.shopCleanliness.addEventListener('animationend', clearFlashClass);

  // No Buy button any more — picking a species arms it as the active
  // click-tool (state.ui.selectedTool = 'fish:<id>'), exactly like picking a
  // building does, and main.js's click handler spends the cost and spawns it
  // at the clicked world point (Entities.js's trySpawnPurchasedFish). See
  // selectSpeciesForPreview below.

  updateToolbar(state);
  updateShopCollapse(state);
  updateTankPanelCollapse(state);
  buildShopPanel(state);
  buildBuildPalette(state);
  buildTankPanel(state);
  buildLabTree(state);
  scheduleSheenAll();
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
  (state.ui.shopCollapsed ? playPanelClose : playPanelOpen)();
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
  // #hud holds money/food/cleanliness together, and #shop-hud holds the
  // shop panel's own copies of all three, so all six need this.
  els.money.classList.remove('flash-pickup', 'flash-spend');
  els.food.classList.remove('flash-pickup', 'flash-spend');
  els.cleanliness.classList.remove('flash-pickup', 'flash-spend');
  els.shopMoney.classList.remove('flash-pickup', 'flash-spend');
  els.shopFood.classList.remove('flash-pickup', 'flash-spend');
  els.shopCleanliness.classList.remove('flash-pickup', 'flash-spend');
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
  (state.ui.tankPanelCollapsed ? playPanelClose : playPanelOpen)();
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
  if (state.ui.paused) {
    showPauseMain();
    playFlash(els.pauseMenu, 'bounce-play'); // reuses the generic flash-restart helper below purely for its remove-reflow-readd trick, not an actual flash class
    playPanelOpen();
  } else {
    playPanelClose();
  }
  els.pauseOverlay.classList.toggle('hidden', !state.ui.paused);
}

function closePauseMenu(state) {
  state.ui.paused = false;
  els.pauseOverlay.classList.add('hidden');
  playPanelClose();
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

// ---- Science Lab popup: a real branching tech tree ----
// Per direct request ("the science lab should look like a web of unlocks
// branching from the unlocks that are barring them before") — replaces the
// old small Mound-anchored flyout (which only ever had room for a flat
// button list) with a centered modal, the same dimmed-backdrop pattern
// #pause-overlay already uses, since a real node-link tree needs consistent
// screen space regardless of where the camera happens to be. Opened by
// main.js's click handler when isPointOnScienceLab(...) hits, once the
// Mound has fully shattered.
export function openLabMenu(state) {
  labMenuOpen = true;
  labMenuClosing = false;
  if (labMenuCloseTimer !== null) { clearTimeout(labMenuCloseTimer); labMenuCloseTimer = null; }
  els.labOverlay.classList.remove('hidden');
  refreshLabTree(state);
  els.labModal.classList.add('lab-modal-closed');
  void els.labModal.offsetWidth; // forced reflow — same retrigger trick every other one-shot transition in this file uses
  els.labModal.classList.remove('lab-modal-closed');
  playPanelOpen();
}

export function closeLabMenu() {
  if (!labMenuOpen) return;
  labMenuOpen = false;
  labMenuClosing = true;
  els.labModal.classList.add('lab-modal-closed');
  labMenuCloseTimer = setTimeout(() => {
    els.labOverlay.classList.add('hidden');
    labMenuClosing = false;
    labMenuCloseTimer = null;
  }, LAB_MENU_TRANSITION_MS);
  playPanelClose();
}

// Read by main.js's Escape handler, same reason isMoundMenuOpen is.
export function isLabMenuOpen() {
  return labMenuOpen;
}

// One dependency-depth per column — a node with no prerequisites is depth
// 0; a node's depth is always one more than the DEEPEST of its own
// prerequisites (not just the first), so a node requiring both a depth-0
// and a depth-1 prerequisite still lands in depth 2, never overlapping the
// column its deeper prerequisite occupies. Memoized since several nodes
// share prerequisites (electric_fan/electric_collector/electric_auto_feeder
// all require `eel`).
function labNodeDepth(id, memo) {
  if (memo[id] != null) return memo[id];
  const node = SCIENCE_LAB_UPGRADES[id];
  memo[id] = node.requires.length === 0 ? 0 : 1 + Math.max(...node.requires.map((r) => labNodeDepth(r, memo)));
  return memo[id];
}

let labNodeDepthMemo = {};
let labNodeButtons = {}; // id -> { btn, costEl }, rebuilt by buildLabTree, read by refreshLabTree/drawLabTreeConnectors

// Built once at init (mirrors buildTankPanel) — the tree's SHAPE (which
// node sits in which column) never changes at runtime, only each node's
// locked/affordable/purchased state does, so only refreshLabTree needs to
// re-run as state changes.
function buildLabTree(state) {
  els.labTreeColumns.innerHTML = '';
  labNodeButtons = {};
  labNodeDepthMemo = {};
  const depths = SCIENCE_LAB_UPGRADE_LIST.map((n) => labNodeDepth(n.id, labNodeDepthMemo));
  const maxDepth = Math.max(...depths);
  const columns = [];
  for (let d = 0; d <= maxDepth; d++) {
    const col = document.createElement('div');
    col.className = 'lab-tree-col';
    columns.push(col);
    els.labTreeColumns.appendChild(col);
  }
  for (const node of SCIENCE_LAB_UPGRADE_LIST) {
    const btn = document.createElement('button');
    btn.className = 'lab-node sheen-target';
    btn.dataset.nodeId = node.id;
    const nameEl = document.createElement('div');
    nameEl.className = 'lab-node-name';
    nameEl.textContent = `${node.icon} ${node.name}`;
    const costEl = document.createElement('div');
    costEl.className = 'lab-node-cost';
    btn.append(nameEl, costEl);
    btn.addEventListener('click', () => buyLabUpgrade(state, node.id));
    labNodeButtons[node.id] = { btn, costEl };
    columns[labNodeDepthMemo[node.id]].appendChild(btn);
  }
  refreshLabTree(state);
}

// Every Science Lab node spends BOTH Science and gold at once — a
// deliberate first in this game's economy, per direct request, tying the
// whole tree to two resources so it reads as the real end-goal sink.
function buyLabUpgrade(state, id) {
  const node = SCIENCE_LAB_UPGRADES[id];
  if (state.meta.labUpgradesPurchased.includes(id)) return;
  if (!node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r))) return;
  if (state.level.science < node.scienceCost || state.level.money < node.goldCost) return;
  state.level.science -= node.scienceCost;
  state.level.money -= node.goldCost;
  state.meta.labUpgradesPurchased.push(id);
  if (node.grants.species) {
    for (const sid of node.grants.species) {
      if (!state.meta.speciesUnlocked.includes(sid)) state.meta.speciesUnlocked.push(sid);
    }
  }
  if (node.grants.buildings) {
    for (const bid of node.grants.buildings) {
      if (!state.meta.buildingsUnlocked.includes(bid)) state.meta.buildingsUnlocked.push(bid);
    }
  }
  playUpgrade();
  refreshLabTree(state);
  refreshShopPanel(state);
}

// Re-checked every frame the popup is open (from updateHUD) — Science/money
// and every node's prerequisite state can all change while it's open.
function refreshLabTree(state) {
  const science = state.level.science;
  els.labScienceReadout.textContent = `🔬 ${science} · 💰 $${Math.floor(state.level.money)}`;
  for (const node of SCIENCE_LAB_UPGRADE_LIST) {
    const { btn, costEl } = labNodeButtons[node.id];
    const purchased = state.meta.labUpgradesPurchased.includes(node.id);
    const prereqsMet = node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r));
    btn.classList.toggle('purchased', purchased);
    btn.classList.toggle('locked', !purchased && !prereqsMet);
    if (purchased) {
      costEl.textContent = 'Unlocked ✓';
      btn.disabled = true;
    } else if (!prereqsMet) {
      costEl.textContent = 'Locked';
      btn.disabled = true;
    } else {
      costEl.textContent = `${node.scienceCost} 🔬 · $${node.goldCost}`;
      btn.disabled = science < node.scienceCost || state.level.money < node.goldCost;
    }
  }
  drawLabTreeConnectors(state);
}

// The "web" itself — one bezier connector per prerequisite edge, drawn on a
// canvas layered underneath the node buttons (so it never intercepts
// clicks). A node requiring two prerequisites (Electric Auto-Feeder needs
// both `eel` and `suckerfish`) gets two separate curves converging on it —
// per direct request, so it's visually obvious both are required, not a
// single merged line. An edge whose prerequisite is already purchased
// draws brighter/solid; still-locked edges draw faint/dashed.
function drawLabTreeConnectors(state) {
  const wrap = els.labTreeWrap;
  const canvas = els.labTreeCanvas;
  const w = wrap.scrollWidth;
  const h = wrap.scrollHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const wrapRect = wrap.getBoundingClientRect();

  for (const node of SCIENCE_LAB_UPGRADE_LIST) {
    if (!node.requires.length) continue;
    const toRect = labNodeButtons[node.id].btn.getBoundingClientRect();
    const toX = toRect.left - wrapRect.left + wrap.scrollLeft;
    const toY = toRect.top - wrapRect.top + wrap.scrollTop + toRect.height / 2;
    for (const reqId of node.requires) {
      const fromRect = labNodeButtons[reqId].btn.getBoundingClientRect();
      const fromX = fromRect.right - wrapRect.left + wrap.scrollLeft;
      const fromY = fromRect.top - wrapRect.top + wrap.scrollTop + fromRect.height / 2;
      const reqPurchased = state.meta.labUpgradesPurchased.includes(reqId);
      ctx.strokeStyle = reqPurchased ? 'rgba(122, 212, 168, 0.85)' : 'rgba(107, 76, 107, 0.3)';
      ctx.lineWidth = reqPurchased ? 3 : 2;
      ctx.setLineDash(reqPurchased ? [] : [5, 4]);
      const midX = (fromX + toX) / 2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.bezierCurveTo(midX, fromY, midX, toY, toX, toY);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
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

// Highlights whichever single shop selection is active — Food, Demolish, a
// species, or a building (family-grouped ones included). All of these live
// off the exact same state.ui.selectedTool string now, so setting it
// anywhere (a species click, a building click, a family cycle) implicitly
// deselects whatever else was previously armed — per direct request that
// only one shop selection should ever be active at a time, not a building
// AND a fish simultaneously. Food/Demolish also get their own small
// tooltip (a one-liner, no separate window needed); species/buildings show
// their info in the shared shop-preview window instead (see
// selectSpeciesForPreview/selectBuildingForPreview).
function updateToolbar(state) {
  const foodSelected = state.ui.selectedTool === 'food';
  const demolishSelected = state.ui.selectedTool === 'demolish';
  const mergeSelected = state.ui.selectedTool === 'merge';
  els.toolFoodBtn.classList.toggle('selected', foodSelected);
  els.toolDemolishBtn.classList.toggle('selected', demolishSelected);
  els.toolMergeBtn.classList.toggle('selected', mergeSelected);
  els.toolTooltip.classList.toggle('hidden', !foodSelected && !demolishSelected && !mergeSelected);
  if (foodSelected) els.toolTooltip.textContent = `Food $${FOOD_COST}`;
  else if (demolishSelected) els.toolTooltip.textContent = 'Click a building to remove it — full refund';
  else if (mergeSelected) els.toolTooltip.textContent = 'Drag one Adult fish onto a matching one to combine or splice it';

  for (const btn of els.buildToolGrid.children) {
    btn.classList.toggle('selected', state.ui.selectedTool === btn.dataset.tool);
  }
  for (const btn of els.shopGrid.children) {
    btn.classList.toggle('selected', state.ui.selectedTool === btn.dataset.tool);
  }
}

// familyId -> { btn, iconSpan, priceTag, dotsWrap, memberIds } for every
// family-grouped slot currently in the palette — lets refreshShopPrices
// update just the live price/current-tier display every frame the shop is
// open without rebuilding the whole palette. Rebuilt by buildBuildPalette.
let familyButtons = {};
// buildingId -> price-tag <span>, for every STANDALONE (non-family) building
// slot — same live-refresh purpose as speciesPriceTags below.
let buildingPriceTags = {};

// Syncs one family slot's icon/title/price/dataset.tool/dots to whichever
// tier familySelectedTier currently has it on. Called both right after a
// click (select or cycle) and every frame the shop is open (so its price
// tag stays live, same as every other dynamic cost in this panel).
function refreshFamilyButton(state, familyId) {
  const f = familyButtons[familyId];
  if (!f) return;
  const currentId = familySelectedTier[familyId];
  const building = BUILDING_TYPES[currentId];
  f.btn.title = building.name;
  f.btn.dataset.tool = `build:${currentId}`;
  f.btn.style.setProperty('--tile-color', building.color);
  f.iconSpan.textContent = building.icon;
  f.priceTag.textContent = `$${getBuildingCost(state, currentId)}`;
  f.dotsWrap.innerHTML = '';
  for (const id of f.memberIds) {
    const dot = document.createElement('span');
    if (id === currentId) dot.classList.add('current');
    f.dotsWrap.appendChild(dot);
  }
}

function buildFamilyButton(state, familyId, memberIds) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn tool-btn-build sheen-target';
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'tool-btn-family-dots';
  btn.appendChild(dotsWrap);
  const iconSpan = document.createElement('span');
  btn.appendChild(iconSpan);
  const priceTag = document.createElement('span');
  priceTag.className = 'building-icon-price';
  btn.appendChild(priceTag);
  familyButtons[familyId] = { btn, iconSpan, priceTag, dotsWrap, memberIds };

  btn.addEventListener('click', () => {
    const currentId = familySelectedTier[familyId];
    // Only cycle if this slot is already the active selection — a first
    // click just selects whatever tier it's currently defaulted to.
    if (state.ui.selectedTool === `build:${currentId}`) {
      const idx = memberIds.indexOf(currentId);
      familySelectedTier[familyId] = memberIds[(idx + 1) % memberIds.length];
    }
    refreshFamilyButton(state, familyId); // sync dataset.tool to the (possibly just-cycled) tier before selecting it
    selectBuildingForPreview(state, BUILDING_TYPES[familySelectedTier[familyId]]);
  });

  refreshFamilyButton(state, familyId);
  els.buildToolGrid.appendChild(btn);
}

function buildSingleBuildingButton(state, building) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn tool-btn-build sheen-target';
  btn.title = building.name;
  btn.textContent = building.icon;
  btn.dataset.tool = `build:${building.id}`;
  btn.style.setProperty('--tile-color', building.color);
  const priceTag = document.createElement('span');
  priceTag.className = 'building-icon-price';
  priceTag.textContent = `$${getBuildingCost(state, building.id)}`;
  btn.appendChild(priceTag);
  buildingPriceTags[building.id] = priceTag;
  btn.addEventListener('click', () => selectBuildingForPreview(state, building));
  els.buildToolGrid.appendChild(btn);
}

// Rebuilt whenever available buildings might have changed (init, U cheat
// key, a Mound crack) — same pattern as buildShopPanel/refreshShopPanel
// below. Buildings listed together in Config.js's BUILDING_FAMILIES (the 3
// Fan tiers) collapse into one slot each — per direct request, so higher
// tiers "stack" onto the same spot instead of each getting their own icon —
// defaulting to the highest currently-unlocked tier in that family every
// time this rebuilds (see refreshFamilyButton/buildFamilyButton above).
// Every other building keeps its own single, ungrouped slot, unchanged.
function buildBuildPalette(state) {
  els.buildToolGrid.innerHTML = '';
  familyButtons = {};
  buildingPriceTags = {};
  const available = getAvailableBuildings(state);
  const availableIds = new Set(available.map((b) => b.id));
  const familyOfBuilding = {};
  for (const [familyId, memberIds] of Object.entries(BUILDING_FAMILIES)) {
    for (const id of memberIds) familyOfBuilding[id] = familyId;
  }

  const renderedFamilies = new Set();
  for (const building of available) {
    const familyId = familyOfBuilding[building.id];
    if (!familyId) {
      buildSingleBuildingButton(state, building);
      continue;
    }
    if (renderedFamilies.has(familyId)) continue; // this family's one slot is already built
    renderedFamilies.add(familyId);
    const memberIds = BUILDING_FAMILIES[familyId].filter((id) => availableIds.has(id));
    familySelectedTier[familyId] = memberIds[memberIds.length - 1]; // highest-unlocked — BUILDING_FAMILIES lists tiers low-to-high
    buildFamilyButton(state, familyId, memberIds);
  }
  updateToolbar(state); // re-apply .selected to whichever button matches the current tool, if any survive this rebuild
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
  card.className = 'tank-upgrade-card sheen-target';
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

let tankCards = null; // { foodQuality, fishMovement, foodCapacity, fishMerging } — each { card, levelEl, descEl, buyBtn }

function buildTankPanel(state) {
  els.tankUpgradeList.innerHTML = '';
  const foodQuality = createUpgradeCard('Food Quality', '🍽️');
  const fishMovement = createUpgradeCard('Fish Movement', '🏊');
  const foodCapacity = createUpgradeCard('Food Capacity', '🧺');
  const fishMerging = createUpgradeCard('Fish Merging', '🧬');
  const geneSplicing = createUpgradeCard('Gene-Splicing', '🧪');
  tankCards = { foodQuality, fishMovement, foodCapacity, fishMerging, geneSplicing };

  // A one-time unlock, not a leveled ladder like the three above — per
  // direct request, drag-to-combine (Entities.js's isCombinableFish) is now
  // gated on this Tank Upgrade purchase instead of any Tier.
  fishMerging.buyBtn.addEventListener('click', () => {
    if (state.level.upgrades.fishMergingUnlocked) return;
    if (state.level.tankPoints.available < FISH_MERGING_UNLOCK_COST) return;
    state.level.tankPoints.available -= FISH_MERGING_UNLOCK_COST;
    state.level.upgrades.fishMergingUnlocked = true;
    playUpgrade();
    refreshTankPanel(state);
  });

  // Gene-Splicing (Entities.js's isSpliceSource/canSpliceFish/spliceFish) —
  // moved here from a Science Lab purchase, per direct request ("unlocked
  // through the tank upgrades for 5 tank points, instead of unlocked
  // through mound tiers"). Same one-time-unlock pattern as Fish Merging,
  // just writing into state.meta.techUnlocked instead of a level upgrade
  // flag, since that's the field Entities.js's isSpliceSource already reads.
  geneSplicing.buyBtn.addEventListener('click', () => {
    if (state.meta.techUnlocked.includes(GENE_SPLICING_TECH_ID)) return;
    if (state.level.tankPoints.available < GENE_SPLICING_TANK_POINT_COST) return;
    state.level.tankPoints.available -= GENE_SPLICING_TANK_POINT_COST;
    state.meta.techUnlocked.push(GENE_SPLICING_TECH_ID);
    // Every hybrid row also goes into speciesUnlocked here — not strictly
    // required for the splice interaction itself (isSpliceSource/
    // canSpliceFish never check a hybrid's own unlock status, only its
    // utility parent's), but keeps state.meta consistent with how a Mound
    // crack used to grant them, and is what a future shop/species-list
    // pass would read.
    for (const s of SPECIES_LIST) {
      if (s.parents && !state.meta.speciesUnlocked.includes(s.id)) state.meta.speciesUnlocked.push(s.id);
    }
    playUpgrade();
    refreshTankPanel(state);
  });

  foodQuality.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.foodQuality;
    if (level >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) return;
    const cost = FOOD_QUALITY_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.foodQuality += 1;
    playUpgrade();
    refreshTankPanel(state);
  });
  fishMovement.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.fishMovement;
    if (level >= FISH_MOVEMENT_UPGRADE_MAX_LEVEL) return;
    const cost = FISH_MOVEMENT_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.fishMovement += 1;
    playUpgrade();
    refreshTankPanel(state);
  });
  foodCapacity.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.foodCapacity;
    if (level >= FOOD_CAPACITY_UPGRADE_MAX_LEVEL) return;
    const cost = FOOD_CAPACITY_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.foodCapacity += 1;
    playUpgrade();
    refreshTankPanel(state);
  });

  els.tankUpgradeList.append(foodQuality.card, fishMovement.card, foodCapacity.card, fishMerging.card, geneSplicing.card);

  // Defensive Capabilities: shown per the design update's Phase 2 UI-shell
  // scope, but locked — there's no alien system to upgrade yet (Phase 5).
  const defensive = document.createElement('div');
  defensive.className = 'tank-upgrade-card locked sheen-target';
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
  const { foodQuality, fishMovement, foodCapacity, fishMerging, geneSplicing } = tankCards;
  const available = state.level.tankPoints.available;

  const fqLevel = state.level.upgrades.foodQuality;
  foodQuality.levelEl.textContent = `Level ${fqLevel} / ${FOOD_QUALITY_UPGRADE_MAX_LEVEL}`;
  foodQuality.descEl.innerHTML = describeFoodQualityLevel(fqLevel);
  if (fqLevel >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) {
    foodQuality.buyBtn.textContent = 'Maxed out';
    foodQuality.buyBtn.disabled = true;
  } else {
    const cost = FOOD_QUALITY_UPGRADE_COSTS[fqLevel];
    foodQuality.buyBtn.textContent = `${cost} 🏆`;
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
    fishMovement.buyBtn.textContent = `${cost} 🏆`;
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
    foodCapacity.buyBtn.textContent = `${cost} 🏆`;
    foodCapacity.buyBtn.disabled = available < cost;
  }

  const merged = state.level.upgrades.fishMergingUnlocked;
  fishMerging.levelEl.textContent = merged ? 'Unlocked' : 'Locked';
  fishMerging.descEl.textContent =
    'Lets you drag one Adult economy fish (Guppy/Dartfin/Blimpfish) onto another matching one to combine them into a bigger, shinier, more valuable fish.';
  if (merged) {
    fishMerging.buyBtn.textContent = 'Unlocked';
    fishMerging.buyBtn.disabled = true;
  } else {
    fishMerging.buyBtn.textContent = `Unlock — ${FISH_MERGING_UNLOCK_COST} 🏆`;
    fishMerging.buyBtn.disabled = available < FISH_MERGING_UNLOCK_COST;
  }

  const spliced = state.meta.techUnlocked.includes(GENE_SPLICING_TECH_ID);
  geneSplicing.levelEl.textContent = spliced ? 'Unlocked' : 'Locked';
  geneSplicing.descEl.textContent =
    'Lets you drag an Adult Suckerfish/Electric Eel/Science Octopus onto another Adult fish to splice a hybrid — no Mound progress needed.';
  if (spliced) {
    geneSplicing.buyBtn.textContent = 'Unlocked';
    geneSplicing.buyBtn.disabled = true;
  } else {
    geneSplicing.buyBtn.textContent = `Unlock — ${GENE_SPLICING_TANK_POINT_COST} 🏆`;
    geneSplicing.buyBtn.disabled = available < GENE_SPLICING_TANK_POINT_COST;
  }

  els.tankPointsDisplay.textContent = `🏆 ${available}`;
}

// Clicking a species icon populates this in-panel preview with its
// description and the actual Buy action — it doesn't buy directly. That
// way there's one obvious way to buy, not two (an icon and a per-row
// button that did the same thing), and no separate modal to open/close.
// Clicking a species icon arms it as the active click-tool (like a building
// — see main.js's click handler and Entities.js's trySpawnPurchasedFish) and
// populates this in-panel preview with its description — there's no
// separate Buy button/step any more, per direct request: one obvious way to
// place a fish (click in the tank), not two.
function selectSpeciesForPreview(state, species) {
  state.debug.selectedSpecies = species.id; // keeps the G debug key in sync with what's being previewed
  state.ui.selectedTool = `fish:${species.id}`;
  currentPreviewSpecies = species;
  currentPreviewBuilding = null;
  els.previewEmpty.classList.add('hidden');
  els.previewContent.classList.remove('hidden');
  els.previewHint.textContent = 'Click in the tank to place it';
  els.previewDesc.textContent = species.description;
  els.previewStats.classList.add('hidden'); // stats block is building-only — see buildingStatsHtml
  // Name/price text is set live in refreshPreviewInfo (called both here and
  // every frame from updateHUD) since an economy species' price is dynamic —
  // see Config.js's ECONOMY_FISH_COST_GROWTH_RATE.
  refreshPreviewInfo(state);
  startPreviewAnimation();
  updateToolbar(state);
}

// Buildings share the exact same preview window as species (same box, same
// name/description layout, same "click in the tank to place it" hint) — a
// building's cost is dynamic now too (see Config.js's BUILDING_COST_INCREMENT),
// so its name/price text is refreshed the same live way as a species'.
function selectBuildingForPreview(state, building) {
  currentPreviewBuilding = building;
  currentPreviewSpecies = null;
  stopPreviewAnimation(); // no idle-swim animation for a building — it's a static tile icon
  els.previewEmpty.classList.add('hidden');
  els.previewContent.classList.remove('hidden');
  els.previewHint.textContent = 'Click in the tank to place it';
  els.previewDesc.textContent = building.description;
  const statsHtml = buildingStatsHtml(building.id);
  els.previewStats.innerHTML = statsHtml;
  els.previewStats.classList.toggle('hidden', !statsHtml);
  refreshPreviewInfo(state);
  renderPreviewCanvas();
  state.ui.selectedTool = `build:${building.id}`;
  updateToolbar(state);
}

// Per direct request — clicking a Processor, Auto-Feeder, or Fan in the
// shop shows its real stats (processing speed, waste creation speed,
// electricity cost, range) instead of just the prose description. Each
// building type only shows the lines that actually apply to it — a Fan has
// no processing/waste stats, a Processor/Auto-Feeder has no range.
function buildingStatsHtml(buildingId) {
  const p = PROCESSOR_STATS[buildingId];
  if (p) {
    return (
      `<div class="building-stat">⏱️ Coin: <b>${p.coinMs / 1000}s</b></div>` +
      `<div class="building-stat">🔬 Science: <b>${p.scienceMs / 1000}s</b></div>` +
      `<div class="building-stat">💩 Waste: every <b>${p.wasteEveryMs / 1000}s</b> processing</div>` +
      `<div class="building-stat">⚡ <b>${p.powerCostPerSec}</b> mw/sec</div>`
    );
  }
  const a = AUTO_FEEDER_STATS[buildingId];
  if (a) {
    return (
      `<div class="building-stat">⏱️ Waste: <b>${a.wasteProcessMs / 1000}s</b> per load</div>` +
      `<div class="building-stat">💩 Needs: <b>${a.wasteRequired}</b> loads per Food</div>` +
      `<div class="building-stat">⚡ <b>${a.powerCostPerSec}</b> mw/sec</div>`
    );
  }
  const f = FAN_STATS[buildingId];
  if (f) {
    return (
      `<div class="building-stat">📏 Range: <b>${f.maxRange}px</b></div>` +
      `<div class="building-stat">⚡ <b>${f.powerCost}</b> mw/sec</div>`
    );
  }
  return '';
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

// Re-checked every frame (from updateHUD) so the name/price live-update if
// money changes, or an economy species'/a building's dynamic price shifts,
// while it happens to be previewed — see Config.js's
// ECONOMY_FISH_COST_GROWTH_RATE and BUILDING_COST_INCREMENT.
function refreshPreviewInfo(state) {
  if (currentPreviewSpecies) {
    els.previewName.textContent = `${currentPreviewSpecies.name} — $${getFishPurchaseCost(state, currentPreviewSpecies.id)}`;
  } else if (currentPreviewBuilding) {
    els.previewName.textContent = `${currentPreviewBuilding.name} — $${getBuildingCost(state, currentPreviewBuilding.id)}`;
  }
}

// speciesId -> price-tag <span>, populated by buildShopPanel — lets
// refreshShopPrices update just the price text every frame the shop is
// open (economy species' dynamic cost) without rebuilding the whole grid.
let speciesPriceTags = {};

function buildShopPanel(state) {
  els.shopGrid.innerHTML = '';
  speciesPriceTags = {};
  // Only the base 6 species are purchasable here — per direct request, a
  // Gene-Splicing hybrid (species.parents set) is never buyable directly,
  // only ever created by splicing two existing fish together (see
  // Entities.js's spliceFish). getAvailableSpecies still includes hybrids
  // in what it returns (state.meta.speciesUnlocked genuinely does unlock
  // them, for the splicing lookup itself to work), so this is purely a shop
  // UI filter, not an unlock-gate change.
  for (const species of getAvailableSpecies(state).filter((s) => !s.parents)) {
    const btn = document.createElement('button');
    btn.className = 'species-icon-btn sheen-target';
    btn.title = species.name;
    btn.dataset.tool = `fish:${species.id}`;
    btn.style.setProperty('--species-color', FISH_COLORS[species.id] || '#ffffff');

    const priceTag = document.createElement('span');
    priceTag.className = 'species-icon-price';
    priceTag.textContent = `$${getFishPurchaseCost(state, species.id)}`;
    btn.appendChild(priceTag);
    speciesPriceTags[species.id] = priceTag;

    btn.addEventListener('click', () => selectSpeciesForPreview(state, species));

    els.shopGrid.appendChild(btn);
  }
  updateToolbar(state); // re-apply .selected to whichever button matches the current tool, if any survive this rebuild
}

// Called every frame the shop is open (from updateHUD) — species/building
// costs can all shift live (economy species' population-based pricing,
// every building's placed-count-based pricing — see Config.js's
// ECONOMY_FISH_COST_GROWTH_RATE/BUILDING_COST_INCREMENT), so it's cheap
// enough to just refresh every visible tag's text rather than tracking which
// ones are actually dynamic separately.
function refreshShopPrices(state) {
  for (const speciesId in speciesPriceTags) {
    speciesPriceTags[speciesId].textContent = `$${getFishPurchaseCost(state, speciesId)}`;
  }
  for (const buildingId in buildingPriceTags) {
    buildingPriceTags[buildingId].textContent = `$${getBuildingCost(state, buildingId)}`;
  }
  for (const familyId in familyButtons) {
    refreshFamilyButton(state, familyId);
  }
}

// Called after state.meta.speciesUnlocked/buildingsUnlocked changes (e.g.
// the U cheat key) so newly unlocked species/buildings show up without a
// page reload.
export function refreshShopPanel(state) {
  buildShopPanel(state);
  buildBuildPalette(state);
  updateToolbar(state);
  scheduleSheenAll(); // picks up whatever newly-unlocked buttons this rebuild just created
}

// Restarts a CSS animation even if it's already playing (e.g. two quick
// purchases in a row) by removing the class, forcing a reflow, then
// re-adding it — simply re-adding an already-present class is a no-op.
// Shared by every HUD readout that flashes (money, food capacity,
// cleanliness), not just money any more, despite the generic name change
// from playMoneyFlash.
function playFlash(el, className) {
  el.classList.remove('flash-pickup', 'flash-spend', 'bounce-play');
  void el.offsetWidth;
  el.classList.add(className);
}

// Exported so main.js can trigger this specific case directly — placing
// food while already at the Food Capacity cap doesn't change any tracked
// value updateHUD could detect on its own (the attempt is simply refused),
// so unlike money/cleanliness this needs an explicit call at the point of
// failure rather than a value-comparison each frame.
export function flashFoodCapacity(state) {
  playFlash(state.ui.shopCollapsed ? els.food : els.shopFood, 'flash-spend');
}

// Bright blue at 100% cleanliness, fading to olive green (WASTE_COLOR's own
// hex — a dirty tank literally reads the color of what's dirtying it) at 0%
// — a straight per-channel RGB lerp, recomputed fresh every frame in
// updateHUD rather than cached, since cleanliness can move every tick.
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const CLEANLINESS_RGB_CLEAN = hexToRgb(CLEANLINESS_COLOR_CLEAN);
const CLEANLINESS_RGB_DIRTY = hexToRgb(CLEANLINESS_COLOR_DIRTY);
function cleanlinessColor(cleanliness) {
  const t = Math.max(0, Math.min(1, cleanliness / CLEANLINESS_MAX));
  const r = Math.round(CLEANLINESS_RGB_DIRTY.r + (CLEANLINESS_RGB_CLEAN.r - CLEANLINESS_RGB_DIRTY.r) * t);
  const g = Math.round(CLEANLINESS_RGB_DIRTY.g + (CLEANLINESS_RGB_CLEAN.g - CLEANLINESS_RGB_DIRTY.g) * t);
  const b = Math.round(CLEANLINESS_RGB_DIRTY.b + (CLEANLINESS_RGB_CLEAN.b - CLEANLINESS_RGB_DIRTY.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// Rolling one-minute (POWER_HISTORY_MAX samples, one per second) area/line
// graph of demand vs. accumulated supply — matches the game's own poppy
// pastel aesthetic (cream card, pink/blue accents) rather than a generic
// chart style. Redrawn only while the popup is actually open (from
// updateHUD, once per second when a new sample lands).
function renderPowerGraph(state) {
  const canvas = els.powerGraphCanvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const history = state.level.powerHistory;
  const maxVal = Math.max(1, ...history.map((s) => Math.max(s.demand, s.supply)));
  const padL = 4;
  const padR = 4;
  const padT = 6;
  const padB = 6;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const stepX = history.length > 1 ? plotW / (POWER_HISTORY_MAX - 1) : 0;
  const xForIndex = (i) => padL + (i + (POWER_HISTORY_MAX - history.length)) * stepX;
  const yForVal = (v) => padT + plotH - (v / maxVal) * plotH;

  // Supply (accumulated capacity) — a soft filled step-line, drawn first so
  // the demand line reads on top of it.
  if (history.length > 1) {
    ctx.beginPath();
    ctx.moveTo(xForIndex(0), yForVal(history[0].supply));
    for (let i = 1; i < history.length; i++) ctx.lineTo(xForIndex(i), yForVal(history[i].supply));
    ctx.strokeStyle = 'rgba(107, 76, 107, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Demand — the live accent line, filled underneath for an area-chart
    // read, with an emphasized dot on the most recent sample.
    ctx.beginPath();
    ctx.moveTo(xForIndex(0), yForVal(0));
    for (let i = 0; i < history.length; i++) ctx.lineTo(xForIndex(i), yForVal(history[i].demand));
    ctx.lineTo(xForIndex(history.length - 1), yForVal(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xForIndex(0), yForVal(history[0].demand));
    for (let i = 1; i < history.length; i++) ctx.lineTo(xForIndex(i), yForVal(history[i].demand));
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 2;
    ctx.stroke();

    const lastX = xForIndex(history.length - 1);
    const lastY = yForVal(history[history.length - 1].demand);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb020';
    ctx.fill();
  }
}

export function updateHUD(state) {
  const money = state.level.money;
  const moneyText = `💰 $${Math.floor(money)}`;
  els.money.textContent = moneyText;
  els.shopMoney.textContent = moneyText;
  const cleanliness = state.level.cleanliness;
  const cleanlinessText = `✨ ${Math.round(cleanliness)}%`;
  els.cleanliness.textContent = cleanlinessText;
  els.shopCleanliness.textContent = cleanlinessText;
  const cleanColor = cleanlinessColor(cleanliness);
  els.cleanliness.style.color = cleanColor;
  els.shopCleanliness.style.color = cleanColor;
  const foodText = `🍽️ ${countTankFood(state)}/${effectiveFoodCapacity(state)}`;
  els.food.textContent = foodText;
  els.shopFood.textContent = foodText;

  // Electricity — only shown at all once Electric Eel is unlocked, per
  // direct request. Text only updates once a real second, matching the
  // "updates every second" request exactly, since state.level.powerHistory
  // itself only gains a new entry once a second (see main.js's update()).
  const eelUnlocked = state.meta.speciesUnlocked.includes('electric_eel');
  els.power.classList.toggle('hidden', !eelUnlocked);
  els.shopPower.classList.toggle('hidden', !eelUnlocked);
  if (eelUnlocked) {
    const history = state.level.powerHistory;
    const last = history[history.length - 1];
    const powerText = last ? `⚡ ${last.demand}/${last.supply} mw` : '⚡ 0/0 mw';
    els.power.textContent = powerText;
    els.shopPower.textContent = powerText;
    if (powerGraphOpen) renderPowerGraph(state);
  } else if (powerGraphOpen) {
    powerGraphOpen = false;
    els.powerGraph.classList.add('hidden');
  }

  refreshPreviewInfo(state);
  if (!state.ui.shopCollapsed) refreshShopPrices(state);
  if (moundMenuOpen) refreshMoundThrowButton(state);
  if (moundMenuOpen || moundMenuClosing) updateMoundMenuPosition(state); // keeps tracking through the shrink-back so it doesn't jump right as it starts closing
  if (labMenuOpen) refreshLabTree(state); // no position-tracking needed any more — it's a centered modal now, not anchored to the Mound's screen position
  if (!state.ui.tankPanelCollapsed) refreshTankPanel(state);

  // The shop sits open most of the game now, so it carries its own copy of
  // every readout that flashes (money already did; food/cleanliness follow
  // the same pattern) — only flash whichever copy is actually visible right
  // now, since a display:none element doesn't run CSS animations at all and
  // would just leave the class stuck there unfired, waiting to wrongly
  // replay the next time the shop toggles.
  const shopOpen = !state.ui.shopCollapsed;
  if (lastMoney !== null && money !== lastMoney) {
    playFlash(shopOpen ? els.shopMoney : els.money, money > lastMoney ? 'flash-pickup' : 'flash-spend');
  }
  lastMoney = money;

  if (lastCleanliness !== null && cleanliness !== lastCleanliness) {
    playFlash(shopOpen ? els.shopCleanliness : els.cleanliness, cleanliness > lastCleanliness ? 'flash-pickup' : 'flash-spend');
  }
  lastCleanliness = cleanliness;
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

  // Bounce + shimmer the pill on every genuinely NEW message — per direct
  // request. lastPillNotificationCount starts null so the level's opening
  // "Welcome to the tank" line (already present before this first call)
  // doesn't trigger it on load; every real arrival after that does.
  if (lastPillNotificationCount !== null && notifications.length !== lastPillNotificationCount) {
    playFlash(els.notificationLatest, 'bounce-play');
    els.notificationLatest.classList.remove('sheen-play');
    void els.notificationLatest.offsetWidth;
    els.notificationLatest.classList.add('sheen-play');
  }
  lastPillNotificationCount = notifications.length;

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
