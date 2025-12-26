// Faction AI Controller
// Main decision-making system that evaluates goals daily and coordinates faction behavior

const FactionKnowledge = require('./FactionKnowledge');
const TerritoryManager = require('./TerritoryManager');
const GoalChain = require('./GoalChain');
const FactionProfiles = require('./FactionProfiles');
const BuildingService = require('./BuildingService');
const MilitaryManager = require('./MilitaryManager');
const GoalExecutor = require('./GoalExecutor');
const FactionAILogger = require('./FactionAILogger');

// Strategy modules
const FactionStrategy = require('./strategies/FactionStrategy');
const CeltsStrategy = require('./strategies/CeltsStrategy');
const TeutonsStrategy = require('./strategies/TeutonsStrategy');
const FranksStrategy = require('./strategies/FranksStrategy');
const GothsStrategy = require('./strategies/GothsStrategy');
const NorsemenStrategy = require('./strategies/NorsemenStrategy');
const BrotherhoodStrategy = require('./strategies/BrotherhoodStrategy');
const OutlawsStrategy = require('./strategies/OutlawsStrategy');
const MercenariesStrategy = require('./strategies/MercenariesStrategy');

class FactionAI {
  constructor(house) {
    this.house = house;
    this.knowledge = new FactionKnowledge(house);
    this.territory = new TerritoryManager(house);
    this.buildingService = new BuildingService(house);
    this.militaryManager = new MilitaryManager(house, this);
    this.goalExecutor = new GoalExecutor(house, this);
    this.logger = new FactionAILogger(house);
    this.currentGoalChain = null;
    this.lastEvaluatedDay = 0; // Track last day evaluated to prevent duplicates
    
    // Caching for expensive operations
    this._cachedMilitaryUnits = null;
    this._cachedMilitaryUnitsDay = 0;
    
    // Goal failure tracking for adaptive learning
    this.goalFailureHistory = new Map(); // Map<goalType, {failureCount, lastFailureDay, consecutiveFailures}>
    this.chainFailureHistory = new Map(); // Map<goalType, {failureReason, lastFailureDay, blockingFactors}>
    
    // Load faction profile and strategy (use house.name for faction type)
    this.profile = FactionProfiles[house.name] || FactionProfiles.Goths;
    this.strategy = this.loadStrategy();
    
    // Initial territory scan is now performed automatically by FactionKnowledge constructor
    
    // Validate all services after creation (fail fast if initialization failed)
    this.validateServices();
  }
  
  // Validate that all services are properly initialized
  validateServices() {
    const services = [
      { name: 'FactionKnowledge', instance: this.knowledge, class: FactionKnowledge },
      { name: 'TerritoryManager', instance: this.territory, class: TerritoryManager },
      { name: 'BuildingService', instance: this.buildingService, class: BuildingService },
      { name: 'MilitaryManager', instance: this.militaryManager, class: MilitaryManager },
      { name: 'GoalExecutor', instance: this.goalExecutor, class: GoalExecutor }
    ];
    
    const errors = [];
    
    for (const service of services) {
      if (!service.instance) {
        errors.push(`${service.name} not initialized`);
      } else if (!(service.instance instanceof service.class)) {
        errors.push(`${service.name} is not an instance of ${service.name}`);
      }
    }
    
    // Strategy doesn't have a base class, so check separately
    if (!this.strategy) {
      errors.push('Strategy not initialized');
    }
    
    if (errors.length > 0) {
      const timestamp = new Date().toISOString();
      const errorMessage = `[FactionAI] [${timestamp}] [${this.house.name}] Service initialization failed:\n${errors.join('\n')}`;
      throw new Error(errorMessage);
    }
  }
  
