/**
 * PackManager - Resource packing/bundling utility
 * 
 * Minimal stub for resource management
 * This is exposed globally but not actively used in current codebase
 */

class PackManager {
  constructor() {
    this.packs = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the pack manager
   */
  initialize() {
    if (this.initialized) {
      return;
    }
    
    this.initialized = true;
    
    if (global.debugPathfinding) {
      console.log('[PackManager] Initialized');
    }
  }

  /**
   * Register a pack
   * @param {string} name - Pack name
   * @param {object} pack - Pack data
   */
  registerPack(name, pack) {
    if (!name || !pack) {
      console.warn('[PackManager] Invalid pack registration:', name);
      return false;
    }
    
    this.packs.set(name, pack);
    return true;
  }

  /**
   * Get a registered pack
   * @param {string} name - Pack name
   * @returns {object|undefined} The pack or undefined
   */
  getPack(name) {
    return this.packs.get(name);
  }

  /**
   * Check if a pack is registered
   * @param {string} name - Pack name
   * @returns {boolean} True if pack exists
   */
  hasPack(name) {
    return this.packs.has(name);
  }

  /**
   * Get all pack names
   * @returns {string[]} Array of pack names
   */
  getPackNames() {
    return Array.from(this.packs.keys());
  }

  /**
   * Remove a pack
   * @param {string} name - Pack name
   * @returns {boolean} True if pack was removed
   */
  removePack(name) {
    return this.packs.delete(name);
  }
}

module.exports = PackManager;
















