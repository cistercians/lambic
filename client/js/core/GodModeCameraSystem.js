/**
 * GodModeCameraSystem - Manages camera for god mode spectator
 * 
 * Extracted from client.js for better organization.
 */

class GodModeCameraSystem {
  constructor() {
    this.isActive = false;
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraZ = 0;
    this.speed = 15;
    this.factionHQs = [];
    this.currentFactionIndex = -1;
    this.pressingUp = false;
    this.pressingDown = false;
    this.pressingLeft = false;
    this.pressingRight = false;
    this.needsMusicUpdate = false;
  }

  /**
   * Start god mode camera
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {number} startZ - Starting Z coordinate
   * @param {Array} factionHQs - Array of faction HQ positions
   */
  start(startX, startY, startZ, factionHQs) {
    this.isActive = true;
    this.cameraX = startX;
    this.cameraY = startY;
    this.cameraZ = startZ;
    this.factionHQs = factionHQs || [];
    this.currentFactionIndex = -1;
    this.pressingUp = false;
    this.pressingDown = false;
    this.pressingLeft = false;
    this.pressingRight = false;
  }

  /**
   * Stop god mode camera
   */
  stop() {
    this.isActive = false;
    this.factionHQs = [];
    this.currentFactionIndex = -1;
    this.pressingUp = false;
    this.pressingDown = false;
    this.pressingLeft = false;
    this.pressingRight = false;
    this.needsMusicUpdate = true;
  }

  /**
   * Update camera position based on pressed keys
   * @param {number} mapSize - Map size in tiles
   * @param {number} tileSize - Tile size in pixels
   */
  update(mapSize, tileSize) {
    if (!this.isActive) return;

    // Smooth camera movement based on pressed keys
    if (this.pressingUp) {
      this.cameraY -= this.speed;
    }
    if (this.pressingDown) {
      this.cameraY += this.speed;
    }
    if (this.pressingLeft) {
      this.cameraX -= this.speed;
    }
    if (this.pressingRight) {
      this.cameraX += this.speed;
    }

    // Keep within map bounds
    const maxPos = mapSize * tileSize;
    this.cameraX = Math.max(0, Math.min(maxPos, this.cameraX));
    this.cameraY = Math.max(0, Math.min(maxPos, this.cameraY));
  }

  /**
   * Change z-layer
   * @param {number} dz - Z change amount
   * @param {function} getBuilding - Function to get building at position
   * @param {function} getBgm - Function to update BGM
   */
  changeZ(dz, getBuilding, getBgm) {
    this.cameraZ = Math.max(-3, Math.min(3, this.cameraZ + dz));

    // Update music/ambience when z-level changes
    const b = (this.cameraZ === 1 || this.cameraZ === 2) ? 
              getBuilding(this.cameraX, this.cameraY) : null;
    getBgm(this.cameraX, this.cameraY, this.cameraZ, b);
  }

  /**
   * Cycle to next/previous faction HQ
   * @param {number} direction - Direction (>0 for next, <0 for previous)
   * @param {function} getBuilding - Function to get building at position
   * @param {function} getBgm - Function to update BGM
   * @param {function} addChatMessage - Function to add chat message
   */
  cycleFaction(direction, getBuilding, getBgm, addChatMessage) {
    if (this.factionHQs.length === 0) {
      if (addChatMessage) {
        addChatMessage('⚠️ No faction HQs available');
      }
      return;
    }

    // Cycle through factions
    if (direction > 0) {
      // Next faction
      this.currentFactionIndex++;
      if (this.currentFactionIndex >= this.factionHQs.length) {
        this.currentFactionIndex = 0;
      }
    } else {
      // Previous faction
      this.currentFactionIndex--;
      if (this.currentFactionIndex < 0) {
        this.currentFactionIndex = this.factionHQs.length - 1;
      }
    }

    // Snap to faction HQ
    const faction = this.factionHQs[this.currentFactionIndex];
    if (!faction) {
      return;
    }

    this.cameraX = faction.x;
    this.cameraY = faction.y;
    this.cameraZ = faction.z;

    // Update music/ambience
    const b = (this.cameraZ === 1 || this.cameraZ === 2) ? 
              getBuilding(this.cameraX, this.cameraY) : null;
    getBgm(this.cameraX, this.cameraY, this.cameraZ, b);

    // Display faction name in chat
    if (addChatMessage) {
      addChatMessage('📍 Viewing: ' + faction.name + ' HQ');
    }
  }

  /**
   * Get camera position
   * @returns {object} Camera position {x, y, z}
   */
  getCameraPosition() {
    return {
      x: this.cameraX,
      y: this.cameraY,
      z: this.cameraZ
    };
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.GodModeCameraSystem = GodModeCameraSystem;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GodModeCameraSystem;
}
