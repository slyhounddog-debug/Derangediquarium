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
  TILE_FAN_T2,
  TILE_AUTO_FEEDER,
  FAN_UNLOCK_COST,
  AUTO_FEEDER_UNLOCK_COST,
} from './Config.js';
import { worldToScreen } from './Engine.js';
import { createShimmerTimer, updateShimmerTimer, drawShimmerSweep } from './Shimmer.js';

const MOUND_WIDTH_PX = MOUND_WIDTH_TILES * TILE_SIZE;
export const MOUND_X = WORLD_W / 2; // world-space center, fixed for the life of the level

// Shimmer/gleam, per direct request ("make it so the mound and the science
// lab shimmer/gleen like the other objects, but every 10-50 seconds") — see
// Shimmer.js for the shared mechanism. Each object gets its own independent
// timer so the two don't stay in sync.
const moundShimmer = createShimmerTimer();
const labShimmer = createShimmerTimer();

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

// The Tier 1.5 "tease" — a pure joke again, per direct request: the
// Rudimentary Fan moved off this step entirely, onto its own paid "Tier
// 1.75" step below (MOUND_FAN_UNLOCK_MESSAGE) — so the very first "throw
// money" attempt goes back to spending $150 for nothing but a punchline.
const MOUND_TEASE_MESSAGE = "You throw $150 at a suspicious lump of dirt. Nothing happens. Absolutely nothing. You have been scammed by a rock.";

// "Tier 1.75" — the new real reward the tease used to grant directly: a
// second, separately-priced attempt (after the tease, before the actual
// Tier 1->2 crack) that costs FAN_UNLOCK_COST ($500) and grants only the
// Rudimentary Fan, still without advancing state.level.tier — see
// getMoundNextCost/crackMound below and Config.js's FAN_UNLOCK_COST.
const MOUND_FAN_UNLOCK_MESSAGE = "You throw another $500 at the same lump of dirt, out of spite this time. Something's fishy... and it works! A crack splits open and a Rudimentary Fan flops out, blades already spinning. Turns out bribery works on geology too — you just had to pay full price.";

// "Tier 2.5" — same idea as the Fan's own paid step above, sitting between
// the real Tier 1->2 crack and the real Tier 2->3 crack instead. Costs
// AUTO_FEEDER_UNLOCK_COST ($2500) and grants only the Auto-Feeder, still
// without advancing state.level.tier past 2.
const MOUND_AUTO_FEEDER_UNLOCK_MESSAGE = "A third crack opens up just for you, apparently — an Auto-Feeder rolls out, already smelling faintly of expired fish flakes.";

// Per direct request, the Mound is a short on-ramp now, not the game's
// whole arc — it only ever grants Octopus/Processor (Tier 2) before
// shattering outright at MOUND_MAX_TIER (3) into the Science Lab, where the
// REAL progression (Suckerfish, Electric Eel, every Electric/Advanced
// building) lives from then on. See SCIENCE_LAB_UPGRADES in Config.js.
const TIER_CRACK_MESSAGES = {
  2: 'Another crack spreads wider. A Processor tumbles out, closely followed by a Science Octopus that looks personally offended by the mess.',
  3: 'The mound stops cracking and just gives up, shattering completely. Underneath: a Science Lab that has apparently been there the whole time, humming with unfinished research. Everything from here on out is going to cost Science.',
};

function pushNotification(state, text) {
  state.level.notifications.push({ id: state.level.notifications.length + 1, text, elapsed: state.level.elapsed });
  if (state.level.notifications.length > NOTIFICATION_LOG_MAX) state.level.notifications.shift();
}

