/**
 * PortraitHelper - Helper for getting portrait images for entities
 * 
 * Extracted from client.js for better organization.
 */

class PortraitHelper {
  constructor() {
    this.Img = null;
  }

  /**
   * Set image assets reference
   * @param {object} Img - Image assets object
   */
  setImageAssets(Img) {
    this.Img = Img;
  }

  /**
   * Get portrait image for entity class and sex
   * @param {string} entityClass - Entity class name
   * @param {string} entitySex - Entity sex ('m' or 'f')
   * @returns {Image} Portrait image
   */
  getPortraitImage(entityClass, entitySex) {
    if (!this.Img) return null;
    if (!entityClass) return this.Img.portraitSerfM;

    // Special handling for Serf classes - check sex if provided
    if (entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF') {
      if (entitySex === 'f' || entityClass === 'SerfF') {
        if (this.Img.portraitSerfF && typeof this.Img.portraitSerfF !== 'undefined') {
          return this.Img.portraitSerfF;
        }
      }
      // Default to male serf
      if (this.Img.portraitSerfM && typeof this.Img.portraitSerfM !== 'undefined') {
        return this.Img.portraitSerfM;
      }
    }

    // Try to find a portrait image named after the class
    const classLower = entityClass.toLowerCase();
    const classCapitalized = entityClass.charAt(0).toUpperCase() + entityClass.slice(1).toLowerCase();

    // Build list of possible portrait name variations
    let portraitNames = [
      'portrait' + entityClass,           // Exact match
      'portrait' + classCapitalized,      // First-letter capitalized
      'portrait' + classLower,            // Lowercase
      'portrait' + entityClass.toUpperCase() // Uppercase
    ];

    // Remove duplicates
    portraitNames = portraitNames.filter((value, index, self) => self.indexOf(value) === index);

    // Try each variation
    for (let i = 0; i < portraitNames.length; i++) {
      const portraitName = portraitNames[i];
      if (this.Img[portraitName] && typeof this.Img[portraitName] !== 'undefined') {
        return this.Img[portraitName];
      }
    }

    // Fallback mapping for classes that share portraits
    const portraitMap = {
      'Trapper': this.Img.portraitRogue,
      'Cutthroat': this.Img.portraitRogue,
      'Outlaw': this.Img.portraitHunter,
      'Warden': this.Img.portraitHunter,
      'Serf': this.Img.portraitSerfM,
      'Hospitaller': this.Img.portraitTemplar,
      'Hochmeister': this.Img.portraitTemplar,
      'Charlemagne': this.Img.portraitKing,
      'Acolyte': this.Img.portraitMage,
      'Brother': this.Img.portraitWarlock,
      'Prior': this.Img.portraitMonk,
      'Priest': this.Img.portraitMonk,
      'Bishop': this.Img.portraitMonk,
      'Archbishop': this.Img.portraitMonk,
      'Oathkeeper': this.Img.portraitMonk,
      'HighPriestess': this.Img.portraitMonk,
      'Alaric': this.Img.portraitKing,
      'Innkeeper': this.Img.portraitSerfM,
      'Shipwright': this.Img.portraitSerfM,
      'Gwenllian': this.Img.portraitDruid,
      'Apparition': this.Img.portraitSerfM
    };

    // Check fallback map
    if (portraitMap[entityClass]) {
      const fallbackPortrait = portraitMap[entityClass];
      if (fallbackPortrait && typeof fallbackPortrait !== 'undefined') {
        return fallbackPortrait;
      }
    }

    // Last resort: default
    return this.Img.portraitSerfM;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.PortraitHelper = PortraitHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PortraitHelper;
}
