// main.js — entry point. Owns the root state object's initial shape, loads
// the first level through the real level-load path, and wires the rAF loop.
// Forbidden: no gameplay logic, no direct entity manipulation — that all
// happens in Entities.js/Levels.js, called from here.

import {
  COIN_SPIN_SETTLE_MS,
  SPECIES,
  SPECIES_LIST,
  BUILDING_LIST,
  BUILDING_TYPES,
  FISH_COLORS,
  FISH_BASE_SIZE,
  HUNGER_SEEK_THRESHOLD,
  HUNGER_CRITICAL_THRESHOLD,
  SCIENCE_BLOCKED_SICKNESS,
  FISH_MIN_X,
  FISH_MAX_X,
  FISH_MIN_Y,
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
  BUILDING_BUBBLE_RADIUS_MIN,
  BUILDING_BUBBLE_RADIUS_MAX,
  BUILDING_BUBBLE_RISE_SPEED_MIN,
  BUILDING_BUBBLE_RISE_SPEED_MAX,
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
  TURRET_MUZZLE_FLASH_DURATION_MS,
  TURRET_IMPACT_EFFECT_DURATION_MS,
  COIN_SPARKLE_EFFECT_DURATION_MS,
  COIN_SPARKLE_COLOR,
  APPRECIATE_PULSE_MS,
  APPRECIATE_PARTICLE_COUNT,
  APPRECIATE_PARTICLE_CYCLE_MS,
  APPRECIATE_PARTICLE_HALO_PX,
  APPRECIATE_PARTICLE_COLOR,
  FISH_GROWTH_ORBIT_RADIUS_PX,
  FISH_GROWTH_ORBIT_FOOD_RADIUS_PX,
  FISH_GROWTH_ORBIT_TRAIL_ARC_RAD,
  FISH_GROWTH_ABSORB_DURATION_MS,
  FISH_GROWTH_EFFECT_DURATION_MS,
  FISH_GROWTH_EFFECT_COLOR,
  COIN_RADIUS,
  PRODUCTION_BLOCKED_EFFECT_DURATION_MS,
  FISH_BUBBLE_LIFETIME_MS,
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
  FRIENDLY_ALIEN_COLOR,
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
  SEA_TURTLE_SPAWN_MIN_MS,
  SEA_TURTLE_SPAWN_MAX_MS,
  SEA_TURTLE_SPEED_PX_PER_S,
  SEA_TURTLE_WORLD_Y,
  SEA_TURTLE_BOB_AMPLITUDE_PX,
  SEA_TURTLE_BOB_PERIOD_MS,
  SEA_TURTLE_RADIUS_PX,
  SEA_TURTLE_BABY_MIN_COUNT,
  SEA_TURTLE_BABY_MAX_COUNT,
  SEA_TURTLE_BABY_SPACING_PX,
  SEA_TURTLE_BABY_MAX_SCALE,
  SEA_TURTLE_BABY_MIN_SCALE,
  SEA_TURTLE_BUBBLE_INTERVAL_MS,
  SEA_TURTLE_COLOR_SHELL,
  SEA_TURTLE_COLOR_SHELL_PATTERN,
  SEA_TURTLE_COLOR_SKIN,
  SEA_TURTLE_WAKE_SEGMENT_COUNT,
  SEA_TURTLE_WAKE_MAX_ALPHA,
  SEA_TURTLE_WAKE_START_FRACTION,
  SEA_TURTLE_WAKE_LENGTH_MULTIPLIER,
  SEA_TURTLE_WAKE_HEIGHT_FACTOR,
  SEA_TURTLE_WAKE_WOBBLE_PX,
  SEA_TURTLE_COIN_BASE_VALUE,
  SEA_TURTLE_COIN_VALUE_PER_COLLECT,
} from './Config.js';
import { worldToScreen, screenToWorld, createInput, updateCamera, createGameLoop } from './Engine.js';
import { pushGameNotification, flushPendingNotifications } from './Notifications.js';
import { isGuidedTutorialsEnabled, noteTutorialFlowStarted, noteTutorialFlowEnded } from './Save.js';
import { loadLevel, LEVELS } from './Levels.js';
import { updateStoryTriggers, updateAutosave } from './Systems.js';
import { updateAmbience, renderAmbienceBehindLab, renderAmbienceFrontLab, spawnCursorBubbles, renderWaterSurface, spawnSeaTurtleBubble, renderBackgroundParallaxDecor, renderShadowFish, renderDecorMask, drawGlossyBubble } from './Ambience.js';
import { resumeAudio, startGameMusic, startMenuMusic, playAlienHit, setBattleMusicActive, triggerBossMusic, playBuildPlace, playDemolish } from './Sound.js';
import {
  updateEntities,
  trySpawnFood,
  trySpawnPurchasedFish,
  tryBankCoinAt,
  spawnFishCheat,
  getCoinColor,
  getCoinTier,
  createCoin,
  getRipeningCoins,
  createPickupText,
  updatePickupText,
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
  findFishMergePartners,
  findMergeSubjectAt,
  canMergeOrSplicePair,
  canSpliceOctopusWithAlien,
  spliceOctopusWithAlien,
  createMotherAlienFish,
  spawnTurretTutorialWaste,
  spawnChestTutorialWaste,
  materializeChestSpawnPoints,
  computeGrowthOrbitPosition,
} from './Entities.js';
import {
  renderSeabedGrid,
  renderBuildGhost,
  renderFanAimGhost,
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
  setChestPourMode,
  clearChestContents,
  getBuildingAlertKind,
  pickUpBuildingsInBox,
  renderGroupMoveGhost,
  placeGroupMove,
  describeReplacement,
  placeTileWithReplace,
  applyPipetteData,
  collectDemolishSpawnPoints,
  startTileBreakAnimation,
  computeBlueprintCostWithReplace,
  placeBlueprintWithReplace,
  computeSnapLine,
  getUnlockedWorldH,
} from './Grid.js';
import { isPointOnMound, crackMound, renderMound, centerCameraOnMound, isPointOnScienceLab, renderScienceLab, renderMoundMask } from './Mound.js';
import { drawFish, drawFishCached, beginFishSpriteFrame, drawFishShadow } from './FishRenderer.js';
import { drawCachedText } from './TextSprites.js';
import { perfMark, perfUpdateBegin, perfUpdateEnd, perfRenderBegin, perfRenderEnd } from './PerfOverlay.js';
import { loadTitleFonts, initTitleScreen, showTitle, updateTitle, exitTitle, titleIsActive, titleBlocksWorldRender, titleNeedsBackdrop, captureTitleBackdrop } from './TitleScreen.js';
import { oneShotShimmerProgress, drawShimmerSweep, shimmerFadeAlpha, createShimmerTimer, updateShimmerTimer } from './Shimmer.js';
import {
  initUI,
  updateHUD,
  updateDebugOverlay,
  updateNotificationTicker,
  refreshShopPanel,
  toggleShopCollapse,
  toggleTankPanel,
  toggleLabMenu,
  openMoundMenu,
  openLabMenu,
  closeLabMenu,
  isLabMenuOpen,
  openRecipeMenu,
  openBuildingInfoMenu,
  openPlatformFilterMenu,
  openFishInfoMenu,
  closeFishInfoMenu,
  updateProductionInfoModal,
  updateGroupMoveInfoModal,
  closeProductionInfoModal,
  copyPlatformFilter,
  openStorageChestModal,
  setFavoriteSlotFromShop,
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
  closeAllModals,
  tutorialScrollDirectionNeeded,
  updateBossHealthBar,
  showGameOverModal,
  cycleSelectedBuildingFamily,
} from './UI.js';

const canvas = document.getElementById('game-canvas');
const mainCtx = canvas.getContext('2d');
// Mutable so the foreground render pass (render()'s Step 2, below) can
// temporarily point every existing ctx.* draw call at the offscreen
// foreground canvas instead, without touching the hundreds of call sites in
// this file that already read the module-level `ctx`. Always restored back
// to mainCtx before render() returns — see render()'s own Step 1-5 comment.
let ctx = mainCtx;

// ---- Caustic lighting overlay ----
// A looping, muted, hidden <video> used as a moving light texture (real
// caustic-simulation footage) rather than a procedural effect. Per direct
// spec, this must ONLY ever illuminate foreground content (active fish,
// foreground decor, coins, the soil bed) and never the background layer/
// background fish behind them — see render()'s Step 1-5 pipeline for how
// that clipping is actually done. Kept in the DOM (not display:none, which
// stops some browsers from decoding frames at all) but visually and
// interactively invisible.
const causticVideo = document.createElement('video');
causticVideo.src = 'lighting effect.mp4';
causticVideo.loop = false; // looped manually below, off a cached frame — see causticFrameCache's own comment for why
causticVideo.muted = true;
causticVideo.playsInline = true;
causticVideo.autoplay = true;
causticVideo.playbackRate = 0.8; // per direct request
causticVideo.style.position = 'absolute';
causticVideo.style.width = '1px';
causticVideo.style.height = '1px';
causticVideo.style.opacity = '0';
causticVideo.style.pointerEvents = 'none';
document.body.appendChild(causticVideo);
causticVideo.play().catch(() => {}); // autoplay can be blocked until the player's first click/tap — Start button click resumes it, see gameStarted handling elsewhere; harmless no-op if it never resolves

// Trimming both ends of the clip, progressively further each time, never
// made the reported black flash go away — confirming (per direct report)
// it's not baked into the footage at all, but an artifact of the manual
// currentTime reset itself: `.currentTime = x` starts an async seek, and the
// video element can return a blank/garbage decoded frame for the handful of
// frames until the browser's own 'seeked' event fires.
//
// Fixed by never drawing from `causticVideo` directly — instead, every frame
// where it ISN'T mid-seek, its current frame is copied into this cache
// canvas; compositeCausticForeground always reads from the cache instead.
// During a seek, the cache simply keeps showing the last good frame (a
// several-millisecond freeze on a slowly-drifting light texture, completely
// unnoticeable) instead of whatever transient frame the seek itself produces.
const causticFrameCache = document.createElement('canvas');
const causticFrameCacheCtx = causticFrameCache.getContext('2d');

const CAUSTIC_LOOP_KEEP_FRACTION = 2 / 3; // back to trimming just the tail, now that the reset itself (not the footage) is what's actually being fixed
function updateCausticVideoLoop() {
  if (causticVideo.playbackRate !== 0.8) causticVideo.playbackRate = 0.8; // some browsers reset this across a manual seek/loop restart
  if (causticVideo.duration && causticVideo.currentTime >= causticVideo.duration * CAUSTIC_LOOP_KEEP_FRACTION) {
    causticVideo.currentTime = 0;
  }
  // Performance: the video only advances ~24-30 times a second, so re-copying
  // it every render frame (at 60+) was wasted work — only copy when its
  // currentTime actually moved. The grayscale the light layer needs (see
  // compositeCausticForeground) is applied HERE, once per new video frame at
  // the video's own small size, instead of as a ctx.filter on every
  // full-screen tile draw every frame (canvas filters are a slow path).
  if (!causticVideo.seeking && causticVideo.readyState >= 2 && causticVideo.videoWidth > 0 && causticVideo.currentTime !== causticLastCachedTime && performance.now() - causticLastCacheAt >= CAUSTIC_CACHE_MIN_INTERVAL_MS) {
    if (causticFrameCache.width !== causticVideo.videoWidth || causticFrameCache.height !== causticVideo.videoHeight) {
      causticFrameCache.width = causticVideo.videoWidth;
      causticFrameCache.height = causticVideo.videoHeight;
    }
    causticLastCachedTime = causticVideo.currentTime;
    causticLastCacheAt = performance.now();
    causticFrameCacheCtx.drawImage(causticVideo, 0, 0);
    // Grayscale via a saturation blend (keeps each pixel's luminosity, zeroes
    // its saturation) rather than ctx.filter = 'grayscale(1)' — same result for
    // this soft light texture, but the canvas filter path measured far slower.
    causticFrameCacheCtx.globalCompositeOperation = 'saturation';
    causticFrameCacheCtx.fillStyle = '#808080';
    causticFrameCacheCtx.fillRect(0, 0, causticFrameCache.width, causticFrameCache.height);
    causticFrameCacheCtx.globalCompositeOperation = 'source-over';
  }
}
let causticLastCachedTime = -1;
// Also capped to ~20 copies a second: extracting a video frame is the single
// priciest step of this effect, and a slowly drifting light texture looks the
// same at 20fps as at 30+.
const CAUSTIC_CACHE_MIN_INTERVAL_MS = 50;
let causticLastCacheAt = -Infinity;

// Step 2's target — every foreground element (foreground decor, active fish,
// coins, soil bed) is drawn here instead of straight to the main canvas, so
// the caustic video can be clipped to exactly this layer's silhouette before
// being composited back on top of it. causticMaskCanvas is a scratch buffer
// used only to build that clipped-and-gradient-masked light layer (Steps 3-4)
// before it's screen-blended onto foregroundCanvas (still Step 4) and the
// whole thing is drawn onto the main canvas (Step 5).
const foregroundCanvas = document.createElement('canvas');
const foregroundCtx = foregroundCanvas.getContext('2d');
const causticMaskCanvas = document.createElement('canvas');
const causticMaskCtx = causticMaskCanvas.getContext('2d');
const CAUSTIC_LIGHT_SCALE = 0.5;
const causticLightCanvas = document.createElement('canvas');
const causticLightCtx = causticLightCanvas.getContext('2d');
let causticLightKey = null;

function resizeForegroundCanvases() {
  foregroundCanvas.width = canvas.width;
  foregroundCanvas.height = canvas.height;
  causticMaskCanvas.width = canvas.width;
  causticMaskCanvas.height = canvas.height;
}

// Builds the lit foreground layer (Steps 3-4) and draws it onto the main
// canvas (Step 5). Called once per frame, after every foreground element for
// this frame has already been drawn into foregroundCanvas (Step 2).
function compositeCausticForeground() {
  const w = canvas.width;
  const h = canvas.height;

  perfMark('r: fish + overlays', ctx);
  updateCausticVideoLoop();
  perfMark('r: caustic: video frame copy', ctx);

  // Step 3: clip the caustic video to the foreground's own silhouette. A
  // fresh copy of the foreground (not the foreground canvas itself) is used
  // as the clip mask, since 'source-in' would otherwise destroy the real
  // fish/decor artwork it's clipping against.
  if (causticFrameCache.width > 0) {
    // (The foreground copy that serves as the clip mask only happens when
    // there's actually a light frame to clip — with no caustic video (e.g. the
    // file isn't served) this whole branch, a full-screen clear + copy +
    // blend, is skipped.)
    // Performance: the light itself (video tiles + the vertical fade) only
    // changes when the video advances a frame or the camera moves, so it's
    // built into causticLightCanvas only then, at half resolution (it's a soft
    // texture, so the lower resolution is invisible) — instead of redrawing
    // every tile and the full-screen fade every single frame. Per frame, all
    // that's left is clipping it to the foreground's silhouette (below).
    const camera = state.camera;
    const tankWorldH = getUnlockedWorldH(state);
    const lightKey = causticLastCachedTime + ',' + w + ',' + h + ',' + camera.x + ',' + camera.y + ',' + camera.zoom + ',' + tankWorldH;
    const lw = Math.max(1, Math.ceil(w * CAUSTIC_LIGHT_SCALE));
    const lh = Math.max(1, Math.ceil(h * CAUSTIC_LIGHT_SCALE));
    if (lightKey !== causticLightKey) {
      if (causticLightCanvas.width !== lw || causticLightCanvas.height !== lh) {
        causticLightCanvas.width = lw;
        causticLightCanvas.height = lh;
      }
      causticLightCtx.setTransform(1, 0, 0, 1, 0, 0);
      causticLightCtx.clearRect(0, 0, lw, lh);
      causticLightCtx.setTransform(CAUSTIC_LIGHT_SCALE, 0, 0, CAUSTIC_LIGHT_SCALE, 0, 0); // everything below is in full-resolution screen coordinates

      // Tiled and positioned entirely in world space — per direct request, the
      // effect must stay constant relative to the world (both its scale and
      // its scroll position), not the screen/canvas. One tile is exactly
      // WORLD_W wide (matching the tank), so it scales with zoom exactly like
      // every other world object instead of always stretching to fill whatever
      // the current canvas width happens to be; world (0,0) always lands
      // exactly on a tile's top-left corner, so tiles track the camera 1:1 on
      // both axes, vertical tiling repeating the same way for a tank taller
      // than one tile. Reads from causticFrameCache, never causticVideo
      // directly (see that cache's own comment), which is already grayscale.
      const videoAspect = causticFrameCache.height / causticFrameCache.width;
      const tileWorldW = WORLD_W;
      const tileWorldH = tileWorldW * videoAspect;
      const tileScreenW = tileWorldW * camera.zoom;
      const tileScreenH = tileWorldH * camera.zoom;
      const tileScreenX = -camera.x * camera.zoom;
      const camScreenOffsetY = camera.y * camera.zoom;
      let tileScreenY = -(((camScreenOffsetY % tileScreenH) + tileScreenH) % tileScreenH);
      while (tileScreenY < h) {
        causticLightCtx.drawImage(causticFrameCache, tileScreenX, tileScreenY, tileScreenW, tileScreenH);
        tileScreenY += tileScreenH;
      }

      // Step 4: vertical fade — brightest near the water's top, reaching 0%
      // opacity 20% of the tank's height up from the bottom (i.e. 80% of the
      // way down) and staying at 0% the rest of the way down. Anchored to
      // world Y (getUnlockedWorldH(state), the tank's current real height),
      // converted to screen space here, rather than a fixed screen-height
      // fraction — per direct request, this must stay pinned to the same
      // depth in the tank regardless of window size/zoom, not shift around
      // with the screen.
      causticLightCtx.globalCompositeOperation = 'destination-in';
      const CAUSTIC_FADE_TANK_FRACTION = 0.8;
      const fadeTopScreenY = (0 - camera.y) * camera.zoom;
      const fadeBottomScreenY = (tankWorldH * CAUSTIC_FADE_TANK_FRACTION - camera.y) * camera.zoom;
      const gradient = causticLightCtx.createLinearGradient(0, fadeTopScreenY, 0, fadeBottomScreenY);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      causticLightCtx.fillStyle = gradient;
      causticLightCtx.fillRect(0, 0, w, h);
      causticLightCtx.globalCompositeOperation = 'source-over';
      causticLightCtx.setTransform(1, 0, 0, 1, 0, 0);
      causticLightKey = lightKey;
    }

    // Step 3: clip that light to the foreground's own silhouette. A fresh copy
    // of the foreground (not the foreground canvas itself) is the clip mask,
    // since 'source-in' would otherwise destroy the real fish/decor artwork
    // it's clipping against.
    perfMark('r: caustic: light layer build', ctx);
    causticMaskCtx.globalCompositeOperation = 'copy'; // replaces the old clear + draw pair with one full-screen pass
    causticMaskCtx.drawImage(foregroundCanvas, 0, 0);
    perfMark('r: caustic: mask copy of foreground', ctx);
    causticMaskCtx.globalCompositeOperation = 'source-in';
    causticMaskCtx.drawImage(causticLightCanvas, 0, 0, lw, lh, 0, 0, w, h);
    causticMaskCtx.globalCompositeOperation = 'source-over';
    perfMark('r: caustic: clip light to mask', ctx);

    // Screen-blend the clipped, gradient-masked light back onto the real
    // foreground art — brightens only the foreground pixels it's clipped to,
    // never the background layer (which was never drawn into either canvas
    // here) and never the far background behind it.
    foregroundCtx.globalCompositeOperation = 'screen';
    foregroundCtx.drawImage(causticMaskCanvas, 0, 0);
    foregroundCtx.globalCompositeOperation = 'source-over';
    perfMark('r: caustic: screen-blend onto foreground', ctx);
  }

  // Step 5: the completed, lit foreground layer onto the main canvas.
  mainCtx.drawImage(foregroundCanvas, 0, 0);
  perfMark('r: caustic: blit foreground to main', ctx);
}

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
  const totalWorldH = getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX;
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
  const maxY = Math.max(0, getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX - viewH);
  state.camera.y = Math.max(0, Math.min(clickY / scale - viewH / 2, maxY));
});

