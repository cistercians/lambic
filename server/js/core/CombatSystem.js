// Comprehensive Combat System Overhaul
class CombatSystem {
  constructor() {
    this.attackCooldowns = new Map();
    this.combatStates = new Map();
    this.lastAttackTimes = new Map();
    
    // Combat configuration
    this.config = {
      attackRange: 64, // Distance for melee attacks
      rangedAttackRange: 256, // Distance for ranged attacks
      attackCooldown: 1000, // Base attack cooldown in ms
      combatTimeout: 10000, // How long to stay in combat without target
      fleeThreshold: 0.1, // HP percentage to flee at
      aggroRange: 256, // Base aggro range
      combatSpeedMultiplier: 1.2 // Speed boost in combat
    };
  }
  
  // Initialize combat for an entity
  initializeCombat(entity) {
    if (!this.combatStates.has(entity.id)) {
      this.combatStates.set(entity.id, {
        target: null,
        lastAttackTime: 0,
        combatStartTime: 0,
        attackCooldown: 0,
        isInCombat: false,
        combatMode: 'melee' // 'melee', 'ranged', 'flee'
      });
    }
  }
  
  // Check if entity can attack
  canAttack(entity) {
    const state = this.combatStates.get(entity.id);
    if (!state) return false;
    
    const now = Date.now();
    return now - state.lastAttackTime >= state.attackCooldown;
  }
  
  // Start combat with target
  startCombat(attacker, target) {
    this.initializeCombat(attacker);
    this.initializeCombat(target);
    
    const attackerState = this.combatStates.get(attacker.id);
    const targetState = this.combatStates.get(target.id);
    
    attackerState.target = target.id;
    attackerState.combatStartTime = Date.now();
    attackerState.isInCombat = true;
    attackerState.attackCooldown = this.config.attackCooldown;
    
    targetState.target = attacker.id;
    targetState.combatStartTime = Date.now();
    targetState.isInCombat = true;
    
    // Set combat action
    attacker.action = 'combat';
    target.action = 'combat';
    
  }
  
  // End combat for entity
  endCombat(entity) {
    const state = this.combatStates.get(entity.id);
    if (!state) return;
    
    // Clear target's combat state first
    if (state.target) {
      const target = global.Player.list[state.target];
      if (target) {
        // Always clear target's combat if they have this entity as their target
        const targetState = this.combatStates.get(target.id);
        if (targetState && targetState.target === entity.id) {
          targetState.target = null;
          targetState.isInCombat = false;
          target.action = null;
          target.combat.target = null;
        }
        
        // ALSO clear if target's legacy combat.target matches
        if (target.combat && target.combat.target === entity.id) {
          target.combat.target = null;
          target.action = null;
        }
      }
    }
    
    // Clear entity state
    state.target = null;
    state.isInCombat = false;
    entity.action = null;
    entity.combat = entity.combat || {};
    entity.combat.target = null;
    entity.combat.targetDmg = 0;
    entity.combat.altDmg = 0;
    
    // Clear any pathing to the target
    if (entity.path) {
      entity.path = null;
      entity.pathCount = 0;
    }
    
  }
  
  // Update combat for entity
  updateCombat(entity) {
    this.initializeCombat(entity);
    const state = this.combatStates.get(entity.id);
    
    if (!state.isInCombat || !state.target) {
      // Entity stuck in combat mode without being in combat - force clear
      if (entity.action === 'combat' && !state.isInCombat) {
        entity.action = null;
        entity.combat.target = null;
        entity.path = null;
        entity.pathCount = 0;
      }
      return;
    }
    
    const target = global.Player.list[state.target];
    if (!target) {
      this.endCombat(entity);
      return;
    }
    
    const distance = entity.getDistance({ x: target.x, y: target.y });
    const now = Date.now();
    
    // Check if entity is frozen (same position for too long in combat)
    if (!state.lastPosition) {
      state.lastPosition = { x: entity.x, y: entity.y, time: now };
    } else {
      const timeSinceMove = now - state.lastPosition.time;
      const distanceMoved = Math.sqrt(
        Math.pow(entity.x - state.lastPosition.x, 2) + 
        Math.pow(entity.y - state.lastPosition.y, 2)
      );
      
      if (distanceMoved > 10) {
        // Entity moved significantly - update position
        state.lastPosition = { x: entity.x, y: entity.y, time: now };
      } else if (timeSinceMove > 2000) {
        // Frozen for 2+ seconds - force end combat
        this.endCombat(entity);
        return;
      }
    }
    
    // Check combat timeout
    if (now - state.combatStartTime > this.config.combatTimeout) {
      this.endCombat(entity);
      return;
    }
    
    // Check if target is too far
    if (distance > this.config.aggroRange * 2) {
      this.endCombat(entity);
      return;
    }
    
    // Check leash range - NPCs should return home if too far from spawn
    if (entity.home && entity.home.loc) {
      const homeCoords = global.getCenter(entity.home.loc[0], entity.home.loc[1]);
      const homeDist = entity.getDistance({ x: homeCoords[0], y: homeCoords[1] });
      const leashRange = entity.wanderRange || 2048; // Default 32 tiles (4x increase)
      
      if (homeDist > leashRange) {
        this.endCombat(entity);
        entity.action = 'returning'; // Set returning state to prevent re-aggro
        entity.return(); // Go back home
        return;
      }
    }
    
    // Determine combat mode
    this.updateCombatMode(entity, target, distance);
    
    // Execute combat actions
    this.executeCombatAction(entity, target, distance);
  }
  
