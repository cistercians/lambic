// SimpleCombat.js - Ultra-minimal combat system
// No complex state management, just direct damage

class SimpleCombat {
  constructor() {
  }

  // Main combat update - called every frame for entities with action='combat'
  update(entity) {
    // Validate combat state
    if (!entity.combat || !entity.combat.target) {
      entity.action = null;
      return;
    }

    const target = global.Player.list[entity.combat.target];
    
    // Target gone? Clear combat
    if (!target) {
      entity.combat.target = null;
      entity.action = null;
      return;
    }

    // Target on different z-level? End combat
    if (target.z !== entity.z) {
      this.endCombat(entity, target);
      return;
    }
    
    // Target is a ghost? End combat (ghosts are invisible to NPCs)
    if (target.ghost) {
      this.endCombat(entity, target);
      return;
    }
    
    // Target is in god mode? End combat (spectator mode - not in game)
    if (target.godMode) {
      this.endCombat(entity, target);
      return;
    }

    // Calculate distance
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine attack range (boars have short range for charging/ramming)
    let attackRange;
    if (entity.class === 'Boar') {
      attackRange = 32; // Boars must charge close to ram with tusks
    } else if (entity.ranged) {
      attackRange = 256;
    } else {
      attackRange = 96;
    }
    const maxChaseRange = (entity.aggroRange || 512) * 2;

    // Too far? End combat
    if (distance > maxChaseRange) {
      // Target too far logging handled via combat event
      this.endCombat(entity, target);
      return;
    }

    // Check leash range
    if (entity.home && entity.home.loc) {
      const homeX = entity.home.loc[0] * 64;
      const homeY = entity.home.loc[1] * 64;
      const homeDist = Math.sqrt(Math.pow(entity.x - homeX, 2) + Math.pow(entity.y - homeY, 2));
      const leashRange = entity.wanderRange || 2048;

      if (homeDist > leashRange) {
        // Leash logging handled via combat event
        this.endCombat(entity, target);
        entity.action = 'returning';
        if (entity.return) entity.return();
        return;
      }
    }

    // IN RANGE? Attack!
    if (distance <= attackRange) {
      // Initialize last attack time if needed
      if (!entity._lastCombatAttack) {
        entity._lastCombatAttack = 0;
      }

      const now = Date.now();
      const cooldownMs = entity.ranged ? 1500 : 1000;
      const timeSince = now - entity._lastCombatAttack;

      if (timeSince >= cooldownMs) {
        // ATTACK!
        // Skip damage if target is in god mode, is a ghost, or is invulnerable (like falcons)
        if(target.godMode || target.ghost || target.hp === null){
          // End combat with invulnerable target
          this.endCombat(entity);
          return;
        }
        
        const damage = entity.damage || 10;
        target.hp -= damage;
        entity._lastCombatAttack = now;
        
        // Create combat attack event
        if(global.eventManager){
          global.eventManager.combatAttack(entity, target, damage, { x: target.x, y: target.y, z: target.z });
        }
        
        // Trigger attack animation
        entity.pressingAttack = true;
        setTimeout(() => {
          if (entity) entity.pressingAttack = false;
        }, 200); // 200ms attack animation

        if (entity.class === 'Boar') {
        }
        // Combat hit logging handled via combat event

      // Check for death (only if entity has HP - exclude invulnerable entities like falcons)
      if (target.hp !== null && target.hp <= 0) {
        const killerName = entity.name || entity.class;
        const victimName = target.name || target.class;
        // Death logging handled via death event
        
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
        } else if (entity.type === 'player') {
          // Player killed an NPC - announce to player
          const socket = global.SOCKET_LIST[entity.id];
          if (socket) {
            socket.write(JSON.stringify({ 
              msg: 'addToChat', 
              message: `<span style="color:green;">⚔️ You killed ${victimName}!</span>` 
            }));
          }
        }
        
        if (target.die) {
          target.die({ id: entity.id, cause: entity.ranged ? 'ranged' : 'melee' });
        }
      }
      }
    } else {
      // OUT OF RANGE? Chase!
      if (!entity.path && entity.moveTo) {
        // Initialize pathfinding failure counter if needed
        if (!entity._pathfindingFailures) {
          entity._pathfindingFailures = 0;
        }
        
        // NPCs run when chasing in combat - use their runSpd
        if (entity.type === 'npc' && !entity.running) {
          entity.running = true;
          // Store original baseSpd before changing it
          if (!entity._originalBaseSpd) {
            entity._originalBaseSpd = entity.baseSpd;
          }
          entity.baseSpd = entity.runSpd || 6; // Use NPC's runSpd, fallback to 6
          entity.maxSpd = entity.runSpd || 6;
        }
        const targetLoc = global.getLoc(target.x, target.y);
        
        if (entity.class === 'Boar') {
        }
        
        // Store position before attempting to move
        const oldX = entity.x;
        const oldY = entity.y;
        
        entity.moveTo(target.z, targetLoc[0], targetLoc[1]);
        
        // Check if pathfinding failed (entity didn't move and no path was created)
        // Clear any existing timeout first
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
                console.log(`${entity.class} ${entity.id} failed to pathfind ${entity._pathfindingFailures} times, dropping combat`);
                this.endCombat(entity, target);
                entity._pathfindingFailures = 0; // Reset counter
              }
            } else {
              // Pathfinding succeeded, reset counter
              entity._pathfindingFailures = 0;
            }
          }
          entity._pathfindTimeout = null; // Clear reference
        }, 1000); // Check after 1 second
      }
    }
  }

  // Check for enemies to aggro
  checkAggro(entity) {
    // Skip peaceful/non-combat classes
    const nonCombatClasses = ['Falcon'];
    if (nonCombatClasses.includes(entity.class)) return;
    
    // Skip if returning or already in combat (flee entities can re-check aggro)
    if (entity.action === 'returning' || entity.action === 'combat') return;

    const aggroRange = entity.aggroRange || 512;
    
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
            // Calculate distance to attacker
            const dx = attacker.x - entity.x;
            const dy = attacker.y - entity.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // If attacker is in range, defend the serf
            if (distance <= aggroRange) {
              console.log(`🛡️ ${entity.class} defending ${serf.name || serf.class} from ${attacker.class}`);
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
      
      // Skip ghosts - they are invisible to all NPCs
      if (target.ghost) continue;
      
      // Skip spectators - they are invisible and invulnerable
      if (target.type === 'spectator') continue;
      
      // Skip non-combatant targets
      if (nonCombatClasses.includes(target.class)) continue;
      
      // Only wolves can target prey animals (deer)
      if (target.isPrey && entity.class !== 'Wolf') continue;
      
      // Serfs should not target prey animals (deer)
      if (target.isPrey && entity.class === 'Serf') continue;

      const dx = target.x - entity.x;
      const dy = target.y - entity.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > aggroRange) continue;

      // Check alliance
      const ally = global.allyCheck ? global.allyCheck(entity.id, target.id) : -1;
      
      if (ally >= 0) continue;

      // AGGRO!
      this.startCombat(entity, target);
      return;
    }
  }

  // Start combat
  startCombat(entity, target) {
    // Skip peaceful units
    const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
    if (peaceful.includes(entity.class)) {
      // Serfs should not flee from prey animals (deer)
      if (target.isPrey && entity.class === 'Serf') {
        return; // Don't start combat or flee
      }
      entity.action = 'flee';
      entity.combat.target = target.id;
      // Reset pathfinding failure counter for new combat
      entity._pathfindingFailures = 0;
      return;
    }
    
    // Only wolves can attack prey animals
    if (target.isPrey && entity.class !== 'Wolf') {
      return; // Don't start combat
    }

    entity.action = 'combat';
    entity.combat.target = target.id;
    entity._lastCombatAttack = 0; // Reset attack timer
    // Reset pathfinding failure counter for new combat
    entity._pathfindingFailures = 0;

    // Counter-aggro
    if (target.type === 'npc' && target.military && target.action !== 'combat') {
      this.startCombat(target, entity);
    } else if (target.type === 'player') {
      target.action = 'combat';
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

    // Combat start logging handled via combat event
  }

  // End combat for both sides
  endCombat(entity, target) {
    if (!entity) return;


    // If target not provided, look it up from entity's combat state
    if (!target && entity.combat && entity.combat.target) {
      target = Player.list[entity.combat.target];
    }

    // Clear entity's combat state
    entity.action = null;
    entity.combat.target = null;
    // DON'T clear path - entity might be navigating somewhere after combat
    entity._lastCombatAttack = 0;
    
    // Clear pathfinding timeout and reset failure counter
    if (entity._pathfindTimeout) {
      clearTimeout(entity._pathfindTimeout);
      entity._pathfindTimeout = null;
    }
    entity._pathfindingFailures = 0;
    
    // Resume patrol if entity was in patrol mode
    if (entity.mode === 'patrol' && entity.patrol) {
      // Entity will automatically resume patrol in next update cycle
      // Clear path so they start fresh patrol movement
      entity.path = null;
      entity.pathCount = 0;
    }
    
    // Stop running when combat ends (NPCs only, players control their own running)
    if (entity.type === 'npc' && entity.running) {
      entity.running = false;
      // Restore original baseSpd - we need to store it when combat starts
      entity.baseSpd = entity._originalBaseSpd || 2;
      entity.maxSpd = entity._originalBaseSpd || 2;
    }

    // Clear target's combat state if they were targeting this entity
    if (target && target.combat && target.combat.target === entity.id) {
      target.action = null;
      target.combat.target = null;
      // DON'T clear path - target might be navigating somewhere after combat
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
}

module.exports = SimpleCombat;