  // Load faction-specific strategy module (use house.name for faction identification)
  loadStrategy() {
    // Handle faction names that might have numbers (e.g., "Outlaws 1", "Outlaws 2")
    const baseName = this.house.name.replace(/\s+\d+$/, ''); // Remove trailing numbers
    
    switch(baseName) {
      case 'Celts': return new CeltsStrategy(this.house, this.profile);
      case 'Teutons': return new TeutonsStrategy(this.house, this.profile);
      case 'Franks': return new FranksStrategy(this.house, this.profile);
      case 'Goths': return new GothsStrategy(this.house, this.profile);
      case 'Norsemen': return new NorsemenStrategy(this.house, this.profile);
      case 'Brotherhood': return new BrotherhoodStrategy(this.house, this.profile);
      case 'Outlaws': return new OutlawsStrategy(this.house, this.profile);
      case 'Mercenaries': return new MercenariesStrategy(this.house, this.profile);
      default:
        return new FactionStrategy(this.house, this.profile);
    }
  }
  
  // Called once per in-game day
  evaluateAndAct() {
    const day = global.day || 1;
    
    // Prevent multiple evaluations on the same day
    if (this.lastEvaluatedDay === day) {
      return;
    }
    this.lastEvaluatedDay = day;
    
    // Start report collection
    this.logger.startReport();
    
    // Invalidate caches for new day (day has changed, so cache is stale)
    this._cachedMilitaryUnits = null;
    this._cachedMilitaryUnitsDay = day;
    // BuildingService handles its own caching, no need to invalidate here
    
    // Recalculate base territory (dynamic expansion) - now handled by TerritoryManager
    // TerritoryManager.updateTerritory() is called below, which handles caching
    
    // Update patrol list
    if (this.house.updatePatrolList) {
      this.house.updatePatrolList();
    }
    
    // Update territory knowledge (cached internally)
    this.territory.updateTerritory();
    
    // Clean up stale enemy information
    this.knowledge.cleanStaleInformation();
    
    // If we have an active goal chain, continue it (persist indefinitely)
    if (this.currentGoalChain && !this.currentGoalChain.isComplete() && !this.currentGoalChain.isFailed()) {
      this.logger.updateGoalChain(this.currentGoalChain);
      this.logger.collectInfo(`Continuing goal chain: ${this.currentGoalChain.getCurrentGoal()?.type || 'none'}`);
      this.executeCurrentGoal();
      this.logger.updateGoalChain(this.currentGoalChain);
      this.logger.generateReport();
      this.logger.clearReport();
      return;
    }
    
    // Only evaluate new goals if current chain is complete or failed
    if (!this.currentGoalChain || this.currentGoalChain.isComplete() || this.currentGoalChain.isFailed()) {
      // Clear failed chains
      if (this.currentGoalChain && this.currentGoalChain.isFailed()) {
        const failedGoalType = this.currentGoalChain.mainGoal?.type || 'unknown';
        this.logger.collectInfo(`Chain failed, clearing: ${failedGoalType}`);
        
        // Record chain failure before clearing
        this.recordChainFailure(this.currentGoalChain);
        
        // Analyze failure and potentially select recovery goal
        const recoveryGoal = this.analyzeChainFailure(this.currentGoalChain);
        if (recoveryGoal) {
          this.logger.collectInfo(`Selected recovery goal: ${recoveryGoal.type} (from chain failure analysis)`);
          this.currentGoalChain = GoalChain.create(this.house, recoveryGoal, this.logger);
          this.executeCurrentGoal();
          this.logger.updateGoalChain(this.currentGoalChain);
          this.logger.generateReport();
          this.logger.clearReport();
          return;
        }
        
        this.currentGoalChain = null;
      } else if (this.currentGoalChain && this.currentGoalChain.isComplete()) {
        this.logger.collectInfo(`Chain completed: ${this.currentGoalChain.mainGoal?.type || 'unknown'}`);
      }
      
      // Evaluate new goals
      this.evaluateNewGoals();
    }
    
    // Update active scouting parties and attack forces
    this.militaryManager.updateScoutingParties();
    this.militaryManager.updateAttackForces();
    
    // Update goal chain info and generate report
    if (this.currentGoalChain) {
      this.logger.updateGoalChain(this.currentGoalChain);
    }
    this.logger.generateReport();
    this.logger.clearReport();
  }
  