  // Update combat mode based on situation
  updateCombatMode(entity, target, distance) {
    const state = this.combatStates.get(entity.id);
    
    // Check if should flee
    if (entity.hp <= entity.hpMax * this.config.fleeThreshold) {
      state.combatMode = 'flee';
      entity.action = 'flee';
      return;
    }
    
    // Determine attack mode
    if (entity.ranged && distance > this.config.attackRange) {
      state.combatMode = 'ranged';
    } else {
      state.combatMode = 'melee';
    }
  }
  
  // Execute combat action based on mode
  executeCombatAction(entity, target, distance) {
    const state = this.combatStates.get(entity.id);
    
    // Track if any attack happened - if stuck without attacking, end combat
    const lastAttack = state.lastAttackTime || 0;
    const timeSinceAttack = Date.now() - lastAttack;
    
    // If no attack in 3 seconds and entities are close, something is wrong
    if (timeSinceAttack > 3000 && distance < 256) {
      this.endCombat(entity);
      return;
    }
    
    switch (state.combatMode) {
      case 'melee':
        this.handleMeleeCombat(entity, target, distance);
        break;
      case 'ranged':
        this.handleRangedCombat(entity, target, distance);
        break;
      case 'flee':
        this.handleFlee(entity, target);
        break;
    }
  }
  
  // Handle melee combat
  handleMeleeCombat(entity, target, distance) {
    // Move towards target if not in range
    if (distance > this.config.attackRange) {
      this.moveTowardsTarget(entity, target);
    } else {
      // In range, try to attack
      if (this.canAttack(entity)) {
        this.performAttack(entity, target);
      }
    }
  }
  
  // Handle ranged combat
  handleRangedCombat(entity, target, distance) {
    // Maintain optimal distance
    if (distance < this.config.attackRange) {
      // Too close, move away
      this.moveAwayFromTarget(entity, target);
    } else if (distance > this.config.rangedAttackRange) {
      // Too far, move closer
      this.moveTowardsTarget(entity, target);
    } else {
      // In optimal range, attack
      if (this.canAttack(entity)) {
        this.performRangedAttack(entity, target);
      }
    }
  }
  
  // Handle fleeing
  handleFlee(entity, target) {
    this.moveAwayFromTarget(entity, target);
  }
  
  // Move towards target
  moveTowardsTarget(entity, target) {
    if (!entity.follow) {
      return;
    }
    
    // Use existing follow function
    entity.follow(target, true);
    
    // Boost speed in combat
    if (entity.baseSpd) {
      entity.maxSpd = entity.baseSpd * this.config.combatSpeedMultiplier * (global.SPEED_MULTIPLIER || 1);
    }
  }
  
