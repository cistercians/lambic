/**
 * EntityRegistry - Single source of truth for entity collections
 * 
 * Provides centralized access to all entity collections (players, buildings, items, etc.)
 * Replaces direct access to Player.list, Building.list, etc.
 * 
 * Benefits:
 * - Single place to manage entities
 * - Consistent interface across all entity types
 * - Can add features like validation, hooks, statistics
 * - Easier to test and mock
 */

class EntityRegistry {
  constructor() {
    // Entity collections by type
    this.collections = new Map();
    
    // Type mappings (entity type -> collection name)
    this.typeMappings = new Map([
      ['player', 'players'],
      ['building', 'buildings'],
      ['item', 'items'],
      ['arrow', 'arrows'],
      ['light', 'lights'],
      ['house', 'houses'],
      ['kingdom', 'kingdoms'],
      ['weather', 'weather']
    ]);

    // Statistics
    this.stats = {
      totalEntities: 0,
      entitiesByType: new Map(),
      addCount: 0,
      removeCount: 0
    };

    // Event callbacks
    this.onAddCallbacks = new Map();
    this.onRemoveCallbacks = new Map();
  }

  /**
   * Register an entity collection
   * @param {string} name - Collection name (e.g., 'players', 'buildings')
   * @param {object} listObject - The list object to wrap (e.g., Player.list)
   * @param {object} options - Optional configuration
   */
  registerCollection(name, listObject, options = {}) {
    if (!listObject || typeof listObject !== 'object') {
      throw new Error(`[EntityRegistry] Collection '${name}' must be an object`);
    }

    this.collections.set(name, {
      list: listObject,
      options: options,
      name: name
    });

    // Initialize stats
    this.stats.entitiesByType.set(name, Object.keys(listObject).length);
    this._updateTotalCount();

    if (process.env.DEBUG) {
      console.log(`[EntityRegistry] Registered collection: ${name}`, 
        `(${Object.keys(listObject).length} entities)`);
    }

    return true;
  }

  /**
   * Get entities from a collection
   * @param {string} type - Entity type or collection name
   * @param {Function} filter - Optional filter function
   * @returns {Array} Array of entities
   */
  getEntities(type, filter = null) {
    const collection = this._getCollection(type);
    if (!collection) {
      return [];
    }

    const entities = Object.values(collection.list);
    
    if (filter && typeof filter === 'function') {
      return entities.filter(filter);
    }

    return entities;
  }

  /**
   * Get a single entity by ID
   * @param {string} type - Entity type or collection name
   * @param {string|number} id - Entity ID
   * @returns {any} Entity or undefined
   */
  getEntity(type, id) {
    const collection = this._getCollection(type);
    if (!collection) {
      return undefined;
    }

    return collection.list[id];
  }

  /**
   * Add an entity to a collection
   * @param {string} type - Entity type or collection name
   * @param {string|number} id - Entity ID
   * @param {any} entity - Entity object
   * @returns {boolean} Success
   */
  addEntity(type, id, entity) {
    const collection = this._getCollection(type);
    if (!collection) {
      console.warn(`[EntityRegistry] Collection '${type}' not found`);
      return false;
    }

    if (collection.list[id]) {
      console.warn(`[EntityRegistry] Entity ${id} already exists in ${type}`);
    }

    collection.list[id] = entity;
    
    // Update stats
    const currentCount = this.stats.entitiesByType.get(type) || 0;
    this.stats.entitiesByType.set(type, currentCount + 1);
    this.stats.addCount++;
    this._updateTotalCount();

    // Trigger callbacks
    this._triggerCallbacks(this.onAddCallbacks, type, id, entity);

    return true;
  }

  /**
   * Remove an entity from a collection
   * @param {string} type - Entity type or collection name
   * @param {string|number} id - Entity ID
   * @returns {boolean} Success
   */
  removeEntity(type, id) {
    const collection = this._getCollection(type);
    if (!collection) {
      return false;
    }

    const entity = collection.list[id];
    if (!entity) {
      return false;
    }

    delete collection.list[id];

    // Update stats
    const currentCount = this.stats.entitiesByType.get(type) || 0;
    this.stats.entitiesByType.set(type, Math.max(0, currentCount - 1));
    this.stats.removeCount++;
    this._updateTotalCount();

    // Trigger callbacks
    this._triggerCallbacks(this.onRemoveCallbacks, type, id, entity);

    return true;
  }

