// Systems.js — cross-cutting simulation systems: the bankruptcy/game-over
// and Escape-dare story triggers, and Alien Invasion wave timing/scheduling
// (updateAlienWaves — genuinely cross-cutting: reads/writes elapsed time,
// notifications, and pushes into state.level.alienPortals, which Entities.js
// then turns into real alien entities — see that function's own comment for
// why the split avoids a circular import). Cleanliness/toxicity/eel power
// balance/science accumulation live in Entities.js/Grid.js instead, not
// here, despite this module's original header once reserving them.
// Forbidden: no rendering, no input handling.

import {
  FOOD_COST,
  BANKRUPTCY_BAILOUT_AMOUNT,
  ESCAPE_DARE_DELAY_MS,
  NOTIFICATION_LOG_MAX,
  ALIEN_WAVE_INTERVAL_MIN_MS,
  ALIEN_WAVE_INTERVAL_MAX_MS,
  ALIEN_WAVE_DIFFICULTY_RAMP_WAVES,
  ALIEN_WAVE_COUNT_EARLY_MIN,
  ALIEN_WAVE_COUNT_EARLY_MAX,
  ALIEN_WAVE_COUNT_LATE_MIN,
  ALIEN_WAVE_COUNT_LATE_MAX,
  ALIEN_HP_EARLY_MIN,
  ALIEN_HP_EARLY_MAX,
  ALIEN_HP_LATE_MIN,
  ALIEN_HP_LATE_MAX,
  ALIEN_WARNING_MS_1,
  ALIEN_WARNING_MS_2,
  ALIEN_WARNING_MESSAGE_1,
  ALIEN_WARNING_MESSAGE_2,
  ALIEN_FIRST_WAVE_TIP_MESSAGE,
  ALIEN_PORTAL_STAGGER_MS,
  ALIEN_MAX_ALIVE,
  FISH_MIN_X,
  FISH_MAX_X,
  FISH_MIN_Y,
  SEABED_FLOOR_Y,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings } from './Levels.js';
import { getFishPurchaseCost } from './Entities.js';

const BANKRUPTCY_BAILOUT_MESSAGE =
  "Oopah, looks like someone got their CDL so they could drive the struggle bus! Here's 100 gold to get you back on your feet. I'll be expecting that back (I'm lying).";
const GAME_OVER_MESSAGE =
  'My mama always said "Shooting a fish out of water in a barrel with bigger fish to fry" and I always took that to heart. Better luck next time! (Restart in the menu)';
const ESCAPE_DARE_MESSAGE = 'yoo, press escape. I dare you';

function pushNotification(state, text) {
  const notifications = state.level.notifications;
  notifications.push({ id: notifications.length + 1, text, elapsed: state.level.elapsed });
  if (notifications.length > NOTIFICATION_LOG_MAX) notifications.shift();
}

// The cheapest thing currently purchasable at all — Food, or the cheapest
// available species (at its live dynamic price for economy fish) or
// building. Used only to detect "can't afford anything," not to recommend
// a purchase, so ties/exact affordability edge cases don't matter here.
function cheapestAvailablePurchase(state) {
  let cheapest = FOOD_COST;
  for (const species of getAvailableSpecies(state)) {
    cheapest = Math.min(cheapest, getFishPurchaseCost(state, species.id));
  }
  for (const building of getAvailableBuildings(state)) {
    cheapest = Math.min(cheapest, building.cost);
  }
  return cheapest;
}

// "No fish left AND can't afford anything in the shop" — the first time
// this becomes true, a $100 bailout gets the player back on their feet; the
// second time, it's game over (the sim freezes, same as state.ui.paused,
// but via the separate state.level.gameOver flag so Escape still reaches
// the pause menu's Restart button without also un-freezing a lost game).
// bankruptcyActive gates this to the RISING EDGE of the condition — without
// it, every tick the condition stayed true would re-trigger the response.
function updateBankruptcy(state) {
  if (state.level.gameOver) return;
  const hasFish = state.level.entities.some((e) => e.type === 'fish');
  const isBroke = !hasFish && state.level.money < cheapestAvailablePurchase(state);

  if (!isBroke) {
    state.level.bankruptcyActive = false;
    return;
  }
  if (state.level.bankruptcyActive) return; // already handled this occurrence, waiting for it to clear
  state.level.bankruptcyActive = true;
  state.level.bankruptciesTriggered += 1;

  if (state.level.bankruptciesTriggered === 1) {
    state.level.money += BANKRUPTCY_BAILOUT_AMOUNT;
    pushNotification(state, BANKRUPTCY_BAILOUT_MESSAGE);
  } else {
    state.level.gameOver = true;
    pushNotification(state, GAME_OVER_MESSAGE);
  }
}

// Fires once, if Escape has genuinely never been pressed by the 2-minute
// mark — main.js's keydown handler sets tutorialFlags.escapePressed the
// instant Escape is pressed for the first time (regardless of what it did
// contextually — closing the Mound popup still counts), so this simply
// never fires once that's already true.
function updateEscapeDare(state) {
  const flags = state.level.tutorialFlags;
  if (flags.escapePressed || flags.escapeDareShown) return;
  if (state.level.elapsed < ESCAPE_DARE_DELAY_MS) return;
  flags.escapeDareShown = true;
  pushNotification(state, ESCAPE_DARE_MESSAGE);
}

function randomWaveIntervalMs() {
  return ALIEN_WAVE_INTERVAL_MIN_MS + Math.random() * (ALIEN_WAVE_INTERVAL_MAX_MS - ALIEN_WAVE_INTERVAL_MIN_MS);
}

