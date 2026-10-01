// Ambience.js — purely decorative background elements: bubbles rising
// through the water column, seaweed swaying near the seabed floor, and a
// handful of other static/roaming scenery. No gameplay effect whatsoever and
// nothing here ever touches state.level — ticked every frame from main.js's
// update()/render() the same as real sim entities are, just entirely
// self-contained, module-local cosmetic state that nothing outside this file
// ever reads.
// Forbidden: no gameplay logic, no reading/writing state.level.
//
// ---- Depth layering ----
// Per direct request ("coral, urchins, and crabs can walk/spawn in front of
// the science lab but seaweed and boulders can't... crabs in front of some
// background objects but behind a few... sun rays in front of some
// seaweed/boulders/coral/urchins and in front of all the shadow fish") —
// every piece of scenery below carries a numeric `depth` (bigger = closer to
// camera) instead of a fixed draw order. main.js's Science Lab render call
// sits at a fixed point, LAB_DEPTH_THRESHOLD, in that same scale — anything
// below it (boulders/seaweed/kelp, always 15-35) draws before the Lab,
// anything at/above it (coral/urchins, always 45-65) draws after. Sun rays
// (20-60) straddle both bands, so individual rays naturally end up in front
// of some scenery instances and behind others; crabs (mostly 55-75, a
// quarter 44-54) stay always above the Lab's own 40 but mix into the
// coral/urchin band so a few sit behind some of it. Shadow fish (0-10) sit
// below everything, so they're always behind every sun ray. main.js calls
// renderAmbienceBehindLab, then renderScienceLab, then renderAmbienceFrontLab
// — see the job-list construction near the bottom of this file.
import { WORLD_W, SEABED_FLOOR_Y } from './Config.js';
import { worldToScreen } from './Engine.js';
import { bakeBoulderSprite, bakeSandCastleSprite, bakeCoralBaseSprite } from './SeabedArt.js';

let elapsed = 0; // seconds, drives every sway/wobble phase below

const LAB_DEPTH_THRESHOLD = 40;

// ---- Bubbles ----
// A fixed pool that recycles in place rather than growing/shrinking arrays
// every frame — each bubble rises from somewhere near the seabed floor up
// past the top of the water column, wobbling side to side as it goes, then
// respawns lower down once it's off the top.
// Scaled down from 45 by the same ~0.375 ratio WORLD_W itself shrank by
// (5120px -> 1920px, per direct request to fit the tank to one screen
// width) — keeps bubbles-per-px-of-width the same as before, rather than
// cramming the original count into a much narrower column and reading
// 2.67x busier than intended.
const BUBBLE_COUNT = 15; // increased back from 11 per direct request
// Per direct request, a bubble grows to full size over this many seconds
// after it spawns, instead of just appearing at full size — `age` (seconds
// since spawn) drives the scale in renderBubbles below.
const BUBBLE_GROW_DURATION_S = 3;
function randomBubble() {
  return {
    x: Math.random() * WORLD_W,
    y: SEABED_FLOOR_Y - Math.random() * 60, // starts near the floor, biased to just above it — "from the back of the tank"
    radius: 2 + Math.random() * 5,
    speed: 16 + Math.random() * 26,
    wobbleFreq: 0.5 + Math.random() * 1.1,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 4 + Math.random() * 9,
    age: 0,
  };
}
const bubbles = [];
for (let i = 0; i < BUBBLE_COUNT; i++) {
  const b = randomBubble();
  b.y = Math.random() * SEABED_FLOOR_Y; // scattered through the column on first load, not all lined up at the floor
  b.age = BUBBLE_GROW_DURATION_S; // already fully grown on page load — only bubbles recycled AFTER that play the grow-in
  bubbles.push(b);
}

// ---- Seaweed ----
// A handful of fixed strands anchored along the seabed floor line, each
// swaying independently via a simple sine bend on a quadratic curve's
// control point. Rendered blurred and low-opacity so it reads as soft
// background texture, never something the player mistakes for an obstacle
// or a real building. Always behind the Science Lab (depth 15-35, below
// LAB_DEPTH_THRESHOLD) — see this file's header comment.
//
// Sizing, per direct request: 3x as many strands as the original pass;
// the smallest a strand can now be is exactly the biggest it used to get
// (the old height range topped out at 130px, old stroke width was a flat
// 5px pre-zoom) — the new range runs from there up to 4x that height and
// 3x that width. Each strand's width tracks its own height (bigger strands
// read as both taller AND thicker, not just stretched), and its blur
// (blurFactor, consumed by drawOneSeaweed's fake-blur below) scales with
// size too: the smallest strands are LESS blurry than the old fixed amount,
// the biggest are only SLIGHTLY more — the old fixed amount (blurFactor 1.0)
// sits deliberately near the top of this new range, not the middle.
// Scaled down from 48 by the same ~0.375 ratio WORLD_W shrank by (5120px ->
// 1920px, per direct request to fit the tank to one screen width) — the new
// per-strand spacing (WORLD_W / SEAWEED_COUNT) lands almost exactly where it
// was before the resize, so density-per-px-of-width is unchanged rather than
// reading far denser crammed into a much narrower column.
const SEAWEED_COUNT = 18; // was 48
const SEAWEED_MIN_HEIGHT = 130; // was the old range's max (55-130)
const SEAWEED_MAX_HEIGHT = 130 * 4;
const SEAWEED_MIN_WIDTH = 5; // was the old fixed stroke width
const SEAWEED_MAX_WIDTH = 5 * 3;
const seaweeds = [];
for (let i = 0; i < SEAWEED_COUNT; i++) {
  const sizeT = Math.random(); // 0 = smallest, 1 = biggest — drives height/width/blur together
  seaweeds.push({
    x: (i + 0.5) * (WORLD_W / SEAWEED_COUNT) + (Math.random() - 0.5) * 90,
    height: SEAWEED_MIN_HEIGHT + (SEAWEED_MAX_HEIGHT - SEAWEED_MIN_HEIGHT) * sizeT,
    width: SEAWEED_MIN_WIDTH + (SEAWEED_MAX_WIDTH - SEAWEED_MIN_WIDTH) * sizeT,
    blurFactor: 0.6 + 0.55 * sizeT, // 0.6x (crisper) at the smallest, 1.15x (slightly blurrier) at the biggest, vs. the old fixed 1.0x
    sway: 16 + Math.random() * 20, // max was 40 (16 + rand*24), cut 10% to 36 per direct request ("10% less max sway amount") — min untouched
    freq: 0.5 + Math.random() * 0.435, // max was 1.1 (0.5 + rand*0.6), cut 15% to 0.935 per direct request ("15% slower max sway speed") — min untouched
    phase: Math.random() * Math.PI * 2,
    hue: 90 + Math.random() * 35,
    depth: 15 + Math.random() * 20, // always < LAB_DEPTH_THRESHOLD — seaweed never draws in front of the Science Lab
  });
}

// ---- Shadow Fish ----
// Blurry fish silhouettes drifting slowly through the open water column —
// per direct request, a purely atmospheric depth cue ("something swimming
// further back in the tank"), never a real gameplay fish; nothing here is
// clickable/feedable/counted anywhere. A fixed pool recycles by simply
// reversing off-screen, same "no growing/shrinking arrays" convention
// BUBBLE_COUNT already established. Always the furthest-back layer (depth
// 0-10) — behind every sun ray and every other piece of scenery, per direct
// request ("in front of all of the shadow silhouette fish").
//
// Per direct request ("remove the transparency from all of them, just have
// the colors and blurriness make it look like the fish shadows are an
// unobtrusive part of the background") — these used to be a dark, low-alpha
// fill (globalCompositeOperation left at default, just a tiny globalAlpha)
// composited over whatever's behind them. Now every fish is drawn fully
// opaque (no globalAlpha at all): SHADOW_FISH_DEEP/FAINT are two flat colors
// already blended most of the way toward the water's own background tone
// (see main.js's WATER_TOP_CLEAN/WATER_BOTTOM_CLEAN for the actual water
// gradient this is approximating), and each fish's own blendT picks a point
// between them — the SAME "soft halo behind a slightly less faint core"
// double-pass drawOneShadowFish already used for the blur illusion, just
// with two opaque colors standing in for the old two alpha levels.
// Shifted closer to the water gradient itself per direct follow-up request
// ("less visually obtrusive, make them closer to the color of the water") —
// main.js's WATER_TOP_CLEAN/WATER_BOTTOM_CLEAN average out around
// rgb(85, 145, 185); DEEP now lands much nearer that (previously a
// noticeably darker, more saturated navy) and FAINT sits almost exactly on
// it, so even the more-visible "core" pass reads as a muted water tone
// rather than a distinct dark shape.
const SHADOW_FISH_DEEP = { r: 58, g: 95, b: 125 };
const SHADOW_FISH_FAINT = { r: 85, g: 140, b: 178 };
function mixRGB(a, b, t) {
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function shadowFishColors(blendT) {
  return {
    fill: mixRGB(SHADOW_FISH_DEEP, SHADOW_FISH_FAINT, blendT),
    halo: mixRGB(SHADOW_FISH_DEEP, SHADOW_FISH_FAINT, Math.min(1, blendT + 0.35)),
  };
}
// Count doubled (5->10) and sizes bumped 10% per direct request ("increase
// the amount of background Shadow fish by 100%... increase the size by 10%
// for the big and small variants"), then bumped again (10->12) per a direct
// follow-up request, then bumped again (12->13, size +10% more) per a
// further direct follow-up request.
const SHADOW_FISH_COUNT = 13;
const SHADOW_FISH_MIN_SIZE = 20 * 1.1 * 1.1;
const SHADOW_FISH_MAX_SIZE = 42 * 1.1 * 1.1;
// Per direct request ("add a few more, even more faint, much bigger fish
// silhouettes in the background") — a second, smaller pool sharing every
// mechanic the regular shadow fish already have (drift, wrap, bob, tail-wag),
// just bigger and blended further toward the faint end of the color range.
// Count doubled (3->6), then bumped again (6->9) per a direct follow-up
// request, then bumped again (9->10, size +10% more) per a further direct
// follow-up request, same as the small variant above.
const SHADOW_FISH_BIG_COUNT = 10;
const SHADOW_FISH_BIG_MIN_SIZE = 70 * 1.1 * 1.1;
const SHADOW_FISH_BIG_MAX_SIZE = 130 * 1.1 * 1.1;

// ---- Shadow Fish fade in/out ----
// Per direct request ("add in 3 independent timers for each fish that are
// random each time... so it looks like they're fading in and out of the
// background"): each fish cycles fadeOut -> hidden -> fadeIn -> visible ->
// fadeOut... forever, with a freshly-rolled random duration for whichever
// phase it's about to enter each time (so no two fish, and no two cycles of
// the same fish, ever line up). Alpha is reintroduced here specifically for
// this effect — the earlier "no transparency" decision (see the Shadow Fish
// section comment above) only ever applied to the OLD static low-alpha
// look; it doesn't reopen the "seaweed doesn't occlude" bug that decision
// was fixing, since shadow fish are still drawn before (behind) the opaque
// seaweed in depth order regardless of their own alpha.
const SHADOW_FISH_FADE_MIN_S = 10;
const SHADOW_FISH_FADE_MAX_S = 20;
const SHADOW_FISH_FADE_HOLD_MIN_S = 3;
const SHADOW_FISH_FADE_HOLD_MAX_S = 10;
// Total size shrink at fully-faded (alpha 0), eased back to full size as
// alpha climbs back to 1 — "as their opacity lowers have their size
// slightly [decrease], a total decrease of 10% size when opacity is 0%."
const SHADOW_FISH_FADE_SIZE_SHRINK = 0.1;
// The 4 phases in cycle order, and which duration range each one rolls —
// used both by the live state machine below and by randomStartingFadeState
// (each fish's own starting point, picked at random so they don't all fade
// out together right as the game starts).
const SHADOW_FISH_FADE_PHASES = ['out', 'hidden', 'in', 'visible'];
function fadeDurationRangeForPhase(phase) {
  return phase === 'out' || phase === 'in'
    ? [SHADOW_FISH_FADE_MIN_S, SHADOW_FISH_FADE_MAX_S]
    : [SHADOW_FISH_FADE_HOLD_MIN_S, SHADOW_FISH_FADE_HOLD_MAX_S];
}
function randomFadeDurationS(minS, maxS) {
  return minS + Math.random() * (maxS - minS);
}
// Per direct request ("at the start of the game, have the fish start one of
// the 4 timers instead of all starting at the same timer so they all fade
// off the screen at the same time at the beginning") — picks a random phase
// AND a random progress within that phase's duration, so fish start spread
// across the whole cycle (including some already mid-fade or fully
// invisible) rather than every fish beginning fully visible and about to
// dim in lockstep.
function randomStartingFadeState() {
  const fadePhase = SHADOW_FISH_FADE_PHASES[Math.floor(Math.random() * SHADOW_FISH_FADE_PHASES.length)];
  const [minS, maxS] = fadeDurationRangeForPhase(fadePhase);
  const fadeDurationS = randomFadeDurationS(minS, maxS);
  const fadeElapsedS = Math.random() * fadeDurationS;
  const t = fadeElapsedS / fadeDurationS;
  let alpha;
  if (fadePhase === 'out') alpha = 1 - t;
  else if (fadePhase === 'in') alpha = t;
  else alpha = fadePhase === 'hidden' ? 0 : 1; // 'hidden' -> 0, 'visible' -> 1
  return { fadePhase, fadeElapsedS, fadeDurationS, alpha };
}
function updateShadowFishFade(f, dt) {
  f.fadeElapsedS += dt;
  const t = Math.min(1, f.fadeElapsedS / f.fadeDurationS);
  if (f.fadePhase === 'out') {
    f.alpha = 1 - t;
    if (f.fadeElapsedS >= f.fadeDurationS) {
      f.fadePhase = 'hidden';
      f.fadeElapsedS = 0;
      f.fadeDurationS = randomFadeDurationS(SHADOW_FISH_FADE_HOLD_MIN_S, SHADOW_FISH_FADE_HOLD_MAX_S);
      f.alpha = 0;
    }
  } else if (f.fadePhase === 'hidden') {
    f.alpha = 0;
    if (f.fadeElapsedS >= f.fadeDurationS) {
      f.fadePhase = 'in';
      f.fadeElapsedS = 0;
      f.fadeDurationS = randomFadeDurationS(SHADOW_FISH_FADE_MIN_S, SHADOW_FISH_FADE_MAX_S);
    }
  } else if (f.fadePhase === 'in') {
    f.alpha = t;
    if (f.fadeElapsedS >= f.fadeDurationS) {
      f.fadePhase = 'visible';
      f.fadeElapsedS = 0;
      f.fadeDurationS = randomFadeDurationS(SHADOW_FISH_FADE_HOLD_MIN_S, SHADOW_FISH_FADE_HOLD_MAX_S);
      f.alpha = 1;
    }
  } else { // 'visible' — holds at full opacity before the cycle restarts
    f.alpha = 1;
    if (f.fadeElapsedS >= f.fadeDurationS) {
      f.fadePhase = 'out';
      f.fadeElapsedS = 0;
      f.fadeDurationS = randomFadeDurationS(SHADOW_FISH_FADE_MIN_S, SHADOW_FISH_FADE_MAX_S);
      f.alpha = 1;
    }
  }
}
// Per direct request ("the background silhouette fish occasionally let out
// desaturated and blurry bubbles, relative to the size of the fish, with
// diminishing returns so the bubbles don't get too huge") — a slow, random
// per-fish timer, same "trickle over a random range" idiom as a crab's own
// bubbleTimer (see CRAB_BUBBLE_MIN_S/MAX_S). Kept in a pool separate from
// cursorBubbles/the ambient `bubbles` column so it can get its own muted,
// slightly-blurred render treatment (see renderShadowBubbles) instead of the
// crisp white cursor-bubble look.
const SHADOW_FISH_BUBBLE_MIN_S = 6;
const SHADOW_FISH_BUBBLE_MAX_S = 14;
const shadowBubbles = [];
function randomShadowFish(big) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const minSize = big ? SHADOW_FISH_BIG_MIN_SIZE : SHADOW_FISH_MIN_SIZE;
  const maxSize = big ? SHADOW_FISH_BIG_MAX_SIZE : SHADOW_FISH_MAX_SIZE;
  // Leans further toward the FAINT end than before (was 0.15-0.50 / 0.55-
  // 0.85) — same direct request as the DEEP/FAINT color shift above, so
  // even the least-faint fish in each pool blends more into the water.
  const blendT = big ? 0.65 + Math.random() * 0.3 : 0.35 + Math.random() * 0.35;
  const colors = shadowFishColors(blendT);
  return {
    x: Math.random() * WORLD_W,
    y: SEABED_FLOOR_Y * (0.12 + Math.random() * 0.7), // scattered through the open water column, never right at the very top or bottom
    size: minSize + Math.random() * (maxSize - minSize),
    dir,
    speed: (big ? 5 : 8) + Math.random() * (big ? 9 : 14), // bigger, further-away-reading fish drift slower
    tailFreq: 1.4 + Math.random() * 1.2,
    tailPhase: Math.random() * Math.PI * 2,
    bobFreq: 0.2 + Math.random() * 0.25,
    bobAmp: 6 + Math.random() * 14,
    bobPhase: Math.random() * Math.PI * 2,
    baseY: 0, // set below, before first use
    fillColor: colors.fill,
    haloColor: colors.halo,
    depth: Math.random() * 10, // always the furthest-back layer — see renderShadowFish, called before every other ambience layer
    bubbleTimer: SHADOW_FISH_BUBBLE_MIN_S + Math.random() * (SHADOW_FISH_BUBBLE_MAX_S - SHADOW_FISH_BUBBLE_MIN_S),
    // Each fish starts at a random point somewhere in the 4-phase fade
    // cycle (a fish starting already invisible is fine) — see
    // randomStartingFadeState above.
    ...randomStartingFadeState(),
  };
}
const shadowFish = [];
for (let i = 0; i < SHADOW_FISH_COUNT; i++) {
  const f = randomShadowFish(false);
  f.baseY = f.y;
  shadowFish.push(f);
}
for (let i = 0; i < SHADOW_FISH_BIG_COUNT; i++) {
  const f = randomShadowFish(true);
  f.baseY = f.y;
  shadowFish.push(f);
}