// ---- Tank-viewport zoom (the minimap's own expand/minimize button) ----
// Per direct request: "zoom to fit" computes a zoom that fits the ENTIRE
// tank (world width AND total height, whichever is the tighter constraint)
// within the viewport at once, so nothing needs scrolling; toggling back to
// "fit to width" instead zooms so the tank's full WIDTH exactly fills the
// viewport, ignoring height (the normal "scroll to see more" zoom).
// Defaults to 'width' per a later direct request ("start the game in fit to
// width mode") — index.html's own #minimap-expand-btn already ships with
// the '⤢'/"Zoom to fit the whole tank" label that matches this being the
// STARTING mode (that label describes what clicking it next would do), so
// no DOM change was needed alongside this. Still overridden the instant the
// player clicks that button (toggleTankZoomMode below), same as before.
let tankZoomMode = 'width'; // null | 'whole' | 'width'
// Per direct report ("the zoom to fit isn't completely zoom to fit, I can
// still scroll... zoom out enough that you can't scroll up or down at
// all") — the real scrollable range Engine.js's updateCamera clamps against
// is getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX (the extra buffer
// strip reserved for the fixed bottom tool-bar — see that constant's own
// comment), NOT just the tank's real bottom on its own. Fitting zoom to
// that bottom alone left viewH just short of the buffer's own height, so
// maxY (bottom + buffer - viewH) stayed slightly positive — a small but
// real amount of scroll was still possible. Using the full scrollable
// height here instead makes viewH >= that whole range, which drives maxY
// to (clamped) exactly 0. (getUnlockedWorldH replaced a fixed WORLD_H
// constant here once Tank Expansion made the tank's real bottom vary with
// the player's purchased tier — see Grid.js's own comment on it.)
function computeFitWholeTankZoom() {
  return Math.min(canvas.width / WORLD_W, canvas.height / (getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX));
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
// getBuildingAlertKind — the exact same conditions already driving
// the on-tile stalled badges/power-shortage overlay, reused here so the
// minimap can never disagree with what those already show). Deliberately
// NOT every fish/building — that would defeat the whole "minimal, glance at
// what needs attention" point the alien dots already established.
const MINIMAP_ALERT_DOT_COLOR = '#ff3b30';
// Per direct request, a building's dot flashes white when it's idle and yellow
// when it's out of power (red stays for the fish hunger dots).
const MINIMAP_BUILDING_ALERT_COLORS = { idle: '#ffffff', powerless: '#ffd23f' };
function renderMinimapAlertDot(mctx, cx, cy, elapsedMs, color = MINIMAP_ALERT_DOT_COLOR) {
  const pulse = 0.55 + 0.45 * Math.sin(elapsedMs / 220);
  const r = 2 + pulse * 1.2;
  mctx.save();
  mctx.globalAlpha = pulse;
  mctx.fillStyle = color;
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
    const alertKind = type == null ? null : getBuildingAlertKind(state, type, data);
    if (!alertKind) continue;
    const cx = (col * TILE_SIZE + TILE_SIZE / 2) * scale;
    const cy = (row * TILE_SIZE + TILE_SIZE / 2) * scale;
    renderMinimapAlertDot(mctx, cx, cy, state.level.elapsed, MINIMAP_BUILDING_ALERT_COLORS[alertKind]);
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

// A "$" glyph centered on a coin, per direct request ("add in dollar '$'
// symbols on coins so it's more obvious they are coins"). Tinted per-tier —
// a straight lerp of that coin's own getCoinColor toward black
// (lerpRgbToString/hexToRgb, defined further down this file but hoisted
// same as any function declaration) — per a direct follow-up ("darker
// versions of the color of the coins they are on"), lightened again per a
// second follow-up ("just a little darker than the coin itself") — was a
// 0.55 lerp (read as near-black on every tier), settled at a subtler 0.2.
// Per a further direct follow-up ("too hard to see the '$'... a stylized
// border or drop shadow... make it look like the '$' is embossed or
// embedded on the coin") — now drawn as a real 2-light-source emboss: a dark
// "shadow" copy offset down-right (a recessed groove) plus a light
// "highlight" copy offset up-left (a catch-light on the raised edge), same
// trick a real stamped coin's engraving reads by, THEN the real per-tier
// fill on top with its own dark outline stroke for definition against every
// tier's own background color. Called from both of the item-render loop's
// own coin branches (the diamond-gem special case and the flat-fill
// fallback every other tier still uses) — per a still-earlier direct
// request ("make it so the '$' is also affected by the shine effect... so
// it looks like it's part of the coin rather than text on top of it"), BOTH
// call sites draw this BEFORE their own highlight/sparkle fill, not after,
// so that highlight's existing semi-transparent white glazes back over the
// top portion of the WHOLE emboss (shadow, highlight copy, and stroke
// alike) exactly the same way it glazes the coin's own base fill. Saves/
// restores ctx state since textAlign/textBaseline aren't touched anywhere
// else in this render pass and shouldn't leak into whatever draws next (the
// highlight fill right after this, or the floatingTexts loop later, which
// fillText's assuming the canvas default left/alphabetic alignment).
function drawCoinDollarMark(ctx, x, y, radius, coinColorHex) {
  ctx.save();
  ctx.font = `bold ${Math.max(7, radius * 1.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textY = y + radius * 0.04;
  const emboss = Math.max(0.6, radius * 0.07);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText('$', x + emboss, textY + emboss);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('$', x - emboss * 0.7, textY - emboss * 0.7);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = Math.max(0.8, radius * 0.09);
  ctx.lineJoin = 'round';
  ctx.strokeText('$', x, textY);
  ctx.fillStyle = lerpRgbToString(hexToRgb(coinColorHex), { r: 0, g: 0, b: 0 }, 0.2);
  ctx.fillText('$', x, textY);
  ctx.restore();
}

// The idle-spin horizontal squash factor for one coin — Math.abs so the
// "back half" of a rotation thins to an edge-on sliver rather than
// mirroring the "$" into backwards text (a flat coin's face is symmetric
// either way). A spin's random total (Entities.js's updateCoinSpin) almost
// never lands the rotation exactly on a whole turn, so item.spinAngleRad is
// still mid-cosine the instant the rotation itself stops — per direct
// request ("have the visuals transition back to a normal coin instead of
// snap back... when the animation is done"), item.spinSettleMs (also owned
// by updateCoinSpin) counts down over a short window right after that,
// during which THIS function eases the drawn scale from that frozen
// mid-spin value up to 1 (smoothstep, for a natural ease-out) instead of
// jumping there in a single frame. Reads as scale 1 (a no-op transform)
// whenever neither spinAngleRad nor spinSettleMs is set, i.e. the coin
// isn't currently spinning or settling — the common case, so this stays
// free the rest of the time.
function coinSpinScaleX(item) {
  const raw = Math.abs(Math.cos(item.spinAngleRad || 0));
  if (item.spinSettleMs > 0) {
    const t = 1 - item.spinSettleMs / COIN_SPIN_SETTLE_MS;
    const eased = t * t * (3 - 2 * t);
    return raw + (1 - raw) * eased;
  }
  return raw;
}

// A ripening Blimpfish coin's overlay, drawn right after its sprite in the
// item loop: a few tiny motes spiralling into the coin while it is still
// appreciating (item.apprActive), and a small ring pulse for a moment after
// each time its value ticks up (item.apprPulseMs). Everything is a pure
// function of the coin's own timers — no particle objects, arrays or timers
// are created or stored — and the motes go out in ONE path / ONE fill, the
// ring in one stroke, so a coin costs two canvas draws and a coin that is
// done ripening (or any other coin) costs nothing: the caller only gets here
// when one of the two fields is set. The motes' sizes shrink as they arrive
// instead of fading, which keeps a single fill style for the whole path.
function drawAppreciationFx(ctx, item, x, y) {
  if (item.apprActive) {
    const cycle = item.apprAgeMs / APPRECIATE_PARTICLE_CYCLE_MS;
    ctx.fillStyle = APPRECIATE_PARTICLE_COLOR;
    ctx.beginPath();
    for (let i = 0; i < APPRECIATE_PARTICLE_COUNT; i++) {
      const phase = cycle + i / APPRECIATE_PARTICLE_COUNT;
      const f = phase - Math.floor(phase); // 0 at the edge of the halo -> 1 swallowed by the coin
      const pull = f * f; // slow to start, then drawn in faster
      const dist = item.radius + APPRECIATE_PARTICLE_HALO_PX * (1 - pull);
      // A fresh direction each time a mote starts over (the cycle index it
      // belongs to), plus a gentle swirl as it falls in.
      const angle = item.id * 1.7 + i * 2.399963 + Math.floor(phase) * 2.7 + f * 1.1;
      const size = 0.7 + 1.5 * (1 - f);
      const px = x + Math.cos(angle) * dist;
      const py = y + Math.sin(angle) * dist;
      ctx.moveTo(px + size, py);
      ctx.arc(px, py, size, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  if (item.apprPulseMs > 0) {
    const p = 1 - item.apprPulseMs / APPRECIATE_PULSE_MS; // 0 -> 1 across the pulse
    ctx.globalAlpha = 0.8 * (1 - p);
    ctx.strokeStyle = APPRECIATE_PARTICLE_COLOR;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(x, y, item.radius * (1.05 + 0.5 * p), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Every non-diamond coin tier's real render — per direct request ("rework
// the visuals of the coin slightly so it looks more like a flat coin with
// an embossed border and '$'... still highly finished/polished/detailed...
// not crazy complex... adds visual distinction from it looking more like a
// flat coin that spins and the rest of the objects looking like spheres").
// A genuine two-tone coin build instead of one flat fill plus a round
// specular blob (which is exactly what reads as "sphere," per that same
// request): a darker outer rim, a lighter inner face, a bright bevel ring
// right where face meets rim (the "embossed border" — a raised edge
// catching light), and a short diagonal sheen ARC across the face instead
// of a round highlight blob (an arc reads as light glancing off a flat
// disc; a round blob reads as a glint on a curved surface). Used to also
// have a ring of short milled-edge tick marks around the outer rim (the
// classic reeded-edge coin detail) — removed per a direct follow-up report
// ("it just looks pixelated with the milled marks"), leaving just the
// plain outer rim fill. The diamond tier keeps its own distinct gem-cut
// render above this — per that branch's own long-standing precedent ("look
// more like a circular gem than a coin"), deliberately NOT a coin look at
// all, so it's untouched.
function drawFlatCoin(ctx, cx, cy, r, value) {
  const baseColor = getCoinColor(value);
  const baseRgb = hexToRgb(baseColor);
  const rimColor = lerpRgbToString(baseRgb, { r: 0, g: 0, b: 0 }, 0.32);
  const faceColor = lerpRgbToString(baseRgb, { r: 255, g: 255, b: 255 }, 0.12);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = rimColor;
  ctx.fill();

  // Inner face.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = faceColor;
  ctx.fill();

  // Embossed border — a bright bevel ring right at the face/rim seam (the
  // raised edge), plus a thin dark seam line just outside it for definition.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = Math.max(0.6, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = Math.max(0.6, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();

  // "$" drawn before the sheen arc right below, so that sheen's own opacity
  // glazes back over the glyph — same layering precedent drawCoinDollarMark
  // itself already documents.
  drawCoinDollarMark(ctx, cx, cy, r, baseColor);

  // A short diagonal sheen ARC (not a round blob) — reads as light glancing
  // off a flat face rather than a glint on a curved sphere.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, Math.PI * 1.12, Math.PI * 1.42);
  ctx.stroke();
  ctx.restore();
}

// Traces (does NOT fill/stroke) a closed, gently 3-lobed blobby outline
// centered on (cx, cy) — per direct request ("change waste so it looks more
// like poop... keep it mostly sphere shaped, not completely, but make it
// like circular poop"). Built as small bump peaks/valleys off a single base
// radius (quadratic curves through alternating near/far control points),
// NOT as several stacked separate circles — that keeps the whole outline
// one seamless path, fillable/strokeable with no visible seams, unlike
// overlapping-circle approaches would give. Still fundamentally round (the
// peaks are only ~18% bigger than the base radius) rather than the tall
// spiral-swirl "poop emoji" silhouette. Duplicated in Grid.js
// (renderChestContentsIcon) and UI.js (drawItemIconCanvas) rather than
// imported — same "each render module draws its own item art" convention
// every other shared icon shape in this game already follows (see e.g.
// Grid.js's own renderRecipeItemIcon comment).
function tracePoopBlobPath(ctx, cx, cy, r) {
  const lobes = 3;
  const steps = lobes * 2;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const rad = r * (i % 2 === 0 ? 1.18 : 0.84);
    pts.push({ x: cx + Math.cos(angle) * rad, y: cy + Math.sin(angle) * rad });
  }
  ctx.beginPath();
  const start = pts[steps - 1];
  const first = pts[0];
  ctx.moveTo((start.x + first.x) / 2, (start.y + first.y) / 2);
  for (let i = 0; i < steps; i++) {
    const next = pts[(i + 1) % steps];
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + next.x) / 2, (pts[i].y + next.y) / 2);
  }
  ctx.closePath();
}

// Per direct request ("keep the collision box and physics the same for
// waste, but visually make them 10% bigger, so part of the visuals go
// outside the collision circle... right now it looks like they're floating
// against other objects because you fit the whole poop within the circle
// instead of having part of it spill out"), bumped +5%, then +10%, then back
// down to 1.2x, then settled at 1.22x — the final tweak, per direct request
// ("last tweak for the waste... then I'm done tweaking it") — always a
// purely visual inflation applied only here (and to the tutorial
// ghost-Waste animation below, so it still looks like a real Waste item),
// never to the real physics radius (item.radius, WASTE_RADIUS, or mass) two
// adjacent items' collision circles are actually resolved against — see
// Grid.js's resolveItemCollisions.
const WASTE_VISUAL_SCALE = 1.22;
// Per a direct follow-up ("the main issue is it looks like it's floating on
// the floor, buildings, or other objects... moving the center of the visual
// graphic down a tiny bit should fix this, like 10% of the height of the
// waste"), dialed to 8%, then settled at 5% as the final tweak — the poop
// shape's own drawn center is nudged DOWN by this fraction of its
// (already-scaled) radius, purely visual same as the scale above: 0.1 * r
// is 5% of the shape's full height (its own diameter, 2r), so it reads as
// sitting slightly lower/resting against whatever's beneath it, without
// moving the real collision circle (still centered on the item's own
// unmodified x/y) at all.
const WASTE_VISUAL_Y_OFFSET_FRACTION = 0.1;

// Fills/strokes/textures tracePoopBlobPath's outline into a full waste item
// — the actual reusable "draw one poop" call every render site below uses.
// `color` defaults to Waste's own; Bio-Sludge (alien_dna) reuses this exact
// shape with its own acid-green and its own radius, per direct request
// ("change the bio-sludge object visually to look very similar to waste with
// the circular poop look, while retaining the size and color of bio-sludge...
// inherit the visual scaling factor and the height adjustments that waste
// has") — so it picks up WASTE_VISUAL_SCALE and the Y offset above for free,
// applied to ITS radius (ALIEN_DNA_RADIUS), not Waste's. Purely visual: the
// real collision radius is untouched, same as for Waste.
// Rolling, per direct request ("make most of the objects roll"): the sprite
// this draws is ROTATED at blit time. Its glint is pre-baked into the sprite
// like Food's generic one below (just a bit more muted — 0.32 alpha vs Food's
// 0.45), so it simply rolls with the blob rather than being a second unrotated
// overlay, per direct request. The old WASTE_VISUAL_Y_OFFSET_FRACTION nudge
// isn't baked in here either: the blob has to rotate about its OWN center, so
// the render loop applies that same offset to the sprite's pivot (sprite.dy).
function drawWastePoop(ctx, cx, cy, r, color = WASTE_COLOR) {
  r *= WASTE_VISUAL_SCALE;
  tracePoopBlobPath(ctx, cx, cy, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  // A couple of short curved "wrinkle" lines instead of the plain glossy
  // highlight dot every other item gets — reads as texture, not shine.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.05, r * 0.48, Math.PI * 0.12, Math.PI * 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.32, r * 0.38, Math.PI * 1.12, Math.PI * 1.75);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - r * 0.32, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

// Per direct request (populated-tank performance) — every Food/Coin/Waste/
// Science/Bio-Sludge/Biomass/Mutagen Paste item used to be re-drawn from scratch
// each frame as 5-10 vector ops (a coin's "$" alone is three text draws), so a
// few hundred items cost more than the rest of the tank put together. Each
// distinct look (type + radius + coin tier color [+ Food staleness step]) is
// now drawn ONCE into a small sprite by drawItemShape — the same drawing code
// that used to run live in the render loop — and each item is a single
// drawImage. The coin's idle spin squash and the Food stale tint are still
// applied per frame exactly as before (the spin as a canvas transform at blit
// time, the tint as one of FOOD_STALE_STEPS pre-baked shades). Visual-only:
// item.radius, positions and everything physics/collision-related are
// untouched.
const ITEM_SPRITE_SCALE = 2;
const FOOD_STALE_STEPS = 16;
const ITEM_SPRITE_CACHE_MAX = 256; // safety valve only — real item looks number in the dozens
const itemSpriteCache = new Map();

// A round-bottom lab flask with a short neck and an open mouth, per direct
// request ("turn the blue and green bubbles into circular flasks/vials that
// have a short neck and an opening") — the body is the item's full collision
// circle (so it still rests flush on the floor), and the neck/lip poke OUT of
// that circle, same visual-only spill-out trick the Waste lobes use. Drawn
// neck-up at angle 0; the sprite is rotated at blit time (see the item render
// loop), so a rolling flask's neck swings around. The body is filled
// completely with the liquid (a partial liquid line would have to stay level
// while the glass turns, i.e. a live per-frame clip per flask — the one
// expensive option) with an empty glass neck above it. `layer` splits the
// baked sprite in two ('body' turns with the flask, 'highlight' is the
// fixed-light glint that must not turn) — see getItemSprite.
function drawScienceFlask(ctx, x, y, r, colorA, colorB, layer = 'all') {
  if (layer !== 'highlight') {
    const neckHalf = r * 0.4;
    const neckTop = y - r * 1.6;
    const lipHalf = r * 0.52;
    const lipH = r * 0.3;
    // Neck glass — runs down inside the body, which is drawn over its lower end below.
    ctx.beginPath();
    ctx.rect(x - neckHalf, neckTop, neckHalf * 2, r * 1.0);
    ctx.fillStyle = 'rgba(215, 235, 255, 0.28)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Rim lip, then the dark opening at the very top — a flat strip, not an
    // ellipse, per direct request (the curved opening read as too concave).
    ctx.beginPath();
    ctx.rect(x - lipHalf, neckTop - lipH * 0.3, lipHalf * 2, lipH);
    ctx.fillStyle = 'rgba(235, 245, 255, 0.55)';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x - neckHalf * 0.85, neckTop - lipH * 0.3, neckHalf * 1.7, lipH * 0.3);
    ctx.fillStyle = 'rgba(15, 25, 45, 0.65)';
    ctx.fill();
    // Liquid-filled body.
    const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gradient.addColorStop(0, colorB);
    gradient.addColorStop(1, colorA);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  if (layer !== 'body') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A speckled egg, per direct request ("turn the alien eggs into an egg shaped
// speckled/grained object that rolls") — still circular PHYSICS (the real
// collision circle is the item's own radius), the narrower-on-top egg outline
// and its long axis just spill slightly past it, visual-only. Speckles come
// from a fixed-seed generator so the one cached sprite is identical every
// time, and they're clipped to the egg so none escape the shell. Everything
// here (speckles and highlight alike) turns with the egg — it's the cheapest
// option, one blit, per direct request. The live hatch-countdown ring is NOT
// part of this sprite — the render loop strokes it fixed (non-rotating) on top.
function traceEggPath(ctx, cx, cy, r) {
  const a = r * 0.8;  // half-width
  const b = r * 1.1;  // half-length
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2;
    const px = cx + a * Math.sin(t) * (1 - 0.18 * Math.cos(t)); // cos(t) = 1 at the narrow top, -1 at the wide bottom
    const py = cy - b * Math.cos(t);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
function drawAlienEgg(ctx, cx, cy, r) {
  traceEggPath(ctx, cx, cy, r);
  ctx.fillStyle = ALIEN_EGG_COLOR;
  ctx.fill();
  ctx.save();
  ctx.clip();
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 22; i++) {
    const sx = cx + (rand() * 2 - 1) * r * 0.85;
    const sy = cy + (rand() * 2 - 1) * r * 1.1;
    const sr = r * (0.06 + rand() * 0.09);
    ctx.fillStyle = rand() < 0.7 ? 'rgba(70, 48, 22, 0.55)' : 'rgba(255, 240, 200, 0.5)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  traceEggPath(ctx, cx, cy, r);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawItemShape(ctx, item, x, y, itemColor, layer = 'all') {
  if (item.type === 'science' || item.type === 'science_green') {
    // Both Science types share the flask shape, just in their own tones —
    // Green Science (the Bio-Combuster's upgraded output) keeps its
    // own green pair instead of purple/blue.
    const isGreen = item.type === 'science_green';
    drawScienceFlask(ctx, x, y, item.radius, isGreen ? SCIENCE_GREEN_COLOR_A : SCIENCE_ITEM_COLOR_A, isGreen ? SCIENCE_GREEN_COLOR_B : SCIENCE_ITEM_COLOR_B, layer);
    return;
  }

  if (item.type === 'alien_egg') {
    drawAlienEgg(ctx, x, y, item.radius);
    return;
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
    // the Science Flask/Diamond coin's own special renders above.
    const gradient = ctx.createRadialGradient(
      x - item.radius * 0.3, y - item.radius * 0.3, item.radius * 0.1,
      x, y, item.radius
    );
    gradient.addColorStop(0, BIOMASS_COLOR_CORE);
    gradient.addColorStop(1, BIOMASS_COLOR);
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(x, y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x - item.radius * 0.3, y - item.radius * 0.3, item.radius * 0.26, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (item.type === 'coin' && getCoinTier(item.value).maxValue === Infinity) {
    // Diamond tier — a faceted radial-gradient gem plus cut-angle facet
    // lines and a bright sparkle highlight, per direct request ("make the
    // diamond colored coins... look more like a circular gem than a
    // coin") instead of the flat single-color fill every other coin tier
    // gets below. (Its idle-spin squash is applied at blit time, not here —
    // see the item render loop.)
    const gemGradient = ctx.createRadialGradient(
      x - item.radius * 0.3, y - item.radius * 0.3, item.radius * 0.1,
      x, y, item.radius
    );
    gemGradient.addColorStop(0, DIAMOND_GEM_COLOR_CORE);
    gemGradient.addColorStop(1, DIAMOND_GEM_COLOR_EDGE);
    ctx.beginPath();
    ctx.fillStyle = gemGradient;
    ctx.arc(x, y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI + Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * item.radius, y + Math.sin(angle) * item.radius);
      ctx.lineTo(x - Math.cos(angle) * item.radius, y - Math.sin(angle) * item.radius);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, item.radius, 0, Math.PI * 2);
    ctx.stroke();
    // The "$" is drawn here, BEFORE the sparkle highlight right below —
    // see drawCoinDollarMark's own comment — so that highlight's own
    // opacity glazes back over the glyph the same way it glazes the gem
    // itself, instead of sitting as a flat sticker on top of it.
    drawCoinDollarMark(ctx, x, y, item.radius, getCoinColor(item.value));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(x - item.radius * 0.32, y - item.radius * 0.32, item.radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (item.type === 'coin') {
    drawFlatCoin(ctx, x, y, item.radius, item.value);
    return;
  }

  if (item.type === 'waste') {
    drawWastePoop(ctx, x, y, item.radius);
    return;
  }
  if (item.type === 'alien_dna') {
    drawWastePoop(ctx, x, y, item.radius, ALIEN_DNA_COLOR);
    return;
  }

  // Food/Mutagen Paste only these days (never a coin of any tier) — itemColor
  // is the type's flat color, or Food's pre-baked stale shade (see getItemSprite).
  ctx.beginPath();
  ctx.fillStyle = itemColor;
  ctx.arc(x, y, item.radius, 0, Math.PI * 2);
  ctx.fill();
  // A thin darker rim plus a small glossy highlight — per direct request
  // that items "pop more and look less flat" than a single flat fill,
  // same treatment FishRenderer.js's drawFish gets for its own body.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(x - item.radius * 0.32, y - item.radius * 0.32, item.radius * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

function getItemSprite(item, foodStaleStep) {
  const isCoin = item.type === 'coin';
  const isDiamond = isCoin && getCoinTier(item.value).maxValue === Infinity;
  const key = item.type + '|' + item.radius + '|' + (isCoin ? getCoinColor(item.value) : '') + '|' + (isDiamond ? 1 : 0) + '|' + foodStaleStep;
  let sprite = itemSpriteCache.get(key);
  if (sprite) return sprite;
  if (itemSpriteCache.size >= ITEM_SPRITE_CACHE_MAX) itemSpriteCache.clear();
  const half = Math.ceil(item.radius * 1.7 + 4); // the poop outline/emboss/strokes all stay inside this
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = half * 2 * ITEM_SPRITE_SCALE;
  const sctx = canvas.getContext('2d');
  sctx.scale(ITEM_SPRITE_SCALE, ITEM_SPRITE_SCALE);
  let itemColor = ITEM_FLAT_COLOR_BY_TYPE[item.type];
  if (item.type === 'food' && foodStaleStep > 0) itemColor = lerpRgbToString(hexToRgb(FOOD_COLOR), hexToRgb(FOOD_STALE_COLOR), foodStaleStep / FOOD_STALE_STEPS);
  // Rolling (see the item render loop): flasks bake their glint into a
  // SECOND, unrotated sprite so the light stays fixed while the body turns;
  // waste/sludge have theirs baked in (it rolls with them, per direct
  // request) and carry the old "sit a bit lower" nudge as sprite.dy (applied
  // to the pivot, so the blob turns about its own center).
  const splitHighlight = item.type === 'science' || item.type === 'science_green';
  drawItemShape(sctx, item, half, half, itemColor, splitHighlight ? 'body' : 'all');
  let hl = null;
  if (splitHighlight) {
    hl = document.createElement('canvas');
    hl.width = hl.height = canvas.width;
    const hctx = hl.getContext('2d');
    hctx.scale(ITEM_SPRITE_SCALE, ITEM_SPRITE_SCALE);
    drawItemShape(hctx, item, half, half, itemColor, 'highlight');
  }
  const dy = (item.type === 'waste' || item.type === 'alien_dna') ? item.radius * WASTE_VISUAL_SCALE * WASTE_VISUAL_Y_OFFSET_FRACTION : 0;
  sprite = { canvas, half, hl, dy };
  itemSpriteCache.set(key, sprite);
  return sprite;
}

// Browsers refuse to let an AudioContext make sound until a real user
// gesture — resumeAudio() also kicks off the looping background music the
// first time it's called, so this single pair of one-time listeners is all
// both SFX and music need to unlock.
window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });

// Game-start guided tutorial timing. Per direct request (title screen rework),
// the old "Finsanity" grow-fade splash is gone — TitleScreen.js's bubble-trail
// exit replaces it — so this now runs off the end of that exit instead of the
// splash's own animationend, and again off every pause-menu Restart (see
// UI.js's restartLevel, which arms state.ui.replayStartTutorialPending).
const START_TUTORIAL_DELAY_AFTER_SPLASH_MS = 1000; // per direct request (cut from 2000, itself cut from 3000) — the game-start guided tutorial no longer starts the instant Start is clicked; it waits this long after the title has actually left the screen
function startTutorialAfterDelay() {
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
    // via UI.js's setFavoriteSlotFromShop (hotkeys 4/5/6 while the shop is
    // open with a fish/building selected).
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
    // "<flowId>:<step>" of whichever tutorial step the player last pressed a
    // 1/2/3 tool hotkey during — per direct request ("during tutorials you
    // can use hotkeys 1-3 to toggle the tools on or off, in case they are on
    // and need to be turned off for the tutorial"). UI.js's own
    // updateTutorialOverlay force-reasserts a step's own required tool every
    // single frame (its own comment explains why — a real fix for players
    // getting stranded on the wrong tool), which would otherwise immediately
    // stomp a deliberate manual toggle back the very next frame. Matching
    // this key suppresses just that one re-assertion for the step the
    // override was set on; it naturally stops applying the instant the flow
    // advances to a different step (a fresh key that was never set), no
    // separate clear-on-step-change needed.
    tutorialToolOverrideStep: null,
    lastArmedTool: null, // the last 'build:<id>'/'fish:<id>' tool armed (UI.js's selectSpeciesForPreview/selectBuildingForPreview) — the Q hotkey's "reselect last building/fish" fallback, see main.js's KeyQ handler
    blueprintCost: null, // live total $ cost of the currently-armed Blueprint stamp, written fresh every render() frame, null while no stamp is armed — read by UI.js's updateHUD for the bottom-left cost bubble
    blueprintClipboardActive: false, // whether a Blueprint stamp is currently captured/armed, written fresh every render() frame — read by UI.js's updateHUD to switch the persistent Q legend to "Clear Blueprint"
    undoAvailable: false, // whether main.js's Ctrl+Z undo stack currently has anything to undo — written by pushUndoEntry/performUndo, read by UI.js's bottom-left hotkey legend
    undoLabel: null, // 'Undo Place' | 'Undo Move' | 'Undo Sell' | null — what Ctrl+Z would currently do, shown in that same legend line
    shopCollapsed: true, // shop starts tucked away — just the toggle button — so it doesn't clutter the view
    fanConesVisible: true, // whether every placed Fan's push-cone/arrow renders (Grid.js's renderFanIndicators) — G toggles this off/on for players with many fans cluttering the view; starts true, matching the old always-on behavior
    filterModalTileKey: null, // "row,col" of whichever Platform/Fan the item-filter pop-up is open for — mirrored every frame by UI.js's updateHUD; Grid.js's renderFanIndicators highlights that fan's cone
    buildingInfoTileKey: null, // "row,col" of whichever building's info modal is open, mirrored from UI.js's own module-local var (UI.js can't be imported back here) — Grid.js's renderFanIndicators reads this to highlight that one fan's cone while its modal is open
    // Per direct request ("pipette tool copies recipe/filter from pipetted
    // building") — UI.js's pipetteSelectBuilding captures the SPECIFIC
    // pipetted tile's recipeId (Manufacturer/Power Plant)/filterItems
    // (Platform/Fan) here; main.js's own placement code (both the plain and
    // Fan-specific branches) applies whichever of these is non-null onto the
    // freshly-placed building, then main.js clears them once placed (a
    // pipetted recipe/filter is a one-time carry-over, not a standing "every
    // future placement of this type" setting). selectBuildingForPreview
    // resets both to null on every OTHER (non-pipette) selection, so they're
    // never stale leftovers from an earlier, unrelated pipette.
    pipetteRecipeId: null,
    pipetteFilterItems: null,
    pipetteFanRangePct: null, // a pipetted Fan's range slider (1-100) — applied to the fans placed with that tool, same carry-over as the fields around it (a Fan's aim angle is deliberately NOT copied)
    pipetteChestPourMode: null, // a pipetted Storage Chest's Pour/Trickle toggle (true = Pour) — same one-way carry-over as the two above
    // Ctrl + Click: Snap Placement — per direct request, holding Ctrl with
    // a build tool armed snaps a line of ghost buildings from here to the
    // cursor (Grid.js's computeSnapLine). Set on every successful non-Fan
    // placement (updateBuildDrag) and the Fan click handler's own two
    // placement branches, AND by UI.js's pipetteSelectBuilding whenever a
    // real tile is pipetted (per direct request, "if the player uses Q to
    // pipette a building, have that act as the last placed building") — so
    // it's always "wherever the player most recently placed OR pipetted
    // something," never reset just because a different tool got armed.
    lastPlacedTileCol: null,
    lastPlacedTileRow: null,
    // Live total $ cost of whatever snap line is currently being previewed,
    // written fresh every render() frame (null whenever no line is
    // showing) — read by UI.js's updateHUD for the cost legend, same
    // cross-module-flag pattern blueprintCost above already uses.
    snapLineCost: null,
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
    buildingMoveDragging: false, // true while a building is being right-dragged (see main.js's rightMoveDragging)
    buildingMoveHoverLabel: null,
    // Fish merge/splice hover legend — per direct request ("when you hover
    // over a fish have a bubble legend... that shows what fish can be
    // merged with the fish being hovered on, and what the fish would be
    // created when merged"). Written fresh every render() frame; null while
    // the hovered fish isn't merge/splice-eligible at all (hides the legend
    // entirely), otherwise an array of `{ text, otherSpeciesId,
    // resultSpeciesId }` entries (Entities.js's describeFishMergeOptions),
    // one per currently-present compatible partner, or a single "No
    // available fish to merge." entry (both ids null) when the hovered fish
    // IS eligible but nothing in the tank right now actually pairs with it.
    // UI.js's updateHUD draws `otherSpeciesId -> resultSpeciesId` as two
    // small fish icons here (per a later direct request); the fish info
    // modal uses `.text` instead, unchanged.
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
    // Same "captured once, at open time" snapshot as FrozenX/Y above, but for
    // a Generator's (Electric Eel/Battery fish) last-completed-second MW
    // total (fish.lastGeneratedMw) — per direct request, the modal shows
    // what the fish was generating right before it opened, rather than a
    // live figure that would just decay to 0 the instant the freeze above
    // stops it from swimming (and thus producing) any further.
    fishInfoModalFrozenGeneratedMw: 0,
    // Mirrors the module-local fanAimingCell every render frame so Grid.js's
    // renderFanIndicators can skip drawing that fan's OWN fixed-angle cone
    // while renderFanAimGhost is drawing its live cursor-following one on
    // top — see render()'s own comment.
    fanAimingCell: null,
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
    // Monotonic count of Bubble-Cap-blocked science drops, bumped by Entities.js's
    // triggerProductionBlocked and watched by UI.js's updateScienceCapArrow (which
    // compares it to the last value it saw) — same cross-module-flag idea as the
    // pending flags here, but a counter so several blocks in one frame all register.
    scienceBlockedSignals: 0,
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
    // (the pause menu's Restart button) the instant it calls loadLevel, so the
    // guided start tutorial replays after a restart. startTutorialAfterDelay()
    // is a main.js-local function, so UI.js can't call it directly without a
    // circular import — read and cleared by render() below on the very next
    // frame instead.
    replayStartTutorialPending: false,
  },
  debug: {
    overlayVisible: false,
    timeScaleIndex: DEFAULT_TIME_SCALE_INDEX,
    selectedSpecies: 'guppy',
    cursorWorld: { x: 0, y: 0 },
  },
};

loadLevel(state, LEVELS[0].id);

// The game now STARTS in 'width' mode (tankZoomMode's own default, above),
// so this function's own water-column-height fraction formula only ever
// actually applies once the player has toggled tankZoomMode back to null...
// which never happens any more (toggleTankZoomMode only ever switches
// between 'whole' and 'width') — kept as the fallback formula regardless,
// both for that plain "not set yet" case and as a documented reference for
// what the OLD default used to be: zooms out so the water column
// (y=0..SEABED_FLOOR_Y) fits within CAMERA_WATER_COLUMN_FIT_FRACTION of the
// viewport height, deliberately a bit less than 100%, so a sliver of the
// seabed city is always visible below it. Never zooms in past 1x on a tall
// window. Recomputed on every resize either way.
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
  resizeForegroundCanvases();
  fitCameraZoom();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
centerCameraOnMound(state.camera); // one-time — not inside resizeCanvas, so a later window resize mid-play doesn't yank the camera back to the Mound

// ---- Input wiring ----
const input = createInput(canvas);
// Previous tick's cursor world position, for the cursor-bubbles speed calc in
// update() below — null whenever the cursor isn't over the canvas (or hasn't
// moved yet this session) so the very first in-bounds tick after a re-entry
// doesn't compute a huge bogus "speed" from wherever it last was.
let lastCursorBubbleWorldX = null;
let lastCursorBubbleWorldY = null;

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

// Ctrl+Click: Snap Placement — per direct request ("switch the line snap
// tool hotkey... from shift + click to ctrl + click, currently it overlaps
// with the replace hotkey"), moved off Shift entirely so it no longer
// contends with Shift-click Replace right above (both used to poll the same
// key, and Snap Placement's own check ran first in updateBuildDrag, so a
// Shift-held Replace attempt could get swallowed by a snap-line placement
// instead). Same live input.keysDown poll as isShiftHeld, for the same
// reason (works whether Ctrl was already held or pressed mid-drag, and for
// updateBuildDrag's per-tick polling which has no event object).
function isCtrlHeld() {
  return input.keysDown.has('ControlLeft') || input.keysDown.has('ControlRight');
}

// Fish move/merge drag state — see Entities.js's isCombinableFish/
// canCombineFish/combineFish and CLAUDE.md's "Economy Fish Combining/Splicing"
// section. Per direct request the dedicated Merge tool is gone: RIGHT-click and
// drag any fish (with nothing armed — the plain cursor) to move it anywhere in
// the water, and drop it on a legal partner to merge/splice. draggedFishId is
// set once a right-button press on a fish has moved past
// ITEM_DRAG_MOVE_THRESHOLD_PX; while set, update() below snaps that fish to the
// cursor every tick (freezing its own AI movement in the process, since the
// override runs after updateEntities) and render() highlights whatever fish is
// currently under the cursor green/red. A right-click released without moving
// is not a drag — it still toggles a hybrid's ability (see the right-mouse-up
// handler below). Moving/merging is disabled while any hostile alien is alive,
// even with Pause Time on.
let draggedFishId = null;
let rightPressFishId = null; // the fish under the cursor when the right button went down (ability toggle on a plain right-click, drag source otherwise)
let rightPressDragCandidate = false; // whether that press may start a drag (plain cursor armed, no blocking tutorial)
let rightPressStartSx = 0;
let rightPressStartSy = 0;
let rightPressGrabOffset = { x: 0, y: 0 }; // fish position minus cursor world position at press, so the fish doesn't jump onto the cursor
let rightPressAlienNoticeShown = false;
const FISH_DRAG_ALIEN_MESSAGE = "Can't move or merge fish while aliens are on screen!";
const ALIEN_CLICK_PAUSED_MESSAGE = "Can't attack aliens while time is paused!";

// Per direct request, fish can't be moved or merged while a hostile alien is
// alive — checked against the live entity list, so it holds even under Pause
// Time (state.ui.timePaused), when fish drags are otherwise allowed. Friendly
// (egg-hatched) aliens are their own entity type and don't count.
function hostileAliensActive(state) {
  return state.level.entities.some((e) => e.type === 'alien' && e.hp > 0);
}

// Merge partner highlight — per direct request, with nothing armed (plain cursor) and
// the cursor hovering (or dragging) a fish that can merge or splice, every
// fish it could pair with pulses a soft glow, with a faint line out to each
// from the hovered fish that fades in and out in step with the glow. Kept
// cheap: the partner list is recomputed only when the hovered fish changes or
// every MERGE_HOVER_REFRESH_MS (not per frame — pairing rules don't change
// that fast), the glow is one pre-baked sprite drawn with drawImage, and the
// lines are a single batched path — so the per-frame cost is a handful of draw
// calls, and exactly zero unless the plain cursor is hovering/dragging a fish.
const MERGE_HOVER_REFRESH_MS = 300;
const MERGE_HINT_MS = 2000; // the new-adult reminder holds this long (was 3000 — shortened by a second per direct request, it read like a tutorial)...
const MERGE_HINT_FADE_MS = 750; // ...then fades off over this
const MERGE_HOVER_PULSE_PERIOD_MS = 1200;
let mergeHoverSubjectId = null;
let mergeHoverPartners = [];
let mergeHoverRefreshAtMs = 0;
let mergeHoverGlowSprite = null;
let mergeLegendFishId = null; // the hover legend's own cache (same refresh cadence) — see the legend block in render()
let mergeLegendLines = [];
let mergeLegendRefreshAtMs = 0;
function bakeMergeHoverGlow() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 236, 150, 0.85)');
  g.addColorStop(0.55, 'rgba(255, 214, 90, 0.35)');
  g.addColorStop(1, 'rgba(255, 200, 70, 0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return canvas;
}
// Per direct request, a bubble sits at the exact midpoint of each line, showing
// the fish that pair would make at 60% of its real on-screen size. Icons are
// baked once per species (adult stage, facing right) so the per-frame cost is
// one drawImage each.
const MERGE_BUBBLE_ICON_SCALE = 0.6; // 0.66 -> 0.6 per direct request
// Per direct request, every result fish's icon and bubble match the size the Feeder/Battery
// fish's (adult scale MERGE_BUBBLE_REF_SCALE) get — so a full-size (1.0) fish's icon is drawn
// smaller, to the same on-screen size, and the bubble radius is the same for all.
const MERGE_BUBBLE_REF_SCALE = 0.8;
const MERGE_BUBBLE_ICON_BAKE = 2; // bake resolution multiplier
const MERGE_BUBBLE_ICON_HALF = 100; // px each side of center the baked canvas covers — enough for the longest hybrid (Eel body, Octopus tentacles)
const mergeBubbleIcons = {};
function getMergeBubbleIcon(speciesId) {
  let icon = mergeBubbleIcons[speciesId];
  if (icon) return icon;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MERGE_BUBBLE_ICON_HALF * 2 * MERGE_BUBBLE_ICON_BAKE;
  const c = canvas.getContext('2d');
  c.scale(MERGE_BUBBLE_ICON_BAKE, MERGE_BUBBLE_ICON_BAKE);
  const def = SPECIES[speciesId];
  drawFish(c, MERGE_BUBBLE_ICON_HALF, MERGE_BUBBLE_ICON_HALF, speciesId, def.growthStages.length - 1, 1, 0, { x: 1, y: 0 });
  const adultScale = def.growthStages[def.growthStages.length - 1].scale;
  icon = mergeBubbleIcons[speciesId] = {
    canvas,
    drawScale: MERGE_BUBBLE_ICON_SCALE * MERGE_BUBBLE_REF_SCALE / adultScale, // 0.6 of the reference fish's size, whatever this species' own scale
    radius: MERGE_BUBBLE_ICON_SCALE * FISH_BASE_SIZE * MERGE_BUBBLE_REF_SCALE * 1.285 + 3.5, // the Feeder/Battery fish's bubble, for every fish
  };
  return icon;
}

// fade (0-1) scales every alpha — the auto-played first-adult reminder fades off with it.
function renderMergeToolPartnerHighlight(ctx, state, subject, nowMs, fade = 1) {
  if (subject.id !== mergeHoverSubjectId || nowMs >= mergeHoverRefreshAtMs) {
    mergeHoverSubjectId = subject.id;
    mergeHoverPartners = findFishMergePartners(state, subject);
    mergeHoverRefreshAtMs = nowMs + MERGE_HOVER_REFRESH_MS;
  }
  if (mergeHoverPartners.length === 0) return;
  if (!mergeHoverGlowSprite) mergeHoverGlowSprite = bakeMergeHoverGlow();
  const pulse = 0.5 + 0.5 * Math.sin((nowMs / MERGE_HOVER_PULSE_PERIOD_MS) * Math.PI * 2);
  const lineAlpha = (0.12 + 0.3 * pulse) * fade;
  const glowAlpha = (0.35 + 0.55 * pulse) * fade;
  const subjectPos = worldToScreen(subject.x, subject.y, state.camera);
  ctx.save();
  // Lines first (one path for all of them), each broken around its bubble, then the glows, then the bubbles.
  ctx.globalAlpha = lineAlpha;
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = Math.max(1, 1.5 * state.camera.zoom);
  ctx.beginPath();
  for (const { entity, resultSpeciesId } of mergeHoverPartners) {
    if (entity.dying) continue;
    const p = worldToScreen(entity.x, entity.y, state.camera);
    const dx = p.x - subjectPos.x;
    const dy = p.y - subjectPos.y;
    const len = Math.hypot(dx, dy);
    const gap = getMergeBubbleIcon(resultSpeciesId).radius;
    if (len <= gap * 2 + 6) continue; // the bubble covers the whole gap
    const ux = dx / len;
    const uy = dy / len;
    const mx = subjectPos.x + dx / 2;
    const my = subjectPos.y + dy / 2;
    ctx.moveTo(subjectPos.x, subjectPos.y);
    ctx.lineTo(mx - ux * gap, my - uy * gap);
    ctx.moveTo(mx + ux * gap, my + uy * gap);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.globalAlpha = glowAlpha;
  for (const { entity } of mergeHoverPartners) {
    if (entity.dying) continue;
    const p = worldToScreen(entity.x, entity.y, state.camera);
    const baseR = entity.type === 'fish'
      ? FISH_BASE_SIZE * SPECIES[entity.speciesId].growthStages[entity.stage].scale
      : (entity.radius ?? ALIEN_RADIUS) * 1.1;
    const r = baseR * state.camera.zoom * (1.5 + 0.2 * pulse);
    ctx.drawImage(mergeHoverGlowSprite, p.x - r, p.y - r, r * 2, r * 2);
  }
  // The bubbles: a big version of the fish/building bubbles in the line's color,
  // dead center on each line, fading with it, holding the resulting fish.
  for (const { entity, resultSpeciesId } of mergeHoverPartners) {
    if (entity.dying) continue;
    const p = worldToScreen(entity.x, entity.y, state.camera);
    const mx = (subjectPos.x + p.x) / 2;
    const my = (subjectPos.y + p.y) / 2;
    const icon = getMergeBubbleIcon(resultSpeciesId);
    const r = icon.radius;
    ctx.globalAlpha = Math.min(1, lineAlpha * 2.2);
    ctx.fillStyle = 'rgba(255, 226, 122, 0.16)';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff4c2'; // the small highlight, same as a fish bubble's
    ctx.beginPath();
    ctx.arc(mx - r * 0.45, my - r * 0.45, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = glowAlpha;
    const half = MERGE_BUBBLE_ICON_HALF * icon.drawScale;
    ctx.drawImage(icon.canvas, mx - half, my - half, half * 2, half * 2);
  }
  ctx.restore();
}

// Which hybrids have a real on/off ability toggle — Magnet Fish (magnet),
// Feeder Fish (auto-Food dispenser), Bio Fish (Bio-Sludge mode) — per direct
// request, all 3 flip on a right-click that doesn't turn into a drag (see the
// right-mouse-up handler below, since right-DRAG now moves/merges fish), which
// needs no disambiguation against a plain left-click opening the info modal at
// all, unlike the double-click scheme this replaced.
const TOGGLEABLE_FISH_SPECIES = ['buffer_fish', 'zap_sucker', 'xeno_octopus'];
const FISH_TOGGLE_BOUNCE_DURATION_MS = 400;
const FISH_TOGGLE_BOUNCE_AMOUNT = 0.22;
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

input.rightMouseDownHandlers.push((sx, sy) => {
  rightPressFishId = null;
  rightPressDragCandidate = false;
  rightPressAlienNoticeShown = false;
  if (state.ui.paused) return;
  // Guided tutorials swallow this, except the first-time merge tutorial's own
  // drag step (which teaches exactly this gesture).
  if (state.level.tutorialFlow && !isMergeDragTutorialStepActive(state)) return;
  const world = screenToWorld(sx, sy, state.camera);
  const fish = findMergeSubjectAt(state, world.x, world.y); // a fish, or an egg-hatched friendly alien (which counts as one for moving/merging)
  if (!fish) return;
  rightPressFishId = fish.id;
  rightPressStartSx = sx;
  rightPressStartSy = sy;
  rightPressGrabOffset = { x: fish.x - world.x, y: fish.y - world.y };
  // Moving/merging only with nothing armed — the plain cursor (not the Food tool,
  // a shop fish/building, or a Blueprint), per direct request.
  rightPressDragCandidate = state.ui.selectedTool === 'cursor';
});

// What dropping a dragged fish at `world` does: combine/splice it with a legal
// partner under the cursor, or (Bio Fish) splice an Octopus with an
// egg-hatched friendly alien; anywhere else it simply stays where it was
// dropped and resumes swimming.
function resolveFishDrop(dragged, world) {
  if (hostileAliensActive(state)) return;
  const target = findMergeSubjectAt(state, world.x, world.y, dragged.id);
  if (!target) return;
  if (dragged.type === 'friendly_alien' || target.type === 'friendly_alien') {
    // Bio Fish: a grown Octopus + an egg-hatched friendly alien, dragged either way round.
    const octopus = dragged.type === 'fish' ? dragged : target;
    const alien = dragged.type === 'friendly_alien' ? dragged : target;
    if (octopus.type === 'fish' && alien.type === 'friendly_alien' && canSpliceOctopusWithAlien(state, octopus, alien)) {
      spliceOctopusWithAlien(state, octopus, alien);
    }
    return;
  }
  if (canCombineFish(state, dragged, target)) {
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
}

input.rightMouseUpHandlers.push((sx, sy) => {
  const pressedId = rightPressFishId;
  rightPressFishId = null;
  rightPressDragCandidate = false;
  if (pressedId == null) return;
  const moved = Math.hypot(sx - rightPressStartSx, sy - rightPressStartSy) >= ITEM_DRAG_MOVE_THRESHOLD_PX;
  if (moved) input.suppressContextMenuUntilMs = performance.now() + 200; // this was a drag, not a right-click — see Engine.js's contextmenu listener
  if (draggedFishId != null) {
    const dragged = state.level.entities.find((e) => e.id === draggedFishId);
    draggedFishId = null;
    if (dragged) {
      resolveFishDrop(dragged, screenToWorld(sx, sy, state.camera));
      dragged.wanderTimer = 0; // resume swimming right away from wherever it was dropped (a no-op if it was just merged away)
    }
    return;
  }
  // A plain right-click (no drag) on a toggleable hybrid flips its ability.
  if (moved || state.ui.paused || state.level.tutorialFlow) return;
  const fish = state.level.entities.find((e) => e.id === pressedId && e.type === 'fish');
  if (fish && TOGGLEABLE_FISH_SPECIES.includes(fish.speciesId)) toggleFishAbility(state, fish);
});

// ---- Production info: Ctrl + left-drag box select ----
// Per direct request (moved off Shift, which is the group move now): with
// nothing armed (the plain cursor), holding Ctrl and dragging draws a selection box, and a modal above it (UI.js's
// updateProductionInfoModal) shows what the fish/buildings inside produce and
// consume, their electricity, and the items/chests inside. The box is in
// WORLD space (anchored to the tank as the camera moves) and, unlike the
// Blueprint box, free-form pixels rather than tile-snapped, since fish and items
// aren't on the grid. Releasing the mouse removes the box and the modal at once.
// It uses Engine.js's mouseDownInterceptors/clickInterceptors so none of the
// ordinary left-press handlers (item/chest/recipe drags, info modals, coin
// banking) also react to the same press.
let prodSelect = null; // { x0, y0 } world-space start of the active selection, or null
let prodSelectSwallowClick = false; // the native click after a selection's mouseup shouldn't also act

input.mouseDownInterceptors.push((sx, sy) => {
  prodSelectSwallowClick = false; // a lost release (mouseup outside the window) must not leave a stale swallow
  if (!isCtrlHeld() || state.ui.selectedTool !== 'cursor' || state.ui.paused || state.level.tutorialFlow) return false;
  const world = screenToWorld(sx, sy, state.camera);
  prodSelect = { x0: world.x, y0: world.y };
  return true;
});

input.mouseUpHandlers.push(() => {
  if (!prodSelect) return;
  prodSelect = null;
  prodSelectSwallowClick = true;
  closeProductionInfoModal();
});

input.clickInterceptors.push(() => {
  if (!prodSelectSwallowClick) return false;
  prodSelectSwallowClick = false;
  return true;
});

// ---- Group move: Shift + left-drag box select ----
// Per direct request, mimics the Blueprint tool but moves the buildings: with
// the plain cursor, Shift + drag draws a tile-snapped box and lifts every
// building in it (Grid.js's pickUpBuildingsInBox); the group then follows the
// cursor as a ghost until a click drops it (free, one Ctrl+Z for the whole
// move). Shift + click on the drop replaces buildings in the way (they're sold
// for their refund); without Shift an overlapping drop is refused. Right-click,
// Esc, Q, opening the pause menu or picking another tool puts everything back.
let groupMoveDragStart = null; // { col, row } tile where the box began, or null
let groupMove = null; // { cells, level } while the lifted group is being carried
let groupMoveSwallowClick = false; // the native click after the box's mouseup must not also drop the group

input.mouseDownInterceptors.push((sx, sy) => {
  groupMoveSwallowClick = false;
  if (groupMove != null || movingBuilding != null || !isShiftHeld() || state.ui.selectedTool !== 'cursor' || state.ui.paused || state.level.tutorialFlow) return false;
  const world = screenToWorld(sx, sy, state.camera);
  if (world.y < SEABED_FLOOR_Y) return false; // buildings only live in the seabed
  groupMoveDragStart = worldToTile(world.x, world.y);
  return true;
});

input.mouseUpHandlers.push((sx, sy) => {
  if (!groupMoveDragStart) return;
  const start = groupMoveDragStart;
  groupMoveDragStart = null;
  groupMoveSwallowClick = true;
  closeProductionInfoModal();
  const world = screenToWorld(sx, sy, state.camera);
  const end = worldToTile(world.x, world.y);
  const cells = pickUpBuildingsInBox(state, start.col, start.row, end.col, end.row);
  if (cells.length > 0) groupMove = { cells, level: state.level };
});

input.clickInterceptors.push(() => {
  if (!groupMoveSwallowClick) return false;
  groupMoveSwallowClick = false;
  return true;
});

function cancelGroupMove() {
  if (!groupMove) return;
  for (const cell of groupMove.cells) putDownMovedBuilding(state, cell.fromCol, cell.fromRow, cell.buildingId, cell.data, false);
  groupMove = null;
}

input.rightClickHandlers.push(() => {
  if (!state.ui.paused) cancelGroupMove();
});

// Called every tick: a carried group is put back if the player pauses or arms a
// real tool, and quietly dropped if the level it was lifted from is gone.
function updateGroupMoveGate() {
  if (groupMove && groupMove.level !== state.level) groupMove = null;
  if (groupMove && (state.ui.paused || !isCursorOrFoodTool(state.ui.selectedTool))) cancelGroupMove();
}

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
// Fish combine-drag pattern above (draggedFishId) for the
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
  // Per direct follow-up report ("I keep grabbing food instead of spawning
  // food"), later partially reverted per an even more direct follow-up
  // ("the only thing that can't be dragged by the food tool is food —
  // everything else should be able to be dragged with the food tool") — the
  // literal Food tool no longer blocks starting a drag entirely; it only
  // still refuses to grab an existing FOOD pellet (the item-type check just
  // below), since a click on empty water with it armed is still supposed to
  // unambiguously drop a new pellet, not fight over whether the player meant
  // to grab one sitting nearby. Every other draggable item type (coin/waste/
  // science/etc.) is grabbable with the Food tool exactly like the plain
  // cursor tool. A build/blueprint tool silently falling back to Food-like
  // click behavior while hovering open water (effectiveToolAt, above) still
  // isn't a real drag-blocking tool either way — unchanged from before.
  if (!isCursorOrFoodTool(effectiveToolAt(world.y))) return;
  let best = null;
  let bestDistSq = Infinity;
  for (const item of state.level.items) {
    if (!DRAGGABLE_ITEM_TYPES.includes(item.type)) continue;
    if (item.type === 'food' && state.ui.selectedTool === 'food') continue;
    // Already claimed as a building's input (mid-disintegrate) — per direct
    // report, can't be grabbed at all while that's happening, not even a
    // Collector-held coin/Science Flask (which tracks its own hold via
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
    // A genuine drag (not just a click-to-bank) on the Sea Turtle's own
    // attached coin permanently detaches it — per direct spec the coin only
    // needs to stay glued to the turtle "unless" the player deliberately
    // grabs it; without this, updateSeaTurtle would just snap it straight
    // back onto the turtle's back the very next real frame, fighting
    // whatever the player just dragged it to. A plain click never reaches
    // here with itemDragMoved true, so the normal click-to-bank path (and
    // this feature's own $ pricing/collect-count bump) is completely
    // unaffected.
    if (itemDragMoved && state.level.seaTurtle && state.level.seaTurtle.coinItemId === draggedItemId) {
      state.level.seaTurtle.coinItemId = null;
      const coin = state.level.items.find((it) => it.id === draggedItemId);
      if (coin) coin.seaTurtleAttached = false;
    }
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
  // y=getUnlockedWorldH(state) edges (the side glass panels, since removed, were drawn by main.js's renderTankWalls; see also
  // Grid.js's renderCameraBottomBuffer) — clamping to those same world coordinates,
  // the exact ones Entities.js's clampItemToWorldWalls/Grid.js's
  // sweepVertical already enforce for ordinary (non-dragged) physics, keeps
  // a dragged item out of both for free, with no separate screen-space
  // check needed. No item type gets any additional, narrower clamp on top of
  // this any more — per direct request, Waste's old "can't be dragged back
  // up above SEABED_FLOOR_Y" floor is gone, so every item can be dragged
  // anywhere in the tank, city or open water alike.
  const margin = dragged.radius || 0;
  const clampedX = Math.min(Math.max(world.x, margin), WORLD_W - margin);
  const clampedY = Math.min(Math.max(world.y, margin), getUnlockedWorldH(state) - margin);
  dragged.x = clampedX;
  dragged.y = clampedY;
  dragged.rollPrevX = clampedX; // rolling (Entities.js's updateItemRoll) measures displacement — rebaselined so the cursor snapping an item around never reads as it rolling, per direct request's visual-only roll
  dragged.resting = false;
}

// Storage Chest aim-drag — per direct request ("make it so the player has
// to drag and drop in the direction they want the objects to spit, with the
// cursor turning into an arrow animation in the direction of the line
// between the storage chest and the cursor. When they release, have the
// storage chest trickle the output in the chosen direction"), later
// extended ("make the distance the chests spits out objects variable based
// on the distance away the cursor gets from the chest") to also drive
// launch distance. It was once mirrored by a right-button "clear" gesture; per
// direct request that became the chest's Pour/Trickle toggle (right-drag now
// moves buildings), so releasing this one drag either arms an ongoing trickle
// (armChestTrickle) or immediately triggers a full staggered dump
// (clearChestContents) depending on the chest's mode, and drives the identical glowing/stretching/
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
      const chestData = state.level.buildingData[chestAimDragKey];
      // The chest tutorial's own drag step teaches the trickle, so it forces Trickle mode.
      if (chestData && isChestTrickleStepActive(state)) setChestPourMode(state, chestAimDragKey, false);
      // Per direct request, the chest's Pour/Trickle toggle (default Pour) decides what releasing does:
      // Pour dumps everything out along the aim (what the right-drag used to do), Trickle arms the auto-trickle.
      if (chestData && chestData.pourMode !== false) clearChestContents(state, chestAimDragKey, angle, distanceTiles);
      else armChestTrickle(state, chestAimDragKey, angle, distanceTiles);
      advanceTutorialFlow(state, 'chest', 'trickle');
    }
  }
  chestAimDragKey = null;
  lastCursorTool = null; // force updateCanvasCursor to re-apply the ordinary tool cursor next frame, since this gesture was overriding it directly
});

