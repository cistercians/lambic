/**
 * MapContextHelpers - Utility functions for map context awareness
 * Centralizes context-aware operations to reduce duplication and ensure consistency
 */

/**
 * Check if two entities are in the same map context
 * @param {Object} entity1 - First entity
 * @param {Object} entity2 - Second entity
 * @returns {boolean} True if entities are in same context
 */
function areInSameContext(entity1, entity2) {
  if (!entity1 || !entity2) return false;
  
  const entity1InBG = !!(entity1.inBattleground && entity1.battlegroundMatchId);
  const entity2InBG = !!(entity2.inBattleground && entity2.battlegroundMatchId);
  
  // If one is in battleground and other isn't, they're in different contexts
  if (entity1InBG !== entity2InBG) return false;
  
  // If both are in battlegrounds but different matches, they're in different contexts
  if (entity1InBG && entity2InBG && entity1.battlegroundMatchId !== entity2.battlegroundMatchId) {
    return false;
  }
  
  return true;
}

/**
 * Get all entities from Player.list that are in the same context as the given entity
 * @param {Object} entity - Entity to match context for
 * @param {Object} options - Optional filters
 * @param {string} options.excludeId - Entity ID to exclude from results
 * @param {string} options.type - Filter by entity type ('player', 'npc', etc.)
 * @param {number} options.z - Filter by z-level
 * @returns {Array} Array of entities in same context
 */
function getEntitiesInSameContext(entity, options = {}) {
  if (!entity || !global.Player || !global.Player.list) return [];
  
  const entityInBG = !!(entity.inBattleground && entity.battlegroundMatchId);
  const entityMatchId = entity.battlegroundMatchId || null;
  
  const results = [];
  
  for (const id in global.Player.list) {
    const other = global.Player.list[id];
    if (!other) continue;
    
    // Exclude self if specified
    if (options.excludeId && other.id === options.excludeId) continue;
    if (!options.excludeId && other.id === entity.id) continue;
    
    // Filter by type if specified
    if (options.type && other.type !== options.type) continue;
    
    // Filter by z-level if specified
    if (options.z !== undefined && other.z !== options.z) continue;
    
    // Check map context
    const otherInBG = !!(other.inBattleground && other.battlegroundMatchId);
    const otherMatchId = other.battlegroundMatchId || null;
    
    // Must be in same context
    if (entityInBG !== otherInBG) continue;
    if (entityInBG && otherInBG && entityMatchId !== otherMatchId) continue;
    
    results.push(other);
  }
  
  return results;
}

/**
 * Set map context properties on an entity
 * @param {Object} entity - Entity to set context on
 * @param {string|null} matchId - Battleground match ID, or null for main world
 */
function setEntityContext(entity, matchId) {
  if (!entity) return;
  
  if (matchId) {
    entity.inBattleground = true;
    entity.battlegroundMatchId = matchId;
  } else {
    entity.inBattleground = false;
    entity.battlegroundMatchId = null;
  }
}

/**
 * Filter an array of entities to only include those in the same context as the reference entity
 * @param {Array} entities - Array of entities to filter
 * @param {Object} contextEntity - Reference entity for context matching
 * @returns {Array} Filtered array of entities in same context
 */
function filterEntitiesByContext(entities, contextEntity) {
  if (!entities || !Array.isArray(entities) || !contextEntity) return [];
  
  const contextInBG = !!(contextEntity.inBattleground && contextEntity.battlegroundMatchId);
  const contextMatchId = contextEntity.battlegroundMatchId || null;
  
  return entities.filter(entity => {
    if (!entity) return false;
    
    const entityInBG = !!(entity.inBattleground && entity.battlegroundMatchId);
    const entityMatchId = entity.battlegroundMatchId || null;
    
    // Must be in same context
    if (contextInBG !== entityInBG) return false;
    if (contextInBG && entityInBG && contextMatchId !== entityMatchId) return false;
    
    return true;
  });
}

/**
 * Get context information for an entity
 * @param {string|number} entityId - Entity ID
 * @returns {Object|null} Context object with {inBattleground: boolean, matchId: string|null} or null if entity not found
 */
