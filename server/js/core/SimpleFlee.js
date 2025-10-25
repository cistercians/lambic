// SimpleFlee.js - Ultra-minimal flee system
// No complex pathfinding, just run away in a reasonable direction

class SimpleFlee {
  constructor() {
    console.log('🏃 SimpleFlee initialized');
  }

  // Helper function to restore original speed when fleeing ends
  restoreSpeed(entity) {
    if (entity._originalBaseSpd !== undefined) {
      entity.baseSpd = entity._originalBaseSpd;
      delete entity._originalBaseSpd; // Clean up
    }
  }

  // Main flee update - called every frame for entities with action='flee'
  update(entity) {
    // Validate flee state
    if (!entity.combat || !entity.combat.target) {
      this.restoreSpeed(entity);
      entity.action = null;
      return;
    }

    const target = global.Player.list[entity.combat.target];
    
    // Target gone or is a ghost? Stop fleeing (ghosts don't scare animals)
    if (!target || target.ghost) {
      this.restoreSpeed(entity);
      entity.combat.target = null;
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
      entity.combat.target = null;
      entity.action = null;
      
      // Special behavior for deer - try to find forest
      if (entity.class === 'Deer' && entity.findNearestForest) {
        var forestLoc = entity.findNearestForest();
        if (forestLoc) {
          entity.moveTo(entity.z, forestLoc[0], forestLoc[1]);
          console.log('Deer fleeing to forest at [' + forestLoc[0] + ',' + forestLoc[1] + ']');
        }
      }
      return;
    }

    // Get current location
    const loc = global.getLoc(entity.x, entity.y);
    
    // Calculate direction AWAY from threat
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