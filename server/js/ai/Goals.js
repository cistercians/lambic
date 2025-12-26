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
  
  // Helper: check if house has a building type (uses BuildingService - fails fast if unavailable)
  hasBuildingType(house, buildingType) {
    if (!house.ai || !house.ai.buildingService) {
      throw new Error(`BuildingService not available for ${house.name || 'unknown'} - check FactionAI initialization`);
    }
    return house.ai.buildingService.hasBuildingType(buildingType);
  }
  
  // Helper: count buildings of a type (uses BuildingService - fails fast if unavailable)
  countBuildingType(house, buildingType) {
    if (!house.ai || !house.ai.buildingService) {
      throw new Error(`BuildingService not available for ${house.name || 'unknown'} - check FactionAI initialization`);
    }
    return house.ai.buildingService.getBuildingCount(buildingType);
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
  
  // Check if mill can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Check if location is available (validation-only)
    const hq = house.hq;
    const searchCenter = this.location || hq;
    const radius = this.location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
      excludeTiles: constructor.getOccupiedTiles()
    });
    
    return spot !== null;
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    const logger = house.ai?.logger;
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    // Attempt to build mill
    const millId = constructor.buildMill(this.location);
    
    if (millId) {
      // Deduct resources
      if (house.stores.wood < this.resourceCost.wood || house.stores.stone < this.resourceCost.stone) {
        const haveWood = house.stores.wood || 0;
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build mill: need ${this.resourceCost.wood} wood (have ${haveWood}), need ${this.resourceCost.stone} stone (have ${haveStone}). Build resource gathering buildings or wait for serfs to gather.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
      
      if (logger) {
        logger.logAction('BUILDING_CONSTRUCTED', 'Built mill', {
          buildingType: 'mill',
          location: this.location,
          cost: this.resourceCost,
          buildingId: millId
        });
      }
    } else {
      this.status = 'FAILED';
      const error = new Error('Failed to find suitable location for mill - no valid placement found within search radius. Try expanding territory or checking for obstacles.');
      
      if (logger) {
        logger.logError('Failed to build mill - no suitable location', error);
      }
      
      throw error;
    }
  }
}

class BuildFarmGoal extends Goal {
  constructor() {
    super('BUILD_FARM', 40);
    this.resourceCost = { wood: 20 };
    this.buildingRequirements = ['mill']; // Need mill to process grain
  }
  
  // Check if farm can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceFarm(this.location);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    const logger = house.ai?.logger;
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const farmId = constructor.buildFarm(this.location);
    
