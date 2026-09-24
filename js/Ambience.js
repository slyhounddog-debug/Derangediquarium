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
    sway: 16 + Math.random() * 24, // was 10 + rand*16 — bumped up per direct request for more noticeable background seaweed movement
    freq: 0.5 + Math.random() * 0.6, // was 0.35 + rand*0.45 — faster sway to match the wider amplitude above
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
const SHADOW_FISH_DEEP = { r: 28, g: 48, b: 68 }; // most visible a fish ever gets — still a muted, desaturated blue-grey, never true black
const SHADOW_FISH_FAINT = { r: 96, g: 142, b: 178 }; // blends almost into the open-water background color
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
const SHADOW_FISH_COUNT = 5;
const SHADOW_FISH_MIN_SIZE = 20;
const SHADOW_FISH_MAX_SIZE = 42;
// Per direct request ("add a few more, even more faint, much bigger fish
// silhouettes in the background") — a second, smaller pool sharing every
// mechanic the regular shadow fish already have (drift, wrap, bob, tail-wag),
// just bigger and blended further toward the faint end of the color range.
const SHADOW_FISH_BIG_COUNT = 3;
const SHADOW_FISH_BIG_MIN_SIZE = 70;
const SHADOW_FISH_BIG_MAX_SIZE = 130;
function randomShadowFish(big) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const minSize = big ? SHADOW_FISH_BIG_MIN_SIZE : SHADOW_FISH_MIN_SIZE;
  const maxSize = big ? SHADOW_FISH_BIG_MAX_SIZE : SHADOW_FISH_MAX_SIZE;
  const blendT = big ? 0.55 + Math.random() * 0.3 : 0.15 + Math.random() * 0.35;
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
    depth: Math.random() * 10, // always the furthest-back layer, below every sun ray
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
  }
  updateCrabs(dt);
  for (let i = cursorBubbles.length - 1; i >= 0; i--) {
    const b = cursorBubbles[i];
    b.ageS += dt;
    b.y -= b.speed * dt;
    if (b.ageS >= b.ttlS) cursorBubbles.splice(i, 1);
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
  const bobY = f.baseY + Math.sin(elapsed * f.bobFreq + f.bobPhase) * f.bobAmp;
  const screen = worldToScreen(f.x, bobY, camera);
  const size = f.size * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2 || screen.y < -size || screen.y > canvasHeight + size) return;
  // A slight tail-wag "squash" on the horizontal scale, same idea as a real
  // fish's own tail animation, just baked into one silhouette shape rather
  // than a separate animated tail segment — cheap enough to still read as
  // "swimming," not just sliding.
  const wag = 1 + Math.sin(elapsed * f.tailFreq + f.tailPhase) * 0.06;
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(wag, 1);
  drawShadowFishSilhouette(ctx, 0, 0, size, f.dir, f.fillColor, f.haloColor);
  ctx.restore();
}