// Called every tick from update() while the chest-aim drag is in
// progress — recomputes the live angle/distance from whichever chest is
// being dragged from to wherever the cursor currently is, and points the OS
// cursor glyph itself in that exact direction, stretching/glowing/changing
// color with distance (chestAimCursorCss below), per direct request. Both
// gestures share one cursor treatment — the player is aiming the same way
// either time, just choosing left (trickle) or right (clear) for what
// happens on release.
function updateChestAimDrag() {
  const activeKey = chestAimDragKey;
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
  if (!isCursorOrFoodTool(state.ui.selectedTool)) return; // drag-copy is a cursor gesture — with a Blueprint/build tool armed a drag starting on a building is that tool's own (it used to also arm a copy and swallow the Blueprint's capture click)
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
  if (!isCursorOrFoodTool(state.ui.selectedTool)) return; // drag-copy is a cursor gesture — with a Blueprint/build tool armed a drag starting on a building is that tool's own (it used to also arm a copy and swallow the Blueprint's capture click)
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
  if (type === 'groupMove') return 'Undo Move';
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
      if (!result.ok) putDownMovedBuilding(state, entry.toCol, entry.toRow, picked.type, picked.data, false); // couldn't go back — put it right back where undo found it rather than losing it
    }
  } else if (entry.type === 'groupMove') {
    // Lift the whole moved group first (a destination can be another building's origin), put each back where it came from, then restore anything the move replaced.
    const lifted = entry.moves.map((m) => ({ m, picked: pickUpBuildingForMove(state, m.col, m.row) }));
    for (const { m, picked } of lifted) {
      if (!picked) continue;
      const result = putDownMovedBuilding(state, m.fromCol, m.fromRow, picked.type, picked.data);
      if (!result.ok) putDownMovedBuilding(state, m.col, m.row, picked.type, picked.data, false); // origin got built on — leave it where undo found it rather than losing it
    }
    for (const m of entry.moves) {
      if (!m.oldBuildingId) continue;
      const result = putDownMovedBuilding(state, m.col, m.row, m.oldBuildingId, m.oldData);
      if (result.ok) state.level.money = Math.max(0, state.level.money - m.refund);
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

// Cancels an UNCONFIRMED fresh fan placement/replace (click 1 already
// bought/replaced it, click 2 hasn't confirmed the angle yet) by reversing
// the exact undo entry click 1 itself just pushed — per direct spec
// ("right-click, Q or esc to cancel and refund a placement of a fan if one
// click has been made to buy the fan but not a second click to confirm the
// angle"). The undo stack's top entry is guaranteed to still be this exact
// fan's own 'place'/'replace' entry the whole time fanAimingCell stays
// armed (isFanAimingActive() only stays true while THIS fan's own build
// tool is still selected — see its own comment — so no other undo-worthy
// action can be pushed in between). Never called for the OTHER
// isFanAimingActive() case (a MOVED fan's own re-aim step,
// fanAimingMoveData != null) — that's always free to begin with and
// already has its own distinct put-back-at-origin cancel path (see the
// move-cancel right-click handler), nothing to refund there.
function cancelArmedFanPlacement() {
  if (fanAimingCell == null || fanAimingMoveData != null) return;
  performUndo();
  fanAimingCell = null;
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
  // Per direct request — a Storage Chest's contents and any item mid-held by
  // this tile (Refinery/Manufacturer/Collector) both get spawned/released
  // right now, synchronously, BEFORE removeTile clears buildingData below —
  // see collectDemolishSpawnPoints' own comment for why this can't just wait
  // for the normal per-tick drain (it wouldn't run at all while paused).
  const demolishSpawnPoints = collectDemolishSpawnPoints(state, col, row);
  if (demolishSpawnPoints.length > 0) materializeChestSpawnPoints(state, demolishSpawnPoints);
  const moneyBefore = state.level.money;
  const removed = removeTile(state, col, row);
  if (!removed) return;
  startTileBreakAnimation(col, row, existingType); // per direct request — visual only, the tile is already gone from the grid
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

// Finishes a building move at the tile under `world`: puts it down there (one
// Undo entry unless it didn't actually change tile), or, for a Fan, hands it to
// its own angle-choosing step. Returns null on success, else the failure reason
// (the building stays picked up — the caller decides whether to retry or snap back).
function confirmBuildingMoveAt(world) {
  const { col, row } = worldToTile(world.x, world.y);
  if (FAN_BUILDING_IDS.includes(movingBuilding.buildingId)) {
    const check = canPlaceTile(state, col, row, movingBuilding.buildingId, true);
    if (!check.ok) return check.reason;
    fanAimingCell = { col, row, buildingId: movingBuilding.buildingId };
    fanAimingMoveData = movingBuilding.data;
    fanAimingMoveOrigin = { fromCol: movingBuilding.fromCol, fromRow: movingBuilding.fromRow };
    movingBuilding = null;
    return null;
  }
  const result = putDownMovedBuilding(state, col, row, movingBuilding.buildingId, movingBuilding.data);
  if (!result.ok) return result.reason;
  if (movingBuilding.fromCol !== col || movingBuilding.fromRow !== row) {
    pushUndoEntry({ type: 'move', fromCol: movingBuilding.fromCol, fromRow: movingBuilding.fromRow, toCol: col, toRow: row });
  }
  movingBuilding = null;
  return null;
}

// ---- Right-drag: move a building ----
// Per direct request, moving a building is now a right-button press-drag-release
// (like the left-drag recipe copy) instead of the old middle-click; middle-click
// became a pipette. Only with the plain cursor armed: with any tool selected a
// right-click just cancels it (the universal-cancel handler below), so one right
// click never both cancels the selection AND starts a move. The building is picked
// up once the press has moved past the drag threshold (so a plain right-click on
// one does nothing here), follows the cursor as the usual ghost, and releasing
// over a valid tile puts it there (a Fan then needs its extra angle click, as
// before); an invalid release snaps it back to where it was.
const eyeDirScratch = { x: 1, y: 0 }; // reused for every fish's eye direction in render() — drawFish only reads it during its own call, so one shared object is safe
let rightMoveCandidate = null; // { col, row, sx, sy } while a right press on a building is waiting to turn into a drag
let rightMoveDragging = false; // true once that press picked the building up

input.rightMouseDownHandlers.push((sx, sy) => {
  rightMoveCandidate = null;
  rightMoveDragging = false;
  if (state.ui.paused || state.level.tutorialFlow) return;
  if (state.ui.selectedTool !== 'cursor') return;
  if (rightPressFishId != null) return; // a fish is under the press — that's the fish move/merge drag
  if (movingBuilding != null || (isFanAimingActive() && fanAimingMoveData != null)) return;
  const world = screenToWorld(sx, sy, state.camera);
  const { col, row } = worldToTile(world.x, world.y);
  const tile = getTile(state.level.grid, col, row);
  if (!tile || tile === TILE_EMPTY) return;
  rightMoveCandidate = { col, row, sx, sy };
});

input.rightMouseUpHandlers.push((sx, sy) => {
  rightMoveCandidate = null;
  if (!rightMoveDragging) return;
  rightMoveDragging = false;
  input.suppressContextMenuUntilMs = performance.now() + 200; // this was a drag, not a right-click — don't also run the cancel handlers
  if (movingBuilding == null) return; // already put back (a tool got selected mid-drag)
  const failure = confirmBuildingMoveAt(screenToWorld(sx, sy, state.camera));
  if (failure) {
    handleBuildPlacementFailure(failure);
    putDownMovedBuilding(state, movingBuilding.fromCol, movingBuilding.fromRow, movingBuilding.buildingId, movingBuilding.data, false); // snap back
    movingBuilding = null;
  }
});

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
  // A right press on a building that has now moved far enough picks it up (see the right-drag section above).
  if (rightMoveCandidate && !rightMoveDragging && input.rightMouseDown && movingBuilding == null
      && Math.hypot(input.mouse.x - rightMoveCandidate.sx, input.mouse.y - rightMoveCandidate.sy) >= ITEM_DRAG_MOVE_THRESHOLD_PX) {
    const picked = pickUpBuildingForMove(state, rightMoveCandidate.col, rightMoveCandidate.row);
    if (picked) {
      movingBuilding = { fromCol: rightMoveCandidate.col, fromRow: rightMoveCandidate.row, buildingId: picked.type, data: picked.data };
      rightMoveDragging = true;
    }
    rightMoveCandidate = null;
  }
  if (movingBuilding != null && !isCursorOrFoodTool(state.ui.selectedTool)) {
    putDownMovedBuilding(state, movingBuilding.fromCol, movingBuilding.fromRow, movingBuilding.buildingId, movingBuilding.data, false);
    movingBuilding = null;
  }
  // Same self-healing for a moved Fan's own angle-choosing step — it never
  // changes selectedTool away from the cursor/Food tool itself (see
  // isFanAimingActive's own comment), so this is what actually catches "the
  // player did something that should cancel this" for that case, restoring
  // the Fan at its ORIGINAL spot since it was already picked up off the grid.
  if (fanAimingCell != null && fanAimingMoveData != null && !isCursorOrFoodTool(state.ui.selectedTool)) {
    putDownMovedBuilding(state, fanAimingMoveOrigin.fromCol, fanAimingMoveOrigin.fromRow, fanAimingCell.buildingId, fanAimingMoveData, false);
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
  if (groupMove != null) {
    const { col, row } = worldToTile(world.x, world.y);
    const result = placeGroupMove(state, col, row, groupMove.cells, isShiftHeld());
    if (!result.ok) {
      handleBuildPlacementFailure(result.reason); // stay in carry mode — the ghost keeps following, try again
      return;
    }
    pushUndoEntry({ type: 'groupMove', moves: result.placed });
    if (result.anyReplace) playDemolish();
    groupMove = null;
    return;
  }
  if (movingBuilding != null) {
    const failure = confirmBuildingMoveAt(world);
    if (failure) handleBuildPlacementFailure(failure); // stay in move mode — the ghost keeps following, try again
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
    const moneyBeforePaste = state.level.money;
    const placedCells = placeBlueprint(state, col, row, blueprintClipboard);
    for (const p of placedCells) pushUndoEntry({ type: 'place', col: p.col, row: p.row, buildingId: p.buildingId });
    if (placedCells.length > 0) showPurchaseCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE, moneyBeforePaste - state.level.money);
    blueprintClipboard = null;
    return;
  }

  // Alien Invasion: clicking a living alien always does ALIEN_CLICK_DAMAGE,
  // regardless of the currently selected tool — same "always works,
  // whatever's selected" precedent coin-banking (below) already has.
  // Checked first so it can't be shadowed by a build tool's own early-return
  // branches.
  for (const entity of state.level.entities) {
    if (entity.type !== 'alien' || entity.hp <= 0) continue;
    if (Math.hypot(entity.x - world.x, entity.y - world.y) <= (entity.radius ?? ALIEN_RADIUS) * ALIEN_CLICK_RADIUS_MULTIPLIER) {
      // Per direct request — no click-attacks while Pause Time is on, with
      // the same red cursor text as trying to move fish during an attack.
      if (state.ui.timePaused) {
        showBuildError(ALIEN_CLICK_PAUSED_MESSAGE);
        return;
      }
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

  // Per direct follow-up request ("let's make it so that you right-click to
  // toggle on/off hybrid fish... Switching it to right click will prevent
  // the delay that happens on hybrid fish when you single click them")
  // — Magnet Fish/Feeder Fish/Bio Fish's on/off toggle moved to a dedicated
  // right-click handler below (see its own comment), so a single left-click
  // on ANY fish, toggleable or not, now opens its info modal immediately
  // with no deferred double-click disambiguation needed any more — see the
  // generic fallback further below.
  const clickedFish = findFishAt(state, world.x, world.y);

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
          applyPipetteData(state, col, row, buildingId);
          state.ui.lastPlacedTileCol = col;
          state.ui.lastPlacedTileRow = row;
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
      applyPipetteData(state, col, row, buildingId);
      state.ui.lastPlacedTileCol = col;
      state.ui.lastPlacedTileRow = row;
      if (result.replaced) {
        pushUndoEntry({ type: 'replace', col, row, oldBuildingId: result.oldBuildingId, oldData: result.oldData, netCost: result.info.netCost });
        showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, result.info.netCost);
      } else {
        pushUndoEntry({ type: 'place', col, row, buildingId });
        showPurchaseCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE, result.info.netCost);
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
    // like the building modal"). A toggle-capable fish's click is deferred
    // through the double-click check above instead, and only ever reaches
    // openFishInfoMenu through ITS OWN timeout, never through this line.
    // Per direct request, fish modals only open with nothing armed on the cursor — not with Food, a shop fish, a building or a Blueprint selected.
    if (clickedFish && effectiveTool === 'cursor') { openFishInfoMenu(state, clickedFish.id); return; }
  }
  // Per direct request ("the default cursor CANNOT drop food. The food tool
  // has to be selected to drop food") — this is the ONE and only place Food
  // ever gets dropped, strictly gated on the literal 'food' tool (never the
  // plain 'cursor' default, even though the two are otherwise
  // interchangeable everywhere else — see UI.js's isCursorOrFoodTool).
  if (effectiveTool === 'food') {
    const reason = trySpawnFood(state, world.x, world.y);
    if (reason === 'no_money') flashMoneyInsufficient(state);
    else if (reason === 'spawned') advanceTutorialFlow(state, 'hunger', 'feed'); // hunger tutorial's feed step
    return;
  }
  // A purchased fish is placed with a click, exactly like a building — see
  // Entities.js's trySpawnPurchasedFish and UI.js's selectSpeciesForPreview
  // (which sets this tool instead of arming a Buy button any more).
  if (effectiveTool.startsWith('fish:')) {
    const moneyBeforeFish = state.level.money;
    const result = trySpawnPurchasedFish(state, effectiveTool.slice('fish:'.length), world.x, world.y);
    if (result === 'no_money') flashMoneyInsufficient(state);
    else if (result === 'spawned') {
      showPurchaseCostText(world.x, world.y - TILE_SIZE, moneyBeforeFish - state.level.money);
      advanceTutorialFlow(state, 'start', 'buyfish'); // game-start guided tutorial's final step
    }
    return;
  }
  // Non-fan build-mode placement doesn't happen here — see the mousedown/
  // drag handling in update() below, which also covers a single un-dragged
  // click for those building types.
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
    putDownMovedBuilding(state, movingBuilding.fromCol, movingBuilding.fromRow, movingBuilding.buildingId, movingBuilding.data, false);
    movingBuilding = null;
    return;
  }
  if (isFanAimingActive() && fanAimingMoveData != null) {
    putDownMovedBuilding(state, fanAimingMoveOrigin.fromCol, fanAimingMoveOrigin.fromRow, fanAimingCell.buildingId, fanAimingMoveData, false);
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
  // The hunger tutorial's last step is exactly this right-click, so it's the one tutorial state that lets it through.
  const hungerDeselectStep = state.level.tutorialFlow?.id === 'hunger' && state.level.tutorialFlow.step === 'deselect';
  if (state.ui.paused || (state.level.tutorialFlow && !hungerDeselectStep)) return;
  closeSidePanels(state, true); // right-click cancels the tool but leaves the Shop open until its own X/E, per direct request
  cancelActiveTool(state);
  if (hungerDeselectStep) advanceTutorialFlow(state, 'hunger', 'deselect');
  // A Fan's pending angle-adjust step (fanAimingCell) isn't itself part of
  // selectedTool, so cancelActiveTool above clearing the tool back to
  // 'cursor' only makes isFanAimingActive() self-heal to false — the stale
  // {col, row, buildingId} it left behind was still sitting here, so
  // pressing Q right afterward (which just reselects state.ui.lastArmedTool)
  // reactivated THIS same old angle-adjust step instead of starting a fresh
  // placement under the cursor. Per direct bug report (from back when click
  // 2 was still the real purchase): right-click must fully cancel it, no
  // lingering spot for a later Q to pull back up. Per a later direct spec
  // ("right-click, Q or esc to cancel and refund a placement of a fan if
  // one click has been made to buy the fan but not a second click to
  // confirm the angle"), this now actually UNDOES the click-1 purchase too
  // (cancelArmedFanPlacement — a no-op for the move-in-progress case, which
  // the handler above this one already fully resolved on its own).
  cancelArmedFanPlacement();
});

// Pipette whatever is at `world`: a fish (checked first — its hit radius is the
// bigger, more forgiving target) or a placed building, arming it as the current
// tool exactly like clicking its shop icon (a building's recipe/filter/chest mode
// ride along — see UI.js's pipetteSelectBuilding). Returns whether anything was found.
function pipetteAtWorld(world) {
  const fish = findFishForPipetteAt(state, world.x, world.y);
  if (fish) {
    pipetteSelectSpecies(state, fish.speciesId);
    return true;
  }
  const { col, row } = worldToTile(world.x, world.y);
  const tileType = getTile(state.level.grid, col, row);
  if (tileType && tileType !== TILE_EMPTY) {
    pipetteSelectBuilding(state, tileType, `${row},${col}`);
    return true;
  }
  return false;
}

// Middle-click = pipette, per direct request (it used to arm a building move,
// which is right-drag now). Pipettes whatever's under the cursor, replacing any
// armed tool; nothing under the cursor does nothing (no clear / last-used
// fallback — that stays on Q).
input.middleClickHandlers.push((sx, sy) => {
  if (state.ui.paused || state.level.tutorialFlow) return;
  if (movingBuilding != null || (isFanAimingActive() && fanAimingMoveData != null)) return;
  pipetteAtWorld(screenToWorld(sx, sy, state.camera));
});

// Build-mode drag-placement: while the left button is held and a build tool
// is selected, place a tile under the cursor once per tile cell entered
// (not once per physics tick) so dragging across several cells lays a row
// without re-spending money on a cell it's already sitting over.
let lastBuildCell = null;
// Ctrl + Click: Snap Placement's own one-shot-per-press guard — cleared
// alongside lastBuildCell on mouse-up, set the instant a press places its
// line so holding the button down doesn't keep re-placing more lines every
// tick the way normal drag-placement re-places a single tile per cell.
let snapLinePlacedThisPress = false;

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

// Per direct request, any purchase shows a red negative cost like a coin pickup's
// text: a fresh single building/fish at its spot, a Blueprint paste or Shift-line
// as ONE aggregated number at the click. (A replace already uses the net-cost
// version above.) Free purchases show nothing.
function showPurchaseCostText(worldX, worldY, cost) {
  if (cost > 0) {
    const text = createPickupText(worldX, worldY, `-$${cost}`, '#ff6b6b');
    text.center = true;
    state.level.floatingTexts.push(text);
  }
}

function handleBuildPlacementFailure(reason) {
  if (reason === 'cannot afford') {
    flashMoneyInsufficient(state);
    showBuildError("Can't afford");
  } else if (reason === 'tank locked') {
    showBuildError('Tank locked — expand in Tank Upgrades');
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
  if (state.ui.fishInfoModalFishId != null && (e.code !== 'Escape' || state.ui.paused)) closeFishInfoMenu(state); // Escape is left to closeAllModals below, which closes it along with everything else and consumes the press
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
  // Per direct request ("make it so that during tutorials you can use
  // hotkeys W/Ctrl+C to toggle the tools on or off, in case they are on and need
  // to be turned off for the tutorial") — a third exception to "every hotkey
  // is swallowed during a tutorial," alongside Escape/KeyE above. selectTool
  // already toggles (re-pressing an already-armed tool's own hotkey clears
  // back to the plain cursor — see its own comment), so this reuses it
  // completely unchanged rather than duplicating that logic.
  // Also records state.ui.tutorialToolOverrideStep (see its own comment) so
  // UI.js's per-frame "keep the step's own required tool selected" self-heal
  // doesn't immediately stomp this deliberate toggle back on the very next
  // frame — every real tutorial step specifies a required tool, so without
  // this the toggle would be functionally invisible (on for one frame, then
  // silently reverted).
  if (state.level.tutorialFlow) {
    const flow = state.level.tutorialFlow;
    if (e.code === 'KeyW') { selectTool(state, 'food'); state.ui.tutorialToolOverrideStep = `${flow.id}:${flow.step}`; return; }
    if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); selectTool(state, 'blueprint'); state.ui.tutorialToolOverrideStep = `${flow.id}:${flow.step}`; return; }
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
  // close (Mound/recipe/building-info/platform-filter/Lab-purchase) also
  // already closes on a click anywhere outside it, so nothing is stranded
  // without a close path.
  //
  // Per a later direct request ("Escape will close the shop menu, tank
  // upgrade menu, or science lab if they are open. If none of them are
  // open, Escape will pause the game") — a SPECIFIC, narrower piece of that
  // old decision tree comes back: these three are the persistent, semi-
  // modal side panels a player is likely to still have open when they reach
  // for Escape expecting SOMETHING to happen right in front of them, rather
  // than the game pausing behind it. Every other popup (Mound, recipe,
  // building-info, platform-filter, fish-info) still relies purely on its
  // own click-outside-to-close, same as before — only these three, plus the
  // pre-existing fan-placement-cancel exception below, are special-cased
  // here. See UI.js's updateHUD for the matching bottom-left legend text
  // (dynamically "Close Menu" vs. "Pause Menu" depending on this same
  // condition).
  if (e.code === 'Escape') {
    if (groupMove != null) {
      cancelGroupMove();
      return;
    }
    if (fanAimingCell != null && fanAimingMoveData == null) {
      cancelArmedFanPlacement();
      return;
    }
    // Per direct request one Escape closes every open menu and pop-up at once (shop, tank, lab, fish/building
    // modals, merge/splice/science-node popups, ...) and is then consumed — the pause menu only opens on the
    // next press, when nothing is left to close.
    if (!state.ui.paused && closeAllModals(state)) return;
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
    case 'KeyG': { // toggles every placed Fan's cone/arrow visibility on/off; Shift+G keeps the old debug "spawn selected species, fully grown, at cursor" cheat
      if (e.shiftKey) {
        const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
        spawnFishCheat(state, state.debug.selectedSpecies, world.x, world.y, true);
      } else {
        state.ui.fanConesVisible = !state.ui.fanConesVisible;
      }
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
    case 'KeyW': // Food — matches the fixed bottom tool-bar's own hotkeys; moved off 1 per direct request, which now belongs to Favorite slot 1
      selectTool(state, 'food');
      break;
    // 1/2/3 — Favorite slots 1/2/3 (moved down from 3/4/5 per direct request, when Food moved to W and Blueprint to Ctrl+C).
    // Per direct request (replacing the old F hotkey): with the shop open and a
    // fish/building selected they PIN that selection into the slot (overwrite,
    // or toggle off if it's already there); otherwise they select the slot's
    // favorite as before.
    case 'Digit1':
      if (!setFavoriteSlotFromShop(state, 0)) selectFavorite(state, 0);
      break;
    case 'Digit2':
      if (!setFavoriteSlotFromShop(state, 1)) selectFavorite(state, 1);
      break;
    case 'Digit3':
      if (!setFavoriteSlotFromShop(state, 2)) selectFavorite(state, 2);
      break;
    case 'KeyZ': // Ctrl+Z — undo the last building place/move/sell
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        performUndo();
      }
      break;
    case 'KeyE': // toggle-collapse the shop panel — moved off KeyQ per direct request, freeing Q up for the Pipette Tool below. Per a later direct request it ONLY opens/closes the shop, never changing the selection.
      toggleShopCollapse(state);
      break;
    case 'KeyQ': { // Clear Blueprint / Pipette Tool / "last used" fallback / Clear Cursor — per direct request
      if (groupMove != null) { // a carried group move is cleared first, like a copied Blueprint
        cancelGroupMove();
        break;
      }
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
        // the next time that tier was picked. Per a later direct spec, this
        // now also actually undoes the click-1 purchase/replace for an
        // unconfirmed fresh placement (cancelArmedFanPlacement — a no-op for
        // a moved fan's own re-aim step, which stays free either way).
        cancelArmedFanPlacement();
      } else {
        const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
        if (!pipetteAtWorld(world) && state.ui.lastArmedTool) {
          if (state.ui.lastArmedTool.startsWith('fish:')) pipetteSelectSpecies(state, state.ui.lastArmedTool.slice('fish:'.length));
          else if (state.ui.lastArmedTool.startsWith('build:')) pipetteSelectBuilding(state, state.ui.lastArmedTool.slice('build:'.length));
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
    case 'KeyT': { // toggles the Tank Upgrades window (moved off KeyP per direct request); Shift+T keeps the old debug cheat — cycles the tile under the cursor through every building type, free
      if (!e.shiftKey) { toggleTankPanel(state); break; }
      const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      cycleTileCheat(state, world.x, world.y);
      break;
    }
    case 'KeyS': // toggles the Science Lab window, per direct request (S no longer pans the camera down — see Engine.js's updateCamera)
      toggleLabMenu(state);
      break;
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
    case 'KeyC': // Ctrl+C — Blueprint ("Stamp"), per direct request, replacing the toolbar button and the 2 hotkey; see blueprintClipboardActive's/blueprintClipboard's own comments. The wave-countdown cheat moved to Alt+C so the two don't collide.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        selectTool(state, 'blueprint');
        break;
      }
      if (!e.altKey) break;
      // set the countdown to the next Alien Invasion wave to exactly 10s from now — per direct request, for testing the Wave Countdown HUD/warning notifications without waiting out a real 3.5-4.5 minute gap. Touches ONLY alienNextWaveAtMs, same minimal shape as KeyY above — doesn't touch wave size, tier mix, or the difficulty ramp (all computed fresh, from alienWavesSpawned/elapsed, at the moment the wave actually fires), and is silently overwritten by updateAlienWaves' own real scheduling if a wave is already active (the countdown genuinely hasn't started yet in that case, same as it wouldn't for a real player).
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
// the sim loop (state.ui.gameStarted, checked in update() below) and plays
// TitleScreen.js's exit animation over the now-live tank.
initStartScreen(state, () => {
  state.ui.gameStarted = true;
  startGameMusic(); // per direct request — only Start/Continue (both funnel through this one callback) should ever start the music, not Settings/Help
  causticVideo.play().catch(() => {}); // retries the caustic overlay's autoplay, in case the browser blocked it before this first real user gesture
  exitTitle(startTutorialAfterDelay); // per direct request — SANITY/FIN fly up in bubble trails, and the guided tutorial starts once they've left
  scheduleShopButtonReminder(state); // per direct request — bounces the shop toggle until it's opened for the first time
  // Game-start guided tutorial (Shop -> Guppy -> buy your first fish) no
  // longer starts here — startTutorialAfterDelay() runs it once the title
  // exit has finished, per direct request.
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

// Resolves on the first pointerdown/keydown. The keydown is swallowed in the
// capture phase so that key doesn't also fire a game hotkey (Space would
// pause time); resumeAudio is called here because that swallowing also stops
// the page's own one-shot resumeAudio keydown listener from running.
function waitForFirstGesture() {
  return new Promise((resolve) => {
    const onGesture = (e) => {
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      if (e.type === 'keydown') e.stopImmediatePropagation();
      resumeAudio();
      resolve();
    };
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
  });
}

async function runLoadingSequence() {
  const resources = [
    preloadAudioFile('audio/Game.mp3'),
    preloadAudioFile('audio/Battle.mp3'),
    preloadAudioFile('audio/Boss.mp3'),
    preloadAudioFile('audio/Fin Sanity.mp3'),
    document.fonts ? document.fonts.ready : Promise.resolve(),
    loadTitleFonts(), // the title logo is baked into sprites once, so its font has to be ready first
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
  // Per direct request: browsers keep audio locked until a click/keypress, so
  // the splash (and its Fin Sanity stinger) waits for one — that is what makes
  // the menu music start with the splash every time.
  loadingStatus.textContent = 'Click or press any key to begin';
  loadingStatus.classList.add('ready');
  await waitForFirstGesture();
  loadingDone = true;
  loadingOverlay.classList.add('hidden');
  initTitleScreen();
  document.getElementById('start-overlay').classList.remove('hidden');
  showTitle(performance.now());
  startMenuMusic(); // per direct request — Fin Sanity once, then the low-passed Game song, for as long as the main menu is up
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
    snapLinePlacedThisPress = false;
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

  // Ctrl + Click: Snap Placement — per direct request, a discrete one-shot
  // action (buy the WHOLE previewed line in a single click) rather than the
  // normal continuous per-cell-entered drag-placement below, so it's gated
  // on snapLinePlacedThisPress (cleared on mouse-up, same as lastBuildCell)
  // instead of the per-cell dedup key. Only actually takes this path once
  // there's a real reference point AND at least one tile of line to place —
  // a 0-length line (the cursor's sitting right on the reference tile
  // itself, or the very first step is already blocked) falls through to the
  // normal single-tile placement/Replace path below instead of silently
  // no-opping, matching exactly what render()'s own ghost preview shows for
  // that same case (see its matching snap.tiles.length check). Moved off
  // Shift onto Ctrl per direct request ("switch the line snap tool hotkey
  // from shift + click to ctrl + click, currently it overlaps with the
  // replace hotkey") — Shift-click Replace's own check further down is
  // unaffected.
  if (isCtrlHeld() && state.ui.lastPlacedTileCol != null) {
    const snap = computeSnapLine(state, state.ui.lastPlacedTileCol, state.ui.lastPlacedTileRow, col, row, buildingId);
    if (snap.tiles.length > 0) {
      if (!snapLinePlacedThisPress) {
        snapLinePlacedThisPress = true;
        placeSnapLineTiles(state, buildingId, snap);
      }
      return;
    }
  }

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
    applyPipetteData(state, col, row, buildingId);
    state.ui.lastPlacedTileCol = col;
    state.ui.lastPlacedTileRow = row;
    if (buildResult.replaced) {
      pushUndoEntry({ type: 'replace', col, row, oldBuildingId: buildResult.oldBuildingId, oldData: buildResult.oldData, netCost: buildResult.info.netCost });
      showReplaceNetCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, buildResult.info.netCost);
    } else {
      pushUndoEntry({ type: 'place', col, row, buildingId });
      showPurchaseCostText(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE, buildResult.info.netCost);
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
      spawnChestTutorialWaste(state, `${row},${col}`);
    }
  }
}

// Ctrl + Click: Snap Placement's actual purchase — called once per press
// from updateBuildDrag above with the SAME tile list its own computeSnapLine
// call just produced (so what gets bought is exactly what the caller
// decided was worth buying, no risk of recomputing against a since-changed
// grid/cursor). Places each tile for real, one at a time, via the same
// placeTileWithReplace/applyPipetteData/pushUndoEntry trio every other
// placement path in this file already uses — so the line naturally stops
// for real if money runs out partway through, even though the ghost preview
// (render() below) shows the whole geometrically-valid line regardless of
// affordability (computeSnapLine's own `affordable` flag just tints it).
// Fans never reach this — updateBuildDrag's own FAN_BUILDING_IDS check
// above returns before Shift-snap is even considered for one, since a Fan
// needs its own aimed angle per tile, which doesn't fit a uniform batch
// line. Per direct request ("make sure the whole line also inherits the
// recipe/filter" if the reference building was pipetted) — applyPipetteData
// already reads state.ui.pipetteRecipeId/pipetteFilterItems fresh for every
// call, so calling it per tile here needs no new plumbing at all.
// Per direct follow-up request ("the shift click to place a line should go
// through already placed buildings, replacing any overlapping buildings...
// make sure the total cost takes into account the refunds... like the
// blueprint does") — the whole-line purchase is now all-or-nothing against
// `snap.netCost` (computeSnapLine's own already-simulated total, refunds
// included), checked ONCE upfront exactly like placeBlueprintWithReplace
// checks its own preview total, rather than placing tiles one at a time
// until money happens to run out. `shiftHeld: true` on every per-tile
// placeTileWithReplace call is what actually turns each occupied tile into
// a real replace (refund + charge the difference, or a free same-family
// swap preserving recipe/filter/angle) instead of a rejected "occupied" —
// computeSnapLine already only ever includes tiles it confirmed are either
// empty or genuinely replaceable, so every one of these calls is expected
// to succeed; the `if (!result.placed) break` is a defensive fallback only.
function placeSnapLineTiles(state, buildingId, snap) {
  if (snap.netCost > state.level.money) return;
  let lineNetCost = 0;
  let lastPlaced = null;
  for (const t of snap.tiles) {
    const result = placeTileWithReplace(state, t.col, t.row, buildingId, 0, true);
    if (!result.placed) break;
    applyPipetteData(state, t.col, t.row, buildingId);
    // Advances the anchor to wherever this line actually ended, per direct
    // "acts as the last placed building" precedent — a second Shift+click
    // naturally continues the same line further rather than restarting from
    // the original start tile.
    state.ui.lastPlacedTileCol = t.col;
    state.ui.lastPlacedTileRow = t.row;
    lineNetCost += result.info.netCost;
    lastPlaced = t;
    if (result.replaced) {
      pushUndoEntry({ type: 'replace', col: t.col, row: t.row, oldBuildingId: result.oldBuildingId, oldData: result.oldData, netCost: result.info.netCost });
    } else {
      pushUndoEntry({ type: 'place', col: t.col, row: t.row, buildingId });
    }
  }
  // ONE aggregated readout for the whole line, at its last tile, instead of one per tile.
  if (lastPlaced) {
    const wx = lastPlaced.col * TILE_SIZE + TILE_SIZE / 2;
    const wy = lastPlaced.row * TILE_SIZE;
    if (lineNetCost > 0) showPurchaseCostText(wx, wy, lineNetCost);
    else if (lineNetCost < 0) showReplaceNetCostText(wx, wy, lineNetCost);
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
  if (rightPressFishId == null || !rightPressDragCandidate) return;
  const dragged = state.level.entities.find((e) => e.id === rightPressFishId && ((e.type === 'fish' && !e.dying) || e.type === 'friendly_alien'));
  if (!dragged) { draggedFishId = null; rightPressFishId = null; rightPressDragCandidate = false; return; }
  if (draggedFishId == null) {
    // A right-press only becomes a drag once the cursor has actually moved, so a plain right-click (a hybrid's ability toggle) never nudges the fish.
    if (Math.hypot(input.mouse.x - rightPressStartSx, input.mouse.y - rightPressStartSy) < ITEM_DRAG_MOVE_THRESHOLD_PX) return;
    if (hostileAliensActive(state)) {
      if (!rightPressAlienNoticeShown) { rightPressAlienNoticeShown = true; showBuildError(FISH_DRAG_ALIEN_MESSAGE); }
      return;
    }
    draggedFishId = dragged.id;
  } else if (hostileAliensActive(state)) {
    // An alien appeared mid-drag — drop the fish right where it is.
    draggedFishId = null;
    rightPressDragCandidate = false;
    dragged.wanderTimer = 0;
    showBuildError(FISH_DRAG_ALIEN_MESSAGE);
    return;
  }
  const world = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
  dragged.x = Math.max(FISH_MIN_X, Math.min(FISH_MAX_X, world.x + rightPressGrabOffset.x)); // kept inside the tank, same bounds the fish's own wander uses
  dragged.y = Math.max(FISH_MIN_Y, Math.min(SEABED_FLOOR_Y, world.y + rightPressGrabOffset.y));
  dragged.vx = 0;
  dragged.vy = 0;
}

// Running Refineries/Manufacturers/Collectors/Power Plants occasionally
// spit out a bubble, per direct request — reuses the exact same transient
// effect list/shape a fish's own mouth-bubble already uses
// (state.level.fishBubbleEffects, see Entities.js's emitFishBubble), just
// spawned from a building's tile center instead of a swimming fish's mouth.
// Rolled on a shared timer (not every real tick) rather than per-frame, so
// the rate doesn't implicitly scale with frame rate/time-scale debug cheats.
const BUILDING_BUBBLE_TILE_IDS = [...BUILDING_FAMILIES.refinery, ...BUILDING_FAMILIES.collector, TILE_MANUFACTURER, TILE_POWER_PLANT];
const BUILDING_BUBBLE_ROLL_INTERVAL_MS = 1500;
const BUILDING_BUBBLE_CHANCE_PER_ROLL = 0.3;
let buildingBubbleTimerMs = 0;

// A Collector has no persistent "am I running" flag of its own (unlike a
// Refinery/Manufacturer's heldItemId or a Power Plant's fueled) — its own
// held item tracks ITS progress directly (Grid.js's stepCollectorProcessing/
// collectorProgressMs), so "is this exact tile currently running" is
// answered by checking whether any item is mid-process at this tile's
// center instead.
function isBuildingRunningForBubbles(state, data, centerX, centerY) {
  if (data.type === TILE_POWER_PLANT) return data.fueled === true;
  if (BUILDING_FAMILIES.collector.includes(data.type)) {
    return state.level.items.some((it) => it.collectorProgressMs != null && it.collectorCenterX === centerX && it.collectorCenterY === centerY);
  }
  return data.heldItemId != null; // Refinery and Manufacturer both track it this same way
}

function updateBuildingBubbles(dtMs) {
  buildingBubbleTimerMs += dtMs;
  if (buildingBubbleTimerMs < BUILDING_BUBBLE_ROLL_INTERVAL_MS) return;
  buildingBubbleTimerMs -= BUILDING_BUBBLE_ROLL_INTERVAL_MS;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    if (!BUILDING_BUBBLE_TILE_IDS.includes(data.type)) continue;
    const [row, col] = key.split(',').map(Number);
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;
    if (!isBuildingRunningForBubbles(state, data, centerX, centerY)) continue;
    if (Math.random() > BUILDING_BUBBLE_CHANCE_PER_ROLL) continue;
    // fromBuilding: true is what Entities.js's updateFishBubbleEffects reads
    // to cull this one differently — a much longer lifetime, surviving
    // until it's actually risen near the water's surface, and its own
    // bigger radius/rise-speed range (closer to Ambience.js's background
    // bubbles) — per direct follow-up request, rather than the short-lived,
    // smaller fish mouth-bubble defaults this list was built for.
    state.level.fishBubbleEffects.push({
      x: centerX + (Math.random() * 2 - 1) * TILE_SIZE * 0.25,
      y: centerY,
      radius: BUILDING_BUBBLE_RADIUS_MIN + Math.random() * (BUILDING_BUBBLE_RADIUS_MAX - BUILDING_BUBBLE_RADIUS_MIN),
      age: 0,
      riseSpeed: BUILDING_BUBBLE_RISE_SPEED_MIN + Math.random() * (BUILDING_BUBBLE_RISE_SPEED_MAX - BUILDING_BUBBLE_RISE_SPEED_MIN),
      wobbleFreq: 1.2 + Math.random() * 1.6,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 2 + Math.random() * 4,
      fromBuilding: true,
    });
  }
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
// getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX - viewH) to answer "is
// the camera currently panned all the way down" — used by the post-alien
// guided tutorial's "scroll" step to know when to advance/skip itself.
function isScrolledToBottom(state) {
  const viewH = canvas.height / state.camera.zoom;
  const maxY = Math.max(0, getUnlockedWorldH(state) + CAMERA_BOTTOM_BUFFER_PX - viewH);
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
  // Per direct request ("make it so the battle music only plays during the
  // alien waves, not when an alien egg hatches") — an Alien-Egg-hatched
  // friendly_alien is its own entity type, so only a genuine wave alien
  // ever counts here.
  const aliensAlive = state.level.entities.some((e) => e.type === 'alien');
  const msUntilNextWave = state.level.alienNextWaveAtMs - state.level.elapsed;
  const withinPreBattleWindow = !state.level.alienWaveActive && msUntilNextWave > 0 && msUntilNextWave <= ALIEN_MUSIC_BATTLE_LEAD_MS;
  setBattleMusicActive(aliensAlive || withinPreBattleWindow);
}

function update(dtMs) {
  // Ambience (bubbles/seaweed) deliberately does NOT run before the game has
  // started — the start screen's tank backdrop is a one-time half-resolution
  // snapshot (TitleScreen.js's captureTitleBackdrop), so the first rendered
  // frame is the whole scene as far as the title is concerned, and nothing
  // behind it needs to animate.
  if (state.ui.gameStarted) {
    updateAmbience(dtMs);
    // Per direct request ("moving the cursor creates bubbles... based on
    // speed") — a plain single-tick world-space delta (not the smoothed
    // rolling-window velocity itemDragPositionHistory uses for launch
    // momentum) is fine here: this only ever feeds a cosmetic spawn rate, so
    // an occasional stray extra/missing bubble from a jittery tick is
    // harmless, unlike a wrong-direction item launch would be.
    if (input.mouse.inside) {
      const cursorWorldNow = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      if (lastCursorBubbleWorldX != null && dtMs > 0) {
        const dx = cursorWorldNow.x - lastCursorBubbleWorldX;
        const dy = cursorWorldNow.y - lastCursorBubbleWorldY;
        const dtS = dtMs / 1000;
        // Per direct request ("make the bubbles that spawn from the cursor
        // have way more initial velocity, actually matching the cursor")
        // — the raw velocity VECTOR now goes to Ambience.js (not just its
        // magnitude), so a spawned bubble can actually launch in the
        // cursor's own direction of travel, not just spawn faster/bigger.
        spawnCursorBubbles(cursorWorldNow.x, cursorWorldNow.y, dx / dtS, dy / dtS, dtMs);
      }
      lastCursorBubbleWorldX = cursorWorldNow.x;
      lastCursorBubbleWorldY = cursorWorldNow.y;
    } else {
      lastCursorBubbleWorldX = null;
      lastCursorBubbleWorldY = null;
    }
  }
  if (!state.ui.gameStarted) return; // frozen until the player clicks Start on the first-launch start screen — render() still runs (a static frame), same "frozen but visible" pattern the pause menu already uses
  // Per direct request ("auto-save while paused, the 5 minute timer should
  // keep counting during pause") — state.level.elapsed (what the autosave
  // timer used to compare against) is real SIM time, which freezes solid the
  // instant state.ui.paused is true, same as everything else gated behind
  // the pause check below. state.level.wallClockMs is a second, dedicated
  // clock that instead just adds real dtMs every tick unconditionally,
  // whether paused or not — advanced here, ahead of that gate, specifically
  // so this one timer keeps ticking through a pause. updateAutosave itself
  // now reads THIS clock instead of elapsed (see its own comment in
  // Systems.js) and is called from here alone, not from updateStoryTriggers
  // any more, so it's reachable no matter what state the game's in.
  state.level.wallClockMs += dtMs;
  if (!state.level.gameOver) updateAutosave(state);
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
  // Per direct request ("deleting a chest spawns all contents... even
  // paused" / "any building holding/processing an item, if deleted, spawns
  // item(s) even when paused") — the D-key delete gesture used to be
  // entirely unreachable while paused (this whole function returns at the
  // very next line whenever state.ui.paused is true), so there was no way to
  // demolish anything while the player had deliberately paused to plan a
  // layout. Moved up here, ahead of that gate, rather than duplicated —
  // still skipped once the game's genuinely over (gameOver), same as every
  // other pause-adjacent action.
  if (!state.level.gameOver) updateKeyDDelete();
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
      updateCamera(state.camera, input, canvas, dtMs, getUnlockedWorldH(state));
    }
    return;
  }

  updateCamera(state.camera, input, canvas, dtMs, getUnlockedWorldH(state));
  updateBuildDrag();
  // updateKeyDDelete() now runs earlier, ahead of the pause gate above — see
  // that call site's own comment for why.
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
  perfMark('u: ambience, camera, input');
  if (!state.ui.timePaused) updateEntities(state, dtMs);
  perfMark('u: updateEntities tail');
  if (!state.ui.timePaused) updateBuildingBubbles(dtMs);
  updateFishDrag();
  updateFishInfoModalFreeze();
  updateItemDrag();
  updateChestAimDrag();
  updateRecipeDrag();
  updatePlatformFilterDrag();
  updateBuildingMove();
  updateGroupMoveGate();
  if (!state.ui.timePaused) {
    updateStoryTriggers(state, dtMs);
    state.level.elapsed += dtMs;
    flushPendingNotifications(state);
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

  // Per direct report ("electricity continues to be consumed when time is
  // paused... batteries deplete and buildings show the out of electricity
  // visuals"): this once-a-second sample is the ONLY place demand/supply, the
  // battery's charge/draw, powerEfficiency (which drives every no-power visual
  // and intake gate), the power history (HUD/graph) and the deficit/surplus
  // streaks are computed — and it's fed by dtMs, not by anything Pause Time
  // gates. Not advancing it while time is paused skips the whole calculation:
  // everything it writes simply stays frozen at its pre-pause value (so buildings
  // can be placed that overload the grid and nothing shows it until unpaused).
  if (!state.ui.timePaused) powerSampleAccumMs += dtMs;
  if (!state.ui.timePaused && powerSampleAccumMs >= 1000) {
    powerSampleAccumMs -= 1000;
    // Turret demand is tracked as its own running accumulator, not included
    // in computeCurrentPowerDemand's own snapshot — see that function's own
    // comment for why a once-a-second instantaneous check can't reliably
    // catch a single-tick firing pulse the way it can a sustained state like
    // a Fan/Processor/Refinery/Manufacturer's.
    const demand = computeCurrentPowerDemand(state) + state.level.turretPowerDemandAccumMw;
    const rawSupply = state.level.powerGenAccumMw; // whatever Eels/Blimp-Batteries generated during the window that just closed — see Levels.js's powerGenAccumMw
    // Battery fish — per direct spec ("power will need to be
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
// Per direct request, lighter water color — increased RGB values to brighten the gradient.
const WATER_TOP_CLEAN = { r: 100, g: 160, b: 200 };
const WATER_BOTTOM_CLEAN = { r: 70, g: 130, b: 170 };
function waterBackgroundGradient(ctx, canvasHeight) {
  const top = `rgb(${WATER_TOP_CLEAN.r}, ${WATER_TOP_CLEAN.g}, ${WATER_TOP_CLEAN.b})`;
  const bottom = `rgb(${WATER_BOTTOM_CLEAN.r}, ${WATER_BOTTOM_CLEAN.g}, ${WATER_BOTTOM_CLEAN.b})`;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  return gradient;
}

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

// ---- Fish/alien shadows, masked to seafloor decorations ----
// Per direct request ("the fish shadows should only show up on the seabed
// decoration... reverse mask it so that only the seafloor decorations
// (boulders, seaweed, sand castles, etc) show the fish shadows"): a fish's
// drop shadow used to be drawn straight onto whatever was behind it, which
// floated a dark smudge over plain water. Now every fish/alien's shadow is
// drawn into its own layer, that layer is cut down (destination-in) to the
// alpha of a freshly-drawn mask of just the seafloor decorations (Ambience's
// decor jobs plus the Mound/Science Lab), and only then composited over the
// scene — so a shadow exists only where a decoration is behind the body.
// Both layers run at SHADOW_MASK_SCALE of the screen resolution: the shadows
// are soft blobs, so half-res is invisible and keeps this cheap. Skipped
// entirely on frames with no fish/alien on screen.
const SHADOW_MASK_SCALE = 0.5;
const SHADOW_MASK_REFRESH_FRAMES = 4;
let shadowMaskKey = null;
let shadowMaskAge = 0;
const decorMaskCanvas = document.createElement('canvas');
const decorMaskCtx = decorMaskCanvas.getContext('2d');
const shadowLayerCanvas = document.createElement('canvas');
const shadowLayerCtx = shadowLayerCanvas.getContext('2d');
function drawAlienShadow(ctx, x, y, radius, bodyWidthMul, bodyHeightMul) {
  const bodyRx = radius * 1.05 * bodyWidthMul;
  const bodyRy = radius * 0.85 * bodyHeightMul;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x + bodyRx * 0.06, y + bodyRy * 0.45, bodyRx * 1.02, bodyRy * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
}
function renderFishShadowsOnDecor(ctx, state) {
  const casters = [];
  for (const e of state.level.entities) {
    if (e.type !== 'fish' && !(e.type === 'alien' && e.hp > 0) && e.type !== 'friendly_alien') continue;
    const pos = worldToScreen(e.x, e.y, state.camera);
    if (pos.x < -60 || pos.x > canvas.width + 60 || pos.y < -60 || pos.y > canvas.height + 60) continue;
    casters.push({ e, pos });
  }
  if (!casters.length) return;
  const w = Math.max(1, Math.ceil(canvas.width * SHADOW_MASK_SCALE));
  const h = Math.max(1, Math.ceil(canvas.height * SHADOW_MASK_SCALE));
  if (decorMaskCanvas.width !== w || decorMaskCanvas.height !== h) {
    decorMaskCanvas.width = w; decorMaskCanvas.height = h;
    shadowLayerCanvas.width = w; shadowLayerCanvas.height = h;
  }
  // Performance: the mask (every decoration redrawn) was the single most
  // expensive part of this pass, but decorations barely move (slow sway, the
  // odd crab), so it's only refreshed every SHADOW_MASK_REFRESH_FRAMES frames —
  // or immediately if the camera/canvas changed — while the shadows
  // themselves, which follow fast-moving fish, are redrawn and re-clipped every
  // frame against whichever mask is current.
  const cam = state.camera;
  const maskKey = w + ',' + h + ',' + cam.x + ',' + cam.y + ',' + cam.zoom + ',' + state.level.tier;
  if (maskKey !== shadowMaskKey || shadowMaskAge >= SHADOW_MASK_REFRESH_FRAMES) {
    decorMaskCtx.setTransform(1, 0, 0, 1, 0, 0);
    decorMaskCtx.clearRect(0, 0, w, h);
    decorMaskCtx.setTransform(SHADOW_MASK_SCALE, 0, 0, SHADOW_MASK_SCALE, 0, 0);
    renderDecorMask(decorMaskCtx, state, canvas.width, canvas.height);
    renderMoundMask(decorMaskCtx, state);
    shadowMaskKey = maskKey;
    shadowMaskAge = 0;
  }
  shadowMaskAge++;

  shadowLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
  shadowLayerCtx.clearRect(0, 0, w, h);
  shadowLayerCtx.setTransform(SHADOW_MASK_SCALE, 0, 0, SHADOW_MASK_SCALE, 0, 0);
  for (const { e, pos } of casters) {
    if (e.type === 'fish') {
      drawFishShadow(shadowLayerCtx, pos.x, pos.y, e.speciesId, e.stage, e.starTier || 1);
    } else {
      const baseRadius = (e.radius ?? ALIEN_RADIUS) * state.camera.zoom;
      const flashFrac = e.hitFlashMs / ALIEN_HIT_FLASH_MS;
      const bounce = e.hitFlashMs > 0 ? 1 + ALIEN_HIT_BOUNCE_SCALE * Math.sin((1 - flashFrac) * Math.PI) : 1;
      drawAlienShadow(shadowLayerCtx, pos.x, pos.y, baseRadius * bounce, e.bodyWidthMul, e.bodyHeightMul);
    }
  }
  shadowLayerCtx.setTransform(1, 0, 0, 1, 0, 0);
  shadowLayerCtx.globalCompositeOperation = 'destination-in';
  shadowLayerCtx.drawImage(decorMaskCanvas, 0, 0);
  shadowLayerCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(shadowLayerCanvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

// ---- Smooth turn-around (fish, aliens) ----
// Per direct request, a fish/alien that changes direction no longer snaps its
// sprite left/right — it squashes through edge-on and out the other side, the
// same turn the title screen's fish use. Deliberately NOT a new sprite: the
// existing drawFish/drawAlienBody output is just drawn through one ctx.scale
// while an entity is mid-turn (about 0.3s of its life), and an entity that
// isn't turning takes the exact same unscaled path as before, so the steady
// state costs one number compare. entity.turn eases toward entity.turnTarget
// (±1); the target only flips once |vx| clears TURN_VX_DEADZONE, so a fish
// hovering around vx = 0 can't flicker its target and sit edge-on forever.
const TURN_EASE_PER_S = 7;
const TURN_MIN_WIDTH = 0.12; // applied only when drawing; the stored value itself passes freely through zero
const TURN_VX_DEADZONE = 2;
let turnDtS = 0;
let turnLastNow = 0;
function beginTurnFrame(nowMs) {
  turnDtS = turnLastNow ? Math.min(0.05, (nowMs - turnLastNow) / 1000) : 0;
  turnLastNow = nowMs;
}
// Returns entity.turn after easing it one frame toward the way `vx` points.
function easeTurn(e) {
  if (e.turnTarget === undefined) { e.turnTarget = e.vx >= 0 ? 1 : -1; e.turn = e.turnTarget; }
  if (e.vx > TURN_VX_DEADZONE) e.turnTarget = 1;
  else if (e.vx < -TURN_VX_DEADZONE) e.turnTarget = -1;
  if (e.turn !== e.turnTarget) {
    e.turn += (e.turnTarget - e.turn) * Math.min(1, TURN_EASE_PER_S * turnDtS);
    if (Math.abs(e.turnTarget - e.turn) < 0.01) e.turn = e.turnTarget;
  }
  return e.turn;
}
// Opens the horizontal squash about (x, y); caller must ctx.restore() after.
function beginTurnSquash(ctx, x, y, turn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.abs(turn) < TURN_MIN_WIDTH ? (turn < 0 ? -TURN_MIN_WIDTH : TURN_MIN_WIDTH) : turn, 1);
  ctx.translate(-x, -y);
}

// A lit/rimmed/grained look for aliens, per direct request (same retweak as
// the boulders/mound/seaweed, and — unlike the regular fish — WITH the
// speckled grain). `color` is hex or the "rgb(...)" a hit-flash blend
// produces (see lerpRgbToString), so toneColor parses either; the grain's
// positions come from a tiny seeded PRNG keyed to the alien's own id so they
// stay put frame to frame (a fresh Math.random() per frame would shimmer).
// Duplicated from FishRenderer.js's own tone helper rather than imported —
// same "each module keeps its own small renderers" convention as the item icons.
function toneColor(color, t) {
  const rgb = color[0] === '#' ? hexToRgb(color) : (() => { const m = color.match(/\d+/g); return { r: +m[0], g: +m[1], b: +m[2] }; })();
  const target = t >= 0 ? 255 : 0;
  const a = Math.abs(t);
  return `rgb(${Math.round(rgb.r + (target - rgb.r) * a)}, ${Math.round(rgb.g + (target - rgb.g) * a)}, ${Math.round(rgb.b + (target - rgb.b) * a)})`;
}
function seededRandom(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// An alien's body — reworked per direct request ("rework the alien fish so
// they are not flat, and so they match the same style of the fish") from a
// single flat circle into an oval body + trailing tail fin + dorsal spikes,
// then again ("lit, rimmed, grained, contact-shadow") into the same shading
// the boulders use. `color` is whatever the caller already resolved (including
// the hit-flash blend), `facing` is ±1 (which way the alien is currently
// moving), used to trail the tail fin and highlight the same direction a
// fish's own facing would. `gazeAngle` (radians, world-space atan2 toward the
// nearest fish — see the render loop below) drives the single cyclops eye's
// pupil, per direct request ("one eye like a cyclops... with a pupil that
// looks at the closest fish"). `seed` (the alien's id) fixes its grain.
function drawAlienBody(ctx, x, y, radius, facing, color, gazeAngle, spikes = 3, bodyWidthMul = 1, bodyHeightMul = 1, glow = false, glowHex = null, seed = 0, friendly = false) {
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

  const rimColor = toneColor(color, -0.55);
  const rimWidth = Math.max(1, radius * 0.09);

  // (The alien's drop shadow is drawn by renderFishShadowsOnDecor's separate,
  // decoration-masked pass — see drawAlienShadow below — not here.)

  // Tail fin, trailing behind the direction of travel.
  ctx.fillStyle = toneColor(color, -0.28);
  ctx.beginPath();
  ctx.moveTo(x - facing * bodyRx * 1.1, y);
  ctx.lineTo(x - facing * bodyRx * 0.52, y - bodyRy * 0.6);
  ctx.lineTo(x - facing * bodyRx * 0.52, y + bodyRy * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = rimWidth * 0.8;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dorsal spikes along the top, one per tier (see ALIEN_ARCHETYPES'
  // `spikes` field) — the one purely "alien/sea-monster" flourish, keeping
  // it visually distinct from an ordinary fish silhouette despite sharing
  // the same shading language, and now itself a visible tier marker. Drawn
  // before the body so its own fill/rim tucks over their bases.
  ctx.fillStyle = toneColor(color, -0.28);
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
    ctx.stroke();
  }

  // Main body — an oval, not a perfect circle, lit from the upper-left.
  // bodyWidthMul/bodyHeightMul (per-tier, see ALIEN_ARCHETYPES) stretch/squash
  // this beyond the base ratio so each tier reads as a genuinely different
  // silhouette, not just a resized copy of the same shape.
  const bodyGrad = ctx.createRadialGradient(x - facing * bodyRx * 0.25, y - bodyRy * 0.45, bodyRx * 0.08, x, y, bodyRx * 1.15);
  bodyGrad.addColorStop(0, toneColor(color, 0.24));
  bodyGrad.addColorStop(1, toneColor(color, -0.22));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Speckled grain, clipped to the body, same light/dark dot mix as drawBoulder.
  ctx.save();
  ctx.clip();
  const rng = seededRandom(seed + 1);
  const grains = Math.max(6, Math.round(radius * 0.9));
  for (let i = 0; i < grains; i++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + (rng() * 2 - 1) * bodyRx, y + (rng() * 2 - 1) * bodyRy, Math.max(0.6, radius * (0.03 + rng() * 0.05)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.beginPath();
  ctx.ellipse(x - facing * bodyRx * 0.27, y - bodyRy * 0.41, bodyRx * 0.3, bodyRy * 0.21, -0.3 * facing, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = rimColor;
  ctx.lineWidth = rimWidth;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyRx, bodyRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Friendly (Alien-Egg-hatched) variant, per direct request — a smile and
  // rosy cheeks under the eye below, plus a pair of bobble antennae in place
  // of the dorsal spikes it's passed 0 of. Everything else (body, shading,
  // tail, cyclops eye) is shared with the hostile look on purpose, so it
  // reads as "a Tier 1, but nice."
  if (friendly) {
    ctx.strokeStyle = rimColor;
    ctx.fillStyle = toneColor(color, -0.1);
    ctx.lineWidth = rimWidth * 0.7;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const ax = x + side * bodyRx * 0.4;
      const ay = y - bodyRy * 1.0;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + side * radius * 0.1, ay - radius * 0.35, ax + side * radius * 0.28, ay - radius * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ax + side * radius * 0.28, ay - radius * 0.5, radius * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 130, 150, 0.45)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * bodyRx * 0.55, y + bodyRy * 0.2, radius * 0.16, radius * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = rimWidth * 0.8;
    ctx.beginPath();
    ctx.arc(x, y + bodyRy * 0.12, radius * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // A single cyclops eye, centered where the two separate eyes used to sit
  // and bigger than either of them was — per direct request. A dark pupil
  // sits inside it, offset toward gazeAngle (the nearest fish, computed by
  // the caller) so it visibly tracks whatever's closest, clamped well
  // inside the eye's own edge so it never pokes out of the socket.
  const eyeX = x;
  const eyeY = y - radius * 0.15;
  const eyeRadius = radius * 0.34;
  ctx.fillStyle = friendly ? '#fffdf2' : '#ff5b5b';
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
// Per direct request, the main menu uses the same shell cursor as the game —
// exposed as a CSS variable so style.css's #start-overlay can pick it up
// without duplicating the glyph/hotspot tuning above.
document.documentElement.style.setProperty('--shell-cursor', CURSOR_BY_TOOL.cursor);
let lastCursorTool = null;
function updateCanvasCursor() {
  // The Storage Chest aim-drag (updateChestAimDrag, above — either the
  // left-drag trickle-arm or the right-drag clear) owns the cursor directly
  // while it's active, rotating/stretching/coloring it live to match the
  // drag's own angle/distance — this function's normal tool-based lookup
  // would otherwise immediately stomp that back to the plain cursor/food
  // glyph the very next frame, since lastCursorTool has no way to know
  // about the override.
  if (chestAimDragKey != null) return;
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

// ---- Sea Turtle ambience convoy ----
// See Config.js's "Sea Turtle" section for the full rationale. Every field
// here is plain WORLD space, exactly like a fish or any other creature — per
// direct follow-up request ("the turtles should have a fixed position in
// the world, they should not scroll down with me if I scroll down... they
// should be rendered within the world like everything else"), reverting an
// earlier screen-space-pinned design. The convoy sits at a fixed WORLD y
// (SEA_TURTLE_WORLD_Y, near the very top of the tank) — scroll down and it
// scrolls up out of view exactly like a shallow-swimming fish would, rather
// than staying glued under the chat pill regardless of camera position. Its
// coin (a real state.level.items entry) needs no conversion any more since
// both it and the turtle now live in the same coordinate space.
//
// Driven entirely by REAL wall-clock ms, read fresh every render() call
// (which itself always runs once per real rAF frame no matter what
// Pause Time/2x Speed/the debug time-scale cheat are doing to update()'s own
// dtMs — see Engine.js's createGameLoop) rather than any dtMs this file
// already has lying around, per direct spec that none of those three should
// ever touch the turtle's timer, travel speed, or bob animation. A huge real
// gap (e.g. a backgrounded tab) is clamped the same way createGameLoop
// clamps its own frameTime, so it can't teleport the convoy across the
// screen or instantly expire a long spawn cooldown.
let lastSeaTurtleRealMs = null;
const SEA_TURTLE_STALL_CLAMP_MS = 250;

// index 0 = the lead turtle, 1..babyCount = trailing kids. A baby's x lags
// the leader by a flat WORLD-space offset, and its bob phase is delayed by
// exactly the time it'd take to cover that same offset at cruise speed — the
// two together mean a baby always shows the EXACT y the leader itself had
// when it was at that same x, i.e. a baby genuinely retraces the leader's
// own path instead of just approximating it, which is what makes the whole
// convoy read as "following," not just "in formation." Returns plain WORLD
// coordinates — callers convert via worldToScreen/screenToWorld exactly like
// every other world-space entity in the game.
function seaTurtleMemberPosition(turtle, index) {
  const spacing = index * SEA_TURTLE_BABY_SPACING_PX;
  const leaderX = turtle.startWorldX + (turtle.elapsedMs / 1000) * SEA_TURTLE_SPEED_PX_PER_S;
  const x = leaderX - spacing;
  const delayS = spacing / SEA_TURTLE_SPEED_PX_PER_S;
  const bobAngle = ((turtle.elapsedMs / 1000 - delayS) / (SEA_TURTLE_BOB_PERIOD_MS / 1000)) * Math.PI * 2;
  const y = SEA_TURTLE_WORLD_Y + Math.sin(bobAngle) * SEA_TURTLE_BOB_AMPLITUDE_PX;
  return { x, y, bobAngle };
}

// Progressively smaller "kids" — 1st baby is the biggest, last is the
// smallest, per direct spec ("progressively smaller... so small to smaller
// compared to the big turtle").
function seaTurtleMemberScale(index, babyCount) {
  if (index === 0) return 1;
  if (babyCount <= 1) return SEA_TURTLE_BABY_MAX_SCALE;
  const t = (index - 1) / (babyCount - 1);
  return SEA_TURTLE_BABY_MAX_SCALE - t * (SEA_TURTLE_BABY_MAX_SCALE - SEA_TURTLE_BABY_MIN_SCALE);
}

function spawnSeaTurtle(state) {
  const babyCount = SEA_TURTLE_BABY_MIN_COUNT + Math.floor(Math.random() * (SEA_TURTLE_BABY_MAX_COUNT - SEA_TURTLE_BABY_MIN_COUNT + 1));
  // Far enough left that the ENTIRE convoy (leader plus every trailing baby)
  // starts fully off the left edge of the CURRENT viewport, not just the
  // leader — screenToWorld's own -150 screen-px margin (comfortably
  // off-screen regardless of zoom, since camera.x is always 0) is the
  // leader's OWN starting point; every trailing baby then needs that same
  // margin again on top of its own spacing lag, or it'd still be
  // (partially) on-screen the instant the leader itself first appears.
  const offscreenLeftWorldX = screenToWorld(-150, 0, state.camera).x;
  const startWorldX = offscreenLeftWorldX - babyCount * SEA_TURTLE_BABY_SPACING_PX;
  const turtle = { startWorldX, elapsedMs: 0, babyCount, coinItemId: null, bubbleTimerMs: 0 };
  // Per direct request — $50 base, plus $50 for every sea-turtle coin ever
  // collected THIS level so far (Config.js's own comment has the full
  // worked example). Every other coin in the game is untouched by this.
  const coinValue = SEA_TURTLE_COIN_BASE_VALUE + SEA_TURTLE_COIN_VALUE_PER_COLLECT * (state.level.seaTurtleCoinCollectCount || 0);
  const leadPos = seaTurtleMemberPosition(turtle, 0);
  const coin = createCoin(leadPos.x, leadPos.y - SEA_TURTLE_RADIUS_PX * 0.55, coinValue);
  coin.seaTurtleAttached = true; // exempts it from gravity in Entities.js's updateCoin — this function's own per-frame follow below is what actually moves it
  coin.vx = 0;
  coin.vy = 0;
  state.level.items.push(coin);
  turtle.coinItemId = coin.id;
  state.level.seaTurtle = turtle;
}

function updateSeaTurtle(state, nowMs) {
  if (lastSeaTurtleRealMs == null) { lastSeaTurtleRealMs = nowMs; return; } // first-ever call — nothing to diff against yet
  let realDtMs = nowMs - lastSeaTurtleRealMs;
  lastSeaTurtleRealMs = nowMs;
  if (realDtMs < 0) realDtMs = 0;
  if (realDtMs > SEA_TURTLE_STALL_CLAMP_MS) realDtMs = SEA_TURTLE_STALL_CLAMP_MS;

  // A guided tutorial flow freezes almost everything else in the game too
  // (see update()'s own big comment block on state.level.tutorialFlow) — per
  // direct follow-up request, the turtle (and its cooldown/bubble timers)
  // now freezes right along with it. The Escape pause MENU (state.ui.paused)
  // does the same, per a later direct request ("if the pause menu is open,
  // pause the sea turtles and the sea turtle timer") — both are still
  // staying completely immune to Pause Time/2x Speed/the debug time-scale
  // cheat, which are a SEPARATE, player-driven kind of "pause" this was
  // always meant to ignore (see this function's own header comment).
  // Simply not advancing lastSeaTurtleRealMs any further than it already
  // was above would double-count the frozen span as real elapsed time the
  // moment either one ends — updating it every call (already done above)
  // and just bailing out here avoids that.
  if (state.level.tutorialFlow || state.ui.paused) return;

  const turtle = state.level.seaTurtle;
  if (!turtle) {
    state.level.seaTurtleCooldownMs -= realDtMs;
    if (state.level.seaTurtleCooldownMs <= 0) spawnSeaTurtle(state);
    return;
  }

  turtle.elapsedMs += realDtMs;

  // Keep the still-attached coin glued to the lead turtle's back — skipped
  // while the player is actively dragging it away (see the mouseUpHandlers
  // above for how a genuine drag permanently clears coinItemId so this
  // doesn't just snap it straight back the following frame).
  if (turtle.coinItemId != null && draggedItemId !== turtle.coinItemId) {
    const coin = state.level.items.find((it) => it.id === turtle.coinItemId);
    if (!coin) {
      turtle.coinItemId = null; // banked (or otherwise removed) elsewhere this tick
    } else {
      const leadPos = seaTurtleMemberPosition(turtle, 0);
      coin.x = leadPos.x;
      coin.y = leadPos.y - SEA_TURTLE_RADIUS_PX * 0.55;
      coin.rollPrevX = coin.x; // riding the turtle's back isn't rolling — see Entities.js's updateItemRoll
    }
  }

  // A trailing bubble off the very back of the convoy — per direct request
  // ("I like the bubbles the way they were before"), reverted back to the
  // original single-emitter shape (only the last/smallest member), off the
  // shared Ambience.js cursorBubbles pool, timed off this same real clock so
  // the trail's own rate is just as pause/speed-immune as the turtle itself.
  turtle.bubbleTimerMs -= realDtMs;
  if (turtle.bubbleTimerMs <= 0) {
    turtle.bubbleTimerMs += SEA_TURTLE_BUBBLE_INTERVAL_MS;
    const tailPos = seaTurtleMemberPosition(turtle, turtle.babyCount);
    spawnSeaTurtleBubble(tailPos.x, tailPos.y);
  }

  // Done once the LAST (furthest-back) member has cleared the right edge of
  // the CURRENT viewport — per direct spec, the next cooldown doesn't start
  // until the whole convoy (coin collected or not) is off-screen. Checked in
  // SCREEN space (worldToScreen) rather than a flat world-unit threshold
  // since "off the right edge" is inherently a viewport-relative idea — a
  // world-space convoy at a fixed zoom would otherwise take a wildly
  // different amount of real time to "exit" depending on how zoomed in the
  // player happens to be.
  const tailPos = seaTurtleMemberPosition(turtle, turtle.babyCount);
  const tailScreenX = worldToScreen(tailPos.x, tailPos.y, state.camera).x;
  if (tailScreenX >= canvas.width + SEA_TURTLE_RADIUS_PX * state.camera.zoom + 20) {
    // An uncollected coin leaves WITH the turtle rather than being abandoned
    // mid-air off-screen with gravity suddenly switched back on for it.
    if (turtle.coinItemId != null) {
      state.level.items = state.level.items.filter((it) => it.id !== turtle.coinItemId);
    }
    state.level.seaTurtle = null;
    state.level.seaTurtleCooldownMs = SEA_TURTLE_SPAWN_MIN_MS + Math.random() * (SEA_TURTLE_SPAWN_MAX_MS - SEA_TURTLE_SPAWN_MIN_MS);
  }
}

// The soft trailing "current" wake behind one convoy member — deliberately
// its OWN function, drawn in its OWN full pass across every member BEFORE
// any shell (see renderSeaTurtle below), not nested inside
// drawOneSeaTurtleMember's own save/translate block the way it used to be.
// A member's wake trails backward into the space the NEXT (smaller, further
// back) member occupies — drawing it as part of that same member's own
// paint call meant a later-drawn member (the leader, drawn last so it
// overlaps its own kids) had its wake painted OVER an earlier-drawn member's
// shell, per direct report ("the first turtle's stream animation is in
// front of the second turtle"). Segment count/length/height are all bigger
// than the original per a direct follow-up ("too skinny, looks like the
// turtles are pooping the streams out... make the streams taller"). The
// first segment (i=0, t=0) starts at SEA_TURTLE_WAKE_START_FRACTION shell-
// radii out — per a further follow-up, that's tuned so the shell (painted
// right after this whole pass) covers almost exactly the near half of it,
// so it reads as "emerging from under the shell" rather than starting
// clear of it. Takes x/y/r already converted to SCREEN space/pixels (see
// renderSeaTurtle) — same worldToScreen-then-draw convention every other
// world-space creature in this game follows.
function drawSeaTurtleWake(ctx, x, y, r, waterCurrentPhase) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < SEA_TURTLE_WAKE_SEGMENT_COUNT; i++) {
    const t = i / (SEA_TURTLE_WAKE_SEGMENT_COUNT - 1);
    const alpha = SEA_TURTLE_WAKE_MAX_ALPHA * (1 - t);
    if (alpha <= 0) continue;
    const dist = r * (SEA_TURTLE_WAKE_START_FRACTION + t * SEA_TURTLE_WAKE_LENGTH_MULTIPLIER);
    const wobbleY = Math.sin(waterCurrentPhase + i * 0.8) * SEA_TURTLE_WAKE_WOBBLE_PX;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(-dist, wobbleY, r * (0.55 - t * 0.15), r * SEA_TURTLE_WAKE_HEIGHT_FACTOR * (1 - t * 0.25), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// One turtle-shaped shell+head+flippers. x/y/r are already SCREEN space/
// pixels (converted by renderSeaTurtle via worldToScreen, same as every
// other world-space creature in this game) — facingRight is always true
// (the whole convoy only ever swims left to right, per spec).
function drawOneSeaTurtleMember(ctx, x, y, r, bobAngle) {
  const flipperSwing = Math.sin(bobAngle * 1.6) * 0.5;
  ctx.save();
  ctx.translate(x, y);

  // Rear flippers
  ctx.fillStyle = SEA_TURTLE_COLOR_SKIN;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-r * 0.45, side * r * 0.62);
    ctx.rotate(side * (0.5 + flipperSwing * side));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.42, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Front flippers (swing opposite the rear pair, like a real swim stroke)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(r * 0.35, side * r * 0.68);
    ctx.rotate(side * (0.35 - flipperSwing * side));
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.5, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Head + neck (leading edge — the convoy always swims left to right)
  ctx.fillStyle = SEA_TURTLE_COLOR_SKIN;
  ctx.beginPath();
  ctx.ellipse(r * 0.95, 0, r * 0.3, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 1.22, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.arc(r * 1.28, -r * 0.06, r * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // Shell
  ctx.fillStyle = SEA_TURTLE_COLOR_SHELL;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SEA_TURTLE_COLOR_SHELL_PATTERN;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.68, r * 0.46, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.34, -r * 0.5);
    ctx.lineTo(i * r * 0.5, r * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function renderSeaTurtle(ctx, state, canvasWidth, canvasHeight) {
  const turtle = state.level.seaTurtle;
  if (!turtle) return;
  const waterCurrentPhase = turtle.elapsedMs / 260;
  const zoom = state.camera.zoom;
  const visibleMembers = [];
  for (let i = turtle.babyCount; i >= 0; i--) {
    // Tail-first order, same front-to-back layering a real convoy swimming
    // in a line would have — kept for the shell pass below (so the leader
    // still overlaps its own trailing kids); the wake pass ahead of it
    // doesn't actually depend on this order (see drawSeaTurtleWake's own
    // comment on why it's a fully separate pass now). worldPos is plain
    // WORLD space (seaTurtleMemberPosition's own return) — converted to a
    // real screen position/radius here via worldToScreen, exactly like
    // every other world-space creature this game renders, per direct
    // request ("rendered within the world like everything else").
    const worldPos = seaTurtleMemberPosition(turtle, i);
    const screen = worldToScreen(worldPos.x, worldPos.y, state.camera);
    const scale = seaTurtleMemberScale(i, turtle.babyCount);
    const r = SEA_TURTLE_RADIUS_PX * scale * zoom;
    if (screen.x < -r * 3 || screen.x > canvasWidth + r * 3 || screen.y < -r * 3 || screen.y > canvasHeight + r * 3) continue;
    visibleMembers.push({ x: screen.x, y: screen.y, r, bobAngle: worldPos.bobAngle, i });
  }
  for (const m of visibleMembers) drawSeaTurtleWake(ctx, m.x, m.y, m.r, waterCurrentPhase + m.i * 0.7);
  for (const m of visibleMembers) drawOneSeaTurtleMember(ctx, m.x, m.y, m.r, m.bobAngle);
}

// Applies the Settings "Guided Tutorial" toggle (Save.js) to whichever flow
// just started, and tells Save.js when a flow starts/ends so it can track
// which tutorials the player has now encountered. Run from render() rather
// than update() so a flow that a setTimeout/click handler/Systems.js trigger
// set since the last frame is cleared before updateHUD ever draws its
// overlay — update() alone would let it flash for a frame. A disabled flow
// is cleared exactly like the Escape-to-skip handler does. Toggling the
// setting off mid-flow ends the running one the same way.
let lastTutorialFlow = null;
function applyGuidedTutorialPreference(state) {
  let flow = state.level.tutorialFlow;
  if (flow && !isGuidedTutorialsEnabled()) {
    state.level.tutorialFlow = null;
    state.level.wasteDragTutorialTargetId = null;
    state.level.mergeTutorialTargetIds = null;
    flow = null;
  }
  if (flow === lastTutorialFlow) return;
  const ended = lastTutorialFlow;
  lastTutorialFlow = flow;
  if (flow) noteTutorialFlowStarted(flow.id);
  else if (ended) noteTutorialFlowEnded();
}

let lastFloatingTextAt = performance.now();
function render() {
  applyGuidedTutorialPreference(state);
  if (state.ui.replayStartTutorialPending) {
    state.ui.replayStartTutorialPending = false;
    startTutorialAfterDelay();
  }
  // Title screen (TitleScreen.js): drawn on its own canvas every frame it's up,
  // and once its half-resolution backdrop snapshot exists the whole game world
  // is skipped below — per direct request, so the title costs next to nothing.
  updateTitle(performance.now());
  if (titleBlocksWorldRender()) return;
  updateCanvasCursor();
  fpsCounter++;
  const now = performance.now();
  beginTurnFrame(now);
  if (now - lastFpsTime >= 1000) {
    fpsDisplay = fpsCounter;
    fpsCounter = 0;
    lastFpsTime = now;
  }

  // Real-wall-clock-driven, called every render() frame unconditionally —
  // see updateSeaTurtle's own header comment for why it deliberately can't
  // hook into update()'s dtMs the way everything else does. Gated on
  // gameStarted only, same "frozen (not even ticking) until Start is
  // clicked" precedent the rest of ambience already follows — NOT gated on
  // state.ui.paused/timePaused, per direct spec.
  if (state.ui.gameStarted) updateSeaTurtle(state, now);

  ctx.fillStyle = waterBackgroundGradient(ctx, canvas.height);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // The water's true top edge (world y=0) — a subtle wavy shimmer, per
  // direct request. Drawn before any ambience/scenery so tall kelp/seaweed
  // still layer over it, same as real plants breaking a water surface would.
  renderWaterSurface(ctx, state, canvas.width, canvas.height);

  // Shadow fish silhouettes, drawn before the blurred background parallax
  // decor layer — per direct request ("the background silhouette fish go
  // behind the duplicated background decorations"). See Ambience.js's own
  // header comment on renderShadowFish for why this is its own explicit
  // call now instead of folding into renderAmbienceBehindLab below.
  perfMark('r: water fill + surface', ctx);
  renderShadowFish(ctx, state, canvas.width, canvas.height);

  // A blurred, desaturated, raised-up duplicate of the floor decor — see
  // Ambience.js's own header comment on renderBackgroundParallaxDecor. Drawn
  // before every real ambience/decor layer so it reads as sitting further
  // back/behind them, giving the floor a sense of depth the same way the
  // water column already has via sun rays/caustics.
  perfMark('r: shadow-fish silhouettes', ctx);
  renderBackgroundParallaxDecor(ctx, state.camera, canvas.width, canvas.height);

  // Ambience (bubbles/seaweed/boulders/etc.) renders immediately after the
  // plain background fill and before anything else — per direct request, it
  // needs to sit behind the seabed/city and every building/item/fish drawn
  // later in this function, not just behind the fish/items the way it was
  // before. Split into two calls (this one, and renderAmbienceFrontLab
  // below) with renderScienceLab sandwiched between them — see Ambience.js's
  // header comment for why.
  perfMark('r: parallax background decor', ctx);
  renderAmbienceBehindLab(ctx, state, canvas.width, canvas.height);

  // ---- Step 1 done: background layer + background fish are on the main
  // canvas. Step 2: everything from here to the caustic composite below
  // (foreground decor, active fish, coins, soil bed, plus their cursor
  // ghosts/effects) draws into foregroundCanvas instead, via this module's
  // mutable `ctx` — every draw call below this line still just says `ctx.*`
  // or passes `ctx` as an argument, unchanged, but it now targets the
  // offscreen layer that the caustic video will be clipped to. Restored back
  // to mainCtx right after compositeCausticForeground() runs, further down.
  perfMark('r: ambience behind lab', ctx);
  foregroundCtx.clearRect(0, 0, canvas.width, canvas.height);
  ctx = foregroundCtx;

  // Per direct bug report ("after placing a fan, it renders a static cone
  // AND a cone that follows the cursor") — while a fan's angle is still
  // being confirmed (fanAimingCell armed), the fan is already sitting in
  // state.level.buildingData with its OLD angle, so renderFanIndicators
  // below would draw that fixed cone underneath the live-following
  // renderFanAimGhost cone drawn later this same frame. Written here (not
  // read directly from the module-local fanAimingCell) since Grid.js can't
  // import main.js — same state.ui cross-module signal pattern used
  // throughout this file.
  state.ui.fanAimingCell = fanAimingCell;
  // Science Lab (and, per direct follow-up request, the Mound too — the two
  // are mutually exclusive across the game's lifetime, tier < MOUND_MAX_TIER
  // vs. >=) moved up here, between the two ambience halves, per direct
  // request ("coral, urchins, and crabs can walk/spawn in front of the
  // science lab but seaweed and boulders can't"), later extended to the
  // Mound itself ("with coral and sea urchins that can go in front of it") —
  // renderAmbienceBehindLab above already covers the boulders/seaweed/kelp
  // half, so whichever of the two is currently showing draws on top of
  // those, then renderAmbienceFrontLab draws coral/urchins/crabs (and
  // bubbles) on top of it in turn. See Ambience.js's own header comment for
  // the full depth-layering scheme this participates in.
  renderMound(ctx, state);
  renderScienceLab(ctx, state);
  renderAmbienceFrontLab(ctx, state, canvas.width, canvas.height);
  perfMark('r: mound/lab + front ambience', ctx);
  renderSeabedGrid(ctx, state, canvas.width, canvas.height);

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
  // Ctrl + Click: Snap Placement's own live total — same "null unless a
  // branch below actually sets it" pattern, read by UI.js's updateHUD for
  // the cost legend (see its own comment for why it takes priority over
  // buildReplaceInfo whenever both would otherwise apply).
  state.ui.snapLineCost = null;

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
    renderFanAimGhost(ctx, state, cellCenterX, cellCenterY, fanAimingCell.buildingId, angle);
  } else if (hoverEffectiveTool.startsWith('build:') && input.mouse.inside && !state.ui.paused) {
    const world = hoverWorld;
    const buildingId = hoverEffectiveTool.slice('build:'.length);
    const { col, row } = worldToTile(world.x, world.y);
    const angle = angleFromTileToPoint(col, row, world.x, world.y);
    const shiftHeld = isShiftHeld();
    // Ctrl + Click: Snap Placement — per direct request, a line of ghosts
    // from state.ui.lastPlacedTileCol/Row (see its own comment for where
    // that gets set — a real placement, a drag-placed tile, or a pipetted
    // one) out to the cursor's tile, snapped to the nearest of the 8 compass
    // directions. Fans are excluded (angle isn't shown for showCone:false
    // ghosts below anyway, but more fundamentally they never take this path
    // for real either — see placeSnapLineTiles' own comment) so a
    // Fan-tool hover always falls through to the single-ghost branch below.
    // Moved off Shift onto Ctrl per direct request (see updateBuildDrag's own
    // matching comment) — shiftHeld above is still read by the Replace ghost
    // preview further down, unaffected by this.
    const snapEligible = isCtrlHeld() && state.ui.lastPlacedTileCol != null && !FAN_BUILDING_IDS.includes(buildingId);
    const snap = snapEligible ? computeSnapLine(state, state.ui.lastPlacedTileCol, state.ui.lastPlacedTileRow, col, row, buildingId) : null;
    if (snap && snap.tiles.length > 0) {
      for (const t of snap.tiles) {
        const screen = worldToScreen(t.col * TILE_SIZE, t.row * TILE_SIZE, state.camera);
        const size = TILE_SIZE * state.camera.zoom;
        // Deliberately a plain fillRect for every building type, including
        // Half Platforms (whose real placed shape — and single-ghost preview
        // above — is a triangular wedge, not a full square, see
        // renderBuildGhost's own RAMP_TRIANGLE_LOCAL_VERTS branch) — a minor,
        // deliberate simplification for the line-ghost specifically, not
        // worth duplicating that shape logic for every tile of a whole line.
        // Tint matches the single-tile ghost's own convention (renderBuildGhost):
        // blue for a tile that'll be replaced, green for a fresh empty one,
        // red if the whole line (all-or-nothing, see computeSnapLine's own
        // comment) isn't currently affordable — never per-tile partial.
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = !t.affordable ? '#ff6b6b' : (t.occupied && !t.freeSwap ? '#5ab0ff' : '#8fe0b8');
        ctx.fillRect(screen.x, screen.y, size, size);
        ctx.globalAlpha = 1;
      }
      state.ui.snapLineCost = snap.netCost;
    } else {
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
    }
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

  // Group move: the selection box while dragging, then the carried group as a
  // multi-cell ghost (green = fits, blue = replaces with Shift, red = blocked).
  if (groupMoveDragStart && !input.mouseDown) { groupMoveDragStart = null; closeProductionInfoModal(); } // a missed release
  if (groupMoveDragStart) {
    const curWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const cur = worldToTile(curWorld.x, curWorld.y);
    const a = worldToScreen(Math.min(groupMoveDragStart.col, cur.col) * TILE_SIZE, Math.min(groupMoveDragStart.row, cur.row) * TILE_SIZE, state.camera);
    const b = worldToScreen((Math.max(groupMoveDragStart.col, cur.col) + 1) * TILE_SIZE, (Math.max(groupMoveDragStart.row, cur.row) + 1) * TILE_SIZE, state.camera);
    ctx.save();
    ctx.strokeStyle = '#ffb84d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.fillStyle = 'rgba(255, 184, 77, 0.12)';
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.restore();
    // The info card beside the box: how many of each building type it holds.
    const counts = new Map();
    for (let r = Math.min(groupMoveDragStart.row, cur.row); r <= Math.max(groupMoveDragStart.row, cur.row); r++) {
      for (let c = Math.min(groupMoveDragStart.col, cur.col); c <= Math.max(groupMoveDragStart.col, cur.col); c++) {
        const type = getTile(state.level.grid, c, r);
        if (type && type !== TILE_EMPTY && BUILDING_TYPES[type]) counts.set(type, (counts.get(type) || 0) + 1);
      }
    }
    const rows = [...counts].map(([type, count]) => ({ name: BUILDING_TYPES[type].name, count })).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
    updateGroupMoveInfoModal(rows, { left: a.x, top: a.y, right: b.x, bottom: b.y });
  }
  if (groupMove != null && input.mouse.inside && !state.ui.paused) {
    const hoverWorld = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
    const { col: baseCol, row: baseRow } = worldToTile(hoverWorld.x, hoverWorld.y);
    renderGroupMoveGhost(ctx, state, baseCol, baseRow, groupMove.cells, isShiftHeld());
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
  // Production info selection box + modal — see the box-select block near the fish drag handlers.
  if (prodSelect) {
    if (!input.mouseDown || state.ui.paused || state.ui.selectedTool !== 'cursor') {
      prodSelect = null; // cancelled (a hotkey swapped the tool, the game paused, or the release was missed)
      closeProductionInfoModal();
    } else {
      const cur = screenToWorld(input.mouse.x, input.mouse.y, state.camera);
      const worldRect = { x0: Math.min(prodSelect.x0, cur.x), y0: Math.min(prodSelect.y0, cur.y), x1: Math.max(prodSelect.x0, cur.x), y1: Math.max(prodSelect.y0, cur.y) };
      const tl = worldToScreen(worldRect.x0, worldRect.y0, state.camera);
      const br = worldToScreen(worldRect.x1, worldRect.y1, state.camera);
      ctx.save();
      ctx.strokeStyle = '#5fd0ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.fillStyle = 'rgba(95, 208, 255, 0.12)';
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.restore();
      updateProductionInfoModal(state, worldRect, { left: tl.x, top: tl.y, right: br.x, bottom: br.y }, performance.now());
    }
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

  // Drawn just before the items loop below (not any earlier, ambience-style
  // layer) so the coin riding its back — a completely normal state.level.items
  // entry — draws on TOP of it in that very next loop, reading as sitting on
  // the shell rather than floating in front of/behind the turtle. Its own
  // trailing bubbles render earlier still, as part of the shared Ambience.js
  // pool (renderAmbienceFrontLab, called well before this point) — see
  // Ambience.js's spawnSeaTurtleBubble.
  renderSeaTurtle(ctx, state, canvas.width, canvas.height);

  perfMark('r: seabed + buildings + ghosts', ctx);
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

    // A "stale" gray phase, per direct spec — once a Food pellet's own
    // stationary timer crosses FOOD_STALE_FRACTION (75%) of the way to
    // turning into Waste, tint it toward FOOD_STALE_COLOR. Reading straight
    // off the live timer (which Entities.js's updateFood already resets to 0
    // the instant the pellet genuinely moves) means "the color resets" the
    // moment it's dragged/nudged falls out for free, with no extra state.
    // Quantized to FOOD_STALE_STEPS pre-baked shades (see getItemSprite).
    let foodStaleStep = 0;
    if (item.type === 'food') {
      const rawFrac = (item.stationaryTimer || 0) / FOOD_STATIONARY_TO_WASTE_MS;
      const staleT = Math.max(0, Math.min(1, (rawFrac - FOOD_STALE_FRACTION) / (1 - FOOD_STALE_FRACTION)));
      foodStaleStep = Math.round(staleT * FOOD_STALE_STEPS);
    }
    const sprite = getItemSprite(item, foodStaleStep);
    // Idle spin — per direct request ("add a coin spinning animation if a
    // coin hasn't moved for more than 3 seconds"). Squashes the WHOLE coin/gem
    // horizontally around its own center — see coinSpinScaleX's own comment
    // for the full rationale (including the ease-back-to-normal settle phase)
    // and why this stays a free no-op the rest of the time.
    const spinScaleX = item.type === 'coin' ? coinSpinScaleX(item) : 1;
    // Rolling — per direct request ("make most of the objects roll"), see
    // Entities.js's updateItemRoll. The cached sprite is turned by
    // item.rollAngle about the item's own center (sprite.dy lowers the pivot
    // for Waste/Bio-Sludge, same offset they always had) with one
    // setTransform + drawImage (plus one reset), no per-item sprite rebuild.
    // An item that has never rolled keeps the plain axis-aligned blit. A
    // coin's idle-spin squash composes with the roll (squash applied to the
    // already-turned face, i.e. scale-then-rotate in matrix terms), so the two
    // never fight. Visual-only: nothing here touches item.x/y/radius or physics.
    const rollAngle = item.rollAngle || 0;
    const py = pos.y + sprite.dy;
    if (rollAngle !== 0) {
      const cos = Math.cos(rollAngle);
      const sin = Math.sin(rollAngle);
      ctx.setTransform(spinScaleX * cos, sin, -spinScaleX * sin, cos, pos.x, py);
      ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else if (spinScaleX !== 1) {
      ctx.save();
      ctx.translate(pos.x, py);
      ctx.scale(spinScaleX, 1);
      ctx.drawImage(sprite.canvas, -sprite.half, -sprite.half, sprite.half * 2, sprite.half * 2);
      ctx.restore();
    } else {
      ctx.drawImage(sprite.canvas, pos.x - sprite.half, py - sprite.half, sprite.half * 2, sprite.half * 2);
    }
    if (sprite.hl) ctx.drawImage(sprite.hl, pos.x - sprite.half, py - sprite.half, sprite.half * 2, sprite.half * 2); // the fixed-light glint, deliberately not rotated
    if (item.type === 'alien_egg') {
      // A shrinking countdown ring around the shell (kept live and NOT
      // rotating, so the player can still read roughly how long until it
      // hatches however the egg is tumbling).
      const hatchFrac = Math.min(1, (item.hatchTimer || 0) / ALIEN_EGG_HATCH_MS);
      ctx.strokeStyle = ALIEN_EGG_RING_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, item.radius + 3, -Math.PI / 2, -Math.PI / 2 + hatchFrac * Math.PI * 2);
      ctx.stroke();
    }
  }

  // Ripening Blimpfish coins' particles and pulses, drawn from the short
  // registry Entities.js keeps (not by checking every item above), so a tank
  // with no ripening coins pays nothing here.
  const ripeningCoins = getRipeningCoins();
  for (let i = 0; i < ripeningCoins.length; i++) {
    const coin = ripeningCoins[i];
    const pos = worldToScreen(coin.x, coin.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    if (getItemDisintegrateFraction(state, coin) != null) continue; // being eaten by a Collector — drawn as dots, no halo
    drawAppreciationFx(ctx, coin, pos.x, pos.y);
  }

  perfMark('r: items', ctx);
  // Per direct request, floating text ages in real time (not sim time), so it
  // rises and fades at the normal pace while time is paused or sped up.
  const floatingTextNow = performance.now();
  const floatingTextDtMs = Math.min(100, floatingTextNow - lastFloatingTextAt);
  lastFloatingTextAt = floatingTextNow;
  state.level.floatingTexts = state.level.floatingTexts.filter((ft) => updatePickupText(ft, floatingTextDtMs));
  for (const ft of state.level.floatingTexts) {
    const pos = worldToScreen(ft.x, ft.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -20 || pos.y > canvas.height + 20) continue; // cull offscreen
    const alpha = 1 - ft.age / PICKUP_TEXT_LIFETIME_MS;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 13px sans-serif';
    if (ft.center) {
      ctx.textAlign = 'center';
      drawCachedText(ctx, ft.text, pos.x, pos.y);
      ctx.textAlign = 'left';
    } else {
      drawCachedText(ctx, ft.text, pos.x - 12, pos.y);
    }
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
      const hoverTarget = findMergeSubjectAt(state, cursorWorld.x, cursorWorld.y, draggedFishId);
      if (hoverTarget) {
        combineHoverTargetId = hoverTarget.id;
        // Tries both splice orderings — see the mouseup handler's own
        // identical fix above for why: whichever half of a splice pair got
        // grabbed first, dropping it on the other half should show as valid.
        combineHoverValid = canMergeOrSplicePair(state, dragged, hoverTarget);
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

  // Drop shadows for every fish/alien, drawn under all of them but only where a
  // seafloor decoration is behind — see renderFishShadowsOnDecor.
  perfMark('r: pickup text + effects', ctx);
  renderFishShadowsOnDecor(ctx, state);

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
    const turn = easeTurn(alien);
    const turning = turn !== alien.turnTarget;
    const facing = turning ? 1 : alien.turnTarget; // mid-turn the body is drawn facing right and squashed (mirrored once past edge-on)
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
    let gazeAngle = nearestFish ? Math.atan2(nearestFish.y - alien.y, nearestFish.x - alien.x) : (alien.turnTarget > 0 ? 0 : Math.PI);
    if (turning) {
      if (turn < 0) gazeAngle = Math.PI - gazeAngle; // the squash mirrors the pupil's direction too
      beginTurnSquash(ctx, pos.x, pos.y, turn);
    }
    drawAlienBody(ctx, pos.x, pos.y, radius, facing, color, gazeAngle, alien.spikes, alien.bodyWidthMul, alien.bodyHeightMul, alien.glow, alienBaseColor, alien.id);
    if (turning) ctx.restore();

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

  // Friendly (Alien-Egg-hatched) aliens — no hit flash, health bar or
  // shield ring, they can't be hurt. See Entities.js's createFriendlyAlien.
  for (const alien of state.level.entities) {
    if (alien.type !== 'friendly_alien') continue;
    const pos = worldToScreen(alien.x, alien.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    const turn = easeTurn(alien);
    const turning = turn !== alien.turnTarget;
    const facing = turning ? 1 : alien.turnTarget;
    if (turning) beginTurnSquash(ctx, pos.x, pos.y, turn);
    drawAlienBody(ctx, pos.x, pos.y, alien.radius * state.camera.zoom, facing, FRIENDLY_ALIEN_COLOR, (turning ? turn : alien.turnTarget) > 0 ? 0 : Math.PI, 0, alien.bodyWidthMul, alien.bodyHeightMul, false, null, alien.id, true);
    if (turning) ctx.restore();
    // Same drag/drop rings a fish gets, since a friendly alien counts as one for moving/merging.
    if (alien.id === draggedFishId || alien.id === combineHoverTargetId) {
      ctx.strokeStyle = alien.id === draggedFishId ? 'rgba(255, 255, 255, 0.9)' : (combineHoverValid ? '#4dff88' : '#ff4d4d');
      ctx.lineWidth = alien.id === draggedFishId ? 2 : 3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, alien.radius * state.camera.zoom * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  perfMark('r: shadow pass + aliens', ctx);
  // Merge partner highlight, drawn under the fish below — see renderMergeToolPartnerHighlight.
  // Per direct request: with nothing armed (plain cursor), while hovering a fish (or egg-hatched
  // friendly alien) or dragging one, and never while hostile aliens are alive (fish can't be
  // moved or merged then). Otherwise, the new-adult reminder (state.level.mergeHint)
  // plays on its fish for MERGE_HINT_MS, then fades off over MERGE_HINT_FADE_MS.
  let mergeHighlightSubject = null;
  let mergeHighlightFade = 1;
  if (state.ui.selectedTool === 'cursor' && hoverWorld && !state.ui.paused && !hostileAliensActive(state)) {
    mergeHighlightSubject = draggedFishId != null
      ? state.level.entities.find((e) => e.id === draggedFishId)
      : findMergeSubjectAt(state, hoverWorld.x, hoverWorld.y);
  }
  if (!mergeHighlightSubject && state.level.mergeHint) {
    const hintAge = state.level.elapsed - state.level.mergeHint.startedAtMs;
    const hintFish = state.level.entities.find((e) => e.id === state.level.mergeHint.fishId && e.type === 'fish' && !e.dying);
    if (!hintFish || hintAge < 0 || hintAge >= MERGE_HINT_MS + MERGE_HINT_FADE_MS) {
      state.level.mergeHint = null;
    } else if (!hostileAliensActive(state)) {
      mergeHighlightSubject = hintFish;
      mergeHighlightFade = hintAge < MERGE_HINT_MS ? 1 : 1 - (hintAge - MERGE_HINT_MS) / MERGE_HINT_FADE_MS;
    }
  }
  if (mergeHighlightSubject) renderMergeToolPartnerHighlight(ctx, state, mergeHighlightSubject, performance.now(), mergeHighlightFade);
  else mergeHoverSubjectId = null;
  beginFishSpriteFrame(); // resets the per-frame sprite-bake budget — see FishRenderer.js's drawFishCached
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
      drawFishCached(ctx, pos.x, pos.y, fish.speciesId, fish.stage, fish.deathFacing, fish.tailPhase, null, fish.starTier || 1, 0, 1, state.meta.equippedHatId);
      ctx.restore();
      continue;
    }

    const size = FISH_BASE_SIZE * def.growthStages[fish.stage].scale;
    const turn = easeTurn(fish);
    const turning = turn !== fish.turnTarget;
    const facing = turning ? 1 : fish.turnTarget; // mid-turn: drawn facing right through a squash, mirrored once past edge-on
    const isFullyGrown = fish.stage === def.growthStages.length - 1;

    // Eye direction must be a normalized unit vector, not a raw target
    // point — drawFish has no way to verify a target's coordinate space
    // matches (pos.x, pos.y), so the direction is resolved here instead,
    // from world-space positions, before normalizing. Per direct request the
    // eyes ALWAYS follow the cursor, unless the fish is hungry and swimming
    // toward food — then they look at that food. updateFish already finds that
    // target every tick and leaves it on the fish (fish.seeking/seekX/seekY),
    // so this does no scan over the item list at all (it used to search every
    // food item for every adult fish every frame), and the unit vector is
    // written into one reused object instead of allocating a new one per fish.
    let eyeDirection = null;
    if (isFullyGrown) {
      const dx = (fish.seeking ? fish.seekX : cursorWorld.x) - fish.x;
      const dy = (fish.seeking ? fish.seekY : cursorWorld.y) - fish.y;
      const dist = Math.hypot(dx, dy) || 1;
      eyeDirScratch.x = dx / dist;
      eyeDirScratch.y = dy / dist;
      eyeDirection = eyeDirScratch;
      if (turning && turn < 0) eyeDirScratch.x = -eyeDirScratch.x; // the squash mirrors the eyes' direction too
    }

    // Slightly green once a fish is hungry enough to actively seek food (the
    // same threshold that already shows the "!" indicator below) — a
    // little more green past the "!!" critical threshold — per direct
    // request that a hungry fish should visibly look a bit unwell.
    const hungerSickness = fish.hunger >= HUNGER_CRITICAL_THRESHOLD ? 0.35 : fish.hunger >= HUNGER_SEEK_THRESHOLD ? 0.18 : 0;
    // A researcher whose science drop was just blocked by the Bubble Cap looks properly sick for a second — see SCIENCE_BLOCKED_SICKNESS.
    const sickness = fish.scienceBlockedSickMs > 0 ? Math.max(hungerSickness, SCIENCE_BLOCKED_SICKNESS) : hungerSickness;
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
    if (turning) beginTurnSquash(ctx, pos.x, pos.y, turn);
    drawFishCached(ctx, pos.x, pos.y, fish.speciesId, fish.stage, facing, fish.tailPhase, eyeDirection, fish.starTier || 1, sickness, grayed, state.meta.equippedHatId, state.level.elapsed, fish.growthOrbitPhase || 0, fish.starAnimStartedAt != null ? state.level.elapsed - fish.starAnimStartedAt : -1);
    if (turning) ctx.restore();
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

    // Bio Fish's Bio-Sludge mode — a pulsing acid-green ring while
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
    // dispenser, Bio Fish's Bio-Sludge mode) — per direct request
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

    // Growth-feed-streak orbiting food + trail — per direct request, one
    // small food-and-trail visual per pre-critical feed so far (0-2 shown
    // at once; the 3rd converts both into the fly-in + particle burst
    // rendered in a separate pass below, instead of adding a 3rd). Smaller
    // than a real Food pellet (FISH_GROWTH_ORBIT_FOOD_RADIUS_PX <
    // FOOD_RADIUS) so it never reads as an actual edible item.
    for (let i = 0; i < (fish.growthFeedStreak || 0); i++) {
      const orbit = computeGrowthOrbitPosition(fish, i, state.level.elapsed);
      const opos = worldToScreen(orbit.x, orbit.y, state.camera);
      const r = FISH_GROWTH_ORBIT_FOOD_RADIUS_PX * state.camera.zoom;
      // Fading trail — a handful of short segments walking back along the
      // same circle from the food's current angle, each dimmer than the
      // last, rather than one flat-opacity stroke.
      ctx.save();
      ctx.strokeStyle = FOOD_COLOR;
      ctx.lineWidth = Math.max(1, r * 0.9);
      ctx.lineCap = 'round';
      const trailSteps = 6;
      for (let s = 1; s <= trailSteps; s++) {
        const aStart = orbit.angle - ((s - 1) / trailSteps) * FISH_GROWTH_ORBIT_TRAIL_ARC_RAD;
        const aEnd = orbit.angle - (s / trailSteps) * FISH_GROWTH_ORBIT_TRAIL_ARC_RAD;
        const p1 = worldToScreen(fish.x + Math.cos(aStart) * FISH_GROWTH_ORBIT_RADIUS_PX, fish.y + Math.sin(aStart) * FISH_GROWTH_ORBIT_RADIUS_PX, state.camera);
        const p2 = worldToScreen(fish.x + Math.cos(aEnd) * FISH_GROWTH_ORBIT_RADIUS_PX, fish.y + Math.sin(aEnd) * FISH_GROWTH_ORBIT_RADIUS_PX, state.camera);
        ctx.globalAlpha = 0.3 * (1 - s / trailSteps);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.fillStyle = FOOD_COLOR;
      ctx.arc(opos.x, opos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Off-screen critical-hunger notification bubbles — per direct request
  // ("when time is unpaused and there are fish in the second stage of hunger
  // that are not in view, add in a small hunger notification bubble at the
  // top of the screen, horizontally matching the horizontal position of the
  // fish"). Deliberately re-derived fresh every frame from live state,
  // instead of tracked with its own show/hide flag per fish — the camera
  // never pans horizontally (see Engine.js's updateCamera; a fish's own
  // screen x is always meaningful regardless of vertical scroll), so "off
  // view" here only ever means scrolled past vertically. Re-deriving every
  // frame is what makes "scroll up to where the fish is -> bubble toggles
  // off" and "scroll back down / unpause -> it shows back up" fall out for
  // free: there's no persisted per-fish toggle state to get out of sync,
  // just this frame's own camera position and pause flag. The main per-fish
  // loop above already culls (skips entirely) any fish outside the exact
  // same on-screen bounds, so a plain second pass here, looking for the ones
  // THAT loop skipped, can't double-count or fight it for a frame.
  if (!state.ui.paused) {
    const bubbleMarginX = 26;
    const bubbleY = 54;
    // World-space margin, per direct bug report ("in full screen mode, the
    // notification bubble shows up correctly. But when not in fullscreen,
    // the fish has to be off screen for more than one scroll length before
    // it shows"). The old check compared worldToScreen's OUTPUT (screen
    // pixels) against a flat 60px screen margin — camera.zoom divides into
    // that conversion, so at zoom=1 (a tall/maximized window, where the
    // water column already fills the screen without needing to zoom out)
    // 60 screen px is a 60-world-unit buffer, but at zoom<1 (a shorter
    // window, where the camera zooms OUT further to still fit the whole
    // water column vertically — see fitCameraZoom) that same 60 screen px
    // covers proportionally MORE world space, silently inflating the buffer
    // a fish had to cross before counting as "off screen." Comparing
    // directly in world space against camera.x/y/viewWidth/viewHeight with a
    // flat WORLD-unit margin instead makes the buffer zoom-independent — the
    // same effective margin fullscreen already had.
    const OFFSCREEN_MARGIN_WORLD = 60;
    const camera = state.camera;
    for (const fish of state.level.entities) {
      if (fish.type !== 'fish' || fish.dying) continue;
      if (fish.hunger < HUNGER_CRITICAL_THRESHOLD) continue;
      const onScreen =
        fish.x >= camera.x - OFFSCREEN_MARGIN_WORLD &&
        fish.x <= camera.x + camera.viewWidth + OFFSCREEN_MARGIN_WORLD &&
        fish.y >= camera.y - OFFSCREEN_MARGIN_WORLD &&
        fish.y <= camera.y + camera.viewHeight + OFFSCREEN_MARGIN_WORLD;
      if (onScreen) continue;
      const pos = worldToScreen(fish.x, fish.y, camera);
      const def = SPECIES[fish.speciesId];
      const hungerIconColor = def.behavior.includes('SCAVENGER') ? WASTE_COLOR : FOOD_COLOR;
      const bx = Math.max(bubbleMarginX, Math.min(canvas.width - bubbleMarginX, pos.x));
      ctx.save();
      ctx.fillStyle = 'rgba(20, 20, 30, 0.6)';
      ctx.beginPath();
      ctx.roundRect(bx - 22, bubbleY - 14, 44, 26, 13);
      ctx.fill();
      // Icon+text group re-centered on bx, per direct bug report ("center
      // the food and exclamation mark in the bubble, they are biased to the
      // left side now") — measured via ctx.measureText('!!') at this exact
      // font (~10px advance width, glyphs starting ~1px left of the anchor)
      // against the dot's own 4px radius: shifting both +6.5px from their
      // old x lands the combined (dot + gap + "!!") visual span symmetric
      // around bx instead of the old dot-anchored offset.
      ctx.fillStyle = '#ff3b3b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('!!', bx + 1.5, bubbleY + 5);
      ctx.beginPath();
      ctx.arc(bx - 6.5, bubbleY - 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = hungerIconColor;
      ctx.fill();
      ctx.restore();
    }
  }

  // Turret muzzle flash — a brief bright glow at the tile that fired, per
  // direct request ("a brief flash at the firing tile"). Drawn before the
  // projectile loop below so a shot's own bolt reads on top of it at the
  // instant they coincide. Purely decorative — see Entities.js's
  // updateEntities (pushes) / updateTurretMuzzleFlashes (culls).
  for (const flash of state.level.turretMuzzleFlashes) {
    const pos = worldToScreen(flash.x, flash.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const t = flash.age / TURRET_MUZZLE_FLASH_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    const r = (6 + t * 10) * state.camera.zoom;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
    grad.addColorStop(0, `rgba(255, 245, 200, ${alpha * 0.9})`);
    grad.addColorStop(1, 'rgba(255, 245, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
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

  // Turret impact spark — a small quick burst of radiating lines where a
  // shot actually lands, per direct request ("a small spark at the alien
  // hit point"). Purely decorative — see Entities.js's
  // updateTurretProjectiles (pushes on hit) / updateTurretImpactEffects
  // (culls).
  for (const spark of state.level.turretImpactEffects) {
    const pos = worldToScreen(spark.x, spark.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const t = spark.age / TURRET_IMPACT_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    const dist = (3 + t * 10) * state.camera.zoom;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = TURRET_PROJECTILE_COLOR;
    ctx.lineWidth = Math.max(1, 2 * state.camera.zoom * (1 - t * 0.5));
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.PI / 5;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + Math.cos(angle) * dist, pos.y + Math.sin(angle) * dist);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Coin pickup sparkle — a quick radiating gold glint the instant a coin is
  // banked, per direct request ("make it so the picking up coins does a
  // sparkle"). Small 4-point star/diamond glints rather than the
  // alien-burst's plain dots, so it reads distinctly as a "sparkle" instead
  // of a recolor of the alien-death effect, plus a brief bright core flash
  // at the pickup point itself. Purely decorative — see Entities.js's
  // updateCoin (pushes) / updateCoinSparkleEffects (culls). The "1-3
  // bubbles" half of the same request is a separate effect — see
  // Ambience.js's spawnCoinPickupBubbles, called from the same spot in
  // Entities.js.
  for (const effect of state.level.coinSparkleEffects) {
    const pos = worldToScreen(effect.x, effect.y, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const t = effect.age / COIN_SPARKLE_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    // A fish's 3-feed-streak payout reuses this same effect, larger (and with
    // more glints) — see FISH_STREAK_SPARKLE_SCALE; a plain coin pickup has no
    // `scale` and renders exactly as before.
    const sparkleScale = effect.scale || 1;
    const glints = sparkleScale > 1 ? 8 : 5;
    const dist = (4 + t * 16) * sparkleScale * state.camera.zoom;
    const sc = COIN_SPARKLE_COLOR;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${sc.r}, ${sc.g}, ${sc.b})`;
    for (let i = 0; i < glints; i++) {
      const angle = (i / glints) * Math.PI * 2 + t * 1.5;
      const px = pos.x + Math.cos(angle) * dist;
      const py = pos.y + Math.sin(angle) * dist;
      const s = Math.max(1, 3.5 * sparkleScale * state.camera.zoom * (1 - t));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.6);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(0, s * 1.6);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    const coreR = 14 * sparkleScale * state.camera.zoom * (1 - t * 0.6);
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, coreR);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Growth-feed-streak fly-in — the two orbiting food bits converging on
  // the fish on its 3rd pre-critical feed, per direct request. Looks the
  // fish up fresh by id every frame (rather than caching a reference) so it
  // correctly tracks a fish that's still swimming around while this plays;
  // if the fish is somehow already gone (died mid-animation), it just skips
  // drawing that piece for the rest of its natural age-out instead of
  // erroring. Purely decorative — see Entities.js's updateFish (pushes) /
  // updateFishGrowthAbsorbEffects (culls).
  for (const effect of state.level.fishGrowthAbsorbEffects) {
    const targetFish = state.level.entities.find((e) => e.id === effect.fishId && e.type === 'fish');
    if (!targetFish) continue;
    const t = Math.min(1, effect.age / FISH_GROWTH_ABSORB_DURATION_MS);
    const ease = t * t; // accelerates in, reads as being "pulled" toward the fish
    const worldX = effect.startX + (targetFish.x - effect.startX) * ease;
    const worldY = effect.startY + (targetFish.y - effect.startY) * ease;
    const pos = worldToScreen(worldX, worldY, state.camera);
    if (pos.x < -30 || pos.x > canvas.width + 30 || pos.y < -30 || pos.y > canvas.height + 30) continue;
    const r = FISH_GROWTH_ORBIT_FOOD_RADIUS_PX * state.camera.zoom * (1 - t * 0.4);
    ctx.save();
    ctx.globalAlpha = 1 - t * 0.2;
    ctx.fillStyle = FOOD_COLOR;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Grow-to-adult particle burst — shared by the growth-feed-streak
  // conversion above AND Mutagen Paste's own instant Adult growth, per
  // direct request ("use this same particle animation whenever a fish eats
  // mutagen paste"). An expanding ring plus radiating sparkle particles
  // (same overall shape as the alien-death burst) plus a bright core flash
  // (same trick the coin sparkle's core uses), in FISH_GROWTH_EFFECT_COLOR's
  // soft green so it reads distinctly as "growth" rather than a recolor of
  // either of those. Purely decorative — see Entities.js's updateFish/the
  // Mutagen Paste branch (pushes) / updateFishGrowthEffects (culls).
  for (const effect of state.level.fishGrowthEffects) {
    const pos = worldToScreen(effect.x, effect.y, state.camera);
    if (pos.x < -40 || pos.x > canvas.width + 40 || pos.y < -40 || pos.y > canvas.height + 40) continue;
    const t = effect.age / FISH_GROWTH_EFFECT_DURATION_MS; // 0 -> 1
    const alpha = 1 - t;
    const gc = FISH_GROWTH_EFFECT_COLOR;
    ctx.save();
    ctx.globalAlpha = alpha;
    const ringRadius = 18 * state.camera.zoom * (1 + t * 1.8);
    ctx.strokeStyle = `rgb(${gc.r}, ${gc.g}, ${gc.b})`;
    ctx.lineWidth = Math.max(1, 3 * state.camera.zoom * (1 - t));
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    const particleDist = 10 * state.camera.zoom * (0.5 + t * 2);
    ctx.fillStyle = `rgba(${gc.r}, ${gc.g}, ${gc.b}, 0.9)`;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + t * 1.2;
      const px = pos.x + Math.cos(angle) * particleDist;
      const py = pos.y + Math.sin(angle) * particleDist;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, 2.5 * state.camera.zoom * (1 - t)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const coreR = 20 * state.camera.zoom * (1 - t * 0.5);
    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, coreR);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.7})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // "On fire, disintegrating" — per direct request, replacing the old plain
  // bubble-pop icon for a blocked COIN drop, then extended to a blocked
  // SCIENCE brew too ("use a science icon and do that animation when the
  // science flask cap is reached"). A shrinking icon (a gold coin, or a
  // purple/blue Science flask — same two-tone gradient the real physical
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
    // blocked coin, or the same flask the
    // real physical Science item uses for a blocked science brew.
    if (effect.resource === 'science') {
      drawScienceFlask(ctx, pos.x, pos.y, radius, SCIENCE_ITEM_COLOR_A, SCIENCE_ITEM_COLOR_B);
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
  ctx.save();
  for (const b of state.level.fishBubbleEffects) {
    const wobbleX = Math.sin((b.age / 1000) * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const pos = worldToScreen(b.x + wobbleX, b.y, state.camera);
    if (pos.x < -20 || pos.x > canvas.width + 20 || pos.y < -20 || pos.y > canvas.height + 20) continue;
    const lifeT = b.age / FISH_BUBBLE_LIFETIME_MS; // 0 -> 1
    const fadeAlpha = lifeT > 0.7 ? 1 - (lifeT - 0.7) / 0.3 : 1;
    const r = b.radius * state.camera.zoom;
    drawGlossyBubble(ctx, pos.x, pos.y, r, Math.max(1, state.camera.zoom), 0.32 * 0.7, 0.45 * 0.6, fadeAlpha); // sprite-based, shared with Ambience.js's own bubbles
  }
  ctx.restore();

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
  // cancel'"), with the arming half later moved to middle-click and then to a
  // right-click-drag (UI.js's updateHUD is what actually swaps the legend text). Computed here into state.ui
  // rather than drawn on canvas — UI.js's updateHUD reads it to drive the
  // bottom-left legend, the same cross-module-flag pattern this file
  // already uses for wasteTurretAmmoGainedPending/chestItemAbsorbedPending,
  // since UI.js can't be imported back into here without a circular
  // dependency.
  state.ui.buildingMoveDragging = movingBuilding != null && rightMoveDragging; // mid right-drag: the legend says "release to place" instead of the click-to-accept wording
  if (movingBuilding != null || (isFanAimingActive() && fanAimingMoveData != null)) {
    state.ui.buildingMoveArmed = true;
    state.ui.buildingMoveHoverLabel = null;
  } else {
    state.ui.buildingMoveArmed = false;
    if (isCursorOrFoodTool(hoverEffectiveTool) && input.mouse.inside && !state.ui.paused) {
      const { col: hoverCol, row: hoverRow } = worldToTile(hoverWorld.x, hoverWorld.y);
      const hoverTile = getTile(state.level.grid, hoverCol, hoverRow);
      // Moving now needs the plain cursor (a right-click with the Food tool armed just
      // cancels it), so the Food tool only gets the 'delete' hint.
      const canMove = state.ui.selectedTool === 'cursor';
      state.ui.buildingMoveHoverLabel = hoverTile && hoverTile !== TILE_EMPTY
        ? (!canMove ? 'delete' : FAN_BUILDING_IDS.includes(hoverTile) ? 'adjust' : (PLATFORM_BUILDING_IDS.includes(hoverTile) ? 'move-platform' : 'move'))
        : null;
    } else {
      state.ui.buildingMoveHoverLabel = null;
    }
  }

  // Fish merge/splice hover legend — see state.ui.fishMergeHoverLines' own
  // comment. Only computed while nothing else is already claiming the
  // bottom-left legend spot (no building hovered/moving, no cost legend for
  // an armed build:/fish: tool) and no drag is in progress, so this never
  // fights those for the same on-screen slot. Per direct request, only with
  // nothing armed (the plain cursor) and no hostile alien alive (fish can't be
  // moved/merged then); every hovered fish gets the legend (an empty list is
  // just the "Right-click and drag: Move/Merge" header — UI.js draws that line).
  // The merge list is recomputed only when the hovered fish changes or every
  // MERGE_HOVER_REFRESH_MS, not every frame.
  if (
    input.mouse.inside && !state.ui.paused && !state.level.tutorialFlow && state.ui.selectedTool === 'cursor' &&
    draggedFishId == null && !state.ui.buildingMoveArmed && state.ui.buildingMoveHoverLabel == null &&
    blueprintClipboard == null && !hostileAliensActive(state)
  ) {
    const hoverFish = findMergeSubjectAt(state, hoverWorld.x, hoverWorld.y);
    if (hoverFish) {
      const nowMs = performance.now();
      if (hoverFish.id !== mergeLegendFishId || nowMs >= mergeLegendRefreshAtMs) {
        mergeLegendFishId = hoverFish.id;
        mergeLegendLines = describeFishMergeOptions(state, hoverFish) ?? [];
        mergeLegendRefreshAtMs = nowMs + MERGE_HOVER_REFRESH_MS;
      }
      state.ui.fishMergeHoverLines = mergeLegendLines;
    } else {
      mergeLegendFishId = null;
      state.ui.fishMergeHoverLines = null;
    }
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
      const ghostR = WASTE_RADIUS * state.camera.zoom * WASTE_VISUAL_SCALE;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = WASTE_COLOR;
      tracePoopBlobPath(ctx, screen.x, screen.y + ghostR * WASTE_VISUAL_Y_OFFSET_FRACTION, ghostR);
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
    drawCachedText(ctx, def.icon, gx, gy + 1);
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
    drawCachedText(ctx, '✅', gx, gy + 1);
    ctx.restore();
  }

  // Step 2 done: every foreground element + its cursor ghosts/effects have
  // been drawn into foregroundCanvas. Steps 3-5: clip the caustic video to
  // that layer's own silhouette, fade it vertically, screen-blend it back
  // onto the foreground art, and composite the result onto the main canvas —
  // see compositeCausticForeground's own comment. `ctx` is restored to
  // mainCtx afterward so every draw call below this point (the boss white
  // flash, HUD, minimap) goes back to drawing on the real, visible canvas —
  // full-screen effects like that flash need to cover the background too, so
  // they must run after this composite, not be clipped inside it.
  perfMark('r: fish + overlays', ctx);
  compositeCausticForeground();
  ctx = mainCtx;

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
  perfMark('r: boss overlay + HUD', ctx); // was labelled 'caustic composite' back when the composite call sat inside this span; it is timed on its own now (r: caustic: ...)
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
  update: (dtMs) => { perfUpdateBegin(); update(dtMs); perfUpdateEnd(); },
  render: () => {
    perfRenderBegin();
    render();
    if (titleNeedsBackdrop()) captureTitleBackdrop(canvas); // snapshot of this fully-drawn frame becomes the title's backdrop
    perfRenderEnd(state, canvas.width, canvas.height);
  },
  // state.ui.speedX2 (the player-facing 2x speed button/hotkey) stacks
  // multiplicatively on top of the debug time-scale cheat rather than
  // replacing it — the debug +/- keys are a dev tool independent of this
  // player feature, and there's no real-world case where a player toggles
  // both at once, so simplicity wins over guarding against it.
  getTimeScale: () => TIME_SCALE_STEPS[state.debug.timeScaleIndex] * (state.ui.speedX2 ? 2 : 1),
  simDtMs: SIM_DT_MS,
  maxFrameSkip: MAX_FRAME_SKIP,
  alwaysRender: titleIsActive, // the title animates in real time off render() — see Engine.js's render-after-a-step note
});
