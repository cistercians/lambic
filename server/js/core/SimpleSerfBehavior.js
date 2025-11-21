// SimpleSerfBehavior - Ultra-minimal working Serf system
// Just handles basic movement and building exits

class SimpleSerfBehavior {
  constructor() {
    this.debug = false; // Disabled to reduce console spam
  }

  update(serf) {
    // Z-level transitions are now handled automatically by Entity.js intent system
    // Just do basic wandering when idle
    if (serf.mode !== 'work') {
      this.handleWandering(serf);
    }
  }

  handleHouseBuilding(serf) {
    // Male serfs in work mode should build their hut
    const loc = global.getLoc(serf.x, serf.y);
    const BuildingList = global.Building ? global.Building.list : {};
    
    
    // If not on overworld yet, path to exit
    // The intent system will automatically handle transitions when serf reaches exit tiles
    if (serf.z !== 0) {
      if (!serf.path) {
        // Path to overworld - the intent system will handle the actual transition
        serf.moveTo(0, loc[0], loc[1]);
      }
      return;
    }
    
    // Check if serf has a hut assigned
    if (!serf.hut || !BuildingList[serf.hut]) {
      serf.mode = 'idle';
      return;
    }
    
    const hut = BuildingList[serf.hut];
    
    // If hut is already built, switch to idle
    if (hut.built) {
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
      } else {
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
            global.Build(serf.id);
          }
        } else {
          // Tile already built, find a new one
          serf.action = null;
          serf.work.spot = null;
        }
      } else {
        // Not at the spot yet, path to it
        if (!serf.path) {
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
    }
  }
}

module.exports = SimpleSerfBehavior;

