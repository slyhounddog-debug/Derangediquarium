// PROTOTYPE (not shipped): "pile sleeping" for item physics. Creates a temp copy of the working-tree js/ folder and patches ONLY the copy
// (Grid.js), so the real game code is never touched. Returns the path of the patched js/ folder.
//
// Idea being tested: an item that, together with every item it is touching, has not moved (< 0.02px) for PILE_SLEEP_AFTER ticks is put to
// sleep and skipped entirely (its own physics step, and as the "active" side of collision pair checks), until something disturbs it.
//   - sleeps only as a whole group: any in-range pair with a member that is not yet calm blocks both from sleeping that tick
//   - a sleeper wakes when: an awake item overlaps it by >= ITEM_PUSH_IMPULSE_MIN_OVERLAP (a real hit), it is displaced, it gets velocity,
//     the grid/filters change (the existing sleep epoch), a fan force reaches it, an item near it was removed (consumed/deleted),
//     or its staggered refresh tick comes up (a safety net: every PILE_REFRESH_STEPS ticks it runs one full step and re-sleeps if still still)
//   - resting contact between an awake item and a sleeper (overlap < the hit threshold) treats the sleeper as a fixed support
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

export function makeProtoJs(opts = {}) {
  const AFTER = opts.sleepAfter ?? 30;
  const REFRESH = opts.refreshSteps ?? 20;
  const REMOVAL_RADIUS = opts.removalRadius ?? 90;
  const CALM_EPS = opts.calmEps ?? 0.02;       // per-tick movement below which an item counts as calm (the game's own 'stable' test uses 0.02)
  const CHEAP_REMOVAL = opts.cheapRemoval ?? false; // only diff the item list for removals when its length changed
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsanity_proto_'));
  fs.cpSync(path.join(repo, 'js'), path.join(dir, 'js'), { recursive: true });
  const file = path.join(dir, 'js', 'Grid.js');
  let g = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const rep = (a, b) => { if (!g.includes(a)) throw new Error('prototype patch anchor missing: ' + a.slice(0, 70)); g = g.replace(a, b); };

  // ---- constants + helpers (module level) ----
  rep('let sleepStepCounter = 0;', `const PILE_SLEEP_AFTER = ${AFTER};
const PILE_REFRESH_STEPS = ${REFRESH};
const PILE_REMOVAL_WAKE_RADIUS = ${REMOVAL_RADIUS};
const PILE_CALM_EPS = ${CALM_EPS};
const PILE_CHEAP_REMOVAL = ${CHEAP_REMOVAL};
let pileSleepers = 0; // diagnostic: how many items are pile-asleep after the last collision pass
export function getPileSleeperCount() { return pileSleepers; }
let pilePrevItems = null;
function wakePileNear(x, y, radius, items) {
  const r2 = radius * radius;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it.psleep) continue;
    const dx = it.x - x, dy = it.y - y;
    if (dx * dx + dy * dy <= r2) { it.psleep = false; it.calmTicks = 0; }
  }
}
// An item that was in the list last tick and is not now was consumed/eaten/deleted: whatever was resting on or against it must re-check.
function wakeAroundRemoved(items) {
  if (PILE_CHEAP_REMOVAL && pilePrevItems !== null && pilePrevItems.length === items.length) { pilePrevItems = items; return; }
  if (pilePrevItems !== null) {
    const now = new Set(items);
    for (let i = 0; i < pilePrevItems.length; i++) {
      const old = pilePrevItems[i];
      if (!now.has(old)) wakePileNear(old.x, old.y, PILE_REMOVAL_WAKE_RADIUS, items);
    }
  }
  pilePrevItems = items.slice();
}
let sleepStepCounter = 0;`);

  // ---- stepItemOnGrid: sleeper fast path + calm counter ----
  rep(`  if (item.sleeping) {
    const stillThere = Math.abs(item.x - item.sleepX)`, `  if (item.psleep) {
    const still = Math.abs(item.x - item.psleepX) <= SLEEP_MOVE_EPSILON_PX && Math.abs(item.y - item.psleepY) <= SLEEP_MOVE_EPSILON_PX;
    const calmV = (item.vx || 0) < SLEEP_SPEED_EPSILON && (item.vx || 0) > -SLEEP_SPEED_EPSILON && (item.vy || 0) < SLEEP_SPEED_EPSILON && (item.vy || 0) > -SLEEP_SPEED_EPSILON;
    if (still && calmV && item.psleepEpoch === sleepEpoch) {
      const f = computeFanForce(state, item);
      if (f.fx === 0 && f.fy === 0) {
        if ((sleepStepCounter + item.id) % PILE_REFRESH_STEPS !== 0) return 'resting';
        item.psleep = false; // safety-net refresh: one full step; it re-sleeps right away if everything is still calm
        item.calmTicks = PILE_SLEEP_AFTER - 1;
      } else { item.psleep = false; item.calmTicks = 0; }
    } else { item.psleep = false; item.calmTicks = 0; }
  }
  if (item.sleeping) {
    const stillThere = Math.abs(item.x - item.sleepX)`);
  rep(`  item.stepX = item.x;
  item.stepY = item.y;
`, `  item.stepX = item.x;
  item.stepY = item.y;
  item.calmTicks = pileCalm ? (item.calmTicks || 0) + 1 : 0;
`);
  rep(`  const stable = item.stepX !== undefined`, `  const pileCalm = item.stepX !== undefined && Math.abs(item.x - item.stepX) < PILE_CALM_EPS && Math.abs(item.y - item.stepY) < PILE_CALM_EPS;
  const stable = item.stepX !== undefined`);

  // ---- collisions ----
  rep(`  for (let i = 0; i < n; i++) { items[i].touching = false; if (items[i].radius > maxRadius) maxRadius = items[i].radius; }
  if (n < 2) return;`, `  wakeAroundRemoved(items);
  for (let i = 0; i < n; i++) { if (!items[i].psleep) items[i].touching = false; if (items[i].radius > maxRadius) maxRadius = items[i].radius; }
  if (n < 2) return;`);
  rep(`      if (gridCellOf[i] < 0) continue;
      const a = items[i];`, `      if (gridCellOf[i] < 0) continue;
      const a = items[i];
      if (a.psleep) continue; // sleepers are only ever examined from the awake side`);
  rep("for (let k = gridCellStart[base - 1]; k < end; k++) { const j = gridSorted[k]; if (j > i) gridCandidates[count++] = j; }", "for (let k = gridCellStart[base - 1]; k < end; k++) { const j = gridSorted[k]; if (j > i || (j !== i && items[j].psleep)) gridCandidates[count++] = j; }");
  rep(`        if (dist < minDist + SLEEP_NEIGHBOR_RANGE_PX) { a.touching = true; b.touching = true; }
        if (dist >= minDist) continue;
        if (dist < 0.001) dist = 0.001; // centers coincide — nudge along an arbitrary stable axis instead of dividing by zero
`, `        const bAsleep = b.psleep === true;
        if (dist < minDist + SLEEP_NEIGHBOR_RANGE_PX) {
          a.touching = true;
          if (!bAsleep) b.touching = true;
          // a group only sleeps together: any in-range pair with a member that is not calm yet blocks both this tick
          if ((a.calmTicks || 0) < PILE_SLEEP_AFTER || (!bAsleep && (b.calmTicks || 0) < PILE_SLEEP_AFTER)) { a.blockSleep = sleepStepCounter; b.blockSleep = sleepStepCounter; }
        }
        if (dist >= minDist) continue;
        if (dist < 0.001) dist = 0.001; // centers coincide — nudge along an arbitrary stable axis instead of dividing by zero
        if (bAsleep) {
          if (b.psleep && minDist - dist >= ITEM_PUSH_IMPULSE_MIN_OVERLAP) { b.psleep = false; b.calmTicks = 0; } // a real hit: wake it and resolve normally below
          else { // resting contact against a sleeper: it is a fixed support, only the awake item is moved out of it
            const ov = Math.min(minDist - dist, ITEM_MAX_PUSH_PER_STEP);
            const dn = pushDirection(a, b, dx, dy, dist);
            applyItemPush(state, a, -dn.nx * ov, -dn.ny * ov, 1, minDist - dist);
            continue;
          }
        }
`);
  // after the iteration loop: put calm groups to sleep
  rep(`        if (rawOverlap >= ITEM_PUSH_IMPULSE_MIN_OVERLAP) { a.sleeping = false; a.restTicks = 0; b.sleeping = false; b.restTicks = 0; }
      }
    }
  }
}`, `        if (rawOverlap >= ITEM_PUSH_IMPULSE_MIN_OVERLAP) { a.sleeping = false; a.restTicks = 0; b.sleeping = false; b.restTicks = 0; }
      }
    }
  }
  let sleepers = 0;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    if (it.psleep) { sleepers++; continue; }
    if ((it.calmTicks || 0) >= PILE_SLEEP_AFTER && it.blockSleep !== sleepStepCounter && it.collectorProgressMs == null && it.heldByKey == null) {
      it.psleep = true; it.psleepX = it.x; it.psleepY = it.y; it.psleepEpoch = sleepEpoch; it.vx = 0; it.vy = 0;
      sleepers++;
    }
  }
  pileSleepers = sleepers;
}`);
  fs.writeFileSync(file, g.replace(/\n/g, '\n'));
  return path.join(dir, 'js');
}
