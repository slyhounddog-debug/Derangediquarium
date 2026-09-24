// Save.js — LocalStorage save/load for the campaign's meta+level state
// (Phase 5, finally wired up). The whole root state is deliberately plain-
// object/JSON-serializable (see CLAUDE.md's "State Shape & Field Ownership" —
// no class instances, no DOM refs, no Map/Set) specifically so this file can
// stay this small: a save is just `{ meta, level }` serialized whole, with no
// custom per-field (de)serialization needed anywhere. camera/ui/debug are
// deliberately NOT saved — they're session-local (camera pan position, which
// tool is selected, debug overlay state), not campaign progress.

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

export function clearSaveGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to clean up if localStorage itself is unavailable
  }
}
