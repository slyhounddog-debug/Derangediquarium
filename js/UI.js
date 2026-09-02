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
  NOTIFICATION_LOG_MAX,
  BUILDING_FAMILIES,
  BUILDING_TYPES,
  FISH_MERGING_UNLOCK_COST,
  CLEANLINESS_MAX,
  CLEANLINESS_COLOR_CLEAN,
  CLEANLINESS_COLOR_DIRTY,
  PROCESSOR_STATS,
  AUTO_FEEDER_STATS,
  POWER_HISTORY_MAX,
  SCIENCE_LAB_UPGRADES,
  SCIENCE_LAB_UPGRADE_LIST,
  COIN_CAP_BY_LEVEL,
  COIN_CAP_UPGRADE_COSTS,
  COIN_CAP_UPGRADE_MAX_LEVEL,
  SCIENCE_CAP_BY_LEVEL,
  WORLD_W,
  WORLD_H,
  TILE_SIZE,
  ALIEN_RADIUS,
  POST_ALIEN_TUTORIAL_MESSAGE,
  SPECIES,
  WASTE_POOP_INTERVAL_MS,
  FISH_SPEED_MULTIPLIER,
  GENE_SPLICING_LAB_ID,
  ALIEN_COUNTDOWN_START_MS,
  CAP_WARNING_THRESHOLD_FRACTION,
  TURRET_STATS,
  TILE_TURRET_WASTE,
  WASTE_TURRET_SHOTS_PER_WASTE,
  WASTE_TURRET_MAX_WASTE,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings, loadLevel } from './Levels.js';
import { getFishPurchaseCost, effectiveCoinCapacity, effectiveScienceCapacity, countTankItemsByType } from './Entities.js';
import { getTile, worldToTile, getBuildingCost, FAN_STATS, hasAnyBuildingPlaced, findNearestWasteTurretAndWaste } from './Grid.js';
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
const FOUND_THE_CHAT_MESSAGE = 'You found the chat, you curious little fish.';

let els = null;
let currentPreviewSpecies = null; // species currently shown in the in-panel preview, if any
let currentPreviewBuilding = null; // building currently shown in the in-panel preview, if any — mutually exclusive with currentPreviewSpecies
let lastMoney = null; // previous frame's money, to detect gain vs spend for the flash animation
let lastCleanliness = null; // previous frame's cleanliness, same purpose
let lastCoinCapCount = null; // previous frame's live coin count, to detect a rise for the shake-red cue below
let lastScienceCapCount = null; // same, for Science Bubbles
let notificationLogExpanded = false;
let lastRenderedNotificationCount = -1; // rebuild the log list only when it actually changes, not every frame
let lastPillNotificationCount = null; // separate from the above — tracks the pill's own bounce/shimmer trigger regardless of whether the log is expanded; null means "not yet initialized," so the very first real notification on page load doesn't bounce
let notificationUnread = false; // true from the moment a new message arrives until the player actually expands the log — see scheduleNotificationReminder below
let notificationReminderTimer = null;
let moundMenuOpen = false;
let moundMenuClosing = false; // true while the shrink-back transition is still playing, before it's actually hidden
let moundMenuCloseTimer = null;
let labMenuOpen = false;
let labMenuClosing = false;
let labMenuCloseTimer = null;
let labZoom = 1; // current --lab-zoom scale factor, reset to 1 every time the Lab is opened — see openLabMenu/setLabZoom
const LAB_ZOOM_MIN = 0.6;
const LAB_ZOOM_MAX = 1.6;
const LAB_ZOOM_STEP = 0.15;
let labPurchaseNodeId = null; // node id the confirmation modal is currently showing, if any — see openLabPurchaseModal/confirmLabPurchase
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

// Per direct request — while there's an unread notification (the pill has a
// message the player hasn't actually expanded the log to read yet), it
// bounces on its own every random 3-6 seconds as a reminder, not just once
// on arrival. Self-terminating: each firing checks notificationUnread again
// before bouncing and before rescheduling, so it stops on its own the tick
// after the log gets expanded (see the notificationLatest click handler)
// rather than needing an explicit cancel from that other call site.
const NOTIFICATION_REMINDER_MIN_MS = 3000;
const NOTIFICATION_REMINDER_MAX_MS = 6000;
function scheduleNotificationReminder() {
  if (notificationReminderTimer !== null) return; // already have one pending
  const delay = NOTIFICATION_REMINDER_MIN_MS + Math.random() * (NOTIFICATION_REMINDER_MAX_MS - NOTIFICATION_REMINDER_MIN_MS);
  notificationReminderTimer = setTimeout(() => {
    notificationReminderTimer = null;
    if (!notificationUnread) return;
    playFlash(els.notificationLatest, 'bounce-play');
    scheduleNotificationReminder();
  }, delay);
}

// Per direct request — "at the beginning, before the shop has been opened,
// have it bounce until it's opened for the first time." Same self-
// terminating setTimeout-chain shape as scheduleNotificationReminder above:
// each firing re-checks the flag before bouncing and before rescheduling, so
// it stops on its own the tick after the shop is first expanded (see
// toggleShopCollapse) rather than needing an explicit cancel from there.
let shopButtonReminderTimer = null;
// Halved per direct request ("have the shop bounce twice as often until
// it's opened for the first time") — was 3000/6000.
const SHOP_BUTTON_REMINDER_MIN_MS = 1500;
const SHOP_BUTTON_REMINDER_MAX_MS = 3000;
export function scheduleShopButtonReminder(state) {
  if (shopButtonReminderTimer !== null) return;
  const delay = SHOP_BUTTON_REMINDER_MIN_MS + Math.random() * (SHOP_BUTTON_REMINDER_MAX_MS - SHOP_BUTTON_REMINDER_MIN_MS);
  shopButtonReminderTimer = setTimeout(() => {
    shopButtonReminderTimer = null;
    if (state.level.tutorialFlags.firstShopOpened) return;
    playFlash(els.shopCollapseBtn, 'bounce-play');
    scheduleShopButtonReminder(state);
  }, delay);
}

