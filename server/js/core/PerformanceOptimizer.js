// Performance Optimization System
class PerformanceOptimizer {
  constructor() {
    this.dirtyEntities = new Set();
    this.viewportBounds = { x: 0, y: 0, width: 768, height: 768 };
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
    
    // Entity update batching
    this.updateBatches = {
      high: new Set(),    // Update every frame
      medium: new Set(),  // Update every 2 frames
      low: new Set()      // Update every 4 frames
    };
    
    this.batchCounters = { high: 0, medium: 0, low: 0 };
  }
  
  // Mark entity as needing update
  markDirty(entityId, priority = 'medium') {
    this.dirtyEntities.add(entityId);
    this.updateBatches[priority].add(entityId);
  }
  
  // Get entities that need updating this frame
  getEntitiesToUpdate() {
    const entities = new Set();
    
    // Always update high priority entities
    entities.add(...this.updateBatches.high);
    
    // Update medium priority every 2 frames
    if (this.batchCounters.medium % 2 === 0) {
      entities.add(...this.updateBatches.medium);
    }
    
    // Update low priority every 4 frames
    if (this.batchCounters.low % 4 === 0) {
      entities.add(...this.updateBatches.low);
    }
    
    // Increment counters
    this.batchCounters.high++;
    this.batchCounters.medium++;
    this.batchCounters.low++;
    
    return entities;
  }
  
  // Check if entity is in viewport
  isInViewport(entity) {
    const margin = 100; // Extra margin for smooth scrolling
    return entity.x >= this.viewportBounds.x - margin &&
           entity.x <= this.viewportBounds.x + this.viewportBounds.width + margin &&
           entity.y >= this.viewportBounds.y - margin &&
           entity.y <= this.viewportBounds.y + this.viewportBounds.height + margin;
  }
  
  // Update viewport bounds
  updateViewport(x, y) {
    this.viewportBounds.x = x - this.viewportBounds.width / 2;
    this.viewportBounds.y = y - this.viewportBounds.height / 2;
  }
  
  // Calculate FPS
  updateFPS() {
    this.frameCount++;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - this.lastFrameTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }
  
  // Get performance stats
  getStats() {
    return {
      fps: this.fps,
      dirtyEntities: this.dirtyEntities.size,
      highPriority: this.updateBatches.high.size,
      mediumPriority: this.updateBatches.medium.size,
      lowPriority: this.updateBatches.low.size
    };
  }
  
  // Clear dirty flags
  clearDirty() {
    this.dirtyEntities.clear();
  }
}

// Export for use
module.exports = PerformanceOptimizer;
