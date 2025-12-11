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
  // For falcons, only set sprite if it's actually loaded (not null)
  // This prevents falcons from getting wrong sprites before images load
  if (self.class === 'Falcon') {
    var falconSprite = getSpriteForClass(self.class, self.ghost);
    self.sprite = falconSprite || null; // Explicitly set to null if not loaded
    // Defensive check: if sprite was somehow set to maleserf, clear it
    if (self.sprite && typeof maleserf !== 'undefined' && self.sprite === maleserf) {
      console.warn('PlayerEntity: Falcon sprite was set to maleserf - clearing it');
      self.sprite = null;
    }
  } else {
    self.sprite = getSpriteForClass(self.class, self.ghost); // Use correct sprite based on class
  }
  self.spriteSize = initPack.spriteSize || 64; // Default to 64 if not provided
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
  // Use PlayerRenderer.render() instead
  self.draw = function() {
    if (typeof PlayerRenderer !== 'undefined' && PlayerRenderer.render) {
      // Falcons now work like other NPCs - no special handling needed
      // The sprite is set on the entity, and PlayerRenderer handles rendering
      return PlayerRenderer.render(self, {
        ctx: ctx,
        Img: Img,
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
    // Legacy fallback - keep minimal implementation for backward compatibility
    if (!self.sprite) {
      return;
    }
    
    // God mode: Hide the player's own character
    if (godModeCamera.isActive && self.id === selfId) {
      return;
    }
    
    // Spectate mode: Hide spectator characters
    if (spectateCameraSystem.isActive && self.type === 'spectator') {
      return;
    }
    
    // Phase 2: Ghost Invisibility - Don't render other players' ghosts
    if (self.ghost && self.id !== selfId) {
      return; // Other players' ghosts are invisible
    }
    
    // Don't render players who are boarded on ships
    if (self.isBoarded) {
      return;
    }
    
    var stealth = stealthCheck(self.id);
    
    // Get camera position (works for both logged in and login mode)
    var cameraPos = getCameraPosition();

    // Phase 6: Apply sprite scaling ONLY for fauna minibosses (Wolf, Boar)
    var shouldScale = (self.class === 'Wolf' || self.class === 'Boar') && self.spriteScale;
    var scaledSpriteSize = shouldScale ? (self.spriteSize * self.spriteScale) : self.spriteSize;
    
    // Center the sprite based on scaled size
    var x = (self.x - (scaledSpriteSize / 2)) - cameraPos.x + WIDTH / 2;
    var y = (self.y - (scaledSpriteSize / 2)) - cameraPos.y + HEIGHT / 2;

    // hp and spirit bars (skip for non-combatant creatures and ghosts)
    if (stealth < 1.5 && self.class !== 'Falcon' && !self.ghost) {
      var barX = (self.x - (tileSize / 2)) - cameraPos.x + WIDTH / 2;
      var barY = (self.y - (tileSize / 2)) - cameraPos.y + HEIGHT / 2;

      var hpWidth = 60 * self.hp / self.hpMax;
      var spiritWidth = null;
      var brWidth = 60 * self.breath / self.breathMax;
      if (self.spirit) {
        spiritWidth = 60 * self.spirit / self.spiritMax;
      }

      if (self.hp) {
        ctx.fillStyle = 'orangered';
        ctx.fillRect(barX, barY - 30, 60, 6);
        ctx.fillStyle = 'limegreen';
        ctx.fillRect(barX, barY - 30, hpWidth, 6);
      }
      if (self.spirit) {
        ctx.fillStyle = 'orangered';
        ctx.fillRect(barX, barY - 20, 60, 4);
        ctx.fillStyle = 'royalblue';
        ctx.fillRect(barX, barY - 20, spiritWidth, 4);
      }
      if (self.z == -3) {
        ctx.fillStyle = 'azure';
        ctx.fillRect(barX, barY - 30, brWidth, 6);
      }

      // username
      if (self.rank) {
        var allied = allyCheck(self.id);
        if (self.kingdom && kingdomList && kingdomList[self.kingdom]) {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          // Serfs don't get flag emoji, only players and military
          var isSerf = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
          var flagDisplay = (!isSerf && kingdomList[self.kingdom].flag) ? kingdomList[self.kingdom].flag + ' ' : '';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + flagDisplay + self.rank + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        } else if (self.house && houseList && houseList[self.house]) {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          // Serfs don't get flag emoji, only players and military
          var isSerf = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
          var flagDisplay = (!isSerf && houseList[self.house].flag) ? houseList[self.house].flag + ' ' : '';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + flagDisplay + self.rank + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        } else {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + self.rank + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        }
      } else if (self.name) {
        var allied = allyCheck(self.id);
        if (self.kingdom && kingdomList && kingdomList[self.kingdom]) {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          // Serfs don't get flag emoji, only players and military
          var isSerf = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
          var flagDisplay = (!isSerf && kingdomList[self.kingdom].flag) ? kingdomList[self.kingdom].flag + ' ' : '';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + flagDisplay + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        } else if (self.house && houseList && houseList[self.house]) {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          // Serfs don't get flag emoji, only players and military
          var isSerf = (self.class === 'Serf' || self.class === 'SerfM' || self.class === 'SerfF');
          var flagDisplay = (!isSerf && houseList[self.house].flag) ? houseList[self.house].flag + ' ' : '';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + flagDisplay + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        } else {
          if (allied == 2) {
            ctx.fillStyle = 'lightskyblue';
          } else if (allied == 1) {
            ctx.fillStyle = 'palegreen';
          } else if (allied == 0) {
            ctx.fillStyle = 'white';
          } else if (allied == -1) {
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + self.name;
          ctx.fillText(displayName, barX + 30, barY - 40, 100);
        }
      }
      
      // Phase 5 & 6: Display skulls for fauna minibosses (above HP bar)
      if (self.skulls && !self.name) {
        ctx.font = '20px minion web';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(self.skulls, barX + 30, barY - 45);
      }

      // status
      if (self.working) {
        ctx.fillText(workingIcon[wrk], barX + 80, barY - 20);
      } else if (self.revealed) {
        ctx.fillText('👁️', barX + 80, barY - 20);
      } else if (self.action == 'combat') {
        ctx.fillText('⚔️', barX + 80, barY - 20)
      }
      
      // Speech bubble for NPCs
      if (self.speechBubble) {
        ctx.font = '20px minion web';
        ctx.fillStyle = 'white';
        ctx.fillText('💬', barX + 80, barY - 40);
      }
    }

    // Apply transparency based on stealth level
    if (stealth == 2) { // fully stealthed to enemies
      ctx.globalAlpha = 0.3; // 30% visible (maximum transparency)
    } else if (stealth == 1.5) { // revealed to enemies
      ctx.globalAlpha = 0.7; // 70% visible (minimal transparency)
    } else if (stealth == 1) { // self-view or ally-view
      ctx.globalAlpha = 0.7; // 70% visible (minimal transparency)
    } else { // not stealthed
      ctx.globalAlpha = 1.0; // fully visible
    }
    
    // Legacy fallback rendering (only used if PlayerRenderer not available)
    // For falcons, don't render if sprite is maleserf or null
    if (self.class === 'Falcon') {
      // Check if sprite is maleserf (wrong fallback) - don't render
      if (self.sprite && typeof maleserf !== 'undefined' && self.sprite === maleserf) {
        ctx.globalAlpha = 1.0;
        return; // Don't render falcons with wrong sprite
      }
      // If sprite is null, don't render
      if (!self.sprite) {
        ctx.globalAlpha = 1.0;
        return;
      }
    }
    // Work animations (chopping, mining, farming, building, fishing) - use normal size for humans
    if (self.chopping && self.sprite && self.sprite.chopping) {
      safeDrawImage(
        self.sprite.chopping[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if (self.mining && self.sprite.mining) {
      safeDrawImage(
        self.sprite.mining[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if (self.farming && self.sprite.farming) {
      safeDrawImage(
        self.sprite.farming[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if (self.building && self.sprite.building) {
      safeDrawImage(
        self.sprite.building[wrk],
        x,
        y,
        self.spriteSize,
        self.spriteSize
      );
    } else if (self.fishing && self.sprite.fishingd) {
      // Fishing has directional sprites
      if (self.facing == 'down') {
        safeDrawImage(self.sprite.fishingd, x, y, self.spriteSize, self.spriteSize);
      } else if (self.facing == 'up') {
        safeDrawImage(self.sprite.fishingu, x, y, self.spriteSize, self.spriteSize);
      } else if (self.facing == 'left') {
        safeDrawImage(self.sprite.fishingl, x, y, self.spriteSize, self.spriteSize);
      } else if (self.facing == 'right') {
        safeDrawImage(self.sprite.fishingr, x, y, self.spriteSize, self.spriteSize);
      }
    } else if (self.pressingAttack) {
      if ((self.gear.weapon && self.gear.weapon.type == 'bow') || self.ranged) {
        if (self.angle > 45 && self.angle <= 115) {
          safeDrawImage(
            self.sprite.attackdb,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.angle > -135 && self.angle <= -15) {
          safeDrawImage(
            self.sprite.attackub,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.angle > 115 || self.angle <= -135) {
          safeDrawImage(
            self.sprite.attacklb,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.angle > -15 || self.angle <= 45) {
          safeDrawImage(
            self.sprite.attackrb,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        }
      } else {
        if (self.facing == 'down') {
          safeDrawImage(
            self.sprite.attackd,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.facing == 'up') {
          safeDrawImage(
            self.sprite.attacku,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.facing == 'left') {
          safeDrawImage(
            self.sprite.attackl,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        } else if (self.facing == 'right') {
          safeDrawImage(
            self.sprite.attackr,
            x,
            y,
            scaledSpriteSize,
            scaledSpriteSize
          );
        }
      }
    } else if (self.pressingAttack && self.type == 'npc') {
      if (self.facing == 'down') {
        safeDrawImage(
          self.sprite.attackd,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if (self.facing == 'up') {
        safeDrawImage(
          self.sprite.attacku,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if (self.facing == 'left') {
        safeDrawImage(
          self.sprite.attackl,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      } else if (self.facing == 'right') {
        safeDrawImage(
          self.sprite.attackr,
          x,
          y,
          self.spriteSize,
          self.spriteSize
        );
      }
    } else {
      // Other entities: Use pressing flags for animation, facing for idle
      if (self.facing == 'down' && !self.pressingDown) {
        safeDrawImage(
          self.sprite.facedown,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.pressingDown) {
        safeDrawImage(
          self.sprite.walkdown[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.facing == 'up' && !self.pressingUp) {
        safeDrawImage(
          self.sprite.faceup,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.pressingUp) {
        safeDrawImage(
          self.sprite.walkup[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.facing == 'left' && !self.pressingLeft) {
        safeDrawImage(
          self.sprite.faceleft,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.pressingLeft) {
        safeDrawImage(
          self.sprite.walkleft[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.facing == 'right' && !self.pressingRight) {
        safeDrawImage(
          self.sprite.faceright,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if (self.pressingRight) {
        safeDrawImage(
          self.sprite.walkright[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      }
    }
    
    // Reset transparency
    ctx.globalAlpha = 1.0;
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
