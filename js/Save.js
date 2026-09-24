// Save.js — LocalStorage save/load for the campaign's meta+level state
// (Phase 5, finally wired up). The whole root state is deliberately plain-
// object/JSON-serializable (see CLAUDE.md's "State Shape & Field Ownership" —
// no class instances, no DOM refs, no Map/Set) specifically so this file can
// stay this small: a save is just `{ meta, level }` serialized whole, with no
// custom per-field (de)serialization needed anywhere. camera/ui/debug are
// deliberately NOT saved — they're session-local (camera pan position, which
// tool is selected, debug overlay state), not campaign progress.

import { WORLD_TILES_H, WORLD_TILES_W, TILE_EMPTY } from './Config.js';

const SAVE_KEY = 'derangiquarium_save_v1';

export function hasSaveGame() {
  try {
    return localStorage.getItem(SAVE_KEY) != null;
  } catch {
    return false; // localStorage can throw in a locked-down/private-browsing context — treat that as "no save" rather than crashing the start screen
  }
}

export function saveGame(state) {
  try {
    const payload = JSON.stringify({ meta: state.meta, level: state.level, savedAtMs: Date.now() });
    localStorage.setItem(SAVE_KEY, payload);
    return true;
  } catch (err) {
    console.error('Derangiquarium: save failed', err);
    return false;
  }
}

// Returns { meta, level } (savedAtMs stripped — callers only ever want the
// two real state slices) or null if there's no save / it's corrupt.
export function loadSaveGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.meta || !parsed.level) return null;
    migrateTurretAmmoFields(parsed.level);
    migrateChestCoinFields(parsed.level);
    migrateGridSize(parsed.level);
    // A save written before Shift-click Replace won't have this array at
    // all — Grid.js's applyReplacementMutation pushes straight into it with
    // no existence check of its own (every other transient level array is
    // always guaranteed present by Levels.js's own fresh-level factory).
    if (!Array.isArray(parsed.level.pendingChestEjectSpawnPoints)) parsed.level.pendingChestEjectSpawnPoints = [];
    // A save written before the autosave-while-paused change won't have this
    // field at all — Systems.js's updateAutosave now compares against it
    // instead of state.level.elapsed (see its own comment), and
    // `undefined += dtMs` would go NaN forever, which fails the `<` check
    // unconditionally and fires a real save EVERY single tick from then on.
    // Defaults to 0, same "one-time reset is an acceptable side effect of the
    // migration" precedent as migrateTurretAmmoFields below — worst case, an
    // existing save's very next autosave takes a little longer than usual to
    // arrive, never a crash or a spam-save.
    if (typeof parsed.level.wallClockMs !== 'number') parsed.level.wallClockMs = 0;
    // A save written before the Tank Expansion Tank Upgrade won't have this
    // field at all — Grid.js's getUnlockedSeabedRowEnd multiplies it by
    // TANK_EXPANSION_ROWS_PER_TIER, and `undefined * n` is NaN, which would
    // fail every row comparison against it and lock the player out of
    // building anywhere at all. Defaults to 0 same as every other migration
    // here — safe because TANK_EXPANSION_BASE_ROW_END (tier 0's unlocked
    // line) was deliberately set to exactly the OLD WORLD_TILES_H - 1, so an
    // old save's entire pre-existing city is already fully unlocked at tier
    // 0; nothing the player already built becomes newly inaccessible.
    if (typeof parsed.level.upgrades.tankExpansionTier !== 'number') parsed.level.upgrades.tankExpansionTier = 0;
    // A save written before the Fish Health Tank Upgrade won't have this
    // field at all — Entities.js's maxHpForStage multiplies it by
    // FISH_HEALTH_UPGRADE_BONUS_PER_LEVEL, and `undefined * n` is NaN, which
    // would contaminate every fish's maxHp/hp from that point on. Defaults
    // to 0, same migration shape as tankExpansionTier just above.
    if (typeof parsed.level.upgrades.fishHealth !== 'number') parsed.level.upgrades.fishHealth = 0;
    return { meta: parsed.meta, level: parsed.level };
  } catch (err) {
    console.error('Derangiquarium: load failed', err);
    return null;
  }
}

// One-off migration: a turret's ammo used to be a single `ammo` number
// before Biomass ammo split it into `ammoWaste`/`ammoBiomass` (Grid.js's
// updateBuildings — Biomass deals more damage per shot, so it can't share a
// pool with Waste ammo any more). A save written before that split still has
// the old shape; without this, every turret's old ammo total would just
// vanish (undefined + undefined = NaN, and a NaN ammo count blocks both
// firing and refilling — see Grid.js's hasAmmo/intake-cap checks) the first
// time an old save loads.
function migrateTurretAmmoFields(level) {
  if (!level || !level.buildingData) return;
  for (const key in level.buildingData) {
    const data = level.buildingData[key];
    if (data && typeof data.ammo === 'number' && data.ammoWaste === undefined) {
      data.ammoWaste = data.ammo;
      data.ammoBiomass = 0;
      delete data.ammo;
    }
  }
}

// One-off migration: a Storage Chest used to pool every held coin's value
// into one plain number (`coinValueSum`), dispensing the running average per
// unit ejected — per direct bug report, that let a single high-value coin's
// worth quietly leak into a bunch of low-value ones. Grid.js now tracks a
// real FIFO queue of each coin's own exact value (`coinQueue`) instead. A
// save written before that change has the old field and no queue at all;
// without this, the very first coin ejection from a save-loaded chest would
// throw calling `.shift()` on `undefined`. The original individual coin
// values are unrecoverable at this point (only their pooled sum survived),
// so this approximates by re-expanding the sum into `count` equal-average
// entries — a one-time best-effort backfill, not a claim that FIFO order
// held for coins deposited before this migration ever ran.
function migrateChestCoinFields(level) {
  if (!level || !level.buildingData) return;
  for (const key in level.buildingData) {
    const data = level.buildingData[key];
    if (data && typeof data.coinValueSum === 'number' && data.coinQueue === undefined) {
      data.coinQueue = [];
      if (data.lockedItemType === 'coin' && data.count > 0) {
        const avg = Math.max(1, Math.round(data.coinValueSum / data.count));
        for (let i = 0; i < data.count; i++) data.coinQueue.push(avg);
      }
      delete data.coinValueSum;
    }
  }
}

// One-off migration: state.level.grid is a dense WORLD_TILES_H x
// WORLD_TILES_W array serialized whole into the save (see this file's own
// header comment) — it is NOT regenerated on load the way a brand-new
// level's grid is (Levels.js's createGrid). The Tank Expansion Tank Upgrade
// grew WORLD_TILES_H (40 -> 50, see Config.js's "Tank Expansion" comment); a
// save written before that change still has a real 40-row array, 10 rows
// short of what render/physics code now expects to be able to index into
// (e.g. Grid.js's renderSeabedGrid scrolling the camera down into the newly
// fogged-but-still-real rows would hit `grid[row]` as `undefined` and throw).
// Pads the array up to the CURRENT WORLD_TILES_H with fresh all-TILE_EMPTY
// rows, same shape createGrid itself builds — those rows start locked behind
// tier 0 regardless (see the tankExpansionTier migration above), so nothing
// is newly buildable, this purely prevents an out-of-bounds crash.
function migrateGridSize(level) {
  if (!level || !Array.isArray(level.grid)) return;
  while (level.grid.length < WORLD_TILES_H) {
    level.grid.push(new Array(WORLD_TILES_W).fill(TILE_EMPTY));
  }
}

export function clearSaveGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to clean up if localStorage itself is unavailable
  }
}
