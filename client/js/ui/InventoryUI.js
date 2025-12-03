/**
 * InventoryUI - Handles inventory display and interactions
 * 
 * Separates inventory UI logic from game state and rendering.
 */

class InventoryUI {
  constructor() {
    this.inventoryGrid = null;
    this.initialized = false;
  }

  /**
   * Initialize inventory UI
   * @param {HTMLElement} container - Container element for inventory
   */
  init(container) {
    if (!container) {
      console.warn('[InventoryUI] No container provided');
      return;
    }

    this.inventoryGrid = container;
    this.initialized = true;
  }

  /**
   * Update inventory display
   * @param {object} inventory - Inventory object with item counts
   * @param {Function} onItemClick - Callback for item clicks
   * @param {Function} onItemRightClick - Callback for item right-clicks
   */
  update(inventory, onItemClick = null, onItemRightClick = null) {
    if (!this.initialized || !this.inventoryGrid) {
      return;
    }

    // Clear existing items
    this.inventoryGrid.innerHTML = '';

    if (!inventory || Object.keys(inventory).length === 0) {
      this.inventoryGrid.innerHTML = '<p style="color:#888;padding:20px;">Your inventory is empty</p>';
      return;
    }

    // Get inventory items (excluding special keys)
    const items = this.getInventoryItems(inventory);

    // Sort items by name
    items.sort((a, b) => a.name.localeCompare(b.name));

    // Create item elements
    items.forEach(item => {
      const itemDiv = this.createItemElement(item, onItemClick, onItemRightClick);
      this.inventoryGrid.appendChild(itemDiv);
    });
  }

  /**
   * Get inventory items from inventory object
   * @param {object} inventory - Inventory object
   * @returns {Array} Array of item objects
   */
  getInventoryItems(inventory) {
    const items = [];
    const excludedKeys = ['keyRing']; // Keys to exclude from display

    for (const key in inventory) {
      if (excludedKeys.includes(key)) continue;
      
      const count = inventory[key];
      if (count > 0) {
        items.push({
          type: key,
          name: this.formatItemName(key),
          count: count,
          rank: this.getItemRank(key, inventory)
        });
      }
    }

    return items;
  }

  /**
   * Format item name for display
   * @param {string} itemType - Item type
   * @returns {string} Formatted name
   */
  formatItemName(itemType) {
    return itemType.charAt(0).toUpperCase() + itemType.slice(1).replace(/([A-Z])/g, ' $1');
  }

  /**
   * Get item rank (if applicable)
   * @param {string} itemType - Item type
   * @param {object} inventory - Inventory object
   * @returns {number} Item rank
   */
  getItemRank(itemType, inventory) {
    // Check for rank variants (e.g., 'wood1', 'wood2')
    let rank = 0;
    for (let i = 1; i <= 5; i++) {
      if (inventory[`${itemType}${i}`]) {
        rank = Math.max(rank, i);
      }
    }
    return rank;
  }

  /**
   * Create item element
   * @param {object} item - Item data
   * @param {Function} onItemClick - Click handler
   * @param {Function} onItemRightClick - Right-click handler
   * @returns {HTMLElement} Item element
   */
  createItemElement(item, onItemClick, onItemRightClick) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'inventory-item';
    itemDiv.dataset.itemType = item.type;
    itemDiv.dataset.itemName = item.name;
    itemDiv.dataset.itemRank = item.rank;

    // Get rarity color
    const rarityColor = this.getRarityColor(item.rank);

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'inventory-item-tooltip';
    tooltip.innerHTML = `<span style="color:${rarityColor}">[${item.name}]</span> x${item.count}`;
    itemDiv.appendChild(tooltip);

    // Get item image
    const itemImg = this.getItemImage(item.type, item.count);
    if (itemImg) {
      const img = document.createElement('img');
      img.src = itemImg.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.pointerEvents = 'none';
      itemDiv.appendChild(img);
    } else {
      // Fallback text
      const placeholder = document.createElement('div');
      placeholder.style.fontSize = '12px';
      placeholder.style.color = rarityColor;
      placeholder.style.textAlign = 'center';
      placeholder.style.padding = '10px';
      placeholder.style.pointerEvents = 'none';
      placeholder.textContent = item.name;
      itemDiv.appendChild(placeholder);
    }

    // Event handlers
    if (onItemClick) {
      itemDiv.onclick = (e) => {
        e.stopPropagation();
        onItemClick(item.type, item.name);
      };
    }

    if (onItemRightClick) {
      itemDiv.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onItemRightClick(e, item.type, item.name, item.count);
      };
    }

    return itemDiv;
  }

  /**
   * Get rarity color for item rank
   * @param {number} rank - Item rank
   * @returns {string} Color hex code
   */
  getRarityColor(rank) {
    const colors = {
      0: '#ffffff', // Common
      1: '#1eff00', // Uncommon
      2: '#0070dd', // Rare
      3: '#a335ee', // Epic
      4: '#ff8000', // Legendary
      5: '#e6cc80'  // Artifact
    };
    return colors[rank] || colors[0];
  }

  /**
   * Get item image (delegates to global function if available)
   * @param {string} itemType - Item type
   * @param {number} count - Item count
   * @returns {Image|null} Item image
   */
  getItemImage(itemType, count) {
    if (typeof getInventoryItemImage === 'function') {
      return getInventoryItemImage(itemType, count);
    }
    return null;
  }

  /**
   * Clear inventory display
   */
  clear() {
    if (this.inventoryGrid) {
      this.inventoryGrid.innerHTML = '';
    }
  }
}

// Export for use
module.exports = InventoryUI;
