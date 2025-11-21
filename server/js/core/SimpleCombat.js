// SimpleCombat.js - Standardized combat system
// All combat logic centralized here for easy debugging and maintenance

class SimpleCombat {
  constructor() {
    // Combat constants
    this.MELEE_RANGE = 96; // 1.5 tiles - actual attack range for melee units
    this.MELEE_ATTACK_RANGE = 96; // Max range to start attacking
    this.RANGED_ATTACK_RANGE = 256; // 4 tiles
    this.RANGED_KITE_DISTANCE = 96; // Too close - back away
    this.BOAR_ATTACK_RANGE = 64; // Boars have standard melee range (1 tile)
    this.DETECTION_RANGE = 128; // 2 tiles for stealth detection
    this.MELEE_COOLDOWN = 1000; // 1 second
    this.RANGED_COOLDOWN = 1500; // 1.5 seconds
    this.KITE_CHECK_INTERVAL = 2000; // 2 seconds
    this.PENDING_COMBAT_TIMEOUT = 5000; // 5 seconds
  }

  // ============================================================================
  // HELPER METHODS - Target Validation & State
  // ============================================================================

  // Validate if a target is valid for combat
  isTargetValid(target, entity) {
    if (!target) return false;
    if (target.toRemove) return false;
    if (target.z !== entity.z) return false;
    if (target.ghost) return false;
    if (target.godMode) return false;
    if (target.hp !== null && target.hp <= 0) return false;
    return true;
  }

  // Get attack range for an entity
  getAttackRange(entity) {
    if (entity.class === 'Boar') return this.BOAR_ATTACK_RANGE;
    if (entity.ranged) return this.RANGED_ATTACK_RANGE;
    return this.MELEE_ATTACK_RANGE;
  }

  // Get melee range for an entity
  getMeleeRange(entity) {
    if (entity.class === 'Boar') return this.BOAR_ATTACK_RANGE;
    if (entity.ranged) return this.RANGED_ATTACK_RANGE;
    return this.MELEE_RANGE;
  }

