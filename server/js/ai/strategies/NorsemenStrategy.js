// Norsemen Strategy
// Temporary raiding faction - spawns at coast, raids inland, then despawns

const FactionStrategy = require('./FactionStrategy');

class NorsemenStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    // Norsemen don't build - they're temporary raiders
    // They spawn → raid → despawn periodically
    return [];
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Future: Raiding behavior
    // - Launch raid inland
    // - Attack any enemies encountered
    // - Return to coast after X time
    // - Despawn when returned
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    // No expansion - temporary faction
    return [];
  }
}

module.exports = NorsemenStrategy;

