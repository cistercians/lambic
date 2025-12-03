/**
 * TileHighlightSystem - Manages tile highlights for navigation clicks
 * 
 * Extracted from client.js for better organization.
 */

class TileHighlightSystem {
  constructor() {
    this.highlights = {}; // {x,y,z: {startTime: timestamp, alpha: 1}} - tiles fading out
  }

  /**
   * Add a highlight at a tile location
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} z - Z level
   */
  addHighlight(tileX, tileY, z) {
    const key = tileX + ',' + tileY + ',' + z;
    this.highlights[key] = {
      tileX: tileX,
      tileY: tileY,
      z: z,
      startTime: Date.now(),
      alpha: 0.5 // Start at 50% opacity
    };
  }

  /**
   * Update all highlights (fade them out over 1 second)
   */
  update() {
    const now = Date.now();
    const fadeDuration = 1000; // 1 second

    for (const key in this.highlights) {
      const highlight = this.highlights[key];
      const elapsed = now - highlight.startTime;

      if (elapsed >= fadeDuration) {
        // Fade complete, remove
        delete this.highlights[key];
      } else {
        // Update alpha (0.5 -> 0.0 over 1 second)
        highlight.alpha = 0.5 * (1.0 - (elapsed / fadeDuration));
      }
    }
  }

  /**
   * Get all active highlights (for rendering)
   * @returns {Array} Array of highlight objects
   */
  getHighlights() {
    return Object.values(this.highlights);
  }

  /**
   * Clear all highlights
   */
  clear() {
    this.highlights = {};
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.TileHighlightSystem = TileHighlightSystem;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TileHighlightSystem;
}
