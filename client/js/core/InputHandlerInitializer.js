/**
 * InputHandlerInitializer - Initializes InputHandler with all dependencies
 * 
 * Extracted from client.js for better organization.
 */

class InputHandlerInitializer {
  constructor() {
    this.inputHandler = null;
    this.updateInterval = null;
  }

  /**
   * Initialize InputHandler with all dependencies
   * @param {object} config - Configuration object
   */
  init(config) {
    if (typeof InputHandler === 'undefined') {
      console.warn('InputHandler not loaded, using legacy handlers');
      return;
    }

    this.inputHandler = new InputHandler(config);
    
    // Update config when variables change (for mutable state)
    this.startUpdateInterval(config.updateConfig);
    
    return this.inputHandler;
  }

  /**
   * Start interval to update InputHandler config
   * @param {function} updateConfigFn - Function to get current config values
   */
  startUpdateInterval(updateConfigFn) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      if (this.inputHandler && updateConfigFn) {
        this.inputHandler.updateConfig(updateConfigFn());
      }
    }, 100);
  }

  /**
   * Stop update interval
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get InputHandler instance
   * @returns {InputHandler|null} Handler instance
   */
  getHandler() {
    return this.inputHandler;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.InputHandlerInitializer = InputHandlerInitializer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputHandlerInitializer;
}