export function updateAmbience(dtMs) {
  const dt = dtMs / 1000;
  elapsed += dt;
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.age += dt;
    if (b.y < -20) Object.assign(b, randomBubble());
  }
  for (const f of shadowFish) {
    f.x += f.speed * f.dir * dt;
    // Wraps around to the opposite edge (with a little off-screen margin)
    // instead of respawning fresh, unlike a bubble — keeps its own size/
    // speed/bob phase intact rather than reshuffling every lap, so it never
    // visibly "pops."
    if (f.dir > 0 && f.x > WORLD_W + 80) f.x = -80;
    else if (f.dir < 0 && f.x < -80) f.x = WORLD_W + 80;
    updateShadowFishFade(f, dt);
  }
  updateCrabs(dt);
  updateTreasureChest(dt);
  // Per direct request ("make the bubbles that spawn from the cursor have
  // way more initial velocity, actually matching the cursor to start before
  // slowing and going up") — a cursor-trail bubble now carries its own
  // decaying "burst" velocity (b.vx/b.vy, set at spawn to roughly the
  // cursor's own velocity — see spawnCursorBubbles) on TOP of the steady
  // upward `speed` rise every bubble already had. dragMul is the same
  // exponential-decay multiplier applied to every bubble this tick (dt is
  // shared, so it's computed once here rather than per-bubble) — a chest
  // bubble (spawnChestBubble) always spawns with vx/vy at 0, so this is a
  // harmless no-op for it either way, letting both populations share this
  // one loop/pool.
  const dragMul = Math.exp(-CURSOR_BUBBLE_BURST_DRAG_PER_S * dt);
  updateSimpleBubblePool(cursorBubbles, dt, dragMul);

  // Shadow fish occasionally let out their own small bubbles — per direct
  // request ("the background silhouette fish occasionally let out
  // desaturated and blurry bubbles, relative to the size of the fish, with
  // diminishing returns"). Same timer-driven trickle as a crab's own
  // bubbleTimer above, just per-shadow-fish.
  for (const f of shadowFish) {
    f.bubbleTimer -= dt;
    if (f.bubbleTimer <= 0) {
      spawnShadowFishBubble(f);
      f.bubbleTimer = SHADOW_FISH_BUBBLE_MIN_S + Math.random() * (SHADOW_FISH_BUBBLE_MAX_S - SHADOW_FISH_BUBBLE_MIN_S);
    }
  }
  updateSimpleBubblePool(shadowBubbles, dt, dragMul);

  updateBackgroundParallaxDecor(dt);
}

// Shared rise/wobble-drag/fade-out physics for every "loose bubble in a
// plain array" pool in this file (cursorBubbles, shadowBubbles, bgBubbles) —
// factored out once real per-bubble velocity (vx/vy, decaying via dragMul)
// was added for cursorBubbles, since shadowBubbles/bgBubbles want the exact
// same rise-and-fade behavior without duplicating this loop three times.
function updateSimpleBubblePool(pool, dt, dragMul) {
  for (let i = pool.length - 1; i >= 0; i--) {
    const b = pool[i];
    b.ageS += dt;
    b.vx *= dragMul;
    b.vy *= dragMul;
    b.x += b.vx * dt;
    b.y += b.vy * dt - b.speed * dt;
    if (b.ageS >= b.ttlS) pool.splice(i, 1);
  }
}

