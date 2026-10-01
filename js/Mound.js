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
  TILE_STORAGE_CHEST,
  TILE_REFINERY,
  SCIENCE_LAB_UPGRADES,
} from './Config.js';
import { worldToScreen } from './Engine.js';
import { createShimmerTimer, updateShimmerTimer, drawShimmerSweep, UI_SHEEN_SWEEP_DURATION_MS } from './Shimmer.js';
import { pushGameNotification } from './Notifications.js';
import { playUpgrade } from './Sound.js';
import { bakeMoundSprite, bakeLabSprite, traceMoundPath } from './SeabedArt.js';

const MOUND_WIDTH_PX = MOUND_WIDTH_TILES * TILE_SIZE;
export const MOUND_X = WORLD_W / 2; // world-space center, fixed for the life of the level
// Per direct request ("move science lab down so it's on the floor of the
// upper tank, and none of it is in the city part of the tank") — the Lab
// used to sit at the exact same footprint the Mound occupied (see
// isPointOnScienceLab/renderScienceLab below), which put its own base 1 tile
// INTO the seabed/city build area, overlapping the same buildable rows a
// player's factory lives in. A LATER pass then over-corrected to a 3-tile
// lift, floating it 2 tiles clear of the floor — this pulls it back down to
// exactly 1 tile, which cancels out precisely the 1 tile it used to sink
// into the city (see the bottom-edge math in isPointOnScienceLab/
// renderScienceLab below: bottom = SEABED_FLOOR_Y + TILE_SIZE - LIFT_PX),
// landing its base flush ON the floor line — resting on the upper tank's
// floor, zero pixels into the city, instead of hovering above it.
const SCIENCE_LAB_LIFT_PX = TILE_SIZE;
// Per direct request ("make the mound also sit at the bottom of the upper
// tank, the same as the science lab") — the Mound itself gets the exact same
// 1-tile lift the Science Lab already has (see the comment above), for the
// exact same reason: its base used to sink 1 tile INTO the buildable seabed/
// city rows (bottom = SEABED_FLOOR_Y + TILE_SIZE below), same as the Lab did
// before its own fix. Kept as a separate constant from SCIENCE_LAB_LIFT_PX
// (even though the value's identical) since they're conceptually two
// different objects that just happen to want the same lift.
const MOUND_LIFT_PX = TILE_SIZE;

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

// The Tier 1.5 "tease" ($75, MOUND_TEASE_COST) — per direct request ("no more
// trick mound upgrades, they all should unlock something"), it grants the
// Tier 1 Storage Chest and, per a later direct request, the Solar Refinery
// (the base Refinery tier — it uses no electricity, so it works from the very
// start). The Rudimentary Fan is still granted from level start
// (BUILDING_TYPES[TILE_FAN_T2].unlockedByDefault, alongside Platform/Waste
// Turret — see Config.js), so there's no separate paid "Tier 1.75" step for
// it. The Chest's guided tutorial no longer starts from here — see Systems.js's
// updateChestTutorialTrigger.
const MOUND_TEASE_MESSAGE = "The mound cracks! A Storage Chest and a Solar Refinery tumble out — check the Shop. The Refinery runs on sunlight, so try refining some Bio-Sludge into Biomass for turret ammo!";

// Per direct request, the Mound is a short on-ramp now, not the game's
// whole arc — it only ever grants the Solar Refinery and Storage Chest ($75),
// then the Collector and Electric Eel ($500), before shattering outright at
// MOUND_MAX_TIER (3) into the Science Lab, where the REAL progression
// (Suckerfish, Science Octopus, every Advanced/Bio building) lives from then
// on. See SCIENCE_LAB_UPGRADES in Config.js.
const TIER_CRACK_MESSAGES = {
  2: 'Another crack spreads wider. A Collector tumbles out, closely followed by an Electric Eel that looks personally offended by the mess.',
  3: 'The mound stops cracking and just gives up, shattering completely. Underneath: a Science Lab that has apparently been there the whole time, humming with unfinished research. Everything from here on out is going to cost Science.',
};

