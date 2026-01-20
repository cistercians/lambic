/**
 * MapContextManager - Manages multiple map instances and provides context-aware tile access
 */

const fsSync = require('fs');

class MapContextManager {
  constructor() {
    this.mainWorld = null; // Reference to main world tilemap system
    this.battlegroundMaps = {}; // {matchId: worldData}
    this._loggedLegacyMatches = new Set();
  }

  /**
   * Initialize with main world
   */
  init(mainWorld) {
    this.mainWorld = mainWorld;
  }

  /**
   * Register a battleground map
   * @param {string} matchId - Match ID
   * @param {Array} worldData - World data array
   * @param {number} mapSize - Map size (optional, will be inferred if not provided)
   */
  registerBattlegroundMap(matchId, worldData, mapSize) {
    // Infer mapSize from worldData if not provided
    let inferredMapSize = mapSize;
    if (!inferredMapSize && worldData && worldData[0] && worldData[0].length) {
      inferredMapSize = worldData[0].length;
    }
    
    this.battlegroundMaps[matchId] = {
      type: 'battleground',
      data: worldData,
      mapSize: inferredMapSize || 64
    };
  }

  /**
   * Unregister a battleground map (when match ends)
   */
  unregisterBattlegroundMap(matchId) {
    delete this.battlegroundMaps[matchId];
  }

  /**
   * Resolve entity instance from id or object reference.
   * @param {string|number|Object} entityId - Entity ID or entity object
   * @returns {Object|null} Resolved entity or null
   */
  resolveEntity(entityId) {
    if (!entityId) return null;
    if (typeof entityId === 'object') return entityId;

    if (global.Player && global.Player.list && global.Player.list[entityId]) {
      return global.Player.list[entityId];
    }
    if (global.Item && global.Item.list && global.Item.list[entityId]) {
      return global.Item.list[entityId];
    }
    if (global.Building && global.Building.list && global.Building.list[entityId]) {
      return global.Building.list[entityId];
    }
    if (global.Arrow && global.Arrow.list && global.Arrow.list[entityId]) {
      return global.Arrow.list[entityId];
    }
    if (global.Light && global.Light.list && global.Light.list[entityId]) {
      return global.Light.list[entityId];
    }

    return null;
  }

  /**
   * Get the appropriate map context for an entity
   * @param {string|number|Object} entityId - Entity ID or entity object
   * @returns {object|null} Map context object with {type: 'main'|'battleground', data: worldData, matchId: string}
   */
  getMapContext(entityId) {
    // If no entityId provided, return main world context (for backward compatibility)
    if (!entityId) {
      const mainWorldMapSize = global.mapSize || (this.mainWorld && this.mainWorld.mapSize) || 0;
      return {
        type: 'main',
        data: this.mainWorld,
        matchId: null,
        mapSize: mainWorldMapSize
      };
    }

    const entity = this.resolveEntity(entityId);
    if (!entity) return null;

    // Check if entity is in a battleground
    if (entity.inBattleground && entity.battlegroundMatchId) {
      const matchId = entity.battlegroundMatchId;
      const mapData = this.battlegroundMaps[matchId];
      
      if (mapData) {
        // MapData is now an object with {type, data, mapSize} or legacy array format
        if (mapData.data && mapData.mapSize) {
          // New format
          return {
            type: 'battleground',
            data: mapData.data,
            matchId: matchId,
            mapSize: mapData.mapSize
          };
        } else if (Array.isArray(mapData)) {
          // Legacy format: infer mapSize from array
          if (!this._loggedLegacyMatches.has(matchId)) {
            this._loggedLegacyMatches.add(matchId);
            console.warn(`[MapContextManager] Legacy battleground map format detected for match ${matchId}. Please migrate to {data,mapSize}.`);
          }
          let mapSize = 0;
          if (mapData[0] && mapData[0].length) {
            mapSize = mapData[0].length;
          }
          return {
            type: 'battleground',
            data: mapData,
            matchId: matchId,
            mapSize: mapSize
          };
        }
      }
    }

    // Default to main world
    
    const mainWorldMapSize = global.mapSize || (this.mainWorld && this.mainWorld.mapSize) || 0;
    return {
      type: 'main',
      data: this.mainWorld,
      matchId: null,
      mapSize: mainWorldMapSize
    };
  }

