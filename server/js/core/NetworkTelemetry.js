/**
 * NetworkTelemetry - Network performance monitoring and telemetry
 *
 * Tracks connection health, message patterns, bandwidth usage, and network errors
 */

const TelemetryLogger = require('./TelemetryLogger');

class NetworkTelemetry {
  constructor() {
    this.enabled = process.env.NETWORK_TELEMETRY_ENABLED !== 'false'; // Default enabled
    this.connections = new Map(); // socketId -> connection data
    this.messageStats = new Map(); // messageType -> stats
    this.bandwidthStats = {
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastReset: Date.now()
    };

    // Aggregation buffers
    this.aggregation = {
      interval: 30000, // Aggregate every 30 seconds
      connectionHistory: [],
      messageHistory: [],
      errorHistory: []
    };

    // Lazy-loaded telemetry logger
    this._telemetryLogger = null;

    // Initialize aggregation timer
    if (this.enabled) {
      this.startAggregation();
    }

    // Bind methods for external use
    this.trackConnection = this.trackConnection.bind(this);
    this.trackDisconnection = this.trackDisconnection.bind(this);
    this.trackMessage = this.trackMessage.bind(this);
    this.trackError = this.trackError.bind(this);
  }

  /**
   * Get telemetry logger (lazy-loaded)
   */
  getTelemetryLogger() {
    if (!this._telemetryLogger) {
      try {
        this._telemetryLogger = require('./TelemetryLogger');
      } catch (e) {
        // Fallback to basic logger if TelemetryLogger not available
        try {
          const { logger } = require('./Logger');
          this._telemetryLogger = logger;
        } catch (e) {
          // No logger available, use console
          this._telemetryLogger = null;
        }
      }
    }
    return this._telemetryLogger;
  }

  /**
   * Track new connection
   * @param {object} socket - WebSocket connection
   * @param {object} metadata - Connection metadata
   */
  trackConnection(socket, metadata = {}) {
    if (!this.enabled) return;

    const connectionId = socket.id;
    const now = Date.now();

    const connectionData = {
      id: connectionId,
      connectedAt: now,
      lastActivity: now,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: 0,
      pingCount: 0,
      avgPing: 0,
      userAgent: metadata.userAgent || 'unknown',
      ip: metadata.ip || 'unknown',
      authenticated: false,
      playerId: null,
      playerName: null,
      house: null
    };

    this.connections.set(connectionId, connectionData);

    // Record connection event
    TelemetryLogger.event('Network', 'ConnectionEstablished', {
      connectionId,
      userAgent: connectionData.userAgent,
      ip: connectionData.ip
    });

    TelemetryLogger.counter('Network.Connections.Total');
    TelemetryLogger.gauge('Network.Connections.Active', this.connections.size);

    // Track connection count
    this.updateConnectionMetrics();
  }

  /**
   * Track connection disconnection
   * @param {object} socket - WebSocket connection
   * @param {string} reason - Disconnect reason
   */
  trackDisconnection(socket, reason = 'unknown') {
    if (!this.enabled) return;

    const connectionId = socket.id;
    const connectionData = this.connections.get(connectionId);

    if (connectionData) {
      const duration = Date.now() - connectionData.connectedAt;

      // Record disconnection event
      TelemetryLogger.event('Network', 'ConnectionClosed', {
        connectionId,
        durationMs: duration,
        messagesSent: connectionData.messagesSent,
        messagesReceived: connectionData.messagesReceived,
        bytesSent: connectionData.bytesSent,
        bytesReceived: connectionData.bytesReceived,
        errors: connectionData.errors,
        reason,
        playerId: connectionData.playerId,
        playerName: connectionData.playerName,
        house: connectionData.house
      });

      TelemetryLogger.gauge('Network.Connections.Active', this.connections.size);

      // Record session duration
      TelemetryLogger.histogram('Network.SessionDuration', duration / 1000); // Convert to seconds

      // Remove from active connections
      this.connections.delete(connectionId);
      this.updateConnectionMetrics();
    }
  }

