// Mound.js — the seabed's Mound: the diegetic trigger for Tier progression.
// This module owns the Mound's hit-test, its crack logic (crackMound spends
// money, advances state.level.tier, permanently grants that tier's unlocks
// into state.meta, and writes a message into state.level.notifications),
// its render, and camera centering — but NOT the "Throw money at it?" popup
// itself, which is a DOM modal owned by UI.js (openMoundMenu/closeMoundMenu)
// same as the pause menu. main.js's click handler calls isPointOnMound and,
// if true, opens that modal instead of calling into this file directly.
// See CLAUDE.md's "Tier Progression & The Mound" section for the full design.
// Forbidden: no per-tick simulation — it's purely a click target plus a
// render, same as any other static seabed fixture.

import {
  WORLD_W,
  SEABED_FLOOR_Y,
  TILE_SIZE,
  MOUND_MAX_TIER,
  MOUND_TEASE_COST,
  MOUND_CRACK_COST,
  MOUND_WIDTH_TILES,
  MOUND_HEIGHT_PX,
  TIER_UNLOCKS,
  NOTIFICATION_LOG_MAX,
} from './Config.js';
import { worldToScreen } from './Engine.js';

const MOUND_WIDTH_PX = MOUND_WIDTH_TILES * TILE_SIZE;
export const MOUND_X = WORLD_W / 2; // world-space center, fixed for the life of the level

// The camera starts at world x=0 (the far-left edge) by default, but the
// Mound sits at the world's horizontal center — without this, it's off the
// right edge of the screen by ~2000px and effectively undiscoverable at
// level start. Called once by main.js after the initial zoom/viewWidth
// computation, and again by UI.js's restartLevel after every restart (both
// go through loadLevel, which resets camera.x to 0). Doesn't touch camera.y
// — the default water-column framing already leaves enough of a seabed
// "peek" at the bottom of the screen for the Mound to be vertically visible.
export function centerCameraOnMound(camera) {
  const maxX = Math.max(0, WORLD_W - camera.viewWidth);
  camera.x = Math.max(0, Math.min(MOUND_X - camera.viewWidth / 2, maxX));
}

const TIER_CRACK_MESSAGES = {
  2: 'The mound splits open with a wet crack. Basic factory tiles unlocked — Wall, Ramp, Collector, Blaster. A Suckerfish scuttles free, already looking for waste to eat.',
  3: 'Another crack spiderwebs across the mound. A low hum starts underneath — something electrical. Electric Eel unlocked.',
  4: 'The mound shatters completely. Beneath the rubble: a Science Lab, humming with old machinery. Science Octopus unlocked, and Gene-Splicing research is now available.',
};

function pushNotification(state, text) {
  state.level.notifications.push({ id: state.level.notifications.length + 1, text, elapsed: state.level.elapsed });
  if (state.level.notifications.length > NOTIFICATION_LOG_MAX) state.level.notifications.shift();
}

// The very first "throw money" attempt at the Mound is a red herring: it
// costs MOUND_TEASE_COST but does nothing except set state.level.moundTeased
// and joke about it — the REAL Tier 1 -> 2 crack only becomes available
// after that, at MOUND_CRACK_COST[1] (much higher). Every other tier
// transition is a normal single-cost crack.
export function getMoundNextCost(state) {
  const tier = state.level.tier;
  if (tier === 1 && !state.level.moundTeased) return MOUND_TEASE_COST;
  return MOUND_CRACK_COST[tier];
}

export function canCrackMound(state) {
  if (state.level.tier >= MOUND_MAX_TIER) return false;
  return state.level.money >= getMoundNextCost(state);
}

export function crackMound(state) {
  if (!canCrackMound(state)) return false;
  const cost = getMoundNextCost(state);
  state.level.money -= cost;

  if (state.level.tier === 1 && !state.level.moundTeased) {
    state.level.moundTeased = true;
    pushNotification(state, "That didn't seem to do anything. Maybe I should try more money.");
    return true; // money spent, joke happened — but the tier does NOT advance
  }

  state.level.tier += 1;

  const unlocks = TIER_UNLOCKS[state.level.tier];
  if (unlocks) {
    for (const id of unlocks.species) {
      if (!state.meta.speciesUnlocked.includes(id)) state.meta.speciesUnlocked.push(id);
    }
    for (const id of unlocks.buildings) {
      if (!state.meta.buildingsUnlocked.includes(id)) state.meta.buildingsUnlocked.push(id);
    }
  }

  pushNotification(state, TIER_CRACK_MESSAGES[state.level.tier] || `Tier ${state.level.tier} reached.`);
  return true;
}

// Simple bounding-box hit-test around the Mound's footprint, centered at
// MOUND_X and sitting on the seabed surface.
export function isPointOnMound(state, worldX, worldY) {
  if (state.level.tier >= MOUND_MAX_TIER) return false; // fully shattered — nothing left to click (Science Lab click target is Phase 4)
  const left = MOUND_X - MOUND_WIDTH_PX / 2;
  const right = MOUND_X + MOUND_WIDTH_PX / 2;
  const top = SEABED_FLOOR_Y - MOUND_HEIGHT_PX;
  const bottom = SEABED_FLOOR_Y + TILE_SIZE;
  return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
}

export function renderMound(ctx, state) {
  if (state.level.tier >= MOUND_MAX_TIER) return; // shattered — nothing to draw (Science Lab render is Phase 4)
  const { camera } = state;
  const tier = state.level.tier;
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX, camera);
  const w = MOUND_WIDTH_PX * camera.zoom;
  const h = (MOUND_HEIGHT_PX + TILE_SIZE) * camera.zoom;

  ctx.fillStyle = '#8a7458';
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y + h);
  ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + w / 2, topLeft.y);
  ctx.quadraticCurveTo(topLeft.x + w, topLeft.y, topLeft.x + w, topLeft.y + h);
  ctx.closePath();
  ctx.fill();

  // Crack lines scale with how many times it's already been cracked.
  ctx.strokeStyle = '#4a3c2c';
  ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  for (let i = 1; i < tier; i++) {
    const cx = topLeft.x + w * (0.3 + 0.2 * i);
    ctx.beginPath();
    ctx.moveTo(cx, topLeft.y + h * 0.15);
    ctx.lineTo(cx - 8 * camera.zoom, topLeft.y + h * 0.5);
    ctx.lineTo(cx + 6 * camera.zoom, topLeft.y + h * 0.85);
    ctx.stroke();
  }
}
