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
  COIN_TIMER_FEED_BONUS_FRACTION_BY_LEVEL,
  FISH_MOVEMENT_UPGRADE_COSTS,
  FISH_MOVEMENT_UPGRADE_MAX_LEVEL,
  FISH_MOVEMENT_UPGRADE_SPEED_BONUS,
  BUILDING_FAMILIES,
  BUILDING_TYPES,
  CLEANLINESS_MAX,
  CLEANLINESS_COLOR_CLEAN,
  CLEANLINESS_COLOR_DIRTY,
  PROCESSOR_STATS,
  REFINERY_STATS,
  ALIEN_DNA_REFINERY_TIME_MULTIPLIER,
  MANUFACTURER_RECIPES,
  MANUFACTURER_RECIPE_LIST,
  MANUFACTURER_ITEM_PROCESS_MS,
  MANUFACTURER_ITEM_POWER_COST_MW,
  MANUFACTURER_STATS,
  POWER_PLANT_RECIPES,
  POWER_PLANT_RECIPE_LIST,
  TILE_MANUFACTURER,
  TILE_POWER_PLANT,
  POWER_HISTORY_MAX,
  SCIENCE_LAB_UPGRADES,
  SCIENCE_LAB_UPGRADE_LIST,
  TANK_EXPANSION_UPGRADE_COSTS,
  TANK_EXPANSION_MAX_TIER,
  TANK_EXPANSION_ROWS_PER_TIER,
  FISH_HEALTH_UPGRADE_COSTS,
  FISH_HEALTH_UPGRADE_MAX_LEVEL,
  FISH_HEALTH_UPGRADE_BONUS_PER_LEVEL,
  WORLD_W,
  TILE_SIZE,
  ALIEN_RADIUS,
  POST_ALIEN_TUTORIAL_MESSAGE,
  CHEST_TUTORIAL_MESSAGE,
  CHEST_TUTORIAL_GOLD_GRANT,
  CHEST_TUTORIAL_GOLD_GRANT_MESSAGE,
  CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES,
  TILE_STORAGE_CHEST,
  STORAGE_CHEST_CAPACITY,
  SPECIES,
  WASTE_POOP_INTERVAL_MS,
  FISH_SPEED_MULTIPLIER,
  ALIEN_COUNTDOWN_START_MS,
  CAP_WARNING_THRESHOLD_FRACTION,
  TURRET_STATS,
  TURRET_AMMO_TILES,
  TILE_TURRET_WASTE,
  TILE_TURRET_ADVANCED,
  WASTE_TURRET_SHOTS_PER_WASTE,
  WASTE_TURRET_MAX_WASTE,
  BIOMASS_TURRET_SHOTS_PER_AMMO,
  BIOMASS_TURRET_DAMAGE_MULTIPLIER,
  ADVANCED_TURRET_MAX_BIOMASS_AMMO,
  ADVANCED_TURRET_BIOMASS_DAMAGE,
  ACHIEVEMENTS,
  ACHIEVEMENT_LIST,
  ACHIEVEMENT_GEM_REWARD_BY_TIER,
  HATS,
  HAT_LIST,
  SCIENCE_ITEM_COLOR_A,
  SCIENCE_ITEM_COLOR_B,
  SCIENCE_GREEN_COLOR_A,
  SCIENCE_GREEN_COLOR_B,
  BIOMASS_COLOR,
  BIOMASS_COLOR_CORE,
  ALIEN_EGG_COLOR,
  ALIEN_EGG_RING_COLOR,
  MUTAGEN_PASTE_COLOR,
  FOOD_COLOR,
  WASTE_COLOR,
  ALIEN_DNA_COLOR,
  COIN_TIERS,
  PLATFORM_FILTER_ITEM_TYPES,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings, loadLevel } from './Levels.js';
import {
  getFishPurchaseCost, effectiveScienceCapacity, countTankItemsByType, hasAnyMergeOpportunity, resolveMergeTutorialPair,
  computeTheoreticalGoldPerMinute, computeTheoreticalCoinCountPerMinute, computeTheoreticalSciencePerMinute, computeTheoreticalFoodNeededPerMinute,
  computeTheoreticalWastePerMinute, computeTheoreticalManufacturerOutputPerMinute, computeTheoreticalBiomassPerMinute,
  computeFishInfoModalStats, describeFishMergeOptions,
} from './Entities.js';
import {
  getTile, worldToTile, getBuildingCost, FAN_STATS,
  findNearestWasteTurretAndWaste, getRecipeBuildingKeyAt, renderTileShape,
  getBuildingCurrentPowerDraw, getBuildingUptimeFraction, applyRecipeToBuilding,
  getChestKeyAt, armChestTrickle, toggleChestTrickle,
  getUnlockedWorldH,
} from './Grid.js';
import { worldToScreen } from './Engine.js';
import { centerCameraOnMound, canCrackMound, crackMound, getMoundNextCost, MOUND_X } from './Mound.js';
import { drawFish } from './FishRenderer.js';
import { playUpgrade, setMusicVolume, setSfxVolume, getMusicVolume, getSfxVolume, playPanelOpen, playPanelClose, playInsufficientFunds, setMusicUnderwaterMuffle, setMusicSpeedBoost, setMusicPaused } from './Sound.js';
import { hasSaveGame, saveGame, loadSaveGame } from './Save.js';
import { pushGameNotification } from './Notifications.js';

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
let lastScienceCapCount = null; // previous frame's live Science Bubble count, to detect a rise for the shake-red cue below
let notificationLogExpanded = false;
let lastRenderedNotificationCount = -1; // rebuild the log list only when it actually changes, not every frame
let lastPillNotificationCount = null; // separate from the above — tracks the pill's own bounce/shimmer trigger regardless of whether the log is expanded; null means "not yet initialized," so the very first real notification on page load doesn't bounce
let moundMenuOpen = false;
let moundMenuClosing = false; // true while the shrink-back transition is still playing, before it's actually hidden
let moundMenuCloseTimer = null;
let recipeMenuOpen = false;
let recipeMenuClosing = false;
let recipeMenuCloseTimer = null;
let recipeMenuTileKey = null; // "row,col" key of the Manufacturer/Power Plant tile this popup is currently open for
let buildingInfoMenuOpen = false;
let buildingInfoMenuClosing = false;
let buildingInfoMenuCloseTimer = null;
let buildingInfoTileKey = null; // "row,col" key of whichever placed building this generic info pop-up is currently open for
let fishInfoMenuOpen = false;
let fishInfoMenuClosing = false;
let fishInfoMenuCloseTimer = null;
const FISH_INFO_MENU_TRANSITION_MS = 220; // must match #fish-info-menu's CSS transition duration
let platformFilterMenuOpen = false;
let platformFilterMenuClosing = false;
let platformFilterMenuCloseTimer = null;
let platformFilterTileKey = null; // "row,col" key of whichever placed Platform/Fan this item-filter pop-up is currently open for
let platformFilterFishId = null; // Magnet Fish's own use of this SAME pop-up (its magnetFilterItems, not a building's filterItems) — mutually exclusive with platformFilterTileKey, see openMagnetFishFilterMenu
let storageChestMenuOpen = false;
let storageChestMenuClosing = false;
let storageChestMenuCloseTimer = null;
let storageChestTileKey = null; // "row,col" key of whichever placed Storage Chest this popup is currently open for
let labMenuOpen = false;
let labMenuClosing = false;
let labMenuCloseTimer = null;
let labZoom = 1; // current --lab-zoom scale factor — see openLabMenu/setLabZoom
let labFilterCategory = 'all'; // 'all' | 'buildings' | 'recipes' | 'fish' | 'other' — see labNodeCategory/applyLabFilter
// Per direct request, the Lab remembers exactly where you left it —
// labTreeHasBeenOpened gates the one-time-only initial centering (see
// openLabMenu), and the saved* trio is written by closeLabMenu and restored
// by the next openLabMenu. Module-level, not part of `state`, same as every
// other pure-UI transient in this file (moundMenuOpen, labZoom itself, etc).
let labTreeHasBeenOpened = false;
let savedLabScrollLeft = 0;
let savedLabScrollTop = 0;
let savedLabZoom = 1;
const LAB_ZOOM_MIN = 0.6;
const LAB_ZOOM_MAX = 1.6;
const LAB_ZOOM_STEP = 0.15;
let labPurchaseNodeId = null; // node id the confirmation modal is currently showing, if any — see openLabPurchaseModal/confirmLabPurchase
let powerGraphOpen = false; // the small rolling-graph popup under the electricity HUD readout — see #hud-power's click listener
let hudInfoModalOpen = null; // which HUD stat's info modal is open ('money'/'scienceCap'/'cleanliness'), or null — see openHudInfoModal

// Per direct request (a previously-ignored one, reiterated verbatim) —
// clicking money/science-cap/cleanliness on the HUD opens a small info modal
// to the left of the minimap instead of the old hover title tooltip. The
// description text here is exactly what those title attributes used to say
// (index.html no longer carries them). statFn/statLabel supply the
// "correlating stat/min" line using the same theoretical-per-minute
// functions the Tab stats panel already shows (see that panel's own rows
// around line 3495) — Gold/min for money, Science/min for the science cap
// (bubbles awaiting collection), and Waste/min for cleanliness (waste is
// what dirties the tank).
const HUD_INFO_DATA = {
  money: {
    icon: '💰', title: 'Money',
    desc: 'Money — spend it on fish and food in the shop.',
    statLabel: 'Gold/min',
    statFn: (state) => `$${Math.round(computeTheoreticalGoldPerMinute(state))}`,
  },
  scienceCap: {
    icon: '🔬', title: 'Science Bubbles',
    desc: "Science Bubbles currently sitting in the tank, uncollected — capped by the Science Lab's Bubble Capacity upgrade.",
    statLabel: 'Science/min',
    statFn: (state) => computeTheoreticalSciencePerMinute(state).toFixed(1),
  },
  cleanliness: {
    icon: '✨', title: 'Cleanliness',
    desc: "Tank cleanliness — a dirty tank's fish produce less money, down to half at 0% clean.",
    statLabel: 'Waste/min',
    statFn: (state) => computeTheoreticalWastePerMinute(state).toFixed(1),
  },
};
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

// Per direct request — "at the beginning, before the shop has been opened,
// have it bounce until it's opened for the first time." A self-terminating
// setTimeout chain: each firing re-checks the flag before bouncing and
// before rescheduling, so it stops on its own the tick after the shop is
// first expanded (see toggleShopCollapse) rather than needing an explicit
// cancel from there.
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

// Same self-terminating bounce-chain shape as the Shop button's own reminder
// above, for the Tank Upgrades icon — per direct request ("similar to how
// the shop bounces at the beginning of the game, have the tank upgrade icon
// on the main screen bounce 30 seconds after the first fish buying
// tutorial"). Started once, 30s after the game-start guided tutorial ('start'
// — Shop -> Guppy -> buy your first fish) finishes (see
// onTutorialFlowComplete below), not from level start — a player who hasn't
// even bought their first fish yet has no reason to see the Tank panel
// pushed on them yet. Stops for good the moment the panel is first opened,
// however it's opened (toggleTankPanel, or the start-screen's own
// Achievements/Customization buttons) — see firstTankPanelOpened, shared
// with the achievement-tab bounce below since both fire at that same
// "opened for the first time" moment.
let tankButtonReminderTimer = null;
const TANK_BUTTON_REMINDER_START_DELAY_MS = 30000; // "30 seconds after the first fish buying tutorial" — see onTutorialFlowComplete's 'start' branch below
const TANK_BUTTON_REMINDER_MIN_MS = 1500;
const TANK_BUTTON_REMINDER_MAX_MS = 3000;
export function scheduleTankButtonReminder(state) {
  if (tankButtonReminderTimer !== null) return;
  const delay = TANK_BUTTON_REMINDER_MIN_MS + Math.random() * (TANK_BUTTON_REMINDER_MAX_MS - TANK_BUTTON_REMINDER_MIN_MS);
  tankButtonReminderTimer = setTimeout(() => {
    tankButtonReminderTimer = null;
    if (state.level.tutorialFlags.firstTankPanelOpened) return;
    playFlash(els.tankCollapseBtn, 'bounce-play');
    scheduleTankButtonReminder(state);
  }, delay);
}

// Fires exactly once, ever, the very first time the Tank panel is opened by
// ANY path (the toggle button/P hotkey, or the start-screen's own
// Achievements/Customization shortcuts) — per direct request ("the first
// time they open the tank upgrade menu, have the achievement tab bounce").
// Also what permanently stops scheduleTankButtonReminder's own bounce chain
// above, same "one flag, two effects, both meaning the exact same real-world
// moment" shape firstShopOpened already has for the Shop button.
function maybeBounceAchievementTabFirstOpen(state) {
  if (state.level.tutorialFlags.firstTankPanelOpened) return;
  state.level.tutorialFlags.firstTankPanelOpened = true;
  playFlash(els.tankTabAchievementsBtn, 'bounce-play');
}

// This module's own local notification-push helper — same duplicated-inline
// "push+cap" pattern every other module already has its own copy of (see
// CLAUDE.md's Rolling Notification Log section), factored into one place
// here purely because UI.js has several call sites for it, unlike a module
// with just one or two. A thin wrapper around Notifications.js's own
// pushGameNotification — the one real, shared implementation of the
// push+cap+dedupe+timestamp logic (see that file's own comment).
function pushUiNotification(state, text) {
  pushGameNotification(state, text);
}

export function initUI(state) {
  els = {
    hud: document.getElementById('hud'),
    minimapWrap: document.getElementById('minimap-wrap'),
    money: document.getElementById('hud-money'),
    scienceCap: document.getElementById('hud-science-cap'),
    cleanliness: document.getElementById('hud-cleanliness'),
    power: document.getElementById('hud-power'),
    powerText: document.getElementById('hud-power-text'),
    powerArrow: document.getElementById('hud-power-arrow'),
    powerGraph: document.getElementById('hud-power-graph'),
    hudInfoModal: document.getElementById('hud-info-modal'),
    hudInfoModalTitle: document.getElementById('hud-info-modal-title'),
    hudInfoModalDesc: document.getElementById('hud-info-modal-desc'),
    hudInfoModalStat: document.getElementById('hud-info-modal-stat'),
    hudHoverBubble: document.getElementById('hud-hover-bubble'),
    alienCountdown: document.getElementById('alien-countdown'),
    alienCountdownWave: document.getElementById('alien-countdown-wave'),
    alienCountdownSeconds: document.getElementById('alien-countdown-seconds'),
    statsPanel: document.getElementById('stats-panel'),
    statsPanelList: document.getElementById('stats-panel-list'),
    bossHealthBarWrap: document.getElementById('boss-health-bar-wrap'),
    bossHealthBarFill: document.getElementById('boss-health-bar-fill'),
    bossVictoryOverlay: document.getElementById('boss-victory-overlay'),
    bossVictoryStats: document.getElementById('boss-victory-stats'),
    bossVictoryRestartBtn: document.getElementById('boss-victory-restart-btn'),
    saveToast: document.getElementById('save-toast'),
    scrollHint: document.getElementById('scroll-hint'),
    scrollHintText: document.getElementById('scroll-hint-text'),
    scrollHintArrows: document.querySelectorAll('.scroll-hint-arrow'),
    buildLegend: document.getElementById('build-legend'),
    buildReplaceLegend: document.getElementById('build-replace-legend'),
    buildSnapLegend: document.getElementById('build-snap-legend'),
    tutorialSkipLegend: document.getElementById('tutorial-skip-legend'),
    buildingMoveLegend: document.getElementById('building-move-legend'),
    buildingMoveLegendLine1: document.getElementById('building-move-legend-line1'),
    buildingMoveLegendLine2: document.getElementById('building-move-legend-line2'),
    buildingMoveLegendLine3: document.getElementById('building-move-legend-line3'),
    fishMergeLegend: document.getElementById('fish-merge-legend'),
    hotkeyLegendEsc: document.getElementById('hotkey-legend-esc'),
    hotkeyLegendE: document.getElementById('hotkey-legend-e'),
    hotkeyLegendQ: document.getElementById('hotkey-legend-q'),
    hotkeyLegendUndo: document.getElementById('hotkey-legend-undo'),
    hotkeyLegendAlt: document.getElementById('hotkey-legend-alt'),
    tutorialOverlay: document.getElementById('tutorial-overlay'),
    tutorialText: document.getElementById('tutorial-text'),
    powerGraphCanvas: document.getElementById('hud-power-graph-canvas'),
    minimapExpandBtn: document.getElementById('minimap-expand-btn'),
    timePauseBtn: document.getElementById('time-pause-btn'),
    timeSpeedBtn: document.getElementById('time-speed-btn'),
    pauseMenuBtn: document.getElementById('pause-menu-btn'),
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
    toolMergeBtn: document.getElementById('tool-merge-btn'),
    toolBlueprintBtn: document.getElementById('tool-blueprint-btn'),
    favoriteSlotBtns: [
      document.getElementById('tool-favorite-1-btn'),
      document.getElementById('tool-favorite-2-btn'),
      document.getElementById('tool-favorite-3-btn'),
    ],
    hotkeyLegendF: document.getElementById('hotkey-legend-f'),
    buildToolGrid: document.getElementById('build-tool-grid'),
    pauseOverlay: document.getElementById('pause-overlay'),
    pauseMenu: document.getElementById('pause-menu'),
    pauseMain: document.getElementById('pause-main'),
    pauseSettings: document.getElementById('pause-settings'),
    pauseResumeBtn: document.getElementById('pause-resume-btn'),
    pauseSaveBtn: document.getElementById('pause-save-btn'),
    pauseLoadSaveBtn: document.getElementById('pause-load-save-btn'),
    pauseRestartBtn: document.getElementById('pause-restart-btn'),
    pauseMainMenuBtn: document.getElementById('pause-main-menu-btn'),
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
    recipeOverlay: document.getElementById('recipe-overlay'),
    recipeMenuAnchor: document.getElementById('recipe-menu-anchor'),
    recipeMenu: document.getElementById('recipe-menu'),
    recipeMenuTitle: document.getElementById('recipe-menu-title'),
    recipeMenuOptions: document.getElementById('recipe-menu-options'),
    recipeMenuStats: document.getElementById('recipe-menu-stats'),
    buildingInfoOverlay: document.getElementById('building-info-overlay'),
    buildingInfoAnchor: document.getElementById('building-info-anchor'),
    buildingInfoMenu: document.getElementById('building-info-menu'),
    buildingInfoIcon: document.getElementById('building-info-icon'),
    buildingInfoName: document.getElementById('building-info-name'),
    buildingInfoDesc: document.getElementById('building-info-desc'),
    buildingInfoStats: document.getElementById('building-info-stats'),
    buildingInfoLiveStats: document.getElementById('building-info-live-stats'),
    fishInfoOverlay: document.getElementById('fish-info-overlay'),
    fishInfoAnchor: document.getElementById('fish-info-anchor'),
    fishInfoMenu: document.getElementById('fish-info-menu'),
    fishInfoIconCanvas: document.getElementById('fish-info-icon-canvas'),
    fishInfoName: document.getElementById('fish-info-name'),
    fishInfoDesc: document.getElementById('fish-info-desc'),
    fishInfoStats: document.getElementById('fish-info-stats'),
    fishInfoMergeTitle: document.getElementById('fish-info-merge-title'),
    fishInfoMergeLines: document.getElementById('fish-info-merge-lines'),
    platformFilterOverlay: document.getElementById('platform-filter-overlay'),
    platformFilterAnchor: document.getElementById('platform-filter-anchor'),
    platformFilterMenu: document.getElementById('platform-filter-menu'),
    platformFilterTitle: document.getElementById('platform-filter-title'),
    platformFilterClearBtn: document.getElementById('platform-filter-clear-btn'),
    platformFilterItems: document.getElementById('platform-filter-items'),
    platformFilterHint: document.getElementById('platform-filter-hint'),
    platformFilterFanNote: document.getElementById('platform-filter-fan-note'),
    storageChestOverlay: document.getElementById('storage-chest-overlay'),
    storageChestAnchor: document.getElementById('storage-chest-anchor'),
    storageChestMenu: document.getElementById('storage-chest-menu'),
    storageChestTitle: document.getElementById('storage-chest-title'),
    storageChestIcon: document.getElementById('storage-chest-icon'),
    storageChestCount: document.getElementById('storage-chest-count'),
    storageChestStopBtn: document.getElementById('storage-chest-stop-btn'),
    storageChestHint: document.getElementById('storage-chest-hint'),
    labOverlay: document.getElementById('lab-overlay'),
    labModal: document.getElementById('lab-modal'),
    labScienceReadout: document.getElementById('lab-science-readout'),
    labFilterButtons: document.querySelectorAll('.lab-filter-btn'),
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
    tankAnchor: document.getElementById('tank-anchor'),
    tankPanel: document.getElementById('tank-panel'),
    tankCollapseBtn: document.getElementById('tank-collapse-btn'),
    tankPointsDisplay: document.getElementById('tank-points-display'),
    tankUpgradeList: document.getElementById('tank-upgrade-list'),
    tankTabUpgradesBtn: document.getElementById('tank-tab-upgrades'),
    tankTabAchievementsBtn: document.getElementById('tank-tab-achievements'),
    tankTabCustomizationBtn: document.getElementById('tank-tab-customization'),
    tankViewUpgrades: document.getElementById('tank-view-upgrades'),
    tankViewAchievements: document.getElementById('tank-view-achievements'),
    tankViewCustomization: document.getElementById('tank-view-customization'),
    achievementList: document.getElementById('achievement-list'),
    achievementGemsDisplay: document.getElementById('achievement-gems-display'),
    hatGrid: document.getElementById('hat-grid'),
    customizationGemsDisplay: document.getElementById('customization-gems-display'),
    customizationPreviewCanvas: document.getElementById('customization-preview-canvas'),
    startAchievementsBtn: document.getElementById('start-achievements-btn'),
    startCustomizationBtn: document.getElementById('start-customization-btn'),
    startTankBackdrop: document.getElementById('start-tank-backdrop'),
    tankBackBtn: document.getElementById('tank-back-btn'),
    startOverlay: document.getElementById('start-overlay'),
    startNewGameBtn: document.getElementById('start-new-game-btn'),
    startContinueBtn: document.getElementById('start-continue-btn'),
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
  els.recipeOverlay.addEventListener('click', (e) => {
    if (e.target === els.recipeOverlay) closeRecipeMenu(); // clicked the backdrop, not the card — per direct spec ("clicking anywhere else will close the pop-up")
  });
  els.buildingInfoOverlay.addEventListener('click', (e) => {
    if (e.target === els.buildingInfoOverlay) closeBuildingInfoMenu(state); // same "click anywhere else closes it" precedent as the recipe/Mound pop-ups
  });
  els.fishInfoOverlay.addEventListener('click', (e) => {
    if (e.target === els.fishInfoOverlay) closeFishInfoMenu(state); // same "click anywhere else closes it" precedent as every other fly-out pop-up here
  });
  els.platformFilterOverlay.addEventListener('click', (e) => {
    if (e.target === els.platformFilterOverlay) closePlatformFilterMenu(state); // same "click anywhere else closes it" precedent as every other fly-out pop-up here
  });
  els.platformFilterClearBtn.addEventListener('click', () => clearPlatformFilter(state));
  els.storageChestOverlay.addEventListener('click', (e) => {
    if (e.target === els.storageChestOverlay) closeStorageChestModal(); // same "click anywhere else closes it" precedent as every other fly-out pop-up here
  });
  // Right-click-to-close, per direct request — these 4 overlays are
  // `position: fixed; inset: 0` backdrops that sit ON TOP of the game
  // canvas while open (z-index 190), so a right-click anywhere on screen
  // lands on the backdrop itself, never reaching main.js's own canvas
  // `contextmenu` listener (Engine.js's rightClickHandlers) at all — the
  // existing left-click "click the backdrop closes it" listeners above
  // don't cover this at all, since `contextmenu` is a separate event.
  // preventDefault stops the browser's own right-click context menu from
  // popping up in its place, same as Engine.js already does for the canvas.
  for (const overlay of [els.recipeOverlay, els.buildingInfoOverlay, els.fishInfoOverlay, els.platformFilterOverlay, els.storageChestOverlay]) {
    overlay.addEventListener('contextmenu', (e) => {
      if (e.target !== overlay) return; // right-clicked the card itself, not empty backdrop space — leave it open
      e.preventDefault();
      closeRecipeMenu();
      closeBuildingInfoMenu(state);
      closeFishInfoMenu(state);
      closePlatformFilterMenu(state);
      closeStorageChestModal();
    });
  }
  els.storageChestStopBtn.addEventListener('click', () => {
    if (!storageChestTileKey) return;
    toggleChestTrickle(state, storageChestTileKey);
    refreshStorageChestModal(state);
  });
  // No Clear Chest button any more — per direct request, replaced entirely
  // by the right-click-drag gesture (main.js's chestClearDragKey/
  // clearChestContents call), which mimics the left-drag trickle-arm
  // gesture exactly but fires an immediate staggered dump instead.

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

  // Filter buttons (No Filter/Buildings/Recipes/Fish/Other) — per direct
  // request, darkens every node NOT matching the chosen category. See
  // labNodeCategory/applyLabFilter below.
  els.labFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      labFilterCategory = btn.dataset.filter;
      els.labFilterButtons.forEach((b) => b.classList.toggle('selected', b === btn));
      applyLabFilter();
    });
  });

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
      pushUiNotification(state, FOUND_THE_CHAT_MESSAGE);
    }
  });

  els.toolFoodBtn.addEventListener('click', () => selectTool(state, 'food'));
  // Merge tool (🧤) — combining/splicing fish now requires this to be
  // selected first, per direct request, instead of firing on any mousedown
  // that happened to land on an eligible fish regardless of tool. Also the
  // first-time merge tutorial's own 'switch' step target — a no-op unless
  // that exact flow/step is currently active, so safe to call unconditionally.
  els.toolMergeBtn.addEventListener('click', () => {
    selectTool(state, 'merge');
    advanceTutorialFlow(state, 'mergefish', 'switch');
  });
  // Blueprint ("Stamp") — the 4th bottom-tool-bar tool, per direct request:
  // click-and-drag a box over a built area to copy it, then click again to
  // paste that whole layout elsewhere. All the actual drag-select/paste
  // mechanics live in main.js (mouse handlers, module-local clipboard state)
  // — this button just arms the tool, same as every other one here.
  els.toolBlueprintBtn.addEventListener('click', () => selectTool(state, 'blueprint'));

  els.shopCollapseBtn.addEventListener('click', () => {
    toggleShopCollapse(state);
    // Guided tutorials that stop on this exact button (game-start and
    // post-alien flows both open with "click the Shop") advance the moment
    // it's actually open — see advanceTutorialFlow.
    if (!state.ui.shopCollapsed) {
      advanceTutorialFlow(state, 'start', 'shop');
      advanceTutorialFlow(state, 'postalien', 'shop');
      advanceTutorialFlow(state, 'chest', 'shop');
    }
  });
  els.tankCollapseBtn.addEventListener('click', () => {
    toggleTankPanel(state);
  });

  // The dedicated pause-menu button is gone per direct request — Escape is
  // the only way to open/close the pause menu now (main.js's keydown
  // handler, togglePauseMenu still does the actual work either way).
  els.pauseResumeBtn.addEventListener('click', () => closePauseMenu(state));
  els.pauseSaveBtn.addEventListener('click', () => saveGameFromPause(state));
  els.pauseLoadSaveBtn.addEventListener('click', () => loadLastSaveFromPause(state));
  els.pauseRestartBtn.addEventListener('click', () => restartLevel(state));
  els.pauseMainMenuBtn.addEventListener('click', () => returnToMainMenuFromPause(state));
  // minimap-expand-btn is wired in main.js now, not here — per direct
  // report, the button was supposed to control the real tank-viewport zoom
  // (camera.zoom, main.js's own domain), not the minimap's display size,
  // which UI.js's toggleMinimapExpanded used to (wrongly) control. See
  // main.js's toggleTankZoomMode.
  els.timePauseBtn.addEventListener('click', () => toggleTimePause(state));
  els.timeSpeedBtn.addEventListener('click', () => toggleSpeedX2(state));
  els.pauseMenuBtn.addEventListener('click', () => togglePauseMenu(state));
  els.bossVictoryRestartBtn.addEventListener('click', () => {
    els.bossVictoryOverlay.classList.remove('visible');
    els.bossVictoryOverlay.classList.add('hidden');
    restartLevel(state);
  });
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
    // The graph popup used to require its own Tank Upgrade unlock; per a
    // later direct request ("give... the electricity graph to the player at
    // the very start") it's unconditional now, same as the mw text readout
    // itself (still gated only on Electric Eel being unlocked at all — see
    // updateHUD's own concern).
    powerGraphOpen = !powerGraphOpen;
    els.powerGraph.classList.toggle('hidden', !powerGraphOpen);
    els.powerArrow.classList.toggle('open', powerGraphOpen); // flips the chevron to point up while the graph is showing
    if (powerGraphOpen) { positionPowerGraph(state); renderPowerGraph(state); }
    (powerGraphOpen ? playPanelOpen : playPanelClose)();
  });

  // The 3 clickable HUD stats — see HUD_INFO_DATA/openHudInfoModal above.
  // Click opens/toggles the info modal; hover shows a cursor-following "?"
  // bubble hinting that a click does something (per direct request). The
  // modal itself closes on ANY other click or hotkey — see the document-level
  // listeners just below.
  for (const key of Object.keys(HUD_INFO_DATA)) {
    const el = els[key];
    el.addEventListener('click', (e) => { e.stopPropagation(); openHudInfoModal(state, key); });
    el.addEventListener('mouseenter', () => els.hudHoverBubble.classList.remove('hidden'));
    el.addEventListener('mousemove', (e) => {
      els.hudHoverBubble.style.left = `${e.clientX + 14}px`;
      els.hudHoverBubble.style.top = `${e.clientY - 10}px`;
    });
    el.addEventListener('mouseleave', () => els.hudHoverBubble.classList.add('hidden'));
  }
  // Click anywhere that isn't the modal itself or one of its 3 trigger
  // elements closes it — per direct request ("disappear when anything else
  // is clicked"). The triggers stopPropagation above so their own click
  // (which may instead be a re-open of a DIFFERENT stat, handled by
  // openHudInfoModal's own toggle logic) doesn't immediately re-close it here.
  document.addEventListener('click', () => closeHudInfoModal());
  // "...or any other hotkey is clicked" — any keydown closes it too.
  document.addEventListener('keydown', () => closeHudInfoModal());

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
  buildFavoriteSlots(state);
  buildTankPanel(state);
  buildAchievementPanel(state);
  buildCustomizationPanel(state);
  buildLabTree(state);
  initLabTreeDrag(state);
  scheduleSheenAll();

  els.tankTabUpgradesBtn.addEventListener('click', () => setTankPanelView(state, 'upgrades'));
  els.tankTabAchievementsBtn.addEventListener('click', () => setTankPanelView(state, 'achievements'));
  els.tankTabCustomizationBtn.addEventListener('click', () => setTankPanelView(state, 'customization'));
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
  // call site. Idempotent: once deselected, selectedTool is 'cursor', so a
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
    maybeBounceAchievementTabFirstOpen(state);
  }
  updateTankPanelCollapse(state);
  (state.ui.tankPanelCollapsed ? playPanelClose : playPanelOpen)();
}

