// Scouting Party System
// Manages groups of units exploring zones for resources

class ScoutingParty {
  constructor(leader, backupUnits, targetZone, purpose) {
    this.leader = leader; // Military unit (prefer mounted)
    this.backupUnits = backupUnits; // Array of 0-2 backup units (flexible party size)
    this.targetZone = targetZone;
    this.purpose = purpose; // 'resource_scout', 'establish_outpost'
    this.status = 'traveling'; // traveling, scouting, retreating, guarding
    this.idleTimer = 0;
    this.idleDuration = 300; // 5 minutes at zone (300 seconds)
    this.enemiesEncountered = [];
    this.startTime = Date.now();
    this.retreatTriggered = false;
  }

  // Update scouting party state
  update() {
    switch (this.status) {
      case 'traveling':
        this.updateTraveling();
        break;
      case 'scouting':
        this.updateScouting();
        break;
      case 'retreating':
        this.updateRetreating();
        break;
      case 'guarding':
        this.updateGuarding();
        break;
    }
  }

  // Check if leader has reached target zone
  updateTraveling() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'retreating';
      return;
    }

    const leaderPos = [this.leader.x, this.leader.y];
    const zoneCenter = this.targetZone.center;
    const distance = this.getDistance(leaderPos, zoneCenter);

    // Consider reached if within 10 tiles of zone center
    if (distance <= 10) {
      this.status = 'scouting';
      this.idleTimer = 0;
      console.log(`Scouting party reached ${this.targetZone.name}, beginning reconnaissance`);
    }
  }

  // Scout the zone for enemies and resources
  updateScouting() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'retreating';
      return;
    }

    this.idleTimer++;

    // Scan for enemies every 10 seconds
    if (this.idleTimer % 10 === 0) {
      const enemies = this.scanForEnemies();
      if (enemies.length > 0) {
        console.log(`Scouting party detected ${enemies.length} enemies, initiating retreat`);
        this.triggerRetreat();
        return;
      }
    }

    // If no enemies found after idle duration, begin outpost planning
    if (this.idleTimer >= this.idleDuration) {
      console.log(`Scouting party completed reconnaissance of ${this.targetZone.name}, zone is clear`);
      this.status = 'guarding';
      this.notifyZoneClear();
    }
  }

  // Handle retreat back to HQ
  updateRetreating() {
    if (!this.leader || this.leader.toRemove) {
      this.checkRetreatSuccess();
      return;
    }

    // Check if leader reached HQ
    const leaderPos = [this.leader.x, this.leader.y];
    const hqPos = this.leader.house.hq;
    const distance = this.getDistance(leaderPos, hqPos);

    if (distance <= 5) {
      console.log(`Scouting party leader returned to HQ`);
      this.checkRetreatSuccess();
    }
  }

  // Guard the outpost location
  updateGuarding() {
    // Keep units at the zone center
    if (this.leader && !this.leader.toRemove) {
      const zoneCenter = this.targetZone.center;
      const leaderPos = [this.leader.x, this.leader.y];
      const distance = this.getDistance(leaderPos, zoneCenter);

      // If too far from zone center, move back
      if (distance > 15) {
        this.leader.moveTo(zoneCenter[0], zoneCenter[1]);
      }
    }
  }

  // Scan for enemies in the zone
  scanForEnemies() {
    const enemies = [];
    const zoneCenter = this.targetZone.center;
    const scanRadius = 20;

    // Check all players in the area
    for (const [id, player] of Object.entries(Player.list)) {
      if (player.toRemove || !player.house) continue;
      
      // Skip if same faction
      if (player.house.id === this.leader.house.id) continue;

      const playerPos = [player.x, player.y];
      const distance = this.getDistance(playerPos, zoneCenter);

      if (distance <= scanRadius) {
        enemies.push({
          id: player.id,
          name: player.name,
          house: player.house.name,
          position: playerPos,
          distance: distance
        });
      }
    }

    return enemies;
  }

  // Trigger retreat for entire party
  triggerRetreat() {
    this.status = 'retreating';
    this.retreatTriggered = true;

    // Set leader to retreat
    if (this.leader && !this.leader.toRemove) {
      this.leader.action = 'retreat';
      this.leader.retreatTarget = this.leader.house.hq;
    }

    // Set backup units to retreat
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove) {
        unit.action = 'retreat';
        unit.retreatTarget = unit.house.hq;
      }
    });

    console.log(`Scouting party retreating from ${this.targetZone.name}`);
  }

  // Check if retreat was successful (at least one unit returned)
  checkRetreatSuccess() {
    let survivors = 0;
    const hqPos = this.leader.house.hq;

    // Check leader
    if (this.leader && !this.leader.toRemove) {
      const leaderPos = [this.leader.x, this.leader.y];
      const distance = this.getDistance(leaderPos, hqPos);
      if (distance <= 5) survivors++;
    }

    // Check backup units
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove) {
        const unitPos = [unit.x, unit.y];
        const distance = this.getDistance(unitPos, hqPos);
        if (distance <= 5) survivors++;
      }
    });

    if (survivors > 0) {
      console.log(`Scouting party retreat successful: ${survivors} units returned`);
      this.notifyRetreatSuccess();
    } else {
      console.log(`Scouting party retreat failed: no units returned`);
      this.notifyRetreatFailure();
    }

    // Clean up the party
    this.cleanup();
  }

  // Notify that zone is clear for outpost construction
  notifyZoneClear() {
    if (this.leader && this.leader.house && this.leader.house.ai) {
      this.leader.house.ai.onScoutingComplete(this.targetZone, this.purpose, false);
    }
  }

  // Notify successful retreat (enemies found)
  notifyRetreatSuccess() {
    if (this.leader && this.leader.house && this.leader.house.ai) {
      this.leader.house.ai.onScoutingComplete(this.targetZone, this.purpose, true);
    }
  }

  // Notify retreat failure (party wiped out)
  notifyRetreatFailure() {
    if (this.leader && this.leader.house && this.leader.house.ai) {
      this.leader.house.ai.onScoutingFailed(this.targetZone, this.purpose);
    }
  }

  // Clean up the scouting party
  cleanup() {
    // Remove banner from leader
    if (this.leader && this.leader.name && this.leader.name.startsWith('🚩')) {
      this.leader.name = this.leader.name.substring(2).trim();
    }

    // Clear scouting party references
    if (this.leader) {
      this.leader.scoutingParty = null;
    }
    
    this.backupUnits.forEach(unit => {
      if (unit) {
        unit.scoutingParty = null;
        unit.followBehavior = null;
      }
    });

    // Remove from faction's active parties
    if (this.leader && this.leader.house && this.leader.house.ai) {
      const index = this.leader.house.ai.activeScoutingParties.indexOf(this);
      if (index > -1) {
        this.leader.house.ai.activeScoutingParties.splice(index, 1);
      }
    }
  }

  // Helper: Calculate distance between two points
  getDistance(point1, point2) {
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Get party status for debugging
  getStatus() {
    return {
      status: this.status,
      leader: this.leader ? this.leader.name : 'None',
      backupCount: this.backupUnits.filter(u => u && !u.toRemove).length,
      targetZone: this.targetZone.name,
      purpose: this.purpose,
      idleTimer: this.idleTimer,
      enemiesEncountered: this.enemiesEncountered.length,
      retreatTriggered: this.retreatTriggered
    };
  }
}

module.exports = ScoutingParty;
