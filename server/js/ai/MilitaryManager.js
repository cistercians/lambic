// Military Manager
// Handles scouting parties, attack forces, and military unit selection

const ScoutingParty = require('./ScoutingParty');
const FollowBehavior = require('./FollowBehavior');

class MilitaryManager {
  constructor(house, factionAI) {
    this.house = house;
    this.factionAI = factionAI;
    this.scoutingParties = []; // Active scouting parties
    this.activeAttackForces = [];
  }
  
  // Deploy a scouting party to a target zone (flexible 1-3 units)
  deployScoutingParty(targetZone, resourceType) {
    const logger = this.factionAI?.logger;
    
    // Select leader (prefer mounted military unit)
    const leader = this.selectScoutLeader();
    if (!leader) {
      return null;
    }
    
    // Try to select up to 2 backup units (but accept 0-2)
    const backups = this.selectBackupUnits(2, leader);
    const totalUnits = 1 + backups.length;
    
    // Determine unit selection reasoning
    const militaryUnits = this.getMilitaryUnits();
    const mountedUnits = militaryUnits.filter(unit => 
      unit.name && (
        unit.name.includes('cavalier') || 
        unit.name.includes('cavalry') || 
        unit.name.includes('horseman') ||
        unit.name.includes('knight') ||
        unit.name.includes('mounted')
      )
    );
    const reasoning = mountedUnits.length > 0 ? 'Selected mounted leader (preferred)' : 'No mounted units available, selected any military unit';
    
    // Remove any existing flags before adding new one (prevent stacking)
    if (leader.name && leader.name.includes('🚩')) {
      leader.name = leader.name.replace(/🚩\s*/g, '').trim();
    }
    
    // Mark leader with banner emoji
    leader.name = `🚩 ${leader.name}`;
    
    // Create party (works with 0-2 backups)
    const party = new ScoutingParty(leader, backups, targetZone, resourceType);
    this.scoutingParties.push(party);
    
    // Assign behaviors
    leader.scoutingParty = party;
    backups.forEach(unit => {
      unit.followBehavior = new FollowBehavior(unit, leader);
      unit.scoutingParty = party;
    });
    
    // Assign mission orders to units
    party.assignMissionOrders();
    
    if (logger) {
      logger.collectAction('Deploying scouting party', {
        reasoning: `${totalUnits} units (${reasoning})`
      });
    }
    
    // Note: ScoutingParty constructor logs deployment details
    return party;
  }
  
  // Helper to get unit type name
  getUnitType(unit) {
    if (!unit || !unit.name) return 'unknown';
    const name = unit.name.toLowerCase();
    if (name.includes('cavalier') || name.includes('cavalry') || name.includes('horseman') || name.includes('knight') || name.includes('mounted')) {
      return 'mounted';
    }
    if (name.includes('archer')) return 'archer';
    if (name.includes('soldier')) return 'soldier';
    return 'infantry';
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
  
  // Get all military units belonging to this faction (always delegates to FactionAI for caching)
  getMilitaryUnits() {
    if (!this.factionAI || !this.factionAI.getMilitaryUnits) {
      console.warn(`[MilitaryManager] FactionAI not available for ${this.house.name}`);
      return [];
    }
    
    // Single source of truth: always use FactionAI (which handles caching)
    return this.factionAI.getMilitaryUnits();
  }
  
  // Update all active scouting parties
  updateScoutingParties() {
    for (let i = this.scoutingParties.length - 1; i >= 0; i--) {
      const party = this.scoutingParties[i];
      party.update();
      
      // Remove completed parties (they clean themselves up)
      if (party.status === 'completed' || party.status === 'failed') {
        this.scoutingParties.splice(i, 1);
      }
    }
  }
  
  // Handle scouting party completion
  onScoutingComplete(targetZone, purpose, enemiesFound) {
    if (enemiesFound) {
      this.planAttackForce(targetZone);
    } else {
      this.factionAI.planOutpost(targetZone, purpose);
    }
  }
  
  // Handle scouting party failure
  onScoutingFailed(targetZone, purpose) {
    // Mark zone as hostile for future reference
    if (this.factionAI && this.factionAI.knowledge) {
      this.factionAI.knowledge.reportDiscovery(null, {
        type: 'ENEMY',
        location: targetZone.center,
        threatLevel: 'high',
        tiles: targetZone.tileArray
      });
    }
  }
  
  // Plan attack force for contested zone
  planAttackForce(targetZone) {
    const attackForce = this.assembleAttackForce(targetZone.center, 'high');
    if (attackForce) {
      this.deployAttackForce(attackForce, targetZone);
    }
  }
  
  // Assemble attack force based on threat level
  assembleAttackForce(targetLocation, threatLevel) {
    const logger = this.factionAI?.logger;
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
    const originalForceSize = forceSize;
    forceSize = Math.min(forceSize, militaryUnits.length);
    
    if (forceSize < 3) {
      // Not enough units - don't log (silent failure)
      return null;
    }
    
    // Select strongest units
    const selectedUnits = militaryUnits.slice(0, forceSize);
    
    if (logger) {
      logger.collectAction('Assembled attack force', {
        reasoning: `${forceSize} units for ${threatLevel} threat`
      });
    }
    
    return {
      units: selectedUnits,
      target: targetLocation,
      threatLevel: threatLevel,
      status: 'assembled'
    };
  }
  
  // Deploy attack force to target zone
  deployAttackForce(force, targetZone) {
    const logger = this.factionAI?.logger;
    
    // Set all units to move to target zone
    force.units.forEach(unit => {
      unit.moveTo(targetZone.center[0], targetZone.center[1]);
      unit.action = 'combat'; // Ready for combat
    });
    
    force.status = 'deployed';
    this.activeAttackForces.push(force);
    
    if (logger) {
      logger.collectAction('Deployed attack force', {
        reasoning: `${force.units.length} units to engage ${force.threatLevel} threat`
      });
    }
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

module.exports = MilitaryManager;


