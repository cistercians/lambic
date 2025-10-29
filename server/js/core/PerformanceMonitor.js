// Performance Monitor - Server-side performance tracking
class PerformanceMonitor {
  constructor() {
    this.enabled = process.env.ENABLE_PERF_MONITOR === 'true';
    this.intervalId = null;
    this.statsInterval = 60000; // Log every 60 seconds
    
    // Tracking
    this.pathCacheStats = {
      size: 0,
      hits: 0,
      misses: 0,
      hitRate: 0
    };
    
    this.spatialIndexStats = {
      cells: 0,
      entities: 0
    };
    
    this.eventManagerStats = {
      historySize: 0,
      logBufferSize: 0,
      subscribers: 0
    };
    
    this.lastMemoryCheck = Date.now();
    
    if (this.enabled) {
      this.start();
    }
  }
  
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.logStats(), this.statsInterval);
    this.logStats(); // Log immediately
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  logStats() {
    if (!this.enabled) return;
    
    const memUsage = process.memoryUsage();
    const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const rssMB = (memUsage.rss / 1024 / 1024).toFixed(2);
    const externalMB = (memUsage.external / 1024 / 1024).toFixed(2);
    
    const stats = {
      timestamp: new Date().toISOString(),
      memory: {
        heapUsed: `${heapUsedMB} MB`,
        rss: `${rssMB} MB`,
        external: `${externalMB} MB`
      },
      pathCache: this.pathCacheStats,
      spatialIndex: this.spatialIndexStats,
      eventManager: this.eventManagerStats,
      entities: this.getEntityCounts()
    };
    
    console.log('[PERF]', JSON.stringify(stats, null, 2));
  }
  
  getEntityCounts() {
    const counts = {
      players: 0,
      items: 0,
      arrows: 0,
      buildings: 0,
      lights: 0
    };
    
    if (global.Player && global.Player.list) {
      counts.players = Object.keys(global.Player.list).length;
    }
    if (global.Item && global.Item.list) {
      counts.items = Object.keys(global.Item.list).length;
    }
    if (global.Arrow && global.Arrow.list) {
      counts.arrows = Object.keys(global.Arrow.list).length;
    }
    if (global.Building && global.Building.list) {
      counts.buildings = Object.keys(global.Building.list).length;
    }
    if (global.Light && global.Light.list) {
      counts.lights = Object.keys(global.Light.list).length;
    }
    
    return counts;
  }
  
  updatePathCacheStats(pathCache) {
    if (!this.enabled) return;
    this.pathCacheStats = {
      size: pathCache.cache ? pathCache.cache.size : 0,
      hits: pathCache.stats ? pathCache.stats.hits || 0 : 0,
      misses: pathCache.stats ? pathCache.stats.misses || 0 : 0,
      hitRate: pathCache.stats && (pathCache.stats.hits + pathCache.stats.misses) > 0
        ? ((pathCache.stats.hits / (pathCache.stats.hits + pathCache.stats.misses)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
  
  updateSpatialIndexStats(spatialIndex) {
    if (!this.enabled) return;
    if (spatialIndex && spatialIndex.stats) {
      this.spatialIndexStats = {
        cells: spatialIndex.stats.cellsUsed || 0,
        entities: spatialIndex.stats.entitiesTracked || 0
      };
    }
  }
  
  updateEventManagerStats(eventManager) {
    if (!this.enabled) return;
    if (eventManager) {
      this.eventManagerStats = {
        historySize: eventManager.eventHistory ? eventManager.eventHistory.length : 0,
        logBufferSize: eventManager.logBuffer ? eventManager.logBuffer.length : 0,
        subscribers: eventManager.subscribers ? eventManager.subscribers.size : 0
      };
    }
  }
}

module.exports = PerformanceMonitor;

