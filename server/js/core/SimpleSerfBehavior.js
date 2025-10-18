// SimpleSerfBehavior - Ultra-minimal working Serf system
// Just handles basic movement and building exits

class SimpleSerfBehavior {
  constructor() {
    this.debug = false; // Disabled to reduce console spam
  }

  update(serf) {
    // STEP 1: Handle z-level transitions (getting out of buildings)
    this.handleZLevelTransitions(serf);
    
    // STEP 2: Let the old Entity.js code handle work mode - it has better exit logic
    // Just do basic wandering when idle
    if (serf.mode !== 'work') {
      this.handleWandering(serf);
    }
  }

  handleZLevelTransitions(serf) {
    // DEPRECATED: Z-level transitions are now handled by main Entity.js update logic
    // This function is kept for compatibility but does nothing
    // The universal path-preservation logic in Entity.js handles all z-transitions correctly
    return;
  }

  handleHouseBuilding(serf) {
    // Male serfs in work mode should build their hut
    const loc = global.getLoc(serf.x, serf.y);
    const BuildingList = global.Building ? global.Building.list : {};
    
    console.log('🏗️ ' + serf.name + ' handleHouseBuilding: z=' + serf.z + ', loc=[' + loc[0] + ',' + loc[1] + '], path=' + (serf.path ? 'YES' : 'NO') + ', idleTime=' + serf.idleTime);
    
    // If on second floor (z=2), actively look for stairs
    if (serf.z === 2) {
      // Clear any existing path - we need to find stairs
      if (serf.path) {
        serf.path = null;
        serf.pathCount = 0;
      }
      
      // Check adjacent tiles for stairs every frame
      const stairChecks = [
        [loc[0], loc[1] - 1], // north
        [loc[0], loc[1] + 1], // south
        [loc[0] - 1, loc[1]], // west
        [loc[0] + 1, loc[1]]  // east
      ];
      
      for (const checkLoc of stairChecks) {
        const stairTile = global.getTile(4, checkLoc[0], checkLoc[1]);
        if (stairTile === 3 || stairTile === 4) {
          console.log('🪜 ' + serf.name + ' found stairs at [' + checkLoc[0] + ',' + checkLoc[1] + '], heading down');
          serf.path = [checkLoc]; // Direct path to stairs
          serf.pathCount = 0;
          return;
        }
      }
      
      // No stairs found - just stand still and rely on automatic z-level transitions
      console.log('⏸️  ' + serf.name + ' waiting for stairs (will rely on auto-transitions)');
      return;
    }
    
    // If on first floor (z=1), actively look for door
    if (serf.z === 1) {
      // Clear any existing path - we need to find door
      if (serf.path) {
        serf.path = null;
        serf.pathCount = 0;
      }
      
      // Check north for door every frame
      const doorLoc = [loc[0], loc[1] - 1];
      const doorTile = global.getTile(0, doorLoc[0], doorLoc[1]);
      if (doorTile === 14 || doorTile === 16 || doorTile === 19) {
        console.log('🚪✅ ' + serf.name + ' found door at [' + doorLoc[0] + ',' + doorLoc[1] + '], walking to it');
        serf.path = [doorLoc]; // Direct path to door
        serf.pathCount = 0;
        return;
      }
      
      // No door found - just stand still and rely on automatic z-level transitions
      console.log('⏸️  ' + serf.name + ' waiting for door (will rely on auto-transitions)');
      return;
    }
    
    // If not on overworld yet, wait for transitions
    if (serf.z !== 0) {
      return;
    }
    
    // Check if serf has a hut assigned
    if (!serf.hut || !BuildingList[serf.hut]) {
      console.log(serf.name + ' ERROR: in work mode but no hut assigned, switching to idle');
      serf.mode = 'idle';
      return;
    }
    
    const hut = BuildingList[serf.hut];
    
    // If hut is already built, switch to idle
    if (hut.built) {
      console.log(serf.name + ' hut is complete, switching to idle');
      serf.mode = 'idle';
      serf.action = null;
      return;
    }
    
    // If no action assigned yet, find a foundation tile to build
    if (!serf.action) {
      const buildableTiles = [];
      for (const i in hut.plot) {
        const p = hut.plot[i];
        const t = global.getTile(0, p[0], p[1]);
        if (t === 11) { // Foundation tile
          buildableTiles.push(p);
        }
      }
      
      if (buildableTiles.length > 0) {
        const randomTile = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
        serf.work.spot = randomTile;
        serf.action = 'build';
        console.log(serf.name + ' ASSIGNED to build hut at [' + randomTile[0] + ',' + randomTile[1] + '] (' + buildableTiles.length + ' tiles remaining)');
      } else {
        console.log(serf.name + ' ERROR: hut has no buildable foundation tiles, switching to idle');
        serf.mode = 'idle';
      }
      return;
    }
    
    // If action is 'build', navigate to spot and build
    if (serf.action === 'build' && serf.work.spot) {
      const spot = serf.work.spot;
      const spotLoc = loc.toString();
      const targetLoc = spot.toString();
      
      // Check if we're at the building spot
      if (spotLoc === targetLoc) {
        const gt = global.getTile(0, spot[0], spot[1]);
        if (gt === 11) {
          // Start building if not already building
          if (!serf.building) {
            console.log(serf.name + ' starting to build at [' + spot[0] + ',' + spot[1] + ']');
            global.Build(serf.id);
          }
        } else {
          // Tile already built, find a new one
          console.log(serf.name + ' tile already built, finding new spot');
          serf.action = null;
          serf.work.spot = null;
        }
      } else {
        // Not at the spot yet, path to it
        if (!serf.path) {
          console.log(serf.name + ' pathing to build spot [' + spot[0] + ',' + spot[1] + ']');
          serf.moveTo(0, spot[0], spot[1]);
        }
      }
    }
  }

