// SimpleFlee.js - Ultra-minimal flee system
// No complex pathfinding, just run away in a reasonable direction

class SimpleFlee {
  constructor() {
    console.log('🏃 SimpleFlee initialized');
  }

  // Main flee update - called every frame for entities with action='flee'
  update(entity) {
    // Validate flee state
    if (!entity.combat || !entity.combat.target) {
      entity.action = null;
      entity.baseSpd = 2;
      return;
    }

    const target = global.Player.list[entity.combat.target];
    
    // Target gone? Stop fleeing
    if (!target) {
      entity.combat.target = null;
      entity.action = null;
      entity.baseSpd = 2;
      return;
    }

    // Set flee speed
    entity.baseSpd = 6;

    // Calculate distance from threat
    const dx = target.x - entity.x;
    const dy = target.y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Far enough? Stop fleeing
    if (distance > 512) {
      entity.combat.target = null;
      entity.action = null;
      entity.baseSpd = 2;
      return;
    }

    // Get current location
    const loc = global.getLoc(entity.x, entity.y);
    
    // Calculate direction AWAY from threat
    const awayX = entity.x - target.x;
    const awayY = entity.y - target.y;
    
    // Normalize
    const magnitude = Math.sqrt(awayX * awayX + awayY * awayY);
    const dirX = magnitude > 0 ? awayX / magnitude : 0;
    const dirY = magnitude > 0 ? awayY / magnitude : 0;

    // Pick tile to flee to (one tile away in the opposite direction)
    let fleeCol = loc[0];
    let fleeRow = loc[1];

    if (Math.abs(dirX) > Math.abs(dirY)) {
      // Flee horizontally
      if (dirX > 0) {
        fleeCol = loc[0] + 1; // Flee right
      } else {
        fleeCol = loc[0] - 1; // Flee left
      }
    } else {
      // Flee vertically
      if (dirY > 0) {
        fleeRow = loc[1] + 1; // Flee down
      } else {
        fleeRow = loc[1] - 1; // Flee up
      }
    }

    // Bounds check
    const mapSize = global.mapSize || 128;
    if (fleeCol < 0 || fleeCol >= mapSize || fleeRow < 0 || fleeRow >= mapSize) {
      // Hit edge - try perpendicular direction
      if (Math.abs(dirX) > Math.abs(dirY)) {
        // Was trying horizontal, try vertical
        fleeCol = loc[0];
        fleeRow = dirY > 0 ? loc[1] + 1 : loc[1] - 1;
      } else {
        // Was trying vertical, try horizontal
        fleeRow = loc[1];
        fleeCol = dirX > 0 ? loc[0] + 1 : loc[0] - 1;
      }
    }

    // Final bounds check
    if (fleeCol < 0 || fleeCol >= mapSize || fleeRow < 0 || fleeRow >= mapSize) {
      // Still out of bounds, stay put
      return;
    }

    // Check if target tile is walkable
    if (global.isWalkable(entity.z, fleeCol, fleeRow)) {
      // No active path? Create one
      if (!entity.path) {
        entity.path = [[fleeCol, fleeRow]];
        entity.pathCount = 0;
      }
    } else {
      // Blocked - try adjacent tiles in a pattern
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
            if (!entity.path) {
              entity.path = [tile];
              entity.pathCount = 0;
              break;
            }
          }
        }
      }
    }
  }
}

module.exports = SimpleFlee;

