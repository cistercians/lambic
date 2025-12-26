// Goal Chain System
// Handles multi-step goal execution by resolving dependencies

const { GatherResourceGoal, createBuildingGoal } = require('./Goals');

class GoalChain {
  constructor(mainGoal) {
    this.mainGoal = mainGoal;
    this.steps = [];
    this.currentStep = 0;
    this.failureReason = null; // Track why chain failed
    this.blockingFactors = []; // Track blocking factors at failure
  }
  
  // Convert a blocked goal into a chain of achievable subgoals
  // Iterative queue-based approach for better traceability and debugging
  static create(house, goal, logger = null) {
    const chain = new GoalChain(goal);
    const errors = [];
    const resolutionPath = []; // Track dependency resolution path for debugging
    
    // Collect chain creation start
    if (logger) {
      logger.collectInfo(`Resolving dependencies for ${goal.type}`);
    }
    
    // Queue of goals to process: {goal, parent, depth, reason}
    const queue = [{ goal, parent: null, depth: 0, reason: 'main goal' }];
    
    // Track visited goals with context to prevent cycles
    // Key: goal type + blocking context (e.g., "BUILD_GARRISON:needs-forge")
    const visited = new Map();
    
    // Track blocking factors cache to avoid redundant canExecute() calls
    const blockingCache = new Map();
    
    // Track goals that are blocked and waiting for dependencies
    // Map: goal -> array of dependency goal types it's waiting for
    const deferredGoals = new Map();
    
    // Process queue iteratively
    while (queue.length > 0) {
      const { goal: g, parent, depth, reason } = queue.shift();
      
      // Prevent infinite loops
      if (depth > 5) {
        errors.push(`Maximum depth (5) reached resolving ${g.type} (from ${parent?.type || 'root'})`);
        continue;
      }
      
      // Create context key for cycle detection (goal type + what it's blocking)
      const contextKey = parent ? `${g.type}:for-${parent.type}` : g.type;
      
      // Prevent cycles - check if we've seen this goal in this context
      if (visited.has(contextKey)) {
        // Already processed this goal in this context - skip
        continue;
      }
      visited.set(contextKey, { goal: g, parent, depth, reason });
      
      // Log resolution path
      const pathEntry = {
        goal: g.type,
        depth,
        reason,
        parent: parent?.type || null,
        canExecute: false,
        blocking: []
      };
      
      // Check if goal can execute (cache blocking factors to avoid redundant calls)
      let blocking;
      const cacheKey = `${g.type}:${house.id}`;
      if (blockingCache.has(cacheKey)) {
        blocking = blockingCache.get(cacheKey);
      } else {
        blocking = g.getBlockingFactors(house);
        blockingCache.set(cacheKey, blocking);
      }
      
      if (blocking.length === 0) {
        // Goal can execute - add it directly
        chain.steps.push(g);
        pathEntry.canExecute = true;
        resolutionPath.push(pathEntry);
        
        continue;
      }
      
      // Goal is blocked - log blocking factors
      pathEntry.blocking = blocking.map(b => ({
        type: b.type,
        value: b.value || b.resource || 'unknown',
        need: b.need,
        have: b.have
      }));
      resolutionPath.push(pathEntry);
      
      if (logger && blocking.length > 0) {
        const blockingSummary = blocking.map(b => b.type === 'BUILDING' ? `need ${b.value}` : `need ${b.resource} (have ${b.have}, need ${b.need})`).join(', ');
        logger.collectInfo(`${g.type} blocked: ${blockingSummary}`);
      }
      
      // Track if we added any dependencies for this goal
      let dependenciesAdded = false;
      
      // Resolve blocking factors linearly (no complex fallbacks)
      for (const block of blocking) {
        if (block.type === 'BUILDING') {
          // Need to build something first - simple linear dependency
          const buildGoal = createBuildingGoal(block.value);
          if (!buildGoal) {
            errors.push(`Unknown building type: ${block.value} - check createBuildingGoal() function in Goals.js`);
            if (logger) {
              logger.logError(`Unknown building type: ${block.value}`, null);
            }
            continue;
          }
          
          queue.push({
            goal: buildGoal,
            parent: g,
            depth: depth + 1,
            reason: `needs building: ${block.value}`
          });
          dependenciesAdded = true;
          
          if (logger) {
            logger.collectInfo(`  -> Need ${buildGoal.type} (for ${g.type})`);
          }
        } else if (block.type === 'RESOURCE') {
          // Check if we can gather this resource in territory
          const buildingType = chain.getResourceBuildingType(block.resource);
          if (buildingType) {
            // For stone, need stone mines; for ores, need cave mines
            let mineType = 'any';
            if (block.resource === 'stone') {
              mineType = 'stone'; // Need stone mine
            } else if (block.resource === 'ironore' || block.resource === 'silverore' || block.resource === 'goldore' || block.resource === 'iron') {
              mineType = 'cave'; // Need cave mine
            }
            
            // Check if gathering building already exists (with correct type for mines)
            const hasBuilding = GoalChain.hasGatheringBuilding(house, block.resource, mineType);
            
            if (!hasBuilding) {
              // Need to build gathering building first
              let buildGoal = createBuildingGoal(buildingType);
              
              // For mines, set the mine type preference
              if (buildingType === 'mine' && buildGoal && buildGoal.constructor.name === 'BuildMineGoal') {
                buildGoal.mineType = mineType;
              }
              
              if (buildGoal) {
                queue.push({
                  goal: buildGoal,
                  parent: g,
                  depth: depth + 1,
                  reason: `needs resource: ${block.resource} (requires ${buildingType}${mineType !== 'any' ? ` - ${mineType} type` : ''})`
                });
                dependenciesAdded = true;
                
                if (logger) {
                  logger.collectInfo(`  -> Need ${buildGoal.type} to gather ${block.resource} (for ${g.type})${mineType !== 'any' ? ` - ${mineType} mine` : ''}`);
                }
              } else {
                errors.push(`Cannot create build goal for ${buildingType} (needed for ${block.resource}) - check building definitions`);
                if (logger) {
                  logger.collectError(`Cannot create build goal for ${buildingType}`, null);
                }
              }
              
              // Check if we need multiple buildings for large deficits
              const deficit = block.need - block.have;
              const buildingsNeeded = GoalChain.estimateBuildingsNeeded(house, block.resource, deficit);
              
              // For very large deficits (>100), consider building additional gathering buildings
              if (deficit > 100 && buildingsNeeded > 0) {
                // Add one more building goal for large resource needs
                let additionalBuildGoal = createBuildingGoal(buildingType);
                
                // Set mine type for additional mine
                if (buildingType === 'mine' && additionalBuildGoal && additionalBuildGoal.constructor.name === 'BuildMineGoal') {
                  additionalBuildGoal.mineType = mineType;
                }
                
                if (additionalBuildGoal) {
                  queue.push({
                    goal: additionalBuildGoal,
                    parent: g,
                    depth: depth + 1,
                    reason: `needs resource: ${block.resource} (large deficit, requires additional ${buildingType}${mineType !== 'any' ? ` - ${mineType} type` : ''})`
                  });
                  
                  if (logger) {
                    logger.collectInfo(`  -> Need additional ${additionalBuildGoal.type} for large ${block.resource} deficit (${deficit})${mineType !== 'any' ? ` - ${mineType} mine` : ''}`);
                  }
                }
              }
            } else {
              // Building exists - just need to gather resources
              if (logger) {
                logger.collectInfo(`  -> ${buildingType} exists, will gather ${block.resource}`);
              }
            }
            
            // Add gather goal to wait for resources (only if there's a deficit)
            const deficit = block.need - block.have;
            if (deficit > 0) {
              const gatherGoal = new GatherResourceGoal(block.resource, block.need);
              chain.steps.push(gatherGoal);
              dependenciesAdded = true;
              resolutionPath.push({
                goal: gatherGoal.type,
                depth: depth + 1,
                reason: `gather ${block.resource} (need ${block.need}, have ${block.have})`,
                parent: g.type,
                canExecute: false,
                blocking: []
              });
              
              if (logger) {
                logger.collectInfo(`  -> Need to gather ${block.resource} (have ${block.have}, need ${block.need})`);
              }
            }
          } else {
            errors.push(`No building type defined for resource ${block.resource} - check getResourceBuildingType() in GoalChain.js`);
            if (logger) {
              logger.collectError(`No building type defined for resource ${block.resource}`, null);
            }
          }
        }
      }
      
      // If we added dependencies, defer this goal until after dependencies are processed
      if (dependenciesAdded) {
        // Track which dependencies this goal is waiting for
        const waitingFor = [];
        for (const block of blocking) {
          if (block.type === 'BUILDING') {
            waitingFor.push(block.value);
          } else if (block.type === 'RESOURCE') {
            const buildingType = chain.getResourceBuildingType(block.resource);
            if (buildingType) {
              waitingFor.push(buildingType);
            }
          }
        }
        deferredGoals.set(g, waitingFor);
        // Don't add to steps yet - will be added after dependencies
      } else {
        // No dependencies could be added (all errors or unresolvable) - add goal anyway
        // It will fail but at least it's in the chain for error reporting
        chain.steps.push(g);
      }
    }
    
    // Add deferred goals after their dependencies are in the chain
    // Check each deferred goal to see if its dependencies are now in the chain
    const addedGoalTypes = new Set(chain.steps.map(s => s.type));
    const addedBuildingTypes = new Set(chain.steps.map(s => {
      // Extract building type from goal type (e.g., BUILD_FORGE -> forge)
      if (s.type.startsWith('BUILD_')) {
        return s.type.replace('BUILD_', '').toLowerCase();
      }
      return null;
    }).filter(Boolean));
    
    // Process deferred goals - add them if their dependencies are satisfied
    let changed = true;
    while (changed && deferredGoals.size > 0) {
      changed = false;
      for (const [deferredGoal, waitingFor] of deferredGoals.entries()) {
        // Check if all dependencies are in the chain
        // waitingFor contains building types (e.g., "forge"), check if BUILD_FORGE is in chain
        const allDependenciesMet = waitingFor.every(dep => {
          // Check if dependency building type has a corresponding goal in the chain
          const expectedGoalType = `BUILD_${dep.toUpperCase()}`;
          return addedGoalTypes.has(expectedGoalType) || addedBuildingTypes.has(dep);
        });
        
        if (allDependenciesMet) {
          chain.steps.push(deferredGoal);
          addedGoalTypes.add(deferredGoal.type);
          if (deferredGoal.type.startsWith('BUILD_')) {
            addedBuildingTypes.add(deferredGoal.type.replace('BUILD_', '').toLowerCase());
          }
          deferredGoals.delete(deferredGoal);
          changed = true;
        }
      }
    }
    
    // Add any remaining deferred goals (dependencies couldn't be resolved)
    for (const [deferredGoal] of deferredGoals.entries()) {
      chain.steps.push(deferredGoal);
    }
    
    // Remove duplicates (keep last occurrence)
    chain.steps = chain.removeDuplicates(chain.steps);
    
    // Store errors and resolution path for debugging
    if (errors.length > 0) {
      chain.errors = errors;
    }
    chain.resolutionPath = resolutionPath; // Always store path for debugging
    
    // Collect chain creation completion
    if (logger && chain.steps.length > 0) {
      const stepTypes = chain.steps.map(s => s.type).join(' -> ');
      logger.collectInfo(`Chain resolved: ${stepTypes}`);
    }
    
    // Log errors if any
    if (errors.length > 0) {
      const timestamp = new Date().toISOString();
      console.warn(`[GoalChain] [${timestamp}] Errors creating chain for ${goal.type}:`, errors);
      console.warn(`[GoalChain] Resolution path:`, JSON.stringify(resolutionPath, null, 2));
    }
    
    return chain;
  }
  