  /**
   * Get map data for a specific match
   */
  getBattlegroundMap(matchId) {
    return this.battlegroundMaps[matchId] || null;
  }

  /**
   * Get tile from appropriate map based on entity context
   * @param {number} layer - Layer index
   * @param {number} x - X coordinate (tile column)
   * @param {number} y - Y coordinate (tile row)
   * @param {string} entityId - Entity ID for context
   * @returns {number|undefined} Tile value
   */
      getTile(layer, x, y, entityId) {
        const context = this.getMapContext(entityId);
        
        if (!context) return undefined;
        
        if (context.type === 'battleground') {
          // Battleground map: worldData is array structure [layer][row][col]
          if (context.data && context.data[layer] && context.data[layer][y] && typeof context.data[layer][y][x] !== 'undefined') {
            return context.data[layer][y][x];
          }
        } else {
          // Main world: use tilemap system
          if (this.mainWorld && typeof this.mainWorld.getTile === 'function') {
            return this.mainWorld.getTile(layer, x, y);
          }
        }
        
        return undefined;
      }

  /**
   * Change tile in appropriate map based on entity context
   * @param {number} layer - Layer index
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} value - New tile value
   * @param {string} entityId - Entity ID for context
   * @returns {boolean} Success
   */
  setTile(layer, x, y, value, entityId) {
    const context = this.getMapContext(entityId);
    
    if (!context) return false;
    
    if (context.type === 'battleground') {
      // Battleground map: direct array modification [layer][row][col]
      if (context.data && context.data[layer] && context.data[layer][y]) {
        context.data[layer][y][x] = value;
        // Emit tile update for battleground participants
        this.emitBattlegroundTileUpdate(context.matchId, layer, x, y, value);
        return true;
      }
    } else {
      // Main world: use tilemap system
      if (this.mainWorld && typeof this.mainWorld.updateTile === 'function') {
        this.mainWorld.updateTile(layer, x, y, value);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Emit tile update to battleground participants
   */
  emitBattlegroundTileUpdate(matchId, layer, x, y, value) {
    if (!global.battlegroundsMatchManager || !global.SOCKET_LIST) return;
    
    const match = global.battlegroundsMatchManager.currentMatch;
    if (!match || match.matchId !== matchId) return;

    const mapData = this.battlegroundMaps[matchId];
    const mapSize = mapData && mapData.mapSize
      ? mapData.mapSize
      : (mapData && mapData.data && mapData.data[0] ? mapData.data[0].length : 0);
    if (mapSize <= 0 || x < 0 || y < 0 || x >= mapSize || y >= mapSize) {
      return;
    }
    
    const participants = match.participants || [];
    participants.forEach(participant => {
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          socket.write(JSON.stringify({
            msg: 'tileEdit',
            l: layer,
            c: x,
            r: y,
            tile: value
          }));
        } catch (e) {
          // Socket might be closed
        }
      }
    });
  }

  /**
   * Get map size for an entity's context
   */
  getMapSize(entityId) {
    const context = this.getMapContext(entityId);
    return context ? context.mapSize : 0;
  }

  /**
   * Get pathfinding grid for an entity's context and z-level
   * @param {number} z - Z-level
   * @param {string} entityId - Entity ID for context
   * @returns {object|null} Pathfinding grid
   */
  getPathfindingGrid(z, entityId) {
    const context = this.getMapContext(entityId);
    
    if (!context) return null;
    
    if (context.type === 'battleground') {
      // Get pathfinding grid from match
      if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch) {
        const match = global.battlegroundsMatchManager.currentMatch;
        if (match.matchId === context.matchId && match.pathfinding && match.pathfinding.grids) {
          return match.pathfinding.grids[z] || null;
        }
      }
    } else {
      // Main world: use global grids (gridO, gridU, etc.)
      // Map z-levels to grid names
      const gridMap = {
        0: global.gridO,
        '-1': global.gridU,
        '1': global.gridB1,
        '2': global.gridB2,
        '-2': global.gridB3,
        '-3': global.gridW,
        '3': global.gridS
      };
      
      const gridKey = String(z);
      return gridMap[gridKey] || null;
    }
    
    return null;
  }

