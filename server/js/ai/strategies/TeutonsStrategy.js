// Teutons Strategy
// Aggressive military-focused faction, prioritizes garrisons, mines, and lumbermills

const FactionStrategy = require('./FactionStrategy');
const {
  BuildGarrisonGoal,
  BuildMineGoal,
  BuildLumbermillGoal,
  BuildMillGoal,
  TrainMilitaryGoal,
  AttackEnemyGoal
} = require('../Goals');

class TeutonsStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    const goals = [];
    const logger = this.getLogger();
    
    // Teutons prioritize resource gathering buildings FIRST to improve deposit efficiency
    // Then military infrastructure (garrisons require resources to train units)
    
    // Heavy focus on mines and lumbermills (resource gathering)
    const mines = this.countBuildingType('mine');
    const lumbermills = this.countBuildingType('lumbermill');
    
    // Prioritize resource gathering buildings before military
    if (mines < 2) {
      const mineGoal = new BuildMineGoal();
      goals.push(this.modifyGoalUtility(mineGoal)); // Gets 1.2x utility
    }
    
    // Check for known forest locations
    const knownForest = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('forest')
      : null;
    
    if (lumbermills < 2 && this.shouldBuildBuilding('lumbermill')) {
      const lumbermillGoal = new BuildLumbermillGoal(knownForest);
      goals.push(this.modifyGoalUtility(lumbermillGoal)); // Gets 1.2x utility
    }
    
    // Basic farming (ensure food production for military)
    const mills = this.countBuildingType('mill');
    const maxMills = this.profile.buildingPreferences.mill.maxCount || 2;
    
    if (mills < maxMills && this.shouldBuildBuilding('mill')) {
      goals.push(this.modifyGoalUtility(new BuildMillGoal()));
    }
    
    // Teutons prioritize garrisons and military infrastructure (after resource buildings)
    const garrisons = this.countBuildingType('garrison');
    // Only build garrison if we have resource gathering capacity
    if (garrisons === 0 && (mines > 0 || lumbermills > 0)) {
      const garrisonGoal = new BuildGarrisonGoal();
      goals.push(this.modifyGoalUtility(garrisonGoal)); // Gets 1.3x utility
    }
    
    if (logger && garrisons === 0 && mines === 0 && lumbermills === 0) {
      logger.collectInfo('Teutons: Delaying garrison until resource gathering buildings are established');
    }
    
    return goals;
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Aggressive expansion - build military early and often
    const militarySize = this.house.military.units.i + this.house.military.units.ii;
    const desiredSize = this.profile.desiredMilitarySize || 15;
    
    const garrison = this.countBuildingType('garrison');
    
    if (militarySize < desiredSize && garrison > 0) {
      const trainGoal = new TrainMilitaryGoal();
      goals.push(this.modifyGoalUtility(trainGoal)); // Gets 1.4x utility
    }
    
    // Actively seek enemies to attack
    if (this.house.ai && this.house.ai.knowledge) {
      const knownEnemies = Array.from(this.house.ai.knowledge.knownEnemies.values());
      if (knownEnemies.length > 0 && militarySize >= 8) {
        const attackGoal = new AttackEnemyGoal(knownEnemies[0]);
        goals.push(this.modifyGoalUtility(attackGoal)); // Gets 1.5x utility!
      }
    }
    
    return goals;
  }
}

module.exports = TeutonsStrategy;

