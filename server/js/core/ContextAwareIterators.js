/**
 * ContextAwareIterators - Standardized context-aware entity iteration functions
 * Provides consistent iteration patterns that automatically filter by map context
 */

const mapContextHelpers = require('./MapContextHelpers');

/**
 * Iterate over all players in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (player) => void
 */
function forEachPlayer(contextEntity, callback) {
  if (!contextEntity || !callback) return;
  
  const playersInContext = mapContextHelpers.getEntitiesInSameContext(contextEntity, { type: 'player' });
  playersInContext.forEach(callback);
}

/**
 * Iterate over all NPCs in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (npc) => void
 */
function forEachNPC(contextEntity, callback) {
  if (!contextEntity || !callback) return;
  
  const npcsInContext = mapContextHelpers.getEntitiesInSameContext(contextEntity, { type: 'npc' });
  npcsInContext.forEach(callback);
}

/**
 * Iterate over all buildings in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (building) => void
 */
function forEachBuilding(contextEntity, callback) {
  if (!contextEntity || !callback || !global.Building || !global.Building.list) return;
  
  const buildingsInContext = mapContextHelpers.getBuildingsInSameContext(contextEntity);
  buildingsInContext.forEach(callback);
}

/**
 * Iterate over all items in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (item) => void
 */
function forEachItem(contextEntity, callback) {
  if (!contextEntity || !callback || !global.Item || !global.Item.list) return;
  
  const itemsInContext = mapContextHelpers.getItemsInSameContext(contextEntity);
  itemsInContext.forEach(callback);
}

/**
 * Iterate over all arrows in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (arrow) => void
 */
function forEachArrow(contextEntity, callback) {
  if (!contextEntity || !callback || !global.Arrow || !global.Arrow.list) return;
  
  const arrowsInContext = mapContextHelpers.getArrowsInSameContext(contextEntity);
  arrowsInContext.forEach(callback);
}

/**
 * Iterate over all lights in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (light) => void
 */
function forEachLight(contextEntity, callback) {
  if (!contextEntity || !callback || !global.Light || !global.Light.list) return;
  
  const lightsInContext = mapContextHelpers.getLightsInSameContext(contextEntity);
  lightsInContext.forEach(callback);
}

/**
 * Get all players in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of player entities
 */
function getPlayersInContext(contextEntity) {
  if (!contextEntity) return [];
  return mapContextHelpers.getEntitiesInSameContext(contextEntity, { type: 'player' });
}

/**
 * Get all NPCs in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of NPC entities
 */
function getNPCsInContext(contextEntity) {
  if (!contextEntity) return [];
  return mapContextHelpers.getEntitiesInSameContext(contextEntity, { type: 'npc' });
}

/**
 * Get all buildings in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of building entities
 */
function getBuildingsInContext(contextEntity) {
  if (!contextEntity || !global.Building || !global.Building.list) return [];
  return mapContextHelpers.getBuildingsInSameContext(contextEntity);
}

/**
 * Get all items in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of item entities
 */
function getItemsInContext(contextEntity) {
  if (!contextEntity || !global.Item || !global.Item.list) return [];
  return mapContextHelpers.getItemsInSameContext(contextEntity);
}

/**
 * Get all arrows in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of arrow entities
 */
function getArrowsInContext(contextEntity) {
  if (!contextEntity || !global.Arrow || !global.Arrow.list) return [];
  return mapContextHelpers.getArrowsInSameContext(contextEntity);
}

/**
 * Get all lights in the same context as the reference entity
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Array of light entities
 */
function getLightsInContext(contextEntity) {
  if (!contextEntity || !global.Light || !global.Light.list) return [];
  return mapContextHelpers.getLightsInSameContext(contextEntity);
}

/**
 * Generic iterator for any entity list with context filtering
 * @param {Array|Object} entityList - Array of entities or object with entity list
 * @param {Object} contextEntity - Reference entity for context matching
 * @param {Function} callback - Callback function: (entity) => void
 */
function forEachEntityInContext(entityList, contextEntity, callback) {
  if (!entityList || !contextEntity || !callback) return;
  
  // Handle both array and object (like Building.list, Item.list)
  const entities = Array.isArray(entityList) ? entityList : Object.values(entityList);
  const filtered = mapContextHelpers.filterEntitiesByContext(entities, contextEntity);
  filtered.forEach(callback);
}

module.exports = {
  forEachPlayer,
  forEachNPC,
  forEachBuilding,
  forEachItem,
  forEachArrow,
  forEachLight,
  getPlayersInContext,
  getNPCsInContext,
  getBuildingsInContext,
  getItemsInContext,
  getArrowsInContext,
  getLightsInContext,
  forEachEntityInContext
};