  // Evaluate and select new goals
  evaluateNewGoals() {
    // Delegate to faction-specific strategy
    const economicGoals = this.strategy.evaluateEconomicGoals();
    const militaryGoals = this.strategy.evaluateMilitaryGoals();
    const expansionGoals = this.strategy.evaluateExpansionGoals();
    const defenseGoals = this.strategy.evaluateDefenseGoals();
    
    const possibleGoals = [
      ...economicGoals,
      ...militaryGoals,
      ...expansionGoals,
      ...defenseGoals
    ];
    
    // Filter out goals with 0 utility and goals that can't execute (including location checks)
    const validGoals = possibleGoals.filter(g => {
      if (g.utility <= 0) {
        return false;
      }
      
      // Check if goal should be avoided due to recent failures
      if (this.shouldAvoidGoal(g.type)) {
        this.logger.collectInfo(`Filtered goal ${g.type}: avoiding due to recent consecutive failures`);
        return false;
      }
      
      // Check if goal can execute (resources, buildings)
      if (!g.canExecute(this.house)) {
        this.logger.collectInfo(`Filtered goal ${g.type}: cannot execute (blocked by: ${g.blockedBy.map(b => b.type === 'RESOURCE' ? `${b.resource}` : b.value).join(', ')})`);
        return false;
      }
      
      // Check if building goals can be placed (location validation)
      if (g.canPlace && typeof g.canPlace === 'function') {
        if (!g.canPlace(this.house)) {
          this.logger.collectInfo(`Filtered goal ${g.type}: no valid location available`);
          return false;
        }
      }
      
      return true;
    });
    
    // Apply failure penalties to utilities (adaptive learning)
    const adjustedGoals = validGoals.map(g => {
      const adjustedUtility = this.getAdjustedUtility(g);
      return { goal: g, utility: adjustedUtility };
    });
    
    // Sort by adjusted utility (highest first)
    adjustedGoals.sort((a, b) => b.utility - a.utility);
    
    // Extract goals from adjusted list
    const sortedGoals = adjustedGoals.map(item => item.goal);
    
    if (sortedGoals.length === 0) {
      this.logger.collectInfo('No valid goals available');
      return;
    }
    
    const topGoal = sortedGoals[0];
    const topUtility = adjustedGoals[0].utility;
    
    // Collect goal selection with alternatives
    this.logger.collectDecision('GOAL_SELECTED', `Selected: ${topGoal.type}`, {
      selectedGoal: topGoal.type,
      utility: topUtility,
      originalUtility: topGoal.utility,
      allCandidates: adjustedGoals.map(item => ({ 
        type: item.goal.type, 
        utility: item.utility,
        originalUtility: item.goal.utility
      })),
      reasoning: `Highest adjusted utility (${topUtility}) among ${sortedGoals.length} candidates`
    });
    
    // Collect alternatives info
    if (sortedGoals.length > 1) {
      const alternatives = adjustedGoals.slice(1).map(item => 
        `${item.goal.type} (${item.utility}, orig: ${item.goal.utility})`
      ).join(', ');
      this.logger.collectInfo(`Alternatives considered: ${alternatives}`);
    }
    
    // Check if we should avoid this goal due to recent chain failure
    if (this.shouldAvoidChainGoal(topGoal.type)) {
      this.logger.collectInfo(`Avoiding goal ${topGoal.type}: recent chain failure with same blocking factors`);
      // Try next goal in list
      if (sortedGoals.length > 1) {
        const nextGoal = sortedGoals[1];
        this.logger.collectInfo(`Selecting alternative goal: ${nextGoal.type}`);
        topGoal = nextGoal;
      } else {
        this.logger.collectInfo('No alternative goals available, proceeding with primary goal despite recent failure');
      }
    }
    
    // Create goal chain to resolve dependencies
    this.currentGoalChain = GoalChain.create(this.house, topGoal, this.logger);
    
    // Validate chain after creation
    if (this.currentGoalChain.errors && this.currentGoalChain.errors.length > 0) {
      this.logger.collectError(`Chain creation errors for ${topGoal.type}`, null, {
        reasoning: this.currentGoalChain.errors.join('; ')
      });
    }
    
    // Collect chain creation info
    if (this.currentGoalChain.steps.length > 0) {
      const stepTypes = this.currentGoalChain.steps.map(s => s.type).join(' -> ');
      this.logger.collectInfo(`Chain created: ${stepTypes}`);
    }
    
    // Check if chain has any steps
    if (this.currentGoalChain.steps.length === 0) {
      // If goal can execute, try it directly
      if (topGoal.canExecute(this.house)) {
        try {
          topGoal.execute(this.house);
          topGoal.status = 'COMPLETED';
            this.logger.collectAction(`${topGoal.type} executed directly`, {
              goal: topGoal.type,
              reasoning: 'No dependencies needed'
            });
        } catch (error) {
          this.logger.logError(`Error executing goal directly: ${topGoal.type}`, error);
          topGoal.status = 'FAILED';
        }
      }
      this.currentGoalChain = null;
      return;
    }
    
    this.executeCurrentGoal();
  }
  
