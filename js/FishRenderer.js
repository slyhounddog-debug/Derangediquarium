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
export function drawFish(ctx, x, y, speciesId, stage, facing, tailPhase, eyeDirection, starTier = 1) {
  const def = SPECIES[speciesId];
  const scale = def.growthStages[stage].scale;
  const size = FISH_BASE_SIZE * scale;
  const color = FISH_COLORS[speciesId] || '#ffffff';
  const isFullyGrown = stage === def.growthStages.length - 1;

  // Mid and adult stages get a fin — small at mid, bigger (but still
  // smaller than the old fixed size) at adult. Baby stays plain.
  if (stage >= 1) {
    const finScale = isFullyGrown ? 1.0 : MID_STAGE_FIN_SCALE;
    const backX = x - facing * size * 0.55;
    const tailLength = size * TAIL_LENGTH_RATIO * finScale;
    const tailHalfWidth = size * TAIL_WIDTH_RATIO * finScale;
    const tailSwing = Math.sin(tailPhase) * size * TAIL_SWING_RATIO * finScale;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(backX, y - tailHalfWidth);
    ctx.lineTo(backX, y + tailHalfWidth);
    ctx.lineTo(backX - facing * tailLength, y + tailSwing);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Only the adult stage gets an eye. Growth ladder: baby = nothing,
  // mid = fin, adult = bigger fin + eye.
  if (isFullyGrown && eyeDirection) {
    const eyeX = x + facing * size * EYE_OFFSET_X_RATIO;
    const eyeY = y - size * EYE_OFFSET_Y_RATIO;
    const socketRadius = size * EYE_SOCKET_RADIUS_RATIO;
    const pupilRadius = size * EYE_PUPIL_RADIUS_RATIO;
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
