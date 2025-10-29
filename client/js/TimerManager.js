// TimerManager - Centralized timer tracking and cleanup
class TimerManager {
  constructor() {
    this.intervals = new Map(); // id -> intervalId
    this.timeouts = new Map(); // id -> timeoutId
    this.nextId = 1;
    this.isCleaningUp = false;
    this.paused = false;
  }
  
  setInterval(callback, delay, ...args) {
    const id = this.nextId++;
    const intervalId = setInterval(() => {
      if (this.paused) return;
      try {
        callback(...args);
      } catch (e) {
        console.error('[TimerManager] Error in interval callback:', e);
      }
    }, delay);
    
    this.intervals.set(id, intervalId);
    if (window.performanceHUD && window.performanceHUD.enabled) {
      window.performanceHUD.trackInterval(id);
    }
    return id;
  }
  
  clearInterval(id) {
    const intervalId = this.intervals.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(id);
      if (window.performanceHUD && window.performanceHUD.enabled) {
        window.performanceHUD.untrackInterval(id);
      }
    } else {
      // Fallback: might be a native timer ID
      clearInterval(id);
    }
  }
  
  setTimeout(callback, delay, ...args) {
    const id = this.nextId++;
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(id);
      if (window.performanceHUD && window.performanceHUD.enabled) {
        window.performanceHUD.untrackTimeout(id);
      }
      
      // Skip if paused (simple check, no requeue to avoid recursion)
      if (this.paused) return;
      
      try {
        callback(...args);
      } catch (e) {
        console.error('[TimerManager] Error in timeout callback:', e);
      }
    }, delay);
    
    this.timeouts.set(id, timeoutId);
    if (window.performanceHUD && window.performanceHUD.enabled) {
      window.performanceHUD.trackTimeout(id);
    }
    return id;
  }
  
  clearTimeout(id) {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
      if (window.performanceHUD && window.performanceHUD.enabled) {
        window.performanceHUD.untrackTimeout(id);
      }
    } else {
      // Fallback: might be a native timer ID
      clearTimeout(id);
    }
  }
  
  // Cleanup all timers (called on disconnect, page unload, etc.)
  cleanup() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;
    
    // Clear all intervals
    for (const [id, intervalId] of this.intervals) {
      clearInterval(intervalId);
      if (window.performanceHUD && window.performanceHUD.enabled) {
        window.performanceHUD.untrackInterval(id);
      }
    }
    this.intervals.clear();
    
    // Clear all timeouts
    for (const [id, timeoutId] of this.timeouts) {
      clearTimeout(timeoutId);
      if (window.performanceHUD && window.performanceHUD.enabled) {
        window.performanceHUD.untrackTimeout(id);
      }
    }
    this.timeouts.clear();
    
    this.isCleaningUp = false;
  }
  
  // Cleanup specific scope (e.g., building preview timers)
  cleanupScope(scope) {
    // This can be extended to support scoped timers if needed
    // For now, we'll use a different approach with separate managers per scope
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }
  
  getStats() {
    return {
      activeIntervals: this.intervals.size,
      activeTimeouts: this.timeouts.size
    };
  }
}

// Lazy initialization - only create TimerManager when needed
window.timerManager = null;

// Helper functions that lazily initialize TimerManager only if HUD is enabled
window.getTimerManager = function() {
  // If HUD is enabled, use TimerManager
  if (window.performanceHUD && window.performanceHUD.enabled) {
    if (!window.timerManager) {
      window.timerManager = new TimerManager();
    }
    return window.timerManager;
  }
  // Return null to use native timers
  return null;
};

// Cleanup on page unload (only if we're tracking)
window.addEventListener('beforeunload', () => {
  if (window.timerManager && window.performanceHUD && window.performanceHUD.enabled) {
    window.timerManager.cleanup();
  }
});

