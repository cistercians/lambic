// Resource Planning System
// Plans resource acquisition to meet goal requirements

const { GatherResourceGoal, createBuildingGoal } = require('./Goals');

class ResourcePlanner {
  // Given a goal, determine if we can afford it and what we need
  planForGoal(house, goal) {
    if (goal.canExecute(house)) {
      return { ready: true, subgoals: [] };
    }
    
    const subgoals = [];
    
    // For each blocking factor, create a subgoal
    for (const block of goal.blockedBy) {
      if (block.type === 'RESOURCE') {
        const deficit = block.need - block.have;
        subgoals.push(new GatherResourceGoal(block.resource, deficit));
      } else if (block.type === 'BUILDING') {
        // Create goal to build the required building
        subgoals.push(createBuildingGoal(block.value));
      }
    }
    
    return { ready: false, subgoals };
  }
  
  // Estimate how long it will take to gather needed resources
  estimateGatherTime(house, resources) {
    const rates = this.calculateProductionRates(house);
    let maxDays = 0;
    
    for (const [resource, amount] of Object.entries(resources)) {
      const rate = rates[resource] || 0;
      if (rate > 0) {
        const time = amount / rate;
        maxDays = Math.max(maxDays, time);
      } else {
        // Can't produce this resource
        return Infinity;
      }
    }
    
    return Math.ceil(maxDays); // Round up to whole days
  }
  
  // Calculate daily production rates for each resource
  calculateProductionRates(house) {
    const serfs = this.getSerfsByHouse(house);
    
    // Base rates per building type (estimated) - use BuildingService if available
    const rates = {
      wood: this.getBuildingCount(house, 'lumbermill') * 5,
      stone: this.getBuildingCount(house, 'mine') * 4,
      grain: this.getBuildingCount(house, 'farm') * 3,
      ironore: this.getBuildingCount(house, 'mine') * 2
    };
    
    // Bonus from serfs (each serf adds a small amount)
    const serfBonus = serfs.length * 0.5;
    rates.wood += serfBonus;
    rates.stone += serfBonus;
    rates.grain += serfBonus;
    
    return rates;
  }
  
  // Check if house can afford a goal's resource cost
  canAfford(house, resourceCost) {
    for (const [resource, amount] of Object.entries(resourceCost)) {
      const available = house.stores[resource] || 0;
      if (available < amount) {
        return false;
      }
    }
    return true;
  }
  
  // Calculate deficit for a resource requirement
  calculateDeficit(current, required) {
    const deficit = {};
    for (const [resource, amount] of Object.entries(required)) {
      const shortfall = amount - (current[resource] || 0);
      if (shortfall > 0) {
        deficit[resource] = shortfall;
      }
    }
    return deficit;
  }
  
  // Helper: get buildings owned by house (uses BuildingService - fails fast if unavailable)
  getBuildingsByHouse(house) {
    if (!house.ai || !house.ai.buildingService) {
      throw new Error(`BuildingService not available for ${house.name || 'unknown'} - check FactionAI initialization`);
    }
    return house.ai.buildingService.getBuildings();
  }
  
  // Helper: get serfs owned by house
  getSerfsByHouse(house) {
    const serfs = [];
    
    if (typeof Player !== 'undefined' && Player.list) {
      for (const id in Player.list) {
        const player = Player.list[id];
        if (player.house === house.id && (player.class === 'SerfM' || player.class === 'SerfF')) {
          serfs.push(player);
        }
      }
    }
    
    return serfs;
  }
  
  // Helper: count building types (uses BuildingService if available, otherwise counts from array)
  countBuildingType(buildings, type) {
    // If buildings is from BuildingService, it's already filtered
    // Otherwise, filter the provided array
    return buildings.filter(b => b.type === type).length;
  }
  
  // Helper: get building count using BuildingService (fails fast if unavailable)
  getBuildingCount(house, type) {
    if (!house.ai || !house.ai.buildingService) {
      throw new Error(`BuildingService not available for ${house.name || 'unknown'} - check FactionAI initialization`);
    }
    return house.ai.buildingService.getBuildingCount(type);
  }
}

module.exports = ResourcePlanner;

