/**
 * ZoomHelper - Manages zoom levels based on location and context
 * 
 * Extracted from client.js for better organization.
 */

class ZoomHelper {
  constructor() {
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.zoomTransitionSpeed = 0.05; // How fast zoom transitions (higher = faster)
    this.buildingZoom = 2.0; // 100% zoom in (2x) for buildings and cellars
    this.caveZoom = 1.5; // 50% zoom in (1.5x) for caves only
    this.forestZoom = 1.25; // 25% zoom in (1.25x) for heavy forest
    this.mountainZoom = 0.75; // 25% zoom out (0.75x) for mountains
  }

  /**
   * Get target zoom level based on current context
   * @param {object} config - Configuration
   * @param {function} config.getCurrentZ - Function to get current Z level
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @param {object} config.loginCameraSystem - Login camera system
   * @param {function} config.getTile - Function to get tile at coordinates (optional, for immediate terrain checking)
   * @param {function} config.getLoc - Function to convert x,y to tile coordinates (optional)
   * @returns {number} Target zoom level
   */
  getTargetZoom(config) {
    const { getCurrentZ, selfId, PlayerList, loginCameraSystem, getTile, getLoc } = config;
    
    const z = getCurrentZ();
    const player = selfId && PlayerList ? PlayerList[selfId] : null;
    
    // Zoom out for login camera (cinematic view)
    if (loginCameraSystem && loginCameraSystem.isActive) {
      return this.mountainZoom; // 0.75x zoom for login camera
    }
    
    // Zoom out for ship view (when controlling a ship OR when boarded as passenger)
    if (selfId && player && (player.shipType || player.boardedShip)) {
      return this.mountainZoom; // 0.75x zoom for ships or when boarded on ship
    }
    
    // Zoom in when inside buildings and cellars (z=1,2,-2)
    if (z === 1 || z === 2 || z === -2) {
      return this.buildingZoom;
    }
    
    // Zoom in for caves (z=-1)
    if (z === -1) {
      return this.caveZoom;
    }
    
    // Zoom out for mountains and zoom in for heavy forest (z=0)
    if (z === 0 && selfId && player) {
      // Check terrain directly if available (for immediate zoom response)
      // This allows zoom to work immediately when stepping on mountains,
      // even before the server sets onMtn flag after the 2-second delay
      if (getTile && getLoc && player.x !== undefined && player.y !== undefined) {
        const loc = getLoc(player.x, player.y);
        if (loc && loc[0] !== undefined && loc[1] !== undefined) {
          const tile = getTile(0, loc[0], loc[1]);
          // Mountain terrain (tile type 5)
          if (tile >= 5 && tile < 6) {
            return this.mountainZoom; // 0.75x zoom for mountains
          }
          // Heavy forest terrain (tile type 1)
          if (tile >= 1 && tile < 1.3) {
            return this.forestZoom; // 1.25x zoom for heavy forest
          }
        }
      }
      
      // Fallback to server-provided flags (for compatibility)
      if (player.onMtn === true) {
        return this.mountainZoom; // 0.75x zoom for mountains
      }
      
      // Zoom in for heavy forest (z=0, innaWoods=true)
      if (player.innaWoods === true) {
        return this.forestZoom; // 1.25x zoom for heavy forest
      }
    }
    
    // Normal zoom for overworld (z=0)
    return 1.0;
  }

  /**
   * Update zoom with smooth transition
   * @param {number} targetZoom - Target zoom level
   * @returns {number} Current zoom after update
   */
  updateZoom(targetZoom) {
    this.targetZoom = targetZoom;
    
    // Smoothly interpolate current zoom towards target zoom
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.01) {
      const zoomDiff = this.targetZoom - this.currentZoom;
      this.currentZoom += zoomDiff * this.zoomTransitionSpeed;
    } else {
      this.currentZoom = this.targetZoom; // Snap to target when very close
    }
    
    return this.currentZoom;
  }

  /**
   * Get current zoom level
   * @returns {number} Current zoom level
   */
  getCurrentZoom() {
    return this.currentZoom;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ZoomHelper = ZoomHelper;
  // Create singleton instance
  window.zoomHelper = new ZoomHelper();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZoomHelper;
}

