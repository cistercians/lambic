// server/js/core/SpatialIntegration.js
// Integration layer to replace the old zone system with intelligent spatial partitioning

const SpatialIndex = require('./SpatialIndex');

class SpatialIntegration {
  constructor() {
    this.spatialIndex = new SpatialIndex(64); // 64-pixel cells
    this.entityRadii = new Map(); // Track entity interaction radii
    this.updateQueue = new Set(); // Entities that need spatial updates
    this.lastOptimization = Date.now();
    this.optimizationInterval = 60000; // Optimize every 60 seconds to reduce lag spikes
  }

  // Initialize the spatial system
  initialize() {
    console.log('Initializing intelligent spatial partitioning system...');
    this.spatialIndex.clear();
    
    // Add all existing entities
    for (const entityId of Object.keys(global.Player.list)) {
      const entity = global.Player.list[entityId];
      if (entity && typeof entity.x === 'number' && typeof entity.y === 'number') {
        this.addEntity(entityId, entity);
      }
    }
    
    console.log(`Spatial system initialized with ${this.spatialIndex.stats.entitiesTracked} entities`);
  }

  // Add entity to spatial system
  addEntity(entityId, entity) {
    const radius = this.getEntityRadius(entity);
    this.entityRadii.set(entityId, radius);
    this.spatialIndex.addEntity(entityId, entity.x, entity.y, radius);
  }

  // Remove entity from spatial system
  removeEntity(entityId) {
    this.spatialIndex.removeEntity(entityId);
    this.entityRadii.delete(entityId);
    this.updateQueue.delete(entityId);
  }

  // Update entity position in spatial system
  updateEntity(entityId, entity) {
    if (!entity || typeof entity.x !== 'number' || typeof entity.y !== 'number') {
      return;
    }

    const radius = this.getEntityRadius(entity);
    const oldRadius = this.entityRadii.get(entityId);
    
    // Only update if position or radius changed significantly
    if (oldRadius !== radius) {
      this.entityRadii.set(entityId, radius);
      this.spatialIndex.addEntity(entityId, entity.x, entity.y, radius);
    } else {
      // Check if entity moved to a different cell
      const currentCells = this.spatialIndex.getEntityCells(entity.x, entity.y, radius);
      const trackedCells = this.spatialIndex.entityCells.get(entityId) || new Set();
      
      // Simple check: if cell sets are different, update
      if (currentCells.size !== trackedCells.size || 
          ![...currentCells].every(cell => trackedCells.has(cell))) {
        this.spatialIndex.addEntity(entityId, entity.x, entity.y, radius);
      }
    }
  }

  // Get appropriate radius for entity type
  getEntityRadius(entity) {
    if (!entity) return 0;
    
    // Base radius on entity type and capabilities
    switch (entity.class) {
      case 'Player':
        return 80; // Players have larger interaction radius
      case 'Serf':
        return 60; // Serfs need to interact with buildings
      case 'Wolf':
      case 'Bear':
        return 100; // Aggressive animals have larger aggro radius
      case 'Deer':
      case 'Rabbit':
        return 40; // Passive animals have smaller radius
      case 'Innkeeper':
      case 'Merchant':
        return 50; // NPCs have moderate interaction radius
      default:
        return 50; // Default radius
    }
  }

  // Find entities within aggro range (replaces zone-based aggro checks)
  findAggroTargets(entity, aggroRange = null) {
    if (!entity) return [];
    
    const range = aggroRange || this.getEntityRadius(entity) * 1.5;
    const nearby = this.spatialIndex.findNearby(
      entity.x, 
      entity.y, 
      range,
      (targetId) => {
        const target = global.Player.list[targetId];
        return target && target.z === entity.z && target.id !== entity.id;
      }
    );

    return nearby.map(id => global.Player.list[id]).filter(Boolean);
  }

  // Find entities for combat interactions
  findCombatTargets(entity, combatRange = null) {
    if (!entity) return [];
    
    const range = combatRange || this.getEntityRadius(entity);
    return this.findAggroTargets(entity, range);
  }

  // Find entities for social interactions (taverns, trading, etc.)
  findSocialTargets(entity, socialRange = 30) {
    if (!entity) return [];
    
    return this.spatialIndex.findNearby(
      entity.x, 
      entity.y, 
      socialRange,
      (targetId) => {
        const target = global.Player.list[targetId];
        return target && target.z === entity.z && target.id !== entity.id;
      }
    ).map(id => global.Player.list[id]).filter(Boolean);
  }

  // Find work targets (buildings, resources)
  findWorkTargets(entity, workRange = 50) {
    if (!entity) return [];
    
    return this.spatialIndex.findNearby(
      entity.x, 
      entity.y, 
      workRange,
      (targetId) => {
        const target = global.Player.list[targetId];
        return target && target.z === entity.z && 
               (target.type === 'building' || target.type === 'resource');
      }
    ).map(id => global.Player.list[id]).filter(Boolean);
  }

  // Batch update multiple entities (more efficient than individual updates)
  batchUpdate(entities) {
    for (const entityId of entities) {
      const entity = global.Player.list[entityId];
      if (entity) {
        this.updateEntity(entityId, entity);
      }
    }
  }

  // Periodic optimization
  optimize() {
    const now = Date.now();
    if (now - this.lastOptimization > this.optimizationInterval) {
      this.spatialIndex.optimizeCellSize();
      this.lastOptimization = now;
      
      const stats = this.spatialIndex.getStats();
      if (stats.entitiesTracked > 0) {
        console.log(`Spatial optimization: ${stats.entitiesTracked} entities, ${stats.cellsUsed} cells, ${stats.cacheHitRate} cache hit rate`);
      }
    }
  }

  // Get performance statistics
  getStats() {
    return this.spatialIndex.getStats();
  }

  // Clean up old entities (call periodically)
  cleanup() {
    const validEntities = new Set();
    for (const entityId of Object.keys(global.Player.list)) {
      if (global.Player.list[entityId]) {
        validEntities.add(entityId);
      }
    }

    // Remove entities that no longer exist
    for (const entityId of this.spatialIndex.entityCells.keys()) {
      if (!validEntities.has(entityId)) {
        this.removeEntity(entityId);
      }
    }
  }
}

module.exports = SpatialIntegration;
