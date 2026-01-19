/**
 * SpectateCameraSystem - Manages intelligent camera for spectator mode
 * 
 * Extracted from client.js for better organization.
 */

class SpectateCameraSystem {
  constructor() {
    this.isActive = false;
    this.currentTargetId = null;
    this.cameraX = 0;
    this.cameraY = 0;
    this.cameraZ = 0;
    this.directorTarget = null;
    this.directorTargetHandler = null;
    this.directorTargetListenerAttached = false;
    this.staticTargetActive = false;
    this.staticTargetStartTime = 0;
    this.staticTargetMaxDuration = 10000;
    this.lockDuration = 8000; // 8 seconds minimum lock time
    this.maxLockDuration = 15000; // 15 seconds maximum lock time
    this.lastPriorityLevel = 'other';
    this.lockStartTime = 0;
    this.lastTargetCheckTime = 0;
    this.targetCheckInterval = 1000; // Check for new targets every 1 second
    this.innaWoods = true; // Can see through heavy forest
    this.isPanning = false;
    this.isTransitioning = false;
    this.panSpeed = 25;
    this.lockDistance = 100;
    this.initialDistance = 0;
    this.baseSpeed = 15;
    this.targetX = 0;
    this.targetY = 0;
    this.targetZ = 0;
    this.pendingTargetId = null;
    this.transitionStartTime = 0;
    this.minTransitionDuration = 2000;
    this.lastDebugLog = 0;
    this.lastBgmUpdate = 0;
  }

  /**
   * Evaluate character priority
   * @param {object} character - Character object
   * @returns {string|null} Priority level or null
   */
  evaluateCharacterPriority(character) {
    if (!character) return null;

    // Exclude spectators and Falcons
    if (character.type === 'spectator' || character.class === 'Falcon') {
      return null;
    }

    // Tier 1: COMBAT
    if (character.combat === true || character.action === 'combat') {
      return 'combat';
    }

    // Tier 2: ECONOMIC
    if (character.working === true || character.fleeing === true || character.action === 'flee') {
      return 'economic';
    }

    // Tier 3: OTHER
    return 'other';
  }

  /**
   * Select best target by priority
   * @param {object} PlayerList - Player list
   * @returns {object} Target info {id, priority}
   */
  selectBestTarget(PlayerList) {
    const combatTargets = [];
    const economicTargets = [];
    const otherTargets = [];

    for (const id in PlayerList) {
      const character = PlayerList[id];
      const priority = this.evaluateCharacterPriority(character);

      if (priority === 'combat') {
        combatTargets.push(id);
      } else if (priority === 'economic') {
        economicTargets.push(id);
      } else if (priority === 'other') {
        otherTargets.push(id);
      }
    }

    // Return best available target by priority tier
    if (combatTargets.length > 0) {
      const randomIndex = Math.floor(Math.random() * combatTargets.length);
      return { id: combatTargets[randomIndex], priority: 'combat' };
    } else if (economicTargets.length > 0) {
      const randomIndex = Math.floor(Math.random() * economicTargets.length);
      return { id: economicTargets[randomIndex], priority: 'economic' };
    } else if (otherTargets.length > 0) {
      const randomIndex = Math.floor(Math.random() * otherTargets.length);
      return { id: otherTargets[randomIndex], priority: 'other' };
    }

    return { id: null, priority: null };
  }

  /**
   * Set new target to follow
   * @param {string} targetId - Target ID
   * @param {object} PlayerList - Player list
   */
  setNewTarget(targetId, PlayerList) {
    if (!targetId || !PlayerList[targetId]) {
      return;
    }

    const target = PlayerList[targetId];

    // Calculate initial distance
    const dx = target.x - this.cameraX;
    const dy = target.y - this.cameraY;
    this.initialDistance = Math.sqrt(dx * dx + dy * dy);

    // Calculate speed based on initial distance
    if (this.initialDistance < 800) {
      this.baseSpeed = 30 + (this.initialDistance / 800) * 20; // 30-50
    } else if (this.initialDistance < 2000) {
      this.baseSpeed = 50 + ((this.initialDistance - 800) / 1200) * 40; // 50-90
    } else {
      this.baseSpeed = 90 + ((this.initialDistance - 2000) / 3000) * 110; // 90-200
      this.baseSpeed = Math.min(this.baseSpeed, 200); // Max speed 200
    }

    this.currentTargetId = targetId;
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.lockStartTime = Date.now(); // Track when we locked onto this target
  }