export function initUI(state) {
  els = {
    hud: document.getElementById('hud'),
    money: document.getElementById('hud-money'),
    coinCap: document.getElementById('hud-coin-cap'),
    scienceCap: document.getElementById('hud-science-cap'),
    cleanliness: document.getElementById('hud-cleanliness'),
    power: document.getElementById('hud-power'),
    powerGraph: document.getElementById('hud-power-graph'),
    alienCountdown: document.getElementById('alien-countdown'),
    alienCountdownSeconds: document.getElementById('alien-countdown-seconds'),
    scrollHint: document.getElementById('scroll-hint'),
    pauseToggleBtn: document.getElementById('pause-toggle-btn'),
    buildLegend: document.getElementById('build-legend'),
    tutorialSkipLegend: document.getElementById('tutorial-skip-legend'),
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialText: document.getElementById('tutorial-text'),
    powerGraphCanvas: document.getElementById('hud-power-graph-canvas'),
    shopPanel: document.getElementById('shop-panel'),
    shopCollapseBtn: document.getElementById('shop-collapse-btn'),
    shopMoney: document.getElementById('shop-money'),
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
    labZoomInBtn: document.getElementById('lab-zoom-in-btn'),
    labZoomOutBtn: document.getElementById('lab-zoom-out-btn'),
    labCloseBtn: document.getElementById('lab-close-btn'),
    labTreeWrap: document.getElementById('lab-tree-wrap'),
    labTreeCanvas: document.getElementById('lab-tree-canvas'),
    labTreeColumns: document.getElementById('lab-tree-columns'),
    labPurchaseOverlay: document.getElementById('lab-purchase-overlay'),
    labPurchaseIcon: document.getElementById('lab-purchase-icon'),
    labPurchaseName: document.getElementById('lab-purchase-name'),
    labPurchaseDesc: document.getElementById('lab-purchase-desc'),
    labPurchaseStats: document.getElementById('lab-purchase-stats'),
    labPurchaseCost: document.getElementById('lab-purchase-cost'),
    labPurchaseCancelBtn: document.getElementById('lab-purchase-cancel-btn'),
    labPurchaseConfirmBtn: document.getElementById('lab-purchase-confirm-btn'),
    tankPanel: document.getElementById('tank-panel'),
    tankCollapseBtn: document.getElementById('tank-collapse-btn'),
    tankPointsDisplay: document.getElementById('tank-points-display'),
    tankUpgradeList: document.getElementById('tank-upgrade-list'),
    startOverlay: document.getElementById('start-overlay'),
    startPlayBtn: document.getElementById('start-play-btn'),
    startSettingsBtn: document.getElementById('start-settings-btn'),
    startHelpBtn: document.getElementById('start-help-btn'),
    startHelpOverlay: document.getElementById('start-help-overlay'),
    startHelpBackBtn: document.getElementById('start-help-back-btn'),
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
  els.labZoomInBtn.addEventListener('click', () => setLabZoom(state, labZoom + LAB_ZOOM_STEP));
  els.labZoomOutBtn.addEventListener('click', () => setLabZoom(state, labZoom - LAB_ZOOM_STEP));

  // Purchase confirmation modal, per direct request — clicking a lab node no
  // longer spends anything directly (see buildLabTree below), it opens this
  // instead; Confirm is the only path left that actually calls
  // buyLabUpgrade.
  els.labPurchaseCancelBtn.addEventListener('click', () => closeLabPurchaseModal());
  els.labPurchaseConfirmBtn.addEventListener('click', () => confirmLabPurchase(state));
  els.labPurchaseOverlay.addEventListener('click', (e) => {
    if (e.target === els.labPurchaseOverlay) closeLabPurchaseModal();
  });

  els.notificationLatest.addEventListener('click', () => {
    notificationLogExpanded = !notificationLogExpanded;
    els.notificationLog.classList.toggle('hidden', !notificationLogExpanded);
    lastRenderedNotificationCount = -1; // force a rebuild next update so it's populated the instant it opens
    // The player has now actually looked at the pill — stop the periodic
    // reminder bounce (see scheduleNotificationReminder below) regardless of
    // whether they immediately close the log again; only a genuinely NEW
    // message re-arms it.
    if (notificationLogExpanded) notificationUnread = false;
    // Story trigger: the first time the log is ever CLOSED again (not
    // opened) — per direct request, so the player has actually read
    // whatever's in there before this line lands, rather than firing the
    // instant they open it. Only on the expanded->collapsed transition,
    // which can only happen after it's been opened at least once already.
    // Per a later direct request, this used to also freeze/hide every fish
    // for a few seconds as a "curiosity kills the fish" gag — removed
    // entirely; it's just the one line now, no other effect. See
    // CLAUDE.md's "Story & Tutorial Notifications".
    if (!notificationLogExpanded && !state.level.tutorialFlags.firstChatClosed) {
      state.level.tutorialFlags.firstChatClosed = true;
      const notifications = state.level.notifications;
      notifications.push({ id: notifications.length + 1, text: FOUND_THE_CHAT_MESSAGE, elapsed: state.level.elapsed });
      if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
    }
  });

  els.toolFoodBtn.addEventListener('click', () => selectTool(state, 'food'));
  els.toolDemolishBtn.addEventListener('click', () => selectTool(state, 'demolish'));
  // Merge tool (🧤) — combining/splicing fish now requires this to be
  // selected first, per direct request, instead of firing on any mousedown
  // that happened to land on an eligible fish regardless of tool.
  els.toolMergeBtn.addEventListener('click', () => selectTool(state, 'merge'));

  els.shopCollapseBtn.addEventListener('click', () => {
    toggleShopCollapse(state);
    // Guided tutorials that stop on this exact button (game-start and
    // post-alien flows both open with "click the Shop") advance the moment
    // it's actually open — see advanceTutorialFlow.
    if (!state.ui.shopCollapsed) {
      advanceTutorialFlow(state, 'start', 'shop');
      advanceTutorialFlow(state, 'postalien', 'shop');
    }
  });
  els.tankCollapseBtn.addEventListener('click', () => {
    toggleTankPanel(state);
    if (!state.ui.tankPanelCollapsed) advanceTutorialFlow(state, 'tankpoint', 'tankbtn');
  });

  // Per direct request, the pause menu is opened by a dedicated circular
  // button now (top-right, below #hud, matching the Shop/Tank Upgrades
  // toggle style) instead of the Escape key — see main.js's keydown handler
  // for Escape's new job (cancelling an armed build/demolish/merge tool).
  els.pauseToggleBtn.addEventListener('click', () => togglePauseMenu(state));

  els.pauseResumeBtn.addEventListener('click', () => closePauseMenu(state));
  els.pauseRestartBtn.addEventListener('click', () => restartLevel(state));
  els.pauseSettingsBtn.addEventListener('click', () => { showPauseSettings(); playPanelOpen(); });
  els.pauseSettingsBackBtn.addEventListener('click', () => returnFromPauseSettings(state));
  els.pauseOverlay.addEventListener('click', (e) => {
    if (e.target !== els.pauseOverlay) return; // clicked the card, not the backdrop
    if (settingsOpenedFromStartScreen) returnFromPauseSettings(state);
    else closePauseMenu(state);
  });

  // Electricity readout — click toggles the rolling graph popup underneath
  // it (same dropdown-under-pill pattern #notification-log already uses).
  // #hud is always visible now (top-right, never hidden while a panel is
  // open — see updateHUD's own comment), so this is clickable at any time.
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
  els.cleanliness.addEventListener('animationend', clearFlashClass);
  els.coinCap.addEventListener('animationend', clearFlashClass);

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
  initLabTreeDrag(state);
  scheduleSheenAll();
}

// Closes whichever side panel (Shop or Tank Upgrades) is currently open —
// shared by opening the Science Lab, selecting a bottom-tool-bar tool (see
// openLabMenu/selectTool below), and main.js's Escape handler, per direct
// request: neither the Lab, an armed tool, nor Escape should have to
// compete with a panel left open behind it. No sound of its own — whatever
// triggered the close (opening the Lab, picking a tool, pressing Escape)
// already has its own feedback.
export function closeSidePanels(state) {
  if (!state.ui.shopCollapsed) { state.ui.shopCollapsed = true; updateShopCollapse(state); }
  if (!state.ui.tankPanelCollapsed) { state.ui.tankPanelCollapsed = true; updateTankPanelCollapse(state); }
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
    state.level.tutorialFlags.firstShopOpened = true; // stops scheduleShopButtonReminder's bounce for good, this playthrough
  }
  updateShopCollapse(state);
  (state.ui.shopCollapsed ? playPanelClose : playPanelOpen)();
}

function updateShopCollapse(state) {
  // Per direct request ("if a fish is selected and you close the shop, have
  // it deselect the fish and default to the food") — checked here, the one
  // place every close path (the toggle button/S hotkey, opening the Tank
  // panel, closeSidePanels) funnels through, rather than duplicated at each
  // call site. Idempotent: once deselected, selectedTool is 'food', so a
  // later call with the shop still collapsed is a no-op.
  if (state.ui.shopCollapsed && state.ui.selectedTool.startsWith('fish:')) {
    deselectShopSelection(state);
  }
  els.shopPanel.classList.toggle('collapsed', state.ui.shopCollapsed);
  els.shopCollapseBtn.classList.toggle('panel-toggle-active', !state.ui.shopCollapsed); // which of the two toggle buttons is "pressed" needs to be obvious at a glance since both stay visible regardless of panel state
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
  closeSidePanels(state); // per direct request — the Shop/Tank Upgrades panel shouldn't sit open behind the Lab
  els.labOverlay.classList.remove('hidden');
  // Reset zoom to the default every fresh open, then center the tree
  // VERTICALLY (not pinned to its top edge) — per direct request. Has to
  // happen after the overlay is actually unhidden (a display:none element
  // has no layout box, so scrollHeight/clientHeight would both read 0), and
  // before refreshLabTree so its own drawLabTreeConnectors call draws
  // against the final scroll position rather than the stale one.
  labZoom = 1;
  els.labTreeColumns.style.setProperty('--lab-zoom', '1');
  els.labTreeWrap.scrollLeft = 0;
  els.labTreeWrap.scrollTop = Math.max(0, (els.labTreeWrap.scrollHeight - els.labTreeWrap.clientHeight) / 2);
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
  closeLabPurchaseModal(); // don't leave the confirmation modal stranded on top of a closed/closing tree
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

// Read by main.js's Escape handler — checked AHEAD of isLabMenuOpen so
// Escape closes the confirmation modal first (it sits on top) rather than
// closing the whole tree out from under it.
export function isLabPurchaseModalOpen() {
  return labPurchaseNodeId !== null;
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

// Minimum pointer movement (px) before a mousedown-on-the-wrap counts as a
// drag rather than the start of a plain click on whatever's underneath it —
// below this, letting go still fires that element's own click (buying a
// node); at or above it, the drag wins and the click that mouseup would
// otherwise generate is swallowed (see the capture-phase 'click' listener
// below), so panning across a node button never also spends money on it.
const LAB_TREE_DRAG_THRESHOLD_PX = 6;
let labTreeDrag = null; // { startX, startY, startScrollLeft, startScrollTop, moved } while a drag is in progress, else null
let labTreeJustDragged = false; // true for exactly the one 'click' event immediately following a real drag

// Click-and-drag panning for the tree, per direct request ("the science lab
// tree can be clicked and dragged around, rather than scrolled horizontally
// and vertically on") — wired once at init (mirrors buildLabTree's own
// "built once, shape never changes" note), since this is pure event
// plumbing against the wrap element, not something that needs rebuilding
// whenever the tree's node set changes. #lab-tree-wrap's own CSS sets
// overflow:hidden (no native scrollbar/wheel-scroll), but scrollLeft/
// scrollTop remain fully readable and settable via JS — this just drives
// them from mouse movement instead of the browser's own scroll handling.
// A direct follow-up report clarified the mousedown listener needs to live
// on the whole modal, not just the tree's own wrap — "right now you have to
// specifically click the background in the science lab to be able to drag
// it," i.e. starting a drag from the header row or the padding around the
// tree (or a locked node) did nothing. Panning itself still only ever moves
// #lab-tree-wrap's own scrollLeft/scrollTop; only WHERE a drag is allowed to
// start moved outward.
function initLabTreeDrag(state) {
  const wrap = els.labTreeWrap;
  const modal = els.labModal;
  modal.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // left button only
    labTreeDrag = { startX: e.clientX, startY: e.clientY, startScrollLeft: wrap.scrollLeft, startScrollTop: wrap.scrollTop, moved: false };
  });
  // Listened on window, not the modal, so a drag that carries the cursor
  // outside the modal's own bounds keeps panning smoothly instead of
  // stalling out the instant the pointer crosses the edge.
  window.addEventListener('mousemove', (e) => {
    if (!labTreeDrag) return;
    const dx = e.clientX - labTreeDrag.startX;
    const dy = e.clientY - labTreeDrag.startY;
    if (!labTreeDrag.moved && Math.hypot(dx, dy) > LAB_TREE_DRAG_THRESHOLD_PX) {
      labTreeDrag.moved = true;
      modal.classList.add('dragging');
    }
    if (labTreeDrag.moved) {
      wrap.scrollLeft = labTreeDrag.startScrollLeft - dx;
      wrap.scrollTop = labTreeDrag.startScrollTop - dy;
      // Redraw the connector canvas live while panning — its bezier curves
      // are computed from each node button's current getBoundingClientRect(),
      // which moves as scrollLeft/scrollTop change, same as it already
      // redraws on every refreshLabTree call.
      drawLabTreeConnectors(state);
    }
  });
  window.addEventListener('mouseup', () => {
    if (labTreeDrag && labTreeDrag.moved) labTreeJustDragged = true;
    labTreeDrag = null;
    modal.classList.remove('dragging');
  });
  // Capture phase on WINDOW (not just the modal) so this runs before ANY
  // other click listener anywhere, including #lab-overlay's own
  // click-the-backdrop-to-close handler — swallows the synthetic click a
  // mouseup generates wherever the drag happened to end. This matters now
  // that dragging can start well inside the modal (e.g. the header) and, if
  // the gesture crosses back out over the dimmed backdrop before release,
  // the resulting click's target is #lab-overlay itself rather than
  // anything inside #lab-modal — a listener scoped to the modal wouldn't
  // even be in that click's propagation path, so the drag would silently
  // close the whole tree on release instead of just finishing the pan.
  // stopPropagation() here, called on window during the capture phase (the
  // very first stop on the event's path), keeps the event from ever
  // reaching its real target at all.
  window.addEventListener('click', (e) => {
    if (labTreeJustDragged) {
      e.stopPropagation();
      labTreeJustDragged = false;
    }
  }, true);

  // Zoom, per direct request ("make it so you can zoom in and out of the
  // science lab") — mouse wheel over the tree area itself, centered on the
  // cursor so whatever point you're hovering stays put as it scales. Scoped
  // to the wrap (not the whole modal, unlike dragging) since scrolling over
  // the header/close button has no natural meaning.
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? -1 : 1;
    setLabZoom(state, labZoom + dir * LAB_ZOOM_STEP, e.clientX, e.clientY);
  }, { passive: false });
}