function updateTankPanelCollapse(state) {
  els.tankPanel.classList.toggle('collapsed', state.ui.tankPanelCollapsed);
  els.tankCollapseBtn.classList.toggle('panel-toggle-active', !state.ui.tankPanelCollapsed);
  if (state.ui.tankPanelCollapsed) {
    stopCustomizationPreviewAnimation(); // no point animating a preview nobody can see, regardless of which view was showing
  } else {
    refreshTankPanelView(state); // populate whichever of the 3 views is currently showing, fresh the moment the panel opens, not just on the next frame's updateHUD
    if (state.ui.tankPanelView === 'customization') startCustomizationPreviewAnimation(state);
  }
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

// ---- Time-manipulation HUD buttons (Pause Time / 2x Speed) ----
// Per direct request — both live under the minimap alongside its own
// expand/minimize button. Each is a shared toggle (exported so main.js's
// Space/KeyX hotkeys call the exact same function the button's own click
// listener does below), so the button's icon/active-state can never drift
// out of sync with whichever path actually flipped the flag. Unlike
// togglePauseMenu, neither freezes/unfreezes via a DOM show/hide — main.js's
// update()/createGameLoop read state.ui.timePaused/speedX2 directly every
// tick (see update()'s and getTimeScale's own comments) — this function's
// only job is the flag flip plus the button's own visual state.
// Per a later direct request ("I shouldn't be able to click pause time and
// 2x time [at once]... if pause time is chosen, it should de-select 2x
// speed"), the two are now mutually exclusive both directions — turning one
// on always forces the other off — rather than each just toggling
// independently. refreshTimeControlButtons keeps both buttons' visuals (and
// the underwater-muffle/pitch-boost music effects — see Sound.js) in sync
// with whatever the two flags actually are after any change, regardless of
// which one just changed.
function refreshTimeControlButtons(state) {
  els.timePauseBtn.textContent = state.ui.timePaused ? '▶️' : '⏸️';
  els.timePauseBtn.title = state.ui.timePaused ? 'Resume Time (Space)' : 'Pause Time (Space)';
  els.timePauseBtn.classList.toggle('active', state.ui.timePaused);
  els.timeSpeedBtn.classList.toggle('active', state.ui.speedX2);
  setMusicUnderwaterMuffle(state.ui.timePaused);
  setMusicSpeedBoost(state.ui.speedX2);
  setMusicPaused(state.ui.timePaused); // per direct request ("slow down music 2% for paused time") — a small playbackRate dip layered on top of the existing muffle effect, see Sound.js
}

export function toggleTimePause(state) {
  state.ui.timePaused = !state.ui.timePaused;
  if (state.ui.timePaused) state.ui.speedX2 = false; // mutually exclusive — see this section's own comment
  refreshTimeControlButtons(state);
}

export function toggleSpeedX2(state) {
  state.ui.speedX2 = !state.ui.speedX2;
  if (state.ui.speedX2) state.ui.timePaused = false; // mutually exclusive — see this section's own comment
  refreshTimeControlButtons(state);
}

// ---- Alt-mode ----
// Per direct request — a toggle hotkey (Alt, wired in main.js) that hides
// every piece of persistent HUD/UI chrome (style.css's body.alt-mode rules)
// for a clean, unobstructed view of the tank. A single class on <body> is
// what actually hides everything — this function's only other job is the
// one line of the bottom-left legend that's exempt from that blanket hide
// (#hotkey-legend-alt), which needs its own live re-wording the same way
// every other legend line in this file already gets.
export function toggleAltMode(state) {
  state.ui.altMode = !state.ui.altMode;
  document.body.classList.toggle('alt-mode', state.ui.altMode);
  els.hotkeyLegendAlt.textContent = state.ui.altMode ? 'Alt: Turn OFF Alt-mode' : 'Alt: Turn on Alt-mode';
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

// ---- Manufacturer/Power Plant recipe pop-up ----
// Per direct spec: clicking a placed Manufacturer or Power Plant tile
// "quickly fl[ies] out a small pop-up menu that looks like a miniature
// shop," one icon per recipe with a small caption underneath, toggle-able,
// closing on any click elsewhere. Opened by main.js's click handler via
// Grid.js's getRecipeBuildingKeyAt; `tileKey` is the "row,col" buildingData
// key of the clicked tile. Doesn't freeze the sim — same lightweight,
// non-blocking popup precedent the Mound's own menu already set. Reuses
// that exact fly-out-of-its-anchor mechanic (see openMoundMenu above).
const RECIPE_MENU_TRANSITION_MS = 220; // must match #recipe-menu's CSS transition duration

export function openRecipeMenu(state, tileKey) {
  recipeMenuOpen = true;
  recipeMenuClosing = false;
  recipeMenuTileKey = tileKey;
  if (recipeMenuCloseTimer !== null) { clearTimeout(recipeMenuCloseTimer); recipeMenuCloseTimer = null; }
  closeSidePanels(state); // keep the Shop/Tank Upgrades panel from sitting open behind this, same as the Lab
  els.recipeOverlay.classList.remove('hidden');
  refreshRecipeMenu(state);
  updateRecipeMenuPosition(state); // position it correctly before the reveal so it doesn't flash at (0,0) first

  els.recipeMenu.classList.add('recipe-menu-closed');
  void els.recipeMenu.offsetWidth; // forced reflow — same retrigger trick every other one-shot transition in this file uses
  els.recipeMenu.classList.remove('recipe-menu-closed');
  playPanelOpen();
}

export function closeRecipeMenu() {
  if (!recipeMenuOpen) return;
  recipeMenuOpen = false;
  recipeMenuClosing = true;
  recipeMenuTileKey = null;
  els.recipeMenu.classList.add('recipe-menu-closed');
  recipeMenuCloseTimer = setTimeout(() => {
    els.recipeOverlay.classList.add('hidden');
    recipeMenuClosing = false;
    recipeMenuCloseTimer = null;
  }, RECIPE_MENU_TRANSITION_MS);
  playPanelClose();
}

// Generic "what is this and what does it do" pop-up for any OTHER placed
// building (Manufacturer/Power Plant get their own recipe pop-up instead —
// see main.js's click handler, which only ever calls this once
// getRecipeBuildingKeyAt has already come back null) — per direct request
// ("any building can be quickly clicked on to see what it is and what it
// does," showing "the info that would normally show up in the shop
// window"). Same fly-out-of-its-anchor mechanic as openRecipeMenu above,
// just read-only content (icon/name/description/stats) instead of clickable
// recipe options.
const BUILDING_INFO_MENU_TRANSITION_MS = 220; // must match #building-info-menu's CSS transition duration

export function openBuildingInfoMenu(state, tileKey) {
  buildingInfoMenuOpen = true;
  buildingInfoMenuClosing = false;
  buildingInfoTileKey = tileKey;
  state.ui.buildingInfoTileKey = tileKey; // cross-module mirror — Grid.js can't import UI.js's own module-local var, see renderFanIndicators' fan-cone highlight
  if (buildingInfoMenuCloseTimer !== null) { clearTimeout(buildingInfoMenuCloseTimer); buildingInfoMenuCloseTimer = null; }
  closeSidePanels(state);
  els.buildingInfoOverlay.classList.remove('hidden');
  refreshBuildingInfoMenu(state);
  updateBuildingInfoMenuPosition(state);

  els.buildingInfoMenu.classList.add('building-info-menu-closed');
  void els.buildingInfoMenu.offsetWidth;
  els.buildingInfoMenu.classList.remove('building-info-menu-closed');
  playPanelOpen();
}

export function closeBuildingInfoMenu(state) {
  if (!buildingInfoMenuOpen) return;
  buildingInfoMenuOpen = false;
  buildingInfoMenuClosing = true;
  buildingInfoTileKey = null;
  state.ui.buildingInfoTileKey = null;
  els.buildingInfoMenu.classList.add('building-info-menu-closed');
  buildingInfoMenuCloseTimer = setTimeout(() => {
    els.buildingInfoOverlay.classList.add('hidden');
    buildingInfoMenuClosing = false;
    buildingInfoMenuCloseTimer = null;
  }, BUILDING_INFO_MENU_TRANSITION_MS);
  playPanelClose();
}

function updateBuildingInfoMenuPosition(state) {
  if (!buildingInfoTileKey) return;
  const [row, col] = buildingInfoTileKey.split(',').map(Number);
  const worldX = col * TILE_SIZE + TILE_SIZE / 2;
  const worldY = row * TILE_SIZE;
  const screen = worldToScreen(worldX, worldY, state.camera);
  els.buildingInfoAnchor.style.left = `${screen.x}px`;
  els.buildingInfoAnchor.style.top = `${screen.y - MOUND_MENU_GAP_PX}px`;
}

// Only rebuilds on open (same "don't rebuild every frame" fix the recipe
// menu's own refreshRecipeMenu comment documents — this content is
// completely static per building type anyway, so there's even less reason
// to redo it every frame); the per-frame check in updateHUD just closes the
// popup if the underlying tile gets demolished out from under it.
function refreshBuildingInfoMenu(state) {
  if (!buildingInfoTileKey) return;
  const data = state.level.buildingData[buildingInfoTileKey];
  const type = data ? data.type : (() => {
    const [row, col] = buildingInfoTileKey.split(',').map(Number);
    return getTile(state.level.grid, col, row);
  })();
  if (!type) { closeBuildingInfoMenu(state); return; }
  const def = BUILDING_TYPES[type];
  if (!def) { closeBuildingInfoMenu(state); return; }
  els.buildingInfoIcon.textContent = def.icon;
  els.buildingInfoName.textContent = def.name;
  els.buildingInfoDesc.textContent = def.description;
  els.buildingInfoStats.innerHTML = buildingStatsHtml(type);
  refreshBuildingInfoLiveStats(state);
}

// Live power draw + rolling 3-minute uptime — per direct request
// ("efficiency/energy readout on click on building... for players
// optimizing layouts"). Unlike the rest of this pop-up's content (built
// once on open — see refreshBuildingInfoMenu's own comment), these two
// numbers change continuously while the tile is open, so they're refreshed
// every frame from updateHUD instead, mirroring the recipe menu's own
// "lighter per-frame check" pattern rather than rebuilding the whole popup.
function refreshBuildingInfoLiveStats(state) {
  if (!buildingInfoTileKey) return;
  const data = state.level.buildingData[buildingInfoTileKey];
  if (!data) { els.buildingInfoLiveStats.innerHTML = ''; return; }
  const [row, col] = buildingInfoTileKey.split(',').map(Number);
  const centerX = col * TILE_SIZE + TILE_SIZE / 2;
  const centerY = row * TILE_SIZE + TILE_SIZE / 2;
  const draw = getBuildingCurrentPowerDraw(state, data.type, data, centerX, centerY);
  const uptimeFraction = getBuildingUptimeFraction(data);
  let powerLine;
  if (draw < 0) powerLine = `⚡ Generating <b>${-draw}mw</b>`;
  else if (draw > 0) powerLine = `⚡ Consuming <b>${draw}mw</b>`;
  else powerLine = `⚡ <b>Idle</b> (0mw)`;
  const uptimeLine = uptimeFraction === null
    ? '⏱️ Uptime: <b>warming up...</b>'
    : `⏱️ Uptime (3 min): <b>${Math.round(uptimeFraction * 100)}%</b>`;
  let html = `<div class="building-stat">${powerLine}</div><div class="building-stat">${uptimeLine}</div>`;
  if (TURRET_AMMO_TILES.has(data.type)) {
    const ammoWaste = data.ammoWaste || 0;
    const ammoBiomass = data.ammoBiomass || 0;
    // Per direct request ("change the ammo in the turret modal to not say
    // out of 50 in the parentheses, just the total amount of shots") — was
    // "(${totalAmmo}/${WASTE_TURRET_MAX_AMMO})"; the cap number added
    // nothing a player could act on mid-fight, just noise next to the count
    // that actually matters.
    const totalAmmo = ammoWaste + ammoBiomass;
    const ammoLine = `${itemIconImgHtml('waste')} <b>${ammoWaste}</b> · ${itemIconImgHtml('biomass')} <b>${ammoBiomass}</b> (${totalAmmo})`;
    html += `<div class="building-stat">${ammoLine}</div>`;
  } else if (data.type === TILE_TURRET_ADVANCED) {
    // The Advanced Turret's own separate, optional Biomass-only reserve —
    // per direct request. Always shown (unlike the ammo-tier line above,
    // which only shows for a turret that's IN TURRET_AMMO_TILES at all)
    // since it's worth knowing whether a loaded shot is about to fire at
    // ADVANCED_TURRET_BIOMASS_DAMAGE even for a turret that's currently empty.
    const ammoBiomassAdvanced = data.ammoBiomassAdvanced || 0;
    const ammoLine = `${itemIconImgHtml('biomass')} <b>${ammoBiomassAdvanced}</b> (optional, +${ADVANCED_TURRET_BIOMASS_DAMAGE} dmg/shot)`;
    html += `<div class="building-stat">${ammoLine}</div>`;
  }
  els.buildingInfoLiveStats.innerHTML = html;
}

// ---- Fish info modal ----
// Per direct request ("click on every fish when no cursor is selected to
// bring up the fish modal like the building modal... gold/min (if
// applicable)... waste/min... science/min (if applicable)... food/min...
// list any available hybrids available here like in the hover for the
// merge tool"). Same fly-out-of-its-anchor mechanic as the building info
// pop-up above; the locked/highlighted fish itself is main.js's job (it
// owns state.level.entities), driven by state.ui.fishInfoModalFishId which
// this module writes.
export function openFishInfoMenu(state, fishId) {
  const fish = state.level.entities.find((e) => e.id === fishId && e.type === 'fish');
  if (!fish) return;
  fishInfoMenuOpen = true;
  fishInfoMenuClosing = false;
  state.ui.fishInfoModalFishId = fishId;
  state.ui.fishInfoModalFrozenX = fish.x;
  state.ui.fishInfoModalFrozenY = fish.y;
  state.ui.fishInfoModalFrozenGeneratedMw = fish.lastGeneratedMw || 0; // see this field's own comment in main.js's initial ui state
  if (fishInfoMenuCloseTimer !== null) { clearTimeout(fishInfoMenuCloseTimer); fishInfoMenuCloseTimer = null; }
  closeSidePanels(state);
  els.fishInfoOverlay.classList.remove('hidden');
  refreshFishInfoMenu(state);
  updateFishInfoMenuPosition(state);

  els.fishInfoMenu.classList.add('fish-info-menu-closed');
  void els.fishInfoMenu.offsetWidth;
  els.fishInfoMenu.classList.remove('fish-info-menu-closed');
  playPanelOpen();
}

export function closeFishInfoMenu(state) {
  if (!fishInfoMenuOpen) return;
  fishInfoMenuOpen = false;
  fishInfoMenuClosing = true;
  // Per direct follow-up request ("fish should be able to move as soon as
  // the modal disappears") — real bug fix: updateFish's own wander() still
  // runs every tick while the fish is frozen (main.js's
  // updateFishInfoModalFreeze only overrides its position/velocity AFTER
  // updateEntities, it doesn't skip the fish's own AI), so wanderTimer keeps
  // counting down and can fire — assigning a fresh heading that then gets
  // immediately stomped back to 0 by the freeze override — while the modal
  // is still open. Without this reset, unfreezing left the fish sitting at
  // vx=vy=0 until THAT stolen heading's own full next interval (up to
  // WANDER_INTERVAL_MAX_S, ~2s) elapsed on its own. Zeroing it here forces
  // wander() to immediately pick a fresh heading on the very next real tick.
  const fish = state.level.entities.find((e) => e.id === state.ui.fishInfoModalFishId && e.type === 'fish');
  if (fish) fish.wanderTimer = 0;
  state.ui.fishInfoModalFishId = null; // unfreezes/un-highlights the fish — see main.js's updateFishInfoModalFreeze/render
  els.fishInfoMenu.classList.add('fish-info-menu-closed');
  fishInfoMenuCloseTimer = setTimeout(() => {
    els.fishInfoOverlay.classList.add('hidden');
    fishInfoMenuClosing = false;
    fishInfoMenuCloseTimer = null;
  }, FISH_INFO_MENU_TRANSITION_MS);
  playPanelClose();
}

// A building's own info-modal anchor (MOUND_MENU_GAP_PX) works fine off a
// tile's TOP edge, but a fish's x/y is its sprite's CENTER, not its top —
// the same flat 12px gap left the modal visibly touching/overlapping the
// fish's own head per direct report ("move the info modal up slightly on
// all the fish so it's not touching the top of the fish"). A bigger flat
// gap (not zoom-scaled, same convention every other one of these popups
// already uses) clears a typical adult fish's sprite comfortably.
const FISH_INFO_MENU_GAP_PX = 34;
function updateFishInfoMenuPosition(state) {
  const screen = worldToScreen(state.ui.fishInfoModalFrozenX, state.ui.fishInfoModalFrozenY, state.camera);
  els.fishInfoAnchor.style.left = `${screen.x}px`;
  els.fishInfoAnchor.style.top = `${screen.y - FISH_INFO_MENU_GAP_PX}px`;
}

function fishStatRowHtml(label, perMin, penaltyPerMin) {
  const penalty = penaltyPerMin > 0.05 ? ` <span class="fish-info-penalty">(-${penaltyPerMin.toFixed(1)})</span>` : '';
  return `<div>${label}: <b>${perMin.toFixed(1)}</b>${penalty}</div>`;
}

// Rebuilds the whole pop-up every frame it's open (unlike the building
// info pop-up, which only rebuilds on open) — every one of these numbers
// (gold/min, the dirtiness penalty, the merge/splice partner list) can
// change from one frame to the next while it's sitting there open (the
// player feeding/cleaning the tank, another fish growing up nearby), so
// there's no "static content" half to split off the way
// refreshBuildingInfoLiveStats does.
export function refreshFishInfoMenu(state) {
  if (!fishInfoMenuOpen) return;
  const fishId = state.ui.fishInfoModalFishId;
  const fish = state.level.entities.find((e) => e.id === fishId && e.type === 'fish');
  if (!fish) { closeFishInfoMenu(state); return; }
  const def = SPECIES[fish.speciesId];
  els.fishInfoName.textContent = def.name;
  els.fishInfoDesc.textContent = def.description;
  // A real drawFish preview instead of an emoji — fish SPECIES rows have no
  // `icon` field at all (they're canvas-drawn, not emoji), unlike a
  // building. Same drawFish call the shop's own preview canvas uses, just a
  // static single frame (no swim-facing animation loop) since this modal
  // rebuilds every frame anyway.
  const iconCtx = els.fishInfoIconCanvas.getContext('2d');
  const iconSize = els.fishInfoIconCanvas.width;
  iconCtx.clearRect(0, 0, iconSize, iconSize);
  drawFish(iconCtx, iconSize / 2, iconSize / 2, fish.speciesId, def.growthStages.length - 1, 1, 0, { x: 1, y: 0 }, fish.starTier || 1);

  const stats = computeFishInfoModalStats(state, fish);
  const rows = [];
  if (stats.goldPerMin != null) rows.push(fishStatRowHtml('Gold/min', stats.goldPerMin, stats.goldPenaltyPerMin));
  if (stats.wastePerMin != null) rows.push(`<div>Waste/min: <b>${stats.wastePerMin.toFixed(1)}</b></div>`);
  if (stats.wasteEatenPerMin != null) rows.push(`<div>Waste eaten/min: <b>${stats.wasteEatenPerMin.toFixed(1)}</b></div>`);
  if (stats.sciencePerMin != null) rows.push(`<div>Science/min: <b>${stats.sciencePerMin.toFixed(1)}</b></div>`);
  if (stats.foodPerMin != null) rows.push(`<div>Food/min: <b>${stats.foodPerMin.toFixed(1)}</b></div>`);
  if (stats.generatedMwLastSec != null) rows.push(`<div>⚡ Electricity generated: <b>${stats.generatedMwLastSec}mw</b></div>`);
  els.fishInfoStats.innerHTML = rows.join('');

  const mergeLines = describeFishMergeOptions(state, fish);
  els.fishInfoMergeTitle.classList.toggle('hidden', mergeLines == null);
  els.fishInfoMergeLines.classList.toggle('hidden', mergeLines == null);
  // The modal keeps the full text sentence, per direct request ("Keep the
  // fish info modal text for the available merges as it is now") — only the
  // bottom-left hover legend (refreshFishMergeLegendIcons below) switched to
  // icons.
  if (mergeLines != null) els.fishInfoMergeLines.innerHTML = mergeLines.map((entry) => `<div>${entry.text}</div>`).join('');

  updateFishInfoMenuPosition(state);
}

// ---- Platform item-filter pop-up ----
// Per direct spec: left-clicking a placed Platform (any of its 5 variants)
// opens a small pop-up, "like the recipe modals" — same fly-out-of-its-
// anchor mechanic as openRecipeMenu/openBuildingInfoMenu above. Whitelist-
// only, per a later direct simplification ("remove the red X button and the
// green checkmark [mode buttons] completely... by default, have all the
// objects... look like they are blacklisted with the red x on them, and if
// you click them, they toggle to a green checkmark"): every item type in
// the grid starts OUT of that tile's `filterItems` array (shown red-X,
// still collides normally — the exact behavior a plain Platform always
// had), and clicking one just toggles its own membership directly, no mode
// selection needed first. Clear All resets the whole list back to empty
// (every item red-X again) — see Grid.js's platformIgnoresItem, which reads
// this same field for the real collision-skip check.
const PLATFORM_FILTER_MENU_TRANSITION_MS = 220; // must match #platform-filter-menu's CSS transition duration

export function openPlatformFilterMenu(state, tileKey) {
  platformFilterMenuOpen = true;
  platformFilterMenuClosing = false;
  platformFilterTileKey = tileKey;
  platformFilterFishId = null; // mutually exclusive with a Magnet Fish's own use of this same pop-up
  if (platformFilterMenuCloseTimer !== null) { clearTimeout(platformFilterMenuCloseTimer); platformFilterMenuCloseTimer = null; }
  closeSidePanels(state); // keep the Shop/Tank Upgrades panel from sitting open behind this, same as every other fly-out pop-up
  els.platformFilterOverlay.classList.remove('hidden');
  refreshPlatformFilterMenu(state);
  updatePlatformFilterMenuPosition(state); // position it correctly before the reveal so it doesn't flash at (0,0) first

  els.platformFilterMenu.classList.add('platform-filter-menu-closed');
  void els.platformFilterMenu.offsetWidth; // forced reflow — same retrigger trick every other one-shot transition in this file uses
  els.platformFilterMenu.classList.remove('platform-filter-menu-closed');
  playPanelOpen();
}

// Magnet Fish's own use of the exact same filter pop-up — per direct
// request ("right click on the buffer fish, bring up a filter modal like on
// platforms to allow which object(s) the buffer fish attracts"). Reuses
// every DOM element/transition/position-tracking mechanism
// openPlatformFilterMenu already has; refreshPlatformFilterMenu/
// updatePlatformFilterMenuPosition/togglePlatformFilterItem/
// clearPlatformFilter each branch on platformFilterFishId vs
// platformFilterTileKey to read/write fish.magnetFilterItems instead of a
// building's data.filterItems.
export function openMagnetFishFilterMenu(state, fishId) {
  platformFilterMenuOpen = true;
  platformFilterMenuClosing = false;
  platformFilterFishId = fishId;
  platformFilterTileKey = null;
  // Freezes the fish in place while this pop-up is open, same as the fish
  // info modal — per direct request. state.ui.magnetFishFilterModalFishId is
  // main.js's own cross-module flag to read (it owns state.level.entities,
  // UI.js doesn't reach in and mutate fish position itself) — see
  // updateFishInfoModalFreeze's sibling handling for this field.
  const fish = state.level.entities.find((e) => e.id === fishId && e.type === 'fish');
  if (fish) {
    state.ui.magnetFishFilterModalFishId = fishId;
    state.ui.magnetFishFilterModalFrozenX = fish.x;
    state.ui.magnetFishFilterModalFrozenY = fish.y;
  }
  if (platformFilterMenuCloseTimer !== null) { clearTimeout(platformFilterMenuCloseTimer); platformFilterMenuCloseTimer = null; }
  closeSidePanels(state);
  els.platformFilterOverlay.classList.remove('hidden');
  refreshPlatformFilterMenu(state);
  updatePlatformFilterMenuPosition(state);

  els.platformFilterMenu.classList.add('platform-filter-menu-closed');
  void els.platformFilterMenu.offsetWidth;
  els.platformFilterMenu.classList.remove('platform-filter-menu-closed');
  playPanelOpen();
}

export function closePlatformFilterMenu(state) {
  if (!platformFilterMenuOpen) return;
  platformFilterMenuOpen = false;
  platformFilterMenuClosing = true;
  // Per direct request ("Make it so the magnet fish stops when the filter
  // modal is open just like when the info modal is open") — unfreezes the
  // Magnet Fish here (a plain Platform/Fan filter target has no fish to
  // unfreeze, so this is a no-op for those). Also resets wanderTimer, same
  // real bug fix the fish info modal's own closeFishInfoMenu already needed
  // (see its own comment) — without it, the fish would sit motionless for
  // up to WANDER_INTERVAL_MAX_S after this closes, not "just like" the info
  // modal's own immediate resume.
  if (platformFilterFishId != null && state) {
    const fish = state.level.entities.find((e) => e.id === platformFilterFishId && e.type === 'fish');
    if (fish) fish.wanderTimer = 0;
    state.ui.magnetFishFilterModalFishId = null;
  }
  platformFilterTileKey = null;
  platformFilterFishId = null;
  els.platformFilterMenu.classList.add('platform-filter-menu-closed');
  platformFilterMenuCloseTimer = setTimeout(() => {
    els.platformFilterOverlay.classList.add('hidden');
    platformFilterMenuClosing = false;
    platformFilterMenuCloseTimer = null;
  }, PLATFORM_FILTER_MENU_TRANSITION_MS);
  playPanelClose();
}

// Resolves whichever target (a Platform/Fan tile, or a Magnet Fish) this
// shared pop-up is currently open for — a fish's own worldX/worldY are read
// LIVE every call (not cached), so a Magnet Fish's popup genuinely follows
// it around while it keeps swimming, the same way a building's popup
// already tracks camera pans (both go through this same position function,
// called every frame while open — see updateHUD). Returns null if the
// underlying fish/building is gone (dead, demolished, moved).
function activeFilterTarget(state) {
  if (platformFilterFishId != null) {
    const fish = state.level.entities.find((e) => e.id === platformFilterFishId && e.type === 'fish' && !e.dying);
    if (!fish) return null;
    if (!fish.magnetFilterItems) fish.magnetFilterItems = ['waste']; // lazy-migrate a fish loaded from a save written before this field existed
    return { kind: 'fish', array: fish.magnetFilterItems, worldX: fish.x, worldY: fish.y - 24 };
  }
  if (platformFilterTileKey != null) {
    const data = state.level.buildingData[platformFilterTileKey];
    if (!data) return null;
    const [row, col] = platformFilterTileKey.split(',').map(Number);
    return { kind: 'building', array: data.filterItems, isFan: BUILDING_FAMILIES.fan.includes(data.type), worldX: col * TILE_SIZE + TILE_SIZE / 2, worldY: row * TILE_SIZE };
  }
  return null;
}

function updatePlatformFilterMenuPosition(state) {
  const target = activeFilterTarget(state);
  if (!target) return;
  const screen = worldToScreen(target.worldX, target.worldY, state.camera);
  els.platformFilterAnchor.style.left = `${screen.x}px`;
  els.platformFilterAnchor.style.top = `${screen.y - MOUND_MENU_GAP_PX}px`;
}

// Rebuilds the item grid for whichever Platform/Fan/Magnet Fish this pop-up
// is currently open for — called only on open and after a mutation (item
// toggle, clear all, or a drag-copy landing on this exact tile — see
// copyPlatformFilter below), NOT every frame, same "don't tear down the DOM
// under a real click" fix the recipe menu's own refreshRecipeMenu comment
// documents. The much lighter per-frame check in updateHUD just closes the
// popup if the underlying tile/fish is gone, without touching this DOM at all.
function refreshPlatformFilterMenu(state) {
  const target = activeFilterTarget(state);
  if (!target) { closePlatformFilterMenu(state); return; }

  // Per direct request ("make fans work as filters the same as
  // platforms") — the pop-up itself is fully shared (same fields, same
  // buttons), but a Platform "blocks" an item (collision), a Fan "blows"
  // one (force), and a Magnet Fish "attracts" one (per a later direct
  // request, "bring up a filter modal like on platforms to allow which
  // object(s) the buffer fish attracts") — different enough verbs that a
  // single static copy would read oddly reused verbatim across all three.
  // A Magnet Fish is also the one INCLUDE-list case (checked = attracted,
  // starting from NOTHING attracted) rather than an EXCLUDE-list (checked =
  // let through/not blown, starting from EVERYTHING affected) — the
  // checkbox mechanics underneath (a plain array of item-type ids) are
  // identical either way, only the wording differs.
  els.platformFilterTitle.textContent = target.kind === 'fish' ? 'Magnet Filter' : target.isFan ? 'Fan Filter' : 'Item Filter';
  // Per direct request, the hint also notes the drag-and-drop copy shortcut
  // (main.js's platformFilterDragSourceKey/copyPlatformFilter above) — same
  // "drag one placed tile onto another" gesture the Blueprint tool's own
  // recipe-copy uses, not obvious from the pop-up alone.
  els.platformFilterHint.textContent = target.kind === 'fish'
    ? 'Nothing is attracted by default — click an item to have this fish\'s magnet pull it in too.'
    : target.isFan
      ? 'Everything is blown by default — click an item to exclude it from this fan’s force. Drag this fan onto another to copy its filter.'
      : 'Everything is blocked by default — click an item to let it pass through. Drag this platform onto another to copy its filter.';
  els.platformFilterClearBtn.title = target.kind === 'fish'
    ? 'Back to attracting Waste only'
    : target.isFan
      ? 'Back to a plain Fan — blows everything again'
      : 'Back to a plain, always-solid Platform — everything blocked';
  // Per direct request — a reminder that G toggles every placed Fan's own
  // cone/arrow visuals (main.js's KeyG handler), only relevant while this
  // popup is actually open for a Fan.
  els.platformFilterFanNote.classList.toggle('hidden', !target.isFan);

  els.platformFilterItems.innerHTML = '';
  for (const itemDef of PLATFORM_FILTER_ITEM_TYPES) {
    const isListed = target.array.includes(itemDef.id);
    // A Fan's array is an EXCLUDE list (Grid.js's computeFanForce skips an
    // item in it — "everything is blown by default, click to exclude"), the
    // opposite sense of a Platform's/Magnet Fish's own INCLUDE list — so
    // "this item is actively affected" (blown/passes/attracted) is isListed
    // for those two but !isListed for a Fan. Per direct bug report, the
    // checkmark/red-X and green/red border below were both still keying off
    // the raw isListed for a Fan too, so a freshly-placed Fan (empty
    // exclude array, "blows everything") showed every item as a red ❌
    // "blocked" instead of the intended all-green ✅ "blown."
    const affected = target.isFan ? !isListed : isListed;
    const btn = document.createElement('button');
    btn.className = 'platform-filter-item' + (affected ? ' pass' : ' block');
    // Real item art instead of the plain emoji — per direct request ("change
    // the filter icons in the filter modal to match the actual object in
    // the game rather than use emojis") — same drawItemIconCanvas every
    // Science Lab item-recipe node already uses for its own real-art icon.
    // The emoji is still meaningfully used, as this button's own hover
    // tooltip.
    const icon = document.createElement('canvas');
    icon.className = 'platform-filter-item-icon';
    icon.width = PLATFORM_FILTER_ICON_CANVAS_SIZE;
    icon.height = PLATFORM_FILTER_ICON_CANVAS_SIZE;
    drawItemIconCanvas(icon, itemDef.id);
    btn.title = `${itemDef.icon} ${itemDef.label}`;
    const label = document.createElement('div');
    label.className = 'platform-filter-item-label';
    label.textContent = itemDef.label;
    const badge = document.createElement('div');
    badge.className = 'platform-filter-item-badge';
    badge.textContent = affected ? '✅' : '❌';
    btn.appendChild(icon);
    btn.appendChild(label);
    btn.appendChild(badge);
    btn.addEventListener('click', () => togglePlatformFilterItem(state, itemDef.id));
    els.platformFilterItems.appendChild(btn);
  }
}

// ---- Storage Chest popup ----
// Opened by main.js's click handler (getChestKeyAt) when a placed chest is
// clicked WITHOUT a real aim-drag having just happened. Same anchored-
// flyout open/close/position shape as the Platform filter menu above.
const STORAGE_CHEST_MENU_TRANSITION_MS = 220; // must match #storage-chest-menu's CSS transition duration

export function openStorageChestModal(state, tileKey) {
  storageChestMenuOpen = true;
  storageChestMenuClosing = false;
  storageChestTileKey = tileKey;
  if (storageChestMenuCloseTimer !== null) { clearTimeout(storageChestMenuCloseTimer); storageChestMenuCloseTimer = null; }
  closeSidePanels(state);
  els.storageChestOverlay.classList.remove('hidden');
  refreshStorageChestModal(state);
  updateStorageChestModalPosition(state);

  els.storageChestMenu.classList.add('storage-chest-menu-closed');
  void els.storageChestMenu.offsetWidth; // forced reflow — same retrigger trick every other one-shot transition in this file uses
  els.storageChestMenu.classList.remove('storage-chest-menu-closed');
  playPanelOpen();
}

export function closeStorageChestModal() {
  if (!storageChestMenuOpen) return;
  storageChestMenuOpen = false;
  storageChestMenuClosing = true;
  storageChestTileKey = null;
  els.storageChestMenu.classList.add('storage-chest-menu-closed');
  storageChestMenuCloseTimer = setTimeout(() => {
    els.storageChestOverlay.classList.add('hidden');
    storageChestMenuClosing = false;
    storageChestMenuCloseTimer = null;
  }, STORAGE_CHEST_MENU_TRANSITION_MS);
  playPanelClose();
}

function updateStorageChestModalPosition(state) {
  if (!storageChestTileKey) return;
  const [row, col] = storageChestTileKey.split(',').map(Number);
  const worldX = col * TILE_SIZE + TILE_SIZE / 2;
  const worldY = row * TILE_SIZE;
  const screen = worldToScreen(worldX, worldY, state.camera);
  els.storageChestAnchor.style.left = `${screen.x}px`;
  els.storageChestAnchor.style.top = `${screen.y - MOUND_MENU_GAP_PX}px`;
}

// Re-run on open and after every button press (not every frame — same
// "don't tear down the DOM/reset scroll under a real click" reasoning
// refreshPlatformFilterMenu's own comment documents; updateHUD's much
// lighter per-frame check below just closes the popup if the tile
// disappears out from under it). Real item art (itemIconImgHtml), per
// direct request ("make sure to use real object icons for the chest popup
// modal, no emojis") — the same real-art renderer the Platform filter/shop
// stat lines already use, not a Unicode glyph standing in for the item.
function refreshStorageChestModal(state) {
  if (!storageChestTileKey) return;
  const data = state.level.buildingData[storageChestTileKey];
  if (!data) { closeStorageChestModal(); return; }
  const capacity = STORAGE_CHEST_CAPACITY[data.type];
  els.storageChestTitle.textContent = BUILDING_TYPES[data.type].name;
  if (data.lockedItemType === null) {
    els.storageChestIcon.innerHTML = '';
    els.storageChestCount.textContent = `Empty — 0 / ${capacity}`;
  } else {
    const label = PLATFORM_FILTER_ITEM_TYPES.find((t) => t.id === data.lockedItemType)?.label || data.lockedItemType;
    els.storageChestIcon.innerHTML = itemIconImgHtml(data.lockedItemType, 26);
    // Per direct request — a coin-holding chest also shows the total real
    // dollar value of everything stored, not just the unit count (coinQueue
    // is a real FIFO of each coin's own individual value, not a pooled
    // average — see Grid.js's own comment on why — so this sum is exact).
    const totalValueSuffix = data.lockedItemType === 'coin'
      ? ` ($${data.coinQueue.reduce((sum, v) => sum + v, 0)} total)`
      : '';
    els.storageChestCount.textContent = `${data.count} / ${capacity} ${label}${totalValueSuffix}`;
  }
  // A genuine toggle now, per direct request — only disabled while there's
  // no remembered direction to pause/resume at all yet (never dragged).
  // Once a direction's been aimed, clicking this always flips
  // trickleActive without ever forgetting trickleAngle/trickleDistanceTiles
  // (see Grid.js's toggleChestTrickle), so the label just tracks which
  // action the NEXT click will take.
  els.storageChestStopBtn.disabled = data.trickleAngle === null;
  els.storageChestStopBtn.textContent = data.trickleActive ? 'Pause Trickle' : 'Resume Trickle';
  // Per direct request — mentions the right-click-drag clear gesture that
  // replaced the old Clear Chest button, alongside the existing left-drag
  // trickle instructions.
  els.storageChestHint.textContent = (data.trickleActive
    ? 'Trickling out on its own. Drag away from the chest again to re-aim it.'
    : data.trickleAngle !== null
      ? 'Paused. Press Resume Trickle to pick back up where it left off, or drag away from the chest to re-aim it.'
      : 'Drag away from the chest to aim, then let go to start trickling it back out.')
    + ' Right click and drag to clear the chest.';
}

// Toggled from red x's to green checks and back — re-clicking an already-
// whitelisted item removes it, flipping it back to the red-X default.
function togglePlatformFilterItem(state, itemId) {
  const target = activeFilterTarget(state);
  if (!target) return;
  const idx = target.array.indexOf(itemId);
  if (idx === -1) target.array.push(itemId);
  else target.array.splice(idx, 1);
  refreshPlatformFilterMenu(state);
}

// Back to a plain, always-solid Platform/Fan (every item red-X again,
// nothing whitelisted) — or, for a Magnet Fish, back to attracting Waste
// only (its original fixed behavior), not an empty list, since "clear" on
// an opt-IN filter reading as "attract nothing at all" would be a strange
// reset for a magnet fish the player just turned on.
function clearPlatformFilter(state) {
  const target = activeFilterTarget(state);
  if (!target) return;
  if (target.kind === 'fish') {
    const fish = state.level.entities.find((e) => e.id === platformFilterFishId && e.type === 'fish');
    if (fish) fish.magnetFilterItems = ['waste'];
  } else {
    const data = state.level.buildingData[platformFilterTileKey];
    if (data) data.filterItems = [];
  }
  refreshPlatformFilterMenu(state);
}

// Drag-copy — mirrors copyBuildingRecipe's exact shape (main.js's
// updateRecipeDrag/mouseUp handlers drive an identical gesture for this),
// per direct request ("click and drag active filters from one platform to
// another... the same way the recipe copying works"). Deliberately does NOT
// require the source/target to be the same Platform variant — "even from a
// full platform to half platform" — since a filter is just a plain array of
// item-type ids, equally meaningful on any of the 5 shapes.
export function copyPlatformFilter(state, sourceKey, targetKey) {
  const sourceData = state.level.buildingData[sourceKey];
  const targetData = state.level.buildingData[targetKey];
  if (!sourceData || !targetData) return;
  targetData.filterItems = [...sourceData.filterItems];
  if (platformFilterMenuOpen && platformFilterTileKey === targetKey) refreshPlatformFilterMenu(state);
}

// Tracks the clicked tile's live on-screen position so the popup stays
// glued to it even if the player pans the camera while it's open.
function updateRecipeMenuPosition(state) {
  if (!recipeMenuTileKey) return;
  const [row, col] = recipeMenuTileKey.split(',').map(Number);
  const worldX = col * TILE_SIZE + TILE_SIZE / 2;
  const worldY = row * TILE_SIZE;
  const screen = worldToScreen(worldX, worldY, state.camera);
  els.recipeMenuAnchor.style.left = `${screen.x}px`;
  els.recipeMenuAnchor.style.top = `${screen.y - MOUND_MENU_GAP_PX}px`;
}

// Rebuilds the icon row for whichever building (Manufacturer or Power
// Plant) sits at recipeMenuTileKey — called only on open and on a toggle
// click (see openRecipeMenu/toggleBuildingRecipe), NOT every frame (a real
// bug once had this rebuilding every frame the popup was open, which could
// detach a real click's target element mid-click — see CLAUDE.md's own
// changelog entry). The much lighter per-frame check elsewhere just closes
// the popup outright if the underlying tile is gone (demolished
// mid-decision), without touching this option DOM at all.
function refreshRecipeMenu(state) {
  if (!recipeMenuTileKey) return;
  const data = state.level.buildingData[recipeMenuTileKey];
  if (!data) { closeRecipeMenu(); return; }
  const isManufacturer = data.type === TILE_MANUFACTURER;
  const recipeList = isManufacturer ? MANUFACTURER_RECIPE_LIST : POWER_PLANT_RECIPE_LIST;
  els.recipeMenuTitle.textContent = isManufacturer ? 'Manufacturer Recipe' : 'Power Plant Fuel';
  els.recipeMenuOptions.innerHTML = '';
  for (const recipe of recipeList) {
    const unlocked = recipe.labNodeId === null || state.meta.labUpgradesPurchased.includes(recipe.labNodeId);
    const optionEl = document.createElement('div');
    optionEl.className = 'recipe-option' + (data.recipeId === recipe.id ? ' selected' : '') + (unlocked ? '' : ' locked');
    optionEl.style.setProperty('--recipe-color', recipe.color);
    // A real drawn item icon (whatever the recipe actually produces — or,
    // for a Power Plant, whatever fuel it burns) instead of a generic
    // emoji, per direct request ("the recipe icon [should] match the actual
    // object in the game") — reuses the exact same drawItemIconCanvas the
    // Platform filter pop-up and the Science Lab tree already draw their
    // own real-item icons with.
    const icon = document.createElement('canvas');
    icon.className = 'recipe-option-icon';
    icon.width = RECIPE_OPTION_ICON_CANVAS_SIZE;
    icon.height = RECIPE_OPTION_ICON_CANVAS_SIZE;
    drawItemIconCanvas(icon, isManufacturer ? recipe.output : recipe.inputs[0]);
    // Name + description share a text column next to the icon now — per
    // direct request, each recipe row lays out horizontally (icon on the
    // left, text stacked to its right) instead of the old icon-on-top card.
    const text = document.createElement('div');
    text.className = 'recipe-option-text';
    const name = document.createElement('div');
    name.className = 'recipe-option-name';
    name.textContent = unlocked ? recipe.name : `🔒 ${recipe.name}`;
    const desc = document.createElement('div');
    desc.className = 'recipe-option-desc';
    desc.textContent = recipe.description;
    text.appendChild(name);
    text.appendChild(desc);
    optionEl.appendChild(icon);
    optionEl.appendChild(text);
    if (unlocked) {
      optionEl.addEventListener('click', () => toggleBuildingRecipe(state, recipeMenuTileKey, recipe.id));
    }
    els.recipeMenuOptions.appendChild(optionEl);
  }
  // The building's own general stats (per-ingredient processing time, power
  // draw) — per direct request ("add in just the stats from the manufacturer
  // into its recipe picker/fly out modal") — reusing buildingStatsHtml's
  // exact output rather than a second copy of these numbers. The
  // Manufacturer specifically ALSO gets the full per-item power breakdown
  // here (and only here — the shop/Lab preview keeps the plain range) per a
  // later direct request, since this is the one place ingredient choice
  // actually matters.
  els.recipeMenuStats.innerHTML = isManufacturer ? manufacturerRecipeMenuStatsHtml() : buildingStatsHtml(data.type);
}

// Per direct request: "Add this stat into just the recipe modal" — the
// Manufacturer's exact per-ingredient power draw (see
// MANUFACTURER_ITEM_POWER_COST_MW), shown only in its own recipe pop-up
// menu, not the shop/Lab preview (which shows the plain min-max range via
// buildingStatsHtml instead).
function manufacturerPowerBreakdownHtml() {
  const p = MANUFACTURER_ITEM_POWER_COST_MW;
  return (
    `<div class="building-stat">🗑️ <b>${p.waste}</b>mw · 🍖 <b>${p.food}</b>mw</div>` +
    `<div class="building-stat">🟩 <b>${p.biomass}</b>mw · 🔬 <b>${p.science}</b>mw</div>`
  );
}

// applyRecipeToBuilding moved to Grid.js (and exported from there) per
// direct request ("make it so the blueprint tool copies recipes to the
// newly placed buildings") — Grid.js's placeBlueprint needs to call it too
// now, and Grid.js can't import FROM UI.js (UI.js already imports heavily
// from Grid.js — the reverse would be circular), so the shared logic lives
// on the Grid.js side of that boundary instead. See its own comment there.

// Clicking an already-selected recipe icon clears it back to "nothing," per
// direct spec ("toggle-able... could be set back to nothing, but never
// multiple recipes").
function toggleBuildingRecipe(state, tileKey, recipeId) {
  const data = state.level.buildingData[tileKey];
  if (!data) return;
  const next = data.recipeId === recipeId ? null : recipeId;
  applyRecipeToBuilding(data, next);
  refreshRecipeMenu(state);
}

// Drag-to-copy — per direct request ("click and dragged, and a ghost icon
// of the building will go on the cursor... release the drag, copy the
// recipe from the dragged building to the building the ghost was released
// on. This will speed up having to set multiple recipes"). Called from
// main.js's mouseup handler once it's confirmed both tiles are the same
// building type and genuinely different tiles — see updateRecipeDrag there
// for the drag/ghost-tint mechanics themselves, which live in main.js since
// they're pure input/render state, not simulation.
export function copyBuildingRecipe(state, sourceKey, targetKey) {
  const sourceData = state.level.buildingData[sourceKey];
  const targetData = state.level.buildingData[targetKey];
  if (!sourceData || !targetData || sourceData.type !== targetData.type) return;
  applyRecipeToBuilding(targetData, sourceData.recipeId);
  if (recipeMenuOpen && recipeMenuTileKey === targetKey) refreshRecipeMenu(state);
}

// Tracks the Mound's live on-screen position so the popup stays glued to it
// even if the player pans the camera while it's open (nothing freezes
// panning just because this is up). Called every render frame it's open,
// from updateHUD.
function updateMoundMenuPosition(state) {
  // Per direct request ("make the mound also sit at the bottom of the upper
  // tank, the same as the science lab") — Mound.js's own render/hit-test
  // lifted the Mound's whole footprint up by one tile (see its
  // MOUND_LIFT_PX), so this anchor follows it up by the same amount to stay
  // glued to the dome's actual new top instead of floating a tile below it.
  const anchorWorld = { x: MOUND_X, y: SEABED_FLOOR_Y - MOUND_HEIGHT_PX - TILE_SIZE };
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
  // Per direct request ("when you re-open the science lab, it saves the
  // last state/place you were in") — only the very FIRST open of a fresh
  // level centers the tree and resets zoom; every open after that restores
  // exactly where the player left off (see closeLabMenu, which saves these
  // three the instant it closes). Has to happen after the overlay is
  // actually unhidden (a display:none element has no layout box, so
  // scrollHeight/clientHeight would both read 0), and before refreshLabTree
  // so its own drawLabTreeConnectors call draws against the final scroll
  // position rather than the stale one.
  if (labTreeHasBeenOpened) {
    labZoom = savedLabZoom;
    els.labTreeColumns.style.setProperty('--lab-zoom', String(labZoom));
    els.labTreeWrap.scrollLeft = savedLabScrollLeft;
    els.labTreeWrap.scrollTop = savedLabScrollTop;
  } else {
    labTreeHasBeenOpened = true;
    labZoom = 1;
    els.labTreeColumns.style.setProperty('--lab-zoom', '1');
    els.labTreeWrap.scrollLeft = 0;
    els.labTreeWrap.scrollTop = Math.max(0, (els.labTreeWrap.scrollHeight - els.labTreeWrap.clientHeight) / 2);
  }
  refreshLabTree(state);
  els.labModal.classList.add('lab-modal-closed');
  void els.labModal.offsetWidth; // forced reflow — same retrigger trick every other one-shot transition in this file uses
  els.labModal.classList.remove('lab-modal-closed');
  playPanelOpen();
}

// Per direct request ("Escape will close the shop menu, tank upgrade menu,
// or science lab if they are open") — main.js's Escape handler needs to
// know whether the Lab is currently open, but labMenuOpen itself is a
// module-local transient like every other panel-open flag in this file (see
// the comment above it).
export function isLabMenuOpen() {
  return labMenuOpen;
}

export function closeLabMenu() {
  if (!labMenuOpen) return;
  labMenuOpen = false;
  labMenuClosing = true;
  // Save the exact pan/zoom position so the next openLabMenu can restore it
  // — see that function's own comment.
  savedLabScrollLeft = els.labTreeWrap.scrollLeft;
  savedLabScrollTop = els.labTreeWrap.scrollTop;
  savedLabZoom = labZoom;
  closeLabPurchaseModal(); // don't leave the confirmation modal stranded on top of a closed/closing tree
  els.labModal.classList.add('lab-modal-closed');
  labMenuCloseTimer = setTimeout(() => {
    els.labOverlay.classList.add('hidden');
    labMenuClosing = false;
    labMenuCloseTimer = null;
  }, LAB_MENU_TRANSITION_MS);
  playPanelClose();
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
// Per direct request ("when you hover over a node... highlight all the
// lines going to the required nodes for that node") — set/cleared by a plain
// mouseenter/mouseleave pair on each node button (see buildLabTree), read by
// drawLabTreeConnectors every frame it's open (refreshLabTree already reruns
// that every frame via updateHUD, so no extra redraw call is needed here).
let labHoveredNodeId = null;

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
  labHoveredNodeId = null;
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
    btn.dataset.category = labNodeCategory(node); // see applyLabFilter — the No Filter/Buildings/Recipes/Fish/Other buttons
    const nameEl = document.createElement('div');
    nameEl.className = 'lab-node-name';
    // A node granting a building/species, or one that's really a
    // Manufacturer/Power Plant recipe unlock, gets a small real rendering of
    // that building/fish/item's actual look, built once here (never
    // recreated — refreshLabTree below only ever touches nameTextEl's own
    // text content, since it runs every frame the Lab is open and redrawing
    // a canvas that often would be pure waste). Anything else (Turret Fire
    // Rate, a Bubble Cap step, the mystery node) keeps its plain emoji —
    // see buildingIconOrEmojiElement's own comment for the exact rule.
    const iconEl = buildingIconOrEmojiElement(node, LAB_NODE_ICON_CANVAS_SIZE);
    let iconCanvas = null;
    if (iconEl.tagName === 'CANVAS') {
      iconCanvas = iconEl;
      iconCanvas.className = 'lab-node-building-icon';
      nameEl.appendChild(iconCanvas);
    }
    const nameTextEl = document.createElement('span');
    nameEl.appendChild(nameTextEl);
    const costEl = document.createElement('div');
    costEl.className = 'lab-node-cost';
    btn.append(nameEl, costEl);
    // No longer buys directly on click — per direct request, opens the
    // confirmation modal instead (see openLabPurchaseModal below), which is
    // the only thing that still calls buyLabUpgrade. A disabled button
    // (locked or already purchased) never dispatches a click at all, so this
    // never opens for something that couldn't actually be bought.
    btn.addEventListener('click', () => openLabPurchaseModal(state, node.id));
    // Per direct request — hovering a node highlights the connector lines
    // running from it to its OWN prerequisites, so the "what does this need"
    // relationship reads at a glance without opening the purchase modal.
    btn.addEventListener('mouseenter', () => { labHoveredNodeId = node.id; });
    btn.addEventListener('mouseleave', () => { labHoveredNodeId = null; });
    labNodeButtons[node.id] = { btn, nameEl, nameTextEl, iconCanvas, costEl };
    columns[labNodeDepthMemo[node.id]].appendChild(btn);
  }
  applyLabFilter();
  refreshLabTree(state);
}

// A handful of nodes (everything gated behind Green Science being unlocked)
// cost Green Science IN ADDITION TO Blue now, per direct request ("the
// unlocks for everything that requires green science to be unlocked, should
// also require green science as a resource... in addition to blue
// science") — `scienceGreenCost`, when present, is now an ADDITIVE second
// cost, not an exclusive alternative to `scienceCost` (every node still
// always costs its own `scienceCost` in Blue Science). These two helpers are
// the only places that needs handling; every other cost/affordability check
// below just calls through them.
function labNodeHasEnoughScience(state, node) {
  if (state.level.science < node.scienceCost) return false;
  if (node.scienceGreenCost != null && state.level.scienceGreen < node.scienceGreenCost) return false;
  return true;
}
function labNodeCostText(node) {
  // A handful of nodes (the tree's 3 new gold-only roots — Suckerfish,
  // Science Octopus, Bubble Cap 10) cost 0 Science, per direct request
  // ("none of those three cost science, only money") — omitted entirely
  // rather than shown as "0 🔬", so the cost genuinely reads as gold-only.
  let text = node.scienceCost > 0 ? `${node.scienceCost} 🔬` : '';
  if (node.scienceGreenCost != null) text += (text ? ' · ' : '') + `${node.scienceGreenCost} 🟢`;
  return (text ? `${text} · ` : '') + `$${node.goldCost}`;
}

// Every Science Lab node spends Science (Blue, plus Green for the handful of
// nodes gated behind Green Science research) and gold at once — a
// deliberate first in this game's economy, per direct request, tying the
// whole tree to real resources so it reads as the real end-goal sink. Only
// ever called from confirmLabPurchase now (see the purchase modal below) —
// clicking a node itself just opens that modal.
function buyLabUpgrade(state, id) {
  const node = SCIENCE_LAB_UPGRADES[id];
  if (state.meta.labUpgradesPurchased.includes(id)) return;
  if (!node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r))) return;
  if (!labNodeHasEnoughScience(state, node) || state.level.money < node.goldCost) return;
  state.level.science -= node.scienceCost;
  if (node.scienceGreenCost != null) state.level.scienceGreen -= node.scienceGreenCost;
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
  // The Bubble Capacity chain (science_cap_2..5) grants this instead of a
  // species/building — see Config.js's SCIENCE_LAB_UPGRADES comment.
  if (node.grants.scienceCapLevel) {
    state.level.upgrades.scienceCapLevel += node.grants.scienceCapLevel;
  }
  playUpgrade();
  // Mother Alien Fish, per direct spec — triggers the whole 10-second
  // end-game reveal sequence. Closes the Lab itself right here (UI.js
  // already owns closeLabMenu), then hands off to main.js via a cross-module
  // flag (same pattern state.ui.wasteTurretAmmoGainedPending already established)
  // rather than importing main.js's simulation-level updateBossSequence
  // directly from this file — main.js's own bossFightTriggerPending handler
  // is what actually starts the music crossfade/timeline now, per a later
  // direct request that the fade itself be part of that 10-second reveal
  // rather than an instant cut at the moment of purchase.
  if (node.grants.triggersBossFight) {
    closeLabMenu();
    state.ui.bossFightTriggerPending = true;
  }
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
  // A `mystery: true` node stays a total blank until its prerequisites are
  // met, per direct spec ("a question mark node... that gives no info until
  // it's unlockable") — no name, no icon, no cost, no description, nothing
  // that would spoil what it actually is. `refreshLabPurchaseButton` (called
  // every frame this modal is open) independently re-checks the same
  // condition, so the instant the last prerequisite is bought while this
  // modal happens to already be open, it reveals itself live.
  const prereqsMetForMystery = node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r));
  if (node.mystery && !prereqsMetForMystery) {
    els.labPurchaseIcon.textContent = '❓';
    els.labPurchaseName.textContent = '???';
    els.labPurchaseCost.textContent = '???';
    els.labPurchaseDesc.innerHTML = '<div>Something is stirring in the deep... you\'ll need to have unlocked everything Green Science research offers, plus Bubble Cap 100, before you can learn any more.</div>';
    els.labPurchaseStats.innerHTML = '';
    refreshLabPurchaseButton(state);
    els.labPurchaseOverlay.classList.remove('hidden');
    playPanelOpen();
    return;
  }
  // Per direct request, a node granting a building shows a small real
  // rendering of that building's actual look instead of its flat emoji.
  els.labPurchaseIcon.textContent = '';
  els.labPurchaseIcon.appendChild(buildingIconOrEmojiElement(node, LAB_PURCHASE_ICON_CANVAS_SIZE));
  els.labPurchaseName.textContent = node.name;
  els.labPurchaseCost.textContent = labNodeCostText(node);
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
    // Per direct request, each Bubble Cap node's description is now its own
    // fixed string (Config.js's SCIENCE_LAB_UPGRADES.science_cap_2..5, e.g.
    // "Raises the Science Bubble cap from 20 to 30...") rather than computed
    // live off state.level.upgrades.scienceCapLevel — it no longer changes
    // depending on what the player has already unlocked. The stat chip's own
    // target figure is parsed straight from the node's own name ("Bubble Cap
    // 30" -> 30), itself static per-node data, not the player's live level.
    descLines.push(node.description);
    const capValue = parseInt(node.name.match(/\d+/)[0], 10);
    statChips.push(`<div class="building-stat">🔬 Bubble cap: <b>${capValue}</b></div>`);
  }
  if (!descLines.length) {
    // Per direct request ("change the wording... so it says what recipe
    // (with the ingredients) that it unlocks instead of just saying it's a
    // prerequisite") — a Manufacturer/Power Plant recipe node is matched by
    // its own labNodeId and described by its real ingredients/output;
    // everything else that grants nothing by itself (e.g. green_science_tech,
    // a pure tech flag with no recipe of its own) keeps the old generic
    // "prerequisite" text plus a list of what it unlocks.
    const recipe = MANUFACTURER_RECIPE_LIST.find((r) => r.labNodeId === id) || POWER_PLANT_RECIPE_LIST.find((r) => r.labNodeId === id);
    if (recipe) {
      descLines.push(`Unlocks the <b>${recipe.name}</b> recipe: ${recipe.description}.`);
      statChips.push(`<div class="building-stat">${recipe.icon} <b>${recipe.description}</b></div>`);
    } else if (node.description) {
      // A plain node-level `description` string (e.g. the two Turret Fire
      // Rate nodes — see Config.js) — describes a real mechanical effect
      // that isn't a species/building/recipe/capacity grant, so it needs its
      // own static text rather than falling all the way to the generic
      // "prerequisite" line below.
      descLines.push(node.description);
    } else {
      descLines.push('Doesn\'t unlock anything by itself — it\'s a prerequisite for what comes next.');
      const unlocksHtml = labNodeUnlocksHtml(id);
      if (unlocksHtml) statChips.push(unlocksHtml);
    }
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

// Per direct request, a node button itself is NEVER disabled any more (see
// refreshLabTree) — purchased, locked, and unaffordable nodes are all
// clickable so their info can always be read. This is what actually
// enforces the real purchase gate, in 3 states: already purchased shows a
// grayed "Bought" (per direct request — "have it just show a grayed out
// 'bought' instead of 'confirm'... if it's already been purchased"); prereqs
// not met yet shows a grayed "Locked" (previewable, per direct request, but
// obviously not actually purchasable); otherwise the normal "Confirm,"
// greyed out only when genuinely unaffordable right now. Called once when
// the modal opens and every frame afterward (from refreshLabTree, since
// Science/gold/purchased-state can all keep changing while it's open — e.g.
// waiting on an Octopus's brew, or buying a prerequisite in a second tab...
// well, there's no second tab, but the pattern's the same one every other
// "keep this live while a modal sits open" spot in this file already uses).
function refreshLabPurchaseButton(state) {
  const node = SCIENCE_LAB_UPGRADES[labPurchaseNodeId];
  const purchased = state.meta.labUpgradesPurchased.includes(labPurchaseNodeId);
  const prereqsMet = node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r));
  if (purchased) {
    els.labPurchaseConfirmBtn.textContent = 'Bought';
    els.labPurchaseConfirmBtn.disabled = true;
  } else if (!prereqsMet) {
    els.labPurchaseConfirmBtn.textContent = 'Locked';
    els.labPurchaseConfirmBtn.disabled = true;
  } else {
    const affordable = labNodeHasEnoughScience(state, node) && state.level.money >= node.goldCost;
    els.labPurchaseConfirmBtn.textContent = 'Confirm';
    els.labPurchaseConfirmBtn.disabled = !affordable;
  }
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
  let html = `<div class="building-stat">🍽️ Hunger: <b>${foodPerMin.toFixed(1)} ${itemIconImgHtml('food')}/min</b></div>`;
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
    html += `<div class="building-stat">${itemIconImgHtml('coin')} Money: <b>$${Math.round(babyMoneyPerMin)} - $${Math.round(adultMoneyPerMin)}/min</b></div>`;
  }
  // Per direct request ("add in a stat line for the electric eels in the
  // shop showing the range of electricity they produce"). A pure Generator
  // (GENERATOR without also FEEDER — mirrors isPureGenerator's own check in
  // Entities.js) generates MW off distance actually swum, not a flat
  // dropInterval/dropValue timer (see Entities.js's updateFish GENERATOR
  // branch) — pixelsPerMW is "pixels swum per 1 MW," so MW/pixel is its
  // reciprocal. Uses the same baseline swimSpeed (not the live upgraded
  // one) the Speed stat line below already does, for the same "fixed
  // comparison figure" reason, and the same baby -> adult range shape the
  // Money line above uses.
  if (s.behavior.includes('GENERATOR') && !s.behavior.includes('FEEDER')) {
    const baseSpeed = s.swimSpeed * FISH_SPEED_MULTIPLIER;
    const babyMwPerSec = baseSpeed / baby.pixelsPerMW;
    const adultMwPerSec = baseSpeed / adult.pixelsPerMW;
    html += `<div class="building-stat">⚡ Power: <b>${Math.round(babyMwPerSec)} - ${Math.round(adultMwPerSec)} mw/sec</b></div>`;
  }
  // Per direct request ("add in a stat line for the octopus in the shop for
  // how much blue science it makes"). A pure Researcher (RESEARCHER without
  // also FEEDER, same isPureResearcher shape) uses a real dropInterval/
  // dropValue timer same as a Feeder's coin drop — same baby -> adult
  // range/min shape as the Money line above, just for Science instead of
  // coin.
  if (s.behavior.includes('RESEARCHER') && !s.behavior.includes('FEEDER')) {
    const babySciencePerMin = (baby.dropValue / baby.dropInterval) * 60000;
    const adultSciencePerMin = (adult.dropValue / adult.dropInterval) * 60000;
    html += `<div class="building-stat">${itemIconImgHtml('science')} Science: <b>${babySciencePerMin.toFixed(1)} - ${adultSciencePerMin.toFixed(1)}/min</b></div>`;
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
    html += `<div class="building-stat">${itemIconImgHtml('waste')} Waste: <b>${wastePerMin.toFixed(1)}/min</b></div>`; // nearest tenth, per direct request — see the Money line's own comment
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
  // Both Science reserves shown together — several nodes now spend both at
  // once, see labNodeHasEnoughScience's own comment.
  els.labScienceReadout.textContent = `🔬 ${state.level.science} · 🟢 ${state.level.scienceGreen} · 💰 $${Math.floor(state.level.money)}`;
  for (const node of SCIENCE_LAB_UPGRADE_LIST) {
    const { btn, nameTextEl, iconCanvas, costEl } = labNodeButtons[node.id];
    const purchased = state.meta.labUpgradesPurchased.includes(node.id);
    const prereqsMet = node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r));
    const affordable = labNodeHasEnoughScience(state, node) && state.level.money >= node.goldCost;
    btn.classList.toggle('purchased', purchased);
    btn.classList.toggle('locked', !purchased && !prereqsMet);
    btn.classList.toggle('unaffordable', !purchased && prereqsMet && !affordable);
    // Per direct request, EVERY node stays clickable now — purchased
    // ("click on already purchased science lab unlocks, just to see what it
    // did") and even still-locked ones ("locked nodes... can be clicked to
    // see what they will do when you get to that point") all open the same
    // purchase modal to read; only that modal's own Confirm button actually
    // reflects whether a purchase can happen right now — see
    // refreshLabPurchaseButton.
    btn.disabled = false;
    // A `mystery: true` node (the "Mother Alien Fish" secret unlock, per
    // direct spec — "a question mark node... that gives no info until it's
    // unlockable") hides its own name/icon behind a plain "???" for as long
    // as its prerequisites aren't met, even in the tree itself, not just the
    // purchase modal — reads live every frame, same as everything else here,
    // so it reveals itself the instant the last prerequisite is bought.
    const isHiddenMystery = node.mystery && !prereqsMet;
    if (iconCanvas) iconCanvas.style.display = isHiddenMystery ? 'none' : '';
    nameTextEl.textContent = isHiddenMystery ? '❓ ???' : (iconCanvas ? node.name : `${node.icon} ${node.name}`);
    if (purchased) costEl.textContent = 'Unlocked ✓';
    else if (isHiddenMystery) costEl.textContent = '???';
    else if (!prereqsMet) costEl.textContent = 'Locked';
    else costEl.textContent = labNodeCostText(node);
  }
  drawLabTreeConnectors(state);
  if (labPurchaseNodeId !== null) refreshLabPurchaseButton(state); // Science/gold/purchased-state can keep changing while the confirmation modal sits open
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
      // Hovering `node` highlights every edge running FROM it to one of ITS
      // OWN prerequisites — a bright gold overlay wins over the normal
      // purchased/locked styling regardless of which state that edge was
      // already in. Per a later direct request, hovering an ALREADY-
      // PURCHASED node also highlights every edge running the other way —
      // to whichever OTHER nodes require IT (what it unlocks) — in a
      // distinct cyan/blue rather than gold, so "what this needs" and "what
      // this enables" read as two different, simultaneously-visible things
      // rather than one direction winning over the other. Scoped to a
      // purchased hovered node specifically (per the request's own wording)
      // since an unpurchased node's own "what it would unlock" edges aren't
      // reachable yet anyway.
      const hoveredIsUnlockTarget = labHoveredNodeId === reqId && state.meta.labUpgradesPurchased.includes(labHoveredNodeId);
      if (labHoveredNodeId === node.id) {
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.95)'; // gold — requirements of the hovered node
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
      } else if (hoveredIsUnlockTarget) {
        ctx.strokeStyle = 'rgba(90, 200, 255, 0.95)'; // cyan/blue — nodes the hovered node itself unlocks
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = reqPurchased ? 'rgba(122, 212, 168, 0.85)' : 'rgba(107, 76, 107, 0.3)';
        ctx.lineWidth = reqPurchased ? 3 : 2;
        ctx.setLineDash(reqPurchased ? [] : [5, 4]);
      }
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
  els.pauseLoadSaveBtn.disabled = !hasSaveGame(); // re-checked every open — a save could exist now that didn't the last time this was shown
}

