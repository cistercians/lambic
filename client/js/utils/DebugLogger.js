/**
 * DebugLogger - Centralized debug logging utility for performance-conscious logging
 * 
 * Debug logs are disabled by default for production performance.
 * Enable with: window.DEBUG = true or add ?debug=true to URL
 */

class DebugLogger {
  constructor() {
    // Check URL params for debug mode
    this.enabled = false;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      this.enabled = urlParams.get('debug') === 'true';
      window.DEBUG = this.enabled;
    }
    
    // Throttle settings to prevent log spam
    this._lastLogTime = {};
    this._defaultThrottleMs = 1000; // Default 1 second throttle
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Whether to enable debug logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      window.DEBUG = enabled;
    }
  }

  /**
   * Log a debug message (only if DEBUG is enabled)
   * @param {string} category - Log category for filtering
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments to log
   */
  log(category, message, ...args) {
    if (!this.enabled) return;
    console.log(`[${category}] ${message}`, ...args);
  }

  /**
   * Log a debug message with throttling (max once per throttleMs)
   * @param {string} key - Unique key for throttle tracking
   * @param {string} category - Log category for filtering
   * @param {string} message - Log message
   * @param {number} throttleMs - Minimum milliseconds between logs (default 1000)
   * @param {...any} args - Additional arguments to log
   */
  throttledLog(key, category, message, throttleMs = this._defaultThrottleMs, ...args) {
    if (!this.enabled) return;
    
    const now = Date.now();
    const lastTime = this._lastLogTime[key] || 0;
    
    if (now - lastTime >= throttleMs) {
      this._lastLogTime[key] = now;
      console.log(`[${category}] ${message}`, ...args);
    }
  }

  /**
   * Log a warning (always logs, not gated by DEBUG)
   * @param {string} category - Log category
   * @param {string} message - Warning message
   * @param {...any} args - Additional arguments
   */
  warn(category, message, ...args) {
    console.warn(`[${category}] ${message}`, ...args);
  }

  /**
   * Log an error (always logs, not gated by DEBUG)
   * @param {string} category - Log category
   * @param {string} message - Error message
   * @param {...any} args - Additional arguments
   */
  error(category, message, ...args) {
    console.error(`[${category}] ${message}`, ...args);
  }

  /**
   * Clear throttle tracking (useful for testing)
   */
  clearThrottles() {
    this._lastLogTime = {};
  }
}

// Create singleton instance
const debugLogger = new DebugLogger();

// Export for browser and Node.js
if (typeof window !== 'undefined') {
  window.debugLogger = debugLogger;
  window.DebugLogger = DebugLogger;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = debugLogger;
}

