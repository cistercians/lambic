/**
 * BattlegroundsPathfindingManager - Generates and manages pathfinding grids for battleground maps
 */

class BattlegroundsPathfindingManager {
  constructor() {
    // PF library should be available globally from lambic.js
    this.PF = null;
  }

  /**
   * Initialize pathfinding library reference
   */
  init() {
    // Get PF library - it's required at the top level in lambic.js, so we need to require it here too
    try {
      this.PF = require('pathfinding');
    } catch (e) {
      // Fallback to global if require fails
      if (typeof global.PF !== 'undefined') {
        this.PF = global.PF;
      } else if (typeof PF !== 'undefined') {
        this.PF = PF;
      } else {
        console.warn('Pathfinding library (PF) not found. Pathfinding for battlegrounds may not work.');
      }
    }
  }

  /**
   * Create pathfinding matrix for a specific z-level
   * @param {number} z - Z-level
   * @param {array} worldData - World data array [layer][row][col]
   * @param {number} mapSize - Map size
   * @returns {array} Pathfinding matrix
   */
  createPathingMatrix(z, worldData, mapSize) {
    const TERRAIN = global.TERRAIN || {
      WATER: 0,
      HEAVY_FOREST: 1,
      LIGHT_FOREST: 2,
      BRUSH: 3,
      ROCKS: 4,
      MOUNTAIN: 5,
      CAVE_ENTRANCE: 6,
      EMPTY: 7,
      DOOR_OPEN: 14,
      DOOR_OPEN_ALT: 16
    };

    // Create 2D array for pathfinding grid
    const grid = [];
    for (let i = 0; i < mapSize; i++) {
      grid[i] = new Array(mapSize).fill(0);
    }
    // Matrix values: 0 = walkable, 1 = blocked, 2 = transition tile

    if (z === 0) {
      // Overworld (layer 0)
      for (let x = 0; x < mapSize; x++) {
        for (let y = 0; y < mapSize; y++) {
          const tile = worldData[0] && worldData[0][y] ? worldData[0][y][x] : 0;
          // Mark transition tiles (water, doors, cave entrances) as 2
          if (tile === TERRAIN.WATER || tile === TERRAIN.DOOR_OPEN || tile === TERRAIN.DOOR_OPEN_ALT || tile === TERRAIN.CAVE_ENTRANCE) {
            grid[y][x] = 2; // Transition tile
          } else {
            grid[y][x] = 0; // Walkable (land tiles, etc.)
          }
        }
      }
    } else if (z === -1) {
      // Underworld/Caves (layer 1)
      for (let x = 0; x < mapSize; x++) {
        for (let y = 0; y < mapSize; y++) {
          const tile = worldData[1] && worldData[1][y] ? worldData[1][y][x] : 1;
          // Matrix: 0 = walkable, 1 = blocked, 2 = transition tile
          // Floor (0), exits (2), and ore (3.x) are walkable (0); walls (1) are blocked (1)
          // Cave exits are transition tiles (value 2)
          if (tile === 1) {
            grid[y][x] = 1; // Blocked (walls)
          } else if (tile === 2) {
            // Check if this is a cave exit - for battlegrounds, we don't have global.caveEntrances
            // So we'll mark all tile 2 as walkable (they're cave floor/exits)
            grid[y][x] = 0; // Walkable
          } else {
            grid[y][x] = 0; // Walkable (floor, ore, etc.)
          }
        }
      }
    } else if (z === 3) {
      // Ship layer - use overworld data
      for (let x = 0; x < mapSize; x++) {
        for (let y = 0; y < mapSize; y++) {
          const tile = worldData[0] && worldData[0][y] ? worldData[0][y][x] : 0;
          grid[y][x] = tile === TERRAIN.WATER ? 0 : 1;
        }
      }
    } else if (z === -3) {
      // Underwater - all walkable
      for (let x = 0; x < mapSize; x++) {
        for (let y = 0; y < mapSize; y++) {
          grid[y][x] = 0; // All walkable underwater
        }
      }
    } else if (z === 1 || z === 2) {
      // Building floors - start with all blocked
      // (These would be handled by matrixChange in the main world, but for battlegrounds
      // we don't expect buildings, so all blocked is fine)
      for (let x = 0; x < mapSize; x++) {
        for (let y = 0; y < mapSize; y++) {
          grid[y][x] = 1; // All blocked initially
        }
      }
    } else if (z === -2) {
      // Cellar - for dungeon maps, this is stored at worldData[9]
      // Check if worldData[9] exists (dungeon cellar layer), otherwise default to all blocked
      const cellarLayer = worldData[9];
      
      // #region agent log
      const fsSync = require('fs');
      const logData = {
        location: 'BattlegroundsPathfindingManager.js:114',
        message: 'Generating pathfinding matrix for z=-2 (cellar)',
        data: {
          z: -2,
          mapSize,
          hasCellarLayer: !!cellarLayer,
          cellarLayerType: cellarLayer?.constructor?.name,
          cellarLayerLength: cellarLayer?.length,
          worldDataLength: worldData?.length,
          worldDataKeys: worldData ? Object.keys(worldData) : []
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'M'
      };
      try {
        fsSync.appendFileSync('/Users/johan/Documents/GitHub/lambic/.cursor/debug.log', JSON.stringify(logData) + '\n');
      } catch (e) {}
      // #endregion
      
      if (cellarLayer) {
        // Use dungeon cellar layer data (same logic as z=-1 caves)
        let walkableCount = 0;
        let blockedCount = 0;
        for (let x = 0; x < mapSize; x++) {
          for (let y = 0; y < mapSize; y++) {
            const tile = cellarLayer[y] ? cellarLayer[y][x] : 1;
            // Matrix: 0 = walkable, 1 = blocked, 2 = transition tile
            // Floor (0), exits (2), and ore (3.x) are walkable (0); walls (1) are blocked (1)
            if (tile === 1) {
              grid[y][x] = 1; // Blocked (walls)
              blockedCount++;
            } else if (tile === 2) {
              grid[y][x] = 0; // Walkable (cave exit)
              walkableCount++;
            } else {
              grid[y][x] = 0; // Walkable (floor, ore, etc.)
              walkableCount++;
            }
          }
        }
        
        // #region agent log
        const logData2 = {
          location: 'BattlegroundsPathfindingManager.js:133',
          message: 'z=-2 matrix generation complete',
          data: {
            z: -2,
            walkableCount,
            blockedCount,
            totalTiles: mapSize * mapSize
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run2',
          hypothesisId: 'M'
        };
        try {
          fsSync.appendFileSync('/Users/johan/Documents/GitHub/lambic/.cursor/debug.log', JSON.stringify(logData2) + '\n');
        } catch (e) {}
        // #endregion
      } else {
        // No cellar layer - start with all blocked (same as building floors)
        for (let x = 0; x < mapSize; x++) {
          for (let y = 0; y < mapSize; y++) {
            grid[y][x] = 1; // All blocked initially
          }
        }
        
        // #region agent log
        const logData3 = {
          location: 'BattlegroundsPathfindingManager.js:140',
          message: 'z=-2 matrix: no cellar layer, all blocked',
          data: {
            z: -2,
            mapSize,
            worldDataLength: worldData?.length,
            worldDataKeys: worldData ? Object.keys(worldData) : []
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run2',
          hypothesisId: 'M'
        };
        try {
          fsSync.appendFileSync('/Users/johan/Documents/GitHub/lambic/.cursor/debug.log', JSON.stringify(logData3) + '\n');
        } catch (e) {}
        // #endregion
      }
    }

    return grid;
  }

  /**
   * Generate pathfinding grids for all z-levels for a battleground map
   * @param {array} worldData - World data array from genesis
   * @param {number} mapSize - Map size
   * @returns {object} Object containing matrices and grids for each z-level
   */
  generatePathfindingGrids(worldData, mapSize) {
    if (!this.PF) {
      console.error('Pathfinding library not initialized. Cannot generate pathfinding grids.');
      return null;
    }

    const grids = {};
    const matrices = {};

    // Generate matrices and grids for each z-level (same as main world)
    const zLevels = [0, -1, 1, 2, -2, -3, 3]; // Overworld, Underworld, Building floors, Cellar, Underwater, Ship

    zLevels.forEach(z => {
      const matrix = this.createPathingMatrix(z, worldData, mapSize);
      matrices[z] = matrix;
      grids[z] = new this.PF.Grid(matrix);
    });

    return {
      matrices: matrices,
      grids: grids
    };
  }

  /**
   * Get pathfinding grid for a specific z-level and match
   * @param {string} matchId - Match ID
   * @param {number} z - Z-level
   * @returns {object|null} Pathfinding grid
   */
  getGrid(matchId, z) {
    if (!global.battlegroundsMatchManager) return null;

    const match = global.battlegroundsMatchManager.currentMatch;
    if (!match || match.matchId !== matchId) return null;

    if (!match.pathfinding || !match.pathfinding.grids) return null;

    return match.pathfinding.grids[z] || null;
  }
}

module.exports = BattlegroundsPathfindingManager;