// See style.css's comment on #lab-tree-columns for why this scales real
// box-model dimensions (a --lab-zoom custom property) instead of a
// transform: scale(). anchorClientX/Y (from a wheel event) keep whatever
// point was under the cursor visually stationary through the zoom step —
// content at zoom-space position `contentX` before the change lands at
// `contentX * (newZoom/oldZoom)` after, since every scaled dimension grows
// uniformly from the tree's own top-left origin; omitted (the +/- buttons),
// it just rescales in place from the current scroll position.
function setLabZoom(state, zoom, anchorClientX, anchorClientY) {
  const wrap = els.labTreeWrap;
  const oldZoom = labZoom;
  const newZoom = Math.min(LAB_ZOOM_MAX, Math.max(LAB_ZOOM_MIN, zoom));
  if (newZoom === oldZoom) return;
  let newScrollLeft = null;
  let newScrollTop = null;
  if (anchorClientX != null) {
    const wrapRect = wrap.getBoundingClientRect();
    const contentX = wrap.scrollLeft + (anchorClientX - wrapRect.left);
    const contentY = wrap.scrollTop + (anchorClientY - wrapRect.top);
    const ratio = newZoom / oldZoom;
    newScrollLeft = contentX * ratio - (anchorClientX - wrapRect.left);
    newScrollTop = contentY * ratio - (anchorClientY - wrapRect.top);
  }
  labZoom = newZoom;
  els.labTreeColumns.style.setProperty('--lab-zoom', String(labZoom));
  if (newScrollLeft !== null) {
    wrap.scrollLeft = newScrollLeft;
    wrap.scrollTop = newScrollTop;
  }
  drawLabTreeConnectors(state);
}

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
    // No longer buys directly on click — per direct request, opens the
    // confirmation modal instead (see openLabPurchaseModal below), which is
    // the only thing that still calls buyLabUpgrade. A disabled button
    // (locked or already purchased) never dispatches a click at all, so this
    // never opens for something that couldn't actually be bought.
    btn.addEventListener('click', () => openLabPurchaseModal(state, node.id));
    labNodeButtons[node.id] = { btn, costEl };
    columns[labNodeDepthMemo[node.id]].appendChild(btn);
  }
  refreshLabTree(state);
}

// Every Science Lab node spends BOTH Science and gold at once — a
// deliberate first in this game's economy, per direct request, tying the
// whole tree to two resources so it reads as the real end-goal sink. Only
// ever called from confirmLabPurchase now (see the purchase modal below) —
// clicking a node itself just opens that modal.
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
  // The Bubble Capacity chain (science_cap_1..5) grants this instead of a
  // species/building — see Config.js's SCIENCE_LAB_UPGRADES comment.
  if (node.grants.scienceCapLevel) {
    state.level.upgrades.scienceCapLevel += node.grants.scienceCapLevel;
  }
  playUpgrade();
  refreshLabTree(state);
  refreshShopPanel(state);
}

// ---- Lab purchase confirmation modal ----
// Per direct request ("I want to have a purchase modal pop up when in the
// science lab, so you have a chance to read what something does and confirm
// the purchase, instead of just clicking it... Have that purchase modal give
// the stats of the building/fish being unlocked"). Opened by a node's click
// handler above instead of buying immediately; Confirm is the only thing
// left that actually calls buyLabUpgrade.
function openLabPurchaseModal(state, id) {
  const node = SCIENCE_LAB_UPGRADES[id];
  labPurchaseNodeId = id;
  els.labPurchaseIcon.textContent = node.icon;
  els.labPurchaseName.textContent = node.name;
  els.labPurchaseCost.textContent = `${node.scienceCost} 🔬 · $${node.goldCost}`;
  refreshLabPurchaseButton(state);

  const descLines = [];
  const statChips = [];
  for (const sid of node.grants.species || []) {
    const s = SPECIES[sid];
    if (!s) continue;
    descLines.push(s.description);
    statChips.push(speciesStatsHtml(sid));
  }
  for (const bid of node.grants.buildings || []) {
    const b = BUILDING_TYPES[bid];
    if (!b) continue;
    descLines.push(b.description);
    statChips.push(buildingStatsHtml(bid));
  }
  if (node.grants.scienceCapLevel) {
    descLines.push('Raises the Science Bubble cap — how many can exist unbanked in the tank at once before an Octopus\'s brew is blocked.');
    const level = state.level.upgrades.scienceCapLevel;
    const from = SCIENCE_CAP_BY_LEVEL[level - 1] ?? SCIENCE_CAP_BY_LEVEL[0];
    const to = SCIENCE_CAP_BY_LEVEL[level] ?? from;
    statChips.push(`<div class="building-stat">🔬 Bubble cap: <b>${from} → ${to}</b></div>`);
  }
  if (!descLines.length) {
    // A pure prerequisite node (gene_splicing, the 3 hybrid "track" gates) —
    // grants nothing by itself, so describe what it opens up instead.
    descLines.push('Doesn\'t unlock anything by itself — it\'s a prerequisite for what comes next.');
    const unlocksHtml = labNodeUnlocksHtml(id);
    if (unlocksHtml) statChips.push(unlocksHtml);
  }
  els.labPurchaseDesc.innerHTML = descLines.map((t) => `<div>${t}</div>`).join('');
  els.labPurchaseStats.innerHTML = statChips.join('');
  els.labPurchaseOverlay.classList.remove('hidden');
  playPanelOpen();
}

export function closeLabPurchaseModal() {
  if (labPurchaseNodeId === null) return;
  labPurchaseNodeId = null;
  els.labPurchaseOverlay.classList.add('hidden');
  playPanelClose();
}

function confirmLabPurchase(state) {
  if (labPurchaseNodeId === null) return;
  const id = labPurchaseNodeId;
  closeLabPurchaseModal();
  buyLabUpgrade(state, id);
}

// Per direct request ("let me click all unlocked items in the science lab,
// even if I can't afford it, so I can read them... have the confirm grayed
// out if they can't afford it") — a node button itself is only ever
// disabled for being locked or already purchased (see refreshLabTree)
// now, never for being unaffordable, so it can always be opened to read.
// This is what actually enforces affordability: greys out Confirm instead.
// Called once when the modal opens and every frame afterward (from
// refreshLabTree, since Science/gold can keep changing while it's open —
// e.g. waiting on an Octopus's brew).
function refreshLabPurchaseButton(state) {
  const node = SCIENCE_LAB_UPGRADES[labPurchaseNodeId];
  const affordable = state.level.science >= node.scienceCost && state.level.money >= node.goldCost;
  els.labPurchaseConfirmBtn.disabled = !affordable;
}

// A fish's real stats, in the same compact chip format buildingStatsHtml
// below already uses for buildings — just the shared hunger/coin/waste
// economy stats (see fishEconomyStatsHtml). Shown identically in the shop
// preview (selectSpeciesForPreview) and the Science Lab purchase modal
// (openLabPurchaseModal). Per direct request ("too much small text in the
// shop... remove the Role stat line, and the Cost stat line for each fish,
// since there's other places it says the cost"), Role and Cost are gone —
// the live price already shows next to the fish's name (refreshPreviewInfo/
// getFishPurchaseCost), so repeating it here was redundant, and Role wasn't
// named as useful anywhere else this panel is shown.
function speciesStatsHtml(speciesId) {
  return fishEconomyStatsHtml(speciesId);
}

