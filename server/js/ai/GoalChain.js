// Goal Chain System
// Handles multi-step goal execution by resolving dependencies

const { GatherResourceGoal, createBuildingGoal } = require('./Goals');

class GoalChain {
  constructor(mainGoal) {
    this.mainGoal = mainGoal;
    this.steps = [];
    this.currentStep = 0;
  }
  
  // Convert a blocked goal into a chain of achievable subgoals
  static create(house, goal) {
    const chain = new GoalChain(goal);
    const visited = new Set();
    
    function resolveGoal(g, depth = 0) {
      // Prevent infinite recursion
      if (depth > 10) {
        console.warn(`GoalChain: Max recursion depth reached for ${g.type}`);
        return;
      }
      
      // Prevent cycles
      if (visited.has(g.type)) {
        return;
      }
      visited.add(g.type);
      
      // If goal can execute, add it directly
      if (g.canExecute(house)) {
        chain.steps.push(g);
        return;
      }
      
      // Recursively resolve blocking factors
      const blocking = g.getBlockingFactors(house);
      
      for (const block of blocking) {
        if (block.type === 'BUILDING') {
          // Need to build something first
          const buildGoal = createBuildingGoal(block.value);
          resolveGoal(buildGoal, depth + 1); // Recursive
        } else if (block.type === 'RESOURCE') {
          // Check if resource exists in faction territory first
          if (chain.canGatherResourceInTerritory(house, block.resource)) {
            // Resource available in territory - build gathering building
            const buildingType = chain.getResourceBuildingType(block.resource);
            const buildGoal = createBuildingGoal(buildingType);
            resolveGoal(buildGoal, depth + 1);
          } else {
            // Resource not in territory - check adjacent zones
            const outpostGoal = chain.findResourceInAdjacentZones(house, block.resource);
            if (outpostGoal) {
              resolveGoal(outpostGoal, depth + 1);
            } else {
              // Resource not found nearby - gather what we can
              const deficit = block.need - block.have;
              chain.steps.push(new GatherResourceGoal(block.resource, deficit));
            }
          }
        }
      }
      
      // Finally add the main goal
      chain.steps.push(g);
    }
    
    resolveGoal(goal);
    
    // Remove duplicates (keep last occurrence)
    chain.steps = chain.removeDuplicates(chain.steps);
    
    return chain;
  }
  
  // Remove duplicate goals, keeping the last occurrence
  removeDuplicates(steps) {
    const seen = new Map();
    const result = [];
    
    // Go through steps and track last index of each type
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const key = step.type;
      seen.set(key, i);
    }
    
    // Only keep steps at their last occurrence
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const key = step.type;
      if (seen.get(key) === i) {
        result.push(step);
      }
    }
    
    return result;
  }
  
  // Get current goal to execute
  getCurrentGoal() {
    if (this.currentStep < this.steps.length) {
      return this.steps[this.currentStep];
    }
    return null;
  }
  
  // Advance to next goal in chain
  advance() {
    this.currentStep++;
    return this.currentStep < this.steps.length;
  }
  
  // Check if chain is complete
  isComplete() {
    return this.currentStep >= this.steps.length;
  }
  
  // Get remaining steps
  getRemainingSteps() {
    return this.steps.slice(this.currentStep);
  }
  
  // Get progress (0-1)
  getProgress() {
    if (this.steps.length === 0) return 1;
    return this.currentStep / this.steps.length;
  }
  
  // Get summary of chain
  getSummary() {
    return {
      mainGoal: this.mainGoal.type,
      totalSteps: this.steps.length,
      currentStep: this.currentStep,
      progress: this.getProgress(),
      remaining: this.getRemainingSteps().map(s => s.type)
    };
  }

  // Check if resource can be gathered within faction territory
  canGatherResourceInTerritory(house, resourceType) {
    if (!global.zoneManager || !house.territory) return false;
    
    const hqZone = this.getHQZone(house);
    if (!hqZone) return false;
    
    const territoryZones = global.zoneManager.getAdjacentZones(hqZone.id, house.territory.coreBase.radius);
    
    for (const zone of territoryZones) {
      if (global.zoneManager.isZoneInTerritory(zone, house)) {
        const resources = global.zoneManager.getZoneResourceTypes(zone);
        if (this.hasResourceType(resources, resourceType)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Get building type needed for resource gathering
  getResourceBuildingType(resourceType) {
    const buildingTypes = {
      stone: 'quarry',
      wood: 'lumbermill',
      grain: 'farm',
      iron: 'mine'
    };
    return buildingTypes[resourceType] || 'workshop';
  }

  // Find resource in adjacent zones and create outpost goal
  findResourceInAdjacentZones(house, resourceType) {
    if (!global.zoneManager || !house.knowledge) return null;
    
    const hqZone = this.getHQZone(house);
    if (!hqZone) return null;
    
    const adjacentZones = global.zoneManager.getAdjacentZones(hqZone.id);
    const suitableZones = house.knowledge.findZonesWithResource(resourceType, adjacentZones);
    
    if (suitableZones.length > 0) {
      const { EstablishOutpostGoal } = require('./Goals');
      const bestZone = suitableZones[0].zone;
      return new EstablishOutpostGoal(resourceType, bestZone);
    }
    
    return null;
  }

  // Helper: Check if resources object has the required resource type
  hasResourceType(resources, resourceType) {
    switch (resourceType) {
      case 'stone':
        return resources.rocks > 10;
      case 'wood':
        return resources.forest > 10;
      case 'grain':
        return resources.farmland > 15;
      case 'iron':
        return resources.caves > 0;
      default:
        return false;
    }
  }

  // Helper: Get HQ zone
  getHQZone(house) {
    if (!global.zoneManager || !house.hq) return null;
    
    const hqTile = house.hq;
    const zonesAtHQ = global.zoneManager.getZonesAt(hqTile);
    
    // Find the faction territory zone
    for (const zoneId of zonesAtHQ) {
      const zone = global.zoneManager.zones.get(zoneId);
      if (zone && zone.type === 'faction_territory' && zone.faction === house.id) {
        return zone;
      }
    }
    
    return null;
  }
}

module.exports = GoalChain;

/*
Example usage:

Goal: Train Military
Blocked by: Need garrison
Chain: [BuildGarrison, GatherGrain, TrainMilitary]

BuildGarrison blocked by resources:
Chain: [GatherWood(50), GatherStone(30), BuildGarrison, GatherGrain(10), TrainMilitary]

The system automatically resolves all dependencies recursively.
*/

