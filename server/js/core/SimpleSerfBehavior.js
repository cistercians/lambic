// SimpleSerfBehavior - Simple action-based serf behavior system
// Modeled after military unit pattern: simple action checks, direct pathfinding
// Work buildings are pre-assigned at spawn - no reassignment needed

const timerManager = global.timerManager || null;

class SimpleSerfBehavior {
  constructor() {
    this.BUILDING_SHARE = 0.85; // 85% to building
    this.SERF_WAGE = 0.15; // 15% wage for serf
    this.logThrottle = {}; // Throttle frequent logs: {serfId: {lastLogTime: timestamp, lastState: state}}
    this.LOG_THROTTLE_MS = 5000; // Only log same message every 5 seconds per serf
  }

  /**
   * Main update method - called from Entity.js
   * Simple action-based system like military units
   */
  update(serf) {
    try {
      if (!serf) return;

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

      // Handle actions (like military units)
      if (!serf.action) {
        this.handleDefaultWork(serf);
      } else if (serf.action === 'deposit') {
        this.handleDeposit(serf);
      } else if (serf.action === 'build') {
        this.handleBuild(serf);
      } else if (serf.action === 'clockout') {
        this.handleClockout(serf);
      } else if (serf.action === 'flee') {
        // Use SimpleFlee system for fleeing
        if (global.simpleFlee) {
          global.simpleFlee.update(serf);
        }
      } else if (serf.mode !== 'work') {
        this.handleWandering(serf);
      }
    } catch (error) {
      // Simple error handling - reset to safe state
      if (serf) {
        serf.path = null;
        serf.pathCount = 0;
        serf.action = null;
      }
    }
  }

  /**
   * Handle default work behavior (action === null)
   * Work building is pre-assigned at spawn
   */
  handleDefaultWork(serf) {
    if (serf.mode !== 'work') {
      // Log when serfs are not in work mode (for cave mine debugging, throttled)
      if (serf.work && serf.work.hq && global.Building && global.Building.list) {
        const building = global.Building.list[serf.work.hq];
        if (building && building.type === 'mine' && building.cave) {
          const now = Date.now();
          const throttleKey = `caveMineIdle-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          // Increase throttle time to 30 seconds (6x default) to reduce spam
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 6) {
            const factionName = serf.house && global.House && global.House.list 
              ? (global.House.list[serf.house]?.name || 'Unknown')
              : 'Unknown';
            console.warn(`[SERF WORK] ${factionName}: Cave mine serf not in 'work' mode - mode: ${serf.mode}, work.hq: ${serf.work.hq}, hut: ${serf.hut || 'none'}`);
            this.logThrottle[throttleKey] = now;
          }
        }
      }
      this.handleWandering(serf);
      return;
    }

    // PRIORITY: Check if hut needs building first
    if (serf.hut && global.Building && global.Building.list) {
      const hut = global.Building.list[serf.hut];
      if (hut && !hut.built) {
        serf.action = 'build';
        return; // Let handleBuild() take over
      }
    }

    // Check if work building is valid
    const building = this.getWorkBuilding(serf);
    if (!building || !building.built) {
      // Log why work building is invalid
      const factionName = serf.house && global.House && global.House.list 
        ? (global.House.list[serf.house]?.name || 'Unknown')
        : 'Unknown';
      const hasWorkHq = serf.work && serf.work.hq;
      const buildingId = hasWorkHq ? serf.work.hq : 'none';
      const buildingExists = hasWorkHq && global.Building && global.Building.list && global.Building.list[buildingId];
      const buildingBuilt = buildingExists ? global.Building.list[buildingId].built : false;
      console.warn(`[SERF WORK] ${factionName}: Work building invalid for serf - work.hq: ${buildingId}, building exists: ${buildingExists}, built: ${buildingBuilt}, serf.mode: ${serf.mode}, serf.hut: ${serf.hut || 'none'}`);
      serf.mode = 'idle';
      serf.work.hq = null;
      serf.work.spot = null;
      return;
    }

    // Check if has resources to deposit
    if (this.hasResourcesToDeposit(serf)) {
      serf.action = 'deposit';
      return;
    }

    // Check if needs work spot
    if (!serf.work.spot) {
      const spot = this.assignWorkSpot(serf, building);
      if (!spot) {
        // No spots available - log why (throttled)
        const now = Date.now();
        const throttleKey = `noWorkSpot-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          const factionName = building.owner && global.House && global.House.list 
            ? (global.House.list[building.owner]?.name || 'Unknown')
            : 'Unknown';
          const hasResources = building.resources && Array.isArray(building.resources);
          const resourceCount = hasResources ? building.resources.length : 0;
          console.warn(`[SERF WORK] ${factionName}: No work spot assigned for serf at ${building.type} - building.resources exists: ${hasResources}, count: ${resourceCount}, building.updateResources: ${typeof building.updateResources === 'function'}`);
          this.logThrottle[throttleKey] = now;
        }
        // No spots available - wait
        return;
      }
    } else {
      // Validate work spot is still valid for this building
      // This catches cases where work.spot was set to a hut plot tile during building
      let spotValid = false;
      if (building.resources && Array.isArray(building.resources)) {
        for (const res of building.resources) {
          if (Array.isArray(res) && res.length === 2 && res.toString() === serf.work.spot.toString()) {
            spotValid = true;
            break;
          }
        }
      }
      if (!spotValid) {
        // Work spot is invalid (e.g., was set to hut plot tile) - clear it and reassign
        serf.work.spot = null;
        serf.work.assignedSpot = null;
        serf.path = null;
        serf.pathCount = 0;
        const spot = this.assignWorkSpot(serf, building);
        if (!spot) {
          // No spots available - wait
          return;
        }
      }
    }

    // Execute work based on building type
    this.executeWork(serf, building, serf.work.spot);
  }

