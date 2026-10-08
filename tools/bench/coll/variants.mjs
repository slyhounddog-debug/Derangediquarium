import { REFERENCE_SRC } from './harness.mjs';
const prefixEnd = REFERENCE_SRC.indexOf('const COLLISION_GRID_MARGIN_PX');
export const PREFIX = REFERENCE_SRC.slice(0, prefixEnd); // applyItemPush + pushDirection, verbatim

// The per-pair body shared by every candidate: identical arithmetic to the original, after a cheap squared-distance reject
// (1px beyond the touch range, so the keep/skip decision matches the original exactly).
const PAIR = `
        const b = items[J];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const far = minDist + SLEEP_NEIGHBOR_RANGE_PX + 1;
        if (dx * dx + dy * dy >= far * far) continue;
        let dist = Math.hypot(dx, dy);
        if (dist < minDist + SLEEP_NEIGHBOR_RANGE_PX) { a.touching = true; b.touching = true; }
        if (dist >= minDist) continue;
        if (dist < 0.001) dist = 0.001;
        const { nx, ny } = pushDirection(a, b, dx, dy, dist);
        const rawOverlap = minDist - dist;
        const overlap = Math.min(rawOverlap, ITEM_MAX_PUSH_PER_STEP);
        const totalMass = a.mass + b.mass;
        const aFrac = b.mass / totalMass;
        const bFrac = a.mass / totalMass;
        applyItemPush(state, a, -nx * overlap * aFrac, -ny * overlap * aFrac, aFrac * 2, rawOverlap);
        applyItemPush(state, b, nx * overlap * bFrac, ny * overlap * bFrac, bFrac * 2, rawOverlap);
        if (rawOverlap >= ITEM_PUSH_IMPULSE_MIN_OVERLAP) { a.sleeping = false; a.restTicks = 0; b.sleeping = false; b.restTicks = 0; }
`;

// V1: original grid code (array-of-arrays buckets), plus the early reject and an insertion sort instead of Array.sort.
export const V1 = PREFIX + `
const COLLISION_GRID_MARGIN_PX = 8 * ITEM_MAX_PUSH_PER_STEP;
const collisionGridCells = [];
let collisionGridTouched = [];
const collisionCandidates = [];
export function resolveItemCollisions(state, iterations = ITEM_COLLISION_ITERATIONS) {
  const items = state.level.items;
  const n = items.length;
  let maxRadius = 0;
  for (let i = 0; i < n; i++) { items[i].touching = false; if (items[i].radius > maxRadius) maxRadius = items[i].radius; }
  if (n < 2) return;
  const cell = 2 * maxRadius + COLLISION_GRID_MARGIN_PX;
  const cols = Math.ceil((WORLD_TILES_W * TILE_SIZE) / cell) + 3;
  const rows = Math.ceil((WORLD_TILES_H * TILE_SIZE) / cell) + 3;
  const cellX = (x) => Math.min(cols - 2, Math.max(1, Math.floor(x / cell) + 1));
  const cellY = (y) => Math.min(rows - 2, Math.max(1, Math.floor(y / cell) + 1));
  for (let iter = 0; iter < iterations; iter++) {
    for (let t = 0; t < collisionGridTouched.length; t++) collisionGridCells[collisionGridTouched[t]].length = 0;
    collisionGridTouched.length = 0;
    for (let i = 0; i < n; i++) {
      const idx = cellY(items[i].y) * cols + cellX(items[i].x);
      let bucket = collisionGridCells[idx];
      if (bucket === undefined) bucket = collisionGridCells[idx] = [];
      if (bucket.length === 0) collisionGridTouched.push(idx);
      bucket.push(i);
    }
    for (let i = 0; i < n; i++) {
      const a = items[i];
      const cx = cellX(a.x);
      const cy = cellY(a.y);
      collisionCandidates.length = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = collisionGridCells[(cy + oy) * cols + (cx + ox)];
          if (bucket === undefined) continue;
          for (let k = 0; k < bucket.length; k++) if (bucket[k] > i) collisionCandidates.push(bucket[k]);
        }
      }
      for (let p = 1; p < collisionCandidates.length; p++) { const v = collisionCandidates[p]; let q = p - 1; while (q >= 0 && collisionCandidates[q] > v) { collisionCandidates[q + 1] = collisionCandidates[q]; q--; } collisionCandidates[q + 1] = v; }
      for (let c = 0; c < collisionCandidates.length; c++) {
${PAIR.replace('items[J]', 'items[collisionCandidates[c]]')}
      }
    }
  }
}
`;

