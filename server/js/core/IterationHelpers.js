/**
 * IterationHelpers - Modern iteration utilities
 * 
 * Provides ES6+ style iteration helpers to replace for-in loops.
 * These are safer and more readable than traditional for-in loops.
 * 
 * Usage:
 *   const { mapEntities, someEntity, everyEntity } = require('./IterationHelpers');
 *   
 *   // Instead of: for (var i in Player.list) { ... }
 *   forEachPlayer(player => { ... });
 *   
 *   // Get array of results
 *   const names = mapPlayers(player => player.name);
 */

/**
 * Iterate over Player.list safely
 * @param {Function} callback - (player, id) => void
 */
function forEachPlayer(callback) {
  const list = global.Player?.list;
  if (!list) return;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id)) {
      callback(list[id], id);
    }
  }
}

/**
 * Iterate over Building.list safely
 * @param {Function} callback - (building, id) => void
 */
function forEachBuilding(callback) {
  const list = global.Building?.list;
  if (!list) return;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id)) {
      callback(list[id], id);
    }
  }
}

/**
 * Iterate over Item.list safely
 * @param {Function} callback - (item, id) => void
 */
function forEachItem(callback) {
  const list = global.Item?.list;
  if (!list) return;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id)) {
      callback(list[id], id);
    }
  }
}

/**
 * Iterate over House.list safely
 * @param {Function} callback - (house, id) => void
 */
function forEachHouse(callback) {
  const list = global.House?.list;
  if (!list) return;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id)) {
      callback(list[id], id);
    }
  }
}

/**
 * Map over players and return array
 * @param {Function} mapper - (player, id) => any
 * @returns {Array} Mapped results
 */
function mapPlayers(mapper) {
  const results = [];
  forEachPlayer((player, id) => {
    results.push(mapper(player, id));
  });
  return results;
}

/**
 * Map over buildings and return array
 * @param {Function} mapper - (building, id) => any
 * @returns {Array} Mapped results
 */
function mapBuildings(mapper) {
  const results = [];
  forEachBuilding((building, id) => {
    results.push(mapper(building, id));
  });
  return results;
}

/**
 * Filter players by predicate
 * @param {Function} predicate - (player) => boolean
 * @returns {Array} Filtered players
 */
function filterPlayers(predicate) {
  const results = [];
  forEachPlayer((player) => {
    if (predicate(player)) results.push(player);
  });
  return results;
}

/**
 * Filter buildings by predicate
 * @param {Function} predicate - (building) => boolean
 * @returns {Array} Filtered buildings
 */
function filterBuildings(predicate) {
  const results = [];
  forEachBuilding((building) => {
    if (predicate(building)) results.push(building);
  });
  return results;
}

/**
 * Find first player matching predicate
 * @param {Function} predicate - (player) => boolean
 * @returns {object|null} First matching player
 */
function findPlayer(predicate) {
  const list = global.Player?.list;
  if (!list) return null;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id) && predicate(list[id])) {
      return list[id];
    }
  }
  return null;
}

/**
 * Find first building matching predicate
 * @param {Function} predicate - (building) => boolean
 * @returns {object|null} First matching building
 */
function findBuilding(predicate) {
  const list = global.Building?.list;
  if (!list) return null;
  for (const id in list) {
    if (Object.prototype.hasOwnProperty.call(list, id) && predicate(list[id])) {
      return list[id];
    }
  }
  return null;
}

/**
 * Check if any player matches predicate
 * @param {Function} predicate - (player) => boolean
 * @returns {boolean} True if any match
 */
function somePlayers(predicate) {
  return findPlayer(predicate) !== null;
}

/**
 * Check if any building matches predicate
 * @param {Function} predicate - (building) => boolean
 * @returns {boolean} True if any match
 */
function someBuildings(predicate) {
  return findBuilding(predicate) !== null;
}

/**
 * Get count of players matching predicate
 * @param {Function} predicate - Optional filter
 * @returns {number} Count
 */
function countPlayers(predicate = null) {
  let count = 0;
  forEachPlayer((player) => {
    if (!predicate || predicate(player)) count++;
  });
  return count;
}

/**
 * Get count of buildings matching predicate
 * @param {Function} predicate - Optional filter
 * @returns {number} Count
 */
function countBuildings(predicate = null) {
  let count = 0;
  forEachBuilding((building) => {
    if (!predicate || predicate(building)) count++;
  });
  return count;
}

/**
 * Get players within distance of a point
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} radius - Search radius
 * @param {number} z - Z-level (optional, -1 for any)
 * @returns {Array} Players within radius
 */
function getPlayersInRadius(x, y, radius, z = -1) {
  const radiusSq = radius * radius;
  return filterPlayers(player => {
    if (z !== -1 && player.z !== z) return false;
    const dx = player.x - x;
    const dy = player.y - y;
    return (dx * dx + dy * dy) <= radiusSq;
  });
}

/**
 * Get buildings within distance of a point
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {number} radius - Search radius
 * @returns {Array} Buildings within radius
 */
function getBuildingsInRadius(x, y, radius) {
  const radiusSq = radius * radius;
  return filterBuildings(building => {
    const dx = building.x - x;
    const dy = building.y - y;
    return (dx * dx + dy * dy) <= radiusSq;
  });
}

module.exports = {
  // Type-specific iteration
  forEachPlayer,
  forEachBuilding,
  forEachItem,
  forEachHouse,
  
  // Mapping
  mapPlayers,
  mapBuildings,
  
  // Filtering
  filterPlayers,
  filterBuildings,
  
  // Finding
  findPlayer,
  findBuilding,
  
  // Predicates
  somePlayers,
  someBuildings,
  
  // Counting
  countPlayers,
  countBuildings,
  
  // Spatial queries
  getPlayersInRadius,
  getBuildingsInRadius
};

