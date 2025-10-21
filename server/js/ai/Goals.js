// Goal System with Dependencies
// Defines various goal types with resource requirements and building prerequisites

// Helper to get or create BuildingConstructor (always non-enumerable)
function getBuildingConstructor(house) {
  if (!house.buildingConstructor) {
    const BuildingConstructor = require('./BuildingConstructor');
    Object.defineProperty(house, 'buildingConstructor', {
      value: new BuildingConstructor(house),
      writable: true,
      enumerable: false, // Critical: exclude from JSON serialization
      configurable: true
    });
  }
  return house.buildingConstructor;
}

class Goal {
  constructor(type, utility) {
    this.type = type;
    this.utility = utility; // 0-100 priority score
    this.resourceCost = {}; // {wood: 50, stone: 30}
    this.buildingRequirements = []; // ['garrison', 'mill']
    this.prerequisites = []; // Other goals that must complete first
    this.status = 'PENDING'; // PENDING, IN_PROGRESS, BLOCKED, COMPLETED, FAILED
    this.blockedBy = []; // What's preventing execution
    this.location = null; // Where to execute this goal
  }
  
  // Check if goal can be executed
  canExecute(house) {
    this.blockedBy = [];
    
    // Check building requirements
    for (const buildingType of this.buildingRequirements) {
      if (!this.hasBuildingType(house, buildingType)) {
        this.blockedBy.push({ type: 'BUILDING', value: buildingType });
      }
    }
    
    // Check resource requirements
    for (const [resource, amount] of Object.entries(this.resourceCost)) {
      const available = house.stores[resource] || 0;
      if (available < amount) {
        this.blockedBy.push({
          type: 'RESOURCE',
          resource,
          have: available,
          need: amount
        });
      }
    }
    
    return this.blockedBy.length === 0;
  }
  
  // Get what's preventing this goal from executing
  getBlockingFactors(house) {
    this.canExecute(house); // Updates blockedBy
    return this.blockedBy;
  }
  
  // Execute the goal (to be overridden by specific goal types)
  execute(house) {
    console.log(`Executing goal: ${this.type}`);
    this.status = 'COMPLETED';
  }
  
  // Helper: check if house has a building type
  hasBuildingType(house, buildingType) {
    if (typeof Building === 'undefined' || !Building.list) return false;
    
    for (const id in Building.list) {
      const building = Building.list[id];
      if (building.owner === house.id && building.type === buildingType) {
        return true;
      }
    }
    return false;
  }
  
  // Helper: count buildings of a type
  countBuildingType(house, buildingType) {
    let count = 0;
    if (typeof Building === 'undefined' || !Building.list) return 0;
    
    for (const id in Building.list) {
      const building = Building.list[id];
      if (building.owner === house.id && building.type === buildingType) {
        count++;
      }
    }
    return count;
  }
}

// ============================================================================
// ECONOMIC GOALS
// ============================================================================

class BuildMillGoal extends Goal {
  constructor() {
    super('BUILD_MILL', 45);
    this.resourceCost = { wood: 40, stone: 20 };
    this.buildingRequirements = [];
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    // Attempt to build mill
    const millId = constructor.buildMill(this.location);
    
    if (millId) {
      // Deduct resources
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      console.log(`${house.name}: Failed to build mill - no valid location`);
      this.status = 'FAILED';
    }
  }
}