function getContextForEntity(entityId) {
  if (!entityId || !global.Player || !global.Player.list) return null;
  
  const entity = global.Player.list[entityId];
  if (!entity) return null;
  
  return {
    inBattleground: !!(entity.inBattleground && entity.battlegroundMatchId),
    matchId: entity.battlegroundMatchId || null
  };
}

/**
 * Check if an entity is in a battleground
 * @param {Object} entity - Entity to check
 * @returns {boolean} True if entity is in a battleground
 */
function isInBattleground(entity) {
  if (!entity) return false;
  return !!(entity.inBattleground && entity.battlegroundMatchId);
}

/**
 * Check if two entities are in the same battleground match
 * @param {Object} entity1 - First entity
 * @param {Object} entity2 - Second entity
 * @returns {boolean} True if both are in same battleground match
 */
function areInSameMatch(entity1, entity2) {
  if (!entity1 || !entity2) return false;
  
  const match1 = entity1.battlegroundMatchId || null;
  const match2 = entity2.battlegroundMatchId || null;
  
  return match1 !== null && match1 === match2;
}

/**
 * Validate context isolation - check for cross-context entities in update packets
 * This is a debugging/validation function to ensure context isolation is working
 * @param {Object} updatePack - Update packet to validate
 * @param {string} matchId - Battleground match ID to check against (null for main world)
 * @returns {Object} Validation result with {valid: boolean, issues: Array}
 */
function validateContextIsolation(updatePack, matchId) {
  const issues = [];
  
  if (!updatePack) return { valid: true, issues: [] };
  
  // Check player pack
  if (updatePack.player && Array.isArray(updatePack.player)) {
    updatePack.player.forEach(entity => {
      if (!entity) return;
      const entityInBG = !!(entity.inBattleground && entity.battlegroundMatchId);
      const entityMatchId = entity.battlegroundMatchId || null;
      
      if (matchId) {
        // Should be in battleground
        if (!entityInBG || entityMatchId !== matchId) {
          issues.push(`Player ${entity.id} in battleground pack but not in match ${matchId}`);
        }
      } else {
        // Should be in main world
        if (entityInBG) {
          issues.push(`Player ${entity.id} in main world pack but has inBattleground=true`);
        }
      }
    });
  }
  
  // Check item pack
  if (updatePack.item && Array.isArray(updatePack.item)) {
    updatePack.item.forEach(item => {
      if (!item || !item.id) return;
      const itemEntity = global.Item && global.Item.list ? global.Item.list[item.id] : null;
      if (itemEntity) {
        const itemInBG = !!(itemEntity.inBattleground && itemEntity.battlegroundMatchId);
        const itemMatchId = itemEntity.battlegroundMatchId || null;
        
        if (matchId) {
          if (!itemInBG || itemMatchId !== matchId) {
            issues.push(`Item ${item.id} in battleground pack but not in match ${matchId}`);
          }
        } else {
          if (itemInBG) {
            issues.push(`Item ${item.id} in main world pack but has inBattleground=true`);
          }
        }
      }
    });
  }
  
  // Check building pack
  if (updatePack.building && Array.isArray(updatePack.building)) {
    updatePack.building.forEach(building => {
      if (!building || !building.id) return;
      const buildingEntity = global.Building && global.Building.list ? global.Building.list[building.id] : null;
      if (buildingEntity) {
        const buildingInBG = !!(buildingEntity.inBattleground && buildingEntity.battlegroundMatchId);
        const buildingMatchId = buildingEntity.battlegroundMatchId || null;
        
        if (matchId) {
          if (!buildingInBG || buildingMatchId !== matchId) {
            issues.push(`Building ${building.id} in battleground pack but not in match ${matchId}`);
          }
        } else {
          if (buildingInBG) {
            issues.push(`Building ${building.id} in main world pack but has inBattleground=true`);
          }
        }
      }
    });
  }
  
  return {
    valid: issues.length === 0,
    issues: issues
  };
}

module.exports = {
  areInSameContext,
  getEntitiesInSameContext,
  setEntityContext,
  filterEntitiesByContext,
  getContextForEntity,
  isInBattleground,
  areInSameMatch,
  validateContextIsolation
};

