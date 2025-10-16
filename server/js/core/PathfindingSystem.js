// Enhanced Pathfinding System for Consolidated Tilemap
const PF = require('pathfinding');

class PathfindingSystem {
  constructor(tilemapSystem) {
    this.tilemapSystem = tilemapSystem;
    this.finder = new PF.AStarFinder({
      allowDiagonal: true,
      dontCrossCorners: true,
      heuristic: PF.Heuristic.euclidean,
      weight: 1.2
    });
    
    // Path caching
    this.pathCache = new Map();
    this.maxCacheSize = 1000;
    this.cacheTTL = 30000; // 30 seconds
  }

  // Get cached path
  getCachedPath(start, end, layer, options = {}) {
    const cacheKey = `${start[0]},${start[1]}_${end[0]},${end[1]}_${layer}_${JSON.stringify(options)}`;
    const cached = this.pathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.path;
    }
    
    return null;
  }

  // Cache a path
  cachePath(start, end, layer, path, options = {}) {
    if (this.pathCache.size >= this.maxCacheSize) {
      // Remove oldest entries
      const oldestKey = this.pathCache.keys().next().value;
      this.pathCache.delete(oldestKey);
    }
    
    const cacheKey = `${start[0]},${start[1]}_${end[0]},${end[1]}_${layer}_${JSON.stringify(options)}`;
    this.pathCache.set(cacheKey, {
      path: path,
      timestamp: Date.now()
    });
  }

  // Find path between two points with timeout protection
  findPath(start, end, layer, options = {}) {
    // Check cache first
    const cachedPath = this.getCachedPath(start, end, layer, options);
    if (cachedPath) {
      return cachedPath;
    }

    const startTime = Date.now();
    const maxPathfindingTime = 100; // Maximum 100ms for pathfinding to prevent blocking

    try {
      // Generate pathfinding grid
      const grid = this.tilemapSystem.generatePathfindingGrid(layer, options);
      const pfGrid = new PF.Grid(grid);
      
      // Find path with timeout protection
      const path = this.finder.findPath(start[0], start[1], end[0], end[1], pfGrid);
      
      const pathfindingTime = Date.now() - startTime;
      if (pathfindingTime > maxPathfindingTime) {
        console.warn(`Pathfinding took ${pathfindingTime}ms, which is longer than expected`);
      }
      
      if (path && path.length > 0) {
        // Smooth the path
        const smoothedPath = this.smoothPath(path, layer);
        
        // Cache the result
        this.cachePath(start, end, layer, smoothedPath, options);
        
        return smoothedPath;
      }
    } catch (error) {
      console.error('Pathfinding error:', error);
    }
    
    return null;
  }

  // Smooth path to reduce zigzag movement
  smoothPath(path, layer) {
    if (!path || path.length <= 2) return path;
    
    const smoothed = [path[0]];
    let i = 0;
    
    while (i < path.length - 1) {
      let j = i + 2;
      
      // Try to find the furthest point we can reach in a straight line
      while (j < path.length) {
        if (this.hasLineOfSight(path[i], path[j], layer)) {
          j++;
        } else {
          break;
        }
      }
      
      // Add the furthest reachable point
      smoothed.push(path[j - 1]);
      i = j - 1;
    }
    
    return smoothed;
  }

  // Check if there's a clear line of sight between two points
  hasLineOfSight(start, end, layer) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    for (let i = 1; i < steps; i++) {
      const x = Math.round(start[0] + (dx * i) / steps);
      const y = Math.round(start[1] + (dy * i) / steps);
      
      const tile = this.tilemapSystem.getTile(layer, x, y);
      if (!this.tilemapSystem.isWalkable(layer, x, y, tile)) {
        return false;
      }
    }
    
    return true;
  }

  // Find path to nearest doorway
  findPathToDoorway(start, layer, buildingId = null) {
    const doorways = this.findDoorways(layer, buildingId);
    if (doorways.length === 0) return null;
    
    let bestPath = null;
    let bestDistance = Infinity;
    
    for (const doorway of doorways) {
      const path = this.findPath(start, [doorway.x, doorway.y], layer, {
        allowSpecificDoor: true,
        targetDoor: [doorway.x, doorway.y]
      });
      
      if (path && path.length < bestDistance) {
        bestPath = path;
        bestDistance = path.length;
      }
    }
    
    return bestPath;
  }

  // Find all doorways in a layer
  findDoorways(layer, buildingId = null) {
    const doorways = [];
    
    for (let x = 0; x < this.tilemapSystem.mapSize; x++) {
      for (let y = 0; y < this.tilemapSystem.mapSize; y++) {
        const tile = this.tilemapSystem.getTile(layer, x, y);
        if (this.tilemapSystem.isDoorway(layer, x, y, tile)) {
          // If buildingId is specified, check if this doorway belongs to that building
          if (buildingId === null || this.doorwayBelongsToBuilding(x, y, buildingId)) {
            doorways.push({ x, y, tile });
          }
        }
      }
    }
    
    return doorways;
  }

  // Check if a doorway belongs to a specific building
  doorwayBelongsToBuilding(x, y, buildingId) {
    // This would need to be implemented based on your building system
    // For now, return true as a placeholder
    return true;
  }

  // Find path avoiding specific areas
  findPathAvoiding(start, end, layer, avoidAreas = []) {
    const options = {
      avoidDoors: true,
      avoidAreas: avoidAreas
    };
    
    return this.findPath(start, end, layer, options);
  }

  // Clear path cache
  clearCache() {
    this.pathCache.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.pathCache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL
    };
  }
}

module.exports = { PathfindingSystem };
