// SerfLogger - Centralized logging for Serf system
// Provides structured logging with levels, serf context, and performance-aware operation

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class SerfLogger {
  constructor() {
    // Get log level from global config, default to WARN in production
    const configLevel = global.SERF_DEBUG_LEVEL || 'WARN';
    this.level = LOG_LEVELS[configLevel.toUpperCase()] !== undefined 
      ? LOG_LEVELS[configLevel.toUpperCase()] 
      : LOG_LEVELS.WARN;
    
    // Performance optimization: disable logging entirely if level is NONE
    this.enabled = this.level < LOG_LEVELS.NONE;
  }

  /**
   * Get serf context for logging
   * @param {Object} serf - The serf entity
   * @returns {Object} - Context object with serf info
   */
  getSerfContext(serf) {
    if (!serf) {
      return { id: 'unknown', name: 'unknown', state: 'unknown' };
    }

    return {
      id: serf.id || 'unknown',
      name: serf.name || serf.class || 'unknown',
      state: serf.serfState || serf.mode || 'unknown',
      mode: serf.mode || 'unknown',
      action: serf.action || null,
      workHQ: serf.work?.hq || null,
      workSpot: serf.work?.spot || null,
      position: { x: serf.x, y: serf.y, z: serf.z }
    };
  }

  /**
   * Format log message with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} serf - Optional serf entity for context
   * @param {Object} extra - Optional extra data
   * @returns {string} - Formatted log message
   */
  formatMessage(level, message, serf = null, extra = {}) {
    const timestamp = new Date().toISOString();
    const context = serf ? this.getSerfContext(serf) : {};
    
    let logMsg = `[SerfLogger:${level}] ${timestamp}`;
    
    if (serf) {
      logMsg += ` [${context.name || context.id}]`;
      if (context.state) {
        logMsg += ` state=${context.state}`;
      }
      if (context.workHQ) {
        logMsg += ` hq=${context.workHQ}`;
      }
    }
    
    logMsg += ` ${message}`;
    
    if (Object.keys(extra).length > 0) {
      logMsg += ` ${JSON.stringify(extra)}`;
    }
    
    return logMsg;
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} serf - Optional serf entity
   * @param {Object} extra - Optional extra data
   */
  debug(message, serf = null, extra = {}) {
    if (!this.enabled || this.level > LOG_LEVELS.DEBUG) {
      return;
    }
    console.log(this.formatMessage('DEBUG', message, serf, extra));
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} serf - Optional serf entity
   * @param {Object} extra - Optional extra data
   */
  info(message, serf = null, extra = {}) {
    if (!this.enabled || this.level > LOG_LEVELS.INFO) {
      return;
    }
    console.log(this.formatMessage('INFO', message, serf, extra));
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} serf - Optional serf entity
   * @param {Object} extra - Optional extra data
   */
  warn(message, serf = null, extra = {}) {
    if (!this.enabled || this.level > LOG_LEVELS.WARN) {
      return;
    }
    console.warn(this.formatMessage('WARN', message, serf, extra));
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error} error - Optional error object
   * @param {Object} serf - Optional serf entity
   * @param {Object} extra - Optional extra data
   */
  error(message, error = null, serf = null, extra = {}) {
    if (!this.enabled || this.level > LOG_LEVELS.ERROR) {
      return;
    }
    
    const errorInfo = error ? {
      error: error.message,
      stack: error.stack
    } : {};
    
    console.error(this.formatMessage('ERROR', message, serf, { ...extra, ...errorInfo }));
  }

  /**
   * Log state transition
   * @param {Object} serf - The serf entity
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   * @param {string} reason - Reason for transition
   */
  stateTransition(serf, fromState, toState, reason = '') {
    if (!this.enabled || this.level > LOG_LEVELS.DEBUG) {
      return;
    }
    
    const message = `State transition: ${fromState} -> ${toState}${reason ? ` (${reason})` : ''}`;
    this.debug(message, serf);
  }

  /**
   * Log work assignment
   * @param {Object} serf - The serf entity
   * @param {string} buildingId - Building ID
   * @param {Array} spot - Work spot [col, row]
   */
  workAssignment(serf, buildingId, spot) {
    if (!this.enabled || this.level > LOG_LEVELS.INFO) {
      return;
    }
    
    const message = `Work assigned: building=${buildingId}, spot=[${spot?.[0]}, ${spot?.[1]}]`;
    this.info(message, serf);
  }

  /**
   * Log resource deposit
   * @param {Object} serf - The serf entity
   * @param {string} resourceType - Resource type
   * @param {number} amount - Amount deposited
   * @param {string} buildingId - Building ID
   */
  resourceDeposit(serf, resourceType, amount, buildingId) {
    if (!this.enabled || this.level > LOG_LEVELS.INFO) {
      return;
    }
    
    const message = `Resource deposited: ${resourceType}=${amount} to building=${buildingId}`;
    this.info(message, serf);
  }

  /**
   * Log stuck detection
   * @param {Object} serf - The serf entity
   * @param {number} stuckTime - Time stuck in frames
   */
  stuck(serf, stuckTime) {
    if (!this.enabled || this.level > LOG_LEVELS.WARN) {
      return;
    }
    
    const message = `Serf stuck for ${stuckTime} frames`;
    this.warn(message, serf, { stuckTime });
  }
}

// Create singleton instance
const serfLogger = new SerfLogger();

module.exports = serfLogger;
module.exports.SerfLogger = SerfLogger;
module.exports.LOG_LEVELS = LOG_LEVELS;

