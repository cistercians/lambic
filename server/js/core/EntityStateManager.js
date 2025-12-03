/**
 * EntityStateManager - Centralized entity lifecycle management
 * 
 * Handles entity creation, updates, and removal in a consistent way.
 * This separates entity state management from entity behavior logic.
 * 
 * Benefits:
 * - Centralized entity lifecycle
 * - Consistent update ordering
 * - Easy to add hooks/validation
 * - Cleaner Entity classes (just data + minimal logic)
 */

const entityRegistry = require('./EntityRegistry');

class EntityStateManager {
  constructor() {
    // Update ordering (lower = earlier)
    this.updateOrder = [
      'players',
      'buildings', 
      'items',
      'arrows',
      'lights',
      'weather'
    ];

    // Statistics
    this.stats = {
      totalUpdates: 0,
      updatesByType: new Map(),
      entitiesCreated: 0,
      entitiesRemoved: 0
    };

    // Hooks for entity lifecycle events
    this.onCreateHooks = new Map();
    this.onUpdateHooks = new Map();
    this.onRemoveHooks = new Map();
  }

  /**
   * Register a hook for entity creation
   * @param {string} type - Entity type (null for all types)
   * @param {Function} hook - Hook function (entity, type)
   */
  onCreate(type, hook) {
    if (!this.onCreateHooks.has(type)) {
      this.onCreateHooks.set(type, []);
    }
    this.onCreateHooks.get(type).push(hook);
  }

  /**
   * Register a hook for entity updates
   * @param {string} type - Entity type (null for all types)
   * @param {Function} hook - Hook function (entity, type)
   */
  onUpdate(type, hook) {
    if (!this.onUpdateHooks.has(type)) {
      this.onUpdateHooks.set(type, []);
    }
    this.onUpdateHooks.get(type).push(hook);
  }

  /**
   * Register a hook for entity removal
   * @param {string} type - Entity type (null for all types)
   * @param {Function} hook - Hook function (entity, type)
   */
  onRemove(type, hook) {
    if (!this.onRemoveHooks.has(type)) {
      this.onRemoveHooks.set(type, []);
    }
    this.onRemoveHooks.get(type).push(hook);
  }

  /**
   * Create a new entity and register it
   * @param {string} type - Entity type
   * @param {string|number} id - Entity ID
   * @param {object} entity - Entity object
   * @returns {boolean} Success
   */
  createEntity(type, id, entity) {
    // Register in entity registry (single source of truth for entities)
    const success = entityRegistry.addEntity(type, id, entity);
    
    if (success) {
      this.stats.entitiesCreated++;
      this._triggerHooks(this.onCreateHooks, type, entity);
    }
    
    return success;
  }

  /**
   * Remove an entity
   * @param {string} type - Entity type
   * @param {string|number} id - Entity ID
   * @returns {boolean} Success
   */
  removeEntity(type, id) {
    const entity = entityRegistry.getEntity(type, id);
    
    if (entity) {
      this._triggerHooks(this.onRemoveHooks, type, entity);
    }
    
    const success = entityRegistry.removeEntity(type, id);
    
    if (success) {
      this.stats.entitiesRemoved++;
    }
    
    return success;
  }

  /**
   * Update all entities in order
   * @returns {object} Update packs for each entity type
   */
  updateAll() {
    const updatePacks = {};
    
    // Update entities in specified order
    for (const type of this.updateOrder) {
      const entities = entityRegistry.getEntities(type);
      
      if (entities.length === 0) {
        updatePacks[type] = [];
        continue;
      }

      // Get the update function for this entity type
      const updateFn = this._getUpdateFunction(type);
      if (!updateFn) {
        updatePacks[type] = [];
        continue;
      }

      // Call the update function (legacy pattern: EntityType.update() returns pack)
      const pack = updateFn();
      updatePacks[type] = pack || [];
      
      // Update statistics
      const currentCount = this.stats.updatesByType.get(type) || 0;
      this.stats.updatesByType.set(type, currentCount + 1);
      this.stats.totalUpdates++;
      
      // Trigger update hooks
      for (const entity of entities) {
        this._triggerHooks(this.onUpdateHooks, type, entity);
      }
    }
    
    return updatePacks;
  }

  /**
   * Update entities of a specific type
   * @param {string} type - Entity type
   * @returns {Array} Update pack
   */
  updateType(type) {
    const updateFn = this._getUpdateFunction(type);
    if (!updateFn) {
      return [];
    }

    const pack = updateFn() || [];
    
    // Update statistics
    const currentCount = this.stats.updatesByType.get(type) || 0;
    this.stats.updatesByType.set(type, currentCount + 1);
    
    // Trigger update hooks
    const entities = entityRegistry.getEntities(type);
    for (const entity of entities) {
      this._triggerHooks(this.onUpdateHooks, type, entity);
    }
    
    return pack;
  }

  /**
   * Get update statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      totalUpdates: this.stats.totalUpdates,
      updatesByType: Object.fromEntries(this.stats.updatesByType),
      entitiesCreated: this.stats.entitiesCreated,
      entitiesRemoved: this.stats.entitiesRemoved
    };
  }

  /**
   * Clear all statistics
   */
  clearStats() {
    this.stats = {
      totalUpdates: 0,
      updatesByType: new Map(),
      entitiesCreated: 0,
      entitiesRemoved: 0
    };
  }

  // Private helper methods

  /**
   * Get the update function for an entity type (legacy pattern)
   * @param {string} type - Entity type
   * @returns {Function|null} Update function
   */
  _getUpdateFunction(type) {
    // Map type names to global constructors (legacy pattern)
    const typeMap = {
      'players': 'Player',
      'buildings': 'Building',
      'items': 'Item',
      'arrows': 'Arrow',
      'lights': 'Light',
      'weather': 'Weather'
    };

    const constructorName = typeMap[type];
    if (!constructorName) {
      return null;
    }

    // Try to get from global (legacy pattern)
    const Constructor = global[constructorName];
    if (!Constructor || typeof Constructor.update !== 'function') {
      return null;
    }

    return Constructor.update.bind(Constructor);
  }

  /**
   * Trigger hooks for a specific event
   * @param {Map} hooksMap - Map of hooks by type
   * @param {string} type - Entity type
   * @param {object} entity - Entity object
   */
  _triggerHooks(hooksMap, type, entity) {
    // Trigger type-specific hooks
    if (hooksMap.has(type)) {
      hooksMap.get(type).forEach(hook => {
        try {
          hook(entity, type);
        } catch (e) {
          console.error(`[EntityStateManager] Error in hook for ${type}:`, e);
        }
      });
    }

    // Trigger global hooks (type = null)
    if (hooksMap.has(null)) {
      hooksMap.get(null).forEach(hook => {
        try {
          hook(entity, type);
        } catch (e) {
          console.error(`[EntityStateManager] Error in global hook:`, e);
        }
      });
    }
  }
}

// Export singleton instance
const entityStateManager = new EntityStateManager();
module.exports = entityStateManager;