  /**
   * Check if coordinates are valid for an entity's map
   */
  isValidCoordinate(x, y, entityId) {
    const context = this.getMapContext(entityId);
    if (!context) return false;
    
    const mapSize = context.mapSize || 0;
    return x >= 0 && x < mapSize && y >= 0 && y < mapSize;
  }

  /**
   * Get tile coordinates from pixel coordinates based on entity context
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {string} entityId - Entity ID for context
   * @returns {Array|null} [col, row] tile coordinates
   */
  getLoc(x, y, entityId) {
    const context = this.getMapContext(entityId);
    if (!context) {
      // Fallback to global tileSize if no context
      const tileSize = global.tileSize || 64;
      return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
    }
    
    const tileSize = global.tileSize || 64;
    return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
  }

  /**
   * Check if a tile is walkable based on entity context
   * @param {number} z - Z-level
   * @param {number} c - Column (tile X)
   * @param {number} r - Row (tile Y)
   * @param {string} entityId - Entity ID for context
   * @returns {boolean} True if walkable
   */
  isWalkable(z, c, r, entityId) {
    const context = this.getMapContext(entityId);
    if (!context) return false;

    const mapSize = context.mapSize || 0;
    // Bounds check
    if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
      return false;
    }

    if (context.type === 'battleground') {
      // Battleground: use pathfinding matrices (2D arrays) from match, not PF.Grid objects
      if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch) {
        const match = global.battlegroundsMatchManager.currentMatch;
        if (match.matchId === context.matchId && match.pathfinding && match.pathfinding.matrices) {
          const matrix = match.pathfinding.matrices[z];
          if (!matrix || !matrix[r] || typeof matrix[r][c] === 'undefined') return false;
          
          const value = matrix[r][c];
          // 0 = walkable, 1 = blocked, 2 = transition (walkable)
          if (value === 0 || value === 2) {
            // For overworld (z=0), check if it's actually water
            if (z === 0 && value === 2) {
              const tile = this.getTile(0, c, r, entityId);
              if (tile === 0) { // TERRAIN.WATER
                return false;
              }
            }
            return true;
          }
          return false;
        }
      }
      return false;
    } else {
      // Main world: use existing global matrices
      const matrices = {
        0: global.matrixO,
        '-1': global.matrixU,
        '1': global.matrixB1,
        '2': global.matrixB2,
        '-2': global.matrixB3,
        '-3': global.matrixW
      };

      const matrix = matrices[z];
      if (!matrix || !matrix[r] || typeof matrix[r][c] === 'undefined') return false;
      
      const matrixValue = matrix[r][c];
      
      // Water tiles (transition value 2 on overworld) are NOT walkable for basic movement
      if (z === 0 && matrixValue === 2) {
        const tile = this.getTile(0, c, r, entityId);
        if (tile === 0) { // TERRAIN.WATER
          return false;
        }
        // Doors and cave entrances (also value 2) can be walkable
        return true;
      }
      
      // Return true if tile is walkable (0) OR transition tile (2) that's not water
      return matrixValue === 0 || matrixValue === 2;
    }
  }

  /**
   * Find path using context-aware pathfinding
   * @param {Array} startLoc - Start location [col, row]
   * @param {Array} endLoc - End location [col, row]
   * @param {number} layer - Layer/z-level for pathfinding
   * @param {object} options - Pathfinding options
   * @param {string} entityId - Entity ID for context
   * @returns {Array|null} Path array or null
   */
  findPath(startLoc, endLoc, layer, options, entityId) {
    const context = this.getMapContext(entityId);
    
    if (!context) return null;

    if (context.type === 'battleground') {
      // Battleground: map layer to z-level (layer is already z for battlegrounds in most cases)
      // But we need to handle the layer-to-z mapping used in main world pathfinding
      // Layer mapping: 0=z0, 1=z-1, 3=z1, 5=z2, 8=z-2, 2=z-3
      // Also handle direct z-level values (negative numbers) that might be passed as layer
      let z = layer;
      const layerToZMap = {
        0: 0,
        1: -1,
        2: -3,
        3: 1,
        5: 2,
        8: -2
      };
      
      // If layer is already a z-level (negative or > 5), use it directly
      // Otherwise, use the layer-to-z mapping
      if (layer < 0 || layer > 5) {
        // Direct z-level passed as layer (e.g., -1, -2, -3, 2, 3)
        z = layer;
      } else if (layerToZMap.hasOwnProperty(layer)) {
        // Use layer-to-z mapping (e.g., layer 1 -> z -1)
        z = layerToZMap[layer];
      }
      
      // Battleground: get the matrix (2D array) instead of PF.Grid object
      // The grids are stored as PF.Grid objects, but we need the underlying matrix
      if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentMatch) {
        const match = global.battlegroundsMatchManager.currentMatch;
        
        if (match.matchId === context.matchId && match.pathfinding && match.pathfinding.matrices) {
          const matrix = match.pathfinding.matrices[z];
          
          if (!matrix) {
            return null;
          }

          const rows = Array.isArray(matrix) ? matrix.length : 0;
          const cols = rows > 0 && Array.isArray(matrix[0]) ? matrix[0].length : 0;
          if (!rows || !cols) {
            console.warn(`[MapContextManager] Battleground pathfinding matrix missing rows/cols (match=${match.matchId}, z=${z})`);
            return null;
          }
          if (!Array.isArray(startLoc) || !Array.isArray(endLoc)) {
            console.warn(`[MapContextManager] Invalid pathfinding locations (match=${match.matchId}, z=${z})`, {
              startLoc,
              endLoc
            });
            return null;
          }
          const startInBounds = startLoc[0] >= 0 && startLoc[0] < cols && startLoc[1] >= 0 && startLoc[1] < rows;
          const endInBounds = endLoc[0] >= 0 && endLoc[0] < cols && endLoc[1] >= 0 && endLoc[1] < rows;
          if (!startInBounds || !endInBounds) {
            console.warn(`[MapContextManager] Out-of-bounds battleground path request (match=${match.matchId}, z=${z}, rows=${rows}, cols=${cols})`, {
              startLoc,
              endLoc
            });
            return null;
          }

          // Convert battleground matrix format to PF.Grid format
          // Battleground matrices: 0=walkable, 1=blocked, 2=transition (walkable)
          // PF.Grid expects: 0=walkable, 1=blocked
          // So we need to convert 2 (transition) to 0 (walkable)
          const pfGridArray = matrix.map(row => row.map(cell => (cell === 2) ? 0 : cell));

          // Use PF (pathfinding) library to find path
          const PF = require('pathfinding');
          const pfGrid = new PF.Grid(pfGridArray);
          
          // Create finder with appropriate algorithm (A* is default)
          const finder = new PF.AStarFinder({
            allowDiagonal: options?.allowDiagonal !== false,
            dontCrossCorners: options?.dontCrossCorners || false
          });

          try {
            const path = finder.findPath(
              startLoc[0], startLoc[1],
              endLoc[0], endLoc[1],
              pfGrid
            );
            
            // PF returns path in format [[x1,y1], [x2,y2], ...]
            return path && path.length > 0 ? path : null;
          } catch (e) {
            console.error('Pathfinding error:', e);
            return null;
          }
        }
      }
      
      return null;
    } else {
      // Main world: delegate to tilemapSystem for advanced options support
      if (global.tilemapSystem && typeof global.tilemapSystem.findPath === 'function') {
        return global.tilemapSystem.findPath(startLoc, endLoc, layer, options);
      }
      return null;
    }
  }
}

// Create global instance
const mapContextManager = new MapContextManager();

module.exports = {
  MapContextManager,
  mapContextManager
};

