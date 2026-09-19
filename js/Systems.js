// Systems.js — cross-cutting simulation systems: the bankruptcy/game-over
// story trigger, and Alien Invasion wave timing/scheduling
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
  TURRET_TUTORIAL_DELAY_MS,
  ALIEN_INTRO_DELAY_MS,
  WASTE_DRAG_TUTORIAL_WAIT_MS,
  ALIEN_WAVE_INTERVAL_EARLY_MS,
  ALIEN_WAVE_INTERVAL_LATE_MS,
  ALIEN_WAVE_DIFFICULTY_RAMP_WAVES,
  ALIEN_WAVE_COUNT_EARLY_MIN,
  ALIEN_WAVE_COUNT_EARLY_MAX,
  ALIEN_WAVE_COUNT_LATE_MIN,
  ALIEN_WAVE_COUNT_LATE_MAX,
  ALIEN_ARCHETYPES,
  ALIEN_TIER_MIX_KEYFRAMES,
  ALIEN_WARNING_MS_1,
  ALIEN_WARNING_MS_2,
  ALIEN_WARNING_MAX_WAVES,
  ALIEN_WARNING_MESSAGE_2_REPEAT,
  ALIEN_WARNING_MESSAGE_1,
  ALIEN_WARNING_MESSAGE_2,
  ALIEN_FIRST_WAVE_TIP_MESSAGE,
  ALIEN_FOOD_DISTRACTION_TIP_MESSAGE,
  ALIEN_PORTAL_STAGGER_MS,
  ALIEN_MAX_ALIVE,
  FISH_MIN_X,
  FISH_MAX_X,
  FISH_MIN_Y,
  ALIEN_SPAWN_MIN_Y,
  SEABED_FLOOR_Y,
  ALIEN_FIRST_WAVE_SAFE_X_FRACTION,
  TILE_MANUFACTURER,
  TILE_POWER_PLANT,
  AUTOSAVE_INTERVAL_MS,
  POWER_WARNING_CHECK_INTERVAL_MS,
  POWER_WARNING_CHANCE,
  POWER_WARNING_NONE_MESSAGE,
  POWER_WARNING_PARTIAL_MESSAGE,
  ACHIEVEMENT_LIST,
  ACHIEVEMENT_CLEANLINESS_ARM_THRESHOLD,
  ACHIEVEMENT_CLEANLINESS_COMPLETE_THRESHOLD,
  IDLE_PURCHASE_HINT_DELAY_MS,
  IDLE_PURCHASE_HINT_MESSAGE,
} from './Config.js';
import { getAvailableSpecies, getAvailableBuildings } from './Levels.js';
import { getFishPurchaseCost, findCombinablePair, spawnTurretTutorialWaste } from './Entities.js';
import { hasWasteTurretPlaced, countPlacedOfType } from './Grid.js';
import { saveGame } from './Save.js';
import { pushGameNotification } from './Notifications.js';

const BANKRUPTCY_BAILOUT_MESSAGE =
  "Oopah, looks like someone got their CDL so they could drive the struggle bus! Here's 100 gold to get you back on your feet. I'll be expecting that back (I'm lying).";
const GAME_OVER_MESSAGE =
  'My mama always said "Shooting a fish out of water in a barrel with bigger fish to fry" and I always took that to heart. Better luck next time! (Restart in the menu)';

