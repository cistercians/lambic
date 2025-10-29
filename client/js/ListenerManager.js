// ListenerManager - Centralized event listener tracking and cleanup
class ListenerManager {
  constructor() {
    this.listeners = new Map(); // element -> Map(eventType -> Set of callbacks)
    this.isCleaningUp = false;
  }
  
  addEventListener(element, eventType, callback, options) {
    if (!element) return;
    
    element.addEventListener(eventType, callback, options);
    
    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }
    
    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(eventType)) {
      elementListeners.set(eventType, new Set());
    }
    
    elementListeners.get(eventType).add(callback);
    
    // Track in performance HUD
    if (window.performanceHUD) {
      window.performanceHUD.trackListener(element, eventType);
    }
    
    // Return cleanup function
    return () => this.removeEventListener(element, eventType, callback);
  }
  
  removeEventListener(element, eventType, callback) {
    if (!element || !this.listeners.has(element)) return;
    
    const elementListeners = this.listeners.get(element);
    if (!elementListeners || !elementListeners.has(eventType)) return;
    
    const callbacks = elementListeners.get(eventType);
    if (callbacks.has(callback)) {
      element.removeEventListener(eventType, callback);
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        elementListeners.delete(eventType);
      }
      
      if (elementListeners.size === 0) {
        this.listeners.delete(element);
      }
      
      if (window.performanceHUD) {
        window.performanceHUD.untrackListener(element, eventType);
      }
    }
  }
  
  // Remove all listeners for a specific element
  removeAllListeners(element) {
    if (!element || !this.listeners.has(element)) return;
    
    const elementListeners = this.listeners.get(element);
    for (const [eventType, callbacks] of elementListeners) {
      for (const callback of callbacks) {
        element.removeEventListener(eventType, callback);
        if (window.performanceHUD) {
          window.performanceHUD.untrackListener(element, eventType);
        }
      }
    }
    
    this.listeners.delete(element);
  }
  
  // Cleanup all listeners (called on disconnect, page unload, etc.)
  cleanup() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;
    
    for (const [element, elementListeners] of this.listeners) {
      for (const [eventType, callbacks] of elementListeners) {
        for (const callback of callbacks) {
          element.removeEventListener(eventType, callback);
          if (window.performanceHUD) {
            window.performanceHUD.untrackListener(element, eventType);
          }
        }
      }
    }
    
    this.listeners.clear();
    this.isCleaningUp = false;
  }
  
  // Cleanup specific scope (e.g., UI menu listeners)
  cleanupScope(scope) {
    // This can be extended if needed
  }
  
  getStats() {
    let totalListeners = 0;
    for (const elementListeners of this.listeners.values()) {
      for (const callbacks of elementListeners.values()) {
        totalListeners += callbacks.size;
      }
    }
    
    return {
      totalListeners,
      elementsWithListeners: this.listeners.size
    };
  }
}

// Lazy initialization - only create when PerformanceHUD is enabled
window.listenerManager = null;

// Helper to get ListenerManager (only if HUD is enabled)
window.getListenerManager = function() {
  if (window.performanceHUD && window.performanceHUD.enabled) {
    if (!window.listenerManager) {
      window.listenerManager = new ListenerManager();
    }
    return window.listenerManager;
  }
  return null;
};

// Cleanup on page unload (only if initialized)
window.addEventListener('beforeunload', () => {
  if (window.listenerManager) {
    window.listenerManager.cleanup();
  }
});

