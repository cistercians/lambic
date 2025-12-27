// Resource Balance Analyzer
// Analyzes resource balance and provides utility methods for resource calculations

const { PRODUCTION_RATES, RESOURCE_THRESHOLDS, RESOURCE_RATIOS, TIME_THRESHOLDS } = require('../AIConstants');
const GoalChain = require('../GoalChain');

class ResourceBalanceAnalyzer {
  constructor(buildingService) {
    this.buildingService = buildingService;
  }
  
  // Check resource balance and identify imbalances
  checkResourceBalance(stores) {
    const wood = stores.wood || 0;
    const stone = stores.stone || 0;
    const grain = stores.grain || 0;
    
    // Calculate ratios
    const woodStoneRatio = stone > 0 ? wood / stone : (wood > 0 ? Infinity : 1);
    const grainStoneRatio = stone > 0 ? grain / stone : (grain > 0 ? Infinity : 1);
    
    // Identify imbalances
    const imbalances = {
      stoneScarce: stone < RESOURCE_THRESHOLDS.STONE_SCARCE,
      woodExcessive: woodStoneRatio > RESOURCE_RATIOS.WOOD_STONE_EXCESSIVE,
      grainExcessive: grainStoneRatio > RESOURCE_RATIOS.GRAIN_STONE_EXCESSIVE,
      needsStone: stone < RESOURCE_THRESHOLDS.STONE_NEEDED,
      needsWood: wood < RESOURCE_THRESHOLDS.WOOD_NEEDED,
      needsGrain: grain < RESOURCE_THRESHOLDS.GRAIN_NEEDED
    };
    
    return {
      resources: { wood, stone, grain },
      imbalances
    };
  }
  
  // Get resource production rate (simplified - assumes fixed rates per building)
  getResourceProductionRate(resourceType) {
    // Production rates per building per day (from constants)
    // Map resource types to constant keys (case-insensitive)
    const rateMap = {
      stone: PRODUCTION_RATES.STONE,
      wood: PRODUCTION_RATES.WOOD,
      grain: PRODUCTION_RATES.GRAIN,
      ironore: PRODUCTION_RATES.IRONORE,
      silverore: PRODUCTION_RATES.SILVERORE,
      goldore: PRODUCTION_RATES.GOLDORE,
      iron: PRODUCTION_RATES.IRON,
      silver: PRODUCTION_RATES.SILVER,
      gold: PRODUCTION_RATES.GOLD
    };
    return rateMap[resourceType] || 0;
  }
  
  // Estimate time needed to gather a resource amount
  estimateGatheringTime(resourceType, targetAmount, currentAmount) {
    const deficit = targetAmount - currentAmount;
    
    if (deficit <= 0) {
      return 0; // Already have enough
    }
    
    // Get production rate per building
    const ratePerBuilding = this.getResourceProductionRate(resourceType);
    if (ratePerBuilding === 0) {
      return Infinity; // Can't produce this resource
    }
    
    // Get number of gathering buildings (accounting for mine types)
    let buildingCount = 0;
    if (resourceType === 'stone') {
      buildingCount = this.buildingService.getStoneMineCount();
    } else if (resourceType === 'ironore' || resourceType === 'silverore' || resourceType === 'goldore') {
      buildingCount = this.buildingService.getCaveMineCount();
    } else {
      const buildingType = GoalChain.getResourceBuildingType(resourceType);
      if (!buildingType) {
        return Infinity; // No building type defined
      }
      buildingCount = this.buildingService.getBuildingCount(buildingType);
    }
    
    if (buildingCount === 0) {
      return Infinity; // No buildings to produce
    }
    
    // Calculate total production per day
    const totalProductionPerDay = ratePerBuilding * buildingCount;
    
    // Estimate days needed (round up)
    const daysNeeded = Math.ceil(deficit / totalProductionPerDay);
    
    return daysNeeded;
  }
  
  // Check if resources can be gathered within reasonable time
  canGatherWithinReasonableTime(resourceType, targetAmount, currentAmount, maxDays = TIME_THRESHOLDS.MAX_GATHERING_DAYS) {
    const daysNeeded = this.estimateGatheringTime(resourceType, targetAmount, currentAmount);
    return daysNeeded <= maxDays;
  }
}

module.exports = ResourceBalanceAnalyzer;

