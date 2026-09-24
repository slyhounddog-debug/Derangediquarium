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

// ---- Coral ----
// Static multi-color fan-shaped clusters dotted along the floor — per direct
// request ("major background additions... multi-color coral"), rounding out
// the boulders/urchins pass with some actual color against all the muted
// browns/greys. Same "no gameplay effect" rule, static like boulders/urchins.
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
  };
}
const corals = [];
for (let i = 0; i < CORAL_COUNT; i++) corals.push(randomCoral());

function renderCoral(ctx, camera, canvasWidth) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const c of corals) {
    const screen = worldToScreen(c.x, SEABED_FLOOR_Y, camera);
    const size = c.size * camera.zoom;
    if (screen.x < -size * 2 || screen.x > canvasWidth + size * 2) continue;
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
  }
  ctx.restore();
}

// ---- Kelp (second seaweed variety) ----
// Per direct request ("major background additions... a new seaweed type") —
// taller, wider single blades in a golden-brown hue, rather than
// renderSeaweed's thin multi-strand green fronds, so it reads as visibly a
// different plant, not just a recolor. Sways the same sine-on-a-curve way,
// just filled as one tapering blade instead of stroked as a thin line.
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
  };
}
const kelps = [];
for (let i = 0; i < KELP_COUNT; i++) kelps.push(randomKelp());

function renderKelp(ctx, camera, canvasWidth) {
  ctx.save();
  for (const k of kelps) {
    const screen = worldToScreen(k.x, SEABED_FLOOR_Y, camera);
    if (screen.x < -100 || screen.x > canvasWidth + 100) continue;
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
  }
  ctx.restore();
}

// ---- Crabs ----
// Per direct request ("major background additions... crabs") — small
// creatures that scuttle back and forth within a fixed range of their own
// home spot, pausing briefly before reversing direction (reads as
// "noticing" rather than an instant, mechanical about-face).
const CRAB_COUNT = 4;
function randomCrab() {
  const homeX = Math.random() * WORLD_W;
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

function renderCrabs(ctx, camera, canvasWidth) {
  ctx.save();
  for (const c of crabs) {
    const screen = worldToScreen(c.x, SEABED_FLOOR_Y, camera);
    const size = c.size * camera.zoom;
    if (screen.x < -size * 3 || screen.x > canvasWidth + size * 3) continue;
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
  }
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
const SUN_RAY_COUNT = 5;
function randomSunRay(i) {
  return {
    xFrac: 0.55 + (i / SUN_RAY_COUNT) * 0.45, // biased toward the right half of the world
    xJitter: (Math.random() - 0.5) * 0.12,
    width: 90 + Math.random() * 130,
    tilt: -0.85 + Math.random() * 0.3, // negative = leans left going down, per "top right-ish to bottom left-ish"
    driftFreq: 0.025 + Math.random() * 0.04,
    driftPhase: Math.random() * Math.PI * 2,
    driftAmp: 0.15 + Math.random() * 0.2,
    opacityFreq: 0.05 + Math.random() * 0.07,
    opacityPhase: Math.random() * Math.PI * 2,
  };
}
const sunRays = [];
for (let i = 0; i < SUN_RAY_COUNT; i++) sunRays.push(randomSunRay(i));

function renderSunRays(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ray of sunRays) {
    const worldX = (ray.xFrac + ray.xJitter) * WORLD_W;
    const topScreen = worldToScreen(worldX, 0, camera);
    const tilt = ray.tilt + Math.sin(elapsed * ray.driftFreq + ray.driftPhase) * ray.driftAmp;
    const length = canvasHeight * 1.6;
    const topX = topScreen.x;
    const topY = topScreen.y - 60;
    const bottomX = topX + tilt * length;
    const bottomY = topY + length;
    const topWidth = ray.width * 0.25 * camera.zoom;
    const bottomWidth = ray.width * 1.2 * camera.zoom;
    if (Math.max(topX, bottomX) < -bottomWidth || Math.min(topX, bottomX) > canvasWidth + bottomWidth) continue;
    if (topY > canvasHeight) continue;
    const opacity = 0.05 + Math.max(0, Math.sin(elapsed * ray.opacityFreq + ray.opacityPhase)) * 0.05;
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
  }
  ctx.globalCompositeOperation = 'source-over';
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

// Sun rays first (surface light, sits behind literally everything else),
// then boulders/coral/urchins/crabs (static-ish seabed scenery at the
// floor), then shadow fish (deep-background depth cue), then
// seaweed/kelp (anchored at the same floor line), then bubbles/cursor
// bubbles (drift the whole water column, so they sit in front of all of it)
// — but, like everything else this draws, still behind the real fish/items
// main.js renders after.
export function renderAmbience(ctx, state, canvasWidth, canvasHeight) {
  renderSunRays(ctx, state.camera, canvasWidth, canvasHeight);
  renderBoulders(ctx, state.camera, canvasWidth);
  renderCoral(ctx, state.camera, canvasWidth);
  renderSeaUrchins(ctx, state.camera, canvasWidth);
  renderCrabs(ctx, state.camera, canvasWidth);
  renderShadowFish(ctx, state.camera, canvasWidth, canvasHeight);
  renderSeaweed(ctx, state.camera, canvasWidth);
  renderKelp(ctx, state.camera, canvasWidth);
  renderBubbles(ctx, state.camera, canvasWidth, canvasHeight);
  renderCursorBubbles(ctx, state.camera, canvasWidth, canvasHeight);
}
