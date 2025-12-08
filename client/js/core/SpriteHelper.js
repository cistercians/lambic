/**
 * SpriteHelper - Utility functions for sprite management
 * 
 * Extracted from client.js for better organization.
 * Handles sprite lookup and initialization.
 */

class SpriteHelper {
  constructor() {
    this.spriteMap = null;
  }

  /**
   * Get sprite for entity class
   * @param {string} entityClass - Entity class name
   * @param {boolean} isGhost - Is entity in ghost mode?
   * @returns {object|null} Sprite object or null
   */
  getSpriteForClass(entityClass, isGhost) {
    // Safety check: Return default if sprites not loaded yet
    if (typeof maleserf === 'undefined') {
      console.warn('getSpriteForClass called before sprites loaded, returning null');
      return null;
    }

    // Special handling for Falcon: Check FIRST before spriteMap lookup
    // Only return falcon if images are actually loaded - don't return it if images aren't ready
    if (entityClass === 'Falcon') {
      if (typeof falcon !== 'undefined' && falcon) {
        // Check if at least one falcon image is loaded
        const hasLoadedImage = (falcon.facedown && falcon.facedown.complete && falcon.facedown.naturalWidth > 0) ||
                               (falcon.faceup && falcon.faceup.complete && falcon.faceup.naturalWidth > 0) ||
                               (falcon.faceleft && falcon.faceleft.complete && falcon.faceleft.naturalWidth > 0) ||
                               (falcon.faceright && falcon.faceright.complete && falcon.faceright.naturalWidth > 0);
        if (hasLoadedImage) {
          return falcon;
        }
        // Images not loaded yet - return null to prevent using wrong sprite
        return null;
      }
      // If falcon doesn't exist yet, return null (will be set later when sprite loads)
      return null;
    }

    // Lazy initialize sprite map once
    if (!this.spriteMap) {
      this.spriteMap = this.buildSpriteMap();
    }

    // Ghost mode overrides all
    if (isGhost && typeof ghost !== 'undefined') return ghost;
    if (isGhost) return maleserf; // Fallback if ghost sprite not loaded

    // Lookup sprite by class (O(1))
    const sprite = this.spriteMap[entityClass];
    if (!sprite) {
      // Special case: Falcons should return null if sprite not loaded (don't use maleserf fallback)
      if (entityClass === 'Falcon') {
        return null;
      }
      // Debug: Log unknown classes
      if (entityClass && entityClass !== 'Serf' && entityClass !== 'SerfM') {
        console.warn('Unknown entity class:', entityClass, '- using maleserf default');
      }
      return maleserf;
    }
    // If sprite is explicitly null (e.g., falcon not loaded), return null instead of falling through
    if (sprite === null && entityClass === 'Falcon') {
      return null;
    }
    return sprite;
  }

  /**
   * Build sprite map for O(1) lookup
   * @returns {object} Sprite map object
   */
  buildSpriteMap() {
    // Debug: Check if sprite variables are defined
    if (typeof falcon === 'undefined') {
      console.error('CRITICAL: falcon sprite not defined when getSpriteForClass called!');
    }

    // Build sprite map using safe references (defaults to maleserf if undefined)
    return {
      'ghost': typeof ghost !== 'undefined' ? ghost : maleserf,
      'Sheep': typeof sheep !== 'undefined' ? sheep : maleserf,
      'Deer': typeof deer !== 'undefined' ? deer : maleserf,
      'Boar': typeof boar !== 'undefined' ? boar : maleserf,
      'Wolf': (typeof wolf !== 'undefined' ? wolf : (typeof window !== 'undefined' && window.wolf ? window.wolf : maleserf)),
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
      'FrankSword': typeof franksword !== 'undefined' ? franksword : maleserf,
      'FrankSpear': typeof frankspear !== 'undefined' ? frankspear : maleserf,
      'FrankBow': typeof frankbow !== 'undefined' ? frankbow : maleserf,
      'Mangonel': typeof mangonel !== 'undefined' ? mangonel : maleserf,
      'Malvoisin': typeof malvoisin !== 'undefined' ? malvoisin : maleserf,
      'CeltAxe': typeof celtaxe !== 'undefined' ? celtaxe : maleserf,
      'CeltSpear': typeof celtspear !== 'undefined' ? celtspear : maleserf,
      'Headhunter': typeof headhunter !== 'undefined' ? headhunter : maleserf,
      'Druid': typeof druid !== 'undefined' ? druid : maleserf,
      'Morrigan': typeof morrigan !== 'undefined' ? morrigan : maleserf,
      'Gwenllian': typeof gwenllian !== 'undefined' ? gwenllian : maleserf,
      'TeutonPike': typeof teutonpike !== 'undefined' ? teutonpike : maleserf,
      'TeutonBow': typeof teutonbow !== 'undefined' ? teutonbow : maleserf,
      'Poacher': typeof poacher !== 'undefined' ? poacher : maleserf,
      'Strongman': typeof strongman !== 'undefined' ? strongman : maleserf,
      'Condottiere': typeof condottiere !== 'undefined' ? condottiere : maleserf
    };
  }

  /**
   * Reset sprite map (useful for testing or reloading)
   */
  resetSpriteMap() {
    this.spriteMap = null;
  }
}

// Expose to global scope for browser
if (typeof window !== 'undefined') {
  window.SpriteHelper = SpriteHelper;
  // Create singleton instance
  window.spriteHelper = new SpriteHelper();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpriteHelper;
}
