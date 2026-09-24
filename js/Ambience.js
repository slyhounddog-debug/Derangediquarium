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
  for (let i = cursorBubbles.length - 1; i >= 0; i--) {
    const b = cursorBubbles[i];
    b.ageS += dt;
    b.vx *= dragMul;
    b.vy *= dragMul;
    b.x += b.vx * dt;
    b.y += b.vy * dt - b.speed * dt;
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
function drawOneSeaweed(ctx, camera, canvasWidth, w) {
  const screen = worldToScreen(w.x, SEABED_FLOOR_Y, camera);
  if (screen.x < -100 || screen.x > canvasWidth + 100) return;
  ctx.save();
  ctx.lineCap = 'round';
  const sway = Math.sin(elapsed * w.freq + w.phase) * w.sway * camera.zoom;
  const h = w.height * camera.zoom;
  const baseWidth = Math.max(2, w.width * camera.zoom);
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y + 2);
  ctx.quadraticCurveTo(screen.x + sway, screen.y - h * 0.5, screen.x + sway * 0.4, screen.y - h);
  ctx.strokeStyle = `hsl(${w.hue}, 6%, 55%)`;
  ctx.lineWidth = baseWidth * 2.2 * w.blurFactor;
  ctx.stroke();
  ctx.strokeStyle = `hsl(${w.hue}, 9%, 45%)`;
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
// Bumped 7 -> 9 (25% more, rounded up) per direct request ("increase the
// amount of... boulders by 25%").
const BOULDER_COUNT = 9;
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
const SAND_CASTLE_COUNT = 3;
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

function drawOneSandCastle(ctx, camera, canvasWidth, sc) {
  const screen = worldToScreen(sc.x, SEABED_FLOOR_Y, camera);
  const w = sc.width * camera.zoom;
  const h = sc.height * camera.zoom;
  if (screen.x < -w || screen.x > canvasWidth + w) return;
  ctx.save();
  const base = Math.round(200 * sc.shade);
  const sandColor = `rgb(${base}, ${Math.round(base * 0.86)}, ${Math.round(base * 0.6)})`;
  const sandDark = `rgb(${Math.round(base * 0.8)}, ${Math.round(base * 0.68)}, ${Math.round(base * 0.46)})`;
  const baseY = screen.y;
  const topY = baseY - h;

  // Central keep — a trapezoid block, wider at the base than the top.
  ctx.fillStyle = sandColor;
  ctx.beginPath();
  ctx.moveTo(screen.x - w * 0.28, baseY);
  ctx.lineTo(screen.x - w * 0.22, topY);
  ctx.lineTo(screen.x + w * 0.22, topY);
  ctx.lineTo(screen.x + w * 0.28, baseY);
  ctx.closePath();
  ctx.fill();

  // Crenellations along the keep's own top edge.
  ctx.fillStyle = sandDark;
  const teeth = 4;
  const toothW = (w * 0.44) / (teeth * 2 - 1);
  for (let i = 0; i < teeth; i++) {
    const tx = screen.x - w * 0.22 + i * toothW * 2;
    ctx.fillRect(tx, topY - h * 0.1, toothW, h * 0.12);
  }

  // Side (and sometimes center) towers flanking the keep — a cylindrical
  // base topped with a pointed cone roof.
  const towerXs = sc.towerCount === 3 ? [-0.42, 0, 0.42] : [-0.42, 0.42];
  for (const tf of towerXs) {
    const tx = screen.x + tf * w;
    const towerW = w * 0.16;
    const towerH = h * (tf === 0 ? 0.55 : 0.7);
    const towerTopY = baseY - towerH;
    ctx.fillStyle = sandColor;
    ctx.fillRect(tx - towerW / 2, towerTopY, towerW, towerH);
    ctx.beginPath();
    ctx.moveTo(tx - towerW * 0.65, towerTopY);
    ctx.lineTo(tx + towerW * 0.65, towerTopY);
    ctx.lineTo(tx, towerTopY - towerW * 0.9);
    ctx.closePath();
    ctx.fillStyle = sandDark;
    ctx.fill();
  }

  // Soft contact shadow where it meets the floor, same trick Boulder uses.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.ellipse(screen.x, baseY, w * 0.55, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

function drawOneSeaUrchin(ctx, camera, canvasWidth, u) {
  const screen = worldToScreen(u.x, SEABED_FLOOR_Y, camera);
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
// amount of coral by 50%").
const CORAL_COUNT = 14;
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
  // Opaque now, same reasoning/fix as drawOneSeaweed's own comment (a
  // shadow fish drawn earlier at this screen position — both are behind
  // kelp in the depth order — used to show straight through the old
  // alpha:0.55 fill). Lightness bumped 30% -> 38% to compensate for losing
  // that alpha blend, so it doesn't read as a much heavier/darker blade
  // than before.
  ctx.fillStyle = `hsl(${k.hue}, 45%, 38%)`;
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
// Bumped 4 -> 5 (25% more) per direct request ("increase the amount of...
// crabs... by 25%").
const CRAB_COUNT = 5;
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
    size: 8 + Math.random() * 6,
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
function spawnCrabBubble(c) {
  if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift();
  const speed = 20 + Math.random() * 20;
  const y = SEABED_FLOOR_Y - c.size * 0.5 + (Math.random() - 0.5) * 4;
  cursorBubbles.push({
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
    // Only bubbles while actually moving (i.e. not during the pause above).
    c.bubbleTimer -= dt;
    if (c.bubbleTimer <= 0) {
      spawnCrabBubble(c);
      c.bubbleTimer = CRAB_BUBBLE_MIN_S + Math.random() * (CRAB_BUBBLE_MAX_S - CRAB_BUBBLE_MIN_S);
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
const treasureChest = {
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

// Spawns one bubble at the chest's own position, directly into the shared
// cursorBubbles pool (same shape spawnCursorBubbles itself builds) so it
// rides the exact same rise/wobble/fade update+render code already ticked
// every frame — no separate bubble system needed just for this.
function spawnChestBubble(c) {
  if (cursorBubbles.length >= CURSOR_BUBBLE_MAX) cursorBubbles.shift();
  const speed = 25 + Math.random() * 25;
  const y = SEABED_FLOOR_Y - c.size * 0.3 + (Math.random() - 0.5) * 6;
  cursorBubbles.push({
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

function updateTreasureChest(dt) {
  const c = treasureChest;
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
      spawnChestBubble(c);
      c.bubblesSpawned++;
    }
    if (c.lidT >= 1) { c.phase = 'open'; c.timer = 0; }
  } else if (c.phase === 'open') {
    c.timer += dt;
    c.bubbleElapsed += dt;
    const targetSpawned = Math.floor(Math.min(1, c.bubbleElapsed / CHEST_BUBBLE_SPAWN_WINDOW_S) * c.bubbleBudget);
    while (c.bubblesSpawned < targetSpawned) {
      spawnChestBubble(c);
      c.bubblesSpawned++;
    }
    if (c.timer >= CHEST_HOLD_OPEN_DURATION_S) { c.phase = 'closing'; c.timer = 0; }
  } else if (c.phase === 'closing') {
    c.timer += dt;
    c.lidT = Math.max(0, 1 - c.timer / CHEST_CLOSE_DURATION_S);
    if (c.lidT <= 0) { c.phase = 'closed'; c.timer = randomChestWaitS(); }
  }
}

function drawOneTreasureChest(ctx, camera, canvasWidth, c) {
  const screen = worldToScreen(c.x, SEABED_FLOOR_Y, camera);
  const size = c.size * camera.zoom;
  if (screen.x < -size * 3 || screen.x > canvasWidth + size * 3) return;
  ctx.save();

  // The sand pile it's nestled in — a soft mound behind/around its base.
  const pileW = size * 2.4;
  const pileH = size * 0.9;
  ctx.fillStyle = '#d8c08a';
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - pileH * 0.15, pileW / 2, pileH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9ae74';
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y - pileH * 0.05, pileW * 0.31, pileH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyW = size * 1.6;
  const bodyH = size * 0.9;
  const baseY = screen.y - pileH * 0.35; // nestled up out of the sand pile a bit
  const bodyTop = baseY - bodyH;

  // Chest body — wood box with gold corner/mid bands and a lock.
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(screen.x - bodyW / 2, bodyTop, bodyW, bodyH);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(screen.x - bodyW / 2, bodyTop + bodyH * 0.35, bodyW, bodyH * 0.12);
  ctx.fillRect(screen.x - bodyW / 2, bodyTop, bodyW * 0.14, bodyH);
  ctx.fillRect(screen.x + bodyW / 2 - bodyW * 0.14, bodyTop, bodyW * 0.14, bodyH);
  ctx.fillStyle = '#f0d060';
  ctx.beginPath();
  ctx.arc(screen.x, bodyTop + bodyH * 0.42, size * 0.09, 0, Math.PI * 2);
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
    ctx.fillStyle = '#f4cf4e';
    ctx.beginPath();
    ctx.ellipse(screen.x, bodyTop + bodyH * 0.06, bodyW * 0.42, bodyH * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    const gemColors = ['#ff6b6b', '#5ac8fa', '#7bd88f', '#f4cf4e', '#ff6b6b'];
    for (let i = 0; i < gemColors.length; i++) {
      const gx = screen.x + (i - 2) * bodyW * 0.13;
      const gy = bodyTop + bodyH * 0.02 - Math.abs(i - 2) * bodyH * 0.05;
      ctx.fillStyle = gemColors[i];
      ctx.beginPath();
      ctx.arc(gx, gy, size * 0.09, 0, Math.PI * 2);
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
  ctx.fillStyle = '#7a4f29';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -lidH * 0.15);
  ctx.quadraticCurveTo(0, -lidH, lidW / 2, -lidH);
  ctx.quadraticCurveTo(lidW, -lidH, lidW, -lidH * 0.15);
  ctx.lineTo(lidW, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, -lidH * 0.42, lidW, lidH * 0.12);
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
const CURSOR_BUBBLE_MIN_SPEED = 60; // world px/sec floor below which nothing spawns — plain hovering shouldn't spam bubbles
const CURSOR_BUBBLE_SPEED_FOR_MAX_RATE = 2200; // world px/sec at/above which spawn rate hits its cap
// Per direct follow-up request ("increase the amount of bubbles that spawn
// at the cursor by 50%") — 14 -> 21.
// Per a further direct follow-up request ("bump the amount of bubbles made
// with the cursor by 10% more") — 21 -> 23 (21 * 1.1 = 23.1, rounded).
const CURSOR_BUBBLE_MAX_RATE = 23; // bubbles/sec at top speed — several a second, per direct request
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
const CURSOR_BUBBLE_BURST_VELOCITY_MULTIPLIER = 0.3;
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
for (const f of shadowFish) addAmbienceJob(f.depth, (ctx, camera, cw, ch) => drawOneShadowFish(ctx, camera, cw, ch, f));
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