  // Execute current goal in the chain (delegates to GoalExecutor)
  executeCurrentGoal() {
    const goal = this.currentGoalChain.getCurrentGoal();
    
    if (!goal) {
      this.logger.collectError('No current goal in chain', null);
      return;
    }
    
    const result = this.goalExecutor.executeGoal(goal, this.currentGoalChain, this.logger);
    
    // Track failures for adaptive learning
    if (!result.success && goal.status === 'FAILED') {
      this.recordGoalFailure(goal.type);
    }
    
    // Track chain failures
    if (this.currentGoalChain && this.currentGoalChain.isFailed()) {
      this.recordChainFailure(this.currentGoalChain);
    }
    
    if (result.shouldClearChain) {
      this.currentGoalChain = null;
    } else if (result.shouldAdvance) {
      this.currentGoalChain.advance();
      const nextGoal = this.currentGoalChain.getCurrentGoal()?.type;
      if (nextGoal) {
        this.logger.collectInfo(`Next goal: ${nextGoal}`);
      }
    }
  }
  
  // Record goal failure for adaptive learning
  recordGoalFailure(goalType) {
    const day = global.day || 1;
    const history = this.goalFailureHistory.get(goalType) || {
      failureCount: 0,
      lastFailureDay: 0,
      consecutiveFailures: 0
    };
    
    // Check if this is a consecutive failure (failed on previous day)
    if (history.lastFailureDay === day - 1) {
      history.consecutiveFailures++;
    } else {
      history.consecutiveFailures = 1; // Reset if not consecutive
    }
    
    history.failureCount++;
    history.lastFailureDay = day;
    
    this.goalFailureHistory.set(goalType, history);
    
    if (this.logger) {
      this.logger.collectInfo(`Goal failure recorded: ${goalType} (failures: ${history.failureCount}, consecutive: ${history.consecutiveFailures})`);
    }
  }
  
  // Record chain failure with blocking factors
  recordChainFailure(chain) {
    const day = global.day || 1;
    const mainGoalType = chain.mainGoal?.type || 'unknown';
    const currentGoal = chain.getCurrentGoal();
    
    // Extract blocking factors from current goal
    const blockingFactors = currentGoal ? currentGoal.getBlockingFactors(this.house) : [];
    
    // Store failure info on chain itself
    chain.failureReason = currentGoal?.status === 'FAILED' ? 'goal_execution_failed' : 'goal_blocked';
    chain.blockingFactors = blockingFactors.map(b => ({
      type: b.type,
      value: b.value || b.resource || 'unknown',
      need: b.need,
      have: b.have
    }));
    
    // Store in history
    this.chainFailureHistory.set(mainGoalType, {
      failureReason: chain.failureReason,
      lastFailureDay: day,
      blockingFactors: chain.blockingFactors,
      currentStep: chain.currentStep,
      totalSteps: chain.steps.length
    });
    
    if (this.logger) {
      const blockingSummary = blockingFactors.map(b => 
        b.type === 'RESOURCE' ? `${b.resource} (have ${b.have}, need ${b.need})` : b.value
      ).join(', ');
      this.logger.collectInfo(`Chain failure recorded: ${mainGoalType} (blocked by: ${blockingSummary})`);
    }
  }
  
