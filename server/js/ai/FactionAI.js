// Faction AI Controller
// Main decision-making system that evaluates goals daily and coordinates faction behavior

const FactionKnowledge = require('./FactionKnowledge');
const TerritoryManager = require('./TerritoryManager');
const ResourcePlanner = require('./ResourcePlanner');
const GoalChain = require('./GoalChain');
const FactionProfiles = require('./FactionProfiles');
const ScoutingParty = require('./ScoutingParty');
const FollowBehavior = require('./FollowBehavior');

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
    this.lastEvaluatedDay = 0; // Track last day evaluated to prevent duplicates
    this.activeScoutingParties = []; // Track active scouting expeditions
    this.activeAttackForces = []; // Track active military expeditions
    
    // Load faction profile and strategy (use house.name for faction type)
    this.profile = FactionProfiles[house.name] || FactionProfiles.Goths;
    this.strategy = this.loadStrategy();
    
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
    
    // Recalculate base territory (dynamic expansion)
    if (this.house.calculateBaseTerritory) {
      this.house.calculateBaseTerritory();
    }
    
    // Update patrol list
    if (this.house.updatePatrolList) {
      this.house.updatePatrolList();
    }
    
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
    
    // Update active scouting parties and attack forces
    this.updateScoutingParties();
    this.updateAttackForces();
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
      
      // Create goal chain to resolve dependencies
      this.currentGoalChain = GoalChain.create(this.house, topGoal);
      
      this.executeCurrentGoal();
    }
  }
  
  // Execute current goal in the chain
  executeCurrentGoal() {
    const goal = this.currentGoalChain.getCurrentGoal();
    
    if (!goal) {
      this.currentGoalChain = null;
      return;
    }
    
    if (goal.canExecute(this.house)) {
      try {
        goal.execute(this.house);
        goal.status = 'COMPLETED';
        this.currentGoalChain.advance();
      } catch (error) {
        goal.status = 'FAILED';
        this.currentGoalChain = null; // Abort chain on error
      }
    } else {
      
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

  // Deploy a scouting party to a target zone (flexible 1-3 units)
  deployScoutingParty(targetZone, resourceType) {
    // Select leader (prefer mounted military unit)
    const leader = this.selectScoutLeader();
    if (!leader) {
      return null;
    }
    
    // Try to select up to 2 backup units (but accept 0-2)
    const backups = this.selectBackupUnits(2, leader);
    const totalUnits = 1 + backups.length;
    
    // Log party composition
    if (backups.length === 2) {
    } else if (backups.length === 1) {
    } else {
    }
    
    // Mark leader with banner emoji
    leader.name = `🚩 ${leader.name}`;
    
    // Create party (works with 0-2 backups)
    const party = new ScoutingParty(leader, backups, targetZone, resourceType);
    this.activeScoutingParties.push(party);
    
    // Assign behaviors
    leader.scoutingParty = party;
    backups.forEach(unit => {
      unit.followBehavior = new FollowBehavior(unit, leader);
      unit.scoutingParty = party;
    });
    
    return party;
  }

  // Select the best leader for a scouting party (prefer mounted units)
  selectScoutLeader() {
    const militaryUnits = this.getMilitaryUnits();
    
    // Prefer mounted units
    const mountedUnits = militaryUnits.filter(unit => 
      unit.name && (
        unit.name.includes('cavalier') || 
        unit.name.includes('cavalry') || 
        unit.name.includes('horseman') ||
        unit.name.includes('knight') ||
        unit.name.includes('mounted')
      )
    );
    
    if (mountedUnits.length > 0) {
      return mountedUnits[0];
    }
    
    // Fall back to any military unit
    return militaryUnits.length > 0 ? militaryUnits[0] : null;
  }

  // Select backup units for scouting party
  selectBackupUnits(count, excludeLeader) {
    const militaryUnits = this.getMilitaryUnits();
    const availableUnits = militaryUnits.filter(unit => unit.id !== excludeLeader.id);
    
    return availableUnits.slice(0, count);
  }

  // Get all military units belonging to this faction
  getMilitaryUnits() {
    const militaryUnits = [];
    
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove || !player.house || player.house.id !== this.house.id) continue;
      
      // Check if unit is military (not serf, not civilian)
      if (player.name && !player.name.includes('serf') && !player.name.includes('civilian')) {
        militaryUnits.push(player);
      }
    }
    
    return militaryUnits;
  }

  // Update all active scouting parties
  updateScoutingParties() {
    for (let i = this.activeScoutingParties.length - 1; i >= 0; i--) {
      const party = this.activeScoutingParties[i];
      party.update();
      
      // Remove completed parties
      if (party.status === 'completed' || party.status === 'failed') {
        this.activeScoutingParties.splice(i, 1);
      }
    }
  }

  // Handle scouting party completion
  onScoutingComplete(targetZone, purpose, enemiesFound) {
    if (enemiesFound) {
      this.planAttackForce(targetZone);
    } else {
      this.planOutpost(targetZone, purpose);
    }
  }

  // Handle scouting party failure
  onScoutingFailed(targetZone, purpose) {
    // Mark zone as hostile for future reference
    this.knowledge.reportDiscovery(null, {
      type: 'ENEMY',
      location: targetZone.center,
      threatLevel: 'high',
      tiles: targetZone.tileArray
    });
  }

  // Plan attack force for contested zone
  planAttackForce(targetZone) {
    const attackForce = this.assembleAttackForce(targetZone.center, 'high');
    if (attackForce) {
      this.deployAttackForce(attackForce, targetZone);
    }
  }

  // Plan outpost construction
  planOutpost(targetZone, resourceType) {
    // This will be implemented when we create OutpostPlanner
  }

  // Assemble attack force based on threat level
  assembleAttackForce(targetLocation, threatLevel) {
    const militaryUnits = this.getMilitaryUnits();
    
    // Determine force size based on threat level
    let forceSize;
    switch (threatLevel) {
      case 'low': forceSize = 3; break;
      case 'medium': forceSize = 5; break;
      case 'high': forceSize = 8; break;
      default: forceSize = 5;
    }
    
    // Limit by available units
    forceSize = Math.min(forceSize, militaryUnits.length);
    
    if (forceSize < 3) {
      return null;
    }
    
    // Select strongest units
    const selectedUnits = militaryUnits.slice(0, forceSize);
    
    return {
      units: selectedUnits,
      target: targetLocation,
      threatLevel: threatLevel,
      status: 'assembled'
    };
  }

  // Deploy attack force to target zone
  deployAttackForce(force, targetZone) {
    
    // Set all units to move to target zone
    force.units.forEach(unit => {
      unit.moveTo(targetZone.center[0], targetZone.center[1]);
      unit.action = 'combat'; // Ready for combat
    });
    
    force.status = 'deployed';
    this.activeAttackForces.push(force);
  }

  // Update all active attack forces
  updateAttackForces() {
    for (let i = this.activeAttackForces.length - 1; i >= 0; i--) {
      const force = this.activeAttackForces[i];
      
      // Check if force has reached target
      const allAtTarget = force.units.every(unit => {
        if (unit.toRemove) return true; // Consider dead units as "at target"
        
        const distance = Math.sqrt(
          Math.pow(unit.x - force.target[0], 2) + 
          Math.pow(unit.y - force.target[1], 2)
        );
        return distance <= 10;
      });
      
      if (allAtTarget && force.status === 'deployed') {
        force.status = 'engaged';
      }
      
      // Remove completed forces
      if (force.status === 'completed' || force.status === 'defeated') {
        this.activeAttackForces.splice(i, 1);
      }
    }
  }
}

module.exports = FactionAI;

