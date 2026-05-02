// Scouting Party System
// Manages groups of units exploring zones for resources with day-based scouting
const movementSystem = require('../core/MovementSystem');

class ScoutingParty {
  constructor(leader, backupUnits, targetZone, purpose) {
    this.leader = leader; // Military unit (prefer mounted)
    this.backupUnits = backupUnits || []; // Array of 0-2 backup units (flexible party size)
    this.house = this.resolveHouse();
    this.targetZone = targetZone;
    this.purpose = purpose; // 'resource_scout', resource type ('stone', 'wood', etc.), or 'establish_outpost'
    this.status = 'on_hold'; // on_hold, traveling, camping, returning, failed
    this.arrivalDay = null; // Day when party reached target zone
    this.deploymentDay = global.day || 1; // Day when party was deployed
    this.lastDay = global.day || 1; // Last day tracked for day change detection
    this.campfire = null; // ID of InfiniteFire item for campfire
    this.contestedBannerPlaced = false; // Flag to ensure only one contested banner per mission
    this.completionNotified = false;
    this.failureNotified = false;
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
    const factionName = this.getFactionName();
    const leaderName = this.leader ? this.leader.name : 'Unknown';
    const targetCoords = targetZone && targetZone.center ? targetZone.center : [0, 0];
    const totalUnits = 1 + (this.backupUnits ? this.backupUnits.length : 0);
    const logMessage = `[SCOUT] ${factionName}: Party deployed - Leader: ${leaderName}, Target: [${targetCoords[0]}, ${targetCoords[1]}], Purpose: ${purpose}, Units: ${totalUnits}`;
    console.log(logMessage);
    
    // Create Event Manager event for scouting party departure
    if (global.eventManager && this.leader && this.getHouse()) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        action: 'departed on scouting mission',
        target: targetZone ? (targetZone.id || null) : null,
        targetName: targetZone ? (targetZone.name || `Zone at [${targetCoords[0]}, ${targetCoords[1]}]`) : null,
        house: this.getHouseId(),
        houseName: factionName,
        quantity: totalUnits,
        communication: global.eventManager.commModes.NONE,
        position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
        log: logMessage,
        metadata: { purpose, targetZone: targetCoords, unitCount: totalUnits }
      });
    }
    
    // Record deployment in logger for daily report
    const house = this.getHouse();
    if (house && house.ai && house.ai.logger && typeof house.ai.logger.recordScoutingDeployment === 'function') {
      house.ai.logger.recordScoutingDeployment();
    }
  }

  resolveHouse() {
    if (!this.leader) {
      return null;
    }

    if (this.leader.house && typeof this.leader.house === 'object') {
      return this.leader.house;
    }

    if (this.leader.houseObject && typeof this.leader.houseObject === 'object') {
      return this.leader.houseObject;
    }

    const houseId = this.leader.house;
    if (houseId !== undefined && houseId !== null && global.House && global.House.list) {
      return global.House.list[houseId] || null;
    }

    return null;
  }

  getHouse() {
    if (!this.house) {
      this.house = this.resolveHouse();
    }
    return this.house;
  }

  getHouseId() {
    const house = this.getHouse();
    if (house && house.id !== undefined) {
      return house.id;
    }
    return this.leader ? (this.leader.house ?? null) : null;
  }

  getFactionName() {
    const house = this.getHouse();
    return house && house.name ? house.name : 'Unknown';
  }

  isPathingTo(targetZ, targetTileX, targetTileY) {
    if (!this.leader) {
      return false;
    }

    const pathEnd = this.leader.pathEnd;
    if (!pathEnd || pathEnd.z !== targetZ || !pathEnd.loc) {
      return false;
    }

    return pathEnd.loc[0] === targetTileX && pathEnd.loc[1] === targetTileY;
  }
  
  // Assign mission orders to units (called after party creation)
  assignMissionOrders() {
    if (this.missionOrdersAssigned) {
      return; // Already assigned
    }
    
    if (!this.leader || this.leader.toRemove) {
      return;
    }
    
    // Set leader to scout mode (ready but idle, waiting for dawn)
    if (this.leader.mode !== undefined) {
      this.leader.mode = 'scout';
    }
    if (this.leader.action !== undefined) {
      this.leader.action = 'idle';
    }
    
    // Backup units should follow leader (followBehavior is already assigned in MilitaryManager)
    // Ensure followBehavior is active - they will follow when leader starts moving
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove) {
        if (!unit.followBehavior) {
          const FollowBehavior = require('./FollowBehavior');
          unit.followBehavior = new FollowBehavior(unit, this.leader);
        }
        // Set mode to idle (they'll follow automatically when leader moves)
        if (unit.mode !== undefined) {
          unit.mode = 'idle';
        }
        if (unit.action !== undefined) {
          unit.action = 'idle';
        }
      }
    });
    
    this.missionOrdersAssigned = true;
    
    const factionName = this.getFactionName();
    console.log(`[SCOUT] ${factionName}: Mission orders assigned - party on hold until dawn`);
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
    if (!this.leader.action && this.leader.action !== undefined) {
      this.leader.action = 'idle';
    }
    this.leader.scoutingMoveTarget = {
      status: 'traveling',
      z: this.leader.z || 0,
      target: [targetTileX, targetTileY],
      purpose: this.purpose
    };
    
    const moveResult = movementSystem.applyMoveIntent(this.leader, {
      z: this.leader.z || 0,
      target: [targetTileX, targetTileY],
      reason: 'scout',
      sourceAction: 'scout'
    });
    
    // Update status to traveling
    this.status = 'traveling';
    
    const factionName = this.getFactionName();
    console.log(`[SCOUT] ${factionName}: Party leader starting journey to target [${targetTileX}, ${targetTileY}]`);
    if (moveResult && moveResult.status && !['success', 'direct', 'noop'].includes(moveResult.status)) {
      console.warn(`[SCOUT] ${factionName}: Movement request to target [${targetTileX}, ${targetTileY}] returned ${moveResult.status}`);
    }
  }

  // Update scouting party state
  update() {
    const currentDay = global.day || 1;
    
    // Update day tracking
    if (currentDay !== this.lastDay) {
      this.lastDay = currentDay;
      if (this.status === 'camping') {
        const factionName = this.getFactionName();
        console.log(`[SCOUT] ${factionName}: Day changed during camping - Day ${currentDay} (arrived Day ${this.arrivalDay})`);
      }
    }
    
    // Check if party leader is dead - mission fails immediately
    if (!this.leader || this.leader.toRemove || (this.leader.hp !== undefined && this.leader.hp <= 0)) {
      if (this.status !== 'failed') {
        this.status = 'failed';
        const factionName = this.getFactionName();
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
    
    switch (this.status) {
      case 'on_hold':
        this.updateOnHold();
        break;
      case 'traveling':
        this.updateTraveling();
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

  // Update on_hold state (waiting for dawn trigger)
  updateOnHold() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      return;
    }
    
    // Dawn detection: check if current hour is VI.a (dawn hour, same as serfs use)
    // Use global.tempus which matches the hour system used by serfs
    const currentTempus = global.tempus || (global.gameState ? global.gameState.tempus : null);
    const isDawn = currentTempus === 'VI.a';
    
    // CRITICAL: Also check if it's already day (not night) - if party was created during day, start immediately
    // This ensures parties don't wait indefinitely if created after dawn
    const isNight = global.gameState ? (global.gameState.nightfall || false) : false;
    const isDay = !isNight;
    
    if (isDawn || (isDay && this.status === 'on_hold')) {
      // Dawn detected or already day - start traveling to target
      const factionName = this.getFactionName();
      console.log(`[SCOUT] ${factionName}: Starting journey to target (dawn=${isDawn}, day=${isDay})`);
      this.startTravelingToTarget();
    }
    
    // Keep leader idle until dawn (mode is already set to 'scout' in assignMissionOrders)
    // Followers will automatically follow when leader starts moving
  }
  
  // Check if leader has reached target zone
  updateTraveling() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      return;
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
      this.status = 'camping';
      this.arrivalDay = global.day || 1;
      
      // Set leader to idle at destination
      if (this.leader.mode !== undefined) {
        this.leader.mode = 'idle';
      }
      if (this.leader.action !== undefined) {
        this.leader.action = 'idle';
      }
      
      // Build campfire if it's nightfall, otherwise wait for nightfall
      const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
      if (currentNightfall && !this.campfire) {
        this.buildCampfire();
      }
      
      // Log reaching destination
      const factionName = this.getFactionName();
      const leaderName = this.leader.name || 'Unknown';
      const tileCoords = [Math.floor(targetX / 64), Math.floor(targetY / 64)];
      const logMessage = `[SCOUT] ${factionName}: Party reached destination at [${tileCoords[0]}, ${tileCoords[1]}] (Day ${this.arrivalDay})`;
      console.log(logMessage);
      
      // Create Event Manager event for reaching destination
      if (global.eventManager && this.leader && this.getHouse()) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'reached scouting destination',
          target: this.targetZone ? (this.targetZone.id || null) : null,
          targetName: this.targetZone ? (this.targetZone.name || `Zone at [${tileCoords[0]}, ${tileCoords[1]}]`) : `Zone at [${tileCoords[0]}, ${tileCoords[1]}]`,
          house: this.getHouseId(),
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
          log: logMessage,
          metadata: { arrivalDay: this.arrivalDay, targetZone: tileCoords }
        });
      }
    } else {
      // Not at target yet - ensure movement continues
      const targetTileX = Math.floor(targetX / 64);
      const targetTileY = Math.floor(targetY / 64);
      const pathResult = this.leader.lastPathResult;
      const needsPath = !this.isPathingTo(this.leader.z || 0, targetTileX, targetTileY) ||
        (pathResult && ['invalid', 'halted', 'no_path'].includes(pathResult.status));
      if (needsPath || this.leader.action === 'idle' || !this.leader.action) {
        this.startTravelingToTarget();
      }
    }
  }

  // Guard campfire overnight (or wait at destination until nightfall, then camp)
  updateCamping() {
    if (!this.leader || this.leader.toRemove) {
      this.status = 'failed';
      this.cleanupCampfire();
      return;
    }
    
    // Check current nightfall state (used for both campfire building and dawn detection)
    const currentNightfall = global.gameState ? (global.gameState.nightfall || false) : false;
    
    // Build campfire if it's nightfall and we don't have one yet
    if (currentNightfall && !this.campfire) {
      this.buildCampfire();
    }
    
    // Check if campfire still exists (if we built one)
    if (this.campfire && (!global.Item || !global.Item.list || !global.Item.list[this.campfire])) {
      // Campfire was removed - might have been destroyed
      this.campfire = null;
    }
    
    // Keep units near campfire (within 15 tiles = 960 pixels) if campfire exists
    const leaderPos = [this.leader.x, this.leader.y];
    const campfireItem = this.campfire ? (global.Item && global.Item.list ? global.Item.list[this.campfire] : null) : null;
    
    if (campfireItem) {
      const campfirePos = [campfireItem.x, campfireItem.y];
      const distance = this.getDistance(leaderPos, campfirePos);
      const guardDistance = 15 * 64; // 15 tiles in pixels
      
      // If too far from campfire, move back
      if (distance > guardDistance) {
        const tileX = Math.floor(campfirePos[0] / 64);
        const tileY = Math.floor(campfirePos[1] / 64);
        movementSystem.applyMoveIntent(this.leader, {
          z: this.leader.z || 0,
          target: [tileX, tileY],
          reason: 'scout',
          sourceAction: this.leader.action || 'scout'
        });
      } else {
        // Close enough - ensure leader is idle/guarding
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'idle';
        }
        if (this.leader.action !== undefined) {
          this.leader.action = 'idle';
        }
      }
    } else {
      // No campfire yet (waiting for nightfall) - ensure leader stays at destination
      if (this.leader.mode !== undefined) {
        this.leader.mode = 'idle';
      }
      if (this.leader.action !== undefined) {
        this.leader.action = 'idle';
      }
    }
    
    // Check for dawn: use VI.a hour (same as serfs use for dawn detection)
    const currentTempus = global.tempus || (global.gameState ? global.gameState.tempus : null);
    const isDawn = currentTempus === 'VI.a';
    
    if (isDawn) {
      // Dawn detected - time to return
      this.status = 'returning';
      this.cleanupCampfire();
      
      // Start leader moving back to HQ
      const house = this.getHouse();
      const hq = house ? house.hq : null;
      if (hq && this.leader.moveTo && typeof this.leader.moveTo === 'function') {
        this.leader.scoutingMoveTarget = {
          status: 'returning',
          z: this.leader.z || 0,
          target: [hq[0], hq[1]],
          purpose: this.purpose
        };
        movementSystem.applyMoveIntent(this.leader, {
          z: this.leader.z || 0,
          target: [hq[0], hq[1]],
          reason: 'scout',
          sourceAction: 'scout'
        });
        
        // Leader is already in scout mode, just ensure it's set
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'scout';
        }
      }
      
      // Followers will automatically follow because followBehavior is already active
      
      // Log zone cleared and return
      const factionName = this.getFactionName();
      const leaderName = this.leader.name || 'Unknown';
      const zoneCoords = this.targetZone.center || [0, 0];
      const tileCoords = zoneCoords.length >= 2 && zoneCoords[0] < 1000 ? zoneCoords : [Math.floor(zoneCoords[0] / 64), Math.floor(zoneCoords[1] / 64)];
      const zoneClearLog = `[SCOUT] ${factionName}: Zone cleared at [${tileCoords[0]}, ${tileCoords[1]}] - ready for outpost establishment`;
      const returnLog = `[SCOUT] ${factionName}: Party returning to HQ from [${tileCoords[0]}, ${tileCoords[1]}]`;
      console.log(zoneClearLog);
      console.log(returnLog);
      
      // Create Event Manager event for zone cleared
      if (global.eventManager && this.leader && this.getHouse()) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'zone cleared for expansion',
          house: this.getHouseId(),
          houseName: factionName,
          communication: global.eventManager.commModes.NONE,
          position: { x: this.leader.x, y: this.leader.y, z: this.leader.z || 0 },
          log: zoneClearLog,
          metadata: { targetZone: tileCoords, purpose: this.purpose }
        });
      }
      
      // Record zone cleared in logger for daily report
      const scoutHouse = this.getHouse();
      if (scoutHouse && scoutHouse.ai && scoutHouse.ai.logger && typeof scoutHouse.ai.logger.recordZoneCleared === 'function') {
        scoutHouse.ai.logger.recordZoneCleared();
      }
      
      // Create Event Manager event for returning home
      if (global.eventManager && this.leader && this.getHouse()) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'returning from scouting mission',
          house: this.getHouseId(),
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
    const house = this.getHouse();
    const hq = house ? house.hq : null;
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
      if (!this.isPathingTo(this.leader.z || 0, hq[0], hq[1]) || !this.leader.action || this.leader.action === 'idle') {
        if (this.leader.moveTo && typeof this.leader.moveTo === 'function') {
          this.leader.scoutingMoveTarget = {
            status: 'returning',
            z: this.leader.z || 0,
            target: [hq[0], hq[1]],
            purpose: this.purpose
          };
          movementSystem.applyMoveIntent(this.leader, {
            z: this.leader.z || 0,
            target: [hq[0], hq[1]],
            reason: 'scout',
            sourceAction: 'scout'
          });
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
      const factionName = this.getFactionName();
      const currentDay = global.day || 1;
      const tileCoords = [Math.floor(leaderPos[0] / 64), Math.floor(leaderPos[1] / 64)];
      const logMessage = `[SCOUT] ${factionName}: Campfire set up at [${tileCoords[0]}, ${tileCoords[1]}] (Day ${currentDay})`;
      console.log(logMessage);
      
      // Create Event Manager event for campfire setup (optional - not in requirements but useful)
      if (global.eventManager && this.leader && this.getHouse()) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: this.leader.name || 'Unknown',
          action: 'set up campfire',
          house: this.getHouseId(),
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
        const factionName = this.getFactionName();
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
    const scoutHouseId = this.getHouseId();
    if (!this.leader || this.leader.toRemove || scoutHouseId === null || scoutHouseId === undefined) {
      return enemies;
    }
    
    const leaderPos = [this.leader.x, this.leader.y];
    const scanRadius = 20; // tiles (converted from pixels if needed)
    
    // Check all players in the area
    if (typeof Player !== 'undefined' && Player.list) {
      for (const [id, player] of Object.entries(Player.list)) {
        if (player.toRemove || !player.house) continue;
        
        const playerHouseId = player.house && typeof player.house === 'object' ? player.house.id : player.house;
        if (playerHouseId === scoutHouseId) continue;
        
        // Skip fauna/neutral enemies (check if it's a player-controlled unit with a house)
        // Fauna typically don't have house.id matching a faction
        // For now, assume any unit with a different house.id is an enemy faction
        
        const playerPos = [player.x, player.y];
        const distance = this.getDistance(leaderPos, playerPos);
        
        if (distance <= scanRadius * 64) { // Convert tiles to pixels (assuming 64px per tile)
          enemies.push({
            id: player.id,
            name: player.name,
            house: player.house && typeof player.house === 'object' ? player.house.name : 'Unknown',
            houseId: playerHouseId,
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
    const house = this.getHouse();
    if (house && house.ai && house.ai.knowledge) {
      const leaderPos = [this.leader.x, this.leader.y];
      house.ai.knowledge.reportConflictZone(leaderPos, enemy.houseId, enemy.house);
    }
    
    // Log combat and mission failure
    const factionName = this.getFactionName();
    const leaderName = this.leader ? (this.leader.name || 'Unknown') : 'Unknown';
    const leaderPos = [this.leader.x, this.leader.y];
    const tileCoords = [Math.floor(leaderPos[0] / 64), Math.floor(leaderPos[1] / 64)];
    const combatLog = `[SCOUT] ${factionName}: ENEMY CONTACT! Attacked by ${enemy.house} at [${tileCoords[0]}, ${tileCoords[1]}]`;
    const failureLog = `[SCOUT] ${factionName}: Mission failed - scouting party engaged in combat`;
    console.log(combatLog);
    console.log(failureLog);
    
    // Create Event Manager event for combat encounter
    if (global.eventManager && this.leader && this.getHouse()) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        target: enemy.houseId || null,
        targetName: enemy.house,
        action: 'engaged in combat with enemy faction',
        house: this.getHouseId(),
        houseName: factionName,
        communication: global.eventManager.commModes.AREA,
        position: { x: leaderPos[0], y: leaderPos[1], z: this.leader.z || 0 },
        log: combatLog,
        metadata: { enemyHouseId: enemy.houseId, enemyHouseName: enemy.house, missionFailed: true }
      });
    }
    
    // Create Event Manager event for mission failure
    if (global.eventManager && this.leader && this.getHouse()) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.FACTION,
        subject: this.leader.id,
        subjectName: leaderName,
        target: enemy.houseId || null,
        targetName: enemy.house,
        action: 'scouting mission failed',
        house: this.getHouseId(),
        houseName: factionName,
        communication: global.eventManager.commModes.NONE,
        position: { x: leaderPos[0], y: leaderPos[1], z: this.leader.z || 0 },
        log: failureLog,
        metadata: { failureReason: 'combat encounter', enemyHouseId: enemy.houseId }
      });
    }
    
    // Record failure and conflict zone in logger for daily report
    if (house && house.ai && house.ai.logger) {
      if (typeof house.ai.logger.recordScoutingFailure === 'function') {
        house.ai.logger.recordScoutingFailure();
      }
      if (typeof house.ai.logger.recordConflictZone === 'function') {
        house.ai.logger.recordConflictZone();
      }
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
          const factionName = this.getFactionName();
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
      const house = this.getHouse();
      const hq = house ? house.hq : null;
      if (hq && this.leader.moveTo && typeof this.leader.moveTo === 'function') {
        this.leader.scoutingMoveTarget = {
          status: 'returning',
          z: this.leader.z || 0,
          target: [hq[0], hq[1]],
          purpose: this.purpose
        };
        movementSystem.applyMoveIntent(this.leader, {
          z: this.leader.z || 0,
          target: [hq[0], hq[1]],
          reason: 'scout',
          sourceAction: 'scout'
        });
        if (this.leader.mode !== undefined) {
          this.leader.mode = 'scout';
        }
      }
    } else {
      // Leader is dead - mission failed, all units flee
      this.status = 'failed';
      const factionName = this.getFactionName();
      console.log(`[SCOUT] ${factionName}: Mission failed - party leader died`);
    }

    // Set backup units to retreat (flee home)
    this.backupUnits.forEach(unit => {
      if (unit && !unit.toRemove && unit.hp > 0) {
        const house = this.getHouse();
        const hq = house ? house.hq : null;
        if (hq && unit.moveTo && typeof unit.moveTo === 'function') {
          unit.scoutingMoveTarget = {
            status: 'returning',
            z: unit.z || 0,
            target: [hq[0], hq[1]],
            purpose: this.purpose
          };
          movementSystem.applyMoveIntent(unit, {
            z: unit.z || 0,
            target: [hq[0], hq[1]],
            reason: 'scout',
            sourceAction: 'scout'
          });
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
    const house = this.getHouse();
    if (!this.leader || !house) {
      this.cleanup();
      return;
    }
    
    const hq = house.hq;
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
      const factionName = this.getFactionName();
      const leaderName = this.leader.name || 'Unknown';
      const logMessage = `[SCOUT] ${factionName}: Party successfully returned to HQ (${survivors} survivors)`;
      console.log(logMessage);
      
      // Create Event Manager event for return complete
      if (global.eventManager && this.leader && this.getHouse()) {
        const hq = house.hq;
        const hqCoords = hq ? (global.getCenter ? global.getCenter(hq[0], hq[1]) : [hq[0] * 64, hq[1] * 64]) : { x: 0, y: 0, z: 0 };
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: leaderName,
          action: 'returned from scouting mission',
          house: this.getHouseId(),
          houseName: factionName,
          quantity: survivors,
          communication: this.status !== 'failed' ? global.eventManager.commModes.NONE : global.eventManager.commModes.NONE,
          position: { x: hqCoords[0] || 0, y: hqCoords[1] || 0, z: 0 },
          log: logMessage,
          metadata: { survivors, missionSuccess: this.status !== 'failed' }
        });
      }
      
      // Record completion in logger for daily report
      if (this.status !== 'failed' && house.ai && house.ai.logger && typeof house.ai.logger.recordScoutingCompletion === 'function') {
        house.ai.logger.recordScoutingCompletion();
      }
      
      if (this.status !== 'failed') {
        this.notifyReturnSuccess();
      }
    } else {
      // All units lost
      const factionName = this.getFactionName();
      const logMessage = `[SCOUT] ${factionName}: Party failed to return - all units lost`;
      console.log(logMessage);
      
      // Create Event Manager event for complete failure (all units lost)
      if (global.eventManager && this.leader && this.getHouse()) {
        global.eventManager.createEvent({
          category: global.eventManager.categories.FACTION,
          subject: this.leader.id,
          subjectName: this.leader.name || 'Unknown',
          action: 'scouting mission failed',
          house: this.getHouseId(),
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
    const house = this.getHouse();
    if (house && house.ai && house.ai.knowledge && this.targetZone) {
      house.ai.knowledge.markZoneAsKnown(this.targetZone);
    }
  }

  // Notify successful return
  notifyReturnSuccess() {
    if (this.completionNotified) {
      return;
    }
    this.completionNotified = true;
    const house = this.getHouse();
    if (house && house.ai) {
      house.ai.onScoutingComplete(this.targetZone, this.purpose, false);
    }
  }

  // Notify mission failed
  notifyMissionFailed() {
    if (this.failureNotified) {
      return;
    }
    this.failureNotified = true;
    const house = this.getHouse();
    if (house && house.ai) {
      house.ai.onScoutingFailed(this.targetZone, this.purpose);
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
      this.leader.scoutingMoveTarget = null;
    }
    
    this.backupUnits.forEach(unit => {
      if (unit) {
        unit.scoutingParty = null;
        unit.scoutingMoveTarget = null;
        if (unit.followBehavior) {
          unit.followBehavior = null;
        }
      }
    });

    // Remove from faction's active parties
    const house = this.getHouse();
    if (house && house.ai && house.ai.militaryManager) {
      const index = house.ai.militaryManager.scoutingParties.indexOf(this);
      if (index > -1) {
        house.ai.militaryManager.scoutingParties.splice(index, 1);
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