  // Remove duplicate goals, keeping the last occurrence
  // Single-pass algorithm: track last index of each goal type, then filter
  // We keep the last occurrence because later goals may have updated requirements
  removeDuplicates(steps) {
    // Track the last index where each goal type appears
    const lastIndex = new Map();
    for (let i = 0; i < steps.length; i++) {
      lastIndex.set(steps[i].type, i);
    }
    
    // Keep only steps that appear at their last index
    return steps.filter((step, index) => lastIndex.get(step.type) === index);
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
  
  // Check if chain has failed
  isFailed() {
    // Check if current goal has failed
    const currentGoal = this.getCurrentGoal();
    if (currentGoal && currentGoal.status === 'FAILED') {
      return true;
    }
    
    // Check if any step has failed irrecoverably
    for (let i = 0; i < this.currentStep && i < this.steps.length; i++) {
      if (this.steps[i].status === 'FAILED') {
        // Check if this failure blocks the chain
        // For now, any failure in a prerequisite fails the chain
        return true;
      }
    }
    
    return false;
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

  // Get building type needed for resource gathering
  getResourceBuildingType(resourceType) {
    const buildingTypes = {
      stone: 'mine',  // Mines can gather stone
      wood: 'lumbermill',
      grain: 'farm',
      iron: 'mine',
      ironore: 'mine',
      silverore: 'mine',
      goldore: 'mine'
    };
    return buildingTypes[resourceType] || 'workshop';
  }
  
  // Check if house has gathering building for a resource type
  static hasGatheringBuilding(house, resourceType, mineType = 'any') {
    if (!house.ai || !house.ai.buildingService) {
      return false;
    }
    
    const chain = new GoalChain(null);
    const buildingType = chain.getResourceBuildingType(resourceType);
    if (!buildingType) {
      return false;
    }
    
    // For stone, need stone mines (not cave mines)
    if (resourceType === 'stone') {
      const stoneMineCount = house.ai.buildingService.getStoneMineCount();
      if (stoneMineCount === 0) {
        return false;
      }
      
      const buildings = house.ai.buildingService.getBuildingsByType('mine');
      for (const building of buildings) {
        if (building && building.built && !building.cave) {
          return true; // Stone mine exists
        }
      }
      return false;
    }
    
    // For ores, need cave mines (not stone mines)
    if (resourceType === 'ironore' || resourceType === 'silverore' || resourceType === 'goldore' || resourceType === 'iron') {
      const caveMineCount = house.ai.buildingService.getCaveMineCount();
      if (caveMineCount === 0) {
        return false;
      }
      
      const buildings = house.ai.buildingService.getBuildingsByType('mine');
      for (const building of buildings) {
        if (building && building.built && building.cave) {
          return true; // Cave mine exists
        }
      }
      return false;
    }
    
    // For other resources, use standard check
    const buildingCount = house.ai.buildingService.getBuildingCount(buildingType);
    if (buildingCount === 0) {
      return false;
    }
    
    // Check if at least one building is built and operational
    const buildings = house.ai.buildingService.getBuildingsByType(buildingType);
    for (const building of buildings) {
      if (building && building.built) {
        return true;
      }
    }
    
    return false;
  }
  
  // Estimate if we need multiple gathering buildings based on deficit
  static estimateBuildingsNeeded(house, resourceType, deficit) {
    // Simple heuristic: if deficit is large (>50), might need multiple buildings
    // For now, return 1 if no building exists, 0 if building exists
    if (GoalChain.hasGatheringBuilding(house, resourceType)) {
      return 0; // Building exists, no need to build more
    }
    
    // Large deficits might benefit from multiple buildings, but start with 1
    return 1;
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

