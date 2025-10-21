// Outlaws Strategy
// Strategy not finalized yet - no building goals

const FactionStrategy = require('./FactionStrategy');

class OutlawsStrategy extends FactionStrategy {
  evaluateEconomicGoals() {
    // Outlaws strategy not finalized - no building goals for now
    return [];
  }
  
  evaluateMilitaryGoals() {
    const goals = [];
    
    // Future: Raiding, ambushing, opportunistic warfare
    // For now, uses existing logic
    
    return goals;
  }
  
  evaluateExpansionGoals() {
    // Future: Mobile camps, temporary outposts
    return [];
  }
}

module.exports = OutlawsStrategy;

