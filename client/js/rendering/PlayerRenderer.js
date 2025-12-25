/**
 * PlayerRenderer - Handles rendering of Player entities on the map
 * 
 * Extracted from client.js - consolidates 450+ lines of player rendering logic.
 * Handles sprites, animations, HP/spirit bars, names, stealth, gear, etc.
 */

class PlayerRenderer {
  constructor() {
    // Dependencies will be injected
  }

  /**
   * Helper to check if an image is loaded and valid
   * @param {Image} img - Image object
   * @returns {boolean} Is valid
   */
  isImageValid(img) {
    return img && img.complete && img.naturalWidth > 0 && !img.error;
  }

  /**
   * Safely draw an image (skip if not loaded)
   * @param {Image} img - Image object
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  safeDrawImage(img, x, y, width, height, ctx) {
    if (this.isImageValid(img)) {
      ctx.drawImage(img, x, y, width, height);
    }
  }

  /**
   * Render HP and spirit bars
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, barX, barY, stealth }
   */
  renderBars(player, config) {
    const { ctx, barX, barY, stealth } = config;
    
    // Hide bars when player is on board a ship
    if (player.boardedShip) {
      return;
    }
    
    if (stealth >= 1.5 || player.class === 'Falcon' || player.ghost) {
      return; // Skip bars for stealthed/enemy-only views, falcons, ghosts
    }

    // HP bar
    if (player.hp) {
      const hpWidth = 60 * player.hp / player.hpMax;
      ctx.fillStyle = 'orangered';
      ctx.fillRect(barX, barY - 30, 60, 6);
      ctx.fillStyle = 'limegreen';
      ctx.fillRect(barX, barY - 30, hpWidth, 6);
    }

    // Spirit bar
    if (player.spirit) {
      const spiritWidth = 60 * player.spirit / player.spiritMax;
      ctx.fillStyle = 'orangered';
      ctx.fillRect(barX, barY - 20, 60, 4);
      ctx.fillStyle = 'royalblue';
      ctx.fillRect(barX, barY - 20, spiritWidth, 4);
    }

    // Breath bar (for underwater z=-3)
    if (player.z === -3 && player.breath) {
      const brWidth = 60 * player.breath / player.breathMax;
      ctx.fillStyle = 'azure';
      ctx.fillRect(barX, barY - 30, brWidth, 6);
    }
  }

  /**
   * Get ally color based on relationship
   * @param {number} allied - Relationship value (2=same, 1=ally, 0=neutral, -1=enemy)
   * @returns {string} Color
   */
  getAlliedColor(allied) {
    if (allied === 2) return 'lightskyblue';
    if (allied === 1) return 'palegreen';
    if (allied === 0) return 'white';
    if (allied === -1) return 'orangered';
    return 'white';
  }

  /**
   * Render player name/rank with appropriate color
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, barX, barY, allyCheck, kingdomList, houseList }
   */
  renderName(player, config) {
    const { ctx, barX, barY, allyCheck, kingdomList, houseList } = config;
    
    // Hide name when player is on board a ship
    if (player.boardedShip) {
      return;
    }
    
    if (!player.rank && !player.name) return;

    const allied = allyCheck(player.id);
    const color = this.getAlliedColor(allied);
    ctx.fillStyle = color;
    ctx.font = '15px minion web';
    ctx.textAlign = 'center';

    const isSerf = (player.class === 'Serf' || player.class === 'SerfM' || player.class === 'SerfF');
    
    let displayName = '';
    if (player.skulls) {
      displayName = player.skulls + ' ';
    }
    
    // Add flag emoji for kingdom/house (not for serfs)
    if (player.kingdom && kingdomList && kingdomList[player.kingdom] && !isSerf) {
      if (kingdomList[player.kingdom].flag) {
        displayName += kingdomList[player.kingdom].flag + ' ';
      }
    } else if (player.house && houseList && houseList[player.house] && !isSerf) {
      if (houseList[player.house].flag) {
        displayName += houseList[player.house].flag + ' ';
      }
    }
    
    if (player.rank) {
      displayName += player.rank;
    }
    if (player.name) {
      displayName += player.name;
    }

    ctx.fillText(displayName, barX + 30, barY - 40, 100);
  }

