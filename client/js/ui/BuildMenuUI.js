/**
 * BuildMenuUI - Handles build menu display
 * 
 * Separates build menu UI logic from client.js
 */

class BuildMenuUI {
  constructor() {
    this.container = null;
    this.initialized = false;
  }

  /**
   * Initialize build menu UI
   * @param {HTMLElement} container - Container element
   */
  init(container) {
    if (!container) {
      console.warn('[BuildMenuUI] No container provided');
      return;
    }

    this.container = container;
    this.initialized = true;
  }

  /**
   * Render build menu
   * @param {Array} buildings - Available buildings
   * @param {number} playerWood - Player wood count
   * @param {number} playerStone - Player stone count
   * @param {object} config - Configuration object with preview mode and socket
   */
  render(buildings, playerWood, playerStone, config) {
    console.log('[BuildMenuUI] Render called with:', {
      initialized: this.initialized,
      hasContainer: !!this.container,
      buildingsCount: buildings ? buildings.length : 0,
      playerWood: playerWood,
      playerStone: playerStone,
      buildings: buildings
    });
    
    if (!this.initialized || !this.container) {
      console.warn('[BuildMenuUI] Not initialized or no container');
      return;
    }

    // Clear existing content
    console.log('[BuildMenuUI] Clearing container, current children:', this.container.children.length);
    this.container.innerHTML = '';

    // Group buildings by tier
    const tier1 = buildings.filter(b => b.tier === 1);
    const tier2 = buildings.filter(b => b.tier === 2);
    const tier3 = buildings.filter(b => b.tier === 3);

    // Render Tier I
    if (tier1.length > 0) {
      const tier1Header = document.createElement('div');
      tier1Header.className = 'build-tier-header';
      tier1Header.textContent = '⚒️ TIER I';
      this.container.appendChild(tier1Header);
      
      tier1.forEach(building => {
        const tile = this.createBuildingTile(building, playerWood, playerStone, config);
        this.container.appendChild(tile);
      });
    }

    // Render Tier II
    if (tier2.length > 0) {
      const tier2Header = document.createElement('div');
      tier2Header.className = 'build-tier-header';
      tier2Header.textContent = '🏰 TIER II';
      this.container.appendChild(tier2Header);
      
      tier2.forEach(building => {
        const tile = this.createBuildingTile(building, playerWood, playerStone);
        this.container.appendChild(tile);
      });
    }

    // Render Tier III
    if (tier3.length > 0) {
      const tier3Header = document.createElement('div');
      tier3Header.className = 'build-tier-header';
      tier3Header.textContent = '⚔️ TIER III';
      this.container.appendChild(tier3Header);
      
      tier3.forEach(building => {
        const tile = this.createBuildingTile(building, playerWood, playerStone, config);
        this.container.appendChild(tile);
      });
    }

    if (buildings.length === 0) {
      this.container.innerHTML = '<p style="color: white; text-align: center;">No buildings available</p>';
    }

    console.log('[BuildMenuUI] Container now has children:', this.container.children.length);
  }

  /**
   * Create building tile
   * @param {object} building - Building data
   * @param {number} playerWood - Player wood
   * @param {number} playerStone - Player stone
   * @param {object} config - Configuration object with preview mode
   * @returns {HTMLElement} Building tile element
   */
  createBuildingTile(building, playerWood, playerStone, config) {
    const tile = document.createElement('div');
    tile.className = 'building-tile';
    
    const canAfford = this.canAfford(building, playerWood, playerStone);
    if (!canAfford) {
      tile.classList.add('unaffordable');
    }

    // Building name
    const name = document.createElement('div');
    name.className = 'building-tile-name';
    name.textContent = building.name;
    tile.appendChild(name);

    // Building costs
    const costs = document.createElement('div');
    costs.className = 'building-tile-costs';
    
    const woodCost = building.wood || 0;
    const stoneCost = building.stone || 0;
    
    if (woodCost > 0) {
      const woodItem = document.createElement('div');
      woodItem.className = 'building-cost-item';
      if (playerWood < woodCost) {
        woodItem.classList.add('insufficient');
      }
      woodItem.innerHTML = `<span>🪵 Wood</span><span>${woodCost}</span>`;
      costs.appendChild(woodItem);
    }
    
    if (stoneCost > 0) {
      const stoneItem = document.createElement('div');
      stoneItem.className = 'building-cost-item';
      if (playerStone < stoneCost) {
        stoneItem.classList.add('insufficient');
      }
      stoneItem.innerHTML = `<span>🪨 Stone</span><span>${stoneCost}</span>`;
      costs.appendChild(stoneItem);
    }
    
    tile.appendChild(costs);

    // Command hint
    const command = document.createElement('div');
    command.className = 'building-tile-command';
    command.textContent = `/build ${building.type}`;
    tile.appendChild(command);

    // Click handler - activate preview mode instead of building immediately
    if (canAfford) {
      tile.onclick = () => {
        console.log('[BuildMenuUI] Building selected for preview:', building.type);
        
        // Update window variables first (primary source of truth)
        if (typeof window !== 'undefined') {
          window.buildPreviewMode = true;
          window.buildPreviewType = building.type;
          window.buildPreviewData = null;
          window.buildPreviewValidationCache = null;
          window.buildPreviewLastTile = null;
        }
        
        // Also update config object if available (for compatibility)
        if (config) {
          if (config.buildPreviewMode) config.buildPreviewMode.value = true;
          if (config.buildPreviewType) config.buildPreviewType.value = building.type;
          if (config.buildPreviewData) config.buildPreviewData.value = null;
        }
        
        console.log('[BuildMenuUI] Preview mode activated:', {
          windowPreviewMode: typeof window !== 'undefined' ? window.buildPreviewMode : 'N/A',
          windowPreviewType: typeof window !== 'undefined' ? window.buildPreviewType : 'N/A'
        });
        
        // Close the build menu popup
        if (config && config.buildMenuPopup) {
          config.buildMenuPopup.style.display = 'none';
        } else {
          const buildMenuPopup = document.getElementById('build-menu-popup');
          if (buildMenuPopup) {
            buildMenuPopup.style.display = 'none';
          }
        }
      };
    }

    return tile;
  }

  /**
   * Check if player can afford building
   * @param {object} building - Building data
   * @param {number} playerWood - Player wood
   * @param {number} playerStone - Player stone
   * @returns {boolean} Can afford
   */
  canAfford(building, playerWood, playerStone) {
    return (playerWood >= (building.wood || 0)) && (playerStone >= (building.stone || 0));
  }

  /**
   * Clear build menu
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.BuildMenuUI = BuildMenuUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuildMenuUI;
}
