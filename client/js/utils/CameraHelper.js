/**
 * CameraHelper - Helper functions for camera positioning and viewport
 * 
 * Extracted from client.js for better organization.
 */

class CameraHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Get camera position for rendering
   * @param {object} config - Configuration
   * @param {object} config.spectateCameraSystem - Spectate camera system
   * @param {object} config.godModeCamera - God mode camera
   * @param {object} config.loginCameraSystem - Login camera system
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @returns {object} Camera position {x, y}
   */
  getCameraPosition(config) {
    const { spectateCameraSystem, godModeCamera, loginCameraSystem, selfId, PlayerList } = config;

    // Priority 1: Spectate camera
    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      return spectateCameraSystem.getCameraPosition();
    }

    // Priority 2: God mode camera
    if (godModeCamera && godModeCamera.isActive) {
      return godModeCamera.getCameraPosition();
    }

    // Priority 3: Login camera system
    if (loginCameraSystem && loginCameraSystem.isActive && !selfId) {
      const cameraPos = loginCameraSystem.getCameraPosition();
      if (cameraPos && cameraPos.x !== undefined && cameraPos.y !== undefined) {
        return { x: cameraPos.x, y: cameraPos.y };
      }
    }

    // Priority 4: Follow player
    if (selfId && PlayerList[selfId]) {
      return { x: PlayerList[selfId].x, y: PlayerList[selfId].y };
    }

    // Default fallback
    return { x: 0, y: 0 };
  }

  /**
   * Get current z-layer for rendering
   * @param {object} config - Configuration
   * @param {object} config.spectateCameraSystem - Spectate camera system
   * @param {object} config.godModeCamera - God mode camera
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @returns {number} Current z-layer
   */
  getCurrentZ(config) {
    const { spectateCameraSystem, godModeCamera, selfId, PlayerList } = config;

    // Spectate camera has its own z-layer
    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      return Math.round(spectateCameraSystem.cameraZ);
    }

    // God mode has its own z-layer
    if (godModeCamera && godModeCamera.isActive) {
      return godModeCamera.cameraZ;
    }

    // Otherwise use player z
    if (selfId && PlayerList[selfId]) {
      return PlayerList[selfId].z;
    }

    // Default to overworld
    return 0;
  }

  /**
   * Get target zoom based on current z-level and context
   * @param {object} config - Configuration
   * @param {object} config.loginCameraSystem - Login camera system
   * @param {string} config.selfId - Player ID
   * @param {object} config.PlayerList - Player list
   * @param {function} config.getCurrentZ - Function to get current z
   * @returns {number} Target zoom level
   */
  getTargetZoom(config) {
    const { loginCameraSystem, selfId, PlayerList, getCurrentZ } = config;
    const z = getCurrentZ(config);
    const player = PlayerList[selfId];

    // Zoom out for login camera (cinematic view)
    if (loginCameraSystem && loginCameraSystem.isActive) {
      return 0.75; // 0.75x zoom for login camera
    }

    // Zoom out for ship view
    if (selfId && player && player.shipType) {
      return 0.75; // 0.75x zoom for ships
    }

    // Zoom in when inside buildings and cellars (z=1,2,-2)
    if (z === 1 || z === 2 || z === -2) {
      return 2.0; // buildingZoom
    }

    // Zoom in for caves (z=-1)
    if (z === -1) {
      return 1.5; // caveZoom
    }

    // Zoom out for mountains (z=0, onMtn=true)
    if (z === 0 && selfId && player) {
      if (player.onMtn === true) {
        return 0.75; // mountainZoom
      }

      // Zoom in for heavy forest (z=0, innaWoods=true)
      if (player.innaWoods === true) {
        return 1.25; // forestZoom
      }
    }

    // Normal zoom for overworld (z=0)
    return 1.0;
  }

  /**
   * Send camera update to server for spatial filtering
   * @param {object} config - Configuration
   * @param {object} config.cameraData - Camera data to send
   * @param {string} config.selfId - Player ID
   */
  sendCameraUpdate(config) {
    const { cameraData, selfId } = config;

    // Only send if we have a socket connection
    if (typeof window !== 'undefined' && window.socket && typeof window.socket.send === 'function') {
      const updateData = {
        msg: 'cameraUpdate',
        cameraId: cameraData.cameraId || selfId, // Use player ID as camera ID for players
        x: cameraData.x,
        y: cameraData.y,
        z: cameraData.z,
        mode: cameraData.mode || 'player',
        locked: cameraData.locked || false,
        lockedToEntityId: cameraData.lockedToEntityId || null,
        ownerPlayerId: cameraData.ownerPlayerId || selfId,
        context: cameraData.context || null
      };

      window.socket.send(JSON.stringify(updateData));
    }
  }

  /**
   * Get camera mode based on current state
   * @param {object} config - Configuration
   * @returns {string} Camera mode
   */
  getCameraMode(config) {
    const { spectateCameraSystem, godModeCamera, loginCameraSystem, selfId } = config;

    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      return 'spectate';
    }

    if (godModeCamera && godModeCamera.isActive) {
      return 'godmode';
    }

    if (loginCameraSystem && loginCameraSystem.isActive && !selfId) {
      return 'login';
    }

    return 'player';
  }

  /**
   * Get camera context for battleground/main world filtering
   * @param {object} config - Configuration
   * @returns {object|null} Context object
   */
  getCameraContext(config) {
    const { selfId, PlayerList } = config;
    const player = PlayerList[selfId];

    if (player && (player.inBattleground || player.battlegroundMatchId)) {
      return {
        inBattleground: true,
        battlegroundMatchId: player.battlegroundMatchId
      };
    }

    return null;
  }
}

if (typeof window !== 'undefined') {
  window.CameraHelper = CameraHelper;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CameraHelper;
}
