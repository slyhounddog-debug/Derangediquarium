// Ambience.js — purely decorative background elements: bubbles rising
// through the water column and seaweed swaying near the seabed floor. No
// gameplay effect whatsoever and nothing here ever touches state.level —
// ticked every frame from main.js's update()/render() the same as real sim
// entities are, just entirely self-contained, module-local cosmetic state
// that nothing outside this file ever reads.
// Forbidden: no gameplay logic, no reading/writing state.level.

import { WORLD_W, SEABED_FLOOR_Y } from './Config.js';
import { worldToScreen } from './Engine.js';

let elapsed = 0; // seconds, drives every sway/wobble phase below

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
// or a real building.
//
// Sizing, per direct request: 3x as many strands as the original pass;
// the smallest a strand can now be is exactly the biggest it used to get
// (the old height range topped out at 130px, old stroke width was a flat
// 5px pre-zoom) — the new range runs from there up to 4x that height and
// 3x that width. Each strand's width tracks its own height (bigger strands
// read as both taller AND thicker, not just stretched), and its blur
// (blurFactor, consumed by renderSeaweed's fake-blur below) scales with
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
  });
}

// ---- Shadow Fish ----
// Blurry, mostly-transparent fish silhouettes drifting slowly through the
// open water column — per direct request, a purely atmospheric depth cue
// ("something swimming further back in the tank"), never a real gameplay
// fish; nothing here is clickable/feedable/counted anywhere. A fixed pool
// recycles by simply reversing off-screen, same "no growing/shrinking
// arrays" convention BUBBLE_COUNT already established.
const SHADOW_FISH_COUNT = 5;
const SHADOW_FISH_MIN_SIZE = 20;
const SHADOW_FISH_MAX_SIZE = 42;
function randomShadowFish() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  return {
    x: Math.random() * WORLD_W,
    y: SEABED_FLOOR_Y * (0.12 + Math.random() * 0.7), // scattered through the open water column, never right at the very top or bottom
    size: SHADOW_FISH_MIN_SIZE + Math.random() * (SHADOW_FISH_MAX_SIZE - SHADOW_FISH_MIN_SIZE),
    dir,
    speed: 8 + Math.random() * 14,
    tailFreq: 1.4 + Math.random() * 1.2,
    tailPhase: Math.random() * Math.PI * 2,
    bobFreq: 0.2 + Math.random() * 0.25,
    bobAmp: 6 + Math.random() * 14,
    bobPhase: Math.random() * Math.PI * 2,
    baseY: 0, // set below, before first use
  };
}
const shadowFish = [];
for (let i = 0; i < SHADOW_FISH_COUNT; i++) {
  const f = randomShadowFish();
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
// drawn twice (a wide/very-transparent pass underneath a narrower/slightly-
// more-opaque one) for the same cheap fake-blur renderSeaweed's own comment
// explains, rather than a real ctx.filter blur (measured far too expensive
// for several of these every frame). Faces its own direction of travel.
function drawShadowFishSilhouette(ctx, x, y, size, dir, alphaMul) {
  const bodyW = size;
  const bodyH = size * 0.5;
  const tailW = size * 0.45;
  ctx.beginPath();
  ctx.ellipse(x, y, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
  ctx.moveTo(x - (bodyW / 2) * dir, y);
  ctx.lineTo(x - (bodyW / 2 + tailW) * dir, y - bodyH * 0.45);
  ctx.lineTo(x - (bodyW / 2 + tailW) * dir, y + bodyH * 0.45);
  ctx.closePath();
  ctx.globalAlpha = 0.05 * alphaMul;
  ctx.lineWidth = size * 0.35;
  ctx.strokeStyle = '#0a1420';
  ctx.stroke();
  ctx.fillStyle = '#0a1420';
  ctx.fill();
  ctx.globalAlpha = 0.12 * alphaMul;
  ctx.fill();
}

function renderShadowFish(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  for (const f of shadowFish) {
    const bobY = f.baseY + Math.sin(elapsed * f.bobFreq + f.bobPhase) * f.bobAmp;
    const screen = worldToScreen(f.x, bobY, camera);
    const size = f.size * camera.zoom;
    if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2 || screen.y < -size || screen.y > canvasHeight + size) continue;
    // A slight tail-wag "squash" on the horizontal scale, same idea as a
    // real fish's own tail animation, just baked into one silhouette shape
    // rather than a separate animated tail segment — cheap enough to still
    // read as "swimming," not just sliding.
    const wag = 1 + Math.sin(elapsed * f.tailFreq + f.tailPhase) * 0.06;
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.scale(wag, 1);
    drawShadowFishSilhouette(ctx, 0, 0, size, f.dir, 1);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
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
function renderSeaweed(ctx, camera, canvasWidth) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const w of seaweeds) {
    const screen = worldToScreen(w.x, SEABED_FLOOR_Y, camera);
    if (screen.x < -100 || screen.x > canvasWidth + 100) continue;
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
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---- Boulders ----
// A handful of static, irregular rounded rock clusters sitting right on the
// seabed floor line — per direct request ("major background additions...
// boulders"), purely decorative scenery, same "no gameplay effect, nothing
// outside this file ever reads it" rule as everything else here. Static
// (no per-frame animation, unlike swaying seaweed) since a rock has no
// reason to move — computed once at load and just redrawn every frame at
// its own fixed spot.
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
  };
}
const boulders = [];
for (let i = 0; i < BOULDER_COUNT; i++) boulders.push(randomBoulder());

function renderBoulders(ctx, camera, canvasWidth) {
  ctx.save();
  for (const b of boulders) {
    const screen = worldToScreen(b.x, SEABED_FLOOR_Y, camera);
    const size = b.size * camera.zoom;
    if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) continue;
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
  }
  ctx.restore();
}

// ---- Sea Urchins ----
// Small spiky dark orbs dotted along the floor — per direct request ("major
// background additions... sea urchins"). Static like boulders, just a
// center dot plus a ring of thin radiating spike lines.
const SEA_URCHIN_COUNT = 10;
function randomSeaUrchin() {
  return {
    x: Math.random() * WORLD_W,
    radius: 5 + Math.random() * 5,
    spikeCount: 10 + Math.floor(Math.random() * 6),
    hue: 265 + Math.random() * 30, // deep purple-violet, the classic urchin color
  };
}
const seaUrchins = [];
for (let i = 0; i < SEA_URCHIN_COUNT; i++) seaUrchins.push(randomSeaUrchin());

function renderSeaUrchins(ctx, camera, canvasWidth) {
  ctx.save();
  for (const u of seaUrchins) {
    const screen = worldToScreen(u.x, SEABED_FLOOR_Y, camera);
    const r = u.radius * camera.zoom;
    if (screen.x < -r * 4 || screen.x > canvasWidth + r * 4) continue;
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
  }
  ctx.restore();
}

// Boulders/urchins first (static seabed scenery, sits right at the floor),
// then shadow fish (deep-background depth cue), then seaweed (anchored at
// the same floor line), then bubbles (drift the whole water column, so they
// sit in front of all of it) — but, like everything else this draws, still
// behind the real fish/items main.js renders after.
export function renderAmbience(ctx, state, canvasWidth, canvasHeight) {
  renderBoulders(ctx, state.camera, canvasWidth);
  renderSeaUrchins(ctx, state.camera, canvasWidth);
  renderShadowFish(ctx, state.camera, canvasWidth, canvasHeight);
  renderSeaweed(ctx, state.camera, canvasWidth);
  renderBubbles(ctx, state.camera, canvasWidth, canvasHeight);
}
