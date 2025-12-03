/**
 * ItemRarityHelper - Utilities for item rarity and ranking
 * 
 * Extracted from client.js for better organization.
 */

class ItemRarityHelper {
  constructor() {
    // Item rarity definitions
    this.rarityRanks = {
      // Common (Rank 0)
      common: ['wood', 'stone', 'grain', 'ironore', 'iron', 'bread', 'meat', 'fish'],
      
      // Uncommon (Rank 1)
      uncommon: ['silverore', 'silver', 'leather', 'boarhide', 'torch'],
      
      // Rare (Rank 2)
      rare: ['goldore', 'gold', 'diamond', 'arrows', 'steel'],
      
      // Epic (Rank 3)
      epic: ['bastardsword', 'longsword', 'zweihander', 'morallta', 'brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate'],
      
      // Legendary (Rank 4)
      legendary: ['greenwichplate', 'gothicplate', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance'],
      
      // Mythic (Rank 5)
      mythic: ['clericrobe', 'monkcowl', 'blackcloak', 'crown', 'tome', 'runicscroll', 'sacredtext']
    };

    // Build reverse lookup map for O(1) access
    this.rankMap = {};
    Object.keys(this.rarityRanks).forEach((rankName, index) => {
      this.rarityRanks[rankName].forEach(itemType => {
        this.rankMap[itemType.toLowerCase()] = index;
      });
    });

    // Rarity colors
    this.rarityColors = {
      0: '#FFFFFF', // Common - White
      1: '#1EFF00', // Uncommon - Green
      2: '#0070DD', // Rare - Blue
      3: '#A335EE', // Epic - Purple
      4: '#FF8000', // Legendary - Orange
      5: '#E6CC80'  // Mythic - Gold
    };

    // Rarity names
    this.rarityNames = {
      0: 'Common',
      1: 'Uncommon',
      2: 'Rare',
      3: 'Epic',
      4: 'Legendary',
      5: 'Mythic'
    };

    // Border colors (slightly brighter)
    this.borderColors = {
      0: '#CCCCCC',
      1: '#00CC00',
      2: '#0055AA',
      3: '#8822CC',
      4: '#CC6600',
      5: '#CCAA55'
    };
  }

  /**
   * Get item rank (0-5)
   * @param {string} itemType - Item type name
   * @returns {number} Rank (0-5)
   */
  getItemRank(itemType) {
    if (!itemType) return 0;
    const normalized = itemType.toLowerCase().replace(/\s+/g, '');
    return this.rankMap[normalized] !== undefined ? this.rankMap[normalized] : 0;
  }

  /**
   * Get rarity name
   * @param {number} rank - Item rank
   * @returns {string} Rarity name
   */
  getRarityName(rank) {
    return this.rarityNames[rank] || 'Common';
  }

  /**
   * Get rarity color
   * @param {number} rank - Item rank
   * @returns {string} Color hex code
   */
  getRarityColor(rank) {
    return this.rarityColors[rank] || '#FFFFFF';
  }

  /**
   * Get rarity border color
   * @param {number} rank - Item rank
   * @returns {string} Border color hex code
   */
  getRarityBorderColor(rank) {
    return this.borderColors[rank] || '#CCCCCC';
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ItemRarityHelper = ItemRarityHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemRarityHelper;
}