// V2: V1's per-pair logic with a flat counting-sort grid (typed arrays, no per-cell arrays, no closures). The 3 cells of a
// grid row are contiguous in the sorted array, so a neighbourhood is 3 contiguous ranges.
export const V2 = PREFIX + `
const COLLISION_GRID_MARGIN_PX = 8 * ITEM_MAX_PUSH_PER_STEP;
let gCellCount = new Int32Array(1);
let gCellStart = new Int32Array(1);
let gSorted = new Int32Array(1);
let gCellOf = new Int32Array(1);
let gCand = new Int32Array(1);
export function resolveItemCollisions(state, iterations = ITEM_COLLISION_ITERATIONS) {
  const items = state.level.items;
  const n = items.length;
  let maxRadius = 0;
  for (let i = 0; i < n; i++) { items[i].touching = false; if (items[i].radius > maxRadius) maxRadius = items[i].radius; }
  if (n < 2) return;
  const cell = 2 * maxRadius + COLLISION_GRID_MARGIN_PX;
  const cols = Math.ceil((WORLD_TILES_W * TILE_SIZE) / cell) + 3;
  const rows = Math.ceil((WORLD_TILES_H * TILE_SIZE) / cell) + 3;
  const cells = cols * rows;
  if (gCellStart.length < cells + 1) { gCellStart = new Int32Array(cells + 1); gCellCount = new Int32Array(cells + 1); }
  if (gSorted.length < n) { gSorted = new Int32Array(n * 2); gCellOf = new Int32Array(n * 2); gCand = new Int32Array(n * 2); }
  const colMax = cols - 2, rowMax = rows - 2;
  for (let iter = 0; iter < iterations; iter++) {
    gCellCount.fill(0, 0, cells + 1);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      let cx = Math.floor(it.x / cell) + 1; cx = cx < 1 ? 1 : (cx > colMax ? colMax : cx);
      let cy = Math.floor(it.y / cell) + 1; cy = cy < 1 ? 1 : (cy > rowMax ? rowMax : cy);
      const idx = cy * cols + cx;
      gCellOf[i] = idx;
      gCellCount[idx]++;
    }
    let run = 0;
    for (let c = 0; c < cells; c++) { gCellStart[c] = run; run += gCellCount[c]; gCellCount[c] = gCellStart[c]; }
    gCellStart[cells] = run;
    for (let i = 0; i < n; i++) gSorted[gCellCount[gCellOf[i]]++] = i;
    for (let i = 0; i < n; i++) {
      const a = items[i];
      let cx = Math.floor(a.x / cell) + 1; cx = cx < 1 ? 1 : (cx > colMax ? colMax : cx);
      let cy = Math.floor(a.y / cell) + 1; cy = cy < 1 ? 1 : (cy > rowMax ? rowMax : cy);
      let m = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const base = (cy + oy) * cols + cx;
        const end = gCellStart[base + 2];
        for (let k = gCellStart[base - 1]; k < end; k++) { const j = gSorted[k]; if (j > i) gCand[m++] = j; }
      }
      for (let p = 1; p < m; p++) { const v = gCand[p]; let q = p - 1; while (q >= 0 && gCand[q] > v) { gCand[q + 1] = gCand[q]; q--; } gCand[q + 1] = v; }
      for (let c = 0; c < m; c++) {
${PAIR.replace('items[J]', 'items[gCand[c]]')}
      }
    }
  }
}
`;

