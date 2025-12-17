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
    this.AUTO_ATTACK_RESUME_TIMEOUT = 3000; // 3 seconds - auto-resume after navigation
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
    // Additional validation: check if target still exists in Player.list
    if (global.Player.list && !global.Player.list[target.id]) return false;
    return true;
  }

  // Validate combat state consistency
  validateCombatState(entity) {
    if (!entity) return false;
    
    const state = entity.combatState;
    if (!state) return true; // No state is valid (not in combat)
    
    // If state exists, check if target is valid
    if (state.target) {
      const target = global.Player.list[state.target];
      if (!this.isTargetValid(target, entity)) {
        // Invalid target - auto-repair by clearing state
        if (global.debugCombat) {
          console.warn(`[SimpleCombat] Invalid combat state for ${entity.id}, clearing state`);
        }
        this.clearCombatState(entity);
        entity.action = null;
        return false;
      }
    }
    
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

  // Determine which unit has priority for positioning
  // Priority: Attacker (initiated combat) > Higher HP > Entity ID (tiebreaker)
  getPositioningPriority(entity, target) {
    const entityState = entity.combatState || {};
    const targetState = target.combatState || {};
    
    // Check if entity initiated combat (has been in combat longer)
    const entityCombatTime = entityState.startTime || 0;
    const targetCombatTime = targetState.startTime || 0;
    
    if (entityCombatTime < targetCombatTime) {
      return 'entity'; // Entity started combat first (attacker)
    } else if (targetCombatTime < entityCombatTime) {
      return 'target'; // Target started combat first
    }
    
    // Tiebreaker: Higher HP
    const entityHP = entity.hp !== null ? entity.hp : Infinity;
    const targetHP = target.hp !== null ? target.hp : Infinity;
    
    if (entityHP > targetHP) {
      return 'entity';
    } else if (targetHP > entityHP) {
      return 'target';
    }
    
    // Final tiebreaker: Entity ID (deterministic)
    return entity.id < target.id ? 'entity' : 'target';
  }

  // Remove stealth from entity (standardized)
  removeStealth(entity) {
    if (entity.stealthed) {
      entity.stealthed = false;
      entity.revealed = false;
    }
  }

  // Ensure combat state object exists and return it
  ensureCombatState(entity) {
    if (!entity.combatState) {
      entity.combatState = {
        target: null,
        startTime: null,
        lastAttack: 0,
        pendingTarget: null,
        pendingStartTime: null,
        pathfindingFailures: 0
      };
      // Maintain backward compatibility with entity.combat
      if (!entity.combat) entity.combat = {};
      entity.combat.target = null;
    }
    return entity.combatState;
  }

  // Clear all combat state
  clearCombatState(entity) {
    if (entity.combatState) {
      entity.combatState.target = null;
      entity.combatState.startTime = null;
      entity.combatState.lastAttack = 0;
      entity.combatState.pendingTarget = null;
      entity.combatState.pendingStartTime = null;
      entity.combatState.pathfindingFailures = 0;
    }
    // Also clear backward compatibility object
    if (entity.combat) {
      entity.combat.target = null;
    }
  }

  // Initialize combat state for entity
  initCombatState(entity, targetId) {
    // Validate target exists before initializing
    const target = global.Player.list[targetId];
    if (!target || !this.isTargetValid(target, entity)) {
      if (global.debugCombat) {
        console.warn(`[SimpleCombat] Cannot initialize combat state - invalid target ${targetId}`);
      }
      return false;
    }
    
    const state = this.ensureCombatState(entity);
    entity.action = 'combat';
    state.target = targetId;
    state.startTime = Date.now();
    state.lastAttack = 0;
    state.pendingTarget = null;
    state.pendingStartTime = null;
    state.pathfindingFailures = 0;
    // Maintain backward compatibility
    if (!entity.combat) entity.combat = {};
    entity.combat.target = targetId;
    // For players, ensure autoAttackPaused is cleared so they can fight
    if (entity.type === 'player') {
      entity.autoAttackPaused = false;
      // Clear any resume timeout
      if (entity._autoAttackResumeTimeout) {
        clearTimeout(entity._autoAttackResumeTimeout);
        entity._autoAttackResumeTimeout = null;
      }
    }
    return true;
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
    // Death messages are handled by EventManager.death() in Entity.die()
    // No need to send messages here - they would be duplicates
    
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
      this.initCombatState(target, entity.id);
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
      // Determine priority
      const priority = this.getPositioningPriority(entity, target);
      
      if (priority === 'target') {
        // Target has priority - this entity waits
        // Allow attack anyway (temporary same-tile is OK)
        return false;
      }
      
      // Entity has priority - attempt repositioning
      const adjacentTile = this.findAdjacentTile(entity, target);
      if (adjacentTile && entity.moveTo) {
        // Simple repositioning - no complex state tracking
        entity.moveTo(entity.z, adjacentTile[0], adjacentTile[1]);
        return true; // Repositioning
      }
      
      // No adjacent tile found - allow attack anyway
      return false;
    }
    
    // Not on same tile - no repositioning needed
    return false;
  }


  // ============================================================================
  // MAIN COMBAT UPDATE
  // ============================================================================

  // Main combat update - called every frame for entities with action='combat' or pending stealth attacks
  update(entity) {
    try {
      // Handle pending stealth attacks
      if (this.handlePendingStealthAttack(entity)) {
        return; // Still handling stealth approach
      }
      
      // Validate combat state - single check
      const state = entity.combatState;
      if (!state || !state.target) {
        // Check if there's a pending stealth attack
        if (!state || !state.pendingTarget) {
          entity.action = null;
        }
        return;
      }
      
      // Validate combat state consistency
      if (!this.validateCombatState(entity)) {
        return; // State was invalid and cleared
      }
      
      // Validate entity
      if (entity.toRemove || (entity.hp !== null && entity.hp <= 0)) {
        this.endCombat(entity);
        return;
      }
      
      // Cache target reference to prevent mid-update changes
      const target = global.Player.list[state.target];
      
      // Validate target early
      if (!this.isTargetValid(target, entity)) {
        this.endCombat(entity, target);
        return;
      }

      // Check if auto-attacking is paused (player issued navigation command)
      if (entity.autoAttackPaused) {
        // Check if we should resume auto-attack (target in range or timeout)
        const distance = this.getDistance(entity, target);
        const attackRange = this.getAttackRange(entity);
        
        // Clear pause if target is in attack range
        if (distance <= attackRange) {
          entity.autoAttackPaused = false;
          // Clear any timeout
          if (entity._autoAttackResumeTimeout) {
            clearTimeout(entity._autoAttackResumeTimeout);
            entity._autoAttackResumeTimeout = null;
          }
        } else {
          // Set timeout to auto-resume if navigation takes too long
          if (!entity._autoAttackResumeTimeout) {
            entity._autoAttackResumeTimeout = setTimeout(() => {
              if (entity && entity.autoAttackPaused) {
                entity.autoAttackPaused = false;
                entity._autoAttackResumeTimeout = null;
              }
            }, this.AUTO_ATTACK_RESUME_TIMEOUT);
          }
          return; // Skip combat updates but keep combat status
        }
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
      
      // Only check positioning if we're on same tile AND out of range
      // If in range, allow attack even if on same tile
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
    } catch (error) {
      // Error handling - ensure state cleanup
      if (global.debugCombat) {
        console.error(`[SimpleCombat] Error in update for ${entity.id}:`, error);
      }
      // Clear combat state on error to prevent stuck state
      this.clearCombatState(entity);
      entity.action = null;
    }
  }

  // Handle pending stealth attack approach
  handlePendingStealthAttack(entity) {
    const state = entity.combatState;
    if (!entity.stealthed || entity.revealed || !state || !state.pendingTarget) {
      return false;
    }
    
    const pendingTarget = global.Player.list[state.pendingTarget];
    if (!this.isTargetValid(pendingTarget, entity)) {
      if (state) {
        state.pendingTarget = null;
        state.pendingStartTime = null;
      }
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
      const combatState = this.ensureCombatState(entity);
      combatState.target = pendingTarget.id;
      entity.action = 'combat'; // Ensure action is set
      // Maintain backward compatibility
      if (!entity.combat) entity.combat = {};
      entity.combat.target = pendingTarget.id;
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
    if (state.pendingStartTime && 
        Date.now() - state.pendingStartTime > this.PENDING_COMBAT_TIMEOUT) {
      state.pendingTarget = null;
      state.pendingStartTime = null;
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
    try {
      // Ensure autoAttackPaused is cleared before attacking
      if (entity.type === 'player') {
        entity.autoAttackPaused = false;
        // Clear any resume timeout
        if (entity._autoAttackResumeTimeout) {
          clearTimeout(entity._autoAttackResumeTimeout);
          entity._autoAttackResumeTimeout = null;
        }
      }
      
      const meleeRange = this.getMeleeRange(entity);
      const distance = this.getDistance(entity, target);
      const canAttack = entity.ranged || distance <= meleeRange;
      
      if (!canAttack) {
        // Melee unit in attack range but not close enough - continue pathfinding
        this.handleChase(entity, target);
        return;
      }
      
      // Initialize combat state if needed
      const state = this.ensureCombatState(entity);
      if (!state.lastAttack) {
        state.lastAttack = 0;
      }

      const now = Date.now();
      const cooldownMs = entity.ranged ? this.RANGED_COOLDOWN : this.MELEE_COOLDOWN;
      const timeSince = now - state.lastAttack;

      if (timeSince < cooldownMs) {
        return; // Still on cooldown
      }

      // STEALTH COMBAT: Handle first stealth attack
      if (entity.stealthed && (!state.target || state.pendingTarget)) {
        this.handleStealthAttack(entity, target);
      }
      
      // Final target validation before attack (cached target may have changed)
      if (!this.isTargetValid(target, entity)) {
        this.endCombat(entity, target);
        return;
      }
      
      // Remove stealth when attacking (if still stealthed)
      this.removeStealth(entity);
      this.removeStealth(target); // Attack reveals target
      
      // Update facing to target before attacking
      this.updateFacingToTarget(entity, target);
      
      // Perform attack (state already declared above)
      if (entity.ranged && entity.shootArrow) {
        // Ranged units shoot arrows
        entity.shootArrow(target.id);
        state.lastAttack = now;
        
        // Check if target died (arrow might have hit instantly)
        if (!this.isTargetValid(target, entity)) {
          this.endCombat(entity, target);
          return;
        }
      } else {
        // Melee attack - use standardized damage calculation
        this.applyDamage(entity, target, 'melee');
        state.lastAttack = now;
      }
    } catch (error) {
      // Error handling
      if (global.debugCombat) {
        console.error(`[SimpleCombat] Error in handleAttack for ${entity.id}:`, error);
      }
      // Ensure state cleanup on error
      this.endCombat(entity, target);
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
      // Initialize combat state and pathfinding failure counter if needed
      const state = this.ensureCombatState(entity);
      if (!state.pathfindingFailures) {
        state.pathfindingFailures = 0;
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
        const state = entity.combatState;
        if (entity && state && state.target === target.id) {
          // Check if we're still at the same position and have no path
          if (entity.x === oldX && entity.y === oldY && !entity.path) {
            state.pathfindingFailures++;
            
            // If we've failed multiple times, drop combat
            if (state.pathfindingFailures >= 3) {
              this.endCombat(entity, target);
              state.pathfindingFailures = 0;
            }
          } else {
            // Pathfinding succeeded, reset counter
            state.pathfindingFailures = 0;
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
    const nonCombatClasses = ['Falcon', 'FishingShip'];
    if (nonCombatClasses.includes(entity.class)) return;
    
    // Skip non-combat ship types (fishing and cargo ships can't aggro)
    const nonCombatShipTypes = ['fishingship', 'cargoship'];
    if (entity.shipType && nonCombatShipTypes.includes(entity.shipType)) return;
    
    // Skip if returning or already in combat (but allow peaceful units to detect threats even if fleeing)
    const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
    const isPeaceful = peaceful.includes(entity.class);
    if (!isPeaceful && (entity.action === 'returning' || entity.action === 'combat')) return;
    if (isPeaceful && entity.action === 'returning') return; // Peaceful units can't detect threats when returning home
    // Peaceful units CAN detect threats while fleeing (allows them to switch to closer threats)
    
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
            serf.combatState && serf.combatState.target) {
          
          // Serf is being chased - find the attacker
          const attacker = global.Player.list[serf.combatState.target];
          
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

    // Iterate through all entities to find aggro targets
    for (const id in global.Player.list) {
        const target = global.Player.list[id];

        if (target.id === entity.id) continue;
        if (target.z !== entity.z) continue;
        
        // Skip invalid targets
        if (target.ghost) continue;
        if (target.type === 'spectator') continue;
        if (nonCombatClasses.includes(target.class)) continue;
        // Skip non-combat ship types (fishing and cargo ships can't be targeted)
        if (target.shipType && nonCombatShipTypes.includes(target.shipType)) continue;
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

        // Check alliance FIRST - allies should never aggro each other
        if (global.isAlly && global.isAlly(entity.id, target.id)) {
          continue; // Skip allies
        }

        // Peaceful units (Deer, Sheep, Serfs) detect threats but respect ally checks
        // They should flee from any non-ally entity except their own kind
        if (isPeaceful) {
          // Skip same class (deer don't flee from deer, serfs don't flee from serfs)
          if (target.class === entity.class) continue;
          // Skip prey animals for serfs (serfs don't flee from deer)
          if (target.isPrey && entity.class === 'Serf') continue;
          // Peaceful units check alliance - they only flee from non-allies
          // Peaceful units don't check innaWoods - they should detect threats regardless
          // AGGRO (will trigger flee in startCombat)
          this.startCombat(entity, target);
          return;
        }

        // For non-peaceful units, alliance check already done above

        // Check innaWoods compatibility (NPCs can aggro if both in woods OR target is in woods)
        if (entity.type === 'npc' && target.type === 'player') {
          if (!(entity.innaWoods === target.innaWoods || (!entity.innaWoods && target.innaWoods))) {
            continue; // Can't aggro due to woods state
          }
        }

        // AGGRO!
        this.startCombat(entity, target);
        return;
    }
  }

  // Handle pending stealth aggro
  handlePendingStealthAggro(entity) {
    const state = entity.combatState;
    if (!entity.stealthed || entity.revealed || !state || !state.pendingTarget) {
      return false;
    }
    
    const pendingTarget = global.Player.list[state.pendingTarget];
    if (!pendingTarget || pendingTarget.z !== entity.z) {
      if (state) {
        state.pendingTarget = null;
        state.pendingStartTime = null;
      }
      return false;
    }
    
    const distance = this.getDistance(entity, pendingTarget);
    const attackRange = this.getAttackRange(entity);
    
    if (distance <= attackRange) {
      // In range - combat will start on first attack
      return true; // Skip normal aggro check
    }
    
    // Check timeout
    if (state.pendingStartTime && 
        Date.now() - state.pendingStartTime > this.PENDING_COMBAT_TIMEOUT) {
      state.pendingTarget = null;
      state.pendingStartTime = null;
      return false;
    }
    
    return true; // Still approaching target
  }

  // Start combat
  startCombat(entity, target) {
    // CRITICAL: Check if entities are allies - never start combat between allies
    if (global.isAlly && global.isAlly(entity.id, target.id)) {
      return; // Don't start combat - they are allies
    }
    
    // Skip non-combat ship types (fishing and cargo ships can't participate in combat)
    const nonCombatShipTypes = ['fishingship', 'cargoship'];
    if (entity.shipType && nonCombatShipTypes.includes(entity.shipType)) return;
    if (target.shipType && nonCombatShipTypes.includes(target.shipType)) return;
    
    // STEALTH COMBAT MECHANICS:
    // If attacker is stealthed, don't start combat until first attack or detection
    if (entity.stealthed && !entity.revealed) {
      if (this.checkStealthDetection(entity, target)) {
        // Target detected the stealthed attacker - reveal and start combat
        this.removeStealth(entity);
        // Continue to start combat normally
      } else {
        // Attacker is still stealthed and not detected - don't start combat yet
        const state = this.ensureCombatState(entity);
        if (!state.pendingTarget) {
          state.pendingTarget = target.id;
          state.pendingStartTime = Date.now();
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
      const state = this.ensureCombatState(entity);
      state.target = target.id;
      state.pathfindingFailures = 0;
      // Maintain backward compatibility
      if (!entity.combat) entity.combat = {};
      entity.combat.target = target.id;
      return;
    }
    
    // Only wolves can attack prey animals
    if (target.isPrey && entity.class !== 'Wolf') {
      return; // Don't start combat
    }

    // Initialize combat state (validates target internally)
    if (!this.initCombatState(entity, target.id)) {
      // Target validation failed - don't start combat
      return;
    }
    
    // For players, ensure autoAttackPaused is cleared so they can fight
    // (initCombatState already does this, but keep for clarity)
    if (entity.type === 'player') {
      entity.autoAttackPaused = false;
    }

    // Counter-aggro
    if (target.type === 'npc' && target.military && target.action !== 'combat') {
      this.startCombat(target, entity);
    } else if (target.type === 'player') {
      // Use initCombatState to properly initialize player combat state
      // This validates target and clears autoAttackPaused
      if (this.initCombatState(target, entity.id)) {
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
      // If initCombatState failed, target was invalid - combat won't start
    }
  }

  // End combat for both sides
  endCombat(entity, target) {
    if (!entity) return;

    // If target not provided, look it up from combat state
    if (!target && entity.combatState && entity.combatState.target) {
      target = global.Player.list[entity.combatState.target];
    }

    // Clear all combat state
    this.clearCombatState(entity);
    entity.action = null;
    
    // Clear pathfinding timeout
    if (entity._pathfindTimeout) {
      clearTimeout(entity._pathfindTimeout);
      entity._pathfindTimeout = null;
    }
    
    // Clear auto-attack resume timeout
    if (entity._autoAttackResumeTimeout) {
      clearTimeout(entity._autoAttackResumeTimeout);
      entity._autoAttackResumeTimeout = null;
    }
    
    // Clear autoAttackPaused flag
    if (entity.type === 'player') {
      entity.autoAttackPaused = false;
    }
    
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
    
    // Resume attack-move if active (for players, use pathfinding system)
    if (entity.attackMoveTarget) {
      const attackTarget = entity.attackMoveTarget;
      if (entity.type === 'player' && global.tilemapSystem) {
        // Use pathfinding system for players
        const startLoc = global.getLoc(entity.x, entity.y);
        const layer = attackTarget.z === 0 ? 0 : (attackTarget.z === -1 ? 1 : (attackTarget.z === -2 ? 8 : (attackTarget.z === 1 ? 3 : 5)));
        const options = {
          avoidDoors: true,
          avoidCaveExits: false
        };
        const path = global.tilemapSystem.findPath(startLoc, [attackTarget.col, attackTarget.row], layer, options);
        if (path && path.length > 0) {
          if (attackTarget.z !== -1 && typeof global.smoothPath === 'function') {
            const smoothedPath = global.smoothPath(path, attackTarget.z);
            entity.path = smoothedPath;
          } else {
            entity.path = path;
          }
          const firstWaypoint = path[0];
          if (firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]) {
            entity.pathCount = 1;
          } else {
            entity.pathCount = 0;
          }
        }
      } else if (entity.moveTo) {
        // Fallback for NPCs
        entity.moveTo(attackTarget.z, attackTarget.col, attackTarget.row);
      }
    }

    // Clear target's combat state if they were targeting this entity
    if (target && target.combatState && target.combatState.target === entity.id) {
      this.clearCombatState(target);
      target.action = null;
      
      // Stop running when combat ends (NPCs only)
      if (target.type === 'npc' && target.running) {
        target.running = false;
        target.baseSpd = target._originalBaseSpd || 2;
        target.maxSpd = target._originalBaseSpd || 2;
      }
      
      // Send escape message to player (when enemy gives up)
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
    
    // Send escape message to player (when player escapes)
    if (entity.type === 'player' && target) {
      const distance = this.getDistance(entity, target);
      const escapeRange = 768; // 12 tiles - same as previous escape logic
      if (distance > escapeRange) {
        // Create combat escape event
        if (global.eventManager) {
          global.eventManager.combatEscape(entity, target, { x: entity.x, y: entity.y, z: entity.z });
        }
        
        const playerSocket = global.SOCKET_LIST[entity.id];
        if (playerSocket) {
          playerSocket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You escaped from combat.</i>' }));
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
