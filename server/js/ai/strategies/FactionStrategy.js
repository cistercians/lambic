// Base Faction Strategy
// Parent class for all faction-specific strategies

const { 
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
  BuildForgeGoal,
  BuildGarrisonGoal,
  TrainMilitaryGoal,
  DeployScoutGoal,
  DefendTerritoryGoal,
  EstablishOutpostGoal
} = require('../Goals');

class FactionStrategy {
  constructor(house, profile) {
    this.house = house;
    this.profile = profile;
  }
  
  // Each faction can override these methods
  evaluateEconomicGoals() {
    // Default implementation
    const goals = [];
    const logger = this.getLogger();
    
    // Check if we need mills
    const mills = this.countBuildingType('mill');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 2;
    
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      const goal = new BuildMillGoal();
      const baseUtility = goal.utility;
      const modifiedGoal = this.modifyGoalUtility(goal);
      
      if (logger) {
        logger.collectDecision('ECONOMIC_GOAL', `Consider BUILD_MILL (utility: ${modifiedGoal.utility})`, {
          buildingType: 'mill',
          goal: 'BUILD_MILL',
          utility: modifiedGoal.utility,
          reasoning: `Need more mills (${mills}/${maxMills})`
        });
      }
      
      goals.push(modifiedGoal);
    }
    
    // Check if we need farms
    const farms = this.countBuildingType('farm');
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 3;
    
    if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      const goal = new BuildFarmGoal();
      const baseUtility = goal.utility;
      const modifiedGoal = this.modifyGoalUtility(goal);
      
      if (logger) {
        logger.logDecision('ECONOMIC_GOAL', `Consider BUILD_FARM (utility: ${modifiedGoal.utility})`, {
          buildingType: 'farm',
          reasoning: `Need more farms (${farms} farms for ${mills} mills, target ${farmsPerMill} per mill)`
        });
      }
      