// A thin wrapper around Notifications.js's own pushGameNotification — the
// one real, shared implementation of the push+cap+dedupe+timestamp logic
// (see that file's own comment) — kept as a same-named local helper per
// CLAUDE.md's Rolling Notification Log convention.
function pushNotification(state, text) {
  pushGameNotification(state, text);
}

// Two steps sit across the first real tier, per direct request (the old
// paid "Tier 1.75" Fan-unlock sub-step is gone entirely — the Rudimentary
// Fan is free from level start now, see Config.js's BUILDING_TYPES):
// (1) the Tier 1.5 "tease" (MOUND_TEASE_COST, grants the Storage Chest and
// Solar Refinery), then (2) the real Tier 1->2 crack (MOUND_CRACK_COST[1],
// grants the Collector + Electric Eel). The real Tier 2->3 crack
// (MOUND_CRACK_COST[2]) follows directly after that.
export function getMoundNextCost(state) {
  const tier = state.level.tier;
  if (tier === 1 && !state.level.moundTeased) return MOUND_TEASE_COST;
  return MOUND_CRACK_COST[tier];
}

// How cracked the dome looks, per direct request: 0 = intact, 1 = the first
// crack (the $75 tease purchase), 2 = that crack grown into a much bigger one
// (the $500 Tier 1->2 purchase). The final $1500 purchase shatters it
// outright instead (see startMoundShatter).
function getMoundCrackStage(state) {
  if (state.level.tier >= 2) return 2;
  return state.level.moundTeased ? 1 : 0;
}

export function canCrackMound(state) {
  if (state.level.tier >= MOUND_MAX_TIER) return false;
  return state.level.money >= getMoundNextCost(state);
}

// Per direct request ("if the player has 2 times the amount of money/
// science needed for the mound tier/science node upgrade, have the mound/
// science lab pulse slowly") — a simple "you've got plenty banked, go spend
// it" signal. Mound has one obvious "next" cost (getMoundNextCost); read by
// renderMound below.
function shouldPulseMound(state) {
  if (state.level.tier >= MOUND_MAX_TIER) return false;
  return state.level.money >= getMoundNextCost(state) * 2;
}

// The Science Lab has no single "next" cost — its tree can have several
// nodes purchasable at once (prerequisites met, not yet bought) — so this
// pulses the instant ANY of them would cost the player at most half of what
// they currently have (in BOTH Science and Gold, since every node charges
// both — see labNodeHasEnoughScience's own comment in UI.js for the
// scienceCost:0 "gold-only" case this mirrors). Duplicated from that same
// "has enough" shape rather than imported — UI.js already imports FROM this
// file (openMoundMenu/openLabMenu's own hit-tests), so the reverse import
// isn't available; this only needs the two plain state/data reads, not any
// of UI.js's own DOM-touching logic.
function shouldPulseScienceLab(state) {
  if (state.level.tier < MOUND_MAX_TIER) return false;
  for (const node of Object.values(SCIENCE_LAB_UPGRADES)) {
    if (state.meta.labUpgradesPurchased.includes(node.id)) continue;
    if (!node.requires.every((r) => state.meta.labUpgradesPurchased.includes(r))) continue;
    const scienceOk = node.scienceCost === 0 || state.level.science >= node.scienceCost * 2;
    const goldOk = state.level.money >= node.goldCost * 2;
    if (scienceOk && goldOk) return true;
  }
  return false;
}

