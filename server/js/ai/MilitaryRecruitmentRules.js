const FOOD_SUPPORT_PER_UNIT = 10;
const BASIC_TRAINING_FOOD_COST = 20;
const ELITE_TRAINING_IRON_COST = 10;
const MOUNTED_TRAINING_FOOD_COST = 40;
const MOUNTED_TRAINING_IRON_COST = 20;

function getTotalFood(stores = {}) {
  return (stores.grain || 0) + (stores.fish || 0);
}

function calculateFoodSupport(stores = {}, militaryCount = 0, unitCount = 1) {
  const totalFood = getTotalFood(stores);
  const requiredReserve = militaryCount * FOOD_SUPPORT_PER_UNIT;
  const requiredSurplus = unitCount * FOOD_SUPPORT_PER_UNIT;
  const surplusFood = totalFood - requiredReserve;

  return {
    grain: stores.grain || 0,
    fish: stores.fish || 0,
    totalFood,
    requiredReserve,
    requiredSurplus,
    surplusFood,
    canSupport: surplusFood >= requiredSurplus
  };
}

function countMilitaryUnits(houseId, playerList = {}) {
  let militaryCount = 0;

  for (const id in playerList) {
    const unit = playerList[id];
    if (unit && unit.military && unit.house === houseId) {
      militaryCount += 1;
    }
  }

  return militaryCount;
}

function isMountedUnitClass(unitClass) {
  if (!unitClass || typeof unitClass !== 'string') return false;
  const nameLower = unitClass.toLowerCase();
  return nameLower.includes('cavalier') ||
    nameLower.includes('cavalry') ||
    nameLower.includes('horseman') ||
    nameLower.includes('knight') ||
    nameLower.includes('mounted');
}

function chooseUnitClass(house, {
  progressionTable,
  basicUnitTable,
  random = Math.random
} = {}) {
  const factionName = house && house.name;
  let progression = progressionTable && progressionTable[factionName];
  let usedPlayerFallback = false;

  if (!progression && progressionTable && progressionTable.Player) {
    progression = progressionTable.Player;
    usedPlayerFallback = true;
  }

  if (progression) {
    if (house && house.hasStronghold && progression.elite) {
      return {
        unitClass: progression.elite,
        progression,
        usedPlayerFallback,
        tier: 'elite',
        source: 'progression'
      };
    }

    const basicUnits = progression.basic || [];
    if (basicUnits.length === 0) {
      return {
        unitClass: null,
        progression,
        usedPlayerFallback,
        tier: 'basic',
        source: 'progression',
        failureReason: 'no_basic_units'
      };
    }

    return {
      unitClass: basicUnits[Math.floor(random() * basicUnits.length)],
      progression,
      usedPlayerFallback,
      tier: 'basic',
      source: 'progression'
    };
  }

  let factionUnits = basicUnitTable && basicUnitTable[factionName];
  if ((!factionUnits || factionUnits.length === 0) && progressionTable && progressionTable.Player && progressionTable.Player.basic) {
    factionUnits = progressionTable.Player.basic;
    usedPlayerFallback = true;
  }

  if (!factionUnits || factionUnits.length === 0) {
    return {
      unitClass: null,
      progression: null,
      usedPlayerFallback,
      tier: 'basic',
      source: 'basic',
      failureReason: 'no_faction_units'
    };
  }

  return {
    unitClass: factionUnits[Math.floor(random() * factionUnits.length)],
    progression: null,
    usedPlayerFallback,
    tier: 'basic',
    source: 'basic'
  };
}

function getTrainingCost(unitClass, tier = 'basic', unitCount = 1) {
  const isMounted = isMountedUnitClass(unitClass);
  let requiredFood = BASIC_TRAINING_FOOD_COST;
  let requiredIron = 0;

  if (isMounted) {
    requiredFood = MOUNTED_TRAINING_FOOD_COST;
    requiredIron = MOUNTED_TRAINING_IRON_COST;
  } else if (tier === 'elite') {
    requiredFood = BASIC_TRAINING_FOOD_COST;
    requiredIron = ELITE_TRAINING_IRON_COST;
  }

  return {
    requiredFood: requiredFood * unitCount,
    requiredIron: requiredIron * unitCount,
    isMounted,
    isElite: tier === 'elite'
  };
}

function deductFood(stores, requiredFood) {
  const fish = stores.fish || 0;

  if (fish >= requiredFood) {
    stores.fish -= requiredFood;
    return;
  }

  stores.fish = 0;
  stores.grain = (stores.grain || 0) - (requiredFood - fish);
}

module.exports = {
  FOOD_SUPPORT_PER_UNIT,
  BASIC_TRAINING_FOOD_COST,
  calculateFoodSupport,
  chooseUnitClass,
  countMilitaryUnits,
  deductFood,
  getTotalFood,
  getTrainingCost,
  isMountedUnitClass
};
