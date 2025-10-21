// Celts Strategy
// Mining-focused, never builds lumbermills, guerrilla warfare

const FactionStrategy = require('./FactionStrategy');
const {
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  DeployScoutGoal,
  TrainMilitaryGoal
} = require('../Goals');

class CeltsStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    const goals = [];
    
    // Celts prioritize mines near caves
    const knownCaves = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('cave')
      : null;
    
    if (knownCaves) {
      const mineCount = this.countBuildingType('mine');
      if (mineCount < 2) {
        const goal = new BuildMineGoal(knownCaves);
        goals.push(this.modifyGoalUtility(goal)); // Gets 1.5x utility
      }
    } else {
      // Need to scout for caves if we don't know of any
      if (this.house.ai && this.house.ai.knowledge) {
        const scoutGoal = new DeployScoutGoal();
        scoutGoal.utility = 40; // High priority for Celts
        goals.push(this.modifyGoalUtility(scoutGoal));
      }
    }
    
    // NEVER build lumbermills (utility is 0 in profile)
    // This is automatically handled by shouldBuildBuilding check
    
    // Modest farming
    const mills = this.countBuildingType('mill');
    const farms = this.countBuildingType('farm');
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 3;
    
    if (mills === 0 && this.shouldBuildBuilding('mill')) {
      goals.push(this.modifyGoalUtility(new BuildMillGoal()));
    } else if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      goals.push(this.modifyGoalUtility(new BuildFarmGoal()));
    }
    
    // Build regular mines (not near caves) if needed
    const mineCount = this.countBuildingType('mine');
    if (mineCount < 2) {
      goals.push(this.modifyGoalUtility(new BuildMineGoal()));
    }
    
    return goals;
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Guerrilla warfare - more scouts, balanced units
    if (this.house.ai && this.house.ai.knowledge) {
      const exploredTiles = this.house.ai.knowledge.exploredTiles.size;
      if (exploredTiles < 150) { // Celts explore more
        const scoutGoal = new DeployScoutGoal();
        goals.push(this.modifyGoalUtility(scoutGoal)); // Gets 1.3x utility
      }
    }
    
    // Check garrison
    const garrison = this.countBuildingType('garrison');
    if (garrison === 0 && this.shouldBuildBuilding('garrison')) {
      const garrisonGoal = require('../Goals').BuildGarrisonGoal;
      goals.push(this.modifyGoalUtility(new garrisonGoal()));
    }
    
    // Train military (balanced infantry/ranged)
    const militarySize = this.house.military.units.i + this.house.military.units.ii;
    const desiredSize = this.profile.desiredMilitarySize || 12;
    
    if (militarySize < desiredSize && garrison > 0) {
      const trainGoal = new TrainMilitaryGoal();
      goals.push(this.modifyGoalUtility(trainGoal)); // Gets 1.2x utility
    }
    
    return goals;
  }
}

module.exports = CeltsStrategy;

