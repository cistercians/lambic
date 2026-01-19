/**
 * BattlegroundsEliteNPCBehavior - Handles AI behavior for elite NPCs in battlegrounds
 */
const movementSystem = require('../core/MovementSystem');

function getCombatTargetId(entity) {
  if (!entity) return null;
  if (global.simpleCombat && typeof global.simpleCombat.getCombatTargetId === 'function') {
    return global.simpleCombat.getCombatTargetId(entity);
  }
  return (entity.combatState && entity.combatState.target) ||
    (entity.combat && entity.combat.target) ||
    null;
}

class BattlegroundsEliteNPCBehavior {
  constructor() {
    this.updateInterval = null;
    this.updateIntervalMs = 1000; // Update every second
  }

  /**
   * Start behavior updates for a match
   */
  startBehaviorUpdates(match) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.updateNPCBehaviors(match);
    }, this.updateIntervalMs);
  }

  /**
   * Stop behavior updates
   */
  stopBehaviorUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update behaviors for all NPCs in the match
   */
  updateNPCBehaviors(match) {
    if (!match || match.status !== 'in_progress') {
      this.stopBehaviorUpdates();
      return;
    }

    const { gameMode, participants, eliteNPCs } = match;
    
    if (!eliteNPCs || eliteNPCs.length === 0) return;

    // Get all NPC participants
    const npcs = eliteNPCs.map(npcIdOrInfo => {
      const npcId = typeof npcIdOrInfo === 'string' ? npcIdOrInfo : npcIdOrInfo.id;
      return global.Player.list[npcId];
    }).filter(npc => npc && !npc.toRemove);

    npcs.forEach(npc => {
      if (!npc || !npc.alive || npc.toRemove) return;

      // Get NPC's participant info
      const participant = participants.find(p => p.id === npc.id);
      if (!participant) {
        return;
      }

      // CRITICAL: Set mode and action so normal Character.update() handles movement/combat
      // The normal system expects these properties to be set
      const previousMode = npc.mode;
      const previousAction = npc.action;
      
      if (!npc.mode || npc.mode === 'idle') {
        // Set mode based on game mode - this tells Character.update() what to do
        npc.mode = 'raid'; // Use 'raid' mode for battlegrounds - NPCs will attack enemies
        
        // For 'raid' mode, the normal system expects self.raid.target to be set
        // This should be a tile location [col, row] that the NPC will move towards
        // We'll set this in the game-mode-specific behavior methods
        if (!npc.raid) {
          npc.raid = {};
        }
      }
      
      // If NPC has a combat target, set action to 'combat' so normal system handles it
      if (getCombatTargetId(npc)) {
        npc.action = 'combat';
      } else if (!npc.action || npc.action === 'idle') {
        // No combat target - clear action so normal system can set it
        npc.action = null;
      }

      try {
        if (gameMode === 'deathmatch') {
          this.updateDeathmatchBehavior(npc, match);
        } else if (gameMode === 'skirmish') {
          this.updateSkirmishBehavior(npc, participant, match);
        } else if (gameMode === 'assault') {
          this.updateAssaultBehavior(npc, participant, match);
        }
      } catch (e) {
        console.error(`Error updating behavior for NPC ${npc.id}:`, e);
      }
    });
  }

  /**
   * Update behavior for Deathmatch mode
   * NPCs attack-move towards random points on the opposite half of the map
   */
  updateDeathmatchBehavior(npc, match) {
    if (!npc.attackMoveTarget || this.shouldRecalculateTarget(npc)) {
      // Pick a random point on the opposite half of the map from current position
      const mapSize = match.mapSize;
      const tileSize = global.tileSize || 64;
      const mapBounds = mapSize * tileSize;
      const centerX = mapBounds / 2;

      // If NPC is on left half, move to right half, and vice versa
      let targetX;
      if (npc.x < centerX) {
        targetX = centerX + Math.random() * (mapBounds / 2);
      } else {
        targetX = Math.random() * (mapBounds / 2);
      }

      const targetY = Math.random() * mapBounds;

      // Store attack-move target
      npc.attackMoveTarget = {
        x: targetX,
        y: targetY,
        z: npc.z || match.mapData.startingZ || 0,
        timestamp: Date.now()
      };

      // Set raid target for normal system (tile coordinates [col, row])
      // CRITICAL: raid.target must be set for Character.update() raid mode to work
      const getLoc = global.getLoc || ((x, y) => {
        const tileSize = global.tileSize || 64;
        return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
      });
      const targetLoc = getLoc(targetX, targetY);
      if (targetLoc && targetLoc.length >= 2) {
        // Ensure raid object exists
        if (!npc.raid) {
          npc.raid = {};
        }
        npc.raid.target = targetLoc; // Normal system expects this for 'raid' mode
      }

      // Issue attack-move command (move to target, attacking enemies along the way)
      // The normal system will handle movement via mode='raid' and raid.target
      // But we can also call moveTo() directly as a fallback
      this.issueAttackMoveCommand(npc, targetX, targetY, npc.z || match.mapData.startingZ || 0);
    }
  }

  /**
   * Update behavior for Skirmish mode
   * NPCs attack-move towards the opposing team's starting area
   */
  updateSkirmishBehavior(npc, participant, match) {
    if (!participant.team) return;

    // Determine opposing team's starting area
    const mapSize = match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    const opposingTeamArea = participant.team === 'team1' 
      ? { x: mapBounds * 0.75, y: mapBounds / 2 } // Team 2 area
      : { x: mapBounds * 0.25, y: mapBounds / 2 }; // Team 1 area

    if (!npc.attackMoveTarget || this.shouldRecalculateTarget(npc)) {
      // Add some randomness to the target
      const targetX = opposingTeamArea.x + (Math.random() - 0.5) * (mapBounds * 0.2);
      const targetY = opposingTeamArea.y + (Math.random() - 0.5) * (mapBounds * 0.2);

      npc.attackMoveTarget = {
        x: targetX,
        y: targetY,
        z: npc.z || match.mapData.startingZ || 0,
        timestamp: Date.now()
      };

      // Set raid target for normal system (tile coordinates [col, row])
      const getLoc = global.getLoc || ((x, y) => {
        const tileSize = global.tileSize || 64;
        return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
      });
      const targetLoc = getLoc(targetX, targetY);
      if (targetLoc && targetLoc.length >= 2) {
        npc.raid.target = targetLoc; // Normal system expects this for 'raid' mode
      }

      this.issueAttackMoveCommand(npc, targetX, targetY, npc.z || match.mapData.startingZ || 0);
    }
  }

  /**
   * Update behavior for Assault mode
   * Attackers: attack-move towards capture point
   * Defenders: guard defensive area
   */
  updateAssaultBehavior(npc, participant, match) {
    if (!participant.team) return;

    const isAttacker = participant.team === 'team1';
    const isDefender = participant.team === 'team2';

    if (isAttacker) {
      // Attackers attack-move towards capture point
      const capturePoint = this.getCapturePoint(match);
      if (!capturePoint) return;

      if (!npc.attackMoveTarget || this.shouldRecalculateTarget(npc)) {
        // Move towards capture point with some randomness
        const targetX = capturePoint.x + (Math.random() - 0.5) * (global.tileSize * 5);
        const targetY = capturePoint.y + (Math.random() - 0.5) * (global.tileSize * 5);

        npc.attackMoveTarget = {
          x: targetX,
          y: targetY,
          z: capturePoint.z,
          timestamp: Date.now()
        };

        this.issueAttackMoveCommand(npc, targetX, targetY, capturePoint.z);
      }
    } else if (isDefender) {
      // Defenders guard the defensive area
      const defensiveArea = this.getDefensiveArea(match);
      if (!defensiveArea) return;

      if (!npc.guardTarget || this.shouldRecalculateTarget(npc)) {
        npc.guardTarget = {
          x: defensiveArea.x + (Math.random() - 0.5) * (global.tileSize * 3),
          y: defensiveArea.y + (Math.random() - 0.5) * (global.tileSize * 3),
          z: defensiveArea.z,
          radius: defensiveArea.radius || (global.tileSize * 5),
          timestamp: Date.now()
        };

        this.issueGuardCommand(npc, npc.guardTarget);
      }
    }
  }

  /**
   * Get capture point for Assault mode
   */
  getCapturePoint(match) {
    // Get capture point from game mode if available
    if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch) {
      const currentMatch = global.battlegroundsMatchManager.currentMatch;
      if (currentMatch.matchId === match.matchId && currentMatch.currentGameMode) {
        const gameMode = currentMatch.currentGameMode;
        if (gameMode.capturePoint) {
          return gameMode.capturePoint;
        }
      }
    }

    // Fallback: use map center
    const mapSize = match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    return {
      x: mapBounds * 0.75, // Defender side
      y: mapBounds / 2,
      z: match.mapData.startingZ || 0
    };
  }

  /**
   * Get defensive area for Assault defenders
   */
  getDefensiveArea(match) {
    const capturePoint = this.getCapturePoint(match);
    return {
      x: capturePoint.x,
      y: capturePoint.y,
      z: capturePoint.z,
      radius: global.tileSize * 5 // 5 tile radius
    };
  }

  /**
   * Issue attack-move command to NPC
   * NPC moves towards target, attacking enemies along the way
   */
  issueAttackMoveCommand(npc, targetX, targetY, targetZ) {
    if (!npc || npc.toRemove || !npc.alive) return;

    // Check if there are enemies nearby first
    const nearbyEnemy = this.findNearbyEnemy(npc);
    
    if (nearbyEnemy) {
      // Engage enemy if found
      if (global.simpleCombat && !npc.combat || !npc.combat.target) {
        // Start combat with enemy
        npc.combat = npc.combat || {};
        npc.combat.target = nearbyEnemy.id;
        if (global.simpleCombat) {
          global.simpleCombat.startCombat(npc, nearbyEnemy);
        }
      }
    } else {
      // No enemies nearby, move towards target
      // #region agent log
      // Hypothesis E: Check if moveTo() exists and is being called
      const hasMoveTo = typeof npc.moveTo === 'function';
      // #endregion
      // moveTo expects (z, col, row) - convert pixel coordinates to tile coordinates
      const getLoc = global.getLoc || ((x, y) => {
        const tileSize = global.tileSize || 64;
        return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
      });
      const targetLoc = getLoc(targetX, targetY);
      if (targetLoc && targetLoc.length >= 2) {
        movementSystem.applyMoveIntent(npc, {
          z: targetZ,
          target: [targetLoc[0], targetLoc[1]],
          reason: 'combat',
          sourceAction: npc.action || 'combat'
        });
        // #region agent log
        // #endregion
      } else {
        // #region agent log
        // #endregion
      }
    }
  }

  /**
   * Issue guard command to NPC
   * NPC guards an area, moving within radius and attacking enemies
   */
  issueGuardCommand(npc, guardTarget) {
    if (!npc || npc.toRemove || !npc.alive) return;

    // Check if NPC is within guard radius
    const distance = this.getDistance(npc, guardTarget);
    
    // #region agent log
    // #endregion
    const guardRadius = guardTarget.radius || (global.tileSize * 5);

    // Check for enemies nearby
    const nearbyEnemy = this.findNearbyEnemy(npc);
    
    if (nearbyEnemy) {
      // Engage enemy
      if (global.simpleCombat && (!npc.combat || !npc.combat.target)) {
        npc.combat = npc.combat || {};
        npc.combat.target = nearbyEnemy.id;
        if (global.simpleCombat) {
          global.simpleCombat.startCombat(npc, nearbyEnemy);
        }
      }
    } else if (distance > guardRadius) {
      // Too far from guard position, move back
      movementSystem.applyMoveIntent(npc, {
        z: guardTarget.z,
        target: [guardTarget.x, guardTarget.y],
        reason: 'guard',
        sourceAction: npc.action || 'guard'
      });
    } else if (Math.random() < 0.1) {
      // Occasionally patrol within guard radius
      const angle = Math.random() * Math.PI * 2;
      const patrolRadius = guardRadius * 0.5;
      const patrolX = guardTarget.x + Math.cos(angle) * patrolRadius;
      const patrolY = guardTarget.y + Math.sin(angle) * patrolRadius;

      movementSystem.applyMoveIntent(npc, {
        z: guardTarget.z,
        target: [patrolX, patrolY],
        reason: 'guard',
        sourceAction: npc.action || 'guard'
      });
    }
  }

  /**
   * Find nearby enemy for NPC
   * Uses the NPC's aggroRange property for detection radius
   */
  findNearbyEnemy(npc) {
    if (!npc || !global.Player || !global.Player.list) return null;

    // Use NPC's aggroRange property (defaults to 512 pixels / 8 tiles if not set)
    const aggroRange = npc.aggroRange || 512;
    let nearestEnemy = null;
    let nearestDistance = Infinity;

    // Use context-aware entity filtering to only check entities in same context
    const candidates = global.mapContextHelpers 
      ? global.mapContextHelpers.getEntitiesInSameContext(npc, { excludeId: npc.id })
      : Object.values(global.Player.list).filter(p => p && p.id !== npc.id);
    
    for (const entity of candidates) {
      if (!entity) continue;
      
      // Skip if not alive, or to remove
      if (!entity.alive || entity.toRemove) continue;

      // Skip if on different z-level
      if (entity.z !== npc.z) continue;

      // Check if enemy (using ally check)
      if (global.allyCheck && typeof global.allyCheck === 'function') {
        const allyStatus = global.allyCheck(npc.id, entity.id);
        if (allyStatus >= 0) continue; // Not an enemy (ally or neutral)
      } else if (npc.house && entity.house && npc.house === entity.house) {
        continue; // Same house, not an enemy
      }

      const distance = this.getDistance(npc, entity);
      
      // Use aggroRange for detection
      if (distance <= aggroRange && distance < nearestDistance) {
        nearestEnemy = entity;
        nearestDistance = distance;
      }
    }

    return nearestEnemy;
  }

  /**
   * Get distance between two entities
   */
  getDistance(entity1, entity2) {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Check if target should be recalculated
   */
  shouldRecalculateTarget(npc) {
    if (!npc.attackMoveTarget && !npc.guardTarget) return true;

    const target = npc.attackMoveTarget || npc.guardTarget;
    if (!target || !target.timestamp) return true;

    // Recalculate every 15 seconds
    const targetAge = Date.now() - target.timestamp;
    if (targetAge > 15000) return true;

    // Also recalculate if NPC has reached the target (only for attack-move, not guard)
    if (npc.attackMoveTarget) {
      const distance = this.getDistance(npc, target);
      const threshold = global.tileSize * 2; // 2 tiles
      if (distance < threshold) return true;
    }

    return false;
  }
}

module.exports = BattlegroundsEliteNPCBehavior;

