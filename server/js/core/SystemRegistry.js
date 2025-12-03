/**
 * SystemRegistry - Central registry for all game systems
 * 
 * This replaces scattered global variables with a single, well-organized registry.
 * All game systems should be registered here and accessed through this registry.
 * 
 * Benefits:
 * - Clear dependency graph
 * - Easy to see what systems exist
 * - Testable and mockable
 * - No hidden dependencies via globals
 */

class SystemRegistry {
  constructor() {
    this.systems = new Map();
    this.dependencies = new Map(); // Track what each system depends on
    this.initializationOrder = []; // Track initialization order
  }

  /**
   * Register a system with the registry
   * @param {string} name - Unique name for the system (e.g., 'tilemap', 'combat', 'pathfinding')
   * @param {any} system - The system instance to register
   * @param {object} options - Optional configuration
   * @param {string[]} options.dependsOn - Array of system names this system depends on
   * @param {number} options.priority - Initialization priority (lower = earlier)
   */
  register(name, system, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('[SystemRegistry] System name must be a non-empty string');
    }

    if (this.systems.has(name)) {
      console.warn(`[SystemRegistry] System '${name}' is already registered. Overwriting...`);
    }

    this.systems.set(name, system);
    
    // Track dependencies
    if (options.dependsOn && Array.isArray(options.dependsOn)) {
      this.dependencies.set(name, options.dependsOn);
    }

    // Track initialization order
    if (options.priority !== undefined) {
      this.initializationOrder.push({ name, priority: options.priority });
      this.initializationOrder.sort((a, b) => a.priority - b.priority);
    }

    if (global.debugPathfinding || process.env.DEBUG) {
      console.log(`[SystemRegistry] Registered system: ${name}`, 
        options.dependsOn ? `(depends on: ${options.dependsOn.join(', ')})` : '');
    }

    return true;
  }

  /**
   * Get a registered system by name
   * @param {string} name - The name of the system to retrieve
   * @returns {any} The registered system or undefined
   */
  get(name) {
    const system = this.systems.get(name);
    
    if (!system && process.env.DEBUG) {
      console.warn(`[SystemRegistry] System '${name}' not found. Available systems:`, 
        Array.from(this.systems.keys()));
    }
    
    return system;
  }

  /**
   * Check if a system is registered
   * @param {string} name - The name to check
   * @returns {boolean} True if the system is registered
   */
  has(name) {
    return this.systems.has(name);
  }

  /**
   * Unregister a system
   * @param {string} name - The name of the system to unregister
   * @returns {boolean} True if the system was unregistered
   */
  unregister(name) {
    const removed = this.systems.delete(name);
    this.dependencies.delete(name);
    this.initializationOrder = this.initializationOrder.filter(item => item.name !== name);
    return removed;
  }

  /**
   * Get all registered system names
   * @returns {string[]} Array of system names
   */
  getSystemNames() {
    return Array.from(this.systems.keys());
  }

  /**
   * Get all registered systems
   * @returns {Map<string, any>} Map of system names to instances
   */
  getAllSystems() {
    return new Map(this.systems);
  }

  /**
   * Get the dependency graph for a system
   * @param {string} name - System name
   * @returns {string[]} Array of system names this system depends on
   */
  getDependencies(name) {
    return this.dependencies.get(name) || [];
  }

  /**
   * Get initialization order based on priorities
   * @returns {string[]} Array of system names in initialization order
   */
  getInitializationOrder() {
    return this.initializationOrder.map(item => item.name);
  }

  /**
   * Verify all dependencies are satisfied
   * @param {string} name - System name to check
   * @returns {object} { valid: boolean, missing: string[] }
   */
  verifyDependencies(name) {
    const deps = this.dependencies.get(name) || [];
    const missing = deps.filter(dep => !this.systems.has(dep));
    
    return {
      valid: missing.length === 0,
      missing: missing
    };
  }

  /**
   * Verify all registered systems have their dependencies satisfied
   * @returns {object} { allValid: boolean, issues: Array<{system: string, missing: string[]}> }
   */
  verifyAllDependencies() {
    const issues = [];
    
    for (const [name, deps] of this.dependencies.entries()) {
      const verification = this.verifyDependencies(name);
      if (!verification.valid) {
        issues.push({ system: name, missing: verification.missing });
      }
    }
    
    return {
      allValid: issues.length === 0,
      issues: issues
    };
  }

  /**
   * Clear all registered systems (useful for testing)
   */
  clear() {
    this.systems.clear();
    this.dependencies.clear();
    this.initializationOrder = [];
  }

  /**
   * Get statistics about the registry
   * @returns {object} Registry statistics
   */
  getStats() {
    return {
      totalSystems: this.systems.size,
      systemsWithDependencies: this.dependencies.size,
      systems: Array.from(this.systems.keys()),
      initializationOrder: this.getInitializationOrder()
    };
  }
}

// Export singleton instance
const systemRegistry = new SystemRegistry();
module.exports = systemRegistry;
