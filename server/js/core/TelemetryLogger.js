/**
 * TelemetryLogger - Advanced telemetry and metrics collection system
 *
 * Extends basic logging with:
 * - Structured metrics collection
 * - Event tracking and analytics
 * - Performance monitoring
 * - Error tracking with context
 * - Configurable backends (console, file, network)
 * - Sampling and aggregation
 */

const { logger: baseLogger, LOG_LEVELS } = require('./Logger');

class TelemetryLogger {
  constructor() {
    this.enabled = process.env.TELEMETRY_ENABLED !== 'false'; // Default enabled
    this.metrics = new Map(); // metricName -> { value, timestamp, tags }
    this.events = new Map(); // eventType -> [events]
    this.counters = new Map(); // counterName -> count
    this.timers = new Map(); // timerName -> { start, samples: [] }
    this.histograms = new Map(); // histogramName -> { buckets, counts }

    // Sampling configuration
    this.sampling = {
      events: 1.0, // 100% sampling for events
      metrics: 1.0,
      performance: 1.0
    };

    // Aggregation buffers
    this.aggregation = {
      interval: 60000, // Aggregate every minute
      buffers: new Map() // metricName -> aggregated data
    };

    // Error tracking
    this.errorHistory = [];

    // Initialize aggregation timer
    if (this.enabled) {
      this.startAggregation();
    }

    // Bind methods to preserve context
    this.time = this.time.bind(this);
    this.timeEnd = this.timeEnd.bind(this);
  }

  /**
   * Enable/disable telemetry
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && !this.aggregationTimer) {
      this.startAggregation();
    } else if (!enabled && this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
  }

  /**
   * Set sampling rates (0.0 to 1.0)
   */
  setSampling(config) {
    this.sampling = { ...this.sampling, ...config };
  }