      goals.push(modifiedGoal);
    }
    
    // Check if we need forge
    const forges = this.countBuildingType('forge');
    if (forges === 0 && this.shouldBuildBuilding('forge')) {
      const goal = new BuildForgeGoal();
      const baseUtility = goal.utility;
      const modifiedGoal = this.modifyGoalUtility(goal);
      
      if (logger) {
        logger.collectDecision('ECONOMIC_GOAL', `Consider BUILD_FORGE (utility: ${modifiedGoal.utility})`, {
          buildingType: 'forge',
          goal: 'BUILD_FORGE',
          utility: modifiedGoal.utility,
          reasoning: 'No forge exists'
        });
      }
      
      goals.push(modifiedGoal);
    }
    
    return goals;
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    const logger = this.getLogger();
    
    // Check if we need garrison
    const garrison = this.countBuildingType('garrison');
    if (garrison === 0 && this.shouldBuildBuilding('garrison')) {
      const garrisonGoal = new BuildGarrisonGoal();
      const baseUtility = garrisonGoal.utility;
      
      // Boost priority if forge already exists (prerequisite met)
      // This ensures garrison is prioritized over economic goals once forge is built
      const forges = this.countBuildingType('forge');
      let utilityBoost = 0;
      let boostReasoning = '';
      
      if (forges > 0) {
        // Forge exists - boost garrison utility significantly to prioritize it
        // Base utility is 50, so we multiply by 1.5x (75) and add 25 for a total of 100
        // This ensures garrison beats most economic goals once the prerequisite is met
        garrisonGoal.utility *= 1.5; // Boost by 50%
        garrisonGoal.utility += 25; // Additional flat bonus to ensure priority
        utilityBoost = garrisonGoal.utility - baseUtility;
        boostReasoning = 'Forge exists - boosting priority';
      }
      
      const modifiedGoal = this.modifyGoalUtility(garrisonGoal);
      
      if (logger) {
        logger.collectDecision('MILITARY_GOAL', `Consider BUILD_GARRISON (utility: ${modifiedGoal.utility})`, {
          buildingType: 'garrison',
          goal: 'BUILD_GARRISON',
          utility: modifiedGoal.utility,
          reasoning: `No garrison exists${forges > 0 ? ' and forge prerequisite met' : ''}`
        });
      }
      
      goals.push(modifiedGoal);
    }
    
    // Check if we need more military units
    const militarySize = this.house.military ? (this.house.military.units.i + this.house.military.units.ii) : 0;
    const desiredSize = this.profile.desiredMilitarySize || 8;
    
    if (militarySize < desiredSize && garrison > 0) {
      const goal = new TrainMilitaryGoal();
      const baseUtility = goal.utility;
      const modifiedGoal = this.modifyGoalUtility(goal);
      
      if (logger) {
        logger.logDecision('MILITARY_GOAL', `Consider TRAIN_MILITARY (utility: ${modifiedGoal.utility})`, {
          goal: 'TRAIN_MILITARY',
          utility: modifiedGoal.utility,
          reasoning: `Need more military units (${militarySize}/${desiredSize}) and garrison exists`
        });
      }
      
      goals.push(modifiedGoal);
    }
    
    // Check if we need scouting
    if (this.house.ai && this.house.ai.knowledge) {
      const exploredTiles = this.house.ai.knowledge.exploredTiles.size;
      if (exploredTiles < 100) {
        const goal = new DeployScoutGoal();
        const baseUtility = goal.utility;
        const modifiedGoal = this.modifyGoalUtility(goal);
        
        if (logger) {
          logger.collectDecision('MILITARY_GOAL', `Consider DEPLOY_SCOUT (utility: ${modifiedGoal.utility})`, {
            goal: 'DEPLOY_SCOUT',
            utility: modifiedGoal.utility,
            reasoning: `Need more exploration (${exploredTiles} tiles explored, target 100)`
          });
        }
        
        goals.push(modifiedGoal);
      }
    }
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    const goals = [];
    const logger = this.getLogger();
    
    // Check if territory is full
    if (this.house.ai && this.house.ai.territory) {
      if (this.house.ai.territory.isTerritoryFull()) {
        const outpostLoc = this.house.ai.territory.findOutpostLocation();
        if (outpostLoc) {
          const goal = new EstablishOutpostGoal(outpostLoc);
          const modifiedGoal = this.modifyGoalUtility(goal);
          
          if (logger) {
            logger.collectDecision('EXPANSION_GOAL', `Consider ESTABLISH_OUTPOST (utility: ${modifiedGoal.utility})`, {
              goal: 'ESTABLISH_OUTPOST',
              utility: modifiedGoal.utility,
              reasoning: 'Territory is full, found suitable outpost location'
            });
          }
          
          goals.push(modifiedGoal);
        }
      }
    }
    
    return goals;
  }
  
  // Evaluate resource scouting goals (check for resource gaps)
  evaluateResourceScoutingGoals() {
    const goals = [];
    const logger = this.getLogger();
    
    if (!this.house.ai || !this.house.ai.knowledge) {
      return goals;
    }
    
    // Check critical resources for gaps
    const criticalResources = ['stone', 'wood', 'grain'];
    
    for (const resourceType of criticalResources) {
      // Check if resource gap exists
      if (this.house.ai.knowledge.identifyResourceGap(resourceType)) {
        const { ScoutForResourceGoal } = require('../Goals');
        const scoutGoal = new ScoutForResourceGoal(resourceType);
        const modifiedGoal = this.modifyGoalUtility(scoutGoal);
        
        if (logger) {
          logger.collectDecision('RESOURCE_SCOUTING_GOAL', `Consider SCOUT_FOR_RESOURCE (${resourceType}, utility: ${modifiedGoal.utility})`, {
            goal: 'SCOUT_FOR_RESOURCE',
            resourceType: resourceType,
            utility: modifiedGoal.utility,
            reasoning: `Resource gap detected for ${resourceType}`
          });
        }
        
        goals.push(modifiedGoal);
      }
    }
    
    return goals;
  }
  
  evaluateDefenseGoals() {
    const goals = [];
    
    // Check if under attack
    if (this.house.underAttack) {
      goals.push(this.modifyGoalUtility(new DefendTerritoryGoal()));
    }
    
    return goals;
  }
  
  // Check if faction should build a building type
  shouldBuildBuilding(buildingType) {
    const pref = this.profile.buildingPreferences[buildingType];
    return pref && pref.utility > 0;
  }
  
  // Get utility value for a building type
  getBuildingUtility(buildingType) {
    const pref = this.profile.buildingPreferences[buildingType];
    return pref ? pref.utility : 0;
  }
  
  // Apply faction-specific utility modifier to a goal
  modifyGoalUtility(goal) {
    const modifier = this.profile.utilityModifiers[goal.type] || 1.0;
    goal.utility *= modifier;
    return goal;
  }
  
  // Helper: count building types (always uses BuildingService)
  countBuildingType(type) {
    // Ensure BuildingService exists (create if missing)
    if (!this.house.ai) {
      // No AI system - this shouldn't happen in normal operation
      return 0;
    }
    
    if (!this.house.ai.buildingService) {
      // Create BuildingService if missing
      const BuildingService = require('../BuildingService');
      this.house.ai.buildingService = new BuildingService(this.house);
    }
    
    // Single path: always use BuildingService
    return this.house.ai.buildingService.getBuildingCount(type);
  }
  
  // Helper: evaluate mill and farm goals (common pattern)
  evaluateMillAndFarmGoals() {
    const goals = [];
    const mills = this.countBuildingType('mill');
    const farms = this.countBuildingType('farm');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 2;
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 3;
    
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      goals.push(this.modifyGoalUtility(new BuildMillGoal()));
    }
    
    if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      goals.push(this.modifyGoalUtility(new BuildFarmGoal()));
    }
    
    return goals;
  }
  
  // Helper: evaluate forge goal (common pattern)
  evaluateForgeGoal() {
    const goals = [];
    const forges = this.countBuildingType('forge');
    if (forges === 0 && this.shouldBuildBuilding('forge')) {
      goals.push(this.modifyGoalUtility(new BuildForgeGoal()));
    }
    return goals;
  }
  
  // Helper: evaluate garrison goal with forge boost (common pattern)
  evaluateGarrisonGoal() {
    const goals = [];
    const garrison = this.countBuildingType('garrison');
    if (garrison === 0 && this.shouldBuildBuilding('garrison')) {
      const garrisonGoal = new BuildGarrisonGoal();
      
      // Boost priority if forge already exists (prerequisite met)
      const forges = this.countBuildingType('forge');
      if (forges > 0) {
        garrisonGoal.utility *= 1.5;
        garrisonGoal.utility += 25;
      }
      
      goals.push(this.modifyGoalUtility(garrisonGoal));
    }
    return goals;
  }
  
  // Helper: evaluate military training goal (common pattern)
  evaluateMilitaryTrainingGoal() {
    const goals = [];
    const garrison = this.countBuildingType('garrison');
    const militarySize = this.house.military ? (this.house.military.units.i + this.house.military.units.ii) : 0;
    const desiredSize = this.profile.desiredMilitarySize || 8;
    
    if (militarySize < desiredSize && garrison > 0) {
      goals.push(this.modifyGoalUtility(new TrainMilitaryGoal()));
    }
    return goals;
  }
  
  // Helper: evaluate scouting goal (common pattern)
  evaluateScoutingGoal(minExploredTiles = 100) {
    const goals = [];
    if (this.house.ai && this.house.ai.knowledge) {
      const exploredTiles = this.house.ai.knowledge.exploredTiles.size;
      if (exploredTiles < minExploredTiles) {
        goals.push(this.modifyGoalUtility(new DeployScoutGoal()));
      }
    }
    return goals;
  }
  
  // Helper: get logger from house.ai if available
  getLogger() {
    if (this.house.ai && this.house.ai.logger) {
      return this.house.ai.logger;
    }
    return null;
  }
}

module.exports = FactionStrategy;