// Five distinct steps now sit across the first two real tiers, per direct
// request: (1) the Tier 1.5 "tease" (MOUND_TEASE_COST, a pure joke — does
// nothing), (2) "Tier 1.75" (FAN_UNLOCK_COST, grants ONLY the Rudimentary
// Fan), (3) the real Tier 1->2 crack (MOUND_CRACK_COST[1], grants the
// Processor + Suckerfish), (4) "Tier 2.5" (AUTO_FEEDER_UNLOCK_COST, grants
// ONLY the Auto-Feeder), then (5) the real Tier 2->3 crack
// (MOUND_CRACK_COST[2]). Every tier transition beyond that is unchanged — a
// normal single-cost crack.
export function getMoundNextCost(state) {
  const tier = state.level.tier;
  if (tier === 1 && !state.level.moundTeased) return MOUND_TEASE_COST;
  if (tier === 1 && !state.level.fanUnlockPurchased) return FAN_UNLOCK_COST;
  if (tier === 2 && !state.level.autoFeederUnlockPurchased) return AUTO_FEEDER_UNLOCK_COST;
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
    pushNotification(state, MOUND_TEASE_MESSAGE);
    return true; // money spent, nothing granted — the tier does NOT advance
  }

  if (state.level.tier === 1 && !state.level.fanUnlockPurchased) {
    state.level.fanUnlockPurchased = true;
    if (!state.meta.buildingsUnlocked.includes(TILE_FAN_T2)) state.meta.buildingsUnlocked.push(TILE_FAN_T2);
    pushNotification(state, MOUND_FAN_UNLOCK_MESSAGE);
    return true; // money spent, Fan granted — still no tier advance
  }

  if (state.level.tier === 2 && !state.level.autoFeederUnlockPurchased) {
    state.level.autoFeederUnlockPurchased = true;
    if (!state.meta.buildingsUnlocked.includes(TILE_AUTO_FEEDER)) state.meta.buildingsUnlocked.push(TILE_AUTO_FEEDER);
    pushNotification(state, MOUND_AUTO_FEEDER_UNLOCK_MESSAGE);
    return true; // money spent, Auto-Feeder granted — still no tier advance
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

// Small speckle-noise tile, generated once and cached as a repeating
// CanvasPattern — same technique as Grid.js's getCityTexturePattern, giving
// the Mound's flat fill some grain instead of reading as one solid color,
// per direct request ("texture to the mound similar to the city").
let moundTexturePattern = null;
function getMoundTexturePattern(ctx) {
  if (moundTexturePattern) return moundTexturePattern;
  const tile = document.createElement('canvas');
  tile.width = 32;
  tile.height = 32;
  const tctx = tile.getContext('2d');
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * 32;
    const y = Math.random() * 32;
    const r = 0.5 + Math.random() * 1.5;
    tctx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.13)';
    tctx.beginPath();
    tctx.arc(x, y, r, 0, Math.PI * 2);
    tctx.fill();
  }
  moundTexturePattern = ctx.createPattern(tile, 'repeat');
  return moundTexturePattern;
}

// A fixed set of jagged multi-segment crack shapes, generated once at module
// load (not per-render — a fresh Math.random() every frame would make the
// cracks visibly jitter) and reused/repositioned by renderMound below.
// MOUND_MAX_TIER-1 is the most cracks that can ever be showing at once.
// Per-point jitter (dx) is deliberately tight (±5px, was ±8px) — several
// independent random points in a row landing on the same side used to be
// able to compound into a crack that visibly bowed hard toward one edge of
// the dome ("the cracks are shifted left" bug report), even though each
// crack's BASE x-position (see renderMound's cx below) is itself centered/
// evenly spread. branchDir is a real coin flip now, not always-positive —
// the old fixed `25 + random(-10..10)` range meant every branch's sin()
// always came out positive, so every crack's fork always leaned the exact
// same direction (right) regardless of which crack it was.
const CRACK_SHAPES = [];
for (let i = 0; i < 4; i++) {
  const segments = 5 + (i % 2);
  const points = [];
  for (let s = 0; s <= segments; s++) {
    points.push({ t: s / segments, dx: (Math.random() - 0.5) * 10 });
  }
  // A short branch forking off partway down — reads as a real fracture, not
  // just a wiggly line, per direct request for "more interesting" cracks.
  const branchAt = 0.35 + Math.random() * 0.3;
  const branchDir = Math.random() < 0.5 ? -1 : 1;
  const branchAngle = branchDir * (25 + Math.random() * 10);
  CRACK_SHAPES.push({ points, branchAt, branchAngle });
}

