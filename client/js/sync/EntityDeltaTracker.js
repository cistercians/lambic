/**
 * EntityDeltaTracker - Tracks entity state changes to minimize unnecessary updates
 * 
 * This module caches the last known state of entities and provides methods to:
 * 1. Check if a property actually changed before updating
 * 2. Track which properties need interpolation
 * 3. Reduce memory allocations during update processing
 * 
 * Performance improvements:
 * - Skips updates when values haven't changed
 * - Pre-allocates update buffers to avoid GC pressure
 * - Provides interpolation hints for smooth movement
 */

class EntityDeltaTracker {
  constructor() {
    // Cache of previous entity states - keyed by entity ID
    this._playerStateCache = new Map();
    this._itemStateCache = new Map();
    this._buildingStateCache = new Map();
    
    // Properties that should be interpolated (position/rotation)
    this._interpolatedProps = new Set(['x', 'y', 'angle']);
    
    // Properties that need immediate update (visual state changes)
    this._immediateProps = new Set([
      'facing', 'pressingUp', 'pressingDown', 'pressingLeft', 'pressingRight',
      'pressingAttack', 'working', 'combat', 'hp', 'hpMax', 'spirit', 'spiritMax',
      'z', 'stealthed', 'revealed', 'ghost', 'class'
    ]);
    
    // Properties that can be throttled (low-frequency updates)
    this._throttledProps = new Set([
      'name', 'rank', 'house', 'kingdom', 'friends', 'enemies',
      'gear', 'inventory', 'kills', 'skulls'
    ]);
    
    // Reusable update result object to avoid allocations
    this._updateResult = {
      hasChanges: false,
      changedProps: [],
      needsInterpolation: false
    };
    
    // Statistics for debugging
    this._stats = {
      totalUpdates: 0,
      skippedUpdates: 0,
      interpolatedUpdates: 0
    };
  }

  /**
   * Process a player update packet and return only changed properties
   * @param {object} entity - The entity to update
   * @param {object} pack - The update packet from server
   * @returns {object} Update result with changed properties
   */
  processPlayerUpdate(entity, pack) {
    if (!entity || !pack || !pack.id) return null;
    
    const id = pack.id;
    let cachedState = this._playerStateCache.get(id);
    
    // Initialize cache for new entity
    if (!cachedState) {
      cachedState = {};
      this._playerStateCache.set(id, cachedState);
    }
    
    // Reset result object (avoid allocation)
    const result = this._updateResult;
    result.hasChanges = false;
    result.changedProps.length = 0;
    result.needsInterpolation = false;
    
    this._stats.totalUpdates++;
    
    // Check each property in the pack
    for (const prop in pack) {
      if (prop === 'id') continue;
      
      const newValue = pack[prop];
      const oldValue = cachedState[prop];
      
      // Skip if value hasn't changed (using strict comparison)
      if (newValue === oldValue) {
        this._stats.skippedUpdates++;
        continue;
      }
      
      // Value changed - update cache and entity
      cachedState[prop] = newValue;
      result.hasChanges = true;
      result.changedProps.push(prop);
      
      // Check if this property needs interpolation
      if (this._interpolatedProps.has(prop)) {
        result.needsInterpolation = true;
        this._stats.interpolatedUpdates++;
        
        // Store previous value for interpolation
        if (entity[prop] !== undefined) {
          entity['_prev_' + prop] = entity[prop];
          entity['_lerp_' + prop] = 0; // Interpolation progress
        }
      }
      
      // Update entity property
      entity[prop] = newValue;
    }
    
    return result.hasChanges ? result : null;
  }

  /**
   * Process an item update packet
   * @param {object} entity - The item entity
   * @param {object} pack - Update packet
   * @returns {object|null} Update result or null if no changes
   */
  processItemUpdate(entity, pack) {
    if (!entity || !pack || !pack.id) return null;
    
    const id = pack.id;
    let cachedState = this._itemStateCache.get(id);
    
    if (!cachedState) {
      cachedState = {};
      this._itemStateCache.set(id, cachedState);
    }
    
    let hasChanges = false;
    
    for (const prop in pack) {
      if (prop === 'id') continue;
      
      const newValue = pack[prop];
      if (newValue !== cachedState[prop]) {
        cachedState[prop] = newValue;
        entity[prop] = newValue;
        hasChanges = true;
      }
    }
    
    return hasChanges ? { hasChanges: true } : null;
  }

  /**
   * Process a building update packet
   * @param {object} entity - The building entity
   * @param {object} pack - Update packet
   * @returns {object|null} Update result or null if no changes
   */
  processBuildingUpdate(entity, pack) {
    if (!entity || !pack || !pack.id) return null;
    
    const id = pack.id;
    let cachedState = this._buildingStateCache.get(id);
    
    if (!cachedState) {
      cachedState = {};
      this._buildingStateCache.set(id, cachedState);
    }
    
    let hasChanges = false;
    
    for (const prop in pack) {
      if (prop === 'id') continue;
      
      const newValue = pack[prop];
      if (newValue !== cachedState[prop]) {
        cachedState[prop] = newValue;
        entity[prop] = newValue;
        hasChanges = true;
      }
    }
    
    return hasChanges ? { hasChanges: true } : null;
  }

  /**
   * Remove entity from tracking (when entity is removed from game)
   * @param {string} type - Entity type ('player', 'item', 'building')
   * @param {string} id - Entity ID
   */
  removeEntity(type, id) {
    switch (type) {
      case 'player':
        this._playerStateCache.delete(id);
        break;
      case 'item':
        this._itemStateCache.delete(id);
        break;
      case 'building':
        this._buildingStateCache.delete(id);
        break;
    }
  }

  /**
   * Clear all cached state (e.g., on disconnect)
   */
  clearAll() {
    this._playerStateCache.clear();
    this._itemStateCache.clear();
    this._buildingStateCache.clear();
  }

  /**
   * Get tracking statistics
   * @returns {object} Statistics
   */
  getStats() {
    const total = this._stats.totalUpdates || 1;
    return {
      ...this._stats,
      skipRate: (this._stats.skippedUpdates / total * 100).toFixed(1) + '%',
      interpolationRate: (this._stats.interpolatedUpdates / total * 100).toFixed(1) + '%',
      trackedPlayers: this._playerStateCache.size,
      trackedItems: this._itemStateCache.size,
      trackedBuildings: this._buildingStateCache.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this._stats.totalUpdates = 0;
    this._stats.skippedUpdates = 0;
    this._stats.interpolatedUpdates = 0;
  }
}

// Create singleton instance
const entityDeltaTracker = new EntityDeltaTracker();

// Export for browser and Node.js
if (typeof window !== 'undefined') {
  window.entityDeltaTracker = entityDeltaTracker;
  window.EntityDeltaTracker = EntityDeltaTracker;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = entityDeltaTracker;
}

