// Franks Strategy
// Farming experts, balanced military

const FactionStrategy = require('./FactionStrategy');
const {
  BuildMillGoal,
  BuildFarmGoal,
  BuildLumbermillGoal,
  BuildMineGoal
} = require('../Goals');

class FranksStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    const goals = [];
    
    // Franks are farming masters
    const mills = this.countBuildingType('mill');
    const farms = this.countBuildingType('farm');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 4;
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 5;
    
    // Build mills first
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      const millGoal = new BuildMillGoal();
      goals.push(this.modifyGoalUtility(millGoal)); // Gets 1.3x utility
    }
    
    // Then build farms (lots of them!)
    if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      const farmGoal = new BuildFarmGoal();
      goals.push(this.modifyGoalUtility(farmGoal)); // Gets 1.5x utility
    }
    
    // Secondary priority: lumbermills if forest available
    const knownForest = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('forest')
      : null;
    
    const lumbermills = this.countBuildingType('lumbermill');
    if (knownForest && lumbermills < 2 && this.shouldBuildBuilding('lumbermill')) {
      goals.push(this.modifyGoalUtility(new BuildLumbermillGoal(knownForest)));
    }
    
    // Mines if needed
    const mines = this.countBuildingType('mine');
    if (mines < 1) {
      goals.push(this.modifyGoalUtility(new BuildMineGoal()));
    }
    
    return goals;
  }
}

module.exports = FranksStrategy;

