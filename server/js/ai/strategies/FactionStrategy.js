// Base Faction Strategy
// Parent class for all faction-specific strategies

const { 
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
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
    
    // Check if we need mills
    const mills = this.countBuildingType('mill');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 2;
    
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      goals.push(this.modifyGoalUtility(new BuildMillGoal()));
    }
    
    // Check if we need farms
    const farms = this.countBuildingType('farm');
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 3;
    
    if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      goals.push(this.modifyGoalUtility(new BuildFarmGoal()));
    }
    
    return goals;
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Check if we need garrison
    const garrison = this.countBuildingType('garrison');
    if (garrison === 0 && this.shouldBuildBuilding('garrison')) {
      goals.push(this.modifyGoalUtility(new BuildGarrisonGoal()));
    }
    
    // Check if we need more military units
    const militarySize = this.house.military.units.i + this.house.military.units.ii;
    const desiredSize = this.profile.desiredMilitarySize || 8;
    
    if (militarySize < desiredSize && garrison > 0) {
      goals.push(this.modifyGoalUtility(new TrainMilitaryGoal()));
    }
    
    // Check if we need scouting
    if (this.house.ai && this.house.ai.knowledge) {
      const exploredTiles = this.house.ai.knowledge.exploredTiles.size;
      if (exploredTiles < 100) {
        goals.push(this.modifyGoalUtility(new DeployScoutGoal()));
      }
    }
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    const goals = [];
    
    // Check if territory is full
    if (this.house.ai && this.house.ai.territory) {
      if (this.house.ai.territory.isTerritoryFull()) {
        const outpostLoc = this.house.ai.territory.findOutpostLocation();
        if (outpostLoc) {
          goals.push(this.modifyGoalUtility(new EstablishOutpostGoal(outpostLoc)));
        }
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
  
  // Helper: count building types
  countBuildingType(type) {
    let count = 0;
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.type === type) {
          count++;
        }
      }
    }
    
    return count;
  }
}

module.exports = FactionStrategy;

