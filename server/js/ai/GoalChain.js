// Goal Chain System
// Handles multi-step goal execution by resolving dependencies

const { GatherResourceGoal, createBuildingGoal } = require('./Goals');
const { PRODUCTION_RATES, PRODUCTION_EFFICIENCY, TIME_THRESHOLDS, RESOURCE_THRESHOLDS } = require('./AIConstants');

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
      console.log(`[GoalChain] Resolving dependencies for ${goal.type} (faction: ${house.name || house.id})`);
    }
    
    // Queue of goals to process: {goal, parent, depth, reason}
    const queue = [{ goal, parent: null, depth: 0, reason: 'main goal' }];
    
    // Track visited goals with context to prevent cycles
    // Key: goal type + blocking context (e.g., "BUILD_GARRISON:needs-forge")
    const visited = new Map();
    
    // Track dependency path to detect cycles (e.g., SCOUT_FOR_RESOURCE -> BUILD_LUMBERMILL -> SCOUT_FOR_RESOURCE)
    // For each goal in queue, track its ancestor chain
    const getAncestorChain = (goal, parent, ancestorMap) => {
      const chain = [goal.type];
      let current = parent;
      while (current) {
        chain.unshift(current.type);
        current = ancestorMap.get(current);
      }
      return chain;
    };
    const ancestorMap = new Map(); // Map: goal -> parent goal
    
    // Track blocking factors cache to avoid redundant canExecute() calls
    const blockingCache = new Map();
    
    // Track goals that are blocked and waiting for dependencies
    // Map: goal -> array of dependency goal types it's waiting for
    const deferredGoals = new Map();
    
    // Process queue iteratively
    let iterationCount = 0;
    while (queue.length > 0) {
      iterationCount++;
      const { goal: g, parent, depth, reason } = queue.shift();
      
      // Log dependency resolution progress (limited to avoid spam)
      if (logger && iterationCount <= 20) {
        console.log(`[GoalChain] Iteration ${iterationCount}: Processing ${g.type} (depth: ${depth}, reason: ${reason}, parent: ${parent?.type || 'none'})`);
      }
      
      // Prevent infinite loops
      if (depth > 5) {
        errors.push(`Maximum depth (5) reached resolving ${g.type} (from ${parent?.type || 'root'})`);
        continue;
      }
      
      // Build ancestor chain to detect cycles
      if (parent) {
        ancestorMap.set(g, parent);
      }
      const ancestorChain = getAncestorChain(g, parent, ancestorMap);
      
      // Detect cycles: if this goal type appears twice in the chain, we have a cycle
      const goalTypeCounts = {};
      for (const goalType of ancestorChain) {
        goalTypeCounts[goalType] = (goalTypeCounts[goalType] || 0) + 1;
        if (goalTypeCounts[goalType] > 1) {
          // Cycle detected! Break the cycle
          const cyclePattern = ancestorChain.join(' -> ');
          errors.push(`Cycle detected: ${cyclePattern} - breaking cycle by skipping ${g.type}`);
          if (logger) {
            logger.collectInfo(`Cycle detected: ${cyclePattern} - skipping ${g.type} to break cycle`);
            console.warn(`[GoalChain] Cycle detected: ${cyclePattern} - skipping ${g.type} to break cycle`);
          }
          continue; // Skip this goal to break the cycle
        }
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
        
        if (logger && iterationCount <= 20) {
          console.log(`[GoalChain] ${g.type} can execute - added to chain`);
        }
        
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
          // Special handling for guardtower requirement (needs location from ESTABLISH_OUTPOST)
          if (block.value === 'guardtower' && g.type === 'ESTABLISH_OUTPOST' && g.targetZone && g.targetZone.center) {
            // Create BuildGuardtowerGoal with outpost location
            const { BuildGuardtowerGoal } = require('./Goals');
            const guardtowerGoal = new BuildGuardtowerGoal(g.targetZone.center);
            
            queue.push({
              goal: guardtowerGoal,
              parent: g,
              depth: depth + 1,
              reason: `needs building: ${block.value} (at outpost location)`
            });
            dependenciesAdded = true;
            
            if (logger) {
              logger.collectInfo(`  -> Need ${guardtowerGoal.type} at outpost location (for ${g.type})`);
            }
            
            // Check if guardtower needs stone - if stone < 120, add BUILD_MINE (stone) as dependency
            const stoneAmount = house.stores.stone || 0;
            if (stoneAmount < 120) {
              // Only exception: BUILD_MINE (stone) can be built before guardtower
              const stoneMineGoal = createBuildingGoal('mine');
              if (stoneMineGoal) {
                stoneMineGoal.mineType = 'stone'; // Ensure it's a stone mine
                queue.push({
                  goal: stoneMineGoal,
                  parent: guardtowerGoal,
                  depth: depth + 2,
                  reason: `needs resource: stone (for ${guardtowerGoal.type}, only exception)`
                });
                dependenciesAdded = true;
                
                if (logger) {
                  logger.collectInfo(`  -> Need BUILD_MINE (stone) for guardtower (only exception)`);
                }
              }
            }
            
            continue; // Skip default building goal creation
          }
          
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
          const buildingType = GoalChain.getResourceBuildingType(block.resource);
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
            
            // Check if resource gap exists (resource not available in territory)
            // If gap exists and no building, we should scout first
            const hasResourceGap = house.ai && house.ai.knowledge 
              ? house.ai.knowledge.identifyResourceGap(block.resource)
              : false;
            
            if (!hasBuilding && hasResourceGap) {
              // Check if scouting is feasible (units available) before adding scout goal
              // This prevents cycles when scouting is blocked by UNITS
              let canScout = false;
              if (house.ai && house.ai.getMilitaryUnits) {
                const militaryUnits = house.ai.getMilitaryUnits();
                // Filter out units already in scouting parties
                const availableUnits = militaryUnits.filter(unit => {
                  if (!unit || unit.toRemove) return false;
                  if (unit.scoutingParty) return false;
                  return true;
                });
                canScout = availableUnits.length >= 1;
              }
              
              // Also check if zone is known (no scouting needed)
              let zoneKnown = false;
              if (house.ai && house.ai.knowledge) {
                // Try to find if any zone with this resource is known
                // For now, if scouting is not feasible, assume resources exist and skip scouting
                // This prevents infinite loops when scouting is blocked
              }
              
              if (canScout && !zoneKnown) {
                // Scouting is feasible - add scout goal
                const { ScoutForResourceGoal } = require('./Goals');
                const scoutGoal = new ScoutForResourceGoal(block.resource);
                
                // Check for cycle before adding: if ancestor chain already contains SCOUT_FOR_RESOURCE, skip
                const hasScoutInChain = ancestorChain.includes('SCOUT_FOR_RESOURCE');
                if (hasScoutInChain) {
                  // Cycle detected - skip scouting and build building directly
                  if (logger) {
                    logger.collectInfo(`  -> Skipping SCOUT_FOR_RESOURCE (cycle detected in chain: ${ancestorChain.join(' -> ')}) - building ${buildingType} directly`);
                    console.warn(`[GoalChain] Cycle prevention: Skipping SCOUT_FOR_RESOURCE for ${block.resource} (already in chain) - building ${buildingType} directly`);
                  }
                } else {
                  queue.push({
                    goal: scoutGoal,
                    parent: g,
                    depth: depth + 1,
                    reason: `needs resource: ${block.resource} (resource gap - need to scout)`
                  });
                  dependenciesAdded = true;
                  
                  if (logger) {
                    logger.collectInfo(`  -> Need SCOUT_FOR_RESOURCE for ${block.resource} (resource gap detected)`);
                  }
                  
                  // Continue - will add building goal after scouting
                  continue;
                }
              } else {
                // Scouting not feasible (no units) or zone is known - skip scouting, build building directly
                if (logger) {
                  const reason = !canScout ? 'no units available' : 'zone is known';
                  logger.collectInfo(`  -> Skipping SCOUT_FOR_RESOURCE (${reason}) - building ${buildingType} directly (assuming resources exist)`);
                }
              }
            }
            
            if (!hasBuilding) {
              // Deadlock detection: If BUILD_MINE needs stone but stone production is broken, suggest SCOUT_FOR_RESOURCE
              if (buildingType === 'mine' && block.resource === 'stone') {
                // Check if stone production is broken (would create deadlock: need stone to build mine, but stone production broken)
                if (house.ai && house.ai._productionIssueDays && house.ai._productionIssueDays['stone'] >= 2) {
                  // Stone production is broken - suggest scouting instead of building mine
                  const { ScoutForResourceGoal } = require('./Goals');
                  const scoutGoal = new ScoutForResourceGoal('stone');
                  if (scoutGoal) {
                    queue.push({
                      goal: scoutGoal,
                      parent: g,
                      depth: depth + 1,
                      reason: `needs resource: ${block.resource} (stone production broken, scouting for alternative location)`
                    });
                    dependenciesAdded = true;
                    
                    if (logger) {
                      logger.collectInfo(`  -> Stone production broken - scouting for stone instead of building mine (deadlock prevention)`);
                    }
                    continue; // Skip building mine goal
                  }
                }
              }
              
              // Need to build gathering building first
              let buildGoal = createBuildingGoal(buildingType);
              
              // For mines, set the mine type preference
              if (buildingType === 'mine' && buildGoal && buildGoal.constructor.name === 'BuildMineGoal') {
                buildGoal.mineType = mineType;
              }
              
              if (buildGoal) {
                // Check for cycle: if this building goal type is already in ancestor chain with SCOUT_FOR_RESOURCE, skip to prevent cycle
                // Example: BUILD_LUMBERMILL -> SCOUT_FOR_RESOURCE -> BUILD_LUMBERMILL (cycle)
                const hasBuildingInChain = ancestorChain.includes(buildGoal.type);
                if (hasBuildingInChain && ancestorChain.includes('SCOUT_FOR_RESOURCE')) {
                  // Cycle detected: SCOUT_FOR_RESOURCE -> BUILD_LUMBERMILL -> SCOUT_FOR_RESOURCE
                  // Skip adding building goal to break cycle
                  if (logger) {
                    logger.collectInfo(`  -> Skipping ${buildGoal.type} (cycle detected: ${ancestorChain.join(' -> ')} -> ${buildGoal.type}) - breaking cycle`);
                    console.warn(`[GoalChain] Cycle prevention: Skipping ${buildGoal.type} (already in chain with SCOUT_FOR_RESOURCE) - breaking cycle`);
                  }
                  errors.push(`Cycle detected: ${ancestorChain.join(' -> ')} -> ${buildGoal.type} - breaking cycle by skipping ${buildGoal.type}`);
                  continue; // Skip adding this goal to break the cycle
                }
                
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
              
              // For very large deficits, consider building additional gathering buildings
              if (deficit > RESOURCE_THRESHOLDS.LARGE_DEFICIT && buildingsNeeded > 0) {
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
            // But defer it if building needs to be built first
            const deficit = block.need - block.have;
            if (deficit > 0) {
              // Check production capacity before creating GATHER_RESOURCE goal
              const productionFeasible = GoalChain.checkProductionFeasibility(house, block.resource, deficit, buildingType, hasBuilding);
              
              if (!productionFeasible.feasible && hasBuilding) {
                // Production is too slow - build additional production building instead
                if (logger) {
                  logger.collectInfo(`  -> Production too slow for ${block.resource} (${productionFeasible.daysNeeded} days needed, max 10) - building additional ${buildingType}`);
                }
                
                // Add building goal for additional production capacity
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
                    reason: `needs resource: ${block.resource} (production too slow, requires additional ${buildingType})`
                  });
                  
                  // Defer gather goal until additional building is built
                  const gatherGoal = new GatherResourceGoal(block.resource, block.need);
                  const buildGoalType = `BUILD_${buildingType.toUpperCase()}`;
                  const gatherWaitingFor = [buildingType];
                  deferredGoals.set(gatherGoal, gatherWaitingFor);
                  dependenciesAdded = true;
                  
                  if (logger) {
                    logger.collectInfo(`  -> Deferring gather ${block.resource} until additional ${buildGoalType} completes`);
                  }
                }
              } else {
                // Production is feasible - create gather goal
                // Ensure target amount is sufficient: use block.need but add 10% buffer to account for production delays
                const targetAmount = Math.ceil(block.need * 1.1);
                const gatherGoal = new GatherResourceGoal(block.resource, targetAmount);
                
                // If we added a building goal, defer the gather goal until after the building is built
                if (!hasBuilding) {
                  // Building needs to be built - defer gather goal
                  const buildGoalType = `BUILD_${buildingType.toUpperCase()}`;
                  const gatherWaitingFor = [buildingType];
                  deferredGoals.set(gatherGoal, gatherWaitingFor);
                  dependenciesAdded = true;
                  
                  if (logger) {
                    logger.collectInfo(`  -> Deferring gather ${block.resource} until after ${buildGoalType} completes (target: ${targetAmount}, need: ${block.need})`);
                  }
                } else {
                  // Building exists and production is feasible - can add gather goal directly
                  chain.steps.push(gatherGoal);
                  dependenciesAdded = true;
                  
                  if (logger) {
                    logger.collectInfo(`  -> Need to gather ${block.resource} (have ${block.have}, need ${block.need}, target: ${targetAmount}, estimated ${productionFeasible.daysNeeded} days)`);
                  }
                }
                
                resolutionPath.push({
                  goal: gatherGoal.type,
                  depth: depth + 1,
                  reason: `gather ${block.resource} (need ${block.need}, have ${block.have})`,
                  parent: g.type,
                  canExecute: false,
                  blocking: []
                });
              }
            }
          } else {
            errors.push(`No building type defined for resource ${block.resource} - check getResourceBuildingType() in GoalChain.js`);
            if (logger) {
              logger.collectError(`No building type defined for resource ${block.resource}`, null);
            }
          }
        } else if (block.type === 'LOCATION') {
          // Location blocking - cannot be resolved by dependencies
          // This means no valid location exists for the building
          // Log the issue and mark goal as potentially unachievable
          if (logger) {
            logger.collectInfo(`  -> ${g.type} blocked by location: ${block.value || 'no valid location found'}`);
          }
          
          // For BUILD_FORGE: if location blocking has occurred multiple times, try territory expansion
          if (g.type === 'BUILD_FORGE' && house.ai) {
            const goalType = g.type;
            const history = house.ai.goalFailureHistory?.get(goalType);
            const locationBlockCount = history?.locationBlockCount || 0;
            
            // If location blocked 3+ times, suggest territory expansion via ESTABLISH_OUTPOST
            if (locationBlockCount >= 3) {
              // Check if scouting is feasible (units available)
              let canScout = false;
              if (house.ai.getMilitaryUnits) {
                const militaryUnits = house.ai.getMilitaryUnits();
                const availableUnits = militaryUnits.filter(unit => {
                  if (!unit || unit.toRemove) return false;
                  if (unit.scoutingParty) return false;
                  return true;
                });
                canScout = availableUnits.length >= 1;
              }
              
              if (canScout) {
                // Add ESTABLISH_OUTPOST goal to expand territory
                // This will scout for a suitable zone and establish an outpost, expanding territory
                const { EstablishOutpostGoal } = require('./Goals');
                
                // For forge placement, we don't need a specific resource - just territory expansion
                // Pass null for both resourceType and targetZone - EstablishOutpostGoal will find a suitable zone
                const outpostGoal = new EstablishOutpostGoal(null, null);
                
                // Check for cycle before adding
                const hasOutpostInChain = ancestorChain.includes('ESTABLISH_OUTPOST');
                if (!hasOutpostInChain) {
                  queue.push({
                    goal: outpostGoal,
                    parent: g,
                    depth: depth + 1,
                    reason: `needs location: forge placement blocked (territory expansion needed)`
                  });
                  dependenciesAdded = true;
                  
                  if (logger) {
                    logger.collectInfo(`  -> Need ESTABLISH_OUTPOST for territory expansion (forge location blocked ${locationBlockCount} times)`);
                  }
                  
                  continue; // Continue processing - will add forge goal after outpost
                } else {
                  if (logger) {
                    logger.collectInfo(`  -> Skipping ESTABLISH_OUTPOST (cycle detected) - forge may be unachievable`);
                  }
                }
              } else {
                if (logger) {
                  logger.collectInfo(`  -> Location blocking cannot be resolved - no units available for territory expansion`);
                }
              }
            } else {
              if (logger) {
                logger.collectInfo(`  -> Location blocking may be temporary - will retry (blocked ${locationBlockCount} times, threshold: 3)`);
              }
            }
          }
          
          // Location blocking doesn't create dependencies by default
          // (territory expansion is only for BUILD_FORGE with multiple location blocks)
          dependenciesAdded = false;
        } else if (block.type === 'UNITS') {
          // Unit blocking - need military units
          // This is typically handled by the goal itself (e.g., ESTABLISH_OUTPOST waits for units)
          if (logger) {
            logger.collectInfo(`  -> ${g.type} blocked by units: need ${block.need}, have ${block.have}`);
          }
          dependenciesAdded = false; // Unit blocking doesn't create dependencies - goal waits for units
        }
      }
      
      // If we added dependencies OR the goal has blocking factors, defer this goal until after dependencies are processed
      if (dependenciesAdded || blocking.length > 0) {
        // Track which dependencies this goal is waiting for
        const waitingFor = [];
        for (const block of blocking) {
          if (block.type === 'BUILDING') {
            waitingFor.push(block.value);
          } else if (block.type === 'RESOURCE') {
            const buildingType = GoalChain.getResourceBuildingType(block.resource);
            if (buildingType) {
              // Check if building exists - only add to waitingFor if it doesn't
              let mineType = 'any';
              if (block.resource === 'stone') {
                mineType = 'stone';
              } else if (block.resource === 'ironore' || block.resource === 'silverore' || block.resource === 'goldore' || block.resource === 'iron') {
                mineType = 'cave';
              }
              const hasBuilding = GoalChain.hasGatheringBuilding(house, block.resource, buildingType === 'mine' ? mineType : 'any');
              if (!hasBuilding) {
                waitingFor.push(buildingType);
              }
            }
          }
          // LOCATION and UNITS blocking don't create dependencies - they're handled differently
          // LOCATION: Goal may be unachievable, but we add it anyway to let executor handle retries
          // UNITS: Goal waits for units to become available
        }
        
        // Only defer if there are actual dependencies to wait for
        if (waitingFor.length > 0) {
          deferredGoals.set(g, waitingFor);
          // Don't add to steps yet - will be added after dependencies
        } else {
          // All dependencies already satisfied - add directly
          chain.steps.push(g);
        }
      } else {
        // No dependencies and no blocking factors - add goal directly
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
    
    // Validate chain: Check if first step can actually execute
    // If first step can't execute even after dependency resolution, mark chain as potentially failed
    if (chain.steps.length > 0) {
      const firstStep = chain.steps[0];
      const firstStepBlocking = firstStep.getBlockingFactors ? firstStep.getBlockingFactors(house) : [];
      const locationBlocks = firstStepBlocking.filter(b => b.type === 'LOCATION');
      
      if (locationBlocks.length > 0 && firstStepBlocking.length === locationBlocks.length) {
        // First step is blocked only by location - this is a problem
        // Location blocking can't be resolved by dependencies
        if (logger) {
          const locationReasons = locationBlocks.map(b => b.value || 'no valid location').join(', ');
          logger.collectInfo(`Chain validation: First step ${firstStep.type} blocked by location: ${locationReasons}`);
          console.warn(`[GoalChain] Chain validation: First step ${firstStep.type} blocked by location: ${locationReasons} - chain may fail during execution`);
        }
        // Don't mark as failed yet - let executor handle retries
      } else if (firstStepBlocking.length > 0) {
        // First step has other blocking factors (should have been resolved)
        if (logger) {
          const blockingSummary = firstStepBlocking.map(b => {
            if (b.type === 'RESOURCE') return `${b.resource} (have ${b.have}, need ${b.need})`;
            if (b.type === 'BUILDING') return `need ${b.value}`;
            if (b.type === 'LOCATION') return b.value;
            return b.value || b.type;
          }).join(', ');
          logger.collectInfo(`Chain validation: First step ${firstStep.type} still blocked: ${blockingSummary}`);
          console.warn(`[GoalChain] Chain validation: First step ${firstStep.type} still blocked after dependency resolution: ${blockingSummary}`);
        }
      }
    }
    
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
    
    // Validate chain for permanent location blocking
    GoalChain._validateChain(chain, house, logger);
    
    return chain;
  }
  
  // Validate chain - check for permanent location blocking
  static _validateChain(chain, house, logger) {
    if (!chain || !chain.steps || chain.steps.length === 0) {
      return; // Empty chain, nothing to validate
    }
    
    if (!house || !house.ai) {
      return; // No AI system, skip validation
    }
    
    // Check each building goal in the chain for permanent location blocking
    for (const step of chain.steps) {
      if (!step || !step.type) continue;
      
      // Only check building goals for location blocking
      if (!step.type.startsWith('BUILD_')) continue;
      
      // Check if this goal has persistent location blocking
      const goalType = step.type;
      const history = house.ai.goalFailureHistory?.get(goalType);
      const locationBlockCount = history?.locationBlockCount || 0;
      
      // If location blocked 8+ times, consider it permanent (increased from 5 to 8)
      if (locationBlockCount >= 8) {
        // For BUILD_FORGE, we handle it with territory expansion (already added if needed)
        // For BUILD_GARRISON and other buildings, permanent location blocking means the chain is invalid
        if (goalType !== 'BUILD_FORGE') {
          const errorMsg = `Permanent location blocking detected for ${goalType} (blocked ${locationBlockCount} times) - rejecting chain`;
          chain.errors = chain.errors || [];
          chain.errors.push(errorMsg);
          
          if (logger) {
            logger.collectError(`Chain validation failed for ${goalType}`, null, {
              reason: errorMsg
            });
          }
          
          // Clear steps to prevent execution
          chain.steps = [];
          return; // Stop validation, chain is invalid
        }
      }
    }
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
  static getResourceBuildingType(resourceType) {
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
    
    const buildingType = GoalChain.getResourceBuildingType(resourceType);
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
  
  // Check if production capacity is sufficient to gather resources within reasonable time
  // Returns: {feasible: boolean, daysNeeded: number, productionRate: number}
  static checkProductionFeasibility(house, resourceType, deficit, buildingType, hasBuilding) {
    // If building doesn't exist yet, assume production will be feasible once built
    if (!hasBuilding) {
      return { feasible: true, daysNeeded: 0, productionRate: 0 };
    }
    
    // Estimate production rate per day
    // Production rates from constants (per building per day)
    const baseRate = PRODUCTION_RATES[resourceType.toUpperCase()] || PRODUCTION_RATES[resourceType] || PRODUCTION_RATES.STONE;
    
    // Count production buildings
    let buildingCount = 0;
    if (resourceType === 'stone') {
      buildingCount = house.ai.buildingService.getStoneMineCount();
    } else if (resourceType === 'ironore' || resourceType === 'silverore' || resourceType === 'goldore' || resourceType === 'iron') {
      buildingCount = house.ai.buildingService.getCaveMineCount();
    } else {
      buildingCount = house.ai.buildingService.getBuildingCount(buildingType);
    }
    
    // Estimate production rate (base rate * building count * efficiency factor)
    // Efficiency accounts for serfs not always working optimally
    const productionRate = baseRate * buildingCount * PRODUCTION_EFFICIENCY;
    
    // Calculate days needed to gather deficit
    const daysNeeded = productionRate > 0 ? Math.ceil(deficit / productionRate) : Infinity;
    
    // Production is feasible if it can be gathered within reasonable time
    const feasible = daysNeeded <= TIME_THRESHOLDS.MAX_GATHERING_DAYS && productionRate > 0;
    
    return { feasible, daysNeeded, productionRate };
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