export function renderMound(ctx, state) {
  if (state.level.tier >= MOUND_MAX_TIER) return; // shattered — nothing to draw (Science Lab render is Phase 4)
  const { camera } = state;
  const tier = state.level.tier;
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX, camera);
  const w = MOUND_WIDTH_PX * camera.zoom;
  const h = (MOUND_HEIGHT_PX + TILE_SIZE) * camera.zoom;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y + h);
  ctx.quadraticCurveTo(topLeft.x, topLeft.y, topLeft.x + w / 2, topLeft.y);
  ctx.quadraticCurveTo(topLeft.x + w, topLeft.y, topLeft.x + w, topLeft.y + h);
  ctx.closePath();
  ctx.fillStyle = '#8a7458';
  ctx.fill();
  // Constrains EVERYTHING drawn until ctx.restore() below (the texture fill
  // AND the crack/branch strokes) to the dome's own silhouette — previously
  // only wrapped the texture fill, so a branch's jittered endpoint could
  // poke straight through the dome's edge into the water above it,
  // especially near the top where the dome tapers to a point.
  ctx.clip();
  ctx.fillStyle = getMoundTexturePattern(ctx);
  ctx.globalAlpha = 0.55;
  ctx.fillRect(topLeft.x, topLeft.y, w, h);
  ctx.globalAlpha = 1;

  // Crack lines scale with how many times it's already been cracked. Each
  // one is a jagged multi-segment fracture with a short forking branch (see
  // CRACK_SHAPES above) rather than a plain 3-point zigzag, plus a thin
  // offset highlight stroke alongside the dark line for a carved/engraved
  // look instead of a flat scribble. cx is spread evenly across a band well
  // clear of the dome's tapering edges (35%-65% width, was 50%-90% — the old
  // range crept close enough to the right edge at higher tiers to read as
  // "everything is bunched toward one side" against the mostly-blank rest of
  // the dome).
  for (let i = 1; i < tier; i++) {
    const shape = CRACK_SHAPES[(i - 1) % CRACK_SHAPES.length];
    const spreadT = tier > 2 ? (i - 1) / (tier - 2) : 0.5; // 0..1 across however many cracks are actually showing
    const cx = topLeft.x + w * (0.35 + 0.3 * spreadT);
    const topY = topLeft.y + h * 0.12;
    const bottomY = topLeft.y + h * 0.88;

    const drawMainCrack = () => {
      ctx.beginPath();
      shape.points.forEach((p, idx) => {
        const x = cx + p.dx * camera.zoom;
        const y = topY + (bottomY - topY) * p.t;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    ctx.strokeStyle = 'rgba(255, 244, 224, 0.35)';
    ctx.lineWidth = Math.max(1, 1.5 * camera.zoom);
    ctx.save();
    ctx.translate(1 * camera.zoom, 1 * camera.zoom);
    drawMainCrack();
    ctx.restore();

    ctx.strokeStyle = '#4a3c2c';
    ctx.lineWidth = Math.max(1, 2 * camera.zoom);
    ctx.lineCap = 'round';
    drawMainCrack();

    // The branch: forks off the main line partway down, at branchAngle
    // degrees off the main crack's own local direction.
    const branchPoint = shape.points.find((p) => p.t >= shape.branchAt) || shape.points[shape.points.length - 1];
    const bx = cx + branchPoint.dx * camera.zoom;
    const by = topY + (bottomY - topY) * branchPoint.t;
    const branchLen = h * 0.18;
    const angleRad = (shape.branchAngle * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.sin(angleRad) * branchLen, by + Math.cos(angleRad) * branchLen);
    ctx.stroke();
  }
  // Drawn last, still inside the dome-silhouette clip, so the sweep never
  // paints outside the Mound's own shape.
  drawShimmerSweep(ctx, updateShimmerTimer(moundShimmer, state.level.elapsed), topLeft.x, topLeft.y, w, h);
  ctx.restore(); // lifts the dome-silhouette clip set above, now that the texture, every crack/branch, and the shimmer have been drawn through it
}

// ---- Science Lab (Phase 4) ----
// Sits at the exact same footprint the Mound occupied, revealed the instant
// the Mound shatters (state.level.tier >= MOUND_MAX_TIER — see
// isPointOnMound/renderMound's own early-returns above, which is what
// leaves this footprint clear). Clicking it opens UI.js's Lab popup (same
// pattern as the Mound's own "Throw money" popup — main.js's click handler
// calls isPointOnScienceLab and, if true, opens that modal instead of
// calling into this file directly), which is where Gene-Splicing is
// actually purchased. This module only owns the hit-test and the render.
export function isPointOnScienceLab(state, worldX, worldY) {
  if (state.level.tier < MOUND_MAX_TIER) return false;
  const left = MOUND_X - MOUND_WIDTH_PX / 2;
  const right = MOUND_X + MOUND_WIDTH_PX / 2;
  const top = SEABED_FLOOR_Y - MOUND_HEIGHT_PX;
  const bottom = SEABED_FLOOR_Y + TILE_SIZE;
  return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
}

export function renderScienceLab(ctx, state) {
  if (state.level.tier < MOUND_MAX_TIER) return;
  const { camera } = state;
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX, camera);
  const w = MOUND_WIDTH_PX * camera.zoom;
  const h = (MOUND_HEIGHT_PX + TILE_SIZE) * camera.zoom;
  const cx = topLeft.x + w / 2;

  // A small rounded structure with a glowing dome — reads as "lab," not
  // "dirt mound," at a glance, sitting on the same rubble base the Mound
  // left behind so the transition doesn't feel like a random prop swap.
  ctx.fillStyle = '#5a5a6e';
  ctx.fillRect(topLeft.x + w * 0.1, topLeft.y + h * 0.55, w * 0.8, h * 0.45);

  ctx.fillStyle = '#7ad4e8';
  ctx.beginPath();
  ctx.arc(cx, topLeft.y + h * 0.55, w * 0.32, Math.PI, 0);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#e8fbff';
  ctx.beginPath();
  ctx.arc(cx, topLeft.y + h * 0.55, w * 0.32, Math.PI * 1.15, Math.PI * 1.75);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(122, 212, 232, 0.6)';
  ctx.lineWidth = Math.max(1, 2 * camera.zoom);
  ctx.strokeRect(topLeft.x + w * 0.1, topLeft.y + h * 0.55, w * 0.8, h * 0.45);

  // Shimmer, clipped to the Lab's own silhouette (the base rect plus the
  // dome's upper half-circle, traced as one path) so the sweep can't paint
  // into the empty water above/around it.
  const baseY = topLeft.y + h * 0.55;
  const domeRadius = w * 0.32;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, baseY, domeRadius, Math.PI, 0);
  ctx.lineTo(topLeft.x + w * 0.9, topLeft.y + h);
  ctx.lineTo(topLeft.x + w * 0.1, topLeft.y + h);
  ctx.closePath();
  ctx.clip();
  drawShimmerSweep(ctx, updateShimmerTimer(labShimmer, state.level.elapsed), topLeft.x, topLeft.y, w, h);
  ctx.restore();
}