  handleWandering(serf) {
    // Only wander if on overworld (z=0)
    if (serf.z !== 0) return;
    
    // If no path and idle time is up, pick a random nearby tile
    if (!serf.path && serf.idleTime <= 0) {
      const loc = global.getLoc(serf.x, serf.y);
      const col = loc[0];
      const row = loc[1];
      
      // Pick a random tile within 2-5 tiles radius for more interesting movement
      const range = Math.floor(Math.random() * 3) + 2; // 2-4 tiles away
      const targetCol = col + Math.floor(Math.random() * range * 2) - range;
      const targetRow = row + Math.floor(Math.random() * range * 2) - range;
      
      // Validate target is walkable
      if (targetCol >= 0 && targetCol < global.mapSize && 
          targetRow >= 0 && targetRow < global.mapSize && 
          global.isWalkable(0, targetCol, targetRow)) {
        
        // Use pathfinding to get there
        try {
          const path = global.tilemapSystem.findPath([col, row], [targetCol, targetRow], 0);
          if (path && path.length > 0) {
            serf.path = path;
            serf.pathCount = 0;
            serf.idleTime = Math.floor(Math.random() * 180) + 120; // Wait 2-5 seconds after arriving
          } else {
            // Pathfinding failed, just pick adjacent tile
            const directions = [
              [col, row - 1], [col, row + 1], [col - 1, row], [col + 1, row]
            ];
            const validTargets = directions.filter(([c, r]) => {
              return c >= 0 && c < global.mapSize && 
                     r >= 0 && r < global.mapSize && 
                     global.isWalkable(0, c, r);
            });
            if (validTargets.length > 0) {
              const target = validTargets[Math.floor(Math.random() * validTargets.length)];
              serf.path = [target];
              serf.pathCount = 0;
              serf.idleTime = Math.floor(Math.random() * 120) + 60;
            }
          }
        } catch (error) {
          // Pathfinding error, just stay idle
          serf.idleTime = 60;
        }
      } else {
        // Target not valid, try again soon
        serf.idleTime = 30;
      }
    }
  }

  log(serf, message) {
    if (this.debug) {
      console.log(`[${serf.name}] ${message}`);
    }
  }
}

module.exports = SimpleSerfBehavior;

