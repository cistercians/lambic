// Optimized Game Loop
const PerformanceOptimizer = require('./PerformanceOptimizer.js');
const OptimizedEntityManager = require('./OptimizedEntityManager.js');
const mapContextHelpers = require('./MapContextHelpers.js');
const dependencyInjector = require('./DependencyInjector');
const metrics = require('./MetricsRegistry');

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
    this.lastUpdatePack = null;
    this.lastUpdatePackTime = 0;
    
    // Memory monitoring
    this.memoryHistory = [];
    this.maxMemoryHistorySize = 60; // Keep 1 minute of history (1 sample per second)
    this.lastMemoryCheck = Date.now();
    this.memoryCheckInterval = 1000; // Check memory every second

    // Context observability
    this.contextStatsIntervalMs = 30000; // 30 seconds
    this.lastContextStatsLog = 0;
    this.staleContextCleanupIntervalMs = 10000; // 10 seconds
    this.lastStaleContextCleanup = 0;

    // Error tracking and throttled logging
    this._errorStats = {
      byContext: {},
      logIntervalMs: 5000
    };
    
    // Delta compression: Track previous entity states
    this.previousEntityStates = new Map(); // entityId -> previous update pack
    this.deltaCompressionEnabled = true;
    
    // Spatial filtering: Filter entities based on distance from players
    this.spatialFilteringEnabled = true;
    this.spatialFilterRadius = 1500; // Send entities within 1500 pixels of any player (viewport is ~1000 pixels)
    this.spatialPartitionSize = 512; // Spatial bucket size for proximity queries
    
    // Update frequency optimization: Send non-critical updates less frequently
    this.updateFrequencyOptimization = true;
    this.criticalUpdateFrame = 0; // Track frames for update frequency
    this.nonCriticalUpdateInterval = 2; // Send non-critical updates every 2nd frame (30 FPS instead of 60)
    
    // Packet size limits
    this.maxPacketSize = 20 * 1024; // 20KB max packet size
    this.packetSplitQueue = []; // Queue for split packets
    this.lastUpdatePackByContext = new Map();
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
    const tilemapSystem = this.resolveOptional('tilemapSystem');
    if (tilemapSystem && tilemapSystem.pathfindingSystem) {
      const pathfindingStart = Date.now();
      this.safeCall('pathfinding.processQueue', () => {
        tilemapSystem.pathfindingSystem.processPathfindingQueue();
      });
      const pathfindingTime = Date.now() - pathfindingStart;
      
      // If pathfinding took too long, skip non-critical updates
      if (pathfindingTime > frameBudget * 0.3) {
        // Pathfinding is taking too much time, defer some work
      }
    }
    
    // Update game state
    if (this.gameState) {
      this.safeCall('gameState.updateTime', () => this.gameState.updateTime());
    }
    
    // Check frame budget before continuing
    const elapsed = Date.now() - frameStartTime;
    const remainingBudget = frameBudget - elapsed;
    
    
    // Update social system (check for spontaneous NPC conversations)
    // Only if we have budget remaining (social updates are lower priority)
    const socialSystem = this.resolveOptional('socialSystem');
    if (socialSystem && remainingBudget > frameBudget * 0.2) {
      this.safeCall('socialSystem.update', () => socialSystem.update());
    }
    
    // Send updates to clients (always do this, but may be reduced if over budget)
    this.safeCall('sendUpdates', () => this.sendUpdates());
    
    // Clear dirty flags
    this.performanceOptimizer.clearDirty();
    
  }
  
  // Variable timestep update (rendering)
  renderUpdate(deltaTime) {
    // Update viewport based on player position
    this.safeCall('updateViewport', () => this.updateViewport());
    
    // Send render updates to clients
    this.safeCall('sendRenderUpdates', () => this.sendRenderUpdates(deltaTime));
  }

  // Throttled error logging per context to keep the loop resilient
  logError(context, error) {
    const now = Date.now();
    const safeContext = String(context).replace(/[^a-zA-Z0-9_.-]/g, '_');
    metrics.increment('gameLoop.errors');
    metrics.increment(`gameLoop.errors.${safeContext}`);
    metrics.setGauge('gameLoop.lastErrorAt', now);

    if (!this._errorStats.byContext[context]) {
      this._errorStats.byContext[context] = { count: 0, lastLog: 0 };
    }

    const stats = this._errorStats.byContext[context];
    stats.count += 1;

    if (now - stats.lastLog >= this._errorStats.logIntervalMs) {
      stats.lastLog = now;
      const message = error && error.stack ? error.stack : String(error);
      console.error(`[OptimizedGameLoop] ${context} error (count=${stats.count}):`, message);
    }
  }

  // Execute a function safely and return a fallback on failure
  safeCall(context, fn, fallback) {
    try {
      return fn();
    } catch (error) {
      this.logError(context, error);
      return fallback;
    }
  }

  resolveOptional(name) {
    try {
      return dependencyInjector.resolve(name);
    } catch (error) {
      return null;
    }
  }
  
  // Send game updates to clients
  sendUpdates() {
    this.safeCall('cleanupStaleContextEntities', () => this.cleanupStaleContextEntities());
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
    const playerPack = this.safeCall('Player.update', () => Player.update(), []);
    const playerTime = Date.now() - t1;
    
    // #region agent log
    // Hypothesis C: Check if battleground NPCs are in playerPack
    if(playerPack && Array.isArray(playerPack)) {
      const bgNPCs = playerPack.filter(e => {
        const p = Player.list[e.id];
        return p && p.type === 'npc' && p.inBattleground && p.battlegroundMatchId;
      });
      if(bgNPCs.length > 0) {
      }
    }
    // #endregion
    
    const t2 = Date.now();
    const arrowPack = this.safeCall('Arrow.update', () => Arrow.update(), []);
    const arrowTime = Date.now() - t2;
    
    const t3 = Date.now();
    const itemPack = this.safeCall('Item.update', () => Item.update(), []);
    const itemTime = Date.now() - t3;
    const debugNow = Date.now();
    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    if (!global._debugTorchLogTimes.itemPack || debugNow - global._debugTorchLogTimes.itemPack > 2000) {
      global._debugTorchLogTimes.itemPack = debugNow;
      // #region agent log
      // #endregion
    }
    
    const t4 = Date.now();
    const lightPack = this.safeCall('Light.update', () => Light.update(), []);
    const lightTime = Date.now() - t4;
    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    if (!global._debugTorchLogTimes.lightPack || debugNow - global._debugTorchLogTimes.lightPack > 2000) {
      global._debugTorchLogTimes.lightPack = debugNow;
      const lightZCounts = { '-1': 0, '0': 0, other: 0 };
      if (Array.isArray(lightPack)) {
        for (const light of lightPack) {
          if (!light || typeof light.z !== 'number') continue;
          if (light.z === -1) lightZCounts['-1']++;
          else if (light.z === 0) lightZCounts['0']++;
          else lightZCounts.other++;
        }
      }
      // #region agent log
      // #endregion
    }
    
    
    const t5 = Date.now();
    const buildingPack = this.safeCall('Building.update', () => Building.update(), []);
    const buildingTime = Date.now() - t5;
    
    const t6 = Date.now();
    const cameraPack = this.safeCall('Camera.update', () => Camera.update(), []);
    const cameraTime = Date.now() - t6;

    const t7 = Date.now();
    const weatherPack = this.safeCall('Weather.getAllUpdatePack', () => Weather.getAllUpdatePack(), []);
    const weatherTime = Date.now() - t7;
    
    const totalTime = Date.now() - startTotal;
    metrics.recordTiming('gameLoop.updateFrameMs', totalTime);
    
    const socketList = global.SOCKET_LIST || {};
    const socketsByContext = new Map();
    for (const socketId in socketList) {
      const socket = socketList[socketId];
      if (!socket || typeof socket.write !== 'function') continue;
      const player = Player.list ? Player.list[socketId] : null;
      const contextKey = player && player.inBattleground && player.battlegroundMatchId
        ? String(player.battlegroundMatchId)
        : 'main';
      if (!socketsByContext.has(contextKey)) {
        socketsByContext.set(contextKey, []);
      }
      socketsByContext.get(contextKey).push(socket);
    }

    const viewerAnchors = Camera.getViewerAnchors();
    const viewerGroups = this.groupViewerAnchorsByContext(viewerAnchors);
    for (const [contextKey] of socketsByContext) {
      if (!viewerGroups.has(contextKey)) {
        viewerGroups.set(contextKey, {
          key: contextKey,
          inBattleground: contextKey !== 'main',
          matchId: contextKey !== 'main' ? contextKey : null,
          viewers: []
        });
      }
    }
    const contextPacks = new Map();
    const contextPacketStrings = new Map();
    const contextPacketSizes = new Map();
    const contextSplitQueue = [];
    const filteredEntityCounts = {
      players: 0,
      arrows: 0,
      items: 0,
      lights: 0,
      buildings: 0,
      weather: 0,
      total: 0
    };
    
    for (const [contextKey, group] of viewerGroups) {
      const viewers = group.viewers;
      const hasViewers = viewers && viewers.length > 0;
    // Build context-filtered pack first
    let overallPlayerPack = playerPack;
    if (playerPack) {
      overallPlayerPack = this.filterPlayerPackByContext(playerPack, group);
    }

    // Determine in-view vs out-of-view for send-side throttling
    let inViewPlayerPack = overallPlayerPack || [];
    if (this.spatialFilteringEnabled && overallPlayerPack && hasViewers) {
      inViewPlayerPack = this.spatialFilterEntities(overallPlayerPack, viewers);
    }

    let outOfViewPlayerPack = [];
    if (overallPlayerPack && inViewPlayerPack) {
      const inViewIds = new Set(inViewPlayerPack.map(entity => entity && entity.id).filter(Boolean));
      outOfViewPlayerPack = overallPlayerPack.filter(entity => entity && !inViewIds.has(entity.id));
    }

    // Separate critical (in-view) and non-critical (out-of-view) updates
    let criticalPlayerPack = [];
    let nonCriticalPlayerPack = [];

    if (this.updateFrequencyOptimization && overallPlayerPack) {
      const shouldSendNonCritical = (this.criticalUpdateFrame % this.nonCriticalUpdateInterval === 0);
      criticalPlayerPack = inViewPlayerPack || [];
      if (shouldSendNonCritical && outOfViewPlayerPack.length > 0) {
        nonCriticalPlayerPack = outOfViewPlayerPack;
      }
    } else {
      // No frequency optimization - send all context-matched entities
      criticalPlayerPack = overallPlayerPack || [];
    }
    
    // Combine critical and non-critical (non-critical may be empty if not time to send)
    const combinedPlayerPack = [...criticalPlayerPack, ...nonCriticalPlayerPack];
    
    // Apply delta compression to reduce packet size
    let compressedPlayerPack = combinedPlayerPack;
    if(this.deltaCompressionEnabled && combinedPlayerPack) {
        compressedPlayerPack = this.compressEntityPack(combinedPlayerPack, 'player', { skipCleanup: true });
    }
    
    // Filter items by map context (fix innaWoods issue - items from main world shouldn't appear in battlegrounds)
    let filteredItemPack = itemPack;
      if(this.spatialFilteringEnabled && itemPack && Array.isArray(itemPack) && hasViewers) {
        filteredItemPack = this.spatialFilterItems(itemPack, viewers, group);
      } else if (itemPack && Array.isArray(itemPack)) {
        filteredItemPack = this.spatialFilterItems(itemPack, null, group);
    }
    
    // Filter buildings by map context (prevent main world buildings from appearing in battlegrounds)
    let filteredBuildingPack = buildingPack;
      if(this.spatialFilteringEnabled && buildingPack && Array.isArray(buildingPack) && hasViewers) {
        filteredBuildingPack = this.spatialFilterBuildings(buildingPack, viewers, group);
      } else if (buildingPack && Array.isArray(buildingPack)) {
        filteredBuildingPack = this.spatialFilterBuildings(buildingPack, null, group);
    }
    
    // Filter arrows by map context (prevent main world arrows from appearing in battlegrounds)
    let filteredArrowPack = arrowPack;
      if(this.spatialFilteringEnabled && arrowPack && Array.isArray(arrowPack) && hasViewers) {
        filteredArrowPack = this.spatialFilterArrows(arrowPack, viewers, group);
      } else if (arrowPack && Array.isArray(arrowPack)) {
        filteredArrowPack = this.spatialFilterArrows(arrowPack, null, group);
    }
    
    // Filter lights by map context (prevent main world lights from appearing in battlegrounds)
    let filteredLightPack = lightPack;
      if(this.spatialFilteringEnabled && lightPack && Array.isArray(lightPack) && hasViewers) {
        filteredLightPack = this.spatialFilterLights(lightPack, viewers, group);
      } else if (lightPack && Array.isArray(lightPack)) {
        filteredLightPack = this.spatialFilterLights(lightPack, null, group);
    }
    
    // Filter weather by map context (weather is typically global, but filter if per-match)
    let filteredWeatherPack = weatherPack;
      if(this.spatialFilteringEnabled && weatherPack && hasViewers) {
        filteredWeatherPack = this.spatialFilterWeather(weatherPack, viewers);
      } else if (weatherPack) {
        filteredWeatherPack = this.spatialFilterWeather(weatherPack, null);
      }
    
      const filteredCameraPack = this.filterCameraPackByContext(cameraPack, group);
    
    const pack = {
      player: compressedPlayerPack,
      arrow: filteredArrowPack,
      item: filteredItemPack,
      light: filteredLightPack,
      building: filteredBuildingPack,
      weather: filteredWeatherPack,
        camera: filteredCameraPack
      };
      
      let finalPack = pack;
      let packetString = this.safeCall('packet.stringify', () => JSON.stringify({ msg: 'update', pack }), '');
      let packetSize = packetString ? Buffer.byteLength(packetString, 'utf8') : 0;
      
      // If packet is too large, split it across frames
      if(packetSize > this.maxPacketSize && pack.player && Array.isArray(pack.player)) {
        const chunkSize = Math.ceil(pack.player.length / Math.ceil(packetSize / this.maxPacketSize));
        const chunks = [];
        for(let i = 0; i < pack.player.length; i += chunkSize) {
          chunks.push(pack.player.slice(i, i + chunkSize));
        }
        
        if(chunks.length > 0) {
          finalPack = {
            ...pack,
            player: chunks[0],
            _split: chunks.length > 1 ? { total: chunks.length, current: 1 } : undefined
          };
          if (chunks.length > 1) {
            for (let i = 1; i < chunks.length; i++) {
              contextSplitQueue.push({
                contextKey,
                pack: {
                  ...pack,
                  player: chunks[i],
                  _split: { total: chunks.length, current: i + 1 }
                }
              });
            }
          }
          packetString = this.safeCall('packet.stringify', () => JSON.stringify({ msg: 'update', pack: finalPack }), '');
          packetSize = packetString ? Buffer.byteLength(packetString, 'utf8') : 0;
        }
      }
      
      contextPacks.set(contextKey, finalPack);
      contextPacketStrings.set(contextKey, packetString);
      contextPacketSizes.set(contextKey, packetSize);
      
      filteredEntityCounts.players += finalPack.player ? finalPack.player.length : 0;
      filteredEntityCounts.arrows += finalPack.arrow ? finalPack.arrow.length : 0;
      filteredEntityCounts.items += finalPack.item ? finalPack.item.length : 0;
      filteredEntityCounts.lights += finalPack.light ? finalPack.light.length : 0;
      filteredEntityCounts.buildings += finalPack.building ? finalPack.building.length : 0;
      filteredEntityCounts.weather += finalPack.weather ? finalPack.weather.length : 0;
    }
    
    filteredEntityCounts.total = filteredEntityCounts.players + filteredEntityCounts.arrows +
                                 filteredEntityCounts.items + filteredEntityCounts.lights +
                                 filteredEntityCounts.buildings + filteredEntityCounts.weather;
    
    if (this.deltaCompressionEnabled && playerPack) {
      this.cleanupCompressionState(playerPack);
    }
    
    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    if (!global._debugTorchLogTimes.itemPackFiltered || debugNow - global._debugTorchLogTimes.itemPackFiltered > 2000) {
      global._debugTorchLogTimes.itemPackFiltered = debugNow;
      // #region agent log
      // #endregion
    }
    if (!global._debugTorchLogTimes.lightPackFiltered || debugNow - global._debugTorchLogTimes.lightPackFiltered > 2000) {
      global._debugTorchLogTimes.lightPackFiltered = debugNow;
      // #region agent log
      // #endregion
    }
    
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

    // Track viewer/filter stats for observability
    if(!this._viewerStats) {
      this._viewerStats = {
        viewerCounts: [],
        filteredEntityCounts: [],
        lastLog: Date.now(),
        logInterval: 30000 // 30 seconds
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

    // Track viewer and filtered entity stats
    const viewerCount = Camera ? Object.keys(Camera.list).length : 0;

    this._viewerStats.viewerCounts.push(viewerCount);
    this._viewerStats.filteredEntityCounts.push(filteredEntityCounts);

    // Keep last 60 samples (1 minute at 60 FPS)
    const maxViewerSamples = 60;
    if(this._viewerStats.viewerCounts.length > maxViewerSamples) {
      this._viewerStats.viewerCounts.shift();
      this._viewerStats.filteredEntityCounts.shift();
    }
    
    // Update packet stats for this frame
    if (contextSplitQueue.length > 0) {
      this.packetSplitQueue.push(...contextSplitQueue);
    }
    
    let totalPacketBytes = 0;
    let packetCountThisFrame = 0;
    for (const packetSize of contextPacketSizes.values()) {
      totalPacketBytes += packetSize;
      packetCountThisFrame++;
    }
    metrics.setGauge('gameLoop.lastPacketBytes', totalPacketBytes);
    
    this.packetSizeHistory.push(totalPacketBytes);
    this.totalBytesSent += totalPacketBytes;
    this.packetCount += packetCountThisFrame;
    
    // Keep last N packet sizes
    if(this.packetSizeHistory.length > this.maxPacketHistorySize) {
      this.packetSizeHistory.shift();
    }
    
    // Get current time once for all periodic checks
    const now = Date.now();
    this.lastUpdatePackByContext = new Map(contextPacks);
    this.lastUpdatePack = contextPacks.get('main') || null;
    this.lastUpdatePackTime = now;
    
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
    
    // CRITICAL: Validate context isolation before sending packets
    // Check each player's context and validate their update pack
    const validationConfig = global.contextValidationConfig || { enabled: true, enforce: false };
    const contextValidationCache = new Map();
    if (mapContextHelpers && validationConfig.enabled) {
      for (const [contextKey, pack] of contextPacks) {
        const matchId = contextKey === 'main' ? null : contextKey;
        const validation = mapContextHelpers.validateContextIsolation(pack, matchId);
        contextValidationCache.set(contextKey, validation);
        if (!validation.valid && validation.issues.length > 0) {
          const typeCounts = {};
          for (const issue of validation.issues) {
            const type = typeof issue === 'string' ? issue.split(' ')[0] : 'Unknown';
            typeCounts[type] = (typeCounts[type] || 0) + 1;
            if (metrics && typeof metrics.increment === 'function') {
              const typeKey = String(type).toLowerCase();
              metrics.increment(`contextIsolation.violation.${typeKey}`);
            }
          }
          if (metrics && typeof metrics.increment === 'function') {
            metrics.increment('contextIsolation.violation.total');
          }
            console.warn(`[OptimizedGameLoop] Context isolation violation`, {
            matchId,
              issueCount: validation.issues.length,
            issues: validation.issues,
            typeCounts
          });
        }
      }
    }

    // Periodic context stats for observability
    const statsNow = Date.now();
    if (statsNow - this.lastContextStatsLog >= this.contextStatsIntervalMs) {
      this.lastContextStatsLog = statsNow;
      const stats = {
        playersMain: 0,
        playersBattleground: 0,
        itemsMain: 0,
        itemsBattleground: 0,
        buildingsMain: 0,
        buildingsBattleground: 0
      };

      for (const id in Player.list) {
        const player = Player.list[id];
        if (player && player.type === 'player') {
          const isBG = mapContextHelpers ? mapContextHelpers.isInBattleground(player) : !!(player.inBattleground && player.battlegroundMatchId);
          if (isBG) {
            stats.playersBattleground += 1;
          } else {
            stats.playersMain += 1;
          }
        }
      }

      if (global.Item && global.Item.list) {
        for (const id in global.Item.list) {
          const item = global.Item.list[id];
          if (!item) continue;
          const isBG = mapContextHelpers ? mapContextHelpers.isInBattleground(item) : !!(item.inBattleground && item.battlegroundMatchId);
          if (isBG) {
            stats.itemsBattleground += 1;
          } else {
            stats.itemsMain += 1;
          }
        }
      }

      if (global.Building && global.Building.list) {
        for (const id in global.Building.list) {
          const building = global.Building.list[id];
          if (!building) continue;
          const isBG = mapContextHelpers ? mapContextHelpers.isInBattleground(building) : !!(building.inBattleground && building.battlegroundMatchId);
          if (isBG) {
            stats.buildingsBattleground += 1;
          } else {
            stats.buildingsMain += 1;
          }
        }
      }

    }

    // Send per-context packets to connected sockets
    
    const sendPayloadToSockets = (sockets, payload) => {
      if (!sockets || sockets.length === 0 || !payload) return;
      for (const socket of sockets) {
        try {
          socket.write(payload);
        } catch (error) {
          // Ignore send errors; cleanup handled elsewhere
        }
      }
    };
    
    for (const [contextKey, sockets] of socketsByContext) {
      const pack = contextPacks.get(contextKey) || contextPacks.get('main');
      if (!pack) continue;
      const validationKey = contextPacks.has(contextKey) ? contextKey : 'main';
      const validation = contextValidationCache.get(validationKey);
      if (validationConfig.enforce && validation && !validation.valid && validation.issues.length > 0) {
        for (const socket of sockets) {
          try {
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: '<i>Context isolation violation detected. Disconnecting.</i>'
            }));
          } catch (error) {
          }
          if (socket && typeof socket.close === 'function') {
            try { socket.close(); } catch (e) {}
          } else if (socket && typeof socket.end === 'function') {
            try { socket.end(); } catch (e) {}
          }
        }
        continue;
      }
      
      let payload = contextPacketStrings.get(contextKey);
      if (!payload && validationKey !== contextKey) {
        payload = contextPacketStrings.get(validationKey);
      }
      if (!payload) {
        payload = this.safeCall('packet.stringify', () => JSON.stringify({ msg: 'update', pack }), '');
      }
      sendPayloadToSockets(sockets, payload);
    }
    
    // Send queued split packets if any (one per frame to avoid overwhelming)
    if(this.packetSplitQueue.length > 0) {
      const nextChunk = this.packetSplitQueue.shift();
      if (nextChunk && nextChunk.pack) {
        const sockets = socketsByContext.get(nextChunk.contextKey) || socketsByContext.get('main');
        if (sockets && sockets.length > 0) {
          const payload = this.safeCall('packet.stringify', () => JSON.stringify({ msg: 'update', pack: nextChunk.pack }), '');
          sendPayloadToSockets(sockets, payload);
        }
      }
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

  getContextIsolationReport(matchId = null) {
    const contextKey = matchId ? String(matchId) : 'main';
    const pack = this.lastUpdatePackByContext && this.lastUpdatePackByContext.get
      ? this.lastUpdatePackByContext.get(contextKey)
      : this.lastUpdatePack;
    if (!pack || !mapContextHelpers) {
      return { valid: true, issues: [], hasPack: !!pack };
    }
    return mapContextHelpers.validateContextIsolation(pack, matchId);
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
  compressEntityPack(entityPack, entityType, options = {}) {
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
    
    if (!options.skipCleanup) {
    // Clean up states for entities that no longer exist
    const currentEntityIds = new Set(entityPack.map(e => e && e.id).filter(Boolean));
    for(const [entityId] of this.previousEntityStates) {
      if(!currentEntityIds.has(entityId)) {
        this.previousEntityStates.delete(entityId);
        }
      }
    }
    
    return compressed;
  }
  
  cleanupCompressionState(entityPack) {
    if(!Array.isArray(entityPack)) return;
    const currentEntityIds = new Set(entityPack.map(e => e && e.id).filter(Boolean));
    for (const [entityId] of this.previousEntityStates) {
      if (!currentEntityIds.has(entityId)) {
        this.previousEntityStates.delete(entityId);
      }
    }
  }
  
  buildContextKey(context) {
    if (context && context.inBattleground && context.battlegroundMatchId) {
      return String(context.battlegroundMatchId);
    }
    return 'main';
  }
  
  groupViewerAnchorsByContext(viewerAnchors) {
    const groups = new Map();
    if (!Array.isArray(viewerAnchors) || viewerAnchors.length === 0) {
      return groups;
    }
    for (const viewer of viewerAnchors) {
      let contextMatchId = viewer && viewer.context ? viewer.context.battlegroundMatchId : null;
      let contextInBG = viewer && viewer.context ? !!viewer.context.inBattleground : false;
      
      if (viewer && viewer.ownerPlayerId && global.Player && global.Player.list) {
        const owner = global.Player.list[viewer.ownerPlayerId];
        if (owner) {
          const ownerInBG = !!(owner.inBattleground && owner.battlegroundMatchId);
          contextInBG = ownerInBG;
          contextMatchId = ownerInBG ? owner.battlegroundMatchId : null;
        }
      }
      
      const normalizedViewer = viewer || {};
      normalizedViewer.inBattleground = contextInBG;
      normalizedViewer.battlegroundMatchId = contextMatchId;
      if (!normalizedViewer.context) {
        normalizedViewer.context = contextInBG
          ? { inBattleground: true, battlegroundMatchId: contextMatchId }
          : null;
      }
      
      const key = contextInBG && contextMatchId ? String(contextMatchId) : 'main';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          inBattleground: key !== 'main',
          matchId: key !== 'main' ? key : null,
          viewers: []
        });
      }
      groups.get(key).viewers.push(normalizedViewer);
    }
    return groups;
  }
  
  filterCameraPackByContext(cameraPack, contextInfo) {
    if (!Array.isArray(cameraPack) || !contextInfo) return cameraPack;
    const wantBattleground = !!contextInfo.inBattleground;
    const matchId = contextInfo.matchId || null;
    return cameraPack.filter((camera) => {
      const cameraContext = camera && camera.context ? camera.context : null;
      const cameraInBG = !!(cameraContext && cameraContext.inBattleground && cameraContext.battlegroundMatchId);
      const cameraMatchId = cameraContext ? (cameraContext.battlegroundMatchId || null) : null;
      if (wantBattleground) {
        return cameraInBG && cameraMatchId === matchId;
      }
      return !cameraInBG;
    });
  }

  filterPlayerPackByContext(playerPack, contextInfo) {
    if (!Array.isArray(playerPack) || !contextInfo) return playerPack;
    const matchId = contextInfo.matchId || null;
    return playerPack.filter((entity) => {
      if (!entity || entity.id === undefined) return false;
      const playerEntity = Player.list ? Player.list[entity.id] : null;
      if (!playerEntity) return false;
      const isBG = !!(playerEntity.inBattleground && playerEntity.battlegroundMatchId);
      if (contextInfo.inBattleground) {
        return isBG && playerEntity.battlegroundMatchId === matchId;
      }
      return !isBG;
    });
  }
  
  // Filter entities based on distance from any viewer/camera
  spatialFilterEntities(entityPack, viewerAnchorsOverride) {
    if(!Array.isArray(entityPack) || entityPack.length === 0) return entityPack;

    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();

    // If no viewers, send all entities (for initial connection)
    if(viewerAnchors.length === 0) return entityPack;
    
    const filtered = [];
    const includedIds = new Set();
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    const partitionSize = this.spatialPartitionSize || 512;
    const buckets = new Map();
    const unpositioned = [];

    // Always include the viewer's own player entity, regardless of camera z.
    // This prevents camera z from getting "stuck" and blocking the player's z updates.
    const ownerIds = new Set();
    for (const viewer of viewerAnchors) {
      if (viewer && viewer.ownerPlayerId) {
        ownerIds.add(viewer.ownerPlayerId);
      }
    }

    for (const entity of entityPack) {
      if (entity && entity.id !== undefined && ownerIds.has(entity.id)) {
        includedIds.add(entity.id);
        filtered.push(entity);
        continue;
      }
      if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        unpositioned.push(entity);
        continue;
      }
      const key = `${Math.floor(entity.x / partitionSize)},${Math.floor(entity.y / partitionSize)},${entity.z}`;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(entity);
    }

    filtered.push(...unpositioned);

    for (const viewer of viewerAnchors) {
      const minX = Math.floor((viewer.x - this.spatialFilterRadius) / partitionSize);
      const maxX = Math.floor((viewer.x + this.spatialFilterRadius) / partitionSize);
      const minY = Math.floor((viewer.y - this.spatialFilterRadius) / partitionSize);
      const maxY = Math.floor((viewer.y + this.spatialFilterRadius) / partitionSize);

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy},${viewer.z}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;

          for (const entity of bucket) {
            const entityId = entity && entity.id !== undefined ? entity.id : null;
            if (!entity || (entityId !== null && includedIds.has(entityId))) continue;
            const entityPlayer = entity.id ? Player.list[entity.id] : null;
            const entityInBattleground = entityPlayer
              ? (mapContextHelpers ? mapContextHelpers.isInBattleground(entityPlayer) : !!(entityPlayer.inBattleground && entityPlayer.battlegroundMatchId))
              : false;
            const entityMatchId = entityPlayer ? (entityPlayer.battlegroundMatchId || null) : null;

            // Always include player's own entity if this viewer belongs to a player
            if (entityPlayer && viewer.ownerPlayerId && entityPlayer.id === viewer.ownerPlayerId) {
              includedIds.add(entity.id);
              filtered.push(entity);
              continue;
            }

            // Check if entity and viewer are in the same map context
            const sameMapContext = viewer.context && entityPlayer
              ? mapContextHelpers
                ? mapContextHelpers.areInSameContext(entityPlayer, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
                : ((viewer.inBattleground && entityInBattleground && viewer.battlegroundMatchId === entityMatchId) ||
                   (!viewer.inBattleground && !entityInBattleground))
              : !viewer.inBattleground && !entityInBattleground; // Default to main world if no context

            if (!sameMapContext || entity.z !== viewer.z) continue;

            const dx = entity.x - viewer.x;
            const dy = entity.y - viewer.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= radiusSquared) {
              if (entityId !== null) {
                includedIds.add(entityId);
              }
              filtered.push(entity);
            }
          }
        }
      }
    }

    // Ensure falcons are included for any matching context
    for (const entity of entityPack) {
      const entityId = entity && entity.id !== undefined ? entity.id : null;
      if (!entity || (entityId !== null && includedIds.has(entityId))) continue;
      const entityPlayer = entity.id ? Player.list[entity.id] : null;
      if (!entityPlayer || entityPlayer.class !== 'Falcon') continue;

      let hasMatchingContext = false;
      for (const viewer of viewerAnchors) {
        // Check if falcon and viewer are in the same context
        const sameMapContext = viewer.context && entityPlayer
          ? mapContextHelpers
            ? mapContextHelpers.areInSameContext(entityPlayer, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
            : ((viewer.inBattleground && entityPlayer.inBattleground && viewer.battlegroundMatchId === entityPlayer.battlegroundMatchId) ||
               (!viewer.inBattleground && !(entityPlayer.inBattleground && entityPlayer.battlegroundMatchId)))
          : !viewer.inBattleground && !(entityPlayer.inBattleground && entityPlayer.battlegroundMatchId); // Default to main world

        if (sameMapContext && entity.z === viewer.z) {
          hasMatchingContext = true;
          break;
        }
      }

      if (hasMatchingContext) {
        if (entityId !== null) {
          includedIds.add(entityId);
        }
        filtered.push(entity);
      }
    }

    return filtered;
  }

  buildSpatialBuckets(entityPack, partitionSize) {
    const buckets = new Map();
    const unpositioned = [];

    for (const entity of entityPack) {
      if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
        unpositioned.push(entity);
        continue;
      }
      const key = `${Math.floor(entity.x / partitionSize)},${Math.floor(entity.y / partitionSize)},${entity.z}`;
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key).push(entity);
    }

    return { buckets, unpositioned };
  }

  cleanupStaleContextEntities() {
    const now = Date.now();
    if (now - this.lastStaleContextCleanup < this.staleContextCleanupIntervalMs) {
      return;
    }
    this.lastStaleContextCleanup = now;

    const matchManager = global.battlegroundsMatchManager;
    if (!matchManager) return;

    const activeMatchIds = new Set();
    if (matchManager.currentMatch && matchManager.currentMatch.matchId) {
      activeMatchIds.add(matchManager.currentMatch.matchId);
    }
    if (matchManager.matches && typeof matchManager.matches === 'object') {
      for (const matchId in matchManager.matches) {
        activeMatchIds.add(matchId);
      }
    }

    const shouldRemove = (entity) => {
      if (!entity) return false;
      const inBattleground = !!(entity.inBattleground && entity.battlegroundMatchId);
      if (!inBattleground) return false;
      return !activeMatchIds.has(entity.battlegroundMatchId);
    };

    if (global.Item && global.Item.list) {
      for (const id in global.Item.list) {
        const item = global.Item.list[id];
        if (shouldRemove(item)) {
          item.toRemove = true;
        }
      }
    }

    if (global.Light && global.Light.list) {
      for (const id in global.Light.list) {
        const light = global.Light.list[id];
        if (shouldRemove(light)) {
          light.toRemove = true;
        }
      }
    }

    if (global.Arrow && global.Arrow.list) {
      for (const id in global.Arrow.list) {
        const arrow = global.Arrow.list[id];
        if (shouldRemove(arrow)) {
          arrow.toRemove = true;
        }
      }
    }

    if (global.Weather && global.Weather.list) {
      for (const id in global.Weather.list) {
        const weather = global.Weather.list[id];
        if (shouldRemove(weather)) {
          weather.toRemove = true;
        }
      }
    }

    if (global.Building && global.Building.list) {
      for (const id in global.Building.list) {
        const building = global.Building.list[id];
        if (shouldRemove(building)) {
          delete global.Building.list[id];
          if (global.removePack && global.removePack.building) {
            global.removePack.building.push(id);
          }
        }
      }
    }
  }
  
  /**
   * Filter buildings by map context (prevent main world buildings from appearing in battlegrounds)
   * Buildings from main world should not be sent to battleground clients
   */
  spatialFilterBuildings(buildingPack, viewerAnchorsOverride, contextInfo) {
    if(!Array.isArray(buildingPack) || buildingPack.length === 0) return buildingPack;

    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();

    // If no viewers, send all buildings (for initial connection)
    if(viewerAnchors.length === 0) return buildingPack;
    
    let packToFilter = buildingPack;
    if (contextInfo && mapContextHelpers) {
      const mockContext = {
        inBattleground: !!contextInfo.inBattleground,
        battlegroundMatchId: contextInfo.matchId || null
      };
      packToFilter = buildingPack.filter((building) => {
        if (!building || building.id === undefined) return false;
        const buildingEntity = global.Building && global.Building.list ? global.Building.list[building.id] : null;
        if (!buildingEntity) return false;
        return mapContextHelpers.areInSameContext(buildingEntity, mockContext);
      });
      if (packToFilter.length === 0) return packToFilter;
    }
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    const partitionSize = this.spatialPartitionSize || 512;
    const { buckets, unpositioned } = this.buildSpatialBuckets(packToFilter, partitionSize);
    const includedIds = new Set();

    filtered.push(...unpositioned);

    for (const viewer of viewerAnchors) {
      const minX = Math.floor((viewer.x - this.spatialFilterRadius) / partitionSize);
      const maxX = Math.floor((viewer.x + this.spatialFilterRadius) / partitionSize);
      const minY = Math.floor((viewer.y - this.spatialFilterRadius) / partitionSize);
      const maxY = Math.floor((viewer.y + this.spatialFilterRadius) / partitionSize);

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy},${viewer.z}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;

          for (const building of bucket) {
            const buildingId = building && building.id !== undefined ? building.id : null;
            if (!building || (buildingId !== null && includedIds.has(buildingId))) continue;

            const buildingEntity = building.id && global.Building && global.Building.list
              ? global.Building.list[building.id]
              : null;
            if (!buildingEntity) continue;

            // Check if building and viewer are in the same map context
            const sameMapContext = viewer.context && buildingEntity
              ? mapContextHelpers
                ? mapContextHelpers.areInSameContext(buildingEntity, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
                : ((viewer.inBattleground && buildingEntity.inBattleground && viewer.battlegroundMatchId === buildingEntity.battlegroundMatchId) ||
                   (!viewer.inBattleground && !(buildingEntity.inBattleground && buildingEntity.battlegroundMatchId)))
              : !viewer.inBattleground && !(buildingEntity.inBattleground && buildingEntity.battlegroundMatchId); // Default to main world

            if (!sameMapContext || building.z !== viewer.z) continue;

            const dx = building.x - viewer.x;
            const dy = building.y - viewer.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= radiusSquared) {
              if (buildingId !== null) {
                includedIds.add(buildingId);
              }
              filtered.push(building);
            }
          }
        }
      }
    }

    return filtered;
  }
  
  /**
   * Filter items by map context (prevent main world items from appearing in battlegrounds)
   * Items with innaWoods=true from main world should not be sent to battleground clients
   */
  spatialFilterItems(itemPack, viewerAnchorsOverride, contextInfo) {
    if(!Array.isArray(itemPack) || itemPack.length === 0) return itemPack;

    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();

    // If no viewers, send all items (for initial connection)
    if(viewerAnchors.length === 0) return itemPack;
    const now = Date.now();
    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    const logTorchFilter = !global._debugTorchLogTimes.torchItemFilter || now - global._debugTorchLogTimes.torchItemFilter > 2000;
    const torchStats = logTorchFilter ? {
      total: 0,
      included: 0,
      contextMismatch: 0,
      zMismatch: 0,
      distanceFail: 0,
      missingEntity: 0
    } : null;
    const includedTorchIds = logTorchFilter ? [] : null;
    if (logTorchFilter) {
      for (const item of itemPack) {
        const itemEntity = item && item.id !== undefined && global.Item && global.Item.list ? global.Item.list[item.id] : null;
        if (itemEntity && itemEntity.type === 'LitTorch') {
          torchStats.total++;
        }
      }
    }
    
    let packToFilter = itemPack;
    if (contextInfo && mapContextHelpers) {
      const mockContext = {
        inBattleground: !!contextInfo.inBattleground,
        battlegroundMatchId: contextInfo.matchId || null
      };
      packToFilter = itemPack.filter((item) => {
        if (!item || item.id === undefined) return false;
        const itemEntity = global.Item && global.Item.list ? global.Item.list[item.id] : null;
        if (!itemEntity) return false;
        return mapContextHelpers.areInSameContext(itemEntity, mockContext);
      });
      if (packToFilter.length === 0) return packToFilter;
    }
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    const partitionSize = this.spatialPartitionSize || 512;
    const { buckets, unpositioned } = this.buildSpatialBuckets(packToFilter, partitionSize);
    const includedIds = new Set();

    filtered.push(...unpositioned);

    for (const viewer of viewerAnchors) {
      const minX = Math.floor((viewer.x - this.spatialFilterRadius) / partitionSize);
      const maxX = Math.floor((viewer.x + this.spatialFilterRadius) / partitionSize);
      const minY = Math.floor((viewer.y - this.spatialFilterRadius) / partitionSize);
      const maxY = Math.floor((viewer.y + this.spatialFilterRadius) / partitionSize);

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy},${viewer.z}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;

          for (const item of bucket) {
            const itemId = item && item.id !== undefined ? item.id : null;
            if (!item || (itemId !== null && includedIds.has(itemId))) continue;
            const itemEntity = item.id && global.Item && global.Item.list ? global.Item.list[item.id] : null;
            if (!itemEntity) {
              if (torchStats && itemId !== null) {
                torchStats.missingEntity++;
              }
              continue;
            }

            // Check if item and viewer are in the same map context
            const sameMapContext = viewer.context && itemEntity
              ? mapContextHelpers
                ? mapContextHelpers.areInSameContext(itemEntity, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
                : ((viewer.inBattleground && itemEntity.inBattleground && viewer.battlegroundMatchId === itemEntity.battlegroundMatchId) ||
                   (!viewer.inBattleground && !(itemEntity.inBattleground && itemEntity.battlegroundMatchId)))
              : !viewer.inBattleground && !(itemEntity.inBattleground && itemEntity.battlegroundMatchId); // Default to main world

            if (!sameMapContext || item.z !== viewer.z) {
              if (torchStats && itemEntity.type === 'LitTorch') {
                if (!sameMapContext) torchStats.contextMismatch++;
                else torchStats.zMismatch++;
              }
              continue;
            }

            const dx = item.x - viewer.x;
            const dy = item.y - viewer.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= radiusSquared) {
              if (itemId !== null) {
                includedIds.add(itemId);
              }
              if (torchStats && itemEntity.type === 'LitTorch') {
                torchStats.included++;
                if (includedTorchIds && includedTorchIds.length < 3) {
                  includedTorchIds.push(itemEntity.id);
                }
              }
              filtered.push(item);
            } else if (torchStats && itemEntity.type === 'LitTorch') {
              torchStats.distanceFail++;
            }
          }
        }
      }
    }
    if (logTorchFilter) {
      global._debugTorchLogTimes.torchItemFilter = now;
      const viewerZCounts = {};
      for (const viewer of viewerAnchors) {
        const key = String(viewer.z);
        viewerZCounts[key] = (viewerZCounts[key] || 0) + 1;
      }
      let closestTorch = null;
      if (viewerAnchors.length > 0) {
        const primaryViewer = viewerAnchors[0];
        // For logging, we can use a mock entity with the viewer's context
        const mockEntity = {
          inBattleground: primaryViewer.inBattleground,
          battlegroundMatchId: primaryViewer.battlegroundMatchId
        };
        let closestDist = Infinity;
        for (const item of itemPack) {
          const itemEntity = item && item.id !== undefined && global.Item && global.Item.list ? global.Item.list[item.id] : null;
          if (!itemEntity || itemEntity.type !== 'LitTorch') continue;
          const sameMapContext = primaryViewer.context && itemEntity
            ? mapContextHelpers
              ? mapContextHelpers.areInSameContext(itemEntity, mockEntity)
              : ((primaryViewer.inBattleground && itemEntity.inBattleground && primaryViewer.battlegroundMatchId === itemEntity.battlegroundMatchId) ||
                 (!primaryViewer.inBattleground && !(itemEntity.inBattleground && itemEntity.battlegroundMatchId)))
            : !primaryViewer.inBattleground && !(itemEntity.inBattleground && itemEntity.battlegroundMatchId);
          if (!sameMapContext || itemEntity.z !== primaryViewer.z) continue;
          const dx = itemEntity.x - primaryViewer.x;
          const dy = itemEntity.y - primaryViewer.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < closestDist) {
            closestDist = dist;
            closestTorch = { id: itemEntity.id, z: itemEntity.z, distance: Math.round(dist) };
          }
        }
      }
      // #region agent log
      // #endregion
    }

    return filtered;
  }
  
  /**
   * Filter arrows by map context (prevent main world arrows from appearing in battlegrounds)
   * Arrows inherit context from their parent entity
   */
  spatialFilterArrows(arrowPack, viewerAnchorsOverride, contextInfo) {
    if(!Array.isArray(arrowPack) || arrowPack.length === 0) return arrowPack;

    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();

    // If no viewers, send all arrows (for initial connection)
    if(viewerAnchors.length === 0) return arrowPack;
    
    let packToFilter = arrowPack;
    if (contextInfo && mapContextHelpers) {
      const mockContext = {
        inBattleground: !!contextInfo.inBattleground,
        battlegroundMatchId: contextInfo.matchId || null
      };
      packToFilter = arrowPack.filter((arrow) => {
        if (!arrow || arrow.id === undefined) return false;
        let arrowEntity = null;
        if (global.Arrow && global.Arrow.list && global.Arrow.list[arrow.id]) {
          arrowEntity = global.Arrow.list[arrow.id];
        } else if (arrow.parent && global.Player && global.Player.list) {
          arrowEntity = global.Player.list[arrow.parent];
        }
        if (!arrowEntity) return false;
        return mapContextHelpers.areInSameContext(arrowEntity, mockContext);
      });
      if (packToFilter.length === 0) return packToFilter;
    }
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    const partitionSize = this.spatialPartitionSize || 512;
    const { buckets, unpositioned } = this.buildSpatialBuckets(packToFilter, partitionSize);
    const includedIds = new Set();

    filtered.push(...unpositioned);

    for (const viewer of viewerAnchors) {
      const minX = Math.floor((viewer.x - this.spatialFilterRadius) / partitionSize);
      const maxX = Math.floor((viewer.x + this.spatialFilterRadius) / partitionSize);
      const minY = Math.floor((viewer.y - this.spatialFilterRadius) / partitionSize);
      const maxY = Math.floor((viewer.y + this.spatialFilterRadius) / partitionSize);

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy},${viewer.z}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;

          for (const arrow of bucket) {
            const arrowId = arrow && arrow.id !== undefined ? arrow.id : null;
            if (!arrow || (arrowId !== null && includedIds.has(arrowId))) continue;

            let arrowEntity = null;
            if (global.Arrow && global.Arrow.list && global.Arrow.list[arrow.id]) {
              arrowEntity = global.Arrow.list[arrow.id];
            } else if (arrow.parent && global.Player && global.Player.list) {
              arrowEntity = global.Player.list[arrow.parent];
            }
            if (!arrowEntity) continue;

            // Check if arrow and viewer are in the same map context
            const sameMapContext = viewer.context && arrowEntity
              ? mapContextHelpers
                ? mapContextHelpers.areInSameContext(arrowEntity, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
                : ((viewer.inBattleground && arrowEntity.inBattleground && viewer.battlegroundMatchId === arrowEntity.battlegroundMatchId) ||
                   (!viewer.inBattleground && !(arrowEntity.inBattleground && arrowEntity.battlegroundMatchId)))
              : !viewer.inBattleground && !(arrowEntity.inBattleground && arrowEntity.battlegroundMatchId); // Default to main world

            if (!sameMapContext || arrow.z !== viewer.z) continue;

            const dx = arrow.x - viewer.x;
            const dy = arrow.y - viewer.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= radiusSquared) {
              if (arrowId !== null) {
                includedIds.add(arrowId);
              }
              filtered.push(arrow);
            }
          }
        }
      }
    }

    return filtered;
  }
  
  /**
   * Filter lights by map context (prevent main world lights from appearing in battlegrounds)
   */
  spatialFilterLights(lightPack, viewerAnchorsOverride, contextInfo) {
    if(!Array.isArray(lightPack) || lightPack.length === 0) return lightPack;
    const now = Date.now();
    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    if (!global._debugTorchLogTimes.spatialLights || now - global._debugTorchLogTimes.spatialLights > 2000) {
      global._debugTorchLogTimes.spatialLights = now;
    // #region agent log
    // #endregion
    }
    
    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();

    // If no viewers, send all lights (for initial connection)
    if(viewerAnchors.length === 0) return lightPack;
    
    let packToFilter = lightPack;
    if (contextInfo && mapContextHelpers) {
      const mockContext = {
        inBattleground: !!contextInfo.inBattleground,
        battlegroundMatchId: contextInfo.matchId || null
      };
      packToFilter = lightPack.filter((light) => {
        if (!light || light.id === undefined) return false;
        const lightEntity = global.Light && global.Light.list ? global.Light.list[light.id] : null;
        if (!lightEntity) return false;
        return mapContextHelpers.areInSameContext(lightEntity, mockContext);
      });
      if (packToFilter.length === 0) return packToFilter;
    }
    
    const filtered = [];
    const radiusSquared = this.spatialFilterRadius * this.spatialFilterRadius;
    const partitionSize = this.spatialPartitionSize || 512;
    const { buckets, unpositioned } = this.buildSpatialBuckets(packToFilter, partitionSize);
    const includedIds = new Set();

    filtered.push(...unpositioned);

    for (const viewer of viewerAnchors) {
      const minX = Math.floor((viewer.x - this.spatialFilterRadius) / partitionSize);
      const maxX = Math.floor((viewer.x + this.spatialFilterRadius) / partitionSize);
      const minY = Math.floor((viewer.y - this.spatialFilterRadius) / partitionSize);
      const maxY = Math.floor((viewer.y + this.spatialFilterRadius) / partitionSize);

      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = `${cx},${cy},${viewer.z}`;
          const bucket = buckets.get(key);
          if (!bucket) continue;

          for (const light of bucket) {
            const lightId = light && light.id !== undefined ? light.id : null;
            if (!light || (lightId !== null && includedIds.has(lightId))) continue;
            const lightEntity = light.id && global.Light && global.Light.list ? global.Light.list[light.id] : null;
            if (!lightEntity) continue;

            // Check if light and viewer are in the same map context
            const sameMapContext = viewer.context && lightEntity
              ? mapContextHelpers
                ? mapContextHelpers.areInSameContext(lightEntity, { inBattleground: viewer.inBattleground, battlegroundMatchId: viewer.battlegroundMatchId })
                : ((viewer.inBattleground && lightEntity.inBattleground && viewer.battlegroundMatchId === lightEntity.battlegroundMatchId) ||
                   (!viewer.inBattleground && !(lightEntity.inBattleground && lightEntity.battlegroundMatchId)))
              : !viewer.inBattleground && !(lightEntity.inBattleground && lightEntity.battlegroundMatchId); // Default to main world

            if (!sameMapContext || light.z !== viewer.z) continue;

            const dx = light.x - viewer.x;
            const dy = light.y - viewer.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= radiusSquared) {
              if (lightId !== null) {
                includedIds.add(lightId);
              }
              filtered.push(light);
            }
          }
        }
      }
    }

    if (!global._debugTorchLogTimes) global._debugTorchLogTimes = {};
    if (!global._debugTorchLogTimes.spatialLightsResult || now - global._debugTorchLogTimes.spatialLightsResult > 2000) {
      global._debugTorchLogTimes.spatialLightsResult = now;
      // #region agent log
      // #endregion
    }
    return filtered;
  }
  
  /**
   * Filter weather by map context (weather is typically global, but filter if per-match)
   * For now, weather is usually global, so we just return it as-is unless it has match-specific data
   */
  spatialFilterWeather(weatherPack, viewerAnchorsOverride) {
    if (!Array.isArray(weatherPack) || weatherPack.length === 0) return weatherPack;
    if (!mapContextHelpers || !global.Weather || !global.Weather.list) return weatherPack;

    // Get all viewer anchors from the camera registry
    const viewerAnchors = viewerAnchorsOverride || Camera.getViewerAnchors();
    if (viewerAnchors.length === 0) return weatherPack;

    const filtered = [];
    for (const weather of weatherPack) {
      const weatherEntity = weather && weather.id !== undefined ? global.Weather.list[weather.id] : null;
      if (!weatherEntity) {
        filtered.push(weather);
        continue;
      }
      let hasMatchingContext = false;
      for (const viewer of viewerAnchors) {
        // Check if weather and viewer are in the same context
        const mockViewerEntity = {
          inBattleground: viewer.inBattleground,
          battlegroundMatchId: viewer.battlegroundMatchId
        };
        if (mapContextHelpers.areInSameContext(weatherEntity, mockViewerEntity)) {
          hasMatchingContext = true;
          break;
        }
      }
      if (hasMatchingContext) {
        filtered.push(weather);
      }
    }
    return filtered;
  }
}

// Export for use
module.exports = OptimizedGameLoop;