  // Get adjusted utility based on failure history
  getAdjustedUtility(goal) {
    const baseUtility = goal.utility;
    const goalType = goal.type;
    const day = global.day || 1;
    
    const history = this.goalFailureHistory.get(goalType);
    if (!history) {
      return baseUtility; // No failure history, use base utility
    }
    
    // Calculate failure penalty
    // -10% per failure, up to -50% max
    // Additional -10% per consecutive failure
    const failurePenalty = Math.min(0.5, history.failureCount * 0.1);
    const consecutivePenalty = Math.min(0.1, history.consecutiveFailures * 0.1);
    const totalPenalty = failurePenalty + consecutivePenalty;
    
    // Cooldown: if failed recently (within last 2 days), apply additional penalty
    const daysSinceFailure = day - history.lastFailureDay;
    const cooldownPenalty = daysSinceFailure <= 2 ? 0.2 : 0;
    
    const adjustedUtility = baseUtility * (1 - totalPenalty - cooldownPenalty);
    
    // Minimum utility threshold (don't go below 10)
    return Math.max(10, adjustedUtility);
  }
  
  // Check if goal should be avoided due to recent failures
  shouldAvoidGoal(goalType) {
    const day = global.day || 1;
    const history = this.goalFailureHistory.get(goalType);
    
    if (!history) {
      return false;
    }
    
    // Avoid if failed within last day and has high consecutive failures
    const daysSinceFailure = day - history.lastFailureDay;
    if (daysSinceFailure <= 1 && history.consecutiveFailures >= 3) {
      return true; // Too many consecutive failures, avoid for now
    }
    
    return false;
  }
  
  // Analyze chain failure and suggest recovery goal
  analyzeChainFailure(chain) {
    const currentGoal = chain.getCurrentGoal();
    if (!currentGoal) {
      return null;
    }
    
    const blockingFactors = currentGoal.getBlockingFactors(this.house);
    
    // Check for resource blocks - suggest gathering that resource
    const resourceBlocks = blockingFactors.filter(b => b.type === 'RESOURCE');
    if (resourceBlocks.length > 0) {
      // Prioritize the resource with largest deficit
      const largestDeficit = resourceBlocks.reduce((max, block) => {
        const deficit = block.need - block.have;
        return deficit > (max.need - max.have) ? block : max;
      }, resourceBlocks[0]);
      
      // Check if gathering building exists
      const tempChain = new GoalChain(null);
      const buildingType = tempChain.getResourceBuildingType(largestDeficit.resource);
      if (buildingType && !GoalChain.hasGatheringBuilding(this.house, largestDeficit.resource)) {
        // Need to build gathering building
        const { createBuildingGoal } = require('./Goals');
        return createBuildingGoal(buildingType);
      } else {
        // Building exists, just need to gather
        const { GatherResourceGoal } = require('./Goals');
        return new GatherResourceGoal(largestDeficit.resource, largestDeficit.need);
      }
    }
    
    // Check for building blocks - suggest building that building
    const buildingBlocks = blockingFactors.filter(b => b.type === 'BUILDING');
    if (buildingBlocks.length > 0) {
      const { createBuildingGoal } = require('./Goals');
      return createBuildingGoal(buildingBlocks[0].value);
    }
    
    // Check for location issues - suggest alternative building goal
    if (currentGoal.status === 'FAILED' && currentGoal.type.startsWith('BUILD_')) {
      // Try to find alternative building goal
      const alternatives = this.getAlternativeGoals(currentGoal, 'location_unavailable');
      if (alternatives.length > 0) {
        return alternatives[0];
      }
    }
    
    return null; // No recovery goal found
  }
  
