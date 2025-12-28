/**
 * BattlegroundsMapValidator - Validates that generated maps are playable for each game mode
 */

class BattlegroundsMapValidator {
  constructor() {
    this.TERRAIN = global.TERRAIN || {
      WATER: 0,
      HEAVY_FOREST: 1,
      LIGHT_FOREST: 2,
      BRUSH: 3,
      ROCKS: 4,
      MOUNTAIN: 5,
      CAVE_ENTRANCE: 6,
      EMPTY: 7
    };
  }

  /**
   * Validate a map for playability
   * @param {object} mapData - Map data from generator {worldData, mapType, mapSize, entrances}
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @returns {object} {valid: boolean, reason: string}
   */
  validateMap(mapData, gameMode) {
    if (!mapData || !mapData.worldData) {
      return { valid: false, reason: 'invalid_map_data' };
    }

    const { worldData, mapType, mapSize, entrances } = mapData;
    const startingZ = mapData.startingZ || 0;

    // Basic checks
    const basicCheck = this.checkBasicStructure(worldData, mapSize, startingZ);
    if (!basicCheck.valid) {
      return basicCheck;
    }

    // Game mode specific checks
    if (gameMode === 'deathmatch') {
      return this.validateDeathmatch(worldData, mapSize, startingZ, mapType);
    } else if (gameMode === 'skirmish') {
      return this.validateSkirmish(worldData, mapSize, startingZ, mapType);
    } else if (gameMode === 'assault') {
      return this.validateAssault(worldData, mapSize, startingZ, mapType);
    }

    return { valid: true, reason: 'valid' };
  }

  /**
   * Check basic map structure
   */
  checkBasicStructure(worldData, mapSize, startingZ) {
    // Check if we have the required layers
    if (!worldData || !worldData[0]) {
      return { valid: false, reason: 'missing_overworld_layer' };
    }

    // Check if starting z-level exists
    const layerIndex = startingZ === 0 ? 0 : (startingZ === -1 ? 1 : 0);
    if (!worldData[layerIndex]) {
      return { valid: false, reason: 'missing_starting_layer' };
    }

    return { valid: true };
  }

  /**
   * Validate map for Deathmatch mode
   */
  validateDeathmatch(worldData, mapSize, startingZ, mapType) {
    const layerIndex = startingZ === 0 ? 0 : 1;
    const layer = worldData[layerIndex];
    
    if (!layer) {
      return { valid: false, reason: 'missing_starting_layer' };
    }

    // Count walkable tiles (non-water, non-mountain for overworld; floor tiles for caves)
    let walkableCount = 0;
    let waterCount = 0;
    
    for (let y = 0; y < mapSize; y++) {
      if (!layer[y]) continue;
      for (let x = 0; x < mapSize; x++) {
        const tile = layer[y][x];
        if (startingZ === 0) {
          // Overworld: check if walkable (not water, not mountain)
          if (tile === this.TERRAIN.WATER) {
            waterCount++;
          } else if (tile !== this.TERRAIN.MOUNTAIN && tile < 5) {
            walkableCount++;
          }
        } else if (startingZ === -1) {
          // Caves: check if floor (0) or exit (2)
          if (tile === 0 || tile === 2) {
            walkableCount++;
          }
        }
      }
    }

    // Check minimum walkable area (at least 30% of map should be walkable)
    const totalTiles = mapSize * mapSize;
    const walkableRatio = walkableCount / totalTiles;
    
    if (walkableRatio < 0.3) {
      return { valid: false, reason: 'insufficient_walkable_area' };
    }

    // For non-islands maps, check water percentage (shouldn't be too much)
    if (mapType !== 'islands' && startingZ === 0) {
      const waterRatio = waterCount / totalTiles;
      if (waterRatio > 0.4) {
        return { valid: false, reason: 'too_much_water' };
      }
    }

    // Check connectivity: ensure there are multiple walkable areas
    const connectivityCheck = this.checkConnectivity(layer, mapSize, startingZ);
    if (!connectivityCheck.valid) {
      return connectivityCheck;
    }

    return { valid: true, reason: 'valid' };
  }

  /**
   * Validate map for Skirmish mode
   */
  validateSkirmish(worldData, mapSize, startingZ, mapType) {
    // Same basic checks as deathmatch
    const deathmatchCheck = this.validateDeathmatch(worldData, mapSize, startingZ, mapType);
    if (!deathmatchCheck.valid) {
      return deathmatchCheck;
    }

    const layerIndex = startingZ === 0 ? 0 : 1;
    const layer = worldData[layerIndex];
    
    // Check that there's enough space on opposite sides for team spawns
    // For overworld: check left and right sides
    // For caves: check if there are separate accessible areas
    
    if (startingZ === 0) {
      // Check left side (25% of map width) has walkable tiles
      const leftSideWalkable = this.countWalkableInArea(layer, mapSize, 0, 0, Math.floor(mapSize * 0.25), mapSize, startingZ);
      const rightSideWalkable = this.countWalkableInArea(layer, mapSize, Math.floor(mapSize * 0.75), 0, mapSize, mapSize, startingZ);
      
      const minSideWalkable = mapSize * mapSize * 0.05; // At least 5% of total map area per side
      
      if (leftSideWalkable < minSideWalkable || rightSideWalkable < minSideWalkable) {
        return { valid: false, reason: 'insufficient_spawn_area' };
      }
    } else {
      // For caves, check if there are at least 2 separate areas (simplified check)
      // In practice, post-processing will ensure proper spawn areas
      // Just ensure there are enough cave entrances/areas
      const walkableCount = this.countWalkableTiles(layer, mapSize, startingZ);
      if (walkableCount < mapSize * mapSize * 0.2) {
        return { valid: false, reason: 'insufficient_cave_area' };
      }
    }

    return { valid: true, reason: 'valid' };
  }

