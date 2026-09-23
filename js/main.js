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
  HUNGER_ICON_BOUNCE_SLOW_PERIOD_MS,
  HUNGER_ICON_BOUNCE_SLOW_AMPLITUDE_PX,
  HUNGER_ICON_BOUNCE_FAST_PERIOD_MS,
  HUNGER_ICON_BOUNCE_FAST_AMPLITUDE_PX,
  TIME_SCALE_STEPS,
  DEFAULT_TIME_SCALE_INDEX,
  CHEAT_GRANT_AMOUNT,
  CHEAT_TANK_POINTS_GRANT_AMOUNT,
  CHEAT_SCIENCE_GRANT_AMOUNT,
  CHEAT_SCIENCE_GREEN_GRANT_AMOUNT,
  CHEAT_FISHY_GEMS_GRANT_AMOUNT,
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
  SCIENCE_LAB_UPGRADES,
  SCIENCE_ITEM_RADIUS,
  SCIENCE_ITEM_COLOR_A,
  SCIENCE_ITEM_COLOR_B,
  SCIENCE_GREEN_COLOR_A,
  SCIENCE_GREEN_COLOR_B,
  ALIEN_DNA_COLOR,
  BIOMASS_COLOR,
  BIOMASS_COLOR_CORE,
  MUTAGEN_PASTE_COLOR,
  BUFFER_FISH_MAGNET_RADIUS,
  CATALYST_FLASH_DURATION_MS,
  FOOD_STALE_FRACTION,
  FOOD_STALE_COLOR,
  FOOD_STATIONARY_TO_WASTE_MS,
  DIAMOND_GEM_COLOR_CORE,
  DIAMOND_GEM_COLOR_EDGE,
  POWER_HISTORY_MAX,
  ACHIEVEMENT_POWER_SURPLUS_RATIO,
  SCIENCE_CAP_BY_LEVEL,
  MOUND_MAX_TIER,
  ALIEN_CLICK_DAMAGE,
  ALIEN_RADIUS,
  ALIEN_COLOR,
  ALIEN_HEALTH_BAR_WIDTH,
  ALIEN_HEALTH_BAR_HEIGHT,
  FISH_HEALTH_BAR_WIDTH,
  FISH_HEALTH_BAR_HEIGHT,
  FISH_DEATH_RISE_DURATION_MS,
  FISH_DEATH_FADE_DURATION_MS,
  ALIEN_COUNTDOWN_START_MS,
  ALIEN_MUSIC_BATTLE_LEAD_MS,
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
  PRODUCTION_BLOCKED_EFFECT_DURATION_MS,
  FISH_BUBBLE_LIFETIME_MS,
  WORLD_H,
  WORLD_W,
  CAMERA_BOTTOM_BUFFER_PX,
  WASTE_RADIUS,
  WASTE_DRAG_GHOST_CYCLE_MS,
  ITEM_DRAG_CLICK_RADIUS_MULTIPLIER,
  ITEM_DRAG_MOVE_THRESHOLD_PX,
  BUILDING_FAMILIES,
  ALIEN_EGG_COLOR,
  ALIEN_EGG_RING_COLOR,
  ALIEN_EGG_HATCH_MS,
  BOSS_INTRO_MESSAGE_AT_MS,
  BOSS_INTRO_MESSAGE,
  BOSS_WHITE_FADE_IN_MS,
  BOSS_WHITE_FADE_IN_START_MS,
  BOSS_SPAWN_MS,
  BOSS_WHITE_FADE_OUT_MS,
  BOSS_DEFEATED_MODAL_DELAY_MS,
  TURRET_TUTORIAL_GOLD_GRANT,
  TURRET_TUTORIAL_GOLD_GRANT_MESSAGE,
  TILE_MANUFACTURER,
  TILE_POWER_PLANT,
  TILE_STORAGE_CHEST,
  STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES,
  STORAGE_CHEST_MAX_TRICKLE_DISTANCE_TILES,
  CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES,
} from './Config.js';
import { worldToScreen, screenToWorld, createInput, updateCamera, createGameLoop } from './Engine.js';
import { pushGameNotification } from './Notifications.js';
import { loadLevel, LEVELS } from './Levels.js';
import { updateStoryTriggers } from './Systems.js';
import { updateAmbience, renderAmbience } from './Ambience.js';
import { resumeAudio, startGameMusic, playAlienHit, setBattleMusicActive, triggerBossMusic, playBuildPlace, playDemolish } from './Sound.js';
import {
  updateEntities,
  trySpawnFood,
  trySpawnPurchasedFish,
  tryBankCoinAt,
  spawnFishCheat,
  getCoinColor,
  getCoinTier,
  createPickupText,
  getFishPurchaseCost,
  findFishAt,
  findFishForPipetteAt,
  computeEelBlimpBatteryCapacityMw,
  isCombinableFish,
  canCombineFish,
  combineFish,
  isSpliceSource,
  isSpliceTargetCandidate,
  canSpliceFish,
  spliceFish,
  describeFishMergeOptions,
  canSpliceOctopusWithAlien,
  spliceOctopusWithAlien,
  createMotherAlienFish,
  spawnTurretTutorialWaste,
  spawnChestTutorialWaste,
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
  computePowerEfficiency,
  findNearestWasteTurretAndWaste,
  getRecipeBuildingKeyAt,
  getBuildingInfoKeyAt,
  getPlatformFilterKeyAt,
  getItemDisintegrateFraction,
  renderDisintegrateEffect,
  pickUpBuildingForMove,
  putDownMovedBuilding,
  renderMoveGhost,
  captureBlueprint,
  renderBlueprintGhost,
  placeBlueprint,
  computeBlueprintCost,
  cyclePlatformAt,
  getChestKeyAt,
  getChestKeyNear,
  armChestTrickle,
  clearChestContents,
  isBuildingStalledOrPowerless,
  describeReplacement,
  placeTileWithReplace,
  computeBlueprintCostWithReplace,
  placeBlueprintWithReplace,
} from './Grid.js';
import { isPointOnMound, crackMound, renderMound, centerCameraOnMound, isPointOnScienceLab, renderScienceLab } from './Mound.js';
import { drawFish } from './FishRenderer.js';
import { oneShotShimmerProgress, drawShimmerSweep, shimmerFadeAlpha, createShimmerTimer, updateShimmerTimer } from './Shimmer.js';
import {
  initUI,
  updateHUD,
  updateDebugOverlay,
  updateNotificationTicker,
  refreshShopPanel,
  toggleShopCollapse,
  toggleTankPanel,
  openMoundMenu,
  openLabMenu,
  openRecipeMenu,
  openBuildingInfoMenu,
  openPlatformFilterMenu,
  openMagnetFishFilterMenu,
  openFishInfoMenu,
  closeFishInfoMenu,
  copyPlatformFilter,
  openStorageChestModal,
  toggleFavoriteForSelectedTool,
  removeFavoriteAtHoveredSlot,
  selectFavorite,
  pipetteSelectSpecies,
  pipetteSelectBuilding,
  deselectShopSelection,
  copyBuildingRecipe,
  flashMoneyInsufficient,
  selectTool,
  initStartScreen,
  scheduleShopButtonReminder,
  cancelActiveTool,
  isCursorOrFoodTool,
  togglePauseMenu,
  toggleTimePause,
  toggleSpeedX2,
  toggleAltMode,
  toggleStatsPanel,
  advanceTutorialFlow,
  closeSidePanels,
  tutorialScrollDirectionNeeded,
  updateBossHealthBar,
  showGameOverModal,
  cycleSelectedBuildingFamily,
} from './UI.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ---- Minimap ----
// Per direct report ("the expand/minimize button doesn't work. It's
// supposed to be for the whole tank viewport, not the minimap") — the
// minimap itself is a single fixed size now: the whole tank (water column +
// seabed city + the scrollable bottom buffer) letterboxed to fit within this
// one bounding box. The expand/minimize button moved to controlling the
// real camera zoom instead — see toggleTankZoomMode below.
const MINIMAP_BOX_W = 170;
const MINIMAP_BOX_H = 110;
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

function minimapScaleAndSize() {
  const totalWorldH = WORLD_H + CAMERA_BOTTOM_BUFFER_PX;
  const scale = Math.min(MINIMAP_BOX_W / WORLD_W, MINIMAP_BOX_H / totalWorldH);
  return { w: WORLD_W * scale, h: totalWorldH * scale, scale };
}

// Click-to-jump — centers the camera vertically on wherever was clicked,
// same clamp updateCamera itself applies every tick (so a click near either
// end can't scroll past the real bounds even for the one frame before
// updateCamera re-clamps it anyway).
minimapCanvas.addEventListener('click', (e) => {
  const rect = minimapCanvas.getBoundingClientRect();
  const clickY = (e.clientY - rect.top) * (minimapCanvas.height / rect.height);
  const { scale } = minimapScaleAndSize();
  const viewH = canvas.height / state.camera.zoom;
  const maxY = Math.max(0, WORLD_H + CAMERA_BOTTOM_BUFFER_PX - viewH);
  state.camera.y = Math.max(0, Math.min(clickY / scale - viewH / 2, maxY));
});

// ---- Tank-viewport zoom (the minimap's own expand/minimize button) ----
// Per direct request: "zoom to fit" computes a zoom that fits the ENTIRE
// tank (world width AND total height, whichever is the tighter constraint)
// within the viewport at once, so nothing needs scrolling; toggling back to
// "fit to width" instead zooms so the tank's full WIDTH exactly fills the
// viewport, ignoring height (the normal "scroll to see more" zoom). Neither
// replaces the page-load/resize default (fitCameraZoom, which fits the
// water column height) unless the player has actually clicked this button at
// least once — tankZoomMode stays null until then, and fitCameraZoom below
// keeps using its original formula in that case.
let tankZoomMode = null; // null | 'whole' | 'width'
// Per direct report ("the zoom to fit isn't completely zoom to fit, I can
// still scroll... zoom out enough that you can't scroll up or down at
// all") — the real scrollable range Engine.js's updateCamera clamps
// against is WORLD_H + CAMERA_BOTTOM_BUFFER_PX (the extra buffer strip
// reserved for the fixed bottom tool-bar — see that constant's own
// comment), NOT just WORLD_H on its own. Fitting zoom to WORLD_H alone left
// viewH just short of the buffer's own height, so maxY (WORLD_H + buffer -
// viewH) stayed slightly positive — a small but real amount of scroll was
// still possible. Using the full scrollable height here instead makes
// viewH >= that whole range, which drives maxY to (clamped) exactly 0.
function computeFitWholeTankZoom() {
  return Math.min(canvas.width / WORLD_W, canvas.height / (WORLD_H + CAMERA_BOTTOM_BUFFER_PX));
}
function computeFitWidthZoom() {
  return canvas.width / WORLD_W;
}
const minimapExpandBtnEl = document.getElementById('minimap-expand-btn');
function toggleTankZoomMode() {
  tankZoomMode = tankZoomMode === 'whole' ? 'width' : 'whole';
  fitCameraZoom();
  if (tankZoomMode === 'whole') state.camera.y = 0; // guarantee the top of the tank is actually in view, not just theoretically fittable
  minimapExpandBtnEl.textContent = tankZoomMode === 'whole' ? '⤡' : '⤢';
  minimapExpandBtnEl.title = tankZoomMode === 'whole' ? 'Fit tank to width' : 'Zoom to fit the whole tank';
}
minimapExpandBtnEl.addEventListener('click', toggleTankZoomMode);

// Per direct request ("a minimal minimap under the HUD") — a plain two-tone
// water/city silhouette, the live camera viewport as an outlined rect, and a
// dot per living alien (the one thing worth calling out at a glance — "where
// is the wave right now" during a scrolled-away fight). Nothing else: no
// buildings/fish/items, keeping it genuinely minimal rather than a second
// full render pass. Called once a frame from render(), below.
//
// Later extended, per direct request, with a small red PULSING dot for
// anything that actually needs attention right now: a fish at (or past) its
// second/critical hunger stage (HUNGER_CRITICAL_THRESHOLD — the same
// threshold that shows the on-screen "!!" indicator, see updateFish), and a
// building that's stalled or without power (Grid.js's
// isBuildingStalledOrPowerless — the exact same conditions already driving
// the on-tile stalled badges/power-shortage overlay, reused here so the
// minimap can never disagree with what those already show). Deliberately
// NOT every fish/building — that would defeat the whole "minimal, glance at
// what needs attention" point the alien dots already established.
const MINIMAP_ALERT_DOT_COLOR = '#ff3b30';
function renderMinimapAlertDot(mctx, cx, cy, elapsedMs) {
  const pulse = 0.55 + 0.45 * Math.sin(elapsedMs / 220);
  const r = 2 + pulse * 1.2;
  mctx.save();
  mctx.globalAlpha = pulse;
  mctx.fillStyle = MINIMAP_ALERT_DOT_COLOR;
  mctx.beginPath();
  mctx.arc(cx, cy, r, 0, Math.PI * 2);
  mctx.fill();
  mctx.restore();
}
function renderMinimap(state) {
  const { w, h, scale } = minimapScaleAndSize();
  const wPx = Math.max(1, Math.round(w));
  const hPx = Math.max(1, Math.round(h));
  if (minimapCanvas.width !== wPx || minimapCanvas.height !== hPx) {
    minimapCanvas.width = wPx;
    minimapCanvas.height = hPx;
  }
  const mctx = minimapCtx;
  mctx.clearRect(0, 0, wPx, hPx);
  const seabedYPx = SEABED_FLOOR_Y * scale;
  mctx.fillStyle = '#2a6690';
  mctx.fillRect(0, 0, wPx, seabedYPx);
  mctx.fillStyle = '#5c4a3a';
  mctx.fillRect(0, seabedYPx, wPx, hPx - seabedYPx);
  mctx.fillStyle = '#ff3b30';
  for (const entity of state.level.entities) {
    if (entity.type !== 'alien' || entity.hp <= 0) continue;
    mctx.beginPath();
    mctx.arc(entity.x * scale, entity.y * scale, 2, 0, Math.PI * 2);
    mctx.fill();
  }
  for (const entity of state.level.entities) {
    if (entity.type !== 'fish' || entity.dying) continue;
    if (entity.hunger < HUNGER_CRITICAL_THRESHOLD) continue;
    renderMinimapAlertDot(mctx, entity.x * scale, entity.y * scale, state.level.elapsed);
  }
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const [row, col] = key.split(',').map(Number);
    const type = state.level.grid[row]?.[col];
    if (type == null || !isBuildingStalledOrPowerless(state, type, data)) continue;
    const cx = (col * TILE_SIZE + TILE_SIZE / 2) * scale;
    const cy = (row * TILE_SIZE + TILE_SIZE / 2) * scale;
    renderMinimapAlertDot(mctx, cx, cy, state.level.elapsed);
  }
  const viewX = Math.max(0, state.camera.x * scale);
  const viewY = Math.max(0, state.camera.y * scale);
  const viewW = Math.min(wPx - viewX, (canvas.width / state.camera.zoom) * scale);
  const viewH = Math.min(hPx - viewY, (canvas.height / state.camera.zoom) * scale);
  mctx.strokeStyle = '#ffe066';
  mctx.lineWidth = 1.5;
  mctx.strokeRect(viewX + 0.75, viewY + 0.75, Math.max(1, viewW), Math.max(1, viewH));
}

// Every flat-fill item type's own color — coin is the one exception (its
// color is value-tier-derived via getCoinColor, checked separately), and
// science/science_green/biomass each get their own two-tone gradient
// treatment above this lookup entirely. Bio-chain items still using the
// plain flat-fill path (alien_dna, mutagen_paste) slot into this exact same
// render Food/Waste already use.
const ITEM_FLAT_COLOR_BY_TYPE = {
  food: FOOD_COLOR,
  waste: WASTE_COLOR,
  alien_dna: ALIEN_DNA_COLOR,
  mutagen_paste: MUTAGEN_PASTE_COLOR,
  // alien_egg deliberately NOT listed here — it gets its own dedicated
  // render branch below (a countdown-to-hatch ring on top of the shell
  // fill), not the generic flat-fill-plus-highlight path.
};

