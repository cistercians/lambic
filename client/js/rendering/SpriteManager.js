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

    // Build sprite map (returns null if undefined, except for Serf classes)
    this.spriteMap = {
      'ghost': typeof ghost !== 'undefined' ? ghost : null,
      'Sheep': typeof sheep !== 'undefined' ? sheep : null,
      'Deer': typeof deer !== 'undefined' ? deer : null,
      'Boar': typeof boar !== 'undefined' ? boar : null,
      'Wolf': typeof wolf !== 'undefined' ? wolf : null,
      'Falcon': typeof falcon !== 'undefined' ? falcon : null,
      'FishingShip': typeof fishingship !== 'undefined' ? fishingship : null,
      'CargoShip': typeof cargoship !== 'undefined' ? cargoship : null,
      'Serf': maleserf,
      'SerfM': maleserf,
      'SerfF': typeof femaleserf !== 'undefined' ? femaleserf : maleserf,
      'Rogue': typeof rogue !== 'undefined' ? rogue : null,
      'Trapper': typeof rogue !== 'undefined' ? rogue : null,
      'Cutthroat': typeof rogue !== 'undefined' ? rogue : null,
      'Hunter': typeof hunter !== 'undefined' ? hunter : null,
      'Outlaw': typeof hunter !== 'undefined' ? hunter : null,
      'Scout': typeof scout !== 'undefined' ? scout : null,
      'Ranger': typeof ranger !== 'undefined' ? ranger : null,
      'Warden': typeof ranger !== 'undefined' ? ranger : null,
      'Swordsman': typeof swordsman !== 'undefined' ? swordsman : null,
      'Archer': typeof archer !== 'undefined' ? archer : null,
      'Horseman': typeof horseman !== 'undefined' ? horseman : null,
      'MountedArcher': typeof mountedarcher !== 'undefined' ? mountedarcher : null,
      'Hero': typeof hero !== 'undefined' ? hero : null,
      'Templar': typeof templar !== 'undefined' ? templar : null,
      'Hospitaller': typeof templar !== 'undefined' ? templar : null,
      'Hochmeister': typeof templar !== 'undefined' ? templar : null,
      'Cavalry': typeof cavalry !== 'undefined' ? cavalry : null,
      'Knight': typeof knight !== 'undefined' ? knight : null,
      'Lancer': typeof lancer !== 'undefined' ? lancer : null,
      'Charlemagne': typeof lancer !== 'undefined' ? lancer : null,
      'Crusader': typeof crusader !== 'undefined' ? crusader : null,
      'Priest': typeof monk !== 'undefined' ? monk : null,
      'Monk': typeof monk !== 'undefined' ? monk : null,
      'Prior': typeof monk !== 'undefined' ? monk : null,
      'Mage': typeof mage !== 'undefined' ? mage : null,
      'Acolyte': typeof mage !== 'undefined' ? mage : null,
      'Warlock': typeof warlock !== 'undefined' ? warlock : null,
      'Brother': typeof warlock !== 'undefined' ? warlock : null,
      'King': typeof king !== 'undefined' ? king : null,
      'Alaric': typeof king !== 'undefined' ? king : null,
      'Innkeeper': typeof innkeeper !== 'undefined' ? innkeeper : null,
      'Shipwright': typeof innkeeper !== 'undefined' ? innkeeper : null,
      'Bishop': typeof bishop !== 'undefined' ? bishop : null,
      'Friar': typeof friar !== 'undefined' ? friar : null,
      'Footsoldier': typeof footsoldier !== 'undefined' ? footsoldier : null,
      'Skirmisher': typeof skirmisher !== 'undefined' ? skirmisher : null,
      'Cavalier': typeof cavalier !== 'undefined' ? cavalier : null,
      'General': typeof general !== 'undefined' ? general : null,
      'ImperialKnight': typeof teutonicknight !== 'undefined' ? teutonicknight : null,
      'TeutonicKnight': typeof teutonicknight !== 'undefined' ? teutonicknight : null,
      'Trebuchet': typeof trebuchet !== 'undefined' ? trebuchet : null,
      'Oathkeeper': typeof archbishop !== 'undefined' ? archbishop : null,
      'Archbishop': typeof archbishop !== 'undefined' ? archbishop : null,
      'Apparition': typeof apparition !== 'undefined' ? apparition : null,
      'Goth': typeof goth !== 'undefined' ? goth : null,
      'NorseSword': typeof goth !== 'undefined' ? goth : null,
      'HighPriestess': typeof highpriestess !== 'undefined' ? highpriestess : null,
      'Cataphract': typeof marauder !== 'undefined' ? marauder : null,
      'Carolingian': typeof marauder !== 'undefined' ? marauder : null,
      'Marauder': typeof marauder !== 'undefined' ? marauder : null,
      'NorseSpear': typeof norsespear !== 'undefined' ? norsespear : null,
      'seidr': typeof seidr !== 'undefined' ? seidr : null,
      'Huskarl': typeof huskarl !== 'undefined' ? huskarl : null,
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

    // Lookup in sprite map (universal behavior for all classes)
    const sprite = this.spriteMap[entityClass];
    
    // Return sprite if found, otherwise null (universal behavior)
    return sprite || null;
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
