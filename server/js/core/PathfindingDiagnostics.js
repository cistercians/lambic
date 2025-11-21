// PathfindingDiagnostics.js - Aggregate pathfinding performance data
class PathfindingDiagnostics {
  constructor() {
    this.enabled = true;
    this.logInterval = 10000; // Log every 10 seconds
    this.lastLog = Date.now();
    
    // Performance thresholds
    this.thresholds = {
      maxAvgPathfindingTime: 5, // ms
      maxPathfindingTime: 50, // ms
      maxRequestsPerSecond: 100,
      minCacheHitRate: 30, // percent
      maxStuckEventsPerMinute: 20
    };
    
    // Aggregate metrics
    this.metrics = {
      totalPathfindingRequests: 0,
      totalStuckEvents: 0,
      performanceWarnings: [],
      lastResetTime: Date.now()
    };
  }
  
  // Collect all pathfinding stats
  collectStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      pathfinding: null,
      stuckEntities: null,
      performance: {
        warnings: [],
        score: 100 // Start at 100, reduce for issues
      }
    };
    
    // Get pathfinding system stats
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem) {
      const pfStats = global.tilemapSystem.pathfindingSystem.getProfilingStats();
      if (pfStats) {
        stats.pathfinding = pfStats;
        
        // Check thresholds
        const avgTime = parseFloat(pfStats.timing.pathfinding.avg);
        const maxTime = parseFloat(pfStats.timing.pathfinding.max);
        const cacheHitRate = parseFloat(pfStats.cache.hitRate);
        const requestsPerSecond = pfStats.requests.thisSecond;
        
        if (avgTime > this.thresholds.maxAvgPathfindingTime) {
          stats.performance.warnings.push(`High avg pathfinding time: ${avgTime}ms (threshold: ${this.thresholds.maxAvgPathfindingTime}ms)`);
          stats.performance.score -= 20;
        }
        
        if (maxTime > this.thresholds.maxPathfindingTime) {
          stats.performance.warnings.push(`High max pathfinding time: ${maxTime}ms (threshold: ${this.thresholds.maxPathfindingTime}ms)`);
          stats.performance.score -= 10;
        }
        
        if (cacheHitRate < this.thresholds.minCacheHitRate) {
          stats.performance.warnings.push(`Low cache hit rate: ${cacheHitRate}% (threshold: ${this.thresholds.minCacheHitRate}%)`);
          stats.performance.score -= 15;
        }
        
        if (requestsPerSecond > this.thresholds.maxRequestsPerSecond) {
          stats.performance.warnings.push(`High request rate: ${requestsPerSecond}/s (threshold: ${this.thresholds.maxRequestsPerSecond}/s)`);
          stats.performance.score -= 25;
        }
      }
    }
    
    // Get stuck entity stats
    if (global.stuckEntityAnalytics) {
      const stuckStats = global.stuckEntityAnalytics.getStats();
      if (stuckStats) {
        stats.stuckEntities = stuckStats;
        
        // Check stuck event threshold
        const stuckEventsPerMinute = (stuckStats.totalEvents / ((Date.now() - this.metrics.lastResetTime) / 60000));
        if (stuckEventsPerMinute > this.thresholds.maxStuckEventsPerMinute) {
          stats.performance.warnings.push(`High stuck event rate: ${stuckEventsPerMinute.toFixed(1)}/min (threshold: ${this.thresholds.maxStuckEventsPerMinute}/min)`);
          stats.performance.score -= 15;
        }
      }
    }
    
    // Memory usage
    const memUsage = process.memoryUsage();
    stats.memory = {
      heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
      heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
      rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB'
    };
    
    return stats;
  }
  
  // Log comprehensive diagnostics
  logDiagnostics() {
    if (!this.enabled) return;
    
    const stats = this.collectStats();
    
    
    if (stats.performance.warnings.length > 0) {
      stats.performance.warnings.forEach(warning => {
      });
    }
    
    // Pathfinding stats
    if (stats.pathfinding) {
      
      if (stats.pathfinding.hotspots && stats.pathfinding.hotspots.length > 0) {
        stats.pathfinding.hotspots.slice(0, 3).forEach((h, i) => {
        });
      }
    }
    
    // Stuck entity stats
    if (stats.stuckEntities) {
      
      if (stats.stuckEntities.topStuckWaypoints && stats.stuckEntities.topStuckWaypoints.length > 0) {
        stats.stuckEntities.topStuckWaypoints.slice(0, 5).forEach((w, i) => {
        });
      }
      
      if (stats.stuckEntities.layerDistribution && stats.stuckEntities.layerDistribution.length > 0) {
        stats.stuckEntities.layerDistribution.forEach(l => {
        });
      }
    }
    
    // Memory
    
    
    this.lastLog = Date.now();
  }
  
  // Maybe log diagnostics based on interval
  maybeLog() {
    if (!this.enabled) return;
    
    const now = Date.now();
    if (now - this.lastLog >= this.logInterval) {
      this.logDiagnostics();
    }
  }
  
  // Get current performance score
  getPerformanceScore() {
    const stats = this.collectStats();
    return stats.performance.score;
  }
  
  // Get top issues
  getTopIssues(limit = 5) {
    const issues = [];
    
    // Check pathfinding issues
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem) {
      const pfStats = global.tilemapSystem.pathfindingSystem.getProfilingStats();
      if (pfStats && pfStats.hotspots) {
        pfStats.hotspots.slice(0, limit).forEach(h => {
          issues.push({
            type: 'hotspot',
            severity: h.count > 50 ? 'high' : h.count > 20 ? 'medium' : 'low',
            description: `Frequent pathfinding to ${h.location} (${h.count} requests)`,
            location: h.location,
            count: h.count
          });
        });
      }
    }
    
    // Check stuck entity issues
    if (global.stuckEntityAnalytics) {
      const stuckStats = global.stuckEntityAnalytics.getStats();
      if (stuckStats && stuckStats.topStuckWaypoints) {
        stuckStats.topStuckWaypoints.slice(0, limit).forEach(w => {
          issues.push({
            type: 'stuck_waypoint',
            severity: w.count > 30 ? 'high' : w.count > 15 ? 'medium' : 'low',
            description: `Entities frequently stuck at ${w.waypoint} (${w.count} times)`,
            waypoint: w.waypoint,
            count: w.count
          });
        });
      }
    }
    
    // Sort by count descending
    issues.sort((a, b) => b.count - a.count);
    
    return issues.slice(0, limit);
  }
  
  // Reset metrics
  resetMetrics() {
    this.metrics.totalPathfindingRequests = 0;
    this.metrics.totalStuckEvents = 0;
    this.metrics.performanceWarnings = [];
    this.metrics.lastResetTime = Date.now();
    
    // Reset subsystem metrics
    if (global.tilemapSystem && global.tilemapSystem.pathfindingSystem && global.tilemapSystem.pathfindingSystem.profiling) {
      const profiling = global.tilemapSystem.pathfindingSystem.profiling;
      profiling.totalRequests = 0;
      profiling.cacheHits = 0;
      profiling.cacheMisses = 0;
      profiling.successfulPaths = 0;
      profiling.failedPaths = 0;
      profiling.hotspots.clear();
    }
    
    if (global.stuckEntityAnalytics) {
      global.stuckEntityAnalytics.stuckEvents = [];
      global.stuckEntityAnalytics.entityStuckCounts.clear();
      global.stuckEntityAnalytics.waypointStuckCounts.clear();
      global.stuckEntityAnalytics.layerStuckCounts.clear();
      global.stuckEntityAnalytics.reasonCounts = { blocked: 0, stuck: 0, oscillating: 0, gaveUp: 0 };
      global.stuckEntityAnalytics.recalcAttempts = [];
    }
  }
}

module.exports = PathfindingDiagnostics;






