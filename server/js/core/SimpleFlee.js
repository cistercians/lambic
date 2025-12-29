// SimpleFlee.js - Ultra-minimal flee system
// No complex pathfinding, just run away in a reasonable direction

class SimpleFlee {
  constructor() {
  }

  // Helper function to restore original speed when fleeing ends
  restoreSpeed(entity) {
    if (entity._originalBaseSpd !== undefined) {
      entity.baseSpd = entity._originalBaseSpd;
      delete entity._originalBaseSpd; // Clean up
    }
  }

  // Find nearest allied military unit within range
  findNearestAlliedMilitaryUnit(entity, maxDistance) {
    if (!entity.house) return null;
    
    let nearestUnit = null;
    let nearestDistance = Infinity;
    
    // Check if entity's house has allies list
    const entityHouse = global.House && global.House.list ? global.House.list[entity.house] : null;
    const allies = entityHouse ? (entityHouse.allies || []) : [];
    
    // Use context-aware entity filtering to only check entities in same context
    const candidates = global.mapContextHelpers 
      ? global.mapContextHelpers.getEntitiesInSameContext(entity, { excludeId: entity.id })
      : Object.values(global.Player.list).filter(p => p && p.id !== entity.id);
    
    for (const unit of candidates) {
      if (!unit) continue;
      
      // Must be military unit
      if (!unit.military || unit.military !== true) continue;
      
      // Must be on same z-level
      if (unit.z !== entity.z) continue;
      
      // Check if ally: same house OR in allies list OR use global.isAlly if available
      let isAlly = false;
      if (unit.house === entity.house) {
        isAlly = true;
      } else if (allies.indexOf(unit.house) !== -1) {
        isAlly = true;
      } else if (global.isAlly && typeof global.isAlly === 'function') {
        try {
          isAlly = global.isAlly(entity.id, unit.id);
        } catch (e) {
          // If isAlly throws error, skip
        }
      }
      
      if (!isAlly) continue;
      
      // Calculate distance
      const dx = unit.x - entity.x;
      const dy = unit.y - entity.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= maxDistance && distance < nearestDistance) {
        nearestDistance = distance;
        nearestUnit = unit;
      }
    }
    
    if (nearestUnit) {
      const loc = global.getLoc(nearestUnit.x, nearestUnit.y);
      return {
        unit: nearestUnit,
        loc: loc,
        z: nearestUnit.z
      };
    }
    