    if (farmId) {
      if (house.stores.wood < this.resourceCost.wood) {
        const haveWood = house.stores.wood || 0;
        throw new Error(`Insufficient resources to build farm: need ${this.resourceCost.wood} wood (have ${haveWood}). Build lumbermill or wait for serfs to gather wood.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      this.status = 'COMPLETED';
      
      if (logger) {
        logger.collectAction('Built farm', {
          reasoning: `Cost: ${this.resourceCost.wood} wood`,
          buildingType: 'farm',
          status: 'COMPLETED'
        });
      }
    } else {
      this.status = 'FAILED';
      const error = new Error('Failed to find suitable location for farm - need mill nearby (within 6-10 tiles). Build mill first or find location closer to existing mill.');
      
      if (logger) {
        logger.logError('Failed to build farm - no suitable location', error, {
          buildingType: 'farm',
          location: this.location
        });
      }
      
      throw error;
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
  
  // Check if mine can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Check if location is available (validation-only)
    const hq = house.hq;
    const searchCenter = this.location || hq;
    const radius = this.location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
      excludeTiles: constructor.getOccupiedTiles()
    });
    
    return spot !== null && spot.plot && spot.plot[0];
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    const logger = house.ai?.logger;
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const mineId = constructor.buildMine(this.location);
    
    if (mineId) {
      if (house.stores.wood < this.resourceCost.wood || house.stores.stone < this.resourceCost.stone) {
        const haveWood = house.stores.wood || 0;
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build mine: need ${this.resourceCost.wood} wood (have ${haveWood}), need ${this.resourceCost.stone} stone (have ${haveStone}). Build resource gathering buildings or wait for serfs to gather.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
      
      if (logger) {
        logger.logAction('Built mine', {
          reasoning: `Cost: ${this.resourceCost.wood} wood, ${this.resourceCost.stone} stone`
        });
      }
    } else {
      this.status = 'FAILED';
      const error = new Error('Failed to find suitable location for mine - no valid placement found. Mines can be placed on EMPTY, ROCKS, or MOUNTAIN terrain within search radius.');
      
      if (logger) {
        logger.collectError('Failed to build mine - no suitable location', error);
      }
      
      throw error;
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
  
  // Check if lumbermill can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Check if location is available (validation-only)
    const hq = house.hq;
    const searchCenter = this.location || hq;
    const radius = this.location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('lumbermill', searchCenter, radius, {
      excludeTiles: constructor.getOccupiedTiles()
    });
    
    return spot !== null;
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const lumbermillId = constructor.buildLumbermill(this.location);
    
    if (lumbermillId) {
      if (house.stores.wood < this.resourceCost.wood || house.stores.stone < this.resourceCost.stone) {
        const haveWood = house.stores.wood || 0;
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build lumbermill: need ${this.resourceCost.wood} wood (have ${haveWood}), need ${this.resourceCost.stone} stone (have ${haveStone}). Build resource gathering buildings or wait for serfs to gather.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
      throw new Error('Failed to find suitable location for lumbermill - need forest nearby (within 5 tiles, minimum 10-12 forest tiles). Scout for forest locations or expand territory.');
    }
  }
}

class BuildForgeGoal extends Goal {
  constructor() {
    super('BUILD_FORGE', 40);
    this.resourceCost = { wood: 50, stone: 100 };
    this.buildingRequirements = []; // No prerequisites for forge
  }
  
  // Check if forge can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Check if location is available (validation-only)
    const hq = house.hq;
    const searchCenter = this.location || hq;
    const radius = this.location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
      excludeTiles: constructor.getOccupiedTiles()
    });
    
    return spot !== null;
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const forgeId = constructor.buildForge(this.location);
    
    if (forgeId) {
      if (house.stores.wood < this.resourceCost.wood || house.stores.stone < this.resourceCost.stone) {
        const haveWood = house.stores.wood || 0;
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build forge: need ${this.resourceCost.wood} wood (have ${haveWood}), need ${this.resourceCost.stone} stone (have ${haveStone}). Build lumbermill and mine or wait for serfs to gather.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
      throw new Error('Failed to find suitable location for forge - no valid placement found within search radius. Try expanding territory or checking for obstacles.');
    }
  }
}

class BuildGarrisonGoal extends Goal {
  constructor() {
    super('BUILD_GARRISON', 50);
    this.resourceCost = { wood: 50, stone: 30 };
    this.buildingRequirements = ['forge']; // Need forge to craft military equipment
  }
  
  // Check if garrison can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Check if location is available (validation-only)
    const hq = house.hq;
    const searchCenter = this.location || hq;
    const radius = this.location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('garrison', searchCenter, radius, {
      excludeTiles: constructor.getOccupiedTiles()
    });
    
    return spot !== null;
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    return this.canPlace(house);
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const garrisonId = constructor.buildGarrison(this.location);
    
    if (garrisonId) {
      if (house.stores.wood < this.resourceCost.wood || house.stores.stone < this.resourceCost.stone) {
        const haveWood = house.stores.wood || 0;
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build garrison: need ${this.resourceCost.wood} wood (have ${haveWood}), need ${this.resourceCost.stone} stone (have ${haveStone}). Requires forge first - build forge and gather resources.`);
      }
      house.stores.wood -= this.resourceCost.wood;
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
      throw new Error('Failed to find suitable location for garrison - no valid placement found within search radius. Requires forge first - ensure forge is built, then try expanding territory.');
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
  
  // Get building type needed for this resource
  getRequiredBuildingType() {
    const buildingTypes = {
      stone: 'mine',
      wood: 'lumbermill',
      grain: 'farm',
      iron: 'mine',
      ironore: 'mine',
      silverore: 'mine',
      goldore: 'mine'
    };
    return buildingTypes[this.resource] || null;
  }
  
  // Check if gathering building exists and is operational
  hasGatheringBuilding(house) {
    const buildingType = this.getRequiredBuildingType();
    if (!buildingType) {
      return false; // No building type defined for this resource
    }
    
    // Check if building exists
    if (!house.ai || !house.ai.buildingService) {
      return false;
    }
    
    const buildingCount = house.ai.buildingService.getBuildingCount(buildingType);
    if (buildingCount === 0) {
      return false; // No gathering building exists
    }
    
    // Check if buildings are built and have workers (basic operational check)
    const buildings = house.ai.buildingService.getBuildingsByType(buildingType);
    for (const building of buildings) {
      if (building && building.built) {
        // Building exists and is built - consider it operational
        // (More detailed worker checking could be added here)
        return true;
      }
    }
    
    return false;
  }
  
  execute(house) {
    // Check if we've reached target
    const current = house.stores[this.resource] || 0;
    if (current >= this.targetAmount) {
      this.status = 'COMPLETED';
      return;
    }
    
    // Check if gathering building exists - if not, mark as BLOCKED
    if (!this.hasGatheringBuilding(house)) {
      this.status = 'BLOCKED';
      const buildingType = this.getRequiredBuildingType();
      this.blockedBy = [{
        type: 'BUILDING',
        value: buildingType || 'unknown',
        reason: `Need ${buildingType} to gather ${this.resource}`
      }];
      return;
    }
    
    // Building exists - resources will gather over time
    this.status = 'IN_PROGRESS';
  }
  
  canExecute(house) {
    // Check if gathering building exists
    if (!this.hasGatheringBuilding(house)) {
      this.blockedBy = [{
        type: 'BUILDING',
        value: this.getRequiredBuildingType() || 'unknown'
      }];
      return false;
    }
    
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
    // Validate resources before deducting
    if (house.stores.grain < this.resourceCost.grain) {
      throw new Error(`Insufficient grain: need ${this.resourceCost.grain}, have ${house.stores.grain || 0}`);
    }
    
    // Deduct resources
    house.stores.grain -= this.resourceCost.grain;
    
    // Find a garrison building for this faction
    var garrison = null;
    if (typeof Building !== 'undefined' && Building.list) {
      for (var bid in Building.list) {
        var b = Building.list[bid];
        if (b.type === 'garrison' && b.house === house.id && b.built) {
          garrison = b;
          break;
        }
      }
    }
    
    if (!garrison) {
      this.status = 'FAILED';
      throw new Error('Cannot train military: no garrison building found. Build forge first, then build garrison to train units.');
    }
    
    // Spawn units at the garrison
    for (var i = 0; i < this.unitCount; i++) {
      this.spawnUnitAtGarrison(house, garrison);
    }
    
    this.status = 'COMPLETED';
  }
  
  // Spawn a unit at the garrison (reuses garrison spawning logic)
  spawnUnitAtGarrison(house, garrison) {
    // Spawn location
    var sp = garrison.plot[7] || garrison.plot[0];
    var spCoords = global.getCenter(sp[0], sp[1]);
    
    // Determine unit type based on faction progression
    var progression = global.FACTION_UNIT_PROGRESSION ? global.FACTION_UNIT_PROGRESSION[house.name] : null;
    var unitClass;
    
    if (progression) {
      // Check if stronghold exists (produces elite units)
      if (house.hasStronghold && progression.elite) {
        unitClass = progression.elite;
      } else {
        // No stronghold, produce basic units
        var basicUnits = progression.basic;
        if (basicUnits && basicUnits.length > 0) {
          unitClass = basicUnits[Math.floor(Math.random() * basicUnits.length)];
        }
      }
    }
    
    // Fallback for factions without progression defined
    if (!unitClass) {
      var factionUnits = global.FACTION_BASIC_UNITS ? global.FACTION_BASIC_UNITS[house.name] : null;
      if (factionUnits && factionUnits.length > 0) {
        var randomIndex = Math.floor(Math.random() * factionUnits.length);
        unitClass = factionUnits[randomIndex];
      }
    }
    
    if (!unitClass) {
      // No unit class found - can't spawn
      return;
    }
    
    // Spawn the unit using global constructor
    var unitConstructor = global[unitClass];
    if (unitConstructor) {
      var newUnit = unitConstructor({
        x: spCoords[0],
        y: spCoords[1],
        z: garrison.z || 0,
        house: house.id,
        kingdom: house.kingdom,
        home: { z: garrison.z || 0, loc: sp }
      });
      
      // Initialize patrol mode (uses faction's universal patrol list)
      newUnit.mode = 'patrol';
      newUnit.patrol = {
        enabled: true,
        targetTiles: {},
        idleTimer: 0,
        resumePoint: null
      };
      
      // Create military recruitment event
      if (global.eventManager) {
        global.eventManager.militaryUnitRecruited(
          unitClass,
          house.name,
          house.id,
          { x: newUnit.x, y: newUnit.y, z: newUnit.z }
        );
      }
    }
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
    // Check if AI system exists
    if (!house.ai || !house.ai.deployScoutingParty) {
      this.status = 'FAILED';
      return;
    }
    
    // Check if we have military units available
    if (!house.ai.getMilitaryUnits || house.ai.getMilitaryUnits().length === 0) {
      this.status = 'FAILED';
      return;
    }
    
    // Find an unexplored location to scout
    var targetZone = this.findScoutDestination(house);
    
    if (!targetZone) {
      this.status = 'FAILED';
      return;
    }
    
    // Deploy scouting party
    var party = house.ai.deployScoutingParty(targetZone, 'resource_scout');
    
    if (party) {
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
  
  // Find an unexplored location to scout (simple implementation)
  findScoutDestination(house) {
    // Use HQ as base
    var hq = house.hq;
    if (!hq) return null;
    
    // Find an unexplored location about 20-30 tiles away from HQ
    var scoutDistance = 25; // tiles
    var angle = Math.random() * Math.PI * 2; // Random direction
    
    var targetCol = Math.floor(hq[0] + Math.cos(angle) * scoutDistance);
    var targetRow = Math.floor(hq[1] + Math.sin(angle) * scoutDistance);
    
    // Clamp to map bounds
    var mapSize = global.mapSize || 192;
    targetCol = Math.max(0, Math.min(mapSize - 1, targetCol));
    targetRow = Math.max(0, Math.min(mapSize - 1, targetRow));
    
    // Create a simple zone-like object
    return {
      center: [targetCol, targetRow],
      id: 'scout_' + Date.now(),
      name: 'Scout Destination'
    };
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
    if (!this.targetZone) {
      this.blockedBy.push({ type: 'ZONE', value: 'target zone not found' });
      return false;
    }
    
    // If zone system is available, use it for validation
    if (global.zoneManager) {
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
    } else {
      // Fallback: Use territory manager to find outpost location
      // If targetZone has center coordinates, validate distance from HQ
      if (this.targetZone.center) {
        var hq = house.hq;
        var targetCenter = this.targetZone.center;
        var distance = Math.sqrt(
          Math.pow(targetCenter[0] - hq[0], 2) + 
          Math.pow(targetCenter[1] - hq[1], 2)
        );
        
        // Allow outposts within reasonable distance (20-50 tiles)
        if (distance < 20 || distance > 50) {
          this.blockedBy.push({ type: 'DISTANCE', value: 'target location out of range' });
          return false;
        }
      }
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
      
      // Check if unit is military using the military property
      if (player.military === true) {
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
    if (!house.hq) return null;
    
    // If zone manager is available, use it
    if (global.zoneManager) {
      const hqTile = house.hq;
      const zonesAtHQ = global.zoneManager.getZonesAt(hqTile);
      
      // Find the faction territory zone
      for (const zoneId of zonesAtHQ) {
        const zone = global.zoneManager.zones.get(zoneId);
        if (zone && zone.type === 'faction_territory' && zone.faction === house.id) {
          return zone;
        }
      }
    }
    
    // Fallback: Create a simple zone-like object based on HQ
    return {
      id: 'hq_' + house.id,
      center: house.hq,
      type: 'faction_territory',
      faction: house.id
    };
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

