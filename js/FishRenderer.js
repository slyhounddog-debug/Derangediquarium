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
function drawStandardBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection) {
  // Mid and adult stages get a fin — small at mid, bigger (but still
  // smaller than the old fixed size) at adult. Baby stays plain.
  if (stage >= 1) {
    const finScale = isFullyGrown ? 1.0 : MID_STAGE_FIN_SCALE;
    const backX = x - facing * size * 0.55;
    const tailLength = size * TAIL_LENGTH_RATIO * finScale;
    const tailHalfWidth = size * TAIL_WIDTH_RATIO * finScale;
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
  ctx.ellipse(x, y, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // A soft, darker underside plus a small glossy highlight — per direct
  // request that fish "pop more and look less flat" than a single flat
  // fill. Cheap (two extra ellipses, no filters/gradients) so it doesn't
  // risk the same per-frame cost every fish, every frame would make a real
  // canvas filter or gradient noticeably add up to.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.16, size * 0.55, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.ellipse(x - facing * size * 0.12, y - size * 0.16, size * 0.22, size * 0.12, 0, 0, Math.PI * 2);
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
export function drawFish(ctx, x, y, speciesId, stage, facing, tailPhase, eyeDirection, starTier = 1, sickness = 0, grayed = 0) {
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
  // hybrid (a different id, e.g. 'volt_guppy') falls through to the
  // standard shape automatically with no extra logic needed — see that
  // function's own comment. Per a later direct request, this unique shape
  // now only shows at the Adult stage — as a baby/mid (utility fish grow up
  // through the same 3-stage ladder as the base feeders now) they render via
  // the plain drawStandardBody instead, just tinted their own species color,
  // "so it looks like the [base] fish, but with the utility fish colors."
  if (isFullyGrown && speciesId === 'electric_eel') {
    drawEelBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection);
  } else if (isFullyGrown && speciesId === 'octopus') {
    drawOctopusBody(ctx, x, y, size, facing, tailPhase, isFullyGrown, color, eyeDirection);
  } else if (isFullyGrown && speciesId === 'suckerfish') {
    drawSuckerfishBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection);
  } else {
    drawStandardBody(ctx, x, y, size, facing, tailPhase, stage, isFullyGrown, color, eyeDirection);
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
}
