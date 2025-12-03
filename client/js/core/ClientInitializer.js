/**
 * ClientInitializer - Centralizes all client-side initialization
 * 
 * Extracted from client.js for better organization.
 */

class ClientInitializer {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize all client systems
   * @param {object} config - Configuration object
   */
  init(config) {
    if (this.initialized) {
      console.warn('[ClientInitializer] Already initialized');
      return;
    }

    const {
      uiElements,
      socketManager,
      loginHandler,
      uiEventHandlers,
      canvasManager
    } = config;

    // Initialize UI elements via UIInitializer
    if (typeof UIInitializer !== 'undefined' && !window.uiInitializer) {
      window.uiInitializer = new UIInitializer();
    }

    // Initialize socket connection
    if (socketManager) {
      socketManager.init();
    }

    // Initialize login handlers
    if (loginHandler && typeof LoginHandler !== 'undefined') {
      new LoginHandler(loginHandler.config);
    }

    // Initialize UI event handlers
    if (uiEventHandlers && typeof UIEventHandlers !== 'undefined') {
      new UIEventHandlers(uiEventHandlers.config);
    }

    // Initialize canvas manager
    if (canvasManager && typeof CanvasManager !== 'undefined') {
      if (!window.canvasManager) {
        window.canvasManager = new CanvasManager();
      }
    }

    this.initialized = true;
  }

  /**
   * Get UI element safely
   * @param {string} elementId - Element ID
   * @returns {HTMLElement|null} Element or null
   */
  getUIElement(elementId) {
    if (typeof window !== 'undefined' && window.uiInitializer) {
      return window.uiInitializer.getElementById(elementId);
    }
    return document.getElementById(elementId);
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ClientInitializer = ClientInitializer;
  window.clientInitializer = new ClientInitializer();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClientInitializer;
}

