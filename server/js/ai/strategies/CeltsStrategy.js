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
    
    // Celts prioritize mines near caves (faction-specific behavior)
    const knownCaves = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('cave')
      : null;
    
    if (knownCaves) {
      const mineCount = this.countBuildingType('mine');
      if (mineCount < 2) {
        const goal = new BuildMineGoal(knownCaves.location, 'cave'); // Cave mine for ores
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
    
    // Use base class helpers for common patterns
    goals.push(...this.evaluateMillAndFarmGoals());
    goals.push(...this.evaluateForgeGoal());
    
    // Build regular mines (not near caves) if needed
    const mineCount = this.countBuildingType('mine');
    if (mineCount < 2) {
      goals.push(this.modifyGoalUtility(new BuildMineGoal()));
    }
    
    // NEVER build lumbermills (utility is 0 in profile)
    // This is automatically handled by shouldBuildBuilding check
    
    return goals;
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Guerrilla warfare - more scouts (faction-specific: Celts explore more)
    goals.push(...this.evaluateScoutingGoal(150)); // Celts explore more (150 vs 100 default)
    
    // Use base class helpers for common patterns
    goals.push(...this.evaluateGarrisonGoal());
    goals.push(...this.evaluateMilitaryTrainingGoal());
    
    return goals;
  }
}

module.exports = CeltsStrategy;