// True for exactly as long as the pause overlay's Settings sub-view is
// showing because the START screen opened it (see initStartScreen below),
// not because the player actually paused a running game — read by the
// shared "Back"/backdrop-click handling right above so it returns to the
// start screen instead of resuming gameplay that was never running.
let settingsOpenedFromStartScreen = false;
// Stashed once by initStartScreen — reused by loadLastSaveFromPause's own
// "opened via the start screen" branch, since that's the one case where
// loading a save also has to actually kick off gameplay (the game was never
// running yet), and this function has no other way to reach main.js's
// onStart callback.
let startOnStartCallback = null;

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
  startOnStartCallback = onStart;
  // Continue Game stays visible but grayed out/disabled unless a save
  // actually exists — per direct request (was fully hidden before) — checked
  // once here at page load, not re-checked afterward (nothing can create a
  // save before the start screen is even up).
  els.startContinueBtn.disabled = !hasSaveGame();
  els.startNewGameBtn.addEventListener('click', () => {
    els.startOverlay.classList.add('hidden');
    playPanelClose();
    onStart();
  });
  els.startContinueBtn.addEventListener('click', () => {
    const saved = loadSaveGame();
    if (saved) {
      // The whole point of a save being plain, JSON-serializable state (see
      // CLAUDE.md's State Shape) is that "load" is just replacing these two
      // slices wholesale — camera/ui/debug stay whatever they already were
      // (a fresh page load's defaults), since those are session-local, not
      // campaign progress.
      state.meta = saved.meta;
      state.level = saved.level;
      centerCameraOnMound(state.camera); // same one-time re-center loadLevel's own callers already do, since a saved level has no camera position of its own
    }
    els.startOverlay.classList.add('hidden');
    playPanelClose();
    onStart();
  });
  // Achievements/Customization from the start screen, per direct request
  // ("add the achievements menu and the customization menu to the start
  // menu, allowing them to see/claim achievements, and customize their fish
  // there"). Same "layer on top, don't hide #start-overlay" pattern Settings
  // already uses just above — #tank-panel's own .modal-mode class (see
  // style.css) repositions it into a plain centered fixed modal with
  // #start-tank-backdrop dimming everything behind it.
  const openTankPanelFromStartScreen = (view) => {
    // Real bug, caught during verification: #tank-panel's `position: fixed`
    // gets TRAPPED inside #bottom-bar-row's own coordinate space, because
    // that ancestor has a CSS `transform` on it (centering the row) — per
    // spec, any transformed ancestor becomes the containing block for a
    // fixed-position descendant, silently overriding "fixed relative to the
    // viewport." That left the panel positioned relative to the toolbar row
    // instead of the screen, AND z-index 610 only being compared within that
    // row's own (much lower) local stacking context — so it rendered small,
    // mispositioned, and visually BEHIND #start-overlay's blur despite the
    // higher z-index. Reparenting to a direct child of <body> escapes every
    // transformed ancestor entirely, which is what actually makes `position:
    // fixed` behave the way it's meant to here — moved back to its normal
    // #tank-anchor home on close, below.
    document.body.appendChild(els.tankPanel);
    els.startTankBackdrop.classList.remove('hidden');
    els.tankPanel.classList.add('modal-mode');
    state.ui.tankPanelCollapsed = false;
    setTankPanelView(state, view);
    updateTankPanelCollapse(state);
    maybeBounceAchievementTabFirstOpen(state);
    playPanelOpen();
  };
  const closeTankPanelToStartScreen = () => {
    state.ui.tankPanelCollapsed = true;
    updateTankPanelCollapse(state);
    els.tankPanel.classList.remove('modal-mode');
    els.startTankBackdrop.classList.add('hidden');
    els.tankAnchor.appendChild(els.tankPanel); // back to its normal anchored home for in-game use
    playPanelClose();
  };
  els.startAchievementsBtn.addEventListener('click', () => openTankPanelFromStartScreen('achievements'));
  els.startCustomizationBtn.addEventListener('click', () => openTankPanelFromStartScreen('customization'));
  els.startTankBackdrop.addEventListener('click', closeTankPanelToStartScreen);
  // Per direct request ("removing the tabs to switch between menus that you
  // don't have access to yet, and replace those tab buttons with a Back
  // button") — #tank-back-btn (shown only while .modal-mode is present, see
  // style.css) does exactly what clicking the backdrop already does.
  els.tankBackBtn.addEventListener('click', closeTankPanelToStartScreen);
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