// How slowly the glow breathes in/out — per direct request ("pulse
// slowly"), noticeably gentler than the ~1.1s one-shot shimmer sweep above.
const PULSE_PERIOD_MS = 2600;
// A soft glow drawn BEHIND the Mound/Lab's own shape (called before either
// function's real fill below) rather than a scale-transform of the existing
// geometry — the Mound's own render already nests a clip + a translated
// double-stroke per crack, and scaling all of that risked subtly misaligning
// the crack/branch math against the (unscaled) dome silhouette clip. A
// pulsing aura behind it reads just as clearly as "this wants attention"
// without touching any of that.
function drawPulseGlow(ctx, cx, cy, w, h, elapsedMs) {
  const pulse = 0.5 + 0.5 * Math.sin((elapsedMs / PULSE_PERIOD_MS) * Math.PI * 2);
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.16 * pulse;
  ctx.fillStyle = '#ffd76b';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (w / 2) * (1.08 + 0.08 * pulse), (h / 2) * (1.08 + 0.08 * pulse), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function crackMound(state) {
  if (!canCrackMound(state)) return false;
  const cost = getMoundNextCost(state);
  state.level.money -= cost;
  // Per direct request ("add a purchase sound effect when you buy a mound
  // upgrade") — same playUpgrade() the Tank Upgrades panel's own cards
  // already use, covering both branches below (the tease sub-step and a
  // real tier crack) since both are real money spent progressing the Mound.
  playUpgrade();

  if (state.level.tier === 1 && !state.level.moundTeased) {
    state.level.moundTeased = true;
    // Tier itself still does NOT advance — this remains a sub-step within
    // Tier 1, not a real crack. The dome still gets its first visible crack
    // (see getMoundCrackStage), per direct request.
    for (const id of [TILE_STORAGE_CHEST, TILE_REFINERY]) {
      if (!state.meta.buildingsUnlocked.includes(id)) state.meta.buildingsUnlocked.push(id);
    }
    pushNotification(state, MOUND_TEASE_MESSAGE);
    return true;
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

  if (state.level.tier >= MOUND_MAX_TIER) startMoundShatter(state);
  pushNotification(state, TIER_CRACK_MESSAGES[state.level.tier] || `Tier ${state.level.tier} reached.`);
  return true;
}

// Simple bounding-box hit-test around the Mound's footprint, centered at
// MOUND_X and sitting on the seabed surface.
export function isPointOnMound(state, worldX, worldY) {
  if (state.level.tier >= MOUND_MAX_TIER) return false; // fully shattered — nothing left to click (Science Lab click target is Phase 4)
  const left = MOUND_X - MOUND_WIDTH_PX / 2;
  const right = MOUND_X + MOUND_WIDTH_PX / 2;
  const top = SEABED_FLOOR_Y - MOUND_HEIGHT_PX - MOUND_LIFT_PX;
  const bottom = SEABED_FLOOR_Y + TILE_SIZE - MOUND_LIFT_PX;
  return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
}

// The Mound's body is a one-off baked sprite in the seabed boulders' own lit
// style (see SeabedArt.js's bakeMoundSprite), per direct request ("looks more
// like the boulders on the seafloor, without the copy and paste texture") —
// replaces the old 32px speckle tile that repeated across the dome. Baked
// lazily on the first render since it needs a canvas.
let moundSprite = null;
let labSprite = null; // the Science Lab's equivalent, see renderScienceLab

// ---- Cracks ----
// Per direct request, the $75 purchase shows the first crack (the one that
// used to appear at $500) and the $500 purchase grows a much bigger one out of
// it. Geometry lives in unzoomed dome-local px (origin = the dome's top-left,
// the same frame as the sprite's outline points), generated once at module
// load — a fresh Math.random() every frame would make the cracks visibly
// jitter. Drawn live inside the dome-silhouette clip (renderMound) rather than
// baked into the sprite, so a growth animation can reveal them progressively.
const CRACK_W = MOUND_WIDTH_PX;
const CRACK_H = MOUND_HEIGHT_PX + TILE_SIZE;
const CRACK_GROW_MS = 1400; // how long a crack takes to grow after the purchase

// A jagged polyline from (x0,y0) to (x1,y1): segs segments with each interior
// point jittered sideways by up to +-jit px.
function jaggedPath(x0, y0, x1, y1, segs, jit) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < segs; i++) {
    const j = (Math.random() - 0.5) * 2 * jit;
    pts.push({ x: x0 + dx * (i / segs) + nx * j, y: y0 + dy * (i / segs) + ny * j });
  }
  pts.push({ x: x1, y: y1 });
  return pts;
}

// Crack 1 (stage 1): a vertical fracture down the middle with a short fork.
const CRACK_MAIN = jaggedPath(CRACK_W * 0.5, CRACK_H * 0.12, CRACK_W * 0.5, CRACK_H * 0.88, 6, 5);
const CRACK_FORK_DIR = Math.random() < 0.5 ? -1 : 1;
const CRACK_FORK = jaggedPath(CRACK_MAIN[3].x, CRACK_MAIN[3].y, CRACK_MAIN[3].x + CRACK_FORK_DIR * CRACK_W * 0.12, CRACK_MAIN[3].y + CRACK_H * 0.16, 3, 2);

