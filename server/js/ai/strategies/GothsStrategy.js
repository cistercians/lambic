// Goths Strategy
// Defensive farming faction with moderate expansion

const FactionStrategy = require('./FactionStrategy');
const {
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
  DefendTerritoryGoal
} = require('../Goals');

class GothsStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    const goals = [];
    
    // Goths love farming (but not as much as Franks)
    const mills = this.countBuildingType('mill');
    const farms = this.countBuildingType('farm');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 3;
    const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 4;
    
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      goals.push(this.modifyGoalUtility(new BuildMillGoal()));
    }
    
    if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
      const farmGoal = new BuildFarmGoal();
      goals.push(this.modifyGoalUtility(farmGoal)); // Gets 1.2x utility
    }
    
    // Stone mines are preferred
    const mines = this.countBuildingType('mine');
    if (mines < 1) {
      const mineGoal = new BuildMineGoal();
      goals.push(this.modifyGoalUtility(mineGoal)); // Gets 1.1x utility
    }
    
    // Lumbermills if forest available
    const knownForest = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('forest')
      : null;
    
    const lumbermills = this.countBuildingType('lumbermill');
    if (knownForest && lumbermills < 1 && this.shouldBuildBuilding('lumbermill')) {
      goals.push(this.modifyGoalUtility(new BuildLumbermillGoal(knownForest)));
    }
    
    return goals;
  }
  
  evaluateDefenseGoals() {
    const goals = [];
    
    // Goths are defensive - prioritize defending territory
    if (this.house.underAttack || this.hasNearbyEnemies()) {
      const defendGoal = new DefendTerritoryGoal();
      defendGoal.utility = 85; // High priority
      goals.push(defendGoal);
    }
    
    return goals;
  }
  
  hasNearbyEnemies() {
    if (!this.house.ai || !this.house.ai.knowledge) return false;
    
    const enemies = this.house.ai.knowledge.getEnemiesInArea(this.house.hq, 15);
    return enemies.length > 0;
  }
}

module.exports = GothsStrategy;