  // Calculate distance between two entities
  getDistance(entity1, entity2) {
    const dx = entity2.x - entity1.x;
    const dy = entity2.y - entity1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Find best adjacent tile to target (for melee positioning)
  findAdjacentTile(entity, target) {
    const targetLoc = global.getLoc(target.x, target.y);
    const entityLoc = global.getLoc(entity.x, entity.y);
    
    const adjacentTiles = [
      [targetLoc[0] + 1, targetLoc[1]], // Right
      [targetLoc[0] - 1, targetLoc[1]], // Left
      [targetLoc[0], targetLoc[1] + 1], // Down
      [targetLoc[0], targetLoc[1] - 1]  // Up
    ];
    
    let bestTile = null;
    let bestDist = Infinity;
    
    for (const tile of adjacentTiles) {
      if (global.isWalkable && global.isWalkable(entity.z, tile[0], tile[1])) {
        const dist = Math.sqrt(
          Math.pow(tile[0] - entityLoc[0], 2) + 
          Math.pow(tile[1] - entityLoc[1], 2)
        );
        if (dist < bestDist) {
          bestDist = dist;
          bestTile = tile;
        }
      }
    }
    
    return bestTile;
  }

  // Remove stealth from entity (standardized)
  removeStealth(entity) {
    if (entity.stealthed) {
      entity.stealthed = false;
      entity.revealed = false;
    }
  }

  // Initialize combat state for entity
  initCombatState(entity, targetId) {
    if (!entity.combat) entity.combat = {};
    entity.action = 'combat';
    entity.combat.target = targetId;
    entity._lastCombatAttack = 0;
    entity._pathfindingFailures = 0;
    entity._pendingCombatTarget = null;
    entity._pendingCombatStartTime = null;
    // Clear reposition tracking state when starting new combat
    entity._isRepositioning = false;
    entity._repositionAttempts = 0;
    entity._repositionStartTime = null;
    entity._repositionLastPos = null;
  }

  // ============================================================================
  // FACING & DAMAGE
  // ============================================================================

  // Update facing direction based on target position
  updateFacingToTarget(entity, target) {
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    
    // Determine primary direction based on larger axis
    if (Math.abs(dx) > Math.abs(dy)) {
      entity.facing = dx > 0 ? 'right' : 'left';
    } else {
      entity.facing = dy > 0 ? 'down' : 'up';
    }
  }

  // Calculate damage based on weapon and armor stats
  calculateDamage(attacker, target) {
    // Get attacker's weapon damage
    let weaponDamage = attacker.damage || 10; // Base damage for NPCs
    
    // For players, check weapon stats
    if (attacker.type === 'player' && attacker.gear && attacker.gear.weapon) {
      const equip = global.equip || {};
      const weapon = equip[attacker.gear.weapon];
      if (weapon && weapon.dmg) {
        weaponDamage = weapon.dmg;
      }
    }
    
    // Get defender's armor defense
    let armorDefense = target.defense || target.fortitude || 0;
    
    // For players, check armor stats
    if (target.type === 'player' && target.gear) {
      const equip = global.equip || {};
      if (target.gear.armor) {
        const armor = equip[target.gear.armor];
        if (armor && armor.defense) {
          armorDefense += armor.defense;
        }
      }
      if (target.gear.head) {
        const head = equip[target.gear.head];
        if (head && head.defense) {
          armorDefense += head.defense;
        }
      }
    }
    
    // Calculate net damage (minimum 1 to ensure attacks always do some damage)
    const netDamage = Math.max(1, weaponDamage - armorDefense);
    
    return {
      weaponDamage,
      armorDefense,
      netDamage
    };
  }

  // Apply damage with standardized calculation
  applyDamage(attacker, target, damageType = 'melee') {
    // Calculate damage
    const damageInfo = this.calculateDamage(attacker, target);
    const netDamage = damageInfo.netDamage;
    
    // Apply damage
    if (target.hp !== null) {
      target.hp -= netDamage;
    }
    
    // Create combat attack event
    if (global.eventManager) {
      global.eventManager.combatAttack(attacker, target, netDamage, { 
        x: target.x, 
        y: target.y, 
        z: target.z,
        weaponDamage: damageInfo.weaponDamage,
        armorDefense: damageInfo.armorDefense
      });
    }
    
    // Trigger attack animation
    if (attacker.pressingAttack !== undefined) {
      attacker.pressingAttack = true;
      setTimeout(() => {
        if (attacker) attacker.pressingAttack = false;
      }, 200); // 200ms attack animation
    }
    
    // Check for death
    if (target.hp !== null && target.hp <= 0) {
      this.handleTargetDeath(attacker, target, damageType);
    }
    
    return netDamage;
  }

  // Handle target death
  handleTargetDeath(attacker, target, damageType) {
    const killerName = attacker.name || attacker.class;
    const victimName = target.name || target.class;
    
    // Announce death to nearby players
    if (target.type === 'player') {
      // Send to the victim
      const socket = global.SOCKET_LIST[target.id];
      if (socket) {
        socket.write(JSON.stringify({ 
          msg: 'addToChat', 
          message: `<span style="color:red;">💀 You were killed by ${killerName}!</span>` 
        }));
      }
    } else if (attacker.type === 'player') {
      // Player killed an NPC - announce to player
      const socket = global.SOCKET_LIST[attacker.id];
      if (socket) {
        socket.write(JSON.stringify({ 
          msg: 'addToChat', 
          message: `<span style="color:green;">⚔️ You killed ${victimName}!</span>` 
        }));
      }
    }
    
    if (target.die) {
      target.die({ id: attacker.id, cause: damageType });
    }
  }

  // ============================================================================
  // STEALTH MECHANICS
  // ============================================================================

  // Check if a stealthed unit can be detected by another unit
  checkStealthDetection(stealthedEntity, detector) {
    if (!stealthedEntity.stealthed) return false;
    if (stealthedEntity.revealed) return true; // Already revealed
    
    const distance = this.getDistance(stealthedEntity, detector);
    return distance <= this.DETECTION_RANGE;
  }

  // Handle stealth attack initiation
  handleStealthAttack(entity, target) {
    // Remove stealth when attacking
    this.removeStealth(entity);
    this.removeStealth(target); // Attack reveals target too
    
    // Initialize combat state
    this.initCombatState(entity, target.id);
    
    // Counter-aggro if target is NPC or player
    if (target.type === 'npc' && target.military && target.action !== 'combat') {
      this.removeStealth(target);
      this.startCombat(target, entity);
    } else if (target.type === 'player') {
      target.action = 'combat';
      if (!target.combat) target.combat = {};
      target.combat.target = entity.id;
      target._lastCombatAttack = 0;
    }
  }

  // ============================================================================
  // MOVEMENT & POSITIONING
  // ============================================================================

  // Move away from target (for ranged unit kiting)
  moveAwayFromTarget(entity, target) {
    if (!entity.moveTo) return;
    
    const entityLoc = global.getLoc(entity.x, entity.y);
    const targetLoc = global.getLoc(target.x, target.y);
    
    // Calculate direction away from target
    const dx = entityLoc[0] - targetLoc[0];
    const dy = entityLoc[1] - targetLoc[1];
    
    // Normalize direction
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) {
      // Same position - pick random direction
      const directions = [
        [entityLoc[0] + 1, entityLoc[1]],
        [entityLoc[0] - 1, entityLoc[1]],
        [entityLoc[0], entityLoc[1] + 1],
        [entityLoc[0], entityLoc[1] - 1]
      ];
      for (const dir of directions) {
        if (global.isWalkable && global.isWalkable(entity.z, dir[0], dir[1])) {
          entity.moveTo(entity.z, dir[0], dir[1]);
          return;
        }
      }
      return;
    }
    
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    
    // Move 2 tiles away
    const retreatDistance = 2;
    const newX = Math.round(entityLoc[0] + normalizedDx * retreatDistance);
    const newY = Math.round(entityLoc[1] + normalizedDy * retreatDistance);
    
    // Clamp to map bounds
    const mapSize = global.mapSize || 200;
    const clampedX = Math.max(0, Math.min(mapSize - 1, newX));
    const clampedY = Math.max(0, Math.min(mapSize - 1, newY));
    
    if (global.isWalkable && global.isWalkable(entity.z, clampedX, clampedY)) {
      entity.moveTo(entity.z, clampedX, clampedY);
    } else {
      // Try adjacent tiles if direct retreat is blocked
      const adjacentTiles = [
        [Math.round(entityLoc[0] + normalizedDx), Math.round(entityLoc[1] + normalizedDy)],
        [entityLoc[0] + 1, entityLoc[1]],
        [entityLoc[0] - 1, entityLoc[1]],
        [entityLoc[0], entityLoc[1] + 1],
        [entityLoc[0], entityLoc[1] - 1]
      ];
      
      for (const tile of adjacentTiles) {
        const tx = Math.max(0, Math.min(mapSize - 1, tile[0]));
        const ty = Math.max(0, Math.min(mapSize - 1, tile[1]));
        if (global.isWalkable && global.isWalkable(entity.z, tx, ty)) {
          entity.moveTo(entity.z, tx, ty);
          break;
        }
      }
    }
  }