export const V3 = PREFIX + `
const COLLISION_GRID_MARGIN_PX = 8 * ITEM_MAX_PUSH_PER_STEP;
let gCellCount = new Int32Array(1);
let gCellStart = new Int32Array(1);
let gSorted = new Int32Array(1);
let gCellOf = new Int32Array(1);
let gCand = new Int32Array(1);
export function resolveItemCollisions(state, iterations = ITEM_COLLISION_ITERATIONS) {
  const items = state.level.items;
  const n = items.length;
  let maxRadius = 0;
  for (let i = 0; i < n; i++) { items[i].touching = false; if (items[i].radius > maxRadius) maxRadius = items[i].radius; }
  if (n < 2) return;
  const cell = 2 * maxRadius + COLLISION_GRID_MARGIN_PX;
  const cols = Math.ceil((WORLD_TILES_W * TILE_SIZE) / cell) + 3;
  const rows = Math.ceil((WORLD_TILES_H * TILE_SIZE) / cell) + 3;
  const cells = cols * rows;
  if (gCellStart.length < cells + 1) { gCellStart = new Int32Array(cells + 1); gCellCount = new Int32Array(cells + 1); }
  if (gSorted.length < n) { gSorted = new Int32Array(n * 2); gCellOf = new Int32Array(n * 2); gCand = new Int32Array(n * 2); }
  const colMax = cols - 2, rowMax = rows - 2;
  for (let iter = 0; iter < iterations; iter++) {
    gCellCount.fill(0, 0, cells + 1);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      let cx = Math.floor(it.x / cell) + 1; cx = cx < 1 ? 1 : (cx > colMax ? colMax : cx);
      let cy = Math.floor(it.y / cell) + 1; cy = cy < 1 ? 1 : (cy > rowMax ? rowMax : cy);
      const idx = cy * cols + cx;
      gCellOf[i] = idx;
      gCellCount[idx]++;
    }
    let run = 0;
    for (let c = 0; c < cells; c++) { gCellStart[c] = run; run += gCellCount[c]; gCellCount[c] = gCellStart[c]; }
    gCellStart[cells] = run;
    for (let i = 0; i < n; i++) gSorted[gCellCount[gCellOf[i]]++] = i;
    let anyOverlap = false;
    for (let i = 0; i < n; i++) {
      const a = items[i];
      let cx = Math.floor(a.x / cell) + 1; cx = cx < 1 ? 1 : (cx > colMax ? colMax : cx);
      let cy = Math.floor(a.y / cell) + 1; cy = cy < 1 ? 1 : (cy > rowMax ? rowMax : cy);
      let m = 0;
      let near = false;
      for (let oy = -1; oy <= 1; oy++) {
        const base = (cy + oy) * cols + cx;
        const end = gCellStart[base + 2];
        for (let k = gCellStart[base - 1]; k < end; k++) { const j = gSorted[k]; if (j > i) { gCand[m++] = j; const bb = items[j]; const ddx = bb.x - a.x, ddy = bb.y - a.y, ff = a.radius + bb.radius + SLEEP_NEIGHBOR_RANGE_PX + 1; if (ddx * ddx + ddy * ddy < ff * ff) near = true; } }
      }
      if (!near) continue; // nothing within touching range => no pair would do anything, so no position can change: identical to visiting them all
      for (let p = 1; p < m; p++) { const v = gCand[p]; let q = p - 1; while (q >= 0 && gCand[q] > v) { gCand[q + 1] = gCand[q]; q--; } gCand[q + 1] = v; }
      for (let c = 0; c < m; c++) {
${PAIR.replace('items[J]', 'items[gCand[c]]').replace('if (dist < 0.001) dist = 0.001;', 'anyOverlap = true; if (dist < 0.001) dist = 0.001;')}
      }
    }
    if (!anyOverlap) break; // nothing moved, so the next iteration would start from identical positions and do nothing again
  }
}
`;

// V4: V2 + pushDirection's arithmetic inlined (it allocated an object per overlapping pair); same operations, same results.
const INLINE_DIR = `let nx = dx / dist;
        let ny = dy / dist;
        if (Math.abs(nx) < ITEM_MIN_HORIZONTAL_PUSH_FRACTION) {
          const sign = (a.id + b.id) % 2 === 0 ? 1 : -1;
          nx = sign * ITEM_MIN_HORIZONTAL_PUSH_FRACTION;
          ny = (ny < 0 ? -1 : 1) * Math.sqrt(1 - ITEM_MIN_HORIZONTAL_PUSH_FRACTION * ITEM_MIN_HORIZONTAL_PUSH_FRACTION);
        }`;
export const V4 = V2.replace('const { nx, ny } = pushDirection(a, b, dx, dy, dist);', INLINE_DIR);
