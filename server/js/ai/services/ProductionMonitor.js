// Production Monitor Service
// Monitors resource production rates and triggers recovery goals when production is broken

const { RESOURCE_THRESHOLDS, TIME_THRESHOLDS } = require('../AIConstants');
const GoalChain = require('../GoalChain');
const { createBuildingGoal } = require('../Goals');

class ProductionMonitor {
  constructor(factionAI) {
    this.factionAI = factionAI;
    this.house = factionAI.house;
    this.buildingService = factionAI.buildingService;
    this.logger = factionAI.logger;
    
    // State tracking
    this.lastResourceLevels = null;
    this.productionRates = {};
    this.productionIssueDays = {};
  }
  
  // Monitor resource production for the current day
  monitor(currentDay) {
    // Skip production monitoring for non-economic factions
    if (this.factionAI.isNonEconomicFaction()) {
      return;
    }
    
    // Initialize tracking if needed
    if (!this.lastResourceLevels) {
      this.lastResourceLevels = {};
      this.productionRates = {};
    }
    
    const currentLevels = this.getCurrentLevels();
    const productionRates = this.calculateProductionRates(currentLevels);
    
    this.logProductionStatus(currentDay, currentLevels, productionRates);
    
    // Initialize production issue tracking if needed
    if (!this.productionIssueDays) {
      this.productionIssueDays = {};
    }
    
    // Detect production issues and provide diagnostics
    for (const resource in productionRates) {
      if (this.isProductionIssue(productionRates[resource], currentLevels[resource], resource, currentDay)) {
        this.trackProductionIssue(resource, currentDay, productionRates[resource]);
        
        // Provide detailed diagnostics
        this.diagnoseProductionIssue(resource, currentDay);
        
        // Trigger recovery if production broken for threshold days
        if (this.productionIssueDays[resource] >= TIME_THRESHOLDS.PRODUCTION_ISSUE_DAYS) {
          this.triggerRecovery(resource);
        }
      } else {
        // Production is positive, reset issue counter
        this.productionIssueDays[resource] = 0;
      }
    }
    
    // Update last levels
    this.lastResourceLevels = currentLevels;
    this.lastResourceLevels._day = currentDay;
  }
  
  // Get current resource levels
  getCurrentLevels() {
    return {
      wood: this.house.stores.wood || 0,
      stone: this.house.stores.stone || 0,
      grain: this.house.stores.grain || 0,
      ironore: this.house.stores.ironore || 0
    };
  }
  
  // Calculate production rates (change since last day)
  calculateProductionRates(currentLevels) {
    const productionRates = {};
    for (const resource in currentLevels) {
      const lastLevel = this.lastResourceLevels[resource] || currentLevels[resource];
      const change = currentLevels[resource] - lastLevel;
      productionRates[resource] = change;
      this.productionRates[resource] = (this.productionRates[resource] || 0) + change;
    }
    return productionRates;
  }
  
  // Check if production issue exists
  isProductionIssue(productionRate, currentLevel) {
    if (productionRate <= 0 && currentLevel < RESOURCE_THRESHOLDS.PRODUCTION_ISSUE_CHECK) {
      const currentDay = global.day || 1;
      const avgRate = this.productionRates[productionRate] / (currentDay - (this.lastResourceLevels._day || currentDay - 1));
      return avgRate <= 0;
    }
    return false;
  }
  
  // Track production issue for a resource
  trackProductionIssue(resource, currentDay, productionRate) {
    const currentDayActual = global.day || 1;
    const avgRate = this.productionRates[resource] / (currentDayActual - (this.lastResourceLevels._day || currentDayActual - 1));
    
    this.productionIssueDays[resource] = (this.productionIssueDays[resource] || 0) + 1;
    
    const factionName = this.house.name || 'Unknown';
    if (this.logger) {
      this.logger.collectInfo(`Production issue detected: ${resource} (rate: ${productionRate}, avg: ${avgRate.toFixed(2)}, days: ${this.productionIssueDays[resource]})`);
    } else {
      console.warn(`[PRODUCTION] ${factionName}: WARNING - ${resource} production is zero or negative (rate: ${productionRate}, avg: ${avgRate.toFixed(2)}, days with issue: ${this.productionIssueDays[resource]})`);
    }
  }
  