  /**
   * Start periodic aggregation
   */
  startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateAndFlush();
    }, this.aggregation.interval);
  }

  /**
   * Aggregate buffered metrics and flush
   */
  aggregateAndFlush() {
    if (!this.enabled) return;

    const now = Date.now();

    // Aggregate counters
    for (const [name, count] of this.counters.entries()) {
      if (count > 0) {
        this.recordMetric(`counter.${name}`, count, { aggregated: true });
        this.counters.set(name, 0); // Reset counter
      }
    }

    // Aggregate histograms
    for (const [name, histogram] of this.histograms.entries()) {
      if (histogram.counts.some(c => c > 0)) {
        const percentiles = this.calculatePercentiles(histogram);
        this.recordMetric(`histogram.${name}`, percentiles, { aggregated: true });
        // Reset histogram
        histogram.counts.fill(0);
      }
    }

    // Flush event buffers (keep recent events)
    this.flushOldEvents(now - (24 * 60 * 60 * 1000)); // Keep 24 hours
  }

  /**
   * Record a structured metric
   * @param {string} name - Metric name
   * @param {any} value - Metric value
   * @param {object} tags - Additional tags/context
   */
  recordMetric(name, value, tags = {}) {
    if (!this.enabled || Math.random() > this.sampling.metrics) return;

    const metric = {
      name,
      value,
      timestamp: Date.now(),
      tags: { ...tags }
    };

    // Store in metrics map
    this.metrics.set(`${name}_${Date.now()}`, metric);

    // Log to base logger
    baseLogger.debug('Telemetry', `Metric: ${name}`, { value, tags });

    // Keep metrics map bounded (last 1000 metrics)
    if (this.metrics.size > 1000) {
      const oldestKey = this.metrics.keys().next().value;
      this.metrics.delete(oldestKey);
    }
  }

  /**
   * Record an event
   * @param {string} eventType - Event type/category
   * @param {object} data - Event data
   * @param {object} context - Additional context
   */
  recordEvent(eventType, data = {}, context = {}) {
    if (!this.enabled || Math.random() > this.sampling.events) return;

    const event = {
      eventType,
      data,
      context,
      timestamp: Date.now(),
      sessionId: this.getSessionId(),
      userId: context.userId || 'anonymous'
    };

    // Store in events map
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType).push(event);

    // Keep event buffers bounded (max 1000 per type)
    const events = this.events.get(eventType);
    if (events.length > 1000) {
      events.shift(); // Remove oldest
    }

    // Log to base logger
    baseLogger.info('Telemetry', `Event: ${eventType}`, { data, context });
  }

  /**
   * Increment a counter
   * @param {string} name - Counter name
   * @param {number} amount - Amount to increment (default: 1)
   * @param {object} tags - Additional tags
   */
  incrementCounter(name, amount = 1, tags = {}) {
    if (!this.enabled) return;

    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + amount);

    // Record immediate metric for high-frequency counters
    if (this.isHighFrequencyCounter(name)) {
      this.recordMetric(`counter.${name}`, current + amount, tags);
    }
  }

  /**
   * Start a timer
   * @param {string} name - Timer name
   * @param {object} tags - Additional tags
   */
  time(name, tags = {}) {
    if (!this.enabled) return;

    this.timers.set(name, {
      start: process.hrtime.bigint(),
      tags,
      samples: []
    });
  }

  /**
   * End a timer and record the duration
   * @param {string} name - Timer name
   * @param {object} additionalTags - Additional tags
   */
  timeEnd(name, additionalTags = {}) {
    if (!this.enabled || !this.timers.has(name)) return;

    const timer = this.timers.get(name);
    const end = process.hrtime.bigint();
    const durationNs = Number(end - timer.start);
    const durationMs = durationNs / 1000000; // Convert to milliseconds

    // Record the sample
    timer.samples.push(durationMs);

    // Keep samples bounded (last 100 samples per timer)
    if (timer.samples.length > 100) {
      timer.samples.shift();
    }

    // Calculate statistics
    const stats = this.calculateStats(timer.samples);

    // Record metric
    this.recordMetric(`timer.${name}`, stats, { ...timer.tags, ...additionalTags });

    // Keep timer for potential reuse
  }

  /**
   * Record a histogram value
   * @param {string} name - Histogram name
   * @param {number} value - Value to record
   * @param {object} tags - Additional tags
   */
  recordHistogram(name, value, tags = {}) {
    if (!this.enabled) return;

    if (!this.histograms.has(name)) {
      // Initialize histogram with default buckets
      this.histograms.set(name, {
        buckets: [0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000],
        counts: new Array(11).fill(0)
      });
    }

    const histogram = this.histograms.get(name);

    // Find appropriate bucket
    let bucketIndex = 0;
    for (let i = 0; i < histogram.buckets.length; i++) {
      if (value <= histogram.buckets[i]) {
        bucketIndex = i;
        break;
      }
      bucketIndex = i + 1; // Put in last bucket if larger than all
    }

    if (bucketIndex < histogram.counts.length) {
      histogram.counts[bucketIndex]++;
    }

  }

  /**
   * Record a performance metric
   * @param {string} category - Performance category (e.g., 'render', 'network', 'db')
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {object} context - Additional context
   */
  recordPerformance(category, operation, duration, context = {}) {
    if (!this.enabled || Math.random() > this.sampling.performance) return;

    this.recordMetric(`performance.${category}.${operation}`, duration, {
      ...context,
      category,
      operation
    });

    // Also record in histogram for distribution analysis
    this.recordHistogram(`performance.${category}`, duration, { operation });
  }

  /**
   * Record an error with context
   * @param {Error} error - Error object
   * @param {string} category - Error category
   * @param {object} context - Additional context
   */
  recordError(error, category = 'unknown', context = {}) {
    if (!this.enabled) return;

    // Categorize error if not specified
    if (category === 'unknown') {
      category = this.categorizeError(error);
    }

    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      category,
      timestamp: Date.now(),
      context: {
        ...context,
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid
      }
    };

    this.recordEvent('error', errorData);

    // Record error in system health monitor
    if (this.systemHealthMonitor) {
      this.systemHealthMonitor.recordError(category, error, context);
    }

    // Increment error counters
    this.incrementCounter(`errors.${category}`, 1);

    // Track error frequency patterns
    const errorKey = `${error.name}:${error.message.substring(0, 100)}`;
    this.incrementCounter(`errors.patterns.${errorKey}`, 1);

    // Log with base logger at error level
    baseLogger.error('Telemetry', `Error in ${category}`, {
      message: error.message,
      stack: error.stack,
      context
    });

    // Keep error history for analysis
    this.errorHistory.push(errorData);

    // Keep bounded history (last 1000 errors)
    if (this.errorHistory.length > 1000) {
      this.errorHistory.shift();
    }
  }

  /**
   * Categorize error based on error type and message
   * @param {Error} error - Error object
   * @returns {string} Error category
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    const stack = (error.stack || '').toLowerCase();

    // Network errors
    if (name.includes('timeout') || message.includes('timeout') ||
        message.includes('connection') || message.includes('socket') ||
        message.includes('network')) {
      return 'network';
    }

    // Database errors
    if (message.includes('database') || message.includes('mongo') ||
        message.includes('db') || stack.includes('mongojs')) {
      return 'database';
    }

    // File system errors
    if (name.includes('enoent') || message.includes('no such file') ||
        message.includes('permission denied') || message.includes('filesystem')) {
      return 'filesystem';
    }

    // Memory errors
    if (message.includes('out of memory') || message.includes('heap') ||
        message.includes('memory')) {
      return 'memory';
    }

    // Combat errors
    if (stack.includes('simplecombat') || message.includes('combat') ||
        message.includes('damage') || message.includes('attack')) {
      return 'combat';
    }

    // Pathfinding errors
    if (stack.includes('pathfinding') || message.includes('path') ||
        message.includes('navigation')) {
      return 'pathfinding';
    }

    // Entity errors
    if (stack.includes('entity') || message.includes('entity') ||
        message.includes('player') || message.includes('npc')) {
      return 'entity';
    }

    // JSON parsing errors
    if (name.includes('syntax') || message.includes('json') ||
        message.includes('parse')) {
      return 'parsing';
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation') ||
        message.includes('required')) {
      return 'validation';
    }

    // Default categorization
    return 'application';
  }

  /**
   * Get current metrics snapshot
   * @param {object} filter - Filter options
   * @returns {object} Metrics snapshot
   */
  /**
   * Calculate percentiles from histogram bucket data
   * @param {Object} histogram - Histogram with buckets and counts
   * @returns {Object} Histogram with percentile data
   */
  calculateHistogramPercentiles(histogram) {
    const result = { ...histogram };
    const { buckets, counts } = histogram;

    // Calculate total count
    const totalCount = counts.reduce((sum, count) => sum + count, 0);
    if (totalCount === 0) {
      result.p50 = 0;
      result.p95 = 0;
      result.p99 = 0;
      result.count = 0;
      return result;
    }

    result.count = totalCount;

    // Calculate percentiles using linear interpolation between buckets
    const calculatePercentile = (p) => {
      const targetCount = totalCount * (p / 100);
      let cumulativeCount = 0;

      for (let i = 0; i < buckets.length; i++) {
        cumulativeCount += counts[i];

        if (cumulativeCount >= targetCount) {
          if (i === 0) {
            // First bucket
            return buckets[0];
          } else {
            // Interpolate between buckets
            const prevCumulative = cumulativeCount - counts[i];
            const bucketRange = buckets[i] - (i > 0 ? buckets[i - 1] : 0);
            const positionInBucket = (targetCount - prevCumulative) / counts[i];
            return (i > 0 ? buckets[i - 1] : 0) + (bucketRange * positionInBucket);
          }
        }
      }

      // If we get here, return the last bucket
      return buckets[buckets.length - 1];
    };

    result.p50 = calculatePercentile(50);
    result.p95 = calculatePercentile(95);
    result.p99 = calculatePercentile(99);

    return result;
  }

  getMetricsSnapshot(filter = {}) {
    const snapshot = {
      counters: Object.fromEntries(this.counters),
      histograms: {},
      recentMetrics: Array.from(this.metrics.values()).slice(-50), // Last 50 metrics
      events: {},
      systemHealth: null,
      errorStats: this.getErrorStats()
    };

    // Process histograms and calculate percentiles
    for (const [name, histogram] of this.histograms.entries()) {
      snapshot.histograms[name] = this.calculateHistogramPercentiles(histogram);
    }

    // Get recent events by type
    for (const [eventType, events] of this.events.entries()) {
      snapshot.events[eventType] = events.slice(-10); // Last 10 events per type
    }

    // Include system health status if available
    if (this.systemHealthMonitor) {
      snapshot.systemHealth = this.systemHealthMonitor.getHealthStatus();
    }

    return snapshot;
  }

  /**
   * Get error statistics
   * @param {number} timeWindow - Time window in milliseconds (default: 1 hour)
   * @returns {object} Error statistics
   */
  getErrorStats(timeWindow = 60 * 60 * 1000) {
    const now = Date.now();
    const cutoff = now - timeWindow;

    if (!this.errorHistory) {
      return { total: 0, categories: {}, patterns: {} };
    }

    const recentErrors = this.errorHistory.filter(e => e.timestamp > cutoff);

    const stats = {
      total: recentErrors.length,
      categories: {},
      patterns: {},
      timeWindowMs: timeWindow,
      averageRate: recentErrors.length / (timeWindow / 1000 / 60 / 60) // errors per hour
    };

    // Count by category
    recentErrors.forEach(error => {
      stats.categories[error.category] = (stats.categories[error.category] || 0) + 1;
    });

    // Count top error patterns (simplified)
    const patterns = {};
    recentErrors.forEach(error => {
      const key = `${error.name}:${error.message.substring(0, 50)}`;
      patterns[key] = (patterns[key] || 0) + 1;
    });

    // Get top 10 patterns
    stats.patterns = Object.entries(patterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((obj, [key, count]) => {
        obj[key] = count;
        return obj;
      }, {});

    return stats;
  }

  /**
   * Flush old events beyond retention period
   * @param {number} cutoffTime - Events before this time will be removed
   */
  flushOldEvents(cutoffTime) {
    for (const [eventType, events] of this.events.entries()) {
      const filtered = events.filter(event => event.timestamp > cutoffTime);
      this.events.set(eventType, filtered);
    }
  }

  /**
   * Calculate basic statistics for an array of numbers
   * @param {number[]} samples - Array of numbers
   * @returns {object} Statistics object
   */
  calculateStats(samples) {
    if (samples.length === 0) return { count: 0 };

    const sorted = [...samples].sort((a, b) => a - b);
    const sum = samples.reduce((a, b) => a + b, 0);

    return {
      count: samples.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / samples.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Calculate percentiles for histogram
   * @param {object} histogram - Histogram object
   * @returns {object} Percentile data
   */
  calculatePercentiles(histogram) {
    const total = histogram.counts.reduce((a, b) => a + b, 0);
    if (total === 0) return {};

    let cumulative = 0;
    const percentiles = {};

    for (let i = 0; i < histogram.buckets.length; i++) {
      cumulative += histogram.counts[i];
      const percentile = (cumulative / total) * 100;

      if (percentile >= 50 && !percentiles.p50) percentiles.p50 = histogram.buckets[i];
      if (percentile >= 95 && !percentiles.p95) percentiles.p95 = histogram.buckets[i];
      if (percentile >= 99 && !percentiles.p99) percentiles.p99 = histogram.buckets[i];
    }

    percentiles.count = total;
    return percentiles;
  }

  /**
   * Check if counter should be treated as high-frequency
   * @param {string} name - Counter name
   * @returns {boolean} Whether it's high frequency
   */
  isHighFrequencyCounter(name) {
    const highFreqCounters = [
      'combat.damage_dealt',
      'combat.damage_received',
      'network.packets_sent',
      'network.packets_received',
      'entity.updates'
    ];
    return highFreqCounters.some(prefix => name.startsWith(prefix));
  }

  /**
   * Get or create session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    if (!this._sessionId) {
      this._sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this._sessionId;
  }

  /**
   * Clean shutdown
   */
  shutdown() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Final aggregation and flush
    this.aggregateAndFlush();
  }
}

// System Health Monitor - aggregates cross-system metrics
class SystemHealthMonitor {
  constructor(telemetryLogger) {
    this.telemetryLogger = telemetryLogger;
    this.lastHealthSnapshot = Date.now();
    this.healthCheckInterval = 60000; // 1 minute
    this.errorCorrelationWindow = 300000; // 5 minutes
    this.recentErrors = [];
    this.systemMetrics = {};

    // Performance alerting thresholds
    this.performanceThresholds = {
      frameTime: { warning: 50, critical: 100 }, // milliseconds
      memoryUsage: { warning: 0.8, critical: 0.9 }, // ratio of heap used/total
      pathfindingTime: { warning: 10, critical: 50 }, // milliseconds
      entityUpdateTime: { warning: 5, critical: 20 }, // milliseconds
      networkLatency: { warning: 100, critical: 500 }, // milliseconds
      activeConnections: { warning: 100, critical: 500 } // concurrent connections
    };

    // Start periodic health monitoring
    if (telemetryLogger.enabled) {
      this.startHealthMonitoring();
    }
  }

  startHealthMonitoring() {
    this.healthTimer = setInterval(() => {
      this.generateHealthSnapshot();
      this.correlateErrors();
    }, this.healthCheckInterval);
  }

  generateHealthSnapshot() {
    const now = Date.now();
    const uptime = process.uptime();

    const healthSnapshot = {
      timestamp: now,
      server: {
        uptime,
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      entities: {
        players: Object.keys(global.Player?.list || {}).length,
        buildings: Object.keys(global.Building?.list || {}).length,
        items: Object.keys(global.Item?.list || {}).length,
        arrows: Object.keys(global.Arrow?.list || {}).length,
        lights: Object.keys(global.Light?.list || {}).length
      },
      battlegrounds: {
        activeMatches: global.battlegroundsMatchManager?.currentMatch ? 1 : 0,
        activeLobbies: global.battlegroundsLobbyManager?.lobbyState?.players?.length || 0
      },
      network: {
        activeConnections: Object.keys(global.SOCKET_LIST || {}).length,
        totalMessagesSent: global.optimizedGameLoop?.packetCount || 0,
        totalBytesSent: global.optimizedGameLoop?.totalBytesSent || 0
      },
      performance: {
        avgFrameTime: global.optimizedGameLoop?.getPerformanceStats()?.avgFrameTime || 0,
        fps: global.optimizedGameLoop?.performanceOptimizer?.fps || 0
      }
    };

    this.telemetryLogger.event('System', 'HealthSnapshot', healthSnapshot);
    this.lastHealthSnapshot = now;
  }

  correlateErrors() {
    // Look for error patterns across systems
    const errorPatterns = this.analyzeErrorPatterns();

    if (errorPatterns.length > 0) {
      this.telemetryLogger.event('System', 'ErrorCorrelation', {
        timestamp: Date.now(),
        patterns: errorPatterns,
        window: this.errorCorrelationWindow
      });
    }
  }

  analyzeErrorPatterns() {
    // Analyze recent errors for patterns
    const patterns = [];

    // Memory-related errors
    const memoryErrors = this.recentErrors.filter(e =>
      e.message?.includes('heap') ||
      e.message?.includes('memory') ||
      e.system === 'memory'
    );

    if (memoryErrors.length >= 3) {
      patterns.push({
        type: 'memory_pressure',
        severity: 'high',
        count: memoryErrors.length,
        systems: [...new Set(memoryErrors.map(e => e.system))],
        recommendation: 'Consider increasing server memory or optimizing entity counts'
      });
    }

    // Network-related errors
    const networkErrors = this.recentErrors.filter(e =>
      e.system?.includes('Network') ||
      e.message?.includes('socket') ||
      e.message?.includes('connection')
    );

    if (networkErrors.length >= 5) {
      patterns.push({
        type: 'network_instability',
        severity: 'medium',
        count: networkErrors.length,
        systems: ['Network'],
        recommendation: 'Check network connectivity and connection limits'
      });
    }

    // Combat system errors
    const combatErrors = this.recentErrors.filter(e =>
      e.system?.includes('Combat') ||
      e.message?.includes('combat') ||
      e.message?.includes('damage')
    );

    if (combatErrors.length >= 3) {
      patterns.push({
        type: 'combat_system_stress',
        severity: 'medium',
        count: combatErrors.length,
        systems: ['Combat'],
        recommendation: 'Monitor combat frequency and consider load balancing'
      });
    }

    return patterns;
  }

  recordError(system, error, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      system,
      message: error.message || error,
      stack: error.stack,
      context
    };

    this.recentErrors.push(errorEntry);

    // Keep only recent errors
    const cutoffTime = Date.now() - this.errorCorrelationWindow;
    this.recentErrors = this.recentErrors.filter(e => e.timestamp > cutoffTime);
  }

  getHealthStatus() {
    // Get basic health info without triggering performance checks
    // to avoid circular dependency with getMetricsSnapshot
    const performanceAlerts = this.checkPerformanceThresholds();

    return {
      overall: this.calculateOverallHealth(),
      systems: this.systemMetrics,
      recentErrors: this.recentErrors.slice(-10), // Last 10 errors
      performanceAlerts: performanceAlerts,
      recommendations: this.generateRecommendations()
    };
  }

  calculateOverallHealth() {
    // Simple health calculation based on error rates and memory usage
    const recentErrors = this.recentErrors.filter(e => e.timestamp > Date.now() - 300000).length; // Last 5 minutes
    const memoryUsage = process.memoryUsage();

    let health = 'healthy';

    if (recentErrors > 10) health = 'critical';
    else if (recentErrors > 5) health = 'warning';
    else if (memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9) health = 'warning';

    return health;
  }

  checkPerformanceThresholds() {
    const alerts = [];

    // Check frame time performance
    if (this.telemetryLogger.histograms.has('GameLoop.FrameTime')) {
      const histogram = this.telemetryLogger.histograms.get('GameLoop.FrameTime');
      const frameTime = this.telemetryLogger.calculateHistogramPercentiles(histogram);
      // Calculate average from histogram (simplified - using p50)
      const avgFrameTime = frameTime.p50 || 0;

      if (avgFrameTime > this.performanceThresholds.frameTime.critical) {
        alerts.push({
          level: 'critical',
          metric: 'frameTime',
          value: avgFrameTime,
          threshold: this.performanceThresholds.frameTime.critical,
          message: `Critical: Average frame time ${avgFrameTime.toFixed(1)}ms exceeds ${this.performanceThresholds.frameTime.critical}ms threshold`
        });
      } else if (avgFrameTime > this.performanceThresholds.frameTime.warning) {
        alerts.push({
          level: 'warning',
          metric: 'frameTime',
          value: avgFrameTime,
          threshold: this.performanceThresholds.frameTime.warning,
          message: `Warning: Average frame time ${avgFrameTime.toFixed(1)}ms exceeds ${this.performanceThresholds.frameTime.warning}ms threshold`
        });
      }
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

    if (memoryRatio > this.performanceThresholds.memoryUsage.critical) {
      alerts.push({
        level: 'critical',
        metric: 'memoryUsage',
        value: memoryRatio,
        threshold: this.performanceThresholds.memoryUsage.critical,
        message: `Critical: Memory usage ${(memoryRatio * 100).toFixed(1)}% exceeds ${(this.performanceThresholds.memoryUsage.critical * 100)}% threshold`
      });
    } else if (memoryRatio > this.performanceThresholds.memoryUsage.warning) {
      alerts.push({
        level: 'warning',
        metric: 'memoryUsage',
        value: memoryRatio,
        threshold: this.performanceThresholds.memoryUsage.warning,
        message: `Warning: Memory usage ${(memoryRatio * 100).toFixed(1)}% exceeds ${(this.performanceThresholds.memoryUsage.warning * 100)}% threshold`
      });
    }

    // Check pathfinding performance
    if (this.telemetryLogger.histograms.has('GameLoop.Pathfinding')) {
      const histogram = this.telemetryLogger.histograms.get('GameLoop.Pathfinding');
      const pathfindingTime = this.telemetryLogger.calculateHistogramPercentiles(histogram);
      const avgPathfindingTime = pathfindingTime.p50 || 0;

      if (avgPathfindingTime > this.performanceThresholds.pathfindingTime.critical) {
        alerts.push({
          level: 'critical',
          metric: 'pathfindingTime',
          value: avgPathfindingTime,
          threshold: this.performanceThresholds.pathfindingTime.critical,
          message: `Critical: Average pathfinding time ${avgPathfindingTime.toFixed(1)}ms exceeds ${this.performanceThresholds.pathfindingTime.critical}ms threshold`
        });
      } else if (avgPathfindingTime > this.performanceThresholds.pathfindingTime.warning) {
        alerts.push({
          level: 'warning',
          metric: 'pathfindingTime',
          value: avgPathfindingTime,
          threshold: this.performanceThresholds.pathfindingTime.warning,
          message: `Warning: Average pathfinding time ${avgPathfindingTime.toFixed(1)}ms exceeds ${this.performanceThresholds.pathfindingTime.warning}ms threshold`
        });
      }
    }

    return alerts;
  }

  generateRecommendations() {
    const recommendations = [];
    const performanceAlerts = this.checkPerformanceThresholds();

    // Performance-based recommendations
    for (const alert of performanceAlerts) {
      if (alert.level === 'critical') {
        switch (alert.metric) {
          case 'frameTime':
            recommendations.push({
              priority: 'critical',
              issue: 'Severe frame rate degradation',
              action: 'Immediate attention required: Reduce entity count, optimize game loop, or scale server resources'
            });
            break;
          case 'memoryUsage':
            recommendations.push({
              priority: 'critical',
              issue: 'Critical memory usage',
              action: 'Immediate action: Restart server, investigate memory leaks, reduce concurrent connections'
            });
            break;
          case 'pathfindingTime':
            recommendations.push({
              priority: 'critical',
              issue: 'Pathfinding performance bottleneck',
              action: 'Optimize pathfinding algorithm, reduce NPC count, or implement path caching'
            });
            break;
        }
      } else if (alert.level === 'warning') {
        switch (alert.metric) {
          case 'frameTime':
            recommendations.push({
              priority: 'high',
              issue: 'Elevated frame times detected',
              action: 'Monitor closely: Consider entity culling, game loop optimization'
            });
            break;
          case 'memoryUsage':
            recommendations.push({
              priority: 'high',
              issue: 'High memory usage',
              action: 'Monitor memory growth, consider garbage collection tuning'
            });
            break;
          case 'pathfindingTime':
            recommendations.push({
              priority: 'medium',
              issue: 'Slow pathfinding performance',
              action: 'Review pathfinding efficiency, consider algorithm optimization'
            });
            break;
        }
      }
    }

    // Legacy recommendations
    const memoryUsage = process.memoryUsage();
    const memoryRatio = memoryUsage.heapUsed / memoryUsage.heapTotal;

    if (memoryRatio > 0.9) {
      recommendations.push({
        priority: 'high',
        issue: 'High memory usage detected',
        action: 'Consider server restart or memory optimization'
      });
    }

    const activePlayers = Object.keys(global.Player?.list || {}).length;
    if (activePlayers > 50) {
      recommendations.push({
        priority: 'medium',
        issue: 'High player count',
        action: 'Monitor server performance with increased load'
      });
    }

    return recommendations;
  }

  // Convenience methods for easier usage
  histogram(name, value, tags = {}) {
    return this.recordHistogram(name, value, tags);
  }

  counter(name, amount = 1, tags = {}) {
    return this.incrementCounter(name, amount, tags);
  }

  gauge(name, value, tags = {}) {
    return this.recordMetric(name, value, tags);
  }

  timer(name, startTime, tags = {}) {
    if (startTime instanceof Date) {
      startTime = startTime.getTime();
    }
    const duration = Date.now() - startTime;
    return this.recordHistogram(`${name}.duration`, duration, tags);
  }

  event(category, action, data = {}) {
    return this.recordEvent(`${category}.${action}`, data);
  }

  shutdown() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }
}

// Export singleton instance
const telemetryLogger = new TelemetryLogger();
const systemHealthMonitor = new SystemHealthMonitor(telemetryLogger);

// Add system health monitor to telemetry logger
telemetryLogger.systemHealthMonitor = systemHealthMonitor;

// Add convenience methods directly to the instance
telemetryLogger.histogram = function(name, value, tags = {}) {
  return this.recordHistogram(name, value, tags);
};

telemetryLogger.counter = function(name, amount = 1, tags = {}) {
  return this.incrementCounter(name, amount, tags);
};

telemetryLogger.gauge = function(name, value, tags = {}) {
  return this.recordMetric(name, value, tags);
};

telemetryLogger.timer = function(name, startTime, tags = {}) {
  if (startTime instanceof Date) {
    startTime = startTime.getTime();
  }
  const duration = Date.now() - startTime;
  return this.recordHistogram(`${name}.duration`, duration, tags);
};

telemetryLogger.event = function(category, action, data = {}) {
  return this.recordEvent(`${category}.${action}`, data);
};

// Graceful shutdown
process.on('SIGINT', () => {
  telemetryLogger.shutdown();
  systemHealthMonitor.shutdown();
});
process.on('SIGTERM', () => {
  telemetryLogger.shutdown();
  systemHealthMonitor.shutdown();
});

module.exports = telemetryLogger;
