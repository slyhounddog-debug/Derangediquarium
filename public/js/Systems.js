// Systems.js — cross-cutting simulation systems: cleanliness/toxicity, Eel
// power balance, science accumulation, wave timers.
//
// Cleanliness/toxicity/power/science/wave-timers are still Phase 3-5
// scope, not yet implemented (state.level.cleanliness is a static
// placeholder set by Levels.js). This module's first real code is the
// story-trigger system below — genuinely cross-cutting (reads shop
// affordability across species/buildings, fish count, and elapsed time),
// which is exactly the kind of check this module was reserved for. See
// CLAUDE.md's "Story & Tutorial Notifications" section.
// Forbidden: no rendering, no input handling.

import {
  FOOD_COST,
  BANKRUPTCY_BAILOUT_AMOUNT,
  ESCAPE_DARE_DELAY_MS,
  NOTIFICATION_LOG_MAX,
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

// Called once per tick from main.js's update().
export function updateStoryTriggers(state) {
  updateBankruptcy(state);
  updateEscapeDare(state);
}
