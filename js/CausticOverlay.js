// CausticOverlay.js — a lightweight, fully decoupled procedural caustic
// lighting effect spanning the whole tank, from the water's surface down to
// the soil bed. Per direct request ("a dynamic underwater caustic lighting
// shader that unifies the entire scene, from the surface to the soil
// bed... a single, complex, rippling caustic light pattern... this exact
// pattern must reach the tank floor").
//
// History of two false starts, both caught by actually profiling this
// effect in the real game (not a synthetic benchmark), worth keeping so
// nobody re-tries either approach:
//  1. A per-pixel ImageData "shader" (sample a brightness function at every
//     pixel of a low-res buffer, putImageData it, drawImage it scaled up)
//     — the FIRST version of this file. Even at a coarse 112x84 resolution
//     with heavily optimized math, the CPU pixel loop plus putImageData
//     plus the full-canvas-sized compositing (drawImage + gradient-masked
//     fillRect) needed to mask/tint it measured roughly HALVING real frame
//     rate in a full play session (~40fps -> ~20fps). Canvas 2D's ImageData
//     path is fundamentally a CPU round-trip; it doesn't matter how cheap
//     the per-pixel math is once you're pushing tens of thousands of pixels
//     through JS every frame.
//  2. Sharpening that per-pixel brightness with a high power (Math.pow(x,
//     3-4)) produced a fixed-looking lattice of thin bright veins that read
//     as flat "TV static" rather than flowing light — per direct report
//     ("remove the first attempt at the caustic lighting system that just
//     looks like static running across the screen").
//
// This version instead evaluates the SAME idea (two independently-rotating,
// summed sine fields — the classic cheap "fake caustic interference" trick)
// completely ANALYTICALLY, and only ever at a few dozen sample points per
// frame (one per soft blob in a jittered grid, plus one per stamp target),
// each drawn as an ordinary radial-gradient blob — cheap, GPU-friendly
// canvas draw calls, the same technique this file's own drawOneCaustic
// patches already used successfully, just unified into one continuous,
// full-tank field instead of a handful of independent fixed patches.
//
// Deliberately knows nothing about game/physics state — it only ever needs
// elapsed time, a screen rectangle, and (optionally) a flat list of
// {x, y, radius} world-space stamp targets, so main.js can call (or skip) it
// without touching anything else in the render pipeline.

const OVERLAY_OPACITY = 0.5; // per-blob peak alpha; blobs overlap under 'lighter' blending, so the effective wash reads far softer than this in isolation

// A grid of overlapping soft blobs spanning normalized (u, v) in [0,1]x[0,1]
// — dense enough (and each wide enough relative to its own cell) to read as
// one continuous net once all the overlapping 'lighter' blends are summed,
// not a sparse dot grid.
const GRID_COLS = 8;
const GRID_ROWS = 5;
const cells = [];
for (let row = 0; row < GRID_ROWS; row++) {
  for (let col = 0; col < GRID_COLS; col++) {
    cells.push({
      u0: (col + 0.5) / GRID_COLS,
      v0: (row + 0.5) / GRID_ROWS,
      driftFreqX: 0.12 + Math.random() * 0.18,
      driftFreqY: 0.1 + Math.random() * 0.16,
      driftPhaseX: Math.random() * Math.PI * 2,
      driftPhaseY: Math.random() * Math.PI * 2,
      pulseFreq: 0.25 + Math.random() * 0.35,
      pulsePhase: Math.random() * Math.PI * 2,
      sizeFrac: 0.8 + Math.random() * 0.5,
    });
  }
}
const DRIFT_AMP_U = (0.9 / GRID_COLS) * 0.5;
const DRIFT_AMP_V = (0.9 / GRID_ROWS) * 0.5;
const CELL_SPACING_U = 1 / GRID_COLS;
const CELL_SPACING_V = 1 / GRID_ROWS;

// Two independently-rotating sine fields summed together — same "classic
// interference net" trick as before, just sampled at one (u, v, t) point at
// a time instead of once per pixel of an offscreen buffer. Returns 0..1.
function causticBrightnessAt(u, v, t) {
  const rot1 = 0.4 + Math.sin(t * 0.05) * 0.15;
  const rot2 = -0.9 + Math.cos(t * 0.04) * 0.15;
  const x1 = u * Math.cos(rot1) + v * Math.sin(rot1);
  const y1 = -u * Math.sin(rot1) + v * Math.cos(rot1);
  const l1 = Math.sin((x1 + y1 * 1.3) * 7 + t * 0.55);
  const x2 = u * Math.cos(rot2) + v * Math.sin(rot2);
  const y2 = -u * Math.sin(rot2) + v * Math.cos(rot2);
  const l2 = Math.sin((x2 + y2 * 1.3) * 6 - t * 0.42);
  const combined = (l1 + l2) * 0.25 + 0.5;
  const bright = Math.max(0, combined - 0.5) * 2;
  return Math.min(1, bright * bright);
}

