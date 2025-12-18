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
  
  // #region agent log
  if (entityClass === 'Falcon') {
    const hasSpriteData = !!spriteData;
    const spriteDataSprite = spriteData ? spriteData.sprite : null;
    const spriteIsNull = !spriteData || !spriteDataSprite;
    const spriteType = spriteDataSprite ? typeof spriteDataSprite : 'null';
    const isFalconSprite = spriteDataSprite && !!(spriteDataSprite.falconflyd || spriteDataSprite.falconflyu);
    const isSerfSprite = spriteDataSprite && spriteDataSprite.facedown && !spriteDataSprite.falconflyd;
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpriteAssigner.js:assignSpriteToEntity',message:'Falcon sprite assignment - before assignment',data:{entityId:entity.id,entityClass,hasSpriteData,spriteIsNull,spriteType,isFalconSprite,isSerfSprite},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }
  // #endregion
  
  if (!spriteData || !spriteData.sprite) {
    console.error(`CRITICAL: No sprite found for class "${entityClass}"`);
    entity._invalidSprite = true; // Mark as invalid - won't render
    entity.sprite = null;
    entity.spriteSize = tileSize ? (tileSize * 1.5) : 96; // Default fallback, but entity won't render
    return false;
  }

  // Assign sprite
  entity.sprite = spriteData.sprite;
  
  // #region agent log
  if (entityClass === 'Falcon') {
    const assignedSprite = entity.sprite;
    const assignedIsFalcon = assignedSprite && !!(assignedSprite.falconflyd || assignedSprite.falconflyu);
    const assignedIsSerf = assignedSprite && assignedSprite.facedown && !assignedSprite.falconflyd;
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpriteAssigner.js:assignSpriteToEntity',message:'Falcon sprite assignment - after assignment',data:{entityId:entity.id,assignedIsFalcon,assignedIsSerf,entitySpriteSize:entity.spriteSize},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }
  // #endregion
  
  // Only set spriteSize if entity doesn't already have one from server
  // Server spriteSize is always authoritative - don't override it
  if (entity.spriteSize === undefined || entity.spriteSize === null) {
    entity.spriteSize = spriteData.spriteSize;
  } else {
    // Entity already has spriteSize (from server) - keep it, don't override
    // Registry size is just for reference, server value takes precedence
  }
  
  // Validation: Ensure sprite matches class (safety check)
  const validationResult = spriteRegistry.validateSprite(entityClass, entity.sprite);
  
  // #region agent log
  if (entityClass === 'Falcon') {
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpriteAssigner.js:assignSpriteToEntity',message:'Falcon sprite validation',data:{entityId:entity.id,validationResult,invalidSprite:entity._invalidSprite},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  }
  // #endregion
  
  if (!validationResult) {
    console.error(`CRITICAL: Sprite mismatch for class "${entityClass}" - sprite validation failed`);
    entity._invalidSprite = true;
    return false;
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