  // Ensure melee units are on adjacent tiles, not same tile
  ensureMeleePositioning(entity, target) {
    if (entity.ranged) return false; // Only for melee
    
    const entityLoc = global.getLoc(entity.x, entity.y);
    const targetLoc = global.getLoc(target.x, target.y);
    
    // Check if on same tile
    if (entityLoc[0] === targetLoc[0] && entityLoc[1] === targetLoc[1]) {
      // PREVENT POSITION SWAPPING: Only one unit should reposition at a time
      // Check if target is already repositioning - if so, this unit waits
      if (target._isRepositioning && target._repositionStartTime) {
        // Target is already repositioning - this unit should wait and allow attack
        return false;
      }
      
      // Check if this unit is already repositioning
      if (entity._isRepositioning) {
        // Already repositioning - continue with reposition logic
        // Initialize reposition attempt counter if not already set
        if (!entity._repositionAttempts) {
          entity._repositionAttempts = 0;
          entity._repositionStartTime = Date.now();
          entity._repositionLastPos = { x: entity.x, y: entity.y };
        }
        
        // Check if we've been trying too long (2 seconds) or too many attempts (10)
        const timeSinceStart = Date.now() - entity._repositionStartTime;
        if (timeSinceStart > 2000 || entity._repositionAttempts >= 10) {
          // Give up on repositioning - allow attack anyway
          entity._isRepositioning = false;
          entity._repositionAttempts = 0;
          entity._repositionStartTime = null;
          entity._repositionLastPos = null;
          return false;
        }
        
        // Check if we're making progress (have we moved?)
        const moved = Math.abs(entity.x - entity._repositionLastPos.x) > 5 || 
                      Math.abs(entity.y - entity._repositionLastPos.y) > 5;
        
        // If we have a path and haven't moved in 1 second, the pathfinding is stuck
        if (entity.path && !moved && timeSinceStart > 1000) {
          // Pathfinding is stuck - clear path and try again or give up
          entity.path = null;
          entity.pathCount = 0;
          entity._repositionAttempts++;
          entity._repositionLastPos = { x: entity.x, y: entity.y };
        }
        
        // Try to find adjacent tile and pathfind
        const adjacentTile = this.findAdjacentTile(entity, target);
        if (adjacentTile && entity.moveTo && !entity.path) {
          // Only pathfind if we don't already have a path
          entity.moveTo(entity.z, adjacentTile[0], adjacentTile[1]);
          entity._repositionAttempts++;
          entity._repositionLastPos = { x: entity.x, y: entity.y };
          return true; // Repositioning
        } else if (!adjacentTile) {
          // No adjacent tile found - can't reposition, allow attack anyway
          entity._isRepositioning = false;
          entity._repositionAttempts = 0;
          entity._repositionStartTime = null;
          entity._repositionLastPos = null;
          return false;
        }
        
        // Already pathfinding - wait for path to complete (but with timeout above)
        return true;
      } else {
        // Not yet repositioning - check if we should start
        // Try to find adjacent tile first
        const adjacentTile = this.findAdjacentTile(entity, target);
        if (adjacentTile && entity.moveTo && !entity.path) {
          // Mark this unit as repositioning BEFORE starting to move
          // This prevents the target from also starting to reposition
          entity._isRepositioning = true;
          entity._repositionAttempts = 1;
          entity._repositionStartTime = Date.now();
          entity._repositionLastPos = { x: entity.x, y: entity.y };
          
          // Start pathfinding to adjacent tile
          entity.moveTo(entity.z, adjacentTile[0], adjacentTile[1]);
          return true; // Repositioning
        } else if (!adjacentTile) {
          // No adjacent tile found - can't reposition, allow attack anyway
          return false;
        }
        
        // Can't start repositioning right now (already have a path or can't move)
        return false;
      }
    }
    
    // Not on same tile - clear reposition tracking
    if (entity._isRepositioning) {
      // Check if we've successfully moved off the same tile
      const newEntityLoc = global.getLoc(entity.x, entity.y);
      const newTargetLoc = global.getLoc(target.x, target.y);
      if (newEntityLoc[0] !== newTargetLoc[0] || newEntityLoc[1] !== newTargetLoc[1]) {
        // Successfully repositioned - clear flag
        entity._isRepositioning = false;
        entity._repositionAttempts = 0;
        entity._repositionStartTime = null;
        entity._repositionLastPos = null;
      }
    }
    return false; // No repositioning needed
  }