  // Move away from target
  moveAwayFromTarget(entity, target) {
    const loc = global.getLoc(entity.x, entity.y);
    const targetLoc = global.getLoc(target.x, target.y);
    
    // Calculate opposite direction
    const dx = loc[0] - targetLoc[0];
    const dy = loc[1] - targetLoc[1];
    
    // Normalize direction
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 0) {
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;
      
      // Move in opposite direction
      const newX = Math.max(0, Math.min(global.mapSize - 1, loc[0] + Math.round(normalizedDx)));
      const newY = Math.max(0, Math.min(global.mapSize - 1, loc[1] + Math.round(normalizedDy)));
      
      if (global.isWalkable(entity.z, newX, newY)) {
        entity.moveTo(entity.z, newX, newY);
      }
    }
  }
  
  // Perform melee attack
  performAttack(entity, target) {
    const state = this.combatStates.get(entity.id);
    const now = Date.now();
    
    // Skip attacking invulnerable targets (like falcons with hp = null)
    if (target.hp === null) {
      this.endCombat(entity);
      return;
    }
    
    // Calculate damage
    const baseDamage = entity.damage || 10;
    const targetDefense = target.fortitude || 0;
    const actualDamage = Math.max(1, baseDamage - targetDefense);
    
    // Apply damage
    target.hp -= actualDamage;
    
    // Record combat event in social system (for NPC memories)
    if (global.socialSystem && target.type === 'npc') {
      global.socialSystem.recordCombatEvent(target.id, entity.id);
    }
    
    // Update attack timing
    state.lastAttackTime = now;
    state.attackCooldown = this.config.attackCooldown;
    
    // Stop target from working
    target.working = false;
    target.chopping = false;
    target.mining = false;
    target.farming = false;
    target.building = false;
    target.fishing = false;
    
    // Reveal stealth
    target.stealthed = false;
    target.revealed = false;
    entity.stealthed = false;
    entity.revealed = false;
    
    
    // Check for death (only if entity has HP - exclude invulnerable entities like falcons)
    if (target.hp !== null && target.hp <= 0) {
      this.handleTargetDeath(entity, target);
    }
  }
  
  // Perform ranged attack
  performRangedAttack(entity, target) {
    const state = this.combatStates.get(entity.id);
    const now = Date.now();
    
    // Use existing shootArrow function if available
    if (entity.shootArrow) {
      const angle = entity.getAngle(target.x, target.y);
      entity.shootArrow(angle);
    } else {
      // Fallback to melee damage for now
      this.performAttack(entity, target);
    }
    
    // Update attack timing
    state.lastAttackTime = now;
    state.attackCooldown = this.config.attackCooldown;
  }
  
  // Handle target death
  handleTargetDeath(attacker, target) {
    
    // Trigger death
    if (target.die) {
      target.die({ id: attacker.id, cause: 'melee' });
    }
    
    // End combat
    this.endCombat(attacker);
  }
  
  // Check for aggro (called by entities)
  checkAggro(entity) {
    if (!entity || !global.spatialSystem) return;
    
    // Don't aggro if returning home
    if (entity.action === 'returning') return;
    
    // Don't aggro if already in combat (has target)
    const state = this.combatStates.get(entity.id);
    if (state && state.isInCombat && state.target) return;

    // Use spatial system to find nearby targets
    const nearbyTargets = global.spatialSystem.findAggroTargets(entity, entity.aggroRange);
    
    for (const target of nearbyTargets) {
      if (!target || target.z !== entity.z) continue;
      
      // Check if should aggro
      if (this.shouldAggro(entity, target)) {
        this.startCombat(entity, target);
        return; // Only aggro one target at a time
      }
    }
  }
  
  // Determine if entity should aggro target
  shouldAggro(entity, target) {
    // Don't aggro same class
    if (entity.class === target.class) return false;
    
    // Check stealth
    if (target.stealthed && !target.revealed) return false;
    
    // Check alliance
    const ally = global.allyCheck(entity.id, target.id);
    if (ally >= 0) return false; // Allied or neutral - don't attack
    
    // Check if already in combat
    const state = this.combatStates.get(entity.id);
    if (state && state.isInCombat) return false;
    
    return true;
  }
  
  // Get combat stats for debugging
  getCombatStats() {
    const stats = {
      activeCombat: 0,
      entities: []
    };
    
    for (const [id, state] of this.combatStates) {
      if (state.isInCombat) {
        stats.activeCombat++;
        stats.entities.push({
          id,
          target: state.target,
          mode: state.combatMode,
          combatTime: Date.now() - state.combatStartTime
        });
      }
    }
    
    return stats;
  }
}

// Create global combat system instance
const combatSystem = new CombatSystem();

// Export for use
module.exports = {
  CombatSystem,
  combatSystem
};