  /**
   * Track message sent/received
   * @param {string} direction - 'sent' or 'received'
   * @param {object} socket - WebSocket connection
   * @param {object} message - Message data
   * @param {number} byteSize - Message size in bytes
   */
  trackMessage(direction, socket, message, byteSize) {
    if (!this.enabled) return;

    const connectionId = socket.id;
    const connectionData = this.connections.get(connectionId);
    const messageType = message.msg || 'unknown';

    if (connectionData) {
      connectionData.lastActivity = Date.now();

      if (direction === 'sent') {
        connectionData.messagesSent++;
        connectionData.bytesSent += byteSize;
        this.bandwidthStats.bytesSent += byteSize;
        this.bandwidthStats.messagesSent++;
      } else if (direction === 'received') {
        connectionData.messagesReceived++;
        connectionData.bytesReceived += byteSize;
        this.bandwidthStats.bytesReceived += byteSize;
        this.bandwidthStats.messagesReceived++;
      }
    }

    // Track message type statistics
    if (!this.messageStats.has(messageType)) {
      this.messageStats.set(messageType, {
        sent: 0,
        received: 0,
        totalSize: 0,
        avgSize: 0,
        count: 0,
        lastSeen: Date.now()
      });
    }

    const stats = this.messageStats.get(messageType);
    stats.count++;
    stats.lastSeen = Date.now();
    stats.totalSize += byteSize;

    if (direction === 'sent') {
      stats.sent++;
    } else if (direction === 'received') {
      stats.received++;
    }

    stats.avgSize = stats.totalSize / stats.count;

    // Record message telemetry (sampled to avoid spam)
    if (Math.random() < 0.01) { // 1% sampling
      TelemetryLogger.event('Network', 'Message', {
        direction,
        messageType,
        sizeBytes: byteSize,
        connectionId,
        playerId: connectionData?.playerId
      });

      // Track message frequency
      TelemetryLogger.counter(`Network.Messages.${direction}.${messageType}`);
      TelemetryLogger.histogram('Network.MessageSize', byteSize);
    }
  }

  /**
   * Track network error
   * @param {object} socket - WebSocket connection (optional)
   * @param {Error} error - Error object
   * @param {string} context - Error context
   */
  trackError(socket, error, context = 'unknown') {
    if (!this.enabled) return;

    const connectionId = socket?.id;
    const connectionData = connectionId ? this.connections.get(connectionId) : null;

    if (connectionData) {
      connectionData.errors++;
    }

    // Record error telemetry
    const logger = this.getTelemetryLogger();
    if (logger) {
      logger.recordEvent('network.error', {
        connection_id: connectionId,
        error_message: error.message,
        error_name: error.name,
        context: context,
        stack: error.stack?.substring(0, 500), // Truncate stack trace
        player_id: connectionData?.playerId,
        player_name: connectionData?.playerName
      });

      logger.incrementCounter('network.errors_total', 1);
      logger.incrementCounter(`network.errors.${context}`, 1);
    }

    // Track error history
    this.aggregation.errorHistory.push({
      timestamp: Date.now(),
      connectionId,
      error: error.message,
      context
    });

    // Keep error history bounded
    if (this.aggregation.errorHistory.length > 100) {
      this.aggregation.errorHistory.shift();
    }
  }

  /**
   * Update player information for connection
   * @param {object} socket - WebSocket connection
   * @param {object} player - Player entity
   */
  updatePlayerInfo(socket, player) {
    if (!this.enabled) return;

    const connectionId = socket.id;
    const connectionData = this.connections.get(connectionId);

    if (connectionData) {
      connectionData.authenticated = true;
      connectionData.playerId = player.id;
      connectionData.playerName = player.name;
      connectionData.house = player.house;
    }
  }

