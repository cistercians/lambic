/**
 * PathfindingManager - Unified pathfinding interface
 * 
 * This is the ONLY way to request paths in the game.
 * All pathfinding requests should go through PathfindingManager.requestPath()
 * 
 * Benefits:
 * - Single entry point for all pathfinding
 * - Consistent caching and validation
 * - Easy debugging and logging
 * - Clear API contract
 */

class PathfindingManager {
  constructor() {
    this.debug = false; // Set to true for detailed logging
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0,
      avgTime: 0
    };
  }

  /**
   * Request a path for an entity
   * 
   * @param {Object} entity - Entity requesting the path
   * @param {Object} destination - Destination {z, col, row} or [col, row]
   * @param {Object} options - Optional pathfinding options
   * @returns {Array|null} - Path as array of [col, row] waypoints, or null if no path found
   */
  requestPath(entity, destination, options = {}) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Validate inputs
      if (!entity || !destination) {
        if (this.debug) console.log('[PathfindingManager] Invalid inputs: entity or destination missing');
        this.stats.failures++;
        return null;
      }

      // Parse destination format
      let targetZ, targetCol, targetRow;
      if (Array.isArray(destination)) {
        // Format: [col, row]
        targetZ = entity.z;
        targetCol = destination[0];
        targetRow = destination[1];
      } else if (typeof destination === 'object' && destination.z !== undefined) {
        // Format: {z, col, row} or {z, loc: [col, row]}
        targetZ = destination.z;
        if (destination.loc) {
          targetCol = destination.loc[0];
          targetRow = destination.loc[1];
        } else {
          targetCol = destination.col;
          targetRow = destination.row;
        }
      } else {
        if (this.debug) console.log('[PathfindingManager] Invalid destination format:', destination);
        this.stats.failures++;
        return null;
      }

      // Get current location
      const startLoc = global.getLoc ? global.getLoc(entity.x, entity.y) : [
        Math.floor(entity.x / 64),
        Math.floor(entity.y / 64)
      ];

      // Check if already at destination
      if (startLoc[0] === targetCol && startLoc[1] === targetRow && entity.z === targetZ) {
        if (this.debug) console.log('[PathfindingManager] Already at destination');
        return null;
      }

      // Check pathfinding cooldown (prevent spam)
      if (entity.pathCooldown && entity.pathCooldown > 0) {
        if (this.debug) console.log('[PathfindingManager] Pathfinding on cooldown');
        return null;
      }

      // Handle multi-z pathfinding (complex z-level transitions)
      if (targetZ !== entity.z && Math.abs(targetZ - entity.z) > 1) {
        if (this.debug) console.log('[PathfindingManager] Multi-z pathfinding required');
        return this._handleMultiZPath(entity, startLoc, targetZ, [targetCol, targetRow]);
      }

      // Check path cache first
      const cachedPath = this._checkCache(startLoc, [targetCol, targetRow], entity.z);
      if (cachedPath) {
        this.stats.cacheHits++;
        const elapsed = Date.now() - startTime;
        this._updateAvgTime(elapsed);
        if (this.debug) console.log('[PathfindingManager] Cache hit! Time:', elapsed, 'ms');
        return cachedPath;
      }

      this.stats.cacheMisses++;

      // Resolve layer from z-level
      const layer = this._resolveLayer(entity.z, options);

      // Merge options with defaults
      const pathOptions = this._buildPathOptions(entity, targetZ, targetCol, targetRow, options);

      // Request path from tilemapSystem
      let path = null;
      if (global.tilemapSystem && global.tilemapSystem.findPath) {
        path = global.tilemapSystem.findPath(startLoc, [targetCol, targetRow], layer, pathOptions);
      }

      // Smooth path (reduce waypoints)
      if (path && path.length > 0) {
        path = this._smoothPath(path, entity.z);
        
        // Cache the result
        this._cacheResult(startLoc, [targetCol, targetRow], entity.z, path);
      } else {
        this.stats.failures++;
      }

      const elapsed = Date.now() - startTime;
      this._updateAvgTime(elapsed);

      if (this.debug) {
        console.log('[PathfindingManager] Path computed:', {
          from: startLoc,
          to: [targetCol, targetRow],
          z: entity.z,
          layer: layer,
          pathLength: path ? path.length : 0,
          time: elapsed + 'ms'
        });
      }

      return path;

    } catch (error) {
      console.error('[PathfindingManager] Error in requestPath:', error);
      this.stats.failures++;
      return null;
    }
  }

  /**
   * Handle multi-z pathfinding (requires waypoints through multiple z-levels)
   */
  _handleMultiZPath(entity, startLoc, targetZ, targetLoc) {
    if (typeof global.createMultiZPath === 'function') {
      const multiZWaypoints = global.createMultiZPath(entity.z, startLoc, targetZ, targetLoc);
      
      if (multiZWaypoints && multiZWaypoints.length > 0) {
        // Store waypoints on entity for multi-z navigation
        entity.multiZWaypoints = multiZWaypoints;
        entity.currentWaypoint = 0;
        
        // Return path to first waypoint
        const firstWaypoint = multiZWaypoints[0];
        return this.requestPath(entity, {z: firstWaypoint.z, loc: firstWaypoint.loc}, {});
      }
    }
    
    return null;
  }

  /**
   * Check path cache
   */
  _checkCache(start, end, z) {
    if (typeof global.getCachedPath === 'function') {
      return global.getCachedPath(start, end, z);
    }
    return null;
  }

  /**
   * Cache computed path
   */
  _cacheResult(start, end, z, path) {
    if (typeof global.cachePath === 'function') {
      global.cachePath(start, end, z, path);
    }
  }

  /**
   * Resolve tilemap layer from z-level
   */
  _resolveLayer(z, options) {
    if (options.layer !== undefined) {
      return options.layer;
    }

    // Standard z-level to layer mapping
    const layerMap = {
      0: 0,    // Overworld
      '-1': 1, // Cave
      1: 3,    // Building floor 1
      2: 5,    // Building floor 2
      '-2': 8, // Cellar
      '-3': 2  // Underwater
    };

    return layerMap[z] !== undefined ? layerMap[z] : 0;
  }

  /**
   * Build pathfinding options based on context
   */
  _buildPathOptions(entity, targetZ, targetCol, targetRow, userOptions) {
    const options = { ...userOptions };

    // Check if destination is a special tile (door, cave entrance, stairs)
    if (targetZ === 0 && global.isDoorwayDestination) {
      const isDoorway = global.isDoorwayDestination(targetCol, targetRow, targetZ);
      if (isDoorway) {
        options.allowSpecificDoor = true;
        options.targetDoor = [targetCol, targetRow];
      }
    }

    // Check if destination is a cave exit (in caves)
    if (targetZ === -1 && global.caveEntrances) {
      for (let i = 0; i < global.caveEntrances.length; i++) {
        const entrance = global.caveEntrances[i];
        if (entrance[0] === targetCol && entrance[1] + 1 === targetRow) {
          options.allowSpecificDoor = true;
          options.targetDoor = [targetCol, targetRow];
          break;
        }
      }
    }

    // Check if starting from a cave exit (allow as starting tile)
    if (entity.z === -1 && global.caveEntrances) {
      const startLoc = global.getLoc ? global.getLoc(entity.x, entity.y) : [
        Math.floor(entity.x / 64),
        Math.floor(entity.y / 64)
      ];
      
      for (let i = 0; i < global.caveEntrances.length; i++) {
        const entrance = global.caveEntrances[i];
        if (entrance[0] === startLoc[0] && entrance[1] + 1 === startLoc[1]) {
          options.allowStartTile = startLoc;
          break;
        }
      }
    }

    return options;
  }

  /**
   * Smooth path to reduce waypoints
   */
  _smoothPath(path, z) {
    if (typeof global.smoothPath === 'function') {
      // Don't smooth cave paths - caves have narrow tunnels
      if (z === -1) {
        return path;
      }
      return global.smoothPath(path, z);
    }
    return path;
  }

  /**
   * Update average time tracking
   */
  _updateAvgTime(elapsed) {
    if (this.stats.totalRequests === 1) {
      this.stats.avgTime = elapsed;
    } else {
      this.stats.avgTime = (this.stats.avgTime * (this.stats.totalRequests - 1) + elapsed) / this.stats.totalRequests;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const cacheHitRate = this.stats.totalRequests > 0
      ? ((this.stats.cacheHits / this.stats.totalRequests) * 100).toFixed(1)
      : '0.0';

    return {
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: cacheHitRate + '%',
      failures: this.stats.failures,
      avgTime: this.stats.avgTime.toFixed(2) + 'ms'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failures: 0,
      avgTime: 0
    };
  }

  /**
   * Enable/disable debug logging
   */
  setDebug(enabled) {
    this.debug = enabled;
  }
}

// Create singleton instance
const pathfindingManager = new PathfindingManager();

// Export singleton
module.exports = pathfindingManager;
module.exports.PathfindingManager = PathfindingManager;














