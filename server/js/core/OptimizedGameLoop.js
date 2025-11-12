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
    // CRITICAL: OptimizedEntityManager is NOT being used - entities never added to it
    // Skip the redundant entityManager.updateEntities() call
    // const updateResult = this.entityManager.updateEntities(this.targetFrameTime);
    
    // Process pathfinding queue to spread work across frames
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem) {
      global.tilemapSystem.pathfindingSystem.processPathfindingQueue();
    }
    
    // Update game state
    if (this.gameState) {
      this.gameState.updateTime();
    }
    
    // Update social system (check for spontaneous NPC conversations)
    if (global.socialSystem) {
      global.socialSystem.update();
    }
    
    // Send updates to clients
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
    
    const pack = {
      player: playerPack,
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
    
    // Log every 5 seconds
    const now = Date.now();
    if(now - this._perfData.lastLog >= 5000) {
      const avg = (arr) => arr.reduce((a,b) => a+b, 0) / arr.length;
      const max = (arr) => Math.max(...arr);
      
      console.log(`⏱️  sendUpdates() Performance (last 5s):`);
      console.log(`   Player: avg=${avg(this._perfData.playerTimes).toFixed(2)}ms, max=${max(this._perfData.playerTimes).toFixed(2)}ms`);
      console.log(`   Arrow: avg=${avg(this._perfData.arrowTimes).toFixed(2)}ms, max=${max(this._perfData.arrowTimes).toFixed(2)}ms`);
      console.log(`   Item: avg=${avg(this._perfData.itemTimes).toFixed(2)}ms, max=${max(this._perfData.itemTimes).toFixed(2)}ms`);
      console.log(`   Building: avg=${avg(this._perfData.buildingTimes).toFixed(2)}ms, max=${max(this._perfData.buildingTimes).toFixed(2)}ms`);
      console.log(`   TOTAL: avg=${avg(this._perfData.totalTimes).toFixed(2)}ms, max=${max(this._perfData.totalTimes).toFixed(2)}ms`);
      
      const avgTotal = avg(this._perfData.totalTimes);
      if(avgTotal > 16.67) {
        console.warn(`⚠️  WARNING: sendUpdates() avg ${avgTotal.toFixed(2)}ms exceeds 60fps budget (16.67ms)`);
      }
      
      this._perfData.lastLog = now;
    }
    
    this.emit({ msg: 'update', pack });
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
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
    const minFrameTime = Math.min(...this.frameTimeHistory);
    const maxFrameTime = Math.max(...this.frameTimeHistory);
    
    return {
      fps: this.performanceOptimizer.fps,
      avgFrameTime: avgFrameTime.toFixed(2),
      minFrameTime: minFrameTime.toFixed(2),
      maxFrameTime: maxFrameTime.toFixed(2),
      entityStats: this.entityManager.getStats(),
      optimizerStats: this.performanceOptimizer.getStats()
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
}

// Export for use
module.exports = OptimizedGameLoop;
