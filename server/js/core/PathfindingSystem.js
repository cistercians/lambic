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
    
    // Path caching with LRU eviction
    this.pathCache = new Map();
    this.maxCacheSize = 1000;
    this.cacheTTL = 30000; // 30 seconds
    this.cacheAccessOrder = []; // Track access order for LRU
    
    // GRID CACHING: Cache generated pathfinding grids to avoid regeneration
    this.gridCache = new Map();
    this.maxGridCacheSize = 10; // Cache up to 10 grids (one per layer + options)
    this.gridCacheTTL = 60000; // 60 seconds (grids change less frequently than paths)
    
    // PATHFINDING QUEUE: Throttle pathfinding to prevent lag spikes
    this.pathfindingQueue = [];
    this.maxConcurrentPathfinding = 10; // Max pathfinding operations per frame
    this.currentFramePathfindingCount = 0;
    this.lastFrameReset = Date.now();
    this.queuedRequests = 0;
    this.completedQueuedRequests = 0;
    
    // PERFORMANCE PROFILING
    this.profiling = {
      enabled: true,
      requestsThisFrame: 0,
      requestsThisSecond: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      gridCacheHits: 0,
      gridCacheMisses: 0,
      queuedCount: 0,
      throttledCount: 0,
      pathfindingTimes: [], // Last 100 pathfinding times
      gridGenerationTimes: [],
      smoothingTimes: [],
      failedPaths: 0,
      successfulPaths: 0,
      hotspots: new Map(), // Track which locations cause most pathfinding
      layerUsage: new Map(), // Track which layers are used most
      lastFrameReset: Date.now(),
      lastSecondReset: Date.now(),
      lastLog: Date.now(),
      logInterval: 10000, // Log every 10 seconds
      maxHistorySize: 100
    };
    
    // OBJECT POOL: Reuse objects to reduce allocations
    this.objectPool = {
      vectors: [], // Reuse [x, y] arrays
      paths: [], // Reuse path arrays
      poolSize: 50,
      
      getVector: function() {
        return this.vectors.length > 0 ? this.vectors.pop() : [0, 0];
      },
      
      returnVector: function(vec) {
        if (this.vectors.length < this.poolSize) {
          vec[0] = 0;
          vec[1] = 0;
          this.vectors.push(vec);
        }
      },
      
      getPath: function() {
        return this.paths.length > 0 ? this.paths.pop() : [];
      },
      
      returnPath: function(path) {
        if (this.paths.length < this.poolSize) {
          path.length = 0; // Clear array
          this.paths.push(path);
        }
      }
    };
  }

  // Generate cache key (optimized - avoid JSON.stringify)
  generateCacheKey(start, end, layer, options = {}) {
    // Use string concatenation instead of JSON.stringify for common options
    let optionsKey = '';
    if (options.allowSpecificDoor) {
      optionsKey = options.targetDoor ? `_door_${options.targetDoor[0]},${options.targetDoor[1]}` : '_door';
    } else if (options.waterOnly) {
      optionsKey = '_water';
    } else if (options.avoidDoors) {
      optionsKey = '_nodoors';
    }
    // For complex options, fall back to JSON.stringify but cache it
    if (Object.keys(options).length > 2 && !optionsKey) {
      optionsKey = `_${JSON.stringify(options)}`;
    }
    
    return `${start[0]},${start[1]}_${end[0]},${end[1]}_${layer}${optionsKey}`;
  }
  
  // Get cached path with LRU tracking
  getCachedPath(start, end, layer, options = {}) {
    const cacheKey = this.generateCacheKey(start, end, layer, options);
    const cached = this.pathCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      // PROFILING: Track cache hit
      if (this.profiling.enabled) {
        this.profiling.cacheHits++;
      }
      
      // Update LRU: move to end of access order
      const index = this.cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
      }
      this.cacheAccessOrder.push(cacheKey);
      
      return cached.path;
    }
    
    // PROFILING: Track cache miss
    if (this.profiling.enabled) {
      this.profiling.cacheMisses++;
    }
    
    return null;
  }

  // Cache a path with LRU eviction
  cachePath(start, end, layer, path, options = {}) {
    const cacheKey = this.generateCacheKey(start, end, layer, options);
    
    // LRU eviction: remove least recently used if at capacity
    if (this.pathCache.size >= this.maxCacheSize) {
      // Remove the oldest accessed key (first in access order)
      if (this.cacheAccessOrder.length > 0) {
        const lruKey = this.cacheAccessOrder.shift();
        this.pathCache.delete(lruKey);
      } else {
        // Fallback: remove first key if access order is empty
        const firstKey = this.pathCache.keys().next().value;
        this.pathCache.delete(firstKey);
      }
    }
    
    // Add to cache
    this.pathCache.set(cacheKey, {
      path: path,
      timestamp: Date.now()
    });
    
    // Track in access order
    this.cacheAccessOrder.push(cacheKey);
    
    // Periodically clean up expired entries and sync access order
    if (this.pathCache.size % 100 === 0) {
      this.cleanupExpiredCache();
    }
  }
  
  // Cleanup expired cache entries
  cleanupExpiredCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.pathCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    }
    
    // Remove expired entries
    for (const key of keysToDelete) {
      this.pathCache.delete(key);
      
      // Remove from access order
      const index = this.cacheAccessOrder.indexOf(key);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
      }
    }
    
    // Also clean up access order to only include valid keys
    this.cacheAccessOrder = this.cacheAccessOrder.filter(key => this.pathCache.has(key));
  }
  
  // GRID CACHING: Generate cache key for grids
  generateGridCacheKey(layer, options = {}) {
    let optionsKey = '';
    if (options.allowSpecificDoor) {
      optionsKey = options.targetDoor ? `_door_${options.targetDoor[0]},${options.targetDoor[1]}` : '_door';
    } else if (options.waterOnly) {
      optionsKey = '_water';
    } else if (options.avoidDoors) {
      optionsKey = '_nodoors';
    }
    if (Object.keys(options).length > 2 && !optionsKey) {
      optionsKey = `_${JSON.stringify(options)}`;
    }
    return `grid_${layer}${optionsKey}`;
  }
  
  // GRID CACHING: Get cached grid
  getCachedGrid(layer, options = {}) {
    const cacheKey = this.generateGridCacheKey(layer, options);
    const cached = this.gridCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.gridCacheTTL) {
      if (this.profiling.enabled) {
        this.profiling.gridCacheHits++;
      }
      return cached.grid;
    }
    
    if (this.profiling.enabled) {
      this.profiling.gridCacheMisses++;
    }
    
    return null;
  }
  
  // GRID CACHING: Cache a grid
  cacheGrid(layer, grid, options = {}) {
    const cacheKey = this.generateGridCacheKey(layer, options);
    
    // LRU eviction: remove oldest if at capacity
    if (this.gridCache.size >= this.maxGridCacheSize) {
      const firstKey = this.gridCache.keys().next().value;
      this.gridCache.delete(firstKey);
    }
    
    // Add to cache
    this.gridCache.set(cacheKey, {
      grid: grid,
      timestamp: Date.now()
    });
  }
  
  // GRID CACHING: Cleanup expired grid cache entries
  cleanupExpiredGridCache() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.gridCache.entries()) {
      if (now - value.timestamp > this.gridCacheTTL) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.gridCache.delete(key);
    }
  }
  
  // THROTTLING: Reset per-frame pathfinding counter
  resetFrameThrottle() {
    this.currentFramePathfindingCount = 0;
    this.lastFrameReset = Date.now();
  }
  
  // THROTTLING: Check if we can do pathfinding this frame
  canPathfindThisFrame() {
    // Reset counter if it's a new frame (> 16ms since last reset)
    const now = Date.now();
    if (now - this.lastFrameReset > 16) {
      this.resetFrameThrottle();
    }
    
    return this.currentFramePathfindingCount < this.maxConcurrentPathfinding;
  }
  
  // QUEUE: Process queued pathfinding requests
  processPathfindingQueue() {
    let processed = 0;
    const maxProcessPerCall = 5; // Process up to 5 queued requests per call
    
    while (this.pathfindingQueue.length > 0 && processed < maxProcessPerCall && this.canPathfindThisFrame()) {
      const request = this.pathfindingQueue.shift();
      const path = this._findPathImmediate(request.start, request.end, request.layer, request.options);
      
      if (request.callback) {
        request.callback(path);
      }
      
      this.completedQueuedRequests++;
      processed++;
    }
    
    return processed;
  }

  // Public API: Find path with throttling/queueing support
  findPath(start, end, layer, options = {}, callback = null) {
    // Check cache first (synchronous and fast)
    const cachedPath = this.getCachedPath(start, end, layer, options);
    if (cachedPath) {
      if (callback) {
        callback(cachedPath);
        return null; // Async mode
      }
      return cachedPath; // Sync mode
    }
    
    // Check if we can pathfind this frame
    if (!this.canPathfindThisFrame()) {
      // Queue the request for later processing
      if (this.profiling.enabled) {
        this.profiling.queuedCount++;
        this.profiling.throttledCount++;
      }
      
      this.pathfindingQueue.push({
        start: start,
        end: end,
        layer: layer,
        options: options,
        callback: callback,
        timestamp: Date.now()
      });
      
      this.queuedRequests++;
      
      // Return null to indicate async processing
      if (callback) {
        return null;
      }
      
      // If no callback, process immediately (fallback for synchronous callers)
      // This is not ideal but maintains backward compatibility
      return this._findPathImmediate(start, end, layer, options);
    }
    
    // We have capacity this frame, pathfind immediately
    this.currentFramePathfindingCount++;
    const path = this._findPathImmediate(start, end, layer, options);
    
    if (callback) {
      callback(path);
      return null;
    }
    
    return path;
  }
  
  // Internal: Immediate pathfinding (no throttling)
  _findPathImmediate(start, end, layer, options = {}) {
    // PROFILING: Track request
    if (this.profiling.enabled) {
      this.profiling.requestsThisFrame++;
      this.profiling.requestsThisSecond++;
      this.profiling.totalRequests++;
      
      // Track hotspots
      const hotspotKey = `${start[0]},${start[1]}_${end[0]},${end[1]}`;
      this.profiling.hotspots.set(hotspotKey, (this.profiling.hotspots.get(hotspotKey) || 0) + 1);
      
      // Track layer usage
      this.profiling.layerUsage.set(layer, (this.profiling.layerUsage.get(layer) || 0) + 1);
      
      // Reset per-second counter
      const now = Date.now();
      if (now - this.profiling.lastSecondReset >= 1000) {
        this.profiling.requestsThisSecond = 0;
        this.profiling.lastSecondReset = now;
      }
    }

    const startTime = Date.now();
    const maxPathfindingTime = 100; // Maximum 100ms for pathfinding to prevent blocking

    try {
      // Try to get cached grid first
      let grid = this.getCachedGrid(layer, options);
      let gridTime = 0;
      
      if (!grid) {
        // Generate pathfinding grid
        const gridStartTime = Date.now();
        grid = this.tilemapSystem.generatePathfindingGrid(layer, options);
        gridTime = Date.now() - gridStartTime;
        
        // Cache the grid for reuse
        this.cacheGrid(layer, grid, options);
        
        // PROFILING: Track grid generation time
        if (this.profiling.enabled) {
          this.profiling.gridGenerationTimes.push(gridTime);
          if (this.profiling.gridGenerationTimes.length > this.profiling.maxHistorySize) {
            this.profiling.gridGenerationTimes.shift();
          }
        }
      }
      
      const pfGrid = new PF.Grid(grid);
      
      // Validate start and end positions
      if (start[0] < 0 || start[0] >= grid[0].length || start[1] < 0 || start[1] >= grid.length) {
        console.error(`Pathfinding: start position [${start}] out of bounds (grid size: ${grid[0].length}x${grid.length})`);
        if (this.profiling.enabled) this.profiling.failedPaths++;
        return null;
      }
      if (end[0] < 0 || end[0] >= grid[0].length || end[1] < 0 || end[1] >= grid.length) {
        console.error(`Pathfinding: end position [${end}] out of bounds (grid size: ${grid[0].length}x${grid.length})`);
        if (this.profiling.enabled) this.profiling.failedPaths++;
        return null;
      }
      
      // Simple validation: both start and end must be walkable
      if (grid[start[1]][start[0]] === 1) {
        const startTile = this.tilemapSystem.getTile(layer, start[0], start[1]);
        console.error(`Pathfinding FAIL: start [${start}] not walkable on layer ${layer}. Grid value=${grid[start[1]][start[0]]}, Actual tile=${startTile}`);
        if (this.profiling.enabled) this.profiling.failedPaths++;
        return null;
      }
      if (grid[end[1]][end[0]] === 1) {
        const endTile = this.tilemapSystem.getTile(layer, end[0], end[1]);
        console.error(`Pathfinding FAIL: end [${end}] not walkable on layer ${layer}. Grid value=${grid[end[1]][end[0]]}, Actual tile=${endTile}`);
        if (this.profiling.enabled) this.profiling.failedPaths++;
        return null;
      }
      
      // Find path with timeout protection
      const path = this.finder.findPath(start[0], start[1], end[0], end[1], pfGrid);
      
      const pathfindingTime = Date.now() - startTime;
      
      // PROFILING: Track pathfinding time
      if (this.profiling.enabled) {
        this.profiling.pathfindingTimes.push(pathfindingTime);
        if (this.profiling.pathfindingTimes.length > this.profiling.maxHistorySize) {
          this.profiling.pathfindingTimes.shift();
        }
      }
      
      if (pathfindingTime > maxPathfindingTime) {
        console.warn(`Pathfinding took ${pathfindingTime}ms, which is longer than expected`);
      }
      
      if (path && path.length > 0) {
        // Smooth the path
        const smoothStartTime = Date.now();
        const smoothedPath = this.smoothPath(path, layer);
        const smoothTime = Date.now() - smoothStartTime;
        
        // PROFILING: Track smoothing time
        if (this.profiling.enabled) {
          this.profiling.smoothingTimes.push(smoothTime);
          if (this.profiling.smoothingTimes.length > this.profiling.maxHistorySize) {
            this.profiling.smoothingTimes.shift();
          }
          this.profiling.successfulPaths++;
        }
        
        // Cache the result
        this.cachePath(start, end, layer, smoothedPath, options);
        
        // PROFILING: Log if needed
        this.maybeLogStats();
        
        return smoothedPath;
      } else {
        console.error(`Pathfinding FAIL: no path found from [${start}] to [${end}] on layer ${layer}`);
        if (this.profiling.enabled) this.profiling.failedPaths++;
      }
    } catch (error) {
      console.error('Pathfinding error:', error);
      if (this.profiling.enabled) this.profiling.failedPaths++;
    }
    
    // PROFILING: Log if needed
    this.maybeLogStats();
    
    return null;
  }

  // Smooth path to reduce zigzag movement (OPTIMIZED to reduce allocations)
  smoothPath(path, layer) {
    if (!path || path.length <= 2) return path;
    
    // Reuse array if possible
    const smoothed = this.objectPool.getPath();
    smoothed.push(path[0]);
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
      
      // Add the furthest reachable point (reuse existing array if it's already a point)
      const point = path[j - 1];
      smoothed.push(point);
      i = j - 1;
    }
    
    return smoothed;
  }

  // Check if there's a clear line of sight between two points (OPTIMIZED - avoid allocations)
  hasLineOfSight(start, end, layer) {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    // Early exit for adjacent tiles
    if (steps <= 1) return true;
    
    // Cache frequently accessed values
    const startX = start[0];
    const startY = start[1];
    
    for (let i = 1; i < steps; i++) {
      // Use integer math where possible
      const x = Math.round(startX + (dx * i) / steps);
      const y = Math.round(startY + (dy * i) / steps);
      
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
    this.cacheAccessOrder = [];
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.pathCache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL
    };
  }
  
  // PROFILING: Reset per-frame counters
  resetFrameCounters() {
    if (this.profiling.enabled) {
      this.profiling.requestsThisFrame = 0;
      this.profiling.lastFrameReset = Date.now();
    }
  }
  
  // PROFILING: Get performance stats
  getProfilingStats() {
    if (!this.profiling.enabled) return null;
    
    const avgTime = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const maxTime = (arr) => arr.length > 0 ? Math.max(...arr) : 0;
    const minTime = (arr) => arr.length > 0 ? Math.min(...arr) : 0;
    
    const totalCacheAccess = this.profiling.cacheHits + this.profiling.cacheMisses;
    const cacheHitRate = totalCacheAccess > 0 ? (this.profiling.cacheHits / totalCacheAccess * 100).toFixed(1) : 0;
    
    const totalGridCacheAccess = this.profiling.gridCacheHits + this.profiling.gridCacheMisses;
    const gridCacheHitRate = totalGridCacheAccess > 0 ? (this.profiling.gridCacheHits / totalGridCacheAccess * 100).toFixed(1) : 0;
    
    // Get top 5 hotspots
    const hotspots = Array.from(this.profiling.hotspots.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ location: key, count }));
    
    // Get layer usage
    const layerUsage = Array.from(this.profiling.layerUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([layer, count]) => ({ layer, count }));
    
    return {
      requests: {
        total: this.profiling.totalRequests,
        thisFrame: this.profiling.requestsThisFrame,
        thisSecond: this.profiling.requestsThisSecond
      },
      cache: {
        hits: this.profiling.cacheHits,
        misses: this.profiling.cacheMisses,
        hitRate: `${cacheHitRate}%`,
        size: this.pathCache.size,
        maxSize: this.maxCacheSize
      },
      gridCache: {
        hits: this.profiling.gridCacheHits,
        misses: this.profiling.gridCacheMisses,
        hitRate: `${gridCacheHitRate}%`,
        size: this.gridCache.size,
        maxSize: this.maxGridCacheSize
      },
      queue: {
        pending: this.pathfindingQueue.length,
        queued: this.queuedRequests,
        completed: this.completedQueuedRequests,
        throttled: this.profiling.throttledCount
      },
      timing: {
        pathfinding: {
          avg: avgTime(this.profiling.pathfindingTimes).toFixed(2),
          max: maxTime(this.profiling.pathfindingTimes).toFixed(2),
          min: minTime(this.profiling.pathfindingTimes).toFixed(2)
        },
        gridGeneration: {
          avg: avgTime(this.profiling.gridGenerationTimes).toFixed(2),
          max: maxTime(this.profiling.gridGenerationTimes).toFixed(2)
        },
        smoothing: {
          avg: avgTime(this.profiling.smoothingTimes).toFixed(2),
          max: maxTime(this.profiling.smoothingTimes).toFixed(2)
        }
      },
      paths: {
        successful: this.profiling.successfulPaths,
        failed: this.profiling.failedPaths,
        successRate: this.profiling.totalRequests > 0 
          ? ((this.profiling.successfulPaths / this.profiling.totalRequests) * 100).toFixed(1) + '%'
          : '0%'
      },
      hotspots: hotspots,
      layerUsage: layerUsage
    };
  }
  
  // PROFILING: Maybe log statistics
  maybeLogStats() {
    if (!this.profiling.enabled) return;
    
    const now = Date.now();
    if (now - this.profiling.lastLog >= this.profiling.logInterval) {
      const stats = this.getProfilingStats();
      console.log('🔍 Pathfinding Performance Stats:');
      console.log(`   Requests: ${stats.requests.total} total, ${stats.requests.thisSecond} last second`);
      console.log(`   Path Cache: ${stats.cache.hitRate} hit rate (${stats.cache.hits} hits, ${stats.cache.misses} misses)`);
      console.log(`   Grid Cache: ${stats.gridCache.hitRate} hit rate (${stats.gridCache.hits} hits, ${stats.gridCache.misses} misses)`);
      console.log(`   Queue: ${stats.queue.pending} pending, ${stats.queue.throttled} throttled`);
      console.log(`   Timing: avg=${stats.timing.pathfinding.avg}ms, max=${stats.timing.pathfinding.max}ms`);
      console.log(`   Grid Gen: avg=${stats.timing.gridGeneration.avg}ms, max=${stats.timing.gridGeneration.max}ms`);
      console.log(`   Paths: ${stats.paths.successful} success, ${stats.paths.failed} failed (${stats.paths.successRate})`);
      
      if (stats.hotspots.length > 0) {
        console.log(`   Top hotspots:`);
        stats.hotspots.forEach((h, i) => {
          console.log(`     ${i + 1}. ${h.location}: ${h.count} requests`);
        });
      }
      
      if (stats.layerUsage.length > 0) {
        console.log(`   Layer usage:`);
        stats.layerUsage.forEach(l => {
          console.log(`     Layer ${l.layer}: ${l.count} requests`);
        });
      }
      
      // MEMORY LEAK DETECTION: Check cache sizes
      this.auditMemoryUsage();
      
      this.profiling.lastLog = now;
    }
  }
  
  // MEMORY AUDITING: Monitor cache growth and clean up
  auditMemoryUsage() {
    const pathCacheSize = this.pathCache.size;
    const accessOrderSize = this.cacheAccessOrder.length;
    
    // Check for memory leak indicators
    if (accessOrderSize > pathCacheSize * 1.5) {
      console.warn(`⚠️  Memory Warning: Access order size (${accessOrderSize}) significantly exceeds cache size (${pathCacheSize})`);
      console.warn(`   Cleaning up access order...`);
      
      // Sync access order with actual cache
      this.cacheAccessOrder = this.cacheAccessOrder.filter(key => this.pathCache.has(key));
      console.log(`   ✅ Access order cleaned: ${this.cacheAccessOrder.length} entries`);
    }
    
    // Check cache size against limit
    if (pathCacheSize > this.maxCacheSize * 0.9) {
      console.warn(`⚠️  Memory Warning: Cache nearing capacity (${pathCacheSize}/${this.maxCacheSize})`);
    }
    
    // Proactively clean expired entries
    this.cleanupExpiredCache();
  }
  
  // Periodic maintenance (call from game loop every ~30 seconds)
  periodicMaintenance() {
    // Clean expired path cache entries
    const beforeSize = this.pathCache.size;
    this.cleanupExpiredCache();
    const afterSize = this.pathCache.size;
    
    if (beforeSize !== afterSize) {
      console.log(`🧹 Pathfinding Path Cache: Removed ${beforeSize - afterSize} expired entries`);
    }
    
    // Clean expired grid cache entries
    const beforeGridSize = this.gridCache.size;
    this.cleanupExpiredGridCache();
    const afterGridSize = this.gridCache.size;
    
    if (beforeGridSize !== afterGridSize) {
      console.log(`🧹 Pathfinding Grid Cache: Removed ${beforeGridSize - afterGridSize} expired entries`);
    }
    
    // Process queued pathfinding requests
    const processed = this.processPathfindingQueue();
    if (processed > 0) {
      console.log(`🔄 Processed ${processed} queued pathfinding requests (${this.pathfindingQueue.length} remaining)`);
    }
    
    // If hotspots map is growing too large, trim it
    if (this.profiling.hotspots.size > 1000) {
      // Keep only top 500
      const sorted = Array.from(this.profiling.hotspots.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 500);
      
      this.profiling.hotspots.clear();
      for (const [key, value] of sorted) {
        this.profiling.hotspots.set(key, value);
      }
      
      console.log(`🧹 Pathfinding Hotspots: Trimmed to top 500 entries`);
    }
  }
}

module.exports = { PathfindingSystem };
