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

    // #region agent log
    const falconSprite = typeof window !== 'undefined' && window.falcon ? window.falcon : (typeof falcon !== 'undefined' ? falcon : null);
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpriteRegistry.js:initialize',message:'Falcon sprite lookup',data:{hasWindowFalcon:typeof window !== 'undefined' && !!window.falcon,hasFalconVar:typeof falcon !== 'undefined' && !!falcon,falconSpriteIsNull:falconSprite === null,falconSpriteType:typeof falconSprite,hasFalconProps:falconSprite && !!(falconSprite.falconflyd || falconSprite.falconflyu)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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
        spriteSize: 96
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
        spriteSize: 96
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
        sprite: typeof carolingian !== 'undefined' ? carolingian : null,
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
        spriteSize: 96
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
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
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
        spriteSize: 96
      },
      'Seidr': {
        sprite: typeof seidr !== 'undefined' ? seidr : null,
        spriteSize: 96
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
        spriteSize: 96
      },
      'Gwenllian': {
        sprite: typeof gwenllian !== 'undefined' ? gwenllian : null,
        spriteSize: 96
      },

      'FrankSword': {
        sprite: typeof franksword !== 'undefined' ? franksword : null,
        spriteSize: 96
      },
      'FrankSpear': {
        sprite: typeof frankspear !== 'undefined' ? frankspear : null,
        spriteSize: 96
      },
      'FrankBow': {
        sprite: typeof frankbow !== 'undefined' ? frankbow : null,
        spriteSize: 96
      },

      // Teuton classes (96px)
      'TeutonPike': {
        sprite: typeof teutonpike !== 'undefined' ? teutonpike : null,
        spriteSize: 96
      },
      'TeutonBow': {
        sprite: typeof teutonbow !== 'undefined' ? teutonbow : null,
        spriteSize: 96
      },

      // Celt classes (tileSize * 1.5)
      'CeltAxe': {
        sprite: typeof celtaxe !== 'undefined' ? celtaxe : null,
        spriteSize: 96
      },
      'CeltSpear': {
        sprite: typeof celtspear !== 'undefined' ? celtspear : null,
        spriteSize: 96
      },

      // Mercenary classes
      'Condottiere': {
        sprite: typeof condottiere !== 'undefined' ? condottiere : null,
        spriteSize: 96
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
    if (isGhost && typeof ghost !== 'undefined') {
      const data = this.registry[entityClass];
      if (data) {
        return { sprite: ghost, spriteSize: data.spriteSize };
      }
      return null;
    }

    // Normal lookup
    const data = this.registry[entityClass];
    
    // #region agent log
    if (entityClass === 'Falcon') {
      const spriteIsNull = !data || !data.sprite;
      const spriteType = data && data.sprite ? typeof data.sprite : 'null';
      const isFalconSprite = data && data.sprite && !!(data.sprite.falconflyd || data.sprite.falconflyu);
      const isSerfSprite = data && data.sprite && !!(data.sprite.facedown && !data.sprite.falconflyd);
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SpriteRegistry.js:getSpriteData',message:'Falcon sprite lookup result',data:{hasData:!!data,spriteIsNull,dataSpriteType:spriteType,isFalconSprite,isSerfSprite,registryHasFalcon:!!this.registry['Falcon']},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    
    if (!data || !data.sprite) {
      return null;
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
