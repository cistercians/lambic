/**
 * LoginCameraSystem - Manages cinematic camera for login screen
 * 
 * Extracted from client.js for better organization.
 */

class LoginCameraSystem {
  constructor() {
    this.isActive = false;
    this.isLocked = false;
    this.currentFalconId = null;
    this.cameraX = 0;
    this.cameraY = 0;
    this.lockDuration = 10000; // 10 seconds
    this.pauseDuration = 3000; // 3 seconds
    this.switchTimer = null;
  }

  /**
   * Pick a random falcon to follow
   * @param {object} PlayerList - Player list
   * @returns {string|null} Falcon ID or null
   */
  pickRandomFalcon(PlayerList) {
    const falcons = [];
    let totalPlayers = 0;
    
    for (const id in PlayerList) {
      totalPlayers++;
      if (PlayerList[id].class === 'Falcon') {
        falcons.push(id);
      }
    }
    
    if (falcons.length > 0) {
      const randomIndex = Math.floor(Math.random() * falcons.length);
      return falcons[randomIndex];
    }
    return null;
  }

  /**
   * Lock camera to a specific falcon
   * @param {string} falconId - Falcon ID (null to pick random)
   * @param {object} PlayerList - Player list
   */
  lockToFalcon(falconId, PlayerList) {
    if (!falconId) {
      falconId = this.pickRandomFalcon(PlayerList);
    }

    if (falconId && PlayerList[falconId]) {
      this.currentFalconId = falconId;
      this.isLocked = true;
      this.cameraX = PlayerList[falconId].x;
      this.cameraY = PlayerList[falconId].y;

      // Schedule unlock after lockDuration
      const self = this;
      this.switchTimer = setTimeout(() => {
        self.unlock(PlayerList);
      }, this.lockDuration);
    } else {
      // No falcon found, try again after a delay
      const self = this;
      this.switchTimer = setTimeout(() => {
        if (self.isActive) {
          self.start(PlayerList);
        }
      }, 1000);
    }
  }

  /**
   * Unlock camera and pause before next falcon
   * @param {object} PlayerList - Player list
   */
  unlock(PlayerList) {
    if (!this.isActive) return;

    this.isLocked = false;
    
    // Store current position when unlocking
    if (this.currentFalconId && PlayerList[this.currentFalconId]) {
      this.cameraX = PlayerList[this.currentFalconId].x;
      this.cameraY = PlayerList[this.currentFalconId].y;
    }

    // Schedule next falcon lock after pauseDuration
    const self = this;
    this.switchTimer = setTimeout(() => {
      if (self.isActive) {
        self.lockToFalcon(null, PlayerList);
      }
    }, this.pauseDuration);
  }

  /**
   * Get current camera position
   * @param {object} PlayerList - Player list
   * @returns {object} Camera position {x, y}
   */
  getCameraPosition(PlayerList) {
    // Store previous position to detect changes
    const prevX = this.cameraX;
    const prevY = this.cameraY;

    // If active and locked, follow the falcon
    if (this.isActive && this.isLocked && this.currentFalconId && PlayerList && PlayerList[this.currentFalconId]) {
      const falcon = PlayerList[this.currentFalconId];
      this.cameraX = falcon.x;
      this.cameraY = falcon.y;
    }
    // If inactive but we have a valid position, return it
    // This allows rendering to continue after camera stops
    else if (!this.isActive && this.cameraX > 0 && this.cameraY > 0) {
      // Return preserved position
      return {
        x: this.cameraX,
        y: this.cameraY
      };
    }

    // Send camera update if position changed
    if (this.cameraX !== prevX || this.cameraY !== prevY) {
      this.sendCameraUpdate();
    }
    
    // Return position (may be 0,0 if never set - fallback will handle this)
    return {
      x: this.cameraX || 0,
      y: this.cameraY || 0
    };
  }

  /**
   * Start the camera system
   * @param {object} PlayerList - Player list
   */
  start(PlayerList) {
    this.isActive = true;
    // Find a random falcon and start following
    this.lockToFalcon(null, PlayerList);
  }

  /**
   * Stop the camera system
   * Preserves camera position for smooth transition
   * @param {object} PlayerList - Player list (optional, to capture final position)
   */
  stop(PlayerList) {
    // Capture final position from falcon if still locked
    if (this.isLocked && this.currentFalconId && PlayerList && PlayerList[this.currentFalconId]) {
      const falcon = PlayerList[this.currentFalconId];
      this.cameraX = falcon.x;
      this.cameraY = falcon.y;
    }
    
    // Preserve camera position before stopping (for transition rendering)
    // cameraX and cameraY are now set from either the falcon or previous getCameraPosition calls
    this.isActive = false;
    this.isLocked = false;
    if (this.switchTimer) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }
    // Note: cameraX and cameraY are preserved for fallback rendering
  }

  /**
   * Send camera position update to server
   */
  sendCameraUpdate() {
    if (typeof window !== 'undefined' && window.CameraHelper) {
      const cameraHelper = new window.CameraHelper();
      cameraHelper.sendCameraUpdate({
        cameraData: {
          cameraId: 'login', // Use a fixed ID for login mode
          x: this.cameraX,
          y: this.cameraY,
          z: 0, // Login camera is always at z=0
          mode: 'login',
          locked: this.isLocked,
          lockedToEntityId: this.isLocked ? this.currentFalconId : null,
          ownerPlayerId: null, // No associated player for login
          context: null
        },
        selfId: null
      });
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.LoginCameraSystem = LoginCameraSystem;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoginCameraSystem;
}
