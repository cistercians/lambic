/**
 * SpriteRegistry - Hard-coded sprite and size mappings per entity class
 * This is the SINGLE SOURCE OF TRUTH for sprite assignments
 * 
 * All sprite sizes match server-side definitions in server/js/Entity.js
 */

class SpriteRegistry {
  constructor() {
    // Will be populated after images load
    this.registry = {};
  }

  /**
   * Initialize registry after images are loaded
   * Called once from imgloader.js after all sprites are available
   * @param {number} tileSize - Tile size in pixels (typically 64)
   */
  initialize(tileSize) {
    if (typeof tileSize === 'undefined' || tileSize === null) {
      console.error('SpriteRegistry.initialize called without tileSize');
      tileSize = 64; // Fallback
    }

    // Get falcon sprite - try multiple sources to ensure it's always available
    // CRITICAL: window.falcon should always be available after imgloader.js loads,
    // but we check multiple sources for robustness
    let falconSprite = null;
    
    // First, try to preserve existing registry entry if reinitializing (prevents losing valid sprite)
    if (this.registry && this.registry['Falcon'] && this.registry['Falcon'].sprite) {
      const existingSprite = this.registry['Falcon'].sprite;
      // Validate existing sprite is actually a falcon sprite (falcons have null attack properties)
      const hasNullAttacks = existingSprite && existingSprite.attackd === null && existingSprite.attacku === null && 
                            existingSprite.attackl === null && existingSprite.attackr === null;
      const hasBasicStructure = existingSprite && (existingSprite.facedown || existingSprite.faceup || existingSprite.faceleft || existingSprite.faceright);
      if (hasNullAttacks && hasBasicStructure) {
        falconSprite = existingSprite;
      }
    }
    
    // If we don't have a valid falcon sprite yet, try window.falcon
    if (!falconSprite && typeof window !== 'undefined' && window.falcon) {
      falconSprite = window.falcon;
    } else if (!falconSprite && typeof falcon !== 'undefined' && falcon) {
      // Fallback to module-scope variable (from imgloader.js if in same scope)
      falconSprite = falcon;
    }
    
    // Validate falcon sprite is actually a falcon sprite (only if we have one)
    // CRITICAL: This prevents accidentally using a serf sprite or other wrong sprite
    // Falcons have null attack properties (attackd, attacku, attackl, attackr are all null)
    // Serfs have non-null attack properties (they have attack animation Image objects)
    if (falconSprite) {
      // Check if it has the basic structure (facedown, etc.)
      const hasBasicStructure = falconSprite.facedown || falconSprite.faceup || falconSprite.faceleft || falconSprite.faceright;
      
      // Only validate if we have basic structure - if not, it's definitely invalid
      if (!hasBasicStructure) {
        console.error('SpriteRegistry: Invalid falcon sprite detected (missing basic sprite structure like facedown/faceup). Setting to null.');
        falconSprite = null;
      } else {
        // Falcons have null attack properties - this is the key differentiator from serfs
        // Check if attack properties exist and are non-null (indicating it's a serf sprite)
        const hasAttackAnimations = falconSprite.attackd || falconSprite.attacku || falconSprite.attackl || falconSprite.attackr;
        if (hasAttackAnimations) {
          console.error('SpriteRegistry: Invalid falcon sprite detected (has attack properties, likely a serf sprite). Falcons should have null attack properties. Setting to null to prevent incorrect rendering.');
          falconSprite = null;
        }
        // If attack properties are null (or undefined), it's likely a valid falcon sprite
      }
    }
    
    // Warn if falcon sprite is still null after all attempts
    if (!falconSprite) {
      console.warn('SpriteRegistry: Could not find valid falcon sprite. Falcon entities may not render correctly until window.falcon is available.');
    }

    this.registry = {
      // Fauna
      'Falcon': {
        sprite: falconSprite,
        spriteSize: 448
      },
      'Sheep': {
        sprite: typeof sheep !== 'undefined' ? sheep : null,
        spriteSize: 64
      },
      'Deer': {
        sprite: typeof deer !== 'undefined' ? deer : null,
        spriteSize: 64
      },
      'Boar': {
        sprite: typeof boar !== 'undefined' ? boar : null,
        spriteSize: 64
      },
      'Wolf': {
        sprite: typeof wolf !== 'undefined' ? wolf : (typeof window !== 'undefined' && window.wolf ? window.wolf : null),
        spriteSize: 64
      },

      // Ships
      'FishingShip': {
        sprite: typeof fishingship !== 'undefined' ? fishingship : null,
        spriteSize: 128
      },
      'CargoShip': {
        sprite: typeof cargoship !== 'undefined' ? cargoship : null,
        spriteSize: 160
      },

      // Serfs
      'Serf': {
        sprite: typeof maleserf !== 'undefined' ? maleserf : null,
        spriteSize: 96
      },
      'SerfM': {
        sprite: typeof maleserf !== 'undefined' ? maleserf : null,
        spriteSize: 96
      },
      'SerfF': {
        sprite: typeof femaleserf !== 'undefined' ? femaleserf : (typeof maleserf !== 'undefined' ? maleserf : null),
        spriteSize: 96
      },

      // Rogue/Hunter classes (96px)
      'Rogue': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: 96
      },
      'Trapper': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: 96
      },
      'Cutthroat': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: 96
      },
      'Hunter': {
        sprite: typeof hunter !== 'undefined' ? hunter : null,
        spriteSize: 96
      },
      'Outlaw': {
        sprite: typeof hunter !== 'undefined' ? hunter : null,
        spriteSize: 96
      },
      'Poacher': {
        sprite: typeof poacher !== 'undefined' ? poacher : null,
        spriteSize: 128  // tileSize * 2
      },

      // Scout/Ranger classes (96px)
      'Scout': {
        sprite: typeof scout !== 'undefined' ? scout : null,
        spriteSize: 96
      },
      'Ranger': {
        sprite: typeof ranger !== 'undefined' ? ranger : null,
        spriteSize: 96
      },
      'Warden': {
        sprite: typeof ranger !== 'undefined' ? ranger : null,
        spriteSize: 128  // tileSize * 2
      },

      // Military classes (96px)
      'Swordsman': {
        sprite: typeof swordsman !== 'undefined' ? swordsman : null,
        spriteSize: 96
      },
      'Archer': {
        sprite: typeof archer !== 'undefined' ? archer : null,
        spriteSize: 96
      },
      'Horseman': {
        sprite: typeof horseman !== 'undefined' ? horseman : null,
        spriteSize: 96
      },
      'MountedArcher': {
        sprite: typeof mountedarcher !== 'undefined' ? mountedarcher : null,
        spriteSize: 96
      },
      'Hero': {
        sprite: typeof hero !== 'undefined' ? hero : null,
        spriteSize: 96
      },
      'Footsoldier': {
        sprite: typeof footsoldier !== 'undefined' ? footsoldier : null,
        spriteSize: 96
      },
      'Skirmisher': {
        sprite: typeof skirmisher !== 'undefined' ? skirmisher : null,
        spriteSize: 96
      },
      'Cavalier': {
        sprite: typeof cavalier !== 'undefined' ? cavalier : null,
        spriteSize: 96
      },

      // Knight classes (128px)
      'Cavalry': {
        sprite: typeof cavalry !== 'undefined' ? cavalry : null,
        spriteSize: 128
      },
      'Knight': {
        sprite: typeof knight !== 'undefined' ? knight : null,
        spriteSize: 128
      },
      'Lancer': {
        sprite: typeof lancer !== 'undefined' ? lancer : null,
        spriteSize: 128
      },
      'Crusader': {
        sprite: typeof crusader !== 'undefined' ? crusader : null,
        spriteSize: 128
      },
      'SwissGuard': {
        sprite: typeof footsoldier !== 'undefined' ? footsoldier : null,
        spriteSize: 128
      },
      'Mangonel': {
        sprite: typeof mangonel !== 'undefined' ? mangonel : null,
        spriteSize: 128
      },
      'Strongman': {
        sprite: typeof strongman !== 'undefined' ? strongman : null,
        spriteSize: 128
      },

      // Templar classes (96px)
      'Templar': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: 96
      },
      'Hospitaller': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: 96
      },
      'Hochmeister': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: 96
      },
      // Classes that use 192px (3x)
      'Charlemagne': {
        sprite: typeof lancer !== 'undefined' ? lancer : null,
        spriteSize: 192
      },
      'ImperialKnight': {
        sprite: typeof teutonicknight !== 'undefined' ? teutonicknight : null,
        spriteSize: 192
      },
      'TeutonicKnight': {
        sprite: typeof teutonicknight !== 'undefined' ? teutonicknight : null,
        spriteSize: 192
      },
      'Cataphract': {
        sprite: typeof cataphract !== 'undefined' ? cataphract : null,
        spriteSize: 192
      },
      'Carolingian': {
        sprite: typeof marauder !== 'undefined' ? marauder : null,
        spriteSize: 192
      },
      'Marauder': {
        sprite: typeof marauder !== 'undefined' ? marauder : null,
        spriteSize: 192
      },

      // Clergy classes (tileSize * 1.5)
      'Priest': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: 96
      },
      'Monk': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: 96
      },
      'Prior': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: 96
      },
      'Bishop': {
        sprite: typeof bishop !== 'undefined' ? bishop : null,
        spriteSize: 96
      },
      'Friar': {
        sprite: typeof friar !== 'undefined' ? friar : null,
        spriteSize: 96
      },
      'Brother': {
        sprite: typeof warlock !== 'undefined' ? warlock : null,
        spriteSize: 96
      },
      'Acolyte': {
        sprite: typeof mage !== 'undefined' ? mage : null,
        spriteSize: 96
      },
      'Oathkeeper': {
        sprite: typeof archbishop !== 'undefined' ? archbishop : null,
        spriteSize: 96
      },
      'Archbishop': {
        sprite: typeof archbishop !== 'undefined' ? archbishop : null,
        spriteSize: 96
      },

      // Magic classes (tileSize * 1.5)
      'Mage': {
        sprite: typeof mage !== 'undefined' ? mage : null,
        spriteSize: 96
      },
      'Warlock': {
        sprite: typeof warlock !== 'undefined' ? warlock : null,
        spriteSize: 96
      },

      // Royalty classes (tileSize * 1.5)
      'King': {
        sprite: typeof king !== 'undefined' ? king : null,
        spriteSize: 96
      },
      'Alaric': {
        sprite: typeof king !== 'undefined' ? king : null,
        spriteSize: 96
      },
      'General': {
        sprite: typeof general !== 'undefined' ? general : null,
        spriteSize: 128  // tileSize * 2
      },

      // NPC classes (tileSize * 1.5)
      'Innkeeper': {
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
        spriteSize: 96
      },
      'Shipwright': {
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
        spriteSize: 96
      },
      'Blacksmith': {
        sprite: typeof maleserf !== 'undefined' ? maleserf : null,
        spriteSize: 96
      },

      // Siege equipment
      'Trebuchet': {
        sprite: typeof trebuchet !== 'undefined' ? trebuchet : null,
        spriteSize: 640
      },
      'Malvoisin': {
        sprite: typeof malvoisin !== 'undefined' ? malvoisin : null,
        spriteSize: 768
      },

      // Special classes
      'Apparition': {
        sprite: typeof apparition !== 'undefined' ? apparition : null,
        spriteSize: 96
      },

      // Norse classes (tileSize * 1.5)
      'Goth': {
        sprite: typeof goth !== 'undefined' ? goth : null,
        spriteSize: 96
      },
      'NorseSword': {
        sprite: typeof goth !== 'undefined' ? goth : null,
        spriteSize: 96
      },
      'NorseSpear': {
        sprite: typeof norsespear !== 'undefined' ? norsespear : null,
        spriteSize: 96
      },
      'Huskarl': {
        sprite: typeof huskarl !== 'undefined' ? huskarl : null,
        spriteSize: 96
      },
      'Headhunter': {
        sprite: typeof headhunter !== 'undefined' ? headhunter : null,
        spriteSize: 128  // tileSize * 2
      },
      'Seidr': {
        sprite: typeof seidr !== 'undefined' ? seidr : null,
        spriteSize: 64
      },
      'HighPriestess': {
        sprite: typeof highpriestess !== 'undefined' ? highpriestess : null,
        spriteSize: 96
      },
      'Druid': {
        sprite: typeof druid !== 'undefined' ? druid : null,
        spriteSize: 96
      },
      'Morrigan': {
        sprite: typeof morrigan !== 'undefined' ? morrigan : null,
        spriteSize: 128  // tileSize * 2
      },
      'Gwenllian': {
        sprite: typeof gwenllian !== 'undefined' ? gwenllian : null,
        spriteSize: 64
      },

      'FrankSword': {
        sprite: typeof franksword !== 'undefined' ? franksword : null,
        spriteSize: 64
      },
      'FrankSpear': {
        sprite: typeof frankspear !== 'undefined' ? frankspear : null,
        spriteSize: 128
      },
      'FrankBow': {
        sprite: typeof frankbow !== 'undefined' ? frankbow : null,
        spriteSize: 96
      },

      // Teuton classes
      'TeutonPike': {
        sprite: typeof teutonpike !== 'undefined' ? teutonpike : null,
        spriteSize: 128  // tileSize * 2
      },
      'TeutonBow': {
        sprite: typeof teutonbow !== 'undefined' ? teutonbow : null,
        spriteSize: 96
      },

      // Celt classes
      'CeltAxe': {
        sprite: typeof celtaxe !== 'undefined' ? celtaxe : null,
        spriteSize: 96  // tileSize * 1.5
      },
      'CeltSpear': {
        sprite: typeof celtspear !== 'undefined' ? celtspear : null,
        spriteSize: 128  // tileSize * 2
      },

      // Mercenary classes
      'Condottiere': {
        sprite: typeof condottiere !== 'undefined' ? condottiere : null,
        spriteSize: 128  // tileSize * 2
      }
    };
  }

  /**
   * Get sprite and size for entity class
   * Returns null if class not found (fail fast)
   * @param {string} entityClass - Entity class name
   * @param {boolean} isGhost - Is entity in ghost mode?
   * @returns {object|null} { sprite, spriteSize } or null
   */
  getSpriteData(entityClass, isGhost) {
    if (!entityClass) {
      return null;
    }

    // Ghost mode - use ghost sprite, size from registry
    if (isGhost) {
      // Try multiple sources for ghost sprite (similar to falcon/wolf handling)
      let ghostSprite = null;
      if (typeof ghost !== 'undefined') {
        ghostSprite = ghost;
      } else if (typeof window !== 'undefined' && window.ghost) {
        ghostSprite = window.ghost;
      }
      
      if (ghostSprite) {
        const data = this.registry[entityClass];
        if (data) {
          return { sprite: ghostSprite, spriteSize: data.spriteSize };
        }
      }
      return null;
    }

    // Normal lookup
    const data = this.registry[entityClass];
    
    if (!data || !data.sprite) {
      return null;
    }

    // CRITICAL: Validate sprite matches entity class to prevent wrong sprites being assigned
    // For Falcon class, ensure the sprite is actually a falcon sprite
    // Falcons have null attack properties (unlike serfs which have attack animations)
    if (entityClass === 'Falcon') {
      const sprite = data.sprite;
      if (!sprite) {
        return null; // Already handled above, but be safe
      }
      
      // Check if it's likely a serf sprite (has non-null attack properties)
      // Falcons have attackd, attacku, attackl, attackr all set to null
      // Serfs have actual attack animation objects
      const hasAttackAnimations = sprite.attackd || sprite.attacku || sprite.attackl || sprite.attackr;
      
      if (hasAttackAnimations) {
        console.error(`CRITICAL: SpriteRegistry returned sprite with attack animations for Falcon class (likely a serf sprite)! This is a bug. Returning null instead.`);
        return null;
      }
      
      // Verify it has basic sprite structure (should have facedown, faceup, etc.)
      const hasBasicStructure = sprite.facedown || sprite.faceup || sprite.faceleft || sprite.faceright;
      if (!hasBasicStructure) {
        console.error(`CRITICAL: SpriteRegistry returned invalid sprite for Falcon class (missing basic sprite structure). Returning null instead.`);
        return null;
      }
    }
    
    // For Boar and Wolf, validate they have the correct sprite structure
    // Boars and Wolves have attack animations (they're aggressive fauna), but we need to ensure
    // we're not accidentally using a serf sprite
    if (entityClass === 'Boar' || entityClass === 'Wolf') {
      const sprite = data.sprite;
      if (!sprite) {
        return null;
      }
      
      // Verify it has basic sprite structure (should have facedown, faceup, etc.)
      const hasBasicStructure = sprite.facedown || sprite.faceup || sprite.faceleft || sprite.faceright;
      if (!hasBasicStructure) {
        console.error(`CRITICAL: SpriteRegistry returned invalid sprite for ${entityClass} class (missing basic sprite structure). Returning null instead.`);
        return null;
      }
      
      // Boars and Wolves should have attack animations (they're aggressive)
      // But we can't easily distinguish between a boar/wolf sprite and a serf sprite
      // by attack animations alone. Instead, we rely on the registry lookup being correct.
      // If the sprite is in the registry for this class, it should be the correct one.
    }

    return {
      sprite: data.sprite,
      spriteSize: data.spriteSize
    };
  }

  /**
   * Validate that sprite matches class (safety check)
   * @param {string} entityClass - Entity class name
   * @param {object} sprite - Sprite object to validate
   * @returns {boolean} True if sprite matches class
   */
  validateSprite(entityClass, sprite) {
    if (!entityClass || !sprite) {
      return false;
    }

    const data = this.registry[entityClass];
    if (!data) {
      return false;
    }

    // Identity check - must be exact same object
    return data.sprite === sprite;
  }

  /**
   * Get sprite size for a class (without sprite object)
   * @param {string} entityClass - Entity class name
   * @returns {number|null} Sprite size in pixels or null
   */
  getSpriteSize(entityClass) {
    if (!entityClass) {
      return null;
    }

    const data = this.registry[entityClass];
    return data ? data.spriteSize : null;
  }
}

// Expose to global scope for browser
if (typeof window !== 'undefined') {
  window.SpriteRegistry = SpriteRegistry;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpriteRegistry;
}