  // Diagnose production issues - identify root cause
  diagnoseProductionIssue(resource, currentDay) {
    const factionName = this.house.name || 'Unknown';
    const buildingType = GoalChain.getResourceBuildingType(resource);
    
    if (!buildingType) {
      if (this.logger) {
        this.logger.collectInfo(`Cannot diagnose ${resource} - no building type defined`);
      } else {
        console.warn(`[PRODUCTION] ${factionName}: Cannot diagnose ${resource} - no building type defined`);
      }
      return;
    }
    
    // Check if building exists
    let buildingCount = 0;
    let builtCount = 0;
    let serfCount = 0;
    const buildings = this.buildingService.getBuildings();
    
    if (resource === 'stone') {
      buildingCount = this.buildingService.getStoneMineCount();
      const stoneMines = this.buildingService.getBuildingsByType('mine').filter(b => b && !b.cave);
      builtCount = stoneMines.filter(b => b.built).length;
      serfCount = stoneMines.reduce((sum, b) => sum + (b.serfs ? Object.keys(b.serfs).length : 0), 0);
    } else if (resource === 'wood') {
      buildingCount = this.buildingService.getBuildingCount('lumbermill');
      const lumbermills = this.buildingService.getBuildingsByType('lumbermill');
      builtCount = lumbermills.filter(b => b && b.built).length;
      serfCount = lumbermills.reduce((sum, b) => sum + (b.serfs ? Object.keys(b.serfs).length : 0), 0);
    } else if (resource === 'grain') {
      buildingCount = this.buildingService.getBuildingCount('farm');
      const farms = this.buildingService.getBuildingsByType('farm');
      builtCount = farms.filter(b => b && b.built).length;
      serfCount = farms.reduce((sum, b) => sum + (b.serfs ? Object.keys(b.serfs).length : 0), 0);
    } else {
      buildingCount = this.buildingService.getBuildingCount(buildingType);
      const buildingsOfType = this.buildingService.getBuildingsByType(buildingType);
      builtCount = buildingsOfType.filter(b => b && b.built).length;
      serfCount = buildingsOfType.reduce((sum, b) => sum + (b.serfs ? Object.keys(b.serfs).length : 0), 0);
    }
    
    // Log diagnostics
    const diagnosticInfo = {
      buildingType,
      buildingCount,
      builtCount,
      serfCount
    };
    
    if (this.logger) {
      this.logger.collectInfo(`Production diagnostics for ${resource}: ${buildingCount} total, ${builtCount} built, ${serfCount} serfs`);
    } else {
      console.log(`[PRODUCTION DIAGNOSTICS] ${factionName} - ${resource} production issue:`);
      console.log(`  Building type: ${buildingType}`);
      console.log(`  Buildings: ${buildingCount} total, ${builtCount} built`);
      console.log(`  Serfs assigned: ${serfCount}`);
    }
    
    // Identify root cause
    let rootCause = null;
    if (buildingCount === 0) {
      rootCause = `No ${buildingType} exists - need to build one`;
    } else if (builtCount === 0) {
      rootCause = `${buildingCount} ${buildingType}(s) exist but none are built`;
    } else if (serfCount === 0) {
      rootCause = `${builtCount} ${buildingType}(s) built but no serfs assigned`;
      // Log which buildings don't have serfs
      this.logSerfIssues(resource, buildingType);
    } else {
      rootCause = 'Buildings and serfs exist but production not working - possible deposit logic issue';
    }
    
    if (rootCause) {
      if (this.logger) {
        this.logger.collectInfo(`Root cause: ${rootCause}`);
      } else {
        console.warn(`  ROOT CAUSE: ${rootCause}`);
      }
    }
  }
  
  // Log serf assignment issues for specific buildings
  logSerfIssues(resource, buildingType) {
    let buildingsOfType = [];
    
    if (resource === 'stone') {
      buildingsOfType = this.buildingService.getBuildingsByType('mine').filter(b => b && !b.cave && b.built);
    } else if (resource === 'wood') {
      buildingsOfType = this.buildingService.getBuildingsByType('lumbermill').filter(b => b && b.built);
    } else if (resource === 'grain') {
      buildingsOfType = this.buildingService.getBuildingsByType('farm').filter(b => b && b.built);
    }
    
    for (const building of buildingsOfType) {
      const serfCount = building.serfs ? Object.keys(building.serfs).length : 0;
      if (serfCount === 0) {
        const message = `${buildingType} at [${building.x}, ${building.y}], z=${building.z} has no serfs assigned`;
        if (this.logger) {
          this.logger.collectInfo(message);
        } else {
          console.warn(`    - ${message}`);
        }
      }
    }
  }
  
