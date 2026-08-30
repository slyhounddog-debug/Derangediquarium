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
} from './Config.js';

// Draws one fish centered at (x, y) in whatever coordinate space the caller
// is already using (screen pixels for the game canvas, plain canvas pixels
// for a decorative preview — this function doesn't know or care).
//
// eyeDirection, if given, is a already-normalized {x, y} unit vector (magnitude
// <= 1) pointing where the eye should look — never a raw target point, since
// that would need subtracting against (x, y) in a coordinate space this
// function has no way to verify matches. Pass null to skip the eye
// regardless of stage (e.g. a baby-stage fish never gets one anyway).
export function drawFish(ctx, x, y, speciesId, stage, facing, tailPhase, eyeDirection) {
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
}
