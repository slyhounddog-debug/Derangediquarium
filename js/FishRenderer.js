// FishRenderer.js — pure canvas drawing for a single fish (body, fin, eye).
// Shared by main.js's game canvas and UI.js's shop preview canvas, so the
// preview always looks exactly like the fish will look once it's in the
// tank. Forbidden: no game-state reads (state.level, camera, etc) — callers
// pass in plain numbers/coordinates already resolved to this function's own
// coordinate space.

import {
  SPECIES,
  FISH_COLORS,
  FISH_BASE_SIZE,
  TAIL_LENGTH_RATIO,
  TAIL_WIDTH_RATIO,
  TAIL_SWING_RATIO,
  MID_STAGE_FIN_SCALE,
  EYE_OFFSET_X_RATIO,
  EYE_OFFSET_Y_RATIO,
  EYE_SOCKET_RADIUS_RATIO,
  EYE_PUPIL_RADIUS_RATIO,
  EYE_PUPIL_OFFSET_RATIO,
  FISH_STAR_COUNT_BY_TIER,
  FISH_STAR_COLOR,
  FISH_STAR_OUTER_RADIUS_RATIO,
  FISH_STAR_INNER_RADIUS_FRACTION,
  FISH_STAR_SPACING_RATIO,
  FISH_STAR_Y_OFFSET_RATIO,
} from './Config.js';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// Blends a hex color toward a target RGB by fraction t (0 = original color,
// 1 = fully the target) — a cheap, filter-free way to tint a fish sick-green
// as its hunger climbs. A real ctx.filter hue-rotate was considered and
// rejected outright without even benchmarking it: Ambience.js's seaweed
// already measured a canvas filter tanking frame rate from 60fps to ~11fps
// with far fewer draw calls than "every fish, every frame" would be here.
function mixColor(hex, target, t) {
  const { r, g, b } = hexToRgb(hex);
  const mr = Math.round(r + (target.r - r) * t);
  const mg = Math.round(g + (target.g - g) * t);
  const mb = Math.round(b + (target.b - b) * t);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

// Same blend, but starting from an already-resolved {r,g,b} object instead
// of a hex string — used to layer a second tint (grayed) on top of a first
// (sickness) without re-parsing an "rgb(...)" string as if it were hex,
// which mixColor's own hexToRgb call would silently mis-parse into NaN.
function mixRgb({ r, g, b }, target, t) {
  return {
    r: Math.round(r + (target.r - r) * t),
    g: Math.round(g + (target.g - g) * t),
    b: Math.round(b + (target.b - b) * t),
  };
}
const SICK_GREEN = { r: 120, g: 200, b: 90 };
// A fish blocked from producing money (an alien nearby, or a just-blocked
// Coin Cap drop) tints toward this flat gray instead — see drawFish's
// `grayed` param.
const ALIEN_BLOCKED_GRAY = { r: 128, g: 128, b: 128 };

// A straight 50/50 blend between two hex colors — used for a Gene-Splicing
// hybrid's color, per direct request: rather than a single flat color (or
// silently falling back to plain white, since hybrid ids have never had
// their own FISH_COLORS entry), a hybrid should read as a genuine mix of
// whichever two species it was spliced from.
function blendHexColors(hexA, hexB) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round((a.r + b.r) / 2)}, ${Math.round((a.g + b.g) / 2)}, ${Math.round((a.b + b.b) / 2)})`;
}

// Standard 5-point star polygon, alternating outer/inner radius points
// around the circle starting straight up — used for the Economy Fish
// Combining tier overlay below. Pure drawing helper, no game-state reads.
function drawStar(ctx, cx, cy, outerRadius, color) {
  const innerRadius = outerRadius * FISH_STAR_INNER_RADIUS_FRACTION;
  const spikes = 5;
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
    rot += step;
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---- Equipped cosmetic hats ----
// Per direct report ("right now it looks like icons floating above their
// heads... rework all of them so they are wearables, not icons, and so they
// sit correctly on the fish's head, and so they mirror left/right depending
// on the way the fish is looking") — every hat below is real drawn vector
// geometry (arcs/ellipses/paths), not a text glyph, anchored so its own base
// sits ON the (x, y) head point drawFish computes per body shape (see that
// function's own headX/headY/headSize comment) rather than floating well
// above it. `facing` is the same +1/-1 convention every body-shape function
// in this file already uses — every x-offset that should flip when the fish
// turns around is written as `facing * <offset>`, exactly like the eye/tail
// positions above, rather than a ctx.scale() transform (this file has never
// used one, and mixing the two conventions would be an easy way to
// accidentally double-flip something).
function drawGuppyCap(ctx, x, y, size, facing) {
  // A rounded ball-cap dome plus a brim poking out over the eye, in the
  // direction the fish is actually facing — the one detail that makes a cap
  // specifically (not just a beanie) read correctly when mirrored.
  ctx.fillStyle = '#3f6fd1';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.62, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f56ab';
  ctx.beginPath();
  ctx.ellipse(x + facing * size * 0.55, y + size * 0.02, size * 0.32, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(x - facing * size * 0.2, y - size * 0.35, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
}

function drawTopHat(ctx, x, y, size, facing) {
  ctx.fillStyle = '#2a2a33';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.14, size * 0.6, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - size * 0.34, y - size * 0.75, size * 0.68, size * 0.9);
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.75, size * 0.34, size * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x - size * 0.34, y - size * 0.1, size * 0.68, size * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x - facing * size * 0.28, y - size * 0.7, size * 0.1, size * 0.75);
}

function drawSunHat(ctx, x, y, size, facing) {
  ctx.fillStyle = '#e8c987';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.1, size * 0.85, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dcb96f';
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.18, size * 0.42, size * 0.32, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e26d5a';
  ctx.fillRect(x - size * 0.42, y - size * 0.02, size * 0.84, size * 0.09);
}

function drawIncognito(ctx, x, y, size, facing) {
  // Deliberately sits LOWER than a normal hat (roughly at eye height, not
  // the top of the head) — a disguise's whole point is covering the face,
  // not the crown of the head. Glasses + a big nose + a mustache, drawn
  // straddling the eye's own real position.
  const gy = y + size * 0.55;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.beginPath();
  ctx.arc(x - facing * size * 0.32, gy, size * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + facing * size * 0.32, gy, size * 0.26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - facing * size * 0.06, gy);
  ctx.lineTo(x + facing * size * 0.06, gy);
  ctx.stroke();
  ctx.fillStyle = '#d68a5c';
  ctx.beginPath();
  ctx.ellipse(x, gy + size * 0.22, size * 0.16, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2417';
  ctx.beginPath();
  ctx.ellipse(x - size * 0.22, gy + size * 0.42, size * 0.16, size * 0.09, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + size * 0.22, gy + size * 0.42, size * 0.16, size * 0.09, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawHelmet(ctx, x, y, size, facing) {
  ctx.fillStyle = '#5c6b3f';
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.6, size * 0.48, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#48542f';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.08, size * 0.65, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(x - facing * size * 0.2, y - size * 0.2, size * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f3620';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - facing * size * 0.5, y + size * 0.15);
  ctx.quadraticCurveTo(x - facing * size * 0.55, y + size * 0.55, x - facing * size * 0.35, y + size * 0.7);
  ctx.stroke();
}

function drawGradCap(ctx, x, y, size, facing) {
  ctx.fillStyle = '#1c1c22';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.1, size * 0.34, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.42);
  ctx.lineTo(x + size * 0.62, y - size * 0.06);
  ctx.lineTo(x, y + size * 0.3);
  ctx.lineTo(x - size * 0.62, y - size * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e6c84d';
  ctx.beginPath();
  ctx.arc(x, y - size * 0.06, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e6c84d';
  ctx.lineWidth = Math.max(1, size * 0.05);
  const tasselX = x + facing * size * 0.55;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.06);
  ctx.lineTo(tasselX, y + size * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tasselX, y + size * 0.22, size * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = '#e6c84d';
  ctx.fill();
}

function drawLuckyClover(ctx, x, y, size, facing) {
  ctx.fillStyle = '#3fae5a';
  const r = size * 0.24;
  const lobes = [[-1, -1], [1, -1], [-1, 0.5], [1, 0.5]];
  for (const [lx, ly] of lobes) {
    ctx.beginPath();
    ctx.arc(x + lx * r * 0.9, y + ly * r * 0.55 - size * 0.15, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2f8a45';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.1);
  ctx.quadraticCurveTo(x + facing * size * 0.1, y + size * 0.3, x + facing * size * 0.05, y + size * 0.55);
  ctx.stroke();
}

// A classic cone party hat with a striped body and a pompom on top —
// replaces the old "Star Struck" hat entirely, per direct request ("I don't
// like [it] visually... swap it out for something else").
function drawPartyHat(ctx, x, y, size, facing) {
  const tipX = x + facing * size * 0.1;
  const tipY = y - size * 0.9;
  ctx.fillStyle = '#ff5f8a';
  ctx.beginPath();
  ctx.moveTo(x - size * 0.4, y + size * 0.15);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(x + size * 0.4, y + size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 224, 102, 0.8)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.27, y - size * 0.15);
  ctx.lineTo(x + size * 0.27, y - size * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.14, y - size * 0.48);
  ctx.lineTo(x + size * 0.14, y - size * 0.48);
  ctx.stroke();
  ctx.fillStyle = '#ffe066';
  ctx.beginPath();
  ctx.arc(tipX, tipY, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

// A genuine shark-fin silhouette — a straight leading edge sweeping up to a
// point, then a concave (swept-back) trailing edge, with a soft ripple base
// reading as "cutting through the water." Per direct request, this replaces
// the old "Static Spike" hat entirely — that one "just doesn't look like [a
// shark fin] at all."
function drawSharkFin(ctx, x, y, size, facing) {
  ctx.fillStyle = 'rgba(140, 190, 220, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.15, size * 0.48, size * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  const tipX = x + facing * size * 0.05;
  const tipY = y - size * 0.95;
  const frontBaseX = x + facing * size * 0.3;
  const backBaseX = x - facing * size * 0.35;
  const baseY = y + size * 0.08;
  ctx.fillStyle = '#67727c';
  ctx.beginPath();
  ctx.moveTo(frontBaseX, baseY);
  ctx.lineTo(tipX, tipY);
  ctx.quadraticCurveTo(x - facing * size * 0.1, y - size * 0.35, backBaseX, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(frontBaseX - facing * size * 0.06, baseY - size * 0.02);
  ctx.lineTo(tipX, tipY + size * 0.15);
  ctx.lineTo(x, y - size * 0.42);
  ctx.closePath();
  ctx.fill();
}

// This exact silhouette (a curved cone rising from a wide brim) used to be
// named "Shark Fin," per direct report, "since that's what it actually is
// visually" — a genuine witch's hat, not a fin at all. Kept unchanged here
// under its correct name, just recolored to the classic black/purple
// palette (was a plain gray) to fully commit to the new identity — a real
// fin-shaped replacement now lives at drawSharkFin above instead.
function drawWitchHat(ctx, x, y, size, facing) {
  ctx.fillStyle = '#2a2430';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.12, size * 0.5, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1822';
  ctx.beginPath();
  ctx.moveTo(x - facing * size * 0.28, y + size * 0.05);
  ctx.quadraticCurveTo(x - facing * size * 0.05, y - size * 0.75, x + facing * size * 0.22, y - size * 0.85);
  ctx.quadraticCurveTo(x + facing * size * 0.05, y - size * 0.3, x + facing * size * 0.3, y + size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a4fc4';
  ctx.fillRect(x - size * 0.32, y + size * 0.01, size * 0.64, size * 0.08);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.6, size * 0.06, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPumpkinHead(ctx, x, y, size, facing) {
  // A deliberately deeper, more saturated pumpkin-orange than any fish body
  // color in this game (see FISH_COLORS), plus a bold dark outline — per
  // direct report, an earlier, lighter orange nearly matched Guppy's own
  // body color and the hat all but disappeared against it.
  ctx.fillStyle = '#d9540f';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.62, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a2f08';
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.stroke();
  ctx.strokeStyle = '#a83f0c';
  ctx.lineWidth = Math.max(1, size * 0.045);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * size * 0.2, y);
    ctx.quadraticCurveTo(x + i * size * 0.2 * 0.7, y - size * 0.55, x + i * size * 0.05, y - size * 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(x - facing * size * 0.04, y - size * 0.78, size * 0.14, size * 0.2);
}

function drawCrown(ctx, x, y, size, facing) {
  ctx.fillStyle = '#f2c53d';
  ctx.fillRect(x - size * 0.55, y - size * 0.05, size * 1.1, size * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.55, y - size * 0.05);
  ctx.lineTo(x - size * 0.55, y - size * 0.4);
  ctx.lineTo(x - size * 0.28, y - size * 0.1);
  ctx.lineTo(x, y - size * 0.55);
  ctx.lineTo(x + size * 0.28, y - size * 0.1);
  ctx.lineTo(x + size * 0.55, y - size * 0.4);
  ctx.lineTo(x + size * 0.55, y - size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(x, y - size * 0.42, size * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d6fd4';
  ctx.beginPath();
  ctx.arc(x + facing * size * 0.28, y - size * 0.16, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(x - facing * size * 0.3, y + size * 0.06, size * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

const HAT_DRAWERS = {
  guppy_cap: drawGuppyCap,
  fancy_fin: drawTopHat,
  beach_bum: drawSunHat,
  incognito: drawIncognito,
  turret_tech: drawHelmet,
  bubble_scholar: drawGradCap,
  lucky_clover: drawLuckyClover,
  witch_hat: drawWitchHat,
  pumpkin_head: drawPumpkinHead,
  party_hat: drawPartyHat,
  shark_fin: drawSharkFin,
  tank_royalty: drawCrown,
};

function drawHat(ctx, hatId, x, y, size, facing) {
  const drawer = HAT_DRAWERS[hatId];
  if (drawer) drawer(ctx, x, y, size, facing);
}

// Draws one fish centered at (x, y) in whatever coordinate space the caller
// is already using (screen pixels for the game canvas, plain canvas pixels
// for a decorative preview — this function doesn't know or care).
//
// eyeDirection, if given, is a already-normalized {x, y} unit vector (magnitude
// <= 1) pointing where the eye should look — never a raw target point, since
// that would need subtracting against (x, y) in a coordinate space this
// function has no way to verify matches. Pass null to skip the eye
// regardless of stage (e.g. a baby-stage fish never gets one anyway).
//
// starTier (1-4, default 1) is the Economy Fish Combining tier — see
// Config.js's FISH_STAR_COUNT_BY_TIER. Deliberately no separate spritesheet
// per tier (per the design spec): the same base adult sprite is drawn, with
// a small row of stars overlaid above it. Tier 1 has no stars at all; a
// non-economy species or a fish that's never been combined always passes
// the default and never draws any.
//
// sickness (0-1, default 0) tints the body/tail toward SICK_GREEN — the
// caller (main.js) derives it from the fish's current hunger, so a hungry
// fish visibly looks a little unwell rather than just showing the existing
// "!"/"!!" text indicator. 0 draws the species' normal color untouched.
// A simple white-socket/dark-pupil eye, shared by every body shape below —
// eyeDirection is already a normalized {x,y} unit vector (see drawFish's own
// header comment).
function drawEye(ctx, eyeX, eyeY, socketRadius, pupilRadius, eyeDirection) {
  if (!eyeDirection) return;
  const pupilOffset = socketRadius * EYE_PUPIL_OFFSET_RATIO;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, socketRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(eyeX + eyeDirection.x * pupilOffset, eyeY + eyeDirection.y * pupilOffset, pupilRadius, 0, Math.PI * 2);
  ctx.fill();
}

// The default body: oval + a curved swishing tail fin (mid/adult stages
// only) + a shading pass + an eye. Used by the 3 base feeders, and — since
// none of these three ever match a special-cased speciesId below — every
// Gene-Splicing hybrid too, per direct request that a hybrid "should look
// like the guppy, dartfin, or blimpfish fish that was used."
// bodyShape ('normal' | 'slim' | 'round') gives Dartfin/Blimpfish (and any
// hybrid spliced from them — see drawFish's own shapeSourceId comment) a
// subtly different silhouette from Guppy's own baseline body, per direct
// request ("slightly change the looks of the dartfin and the blimpfish so
// they are more visually distinct from the guppy") — 'slim' reads as
// leaner/quicker (Dartfin's own "cheaper and faster" flavor), 'round' reads
// as chubbier/slower (Blimpfish's own "expensive and sluggish... voracious
// appetite," and its literal name). Deliberately small, proportional
// adjustments to the exact same body/tail this function already draws for
// every standard fish — not a new silhouette — since "slightly" was the
// explicit ask.
const BODY_SHAPE_RATIOS = {
  normal: { bodyW: 0.6, bodyH: 0.4, tailLen: 1, tailWidth: 1 },
  slim: { bodyW: 0.62, bodyH: 0.33, tailLen: 1.12, tailWidth: 0.82 }, // Dartfin — leaner and a touch longer, a narrower tail fin
  round: { bodyW: 0.56, bodyH: 0.48, tailLen: 0.85, tailWidth: 1.15 }, // Blimpfish — a rounder, plumper belly and a stubbier, broader tail
};

function drawStandardBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection, bodyShape = 'normal') {
  const shape = BODY_SHAPE_RATIOS[bodyShape] || BODY_SHAPE_RATIOS.normal;
  // Mid and adult stages get a fin — small at mid, bigger (but still
  // smaller than the old fixed size) at adult. Baby stays plain.
  if (stage >= 1) {
    const finScale = isFullyGrown ? 1.0 : MID_STAGE_FIN_SCALE;
    const backX = x - facing * size * 0.55;
    const tailLength = size * TAIL_LENGTH_RATIO * finScale * shape.tailLen;
    const tailHalfWidth = size * TAIL_WIDTH_RATIO * finScale * shape.tailWidth;
    const swing = Math.sin(tailPhase) * size * TAIL_SWING_RATIO * finScale;
    // Swishes side to side like a real tail fin sweeping through the water,
    // instead of just the tip flapping up/down against a fixed hinge, per
    // direct request: the base attachment leans slightly opposite the tip's
    // swing (a small counter-lean), and the whole outline is a curved sweep
    // (quadraticCurveTo) rather than straight triangle edges, so the tail
    // reads as one continuous bending motion.
    const baseLean = -swing * 0.25;
    const tipX = backX - facing * tailLength;
    const tipY = y + swing;
    const midX = backX - facing * tailLength * 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(backX + baseLean, y - tailHalfWidth);
    ctx.quadraticCurveTo(midX, y - tailHalfWidth * 0.3 + swing * 0.5, tipX, tipY);
    ctx.quadraticCurveTo(midX, y + tailHalfWidth * 0.3 + swing * 0.5, backX + baseLean, y + tailHalfWidth);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * shape.bodyW, size * shape.bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  // A soft, darker underside plus a small glossy highlight — per direct
  // request that fish "pop more and look less flat" than a single flat
  // fill. Cheap (two extra ellipses, no filters/gradients) so it doesn't
  // risk the same per-frame cost every fish, every frame would make a real
  // canvas filter or gradient noticeably add up to. Scaled proportionally to
  // the body's own (possibly non-default) width/height above, so the shading
  // still tracks a slimmer or rounder silhouette correctly.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * shape.bodyH * 0.4, size * shape.bodyW * 0.92, size * shape.bodyH * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - facing * size * shape.bodyW * 0.2, y - size * shape.bodyH * 0.4, size * shape.bodyW * 0.37, size * shape.bodyH * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isFullyGrown) {
    const eyeX = x + facing * size * EYE_OFFSET_X_RATIO;
    const eyeY = y - size * EYE_OFFSET_Y_RATIO;
    drawEye(ctx, eyeX, eyeY, size * EYE_SOCKET_RADIUS_RATIO, size * EYE_PUPIL_RADIUS_RATIO, eyeDirection);
  }
}

// Suckerfish: "flatter than the guppy but more lumpy," and it DOES keep a
// tail fin (unlike the eel/octopus below) — per direct request. A wider,
// flatter base ellipse than the standard body, with 3 small bump circles
// along its top edge for the lumpy silhouette, otherwise the same
// tail/shading/eye treatment as drawStandardBody.
function drawSuckerfishBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection) {
  if (stage >= 1) {
    const finScale = isFullyGrown ? 1.0 : MID_STAGE_FIN_SCALE;
    const backX = x - facing * size * 0.6;
    const tailLength = size * TAIL_LENGTH_RATIO * finScale * 0.8;
    const tailHalfWidth = size * TAIL_WIDTH_RATIO * finScale * 0.8;
    const swing = Math.sin(tailPhase) * size * TAIL_SWING_RATIO * finScale;
    const tipX = backX - facing * tailLength;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(backX, y - tailHalfWidth);
    ctx.lineTo(tipX, y + swing);
    ctx.lineTo(backX, y + tailHalfWidth);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.68, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Lumpy bumps along the top edge — the one visual trait that reads as
  // "sucker/scavenger" rather than a smooth standard fish body.
  ctx.fillStyle = color;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(x + i * size * 0.22, y - size * 0.22, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.1, size * 0.6, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x - facing * size * 0.1, y - size * 0.08, size * 0.2, size * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isFullyGrown) {
    const eyeX = x + facing * size * EYE_OFFSET_X_RATIO;
    const eyeY = y - size * 0.05;
    drawEye(ctx, eyeX, eyeY, size * EYE_SOCKET_RADIUS_RATIO * 0.85, size * EYE_PUPIL_RADIUS_RATIO * 0.85, eyeDirection);
  }
}

// Electric Eel: "skinny and flat," no fins, and swims with a snake-like
// undulation — "move like the seaweed but sideways," per direct request.
// Drawn as a tapered stroked path through several points, each offset
// perpendicular to the swim direction by a sine wave whose phase shifts
// along the body — the same underlying idea Ambience.js's seaweed sway
// uses, just applied along a horizontal body instead of a vertical stem.
function drawEelBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection) {
  const length = size * 1.5;
  const segments = 7;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 = tail end, 1 = head end
    const px = x - facing * length * (0.5 - t);
    const wave = Math.sin(tailPhase - t * 3.2) * size * 0.22 * (1 - t * 0.3); // undulation eases off toward the head
    points.push({ x: px, y: y + wave, width: size * (0.1 + t * 0.16) }); // tapers thin at the tail, wider at the head
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y - points[0].width);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y - points[i].width);
  for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].x, points[i].y + points[i].width);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(points[Math.floor(points.length / 2)].x, points[Math.floor(points.length / 2)].y - points[Math.floor(points.length / 2)].width * 0.5);
  for (let i = Math.floor(points.length / 2) + 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y - points[i].width * 0.5);
  }
  ctx.stroke();

  if (isFullyGrown) {
    const head = points[points.length - 1];
    const eyeX = head.x + facing * head.width * 0.3;
    drawEye(ctx, eyeX, head.y, size * EYE_SOCKET_RADIUS_RATIO * 0.7, size * EYE_PUPIL_RADIUS_RATIO * 0.7, eyeDirection);
  }
}

// Science Octopus: "head is on top," no fins — a round head in the upper
// portion of the sprite with a handful of wavy tentacles hanging below it,
// per direct request.
function drawOctopusBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection) {
  const headY = y - size * 0.22;
  const headRadius = size * 0.42;
  const tentacleCount = 4;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, size * 0.11);
  for (let i = 0; i < tentacleCount; i++) {
    const spread = (i - (tentacleCount - 1) / 2) * size * 0.22;
    const wave = Math.sin(tailPhase + i * 1.3) * size * 0.14;
    ctx.beginPath();
    ctx.moveTo(x + spread, headY + headRadius * 0.5);
    ctx.quadraticCurveTo(x + spread + wave, y + size * 0.35, x + spread + wave * 0.6, y + size * 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, headY, headRadius, headRadius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x, headY + headRadius * 0.35, headRadius * 0.85, headRadius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - facing * headRadius * 0.25, headY - headRadius * 0.3, headRadius * 0.3, headRadius * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isFullyGrown) {
    const eyeX = x + facing * headRadius * 0.4;
    drawEye(ctx, eyeX, headY, size * EYE_SOCKET_RADIUS_RATIO, size * EYE_PUPIL_RADIUS_RATIO, eyeDirection);
  }
}

// grayed (0-1) tints toward ALIEN_BLOCKED_GRAY — a fish that either has a
// living alien nearby (continuous, see Entities.js's fish.alienNearby) or
// just had a coin drop blocked by the Coin Cap (timed, ~1s, see
// fish.capBlockedTintRemainingMs) — per direct request that a fish should
// visibly read as "not producing" in both cases. Applied on top of any
// sickness tint rather than instead of it; the two only rarely coincide.
export function drawFish(ctx, x, y, speciesId, stage, facing, tailPhase, eyeDirection, starTier = 1, sickness = 0, grayed = 0, hatId = 'none') {
  const def = SPECIES[speciesId];
  const scale = def.growthStages[stage].scale;
  const size = FISH_BASE_SIZE * scale;
  // A Gene-Splicing hybrid (def.parents, [utilityId, economyId]) has no
  // FISH_COLORS entry of its own — per direct request, it's a straight
  // blend of whichever two species it was spliced from, not a flat color.
  const baseColor = def.parents
    ? blendHexColors(FISH_COLORS[def.parents[0]] || '#ffffff', FISH_COLORS[def.parents[1]] || '#ffffff')
    : FISH_COLORS[speciesId] || '#ffffff';
  let color = baseColor;
  if (sickness > 0 || grayed > 0) {
    let rgb = hexToRgb(baseColor);
    if (sickness > 0) rgb = mixRgb(rgb, SICK_GREEN, sickness);
    if (grayed > 0) rgb = mixRgb(rgb, ALIEN_BLOCKED_GRAY, grayed);
    color = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }
  const isFullyGrown = stage === def.growthStages.length - 1;

  // Suckerfish/Electric Eel/Science Octopus each get a visually distinct
  // body shape — per direct request that the 3 utility species "look
  // visually distinct" from each other and from the standard fish shape.
  // Checked by exact speciesId, not a behavior tag, so every Gene-Splicing
  // hybrid (a different id, e.g. 'eel_blimp') falls through to the
  // standard shape automatically with no extra logic needed — see that
  // function's own comment. Per a later direct request, this unique shape
  // now only shows at the Adult stage — as a baby/mid (utility fish grow up
  // through the same 3-stage ladder as the base feeders now) they render via
  // the plain drawStandardBody instead, just tinted their own species color,
  // "so it looks like the [base] fish, but with the utility fish colors."
  // headX/headY/headSize anchor exactly where a worn hat should sit on THIS
  // particular body shape — computed per-branch below, since "the top of the
  // head" means something very different for a long undulating Eel than for
  // an Octopus (whose head is already explicitly separate from its body) than
  // for the plain oval every other species uses. See drawHat's own comment
  // for how these three numbers get used.
  let headX = x, headY = y, headSize = size * 0.5;
  if (isFullyGrown && speciesId === 'electric_eel') {
    drawEelBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection);
    // Mirrors drawEelBody's own head-point math exactly (the last point in
    // its points[] array) — riding the SAME undulation wave its eye already
    // does, so a worn hat visibly follows the swimming motion instead of
    // reading as glued to a fixed screen position.
    const length = size * 1.5;
    const segments = 7;
    const t = 1; // head end
    const headPx = x - facing * length * (0.5 - t);
    const headWave = Math.sin(tailPhase - t * 3.2) * size * 0.22 * (1 - t * 0.3);
    const headWidth = size * (0.1 + t * 0.16);
    headX = headPx + facing * headWidth * 0.1;
    headY = y + headWave - headWidth * 1.4;
    headSize = headWidth * 2.1;
  } else if (isFullyGrown && speciesId === 'octopus') {
    drawOctopusBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection);
    // drawOctopusBody's own head is already a distinct, separate circle
    // (unlike every other shape) — reuse its exact headY/headRadius rather
    // than approximating.
    const octHeadY = y - size * 0.22;
    const octHeadRadius = size * 0.42;
    headX = x + facing * octHeadRadius * 0.1;
    headY = octHeadY - octHeadRadius * 0.7;
    headSize = octHeadRadius * 1.5;
  } else if (isFullyGrown && speciesId === 'suckerfish') {
    drawSuckerfishBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection);
    headX = x + facing * size * 0.15;
    headY = y - size * 0.42;
    headSize = size * 0.6;
  } else {
    // A hybrid's own body SHAPE follows whichever base feeder it was spliced
    // from (def.parents' second entry, per the [utilityId, economyId]
    // convention — e.g. Blimp-Battery's own economy parent is 'blimpfish'),
    // same "should look like the guppy/dartfin/blimpfish that was used"
    // precedent this function's color-blending already follows. Falls back
    // to the species' own id for a non-hybrid, and to 'normal' for anything
    // that isn't Dartfin/Blimpfish (Guppy included, and every
    // utility-utility hybrid with no feeder parent at all).
    const shapeSourceId = def.parents ? def.parents[1] : speciesId;
    const bodyShape = shapeSourceId === 'dartfin' ? 'slim' : shapeSourceId === 'blimpfish' ? 'round' : 'normal';
    drawStandardBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection, bodyShape);
    const stdShape = BODY_SHAPE_RATIOS[bodyShape] || BODY_SHAPE_RATIOS.normal;
    headX = x + facing * size * stdShape.bodyW * 0.15;
    headY = y - size * stdShape.bodyH * 0.85;
    headSize = size * stdShape.bodyW * 0.85;
  }

  // Economy Fish Combining tier overlay — only ever nonzero on an adult fish
  // in practice (combining always both requires and produces Adult fish),
  // but gated on isFullyGrown too regardless, same defensive spirit as the
  // eye above.
  if (isFullyGrown) {
    const starCount = FISH_STAR_COUNT_BY_TIER[starTier] || 0;
    if (starCount > 0) {
      const starRadius = size * FISH_STAR_OUTER_RADIUS_RATIO;
      const spacing = starRadius * FISH_STAR_SPACING_RATIO;
      const totalWidth = (starCount - 1) * spacing;
      const startX = x - totalWidth / 2;
      const starY = y - size * FISH_STAR_Y_OFFSET_RATIO;
      for (let i = 0; i < starCount; i++) {
        drawStar(ctx, startX + i * spacing, starY, starRadius, FISH_STAR_COLOR);
      }
    }
  }

  // Equipped cosmetic hat — per direct spec ("achievements used for
  // unlockable hats to be added to the fish"), a global equip (the same one
  // hat choice renders on every fish, not a per-fish assignment — a deliberate
  // simplification given this is purely cosmetic and per-fish customization
  // would need a whole separate UI of its own). Per a later direct report
  // ("right now it looks like icons floating above their heads... rework all
  // of them so they are wearables"), this is now real drawn vector shapes
  // sitting ON the headX/headY/headSize anchor computed above (not a flat
  // emoji glyph floating well above it) — see drawHat below. Adult-only,
  // same "only once fully grown" precedent the star-tier overlay uses.
  if (isFullyGrown && hatId && hatId !== 'none') {
    drawHat(ctx, hatId, headX, headY, headSize, facing);
  }
}
