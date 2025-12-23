// Goal Executor
// Handles goal execution logic, separate from chain management

class GoalExecutor {
  constructor(house, factionAI) {
    this.house = house;
    this.factionAI = factionAI;
  }
  
  // Format error message with consistent structure
  formatError(faction, goalType, step, message, details = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      faction: faction || 'unknown',
      goalType: goalType || 'unknown',
      step: step !== undefined ? step : null,
      message,
      details
    };
  }
  
  // Execute current goal in the chain
  executeGoal(goal, goalChain, logger = null) {
    const step = goalChain ? goalChain.currentStep : null;
    
    if (!goal) {
      const error = this.formatError(
        this.house.name,
        'none',
        step,
        'Goal chain has no current goal'
      );
      console.warn(`[GoalExecutor] [${error.timestamp}] [${error.faction}] [step ${error.step}] ${error.message}`);
      
      if (logger) {
        logger.collectError('Goal chain has no current goal', null);
      }
      
      return { success: false, shouldAdvance: false, shouldClearChain: true };
    }
    
    // Check if goal can execute
    if (goal.canExecute(this.house)) {
      return this.executeExecutableGoal(goal, goalChain, logger);
    } else {
      return this.handleBlockedGoal(goal, goalChain, logger);
    }
  }
  
  // Execute a goal that can be executed
  executeExecutableGoal(goal, goalChain, logger = null) {
    const step = goalChain ? goalChain.currentStep : null;
    
    try {
      goal.execute(this.house);
      goal.status = 'COMPLETED';
      
      if (logger) {
        const costSummary = Object.entries(goal.resourceCost).map(([res, amt]) => `${amt} ${res}`).join(', ');
        logger.collectAction(`${goal.type} completed`, {
          reasoning: costSummary ? `Cost: ${costSummary}` : 'No cost',
          goal: goal.type,
          status: 'COMPLETED'
        });
      }
      
      return { success: true, shouldAdvance: true, shouldClearChain: false };
    } catch (error) {
      const errorObj = this.formatError(
        this.house.name,
        goal.type,
        step,
        `Error executing goal: ${error.message || String(error)}`,
        { stack: error.stack }
      );
      console.error(`[GoalExecutor] [${errorObj.timestamp}] [${errorObj.faction}] [${errorObj.goalType}] [step ${errorObj.step}] ${errorObj.message}`);
      if (error.stack) {
        console.error(error.stack);
      }
      
      if (logger) {
        logger.logError(`Error executing goal: ${goal.type}`, error, {
          goal: goal.type,
          step: step,
          resourceCost: goal.resourceCost
        });
      }
      
      goal.status = 'FAILED';
      goal.error = errorObj;
      return { success: false, shouldAdvance: false, shouldClearChain: false };
    }
  }
  
  // Handle a goal that is blocked
  handleBlockedGoal(goal, goalChain, logger = null) {
    const step = goalChain ? goalChain.currentStep : null;
    goal.status = 'BLOCKED';
    const blocking = goal.getBlockingFactors(this.house);
    
    // GATHER_RESOURCE goals are passive waiting goals - check if complete
    if (goal.type === 'GATHER_RESOURCE') {
      goal.execute(this.house); // Updates status based on current resources
      if (goal.status === 'COMPLETED') {
      if (logger) {
        logger.collectAction(`${goal.type} completed`, {
          reasoning: 'Resources gathered',
          goal: goal.type,
          status: 'COMPLETED'
        });
      }
        return { success: true, shouldAdvance: true, shouldClearChain: false };
      }
      // If still IN_PROGRESS, wait for next day
      return { success: false, shouldAdvance: false, shouldClearChain: false };
    }
    
    // For other goals: if blocked, GoalChain should have resolved dependencies
    // If we're here, either:
    // 1. Chain resolution failed (shouldn't happen)
    // 2. Resources/buildings were removed after chain creation
    // 3. Something else went wrong
    
    // Log detailed blocking information
    const resourceBlocks = blocking.filter(b => b.type === 'RESOURCE');
    const buildingBlocks = blocking.filter(b => b.type === 'BUILDING');
    
    const errorObj = this.formatError(
      this.house.name,
      goal.type,
      step,
      'Goal blocked - GoalChain should have resolved dependencies',
      {
        resourceBlocks: resourceBlocks.map(b => ({
          resource: b.resource,
          need: b.need,
          have: b.have
        })),
        buildingBlocks: buildingBlocks.map(b => b.value)
      }
    );
    
    console.warn(`[GoalExecutor] [${errorObj.timestamp}] [${errorObj.faction}] [${errorObj.goalType}] [step ${errorObj.step}] ${errorObj.message}`, errorObj.details);
    
    if (logger) {
      const blockingSummary = [
        ...resourceBlocks.map(b => `need ${b.resource} (have ${b.have}, need ${b.need})`),
        ...buildingBlocks.map(b => `need ${b.value}`)
      ].join(', ');
      logger.collectError(`Goal blocked: ${goal.type}`, null, {
        reasoning: blockingSummary
      });
    }
    
    // Mark chain as failed - will create new chain on next evaluation
    goal.status = 'FAILED';
    goal.error = errorObj;
    
    return { success: false, shouldAdvance: false, shouldClearChain: false };
  }
}

module.exports = GoalExecutor;


