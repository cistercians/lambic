// Mercenaries Strategy
// Underground faction - no building goals

const FactionStrategy = require('./FactionStrategy');

class MercenariesStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    // Mercenaries are underground (z=-1) - cannot build surface buildings
    return [];
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Future: Could include mercenary-specific goals
    // - Contract evaluation
    // - Opportunistic raiding
    // - Resource trading
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    // No expansion for underground faction
    return [];
  }
}

module.exports = MercenariesStrategy;