// A thin wrapper around Notifications.js's own pushGameNotification — the
// one real, shared implementation of the push+cap+dedupe+timestamp logic
// (see that file's own comment; this is the module a periodic re-check,
// like the power-shortage nudge, would otherwise spam through every check
// interval while the same condition just sits there unresolved) — kept as a
// same-named local helper per CLAUDE.md's Rolling Notification Log
// convention.
function pushNotification(state, text) {
  pushGameNotification(state, text);
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

// Starts the cinematic first-alien intro's 'alienintro' guided-tutorial flow
// (UI.js's TUTORIAL_FLOWS) once the alien Entities.js's updateAlienPortals
// flagged (state.level.firstAlienIntroTargetId) has actually been alive and
// moving normally on screen for ALIEN_INTRO_DELAY_MS — per direct request,
// no longer the instant it spawns. One-shot via clearing
// firstAlienIntroAppearedAtMs back to null the moment this resolves, whether
// that's a real trigger or the defensive "it already died in that window"
// case below (which just lets the game continue normally with no intro at
// all, rather than soft-locking waiting for a target that no longer exists).
function updateAlienIntroTrigger(state) {
  if (state.level.firstAlienIntroAppearedAtMs === null || state.level.tutorialFlow) return;
  if (state.level.elapsed - state.level.firstAlienIntroAppearedAtMs < ALIEN_INTRO_DELAY_MS) return;
  state.level.firstAlienIntroAppearedAtMs = null;
  const alien = state.level.entities.find((e) => e.id === state.level.firstAlienIntroTargetId && e.type === 'alien' && e.hp > 0);
  if (!alien) return;
  state.level.tutorialFlow = { id: 'alienintro', step: 'click' };
}

// Starts the "switch to Merge and drag two matching fish together" guided
// tutorial (UI.js's TUTORIAL_FLOWS' 'mergefish') the first time two Adult,
// same-species-and-star-tier fish genuinely exist on screen at once — per
// direct request. One-shot via tutorialFlags.mergeTutorialShown, deferred
// (not consumed) while any OTHER tutorial flow is already active, same
// "just check again next tick" pattern every other trigger here uses.
function updateMergeTutorialTrigger(state) {
  if (state.level.tutorialFlags.mergeTutorialShown || state.level.tutorialFlow) return;
  if (!findCombinablePair(state)) return;
  state.level.tutorialFlags.mergeTutorialShown = true;
  state.level.tutorialFlow = { id: 'mergefish', step: 'switch' };
}

// Starts the post-alien "arm up" guided tutorial (Shop -> Waste Turret ->
// scroll -> place — see UI.js's TUTORIAL_FLOWS) TURRET_TUTORIAL_DELAY_MS
// after the REPLACEMENT alien Entities.js spawns the instant the first
// alien ever dies (state.level.turretTutorialAlienAppearedAtMs) — per
// direct request ("right after they kill the first alien, another one
// instantly spawns, and 1 second later it triggers the turret tutorial...
// so you instantly see the benefits of the turret"), replacing the old flat
// 10-second-after-the-kill delay entirely. One-shot: consumes
// turretTutorialAlienAppearedAtMs back to null the moment this resolves
// (mirrors updateAlienIntroTrigger's own one-shot shape above), and deferred
// while any OTHER tutorial flow is already active rather than stomping it.
function updateTurretTutorialTrigger(state) {
  if (state.level.turretTutorialAlienAppearedAtMs === null || state.level.tutorialFlow) return;
  if (state.level.elapsed - state.level.turretTutorialAlienAppearedAtMs < TURRET_TUTORIAL_DELAY_MS) return;
  state.level.turretTutorialAlienAppearedAtMs = null;
  const flags = state.level.tutorialFlags;
  // One-shot decision point: offer the full Shop -> Turret -> scroll ->
  // place walkthrough if there's no Turret yet (per direct request — "make
  // sure the turret tutorial only triggers if there's not a turret"); if
  // one already exists (or this has already fired once), updatePostAlienTutorial's
  // own standalone waste-drag fallback below picks up the slack instead.
  if (flags.postAlienTutorialShown) return;
  flags.postAlienTutorialShown = true;
  if (!hasWasteTurretPlaced(state)) {
    state.level.tutorialFlow = { id: 'postalien', step: 'shop' };
  }
}

// The "drag Waste into the Turret" lesson specifically — runs whenever a
// Waste Turret and some Waste both exist in the city, regardless of how the
// full walkthrough above was handled (completed, skipped, or never offered
// because a Turret already existed by the time updateTurretTutorialTrigger
// fired). Waits until there's actually some Waste sitting in the city to
// drag (nothing to demonstrate on otherwise), then
// WASTE_DRAG_TUTORIAL_WAIT_MS (1s) more once it appears. Only runs once the
// one-time decision above has actually been made (flags.postAlienTutorialShown) —
// wasteDragTutorialShown is tracked separately (set only once the drag
// lesson itself genuinely completes — see UI.js's onTutorialFlowComplete),
// so Escape-skipping the full walkthrough before it ever reaches its own
// final 'dragwaste' step doesn't permanently block this standalone fallback
// from firing later — per direct request ("make sure this part of the
// waste dragging into a turret tutorial is also triggered even if the whole
// turret tutorial is skipped").
function updatePostAlienTutorial(state) {
  const flags = state.level.tutorialFlags;
  if (state.level.tutorialFlow) return;
  if (!flags.postAlienTutorialShown) return;
  if (flags.wasteDragTutorialShown) return;
  if (!hasWasteTurretPlaced(state)) return;
  // Per direct request, this no longer waits for a real fish to have
  // already pooped some Waste out nearby — it spawns its own deterministic
  // one (Entities.js's spawnTurretTutorialWaste) the instant this decision
  // fires, exactly once (guarded by wasteDragTutorialWaitStartMs still being
  // null), then waits WASTE_DRAG_TUTORIAL_WAIT_MS more before actually
  // starting the flow — same overall pacing as before, just no longer
  // dependent on chance.
  if (state.level.wasteDragTutorialWaitStartMs === null) {
    state.level.wasteDragTutorialWaitStartMs = state.level.elapsed;
    spawnTurretTutorialWaste(state);
    return;
  }
  if (state.level.elapsed - state.level.wasteDragTutorialWaitStartMs < WASTE_DRAG_TUTORIAL_WAIT_MS) return;
  state.level.tutorialFlow = { id: 'wastedrag', step: 'drag' };
}

// Per direct request, deterministically ramped — not randomized — from
// ALIEN_WAVE_INTERVAL_EARLY_MS at the very start of a level up to
// ALIEN_WAVE_INTERVAL_LATE_MS once the difficulty ramp is fully maxed out,
// via the exact same alienDifficultyT progress axis every other wave-scaling
// number (size, tier mix) already rides. wavesSpawned is how many waves have
// already completed BEFORE the gap being computed — so the very first gap
// (0 spawned) sits at t=0, purely "early."
function waveIntervalMsAt(wavesSpawned) {
  const t = alienDifficultyT(wavesSpawned);
  return ALIEN_WAVE_INTERVAL_EARLY_MS + (ALIEN_WAVE_INTERVAL_LATE_MS - ALIEN_WAVE_INTERVAL_EARLY_MS) * t;
}

// Linear interpolation from the "early" range up to the "late" range across
// ALIEN_WAVE_DIFFICULTY_RAMP_WAVES waves, then plateaus — wavesSpawned is
// state.level.alienWavesSpawned BEFORE this wave counts, so wave 1 starts at
// t=0 (purely early) and wave 11+ sits at t=1 (purely late). Drives BOTH the
// wave-size ramp below and the alien-tier weighted mix (see
// alienTierWeightsAt) — reusing this single progress axis for both rather
// than adding a second, separately-tuned "how many waves until end game
// tier mix" knob.
function alienDifficultyT(wavesSpawned) {
  return Math.min(1, wavesSpawned / ALIEN_WAVE_DIFFICULTY_RAMP_WAVES);
}

// Dynamic Alien Archetypes (Architectural Update) — linearly interpolates
// between the two ALIEN_TIER_MIX_KEYFRAMES bracketing t, returning a
// 5-element weight array (index 0 = Tier 1 ... index 4 = Tier 5) that always
// sums to 1 (both keyframes it interpolates between always do, and a linear
// blend of two vectors that each sum to 1 always sums to 1 itself).
function alienTierWeightsAt(t) {
  const kf = ALIEN_TIER_MIX_KEYFRAMES;
  if (t <= kf[0].t) return kf[0].weights;
  if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].weights;
  for (let i = 0; i < kf.length - 1; i++) {
    const a = kf[i];
    const b = kf[i + 1];
    if (t >= a.t && t <= b.t) {
      const localT = (t - a.t) / (b.t - a.t);
      return a.weights.map((w, idx) => w + (b.weights[idx] - w) * localT);
    }
  }
  return kf[kf.length - 1].weights;
}

