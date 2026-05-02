// Military Manager
// Handles scouting parties, attack forces, and military unit selection

const ScoutingParty = require('./ScoutingParty');
const FollowBehavior = require('./FollowBehavior');
const movementSystem = require('../core/MovementSystem');

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
    const factionName = this.factionAI?.house?.name || 'Unknown';
    console.log(`[SCOUT DEPLOY] ${factionName}: deployScoutingParty() called for zone: ${targetZone?.id || targetZone?.name || 'unknown'}, purpose: ${resourceType}`);

    const maxParties = this.getMaxScoutingParties();
    if (this.scoutingParties.length >= maxParties) {
      console.log(`[SCOUT DEPLOY] ${factionName}: Failed - scouting party capacity reached (${this.scoutingParties.length}/${maxParties})`);
      return null;
    }

    if (this.hasActiveScoutingPartyForZone(targetZone)) {
      console.log(`[SCOUT DEPLOY] ${factionName}: Failed - active scouting party already targeting ${targetZone?.id || targetZone?.name || 'unknown'}`);
      return null;
    }
    
    // Select leader (prefer mounted military unit)
    const leader = this.selectScoutLeader();
    if (!leader) {
      console.log(`[SCOUT DEPLOY] ${factionName}: Failed - No scout leader available`);
      return null;
    }
    
    console.log(`[SCOUT DEPLOY] ${factionName}: Selected leader: ${leader.id || 'unknown'}`);
    
    // Try to select up to 2 backup units (but accept 0-2)
    const backups = this.selectBackupUnits(2, leader);
    const totalUnits = 1 + backups.length;
    
    // Determine unit selection reasoning
    const militaryUnits = this.getAvailableScoutingUnits();
    const mountedUnits = militaryUnits.filter(unit => {
      if (!unit.name) return false;
      const name = unit.name.toLowerCase();
      return (
        name.includes('cavalier') ||
        name.includes('cavalry') ||
        name.includes('horseman') ||
        name.includes('knight') ||
        name.includes('mounted')
      );
    });
    const reasoning = mountedUnits.length > 0 ? 'Selected mounted leader (preferred)' : 'No mounted units available, selected any military unit';
    
    // Remove any existing flags before adding new one (prevent stacking)
    if (leader.name && leader.name.includes('🚩')) {
      leader.name = leader.name.replace(/🚩\s*/g, '').trim();
    }
    
    // Mark leader with banner emoji
    leader.name = `🚩 ${leader.name}`;
    
    // Create party (works with 0-2 backups)
    console.log(`[SCOUT DEPLOY] ${factionName}: Creating ScoutingParty with ${backups.length} backup units`);
    const party = new ScoutingParty(leader, backups, targetZone, resourceType);
    
    if (!party) {
      console.log(`[SCOUT DEPLOY] ${factionName}: Failed - ScoutingParty constructor returned null`);
      return null;
    }
    
    this.scoutingParties.push(party);
    console.log(`[SCOUT DEPLOY] ${factionName}: ScoutingParty created successfully, total parties: ${this.scoutingParties.length}`);
    
    // Assign behaviors
    leader.scoutingParty = party;
    backups.forEach(unit => {
      unit.followBehavior = new FollowBehavior(unit, leader);
      unit.scoutingParty = party;
    });
    
    // Assign mission orders to units
    party.assignMissionOrders();
    console.log(`[SCOUT DEPLOY] ${factionName}: Mission orders assigned to scouting party`);
    
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
    const militaryUnits = this.getAvailableScoutingUnits();
    
    // Prefer mounted units
    const mountedUnits = militaryUnits.filter(unit => {
      if (!unit.name) return false;
      const name = unit.name.toLowerCase();
      return (
        name.includes('cavalier') ||
        name.includes('cavalry') ||
        name.includes('horseman') ||
        name.includes('knight') ||
        name.includes('mounted')
      );
    });
    
    if (mountedUnits.length > 0) {
      return mountedUnits[0];
    }
    
    // Fall back to any military unit
    return militaryUnits.length > 0 ? militaryUnits[0] : null;
  }
  
  // Select backup units for scouting party
  selectBackupUnits(count, excludeLeader) {
    const militaryUnits = this.getAvailableScoutingUnits();
    const availableUnits = militaryUnits.filter(unit => unit.id !== excludeLeader.id);
    
    return availableUnits.slice(0, count);
  }

  getAvailableScoutingUnits() {
    return this.getMilitaryUnits().filter(unit => {
      if (!unit || unit.toRemove) return false;
      if (unit.scoutingParty) return false;
      return true;
    });
  }

  getMaxScoutingParties() {
    const totalUnits = this.getMilitaryUnits().filter(unit => unit && !unit.toRemove).length;
    if (totalUnits <= 0) return 0;
    return Math.max(1, Math.floor(totalUnits / 3));
  }

  hasActiveScoutingPartyForZone(targetZone) {
    if (!targetZone) return false;
    const targetId = targetZone.id || null;
    const targetCenter = Array.isArray(targetZone.center) ? targetZone.center.join(',') : null;
    return this.scoutingParties.some(party => {
      if (!party || party.status === 'failed') return false;
      const partyZone = party.targetZone || {};
      if (targetId && partyZone.id === targetId) return true;
      const partyCenter = Array.isArray(partyZone.center) ? partyZone.center.join(',') : null;
      return targetCenter && partyCenter === targetCenter;
    });
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
    if (!targetZone) {
      console.warn(`[MilitaryManager] ${this.house.name}: scouting completion ignored because target zone is missing`);
      return;
    }

    if (enemiesFound) {
      this.planAttackForce(targetZone);
    } else {
      // Zone is clear - mark it as known (zones are only added to knownZones after successful scout return)
      if (targetZone && targetZone.id && this.factionAI && this.factionAI.knowledge) {
        this.factionAI.knowledge.markZoneAsKnown(targetZone);
      }
      
      this.factionAI.planOutpost(targetZone, purpose);
    }
  }
  
  // Handle scouting party failure
  onScoutingFailed(targetZone, purpose) {
    if (!targetZone || !targetZone.center) {
      console.warn(`[MilitaryManager] ${this.house.name}: scouting failure ignored because target zone is missing`);
      return;
    }

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
      if (!unit) {
        return;
      }
      const targetCenter = targetZone.center || [0, 0];
      const tileSize = global.tileSize || 64;
      const targetCol = targetCenter[0] < 1000
        ? targetCenter[0]
        : Math.floor(targetCenter[0] / tileSize);
      const targetRow = targetCenter[1] < 1000
        ? targetCenter[1]
        : Math.floor(targetCenter[1] / tileSize);
      const targetZ = unit.z || 0;

      movementSystem.applyMoveIntent(unit, {
        z: targetZ,
        target: [targetCol, targetRow],
        reason: 'combat',
        sourceAction: unit.action || 'combat'
      });
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