// Stage 2: limbs that grow out of crack 1 — t0/t1 are when each starts/finishes
// within the growth animation (0..1), so they spread outward in sequence.
function crackLimb(from, toX, toY, segs, jit, t0, t1) {
  return { pts: jaggedPath(from.x, from.y, toX, toY, segs, jit), t0, t1 };
}
const CRACK_LIMBS = [
  crackLimb(CRACK_MAIN[0], CRACK_W * 0.44, -CRACK_H * 0.05, 2, 3, 0.0, 0.25), // out through the top of the dome
  crackLimb(CRACK_MAIN[6], CRACK_W * 0.56, CRACK_H * 1.03, 2, 3, 0.0, 0.25), // down into the base
  crackLimb(CRACK_MAIN[2], CRACK_W * 0.05, CRACK_H * 0.46, 6, 5, 0.1, 0.65),
  crackLimb(CRACK_MAIN[3], CRACK_W * 0.96, CRACK_H * 0.54, 6, 5, 0.15, 0.7),
  crackLimb(CRACK_MAIN[4], CRACK_W * 0.16, CRACK_H * 0.97, 5, 4, 0.3, 0.85),
  crackLimb(CRACK_MAIN[1], CRACK_W * 0.84, CRACK_H * 0.14, 5, 4, 0.35, 0.9),
];
for (const limb of CRACK_LIMBS.slice(2)) { // a small fork off the middle of each side limb
  const mid = limb.pts[Math.floor(limb.pts.length / 2)];
  const dir = Math.random() < 0.5 ? -1 : 1;
  CRACK_LIMBS.push(crackLimb(mid, mid.x + dir * CRACK_W * 0.09, mid.y + CRACK_H * 0.14, 3, 2, limb.t0 + (limb.t1 - limb.t0) * 0.5, Math.min(1, limb.t1 + 0.1)));
}

// Appends the first `p` (0-1) of a polyline's length to the current path.
function pathPolylineProgress(ctx, pts, ox, oy, k, p) {
  if (p <= 0) return;
  const n = pts.length - 1;
  const upto = p * n;
  ctx.moveTo(ox + pts[0].x * k, oy + pts[0].y * k);
  for (let i = 1; i <= n; i++) {
    if (upto >= i) {
      ctx.lineTo(ox + pts[i].x * k, oy + pts[i].y * k);
    } else {
      const f = upto - (i - 1);
      if (f > 0) ctx.lineTo(ox + (pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f) * k, oy + (pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f) * k);
      break;
    }
  }
}

