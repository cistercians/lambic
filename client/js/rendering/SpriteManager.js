/**
 * SpriteManager - Centralized sprite management
 * 
 * Handles sprite lookup, caching, and sprite-to-entity mapping.
 * Separates sprite logic from rendering and game state.
 */

class SpriteManager {
  constructor() {
    this.spriteMap = null;
    this.initialized = false;
  }

  /**
   * Initialize sprite manager
   * Must be called after sprites are loaded
   */
  init() {
    if (this.initialized) {
      return;
    }

    this.buildSpriteMap();
    this.initialized = true;
  }

  /**
   * Build sprite lookup map
   * Creates O(1) lookup instead of 125+ if-else comparisons
   */
  buildSpriteMap() {
    // Safety check
    if (typeof maleserf === 'undefined') {
      console.warn('[SpriteManager] Sprites not loaded yet');
      return;
    }

    // Build sprite map with safe fallbacks
    this.spriteMap = {
      'ghost': typeof ghost !== 'undefined' ? ghost : maleserf,
      'Sheep': typeof sheep !== 'undefined' ? sheep : maleserf,
      'Deer': typeof deer !== 'undefined' ? deer : maleserf,
      'Boar': typeof boar !== 'undefined' ? boar : maleserf,
      'Wolf': typeof wolf !== 'undefined' ? wolf : maleserf,
      'Falcon': typeof falcon !== 'undefined' ? falcon : null,
      'FishingShip': typeof fishingship !== 'undefined' ? fishingship : maleserf,
      'CargoShip': typeof cargoship !== 'undefined' ? cargoship : maleserf,
      'Serf': maleserf,
      'SerfM': maleserf,
      'SerfF': typeof femaleserf !== 'undefined' ? femaleserf : maleserf,
      'Rogue': typeof rogue !== 'undefined' ? rogue : maleserf,
      'Trapper': typeof rogue !== 'undefined' ? rogue : maleserf,
      'Cutthroat': typeof rogue !== 'undefined' ? rogue : maleserf,
      'Hunter': typeof hunter !== 'undefined' ? hunter : maleserf,
      'Outlaw': typeof hunter !== 'undefined' ? hunter : maleserf,
      'Scout': typeof scout !== 'undefined' ? scout : maleserf,
      'Ranger': typeof ranger !== 'undefined' ? ranger : maleserf,
      'Warden': typeof ranger !== 'undefined' ? ranger : maleserf,
      'Swordsman': typeof swordsman !== 'undefined' ? swordsman : maleserf,
      'Archer': typeof archer !== 'undefined' ? archer : maleserf,
      'Horseman': typeof horseman !== 'undefined' ? horseman : maleserf,
      'MountedArcher': typeof mountedarcher !== 'undefined' ? mountedarcher : maleserf,
      'Hero': typeof hero !== 'undefined' ? hero : maleserf,
      'Templar': typeof templar !== 'undefined' ? templar : maleserf,
      'Hospitaller': typeof templar !== 'undefined' ? templar : maleserf,
      'Hochmeister': typeof templar !== 'undefined' ? templar : maleserf,
      'Cavalry': typeof cavalry !== 'undefined' ? cavalry : maleserf,
      'Knight': typeof knight !== 'undefined' ? knight : maleserf,
      'Lancer': typeof lancer !== 'undefined' ? lancer : maleserf,
      'Charlemagne': typeof lancer !== 'undefined' ? lancer : maleserf,
      'Crusader': typeof crusader !== 'undefined' ? crusader : maleserf,
      'Priest': typeof monk !== 'undefined' ? monk : maleserf,
      'Monk': typeof monk !== 'undefined' ? monk : maleserf,
      'Prior': typeof monk !== 'undefined' ? monk : maleserf,
      'Mage': typeof mage !== 'undefined' ? mage : maleserf,
      'Acolyte': typeof mage !== 'undefined' ? mage : maleserf,
      'Warlock': typeof warlock !== 'undefined' ? warlock : maleserf,
      'Brother': typeof warlock !== 'undefined' ? warlock : maleserf,
      'King': typeof king !== 'undefined' ? king : maleserf,
      'Alaric': typeof king !== 'undefined' ? king : maleserf,
      'Innkeeper': typeof innkeeper !== 'undefined' ? innkeeper : maleserf,
      'Shipwright': typeof innkeeper !== 'undefined' ? innkeeper : maleserf,
      'Bishop': typeof bishop !== 'undefined' ? bishop : maleserf,
      'Friar': typeof friar !== 'undefined' ? friar : maleserf,
      'Footsoldier': typeof footsoldier !== 'undefined' ? footsoldier : maleserf,
      'Skirmisher': typeof skirmisher !== 'undefined' ? skirmisher : maleserf,
      'Cavalier': typeof cavalier !== 'undefined' ? cavalier : maleserf,
      'General': typeof general !== 'undefined' ? general : maleserf,
      'ImperialKnight': typeof teutonicknight !== 'undefined' ? teutonicknight : maleserf,
      'TeutonicKnight': typeof teutonicknight !== 'undefined' ? teutonicknight : maleserf,
      'Trebuchet': typeof trebuchet !== 'undefined' ? trebuchet : maleserf,
      'Oathkeeper': typeof archbishop !== 'undefined' ? archbishop : maleserf,
      'Archbishop': typeof archbishop !== 'undefined' ? archbishop : maleserf,
      'Apparition': typeof apparition !== 'undefined' ? apparition : maleserf,
      'Goth': typeof goth !== 'undefined' ? goth : maleserf,
      'NorseSword': typeof goth !== 'undefined' ? goth : maleserf,
      'HighPriestess': typeof highpriestess !== 'undefined' ? highpriestess : maleserf,
      'Cataphract': typeof marauder !== 'undefined' ? marauder : maleserf,
      'Carolingian': typeof marauder !== 'undefined' ? marauder : maleserf,
      'Marauder': typeof marauder !== 'undefined' ? marauder : maleserf,
      'NorseSpear': typeof norsespear !== 'undefined' ? norsespear : maleserf,
      'seidr': typeof seidr !== 'undefined' ? seidr : maleserf,
      'Huskarl': typeof huskarl !== 'undefined' ? huskarl : maleserf,
      // Add more as needed...
    };
  }

