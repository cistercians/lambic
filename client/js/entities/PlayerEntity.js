/**
 * PlayerEntity - Client-side Player entity constructor
 * 
 * Extracted from client.js for better organization.
 */

function PlayerEntity(initPack) {
  // Ensure Player.list exists (preserve from early initialization)
  if (!Player.list) Player.list = {};
  var self = {};
  self.type = initPack.type;
  self.name = initPack.name;
  self.house = initPack.house;
  self.kingdom = initPack.kingdom;
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.class = initPack.class;
  
  // CRITICAL: Fallback check - if type is missing but class indicates fauna, set type to 'fauna'
  const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
  if (faunaClasses.includes(self.class) && self.type !== 'fauna') {
    console.warn('[FAUNA DEBUG] Fauna class detected but type not "fauna" - fixing in PlayerEntity:', {
      id: self.id,
      class: self.class,
      currentType: self.type
    });
    self.type = 'fauna';
  }
  
  // CRITICAL: Validate fauna entities have valid class property
  // Fauna entities (type === 'fauna') MUST have a class for proper rendering
  // If missing, mark entity as invalid to prevent rendering with wrong sprite
  if (self.type === 'fauna' && (!self.class || self.class === null || self.class === undefined)) {
    console.error('CRITICAL: Fauna entity missing class property in PlayerEntity:', {
      id: self.id,
      type: self.type,
      name: self.name
    });
    // Mark as invalid - entity will not render
    self._invalidSprite = true;
    self.sprite = null;
    // Don't proceed with sprite assignment - entity is invalid
  }
  
  // Log fauna entity creation for debugging
  if (self.type === 'fauna' || ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'].includes(self.class)) {
    console.log('[FAUNA DEBUG] PlayerEntity created:', {
      id: self.id,
      type: self.type,
      class: self.class,
      name: self.name,
      spriteSize: initPack.spriteSize,
      hasClass: !!self.class,
      hasType: !!self.type
    });
  }
  
  self.rank = initPack.rank;
  self.friends = initPack.friends,
  self.enemies = initPack.enemies,
  self.gear = initPack.gear;
  self.inventory = initPack.inventory;
  self.facing = initPack.facing || 'down';
  self.stealthed = initPack.stealthed;
  self.revealed = initPack.revealed;
  self.angle = 0;
  self.pressingDown = false;
  self.pressingUp = false;
  self.pressingLeft = false;
  self.pressingRight = false;
  self.pressingAttack = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.innaWoods = initPack.innaWoods;
  self.onMtn = initPack.onMtn || false;
  self.working = false;
  self.chopping = false;
  self.mining = false;
  self.farming = false;
  self.building = false;
  self.fishing = false;
  self.hp = initPack.hp;
  self.hpMax = initPack.hpMax;
  self.spirit = initPack.spirit;
  self.spiritMax = initPack.spiritMax;
  self.ghost = initPack.ghost || false;
  
  // CRITICAL: Server spriteSize is ALWAYS authoritative - use it if provided
  // The server's getInitPack recalculates spriteSize from class, so it's always correct
  // Only use registry spriteSize if server didn't send one (shouldn't happen)
  if (initPack.spriteSize !== undefined && initPack.spriteSize !== null) {
    // Server sent spriteSize - use it (it's calculated from class in getInitPack)
    self.spriteSize = initPack.spriteSize;
  } else {
    console.warn(`[Client SpriteSize] ${self.class} (id: ${self.id}): server did not send spriteSize - will use registry value`);
  }
  
  // Assign sprite using single assignment function
  // No fallbacks, no defaults - either succeeds or entity is invalid
  // Skip sprite assignment if entity is already marked as invalid (e.g., fauna missing class)
  if (!self._invalidSprite && typeof window !== 'undefined' && typeof window.assignSpriteToEntity === 'function') {
    if (!assignSpriteToEntity(self, self.class, self.ghost, typeof tileSize !== 'undefined' ? tileSize : 64)) {
      console.error(`Failed to assign sprite for entity ${self.id} class ${self.class}`);
      // Entity will be marked _invalidSprite and won't render
      // spriteSize was already set from server above, so keep it
    } else {
      // Sprite assigned successfully
      // If server sent spriteSize, it was already set above and takes precedence
      // If server didn't send spriteSize, assignSpriteToEntity set it from registry
      // But server should ALWAYS send spriteSize, so this is just a safety check
      if (initPack.spriteSize !== undefined && initPack.spriteSize !== null) {
        // Ensure server value is used (in case assignSpriteToEntity overwrote it)
        self.spriteSize = initPack.spriteSize;
      }
    }
  } else {
    // Fallback if SpriteAssigner not loaded yet - mark as invalid
    console.error('assignSpriteToEntity not available - marking entity as invalid');
    self._invalidSprite = true;
    self.sprite = null;
    self.spriteSize = initPack.spriteSize || 96;
  }
  self.ranged = initPack.ranged;
  self.action = initPack.action;
  self.kills = initPack.kills || 0;
  self.skulls = initPack.skulls || '';
  self.spriteScale = initPack.spriteScale || 1.0;
  self.isBoarded = initPack.isBoarded || false;
  self.boardedShip = initPack.boardedShip || null;

  // Helper function to check if an image is loaded and valid
  function isImageValid(img) {
    return img && img.complete && img.naturalWidth > 0 && !img.error;
  }

  // Helper function to safely draw an image
  function safeDrawImage(img, x, y, width, height) {
    if (isImageValid(img)) {
      ctx.drawImage(img, x, y, width, height);
    }
    // Don't draw anything if image is not loaded - just skip rendering
  }

  // Player rendering extracted to PlayerRenderer.js
  // Use PlayerRenderer.render() instead - NO LEGACY FALLBACK
  // If PlayerRenderer is not available, entity will not render (fail fast, don't render wrong)
  self.draw = function() {
    // Check for PlayerRenderer class or singleton instance
    var renderer = (typeof window !== 'undefined' && window.playerRenderer) || 
                   (typeof window !== 'undefined' && window.PlayerRenderer && typeof window.PlayerRenderer.render === 'function' ? { render: window.PlayerRenderer.render } : null);
    
    if (renderer && typeof renderer.render === 'function') {
      // Falcons now work like other NPCs - no special handling needed
      // The sprite is set on the entity, and PlayerRenderer handles rendering
      // Get camera position for config
      var cameraPos = getCameraPosition();
      return renderer.render(self, ctx, {
        Img: Img,
        cameraPos: cameraPos,
        getCameraPosition: getCameraPosition,
        getCurrentZ: getCurrentZ,
        stealthCheck: stealthCheck,
        allyCheck: allyCheck,
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        tileSize: tileSize,
        selfId: selfId,
        godModeCamera: godModeCamera,
        spectateCameraSystem: spectateCameraSystem,
        Player: Player,
        kingdomList: kingdomList,
        houseList: houseList,
        workingIcon: workingIcon,
        wrk: wrk,
        wlk: wlk,
        falcon: (typeof window !== 'undefined' && window.falcon) || (typeof falcon !== 'undefined' ? falcon : null),
        safeDrawImage: safeDrawImage
      });
    }
    // NO LEGACY FALLBACK - If PlayerRenderer not available, don't render
    // This prevents incorrect rendering with wrong sprites/sizes
    console.error(`PlayerRenderer not available - entity ${self.id} (class: ${self.class}) will not render`);
    return;
  };

  Player.list[self.id] = self;
  return self;
}

// Expose to global scope for browser use (must be done immediately)
if (typeof window !== 'undefined') {
  window.PlayerEntity = PlayerEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerEntity;
}