// Hunger (as food/min, not a raw hunger-points/sec rate — per direct
// request, "make the hunger stat make sense in terms of the amount of food
// they need per minute"), money/min, waste/min, and swim speed — the shared
// per-fish stats shown in both the shop preview and the Science Lab. Money
// and waste are BOTH per-minute (were per-second) — a per-second rate for
// either reads as an oddly tiny/precise number (a fraction of a cent, a
// hundredth of a waste item) next to hunger's own per-minute framing, so all
// three share the same time unit. Hunger uses the UNUPGRADED Food Quality
// relief amount (FOOD_HUNGER_RELIEF_BY_LEVEL[0]) as its baseline on purpose —
// like every other stat shown here (base cost, base speed), this is meant to
// be a fixed per-species comparison figure, not one that silently shifts as
// the player buys Food Quality/Fish Movement upgrades.
//
// Money/min applies to any species whose passive drop timer actually
// produces a coin — checked via `behavior.includes('FEEDER')`, NOT
// `dropType === 'coin'` (a real bug fixed here: a feeder-based hybrid like
// Scrub Guppy has `dropType: 'waste_cleared'`, describing its SECONDARY
// resource, even though it drops coins on its dropInterval same as any
// other Feeder — see Entities.js's updateFish, where the money branch is
// `else if (!isPureScavenger)` after the Researcher/Generator checks, which
// resolves to exactly "has the FEEDER tag" for every row in this table,
// since isPureScavenger/isPureGenerator/isPureResearcher each require the
// ABSENCE of FEEDER). Waste/min only applies to a non-Scavenger — a
// Scavenger consumes Waste instead of producing it, and Entities.js's own
// poop timer is gated on that exact same bare `behavior.includes('SCAVENGER')`
// check (not the narrower isPureScavenger used elsewhere for eating/coin-drop
// purposes), so this mirrors it exactly rather than guessing at a different
// rule.
function fishEconomyStatsHtml(speciesId) {
  const s = SPECIES[speciesId];
  if (!s) return '';
  const baby = s.growthStages[0];
  const adult = s.growthStages[s.growthStages.length - 1];
  const foodPerMin = (s.hungerRate * 60) / FOOD_HUNGER_RELIEF_BY_LEVEL[0];
  let html = `<div class="building-stat">🍽️ Hunger: <b>${foodPerMin.toFixed(1)} food/min</b></div>`;
  if (s.behavior.includes('FEEDER') && adult.dropValue) {
    // Shown as a baby -> adult range, not just the adult figure — per direct
    // request. Every stage now shares the same dropInterval (see Config.js's
    // Guppy/Dartfin/Blimpfish growthStages — "fish spawn coins at the same
    // rate as adult"), so the range comes entirely from each stage's own
    // dropValue; babyMoneyPerMin still divides by baby's own dropInterval
    // rather than assuming it equals adult's, so this stays correct even if
    // that ever changes again.
    const babyMoneyPerMin = (baby.dropValue / baby.dropInterval) * 60000;
    const adultMoneyPerMin = (adult.dropValue / adult.dropInterval) * 60000;
    // Rounded to the nearest whole dollar now, per direct request — was
    // toFixed(1) (nearest tenth) before that, toFixed(2) before that; a
    // dollar range doesn't need fractional-cent precision to be useful.
    html += `<div class="building-stat">🪙 Money: <b>$${Math.round(babyMoneyPerMin)} - $${Math.round(adultMoneyPerMin)}/min</b></div>`;
  }
  if (!s.behavior.includes('SCAVENGER')) {
    // Real bug fix: this used to read the flat global WASTE_POOP_INTERVAL_MS
    // directly, so every species showed the exact same waste/min regardless
    // of its own per-species multiplier (Dartfin 10% slower, Blimpfish 5%
    // faster than Guppy — see Config.js's wastePoopIntervalMultiplier and
    // Entities.js's updateFish, which already applies it correctly for the
    // actual poop timer; only this display-side stat had drifted out of
    // sync with it).
    const wastePerMin = 60000 / (WASTE_POOP_INTERVAL_MS * (s.wastePoopIntervalMultiplier || 1));
    html += `<div class="building-stat">💩 Waste: <b>${wastePerMin.toFixed(1)}/min</b></div>`; // nearest tenth, per direct request — see the Money line's own comment
  }
  // Per direct request ("add in the fish speed stat"). The base swimSpeed
  // times the flat game-wide multiplier — deliberately NOT the live
  // effectiveSwimSpeed (which also folds in the player's current Fish
  // Movement Tank Upgrade level), for the same "fixed comparison figure"
  // reason every other stat here uses a baseline value.
  html += `<div class="building-stat">🏊 Speed: <b>${Math.round(s.swimSpeed * FISH_SPEED_MULTIPLIER)}px/s</b></div>`;
  return html;
}

// What a pure-prerequisite node (no grants of its own) actually opens up —
// every other node whose own `requires` lists it, so a locked-behind-this
// purchase still reads as meaningful rather than a dead end.
function labNodeUnlocksHtml(id) {
  const dependents = SCIENCE_LAB_UPGRADE_LIST.filter((n) => n.requires.includes(id));
  if (!dependents.length) return '';
  return `<div class="building-stat">🔓 Unlocks: <b>${dependents.map((d) => d.name).join(', ')}</b></div>`;
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
    const affordable = science >= node.scienceCost && state.level.money >= node.goldCost;
    btn.classList.toggle('purchased', purchased);
    btn.classList.toggle('locked', !purchased && !prereqsMet);
    // Per direct request, an unlocked-but-unaffordable node stays CLICKABLE
    // ("let me click all unlocked items... so I can read them... any
    // unlocked ones should be able to be clicked") — only `purchased` and
    // `!prereqsMet` actually disable the button below; unaffordable just
    // dims it a touch via this class, and it's the purchase modal's OWN
    // Confirm button that's actually greyed out (see
    // openLabPurchaseModal/refreshLabPurchaseButton).
    btn.classList.toggle('unaffordable', !purchased && prereqsMet && !affordable);
    if (purchased) {
      costEl.textContent = 'Unlocked ✓';
      btn.disabled = true;
    } else if (!prereqsMet) {
      costEl.textContent = 'Locked';
      btn.disabled = true;
    } else {
      costEl.textContent = `${node.scienceCost} 🔬 · $${node.goldCost}`;
      btn.disabled = false;
    }
  }
  drawLabTreeConnectors(state);
  if (labPurchaseNodeId !== null) refreshLabPurchaseButton(state); // Science/gold can keep changing while the confirmation modal sits open
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

// True for exactly as long as the pause overlay's Settings sub-view is
// showing because the START screen opened it (see initStartScreen below),
// not because the player actually paused a running game — read by the
// shared "Back"/backdrop-click handling right above so it returns to the
// start screen instead of resuming gameplay that was never running.
let settingsOpenedFromStartScreen = false;

// Shared by the pause-settings Back button and a backdrop click alike (see
// the click wiring above) — per direct request, the start screen's Settings
// button opens this EXACT same sub-view (not a second copy of the sliders),
// so where "Back" goes depends on which door it was opened through.
function returnFromPauseSettings(state) {
  if (settingsOpenedFromStartScreen) {
    settingsOpenedFromStartScreen = false;
    els.pauseOverlay.classList.add('hidden'); // #start-overlay was never hidden underneath it — nothing more to restore
    playPanelClose();
    return;
  }
  showPauseMain();
  playPanelClose();
}

