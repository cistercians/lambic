/**
 * Logger - Simple logging utility with log levels
 * 
 * Provides consistent logging across the codebase with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Category-based filtering
 * - Timestamps
 * - Easy enable/disable for debugging
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    // Default log level - can be set via environment variable
    this.level = process.env.DEBUG ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO;
    
    // Categories that are enabled (null = all enabled)
    this.enabledCategories = null;
    
    // Disabled categories (takes precedence over enabledCategories)
    this.disabledCategories = new Set();
  }

  /**
   * Set the minimum log level
   * @param {string} level - 'DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = LOG_LEVELS[level];
    }
  }

  /**
   * Enable only specific categories
   * @param {string[]} categories - Array of category names
   */
  enableCategories(categories) {
    this.enabledCategories = new Set(categories);
  }

  /**
   * Disable specific categories
   * @param {string[]} categories - Array of category names to disable
   */
  disableCategories(categories) {
    categories.forEach(cat => this.disabledCategories.add(cat));
  }

  /**
   * Enable all categories
   */
  enableAll() {
    this.enabledCategories = null;
    this.disabledCategories.clear();
  }

  /**
   * Check if a category should be logged
   * @param {string} category - Category name
   * @returns {boolean} Whether to log
   */
  _shouldLog(category) {
    if (this.disabledCategories.has(category)) {
      return false;
    }
    if (this.enabledCategories === null) {
      return true;
    }
    return this.enabledCategories.has(category);
  }

  /**
   * Format a log message
   * @param {string} level - Log level
   * @param {string} category - Category
   * @param {string} message - Message
   * @returns {string} Formatted message
   */
  _format(level, category, message) {
    const timestamp = new Date().toISOString().substr(11, 8);
    return `[${timestamp}] [${level}] [${category}] ${message}`;
  }

  /**
   * Log a debug message
   * @param {string} category - Category name
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  debug(category, message, ...args) {
    if (this.level <= LOG_LEVELS.DEBUG && this._shouldLog(category)) {
      console.log(this._format('DEBUG', category, message), ...args);
    }
  }

  /**
   * Log an info message
   * @param {string} category - Category name
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  info(category, message, ...args) {
    if (this.level <= LOG_LEVELS.INFO && this._shouldLog(category)) {
      console.log(this._format('INFO', category, message), ...args);
    }
  }

  /**
   * Log a warning message
   * @param {string} category - Category name
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  warn(category, message, ...args) {
    if (this.level <= LOG_LEVELS.WARN && this._shouldLog(category)) {
      console.warn(this._format('WARN', category, message), ...args);
    }
  }

  /**
   * Log an error message
   * @param {string} category - Category name
   * @param {string} message - Log message
   * @param {...any} args - Additional arguments
   */
  error(category, message, ...args) {
    if (this.level <= LOG_LEVELS.ERROR && this._shouldLog(category)) {
      console.error(this._format('ERROR', category, message), ...args);
    }
  }
}

// Export singleton instance and LOG_LEVELS
const logger = new Logger();
module.exports = { logger, LOG_LEVELS };

