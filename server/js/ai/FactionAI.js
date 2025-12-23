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
        this.logger.collectInfo(`Chain failed, clearing: ${this.currentGoalChain.getCurrentGoal()?.type || 'unknown'}`);
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
    
    // Filter out goals with 0 utility
    const validGoals = possibleGoals.filter(g => g.utility > 0);
    
    // Sort by utility (highest first)
    validGoals.sort((a, b) => b.utility - a.utility);
    
    if (validGoals.length === 0) {
      this.logger.collectInfo('No valid goals available');
      return;
    }
    
    const topGoal = validGoals[0];
    
    // Collect goal selection with alternatives
    this.logger.collectDecision('GOAL_SELECTED', `Selected: ${topGoal.type}`, {
      selectedGoal: topGoal.type,
      utility: topGoal.utility,
      allCandidates: validGoals.map(g => ({ type: g.type, utility: g.utility })),
      reasoning: `Highest utility (${topGoal.utility}) among ${validGoals.length} candidates`
    });
    
    // Collect alternatives info
    if (validGoals.length > 1) {
      const alternatives = validGoals.slice(1).map(g => `${g.type} (${g.utility})`).join(', ');
      this.logger.collectInfo(`Alternatives considered: ${alternatives}`);
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
}

module.exports = FactionAI;