  // ============================================================================
  // MAIN COMBAT UPDATE
  // ============================================================================

  // Main combat update - called every frame for entities with action='combat' or pending stealth attacks
  update(entity) {
    // Handle pending stealth attacks
    if (this.handlePendingStealthAttack(entity)) {
      return; // Still handling stealth approach
    }
    
    // Validate combat state
    if (!entity.combat || !entity.combat.target) {
      if (!entity._pendingCombatTarget) {
        entity.action = null;
      }
      return;
    }
    
    // Validate entity
    if (entity.toRemove || (entity.hp !== null && entity.hp <= 0)) {
      this.endCombat(entity);
      return;
    }
    
    // Check if auto-attacking is paused (player issued navigation command)
    if (entity.autoAttackPaused) {
      return; // Skip combat updates but keep combat status
    }

    const target = global.Player.list[entity.combat.target];
    
    // Validate target
    if (!this.isTargetValid(target, entity)) {
      this.endCombat(entity, target);
      return;
    }

    const distance = this.getDistance(entity, target);
    const attackRange = this.getAttackRange(entity);
    const maxChaseRange = (entity.aggroRange || 512) * 2;

    // Too far? End combat
    if (distance > maxChaseRange) {
      this.endCombat(entity, target);
      return;
    }

    // Check leash range
    if (this.checkLeashRange(entity)) {
      this.endCombat(entity, target);
      entity.action = 'returning';
      if (entity.return) entity.return();
      return;
    }

    // Ranged unit kiting
    if (entity.ranged && distance < this.RANGED_KITE_DISTANCE) {
      this.handleRangedKiting(entity, target);
    }

    // Melee positioning check - only reposition if target is OUT of attack range
    // This prevents repositioning loops when both units are in range and should be attacking
    const meleeRange = this.getMeleeRange(entity);
    const isInAttackRange = !entity.ranged && distance <= meleeRange;
    
    if (!entity.ranged && !isInAttackRange) {
      // Target is out of attack range - check if we need to reposition
      const entityLoc = global.getLoc(entity.x, entity.y);
      const targetLoc = global.getLoc(target.x, target.y);
      
      // Only reposition if actually on the same tile AND target is out of range
      if (entityLoc[0] === targetLoc[0] && entityLoc[1] === targetLoc[1]) {
        if (this.ensureMeleePositioning(entity, target)) {
          return; // Repositioning, don't attack yet
        }
        // If repositioning failed or gave up, continue to chase
      }
    }

    // Attack or chase
    if (distance <= attackRange) {
      this.handleAttack(entity, target);
    } else {
      this.handleChase(entity, target);
    }
  }

