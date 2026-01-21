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
const ProductionMonitor = require('./services/ProductionMonitor');
const ResourceBalanceAnalyzer = require('./services/ResourceBalanceAnalyzer');
const CombatRecorder = require('./services/CombatRecorder');
const { ScoutForResourceGoal, GatherResourceGoal, createBuildingGoal, BuildMillGoal, BuildMineGoal, BuildFarmGoal } = require('./Goals');
const OutpostPlanner = require('./OutpostPlanner');
const {
  UTILITY_THRESHOLDS,
  RESOURCE_THRESHOLDS,
  RESOURCE_RATIOS,
  PRODUCTION_RATES,
  TIME_THRESHOLDS,
  UTILITY_ADJUSTMENTS,
  FAILURE_THRESHOLDS,
  DISPLAY
} = require('./AIConstants');

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
    this.productionMonitor = new ProductionMonitor(this);
    this.resourceBalanceAnalyzer = new ResourceBalanceAnalyzer(this.buildingService);
    this.combatRecorder = new CombatRecorder(house, this);
    this.currentGoalChain = null;
    this.lastEvaluatedDay = 0; // Track last day evaluated to prevent duplicates
    
    // Caching for expensive operations
    this._cachedMilitaryUnits = null;
    this._cachedMilitaryUnitsDay = 0;
    
    // Goal failure tracking for adaptive learning
    this.goalFailureHistory = new Map(); // Map<goalType, {failureCount, lastFailureDay, consecutiveFailures}>
    this.chainFailureHistory = new Map(); // Map<goalType, {failureReason, lastFailureDay, blockingFactors}>
    this.goalConsiderationHistory = new Map(); // Map<goalType, {considerationCount, lastConsiderationDay}>
    
    // Fallback goal suggestions (from location blocking)
    this.suggestedFallbackGoals = new Set(); // Set of goal suggestions like "SCOUT_FOR_RESOURCE:stone"
    
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
  
  // Check if faction is non-economic (should be excluded from economic goals and reporting)
  isNonEconomicFaction() {
    const excludedFactions = ['Brotherhood', 'Outlaws', 'Norsemen', 'Mercenaries'];
    const factionName = this.house?.name || '';
    const baseName = factionName.replace(/\s+\d+$/, '').trim(); // Remove trailing numbers
    return excludedFactions.includes(baseName);
  }
  
  // Called once per in-game day
  evaluateAndAct() {
    const day = global.day || 1;
    const factionName = this.house?.name || 'Unknown';
    
    // Prevent multiple evaluations on the same day
    if (this.lastEvaluatedDay === day) {
      if (this.logger) {
        this.logger.collectInfo(`evaluateAndAct() called but already evaluated today (Day ${day})`);
      } else {
        console.log(`[FactionAI] ${factionName}: evaluateAndAct() called but already evaluated today (Day ${day})`);
      }
      return;
    }
    this.lastEvaluatedDay = day;
    
    if (this.logger) {
      this.logger.collectInfo(`evaluateAndAct() called for Day ${day}`);
    } else {
      console.log(`[FactionAI] ${factionName}: evaluateAndAct() called for Day ${day}`);
    }
    
    // Track resource production (monitoring)
    this.productionMonitor.monitor(day);
    
    // Get daily combat recap and insights
    const combatRecap = this.combatRecorder.getDailyRecap(day);
    const combatInsights = this.combatRecorder.getCombatInsights();
    
    // Diagnostic: log recap data
    if (combatRecap && (combatRecap.totalKills > 0 || combatRecap.totalDeaths > 0)) {
      console.log(`[COMBAT RECORDER] ${this.house.name}: Day ${day} recap - Kills: ${combatRecap.totalKills}, Deaths: ${combatRecap.totalDeaths}, Momentum: ${combatRecap.momentum}`);
    }
    
    if (this.logger) {
      this.logger.recordCombatRecap(combatRecap, combatInsights);
    }
    
    // Clean up old combat events (keep last 30 days)
    this.combatRecorder.clearOldEvents(30);
    
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
    
    // Update known zones when territory changes (zones intersecting base radius)
    this.knowledge.updateKnownZones();
    
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
      if (this.logger) {
        this.logger.collectInfo(`Evaluating new goals for Day ${day}`);
      } else {
        console.log(`[FactionAI] ${factionName}: Evaluating new goals for Day ${day}`);
      }
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
    const factionName = this.house?.name || 'Unknown';
    const isNonEconomic = this.isNonEconomicFaction();
    
    // Phase 1-6: Collect all possible goals
    const possibleGoals = this._collectGoals();
    
    // For non-economic factions, skip goal evaluation if no goals available
    if (isNonEconomic && possibleGoals.length === 0) {
      if (this.logger) {
        this.logger.collectInfo('Non-economic faction: No goals available, skipping goal evaluation');
      }
      return;
    }
    
    // Phase 7: Check resource balance (only for economic factions)
    const resourceBalance = isNonEconomic ? null : this.resourceBalanceAnalyzer.checkResourceBalance(this.house.stores);
    
    // Phase 8: Track goal considerations
    this._trackGoalConsiderations(possibleGoals);
    
    // Phase 9: Apply resource balance boosts (only for economic factions)
    if (!isNonEconomic && resourceBalance) {
      this._applyResourceBoosts(possibleGoals, resourceBalance);
    }
    
    // Phase 10: Apply goal forcing
    this._applyGoalForcing(possibleGoals);
    
    // Phase 11: Filter goals
    const validGoals = this._filterGoals(possibleGoals);
    
    // Phase 12: Log filtered goals
    this._logFilteredGoals(factionName, validGoals);
    
    // Phase 13: Adjust utilities with failure penalties
    const { adjustedGoals, sortedGoals } = this._adjustUtilities(validGoals);
    
    // Phase 14: Select top goal and create chain
    this._selectTopGoalAndCreateChain(adjustedGoals, sortedGoals, possibleGoals, factionName);
  }
  
  // Private helper methods for evaluateNewGoals
  
  // Collect all possible goals from strategy and fallbacks
  _collectGoals() {
    const factionName = this.house?.name || 'Unknown';
    const isNonEconomic = this.isNonEconomicFaction();
    
    // Delegate to faction-specific strategy
    const economicGoals = isNonEconomic ? [] : this.strategy.evaluateEconomicGoals();
    const militaryGoals = this.strategy.evaluateMilitaryGoals();
    const expansionGoals = this.strategy.evaluateExpansionGoals();
    // Non-economic factions should not engage in resource scouting
    const resourceScoutingGoals = isNonEconomic ? [] : (this.strategy.evaluateResourceScoutingGoals ? this.strategy.evaluateResourceScoutingGoals() : []);
    const defenseGoals = this.strategy.evaluateDefenseGoals();
    
    if (!isNonEconomic) {
      if (this.logger) {
        this.logger.collectInfo(`Goal evaluation - Economic: ${economicGoals.length}, Military: ${militaryGoals.length}, Expansion: ${expansionGoals.length}, ResourceScouting: ${resourceScoutingGoals.length}, Defense: ${defenseGoals.length}`);
      } else {
        console.log(`[FactionAI] ${factionName}: Goal evaluation - Economic: ${economicGoals.length}, Military: ${militaryGoals.length}, Expansion: ${expansionGoals.length}, ResourceScouting: ${resourceScoutingGoals.length}, Defense: ${defenseGoals.length}`);
      }
    }
    
    // Include pending recovery goals from production monitoring (only for economic factions)
    const recoveryGoals = isNonEconomic ? [] : (this._pendingRecoveryGoals || []);
    this._pendingRecoveryGoals = [];
    
    // Check for suggested fallback goals (from location blocking) - skip for non-economic factions
    const fallbackScoutGoals = [];
    if (!isNonEconomic && this.suggestedFallbackGoals && this.suggestedFallbackGoals.size > 0) {
      for (const suggestion of this.suggestedFallbackGoals) {
        const [goalType, resourceType] = suggestion.split(':');
        if (goalType === 'SCOUT_FOR_RESOURCE' && resourceType) {
          const scoutGoal = new ScoutForResourceGoal(resourceType);
          scoutGoal.utility = UTILITY_THRESHOLDS.FALLBACK_SCOUT;
          fallbackScoutGoals.push(scoutGoal);
          this.logger.collectInfo(`Added fallback SCOUT_FOR_RESOURCE for ${resourceType} due to location blocking`);
        }
      }
      this.suggestedFallbackGoals.clear();
    }
    
    return [
      ...economicGoals,
      ...militaryGoals,
      ...expansionGoals,
      ...resourceScoutingGoals,
      ...defenseGoals,
      ...recoveryGoals,
      ...fallbackScoutGoals
    ];
  }
  
  // Track goal considerations for stagnation prevention
  _trackGoalConsiderations(goals) {
    goals.forEach(g => {
      if (g.utility > 0) {
        this.recordGoalConsideration(g.type);
      }
    });
  }
  
  // Apply resource balance boosts to goals (only for economic factions)
  _applyResourceBoosts(goals, resourceBalance) {
    if (!resourceBalance) {
      return; // Skip if resource balance is null (non-economic factions)
    }
    
    goals.forEach(g => {
      if (g.type === 'BUILD_MINE') {
        const stoneAmount = resourceBalance.resources.stone || 0;
        if (stoneAmount < RESOURCE_THRESHOLDS.STONE_SCARCE || resourceBalance.imbalances.stoneScarce || resourceBalance.imbalances.needsStone) {
          if (g.mineType === undefined || g.mineType === 'any') {
            g.mineType = 'stone';
            this.logger.collectInfo(`Set BUILD_MINE mineType to 'stone' due to stone scarcity`);
          }
          const originalUtility = g.utility;
          g.utility *= UTILITY_ADJUSTMENTS.STONE_SCARCE_BOOST;
          this.logger.collectInfo(`Boosted ${g.type} utility due to stone scarcity (${stoneAmount} stone, ${originalUtility} -> ${g.utility})`);
          if (stoneAmount < RESOURCE_THRESHOLDS.STONE_VERY_LOW) {
            g.utility *= UTILITY_ADJUSTMENTS.STONE_VERY_LOW_BOOST;
            this.logger.collectInfo(`Additional boost for very low stone: ${g.utility}`);
          }
        }
      } else if (g.type === 'BUILD_LUMBERMILL') {
        if (resourceBalance.imbalances.needsWood) {
          const originalUtility = g.utility;
          g.utility *= UTILITY_ADJUSTMENTS.WOOD_SCARCE_BOOST;
          this.logger.collectInfo(`Boosted ${g.type} utility due to wood scarcity (${originalUtility} -> ${g.utility})`);
        }
      }
    });
  }
  
  // Apply goal forcing to goals
  _applyGoalForcing(goals) {
    goals.forEach(g => {
      if (this.shouldForceGoalSelection(g.type) && g.utility > 0) {
        const originalUtility = g.utility;
        g.utility = Math.max(g.utility, UTILITY_THRESHOLDS.FORCED_MIN);
        this.logger.collectInfo(`Forcing ${g.type} selection (consideration ${this.getGoalConsiderationCount(g.type)}, boosted from ${originalUtility} to ${g.utility})`);
      }
    });
  }
  
  // Filter goals based on utility, executability, and location checks
  _filterGoals(goals) {
    return goals.filter(g => {
      const originalUtility = g.utility;
      const isHighUtility = originalUtility >= UTILITY_THRESHOLDS.HIGH;
      const isForced = this.shouldForceGoalSelection(g.type);
      const isHighValueGoal = g.type === 'BUILD_GARRISON' || g.type === 'BUILD_FORGE' || g.type === 'ESTABLISH_OUTPOST';
      
      if (g.utility <= 0) {
        this.logger.collectInfo(`Filtered goal ${g.type}: utility is ${g.utility} (too low)`);
        return false;
      }
      
      if (this.shouldAvoidGoal(g.type)) {
        const history = this.goalFailureHistory.get(g.type);
        const isAbandoned = history && history.abandoned;
        const reason = isAbandoned 
          ? 'abandoned due to excessive failures' 
          : 'avoiding due to recent consecutive failures';
        this.logger.collectInfo(`Filtered goal ${g.type}: ${reason} (utility: ${originalUtility})`);
        return false;
      }
      
      if (!g.canExecute(this.house)) {
        const blockingSummary = g.blockedBy.map(b => {
          if (b.type === 'RESOURCE') return `${b.resource} (have ${b.have}, need ${b.need})`;
          if (b.type === 'BUILDING') return `need ${b.value}`;
          if (b.type === 'LOCATION') return b.value;
          return b.value || b.type;
        }).join(', ');
        
        if (isHighValueGoal || isHighUtility || isForced) {
          const reason = isForced ? 'forced due to multiple considerations' : isHighUtility ? 'high utility goal' : 'high-value goal';
          this.logger.collectInfo(`Goal ${g.type} is blocked (${blockingSummary}) but will force dependency chain (${reason}, utility: ${originalUtility})`);
        } else {
          this.logger.collectInfo(`Filtered goal ${g.type}: cannot execute (blocked by: ${blockingSummary}, utility: ${originalUtility})`);
          return false;
        }
      }
      
      if (g.canPlace && typeof g.canPlace === 'function') {
        if (!g.canPlace(this.house)) {
          this.recordLocationBlocking(g.type);
          
          if (isHighValueGoal || isHighUtility || isForced) {
            const hasLocationBlock = g.blockedBy.some(b => b.type === 'LOCATION');
            if (!hasLocationBlock) {
              g.blockedBy.push({ type: 'LOCATION', value: 'no valid location available' });
            }
            this.logger.collectInfo(`Goal ${g.type} has no valid location but will force dependency chain (utility: ${originalUtility})`);
          } else {
            this.logger.collectInfo(`Filtered goal ${g.type}: no valid location available (utility: ${originalUtility})`);
            return false;
          }
        }
      }
      
      return true;
    });
  }
  
  // Log filtered goals
  _logFilteredGoals(factionName, validGoals) {
    if (this.logger) {
      this.logger.collectInfo(`Valid goals after filtering: ${validGoals.length}`);
      if (validGoals.length > 0) {
        const topGoals = validGoals.slice(0, DISPLAY.TOP_GOALS_COUNT).map(g => `${g.type}(${g.utility})`).join(', ');
        this.logger.collectInfo(`Top goals: ${topGoals}`);
      }
    } else {
      console.log(`[FactionAI] ${factionName}: Valid goals after filtering: ${validGoals.length}`);
      if (validGoals.length > 0) {
        const topGoals = validGoals.slice(0, DISPLAY.TOP_GOALS_COUNT).map(g => `${g.type}(${g.utility})`).join(', ');
        console.log(`[FactionAI] ${factionName}: Top goals: ${topGoals}`);
      }
    }
  }
  
  // Adjust utilities with failure penalties and sort
  _adjustUtilities(goals) {
    const adjustedGoals = goals.map(g => {
      const originalUtility = g.utility;
      let adjustedUtility = this.getAdjustedUtility(g);
      const penaltyApplied = adjustedUtility < originalUtility;
      
      if (this.shouldForceGoalSelection(g.type) && adjustedUtility > 0) {
        adjustedUtility = Math.max(adjustedUtility, UTILITY_THRESHOLDS.FORCED_MIN);
      }
      
      if (penaltyApplied) {
        this.logger.collectInfo(`Utility adjustment for ${g.type}: ${originalUtility} -> ${adjustedUtility} (penalty applied)`);
      }
      
      return { goal: g, utility: adjustedUtility, originalUtility: originalUtility };
    });
    
    adjustedGoals.sort((a, b) => b.utility - a.utility);
    let sortedGoals = adjustedGoals.map(item => item.goal);
    
    if (sortedGoals.length === 0) {
      this.logger.collectInfo('No valid goals available - generating fallback goals');
      const fallbackGoals = this.generateFallbackGoals();
      if (fallbackGoals.length > 0) {
        sortedGoals = fallbackGoals;
        this.logger.collectInfo(`Generated ${fallbackGoals.length} fallback goals`);
      } else {
        this.logger.collectInfo('No fallback goals could be generated');
        return { adjustedGoals: [], sortedGoals: [] };
      }
    }
    
    return { adjustedGoals, sortedGoals };
  }
  
  // Select top goal and create chain
  _selectTopGoalAndCreateChain(adjustedGoals, sortedGoals, possibleGoals, factionName) {
    if (sortedGoals.length === 0) {
      return;
    }
    
    let topGoal = sortedGoals[0];
    const topUtility = adjustedGoals.length > 0 ? adjustedGoals[0].utility : topGoal.utility;
    const topGoalOriginalUtility = adjustedGoals.length > 0 && adjustedGoals[0] ? adjustedGoals[0].originalUtility : topGoal.utility;
    
    if (this.logger) {
      this.logger.collectInfo(`Selected goal: ${topGoal.type} (utility: ${topUtility})`);
    } else {
      console.log(`[FactionAI] ${factionName}: Selected goal: ${topGoal.type} (utility: ${topUtility})`);
    }
    
    const allCandidates = adjustedGoals.length > 0 ? adjustedGoals.map(item => ({
      type: item.goal.type,
      utility: item.utility,
      originalUtility: item.originalUtility || item.goal.utility,
      canExecute: item.goal.canExecute ? item.goal.canExecute(this.house) : true,
      blockedBy: item.goal.blockedBy || []
    })) : sortedGoals.map(g => ({
      type: g.type,
      utility: g.utility,
      originalUtility: g.utility,
      canExecute: g.canExecute ? g.canExecute(this.house) : true,
      blockedBy: g.blockedBy || []
    }));
    
    this.logger.collectDecision('GOAL_SELECTED', `Selected: ${topGoal.type}`, {
      selectedGoal: topGoal.type,
      utility: topUtility,
      originalUtility: topGoalOriginalUtility,
      allCandidates: allCandidates,
      reasoning: `Highest adjusted utility (${topUtility}, orig: ${topGoalOriginalUtility}) among ${sortedGoals.length} candidates`
    });
    
    this.logger.collectInfo(`Goal selection comparison (${allCandidates.length} candidates):`);
    allCandidates.forEach((candidate, index) => {
      const status = index === 0 ? 'SELECTED' : 'alternative';
      const blockingInfo = candidate.blockedBy.length > 0 
        ? ` [blocked by: ${candidate.blockedBy.map(b => b.type === 'RESOURCE' ? `${b.resource}` : b.value || b.type).join(', ')}]`
        : '';
      this.logger.collectInfo(`  ${status}: ${candidate.type} - utility: ${candidate.utility} (orig: ${candidate.originalUtility})${blockingInfo}`);
    });
    
    if (sortedGoals.length > 1) {
      const alternatives = adjustedGoals.length > 0 
        ? adjustedGoals.slice(1).map(item => 
            `${item.goal.type} (adj: ${item.utility}, orig: ${item.originalUtility || item.goal.utility})`
          ).join(', ')
        : sortedGoals.slice(1).map(g => 
            `${g.type} (${g.utility})`
          ).join(', ');
      this.logger.collectInfo(`Alternatives considered: ${alternatives}`);
    }
    
    if (this.shouldAvoidChainGoal(topGoal.type)) {
      this.logger.collectInfo(`Avoiding goal ${topGoal.type}: recent chain failure with same blocking factors`);
      if (sortedGoals.length > 1) {
        topGoal = sortedGoals[1];
        this.logger.collectInfo(`Selecting alternative goal: ${topGoal.type}`);
      } else {
        this.logger.collectInfo('No alternative goals available, proceeding with primary goal despite recent failure');
      }
    }
    
    if (global.eventManager && typeof global.eventManager.aiEvent === 'function') {
      global.eventManager.aiEvent('goal selected', {
        subject: this.house?.id || null,
        subjectName: this.house?.name || null,
        house: this.house?.id || null,
        houseName: this.house?.name || null,
        metadata: {
          goal: topGoal.type,
          utility: topGoal.utility,
          originalUtility: topGoalOriginalUtility || null
        }
      });
    }
    
    const shouldForceChain = (topGoal.type === 'BUILD_GARRISON' || topGoal.type === 'BUILD_FORGE' || topGoal.type === 'ESTABLISH_OUTPOST') && !topGoal.canExecute(this.house);
    if (shouldForceChain) {
      this.logger.collectInfo(`Forcing dependency chain creation for blocked high-value goal: ${topGoal.type} (utility: ${topGoalOriginalUtility})`);
      if (topGoal.type === 'BUILD_GARRISON') {
        const forgeGoal = possibleGoals.find(g => g.type === 'BUILD_FORGE');
        if (forgeGoal) {
          const originalForgeUtility = forgeGoal.utility;
          forgeGoal.utility = Math.max(forgeGoal.utility, UTILITY_THRESHOLDS.FORCED_MIN);
          this.logger.collectInfo(`Boosted BUILD_FORGE utility from ${originalForgeUtility} to ${forgeGoal.utility} (prerequisite for BUILD_GARRISON)`);
        }
      }
    }
    
    this.currentGoalChain = GoalChain.create(this.house, topGoal, this.logger);
    
    if (this.currentGoalChain.errors && this.currentGoalChain.errors.length > 0) {
      this.logger.collectError(`Chain creation errors for ${topGoal.type}`, null, {
        reasoning: this.currentGoalChain.errors.join('; ')
      });
      this.logger.collectGoalFailureContext({
        goal: topGoal.type,
        reason: this.currentGoalChain.errors.join('; ')
      });
      if (global.eventManager && typeof global.eventManager.aiEvent === 'function') {
        global.eventManager.aiEvent('chain creation errors', {
          subject: this.house?.id || null,
          subjectName: this.house?.name || null,
          house: this.house?.id || null,
          houseName: this.house?.name || null,
          metadata: {
            goal: topGoal.type,
            errors: this.currentGoalChain.errors
          }
        });
      }
    }
    
    if (this.currentGoalChain.steps.length > 0) {
      const stepTypes = this.currentGoalChain.steps.map(s => s.type).join(' -> ');
      this.logger.collectInfo(`Chain created: ${stepTypes}`);
    }
    
    if (this.currentGoalChain.steps.length === 0) {
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
      consecutiveFailures: 0,
      locationBlockCount: 0,
      lastLocationBlockDay: 0,
      firstFailureDay: 0,
      abandoned: false,
      abandonedDay: 0
    };
    
    // Initialize location blocking fields if not present
    if (history.locationBlockCount === undefined) {
      history.locationBlockCount = 0;
      history.lastLocationBlockDay = 0;
    }
    
    // Initialize abandonment tracking fields if not present
    if (history.firstFailureDay === undefined) {
      history.firstFailureDay = 0;
    }
    if (history.abandoned === undefined) {
      history.abandoned = false;
      history.abandonedDay = 0;
    }
    
    // Track first failure day
    if (history.firstFailureDay === 0) {
      history.firstFailureDay = day;
    }
    
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
  
  // Record location blocking for a goal (separate from general failures)
  recordLocationBlocking(goalType) {
    const day = global.day || 1;
    const history = this.goalFailureHistory.get(goalType) || {
      failureCount: 0,
      lastFailureDay: 0,
      consecutiveFailures: 0,
      locationBlockCount: 0,
      lastLocationBlockDay: 0
    };
    
    // Initialize location blocking fields if not present
    if (history.locationBlockCount === undefined) {
      history.locationBlockCount = 0;
      history.lastLocationBlockDay = 0;
    }
    
    history.locationBlockCount++;
    history.lastLocationBlockDay = day;
    
    this.goalFailureHistory.set(goalType, history);
    
    if (this.logger) {
      this.logger.collectInfo(`Location blocking recorded: ${goalType} (location blocks: ${history.locationBlockCount})`);
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
    const failurePenalty = Math.min(
      UTILITY_ADJUSTMENTS.FAILURE_PENALTY_MAX,
      history.failureCount * UTILITY_ADJUSTMENTS.FAILURE_PENALTY_PER_FAILURE
    );
    const consecutivePenalty = Math.min(
      UTILITY_ADJUSTMENTS.CONSECUTIVE_FAILURE_PENALTY,
      history.consecutiveFailures * UTILITY_ADJUSTMENTS.CONSECUTIVE_FAILURE_PENALTY
    );
    const totalPenalty = failurePenalty + consecutivePenalty;
    
    // Location blocking penalty: if location-blocked multiple times, reduce utility
    const locationBlockCount = history.locationBlockCount || 0;
    const locationBlockPenalty = locationBlockCount >= UTILITY_ADJUSTMENTS.LOCATION_BLOCK_THRESHOLD 
      ? UTILITY_ADJUSTMENTS.LOCATION_BLOCK_PENALTY 
      : 0;
    
    // Cooldown: if failed recently (within cooldown period), apply additional penalty
    const daysSinceFailure = day - history.lastFailureDay;
    const cooldownPenalty = daysSinceFailure <= TIME_THRESHOLDS.FAILURE_COOLDOWN_DAYS 
      ? UTILITY_ADJUSTMENTS.COOLDOWN_PENALTY 
      : 0;
    
    const adjustedUtility = baseUtility * (1 - totalPenalty - locationBlockPenalty - cooldownPenalty);
    
    // Minimum utility threshold
    return Math.max(UTILITY_THRESHOLDS.MINIMUM, adjustedUtility);
  }
  
  // Check if goal should be abandoned due to repeated failures
  shouldAbandonGoal(goalType) {
    const day = global.day || 1;
    const history = this.goalFailureHistory.get(goalType);
    
    if (!history) {
      return false;
    }
    
    // Check if already abandoned
    if (history.abandoned) {
      // Check if cooldown period has passed
      const daysSinceAbandonment = day - history.abandonedDay;
      if (daysSinceAbandonment >= TIME_THRESHOLDS.GOAL_ABANDONMENT_COOLDOWN) {
        // Reset abandonment after cooldown
        history.abandoned = false;
        history.abandonedDay = 0;
        history.consecutiveFailures = 0; // Reset consecutive failures
        this.goalFailureHistory.set(goalType, history);
        if (this.logger) {
          this.logger.collectInfo(`Goal ${goalType} abandonment reset after cooldown period`);
        }
        return false;
      }
      return true; // Still in abandonment cooldown
    }
    
    // Check abandonment thresholds
    const consecutiveFailures = history.consecutiveFailures || 0;
    const totalFailureDays = history.failureCount || 0;
    
    if (consecutiveFailures >= FAILURE_THRESHOLDS.GOAL_ABANDONMENT_FAILURES ||
        totalFailureDays >= FAILURE_THRESHOLDS.GOAL_ABANDONMENT_DAYS) {
      // Mark as abandoned
      history.abandoned = true;
      history.abandonedDay = day;
      this.goalFailureHistory.set(goalType, history);
      
      if (this.logger) {
        const reason = consecutiveFailures >= FAILURE_THRESHOLDS.GOAL_ABANDONMENT_FAILURES
          ? `${consecutiveFailures} consecutive failures`
          : `${totalFailureDays} total failure days`;
        this.logger.collectInfo(`Goal ${goalType} abandoned: ${reason}`);
      }
      
      return true;
    }
    
    return false;
  }
  
  // Check if goal should be avoided due to recent failures
  shouldAvoidGoal(goalType) {
    const day = global.day || 1;
    const history = this.goalFailureHistory.get(goalType);
    
    if (!history) {
      return false;
    }
    
    // First check if goal should be abandoned
    if (this.shouldAbandonGoal(goalType)) {
      return true;
    }
    
    // Avoid if failed within last day and has high consecutive failures
    const daysSinceFailure = day - history.lastFailureDay;
    if (daysSinceFailure <= TIME_THRESHOLDS.AVOID_GOAL_DAYS && 
        history.consecutiveFailures >= FAILURE_THRESHOLDS.AVOID_GOAL_CONSECUTIVE) {
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
      const buildingType = GoalChain.getResourceBuildingType(largestDeficit.resource);
      
      // Deadlock detection: If BUILD_MINE needs stone but stone production is broken, suggest SCOUT_FOR_RESOURCE
      if (buildingType === 'mine' && largestDeficit.resource === 'stone' && !GoalChain.hasGatheringBuilding(this.house, largestDeficit.resource)) {
        // Check if stone production is broken (would create deadlock)
        if (this.productionMonitor.getProductionIssueDays('stone') >= TIME_THRESHOLDS.PRODUCTION_ISSUE_DAYS) {
          // Stone production broken - suggest scouting instead
          if (this.logger) {
            this.logger.collectInfo(`Deadlock detected - BUILD_MINE needs stone but stone production broken, suggesting SCOUT_FOR_RESOURCE`);
          } else {
            console.log(`[FactionAI] ${this.house.name}: Deadlock detected - BUILD_MINE needs stone but stone production broken, suggesting SCOUT_FOR_RESOURCE`);
          }
          return new ScoutForResourceGoal('stone');
        }
      }
      
      if (buildingType && !GoalChain.hasGatheringBuilding(this.house, largestDeficit.resource)) {
        // Need to build gathering building
        return createBuildingGoal(buildingType);
      } else {
        // Building exists, just need to gather
        return new GatherResourceGoal(largestDeficit.resource, largestDeficit.need);
      }
    }
    
    // Check for building blocks - suggest building that building
    const buildingBlocks = blockingFactors.filter(b => b.type === 'BUILDING');
    if (buildingBlocks.length > 0) {
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
    
    // Avoid if failed within cooldown period with same blocking factors
    const daysSinceFailure = day - history.lastFailureDay;
    if (daysSinceFailure <= TIME_THRESHOLDS.AVOID_CHAIN_GOAL_DAYS) {
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
    if (primaryGoal.type === 'BUILD_FARM') {
      // If farm fails, try mill or lumbermill
      alternatives.push(createBuildingGoal('mill'));
      alternatives.push(createBuildingGoal('lumbermill'));
    } else if (primaryGoal.type === 'BUILD_FORGE' || primaryGoal.type === 'BUILD_GARRISON') {
      // If forge/garrison fails due to resources, prioritize resource gathering
      const blockingFactors = primaryGoal.getBlockingFactors(this.house);
      const resourceBlocks = blockingFactors.filter(b => b.type === 'RESOURCE');
      for (const block of resourceBlocks) {
        const buildingType = GoalChain.getResourceBuildingType(block.resource);
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
          progress: (this.currentGoalChain.getProgress() * DISPLAY.PROGRESS_PERCENTAGE_MULTIPLIER).toFixed(0) + '%',
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
        scoutingParties: this.militaryManager.scoutingParties.length,
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
      if (player.toRemove || !player.house || player.house !== this.house.id) continue;
      const isInBattleground = global.mapContextHelpers
        ? global.mapContextHelpers.isInBattleground(player)
        : !!(player.inBattleground && player.battlegroundMatchId);
      if (isInBattleground) continue;
      
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
      const planner = new OutpostPlanner();
      return planner.planOutpost(targetZone, resourceType, this.house);
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[FactionAI] [${timestamp}] [${this.house.name}] Error planning outpost:`, error);
      return null;
    }
  }
  
  
  // Track goal consideration for stagnation prevention
  recordGoalConsideration(goalType) {
    const day = global.day || 1;
    const history = this.goalConsiderationHistory.get(goalType) || {
      considerationCount: 0,
      lastConsiderationDay: 0
    };
    
    history.considerationCount++;
    history.lastConsiderationDay = day;
    
    this.goalConsiderationHistory.set(goalType, history);
  }
  
  // Get consideration count for a goal type
  getGoalConsiderationCount(goalType) {
    const history = this.goalConsiderationHistory.get(goalType);
    return history ? history.considerationCount : 0;
  }
  
  // Check if goal should be forced due to multiple considerations
  shouldForceGoalSelection(goalType) {
    const considerationCount = this.getGoalConsiderationCount(goalType);
    return considerationCount >= TIME_THRESHOLDS.GOAL_FORCE_CONSIDERATIONS;
  }
  
  // Generate fallback goals when no goals are available
  generateFallbackGoals() {
    // Non-economic factions should not have fallback economic goals
    if (this.isNonEconomicFaction()) {
      return [];
    }
    
    const fallbackGoals = [];
    // Check basic building counts
    const mills = this.buildingService.getBuildingCount('mill');
    const mines = this.buildingService.getBuildingCount('mine');
    const farms = this.buildingService.getBuildingCount('farm');
    
    // Always try to ensure basic infrastructure exists
    if (mills === 0) {
      const millGoal = new BuildMillGoal();
      millGoal.utility = UTILITY_THRESHOLDS.FALLBACK_MILL;
      fallbackGoals.push(millGoal);
    }
    
    if (mines === 0) {
      const mineGoal = new BuildMineGoal();
      mineGoal.utility = UTILITY_THRESHOLDS.FALLBACK_MILL - 10; // Slightly lower than mill
      fallbackGoals.push(mineGoal);
    }
    
    if (farms === 0 && mills > 0) {
      const farmGoal = new BuildFarmGoal();
      farmGoal.utility = UTILITY_THRESHOLDS.FALLBACK_FARM;
      fallbackGoals.push(farmGoal);
    }
    
    return fallbackGoals;
  }
}

module.exports = FactionAI;

