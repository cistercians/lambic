// Goal Chain System
// Handles multi-step goal execution by resolving dependencies

const { GatherResourceGoal, createBuildingGoal } = require('./Goals');

class GoalChain {
  constructor(mainGoal) {
    this.mainGoal = mainGoal;
    this.steps = [];
    this.currentStep = 0;
  }
  
  // Convert a blocked goal into a chain of achievable subgoals
  static create(house, goal) {
    const chain = new GoalChain(goal);
    const visited = new Set();
    
    function resolveGoal(g, depth = 0) {
      // Prevent infinite recursion
      if (depth > 10) {
        console.warn(`GoalChain: Max recursion depth reached for ${g.type}`);
        return;
      }
      
      // Prevent cycles
      if (visited.has(g.type)) {
        return;
      }
      visited.add(g.type);
      
      // If goal can execute, add it directly
      if (g.canExecute(house)) {
        chain.steps.push(g);
        return;
      }
      
      // Recursively resolve blocking factors
      const blocking = g.getBlockingFactors(house);
      
      for (const block of blocking) {
        if (block.type === 'BUILDING') {
          // Need to build something first
          const buildGoal = createBuildingGoal(block.value);
          resolveGoal(buildGoal, depth + 1); // Recursive
        } else if (block.type === 'RESOURCE') {
          // Need to gather resources
          const deficit = block.need - block.have;
          chain.steps.push(new GatherResourceGoal(block.resource, deficit));
        }
      }
      
      // Finally add the main goal
      chain.steps.push(g);
    }
    
    resolveGoal(goal);
    
    // Remove duplicates (keep last occurrence)
    chain.steps = chain.removeDuplicates(chain.steps);
    
    return chain;
  }
  
  // Remove duplicate goals, keeping the last occurrence
  removeDuplicates(steps) {
    const seen = new Map();
    const result = [];
    
    // Go through steps and track last index of each type
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const key = step.type;
      seen.set(key, i);
    }
    
    // Only keep steps at their last occurrence
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const key = step.type;
      if (seen.get(key) === i) {
        result.push(step);
      }
    }
    
    return result;
  }
  
  // Get current goal to execute
  getCurrentGoal() {
    if (this.currentStep < this.steps.length) {
      return this.steps[this.currentStep];
    }
    return null;
  }
  
  // Advance to next goal in chain
  advance() {
    this.currentStep++;
    return this.currentStep < this.steps.length;
  }
  
  // Check if chain is complete
  isComplete() {
    return this.currentStep >= this.steps.length;
  }
  
  // Get remaining steps
  getRemainingSteps() {
    return this.steps.slice(this.currentStep);
  }
  
  // Get progress (0-1)
  getProgress() {
    if (this.steps.length === 0) return 1;
    return this.currentStep / this.steps.length;
  }
  
  // Get summary of chain
  getSummary() {
    return {
      mainGoal: this.mainGoal.type,
      totalSteps: this.steps.length,
      currentStep: this.currentStep,
      progress: this.getProgress(),
      remaining: this.getRemainingSteps().map(s => s.type)
    };
  }
}

module.exports = GoalChain;

/*
Example usage:

Goal: Train Military
Blocked by: Need garrison
Chain: [BuildGarrison, GatherGrain, TrainMilitary]

BuildGarrison blocked by resources:
Chain: [GatherWood(50), GatherStone(30), BuildGarrison, GatherGrain(10), TrainMilitary]

The system automatically resolves all dependencies recursively.
*/