  /**
   * Handle deposit action - path to building and deposit resources
   */
  handleDeposit(serf) {
    const building = this.getWorkBuilding(serf);
    if (!building || !building.built) {
      serf.action = null;
      return;
    }

    // Check if still has resources
    if (!this.hasResourcesToDeposit(serf)) {
      serf.action = null;
      return;
    }

    const house = building.owner ? (global.House && global.House.list ? global.House.list[building.owner] : null) : null;
    const houseName = house ? house.name : 'Unknown';
    const resourceTypes = Object.keys(serf.inventory || {}).filter(r => (serf.inventory[r] || 0) > 0);
    const hasStoneOrIronore = resourceTypes.some(r => r === 'stone' || r === 'ironore');

    const dropoff = this.getDropoffLocation(building);
    if (!dropoff) {
      // Log dropoff location failure (not throttled - this is an error)
      console.log(`[SERF DEPOSIT] ${houseName}: Failed to get dropoff location for ${building.type} at [${building.x}, ${building.y}], z=${building.z}`);
      serf.action = null;
      return;
    }

    const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
      Math.floor(serf.x / 64),
      Math.floor(serf.y / 64)
    ];

    const isAtDropoff = this.isAtDropoff(serf, building);
    
    // Throttled logging - only log state changes or every 5 seconds
    const now = Date.now();
    const throttleKey = `deposit-${serf.id}`;
    const lastState = this.logThrottle[throttleKey];
    const stateChanged = !lastState || lastState.isAtDropoff !== isAtDropoff;
    const shouldLog = stateChanged || (now - (lastState?.lastLogTime || 0)) > this.LOG_THROTTLE_MS;
    
    if (hasStoneOrIronore && shouldLog) {
      if (stateChanged && isAtDropoff) {
        // Log when reaching dropoff (state change)
      } else if (!isAtDropoff) {
        // Throttled log when not at dropoff
      }
      this.logThrottle[throttleKey] = { lastLogTime: now, isAtDropoff };
    }