  /**
   * Render status icons (working, revealed, combat, speech)
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, barX, barY, workingIcon, wrk }
   */
  renderStatus(player, config) {
    const { ctx, barX, barY, workingIcon, wrk } = config;

    // Status icons
    if (player.working && workingIcon) {
      ctx.fillText(workingIcon[wrk], barX + 80, barY - 20);
    } else if (player.revealed) {
      ctx.fillText('👁️', barX + 80, barY - 20);
    } else if (player.action === 'combat') {
      ctx.fillText('⚔️', barX + 80, barY - 20);
    }

    // Speech bubble for NPCs
    if (player.speechBubble) {
      ctx.font = '20px minion web';
      ctx.fillStyle = 'white';
      ctx.fillText('💬', barX + 80, barY - 40);
    }

    // Skulls for fauna minibosses (above HP bar, no name)
    if (player.skulls && !player.name) {
      ctx.font = '20px minion web';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'white';
      ctx.fillText(player.skulls, barX + 30, barY - 45);
    }
  }

  /**
   * Apply stealth transparency
   * @param {number} stealth - Stealth level
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  applyStealth(stealth, ctx) {
    if (stealth === 2) {
      ctx.globalAlpha = 0.3; // Fully stealthed - 30% visible
    } else if (stealth === 1.5 || stealth === 1) {
      ctx.globalAlpha = 0.7; // Revealed or ally view - 70% visible
    } else {
      ctx.globalAlpha = 1.0; // Not stealthed - fully visible
    }
  }

  /**
   * Render falcon sprite
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, x, y, scaledSpriteSize, falcon }
   * @returns {boolean} Rendered successfully
   */
  renderFalcon(player, config) {
    const { ctx, x, y, scaledSpriteSize, falcon } = config;
    
    if (player.class !== 'Falcon') {
      return false;
    }
    
    // CRITICAL: Don't trust player.sprite - it might be incorrectly set to a serf sprite
    // Always get the falcon sprite from proper sources, ignoring player.sprite
    // Try multiple sources for falcon sprite:
    // 1. falcon from config
    // 2. window.falcon (exposed from imgloader.js)
    // 3. spriteHelper.getSpriteForClass
    // 4. Only use player.sprite as last resort if it's actually a falcon sprite
    let falconSprite = null;
    
    // First try: falcon from config
    if (falcon) {
      falconSprite = falcon;
    }
    
    // Second try: window.falcon
    if (!falconSprite && typeof window !== 'undefined') {
      if (typeof window.falcon !== 'undefined' && window.falcon) {
        falconSprite = window.falcon;
      }
    }
    
    // Third try: spriteHelper
    if (!falconSprite && typeof window !== 'undefined' && window.spriteHelper) {
      falconSprite = window.spriteHelper.getSpriteForClass('Falcon', false);
    }
    
    // Last resort: Only use player.sprite if it's actually a falcon sprite
    // Check for falcon-specific properties (falconflyd, falconflyu, etc.) which serf sprites don't have
    if (!falconSprite && player.sprite) {
      // Falcons have falconflyd/falconflyu/falconflyl/falconflyr properties that serfs don't have
      // OR check if it's the same object as window.falcon (identity check)
      const hasFalconProps = player.sprite.falconflyd || player.sprite.falconflyu || 
                             player.sprite.falconflyl || player.sprite.falconflyr;
      const isFalconObject = (typeof window !== 'undefined' && window.falcon && player.sprite === window.falcon);
      
      if (hasFalconProps || isFalconObject) {
        falconSprite = player.sprite;
      } else {
        // player.sprite is NOT a falcon sprite (probably a serf), so ignore it
        // This prevents rendering falcons as serfs
        console.warn('Falcon entity has non-falcon sprite assigned:', player.id, player.class);
      }
    }
    
    // If still no sprite, falcon images haven't loaded yet
    if (!falconSprite) {
      return true; // Return true to prevent fall-through, but don't render
    }
    
    // Check if at least one falcon sprite direction is loaded (matching SpriteHelper logic)
    const hasLoadedSprite = (falconSprite.facedown && falconSprite.facedown.complete && falconSprite.facedown.naturalWidth > 0) ||
                            (falconSprite.faceup && falconSprite.faceup.complete && falconSprite.faceup.naturalWidth > 0) ||
                            (falconSprite.faceleft && falconSprite.faceleft.complete && falconSprite.faceleft.naturalWidth > 0) ||
                            (falconSprite.faceright && falconSprite.faceright.complete && falconSprite.faceright.naturalWidth > 0);
    
    if (!hasLoadedSprite) {
      return true; // Return true to prevent fall-through rendering, but don't render yet
    }

    // Render based on facing direction, with fallback to facedown if direction not loaded
    if (player.facing === 'down' && falconSprite.facedown && falconSprite.facedown.complete) {
      this.safeDrawImage(falconSprite.facedown, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'up' && falconSprite.faceup && falconSprite.faceup.complete) {
      this.safeDrawImage(falconSprite.faceup, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'left' && falconSprite.faceleft && falconSprite.faceleft.complete) {
      this.safeDrawImage(falconSprite.faceleft, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'right' && falconSprite.faceright && falconSprite.faceright.complete) {
      this.safeDrawImage(falconSprite.faceright, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else {
      // Fallback: use any loaded direction (prefer facedown)
      if (falconSprite.facedown && falconSprite.facedown.complete) {
        this.safeDrawImage(falconSprite.facedown, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (falconSprite.faceup && falconSprite.faceup.complete) {
        this.safeDrawImage(falconSprite.faceup, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (falconSprite.faceleft && falconSprite.faceleft.complete) {
        this.safeDrawImage(falconSprite.faceleft, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (falconSprite.faceright && falconSprite.faceright.complete) {
        this.safeDrawImage(falconSprite.faceright, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      }
    }

    return true; // Falcon rendered, don't fall through
  }

  /**
   * Render work animation sprite
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, x, y, spriteSize, wrk }
   * @returns {boolean} Rendered successfully
   */
  renderWorkAnimation(player, config) {
    const { ctx, x, y, spriteSize, wrk } = config;

    if (player.chopping && player.sprite.chopping) {
      this.safeDrawImage(player.sprite.chopping[wrk], x, y, spriteSize, spriteSize, ctx);
      return true;
    }
    if (player.mining && player.sprite.mining) {
      this.safeDrawImage(player.sprite.mining[wrk], x, y, spriteSize, spriteSize, ctx);
      return true;
    }
    if (player.farming && player.sprite.farming) {
      this.safeDrawImage(player.sprite.farming[wrk], x, y, spriteSize, spriteSize, ctx);
      return true;
    }
    if (player.building && player.sprite.building) {
      this.safeDrawImage(player.sprite.building[wrk], x, y, spriteSize, spriteSize, ctx);
      return true;
    }
    if (player.fishing && player.sprite.fishingd) {
      if (player.facing === 'down') {
        this.safeDrawImage(player.sprite.fishingd, x, y, spriteSize, spriteSize, ctx);
      } else if (player.facing === 'up') {
        this.safeDrawImage(player.sprite.fishingu, x, y, spriteSize, spriteSize, ctx);
      } else if (player.facing === 'left') {
        this.safeDrawImage(player.sprite.fishingl, x, y, spriteSize, spriteSize, ctx);
      } else if (player.facing === 'right') {
        this.safeDrawImage(player.sprite.fishingr, x, y, spriteSize, spriteSize, ctx);
      }
      return true;
    }

    return false;
  }

  /**
   * Render attack animation sprite
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, x, y, scaledSpriteSize, wlk }
   * @returns {boolean} Rendered successfully
   */
  renderAttackAnimation(player, config) {
    const { ctx, x, y, scaledSpriteSize } = config;

    if (!player.pressingAttack) return false;

    // Bow/ranged attack (angle-based)
    if ((player.gear && player.gear.weapon && player.gear.weapon.type === 'bow') || player.ranged) {
      if (player.angle > 45 && player.angle <= 115) {
        this.safeDrawImage(player.sprite.attackdb, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (player.angle > -135 && player.angle <= -15) {
        this.safeDrawImage(player.sprite.attackub, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (player.angle > 115 || player.angle <= -135) {
        this.safeDrawImage(player.sprite.attacklb, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      } else if (player.angle > -15 || player.angle <= 45) {
        this.safeDrawImage(player.sprite.attackrb, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
      }
      return true;
    }

    // Melee attack (direction-based)
    if (player.facing === 'down') {
      this.safeDrawImage(player.sprite.attackd, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'up') {
      this.safeDrawImage(player.sprite.attacku, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'left') {
      this.safeDrawImage(player.sprite.attackl, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'right') {
      this.safeDrawImage(player.sprite.attackr, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    }
    return true;
  }

  /**
   * Render movement/idle sprite
   * @param {object} player - Player entity
   * @param {object} config - Configuration { ctx, x, y, scaledSpriteSize, wlk }
   */
  renderMovementSprite(player, config) {
    const { ctx, x, y, scaledSpriteSize, wlk } = config;

    // Falcons use walkdown/walkup/walkleft/walkright arrays (like other NPCs)
    // But they're named falconflyd, falconflyu, etc. in the sprite object
    if (player.facing === 'down' && !player.pressingDown) {
      this.safeDrawImage(player.sprite.facedown, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.pressingDown) {
      // Falcons use walkdown array (falconflyd)
      const walkSprite = player.sprite.walkdown ? player.sprite.walkdown[wlk] : player.sprite.facedown;
      this.safeDrawImage(walkSprite, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'up' && !player.pressingUp) {
      this.safeDrawImage(player.sprite.faceup, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.pressingUp) {
      const walkSprite = player.sprite.walkup ? player.sprite.walkup[wlk] : player.sprite.faceup;
      this.safeDrawImage(walkSprite, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'left' && !player.pressingLeft) {
      this.safeDrawImage(player.sprite.faceleft, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.pressingLeft) {
      const walkSprite = player.sprite.walkleft ? player.sprite.walkleft[wlk] : player.sprite.faceleft;
      this.safeDrawImage(walkSprite, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.facing === 'right' && !player.pressingRight) {
      this.safeDrawImage(player.sprite.faceright, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    } else if (player.pressingRight) {
      const walkSprite = player.sprite.walkright ? player.sprite.walkright[wlk] : player.sprite.faceright;
      this.safeDrawImage(walkSprite, x, y, scaledSpriteSize, scaledSpriteSize, ctx);
    }
  }

  /**
   * Main render method - renders a player entity
   * @param {object} player - Player entity
   * @param {object} ctx - Canvas context
   * @param {object} config - Configuration object
   */
  render(player, ctx, config) {
    const {
      cameraPos,
      WIDTH,
      HEIGHT,
      tileSize,
      selfId,
      godModeCamera,
      spectateCameraSystem,
      stealthCheck,
      allyCheck,
      kingdomList,
      houseList,
      workingIcon,
      wrk,
      wlk,
      falcon
    } = config;


    // NEW: Validate sprite matches class before rendering
    if (player._invalidSprite) {
      return; // Don't render invalid entities
    }

    // Don't render if sprite not loaded (universal behavior for all classes)
    if (!player.sprite) {
      console.warn(`Entity ${player.id} (class: ${player.class}) has no sprite - skipping render`);
      return;
    }

    // CRITICAL: Fallback check - if type is missing but class indicates fauna, treat as fauna
    const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
    if (faunaClasses.includes(player.class) && player.type !== 'fauna') {
      player.type = 'fauna';
    }
    
    // CRITICAL: Validate peaceful fauna entities don't have serf sprites
    // Aggressive fauna (Wolf, Boar) SHOULD have attack animations - they're supposed to attack
    // Peaceful fauna (Deer, Sheep, Falcon) should NOT have attack animations - if they do, it's likely a serf sprite
    const isFauna = player.type === 'fauna' || faunaClasses.includes(player.class);
    const aggressiveFauna = ['Wolf', 'Boar'];
    const peacefulFauna = ['Deer', 'Sheep', 'Falcon'];
    const isAggressiveFauna = aggressiveFauna.includes(player.class);
    const isPeacefulFauna = peacefulFauna.includes(player.class);
    
    if (isFauna && player.sprite && isPeacefulFauna) {
      // Only validate peaceful fauna - they should NOT have attack animations
      const hasAttackAnimations = player.sprite.attackd || player.sprite.attacku || 
                                  player.sprite.attackl || player.sprite.attackr;
      if (hasAttackAnimations) {
        console.error(`CRITICAL RENDER VALIDATION: Peaceful fauna entity ${player.id} (class: ${player.class}, type: ${player.type}) has serf sprite with attack animations - skipping render`);
        return; // Don't render - better than wrong sprite
      }
    }
    // Note: Aggressive fauna (Wolf, Boar) are allowed to have attack animations - this is expected behavior

    // Validate sprite matches class (safety check)
    if (typeof window !== 'undefined' && window.spriteRegistry && typeof window.spriteRegistry.validateSprite === 'function') {
      if (!window.spriteRegistry.validateSprite(player.class, player.sprite)) {
        console.error(`RENDER VALIDATION FAILED: Entity ${player.id} class "${player.class}" has wrong sprite - skipping render`, isFauna ? '(FAUNA ENTITY)' : '');
        return; // Don't render - better than wrong sprite
      }
    }

    // God mode: Hide own character
    if (godModeCamera.isActive && player.id === selfId) return;

    // Spectate mode: Hide spectator characters
    if (spectateCameraSystem.isActive && player.type === 'spectator') return;

    // Ghost invisibility: Don't render other players' ghosts
    if (player.ghost && player.id !== selfId) return;

    // Don't render players boarded on ships (check both isBoarded and boardedShip for safety)
    if (player.isBoarded || player.boardedShip) return;

    const stealth = stealthCheck(player.id);
    
    // Calculate sprite scaling (for fauna minibosses)
    const shouldScale = (player.class === 'Wolf' || player.class === 'Boar') && player.spriteScale;
    const scaledSpriteSize = shouldScale ? (player.spriteSize * player.spriteScale) : player.spriteSize;
    
    // Calculate screen position
    const x = (player.x - (scaledSpriteSize / 2)) - cameraPos.x + WIDTH / 2;
    const y = (player.y - (scaledSpriteSize / 2)) - cameraPos.y + HEIGHT / 2;

    // Render HP/spirit bars and name
    if (stealth < 1.5 && player.class !== 'Falcon' && !player.ghost) {
      const barX = (player.x - (tileSize / 2)) - cameraPos.x + WIDTH / 2;
      const barY = (player.y - (tileSize / 2)) - cameraPos.y + HEIGHT / 2;

      this.renderBars(player, { ctx, barX, barY, stealth });
      this.renderName(player, { ctx, barX, barY, allyCheck, kingdomList, houseList });
      this.renderStatus(player, { ctx, barX, barY, workingIcon, wrk });
    }

    // Apply stealth transparency
    this.applyStealth(stealth, ctx);
    
    // Render falcons using specialized method
    if (player.class === 'Falcon') {
      if (this.renderFalcon(player, { ctx, x, y, scaledSpriteSize, falcon })) {
        ctx.globalAlpha = 1.0;
        return; // Falcon rendered, don't fall through
      }
    }

    // Render sprite based on state
    // Work animations
    if (this.renderWorkAnimation(player, { ctx, x, y, spriteSize: player.spriteSize, wrk })) {
      ctx.globalAlpha = 1.0;
      return;
    }

    // Attack animations
    if (this.renderAttackAnimation(player, { ctx, x, y, scaledSpriteSize })) {
      ctx.globalAlpha = 1.0;
      return;
    }

    // Movement/idle sprites
    this.renderMovementSprite(player, { ctx, x, y, scaledSpriteSize, wlk });
    
    // Reset transparency
    ctx.globalAlpha = 1.0;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.PlayerRenderer = PlayerRenderer;
  // Create singleton instance for backward compatibility
  window.playerRenderer = new PlayerRenderer();
  // Also expose as static for direct method calls
  window.PlayerRenderer.render = function(player, config) {
    return window.playerRenderer.render(player, config);
  };
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlayerRenderer;
}
