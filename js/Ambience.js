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
const BUBBLE_COUNT = 18;
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
    sway: 10 + Math.random() * 16,
    freq: 0.35 + Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
    hue: 90 + Math.random() * 35,
  });
}

export function updateAmbience(dtMs) {
  const dt = dtMs / 1000;
  elapsed += dt;
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.age += dt;
    if (b.y < -20) Object.assign(b, randomBubble());
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

// Seaweed first (anchored right at the seabed line, reads as background
// behind everything else on top of it) then bubbles (drift the whole water
// column, so they should sit in front of the seaweed but — like everything
// else this draws — still behind fish/items, which main.js renders after).
export function renderAmbience(ctx, state, canvasWidth, canvasHeight) {
  renderSeaweed(ctx, state.camera, canvasWidth);
  renderBubbles(ctx, state.camera, canvasWidth, canvasHeight);
}