// Fakes a soft/blurred edge cheaply instead of the real thing — a canvas 2D
// `ctx.filter` blur was tried first and tanked frame rate hard (measured
// ~60fps -> ~11fps with just 16 filtered strokes a frame; Chromium
// re-rasterizes a filtered draw call individually rather than batching a
// whole filtered region, so it doesn't get cheaper by only setting the
// filter once outside the loop). A wide, very transparent stroke underneath
// a narrower, slightly more opaque one reads as "soft-edged" at the low
// opacity/small scale this renders at, for a fraction of the cost.
function drawOneSeaweed(ctx, camera, canvasWidth, w) {
  const screen = worldToScreen(w.x, SEABED_FLOOR_Y, camera);
  if (screen.x < -100 || screen.x > canvasWidth + 100) return;
  ctx.save();
  ctx.lineCap = 'round';
  const sway = Math.sin(elapsed * w.freq + w.phase) * w.sway * camera.zoom;
  const h = w.height * camera.zoom;
  const baseWidth = Math.max(2, w.width * camera.zoom);
  ctx.strokeStyle = `hsl(${w.hue}, 42%, 32%)`;
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y + 2);
  ctx.quadraticCurveTo(screen.x + sway, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
  ctx.globalAlpha = 0.1 * w.blurFactor;
  ctx.lineWidth = baseWidth * 2.2 * w.blurFactor;
  ctx.stroke();
  ctx.globalAlpha = 0.24;
  ctx.lineWidth = baseWidth;
  ctx.stroke();
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
const BOULDER_COUNT = 7;
function randomBoulder() {
  const size = 26 + Math.random() * 30;
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

function drawOneBoulder(ctx, camera, canvasWidth, b) {
  const screen = worldToScreen(b.x, SEABED_FLOOR_Y, camera);
  const size = b.size * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) return;
  ctx.save();
  for (const bump of b.bumps) {
    const r = bump.r * camera.zoom;
    const grey = Math.round(90 * b.shade);
    ctx.fillStyle = `rgb(${grey}, ${grey}, ${Math.round(grey * 1.08)})`;
    ctx.beginPath();
    ctx.arc(screen.x + bump.dx * camera.zoom, screen.y - r * 0.55, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // A soft dark contact shadow where the boulder meets the floor, same
  // "grounds it" trick the Mound's own rubble base uses.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y, size * 0.75, size * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Sea Urchins ----
// Small spiky dark orbs dotted along the floor — per direct request ("major
// background additions... sea urchins"). Static like boulders, just a
// center dot plus a ring of thin radiating spike lines. Always in front of
// the Science Lab, per direct request.
const SEA_URCHIN_COUNT = 10;
function randomSeaUrchin() {
  return {
    x: Math.random() * WORLD_W,
    radius: 5 + Math.random() * 5,
    spikeCount: 10 + Math.floor(Math.random() * 6),
    hue: 265 + Math.random() * 30, // deep purple-violet, the classic urchin color
    depth: 45 + Math.random() * 20, // always >= LAB_DEPTH_THRESHOLD — urchins always draw in front of the Science Lab
  };
}
const seaUrchins = [];
for (let i = 0; i < SEA_URCHIN_COUNT; i++) seaUrchins.push(randomSeaUrchin());

function drawOneSeaUrchin(ctx, camera, canvasWidth, u) {
  const screen = worldToScreen(u.x, SEABED_FLOOR_Y, camera);
  const r = u.radius * camera.zoom;
  if (screen.x < -r * 4 || screen.x > canvasWidth + r * 4) return;
  ctx.save();
  const cy = screen.y - r * 0.6;
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
const CORAL_COUNT = 9;
const CORAL_HUES = [340, 20, 280, 45]; // pink, orange, purple, golden-yellow
function randomCoral() {
  const size = 22 + Math.random() * 26;
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
  };
}
const corals = [];
for (let i = 0; i < CORAL_COUNT; i++) corals.push(randomCoral());

function drawOneCoral(ctx, camera, canvasWidth, c) {
  const screen = worldToScreen(c.x, SEABED_FLOOR_Y, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const br of c.branches) {
    const len = br.length * camera.zoom;
    const endX = screen.x + Math.cos(br.angle) * len;
    const endY = screen.y + Math.sin(br.angle) * len;
    ctx.strokeStyle = `hsl(${c.hue}, 60%, 55%)`;
    ctx.lineWidth = Math.max(1.5, br.width * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.fillStyle = `hsl(${c.hue}, 65%, 62%)`;
    ctx.beginPath();
    ctx.arc(endX, endY, Math.max(1.5, br.width * 0.6 * camera.zoom), 0, Math.PI * 2);
    ctx.fill();
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
    sway: 20 + Math.random() * 18,
    freq: 0.3 + Math.random() * 0.35,
    phase: Math.random() * Math.PI * 2,
    hue: 40 + Math.random() * 20,
    depth: 15 + Math.random() * 20, // always < LAB_DEPTH_THRESHOLD — same band as seaweed/boulders
  };
}
const kelps = [];
for (let i = 0; i < KELP_COUNT; i++) kelps.push(randomKelp());

function drawOneKelp(ctx, camera, canvasWidth, k) {
  const screen = worldToScreen(k.x, SEABED_FLOOR_Y, camera);
  if (screen.x < -100 || screen.x > canvasWidth + 100) return;
  ctx.save();
  const sway = Math.sin(elapsed * k.freq + k.phase) * k.sway * camera.zoom;
  const h = k.height * camera.zoom;
  const w = k.width * camera.zoom;
  ctx.fillStyle = `hsla(${k.hue}, 45%, 30%, 0.55)`;
  ctx.beginPath();
  ctx.moveTo(screen.x - w / 2, screen.y);
  ctx.quadraticCurveTo(screen.x + sway - w * 0.3, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
  ctx.quadraticCurveTo(screen.x + sway + w * 0.3, screen.y - h * 0.5, screen.x + w / 2, screen.y);
  ctx.closePath();
  ctx.fill();
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
const CRAB_COUNT = 4;
function randomCrab() {
  const homeX = Math.random() * WORLD_W;
  const depth = Math.random() < 0.75 ? 55 + Math.random() * 20 : 44 + Math.random() * 10;
  return {
    x: homeX,
    homeX,
    range: 60 + Math.random() * 100,
    dir: Math.random() < 0.5 ? 1 : -1,
    speed: 10 + Math.random() * 14,
    size: 8 + Math.random() * 6,
    legPhaseFreq: 6 + Math.random() * 3,
    hue: 10 + Math.random() * 20,
    pauseTimer: Math.random() * 2,
    depth,
  };
}
const crabs = [];
for (let i = 0; i < CRAB_COUNT; i++) crabs.push(randomCrab());

function updateCrabs(dt) {
  for (const c of crabs) {
    if (c.pauseTimer > 0) {
      c.pauseTimer -= dt;
      continue;
    }
    c.x += c.speed * c.dir * dt;
    if (Math.abs(c.x - c.homeX) > c.range) {
      c.dir *= -1;
      c.pauseTimer = 0.4 + Math.random() * 1.2;
    }
  }
}

function drawOneCrab(ctx, camera, canvasWidth, c) {
  const screen = worldToScreen(c.x, SEABED_FLOOR_Y, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 3 || screen.x > canvasWidth + size * 3) return;
  ctx.save();
  const legSwing = c.pauseTimer > 0 ? 0 : Math.sin(elapsed * c.legPhaseFreq) * 0.4;
  ctx.strokeStyle = `hsl(${c.hue}, 55%, 30%)`;
  ctx.lineWidth = Math.max(1, camera.zoom);
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
  ctx.fillStyle = `hsl(${c.hue}, 60%, 42%)`;
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - size * 0.3, size, size * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${c.hue}, 60%, 46%)`;
  ctx.beginPath();
  ctx.arc(screen.x - size * 1.1, screen.y - size * 0.5, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(screen.x + size * 1.1, screen.y - size * 0.5, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
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
// Spread wider and sized up per direct follow-up request: count bumped
// 5 -> 7 and the world-fraction spread widened (0.35-1.10 vs. the old
// 0.55-1.0) so they read as scattered across most of the width rather than
// clustered tight to the right edge, while the per-ray xFrac values are
// still weighted toward the right half on average — keeping the original
// "top right-ish" bias. Width bumped ~30% (top/bottom multipliers too) for
// "make each one a little bigger." Depth (20-60) straddles both the
// boulders/seaweed band (15-35) and the coral/urchin band (45-65), so
// individual rays land in front of some of each and behind others — see
// this file's header comment.
const SUN_RAY_COUNT = 7;
function randomSunRay(i) {
  return {
    xFrac: 0.35 + (i / SUN_RAY_COUNT) * 0.75, // spread across most of the world's width, still right-of-center on average
    xJitter: (Math.random() - 0.5) * 0.14,
    width: 120 + Math.random() * 160,
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

// ---- Cursor Bubbles ----
// Per direct request ("moving the cursor creates bubbles -- size and amount
// of bubbles based on speed. A high cursor speed should do multiple bubbles
// a second") — a second, transient bubble population distinct from the
// ambient `bubbles` pool above: spawned on demand by main.js's per-frame
// mouse-move read (world-space speed, px/sec) instead of recycling forever,
// aging out via a TTL instead of wrapping back to the seabed. Capped so a
// long fast drag can't grow the array unboundedly.
const CURSOR_BUBBLE_MAX = 40;
const CURSOR_BUBBLE_MIN_SPEED = 60; // world px/sec floor below which nothing spawns — plain hovering shouldn't spam bubbles
const CURSOR_BUBBLE_SPEED_FOR_MAX_RATE = 2200; // world px/sec at/above which spawn rate hits its cap
const CURSOR_BUBBLE_MAX_RATE = 14; // bubbles/sec at top speed — several a second, per direct request
const cursorBubbles = [];
let cursorBubbleSpawnDebt = 0; // fractional-bubble accumulator so the spawn rate is smooth frame-to-frame instead of one-per-tick-if-any

export function spawnCursorBubbles(worldX, worldY, speedPxPerSec, dtMs) {
  const dt = dtMs / 1000;
  if (speedPxPerSec < CURSOR_BUBBLE_MIN_SPEED) { cursorBubbleSpawnDebt = 0; return; }
  const speedT = Math.min(1, (speedPxPerSec - CURSOR_BUBBLE_MIN_SPEED) / (CURSOR_BUBBLE_SPEED_FOR_MAX_RATE - CURSOR_BUBBLE_MIN_SPEED));
  cursorBubbleSpawnDebt += speedT * CURSOR_BUBBLE_MAX_RATE * dt;
  while (cursorBubbleSpawnDebt >= 1) {
    cursorBubbleSpawnDebt -= 1;
    if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift(); // drop the oldest rather than refusing to spawn, so a sustained fast drag still reads as continuous
    cursorBubbles.push({
      x: worldX + (Math.random() - 0.5) * 10,
      y: worldY + (Math.random() - 0.5) * 10,
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
for (const f of shadowFish) addAmbienceJob(f.depth, (ctx, camera, cw, ch) => drawOneShadowFish(ctx, camera, cw, ch, f));
for (const b of boulders) addAmbienceJob(b.depth, (ctx, camera, cw) => drawOneBoulder(ctx, camera, cw, b));
for (const w of seaweeds) addAmbienceJob(w.depth, (ctx, camera, cw) => drawOneSeaweed(ctx, camera, cw, w));
for (const k of kelps) addAmbienceJob(k.depth, (ctx, camera, cw) => drawOneKelp(ctx, camera, cw, k));
for (const c of corals) addAmbienceJob(c.depth, (ctx, camera, cw) => drawOneCoral(ctx, camera, cw, c));
for (const u of seaUrchins) addAmbienceJob(u.depth, (ctx, camera, cw) => drawOneSeaUrchin(ctx, camera, cw, u));
for (const c of crabs) addAmbienceJob(c.depth, (ctx, camera, cw) => drawOneCrab(ctx, camera, cw, c));
for (const ray of sunRays) addAmbienceJob(ray.depth, (ctx, camera, cw, ch) => drawOneSunRay(ctx, camera, cw, ch, ray));
behindLabJobs.sort((a, b) => a.depth - b.depth);
frontLabJobs.sort((a, b) => a.depth - b.depth);

// Everything at depth < LAB_DEPTH_THRESHOLD (shadow fish, boulders,
// seaweed/kelp, and whichever sun rays happened to roll a low depth) — main
// .js calls this, then renderScienceLab, then renderAmbienceFrontLab below.
export function renderAmbienceBehindLab(ctx, state, canvasWidth, canvasHeight) {
  for (const job of behindLabJobs) job.draw(ctx, state.camera, canvasWidth, canvasHeight);
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