// Draws the cracks for `stage` onto ctx, which must already be clipped to the
// dome silhouette. (ox, oy) is the dome's top-left on ctx and k its scale
// (the camera zoom on screen, or the sprite's bake scale offscreen). p1/p2
// (0-1) are how far crack 1 / the stage-2 growth have grown. Each pass batches
// its polylines into one path, so this is a handful of stroke calls total.
// Each crack is a dark fracture line with a thin offset highlight alongside
// for a carved/engraved look instead of a flat scribble.
function drawMoundCracks(ctx, ox, oy, k, stage, p1, p2) {
  if (stage < 1) return;
  const widen = stage >= 2 ? p2 : 0; // crack 1 itself gets fatter as the big crack grows out of it
  const strokeGroup = (lines, width, core) => {
    const trace = () => {
      ctx.beginPath();
      for (const line of lines) pathPolylineProgress(ctx, line.pts, ox, oy, k, line.p);
    };
    ctx.strokeStyle = 'rgba(255, 244, 224, 0.35)';
    ctx.lineWidth = Math.max(1, width * 0.75);
    ctx.save();
    ctx.translate(k, k);
    trace();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#4a3c2c';
    ctx.lineWidth = Math.max(1, width);
    trace();
    ctx.stroke();
    if (core) { // the bigger crack reads as a real gap, not just a line
      ctx.strokeStyle = '#1f1810';
      ctx.lineWidth = Math.max(1, width * 0.4);
      trace();
      ctx.stroke();
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const forkP = stage >= 2 ? 1 : Math.max(0, (p1 - 0.45) / 0.55); // the fork starts once the main crack is about halfway down
  strokeGroup(
    [{ pts: CRACK_MAIN, p: stage >= 2 ? 1 : p1 }, { pts: CRACK_FORK, p: forkP }],
    (2 + 1.8 * widen) * k,
    widen > 0.3
  );
  if (stage >= 2) {
    strokeGroup(
      CRACK_LIMBS.map((limb) => ({ pts: limb.pts, p: Math.max(0, Math.min(1, (p2 - limb.t0) / (limb.t1 - limb.t0))) })),
      2 * k,
      false
    );
  }
}

// What stage the dome was last drawn at, and when it last stepped up — so a
// purchase plays the crack-growth animation, while a freshly loaded/restarted
// level (first render, or a stage going backwards) just shows its cracks as-is.
let crackStageDrawn = null;
let crackGrowFromStage = 0;
let crackGrowStartMs = -Infinity;

// Per direct request ("slightly change the visuals of the mound so it stands
// out as a clearly interactable object") — a softly pulsing gold rim along the
// dome plus a small gold arrow bobbing above it. The arrow is baked once; the
// rim is one polyline of the sprite's own outline arc, so this adds a couple
// of draw calls per frame and nothing else.
const RIM_PERIOD_MS = 2400;
const ARROW_BOB_PERIOD_MS = 900;
let moundArrowSprite = null;
function bakeMoundArrow() {
  const size = 36;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  c.beginPath();
  c.moveTo(size * 0.12, size * 0.2);
  c.lineTo(size * 0.88, size * 0.2);
  c.lineTo(size * 0.5, size * 0.84);
  c.closePath();
  c.fillStyle = '#ffd76b';
  c.fill();
  c.lineJoin = 'round';
  c.lineWidth = 3;
  c.strokeStyle = '#8a5a14';
  c.stroke();
  return canvas;
}
function drawMoundInteractCue(ctx, state, topLeft, w) {
  const { camera } = state;
  const zoom = camera.zoom;
  const t = state.level.elapsed;
  const pulse = 0.5 + 0.5 * Math.sin((t / RIM_PERIOD_MS) * Math.PI * 2);
  const outline = moundSprite.outline;
  const arcEnd = outline.length - 2; // the last two points are the base corners dipping under the floor — not part of the visible arc
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffd76b';
  ctx.beginPath();
  for (let i = 0; i < arcEnd; i++) {
    const x = topLeft.x + outline[i].x * zoom;
    const y = topLeft.y + outline[i].y * zoom;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.globalAlpha = 0.1 + 0.1 * pulse;
  ctx.lineWidth = 7 * zoom;
  ctx.stroke();
  ctx.globalAlpha = 0.4 + 0.3 * pulse;
  ctx.lineWidth = Math.max(1, 1.6 * zoom);
  ctx.stroke();
  ctx.restore();

  if (!moundArrowSprite) moundArrowSprite = bakeMoundArrow();
  const arrowSize = 22 * zoom;
  const bob = Math.sin((t / ARROW_BOB_PERIOD_MS) * Math.PI * 2) * 4 * zoom;
  ctx.drawImage(moundArrowSprite, topLeft.x + w / 2 - arrowSize / 2, topLeft.y - arrowSize - 6 * zoom + bob, arrowSize, arrowSize);
}

export function renderMound(ctx, state) {
  if (state.level.tier >= MOUND_MAX_TIER) return; // shattered — nothing to draw (the shatter pieces and the Science Lab render in renderScienceLab)
  shatter = null; // a level restarted back below the shatter tier
  const { camera } = state;
  const stage = getMoundCrackStage(state);
  if (stage !== crackStageDrawn) {
    const stepped = crackStageDrawn !== null && stage > crackStageDrawn;
    crackGrowFromStage = stepped ? crackStageDrawn : stage;
    crackGrowStartMs = stepped ? state.level.elapsed : -Infinity;
    crackStageDrawn = stage;
  }
  const grow = Math.max(0, Math.min(1, (state.level.elapsed - crackGrowStartMs) / CRACK_GROW_MS));
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX - MOUND_LIFT_PX, camera);
  const w = MOUND_WIDTH_PX * camera.zoom;
  const h = (MOUND_HEIGHT_PX + TILE_SIZE) * camera.zoom;

  if (shouldPulseMound(state)) drawPulseGlow(ctx, topLeft.x + w / 2, topLeft.y + h / 2, w, h, state.level.elapsed);

  if (!moundSprite) moundSprite = bakeMoundSprite(MOUND_WIDTH_PX, MOUND_HEIGHT_PX + TILE_SIZE);
  const z = camera.zoom / moundSprite.scale;
  ctx.drawImage(moundSprite.canvas, topLeft.x - moundSprite.pad * camera.zoom, topLeft.y - moundSprite.pad * camera.zoom, moundSprite.canvas.width * z, moundSprite.canvas.height * z);
  drawMoundInteractCue(ctx, state, topLeft, w);

  ctx.save();
  // Constrains EVERYTHING drawn until ctx.restore() below (the crack
  // strokes and the shimmer) to the dome's own silhouette — the same outline
  // the sprite above was baked from — so a limb's jittered endpoint can't
  // poke through the dome's edge into the water above it.
  traceMoundPath(ctx, moundSprite.outline, topLeft.x, topLeft.y, camera.zoom);
  ctx.clip();

  drawMoundCracks(
    ctx, topLeft.x, topLeft.y, camera.zoom, stage,
    crackGrowFromStage < 1 ? grow : 1, // crack 1 grows in only if it's the one that just appeared
    crackGrowFromStage < 2 ? grow : 1
  );
  // Drawn last, still inside the dome-silhouette clip, so the sweep never
  // paints outside the Mound's own shape. Per direct request, tuned to match
  // the DOM ".sheen-target" UI-button sweep specifically (1.1s duration,
  // eased timing, a brighter 0.7 peak vs. the generic 0.55 every other
  // shimmer caller — Science Lab, fish — still uses).
  drawShimmerSweep(
    ctx,
    updateShimmerTimer(moundShimmer, state.level.elapsed, UI_SHEEN_SWEEP_DURATION_MS),
    topLeft.x, topLeft.y, w, h,
    { peakAlpha: 0.7, ease: true }
  );
  ctx.restore(); // lifts the dome-silhouette clip set above, now that every crack and the shimmer have been drawn through it
}

// ---- Shatter (the final $1500 purchase) ----
// Per direct request, the last purchase shatters the Mound into pieces that fly
// off and fade away, revealing the Science Lab. The tier flips to 3 in
// crackMound at once (the Lab is already there, and clickable, underneath); this
// is purely a cosmetic overlay drawn on top of it by renderScienceLab.
// The pieces are baked ONCE here, on the purchase: the fully-cracked dome is
// composited, then cut into Voronoi-style shards (each a small canvas), so
// every frame afterwards is just one transformed drawImage per piece for
// SHATTER_DURATION_MS — no clipping, path work or allocation while it plays.
const SHATTER_DURATION_MS = 1500;
const SHATTER_PIECE_COLS = 5;
const SHATTER_PIECE_ROWS = 3;
const SHATTER_GRAVITY = 200; // px/s^2
const SHATTER_FADE_START = 0.3; // fraction of the duration the pieces hold fully opaque before fading
let shatter = null; // { startMs, pieces } while playing, else null

// Sutherland-Hodgman clip of a convex polygon to the half-plane nx*x + ny*y <= d.
function clipPolygonHalfPlane(poly, nx, ny, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = nx * a.x + ny * a.y - d;
    const db = nx * b.x + ny * b.y - d;
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

function startMoundShatter(state) {
  if (!moundSprite) moundSprite = bakeMoundSprite(MOUND_WIDTH_PX, MOUND_HEIGHT_PX + TILE_SIZE);
  const { canvas, scale, pad, outline } = moundSprite;
  // The dome as it looked right before breaking — sprite plus its biggest crack.
  const full = document.createElement('canvas');
  full.width = canvas.width;
  full.height = canvas.height;
  const fctx = full.getContext('2d');
  fctx.drawImage(canvas, 0, 0);
  fctx.save();
  traceMoundPath(fctx, outline, pad * scale, pad * scale, scale);
  fctx.clip();
  drawMoundCracks(fctx, pad * scale, pad * scale, scale, 2, 1, 1);
  fctx.restore();

  const seeds = [];
  for (let r = 0; r < SHATTER_PIECE_ROWS; r++) {
    for (let c = 0; c < SHATTER_PIECE_COLS; c++) {
      seeds.push({
        x: CRACK_W * ((c + 0.2 + Math.random() * 0.6) / SHATTER_PIECE_COLS),
        y: CRACK_H * ((r + 0.2 + Math.random() * 0.6) / SHATTER_PIECE_ROWS),
      });
    }
  }
  const pieces = [];
  for (const seed of seeds) {
    // This seed's Voronoi cell: the sprite's bounds clipped by the perpendicular bisector against every other seed.
    let poly = [{ x: -pad, y: -pad }, { x: CRACK_W + pad, y: -pad }, { x: CRACK_W + pad, y: CRACK_H + pad + 8 }, { x: -pad, y: CRACK_H + pad + 8 }];
    for (const other of seeds) {
      if (other === seed) continue;
      poly = clipPolygonHalfPlane(poly, other.x - seed.x, other.y - seed.y, (other.x * other.x + other.y * other.y - seed.x * seed.x - seed.y * seed.y) / 2);
    }
    if (poly.length < 3) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cx = 0, cy = 0;
    for (const p of poly) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      cx += p.x / poly.length; cy += p.y / poly.length;
    }
    const pc = document.createElement('canvas');
    pc.width = Math.max(1, Math.ceil((maxX - minX) * scale));
    pc.height = Math.max(1, Math.ceil((maxY - minY) * scale));
    const pctx = pc.getContext('2d');
    pctx.beginPath();
    poly.forEach((p, i) => {
      if (i === 0) pctx.moveTo((p.x - minX) * scale, (p.y - minY) * scale);
      else pctx.lineTo((p.x - minX) * scale, (p.y - minY) * scale);
    });
    pctx.closePath();
    pctx.clip();
    pctx.drawImage(full, -(minX + pad) * scale, -(minY + pad) * scale);
    // Flies outward from the dome's base-center and kicks upward.
    const dx = cx - CRACK_W / 2;
    const dy = cy - CRACK_H * 0.9;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 50 + Math.random() * 90;
    pieces.push({
      canvas: pc, minX, minY, w: maxX - minX, h: maxY - minY, cx, cy,
      vx: (dx / dist) * speed + (Math.random() - 0.5) * 30,
      vy: (dy / dist) * speed * 0.6 - (60 + Math.random() * 110),
      spin: (Math.random() - 0.5) * 7, // rad/s
      delayMs: Math.random() * 120,
    });
  }
  shatter = { startMs: state.level.elapsed, pieces };
}

function renderMoundShatter(ctx, state, topLeft) {
  const t = state.level.elapsed - shatter.startMs;
  if (t < 0 || t >= SHATTER_DURATION_MS + 150) { shatter = null; return; } // finished — or the level restarted under it
  const zoom = state.camera.zoom;
  for (const piece of shatter.pieces) {
    const pt = Math.max(0, t - piece.delayMs) / 1000;
    const u = Math.max(0, Math.min(1, (t - piece.delayMs) / SHATTER_DURATION_MS));
    const alpha = u < SHATTER_FADE_START ? 1 : 1 - (u - SHATTER_FADE_START) / (1 - SHATTER_FADE_START);
    if (alpha <= 0) continue;
    const px = topLeft.x + (piece.cx + piece.vx * pt) * zoom;
    const py = topLeft.y + (piece.cy + piece.vy * pt + 0.5 * SHATTER_GRAVITY * pt * pt) * zoom;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(px, py);
    ctx.rotate(piece.spin * pt);
    ctx.drawImage(piece.canvas, (piece.minX - piece.cx) * zoom, (piece.minY - piece.cy) * zoom, piece.w * zoom, piece.h * zoom);
    ctx.restore();
  }
}

// ---- Science Lab (Phase 4) ----
// Shares the Mound's horizontal (X) position, revealed the instant the Mound
// shatters (state.level.tier >= MOUND_MAX_TIER — see isPointOnMound/
// renderMound's own early-returns above, which is what leaves the Mound's
// own footprint clear). Vertically it sits SCIENCE_LAB_LIFT_PX (1 tile)
// higher than the Mound ever did, resting flush on SEABED_FLOOR_Y — the
// floor of the upper (water) tank — with zero pixels into the buildable
// seabed rows below it, per direct request. Clicking it opens UI.js's
// Lab popup (same pattern as the Mound's own "Throw money" popup — main.js's
// click handler calls isPointOnScienceLab and, if true, opens that modal
// instead of calling into this file directly), which is where Gene-Splicing
// is actually purchased. This module only owns the hit-test and the render.
export function isPointOnScienceLab(state, worldX, worldY) {
  if (state.level.tier < MOUND_MAX_TIER) return false;
  const left = MOUND_X - MOUND_WIDTH_PX / 2;
  const right = MOUND_X + MOUND_WIDTH_PX / 2;
  const top = SEABED_FLOOR_Y - MOUND_HEIGHT_PX - SCIENCE_LAB_LIFT_PX;
  const bottom = SEABED_FLOOR_Y + TILE_SIZE - SCIENCE_LAB_LIFT_PX;
  return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
}

// Just the Mound's (or, once it shatters, the Science Lab's) sprite, no glow/
// shimmer/cracks — the mask main.js uses to restrict fish shadows to seafloor
// objects, which counts these two too. Their shimmer timers are deliberately
// not touched here, since they're advanced by the real render calls.
export function renderMoundMask(ctx, state) {
  const { camera } = state;
  const lab = state.level.tier >= MOUND_MAX_TIER;
  if (lab ? !labSprite : !moundSprite) return; // not baked yet — the real render bakes it on its first frame
  const sp = lab ? labSprite : moundSprite;
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX - (lab ? SCIENCE_LAB_LIFT_PX : MOUND_LIFT_PX), camera);
  const z = camera.zoom / sp.scale;
  ctx.drawImage(sp.canvas, topLeft.x - sp.pad * camera.zoom, topLeft.y - sp.pad * camera.zoom, sp.canvas.width * z, sp.canvas.height * z);
}

export function renderScienceLab(ctx, state) {
  if (state.level.tier < MOUND_MAX_TIER) return;
  const { camera } = state;
  const topLeft = worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX - SCIENCE_LAB_LIFT_PX, camera);
  const w = MOUND_WIDTH_PX * camera.zoom;
  const h = (MOUND_HEIGHT_PX + TILE_SIZE) * camera.zoom;
  const cx = topLeft.x + w / 2;

  if (shouldPulseScienceLab(state)) drawPulseGlow(ctx, cx, topLeft.y + h / 2, w, h, state.level.elapsed);

  // Same rubble-base-to-lab visual language the Mound uses, now as a baked
  // sprite in the boulders' own lit/rimmed style (SeabedArt.js's
  // bakeLabSprite), per direct request — a steel base with a door/portholes
  // under a glass dome holding a flask, so it still reads as "lab," not "dirt
  // mound," at a glance. Same footprint as before.
  if (!labSprite) labSprite = bakeLabSprite(MOUND_WIDTH_PX, MOUND_HEIGHT_PX + TILE_SIZE);
  const z = camera.zoom / labSprite.scale;
  ctx.drawImage(labSprite.canvas, topLeft.x - labSprite.pad * camera.zoom, topLeft.y - labSprite.pad * camera.zoom, labSprite.canvas.width * z, labSprite.canvas.height * z);

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

  // The shattering Mound's pieces, over the Lab they're revealing — see startMoundShatter. The Mound sat 1 tile lower than the Lab does, hence the different anchor.
  if (shatter) renderMoundShatter(ctx, state, worldToScreen(MOUND_X - MOUND_WIDTH_PX / 2, SEABED_FLOOR_Y - MOUND_HEIGHT_PX - MOUND_LIFT_PX, camera));
}
