// SerfStateMachine - Orchestrates Serf behavior with clear state transitions
// Replaces monolithic update loop with modular, maintainable state machine

const SerfWorkManager = require('./SerfWorkManager');
const SerfWorkExecutor = require('./SerfWorkExecutor');
const SerfResourceManager = require('./SerfResourceManager');
const serfLogger = require('./SerfLogger');

// State constants
const STATES = {
  IDLE: 'idle',
  ASSIGNING: 'assigning',
  TRAVELING: 'traveling',
  WORKING: 'working',
  DEPOSITING: 'depositing',
  BUILDING: 'building',
  STUCK: 'stuck'
};

class SerfStateMachine {
  constructor() {
    this.workManager = new SerfWorkManager();
    this.workExecutor = new SerfWorkExecutor();
    this.resourceManager = new SerfResourceManager();
    this.debug = false;
  }

  /**
   * Main update method - called from Entity.js
   * 
   * @param {Object} serf - The serf entity
   */
  update(serf) {
    try {
      if (!this.validateSerf(serf)) {
        return;
      }

      // Day/night cycle transitions - check before state handling
      this.handleDayNightTransitions(serf);

      // Get current state (default to IDLE)
      const currentState = this.getState(serf);

      // Handle state-specific logic
      switch (currentState) {
        case STATES.IDLE:
          this.handleIdle(serf);
          break;
        case STATES.ASSIGNING:
          this.handleAssigning(serf);
          break;
        case STATES.TRAVELING:
          this.handleTraveling(serf);
          break;
        case STATES.WORKING:
          this.handleWorking(serf);
          break;
        case STATES.DEPOSITING:
          this.handleDepositing(serf);
          break;
        case STATES.BUILDING:
          this.handleBuilding(serf);
          break;
        case STATES.STUCK:
          this.handleStuck(serf);
          break;
      }

      // Check for stuck detection
      this.checkStuck(serf);
    } catch (error) {
      // Graceful error handling - log and reset serf to safe state
      serfLogger.error(`Error updating serf`, error, serf);
      
      // Reset to safe state
      if (serf) {
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.IDLE);
        serf.mode = 'idle';
      }
    }
  }

  /**
   * Validate serf object
   * @param {Object} serf - The serf entity
   * @returns {boolean} - True if valid
   */
  validateSerf(serf) {
    if (!serf) {
      return false;
    }
    
    // Ensure required properties exist
    if (!serf.work) {
      serf.work = { hq: null, spot: null, assignedSpot: null };
    }
    
    if (!serf.inventory) {
      serf.inventory = {};
    }
    
    if (!serf.stores) {
      serf.stores = {};
    }
    
    return true;
  }

  /**
   * Validate building object
   * @param {Object} building - The building entity
   * @returns {boolean} - True if valid
   */
  validateBuilding(building) {
    if (!building) {
      return false;
    }
    
    if (!building.built) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate work spot
   * @param {Array} spot - [col, row] coordinates
   * @returns {boolean} - True if valid
   */
  validateSpot(spot) {
    if (!spot || !Array.isArray(spot) || spot.length !== 2) {
      return false;
    }
    
    const [col, row] = spot;
    if (typeof col !== 'number' || typeof row !== 'number') {
      return false;
    }
    
    if (col < 0 || row < 0) {
      return false;
    }
    
    const mapSize = global.mapSize || 200;
    if (col >= mapSize || row >= mapSize) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle day/night cycle transitions
   * - Dawn (VI.a): Switch from idle to work
   * - Evening (VI.p): Switch from work to clockout
   * - Late night (XI.p): Switch from clockout/tavern to home/idle
   */
  handleDayNightTransitions(serf) {
    try {
      if (!this.validateSerf(serf)) {
        return;
      }

      const tempus = global.tempus;
      const period = global.period || 360;

      // Handle time-based transitions
      this.handleDawnTransition(serf, tempus);
      this.handleEveningTransition(serf, tempus, period);
      this.handleLateNightTransition(serf, tempus, period);

      // Handle clockout action - transition to idle after depositing resources
      if (serf.action === 'clockout') {
        this.handleClockout(serf);
      }
    } catch (error) {
      serfLogger.error(`Error in handleDayNightTransitions`, error, serf);
      // Don't crash on day/night transition errors - just continue
    }
  }

  /**
   * Handle dawn transition - switch from idle to work
   */
  handleDawnTransition(serf, tempus) {
    if (tempus === 'VI.a' && serf.mode !== 'work' && !serf.dayTimer) {
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * 60000); // 0-60 seconds
      
      setTimeout(() => {
        if (serf.mode !== 'work') {
          serf.mode = 'work';
          serf.action = null;
          serf.work.spot = null;
          this.setState(serf, STATES.ASSIGNING);
        }
        serf.dayTimer = false;
      }, rand);
    }
  }

  /**
   * Handle evening transition - switch from work to clockout
   */
  handleEveningTransition(serf, tempus, period) {
    if (tempus === 'VI.p' && (serf.action === 'task' || serf.action === 'build') && !serf.dayTimer) {
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * (3600000 / (period * 6)));
      
      setTimeout(() => {
        if (serf.action === 'task' || serf.action === 'build') {
          serf.action = 'clockout';
          serf.work.spot = null;
          // Release work spot so others can use it
          this.workManager.releaseWorkSpot(serf);
        }
        serf.dayTimer = false;
      }, rand);
    }
  }

  /**
   * Handle late night transition - switch from clockout/tavern to home/idle
   */
  handleLateNightTransition(serf, tempus, period) {
    if (tempus === 'XI.p' && (serf.action === 'tavern' || serf.action === 'clockout') && !serf.dayTimer) {
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * (3600000 / (period / 2)));
      
      setTimeout(() => {
        if (serf.action === 'tavern' || serf.action === 'clockout') {
          serf.tether = null;
          serf.action = 'home';
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
        }
        serf.dayTimer = false;
      }, rand);
    }
  }

  /**
   * Get state history for a serf (for debugging)
   * @param {Object} serf - The serf entity
   * @returns {Array} - Array of state history entries
   */
  getStateHistory(serf) {
    if (!serf || !serf.stateHistory) {
      return [];
    }
    return serf.stateHistory.slice(); // Return copy
  }

  /**
   * Get debug info for a serf (for debugging UI)
   * @param {Object} serf - The serf entity
   * @returns {Object} - Debug information object
   */
  getDebugInfo(serf) {
    if (!serf) {
      return { error: 'Invalid serf' };
    }

    const building = this.workManager.getWorkBuilding(serf);
    const hasResources = this.resourceManager.hasResourcesToDeposit(serf);

    return {
      id: serf.id,
      name: serf.name || serf.class,
      currentState: this.getState(serf),
      mode: serf.mode,
      action: serf.action,
      workHQ: serf.work?.hq || null,
      workSpot: serf.work?.spot || null,
      building: building ? {
        id: building.id || serf.work.hq,
        type: building.type,
        built: building.built
      } : null,
      hasResources: hasResources,
      inventory: serf.inventory ? { ...serf.inventory } : {},
      position: { x: serf.x, y: serf.y, z: serf.z },
      path: serf.path ? {
        length: serf.path.length,
        currentIndex: serf.pathCount || 0
      } : null,
      stateHistory: this.getStateHistory(serf),
      stuckCounter: serf.stuckCounter || 0,
      lastPos: serf.lastPos || null
    };
  }

  /**
   * Get current state from serf
   * Uses explicit state tracking when available, otherwise infers from properties
   */
  getState(serf) {
    if (!serf) {
      return STATES.IDLE;
    }

    // Prefer explicit state if set
    if (serf.serfState) {
      return serf.serfState;
    }

    // Handle clockout action - transitioning from work to idle
    if (serf.action === 'clockout') {
      // If has resources, deposit them first
      if (this.resourceManager.hasResourcesToDeposit(serf)) {
        return STATES.DEPOSITING;
      }
      // Otherwise heading home or to tavern
      return STATES.IDLE;
    }

    // Infer state from serf properties (fallback when explicit state not set)
    if (serf.mode === 'work') {
      return this.inferWorkState(serf);
    } else {
      return STATES.IDLE;
    }
  }

  /**
   * Infer work state from serf properties
   * Helper method to simplify getState()
   */
  inferWorkState(serf) {
    if (!serf) {
      return STATES.IDLE;
    }

    // Building takes priority
    if (serf.action === 'build') {
      return STATES.BUILDING;
    }

    // Task work
    if (serf.action === 'task') {
      // Check for resources to deposit first
      if (this.resourceManager.hasResourcesToDeposit(serf)) {
        return STATES.DEPOSITING;
      }
      
      // Check if actively working
      if (serf.workTimer || serf.working) {
        return STATES.WORKING;
      }
      
      // Check if traveling
      if (serf.path && serf.path.length > 0) {
        return STATES.TRAVELING;
      }
      
      // Check if has work spot assigned
      if (serf.work && serf.work.spot) {
        return STATES.WORKING;
      }
      
      // No spot - needs assignment
      return STATES.ASSIGNING;
    }

    // No action - needs assignment
    return STATES.ASSIGNING;
  }

  /**
   * Set serf state
   */
  setState(serf, state) {
    serf.serfState = state;
    
    if (this.debug) {
      console.log(`[SerfStateMachine] ${serf.name || serf.id} -> ${state}`);
    }
  }

  /**
   * Handle clockout action - deposit resources and go home
   * Extracted to remove duplication between handleDayNightTransitions and handleDepositing
   * 
   * @param {Object} serf - The serf entity
   * @returns {boolean} - True if still processing clockout, false if complete
   */
  handleClockout(serf) {
    if (!this.validateSerf(serf)) {
      return false;
    }

    try {
      // If serf has resources, deposit them first
      if (this.resourceManager.hasResourcesToDeposit(serf)) {
        const building = this.workManager.getWorkBuilding(serf);
        if (this.validateBuilding(building)) {
          const dropoff = this.resourceManager.getDropoffLocation(building);
          if (this.validateSpot(dropoff)) {
            const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
              Math.floor(serf.x / 64),
              Math.floor(serf.y / 64)
            ];
            
            if (!loc || !Array.isArray(loc) || loc.length !== 2) {
              return false;
            }
            
            if (loc.toString() === dropoff.toString()) {
              // At dropoff - deposit resources
              serf.facing = 'up';
              
              // Deposit all resource types with logging
              try {
                if (serf.inventory.grain >= 1) {
                  const amount = serf.inventory.grain;
                  if (this.resourceManager.depositResource(serf, 'grain', building)) {
                    serfLogger.resourceDeposit(serf, 'grain', amount, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.wood >= 1) {
                  const amount = serf.inventory.wood;
                  if (this.resourceManager.depositResource(serf, 'wood', building)) {
                    serfLogger.resourceDeposit(serf, 'wood', amount, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.stone >= 1) {
                  const amount = serf.inventory.stone;
                  if (this.resourceManager.depositResource(serf, 'stone', building)) {
                    serfLogger.resourceDeposit(serf, 'stone', amount, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.ironore >= 1) {
                  const amount = serf.inventory.ironore;
                  if (this.resourceManager.depositResource(serf, 'ironore', building)) {
                    serfLogger.resourceDeposit(serf, 'ironore', amount, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.silverore >= 1) {
                  if (this.resourceManager.depositResource(serf, 'silverore', building, 1)) {
                    serfLogger.resourceDeposit(serf, 'silverore', 1, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.goldore >= 1) {
                  if (this.resourceManager.depositResource(serf, 'goldore', building, 1)) {
                    serfLogger.resourceDeposit(serf, 'goldore', 1, building.id || serf.work.hq);
                  }
                }
                if (serf.inventory.diamond >= 1) {
                  if (this.resourceManager.depositResource(serf, 'diamond', building, 1)) {
                    serfLogger.resourceDeposit(serf, 'diamond', 1, building.id || serf.work.hq);
                  }
                }
              } catch (error) {
                serfLogger.error(`Error depositing resources during clockout`, error, serf);
              }
            } else if (!serf.path || serf.path.length === 0) {
              // Path to dropoff
              if (typeof serf.moveTo === 'function') {
                serf.moveTo(0, dropoff[0], dropoff[1]);
              }
            }
            return true; // Still depositing
          }
        }
      }
      
      // No resources or done depositing - go home or to tavern
      if (serf.home) {
        const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
          Math.floor(serf.x / 64),
          Math.floor(serf.y / 64)
        ];
        
        if (!loc || !Array.isArray(loc) || loc.length !== 2) {
          // Invalid location - just become idle
          serf.action = null;
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
          return false;
        }
        
        if (serf.z !== serf.home.z || loc.toString() !== serf.home.loc.toString()) {
          if (!serf.path && typeof serf.moveTo === 'function') {
            serf.moveTo(serf.home.z, serf.home.loc[0], serf.home.loc[1]);
          }
          return true; // Still traveling home
        } else {
          // Arrived home - become idle
          serf.action = null;
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
          return false;
        }
      } else {
        // No home - just become idle
        serf.action = null;
        serf.mode = 'idle';
        this.setState(serf, STATES.IDLE);
        return false;
      }
    } catch (error) {
      serfLogger.error(`Error in handleClockout`, error, serf);
      // On error, just become idle
      serf.action = null;
      serf.mode = 'idle';
      this.setState(serf, STATES.IDLE);
      return false;
    }
  }

  /**
   * Handle IDLE state - wandering, no work assigned
   * Note: Day/night transitions are handled in handleDayNightTransitions()
   */
  handleIdle(serf) {
    // Idle serfs just wander - day/night transitions handled separately
    // This method can be extended for idle behavior if needed
  }

  /**
   * Handle ASSIGNING state - finding work building/spot
   */
  handleAssigning(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    // Check if we need to build hut first (male serfs)
    if (serf.hut && global.Building && global.Building.list) {
      const hut = global.Building.list[serf.hut];
      if (hut && !hut.built) {
        // Need to build hut first
        this.setState(serf, STATES.BUILDING);
        serf.action = 'build';
        serf.mode = 'work';
        return;
      }
    }

    // Ensure we have a work building
    if (!serf.work || !serf.work.hq) {
      try {
        const buildingId = this.workManager.assignWorkBuilding(serf);
        if (!buildingId) {
          // No work available - stay idle
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
          return;
        }
        } catch (error) {
          serfLogger.error(`Error assigning work building`, error, serf);
        serf.mode = 'idle';
        this.setState(serf, STATES.IDLE);
        return;
      }
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      // Building doesn't exist or isn't built
      serf.work.hq = null;
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Assign work spot
    try {
      const spot = this.workManager.assignWorkSpot(serf, building);
      if (spot && this.validateSpot(spot)) {
        serf.action = 'task';
        serfLogger.workAssignment(serf, building.id || serf.work.hq, spot);
        this.setState(serf, STATES.TRAVELING);
      } else {
        // No spots available - stay idle
        serfLogger.warn(`No work spots available`, serf, { buildingId: building.id || serf.work.hq });
        serf.mode = 'idle';
        this.setState(serf, STATES.IDLE);
      }
    } catch (error) {
      serfLogger.error(`Error assigning work spot`, error, serf);
      serf.mode = 'idle';
      this.setState(serf, STATES.IDLE);
    }
  }

  /**
   * Handle TRAVELING state - pathfinding to work location
   */
  handleTraveling(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    const spot = serf.work.spot;
    if (!this.validateSpot(spot)) {
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    try {
      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        // Invalid location - reassign
        this.setState(serf, STATES.ASSIGNING);
        return;
      }

      // Check if we've reached the spot
      if (loc.toString() === spot.toString()) {
        // Reached spot - start working
        this.setState(serf, STATES.WORKING);
      } else if (!serf.path || serf.path.length === 0) {
        // No path - request one
        if (typeof serf.moveTo === 'function') {
          serf.moveTo(0, spot[0], spot[1]);
        } else {
          // moveTo not available - reassign
          this.setState(serf, STATES.ASSIGNING);
        }
      }
    } catch (error) {
      serfLogger.error(`Error in handleTraveling`, error, serf);
      this.setState(serf, STATES.ASSIGNING);
    }
  }

  /**
   * Handle WORKING state - executing economic activity
   */
  handleWorking(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Validate assignment
    try {
      if (!this.workManager.validateWorkAssignment(serf)) {
        this.setState(serf, STATES.ASSIGNING);
        return;
      }
      } catch (error) {
        serfLogger.error(`Error validating work assignment`, error, serf);
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    const spot = serf.work.spot;
    if (!this.validateSpot(spot)) {
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Execute work
    try {
      const result = this.workExecutor.executeWork(serf, building, spot);
      
      // Handle result
      switch (result) {
        case 'working':
          // Continue working
          break;
        case 'traveling':
          this.setState(serf, STATES.TRAVELING);
          break;
        case 'depositing':
          this.setState(serf, STATES.DEPOSITING);
          break;
        case 'idle':
          this.setState(serf, STATES.ASSIGNING);
          break;
        default:
          // Unknown result - reassign
          this.setState(serf, STATES.ASSIGNING);
          break;
      }
    } catch (error) {
      serfLogger.error(`Error executing work`, error, serf);
      this.setState(serf, STATES.ASSIGNING);
    }
  }

  /**
   * Handle DEPOSITING state - carrying resources to dropoff
   */
  handleDepositing(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Check if we have resources
    try {
      if (!this.resourceManager.hasResourcesToDeposit(serf)) {
        // No resources - return to work
        this.setState(serf, STATES.TRAVELING);
        return;
      }
    } catch (error) {
      if (this.debug) {
        console.error(`[SerfStateMachine] Error checking resources:`, error);
      }
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // For miners in cave, exit first - moveTo() handles cave exit automatically
    if (serf.z === -1 && (serf.inventory.ironore >= 1 || 
                          serf.inventory.silverore >= 1 || 
                          serf.inventory.goldore >= 1 || 
                          serf.inventory.diamond >= 1)) {
      if (serf.caveEntrance && Array.isArray(serf.caveEntrance) && serf.caveEntrance.length === 2) {
        try {
          if (!serf.path && typeof serf.moveTo === 'function') {
            // moveTo() automatically handles cave exit when called from z=-1 to z=0
            serf.moveTo(0, serf.caveEntrance[0], serf.caveEntrance[1]);
          }
        } catch (error) {
          if (this.debug) {
            console.error(`[SerfStateMachine] Error exiting cave:`, error);
          }
        }
        return; // Still exiting cave
      }
    }

    // Path to dropoff
    try {
      const dropoff = this.resourceManager.getDropoffLocation(building);
      if (!this.validateSpot(dropoff)) {
        this.setState(serf, STATES.ASSIGNING);
        return;
      }

      if (this.resourceManager.isAtDropoff(serf, building)) {
        // At dropoff - deposit resources
        serf.facing = 'up';

        // Deposit all resource types with error handling
        try {
          if (serf.inventory.grain >= 1) {
            this.resourceManager.depositResource(serf, 'grain', building);
          }
          if (serf.inventory.wood >= 1) {
            this.resourceManager.depositResource(serf, 'wood', building);
          }
          if (serf.inventory.stone >= 1) {
            this.resourceManager.depositResource(serf, 'stone', building);
          }
          if (serf.inventory.ironore >= 1) {
            this.resourceManager.depositResource(serf, 'ironore', building);
          }
          if (serf.inventory.silverore >= 1) {
            this.resourceManager.depositResource(serf, 'silverore', building, 1);
          }
          if (serf.inventory.goldore >= 1) {
            this.resourceManager.depositResource(serf, 'goldore', building, 1);
          }
          if (serf.inventory.diamond >= 1) {
            this.resourceManager.depositResource(serf, 'diamond', building, 1);
          }
        } catch (error) {
          serfLogger.error(`Error depositing resources`, error, serf);
          // Continue anyway - some resources may have been deposited
        }

        // Return to work spot
        this.setState(serf, STATES.TRAVELING);
      } else {
        // Path to dropoff
        if (!serf.path && typeof serf.moveTo === 'function') {
          serf.moveTo(0, dropoff[0], dropoff[1]);
        } else if (!serf.path) {
          // moveTo not available - reassign
          this.setState(serf, STATES.ASSIGNING);
        }
      }
    } catch (error) {
      serfLogger.error(`Error in handleDepositing`, error, serf);
      this.setState(serf, STATES.ASSIGNING);
    }
  }

  /**
   * Handle BUILDING state - constructing hut
   */
  handleBuilding(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    if (!serf.hut || !global.Building || !global.Building.list) {
      serf.mode = 'idle';
      serf.action = null;
      this.setState(serf, STATES.IDLE);
      return;
    }

    const hut = global.Building.list[serf.hut];
    if (!hut) {
      serf.mode = 'idle';
      serf.action = null;
      this.setState(serf, STATES.IDLE);
      return;
    }

    if (hut.built) {
      // Hut is built - transition to economic work
      serf.action = null;
      if (!serf.work.hq) {
        try {
          this.workManager.assignWorkBuilding(serf);
        } catch (error) {
          serfLogger.error(`Error assigning work after building`, error, serf);
        }
      }
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Execute building work
    const spot = serf.work.spot;
    if (spot && this.validateSpot(spot)) {
      try {
        const result = this.workExecutor.executeBuilding(serf, hut, spot);
        
        if (result === 'idle') {
          // Need new spot or done
          if (hut.built) {
            serf.action = null;
            this.setState(serf, STATES.ASSIGNING);
          } else {
            // Find new foundation tile
            try {
              const buildableTiles = [];
              if (hut.plot && Array.isArray(hut.plot)) {
                for (const i in hut.plot) {
                  const p = hut.plot[i];
                  if (Array.isArray(p) && p.length === 2) {
                    const t = global.getTile ? global.getTile(0, p[0], p[1]) : 0;
                    if (t === 11) { // Foundation tile
                      buildableTiles.push(p);
                    }
                  }
                }
              }
              
              if (buildableTiles.length > 0) {
                const randomTile = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
                serf.work.spot = randomTile;
              } else {
                serf.mode = 'idle';
                serf.action = null;
                this.setState(serf, STATES.IDLE);
              }
            } catch (error) {
              if (this.debug) {
                console.error(`[SerfStateMachine] Error finding buildable tiles:`, error);
              }
              serf.mode = 'idle';
              serf.action = null;
              this.setState(serf, STATES.IDLE);
            }
          }
        }
      } catch (error) {
        serfLogger.error(`Error executing building`, error, serf);
        serf.mode = 'idle';
        serf.action = null;
        this.setState(serf, STATES.IDLE);
      }
    } else {
      // Find foundation tile to build
      try {
        const buildableTiles = [];
        if (hut.plot && Array.isArray(hut.plot)) {
          for (const i in hut.plot) {
            const p = hut.plot[i];
            if (Array.isArray(p) && p.length === 2) {
              const t = global.getTile ? global.getTile(0, p[0], p[1]) : 0;
              if (t === 11) { // Foundation tile
                buildableTiles.push(p);
              }
            }
          }
        }
        
        if (buildableTiles.length > 0) {
          const randomTile = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
          serf.work.spot = randomTile;
        } else {
          serf.mode = 'idle';
          serf.action = null;
          this.setState(serf, STATES.IDLE);
        }
        } catch (error) {
          serfLogger.error(`Error finding foundation tiles`, error, serf);
        serf.mode = 'idle';
        serf.action = null;
        this.setState(serf, STATES.IDLE);
      }
    }
  }

  /**
   * Handle STUCK state - pathfinding failed, needs recovery
   */
  handleStuck(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    try {
      // Clear path and try to reassign
      serf.path = null;
      serf.pathCount = 0;
      serf.work.spot = null;
      this.workManager.releaseWorkSpot(serf);
      
      // Reset idle time
      serf.idleTime = 0;
      
      // Try to reassign
      this.setState(serf, STATES.ASSIGNING);
    } catch (error) {
      serfLogger.error(`Error in handleStuck`, error, serf);
      // Fallback: just go idle
      serf.mode = 'idle';
      serf.action = null;
      this.setState(serf, STATES.IDLE);
    }
  }

  /**
   * Check if serf is stuck and transition to STUCK state if needed
   */
  checkStuck(serf) {
    if (!this.validateSerf(serf)) {
      return;
    }

    try {
      if (!serf.lastPos) {
        serf.lastPos = { x: serf.x, y: serf.y };
        return;
      }

      const dist = Math.sqrt(
        Math.pow(serf.x - serf.lastPos.x, 2) + 
        Math.pow(serf.y - serf.lastPos.y, 2)
      );

      // Only count as stuck if we have a path but aren't moving
      if (serf.path && serf.pathCount < serf.path.length && dist < 2) {
        serf.stuckCounter = (serf.stuckCounter || 0) + 1;
        
      if (serf.stuckCounter > 180) { // Stuck for 3 seconds at 60fps
        serfLogger.stuck(serf, serf.stuckCounter);
        this.setState(serf, STATES.STUCK);
        serf.stuckCounter = 0;
      }
      } else {
        serf.stuckCounter = 0;
      }

      serf.lastPos = { x: serf.x, y: serf.y };
    } catch (error) {
      if (this.debug) {
        console.error(`[SerfStateMachine] Error in checkStuck:`, error);
      }
      // Reset lastPos on error
      serf.lastPos = { x: serf.x, y: serf.y };
    }
  }
}

// Create singleton instance
const serfStateMachine = new SerfStateMachine();

module.exports = serfStateMachine;
module.exports.SerfStateMachine = SerfStateMachine;
module.exports.STATES = STATES;