// Saves the whole meta+level state to LocalStorage (Save.js) from the pause
// menu's own Save button — a plain fire-and-forget action. Per direct
// request, the confirmation is now a top-center toast (state.ui.toastText,
// shown by updateHUD's own updateSaveToast) instead of a chat-log
// notification — it doesn't need to stick around in the notification
// history the way a real gameplay event does.
function saveGameFromPause(state) {
  const ok = saveGame(state);
  state.ui.toastText = ok ? 'Game saved.' : "Couldn't save — your browser blocked it.";
}

// The Settings panel's "Load Last Save" button, per direct request — reverts
// to whatever was last saved (manually, or by the autosave timer — see
// Systems.js's updateAutosave), replacing state.meta/state.level wholesale
// exactly the same way the start screen's own Continue button already does
// (see initStartScreen below), just reachable mid-game too. Handles both
// doors this shared Settings sub-view can be opened through: mid-game (just
// resume with the loaded state) and via the start screen (mirrors Continue —
// hide the start screen too and actually kick off onStart(), since the game
// was never running yet).
function loadLastSaveFromPause(state) {
  const saved = loadSaveGame();
  if (!saved) {
    pushUiNotification(state, "No save to load yet.");
    return;
  }
  state.meta = saved.meta;
  state.level = saved.level;
  centerCameraOnMound(state.camera); // same one-time re-center every other load-a-saved-level path already does
  pushUiNotification(state, 'Loaded your last save.');
  if (settingsOpenedFromStartScreen) {
    settingsOpenedFromStartScreen = false;
    els.pauseOverlay.classList.add('hidden');
    els.startOverlay.classList.add('hidden');
    playPanelClose();
    if (startOnStartCallback) startOnStartCallback();
  } else {
    closePauseMenu(state);
  }
}

// Rebuilds state.level from scratch via the real level-load path (same one
// Phase 5's campaign flow will use) — wipes items/entities/money, leaves
// state.meta (persisted progress) untouched, per the meta/level split.
function restartLevel(state) {
  labTreeHasBeenOpened = false; // a fresh level re-centers the Lab tree again on its first open — see openLabMenu
  loadLevel(state, state.level.levelId);
  centerCameraOnMound(state.camera); // loadLevel resets camera.x to 0 — re-center on the Mound, same as the initial load
  refreshShopPanel(state);
  closePauseMenu(state);
  // Per direct request, the title splash plays again on every Restart, not
  // just the very first Start click — main.js's triggerSplash() is a local
  // function closing over DOM refs this file can't import directly without
  // a circular dependency, so this just arms the same cross-module pending-
  // flag pattern wasteTurretAmmoGainedPending/chestItemAbsorbedPending
  // already use; render() reads and clears it the very next frame.
  state.ui.replaySplashPending = true;
}

// Per direct request ("add a main menu button to the pause menu"), later
// clarified ("the Main Menu button SHOULD NOT erase a save file, it should
// preserve ONLY the save file. The music and everything else can reset back
// like the webpage was refreshed, not the save state was wiped. THE ONLY
// WAY to clear a save is to start a new game/save over it") — this is now a
// PLAIN page reload and nothing else. It doesn't touch LocalStorage at all
// (no clearSaveGame() call) — exactly like a manual browser refresh, which
// is precisely the point: the real save on disk is untouched either way,
// same as the start screen's own "New Game" button already leaves it alone
// (see initStartScreen — it never calls clearSaveGame() either; only an
// actual Save/autosave ever overwrites the stored save). A real reload —
// rather than hand-resetting every field of the in-memory state.meta/
// state.level in place — is deliberate: main.js's `const state = {...}`
// literal is the one true definition of "the start state," and re-running
// it from scratch is the only way to guarantee this stays byte-for-byte in
// sync with it as that literal grows. Still confirmed via a native browser
// confirm() — a reload does lose any UNSAVED progress since the last real
// Save/autosave, which is real enough to warrant asking first.
function returnToMainMenuFromPause(state) {
  const ok = window.confirm('Return to the main menu? Any progress since your last save will be lost (your saved game itself is kept).');
  if (!ok) return;
  window.location.reload();
}

// Highlights whichever single shop selection is active — Food, a species, or
// a building (family-grouped ones included). All of these live off the
// exact same state.ui.selectedTool string now, so setting it anywhere (a
// species click, a building click, a family cycle) implicitly deselects
// whatever else was previously armed — per direct request that only one
// shop selection should ever be active at a time, not a building AND a fish
// simultaneously. Food also gets its own small tooltip (a one-liner, no
// separate window needed); species/buildings show their info in the shared
// shop-preview window instead (see selectSpeciesForPreview/
// selectBuildingForPreview).
// Shared by the bottom tool-bar's own click handlers above and main.js's
// 1/2/3 hotkeys (see main.js's keydownHandlers) — one place that actually
// sets the tool so both paths stay in sync.
// Demolish used to live here too (its own standalone tool, grayed out with
// nothing built yet) — per direct request it's gone entirely now, folded
// into the Food tool's own D-hotkey delete (main.js's updateKeyDDelete),
// which needs no availability gate of its own since it's just a no-op
// wherever there's nothing to delete under the cursor.
// Per direct request, merging is always available now (no Tank Upgrade
// gate any more) — the Merge tool instead grays out based on live board
// state: is there actually a combinable or spliceable pair on screen right
// now (Entities.js's hasAnyMergeOpportunity)? Blocked during any OTHER
// guided tutorial flow — per direct report, a stray Merge selection
// mid-flow (there's nothing stopping a click from reaching the bottom
// tool-bar during a noSpotlight step like the post-alien flow's "scroll,"
// which hides the whole overlay) could strand the player on the wrong tool
// with no way for a later step's own click to ever succeed — but NOT during
// the first-time merge tutorial's own flow, which needs to select this
// exact tool as its whole first step.
export function isMergeToolAvailable(state) {
  const flow = state.level.tutorialFlow;
  const blockedByOtherTutorial = flow && flow.id !== 'mergefish';
  return hasAnyMergeOpportunity(state) && !blockedByOtherTutorial;
}

export function selectTool(state, tool) {
  if (tool === 'merge' && !isMergeToolAvailable(state)) return;
  // Per direct request ("1-6 hotkeys (or clicking on the toolbar buttons)
  // should work as a toggle to select/deselect the tool") — pressing the
  // hotkey (or clicking the button) for whatever's ALREADY armed clears
  // back to the plain cursor instead of just re-selecting the same thing.
  if (state.ui.selectedTool === tool) {
    state.ui.selectedTool = 'cursor';
    updateToolbar(state);
    return;
  }
  state.ui.selectedTool = tool;
  closeSidePanels(state); // per direct request — picking a bottom-tool-bar tool (Food/Merge/Blueprint) closes the Shop/Tank Upgrades panel if it's open
  updateToolbar(state);
}

// Per direct request ("right-click a universal cancel button... default
// back to just a cursor") — the true, do-nothing default tool. 'food' is
// its own separate, deliberately-ARMED tool now (only it drops Food on
// click — see main.js's click handler), no longer doubling as the neutral
// state the way it used to before this request. Every "is anything armed
// right now" check in this file/main.js that used to mean "isn't 'food'"
// needs to mean "isn't 'cursor'" instead; every "is this a safe/neutral
// state to move-a-building/drag-an-item/D-delete from" check that used to
// mean "is 'food'" now means "is 'food' OR 'cursor'" (exported as
// isCursorOrFoodTool below) — Food keeps every non-food-dropping ability it
// always had, cursor gains all of them except dropping Food itself.
export function isCursorOrFoodTool(tool) {
  return tool === 'food' || tool === 'cursor';
}

// Called by the Escape key AND the new universal right-click cancel (both
// in main.js): cancels an actively-armed build/fish/merge/blueprint/food
// tool and defaults back to the plain cursor. A no-op while the cursor is
// already selected. Building AND fish selection both reuse
// deselectShopSelection so the preview window clears too, exactly like
// clicking the same shop icon a second time already does — fish selection
// used to be excluded here (a stale no-op left over from before the
// dedicated pause-menu button was removed), which meant Escape's own "(Esc)
// to cancel" legend was actually a lie while a fish was armed; fixed as part
// of making the new bottom-left Esc hotkey legend (see updateHUD) honest for
// every tool it claims to clear. Merge/Blueprint/Food have no preview to
// clear, just the tool itself.
export function cancelActiveTool(state) {
  const tool = state.ui.selectedTool;
  if (tool.startsWith('build:') || tool.startsWith('fish:')) {
    deselectShopSelection(state);
  } else if (tool === 'merge' || tool === 'blueprint' || tool === 'food') {
    state.ui.selectedTool = 'cursor';
    updateToolbar(state);
  }
}