  // Handle pending stealth attack approach
  handlePendingStealthAttack(entity) {
    if (!entity.stealthed || entity.revealed || !entity._pendingCombatTarget) {
      return false;
    }
    
    const pendingTarget = global.Player.list[entity._pendingCombatTarget];
    if (!this.isTargetValid(pendingTarget, entity)) {
      entity._pendingCombatTarget = null;
      entity._pendingCombatStartTime = null;
      return false;
    }
    
    // Check if target detected the stealthed attacker
    if (this.checkStealthDetection(entity, pendingTarget)) {
      // Detected! Reveal and start combat
      this.removeStealth(entity);
      this.initCombatState(entity, pendingTarget.id);
      return false; // Continue to normal combat
    }
    
    // Still stealthed - move towards target to attack
    const distance = this.getDistance(entity, pendingTarget);
    const attackRange = this.getAttackRange(entity);
    
    if (distance <= attackRange) {
      // In range - can attack (combat will start on first attack)
      // Set up combat state so attack logic can proceed
      if (!entity.combat) entity.combat = {};
      entity.combat.target = pendingTarget.id;
      entity.action = 'combat'; // Ensure action is set
      return false; // Continue to attack logic
    }
    
    // Not in range - pathfind to target
    if (!entity.path && entity.moveTo) {
      const targetLoc = global.getLoc(pendingTarget.x, pendingTarget.y);
      
      // For melee, pathfind to adjacent tile
      if (!entity.ranged) {
        const adjacentTile = this.findAdjacentTile(entity, pendingTarget);
        if (adjacentTile) {
          targetLoc[0] = adjacentTile[0];
          targetLoc[1] = adjacentTile[1];
        } else {
          // No adjacent tile found - try direct path to target (will reposition when close)
          // Don't block, allow pathfinding to proceed
        }
      }
      
      entity.moveTo(pendingTarget.z, targetLoc[0], targetLoc[1]);
    }
    
    // Check timeout
    if (entity._pendingCombatStartTime && 
        Date.now() - entity._pendingCombatStartTime > this.PENDING_COMBAT_TIMEOUT) {
      entity._pendingCombatTarget = null;
      entity._pendingCombatStartTime = null;
      return false;
    }
    
    return true; // Still handling stealth approach
  }

  // Check leash range
  checkLeashRange(entity) {
    if (!entity.home || !entity.home.loc) return false;
    
    const homeX = entity.home.loc[0] * 64;
    const homeY = entity.home.loc[1] * 64;
    const homeDist = Math.sqrt(Math.pow(entity.x - homeX, 2) + Math.pow(entity.y - homeY, 2));
    const leashRange = entity.wanderRange || 2048;
    
    return homeDist > leashRange;
  }

  // Handle ranged unit kiting
  handleRangedKiting(entity, target) {
    if (!entity._lastKiteCheck) {
      entity._lastKiteCheck = 0;
    }
    const now = Date.now();
    // Check every 2 seconds for kiting
    if (now - entity._lastKiteCheck > this.KITE_CHECK_INTERVAL) {
      entity._lastKiteCheck = now;
      this.moveAwayFromTarget(entity, target);
    }
  }

  // Handle attack logic
  handleAttack(entity, target) {
    const meleeRange = this.getMeleeRange(entity);
    const distance = this.getDistance(entity, target);
    const canAttack = entity.ranged || distance <= meleeRange;
    
    if (!canAttack) {
      // Melee unit in attack range but not close enough - continue pathfinding
      this.handleChase(entity, target);
      return;
    }
    
    // Initialize last attack time if needed
    if (!entity._lastCombatAttack) {
      entity._lastCombatAttack = 0;
    }

    const now = Date.now();
    const cooldownMs = entity.ranged ? this.RANGED_COOLDOWN : this.MELEE_COOLDOWN;
    const timeSince = now - entity._lastCombatAttack;

    if (timeSince < cooldownMs) {
      return; // Still on cooldown
    }

    // STEALTH COMBAT: Handle first stealth attack
    if (entity.stealthed && (!entity.combat.target || entity._pendingCombatTarget)) {
      this.handleStealthAttack(entity, target);
    }
    
    // Final target validation before attack
    if (!this.isTargetValid(target, entity)) {
      this.endCombat(entity, target);
      return;
    }
    
    // Remove stealth when attacking (if still stealthed)
    this.removeStealth(entity);
    this.removeStealth(target); // Attack reveals target
    
    // Update facing to target before attacking
    this.updateFacingToTarget(entity, target);
    
    // Perform attack
    if (entity.ranged && entity.shootArrow) {
      // Ranged units shoot arrows
      entity.shootArrow(target.id);
      entity._lastCombatAttack = now;
      
      // Check if target died (arrow might have hit instantly)
      if (!this.isTargetValid(target, entity)) {
        this.endCombat(entity, target);
        return;
      }
    } else {
      // Melee attack - use standardized damage calculation
      this.applyDamage(entity, target, 'melee');
      entity._lastCombatAttack = now;
    }
  }

