/**
 * EntityBase - Minimal base entity structure
 * 
 * Provides a minimal foundation for all entities.
 * Contains only data, no behavior logic.
 * 
 * This is a helper function (not a class) to match the existing
 * function constructor pattern used throughout the codebase.
 */

/**
 * Create a minimal entity base
 * @param {object} param - Entity parameters
 * @returns {object} Base entity object
 */
function createEntityBase(param = {}) {
  return {
    // Position
    x: param.x || 0,
    y: param.y || 0,
    z: param.z || 0,
    
    // Identity
    id: param.id || Math.random(),
    
    // Basic state
    spdX: 0,
    spdY: 0,
    
    // Lifecycle flags
    toUpdate: false,
    toRemove: false,
    
    // Type information
    type: param.type || 'entity',
    class: param.class || 'Entity',
    
    // Minimal update method (can be overridden)
    update: function() {
      // Basic position update
      this.x += this.spdX;
      this.y += this.spdY;
    },
    
    // Utility methods
    getDistance: function(pt) {
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') {
        return Infinity;
      }
      const dx = this.x - pt.x;
      const dy = this.y - pt.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
  };
}

/**
 * Create entity base with additional properties
 * @param {object} param - Entity parameters
 * @param {object} additionalProps - Additional properties to add
 * @returns {object} Entity object with base + additional properties
 */
function createEntityWithBase(param = {}, additionalProps = {}) {
  const base = createEntityBase(param);
  return Object.assign(base, additionalProps);
}

module.exports = {
  createEntityBase,
  createEntityWithBase
};
