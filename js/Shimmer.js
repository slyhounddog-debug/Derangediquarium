// Shimmer.js — a small reusable "gleam" sweep for canvas-drawn objects that
// can't use the DOM .sheen-target treatment every UI pill/icon already gets
// (UI.js's scheduleSheen, a random 5-30s per-element cycle). Two flavors,
// both built on the same drawShimmerSweep paint routine:
//   - A recurring, randomly-timed sweep (createShimmerTimer/
//     updateShimmerTimer) — used by Mound.js for the Mound and Science Lab,
//     per direct request ("shimmer/gleen like the other objects, but every
//     10-50 seconds").
//   - A one-shot sweep fired on a specific event (oneShotShimmerProgress) —
//     used by main.js for fish, per direct request ("whenever a fish is
//     placed, grows in size, or is merged/spliced, have them shimmer").
// Pure decoration; no gameplay effect, ever, same as Ambience.js.
// Forbidden: no reading/writing state.level beyond the elapsed clock it's
// handed — this is cosmetic timing, not simulation.

export const SHIMMER_SWEEP_DURATION_MS = 900;
const SHIMMER_MIN_INTERVAL_MS = 10000;
const SHIMMER_MAX_INTERVAL_MS = 50000;

function randomShimmerInterval() {
  return SHIMMER_MIN_INTERVAL_MS + Math.random() * (SHIMMER_MAX_INTERVAL_MS - SHIMMER_MIN_INTERVAL_MS);
}

// One of these per recurring-shimmer object (the Mound, the Science Lab —
// see Mound.js's moundShimmer/labShimmer).
export function createShimmerTimer() {
  return { nextAt: null, activeStartedAt: null };
}

// Returns the current sweep's progress (0..1) if one is actively playing
// right now, else null. Mutates `timer` in place — call exactly once per
// render per object, every frame, off state.level.elapsed (these modules
// don't own their own per-tick simulation, but their render functions
// already run every frame regardless, so no new call site is needed
// anywhere just for this). `nextAt`/`activeStartedAt` live entirely on
// elapsed's own ms timeline and are deliberately left alone across a level
// restart (elapsed resets to 0 and just counts back up toward whatever
// `nextAt` already was) — same as every other module-level decorative timer
// in this codebase, e.g. Ambience.js's bubble seeding.
export function updateShimmerTimer(timer, elapsed) {
  if (timer.nextAt === null) timer.nextAt = elapsed + randomShimmerInterval();
  if (timer.activeStartedAt === null && elapsed >= timer.nextAt) {
    timer.activeStartedAt = elapsed;
    timer.nextAt = elapsed + randomShimmerInterval(); // the FOLLOWING cycle, independent of this sweep's own ~900ms runtime
  }
  if (timer.activeStartedAt === null) return null;
  const t = (elapsed - timer.activeStartedAt) / SHIMMER_SWEEP_DURATION_MS;
  if (t >= 1) {
    timer.activeStartedAt = null;
    return null;
  }
  return t;
}

// One-shot progress for an EVENT-triggered shimmer (fish) — pass the
// elapsed ms the event happened at (a plain field on the entity, e.g.
// fish.shimmerStartedAt); returns 0..1 progress or null once it's finished.
// No timer object needed since there's nothing to reschedule — the caller
// just sets a fresh startedAt the next time the triggering event fires.
export function oneShotShimmerProgress(startedAt, elapsed) {
  if (startedAt == null) return null;
  const t = (elapsed - startedAt) / SHIMMER_SWEEP_DURATION_MS;
  return t < 1 ? t : null;
}

// Paints the sweep itself — a soft-edged diagonal band, brightest at its
// center, fading to fully transparent at both edges so it reads as a gleam
// rather than a hard-edged wipe. Caller is responsible for clipping to the
// shape's own silhouette first (a rectangle here, a circle for a fish,
// whatever the shape actually is); this just fills the given bounding box.
export function drawShimmerSweep(ctx, t, x, y, w, h) {
  if (t === null) return;
  const bandWidth = w * 0.4;
  const travel = w + bandWidth;
  const sweepX = x - bandWidth / 2 + t * travel;
  const grad = ctx.createLinearGradient(sweepX, y + h, sweepX + bandWidth, y);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}
