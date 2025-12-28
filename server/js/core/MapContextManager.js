/**
 * MapContextManager - Manages multiple map instances and provides context-aware tile access
 */

class MapContextManager {
  constructor() {
    this.mainWorld = null; // Reference to main world tilemap system
    this.battlegroundMaps = {}; // {matchId: worldData}
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
   * Get the appropriate map context for an entity
   * @param {string} entityId - Player/NPC ID
   * @returns {object|null} Map context object with {type: 'main'|'battleground', data: worldData, matchId: string}
   */
  getMapContext(entityId) {
    if (!entityId || !global.Player) return null;

    const entity = global.Player.list[entityId];
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
}

// Create global instance
const mapContextManager = new MapContextManager();

module.exports = {
  MapContextManager,
  mapContextManager
};