    if (isAtDropoff) {
      // At dropoff - deposit all resources
      // Log serf inventory before deposit attempt (for debugging) - THROTTLED
      if (hasStoneOrIronore) {
        const throttleKeyAttempt = `depositAttempt-${serf.id}-${building.id}`;
        const lastAttemptLog = this.logThrottle[throttleKeyAttempt];
        if (!lastAttemptLog || (now - lastAttemptLog) > this.LOG_THROTTLE_MS * 3) {
          const inventoryBefore = Object.keys(serf.inventory || {}).filter(r => (serf.inventory[r] || 0) > 0)
            .map(r => `${r}:${serf.inventory[r]}`).join(', ');
          this.logThrottle[throttleKeyAttempt] = now;
        }
      }
      
      serf.facing = 'up';
      const deposited = this.depositAllResources(serf, building);
      if (!deposited) {
        // Log deposit failure - THROTTLED (recurring errors should be throttled to avoid spam)
        const throttleKeyFailure = `depositFailure-${serf.id}-${building.id}`;
        const lastFailureLog = this.logThrottle[throttleKeyFailure];
        if (!lastFailureLog || (now - lastFailureLog) > this.LOG_THROTTLE_MS * 3) {
          console.log(`[SERF DEPOSIT] ${houseName}: Failed to deposit resources (${resourceTypes.join(', ')}) to ${building.type} at [${building.x}, ${building.y}], z=${building.z}, serf z=${serf.z}`);
          this.logThrottle[throttleKeyFailure] = now;
        }
      } else if (hasStoneOrIronore) {
        // Log successful deposit - THROTTLED (frequent successes don't need constant logging)
        const throttleKeySuccess = `depositSuccessDebug-${serf.id}-${building.id}`;
        const lastSuccessLog = this.logThrottle[throttleKeySuccess];
        if (!lastSuccessLog || (now - lastSuccessLog) > this.LOG_THROTTLE_MS * 2) {
          const depositedAmounts = resourceTypes.map(r => `${r}:${serf.inventory[r] || 0}`).join(', ');
          this.logThrottle[throttleKeySuccess] = now;
        }
      }
      serf.action = null; // Resume work
    } else if (!serf.path || serf.path.length === 0) {
      // Path to dropoff
      if (typeof serf.moveTo === 'function') {
        // Use building's z-level if available, otherwise default to 0 (overworld)
        // CRITICAL: For cave mines, building is at z=0, so serfs at z=-1 must pathfind to z=0
        const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
        
        // Enhanced logging for cave mine deposits when pathfinding
        if (building.type === 'mine' && building.cave && serf.z !== dropoffZ) {
          const now = Date.now();
          const throttleKey = `caveMinePathfind-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
            this.logThrottle[throttleKey] = now;
          }
        }
        
        serf.moveTo(dropoffZ, dropoff[0], dropoff[1]);
      }
    }
  }

  /**
   * Handle build action - build hut (male serfs only)
   */
  handleBuild(serf) {
    if (!serf.hut || !global.Building || !global.Building.list) {
      serf.action = null;
      serf.mode = 'idle';
      return;
    }

    const hut = global.Building.list[serf.hut];
    if (!hut || hut.built) {
      serf.action = null;
      // CRITICAL FIX: Clear work.spot when hut is built - it was set to hut plot tile during building
      // and is no longer valid as a work spot for the actual work building
      serf.work.spot = null;
      serf.work.assignedSpot = null;
      // Clear path to prevent oscillation
      serf.path = null;
      serf.pathCount = 0;
      if (!serf.work.hq) {
        serf.mode = 'idle';
      }
      return;
    }

    // Find foundation tile if no spot
    if (!serf.work.spot) {
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
        serf.work.spot = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
      } else {
        serf.action = null;
        serf.mode = 'idle';
        return;
      }
    }

    const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
      Math.floor(serf.x / 64),
      Math.floor(serf.y / 64)
    ];

    if (loc && Array.isArray(loc) && loc.length === 2 && loc.toString() === serf.work.spot.toString()) {
      // At building spot
      const gt = global.getTile ? global.getTile(0, serf.work.spot[0], serf.work.spot[1]) : 0;
      if (gt === 11) {
        if (!serf.building && typeof global.Build === 'function') {
          global.Build(serf.id);
        }
      } else {
        // Tile already built, find new one
        serf.work.spot = null;
      }
    } else if (!serf.path || serf.path.length === 0) {
      // Path to building spot
      if (typeof serf.moveTo === 'function') {
        serf.moveTo(0, serf.work.spot[0], serf.work.spot[1]);
      }
    }
  }

  /**
   * Handle clockout action - deposit resources then go home
   */
  handleClockout(serf) {
    // First deposit resources if any
    if (this.hasResourcesToDeposit(serf)) {
      const building = this.getWorkBuilding(serf);
      if (building && building.built) {
        const dropoff = this.getDropoffLocation(building);
        if (dropoff) {
          const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
            Math.floor(serf.x / 64),
            Math.floor(serf.y / 64)
          ];

          if (this.isAtDropoff(serf, building)) {
            serf.facing = 'up';
            this.depositAllResources(serf, building);
            // Continue to go home logic below
          } else if (!serf.path || serf.path.length === 0) {
            if (typeof serf.moveTo === 'function') {
              // Use building's z-level if available, otherwise default to 0 (overworld)
              const dropoffZ = (building && typeof building.z === 'number') ? building.z : 0;
              serf.moveTo(dropoffZ, dropoff[0], dropoff[1]);
            }
            return; // Wait for pathfinding
          } else {
            return; // Still pathfinding
          }
        }
      }
    }

    // No resources or done depositing - go home
    if (serf.home) {
      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (loc && Array.isArray(loc) && loc.length === 2) {
        if (serf.z !== serf.home.z || loc.toString() !== serf.home.loc.toString()) {
          if (!serf.path || serf.path.length === 0) {
            if (typeof serf.moveTo === 'function') {
              // Use serf.home.z to support multi-z pathfinding (e.g., z=1 for building homes)
              serf.moveTo(serf.home.z, serf.home.loc[0], serf.home.loc[1]);
            }
          }
        } else {
          // Arrived home
          serf.action = null;
          serf.mode = 'idle';
        }
      }
    } else {
      // No home - just become idle
      serf.action = null;
      serf.mode = 'idle';
    }
  }

  /**
   * Handle wandering when idle
   */
  handleWandering(serf) {
    if (serf.z !== 0) return;
    if (serf.path || serf.idleTime > 0) return;

    const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
      Math.floor(serf.x / 64),
      Math.floor(serf.y / 64)
    ];

    if (!loc || !Array.isArray(loc) || loc.length !== 2) return;

    // Pick random adjacent tile
    const col = loc[0];
    const row = loc[1];
    const directions = [
      [col, row - 1], // North
      [col, row + 1], // South
      [col - 1, row], // West
      [col + 1, row]  // East
    ];

    const target = directions[Math.floor(Math.random() * directions.length)];
    const mapSize = global.mapSize || 1000;

    if (target[0] >= 0 && target[0] < mapSize &&
        target[1] >= 0 && target[1] < mapSize) {
      const isWalkable = global.isWalkable ? global.isWalkable(0, target[0], target[1]) : true;
      const targetTile = global.getTile ? global.getTile(0, target[0], target[1]) : 0;
      const isWater = (targetTile === 0);
      const isTransitionTile = (targetTile === 6 || targetTile === 14 || targetTile === 16 || targetTile === 19);

      if (isWalkable && !isWater && !isTransitionTile) {
        if (typeof serf.move === 'function') {
          serf.move(target);
          serf.idleTime = Math.floor(Math.random() * (serf.idleRange || 1000));
        }
      } else {
        serf.idleTime = Math.floor(Math.random() * 60) + 30;
      }
    } else {
      serf.idleTime = Math.floor(Math.random() * 60) + 30;
    }
  }

  // ============================================================================
  // WORK SPOT ASSIGNMENT (from SerfWorkManager)
  // ============================================================================

  /**
   * Assign a work spot from building resources
   */
  assignWorkSpot(serf, building) {
    try {
      if (!serf || !building) return null;

      // Release any previously assigned spot
      if (serf.work.assignedSpot && building.releaseSpot && typeof building.releaseSpot === 'function') {
        try {
          building.releaseSpot(serf.id);
        } catch (error) {
          // Release failed, continue
        }
      }
      serf.work.assignedSpot = null;

      // Update building resources
      if (building.updateResources && typeof building.updateResources === 'function') {
        try {
          building.updateResources();
        } catch (error) {
          // Update failed, continue
        }
      }

      // Find available spots
      if (!building.resources || !Array.isArray(building.resources) || building.resources.length === 0) {
        // For mines, try refreshing resources if empty
        if (building.type === 'mine' && typeof building.getRes === 'function') {
          try {
            building.getRes();
            // Check again after refresh
            if (building.resources && Array.isArray(building.resources) && building.resources.length > 0) {
              // Resources found after refresh, continue with assignment
            } else {
              // Still empty after refresh - log for debugging (throttled)
              const now = Date.now();
              const throttleKey = `mineNoResources-${building.id}`;
              const lastLog = this.logThrottle[throttleKey];
              if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
                const factionName = building.owner && global.House && global.House.list 
                  ? (global.House.list[building.owner]?.name || 'Unknown')
                  : 'Unknown';
                console.warn(`[SERF WORK] ${factionName}: Mine at [${building.x}, ${building.y}] has no resources after getRes() - cave: ${building.cave ? 'yes' : 'no'}`);
                this.logThrottle[throttleKey] = now;
              }
              return null;
            }
          } catch (error) {
            console.error(`[SERF WORK] Error calling getRes() for mine:`, error);
            return null;
          }
        } else {
          return null;
        }
      }

      const availableSpots = [];
      const factionName = building.owner && global.House && global.House.list 
        ? (global.House.list[building.owner]?.name || 'Unknown')
        : 'Unknown';
      
      // Removed routine "Processing cave mine resources" log to reduce spam
      // Only log when there are issues (no resources, etc.) - handled below
      
      for (const i in building.resources) {
        try {
          const res = building.resources[i];
          if (Array.isArray(res) && res.length === 2) {
            if (building.isSpotAvailable && typeof building.isSpotAvailable === 'function') {
              const isAvailable = building.isSpotAvailable(res);
              if (isAvailable) {
                availableSpots.push(res);
              } else {
                // Log when spot is filtered out by isSpotAvailable (throttled, building-specific)
                const now = Date.now();
                let throttleKey;
                if (building.type === 'mine' && building.cave) {
                  throttleKey = `caveMineSpotFiltered-${building.id}`;
                } else if (building.type === 'lumbermill') {
                  throttleKey = `lumbermillSpotFiltered-${building.id}`;
                } else if (building.type === 'mill') {
                  throttleKey = `millSpotFiltered-${building.id}`;
                } else {
                  throttleKey = `spotFiltered-${building.type}-${building.id}`;
                }
                
                const lastLog = this.logThrottle[throttleKey];
                if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
                  // Log filtered spot with context
                  const house = building.owner && global.House && global.House.list ? global.House.list[building.owner] : null;
                  const houseName = house ? house.name : 'Unknown';
                  console.log(`[SERF WORK] ${houseName}: ${building.type} spot [${res[0]}, ${res[1]}] filtered out by isSpotAvailable`);
                  
                  // For lumbermills, provide additional context
                  if (building.type === 'lumbermill') {
                    const TERRAIN = global.TERRAIN || {};
                    const getTile = global.getTile || (() => 0);
                    const terrain = getTile(6, res[0], res[1]); // Check resource layer (tree layer)
                    const baseTerrain = getTile(0, res[0], res[1]); // Check base terrain
                    console.log(`[SERF WORK] ${houseName}: Lumbermill spot [${res[0]}, ${res[1]}] - resource terrain: ${terrain}, base terrain: ${baseTerrain}`);
                  }
                  
                  this.logThrottle[throttleKey] = now;
                }
              }
            } else {
              availableSpots.push(res);
            }
          } else {
            // Log invalid resource format (throttled)
            const now = Date.now();
            const throttleKey = `invalidResourceFormat-${building.id}`;
            const lastLog = this.logThrottle[throttleKey];
            if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
              console.warn(`[SERF WORK] ${factionName}: Invalid resource format at index ${i} for ${building.type} - not an array of length 2:`, res);
              if (building.type === 'mine' && building.cave) {
                console.warn(`[SERF WORK] ${factionName}: Cave mine resource at index ${i} has invalid format - type: ${typeof res}, isArray: ${Array.isArray(res)}, length: ${Array.isArray(res) ? res.length : 'N/A'}`);
              }
              this.logThrottle[throttleKey] = now;
            }
          }
        } catch (error) {
          // Log errors (throttled to avoid spam)
          const now = Date.now();
          const throttleKey = `resourceProcessingError-${building.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 3) {
            console.error(`[SERF WORK] ${factionName}: Error processing resource at index ${i} for ${building.type}:`, error);
            this.logThrottle[throttleKey] = now;
          }
          continue;
        }
      }
      
      // Log final available spots count for cave mines (throttled)
      if (building.type === 'mine' && building.cave && availableSpots.length === 0) {
        // Only log when there are no spots (this is a problem)
        const now = Date.now();
        const throttleKey = `caveMineNoSpots-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          console.warn(`[SERF WORK] ${factionName}: Cave mine available spots after processing: ${availableSpots.length} out of ${building.resources.length} resources`);
          this.logThrottle[throttleKey] = now;
        }
      }

      if (availableSpots.length === 0) {
        // Log why no spots available (throttled)
        const factionName = building.owner && global.House && global.House.list 
          ? (global.House.list[building.owner]?.name || 'Unknown')
          : 'Unknown';
        const now = Date.now();
        const throttleKey = `noAvailableSpots-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          const hasIsSpotAvailable = building.isSpotAvailable && typeof building.isSpotAvailable === 'function';
          const totalResources = building.resources ? building.resources.length : 0;
          const filteredOut = totalResources - availableSpots.length;
          
          // Enhanced logging with detailed diagnostics
          let diagnosticMsg = `[SERF WORK] ${factionName}: No available spots for ${building.type} at [${building.x}, ${building.y}]`;
          diagnosticMsg += ` - total resources: ${totalResources}, available: ${availableSpots.length}, filtered: ${filteredOut}`;
          diagnosticMsg += `, isSpotAvailable: ${hasIsSpotAvailable}, cave: ${building.cave ? 'yes' : 'no'}`;
          
          // Add building-specific diagnostics
          if (building.type === 'lumbermill') {
            // Check if building has forest tiles nearby
            const hasForestNearby = this.checkForestNearby(building);
            diagnosticMsg += `, forest nearby: ${hasForestNearby}`;
          } else if (building.type === 'mine') {
            diagnosticMsg += `, mine type: ${building.cave ? 'cave' : 'stone'}`;
          }
          
          console.warn(diagnosticMsg);
          
          // Also log to FactionAI logger if available
          const house = building.owner && global.House && global.House.list ? global.House.list[building.owner] : null;
          if (house && house.ai && house.ai.logger) {
            house.ai.logger.collectInfo(`Work spot assignment failed for ${building.type} at [${building.x}, ${building.y}]: ${totalResources} resources, ${availableSpots.length} available after filtering`);
          }
          
          this.logThrottle[throttleKey] = now;
        }
        return null;
      }

