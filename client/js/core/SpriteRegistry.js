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

    this.registry = {
      // Fauna
      'Falcon': {
        sprite: typeof window !== 'undefined' && window.falcon ? window.falcon : (typeof falcon !== 'undefined' ? falcon : null),
        spriteSize: tileSize * 7  // 448px
      },
      'Sheep': {
        sprite: typeof sheep !== 'undefined' ? sheep : null,
        spriteSize: tileSize * 1.5
      },
      'Deer': {
        sprite: typeof deer !== 'undefined' ? deer : null,
        spriteSize: tileSize * 1.5
      },
      'Boar': {
        sprite: typeof boar !== 'undefined' ? boar : null,
        spriteSize: tileSize * 1.5
      },
      'Wolf': {
        sprite: typeof wolf !== 'undefined' ? wolf : (typeof window !== 'undefined' && window.wolf ? window.wolf : null),
        spriteSize: tileSize * 1.5
      },

      // Ships
      'FishingShip': {
        sprite: typeof fishingship !== 'undefined' ? fishingship : null,
        spriteSize: tileSize * 2  // 128px
      },
      'CargoShip': {
        sprite: typeof cargoship !== 'undefined' ? cargoship : null,
        spriteSize: tileSize * 2.5  // 160px
      },

      // Serfs
      'Serf': {
        sprite: typeof maleserf !== 'undefined' ? maleserf : null,
        spriteSize: tileSize * 1.5  // 96px
      },
      'SerfM': {
        sprite: typeof maleserf !== 'undefined' ? maleserf : null,
        spriteSize: tileSize * 1.5  // 96px
      },
      'SerfF': {
        sprite: typeof femaleserf !== 'undefined' ? femaleserf : (typeof maleserf !== 'undefined' ? maleserf : null),
        spriteSize: tileSize * 1.5  // 96px
      },

      // Rogue/Hunter classes (tileSize * 1.5)
      'Rogue': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: tileSize * 1.5
      },
      'Trapper': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: tileSize * 1.5
      },
      'Cutthroat': {
        sprite: typeof rogue !== 'undefined' ? rogue : null,
        spriteSize: tileSize * 1.5
      },
      'Hunter': {
        sprite: typeof hunter !== 'undefined' ? hunter : null,
        spriteSize: tileSize * 1.5
      },
      'Outlaw': {
        sprite: typeof hunter !== 'undefined' ? hunter : null,
        spriteSize: tileSize * 1.5
      },
      'Poacher': {
        sprite: typeof poacher !== 'undefined' ? poacher : null,
        spriteSize: tileSize * 1.5
      },

      // Scout/Ranger classes (tileSize * 1.5)
      'Scout': {
        sprite: typeof scout !== 'undefined' ? scout : null,
        spriteSize: tileSize * 1.5
      },
      'Ranger': {
        sprite: typeof ranger !== 'undefined' ? ranger : null,
        spriteSize: tileSize * 1.5
      },
      'Warden': {
        sprite: typeof ranger !== 'undefined' ? ranger : null,
        spriteSize: tileSize * 1.5
      },

      // Military classes (tileSize * 1.5)
      'Swordsman': {
        sprite: typeof swordsman !== 'undefined' ? swordsman : null,
        spriteSize: tileSize * 1.5
      },
      'Archer': {
        sprite: typeof archer !== 'undefined' ? archer : null,
        spriteSize: tileSize * 1.5
      },
      'Horseman': {
        sprite: typeof horseman !== 'undefined' ? horseman : null,
        spriteSize: tileSize * 1.5
      },
      'MountedArcher': {
        sprite: typeof mountedarcher !== 'undefined' ? mountedarcher : null,
        spriteSize: tileSize * 1.5
      },
      'Hero': {
        sprite: typeof hero !== 'undefined' ? hero : null,
        spriteSize: tileSize * 1.5
      },
      'Footsoldier': {
        sprite: typeof footsoldier !== 'undefined' ? footsoldier : null,
        spriteSize: tileSize * 1.5
      },
      'Skirmisher': {
        sprite: typeof skirmisher !== 'undefined' ? skirmisher : null,
        spriteSize: tileSize * 1.5
      },
      'Cavalier': {
        sprite: typeof cavalier !== 'undefined' ? cavalier : null,
        spriteSize: tileSize * 1.5
      },

      // Knight classes (tileSize * 2)
      'Cavalry': {
        sprite: typeof cavalry !== 'undefined' ? cavalry : null,
        spriteSize: tileSize * 2
      },
      'Knight': {
        sprite: typeof knight !== 'undefined' ? knight : null,
        spriteSize: tileSize * 2
      },
      'Lancer': {
        sprite: typeof lancer !== 'undefined' ? lancer : null,
        spriteSize: tileSize * 2
      },
      'Charlemagne': {
        sprite: typeof lancer !== 'undefined' ? lancer : null,
        spriteSize: tileSize * 2
      },
      'Crusader': {
        sprite: typeof crusader !== 'undefined' ? crusader : null,
        spriteSize: tileSize * 2
      },
      'SwissGuard': {
        sprite: typeof footsoldier !== 'undefined' ? footsoldier : null,
        spriteSize: tileSize * 2
      },
      'Mangonel': {
        sprite: typeof mangonel !== 'undefined' ? mangonel : null,
        spriteSize: tileSize * 2
      },
      'Strongman': {
        sprite: typeof strongman !== 'undefined' ? strongman : null,
        spriteSize: tileSize * 2
      },

      // Templar classes (tileSize * 1.5)
      'Templar': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: tileSize * 1.5
      },
      'Hospitaller': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: tileSize * 1.5
      },
      'Hochmeister': {
        sprite: typeof templar !== 'undefined' ? templar : null,
        spriteSize: tileSize * 1.5
      },
      'ImperialKnight': {
        sprite: typeof teutonicknight !== 'undefined' ? teutonicknight : null,
        spriteSize: tileSize * 2
      },
      'TeutonicKnight': {
        sprite: typeof teutonicknight !== 'undefined' ? teutonicknight : null,
        spriteSize: tileSize * 2
      },

      // Clergy classes (tileSize * 1.5)
      'Priest': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: tileSize * 1.5
      },
      'Monk': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: tileSize * 1.5
      },
      'Prior': {
        sprite: typeof monk !== 'undefined' ? monk : null,
        spriteSize: tileSize * 1.5
      },
      'Bishop': {
        sprite: typeof bishop !== 'undefined' ? bishop : null,
        spriteSize: tileSize * 1.5
      },
      'Friar': {
        sprite: typeof friar !== 'undefined' ? friar : null,
        spriteSize: tileSize * 1.5
      },
      'Brother': {
        sprite: typeof warlock !== 'undefined' ? warlock : null,
        spriteSize: tileSize * 1.5
      },
      'Acolyte': {
        sprite: typeof mage !== 'undefined' ? mage : null,
        spriteSize: tileSize * 1.5
      },
      'Oathkeeper': {
        sprite: typeof archbishop !== 'undefined' ? archbishop : null,
        spriteSize: tileSize * 1.5
      },
      'Archbishop': {
        sprite: typeof archbishop !== 'undefined' ? archbishop : null,
        spriteSize: tileSize * 1.5
      },

      // Magic classes (tileSize * 1.5)
      'Mage': {
        sprite: typeof mage !== 'undefined' ? mage : null,
        spriteSize: tileSize * 1.5
      },
      'Warlock': {
        sprite: typeof warlock !== 'undefined' ? warlock : null,
        spriteSize: tileSize * 1.5
      },

      // Royalty classes (tileSize * 1.5)
      'King': {
        sprite: typeof king !== 'undefined' ? king : null,
        spriteSize: tileSize * 1.5
      },
      'Alaric': {
        sprite: typeof king !== 'undefined' ? king : null,
        spriteSize: tileSize * 1.5
      },
      'General': {
        sprite: typeof general !== 'undefined' ? general : null,
        spriteSize: tileSize * 1.5
      },

      // NPC classes (tileSize * 1.5)
      'Innkeeper': {
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
        spriteSize: tileSize * 1.5
      },
      'Shipwright': {
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
        spriteSize: tileSize * 1.5
      },
      'Blacksmith': {
        sprite: typeof innkeeper !== 'undefined' ? innkeeper : null,
        spriteSize: tileSize * 1.5
      },

      // Siege equipment
      'Trebuchet': {
        sprite: typeof trebuchet !== 'undefined' ? trebuchet : null,
        spriteSize: tileSize * 10  // 640px
      },
      'Malvoisin': {
        sprite: typeof malvoisin !== 'undefined' ? malvoisin : null,
        spriteSize: tileSize * 12  // 768px
      },

      // Special classes
      'Apparition': {
        sprite: typeof apparition !== 'undefined' ? apparition : null,
        spriteSize: tileSize * 1.5
      },

      // Norse classes (tileSize * 1.5)
      'Goth': {
        sprite: typeof goth !== 'undefined' ? goth : null,
        spriteSize: tileSize * 1.5
      },
      'NorseSword': {
        sprite: typeof goth !== 'undefined' ? goth : null,
        spriteSize: tileSize * 1.5
      },
      'NorseSpear': {
        sprite: typeof norsespear !== 'undefined' ? norsespear : null,
        spriteSize: tileSize * 1.5
      },
      'Huskarl': {
        sprite: typeof huskarl !== 'undefined' ? huskarl : null,
        spriteSize: tileSize * 1.5
      },
      'Headhunter': {
        sprite: typeof headhunter !== 'undefined' ? headhunter : null,
        spriteSize: tileSize * 1.5
      },
      'Seidr': {
        sprite: typeof seidr !== 'undefined' ? seidr : null,
        spriteSize: tileSize * 1.5
      },
      'HighPriestess': {
        sprite: typeof highpriestess !== 'undefined' ? highpriestess : null,
        spriteSize: tileSize * 1.5
      },
      'Druid': {
        sprite: typeof druid !== 'undefined' ? druid : null,
        spriteSize: tileSize * 1.5
      },
      'Morrigan': {
        sprite: typeof morrigan !== 'undefined' ? morrigan : null,
        spriteSize: tileSize * 1.5
      },
      'Gwenllian': {
        sprite: typeof gwenllian !== 'undefined' ? gwenllian : null,
        spriteSize: tileSize * 1.5
      },

      // Frank classes (tileSize * 1.5)
      'Cataphract': {
        sprite: typeof marauder !== 'undefined' ? marauder : null,
        spriteSize: tileSize * 1.5
      },
      'Carolingian': {
        sprite: typeof marauder !== 'undefined' ? marauder : null,
        spriteSize: tileSize * 1.5
      },
      'Marauder': {
        sprite: typeof marauder !== 'undefined' ? marauder : null,
        spriteSize: tileSize * 1.5
      },
      'FrankSword': {
        sprite: typeof franksword !== 'undefined' ? franksword : null,
        spriteSize: tileSize * 1.5
      },
      'FrankSpear': {
        sprite: typeof frankspear !== 'undefined' ? frankspear : null,
        spriteSize: tileSize * 1.5
      },
      'FrankBow': {
        sprite: typeof frankbow !== 'undefined' ? frankbow : null,
        spriteSize: tileSize * 1.5
      },

      // Teuton classes (tileSize * 1.5)
      'TeutonPike': {
        sprite: typeof teutonpike !== 'undefined' ? teutonpike : null,
        spriteSize: tileSize * 1.5
      },
      'TeutonBow': {
        sprite: typeof teutonbow !== 'undefined' ? teutonbow : null,
        spriteSize: tileSize * 1.5
      },

      // Celt classes (tileSize * 1.5)
      'CeltAxe': {
        sprite: typeof celtaxe !== 'undefined' ? celtaxe : null,
        spriteSize: tileSize * 1.5
      },
      'CeltSpear': {
        sprite: typeof celtspear !== 'undefined' ? celtspear : null,
        spriteSize: tileSize * 1.5
      },

      // Mercenary classes
      'Condottiere': {
        sprite: typeof condottiere !== 'undefined' ? condottiere : null,
        spriteSize: tileSize * 1.5
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