// Resolves a single representative color for the disintegrate effect
// (renderDisintegrateEffect), covering every item type that can actually be
// held by a Collector/Refinery/Manufacturer (coin/science/science_green/
// waste/food/alien_dna/biomass) plus a defensive fallback for anything else
// — a stipple effect only needs one flat color per item, not the full
// two-tone gradient its normal render otherwise gets.
function disintegrateItemColor(item) {
  if (item.type === 'coin') return getCoinColor(item.value);
  if (item.type === 'science') return SCIENCE_ITEM_COLOR_B;
  if (item.type === 'science_green') return SCIENCE_GREEN_COLOR_B;
  if (item.type === 'biomass') return BIOMASS_COLOR_CORE;
  if (item.type === 'alien_egg') return ALIEN_EGG_COLOR;
  return ITEM_FLAT_COLOR_BY_TYPE[item.type] || '#ffffff';
}

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
const START_TUTORIAL_DELAY_AFTER_SPLASH_MS = 1000; // per direct request (cut from 2000, itself cut from 3000) — the game-start guided tutorial no longer starts the instant Start is clicked; it waits this long after the splash screen has actually finished fading away
splashTitle.addEventListener('animationend', (e) => {
  if (e.target !== splashTitle) return; // ignore bubbled per-letter animationend events, only the title's own grow-fade ending means it's done
  splashScreen.remove();
  setTimeout(() => {
    if (!state.level.tutorialFlags.startTutorialShown) {
      state.level.tutorialFlags.startTutorialShown = true;
      // Per direct request ("if the shop is already open, skip that step of
      // the tutorial") — the 'shop' step's whole job is spotlighting the
      // Shop toggle button and waiting for a click that opens it (see
      // UI.js's advanceTutorialFlow('start', 'shop') call, fired from the
      // shop-toggle click handler below); if it's already open by the time
      // this fires, that click already happened (or never needed to), so
      // start straight on 'guppy' instead.
      state.level.tutorialFlow = { id: 'start', step: state.ui.shopCollapsed ? 'shop' : 'guppy' };
    }
  }, START_TUTORIAL_DELAY_AFTER_SPLASH_MS);
});
// Idempotent/replayable — per direct request, the splash also plays again
// every time the pause menu's Restart button is used (see UI.js's
// restartLevel, which calls this after loadLevel), not just once on the
// very first Start click. The FIRST time this runs, splashScreen is still
// attached (nothing has removed it yet) and has no 'play' class yet, so the
// remove-reflow-readd below is a harmless no-op beyond adding the class.
// Every time after the first, though, the element has already been
// .remove()'d from the document entirely (see splashTitle's own
// animationend listener above) — re-appending it is what makes a replay
// actually visible at all, and the same forced-reflow trick this codebase
// already uses to restart a CSS animation (see UI.js's playFlash) is what
// makes it replay from the very beginning rather than being a no-op since
// the 'play' class never actually left in between.
function triggerSplash() {
  if (!splashScreen.isConnected) document.body.appendChild(splashScreen);
  splashScreen.classList.remove('play');
  void splashScreen.offsetWidth;
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
    // ---- Achievements / Fishy Gems / hats — all permanent, per direct
    // spec ("achievements used for unlockable hats"). fishyGems is the
    // ONLY currency the Achievements/Customization panels and the end-game
    // screen ever show — never the main HUD. achievementsUnlocked is set
    // the instant an achievement's condition is first met (Systems.js's
    // updateAchievements); achievementsClaimed is the subset the player has
    // actually clicked "Claim" on (only then are the gems actually granted)
    // — see Config.js's ACHIEVEMENTS for the full list/condition table.
    fishyGems: 0,
    achievementsUnlocked: [],
    achievementsClaimed: [],
    hatsUnlocked: ['none'], // 'none' (no hat) is always owned/free — see Config.js's HATS
    equippedHatId: 'none', // applies globally to every fish in the tank — see FishRenderer.js's drawFish
    // 3 pinned "favorite" bottom-tool-bar slots (hotkeys 4-6) — per direct
    // request. Each entry is a 'build:<id>'/'fish:<id>' tool string, or null
    // for an empty slot; persisted like every other meta field. Set/cleared
    // via UI.js's toggleFavoriteForSelectedTool (the F hotkey, in the shop)
    // and removeFavoriteAtHoveredSlot (F while hovering a slot directly).
    favorites: [null, null, null],
    // Lifetime counters/peaks/streaks every achievement's own statField
    // reads (Config.js's ACHIEVEMENTS) — persists across a restart same as
    // everything else in state.meta, since these represent real permanent
    // progress, not per-playthrough state. Most are plain incrementing
    // counters bumped at their own natural event site (see each field's
    // comment for exactly where); the handful backing a "specific setup"
    // achievement (the two streak-best-ms fields, cleanlinessRecoveryDone)
    // are written by Systems.js's updateAchievements, which itself reads a
    // transient in-progress version of the same streak from state.level
    // (reset on restart, same as every other per-level counter) and only
    // ever WRITES here once a new best is actually reached.
    stats: {
      moneyEarned: 0, // mirrors state.level.lifetimeMoneyEarned — see Entities.js's bankMoney
      alienKills: 0, // mirrors state.level.aliensKilledCount (non-boss kills only) — see Entities.js's updateAlien
      turretKills: 0, // subset of alienKills specifically finished off by a turret projectile, not a click — see Entities.js's updateAlien/updateTurretProjectiles
      tankPointsEarned: 0, // see Entities.js's awardTankPoint
      buildingsPlaced: 0, // see Grid.js's placeTile
      hybridsCreated: 0, // see Entities.js's spliceFish/spliceOctopusWithAlien
      wavesSurvived: 0, // see Systems.js's updateAlienWaves, the same moment alienWaveActive first flips back to false for a given wave
      scienceBanked: 0, // Blue OR Green Science, click-banked or Collector-routed alike — see Entities.js's bankScience/bankScienceGreen
      fishSaved: 0, // a fish that was already at HUNGER_CRITICAL_THRESHOLD and then successfully ate — see Entities.js's updateFish
      fourStarFishAchieved: 0, // 0 or 1 — a plain one-shot flag, set the instant any fish is combined all the way up to 4-star — see Entities.js's combineFish
      powerDeficitStreakBestMs: 0,
      powerSurplusStreakBestMs: 0,
      cleanlinessRecoveryDone: 0, // 0 or 1 — a plain one-shot flag, not a counter
      sciencePeakOnScreen: 0, // highest-ever simultaneous count of Science + Green Science items in state.level.items
    },
  },
  level: null, // built by loadLevel below — never construct this inline (see Levels.js)
  // zoom/viewWidth/viewHeight are fit to the water column by fitCameraZoom()
  // below, once the canvas has a real size. viewWidth/viewHeight are the
  // current viewport's size in world units (canvas size / zoom) — UI.js
  // uses them to spawn purchased fish somewhere actually on screen.
  camera: { x: 0, y: 0, zoom: 1, viewWidth: 0, viewHeight: 0 },
  ui: {
    // Which click-tool a canvas click performs. 'cursor' is the true default
    // — a plain shell-emoji cursor that can't drop Food (see CURSOR_BY_TOOL)
    // but can do everything else a placed-tool-free cursor always could
    // (move/delete buildings, drag items/recipes, shoot aliens, open
    // building modals, ...) — per direct request ("default back to just a
    // cursor... this default cursor CANNOT drop food"). 'food' is now a
    // separate, deliberately-armed tool (hotkey 1 / the shop's Food icon)
    // that does everything 'cursor' does PLUS drops Food on click. See
    // UI.js's isCursorOrFoodTool for the shared "either of these two neutral
    // tools" check used everywhere that distinction matters.
    selectedTool: 'cursor',
    lastArmedTool: null, // the last 'build:<id>'/'fish:<id>' tool armed (UI.js's selectSpeciesForPreview/selectBuildingForPreview) — the Q hotkey's "reselect last building/fish" fallback, see main.js's KeyQ handler
    blueprintCost: null, // live total $ cost of the currently-armed Blueprint stamp, written fresh every render() frame, null while no stamp is armed — read by UI.js's updateHUD for the bottom-left cost bubble
    blueprintClipboardActive: false, // whether a Blueprint stamp is currently captured/armed, written fresh every render() frame — read by UI.js's updateHUD to switch the persistent Q legend to "Clear Blueprint"
    undoAvailable: false, // whether main.js's Ctrl+Z undo stack currently has anything to undo — written by pushUndoEntry/performUndo, read by UI.js's bottom-left hotkey legend
    undoLabel: null, // 'Undo Place' | 'Undo Move' | 'Undo Sell' | null — what Ctrl+Z would currently do, shown in that same legend line
    shopCollapsed: true, // shop starts tucked away — just the toggle button — so it doesn't clutter the view
    tankPanelCollapsed: true, // Tank Upgrades panel starts tucked away too — shares the shop's on-screen slot, only one is ever expanded (see UI.js's toggleShopCollapse/toggleTankPanel)
    tankPanelView: 'upgrades', // 'upgrades' | 'achievements' | 'customization' — which of the 3 views the Tank panel currently shows, see UI.js's setTankPanelView. Persists across a collapse/expand (only Escape/tool-select closes the panel, never resets which tab was showing)
    // Which hat the Customization preview canvas is currently showing —
    // separate from state.meta.equippedHatId (the real, in-tank choice)
    // per direct request: clicking anywhere on a hat card except its own
    // Buy/Equip button previews that hat for free, even one not owned yet,
    // without spending gems or changing what's actually equipped. null
    // falls back to whatever's really equipped (UI.js's renderCustomizationPreview/refreshCustomizationPanel).
    customizationPreviewHatId: null,
    // Right-click-to-move (see main.js's movingBuilding) — both written
    // fresh every render() frame, read by UI.js's updateHUD to drive the new
    // bottom-left legend. buildingMoveArmed: true while a move (or a moved
    // Fan's own angle-choosing step) is actually in progress, showing "Left-
    // click to accept"/"Right-click to cancel". buildingMoveHoverLabel:
    // 'adjust' (Fan) | 'move' (anything else) | null, showing "Right-click
    // to Adjust/Move" while just hovering a placed building with nothing in
    // progress yet.
    buildingMoveArmed: false,
    buildingMoveHoverLabel: null,
    // Fish merge/splice hover legend — per direct request ("when you hover
    // over a fish have a bubble legend... that shows what fish can be
    // merged with the fish being hovered on, and what the fish would be
    // created when merged"). Written fresh every render() frame; null while
    // the hovered fish isn't merge/splice-eligible at all (hides the legend
    // entirely), otherwise an array of description lines, one per currently-
    // present compatible partner, or a single "No available fish to merge."
    // line when the hovered fish IS eligible but nothing in the tank right
    // now actually pairs with it. See main.js's describeFishMergeOptions.
    fishMergeHoverLines: null,
    // The fish info modal's own locked-fish tracking — per direct request,
    // written by UI.js's openFishInfoMenu/closeFishInfoMenu (main.js can't
    // import UI.js back without a circular dependency, so this is the same
    // cross-module-flag pattern buildingMoveHoverLabel etc. already use).
    // fishInfoModalFrozenX/Y are captured once, at open time, and re-applied
    // every tick (see main.js's updateFishInfoModalFreeze) so the fish stays
    // visibly still for as long as its modal is open.
    fishInfoModalFishId: null,
    fishInfoModalFrozenX: 0,
    fishInfoModalFrozenY: 0,
    paused: false, // pause menu open/closed (Escape); update() below skips simulating entirely while true
    // Time-manipulation HUD buttons, per direct request. timePaused freezes
    // fish/alien/building simulation while still letting the player build/
    // move/delete/drag — see update()'s own comment for exactly what stays
    // running. speedX2 instead runs the WHOLE sim (including timePaused's
    // own gate, so the two are mutually exclusive in effect — see
    // getTimeScale below) at double real-time rate. Both are UI/session
    // state, not campaign progress, so neither is saved (Save.js only ever
    // persists state.meta/state.level).
    timePaused: false,
    speedX2: false,
    // Per direct request — a toggle hotkey (Alt) that hides every piece of
    // persistent HUD/UI chrome (see style.css's body.alt-mode rules) for a
    // clean, unobstructed view of the tank. Pure display state, not saved.
    altMode: false,
    // False until the player clicks "Start" on the new first-launch start
    // screen (UI.js's initStartScreen) — update() below checks this ahead of
    // (and independently from) `paused`, so the tank sits fully frozen (but
    // still rendered, blurred behind the start overlay) until then. Ambience
    // (bubbles/seaweed) is deliberately NOT gated on this — see update()'s
    // own comment — so the blurred tank still reads as alive behind the menu.
    gameStarted: false,
    // Set by Grid.js's updateBuildings the instant a Waste Turret's ammo
    // actually goes up (Grid.js importing UI.js directly would be circular,
    // since UI.js already imports from Grid.js) — a plain cross-module state
    // flag, read and cleared by UI.js's updateHUD to advance the
    // 'postalien'/'wastedrag' guided-tutorial flows' "drag Waste into the
    // Turret" step.
    wasteTurretAmmoGainedPending: false,
    // Same cross-module-flag pattern as wasteTurretAmmoGainedPending above,
    // set by Grid.js's Storage Chest intake scan — read and cleared by
    // UI.js's updateHUD to advance the 'chest' guided-tutorial flow's own
    // "drag Waste into the Chest" step.
    chestItemAbsorbedPending: false,
    // Same cross-module-flag pattern — UI.js's buyLabUpgrade sets this the
    // instant the Mother Alien Fish node is purchased (UI.js can't own the
    // actual gameplay-state transition itself, per this file's own
    // module-boundary rule); main.js's update() checks and clears it once
    // per frame to kick off state.level.bossPhase = 'intro_wait'.
    bossFightTriggerPending: false,
    // Small red reason text shown just above the cursor after a failed
    // building-placement attempt ("Can't afford") — see
    // showBuildError/handleBuildPlacementFailure and render()'s draw call.
    // null (or elapsed past BUILD_ERROR_TEXT_DURATION_MS) means nothing's
    // shown right now.
    buildErrorText: null,
    buildErrorElapsedMs: 0,
    // A small top-center toast, per direct request ("change the Game saved
    // and Game auto-saved messages so they show up in the top middle of the
    // screen for a short period before disappearing. They don't need to
    // show up in the chat message history at all") — rendered as a real DOM
    // element (#save-toast) instead of on-canvas like buildErrorText above,
    // since a top-center screen position has no canvas coordinate to anchor
    // to. UI.js's updateHUD (called unconditionally from render() every
    // frame, regardless of state.ui.paused — same "frozen but visible"
    // precedent the pause menu itself already follows) is what actually
    // shows/auto-hides it, via a real setTimeout rather than a ticked
    // elapsed counter — the Save button that sets this text lives IN the
    // pause menu, so a timer that only advanced through update()'s own
    // per-tick dtMs (which stops entirely while paused) would never
    // actually count down while the menu that triggered it stays open.
    // Systems.js's updateAutosave writes this field directly (a plain
    // state.ui write, not rendering — same cross-module-flag convention
    // wasteTurretAmmoGainedPending/chestItemAbsorbedPending already use) since
    // Systems.js itself is forbidden from touching the DOM; UI.js's
    // saveGameFromPause (already UI.js's own domain) writes it directly too.
    toastText: null,
    // Same cross-module-flag pattern as
    // wasteTurretAmmoGainedPending above — set by UI.js's restartLevel
    // (the pause menu's Restart button) the instant it calls loadLevel, per
    // direct request ("make the splash screen animation happen again").
    // triggerSplash() itself is a main.js-local function (closes over the
    // splashScreen/splashTitle DOM refs), so UI.js can't call it directly
    // without a circular import — read and cleared by render() below on the
    // very next frame instead.
    replaySplashPending: false,
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
// 1x on a tall window; recomputed on every resize. Once the player has
// clicked the minimap's expand/minimize button at least once (tankZoomMode
// no longer null — see that button's own comment), THAT explicit choice
// takes over here instead, including across a later window resize, until
// the button is clicked again.
function fitCameraZoom() {
  if (tankZoomMode === 'whole') state.camera.zoom = computeFitWholeTankZoom();
  else if (tankZoomMode === 'width') state.camera.zoom = computeFitWidthZoom();
  else state.camera.zoom = Math.min(1, (canvas.height * CAMERA_WATER_COLUMN_FIT_FRACTION) / SEABED_FLOOR_Y);
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

// Shift-click Replace — per direct request, buying/pasting a building on top
// of an already-placed one while Shift is held refunds the old one and
// charges only the difference. Polled off input.keysDown (kept live by
// Engine.js's own keydown/keyup listeners regardless of mouse state) rather
// than a click event's own e.shiftKey, so it works uniformly whether Shift
// was already held before the click or pressed mid-drag, and for
// updateBuildDrag's own per-tick polling (which has no event object at all)
// the same way it does for a real click handler.
function isShiftHeld() {
  return input.keysDown.has('ShiftLeft') || input.keysDown.has('ShiftRight');
}

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

// Catalyst Fish's click-to-arm-then-click-a-building-to-link flow — the id
// of whichever Catalyst Fish was most recently clicked, waiting for its
// linking building click; null the rest of the time. See the click
// handler's own two dedicated branches below.
let catalystArmedFishId = null;

// Which hybrids have a real on/off ability toggle — Magnet Fish (magnet),
// Feeder Fish (auto-Food dispenser), Xeno Octopus (Bio-Sludge mode) — per
// direct request, all 3 now require a genuine DOUBLE-click to flip (see the
// click handler's own comment for why: a single click on any fish opens its
// info modal instead now). Catalyst Fish's click-to-arm-link isn't an
// on/off toggle, so it's deliberately not in this list — unchanged,
// single-click, same as always.
const TOGGLEABLE_FISH_SPECIES = ['buffer_fish', 'zap_sucker', 'xeno_octopus'];
const FISH_DOUBLE_CLICK_MS = 350;
const FISH_TOGGLE_BOUNCE_DURATION_MS = 400;
const FISH_TOGGLE_BOUNCE_AMOUNT = 0.22;
let pendingFishToggleClickId = null;
let pendingFishToggleClickTimeout = null;

// Per direct request ("Add in a shimmer and bounce animation anytime a
// hybrid fish with an ability is toggled on. During the time the fish
// ability is on, have the fish shimmer slightly") — toggling ON restarts
// the same one-shot shimmer sweep a fresh placement/growth/splice already
// gets (fish.shimmerStartedAt, see FishRenderer.js/main.js's own render
// code) for the bounce+shimmer burst, and sets abilityToggleOnSince so
// render() can apply a persistent, subtler shimmer for as long as the
// ability stays on. Toggling OFF just clears the persistent flag — no
// burst animation for turning something off, only for turning it on.
function toggleFishAbility(state, fish) {
  let turningOn;
  if (fish.speciesId === 'buffer_fish') { fish.magnetOn = !fish.magnetOn; turningOn = fish.magnetOn; }
  else if (fish.speciesId === 'zap_sucker') { fish.autoFoodOn = !fish.autoFoodOn; turningOn = fish.autoFoodOn; }
  else if (fish.speciesId === 'xeno_octopus') { fish.alienDnaModeOn = !fish.alienDnaModeOn; turningOn = fish.alienDnaModeOn; }
  else return;
  fish.abilityToggleOnSince = turningOn ? state.level.elapsed : null;
  if (turningOn) {
    fish.shimmerStartedAt = state.level.elapsed;
    fish.toggleBounceStartedAt = state.level.elapsed;
  }
}

input.mouseDownHandlers.push((sx, sy) => {
  fishDragArmed = false;
  if (state.ui.paused) return;
  const world = screenToWorld(sx, sy, state.camera);
  const fish = findFishAt(state, world.x, world.y);
  if (!fish) return;
  // A fish can be a legal drag SOURCE for either interaction — Economy Fish
  // Combining or (Phase 4) Gene-Splicing. Per direct bug report ("it only
  // seems to work if I grab one of the two specifically first... fix it so
  // I can grab either fish"), a splice pair's TARGET half (an ordinary
  // economy/hybrid-eligible fish, not one of the 3 utility species) also
  // needs to be pickable — isSpliceTargetCandidate is the missing other half
  // of isSpliceSource's own check, true for whichever fish would be eligible
  // as the RECEIVING side of some currently-unlocked splice. The mouseup
  // handler and the hover-highlight below both already try both dragged/
  // target orderings, so it no longer matters which half of a pair gets
  // grabbed first.
  const spliceEligible = isSpliceSource(state, fish) || isSpliceTargetCandidate(state, fish);
  // Economy Fish Combining still requires the dedicated Merge tool (🧤) to be
  // selected first — deliberate anti-accidental-drag fix, unchanged (the
  // mouseup handler below re-checks this too, since spliceEligible can now
  // arm a drag from any tool — see its own comment for why that 2nd check
  // still matters). Gene-Splicing, per direct request ("make it so you can
  // use the splice tool at any time"), no longer needs that same explicit
  // tool switch at all — any press landing on a splice-eligible fish arms
  // the drag regardless of what's currently selected.
  if ((state.ui.selectedTool === 'merge' && isCombinableFish(state, fish)) || spliceEligible) {
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
    // Combining still requires 'merge' to have been selected AT THE DROP —
    // splicing can now arm this drag from any tool (see the mousedown
    // handler's own comment), so this guard is what stops two same-species
    // fish from accidentally combining mid-splice-drag while some other
    // tool (Food, a building, Blueprint) is actually active.
    if (state.ui.selectedTool === 'merge' && canCombineFish(state, dragged, target)) {
      combineFish(state, dragged, target);
      // The first-time merge guided tutorial's own final step — a no-op
      // unless that exact flow/step is currently active (see UI.js's
      // advanceTutorialFlow), so this is safe to call on every ordinary
      // combine outside the tutorial too.
      advanceTutorialFlow(state, 'mergefish', 'drag');
    } else if (canSpliceFish(state, dragged, target)) {
      spliceFish(state, dragged, target);
    } else if (canSpliceFish(state, target, dragged)) {
      // The reverse ordering — the player grabbed the TARGET half of the
      // pair (an ordinary economy/hybrid fish) and dropped it onto the
      // utility fish, instead of the other way around. spliceFish always
      // wants (state, utilityFish, targetFish) regardless of which one was
      // actually dragged, so `target` (here, the real utility fish) goes
      // first.
      spliceFish(state, target, dragged);
    }
  } else if (dragged) {
    // Xeno Octopus's own one-off splice target is an alien, not a fish —
    // findFishAt (fish-only) never matches it, so this only runs as a
    // fallback once no fish target was found, reusing the same hit-test
    // radius the click-damage loop above already uses for aliens.
    let alienTarget = null;
    for (const entity of state.level.entities) {
      if (entity.type !== 'alien' || entity.hp <= 0) continue;
      if (Math.hypot(entity.x - world.x, entity.y - world.y) <= (entity.radius ?? ALIEN_RADIUS) * ALIEN_CLICK_RADIUS_MULTIPLIER) { alienTarget = entity; break; }
    }
    if (alienTarget && canSpliceOctopusWithAlien(state, dragged, alienTarget)) {
      spliceOctopusWithAlien(state, dragged, alienTarget);
    }
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

// Same idea as isWasteDragTutorialStepActive above, for the "mergefish"
// flow's own 'drag' step — real bug fix, per direct report ("you can't grab
// a fish during the tutorial"). The general tutorial freeze below used to
// skip updateEntities/updateFishDrag for EVERY flow except the waste-drag
// one, which meant a mousedown during this step still correctly armed
// draggedFishId (that handler has no tutorialFlow check of its own), but the
// dragged fish's position never actually followed the cursor — updateFishDrag,
// the function that does that snapping, never ran — so the drag looked
// completely unresponsive even though the underlying grab had technically
// succeeded.
function isMergeDragTutorialStepActive(state) {
  return state.level.tutorialFlow?.id === 'mergefish' && state.level.tutorialFlow.step === 'drag';
}

// Same idea again, for the 'chest' guided flow's own two drag steps — kept
// as two separate checks (not folded into isWasteDragTutorialStepActive
// above) since they gate two DIFFERENT mechanics: 'feedwaste' is an ordinary
// item drag (the ITEM_DRAG mousedown handler's own tutorial gate needs to
// recognize it too, same as isWasteDragTutorialStepActive), while 'trickle'
// is the chest's own dedicated aim-drag gesture below, nothing to do with
// the generic item-drag system at all.
function isChestFeedWasteStepActive(state) {
  return state.level.tutorialFlow?.id === 'chest' && state.level.tutorialFlow.step === 'feedwaste';
}
function isChestTrickleStepActive(state) {
  return state.level.tutorialFlow?.id === 'chest' && state.level.tutorialFlow.step === 'trickle';
}

// Item dragging — generalized from a Waste-only mechanic to every item type
// (coin/food/waste/science), per direct request ("make it so that every
// object can be clicked and dragged around, just like waste. Make sure the
// collision, gravity, and momentum works the same way"). Mirrors the Economy
// Fish combine-drag pattern above (draggedFishId/fishDragArmed) for the
// grab/hold/release shape, no tool requirement (grabbing an item directly
// always works, regardless of the currently selected tool). Only one item
// can ever be dragged at a time (a second mousedown on another item while
// one's already held is impossible anyway, since releasing the first is
// what clears draggedItemId). updateItemDrag (called from update(), after
// updateEntities — same "override whatever this tick's normal physics did"
// ordering updateFishDrag already uses) snaps the item's position to the
// cursor and zeroes its velocity every tick; Grid.js's resolveItemCollisions
// (which runs inside updateEntities, unconditionally over every item every
// tick regardless of who's currently "controlling" its position — see
// CLAUDE.md's "Items can't stack" section) then pushes every other nearby
// item out of the way of wherever the dragged item currently sits, one tick
// behind, same as a dragged fish already causes for anything it swims
// through — no special-casing needed there at all. A Turret/Auto-Feeder/
// Processor's own intake scan (Grid.js's updateBuildings) is equally
// untouched: it already just looks for an eligible item within its intake
// radius each tick regardless of any drag state, so a dragged item that
// drifts close enough still gets pulled in and spliced out of
// state.level.items normally — updateItemDrag just needs to notice the item
// is gone and clear the drag, same as updateFishDrag already does for a
// fish that starves mid-drag.
//
// A Coin is ALSO click-bankable (tryBankCoinAt, fired from the click
// handler below) — Science/Green Science lost this per direct request (they
// can only be banked via a Collector now) — a plain click (no real drag) has
// to keep banking a coin normally, while a genuine drag-and-release must NOT
// also bank/place something at the drop point. Resolved by a minimum
// move-distance check (ITEM_DRAG_MOVE_THRESHOLD_PX) rather than always
// suppressing the click the way the fish-drag/old waste-drag unconditionally
// did: itemDragMoved is computed once at mouseup from how far the cursor
// actually traveled, and only THEN suppresses the click, so an unmoved
// press-release still reads as an ordinary click. Food/Waste have no
// existing click-driven interaction of their own to protect, so applying
// the same threshold to them uniformly is harmless — an unmoved press still
// falls through to whatever the currently selected tool's click handler
// already does, unchanged from before this mechanic existed.
let draggedItemId = null;
let draggedItemType = null; // 'coin' | 'food' | 'waste' | 'science' — which item is currently held, so the tutorial's ghost-Waste check can still target Waste specifically (no location-based clamp reads this any more — every item type can now be dragged anywhere in the tank)
let itemDragStartSx = 0;
let itemDragStartSy = 0;
let itemDragMoved = false; // set once at mouseup — read (and cleared) by the click handler right after
// Set true the instant updateBuildDrag places the postalien tutorial's own
// Waste Turret and clears selectedTool back to the cursor — see the click
// handler's own check of this flag for why: that reset strips the ordinary
// "!effectiveTool.startsWith('build:')" guard against the building-info
// pop-up, so without this the very same click that placed the turret would
// immediately reopen its info modal on top of it.
let suppressTutorialTurretPlacementClick = false;
// Set true the instant updateBuildDrag places a fresh Manufacturer or Power
// Plant. Per direct request, a Manufacturer/Power Plant's recipe pop-up
// shouldn't pop open the very instant it's placed — that would prevent
// drag-to-place with these buildings, since getRecipeBuildingKeyAt (below)
// deliberately ignores the currently selected tool so the pop-up can be
// reopened later regardless of what's armed, which also means the native
// click that follows this same placement's mousedown would otherwise
// immediately reopen it. Consumed (and cleared) by the click handler's own
// check, same pattern as suppressTutorialTurretPlacementClick above — a
// separate, later click is what actually opens the recipe menu.
let suppressRecipeMenuAfterPlacementClick = false;
// Short rolling history of the cursor's own raw world position while a drag
// is active — see updateItemDrag's own comment for why release velocity is
// now averaged over this window instead of read off a single tick's delta.
let itemDragPositionHistory = [];

// Extended with the new Bio-chain item types (Architectural Update) for the
// same "every object can be clicked and dragged around" consistency the
// original 4 types already established — nothing about the new items makes
// them an exception.
const DRAGGABLE_ITEM_TYPES = ['coin', 'food', 'waste', 'science', 'science_green', 'alien_dna', 'biomass', 'mutagen_paste', 'alien_egg'];

input.mouseDownHandlers.push((sx, sy) => {
  // A guided tutorial normally blocks starting an item drag like every
  // other input mechanic (see the general tutorial-flow hotkey-swallow
  // block in the keydown handler) — EXCEPT for the one tutorial step the
  // Waste-into-Turret drag exists to teach in the first place, which would
  // otherwise make the step's own mechanic completely unusable while it's
  // active. Per direct report ("make it so the waste can actually be
  // dragged during the tutorial").
  if (state.ui.paused || (state.level.tutorialFlow && !isWasteDragTutorialStepActive(state) && !isChestFeedWasteStepActive(state))) return;
  if (draggedFishId != null) return; // a fish-drag already claimed this press
  const world = screenToWorld(sx, sy, state.camera);
  // Per direct request ("objects can't be dragged when a building or fish
  // is selected for purchasing... you have to be on the food cursor tool to
  // drag objects" — now also true of the plain cursor tool, per the later
  // "default cursor can be used for... dragging objects/recipes" request) —
  // reuses the same effectiveToolAt a build tool already gets silently
  // reinterpreted as Food through while hovering open water, so this stays
  // consistent with that existing behavior rather than introducing a
  // second, slightly different notion of "which tool is this really." Fish/
  // Merge are NOT given that same open-water carve-out by effectiveToolAt
  // (see its own comment), so both correctly still block a drag here
  // regardless of where the cursor is, matching "a fish selected for
  // purchasing" explicitly named in the request.
  if (!isCursorOrFoodTool(effectiveToolAt(world.y))) return;
  let best = null;
  let bestDistSq = Infinity;
  for (const item of state.level.items) {
    if (!DRAGGABLE_ITEM_TYPES.includes(item.type)) continue;
    // Already claimed as a building's input (mid-disintegrate) — per direct
    // report, can't be grabbed at all while that's happening, not even a
    // Collector-held coin/Science Bubble (which tracks its own hold via
    // item.collectorProgressMs, a completely different field from
    // heldByKey — checking both via the same predicate the render loop
    // already uses for the disintegrate effect itself is what makes this
    // catch both mechanisms uniformly). The only way to get it back is to
    // move the building holding it — see updateItemDrag's own comment.
    if (getItemDisintegrateFraction(state, item) != null) continue;
    // Every draggable item type is grabbable wherever it exists, open water
    // or the city alike — per direct request ("there doesn't need to be any
    // objects that can only be dragged in certain spots anymore"), removing
    // Waste's old, narrower "city only" carve-out so every item follows the
    // exact same rule.
    const distSq = (item.x - world.x) ** 2 + (item.y - world.y) ** 2;
    const hitRadius = item.radius * ITEM_DRAG_CLICK_RADIUS_MULTIPLIER;
    if (distSq <= hitRadius * hitRadius && distSq < bestDistSq) { best = item; bestDistSq = distSq; }
  }
  if (best) {
    draggedItemId = best.id;
    draggedItemType = best.type;
    itemDragStartSx = sx;
    itemDragStartSy = sy;
    itemDragMoved = false;
    itemDragPositionHistory = [];
  }
});

input.mouseUpHandlers.push(() => {
  if (draggedItemId != null) {
    const movedPx = Math.hypot(input.mouse.x - itemDragStartSx, input.mouse.y - itemDragStartSy);
    itemDragMoved = movedPx >= ITEM_DRAG_MOVE_THRESHOLD_PX;
  }
  // Deliberately doesn't touch the dragged item's vx/vy — updateItemDrag
  // (below) already leaves it carrying real, cursor-derived velocity every
  // tick it's held, so letting go here just hands that off to the normal
  // physics (Grid.js's stepItemOnGrid/integrateItemForces, or Entities.js's
  // own open-water integration for a coin/food/science still above the
  // seabed line) to carry on from, same as if gravity/drag had been acting
  // on it the whole time.
  draggedItemId = null;
  draggedItemType = null;
  itemDragPositionHistory = [];
});

// How many recent ticks' worth of cursor movement to average into the
// release velocity — see updateItemDrag's own comment for why a single
// tick's delta wasn't good enough. ~100ms at the fixed 60Hz sim rate: long
// enough to smooth out a single noisy sample, short enough to still track a
// genuine fast flick rather than dragging down its speed.
const ITEM_DRAG_VELOCITY_SAMPLE_TICKS = 6;

function updateItemDrag() {
  if (draggedItemId == null) return;
  const dragged = state.level.items.find((item) => item.id === draggedItemId && item.type === draggedItemType);
  // Real bug fixed: a Collector/Refinery/Manufacturer/Power Plant/Turret no
  // longer instantly splices an absorbed item out of state.level.items the
  // way an older version did — it marks it as held (a Collector via
  // item.collectorProgressMs, everything else via item.heldByKey) and eases
  // it toward the tile's own center over its processing/disintegrate
  // duration (Grid.js's stepCollectorProcessing/stepHeldItem) instead, so it
  // can still play its disintegrate animation in place. Since the item is
  // STILL genuinely present in the array while held, the old `!dragged`
  // check alone didn't catch this case — updateItemDrag kept right on
  // snapping it back to the cursor every tick, fighting the building's own
  // easing and letting the player keep dragging an item around indefinitely
  // even while it was mid-disintegrate. getItemDisintegrateFraction is the
  // one shared predicate that already recognizes BOTH hold mechanisms (it's
  // what the render loop uses to decide whether to draw the erosion effect
  // at all) — releasing the drag the instant it stops returning null (same
  // as the already-gone case below) is what lets the building's own pull
  // actually take over, and the mousedown handler's own matching check is
  // what stops the item being grabbed back out at all once it's claimed.
  if (!dragged || getItemDisintegrateFraction(state, dragged) != null) {
    // Absorbed by a building's own intake scan (or otherwise removed)
    // mid-drag — the mouse button is still down at this point, so the real
    // mouseup/click that follows is still coming. Real bug fix, per direct
    // report ("when you drag an object into a building and let go, it
    // shouldn't also click the building to bring up the info modal"): the
    // normal path that sets itemDragMoved (mouseUpHandlers, below) only ever
    // runs on a genuine mouseup with draggedItemId still non-null — since
    // this branch clears it FIRST, that check silently no-ops and
    // itemDragMoved is left wherever it happened to be (false, from this
    // drag's own mousedown reset), so the click landing on the building the
    // item just got dragged into wasn't being suppressed at all. Set it true
    // here instead — the item reaching the building IS the drag's whole
    // point, so the click it produces should be consumed the same way a
    // drag ending anywhere else already is.
    draggedItemId = null;
    draggedItemType = null;
    itemDragPositionHistory = [];
    itemDragMoved = true;
    return;
  }
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const dtSec = SIM_DT_MS / 1000;
  // Per direct request ("when a player is dragging waste around and lets
  // go, the waste still has the same momentum from when the player is
  // holding it... the player should essentially be able to throw waste back
  // up into the tank" — now generalized to every item type): velocity
  // carries into the normal per-tick gravity+drag integration every item
  // already gets on release — nothing extra is needed for it to keep
  // flying, arc, and gradually decelerate.
  //
  // Real bug fixed here, per direct report ("occasionally the momentum
  // shoots in the wrong direction, sometimes faster than the mouse was
  // moving"): an original single-tick-delta version was noisy — a mousemove
  // landing right on a tick boundary, a momentary stutter, or the raw
  // cursor otherwise jittering by a pixel or two between two ticks all got
  // divided by the same tiny dtSec, so a small, meaningless wobble on the
  // very last tick before release could produce a huge, wrong-direction
  // velocity completely disconnected from the actual drag gesture. Fixed by
  // tracking a short rolling history of the cursor's own raw world position
  // (itemDragPositionHistory, capped at ITEM_DRAG_VELOCITY_SAMPLE_TICKS
  // entries) and computing vx/vy from the OLDEST sample in that window to
  // the current one, divided by the real elapsed time across however many
  // ticks are actually in the window — averaging away a single outlier tick
  // while still tracking a genuine fast flick almost as responsively (the
  // window is only ~100ms).
  itemDragPositionHistory.push({ x: world.x, y: world.y });
  if (itemDragPositionHistory.length > ITEM_DRAG_VELOCITY_SAMPLE_TICKS + 1) itemDragPositionHistory.shift();
  const oldest = itemDragPositionHistory[0];
  const sampleTicks = itemDragPositionHistory.length - 1;
  if (sampleTicks > 0) {
    // Uses `world.y` (unclamped) for both ends of the sample, not the item's
    // actual clamped position — so a fast swing right at any boundary (the
    // city line for Waste, or now the world's own hard edges below) still
    // registers real speed for the release-momentum calc even though the
    // item's own on-screen position can't visually follow the cursor past
    // that boundary while still held.
    dragged.vx = (world.x - oldest.x) / (sampleTicks * dtSec);
    dragged.vy = (world.y - oldest.y) / (sampleTicks * dtSec);
  }
  // Dragging can't push an item past any of the world's 4 hard boundaries
  // either — per direct request ("dragged objects can't move past the hard
  // barriers of the sides, top, or bottom... I shouldn't be able to drag an
  // object into the side glass panels or into the toolbar at the bottom").
  // The glass panels and the bottom tool-bar are purely screen-space
  // dressing sitting just outside the world's real x=0/WORLD_W and
  // y=WORLD_H edges (see main.js's renderTankWalls and Grid.js's
  // renderCameraBottomBuffer) — clamping to those same world coordinates,
  // the exact ones Entities.js's clampItemToWorldWalls/Grid.js's
  // sweepVertical already enforce for ordinary (non-dragged) physics, keeps
  // a dragged item out of both for free, with no separate screen-space
  // check needed. No item type gets any additional, narrower clamp on top of
  // this any more — per direct request, Waste's old "can't be dragged back
  // up above SEABED_FLOOR_Y" floor is gone, so every item can be dragged
  // anywhere in the tank, city or open water alike.
  const margin = dragged.radius || 0;
  const clampedX = Math.min(Math.max(world.x, margin), WORLD_W - margin);
  const clampedY = Math.min(Math.max(world.y, margin), WORLD_H - margin);
  dragged.x = clampedX;
  dragged.y = clampedY;
  dragged.resting = false;
}

// Storage Chest aim-drag — per direct request ("make it so the player has
// to drag and drop in the direction they want the objects to spit, with the
// cursor turning into an arrow animation in the direction of the line
// between the storage chest and the cursor. When they release, have the
// storage chest trickle the output in the chosen direction"), later
// extended ("make the distance the chests spits out objects variable based
// on the distance away the cursor gets from the chest") to also drive
// launch distance, and mirrored by a SECOND, right-button gesture ("add a
// right click and drag mechanic... that mimics the click and drag mechanic
// exactly, but clears all the contents of the chest") that replaces the old
// Clear Chest button outright. Both gestures share this one helper for the
// "read the live angle/distance/fraction from a chest to the cursor" math,
// so the two can never drift apart — left-drag arms an ongoing trickle
// (armChestTrickle), right-drag immediately triggers a full staggered dump
// (clearChestContents), and BOTH drive the identical glowing/stretching/
// color-shifting cursor via chestAimCursorCss below.
//
// distanceTiles is a straight 1:1 mapping of the drag's own live WORLD-
// space distance (zoom-independent) into tiles, clamped into
// [STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES, ...MAX...[this chest's own
// tier]] — see Config.js's own comment on those constants for the full
// physics rationale. fraction (0-1) is that same distance normalized
// against THIS chest's own max, purely for the cursor's visual stretch/glow/
// color, so a Tier 1 chest's cursor reads "fully charged" at 8 tiles while a
// Tier 3's needs a full 16.
function computeChestAimState(state, key, worldX, worldY) {
  const [row, col] = key.split(',').map(Number);
  const angle = angleFromTileToPoint(col, row, worldX, worldY);
  const cx = col * TILE_SIZE + TILE_SIZE / 2;
  const cy = row * TILE_SIZE + TILE_SIZE / 2;
  const distanceWorldPx = Math.hypot(worldX - cx, worldY - cy);
  const chestType = state.level.grid[row]?.[col];
  const maxTiles = STORAGE_CHEST_MAX_TRICKLE_DISTANCE_TILES[chestType] || STORAGE_CHEST_MAX_TRICKLE_DISTANCE_TILES.storage_chest;
  const rawTiles = distanceWorldPx / TILE_SIZE;
  const distanceTiles = Math.max(STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES, Math.min(maxTiles, rawTiles));
  const fraction = Math.max(0, Math.min(1, (distanceTiles - STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES) / (maxTiles - STORAGE_CHEST_MIN_TRICKLE_DISTANCE_TILES)));
  return { angle, distanceTiles, fraction };
}

// True while (worldX, worldY) still sits within the dragged-from chest's own
// tile — per direct request, releasing either drag gesture back over the
// chest itself now cancels it outright (no direction armed/cleared) rather
// than falling back to the 1-tile minimum distance, since a barely-moved
// drag landing back on the chest reads as "I changed my mind," not "I want
// the shortest possible trickle." Also drives the cancel cursor below.
function isPointOverChestTile(key, worldX, worldY) {
  const [row, col] = key.split(',').map(Number);
  return worldX >= col * TILE_SIZE && worldX < col * TILE_SIZE + TILE_SIZE
    && worldY >= row * TILE_SIZE && worldY < row * TILE_SIZE + TILE_SIZE;
}

// ---- Left-drag: arm the auto-trickle ----
let chestAimDragKey = null; // "row,col" buildingKey of whichever chest is currently being aimed, or null
let chestAimDragMoved = false;
let chestAimDragStartSx = 0;
let chestAimDragStartSy = 0;

input.mouseDownHandlers.push((sx, sy) => {
  // Same tutorial-freeze gate every other drag-arming mousedown handler in
  // this file uses — EXCEPT for the 'chest' flow's own 'trickle' step,
  // which this exact gesture exists to teach in the first place (mirrors
  // isWasteDragTutorialStepActive's own carve-out above).
  if (state.ui.paused || (state.level.tutorialFlow && !isChestTrickleStepActive(state))) return;
  if (draggedFishId != null || draggedItemId != null) return; // another drag already claimed this press
  const world = screenToWorld(sx, sy, state.camera);
  if (!isCursorOrFoodTool(effectiveToolAt(world.y))) return;
  // During the tutorial's own 'trickle' step, a press anywhere within
  // CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES of a placed chest grabs it — per
  // direct request — rather than requiring an exact hit on its own (small)
  // tile, since this is the very first time the player's ever attempting
  // this gesture. Every other time, an exact hit is still required.
  const key = isChestTrickleStepActive(state)
    ? getChestKeyNear(state, world.x, world.y, CHEST_TUTORIAL_DRAG_CLICK_RADIUS_TILES)
    : getChestKeyAt(state, world.x, world.y);
  if (!key) return;
  chestAimDragKey = key;
  chestAimDragStartSx = sx;
  chestAimDragStartSy = sy;
  chestAimDragMoved = false;
});

input.mouseUpHandlers.push(() => {
  if (chestAimDragKey == null) return;
  const movedPx = Math.hypot(input.mouse.x - chestAimDragStartSx, input.mouse.y - chestAimDragStartSy);
  chestAimDragMoved = movedPx >= ITEM_DRAG_MOVE_THRESHOLD_PX;
  if (chestAimDragMoved) {
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    // Released back over the chest itself — cancel, per direct request, no
    // direction armed. chestAimDragMoved stays true either way so the click
    // handler still treats this as a drag (not a plain click that should
    // pop the chest's info modal open).
    if (!isPointOverChestTile(chestAimDragKey, world.x, world.y)) {
      const { angle, distanceTiles } = computeChestAimState(state, chestAimDragKey, world.x, world.y);
      armChestTrickle(state, chestAimDragKey, angle, distanceTiles);
      advanceTutorialFlow(state, 'chest', 'trickle');
    }
  }
  chestAimDragKey = null;
  lastCursorTool = null; // force updateCanvasCursor to re-apply the ordinary tool cursor next frame, since this gesture was overriding it directly
});

// ---- Right-drag: an immediate, fully-staggered clear ----
// Uses Engine.js's new rightMouseDownHandlers/rightMouseUpHandlers (added
// specifically for this — the pre-existing rightClickHandlers only ever
// fires once per gesture, off the browser's own contextmenu event, with no
// down/move/up granularity of its own). Deliberately NOT exempted during
// any tutorial step — clearing a chest isn't something the guided flow ever
// asks the player to do, so it stays blocked like any other non-essential
// interaction while one is active, same as the item-drag mousedown's own
// default (non-carved-out) tutorial gate.
let chestClearDragKey = null;
let chestClearDragStartSx = 0;
let chestClearDragStartSy = 0;

input.rightMouseDownHandlers.push((sx, sy) => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  if (draggedFishId != null || draggedItemId != null || chestAimDragKey != null) return;
  const world = screenToWorld(sx, sy, state.camera);
  if (!isCursorOrFoodTool(effectiveToolAt(world.y))) return;
  const key = getChestKeyAt(state, world.x, world.y);
  if (!key) return;
  chestClearDragKey = key;
  chestClearDragStartSx = sx;
  chestClearDragStartSy = sy;
});

input.rightMouseUpHandlers.push(() => {
  if (chestClearDragKey == null) return;
  const movedPx = Math.hypot(input.mouse.x - chestClearDragStartSx, input.mouse.y - chestClearDragStartSy);
  if (movedPx >= ITEM_DRAG_MOVE_THRESHOLD_PX) {
    const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    // Same cancel-on-release-over-the-chest rule as the left-drag above.
    if (!isPointOverChestTile(chestClearDragKey, world.x, world.y)) {
      const { angle, distanceTiles } = computeChestAimState(state, chestClearDragKey, world.x, world.y);
      clearChestContents(state, chestClearDragKey, angle, distanceTiles);
    }
  }
  chestClearDragKey = null;
  lastCursorTool = null;
});

// Called every tick from update() while either chest-aim drag is in
// progress — recomputes the live angle/distance from whichever chest is
// being dragged from to wherever the cursor currently is, and points the OS
// cursor glyph itself in that exact direction, stretching/glowing/changing
// color with distance (chestAimCursorCss below), per direct request. Both
// gestures share one cursor treatment — the player is aiming the same way
// either time, just choosing left (trickle) or right (clear) for what
// happens on release.
function updateChestAimDrag() {
  const activeKey = chestAimDragKey ?? chestClearDragKey;
  if (activeKey == null) return;
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  // The cursor is still sitting back over the chest it was dragged from —
  // releasing right now would cancel the gesture (see the mouseUp handlers
  // above), so the OS cursor itself switches to a plain "not-allowed" glyph
  // instead of the aim arrow, per direct request ("change the cursor to
  // look like a cancel cursor... so the player knows they can release there
  // and cancel it").
  if (isPointOverChestTile(activeKey, world.x, world.y)) {
    if (lastChestAimCursorFraction !== -1) {
      lastChestAimCursorDeg = null;
      lastChestAimCursorFraction = -1;
      lastChestAimCursorTimeBucket = null;
      canvas.style.cursor = 'not-allowed';
    }
    return;
  }
  const { angle, fraction } = computeChestAimState(state, activeKey, world.x, world.y);
  // Rounded to the nearest 5deg / 5% — a real per-pixel-of-mouse-movement
  // cursor rewrite would mean re-encoding a fresh SVG data URI on nearly
  // every frame this drag is active; this keeps the visual plenty smooth
  // while only actually touching canvas.style.cursor when any of the three
  // values has moved/ticked enough to matter. The time bucket (40ms, ~25fps)
  // is what drives the arrow's own continuous stretch/squish "bounce" and
  // alpha "shimmer" (chestAimCursorCss) — per direct follow-up request ("I
  // dont see any bouncing/shimmering on the trickle/release drag arrow. It
  // stretches and changes color, that's all.") — without it, this cursor
  // would only ever redraw when the mouse itself moved, which reads as
  // static between actual drag adjustments.
  const angleDeg = Math.round((angle * 180) / Math.PI / 5) * 5;
  const fractionBucket = Math.round(fraction * 20) / 20;
  const timeBucket = Math.round(state.level.elapsed / 40) * 40;
  if (angleDeg !== lastChestAimCursorDeg || fractionBucket !== lastChestAimCursorFraction || timeBucket !== lastChestAimCursorTimeBucket) {
    lastChestAimCursorDeg = angleDeg;
    lastChestAimCursorFraction = fractionBucket;
    lastChestAimCursorTimeBucket = timeBucket;
    canvas.style.cursor = chestAimCursorCss(angleDeg, fractionBucket, state.level.elapsed);
  }
}
let lastChestAimCursorDeg = null;
let lastChestAimCursorFraction = null;
let lastChestAimCursorTimeBucket = null;

// Three RGB stops (near -> mid -> far) the arrow's fill/glow color
// interpolates across as `fraction` (0-1, this chest's own distance divided
// by its own tier max) climbs — white reads as "just barely armed," through
// yellow, to a hot red-orange at the tier's own maximum reach. Per direct
// request ("have the arrow animation glow, and have it stretch and change
// color the further away the cursor gets from the storage chest").
const CHEST_AIM_COLOR_STOPS = [
  [255, 255, 255], // fraction 0
  [255, 214, 64], // fraction 0.5
  [255, 68, 40], // fraction 1
];
function chestAimArrowColor(fraction) {
  const scaled = fraction * (CHEST_AIM_COLOR_STOPS.length - 1);
  const i = Math.min(CHEST_AIM_COLOR_STOPS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const a = CHEST_AIM_COLOR_STOPS[i];
  const b = CHEST_AIM_COLOR_STOPS[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bch = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bch})`;
}

// The Storage Chest aim cursor — a triangular arrow (same rotate-an-SVG-
// around-its-own-center technique the shell cursor's box widening already
// established, just with a real <filter> glow instead of a plain glyph) that
// STRETCHES longer and shifts color hotter the further the current drag sits
// from the chest, normalized against that chest's own tier max — per direct
// request. The SVG canvas is sized for the longest possible stretch
// regardless of the current fraction so the hotspot (always the box center)
// never shifts as the arrow grows. On TOP of that distance-driven stretch,
// elapsedMs drives a continuous stretch/squish "bounce" along the arrow's
// own pointing axis plus an alpha "shimmer" — per direct follow-up request
// ("I dont see any bouncing/shimmering on the trickle/release drag arrow.
// It stretches and changes color, that's all. Fix it.") — this is the exact
// same bounce/shimmer math renderChestIcon's own on-chest trickle indicator
// already uses, just applied to the drag cursor's arrow instead, since
// that's the one actually on screen during the drag itself. `length` is
// clamped to the canvas's own half-size so the bounce can never push the
// arrow's tip past the SVG's edge even at max distance + peak bounce
// simultaneously.
function chestAimCursorCss(angleDeg, fraction, elapsedMs) {
  const size = 64;
  const c = size / 2;
  const minLen = 10;
  const maxLen = size / 2 - 4;
  const baseLength = minLen + (maxLen - minLen) * fraction;
  const color = chestAimArrowColor(fraction);
  const glowStdDev = 1.5 + fraction * 3.5;
  const t = (elapsedMs || 0) / 1000;
  const bounce = Math.sin(t * 4.5);
  const length = Math.min(size / 2 - 2, baseLength * (1 + bounce * 0.18));
  const halfWidth = 7 * (1 - bounce * 0.12);
  const shimmer = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t * 6));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
    `<defs><filter id='g' x='-100%' y='-100%' width='300%' height='300%'>` +
    `<feGaussianBlur stdDeviation='${glowStdDev}' result='b'/>` +
    `<feMerge><feMergeNode in='b'/><feMergeNode in='b'/><feMergeNode in='SourceGraphic'/></feMerge>` +
    `</filter></defs>` +
    `<g transform='rotate(${angleDeg} ${c} ${c})' opacity='${shimmer.toFixed(2)}'>` +
    `<polygon points='${(c + length).toFixed(1)},${c} ${(c - length * 0.35).toFixed(1)},${(c - halfWidth).toFixed(1)} ${(c - length * 0.35).toFixed(1)},${(c + halfWidth).toFixed(1)}' fill='${color}' stroke='#1a1a1a' stroke-width='1.5' stroke-linejoin='round' filter='url(#g)'/>` +
    `</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${c} ${c}, auto`;
}

// Manufacturer/Power Plant drag-to-copy-recipe — per direct request ("click
// and dragged, and a ghost icon of the building will go on the cursor (the
// actual building shouldn't move)... release the drag, copy the recipe from
// the dragged building to the building the ghost was released on"). Mirrors
// the item-drag gesture shape above (mousedown arms it, a per-tick update
// tracks the live hover target, mouseup commits or cancels) but the SOURCE
// tile itself never moves — only a ghost icon follows the cursor
// (render()'s own draw call, below), and nothing happens at all unless the
// release lands on a genuinely different tile of the exact same building
// type (UI.js's copyBuildingRecipe already guards this, redundantly with
// the hover check here). A plain click (no real drag) still opens the
// normal recipe pop-up menu as before — recipeDragMoved is what the click
// handler checks to tell the two gestures apart, same "move-distance
// threshold" pattern itemDragMoved already established.
let recipeDragSourceKey = null;
let recipeDragType = null;
let recipeDragStartSx = 0;
let recipeDragStartSy = 0;
let recipeDragMoved = false;
let recipeDragHoverKey = null; // whichever same-type building the cursor is currently over — drives the ghost's green-hue tint

input.mouseDownHandlers.push((sx, sy) => {
  if (state.ui.paused) return;
  const world = screenToWorld(sx, sy, state.camera);
  if (input.keysDown.has('KeyD') && isCursorOrFoodTool(state.ui.selectedTool)) return; // don't fight with the D-hotkey's own drag-delete on the same press
  const key = getRecipeBuildingKeyAt(state, world.x, world.y);
  if (!key) return;
  recipeDragSourceKey = key;
  recipeDragType = state.level.buildingData[key].type;
  recipeDragStartSx = sx;
  recipeDragStartSy = sy;
  recipeDragMoved = false;
  recipeDragHoverKey = null;
});

input.mouseUpHandlers.push((sx, sy) => {
  if (recipeDragSourceKey == null) return;
  const movedPx = Math.hypot(sx - recipeDragStartSx, sy - recipeDragStartSy);
  recipeDragMoved = movedPx >= ITEM_DRAG_MOVE_THRESHOLD_PX;
  if (recipeDragMoved && recipeDragHoverKey) {
    copyBuildingRecipe(state, recipeDragSourceKey, recipeDragHoverKey);
  }
  recipeDragSourceKey = null;
  recipeDragType = null;
  recipeDragHoverKey = null;
});

function updateRecipeDrag() {
  if (recipeDragSourceKey == null) return;
  if (!state.level.buildingData[recipeDragSourceKey]) { recipeDragSourceKey = null; recipeDragType = null; recipeDragHoverKey = null; return; } // demolished mid-drag
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const hoverKey = getRecipeBuildingKeyAt(state, world.x, world.y);
  const hoverData = hoverKey ? state.level.buildingData[hoverKey] : null;
  recipeDragHoverKey = hoverData && hoverData.type === recipeDragType && hoverKey !== recipeDragSourceKey ? hoverKey : null;
}

// Platform/Fan drag-to-copy-filter — per direct request ("make it so you can
// click and drag active filters from one platform to another... the same
// way the recipe copying works between buildings"), later extended to Fans
// ("allow filter recipe drag and drop sharing between fans and platforms").
// An exact mirror of the Manufacturer/Power Plant recipe-drag mechanic just
// above — the SOURCE tile never moves, only a small ghost follows the
// cursor (render()'s own draw call below) until the release lands on a
// genuinely different filterable tile (UI.js's copyPlatformFilter).
// Deliberately does NOT require the same tile type on both ends — not even
// Platform vs Fan — "even from a full platform to half platform" (and, per
// the later request, a Fan and a Platform share the exact same plain-array
// filterItems shape too) — getPlatformFilterKeyAt matches ANY Platform-
// family tile OR Fan, with no type-equality check the way the recipe-drag's
// own hover check has. A plain click (no real drag) still opens the normal
// filter pop-up as before — platformFilterDragMoved is what the click
// handler checks to tell the two gestures apart, same "move-distance
// threshold" pattern recipeDragMoved/itemDragMoved already established.
let platformFilterDragSourceKey = null;
let platformFilterDragStartSx = 0;
let platformFilterDragStartSy = 0;
let platformFilterDragMoved = false;
let platformFilterDragHoverKey = null; // whichever other Platform tile the cursor is currently over — drives the ghost's green-hue tint

input.mouseDownHandlers.push((sx, sy) => {
  if (state.ui.paused) return;
  const world = screenToWorld(sx, sy, state.camera);
  if (input.keysDown.has('KeyD') && isCursorOrFoodTool(state.ui.selectedTool)) return; // don't fight with the D-hotkey's own drag-delete on the same press
  const key = getPlatformFilterKeyAt(state, world.x, world.y);
  if (!key) return;
  platformFilterDragSourceKey = key;
  platformFilterDragStartSx = sx;
  platformFilterDragStartSy = sy;
  platformFilterDragMoved = false;
  platformFilterDragHoverKey = null;
});

input.mouseUpHandlers.push((sx, sy) => {
  if (platformFilterDragSourceKey == null) return;
  const movedPx = Math.hypot(sx - platformFilterDragStartSx, sy - platformFilterDragStartSy);
  platformFilterDragMoved = movedPx >= ITEM_DRAG_MOVE_THRESHOLD_PX;
  if (platformFilterDragMoved && platformFilterDragHoverKey) {
    copyPlatformFilter(state, platformFilterDragSourceKey, platformFilterDragHoverKey);
  }
  platformFilterDragSourceKey = null;
  platformFilterDragHoverKey = null;
});

function updatePlatformFilterDrag() {
  if (platformFilterDragSourceKey == null) return;
  if (!state.level.buildingData[platformFilterDragSourceKey]) { platformFilterDragSourceKey = null; platformFilterDragHoverKey = null; return; } // demolished/moved mid-drag
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const hoverKey = getPlatformFilterKeyAt(state, world.x, world.y);
  platformFilterDragHoverKey = hoverKey && hoverKey !== platformFilterDragSourceKey ? hoverKey : null;
}

// Blueprint tool ("Stamp") — a 4th persistent bottom-tool-bar tool (hotkey
// 4), per direct request: click-and-drag a box over a built area to copy
// every building inside it, then click again to paste that whole layout
// somewhere else. Two module-local phases, mirroring the shape of the
// recipe-drag mechanic just above: while `blueprintClipboard` is null, a
// mousedown-drag-mouseup gesture draws a selection box and captures it
// (Grid.js's captureBlueprint); once it's non-null, the whole stamp follows
// the cursor as a tinted multi-cell ghost (render()'s own draw call below)
// until a plain click commits it (Grid.js's placeBlueprint) or a right-
// click/Escape/Q cancels it back to an empty clipboard.
//
// Per direct request ("make the blueprints only available when the
// blueprint tool/cursor is selected"), a captured stamp no longer stays
// silently armed once the player switches to a different tool — see
// updateBlueprintToolGate below, called every tick unconditionally, which
// wipes both of these the instant state.ui.selectedTool stops being
// 'blueprint', by ANY path (a number-key hotkey, a shop click, Q, ...).
let blueprintDragStartCol = null; // tile col of the drag-select box's first corner, or null while not drag-selecting
let blueprintDragStartRow = null;
let blueprintClipboard = null; // captured cells (see Grid.js's captureBlueprint) | null — non-null means "armed, ready to paste"
let blueprintJustCaptured = false; // suppresses the native click that follows the same mouseup a capture just consumed

input.mouseDownHandlers.push((sx, sy) => {
  if (state.ui.paused || state.ui.selectedTool !== 'blueprint' || blueprintClipboard != null) return;
  const world = screenToWorld(sx, sy, state.camera);
  if (world.y < SEABED_FLOOR_Y) return; // nothing to select above the seabed
  const { col, row } = worldToTile(world.x, world.y);
  blueprintDragStartCol = col;
  blueprintDragStartRow = row;
});

input.mouseUpHandlers.push((sx, sy) => {
  if (blueprintDragStartCol == null) return;
  const world = screenToWorld(sx, sy, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  const cells = captureBlueprint(state, blueprintDragStartCol, blueprintDragStartRow, col, row);
  blueprintDragStartCol = null;
  blueprintDragStartRow = null;
  if (cells.length > 0) {
    blueprintClipboard = cells;
    blueprintJustCaptured = true; // the native click that follows this same mouseup shouldn't also try to paste at the release point
  }
});

// Called every tick, unconditionally (even during a guided tutorial, same
// as updateBuildDrag/updateKeyDDelete right above its own call site) —
// the moment the Blueprint tool isn't the one currently selected, whatever
// was captured/in-progress is gone, rather than a stale clipboard staying
// silently paste-able (and its ghost still following the cursor) in the
// background after switching away.
function updateBlueprintToolGate() {
  if (state.ui.selectedTool === 'blueprint') return;
  blueprintDragStartCol = null;
  blueprintDragStartRow = null;
  blueprintClipboard = null;
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
// Used by the building-hover legend below to add a "(R) to Rotate" second
// line specifically for a placed Platform (any of its 5 variants) — R
// cycles it in place for free (see Grid.js's cyclePlatformAt), the same
// hotkey that cycles the shop's own Platform family slot while a build tool
// is armed.
const PLATFORM_BUILDING_IDS = BUILDING_FAMILIES.platform;
let fanAimingCell = null; // { col, row, buildingId } | null

function isFanAimingActive() {
  if (fanAimingCell == null) return false;
  // A moved Fan's own angle step never changes selectedTool at all (it
  // stays on whichever of the cursor/Food tool it was armed from, the whole
  // time a move is in progress) — so unlike a genuine new placement, it
  // can't self-heal off a "does selectedTool still match the armed build
  // tool" check. updateBuildingMove() below is what replaces that self-
  // healing for this case instead (auto-cancels if selectedTool ever arms a
  // real build:/fish:/merge/blueprint tool — see isCursorOrFoodTool).
  if (fanAimingMoveData != null) return true;
  return state.ui.selectedTool === `build:${fanAimingCell.buildingId}`;
}

// Right-click-to-move — reworked from the old Fan-only re-aim mechanic
// (which just edited an already-placed Fan's angle in place) into a general
// "pick up and put down" move, per direct request ("make it so that all
// other buildings can be right clicked... it creates a ghost copy of the
// building on the cursor that lights up when it's in a spot that the...
// building can be moved to"). Right-clicking a placed tile immediately
// vacates it (Grid.js's pickUpBuildingForMove) — its own OLD spot then
// reads as a perfectly valid destination too, per direct clarification
// ("the red hue... doesn't count for the original space... any building can
// be right clicked and left clicked in the same place to pick it up and put
// it down in the same place") — and follows the cursor as a translucent
// ghost of that exact building (render()'s own draw call, below), tinted
// green/red by whether the hovered tile is currently legal. A left-click on
// a valid tile completes the move there for free — EXCEPT a Fan, which
// still needs its own angle chosen afterward (see fanAimingMoveData below,
// which threads the moved building's data through the exact same two-click
// aiming flow a brand-new Fan placement already uses). A right-click while
// a move is in progress cancels it, putting the building right back exactly
// where it started. Per direct spec, picking a building up resets any
// in-progress processing state completely (Grid.js's
// resetBuildingProcessingState) — the only thing carried over for a
// Manufacturer/Power Plant is the player's own chosen recipe; a Fan/
// Collector's angle and a Turret's ammo/cooldown, having nothing to do with
// a specific held item, pass through untouched either way. Picking a
// building up also naturally releases anything it was mid-processing/
// holding back into the world — per direct request ("moving any building
// spits out the items being processed or held, if any") — with no extra
// code needed for THAT part: the moment its tile/buildingData entry is
// gone, Grid.js's stepHeldItem/stepCollectorProcessing already detect that
// on their own very next tick and hand the item back to normal physics
// completely independently of the item, unaware the building even still
// exists elsewhere now — the same defensive fallback that already covers a
// building being demolished mid-hold — resetBuildingProcessingState above
// is the real bug fix on top of it: without it, the building's own
// progress/heldItemId kept pointing at that same, now-elsewhere item, which
// could later cause it to vanish for no visible reason once that stale
// timer ran out.
// Ctrl+Z undo (place/move/sell) — per direct request ("cheap insurance
// against misclicks"). Module-local, not part of `state` — undo history
// doesn't need to survive a save/load round-trip, same precedent
// draggedItemId/recipeDragSourceKey etc. already follow. A 'demolish'
// entry's own snapshot is deep-cloned via a JSON round-trip (safe, since
// buildingData is already required to be JSON-serializable — see
// CLAUDE.md's State Shape rules) so a later live mutation of the real
// tile can't retroactively corrupt the stored undo entry.
const UNDO_STACK_MAX = 20;
let undoStack = [];

// main.js's own local notification-push helper (this file's two remaining
// direct call sites, both one-time flag-gated messages) — a thin wrapper
// around Notifications.js's own pushGameNotification, the one real, shared
// implementation of the push+cap+dedupe+timestamp logic (see that file's
// own comment), kept as a same-named local helper per CLAUDE.md's Rolling
// Notification Log convention.
function pushMainNotification(state, text) {
  pushGameNotification(state, text);
}

function undoActionLabel(type) {
  if (type === 'place') return 'Undo Place';
  if (type === 'move') return 'Undo Move';
  if (type === 'demolish') return 'Undo Sell';
  if (type === 'replace') return 'Undo Replace';
  return 'Undo';
}

function pushUndoEntry(entry) {
  undoStack.push(entry);
  if (undoStack.length > UNDO_STACK_MAX) undoStack.shift();
  state.ui.undoAvailable = true;
  state.ui.undoLabel = undoActionLabel(entry.type);
}

// Reverses whatever the most recent recorded action was. A move/demolish
// undo can legitimately fail (the destination/original tile got built on
// again in the meantime) — silently no-ops rather than crashing or
// clobbering whatever's there now, the same "just don't complete it"
// fallback canPlaceTile-gated actions elsewhere already use.
function performUndo() {
  const entry = undoStack.pop();
  state.ui.undoAvailable = undoStack.length > 0;
  state.ui.undoLabel = state.ui.undoAvailable ? undoActionLabel(undoStack[undoStack.length - 1].type) : null;
  if (!entry) return;
  if (entry.type === 'place') {
    removeTile(state, entry.col, entry.row);
  } else if (entry.type === 'move') {
    const picked = pickUpBuildingForMove(state, entry.toCol, entry.toRow);
    if (picked) {
      const result = putDownMovedBuilding(state, entry.fromCol, entry.fromRow, picked.type, picked.data);
      if (!result.ok) putDownMovedBuilding(state, entry.toCol, entry.toRow, picked.type, picked.data); // couldn't go back — put it right back where undo found it rather than losing it
    }
  } else if (entry.type === 'demolish') {
    const result = putDownMovedBuilding(state, entry.col, entry.row, entry.buildingId, entry.data);
    if (result.ok) state.level.money = Math.max(0, state.level.money - entry.refund);
  } else if (entry.type === 'replace') {
    // Silently clears whatever the new building is now (pickUpBuildingForMove
    // — no sound, no refund, unlike removeTile) before restoring the OLD
    // building+data in its place, then reversing exactly the net cost the
    // replace itself charged (which can itself have been negative, i.e. a
    // profit at the time — reversing it here correctly takes that back too).
    pickUpBuildingForMove(state, entry.col, entry.row);
    const result = putDownMovedBuilding(state, entry.col, entry.row, entry.oldBuildingId, entry.oldData);
    // The forward action did `money -= netCost` — reversing it is `+=`, not
    // another `-=` (which would silently apply the SAME delta a second time
    // instead of cancelling it out; a real sign bug caught in testing).
    if (result.ok) state.level.money += entry.netCost;
  }
}

// Deletes a placed tile via a full refund, the same way removal always has,
// but first snapshots it (type/instance-data/the exact refund actually
// paid) so performUndo can restore it later, and posts a floating "+$xx"
// over it, same as picking up a coin — per direct request ("give a full
// refund, and have the floating '+$xx' show up, like when you pick up a
// coin"). Every real player-triggered deletion (updateKeyDDelete's own
// single-press-or-hold-and-drag mechanic, below) routes through this
// instead of calling Grid.js's removeTile directly — the internal undo-entry
// `type` string stays 'demolish' (an old name for this exact action, kept
// stable as a plain identifier the same way this project keeps other
// internal ids across a rename) even though there's no standalone Demolish
// tool left to name it after.
function recordAndRemoveTile(col, row) {
  const existingType = getTile(state.level.grid, col, row);
  if (!existingType || existingType === TILE_EMPTY) { removeTile(state, col, row); return; }
  const existingData = state.level.buildingData[`${row},${col}`];
  const clonedData = existingData ? JSON.parse(JSON.stringify(existingData)) : null;
  const moneyBefore = state.level.money;
  const removed = removeTile(state, col, row);
  if (!removed) return;
  const refund = state.level.money - moneyBefore;
  pushUndoEntry({ type: 'demolish', col, row, buildingId: existingType, data: clonedData, refund });
  const worldX = col * TILE_SIZE + TILE_SIZE / 2;
  const worldY = row * TILE_SIZE + TILE_SIZE / 2;
  state.level.floatingTexts.push(createPickupText(worldX, worldY, `+$${refund}`, getCoinColor(refund)));
}

let movingBuilding = null; // { fromCol, fromRow, buildingId, data } | null

// Only non-null while the SECOND half of a moved Fan's own two-click aiming
// flow (fanAimingCell, below) is running FOR A MOVE rather than a brand-new
// placement — fanAimingMoveData is the Fan's own preserved buildingData
// object (so its angle field can just be overwritten and reused instead of
// building a fresh one), and fanAimingMoveOrigin is where to put it back if
// that aiming step gets cancelled (Escape/right-click) — it was already
// picked up off the grid the moment the move began, so "cancel" here means
// restore it at its ORIGINAL tile, not just abandon the pending aim the way
// cancelling a genuine new placement's aiming step already does.
let fanAimingMoveData = null;
let fanAimingMoveOrigin = null; // { fromCol, fromRow } | null

// Called every tick from update() — the only thing a move genuinely needs
// checked continuously (the ghost itself is drawn fresh every render()
// frame straight off movingBuilding, no separate live-update needed). Its
// one job: if the player does something that arms a build:/fish:/merge/
// blueprint tool while a move is in progress — opens the shop and picks
// something, hits a tool hotkey, whatever — auto-cancel and put the
// building back, the same self-healing spirit isFanAimingActive() already
// has for its own tool check, rather than leaving a picked-up building in
// limbo with nowhere to go. isCursorOrFoodTool (not a literal 'food' check)
// since selecting either of the two neutral tools mid-move is fine — a move
// is armed from the cursor OR the Food tool alike, see middleClickHandlers.
function updateBuildingMove() {
  if (movingBuilding != null && !isCursorOrFoodTool(state.ui.selectedTool)) {
    putDownMovedBuilding(state, movingBuilding.fromCol, movingBuilding.fromRow, movingBuilding.buildingId, movingBuilding.data);
    movingBuilding = null;
  }
  // Same self-healing for a moved Fan's own angle-choosing step — it never
  // changes selectedTool away from the cursor/Food tool itself (see
  // isFanAimingActive's own comment), so this is what actually catches "the
  // player did something that should cancel this" for that case, restoring
  // the Fan at its ORIGINAL spot since it was already picked up off the grid.
  if (fanAimingCell != null && fanAimingMoveData != null && !isCursorOrFoodTool(state.ui.selectedTool)) {
    putDownMovedBuilding(state, fanAimingMoveOrigin.fromCol, fanAimingMoveOrigin.fromRow, fanAimingCell.buildingId, fanAimingMoveData);
    fanAimingCell = null;
    fanAimingMoveData = null;
    fanAimingMoveOrigin = null;
  }
}

// Per direct request: a Build or Blueprint tool can't do anything in open
// water anyway — every building still has to be placed within the seabed
// band — so the cursor icon, ghost preview, and click behavior all default
// back to Food while hovering open water with one of those two tools
// selected. Crucially, state.ui.selectedTool itself is NEVER changed by
// this — only what a click/hover DOES is reinterpreted — so a building
// stays armed exactly as selected the moment the cursor comes back down to
// the seabed, no need to reselect it in the shop. Fish
// and Merge are deliberately excluded, since both are genuinely used in
// open water and should stay exactly as selected everywhere. Shared by the
// click handler, updateBuildDrag, the cursor icon, and the ghost-preview
// render branch below, so all four can never drift out of sync with each
// other. The old standalone Demolish tool used to be listed here too —
// removed along with the tool itself, folded into the Food tool's own
// D-hotkey delete (updateKeyDDelete), which needs no such carve-out since
// there's simply nothing to delete above the seabed band anyway.
function effectiveToolAt(worldY) {
  const rawTool = state.ui.selectedTool;
  if (worldY < SEABED_FLOOR_Y && (rawTool.startsWith('build:') || rawTool === 'blueprint')) return 'food';
  return rawTool;
}

input.clickHandlers.push((sx, sy) => {
  if (fishDragArmed) { fishDragArmed = false; return; } // this click followed a fish-combine drag gesture — don't also bank/feed/mound-click at the release point
  if (itemDragMoved) { itemDragMoved = false; return; } // this click followed a genuine item-drag gesture — don't also bank/feed/place at the release point. An unmoved press-release leaves itemDragMoved false, so a plain click on a Coin/Science item still banks it normally
  if (recipeDragMoved) { recipeDragMoved = false; return; } // this click followed a genuine Manufacturer/Power Plant recipe-copy drag — don't also open the recipe pop-up at the release point
  if (platformFilterDragMoved) { platformFilterDragMoved = false; return; } // this click followed a genuine Platform filter-copy drag — don't also open the filter pop-up at the release point
  if (chestAimDragMoved) { chestAimDragMoved = false; return; } // this click followed a genuine Storage Chest aim-drag — don't also open the chest's info popup at the release point
  if (blueprintJustCaptured) { blueprintJustCaptured = false; return; } // this click is the tail end of the mouseup that just captured a Blueprint selection — don't also try to paste it at that same point
  if (suppressTutorialTurretPlacementClick) {
    // The same native mouseup/click that just placed the tutorial's own
    // Waste Turret (via updateBuildDrag's drag-placement path) — per direct
    // report, this click would otherwise ALSO open the building-info
    // pop-up on the tile it just placed, since updateBuildDrag already reset
    // selectedTool back to 'cursor' (deselecting the shop) before this click
    // fires, which strips the "!effectiveTool.startsWith('build:')" guard
    // below that normally protects an ordinary placement's own click.
    suppressTutorialTurretPlacementClick = false;
    return;
  }
  if (suppressRecipeMenuAfterPlacementClick) {
    // The same native mouseup/click that just placed a fresh Manufacturer or
    // Power Plant — see this flag's own comment above for why it would
    // otherwise immediately reopen that building's own recipe pop-up.
    suppressRecipeMenuAfterPlacementClick = false;
    return;
  }
  const world = screenToWorld(sx, sy, state.camera);

  // A right-click already picked a building up for a move — a left-click
  // anywhere finishes the gesture, checked before everything else below so
  // it can never also bank a coin/feed/place under it (same priority the
  // old fan-reaim confirm already had). A Fan needs one more click (its own
  // angle) — see fanAimingMoveData's own comment — so confirming its
  // destination here just threads it into the existing two-click aiming
  // flow (fanAimingCell) instead of finishing outright.
  if (movingBuilding != null) {
    const { col, row } = worldToTile(world.x, world.y);
    if (FAN_BUILDING_IDS.includes(movingBuilding.buildingId)) {
      const check = canPlaceTile(state, col, row, movingBuilding.buildingId, true);
      if (!check.ok) { handleBuildPlacementFailure(check.reason); return; }
      fanAimingCell = { col, row, buildingId: movingBuilding.buildingId };
      fanAimingMoveData = movingBuilding.data;
      fanAimingMoveOrigin = { fromCol: movingBuilding.fromCol, fromRow: movingBuilding.fromRow };
      movingBuilding = null;
      return;
    }
    const result = putDownMovedBuilding(state, col, row, movingBuilding.buildingId, movingBuilding.data);
    if (!result.ok) { handleBuildPlacementFailure(result.reason); return; } // stay in move mode — the ghost keeps following, try again
    if (movingBuilding.fromCol !== col || movingBuilding.fromRow !== row) {
      pushUndoEntry({ type: 'move', fromCol: movingBuilding.fromCol, fromRow: movingBuilding.fromRow, toCol: col, toRow: row });
    }
    movingBuilding = null;
    return;
  }

  // Blueprint stamp — a captured selection is armed and follows the cursor
  // (render()'s own draw call below); a plain click commits it, placing
  // every captured cell that's both empty and affordable at its own real
  // (cost-charged) price, silently skipping any cell that isn't — see
  // Grid.js's placeBlueprint. One Ctrl+Z undo entry per building actually
  // placed, same as any other individual purchase. The clipboard clears
  // after commit, ready for a fresh drag-select — the tool itself stays
  // selected. Shift-click Replace (per direct request) routes the exact
  // same click through placeBlueprintWithReplace instead — still genuinely
  // all-or-nothing, just netting each occupied cell's refund against the
  // stamp's total cost first ("the player still needs to be able to afford
  // the whole cost of the blueprint with the added funds of the replaced
  // buildings for any of the blueprint to paste").
  if (blueprintClipboard != null) {
    const { col, row } = worldToTile(world.x, world.y);
    const blueprintShiftHeld = isShiftHeld();
    if (blueprintShiftHeld) {
      const result = placeBlueprintWithReplace(state, col, row, blueprintClipboard, true);
      if (!result.affordable) {
        flashMoneyInsufficient(state);
        showBuildError("Can't afford");
        return;
      }
      for (const p of result.placedCells) {
        if (p.replaced) {
          pushUndoEntry({ type: 'replace', col: p.col, row: p.row, oldBuildingId: p.oldBuildingId, oldData: p.oldData, netCost: p.netCost });
        } else {
          pushUndoEntry({ type: 'place', col: p.col, row: p.row, buildingId: p.buildingId });
        }
      }
      // Combined sound effects and floating refund number, per direct
      // request — ONE demolish (only if any cell actually replaced
      // something) and ONE build-place, not one pair per replaced tile;
      // ONE floating net-cost readout for the whole paste, at the click
      // point, rather than a separate number per cell.
      if (result.placedCells.length > 0) {
        if (result.anyReplace) playDemolish();
        playBuildPlace();
        showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, result.netCost);
      }
      blueprintClipboard = null;
      return;
    }
    const totalCost = computeBlueprintCost(state, col, row, blueprintClipboard);
    if (totalCost > state.level.money) {
      // All-or-nothing: an unaffordable paste attempt is rejected outright,
      // same red-flash/cursor-text feedback an ordinary unaffordable single
      // placement already gets — but the clipboard survives the rejection so
      // the player can retry once they've got enough money, rather than
      // losing the whole captured stamp on a single wasted click.
      flashMoneyInsufficient(state);
      showBuildError("Can't afford");
      return;
    }
    const placedCells = placeBlueprint(state, col, row, blueprintClipboard);
    for (const p of placedCells) pushUndoEntry({ type: 'place', col: p.col, row: p.row, buildingId: p.buildingId });
    blueprintClipboard = null;
    return;
  }

  // Alien Invasion: clicking a living alien always does ALIEN_CLICK_DAMAGE,
  // regardless of the currently selected tool — same "always works,
  // whatever's selected" precedent coin-banking (below) already has.
  // Checked first so it can't be shadowed by a build tool's own early-return
  // branches.
  for (const entity of state.level.entities) {
    // spawnProtectionUntilMs: a freshly Alien-Egg-hatched alien is
    // invulnerable to clicks too during its grace period — see
    // Entities.js's updateAlienEgg/createAlien.
    if (entity.type !== 'alien' || entity.hp <= 0) continue;
    if (entity.spawnProtectionUntilMs > state.level.elapsed) continue;
    if (Math.hypot(entity.x - world.x, entity.y - world.y) <= (entity.radius ?? ALIEN_RADIUS) * ALIEN_CLICK_RADIUS_MULTIPLIER) {
      entity.hp -= ALIEN_CLICK_DAMAGE;
      entity.lastDamageSource = 'click'; // turret_kills_25 achievement — see Entities.js's updateAlien death branch, checked only at the moment of an actual kill
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

  // Magnet Fish/Feeder Fish/Xeno Octopus each have an on/off ability toggle
  // (magnet, auto-Food dispenser, Bio-Sludge mode) — per direct request, a
  // single click on any fish now opens its info modal instead (see the
  // generic fallback further below), so toggling one of these abilities
  // now needs a genuine DOUBLE-click to disambiguate from that. A first
  // click on one of these 3 species is deferred (setTimeout) rather than
  // acted on immediately: if a second click on the SAME fish lands within
  // FISH_DOUBLE_CLICK_MS, that's the real double-click — toggle the
  // ability and cancel the pending open; otherwise the timer fires on its
  // own and opens the info modal, exactly as an ordinary single click on
  // any other fish already would.
  const clickedFish = findFishAt(state, world.x, world.y);
  if (clickedFish && TOGGLEABLE_FISH_SPECIES.includes(clickedFish.speciesId)) {
    if (pendingFishToggleClickId === clickedFish.id) {
      clearTimeout(pendingFishToggleClickTimeout);
      pendingFishToggleClickId = null;
      pendingFishToggleClickTimeout = null;
      toggleFishAbility(state, clickedFish);
      return;
    }
    pendingFishToggleClickId = clickedFish.id;
    const fishId = clickedFish.id;
    pendingFishToggleClickTimeout = setTimeout(() => {
      pendingFishToggleClickId = null;
      pendingFishToggleClickTimeout = null;
      const fish = state.level.entities.find((e) => e.id === fishId && e.type === 'fish');
      if (fish && !state.ui.paused && !state.level.tutorialFlow) {
        openFishInfoMenu(state, fishId);
      }
    }, FISH_DOUBLE_CLICK_MS);
    return;
  }

  // Catalyst Fish: click arms it for linking (and, if it's already linked
  // to something, also flashes that building so its current link is
  // visible) — per direct spec, "click the fish, then click a building to
  // link them... click the fish again [to] have the linked building
  // flash... but also click a different building to relink it instead."
  if (clickedFish && clickedFish.speciesId === 'catalyst_fish') {
    catalystArmedFishId = clickedFish.id;
    clickedFish.catalystFlashUntilMs = state.level.elapsed + CATALYST_FLASH_DURATION_MS;
    if (clickedFish.linkedBuildingKey) {
      const linkedData = state.level.buildingData[clickedFish.linkedBuildingKey];
      if (linkedData) linkedData.catalystFlashUntilMs = state.level.elapsed + CATALYST_FLASH_DURATION_MS;
    }
    return;
  }

  // Second half of the Catalyst Fish flow — a fish is currently armed
  // (from the branch above, on a PREVIOUS click) and this click lands on a
  // real building tile: link them (replacing any previous link this fish
  // had, so it's "never locked to a building forever" per spec), flash
  // both, and clear the armed state. Left armed (not cancelled) if this
  // click doesn't land on a building, so a stray click elsewhere doesn't
  // lose the in-progress gesture.
  if (catalystArmedFishId !== null) {
    const armedFish = state.level.entities.find((e) => e.id === catalystArmedFishId && e.type === 'fish');
    const { col, row } = worldToTile(world.x, world.y);
    const tile = getTile(state.level.grid, col, row);
    if (armedFish && tile && tile !== TILE_EMPTY) {
      const newKey = `${row},${col}`;
      armedFish.linkedBuildingKey = newKey;
      armedFish.catalystFlashUntilMs = state.level.elapsed + CATALYST_FLASH_DURATION_MS;
      state.level.buildingData[newKey].catalystFlashUntilMs = state.level.elapsed + CATALYST_FLASH_DURATION_MS;
      catalystArmedFishId = null;
      return;
    }
  }

  // A Fan's click-2 must work regardless of where it lands — including open
  // water, e.g. aiming a Fan's cone straight up into the water column, a
  // completely normal thing to do — so this is checked BEFORE the
  // open-water "defaults to Food" override below, and can never be
  // shadowed by it. isFanAimingActive() already self-heals against a tool
  // switch (see its own comment), so this is only ever true while the
  // exact fan that was armed is still the selected tool.
  if (isFanAimingActive()) {
    const buildingId = fanAimingCell.buildingId;
    const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, world.x, world.y);
    // A moved Fan's own destination was already validated (ignoring cost)
    // back when the move's first click confirmed it — this second click
    // just writes it back down for free with its own preserved data, angle
    // overwritten to whatever's showing now. A genuine new placement (no
    // move in progress) is completely unchanged below.
    if (fanAimingMoveData != null) {
      const check = canPlaceTile(state, fanAimingCell.col, fanAimingCell.row, buildingId, true);
      if (check.ok) {
        fanAimingMoveData.angle = angle;
        putDownMovedBuilding(state, fanAimingCell.col, fanAimingCell.row, buildingId, fanAimingMoveData);
        if (fanAimingMoveOrigin.fromCol !== fanAimingCell.col || fanAimingMoveOrigin.fromRow !== fanAimingCell.row) {
          pushUndoEntry({ type: 'move', fromCol: fanAimingMoveOrigin.fromCol, fromRow: fanAimingMoveOrigin.fromRow, toCol: fanAimingCell.col, toRow: fanAimingCell.row });
        }
      } else {
        handleBuildPlacementFailure(check.reason);
      }
      fanAimingCell = null;
      fanAimingMoveData = null;
      fanAimingMoveOrigin = null;
      return;
    }
    // Per direct request, the purchase/replace already happened on click 1
    // below — this second click is now purely a free angle re-aim on the
    // ALREADY-PLACED fan (no cost, no affordability check, nothing to
    // undo beyond the original placement). A same-family Fan-on-Fan
    // replace never even reaches this branch — see click 1's own comment.
    const data = state.level.buildingData[`${fanAimingCell.row},${fanAimingCell.col}`];
    if (data) data.angle = angle;
    fanAimingCell = null;
    return;
  }

  // Per direct request, a Build tool defaults to Food while the click lands
  // in open water — see effectiveToolAt's own comment. Every branch below
  // reads this instead of state.ui.selectedTool directly.
  const effectiveTool = effectiveToolAt(world.y);

  if (effectiveTool.startsWith('build:')) {
    const buildingId = effectiveTool.slice('build:'.length);
    if (FAN_BUILDING_IDS.includes(buildingId)) {
      // Click 1 IS the purchase/replace now, per direct request ("the
      // purchase for any fan should happen on the first click or
      // shift-click, it shouldn't be able to be placed at all if it's not
      // afforded, and the purchase/replacement should happen on the first
      // click, with the second click just to confirm the angle"). Nothing
      // is armed/charged at all if describeReplacement rejects it outright.
      const { col, row } = worldToTile(world.x, world.y);
      const shiftHeld = isShiftHeld();
      const check = describeReplacement(state, col, row, buildingId, shiftHeld);
      if (!check.ok) { handleBuildPlacementFailure(check.reason); return; }
      if (check.replacing && check.sameFamily) {
        // Fan-on-Fan replace, per direct request ("shift click once on a
        // placed fan when placing another fan is all that's needed... it
        // will inherit the fan angle from the replaced fan") — one single
        // Shift-click does the whole thing, no click 2 at all. The angle
        // argument here is irrelevant and ignored — applyReplacementMutation's
        // own same-family branch keeps the OLD fan's data (including its
        // angle) untouched apart from retyping it, which is exactly the
        // inherited-angle behavior requested.
        const result = placeTileWithReplace(state, col, row, buildingId, 0, shiftHeld);
        if (result.placed) {
          pushUndoEntry({ type: 'replace', col, row, oldBuildingId: result.oldBuildingId, oldData: result.oldData, netCost: result.info.netCost });
          showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, result.info.netCost);
        }
        return;
      }
      // A fresh placement or a cross-family replace still needs its own
      // angle chosen — charge now (using the cursor's current sub-tile
      // angle as the initial aim), then arm fanAimingCell so click 2 above
      // can freely re-aim it before it's final, at no extra cost.
      const angle = angleFromTileToPoint(col, row, world.x, world.y);
      const result = placeTileWithReplace(state, col, row, buildingId, angle, shiftHeld);
      if (!result.placed) { handleBuildPlacementFailure(result.info.reason); return; }
      if (result.replaced) {
        pushUndoEntry({ type: 'replace', col, row, oldBuildingId: result.oldBuildingId, oldData: result.oldData, netCost: result.info.netCost });
        showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, result.info.netCost);
      } else {
        pushUndoEntry({ type: 'place', col, row, buildingId });
      }
      fanAimingCell = { col, row, buildingId };
      return; // either way, a fan-tool click never falls through to mound/coin/food
    }
  }

  // Per direct request: a coin sitting in front of (i.e. overlapping) the
  // Mound/Science Lab's own click area gets the click consumed on IT first
  // — the Mound is ignored entirely that click, not just deprioritized —
  // so banking a coin isn't ever mistaken for a Mound-menu-open because it
  // happened to be resting in the wrong spot. Checked ahead of the Mound/
  // Lab hit-tests below (previously the other way around). Science/Green
  // Science are no longer click-bankable at all, per direct request ("blue
  // and green science cannot be clicked to be collected, it has to be
  // processed by a collector") — tryBankScienceAt/tryBankScienceGreenAt are
  // gone from this handler entirely; a Science item can still be dragged
  // (the universal item-drag mechanic) into a Collector by hand, or left to
  // drift into one on its own via a Fan.
  if (tryBankCoinAt(state, world.x, world.y)) return; // clicking a coin always banks it, regardless of selected tool
  if (isPointOnMound(state, world.x, world.y)) { openMoundMenu(state); return; } // opens the "Throw money at it" popup — see UI.js
  if (isPointOnScienceLab(state, world.x, world.y)) { openLabMenu(state); return; } // Phase 4 — the Mound's replacement once it's fully shattered
  // A placed Manufacturer/Power Plant opens its recipe pop-up menu on click
  // — per direct spec, works regardless of the currently selected tool
  // (same as the Mound/Lab above), except a genuine drag gesture (already
  // returned at the top of this handler).
  const recipeBuildingKey = getRecipeBuildingKeyAt(state, world.x, world.y);
  if (recipeBuildingKey) { openRecipeMenu(state, recipeBuildingKey); return; }
  // Every OTHER placed building opens a generic read-only info pop-up
  // instead — per direct request ("any building can be quickly clicked on
  // to see what it is and what it does"). Deliberately gated on NOT
  // currently holding a build tool (unlike the Manufacturer/Power Plant
  // recipe pop-up above, which intentionally ignores the tool) — a build
  // tool's own drag-placement (updateBuildDrag) already fires on mousedown,
  // before this click even runs, so without this guard, single-clicking an
  // EMPTY cell to place a fresh building would immediately pop this info-
  // modal open right over top of what you just built.
  if (!effectiveTool.startsWith('build:')) {
    // A placed Platform (any of its 5 variants) opens its own item-filter
    // pop-up instead of the generic building-info one — per direct request
    // ("when you left click a platform, it opens the filter modal"), checked
    // first so a Platform never falls through to the generic info popup.
    const platformFilterKey = getPlatformFilterKeyAt(state, world.x, world.y);
    if (platformFilterKey) { openPlatformFilterMenu(state, platformFilterKey); return; }
    // A placed Storage Chest opens its own readout popup the same way — per
    // direct request ("the player should still be able to click the storage
    // chest for the building modal to popup"), also checked ahead of the
    // generic info popup below.
    const chestKey = getChestKeyAt(state, world.x, world.y);
    if (chestKey) { openStorageChestModal(state, chestKey); return; }
    const buildingInfo = getBuildingInfoKeyAt(state, world.x, world.y);
    if (buildingInfo) { openBuildingInfoMenu(state, buildingInfo.key); return; }
    // Every fish opens its own read-only info modal on a plain click — per
    // direct request ("click on every fish... to bring up the fish modal
    // like the building modal"). Only reached here for a species with no
    // more specific single-click job of its own (Catalyst Fish's own
    // click-to-arm-link above already returned first; a toggle-capable
    // fish's click is deferred through the double-click check above and
    // only ever reaches openFishInfoMenu through ITS OWN timeout, never
    // through this line).
    if (clickedFish) { openFishInfoMenu(state, clickedFish.id); return; }
  }
  // Per direct request ("the default cursor CANNOT drop food. The food tool
  // has to be selected to drop food") — this is the ONE and only place Food
  // ever gets dropped, strictly gated on the literal 'food' tool (never the
  // plain 'cursor' default, even though the two are otherwise
  // interchangeable everywhere else — see UI.js's isCursorOrFoodTool).
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

// Magnet Fish: right-click opens its own item-filter pop-up (which object
// types its magnet, when toggled on, actually attracts) — per direct
// request ("right click on the buffer fish, bring up a filter modal like on
// platforms"), the right-click counterpart to the plain left-click on/off
// toggle above. Checked first, ahead of every other right-click handler
// below, so it can't be shadowed by the universal-cancel handler's own
// closeSidePanels/cancelActiveTool (neither of which touch this pop-up
// anyway, but checked first for the same "most specific gesture wins"
// precedent every other right-click branch here follows).
input.rightClickHandlers.push((sx, sy) => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  const world = screenToWorld(sx, sy, state.camera);
  const fish = findFishAt(state, world.x, world.y);
  if (fish && fish.speciesId === 'buffer_fish') openMagnetFishFilterMenu(state, fish.id);
});

// Blueprint tool: right-click cancels an in-progress selection (drag) or an
// already-captured clipboard armed for pasting — back to a clean slate,
// ready for a new drag-select, without leaving the tool itself.
input.rightClickHandlers.push(() => {
  if (state.ui.paused) return;
  blueprintDragStartCol = null;
  blueprintDragStartRow = null;
  blueprintClipboard = null;
});

// Cancel an in-progress building move — see movingBuilding's own comment
// above. Whichever of the two "something's in progress" states applies — a
// plain pick-up-in-progress (movingBuilding), or a moved Fan's own angle-
// choosing step (fanAimingMoveData) — puts the building back at its
// original spot with its own data completely untouched either way. Arming a
// NEW move moved to middle-click, per direct request ("right-click to move
// is changed to middle-click to move") — see middleClickHandlers below;
// cancelling one already in progress deliberately STAYED on right-click,
// per the later "make right-click a universal cancel button" request.
input.rightClickHandlers.push(() => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  if (movingBuilding != null) {
    putDownMovedBuilding(state, movingBuilding.fromCol, movingBuilding.fromRow, movingBuilding.buildingId, movingBuilding.data);
    movingBuilding = null;
    return;
  }
  if (isFanAimingActive() && fanAimingMoveData != null) {
    putDownMovedBuilding(state, fanAimingMoveOrigin.fromCol, fanAimingMoveOrigin.fromRow, fanAimingCell.buildingId, fanAimingMoveData);
    fanAimingCell = null;
    fanAimingMoveData = null;
    fanAimingMoveOrigin = null;
  }
});

// Universal cancel, per direct request ("make right-click a universal
// cancel button. Right-click should clear a fish/building/tool that's
// selected, and default back to just a cursor"). Mirrors the Escape key's
// own "somethingSelected" branch (closeSidePanels + cancelActiveTool) with
// no pause-menu fallback — a right-click with nothing to cancel is just a
// plain no-op, unlike Escape which opens the pause menu in that case. Runs
// every right-click alongside the two handlers above, so cancelling an
// in-progress move ALSO clears whatever tool was armed at the same time —
// one right-click genuinely clears everything back to the plain cursor.
input.rightClickHandlers.push(() => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  closeSidePanels(state);
  cancelActiveTool(state);
  // A Fan's pending angle-adjust step (fanAimingCell) isn't itself part of
  // selectedTool, so cancelActiveTool above clearing the tool back to
  // 'cursor' only makes isFanAimingActive() self-heal to false — the stale
  // {col, row, buildingId} it left behind was still sitting here, so
  // pressing Q right afterward (which just reselects state.ui.lastArmedTool)
  // reactivated THIS same old angle-adjust step instead of starting a fresh
  // placement under the cursor. Per direct bug report (from back when click
  // 2 was still the real purchase): right-click must fully cancel it, no
  // lingering spot for a later Q to pull back up. The Fan itself is already
  // real/bought by this point now (purchase moved to click 1) — this just
  // stops the free angle re-aim, it never un-places anything.
  fanAimingCell = null;
});

// Middle-click-to-move — see movingBuilding's own comment above. Only arms
// from the cursor/Food tool (matching the hover legend's own gating below,
// isCursorOrFoodTool) — a build/fish/merge tool has its own unrelated
// interactions and shouldn't also start a move.
input.middleClickHandlers.push((sx, sy) => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  if (movingBuilding != null || (isFanAimingActive() && fanAimingMoveData != null)) return; // a move's already in progress — middle-click isn't a second gesture on top of it
  if (!isCursorOrFoodTool(state.ui.selectedTool)) return;
  const world = screenToWorld(sx, sy, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  const picked = pickUpBuildingForMove(state, col, row);
  if (!picked) return;
  movingBuilding = { fromCol: col, fromRow: row, buildingId: picked.type, data: picked.data };
});

// Build-mode drag-placement: while the left button is held and a build tool
// is selected, place a tile under the cursor once per tile cell entered
// (not once per physics tick) so dragging across several cells lays a row
// without re-spending money on a cell it's already sitting over.
let lastBuildCell = null;

// D-hotkey delete, including hold-and-drag — per direct request ("remove
// the demolish tool... have it built into the food cursor tool via the D
// hotkey... make it so that you can hold D and drag over multiple
// buildings to delete them all via drag-to-delete just like drag-to-
// place"). Mirrors updateBuildDrag's own "once per newly-entered cell, not
// once per physics tick" shape exactly — see updateKeyDDelete below — just
// gated on input.keysDown.has('KeyD') instead of a selected tool/held mouse
// button, so a single tap deletes whatever's under the cursor that instant
// (the very first "newly-entered cell" the moment KeyD becomes held) and
// holding it while moving the mouse sweeps across more. removeTile is
// already a safe no-op on an empty cell (returns false, no refund/sound/
// floating-text — see Grid.js and recordAndRemoveTile above), so this
// doesn't need its own occupancy check before calling it.
let lastKeyDDeleteCell = null;

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

// One combined floating readout for a Shift-click Replace's net cost — per
// direct request ("make the sound effects and floating refund numbers
// combine together"), a single number rather than a separate "-$cost" and
// "+$refund" pair. Negative netCost means the player profited (refund
// exceeded the new building's cost) — shown as a green-tinted "+$", same
// getCoinColor value-tier convention every other coin/refund readout uses;
// a positive netCost is the amount actually charged, shown as a flat red
// "-$"; exactly $0 (a same-family free tier-swap, or a lucky exact wash)
// just reads "$0".
function showReplaceNetCostText(worldX, worldY, netCost) {
  if (netCost === 0) {
    state.level.floatingTexts.push(createPickupText(worldX, worldY, '$0', '#cfd8e3'));
  } else if (netCost < 0) {
    const gain = -netCost;
    state.level.floatingTexts.push(createPickupText(worldX, worldY, `+$${gain}`, getCoinColor(gain)));
  } else {
    state.level.floatingTexts.push(createPickupText(worldX, worldY, `-$${netCost}`, '#ff6b6b'));
  }
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
  // The fish info modal closes on literally ANY hotkey, per direct request
  // ("Clicking anywhere outside the modal or using any hotkey will close
  // the modal") — checked first, ahead of every other branch below, and
  // deliberately doesn't `return`: whatever hotkey triggered the close
  // still goes on to do its own normal job the same tick (e.g. pressing E
  // both closes the modal AND opens the Shop), rather than needing two
  // separate presses.
  if (state.ui.fishInfoModalFishId != null) closeFishInfoMenu(state);
  // The debug overlay toggle is a pure observability tool, not a gameplay
  // action — deliberately never blocked by anything below (the cinematic
  // intro/tutorial-flow gates included), so it's always reachable for QA.
  if (e.code === 'Backquote') { state.debug.overlayVisible = !state.debug.overlayVisible; return; }
  // Alt-mode, per direct request — same "always reachable" reasoning as the
  // debug overlay above (a pure display toggle, harmless during a tutorial/
  // cinematic/paused menu, and there'd be no way to turn it back OFF if a
  // tutorial or the pause menu could swallow it while it's active).
  // preventDefault stops the browser's own Alt behavior (focusing/opening
  // its menu bar) from firing alongside this.
  if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); toggleAltMode(state); return; }
  // Base Stats panel, per direct request — same "always reachable" reasoning
  // as the debug overlay/Alt-mode above (a pure read-only info view, useful
  // in any state including paused, and there'd be no way to close it again
  // if a tutorial/pause menu could swallow the toggle while it's open).
  // preventDefault stops the browser's own Tab focus-cycling from also
  // firing alongside this.
  if (e.code === 'Tab') { e.preventDefault(); toggleStatsPanel(state); return; }
  // Escape can always skip an active guided tutorial — per direct request
  // ("make sure escape can actually skip any tutorial"), checked here,
  // ahead of the general tutorial-flow hotkey block below, so it's the one
  // exception to "every hotkey is swallowed during a tutorial." Just clears
  // the flow outright — UI.js's updateTutorialOverlay reacts on the very
  // next frame (hides the overlay/text), same as a normal completion.
  if (e.code === 'Escape' && state.level.tutorialFlow) {
    state.level.tutorialFlow = null;
    state.level.wasteDragTutorialTargetId = null; // clear any locked drag-Waste target — see Grid.js's findNearestWasteTurretAndWaste
    state.level.mergeTutorialTargetIds = null; // clear any locked merge-tutorial target pair — see Entities.js's resolveMergeTutorialPair
    return;
  }
  // Per direct request ("Allow the E Hotkey during tutorials to open/close
  // the shop") — the one other exception to "every hotkey is swallowed
  // during a tutorial," alongside Escape's own skip above. Mirrors the real
  // Shop button's own click listener exactly, including its tutorial-advance
  // calls, so a flow currently waiting on "open the Shop" (the game-start
  // and post-alien flows both do) still progresses whether the player used
  // the hotkey or clicked the real button.
  if (e.code === 'KeyE' && state.level.tutorialFlow) {
    toggleShopCollapse(state);
    if (!state.ui.shopCollapsed) {
      advanceTutorialFlow(state, 'start', 'shop');
      advanceTutorialFlow(state, 'postalien', 'shop');
      advanceTutorialFlow(state, 'chest', 'shop');
    }
    return;
  }
  // Guided tutorial flows (see UI.js's TUTORIAL_FLOWS) swallow every OTHER
  // hotkey, same reasoning as the cinematic intro above — the overlay's own
  // click-through "hole" is the only interaction that should work.
  if (state.level.tutorialFlow) return;
  // Per direct request ("make it so the esc hotkey always opens and closes
  // the pause menu, since now we have Q and Right-Click to cover all the
  // canceling/clearing needs") — Escape used to run a whole decision tree
  // (close whatever popup's on top, cancel an armed tool/in-progress move,
  // THEN fall back to the pause menu) exactly like right-click's own
  // universal-cancel handler still does. That's now entirely Q's (clearing
  // an armed tool) and right-click's (clearing a tool AND cancelling an
  // in-progress move/Blueprint-drag) job instead — every popup this used to
  // close (Mound/recipe/building-info/platform-filter/Lab/Lab-purchase) also
  // already closes on a click anywhere outside it, so nothing is stranded
  // without a close path. Escape's own job is simply "toggle the pause
  // menu," full stop, same as the new hamburger button.
  if (e.code === 'Escape') {
    togglePauseMenu(state);
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
    case 'KeyM': // grant $10,000, 20 Tank Points, 500 Science, 500 Green Science, and 100 Fishy Gems, for testing the Mound/Tank Upgrades/Science Lab/Customization panel without grinding
      state.level.money += CHEAT_GRANT_AMOUNT;
      state.level.tankPoints.total += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      state.level.tankPoints.available += CHEAT_TANK_POINTS_GRANT_AMOUNT;
      state.level.science += CHEAT_SCIENCE_GRANT_AMOUNT;
      state.level.scienceGreen += CHEAT_SCIENCE_GREEN_GRANT_AMOUNT; // per direct request, so Green-Science-gated Lab nodes/recipes can be tested without grinding a real Bio-Combuster/Manufacturer cycle
      state.meta.fishyGems += CHEAT_FISHY_GEMS_GRANT_AMOUNT; // per direct request, so the Customization panel's hats can be tested without grinding real achievement claims first
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
    case 'Digit1': // Food — matches the fixed bottom tool-bar's own hotkeys
      selectTool(state, 'food');
      break;
    case 'Digit2': // Merge — moved down to fill the old Demolish slot, per direct request, once Blueprint moved to 3 and Favorites took 4-6
      selectTool(state, 'merge');
      break;
    case 'Digit3': // Blueprint ("Stamp") — moved back to 3 per direct request, freeing 4-6 for the Favorite slots below — see blueprintClipboard's own comment above
      selectTool(state, 'blueprint');
      break;
    case 'Digit4': // Favorite slot 1
      selectFavorite(state, 0);
      break;
    case 'Digit5': // Favorite slot 2
      selectFavorite(state, 1);
      break;
    case 'Digit6': // Favorite slot 3
      selectFavorite(state, 2);
      break;
    case 'KeyF': // Add/Remove Favorite — per direct request
      // Hovering a favorite slot on the toolbar always means "remove
      // whatever's there," regardless of what's currently selected in the
      // shop — checked first; removeFavoriteAtHoveredSlot returns false
      // (a genuine no-op, nothing removed) when the cursor isn't over any
      // slot at all, in which case F instead toggles the CURRENTLY
      // SELECTED shop tool's own favorite status (add if not already one,
      // remove if it is — a no-op for Food/Merge/Blueprint/nothing
      // selected, or if all 3 slots are already full).
      if (!removeFavoriteAtHoveredSlot(state)) toggleFavoriteForSelectedTool(state);
      break;
    case 'KeyZ': // Ctrl+Z — undo the last building place/move/sell
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        performUndo();
      }
      break;
    case 'KeyE': // toggle-collapse the shop panel — moved off KeyQ per direct request, freeing Q up for the Pipette Tool below
      toggleShopCollapse(state);
      break;
    case 'KeyQ': { // Clear Blueprint / Pipette Tool / "last used" fallback / Clear Cursor — per direct request
      // A copied Blueprint takes priority over every other Q meaning below —
      // per direct request ("press Q when you have a blueprint copied to
      // clear a blueprint"), matching the dynamic "Q: Clear Blueprint" legend
      // (UI.js's updateHUD, reading state.ui.blueprintClipboardActive —
      // written every render() frame, see render()'s own comment). Switches
      // back to the plain cursor too, same as the ordinary "Clear Cursor"
      // case below — updateBlueprintToolGate then wipes blueprintClipboard
      // itself the very next tick purely because the tool is no longer
      // 'blueprint', but clearing it here too makes the ghost/ability-to-
      // paste disappear on this exact keypress rather than one tick later.
      if (blueprintClipboard != null) {
        blueprintClipboard = null;
        blueprintDragStartCol = null;
        blueprintDragStartRow = null;
        selectTool(state, 'cursor');
        break;
      }
      // Per direct request, Q is a genuine toggle again: press it over and
      // over to clear the cursor, reselect the last thing, clear again,
      // reselect again... Per a later direct follow-up ("when a tool is
      // selected, the Q hotkey should be consumed by clearing the tool
      // only... another Q is needed for a pipette or last-used hotkey"), ANY
      // armed tool (build:/fish:, but also Merge/Blueprint/Food — not just
      // build:/fish: as before) clears straight back to the plain cursor on
      // this press, matching the "Q: Clear Cursor" legend wording —
      // cancelActiveTool already covers every one of those cases. Only with
      // NOTHING armed (the cursor already selected) does this Q instead
      // Pipette whatever's directly under the cursor (fish checked first —
      // their own hit radius, matching the shimmer effect's size, is
      // usually the larger/more forgiving target — then a placed building),
      // falling back to reselecting whichever build:/fish: tool was last
      // armed (state.ui.lastArmedTool, written by UI.js's
      // selectSpeciesForPreview/selectBuildingForPreview) if nothing
      // qualifies under the cursor either.
      const rawTool = state.ui.selectedTool;
      if (rawTool !== 'cursor') {
        cancelActiveTool(state);
        // Same fix as the right-click universal-cancel handler above, and
        // for the same reason (see its own comment) — cancelActiveTool only
        // clears selectedTool, which just makes isFanAimingActive() self-heal
        // to false for NOW. The stale {col, row, buildingId} left behind
        // would otherwise silently reactivate the instant this exact fan
        // tier is armed again later (Q's own "reselect last tool" branch, a
        // fresh shop click, anything) — per direct bug report, a fan cancelled
        // with Q went right back into aiming its old, already-cancelled spot
        // the next time that tier was picked.
        fanAimingCell = null;
      } else {
        const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
        const fish = findFishForPipetteAt(state, world.x, world.y);
        if (fish) {
          pipetteSelectSpecies(state, fish.speciesId);
        } else {
          const { col, row } = worldToTile(world.x, world.y);
          const tileType = getTile(state.level.grid, col, row);
          if (tileType && tileType !== TILE_EMPTY) {
            pipetteSelectBuilding(state, tileType);
          } else if (state.ui.lastArmedTool) {
            if (state.ui.lastArmedTool.startsWith('fish:')) pipetteSelectSpecies(state, state.ui.lastArmedTool.slice('fish:'.length));
            else if (state.ui.lastArmedTool.startsWith('build:')) pipetteSelectBuilding(state, state.ui.lastArmedTool.slice('build:'.length));
          }
        }
      }
      break;
    }
    case 'KeyR': { // Cycle Platform variants — per direct request
      // Two jobs, mutually exclusive: with a build:/fish: tool armed, R
      // cycles THAT shop selection to its next family tier (the exact same
      // action a 2nd click on the shop slot already performs — see UI.js's
      // cycleSelectedBuildingFamily, generalized to any family, not just
      // Platform, since the mechanism is identical either way). With
      // NOTHING armed, R instead cycles an already-PLACED, merely-hovered
      // Platform tile directly on the grid, for free (Grid.js's
      // cyclePlatformAt) — per direct spec, "only when not selected on a
      // building."
      if (!cycleSelectedBuildingFamily(state)) {
        const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
        cyclePlatformAt(state, world.x, world.y);
      }
      break;
    }
    case 'KeyP': // toggle-collapse the Tank Upgrades panel
      toggleTankPanel(state);
      break;
    case 'KeyT': { // cycle the tile under the cursor through every building type, free
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      cycleTileCheat(state, world.x, world.y);
      break;
    }
    case 'KeyN': { // force-crack the Mound to the next real tier, free
      // Calls the REAL crackMound() repeatedly (topping up money before each
      // call so affordability is never the blocker) until the tier genuinely
      // advances — this walks through the tease and any other paid sub-step
      // for real, exactly like a player clicking the Mound several times
      // would, with zero duplicated knowledge of what each step grants. See
      // Mound.js's getMoundNextCost/crackMound for the current sequence.
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
    case 'KeyY': // force the next Alien Invasion wave to start right now, for testing without waiting out a real ALIEN_WAVE_INTERVAL_EARLY/LATE_MS gap
      state.level.alienNextWaveAtMs = state.level.elapsed;
      break;
    case 'KeyC': // set the countdown to the next Alien Invasion wave to exactly 10s from now — per direct request, for testing the Wave Countdown HUD/warning notifications without waiting out a real 3.5-4.5 minute gap. Touches ONLY alienNextWaveAtMs, same minimal shape as KeyY above — doesn't touch wave size, tier mix, or the difficulty ramp (all computed fresh, from alienWavesSpawned/elapsed, at the moment the wave actually fires), and is silently overwritten by updateAlienWaves' own real scheduling if a wave is already active (the countdown genuinely hasn't started yet in that case, same as it wouldn't for a real player).
      state.level.alienNextWaveAtMs = state.level.elapsed + 10000;
      break;
    case 'Space': // Pause Time — per direct request, same toggle the minimap's own Pause button uses (see UI.js's toggleTimePause)
      e.preventDefault(); // Space's native behavior (activating a focused button, page scroll) would otherwise fight this
      toggleTimePause(state);
      break;
    case 'KeyX': // 2x Speed — per direct request, same toggle the minimap's own 2x button uses (see UI.js's toggleSpeedX2)
      toggleSpeedX2(state);
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
  startGameMusic(); // per direct request — only Start/Continue (both funnel through this one callback) should ever start the music, not Settings/Help
  triggerSplash();
  scheduleShopButtonReminder(state); // per direct request — bounces the shop toggle until it's opened for the first time
  // Game-start guided tutorial (Shop -> Guppy -> buy your first fish) no
  // longer starts here — see the splashTitle 'animationend' handler above,
  // which now starts it START_TUTORIAL_DELAY_AFTER_SPLASH_MS after the
  // splash has actually finished fading away, per direct request.
});

// ---- Loading screen ----
// Per direct request ("add in a loading screen with an adult guppy swimming
// across a loading bar, to make sure everything in the game like the music
// is loaded before the start menu shows up") — #start-overlay starts hidden
// (see index.html) and #loading-overlay (shown by default) is what covers
// the screen until this resolves, at which point it swaps the two.
//
// Sound.js's own Audio() elements for the 3 music tracks aren't created
// until ensureMusicTracks() (itself gated behind the very first real user
// gesture, per browser autoplay policy — see Sound.js's resumeAudio) — so
// rather than reach into that module, this preloads its own throwaway
// Audio() elements pointed at the exact same 3 files purely to warm the
// browser's own HTTP cache. Simply setting .src and letting the browser
// start fetching doesn't require a user gesture at all (only .play() does),
// so by the time ensureMusicTracks() constructs its REAL elements later,
// the browser serves them from cache instead of hitting the network cold.
function preloadAudioFile(src) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const done = () => resolve();
    audio.addEventListener('canplaythrough', done, { once: true });
    // A genuinely missing/broken file (or a browser that never fires
    // canplaythrough for some reason) shouldn't strand the player on the
    // loading screen forever — resolve either way, same "don't block Start
    // on a real network failure" reasoning the overall timeout below applies
    // at a coarser level.
    audio.addEventListener('error', done, { once: true });
    audio.preload = 'auto';
    audio.src = src;
  });
}

const LOADING_SCREEN_TIMEOUT_MS = 8000; // hard ceiling — a stalled/slow network still reaches the start screen eventually, just without the preload benefit
const loadingOverlay = document.getElementById('loading-overlay');
const loadingBarFill = document.getElementById('loading-bar-fill');
const loadingGuppyCanvas = document.getElementById('loading-guppy-canvas');
const loadingStatus = document.getElementById('loading-status');
const loadingGuppyCtx = loadingGuppyCanvas.getContext('2d');
let loadingProgress = 0; // 0-1, read by the guppy's own animation loop below
let loadingDone = false;

function updateLoadingBar(fraction) {
  loadingProgress = Math.max(0, Math.min(1, fraction));
  loadingBarFill.style.width = `${loadingProgress * 100}%`;
  loadingGuppyCanvas.style.left = `${loadingProgress * 100}%`;
}

function animateLoadingGuppy(now) {
  if (loadingDone) return;
  loadingGuppyCtx.clearRect(0, 0, loadingGuppyCanvas.width, loadingGuppyCanvas.height);
  const tailPhase = (now / 220) % (Math.PI * 2); // same idle-swim rate the fish-tool ghost preview's own tail already uses
  drawFish(loadingGuppyCtx, loadingGuppyCanvas.width / 2, loadingGuppyCanvas.height / 2, 'guppy', SPECIES.guppy.growthStages.length - 1, 1, tailPhase, { x: 1, y: 0 });
  requestAnimationFrame(animateLoadingGuppy);
}
requestAnimationFrame(animateLoadingGuppy);

async function runLoadingSequence() {
  const resources = [
    preloadAudioFile('audio/Game.mp3'),
    preloadAudioFile('audio/Battle.mp3'),
    preloadAudioFile('audio/Boss.mp3'),
    document.fonts ? document.fonts.ready : Promise.resolve(),
  ];
  let completed = 0;
  updateLoadingBar(0);
  loadingStatus.textContent = 'Loading...';
  const allLoaded = Promise.all(resources.map((p) => Promise.resolve(p).then(() => {
    completed += 1;
    updateLoadingBar(completed / resources.length);
  })));
  const timeout = new Promise((resolve) => setTimeout(resolve, LOADING_SCREEN_TIMEOUT_MS));
  await Promise.race([allLoaded, timeout]);
  updateLoadingBar(1);
  loadingDone = true;
  loadingOverlay.classList.add('hidden');
  document.getElementById('start-overlay').classList.remove('hidden');
}
runLoadingSequence();

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

// Electricity HUD/graph: samples current power demand AND that second's
// freshly-generated supply once per real sim-second (ticked off dtMs, so it
// still paces correctly under the debug time-scale cheat) into
// state.level.powerHistory/powerEfficiency — see UI.js's electricity
// readout/graph popup and Config.js's POWER_HISTORY_MAX. Power is not a
// battery any more (see Levels.js's powerGenAccumMw) — this is also the one
// place that accumulator gets read and reset back to 0 for the next window.
let powerSampleAccumMs = 0;

// Places a tile at the cursor once per newly-entered cell while the left
// button is held and a build tool is selected — see the input wiring above
// for why this lives here instead of on the click handler.
function updateBuildDrag() {
  if (!input.mouseDown) {
    lastBuildCell = null;
    return;
  }
  if (draggedFishId != null || draggedItemId != null) return; // a fish-combine or item drag is in progress — don't also place tiles under it
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
  // Shift-click Replace, per direct request — placeTileWithReplace behaves
  // exactly like plain placeTile when the tile's empty or Shift isn't held;
  // it only takes the replace path (refund the old, charge the difference)
  // when the tile's occupied AND Shift is down.
  const shiftHeld = isShiftHeld();
  const buildResult = placeTileWithReplace(state, col, row, buildingId, angle, shiftHeld);
  if (!buildResult.placed) handleBuildPlacementFailure(buildResult.info.reason);
  const placed = buildResult.placed;
  if (placed) {
    if (buildResult.replaced) {
      pushUndoEntry({ type: 'replace', col, row, oldBuildingId: buildResult.oldBuildingId, oldData: buildResult.oldData, netCost: buildResult.info.netCost });
      showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, buildResult.info.netCost);
    } else {
      pushUndoEntry({ type: 'place', col, row, buildingId });
    }
  }
  if (placed && (buildingId === TILE_MANUFACTURER || buildingId === TILE_POWER_PLANT)) {
    suppressRecipeMenuAfterPlacementClick = true;
  }
  // Post-alien guided tutorial's final step — any successful Turret
  // placement (the family's currently-armed tier, forced to the base Waste
  // Turret when this step's own icon was selected — see UI.js's
  // buildFamilyButton) completes the flow. Checked by family membership
  // rather than one exact tile id so it's not brittle if the player happens
  // to place a different tier.
  if (placed && BUILDING_FAMILIES.turret.includes(buildingId)) {
    // Checked BEFORE advanceTutorialFlow mutates tutorialFlow to the next
    // step — real bug caught during testing: calling deselectShopSelection
    // unconditionally on every turret placement (tutorial or not) reset
    // state.ui.selectedTool to 'cursor' WHILE the mouse button was still down,
    // ahead of the native mouseup's own "click" event — which meant that
    // click then read as an ordinary cursor-tool click landing on the
    // freshly-placed turret, immediately popping its generic building-info
    // modal open right on top of it. Gating this to only the tutorial's own
    // exact step (per the original request — "after you place the turret,
    // have it automatically clear the cursor... for the step of dragging
    // waste into the turret") avoids that side effect on every other,
    // perfectly ordinary turret placement a player makes outside the
    // tutorial.
    const isTutorialPlaceStep = state.level.tutorialFlow?.id === 'postalien' && state.level.tutorialFlow.step === 'place';
    advanceTutorialFlow(state, 'postalien', 'place');
    if (isTutorialPlaceStep) {
      // Per direct request — the very next step teaches dragging Waste INTO
      // this exact turret, which reads oddly if the turret build tool is
      // still the one armed (the player would have to click it off
      // themselves first, or risk placing a second one by accident while
      // trying to drag). Auto-clears back to the cursor the instant the tutorial
      // turret is down, same as deselectShopSelection already does for a
      // manually re-clicked single-tier shop item.
      deselectShopSelection(state);
      // The native mouseup that follows this same mousedown-drag gesture
      // still fires as an ordinary click a tick later — suppress it (see
      // this flag's own comment) so it doesn't reopen the building-info
      // pop-up on the turret this exact click just placed.
      suppressTutorialTurretPlacementClick = true;
      // Guarantee the very next step has something real to drag — per
      // direct report ("the tutorial can break if there's no waste on
      // screen"), rather than hoping a fish had already pooped one out
      // nearby. See Entities.js's spawnTurretTutorialWaste.
      spawnTurretTutorialWaste(state);
    }
  }
  // The 'chest' guided flow's own 'place' step — same shape/reasoning as the
  // turret block just above (checked by family membership, gated on the
  // tutorial's own exact step, deselects the tool afterward, and suppresses
  // the same click's own building-info-popup side effect). Reuses
  // suppressRecipeMenuAfterPlacementClick — it's already a generic "the
  // native click tail of this exact placement gesture shouldn't ALSO open
  // this tile's own popup" flag, not actually Manufacturer/Power-Plant-
  // specific despite its name.
  if (placed && BUILDING_FAMILIES.chest.includes(buildingId)) {
    const isChestTutorialPlaceStep = state.level.tutorialFlow?.id === 'chest' && state.level.tutorialFlow.step === 'place';
    advanceTutorialFlow(state, 'chest', 'place');
    if (isChestTutorialPlaceStep) {
      deselectShopSelection(state);
      suppressRecipeMenuAfterPlacementClick = true;
      // Guarantee the very next step ("drag the Waste into the Chest") has
      // something real to drag — same reasoning/precedent as
      // spawnTurretTutorialWaste above.
      spawnChestTutorialWaste(state);
    }
  }
}

// D-hotkey delete, including hold-and-drag — see lastKeyDDeleteCell's own
// comment above. Per direct request ("built into the food cursor tool via
// the D hotkey," later extended to the plain cursor tool too — "the default
// cursor can be used for... moving/deleting buildings"), this is a cursor/
// Food-tool ability, not a global modifier that works no matter what else is
// selected — checked against the raw selectedTool, not effectiveToolAt,
// since a build/blueprint tool is only ever reinterpreted as Food over OPEN
// water (see effectiveToolAt's own comment) and deletion only ever applies
// on the seabed anyway, where an armed build tool stays exactly itself.
// Matches updateCanvasCursor's own hammer-cursor swap and render()'s own
// D-held ghost-tint preview, which both gate on the same condition.
function updateKeyDDelete() {
  if (!input.keysDown.has('KeyD') || !isCursorOrFoodTool(state.ui.selectedTool)) {
    lastKeyDDeleteCell = null;
    return;
  }
  if (draggedFishId != null || draggedItemId != null) return; // a fish-combine or item drag is in progress — don't also delete under it
  if (!input.mouse.inside) return;
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  if (world.y < SEABED_FLOOR_Y) return; // nothing to delete above the seabed
  const { col, row } = worldToTile(world.x, world.y);
  const cellKey = `${col},${row}`;
  if (cellKey === lastKeyDDeleteCell) return;
  lastKeyDDeleteCell = cellKey;
  recordAndRemoveTile(col, row);
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

// Keeps whichever fish the info modal is currently open for "locked into
// place" — per direct request ("Keep that one fish locked into place and
// highlight the fish while it's modal is open so it's visually obvious what
// fish the modal belongs to"). Same override-after-updateEntities shape
// updateFishDrag above already uses, just holding a fixed world position
// (state.ui.fishInfoModalFrozenX/Y, captured once by UI.js's
// openFishInfoMenu) instead of following the cursor.
function updateFishInfoModalFreeze() {
  const fishId = state.ui.fishInfoModalFishId;
  if (fishId == null) return;
  const fish = state.level.entities.find((e) => e.id === fishId && e.type === 'fish');
  if (!fish || fish.dying) { closeFishInfoMenu(state); return; } // the fish it's showing died/despawned out from under it
  fish.x = state.ui.fishInfoModalFrozenX;
  fish.y = state.ui.fishInfoModalFrozenY;
  fish.vx = 0;
  fish.vy = 0;
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

// Mother Alien Fish end-game boss sequence, per direct spec — walks
// state.level.bossPhase forward through 'intro_wait' -> 'fighting' ->
// 'defeated' -> 'gameover', never backwards. Called every tick once
// bossPhase is truthy (see update()'s own call site) — most of the phases
// don't need per-tick work at all, this just watches for the moment to
// advance to the next one.
function updateBossSequence(state, dtMs) {
  if (state.level.bossPhase === 'intro_wait') {
    // The Lab itself was already closed by UI.js's buyLabUpgrade the instant
    // the purchase happened; this drives the whole 16-second reveal that
    // follows — see Config.js's own BOSS_* comment for the full timeline
    // this is built from (music fade-out, chat message, a real silent wait,
    // music fade-in, another wait, white fade-in, then finally the spawn
    // itself).
    state.level.bossIntroTimerMs += dtMs;
    if (!state.level.bossIntroMessageShown && state.level.bossIntroTimerMs >= BOSS_INTRO_MESSAGE_AT_MS) {
      state.level.bossIntroMessageShown = true;
      pushMainNotification(state, BOSS_INTRO_MESSAGE);
    }
    if (state.level.bossIntroTimerMs >= BOSS_SPAWN_MS) {
      // The white fade-in (rendered live from bossIntroTimerMs while still
      // in this phase — see render()'s own comment) has just reached full
      // opacity — spawn the boss right as the screen is fully white, then
      // immediately start clearing it again so the reveal reads as "the
      // white goes away AND the boss appears" together.
      state.level.bossWhiteFadeOutUntilMs = state.level.elapsed + BOSS_WHITE_FADE_OUT_MS;
      // Spawns high in the water column, horizontally centered — "a big ole
      // alien enemy" making its entrance where it's immediately visible
      // regardless of where the camera/player happened to be panned.
      const boss = createMotherAlienFish(WORLD_W / 2, SEABED_FLOOR_Y * 0.3);
      state.level.entities.push(boss);
      state.level.bossEntityId = boss.id;
      state.level.bossPhase = 'fighting';
    }
    return;
  }
  if (state.level.bossPhase === 'fighting') {
    // Entities.js's updateAlien sets this the instant the boss's own hp
    // hits 0 (its death branch) — main.js is what actually owns advancing
    // the boss-sequence phase, since Entities.js has no business knowing
    // about UI-level modal timing.
    if (state.level.bossDefeatedAtMs !== null) state.level.bossPhase = 'defeated';
    return;
  }
  if (state.level.bossPhase === 'defeated') {
    // Deliberately NOT frozen during this window — per direct spec, "slowly
    // fade in a game over modal" implies the world keeps breathing for a
    // beat after the boss's own death-burst before the stats modal appears,
    // not an instant hard cut.
    if (state.level.elapsed - state.level.bossDefeatedAtMs >= BOSS_DEFEATED_MODAL_DELAY_MS) {
      state.level.bossPhase = 'gameover';
      showGameOverModal(state);
    }
  }
}

// Battle music should be audible whenever an alien is genuinely on screen,
// OR within ALIEN_MUSIC_BATTLE_LEAD_MS of the next wave actually spawning —
// per direct request ("have the Game music fade out and the Battle music
// fade in when there's 3 seconds of a count-down for aliens left"). The
// pre-wave lead-in reads state.level.alienNextWaveAtMs/alienWaveActive the
// same way UI.js's own on-screen countdown banner does (see its
// updateAlienCountdown) — alienNextWaveAtMs is only a meaningful countdown
// while alienWaveActive is false (see Systems.js's updateAlienWaves), so
// that guard keeps this from misreading a stale timestamp while a wave's
// own aliens are still alive (though aliensAlive below would already be
// true in that case regardless). Sound.js's setBattleMusicActive itself
// no-ops on a repeat call with the same value, so calling this every single
// tick is cheap and never restarts an in-flight crossfade.
function updateBattleMusic(state) {
  const aliensAlive = state.level.entities.some((e) => e.type === 'alien');
  const msUntilNextWave = state.level.alienNextWaveAtMs - state.level.elapsed;
  const withinPreBattleWindow = !state.level.alienWaveActive && msUntilNextWave > 0 && msUntilNextWave <= ALIEN_MUSIC_BATTLE_LEAD_MS;
  setBattleMusicActive(aliensAlive || withinPreBattleWindow);
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
  updateBattleMusic(state);
  // Cross-module flag (UI.js's buyLabUpgrade sets it, same pattern
  // state.ui.wasteTurretAmmoGainedPending already established) — the Mother Alien
  // Fish purchase's own gameplay-state transition (starting the boss
  // sequence) belongs here in main.js, not in UI.js, per this file's own
  // module-boundary rule ("no gameplay logic" in UI.js).
  if (state.ui.bossFightTriggerPending) {
    state.ui.bossFightTriggerPending = false;
    state.level.bossPhase = 'intro_wait';
    state.level.bossIntroTimerMs = 0;
    state.level.bossIntroMessageShown = false;
    // Per direct request, the music fade is now part of the 16-second
    // reveal's own timeline (its first BOSS_MUSIC_FADE_IN_START_MS +
    // BOSS_MUSIC_FADE_IN_MS) rather than snapping instantly at the moment of
    // purchase — triggered here, right as that timeline actually starts, not
    // from UI.js's buyLabUpgrade.
    triggerBossMusic();
  }
  if (state.ui.paused) return; // frozen behind the pause menu — render() still runs so the tank stays visible
  if (state.level.gameOver) return; // lost — frozen the same way, but via a separate flag so Escape still reaches the pause menu's Restart without also un-freezing a lost game (see Systems.js's updateBankruptcy)
  // Mother Alien Fish end-game boss sequence — see updateBossSequence's own
  // comment for the full state machine. Called every tick once triggered
  // (not just while frozen) so it can also catch the 'fighting' -> 'defeated'
  // -> 'gameover' transitions that happen during otherwise-normal gameplay;
  // only 'intro_wait' (the 2s cinematic pause before the boss appears) and
  // 'gameover' (the final stats modal) actually freeze everything below.
  if (state.level.bossPhase) updateBossSequence(state, dtMs);
  if (state.level.bossPhase === 'intro_wait' || state.level.bossPhase === 'gameover') return;
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
    if (!alien) { state.level.tutorialFlow = null; return; }
    // Real bug fix, per direct report ("the alien tutorial doesn't work if
    // I'm scrolled to the bottom of the tank") — this flow's own blanket
    // camera freeze above is exactly what turned an off-screen alien into a
    // hard softlock: the player had no way to ever scroll it into view, or
    // even see it, to click it. Camera panning is allowed for exactly as
    // long as the target isn't visible yet — UI.js's
    // tutorialScrollDirectionNeeded is the same shared check
    // updateTutorialOverlay/updateScrollHint use to show the "scroll to
    // find it" prompt, so all three always agree on the same condition.
    // Nothing else runs either way (fish/aliens/elapsed all stay frozen),
    // preserving "the whole game pauses" the instant the alien IS visible.
    if (tutorialScrollDirectionNeeded(state)) {
      updateCamera(state.camera, input, canvas, dtMs);
    }
    return;
  }

  updateCamera(state.camera, input, canvas, dtMs);
  updateBuildDrag();
  updateKeyDDelete();
  updateBlueprintToolGate();
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
      // Per direct request — a one-time gift the instant this step begins,
      // guaranteeing the Waste Turret is affordable regardless of how the
      // player already spent their starting money; naturally one-shot since
      // this whole branch only ever fires once, on the 'scroll' -> 'place'
      // transition itself.
      state.level.money += TURRET_TUTORIAL_GOLD_GRANT;
      pushMainNotification(state, TURRET_TUTORIAL_GOLD_GRANT_MESSAGE);
    }
    // The "drag Waste into the Turret" step needs the WHOLE simulation
    // running normally, not just camera/build-drag like every other step's
    // exemption — dragging itself is driven by updateItemDrag below, but
    // actually getting absorbed depends on updateEntities' own turret-
    // intake scan (deep inside Grid.js's updateBuildings), which needs real
    // per-tick execution to ever fire at all. The "drag one fish onto the
    // other" merge-tutorial step needs the same exemption, for the same
    // reason — updateFishDrag (which makes the grabbed fish actually follow
    // the cursor) only ever runs as part of this same normal-simulation
    // path. The 'chest' flow's own "drag away to aim the trickle" step needs
    // it too, for the same reason again — updateChestAimDrag below (and the
    // chest's own Grid.js intake scan for its EARLIER 'feedwaste' step) only
    // run as part of this same normal path. Falls through to the normal
    // path below instead of freezing — updateStoryTriggers' own tutorial
    // triggers all self-gate on state.level.tutorialFlow already being set
    // (this exact flow), so nothing else can start while this runs.
    if (!isWasteDragTutorialStepActive(state) && !isMergeDragTutorialStepActive(state) && !isChestFeedWasteStepActive(state) && !isChestTrickleStepActive(state)) return;
  }
  if (state.ui.buildErrorText) {
    state.ui.buildErrorElapsedMs += dtMs;
    if (state.ui.buildErrorElapsedMs >= BUILD_ERROR_TEXT_DURATION_MS) state.ui.buildErrorText = null;
  }
  // Pause Time button/hotkey (state.ui.timePaused) — per direct request,
  // deliberately NOT the same thing as the debug time-scale cheat's 0x step
  // (TIME_SCALE_STEPS[0]) further down this file: that scales how often
  // update() itself gets CALLED (via getTimeScale/createGameLoop's
  // accumulator), so a 0x debug pause stops this whole function from ever
  // running again — including the drag-follow calls below — which would
  // also freeze the exact interactions Pause Time is supposed to leave
  // working ("purchase/move/delete buildings/fish and drag objects"). This
  // flag instead gates just updateEntities (fish AI/production, alien
  // spawns/wave timers, Grid.js's building intake — "fish don't produce
  // money/waste/science and aliens don't spawn and buildings don't accept
  // objects") and the level clock, while update() keeps running every real
  // frame so the drag/move functions below stay responsive.
  if (!state.ui.timePaused) updateEntities(state, dtMs);
  updateFishDrag();
  updateFishInfoModalFreeze();
  updateItemDrag();
  updateChestAimDrag();
  updateRecipeDrag();
  updatePlatformFilterDrag();
  updateBuildingMove();
  if (!state.ui.timePaused) {
    updateStoryTriggers(state, dtMs);
    state.level.elapsed += dtMs;
  }

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
    // Turret demand is tracked as its own running accumulator, not included
    // in computeCurrentPowerDemand's own snapshot — see that function's own
    // comment for why a once-a-second instantaneous check can't reliably
    // catch a single-tick firing pulse the way it can a sustained state like
    // a Fan/Processor/Refinery/Manufacturer's.
    const demand = computeCurrentPowerDemand(state) + state.level.turretPowerDemandAccumMw;
    const rawSupply = state.level.powerGenAccumMw; // whatever Eels/Blimp-Batteries generated during the window that just closed — see Levels.js's powerGenAccumMw
    // Blimp-Battery — per direct spec ("power will need to be
    // calculated every second, and if there's excess, it can be stored...
    // if power usage exceeds power production, the stored electricity can
    // be used instead of reducing city efficiency"). Capacity is recomputed
    // fresh every second from whichever Blimp-Batteries are currently alive (and
    // fed) rather than tracked separately, so a fish dying mid-level
    // shrinks it immediately — clamping stored charge down to match rather
    // than letting it silently exceed a capacity that no longer exists.
    const batteryCapacity = computeEelBlimpBatteryCapacityMw(state);
    state.level.batteryStoredMw = Math.min(state.level.batteryStoredMw, batteryCapacity);
    let effectiveSupply = rawSupply;
    if (rawSupply >= demand) {
      // Genuine surplus this second — charge the battery with whatever's
      // left over after demand is fully covered.
      const excess = rawSupply - demand;
      state.level.batteryStoredMw = Math.min(batteryCapacity, state.level.batteryStoredMw + excess);
    } else {
      // A shortfall — draw down the battery to cover as much of the gap as
      // it can before efficiency ever has to drop.
      const deficit = demand - rawSupply;
      const drawn = Math.min(deficit, state.level.batteryStoredMw);
      state.level.batteryStoredMw -= drawn;
      effectiveSupply = rawSupply + drawn;
    }
    state.level.batteryCapacityMw = batteryCapacity;
    const history = state.level.powerHistory;
    // raw (generation before any battery draw/charge is netted in) is kept
    // alongside the existing demand/effectiveSupply pair purely for the
    // HUD's 3rd "Generating" stat below — supply stays effectiveSupply
    // everywhere else (efficiency calc, the rolling graph) unchanged.
    history.push({ demand, supply: effectiveSupply, raw: rawSupply });
    if (history.length > POWER_HISTORY_MAX) history.shift();
    state.level.powerEfficiency = computePowerEfficiency(effectiveSupply, demand);
    // power_deficit_60s / power_surplus_60s achievements — this exact
    // once-a-second window is the only place real demand/supply numbers for
    // "this second" actually exist, so the streak is tracked right here
    // rather than re-deriving it from a live per-tick read (which would just
    // see whatever partial-second accumulator hasn't been sampled yet).
    // Deficit and surplus are mutually exclusive by definition, so only one
    // of the two streaks can ever be growing at a time — the other resets to
    // 0 the instant its own condition stops holding.
    if (demand > 0 && effectiveSupply < demand) {
      state.level.powerDeficitStreakMs += 1000;
      state.level.powerSurplusStreakMs = 0;
    } else if (demand > 0 && effectiveSupply >= demand * ACHIEVEMENT_POWER_SURPLUS_RATIO) {
      state.level.powerSurplusStreakMs += 1000;
      state.level.powerDeficitStreakMs = 0;
    } else {
      state.level.powerDeficitStreakMs = 0;
      state.level.powerSurplusStreakMs = 0;
    }
    state.meta.stats.powerDeficitStreakBestMs = Math.max(state.meta.stats.powerDeficitStreakBestMs, state.level.powerDeficitStreakMs);
    state.meta.stats.powerSurplusStreakBestMs = Math.max(state.meta.stats.powerSurplusStreakBestMs, state.level.powerSurplusStreakMs);
    state.level.powerGenAccumMw = 0; // reset for the next window — generated MW that goes unused (and isn't stored) this second is gone, not carried forward
    state.level.turretPowerDemandAccumMw = 0; // reset alongside it — see its own comment in Levels.js
  }
}

// The open-water background — a vertical gradient (lighter at the top,
// deeper/darker toward the bottom) instead of a single flat fill, and
// overall lightened from the original flat #1c5f8a, per direct request. Used
// to also darken live with state.level.cleanliness; removed per a later
// direct request ("remove the effect where the tank background gets darker
// as the tank gets dirtier — there's enough physical objects to act as the
// dirtiness now") — the gradient is a fixed pair of colors now, no longer a
// function of cleanliness at all.
const WATER_TOP_CLEAN = { r: 58, g: 138, b: 184 };
const WATER_BOTTOM_CLEAN = { r: 32, g: 100, b: 145 };
function waterBackgroundGradient(ctx, canvasHeight) {
  const top = `rgb(${WATER_TOP_CLEAN.r}, ${WATER_TOP_CLEAN.g}, ${WATER_TOP_CLEAN.b})`;
  const bottom = `rgb(${WATER_BOTTOM_CLEAN.r}, ${WATER_BOTTOM_CLEAN.g}, ${WATER_BOTTOM_CLEAN.b})`;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  return gradient;
}

// Glass tank walls at the world's left/right edges — per direct request
// ("so it's obvious where objects will stop on the sides"). Items already
// clamp their own position flush against x=0/WORLD_W when they drift into
// them (Entities.js's clampItemToWorldWalls), so the wall's inner seam sits
// at those exact same coordinates — a resting item visually touches the
// glass, not an arbitrary nearby line. Spans the full vertical scroll range
// (world y=0 down through the camera's bottom-buffer strip) so it's always
// present regardless of how far the player has panned. Rendered right after
// the seabed grid/Mound, before any fish/item/alien — a background
// structural element the tank's contents sit in front of.
//
// Reworked per direct follow-up report ("I don't like the glass walls...
// make the frosted part extend all the way to the outermost edges... so it
// looks like [you're] inside a glass tank, rather than the tank being on
// both sides of a random glass wall"). The original version drew a fixed-
// width band a short distance out from the boundary, leaving plain water
// color still visible beyond it out to the screen edge — reading as a thin
// glass PILLAR floating in open water with tank on both sides of it, not
// the actual edge of the tank. Now the glass fill spans the ENTIRE gap from
// the true boundary out to the real screen edge, however wide that happens
// to be for the current viewport — nothing but glass is ever visible past
// the inner seam, so the screen edge itself reads as the outside of the
// tank.
// Reworked a second time into a "glassmorphism" treatment, per direct
// request ("modern glassmorphic look... inner box shadow, thin white
// translucent borders, and a subtle linear gradient to make them look like
// thick, refractive glass panels facing sideways"). Canvas has no native
// box-shadow, so the inset look is faked with two short gradient strips
// hugging each edge that darken slightly before fading back into the main
// fill — the same trick an inset CSS box-shadow produces, just hand-drawn.
// The old hard-edged diagonal "shine stroke" from the previous pass is
// gone, replaced by a soft brightness bump built into the main fill's own
// gradient stops instead — reads as light refracting through the glass's
// thickness rather than a painted-on streak.
const TANK_WALL_MIN_WIDTH = 22; // world px — the guaranteed-minimum glass width, used as a fallback when the true boundary would otherwise be off-screen (see renderTankWalls) or nearly flush with the screen edge
const TANK_WALL_INSET_SHADOW_FRACTION = 0.3; // how much of the panel's own width each inset-shadow strip reaches in from its edge
function renderGlassWall(ctx, innerX, outerX, topY, bottomY) {
  const left = Math.min(innerX, outerX);
  const width = Math.abs(outerX - innerX);
  if (width <= 0) return;
  ctx.save();

  // Base glass fill — a soft, mostly-neutral white gradient (glassmorphism
  // leans neutral/frosted rather than tinted) that brightens gradually
  // toward the outer edge with one gentle extra lift just past halfway,
  // reading as light passing through the pane's real thickness rather than
  // a flat tint.
  const fill = ctx.createLinearGradient(innerX, 0, outerX, 0);
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
  fill.addColorStop(0.45, 'rgba(255, 255, 255, 0.16)');
  fill.addColorStop(0.6, 'rgba(255, 255, 255, 0.26)');
  fill.addColorStop(1, 'rgba(255, 255, 255, 0.34)');
  ctx.fillStyle = fill;
  ctx.fillRect(left, topY, width, bottomY - topY);

  // Faked inner box-shadow — a short, soft dark gradient hugging each edge
  // from the inside, fading to nothing within TANK_WALL_INSET_SHADOW_FRACTION
  // of the panel's own width, the same visual an `inset` CSS box-shadow
  // gives a card.
  const insetReach = width * TANK_WALL_INSET_SHADOW_FRACTION;
  const innerShadow = ctx.createLinearGradient(innerX, 0, innerX + Math.sign(outerX - innerX) * insetReach, 0);
  innerShadow.addColorStop(0, 'rgba(5, 15, 25, 0.22)');
  innerShadow.addColorStop(1, 'rgba(5, 15, 25, 0)');
  ctx.fillStyle = innerShadow;
  ctx.fillRect(left, topY, width, bottomY - topY);
  const outerShadow = ctx.createLinearGradient(outerX, 0, outerX - Math.sign(outerX - innerX) * insetReach, 0);
  outerShadow.addColorStop(0, 'rgba(5, 15, 25, 0.16)');
  outerShadow.addColorStop(1, 'rgba(5, 15, 25, 0)');
  ctx.fillStyle = outerShadow;
  ctx.fillRect(left, topY, width, bottomY - topY);

  // Thin white translucent borders along both edges of the panel.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, topY);
  ctx.lineTo(innerX, bottomY);
  ctx.moveTo(outerX, topY);
  ctx.lineTo(outerX, bottomY);
  ctx.stroke();
  ctx.restore();
}
function renderTankWalls(ctx, state, canvasWidth) {
  const topY = worldToScreen(0, 0, state.camera).y;
  const bottomY = worldToScreen(0, WORLD_H + CAMERA_BOTTOM_BUFFER_PX, state.camera).y;
  const minWidthPx = TANK_WALL_MIN_WIDTH * state.camera.zoom;
  // The inner seam sits at the true world boundary whenever that's already
  // comfortably on-screen; otherwise it falls back to a fixed minimum
  // distance from the screen edge instead, so the wall never vanishes
  // entirely on a narrower viewport (viewW < WORLD_W — see Engine.js's
  // updateCamera's own comment on when the true boundary can fall
  // off-canvas). The fill (above) always spans from this seam out to the
  // real screen edge either way, so there's never a gap of plain water
  // color between the glass and the edge of the canvas.
  const trueLeftInnerX = worldToScreen(0, 0, state.camera).x;
  const trueRightInnerX = worldToScreen(WORLD_W, 0, state.camera).x;
  const leftInnerX = Math.max(trueLeftInnerX, minWidthPx);
  const rightInnerX = Math.min(trueRightInnerX, canvasWidth - minWidthPx);
  renderGlassWall(ctx, leftInnerX, 0, topY, bottomY);
  renderGlassWall(ctx, rightInnerX, canvasWidth, topY, bottomY);
  // Exposes each wall's actual live on-screen width as a CSS custom property
  // — per direct request, the HUD/chat pill (both fixed-position DOM
  // elements pinned near the corners) read these (see style.css's #hud/
  // #notification-ticker) to offset themselves clear of
  // the glass instead of visually overlapping it, at every viewport size
  // rather than guessing one fixed margin that only happens to work for
  // some. Only written when actually changed (camera/canvas size are
  // otherwise stable frame-to-frame) to avoid triggering a layout
  // recalculation on the fixed-position elements above every single frame
  // for no reason.
  const leftWidthPx = Math.round(leftInnerX);
  const rightWidthPx = Math.round(canvasWidth - rightInnerX);
  if (leftWidthPx !== lastGlassWallLeftWidth) {
    lastGlassWallLeftWidth = leftWidthPx;
    document.documentElement.style.setProperty('--glass-wall-left-width', `${leftWidthPx}px`);
  }
  if (rightWidthPx !== lastGlassWallRightWidth) {
    lastGlassWallRightWidth = rightWidthPx;
    document.documentElement.style.setProperty('--glass-wall-right-width', `${rightWidthPx}px`);
  }
}
let lastGlassWallLeftWidth = null;
let lastGlassWallRightWidth = null;

// Alien hit-flash — per direct request ("aliens flash red and bounce when
// they take damage"). Every alien color (both the flat ALIEN_COLOR fallback
// and each archetype's own tier color — Dynamic Alien Archetypes) is a hex
// string, parsed to an {r,g,b} triple here — Dynamic Alien Archetypes means
// this can no longer be a single value precomputed once at module scope
// (each alien's own color varies by tier), so it's a small helper instead;
// at most ALIEN_MAX_ALIVE aliens ever exist, so a fresh parse per alien per
// frame is negligible.
function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
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
function drawAlienBody(ctx, x, y, radius, facing, color, gazeAngle, spikes = 3, bodyWidthMul = 1, bodyHeightMul = 1, glow = false, glowHex = null) {
  ctx.save();

  const bodyRx = radius * 1.05 * bodyWidthMul;
  const bodyRy = radius * 0.85 * bodyHeightMul;

  // A soft outer aura for the top tiers (and the boss), per direct request
  // ("more visually distinct alien tiers") — drawn first, behind everything
  // else, so it reads as ambient danger rather than a hard outline. Uses
  // glowHex (the alien's own stable archetype color, always a real #hex
  // string) rather than `color` — `color` can be an "rgb(r, g, b)" STRING
  // during a hit-flash blend (see lerpRgbToString), and appending an alpha
  // suffix to that would produce an invalid CSS color; the glow doesn't
  // need to flash red on hit anyway; the body/eyes already do that.
  if (glow) {
    const hex = glowHex || color;
    const glowR = Math.max(bodyRx, bodyRy) * 1.7;
    const glowGradient = ctx.createRadialGradient(x, y, Math.max(bodyRx, bodyRy) * 0.6, x, y, glowR);
    glowGradient.addColorStop(0, `${hex}55`);
    glowGradient.addColorStop(1, `${hex}00`);
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tail fin, trailing behind the direction of travel.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.moveTo(x - facing * bodyRx * 1.1, y);
  ctx.lineTo(x - facing * bodyRx * 0.52, y - bodyRy * 0.6);
  ctx.lineTo(x - facing * bodyRx * 0.52, y + bodyRy * 0.6);
  ctx.closePath();
  ctx.fill();

  // Main body — an oval, not a perfect circle. bodyWidthMul/bodyHeightMul
  // (per-tier, see ALIEN_ARCHETYPES) stretch/squash this beyond the base
  // ratio so each tier reads as a genuinely different silhouette, not just
  // a resized copy of the same shape.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal spikes along the top, one per tier (see ALIEN_ARCHETYPES'
  // `spikes` field) — the one purely "alien/sea-monster" flourish, keeping
  // it visually distinct from an ordinary fish silhouette despite sharing
  // the same shading language, and now itself a visible tier marker.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  const spikeSpacing = radius * 0.3;
  const spikeStartOffset = -((spikes - 1) / 2) * spikeSpacing;
  for (let i = 0; i < spikes; i++) {
    const sx = x + spikeStartOffset + i * spikeSpacing;
    ctx.beginPath();
    ctx.moveTo(sx, y - bodyRy * 1.15);
    ctx.lineTo(sx - radius * 0.12, y - bodyRy * 0.65);
    ctx.lineTo(sx + radius * 0.12, y - bodyRy * 0.65);
    ctx.closePath();
    ctx.fill();
  }

  // Darker underside + glossy highlight — the same treatment every fish
  // body already gets.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + bodyRy * 0.38, bodyRx * 0.76, bodyRy * 0.41, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x - facing * bodyRx * 0.27, y - bodyRy * 0.41, bodyRx * 0.3, bodyRy * 0.21, -0.3 * facing, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyRx, bodyRy, 0, 0, Math.PI * 2);
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

// Cursor changes to match the active tool — a hammer while the D hotkey is
// held down (see updateCanvasCursor's own check), a glove for the Merge
// tool — per direct request. Built as a small inline SVG
// data-URI cursor (an emoji rendered onto a tiny canvas-less SVG) rather
// than a real cursor image asset, same "no external file, generate it"
// spirit as this project's synthesized audio. Only ever written to the DOM
// when the tool actually changed, not every frame.
// glyphX/glyphY let a caller shift WHERE the emoji itself is drawn inside
// the fixed 32x32 box instead of moving the hotspot number — per direct
// request for the shell cursor below ("move the cursor point more towards
// the top left of the emoji by moving the emoji down and right"): pushing
// the glyph away from a fixed hotspot, down and to the right, leaves that
// same hotspot sitting relatively closer to the glyph's own top-left corner
// than before, without having to re-guess where the hotspot number itself
// should land.
// boxW/boxH let a caller widen the SVG canvas beyond the default 32x32 —
// needed when glyphX is shifted far enough right that the glyph would
// otherwise clip against a fixed 32px-wide box (see the shell cursor below).
function emojiCursorCss(emoji, hotspotX = 4, hotspotY = 26, glyphX = 0, glyphY = 26, boxW = 32, boxH = 32) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${boxW}' height='${boxH}'><text x='${glyphX}' y='${glyphY}' font-size='26'>${emoji}</text></svg>`;
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
  // not its very tip corner. Keyed 'delete' rather than a tool name — the
  // old standalone Demolish tool is gone, this fires off the D hotkey being
  // held instead (see updateCanvasCursor).
  delete: emojiCursorCss('🔨', 13, 8),
  // Real bug fixed, per direct report ("the center of the cursor is way too
  // far to the bottom left of the glove icon... I have to click in the top
  // right corner of the fish for it to work"). The default hotspot (4, 26)
  // — near the bottom-LEFT corner of the 32x32 glyph box, tuned for a glyph
  // shaped like the hammer's own handle-and-head silhouette — lands almost
  // entirely OUTSIDE the glove emoji's own rendered pixels at this exact
  // font/size (measured directly via an offscreen-canvas pixel scan: the
  // glove's real bounding box is x:6-27, y:4-29, so x=4 sits to the left of
  // every one of its pixels). (17, 17) is that same glove's own measured
  // bounding-box center — unlike the hammer (whose hotspot is deliberately
  // its striking head, not its bounding-box center, since a hammer's visual
  // weight skews toward one corner), a glove/mitten shape is roughly
  // symmetric, so its true center is exactly where "grabbing with the
  // glove" should click from.
  merge: emojiCursorCss('🧤', 17, 17),
  food: circleCursorCss(FOOD_COLOR),
  // The default/neutral tool's cursor, per direct request ("default back to
  // just a cursor that looks like a shell emoji, with the tip of the shell
  // being the point of the cursor"). Unlike the hammer/glove hotspots above
  // (each measured directly off an offscreen-canvas pixel scan of a real
  // render), there's no such rendering environment available here to
  // measure this one the same way — (24, 6) is a best-effort estimate for
  // where a spiral conch shell's own pointed tip sits within its 32x32 glyph
  // box (most emoji sets draw 🐚 with the spiral point toward the upper
  // right and the flared opening toward the lower left).
  // Per direct follow-up report ("move the cursor point more towards the top
  // left of the emoji by moving the emoji down and right") — the hotspot
  // itself (24, 6) is unchanged; instead the glyph is drawn shifted from the
  // other two cursors' default draw position, which leaves that same fixed
  // hotspot sitting closer to the glyph's own top-left corner than before.
  // Per a second direct follow-up ("still too far left of where the actual
  // cursor is... vertical placement is good, but move the shell icon to the
  // right so the cursor pointer position moves from the top right to the
  // top left") — glyphY (vertical) is untouched from that first pass;
  // glyphX pushed further right still (5 -> 16), which needed the SVG's own
  // canvas widened past the default 32px (boxW: 44) so the shifted glyph
  // doesn't clip against the right edge. Nudge glyphX/boxW further if the
  // real rendered glyph still doesn't line up.
  cursor: emojiCursorCss('🐚', 24, 6, 16, 30, 44, 32),
};
let lastCursorTool = null;
function updateCanvasCursor() {
  // The Storage Chest aim-drag (updateChestAimDrag, above — either the
  // left-drag trickle-arm or the right-drag clear) owns the cursor directly
  // while it's active, rotating/stretching/coloring it live to match the
  // drag's own angle/distance — this function's normal tool-based lookup
  // would otherwise immediately stomp that back to the plain cursor/food
  // glyph the very next frame, since lastCursorTool has no way to know
  // about the override.
  if (chestAimDragKey != null || chestClearDragKey != null) return;
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  const effectiveTool = effectiveToolAt(world.y);
  // Per direct request ("built into the food cursor tool via the D
  // hotkey," later extended to the plain cursor tool too) — holding D on
  // the cursor/Food tool swaps the cursor to the same hammer glyph the old
  // standalone Demolish tool used, matching updateKeyDDelete's own exact
  // activation condition (cursor/Food tool + D held + over the seabed,
  // where there's actually something to delete).
  const cursorKey = input.keysDown.has('KeyD') && isCursorOrFoodTool(effectiveTool) && world.y >= SEABED_FLOOR_Y
    ? 'delete'
    : (CURSOR_BY_TOOL[effectiveTool] ? effectiveTool : 'default');
  if (cursorKey === lastCursorTool) return;
  lastCursorTool = cursorKey;
  canvas.style.cursor = CURSOR_BY_TOOL[cursorKey] || '';
}

function render() {
  if (state.ui.replaySplashPending) {
    state.ui.replaySplashPending = false;
    triggerSplash();
  }
  updateCanvasCursor();
  fpsCounter++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = fpsCounter;
    fpsCounter = 0;
    lastFpsTime = now;
  }

  ctx.fillStyle = waterBackgroundGradient(ctx, canvas.height);
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
  renderTankWalls(ctx, state, canvas.width);

  // Shared by every ghost-preview branch below, and — via effectiveToolAt —
  // what makes a Build tool's ghost simply not show at all while hovering
  // open water (no branch below ever matches 'food', so the chain
  // falls through with nothing drawn, exactly matching the plain Food
  // tool's own "just the cursor, no ghost" look — see effectiveToolAt's
  // own comment for the full rationale).
  const hoverWorld = input.mouse.inside ? screenToWorld(input.mouse.x, input.mouse.y, state.camera) : null;
  const hoverEffectiveTool = hoverWorld ? effectiveToolAt(hoverWorld.y) : state.ui.selectedTool;
  // Shift-click Replace's own live preview info — per direct request, read
  // by UI.js's updateHUD for the build-mode cost legend's net-cost text and
  // "Shift+Click: Replace" label. Defaults null (not shown) unless one of
  // the build-ghost branches below actually sets it.
  state.ui.buildReplaceInfo = null;

  if (isFanAimingActive() && input.mouse.inside && !state.ui.paused) {
    // Click 1 already happened — the ghost stays fixed at the armed cell
    // and only its aim rotates with the cursor, until click 2 confirms it.
    // Deliberately NOT gated by hoverEffectiveTool — aiming an already-armed
    // Fan up into open water is normal and its ghost should still track the
    // cursor there, same reasoning as the click handler's own click-2 path.
    // Per direct request, the real purchase/replace now happens on click 1
    // (see the click handler above) — by the time this renders, the Fan is
    // ALREADY placed (or, for a move, always free) either way, so this is
    // always a free angle re-aim: ignoreCost:true unconditionally, never
    // tinted red/blue for affordability/replace, and no more
    // buildReplaceInfo/"Shift+Click: Replace" legend here — there's no
    // purchase decision left to make at this step.
    const angle = angleFromTileToPoint(fanAimingCell.col, fanAimingCell.row, hoverWorld.x, hoverWorld.y);
    const cellCenterX = fanAimingCell.col * TILE_SIZE + TILE_SIZE / 2;
    const cellCenterY = fanAimingCell.row * TILE_SIZE + TILE_SIZE / 2;
    renderBuildGhost(ctx, state, cellCenterX, cellCenterY, fanAimingCell.buildingId, angle, true, true, false);
  } else if (hoverEffectiveTool.startsWith('build:') && input.mouse.inside && !state.ui.paused) {
    const world = hoverWorld;
    const buildingId = hoverEffectiveTool.slice('build:'.length);
    const { col, row } = worldToTile(world.x, world.y);
    const angle = angleFromTileToPoint(col, row, world.x, world.y);
    const shiftHeld = isShiftHeld();
    // showCone: false — this is the plain-hover phase, before a Fan's
    // placement cell has actually been armed by click 1 (see the
    // isFanAimingActive() branch above for that real aiming step). The
    // angle here is just wherever the cursor happens to be relative to
    // whatever tile it's currently over, not a deliberate aim decision yet,
    // so per direct report ("visually confusing to have the cone moving
    // around while trying to choose the fan location") no cone shows until
    // the location itself is actually confirmed.
    renderBuildGhost(ctx, state, world.x, world.y, buildingId, angle, false, false, shiftHeld);
    state.ui.buildReplaceInfo = describeReplacement(state, col, row, buildingId, shiftHeld);
  } else if (isCursorOrFoodTool(hoverEffectiveTool) && input.keysDown.has('KeyD') && input.mouse.inside && !state.ui.paused) {
    // Ghost-mode preview of whatever's under the cursor, plus the refund
    // it'll pay out — TILE_REFUND_FRACTION is 1.0 (a full refund) per
    // direct request. Shown while holding D on the Food tool (the old
    // standalone Demolish tool used to show this on plain hover, no key
    // needed — now that deletion is a held-key action rather than a
    // separately-selected tool, this only appears while D is actually held,
    // matching updateKeyDDelete's own exact activation condition). Refund is
    // read off the tile's current live/dynamic cost (getBuildingCost),
    // matching what removeTile actually pays out — see Grid.js's comment
    // there.
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

  // Right-click-to-move ghost — a translucent copy of the actual building
  // being moved, snapped to the tile grid, green/red by whether the hovered
  // spot is currently legal. See movingBuilding's own comment for the full
  // mechanic; Grid.js's renderMoveGhost does the actual drawing.
  if (movingBuilding != null && input.mouse.inside && !state.ui.paused) {
    const hoverWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    renderMoveGhost(ctx, state, hoverWorld.x, hoverWorld.y, movingBuilding.buildingId, movingBuilding.data);
  }

  // Read every frame, regardless of tool/hover state, by UI.js's updateHUD
  // to switch the persistent bottom-left Q legend to "Clear Blueprint" —
  // see the KeyQ handler's own comment for why that meaning takes priority
  // over Q's usual Pipette/Clear Cursor behavior while this is true.
  state.ui.blueprintClipboardActive = blueprintClipboard != null;

  // Blueprint tool — a live selection-box outline while dragging out an
  // area to copy, or (once captured) the whole stamp following the cursor
  // as a tinted multi-cell ghost. See blueprintClipboard's own comment.
  if (blueprintDragStartCol != null && input.mouseDown) {
    const startScreen = worldToScreen(blueprintDragStartCol * TILE_SIZE, blueprintDragStartRow * TILE_SIZE, state.camera);
    const curWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const { col: curCol, row: curRow } = worldToTile(curWorld.x, curWorld.y);
    const endScreen = worldToScreen((curCol + 1) * TILE_SIZE, (curRow + 1) * TILE_SIZE, state.camera);
    const bx = Math.min(startScreen.x, endScreen.x);
    const by = Math.min(startScreen.y, endScreen.y);
    const bw = Math.abs(endScreen.x - startScreen.x);
    const bh = Math.abs(endScreen.y - startScreen.y);
    ctx.save();
    ctx.strokeStyle = '#7cff5a';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(124, 255, 90, 0.12)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }
  if (blueprintClipboard != null && input.mouse.inside && !state.ui.paused) {
    const hoverWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const { col: baseCol, row: baseRow } = worldToTile(hoverWorld.x, hoverWorld.y);
    const blueprintShiftHeld = isShiftHeld();
    renderBlueprintGhost(ctx, state, baseCol, baseRow, blueprintClipboard, blueprintShiftHeld);
    // Live cost bubble, per direct request — read by UI.js's updateHUD,
    // which shows it in the same bottom-left bubble a build:/fish: tool's
    // own "Click to purchase" legend already uses (the two are mutually
    // exclusive, so sharing it needs no extra UI). Recomputed every frame
    // since it depends on exactly where the stamp is currently hovering —
    // Grid.js's computeBlueprintCost already skips any cell that would be
    // rejected (occupied/out of bounds), matching what a real paste would
    // actually charge. Shift-held swaps in computeBlueprintCostWithReplace's
    // own net (cost minus every occupied cell's refund, can go negative) —
    // state.ui.blueprintReplaceInfo alongside it drives the "Shift+Click:
    // Replace" label, same as a single build tool's buildReplaceInfo above.
    if (blueprintShiftHeld) {
      const preview = computeBlueprintCostWithReplace(state, baseCol, baseRow, blueprintClipboard, true);
      state.ui.blueprintCost = preview.netCost;
      state.ui.blueprintReplaceInfo = { replacing: preview.anyReplace };
    } else {
      state.ui.blueprintCost = computeBlueprintCost(state, baseCol, baseRow, blueprintClipboard);
      state.ui.blueprintReplaceInfo = null;
    }
  } else {
    state.ui.blueprintCost = null;
    state.ui.blueprintReplaceInfo = null;
  }

  for (const item of state.level.items) {
    const pos = worldToScreen(item.x, item.y, state.camera);
    if (pos.x < -20 || pos.x > canvas.width + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue; // cull offscreen

    // Per direct request ("when collectors/processors pull in objects to
    // process, have the object disintegrate while it's being processed...
    // with the amount processed matching the amount disintegrated"), an item
    // currently being held by a Collector/Refinery/Manufacturer (see
    // Grid.js's getItemDisintegrateFraction) renders as an eroding dot
    // pattern instead of its own normal shape — checked once, ahead of every
    // type-specific render branch below, so it overrides all of them
    // uniformly regardless of item type.
    const disintegrateFraction = getItemDisintegrateFraction(state, item);
    if (disintegrateFraction != null) {
      renderDisintegrateEffect(ctx, pos.x, pos.y, item.radius, disintegrateItemColor(item), disintegrateFraction, item.id);
      continue;
    }

    if (item.type === 'science' || item.type === 'science_green') {
      // "Magical bubble" — a two-tone radial blend plus a bright rim ring,
      // per direct request, instead of the flat single-color fill every
      // other item type gets below. A real ctx.createRadialGradient is fine
      // here (unlike a ctx.filter, which is the actually expensive one —
      // see Ambience.js's seaweed blur note) since it's just one more
      // fillStyle, no per-pixel filter pass. Green Science (the
      // Bio-Combuster's upgraded output) shares the exact same bubble
      // treatment, just with its own green tones instead of purple/blue.
      const colorA = item.type === 'science_green' ? SCIENCE_GREEN_COLOR_A : SCIENCE_ITEM_COLOR_A;
      const colorB = item.type === 'science_green' ? SCIENCE_GREEN_COLOR_B : SCIENCE_ITEM_COLOR_B;
      const gradient = ctx.createRadialGradient(
        pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.1,
        pos.x, pos.y, item.radius
      );
      gradient.addColorStop(0, colorB);
      gradient.addColorStop(1, colorA);
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

    if (item.type === 'biomass') {
      // A two-tone radial gradient — per direct request ("visually distinct
      // and more interesting"), replacing the flat single-color fill every
      // other Bio-chain item still gets below. The bright core is
      // deliberately BIOMASS_COLOR_CORE, which IS Bio-Sludge's own
      // ALIEN_DNA_COLOR — literally the same acid-green glowing at the
      // center of a deeper, more "refined-looking" green shell, so the two
      // read as pre/post-refined stages of the same material at a glance
      // rather than just sharing a similar hue. Same gradient technique as
      // the Science Bubble/Diamond coin's own special renders above.
      const gradient = ctx.createRadialGradient(
        pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.1,
        pos.x, pos.y, item.radius
      );
      gradient.addColorStop(0, BIOMASS_COLOR_CORE);
      gradient.addColorStop(1, BIOMASS_COLOR);
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (item.type === 'coin' && getCoinTier(item.value).maxValue === Infinity) {
      // Diamond tier — a faceted radial-gradient gem plus cut-angle facet
      // lines and a bright sparkle highlight, per direct request ("make the
      // diamond colored coins... look more like a circular gem than a
      // coin") instead of the flat single-color fill every other coin tier
      // gets below.
      const gemGradient = ctx.createRadialGradient(
        pos.x - item.radius * 0.3, pos.y - item.radius * 0.3, item.radius * 0.1,
        pos.x, pos.y, item.radius
      );
      gemGradient.addColorStop(0, DIAMOND_GEM_COLOR_CORE);
      gemGradient.addColorStop(1, DIAMOND_GEM_COLOR_EDGE);
      ctx.beginPath();
      ctx.fillStyle = gemGradient;
      ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(pos.x + Math.cos(angle) * item.radius, pos.y + Math.sin(angle) * item.radius);
        ctx.lineTo(pos.x - Math.cos(angle) * item.radius, pos.y - Math.sin(angle) * item.radius);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(pos.x - item.radius * 0.32, pos.y - item.radius * 0.32, item.radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    if (item.type === 'alien_egg') {
      // A shrinking countdown ring on top of the flat shell fill, so the
      // player can see roughly how long until it hatches.
      ctx.beginPath();
      ctx.fillStyle = ALIEN_EGG_COLOR;
      ctx.arc(pos.x, pos.y, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const hatchFrac = Math.min(1, (item.hatchTimer || 0) / ALIEN_EGG_HATCH_MS);
      ctx.strokeStyle = ALIEN_EGG_RING_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, item.radius + 3, -Math.PI / 2, -Math.PI / 2 + hatchFrac * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(pos.x - item.radius * 0.32, pos.y - item.radius * 0.32, item.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    let itemColor = ITEM_FLAT_COLOR_BY_TYPE[item.type] || getCoinColor(item.value);
    // A "stale" gray phase, per direct spec — once a Food pellet's own
    // stationary timer crosses FOOD_STALE_FRACTION (75%) of the way to
    // turning into Waste, tint it toward FOOD_STALE_COLOR. Reading straight
    // off the live timer (which Entities.js's updateFood already resets to 0
    // the instant the pellet genuinely moves) means "the color resets" the
    // moment it's dragged/nudged falls out for free, with no extra state.
    if (item.type === 'food') {
      const rawFrac = (item.stationaryTimer || 0) / FOOD_STATIONARY_TO_WASTE_MS;
      const staleT = Math.max(0, Math.min(1, (rawFrac - FOOD_STALE_FRACTION) / (1 - FOOD_STALE_FRACTION)));
      if (staleT > 0) itemColor = lerpRgbToString(hexToRgb(FOOD_COLOR), hexToRgb(FOOD_STALE_COLOR), staleT);
    }
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
        // Tries both splice orderings — see the mouseup handler's own
        // identical fix above for why: whichever half of a splice pair got
        // grabbed first, dropping it on the other half should show as valid.
        combineHoverValid = canCombineFish(state, dragged, hoverTarget)
          || canSpliceFish(state, dragged, hoverTarget)
          || canSpliceFish(state, hoverTarget, dragged);
      }
    }
  }

  // Alien Invasion: portals (animated open, hold, then close — see
  // Entities.js's updateAlienPortals for the timing this mirrors) and
  // aliens themselves (with a health bar above each), rendered as their own
  // pass BEFORE fish now — per direct report ("make all the fish and their
  // health bars on top of the aliens visually, so they don't disappear
  // behind the aliens"), swapped from the old fish-then-alien order so a
  // fish drawn later (on top) can never be hidden by an alien overlapping
  // it on screen. Portals are plain state.level.alienPortals data
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
    // Dynamic Alien Archetypes: each alien's own radius/color (copied from
    // its archetype at creation — see Entities.js's createAlien) drive
    // these now instead of the flat ALIEN_RADIUS/ALIEN_COLOR constants,
    // which stay only as a defensive fallback.
    const baseRadius = (alien.radius ?? ALIEN_RADIUS) * state.camera.zoom;
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
    const alienBaseColor = alien.color || ALIEN_COLOR;
    const color = flashFrac > 0 ? lerpRgbToString(hexToRgb(alienBaseColor), ALIEN_HIT_FLASH_COLOR, flashFrac) : alienBaseColor;
    const facing = alien.vx >= 0 ? 1 : -1;
    // Nearest fish, for the cyclops eye's pupil to track — a plain O(n)
    // scan over entities is cheap enough here (at most ALIEN_MAX_ALIVE
    // aliens, each doing this once per frame). Falls back to looking
    // straight ahead (the alien's own facing direction) if no fish exist.
    let nearestFish = null;
    let nearestDist = Infinity;
    for (const other of state.level.entities) {
      if (other.type !== 'fish' || other.dying) continue; // a dying fish (see updateDyingFish) is already dead — not something a still-living alien should gaze toward
      const d = Math.hypot(other.x - alien.x, other.y - alien.y);
      if (d < nearestDist) { nearestDist = d; nearestFish = other; }
    }
    const gazeAngle = nearestFish ? Math.atan2(nearestFish.y - alien.y, nearestFish.x - alien.x) : (facing > 0 ? 0 : Math.PI);
    drawAlienBody(ctx, pos.x, pos.y, radius, facing, color, gazeAngle, alien.spikes, alien.bodyWidthMul, alien.bodyHeightMul, alien.glow, alienBaseColor);

    // Alien-Egg hatch grace period — a soft pulsing shield ring, so a click
    // or turret shot doing nothing to it doesn't read as broken.
    if (alien.spawnProtectionUntilMs > state.level.elapsed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 220, 255, 0.7)';
      ctx.lineWidth = Math.max(1, 2 * state.camera.zoom);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, baseRadius + 6 * state.camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Per direct spec ("when mother alien fish is on screen, have a
    // universal boss health bar at the top middle of the screen instead of
    // over the boss's head") — the boss gets NO per-head bar at all;
    // UI.js's updateBossHealthBar (called once per frame from render()'s
    // own tail, alongside updateHUD) owns its dedicated top-middle DOM bar
    // instead.
    if (!alien.isBoss) {
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
  }

  for (const fish of state.level.entities) {
    if (fish.type !== 'fish') continue; // state.level.entities also holds Alien Invasion aliens now — rendered separately above, BEFORE this loop, so fish (and their health bars) always draw on top and never disappear behind an alien
    const pos = worldToScreen(fish.x, fish.y, state.camera);
    if (pos.x < -60 || pos.x > canvas.width + 60 || pos.y < -60 || pos.y > canvas.height + 60) continue; // cull offscreen
    const def = SPECIES[fish.speciesId];

    // Death animation — per direct request, a dying fish (starved, or
    // killed by an alien; see Entities.js's beginFishDeathAnimation/
    // updateDyingFish) skips every bit of normal rendering below (eye
    // tracking, hunger sickness tint, Mutagen glow, the health bar) in
    // favor of a plain fully-gray body that fades out over the animation's
    // final FISH_DEATH_FADE_DURATION_MS — drawn with the same drawFish call
    // every other fish uses (grayed=1), just wrapped in a fading
    // globalAlpha so it's a strict subset of that function's existing
    // rendering, not a second bespoke fish drawing.
    if (fish.dying) {
      const fadeElapsed = fish.deathElapsedMs - FISH_DEATH_RISE_DURATION_MS;
      const alpha = fadeElapsed <= 0 ? 1 : Math.max(0, 1 - fadeElapsed / FISH_DEATH_FADE_DURATION_MS);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawFish(ctx, pos.x, pos.y, fish.speciesId, fish.stage, fish.deathFacing, fish.tailPhase, null, fish.starTier || 1, 0, 1, state.meta.equippedHatId);
      ctx.restore();
      continue;
    }

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

    // Mutagen Paste's Adult buff — per direct spec ("applies a glowing
    // visual effect... the buff and glow clear as soon as the fish
    // transitions back to the hungry state"). A persistent soft pulsing
    // halo (not the one-shot shimmer sweep below, which is a completely
    // separate, already-established effect for a different trigger — a
    // stage advance/placement/merge) drawn behind the fish for as long as
    // fish.mutagenBuffActive stays true (see Entities.js's updateFish).
    if (fish.mutagenBuffActive) {
      const glowRadius = size * state.camera.zoom * (0.9 + 0.15 * Math.sin(performance.now() / 260));
      const glowColor = hexToRgb(MUTAGEN_PASTE_COLOR);
      ctx.save();
      const glowGradient = ctx.createRadialGradient(pos.x, pos.y, glowRadius * 0.2, pos.x, pos.y, glowRadius);
      glowGradient.addColorStop(0, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0.45)`);
      glowGradient.addColorStop(1, `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, 0)`);
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Magnet Fish's own area-of-effect ring, drawn only while its magnet is
    // actually on — per direct request ("Add in an area of affect animation
    // that shows the area of the magnet for the magnet fish"). A soft
    // filled disc plus a crisper outline ring at the true force radius, both
    // gently pulsing, so the range reads clearly without looking like a
    // static UI overlay.
    if (fish.speciesId === 'buffer_fish' && fish.magnetOn) {
      const magnetScreenRadius = BUFFER_FISH_MAGNET_RADIUS * state.camera.zoom;
      const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 500);
      ctx.save();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, magnetScreenRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 100, 255, ${0.06 * pulse})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(160, 100, 255, ${0.35 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // A quick one-shot squash/stretch bounce the instant a toggleable
    // hybrid's ability is turned ON (see toggleFishAbility) — per direct
    // request. Plays once off a plain elapsed-time check (no field needs
    // clearing once it's done — FISH_TOGGLE_BOUNCE_DURATION_MS after
    // toggleBounceStartedAt, this branch simply stops matching).
    let bounceX = 1, bounceY = 1;
    if (fish.toggleBounceStartedAt != null) {
      const bounceT = (state.level.elapsed - fish.toggleBounceStartedAt) / FISH_TOGGLE_BOUNCE_DURATION_MS;
      if (bounceT >= 0 && bounceT < 1) {
        const wobble = Math.sin(bounceT * Math.PI) * (1 - bounceT);
        bounceX = 1 + wobble * FISH_TOGGLE_BOUNCE_AMOUNT;
        bounceY = 1 - wobble * FISH_TOGGLE_BOUNCE_AMOUNT;
      }
    }
    if (bounceX !== 1 || bounceY !== 1) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.scale(bounceX, bounceY);
      ctx.translate(-pos.x, -pos.y);
    }
    drawFish(ctx, pos.x, pos.y, fish.speciesId, fish.stage, facing, fish.tailPhase, eyeDirection, fish.starTier || 1, sickness, grayed, state.meta.equippedHatId);
    if (bounceX !== 1 || bounceY !== 1) ctx.restore();

    // A fish's health bar only ever renders while it's actually missing
    // health, per direct request — full health, no bar at all. Same
    // roundRect-pill shape as an alien's own bar (see below), just smaller
    // and green-to-red (instead of a flat red) so the two read as visually
    // distinct even when a damaged fish and an alien share the screen.
    if (fish.hp < fish.maxHp) {
      const fbarW = FISH_HEALTH_BAR_WIDTH * state.camera.zoom;
      const fbarH = FISH_HEALTH_BAR_HEIGHT * state.camera.zoom;
      const fbarX = pos.x - fbarW / 2;
      const fbarY = pos.y - size - fbarH - 6;
      const fbarRadius = fbarH / 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(fbarX, fbarY, fbarW, fbarH, fbarRadius);
      ctx.fillStyle = 'rgba(10, 20, 10, 0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = Math.max(0.5, 0.5 * state.camera.zoom);
      ctx.stroke();
      const fhpFrac = Math.max(0, fish.hp / fish.maxHp);
      if (fhpFrac > 0) {
        ctx.beginPath();
        ctx.roundRect(fbarX, fbarY, Math.max(fbarH, fbarW * fhpFrac), fbarH, fbarRadius);
        const fbarGradient = ctx.createLinearGradient(fbarX, fbarY, fbarX, fbarY + fbarH);
        fbarGradient.addColorStop(0, '#8aff9a');
        fbarGradient.addColorStop(1, '#2fb84a');
        ctx.fillStyle = fbarGradient;
        ctx.fill();
      }
      ctx.restore();
    }

    // Buffer Fish's magnet — a pulsing cyan ring while toggled on, per
    // direct spec, so it's obvious at a glance which fish are actively
    // pulling Waste toward them.
    if (fish.speciesId === 'buffer_fish' && fish.magnetOn) {
      const ringRadius = size * state.camera.zoom * (1.15 + 0.1 * Math.sin(performance.now() / 220));
      ctx.save();
      ctx.strokeStyle = 'rgba(95, 200, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Feeder Fish's auto-food dispenser — a pulsing orange ring while toggled
    // on, per direct spec ("with a visual for when on"), same pulsing-ring
    // treatment the Buffer Fish's own magnet already gets. While off, it's
    // generating power instead — no ring, matching every other Generator
    // fish's lack of a status ring.
    if (fish.speciesId === 'zap_sucker' && fish.autoFoodOn) {
      const ringRadius = size * state.camera.zoom * (1.15 + 0.1 * Math.sin(performance.now() / 220));
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 178, 56, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Xeno Octopus's Bio-Sludge mode — a pulsing acid-green ring while
    // toggled on, matching Bio-Sludge's own item color.
    if (fish.speciesId === 'xeno_octopus' && fish.alienDnaModeOn) {
      const ringRadius = size * state.camera.zoom * (1.15 + 0.1 * Math.sin(performance.now() / 220));
      ctx.save();
      ctx.strokeStyle = 'rgba(124, 255, 90, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Catalyst Fish — a steady gold ring while armed (waiting for the next
    // building click) and a brief brighter flash on either a fresh link or
    // a re-click revealing the current one, per direct spec ("both the fish
    // and the building will flash").
    if (fish.speciesId === 'catalyst_fish') {
      if (catalystArmedFishId === fish.id) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 224, 102, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * state.camera.zoom * 1.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (fish.catalystFlashUntilMs > state.level.elapsed) {
        const flashT = (fish.catalystFlashUntilMs - state.level.elapsed) / CATALYST_FLASH_DURATION_MS;
        ctx.save();
        ctx.globalAlpha = Math.max(0, flashT);
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * state.camera.zoom * 1.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

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

    // Persistent, subtler recurring shimmer for as long as a toggleable
    // hybrid's ability stays ON (Magnet Fish's magnet, Feeder Fish's
    // dispenser, Xeno Octopus's Bio-Sludge mode) — per direct request
    // ("during the time the fish ability is on, have the fish shimmer
    // slightly"). Same recurring-sweep machinery the Mound/Science Lab
    // already use, just lazily created per-fish the first time it's needed,
    // at a lower peak alpha than the one-shot growth/placement sweep above
    // so it genuinely reads as "slight."
    if (fish.abilityToggleOnSince != null) {
      if (!fish.abilityShimmerTimer) fish.abilityShimmerTimer = createShimmerTimer();
      const abilityShimmerT = updateShimmerTimer(fish.abilityShimmerTimer, state.level.elapsed);
      if (abilityShimmerT !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = shimmerFadeAlpha(abilityShimmerT) * 0.5;
        drawShimmerSweep(ctx, abilityShimmerT, pos.x - size, pos.y - size, size * 2, size * 2);
        ctx.restore();
      }
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

    // The fish info modal's own locked fish gets a highlight ring — per
    // direct request ("Keep that one fish locked into place and highlight
    // the fish while it's modal is open so it's visually obvious what fish
    // the modal belongs to"). A gently pulsing gold ring, distinct from the
    // white/green/red combine-drag rings just above.
    if (fish.id === state.ui.fishInfoModalFishId) {
      const ringPulse = 0.8 + 0.2 * Math.sin(performance.now() / 400);
      ctx.strokeStyle = `rgba(255, 200, 60, ${ringPulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Per direct request — a small dot next to the "!"/"!!" indicator below
    // showing WHAT this fish is hungry for: FOOD_COLOR for an ordinary
    // Food-eater, WASTE_COLOR for a Scavenger (eats Waste, never Food) —
    // same two colors every other Food/Waste item in the game already uses,
    // so it reads as "the same stuff," not a new, unrelated icon language.
    // A Scavenger's own hunger is hard-clamped below
    // HUNGER_CRITICAL_THRESHOLD now (see Entities.js's updateFish), so in
    // practice this only ever shows next to its "!", never a "!!".
    const hungerIconColor = def.behavior.includes('SCAVENGER') ? WASTE_COLOR : FOOD_COLOR;
    if (fish.hunger >= HUNGER_CRITICAL_THRESHOLD) {
      // Per direct request — bounces slowly at first, then much more
      // aggressively once the 2nd of the 4 hunger chimes has played (see
      // Config.js's own comment on the 4 constants below). A repeating
      // half-sine, always jumping UP from the resting position rather than
      // floating symmetrically, is what reads as a genuine "bounce."
      const aggressiveBounce = fish.hungerChimesPlayed >= 2;
      const bouncePeriodMs = aggressiveBounce ? HUNGER_ICON_BOUNCE_FAST_PERIOD_MS : HUNGER_ICON_BOUNCE_SLOW_PERIOD_MS;
      const bounceAmplitudePx = aggressiveBounce ? HUNGER_ICON_BOUNCE_FAST_AMPLITUDE_PX : HUNGER_ICON_BOUNCE_SLOW_AMPLITUDE_PX;
      const bounceOffset = -Math.abs(Math.sin((state.level.elapsed / bouncePeriodMs) * Math.PI)) * bounceAmplitudePx;
      ctx.fillStyle = '#ff3b3b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('!!', pos.x - 6, pos.y - size * 0.5 - 4 + bounceOffset);
      ctx.beginPath();
      ctx.arc(pos.x - 14, pos.y - size * 0.5 - 8 + bounceOffset, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = hungerIconColor;
      ctx.fill();
    } else if (fish.hunger >= HUNGER_SEEK_THRESHOLD) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '10px sans-serif';
      ctx.fillText('!', pos.x - 2, pos.y - size * 0.5 - 4);
      ctx.beginPath();
      ctx.arc(pos.x - 9, pos.y - size * 0.5 - 7, 3, 0, Math.PI * 2);
      ctx.fillStyle = hungerIconColor;
      ctx.fill();
    }
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
    // Dynamic Alien Archetypes: the burst now uses the actual alien's own
    // tier color (stored on the effect at push time — Entities.js's
    // updateAlien death branch) instead of a hardcoded flat ALIEN_COLOR
    // rgba, falling back to it for any effect somehow missing one.
    const effectColor = hexToRgb(effect.color || ALIEN_COLOR);
    ctx.fillStyle = `rgba(${effectColor.r}, ${effectColor.g}, ${effectColor.b}, 0.9)`;
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

  // "On fire, disintegrating" — per direct request, replacing the old plain
  // bubble-pop icon for a blocked COIN drop, then extended to a blocked
  // SCIENCE brew too ("use a science icon and do that animation when the
  // science bubble cap is reached"). A shrinking icon (a gold coin, or a
  // purple/blue Science bubble — same two-tone gradient the real physical
  // Science item uses) with a couple of flickering flame licks above it and
  // a few dark ember/ash flecks drifting up and outward as it crumbles, all
  // fading together over PRODUCTION_BLOCKED_EFFECT_DURATION_MS. Purely
  // decorative — see Entities.js's triggerProductionBlocked/
  // updateProductionBlockedEffects for the trigger and age-and-cull side.
  for (const effect of state.level.productionBlockedEffects) {
    const pos = worldToScreen(effect.x, effect.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const t = effect.age / PRODUCTION_BLOCKED_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    const baseRadius = effect.resource === 'science' ? SCIENCE_ITEM_RADIUS : COIN_RADIUS;
    const radius = baseRadius * state.camera.zoom * (1 - t * 0.5); // shrinks as it burns down
    ctx.save();
    ctx.globalAlpha = alpha;

    // A couple of flickering flame licks fanned above the icon — a radial
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

    // The icon itself, shrinking — a plain gold disc with a darker rim for a
    // blocked coin, or the same two-tone purple/blue gradient sphere the
    // real physical Science Bubble item uses for a blocked science brew.
    if (effect.resource === 'science') {
      const gradient = ctx.createRadialGradient(
        pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1,
        pos.x, pos.y, radius
      );
      gradient.addColorStop(0, SCIENCE_ITEM_COLOR_B);
      gradient.addColorStop(1, SCIENCE_ITEM_COLOR_A);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120, 70, 10, 0.6)';
      ctx.lineWidth = Math.max(1, radius * 0.15);
      ctx.stroke();
    }

    // Crumbling ash/ember flecks, drifting up and outward from the icon as
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

  // Fish mouth bubbles — per direct request, duplicating Ambience.js's own
  // background-bubble look (a stroked ring plus a small glossy highlight
  // dot, low opacity, sideways sine wobble as it rises) for a one-shot
  // transient effect instead of that file's fixed recycling pool. Fades out
  // over its own last 30% of life instead of popping off abruptly. Purely
  // decorative — see Entities.js's emitFishBubble/updateFishBubbleEffects.
  for (const b of state.level.fishBubbleEffects) {
    const wobbleX = Math.sin((b.age / 1000) * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const pos = worldToScreen(b.x + wobbleX, b.y, state.camera);
    if (pos.x < -20 || pos.x > canvas.width + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue;
    const lifeT = b.age / FISH_BUBBLE_LIFETIME_MS; // 0 -> 1
    const fadeAlpha = lifeT > 0.7 ? 1 - (lifeT - 0.7) / 0.3 : 1;
    const r = b.radius * state.camera.zoom;
    ctx.save();
    ctx.globalAlpha = 0.32 * fadeAlpha;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = Math.max(1, state.camera.zoom);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.45 * fadeAlpha;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(pos.x - r * 0.3, pos.y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
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

  // Building-move hover hint / in-progress state — per direct request
  // ("Remove the right click hover tooltip from the fans. Instead, anytime
  // the cursor is over a building, add to the legend in the bottom left,
  // 'Right-click to Adjust' or 'Right-click to Move'... If they right click
  // the building, add... 'Left-click to accept' and 'Right-click to
  // cancel'"), with the arming half later moved to middle-click ("right-
  // click to move is changed to middle-click to move" — UI.js's updateHUD
  // is what actually swaps the legend text). Computed here into state.ui
  // rather than drawn on canvas — UI.js's updateHUD reads it to drive the
  // bottom-left legend, the same cross-module-flag pattern this file
  // already uses for wasteTurretAmmoGainedPending/chestItemAbsorbedPending,
  // since UI.js can't be imported back into here without a circular
  // dependency.
  if (movingBuilding != null || (isFanAimingActive() && fanAimingMoveData != null)) {
    state.ui.buildingMoveArmed = true;
    state.ui.buildingMoveHoverLabel = null;
  } else {
    state.ui.buildingMoveArmed = false;
    if (isCursorOrFoodTool(hoverEffectiveTool) && input.mouse.inside && !state.ui.paused) {
      const { col: hoverCol, row: hoverRow } = worldToTile(hoverWorld.x, hoverWorld.y);
      const hoverTile = getTile(state.level.grid, hoverCol, hoverRow);
      state.ui.buildingMoveHoverLabel = hoverTile && hoverTile !== TILE_EMPTY
        ? (FAN_BUILDING_IDS.includes(hoverTile) ? 'adjust' : (PLATFORM_BUILDING_IDS.includes(hoverTile) ? 'move-platform' : 'move'))
        : null;
    } else {
      state.ui.buildingMoveHoverLabel = null;
    }
  }

  // Fish merge/splice hover legend — see state.ui.fishMergeHoverLines' own
  // comment. Only computed while nothing else is already claiming the
  // bottom-left legend spot (no building hovered/moving, no cost legend for
  // an armed build:/fish: tool) and no drag is in progress, so this never
  // fights those for the same on-screen slot. Splicing now works "at any
  // time" (see the mousedown handler's own comment), so this hover legend
  // deliberately isn't gated on any particular tool either.
  if (
    input.mouse.inside && !state.ui.paused && !state.level.tutorialFlow &&
    draggedFishId == null && !state.ui.buildingMoveArmed && state.ui.buildingMoveHoverLabel == null &&
    !hoverEffectiveTool.startsWith('build:') && !hoverEffectiveTool.startsWith('fish:') && blueprintClipboard == null
  ) {
    const hoverFish = findFishAt(state, hoverWorld.x, hoverWorld.y);
    state.ui.fishMergeHoverLines = hoverFish ? describeFishMergeOptions(state, hoverFish) : null;
  } else {
    state.ui.fishMergeHoverLines = null;
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
  // actually grab the real one (draggedItemId != null while holding a
  // Waste) — the whole point was showing WHERE to drag, not competing for
  // attention once they're already doing it.
  if (isWasteDragTutorialStepActive(state) && !(draggedItemId != null && draggedItemType === 'waste')) {
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

  // Manufacturer/Power Plant drag-to-copy-recipe ghost — a translucent
  // building icon that follows the raw cursor (screen space) while a
  // drag is armed, per direct request ("a ghost icon of the building will
  // go on the cursor"). Green-tinted while hovering a valid same-type
  // target, a neutral white tint otherwise.
  if (recipeDragSourceKey !== null) {
    const def = BUILDING_TYPES[recipeDragType];
    const gx = input.mouse.x;
    const gy = input.mouse.y;
    const gsize = TILE_SIZE * state.camera.zoom;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = recipeDragHoverKey ? 'rgba(124, 255, 90, 0.55)' : 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = recipeDragHoverKey ? '#7cff5a' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx - gsize / 2, gy - gsize / 2, gsize, gsize, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${gsize * 0.55}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, gx, gy + 1);
    ctx.restore();
  }

  // Platform drag-to-copy-filter ghost — same shape as the recipe-drag one
  // just above, a plain green checkmark standing in for "you're carrying a
  // copied filter" rather than a specific building icon, since the filter
  // being copied isn't tied to any one building's own art.
  if (platformFilterDragSourceKey !== null) {
    const gx = input.mouse.x;
    const gy = input.mouse.y;
    const gsize = TILE_SIZE * state.camera.zoom;
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = platformFilterDragHoverKey ? 'rgba(124, 255, 90, 0.55)' : 'rgba(255, 255, 255, 0.4)';
    ctx.strokeStyle = platformFilterDragHoverKey ? '#7cff5a' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx - gsize / 2, gy - gsize / 2, gsize, gsize, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = `${gsize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✅', gx, gy + 1);
    ctx.restore();
  }

  // Mother Alien Fish's reveal — the screen turning white, per direct spec.
  // Two halves, covering the two different moments this can be visible:
  // fading IN during the last BOSS_WHITE_FADE_IN_MS of the 'intro_wait'
  // phase itself (computed live from bossIntroTimerMs, no separate stored
  // timestamp needed since that phase's own clock already has everything
  // this needs), and fading back OUT right after the boss actually spawns
  // (bossWhiteFadeOutUntilMs, set once at that exact moment — same "fades
  // out linearly over its own duration" shape the single old flash used).
  if (state.level.bossPhase === 'intro_wait') {
    const fadeInProgress = (state.level.bossIntroTimerMs - BOSS_WHITE_FADE_IN_START_MS) / BOSS_WHITE_FADE_IN_MS;
    const alpha = Math.max(0, Math.min(1, fadeInProgress));
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  } else if (state.level.elapsed < state.level.bossWhiteFadeOutUntilMs) {
    const remaining = (state.level.bossWhiteFadeOutUntilMs - state.level.elapsed) / BOSS_WHITE_FADE_OUT_MS;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, remaining));
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  updateBossHealthBar(state);
  updateHUD(state);
  updateNotificationTicker(state);
  renderMinimap(state);
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
  // state.ui.speedX2 (the player-facing 2x speed button/hotkey) stacks
  // multiplicatively on top of the debug time-scale cheat rather than
  // replacing it — the debug +/- keys are a dev tool independent of this
  // player feature, and there's no real-world case where a player toggles
  // both at once, so simplicity wins over guarding against it.
  getTimeScale: () => TIME_SCALE_STEPS[state.debug.timeScaleIndex] * (state.ui.speedX2 ? 2 : 1),
  simDtMs: SIM_DT_MS,
  maxFrameSkip: MAX_FRAME_SKIP,
});