// A single weighted random draw against the interpolated mix — one call per
// alien spawned (not once per whole wave), so a single wave can genuinely
// contain a mix of tiers rather than every alien in it sharing one roll.
function rollAlienArchetype(t) {
  const weights = alienTierWeightsAt(t);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return ALIEN_ARCHETYPES[i];
  }
  return ALIEN_ARCHETYPES[ALIEN_ARCHETYPES.length - 1];
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

  // ALIEN_MAX_ALIVE is a hard ceiling on simultaneously-alive aliens, not a
  // per-wave size limit — a neglected tank that already has a screenful of
  // aliens gets a smaller wave (or none at all, still counted as "spawned"
  // for the difficulty ramp) rather than piling on top without bound. Any
  // not-yet-opened portal from THIS wave's own stagger counts too, so a
  // wave can't sneak a burst past the cap between the count check and the
  // portals actually opening.
  const aliveCount = state.level.entities.reduce((n, e) => n + (e.type === 'alien' && e.hp > 0 ? 1 : 0), 0)
    + state.level.alienPortals.filter((p) => !p.spawned).length;
  // The very first wave, ever, is forced to exactly 1 alien — per direct
  // request ("for the first wave of the aliens, have literally just one
  // alien show up") — this is what main.js's cinematic first-alien intro
  // (paused, spotlighted, click-to-damage) is built around; every wave
  // after the first uses the normal ramped roll. It naturally comes out
  // Tier 1 anyway (t=0 -> 100% Tier 1 weight), so no special-casing of the
  // archetype roll itself is needed here, only the count.
  const isFirstWave = state.level.alienWavesSpawned === 0;
  const count = isFirstWave
    ? 1
    : Math.max(0, Math.min(rolledCount, ALIEN_MAX_ALIVE - aliveCount));

  for (let i = 0; i < count; i++) {
    const archetype = rollAlienArchetype(t);
    // The very first wave's one alien is kept out of the right portion of
    // the water column, per direct bug report — the HUD pill cluster sits
    // fixed top-right on screen, and a portal rolled under it would leave
    // the cinematic intro's spotlight hole aligned over a non-interactive
    // HUD element instead of the canvas, so a click there never lands.
    // Every later wave still rolls the full width, unaffected.
    const xRange = isFirstWave ? (FISH_MAX_X - FISH_MIN_X) * ALIEN_FIRST_WAVE_SAFE_X_FRACTION : (FISH_MAX_X - FISH_MIN_X);
    state.level.alienPortals.push({
      x: FISH_MIN_X + Math.random() * xRange,
      // Biased toward the upper-mid water column (not down near the seabed
      // line) so a fresh portal reads as "emerging from open water," not
      // spawning right on top of the player's factory. ALIEN_SPAWN_MIN_Y
      // (not FISH_MIN_Y) per direct report — aliens need a more generous
      // top margin than fish do, so a portal can never roll high enough to
      // open behind the fixed HUD/chat pills.
      y: ALIEN_SPAWN_MIN_Y + Math.random() * (SEABED_FLOOR_Y * 0.7 - ALIEN_SPAWN_MIN_Y),
      hp: archetype.hpMin + Math.floor(Math.random() * (archetype.hpMax - archetype.hpMin + 1)),
      archetypeId: archetype.id,
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
// not a countdown-from value. Portal/alien creation itself lives in
// Entities.js (see spawnAlienWave's own comment) — this function only ever
// decides WHEN a wave should start and pushes the resulting portal data.
function updateAlienWaves(state) {
  // Normal wave spawning is suspended entirely once the Mother Alien Fish
  // sequence has started (any phase — 'intro_wait' through 'gameover') so a
  // routine wave can't spawn on top of/immediately after the boss fight and
  // muddy what's supposed to be a dedicated final encounter.
  if (state.level.bossPhase) return;
  const elapsed = state.level.elapsed;

  // Per direct request, the countdown to the NEXT wave doesn't even start
  // until every alien from the current one is actually dead — previously
  // alienNextWaveAtMs was rescheduled the instant a wave SPAWNED, so a
  // lingering survivor could get "reinforced" by a fresh wave before the
  // player finished it off. alienWaveActive covers both halves of "a wave
  // is still in progress": its portals haven't all finished opening into
  // real aliens yet (alienPortals still has entries), or an alien it did
  // spawn is still alive — either one means the clock stays paused.
  if (state.level.alienWaveActive) {
    const wavePortalsPending = state.level.alienPortals.length > 0;
    const aliensAlive = state.level.entities.some((e) => e.type === 'alien' && e.hp > 0);
    if (wavePortalsPending || aliensAlive) return;
    state.level.alienWaveActive = false;
    state.level.alienNextWaveAtMs = elapsed + waveIntervalMsAt(state.level.alienWavesSpawned); // the real countdown starts fresh right now, not back when the wave spawned
    state.meta.stats.wavesSurvived += 1; // waves_survived_5/20 achievements — this exact branch IS "a wave just finished clearing"
    // One-time tip, right as the very first wave finishes clearing (see
    // ALIEN_FOOD_DISTRACTION_TIP_MESSAGE's own comment for why this exact
    // moment) — alienWavesSpawned is already 1 at this point since
    // spawnAlienWave incremented it the instant the first wave's portals
    // were created, well before this branch could ever run.
    if (state.level.alienWavesSpawned === 1 && !state.level.tutorialFlags.alienFoodDistractionTipShown) {
      state.level.tutorialFlags.alienFoodDistractionTipShown = true;
      pushNotification(state, ALIEN_FOOD_DISTRACTION_TIP_MESSAGE);
    }
    return;
  }

  const nextWaveAt = state.level.alienNextWaveAtMs;

  if (!state.level.alienWarning1Shown && elapsed >= nextWaveAt - ALIEN_WARNING_MS_1) {
    state.level.alienWarning1Shown = true;
    // Per direct request, ALIEN_WARNING_MESSAGE_1 ("Something's stirring...")
    // only ever posts once, ever — the per-wave alienWarning1Shown flag above
    // still gates this 60s-mark from re-checking every tick within the same
    // wave cycle (and still resets each new wave below), but the actual
    // notification text is separately gated on a one-time tutorialFlags
    // entry so every wave after the first stays silent at this mark. This is
    // already tighter than ALIEN_WARNING_MAX_WAVES below (it never repeats
    // past wave 1 at all), so it needs no separate wave-count check.
    if (!state.level.tutorialFlags.firstAlienWarning1Shown) {
      state.level.tutorialFlags.firstAlienWarning1Shown = true;
      pushNotification(state, ALIEN_WARNING_MESSAGE_1);
    }
  }
  // Per direct request, this 30s warning goes completely silent once
  // ALIEN_WARNING_MAX_WAVES waves have already spawned ("remove the chat
  // messages for upcoming alien waves after wave 3") — and waves 2/3
  // specifically (alienWavesSpawned 1/2 at this point, since it's how many
  // waves have already happened BEFORE the upcoming one) get a slightly
  // reworded repeat instead of the exact wave-1 wording.
  if (!state.level.alienWarning2Shown && elapsed >= nextWaveAt - ALIEN_WARNING_MS_2 && state.level.alienWavesSpawned < ALIEN_WARNING_MAX_WAVES) {
    state.level.alienWarning2Shown = true;
    const message = state.level.alienWavesSpawned === 0 ? ALIEN_WARNING_MESSAGE_2 : ALIEN_WARNING_MESSAGE_2_REPEAT;
    pushNotification(state, message);
  }

  if (elapsed >= nextWaveAt) {
    spawnAlienWave(state);
    state.level.alienWaveActive = true; // the branch above now owns rescheduling alienNextWaveAtMs, once this wave is fully cleared
    state.level.alienWarning1Shown = false;
    state.level.alienWarning2Shown = false;
  }
}

const RECIPE_COPY_TIP_MESSAGE =
  "Psst — drag one of those onto another of the same kind and it'll copy its recipe over. Beats picking it twice.";

// One-time tip the moment the player has 2+ placed Manufacturers OR 2+
// placed Power Plants at once — per direct request ("add in a chat message
// that will trigger letting them know about this mechanic when they have
// two of either"). See main.js's updateRecipeDrag for the drag-to-copy
// mechanic itself.
function updateRecipeCopyTip(state) {
  if (state.level.tutorialFlags.recipeCopyTipShown) return;
  const grid = state.level.grid;
  if (countPlacedOfType(grid, TILE_MANUFACTURER) >= 2 || countPlacedOfType(grid, TILE_POWER_PLANT) >= 2) {
    state.level.tutorialFlags.recipeCopyTipShown = true;
    pushNotification(state, RECIPE_COPY_TIP_MESSAGE);
  }
}

// Called once per tick from main.js's update().
// Fires every AUTOSAVE_INTERVAL_MS of real elapsed sim time — since this is
// only ever reached while the sim genuinely isn't paused/game-over/boss-
// frozen (see main.js's update(), which gates every call to
// updateStoryTriggers on those), it self-throttles for free with no extra
// checks needed here. Reuses the exact same Save.js saveGame() the pause
// menu's manual Save button already calls. Per direct request, the
// confirmation is a top-center toast (state.ui.toastText) rather than a
// chat-log notification — a plain state.ui write, not rendering, so it
// doesn't cross this module's own "no rendering" rule; UI.js's updateHUD is
// what actually shows/hides it (see main.js's own state.ui.toastText
// comment) — worded distinctly ("auto-saved," not "saved") so the player
// can tell the two apart on the rare occasion they overlap.
function updateAutosave(state) {
  if (state.level.elapsed < state.level.nextAutosaveAtMs) return;
  state.level.nextAutosaveAtMs += AUTOSAVE_INTERVAL_MS;
  const ok = saveGame(state);
  state.ui.toastText = ok ? 'Game auto-saved. 💾' : 'Auto-save failed — your browser blocked it.';
}

// Occasional (not guaranteed) chat nudge while buildings are genuinely
// power-starved, per direct request — see Config.js's POWER_WARNING_* for
// the full mechanism. Checked on the same absolute-target-timestamp shape
// every other periodic trigger in this file uses, so it needs no dtMs.
function updatePowerWarnings(state) {
  if (state.level.elapsed < state.level.nextPowerWarningCheckAtMs) return;
  state.level.nextPowerWarningCheckAtMs += POWER_WARNING_CHECK_INTERVAL_MS;
  if (state.level.powerEfficiency >= 1) return; // no shortage right now
  if (Math.random() >= POWER_WARNING_CHANCE) return; // "occasionally, not every time"
  pushNotification(state, state.level.powerEfficiency <= 0 ? POWER_WARNING_NONE_MESSAGE : POWER_WARNING_PARTIAL_MESSAGE);
}

// Achievements — per direct spec, a permanent (state.meta) reward system.
// Three small pieces of "specific setup" tracking (Spring Cleaning's arm/
// complete flag, the live Science-on-screen peak) live here since they don't
// have an obviously better home elsewhere; power_deficit_60s/
// power_surplus_60s's own streaks are tracked in main.js instead, right
// alongside the once-a-second demand/supply numbers they need (see that
// file's own comment). The actual "did any achievement's condition just get
// met for the first time" check is fully generic — every entry in
// Config.js's ACHIEVEMENT_LIST resolves to one `stats[statField] >= threshold`
// comparison, regardless of whether that stat is a plain lifetime counter or
// one of the specific-setup flags/peaks this function itself maintains.
function updateAchievements(state) {
  // Spring Cleaning: arms the moment cleanliness first drops below
  // ACHIEVEMENT_CLEANLINESS_ARM_THRESHOLD, completes (and disarms) the
  // moment it's back at ACHIEVEMENT_CLEANLINESS_COMPLETE_THRESHOLD or higher
  // — both checked live off the real, already-tracked state.level.cleanliness,
  // no separate polling needed.
  if (state.level.cleanliness < ACHIEVEMENT_CLEANLINESS_ARM_THRESHOLD) {
    state.level.cleanlinessRecoveryArmed = true;
  } else if (state.level.cleanlinessRecoveryArmed && state.level.cleanliness >= ACHIEVEMENT_CLEANLINESS_COMPLETE_THRESHOLD) {
    state.level.cleanlinessRecoveryArmed = false;
    state.meta.stats.cleanlinessRecoveryDone = 1;
  }

  // Bubble Trouble/Bath/Apocalypse — the highest-ever simultaneous count of
  // Science + Green Science items sitting in the tank at once. A plain O(n)
  // scan over state.level.items is negligible at this game's normal item
  // counts, run once per tick same as every other per-tick tracker here.
  let scienceCount = 0;
  for (const item of state.level.items) {
    if (item.type === 'science' || item.type === 'science_green') scienceCount += 1;
  }
  if (scienceCount > state.meta.stats.sciencePeakOnScreen) state.meta.stats.sciencePeakOnScreen = scienceCount;

  // The generic evaluator — every achievement not already unlocked gets a
  // fresh check against its own stat field every tick; the moment one
  // crosses its threshold, it's permanently unlocked (ready to be claimed in
  // the Achievements panel — see UI.js). Cheap: ACHIEVEMENT_LIST is a fixed,
  // short (24-entry) array, and an already-unlocked achievement is skipped
  // immediately via the .includes check.
  for (const achievement of ACHIEVEMENT_LIST) {
    if (state.meta.achievementsUnlocked.includes(achievement.id)) continue;
    if ((state.meta.stats[achievement.statField] || 0) >= achievement.threshold) {
      state.meta.achievementsUnlocked.push(achievement.id);
    }
  }
}

// One-time nudge toward the Achievements tab, per direct request — fires
// once real elapsed time since the last fish bought OR building placed
// (state.level.lastPurchaseAtMs, updated by Entities.js's
// trySpawnPurchasedFish/Grid.js's placeTile) crosses IDLE_PURCHASE_HINT_DELAY_MS.
// Starts counting from level-start (lastPurchaseAtMs seeded at 0), so a
// player who does nothing at all for the first 60 seconds gets it too, not
// just one who goes quiet after already having bought something.
function updateIdlePurchaseHint(state) {
  if (state.level.tutorialFlags.idlePurchaseHintShown) return;
  if (state.level.elapsed - state.level.lastPurchaseAtMs < IDLE_PURCHASE_HINT_DELAY_MS) return;
  state.level.tutorialFlags.idlePurchaseHintShown = true;
  pushNotification(state, IDLE_PURCHASE_HINT_MESSAGE);
}

export function updateStoryTriggers(state) {
  updateBankruptcy(state);
  updateAlienWaves(state);
  updateAlienIntroTrigger(state);
  updateTurretTutorialTrigger(state);
  updatePostAlienTutorial(state);
  updateMergeTutorialTrigger(state);
  updateRecipeCopyTip(state);
  updateAutosave(state);
  updatePowerWarnings(state);
  updateAchievements(state);
  updateIdlePurchaseHint(state);
}