  /**
   * Track ping/pong for latency monitoring
   * @param {object} socket - WebSocket connection
   * @param {number} pingMs - Ping time in milliseconds
   */
  trackPing(socket, pingMs) {
    if (!this.enabled) return;

    const connectionId = socket.id;
    const connectionData = this.connections.get(connectionId);

    if (connectionData) {
      connectionData.pingCount++;
      // Calculate running average
      connectionData.avgPing = ((connectionData.avgPing * (connectionData.pingCount - 1)) + pingMs) / connectionData.pingCount;

      // Record ping telemetry (sampled)
      const logger = this.getTelemetryLogger();
      if (logger && Math.random() < 0.05) { // 5% sampling
        logger.recordHistogram('network.ping_time', pingMs, {
          connection_id: connectionId,
          player_id: connectionData.playerId
        });
      }
    }
  }

  /**
   * Update connection metrics
   */
  updateConnectionMetrics() {
    const logger = this.getTelemetryLogger();
    if (!logger) return;

    const activeConnections = this.connections.size;
    logger.recordMetric('network.connections_active', activeConnections);

    // Calculate connection distribution by house
    const houseDistribution = {};
    for (const connection of this.connections.values()) {
      if (connection.house) {
        houseDistribution[connection.house] = (houseDistribution[connection.house] || 0) + 1;
      }
    }

    // Record house distribution
    for (const [house, count] of Object.entries(houseDistribution)) {
      logger.recordMetric(`network.connections.house.${house}`, count);
    }
  }

  /**
   * Get current network statistics
   */
  getNetworkStats() {
    const now = Date.now();
    const uptime = now - this.bandwidthStats.lastReset;

    return {
      timestamp: now,
      connections: {
        active: this.connections.size,
        totalTracked: Array.from(this.connections.values()).length
      },
      bandwidth: {
        bytesSent: this.bandwidthStats.bytesSent,
        bytesReceived: this.bandwidthStats.bytesReceived,
        messagesSent: this.bandwidthStats.messagesSent,
        messagesReceived: this.bandwidthStats.messagesReceived,
        uptimeMs: uptime,
        bytesPerSecond: (this.bandwidthStats.bytesSent + this.bandwidthStats.bytesReceived) / (uptime / 1000),
        messagesPerSecond: (this.bandwidthStats.messagesSent + this.bandwidthStats.messagesReceived) / (uptime / 1000)
      },
      messageTypes: Object.fromEntries(this.messageStats),
      recentErrors: this.aggregation.errorHistory.slice(-10)
    };
  }

  /**
   * Aggregate and flush metrics
   */
  aggregateAndFlush() {
    if (!this.enabled) return;

    const logger = this.getTelemetryLogger();
    if (!logger) return;

    const stats = this.getNetworkStats();

    // Record aggregated metrics
    logger.recordMetric('network.bandwidth_bytes_total',
      stats.bandwidth.bytesSent + stats.bandwidth.bytesReceived);

    logger.recordMetric('network.messages_total',
      stats.bandwidth.messagesSent + stats.bandwidth.messagesReceived);

    logger.recordMetric('network.bandwidth_per_second', stats.bandwidth.bytesPerSecond);
    logger.recordMetric('network.messages_per_second', stats.bandwidth.messagesPerSecond);

    // Record top message types by frequency
    const messageTypes = Array.from(this.messageStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10); // Top 10

    for (const [type, typeStats] of messageTypes) {
      logger.recordMetric(`network.message_type.${type}.count`, typeStats.count);
      logger.recordMetric(`network.message_type.${type}.avg_size`, typeStats.avgSize);
    }

    // Reset bandwidth stats for next period
    this.bandwidthStats = {
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastReset: Date.now()
    };
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
   * Clean shutdown
   */
  shutdown() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Final aggregation
    this.aggregateAndFlush();
  }
}

// Export singleton instance
const networkTelemetry = new NetworkTelemetry();

// Graceful shutdown
process.on('SIGINT', () => networkTelemetry.shutdown());
process.on('SIGTERM', () => networkTelemetry.shutdown());

module.exports = networkTelemetry;