  // Check if we should avoid a chain goal due to recent failure
  shouldAvoidChainGoal(goalType) {
    const day = global.day || 1;
    const history = this.chainFailureHistory.get(goalType);
    
    if (!history) {
      return false;
    }
    
    // Avoid if failed within last 2 days with same blocking factors
    const daysSinceFailure = day - history.lastFailureDay;
    if (daysSinceFailure <= 2) {
      // Check if blocking factors are still present
      const currentBlocking = this.getCurrentBlockingFactors(goalType);
      if (currentBlocking && this.hasSameBlockingFactors(history.blockingFactors, currentBlocking)) {
        return true; // Same blocking factors, avoid for now
      }
    }
    
    return false;
  }
  
  // Get current blocking factors for a goal type (without creating the goal)
  getCurrentBlockingFactors(goalType) {
    // This is a simplified check - in practice, we'd need to create the goal to check
    // For now, return null to indicate we can't check
    return null;
  }
  
  // Check if two sets of blocking factors are the same
  hasSameBlockingFactors(factors1, factors2) {
    if (!factors1 || !factors2 || factors1.length !== factors2.length) {
      return false;
    }
    
    // Simple comparison - check if same resource/building types are blocked
    const types1 = factors1.map(f => `${f.type}:${f.value || f.resource || ''}`).sort();
    const types2 = factors2.map(f => `${f.type}:${f.value || f.resource || ''}`).sort();
    
    return JSON.stringify(types1) === JSON.stringify(types2);
  }
  
  // Get alternative goals when primary goal fails
  getAlternativeGoals(primaryGoal, failureReason) {
    const alternatives = [];
    
    // If strategy has getAlternativeGoals method, use it
    if (this.strategy && typeof this.strategy.getAlternativeGoals === 'function') {
      const strategyAlternatives = this.strategy.getAlternativeGoals(primaryGoal, failureReason);
      alternatives.push(...strategyAlternatives);
    }
    
    // Default alternatives based on goal type
    const { createBuildingGoal } = require('./Goals');
    
    if (primaryGoal.type === 'BUILD_FARM') {
      // If farm fails, try mill or lumbermill
      alternatives.push(createBuildingGoal('mill'));
      alternatives.push(createBuildingGoal('lumbermill'));
    } else if (primaryGoal.type === 'BUILD_FORGE' || primaryGoal.type === 'BUILD_GARRISON') {
      // If forge/garrison fails due to resources, prioritize resource gathering
      const blockingFactors = primaryGoal.getBlockingFactors(this.house);
      const resourceBlocks = blockingFactors.filter(b => b.type === 'RESOURCE');
      for (const block of resourceBlocks) {
        const tempChain = new GoalChain(null);
        const buildingType = tempChain.getResourceBuildingType(block.resource);
        if (buildingType && !GoalChain.hasGatheringBuilding(this.house, block.resource)) {
          alternatives.push(createBuildingGoal(buildingType));
        }
      }
    }
    
    // Filter alternatives to only include executable ones
    return alternatives.filter(alt => {
      if (!alt) return false;
      if (alt.utility <= 0) return false;
      if (!alt.canExecute(this.house)) return false;
      if (alt.canPlace && typeof alt.canPlace === 'function' && !alt.canPlace(this.house)) {
        return false;
      }
      return true;
    });
  }
  
  // Get AI status for debugging
  getStatus() {
    const chainStatus = this.currentGoalChain 
      ? {
          currentGoal: this.currentGoalChain.getCurrentGoal()?.type || 'none',
          progress: (this.currentGoalChain.getProgress() * 100).toFixed(0) + '%',
          totalSteps: this.currentGoalChain.steps.length,
          currentStep: this.currentGoalChain.currentStep,
          errors: this.currentGoalChain.errors || [],
          isComplete: this.currentGoalChain.isComplete(),
          isFailed: this.currentGoalChain.isFailed(),
          summary: this.currentGoalChain.getSummary()
        }
      : {
          currentGoal: 'none',
          progress: 'N/A',
          totalSteps: 0,
          currentStep: 0,
          errors: [],
          isComplete: true,
          isFailed: false
        };
    
    return {
      faction: this.house.type,
      name: this.house.name,
      goalChain: chainStatus,
      territory: {
        center: this.territory.coreBase?.center,
        radius: this.territory.coreBase?.radius,
        buildings: this.territory.coreBase?.buildings.length || 0,
        outposts: this.territory.outposts.length
      },
      knowledge: this.knowledge.getStats(),
      resources: this.house.stores,
      military: {
        units: this.getMilitaryUnits().length,
        scoutingParties: this.militaryManager.activeScoutingParties.length,
        attackForces: this.militaryManager.activeAttackForces.length
      }
    };
  }

