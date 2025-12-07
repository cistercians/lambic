/**
 * ShipWakeSystem - Manages ship wake particle effects
 * 
 * Extracted from client.js for better organization.
 */

class ShipWakeSystem {
  constructor() {
    this.ships = new Set(); // Track ship IDs for efficient lookup
    this.fading = {}; // {x,y: {startTime: timestamp, alpha: 1}} - tiles fading out
  }

  /**
   * Register a ship for wake tracking
   * @param {string} shipId - Ship entity ID
   */
  addShip(shipId) {
    this.ships.add(shipId);
  }

  /**
   * Unregister a ship
   * @param {string} shipId - Ship entity ID
   */
  removeShip(shipId) {
    this.ships.delete(shipId);
  }

  /**
   * Check if entity is a ship type
   * @param {string} entityClass - Entity class name
   * @returns {boolean} Is ship
   */
  isShipClass(entityClass) {
    return entityClass === 'FishingShip' || entityClass === 'CargoShip' || entityClass === 'ship';
  }

  /**
   * Update wakes based on current ship positions
   * @param {object} config - Configuration { PlayerList, checkInView, tileSize }
   */
  update(config) {
    const { PlayerList, checkInView, tileSize } = config;
    const now = Date.now();
    const fadeDuration = 5000; // 5 seconds
    const currentShipTiles = {};

    // Only iterate tracked ships instead of all players (MAJOR OPTIMIZATION)
    for (const shipId of this.ships) {
      const entity = PlayerList[shipId];

      // Remove ship from Set if it no longer exists
      if (!entity) {
        this.ships.delete(shipId);
        continue;
      }

      // Skip if not visible (optimization)
      if (typeof checkInView === 'function' && !checkInView(entity)) {
        continue;
      }

      const tileX = Math.floor(entity.x / tileSize);
      const tileY = Math.floor(entity.y / tileSize);
      const key = tileX + ',' + tileY;
      currentShipTiles[key] = true;

      // If ship is on a tile that's not already fading, start fading it
      if (!this.fading[key]) {
        this.fading[key] = {
          startTime: now,
          alpha: 1.0
        };
      }
    }

    // Update all fading tiles
    for (const key in this.fading) {
      const fade = this.fading[key];
      const elapsed = now - fade.startTime;

      if (elapsed >= fadeDuration) {
        // Fade complete, remove
        delete this.fading[key];
      } else {
        // Update alpha (1.0 -> 0.0 over 5 seconds)
        fade.alpha = 1.0 - (elapsed / fadeDuration);
      }
    }
  }

  /**
   * Get brightness multiplier for a tile (0-1)
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @returns {number} Brightness multiplier (0-1)
   */
  getBrightness(tileX, tileY) {
    const key = tileX + ',' + tileY;

    // Check if tile is fading
    if (this.fading[key]) {
      return this.fading[key].alpha * 0.3;
    }

    return 0; // No brightness change
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ShipWakeSystem = ShipWakeSystem;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShipWakeSystem;
}
