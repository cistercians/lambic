// SimpleSerfBehavior - Simple action-based serf behavior system
// Modeled after military unit pattern: simple action checks, direct pathfinding
// Work buildings are pre-assigned at spawn - no reassignment needed

const timerManager = global.timerManager || null;

class SimpleSerfBehavior {
  constructor() {
    this.BUILDING_SHARE = 0.85; // 85% to building
    this.SERF_WAGE = 0.15; // 15% wage for serf
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

    const dropoff = this.getDropoffLocation(building);
    if (!dropoff) {
      serf.action = null;
      return;
    }

    const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
      Math.floor(serf.x / 64),
      Math.floor(serf.y / 64)
    ];

    if (this.isAtDropoff(serf, building)) {
      // At dropoff - deposit all resources
      serf.facing = 'up';
      this.depositAllResources(serf, building);
      serf.action = null; // Resume work
    } else if (!serf.path || serf.path.length === 0) {
      // Path to dropoff
      if (typeof serf.moveTo === 'function') {
        serf.moveTo(0, dropoff[0], dropoff[1]);
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
              serf.moveTo(0, dropoff[0], dropoff[1]);
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
        return null;
      }

      const availableSpots = [];
      for (const i in building.resources) {
        try {
          const res = building.resources[i];
          if (Array.isArray(res) && res.length === 2) {
            if (building.isSpotAvailable && typeof building.isSpotAvailable === 'function') {
              if (building.isSpotAvailable(res)) {
                availableSpots.push(res);
              }
            } else {
              availableSpots.push(res);
            }
          }
        } catch (error) {
          continue;
        }
      }

      if (availableSpots.length === 0) {
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

      // Check if at work spot
      if (spot && Array.isArray(spot) && spot.length === 2 && loc.toString() === spot.toString()) {
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
        // Path to work spot
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
              // All tiles ready
              for (const i in f.plot) {
                const p = f.plot[i];
                global.tileChange(0, p[0], p[1], 9);
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
              // All tiles ready
              for (const i in f.plot) {
                const p = f.plot[i];
                global.tileChange(0, p[0], p[1], 10);
                global.tileChange(6, p[0], p[1], 10);
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
                for (const i in f.plot) {
                  const p = f.plot[i];
                  if (p.toString() !== spot.toString()) {
                    hq.resources.push(p);
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

      // Common resources (deposit if >= 10, or any amount during clockout)
      const commonResources = ['grain', 'wood', 'stone', 'ironore'];
      for (const resourceType of commonResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount >= 10) {
          if (amount > 0 && this.depositResource(serf, resourceType, building)) {
            anyDeposited = true;
          }
        }
      }

      // Rare ores (deposit if >= 1, or any amount during clockout)
      const rareResources = ['silverore', 'goldore', 'diamond'];
      for (const resourceType of rareResources) {
        const amount = serf.inventory[resourceType] || 0;
        if (isClockout || amount >= 1) {
          if (isClockout) {
            // During clockout, deposit all (one at a time)
            while ((serf.inventory[resourceType] || 0) > 0 && this.depositResource(serf, resourceType, building, 1)) {
              anyDeposited = true;
            }
          } else {
            // Normal deposit (just 1)
            if (amount >= 1 && this.depositResource(serf, resourceType, building, 1)) {
              anyDeposited = true;
            }
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

      // Deposit to building's house
      let deposited = false;
      if (building.house && global.House && global.House.list && global.House.list[building.house]) {
        const house = global.House.list[building.house];
        if (house && house.stores) {
          house.stores[resourceType] = (house.stores[resourceType] || 0) + buildingShare;
          deposited = true;

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

      return serf.z === 0 && loc.toString() === dropoff.toString();
    } catch (error) {
      return false;
    }
  }
}

module.exports = SimpleSerfBehavior;
