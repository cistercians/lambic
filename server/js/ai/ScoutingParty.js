// Scouting Party System
// Manages groups of units exploring zones for resources with day-based scouting

class ScoutingParty {
  constructor(leader, backupUnits, targetZone, purpose) {
    this.leader = leader; // Military unit (prefer mounted)
    this.backupUnits = backupUnits || []; // Array of 0-2 backup units (flexible party size)
    this.targetZone = targetZone;
    this.purpose = purpose; // 'resource_scout', resource type ('stone', 'wood', etc.), or 'establish_outpost'
    this.status = 'rallying'; // rallying, traveling, waiting_for_nightfall, camping, returning, failed
    this.arrivalDay = null; // Day when party reached target zone
    this.deploymentDay = global.day || 1; // Day when party was deployed (for rallying timeout)
    this.lastDay = global.day || 1; // Last day tracked for day change detection
    this.campfire = null; // ID of InfiniteFire item for campfire
    this.contestedBannerPlaced = false; // Flag to ensure only one contested banner per mission
    this.startTime = Date.now();
    this.enemiesEncountered = [];
    this.unitHP = new Map(); // Track unit HP for damage detection
    
    // Initialize unit HP tracking
    if (this.leader) {
      this.unitHP.set(this.leader.id, this.leader.hp || 100);
    }
    this.backupUnits.forEach(unit => {
      if (unit) {
        this.unitHP.set(unit.id, unit.hp || 100);
      }
    });
    
    // Log party deployment
    const factionName = this.leader ? (this.leader.house ? this.leader.house.name : 'Unknown') : 'Unknown';
    const leaderName = this.leader ? this.leader.name : 'Unknown';
    const targetCoords = targetZone && targetZone.center ? targetZone.center : [0, 0];
    const totalUnits = 1 + (this.backupUnits ? this.backupUnits.length : 0);
    const logMessage = `[SCOUT] ${factionName}: Party deployed - Leader: ${leaderName}, Target: [${targetCoords[0]}, ${targetCoords[1]}], Purpose: ${purpose}, Units: ${totalUnits}`;
    console.log(logMessage);
    
    // Create Event Manager event for scouting party departure
    if (global.eventManager && this.leader && this.leader.house) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        action: 'departed on scouting mission',
        target: targetZone ? (targetZone.id || null) : null,
        targetName: targetZone ? (targetZone.name || `Zone at [${targetCoords[0]}, ${targetCoords[1]}]`) : null,
        house: this.leader.house.id,
        houseName: factionName,
        quantity: totalUnits,
        communication: global.eventManager.commModes.NONE,
        position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
        log: logMessage,
        metadata: { purpose, targetZone: targetCoords, unitCount: totalUnits }
      });
    }
    
    // Record deployment in logger for daily report
    if (this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.logger) {
      this.leader.house.ai.logger.recordScoutingDeployment();
    }
    
    // Initialize nightfall tracking (must be set in constructor for dawn detection)
    if (global.gameState) {
      this.lastNightfallState = global.gameState.nightfall || false;
    } else {
      this.lastNightfallState = false; // Default to day if gameState not available
    }
  }
  
  // Assign mission orders to units (called after party creation)
  assignMissionOrders() {
    if (this.missionOrdersAssigned) {
      return; // Already assigned
    }
    
    if (!this.leader || this.leader.toRemove) {
      return;
    }
    
    // Set leader to idle initially (waiting for dawn)
    if (this.leader.mode !== undefined) {
      this.leader.mode = 'idle';
    }
    if (this.leader.action !== undefined) {
      this.leader.action = 'idle';
    }
    
    // Backup units should follow leader (followBehavior is already assigned in MilitaryManager)
    // Ensure followBehavior is active
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove) {
        if (!unit.followBehavior) {
          const FollowBehavior = require('./FollowBehavior');
          unit.followBehavior = new FollowBehavior(unit, this.leader);
        }
        // Set mode to follow/idle so they stay near leader
        if (unit.mode !== undefined) {
          unit.mode = 'idle';
        }
        if (unit.action !== undefined) {
          unit.action = 'idle';
        }
      }
    });
    
    this.missionOrdersAssigned = true;
    
    const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
    console.log(`[SCOUT] ${factionName}: Mission orders assigned - units rallying around leader`);
  }
  
  // Start traveling to target (called at dawn)
  startTravelingToTarget() {
    if (!this.leader || this.leader.toRemove || !this.targetZone || !this.targetZone.center) {
      return;
    }
    
    // Get target zone center coordinates
    const targetCenter = this.targetZone.center;
    let targetTileX, targetTileY;
    
    // Determine if we have tile coordinates or pixel coordinates
    if (targetCenter.length >= 2) {
      if (targetCenter[0] < 1000) {
        // Tile coordinates
        targetTileX = targetCenter[0];
        targetTileY = targetCenter[1];
      } else {
        // Pixel coordinates - convert to tiles
        targetTileX = Math.floor(targetCenter[0] / 64);
        targetTileY = Math.floor(targetCenter[1] / 64);
      }
    } else {
      return; // Invalid target
    }
    
    // Set leader mode and give movement order
    if (this.leader.mode !== undefined) {
      this.leader.mode = 'scout';
    }
    
    // Give leader movement order to target location (moveTo takes z, tileX, tileY)
    if (this.leader.moveTo && typeof this.leader.moveTo === 'function') {
      this.leader.moveTo(this.leader.z || 0, targetTileX, targetTileY);
    }
    
    // Update status to traveling
    this.status = 'traveling';
    
    const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
    console.log(`[SCOUT] ${factionName}: Party leader starting journey to target [${targetTileX}, ${targetTileY}]`);
  }

  // Update scouting party state
  update() {
    const currentDay = global.day || 1;
    
    // Update day tracking
    if (currentDay !== this.lastDay) {
      this.lastDay = currentDay;
      if (this.status === 'camping') {
        const factionName = this.leader ? (this.leader.house ? this.leader.house.name : 'Unknown') : 'Unknown';
        console.log(`[SCOUT] ${factionName}: Day changed during camping - Day ${currentDay} (arrived Day ${this.arrivalDay})`);
      }
    }
    
    // Check if party leader is dead - mission fails immediately
    if (!this.leader || this.leader.toRemove || (this.leader.hp !== undefined && this.leader.hp <= 0)) {
      if (this.status !== 'failed') {
        this.status = 'failed';
        const factionName = this.leader && this.leader.house ? this.leader.house.name : 'Unknown';
        console.log(`[SCOUT] ${factionName}: Mission failed - party leader died`);
        this.cleanupCampfire();
        this.triggerRetreat();
      }
      return;
    }
    
    // Check for faction attacks (damage detection)
    this.checkForFactionAttack();
    
    // If status is failed, don't update further
    if (this.status === 'failed') {
      return;
    }
    
    // Update follow behaviors for backup units
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove && unit.followBehavior && unit.followBehavior.update) {
        unit.followBehavior.update();
      }
    });
    
    // Debug logging for rallying state
    if (this.status === 'rallying') {
      const factionName = this.leader ? (this.leader.house ? this.leader.house.name : 'Unknown') : 'Unknown';
      const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
      console.log(`[SCOUT DEBUG] ${factionName}: update() called - status: ${this.status}, day: ${currentDay}, deploymentDay: ${this.deploymentDay}, nightfall: ${currentNightfall}`);
    }
    
    switch (this.status) {
      case 'rallying':
        this.updateRallying();
        break;
      case 'traveling':
        this.updateTraveling();
        break;
      case 'waiting_for_nightfall':
        this.updateWaitingForNightfall();
        break;
      case 'camping':
        this.updateCamping();
        break;
      case 'returning':
        this.updateReturning();
        break;
      default:
        break;
    }
  }

  // Update rallying state (units gather around leader, wait for dawn)
  updateRallying() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      return;
    }
    
    const currentDay = global.day || 1;
    const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
    const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
    
    // Improved dawn detection: check if it's currently day (not night) when in rallying state
    const isDay = !currentNightfall;
    
    // Check if day has changed since deployment
    const dayChanged = currentDay > this.deploymentDay;
    
    // Timeout fallback: if party has been rallying for more than 0.5 days (12 hours), force transition
    // Since we track by day, we use a fractional day check
    const daysRallying = currentDay - this.deploymentDay;
    // Reduced timeout: if day changed since deployment, or if same day and it's been more than half a day
    // Use a more aggressive timeout: if day changed OR if it's currently day and we deployed yesterday
    const timeoutReached = (daysRallying >= 1) || (daysRallying >= 0 && isDay && currentDay > this.deploymentDay);
    
    // More aggressive timeout: if it's currently day and we've been rallying (same day or next day), force transition
    const aggressiveTimeout = isDay && (daysRallying >= 0);
    
    // Immediate transition: if deployed during day on same day, start immediately
    const sameDayDeployment = currentDay === this.deploymentDay && isDay;
    
    // Force transition if all units are rallied (don't wait for dawn)
    // This allows parties to start immediately when ready, even during nightfall
    
    // Check if all units are rallied (within reasonable distance of leader)
    let allUnitsRallied = false;
    if (this.leader && this.units && this.units.length > 0) {
      const leaderLoc = global.getLoc ? global.getLoc(this.leader.x, this.leader.y) : [
        Math.floor(this.leader.x / 64),
        Math.floor(this.leader.y / 64)
      ];
      allUnitsRallied = this.units.every(unitId => {
        const unit = global.Player && global.Player.list ? global.Player.list[unitId] : null;
        if (!unit || unit.toRemove) return false;
        const unitLoc = global.getLoc ? global.getLoc(unit.x, unit.y) : [
          Math.floor(unit.x / 64),
          Math.floor(unit.y / 64)
        ];
        if (!unitLoc || !leaderLoc) return false;
        // Check if unit is within 3 tiles of leader
        const distance = Math.abs(unitLoc[0] - leaderLoc[0]) + Math.abs(unitLoc[1] - leaderLoc[1]);
        return distance <= 3;
      });
    }
    
    // Check for dawn transition (nightfall went from true to false)
    // Ensure lastNightfallState is initialized (fallback if constructor didn't set it)
    if (this.lastNightfallState === undefined) {
      this.lastNightfallState = currentNightfall;
    }
    const isDawn = this.lastNightfallState === true && currentNightfall === false;
    
    // Log transition condition values for debugging
    console.log(`[SCOUT DEBUG] ${factionName}: updateRallying() - isDay: ${isDay}, dayChanged: ${dayChanged}, timeoutReached: ${timeoutReached}, aggressiveTimeout: ${aggressiveTimeout}, sameDayDeployment: ${sameDayDeployment}, isDawn: ${isDawn}, currentDay: ${currentDay}, deploymentDay: ${this.deploymentDay}, daysRallying: ${daysRallying}, lastNightfallState: ${this.lastNightfallState}, currentNightfall: ${currentNightfall}`);
    
    // Time-based fallback: if rallying for > 6 hours (half day), force transition regardless of day/night
    const hoursRallying = (currentDay - this.deploymentDay) * 24; // Rough estimate (assuming 24 hours per day)
    const halfDayTimeout = hoursRallying >= 12 || (daysRallying >= 0.5);
    
    // Transition to traveling if:
    // 1. All units are rallied (don't wait for dawn if ready) - PRIORITY: start immediately when ready
    // 2. Same day deployment during day (immediate start)
    // 3. It's currently day (deployed during day, should start immediately)
    // 4. Dawn transition detected (night -> day)
    // 5. Day changed since deployment
    // 6. Aggressive timeout: if it's day and we've been rallying (force transition during day)
    // 7. Full day timeout reached (safety fallback)
    // 8. Half-day timeout: if rallying for > 6 hours, force transition
    if (allUnitsRallied || sameDayDeployment || isDay || isDawn || dayChanged || aggressiveTimeout || timeoutReached || halfDayTimeout) {
      this.lastNightfallState = currentNightfall;
      const reason = allUnitsRallied ? 'all units rallied' : sameDayDeployment ? 'same day deployment (daytime)' : isDay ? 'currently day' : isDawn ? 'dawn transition' : dayChanged ? 'day changed' : aggressiveTimeout ? 'aggressive timeout (daytime)' : halfDayTimeout ? 'half-day timeout' : 'timeout';
      console.log(`[SCOUT] ${factionName}: Rallying complete - transitioning to traveling (reason: ${reason}, day ${currentDay}, deployed day ${this.deploymentDay})`);
      
      // Verify startTravelingToTarget is called
      const statusBefore = this.status;
      this.startTravelingToTarget();
      const statusAfter = this.status;
      
      if (statusAfter === 'traveling') {
        console.log(`[SCOUT] ${factionName}: Successfully transitioned to traveling state`);
      } else {
        console.warn(`[SCOUT] ${factionName}: WARNING - startTravelingToTarget() called but status is still ${statusAfter} (was ${statusBefore})`);
      }
      return;
    }
    
    // Update last nightfall state
    this.lastNightfallState = currentNightfall;
    
    // Keep leader idle, backup units will follow (handled by followBehavior)
    // Ensure leader stays idle
    if (this.leader.mode !== undefined && this.leader.mode !== 'idle') {
      this.leader.mode = 'idle';
    }
  }
  
  // Check if leader has reached target zone
  updateTraveling() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      return;
    }
    
    // Ensure leader is moving - if not, initiate movement
    if (!this.leader.action || (this.leader.action === 'idle' && this.targetZone && this.targetZone.center)) {
      this.startTravelingToTarget();
    }

    const leaderPos = [this.leader.x, this.leader.y];
    const zoneCenter = this.targetZone.center;
    
    // Convert zone center to pixel coordinates if needed
    let targetX, targetY;
    if (zoneCenter.length >= 2) {
      if (zoneCenter[0] < 1000) {
        // Likely tile coordinates
        const getCenter = global.getCenter || (() => [0, 0]);
        const coords = getCenter(zoneCenter[0], zoneCenter[1]);
        targetX = coords[0];
        targetY = coords[1];
      } else {
        targetX = zoneCenter[0];
        targetY = zoneCenter[1];
      }
    } else {
      return; // Invalid target
    }
    
    const distance = this.getDistance(leaderPos, [targetX, targetY]);
    
    // Consider reached if within 10 tiles (640 pixels) of zone center
    const reachDistance = 10 * 64; // 10 tiles in pixels
    if (distance <= reachDistance) {
      this.status = 'waiting_for_nightfall';
      this.arrivalDay = global.day || 1;
      
      // Set leader to idle at destination
      if (this.leader.mode !== undefined) {
        this.leader.mode = 'idle';
      }
      if (this.leader.action !== undefined) {
        this.leader.action = 'idle';
      }
      
      // Log reaching destination
      const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
      const leaderName = this.leader.name || 'Unknown';
      const tileCoords = [Math.floor(targetX / 64), Math.floor(targetY / 64)];
      const logMessage = `[SCOUT] ${factionName}: Party reached destination at [${tileCoords[0]}, ${tileCoords[1]}] (Day ${this.arrivalDay})`;
      console.log(logMessage);
      
      // Create Event Manager event for reaching destination
      if (global.eventManager && this.leader && this.leader.house) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'reached scouting destination',
          target: this.targetZone ? (this.targetZone.id || null) : null,
          targetName: this.targetZone ? (this.targetZone.name || `Zone at [${tileCoords[0]}, ${tileCoords[1]}]`) : `Zone at [${tileCoords[0]}, ${tileCoords[1]}]`,
          house: this.leader.house.id,
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
          log: logMessage,
          metadata: { arrivalDay: this.arrivalDay, targetZone: tileCoords }
        });
      }
    } else {
      // Not at target yet - ensure movement continues
      // Re-issue movement order if leader is idle
      if (this.leader.action === 'idle' || !this.leader.action) {
        this.startTravelingToTarget();
      }
    }
  }

  // Wait until nightfall to build campfire
  updateWaitingForNightfall() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      return;
    }
    
    // Check if it's nightfall
    const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
    
    // Build campfire when nightfall occurs
    if (currentNightfall && !this.campfire) {
      this.buildCampfire();
    }
    
    // If campfire is built, transition to camping
    if (this.campfire) {
      this.status = 'camping';
      
      // Set leader to guard campfire (idle at campfire location)
      if (this.leader.mode !== undefined) {
        this.leader.mode = 'idle';
      }
      if (this.leader.action !== undefined) {
        this.leader.action = 'idle';
      }
    }
  }

  // Guard campfire overnight
  updateCamping() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      this.cleanupCampfire();
      return;
    }
    
    // Check if campfire still exists
    if (this.campfire && (!global.Item || !global.Item.list || !global.Item.list[this.campfire])) {
      // Campfire was removed - might have been destroyed
      this.campfire = null;
    }
    
    // Keep units near campfire (within 15 tiles = 960 pixels)
    const leaderPos = [this.leader.x, this.leader.y];
    const campfireItem = this.campfire ? (global.Item && global.Item.list ? global.Item.list[this.campfire] : null) : null;
    
    if (campfireItem) {
      const campfirePos = [campfireItem.x, campfireItem.y];
      const distance = this.getDistance(leaderPos, campfirePos);
      const guardDistance = 15 * 64; // 15 tiles in pixels
      
      // If too far from campfire, move back
      if (distance > guardDistance) {
        if (this.leader.moveTo && typeof this.leader.moveTo === 'function') {
          const tileX = Math.floor(campfirePos[0] / 64);
          const tileY = Math.floor(campfirePos[1] / 64);
          this.leader.moveTo(this.leader.z || 0, tileX, tileY);
        }
      } else {
        // Close enough - ensure leader is idle/guarding
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'idle';
        }
        if (this.leader.action !== undefined) {
          this.leader.action = 'idle';
        }
      }
    }
    
    // Check for daybreak (nightfall transitions from true to false, or day changed)
    const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
    const currentDay = global.day || 1;
    const isDawn = this.lastNightfallState === true && currentNightfall === false;
    const dayChanged = currentDay > this.arrivalDay;
    
    if (isDawn || dayChanged) {
      // Daybreak - time to return
      this.lastNightfallState = currentNightfall;
      this.status = 'returning';
      this.cleanupCampfire();
      
      // Start leader moving back to HQ
      const hq = this.leader.house ? this.leader.house.hq : null;
      if (hq && this.leader.moveTo && typeof this.leader.moveTo === 'function') {
        this.leader.moveTo(this.leader.z || 0, hq[0], hq[1]);
        
        // Set mode for return journey
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'scout';
        }
      }
      
      // Log zone cleared and return
      const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
      const leaderName = this.leader.name || 'Unknown';
      const zoneCoords = this.targetZone.center || [0, 0];
      const tileCoords = zoneCoords.length >= 2 && zoneCoords[0] < 1000 ? zoneCoords : [Math.floor(zoneCoords[0] / 64), Math.floor(zoneCoords[1] / 64)];
      const zoneClearLog = `[SCOUT] ${factionName}: Zone cleared at [${tileCoords[0]}, ${tileCoords[1]}] - ready for outpost establishment`;
      const returnLog = `[SCOUT] ${factionName}: Party returning to HQ from [${tileCoords[0]}, ${tileCoords[1]}]`;
      console.log(zoneClearLog);
      console.log(returnLog);
      
      // Create Event Manager event for zone cleared
      if (global.eventManager && this.leader && this.leader.house) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'zone cleared for expansion',
          house: this.leader.house.id,
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
          log: zoneClearLog,
          metadata: { targetZone: tileCoords, purpose: this.purpose }
        });
      }
      
      // Record zone cleared in logger for daily report
      if (this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.logger) {
        this.leader.house.ai.logger.recordZoneCleared();
      }
      
      // Create Event Manager event for returning home
      if (global.eventManager && this.leader && this.leader.house) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'returning from scouting mission',
          house: this.leader.house.id,
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
          log: returnLog,
          metadata: { missionSuccess: true, zoneCleared: true }
        });
      }
      
      // Notify that zone is clear
      this.notifyZoneClear();
    }
  }

  // Handle return journey to HQ
  updateReturning() {
    if (!this.leader || this.leader.toRemove) {
      this.checkReturnComplete();
      return;
    }

    // Check if leader reached HQ
    const leaderPos = [this.leader.x, this.leader.y];
    const hq = this.leader.house ? this.leader.house.hq : null;
    if (!hq) {
      this.checkReturnComplete();
      return;
    }
    
    const getCenter = global.getCenter || (() => [0, 0]);
    const hqCoords = getCenter(hq[0], hq[1]);
    const distance = this.getDistance(leaderPos, hqCoords);

    // Consider reached if within 5 tiles (320 pixels)
    const reachDistance = 5 * 64;
    if (distance <= reachDistance) {
      this.checkReturnComplete();
    } else {
      // Ensure leader is moving toward HQ
      if (!this.leader.action || this.leader.action === 'idle') {
        if (this.leader.moveTo && typeof this.leader.moveTo === 'function') {
          this.leader.moveTo(this.leader.z || 0, hq[0], hq[1]);
          if (this.leader.mode !== undefined) {
            this.leader.mode = 'scout';
          }
        }
      }
      
      // Backup units follow leader (handled by followBehavior.update() called earlier)
    }
  }

  // Build campfire at current location
  buildCampfire() {
    if (!this.leader || this.leader.toRemove) {
      return;
    }
    
    const leaderPos = [this.leader.x, this.leader.y, this.leader.z || 0];
    const fireId = Math.random();
    
    // Create InfiniteFire
    if (typeof global.InfiniteFire === 'function') {
      global.InfiniteFire({
        id: fireId,
        x: leaderPos[0],
        y: leaderPos[1],
        z: leaderPos[2],
        qty: 1
      });
      
      this.campfire = fireId;
      
      // Log campfire creation
      const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
      const currentDay = global.day || 1;
      const tileCoords = [Math.floor(leaderPos[0] / 64), Math.floor(leaderPos[1] / 64)];
      const logMessage = `[SCOUT] ${factionName}: Campfire set up at [${tileCoords[0]}, ${tileCoords[1]}] (Day ${currentDay})`;
      console.log(logMessage);
      
      // Create Event Manager event for campfire setup (optional - not in requirements but useful)
      if (global.eventManager && this.leader && this.leader.house) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: this.leader.name || 'Unknown',
          action: 'set up campfire',
          house: this.leader.house.id,
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: leaderPos[0], y: leaderPos[1], z: leaderPos[2] },
          log: logMessage,
          metadata: { day: currentDay, arrivalDay: this.arrivalDay }
        });
      }
    }
  }

  // Clean up campfire when leaving
  cleanupCampfire() {
    if (this.campfire && global.Item && global.Item.list) {
      const fireItem = global.Item.list[this.campfire];
      if (fireItem && !fireItem.toRemove) {
        fireItem.toRemove = true;
        
        // Log campfire cleanup
        const factionName = this.leader ? (this.leader.house ? this.leader.house.name : 'Unknown') : 'Unknown';
        console.log(`[SCOUT] ${factionName}: Campfire removed`);
      }
      this.campfire = null;
    }
  }

  // Check for faction attacks (not fauna/neutral enemies)
  checkForFactionAttack() {
    if (!this.leader || this.leader.toRemove || this.status === 'failed') {
      return;
    }
    
    // Check all units for damage
    const allUnits = [this.leader, ...this.backupUnits].filter(u => u && !u.toRemove);
    
    for (const unit of allUnits) {
      const previousHP = this.unitHP.get(unit.id);
      const currentHP = unit.hp || 100;
      
      if (previousHP !== undefined && currentHP < previousHP) {
        // Unit took damage - check if it's from a faction
        // Note: This is a simplified check - in a more sophisticated system, you'd track the actual attacker
        // For now, we'll check if there are enemy faction units nearby
        const enemies = this.scanForEnemyFactions();
        
        if (enemies.length > 0) {
          // Faction attack detected
          this.handleFactionAttack(enemies[0]);
          break;
        }
      }
      
      // Update HP tracking
      this.unitHP.set(unit.id, currentHP);
    }
  }

  // Scan for enemy faction units (not fauna)
  scanForEnemyFactions() {
    const enemies = [];
    if (!this.leader || this.leader.toRemove || !this.leader.house) {
      return enemies;
    }
    
    const leaderPos = [this.leader.x, this.leader.y];
    const scanRadius = 20; // tiles (converted from pixels if needed)
    
    // Check all players in the area
    if (typeof Player !== 'undefined' && Player.list) {
      for (const [id, player] of Object.entries(Player.list)) {
        if (player.toRemove || !player.house) continue;
        
        // Skip if same faction
        if (player.house.id === this.leader.house.id) continue;
        
        // Skip fauna/neutral enemies (check if it's a player-controlled unit with a house)
        // Fauna typically don't have house.id matching a faction
        // For now, assume any unit with a different house.id is an enemy faction
        
        const playerPos = [player.x, player.y];
        const distance = this.getDistance(leaderPos, playerPos);
        
        if (distance <= scanRadius * 64) { // Convert tiles to pixels (assuming 64px per tile)
          enemies.push({
            id: player.id,
            name: player.name,
            house: player.house.name,
            houseId: player.house.id,
            position: playerPos,
            distance: distance
          });
        }
      }
    }
    
    return enemies;
  }

  // Handle faction attack
  handleFactionAttack(enemy) {
    if (this.status === 'failed') {
      return; // Already handled
    }
    
    this.status = 'failed';
    
    // Store enemy info for contested banner event
    this.contestedBannerEnemyInfo = {
      houseId: enemy.houseId,
      houseName: enemy.house
    };
    
    // Place contested banner at leader location
    this.placeContestedBanner();
    
    // Record conflict zone in knowledge base
    if (this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.knowledge) {
      const leaderPos = [this.leader.x, this.leader.y];
      this.leader.house.ai.knowledge.reportConflictZone(leaderPos, enemy.houseId, enemy.house);
    }
    
    // Log combat and mission failure
    const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
    const leaderName = this.leader ? (this.leader.name || 'Unknown') : 'Unknown';
    const leaderPos = [this.leader.x, this.leader.y];
    const tileCoords = [Math.floor(leaderPos[0] / 64), Math.floor(leaderPos[1] / 64)];
    const combatLog = `[SCOUT] ${factionName}: ENEMY CONTACT! Attacked by ${enemy.house} at [${tileCoords[0]}, ${tileCoords[1]}]`;
    const failureLog = `[SCOUT] ${factionName}: Mission failed - scouting party engaged in combat`;
    console.log(combatLog);
    console.log(failureLog);
    
    // Create Event Manager event for combat encounter
    if (global.eventManager && this.leader && this.leader.house) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        target: enemy.houseId || null,
        targetName: enemy.house,
        action: 'engaged in combat with enemy faction',
        house: this.leader.house.id,
        houseName: factionName,
        communication: global.eventManager.commModes.AREA,
        position: { x: leaderPos[0], y: leaderPos[1], z: this.leader.z || 0 },
        log: combatLog,
        metadata: { enemyHouseId: enemy.houseId, enemyHouseName: enemy.house, missionFailed: true }
      });
    }
    
    // Create Event Manager event for mission failure
    if (global.eventManager && this.leader && this.leader.house) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        target: enemy.houseId || null,
        targetName: enemy.house,
        action: 'scouting mission failed',
        house: this.leader.house.id,
        houseName: factionName,
        communication: global.eventManager.commModes.NONE,
        position: { x: leaderPos[0], y: leaderPos[1], z: this.leader.z || 0 },
        log: failureLog,
        metadata: { failureReason: 'combat encounter', enemyHouseId: enemy.houseId }
      });
    }
    
    // Record failure and conflict zone in logger for daily report
    if (this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.logger) {
      this.leader.house.ai.logger.recordScoutingFailure();
      this.leader.house.ai.logger.recordConflictZone();
    }
    
    // Clean up campfire
    this.cleanupCampfire();
    
    // Notify failure
    this.notifyMissionFailed();
    
    // Trigger retreat
    this.triggerRetreat();
  }

  // Place contested banner at leader location
  placeContestedBanner() {
    if (this.contestedBannerPlaced || !this.leader || this.leader.toRemove) {
      return;
    }
    
    const leaderPos = [this.leader.x, this.leader.y, this.leader.z || 0];
    
    // Create contested banner item
    if (global.itemFactory && typeof global.itemFactory.createItem === 'function') {
      try {
        const banner = global.itemFactory.createItem('contestedbanner', {
          x: leaderPos[0],
          y: leaderPos[1],
          z: leaderPos[2],
          canPickup: false
        });
        
        if (banner) {
          this.contestedBannerPlaced = true;
          
          // Log banner placement
          const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
          const tileCoords = [Math.floor(leaderPos[0] / 64), Math.floor(leaderPos[1] / 64)];
          console.log(`[SCOUT] ${factionName}: Contested banner placed at [${tileCoords[0]}, ${tileCoords[1]}]`);
        }
      } catch (error) {
        console.warn(`[SCOUT] Failed to place contested banner:`, error);
      }
    }
  }

  // Trigger retreat for entire party
  triggerRetreat() {
    this.status = 'returning';
    
    // Set leader to retreat (if alive)
    if (this.leader && !this.leader.toRemove && this.leader.hp > 0) {
      const hq = this.leader.house ? this.leader.house.hq : null;
      if (hq && this.leader.moveTo && typeof this.leader.moveTo === 'function') {
        this.leader.moveTo(this.leader.z || 0, hq[0], hq[1]);
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'scout';
        }
      }
    } else {
      // Leader is dead - mission failed, all units flee
      this.status = 'failed';
      const factionName = this.leader && this.leader.house ? this.leader.house.name : 'Unknown';
      console.log(`[SCOUT] ${factionName}: Mission failed - party leader died`);
    }

    // Set backup units to retreat (flee home)
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove && unit.hp > 0) {
        const hq = unit.house ? unit.house.hq : null;
        if (hq && unit.moveTo && typeof unit.moveTo === 'function') {
          unit.moveTo(unit.z || 0, hq[0], hq[1]);
          if (unit.mode !== undefined) {
            unit.mode = 'scout';
          }
          // Clear follow behavior - units flee individually
          if (unit.followBehavior) {
            unit.followBehavior = null;
          }
        }
      }
    });
  }

  // Check if return was successful
  checkReturnComplete() {
    let survivors = 0;
    if (!this.leader || !this.leader.house) {
      this.cleanup();
      return;
    }
    
    const hq = this.leader.house.hq;
    if (!hq) {
      this.cleanup();
      return;
    }
    
    const hqCoords = global.getCenter ? global.getCenter(hq[0], hq[1]) : [hq[0] * 64, hq[1] * 64];

    // Check leader
    if (this.leader && !this.leader.toRemove) {
      const leaderPos = [this.leader.x, this.leader.y];
      const distance = this.getDistance(leaderPos, hqCoords);
      if (distance <= 5 * 64) { // 5 tiles in pixels
        survivors++;
      }
    }

    // Check backup units
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove) {
        const unitPos = [unit.x, unit.y];
        const distance = this.getDistance(unitPos, hqCoords);
        if (distance <= 5 * 64) { // 5 tiles in pixels
          survivors++;
        }
      }
    });

    if (survivors > 0) {
      // Log return complete
      const factionName = this.leader.house ? this.leader.house.name : 'Unknown';
      const leaderName = this.leader.name || 'Unknown';
      const logMessage = `[SCOUT] ${factionName}: Party successfully returned to HQ (${survivors} survivors)`;
      console.log(logMessage);
      
      // Create Event Manager event for return complete
      if (global.eventManager && this.leader && this.leader.house) {
        const hq = this.leader.house.hq;
        const hqCoords = hq ? (global.getCenter ? global.getCenter(hq[0], hq[1]) : [hq[0] * 64, hq[1] * 64]) : { x: 0, y: 0, z: 0 };
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'returned from scouting mission',
          house: this.leader.house.id,
          houseName: factionName,
          quantity: survivors,
          communication: this.status !== 'failed' ? global.eventManager.commModes.NONE : global.eventManager.commModes.NONE,
          position: { x: hqCoords[0] || 0, y: hqCoords[1] || 0, z: 0 },
          log: logMessage,
          metadata: { survivors, missionSuccess: this.status !== 'failed' }
        });
      }
      
      // Record completion in logger for daily report
      if (this.status !== 'failed' && this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.logger) {
        this.leader.house.ai.logger.recordScoutingCompletion();
      }
      
      if (this.status !== 'failed') {
        this.notifyReturnSuccess();
      }
    } else {
      // All units lost
      const factionName = this.leader ? (this.leader.house ? this.leader.house.name : 'Unknown') : 'Unknown';
      const logMessage = `[SCOUT] ${factionName}: Party failed to return - all units lost`;
      console.log(logMessage);
      
      // Create Event Manager event for complete failure (all units lost)
      if (global.eventManager && this.leader && this.leader.house) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: this.leader.name || 'Unknown',
          action: 'scouting mission failed',
          house: this.leader.house.id,
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x || 0, y: this.leader.y || 0, z: this.leader.z || 0 },
          log: logMessage,
          metadata: { failureReason: 'all units lost', survivors: 0 }
        });
      }
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

  // Notify successful return
  notifyReturnSuccess() {
    if (this.leader && this.leader.house && this.leader.house.ai) {
      this.leader.house.ai.onScoutingComplete(this.targetZone, this.purpose, false);
    }
  }

  // Notify mission failed
  notifyMissionFailed() {
    if (this.leader && this.leader.house && this.leader.house.ai) {
      this.leader.house.ai.onScoutingFailed(this.targetZone, this.purpose);
    }
  }

  // Clean up the scouting party
  cleanup() {
    // Clean up campfire if still exists
    this.cleanupCampfire();
    
    // Remove ALL banner flags from leader (prevent stacking)
    if (this.leader && this.leader.name) {
      this.leader.name = this.leader.name.replace(/🚩\s*/g, '').trim();
    }

    // Clear scouting party references
    if (this.leader) {
      this.leader.scoutingParty = null;
    }
    
    this.backupUnits.forEach(unit => {
      if (unit) {
        unit.scoutingParty = null;
        if (unit.followBehavior) {
          unit.followBehavior = null;
        }
      }
    });

    // Remove from faction's active parties
    if (this.leader && this.leader.house && this.leader.house.ai && this.leader.house.ai.militaryManager) {
      const index = this.leader.house.ai.militaryManager.scoutingParties.indexOf(this);
      if (index > -1) {
        this.leader.house.ai.militaryManager.scoutingParties.splice(index, 1);
      }
    }
  }

  // Helper: Calculate distance between two points (in pixels)
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
      targetZone: this.targetZone ? (this.targetZone.name || 'Unknown') : 'Unknown',
      purpose: this.purpose,
      arrivalDay: this.arrivalDay,
      currentDay: global.day || 1,
      hasCampfire: this.campfire !== null,
      contestedBannerPlaced: this.contestedBannerPlaced
    };
  }
}

module.exports = ScoutingParty;
