/**
 * SpriteHelper - Utility functions for sprite management
 * 
 * Extracted from client.js for better organization.
 * Handles sprite lookup and initialization.
 */

class SpriteHelper {
  constructor() {
    this.spriteMap = null;
    this.warnedClasses = new Set(); // Track which classes we've warned about
  }

  /**
   * Normalize class name to match sprite map keys
   * @param {string} entityClass - Entity class name
   * @returns {string} Normalized class name
   */
  normalizeClassName(entityClass) {
    if (!entityClass) return entityClass;
    
    // Handle case-insensitive matching for common classes
    const classLower = entityClass.toLowerCase();
    
    // Special handling for Serf classes (case-insensitive)
    if (classLower === 'serf' || classLower === 'serfm') {
      return 'Serf'; // Map to 'Serf' which points to maleserf in sprite map
    }
    if (classLower === 'serff') {
      return 'SerfF';
    }
    
    // For other classes, capitalize first letter (handles "falcon" -> "Falcon", etc.)
    // Only if the class is all lowercase
    if (entityClass === classLower && entityClass.length > 0) {
      return entityClass.charAt(0).toUpperCase() + entityClass.slice(1);
    }
    
    return entityClass; // Return as-is if no normalization needed
  }

  /**
   * Get sprite for entity class
   * @param {string} entityClass - Entity class name
   * @param {boolean} isGhost - Is entity in ghost mode?
   * @returns {object|null} Sprite object or null
   */
  getSpriteForClass(entityClass, isGhost) {
    // Assets are guaranteed to be loaded before client initialization
    // But rebuild map if it doesn't exist or if critical sprites are missing
    
    // Lazy initialize sprite map, or rebuild if critical sprites are missing
    if (!this.spriteMap) {
      this.spriteMap = this.buildSpriteMap();
    } else {
      // Safety check: if critical sprites (like maleserf) are missing, rebuild
      // This handles cases where map was built before sprites were available
      if (!this.spriteMap['Serf'] && typeof maleserf !== 'undefined') {
        console.warn('Sprite map missing critical sprites, rebuilding...');
        this.spriteMap = this.buildSpriteMap();
      }
    }

    // Ghost mode overrides all
    if (isGhost && typeof ghost !== 'undefined') return ghost;
    if (isGhost) return null; // Return null if ghost sprite not available

    // Normalize class name for lookup (handles case variations)
    const normalizedClass = this.normalizeClassName(entityClass);

    // Lookup sprite by normalized class name (O(1))
    const sprite = this.spriteMap[normalizedClass];
    if (!sprite) {
      // Try original class name as fallback
      const fallbackSprite = this.spriteMap[entityClass];
      if (fallbackSprite) {
        return fallbackSprite;
      }
      
      // Debug: Log unknown classes (only once per class to reduce spam)
      // Exclude Serf variations from warnings
      const classLower = entityClass ? entityClass.toLowerCase() : '';
      if (entityClass && classLower !== 'serf' && classLower !== 'serfm' && classLower !== 'serff' && 
          entityClass !== 'Serf' && entityClass !== 'SerfM' && entityClass !== 'SerfF' && 
          !this.warnedClasses.has(entityClass)) {
        console.warn('Unknown entity class:', entityClass, '(normalized:', normalizedClass, ') - returning null');
        this.warnedClasses.add(entityClass);
      }
      return null;
    }
    return sprite;
  }

  /**
   * Build sprite map for O(1) lookup
   * @returns {object} Sprite map object
   */
  buildSpriteMap() {
    // Build sprite map - assets are guaranteed to be loaded, but check anyway for safety
    // CRITICAL: Check if sprites are actually defined before assigning
    return {
      'ghost': typeof ghost !== 'undefined' ? ghost : null,
      'Sheep': typeof sheep !== 'undefined' ? sheep : null,
      'Deer': typeof deer !== 'undefined' ? deer : null,
      'Boar': typeof boar !== 'undefined' ? boar : null,
      'Wolf': (typeof wolf !== 'undefined' ? wolf : (typeof window !== 'undefined' && window.wolf ? window.wolf : null)),
      'Falcon': typeof falcon !== 'undefined' ? falcon : null,
      'FishingShip': typeof fishingship !== 'undefined' ? fishingship : null,
      'CargoShip': typeof cargoship !== 'undefined' ? cargoship : null,
      'Serf': (typeof maleserf !== 'undefined' ? maleserf : null),
      'SerfM': (typeof maleserf !== 'undefined' ? maleserf : null),
      'SerfF': (typeof femaleserf !== 'undefined' ? femaleserf : (typeof maleserf !== 'undefined' ? maleserf : null)),
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
      'FrankSword': typeof franksword !== 'undefined' ? franksword : null,
      'FrankSpear': typeof frankspear !== 'undefined' ? frankspear : null,
      'FrankBow': typeof frankbow !== 'undefined' ? frankbow : null,
      'Mangonel': typeof mangonel !== 'undefined' ? mangonel : null,
      'Malvoisin': typeof malvoisin !== 'undefined' ? malvoisin : null,
      'CeltAxe': typeof celtaxe !== 'undefined' ? celtaxe : null,
      'CeltSpear': typeof celtspear !== 'undefined' ? celtspear : null,
      'Headhunter': typeof headhunter !== 'undefined' ? headhunter : null,
      'Druid': typeof druid !== 'undefined' ? druid : null,
      'Morrigan': typeof morrigan !== 'undefined' ? morrigan : null,
      'Gwenllian': typeof gwenllian !== 'undefined' ? gwenllian : null,
      'TeutonPike': typeof teutonpike !== 'undefined' ? teutonpike : null,
      'TeutonBow': typeof teutonbow !== 'undefined' ? teutonbow : null,
      'Poacher': typeof poacher !== 'undefined' ? poacher : null,
      'Strongman': typeof strongman !== 'undefined' ? strongman : null,
      'Condottiere': typeof condottiere !== 'undefined' ? condottiere : null
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
