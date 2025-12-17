/**
 * ItemRarityHelper - Utilities for item rarity and ranking
 * 
 * Extracted from client.js for better organization.
 */

class ItemRarityHelper {
  constructor() {
    // Item rarity definitions - MUST match server ItemFactory.itemConfigs exactly
    // Server uses: rank 0=Common, 1=Rare, 2=Lore, 3=Mythic
    // Build rankMap directly from server's itemConfigs structure
    this.rankMap = {
      // Resources (rank 0)
      'wood': 0, 'stone': 0, 'grain': 0, 'ironore': 0, 'iron': 0,
      'silverore': 0, 'silver': 0, 'goldore': 0, 'gold': 0,
      'boarhide': 0, 'leather': 0,
      // Resources (rank 1)
      'steel': 1,
      // Resources (rank 2)
      'diamond': 2,
      // Tools (rank 0)
      'pickaxe': 0, 'stoneaxe': 0, 'ironaxe': 0, 'huntingknife': 0, 'torch': 0,
      // Weapons (rank 0)
      'dague': 0, 'rondel': 0, 'misericorde': 0, 'bow': 0, 'rusticlance': 0, 'arrows': 0,
      // Weapons (rank 1)
      'bastardsword': 1, 'longsword': 1, 'zweihander': 1, 'morallta': 1,
      'welshlongbow': 1, 'knightlance': 1,
      // Weapons (rank 2)
      'paladinlance': 2,
      // Armor (rank 0)
      'brigandine': 0, 'lamellar': 0, 'clericrobe': 0, 'monkcowl': 0,
      // Armor (rank 1)
      'maille': 1, 'hauberk': 1, 'brynja': 1, 'cuirass': 1, 'blackcloak': 1,
      // Armor (rank 2)
      'steelplate': 2, 'greenwichplate': 2, 'gothicplate': 2,
      // Magic items (rank 0)
      'tome': 0,
      // Magic items (rank 1)
      'runicscroll': 1,
      // Magic items (rank 2)
      'sacredtext': 2,
      // Food (rank 0)
      'bread': 0, 'meat': 0, 'fish': 0, 'lamb': 0, 'boarmeat': 0, 'venison': 0,
      'poachedfish': 0, 'mead': 0, 'saison': 0,
      // Food (rank 1)
      'lambchop': 1, 'boarshank': 1, 'venisonloin': 1, 'flanders': 1, 'bieredegarde': 1,
      // Food (rank 2)
      'bordeaux': 2, 'bourgogne': 2, 'chianti': 2,
      // Special items (rank 0)
      'key': 0, 'worldmap': 0,
      // Special items (rank 3)
      'crown': 3, 'relic': 3,
      // Containers (rank 0)
      'chest': 0, 'lockedchest': 0
    };

    // Rarity colors - MUST match server ItemFactory.getRarityColor
    // Server uses: 0=white, 1=green, 2=blue, 3=purple
    this.rarityColors = {
      0: '#ffffff', // Common - white (matches server)
      1: '#00ff00', // Rare - green (matches server)
      2: '#0080ff', // Lore - blue (matches server)
      3: '#a020f0', // Mythic - purple (matches server)
      4: '#a020f0', // Fallback to purple for rank 4
      5: '#a020f0'  // Fallback to purple for rank 5
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

    // Border colors - MUST match server ItemFactory.getRarityBorderColor
    // Server uses: 0=gray, 1=green, 2=blue, 3=purple
    this.borderColors = {
      0: '#808080', // Common - gray (matches server)
      1: '#00ff00', // Rare - green (matches server)
      2: '#0080ff', // Lore - blue (matches server)
      3: '#a020f0', // Mythic - purple (matches server)
      4: '#a020f0', // Fallback to purple for rank 4
      5: '#a020f0'  // Fallback to purple for rank 5
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
