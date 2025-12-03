/**
 * ItemEmojiHelper - Helper for getting item emoji representations
 * 
 * Extracted from client.js for better organization.
 */

class ItemEmojiHelper {
  constructor() {
    this.emojis = {
      grain: '🌾',
      wood: '🪵',
      stone: '🪨',
      ironore: '⛏️',
      iron: '🔩',
      silverore: '✨',
      silver: '💍',
      goldore: '⭐',
      gold: '👑',
      diamond: '💎',
      bread: '🍞',
      fish: '🐟',
      torch: '🔦',
      arrows: '🏹',
      beer: '🍺'
    };
  }

  /**
   * Get emoji for item type
   * @param {string} itemType - Item type name
   * @returns {string} Emoji character
   */
  getItemEmoji(itemType) {
    if (!itemType) return '📦';
    return this.emojis[itemType.toLowerCase()] || '📦';
  }

  /**
   * Add custom emoji mapping
   * @param {string} itemType - Item type name
   * @param {string} emoji - Emoji character
   */
  addEmoji(itemType, emoji) {
    this.emojis[itemType.toLowerCase()] = emoji;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ItemEmojiHelper = ItemEmojiHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemEmojiHelper;
}
