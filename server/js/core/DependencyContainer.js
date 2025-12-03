/**
 * DependencyContainer - Advanced dependency injection container
 * 
 * Provides a comprehensive DI container that can resolve dependencies,
 * manage singletons, and support factory patterns.
 * 
 * This works alongside SystemRegistry and DependencyInjector to provide
 * a complete dependency injection solution.
 */

const systemRegistry = require('./SystemRegistry');
const dependencyInjector = require('./DependencyInjector');

class DependencyContainer {
  constructor() {
    this.singletons = new Map();
    this.factories = new Map();
    this.bindings = new Map(); // interface -> implementation
  }

  /**
   * Register a singleton
   * @param {string} name - Dependency name
   * @param {any} instance - Singleton instance
   */
  singleton(name, instance) {
    this.singletons.set(name, instance);
    dependencyInjector.provide(name, () => instance);
  }

  /**
   * Register a factory function
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function
   */
  factory(name, factory) {
    this.factories.set(name, factory);
    dependencyInjector.provide(name, factory);
  }

  /**
   * Bind an interface to an implementation
   * @param {string} interfaceName - Interface name
   * @param {string} implementationName - Implementation name
   */
  bind(interfaceName, implementationName) {
    this.bindings.set(interfaceName, implementationName);
  }

  /**
   * Resolve a dependency
   * @param {string} name - Dependency name
   * @returns {any} Resolved dependency
   */
  resolve(name) {
    // Check bindings first
    if (this.bindings.has(name)) {
      name = this.bindings.get(name);
    }

    // Try singleton
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    // Try factory
    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      const instance = factory();
      // Cache as singleton if not already cached
      if (!this.singletons.has(name)) {
        this.singleton(name, instance);
      }
      return instance;
    }

    // Fall back to dependency injector
    try {
      return dependencyInjector.resolve(name);
    } catch (error) {
      console.warn(`[DependencyContainer] Cannot resolve: ${name}`);
      return null;
    }
  }

  /**
   * Register a system from SystemRegistry as a dependency
   * @param {string} systemName - System name in registry
   * @param {string} dependencyName - Name to register as (defaults to systemName)
   */
  registerSystem(systemName, dependencyName = null) {
    const name = dependencyName || systemName;
    const system = systemRegistry.get(systemName);
    
    if (system) {
      this.singleton(name, system);
    } else {
      console.warn(`[DependencyContainer] System '${systemName}' not found in registry`);
    }
  }

  /**
   * Auto-register all systems from SystemRegistry
   */
  autoRegisterSystems() {
    const systemNames = systemRegistry.getSystemNames();
    systemNames.forEach(name => {
      this.registerSystem(name);
    });
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear() {
    this.singletons.clear();
    this.factories.clear();
    this.bindings.clear();
  }

  /**
   * Get container statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      singletons: this.singletons.size,
      factories: this.factories.size,
      bindings: this.bindings.size,
      registeredSystems: systemRegistry.getSystemNames().length
    };
  }
}

// Export singleton instance
const dependencyContainer = new DependencyContainer();
module.exports = dependencyContainer;
