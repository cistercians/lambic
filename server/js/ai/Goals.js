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

class BuildForgeGoal extends Goal {
  constructor() {
    super('BUILD_FORGE', 40);
    this.resourceCost = { wood: 50, stone: 100 };
    this.buildingRequirements = []; // No prerequisites for forge
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    const forgeId = constructor.buildForge(this.location);
    
    if (forgeId) {
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
    this.buildingRequirements = ['forge']; // Need forge to craft military equipment
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
      this.status = 'COMPLETED';
    } else {
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
    // TODO: Rally military units to defensive positions
    this.status = 'COMPLETED';
  }
}

// ============================================================================
// EXPANSION GOALS
// ============================================================================

class EstablishOutpostGoal extends Goal {
  constructor(resourceType, targetZone) {
    super('ESTABLISH_OUTPOST', 70);
    this.resourceType = resourceType;
    this.targetZone = targetZone;
    this.scoutingParty = null;
    this.outpostLocation = null;
    this.outpostPlan = null;
    this.status = 'PENDING';
  }
  
  canExecute(house) {
    this.blockedBy = [];
    
    // Check if we have at least 1 military unit for scouting (prefer 3: 1 leader + 2 backup)
    const militaryUnits = this.getMilitaryUnits(house);
    if (militaryUnits.length < 1) {
      this.blockedBy.push({ type: 'UNITS', need: 1, have: militaryUnits.length });
      return false;
    }
    
    // Check if target zone is still valid
    if (!this.targetZone || !global.zoneManager) {
      this.blockedBy.push({ type: 'ZONE', value: 'target zone not found' });
      return false;
    }
    
    // Check if zone is still adjacent to our territory
    const hqZone = this.getHQZone(house);
    if (!hqZone) {
      this.blockedBy.push({ type: 'TERRITORY', value: 'HQ zone not found' });
      return false;
    }
    
    const adjacentZones = global.zoneManager.getAdjacentZones(hqZone.id);
    const isAdjacent = adjacentZones.some(zone => zone.id === this.targetZone.id);
    
    if (!isAdjacent) {
      this.blockedBy.push({ type: 'DISTANCE', value: 'target zone not adjacent' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    if (!this.canExecute(house)) {
      this.status = 'BLOCKED';
      return false;
    }
    
    // Deploy scouting party
    this.scoutingParty = house.ai.deployScoutingParty(this.targetZone, this.resourceType);
    
    if (!this.scoutingParty) {
      this.status = 'FAILED';
      return false;
    }
    
    this.status = 'IN_PROGRESS';
    return true;
  }
  
  // Called when scouting party completes successfully
  onScoutingComplete(house, enemiesFound) {
    if (enemiesFound) {
      // Enemies found - this goal is blocked until they're dealt with
      this.status = 'BLOCKED';
      this.blockedBy.push({ type: 'ENEMIES', value: 'enemies detected in target zone' });
      return false;
    }
    
    // Zone is clear - plan outpost construction
    const OutpostPlanner = require('./OutpostPlanner');
    const planner = new OutpostPlanner();
    this.outpostPlan = planner.planOutpost(this.targetZone, this.resourceType, house);
    
    if (!this.outpostPlan) {
      this.status = 'FAILED';
      this.blockedBy.push({ type: 'LOCATION', value: 'no suitable outpost location found' });
      return false;
    }
    
    // Start outpost construction
    this.startOutpostConstruction(house);
    return true;
  }
  
  // Start building the outpost
  startOutpostConstruction(house) {
    const buildingConstructor = getBuildingConstructor(house);
    
    // Queue buildings for construction
    for (const building of this.outpostPlan.buildings) {
      buildingConstructor.queueBuilding({
        type: building.type,
        location: building.position,
        purpose: building.purpose,
        priority: 'high'
      });
    }
    
  }
  
  // Check if outpost construction is complete
  isOutpostComplete(house) {
    if (!this.outpostPlan) return false;
    
    // Check if all planned buildings exist
    for (const building of this.outpostPlan.buildings) {
      const [c, r] = building.position;
      const existingBuilding = global.getBuilding ? global.getBuilding(c, r) : null;
      
      if (!existingBuilding) {
        return false; // Building not yet constructed
      }
    }
    
    return true;
  }
  
  // Complete the goal
  complete(house) {
    this.status = 'COMPLETED';
    
    // Assign serfs to work at the resource building
    this.assignSerfsToOutpost(house);
    
    // Keep scouting party as guards
    if (this.scoutingParty) {
      this.scoutingParty.status = 'guarding';
    }
    
  }
  
  // Assign serfs to work at the outpost
  assignSerfsToOutpost(house) {
    const serfs = this.getSerfs(house);
    const resourceBuilding = this.outpostPlan.buildings.find(b => b.purpose === 'resource_gathering');
    
    if (!resourceBuilding || serfs.length === 0) return;
    
    // Assign 2-3 serfs to the outpost
    const serfsToAssign = Math.min(3, serfs.length);
    
    for (let i = 0; i < serfsToAssign; i++) {
      const serf = serfs[i];
      const [c, r] = resourceBuilding.position;
      
      // Set serf to work at the resource building
      serf.work = {
        hq: null, // No HQ for outpost workers
        spot: [c, r],
        type: this.resourceType
      };
      serf.action = 'task';
      serf.isOutpostWorker = true;
      
    }
  }
  
  // Helper: Get military units
  getMilitaryUnits(house) {
    const militaryUnits = [];
    
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove || !player.house || player.house.id !== house.id) continue;
      
      // Check if unit is military (not serf, not civilian)
      if (player.name && !player.name.includes('serf') && !player.name.includes('civilian')) {
        militaryUnits.push(player);
      }
    }
    
    return militaryUnits;
  }
  
  // Helper: Get serfs
  getSerfs(house) {
    const serfs = [];
    
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove || !player.house || player.house.id !== house.id) continue;
      
      if (player.name && player.name.includes('serf')) {
        serfs.push(player);
      }
    }
    
    return serfs;
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
  
  // Get blocking factors
  getBlockingFactors() {
    return this.blockedBy;
  }
  
  // Get goal description
  getDescription() {
    return `Establish outpost in ${this.targetZone.name} for ${this.resourceType}`;
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
    case 'forge': return new BuildForgeGoal();
    case 'garrison': return new BuildGarrisonGoal();
    default:
      return new Goal('BUILD_UNKNOWN', 0);
  }
}

module.exports = {
  Goal,
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
  BuildForgeGoal,
  BuildGarrisonGoal,
  GatherResourceGoal,
  TrainMilitaryGoal,
  DeployScoutGoal,
  DefendTerritoryGoal,
  EstablishOutpostGoal,
  AttackEnemyGoal,
  createBuildingGoal
};