function updateToolbar(state) {
  // Grayed-out + genuinely disabled until there's something to merge or
  // splice — re-checked every frame (called from updateHUD) so the board's
  // mergeable fish changing takes effect immediately, not just the next
  // time the tool happens to be picked.
  const mergeAvailable = isMergeToolAvailable(state);
  els.toolMergeBtn.disabled = !mergeAvailable;
  // Merge deliberately does NOT auto-revert to Food the moment it becomes
  // unavailable — per direct request ("don't force the player off the tool
  // if they merge the last mergeable fish"). The button above still reads
  // disabled/grayed in that moment; the tool just stays armed and ready in
  // case a new mergeable pair appears again shortly after (a fish growing
  // to Adult, say), rather than making the player reselect it.

  const foodSelected = state.ui.selectedTool === 'food';
  const mergeSelected = state.ui.selectedTool === 'merge';
  const blueprintSelected = state.ui.selectedTool === 'blueprint';
  els.toolFoodBtn.classList.toggle('selected', foodSelected);
  els.toolMergeBtn.classList.toggle('selected', mergeSelected);
  els.toolBlueprintBtn.classList.toggle('selected', blueprintSelected);

  // Descriptive text lives on each button's own native `title` hover
  // tooltip now, not a separate always-visible shop line — per direct
  // request ("remove any text from the shop for the tools, and move those
  // to a tool hovertip"). Merge's title is static (set once in index.html);
  // Food's needs to stay JS-driven since FOOD_COST could in principle
  // change — also mentions the D-hotkey delete mechanic now folded into
  // this tool (see main.js's updateKeyDDelete), per direct request
  // ("Remove the demolish tool... have it built into the food cursor tool
  // via the D hotkey").
  els.toolFoodBtn.title = `Food — $${FOOD_COST} (1) — hover a building and press D (or hold D and drag) to delete it for a full refund`;

  for (const btn of els.buildToolGrid.children) {
    btn.classList.toggle('selected', state.ui.selectedTool === btn.dataset.tool);
  }
  for (const btn of els.shopGrid.children) {
    btn.classList.toggle('selected', state.ui.selectedTool === btn.dataset.tool);
  }
  // Favorite slots highlight the exact same way — each button's own
  // dataset.tool (set by refreshFavoriteSlots, empty string for an unfilled
  // slot) is compared against the live selected tool every frame.
  for (const btn of els.favoriteSlotBtns) {
    btn.classList.toggle('selected', !!btn.dataset.tool && state.ui.selectedTool === btn.dataset.tool);
  }
}

// ---- Favorite toolbar slots ----
// Per direct request: 3 extra bottom-tool-bar slots (hotkeys 4-6) a player
// can pin any fish or building into. state.meta.favorites is a plain
// 3-element array — each entry a 'build:<id>'/'fish:<id>' tool string or
// null for an empty slot — persisted like every other meta field (survives
// a level change/save, same as an equipped hat).
export function isFavorite(state, tool) {
  return state.meta.favorites.includes(tool);
}

// Built once at init — click-to-select handlers never change, only the
// icon/title content each button shows (see refreshFavoriteSlots).
function buildFavoriteSlots(state) {
  els.favoriteSlotBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => selectFavorite(state, index));
  });
  refreshFavoriteSlots(state);
}

// Rebuilds every favorite slot's own icon/title from state.meta.favorites —
// called once at init and again any time the list actually changes (a
// toggle/removal), NOT every frame (nothing here needs to be, unlike the
// plain .selected highlight in updateToolbar above).
function refreshFavoriteSlots(state) {
  els.favoriteSlotBtns.forEach((btn, index) => {
    const tool = state.meta.favorites[index];
    const hotkeyNum = index + 4; // slots are hotkeys 4/5/6
    btn.innerHTML = '';
    // Per direct request ("add in badges to the 1-6 tools in the toolbar,
    // like the E and P badges") — this whole button's innerHTML gets wiped
    // and rebuilt every refresh (unlike the 3 static tools' plain markup
    // badges in index.html), so the badge has to be re-added here every
    // time too, same .panel-toggle-hotkey class the Shop/Tank Upgrades
    // toggle buttons already use.
    const badge = document.createElement('span');
    badge.className = 'panel-toggle-hotkey';
    badge.textContent = String(hotkeyNum);
    btn.appendChild(badge);
    if (!tool) {
      btn.dataset.tool = '';
      btn.title = `Empty favorite slot (${hotkeyNum}) — select a fish or building in the shop and press F to pin it here`;
      const placeholder = document.createElement('span');
      placeholder.className = 'tool-btn-favorite-empty';
      placeholder.textContent = '☆';
      btn.appendChild(placeholder);
      return;
    }
    btn.dataset.tool = tool;
    const isBuilding = tool.startsWith('build:');
    const id = tool.slice(tool.indexOf(':') + 1);
    const icon = document.createElement('canvas');
    icon.className = 'tool-btn-favorite-icon';
    icon.width = BUILDING_ICON_CANVAS_SIZE;
    icon.height = BUILDING_ICON_CANVAS_SIZE;
    let name = id;
    if (isBuilding) {
      drawBuildingIconCanvas(icon, id);
      name = BUILDING_TYPES[id] ? BUILDING_TYPES[id].name : id;
    } else {
      drawFishIconCanvas(icon, id);
      name = SPECIES[id] ? SPECIES[id].name : id;
    }
    btn.title = `${name} — favorite (${hotkeyNum}) — hover this slot and press F to remove it`;
    btn.appendChild(icon);
  });
}

// F pressed while the shop's own current selection is a build:/fish: tool —
// per direct spec: adds it to the first empty slot, or removes it if it's
// already favorited. A no-op for any other tool (Food/Merge/Blueprint/
// nothing selected), and a no-op if all 3 slots are already full and this
// isn't already one of them — a hard cap, deliberately no auto-replace of
// an existing favorite.
export function toggleFavoriteForSelectedTool(state) {
  const tool = state.ui.selectedTool;
  if (!tool.startsWith('build:') && !tool.startsWith('fish:')) return;
  const idx = state.meta.favorites.indexOf(tool);
  if (idx !== -1) {
    state.meta.favorites[idx] = null;
  } else {
    const emptyIdx = state.meta.favorites.indexOf(null);
    if (emptyIdx === -1) return; // all 3 full — hard cap
    state.meta.favorites[emptyIdx] = tool;
  }
  refreshFavoriteSlots(state);
}

// Real DOM :hover check — the simplest reliable way to answer "is the mouse
// over this exact fixed toolbar button right now," at the exact synchronous
// moment a keydown fires, without a separate mouseenter/mouseleave-tracked
// flag. Returns 0/1/2, or -1 if the cursor isn't over any favorite slot.
// Used both by removeFavoriteAtHoveredSlot below and updateHUD's own F
// legend text, both in this same module.
function getHoveredFavoriteSlotIndex() {
  for (let i = 0; i < els.favoriteSlotBtns.length; i++) {
    if (els.favoriteSlotBtns[i].matches(':hover')) return i;
  }
  return -1;
}

// F pressed while hovering a favorite slot on the toolbar — per direct
// spec, this ALWAYS removes (never adds), regardless of what's currently
// selected in the shop. Returns true if it actually removed something, so
// main.js's keydown handler can tell "F did the toolbar-hover thing" from
// "fall through to the shop-selection meaning" without duplicating this
// same hover check itself.
export function removeFavoriteAtHoveredSlot(state) {
  const idx = getHoveredFavoriteSlotIndex();
  if (idx === -1 || state.meta.favorites[idx] == null) return false;
  state.meta.favorites[idx] = null;
  refreshFavoriteSlots(state);
  return true;
}

// Arms a favorite slot's own tool exactly as if its real shop icon had been
// clicked — reuses pipetteSelectBuilding/pipetteSelectSpecies (already
// thin wrappers around selectBuildingForPreview/selectSpeciesForPreview,
// the exact same functions a real shop click calls) rather than duplicating
// that selection logic a third time.
export function selectFavorite(state, index) {
  const tool = state.meta.favorites[index];
  if (!tool) return;
  // Per direct request ("1-6 hotkeys... should work as a toggle to select/
  // deselect the tool/favorite") — same toggle shape selectTool's own build:/
  // fish:-agnostic tools just got above: re-triggering an already-armed
  // favorite clears back to the plain cursor instead of re-pipetting it
  // (a no-op that also would have reset pipetteRecipeId/pipetteFilterItems
  // for no reason).
  if (state.ui.selectedTool === tool) {
    state.ui.selectedTool = 'cursor';
    updateToolbar(state);
    return;
  }
  if (tool.startsWith('build:')) pipetteSelectBuilding(state, tool.slice('build:'.length));
  else if (tool.startsWith('fish:')) pipetteSelectSpecies(state, tool.slice('fish:'.length));
}

// familyId -> { btn, iconSpan, priceTag, dotsWrap, memberIds } for every
// family-grouped slot currently in the palette — lets refreshShopPrices
// update just the live price/current-tier display every frame the shop is
// open without rebuilding the whole palette. Rebuilt by buildBuildPalette.
let familyButtons = {};
// buildingId -> price-tag <span>, for every STANDALONE (non-family) building
// slot — same live-refresh purpose as speciesPriceTags below.
let buildingPriceTags = {};

// A small canvas rendering of a building's REAL hand-drawn look (Grid.js's
// renderTileShape — the exact same per-family art a placed tile renders
// with), per direct request ("make all the icons for the buildings in the
// shop, shop window, and science lab match the actual look of a placed
// building, instead of emojis"). Shared by every shop/Lab icon slot below —
// a plain, static draw (no animation needed, unlike the fish preview),
// re-run only when the icon actually needs to change (a tier cycle, or
// once at creation for anything that never changes tier).
const BUILDING_ICON_CANVAS_SIZE = 46;
const LAB_NODE_ICON_CANVAS_SIZE = 20;
const LAB_PURCHASE_ICON_CANVAS_SIZE = 34;
const PLATFORM_FILTER_ICON_CANVAS_SIZE = 26;
const RECIPE_OPTION_ICON_CANVAS_SIZE = 26; // matches .recipe-option-icon's own prior 26px emoji font-size
function drawBuildingIconCanvas(canvas, buildingId) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderTileShape(ctx, buildingId, BUILDING_TYPES[buildingId].color, 0, 0, canvas.width);
}

// drawFish draws at a fixed real-world scale (FISH_BASE_SIZE and up — an
// Electric-Eel-shaped body alone spans 1.5x that in length, before tails/
// tentacles/fins), regardless of how small the destination canvas is — a
// small icon canvas (the Lab tree's node/purchase-modal icons, the merge
// hover legend's icons) cropped most of the fish off per direct report ("too
// zoomed in so they can't all be seen"). This shrinks the draw around the
// canvas's own center so the WHOLE fish fits, without changing the canvas
// (icon) size itself — per direct request ("Dont make the icons bigger,
// just make it so more of the fish is shown in the same area").
// FISH_ICON_FULL_EXTENT_PX is a generous worst-case full width/height (a
// standard body's tail reaches ~1.9x FISH_BASE_SIZE behind center; this
// leaves real margin beyond that) that every body shape in FishRenderer.js
// comfortably fits inside — the shrink factor scales proportionally to
// whatever canvasSize the caller actually asks for.
const FISH_ICON_FULL_EXTENT_PX = 64;
function drawFishIconScaled(ctx, canvasSize, speciesId, stage, starTier = 1) {
  const c = canvasSize / 2;
  const shrink = canvasSize / FISH_ICON_FULL_EXTENT_PX;
  ctx.save();
  ctx.translate(c, c);
  ctx.scale(shrink, shrink);
  ctx.translate(-c, -c);
  drawFish(ctx, c, c, speciesId, stage, 1, 0, { x: 1, y: 0 }, starTier);
  ctx.restore();
}

// A small, static canvas rendering of a fish species' real look (an Adult,
// facing right, no idle animation — matching drawBuildingIconCanvas's own
// "one static frame" choice) — per direct request ("replace the rest of
// the stuff in the science lab with the actual Fish/Objects that it
// unlocks"). Reuses FishRenderer.js's real drawFish, the same function the
// Customization preview/shop preview already animate — shrunk to fit via
// drawFishIconScaled above.
function drawFishIconCanvas(canvas, speciesId) {
  const def = SPECIES[speciesId];
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!def) return;
  drawFishIconScaled(ctx, canvas.width, speciesId, def.growthStages.length - 1);
}

// Flat, representative colors for every item type that isn't one of the
// special two-tone/ringed treatments below — mirrors main.js's own
// ITEM_FLAT_COLOR_BY_TYPE/getCoinColor exactly, per direct request ("change
// the filter icons in the filter modal to match the actual object in the
// game rather than use emojis"). Coins get a fixed representative gold tone
// (COIN_TIERS' own gold tier) rather than any particular coin's own live
// value-tier color, since there's no specific coin instance to read a value
// from for a generic filter-list icon.
const FLAT_ICON_COLOR_BY_TYPE = {
  food: FOOD_COLOR,
  waste: WASTE_COLOR,
  alien_dna: ALIEN_DNA_COLOR,
  mutagen_paste: MUTAGEN_PASTE_COLOR,
  coin: COIN_TIERS[2].color, // gold — the single most recognizable coin tier
};

// Same idea for a physical item — reused wherever a Science Lab node's own
// unlock is really a Manufacturer/Power Plant recipe (see
// itemTypeForRecipeNode below) rather than a species or building, AND (per
// the direct request above) by the Platform item-filter pop-up's own icon
// grid, covering every item type in the game. Mirrors main.js's own
// per-item render branches (the two-tone Science/Green-Science/Biomass
// gradients, the Alien Egg's shell-plus-ring, the flat-fill-plus-rim-and-
// highlight path everything else gets), just as one static frame instead of
// a live, animated item — duplicated rather than imported since main.js
// can't be imported from here (it already imports FROM UI.js) and this is
// the one other module that needs it.
function drawItemIconCanvas(canvas, itemType) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  if (itemType === 'science' || itemType === 'science_green') {
    const colorA = itemType === 'science_green' ? SCIENCE_GREEN_COLOR_A : SCIENCE_ITEM_COLOR_A;
    const colorB = itemType === 'science_green' ? SCIENCE_GREEN_COLOR_B : SCIENCE_ITEM_COLOR_B;
    const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    gradient.addColorStop(0, colorB);
    gradient.addColorStop(1, colorA);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (itemType === 'biomass') {
    const gradient = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    gradient.addColorStop(0, BIOMASS_COLOR_CORE);
    gradient.addColorStop(1, BIOMASS_COLOR);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (itemType === 'alien_egg') {
    ctx.beginPath();
    ctx.fillStyle = ALIEN_EGG_COLOR;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = ALIEN_EGG_RING_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, -Math.PI / 2, Math.PI); // a static partial ring, not a live hatch countdown
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Generic flat-fill-plus-rim-and-highlight path — covers Coins, Food,
  // Waste, Bio-Sludge, and Mutagen Paste (see FLAT_ICON_COLOR_BY_TYPE above)
  // plus a plain gray fallback for anything unrecognized.
  const flatColor = FLAT_ICON_COLOR_BY_TYPE[itemType] || '#cccccc';
  ctx.beginPath();
  ctx.fillStyle = flatColor;
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
}

// Per direct request ("make it so all the stat lines in the shop use the
// actual object visual rather than an emoji to represent it") — an inline
// `<img>` tag standing in for whatever a stat line used to represent with a
// plain-Unicode emoji (🗑️/🍖/🔬/🟢/🟩/🧬/🪙/💩), built from the exact same
// drawItemIconCanvas real-art renderer the Platform filter/Lab tree icons
// already use elsewhere, baked to a data URL so it can drop straight into
// these functions' existing "build one big HTML string, innerHTML it in
// one shot" shape (buildingStatsHtml/fishEconomyStatsHtml et al.) without a
// bigger rewrite into real DOM nodes. drawItemIconCanvas's output is fully
// deterministic for a given itemType/size (no animation, no live game
// state) — cached per type+size so repeated calls (this runs fresh every
// time a shop selection's stats are built) never redraw or re-encode the
// same icon twice.
const itemIconDataUrlCache = new Map();
function itemIconImgHtml(itemType, sizePx = 14) {
  const cacheKey = `${itemType}:${sizePx}`;
  let dataUrl = itemIconDataUrlCache.get(cacheKey);
  if (!dataUrl) {
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    drawItemIconCanvas(canvas, itemType);
    dataUrl = canvas.toDataURL();
    itemIconDataUrlCache.set(cacheKey, dataUrl);
  }
  return `<img src="${dataUrl}" class="stat-item-icon" width="${sizePx}" height="${sizePx}" alt="">`;
}

// A Science Lab node granting nothing structural of its own (grants: {})
// can still be "really" a Manufacturer/Power Plant recipe unlock — matched
// by the same labNodeId lookup openLabPurchaseModal's own description text
// already uses. Manufacturer recipes have a real `output` item; a Power
// Plant recipe has no output item at all (it credits power directly), so
// its own fuel `inputs[0]` — the one physical thing that recipe actually
// revolves around — stands in for it instead.
function itemTypeForRecipeNode(nodeId) {
  const manuRecipe = MANUFACTURER_RECIPE_LIST.find((r) => r.labNodeId === nodeId);
  if (manuRecipe) return manuRecipe.output;
  const ppRecipe = POWER_PLANT_RECIPE_LIST.find((r) => r.labNodeId === nodeId);
  if (ppRecipe) return ppRecipe.inputs[0];
  return null;
}

// One of 'buildings' | 'recipes' | 'fish' | 'other' — per direct request
// ("filter icon buttons... No filter, Buildings, Recipes, Fish, Other").
// Reuses the exact same grants/itemTypeForRecipeNode checks
// buildingIconOrEmojiElement already resolves each node's real icon with,
// so the filter categories can never disagree with what a node's own icon
// actually shows.
function labNodeCategory(node) {
  if (node.grants && node.grants.buildings && node.grants.buildings.length) return 'buildings';
  if (node.grants && node.grants.species && node.grants.species.length) return 'fish';
  if (itemTypeForRecipeNode(node.id)) return 'recipes';
  return 'other'; // Turret Fire Rate, every Bubble Cap step, Fish Scaling, the end-game mystery node — nothing placeable/ownable to categorize as
}

// Dims every node not matching labFilterCategory ('all' shows everything) —
// called on a filter click and once after buildLabTree rebuilds the node
// buttons.
function applyLabFilter() {
  for (const id in labNodeButtons) {
    const { btn } = labNodeButtons[id];
    const matches = labFilterCategory === 'all' || btn.dataset.category === labFilterCategory;
    btn.classList.toggle('lab-node-dimmed', !matches);
  }
}

// Shared by the Lab tree's own node icon and its purchase modal — per
// direct request ("replace the rest of the stuff in the science lab with
// the actual Fish/Objects that it unlocks, leaving only emojis on things
// that aren't in the game, like turret fire rate and bubble caps"): a node
// granting a building shows that building's real look, a node granting a
// species shows that fish's real look, a node that's really a Manufacturer/
// Power Plant recipe unlock shows that recipe's own physical item — and
// anything else (a pure numeric modifier like Turret Fire Rate, an abstract
// capacity step like a Bubble Cap, the end-game mystery node) keeps its own
// emoji exactly as before, since none of those correspond to anything
// actually placeable/ownable in the tank. A node's own `icon` field is left
// completely untouched either way — this only changes what gets DRAWN.
function buildingIconOrEmojiElement(node, size) {
  const buildingId = node.grants && node.grants.buildings && node.grants.buildings[0];
  const speciesId = node.grants && node.grants.species && node.grants.species[0];
  const itemType = !buildingId && !speciesId ? itemTypeForRecipeNode(node.id) : null;
  if (!buildingId && !speciesId && !itemType) {
    const span = document.createElement('span');
    span.textContent = node.icon;
    return span;
  }
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  if (buildingId) drawBuildingIconCanvas(canvas, buildingId);
  else if (speciesId) drawFishIconCanvas(canvas, speciesId);
  else drawItemIconCanvas(canvas, itemType);
  return canvas;
}

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
  drawBuildingIconCanvas(f.iconCanvas, currentId);
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
  const iconCanvas = document.createElement('canvas');
  iconCanvas.className = 'tool-btn-building-icon';
  iconCanvas.width = BUILDING_ICON_CANVAS_SIZE;
  iconCanvas.height = BUILDING_ICON_CANVAS_SIZE;
  btn.appendChild(iconCanvas);
  const priceTag = document.createElement('span');
  priceTag.className = 'building-icon-price';
  btn.appendChild(priceTag);
  familyButtons[familyId] = { btn, iconCanvas, priceTag, dotsWrap, memberIds };

  btn.addEventListener('click', () => {
    const currentId = familySelectedTier[familyId];
    // Only cycle if this slot is already the active selection — a first
    // click just selects whatever tier it's currently defaulted to.
    if (state.ui.selectedTool === `build:${currentId}`) cycleFamilySelection(state, familyId);
    else applyFamilySelection(state, familyId, currentId);
  });

  refreshFamilyButton(state, familyId);
  els.buildToolGrid.appendChild(btn);
}

// The shared "tail" every family selection (a plain select, OR a cycle-to-
// the-next-tier) ends with — factored out so both share the exact same
// side effects (sync the button's own dataset.tool/icon/price/dots, arm
// the preview window, and the post-alien guided tutorial's "turret" step
// override, which always wants the base Waste Turret specifically
// regardless of which tier a click/cycle actually landed on).
function applyFamilySelection(state, familyId, tierId) {
  familySelectedTier[familyId] = tierId;
  const isPostAlienTurretStep = familyId === 'turret' && state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'turret';
  if (isPostAlienTurretStep) familySelectedTier[familyId] = familyButtons[familyId].memberIds[0];
  refreshFamilyButton(state, familyId); // sync dataset.tool to the (possibly just-overridden) tier before selecting it
  selectBuildingForPreview(state, BUILDING_TYPES[familySelectedTier[familyId]]);
  if (familyId === 'turret') advanceTutorialFlow(state, 'postalien', 'turret');
  // Per direct request ("when you select the turret just in the turret
  // tutorial, it automatically closes the shop first") — the shop no
  // longer needs to stay open for this tutorial's placement spot now that
  // it's moved to the middle of the city (see POST_ALIEN_TURRET_SPOT),
  // where it would otherwise sit right behind the fly-out panel.
  if (isPostAlienTurretStep) closeSidePanels(state);
  // The 'chest' flow's own equivalent of the turret tutorial's scroll->place
  // gold grant, per direct request ("give the player 20 gold during the
  // chest tutorial") — granted right here instead, since this flow has no
  // 'scroll' step of its own to hang it off; this IS the exact moment
  // 'select' resolves into 'place' for this flow. Guarded to fire only once
  // (advanceTutorialFlow itself already no-ops on a repeat call once the
  // step's moved on, but the money grant needs its own explicit guard so
  // re-selecting the same chest tile afterward doesn't grant it again).
  const isChestSelectStep = familyId === 'chest' && state.level.tutorialFlow?.id === 'chest' && state.level.tutorialFlow.step === 'select';
  if (isChestSelectStep) {
    advanceTutorialFlow(state, 'chest', 'select');
    state.level.money += CHEST_TUTORIAL_GOLD_GRANT;
    pushUiNotification(state, CHEST_TUTORIAL_GOLD_GRANT_MESSAGE);
    closeSidePanels(state);
  }
}

// Cycles a family slot to its next unlocked tier — shared by a shop slot's
// own repeat-click (buildFamilyButton above) and the R hotkey below.
function cycleFamilySelection(state, familyId) {
  const f = familyButtons[familyId];
  if (!f) return;
  const idx = f.memberIds.indexOf(familySelectedTier[familyId]);
  applyFamilySelection(state, familyId, f.memberIds[(idx + 1) % f.memberIds.length]);
}

function familyIdForBuilding(buildingId) {
  for (const [familyId, memberIds] of Object.entries(BUILDING_FAMILIES)) {
    if (memberIds.includes(buildingId)) return familyId;
  }
  return null;
}

// R hotkey, first half (main.js's KeyR handler) — per direct request
// ("pressing R while selected on any platform building to cycle between
// the 3 variants"), generalized to any multi-tier family rather than
// hardcoded to Platform specifically, since the mechanism (cycle to the
// next unlocked tier) is already exactly what a 2nd click on the shop slot
// does for every family. Returns true if something was actually cycled, so
// main.js knows whether to fall back to its OTHER job for R — cycling an
// already-placed, merely-hovered Platform instead (Grid.js's
// cyclePlatformAt), which only applies while NO build:/fish: tool is armed.
export function cycleSelectedBuildingFamily(state) {
  const tool = state.ui.selectedTool;
  if (!tool.startsWith('build:')) return false;
  const buildingId = tool.slice('build:'.length);
  const familyId = familyIdForBuilding(buildingId);
  if (!familyId) return false;
  cycleFamilySelection(state, familyId);
  return true;
}

function buildSingleBuildingButton(state, building) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn tool-btn-build sheen-target';
  btn.title = building.name;
  const iconCanvas = document.createElement('canvas');
  iconCanvas.className = 'tool-btn-building-icon';
  iconCanvas.width = BUILDING_ICON_CANVAS_SIZE;
  iconCanvas.height = BUILDING_ICON_CANVAS_SIZE;
  btn.appendChild(iconCanvas);
  drawBuildingIconCanvas(iconCanvas, building.id); // single-tier — never needs a refresh, drawn once here
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
  const coinFillPct = Math.round(COIN_TIMER_FEED_BONUS_FRACTION_BY_LEVEL[level] * 100);
  if (level >= FOOD_QUALITY_UPGRADE_MAX_LEVEL) {
    return `Food fills ${relief} hunger, fills the coin meter ${coinFillPct}%.`;
  }
  const nextRelief = FOOD_HUNGER_RELIEF_BY_LEVEL[level + 1];
  const nextCoinFillPct = Math.round(COIN_TIMER_FEED_BONUS_FRACTION_BY_LEVEL[level + 1] * 100);
  return (
    `Food fills <span class="stat-current">${relief} hunger</span> → <span class="stat-next">${nextRelief} hunger</span>, ` +
    `fills the coin meter <span class="stat-current">${coinFillPct}%</span> → <span class="stat-next">${nextCoinFillPct}%</span>.`
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

function describeFishHealthLevel(level) {
  const hp = FISH_HEALTH_UPGRADE_BONUS_PER_LEVEL * level;
  if (level >= FISH_HEALTH_UPGRADE_MAX_LEVEL) {
    return `Max health +${hp}.`;
  }
  const nextHp = FISH_HEALTH_UPGRADE_BONUS_PER_LEVEL * (level + 1);
  return `Max health <span class="stat-current">+${hp}</span> → <span class="stat-next">+${nextHp}</span>.`;
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

let tankCards = null; // { foodQuality, fishMovement, tankExpansion, fishHealth } — each { card, levelEl, descEl, buyBtn }. Splicing itself was never a purchase here — see Config.js's SCIENCE_LAB_UPGRADES' 3 flat hybrid nodes. Food Capacity retired entirely — see Config.js's FOOD_STATIONARY_TO_WASTE_MS. Coin Capacity is gone entirely, per direct request ("remove the coin cap limit from the game completely, and the upgrades for it"). "Gold/min Stat", "Electricity Graph" and "Wave Countdown" are gone too, per direct request(s) to give the player that info/access for free from the start — see Config.js's own comment where their cost constants used to live.

function buildTankPanel(state) {
  els.tankUpgradeList.innerHTML = '';
  const foodQuality = createUpgradeCard('Food Quality', '🍽️');
  const fishMovement = createUpgradeCard('Fish Movement', '🏊');
  const tankExpansion = createUpgradeCard('Expand Tank', '🏗️');
  const fishHealth = createUpgradeCard('Fish Health', '❤️');
  tankCards = { foodQuality, fishMovement, tankExpansion, fishHealth };

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
  // A 5-tier leveled ladder, same shape as Food Quality/Fish Movement above —
  // per direct request, each purchase permanently unlocks
  // TANK_EXPANSION_ROWS_PER_TIER more buildable seabed rows at the bottom of
  // the city (see Grid.js's getUnlockedSeabedRowEnd/canPlaceTile and
  // Config.js's "Tank Expansion" comment for how that's actually enforced —
  // this button only ever touches the tier number itself).
  tankExpansion.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.tankExpansionTier;
    if (level >= TANK_EXPANSION_MAX_TIER) return;
    const cost = TANK_EXPANSION_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.tankExpansionTier += 1;
    playUpgrade();
    refreshTankPanel(state);
  });
  // Bottom-of-the-list 5-level ladder, per direct request — see Config.js's
  // FISH_HEALTH_UPGRADE_* for the full reasoning on why this raises max HP
  // rather than the separate (unenforced) `lifespan` species field.
  fishHealth.buyBtn.addEventListener('click', () => {
    const level = state.level.upgrades.fishHealth;
    if (level >= FISH_HEALTH_UPGRADE_MAX_LEVEL) return;
    const cost = FISH_HEALTH_UPGRADE_COSTS[level];
    if (state.level.tankPoints.available < cost) return;
    state.level.tankPoints.available -= cost;
    state.level.upgrades.fishHealth += 1;
    playUpgrade();
    refreshTankPanel(state);
  });

  // Fish Merging's own card is gone entirely — per direct request, merging
  // is always available now, no Tank Upgrade purchase needed (see
  // Entities.js's isCombinableFish). Coin Capacity is gone entirely too —
  // per direct request, Food Quality takes its place as the panel's FIRST
  // card (also its own removed slot's old spot in the tutorial — see
  // foodQuality's buyBtn listener above). Fish Health was originally last
  // ("at the bottom of the list"), moved up to SECOND per a later direct
  // request ("make fish health the second option").
  els.tankUpgradeList.append(foodQuality.card, fishHealth.card, fishMovement.card, tankExpansion.card);

  refreshTankPanel(state);
}

