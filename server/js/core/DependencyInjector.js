/**
 * DependencyInjector - Dependency Injection container
 * 
 * Provides dependency injection capabilities for game systems.
 * Systems declare their dependencies, and the injector provides them.
 * This eliminates hidden dependencies and makes testing easier.
 * 
 * Usage:
 *   const di = require('./DependencyInjector');
 *   const mySystem = di.inject(class MySystem {
 *     constructor(tilemapSystem, gameState) {
 *       this.tilemap = tilemapSystem;
 *       this.gameState = gameState;
 *     }
 *   }, ['tilemap', 'gameState']);
 */

const systemRegistry = require('./SystemRegistry');

class DependencyInjector {
  constructor() {
    this.providers = new Map(); // Custom providers for non-registered dependencies
    this.resolvedCache = new Map(); // Cache resolved dependencies
  }

  /**
   * Register a dependency provider
   * @param {string} name - Dependency name
   * @param {Function|any} provider - Function that returns the dependency, or the dependency itself
   */
  provide(name, provider) {
    if (typeof provider === 'function') {
      this.providers.set(name, provider);
    } else {
      this.providers.set(name, () => provider);
    }
  }

  /**
   * Resolve a dependency by name
   * @param {string} name - Dependency name
   * @returns {any} The resolved dependency
   * @throws {Error} If dependency cannot be resolved
   */
  resolve(name) {
    // Check cache first
    if (this.resolvedCache.has(name)) {
      return this.resolvedCache.get(name);
    }

    let resolved = null;

    // First check system registry
    if (systemRegistry.has(name)) {
      resolved = systemRegistry.get(name);
    }
    // Then check custom providers
    else if (this.providers.has(name)) {
      const provider = this.providers.get(name);
      resolved = typeof provider === 'function' ? provider() : provider;
    }
    // Check globals as fallback (for backward compatibility during migration)
    else if (global[name]) {
      resolved = global[name];
    }
    else {
      throw new Error(`[DependencyInjector] Cannot resolve dependency: ${name}`);
    }

    // Cache the resolved dependency
    this.resolvedCache.set(name, resolved);
    return resolved;
  }

  /**
   * Resolve multiple dependencies
   * @param {string[]} names - Array of dependency names
   * @returns {any[]} Array of resolved dependencies
   */
  resolveMany(names) {
    return names.map(name => this.resolve(name));
  }

  /**
   * Inject dependencies into a class constructor or function
   * @param {Function} Constructor - Class constructor or function
   * @param {string[]} dependencies - Array of dependency names
   * @returns {any} Instance of the class with dependencies injected
   */
  inject(Constructor, dependencies = []) {
    // If no dependencies specified, try to auto-detect from constructor parameters
    if (dependencies.length === 0) {
      dependencies = this.autoDetectDependencies(Constructor);
    }

    // Resolve all dependencies
    const resolvedDeps = this.resolveMany(dependencies);

    // Create instance with dependencies
    return new Constructor(...resolvedDeps);
  }

  /**
   * Auto-detect dependencies from constructor parameter names
   * This is a simple heuristic - for production use, specify dependencies explicitly
   * @param {Function} Constructor - Class constructor
   * @returns {string[]} Array of detected dependency names
   */
  autoDetectDependencies(Constructor) {
    const source = Constructor.toString();
    const match = source.match(/constructor\s*\(([^)]*)\)/);
    
    if (!match) {
      return [];
    }

    const params = match[1]
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    return params;
  }

  /**
   * Create a factory function that injects dependencies
   * @param {Function} Constructor - Class constructor or function
   * @param {string[]} dependencies - Array of dependency names
   * @returns {Function} Factory function that returns instances
   */
  factory(Constructor, dependencies = []) {
    return () => this.inject(Constructor, dependencies);
  }

  /**
   * Clear the resolution cache (useful for testing)
   */
  clearCache() {
    this.resolvedCache.clear();
  }

  /**
   * Clear all providers and cache
   */
  clear() {
    this.providers.clear();
    this.resolvedCache.clear();
  }

  /**
   * Check if a dependency can be resolved
   * @param {string} name - Dependency name
   * @returns {boolean} True if dependency can be resolved
   */
  canResolve(name) {
    try {
      this.resolve(name);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get all available dependency names
   * @returns {string[]} Array of dependency names
   */
  getAvailableDependencies() {
    const deps = new Set();
    
    // Add system registry systems
    systemRegistry.getSystemNames().forEach(name => deps.add(name));
    
    // Add custom providers
    this.providers.keys().forEach(name => deps.add(name));
    
    // Add globals (for backward compatibility info)
    Object.keys(global).filter(key => !key.startsWith('_') && typeof global[key] !== 'function').forEach(name => deps.add(name));
    
    return Array.from(deps);
  }
}

// Export singleton instance
const dependencyInjector = new DependencyInjector();
module.exports = dependencyInjector;
