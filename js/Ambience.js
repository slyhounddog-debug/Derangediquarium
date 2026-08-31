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
const BUBBLE_COUNT = 45;
function randomBubble() {
  return {
    x: Math.random() * WORLD_W,
    y: SEABED_FLOOR_Y - Math.random() * 60, // starts near the floor, biased to just above it — "from the back of the tank"
    radius: 2 + Math.random() * 5,
    speed: 16 + Math.random() * 26,
    wobbleFreq: 0.5 + Math.random() * 1.1,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleAmp: 4 + Math.random() * 9,
  };
}
const bubbles = [];
for (let i = 0; i < BUBBLE_COUNT; i++) {
  const b = randomBubble();
  b.y = Math.random() * SEABED_FLOOR_Y; // scattered through the column on first load, not all lined up at the floor
  bubbles.push(b);
}

// ---- Seaweed ----
// A handful of fixed strands anchored along the seabed floor line, each
// swaying independently via a simple sine bend on a quadratic curve's
// control point. Rendered blurred and low-opacity so it reads as soft
// background texture, never something the player mistakes for an obstacle
// or a real building.
const SEAWEED_COUNT = 16;
const seaweeds = [];
for (let i = 0; i < SEAWEED_COUNT; i++) {
  seaweeds.push({
    x: (i + 0.5) * (WORLD_W / SEAWEED_COUNT) + (Math.random() - 0.5) * 90,
    height: 55 + Math.random() * 75,
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
    if (b.y < -20) Object.assign(b, randomBubble());
  }
}

function renderBubbles(ctx, camera, canvasWidth, canvasHeight) {
  ctx.save();
  for (const b of bubbles) {
    const wobbleX = Math.sin(elapsed * b.wobbleFreq + b.wobblePhase) * b.wobbleAmp;
    const screen = worldToScreen(b.x + wobbleX, b.y, camera);
    if (screen.x < -20 || screen.x > canvasWidth + 20 || screen.y < -20 || screen.y > canvasHeight + 20) continue;
    const r = Math.max(1, b.radius * camera.zoom);
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
    if (screen.x < -60 || screen.x > canvasWidth + 60) continue;
    const sway = Math.sin(elapsed * w.freq + w.phase) * w.sway * camera.zoom;
    const h = w.height * camera.zoom;
    const baseWidth = Math.max(2, 5 * camera.zoom);
    ctx.strokeStyle = `hsl(${w.hue}, 42%, 32%)`;
    ctx.beginPath();
    ctx.moveTo(screen.x, screen.y + 2);
    ctx.quadraticCurveTo(screen.x + sway, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = baseWidth * 2.2;
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