  /**
   * Validate map for Assault mode
   */
  validateAssault(worldData, mapSize, startingZ, mapType) {
    // Similar to skirmish, but also need to check for suitable defensive positions
    const skirmishCheck = this.validateSkirmish(worldData, mapSize, startingZ, mapType);
    if (!skirmishCheck.valid) {
      return skirmishCheck;
    }

    const layerIndex = startingZ === 0 ? 0 : 1;
    const layer = worldData[layerIndex];
    
    // For Assault, we need a suitable area for defenders (right side, ~30% of map)
    // This will be post-processed into a stronghold, but basic area should exist
    if (startingZ === 0) {
      const defensiveAreaWalkable = this.countWalkableInArea(layer, mapSize, Math.floor(mapSize * 0.7), 0, mapSize, mapSize, startingZ);
      const minDefensiveWalkable = mapSize * mapSize * 0.08; // At least 8% of total map
      
      if (defensiveAreaWalkable < minDefensiveWalkable) {
        return { valid: false, reason: 'insufficient_defensive_area' };
      }
    }

    // For dungeon maps, need accessible dungeon areas for capture point
    if (mapType === 'dungeons' && startingZ === -1) {
      const dungeonWalkable = this.countWalkableTiles(layer, mapSize, startingZ);
      if (dungeonWalkable < mapSize * mapSize * 0.15) {
        return { valid: false, reason: 'insufficient_dungeon_area' };
      }
    }

    return { valid: true, reason: 'valid' };
  }

  /**
   * Count walkable tiles in a specific area
   */
  countWalkableInArea(layer, mapSize, startX, startY, endX, endY, startingZ) {
    let count = 0;
    for (let y = startY; y < endY && y < mapSize; y++) {
      if (!layer[y]) continue;
      for (let x = startX; x < endX && x < mapSize; x++) {
        const tile = layer[y][x];
        if (this.isWalkable(tile, startingZ)) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Count total walkable tiles
   */
  countWalkableTiles(layer, mapSize, startingZ) {
    return this.countWalkableInArea(layer, mapSize, 0, 0, mapSize, mapSize, startingZ);
  }

  /**
   * Check if a tile is walkable
   */
  isWalkable(tile, startingZ) {
    if (startingZ === 0) {
      // Overworld: not water, not mountain
      return tile !== this.TERRAIN.WATER && tile !== this.TERRAIN.MOUNTAIN && tile < 6;
    } else if (startingZ === -1) {
      // Caves: floor (0) or exit (2)
      return tile === 0 || tile === 2;
    }
    return false;
  }

  /**
   * Check basic connectivity (simplified flood fill check)
   * This ensures the map isn't too fragmented
   */
  checkConnectivity(layer, mapSize, startingZ) {
    // Find first walkable tile
    let startX = -1, startY = -1;
    for (let y = 0; y < mapSize && startX === -1; y++) {
      if (!layer[y]) continue;
      for (let x = 0; x < mapSize; x++) {
        if (this.isWalkable(layer[y][x], startingZ)) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1 || startY === -1) {
      return { valid: false, reason: 'no_walkable_tiles' };
    }

    // Simple flood fill to count connected walkable area
    const visited = new Set();
    const queue = [[startX, startY]];
    visited.add(`${startX},${startY}`);
    let connectedCount = 0;

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      connectedCount++;

      // Check 4 adjacent tiles
      const neighbors = [
        [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= mapSize || ny < 0 || ny >= mapSize) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        
        if (layer[ny] && this.isWalkable(layer[ny][nx], startingZ)) {
          visited.add(key);
          queue.push([nx, ny]);
        }
      }
    }

    // At least 50% of walkable tiles should be connected
    const totalWalkable = this.countWalkableTiles(layer, mapSize, startingZ);
    if (totalWalkable === 0) {
      return { valid: false, reason: 'no_walkable_tiles' };
    }

    const connectivityRatio = connectedCount / totalWalkable;
    if (connectivityRatio < 0.5) {
      return { valid: false, reason: 'poor_connectivity' };
    }

    return { valid: true };
  }
}

module.exports = BattlegroundsMapValidator;