  /**
   * Get sprite for entity class
   * @param {string} entityClass - Entity class name
   * @param {boolean} isGhost - Whether entity is a ghost
   * @returns {object|null} Sprite object or null
   */
  getSpriteForClass(entityClass, isGhost = false) {
    if (!this.initialized) {
      this.init();
    }

    // Special handling for ghosts
    if (isGhost) {
      return this.spriteMap['ghost'] || null;
    }

    // Special handling for Falcon (don't use fallback)
    if (entityClass === 'Falcon') {
      if (typeof falcon !== 'undefined' && falcon && falcon.facedown && 
          falcon.facedown.complete && falcon.facedown.naturalWidth > 0) {
        return falcon;
      }
      return null; // Don't render falcons until sprite is fully loaded
    }

    // Lookup in sprite map
    const sprite = this.spriteMap[entityClass];
    
    if (sprite) {
      return sprite;
    }

    // Fallback to maleserf if not found
    if (typeof maleserf !== 'undefined') {
      return maleserf;
    }

    return null;
  }

  /**
   * Check if sprite is loaded
   * @param {string} entityClass - Entity class name
   * @returns {boolean} True if sprite is available
   */
  isSpriteLoaded(entityClass) {
    const sprite = this.getSpriteForClass(entityClass);
    return sprite !== null;
  }

  /**
   * Get sprite for player based on class and sex
   * @param {string} playerClass - Player class
   * @param {string} sex - Player sex ('m' or 'f')
   * @returns {object|null} Sprite object
   */
  getPlayerSprite(playerClass, sex) {
    if (playerClass.toLowerCase() === 'serf') {
      if (sex === 'f' && typeof femaleserf !== 'undefined') {
        return femaleserf;
      }
      return maleserf;
    }

    return this.getSpriteForClass(playerClass);
  }

  /**
   * Clear sprite cache (force rebuild)
   */
  clearCache() {
    this.spriteMap = null;
    this.initialized = false;
  }
}

// Export singleton instance
const spriteManager = new SpriteManager();

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.spriteManager = spriteManager;
  window.SpriteManager = SpriteManager;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = spriteManager;
}