  // Handle chase logic
  handleChase(entity, target) {
    // Final target validation before chasing
    if (!this.isTargetValid(target, entity)) {
      this.endCombat(entity, target);
      return;
    }
    
    if (!entity.path && entity.moveTo) {
      // Initialize pathfinding failure counter if needed
      if (!entity._pathfindingFailures) {
        entity._pathfindingFailures = 0;
      }
      
      // NPCs run when chasing in combat
      if (entity.type === 'npc' && !entity.running) {
        entity.running = true;
        if (!entity._originalBaseSpd) {
          entity._originalBaseSpd = entity.baseSpd;
        }
        entity.baseSpd = entity.runSpd || 6;
        entity.maxSpd = entity.runSpd || 6;
      }
      
      // For melee units, pathfind to adjacent tile
      let targetLoc = global.getLoc(target.x, target.y);
      if (!entity.ranged) {
        const adjacentTile = this.findAdjacentTile(entity, target);
        if (adjacentTile) {
          targetLoc = adjacentTile;
        }
        // If no adjacent tile found, pathfind directly to target
        // (will be repositioned when close via ensureMeleePositioning)
      }
      
      // Store position before attempting to move
      const oldX = entity.x;
      const oldY = entity.y;
      
      entity.moveTo(target.z, targetLoc[0], targetLoc[1]);
      
      // Check if pathfinding failed
      if (entity._pathfindTimeout) {
        clearTimeout(entity._pathfindTimeout);
      }
      
      entity._pathfindTimeout = setTimeout(() => {
        if (entity && entity.combat && entity.combat.target === target.id) {
          // Check if we're still at the same position and have no path
          if (entity.x === oldX && entity.y === oldY && !entity.path) {
            entity._pathfindingFailures++;
            
            // If we've failed multiple times, drop combat
            if (entity._pathfindingFailures >= 3) {
              this.endCombat(entity, target);
              entity._pathfindingFailures = 0;
            }
          } else {
            // Pathfinding succeeded, reset counter
            entity._pathfindingFailures = 0;
          }
        }
        if (entity) entity._pathfindTimeout = null;
      }, 1000); // Check after 1 second
    }
  }

  // ============================================================================
  // AGGRO & COMBAT INITIATION
  // ============================================================================

  // Check for enemies to aggro
  checkAggro(entity) {
    // Skip peaceful/non-combat classes
    const nonCombatClasses = ['Falcon'];
    if (nonCombatClasses.includes(entity.class)) return;
    
    // Skip if returning or already in combat
    if (entity.action === 'returning' || entity.action === 'combat') return;
    
    // Handle pending stealth attacks
    if (this.handlePendingStealthAggro(entity)) {
      return; // Still handling stealth approach
    }

    const aggroRange = entity.aggroRange || 512;
    const defenseRange = 1000; // 10 tiles - military units respond to fleeing serfs
    
    // PRIORITY: Defend fleeing allied serfs (military units only)
    if (entity.military && entity.house) {
      const serfClasses = ['Serf', 'SerfM', 'SerfF'];
      
      for (const id in global.Player.list) {
        const serf = global.Player.list[id];
        
        // Check if this is a fleeing serf from our faction
        if (serfClasses.includes(serf.class) && 
            serf.action === 'flee' && 
            serf.house === entity.house &&
            serf.combat && serf.combat.target) {
          
          // Serf is being chased - find the attacker
          const attacker = global.Player.list[serf.combat.target];
          
          if (attacker && attacker.z === entity.z) {
            const distance = this.getDistance(attacker, entity);
            
            // Military units have extended defensive range
            if (distance <= defenseRange) {
              this.startCombat(entity, attacker);
              return;
            }
          }
        }
      }
    }

    // Simple loop through all players
    for (const id in global.Player.list) {
      const target = global.Player.list[id];

      if (target.id === entity.id) continue;
      if (target.z !== entity.z) continue;
      
      // Skip invalid targets
      if (target.ghost) continue;
      if (target.type === 'spectator') continue;
      if (nonCombatClasses.includes(target.class)) continue;
      if (target.isPrey && entity.class !== 'Wolf') continue;
      if (target.isPrey && entity.class === 'Serf') continue;

      const distance = this.getDistance(target, entity);
      if (distance > aggroRange) continue;

      // STEALTH: Skip stealthed targets that haven't been detected
      if (target.stealthed && !target.revealed) {
        if (!this.checkStealthDetection(target, entity)) {
          continue; // Can't see stealthed target
        }
      }

      // Check alliance
      const ally = global.allyCheck ? global.allyCheck(entity.id, target.id) : -1;
      if (ally >= 0) continue;

      // AGGRO!
      this.startCombat(entity, target);
      return;
    }
  }