function renderBubbles(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  for (const b of bubbles) {
    const wobbleX = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const screen = worldToScreen(b.x + wobbleX, b.y, camera);
    if (screen.x < -20 || screen.x > canvasWidth + 20 || screen.y < -20 || screen.y > canvasHeight + 20) continue;
    const growT = Math.min(1, b.age / BUBBLE_GROW_DURATION_S);
    const r = Math.max(1, b.radius * growT * camera.zoom); // floored at 1px — a bubble's very first instant is a tiny dot, not literally invisible
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(screen.x - r * 0.3, screen.y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// A simplified fish silhouette — an ellipse body plus a triangular tail,
// drawn twice (a wide soft-colored "halo" pass underneath a narrower,
// slightly-less-faint core) for the same cheap fake-blur drawOneSeaweed's
// own comment explains, rather than a real ctx.filter blur (measured far too
// expensive for several of these every frame). Both passes are fully opaque
// now — see the "Shadow Fish" section comment above for why. Faces its own
// direction of travel.
function drawShadowFishSilhouette(ctx, x, y, size, dir, fillColor, haloColor) {
  const bodyW = size;
  const bodyH = size * 0.5;
  const tailW = size * 0.45;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.moveTo(x - (bodyW / 2) * dir, y);
  ctx.lineTo(x - (bodyW / 2 + tailW) * dir, y - bodyH * 0.45);
  ctx.lineTo(x - (bodyW / 2 + tailW) * dir, y + bodyH * 0.45);
  ctx.closePath();
  ctx.lineWidth = size * 0.35;
  ctx.strokeStyle = haloColor;
  ctx.stroke();
  ctx.fillStyle = haloColor;
  ctx.fill();
  ctx.fillStyle = fillColor;
  ctx.fill();
}

function drawOneShadowFish(ctx, camera, canvasWidth, canvasHeight, f) {
  if (f.alpha <= 0) return; // fully faded out — see updateShadowFishFade
  const bobY = f.baseY + Math.sin(elapsed * f.bobFreq + f.bobPhase) * f.bobAmp;
  const screen = worldToScreen(f.x, bobY, camera);
  // Shrinks in step with its own fade, but only over the bottom half of the
  // fade — full size all the way down to alpha 0.5, then shrinking to 10%
  // smaller by alpha 0 (fully faded). See SHADOW_FISH_FADE_SIZE_SHRINK.
  const shrinkT = f.alpha < 0.5 ? (0.5 - f.alpha) / 0.5 : 0;
  const sizeScale = 1 - SHADOW_FISH_FADE_SIZE_SHRINK * shrinkT;
  const size = f.size * sizeScale * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2 || screen.y < -size || screen.y > canvasHeight + size) return;
  // A slight tail-wag "squash" on the horizontal scale, same idea as a real
  // fish's own tail animation, just baked into one silhouette shape rather
  // than a separate animated tail segment — cheap enough to still read as
  // "swimming," not just sliding.
  const wag = 1 + Math.sin(elapsed * f.tailFreq + f.tailPhase) * 0.06;
  ctx.save();
  ctx.globalAlpha = f.alpha;
  ctx.translate(screen.x, screen.y);
  ctx.scale(wag, 1);
  drawShadowFishSilhouette(ctx, 0, 0, size, f.dir, f.fillColor, f.haloColor);
  ctx.restore();
}

// One small bubble released from a shadow fish's own current position. Size
// scales with the fish's own size but with diminishing returns (sqrt, not
// linear) — per direct request ("relative to the size of the fish, with
// diminishing returns so the bubbles don't get too huge"), so the big
// background-variant fish (SHADOW_FISH_BIG_*, up to ~3x a small fish's size)
// don't end up trailing comically oversized bubbles. Pushed into the
// separate shadowBubbles pool (not cursorBubbles) so renderShadowBubbles can
// give it its own muted, slightly-soft look instead of the crisp white
// cursor-bubble style.
function spawnShadowFishBubble(f) {
  if (shadowBubbles.length >= CURSOR_BUBBLE_MAX) shadowBubbles.shift();
  const speed = 14 + Math.random() * 14;
  const radius = Math.min(5, 1.2 + Math.sqrt(f.size) * 0.45);
  shadowBubbles.push({
    x: f.x - f.size * 0.5 * f.dir + (Math.random() - 0.5) * 6, // released from roughly the tail end
    y: f.baseY + (Math.random() - 0.5) * f.size * 0.3,
    vx: 0,
    vy: 0,
    radius,
    speed,
    wobbleFreq: 0.6 + Math.random() * 1,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 3 + Math.random() * 5,
    ageS: 0,
    ttlS: Math.max(0.1, f.baseY / speed),
  });
}

// Muted grey-blue, slightly softened (double-pass halo, the same cheap
// fake-blur idiom this file already uses instead of a real ctx.filter — see
// drawOneSeaweed's own comment on why filter blur is avoided per-frame)
// rather than the crisp white cursor-bubble look, so these read as "released
// by a faint background fish" rather than "released by the player's cursor."
function renderShadowBubbles(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  for (const b of shadowBubbles) {
    const wobbleX = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const screen = worldToScreen(b.x + wobbleX, b.y, camera);
    if (screen.x < -20 || screen.x > canvasWidth + 20 || screen.y < -20 || screen.y > canvasHeight + 20) continue;
    const lifeT = b.ageS / b.ttlS;
    const fade = lifeT < 0.75 ? 1 : Math.max(0, 1 - (lifeT - 0.75) / 0.25);
    const r = Math.max(1, b.radius * camera.zoom);
    drawSoftMutedBubble(ctx, screen.x, screen.y, r, 0.24 * fade); // see drawSoftMutedBubble's own comment (darker + gradient-faked blur, per direct request)
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Fakes a soft/blurred edge cheaply instead of the real thing — a canvas 2D
// `ctx.filter` blur was tried first and tanked frame rate hard (measured
// ~60fps -> ~11fps with just 16 filtered strokes a frame; Chromium
// re-rasterizes a filtered draw call individually rather than batching a
// whole filtered region, so it doesn't get cheaper by only setting the
// filter once outside the loop). A wide, LIGHTER-colored stroke underneath a
// narrower, richer-colored one reads as "soft-edged" without needing any
// transparency — per direct request ("the seaweed isn't transparent
// anymore... it looked like the shadow fish were swimming in front of the
// seaweed instead of behind it"): this used to fake the same soft edge with
// two alpha levels of the SAME color, which meant anything drawn earlier at
// this screen position (shadow fish, both bands are behind seaweed in the
// depth order — see this file's header comment) showed straight through.
// Fully opaque now, same "lighter halo behind a richer core" two-pass
// technique drawOneShadowFish itself already uses, so it genuinely occludes
// whatever's behind it while keeping the same soft-edged look. Per a LATER
// direct follow-up report ("the seaweed is too visually obtrusive now, make
// it way less obtrusive... without changing size/shape/animation, but still
// make the shadow fish disappear behind it completely") — an initial pass
// (30/42% -> 12/18% saturation) still read as clearly green per a second
// direct follow-up, so both tones dropped again, down to a near-neutral
// 6/9% saturation and lightened further, close enough to the water's own
// tone to read as barely-there texture rather than a distinct plant color —
// while staying fully opaque (alpha untouched) so the occlusion fix above
// still holds regardless of how muted the color itself gets.
function drawOneSeaweed(ctx, camera, canvasWidth, w, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(w.x, floorY, camera);
  if (screen.x < -100 || screen.x > canvasWidth + 100) return;
  ctx.save();
  ctx.lineCap = 'round';
  const sway = Math.sin(elapsed * w.freq + w.phase) * w.sway * camera.zoom;
  const h = w.height * camera.zoom;
  const baseWidth = Math.max(2, w.width * camera.zoom);
  // Per direct request ("the tall seaweed in the foreground should get a small
  // rework/retweak so it better matches the aesthetic of the more polished
  // boulders and city") — the old soft-halo-around-a-core look is now the
  // boulders' own language: a crisp darker rim (drawBoulder's outline), a lit
  // body, a highlight down the left edge and a shade down the right (its
  // upper-left light), and a small contact shadow at the base. The rim + body
  // together span exactly the old halo's total width (2.2 * blurFactor *
  // baseWidth), so size/shape/sway are untouched, and every stroke is either
  // opaque or drawn over the opaque body — the occlusion fix above still holds.
  const totalW = baseWidth * 2.2 * w.blurFactor;
  const rimPx = Math.max(1, 1.6 * camera.zoom);
  const bodyW = Math.max(1, totalW - rimPx * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(screen.x + 2, screen.y + 1, totalW * 0.75, Math.max(1.5, totalW * 0.22), 0, 0, Math.PI * 2);
  ctx.fill();
  const strand = () => {
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + 2);
    ctx.quadraticCurveTo(screen.x + sway, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
  };
  strand();
  ctx.strokeStyle = `hsl(${w.hue}, 11%, 34%)`;
  ctx.lineWidth = totalW;
  ctx.stroke();
  strand();
  ctx.strokeStyle = `hsl(${w.hue}, 9%, 47%)`;
  ctx.lineWidth = bodyW;
  ctx.stroke();
  ctx.save();
  ctx.translate(-bodyW * 0.27, 0);
  strand();
  ctx.strokeStyle = `hsla(${w.hue}, 10%, 64%, 0.75)`;
  ctx.lineWidth = bodyW * 0.3;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(bodyW * 0.3, 0);
  strand();
  ctx.strokeStyle = `hsla(${w.hue}, 11%, 30%, 0.4)`;
  ctx.lineWidth = bodyW * 0.28;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ---- Boulders ----
// A handful of static, irregular rounded rock clusters sitting right on the
// seabed floor line — per direct request ("major background additions...
// boulders"), purely decorative scenery, same "no gameplay effect, nothing
// outside this file ever reads it" rule as everything else here. Static
// (no per-frame animation, unlike swaying seaweed) since a rock has no
// reason to move — computed once at load and just redrawn every frame at
// its own fixed spot. Always behind the Science Lab, same as seaweed.
// Bumped 7 -> 9 (25% more, rounded up) per direct request ("increase the
// amount of... boulders by 25%").
const BOULDER_COUNT = 14; // was 9 — +50% (13.5, rounded up) per direct request
function randomBoulder() {
  // Min halved (26 -> 13), max untouched (56), per direct request ("boulder min size 50% of what it is currently... so they look more like stones instead of boulders").
  const size = 13 + Math.random() * 43;
  return {
    x: Math.random() * WORLD_W,
    size,
    // Each boulder is a cluster of 3-4 overlapping circles at slightly
    // different offsets/radii rather than one perfect circle, so the
    // silhouette reads as "rock," not "ball."
    bumps: Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({
      dx: (Math.random() - 0.5) * size * 0.7,
      r: size * (0.5 + Math.random() * 0.4),
    })),
    shade: 0.85 + Math.random() * 0.3, // per-boulder brightness variance so a cluster of them doesn't read as identical copies
    depth: 15 + Math.random() * 20, // always < LAB_DEPTH_THRESHOLD — boulders never draw in front of the Science Lab
  };
}
const boulders = [];
for (let i = 0; i < BOULDER_COUNT; i++) boulders.push(randomBoulder());

// Uses the same boulder art as the seabed/city layer (SeabedArt.js's
// drawBoulder), baked once per boulder into a sprite so each keeps its own
// stable, unique shape.
function drawOneBoulder(ctx, camera, canvasWidth, b, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(b.x, floorY, camera);
  const size = b.size * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) return;
  if (!b.sprite) b.sprite = bakeBoulderSprite(b.size);
  const sp = b.sprite;
  const z = camera.zoom / sp.scale;
  // Boulder centre sits a bit above the floor line so it reads as resting on it.
  ctx.drawImage(sp.canvas, screen.x - sp.anchorX * z, screen.y - b.size * 0.55 * camera.zoom - sp.anchorY * z, sp.canvas.width * z, sp.canvas.height * z);
}

// ---- Sand Castles ----
// Per direct request ("add in a sand castle or two of varying sizes to the
// background that's about from the size of the mound to a boulder and can
// go behind coral, urchins and boulders"), later bumped up ("make 2-3 sand
// castles and make it so the range in size for sand castles is greater on
// both extremes") — a few static sand structures, originally sized between
// a Boulder's own footprint (BOULDER_COUNT above, diameter roughly 45-110px)
// and the Mound's (Mound.js's MOUND_WIDTH_TILES(4.4) * TILE_SIZE(32) ≈
// 141px); the range now runs noticeably smaller than a Boulder's own
// smallest at one end and bigger than the Mound at the other, so 3 castles
// read as more clearly varied rather than all clustering in that original
// narrower band. Depth is kept below every Boulder's own 15-35 range so it
// always draws behind boulders (and, being in the same behind-Lab band as
// boulders/seaweed, also always behind coral/urchins/the Science Lab too) —
// same static "no per-frame animation, no gameplay effect" rule as Boulders.
const SAND_CASTLE_COUNT = 4; // was 3 — +1 per direct request
const SAND_CASTLE_MIN_WIDTH = 35; // was 55 — now noticeably below a Boulder's own smallest footprint
const SAND_CASTLE_MAX_WIDTH = 180; // was 140 (~ the Mound's own width) — now bigger than the Mound
function randomSandCastle() {
  const width = SAND_CASTLE_MIN_WIDTH + Math.random() * (SAND_CASTLE_MAX_WIDTH - SAND_CASTLE_MIN_WIDTH);
  return {
    x: Math.random() * WORLD_W,
    width,
    height: width * (0.55 + Math.random() * 0.15),
    towerCount: 2 + Math.floor(Math.random() * 2), // 2 or 3 side/center towers
    shade: 0.9 + Math.random() * 0.25, // per-castle brightness variance, same idea as Boulder's own `shade`
    depth: 5 + Math.random() * 8, // always < every Boulder's own 15-35 range
  };
}
const sandCastles = [];
for (let i = 0; i < SAND_CASTLE_COUNT; i++) sandCastles.push(randomSandCastle());

// Drawn from a one-off baked sprite in the boulders' own lit/rimmed/grained
// style (SeabedArt.js's bakeSandCastleSprite), per direct request — same
// lazy-bake-per-instance pattern drawOneBoulder uses, so each castle keeps
// its own stable, unique grain.
function drawOneSandCastle(ctx, camera, canvasWidth, sc, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(sc.x, floorY, camera);
  const w = sc.width * camera.zoom;
  if (screen.x < -w || screen.x > canvasWidth + w) return;
  if (!sc.sprite) sc.sprite = bakeSandCastleSprite(sc.width, sc.height, sc.shade, sc.towerCount);
  const sp = sc.sprite;
  const z = camera.zoom / sp.scale;
  ctx.drawImage(sp.canvas, screen.x - sp.anchorX * z, screen.y - sp.anchorY * z, sp.canvas.width * z, sp.canvas.height * z);
}

// ---- Sea Urchins ----
// Small spiky dark orbs dotted along the floor — per direct request ("major
// background additions... sea urchins"). Static like boulders, just a
// center dot plus a ring of thin radiating spike lines. Always in front of
// the Science Lab, per direct request.
// Bumped 10 -> 13 (25% more, rounded) per direct request ("increase the
// amount of sea urchins... by 25%").
const SEA_URCHIN_COUNT = 13;
function randomSeaUrchin() {
  return {
    x: Math.random() * WORLD_W,
    radius: 5 + Math.random() * 5,
    spikeCount: 10 + Math.floor(Math.random() * 6),
    hue: 265 + Math.random() * 30, // deep purple-violet, the classic urchin color
    depth: 45 + Math.random() * 20, // always >= LAB_DEPTH_THRESHOLD — urchins always draw in front of the Science Lab
    // Per direct follow-up request ("have the sea urchins bob and bounce a
    // little bit so it looks like they are alive") — a small vertical
    // sine bob, same "pure function of the global elapsed clock" pattern
    // drawOneKelp already uses for its sway, so no separate update() call
    // is needed for it to animate.
    bobFreq: 1 + Math.random() * 1.2,
    bobPhase: Math.random() * Math.PI * 2,
    bobAmp: 1.5 + Math.random() * 1.5,
  };
}
const seaUrchins = [];
for (let i = 0; i < SEA_URCHIN_COUNT; i++) seaUrchins.push(randomSeaUrchin());

function drawOneSeaUrchin(ctx, camera, canvasWidth, u, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(u.x, floorY, camera);
  const r = u.radius * camera.zoom;
  if (screen.x < -r * 4 || screen.x > canvasWidth + r * 4) return;
  ctx.save();
  const bob = Math.sin(elapsed * u.bobFreq + u.bobPhase) * u.bobAmp * camera.zoom;
  const cy = screen.y - r * 0.6 - Math.abs(bob);
  ctx.strokeStyle = `hsl(${u.hue}, 45%, 22%)`;
  ctx.lineWidth = Math.max(1, camera.zoom);
  for (let i = 0; i < u.spikeCount; i++) {
    const angle = (i / u.spikeCount) * Math.PI * 2;
    // Spikes only fan out through the upper half-ish (never straight down
    // into the floor) — a real urchin's spines don't grow into the rock
    // it's sitting on.
    if (Math.sin(angle) > 0.7) continue;
    ctx.beginPath();
    ctx.moveTo(screen.x, cy);
    ctx.lineTo(screen.x + Math.cos(angle) * r * 2.2, cy + Math.sin(angle) * r * 2.2);
    ctx.stroke();
  }
  ctx.fillStyle = `hsl(${u.hue}, 40%, 16%)`;
  ctx.beginPath();
  ctx.arc(screen.x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Coral ----
// Static multi-color fan-shaped clusters dotted along the floor — per direct
// request ("major background additions... multi-color coral"), rounding out
// the boulders/urchins pass with some actual color against all the muted
// browns/greys. Same "no gameplay effect" rule, static like boulders/urchins.
// Always in front of the Science Lab, per direct request.
// Bumped 9 -> 14 (50% more, rounded) per direct request ("increase the
// amount of coral by 50%"), then 14 -> 19 (33% more, rounded) per a later
// direct request ("increase the amount of coral by 33%").
const CORAL_COUNT = 19;
const CORAL_HUES = [340, 20, 280, 45]; // pink, orange, purple, golden-yellow
function randomCoral() {
  const size = 24.2 + Math.random() * 28.6; // was 22-48, both ends +10% (24.2-52.8) per direct request ("increase the min and max size of the coral by 10%")
  const hue = CORAL_HUES[Math.floor(Math.random() * CORAL_HUES.length)];
  const branchCount = 4 + Math.floor(Math.random() * 4);
  return {
    x: Math.random() * WORLD_W,
    size,
    hue,
    // Each branch fans out mostly-upward (a narrow cone around straight up)
    // rather than any random direction, so the cluster reads as one coral
    // head, not a scribble.
    branches: Array.from({ length: branchCount }, () => ({
      angle: -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8,
      length: size * (0.6 + Math.random() * 0.6),
      width: 3 + Math.random() * 4,
    })),
    depth: 45 + Math.random() * 20, // always >= LAB_DEPTH_THRESHOLD — coral always draws in front of the Science Lab
    // Per direct request ("coral all sways slightly back and forth, like the
    // water is moving the coral") — same sine-wave idea as kelp/seaweed's own
    // sway, just applied as a small angle wobble per branch instead of a
    // curve offset, and each coral head gets its own random freq/phase so a
    // whole cluster of coral doesn't wave in lockstep.
    swayAmp: (0.04 + Math.random() * 0.05) * Math.PI, // small angle wobble, not a full flail
    swayFreq: 0.25 + Math.random() * 0.3,
    swayPhase: Math.random() * Math.PI * 2,
  };
}
const corals = [];
for (let i = 0; i < CORAL_COUNT; i++) corals.push(randomCoral());

// Per direct request (rework coral to match the boulders/mound/seaweed — "lit,
// rimmed, unique grain, contact shadow"): a baked rocky lump with a contact
// shadow at the base, then the live-swaying branches drawn as ONE rimmed
// silhouette (every branch's dark rim first, then every lit body on top, so
// overlapping branches merge instead of each rim cutting into its neighbour),
// a highlight down each branch's upper-left side, and a few grain specks.
// Sway math, branch geometry and sizes are unchanged.
function drawOneCoral(ctx, camera, canvasWidth, c, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(c.x, floorY, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) return;
  if (!c.baseSprite) c.baseSprite = bakeCoralBaseSprite(c.size * 0.3, c.hue);
  const sp = c.baseSprite;
  const z = camera.zoom / sp.scale;
  ctx.drawImage(sp.canvas, screen.x - sp.anchorX * z, screen.y - sp.ry * 0.35 * camera.zoom - sp.anchorY * z, sp.canvas.width * z, sp.canvas.height * z);
  ctx.save();
  ctx.lineCap = 'round';
  const sway = Math.sin(elapsed * c.swayFreq + c.swayPhase) * c.swayAmp;
  const rimPx = Math.max(1, 1.3 * camera.zoom);
  const limbs = c.branches.map((br) => {
    const angle = br.angle + sway;
    const len = br.length * camera.zoom;
    const w = Math.max(1.5, br.width * camera.zoom);
    if (!br.specks) br.specks = [0, 1].map(() => ({ t: 0.25 + Math.random() * 0.55, side: Math.random() * 2 - 1, light: Math.random() < 0.5 }));
    return { br, angle, w, endX: screen.x + Math.cos(angle) * len, endY: screen.y + Math.sin(angle) * len, tipR: Math.max(1.5, br.width * 0.6 * camera.zoom) };
  });
  ctx.strokeStyle = `hsl(${c.hue}, 55%, 30%)`;
  ctx.fillStyle = `hsl(${c.hue}, 55%, 30%)`;
  for (const l of limbs) {
    ctx.lineWidth = l.w + rimPx * 2;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(l.endX, l.endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(l.endX, l.endY, l.tipR + rimPx, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const l of limbs) {
    ctx.strokeStyle = `hsl(${c.hue}, 60%, 55%)`;
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(l.endX, l.endY);
    ctx.stroke();
    ctx.fillStyle = `hsl(${c.hue}, 65%, 62%)`;
    ctx.beginPath();
    ctx.arc(l.endX, l.endY, l.tipR, 0, Math.PI * 2);
    ctx.fill();
    let nx = Math.sin(l.angle), ny = -Math.cos(l.angle); // left-hand normal; flipped below so the light always comes from the upper-left
    if (nx + ny > 0) { nx = -nx; ny = -ny; }
    const off = l.w * 0.22;
    ctx.strokeStyle = `hsla(${c.hue}, 75%, 80%, 0.6)`;
    ctx.lineWidth = Math.max(1, l.w * 0.28);
    ctx.beginPath();
    ctx.moveTo(screen.x + nx * off, screen.y + ny * off);
    ctx.lineTo(l.endX + nx * off, l.endY + ny * off);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(l.endX - l.tipR * 0.3, l.endY - l.tipR * 0.3, Math.max(0.7, l.tipR * 0.3), 0, Math.PI * 2);
    ctx.fill();
    for (const sk of l.br.specks) {
      const t = sk.t;
      ctx.fillStyle = sk.light ? `hsla(${c.hue}, 75%, 82%, 0.55)` : `hsla(${c.hue}, 60%, 26%, 0.4)`;
      ctx.beginPath();
      ctx.arc(screen.x + (l.endX - screen.x) * t + nx * sk.side * l.w * 0.22, screen.y + (l.endY - screen.y) * t + ny * sk.side * l.w * 0.22, Math.max(0.6, l.w * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ---- Kelp (second seaweed variety) ----
// Per direct request ("major background additions... a new seaweed type") —
// taller, wider single blades in a golden-brown hue, rather than
// drawOneSeaweed's thin multi-strand green fronds, so it reads as visibly a
// different plant, not just a recolor. Sways the same sine-on-a-curve way,
// just filled as one tapering blade instead of stroked as a thin line.
// Grouped with seaweed for the Science Lab boundary — always behind it.
const KELP_COUNT = 6;
function randomKelp() {
  return {
    x: Math.random() * WORLD_W,
    height: 160 + Math.random() * 110,
    width: 10 + Math.random() * 6,
    sway: 20 + Math.random() * 14.2, // max was 38 (20 + rand*18), cut 10% to 34.2 per direct request ("both seaweeds... 10% less max sway amount")
    freq: 0.3 + Math.random() * 0.2525, // max was 0.65 (0.3 + rand*0.35), cut 15% to 0.5525 per direct request ("15% slower max sway speed")
    phase: Math.random() * Math.PI * 2,
    hue: 40 + Math.random() * 20,
    depth: 15 + Math.random() * 20, // always < LAB_DEPTH_THRESHOLD — same band as seaweed/boulders
  };
}
const kelps = [];
for (let i = 0; i < KELP_COUNT; i++) kelps.push(randomKelp());

function drawOneKelp(ctx, camera, canvasWidth, k, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(k.x, floorY, camera);
  if (screen.x < -100 || screen.x > canvasWidth + 100) return;
  ctx.save();
  const sway = Math.sin(elapsed * k.freq + k.phase) * k.sway * camera.zoom;
  const h = k.height * camera.zoom;
  const w = k.width * camera.zoom;
  // Opaque now, same reasoning/fix as drawOneSeaweed's own comment (a
  // shadow fish drawn earlier at this screen position — both are behind
  // kelp in the depth order — used to show straight through the old
  // alpha:0.55 fill). Per a later direct request ("change the tall seaweed
  // so it blends into the background more, by opacity or color or both") —
  // saturation dropped hard (45% -> 14%) and lightness raised (38% -> 52%,
  // closer to the water's own mid-tone) the same "mute it toward the water
  // gradient while staying fully opaque" technique drawOneSeaweed's own
  // multiple tuning passes already used, rather than reintroducing real
  // transparency (which is what caused the original occlusion bug this
  // opaque fill exists to avoid). Still a hair warmer than the water's blue
  // so it's not a literal recolor into seaweed's own green, just far less
  // visually loud than the old solid golden-brown.
  // Per direct request (same rework as drawOneSeaweed — "matches the
  // aesthetic of the more polished boulders"): the flat fill is now a
  // left-lit gradient across the blade (same overall lightness as the old
  // flat 52%, so it's no louder), a crisp darker rim like drawBoulder's
  // outline, and a thin midrib with its own highlight. Silhouette/sway are
  // unchanged, and it stays fully opaque.
  const blade = () => {
    ctx.beginPath();
    ctx.moveTo(screen.x - w / 2, screen.y);
    ctx.quadraticCurveTo(screen.x + sway - w * 0.3, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
    ctx.quadraticCurveTo(screen.x + sway + w * 0.3, screen.y - h * 0.5, screen.x + w / 2, screen.y);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(screen.x - w / 2, 0, screen.x + w / 2, 0);
  g.addColorStop(0, `hsl(${k.hue}, 15%, 60%)`);
  g.addColorStop(1, `hsl(${k.hue}, 13%, 44%)`);
  blade();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `hsla(${k.hue}, 16%, 32%, 0.75)`;
  ctx.lineWidth = Math.max(1, 1.4 * camera.zoom);
  ctx.stroke();
  const midrib = () => {
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.quadraticCurveTo(screen.x + sway, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h * 0.92);
  };
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(Math.max(1, camera.zoom), 0);
  midrib();
  ctx.strokeStyle = `hsla(${k.hue}, 14%, 68%, 0.35)`;
  ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);
  ctx.stroke();
  ctx.restore();
  midrib();
  ctx.strokeStyle = `hsla(${k.hue}, 16%, 30%, 0.45)`;
  ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);
  ctx.stroke();
  ctx.restore();
}

// ---- Crabs ----
// Per direct request ("major background additions... crabs") — small
// creatures that scuttle back and forth within a fixed range of their own
// home spot, pausing briefly before reversing direction (reads as
// "noticing" rather than an instant, mechanical about-face). Always in
// front of the Science Lab (depth always > LAB_DEPTH_THRESHOLD), but mixed
// relative to the coral/urchin band — per direct request ("crabs that
// scuttle are in front of some of the background objects but behind a few
// of them, so it gives it more depth") — 3 in 4 crabs sit comfortably above
// the whole coral/urchin depth range (always in front of them), the last
// quarter sits down near the BOTTOM of that same range so it ends up behind
// whichever coral/urchins happen to roll a higher depth than it did.
// Bumped 4 -> 5 (25% more) per direct request ("increase the amount of...
// crabs... by 25%").
const CRAB_COUNT = 8; // was 5 — +50% (7.5, rounded up) per direct request
// Per direct follow-up request ("make the crabs occasionally spawn bubbles
// when they are moving") — timer range a moving crab waits between bubbles.
const CRAB_BUBBLE_MIN_S = 2;
const CRAB_BUBBLE_MAX_S = 5;
function randomCrab() {
  const homeX = Math.random() * WORLD_W;
  const depth = Math.random() < 0.75 ? 55 + Math.random() * 20 : 44 + Math.random() * 10;
  return {
    x: homeX,
    homeX,
    range: 60 + Math.random() * 100,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 10 + Math.random() * 14,
    size: 8 + Math.random() * 7.4, // max was 14 (8 + rand*6), +10% to 15.4 per direct request — min untouched
    legPhaseFreq: 6 + Math.random() * 3,
    hue: 10 + Math.random() * 20,
    pauseTimer: Math.random() * 2,
    bubbleTimer: CRAB_BUBBLE_MIN_S + Math.random() * (CRAB_BUBBLE_MAX_S - CRAB_BUBBLE_MIN_S),
    depth,
  };
}
const crabs = [];
for (let i = 0; i < CRAB_COUNT; i++) crabs.push(randomCrab());

// Spawns one small bubble at a crab's own position, into the shared
// cursorBubbles pool — same reasoning/pattern as spawnChestBubble: rides the
// existing rise/wobble/fade update+render code, and per direct request
// ("make sure the bubbles go all the way to the top") uses the same
// ttlS = y/speed trick so it doesn't fade out early.
function spawnCrabBubble(c, targetArray = cursorBubbles, floorY = SEABED_FLOOR_Y) {
  if (targetArray.length >= CURSOR_BUBBLE_MAX) targetArray.shift();
  const speed = 20 + Math.random() * 20;
  const y = floorY - c.size * 0.5 + (Math.random() - 0.5) * 4;
  targetArray.push({
    x: c.x + (Math.random() - 0.5) * c.size,
    y,
    vx: 0,
    vy: 0,
    radius: 1 + Math.random() * 1.5,
    speed,
    wobbleFreq: 0.8 + Math.random() * 1.4,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 2 + Math.random() * 4,
    ageS: 0,
    ttlS: y / speed,
  });
}

// One small bubble at a Sea Turtle convoy member's own (world-space) tail
// position — same shared-pool/rise-to-top pattern as spawnCrabBubble/
// spawnCoinPickupBubbles above. Called from main.js's updateSeaTurtle, which
// times it off REAL elapsed ms (not dt) so the trail's own spawn rate is
// just as immune to Pause Time/2x Speed as the turtle itself — once a bubble
// exists here, though, it's a completely normal member of cursorBubbles and
// rises/fades on the same dt-driven schedule every other bubble in the pool
// does (purely decorative, not worth a second real-time-only animation
// path). A brief per-member/size-scaled/fixed-height variant of this lived
// directly in main.js instead for one revision — reverted per direct
// request ("I like the bubbles the way they were before"); the separate
// "trailing streams" report that prompted that whole detour turned out to
// be about the water-current wake (drawSeaTurtleWake in main.js), not these
// bubbles at all.
export function spawnSeaTurtleBubble(x, y) {
  if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift();
  const speed = 16 + Math.random() * 14;
  cursorBubbles.push({
    x: x + (Math.random() - 0.5) * 6,
    y,
    vx: 0,
    vy: 0,
    radius: 1.5 + Math.random() * 2,
    speed,
    wobbleFreq: 0.8 + Math.random() * 1.4,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 2 + Math.random() * 4,
    ageS: 0,
    ttlS: Math.max(0.1, y / speed),
  });
}

// Per direct request ("make it so the picking up coins does a sparkle and
// makes 1-3 bubbles") — same shared-pool/rise-to-top pattern as
// spawnCrabBubble/spawnChestBubble above, just 1-3 at once from wherever the
// coin was actually banked (could be deep in the city, not just the seabed
// floor band — ttlS = y/speed still works from any starting depth). The
// sparkle half of "sparkle and bubbles" is a separate, non-Ambience effect —
// see Entities.js's updateCoin (pushes state.level.coinSparkleEffects) and
// main.js (renders it).
export function spawnCoinPickupBubbles(x, y) {
  const count = 1 + Math.floor(Math.random() * 3); // 1-3
  for (let i = 0; i < count; i++) {
    if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift();
    const speed = 25 + Math.random() * 25;
    const by = Math.max(1, y - Math.random() * 6);
    cursorBubbles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: by,
      vx: 0,
      vy: 0,
      radius: 1.5 + Math.random() * 2,
      speed,
      wobbleFreq: 0.8 + Math.random() * 1.4,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 2 + Math.random() * 4,
      ageS: 0,
      ttlS: by / speed,
    });
  }
}

function updateCrabs(dt, list = crabs, targetArray = cursorBubbles, floorY = SEABED_FLOOR_Y) {
  for (const c of list) {
    if (c.pauseTimer > 0) {
      c.pauseTimer -= dt;
      continue;
    }
    c.x += c.speed * c.dir * dt;
    if (Math.abs(c.x - c.homeX) > c.range) {
      c.dir *= -1;
      c.pauseTimer = 0.4 + Math.random() * 1.2;
    }
    // Only bubbles while actually moving (i.e. not during the pause above).
    c.bubbleTimer -= dt;
    if (c.bubbleTimer <= 0) {
      spawnCrabBubble(c, targetArray, floorY);
      c.bubbleTimer = CRAB_BUBBLE_MIN_S + Math.random() * (CRAB_BUBBLE_MAX_S - CRAB_BUBBLE_MIN_S);
    }
  }
}

// Per direct request (rework the crabs to match the boulders/mound/seaweed —
// "lit, rimmed, grained, contact-shadow"): a contact shadow on the floor, legs
// with a dark rim pass under the lit color, a radial-gradient lit shell with
// grain specks and a darker rim, and rimmed lit claws. The scuttle/leg-swing
// animation, size and position are unchanged. Grain positions are fixed per
// crab (c.specks, rolled lazily) so they ride the shell instead of shimmering.
function drawOneCrab(ctx, camera, canvasWidth, c, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(c.x, floorY, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 3 || screen.x > canvasWidth + size * 3) return;
  if (!c.specks) c.specks = Array.from({ length: 7 }, () => ({ u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, r: 0.04 + Math.random() * 0.06, light: Math.random() < 0.5 }));
  ctx.save();
  const legSwing = c.pauseTimer > 0 ? 0 : Math.sin(elapsed * c.legPhaseFreq) * 0.4;
  const rim = Math.max(1, 0.9 * camera.zoom);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(screen.x + size * 0.1, screen.y + size * 0.05, size * 1.35, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  for (const pass of [0, 1]) { // dark rim pass under, lit leg color over
    ctx.strokeStyle = pass === 0 ? `hsl(${c.hue}, 55%, 22%)` : `hsl(${c.hue}, 55%, 38%)`;
    ctx.lineWidth = Math.max(1, camera.zoom) + (pass === 0 ? rim : 0);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const legAngle = Math.PI * 0.22 * (i - 1) + legSwing * side;
        const lx = screen.x + side * size * 0.9;
        const ly = screen.y - size * 0.3;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + side * Math.cos(legAngle) * size * 0.9, ly + Math.sin(legAngle) * size * 0.9 + size * 0.4);
        ctx.stroke();
      }
    }
  }

  const litGrad = (cx, cy, r) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.45, r * 0.1, cx, cy, r * 1.15);
    g.addColorStop(0, `hsl(${c.hue}, 62%, 58%)`);
    g.addColorStop(1, `hsl(${c.hue}, 60%, 32%)`);
    return g;
  };
  // Claws first, so the shell's own rim sits over where they meet it.
  for (const side of [-1, 1]) {
    const cx = screen.x + side * size * 1.1;
    const cy = screen.y - size * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = litGrad(cx, cy, size * 0.4);
    ctx.fill();
    ctx.strokeStyle = `hsl(${c.hue}, 55%, 20%)`;
    ctx.lineWidth = rim;
    ctx.stroke();
  }
  const bx = screen.x, by = screen.y - size * 0.3;
  ctx.beginPath();
  ctx.ellipse(bx, by, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = litGrad(bx, by, size);
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (const sk of c.specks) {
    ctx.fillStyle = sk.light ? `hsla(${c.hue}, 70%, 80%, 0.5)` : `hsla(${c.hue}, 60%, 18%, 0.45)`;
    ctx.beginPath();
    ctx.arc(bx + sk.u * size * 0.85, by + sk.v * size * 0.6, Math.max(0.6, sk.r * size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = `hsl(${c.hue}, 55%, 20%)`;
  ctx.lineWidth = rim;
  ctx.beginPath();
  ctx.ellipse(bx, by, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---- Treasure Chest ----
// Per direct request ("Add in a treasure chest in the background nestled in
// a sand pile. Have the treasure chest animate to open every 5-15 seconds to
// reveal a chest full of treasure and let out 5-10 bubbles while opening
// before waiting 1 second and closing again to reset the 5-15 seconds") — a
// single static-position decorative chest cycling through its own
// closed -> opening -> open -> closing state machine, ticked in
// updateAmbience the same as crabs. Purely cosmetic, same "no gameplay
// effect, nothing outside this file ever reads it" rule as everything else
// here — never a real Storage Chest, not clickable/lootable. Kept in the
// front-of-Lab band (depth >= LAB_DEPTH_THRESHOLD, same band as coral/
// urchins) rather than the boulders/seaweed band, so its open/close
// animation always stays visible rather than risking getting tucked behind
// the Science Lab.
const CHEST_WAIT_MIN_S = 5;
const CHEST_WAIT_MAX_S = 15;
const CHEST_OPEN_DURATION_S = 0.6;
// Per direct follow-up request ("keep the chest lid open for 1.5 seconds
// instead of 1 second") — 1 -> 1.5.
const CHEST_HOLD_OPEN_DURATION_S = 1.5;
const CHEST_CLOSE_DURATION_S = 0.5;
// Per direct follow-up request ("make the chest bubbles take longer to spawn
// all the bubbles, having the bubbles spawn not just while it's opening but
// for the first half a second the chest lid is open") — the bubble budget
// now trickles out over the whole 'opening' phase PLUS the first 0.5s of
// 'open', instead of finishing the instant the lid finishes swinging open.
const CHEST_BUBBLE_SPAWN_WINDOW_S = CHEST_OPEN_DURATION_S + 0.5;
function randomChestWaitS() {
  return CHEST_WAIT_MIN_S + Math.random() * (CHEST_WAIT_MAX_S - CHEST_WAIT_MIN_S);
}
function randomTreasureChest() {
  return {
    x: Math.random() * WORLD_W,
    size: 34,
    phase: 'closed', // 'closed' -> 'opening' -> 'open' -> 'closing' -> 'closed'...
    timer: randomChestWaitS(),
    lidT: 0, // 0 = fully closed, 1 = fully open — drives the lid's rotation and the treasure reveal
    bubbleBudget: 0,
    bubblesSpawned: 0,
    bubbleElapsed: 0, // time since 'opening' began — spans the 'opening' phase AND the first CHEST_BUBBLE_SPAWN_WINDOW_S of 'open'
    depth: 50 + Math.random() * 10, // always >= LAB_DEPTH_THRESHOLD — same front-of-Lab band as coral/urchins
  };
}
const treasureChest = randomTreasureChest();

// Spawns one bubble at the chest's own position, directly into the shared
// cursorBubbles pool (same shape spawnCursorBubbles itself builds) so it
// rides the exact same rise/wobble/fade update+render code already ticked
// every frame — no separate bubble system needed just for this.
function spawnChestBubble(c, targetArray = cursorBubbles, floorY = SEABED_FLOOR_Y) {
  if (targetArray.length >= CURSOR_BUBBLE_MAX) targetArray.shift();
  const speed = 25 + Math.random() * 25;
  const y = floorY - c.size * 0.3 + (Math.random() - 0.5) * 6;
  targetArray.push({
    x: c.x + (Math.random() - 0.5) * c.size * 0.6,
    y,
    vx: 0, // no cursor-style launch burst for a chest bubble — straight up only
    vy: 0,
    radius: 2 + Math.random() * 3,
    speed,
    wobbleFreq: 0.8 + Math.random() * 1.4,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 3 + Math.random() * 6,
    ageS: 0,
    // Per direct request ("make it so the bubbles the treasure chest travel
    // basically all the way to the top of the tank before fading") — ttlS is
    // set to exactly how long THIS bubble takes to rise from its own spawn
    // depth to y=0 at its own fixed `speed`, instead of the short fixed
    // 1.6-2.8s range spawnCursorBubbles' own mouse-trail bubbles still use.
    // renderCursorBubbles only starts fading a bubble out over the LAST
    // quarter of its life (see its own `fade`), so it stays fully visible
    // until it's already ~3/4 of the way up.
    ttlS: y / speed,
  });
}

function updateTreasureChest(dt, c = treasureChest, targetArray = cursorBubbles, floorY = SEABED_FLOOR_Y) {
  if (c.phase === 'closed') {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.phase = 'opening';
      c.timer = 0;
      c.bubbleBudget = 5 + Math.floor(Math.random() * 6); // 5-10, per direct request
      c.bubblesSpawned = 0;
      c.bubbleElapsed = 0;
    }
  } else if (c.phase === 'opening') {
    c.timer += dt;
    c.bubbleElapsed += dt;
    c.lidT = Math.min(1, c.timer / CHEST_OPEN_DURATION_S);
    // Spreads the bubble budget out across the whole opening animation PLUS
    // the first half second of 'open' (see CHEST_BUBBLE_SPAWN_WINDOW_S)
    // instead of dumping them all in one frame.
    const targetSpawned = Math.floor(Math.min(1, c.bubbleElapsed / CHEST_BUBBLE_SPAWN_WINDOW_S) * c.bubbleBudget);
    while (c.bubblesSpawned < targetSpawned) {
      spawnChestBubble(c, targetArray, floorY);
      c.bubblesSpawned++;
    }
    if (c.lidT >= 1) { c.phase = 'open'; c.timer = 0; }
  } else if (c.phase === 'open') {
    c.timer += dt;
    c.bubbleElapsed += dt;
    const targetSpawned = Math.floor(Math.min(1, c.bubbleElapsed / CHEST_BUBBLE_SPAWN_WINDOW_S) * c.bubbleBudget);
    while (c.bubblesSpawned < targetSpawned) {
      spawnChestBubble(c, targetArray, floorY);
      c.bubblesSpawned++;
    }
    if (c.timer >= CHEST_HOLD_OPEN_DURATION_S) { c.phase = 'closing'; c.timer = 0; }
  } else if (c.phase === 'closing') {
    c.timer += dt;
    c.lidT = Math.max(0, 1 - c.timer / CHEST_CLOSE_DURATION_S);
    if (c.lidT <= 0) { c.phase = 'closed'; c.timer = randomChestWaitS(); }
  }
}

// Per direct request (rework the treasure chest to match the boulders/mound/
// seaweed — "lit, rimmed, grained, contact-shadow"): the sand pile and every
// wooden/gold piece is now a lit gradient with a darker rim, the pile and
// wood carry grain specks (c.specks, rolled once so they stay put), and a
// contact shadow sits under the pile. The open/close animation, treasure
// reveal, bubbles and dimensions are unchanged.
function drawOneTreasureChest(ctx, camera, canvasWidth, c, floorY = SEABED_FLOOR_Y) {
  const screen = worldToScreen(c.x, floorY, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 3 || screen.x > canvasWidth + size * 3) return;
  if (!c.specks) c.specks = Array.from({ length: 36 }, () => ({ u: Math.random() * 2 - 1, v: Math.random() * 2 - 1, r: 0.5 + Math.random() * 1.1, light: Math.random() < 0.5 }));
  ctx.save();
  const rim = Math.max(1, 1.2 * camera.zoom);
  const hGrad = (x0, x1, light, dark) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    return g;
  };
  const grain = (cx, cy, hw, hh, light, dark) => {
    for (const sk of c.specks) {
      ctx.fillStyle = sk.light ? light : dark;
      ctx.beginPath();
      ctx.arc(cx + sk.u * hw, cy + sk.v * hh, Math.max(0.5, sk.r * camera.zoom), 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // The sand pile it's nestled in — a soft mound behind/around its base.
  const pileW = size * 2.4;
  const pileH = size * 0.9;
  const pileCy = screen.y - pileH * 0.15;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(screen.x + 3, screen.y, (pileW / 2) * 1.04, pileH * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const pileGrad = ctx.createRadialGradient(screen.x - pileW * 0.18, pileCy - pileH * 0.3, pileW * 0.03, screen.x, pileCy, pileW * 0.55);
  pileGrad.addColorStop(0, '#ecdcae');
  pileGrad.addColorStop(1, '#bfa46c');
  ctx.beginPath();
  ctx.ellipse(screen.x, pileCy, pileW / 2, pileH / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = pileGrad;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(150, 120, 70, 0.22)';
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - pileH * 0.05, pileW * 0.31, pileH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  grain(screen.x, pileCy, pileW / 2, pileH / 2, 'rgba(255, 245, 210, 0.45)', 'rgba(110, 85, 45, 0.4)');
  ctx.restore();
  ctx.strokeStyle = 'rgba(120, 95, 50, 0.7)';
  ctx.lineWidth = rim;
  ctx.beginPath();
  ctx.ellipse(screen.x, pileCy, pileW / 2, pileH / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  const bodyW = size * 1.6;
  const bodyH = size * 0.9;
  const baseY = screen.y - pileH * 0.35; // nestled up out of the sand pile a bit
  const bodyTop = baseY - bodyH;
  const bodyLeft = screen.x - bodyW / 2;

  // Chest body — wood box with gold corner/mid bands and a lock.
  ctx.fillStyle = hGrad(bodyLeft, bodyLeft + bodyW, '#8a5a30', '#4d2f17');
  ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bodyLeft, bodyTop, bodyW, bodyH);
  ctx.clip();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'; // plank seams
  ctx.fillRect(bodyLeft, bodyTop + bodyH * 0.68, bodyW, Math.max(1, camera.zoom * 0.9));
  ctx.fillRect(bodyLeft, bodyTop + bodyH * 0.86, bodyW, Math.max(1, camera.zoom * 0.9));
  grain(screen.x, bodyTop + bodyH / 2, bodyW / 2, bodyH / 2, 'rgba(255, 220, 170, 0.28)', 'rgba(0, 0, 0, 0.3)');
  ctx.restore();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = rim;
  ctx.strokeRect(bodyLeft, bodyTop, bodyW, bodyH);
  const goldBand = (bx, by, bw, bh) => {
    ctx.fillStyle = hGrad(bx, bx + bw, '#f4d968', '#b8902a');
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = 'rgba(105, 75, 10, 0.75)';
    ctx.lineWidth = Math.max(1, camera.zoom * 0.8);
    ctx.strokeRect(bx, by, bw, bh);
  };
  goldBand(bodyLeft, bodyTop + bodyH * 0.35, bodyW, bodyH * 0.12);
  goldBand(bodyLeft, bodyTop, bodyW * 0.14, bodyH);
  goldBand(screen.x + bodyW / 2 - bodyW * 0.14, bodyTop, bodyW * 0.14, bodyH);
  const lockR = size * 0.09;
  ctx.fillStyle = '#f0d060';
  ctx.beginPath();
  ctx.arc(screen.x, bodyTop + bodyH * 0.42, lockR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(105, 75, 10, 0.85)';
  ctx.lineWidth = Math.max(1, camera.zoom * 0.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(screen.x - lockR * 0.3, bodyTop + bodyH * 0.42 - lockR * 0.3, lockR * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Treasure glow + coin/gem pile, only visible once the lid's open enough
  // to see inside — drawn before the lid so the lid still occludes it while
  // mostly closed.
  if (c.lidT > 0.3) {
    const revealT = Math.min(1, (c.lidT - 0.3) / 0.7);
    ctx.save();
    ctx.globalAlpha = revealT;
    const glowR = size * 0.9;
    const grad = ctx.createRadialGradient(screen.x, bodyTop, 0, screen.x, bodyTop, glowR);
    grad.addColorStop(0, 'rgba(255, 229, 130, 0.55)');
    grad.addColorStop(1, 'rgba(255, 229, 130, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screen.x, bodyTop, glowR, 0, Math.PI * 2);
    ctx.fill();
    const coinGrad = ctx.createLinearGradient(0, bodyTop - bodyH * 0.16, 0, bodyTop + bodyH * 0.28);
    coinGrad.addColorStop(0, '#fbe68a');
    coinGrad.addColorStop(1, '#d9a92e');
    ctx.fillStyle = coinGrad;
    ctx.beginPath();
    ctx.ellipse(screen.x, bodyTop + bodyH * 0.06, bodyW * 0.42, bodyH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 85, 10, 0.7)';
    ctx.lineWidth = Math.max(1, camera.zoom * 0.8);
    ctx.stroke();
    const gemColors = ['#ff6b6b', '#5ac8fa', '#7bd88f', '#f4cf4e', '#ff6b6b'];
    for (let i = 0; i < gemColors.length; i++) {
      const gx = screen.x + (i - 2) * bodyW * 0.13;
      const gy = bodyTop + bodyH * 0.02 - Math.abs(i - 2) * bodyH * 0.05;
      ctx.fillStyle = gemColors[i];
      ctx.beginPath();
      ctx.arc(gx, gy, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.55)';
      ctx.lineWidth = Math.max(0.8, camera.zoom * 0.7);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(gx - size * 0.03, gy - size * 0.03, size * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Lid — pivots open around its own bottom-left corner (per direct request,
  // "hinge at the bottom left or right corner instead of the bottom middle
  // of the lid") rather than the back-top-center line: the pivot point sits
  // at the body's own top-left corner, and the lid shape spans from there
  // (local x=0, the hinge, stays fixed) out to the far/right corner (local
  // x=lidW, which is what actually swings up and back). lidT 0 = closed
  // flat against the body, 1 = fully open (~112 degrees back).
  const lidAngle = -c.lidT * (Math.PI * 0.62);
  const lidW = bodyW * 1.02;
  const lidH = bodyH * 0.55;
  ctx.save();
  ctx.translate(screen.x - lidW / 2, bodyTop);
  ctx.rotate(lidAngle);
  ctx.fillStyle = hGrad(0, lidW, '#94633a', '#53331a');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -lidH * 0.15);
  ctx.quadraticCurveTo(0, -lidH, lidW / 2, -lidH);
  ctx.quadraticCurveTo(lidW, -lidH, lidW, -lidH * 0.15);
  ctx.lineTo(lidW, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = rim;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = hGrad(0, lidW, '#f4d968', '#b8902a');
  ctx.fillRect(0, -lidH * 0.42, lidW, lidH * 0.12);
  ctx.strokeStyle = 'rgba(105, 75, 10, 0.75)';
  ctx.lineWidth = Math.max(1, camera.zoom * 0.8);
  ctx.strokeRect(0, -lidH * 0.42, lidW, lidH * 0.12);
  ctx.restore();

  ctx.restore();
}

// ---- Sun Rays ----
// Per direct request ("sun rays/light beams in the background that shift and
// change throughout the game from the top right-ish down to the bottom
// left-ish of the screen") — a handful of soft, fanning light shafts anchored
// near the water's surface, biased toward the right side of the world and
// tilted down-and-left, each slowly drifting its own tilt/opacity over time
// via a sine wave on `elapsed` so the whole effect never looks static.
// Additive blending (globalCompositeOperation 'lighter') so overlapping rays
// brighten instead of muddying into an opaque wedge, same idea real
// underwater "god rays" reference photos show.
//
// Count/spread/size tuned over two follow-up requests: an earlier pass tried
// 7 rays across a 0.35-1.10 spread, then per direct report ("reduce back to
// 5... slightly bigger... spread a little more") — back down to 5 but
// spread SLIGHTLY wider than even that 7-ray pass (0.30-1.15) since fewer
// rays across the same-or-wider range reads as more spaced out, not more
// cramped. The per-ray xFrac values are still weighted toward the right
// half on average — keeping the original "top right-ish" bias. Width bumped
// again too (was 120-280, now 135-305) for "slightly bigger." Depth (20-60)
// straddles both the boulders/seaweed band (15-35) and the coral/urchin
// band (45-65), so individual rays land in front of some of each and behind
// others — see this file's header comment.
const SUN_RAY_COUNT = 5;
function randomSunRay(i) {
  return {
    xFrac: 0.3 + (i / SUN_RAY_COUNT) * 0.85, // spread across most of the world's width, still right-of-center on average
    xJitter: (Math.random() - 0.5) * 0.14,
    width: 135 + Math.random() * 170,
    tilt: -0.85 + Math.random() * 0.3, // negative = leans left going down, per "top right-ish to bottom left-ish"
    driftFreq: 0.025 + Math.random() * 0.04,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmp: 0.15 + Math.random() * 0.2,
    opacityFreq: 0.05 + Math.random() * 0.07,
    opacityPhase: Math.random() * Math.PI * 2,
    depth: 20 + Math.random() * 40,
  };
}
const sunRays = [];
for (let i = 0; i < SUN_RAY_COUNT; i++) sunRays.push(randomSunRay(i));

function drawOneSunRay(ctx, camera, canvasWidth, canvasHeight, ray) {
  const worldX = (ray.xFrac + ray.xJitter) * WORLD_W;
  const topScreen = worldToScreen(worldX, 0, camera);
  const tilt = ray.tilt + Math.sin(elapsed * ray.driftFreq + ray.driftPhase) * ray.driftAmp;
  const length = canvasHeight * 1.6;
  const topX = topScreen.x;
  const topY = topScreen.y - 60;
  const bottomX = topX + tilt * length;
  const bottomY = topY + length;
  const topWidth = ray.width * 0.28 * camera.zoom;
  const bottomWidth = ray.width * 1.35 * camera.zoom;
  if (Math.max(topX, bottomX) < -bottomWidth || Math.min(topX, bottomX) > canvasWidth + bottomWidth) return;
  if (topY > canvasHeight) return;
  const opacity = 0.05 + Math.max(0, Math.sin(elapsed * ray.opacityFreq + ray.opacityPhase)) * 0.05;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(topX, topY, bottomX, bottomY);
  grad.addColorStop(0, `rgba(255, 249, 214, ${opacity})`);
  grad.addColorStop(1, 'rgba(255, 249, 214, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(topX - topWidth, topY);
  ctx.lineTo(topX + topWidth, topY);
  ctx.lineTo(bottomX + bottomWidth, bottomY);
  ctx.lineTo(bottomX - bottomWidth, bottomY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---- Caustic Light Ripples ----
// Soft, slowly-drifting patches of light on the seabed floor, like sunlight
// refracting through the water surface — per direct request ("soft moving
// light patterns on the seabed floor... layered under the sun rays you
// already have"). A much lower depth than sun rays (3-9, vs. boulders'
// 15-35), so solid seabed scenery (boulders, coral, sand castles, buildings)
// always draws on top of/occludes it, the same "sits ON the sand, not above
// it" reasoning that keeps this from ever looking like it's floating in
// front of something solid. Each one is a single soft radial glow that
// drifts side to side and pulses in brightness, additive-blended ('lighter',
// same trick drawOneSunRay uses) so overlapping patches brighten instead of
// muddying into a flat color.
const CAUSTIC_COUNT = 9;
function randomCaustic(i) {
  return {
    xFrac: (i + Math.random() * 0.7) / CAUSTIC_COUNT,
    width: 70 + Math.random() * 90,
    height: 16 + Math.random() * 12,
    driftFreq: 0.04 + Math.random() * 0.06,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmp: 18 + Math.random() * 26,
    pulseFreq: 0.12 + Math.random() * 0.18,
    pulsePhase: Math.random() * Math.PI * 2,
    depth: 3 + Math.random() * 6,
  };
}
const caustics = [];
for (let i = 0; i < CAUSTIC_COUNT; i++) caustics.push(randomCaustic(i));

function drawOneCaustic(ctx, camera, canvasWidth, canvasHeight, c) {
  const worldX = c.xFrac * WORLD_W + Math.sin(elapsed * c.driftFreq + c.driftPhase) * c.driftAmp;
  const screen = worldToScreen(worldX, SEABED_FLOOR_Y, camera);
  const w = c.width * camera.zoom;
  const h = c.height * camera.zoom;
  if (screen.x < -w || screen.x > canvasWidth + w) return;
  if (screen.y < -h || screen.y > canvasHeight + h) return;
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * c.pulseFreq + c.pulsePhase);
  const opacity = 0.05 + pulse * 0.08;
  ctx.save();
  // 'screen' per direct request, replacing the old additive 'lighter' —
  // still brightens without the blown-out, oversaturated look 'lighter' can
  // get when several patches overlap.
  ctx.globalCompositeOperation = 'screen';
  const cy = screen.y - h * 0.35;
  const grad = ctx.createRadialGradient(screen.x, cy, 0, screen.x, cy, w * 0.55);
  grad.addColorStop(0, `rgba(255, 249, 214, ${opacity})`);
  grad.addColorStop(1, 'rgba(255, 249, 214, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(screen.x, cy, w * 0.55, h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Water Surface Line ----
// A subtle wavy shimmer right at the water's true top edge (world y=0,
// which is also camera.y's hard minimum — Engine.js's updateCamera clamps
// camera.y >= 0, so this line sits at the literal top of the tank, never
// scrollable past) — per direct request ("a subtle wavy 'waterline' with a
// slight shimmer where the water meets open air would sell the 'looking
// into a tank' framing"). Drawn directly (not part of the depth-sorted job
// system above) since it's one fixed-position global element, not a pool of
// scattered instances — main.js calls this once, right after the background
// fill and before any ambience/scenery, so kelp/seaweed tall enough to reach
// the top still draw over it, same as real plants breaking a water surface
// would. Safe to work entirely in SCREEN x (not world x) since the camera
// never pans horizontally — see Engine.js's own comment on that.
const WATER_SURFACE_WAVE_FREQ = 0.018;
const WATER_SURFACE_WAVE_SPEED = 0.5;
const WATER_SURFACE_WAVE_AMPLITUDE_PX = 3;
const WATER_SURFACE_SHIMMER_BAND_PX = 20; // world px of soft highlight below the line
const WATER_SURFACE_SPARKLE_COUNT = 10;
const waterSurfaceSparkles = [];
for (let i = 0; i < WATER_SURFACE_SPARKLE_COUNT; i++) {
  waterSurfaceSparkles.push({ xFrac: Math.random(), freq: 0.5 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2 });
}

export function renderWaterSurface(ctx, state, canvasWidth, canvasHeight) {
  const camera = state.camera;
  const screenY = worldToScreen(0, 0, camera).y;
  if (screenY < -40 || screenY > canvasHeight + 40) return; // the true top edge is scrolled well out of view — nothing to draw
  const zoom = camera.zoom;
  const amp = WATER_SURFACE_WAVE_AMPLITUDE_PX * zoom;
  const shimmerH = WATER_SURFACE_SHIMMER_BAND_PX * zoom;
  const waveY = (x) => screenY + Math.sin(x * WATER_SURFACE_WAVE_FREQ + elapsed * WATER_SURFACE_WAVE_SPEED) * amp;
  ctx.save();
  const grad = ctx.createLinearGradient(0, screenY, 0, screenY + shimmerH);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, screenY - 2, canvasWidth, shimmerH + 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = Math.max(1.2, 2 * zoom);
  ctx.beginPath();
  const step = 14;
  for (let x = -step; x <= canvasWidth + step; x += step) {
    const y = waveY(x);
    if (x === -step) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  for (const s of waterSurfaceSparkles) {
    const x = s.xFrac * canvasWidth;
    const twinkle = 0.5 + 0.5 * Math.sin(elapsed * s.freq + s.phase);
    if (twinkle < 0.65) continue;
    ctx.globalAlpha = (twinkle - 0.65) / 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, waveY(x) - 2, 1.4 * zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- Cursor Bubbles ----
// Per direct request ("moving the cursor creates bubbles -- size and amount
// of bubbles based on speed. A high cursor speed should do multiple bubbles
// a second") — a second, transient bubble population distinct from the
// ambient `bubbles` pool above: spawned on demand by main.js's per-frame
// mouse-move read (world-space speed, px/sec) instead of recycling forever,
// aging out via a TTL instead of wrapping back to the seabed. Capped so a
// long fast drag can't grow the array unboundedly.
// Bumped 40 -> 60 (matching the 50% MAX_RATE bump below) so the higher spawn
// rate doesn't just churn through the pool faster via `.shift()`.
const CURSOR_BUBBLE_MAX = 60;
// Per direct follow-up request ("reduce the threshold for the cursor
// velocity needed to spawn bubbles... it should spawn bubbles when even
// moving really slowly") — 60 -> 10, so only near-zero/jitter movement fails
// to spawn anything, not just slow deliberate movement.
// Per a further direct follow-up request ("reduce the cursor movement floor
// down from 10 to 5, so even moving 6px accumulates spawn debt") — 10 -> 5.
// Per a further direct follow-up request ("reduce the movement floor down to
// 3px from 5px") — 5 -> 3.
const CURSOR_BUBBLE_MIN_SPEED = 3; // world px/sec floor below which nothing spawns — plain hovering shouldn't spam bubbles
const CURSOR_BUBBLE_SPEED_FOR_MAX_RATE = 2200; // world px/sec at/above which spawn rate hits its cap
// Per direct follow-up request ("increase the amount of bubbles that spawn
// at the cursor by 50%") — 14 -> 21.
// Per a further direct follow-up request ("bump the amount of bubbles made
// with the cursor by 10% more") — 21 -> 23 (21 * 1.1 = 23.1, rounded).
// Per a further direct follow-up request ("increase the max extreme bubble
// spawn count by 20%") — 23 -> 28 (23 * 1.2 = 27.6, rounded).
// Per a further direct follow-up request ("increase the min and max bubble
// spawn amount... by 10%") — 28 -> 31 (28 * 1.1 = 30.8, rounded).
const CURSOR_BUBBLE_MAX_RATE = 31; // bubbles/sec at top speed — several a second, per direct request
// Per direct request ("make the bubbles that spawn from the cursor have way
// more initial velocity, actually matching the cursor to start before
// slowing and going up, and have the bubbles spawn slightly in front of the
// cursor") — a bubble now launches carrying (a multiple of) the cursor's own
// live velocity vector as a real, decaying burst (b.vx/b.vy — see
// updateAmbience's own cursorBubbles loop), instead of spawning with zero
// velocity and only ever drifting straight up. BURST_VELOCITY_MULTIPLIER
// pushes it past a 1:1 match ("way more") since a literal 1:1 copy already
// reads as fairly subdued once BURST_DRAG_PER_S's fast decay is applied.
// AHEAD_PX offsets the spawn point itself forward along that same direction
// (instead of spawning centered on/trailing the cursor), so a bubble looks
// like it's being kicked out ahead of the cursor's own motion rather than
// left behind it.
// Per direct follow-up request ("slightly reduce the velocity of bubbles
// that spawn from the cursor") — 2.2 -> 1.8, still well past a 1:1 match
// (still "way more" than the original zero-velocity spawn) but noticeably
// less aggressive than the first pass.
// Per direct follow-up request ("the bubbles have way too much velocity...
// needs to be like half the cursor velocity when the bubbles spawn") — the
// previous 1.8 was still read as far too fast, so this drops well below a
// 1:1 match down to roughly half the cursor's own speed.
// Per a further direct follow-up request ("make the bubble velocity...to be
// .3 that of the cursor velocity instead of .5") — 0.5 -> 0.3.
// Per a further direct follow-up request ("reduce the velocity... to .15x
// instead of .3x") — 0.3 -> 0.15.
// Per a further direct follow-up request ("increase the cursor bubble spawn
// velocity slightly to .18x") — 0.15 -> 0.18.
const CURSOR_BUBBLE_BURST_VELOCITY_MULTIPLIER = 0.18;
const CURSOR_BUBBLE_BURST_DRAG_PER_S = 5.5; // exponential decay rate — a burst is ~96% gone after 3/5.5 ≈ 0.55s ("...before slowing")
const CURSOR_BUBBLE_AHEAD_MIN_PX = 8;
const CURSOR_BUBBLE_AHEAD_MAX_PX = 20;
const cursorBubbles = [];
let cursorBubbleSpawnDebt = 0; // fractional-bubble accumulator so the spawn rate is smooth frame-to-frame instead of one-per-tick-if-any

export function spawnCursorBubbles(worldX, worldY, vx, vy, dtMs) {
  const dt = dtMs / 1000;
  const speedPxPerSec = Math.hypot(vx, vy);
  if (speedPxPerSec < CURSOR_BUBBLE_MIN_SPEED) { cursorBubbleSpawnDebt = 0; return; }
  const speedT = Math.min(1, (speedPxPerSec - CURSOR_BUBBLE_MIN_SPEED) / (CURSOR_BUBBLE_SPEED_FOR_MAX_RATE - CURSOR_BUBBLE_MIN_SPEED));
  cursorBubbleSpawnDebt += speedT * CURSOR_BUBBLE_MAX_RATE * dt;
  // Unit vector along the cursor's current travel direction — used both to
  // push the spawn point out ahead of the cursor and to aim the launch burst.
  const dirX = vx / speedPxPerSec;
  const dirY = vy / speedPxPerSec;
  while (cursorBubbleSpawnDebt >= 1) {
    cursorBubbleSpawnDebt -= 1;
    if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift(); // drop the oldest rather than refusing to spawn, so a sustained fast drag still reads as continuous
    const ahead = CURSOR_BUBBLE_AHEAD_MIN_PX + Math.random() * (CURSOR_BUBBLE_AHEAD_MAX_PX - CURSOR_BUBBLE_AHEAD_MIN_PX);
    cursorBubbles.push({
      x: worldX + dirX * ahead + (Math.random() - 0.5) * 8,
      y: worldY + dirY * ahead + (Math.random() - 0.5) * 8,
      vx: vx * CURSOR_BUBBLE_BURST_VELOCITY_MULTIPLIER * (0.85 + Math.random() * 0.3),
      vy: vy * CURSOR_BUBBLE_BURST_VELOCITY_MULTIPLIER * (0.85 + Math.random() * 0.3),
      radius: (2 + Math.random() * 3) * (0.6 + speedT * 0.8), // bigger bubbles at higher speed, per direct request
      speed: 30 + Math.random() * 30,
      wobbleFreq: 0.8 + Math.random() * 1.4,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 3 + Math.random() * 6,
      ageS: 0,
      ttlS: 1.6 + Math.random() * 1.2,
    });
  }
}

function renderCursorBubbles(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  for (const b of cursorBubbles) {
    const wobbleX = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const screen = worldToScreen(b.x + wobbleX, b.y, camera);
    if (screen.x < -20 || screen.x > canvasWidth + 20 || screen.y < -20 || screen.y > canvasHeight + 20) continue;
    const lifeT = b.ageS / b.ttlS;
    const fade = lifeT < 0.75 ? 1 : Math.max(0, 1 - (lifeT - 0.75) / 0.25); // holds full opacity, fades over the last quarter of its life
    const r = Math.max(1, b.radius * camera.zoom);
    ctx.globalAlpha = 0.4 * fade;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5 * fade;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(screen.x - r * 0.3, screen.y - r * 0.3, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Depth-sorted job list ----
// Built once, at module init — every instance above is a fixed pool that
// never changes size, so a job's closure just needs to keep referencing the
// live (mutable) instance object, not re-read anything about which objects
// exist. Split into two buckets by LAB_DEPTH_THRESHOLD so main.js can sit
// the Science Lab's own render call in between; each bucket is sorted
// ascending by depth so the painter's-algorithm draw order inside a bucket
// is also correct (e.g. a lower-depth sun ray behind a higher-depth boulder
// even though both are in the "behind lab" bucket).
const behindLabJobs = [];
const frontLabJobs = [];
function addAmbienceJob(depth, draw) {
  (depth < LAB_DEPTH_THRESHOLD ? behindLabJobs : frontLabJobs).push({ depth, draw });
}
for (const c of caustics) addAmbienceJob(c.depth, (ctx, camera, cw, ch) => drawOneCaustic(ctx, camera, cw, ch, c));
for (const b of boulders) addAmbienceJob(b.depth, (ctx, camera, cw) => drawOneBoulder(ctx, camera, cw, b));
for (const w of seaweeds) addAmbienceJob(w.depth, (ctx, camera, cw) => drawOneSeaweed(ctx, camera, cw, w));
for (const k of kelps) addAmbienceJob(k.depth, (ctx, camera, cw) => drawOneKelp(ctx, camera, cw, k));
for (const sc of sandCastles) addAmbienceJob(sc.depth, (ctx, camera, cw) => drawOneSandCastle(ctx, camera, cw, sc));
for (const c of corals) addAmbienceJob(c.depth, (ctx, camera, cw) => drawOneCoral(ctx, camera, cw, c));
for (const u of seaUrchins) addAmbienceJob(u.depth, (ctx, camera, cw) => drawOneSeaUrchin(ctx, camera, cw, u));
for (const c of crabs) addAmbienceJob(c.depth, (ctx, camera, cw) => drawOneCrab(ctx, camera, cw, c));
addAmbienceJob(treasureChest.depth, (ctx, camera, cw) => drawOneTreasureChest(ctx, camera, cw, treasureChest));
for (const ray of sunRays) addAmbienceJob(ray.depth, (ctx, camera, cw, ch) => drawOneSunRay(ctx, camera, cw, ch, ray));
behindLabJobs.sort((a, b) => a.depth - b.depth);
frontLabJobs.sort((a, b) => a.depth - b.depth);

// Everything at depth < LAB_DEPTH_THRESHOLD (boulders, seaweed/kelp, and
// whichever sun rays happened to roll a low depth) — main.js calls this,
// then renderScienceLab, then renderAmbienceFrontLab below.
export function renderAmbienceBehindLab(ctx, state, canvasWidth, canvasHeight) {
  for (const job of behindLabJobs) job.draw(ctx, state.camera, canvasWidth, canvasHeight);
}

// Shadow fish silhouettes — drawn as their own top-level pass, separate from
// the depth-sorted job queue above, so main.js can call it BEFORE
// renderBackgroundParallaxDecor. Per direct request ("the background
// silhouette fish go behind the duplicated background decorations") — they
// used to be folded into behindLabJobs (always the lowest depth, but still
// sandwiched between the water background and the blurred parallax layer in
// painter's-algorithm terms only by coincidence of call order); now it's
// explicit: shadow fish, THEN the blurred background decor, THEN everything
// else. Also renders their own occasional bubbles (see spawnShadowFishBubble)
// immediately after, since those originate from the same back-of-the-tank
// layer.
const SHADOW_FISH_DOWNSCALE = 4;
const shadowFishCanvas = document.createElement('canvas');
const shadowFishCtx = shadowFishCanvas.getContext('2d');
const shadowFishSmallCanvas = document.createElement('canvas');
const shadowFishSmallCtx = shadowFishSmallCanvas.getContext('2d');
export function renderShadowFish(ctx, state, canvasWidth, canvasHeight) {
  // Same pixelation as the background decor layer: draw to a scratch canvas,
  // shrink it, and stretch it back up.
  const w = Math.ceil(canvasWidth), h = Math.ceil(canvasHeight);
  const sw = Math.max(1, Math.ceil(w / SHADOW_FISH_DOWNSCALE)), sh = Math.max(1, Math.ceil(h / SHADOW_FISH_DOWNSCALE));
  if (shadowFishCanvas.width !== w || shadowFishCanvas.height !== h) { shadowFishCanvas.width = w; shadowFishCanvas.height = h; }
  if (shadowFishSmallCanvas.width !== sw || shadowFishSmallCanvas.height !== sh) { shadowFishSmallCanvas.width = sw; shadowFishSmallCanvas.height = sh; }
  shadowFishCtx.clearRect(0, 0, w, h);
  for (const f of shadowFish) drawOneShadowFish(shadowFishCtx, state.camera, canvasWidth, canvasHeight, f);
  shadowFishSmallCtx.clearRect(0, 0, sw, sh);
  shadowFishSmallCtx.drawImage(shadowFishCanvas, 0, 0, w, h, 0, 0, sw, sh);
  ctx.drawImage(shadowFishSmallCanvas, 0, 0, sw, sh, 0, 0, w, h);
  renderShadowBubbles(ctx, state.camera, canvasWidth, canvasHeight);
}

// Everything at depth >= LAB_DEPTH_THRESHOLD (coral, sea urchins, crabs, and
// the higher-rolled sun rays), plus bubbles/cursor bubbles — kept frontmost
// of the whole ambience layer, same as before, since they drift the entire
// water column and were never meant to be blocked by anything else here.
export function renderAmbienceFrontLab(ctx, state, canvasWidth, canvasHeight) {
  for (const job of frontLabJobs) job.draw(ctx, state.camera, canvasWidth, canvasHeight);
  renderBubbles(ctx, state.camera, canvasWidth, canvasHeight);
  renderCursorBubbles(ctx, state.camera, canvasWidth, canvasHeight);
}

// ---- Background Parallax Decor ----
// Per direct request ("add a secondary background layer for the
// decorations/substrate sitting on the upper tank floor... raised up
// vertically by approximately 20% of the tank height... heavy desaturation
// and a light Gaussian blur to give it depth-of-field"), later extended by a
// direct follow-up request ("make sure everything except for the mound/
// science lab is duplicated and procedurally placed on that layer as well...
// urchins and crabs that move... a chest that lets out bubbles... desaturated
// and blurry") — EVERY piece of floor decor in this file (seaweed, boulders,
// sand castles, coral, kelp, sea urchins, crabs, a treasure chest) gets a
// second, raised, muted copy, built from the exact same randomX generators
// as the real foreground pools so it reads as "the same kind of scenery,
// just further back," not a different art style.
//
// Perf note (why static vs. live are handled so differently below): this
// file already measured `ctx.filter` blur tanking frame rate hard on a mere
// 16 filtered strokes/frame (see drawOneSeaweed's own comment) — Chromium
// re-rasterizes each filtered draw individually, so it doesn't get cheaper
// by only setting `ctx.filter` once outside a loop. Applying a real blur
// filter to the FULL expanded decor set every single frame would revisit
// that exact regression (measured directly: filtering just 5 live objects
// individually roughly QUINTUPLED frame time). Instead, everything with NO
// per-frame POSITIONAL animation (seaweed, boulders, sand castles, coral,
// kelp, and sea urchins — an urchin's only "animation" is a 1-3px bob,
// imperceptible once frozen into a blurred background layer) is pre-rendered
// ONCE to an offscreen canvas with a real blur+desaturate filter applied at
// BAKE time only (see buildBgStaticCanvas) — every frame after that is just
// one cheap drawImage of the finished bitmap. The pieces that DO need real
// per-frame position changes (crabs roaming, the chest's open/close cycle +
// bubbles) are drawn live via renderLiveTinted, which fakes the
// desaturation with a `source-atop` tint fill (masked to the object's own
// silhouette, not a bounding box — no real filter, no per-frame blur cost)
// instead. The chest additionally gets a real single-object filtered blur
// (see renderLiveBlurredTinted) since filtering exactly one object measured
// as cheap, unlike looping it over many.
//
// Fully self-contained and decoupled from every other system here: its own
// pools, its own update/render functions, called separately by main.js.
const BG_PARALLAX_BOULDER_COUNT = 4;
// Per direct request ("there needs to be the same number of coral, seaweed,
// and urchins in the background layer as the foreground layer") — these
// three now mirror their foreground CORAL_COUNT/SEAWEED_COUNT/
// SEA_URCHIN_COUNT exactly, instead of a smaller sampled-down count.
const BG_PARALLAX_CORAL_COUNT = CORAL_COUNT;
const BG_PARALLAX_SAND_CASTLE_COUNT = 1;
const BG_PARALLAX_SEAWEED_COUNT = SEAWEED_COUNT;
const BG_PARALLAX_KELP_COUNT = 2;
const BG_PARALLAX_SEA_URCHIN_COUNT = SEA_URCHIN_COUNT;
const BG_PARALLAX_CRAB_COUNT = 3; // was 2 — +50% per direct request, same as the foreground
// Per direct request ("shrink the size of all the decorations in the
// background layer by 10%, leaving the foreground decorations... unchanged")
// — applied to every bg pool below via the shrinkX helpers (boulders/coral
// have precomputed per-branch/per-bump sub-fields that need scaling too, not
// just their own top-level `size`; sand castles/kelp/urchins/crabs/the chest
// derive everything else from their own width/height/radius/size at DRAW
// time, so scaling just that one field is enough for those).
const BG_PARALLAX_SIZE_SCALE = 0.9;
function shrinkBoulder(b) {
  b.size *= BG_PARALLAX_SIZE_SCALE;
  for (const bump of b.bumps) { bump.dx *= BG_PARALLAX_SIZE_SCALE; bump.r *= BG_PARALLAX_SIZE_SCALE; }
  return b;
}
function shrinkCoral(c) {
  c.size *= BG_PARALLAX_SIZE_SCALE;
  for (const br of c.branches) { br.length *= BG_PARALLAX_SIZE_SCALE; br.width *= BG_PARALLAX_SIZE_SCALE; }
  return c;
}
function shrinkSandCastle(sc) { sc.width *= BG_PARALLAX_SIZE_SCALE; sc.height *= BG_PARALLAX_SIZE_SCALE; return sc; }
function shrinkKelp(k) { k.height *= BG_PARALLAX_SIZE_SCALE; k.width *= BG_PARALLAX_SIZE_SCALE; return k; }
function shrinkSeaUrchin(u) { u.radius *= BG_PARALLAX_SIZE_SCALE; return u; }
function shrinkCrab(c) { c.size *= BG_PARALLAX_SIZE_SCALE; return c; }
function shrinkChest(c) { c.size *= BG_PARALLAX_SIZE_SCALE; return c; }
// Raises the layer ~20% of the water column's own height above the real
// floor line (SEABED_FLOOR_Y) — enough to visibly separate it from the
// foreground floor without floating it up into open water.
const BG_PARALLAX_FLOOR_Y = SEABED_FLOOR_Y - SEABED_FLOOR_Y * 0.2;
const BG_PARALLAX_ALPHA = 0.8; // shared by every piece of this layer (baked static bitmap, live crabs/chest, the ground) so they all read as one consistent layer

// ---- Static subset (baked once) ----
const bgBoulders = Array.from({ length: BG_PARALLAX_BOULDER_COUNT }, () => shrinkBoulder(randomBoulder()));
const bgCorals = Array.from({ length: BG_PARALLAX_CORAL_COUNT }, () => shrinkCoral(randomCoral()));
const bgSandCastles = Array.from({ length: BG_PARALLAX_SAND_CASTLE_COUNT }, () => shrinkSandCastle(randomSandCastle()));
const bgSeaweeds = Array.from({ length: BG_PARALLAX_SEAWEED_COUNT }, () => ({
  x: Math.random() * WORLD_W,
  height: (SEAWEED_MIN_HEIGHT + Math.random() * (SEAWEED_MAX_HEIGHT - SEAWEED_MIN_HEIGHT)) * BG_PARALLAX_SIZE_SCALE,
  width: (SEAWEED_MIN_WIDTH + Math.random() * (SEAWEED_MAX_WIDTH - SEAWEED_MIN_WIDTH)) * BG_PARALLAX_SIZE_SCALE,
  blurFactor: 0.6 + Math.random() * 0.55,
  // Live-animated (drawn every frame through renderLivePixelatedLayer), same sway ranges as the foreground strands.
  sway: 16 + Math.random() * 20,
  freq: 0.5 + Math.random() * 0.435,
  phase: Math.random() * Math.PI * 2,
  hue: 90 + Math.random() * 35,
}));
const bgKelps = Array.from({ length: BG_PARALLAX_KELP_COUNT }, () => shrinkKelp({ ...randomKelp(), sway: 0 })); // frozen, same reasoning as bgSeaweeds
// Per direct request ("the background urchins need to be blurred") — moved
// into the static baked subset (see the perf note above for why freezing an
// urchin's own tiny bob is an acceptable trade) so they get the same real
// blur/desaturate as everything else here, instead of the live/un-filtered
// treatment they used to share with crabs.
const bgSeaUrchins = Array.from({ length: BG_PARALLAX_SEA_URCHIN_COUNT }, () => shrinkSeaUrchin(randomSeaUrchin()));

// Offscreen canvas the static subset is drawn into exactly once, in WORLD
// pixels (1 world unit = 1 canvas pixel, no camera/zoom involved) spanning
// just the vertical band this decor actually occupies — tall enough for the
// tallest kelp/seaweed above BG_PARALLAX_FLOOR_Y, and down far enough below
// BG_PARALLAX_FLOOR_Y to cover the visible gap down to the REAL seabed line
// (SEABED_FLOOR_Y) — the real, opaque renderSeabedGrid draws over anything
// below that line anyway (it renders after this layer), so this only ever
// needs to cover the sliver of open water between the raised duplicate floor
// and the real one.
const BG_STATIC_CANVAS_MARGIN_ABOVE = SEAWEED_MAX_HEIGHT + 40;
const BG_STATIC_CANVAS_MARGIN_BELOW = Math.ceil(SEABED_FLOOR_Y - BG_PARALLAX_FLOOR_Y) + 40;
const bgStaticCanvas = document.createElement('canvas');
bgStaticCanvas.width = Math.ceil(WORLD_W);
bgStaticCanvas.height = Math.ceil(BG_STATIC_CANVAS_MARGIN_ABOVE + BG_STATIC_CANVAS_MARGIN_BELOW);
const BG_STATIC_TOP_WORLD_Y = BG_PARALLAX_FLOOR_Y - BG_STATIC_CANVAS_MARGIN_ABOVE;
function buildBgStaticCanvas() {
  const bctx = bgStaticCanvas.getContext('2d');
  bctx.clearRect(0, 0, bgStaticCanvas.width, bgStaticCanvas.height);
  // A fixed 1:1, no-pan "camera" so world coordinates land directly on this
  // canvas's own pixel grid — floorY passed to each drawOneX call is
  // BG_PARALLAX_FLOOR_Y translated into this local canvas space.
  const bakeCamera = { x: 0, y: BG_STATIC_TOP_WORLD_Y, zoom: 1 };
  const localFloorY = BG_PARALLAX_FLOOR_Y;
  bctx.save();
  bctx.filter = 'blur(4px) saturate(0.18) brightness(0.82)';
  // The duplicated tank bottom (see buildBgGroundCanvas below) is baked as
  // its OWN separate canvas and drawn last, on top of everything in this
  // layer — per direct request ("make sure all the components of the
  // background layer sit behind the background lower tank part that was
  // duplicated") — so it isn't drawn here at all any more.
  for (const b of bgBoulders) drawOneBoulder(bctx, bakeCamera, bgStaticCanvas.width, b, localFloorY);
  for (const k of bgKelps) drawOneKelp(bctx, bakeCamera, bgStaticCanvas.width, k, localFloorY);
  for (const c of bgCorals) drawOneCoral(bctx, bakeCamera, bgStaticCanvas.width, c, localFloorY);
  bctx.restore();
}
buildBgStaticCanvas();

// The duplicated "bottom of the tank" itself, baked separately from the
// decor above so it can be drawn LAST — on top of every other piece of this
// layer (the static decor bitmap AND the live crabs/chest) — per direct
// request ("make sure all the components of the background layer sit behind
// the background lower tank part that was duplicated"). Same world
// placement/size as bgStaticCanvas so it can reuse the exact same camera
// transform when drawn.
const bgGroundCanvas = document.createElement('canvas');
bgGroundCanvas.width = bgStaticCanvas.width;
bgGroundCanvas.height = bgStaticCanvas.height;
function buildBgGroundCanvas() {
  const gctx = bgGroundCanvas.getContext('2d');
  gctx.clearRect(0, 0, bgGroundCanvas.width, bgGroundCanvas.height);
  const localFloorYPx = worldToScreen(0, BG_PARALLAX_FLOOR_Y, { x: 0, y: BG_STATIC_TOP_WORLD_Y, zoom: 1 }).y;
  gctx.save();
  gctx.filter = 'blur(4px) saturate(0.18) brightness(0.82)'; // same params as buildBgStaticCanvas's own filter, so the two read as one layer
  const groundGradient = gctx.createLinearGradient(0, localFloorYPx, 0, bgGroundCanvas.height);
  groundGradient.addColorStop(0, '#5b4530');
  groundGradient.addColorStop(0.5, '#4a3624');
  groundGradient.addColorStop(1, '#372414');
  gctx.fillStyle = groundGradient;
  gctx.fillRect(0, localFloorYPx, bgGroundCanvas.width, bgGroundCanvas.height - localFloorYPx);
  gctx.restore();
}
buildBgGroundCanvas();

// ---- Live subset (drawn every frame; see this section's own perf note) ----
const bgCrabs = Array.from({ length: BG_PARALLAX_CRAB_COUNT }, () => shrinkCrab(randomCrab()));
const bgTreasureChest = shrinkChest(randomTreasureChest());
// Bubbles from the background crabs/chest land here instead of the real
// cursorBubbles pool, so they can get their own muted rendering (see
// renderBgBubbles) instead of the crisp white foreground look.
const bgBubbles = [];

function updateBackgroundParallaxDecor(dt) {
  const dragMul = Math.exp(-CURSOR_BUBBLE_BURST_DRAG_PER_S * dt);
  updateCrabs(dt, bgCrabs, bgBubbles, BG_PARALLAX_FLOOR_Y);
  updateTreasureChest(dt, bgTreasureChest, bgBubbles, BG_PARALLAX_FLOOR_Y);
  updateSimpleBubblePool(bgBubbles, dt, dragMul);
}

// Per direct follow-up request ("make the background bubbles from all the
// background sources slightly darker and more blurred") — darker grey-blue
// (was 150-195 range, now 70-110) and, since a real per-bubble ctx.filter
// blur would add a filtered draw call per bubble (expensive at any bubble
// count — see this section's own perf note), the "blur" is faked the cheap
// way instead: a soft radial gradient (fading fully to transparent at its
// own edge) in place of the old flat-alpha fill + crisp stroke outline —
// gradients read as soft-edged with no filter cost, while a stroked circle
// reads as sharp/crisp regardless of alpha. Shared by renderBgBubbles (the
// background crabs'/chest's own bubbles) and renderShadowBubbles (the
// background silhouette fish's), since both are "background bubble sources."
function drawSoftMutedBubble(ctx, x, y, r, alpha) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  grad.addColorStop(0, `rgba(70, 90, 105, ${(alpha * 0.9).toFixed(3)})`);
  grad.addColorStop(0.6, `rgba(85, 105, 120, ${(alpha * 0.55).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(85, 105, 120, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
  ctx.fill();
}

// Reused here for the background crabs'/chest's own bubbles instead of a
// shadow fish's — see drawSoftMutedBubble's own comment above.
function renderBgBubbles(ctx, camera, canvasWidth, canvasHeight) {
  for (const b of bgBubbles) {
    const wobbleX = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const screen = worldToScreen(b.x + wobbleX, b.y, camera);
    if (screen.x < -20 || screen.x > canvasWidth + 20 || screen.y < -20 || screen.y > canvasHeight + 20) continue;
    const lifeT = b.ageS / b.ttlS;
    const fade = lifeT < 0.75 ? 1 : Math.max(0, 1 - (lifeT - 0.75) / 0.25);
    const r = Math.max(1, b.radius * camera.zoom);
    drawSoftMutedBubble(ctx, screen.x, screen.y, r, 0.3 * fade);
  }
}

// ---- Desaturating the LIVE pieces (sea urchins/crabs/the chest) ----
// Per direct follow-up request ("change the urchins, crabs and chest to
// match [the seaweed/coral/rocks/sand castles] instead of having a gray
// square around each one of them") — the FIRST attempt at this (a flat
// composite-mode fillRect clipped to each object's bounding RECTANGLE)
// tinted the whole rectangle uniformly, including all the plain background
// water visible through the gaps in an object's own silhouette — reading as
// a visible gray square. A SECOND attempt (draw onto a small scratch canvas,
// then a single `ctx.filter` blur+saturate blit of that whole scratch per
// object) fixed the square but measured a much bigger frame-rate hit than
// expected — profiling showed `ctx.filter`'s cost scales with the FILTERED
// SOURCE AREA, not just "once per object," so even one call per object over
// a modest scratch canvas was expensive.
//
// This version drops `ctx.filter` entirely: draw the object at full color
// onto a small reusable scratch canvas, then tint it with
// `globalCompositeOperation = 'source-atop'` — which, unlike 'saturation'/
// 'color', only ever paints over pixels the destination ALREADY has alpha
// on, leaving the scratch canvas's transparent background untouched. That's
// what actually fixes the square (the tint is masked to the object's own
// silhouette by construction) without needing any per-pixel filter pass —
// just one extra fillRect, exactly as cheap as any other draw call here.
// True blur is skipped for these few live/animated pieces (the cost of
// literally re-blurring them every frame isn't worth it); the muted tint
// plus their small size/position among the already-blurred static bake is
// enough for them to read as part of the same background layer.
const LIVE_TINT_SCRATCH_SIZE = 260;
const LIVE_TINT_SCRATCH_CENTER = LIVE_TINT_SCRATCH_SIZE / 2;
const liveTintScratch = document.createElement('canvas');
liveTintScratch.width = LIVE_TINT_SCRATCH_SIZE;
liveTintScratch.height = LIVE_TINT_SCRATCH_SIZE;
const liveTintScratchCtx = liveTintScratch.getContext('2d');

// drawFn(ctx, localCamera, canvasWidth) must draw the object using worldX/
// floorY exactly as it would with the real camera — localCamera is built so
// that (worldX, floorY) lands dead-center on the scratch canvas regardless
// of the real camera's own pan, at the same zoom (so sizing still matches
// the rest of the scene).
function renderLiveTinted(destCtx, camera, canvasWidth, worldX, floorY, drawFn) {
  const realScreen = worldToScreen(worldX, floorY, camera);
  if (realScreen.x < -LIVE_TINT_SCRATCH_SIZE || realScreen.x > canvasWidth + LIVE_TINT_SCRATCH_SIZE) return;
  liveTintScratchCtx.clearRect(0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
  const localCamera = {
    x: worldX - LIVE_TINT_SCRATCH_CENTER / camera.zoom,
    y: floorY - LIVE_TINT_SCRATCH_CENTER / camera.zoom,
    zoom: camera.zoom,
  };
  drawFn(liveTintScratchCtx, localCamera, LIVE_TINT_SCRATCH_SIZE);
  liveTintScratchCtx.globalCompositeOperation = 'source-atop';
  liveTintScratchCtx.fillStyle = 'rgba(110, 140, 165, 0.6)'; // same blue-grey the static bake's own saturate/brightness filter settles toward
  liveTintScratchCtx.fillRect(0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
  liveTintScratchCtx.globalCompositeOperation = 'source-over';
  destCtx.drawImage(liveTintScratch, 0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE, realScreen.x - LIVE_TINT_SCRATCH_CENTER, realScreen.y - LIVE_TINT_SCRATCH_CENTER, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
}

// Per direct follow-up request ("fix the chest in the background to be
// darker and more blurry... right now it just looks washed out") — the
// chest's own bright gold/gem colors showed through the plain tint above far
// more than the muted rocks/crabs did, reading as "veiled" rather than
// genuinely darkened. This variant uses a darker, more opaque tint, plus a
// cheap fake blur: downscaling the tinted scratch canvas down to a tiny
// bitmap and immediately drawing THAT back out at full size (bilinear
// resampling on both the down- and up-scale blends neighboring pixels
// together, reading as soft/blurred) — no `ctx.filter` involved. A real
// filter here was tried first and measured costing 15-18fps EVEN FOR THIS
// SINGLE OBJECT in this environment (filtering a modest scratch canvas isn't
// "cheap because it's only one call" — the earlier assumption to that effect
// was wrong), so it's avoided entirely now, the same as every other live
// piece in this file.
const LIVE_BLUR_DOWNSCALE_SIZE = 36;
const liveBlurDownscaleCanvas = document.createElement('canvas');
liveBlurDownscaleCanvas.width = LIVE_BLUR_DOWNSCALE_SIZE;
liveBlurDownscaleCanvas.height = LIVE_BLUR_DOWNSCALE_SIZE;
const liveBlurDownscaleCtx = liveBlurDownscaleCanvas.getContext('2d');

function renderLiveBlurredTinted(destCtx, camera, canvasWidth, worldX, floorY, drawFn) {
  const realScreen = worldToScreen(worldX, floorY, camera);
  if (realScreen.x < -LIVE_TINT_SCRATCH_SIZE || realScreen.x > canvasWidth + LIVE_TINT_SCRATCH_SIZE) return;
  liveTintScratchCtx.clearRect(0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
  const localCamera = {
    x: worldX - LIVE_TINT_SCRATCH_CENTER / camera.zoom,
    y: floorY - LIVE_TINT_SCRATCH_CENTER / camera.zoom,
    zoom: camera.zoom,
  };
  drawFn(liveTintScratchCtx, localCamera, LIVE_TINT_SCRATCH_SIZE);
  liveTintScratchCtx.globalCompositeOperation = 'source-atop';
  liveTintScratchCtx.fillStyle = 'rgba(55, 75, 92, 0.82)'; // darker + more opaque than renderLiveTinted's own tint
  liveTintScratchCtx.fillRect(0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
  liveTintScratchCtx.globalCompositeOperation = 'source-over';
  liveBlurDownscaleCtx.clearRect(0, 0, LIVE_BLUR_DOWNSCALE_SIZE, LIVE_BLUR_DOWNSCALE_SIZE);
  liveBlurDownscaleCtx.drawImage(liveTintScratch, 0, 0, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE, 0, 0, LIVE_BLUR_DOWNSCALE_SIZE, LIVE_BLUR_DOWNSCALE_SIZE);
  destCtx.drawImage(liveBlurDownscaleCanvas, 0, 0, LIVE_BLUR_DOWNSCALE_SIZE, LIVE_BLUR_DOWNSCALE_SIZE, realScreen.x - LIVE_TINT_SCRATCH_CENTER, realScreen.y - LIVE_TINT_SCRATCH_CENTER, LIVE_TINT_SCRATCH_SIZE, LIVE_TINT_SCRATCH_SIZE);
}

// Seaweed, sand castles, urchins and crabs get the same treatment as the
// chest (dark source-atop tint, then a down/up-scale to fake blur and read as
// pixelated background), but batched: all four are drawn into ONE band-sized
// scratch canvas, tinted once, and resampled once, instead of a scratch per
// object. The downscale is gentler than the chest's (1/LIVE_LAYER_DOWNSCALE
// vs ~1/7) so thin seaweed strokes survive it. Drawn live every frame so
// seaweed sways and urchins bob exactly like the foreground ones.
const LIVE_LAYER_DOWNSCALE = 4;
const liveLayerCanvas = document.createElement('canvas');
const liveLayerCtx = liveLayerCanvas.getContext('2d');
const liveLayerSmallCanvas = document.createElement('canvas');
const liveLayerSmallCtx = liveLayerSmallCanvas.getContext('2d');
function renderLivePixelatedLayer(destCtx, camera, canvasWidth, destY, destH) {
  const w = Math.ceil(canvasWidth);
  const h = Math.ceil(destH);
  if (w <= 0 || h <= 0) return;
  const sw = Math.max(1, Math.ceil(w / LIVE_LAYER_DOWNSCALE));
  const sh = Math.max(1, Math.ceil(h / LIVE_LAYER_DOWNSCALE));
  if (liveLayerCanvas.width !== w || liveLayerCanvas.height !== h) { liveLayerCanvas.width = w; liveLayerCanvas.height = h; }
  if (liveLayerSmallCanvas.width !== sw || liveLayerSmallCanvas.height !== sh) { liveLayerSmallCanvas.width = sw; liveLayerSmallCanvas.height = sh; }
  liveLayerCtx.clearRect(0, 0, w, h);
  // Same x pan/zoom as the real camera, but y anchored to the top of this band.
  const bandCamera = { x: camera.x, y: BG_STATIC_TOP_WORLD_Y, zoom: camera.zoom };
  for (const wd of bgSeaweeds) drawOneSeaweed(liveLayerCtx, bandCamera, w, wd, BG_PARALLAX_FLOOR_Y);
  for (const sc of bgSandCastles) drawOneSandCastle(liveLayerCtx, bandCamera, w, sc, BG_PARALLAX_FLOOR_Y);
  for (const u of bgSeaUrchins) drawOneSeaUrchin(liveLayerCtx, bandCamera, w, u, BG_PARALLAX_FLOOR_Y);
  for (const c of bgCrabs) drawOneCrab(liveLayerCtx, bandCamera, w, c, BG_PARALLAX_FLOOR_Y);
  liveLayerCtx.globalCompositeOperation = 'source-atop';
  liveLayerCtx.fillStyle = 'rgba(55, 75, 92, 0.82)'; // same dark tint as renderLiveBlurredTinted (the chest)
  liveLayerCtx.fillRect(0, 0, w, h);
  liveLayerCtx.globalCompositeOperation = 'source-over';
  liveLayerSmallCtx.clearRect(0, 0, sw, sh);
  liveLayerSmallCtx.drawImage(liveLayerCanvas, 0, 0, w, h, 0, 0, sw, sh);
  destCtx.drawImage(liveLayerSmallCanvas, 0, 0, sw, sh, 0, destY, w, h);
}

export function renderBackgroundParallaxDecor(ctx, camera, canvasWidth, canvasHeight) {
  // The baked static bitmap (seaweed/boulders/kelp/sand castles/coral/
  // urchins), scaled/positioned to match the current camera — one drawImage
  // instead of redrawing 50+ shapes, see this section's own perf note above.
  const topLeft = worldToScreen(0, BG_STATIC_TOP_WORLD_Y, camera);
  const destW = bgStaticCanvas.width * camera.zoom;
  const destH = bgStaticCanvas.height * camera.zoom;
  ctx.save();
  ctx.globalAlpha = BG_PARALLAX_ALPHA;
  ctx.drawImage(bgStaticCanvas, 0, 0, bgStaticCanvas.width, bgStaticCanvas.height, topLeft.x, topLeft.y, destW, destH);

  // Live animated pieces — crabs get the cheap tint-only treatment, the
  // (single) chest additionally gets the downscale/upscale fake-blur (see
  // renderLiveBlurredTinted above), all at the same overall opacity so they
  // read as one layer.
  renderLivePixelatedLayer(ctx, camera, canvasWidth, topLeft.y, destH);
  renderLiveBlurredTinted(ctx, camera, canvasWidth, bgTreasureChest.x, BG_PARALLAX_FLOOR_Y, (c2, cam2, cw2) => drawOneTreasureChest(c2, cam2, cw2, bgTreasureChest, BG_PARALLAX_FLOOR_Y));
  renderBgBubbles(ctx, camera, canvasWidth, canvasHeight);

  // The duplicated tank bottom, drawn LAST — on top of the static decor AND
  // the live crabs/chest above — per direct request ("make sure all the
  // components of the background layer sit behind the background lower tank
  // part that was duplicated"). Shares bgStaticCanvas's own placement/size,
  // so the same transform applies unchanged.
  ctx.drawImage(bgGroundCanvas, 0, 0, bgGroundCanvas.width, bgGroundCanvas.height, topLeft.x, topLeft.y, destW, destH);
  ctx.restore();
}

