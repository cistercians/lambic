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
    
    // #region agent log
    // Hypothesis C: Check if battleground NPCs are in playerPack
    if(playerPack && Array.isArray(playerPack)) {
      const bgNPCs = playerPack.filter(e => {
        const p = Player.list[e.id];
        return p && p.type === 'npc' && p.inBattleground && p.battlegroundMatchId;
      });
      if(bgNPCs.length > 0) {
        fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:187',message:'Battleground NPCs in playerPack',data:{totalNPCs:bgNPCs.length,npcIds:bgNPCs.map(e => e.id),totalPackSize:playerPack.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      }
    }
    // #endregion
    
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
        const isNPC = player && player.type === 'npc';
        const isInCombat = player && player.action === 'combat';
        const hasPath = player && player.path && player.path.length > 0;
        const isFalcon = player && player.class === 'Falcon';
        const isBattlegroundNPC = isNPC && player && player.inBattleground && player.battlegroundMatchId;
        
        // Critical: players, entities in combat, entities with paths, falcons, and battleground NPCs (always moving/fighting)
        if(isPlayer || isInCombat || hasPath || isFalcon || isBattlegroundNPC) {
          criticalPlayerPack.push(entity);
        } else if(shouldSendNonCritical) {
          // Non-critical: idle NPCs in main world (sent less frequently)
          nonCriticalPlayerPack.push(entity);
        }
      }
    } else {
      // No frequency optimization - send all entities
      criticalPlayerPack = filteredPlayerPack || [];
    }
    
    // Combine critical and non-critical (non-critical may be empty if not time to send)
    const combinedPlayerPack = [...criticalPlayerPack, ...nonCriticalPlayerPack];
    
    // #region agent log
    // Hypothesis C: Check if battleground NPCs are in final pack sent to clients
    const bgNPCsInFinal = combinedPlayerPack.filter(e => {
      const p = Player.list[e.id];
      return p && p.type === 'npc' && p.inBattleground && p.battlegroundMatchId;
    });
    if(bgNPCsInFinal.length > 0) {
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:249',message:'Battleground NPCs in final pack',data:{npcCount:bgNPCsInFinal.length,npcIds:bgNPCsInFinal.map(e => e.id),totalPackSize:combinedPlayerPack.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion
    
    // Apply delta compression to reduce packet size
    let compressedPlayerPack = combinedPlayerPack;
    if(this.deltaCompressionEnabled && combinedPlayerPack) {
      compressedPlayerPack = this.compressEntityPack(combinedPlayerPack, 'player');
    }
    
    // Filter items by map context (fix innaWoods issue - items from main world shouldn't appear in battlegrounds)
    let filteredItemPack = itemPack;
    if(this.spatialFilteringEnabled && itemPack && Array.isArray(itemPack)) {
      filteredItemPack = this.spatialFilterItems(itemPack);
    }
    
    // Filter buildings by map context (prevent main world buildings from appearing in battlegrounds)
    let filteredBuildingPack = buildingPack;
    if(this.spatialFilteringEnabled && buildingPack && Array.isArray(buildingPack)) {
      filteredBuildingPack = this.spatialFilterBuildings(buildingPack);
    }
    
    // Filter arrows by map context (prevent main world arrows from appearing in battlegrounds)
    let filteredArrowPack = arrowPack;
    if(this.spatialFilteringEnabled && arrowPack && Array.isArray(arrowPack)) {
      filteredArrowPack = this.spatialFilterArrows(arrowPack);
    }
    
    // Filter lights by map context (prevent main world lights from appearing in battlegrounds)
    let filteredLightPack = lightPack;
    if(this.spatialFilteringEnabled && lightPack && Array.isArray(lightPack)) {
      filteredLightPack = this.spatialFilterLights(lightPack);
    }
    
    // Filter weather by map context (weather is typically global, but filter if per-match)
    let filteredWeatherPack = weatherPack;
    if(this.spatialFilteringEnabled && weatherPack) {
      filteredWeatherPack = this.spatialFilterWeather(weatherPack);
    }
    
    const pack = {
      player: compressedPlayerPack,
      arrow: filteredArrowPack,
      item: filteredItemPack,
      light: filteredLightPack,
      building: filteredBuildingPack,
      weather: filteredWeatherPack
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
    
    // Check if any player is in godmode - if so, send all entities (spectator mode should see everything)
    let hasGodModePlayer = false;
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && player.godMode) {
        hasGodModePlayer = true;
        break;
      }
    }
    
    // If any player is in godmode, skip spatial filtering and send all entities
    if(hasGodModePlayer) return entityPack;
    
    // Get all player positions with map context information
    const playerPositions = [];
    let playersWithStaleContext = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        // Check for stale context (player has battleground context but no active match)
        if(player.inBattleground && player.battlegroundMatchId) {
          const hasActiveMatch = global.battlegroundsMatchManager && 
                                 global.battlegroundsMatchManager.currentMatch &&
                                 global.battlegroundsMatchManager.currentMatch.matchId === player.battlegroundMatchId;
          if(!hasActiveMatch) {
            playersWithStaleContext.push({id, matchId: player.battlegroundMatchId});
          }
        }
        
        playerPositions.push({ 
          x: player.x, 
          y: player.y, 
          z: player.z,
          playerId: id,
          inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
          battlegroundMatchId: player.battlegroundMatchId || null
        });
      }
    }
    
    // Log players with stale context (context set but no active match)
    if(playersWithStaleContext.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:702',message:'Players with stale battleground context detected',data:{staleCount:playersWithStaleContext.length,players:playersWithStaleContext,hasMatchManager:!!global.battlegroundsMatchManager,hasCurrentMatch:!!(global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch),currentMatchId:global.battlegroundsMatchManager?.currentMatch?.matchId || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
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
      
      // Get entity's map context
      const entityPlayer = entity.id ? Player.list[entity.id] : null;
      const entityInBattleground = !!(entityPlayer && entityPlayer.inBattleground && entityPlayer.battlegroundMatchId);
      const entityMatchId = entityPlayer ? (entityPlayer.battlegroundMatchId || null) : null;
      
      // CRITICAL: First check map context - entities from different map contexts should NEVER be included
      // This prevents main world entities from appearing in battlegrounds and vice versa
      let hasMatchingMapContext = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && entityInBattleground && playerPos.battlegroundMatchId === entityMatchId) ||
                               (!playerPos.inBattleground && !entityInBattleground);
        if(sameMapContext) {
          hasMatchingMapContext = true;
          break;
        }
      }
      
      // If entity is from a different map context, exclude it immediately (no distance check needed)
      if(!hasMatchingMapContext) {
        continue; // Skip this entity - it's from a different map context
      }
      
      // Check if entity is near any player (only if in same map context)
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        // CRITICAL: Only check distance if on same z-level AND same map context (both in battleground with same matchId, or both in main world)
        const sameMapContext = (playerPos.inBattleground && entityInBattleground && playerPos.battlegroundMatchId === entityMatchId) ||
                               (!playerPos.inBattleground && !entityInBattleground);
        
        if(entity.z === playerPos.z && sameMapContext) {
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
      const isFalcon = entityPlayer && entityPlayer.class === 'Falcon';
      
      // Check if this is an NPC in battleground
      const isBattlegroundNPC = entityPlayer && entityPlayer.type === 'npc' && entityInBattleground;
      
      // #region agent log
      // Hypothesis D: Check if battleground NPCs pass spatial filtering
      if(isBattlegroundNPC && entityPlayer) {
        fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:718',message:'Spatial filter check for NPC',data:{npcId:entity.id,isNearPlayer,entityMatchId,playerPositionsCount:playerPositions.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      }
      // #endregion
      
      // Always include player's own entity (required for movement updates)
      const isOwnEntity = entity.id && Player.list[entity.id] && Player.list[entity.id].type === 'player';
      if(isOwnEntity) {
        // Always include player's own entity regardless of map context (needed for movement)
        filtered.push(entity);
      } else if(isBattlegroundNPC) {
        // For battleground NPCs, check if any player in the same match can see them
        let hasMatchingContext = false;
        for(const playerPos of playerPositions) {
          const sameMapContext = (playerPos.inBattleground && entityInBattleground && playerPos.battlegroundMatchId === entityMatchId);
          if(sameMapContext && entity.z === playerPos.z) {
            const dx = entity.x - playerPos.x;
            const dy = entity.y - playerPos.y;
            const distanceSquared = dx * dx + dy * dy;
            if(distanceSquared <= radiusSquared) {
              hasMatchingContext = true;
              break;
            }
          }
        }
        if(hasMatchingContext) {
          filtered.push(entity);
        }
      } else if(isFalcon) {
        // For falcons, check if any player in same map context
        let hasMatchingContext = false;
        for(const playerPos of playerPositions) {
          const sameMapContext = (playerPos.inBattleground && entityInBattleground && playerPos.battlegroundMatchId === entityMatchId) ||
                                 (!playerPos.inBattleground && !entityInBattleground);
          if(sameMapContext && entity.z === playerPos.z) {
            hasMatchingContext = true;
            break;
          }
        }
        if(hasMatchingContext) {
          filtered.push(entity);
        }
      } else if(isNearPlayer) {
        filtered.push(entity);
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter buildings by map context (prevent main world buildings from appearing in battlegrounds)
   * Buildings from main world should not be sent to battleground clients
   */
  spatialFilterBuildings(buildingPack) {
    if(!Array.isArray(buildingPack) || buildingPack.length === 0) return buildingPack;
    
    // Get all player positions with map context information
    const playerPositions = [];
    let playersWithStaleContext = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        // Check for stale context (player has battleground context but no active match)
        if(player.inBattleground && player.battlegroundMatchId) {
          const hasActiveMatch = global.battlegroundsMatchManager && 
                                 global.battlegroundsMatchManager.currentMatch &&
                                 global.battlegroundsMatchManager.currentMatch.matchId === player.battlegroundMatchId;
          if(!hasActiveMatch) {
            playersWithStaleContext.push({id, matchId: player.battlegroundMatchId});
          }
        }
        
        playerPositions.push({ 
          x: player.x, 
          y: player.y, 
          z: player.z,
          playerId: id,
          inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
          battlegroundMatchId: player.battlegroundMatchId || null
        });
      }
    }
    
    // Log players with stale context (context set but no active match)
    if(playersWithStaleContext.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:702',message:'Players with stale battleground context detected',data:{staleCount:playersWithStaleContext.length,players:playersWithStaleContext,hasMatchManager:!!global.battlegroundsMatchManager,hasCurrentMatch:!!(global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch),currentMatchId:global.battlegroundsMatchManager?.currentMatch?.matchId || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    }
    
    // If no players, send all buildings (for initial connection)
    if(playerPositions.length === 0) return buildingPack;
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    
    for(const building of buildingPack) {
      if(!building || typeof building.x !== 'number' || typeof building.y !== 'number') {
        // Include buildings without valid positions
        filtered.push(building);
        continue;
      }
      
      // Get building's map context from Building.list if available
      const buildingEntity = building.id && global.Building && global.Building.list ? global.Building.list[building.id] : null;
      const buildingInBattleground = !!(buildingEntity && buildingEntity.inBattleground);
      const buildingMatchId = buildingEntity ? (buildingEntity.battlegroundMatchId || null) : null;
      
      // CRITICAL: If building doesn't have map context properties and there are battleground players, exclude it
      // (buildings without inBattleground are assumed to be main world buildings)
      const hasBattlegroundPlayers = playerPositions.some(p => p.inBattleground);
      if(hasBattlegroundPlayers && !buildingInBattleground) {
        continue; // Skip main world buildings for battleground players
      }
      
      // CRITICAL: First check map context - buildings from different map contexts should NEVER be included
      let hasMatchingMapContext = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && buildingInBattleground && playerPos.battlegroundMatchId === buildingMatchId) ||
                               (!playerPos.inBattleground && !buildingInBattleground);
        if(sameMapContext) {
          hasMatchingMapContext = true;
          break;
        }
      }
      
      // If building is from a different map context, exclude it immediately
      if(!hasMatchingMapContext) {
        continue; // Skip this building - it's from a different map context
      }
      
      // Check if building is near any player AND in same map context
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && buildingInBattleground && playerPos.battlegroundMatchId === buildingMatchId) ||
                               (!playerPos.inBattleground && !buildingInBattleground);
        
        if(building.z === playerPos.z && sameMapContext) {
          const dx = building.x - playerPos.x;
          const dy = building.y - playerPos.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if(distanceSquared <= radiusSquared) {
            isNearPlayer = true;
            break;
          }
        }
      }
      
      // Only include buildings that are near a player in the same map context
      if(isNearPlayer) {
        filtered.push(building);
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter items by map context (prevent main world items from appearing in battlegrounds)
   * Items with innaWoods=true from main world should not be sent to battleground clients
   */
  spatialFilterItems(itemPack) {
    if(!Array.isArray(itemPack) || itemPack.length === 0) return itemPack;
    
    // Get all player positions with map context information
    const playerPositions = [];
    let playersWithStaleContext = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        // Check for stale context (player has battleground context but no active match)
        if(player.inBattleground && player.battlegroundMatchId) {
          const hasActiveMatch = global.battlegroundsMatchManager && 
                                 global.battlegroundsMatchManager.currentMatch &&
                                 global.battlegroundsMatchManager.currentMatch.matchId === player.battlegroundMatchId;
          if(!hasActiveMatch) {
            playersWithStaleContext.push({id, matchId: player.battlegroundMatchId});
          }
        }
        
        playerPositions.push({ 
          x: player.x, 
          y: player.y, 
          z: player.z,
          playerId: id,
          inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
          battlegroundMatchId: player.battlegroundMatchId || null
        });
      }
    }
    
    // Log players with stale context (context set but no active match)
    if(playersWithStaleContext.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:702',message:'Players with stale battleground context detected',data:{staleCount:playersWithStaleContext.length,players:playersWithStaleContext,hasMatchManager:!!global.battlegroundsMatchManager,hasCurrentMatch:!!(global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch),currentMatchId:global.battlegroundsMatchManager?.currentMatch?.matchId || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    }
    
    // If no players, send all items (for initial connection)
    if(playerPositions.length === 0) return itemPack;
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    
    for(const item of itemPack) {
      if(!item || typeof item.x !== 'number' || typeof item.y !== 'number') {
        // Include items without valid positions
        filtered.push(item);
        continue;
      }
      
      // Get item's map context from Item.list if available
      const itemEntity = item.id && global.Item && global.Item.list ? global.Item.list[item.id] : null;
      const itemInBattleground = !!(itemEntity && itemEntity.inBattleground);
      const itemMatchId = itemEntity ? (itemEntity.battlegroundMatchId || null) : null;
      
      // CRITICAL: First check map context - items from different map contexts should NEVER be included
      let hasMatchingMapContext = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && itemInBattleground && playerPos.battlegroundMatchId === itemMatchId) ||
                               (!playerPos.inBattleground && !itemInBattleground);
        if(sameMapContext) {
          hasMatchingMapContext = true;
          break;
        }
      }
      
      // If item is from a different map context, exclude it immediately
      if(!hasMatchingMapContext) {
        continue; // Skip this item - it's from a different map context
      }
      
      // Check if item is near any player AND in same map context
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        // CRITICAL: Only check distance if on same z-level AND same map context
        const sameMapContext = (playerPos.inBattleground && itemInBattleground && playerPos.battlegroundMatchId === itemMatchId) ||
                               (!playerPos.inBattleground && !itemInBattleground);
        
        if(item.z === playerPos.z && sameMapContext) {
          const dx = item.x - playerPos.x;
          const dy = item.y - playerPos.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if(distanceSquared <= radiusSquared) {
            isNearPlayer = true;
            break;
          }
        }
      }
      
      // Only include items that are near a player in the same map context
      // This prevents main world items (with innaWoods=true) from appearing in battlegrounds
      if(isNearPlayer) {
        filtered.push(item);
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter arrows by map context (prevent main world arrows from appearing in battlegrounds)
   * Arrows inherit context from their parent entity
   */
  spatialFilterArrows(arrowPack) {
    if(!Array.isArray(arrowPack) || arrowPack.length === 0) return arrowPack;
    
    // Get all player positions with map context information
    const playerPositions = [];
    let playersWithStaleContext = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        // Check for stale context (player has battleground context but no active match)
        if(player.inBattleground && player.battlegroundMatchId) {
          const hasActiveMatch = global.battlegroundsMatchManager && 
                                 global.battlegroundsMatchManager.currentMatch &&
                                 global.battlegroundsMatchManager.currentMatch.matchId === player.battlegroundMatchId;
          if(!hasActiveMatch) {
            playersWithStaleContext.push({id, matchId: player.battlegroundMatchId});
          }
        }
        
        playerPositions.push({ 
          x: player.x, 
          y: player.y, 
          z: player.z,
          playerId: id,
          inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
          battlegroundMatchId: player.battlegroundMatchId || null
        });
      }
    }
    
    // Log players with stale context (context set but no active match)
    if(playersWithStaleContext.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:702',message:'Players with stale battleground context detected',data:{staleCount:playersWithStaleContext.length,players:playersWithStaleContext,hasMatchManager:!!global.battlegroundsMatchManager,hasCurrentMatch:!!(global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch),currentMatchId:global.battlegroundsMatchManager?.currentMatch?.matchId || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    }
    
    // If no players, send all arrows (for initial connection)
    if(playerPositions.length === 0) return arrowPack;
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    
    for(const arrow of arrowPack) {
      if(!arrow || typeof arrow.x !== 'number' || typeof arrow.y !== 'number') {
        // Include arrows without valid positions
        filtered.push(arrow);
        continue;
      }
      
      // Get arrow's map context from parent entity or Arrow.list
      let arrowInBattleground = false;
      let arrowMatchId = null;
      
      // First check if arrow has direct context properties
      if(arrow.inBattleground && arrow.battlegroundMatchId) {
        arrowInBattleground = true;
        arrowMatchId = arrow.battlegroundMatchId;
      } else if(arrow.parent) {
        // Check parent entity for context
        const parentEntity = global.Player && global.Player.list ? global.Player.list[arrow.parent] : null;
        if(parentEntity) {
          arrowInBattleground = !!(parentEntity.inBattleground && parentEntity.battlegroundMatchId);
          arrowMatchId = parentEntity.battlegroundMatchId || null;
        } else if(global.Arrow && global.Arrow.list && global.Arrow.list[arrow.id]) {
          // Check Arrow.list for context
          const arrowEntity = global.Arrow.list[arrow.id];
          arrowInBattleground = !!(arrowEntity.inBattleground && arrowEntity.battlegroundMatchId);
          arrowMatchId = arrowEntity.battlegroundMatchId || null;
        }
      } else if(global.Arrow && global.Arrow.list && global.Arrow.list[arrow.id]) {
        // Check Arrow.list for context
        const arrowEntity = global.Arrow.list[arrow.id];
        arrowInBattleground = !!(arrowEntity.inBattleground && arrowEntity.battlegroundMatchId);
        arrowMatchId = arrowEntity.battlegroundMatchId || null;
      }
      
      // CRITICAL: If arrow doesn't have map context properties and there are battleground players, exclude it
      // (arrows without inBattleground are assumed to be main world arrows)
      const hasBattlegroundPlayers = playerPositions.some(p => p.inBattleground);
      if(hasBattlegroundPlayers && !arrowInBattleground) {
        continue; // Skip main world arrows for battleground players
      }
      
      // CRITICAL: First check map context - arrows from different map contexts should NEVER be included
      let hasMatchingMapContext = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && arrowInBattleground && playerPos.battlegroundMatchId === arrowMatchId) ||
                               (!playerPos.inBattleground && !arrowInBattleground);
        if(sameMapContext) {
          hasMatchingMapContext = true;
          break;
        }
      }
      
      // If arrow is from a different map context, exclude it immediately
      if(!hasMatchingMapContext) {
        continue; // Skip this arrow - it's from a different map context
      }
      
      // Check if arrow is near any player AND in same map context
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && arrowInBattleground && playerPos.battlegroundMatchId === arrowMatchId) ||
                               (!playerPos.inBattleground && !arrowInBattleground);
        
        if(arrow.z === playerPos.z && sameMapContext) {
          const dx = arrow.x - playerPos.x;
          const dy = arrow.y - playerPos.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if(distanceSquared <= radiusSquared) {
            isNearPlayer = true;
            break;
          }
        }
      }
      
      // Only include arrows that are near a player in the same map context
      if(isNearPlayer) {
        filtered.push(arrow);
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter lights by map context (prevent main world lights from appearing in battlegrounds)
   */
  spatialFilterLights(lightPack) {
    if(!Array.isArray(lightPack) || lightPack.length === 0) return lightPack;
    
    // Get all player positions with map context information
    const playerPositions = [];
    let playersWithStaleContext = [];
    for(const id in Player.list) {
      const player = Player.list[id];
      if(player && player.type === 'player' && typeof player.x === 'number' && typeof player.y === 'number') {
        // Check for stale context (player has battleground context but no active match)
        if(player.inBattleground && player.battlegroundMatchId) {
          const hasActiveMatch = global.battlegroundsMatchManager && 
                                 global.battlegroundsMatchManager.currentMatch &&
                                 global.battlegroundsMatchManager.currentMatch.matchId === player.battlegroundMatchId;
          if(!hasActiveMatch) {
            playersWithStaleContext.push({id, matchId: player.battlegroundMatchId});
          }
        }
        
        playerPositions.push({ 
          x: player.x, 
          y: player.y, 
          z: player.z,
          playerId: id,
          inBattleground: !!(player.inBattleground && player.battlegroundMatchId),
          battlegroundMatchId: player.battlegroundMatchId || null
        });
      }
    }
    
    // Log players with stale context (context set but no active match)
    if(playersWithStaleContext.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'OptimizedGameLoop.js:702',message:'Players with stale battleground context detected',data:{staleCount:playersWithStaleContext.length,players:playersWithStaleContext,hasMatchManager:!!global.battlegroundsMatchManager,hasCurrentMatch:!!(global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch),currentMatchId:global.battlegroundsMatchManager?.currentMatch?.matchId || null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
    }
    
    // If no players, send all lights (for initial connection)
    if(playerPositions.length === 0) return lightPack;
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    
    for(const light of lightPack) {
      if(!light || typeof light.x !== 'number' || typeof light.y !== 'number') {
        // Include lights without valid positions
        filtered.push(light);
        continue;
      }
      
      // Get light's map context from Light.list if available
      const lightEntity = light.id && global.Light && global.Light.list ? global.Light.list[light.id] : null;
      const lightInBattleground = !!(lightEntity && lightEntity.inBattleground);
      const lightMatchId = lightEntity ? (lightEntity.battlegroundMatchId || null) : null;
      
      // CRITICAL: If light doesn't have map context properties and there are battleground players, exclude it
      // (lights without inBattleground are assumed to be main world lights)
      const hasBattlegroundPlayers = playerPositions.some(p => p.inBattleground);
      if(hasBattlegroundPlayers && !lightInBattleground) {
        continue; // Skip main world lights for battleground players
      }
      
      // CRITICAL: First check map context - lights from different map contexts should NEVER be included
      let hasMatchingMapContext = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && lightInBattleground && playerPos.battlegroundMatchId === lightMatchId) ||
                               (!playerPos.inBattleground && !lightInBattleground);
        if(sameMapContext) {
          hasMatchingMapContext = true;
          break;
        }
      }
      
      // If light is from a different map context, exclude it immediately
      if(!hasMatchingMapContext) {
        continue; // Skip this light - it's from a different map context
      }
      
      // Check if light is near any player AND in same map context
      let isNearPlayer = false;
      for(const playerPos of playerPositions) {
        const sameMapContext = (playerPos.inBattleground && lightInBattleground && playerPos.battlegroundMatchId === lightMatchId) ||
                               (!playerPos.inBattleground && !lightInBattleground);
        
        if(light.z === playerPos.z && sameMapContext) {
          const dx = light.x - playerPos.x;
          const dy = light.y - playerPos.y;
          const distanceSquared = dx * dx + dy * dy;
          
          if(distanceSquared <= radiusSquared) {
            isNearPlayer = true;
            break;
          }
        }
      }
      
      // Only include lights that are near a player in the same map context
      if(isNearPlayer) {
        filtered.push(light);
      }
    }
    
    return filtered;
  }
  
  /**
   * Filter weather by map context (weather is typically global, but filter if per-match)
   * For now, weather is usually global, so we just return it as-is unless it has match-specific data
   */
  spatialFilterWeather(weatherPack) {
    // Weather is typically global, not per-match
    // If weather becomes match-specific in the future, add filtering here
    // For now, just return as-is
    return weatherPack;
  }
}

// Export for use
module.exports = OptimizedGameLoop;