  // Deploy a scouting party to a target zone (delegates to MilitaryManager)
  deployScoutingParty(targetZone, resourceType) {
    return this.militaryManager.deployScoutingParty(targetZone, resourceType);
  }

  // Get all military units belonging to this faction (cached per day)
  getMilitaryUnits() {
    const day = global.day || 1;
    
    // Return cached result if available
    if (this._cachedMilitaryUnits !== null && this._cachedMilitaryUnitsDay === day) {
      return this._cachedMilitaryUnits;
    }
    
    // Calculate and cache
    const militaryUnits = [];
    
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove || !player.house || player.house.id !== this.house.id) continue;
      
      // Check if unit is military using the military property
      if (player.military === true) {
        militaryUnits.push(player);
      }
    }
    
    this._cachedMilitaryUnits = militaryUnits;
    this._cachedMilitaryUnitsDay = day;
    
    return militaryUnits;
  }
  
  // Get count of buildings by type (delegates to BuildingService)
  getBuildingCount(buildingType) {
    return this.buildingService.getBuildingCount(buildingType);
  }

  // Plan outpost construction (delegates to OutpostPlanner)
  planOutpost(targetZone, resourceType) {
    try {
      const OutpostPlanner = require('./OutpostPlanner');
      const planner = new OutpostPlanner();
      return planner.planOutpost(targetZone, resourceType, this.house);
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[FactionAI] [${timestamp}] [${this.house.name}] Error planning outpost:`, error);
      return null;
    }
  }
  
  // Get resource production rate (simplified - assumes fixed rates per building)
  getResourceProductionRate(resourceType) {
    // Basic production rates per building per day (simplified estimates)
    const productionRates = {
      stone: 5, // 5 stone per mine per day
      wood: 8,  // 8 wood per lumbermill per day
      grain: 10, // 10 grain per farm per day
      ironore: 3, // 3 iron ore per mine per day
      silverore: 2, // 2 silver ore per mine per day
      goldore: 1  // 1 gold ore per mine per day
    };
    
    return productionRates[resourceType] || 0;
  }
  
  // Estimate time needed to gather a resource amount
  estimateGatheringTime(resourceType, targetAmount) {
    const currentAmount = this.house.stores[resourceType] || 0;
    const deficit = targetAmount - currentAmount;
    
    if (deficit <= 0) {
      return 0; // Already have enough
    }
    
    // Get production rate per building
    const ratePerBuilding = this.getResourceProductionRate(resourceType);
    if (ratePerBuilding === 0) {
      return Infinity; // Can't produce this resource
    }
    
    // Get number of gathering buildings
    const tempChain = new GoalChain(null);
    const buildingType = tempChain.getResourceBuildingType(resourceType);
    if (!buildingType) {
      return Infinity; // No building type defined
    }
    
    const buildingCount = this.buildingService.getBuildingCount(buildingType);
    if (buildingCount === 0) {
      return Infinity; // No buildings to produce
    }
    
    // Calculate total production per day
    const totalProductionPerDay = ratePerBuilding * buildingCount;
    
    // Estimate days needed (round up)
    const daysNeeded = Math.ceil(deficit / totalProductionPerDay);
    
    return daysNeeded;
  }
  
  // Check if resources can be gathered within reasonable time (e.g., 10 days)
  canGatherWithinReasonableTime(resourceType, targetAmount, maxDays = 10) {
    const daysNeeded = this.estimateGatheringTime(resourceType, targetAmount);
    return daysNeeded <= maxDays;
  }
}

module.exports = FactionAI;