// Re-checked every frame the panel is open (from updateHUD), same pattern
// as refreshPreviewBuyButton/refreshMoundThrowButton — level/cost/afford
// state can all change while the player has it open.
function refreshTankPanel(state) {
  if (!tankCards) return;
  const { foodQuality, fishMovement, tankExpansion, fishHealth } = tankCards;
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

  const teLevel = state.level.upgrades.tankExpansionTier;
  const rowsUnlocked = teLevel * TANK_EXPANSION_ROWS_PER_TIER;
  tankExpansion.levelEl.textContent = `Tier ${teLevel} / ${TANK_EXPANSION_MAX_TIER}`;
  if (teLevel >= TANK_EXPANSION_MAX_TIER) {
    tankExpansion.descEl.textContent = `Fully expanded — +${rowsUnlocked} extra rows of city unlocked.`;
    tankExpansion.buyBtn.textContent = 'Maxed out';
    tankExpansion.buyBtn.disabled = true;
  } else {
    const cost = TANK_EXPANSION_UPGRADE_COSTS[teLevel];
    tankExpansion.descEl.textContent =
      `+${rowsUnlocked} extra rows of city unlocked so far. Next tier adds ${TANK_EXPANSION_ROWS_PER_TIER} more rows to build on.`;
    tankExpansion.buyBtn.textContent = `${cost} 🏆`;
    tankExpansion.buyBtn.disabled = available < cost;
  }

  const fhLevel = state.level.upgrades.fishHealth;
  fishHealth.levelEl.textContent = `Level ${fhLevel} / ${FISH_HEALTH_UPGRADE_MAX_LEVEL}`;
  fishHealth.descEl.innerHTML = describeFishHealthLevel(fhLevel);
  if (fhLevel >= FISH_HEALTH_UPGRADE_MAX_LEVEL) {
    fishHealth.buyBtn.textContent = 'Maxed out';
    fishHealth.buyBtn.disabled = true;
  } else {
    const cost = FISH_HEALTH_UPGRADE_COSTS[fhLevel];
    fishHealth.buyBtn.textContent = `${cost} 🏆`;
    fishHealth.buyBtn.disabled = available < cost;
  }

  els.tankPointsDisplay.textContent = `🏆 ${available}`;
}

// ---- Tank panel view switcher (Upgrades / Achievements / Customization) ----
// Per direct request: one panel, same size/position as the original Tank
// Upgrades panel, now switches between 3 views via a small tab row at the
// top — each view also shows the other two as buttons (the tab row itself
// is shared/always visible, so this is satisfied for free rather than
// needing each view to duplicate its own pair of "go to the other panel"
// buttons).
export function setTankPanelView(state, view) {
  state.ui.tankPanelView = view;
  els.tankViewUpgrades.classList.toggle('hidden', view !== 'upgrades');
  els.tankViewAchievements.classList.toggle('hidden', view !== 'achievements');
  els.tankViewCustomization.classList.toggle('hidden', view !== 'customization');
  els.tankTabUpgradesBtn.classList.toggle('active', view === 'upgrades');
  els.tankTabAchievementsBtn.classList.toggle('active', view === 'achievements');
  els.tankTabCustomizationBtn.classList.toggle('active', view === 'customization');
  // The live hat-preview guppy only needs to animate while its own view is
  // actually the one showing — see startCustomizationPreviewAnimation's own
  // comment.
  if (view === 'customization') startCustomizationPreviewAnimation(state);
  else stopCustomizationPreviewAnimation();
  refreshTankPanelView(state);
}

// Called every frame the Tank panel is open (see updateHUD below) — refreshes
// whichever single view is actually showing, same "don't waste work on
// hidden content" precedent every other conditionally-visible panel in this
// file already follows.
function refreshTankPanelView(state) {
  if (state.ui.tankPanelView === 'upgrades') refreshTankPanel(state);
  else if (state.ui.tankPanelView === 'achievements') refreshAchievementPanel(state);
  else refreshCustomizationPanel(state);
}

// ---- Base Stats panel (Tab) ----
// Per direct request ("a toggleable modal that you press tab to fly onto the
// left side of the screen... shows all the stats about your base"). Rebuilt
// fresh every time it's opened AND every frame it stays open (mirrors the
// Tank panel's own refresh-while-open pattern, see updateHUD below) — it's
// cheap for this game's typical entity/building counts, same reasoning
// computeTheoreticalGoldPerMinute's own doc comment already gives.
let statsPanelOpen = false;
export function isStatsPanelOpen() { return statsPanelOpen; }
export function openStatsPanel(state) {
  statsPanelOpen = true;
  els.statsPanel.classList.add('open');
  refreshStatsPanel(state);
}
export function closeStatsPanel() {
  statsPanelOpen = false;
  els.statsPanel.classList.remove('open');
}
export function toggleStatsPanel(state) {
  if (statsPanelOpen) closeStatsPanel();
  else openStatsPanel(state);
}

// A plain "label -> value" row. `locked`, when true, renders as a single
// dim italic line instead (no value column) — used for a stat that's real
// but gated behind an upgrade/recipe the player hasn't bought yet, so the
// panel still tells them it EXISTS without showing a live number for
// something they can't act on yet.
// iconColor, when given, prepends a small colored dot matching the real
// item's own color (FOOD_COLOR, the silver Coin tier, etc.) — per direct
// request ("Add in an icon of the actual object in the info tab for each
// stat"). Only Food/min and Coin/min actually pass one; every other row is
// unchanged (no icon requested for Gold/min or anything else here).
function statsPanelRowHtml(label, value, iconColor = null) {
  const icon = iconColor ? `<span class="stats-panel-row-icon" style="background:${iconColor}"></span>` : '';
  return `<div class="stats-panel-row"><span class="stats-panel-row-label">${icon}${label}</span><span class="stats-panel-row-value">${value}</span></div>`;
}
function refreshStatsPanel(state) {
  const rows = [];

  // Gold/min (dollar value) and Coin/min (physical item count) are two
  // separate stats, per direct clarification — a tank of many cheap fish and
  // a tank of few expensive ones can earn the same Gold/min while needing
  // very different Coin/min worth of Collector/Processor throughput to
  // actually handle it all. Both unconditional now — no Tank Upgrade left to
  // gate either (the old "Gold/min Stat" node is gone entirely, per direct
  // request: "give the player access to that info from the very beginning").
  // Coin/min and Food/min needed now show a tenths-place decimal (were
  // whole-number Math.round) — per direct request. Gold/min stays a whole
  // dollar figure (a fractional cent reads oddly for a currency amount) and
  // gets no icon, per the same request ("No icon for the gold/min needed").
  rows.push(statsPanelRowHtml('Gold/min', `$${Math.round(computeTheoreticalGoldPerMinute(state))}`));
  rows.push(statsPanelRowHtml('Coin/min', computeTheoreticalCoinCountPerMinute(state).toFixed(1), COIN_TIERS[1].color));
  rows.push(statsPanelRowHtml('Food/min needed', computeTheoreticalFoodNeededPerMinute(state).toFixed(1), FOOD_COLOR));
  rows.push(statsPanelRowHtml('Waste/min', computeTheoreticalWastePerMinute(state).toFixed(1)));

  const researcherUnlocked = state.meta.speciesUnlocked.some((id) => SPECIES[id].behavior.includes('RESEARCHER'));
  if (researcherUnlocked) {
    rows.push(statsPanelRowHtml('Science/min', computeTheoreticalSciencePerMinute(state).toFixed(1)));
  }

  if (state.meta.buildingsUnlocked.includes(TILE_MANUFACTURER)) {
    rows.push(statsPanelRowHtml('Biomass/min', computeTheoreticalBiomassPerMinute(state).toFixed(1)));
  }
  if (state.meta.labUpgradesPurchased.includes('recipe_bio_feeder')) {
    rows.push(statsPanelRowHtml('Mutagen Paste/min', computeTheoreticalManufacturerOutputPerMinute(state, 'mutagen_paste').toFixed(1)));
  }
  if (state.meta.labUpgradesPurchased.includes('recipe_alien_egg')) {
    rows.push(statsPanelRowHtml('Alien Egg/min', computeTheoreticalManufacturerOutputPerMinute(state, 'alien_egg').toFixed(1)));
  }
  if (state.meta.labUpgradesPurchased.includes('green_science_tech')) {
    rows.push(statsPanelRowHtml('Green Science/min', computeTheoreticalManufacturerOutputPerMinute(state, 'science_green').toFixed(1)));
  }

  // Alien Wave/timer — moved off the HUD entirely, per direct request, into
  // here instead. Used to be hidden until its own Tank Upgrade was bought;
  // per a later direct request ("give the alien wave timer... to the player
  // at the very start") it's unconditional now, same "wave in progress"/
  // boss-fight fallback text as before (see the old updateHUD block this
  // replaced) rather than a stale/misleading numeric countdown.
  rows.push(statsPanelRowHtml('Alien Wave', state.level.alienWavesSpawned));
  let waveTimerText;
  if (state.level.bossPhase) waveTimerText = '—';
  else if (state.level.alienWaveActive) waveTimerText = 'in progress';
  else waveTimerText = `${Math.max(0, Math.ceil((state.level.alienNextWaveAtMs - state.level.elapsed) / 1000))}s`;
  rows.push(statsPanelRowHtml('Next Wave', waveTimerText));

  els.statsPanelList.innerHTML = rows.join('');
}

// ---- Achievements ----
// Built once, like the Tank Upgrades cards above — one card per
// Config.js's ACHIEVEMENT_LIST entry, each carrying its own Claim button.
// `achievementCards` maps id -> { card, claimBtn }.
let achievementCards = null;

function buildAchievementPanel(state) {
  els.achievementList.innerHTML = '';
  achievementCards = {};
  for (const achievement of ACHIEVEMENT_LIST) {
    const card = document.createElement('div');
    card.className = `achievement-card tier-${achievement.tier} sheen-target`;
    const nameEl = document.createElement('div');
    nameEl.className = 'achievement-name';
    nameEl.textContent = achievement.name;
    const descEl = document.createElement('div');
    descEl.className = 'achievement-desc';
    descEl.textContent = achievement.description;
    const claimBtn = document.createElement('button');
    claimBtn.className = 'achievement-claim-btn';
    claimBtn.addEventListener('click', () => claimAchievement(state, achievement.id));
    card.append(nameEl, descEl, claimBtn);
    els.achievementList.append(card);
    achievementCards[achievement.id] = { card, claimBtn };
  }
  refreshAchievementPanel(state);
}

function claimAchievement(state, id) {
  if (!state.meta.achievementsUnlocked.includes(id)) return; // not actually earned yet — defensive, the button itself is disabled in this case
  if (state.meta.achievementsClaimed.includes(id)) return; // already claimed — defensive, same reasoning
  const achievement = ACHIEVEMENTS[id];
  state.meta.achievementsClaimed.push(id);
  state.meta.fishyGems += ACHIEVEMENT_GEM_REWARD_BY_TIER[achievement.tier];
  playUpgrade();
  refreshAchievementPanel(state);
}

// Re-checked every frame this view is open — an achievement can go from
// locked to unlocked at any moment (Systems.js's updateAchievements runs
// every tick), and Claim itself needs to react immediately.
function refreshAchievementPanel(state) {
  if (!achievementCards) return;
  for (const achievement of ACHIEVEMENT_LIST) {
    const { claimBtn, card } = achievementCards[achievement.id];
    const unlocked = state.meta.achievementsUnlocked.includes(achievement.id);
    const claimed = state.meta.achievementsClaimed.includes(achievement.id);
    card.classList.toggle('claimed', claimed);
    const reward = ACHIEVEMENT_GEM_REWARD_BY_TIER[achievement.tier];
    if (claimed) {
      claimBtn.textContent = 'Claimed ✓';
      claimBtn.disabled = true;
    } else if (unlocked) {
      claimBtn.textContent = `Claim — ${reward} 💎`;
      claimBtn.disabled = false;
    } else {
      claimBtn.textContent = `Locked — ${reward} 💎`;
      claimBtn.disabled = true;
    }
  }
  els.achievementGemsDisplay.textContent = `💎 ${state.meta.fishyGems}`;
}

// ---- Customization (hats) ----
// Same "build once, refresh every frame it's open" shape as the achievement
// cards above. `hatCards` maps id -> { card, buyBtn }. The always-free 'none'
// option (Config.js's HATS.none) is prepended so un-equipping is just
// another card, not a separate button somewhere else.
let hatCards = null;

function buildCustomizationPanel(state) {
  els.hatGrid.innerHTML = '';
  hatCards = {};
  for (const hat of [HATS.none, ...HAT_LIST]) {
    const card = document.createElement('div');
    card.className = 'hat-card sheen-target';
    // Per direct request: clicking anywhere on the card previews that hat
    // for free (even unowned, even "No Hat"), without buying/equipping it —
    // only the Buy/Equip button itself actually spends gems or changes the
    // real in-tank equipped hat. The button's own listener below stops this
    // click from also bubbling up here.
    card.addEventListener('click', () => selectHatForPreview(state, hat.id));
    const iconEl = document.createElement('div');
    iconEl.className = 'hat-icon';
    iconEl.textContent = hat.icon;
    const nameEl = document.createElement('div');
    nameEl.className = 'hat-name';
    nameEl.textContent = hat.name;
    const buyBtn = document.createElement('button');
    buyBtn.className = 'hat-buy-btn';
    buyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      buyOrEquipHat(state, hat.id);
    });
    card.append(iconEl, nameEl, buyBtn);
    els.hatGrid.append(card);
    hatCards[hat.id] = { card, buyBtn };
  }
  refreshCustomizationPanel(state);
}

function selectHatForPreview(state, id) {
  state.ui.customizationPreviewHatId = id;
  refreshCustomizationPanel(state);
}

// Live "what will my fish look like" preview — an adult Guppy with whatever
// hat is currently equipped, per direct request ("add a preview window of
// an adult guppy swimming so we can see what they will look like with the
// hats being chose without having to start the game first"). Same idle
// tail-wiggle shape the shop's own species preview animation already uses
// (a fresh rAF loop, restarted/stopped alongside the Customization view's
// own visibility — see setTankPanelView/updateTankPanelCollapse), just
// against this dedicated canvas instead of the shop's.
let customizationPreviewAnimHandle = null;
let customizationPreviewTailPhase = 0;
let customizationPreviewLastFrameTime = 0;

function startCustomizationPreviewAnimation(state) {
  if (customizationPreviewAnimHandle !== null) return;
  customizationPreviewLastFrameTime = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.1, (now - customizationPreviewLastFrameTime) / 1000);
    customizationPreviewLastFrameTime = now;
    customizationPreviewTailPhase = (customizationPreviewTailPhase + SHOP_PREVIEW_TAIL_PHASE_RATE * dt) % (Math.PI * 2);
    renderCustomizationPreview(state);
    customizationPreviewAnimHandle = requestAnimationFrame(tick);
  };
  customizationPreviewAnimHandle = requestAnimationFrame(tick);
}

function stopCustomizationPreviewAnimation() {
  if (customizationPreviewAnimHandle !== null) {
    cancelAnimationFrame(customizationPreviewAnimHandle);
    customizationPreviewAnimHandle = null;
  }
}

function renderCustomizationPreview(state) {
  const canvas = els.customizationPreviewCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const adultStage = SPECIES.guppy.growthStages.length - 1;
  const previewedHatId = state.ui.customizationPreviewHatId ?? state.meta.equippedHatId;
  drawFish(ctx, canvas.width / 2, canvas.height / 2, 'guppy', adultStage, 1, customizationPreviewTailPhase, { x: 1, y: 0 }, 1, 0, 0, previewedHatId);
}

function buyOrEquipHat(state, id) {
  const owned = state.meta.hatsUnlocked.includes(id);
  if (owned) {
    state.meta.equippedHatId = id;
    state.ui.customizationPreviewHatId = id;
    playUpgrade();
    refreshCustomizationPanel(state);
    return;
  }
  const hat = HATS[id];
  if (state.meta.fishyGems < hat.gemCost) return;
  state.meta.fishyGems -= hat.gemCost;
  state.meta.hatsUnlocked.push(id);
  state.meta.equippedHatId = id; // buying a hat also wears it immediately — no reason to make that a separate click
  state.ui.customizationPreviewHatId = id;
  playUpgrade();
  refreshCustomizationPanel(state);
}

function refreshCustomizationPanel(state) {
  if (!hatCards) return;
  const previewedHatId = state.ui.customizationPreviewHatId ?? state.meta.equippedHatId;
  for (const hat of [HATS.none, ...HAT_LIST]) {
    const { card, buyBtn } = hatCards[hat.id];
    const owned = state.meta.hatsUnlocked.includes(hat.id);
    const equipped = state.meta.equippedHatId === hat.id;
    card.classList.toggle('equipped', equipped);
    card.classList.toggle('previewing', previewedHatId === hat.id);
    if (equipped) {
      buyBtn.textContent = 'Equipped';
      buyBtn.disabled = true;
      buyBtn.classList.add('equipped-btn');
    } else if (owned) {
      buyBtn.textContent = 'Equip';
      buyBtn.disabled = false;
      buyBtn.classList.remove('equipped-btn');
    } else {
      buyBtn.textContent = hat.gemCost > 0 ? `${hat.gemCost} 💎` : 'Free';
      buyBtn.disabled = state.meta.fishyGems < hat.gemCost;
      buyBtn.classList.remove('equipped-btn');
    }
  }
  els.customizationGemsDisplay.textContent = `💎 ${state.meta.fishyGems}`;
}

// Per direct request: clicking an already-selected single-tier shop item
// (a fish, or a standalone building with no other tier) a second time
// deselects it instead of leaving it selected — defaults back to the Food
// tool, and the preview window back to its empty placeholder, same as if
// nothing had ever been picked. A multi-tier family building slot is
// deliberately NOT wired to this — clicking it again already cycles to the
// next tier (see buildFamilyButton), an established behavior this doesn't
// change.
export function deselectShopSelection(state) {
  currentPreviewSpecies = null;
  currentPreviewBuilding = null;
  stopPreviewAnimation();
  els.previewEmpty.classList.remove('hidden');
  els.previewContent.classList.add('hidden');
  // Deliberately NOT selectTool(state, 'cursor') — that also closes the Shop/
  // Tank Upgrades panel (see its own closeSidePanels call, for the bottom
  // hotbar's Food/Merge/Blueprint buttons), which would be wrong here: the
  // player is still IN the shop, just with nothing picked any more.
  state.ui.selectedTool = 'cursor';
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
  state.ui.lastArmedTool = state.ui.selectedTool; // Q hotkey's "reselect last building/fish" fallback — see main.js's KeyQ handler
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

// The Pipette Tool ("Smart Copy") — per direct request: hovering an
// already-placed fish or building and pressing Q arms that exact species/
// building as the current tool, exactly as if its shop icon had been
// clicked (same preview window, stats, and canvas ghost). main.js's keydown
// handler resolves WHAT is under the cursor (Entities.js's
// findFishForPipetteAt, or a real grid tile) and calls whichever of these
// applies — both are thin wrappers around the shop's own selection
// functions above, so there's exactly one place that actually builds the
// preview UI.
export function pipetteSelectSpecies(state, speciesId) {
  const species = SPECIES[speciesId];
  if (species) selectSpeciesForPreview(state, species);
}

// tileKey ("row,col") is the SPECIFIC pipetted building instance — per
// direct request ("pipette tool copies recipe/filter from pipetted
// building"), its own recipeId (Manufacturer/Power Plant)/filterItems
// (Platform/Fan) rides along in state.ui.pipetteRecipeId/pipetteFilterItems
// for main.js's placement code to apply to the next thing actually placed
// with this tool. Optional/defaults to null so every OTHER caller (there are
// none today, but keeps the signature safe) still works with just a
// buildingId, same as before.
//
// Also doubles as a Shift+Click: Snap Placement anchor, per direct request
// ("if the player uses Q to pipette a building, have that act as the last
// placed building") — a real tileKey means the player pipetted an actual
// placed tile, which is just as valid a line-start point as one they placed
// themselves this session, so it overwrites state.ui.lastPlacedTileCol/Row
// the same way main.js's own placement code does. A tileKey-less call (Q's
// "re-arm the last-used tool" shortcut with nothing under the cursor) leaves
// the existing anchor untouched instead of clearing it — there's no new
// position to anchor to, and the old one is still perfectly valid.
export function pipetteSelectBuilding(state, buildingId, tileKey = null) {
  const building = BUILDING_TYPES[buildingId];
  if (!building) return;
  selectBuildingForPreview(state, building); // resets pipetteRecipeId/pipetteFilterItems to null first — see its own comment
  if (tileKey) {
    const [row, col] = tileKey.split(',').map(Number);
    state.ui.lastPlacedTileCol = col;
    state.ui.lastPlacedTileRow = row;
  }
  const data = tileKey ? state.level.buildingData[tileKey] : null;
  if (!data) return;
  if (buildingId === TILE_MANUFACTURER || buildingId === TILE_POWER_PLANT) state.ui.pipetteRecipeId = data.recipeId || null;
  if (data.filterItems) state.ui.pipetteFilterItems = [...data.filterItems];
}

// Buildings share the exact same preview window as species (same box, same
// name/description layout, same "click in the tank to place it" hint) — a
// building's cost is dynamic now too (see Grid.js's getBuildingCost),
// so its name/price text is refreshed the same live way as a species'.
function selectBuildingForPreview(state, building) {
  currentPreviewBuilding = building;
  currentPreviewSpecies = null;
  // A fresh (non-pipette) selection always starts clean — pipetteSelectBuilding
  // below re-populates these right after calling this same function, for the
  // one case they should actually be set. See state.ui.pipetteRecipeId's own
  // comment in main.js's initial ui state.
  state.ui.pipetteRecipeId = null;
  state.ui.pipetteFilterItems = null;
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
  state.ui.lastArmedTool = state.ui.selectedTool; // Q hotkey's "reselect last building/fish" fallback — see main.js's KeyQ handler
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
    // The Waste-per-N-seconds stat is gone entirely, per direct request —
    // the Collector no longer produces any Waste byproduct on any tier.
    // Power now depends on what's actually being collected (a coin costs
    // HALF as much as Science on the power-costing tiers, per direct
    // request) — shown as a plain min-max range, same convention the
    // Manufacturer's own per-ingredient power spread already uses; a flat
    // single number (the base Collector's 0) still reads correctly since
    // both ends of the range are identical.
    const powerRange = p.powerCostPerSecCoin === p.powerCostPerSecScience
      ? `${p.powerCostPerSecCoin}`
      : `${p.powerCostPerSecCoin}-${p.powerCostPerSecScience}`;
    return (
      `<div class="building-stat">⏱️ Coin <b>${p.coinMs / 1000}s</b> · ${itemIconImgHtml('science')} <b>${p.scienceMs / 1000}s</b> · ${itemIconImgHtml('science_green')} <b>${p.scienceGreenMs / 1000}s</b></div>` +
      `<div class="building-stat">⚡ <b>${powerRange}</b> mw/s</div>`
    );
  }
  const f = FAN_STATS[buildingId];
  if (f) {
    return `<div class="building-stat">📏 <b>${f.maxRange}px</b> · ⚡ <b>${f.powerCost}</b> mw/sec</div>`;
  }
  const t = TURRET_STATS[buildingId];
  if (t) {
    // "Global" range dropped entirely per direct request; the electrical
    // figure is per-shot now, not per-second (t.powerCostPerShot — the
    // player-facing number; powerCostPerSec is purely the derived rate
    // computeCurrentPowerDemand needs). Any ammo-consuming tier (Waste +
    // Electric Waste Turret — see TURRET_AMMO_TILES) shows the ammo stat;
    // the Electric tier ALSO needs power, so it shows both. Per direct
    // request ("add in the biomass on the turret description/stat line...
    // by showing the damage and shots per ammo as a range") — Biomass is a
    // second, better ammo option (see BIOMASS_TURRET_DAMAGE_MULTIPLIER/
    // BIOMASS_TURRET_SHOTS_PER_AMMO), so both the damage and the shots-per-
    // ammo figures show as a Waste-to-Biomass range on any ammo-consuming
    // tier instead of one flat number.
    const isAmmoTurret = TURRET_AMMO_TILES.has(buildingId);
    const isAdvancedTurret = buildingId === TILE_TURRET_ADVANCED;
    const biomassDamage = Math.round(t.damage * BIOMASS_TURRET_DAMAGE_MULTIPLIER * 10) / 10;
    // Per direct request ("make sure to show the damage of the advanced
    // turret as a range in the shop") — the Advanced Turret now ALSO shows a
    // range (base damage to ADVANCED_TURRET_BIOMASS_DAMAGE's flat 14),
    // despite not being an "ammo turret" (TURRET_AMMO_TILES) at all — its
    // own separate optional Biomass reserve (see that constant's own comment
    // in Config.js) is what the higher end of this range refers to.
    const damageText = isAmmoTurret ? `${t.damage}-${biomassDamage}` : isAdvancedTurret ? `${t.damage}-${ADVANCED_TURRET_BIOMASS_DAMAGE}` : `${t.damage}`;
    const ammoIcons = `${itemIconImgHtml('waste')}${itemIconImgHtml('biomass')}`;
    const ammoText = `${ammoIcons} <b>${WASTE_TURRET_SHOTS_PER_WASTE}-${BIOMASS_TURRET_SHOTS_PER_AMMO}</b>/ammo, holds <b>${WASTE_TURRET_MAX_WASTE}</b>`;
    const powerText = `⚡ <b>${t.powerCostPerShot}</b> mw/shot`;
    let line2;
    if (isAmmoTurret && t.powerCostPerShot > 0) line2 = `${ammoIcons} <b>${WASTE_TURRET_SHOTS_PER_WASTE}-${BIOMASS_TURRET_SHOTS_PER_AMMO}</b>/ammo · ${powerText}`;
    else if (isAmmoTurret) line2 = ammoText;
    // Per direct request ("advanced turrets... don't need biomass to shoot,
    // but if it does have biomass, those shots do 14 damage a shot") — the
    // line makes clear Biomass is optional here, unlike the Waste/Electric
    // tiers' own required ammo line just above.
    else if (isAdvancedTurret) line2 = `${powerText} · ${itemIconImgHtml('biomass')} optional, holds <b>${ADVANCED_TURRET_MAX_BIOMASS_AMMO}</b>`;
    else line2 = powerText;
    return (
      `<div class="building-stat">🔫 <b>${t.shotsPerSec}</b>/sec · 💥 <b>${damageText}</b> dmg</div>` +
      `<div class="building-stat">${line2}</div>`
    );
  }
  const r = REFINERY_STATS[buildingId];
  if (r) {
    const dnaS = (r.foodProcessMs * ALIEN_DNA_REFINERY_TIME_MULTIPLIER) / 1000;
    return (
      `<div class="building-stat">${itemIconImgHtml('waste')}➜${itemIconImgHtml('food')} <b>${r.foodProcessMs / 1000}s</b> · ${itemIconImgHtml('alien_dna')}➜${itemIconImgHtml('biomass')} <b>${dnaS}s</b></div>` +
      `<div class="building-stat">⚡ <b>${r.powerCostPerSec}</b> mw/sec</div>`
    );
  }
  if (MANUFACTURER_STATS[buildingId]) {
    // Per direct request, power now depends on which ingredient is being
    // processed (see MANUFACTURER_ITEM_POWER_COST_MW) — the shop/Lab
    // preview shows it as a plain min-max range; the recipe pop-up menu
    // (manufacturerRecipeMenuStatsHtml, below) shows the full per-item
    // breakdown instead, since that's the one place ingredient choice
    // actually matters.
    const rates = Object.values(MANUFACTURER_ITEM_POWER_COST_MW);
    const p = MANUFACTURER_ITEM_PROCESS_MS;
    return (
      `<div class="building-stat">${itemIconImgHtml('waste')} ${p.waste / 1000}s · ${itemIconImgHtml('food')} ${p.food / 1000}s · ${itemIconImgHtml('biomass')} ${p.biomass / 1000}s per item</div>` +
      `<div class="building-stat">Pick a recipe once placed · ⚡ <b>${Math.min(...rates)}-${Math.max(...rates)}</b> mw</div>`
    );
  }
  if (buildingId === TILE_POWER_PLANT) {
    return (
      `<div class="building-stat">${itemIconImgHtml('food')}➜20mw/15s · ${itemIconImgHtml('biomass')}➜40mw/20s · ${itemIconImgHtml('science')}➜100mw/30s</div>` +
      `<div class="building-stat">Pick a fuel recipe once placed</div>`
    );
  }
  return '';
}