// ---- Start screen (first-launch menu) ----
// Shown on load, ahead of everything else — see index.html's #start-overlay
// and CSS's backdrop-filter blur. `onStart` is main.js's own callback
// (kicks off the splash animation and un-gates the sim loop) — UI.js
// doesn't reach into main.js directly, same one-directional import
// discipline every other main.js/UI.js hookup in this file already follows.
export function initStartScreen(state, onStart) {
  els.startPlayBtn.addEventListener('click', () => {
    els.startOverlay.classList.add('hidden');
    playPanelClose();
    onStart();
  });
  els.startSettingsBtn.addEventListener('click', () => {
    // Deliberately does NOT hide #start-overlay — #pause-overlay layers on
    // top of it instead (see its own z-index comment), so the start
    // screen's blurred/dimmed backdrop keeps covering the game (and the
    // not-yet-triggered splash) the whole time, exactly as it already does
    // for the start screen's own buttons.
    settingsOpenedFromStartScreen = true;
    els.pauseOverlay.classList.remove('hidden');
    showPauseSettings();
    playPanelOpen();
  });
  els.startHelpBtn.addEventListener('click', () => {
    els.startOverlay.classList.add('hidden');
    els.startHelpOverlay.classList.remove('hidden');
    playPanelOpen();
  });
  els.startHelpBackBtn.addEventListener('click', () => {
    els.startHelpOverlay.classList.add('hidden');
    els.startOverlay.classList.remove('hidden');
    playPanelClose();
  });
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
// Shared by the bottom tool-bar's own click handlers above and main.js's
// 1/2/3 hotkeys (see main.js's keydownHandlers) — one place that actually
// sets the tool so both paths stay in sync.
// Per direct request: Demolish is meaningless with nothing built yet, and
// Merge is meaningless until either combining or splicing is actually
// unlocked — both stay grayed out (and genuinely unusable, not just dimmed)
// until then. Also unavailable for the entire duration of any guided
// tutorial flow — per direct report, a stray Demolish/Merge selection
// mid-flow (there's nothing stopping a click from reaching the bottom
// tool-bar during a noSpotlight step like the post-alien flow's "scroll,"
// which hides the whole overlay) could strand the player on the wrong tool
// with no way for a later step's own click to ever succeed. Exported so
// main.js's 1/2/3 hotkeys can check before calling selectTool at all.
export function isDemolishToolAvailable(state) {
  return hasAnyBuildingPlaced(state) && !state.level.tutorialFlow;
}
export function isMergeToolAvailable(state) {
  return (state.level.upgrades.fishMergingUnlocked || state.meta.labUpgradesPurchased.includes(GENE_SPLICING_LAB_ID)) && !state.level.tutorialFlow;
}

export function selectTool(state, tool) {
  if (tool === 'demolish' && !isDemolishToolAvailable(state)) return;
  if (tool === 'merge' && !isMergeToolAvailable(state)) return;
  state.ui.selectedTool = tool;
  closeSidePanels(state); // per direct request — picking a bottom-tool-bar tool (Food/Demolish/Merge) closes the Shop/Tank Upgrades panel if it's open
  updateToolbar(state);
}

// Called by the Escape key (main.js) — per direct request, replacing the old
// "Escape opens the pause menu" behavior (see the new #pause-toggle-btn
// button instead): cancels an actively-armed build/demolish/merge tool and
// defaults back to Food. A no-op while Food (or a fish) is selected — Escape
// was only asked to cancel these three. Building selection reuses
// deselectShopSelection so its preview window clears too, exactly like
// clicking the same building icon a second time already does; Demolish/
// Merge have no preview to clear, just the tool itself.
export function cancelActiveTool(state) {
  const tool = state.ui.selectedTool;
  if (tool.startsWith('build:')) {
    deselectShopSelection(state);
  } else if (tool === 'demolish' || tool === 'merge') {
    state.ui.selectedTool = 'food';
    updateToolbar(state);
  }
}

function updateToolbar(state) {
  // Grayed-out + genuinely disabled until there's something to demolish /
  // merging or splicing is unlocked — re-checked every frame (called from
  // updateHUD) so a building placed/removed or an upgrade just bought takes
  // effect immediately, not just the next time a tool happens to be picked.
  // Resolved BEFORE reading state.ui.selectedTool below, so if the
  // currently-selected tool just became unavailable (e.g. the last building
  // was demolished while Demolish was still selected), the fallback to Food
  // is reflected consistently in every class toggle that follows, not just
  // the build/shop grids.
  const demolishAvailable = isDemolishToolAvailable(state);
  const mergeAvailable = isMergeToolAvailable(state);
  els.toolDemolishBtn.disabled = !demolishAvailable;
  els.toolMergeBtn.disabled = !mergeAvailable;
  if (state.ui.selectedTool === 'demolish' && !demolishAvailable) state.ui.selectedTool = 'food';
  if (state.ui.selectedTool === 'merge' && !mergeAvailable) state.ui.selectedTool = 'food';

  const foodSelected = state.ui.selectedTool === 'food';
  const demolishSelected = state.ui.selectedTool === 'demolish';
  const mergeSelected = state.ui.selectedTool === 'merge';
  els.toolFoodBtn.classList.toggle('selected', foodSelected);
  els.toolDemolishBtn.classList.toggle('selected', demolishSelected);
  els.toolMergeBtn.classList.toggle('selected', mergeSelected);

  // Descriptive text lives on each button's own native `title` hover
  // tooltip now, not a separate always-visible shop line — per direct
  // request ("remove any text from the shop for the tools, and move those
  // to a tool hovertip"). Demolish/Merge's titles are static (set once in
  // index.html); only Food's needs to stay JS-driven since FOOD_COST could
  // in principle change.
  els.toolFoodBtn.title = `Food — $${FOOD_COST} (1)`;

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
    // The post-alien guided tutorial's "turret" step always wants the base
    // Waste Turret specifically ("place the waste turret"), regardless of
    // which tier this slot happened to be cycled to — force it back to the
    // family's lowest (first-unlocked) tier rather than whatever the click
    // above just landed on.
    if (familyId === 'turret' && state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'turret') {
      familySelectedTier[familyId] = memberIds[0];
    }
    refreshFamilyButton(state, familyId); // sync dataset.tool to the (possibly just-cycled) tier before selecting it
    selectBuildingForPreview(state, BUILDING_TYPES[familySelectedTier[familyId]]);
    if (familyId === 'turret') advanceTutorialFlow(state, 'postalien', 'turret');
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
  // Per direct request, clicking an already-selected single-tier building
  // (Platform, or any other standalone building with no other tier — NOT a
  // multi-tier family slot, which already cycles on repeat click, see
  // buildFamilyButton above) deselects it instead — see
  // deselectShopSelection.
  btn.addEventListener('click', () => {
    if (state.ui.selectedTool === `build:${building.id}`) deselectShopSelection(state);
    else selectBuildingForPreview(state, building);
  });
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

// COIN_CAP_BY_LEVEL is an absolute-value table, not a base+increment formula
// (the requested progression isn't an even step), so this indexes straight
// in rather than computing a cap like describeFoodCapacityLevel above does.
// (Science's own cap has no equivalent leveled-card description any more —
// it moved into the branching Lab tree as 5 individual nodes instead, see
// SCIENCE_LAB_UPGRADES' science_cap_1..5.)
function describeCoinCapacityLevel(level) {
  const cap = COIN_CAP_BY_LEVEL[level];
  if (level >= COIN_CAP_UPGRADE_MAX_LEVEL) {
    return `Up to ${cap} coins can sit in the tank uncollected at once.`;
  }
  const nextCap = COIN_CAP_BY_LEVEL[level + 1];
  return `Up to <span class="stat-current">${cap} coins</span> → <span class="stat-next">${nextCap} coins</span> can sit in the tank uncollected at once.`;
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

let tankCards = null; // { foodQuality, fishMovement, coinCapacity, fishMerging } — each { card, levelEl, descEl, buyBtn }. Gene-Splicing moved out of this panel entirely — see Config.js's SCIENCE_LAB_UPGRADES' gene_splicing/hybrid tree. Food Capacity retired entirely — see Config.js's FOOD_STATIONARY_TO_WASTE_MS.

function buildTankPanel(state) {
  els.tankUpgradeList.innerHTML = '';
  const foodQuality = createUpgradeCard('Food Quality', '🍽️');
  const fishMovement = createUpgradeCard('Fish Movement', '🏊');
  const coinCapacity = createUpgradeCard('Coin Capacity', '🪙');
  const fishMerging = createUpgradeCard('Fish Merging', '🧬');
  tankCards = { foodQuality, fishMovement, coinCapacity, fishMerging };

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
  coinCapacity.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.coinCapLevel;
    if (level >= COIN_CAP_UPGRADE_MAX_LEVEL) return;
    const cost = COIN_CAP_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.coinCapLevel += 1;
    playUpgrade();
    refreshTankPanel(state);
    // Tank-Point guided tutorial's second (final) step stops on this exact
    // button — see TUTORIAL_FLOWS. Level 1 costs only 1 Tank Point (see
    // Config.js's COIN_CAP_UPGRADE_COSTS) specifically so a player who just
    // earned their very first Tank Point can always afford this.
    advanceTutorialFlow(state, 'tankpoint', 'coincapbuy');
  });

  // Fish Merging first, Coin Capacity second — per direct request ("put Gene
  // Splicing at the top of the tank upgrades" for the first reorder; Fish
  // Merging is the card actually in this panel that unlocks the same Merge
  // tool, since Gene-Splicing itself lives in the Science Lab tree now — and
  // later, "move the Coin capacity tank upgrade to be the second one after
  // the fish merging").
  els.tankUpgradeList.append(fishMerging.card, coinCapacity.card, foodQuality.card, fishMovement.card);

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
  const { foodQuality, fishMovement, coinCapacity, fishMerging } = tankCards;
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

  const ccLevel = state.level.upgrades.coinCapLevel;
  coinCapacity.levelEl.textContent = `Level ${ccLevel} / ${COIN_CAP_UPGRADE_MAX_LEVEL}`;
  coinCapacity.descEl.innerHTML = describeCoinCapacityLevel(ccLevel);
  if (ccLevel >= COIN_CAP_UPGRADE_MAX_LEVEL) {
    coinCapacity.buyBtn.textContent = 'Maxed out';
    coinCapacity.buyBtn.disabled = true;
  } else {
    const cost = COIN_CAP_UPGRADE_COSTS[ccLevel];
    coinCapacity.buyBtn.textContent = `${cost} 🏆`;
    coinCapacity.buyBtn.disabled = available < cost;
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

  els.tankPointsDisplay.textContent = `🏆 ${available}`;
}

// Per direct request: clicking an already-selected single-tier shop item
// (a fish, or a standalone building with no other tier) a second time
// deselects it instead of leaving it selected — defaults back to the Food
// tool, and the preview window back to its empty placeholder, same as if
// nothing had ever been picked. A multi-tier family building slot is
// deliberately NOT wired to this — clicking it again already cycles to the
// next tier (see buildFamilyButton), an established behavior this doesn't
// change.
function deselectShopSelection(state) {
  currentPreviewSpecies = null;
  currentPreviewBuilding = null;
  stopPreviewAnimation();
  els.previewEmpty.classList.remove('hidden');
  els.previewContent.classList.add('hidden');
  // Deliberately NOT selectTool(state, 'food') — that also closes the Shop/
  // Tank Upgrades panel (see its own closeSidePanels call, for the bottom
  // hotbar's Food/Demolish/Merge buttons), which would be wrong here: the
  // player is still IN the shop, just with nothing picked any more.
  state.ui.selectedTool = 'food';
  updateToolbar(state);
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
  // Per direct request, fish get the same stats chip row buildings already
  // show — see fishEconomyStatsHtml.
  const statsHtml = speciesStatsHtml(species.id);
  els.previewStats.innerHTML = statsHtml;
  els.previewStats.classList.toggle('hidden', !statsHtml);
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
// Per direct request ("shorten the verbiage... so the shop window doesn't
// also need a scroll bar"), each building type's stats are paired two-to-a-
// line (shorter labels too) instead of one stat per line — halves the line
// count for the 3-4-stat buildings (Processor, Turret) that were the only
// things actually overflowing the fixed-height preview box.
function buildingStatsHtml(buildingId) {
  const p = PROCESSOR_STATS[buildingId];
  if (p) {
    return (
      `<div class="building-stat">⏱️ Coin <b>${p.coinMs / 1000}s</b> · 🔬 Sci <b>${p.scienceMs / 1000}s</b></div>` +
      `<div class="building-stat">💩 Waste <b>${p.wasteEveryMs / 1000}s</b> · ⚡ <b>${p.powerCostPerSec}</b> mw/s</div>`
    );
  }
  const a = AUTO_FEEDER_STATS[buildingId];
  if (a) {
    return (
      `<div class="building-stat">⏱️ <b>${a.wasteProcessMs / 1000}s</b>/load · 💩 <b>${a.wasteRequired}</b>/Food</div>` +
      `<div class="building-stat">⚡ <b>${a.powerCostPerSec}</b> mw/sec</div>`
    );
  }
  const f = FAN_STATS[buildingId];
  if (f) {
    return `<div class="building-stat">📏 <b>${f.maxRange}px</b> · ⚡ <b>${f.powerCost}</b> mw/sec</div>`;
  }
  const t = TURRET_STATS[buildingId];
  if (t) {
    const line2 = buildingId === TILE_TURRET_WASTE
      ? `📏 Global · 🗑️ <b>${WASTE_TURRET_SHOTS_PER_WASTE}</b>/waste, holds <b>${WASTE_TURRET_MAX_WASTE}</b>`
      : `📏 Global · ⚡ <b>${t.powerCostPerSec}</b> mw/sec`;
    return (
      `<div class="building-stat">🔫 <b>${t.shotsPerSec}</b>/sec · 💥 <b>${t.damage}</b> dmg</div>` +
      `<div class="building-stat">${line2}</div>`
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

    // Per direct request, clicking an already-selected single-tier shop
    // item (a fish always is one — there's no fish "family" the way
    // buildings have) deselects it instead of just re-selecting the same
    // thing — see deselectShopSelection.
    btn.addEventListener('click', () => {
      if (state.ui.selectedTool === `fish:${species.id}`) deselectShopSelection(state);
      else selectSpeciesForPreview(state, species);
      // Game-start guided tutorial's second step stops specifically on the
      // Guppy icon — see TUTORIAL_FLOWS.
      if (species.id === 'guppy') advanceTutorialFlow(state, 'start', 'guppy');
    });

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

// An attempted shop purchase (food, a fish, a building) that fails for lack
// of money shakes the money readout red instead of silently doing nothing,
// so the failure actually reads as "you can't afford that" rather than
// "nothing happened, did my click even register." #hud is the only copy of
// the money readout now (see updateHUD's own comment), so this no longer
// needs to pick between several — it always targets els.money directly.
export function flashMoneyInsufficient(state) {
  playFlash(els.money, 'flash-spend');
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
  // Keeps the Demolish/Merge gray-out live every frame — see updateToolbar's
  // own comment on why this can't just wait for the next tool-select event.
  updateToolbar(state);
  // Per direct request, #hud is the ONE copy of every readout now — the
  // Shop/Tank Upgrades panels no longer carry their own duplicate set (see
  // this file's removed #shopHud/#tankHud els and style.css's removed
  // #shop-hud/#tank-hud rule) — it stays fixed top-right and visible at all
  // times, including while either panel is open.
  const money = state.level.money;
  const moneyText = `💰 $${Math.floor(money)}`;
  els.money.textContent = moneyText;
  // Per direct request, the Shop panel gets its own live money readout back
  // — the one exception to "the main #hud is the only copy of everything"
  // above — inline with the "Shop" title (see style.css's #shop-header-row).
  els.shopMoney.textContent = moneyText;
  const cleanliness = state.level.cleanliness;
  const cleanlinessText = `✨ ${Math.round(cleanliness)}%`;
  els.cleanliness.textContent = cleanlinessText;
  els.cleanliness.style.color = cleanlinessColor(cleanliness);
  // Coin Cap — always shown (coins exist from the very start), unlike
  // Science below. Counts EVERY coin currently in state.level.items, seabed
  // city included — see Entities.js's countTankItemsByType.
  const coinCapCount = countTankItemsByType(state, 'coin');
  const coinCapMax = effectiveCoinCapacity(state);
  els.coinCap.textContent = `🪙 ${coinCapCount}/${coinCapMax}`;
  // Per direct request: pulse red continuously once the live count reaches
  // CAP_WARNING_THRESHOLD_FRACTION (80%) of the active cap, and shake red
  // (the same one-shot flash-spend every other HUD readout already uses)
  // every time the count itself goes UP — both are "this is filling up,
  // pay attention" cues, just one continuous and one per-event.
  const coinCapWarningActive = coinCapCount / coinCapMax >= CAP_WARNING_THRESHOLD_FRACTION;
  els.coinCap.classList.toggle('cap-warning', coinCapWarningActive);
  // Per direct request, a genuinely FULL cap (not just the 80% warning)
  // also bounces like a notification badge, on top of the pulse — see
  // style.css's .cap-full for the visual, kept deliberately distinct from
  // the flash-spend shake below (a different signal: a blocked production
  // attempt, not "the cap is full" itself).
  els.coinCap.classList.toggle('cap-full', coinCapCount >= coinCapMax);
  // One-time notification the first time the coin count ever reaches this
  // threshold, per direct request — "make it more obvious when the coin
  // limit is reached." Same inline push-then-cap pattern every other
  // notification writer in this codebase uses (see CLAUDE.md's Rolling
  // Notification Log section) rather than a shared helper.
  if (coinCapWarningActive && !state.level.tutorialFlags.firstCoinCapWarningShown) {
    state.level.tutorialFlags.firstCoinCapWarningShown = true;
    const notifications = state.level.notifications;
    notifications.push({
      id: notifications.length + 1,
      text: `Pick up those coins, you can only have ${coinCapMax} on screen at once`,
      elapsed: state.level.elapsed,
    });
    if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
  }
  if (lastCoinCapCount !== null && coinCapCount > lastCoinCapCount) {
    playFlash(els.coinCap, 'flash-spend');
  }
  lastCoinCapCount = coinCapCount;
  // Set by Entities.js's updateFish the instant a coin-drop cycle is
  // blocked by the cap — a plain flag read-and-cleared here rather than a
  // direct function call, since Entities.js has no reason to import UI.js.
  // A blocked drop never actually raises the count, so this can't double up
  // with the increase-triggered shake above — it's the one case that still
  // needs its own explicit trigger.
  if (state.ui.coinCapFlashPending) {
    state.ui.coinCapFlashPending = false;
    playFlash(els.coinCap, 'flash-spend');
  }

  // Same cross-module-flag pattern — see main.js's state.ui declaration for
  // why Grid.js can't call advanceTutorialFlow directly. Calling both is
  // safe: each is a no-op unless that exact flow/step is the one currently
  // active.
  if (state.ui.wasteTurretAmmoGainedPending) {
    state.ui.wasteTurretAmmoGainedPending = false;
    advanceTutorialFlow(state, 'postalien', 'dragwaste');
    advanceTutorialFlow(state, 'wastedrag', 'drag');
  }

  // Science Cap — hidden until the Science Octopus is unlocked, same
  // "hidden until relevant" precedent as the electricity readout below.
  const octopusUnlocked = state.meta.speciesUnlocked.includes('octopus');
  els.scienceCap.classList.toggle('hidden', !octopusUnlocked);
  if (octopusUnlocked) {
    const scienceCapCount = countTankItemsByType(state, 'science');
    const scienceCapMax = effectiveScienceCapacity(state);
    els.scienceCap.textContent = `🔬 ${scienceCapCount}/${scienceCapMax}`;
    els.scienceCap.classList.toggle('cap-warning', scienceCapCount / scienceCapMax >= CAP_WARNING_THRESHOLD_FRACTION);
    els.scienceCap.classList.toggle('cap-full', scienceCapCount >= scienceCapMax);
    if (lastScienceCapCount !== null && scienceCapCount > lastScienceCapCount) {
      playFlash(els.scienceCap, 'flash-spend');
    }
    lastScienceCapCount = scienceCapCount;
  }

  // Electricity — only shown at all once Electric Eel is unlocked, per
  // direct request. Text only updates once a real second, matching the
  // "updates every second" request exactly, since state.level.powerHistory
  // itself only gains a new entry once a second (see main.js's update()).
  const eelUnlocked = state.meta.speciesUnlocked.includes('electric_eel');
  els.power.classList.toggle('hidden', !eelUnlocked);
  if (eelUnlocked) {
    const history = state.level.powerHistory;
    const last = history[history.length - 1];
    els.power.textContent = last ? `⚡ ${last.demand}/${last.supply} mw` : '⚡ 0/0 mw';
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

  if (lastMoney !== null && money !== lastMoney) {
    playFlash(els.money, money > lastMoney ? 'flash-pickup' : 'flash-spend');
  }
  lastMoney = money;

  if (lastCleanliness !== null && cleanliness !== lastCleanliness) {
    playFlash(els.cleanliness, cleanliness > lastCleanliness ? 'flash-pickup' : 'flash-spend');
  }
  lastCleanliness = cleanliness;

  updateAlienCountdown(state);
  updateScrollHint(state);
  updateTutorialOverlay(state);
  // Purchase legend — "Click to purchase" / "(Esc) to cancel" — shown while
  // a building OR a fish is armed (state.ui.selectedTool starts with
  // 'build:'/'fish:'), per direct request ("for the fish as well as the
  // buildings"). Suppressed during a guided tutorial — Escape doesn't
  // cancel the tool while one's active (it's locked/self-healing, see
  // TUTORIAL_FLOWS' own comment), it skips the tutorial instead, so showing
  // "Esc to cancel" here would be actively misleading; the skip legend
  // below covers that case instead.
  const tutorialActive = !!state.level.tutorialFlow;
  const toolIsPurchasable = state.ui.selectedTool.startsWith('build:') || state.ui.selectedTool.startsWith('fish:');
  els.buildLegend.classList.toggle('hidden', tutorialActive || !toolIsPurchasable);
  // Tutorial-skip legend — "(Esc) to skip tutorial" — shown for the whole
  // duration of any guided tutorial flow, per direct request; main.js's
  // Escape handler now actually honors this (see its own comment).
  els.tutorialSkipLegend.classList.toggle('hidden', !tutorialActive);
}

// A row of bouncing down-arrows nudging the player to pan the camera down,
// per direct request ("at the beginning of the game, after 10 seconds, if
// the player hasn't scrolled down yet, have arrows show up along the bottom
// of the screen and bounce until the player scrolls at least one scroll
// downward"). state.camera.y only ever moves away from its loadLevel-seeded
// 0 via deliberate vertical pan input (Engine.js's updateCamera) — nothing
// else in the game ever touches it — so ">0" is a reliable, one-line "has
// the player scrolled down at all" signal with no need to hook into
// Engine.js's own input handling (which deliberately has no knowledge of
// tutorial state — see its module header).
const SCROLL_HINT_DELAY_MS = 40000; // 10s + 30 more, per direct request
function updateScrollHint(state) {
  if (!state.level.tutorialFlags.hasScrolledDown && state.camera.y > 0) {
    state.level.tutorialFlags.hasScrolledDown = true;
  }
  // Per direct request, the post-alien guided tutorial's "scroll" step
  // reuses these same 5 arrows — forced visible regardless of the normal
  // delay/hasScrolledDown/item-in-city gating below, since by the time that
  // step is reached the game may be many minutes in (hasScrolledDown
  // already true from earlier casual scrolling) and what matters here is
  // whether the camera is AT THE BOTTOM right now, which main.js's own
  // per-tick check (isScrolledToBottom) already tracks independently to
  // skip/advance the step itself — this is purely the visual nudge.
  const forcedByTutorial = state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'scroll';
  // Per direct request, the normal (non-tutorial-forced) nudge now ALSO
  // requires at least one Coin/Waste/Food actually sitting in the city —
  // both conditions must hold — so it doesn't nag a player who has nothing
  // down there worth scrolling to see yet.
  const somethingInCity = state.level.items.some(
    (item) => item.y >= SEABED_FLOOR_Y && (item.type === 'coin' || item.type === 'waste' || item.type === 'food')
  );
  const shouldShow =
    forcedByTutorial ||
    (state.level.elapsed >= SCROLL_HINT_DELAY_MS && !state.level.tutorialFlags.hasScrolledDown && somethingInCity);
  els.scrollHint.classList.toggle('hidden', !shouldShow);
}

// ---- Guided tutorial flows ----
// Three short scripted sequences (game-start; the first Tank Point; ~10s
// after the first alien kill), all built on the same small engine per direct
// request ("just like the first alien tutorial"). state.level.tutorialFlow
// is plain data ({ id, step } | null) — whoever detects a flow's trigger
// condition (main.js at Start, Entities.js's awardTankPoint, Systems.js's
// updateStoryTriggers) just sets it directly, the same way
// firstAlienIntroActive is already set directly from wherever it triggers.
// main.js's update() freezes most systems while any flow is active (camera
// panning and build-drag placement stay live — see its own comment); the
// #tutorial-overlay DOM element below does the rest of the "pause" work by
// PHYSICALLY restricting clicks to the current step's target circle via a
// live CSS clip-path "hole" (a real browser hit-test punch-through, not a
// forwarded/synthetic click) — so every step's real action (opening the
// Shop, clicking a species icon, buying an upgrade, placing a building)
// fires through its own already-existing, already-proven handler; this
// engine's only job is telling those handlers when to call
// advanceTutorialFlow, and drawing the spotlight.
//
// getCircle(state) returns { cx, cy, r } in fixed (viewport) CSS pixels, or
// null if the target isn't currently on screen (e.g. a DOM element that
// hasn't been built yet) — unifies DOM-element targets (via
// tutorialCircleForDom, reading a live getBoundingClientRect every frame, so
// it tracks a CSS transition like the Shop panel's own grow-in animation
// for free) and world-space targets (via worldToScreen against the live
// camera, so it tracks camera panning too) under one shape. A step with
// noSpotlight skips the dark overlay/hole entirely — just the instruction
// text (and, for the postalien "scroll" step, forces #scroll-hint visible —
// see updateScrollHint above).
function tutorialCircleForDom(el, padding = 12) {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null; // not rendered right now (e.g. a panel that's still collapsed)
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, r: Math.max(rect.width, rect.height) / 2 + padding };
}

// Per direct report ("the first tutorial breaks if the player scrolls down
// first") — a FIXED world-Y target (this used to be a plain constant,
// SEABED_FLOOR_Y * 0.15) could scroll off the top of the screen entirely if
// the camera had already panned down before reaching this step, leaving the
// spotlight (and its clickable hole) unreachable. Anchored to the CURRENT
// camera position instead: a small fixed offset below whatever's at the top
// of the viewport right now (so it tracks scrolling and is always on
// screen), clamped so it never crosses into the seabed city — has to stay
// valid open water for the fish placement to actually succeed. Still
// deliberately near the TOP of the current view, not dead center: the Shop
// panel is open at this point (that's how the player has a fish armed to
// place at all) and its fly-out box grows upward from the bottom tool-bar
// tall enough to cover a good chunk of the screen's vertical middle.
function startTutorialFishSpotWorld(state) {
  return { x: WORLD_W / 2, y: Math.min(state.camera.y + 100, SEABED_FLOOR_Y - 50) };
}
// World point near (but not AT) the left edge of the world's absolute
// bottom row — any empty city tile is a legal Turret placement now (see
// Grid.js's canPlaceTile — buildings no longer need to anchor to a Platform
// or the seabed floor at all), this particular spot is just a fine, always-
// empty-at-this-point-in-the-tutorial one — "the bottom of the tank, just
// left of and above the shop icon" per direct request. 0.12 * WORLD_W (not a
// small fixed px offset)
// deliberately stays clear of two things: the camera's own horizontal
// centering offset (camera.x = (WORLD_W - viewW) / 2 is often 100+ world px,
// since the world is usually a little wider than the viewport — see
// CLAUDE.md's world-shrink note — so a spot within that offset would render
// OFF-SCREEN to the left entirely), and — since the Shop panel is meant to
// stay open through this step ("visible with the shop open") — the panel's
// own fly-out box, which grows upward from its (horizontally-centered-ish)
// toggle button and can cover a real chunk of the lower-middle screen; a
// point safely toward the left edge stays clear of it regardless.
const POST_ALIEN_TURRET_SPOT = { x: WORLD_W * 0.12, y: WORLD_H - TILE_SIZE / 2 };

// Shared by the post-alien flow's final step AND the standalone 'wastedrag'
// flow below (used when a Waste Turret already existed before the tutorial
// could walk the player through placing one) — a circle that encompasses
// BOTH the target Waste Turret and the nearest Waste item to it, per direct
// request ("the tutorial circle encapsulates the waste and the turret").
// Returns null (hides the spotlight) if there's no turret, or no Waste to
// drag yet — both should be unreachable given each flow's own trigger
// conditions, but this avoids a crash if the turret gets demolished or the
// Waste gets absorbed by something else mid-step.
function wasteDragStepCircle(state) {
  const target = findNearestWasteTurretAndWaste(state);
  if (!target || !target.waste) return null;
  const a = worldToScreen(target.turret.x, target.turret.y, state.camera);
  const b = worldToScreen(target.waste.x, target.waste.y, state.camera);
  const r = Math.hypot(a.x - b.x, a.y - b.y) / 2 + 40; // padding so both sit comfortably inside, not right at the edge
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, r };
}

const TUTORIAL_FLOWS = {
  // The cinematic first-alien intro — per direct report, unified onto this
  // exact same engine ("the tutorial event... seemed different") instead of
  // main.js's old bespoke canvas destination-out spotlight. A single step
  // whose target TRACKS the alien's live position every frame (it's frozen
  // in place the whole time this flow is active — see main.js's update(),
  // which stops even camera panning for this one flow — but getCircle is
  // still recomputed live rather than cached, same as every other step).
  // Returns null (hides the spotlight entirely) if the target alien is
  // somehow already gone — defensive, shouldn't happen since nothing ticks
  // while this flow is active other than the click that ends it.
  alienintro: [
    {
      id: 'click',
      text: 'An alien! Click it to fight back.',
      getCircle: (state) => {
        const alien = state.level.entities.find((e) => e.id === state.level.firstAlienIntroTargetId && e.type === 'alien' && e.hp > 0);
        if (!alien) return null;
        const screen = worldToScreen(alien.x, alien.y, state.camera);
        return { cx: screen.x, cy: screen.y, r: ALIEN_RADIUS * state.camera.zoom * 3.2 };
      },
    },
  ],
  // Every step below carries an explicit `tool` — applied the instant that
  // step becomes active (see startTutorialFlow/advanceTutorialFlow) — per
  // direct request ("make sure the correct tool is selected at the start of
  // each step of the tutorial so it can't break where you are stuck on the
  // wrong tool"). This is what actually fixes the reported break (the post-
  // alien flow's "scroll" step hides the whole overlay — noSpotlight — so
  // nothing was stopping a click from reaching the bottom tool-bar and
  // selecting Demolish there, stranding the following "place" step with no
  // build tool armed); isDemolishToolAvailable/isMergeToolAvailable also now
  // refuse Demolish/Merge outright for the whole duration of any flow, so
  // this is belt-and-suspenders, not the only fix.
  start: [
    { id: 'shop', text: 'Click the Shop to buy your first fish!', tool: 'food', getCircle: () => tutorialCircleForDom(els.shopCollapseBtn) },
    { id: 'guppy', text: 'Pick a Guppy!', tool: 'food', getCircle: () => tutorialCircleForDom(els.shopGrid.querySelector('[data-tool="fish:guppy"]')) },
    {
      id: 'buyfish',
      text: 'Click in the tank to place it!',
      tool: 'fish:guppy',
      getCircle: (state) => {
        const spot = startTutorialFishSpotWorld(state);
        const screen = worldToScreen(spot.x, spot.y, state.camera);
        return { cx: screen.x, cy: screen.y, r: 90 };
      },
    },
  ],
  tankpoint: [
    { id: 'tankbtn', text: 'Open Tank Upgrades to spend your Tank Point!', tool: 'food', getCircle: () => tutorialCircleForDom(els.tankCollapseBtn) },
    { id: 'coincapbuy', text: 'Buy your first Coin Capacity upgrade!', tool: 'food', getCircle: () => tutorialCircleForDom(tankCards?.coinCapacity.buyBtn) },
  ],
  postalien: [
    { id: 'shop', text: 'Time to arm up — open the Shop!', tool: 'food', getCircle: () => tutorialCircleForDom(els.shopCollapseBtn) },
    { id: 'turret', text: 'Grab the Waste Turret!', tool: 'food', getCircle: () => tutorialCircleForDom(familyButtons.turret?.btn) },
    { id: 'scroll', text: 'Scroll all the way down to the bottom of the tank!', tool: `build:${TILE_TURRET_WASTE}`, noSpotlight: true },
    {
      id: 'place',
      text: 'Place the Waste Turret down here!',
      tool: `build:${TILE_TURRET_WASTE}`,
      getCircle: (state) => {
        const screen = worldToScreen(POST_ALIEN_TURRET_SPOT.x, POST_ALIEN_TURRET_SPOT.y, state.camera);
        return { cx: screen.x, cy: screen.y, r: 70 };
      },
    },
    // Per direct request — one more step teaching the Waste-drag mechanic
    // itself: grab the nearest Waste and drag it into the Turret just
    // placed. main.js draws a looping "ghost" Waste animating from its own
    // position to the Turret while this step is active (hidden the instant
    // the player actually grabs the real one — see its own render code) and
    // ends the step the moment any Waste Turret's ammo goes up.
    { id: 'dragwaste', text: 'Drag the Waste into the Turret!', tool: 'food', getCircle: wasteDragStepCircle },
  ],
  // Standalone one-step flow for the "already had a Turret" case (see
  // Systems.js's updatePostAlienTutorial) — same step shape/logic as
  // postalien's own final 'dragwaste' step above, just not preceded by the
  // Shop/turret-selection/scroll/place steps, since those are already done.
  wastedrag: [
    { id: 'drag', text: 'Drag the Waste into the Turret!', tool: 'food', getCircle: wasteDragStepCircle },
  ],
};

// Fires once a flow finishes its last step — id-specific rewards/messages,
// per direct request. The 'start' flow ends silently (nothing was asked for
// beyond the fish itself getting placed).
function onTutorialFlowComplete(state, id) {
  if (id === 'tankpoint') {
    // Per direct request: after this tutorial, grant one more Tank Point
    // with its own chat message — deliberately NOT routed through
    // awardTankPoint (that's a per-fish-growth award with its own
    // "isFirst" bookkeeping this isn't part of).
    state.level.tankPoints.total += 1;
    state.level.tankPoints.available += 1;
    const notifications = state.level.notifications;
    notifications.push({ id: notifications.length + 1, text: "Here's an extra tank point, don't spend it all in one place", elapsed: state.level.elapsed });
    if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
  } else if (id === 'postalien' || id === 'wastedrag') {
    // Same closing line for both — 'wastedrag' is teaching the exact same
    // "you've got a Turret, now feed it" lesson, just entered from the
    // "already placed one" shortcut instead of the full walkthrough. Either
    // path completing means the drag-Waste lesson itself was genuinely
    // shown — 'postalien' only ever reaches this point via its own last
    // step, 'dragwaste' — so this is the one place to mark it done (see
    // Systems.js's updatePostAlienTutorial for why this is tracked
    // separately from postAlienTutorialShown).
    state.level.tutorialFlags.wasteDragTutorialShown = true;
    const notifications = state.level.notifications;
    notifications.push({ id: notifications.length + 1, text: POST_ALIEN_TUTORIAL_MESSAGE, elapsed: state.level.elapsed });
    if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
  }
}

// Starts (or continues) a guided flow — exported for main.js to call once at
// game start ('start' id) and after a successful turret placement
// ('postalien' id's final step, since that's detected in main.js's
// updateBuildDrag, not a DOM click UI.js already owns a handler for).
// Idempotent no-op if the flow/step doesn't match what's currently active,
// so every call site can just call this unconditionally after its own real
// action succeeds, with no need to check state.level.tutorialFlow itself.
// Doesn't apply the next step's `tool` itself — updateTutorialOverlay below
// re-asserts it every frame instead (see that function's own comment), so
// there's exactly one enforcement path regardless of which module started
// or advanced the flow (Entities.js/Systems.js both set
// state.level.tutorialFlow directly, plain data, same as
// firstAlienIntroActive always has — importing UI.js from either would be
// circular).
export function advanceTutorialFlow(state, id, step) {
  const flow = state.level.tutorialFlow;
  if (!flow || flow.id !== id || flow.step !== step) return;
  // The drag-Waste step is done (whether completing 'postalien' outright or
  // the standalone 'wastedrag' flow) — clear the locked target so a later
  // re-trigger of either flow starts a fresh pick instead of reusing
  // whatever this run happened to lock onto (which may no longer even
  // exist by then). See Grid.js's findNearestWasteTurretAndWaste.
  if ((id === 'postalien' && step === 'dragwaste') || (id === 'wastedrag' && step === 'drag')) {
    state.level.wasteDragTutorialTargetId = null;
  }
  const steps = TUTORIAL_FLOWS[id];
  const idx = steps.findIndex((s) => s.id === step);
  const next = steps[idx + 1];
  if (next) {
    flow.step = next.id;
  } else {
    state.level.tutorialFlow = null;
    onTutorialFlowComplete(state, id);
  }
}

// Called every frame (from updateHUD) — positions/shows the spotlight for
// whatever step is currently active, or hides everything if no flow is
// running.
function updateTutorialOverlay(state) {
  const flow = state.level.tutorialFlow;
  if (!flow) {
    els.tutorialOverlay.classList.add('hidden');
    els.tutorialText.classList.add('hidden');
    return;
  }
  const stepDef = TUTORIAL_FLOWS[flow.id].find((s) => s.id === flow.step);
  if (!stepDef) return; // defensive — shouldn't happen
  // Per direct request ("make sure the correct tool is selected at the
  // start of each step of the tutorial so it can't break where you are
  // stuck on the wrong tool") — re-asserted every frame this step is
  // active, not just once on entry, so it's self-healing the same way
  // isFanAimingActive() already is: whatever else might have nudged
  // selectedTool away gets corrected right back on the very next frame.
  if (stepDef.tool && state.ui.selectedTool !== stepDef.tool) {
    state.ui.selectedTool = stepDef.tool;
    updateToolbar(state);
  }
  els.tutorialText.textContent = stepDef.text;
  els.tutorialText.classList.remove('hidden');
  if (stepDef.noSpotlight) {
    els.tutorialOverlay.classList.add('hidden');
    return;
  }
  const circle = stepDef.getCircle(state);
  if (!circle) { els.tutorialOverlay.classList.add('hidden'); return; }
  els.tutorialOverlay.classList.remove('hidden');
  const { cx, cy, r } = circle;
  const w = window.innerWidth;
  const h = window.innerHeight;
  // A real hole, not just a visual one: an SVG path covering the full
  // viewport rect MINUS the target circle, evenodd-filled — clip-path
  // restricts both rendering AND pointer hit-testing to the clipped-IN
  // region, so a click inside the circle passes straight through to
  // whatever real element sits underneath (the actual Shop button, the
  // canvas, etc.), while a click anywhere else in the darkened area never
  // reaches anything below it at all. No synthetic-event forwarding needed.
  const path =
    `M0,0 H${w} V${h} H0 Z ` +
    `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;
  els.tutorialOverlay.style.clipPath = `path(evenodd, "${path}")`;
}

// Alien Invasion: the top-of-screen countdown banner, per direct request —
// shown only during the final ALIEN_COUNTDOWN_START_MS before a wave (the
// two earlier warnings, at ALIEN_WARNING_MS_1/_2, are plain chat
// notifications instead — see Systems.js's updateAlienWaves). Ceils the
// remaining time so the displayed number counts 10, 9, 8...1 rather than
// jumping straight from 10 to 9 a frame after the banner appears.
function updateAlienCountdown(state) {
  const msRemaining = state.level.alienNextWaveAtMs - state.level.elapsed;
  if (msRemaining > 0 && msRemaining <= ALIEN_COUNTDOWN_START_MS) {
    els.alienCountdown.classList.remove('hidden');
    els.alienCountdownSeconds.textContent = String(Math.ceil(msRemaining / 1000));
  } else {
    els.alienCountdown.classList.add('hidden');
  }
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
    // A genuinely new message re-arms the periodic reminder bounce — see
    // scheduleNotificationReminder above — even if the log was already read
    // and closed for a PREVIOUS message.
    notificationUnread = true;
    scheduleNotificationReminder();
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