  // Handle pending stealth aggro
  handlePendingStealthAggro(entity) {
    if (!entity.stealthed || entity.revealed || !entity._pendingCombatTarget) {
      return false;
    }
    
    const pendingTarget = global.Player.list[entity._pendingCombatTarget];
    if (!pendingTarget || pendingTarget.z !== entity.z) {
      entity._pendingCombatTarget = null;
      entity._pendingCombatStartTime = null;
      return false;
    }
    
    const distance = this.getDistance(entity, pendingTarget);
    const attackRange = this.getAttackRange(entity);
    
    if (distance <= attackRange) {
      // In range - combat will start on first attack
      return true; // Skip normal aggro check
    }
    
    // Check timeout
    if (entity._pendingCombatStartTime && 
        Date.now() - entity._pendingCombatStartTime > this.PENDING_COMBAT_TIMEOUT) {
      entity._pendingCombatTarget = null;
      entity._pendingCombatStartTime = null;
      return false;
    }
    
    return true; // Still approaching target
  }

  // Start combat
  startCombat(entity, target) {
    // STEALTH COMBAT MECHANICS:
    // If attacker is stealthed, don't start combat until first attack or detection
    if (entity.stealthed && !entity.revealed) {
      if (this.checkStealthDetection(entity, target)) {
        // Target detected the stealthed attacker - reveal and start combat
        this.removeStealth(entity);
        // Continue to start combat normally
      } else {
        // Attacker is still stealthed and not detected - don't start combat yet
        if (!entity._pendingCombatTarget) {
          entity._pendingCombatTarget = target.id;
          entity._pendingCombatStartTime = Date.now();
        }
        return; // Don't start combat yet
      }
    }
    
    // If target is stealthed, check if entity can detect them
    if (target.stealthed && !target.revealed) {
      if (this.checkStealthDetection(target, entity)) {
        // Entity detected the stealthed target - reveal target
        this.removeStealth(target);
        // Continue to start combat normally
      } else {
        // Target is still stealthed and not detected - can't start combat
        return; // Don't start combat - target is invisible
      }
    }
    
    // Skip peaceful units
    const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
    if (peaceful.includes(entity.class)) {
      // Serfs should not flee from prey animals (deer)
      if (target.isPrey && entity.class === 'Serf') {
        return; // Don't start combat or flee
      }
      entity.action = 'flee';
      entity.combat.target = target.id;
      entity._pathfindingFailures = 0;
      return;
    }
    
    // Only wolves can attack prey animals
    if (target.isPrey && entity.class !== 'Wolf') {
      return; // Don't start combat
    }

    // Initialize combat state
    this.initCombatState(entity, target.id);

    // Counter-aggro
    if (target.type === 'npc' && target.military && target.action !== 'combat') {
      this.startCombat(target, entity);
    } else if (target.type === 'player') {
      target.action = 'combat';
      if (!target.combat) target.combat = {};
      target.combat.target = entity.id;
      target._lastCombatAttack = 0;
      
      // Send chat message to player
      const attackerName = entity.name || entity.class;
      const socket = global.SOCKET_LIST[target.id];
      if (socket) {
        socket.write(JSON.stringify({ 
          msg: 'addToChat', 
          message: `<span style="color:red;">⚔️ You are under attack by ${attackerName}!</span>` 
        }));
      }
    }
  }

