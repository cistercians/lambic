// Optimized Game Loop
const PerformanceOptimizer = require('./PerformanceOptimizer.js');
const OptimizedEntityManager = require('./OptimizedEntityManager.js');

class OptimizedGameLoop {
  constructor() {
    this.performanceOptimizer = new PerformanceOptimizer();
    this.entityManager = new OptimizedEntityManager();
    
    this.targetFPS = 60; // Back to 60 FPS for smooth gameplay
    this.targetFrameTime = 1000 / this.targetFPS;
    this.lastFrameTime = 0;
    this.accumulator = 0;
    this.isRunning = false;
    this.intervalId = null;
    
    // Game state
    this.gameState = null;
    this.emit = null;
    
    // Performance monitoring
    this.frameTimeHistory = [];
    this.maxHistorySize = 60; // Keep 1 second of history at 60 FPS
    
    // Packet size monitoring
    this.packetSizeHistory = [];
    this.maxPacketHistorySize = 300; // Keep 5 seconds of history at 60 FPS
    this.totalBytesSent = 0;
    this.packetCount = 0;
    
    // Memory monitoring
    this.memoryHistory = [];
    this.maxMemoryHistorySize = 60; // Keep 1 minute of history (1 sample per second)
    this.lastMemoryCheck = Date.now();
    this.memoryCheckInterval = 1000; // Check memory every second
    
    // Delta compression: Track previous entity states
    this.previousEntityStates = new Map(); // entityId -> previous update pack
    this.deltaCompressionEnabled = true;
    
    // Spatial filtering: Filter entities based on distance from players
    this.spatialFilteringEnabled = true;
    this.spatialFilterRadius = 1500; // Send entities within 1500 pixels of any player (viewport is ~1000 pixels)
    
    // Update frequency optimization: Send non-critical updates less frequently
    this.updateFrequencyOptimization = true;
    this.criticalUpdateFrame = 0; // Track frames for update frequency
    this.nonCriticalUpdateInterval = 2; // Send non-critical updates every 2nd frame (30 FPS instead of 60)
    
    // Packet size limits
    this.maxPacketSize = 20 * 1024; // 20KB max packet size
    this.packetSplitQueue = []; // Queue for split packets
  }
  
  // Initialize the game loop
  initialize(gameState, emitFunction) {
    this.gameState = gameState;
    this.emit = emitFunction;
  }
  