export class CausticOverlay {
  constructor() {
    this.enabled = true;
  }

  // Per direct request ("strong sun shafts filtering through the water...
  // this exact pattern must reach the tank floor... project this shimmering
  // caustic light net VIVIDLY across the entire soil bed"): a gentle U-shape
  // instead of a fade-to-zero — bright near the surface, easing off through
  // the mid-water column, then rising back to fully vivid right AT the
  // visible sand line (floorFrac) and staying vivid all the way down through
  // the dirt below it.
  verticalIntensity(v, floorFrac) {
    const dipFrac = Math.max(0, floorFrac - 0.22);
    if (v <= dipFrac) return 1;
    if (v <= floorFrac) return 1 - 0.5 * ((v - dipFrac) / Math.max(0.001, floorFrac - dipFrac));
    return 0.5 + 0.5 * Math.min(1, (v - floorFrac) / 0.1);
  }

  drawBlob(ctx, x, y, r, brightness) {
    if (brightness <= 0.02 || r <= 0.5) return;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(225, 248, 255, ${(brightness * OVERLAY_OPACITY).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(225, 248, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // destCtx: the main canvas context. canvasWidth/canvasHeight: viewport
  // size. waterTopScreenY: screen Y for world y=0 (the water's true
  // surface). seabedTopScreenY: screen Y for the visible sand line (world
  // SEABED_FLOOR_Y) — where "vivid on the floor" actually needs to kick in,
  // NOT the tank's deep (often mostly off-screen) true bottom.
  // worldBottomScreenY: screen Y for the tank's real current bottom, just
  // used as the overlay's own lower clip so it keeps covering any visible
  // dirt/buildings below the sand line too. elapsedS: the game's own running
  // clock, in seconds. stampTargets (optional): a flat list of
  // {x, y, radius} SCREEN-space circles (already camera-projected by the
  // caller) to additionally sample the SAME brightness field at, so specific
  // bottom objects (rocks, coral, the chest, seaweed bases) read as lit by
  // the exact same light net as the water above them.
  render(destCtx, canvasWidth, canvasHeight, waterTopScreenY, seabedTopScreenY, worldBottomScreenY, elapsedS, stampTargets) {
    if (!this.enabled) return;
    const spanTop = Math.max(0, waterTopScreenY);
    const spanBottom = Math.min(canvasHeight, worldBottomScreenY);
    const spanHeight = spanBottom - spanTop;
    if (spanHeight <= 0) return;
    const floorFrac = Math.max(0.15, Math.min(0.95, (seabedTopScreenY - spanTop) / spanHeight));

    destCtx.save();
    destCtx.globalCompositeOperation = 'lighter';
    const cellPxW = CELL_SPACING_U * canvasWidth;
    const cellPxH = CELL_SPACING_V * spanHeight;
    const baseR = Math.max(cellPxW, cellPxH) * 0.9;
    for (const c of cells) {
      const u = c.u0 + Math.sin(elapsedS * c.driftFreqX + c.driftPhaseX) * DRIFT_AMP_U;
      const v = c.v0 + Math.sin(elapsedS * c.driftFreqY + c.driftPhaseY) * DRIFT_AMP_V;
      const pulse = 0.5 + 0.5 * Math.sin(elapsedS * c.pulseFreq + c.pulsePhase);
      const field = causticBrightnessAt(u, v, elapsedS);
      const brightness = field * (0.55 + pulse * 0.45) * this.verticalIntensity(v, floorFrac);
      if (brightness <= 0.03) continue;
      const x = u * canvasWidth;
      const y = spanTop + v * spanHeight;
      this.drawBlob(destCtx, x, y, baseR * c.sizeFrac, brightness);
    }

    if (stampTargets && stampTargets.length) {
      // Deliberately lower peak brightness than the ambient blobs — with 40+
      // targets (every boulder/coral/seaweed base) often packed closely
      // together along the floor, their stamps overlap heavily under this
      // same additive blend, so a lower per-stamp contribution is what keeps
      // dense clusters from blowing straight out to solid white.
      for (const t of stampTargets) {
        if (t.x + t.radius < 0 || t.x - t.radius > canvasWidth || t.y + t.radius < 0) continue;
        const u = t.x / canvasWidth;
        const v = (t.y - spanTop) / spanHeight;
        if (v < -0.2 || v > 1.2) continue;
        const field = causticBrightnessAt(u, v, elapsedS);
        const brightness = field * this.verticalIntensity(v, floorFrac) * 0.7;
        this.drawBlob(destCtx, t.x, t.y, t.radius, brightness);
      }
    }
    destCtx.restore();
  }
}
