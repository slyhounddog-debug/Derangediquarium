// ProductionInfo.js — what's being produced/consumed inside a world-space box,
// for the Ctrl-drag production-info modal (main.js owns the selection and its
// box, UI.js owns the modal DOM). Per direct request, a pure read-only
// summary: how many of each object per minute the fish and buildings in the
// box are producing (only ones actually producing) and consuming, their
// electricity draw/production, and the loose items and chest contents inside.
// Forbidden: no rendering, no state mutation, no input handling.
//
// Fish use their live per-fish stats (Entities.js's computeFishInfoModalStats,
// the same numbers the fish info modal shows). Buildings count only if they
// were active within PRODUCTION_INFO_ACTIVE_GRACE_MS (Grid.js's
// getBuildingRecentlyActive), and every building rate and its electricity is
// scaled by that building's rolling 3-minute uptime fraction (a building with
// no uptime samples yet counts as 100%) — the modal says so. Turrets only
// contribute electricity. Meant to be called a few times a second, not every
// frame: it walks the entity list, the building map and the item list once each.

import {
  SPECIES,
  TILE_SIZE,
  TILE_MANUFACTURER,
  TILE_POWER_PLANT,
  BUILDING_FAMILIES,
  REFINERY_STATS,
  ALIEN_DNA_REFINERY_TIME_MULTIPLIER,
  PROCESSOR_STATS,
  MANUFACTURER_RECIPES,
  MANUFACTURER_ITEM_PROCESS_MS,
  MANUFACTURER_ITEM_POWER_COST_MW,
  POWER_PLANT_RECIPES,
  TURRET_STATS,
  ELECTRIC_SUCKER_FOOD_INTERVAL_MS,
  SCIENCE_ALIEN_DNA_INTERVAL_MS,
  FRIENDLY_ALIEN_WASTE_INTERVAL_MS,
  PRODUCTION_INFO_ACTIVE_GRACE_MS,
} from './Config.js';
import { FAN_STATS, getBuildingRecentlyActive, getBuildingUptimeFraction } from './Grid.js';
import { computeFishInfoModalStats } from './Entities.js';

function add(map, key, amount) {
  if (amount > 0) map[key] = (map[key] || 0) + amount;
}