  // End combat for both sides
  endCombat(entity, target) {
    if (!entity) return;

    // If target not provided, look it up from entity's combat state
    if (!target && entity.combat && entity.combat.target) {
      target = global.Player.list[entity.combat.target];
    }

    // Clear entity's combat state
    entity.action = null;
    if (entity.combat) {
      entity.combat.target = null;
    }
    entity._lastCombatAttack = 0;
    
    // Clear pending stealth combat state
    entity._pendingCombatTarget = null;
    entity._pendingCombatStartTime = null;
    
    // Clear reposition tracking state
    entity._isRepositioning = false;
    entity._repositionAttempts = 0;
    entity._repositionStartTime = null;
    entity._repositionLastPos = null;
    
    // Clear pathfinding timeout and reset failure counter
    if (entity._pathfindTimeout) {
      clearTimeout(entity._pathfindTimeout);
      entity._pathfindTimeout = null;
    }
    entity._pathfindingFailures = 0;
    
    // Resume patrol if entity was in patrol mode
    if (entity.mode === 'patrol' && entity.patrol) {
      entity.path = null;
      entity.pathCount = 0;
    }
    
    // Stop running when combat ends (NPCs only)
    if (entity.type === 'npc' && entity.running) {
      entity.running = false;
      entity.baseSpd = entity._originalBaseSpd || 2;
      entity.maxSpd = entity._originalBaseSpd || 2;
    }
    
    // Resume attack-move if active
    if (entity.attackMoveTarget && entity.moveTo) {
      const attackTarget = entity.attackMoveTarget;
      entity.moveTo(attackTarget.z, attackTarget.col, attackTarget.row);
    }

    // Clear target's combat state if they were targeting this entity
    if (target && target.combat && target.combat.target === entity.id) {
      target.action = null;
      target.combat.target = null;
      target._lastCombatAttack = 0;
      
      // Stop running when combat ends (NPCs only)
      if (target.type === 'npc' && target.running) {
        target.running = false;
        target.baseSpd = target._originalBaseSpd || 2;
        target.maxSpd = target._originalBaseSpd || 2;
      }
      
      // Send escape message to player
      if (target.type === 'player') {
        const escapedFrom = entity.name || entity.class;
        const socket = global.SOCKET_LIST[target.id];
        if (socket) {
          socket.write(JSON.stringify({ 
            msg: 'addToChat', 
            message: `<span style="color:yellow;">🏃 ${escapedFrom} has given up the chase...</span>` 
          }));
        }
      }
    }
  }

  // ============================================================================
  // MILITARY UNIT PROGRESSION
  // ============================================================================
  
  // Check if unit should upgrade based on kills (3rd kill = elite, 10th kill = mounted)
  checkMilitaryUpgrade(unit, house) {
    const progression = global.FACTION_UNIT_PROGRESSION[house.name];
    if (!progression) return;
    
    // 3rd kill: upgrade to elite (if exists)
    if (unit.kills === 3 && progression.elite) {
      this.upgradeMilitaryUnit(unit, progression.elite, house);
    }
    
    // 10th kill: upgrade to mounted (if exists AND stable built)
    if (unit.kills === 10 && progression.mounted && house.hasStable) {
      this.upgradeMilitaryUnit(unit, progression.mounted, house);
    }
  }
  
  // Upgrade a military unit to a new class
  upgradeMilitaryUnit(unit, newClass, house) {
    const oldClass = unit.class;
    const kills = unit.kills; // Preserve kills
    
    // Create new unit with upgraded class
    const constructor = global[newClass];
    if (!constructor) {
      return;
    }
    
    // Copy properties to upgraded unit
    unit.class = newClass;
    unit.name = newClass;
    
    // Apply new unit stats (from constructor)
    const tempUnit = constructor({ x: 0, y: 0, z: 0, house: house.id });
    unit.damage = tempUnit.damage || unit.damage;
    unit.baseSpd = tempUnit.baseSpd || unit.baseSpd;
    unit.runSpd = tempUnit.runSpd || unit.runSpd;
    unit.spriteSize = tempUnit.spriteSize || unit.spriteSize;
    unit.mounted = tempUnit.mounted || false;
    unit.ranged = tempUnit.ranged || false;
    
    // Restore kills
    unit.kills = kills;
    
    
    // Create event
    if (global.eventManager) {
      global.eventManager.createEvent({
        category: global.eventManager.categories.MILITARY,
        action: 'upgraded',
        subjectName: oldClass,
        targetName: newClass,
        house: house.id,
        houseName: house.name,
        communication: [global.eventManager.commModes.HOUSE],
        message: `<span style="color:#ffaa00;">⬆️ ${oldClass} upgraded to ${newClass}!</span>`,
        log: `[MILITARY] ${oldClass} upgraded to ${newClass} at ${kills} kills`,
        position: { x: unit.x, y: unit.y, z: unit.z }
      });
    }
  }
}

module.exports = SimpleCombat;