  /**
   * Set Director target (entity id or static position).
   * @param {string|null} targetId - Target ID
   * @param {object|null} position - Target position {x, y, z}
   * @param {string|null} reason - Reason for target change
   */
  setDirectorTarget(targetId, position, reason) {
    if (!targetId && !position) {
      this.directorTarget = null;
      return;
    }

    this.directorTarget = {
      id: targetId || null,
      position: position || null,
      reason: reason || 'unknown',
      updatedAt: Date.now()
    };

    if (!targetId && position) {
      this.setStaticTargetPosition(position);
    }
  }

  /**
   * Set a static target position (non-entity).
   * @param {object} position - Target position {x, y, z}
   */
  setStaticTargetPosition(position) {
    if (!position || position.x === undefined || position.y === undefined) {
      return;
    }

    const dx = position.x - this.cameraX;
    const dy = position.y - this.cameraY;
    this.initialDistance = Math.sqrt(dx * dx + dy * dy);

    if (this.initialDistance < 800) {
      this.baseSpeed = 30 + (this.initialDistance / 800) * 20; // 30-50
    } else if (this.initialDistance < 2000) {
      this.baseSpeed = 50 + ((this.initialDistance - 800) / 1200) * 40; // 50-90
    } else {
      this.baseSpeed = 90 + ((this.initialDistance - 2000) / 3000) * 110; // 90-200
      this.baseSpeed = Math.min(this.baseSpeed, 200); // Max speed 200
    }

    this.targetX = position.x;
    this.targetY = position.y;
    this.targetZ = position.z || 0;
    this.staticTargetActive = true;
    this.staticTargetStartTime = Date.now();
    this.currentTargetId = null;
    this.isTransitioning = true;
    this.transitionStartTime = Date.now();
    this.lockStartTime = Date.now();
  }

  /**
   * Handle Director target command event.
   * @param {CustomEvent} event - Custom event with target details
   */
  handleDirectorTargetEvent(event) {
    const detail = (event && event.detail) || {};
    this.setDirectorTarget(detail.targetId, detail.position, detail.reason);
  }

  /**
   * Move camera toward a target position.
   * @param {number} targetX - Target x
   * @param {number} targetY - Target y
   * @param {number} targetZ - Target z
   */
  moveCameraToward(targetX, targetY, targetZ) {
    const dx = targetX - this.cameraX;
    const dy = targetY - this.cameraY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      this.isPanning = false;
      this.isTransitioning = false;
      if (targetZ !== undefined) {
        this.cameraZ = targetZ;
      }
      return;
    }

    if (dist < 0.1) return;

    const dirX = dx / dist;
    const dirY = dy / dist;

    let currentSpeed;
    if (this.isTransitioning) {
      if (dist > 300) {
        currentSpeed = this.baseSpeed;
      } else if (dist > 100) {
        const slowdownFactor = dist / 300;
        currentSpeed = this.baseSpeed * Math.max(0.2, slowdownFactor);
      } else {
        currentSpeed = this.baseSpeed * 0.2;
        this.isTransitioning = false;
      }
    } else {
      if (dist > 100) {
        currentSpeed = Math.min(dist * 0.18, 12);
      } else if (dist > 40) {
        currentSpeed = dist * 0.14;
      } else {
        currentSpeed = dist * 0.1;
      }
    }