  // Start the game loop
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrameTime = Date.now();
    // Use Node-friendly timer instead of requestAnimationFrame
    this.intervalId = setInterval(() => this.gameLoop(), this.targetFrameTime);
  }
  
  // Stop the game loop
  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  // Main game loop with fixed timestep
  gameLoop() {
    if (!this.isRunning) return;
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Cap delta time to prevent spiral of death
    const cappedDeltaTime = Math.min(deltaTime, this.targetFrameTime * 2);
    this.accumulator += cappedDeltaTime;
    
    // CRITICAL FIX: Cap accumulator to prevent massive catch-up when tab was inactive
    // Max 5 frames worth of accumulation = max 5 updates per game loop iteration
    const maxAccumulator = this.targetFrameTime * 5; // ~83ms at 60fps
    if(this.accumulator > maxAccumulator){
      this.accumulator = maxAccumulator;
    }
    
    // Update performance stats
    this.performanceOptimizer.updateFPS();
    this.updateFrameTimeHistory(deltaTime);
    
    // Fixed timestep updates
    while (this.accumulator >= this.targetFrameTime) {
      this.fixedUpdate();
      this.accumulator -= this.targetFrameTime;
    }
    
    // Variable timestep hook (server-side no rendering, but keep for telemetry)
    this.renderUpdate(deltaTime);
  }
  
    // Fixed timestep update (game logic)
  fixedUpdate() {
    const frameStartTime = Date.now();
    const frameBudget = this.targetFrameTime; // 16.67ms for 60fps
    
    // CRITICAL: OptimizedEntityManager is NOT being used - entities never added to it
    // Skip the redundant entityManager.updateEntities() call
    // const updateResult = this.entityManager.updateEntities(this.targetFrameTime);
    
    // Process pathfinding queue to spread work across frames
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem) {
      const pathfindingStart = Date.now();
      global.tilemapSystem.pathfindingSystem.processPathfindingQueue();
      const pathfindingTime = Date.now() - pathfindingStart;
      
      // If pathfinding took too long, skip non-critical updates
      if (pathfindingTime > frameBudget * 0.3) {
        // Pathfinding is taking too much time, defer some work
      }
    }
    
    // Update game state
    if (this.gameState) {
      this.gameState.updateTime();
    }
    
    // Check frame budget before continuing
    const elapsed = Date.now() - frameStartTime;
    const remainingBudget = frameBudget - elapsed;
    
    // Update spatial system (track entity positions for efficient queries)
    if (global.spatialSystem && remainingBudget > frameBudget * 0.1) {
      global.spatialSystem.updateAllEntities();
    }
    
    // Update social system (check for spontaneous NPC conversations)
    // Only if we have budget remaining (social updates are lower priority)
    if (global.socialSystem && remainingBudget > frameBudget * 0.2) {
      global.socialSystem.update();
    }
    
    // Send updates to clients (always do this, but may be reduced if over budget)
    this.sendUpdates();
    
    // Clear dirty flags
    this.performanceOptimizer.clearDirty();
    
  }
  
  // Variable timestep update (rendering)
  renderUpdate(deltaTime) {
    // Update viewport based on player position
    this.updateViewport();
    
    // Send render updates to clients
    this.sendRenderUpdates(deltaTime);
  }
  
  // Send game updates to clients
  sendUpdates() {
    // Track update frame for frequency optimization
    if(this.updateFrequencyOptimization) {
      this.criticalUpdateFrame++;
    }
    // PERFORMANCE PROFILING: Track individual system times
    if(!this._perfData) {
      this._perfData = {
        playerTimes: [],
        arrowTimes: [],
        itemTimes: [],
        buildingTimes: [],
        totalTimes: [],
        lastLog: Date.now()
      };
    }
    
    const startTotal = Date.now();
    
    const t1 = Date.now();
    const playerPack = Player.update();
    const playerTime = Date.now() - t1;
    
    const t2 = Date.now();
    const arrowPack = Arrow.update();
    const arrowTime = Date.now() - t2;
    
    const t3 = Date.now();
    const itemPack = Item.update();
    const itemTime = Date.now() - t3;
    
    const t4 = Date.now();
    const lightPack = Light.update();
    const lightTime = Date.now() - t4;
    
    const t5 = Date.now();
    const buildingPack = Building.update();
    const buildingTime = Date.now() - t5;
    
    const t6 = Date.now();
    const weatherPack = Weather.getAllUpdatePack();
    const weatherTime = Date.now() - t6;
    
    const totalTime = Date.now() - startTotal;
    
    // Apply spatial filtering: only send entities near players
    let filteredPlayerPack = playerPack;
    if(this.spatialFilteringEnabled && playerPack) {
      filteredPlayerPack = this.spatialFilterEntities(playerPack);
    }
    
    // Separate critical and non-critical updates for frequency optimization
    let criticalPlayerPack = [];
    let nonCriticalPlayerPack = [];
    
    if(this.updateFrequencyOptimization && filteredPlayerPack) {
      const shouldSendNonCritical = (this.criticalUpdateFrame % this.nonCriticalUpdateInterval === 0);
      
      for(const entity of filteredPlayerPack) {
        if(!entity || !entity.id) continue;
        
        const player = Player.list[entity.id];
        const isPlayer = player && player.type === 'player';
        const isInCombat = player && player.action === 'combat';
        const hasPath = player && player.path && player.path.length > 0;
        const isFalcon = player && player.class === 'Falcon';
        
        // Critical: players, entities in combat, entities with paths, and falcons (always moving)
        if(isPlayer || isInCombat || hasPath || isFalcon) {
          criticalPlayerPack.push(entity);
        } else if(shouldSendNonCritical) {
          // Non-critical: idle NPCs (sent less frequently)
          nonCriticalPlayerPack.push(entity);
        }
      }
    } else {
      // No frequency optimization - send all entities
      criticalPlayerPack = filteredPlayerPack || [];
    }
    
    // Combine critical and non-critical (non-critical may be empty if not time to send)
    const combinedPlayerPack = [...criticalPlayerPack, ...nonCriticalPlayerPack];
    
    // Apply delta compression to reduce packet size
    let compressedPlayerPack = combinedPlayerPack;
    if(this.deltaCompressionEnabled && combinedPlayerPack) {
      compressedPlayerPack = this.compressEntityPack(combinedPlayerPack, 'player');
    }
    
    const pack = {
      player: compressedPlayerPack,
      arrow: arrowPack,
      item: itemPack,
      light: lightPack,
      building: buildingPack,
      weather: weatherPack
    };
    
    // Track timing data
    this._perfData.playerTimes.push(playerTime);
    this._perfData.arrowTimes.push(arrowTime);
    this._perfData.itemTimes.push(itemTime);
    this._perfData.buildingTimes.push(buildingTime);
    this._perfData.totalTimes.push(totalTime);
    
    // Keep last 300 samples (5 seconds)
    const maxSamples = 300;
    if(this._perfData.playerTimes.length > maxSamples) {
      this._perfData.playerTimes.shift();
      this._perfData.arrowTimes.shift();
      this._perfData.itemTimes.shift();
      this._perfData.buildingTimes.shift();
      this._perfData.totalTimes.shift();
    }
    
    // Analyze packet contents for optimization opportunities
    if(!this._packetAnalysis) {
      this._packetAnalysis = {
        entityCounts: [],
        entityTypeBreakdown: {},
        lastAnalysis: Date.now()
      };
    }
    
    // Track entity counts per update
    const entityCounts = {
      players: playerPack ? playerPack.length : 0,
      arrows: arrowPack ? arrowPack.length : 0,
      items: itemPack ? itemPack.length : 0,
      lights: lightPack ? lightPack.length : 0,
      buildings: buildingPack ? buildingPack.length : 0,
      total: 0
    };
    entityCounts.total = entityCounts.players + entityCounts.arrows + entityCounts.items + 
                         entityCounts.lights + entityCounts.buildings;
    
    this._packetAnalysis.entityCounts.push(entityCounts);
    if(this._packetAnalysis.entityCounts.length > 300) {
      this._packetAnalysis.entityCounts.shift();
    }
    
    // Check packet size and split if needed
    let finalPack = pack;
    const packetString = JSON.stringify({ msg: 'update', pack });
    let packetSize = Buffer.byteLength(packetString, 'utf8');
    
    // If packet is too large, split it across frames
    if(packetSize > this.maxPacketSize && pack.player && Array.isArray(pack.player)) {
      // Split player entities into chunks
      const chunkSize = Math.ceil(pack.player.length / Math.ceil(packetSize / this.maxPacketSize));
      const chunks = [];
      for(let i = 0; i < pack.player.length; i += chunkSize) {
        chunks.push(pack.player.slice(i, i + chunkSize));
      }
      
      // Send first chunk now, queue rest
      if(chunks.length > 0) {
        finalPack = {
          ...pack,
          player: chunks[0],
          _split: chunks.length > 1 ? { total: chunks.length, current: 1 } : undefined
        };
        this.packetSplitQueue = chunks.slice(1).map((chunk, idx) => ({
          ...pack,
          player: chunk,
          _split: { total: chunks.length, current: idx + 2 }
        }));
        packetSize = Buffer.byteLength(JSON.stringify({ msg: 'update', pack: finalPack }), 'utf8');
      }
    }
    
    this.packetSizeHistory.push(packetSize);
    this.totalBytesSent += packetSize;
    this.packetCount++;
    
    // Keep last N packet sizes
    if(this.packetSizeHistory.length > this.maxPacketHistorySize) {
      this.packetSizeHistory.shift();
    }
    
    // Get current time once for all periodic checks
    const now = Date.now();
    
    // Packet analysis logging now happens once per tempus hour (see lambic.js dayNight function)
    
    // Monitor memory usage periodically
    if(now - this.lastMemoryCheck >= this.memoryCheckInterval) {
      if(global.gc) {
        // Force garbage collection if available (requires --expose-gc flag)
        global.gc();
      }
      const memUsage = process.memoryUsage();
      this.memoryHistory.push({
        timestamp: now,
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      });
      this.lastMemoryCheck = now;
      
      // Keep last N memory samples
      if(this.memoryHistory.length > this.maxMemoryHistorySize) {
        this.memoryHistory.shift();
      }
    }
    
    // Performance logging now happens once per tempus hour (see lambic.js dayNight function)
    
    // Send main packet
    this.emit({ msg: 'update', pack: finalPack });
    
    // Send queued split packets if any (one per frame to avoid overwhelming)
    if(this.packetSplitQueue.length > 0) {
      const nextChunk = this.packetSplitQueue.shift();
      this.emit({ msg: 'update', pack: nextChunk });
    }
  }
  
  // Send render updates to clients
  sendRenderUpdates(deltaTime) {
    const renderPack = {
      deltaTime,
      fps: this.performanceOptimizer.fps,
      stats: this.getPerformanceStats()
    };
    
    this.emit({ msg: 'renderUpdate', pack: renderPack });
  }
  
  // Update viewport bounds
  updateViewport() {
    // Get player positions and update viewport
    const players = Object.values(Player.list);
    if (players.length > 0) {
      const avgX = players.reduce((sum, p) => sum + p.x, 0) / players.length;
      const avgY = players.reduce((sum, p) => sum + p.y, 0) / players.length;
      this.performanceOptimizer.updateViewport(avgX, avgY);
    }
  }
  
  // Update frame time history for performance monitoring
  updateFrameTimeHistory(deltaTime) {
    this.frameTimeHistory.push(deltaTime);
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }
  }
  
  // Get performance statistics
  getPerformanceStats() {
    const avgFrameTime = this.frameTimeHistory.length > 0 
      ? this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length 
      : 0;
    const minFrameTime = this.frameTimeHistory.length > 0 ? Math.min(...this.frameTimeHistory) : 0;
    const maxFrameTime = this.frameTimeHistory.length > 0 ? Math.max(...this.frameTimeHistory) : 0;
    
    const avgPacketSize = this.packetSizeHistory.length > 0
      ? this.packetSizeHistory.reduce((a, b) => a + b, 0) / this.packetSizeHistory.length
      : 0;
    const maxPacketSize = this.packetSizeHistory.length > 0 ? Math.max(...this.packetSizeHistory) : 0;
    
    const memUsage = process.memoryUsage();
    const latestMemory = this.memoryHistory.length > 0 
      ? this.memoryHistory[this.memoryHistory.length - 1] 
      : null;
    
    return {
      fps: this.performanceOptimizer.fps,
      avgFrameTime: avgFrameTime.toFixed(2),
      minFrameTime: minFrameTime.toFixed(2),
      maxFrameTime: maxFrameTime.toFixed(2),
      avgPacketSize: (avgPacketSize / 1024).toFixed(2) + ' KB',
      maxPacketSize: (maxPacketSize / 1024).toFixed(2) + ' KB',
      packetCount: this.packetCount,
      memory: {
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB'
      },
      entityStats: this.entityManager.getStats(),
      optimizerStats: this.performanceOptimizer.getStats()
    };
  }
  
  // Get detailed performance metrics for analysis
  getDetailedMetrics() {
    const avg = (arr) => arr.length > 0 ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;
    const max = (arr) => arr.length > 0 ? Math.max(...arr) : 0;
    const p95 = (arr) => {
      if(arr.length === 0) return 0;
      const sorted = [...arr].sort((a,b) => a-b);
      const index = Math.floor(sorted.length * 0.95);
      return sorted[index];
    };
    
    return {
      updateTimes: {
        player: {
          avg: avg(this._perfData ? this._perfData.playerTimes : []),
          max: max(this._perfData ? this._perfData.playerTimes : [])
        },
        total: {
          avg: avg(this._perfData ? this._perfData.totalTimes : []),
          max: max(this._perfData ? this._perfData.totalTimes : []),
          p95: p95(this._perfData ? this._perfData.totalTimes : [])
        }
      },
      packetSizes: {
        avg: avg(this.packetSizeHistory),
        max: max(this.packetSizeHistory),
        p95: p95(this.packetSizeHistory)
      },
      memory: this.memoryHistory,
      frameTimes: {
        avg: avg(this.frameTimeHistory),
        max: max(this.frameTimeHistory),
        p95: p95(this.frameTimeHistory)
      }
    };
  }
  
  // Add entity to optimized management
  addEntity(entity, priority = 'medium') {
    this.entityManager.addEntity(entity, priority);
  }
  
  // Remove entity from management
  removeEntity(entityId) {
    this.entityManager.markForRemoval(entityId);
  }
  
  // Mark entity as needing update
  markEntityDirty(entityId, priority = 'medium') {
    this.performanceOptimizer.markDirty(entityId, priority);
  }
  
  // Compress entity pack by only including changed properties
  compressEntityPack(entityPack, entityType) {
    if(!Array.isArray(entityPack)) return entityPack;
    
    const compressed = [];
    let totalProperties = 0;
    let compressedProperties = 0;
    
    for(const entity of entityPack) {
      if(!entity || !entity.id) {
        compressed.push(entity); // Keep entities without IDs as-is
        continue;
      }
      
      const entityId = entity.id;
      const previousState = this.previousEntityStates.get(entityId);
      
      // Check if this is a falcon (always need position updates for smooth flight)
      const player = Player.list[entityId];
      const isFalcon = player && player.class === 'Falcon';
      
      if(!previousState) {
        // New entity - send full state
        compressed.push(entity);
        this.previousEntityStates.set(entityId, JSON.parse(JSON.stringify(entity)));
        totalProperties += Object.keys(entity).length;
        compressedProperties += Object.keys(entity).length;
      } else {
        // Existing entity - only send changed properties
        const delta = {};
        let hasChanges = false;
        
        for(const key in entity) {
          totalProperties++;
          const currentValue = entity[key];
          const previousValue = previousState[key];
          
          // Fast shallow comparison for primitives and common cases
          if(currentValue !== previousValue) {
            // For objects/arrays, do shallow check first, then deep if needed
            if(typeof currentValue === 'object' && currentValue !== null) {
              // Shallow comparison: check if references are different
              if(typeof previousValue === 'object' && previousValue !== null) {
                // For arrays, check length and first few elements
                if(Array.isArray(currentValue) && Array.isArray(previousValue)) {
                  if(currentValue.length !== previousValue.length) {
                    delta[key] = currentValue;
                    hasChanges = true;
                    compressedProperties++;
                    continue;
                  }
                  // Quick check: compare first 3 elements shallowly
                  let arraysDifferent = false;
                  for(let i = 0; i < Math.min(3, currentValue.length); i++) {
                    if(currentValue[i] !== previousValue[i]) {
                      arraysDifferent = true;
                      break;
                    }
                  }
                  if(arraysDifferent || JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
                    delta[key] = currentValue;
                    hasChanges = true;
                    compressedProperties++;
                  }
                } else {
                  // For objects, do deep comparison only if shallow check suggests difference
                  if(JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
                    delta[key] = currentValue;
                    hasChanges = true;
                    compressedProperties++;
                  }
                }
              } else {
                // Type mismatch
                delta[key] = currentValue;
                hasChanges = true;
                compressedProperties++;
              }
            } else {
              // Primitive value changed
              delta[key] = currentValue;
              hasChanges = true;
              compressedProperties++;
            }
          } else if(isFalcon && (key === 'x' || key === 'y' || key === 'facing')) {
            // For falcons, always include position and facing updates even if unchanged
            // This ensures smooth client-side animation and prevents stuck falcons
            delta[key] = currentValue;
            hasChanges = true;
            compressedProperties++;
          }
        }
        
        if(hasChanges) {
          // Include ID so client knows which entity to update
          delta.id = entityId;
          compressed.push(delta);
          // Update stored state
          this.previousEntityStates.set(entityId, JSON.parse(JSON.stringify(entity)));
        } else if(isFalcon) {
          // Falcons should always be included in updates, even if nothing changed
          // Send minimal update with just ID and position to keep client in sync
          compressed.push({
            id: entityId,
            x: entity.x,
            y: entity.y,
            facing: entity.facing
          });
          // Update stored state to prevent this from happening every frame
          this.previousEntityStates.set(entityId, JSON.parse(JSON.stringify(entity)));
        }
        // If no changes and not a falcon, don't include entity in update (client keeps previous state)
      }
    }
    
    // Clean up states for entities that no longer exist
    const currentEntityIds = new Set(entityPack.map(e => e && e.id).filter(Boolean));
    for(const [entityId] of this.previousEntityStates) {
      if(!currentEntityIds.has(entityId)) {
        this.previousEntityStates.delete(entityId);
      }
    }
    
    return compressed;
  }
  
  // Filter entities based on distance from any player
  spatialFilterEntities(entityPack) {
    if(!Array.isArray(entityPack) || entityPack.length === 0) return entityPack;
    
    // Get all player positions
    const playerPositions = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        playerPositions.push({ x: player.x, y: player.y, z: player.z });
      }
    }
    
    // If no players, send all entities (for initial connection)
    if(playerPositions.length === 0) return entityPack;
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    
    for(const entity of entityPack) {
      if(!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        // Include entities without valid positions (shouldn't happen, but be safe)
        filtered.push(entity);
        continue;
      }
      
      // Check if entity is near any player
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        // Only check distance if on same z-level
        if(entity.z === playerPos.z) {
          const dx = entity.x - playerPos.x;
          const dy = entity.y - playerPos.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if(distanceSquared <= radiusSquared) {
            isNearPlayer = true;
            break;
          }
        }
      }
      
      // Check if this is a falcon (always include falcons regardless of distance - they're flying and should be visible)
      const player = entity.id ? Player.list[entity.id] : null;
      const isFalcon = player && player.class === 'Falcon';
      
      // Always include: player's own entity, entities on different z-levels (for building interiors), and falcons
      if(isNearPlayer || (entity.id && Player.list[entity.id] && Player.list[entity.id].type === 'player') || isFalcon) {
        filtered.push(entity);
      }
    }
    
    return filtered;
  }
}

// Export for use
module.exports = OptimizedGameLoop;
