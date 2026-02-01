// Celts Strategy
// Mining-focused, never builds lumbermills, guerrilla warfare

const FactionStrategy = require('./FactionStrategy');
const {
  BuildMillGoal,
  BuildFarmGoal,
  BuildMineGoal,
  DeployScoutGoal,
  TrainMilitaryGoal,
  EstablishOutpostGoal
} = require('../Goals');

class CeltsStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    const goals = [];
    const logger = this.getLogger();
    
    // Celts prioritize mines near caves (faction-specific behavior)
    // But adapt to location blocking by prioritizing scouting/expansion
    const knownCaves = this.house.ai && this.house.ai.knowledge
      ? this.house.ai.knowledge.getBestResourceLocation('cave')
      : null;
    
    // Check for recent goal failures - if location blocking is common, prioritize expansion
    const recentFailures = this.house.ai && this.house.ai.goalFailureHistory
      ? Array.from(this.house.ai.goalFailureHistory.entries())
          .filter(([goalType, history]) => {
            const locationBlocks = history.locationBlockCount || 0;
            return locationBlocks >= 2; // Has location blocking issues
          })
      : [];
    
    if (recentFailures.length > 0 && this.house.ai) {
      // Location blocking detected - prioritize expansion/scouting
      const expansionGoal = new EstablishOutpostGoal(null, null);
      expansionGoal.utility = 50; // High priority when location blocked
      goals.push(this.modifyGoalUtility(expansionGoal));
      
      if (logger) {
        logger.collectInfo(`Celts: Prioritizing expansion due to ${recentFailures.length} goals with location blocking`);
      }
    }
    
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

