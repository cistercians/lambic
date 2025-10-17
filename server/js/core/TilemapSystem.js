// Consolidated Tilemap System
// Replaces multiple 2D arrays with a single efficient data structure

class TilemapSystem {
  constructor(mapSize) {
    this.mapSize = mapSize;
    this.tiles = new Map(); // Use Map for sparse storage
    this.pathfindingCache = new Map(); // Cache pathfinding grids
    this.zones = new Map(); // Spatial partitioning
    this.spawnPoints = {
      overworld: [],
      underworld: [],
      water: [],
      heavyForest: [],
      mountains: [],
      caveEntrances: []
    };
    
    // Initialize zones
    this.initializeZones();
  }

  // Initialize spatial partitioning zones
  initializeZones() {
    const zoneSize = Math.ceil(this.mapSize / 64);
    for (let x = 0; x < 64; x++) {
      for (let y = 0; y < 64; y++) {
        this.zones.set(`${x},${y}`, new Set());
      }
    }
  }

  // Get tile key for Map storage
  getTileKey(layer, x, y) {
    return `${layer},${x},${y}`;
  }

  // Set tile data
  setTile(layer, x, y, data) {
    const key = this.getTileKey(layer, x, y);
    this.tiles.set(key, data);
    
    // Update zones if this is an entity layer
    if (layer === 0) { // Overworld layer
      this.updateZone(x, y, data);
    }
    
    // Invalidate pathfinding cache for this layer
    this.invalidatePathfindingCache(layer);
  }

  // Get tile data
  getTile(layer, x, y) {
    const key = this.getTileKey(layer, x, y);
    return this.tiles.get(key) || 0;
  }

  // Update tile with increment
  updateTile(layer, x, y, value, increment = false) {
    const current = this.getTile(layer, x, y);
    const newValue = increment ? current + value : value;
    this.setTile(layer, x, y, newValue);
    return newValue;
  }

  // Update spatial partitioning zones
  updateZone(x, y, tileData) {
    const zoneX = Math.floor(x / 8);
    const zoneY = Math.floor(y / 8);
    const zoneKey = `${zoneX},${zoneY}`;
    
    if (this.zones.has(zoneKey)) {
      this.zones.get(zoneKey).add(`${x},${y}`);
    }
  }

  // Get entities in a zone
  getEntitiesInZone(zoneX, zoneY) {
    const zoneKey = `${zoneX},${zoneY}`;
    return this.zones.get(zoneKey) || new Set();
  }

  // Generate pathfinding grid for a specific layer
  generatePathfindingGrid(layer, options = {}) {
    const cacheKey = `${layer}_${JSON.stringify(options)}`;
    
    if (this.pathfindingCache.has(cacheKey)) {
      return this.pathfindingCache.get(cacheKey);
    }

    const grid = [];
    for (let y = 0; y < this.mapSize; y++) {
      grid[y] = [];
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.getTile(layer, x, y);
        let walkable = this.isWalkable(layer, x, y, tile);
        
        // Apply pathfinding options
        if (options.avoidDoors && this.isDoorway(layer, x, y, tile)) {
          walkable = false;
        } else if (options.avoidCaveExits && this.isCaveExit(layer, x, y)) {
          walkable = false;
        } else if (options.allowSpecificDoor && options.targetDoor) {
          const [targetX, targetY] = options.targetDoor;
          if ((this.isDoorway(layer, x, y, tile) || this.isCaveExit(layer, x, y)) && !(x === targetX && y === targetY)) {
            walkable = false;
          }
        }
        
        grid[y][x] = walkable ? 1 : 0;
      }
    }

    this.pathfindingCache.set(cacheKey, grid);
    return grid;
  }

  // Check if a tile is walkable
  isWalkable(layer, x, y, tile) {
    switch (layer) {
      case 0: // Overworld
        return tile === 0; // Only water (0) is walkable
      case 1: // Underworld
        return tile === 1; // Only cave floor (1) is walkable
      case -1: // Underwater
        return false; // Not walkable
      default:
        return true; // Building layers are generally walkable
    }
  }

  // Check if a tile is a doorway
  isDoorway(layer, x, y, tile) {
    return layer === 0 && (tile === 14 || tile === 16); // DOOR_OPEN or DOOR_OPEN_ALT
  }

  // Check if a tile is a cave exit (to avoid in cave pathfinding)
  isCaveExit(layer, x, y) {
    if (layer !== -1) return false; // Only applies to cave layer
    
    // Check if this coordinate matches any cave entrance
    if (global.caveEntrances) {
      for (let i = 0; i < global.caveEntrances.length; i++) {
        const entrance = global.caveEntrances[i];
        if (entrance[0] === x && entrance[1] === y) {
          return true;
        }
      }
    }
    return false;
  }

  // Invalidate pathfinding cache
  invalidatePathfindingCache(layer = null) {
    if (layer === null) {
      this.pathfindingCache.clear();
    } else {
      // Remove cache entries for specific layer
      for (const key of this.pathfindingCache.keys()) {
        if (key.startsWith(`${layer}_`)) {
          this.pathfindingCache.delete(key);
        }
      }
    }
  }

  // Get spawn points for a specific biome
  getSpawnPoints(biome) {
    return this.spawnPoints[biome] || [];
  }

  // Add spawn point
  addSpawnPoint(biome, x, y) {
    if (this.spawnPoints[biome]) {
      this.spawnPoints[biome].push([x, y]);
    }
  }

  // Get all tiles in a rectangular area
  getTilesInArea(layer, startX, startY, endX, endY) {
    const tiles = [];
    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        tiles.push({
          x, y,
          tile: this.getTile(layer, x, y)
        });
      }
    }
    return tiles;
  }

  // Get tile statistics for a layer
  getLayerStats(layer) {
    const stats = {};
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.getTile(layer, x, y);
        stats[tile] = (stats[tile] || 0) + 1;
      }
    }
    return stats;
  }

  // Export data for serialization
  exportData() {
    return {
      mapSize: this.mapSize,
      tiles: Array.from(this.tiles.entries()),
      spawnPoints: this.spawnPoints
    };
  }

  // Import data from serialization
  importData(data) {
    this.mapSize = data.mapSize;
    this.tiles = new Map(data.tiles);
    this.spawnPoints = data.spawnPoints;
    this.invalidatePathfindingCache();
  }

  // Get memory usage estimate
  getMemoryUsage() {
    return {
      tiles: this.tiles.size,
      pathfindingCache: this.pathfindingCache.size,
      zones: this.zones.size,
      estimatedMB: (this.tiles.size * 8 + this.pathfindingCache.size * 4) / 1024 / 1024
    };
  }

  // Reconstruct world array from tilemap (for sending to clients)
  getWorldArray() {
    const worldArray = [];
    for (let layer = 0; layer < 9; layer++) {
      worldArray[layer] = [];
      for (let y = 0; y < this.mapSize; y++) {
        worldArray[layer][y] = [];
        for (let x = 0; x < this.mapSize; x++) {
          worldArray[layer][y][x] = this.getTile(layer, x, y);
        }
      }
    }
    return worldArray;
  }
}

module.exports = { TilemapSystem };