// rect: { x0, y0, x1, y1 } in world px (already min/max-ordered).
export function computeProductionInfo(state, rect) {
  const produced = {}; // object type -> per minute
  const consumed = {};
  let goldPerMin = 0; // dollar value of the coins in produced.coin
  let powerDraw = 0; // MW
  let powerProduced = 0;
  let fishCount = 0;
  let buildingCount = 0;
  const items = {}; // loose items inside the box, by type
  const chests = []; // { itemType, count, coinTotal }

  const inside = (x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;

  // ---- Fish (and the Alien-Egg friendly alien, a Waste source) ----
  for (const e of state.level.entities) {
    if (e.type === 'friendly_alien') {
      if (!inside(e.x, e.y)) continue;
      add(produced, 'waste', 60000 / FRIENDLY_ALIEN_WASTE_INTERVAL_MS);
      continue;
    }
    if (e.type !== 'fish' || e.dying || !inside(e.x, e.y)) continue; // a dying fish is already dead; starving and baby fish still count
    fishCount += 1;
    const def = SPECIES[e.speciesId];
    const stage = def.growthStages[e.stage];
    const stats = computeFishInfoModalStats(state, e);
    const blocked = e.alienNearby;
    if (stats.goldPerMin) {
      goldPerMin += stats.goldPerMin;
      add(produced, 'coin', 60000 / stage.dropInterval);
    }
    if (e.speciesId === 'xeno_octopus' && e.alienDnaModeOn) {
      add(produced, 'alien_dna', (60000 / SCIENCE_ALIEN_DNA_INTERVAL_MS) * (blocked ? 0.5 : 1)); // an alien nearby halves the timer's speed rather than stopping it
    } else if (stats.sciencePerMin) {
      add(produced, 'science', stats.sciencePerMin);
    }
    if (e.speciesId === 'zap_sucker' && e.autoFoodOn) add(produced, 'food', (60000 / ELECTRIC_SUCKER_FOOD_INTERVAL_MS) * (blocked ? 0.5 : 1));
    if (stats.wastePerMin) add(produced, 'waste', stats.wastePerMin);
    if (stats.foodPerMin) add(consumed, 'food', stats.foodPerMin);
    if (stats.wasteEatenPerMin) add(consumed, 'waste', stats.wasteEatenPerMin);
    if (e.lastGeneratedMw > 0) powerProduced += e.lastGeneratedMw; // measured over the last full second, same figure the fish info modal shows
  }

  // ---- Buildings ----
  const chestTypes = BUILDING_FAMILIES.chest;
  for (const key in state.level.buildingData) {
    const data = state.level.buildingData[key];
    const [row, col] = key.split(',').map(Number);
    const cx = col * TILE_SIZE + TILE_SIZE / 2;
    const cy = row * TILE_SIZE + TILE_SIZE / 2;
    if (!inside(cx, cy)) continue;
    const type = data.type;

    if (chestTypes.includes(type)) {
      if (data.lockedItemType != null && data.count > 0) {
        chests.push({ itemType: data.lockedItemType, count: data.count, coinTotal: data.lockedItemType === 'coin' ? data.coinQueue.reduce((a, v) => a + v, 0) : 0 });
      }
      continue;
    }

    if (!getBuildingRecentlyActive(state, data, PRODUCTION_INFO_ACTIVE_GRACE_MS)) continue;
    buildingCount += 1;
    const uptime = getBuildingUptimeFraction(data) ?? 1;

    if (FAN_STATS[type]) {
      powerDraw += FAN_STATS[type].powerCost * uptime;
    } else if (PROCESSOR_STATS[type]) {
      const itemType = data.lastActiveItemType;
      const stats = PROCESSOR_STATS[type];
      const ms = itemType === 'science' ? stats.scienceMs : itemType === 'science_green' ? stats.scienceGreenMs : stats.coinMs;
      if (itemType) add(consumed, itemType, (60000 / ms) * uptime);
      const isScience = itemType === 'science' || itemType === 'science_green';
      powerDraw += (isScience ? stats.powerCostPerSecScience : stats.powerCostPerSecCoin) * uptime;
    } else if (REFINERY_STATS[type]) {
      const stats = REFINERY_STATS[type];
      const recipe = data.lockedRecipe ?? data.lastActiveRecipe;
      if (recipe === 'dna_to_biomass') {
        const rate = (60000 / (stats.foodProcessMs * ALIEN_DNA_REFINERY_TIME_MULTIPLIER)) * uptime;
        add(consumed, 'alien_dna', rate);
        add(produced, 'biomass', rate);
      } else if (recipe === 'waste_to_food') {
        const rate = (60000 / stats.foodProcessMs) * uptime;
        add(consumed, 'waste', rate);
        add(produced, 'food', rate);
      }
      powerDraw += stats.powerCostPerSec * uptime;
    } else if (type === TILE_MANUFACTURER) {
      const recipe = MANUFACTURER_RECIPES[data.recipeId];
      if (recipe) {
        const cycleMs = recipe.inputs.reduce((sum, input) => sum + MANUFACTURER_ITEM_PROCESS_MS[input], 0);
        const rate = (60000 / cycleMs) * uptime;
        for (const input of recipe.inputs) add(consumed, input, rate);
        add(produced, recipe.output, rate);
        // Time-weighted average of its two ingredients' draws across a whole cycle.
        const avgMw = recipe.inputs.reduce((sum, input) => sum + MANUFACTURER_ITEM_POWER_COST_MW[input] * MANUFACTURER_ITEM_PROCESS_MS[input], 0) / cycleMs;
        powerDraw += avgMw * (recipe.powerCostMultiplier || 1) * uptime;
      }
    } else if (type === TILE_POWER_PLANT) {
      const recipe = POWER_PLANT_RECIPES[data.recipeId];
      if (recipe) {
        add(consumed, recipe.inputs[0], (60000 / recipe.durationMs) * uptime);
        powerProduced += recipe.powerOutputMw * uptime;
      }
    } else if (TURRET_STATS[type]) {
      powerDraw += TURRET_STATS[type].powerCostPerSec * uptime; // turrets only count for their electricity
    }
  }

  // ---- Loose items ----
  for (const item of state.level.items) {
    if (inside(item.x, item.y)) items[item.type] = (items[item.type] || 0) + 1;
  }

  return { produced, consumed, goldPerMin, powerDraw, powerProduced, fishCount, buildingCount, items, chests };
}
