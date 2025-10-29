// Performance HUD - Real-time performance monitoring
class PerformanceHUD {
  constructor() {
    this.enabled = false; // Disabled by default to avoid performance impact
    this.container = null;
    this.frameCount = 0;
    this.frameTimeHistory = [];
    this.maxHistorySize = 60; // 1 second at 60fps
    this.lastFPSUpdate = Date.now();
    this.lastSecondFrameCount = 0;
    this.fps = 0;
    
    // Tracking - only maintain lightweight sets when disabled
    this.activeIntervals = new Set();
    this.activeTimeouts = new Set();
    this.activeListeners = new Map(); // element -> Set of event types
    
    this.entityCounts = {
      players: 0,
      items: 0,
      arrows: 0,
      buildings: 0,
      lights: 0
    };
    
    this.updatePacketsPerSecond = 0;
    this.lastPacketCount = 0;
    this.lastPacketTime = Date.now();
    this._pendingDisplay = false;
    this._displayIntervalMs = 250; // max 4 updates/sec
    this._frameTrackingActive = false; // Track if RAF loop is running
    
    // Don't create HUD or start tracking by default
    // User must explicitly enable with Shift+P
  }
  
  createHUD() {
    if (!this.enabled) return;
    
    this.container = document.createElement('div');
    this.container.id = 'performance-hud';
    this.container.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border: 1px solid #0f0;
      border-radius: 4px;
      z-index: 10000;
      min-width: 250px;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.container);
    this.updateDisplay();
    
    // Enable toggle with Shift+P (only add listener if we have a container)
    // Don't add listener until HUD is created to avoid overhead
  }
  
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('perfHUD', this.enabled ? 'true' : 'false');
    if (this.enabled) {
      this.createHUD();
      this.startTracking();
    } else {
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      this.stopTracking();
    }
  }
  
  startTracking() {
    if (!this.enabled || this._frameTrackingActive) return;
    
    this._frameTrackingActive = true;
    // Track frame times
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.trackFrame.bind(this));
  }
  
  stopTracking() {
    this._frameTrackingActive = false;
    // Cleanup handled by removing container
  }
  
  trackFrame(currentTime) {
    if (!this.enabled || !this._frameTrackingActive) {
      this._frameTrackingActive = false;
      return;
    }
    
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    this.frameTimeHistory.push(deltaTime);
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }
    
    this.frameCount++;
    this.lastSecondFrameCount++;
    
    // Update FPS every second
    if (currentTime - this.lastFPSUpdate >= 1000) {
      this.fps = this.lastSecondFrameCount;
      this.lastSecondFrameCount = 0;
      this.lastFPSUpdate = currentTime;
      this._scheduleDisplay();
    }
    
    requestAnimationFrame(this.trackFrame.bind(this));
  }
  
  updateDisplay() {
    if (!this.container || !this.enabled) return;
    
    const sortedTimes = [...this.frameTimeHistory].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    
    // Update entity counts
    if (typeof Player !== 'undefined' && Player.list) {
      this.entityCounts.players = Object.keys(Player.list).length;
    }
    if (typeof Item !== 'undefined' && Item.list) {
      this.entityCounts.items = Object.keys(Item.list).length;
    }
    if (typeof Arrow !== 'undefined' && Arrow.list) {
      this.entityCounts.arrows = Object.keys(Arrow.list).length;
    }
    if (typeof Building !== 'undefined' && Building.list) {
      this.entityCounts.buildings = Object.keys(Building.list).length;
    }
    if (typeof Light !== 'undefined' && Light.list) {
      this.entityCounts.lights = Object.keys(Light.list).length;
    }
    
    this.container.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">
        Performance HUD (Shift+P to toggle)
      </div>
      <div>FPS: ${this.fps}</div>
      <div>Frame Time (p50): ${p50.toFixed(1)}ms</div>
      <div>Frame Time (p95): ${p95.toFixed(1)}ms</div>
      <div style="margin-top: 5px; border-top: 1px solid #0f0; padding-top: 5px;">
        <div>Active Intervals: ${this.activeIntervals.size}</div>
        <div>Active Timeouts: ${this.activeTimeouts.size}</div>
        <div>Active Listeners: ${Array.from(this.activeListeners.values()).reduce((sum, set) => sum + set.size, 0)}</div>
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #0f0; padding-top: 5px;">
        <div>Players: ${this.entityCounts.players}</div>
        <div>Items: ${this.entityCounts.items}</div>
        <div>Arrows: ${this.entityCounts.arrows}</div>
        <div>Buildings: ${this.entityCounts.buildings}</div>
        <div>Lights: ${this.entityCounts.lights}</div>
      </div>
      <div style="margin-top: 5px; border-top: 1px solid #0f0; padding-top: 5px;">
        <div>Updates/sec: ${this.updatePacketsPerSecond}</div>
      </div>
    `;
  }
  
  trackInterval(id) {
    this.activeIntervals.add(id);
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  untrackInterval(id) {
    this.activeIntervals.delete(id);
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  trackTimeout(id) {
    this.activeTimeouts.add(id);
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  untrackTimeout(id) {
    this.activeTimeouts.delete(id);
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  trackListener(element, eventType) {
    if (!this.activeListeners.has(element)) {
      this.activeListeners.set(element, new Set());
    }
    this.activeListeners.get(element).add(eventType);
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  untrackListener(element, eventType) {
    const listeners = this.activeListeners.get(element);
    if (listeners) {
      listeners.delete(eventType);
      if (listeners.size === 0) {
        this.activeListeners.delete(element);
      }
    }
    if (this.enabled) {
      this._scheduleDisplay();
    }
  }
  
  recordUpdatePacket() {
    if (!this.enabled) return; // Skip all work when disabled
    const now = Date.now();
    if (now - this.lastPacketTime >= 1000) {
      this.updatePacketsPerSecond = this.lastPacketCount;
      this.lastPacketCount = 0;
      this.lastPacketTime = now;
    } else {
      this.lastPacketCount++;
    }
    this._scheduleDisplay();
  }

  _scheduleDisplay(){
    if(!this.enabled || !this.container) return;
    if(this._pendingDisplay) return;
    this._pendingDisplay = true;
    setTimeout(() => {
      this._pendingDisplay = false;
      this.updateDisplay();
    }, this._displayIntervalMs);
  }
}

// Lazy initialization - only create when explicitly enabled
window.performanceHUD = null;

// Global key handler for Shift+P - lazy creates HUD on first enable
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
    if (!window.performanceHUD) {
      window.performanceHUD = new PerformanceHUD();
    }
    window.performanceHUD.toggle();
  }
});

