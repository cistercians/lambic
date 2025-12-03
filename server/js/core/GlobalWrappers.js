/**
 * GlobalWrappers - Wrapper modules for common global access patterns
 * 
 * Provides clean interfaces to access commonly used globals.
 * This helps transition away from direct global.* access while maintaining
 * backward compatibility.
 * 
 * Usage:
 *   const { getPlayers, getBuildings } = require('./GlobalWrappers');
 *   const players = getPlayers();
 */

const entityRegistry = require('./EntityRegistry');
const systemRegistry = require('./SystemRegistry');

/**
 * Get all players
 * @returns {Array} Array of player entities
 */
function getPlayers() {
  return entityRegistry.getEntities('players');
}

/**
 * Get all buildings
 * @returns {Array} Array of building entities
 */
function getBuildings() {
  return entityRegistry.getEntities('buildings');
}

/**
 * Get all items
 * @returns {Array} Array of item entities
 */
function getItems() {
  return entityRegistry.getEntities('items');
}

/**
 * Get a player by ID
 * @param {string|number} id - Player ID
 * @returns {object|null} Player entity or null
 */
function getPlayer(id) {
  return entityRegistry.getEntity('players', id);
}

/**
 * Get a building by ID
 * @param {string|number} id - Building ID
 * @returns {object|null} Building entity or null
 */
function getBuilding(id) {
  return entityRegistry.getEntity('buildings', id);
}

/**
 * Get an item by ID
 * @param {string|number} id - Item ID
 * @returns {object|null} Item entity or null
 */
function getItem(id) {
  return entityRegistry.getEntity('items', id);
}

/**
 * Get tilemap system
 * @returns {object|null} Tilemap system
 */
function getTilemapSystem() {
  return systemRegistry.get('tilemap') || global.tilemapSystem;
}

/**
 * Get game state
 * @returns {object|null} Game state
 */
function getGameState() {
  return systemRegistry.get('gameState') || global.gameState;
}

/**
 * Get combat system
 * @returns {object|null} Combat system
 */
function getCombatSystem() {
  return systemRegistry.get('combat') || global.simpleCombat;
}

/**
 * Get pathfinding system
 * @returns {object|null} Pathfinding system
 */
function getPathfindingSystem() {
  const tilemap = getTilemapSystem();
  return tilemap && tilemap.pathfindingSystem ? tilemap.pathfindingSystem : null;
}

/**
 * Get socket list (for backward compatibility)
 * @returns {object} Socket list object
 */
function getSocketList() {
  return global.SOCKET_LIST || {};
}

/**
 * Get socket for a player
 * @param {string|number} playerId - Player ID
 * @returns {object|null} Socket or null
 */
function getSocket(playerId) {
  const socketList = getSocketList();
  return socketList[playerId] || null;
}

/**
 * Send message to a player
 * @param {string|number} playerId - Player ID
 * @param {object} data - Message data
 * @returns {boolean} Success
 */
