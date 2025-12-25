/**
 * SpriteAssigner - Single point of sprite assignment
 * Used by PlayerEntity constructor and entity updates
 * 
 * This is the ONLY place where sprites should be assigned to entities.
 * All sprite assignments must go through this function.
 */

/**
 * Assign sprite and size to an entity based on its class
 * @param {object} entity - Entity object to assign sprite to
 * @param {string} entityClass - Entity class name
 * @param {boolean} isGhost - Is entity in ghost mode?
 * @param {number} tileSize - Tile size in pixels (for fallback size calculation)
 * @returns {boolean} True if assignment successful, false if failed
 */
function assignSpriteToEntity(entity, entityClass, isGhost, tileSize) {
  if (!entity) {
    console.error('assignSpriteToEntity called without entity');
    return false;
  }

  if (!entityClass) {
    console.error('assignSpriteToEntity called without entityClass');
    entity._invalidSprite = true;
    return false;
  }

  const spriteRegistry = typeof window !== 'undefined' && window.spriteRegistry ? window.spriteRegistry : null;
  
  if (!spriteRegistry || !spriteRegistry.registry || Object.keys(spriteRegistry.registry).length === 0) {
    console.error('SpriteRegistry not initialized - cannot assign sprite');
    entity._invalidSprite = true;
    return false;
  }

  const spriteData = spriteRegistry.getSpriteData(entityClass, isGhost);
  
  // CRITICAL: Fallback check - if type is missing but class indicates fauna, treat as fauna
  const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
  if (faunaClasses.includes(entityClass) && entity.type !== 'fauna') {
    entity.type = 'fauna';
  }
  
  const isFauna = entity.type === 'fauna' || faunaClasses.includes(entityClass);
  
  if (!spriteData || !spriteData.sprite) {
    // Special handling for ghost mode - check if ghost sprite is available
    if (isGhost) {
      const ghostSprite = (typeof ghost !== 'undefined' ? ghost : (typeof window !== 'undefined' && window.ghost ? window.ghost : null));
      if (ghostSprite) {
        const data = spriteRegistry.registry[entityClass];
        if (data) {
          entity.sprite = ghostSprite;
          entity.spriteSize = data.spriteSize;
          entity._invalidSprite = false;
          return true;
        }
      }
    } else {
      console.error(`CRITICAL: No sprite found for class "${entityClass}"`, isFauna ? '(FAUNA ENTITY)' : '');
    }
    entity._invalidSprite = true; // Mark as invalid - won't render
    entity.sprite = null;
    entity.spriteSize = tileSize ? (tileSize * 1.5) : 96; // Default fallback, but entity won't render
    return false;
  }

  // CRITICAL: Validate sprite is appropriate for fauna entities
  // Some fauna (Boar, Wolf) have attack animations, but we need to ensure
  // we're not assigning serf sprites to fauna entities
  // The way to check: validate that the sprite matches what's in the registry
  if (isFauna && spriteData.sprite) {
    // Check if sprite matches the expected sprite from registry
    // This ensures we're using the correct sprite, not a serf sprite
    const registryData = spriteRegistry.registry[entityClass];
    if (registryData && registryData.sprite) {
      // If registry has a sprite for this class, it must match
      if (spriteData.sprite !== registryData.sprite) {
        console.error(`CRITICAL: Sprite mismatch for fauna entity! Expected sprite from registry but got different sprite.`, {
          entityId: entity.id,
          entityType: entity.type,
          entityClass: entityClass,
          expectedSprite: registryData.sprite,
          actualSprite: spriteData.sprite
        });
        entity._invalidSprite = true;
        entity.sprite = null;
        return false;
      }
    } else {
      // Registry doesn't have a sprite for this class - this shouldn't happen
      console.error(`CRITICAL: No sprite in registry for fauna class "${entityClass}"`, {
        entityId: entity.id,
        entityType: entity.type,
        entityClass: entityClass
      });
      entity._invalidSprite = true;
      entity.sprite = null;
      return false;
    }
  }
  
  // Assign sprite
  entity.sprite = spriteData.sprite;
  
  // Only set spriteSize if entity doesn't already have one from server
  // Server spriteSize is always authoritative - don't override it
  if (entity.spriteSize === undefined || entity.spriteSize === null) {
    entity.spriteSize = spriteData.spriteSize;
  } else {
    // Entity already has spriteSize (from server) - keep it, don't override
    // Registry size is just for reference, server value takes precedence
  }
  
  // Validation: Ensure sprite matches class (safety check)
  // Skip validation for ghosts - they always use the ghost sprite regardless of class
  if (!isGhost) {
    const validationResult = spriteRegistry.validateSprite(entityClass, entity.sprite);
    
    if (!validationResult) {
      console.error(`CRITICAL: Sprite mismatch for class "${entityClass}" - sprite validation failed`, isFauna ? '(FAUNA ENTITY)' : '');
      entity._invalidSprite = true;
      return false;
    }
  }
  
  // Success - clear invalid flag
  entity._invalidSprite = false;
  return true;
}

// Expose to global scope for browser
if (typeof window !== 'undefined') {
  window.assignSpriteToEntity = assignSpriteToEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = assignSpriteToEntity;
}
