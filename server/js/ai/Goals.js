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
  
  // Check if house/faction is Celts
  isCelts(house) {
    const factionName = house?.name || '';
    const baseName = factionName.replace(/\s+\d+$/, '').trim().toLowerCase();
    return baseName === 'celts';
  }
  
  // Get adjusted resource cost (faction-specific modifications)
  getAdjustedResourceCost(house) {
    const adjusted = { ...this.resourceCost };
    
    // Celts: remove wood costs (they must build on forest tiles instead)
    if (this.isCelts(house) && adjusted.wood !== undefined) {
      delete adjusted.wood;
    }
    
    return adjusted;
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
    
    // Check resource requirements (using adjusted costs for faction-specific rules)
    const adjustedCosts = this.getAdjustedResourceCost(house);
    for (const [resource, amount] of Object.entries(adjustedCosts)) {
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
    this.resourceCost = { wood: 60 };
    this.buildingRequirements = [];
  }
  
  // Check if mill can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceMill(this.location);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid mill location found' });
      return false;
    }
    
    return true;
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
      // Deduct resources (using adjusted costs - Celts exempt from wood)
      const adjustedCosts = this.getAdjustedResourceCost(house);
      if (adjustedCosts.wood !== undefined) {
        if (house.stores.wood < adjustedCosts.wood) {
          const haveWood = house.stores.wood || 0;
          throw new Error(`Insufficient resources to build mill: need ${adjustedCosts.wood} wood (have ${haveWood}). Build resource gathering buildings or wait for serfs to gather.`);
        }
        house.stores.wood -= adjustedCosts.wood;
      }
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
    this.resourceCost = {};
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
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid farm location found near mill' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    const logger = house.ai?.logger;
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const farmId = constructor.buildFarm(this.location);
    
    if (farmId) {
      // Farm has no resource cost
      this.status = 'COMPLETED';
      
      if (logger) {
        logger.collectAction('Built farm', {
          reasoning: `Cost: No cost`,
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
  constructor(location = null, mineType = 'any') {
    super('BUILD_MINE', 45);
    this.resourceCost = { wood: 60 };
    this.buildingRequirements = [];
    this.location = location;
    this.mineType = mineType; // 'stone', 'cave', or 'any'
  }
  
  // Check if mine can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceMine(this.location, this.mineType);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.canPlace(house)) {
      const mineTypeDesc = this.mineType === 'stone' ? 'stone mine' : this.mineType === 'cave' ? 'cave mine' : 'mine';
      this.blockedBy.push({ type: 'LOCATION', value: `no valid ${mineTypeDesc} location found` });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    const logger = house.ai?.logger;
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const mineId = constructor.buildMine(this.location, this.mineType);
    
    if (mineId) {
      // Deduct resources (using adjusted costs - Celts exempt from wood)
      const adjustedCosts = this.getAdjustedResourceCost(house);
      if (adjustedCosts.wood !== undefined) {
        if (house.stores.wood < adjustedCosts.wood) {
          const haveWood = house.stores.wood || 0;
          throw new Error(`Insufficient resources to build mine: need ${adjustedCosts.wood} wood (have ${haveWood}). Build resource gathering buildings or wait for serfs to gather.`);
        }
        house.stores.wood -= adjustedCosts.wood;
      }
      this.status = 'COMPLETED';
      
      if (logger) {
        logger.logAction('Built mine', {
          reasoning: `Cost: ${this.resourceCost.wood} wood`
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
    this.resourceCost = { wood: 75 };
    this.buildingRequirements = [];
    this.location = location;
  }
  
  // Check if lumbermill can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceLumbermill(this.location);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid lumbermill location found near forest' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const lumbermillId = constructor.buildLumbermill(this.location);
    
    if (lumbermillId) {
      // Deduct resources (using adjusted costs - Celts exempt from wood)
      const adjustedCosts = this.getAdjustedResourceCost(house);
      if (adjustedCosts.wood !== undefined) {
        if (house.stores.wood < adjustedCosts.wood) {
          const haveWood = house.stores.wood || 0;
          throw new Error(`Insufficient resources to build lumbermill: need ${adjustedCosts.wood} wood (have ${haveWood}). Build resource gathering buildings or wait for serfs to gather.`);
        }
        house.stores.wood -= adjustedCosts.wood;
      }
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
    this.resourceCost = { wood: 50 };
    this.buildingRequirements = []; // No prerequisites for forge
  }
  
  // Check if forge can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceForge(this.location);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid forge location found' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const forgeId = constructor.buildForge(this.location);
    
    if (forgeId) {
      // Deduct resources (using adjusted costs - Celts exempt from wood)
      const adjustedCosts = this.getAdjustedResourceCost(house);
      if (adjustedCosts.wood !== undefined) {
        if (house.stores.wood < adjustedCosts.wood) {
          const haveWood = house.stores.wood || 0;
          throw new Error(`Insufficient resources to build forge: need ${adjustedCosts.wood} wood (have ${haveWood}). Build lumbermill or wait for serfs to gather.`);
        }
        house.stores.wood -= adjustedCosts.wood;
      }
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
    this.resourceCost = { stone: 100 };
    this.buildingRequirements = ['forge']; // Need forge to craft military equipment
  }
  
  // Check if garrison can be placed at a valid location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceGarrison(this.location);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources, buildings)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid garrison location found' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const garrisonId = constructor.buildGarrison(this.location);
    
    if (garrisonId) {
      if (house.stores.stone < this.resourceCost.stone) {
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build garrison: need ${this.resourceCost.stone} stone (have ${haveStone}). Requires forge first - build forge and gather resources.`);
      }
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
      throw new Error('Failed to find suitable location for garrison - no valid placement found within search radius. Requires forge first - ensure forge is built, then try expanding territory.');
    }
  }
}

class BuildGuardtowerGoal extends Goal {
  constructor(targetLocation) {
    super('BUILD_GUARDTOWER', 60);
    this.resourceCost = { stone: 120 }; // From BuildingPreview.js
    this.buildingRequirements = []; // No building requirements
    this.targetLocation = targetLocation; // [col, row] tile coordinates for outpost location
  }
  
  // Check if guardtower can be placed at target location
  canPlace(house) {
    const constructor = getBuildingConstructor(house);
    if (!constructor) {
      return false;
    }
    
    // Use BuildingConstructor's validation method
    return constructor.canPlaceGuardtower(this.targetLocation);
  }
  
  // Override canExecute to also check location
  canExecute(house) {
    // First check standard requirements (resources)
    if (!super.canExecute(house)) {
      return false;
    }
    
    // Then check if location is available
    if (!this.targetLocation) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no target location specified' });
      return false;
    }
    
    if (!this.canPlace(house)) {
      this.blockedBy.push({ type: 'LOCATION', value: 'no valid guardtower location found at outpost' });
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    const constructor = getBuildingConstructor(house);
    
    if (!constructor) {
      throw new Error('BuildingConstructor not available');
    }
    
    const guardtowerId = constructor.buildGuardtower(this.targetLocation);
    
    if (guardtowerId) {
      if (house.stores.stone < this.resourceCost.stone) {
        const haveStone = house.stores.stone || 0;
        throw new Error(`Insufficient resources to build guardtower: need ${this.resourceCost.stone} stone (have ${haveStone})`);
      }
      house.stores.stone -= this.resourceCost.stone;
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
      throw new Error('Failed to find suitable location for guardtower at outpost location');
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
    this.lastResourceLevel = null; // Track previous resource level to detect production
    this.daysWithoutProduction = 0; // Track days without resource increase
    this.initialResourceLevel = null; // Track initial level when goal created
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
    
    // For stone, need stone mines (not cave mines)
    if (this.resource === 'stone') {
      const stoneMineCount = house.ai.buildingService.getStoneMineCount();
      if (stoneMineCount === 0) {
        return false; // No stone mines exist
      }
      
      // Check if at least one stone mine is built and operational
      const buildings = house.ai.buildingService.getBuildingsByType('mine');
      for (const building of buildings) {
        if (building && building.built && !building.cave) {
          // Stone mine exists and is built
          return true;
        }
      }
      return false;
    }
    
    // For ores, need cave mines (not stone mines)
    if (this.resource === 'ironore' || this.resource === 'silverore' || this.resource === 'goldore' || this.resource === 'iron') {
      const caveMineCount = house.ai.buildingService.getCaveMineCount();
      if (caveMineCount === 0) {
        return false; // No cave mines exist
      }
      
      // Check if at least one cave mine is built and operational
      const buildings = house.ai.buildingService.getBuildingsByType('mine');
      for (const building of buildings) {
        if (building && building.built && building.cave) {
          // Cave mine exists and is built
          return true;
        }
      }
      return false;
    }
    
    // For other resources (wood, grain), use standard check
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
    const current = house.stores[this.resource] || 0;
    const factionName = house.name || 'Unknown';
    
    // Initialize tracking on first execution
    if (this.initialResourceLevel === null) {
      this.initialResourceLevel = current;
      this.lastResourceLevel = current;
      console.log(`[GATHER_RESOURCE] ${factionName}: Started gathering ${this.resource} - current: ${current}, target: ${this.targetAmount}`);
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
      console.log(`[GATHER_RESOURCE] ${factionName}: Blocked - no ${buildingType} to gather ${this.resource}`);
      return;
    }
    
    // Check if resources are increasing (production is happening)
    const resourcesIncreased = current > this.lastResourceLevel;
    if (resourcesIncreased) {
      // Production is happening - reset days without production
      this.daysWithoutProduction = 0;
      const increase = current - this.lastResourceLevel;
      console.log(`[GATHER_RESOURCE] ${factionName}: Gathering ${this.resource} - current: ${current}, target: ${this.targetAmount}, increased by: ${increase} today`);
    } else {
      // No production this day
      this.daysWithoutProduction++;
      console.log(`[GATHER_RESOURCE] ${factionName}: Gathering ${this.resource} - current: ${current}, target: ${this.targetAmount}, no increase (${this.daysWithoutProduction} days without production)`);
      
      // If no production for 3+ days, mark as BLOCKED (production issue)
      if (this.daysWithoutProduction >= 3) {
        this.status = 'BLOCKED';
        this.blockedBy = [{
          type: 'PRODUCTION',
          value: 'no production detected',
          reason: `No ${this.resource} production for ${this.daysWithoutProduction} days despite having gathering building`
        }];
        console.warn(`[GATHER_RESOURCE] ${factionName}: Blocked - no production detected for ${this.daysWithoutProduction} days (current: ${current}, target: ${this.targetAmount})`);
        return;
      }
    }
    
    // Update last resource level for next check
    this.lastResourceLevel = current;
    
    // Check if we've reached the target
    // CRITICAL: Never complete if current < targetAmount (validation check)
    if (current < this.targetAmount) {
      // Not at target yet - continue gathering
      this.status = 'IN_PROGRESS';
      return;
    }
    
    // At or above target - only complete if resources actually increased during goal execution
    const increasedSinceStart = current > this.initialResourceLevel;
    
    if (increasedSinceStart) {
      // Resources increased during goal execution - complete
      this.status = 'COMPLETED';
      const increase = current - this.initialResourceLevel;
      console.log(`[GATHER_RESOURCE] ${factionName}: Completed gathering ${this.resource} - reached ${current} (target: ${this.targetAmount}, increased by: ${increase})`);
      return;
    } else {
      // At target but no increase - production isn't working, don't complete
      // Continue waiting for actual production or will be marked BLOCKED after timeout
      console.log(`[GATHER_RESOURCE] ${factionName}: At target ${current} but no increase detected (started at ${this.initialResourceLevel}) - waiting for production`);
      this.status = 'IN_PROGRESS';
      return; // Don't complete, keep waiting
    }
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
    // Resource costs will be determined dynamically based on unit type
    this.resourceCost = {}; // Set in execute() based on unit type
    this.buildingRequirements = ['garrison'];
    this.unitCount = unitCount;
  }
  
  execute(house) {
    // Determine unit type and costs before validation
    var progression = global.FACTION_UNIT_PROGRESSION ? global.FACTION_UNIT_PROGRESSION[house.name] : null;
    var unitClass;
    var isMounted = false;
    var isElite = false;
    
    if (progression) {
      // Check if stronghold exists (produces elite units)
      if (house.hasStronghold && progression.elite) {
        unitClass = progression.elite;
        isElite = true;
        // Check if elite unit is mounted
        if (unitClass && typeof unitClass === 'string') {
          var nameLower = unitClass.toLowerCase();
          isMounted = nameLower.includes('cavalier') || nameLower.includes('cavalry') || 
                      nameLower.includes('horseman') || nameLower.includes('knight') || 
                      nameLower.includes('mounted');
        }
      } else {
        // Basic units
        var basicUnits = progression.basic;
        if (basicUnits && basicUnits.length > 0) {
          unitClass = basicUnits[Math.floor(Math.random() * basicUnits.length)];
          // Check if basic unit is mounted
          if (unitClass && typeof unitClass === 'string') {
            var nameLower = unitClass.toLowerCase();
            isMounted = nameLower.includes('cavalier') || nameLower.includes('cavalry') || 
                        nameLower.includes('horseman') || nameLower.includes('knight') || 
                        nameLower.includes('mounted');
          }
        }
      }
    }
    
    // Calculate resource costs based on unit type (manual training has costs)
    var grain = house.stores.grain || 0;
    var fish = house.stores.fish || 0;
    var iron = house.stores.iron || 0;
    
    // Basic units: 20 food (fish + grain)
    var requiredFood = 20;
    var requiredIron = 0;
    
    if (isMounted) {
      // Mounted units: double food + double iron (40 food + 2×iron)
      requiredFood = 40;
      requiredIron = 20; // Assuming 10 iron per unit, double = 20
    } else if (isElite) {
      // Elite units: food + iron (20 food + iron)
      requiredFood = 20;
      requiredIron = 10;
    }
    // else: Basic units use default (20 food, 0 iron)
    
    // Validate resources before deducting
    var totalFood = grain + fish;
    if (totalFood < requiredFood) {
      throw new Error(`Insufficient food: need ${requiredFood} (grain + fish), have ${totalFood}`);
    }
    if (requiredIron > 0 && iron < requiredIron) {
      throw new Error(`Insufficient iron: need ${requiredIron}, have ${iron || 0}`);
    }
    
    // Deduct resources (manual training costs resources)
    if (fish >= requiredFood) {
      house.stores.fish -= requiredFood;
    } else {
      // Use fish first, then remainder from grain
      var fishUsed = fish;
      var grainNeeded = requiredFood - fishUsed;
      house.stores.fish = 0;
      house.stores.grain -= grainNeeded;
    }
    if (requiredIron > 0) {
      house.stores.iron -= requiredIron;
    }
    
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

class ScoutForResourceGoal extends Goal {
  constructor(resourceType) {
    super('SCOUT_FOR_RESOURCE', 60); // Higher utility than general scouting
    this.resourceCost = {}; // No cost
    this.buildingRequirements = [];
    this.resourceType = resourceType; // 'stone', 'wood', 'grain', etc.
  }
  
  canExecute(house) {
    // Check if resource gap still exists
    if (!house.ai || !house.ai.knowledge) {
      return false;
    }
    
    if (!house.ai.knowledge.identifyResourceGap(this.resourceType)) {
      // Resource gap no longer exists - goal not needed
      this.blockedBy = [{ type: 'RESOURCE_GAP', value: 'resource gap resolved' }];
      return false;
    }
    
    // Check if target zone is known (intersects base radius) - if so, skip scouting requirement
    const targetZone = this.findResourceZone(house);
    if (targetZone && targetZone.id && house.ai.knowledge.isZoneKnown(targetZone.id)) {
      // Zone is known - no scouting needed, goal can execute without units
      return true;
    }
    
    // Zone is unknown - need military units for scouting
    if (!house.ai.getMilitaryUnits) {
      return false;
    }
    
    const militaryUnits = house.ai.getMilitaryUnits();
    if (militaryUnits.length === 0) {
      this.blockedBy = [{ type: 'UNITS', need: 1, have: 0 }];
      return false;
    }
    
    return true;
  }
  
  execute(house) {
    if (!this.canExecute(house)) {
      this.status = 'BLOCKED';
      return;
    }
    
    // Check if AI system exists
    if (!house.ai || !house.ai.deployScoutingParty) {
      this.status = 'FAILED';
      return;
    }
    
    // Find target zone with the required resource
    var targetZone = this.findResourceZone(house);
    
    if (!targetZone) {
      this.status = 'FAILED';
      return;
    }
    
    // Deploy scouting party with resource type as purpose
    var party = house.ai.deployScoutingParty(targetZone, this.resourceType);
    
    if (party) {
      this.status = 'COMPLETED';
    } else {
      this.status = 'FAILED';
    }
  }
  
  // Find a zone that likely has the required resource (must not be a known zone)
  findResourceZone(house) {
    if (!house.ai || !house.ai.knowledge || !global.zoneManager) {
      return null;
    }
    
    const hq = house.hq;
    if (!hq) return null;
    
    const knowledge = house.ai.knowledge;
    
    // Try to find zones with this resource using knowledge system
    // Search in expanding rings from HQ
    const searchRadius = [20, 30, 40, 50]; // tiles
    const mapSize = global.mapSize || 192;
    
    for (const radius of searchRadius) {
      // Check 8 directions (N, NE, E, SE, S, SW, W, NW)
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const targetCol = Math.floor(hq[0] + Math.cos(angle) * radius);
        const targetRow = Math.floor(hq[1] + Math.sin(angle) * radius);
        
        // Clamp to map bounds
        const col = Math.max(0, Math.min(mapSize - 1, targetCol));
        const row = Math.max(0, Math.min(mapSize - 1, targetRow));
        
        // Get zone at this location
        const zone = global.zoneManager.getZoneAt([col, row]);
        if (!zone || !zone.id) continue;
        
        // Skip known zones (zones intersecting HQ radius don't require scouting)
        if (knowledge.isZoneKnown(zone.id)) {
          continue; // Skip this zone, it's known
        }
        
        // Check if zone has the required resource
        if (global.zoneManager.getZoneResourceTypes) {
          const resources = global.zoneManager.getZoneResourceTypes(zone);
          if (knowledge.hasResourceType(resources, this.resourceType)) {
            return zone; // Found unknown zone with resource
          }
        }
      }
    }
    
    // No suitable zone found - return null
    return null;
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
    
    // If targetZone is not provided, try to find a suitable zone for expansion
    if (!this.targetZone && global.zoneManager && house.ai && house.ai.knowledge) {
      this.targetZone = this.findExpansionZone(house);
    }
    
    // Check if target zone is still valid
    if (!this.targetZone) {
      this.blockedBy.push({ type: 'ZONE', value: 'target zone not found' });
      return false;
    }
    
    // Check if zone is known (intersects base radius) - if so, skip scouting requirement
    let isZoneKnown = false;
    if (house.ai && house.ai.knowledge && this.targetZone.id) {
      isZoneKnown = house.ai.knowledge.isZoneKnown(this.targetZone.id);
    }
    
    // Check if guardtower exists at outpost location (REQUIRED before establishing outpost)
    const guardtowerExists = this.checkGuardtowerAtLocation(house);
    if (!guardtowerExists) {
      this.blockedBy.push({ type: 'BUILDING', value: 'guardtower', need: 'guardtower at outpost location' });
      // Guardtower is required - goal cannot execute until it's built
      return false;
    }
    
    // If zone is not known, we need scouting (military units required)
    if (!isZoneKnown) {
      // Check if we have at least 1 military unit for scouting (prefer 3: 1 leader + 2 backup)
      // Use FactionAI.getMilitaryUnits() for consistency (single source of truth)
      let militaryUnits = [];
      if (house.ai && house.ai.getMilitaryUnits) {
        militaryUnits = house.ai.getMilitaryUnits();
      } else {
        // Fallback to local method if AI not available
        militaryUnits = this.getMilitaryUnits(house);
      }
      
      // Exclude units that are already assigned to scouting parties (they're busy)
      const availableUnits = militaryUnits.filter(unit => {
        if (!unit || unit.toRemove) return false;
        // Exclude if assigned to a scouting party
        if (unit.scoutingParty) return false;
        return true;
      });
      
      if (availableUnits.length < 1) {
        const totalUnits = militaryUnits.length;
        const busyUnits = totalUnits - availableUnits.length;
        this.blockedBy.push({ 
          type: 'UNITS', 
          need: 1, 
          have: availableUnits.length,
          totalUnits: totalUnits,
          busyUnits: busyUnits
        });
        
        // Log for debugging
        const factionName = house.name || 'Unknown';
        console.log(`[ESTABLISH_OUTPOST] ${factionName}: No available military units (total: ${totalUnits}, busy: ${busyUnits}, available: ${availableUnits.length})`);
        return false;
      }
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
  
  // Check if guardtower exists at outpost location (within 5 tiles of zone center)
  checkGuardtowerAtLocation(house) {
    if (!this.targetZone || !this.targetZone.center) return false;
    
    const zoneCenter = this.targetZone.center;
    const searchRadius = 5; // tiles
    
    // Get all guardtowers owned by this house
    if (!house.ai || !house.ai.buildingService) return false;
    const buildings = house.ai.buildingService.getBuildings();
    
    for (const building of buildings) {
      if (!building || !building.built || building.type !== 'guardtower') continue;
      if (building.owner !== house.id) continue;
      
      // Check if building is near zone center
      if (building.plot && building.plot.length > 0) {
        const buildingTile = building.plot[0]; // First tile of building
        const distance = Math.sqrt(
          Math.pow(buildingTile[0] - zoneCenter[0], 2) + 
          Math.pow(buildingTile[1] - zoneCenter[1], 2)
        );
        
        if (distance <= searchRadius) {
          return true; // Guardtower found near outpost location
        }
      }
    }
    
    return false; // No guardtower found
  }
  
  execute(house) {
    if (!this.canExecute(house)) {
      this.status = 'BLOCKED';
      return false;
    }
    
    // Check if zone is known (intersects base radius) - if so, skip scouting
    let isZoneKnown = false;
    if (house.ai && house.ai.knowledge && this.targetZone && this.targetZone.id) {
      isZoneKnown = house.ai.knowledge.isZoneKnown(this.targetZone.id);
    }
    
    // If zone is known, skip scouting and proceed directly to outpost planning
    if (isZoneKnown) {
      // Zone is known - plan outpost directly without scouting
      const OutpostPlanner = require('./OutpostPlanner');
      const planner = new OutpostPlanner();
      // Use null resourceType if not specified - planner will handle it
      this.outpostPlan = planner.planOutpost(this.targetZone, this.resourceType || null, house);
      
      if (!this.outpostPlan) {
        this.status = 'FAILED';
        this.blockedBy.push({ type: 'LOCATION', value: 'no suitable outpost location found' });
        return false;
      }
      
      // Start outpost construction
      this.startOutpostConstruction(house);
      return true;
    }
    
    // Zone is unknown - deploy scouting party
    // Use 'terrain_placement' as purpose if resourceType is null (for territory expansion)
    const purpose = this.resourceType || 'terrain_placement';
    this.scoutingParty = house.ai.deployScoutingParty(this.targetZone, purpose);
    
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
    // Use null resourceType if not specified - planner will handle it
    this.outpostPlan = planner.planOutpost(this.targetZone, this.resourceType || null, house);
    
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
  
  // Find a suitable zone for territory expansion (when resourceType is null)
  findExpansionZone(house) {
    if (!global.zoneManager || !house.ai || !house.ai.knowledge) {
      return null;
    }
    
    const hq = house.hq;
    if (!hq) return null;
    
    const knowledge = house.ai.knowledge;
    
    // Search in expanding rings from HQ for zones with suitable terrain (EMPTY terrain)
    const searchRadius = [15, 25, 35, 45]; // tiles
    const mapSize = global.mapSize || 192;
    
    for (const radius of searchRadius) {
      // Check 8 directions (N, NE, E, SE, S, SW, W, NW)
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const targetCol = Math.floor(hq[0] + Math.cos(angle) * radius);
        const targetRow = Math.floor(hq[1] + Math.sin(angle) * radius);
        
        // Clamp to map bounds
        const col = Math.max(0, Math.min(mapSize - 1, targetCol));
        const row = Math.max(0, Math.min(mapSize - 1, targetRow));
        
        // Get zone at this location
        const zone = global.zoneManager.getZoneAt([col, row]);
        if (!zone || !zone.id) continue;
        
        // Skip known zones (zones intersecting HQ radius don't require scouting)
        if (knowledge.isZoneKnown(zone.id)) {
          continue; // Skip this zone, it's known
        }
        
        // For expansion (no specific resource needed), accept any geographic zone
        // The zone will be scouted and an outpost established there
        if (zone.type === 'geographic') {
          return zone; // Found suitable zone for expansion
        }
      }
    }
    
    return null; // No suitable zone found
  }
  
  // Helper: Get military units (fallback method - prefer using house.ai.getMilitaryUnits())
  getMilitaryUnits(house) {
    const militaryUnits = [];
    
    // Use FactionAI method if available (single source of truth)
    if (house.ai && house.ai.getMilitaryUnits) {
      return house.ai.getMilitaryUnits();
    }
    
    // Fallback implementation
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove) continue;
      
      // Check house ownership - handle both house object and house ID
      const playerHouse = player.house;
      if (!playerHouse) continue;
      
      // Handle both cases: player.house is ID or player.house is object
      const playerHouseId = typeof playerHouse === 'object' ? playerHouse.id : playerHouse;
      const houseId = typeof house === 'object' ? house.id : house;
      
      if (playerHouseId !== houseId) continue;
      
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
    const zoneName = this.targetZone ? (this.targetZone.name || 'unknown zone') : 'unknown zone';
    const purpose = this.resourceType || 'territory expansion';
    return `Establish outpost in ${zoneName} for ${purpose}`;
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
    case 'mine': {
      // Default to stone mine when created for stone needs
      // Note: mineType can be overridden by GoalChain when resource needs are known
      return new BuildMineGoal(null, 'any'); // 'any' will be set to 'stone' or 'cave' by GoalChain based on resource needs
    }
    case 'lumbermill': return new BuildLumbermillGoal();
    case 'forge': return new BuildForgeGoal();
    case 'garrison': return new BuildGarrisonGoal();
    case 'guardtower': {
      // Guardtower requires a target location (for outpost)
      // If no location provided, return null (should be created with location)
      return null;
    }
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
  BuildGuardtowerGoal,
  GatherResourceGoal,
  TrainMilitaryGoal,
  DeployScoutGoal,
  ScoutForResourceGoal,
  DefendTerritoryGoal,
  EstablishOutpostGoal,
  AttackEnemyGoal,
  createBuildingGoal
};

