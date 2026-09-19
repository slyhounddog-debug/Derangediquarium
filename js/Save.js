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

export function clearSaveGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to clean up if localStorage itself is unavailable
  }
}
