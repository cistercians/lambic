/**
 * BehaviorSystem - Composable NPC behavior management
 * 
 * Provides a system for defining and executing NPC behaviors
 * This is exposed globally but not actively used in current codebase
 */

class BehaviorSystem {
  constructor() {
    this.behaviors = new Map();
    this.activeBehaviors = new Map(); // entity id -> behavior name
    this.initialized = false;
  }

  /**
   * Initialize the behavior system
   */
  initialize() {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    
    if (global.debugPathfinding) {
      console.log('[BehaviorSystem] Initialized');
    }
  }

  /**
   * Register a behavior
   * @param {string} name - Behavior name
   * @param {object} behavior - Behavior definition with execute() method
   */
  registerBehavior(name, behavior) {
    if (!name || !behavior) {
      console.warn('[BehaviorSystem] Invalid behavior registration:', name);
      return false;
    }
    
    if (typeof behavior.execute !== 'function') {
      console.warn('[BehaviorSystem] Behavior must have execute() method:', name);
      return false;
    }
    
    this.behaviors.set(name, behavior);
    
    if (global.debugPathfinding) {
      console.log(`[BehaviorSystem] Registered behavior: ${name}`);
    }
    
    return true;
  }

  /**
   * Get a registered behavior
   * @param {string} name - Behavior name
   * @returns {object|undefined} The behavior or undefined
   */
  getBehavior(name) {
    return this.behaviors.get(name);
  }

  /**
   * Check if a behavior is registered
   * @param {string} name - Behavior name
   * @returns {boolean} True if behavior exists
   */
  hasBehavior(name) {
    return this.behaviors.has(name);
  }

  /**
   * Get all behavior names
   * @returns {string[]} Array of behavior names
   */
  getBehaviorNames() {
    return Array.from(this.behaviors.keys());
  }

  /**
   * Assign a behavior to an entity
   * @param {object} entity - The entity
   * @param {string} behaviorName - Behavior to assign
   */
  assignBehavior(entity, behaviorName) {
    if (!entity || !entity.id) {
      console.warn('[BehaviorSystem] Invalid entity');
      return false;
    }
    
    if (!this.behaviors.has(behaviorName)) {
      console.warn('[BehaviorSystem] Unknown behavior:', behaviorName);
      return false;
    }
    
    this.activeBehaviors.set(entity.id, behaviorName);
    return true;
  }

  /**
   * Execute behavior for an entity
   * @param {object} entity - The entity
   * @param {object} context - Execution context
   */
  executeBehavior(entity, context = {}) {
    if (!entity || !entity.id) {
      return;
    }
    
    const behaviorName = this.activeBehaviors.get(entity.id);
    if (!behaviorName) {
      return; // No active behavior
    }
    
    const behavior = this.behaviors.get(behaviorName);
    if (!behavior) {
      console.warn('[BehaviorSystem] Behavior not found:', behaviorName);
      this.activeBehaviors.delete(entity.id);
      return;
    }
    
    try {
      behavior.execute(entity, context);
    } catch (err) {
      console.error('[BehaviorSystem] Error executing behavior:', behaviorName, err.message);
    }
  }

  /**
   * Clear behavior for an entity
   * @param {object} entity - The entity
   */
  clearBehavior(entity) {
    if (entity && entity.id) {
      this.activeBehaviors.delete(entity.id);
    }
  }

  /**
   * Get active behavior for an entity
   * @param {object} entity - The entity
   * @returns {string|undefined} Behavior name or undefined
   */
  getActiveBehavior(entity) {
    if (!entity || !entity.id) {
      return undefined;
    }
    return this.activeBehaviors.get(entity.id);
  }
}

// Export singleton instance
const behaviorSystem = new BehaviorSystem();
module.exports = behaviorSystem;


