  /**
   * Check if an entity exists
   * @param {string} type - Entity type or collection name
   * @param {string|number} id - Entity ID
   * @returns {boolean} True if entity exists
   */
  hasEntity(type, id) {
    const collection = this._getCollection(type);
    if (!collection) {
      return false;
    }

    return id in collection.list;
  }

  /**
   * Get all entity IDs in a collection
   * @param {string} type - Entity type or collection name
   * @returns {Array} Array of entity IDs
   */
  getEntityIds(type) {
    const collection = this._getCollection(type);
    if (!collection) {
      return [];
    }

    return Object.keys(collection.list);
  }

  /**
   * Get count of entities in a collection
   * @param {string} type - Entity type or collection name
   * @returns {number} Count
   */
  getCount(type) {
    const collection = this._getCollection(type);
    if (!collection) {
      return 0;
    }

    return Object.keys(collection.list).length;
  }

  /**
   * Get all registered collection names
   * @returns {string[]} Array of collection names
   */
  getCollectionNames() {
    return Array.from(this.collections.keys());
  }

  /**
   * Register a callback for entity add events
   * @param {string} type - Entity type (null for all types)
   * @param {Function} callback - Callback function (type, id, entity)
   */
  onAdd(type, callback) {
    if (!this.onAddCallbacks.has(type)) {
      this.onAddCallbacks.set(type, []);
    }
    this.onAddCallbacks.get(type).push(callback);
  }

  /**
   * Register a callback for entity remove events
   * @param {string} type - Entity type (null for all types)
   * @param {Function} callback - Callback function (type, id, entity)
   */
  onRemove(type, callback) {
    if (!this.onRemoveCallbacks.has(type)) {
      this.onRemoveCallbacks.set(type, []);
    }
    this.onRemoveCallbacks.get(type).push(callback);
  }

  /**
   * Get statistics about entities
   * @returns {object} Statistics object
   */
  getStats() {
    return {
      totalEntities: this.stats.totalEntities,
      entitiesByType: Object.fromEntries(this.stats.entitiesByType),
      addCount: this.stats.addCount,
      removeCount: this.stats.removeCount,
      collections: Array.from(this.collections.keys())
    };
  }

  /**
   * Clear all entities from a collection
   * @param {string} type - Entity type or collection name
   */
  clearCollection(type) {
    const collection = this._getCollection(type);
    if (!collection) {
      return;
    }

    const ids = Object.keys(collection.list);
    ids.forEach(id => {
      this.removeEntity(type, id);
    });
  }

  /**
   * Get the underlying list object for backward compatibility
   * @param {string} type - Entity type or collection name
   * @returns {object} The list object
   */
  getList(type) {
    const collection = this._getCollection(type);
    if (!collection) {
      return {};
    }

    return collection.list;
  }

  // Private helper methods

  _getCollection(type) {
    // First try direct collection name
    if (this.collections.has(type)) {
      return this.collections.get(type);
    }

    // Then try type mapping
    const mappedType = this.typeMappings.get(type);
    if (mappedType && this.collections.has(mappedType)) {
      return this.collections.get(mappedType);
    }

    return null;
  }

  _updateTotalCount() {
    let total = 0;
    for (const count of this.stats.entitiesByType.values()) {
      total += count;
    }
    this.stats.totalEntities = total;
  }

  _triggerCallbacks(callbacksMap, type, id, entity) {
    // Trigger type-specific callbacks
    if (callbacksMap.has(type)) {
      callbacksMap.get(type).forEach(callback => {
        try {
          callback(type, id, entity);
        } catch (e) {
          console.error(`[EntityRegistry] Error in callback for ${type}:`, e);
        }
      });
    }

    // Trigger global callbacks (type = null)
    if (callbacksMap.has(null)) {
      callbacksMap.get(null).forEach(callback => {
        try {
          callback(type, id, entity);
        } catch (e) {
          console.error(`[EntityRegistry] Error in global callback:`, e);
        }
      });
    }
  }
}

// Export singleton instance
const entityRegistry = new EntityRegistry();
module.exports = entityRegistry;
