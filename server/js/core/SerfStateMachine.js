// SerfStateMachine - Orchestrates Serf behavior with clear state transitions
// Replaces monolithic update loop with modular, maintainable state machine

const SerfWorkManager = require('./SerfWorkManager');
const SerfWorkExecutor = require('./SerfWorkExecutor');
const SerfResourceManager = require('./SerfResourceManager');
const serfLogger = require('./SerfLogger');
const timerManager = global.timerManager || null;

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
        // Clear any active timers
        this.clearSerfTimers(serf);
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
   * Deposit all resources a serf has (common and rare)
   * @param {Object} serf - The serf entity
   * @param {Object} building - The building to deposit to
   * @returns {boolean} - True if any deposits were attempted
   */
  depositAllResources(serf, building) {
    if (!serf || !building) return false;
    
    let anyDeposited = false;
    try {
      // Common resources (grain, wood, stone, ironore) deposit at >= 10
      if (serf.inventory.grain >= 10) {
        const amount = serf.inventory.grain;
        if (this.resourceManager.depositResource(serf, 'grain', building)) {
          serfLogger.resourceDeposit(serf, 'grain', amount, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      if (serf.inventory.wood >= 10) {
        const amount = serf.inventory.wood;
        if (this.resourceManager.depositResource(serf, 'wood', building)) {
          serfLogger.resourceDeposit(serf, 'wood', amount, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      if (serf.inventory.stone >= 10) {
        const amount = serf.inventory.stone;
        if (this.resourceManager.depositResource(serf, 'stone', building)) {
          serfLogger.resourceDeposit(serf, 'stone', amount, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      if (serf.inventory.ironore >= 10) {
        const amount = serf.inventory.ironore;
        if (this.resourceManager.depositResource(serf, 'ironore', building)) {
          serfLogger.resourceDeposit(serf, 'ironore', amount, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      // Rare ores deposit immediately at >= 1
      if (serf.inventory.silverore >= 1) {
        if (this.resourceManager.depositResource(serf, 'silverore', building, 1)) {
          serfLogger.resourceDeposit(serf, 'silverore', 1, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      if (serf.inventory.goldore >= 1) {
        if (this.resourceManager.depositResource(serf, 'goldore', building, 1)) {
          serfLogger.resourceDeposit(serf, 'goldore', 1, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
      if (serf.inventory.diamond >= 1) {
        if (this.resourceManager.depositResource(serf, 'diamond', building, 1)) {
          serfLogger.resourceDeposit(serf, 'diamond', 1, building.id || serf.work.hq);
          anyDeposited = true;
        }
      }
    } catch (error) {
      serfLogger.error(`Error depositing resources`, error, serf);
    }
    return anyDeposited;
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
      // Clear any existing day timer first
      if (serf.dayTimerId && timerManager) {
        timerManager.clear(serf.dayTimerId);
      }
      
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * 60000); // 0-60 seconds
      
      const timerCallback = () => {
        // Verify serf still exists and is in valid state
        if (!serf || !this.validateSerf(serf)) {
          return;
        }
        
        if (serf.mode !== 'work') {
          serf.mode = 'work';
          serf.action = null;
          serf.work.spot = null;
          this.setState(serf, STATES.ASSIGNING);
        }
        serf.dayTimer = false;
        serf.dayTimerId = null;
      };
      
      if (timerManager) {
        const timerName = `serf-dawn-${serf.id}`;
        serf.dayTimerId = timerName;
        timerManager.setTimeout(timerName, timerCallback, rand);
      } else {
        // Fallback to raw setTimeout if timerManager not available
        const timeoutId = setTimeout(timerCallback, rand);
        serf.dayTimerId = timeoutId;
      }
    }
  }

  /**
   * Handle evening transition - switch from work to clockout
   */
  handleEveningTransition(serf, tempus, period) {
    if (tempus === 'VI.p' && (serf.action === 'task' || serf.action === 'build') && !serf.dayTimer) {
      // Clear any existing day timer first
      if (serf.dayTimerId && timerManager) {
        timerManager.clear(serf.dayTimerId);
      }
      
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * (3600000 / (period * 6)));
      
      const timerCallback = () => {
        // Verify serf still exists and is in valid state
        if (!serf || !this.validateSerf(serf)) {
          return;
        }
        
        if (serf.action === 'task' || serf.action === 'build') {
          serf.action = 'clockout';
          serf.work.spot = null;
          // Release work spot so others can use it
          this.workManager.releaseWorkSpot(serf);
        }
        serf.dayTimer = false;
        serf.dayTimerId = null;
      };
      
      if (timerManager) {
        const timerName = `serf-evening-${serf.id}`;
        serf.dayTimerId = timerName;
        timerManager.setTimeout(timerName, timerCallback, rand);
      } else {
        // Fallback to raw setTimeout if timerManager not available
        const timeoutId = setTimeout(timerCallback, rand);
        serf.dayTimerId = timeoutId;
      }
    }
  }

  /**
   * Handle late night transition - switch from clockout/tavern to home/idle
   */
  handleLateNightTransition(serf, tempus, period) {
    if (tempus === 'XI.p' && (serf.action === 'tavern' || serf.action === 'clockout') && !serf.dayTimer) {
      // Clear any existing day timer first
      if (serf.dayTimerId && timerManager) {
        timerManager.clear(serf.dayTimerId);
      }
      
      serf.dayTimer = true;
      const rand = Math.floor(Math.random() * (3600000 / (period / 2)));
      
      const timerCallback = () => {
        // Verify serf still exists and is in valid state
        if (!serf || !this.validateSerf(serf)) {
          return;
        }
        
        if (serf.action === 'tavern' || serf.action === 'clockout') {
          serf.tether = null;
          serf.action = 'home';
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
        }
        serf.dayTimer = false;
        serf.dayTimerId = null;
      };
      
      if (timerManager) {
        const timerName = `serf-latenight-${serf.id}`;
        serf.dayTimerId = timerName;
        timerManager.setTimeout(timerName, timerCallback, rand);
      } else {
        // Fallback to raw setTimeout if timerManager not available
        const timeoutId = setTimeout(timerCallback, rand);
        serf.dayTimerId = timeoutId;
      }
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

    // Prefer explicit state if set - trust explicit states to prevent jittering
    // Only re-validate if there's been a significant change (mode/action change)
    if (serf.serfState) {
      // Check if mode or action has changed since state was set
      const stateKey = `${serf.mode}|${serf.action || 'null'}`;
      if (serf._lastStateKey === stateKey && serf._lastStateKeyState === serf.serfState) {
        // No significant change - trust the explicit state
        return serf.serfState;
      }
      
      // Mode or action changed - do a lenient validation
      // Only invalidate if state is clearly wrong (not just slightly off)
      if (this.validateStateLenient(serf, serf.serfState)) {
        // State is reasonable - trust it
        serf._lastStateKey = stateKey;
        serf._lastStateKeyState = serf.serfState;
        return serf.serfState;
      } else {
        // State is clearly wrong - reset and infer
        serfLogger.warn(`Invalid explicit state ${serf.serfState}, inferring new state`, serf);
        serf.serfState = null;
        serf._lastStateKey = null;
        serf._lastStateKeyState = null;
      }
    }

    // Handle clockout action - transitioning from work to idle
    if (serf.action === 'clockout') {
      // If has resources, deposit them first
      if (this.resourceManager.hasResourcesToDeposit(serf)) {
        const inferredState = STATES.DEPOSITING;
        // Set explicit state to avoid re-inference
        this.setState(serf, inferredState);
        return inferredState;
      }
      // Otherwise heading home or to tavern
      const inferredState = STATES.IDLE;
      this.setState(serf, inferredState);
      return inferredState;
    }

    // Infer state from serf properties (fallback when explicit state not set)
    let inferredState;
    if (serf.mode === 'work') {
      inferredState = this.inferWorkState(serf);
    } else {
      inferredState = STATES.IDLE;
    }
    
    // Set the inferred state explicitly to reduce future inference
    if (!serf.serfState || serf.serfState !== inferredState) {
      this.setState(serf, inferredState);
    }
    
    return inferredState;
  }

  /**
   * Lenient validation - only invalidates if state is clearly wrong
   * More permissive than strict validation to prevent jittering
   * @param {Object} serf - The serf entity
   * @param {string} state - The state to validate
   * @returns {boolean} - True if state is reasonably valid
   */
  validateStateLenient(serf, state) {
    if (!serf || !state) {
      return false;
    }

    // Basic sanity checks - very lenient
    switch (state) {
      case STATES.WORKING:
        // Just check that we're in work mode - don't require perfect alignment
        return serf.mode === 'work';
      
      case STATES.DEPOSITING:
        // Depositing is valid if in work mode and has work building
        return serf.mode === 'work' && serf.work && serf.work.hq;
      
      case STATES.TRAVELING:
        // Traveling is valid if has destination or path
        return (serf.path && serf.path.length > 0) || 
               (serf.work && (serf.work.spot || serf.work.hq)) ||
               serf.mode === 'work';
      
      case STATES.BUILDING:
        // Building is valid if build action exists, OR has hut assigned, OR has work building in work mode
        return serf.action === 'build' || 
               serf.hut || 
               (serf.mode === 'work' && serf.work && serf.work.hq);
      
      case STATES.ASSIGNING:
        // Assigning is valid if in work mode
        return serf.mode === 'work';
      
      case STATES.IDLE:
        // Idle is always valid
        return true;
      
      case STATES.STUCK:
        // Stuck is valid if explicitly set
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Validate that a state is consistent with serf properties (strict)
   * @param {Object} serf - The serf entity
   * @param {string} state - The state to validate
   * @returns {boolean} - True if state is valid
   */
  validateState(serf, state) {
    if (!serf || !state) {
      return false;
    }

    // Basic validation rules
    switch (state) {
      case STATES.WORKING:
        // Working state should have work building and spot, with task action
        // More lenient - don't require mode === 'work' since it might change temporarily
        return serf.action === 'task' &&
               serf.work && serf.work.hq;
      
      case STATES.DEPOSITING:
        // Depositing should have resources OR be heading to dropoff
        // Check if has resources, or if has work building (indicating heading to dropoff)
        if (this.resourceManager.hasResourcesToDeposit(serf)) {
          return true;
        }
        // Also valid if has work building and dropoff location (serf might have just deposited)
        const building = this.workManager.getWorkBuilding(serf);
        return building && this.resourceManager.getDropoffLocation(building) !== null;
      
      case STATES.TRAVELING:
        // Traveling should have a path or destination
        return (serf.path && serf.path.length > 0) || 
               (serf.work && serf.work.spot);
      
      case STATES.BUILDING:
        // Building should have build action
        // Very lenient - just check for build action (mode might change temporarily)
        return serf.action === 'build';
      
      case STATES.ASSIGNING:
        // Assigning should be in work mode but not have spot assigned yet or action not set to task
        return serf.mode === 'work' && 
               (!serf.work || !serf.work.spot || serf.action !== 'task');
      
      case STATES.IDLE:
        // Idle is always valid
        return true;
      
      case STATES.STUCK:
        // Stuck is valid if explicitly set
        return true;
      
      default:
        return false;
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

    // Clockout takes priority - don't infer WORKING/BUILDING during clockout
    if (serf.action === 'clockout') {
      // If has resources, need to deposit them first
      if (this.resourceManager.hasResourcesToDeposit(serf)) {
        return STATES.DEPOSITING;
      }
      // Otherwise, clockout handler will manage going home (IDLE/TRAVELING)
      // Return IDLE to let clockout handler take over
      return STATES.IDLE;
    }

    // Building takes priority (but not during clockout)
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
   * Clear all timers for a serf
   * @param {Object} serf - The serf entity
   */
  clearSerfTimers(serf) {
    if (!serf) return;
    
    // Clear day/night transition timer
    if (serf.dayTimerId && timerManager) {
      timerManager.clear(serf.dayTimerId);
      serf.dayTimerId = null;
    }
    serf.dayTimer = false;
    
    // Clear any work timers (stored by SerfWorkExecutor)
    if (serf.workTimerId) {
      if (timerManager) {
        timerManager.clear(serf.workTimerId);
      } else if (global.clearTimeout) {
        global.clearTimeout(serf.workTimerId);
      }
      serf.workTimerId = null;
    }
    if (serf.workTimeoutId) {
      if (timerManager) {
        timerManager.clear(serf.workTimeoutId);
      } else if (global.clearTimeout) {
        global.clearTimeout(serf.workTimeoutId);
      }
      serf.workTimeoutId = null;
    }
  }

  /**
   * Set serf state
   */
  setState(serf, state) {
    const oldState = serf.serfState;
    serf.serfState = state;
    
    // Update state key cache when state changes
    serf._lastStateKey = `${serf.mode}|${serf.action || 'null'}`;
    serf._lastStateKeyState = state;
    
    // Clear timers when transitioning away from certain states
    if (oldState !== state) {
      // Clear work timers when leaving working states
      if (oldState === STATES.WORKING || oldState === STATES.BUILDING) {
        // WorkExecutor will handle cleanup, but we ensure it's done
        if (serf.workTimerId || serf.workTimeoutId) {
          // Clear is handled by work executor, but verify cleanup
        }
      }
      
      // Clear day timer when transitioning to idle from clockout
      if (state === STATES.IDLE && oldState !== STATES.IDLE) {
        if (serf.dayTimerId && timerManager) {
          timerManager.clear(serf.dayTimerId);
          serf.dayTimerId = null;
        }
        serf.dayTimer = false;
      }
    }
    
    if (this.debug) {
      console.log(`[SerfStateMachine] ${serf.name || serf.id} -> ${state}`);
    }
  }

  /**
   * Handle clockout action - deposit resources and go home
   * Manages state transitions explicitly for clarity
   * 
   * @param {Object} serf - The serf entity
   */
  handleClockout(serf) {
    if (!this.validateSerf(serf)) {
      return;
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
              // Invalid location - just become idle
              serf.action = null;
              serf.mode = 'idle';
              this.setState(serf, STATES.IDLE);
              return;
            }
            
            if (loc.toString() === dropoff.toString() && serf.z === 0) {
              // At dropoff - deposit resources
              serf.facing = 'up';
              this.depositAllResources(serf, building);
              // After deposit, check if still has resources - if so, continue depositing
              if (this.resourceManager.hasResourcesToDeposit(serf)) {
                this.setState(serf, STATES.DEPOSITING);
                return;
              }
              // No more resources - fall through to go home logic
            } else {
              // Not at dropoff - path to dropoff (Entity.js will handle z-transition if needed)
              if (!serf.path || serf.path.length === 0) {
                if (typeof serf.moveTo === 'function') {
                  serf.moveTo(0, dropoff[0], dropoff[1]);
                }
              }
              this.setState(serf, STATES.DEPOSITING);
              return;
            }
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
          return;
        }
        
        if (serf.z !== serf.home.z || loc.toString() !== serf.home.loc.toString()) {
          if (!serf.path && typeof serf.moveTo === 'function') {
            serf.moveTo(serf.home.z, serf.home.loc[0], serf.home.loc[1]);
          }
          this.setState(serf, STATES.TRAVELING);
          return;
        } else {
          // Arrived home - become idle
          serf.action = null;
          serf.mode = 'idle';
          this.setState(serf, STATES.IDLE);
          return;
        }
      } else {
        // No home - become idle (Entity.js will handle z-transition if needed when pathing elsewhere)
        serf.action = null;
        serf.mode = 'idle';
        this.setState(serf, STATES.IDLE);
        return;
      }
    } catch (error) {
      serfLogger.error(`Error in handleClockout`, error, serf);
      // On error, just become idle
      serf.action = null;
      serf.mode = 'idle';
      this.setState(serf, STATES.IDLE);
      return;
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
        serf.action = 'build';
        serf.mode = 'work';
        this.setState(serf, STATES.BUILDING);
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
          serf.action = null;
          this.setState(serf, STATES.IDLE);
          return;
        }
      } catch (error) {
        serfLogger.error(`Error assigning work building`, error, serf);
        // Rollback: ensure serf is in safe state
        serf.mode = 'idle';
        serf.action = null;
        if (serf.work) {
          serf.work.hq = null;
          serf.work.spot = null;
        }
        this.setState(serf, STATES.IDLE);
        return;
      }
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      // Building doesn't exist or isn't built - rollback assignment
      serf.work.hq = null;
      serf.work.spot = null;
      // Try again next frame
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
        // Release building assignment if no spots
        serf.work.hq = null;
        serf.mode = 'idle';
        serf.action = null;
        this.setState(serf, STATES.IDLE);
      }
    } catch (error) {
      serfLogger.error(`Error assigning work spot`, error, serf);
      // Rollback: release work building and go idle
      serf.work.hq = null;
      serf.work.spot = null;
      serf.mode = 'idle';
      serf.action = null;
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
      // Clear path before reassigning
      serf.path = null;
      serf.pathCount = 0;
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    const spot = serf.work.spot;
    if (!this.validateSpot(spot)) {
      // Clear path before reassigning
      serf.path = null;
      serf.pathCount = 0;
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    try {
      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        // Invalid location - clear path and reassign
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.ASSIGNING);
        return;
      }

      // Check if this is mining work that requires cave entry
      const isMiningWork = building.type === 'mine' && building.cave && Array.isArray(building.cave);
      
      // For mining work, need to enter cave first if not already in cave
      if (isMiningWork && serf.z !== -1) {
        // Path to cave entrance first, not directly to work spot
        const caveEntrance = building.cave;
        const alreadyAtEntrance = (serf.z === 0 && loc.toString() === caveEntrance.toString());
        
        if (!alreadyAtEntrance) {
          // Store cave entrance for later use
          if (!serf.caveEntrance || !Array.isArray(serf.caveEntrance)) {
            serf.caveEntrance = caveEntrance;
          }
          
          // Path to cave entrance on overworld
          if (!serf.path || serf.path.length === 0) {
            if (typeof serf.moveTo === 'function') {
              serf.moveTo(0, caveEntrance[0], caveEntrance[1]);
            } else {
              serf.path = null;
              serf.pathCount = 0;
              this.setState(serf, STATES.ASSIGNING);
            }
          }
          // Let Entity.js handle z-transition when serf reaches cave entrance
          return;
        }
        // Already at entrance - Entity.js will handle cave entry, then executeMining will handle pathfinding inside cave
        return;
      }

      // Check if we've reached the spot (for non-mining work, or mining work already in cave)
      if (loc.toString() === spot.toString() && (!isMiningWork || serf.z === -1)) {
        // Reached spot - clear path and start working
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.WORKING);
      } else if (!serf.path || serf.path.length === 0) {
        // No path - request one
        if (typeof serf.moveTo === 'function') {
          // For mining work in cave, use z=-1, otherwise z=0
          const targetZ = (isMiningWork && serf.z === -1) ? -1 : 0;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1062',message:'handleTraveling requesting path to spot',data:{serfId:serf.id,currentZ:serf.z,targetZ:targetZ,spot:spot,loc:loc,isMiningWork:isMiningWork,pathLength:serf.path?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
          // #endregion
          serf.moveTo(targetZ, spot[0], spot[1]);
        } else {
          // moveTo not available - clear path and reassign
          serf.path = null;
          serf.pathCount = 0;
          this.setState(serf, STATES.ASSIGNING);
        }
      } else if (serf.path && serf.path.length > 0 && serf.pathCount >= serf.path.length) {
        // Path completed - check if we're close to destination (within 1 tile)
        const distance = Math.abs(loc[0] - spot[0]) + Math.abs(loc[1] - spot[1]);
        if (distance <= 1) {
          // Close enough - consider reached (accounting for pathfinding rounding)
          serf.path = null;
          serf.pathCount = 0;
          this.setState(serf, STATES.WORKING);
        } else {
          // Path completed but not at destination - pathfinding may have failed or path was incomplete
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1080',message:'handleTraveling path completed but not at destination',data:{serfId:serf.id,z:serf.z,spot:spot,loc:loc,pathCount:serf.pathCount,pathLength:serf.path?.length||0,isMiningWork:isMiningWork,distance:distance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,F'})}).catch(()=>{});
          // #endregion
          serf.path = null;
          serf.pathCount = 0;
          // Try once more to request path
          if (typeof serf.moveTo === 'function') {
            // For mining work in cave, use z=-1, otherwise z=0
            const targetZ = (isMiningWork && serf.z === -1) ? -1 : 0;
            serf.moveTo(targetZ, spot[0], spot[1]);
          } else {
            this.setState(serf, STATES.ASSIGNING);
          }
        }
      }
    } catch (error) {
      serfLogger.error(`Error in handleTraveling`, error, serf);
      // Clear path on error
      serf.path = null;
      serf.pathCount = 0;
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

    // Don't work during clockout - let handleClockout handle it
    if (serf.action === 'clockout') {
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
      // #region agent log
      if (building && building.type === 'mine') {
        fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1140',message:'handleWorking executeWork result',data:{serfId:serf.id,z:serf.z,result:result,hasResources:this.resourceManager.hasResourcesToDeposit(serf),inventory:JSON.parse(JSON.stringify(serf.inventory||{}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
      }
      // #endregion

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

    // Prevent conflict with clockout - if clocking out, let handleClockout handle it
    if (serf.action === 'clockout') {
      return; // handleClockout is called separately
    }

    const building = this.workManager.getWorkBuilding(serf);
    if (!this.validateBuilding(building)) {
      // Clear path before reassigning
      serf.path = null;
      serf.pathCount = 0;
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Check if we have resources
    try {
      if (!this.resourceManager.hasResourcesToDeposit(serf)) {
        // No resources - clear path and return to work
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.TRAVELING);
        return;
      }
    } catch (error) {
      if (this.debug) {
        console.error(`[SerfStateMachine] Error checking resources:`, error);
      }
      serf.path = null;
      serf.pathCount = 0;
      this.setState(serf, STATES.ASSIGNING);
      return;
    }

    // Path to dropoff
    try {
      const dropoff = this.resourceManager.getDropoffLocation(building);
      if (!this.validateSpot(dropoff)) {
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.ASSIGNING);
        return;
      }

      if (this.resourceManager.isAtDropoff(serf, building)) {
        // At dropoff - deposit resources
        serf.facing = 'up';
        this.depositAllResources(serf, building);

        // Clear path and return to work spot
        serf.path = null;
        serf.pathCount = 0;
        this.setState(serf, STATES.TRAVELING);
      } else {
        // Path to dropoff
        const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
          Math.floor(serf.x / 64),
          Math.floor(serf.y / 64)
        ];
        // #region agent log
        if (building && building.type === 'mine') {
          fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1305',message:'handleDepositing pathing to dropoff',data:{serfId:serf.id,z:serf.z,dropoff:dropoff,loc:loc,hasPath:!!serf.path,pathLength:serf.path?.length||0,pathCount:serf.pathCount,hasResources:this.resourceManager.hasResourcesToDeposit(serf),inventory:JSON.parse(JSON.stringify(serf.inventory||{}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        }
        // #endregion
        
        // Check if we have a valid path
        if (!serf.path || serf.path.length === 0) {
          // No path - request one
          if (typeof serf.moveTo === 'function') {
            serf.moveTo(0, dropoff[0], dropoff[1]);
          } else {
            // moveTo not available - clear and reassign
            serf.path = null;
            serf.pathCount = 0;
            this.setState(serf, STATES.ASSIGNING);
          }
        } else if (serf.pathCount >= serf.path.length) {
          // Path completed - check if we're close to dropoff (within 1 tile)
          const distance = Math.abs(loc[0] - dropoff[0]) + Math.abs(loc[1] - dropoff[1]);
          // #region agent log
          if (building && building.type === 'mine') {
            fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1320',message:'handleDepositing path completed',data:{serfId:serf.id,z:serf.z,loc:loc,dropoff:dropoff,distance:distance,pathLength:serf.path.length,pathCount:serf.pathCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          }
          // #endregion
          if (distance <= 1) {
            // Close enough - consider at dropoff (accounting for pathfinding rounding)
            serf.path = null;
            serf.pathCount = 0;
            // Will deposit on next cycle (isAtDropoff check will handle it)
          } else {
            // Path completed but not at destination - retry
            // #region agent log
            if (building && building.type === 'mine') {
              fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SerfStateMachine.js:1332',message:'handleDepositing path completed but not at dropoff, retrying',data:{serfId:serf.id,z:serf.z,loc:loc,dropoff:dropoff,distance:distance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            }
            // #endregion
            serf.path = null;
            serf.pathCount = 0;
            if (typeof serf.moveTo === 'function') {
              serf.moveTo(0, dropoff[0], dropoff[1]);
            } else {
              this.setState(serf, STATES.ASSIGNING);
            }
          }
        } else {
          // Has path and still following it - Entity.js will handle movement
          // Check if we're already at dropoff (might have arrived while pathfinding)
          const distance = Math.abs(loc[0] - dropoff[0]) + Math.abs(loc[1] - dropoff[1]);
          if (distance === 0) {
            // Exactly at dropoff - clear path, will deposit on next check
            serf.path = null;
            serf.pathCount = 0;
            // Next cycle will catch isAtDropoff and deposit
          }
          // Otherwise, continue following path (Entity.js handles movement)
        }
      }
    } catch (error) {
      serfLogger.error(`Error in handleDepositing`, error, serf);
      // Clear path on error
      serf.path = null;
      serf.pathCount = 0;
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

    // Don't build during clockout - let handleClockout handle it
    if (serf.action === 'clockout') {
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
      
      // Reset stuck tracking
      serf.stuckCounter = 0;
      serf.lastPos = { x: serf.x, y: serf.y };
      
      // Reset idle time
      serf.idleTime = 0;
      
      // Wait a moment before reassigning to avoid immediate re-stuck
      if (!serf.stuckRecoveryTimer) {
        serf.stuckRecoveryTimer = true;
        const recoveryDelay = 1000; // 1 second
        
        const recoveryCallback = () => {
          if (serf && this.validateSerf(serf)) {
            serf.stuckRecoveryTimer = false;
            // Try to reassign
            this.setState(serf, STATES.ASSIGNING);
          }
        };
        
        if (timerManager) {
          const timerName = `serf-stuck-recovery-${serf.id}`;
          timerManager.setTimeout(timerName, recoveryCallback, recoveryDelay);
        } else {
          setTimeout(recoveryCallback, recoveryDelay);
        }
      }
    } catch (error) {
      serfLogger.error(`Error in handleStuck`, error, serf);
      // Fallback: just go idle
      serf.mode = 'idle';
      serf.action = null;
      serf.stuckCounter = 0;
      serf.stuckRecoveryTimer = false;
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
      // Don't check stuck for serfs who are intentionally stationary
      // (actively building or working at a spot)
      if (serf.building || serf.working) {
        // Reset stuck counter since serf is intentionally stationary
        serf.stuckCounter = 0;
        // Still update lastPos for when they start moving again
        serf.lastPos = { x: serf.x, y: serf.y };
        return;
      }

      if (!serf.lastPos) {
        serf.lastPos = { x: serf.x, y: serf.y };
        serf.stuckCounter = 0;
        return;
      }

      const dist = Math.sqrt(
        Math.pow(serf.x - serf.lastPos.x, 2) + 
        Math.pow(serf.y - serf.lastPos.y, 2)
      );

      // Check if we're trying to reach a spot but not making progress
      const hasDestination = (serf.work && serf.work.spot) || 
                             (serf.path && serf.path.length > 0);
      
      // Track stuck counter for serfs with path but not moving
      if (serf.path && serf.pathCount < serf.path.length && dist < 2) {
        serf.stuckCounter = (serf.stuckCounter || 0) + 1;
      } 
      // Also track stuck for serfs without path but trying to reach a spot
      else if (!serf.path && hasDestination && dist < 2 && serf.mode === 'work') {
        serf.stuckCounter = (serf.stuckCounter || 0) + 1;
      }
      // Track stuck when waiting for work spot assignment too long (only if not actively working)
      else if (serf.serfState === STATES.ASSIGNING && hasDestination && !serf.working) {
        serf.stuckCounter = (serf.stuckCounter || 0) + 1;
      }
      else {
        // Moving or no destination - reset counter
        serf.stuckCounter = 0;
      }

      // Transition to STUCK state if counter exceeds threshold
      if (serf.stuckCounter > 180) { // Stuck for 3 seconds at 60fps
        serfLogger.stuck(serf, serf.stuckCounter);
        this.setState(serf, STATES.STUCK);
        serf.stuckCounter = 0;
      }

      serf.lastPos = { x: serf.x, y: serf.y };
    } catch (error) {
      if (this.debug) {
        console.error(`[SerfStateMachine] Error in checkStuck:`, error);
      }
      // Reset lastPos on error
      serf.lastPos = { x: serf.x, y: serf.y };
      serf.stuckCounter = 0;
    }
  }
}

// Create singleton instance
const serfStateMachine = new SerfStateMachine();

module.exports = serfStateMachine;
module.exports.SerfStateMachine = SerfStateMachine;
module.exports.STATES = STATES;

