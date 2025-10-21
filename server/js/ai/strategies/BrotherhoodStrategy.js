// Brotherhood Strategy
// Underground faction - no building goals, focus on military and defense

const FactionStrategy = require('./FactionStrategy');

class BrotherhoodStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    // Brotherhood is underground (z=-1) - cannot build surface buildings
    // Return empty array - no economic goals for now
    return [];
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Future: Could include training goals, scouting, etc.
    // For now, Brotherhood uses existing spawn/update logic
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    // No expansion for underground faction
    return [];
  }
}

module.exports = BrotherhoodStrategy;