    this.cameraX += dirX * currentSpeed;
    this.cameraY += dirY * currentSpeed;
    if (targetZ !== undefined) {
      this.cameraZ = targetZ;
    }
    this.isPanning = true;
  }

  /**
   * Update camera position
   * @param {object} PlayerList - Player list
   */
  updateCamera(PlayerList) {
    if (!this.currentTargetId || !PlayerList[this.currentTargetId]) {
      return;
    }

    const target = PlayerList[this.currentTargetId];
    this.moveCameraToward(target.x, target.y, target.z);
  }

  /**
   * Update camera position toward static target.
   */
  updateStaticCamera() {
    if (!this.staticTargetActive) {
      return;
    }

    this.moveCameraToward(this.targetX, this.targetY, this.targetZ);
  }

  /**
   * Update the camera system
   * @param {object} PlayerList - Player list
   */
  update(PlayerList) {
    if (!this.isActive) return;

    const now = Date.now();

    if (this.directorTarget) {
      const directorId = this.directorTarget.id;
      const directorPosition = this.directorTarget.position;

      if (directorId && PlayerList[directorId]) {
        if (this.currentTargetId !== directorId || this.staticTargetActive) {
          this.setNewTarget(directorId, PlayerList);
        }
        this.updateCamera(PlayerList);
      } else if (directorPosition) {
        if (!this.staticTargetActive ||
            this.targetX !== directorPosition.x ||
            this.targetY !== directorPosition.y ||
            this.targetZ !== (directorPosition.z || 0)) {
          this.setStaticTargetPosition(directorPosition);
        }
        this.updateStaticCamera();

        if (now - this.staticTargetStartTime >= this.staticTargetMaxDuration) {
          this.staticTargetActive = false;
          this.directorTarget = null;
        }
      } else {
        this.directorTarget = null;
      }
    }

    if (!this.directorTarget) {
      // Check for new targets periodically
      if (now - this.lastTargetCheckTime >= this.targetCheckInterval) {
        this.lastTargetCheckTime = now;

        const bestTarget = this.selectBestTarget(PlayerList);
        
        // Switch to new target if better priority or current target is gone
        if (!this.currentTargetId || !PlayerList[this.currentTargetId]) {
          if (bestTarget.id) {
            this.setNewTarget(bestTarget.id, PlayerList);
          }
        } else {
          // Check if maximum lock duration has expired - force switch to prevent getting stuck
          const timeLocked = now - this.lockStartTime;
          if (timeLocked >= this.maxLockDuration) {
            // Force switch to a different target if available
            if (bestTarget.id && bestTarget.id !== this.currentTargetId) {
              this.setNewTarget(bestTarget.id, PlayerList);
            } else {
              // No different target available, but we've been locked too long
              // Reset lock time to allow another maxLockDuration period
              this.lockStartTime = now;
            }
          } else {
            // Check if we should switch to a better target
            const currentPriority = this.evaluateCharacterPriority(PlayerList[this.currentTargetId]);
            const bestPriority = bestTarget.priority;

            // Priority order: combat > economic > other
            if (bestPriority === 'combat' && currentPriority !== 'combat') {
              // Always switch to combat targets
              this.setNewTarget(bestTarget.id, PlayerList);
            } else if (bestPriority === 'economic' && currentPriority === 'other') {
              // Switch from other to economic if transition is allowed
              if (now - this.transitionStartTime >= this.minTransitionDuration) {
                this.setNewTarget(bestTarget.id, PlayerList);
              }
            }
          }
        }
      }

      // Update camera position
      this.updateCamera(PlayerList);
    }

    // Send camera update to server
    this.sendCameraUpdate();
  }

  /**
   * Send camera position update to server
   */
  sendCameraUpdate() {
    if (typeof window !== 'undefined' && window.CameraHelper) {
      const cameraHelper = new window.CameraHelper();
      cameraHelper.sendCameraUpdate({
        cameraData: {
          cameraId: 'spectate', // Use a fixed ID for spectate mode
          x: this.cameraX,
          y: this.cameraY,
          z: this.cameraZ,
          mode: 'spectate',
          locked: !!this.currentTargetId,
          lockedToEntityId: this.currentTargetId,
          ownerPlayerId: null, // No associated player for spectate
          context: null
        },
        selfId: null
      });
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

  /**
   * Start the camera system
   */
  start() {
    this.isActive = true;
    if (typeof window !== 'undefined' && window.addEventListener) {
      if (!this.directorTargetHandler) {
        this.directorTargetHandler = this.handleDirectorTargetEvent.bind(this);
      }
      if (!this.directorTargetListenerAttached) {
        window.addEventListener('spectatorCameraTarget', this.directorTargetHandler);
        this.directorTargetListenerAttached = true;
      }
    }
  }

  /**
   * Stop the camera system
   */
  stop() {
    this.isActive = false;
    this.currentTargetId = null;
    this.directorTarget = null;
    this.staticTargetActive = false;
    this.staticTargetStartTime = 0;
    this.lockStartTime = 0;
    if (typeof window !== 'undefined' && window.removeEventListener && this.directorTargetListenerAttached) {
      window.removeEventListener('spectatorCameraTarget', this.directorTargetHandler);
      this.directorTargetListenerAttached = false;
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.SpectateCameraSystem = SpectateCameraSystem;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpectateCameraSystem;
}
