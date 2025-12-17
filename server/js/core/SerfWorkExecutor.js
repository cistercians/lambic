// SerfWorkExecutor - Handles execution of different economic activities
// Separates work logic from state management for better maintainability

const SerfResourceManager = require('./SerfResourceManager');

class SerfWorkExecutor {
  constructor() {
    this.resourceManager = new SerfResourceManager();
  }

  /**
   * Execute work based on building type
   * 
   * @param {Object} serf - The serf entity
   * @param {Object} building - The work building
   * @param {Array} spot - [col, row] work spot
   * @returns {string} - Next action: 'working', 'traveling', 'depositing', 'idle'
   */
  executeWork(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      if (!building.type) {
        return 'idle';
      }

      if (!building.built) {
        return 'idle';
      }

      switch (building.type) {
        case 'mill':
        case 'farm':
          return this.executeFarming(serf, building, spot);
        case 'lumbermill':
          return this.executeLumbering(serf, building, spot);
        case 'mine':
          if (building.cave) {
            return this.executeMining(serf, building, spot);
          } else {
            return this.executeStoneMining(serf, building, spot);
          }
        default:
          return 'idle';
      }
    } catch (error) {
      // Graceful error handling
      return 'idle';
    }
  }

  /**
   * Execute farming work (mill/farm)
   */
  executeFarming(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return 'idle';
      }

      // Check if serf has grain to deposit
      if (serf.inventory.grain >= 1) {
        try {
          const resourceManager = this.resourceManager;
          const dropoff = resourceManager.getDropoffLocation(building);
          
          if (!dropoff || !Array.isArray(dropoff)) {
            return 'idle';
          }

          if (resourceManager.isAtDropoff(serf, building)) {
            serf.facing = 'up';
            resourceManager.depositResource(serf, 'grain', building);
            return 'traveling'; // Return to work spot
          } else {
            // Path to dropoff
            if (!serf.path && typeof serf.moveTo === 'function') {
              serf.moveTo(0, dropoff[0], dropoff[1]);
            }
            return 'depositing';
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Need to work at spot
      if (!spot || !Array.isArray(spot) || spot.length !== 2) {
        return 'idle'; // Need spot assignment
      }

      if (loc.toString() === spot.toString()) {
        // At work spot - execute farming
        if (!serf.workTimer) {
          this.startFarmingWork(serf, building, spot);
        }
        return 'working';
      } else {
        // Path to work spot
        if (!serf.path && typeof serf.moveTo === 'function') {
          serf.moveTo(0, spot[0], spot[1]);
        }
        return 'traveling';
      }
    } catch (error) {
      return 'idle';
    }
  }

  /**
   * Start farming work timer
   */
  startFarmingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot) {
        return;
      }

      serf.working = true;
      serf.farming = true;
      serf.workTimer = true;

      const tile = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
      const hq = building;

      // Add timeout to prevent infinite waits
      const workTimeout = setTimeout(() => {
        if (serf.workTimer) {
          serf.workTimer = false;
          serf.working = false;
          serf.farming = false;
        }
      }, 30000); // 30 second max timeout

      setTimeout(() => {
        try {
          // Clear timeout
          clearTimeout(workTimeout);

          if (!serf.farming) {
            serf.workTimer = false;
            serf.working = false;
            return;
          }

          const b = global.getBuilding ? global.getBuilding(serf.x, serf.y) : null;
          const f = global.Building && global.Building.list ? global.Building.list[b] : null;
          
          if (!f || !f.plot) {
            serf.workTimer = false;
            serf.working = false;
            serf.farming = false;
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
          // All tiles ready - transition to growing
          for (const i in f.plot) {
            const p = f.plot[i];
            global.tileChange(0, p[0], p[1], 9);
          }
        } else {
          const res = global.getTile(6, spot[0], spot[1]);
          if (res >= 5) {
            // Remove from resources
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
          // All tiles ready - transition to harvest
          for (const i in f.plot) {
            const p = f.plot[i];
            global.tileChange(0, p[0], p[1], 10);
            global.tileChange(6, p[0], p[1], 10);
          }
        } else {
          const res = global.getTile(6, spot[0], spot[1]);
          if (res >= 10) {
            // Remove from resources
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
          // Tile depleted - reset to seed
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
            // All tiles are seed - add all to resources
            for (const i in f.plot) {
              const p = f.plot[i];
              if (p.toString() !== spot.toString()) {
                hq.resources.push(p);
              }
            }
          } else {
            // Remove current spot, find next
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

          serf.workTimer = false;
          serf.working = false;
          serf.farming = false;
        } catch (error) {
          // Error in work completion - reset flags
          serf.workTimer = false;
          serf.working = false;
          serf.farming = false;
        }
      }, 10000 / (serf.strength || 1));
    } catch (error) {
      // Error starting work - reset flags
      serf.workTimer = false;
      serf.working = false;
      serf.farming = false;
    }
  }

  /**
   * Execute lumbering work
   */
  executeLumbering(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return 'idle';
      }

      // Check if serf has wood to deposit
      if (serf.inventory.wood >= 1) {
        try {
          const resourceManager = this.resourceManager;
          const dropoff = resourceManager.getDropoffLocation(building);
          
          if (!dropoff || !Array.isArray(dropoff)) {
            return 'idle';
          }

          if (resourceManager.isAtDropoff(serf, building)) {
            serf.facing = 'up';
            resourceManager.depositResource(serf, 'wood', building);
            return 'traveling'; // Return to work spot
          } else {
            // Path to dropoff
            if (!serf.path && typeof serf.moveTo === 'function') {
              serf.moveTo(0, dropoff[0], dropoff[1]);
            }
            return 'depositing';
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Validate spot if at location
      if (spot && Array.isArray(spot) && spot.length === 2 && loc.toString() === spot.toString() && !serf.workTimer) {
        try {
          const gt = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
          if (gt >= 3) {
            // Tree is gone
            const depletedSpot = spot.toString();
            serf.work.spot = null;
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === depletedSpot) {
                  building.resources.splice(i, 1);
                }
              }
            }
            return 'idle'; // Need new spot
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Need to work at spot
      if (!spot || !Array.isArray(spot) || spot.length !== 2) {
        return 'idle'; // Need spot assignment
      }

      if (loc.toString() === spot.toString()) {
        // At work spot - execute chopping
        if (!serf.workTimer) {
          this.startLumberingWork(serf, building, spot);
        }
        return 'working';
      } else {
        // Path to work spot
        if (!serf.path && typeof serf.moveTo === 'function') {
          serf.moveTo(0, spot[0], spot[1]);
        }
        return 'traveling';
      }
    } catch (error) {
      return 'idle';
    }
  }

  /**
   * Start lumbering work timer
   */
  startLumberingWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot) {
        return;
      }

      serf.working = true;
      serf.chopping = true;
      serf.workTimer = true;

      if (!serf.inventory) {
        serf.inventory = {};
      }

      // Add timeout to prevent infinite waits
      const workTimeout = setTimeout(() => {
        if (serf.workTimer) {
          serf.workTimer = false;
          serf.working = false;
          serf.chopping = false;
        }
      }, 30000); // 30 second max timeout

      setTimeout(() => {
        try {
          // Clear timeout
          clearTimeout(workTimeout);

          if (!serf.chopping) {
            serf.workTimer = false;
            serf.working = false;
            return;
          }

          // Validate spot before tile operations
          if (!Array.isArray(spot) || spot.length !== 2) {
            serf.workTimer = false;
            serf.working = false;
            serf.chopping = false;
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
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            serf.action = null;
          } else if (res < 101) {
            const gt = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
            if (gt >= 1 && gt < 2 && typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], 1, true);
            }
          }

          serf.workTimer = false;
          serf.working = false;
          serf.chopping = false;
        } catch (error) {
          // Error in work completion - reset flags
          serf.workTimer = false;
          serf.working = false;
          serf.chopping = false;
        }
      }, 10000 / (serf.strength || 1));
    } catch (error) {
      // Error starting work - reset flags
      serf.workTimer = false;
      serf.working = false;
      serf.chopping = false;
    }
  }

  /**
   * Execute mining work (cave/ore)
   */
  executeMining(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return 'idle';
      }

      // Check if serf has ore to deposit (priority)
      const hasOre = (serf.inventory.ironore >= 1) || 
                     (serf.inventory.silverore >= 1) || 
                     (serf.inventory.goldore >= 1) || 
                     (serf.inventory.diamond >= 1);

      if (hasOre) {
        try {
          // If in cave, exit first
          if (serf.z === -1) {
            if (serf.caveEntrance && Array.isArray(serf.caveEntrance) && serf.caveEntrance.length === 2) {
              if (!serf.path && typeof serf.moveTo === 'function') {
                serf.moveTo(0, serf.caveEntrance[0], serf.caveEntrance[1]);
              }
              return 'depositing';
            }
          } else {
            // On overworld - go to dropoff
            const resourceManager = this.resourceManager;
            const dropoff = resourceManager.getDropoffLocation(building);
            
            if (!dropoff || !Array.isArray(dropoff)) {
              return 'idle';
            }

            if (resourceManager.isAtDropoff(serf, building)) {
              serf.facing = 'up';
              
              // Deposit all ore types
              try {
                if (serf.inventory.ironore >= 1) {
                  resourceManager.depositResource(serf, 'ironore', building);
                }
                if (serf.inventory.silverore >= 1) {
                  resourceManager.depositResource(serf, 'silverore', building, 1);
                }
                if (serf.inventory.goldore >= 1) {
                  resourceManager.depositResource(serf, 'goldore', building, 1);
                }
                if (serf.inventory.diamond >= 1) {
                  resourceManager.depositResource(serf, 'diamond', building, 1);
                }
              } catch (error) {
                // Some deposits may have failed, continue
              }
              
              return 'traveling'; // Return to work spot
            } else {
              if (!serf.path && typeof serf.moveTo === 'function') {
                serf.moveTo(0, dropoff[0], dropoff[1]);
              }
              return 'depositing';
            }
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Need to work at spot
      if (!spot && building.resources && Array.isArray(building.resources) && building.resources.length > 0) {
        try {
          // Assign random spot
          const rand = Math.floor(Math.random() * building.resources.length);
          if (building.resources[rand] && Array.isArray(building.resources[rand])) {
            serf.work.spot = building.resources[rand];
            spot = serf.work.spot;
          }
        } catch (error) {
          return 'idle';
        }
      }

      if (!spot || !Array.isArray(spot) || spot.length !== 2) {
        return 'idle'; // No spots available
      }

      // If not in cave yet, path to cave entrance
      if (serf.z !== -1) {
        if (building.cave && Array.isArray(building.cave) && building.cave.length === 2) {
          try {
            const caveEntrance = building.cave;
            const alreadyAtEntrance = (serf.z === 0 && loc.toString() === caveEntrance.toString());
            
            if (!alreadyAtEntrance) {
              if (!serf.path && typeof serf.moveTo === 'function') {
                serf.moveTo(0, caveEntrance[0], caveEntrance[1]);
              }
            }
          } catch (error) {
            return 'idle';
          }
        }
        return 'traveling';
      }

      // In cave - validate spot
      if (loc.toString() === spot.toString() && !serf.workTimer) {
        try {
          const gt = global.getTile ? global.getTile(1, spot[0], spot[1]) : 0;
          if (gt < 3 || gt > 5) {
            // Rock is gone
            serf.work.spot = null;
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            return 'idle'; // Need new spot
          }
        } catch (error) {
          return 'idle';
        }
      }

      if (loc.toString() === spot.toString()) {
        // At work spot - execute mining
        if (!serf.workTimer) {
          this.startMiningWork(serf, building, spot);
        }
        return 'working';
      } else {
        try {
          // Path to ore rock in cave - use moveTo() which handles cave pathfinding
          const currentLoc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
            Math.floor(serf.x / 64),
            Math.floor(serf.y / 64)
          ];
          
          if (currentLoc && Array.isArray(currentLoc) && currentLoc.length === 2) {
            const currentTile = global.getTile ? global.getTile(1, currentLoc[0], currentLoc[1]) : 0;
            
            // If stuck on wall, teleport to exit
            if (currentTile === 1 && serf.caveEntrance && Array.isArray(serf.caveEntrance)) {
              try {
                const exitCoords = global.getCenter ? global.getCenter(serf.caveEntrance[0], serf.caveEntrance[1] + 1) : null;
                if (exitCoords && Array.isArray(exitCoords)) {
                  serf.x = exitCoords[0];
                  serf.y = exitCoords[1];
                  serf.path = null;
                  serf.pathCount = 0;
                  return 'idle';
                }
              } catch (error) {
                // Teleport failed, continue with pathfinding
              }
            }
          }
          
          // Use moveTo() - it handles cave pathfinding automatically
          if (!serf.path && typeof serf.moveTo === 'function') {
            serf.moveTo(-1, spot[0], spot[1]);
          }
        } catch (error) {
          return 'idle';
        }
        return 'traveling';
      }
    } catch (error) {
      return 'idle';
    }
  }

  /**
   * Start mining work timer
   */
  startMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot) {
        return;
      }

      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      if (!serf.inventory) {
        serf.inventory = {};
      }

      // Add timeout to prevent infinite waits
      const workTimeout = setTimeout(() => {
        if (serf.workTimer) {
          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        }
      }, 30000); // 30 second max timeout

      setTimeout(() => {
        try {
          // Clear timeout
          clearTimeout(workTimeout);

          if (!serf.mining) {
            serf.workTimer = false;
            serf.working = false;
            return;
          }

          // Validate spot before operations
          if (!Array.isArray(spot) || spot.length !== 2) {
            serf.workTimer = false;
            serf.working = false;
            serf.mining = false;
            return;
          }

          // Mine ore - random chance for different ores
          const roll = Math.random();
          try {
            if (roll < 0.001) {
              serf.inventory.diamond = (serf.inventory.diamond || 0) + 1;
              if (global.eventManager && typeof global.eventManager.resourceGathered === 'function') {
                global.eventManager.resourceGathered(serf, 'diamond', 1, { x: serf.x, y: serf.y, z: serf.z });
              }
            } else if (roll < 0.01) {
              serf.inventory.goldore = (serf.inventory.goldore || 0) + 1;
              if (global.eventManager && typeof global.eventManager.resourceGathered === 'function') {
                global.eventManager.resourceGathered(serf, 'gold ore', 1, { x: serf.x, y: serf.y, z: serf.z });
              }
            } else if (roll < 0.1) {
              serf.inventory.silverore = (serf.inventory.silverore || 0) + 1;
              if (global.eventManager && typeof global.eventManager.resourceGathered === 'function') {
                global.eventManager.resourceGathered(serf, 'silver ore', 1, { x: serf.x, y: serf.y, z: serf.z });
              }
            } else if (roll < 0.5) {
              serf.inventory.ironore = (serf.inventory.ironore || 0) + 1;
              if (global.eventManager && typeof global.eventManager.resourceGathered === 'function') {
                global.eventManager.resourceGathered(serf, 'iron ore', 1, { x: serf.x, y: serf.y, z: serf.z });
              }
            }
            // 50% chance to get nothing
          } catch (error) {
            // Event logging failed, continue
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
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            
            // Check adjacent tiles for new rocks
            try {
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
              // Adjacent tile check failed, continue
            }
            
            serf.work.spot = null;
            serf.action = null;
          }

          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        } catch (error) {
          // Error in work completion - reset flags
          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        }
      }, 10000 / (serf.strength || 1));
    } catch (error) {
      // Error starting work - reset flags
      serf.workTimer = false;
      serf.working = false;
      serf.mining = false;
    }
  }

  /**
   * Execute stone mining work
   */
  executeStoneMining(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      if (!serf.inventory) {
        serf.inventory = {};
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return 'idle';
      }

      // Check if serf has stone to deposit
      if (serf.inventory.stone >= 1) {
        try {
          const resourceManager = this.resourceManager;
          const dropoff = resourceManager.getDropoffLocation(building);
          
          if (!dropoff || !Array.isArray(dropoff)) {
            return 'idle';
          }

          if (resourceManager.isAtDropoff(serf, building)) {
            serf.facing = 'up';
            resourceManager.depositResource(serf, 'stone', building);
            return 'traveling'; // Return to work spot
          } else {
            if (!serf.path && typeof serf.moveTo === 'function') {
              serf.moveTo(0, dropoff[0], dropoff[1]);
            }
            return 'depositing';
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Validate spot if at location
      if (spot && Array.isArray(spot) && spot.length === 2 && loc.toString() === spot.toString() && !serf.workTimer) {
        try {
          const gt = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
          if (gt < 4 || gt > 6) {
            // Stone is gone
            const depletedSpot = spot.toString();
            serf.work.spot = null;
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === depletedSpot) {
                  building.resources.splice(i, 1);
                }
              }
            }
            return 'idle'; // Need new spot
          }
        } catch (error) {
          return 'idle';
        }
      }

      // Need to work at spot
      if (!spot || !Array.isArray(spot) || spot.length !== 2) {
        return 'idle'; // Need spot assignment
      }

      if (loc.toString() === spot.toString()) {
        // At work spot - execute stone mining
        if (!serf.workTimer) {
          this.startStoneMiningWork(serf, building, spot);
        }
        return 'working';
      } else {
        // Path to work spot
        if (!serf.path && typeof serf.moveTo === 'function') {
          serf.moveTo(0, spot[0], spot[1]);
        }
        return 'traveling';
      }
    } catch (error) {
      return 'idle';
    }
  }

  /**
   * Start stone mining work timer
   */
  startStoneMiningWork(serf, building, spot) {
    try {
      if (!serf || !building || !spot) {
        return;
      }

      serf.working = true;
      serf.mining = true;
      serf.workTimer = true;

      if (!serf.inventory) {
        serf.inventory = {};
      }

      // Add timeout to prevent infinite waits
      const workTimeout = setTimeout(() => {
        if (serf.workTimer) {
          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        }
      }, 30000); // 30 second max timeout

      setTimeout(() => {
        try {
          // Clear timeout
          clearTimeout(workTimeout);

          if (!serf.mining) {
            serf.workTimer = false;
            serf.working = false;
            return;
          }

          // Validate spot before operations
          if (!Array.isArray(spot) || spot.length !== 2) {
            serf.workTimer = false;
            serf.working = false;
            serf.mining = false;
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
            
            // Remove from resources
            if (building.resources && Array.isArray(building.resources)) {
              for (let i = building.resources.length - 1; i >= 0; i--) {
                const f = building.resources[i];
                if (f && f.toString() === spot.toString()) {
                  building.resources.splice(i, 1);
                }
              }
            }
            serf.action = null;
          } else {
            const tile0 = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
            if (tile0 >= 5 && tile0 < 6 && res <= 50 && typeof global.tileChange === 'function') {
              global.tileChange(0, spot[0], spot[1], -1, true);
            }
          }

          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        } catch (error) {
          // Error in work completion - reset flags
          serf.workTimer = false;
          serf.working = false;
          serf.mining = false;
        }
      }, 10000 / (serf.strength || 1));
    } catch (error) {
      // Error starting work - reset flags
      serf.workTimer = false;
      serf.working = false;
      serf.mining = false;
    }
  }

  /**
   * Execute building work (hut construction)
   */
  executeBuilding(serf, building, spot) {
    try {
      if (!serf || !building) {
        return 'idle';
      }

      const loc = global.getLoc ? global.getLoc(serf.x, serf.y) : [
        Math.floor(serf.x / 64),
        Math.floor(serf.y / 64)
      ];

      if (!loc || !Array.isArray(loc) || loc.length !== 2) {
        return 'idle';
      }

      if (!spot || !Array.isArray(spot) || spot.length !== 2) {
        return 'idle';
      }

      if (loc.toString() === spot.toString()) {
        // At building spot
        try {
          const gt = global.getTile ? global.getTile(0, spot[0], spot[1]) : 0;
          if (gt === 11) {
            // Foundation tile - build it
            if (!serf.building && typeof global.Build === 'function') {
              global.Build(serf.id);
            }
            return 'building';
          } else {
            // Tile already built, find new one
            serf.action = null;
            serf.work.spot = null;
            return 'idle';
          }
        } catch (error) {
          return 'idle';
        }
      } else {
        // Path to building spot
        if (!serf.path && typeof serf.moveTo === 'function') {
          serf.moveTo(0, spot[0], spot[1]);
        }
        return 'traveling';
      }
    } catch (error) {
      return 'idle';
    }
  }
}

module.exports = SerfWorkExecutor;