    return null;
  }

  // Main flee update - called every frame for entities with action='flee'
  update(entity) {
    // Get target - prefer combatState.target, fall back to combat.target for backward compatibility
    const targetId = (entity.combatState && entity.combatState.target) || (entity.combat && entity.combat.target);
    
    // Validate flee state
    if (!targetId) {
      this.restoreSpeed(entity);
      entity.action = null;
      // Clear both combat state objects
      if (entity.combatState) entity.combatState.target = null;
      if (entity.combat) entity.combat.target = null;
      // Clear flee target tracking
      entity._fleeTarget = null;
      entity._fleeTargetCheckTimer = 0;
      return;
    }

    const target = global.Player.list[targetId];
    
    // Target gone or is a ghost? Stop fleeing (ghosts don't scare animals)
    if (!target || target.ghost) {
      this.restoreSpeed(entity);
      // Clear both combat state objects
      if (entity.combatState) entity.combatState.target = null;
      if (entity.combat) entity.combat.target = null;
      // Clear flee target tracking
      entity._fleeTarget = null;
      entity._fleeTargetCheckTimer = 0;
      entity._fleeDestinationCooldown = 0;
      entity.action = null;
      return;
    }

    // Simple cooldown to prevent rapid oscillation (only after moves)
    if (!entity.fleeCooldown) {
      entity.fleeCooldown = 0;
    }
    
    if (entity.fleeCooldown > 0) {
      entity.fleeCooldown--;
      // Don't return here - still allow flee logic to run
    }

    // Set flee speed - use character's run speed
    // Store original baseSpd before changing it (only once)
    if (!entity._originalBaseSpd) {
      entity._originalBaseSpd = entity.baseSpd;
    }
    entity.baseSpd = entity.runSpd || 6;
    
    // Update speed will be called by the entity's update function

    // Calculate distance from threat
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Far enough? Stop fleeing
    if (distance > 512) {
      this.restoreSpeed(entity);
      // Clear both combat state objects
      if (entity.combatState) entity.combatState.target = null;
      if (entity.combat) entity.combat.target = null;
      // Clear flee target tracking
      entity._fleeTarget = null;
      entity._fleeTargetCheckTimer = 0;
      entity._fleeDestinationCooldown = 0;
      entity.action = null;
      
      // Special behavior for deer - try to find forest
      if (entity.class === 'Deer' && entity.findNearestForest) {
        var forestLoc = entity.findNearestForest();
        if (forestLoc) {
          entity.moveTo(entity.z, forestLoc[0], forestLoc[1]);
        }
      }
      return;
    }

    // Get current location
    const loc = global.getLoc(entity.x, entity.y);
    
    // Check if this is a serf - use special flee logic
    const isSerf = entity.class === 'Serf' || entity.class === 'SerfM' || entity.class === 'SerfF';
    
    if (isSerf) {
      // Track flee target to avoid re-evaluating every frame
      if (!entity._fleeTargetCheckTimer) {
        entity._fleeTargetCheckTimer = 0;
      }
      if (!entity._fleeTarget) {
        entity._fleeTarget = null;
      }
      
      // Re-evaluate flee target periodically (every 60 frames = ~1 second at 60fps)
      const shouldReevaluate = entity._fleeTargetCheckTimer === 0;
      entity._fleeTargetCheckTimer++;
      if (entity._fleeTargetCheckTimer >= 60) {
        entity._fleeTargetCheckTimer = 0;
      }
      
      // If we have a current target and shouldn't re-evaluate, just ensure pathfinding continues
      if (entity._fleeTarget && !shouldReevaluate) {
        // If we have a valid path, let it continue
        if (entity.path && entity.path.length > 0) {
          // Check if fleeing to ally and within proximity - switch to random flee
          if (entity._fleeTarget.type === 'ally' && entity._fleeTarget.allyId && global.Player.list[entity._fleeTarget.allyId]) {
            const ally = global.Player.list[entity._fleeTarget.allyId];
            if (ally) {
              const dx = ally.x - entity.x;
              const dy = ally.y - entity.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              // If within 3 tiles (192 units), switch to random flee
              if (distance <= 192) {
                entity._fleeTarget = null; // Clear target to fall through to random flee
              } else {
                return; // Continue pathfinding to ally
              }
            } else {
              entity._fleeTarget = null; // Ally no longer exists
            }
          } else {
            return; // Continue following path to home or other target
          }
        }
        
        // Path is empty - re-pathfind to same destination if still valid
        if (entity._fleeTarget.type === 'ally' && entity._fleeTarget.allyId && global.Player.list[entity._fleeTarget.allyId]) {
          const ally = global.Player.list[entity._fleeTarget.allyId];
          if (ally && ally.z === entity.z) {
            // Check proximity - if within 3 tiles, switch to random flee
            const dx = ally.x - entity.x;
            const dy = ally.y - entity.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 192) {
              entity._fleeTarget = null; // Clear target to fall through to random flee
            } else {
              // Re-pathfind to ally (no cooldown - destination hasn't changed)
              const allyLoc = global.getLoc(ally.x, ally.y);
              if (entity.moveTo) {
                entity.moveTo(ally.z, allyLoc[0], allyLoc[1]);
              }
              return;
            }
          } else {
            entity._fleeTarget = null; // Ally invalid
          }
        } else if (entity._fleeTarget.type === 'home' && entity.home) {
          // Re-pathfind to home (no cooldown - destination hasn't changed)
          const homeZ = entity.home.z !== undefined ? entity.home.z : entity.z;
          if (entity.moveTo) {
            entity.moveTo(homeZ, entity.home.loc[0], entity.home.loc[1]);
          }
          return;
        }
      }
      
      // Re-evaluate flee destination
      if (shouldReevaluate || !entity._fleeTarget) {
        // Priority 1: Flee to nearest allied military unit
        const maxAllyDistance = 1280; // 20 tiles
        const nearestAlly = this.findNearestAlliedMilitaryUnit(entity, maxAllyDistance);
        
        if (nearestAlly && entity.moveTo) {
          // Check proximity - if already within 3 tiles, don't pathfind, use random flee
          const dx = nearestAlly.unit.x - entity.x;
          const dy = nearestAlly.unit.y - entity.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= 192) {
            // Already close enough - use random flee
            entity._fleeTarget = null;
            // Fall through to random flee logic
          } else {
            // Check if destination changed (compare coordinates, not just ID)
            const allyLoc = global.getLoc(nearestAlly.unit.x, nearestAlly.unit.y);
            const newDestKey = `${nearestAlly.z},${allyLoc[0]},${allyLoc[1]}`;
            const currentDestKey = entity._fleeTarget && entity._fleeTarget.destKey ? entity._fleeTarget.destKey : null;
            const destinationChanged = newDestKey !== currentDestKey;
            
            // Only set cooldown if destination actually changed
            if (destinationChanged) {
              if (!entity._fleeDestinationCooldown) {
                entity._fleeDestinationCooldown = 0;
              }
              entity._fleeDestinationCooldown = 10; // Small cooldown only when destination changes
            } else {
              // Destination same - no cooldown, just re-pathfind if needed
              entity._fleeDestinationCooldown = 0;
            }
            
            // Pathfind if destination changed or path is empty
            if (destinationChanged || !entity.path || entity.path.length === 0) {
              entity.moveTo(nearestAlly.z, allyLoc[0], allyLoc[1]);
              entity._fleeTarget = { 
                type: 'ally', 
                allyId: nearestAlly.unit.id,
                destKey: newDestKey,
                z: nearestAlly.z,
                loc: allyLoc
              };
            }
            return; // Ally found, use pathfinding - don't do random flee
          }
        }
        
        // Priority 2: Flee to home location if available and built
        if (entity.home && entity.home.loc && Array.isArray(entity.home.loc) && entity.home.loc.length >= 2) {
          // Check if hut is built (if hut property exists)
          let canFleeHome = true;
          if (entity.hut && global.Building && global.Building.list) {
            const hut = global.Building.list[entity.hut];
            if (!hut || !hut.built) {
              canFleeHome = false; // Hut exists but not built - don't flee home
            }
          }
          
          if (canFleeHome && entity.moveTo) {
            const homeZ = entity.home.z !== undefined ? entity.home.z : entity.z;
            const newDestKey = `${homeZ},${entity.home.loc[0]},${entity.home.loc[1]}`;
            const currentDestKey = entity._fleeTarget && entity._fleeTarget.destKey ? entity._fleeTarget.destKey : null;
            const destinationChanged = newDestKey !== currentDestKey;
            
            // Only set cooldown if destination actually changed
            if (destinationChanged) {
              if (!entity._fleeDestinationCooldown) {
                entity._fleeDestinationCooldown = 0;
              }
              entity._fleeDestinationCooldown = 10; // Small cooldown only when destination changes
            } else {
              entity._fleeDestinationCooldown = 0;
            }
            
            if (destinationChanged || !entity.path || entity.path.length === 0) {
              entity.moveTo(homeZ, entity.home.loc[0], entity.home.loc[1]);
              entity._fleeTarget = { 
                type: 'home',
                destKey: newDestKey,
                z: homeZ,
                loc: entity.home.loc
              };
            }
            return; // Home available, use pathfinding - don't do random flee
          }
        }
        
        // No valid target found - clear flee target and fall through to random flee
        entity._fleeTarget = null;
      }
      
      // Handle destination change cooldown (only used to prevent oscillation)
      if (entity._fleeDestinationCooldown && entity._fleeDestinationCooldown > 0) {
        entity._fleeDestinationCooldown--;
      }
      
      // Priority 3: Fall through to random direction flee (handled below)
    }
    
    // Calculate direction AWAY from threat (for non-serf entities or serfs with no ally/home)
    const awayX = entity.x - target.x;
    const awayY = entity.y - target.y;
    
    // Normalize
    const magnitude = Math.sqrt(awayX * awayX + awayY * awayY);
    let dirX = magnitude > 0 ? awayX / magnitude : 0;
    let dirY = magnitude > 0 ? awayY / magnitude : 0;

    // For deer, try to flee toward forest if very close
    if (entity.class === 'Deer' && entity.findNearestForest) {
      var forestLoc = entity.findNearestForest();
      if (forestLoc) {
        var forestDx = forestLoc[0] - loc[0];
        var forestDy = forestLoc[1] - loc[1];
        var forestDist = Math.sqrt(forestDx * forestDx + forestDy * forestDy);
        
        // Only blend if forest is very close (within 3 tiles)
        if (forestDist <= 3 && forestDist > 0) {
          var forestDirX = forestDx / forestDist;
          var forestDirY = forestDy / forestDist;
          
          // Blend flee direction with forest direction (90% flee, 10% forest)
          var blendedX = (dirX * 0.9) + (forestDirX * 0.1);
          var blendedY = (dirY * 0.9) + (forestDirY * 0.1);
          
          // Normalize blended direction
          var blendedMag = Math.sqrt(blendedX * blendedX + blendedY * blendedY);
          if (blendedMag > 0) {
            dirX = blendedX / blendedMag;
            dirY = blendedY / blendedMag;
          }
        }
      }
    }

    // Choose the strongest direction (cardinal only for stability)
    const mapSize = global.mapSize || 128;
    let fleeCol = loc[0];
    let fleeRow = loc[1];

    // Calculate which direction is strongest
    let bestDir = null;
    let bestScore = -Infinity;
    
    const directions = [
      {name: 'right', dx: 1, dy: 0},
      {name: 'left', dx: -1, dy: 0},
      {name: 'down', dx: 0, dy: 1},
      {name: 'up', dx: 0, dy: -1}
    ];
    
    for (const dir of directions) {
      // Calculate how well this direction aligns with flee direction
      const alignment = (dir.dx * dirX) + (dir.dy * dirY);
      
      // Check if this direction is walkable
      const checkCol = loc[0] + dir.dx;
      const checkRow = loc[1] + dir.dy;
      
      if (checkCol < 0 || checkCol >= mapSize || checkRow < 0 || checkRow >= mapSize) {
        continue; // Out of bounds
      }
      
      if (!global.isWalkable(entity.z, checkCol, checkRow)) {
        continue; // Not walkable
      }
      
      // Score this direction
      const score = alignment;
      
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    
    // If we found a good direction, use it
    if (bestDir) {
      fleeCol = loc[0] + bestDir.dx;
      fleeRow = loc[1] + bestDir.dy;
    } else {
      // No good direction found - try any walkable adjacent tile
      const adjacentTiles = [
        [loc[0] + 1, loc[1]],     // right
        [loc[0] - 1, loc[1]],     // left
        [loc[0], loc[1] + 1],     // down
        [loc[0], loc[1] - 1],     // up
        [loc[0] + 1, loc[1] + 1], // down-right
        [loc[0] - 1, loc[1] + 1], // down-left
        [loc[0] + 1, loc[1] - 1], // up-right
        [loc[0] - 1, loc[1] - 1]  // up-left
      ];

      // Try to find any walkable adjacent tile
      for (const tile of adjacentTiles) {
        if (tile[0] >= 0 && tile[0] < mapSize && tile[1] >= 0 && tile[1] < mapSize) {
          if (global.isWalkable(entity.z, tile[0], tile[1])) {
            fleeCol = tile[0];
            fleeRow = tile[1];
            break;
          }
        }
      }
    }

    // Create simple path if we don't have one
    if (!entity.path) {
      entity.path = [[fleeCol, fleeRow]];
      entity.pathCount = 0;
      // Set cooldown only when creating new path (changing direction)
      entity.fleeCooldown = 30; // 30 frames = 0.5 seconds at 60fps
    }
  }
}

module.exports = SimpleFlee;