function sendToPlayer(playerId, data) {
  const socket = getSocket(playerId);
  if (socket && typeof socket.write === 'function') {
    try {
      socket.write(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[GlobalWrappers] Error sending to player ${playerId}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Broadcast message to all players
 * @param {object} data - Message data
 * @returns {number} Number of players notified
 */
function broadcastToAll(data) {
  const socketList = getSocketList();
  let count = 0;
  
  for (const playerId in socketList) {
    if (sendToPlayer(playerId, data)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Broadcast message to players in area
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} z - Z level
 * @param {number} radius - Radius in pixels
 * @param {object} data - Message data
 * @returns {number} Number of players notified
 */
function broadcastToArea(x, y, z, radius, data) {
  const players = getPlayers();
  let count = 0;
  const radiusSquared = radius * radius;
  
  for (const player of players) {
    if (player.z !== z) continue;
    
    const dx = player.x - x;
    const dy = player.y - y;
    const distanceSquared = dx * dx + dy * dy;
    
    if (distanceSquared <= radiusSquared) {
      if (sendToPlayer(player.id, data)) {
        count++;
      }
    }
  }
  
  return count;
}

// ============================================================================
// MAP/TILE UTILITY WRAPPERS
// These wrap the most commonly used global functions for consistency
// ============================================================================

/**
 * Convert pixel coordinates to tile coordinates
 * @param {number} x - Pixel X coordinate
 * @param {number} y - Pixel Y coordinate
 * @returns {number[]} [col, row] tile coordinates
 */
function getLoc(x, y) {
  const tileSize = global.tileSize || 64;
  return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
}

/**
 * Get center pixel coordinates of a tile
 * @param {number} col - Tile column
 * @param {number} row - Tile row
 * @returns {number[]} [x, y] pixel coordinates at tile center
 */
function getCenter(col, row) {
  const tileSize = global.tileSize || 64;
  return [(col * tileSize) + (tileSize / 2), (row * tileSize) + (tileSize / 2)];
}

/**
 * Get tile value at position
 * @param {number} z - Z-level/layer
 * @param {number} col - Tile column
 * @param {number} row - Tile row
 * @returns {number} Tile value
 */
function getTile(z, col, row) {
  const tilemap = getTilemapSystem();
  if (tilemap && typeof tilemap.getTile === 'function') {
    return tilemap.getTile(z, col, row);
  }
  // Fallback to world array
  const world = global.world;
  if (world && world[z] && world[z][row]) {
    return world[z][row][col] || 0;
  }
  return 0;
}

/**
 * Check if a tile is walkable
 * @param {number} z - Z-level/layer
 * @param {number} col - Tile column
 * @param {number} row - Tile row
 * @returns {boolean} True if walkable
 */
function isWalkable(z, col, row) {
  const tilemap = getTilemapSystem();
  if (tilemap && typeof tilemap.isWalkable === 'function') {
    return tilemap.isWalkable(z, col, row);
  }
  // Fallback - check for non-blocking tiles
  const tile = getTile(z, col, row);
  const TERRAIN = global.TERRAIN || {};
  return tile !== TERRAIN.WATER && tile !== TERRAIN.MOUNTAIN && tile !== TERRAIN.CAVE_ENTRANCE;
}

/**
 * Get building at pixel position
 * @param {number} x - Pixel X coordinate
 * @param {number} y - Pixel Y coordinate  
 * @returns {string|null} Building ID or null
 */
function getBuildingAtPos(x, y) {
  const loc = getLoc(x, y);
  const buildings = getBuildings();
  
  for (const building of buildings) {
    if (!building.plot) continue;
    for (const plot of building.plot) {
      if (plot[0] === loc[0] && plot[1] === loc[1]) {
        return building.id;
      }
    }
  }
  return null;
}

/**
 * Calculate distance between two points
 * @param {object} pt1 - First point {x, y}
 * @param {object} pt2 - Second point {x, y}
 * @returns {number} Distance in pixels
 */
function getDistance(pt1, pt2) {
  const dx = pt2.x - pt1.x;
  const dy = pt2.y - pt1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Get map size
 * @returns {number} Map size in tiles
 */
function getMapSize() {
  const gameState = getGameState();
  return (gameState && gameState.mapSize) || global.mapSize || 192;
}

/**
 * Get tile size
 * @returns {number} Tile size in pixels
 */
function getTileSize() {
  return global.tileSize || 64;
}

// ============================================================================
// ENTITY LIST ACCESSORS (for gradual migration from .list[] pattern)
// ============================================================================

/**
 * Get Player list (backward compatible)
 * @returns {object} Player.list object
 */
function getPlayerList() {
  return global.Player?.list || {};
}

/**
 * Get Building list (backward compatible)
 * @returns {object} Building.list object
 */
function getBuildingList() {
  return global.Building?.list || {};
}

/**
 * Get Item list (backward compatible)
 * @returns {object} Item.list object
 */
function getItemList() {
  return global.Item?.list || {};
}

/**
 * Get House list (backward compatible)
 * @returns {object} House.list object
 */
function getHouseList() {
  return global.House?.list || {};
}

/**
 * Iterate over entities safely (handles undefined lists)
 * @param {string} type - Entity type ('players', 'buildings', 'items', 'houses')
 * @param {Function} callback - Callback function (entity, id)
 */
function forEachEntity(type, callback) {
  const listMap = {
    'players': global.Player?.list,
    'buildings': global.Building?.list,
    'items': global.Item?.list,
    'houses': global.House?.list,
    'arrows': global.Arrow?.list,
    'lights': global.Light?.list
  };
  
  const list = listMap[type];
  if (!list) return;
  
  for (const id in list) {
    if (list.hasOwnProperty(id)) {
      callback(list[id], id);
    }
  }
}

/**
 * Filter entities by predicate
 * @param {string} type - Entity type
 * @param {Function} predicate - Filter function (entity) => boolean
 * @returns {Array} Filtered entities
 */
function filterEntities(type, predicate) {
  const results = [];
  forEachEntity(type, (entity) => {
    if (predicate(entity)) {
      results.push(entity);
    }
  });
  return results;
}

/**
 * Find first entity matching predicate
 * @param {string} type - Entity type
 * @param {Function} predicate - Match function (entity) => boolean
 * @returns {object|null} First matching entity or null
 */
function findEntity(type, predicate) {
  const listMap = {
    'players': global.Player?.list,
    'buildings': global.Building?.list,
    'items': global.Item?.list,
    'houses': global.House?.list
  };
  
  const list = listMap[type];
  if (!list) return null;
  
  for (const id in list) {
    if (list.hasOwnProperty(id) && predicate(list[id])) {
      return list[id];
    }
  }
  return null;
}

/**
 * Count entities matching predicate
 * @param {string} type - Entity type
 * @param {Function} predicate - Optional filter function
 * @returns {number} Count
 */
function countEntities(type, predicate = null) {
  let count = 0;
  forEachEntity(type, (entity) => {
    if (!predicate || predicate(entity)) {
      count++;
    }
  });
  return count;
}

module.exports = {
  // Entity access (via EntityRegistry)
  getPlayers,
  getBuildings,
  getItems,
  getPlayer,
  getBuilding,
  getItem,
  
  // Entity list accessors (backward compatible)
  getPlayerList,
  getBuildingList,
  getItemList,
  getHouseList,
  
  // Entity iteration helpers
  forEachEntity,
  filterEntities,
  findEntity,
  countEntities,
  
  // System access
  getTilemapSystem,
  getGameState,
  getCombatSystem,
  getPathfindingSystem,
  
  // Map/tile utilities
  getLoc,
  getCenter,
  getTile,
  isWalkable,
  getBuildingAtPos,
  getDistance,
  getMapSize,
  getTileSize,
  
  // Network access
  getSocketList,
  getSocket,
  sendToPlayer,
  broadcastToAll,
  broadcastToArea
};
