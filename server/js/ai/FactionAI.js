// Faction AI Controller
// Main decision-making system that evaluates goals daily and coordinates faction behavior

const FactionKnowledge = require('./FactionKnowledge');
const TerritoryManager = require('./TerritoryManager');
const ResourcePlanner = require('./ResourcePlanner');
const GoalChain = require('./GoalChain');
const FactionProfiles = require('./FactionProfiles');

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
    this.resourcePlanner = new ResourcePlanner();
    this.currentGoalChain = null;
    this.activeGoals = [];
    
    // Load faction profile and strategy (use house.name for faction type)
    this.profile = FactionProfiles[house.name] || FactionProfiles.Goths;
    this.strategy = this.loadStrategy();
    
    console.log(`FactionAI: Initialized for ${house.name}`);
    
    // Perform initial territory scan
    this.initialTerritoryScan();
  }
  
  // Scan immediate area around HQ for initial knowledge
  initialTerritoryScan() {
    const scanRadius = 15;
    const hq = this.house.hq;
    const area = global.getArea ? global.getArea(hq, hq, scanRadius) : [];
    
    let forestCount = 0;
    let rockCount = 0;
    let caveCount = 0;
    let farmlandCount = 0;
    
    const caveLocations = [];
    const forestClusters = [];
    const rockClusters = [];
    
    for (const tile of area) {
      const terrain = global.getTile ? global.getTile(0, tile[0], tile[1]) : 0;
      
      if (terrain === 1 || terrain === 2) { // HEAVY_FOREST or LIGHT_FOREST
        forestCount++;
        if (forestCount % 5 === 0) forestClusters.push(tile);
      }
      if (terrain === 4) { // ROCKS
        rockCount++;
        if (rockCount % 5 === 0) rockClusters.push(tile);
      }
      if (terrain === 6) { // CAVE_ENTRANCE
        caveCount++;
        caveLocations.push(tile);
      }
      if (terrain === 7 || terrain === 3) { // EMPTY or BRUSH
        farmlandCount++;
      }
      
      // Mark as explored
      const tileKey = `${tile[0]},${tile[1]}`;
      this.knowledge.exploredTiles.add(tileKey);
    }
    
    // Register significant resource locations
    if (caveLocations.length > 0) {
      caveLocations.forEach(cave => {
        this.knowledge.knownResources.set(`cave:${cave[0]},${cave[1]}`, {
          type: 'RESOURCE',
          location: cave,
          resourceType: 'cave',
          density: 20,
          discoveredAt: Date.now()
        });
      });
      console.log(`${this.house.name}: Initial scan found ${caveLocations.length} cave(s)`);
    }
    
    if (forestClusters.length > 0) {
      const bestForest = forestClusters[0];
      this.knowledge.knownResources.set(`forest:${bestForest[0]},${bestForest[1]}`, {
        type: 'RESOURCE',
        location: bestForest,
        resourceType: 'forest',
        density: forestCount,
        discoveredAt: Date.now()
      });
      console.log(`${this.house.name}: Initial scan found forest (${forestCount} tiles)`);
    }
    
    if (rockClusters.length > 0) {
      const bestRocks = rockClusters[0];
      this.knowledge.knownResources.set(`rocks:${bestRocks[0]},${bestRocks[1]}`, {
        type: 'RESOURCE',
        location: bestRocks,
        resourceType: 'rocks',
        density: rockCount,
        discoveredAt: Date.now()
      });
      console.log(`${this.house.name}: Initial scan found rocks (${rockCount} tiles)`);
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
        console.log(`FactionAI: Using default strategy for ${this.house.name}`);
        return new FactionStrategy(this.house, this.profile);
    }
  }
  
  // Called once per in-game day
  evaluateAndAct() {
    const day = global.day || 1;
    console.log(`${this.house.name} AI: Evaluating (Day ${day})`);
    
    // Update territory knowledge
    this.territory.updateTerritory();
    
    // Clean up stale enemy information
    this.knowledge.cleanStaleInformation();
    
    // If we have an active goal chain, continue it
    if (this.currentGoalChain && !this.currentGoalChain.isComplete()) {
      this.executeCurrentGoal();
      return;
    }
    
    // Otherwise, evaluate new goals
    this.evaluateNewGoals();
  }
  
  // Evaluate and select new goals
  evaluateNewGoals() {
    // Delegate to faction-specific strategy
    const possibleGoals = [
      ...this.strategy.evaluateEconomicGoals(),
      ...this.strategy.evaluateMilitaryGoals(),
      ...this.strategy.evaluateExpansionGoals(),
      ...this.strategy.evaluateDefenseGoals()
    ];
    
    // Filter out goals with 0 utility
    const validGoals = possibleGoals.filter(g => g.utility > 0);
    
    // Sort by utility (highest first)
    validGoals.sort((a, b) => b.utility - a.utility);
    
    if (validGoals.length > 0) {
      const topGoal = validGoals[0];
      console.log(`${this.house.name}: Selecting goal ${topGoal.type} (utility: ${topGoal.utility.toFixed(1)})`);
      
      // Create goal chain to resolve dependencies
      this.currentGoalChain = GoalChain.create(this.house, topGoal);
      
      // Log the plan
      const summary = this.currentGoalChain.getSummary();
      console.log(`${this.house.name}: Goal chain has ${summary.totalSteps} steps: ${summary.remaining.join(' → ')}`);
      
      this.executeCurrentGoal();
    } else {
      console.log(`${this.house.name}: No valid goals to pursue`);
    }
  }
  
  // Execute current goal in the chain
  executeCurrentGoal() {
    const goal = this.currentGoalChain.getCurrentGoal();
    
    if (!goal) {
      console.log(`${this.house.name}: Goal chain complete`);
      this.currentGoalChain = null;
      return;
    }
    
    if (goal.canExecute(this.house)) {
      console.log(`${this.house.name}: Executing ${goal.type}`);
      
      try {
        goal.execute(this.house);
        goal.status = 'COMPLETED';
        this.currentGoalChain.advance();
        
        // Log progress
        const progress = (this.currentGoalChain.getProgress() * 100).toFixed(0);
        console.log(`${this.house.name}: Goal chain ${progress}% complete`);
        
      } catch (error) {
        console.error(`${this.house.name}: Error executing ${goal.type}:`, error);
        goal.status = 'FAILED';
        this.currentGoalChain = null; // Abort chain on error
      }
    } else {
      // Goal is blocked
      const blocking = goal.getBlockingFactors(this.house);
      console.log(`${this.house.name}: Goal ${goal.type} blocked by:`, 
        blocking.map(b => b.type === 'RESOURCE' 
          ? `${b.resource}(need ${b.need}, have ${b.have})`
          : `building:${b.value}`
        ).join(', ')
      );
      
      goal.status = 'BLOCKED';
      
      // If goal is gathering resources, it's a waiting goal
      if (goal.type === 'GATHER_RESOURCE') {
        goal.execute(this.house); // Updates status
        if (goal.status === 'COMPLETED') {
          this.currentGoalChain.advance();
        }
      }
    }
  }
  
  // Get AI status for debugging
  getStatus() {
    return {
      faction: this.house.type,
      name: this.house.name,
      currentGoal: this.currentGoalChain 
        ? this.currentGoalChain.getCurrentGoal()?.type 
        : 'none',
      goalProgress: this.currentGoalChain
        ? (this.currentGoalChain.getProgress() * 100).toFixed(0) + '%'
        : 'N/A',
      territory: {
        center: this.territory.coreBase?.center,
        radius: this.territory.coreBase?.radius,
        buildings: this.territory.coreBase?.buildings.length || 0,
        outposts: this.territory.outposts.length
      },
      knowledge: this.knowledge.getStats(),
      resources: this.house.stores
    };
  }
}

module.exports = FactionAI;