// Linear interpolation from the "early" range up to the "late" range across
// ALIEN_WAVE_DIFFICULTY_RAMP_WAVES waves, then plateaus — wavesSpawned is
// state.level.alienWavesSpawned BEFORE this wave counts, so wave 1 starts at
// t=0 (purely early) and wave 11+ sits at t=1 (purely late).
function alienDifficultyT(wavesSpawned) {
  return Math.min(1, wavesSpawned / ALIEN_WAVE_DIFFICULTY_RAMP_WAVES);
}

// Pushes ALIEN_PORTAL_STAGGER_MS-staggered portal records into
// state.level.alienPortals — plain data only, no alien entity created here.
// Entities.js's updateEntities (updateAlienPortals) is what turns a due
// portal into a real alien once its own open delay elapses — see that
// function's own comment for why the split avoids a circular import.
function spawnAlienWave(state) {
  const t = alienDifficultyT(state.level.alienWavesSpawned);
  const countMin = Math.round(ALIEN_WAVE_COUNT_EARLY_MIN + (ALIEN_WAVE_COUNT_LATE_MIN - ALIEN_WAVE_COUNT_EARLY_MIN) * t);
  const countMax = Math.round(ALIEN_WAVE_COUNT_EARLY_MAX + (ALIEN_WAVE_COUNT_LATE_MAX - ALIEN_WAVE_COUNT_EARLY_MAX) * t);
  const rolledCount = countMin + Math.floor(Math.random() * (countMax - countMin + 1));
  const hpMin = Math.round(ALIEN_HP_EARLY_MIN + (ALIEN_HP_LATE_MIN - ALIEN_HP_EARLY_MIN) * t);
  const hpMax = Math.round(ALIEN_HP_EARLY_MAX + (ALIEN_HP_LATE_MAX - ALIEN_HP_EARLY_MAX) * t);

  // ALIEN_MAX_ALIVE is a hard ceiling on simultaneously-alive aliens, not a
  // per-wave size limit — a neglected tank that already has a screenful of
  // aliens gets a smaller wave (or none at all, still counted as "spawned"
  // for the difficulty ramp) rather than piling on top without bound. Any
  // not-yet-opened portal from THIS wave's own stagger counts too, so a
  // wave can't sneak a burst past the cap between the count check and the
  // portals actually opening.
  const aliveCount = state.level.entities.reduce((n, e) => n + (e.type === 'alien' && e.hp > 0 ? 1 : 0), 0)
    + state.level.alienPortals.filter((p) => !p.spawned).length;
  const count = Math.max(0, Math.min(rolledCount, ALIEN_MAX_ALIVE - aliveCount));

  for (let i = 0; i < count; i++) {
    state.level.alienPortals.push({
      x: FISH_MIN_X + Math.random() * (FISH_MAX_X - FISH_MIN_X),
      // Biased toward the upper-mid water column (not down near the seabed
      // line) so a fresh portal reads as "emerging from open water," not
      // spawning right on top of the player's factory.
      y: FISH_MIN_Y + Math.random() * (SEABED_FLOOR_Y * 0.7 - FISH_MIN_Y),
      hp: hpMin + Math.floor(Math.random() * (hpMax - hpMin + 1)),
      openAtMs: state.level.elapsed + i * ALIEN_PORTAL_STAGGER_MS,
      spawned: false,
      spawnedAtMs: 0,
    });
  }
  state.level.alienWavesSpawned += 1;

  if (!state.level.tutorialFlags.firstAlienWaveTipShown) {
    state.level.tutorialFlags.firstAlienWaveTipShown = true;
    pushNotification(state, ALIEN_FIRST_WAVE_TIP_MESSAGE);
  }
}

// Wave timing/warnings/difficulty ramp — the "wave timers" scope this
// module's own header comment has reserved since Phase 1. alienNextWaveAtMs
// is an absolute state.level.elapsed target (Levels.js seeds the first one),
// matching updateEscapeDare's own ESCAPE_DARE_DELAY_MS pattern above, rather
// than a countdown-from value. Portal/alien creation itself lives in
// Entities.js (see spawnAlienWave's own comment) — this function only ever
// decides WHEN a wave should start and pushes the resulting portal data.
function updateAlienWaves(state) {
  const elapsed = state.level.elapsed;
  const nextWaveAt = state.level.alienNextWaveAtMs;

  if (!state.level.alienWarning1Shown && elapsed >= nextWaveAt - ALIEN_WARNING_MS_1) {
    state.level.alienWarning1Shown = true;
    // Per direct request, ALIEN_WARNING_MESSAGE_1 ("Something's stirring...")
    // only ever posts once, ever — the per-wave alienWarning1Shown flag above
    // still gates this 60s-mark from re-checking every tick within the same
    // wave cycle (and still resets each new wave below), but the actual
    // notification text is separately gated on a one-time tutorialFlags
    // entry so every wave after the first stays silent at this mark.
    if (!state.level.tutorialFlags.firstAlienWarning1Shown) {
      state.level.tutorialFlags.firstAlienWarning1Shown = true;
      pushNotification(state, ALIEN_WARNING_MESSAGE_1);
    }
  }
  if (!state.level.alienWarning2Shown && elapsed >= nextWaveAt - ALIEN_WARNING_MS_2) {
    state.level.alienWarning2Shown = true;
    pushNotification(state, ALIEN_WARNING_MESSAGE_2);
  }

  if (elapsed >= nextWaveAt) {
    spawnAlienWave(state);
    state.level.alienNextWaveAtMs = elapsed + randomWaveIntervalMs();
    state.level.alienWarning1Shown = false;
    state.level.alienWarning2Shown = false;
  }
}

// Called once per tick from main.js's update().
export function updateStoryTriggers(state) {
  updateBankruptcy(state);
  updateEscapeDare(state);
  updateAlienWaves(state);
}