  // Log production status
  logProductionStatus(currentDay, currentLevels, productionRates) {
    const factionName = this.house.name || 'Unknown';
    
    // Count production buildings and serfs
    const buildingCounts = {
      mine: this.buildingService.getBuildingCount('mine'),
      lumbermill: this.buildingService.getBuildingCount('lumbermill'),
      mill: this.buildingService.getBuildingCount('mill'),
      farm: this.buildingService.getBuildingCount('farm')
    };
    
    const stoneMines = this.buildingService.getStoneMineCount();
    const caveMines = this.buildingService.getCaveMineCount();
    
    // Count serfs working at buildings
    let serfsAtMines = 0;
    let serfsAtLumbermills = 0;
    const buildings = this.buildingService.getBuildings();
    for (const building of buildings) {
      if (building && building.built) {
        if (building.type === 'mine' && building.serfs) {
          serfsAtMines += Object.keys(building.serfs || {}).length;
        }
        if (building.type === 'lumbermill' && building.serfs) {
          serfsAtLumbermills += Object.keys(building.serfs || {}).length;
        }
      }
    }
    
    if (this.logger) {
      this.logger.collectInfo(`Production status: wood=${currentLevels.wood} (${productionRates.wood >= 0 ? '+' : ''}${productionRates.wood}), stone=${currentLevels.stone} (${productionRates.stone >= 0 ? '+' : ''}${productionRates.stone}), grain=${currentLevels.grain} (${productionRates.grain >= 0 ? '+' : ''}${productionRates.grain})`);
      this.logger.collectInfo(`Buildings: mines=${buildingCounts.mine} (stone=${stoneMines}, cave=${caveMines}), lumbermills=${buildingCounts.lumbermill}, mills=${buildingCounts.mill}, farms=${buildingCounts.farm}`);
      this.logger.collectInfo(`Serfs: mines=${serfsAtMines}, lumbermills=${serfsAtLumbermills}`);
    } else {
      console.log(`[PRODUCTION] ${factionName} (Day ${currentDay}):`);
      console.log(`  Resources: wood=${currentLevels.wood} (${productionRates.wood >= 0 ? '+' : ''}${productionRates.wood}), stone=${currentLevels.stone} (${productionRates.stone >= 0 ? '+' : ''}${productionRates.stone}), grain=${currentLevels.grain} (${productionRates.grain >= 0 ? '+' : ''}${productionRates.grain})`);
      console.log(`  Buildings: mines=${buildingCounts.mine} (stone=${stoneMines}, cave=${caveMines}), lumbermills=${buildingCounts.lumbermill}, mills=${buildingCounts.mill}, farms=${buildingCounts.farm}`);
      console.log(`  Serfs: mines=${serfsAtMines}, lumbermills=${serfsAtLumbermills}`);
    }
  }
  
  // Trigger recovery goals when production is broken
  triggerRecovery(resource) {
    const factionName = this.house.name || 'Unknown';
    const buildingType = GoalChain.getResourceBuildingType(resource);
    
    if (!buildingType) {
      return; // No building type for this resource
    }
    
    // Check if building already exists
    const hasBuilding = GoalChain.hasGatheringBuilding(this.house, resource);
    if (hasBuilding) {
      // Building exists but production broken - this is a serf/deposit issue, not a building issue
      // Don't trigger recovery goal (would just build another building that also won't work)
      const message = `${resource} production broken but ${buildingType} exists - serf/deposit issue, not building issue`;
      if (this.logger) {
        this.logger.collectInfo(message);
      } else {
        console.warn(`[PRODUCTION] ${factionName}: ${message}`);
      }
      return;
    }
    
    // Building doesn't exist - trigger recovery goal
    const recoveryGoal = createBuildingGoal(buildingType);
    if (recoveryGoal) {
      // Set mine type for stone mines
      if (buildingType === 'mine' && resource === 'stone' && recoveryGoal.constructor.name === 'BuildMineGoal') {
        recoveryGoal.mineType = 'stone';
      }
      
      // Increase utility to ensure it's selected (from constants)
      const { UTILITY_THRESHOLDS } = require('../AIConstants');
      recoveryGoal.utility = Math.max(recoveryGoal.utility || UTILITY_THRESHOLDS.HIGH, UTILITY_THRESHOLDS.RECOVERY);
      
      // Mark as recovery goal
      recoveryGoal.isRecoveryGoal = true;
      recoveryGoal.recoveryResource = resource;
      
      const message = `Triggering recovery goal - BUILD_${buildingType.toUpperCase()} for ${resource} (utility: ${recoveryGoal.utility})`;
      if (this.logger) {
        this.logger.collectInfo(message);
      } else {
        console.log(`[PRODUCTION] ${factionName}: ${message}`);
      }
      
      // Store recovery goal to be considered in next evaluation
      if (!this.factionAI._pendingRecoveryGoals) {
        this.factionAI._pendingRecoveryGoals = [];
      }
      this.factionAI._pendingRecoveryGoals.push(recoveryGoal);
    }
  }
  
  // Get production issue days for a resource (for external access)
  getProductionIssueDays(resource) {
    return this.productionIssueDays[resource] || 0;
  }
}

module.exports = ProductionMonitor;

