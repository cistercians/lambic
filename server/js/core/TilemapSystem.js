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
    
    // Grid versioning for cache invalidation
    this.gridVersions = new Map(); // layer -> version number
    this.currentVersion = 0;
    
    // Pre-generated grids for common layers
    this.pregeneratedGrids = {
      enabled: true,
      layers: [0, 1] // Overworld and cave by default
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
    const oldData = this.tiles.get(key);
    
    // Only invalidate cache if tile actually changed
    if (oldData !== data) {
      this.tiles.set(key, data);
      
      // Update zones if this is an entity layer
      if (layer === 0) { // Overworld layer
        this.updateZone(x, y, data);
      }
      
      // Increment grid version for this layer
      this.gridVersions.set(layer, (this.gridVersions.get(layer) || 0) + 1);
      
      // Invalidate pathfinding cache for this layer
      this.invalidatePathfindingCache(layer);
    }
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

  // Generate optimized cache key (avoid JSON.stringify)
  generateGridCacheKey(layer, options = {}) {
    let key = `${layer}`;
    
    // CRITICAL FIX: Check if options is truly empty (no pathfinding options)
    // Most pathfinding calls use empty options, so this should hit cache frequently
    const hasOptions = options && Object.keys(options).length > 0;
    
    if (!hasOptions) {
      // No options = base grid for this layer
      const version = this.gridVersions.get(layer) || 0;
      return `${layer}_base_v${version}`;
    }
    
    // Add options in deterministic order
    if (options.waterOnly) key += '_water';
    if (options.avoidDoors) key += '_nodoors';
    if (options.avoidCaveExits) key += '_noexits';
    if (options.allowSpecificDoor) key += '_spdoor';
    if (options.allowStartTile) {
      key += `_start${options.allowStartTile[0]},${options.allowStartTile[1]}`;
    }
    if (options.targetDoor) {
      key += `_target${options.targetDoor[0]},${options.targetDoor[1]}`;
    }
    
    // Add grid version to ensure cache is invalidated when tiles change
    const version = this.gridVersions.get(layer) || 0;
    key += `_v${version}`;
    
    return key;
  }
  
  // Generate pathfinding grid for a specific layer (OPTIMIZED)
  generatePathfindingGrid(layer, options = {}) {
    const cacheKey = this.generateGridCacheKey(layer, options);
    
    // Check cache with version validation
    if (this.pathfindingCache.has(cacheKey)) {
      return this.pathfindingCache.get(cacheKey);
    }

    const grid = [];
    for (let y = 0; y < this.mapSize; y++) {
      grid[y] = [];
      for (let x = 0; x < this.mapSize; x++) {
        const tile = this.getTile(layer, x, y);
        let walkable = this.isWalkable(layer, x, y, tile);
        
        // Apply pathfinding options (order matters - most specific first)
        
        // FIRST: Water-only navigation for ships (inverted logic)
        if (options.waterOnly) {
          walkable = (tile === 0); // Only water tiles (0) are walkable for ships
        }
        // SECOND: Check if this is an explicitly allowed tile (highest priority)
        else if (options.allowStartTile && options.allowStartTile[0] === x && options.allowStartTile[1] === y) {
          walkable = true;
        }
        else if (options.targetDoor && options.targetDoor[0] === x && options.targetDoor[1] === y) {
          walkable = true;
        }
        // THIRD: Apply avoidance rules
        else if (options.avoidDoors && this.isDoorway(layer, x, y, tile)) {
          walkable = false;
        } else if (options.avoidCaveExits && this.isCaveExit(layer, x, y)) {
          walkable = false;
        }
        // FOURTH: Block all doors/exits except specific targets  
        else if (options.allowSpecificDoor && (this.isDoorway(layer, x, y, tile) || this.isCaveExit(layer, x, y))) {
          walkable = false;
        }
        
        grid[y][x] = walkable ? 0 : 1;  // PF.Grid uses 0=walkable, 1=blocked
      }
    }

    this.pathfindingCache.set(cacheKey, grid);
    
    // Limit cache size - remove oldest entries if too large
    if (this.pathfindingCache.size > 50) {
      const firstKey = this.pathfindingCache.keys().next().value;
      this.pathfindingCache.delete(firstKey);
    }
    
    return grid;
  }
  
  // Pre-generate common grids to reduce first-request latency
  pregenerateCommonGrids() {
    if (!this.pregeneratedGrids.enabled) return;
    
    const startTime = Date.now();
    
    for (const layer of this.pregeneratedGrids.layers) {
      // Generate base grids (no special options)
      this.generatePathfindingGrid(layer, {});
      
      // Generate with common options
      if (layer === 0) { // Overworld
        this.generatePathfindingGrid(layer, { avoidDoors: true });
      }
      if (layer === 1) { // Cave
        this.generatePathfindingGrid(layer, { avoidCaveExits: true });
      }
    }
    
    const elapsed = Date.now() - startTime;
  }

  // Check if a tile is walkable
  isWalkable(layer, x, y, tile) {
    // Tiles are walkable when their matrix value is 0 (not blocked)
    // Map layer to z-level for matrix lookup
    const layerToZ = {
      0: 0,    // Overworld
      1: -1,   // Underworld/Cave
      2: -3,   // Underwater
      3: 1,    // Building floor 1 (but use matrix lookup)
      4: 1,    // Building floor 1 tiles
      5: 1,    // Building floor 1 special
      6: 0,    // Resource layer 1 (overworld resources)
      7: -1,   // Resource layer 2 (cave resources)
      8: -2    // Cellar/Building basement
    };
    
    const z = layerToZ[layer];
    
    // Use the global matrix-based walkability check
    if (typeof global.isWalkable === 'function' && z !== undefined) {
      return global.isWalkable(z, x, y);
    }
    
    // Fallback: return false if we can't determine walkability
    return false;
  }

  // Check if a tile is a doorway
  isDoorway(layer, x, y, tile) {
    return layer === 0 && (tile === 14 || tile === 16); // DOOR_OPEN or DOOR_OPEN_ALT
  }

  // Check if a tile is a cave exit (to avoid in cave pathfinding)
  isCaveExit(layer, x, y) {
    if (layer !== 1) return false; // Only applies to cave layer (worldMaps[1])
    
    // Check if this coordinate matches any cave entrance
    // Note: Cave exits on layer 1 are at entrance[0], entrance[1]+1 (one tile south of overworld entrance)
    if (global.caveEntrances) {
      for (let i = 0; i < global.caveEntrances.length; i++) {
        const entrance = global.caveEntrances[i];
        if (entrance[0] === x && entrance[1] + 1 === y) {
          return true;
        }
      }
    }
    return false;
  }

  // Invalidate pathfinding cache (OPTIMIZED with versioning)
  invalidatePathfindingCache(layer = null) {
    if (layer === null) {
      // Clear all caches and reset versions
      this.pathfindingCache.clear();
      this.gridVersions.clear();
      this.currentVersion++;
    } else {
      // Increment version for this layer (cache keys include version)
      // No need to manually delete - version mismatch will cause cache miss
      this.gridVersions.set(layer, (this.gridVersions.get(layer) || 0) + 1);
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

  // ============================================================================
  // BUILDING PLACEMENT SYSTEM
  // ============================================================================

  // Building placement requirements by type
  getBuildingRequirements() {
    const TERRAIN = {
      WATER: 0, HEAVY_FOREST: 1, LIGHT_FOREST: 2, BRUSH: 3,
      ROCKS: 4, MOUNTAIN: 5, CAVE_ENTRANCE: 6, GRASS: 7, FARM_SEED: 8, FARM_PLANTED: 9,
      FARM_GROW: 10, ROAD: 18
    };
    
    return {
      hut: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.HEAVY_FOREST, TERRAIN.BRUSH],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      gothhut: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST, TERRAIN.HEAVY_FOREST, TERRAIN.ROCKS], // Goths can build on rocks
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      frankhut: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH], // Franks prefer open terrain
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      celthut: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.HEAVY_FOREST, TERRAIN.BRUSH], // Celts can build in heavy forest
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      teuthut: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH, TERRAIN.ROCKS], // Teutons can build on rocks
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      mill: {
        plotSize: [2, 2],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: true,
        preferOpenGrass: true // Prefer wide open grass areas for farm placement
      },
      lumbermill: {
        plotSize: [2, 1],
        wallTiles: 2,
        validTerrain: [TERRAIN.GRASS, TERRAIN.HEAVY_FOREST, TERRAIN.LIGHT_FOREST],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: true,
        nearForest: true
      },
      mine: {
        plotSize: [2, 2],
        wallTiles: 0,
        validTerrain: [TERRAIN.ROCKS, TERRAIN.MOUNTAIN],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      farm: {
        plotSize: [3, 3],
        wallTiles: 0,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
        clearanceRadius: 0,
        excludeBuildings: true,
        hasUpperFloor: false,
        requiresNearby: { buildingType: 'mill', maxDistance: 384 }
      },
      market: {
        plotSize: [4, 3],
        wallTiles: 5,
        validTerrain: [TERRAIN.GRASS, TERRAIN.EMPTY, TERRAIN.ROAD],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: false
      },
      forge: {
        plotSize: [3, 2],
        wallTiles: 3,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: true
      },
      garrison: {
        plotSize: [4, 3],
        wallTiles: 4,
        validTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
        clearanceRadius: 1,
        excludeBuildings: true,
        hasUpperFloor: true
      }
    };
  }

  // Find valid building spot
  findBuildingSpot(buildingType, centerTile, searchRadius, customRequirements = {}) {
    const requirements = this.getBuildingRequirements();
    const baseReqs = requirements[buildingType];
    
    if (!baseReqs) {
      return null;
    }
    
    // Merge custom requirements
    const reqs = { ...baseReqs, ...customRequirements };
    
    // Generate search area
    const searchArea = global.getArea(centerTile, centerTile, searchRadius);
    const validSpots = [];
    
    // For each potential spot in search area
    for (const tile of searchArea) {
      if (this.canPlaceBuilding(tile, reqs, buildingType)) {
        const plot = this.generatePlot(tile, reqs.plotSize);
        const walls = reqs.wallTiles > 0 ? this.generateWalls(plot, reqs.wallTiles) : [];
        const topPlot = reqs.hasUpperFloor && walls.length > 0 ? this.generateTopPlot(plot, walls) : [];
        
        validSpots.push({
          tile: tile,
          plot: plot,
          walls: walls,
          topPlot: topPlot,
          score: this.scoreBuildingSpot(tile, reqs, buildingType)
        });
      }
    }
    
    // Sort by score (higher is better)
    validSpots.sort((a, b) => b.score - a.score);
    
    return validSpots.length > 0 ? validSpots[0] : null;
  }

  // Find multiple building spots (e.g., multiple farms around a mill)
  findMultipleBuildingSpots(buildingType, centerTile, searchRadius, count, customRequirements = {}) {
    const requirements = this.getBuildingRequirements();
    const baseReqs = requirements[buildingType];
    
    if (!baseReqs) {
      return [];
    }
    
    const reqs = { ...baseReqs, ...customRequirements };
    const searchArea = global.getArea(centerTile, centerTile, searchRadius);
    const validSpots = [];
    const occupiedTiles = new Set(reqs.excludeTiles || []);
    
    for (const tile of searchArea) {
      // Skip if tile is in occupied set
      const tileKey = `${tile[0]},${tile[1]}`;
      if (occupiedTiles.has(tileKey)) continue;
      
      if (this.canPlaceBuilding(tile, { ...reqs, excludeTiles: Array.from(occupiedTiles) }, buildingType)) {
        const plot = this.generatePlot(tile, reqs.plotSize);
        const walls = reqs.wallTiles > 0 ? this.generateWalls(plot, reqs.wallTiles) : [];
        
        validSpots.push({
          tile: tile,
          plot: plot,
          walls: walls,
          score: this.scoreBuildingSpot(tile, reqs, buildingType)
        });
        
        // Mark this plot as occupied for subsequent searches
        plot.forEach(p => occupiedTiles.add(`${p[0]},${p[1]}`));
        
        if (validSpots.length >= count) break;
      }
    }
    
    validSpots.sort((a, b) => b.score - a.score);
    return validSpots.slice(0, count);
  }

  // Check if building can be placed at location
  canPlaceBuilding(tile, requirements, buildingType) {
    const plot = this.generatePlot(tile, requirements.plotSize);
    const perimeter = requirements.clearanceRadius > 0 ? 
      this.generatePerimeter(plot, requirements.clearanceRadius) : [];
    
    // Check if plot is within map bounds
    for (const plotTile of plot) {
      if (plotTile[0] < 0 || plotTile[0] >= this.mapSize ||
          plotTile[1] < 0 || plotTile[1] >= this.mapSize) {
        return false;
      }
    }
    
    // Check plot tiles are valid terrain AND walkable
    for (const plotTile of plot) {
      const terrain = this.getTile(0, plotTile[0], plotTile[1]);
      const terrainFloor = Math.floor(terrain);
      if (!requirements.validTerrain.includes(terrainFloor)) {
        return false;
      }
      
      // Check if tile is walkable (catches firepits, buildings, blocking objects)
      if (!global.isWalkable(0, plotTile[0], plotTile[1])) {
        return false;
      }
    }
    
    // Check for building overlaps
    if (requirements.excludeBuildings) {
      for (const checkTile of [...plot, ...perimeter]) {
        // Check layer 3 (building ground markers) and layer 5 (upper floors)
        const layer3 = this.getTile(3, checkTile[0], checkTile[1]);
        const layer5 = this.getTile(5, checkTile[0], checkTile[1]);
        
        if (layer3 !== 0 || layer5 !== 0) {
          return false;
        }
        
        // Check if tile is in excludeTiles list
        if (requirements.excludeTiles) {
          const tileKey = `${checkTile[0]},${checkTile[1]}`;
          if (requirements.excludeTiles.includes(tileKey) || 
              requirements.excludeTiles.some(t => t[0] === checkTile[0] && t[1] === checkTile[1])) {
            return false;
          }
        }
        
        // Check for items/objects at this location (like InfiniteFire)
        const tileCenter = global.getCenter(checkTile[0], checkTile[1]);
        for (const itemId in global.Item.list) {
          const item = global.Item.list[itemId];
          if (item && item.z === 0) { // Only check ground level items
            const dist = Math.sqrt(
              Math.pow(item.x - tileCenter[0], 2) + 
              Math.pow(item.y - tileCenter[1], 2)
            );
            // If item is within half a tile of this location, block placement
            if (dist < global.tileSize / 2) {
              return false;
            }
          }
        }
      }
      
      // Check clearance area for building tiles
      for (const perimTile of perimeter) {
        const terrain = this.getTile(0, perimTile[0], perimTile[1]);
        // Perimeter cannot have building tiles (11-20.5)
        if (terrain >= 11 && terrain <= 20.5) {
          return false;
        }
      }
    }
    
    // Check if building requires nearby structures (e.g., farms near mills)
    if (requirements.requiresNearby) {
      const { buildingType: requiredType, maxDistance } = requirements.requiresNearby;
      let foundNearby = false;
      
      for (const buildingId in global.Building.list) {
        const building = global.Building.list[buildingId];
        if (building.type === requiredType || building.type.indexOf(requiredType) >= 0) {
          const buildingCenter = global.getCenter(building.plot[0][0], building.plot[0][1]);
          const tileCenter = global.getCenter(tile[0], tile[1]);
          const dist = global.getDistance(
            { x: buildingCenter[0], y: buildingCenter[1] },
            { x: tileCenter[0], y: tileCenter[1] }
          );
          
          if (dist <= maxDistance) {
            foundNearby = true;
            break;
          }
        }
      }
      
      if (!foundNearby) return false;
    }
    
    return true;
  }

  // Generate plot tiles for building
  generatePlot(centerTile, size) {
    const [width, height] = size;
    const plot = [];
    const c = centerTile[0];
    const r = centerTile[1];
    
    // Generate rectangular plot
    // Pattern: BOTTOM row first (r), then top rows (r-1, r-2, etc.)
    // This matches player build commands where plot[0-2] is bottom row for 3x2 forge
    // Tiles named forge0, forge1, etc. depend on this exact order for visual rendering
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        plot.push([c + col, r - row]);
      }
    }
    
    return plot;
  }

  // Generate wall tiles for building
  generateWalls(plot, wallCount) {
    if (wallCount === 0 || plot.length === 0) return [];
    
    // For 2x1 buildings (lumbermill) with 2 walls, place one row above
    if (plot.length === 2 && wallCount === 2) {
      return [
        [plot[0][0], plot[0][1] - 1], // Above plot[0]
        [plot[1][0], plot[1][1] - 1]  // Above plot[1]
      ];
    }
    
    // For 2x2 buildings with 2 walls, use top row
    if (plot.length === 4 && wallCount === 2) {
      return [
        [plot[2][0], plot[2][1] - 1], // Above plot[2]
        [plot[3][0], plot[3][1] - 1]  // Above plot[3]
      ];
    }
    
    // For market (4x3 with 5 walls), use back wall
    if (wallCount === 5) {
      const topRow = plot.filter(p => p[1] === Math.min(...plot.map(t => t[1])));
      const maxCol = Math.max(...plot.map(t => t[0]));
      return [
        [topRow[0][0], topRow[0][1] - 1],
        [topRow[1][0], topRow[1][1] - 1],
        [topRow[2][0], topRow[2][1] - 1],
        [topRow[3][0], topRow[3][1] - 1],
        [maxCol + 1, topRow[0][1] - 1]
      ];
    }
    
    // Default: walls are one row ABOVE the top row of the plot
    // For forge 3x2: top plot row is at r-1, walls should be at r-2
    // For garrison 4x3: top plot row is at r-2, walls should be at r-3
    const minRow = Math.min(...plot.map(t => t[1])); // Find top row Y-coordinate
    const topRowTiles = plot.filter(p => p[1] === minRow); // Get tiles in top row
    
    // Generate walls one row above the top plot row
    const walls = [];
    for (let i = 0; i < Math.min(wallCount, topRowTiles.length); i++) {
      walls.push([topRowTiles[i][0], topRowTiles[i][1] - 1]);
    }
    
    return walls;
  }

  // Generate top plot tiles for upper floor
  generateTopPlot(plot, walls) {
    if (walls.length === 0) return [];
    
    // For mills/lumbermills (2 walls): top plot is wall tiles
    if (walls.length === 2) {
      return walls;
    }
    
    // For garrison (4 walls): topPlot is walls[1,2,3] (skipping first wall)
    // Player command: topPlot = [[c+1,r-3],[c+2,r-3],[c+3,r-3]]
    // Which is the same Y-coordinate as walls, just excluding the first wall tile
    if (walls.length === 4) {
      return [
        walls[1],
        walls[2],
        walls[3]
      ];
    }
    
    return [];
  }

  // Generate perimeter tiles around plot
  generatePerimeter(plot, radius) {
    if (radius === 0 || plot.length === 0) return [];
    
    const minCol = Math.min(...plot.map(t => t[0]));
    const maxCol = Math.max(...plot.map(t => t[0]));
    const minRow = Math.min(...plot.map(t => t[1]));
    const maxRow = Math.max(...plot.map(t => t[1]));
    
    const perimeter = [];
    
    // Generate perimeter tiles at specified radius
    for (let col = minCol - radius; col <= maxCol + radius; col++) {
      for (let row = minRow - radius; row <= maxRow + radius; row++) {
        // Skip if inside plot
        const isInPlot = plot.some(p => p[0] === col && p[1] === row);
        if (isInPlot) continue;
        
        // Check if on perimeter edge
        const onEdge = (col === minCol - radius || col === maxCol + radius ||
                       row === minRow - radius || row === maxRow + radius);
        
        if (onEdge || radius === 1) {
          perimeter.push([col, row]);
        }
      }
    }
    
    return perimeter;
  }

  // Score building spot (higher is better)
  scoreBuildingSpot(tile, requirements, buildingType) {
    let score = 100; // Base score
    
    const tileCenter = global.getCenter(tile[0], tile[1]);
    
    // Terrain preference for huts (prefer grass/light forest over brush)
    if (buildingType && (buildingType.includes('hut') || buildingType === 'cottage')) {
      const plotTerrain = this.getTile(0, tile[0], tile[1]);
      if (plotTerrain === 7) { // GRASS
        score += 20;
      } else if (plotTerrain === 2) { // LIGHT_FOREST
        score += 10;
      } else if (plotTerrain === 3) { // BRUSH
        score += 0; // Neutral - only use if no better option
      }
    }
    
    // Bonus for wide open grass areas (mills)
    if (requirements.preferOpenGrass) {
      let grassCount = 0;
      const searchArea = global.getArea(tile, tile, 5); // Check 5-tile radius for open space
      for (const t of searchArea) {
        const terrain = this.getTile(0, t[0], t[1]);
        if (terrain === 7) { // GRASS
          grassCount++;
        }
      }
      // More grass = better location for farms
      score += grassCount * 2;
    }
    
    // Bonus for being near forest (lumbermills)
    if (requirements.nearForest) {
      let forestCount = 0;
      const searchArea = global.getArea(tile, tile, 2);
      for (const t of searchArea) {
        const terrain = this.getTile(0, t[0], t[1]);
        if (terrain === 1 || terrain === 2) { // HEAVY_FOREST or LIGHT_FOREST
          forestCount++;
        }
      }
      score += forestCount * 2;
    }
    
    // Bonus for proximity to required buildings (e.g., farms near mills)
    if (requirements.requiresNearby) {
      const { buildingType: requiredType, maxDistance } = requirements.requiresNearby;
      let closestDist = Infinity;
      
      for (const buildingId in global.Building.list) {
        const building = global.Building.list[buildingId];
        if (building.type === requiredType || building.type.indexOf(requiredType) >= 0) {
          const buildingCenter = global.getCenter(building.plot[0][0], building.plot[0][1]);
          const dist = global.getDistance(
            { x: buildingCenter[0], y: buildingCenter[1] },
            { x: tileCenter[0], y: tileCenter[1] }
          );
          closestDist = Math.min(closestDist, dist);
        }
      }
      
      if (closestDist < Infinity) {
        // Prefer closer to required building (within maxDistance)
        score += Math.max(0, 100 - (closestDist / maxDistance) * 100);
      }
    }
    
    // Small random variation to prevent all buildings clustering identically
    score += Math.random() * 10;
    
    return score;
  }

  // ============================================================================
  // FACTION HQ PLACEMENT SYSTEM
  // ============================================================================

  // Faction HQ requirements by faction name
  getFactionHQRequirements() {
    const TERRAIN = {
      WATER: 0, HEAVY_FOREST: 1, LIGHT_FOREST: 2, BRUSH: 3,
      ROCKS: 4, MOUNTAIN: 5, CAVE_ENTRANCE: 6, GRASS: 7
    };
    
    return {
      brotherhood: {
        requiredTerrain: [0], // Cave floor only
        searchLayer: 1, // Underworld (z=-1)
        minTerrainPercentage: 0.9,
        searchRadius: 20,
        evaluationRadius: 12,
        areaSize: 4,
        priorities: {
          uniformCaveTerrain: 50,
          isolation: 30,
          safetyFromWater: 20
        }
      },
      
      goths: {
        requiredTerrain: [TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH, TERRAIN.GRASS],
        searchLayer: 0,
        minTerrainPercentage: 0.65,
        searchRadius: 30,
        evaluationRadius: 25,
        areaSize: 5,
        priorities: {
          farmingPotential: 40,
          mixedResources: 25,
          buildingSpace: 20,
          marketLocation: 15
        },
        economicBuildings: ['mill', 'mill', 'farm', 'farm', 'market']
      },
      
      franks: {
        requiredTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
        searchLayer: 0,
        minTerrainPercentage: 0.60, // More flexible - can clear light forest/brush
        searchRadius: 30,
        evaluationRadius: 30,
        areaSize: 5,
        priorities: {
          maximumGrassland: 60, // Still prioritize grass
          farmDensityPotential: 30,
          millPlacement: 10
        },
        economicBuildings: ['mill', 'mill', 'farm', 'farm', 'farm']
      },
      
      celts: {
        requiredTerrain: [TERRAIN.HEAVY_FOREST, TERRAIN.LIGHT_FOREST],
        searchLayer: 0,
        minTerrainPercentage: 0.50, // Forest dwellers but willing to be near forest
        searchRadius: 30,
        evaluationRadius: 20,
        areaSize: 5,
        priorities: {
          denseForest: 30,
          caveProximity: 50, // Critical for mining
          rockAccess: 10,
          forestIsolation: 10
        },
        requiresNearby: {
          feature: 'caveEntrance',
          maxDistance: 1536 // Increased to ~24 tiles (long walk but workable for mining)
        },
        economicBuildings: ['mine', 'mine']
      },
      
      teutons: {
        requiredTerrain: [TERRAIN.ROCKS, TERRAIN.MOUNTAIN],
        searchLayer: 0,
        minTerrainPercentage: 0.55,
        searchRadius: 30,
        evaluationRadius: 25,
        areaSize: 5,
        priorities: {
          miningPotential: 45,
          lumberAccess: 35,
          terrainDiversity: 20
        },
        requiresNearby: {
          feature: 'forest',
          maxDistance: 768
        },
        economicBuildings: ['mine', 'mine', 'lumbermill', 'lumbermill']
      },
      
      norsemen: {
        requiredTerrain: [TERRAIN.WATER, TERRAIN.GRASS],
        searchLayer: 0,
        minTerrainPercentage: 0.4,
        searchRadius: 30,
        evaluationRadius: 20,
        areaSize: 5,
        priorities: {
          waterAccess: 60,
          coastalMix: 30,
          defensibility: 10
        },
        requiresNearby: {
          feature: 'water',
          maxDistance: 192
        }
      },
      
      outlaws: {
        requiredTerrain: [TERRAIN.HEAVY_FOREST], // Heavy forest only
        searchLayer: 0,
        minTerrainPercentage: 0.55, // Forest bandits but more flexible
        searchRadius: 30,
        evaluationRadius: 15,
        areaSize: 5,
        priorities: {
          maximumConcealment: 70, // Still prioritize deep forest
          isolation: 25,
          ambushPosition: 5
        },
        economicBuildings: []
      },
      
      mercenaries: {
        requiredTerrain: [TERRAIN.EMPTY, TERRAIN.LIGHT_FOREST],
        searchLayer: 1,
        minTerrainPercentage: 0.70, // More flexible - mercenaries adapt
        searchRadius: 20,
        evaluationRadius: 15,
        areaSize: 4,
        priorities: {
          uniformCaveTerrain: 40,
          strategicPosition: 35,
          isolation: 25
        },
        requiresNearby: {
          feature: 'caveEntrance',
          maxDistance: 768 // Increased to ~12 tiles
        },
        economicBuildings: []
      }
    };
  }

  // Find optimal HQ location for a faction
  findFactionHQ(factionName, excludedLocations = []) {
    const requirements = this.getFactionHQRequirements()[factionName.toLowerCase()];
    if (!requirements) {
      return null;
    }
    
    const searchPoints = this.getSearchPointsForFaction(factionName, requirements);
    const validLocations = [];
    
    for (const point of searchPoints) {
      if (this.isTooCloseToExcluded(point, excludedLocations, 1536)) {
        continue; // Min 24 tiles between factions
      }
      
      const evaluation = this.evaluateHQLocation(point, requirements);
      
      if (evaluation.isValid) {
        validLocations.push({
          tile: point,
          score: evaluation.score,
          details: evaluation.details
        });
      }
    }
    
    validLocations.sort((a, b) => b.score - a.score);
    
    return validLocations.length > 0 ? validLocations[0] : null;
  }

  getSearchPointsForFaction(factionName, requirements) {
    const layer = requirements.searchLayer;
    
    if (layer === 1) {
      return this.spawnPoints.underworld;
    }
    
    // Special case: If faction requires a nearby feature, search from those points
    // This fixes Celts spawning far from caves
    if (requirements.requiresNearby && requirements.requiresNearby.feature) {
      const feature = requirements.requiresNearby.feature;
      
      if (feature === 'caveEntrance' && this.spawnPoints.caveEntrances) {
        return this.spawnPoints.caveEntrances;
      } else if (feature === 'forest' && this.spawnPoints.heavyForest) {
        return this.spawnPoints.heavyForest;
      }
    }
    
    // Default terrain-based search
    if (requirements.requiredTerrain.includes(2)) {
      return this.spawnPoints.heavyForest;
    } else if (requirements.requiredTerrain.includes(6)) {
      return this.spawnPoints.mountains;
    } else if (requirements.requiredTerrain.includes(1)) {
      return this.spawnPoints.water;
    } else {
      return this.spawnPoints.overworld;
    }
  }

  evaluateHQLocation(tile, requirements) {
    const layer = requirements.searchLayer;
    const checkRadius = Math.ceil(requirements.areaSize / 2);
    
    const immediateArea = global.getArea(tile, tile, checkRadius);
    let validTerrainCount = 0;
    
    for (const t of immediateArea) {
      const terrain = Math.floor(this.getTile(layer, t[0], t[1]));
      if (requirements.requiredTerrain.includes(terrain)) {
        validTerrainCount++;
      }
    }
    
    const terrainPercentage = validTerrainCount / immediateArea.length;
    
    if (terrainPercentage < requirements.minTerrainPercentage) {
      return { isValid: false, score: 0 };
    }
    
    if (requirements.requiresNearby) {
      if (!this.hasNearbyFeature(tile, requirements.requiresNearby, layer)) {
        return { isValid: false, score: 0 };
      }
    }
    
    const score = this.scoreHQLocation(tile, requirements);
    
    return {
      isValid: true,
      score: score,
      details: {
        terrainPercentage: terrainPercentage,
        tile: tile
      }
    };
  }

  scoreHQLocation(tile, requirements) {
    let score = 0;
    const evalRadius = requirements.evaluationRadius;
    const layer = requirements.searchLayer;
    const area = global.getArea(tile, tile, evalRadius);
    
    const terrainCounts = {};
    for (const t of area) {
      const terrain = Math.floor(this.getTile(layer, t[0], t[1]));
      terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
    }
    
    const priorities = requirements.priorities;
    
    // Maximum grassland (Franks)
    if (priorities.maximumGrassland) {
      const grassCount = terrainCounts[7] || 0;
      const grassPercentage = grassCount / area.length;
      score += priorities.maximumGrassland * grassPercentage * 100;
    }
    
    // Farm density potential (Franks)
    if (priorities.farmDensityPotential) {
      // Count all farmable terrain: grass, brush
      const farmableCount = (terrainCounts[7] || 0) + (terrainCounts[3] || 0);
      const farmablePercentage = farmableCount / area.length;
      score += priorities.farmDensityPotential * farmablePercentage * 100;
    }
    
    // Farming potential (Goths)
    if (priorities.farmingPotential) {
      const farmableCount = (terrainCounts[7] || 0) + (terrainCounts[3] || 0);
      const farmablePercentage = farmableCount / area.length;
      score += priorities.farmingPotential * farmablePercentage * 100;
    }
    
    // Dense forest (Celts, Outlaws)
    if (priorities.denseForest || priorities.maximumConcealment) {
      const forestCount = terrainCounts[2] || 0;
      const forestPercentage = forestCount / area.length;
      const priority = priorities.denseForest || priorities.maximumConcealment;
      score += priority * forestPercentage * 100;
    }
    
    // Mining potential (Teutons)
    if (priorities.miningPotential) {
      const miningCount = (terrainCounts[5] || 0) + (terrainCounts[6] || 0);
      const miningPercentage = miningCount / area.length;
      score += priorities.miningPotential * miningPercentage * 100;
    }
    
    // Lumber access (Teutons)
    if (priorities.lumberAccess) {
      const nearestForestDist = this.getNearestFeatureDistance(tile, 'forest', layer);
      if (nearestForestDist < Infinity) {
        const proximityScore = Math.max(0, 1 - (nearestForestDist / 768));
        score += priorities.lumberAccess * proximityScore * 100;
      }
    }
    
    // Cave proximity (Celts)
    if (priorities.caveProximity) {
      const nearestCaveDist = this.getNearestFeatureDistance(tile, 'caveEntrance', layer);
      if (nearestCaveDist < Infinity) {
        const proximityScore = Math.max(0, 1 - (nearestCaveDist / 768));
        score += priorities.caveProximity * proximityScore * 100;
      }
    }
    
    // Water access (Norsemen)
    if (priorities.waterAccess) {
      const waterCount = terrainCounts[1] || 0;
      const waterPercentage = waterCount / area.length;
      score += priorities.waterAccess * waterPercentage * 100;
    }
    
    // Uniform cave terrain (Brotherhood, Mercenaries)
    if (priorities.uniformCaveTerrain) {
      const caveFloorCount = terrainCounts[0] || 0;
      const uniformity = caveFloorCount / area.length;
      score += priorities.uniformCaveTerrain * uniformity * 100;
    }
    
    // Mixed resources (Goths)
    if (priorities.mixedResources) {
      const uniqueTerrains = Object.keys(terrainCounts).length;
      const varietyScore = Math.min(1, uniqueTerrains / 4);
      score += priorities.mixedResources * varietyScore * 100;
    }
    
    // Isolation (Outlaws, Brotherhood, Mercenaries)
    if (priorities.isolation) {
      score += priorities.isolation * 50; // Base score
    }
    
    // Building space (Goths)
    if (priorities.buildingSpace) {
      const buildableCount = (terrainCounts[7] || 0) + (terrainCounts[3] || 0) + (terrainCounts[0] || 0);
      const buildablePercentage = buildableCount / area.length;
      score += priorities.buildingSpace * buildablePercentage * 100;
    }
    
    score += Math.random() * 10; // Small random variation
    
    return score;
  }

  hasNearbyFeature(tile, requirement, layer) {
    const distance = this.getNearestFeatureDistance(tile, requirement.feature, layer);
    return distance <= requirement.maxDistance;
  }

  getNearestFeatureDistance(tile, featureType, layer) {
    const tileCenter = global.getCenter(tile[0], tile[1]);
    let nearestDistance = Infinity;
    
    if (featureType === 'caveEntrance') {
      const caveEntrances = global.caveEntrances || [];
      for (const cave of caveEntrances) {
        const caveCenter = global.getCenter(cave[0], cave[1]);
        const dist = global.getDistance(
          { x: tileCenter[0], y: tileCenter[1] },
          { x: caveCenter[0], y: caveCenter[1] }
        );
        nearestDistance = Math.min(nearestDistance, dist);
      }
    } else if (featureType === 'forest') {
      // Find nearest forest tile
      const searchRadius = 15;
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          const checkX = tile[0] + dx;
          const checkY = tile[1] + dy;
          if (checkX >= 0 && checkX < this.mapSize && checkY >= 0 && checkY < this.mapSize) {
            const terrain = Math.floor(this.getTile(layer, checkX, checkY));
            if (terrain === 1 || terrain === 2) { // Heavy or light forest
              const forestCenter = global.getCenter(checkX, checkY);
              const dist = global.getDistance(
                { x: tileCenter[0], y: tileCenter[1] },
                { x: forestCenter[0], y: forestCenter[1] }
              );
              nearestDistance = Math.min(nearestDistance, dist);
            }
          }
        }
      }
    } else if (featureType === 'water') {
      // Find nearest water tile
      const searchRadius = 10;
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
          const checkX = tile[0] + dx;
          const checkY = tile[1] + dy;
          if (checkX >= 0 && checkX < this.mapSize && checkY >= 0 && checkY < this.mapSize) {
            const terrain = Math.floor(this.getTile(layer, checkX, checkY));
            if (terrain === 0) { // Water
              const waterCenter = global.getCenter(checkX, checkY);
              const dist = global.getDistance(
                { x: tileCenter[0], y: tileCenter[1] },
                { x: waterCenter[0], y: waterCenter[1] }
              );
              nearestDistance = Math.min(nearestDistance, dist);
            }
          }
        }
      }
    }
    
    return nearestDistance;
  }

  isTooCloseToExcluded(tile, excludedLocations, minDistance) {
    const tileCenter = global.getCenter(tile[0], tile[1]);
    
    for (const excluded of excludedLocations) {
      const excludedCenter = global.getCenter(excluded[0], excluded[1]);
      const dist = global.getDistance(
        { x: tileCenter[0], y: tileCenter[1] },
        { x: excludedCenter[0], y: excludedCenter[1] }
      );
      
      if (dist < minDistance) {
        return true;
      }
    }
    
    return false;
  }

  // Assess resources available within a faction's base radius
  assessBaseResources(hq, radius, z = 0) {
    const area = global.getArea(hq, hq, radius);
    const resources = {
      heavyForest: 0,
      lightForest: 0,
      totalForest: 0,
      grass: 0,
      rocks: 0,
      mountains: 0,
      water: 0,
      caveEntrances: [],
      buildableSpace: 0
    };
    
    const hqCenter = global.getCenter(hq[0], hq[1]);
    
    // Count terrain types
    for (const tile of area) {
      const terrain = Math.floor(this.getTile(z, tile[0], tile[1]));
      
      if (terrain === 1) resources.heavyForest++;
      else if (terrain === 2) resources.lightForest++;
      else if (terrain === 7) resources.grass++;
      else if (terrain === 4) resources.rocks++;
      else if (terrain === 5) resources.mountains++;
      else if (terrain === 0) resources.water++;
      
      if (terrain === 7 || terrain === 3) resources.buildableSpace++;
    }
    
    resources.totalForest = resources.heavyForest + resources.lightForest;
    
    // Find cave entrances within radius
    if (global.caveEntrances) {
      for (const cave of global.caveEntrances) {
        const caveCenter = global.getCenter(cave[0], cave[1]);
        const dist = global.getDistance(
          { x: hqCenter[0], y: hqCenter[1] },
          { x: caveCenter[0], y: caveCenter[1] }
        );
        const distInTiles = Math.floor(dist / global.tileSize);
        
        if (distInTiles <= radius) {
          resources.caveEntrances.push({ tile: cave, distance: dist, distInTiles: distInTiles });
        }
      }
    }
    
    return resources;
  }

  // Count specific terrain types near a tile
  countNearbyTerrain(tile, terrainTypes, radius, z = 0) {
    const area = global.getArea(tile, tile, radius);
    let count = 0;
    
    for (const t of area) {
      const terrain = Math.floor(this.getTile(z, t[0], t[1]));
      if (terrainTypes.includes(terrain)) {
        count++;
      }
    }
    
    return count;
  }

  // Find distance to nearest building of specific type
  getDistanceToNearestBuilding(tile, buildingType) {
    const tileCenter = global.getCenter(tile[0], tile[1]);
    let nearestDist = Infinity;
    
    for (const buildingId in global.Building.list) {
      const building = global.Building.list[buildingId];
      if (building.type === buildingType) {
        const buildingCenter = global.getCenter(building.plot[0][0], building.plot[0][1]);
        const dist = global.getDistance(
          { x: tileCenter[0], y: tileCenter[1] },
          { x: buildingCenter[0], y: buildingCenter[1] }
        );
        nearestDist = Math.min(nearestDist, dist);
      }
    }
    
    return nearestDist;
  }
}

module.exports = { TilemapSystem };

