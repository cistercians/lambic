/**
 * TimerManager - Centralized timer management
 * 
 * Provides a clean interface for scheduling timers with:
 * - Named timers for easy debugging
 * - Automatic cleanup
 * - Pause/resume capability
 * - Statistics tracking
 * 
 * Usage:
 *   const timerManager = require('./TimerManager');
 *   
 *   // Schedule a one-time timer
 *   timerManager.setTimeout('serf-wakeup', () => { ... }, 5000);
 *   
 *   // Schedule a repeating timer
 *   timerManager.setInterval('day-cycle', () => { ... }, 60000);
 *   
 *   // Cancel a timer
 *   timerManager.clear('serf-wakeup');
 */

class TimerManager {
  constructor() {
    this.timers = new Map();      // name -> { id, type, callback, delay, created }
    this.paused = false;
    this.pausedTimers = new Map(); // name -> remaining time
    
    // Statistics
    this.stats = {
      totalScheduled: 0,
      totalExecuted: 0,
      totalCancelled: 0,
      currentActive: 0
    };
  }

  /**
   * Schedule a one-time timer
   * @param {string} name - Unique timer name
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {string} Timer name
   */
  setTimeout(name, callback, delay) {
    // Cancel existing timer with same name
    if (this.timers.has(name)) {
      this.clear(name);
    }

    const wrappedCallback = () => {
      this.stats.totalExecuted++;
      this.stats.currentActive--;
      this.timers.delete(name);
      try {
        callback();
      } catch (err) {
        console.error(`[TimerManager] Error in timer '${name}':`, err.message);
      }
    };

    const id = global.setTimeout(wrappedCallback, delay);
    
    this.timers.set(name, {
      id,
      type: 'timeout',
      callback,
      delay,
      created: Date.now(),
      remaining: delay
    });

    this.stats.totalScheduled++;
    this.stats.currentActive++;

    return name;
  }

  /**
   * Schedule a repeating timer
   * @param {string} name - Unique timer name
   * @param {Function} callback - Function to execute
   * @param {number} interval - Interval in milliseconds
   * @returns {string} Timer name
   */
  setInterval(name, callback, interval) {
    // Cancel existing timer with same name
    if (this.timers.has(name)) {
      this.clear(name);
    }

    const wrappedCallback = () => {
      this.stats.totalExecuted++;
      try {
        callback();
      } catch (err) {
        console.error(`[TimerManager] Error in interval '${name}':`, err.message);
      }
    };

    const id = global.setInterval(wrappedCallback, interval);
    
    this.timers.set(name, {
      id,
      type: 'interval',
      callback,
      delay: interval,
      created: Date.now()
    });

    this.stats.totalScheduled++;
    this.stats.currentActive++;

    return name;
  }

  /**
   * Schedule with random delay (useful for staggering)
   * @param {string} name - Timer name
   * @param {Function} callback - Function to execute
   * @param {number} minDelay - Minimum delay
   * @param {number} maxDelay - Maximum delay
   * @returns {string} Timer name
   */
  setRandomTimeout(name, callback, minDelay, maxDelay) {
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    return this.setTimeout(name, callback, delay);
  }

  /**
   * Clear a timer by name
   * @param {string} name - Timer name
   * @returns {boolean} True if timer was cleared
   */
  clear(name) {
    const timer = this.timers.get(name);
    if (!timer) return false;

    if (timer.type === 'timeout') {
      global.clearTimeout(timer.id);
    } else {
      global.clearInterval(timer.id);
    }

    this.timers.delete(name);
    this.pausedTimers.delete(name);
    this.stats.totalCancelled++;
    this.stats.currentActive--;

    return true;
  }

  /**
   * Check if a timer exists
   * @param {string} name - Timer name
   * @returns {boolean} True if timer exists
   */
  has(name) {
    return this.timers.has(name);
  }

  /**
   * Get remaining time for a timeout
   * @param {string} name - Timer name
   * @returns {number} Remaining ms or -1 if not found
   */
  getRemaining(name) {
    const timer = this.timers.get(name);
    if (!timer || timer.type !== 'timeout') return -1;
    
    const elapsed = Date.now() - timer.created;
    return Math.max(0, timer.delay - elapsed);
  }

  /**
   * Clear all timers
   */
  clearAll() {
    for (const [name, timer] of this.timers) {
      if (timer.type === 'timeout') {
        global.clearTimeout(timer.id);
      } else {
        global.clearInterval(timer.id);
      }
      this.stats.totalCancelled++;
    }
    this.stats.currentActive = 0;
    this.timers.clear();
    this.pausedTimers.clear();
  }

  /**
   * Clear all timers matching a prefix
   * @param {string} prefix - Timer name prefix
   * @returns {number} Number of timers cleared
   */
  clearByPrefix(prefix) {
    let count = 0;
    for (const name of this.timers.keys()) {
      if (name.startsWith(prefix)) {
        this.clear(name);
        count++;
      }
    }
    return count;
  }

  /**
   * Get all active timer names
   * @returns {string[]} Array of timer names
   */
  getActiveTimers() {
    return Array.from(this.timers.keys());
  }

  /**
   * Get statistics
   * @returns {object} Timer statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeTimers: this.getActiveTimers()
    };
  }

  /**
   * Debounce a function (only execute after delay with no new calls)
   * @param {string} name - Debounce name
   * @param {Function} callback - Function to execute
   * @param {number} delay - Delay in milliseconds
   */
  debounce(name, callback, delay) {
    this.clear(name);
    this.setTimeout(name, callback, delay);
  }

  /**
   * Throttle a function (execute at most once per interval)
   * @param {string} name - Throttle name
   * @param {Function} callback - Function to execute
   * @param {number} interval - Minimum interval between executions
   * @returns {boolean} True if executed, false if throttled
   */
  throttle(name, callback, interval) {
    const throttleName = `throttle-${name}`;
    if (this.has(throttleName)) {
      return false; // Throttled
    }
    
    callback();
    this.setTimeout(throttleName, () => {}, interval);
    return true;
  }
}

// Export singleton instance
const timerManager = new TimerManager();
module.exports = timerManager;

