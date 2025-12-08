/**
 * VisibilityHelper - Helper functions for entity visibility checks
 * 
 * Extracted from client.js for better organization.
 */

class VisibilityHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Check if entity is in view
   * @param {number} z - Entity z coordinate
   * @param {number} x - Entity x coordinate
   * @param {number} y - Entity y coordinate
   * @param {boolean} innaWoods - Is entity in woods
   * @param {object} config - Configuration
   * @returns {boolean} Is in view
   */
  inView(z, x, y, innaWoods, config) {
    const {
      spectateCameraSystem,
      godModeCamera,
      selfId,
      PlayerList,
      viewport,
      tileSize
    } = config;

    // Check if we're in a special mode (spectate or god mode)
    const inSpecialMode = (spectateCameraSystem && spectateCameraSystem.isActive) || 
                         (godModeCamera && godModeCamera.isActive);

    // During login mode (not spectate, not god mode, no selfId), return false
    if (!inSpecialMode && (!selfId || !PlayerList[selfId])) {
      return false; // During login, use inViewLogin instead
    }

    const top = (viewport.startTile[1] - 1) * tileSize;
    const left = (viewport.startTile[0] - 1) * tileSize;
    const right = (viewport.endTile[0] + 2) * tileSize;
    const bottom = (viewport.endTile[1] + 2) * tileSize;

    // In spectate or god mode, use camera z-layer instead of player z
    let currentZ;
    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      currentZ = spectateCameraSystem.cameraZ;
    } else if (godModeCamera && godModeCamera.isActive) {
      currentZ = godModeCamera.cameraZ;
    } else {
      currentZ = PlayerList[selfId].z;
    }

    if (z === currentZ && x > left && x < right && y > top && y < bottom) {
      // In spectate or god mode, ignore innaWoods check (always show everything)
      if (inSpecialMode) {
        return true;
      }
      // Note: innaWoods check excludes falcons - if innaWoods is false for a falcon,
      // it means the caller already handled the falcon exclusion (see GameRenderer.js)
      // This function doesn't have access to entity.class, so falcons should pass innaWoods=false
      if (z === 0 && innaWoods && !PlayerList[selfId].innaWoods) {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  /**
   * Simplified inView for login camera (no player-specific logic)
   * @param {number} x - Entity x coordinate
   * @param {number} y - Entity y coordinate
   * @param {object} config - Configuration { viewport, tileSize }
   * @returns {boolean} Is in view
   */
  inViewLogin(x, y, config) {
    const { viewport, tileSize } = config;

    const top = (viewport.startTile[1] - 1) * tileSize;
    const left = (viewport.startTile[0] - 1) * tileSize;
    const right = (viewport.endTile[0] + 2) * tileSize;
    const bottom = (viewport.endTile[1] + 2) * tileSize;

    return x > left && x < right && y > top && y < bottom;
  }

  /**
   * Check stealth status for an entity
   * @param {string} id - Entity ID
   * @param {object} config - Configuration
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @param {function} config.allyCheck - Function to check if entity is ally
   * @returns {number} Stealth status (0: not stealthed, 1: somewhat visible, 1.5: revealed, 2: totally stealthed)
   */
  stealthCheck(id, config) {
    const { selfId, PlayerList, allyCheck } = config;

    // During login mode, show all entities normally
    if (!selfId) {
      return 0;
    }

    const p = PlayerList[id];
    if (!p) return 0;

    if (p.stealthed) {
      if (id === selfId) {
        return 1;
      } else {
        if (typeof allyCheck === 'function' && allyCheck(id) <= 0) { // neutral or enemy
          if (p.revealed) {
            return 1.5;
          } else {
            return 2;
          }
        } else { // ally
          return 1;
        }
      }
    } else { // not stealthed
      return 0;
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.VisibilityHelper = VisibilityHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisibilityHelper;
}