      // Assign random available spot
      const selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
      if (Array.isArray(selected) && selected.length === 2) {
        serf.work.assignedSpot = selected;
        serf.work.spot = selected;

        if (building.assignSpot && typeof building.assignSpot === 'function') {
          building.assignSpot(serf.id, selected);
        }

        return selected;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Release a work spot
   */
  releaseWorkSpot(serf) {
    try {
      if (!serf || !serf.work) return;

      if (serf.work.hq) {
        const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
        if (BuildingList && typeof BuildingList === 'object') {
          const building = BuildingList[serf.work.hq];
          if (building && building.releaseSpot && typeof building.releaseSpot === 'function') {
            try {
              building.releaseSpot(serf.id);
            } catch (error) {
              // Release failed, continue
            }
          }
        }
      }

      serf.work.assignedSpot = null;
      serf.work.spot = null;
    } catch (error) {
      if (serf && serf.work) {
        serf.work.assignedSpot = null;
        serf.work.spot = null;
      }
    }
  }

  /**
   * Get work building for a serf
   */
  getWorkBuilding(serf) {
    try {
      if (!serf || !serf.work || !serf.work.hq) return null;

      const BuildingList = global.Building && global.Building.list ? global.Building.list : {};
      if (!BuildingList || typeof BuildingList !== 'object') return null;

      const building = BuildingList[serf.work.hq];
      return building && typeof building === 'object' ? building : null;
    } catch (error) {
      return null;
    }
  }

  // ============================================================================
  // WORK EXECUTION (from SerfWorkExecutor)
  // ============================================================================

  /**
   * Execute work based on building type
   */
  executeWork(serf, building, spot) {
    try {
      if (!serf || !building || !building.type || !building.built) return;

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) return;

      // Determine expected z-level for work spot
      const expectedZ = (building.type === 'mine' && building.cave) ? -1 : 0;
      const atCorrectZ = serf.z === expectedZ;
      const atCorrectXY = spot && Array.isArray(spot) && spot.length === 2 && loc.toString() === spot.toString();

      // Check if at work spot (both x,y AND z-level must match)
      if (atCorrectXY && atCorrectZ) {
        // At spot - start work based on building type
        switch (building.type) {
          case 'mill':
          case 'farm':
            this.startFarmingWork(serf, building, spot);
            break;
          case 'lumbermill':
            this.startLumberingWork(serf, building, spot);
            break;
          case 'mine':
            if (building.cave) {
              this.startMiningWork(serf, building, spot);
            } else {
              this.startStoneMiningWork(serf, building, spot);
            }
            break;
        }
      } else if (!serf.path || serf.path.length === 0) {
        // Not at spot or wrong z-level - path to work spot
        if (atCorrectXY && !atCorrectZ) {
          // At correct x,y but wrong z-level - log for debugging (heavily throttled)
          const now = Date.now();
          const throttleKey = `wrongZLevel-${serf.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
            const factionName = building.owner && global.House && global.House.list 
              ? (global.House.list[building.owner]?.name || 'Unknown')
              : 'Unknown';
            console.log(`[SERF WORK] ${factionName}: Serf at work spot x,y but wrong z-level (serf.z=${serf.z}, expected=${expectedZ}) - pathfinding to correct z-level`);
            this.logThrottle[throttleKey] = now;
          }
        }
        if (typeof serf.moveTo === 'function') {
          const targetZ = (building.type === 'mine' && building.cave) ? -1 : 0;
          serf.moveTo(targetZ, spot[0], spot[1]);
        }
      }
    } catch (error) {
      // Error in work execution
    }
  }

  /**
   * Clear work timers
   */
  clearWorkTimers(serf) {
    if (!serf) return;

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

    serf.workTimer = false;
    serf.working = false;
    serf.farming = false;
    serf.chopping = false;
    serf.mining = false;
  }

  /**
   * Start farming work
   */
  startFarmingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.farming = true;
      serf.workTimer = true;

      const tile = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
      const hq = building;

      const workCallback = () => {
        try {
          if (!serf || !serf.farming) {
            this.clearWorkTimers(serf);
            return;
          }

          const b = global.getBuilding ? global.getBuilding(serf.x, serf.y) : null;
          const f = global.Building && global.Building.list ? global.Building.list[b] : null;

          if (!f || !f.plot) {
            this.clearWorkTimers(serf);
            return;
          }

          if (tile === 8) {
            // Seed tile - progress to growing
            global.tileChange(6, spot[0], spot[1], 1, true);
            let count = 0;
            const next = [];

            for (const i in f.plot) {
              const p = f.plot[i];
              if (global.getTile(6, p[0], p[1]) >= 5) {
                count++;
              } else {
                next.push(p);
              }
            }

            if (count === 9) {
              // All tiles ready - transition from barren (8) to growing (9)
              for (const i in f.plot) {
                const p = f.plot[i];
                global.tileChange(0, p[0], p[1], 9);
              }
              // Re-add all tiles to work spots (now all are type 9)
              if (hq.updateFarmResources) {
                hq.updateFarmResources();
              }
            } else {
              const res = global.getTile(6, spot[0], spot[1]);
              if (res >= 5) {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
              }
              if (next.length > 0) {
                const rand = Math.floor(Math.random() * next.length);
                serf.work.spot = next[rand];
                if (hq.log) hq.log[serf.id] = serf.work.spot;
              }
            }
          } else if (tile === 9) {
            // Growing tile - progress to ready
            global.tileChange(6, spot[0], spot[1], 1, true);
            let count = 0;

            for (const i in f.plot) {
              const p = f.plot[i];
              if (global.getTile(6, p[0], p[1]) >= 10) {
                count++;
              }
            }

            if (count === 9) {
              // All tiles ready - transition from growing (9) to grain (10)
              for (const i in f.plot) {
                const p = f.plot[i];
                global.tileChange(0, p[0], p[1], 10);
                global.tileChange(6, p[0], p[1], 10);
              }
              // Re-add all tiles to work spots (now all are type 10)
              if (hq.updateFarmResources) {
                hq.updateFarmResources();
              }
            } else {
              const res = global.getTile(6, spot[0], spot[1]);
              if (res >= 10) {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
              }
            }
          } else {
            // Ready tile - harvest grain
            global.tileChange(6, spot[0], spot[1], -1, true);
            serf.inventory.grain = (serf.inventory.grain || 0) + 10;

            if (global.getTile(6, spot[0], spot[1]) === 0) {
              global.tileChange(0, spot[0], spot[1], 8);

              let count = 0;
              const next = [];

              for (const i in f.plot) {
                const p = f.plot[i];
                const t = global.getTile(0, p[0], p[1]);
                if (t === 8) {
                  count++;
                } else {
                  next.push(p);
                }
              }

              if (count === 9) {
                // All tiles depleted - transition from grain (10) to barren (8)
                // Re-add all tiles to work spots (now all are type 8)
                if (hq.updateFarmResources) {
                  hq.updateFarmResources();
                } else {
                  // Fallback: manually add all tiles (excluding current spot)
                  for (const i in f.plot) {
                    const p = f.plot[i];
                    if (p.toString() !== spot.toString()) {
                      hq.resources.push(p);
                    }
                  }
                }
              } else {
                for (let n = hq.resources.length - 1; n >= 0; n--) {
                  const r = hq.resources[n];
                  if (r && r.toString() === spot.toString()) {
                    hq.resources.splice(n, 1);
                  }
                }
                if (next.length > 0) {
                  const rand = Math.floor(Math.random() * next.length);
                  serf.work.spot = next[rand];
                  if (hq.log) hq.log[serf.id] = serf.work.spot;
                }
              }
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start lumbering work
   */
  startLumberingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.chopping = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.chopping) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Chop wood
          if (typeof global.tileChange === 'function') {
            global.tileChange(6, spot[0], spot[1], -1, true);
          }
          serf.inventory.wood = (serf.inventory.wood || 0) + 10;

          const res = global.getTile ? global.getTile(6, spot[0], spot[1]) : 0;
          if (res <= 0) {
            // Tree depleted
            if (typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], 1, true);
            }

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            serf.work.spot = null;
          } else if (res < 101) {
            const gt = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
            if (gt >= 1 && gt < 2 && typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], 1, true);
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start mining work (cave/ore)
   */
  startMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.mining) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Mine ore - random chance
          const roll = Math.random();
          if (roll < 0.001) {
            serf.inventory.diamond = (serf.inventory.diamond || 0) + 1;
          } else if (roll < 0.01) {
            serf.inventory.goldore = (serf.inventory.goldore || 0) + 1;
          } else if (roll < 0.1) {
            serf.inventory.silverore = (serf.inventory.silverore || 0) + 1;
          } else if (roll < 0.5) {
            serf.inventory.ironore = (serf.inventory.ironore || 0) + 1;
          }

          // Deplete resource
          if (typeof global.tileChange === 'function') {
            global.tileChange(7, spot[0], spot[1], -1, true);
          }
          const res = global.getTile ? global.getTile(7, spot[0], spot[1]) : 0;

          if (res <= 0) {
            // Rock depleted
            if (typeof global.tileChange === 'function') {
              global.tileChange(1, spot[0], spot[1], 1);
            }

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }

            // Discover adjacent rocks
            this.discoverAdjacentRocks(spot, building);
            serf.work.spot = null;
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Start stone mining work
   */
  startStoneMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot || serf.workTimer) return;

      this.clearWorkTimers(serf);
      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      const workCallback = () => {
        try {
          if (!serf || !serf.mining) {
            this.clearWorkTimers(serf);
            return;
          }

          if (!Array.isArray(spot) || spot.length !== 2) {
            this.clearWorkTimers(serf);
            return;
          }

          // Mine stone
          if (typeof global.tileChange === 'function') {
            global.tileChange(6, spot[0], spot[1], -1, true);
          }
          serf.inventory.stone = (serf.inventory.stone || 0) + 10;

          const res = global.getTile ? global.getTile(6, spot[0], spot[1]) : 0;
          if (res <= 0) {
            // Stone depleted
            if (typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], 7);
            }

            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
          } else {
            const tile0 = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
            if (tile0 >= 5 && tile0 < 6 && res <= 50 && typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], -1, true);
            }
          }

          this.clearWorkTimers(serf);
        } catch (error) {
          this.clearWorkTimers(serf);
        }
      };

      const workDelay = 10000 / (serf.strength || 1);
      if (timerManager) {
        const workTimerName = `serf-work-${serf.id}-${Date.now()}`;
        serf.workTimerId = workTimerName;
        timerManager.setTimeout(workTimerName, workCallback, workDelay);
      } else {
        serf.workTimerId = setTimeout(workCallback, workDelay);
      }
    } catch (error) {
      this.clearWorkTimers(serf);
    }
  }

  /**
   * Discover adjacent rocks when a rock is depleted
   */
  discoverAdjacentRocks(spot, building) {
    try {
      if (!spot || !Array.isArray(spot) || spot.length !== 2 || !building) return;

      const adj = [
        [spot[0] - 1, spot[1]],
        [spot[0], spot[1] - 1],
        [spot[0] + 1, spot[1]],
        [spot[0], spot[1] + 1]
      ];
      const newRocks = [];

      for (const t of adj) {
        if (Array.isArray(t) && t.length === 2) {
          const gt = global.getTile ? global.getTile(1, t[0], t[1]) : 0;
          if (gt === 1) {
            newRocks.push(t);
          }
        }
      }

      if (newRocks.length > 0 && typeof global.tileChange === 'function' && typeof global.matrixChange === 'function') {
        for (const r of newRocks) {
          if (Array.isArray(r) && r.length === 2) {
            const num = 3 + Number((Math.random() * 0.9).toFixed(2));
            global.tileChange(1, r[0], r[1], num);
            global.matrixChange(1, r[0], r[1], 0);
            if (building.resources && Array.isArray(building.resources)) {
              building.resources.push(r);
            }
          }
        }
      }
    } catch (error) {
      // Discovery failed, continue
    }
  }

  // ============================================================================
  // RESOURCE MANAGEMENT (from SerfResourceManager)
  // ============================================================================

  /**
   * Check if serf has resources to deposit
   */
  hasResourcesToDeposit(serf) {
    try {
      if (!serf || !serf.inventory) return false;

      return ((serf.inventory.wood || 0) >= 10) ||
             ((serf.inventory.stone || 0) >= 10) ||
             ((serf.inventory.ironore || 0) >= 10) ||
             ((serf.inventory.grain || 0) >= 10) ||
             ((serf.inventory.silverore || 0) >= 1) ||
             ((serf.inventory.goldore || 0) >= 1) ||
             ((serf.inventory.diamond || 0) >= 1);
    } catch (error) {
      return false;
    }
  }

  /**
   * Deposit all resources to building
   */
  depositAllResources(serf, building) {
    try {
      if (!serf || !building) return false;

      const isClockout = serf.action === 'clockout';
      let anyDeposited = false;

      // Common resources (deposit all when triggered, or any amount during clockout)
      const commonResources = ['grain', 'wood', 'stone', 'ironore'];
      for (const resourceType of commonResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount > 0) {
          if (amount > 0 && this.depositResource(serf, resourceType, building)) {
            anyDeposited = true;
          }
        }
      }

      // Rare ores (deposit all when triggered, or any amount during clockout)
      const rareResources = ['silverore', 'goldore', 'diamond'];
      for (const resourceType of rareResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount > 0) {
          // Deposit all rare resources (one at a time)
          while ((serf.inventory[resourceType] || 0) > 0 && this.depositResource(serf, resourceType, building, 1)) {
            anyDeposited = true;
          }
        }
      }

      return anyDeposited;
    } catch (error) {
      return false;
    }
  }

  /**
   * Deposit a resource to a building
   */
  depositResource(serf, resourceType, building, amount = null) {
    try {
      if (!serf || !building || !resourceType) return false;

      const singleItemResources = ['silverore', 'goldore', 'diamond'];
      const isSingleItem = singleItemResources.includes(resourceType);

      if (amount === null) {
        amount = serf.inventory[resourceType] || 0;
      }

      if (typeof amount !== 'number' || amount <= 0 || !isFinite(amount)) {
        return false;
      }

      if (isSingleItem && amount > 1) {
        amount = 1;
      }

      // Calculate shares
      let buildingShare, serfWage;
      if (isSingleItem) {
        buildingShare = amount;
        serfWage = 0;
      } else {
        buildingShare = Math.floor(amount * this.BUILDING_SHARE);
        if (amount >= 1 && buildingShare === 0) {
          buildingShare = 1;
        }
        serfWage = amount - buildingShare;
      }

      // Enhanced logging for stone/ironore deposits (throttled)
      const isStoneOrIronore = resourceType === 'stone' || resourceType === 'ironore';
      const house = building.house && global.House && global.House.list ? global.House.list[building.house] : null;
      const houseName = house ? house.name : 'Unknown';
      
      // Diagnostic logging for stone deposits at cave-classified mines
      if (resourceType === 'stone' && building.type === 'mine' && building.cave) {
        const now = Date.now();
        const throttleKey = `stoneDepositCaveMine-${building.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
          console.log(`[MINE DEPOSIT DIAGNOSTIC] ${houseName}: Attempting stone deposit at cave-classified mine [${Math.floor(building.x)}, ${Math.floor(building.y)}] - amount: ${amount}, building.cave: yes`);
          this.logThrottle[throttleKey] = now;
        }
      }
      
      // Only log depositResource calls occasionally (throttled)
      if (isStoneOrIronore) {
        const now = Date.now();
        const throttleKey = `depositResource-${building.id}-${resourceType}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS) {
          // Only log occasionally, not every call
          this.logThrottle[throttleKey] = now;
        }
      }

      // Deposit to building's house
      let deposited = false;
      if (building.house && global.House && global.House.list && global.House.list[building.house]) {
        const house = global.House.list[building.house];
        if (house && house.stores) {
          const beforeAmount = house.stores[resourceType] || 0;
          house.stores[resourceType] = beforeAmount + buildingShare;
          deposited = true;
          
          // Only log actual deposits occasionally (throttled, but successful deposits are important)
          if (isStoneOrIronore && buildingShare > 0) {
            const now = Date.now();
            const throttleKey = `depositSuccess-${building.id}-${resourceType}`;
            const lastLog = this.logThrottle[throttleKey];
            if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS) {
              this.logThrottle[throttleKey] = now;
            }
          }

          // Create deposit event
          if (global.eventManager && typeof global.eventManager.createEvent === 'function' && buildingShare > 0) {
            try {
              global.eventManager.createEvent({
                category: global.eventManager.categories?.ECONOMIC,
                subject: serf.id,
                subjectName: serf.name || serf.class,
                action: `deposited ${resourceType}`,
                target: building.house,
                targetName: house.name,
                quantity: buildingShare,
                communication: global.eventManager.commModes?.NONE,
                log: `[ECONOMIC] ${serf.name || serf.class} deposited ${buildingShare} ${resourceType} to ${house.name}`,
                position: { x: serf.x, y: serf.y, z: serf.z }
              });
            } catch (error) {
              // Event creation failed, but deposit succeeded
            }
          }
        }
      }

      if (deposited) {
        // Clear inventory
        serf.inventory[resourceType] = Math.max(0, (serf.inventory[resourceType] || 0) - amount);

        // Give serf wage
        if (serfWage > 0) {
          serf.stores[resourceType] = (serf.stores[resourceType] || 0) + serfWage;
        }

        // Track daily deposits
        if (building) {
          if (!building.dailyStores) {
            building.dailyStores = {};
          }
          building.dailyStores[resourceType] = (building.dailyStores[resourceType] || 0) + buildingShare;
        }

        // Grain -> flour conversion (mills only)
        if (resourceType === 'grain' && building.type === 'mill' && serf.inventory) {
          try {
            serf.inventory.flour = (serf.inventory.flour || 0) + Math.floor(buildingShare / 3);
          } catch (error) {
            // Conversion failed, but deposit succeeded
          }
        }
      }

      return deposited;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get dropoff location for a building
   */
  getDropoffLocation(building) {
    try {
      if (!building || !building.plot || !Array.isArray(building.plot) || building.plot.length === 0) {
        return null;
      }

      const firstPlot = building.plot[0];
      if (!Array.isArray(firstPlot) || firstPlot.length !== 2) {
        return null;
      }

      const col = firstPlot[0];
      const row = firstPlot[1];

      if (typeof col !== 'number' || typeof row !== 'number' || !isFinite(col) || !isFinite(row)) {
        return null;
      }

      return [col, row + 1];
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if serf is at dropoff location
   */
  isAtDropoff(serf, building) {
    try {
      if (!serf || !building) return false;

      const dropoff = this.getDropoffLocation(building);
      if (!dropoff || !Array.isArray(dropoff) || dropoff.length !== 2) {
        return false;
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return false;
      }

      // Check if serf is at the building's z-level (not hardcoded to 0)
      // This fixes stone mine deposits - serfs must be at building.z, not necessarily z=0
      const buildingZ = (building && typeof building.z === 'number') ? building.z : 0;
      const atCorrectZ = serf.z === buildingZ;
      const atCorrectXY = loc.toString() === dropoff.toString();
      
      // Enhanced logging for cave mines when not at dropoff
      if (building.type === 'mine' && building.cave && !atCorrectZ) {
        const house = building.owner && global.House && global.House.list 
          ? global.House.list[building.owner] : null;
        const houseName = house ? house.name : 'Unknown';
        const now = Date.now();
        const throttleKey = `isAtDropoffZ-${serf.id}`;
        const lastLog = this.logThrottle[throttleKey];
        if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 2) {
          this.logThrottle[throttleKey] = now;
        }
      }
      
      // Diagnostic logging for stone deposits at cave-classified mines
      // This helps detect if stone deposits are failing due to misclassification
      if (building.type === 'mine' && building.cave && atCorrectZ && atCorrectXY) {
        const house = building.owner && global.House && global.House.list 
          ? global.House.list[building.owner] : null;
        const houseName = house ? house.name : 'Unknown';
        const serfHasStone = serf.inventory && serf.inventory.stone && serf.inventory.stone > 0;
        if (serfHasStone) {
          const now = Date.now();
          const throttleKey = `stoneDepositAtCaveMine-${building.id}`;
          const lastLog = this.logThrottle[throttleKey];
          if (!lastLog || (now - lastLog) > this.LOG_THROTTLE_MS * 5) {
            console.log(`[MINE DEPOSIT DIAGNOSTIC] ${houseName}: Stone deposit attempt at cave-classified mine [${Math.floor(building.x)}, ${Math.floor(building.y)}] - serf has stone: ${serf.inventory.stone}, building.cave: ${building.cave ? 'yes' : 'no'}`);
            this.logThrottle[throttleKey] = now;
          }
        }
      }
      
      return atCorrectZ && atCorrectXY;
    } catch (error) {
      return false;
    }
  }
}

module.exports = SimpleSerfBehavior;