class BuildFarmGoal extends Goal {
  constructor() {
    super('BUILD_FARM', 40);
    this.resourceCost = { wood: 20 };
    this.buildingRequirements = ['mill']; // Need mill to process grain
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    const farmId = constructor.buildFarm(this.location);
    
    if (farmId) {
      house.stores.wood -= this.resourceCost.wood;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
}

class BuildMineGoal extends Goal {
  constructor(location = null) {
    super('BUILD_MINE', 45);
    this.resourceCost = { wood: 30, stone: 20 };
    this.buildingRequirements = [];
    this.location = location;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    const mineId = constructor.buildMine(this.location);
    
    if (mineId) {
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
}

class BuildLumbermillGoal extends Goal {
  constructor(location = null) {
    super('BUILD_LUMBERMILL', 40);
    this.resourceCost = { wood: 35, stone: 15 };
    this.buildingRequirements = [];
    this.location = location;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    const lumbermillId = constructor.buildLumbermill(this.location);
    
    if (lumbermillId) {
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
}

class BuildGarrisonGoal extends Goal {
  constructor() {
    super('BUILD_GARRISON', 50);
    this.resourceCost = { wood: 50, stone: 30 };
    this.buildingRequirements = [];
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    const garrisonId = constructor.buildGarrison(this.location);
    
    if (garrisonId) {
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
}

class GatherResourceGoal extends Goal {
  constructor(resource, amount) {
    super('GATHER_RESOURCE', 30);
    this.resource = resource;
    this.targetAmount = amount;
    this.resourceCost = {}; // No cost to gather
    this.buildingRequirements = [];
  }
  
  execute(house) {
    // This goal is passive - serfs will gather over time
    // Check if we've reached target
    const current = house.stores[this.resource] || 0;
    if (current >= this.targetAmount) {
      console.log(`${house.name}: Gathered enough ${this.resource} (${current}/${this.targetAmount})`);
      this.status = 'COMPLETED';
    } else {
      console.log(`${house.name}: Gathering ${this.resource} (${current}/${this.targetAmount})`);
      this.status = 'IN_PROGRESS';
    }
  }
  
  canExecute(house) {
    // Gathering has no prerequisites
    return true;
  }
}

// ============================================================================
// MILITARY GOALS
// ============================================================================

class TrainMilitaryGoal extends Goal {
  constructor(unitCount = 1) {
    super('TRAIN_MILITARY', 50);
    this.resourceCost = { grain: 10 * unitCount };
    this.buildingRequirements = ['garrison'];
    this.unitCount = unitCount;
  }
  
  execute(house) {
    console.log(`${house.name}: Training ${this.unitCount} military unit(s)`);
    house.stores.grain -= this.resourceCost.grain;
    
    // Increment military count (simplified)
    house.military.units.i += this.unitCount;
    
    this.status = 'COMPLETED';
  }
}

class DeployScoutGoal extends Goal {
  constructor(destination = null) {
    super('DEPLOY_SCOUT', 25);
    this.resourceCost = {}; // No cost
    this.buildingRequirements = [];
    this.destination = destination;
  }
  
  execute(house) {
    console.log(`${house.name}: Deploying scout to ${this.destination || 'explore territory'}`);
    // TODO: Actually create a scout unit with scout behavior
    this.status = 'COMPLETED';
  }
}

class DefendTerritoryGoal extends Goal {
  constructor() {
    super('DEFEND_TERRITORY', 80);
    this.resourceCost = {};
    this.buildingRequirements = [];
  }
  
  execute(house) {
    console.log(`${house.name}: Positioning defenders`);
    // TODO: Rally military units to defensive positions
    this.status = 'COMPLETED';
  }
}

// ============================================================================
// EXPANSION GOALS
// ============================================================================

class EstablishOutpostGoal extends Goal {
  constructor(location) {
    super('ESTABLISH_OUTPOST', 35);
    this.resourceCost = { wood: 30 };
    this.buildingRequirements = [];
    this.location = location;
  }
  
  execute(house) {
    console.log(`${house.name}: Establishing outpost at [${this.location}]`);
    house.stores.wood -= this.resourceCost.wood;
    this.status = 'COMPLETED';
  }
}

// ============================================================================
// WARFARE GOALS
// ============================================================================

class AttackEnemyGoal extends Goal {
  constructor(target) {
    super('ATTACK_ENEMY', 60);
    this.resourceCost = {};
    this.buildingRequirements = ['garrison'];
    this.target = target;
  }
  
  execute(house) {
    console.log(`${house.name}: Launching attack on ${this.target ? this.target.house : 'enemy'}`);
    // TODO: Coordinate military units for attack
    this.status = 'COMPLETED';
  }
}

// Helper function to create building goals by type
function createBuildingGoal(buildingType) {
  switch(buildingType) {
    case 'mill': return new BuildMillGoal();
    case 'farm': return new BuildFarmGoal();
    case 'mine': return new BuildMineGoal();
    case 'lumbermill': return new BuildLumbermillGoal();
    case 'garrison': return new BuildGarrisonGoal();
    default:
      console.warn(`Unknown building type: ${buildingType}`);
      return new Goal('BUILD_UNKNOWN', 0);
  }
}

module.exports = {
  Goal,
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
  BuildGarrisonGoal,
  GatherResourceGoal,
  TrainMilitaryGoal,
  DeployScoutGoal,
  DefendTerritoryGoal,
  EstablishOutpostGoal,
  AttackEnemyGoal,
  createBuildingGoal
};

