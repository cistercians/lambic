/**
 * GameContext - Simple registry for game systems
 * 
 * Provides a central registry for game systems to be registered and accessed.
 * This enables loose coupling between systems.
 */

class GameContext {
  constructor() {
    this.systems = new Map();
  }

  /**
   * Register a system with a given name
   * @param {string} name - The name to register the system under
   * @param {any} system - The system instance to register
   */
  register(name, system) {
    if (!name || typeof name !== 'string') {
      console.warn('[GameContext] Invalid system name:', name);
      return false;
    }
    
    this.systems.set(name, system);
    
    if (global.debugPathfinding) {
      console.log(`[GameContext] Registered system: ${name}`);
    }
    
    return true;
  }

  /**
   * Get a registered system by name
   * @param {string} name - The name of the system to retrieve
   * @returns {any} The registered system or undefined
   */
  get(name) {
    return this.systems.get(name);
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
    return this.systems.delete(name);
  }

  /**
   * Get all registered system names
   * @returns {string[]} Array of system names
   */
  getSystemNames() {
    return Array.from(this.systems.keys());
  }
}

// Export singleton instance
const gameContext = new GameContext();
module.exports = gameContext;

































