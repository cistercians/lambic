/**
 * GameHelper - General game helper functions
 * 
 * Extracted from client.js for better organization.
 */

class GameHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Get player ID for UI (inventory, character sheet, chat)
   * Returns actual player ID even when controlling a ship
   * @param {string} selfId - Current self ID
   * @param {object} PlayerList - Player list object
   * @returns {string|null} Player ID or null
   */
  getPlayerIdForUI(selfId, PlayerList) {
    if (typeof window !== 'undefined' && window.originalPlayerId && PlayerList && PlayerList[window.originalPlayerId]) {
      return window.originalPlayerId;
    }
    return selfId;
  }

  /**
   * Check if position has fire (light sources)
   * @param {number} z - Z-layer
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {object} LightList - Light list object
   * @param {number} tileSize - Tile size
   * @param {function} getBuilding - Function to get building at position
   * @returns {boolean} Has fire
   */
  hasFire(z, x, y, LightList, tileSize, getBuilding) {
    if (!LightList) return false;
    const contextHelper = (typeof window !== 'undefined' && window.contextHelper) ? window.contextHelper : null;
    const context = contextHelper
      ? contextHelper.getCurrentContext({ selfId: window.selfId, PlayerList: window.Player ? window.Player.list : Player.list })
      : null;

    let count = 0;
    for (let i in LightList) {
      if (!LightList[i]) continue;
      
      const light = LightList[i];
      if (contextHelper && !contextHelper.isEntityInContext(light, context)) {
        continue;
      }
      if (light.z === z && (getBuilding(light.x, light.y) === getBuilding(x, y) || 
                            getBuilding(light.x, light.y + tileSize) === getBuilding(x, y))) {
        if (light.radius > 1) {
          return true;
        } else {
          count++;
          if (count === 2) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.GameHelper = GameHelper;
  window.gameHelper = new GameHelper();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameHelper;
}