// The Manufacturer's own recipe pop-up (refreshRecipeMenu below) gets a
// fuller, dedicated stats block instead of reusing buildingStatsHtml
// verbatim — per direct request, it drops the "Pick a recipe once placed"
// range line entirely (the shop/Lab preview above keeps it, unchanged) and
// shows the exact per-item processing time for all 4 ingredient types (not
// just the 3 the shop's own brief summary fits), plus the full power
// breakdown.
function manufacturerRecipeMenuStatsHtml() {
  const p = MANUFACTURER_ITEM_PROCESS_MS;
  return (
    `<div class="building-stat">🗑️ ${p.waste / 1000}s · 🍖 ${p.food / 1000}s · 🟩 ${p.biomass / 1000}s · 🔬 ${p.science / 1000}s per item</div>` +
    manufacturerPowerBreakdownHtml()
  );
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

// A square fully inscribed in a circle can be at most the circle's own
// diameter / sqrt(2) ≈ 0.707x it before its corners start poking out — see
// renderPreviewCanvas's own comment. Comfortably under that with a bit of
// breathing room.
const SHOP_PREVIEW_BUILDING_ART_SCALE = 0.66;

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
    // The real hand-drawn per-family building art (Grid.js's
    // renderTileShape — the exact same shape a placed tile renders with)
    // instead of a flat color swatch plus emoji — per direct request. Real
    // bug fixed, per direct follow-up report ("a lot of it is cut off by
    // the circle"): drawing the art at the FULL canvas size clipped it hard
    // against the circular crop, since a square whose SIDE equals the
    // circle's diameter has its own corners sitting well outside the circle
    // (a square fully inscribed in a circle can be at most the circle's
    // diameter / sqrt(2) ≈ 0.707x it). The circle is filled with the
    // building's own color FIRST, so shrinking the actual art to fit
    // entirely inside it doesn't leave a mismatched gap in the corners.
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = currentPreviewBuilding.color;
    ctx.fillRect(0, 0, SHOP_PREVIEW_CANVAS_SIZE, SHOP_PREVIEW_CANVAS_SIZE);
    const artSize = SHOP_PREVIEW_CANVAS_SIZE * SHOP_PREVIEW_BUILDING_ART_SCALE;
    const artOffset = (SHOP_PREVIEW_CANVAS_SIZE - artSize) / 2;
    renderTileShape(ctx, currentPreviewBuilding.id, currentPreviewBuilding.color, artOffset, artOffset, artSize);
    ctx.restore();
  }
}

