// Optimized Entity Update System
class OptimizedEntityManager {
  constructor() {
    this.entities = new Map();
    this.updateQueue = new Map();
    this.removalQueue = new Set();
    this.lastUpdateTime = 0;
    
    // Performance tracking
    this.updateStats = {
      totalUpdates: 0,
      skippedUpdates: 0,
      averageUpdateTime: 0
    };
  }
  
  // Add entity with update priority
  addEntity(entity, priority = 'medium') {
    this.entities.set(entity.id, {
      entity,
      priority,
      lastUpdate: 0,
      needsUpdate: true,
      updateCount: 0
    });
  }
  
  // Mark entity for removal
  markForRemoval(entityId) {
    this.removalQueue.add(entityId);
  }
  
  // Process entity updates with batching
  updateEntities(deltaTime) {
    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    let updated = 0;
    let skipped = 0;
    
    // Process removals first
    this.processRemovals();
    
    // Update entities based on priority and delta time
    for (const [id, data] of this.entities) {
      const shouldUpdate = this.shouldUpdateEntity(data, deltaTime);
      
      if (shouldUpdate) {
        try {
          data.entity.update();
          data.lastUpdate = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          data.updateCount++;
          data.needsUpdate = false;
          updated++;
        } catch (error) {
          console.error(`Error updating entity ${id}:`, error);
          this.markForRemoval(id);
        }
      } else {
        skipped++;
      }
    }
    
    // Update stats
    const nowEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const updateTime = nowEnd - startTime;
    this.updateStats.totalUpdates += updated;
    this.updateStats.skippedUpdates += skipped;
    this.updateStats.averageUpdateTime = 
      (this.updateStats.averageUpdateTime + updateTime) / 2;
    
    return { updated, skipped, updateTime };
  }
  
  // Determine if entity should update this frame
  shouldUpdateEntity(data, deltaTime) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const timeSinceLastUpdate = now - data.lastUpdate;
    
    // Always update if marked as dirty
    if (data.needsUpdate) return true;
    
    // Update based on priority
    switch (data.priority) {
      case 'high':
        return timeSinceLastUpdate >= 16; // ~60 FPS
      case 'medium':
        return timeSinceLastUpdate >= 33; // ~30 FPS
      case 'low':
        return timeSinceLastUpdate >= 66; // ~15 FPS
      default:
        return timeSinceLastUpdate >= 33;
    }
  }
  
  // Process entity removals
  processRemovals() {
    for (const entityId of this.removalQueue) {
      const data = this.entities.get(entityId);
      if (data) {
        // Cleanup entity resources
        if (data.entity.cleanup) {
          data.entity.cleanup();
        }
        
        // Remove from tracking
        this.entities.delete(entityId);
      }
    }
    this.removalQueue.clear();
  }
  
  // Get entities in viewport
  getEntitiesInViewport(viewportBounds) {
    const visibleEntities = [];
    
    for (const [id, data] of this.entities) {
      const entity = data.entity;
      
      // Simple viewport check
      if (entity.x >= viewportBounds.x - 100 &&
          entity.x <= viewportBounds.x + viewportBounds.width + 100 &&
          entity.y >= viewportBounds.y - 100 &&
          entity.y <= viewportBounds.y + viewportBounds.height + 100) {
        visibleEntities.push(entity);
      }
    }
    
    return visibleEntities;
  }
  
  // Get update statistics
  getStats() {
    return {
      totalEntities: this.entities.size,
      pendingRemovals: this.removalQueue.size,
      ...this.updateStats
    };
  }
  
  // Force update all entities (for debugging)
  forceUpdateAll() {
    for (const [id, data] of this.entities) {
      data.needsUpdate = true;
    }
  }
}

// Export for use
module.exports = OptimizedEntityManager;
