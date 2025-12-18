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
  
  // CRITICAL: Assign sprite using single assignment function
  // No fallbacks, no defaults - either succeeds or entity is invalid
  // Use spriteSize from initPack if provided (server-calculated), otherwise will be set by assignSpriteToEntity
  if (typeof window !== 'undefined' && typeof window.assignSpriteToEntity === 'function') {
    if (!assignSpriteToEntity(self, self.class, self.ghost, typeof tileSize !== 'undefined' ? tileSize : 64)) {
      console.error(`Failed to assign sprite for entity ${self.id} class ${self.class}`);
      // Entity will be marked _invalidSprite and won't render
      // Use spriteSize from initPack if available, otherwise default won't matter (won't render)
      self.spriteSize = initPack.spriteSize || 96; // Default, but entity won't render
    } else {
      // If server sent spriteSize, prefer it (it's authoritative)
      // But spriteSize was already set by assignSpriteToEntity, so only override if server sent different value
      if (initPack.spriteSize && initPack.spriteSize !== self.spriteSize) {
        console.warn(`Sprite size mismatch: registry says ${self.spriteSize}, server says ${initPack.spriteSize} for class ${self.class}`);
        // Use server value as it's authoritative
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