// Re-checked every frame (from updateHUD) — the price itself used to be
// appended right here ("Electric Refinery — $30"), but per direct request
// ("remove all the prices from the titles of the shop items, since it
// already shows the price below in the item list") that's gone now — the
// icon grid's own per-item price-tag badge (speciesPriceTags/the building
// family dots) is the only place a price shows any more. This still needs
// to re-run every frame, even though the name itself never changes, purely
// so it initializes correctly the instant a species/building is first
// selected (selectSpeciesForPreview/selectBuildingForPreview don't call it
// directly).
function refreshPreviewInfo(state) {
  if (currentPreviewSpecies) {
    els.previewName.textContent = currentPreviewSpecies.name;
  } else if (currentPreviewBuilding) {
    els.previewName.textContent = currentPreviewBuilding.name;
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
// ECONOMY_FISH_COST_GROWTH_RATE/Grid.js's tiered building cost growth), so it's cheap
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
  playInsufficientFunds(); // per direct request — a failed purchase attempt now has a real "denied" sound, not just a silent shake
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

// Per direct request — the electricity graph popup used to anchor under
// its own HUD pill and could end up partly covered by the minimap; this
// instead positions it live off #hud's and #minimap-wrap's REAL current
// bounding boxes (both are independently right-anchored, variable-width
// `position: fixed` elements — there's no fixed relationship between them
// in plain CSS alone): left-aligned with the HUD's own left edge, top-
// aligned with the minimap and the same height, sized to fit the gap
// between the HUD's left edge and the minimap's left edge (minus a small
// margin on each side so it never touches either). The canvas's own
// width/height attributes (not just its CSS box) are resized to match —
// renderPowerGraph already reads canvas.width/height directly, so it draws
// correctly at whatever size lands here with no separate scaling logic
// needed. Called once on open and every frame it stays open (see
// updateHUD), so it also tracks a live window resize.
// Toggle-aware, same as #hud-power's own click handler — clicking the
// currently-open stat's element again closes it instead of re-opening.
function openHudInfoModal(state, key) {
  if (hudInfoModalOpen === key) { closeHudInfoModal(); return; }
  hudInfoModalOpen = key;
  const info = HUD_INFO_DATA[key];
  els.hudInfoModalTitle.textContent = `${info.icon} ${info.title}`;
  els.hudInfoModalDesc.textContent = info.desc;
  els.hudInfoModalStat.textContent = `${info.statLabel}: ${info.statFn(state)}`;
  els.hudInfoModal.classList.remove('hidden');
  positionHudInfoModal();
  playPanelOpen();
}

function closeHudInfoModal() {
  if (hudInfoModalOpen === null) return;
  hudInfoModalOpen = null;
  els.hudInfoModal.classList.add('hidden');
  playPanelClose();
}

// Sized/positioned off #minimap-wrap's real bounding box — "similar size as
// the minimap", positioned just to its left — same live-bounding-box
// technique positionPowerGraph uses just below, for the same reason (both
// are independently right-anchored fixed elements with no fixed relationship
// in CSS alone).
function positionHudInfoModal() {
  const minimapRect = els.minimapWrap.getBoundingClientRect();
  const gap = 8;
  els.hudInfoModal.style.width = `${Math.round(minimapRect.width)}px`;
  els.hudInfoModal.style.left = `${Math.round(minimapRect.left - minimapRect.width - gap)}px`;
  els.hudInfoModal.style.top = `${Math.round(minimapRect.top)}px`;
}

function positionPowerGraph(state) {
  const hudRect = els.hud.getBoundingClientRect();
  const minimapRect = els.minimapWrap.getBoundingClientRect();
  const gap = 8;
  const paddingEachSide = 10; // matches #hud-power-graph's own CSS padding
  const outerWidth = Math.max(100, minimapRect.left - hudRect.left - gap);
  const outerHeight = minimapRect.height;
  els.powerGraph.style.left = `${hudRect.left}px`;
  els.powerGraph.style.top = `${minimapRect.top}px`;
  const canvasWidth = Math.round(outerWidth - paddingEachSide * 2);
  const canvasHeight = Math.round(outerHeight - paddingEachSide * 2);
  if (els.powerGraphCanvas.width !== canvasWidth || els.powerGraphCanvas.height !== canvasHeight) {
    els.powerGraphCanvas.width = canvasWidth;
    els.powerGraphCanvas.height = canvasHeight;
    if (powerGraphOpen) renderPowerGraph(state);
  }
}

// Rolling one-minute (POWER_HISTORY_MAX samples, one per second) area/line
// graph of demand vs. supply — matches the game's own poppy pastel aesthetic
// (cream card, pink/blue accents) rather than a generic chart style.
// Redrawn only while the popup is actually open (from updateHUD, once per
// second when a new sample lands). supply is each second's freshly generated
// MW now, not an accumulated running total — see Levels.js's powerGenAccumMw
// — so this line moves up AND down like demand's, not just up.
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

// How long the top-center save/autosave toast (#save-toast) stays up before
// hiding itself — see state.ui.toastText's own comment in main.js for why
// this is ticked off a raw performance.now() timestamp instead of an
// accumulated dtMs.
const TOAST_DURATION_MS = 2600;
let toastHideTimer = null;

function updateSaveToast(state) {
  if (!state.ui.toastText) return;
  if (els.saveToast.textContent !== state.ui.toastText || els.saveToast.classList.contains('hidden')) {
    els.saveToast.textContent = state.ui.toastText;
    els.saveToast.classList.remove('hidden');
    // Same remove-reflow-readd restart trick playFlash already uses
    // elsewhere in this file, so a second toast firing before the first one
    // finished fading restarts the fade-out animation cleanly instead of
    // the class staying present (a no-op re-add) and the animation just
    // continuing from wherever it already was.
    els.saveToast.classList.remove('save-toast-fade');
    void els.saveToast.offsetWidth;
    els.saveToast.classList.add('save-toast-fade');
  }
  clearTimeout(toastHideTimer);
  toastHideTimer = setTimeout(() => {
    els.saveToast.classList.add('hidden');
    state.ui.toastText = null;
  }, TOAST_DURATION_MS);
}

export function updateHUD(state) {
  updateSaveToast(state);
  // Keeps the Merge gray-out live every frame — see updateToolbar's own
  // comment on why this can't just wait for the next tool-select event.
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
  // Same cross-module-flag pattern — see main.js's state.ui declaration for
  // why Grid.js can't call advanceTutorialFlow directly. Calling both is
  // safe: each is a no-op unless that exact flow/step is the one currently
  // active.
  if (state.ui.wasteTurretAmmoGainedPending) {
    state.ui.wasteTurretAmmoGainedPending = false;
    advanceTutorialFlow(state, 'postalien', 'dragwaste');
    advanceTutorialFlow(state, 'wastedrag', 'drag');
  }
  if (state.ui.chestItemAbsorbedPending) {
    state.ui.chestItemAbsorbedPending = false;
    advanceTutorialFlow(state, 'chest', 'feedwaste');
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

  // Alien Wave count/countdown, and the theoretical gold/min figure, are
  // gone from the HUD entirely, per direct request ("remove the alien wave
  // and wave timer from the HUD and add them in the informational tab";
  // later, "add Gold/min into the informational tab and remove it from the
  // HUD... give the player access to that info from the very beginning") —
  // see statsPanel's own refresh below, which shows Alien Wave/timer and
  // Gold/min both unconditionally now, no Tank Upgrade left to gate either.

  // Electricity — only shown at all once Electric Eel is unlocked, per
  // direct request. Text only updates once a real second, matching the
  // "updates every second" request exactly, since state.level.powerHistory
  // itself only gains a new entry once a second (see main.js's update()).
  const eelUnlocked = state.meta.speciesUnlocked.includes('electric_eel');
  els.power.classList.toggle('hidden', !eelUnlocked);
  // The dropdown arrow used to be a separate unlock from the mw text itself
  // (the old Electricity Graph Tank Upgrade); per a later direct request
  // it's unconditional now, so it just mirrors els.power's own visibility.
  els.powerArrow.classList.toggle('hidden', !eelUnlocked);
  if (eelUnlocked) {
    const history = state.level.powerHistory;
    const last = history[history.length - 1];
    // 3rd stat, per direct request ("no visual for how much battery power is
    // stored"), reordered to Using/Generating/Stored per a later direct
    // follow-up — last.raw is the actual generation THIS second before any
    // battery draw/charge is netted in (see main.js's own comment),
    // batteryStoredMw is the live charge level, not the capacity.
    const storedMw = Math.round(state.level.batteryStoredMw);
    els.powerText.textContent = last ? `⚡ ${last.demand}/${last.raw}/${storedMw} mw` : `⚡ 0/0/${storedMw} mw`;
    if (powerGraphOpen) { positionPowerGraph(state); renderPowerGraph(state); }
  } else if (powerGraphOpen) {
    powerGraphOpen = false;
    els.powerGraph.classList.add('hidden');
    els.powerArrow.classList.remove('open');
  }

  // Keep the HUD info modal's stat line and position live while it's open,
  // same "refresh every frame it's open" precedent as the power graph above.
  if (hudInfoModalOpen !== null) {
    const info = HUD_INFO_DATA[hudInfoModalOpen];
    els.hudInfoModalStat.textContent = `${info.statLabel}: ${info.statFn(state)}`;
    positionHudInfoModal();
  }

  refreshPreviewInfo(state);
  if (!state.ui.shopCollapsed) refreshShopPrices(state);
  if (moundMenuOpen) refreshMoundThrowButton(state);
  if (moundMenuOpen || moundMenuClosing) updateMoundMenuPosition(state); // keeps tracking through the shrink-back so it doesn't jump right as it starts closing
  // The option list's DOM is deliberately NOT rebuilt every frame like the
  // Mound's own throw-button refresh — refreshRecipeMenu tears down and
  // rebuilds the whole thing (innerHTML = ''), and doing that every single
  // frame while open made a real click's target element get detached
  // mid-click. It's rebuilt once on open and once per toggle click instead
  // (see openRecipeMenu/toggleBuildingRecipe) — those are the only two
  // moments its content can actually change. This lighter check just closes
  // the popup if the underlying tile gets demolished out from under it.
  if (recipeMenuOpen && !state.level.buildingData[recipeMenuTileKey]) closeRecipeMenu();
  if (recipeMenuOpen || recipeMenuClosing) updateRecipeMenuPosition(state);
  if (buildingInfoMenuOpen && !state.level.buildingData[buildingInfoTileKey]) closeBuildingInfoMenu(state); // the tile it's showing got demolished (or moved) out from under it
  if (buildingInfoMenuOpen) refreshBuildingInfoLiveStats(state);
  if (buildingInfoMenuOpen || buildingInfoMenuClosing) updateBuildingInfoMenuPosition(state);
  // Fish info modal — refreshFishInfoMenu both rebuilds the content AND
  // repositions every frame it's open (see its own comment for why, unlike
  // the building pop-up above); still needs a separate position-only call
  // while closing so it doesn't jump right as the shrink-back animation
  // starts, same as every other fly-out pop-up here.
  if (fishInfoMenuOpen) refreshFishInfoMenu(state);
  else if (fishInfoMenuClosing) updateFishInfoMenuPosition(state);
  // Same lighter per-frame check as the recipe/building-info pop-ups above —
  // the item grid's own DOM is only ever rebuilt on open or after a real
  // mutation (see refreshPlatformFilterMenu's own comment), never every
  // frame; this just closes the popup if the underlying tile/fish is gone.
  // activeFilterTarget covers both this pop-up's building and Magnet Fish
  // uses in one check.
  if (platformFilterMenuOpen && !activeFilterTarget(state)) closePlatformFilterMenu(state);
  if (platformFilterMenuOpen || platformFilterMenuClosing) updatePlatformFilterMenuPosition(state);
  if (storageChestMenuOpen && !state.level.buildingData[storageChestTileKey]) closeStorageChestModal(); // the tile it's showing got demolished (or moved) out from under it
  // Unlike the Platform filter menu above, this DOES refresh every frame
  // it's open — its own count/trickle state changes continuously in the
  // background (intake, the auto-trickle's own timer) rather than only in
  // response to a click here, and refreshStorageChestModal is cheap (a
  // couple of textContent/innerHTML swaps, not a grid of buttons to tear
  // down and rebuild).
  if (storageChestMenuOpen) refreshStorageChestModal(state);
  if (storageChestMenuOpen || storageChestMenuClosing) updateStorageChestModalPosition(state);
  if (labMenuOpen) refreshLabTree(state); // no position-tracking needed any more — it's a centered modal now, not anchored to the Mound's screen position
  if (!state.ui.tankPanelCollapsed) refreshTankPanelView(state);
  if (statsPanelOpen) refreshStatsPanel(state);

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
  // Purchase legend — says "Click to purchase" while a building OR a fish
  // is armed (state.ui.selectedTool starts with 'build:'/'fish:'). The
  // "(Esc) to cancel" half that used to live here moved into the persistent
  // bottom-left #hotkey-legend below as a dynamic Esc line instead, since
  // Escape's own job doubles as opening the pause menu now that the
  // dedicated pause button is gone — a single Esc line covering both
  // meanings reads better than two separate "(Esc) to ___" hints in
  // different corners. Suppressed during a guided tutorial, same as before
  // (the skip legend covers that case instead). The Merge tool no longer
  // shows this legend at all — it was only ever showing the now-removed
  // "(Esc) to cancel" half here.
  //
  // Also doubles as a live cost bubble for the Blueprint tool, per direct
  // request ("have a cost bubble appear to the left of the shop where it
  // would normally say 'Click to purchase' showing the cost of the whole
  // blueprint") — main.js writes state.ui.blueprintCost fresh every render()
  // frame (the same cross-module-flag pattern buildingMoveArmed/
  // buildingMoveHoverLabel below already use) whenever a captured stamp is
  // following the cursor, null otherwise; this shares the exact same bubble
  // rather than a second one, since the two states (a build:/fish: tool
  // armed vs. a Blueprint stamp armed) are already mutually exclusive.
  const tutorialActive = !!state.level.tutorialFlow;
  const toolIsPurchasable = state.ui.selectedTool.startsWith('build:') || state.ui.selectedTool.startsWith('fish:');
  const blueprintCostVisible = state.ui.blueprintCost != null;
  const buildLegendVisible = !tutorialActive && (toolIsPurchasable || blueprintCostVisible);
  // "Click to purchase" replaced with the actual live "Cost: $N" — per
  // direct request, the same bubble the Blueprint tool's own cost readout
  // already uses (the two are mutually exclusive, so sharing it needs no
  // extra UI), now showing the real price of whichever building/fish is
  // currently armed instead of a generic instruction. Shift-click Replace
  // (per direct request) can make this net cost negative (a profit) — shown
  // as "Profit: $N" instead of a nonsensical negative "Cost" — and, whenever
  // the hovered/pasted tile(s) are actually replacing something, shows the
  // "Shift+Click: Replace" pill above it (see positionBottomLeftLegends).
  let buildLegendText = '';
  let showReplaceLabel = false;
  if (blueprintCostVisible) {
    buildLegendText = formatBuildCostLegendText(state.ui.blueprintCost);
    showReplaceLabel = !!(state.ui.blueprintReplaceInfo && state.ui.blueprintReplaceInfo.replacing);
  } else if (state.ui.selectedTool.startsWith('build:')) {
    // Shift + Click: Snap Placement's own live multi-building total — per
    // direct request ("make sure the cost is dynamically updated to show
    // the multi-building cost... take into account the refunds... like the
    // blueprint does"), takes priority over the single-tile cost below
    // whenever main.js's render() actually has a snap line showing
    // (state.ui.snapLineCost, the same cross-module-flag pattern
    // buildReplaceInfo itself already uses) — already a net figure
    // (computeSnapLine's own totalCost - totalRefund), so the same
    // "Profit: $N" formatting Replace's own net cost uses applies here too,
    // for a line that refunds more than it costs.
    if (state.ui.snapLineCost != null) {
      buildLegendText = formatBuildCostLegendText(state.ui.snapLineCost);
    } else if (state.ui.buildReplaceInfo && state.ui.buildReplaceInfo.reason !== 'occupied') {
      // An 'occupied' rejection (hovering a placed building with Shift NOT
      // held) has a meaningless netCost of 0 — falls back to the tool's own
      // flat base cost instead of showing a misleading "Cost: $0", same as
      // every other reason buildReplaceInfo isn't usable here.
      buildLegendText = formatBuildCostLegendText(state.ui.buildReplaceInfo.netCost);
      showReplaceLabel = !!state.ui.buildReplaceInfo.replacing;
    } else {
      buildLegendText = `Cost: $${getBuildingCost(state, state.ui.selectedTool.slice('build:'.length))}`;
    }
  } else if (state.ui.selectedTool.startsWith('fish:')) {
    buildLegendText = `Cost: $${getFishPurchaseCost(state, state.ui.selectedTool.slice('fish:'.length))}`;
  }
  els.buildLegend.textContent = buildLegendText;
  els.buildLegend.classList.toggle('hidden', !buildLegendVisible);
  els.buildReplaceLegend.classList.toggle('hidden', !(buildLegendVisible && showReplaceLabel));
  // Shift + Click: Snap Placement's own hint pill, per direct request ("add
  // into the legend above the cost a 'Shift + Click: Snap Placement'") —
  // shares the exact same above-the-cost-legend slot as "Shift+Click:
  // Replace" (positionBottomLeftLegends stacks whichever is visible), so the
  // two are deliberately mutually exclusive: Replace only ever applies while
  // hovering an occupied tile, Snap Placement everywhere else a build tool
  // is armed (fish:/Blueprint excluded — this hint is buildings-only).
  const showSnapLabel = buildLegendVisible && state.ui.selectedTool.startsWith('build:') && !showReplaceLabel;
  els.buildSnapLegend.classList.toggle('hidden', !showSnapLabel);
  // Tutorial-skip legend — "(Esc) to skip tutorial" — shown for the whole
  // duration of any guided tutorial flow, per direct request; main.js's
  // Escape handler now actually honors this (see its own comment).
  els.tutorialSkipLegend.classList.toggle('hidden', !tutorialActive);
  // Both legends are now plain top-level elements (see index.html's own
  // comment for why — escaping #bottom-bar-row's stacking context is what
  // actually makes their z-index apply), so their "left of, bottom-aligned
  // with, the Shop button" position has to be computed live off the
  // button's real on-screen rect instead of plain CSS relative to a shared
  // positioned ancestor. Only bothers with the (layout-reading)
  // getBoundingClientRect call on a frame either one is actually visible.
  // Building-move legend — replaces the old on-canvas hover tooltip (main.js
  // used to draw a 🖱️ bubble over the cursor for Fans specifically). Per
  // direct request ("right-click to move is changed to middle-click to
  // move"), arming a move is now "Middle-click to Adjust" (Fan)/"Middle-
  // click to Move" (anything else) while just hovering a placed building
  // with nothing else going on; cancelling an already-in-progress move
  // stayed on right-click, per the later "make right-click a universal
  // cancel button" request — "Left-click to accept" + "Right-click to
  // cancel" while a move (or a moved Fan's own angle-choosing step) is
  // actually in progress. state.ui.buildingMoveHoverLabel/buildingMoveArmed
  // are written fresh every render() frame by main.js — read-only here.
  // Mutually exclusive with the purchase legend above (main.js only ever
  // sets these two while the cursor or Food tool is selected — see
  // isCursorOrFoodTool — and a build:/fish: tool being armed is what makes
  // buildLegendVisible true), so it shares the same anchor position.
  const buildingMoveLegendVisible = !tutorialActive && (state.ui.buildingMoveArmed || state.ui.buildingMoveHoverLabel != null);
  if (state.ui.buildingMoveArmed) {
    els.buildingMoveLegendLine1.textContent = 'Left-click to accept';
    els.buildingMoveLegendLine2.textContent = 'Right-click to cancel';
    els.buildingMoveLegendLine2.classList.remove('hidden');
    els.buildingMoveLegendLine3.classList.add('hidden'); // deleting mid-move isn't a thing
  } else if (state.ui.buildingMoveHoverLabel != null) {
    els.buildingMoveLegendLine1.textContent = state.ui.buildingMoveHoverLabel === 'adjust' ? 'Middle-click to Adjust' : 'Middle-click to Move';
    // Hovering a placed Platform (any of its 5 variants) also shows a
    // second "(R) to Rotate" line — per direct request — reusing this same
    // bubble's own line2 slot (normally only used for the armed "Right-
    // click to cancel" state, which is mutually exclusive with just
    // hovering).
    if (state.ui.buildingMoveHoverLabel === 'move-platform') {
      els.buildingMoveLegendLine2.textContent = '(R) to Rotate';
      els.buildingMoveLegendLine2.classList.remove('hidden');
    } else {
      els.buildingMoveLegendLine2.classList.add('hidden');
    }
    // "(D) to Delete" — per direct request, shown for ANY hovered building
    // (Fan/Platform/anything else alike), on top of whichever line2 hint
    // that specific building type also gets. Folded the old standalone
    // Demolish tool's whole job into this one held key — see main.js's
    // updateKeyDDelete for the actual deletion/full-refund/floating-text
    // mechanic this hint is describing.
    els.buildingMoveLegendLine3.textContent = '(D) to Delete';
    els.buildingMoveLegendLine3.classList.remove('hidden');
  }
  els.buildingMoveLegend.classList.toggle('hidden', !buildingMoveLegendVisible);

  // Fish merge/splice hover legend — main.js's render() already only fills
  // in state.ui.fishMergeHoverLines while none of the legends above are
  // active (see its own comment), so no extra mutual-exclusivity check is
  // needed here beyond just reading it.
  const fishMergeLegendVisible = !tutorialActive && state.ui.fishMergeHoverLines != null;
  if (fishMergeLegendVisible) refreshFishMergeLegendIcons(state.ui.fishMergeHoverLines);
  els.fishMergeLegend.classList.toggle('hidden', !fishMergeLegendVisible);

  if (buildLegendVisible || tutorialActive || buildingMoveLegendVisible || fishMergeLegendVisible) positionBottomLeftLegends();

  // Esc — per direct request ("Escape will close the shop menu, tank
  // upgrade menu, or science lab if they are open. If none of them are
  // open, escape will pause the game... Update the legend... to dynamically
  // switch from 'Close Menu' to 'Pause Menu'") — mirrors main.js's own
  // Escape handler condition exactly (labMenuOpen is this same module's own
  // transient, no cross-module flag needed).
  els.hotkeyLegendEsc.textContent = `Esc: ${(labMenuOpen || !state.ui.shopCollapsed || !state.ui.tankPanelCollapsed) ? 'Close Menu' : 'Pause Menu'}`;
  // Persistent E/Q hotkey reminder, bottom-left corner — per direct
  // request, always visible (unlike the two legends above), re-worded live
  // to match what each key actually does right now. `toolIsPurchasable` is
  // already computed above (a build:/fish: tool armed).
  els.hotkeyLegendE.textContent = `E: ${state.ui.shopCollapsed ? 'Open Shop' : 'Close Shop'}`;
  // Q is a genuine toggle, per direct request — Clear Cursor while ANY tool
  // is already armed ("something is being held" — build:/fish:, but also
  // Merge/Blueprint/Food per a later direct follow-up, not just
  // toolIsPurchasable's narrower build:/fish:-only build/purchase-cost
  // condition above), otherwise Pipette/reselect-last (see main.js's KeyQ
  // handler and state.ui.lastArmedTool). A copied Blueprint takes priority
  // over both — main.js's KeyQ handler checks it first too (see that
  // handler's own comment) — via state.ui.blueprintClipboardActive, written
  // fresh every render() frame.
  els.hotkeyLegendQ.textContent = state.ui.blueprintClipboardActive
    ? 'Q: Clear Blueprint'
    : (state.ui.selectedTool !== 'cursor' ? 'Q: Clear Cursor' : 'Q: Pipette/ Last-used Tool');
  // F — dynamically "Add Favorite"/"Remove Favorite", hidden entirely
  // whenever F would genuinely have nothing to do, per direct request
  // ("having it dynamically change between add/remove depending on what
  // the action will do in that instance"). Mirrors main.js's own KeyF
  // handler's exact decision tree — hovering a favorite slot always means
  // remove (even an already-empty one, which just hides the line, since
  // there's nothing there to remove); otherwise it's whatever the current
  // shop selection would do (add if a build:/fish: tool isn't already
  // favorited, remove if it is, hidden if there's no such tool selected or
  // all 3 slots are already full).
  const hoveredFavoriteIdx = getHoveredFavoriteSlotIndex();
  let favoriteLegendText = null;
  if (hoveredFavoriteIdx !== -1) {
    if (state.meta.favorites[hoveredFavoriteIdx] != null) favoriteLegendText = 'Remove Favorite';
  } else if (state.ui.selectedTool.startsWith('build:') || state.ui.selectedTool.startsWith('fish:')) {
    if (isFavorite(state, state.ui.selectedTool)) favoriteLegendText = 'Remove Favorite';
    else if (state.meta.favorites.includes(null)) favoriteLegendText = 'Add Favorite';
  }
  els.hotkeyLegendF.classList.toggle('hidden', favoriteLegendText === null);
  if (favoriteLegendText !== null) els.hotkeyLegendF.textContent = `F: ${favoriteLegendText}`;
  // Ctrl+Z — shown only while there's actually something to undo (main.js
  // writes state.ui.undoAvailable/undoLabel every time its own undo stack
  // changes — see that file's pushUndoEntry/performUndo).
  els.hotkeyLegendUndo.classList.toggle('hidden', !state.ui.undoAvailable);
  if (state.ui.undoAvailable) els.hotkeyLegendUndo.textContent = `Ctrl+Z: ${state.ui.undoLabel}`;
  // The SEPARATE "(Esc) to skip tutorial" hint (#tutorial-skip-legend) is
  // untouched by the Esc line above — that's still real, distinct Escape
  // behavior during a guided tutorial (and the two never show at once, see
  // buildLegendVisible's own tutorialActive gate near the top of this
  // function).
}

// The bottom-left hover legend (#fish-merge-legend) draws each merge/splice
// option as two small real drawFish icons with an arrow between them
// instead of names — per direct request ("use just the icons of the fish
// instead of the names... So instead of 'Splice with Guppy -> Magnet fish'
// just show '(Guppy icon) -> (Magnet Fish icon)'"). The fish info modal
// keeps the plain text sentence (see refreshFishInfoMenu's own `.text`
// usage) — only this hover legend changed. Rebuilt fresh every frame it's
// visible (same as the plain-text version it replaced), a handful of tiny
// (22px) canvases at most, so the per-frame DOM churn is negligible.
const FISH_MERGE_ICON_SIZE = 22;
function buildFishMergeIconCanvas(speciesId) {
  const canvas = document.createElement('canvas');
  canvas.width = FISH_MERGE_ICON_SIZE;
  canvas.height = FISH_MERGE_ICON_SIZE;
  canvas.className = 'fish-merge-icon';
  const def = SPECIES[speciesId];
  // Shrunk to fit via drawFishIconScaled (see its own comment) — per direct
  // follow-up request ("zoom out on the hover merge fish icons so the whole
  // fish can be seen... Dont make the icons bigger").
  drawFishIconScaled(canvas.getContext('2d'), FISH_MERGE_ICON_SIZE, speciesId, def.growthStages.length - 1);
  return canvas;
}
function refreshFishMergeLegendIcons(entries) {
  els.fishMergeLegend.innerHTML = '';
  for (const entry of entries) {
    if (entry.otherSpeciesId == null) {
      // The "No available fish to merge." entry — no icons to show.
      const div = document.createElement('div');
      div.textContent = entry.text;
      els.fishMergeLegend.appendChild(div);
      continue;
    }
    const row = document.createElement('div');
    row.className = 'fish-merge-icon-row';
    row.appendChild(buildFishMergeIconCanvas(entry.otherSpeciesId));
    const arrow = document.createElement('span');
    arrow.className = 'fish-merge-arrow';
    arrow.textContent = '→';
    row.appendChild(arrow);
    row.appendChild(buildFishMergeIconCanvas(entry.resultSpeciesId));
    els.fishMergeLegend.appendChild(row);
  }
}

// Shift-click Replace's own cost-legend text — a negative net cost (the
// refund from whatever's being replaced exceeded the new building's own
// price) reads as "Profit: $N" rather than a confusing "Cost: $-N".
function formatBuildCostLegendText(netCost) {
  if (netCost < 0) return `Profit: $${-netCost}`;
  return `Cost: $${netCost}`;
}

function positionBottomLeftLegends() {
  const rect = els.shopCollapseBtn.getBoundingClientRect();
  const right = `${window.innerWidth - rect.left + 12}px`;
  const bottom = `${window.innerHeight - rect.bottom}px`;
  els.buildLegend.style.right = right;
  els.buildLegend.style.bottom = bottom;
  els.tutorialSkipLegend.style.right = right;
  els.tutorialSkipLegend.style.bottom = bottom;
  els.buildingMoveLegend.style.right = right;
  els.buildingMoveLegend.style.bottom = bottom;
  els.fishMergeLegend.style.right = right;
  els.fishMergeLegend.style.bottom = bottom;
  // "Shift+Click: Replace" sits directly above the cost legend, per direct
  // request — stacked off the cost legend's own live measured height (a
  // separate top-level sibling, not a DOM parent/child, same as every other
  // legend here) plus a small gap, so it tracks correctly regardless of the
  // cost legend's own current text length. Only ever measured/positioned
  // while #build-legend itself is genuinely visible (this function is only
  // called when buildLegendVisible is true — see updateHUD) so its
  // getBoundingClientRect() height is never a stale/zero hidden-element read.
  els.buildReplaceLegend.style.right = right;
  const legendHeight = els.buildLegend.getBoundingClientRect().height || 0;
  const stackedBottom = `${window.innerHeight - rect.bottom + legendHeight + 6}px`;
  els.buildReplaceLegend.style.bottom = stackedBottom;
  // "Shift + Click: Snap Placement" shares this exact same stacked slot —
  // see updateHUD's own comment on why the two are mutually exclusive.
  els.buildSnapLegend.style.right = right;
  els.buildSnapLegend.style.bottom = stackedBottom;
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
  // reuses these same 5 arrows — forced visible (always pointing down)
  // regardless of the normal delay/hasScrolledDown/item-in-city gating
  // below, since by the time that step is reached the game may be many
  // minutes in (hasScrolledDown already true from earlier casual
  // scrolling) and what matters here is whether the camera is AT THE
  // BOTTOM right now, which main.js's own per-tick check
  // (isScrolledToBottom) already tracks independently to skip/advance the
  // step itself — this is purely the visual nudge.
  const forcedByPostAlienScrollStep = state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'scroll';
  // Per direct report ("the alien tutorial doesn't work if I'm scrolled to
  // the bottom of the tank... add in a scroll step to each tutorial if the
  // player is not scrolled to the correct place") — ANY guided-tutorial
  // step whose spotlight target is currently off-screen also arms this
  // same nudge now, generalized to point whichever direction actually
  // brings it back into view (tutorialScrollDirectionNeeded, shared with
  // updateTutorialOverlay's own text-swap for the same condition — see its
  // own comment for the full rationale). The postalien 'scroll' step above
  // has no getCircle at all (noSpotlight), so this always returns null for
  // it and the two conditions never fight over the arrow direction.
  const autoScrollDirection = tutorialScrollDirectionNeeded(state);
  // Per direct request, the normal (non-tutorial-forced) nudge now ALSO
  // requires at least one Coin/Waste/Food actually sitting in the city —
  // both conditions must hold — so it doesn't nag a player who has nothing
  // down there worth scrolling to see yet.
  const somethingInCity = state.level.items.some(
    (item) => item.y >= SEABED_FLOOR_Y && (item.type === 'coin' || item.type === 'waste' || item.type === 'food')
  );
  const shouldShow =
    forcedByPostAlienScrollStep ||
    autoScrollDirection != null ||
    (state.level.elapsed >= SCROLL_HINT_DELAY_MS && !state.level.tutorialFlags.hasScrolledDown && somethingInCity);
  els.scrollHint.classList.toggle('hidden', !shouldShow);
  const pointUp = !forcedByPostAlienScrollStep && autoScrollDirection === 'up';
  els.scrollHintText.textContent = pointUp ? 'Scroll up' : 'Scroll down';
  for (const arrow of els.scrollHintArrows) arrow.textContent = pointUp ? '⬆️' : '⬇️';
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
// Horizontally centered, per direct request ("the placement spot for the
// turret in the turret tutorial should be in the middle of the city"). This
// used to sit off toward the left edge specifically to stay clear of the
// Shop panel's own fly-out box, back when the Shop was meant to stay open
// through this step — now that selecting the Waste Turret during this exact
// tutorial step auto-closes the Shop (see the turret family button's click
// handler above), there's nothing left to stay clear of, so the spot can be
// the genuinely obvious, centered one. Vertically, it sits near — but not
// exactly on — the tank's real bottom edge, matching the "scroll all the
// way down" step immediately before this one. Real bug caught during
// testing (Playwright, after the tank's own height shrank — see Config.js's
// WORLD_TILES_H): a literal `bottom - TILE_SIZE / 2` (dead center of the
// very last seabed row) put this step's own spotlight circle visibly
// overlapping the fixed bottom tool-bar, since the circle's radius is a
// fixed 70 SCREEN px regardless of zoom while the toolbar sits at a fixed
// CSS position — 3 tiles of headroom keeps the whole circle clear of it at
// any reasonable viewport size, while staying comfortably inside the
// "scrolled to the bottom" view the previous step already established.
// A function, not a plain constant, since Tank Expansion made the tank's
// real bottom vary with the player's purchased tier (getUnlockedWorldH)
// rather than a fixed value computable once at module load.
function getPostAlienTurretSpot(state) {
  return { x: WORLD_W / 2, y: getUnlockedWorldH(state) - TILE_SIZE * 3 };
}
// Where the 'chest' guided flow's own Storage Chest gets placed — per direct
// design, deliberately near the Mound itself (MOUND_X, already imported for
// the Mound's own click-target/camera-centering) rather than the bottom of
// the tank like POST_ALIEN_TURRET_SPOT above, since the camera is already
// centered there right as this flow fires (Mound.js's crackMound) and there
// is nothing to scroll to first — this flow has no 'scroll' step at all.
// Offset clear of the Mound's own MOUND_WIDTH_TILES (4.4, so ~2.2 tiles
// either side of MOUND_X) footprint so the two click targets never overlap.
const POST_MOUND_CHEST_SPOT = { x: MOUND_X + TILE_SIZE * 4, y: SEABED_FLOOR_Y + TILE_SIZE * 2 };

// Shared by the post-alien flow's final step AND the standalone 'wastedrag'
// flow below (used when a Waste Turret already existed before the tutorial
// could walk the player through placing one) — a circle that encompasses
// BOTH the target Waste Turret and the nearest Waste item to it, per direct
// request ("the tutorial circle encapsulates the waste and the turret").
// Returns null (hides the spotlight) if there's no turret, or no Waste to
// drag yet — both should be unreachable given each flow's own trigger
// conditions, but this avoids a crash if the turret gets demolished or the
// Waste gets absorbed by something else mid-step.
// The 'chest' flow's own "drag Waste into the Chest" step spotlight — same
// "one circle encompassing both endpoints" shape as wasteDragStepCircle
// below, simplified since both endpoints here are fixed, known constants
// (POST_MOUND_CHEST_SPOT and the deterministic Waste spawned by
// Entities.js's spawnChestTutorialWaste) rather than needing a "nearest"
// search — there's always exactly one chest and one Waste this flow could
// mean. Returns null (hides the spotlight) if the locked Waste is somehow
// already gone.
function chestDragStepCircle(state) {
  const waste = state.level.items.find((it) => it.id === state.level.chestDragTutorialTargetId && it.type === 'waste');
  if (!waste) return null;
  const a = worldToScreen(POST_MOUND_CHEST_SPOT.x, POST_MOUND_CHEST_SPOT.y, state.camera);
  const b = worldToScreen(waste.x, waste.y, state.camera);
  const r = Math.hypot(a.x - b.x, a.y - b.y) / 2 + 40;
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, r };
}

function wasteDragStepCircle(state) {
  const target = findNearestWasteTurretAndWaste(state);
  if (!target || !target.waste) return null;
  const a = worldToScreen(target.turret.x, target.turret.y, state.camera);
  const b = worldToScreen(target.waste.x, target.waste.y, state.camera);
  const r = Math.hypot(a.x - b.x, a.y - b.y) / 2 + 40; // padding so both sit comfortably inside, not right at the edge
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, r };
}

// The first-time merge guided tutorial's "drag" step spotlight — a circle
// encompassing BOTH locked-in target fish (Entities.js's
// resolveMergeTutorialPair, same locking rationale as wasteDragStepCircle's
// own target above). Padding is a bit larger than the waste/turret case
// since fish are bigger and keep swimming around inside the circle, not
// sitting still. Returns null (hides the spotlight) if the locked pair is
// gone and no fresh combinable pair exists to fall back to.
function mergeFishStepCircle(state) {
  const pair = resolveMergeTutorialPair(state);
  if (!pair) return null;
  const a = worldToScreen(pair[0].x, pair[0].y, state.camera);
  const b = worldToScreen(pair[1].x, pair[1].y, state.camera);
  const r = Math.hypot(a.x - b.x, a.y - b.y) / 2 + 60;
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
  // selecting the OLD standalone Demolish tool there — since removed
  // entirely, folded into the Food tool's own D-hotkey delete — stranding
  // the following "place" step with no build tool armed); isMergeToolAvailable
  // also refuses Merge outright for the whole duration of any flow, so this
  // is belt-and-suspenders, not the only fix.
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
  postalien: [
    { id: 'shop', text: 'Time to arm up — open the Shop!', tool: 'food', getCircle: () => tutorialCircleForDom(els.shopCollapseBtn) },
    { id: 'turret', text: 'Grab the Waste Turret!', tool: 'food', getCircle: () => tutorialCircleForDom(familyButtons.turret?.btn) },
    { id: 'scroll', text: 'Scroll all the way down to the bottom of the tank!', tool: `build:${TILE_TURRET_WASTE}`, noSpotlight: true },
    {
      id: 'place',
      text: 'Place the Waste Turret down here! (Here’s 25 gold to cover it.)',
      tool: `build:${TILE_TURRET_WASTE}`,
      getCircle: (state) => {
        const spot = getPostAlienTurretSpot(state);
        const screen = worldToScreen(spot.x, spot.y, state.camera);
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
  // Fires the first time two Adult, same-species-and-star-tier fish exist on
  // screen at once (Systems.js's updateMergeTutorialTrigger) — per direct
  // request. 'switch' spotlights the Merge tool button itself; clicking it
  // (see the button's own click handler) advances to 'drag', which
  // spotlights the two locked-in target fish and completes the instant a
  // real combine happens anywhere (main.js's mouseup handler).
  mergefish: [
    { id: 'switch', text: 'Two matching fish! Switch to the Merge tool.', tool: 'food', getCircle: () => tutorialCircleForDom(els.toolMergeBtn) },
    { id: 'drag', text: 'Drag one fish onto the other to merge them!', tool: 'merge', getCircle: mergeFishStepCircle },
  ],
  // Fires once, directly from Mound.js's crackMound, the instant the $75
  // Mound "tease" grants the Tier 1 Storage Chest — per direct request
  // ("have a chest tutorial start that's like the turret tutorial"). Same
  // shop -> select -> place -> drag shape as 'postalien' above, minus its
  // 'scroll' step — the camera's already centered on the Mound right where
  // this fires, so there's nothing to scroll to first. 'trickle' is the one
  // step advanced directly from main.js (its own chest-aim drag gesture
  // calls advanceTutorialFlow itself, same as every OTHER non-drag click in
  // this game already does) rather than through a cross-module flag.
  chest: [
    { id: 'shop', text: 'Time to store some supplies — open the Shop!', tool: 'food', getCircle: () => tutorialCircleForDom(els.shopCollapseBtn) },
    { id: 'select', text: 'Grab the Storage Chest!', tool: 'food', getCircle: () => tutorialCircleForDom(familyButtons.chest?.btn) },
    {
      id: 'place',
      text: 'Place the Storage Chest down here! (Here’s 20 gold to cover it.)',
      tool: `build:${TILE_STORAGE_CHEST}`,
      getCircle: (state) => {
        const screen = worldToScreen(POST_MOUND_CHEST_SPOT.x, POST_MOUND_CHEST_SPOT.y, state.camera);
        return { cx: screen.x, cy: screen.y, r: 70 };
      },
    },
    { id: 'feedwaste', text: 'Drag the Waste into the Chest!', tool: 'food', getCircle: chestDragStepCircle },
    {
      id: 'trickle',
      text: 'Drag away from the Chest to aim, then let go to start trickling it back out!',
      tool: 'food',
      // A much wider click-through "hole" than every other spotlight circle
      // here (which are all a fixed 70 fixed-CSS-px) — per direct request
      // ("make the clickable area 8 full tiles around the placed chest"),
      // matching main.js's own getChestKeyNear search radius exactly
      // (CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES) so a press anywhere this
      // overlay actually lets through also actually finds the chest. Scaled
      // by the live camera zoom, same as every other screen-space circle
      // here derived from a world point — without it, zooming out would
      // shrink the real clickable area below what the overlay still shows
      // as open.
      getCircle: (state) => {
        const screen = worldToScreen(POST_MOUND_CHEST_SPOT.x, POST_MOUND_CHEST_SPOT.y, state.camera);
        return { cx: screen.x, cy: screen.y, r: CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES * TILE_SIZE * state.camera.zoom };
      },
    },
  ],
};

// Fires once a flow finishes its last step — id-specific rewards/messages,
// per direct request.
function onTutorialFlowComplete(state, id) {
  if (id === 'start') {
    // The 'start' flow itself ends silently (nothing was asked for beyond
    // the fish itself getting placed) — but per a later direct request, it's
    // also what starts the 30-second countdown to the Tank Upgrades icon's
    // own bounce reminder (see scheduleTankButtonReminder above).
    setTimeout(() => scheduleTankButtonReminder(state), TANK_BUTTON_REMINDER_START_DELAY_MS);
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
    pushUiNotification(state, POST_ALIEN_TUTORIAL_MESSAGE);
  } else if (id === 'chest') {
    pushUiNotification(state, CHEST_TUTORIAL_MESSAGE);
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
  // The merge-drag step is done — clear its own locked target pair the same
  // way, so a later fresh trigger of this flow (shouldn't normally happen
  // since it's one-shot, but matches the same defensive pattern) doesn't
  // reuse a stale pair.
  if (id === 'mergefish' && step === 'drag') {
    state.level.mergeTutorialTargetIds = null;
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

// Whether the CURRENTLY ACTIVE guided-tutorial step's spotlight target is
// off-screen vertically right now, and which way the camera needs to pan
// to bring it into view — 'up', 'down', or null (already visible, or this
// step has no world-space target at all: a DOM-anchored button spotlight
// like the Shop/Merge buttons, which are always on screen regardless of
// camera position, or a noSpotlight step like the postalien flow's own
// 'scroll' step, which already handles its own scrolling explicitly).
//
// Per direct report ("the alien tutorial doesn't work if I'm scrolled to
// the bottom of the tank... make sure every tutorial step is scrolled to
// the right place, and add in a scroll step to each tutorial if the player
// is not scrolled to the correct place") — this is the shared, GENERIC
// version of that fix, derived straight from whatever each step's own
// getCircle already computes rather than needing every flow to separately
// author its own scroll-detection: if the circle's vertical center (plus
// its own radius, so a target only partially poking on-screen still counts
// as visible) falls outside the real viewport, scrolling is needed.
// main.js's update() calls this too, to decide whether to keep allowing
// camera panning during a step that would otherwise freeze it entirely
// (see the alienintro flow's own fix, the actual reported bug — every
// other flow already lets the camera pan during any step by default, so
// only that one flow needed a simulation-level change; every flow still
// benefits from the visual scroll-prompt below).
export function tutorialScrollDirectionNeeded(state) {
  const flow = state.level.tutorialFlow;
  if (!flow) return null;
  const stepDef = TUTORIAL_FLOWS[flow.id]?.find((s) => s.id === flow.step);
  if (!stepDef || stepDef.noSpotlight || !stepDef.getCircle) return null;
  const circle = stepDef.getCircle(state);
  if (!circle) return null;
  // Checked against the circle's CENTER, not just whether any edge of it
  // merely touches the viewport — a real bug caught during verification:
  // requiring only `cy + r >= 0` let the target count as "found" the
  // instant a sub-pixel sliver of it poked on screen, at which point this
  // function (and the alienintro freeze-exemption reading it) immediately
  // stops permitting further scrolling — leaving a target whose actual
  // center, and therefore virtually all of its real clickable area, was
  // still off-screen, genuinely unreachable by a real mouse position. Using
  // the center means "no longer needs scrolling" only fires once there's a
  // comfortably-sized, actually-clickable area on screen around it.
  if (circle.cy < 0) return 'up';
  if (circle.cy > window.innerHeight) return 'down';
  return null;
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
  // The target isn't on screen right now — show a plain "scroll to find
  // it" prompt instead of the step's real text/spotlight (which would
  // otherwise render its clickable hole somewhere the player can't see or
  // reach), and hide the darkening overlay entirely so scrolling itself
  // isn't visually impeded. updateScrollHint (below) arms the actual
  // bouncing-arrows nudge for the same condition; this just swaps the text
  // pill. Reverts to the step's own real text/circle automatically the
  // instant the target scrolls back into view (recomputed fresh every
  // frame, nothing latched).
  const scrollDirection = tutorialScrollDirectionNeeded(state);
  if (scrollDirection) {
    els.tutorialText.textContent = scrollDirection === 'up' ? 'Scroll up to find it!' : 'Scroll down to find it!';
    els.tutorialText.classList.remove('hidden');
    els.tutorialOverlay.classList.add('hidden');
    return;
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
    // alienWavesSpawned counts waves that have ALREADY started — the one
    // this countdown is ticking down to is always one more than that, per
    // direct request ("make sure the incoming wave countdown mentions the
    // wave number").
    els.alienCountdownWave.textContent = String(state.level.alienWavesSpawned + 1);
    els.alienCountdownSeconds.textContent = String(Math.ceil(msRemaining / 1000));
  } else {
    els.alienCountdown.classList.add('hidden');
  }
}

// Mother Alien Fish — "a universal boss health bar at the top middle of the
// screen instead of over the boss's head," per direct spec. Finds the boss
// by its recorded state.level.bossEntityId rather than scanning entities for
// isBoss every frame (there's only ever one, and its id is already known
// the instant it's created — see main.js's updateBossSequence).
export function updateBossHealthBar(state) {
  const boss = state.level.bossEntityId === null
    ? null
    : state.level.entities.find((e) => e.id === state.level.bossEntityId && e.type === 'alien' && e.hp > 0);
  if (!boss) { els.bossHealthBarWrap.classList.add('hidden'); return; }
  els.bossHealthBarWrap.classList.remove('hidden');
  const frac = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
  els.bossHealthBarFill.style.width = `${frac * 100}%`;
}

// The end-game stats modal, per direct spec ("slowly fade in a game over
// modal, with stats about the game like how much total of each resource was
// accumulated, how much food was purchased, how many fish died, how many
// tank points accumulated, aliens killed, etc."). Called once by main.js's
// updateBossSequence the instant bossPhase reaches 'gameover'. The "slowly
// fade in" part is a plain CSS opacity transition (see style.css's
// #boss-victory-overlay) — removing 'hidden' (display:none has no
// transition) then adding 'visible' one frame later via the same
// forced-reflow retrigger trick every other one-shot animation in this file
// already uses, so the browser genuinely animates from opacity 0.
export function showGameOverModal(state) {
  // Per direct request ("add the percentage of achievements completed on
  // the end game screen") — "completed" reads as achievements genuinely
  // EARNED (their condition met), not just claimed for gems, since an
  // uncashed achievement is still a real accomplishment the player reached.
  const achievementPct = Math.round((state.meta.achievementsUnlocked.length / ACHIEVEMENT_LIST.length) * 100);
  const rows = [
    ['💰 Total money earned', `$${Math.floor(state.level.lifetimeMoneyEarned)}`],
    ['🔬 Total Blue Science earned', String(state.level.lifetimeScienceEarned)],
    ['🟢 Total Green Science earned', String(state.level.lifetimeScienceGreenEarned)],
    ['🍖 Food purchased', String(state.level.foodPurchasedCount)],
    ['💀 Fish died', String(state.level.fishDiedCount)],
    ['🏆 Tank Points accumulated', String(state.level.tankPoints.total)],
    ['👽 Aliens killed', String(state.level.aliensKilledCount)],
    ['🎖️ Achievements completed', `${achievementPct}% (${state.meta.achievementsUnlocked.length}/${ACHIEVEMENT_LIST.length})`],
  ];
  els.bossVictoryStats.innerHTML = rows.map(([label, value]) => (
    `<div class="boss-victory-stat-row"><span>${label}</span><b>${value}</b></div>`
  )).join('');
  els.bossVictoryOverlay.classList.remove('hidden');
  els.bossVictoryOverlay.classList.remove('visible');
  void els.bossVictoryOverlay.offsetWidth; // forced reflow — same retrigger trick playFlash/the Lab modal's own open animation already use
  els.bossVictoryOverlay.classList.add('visible');
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
  // doesn't trigger it on load; every real arrival after that does. Per a
  // later direct request ("bounce just the first time... once is enough
  // notification"), this single bounce is now the whole of it — the earlier
  // periodic "keep bouncing every 3-6s until the log is opened" reminder
  // loop (scheduleNotificationReminder/notificationUnread) is removed
  // entirely rather than just suppressed, since nothing else ever needs it.
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
    const entry = notifications[i];
    const line = document.createElement('div');
    line.className = 'notification-line';
    // A real timestamp log, per direct request ("keep a timestamp log for
    // when each chat message comes in") — entry.timestamp is a real
    // Date.now() wall-clock stamp, set once at push time by Notifications.js's
    // pushGameNotification, shown as a small local-time prefix on every line.
    const timeSpan = document.createElement('span');
    timeSpan.className = 'notification-line-time';
    timeSpan.textContent = entry.timestamp
      ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    line.appendChild(timeSpan);
    line.appendChild(document.createTextNode(entry.text));
    els.notificationLog.appendChild(line);
  }
}
