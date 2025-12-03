/**
 * BuildingTopsRenderer - Handles rendering of building roof tiles (layer 5)
 * 
 * Extracted from client.js - consolidates 483 lines of repetitive building top rendering code
 * into a clean lookup-based system.
 */

class BuildingTopsRenderer {
  constructor() {
    // Building top tile image lookup map
    // Most tiles map directly: tile name -> image name
    this.buildingTopsMap = {
      // Mills
      'mill4': 'mill4',
      'mill5': 'mill5',
      
      // Lumbermills
      'lumbermill2': 'lumbermill2',
      'lumbermill3': 'lumbermill3',
      
      // Outposts
      'outpost1': 'outpost1',
      
      // Gothic Towers
      'gtower4': 'gtower4',
      'gtower5': 'gtower5',
      'gothtower4': 'gothtower4',
      'gothtower5': 'gothtower5',
      
      // Frankish Towers
      'franktower4': 'franktower4',
      'franktower5': 'franktower5',
      
      // Generic Towers
      'tower9': 'tower9',
      'tower10': 'tower10',
      'tower11': 'tower11',
      'tower12': 'tower12',
      'tower13': 'tower13',
      'tower14': 'tower14',
      
      // Taverns
      'tavern17': 'tavern17',
      'tavern18': 'tavern18',
      'tavern19': 'tavern19',
      
      // Monasteries
      'monastery14': 'monastery14',
      'monastery15': 'monastery15',
      'monastery16': 'monastery16',
      
      // Markets
      'market12': 'market12',
      'market13': 'market13',
      'market14': 'market14',
      'market15': 'market15',
      'market16': 'market16',
      'gothmarket8': 'gothmarket8',
      'gothmarket9': 'gothmarket9',
      'frankmarket12': 'frankmarket12',
      'frankmarket13': 'frankmarket13',
      'frankmarket14': 'frankmarket14',
      'frankmarket15': 'frankmarket15',
      
      // Stables
      'stable12': 'stable12',
      'stable13': 'stable13',
      'stable14': 'stable14',
      
      // Docks
      'dock6': 'dock6',
      'dock7': 'dock7',
      'dock8': 'dock8',
      
      // Garrisons
      'garrison12': 'garrison12',
      'garrison13': 'garrison13',
      'garrison14': 'garrison14',
      
      // Forges
      'forge6': 'forge6',
      'forge7': 'forge7',
      
      // Strongholds
      'stronghold58': 'stronghold58',
      'stronghold59': 'stronghold59',
      'stronghold60': 'stronghold60',
      'stronghold61': 'stronghold61',
      'stronghold62': 'stronghold62',
      'stronghold63': 'stronghold63',
      'stronghold64': 'stronghold64',
      'stronghold65': 'stronghold65',
      'stronghold66': 'stronghold66'
    };
    
    // Special tiles that need conditional rendering
    this.specialTiles = {
      'gateo': {
        checkTile: 'wall',
        checkLayer: 3,
        checkOffset: { c: -1, r: 0 },
        images: { true: 'gateo0', false: 'gateo1' }
      },
      'gatec': {
        checkTile: 'wall',
        checkLayer: 3,
        checkOffset: { c: -1, r: 0 },
        images: { true: 'gatec0', false: 'gatec1' }
      }
    };
  }

  /**
   * Render building tops for a specific z-layer
   * @param {number} z - Z layer (only renders for z=0)
   * @param {object} ctx - Canvas context
   * @param {object} config - Configuration { viewport, tileSize, Img, getTile, getCurrentZ }
   */
  render(z, ctx, config) {
    const { viewport, tileSize, Img, getTile, getCurrentZ } = config;
    
    // Only render tops on overworld (z=0)
    if (z !== 0) return;
    
    // Use provided z or get current
    const currentZ = z !== undefined ? z : (getCurrentZ ? getCurrentZ() : 0);
    if (currentZ !== 0) return;
    
    for (let c = viewport.startTile[0]; c < viewport.endTile[0]; c++) {
      for (let r = viewport.startTile[1]; r < viewport.endTile[1]; r++) {
        const xOffset = viewport.offset[0] + (c * tileSize);
        const yOffset = viewport.offset[1] + (r * tileSize);
        const tile = getTile(5, c, r);
        
        if (!tile) continue;
        
        // Handle special tiles (gates with conditional rendering)
        if (this.specialTiles[tile]) {
          this.renderSpecialTile(tile, c, r, xOffset, yOffset, tileSize, ctx, Img, getTile);
          continue;
        }
        
        // Handle regular tiles
        const imageName = this.buildingTopsMap[tile];
        if (imageName && Img[imageName]) {
          ctx.drawImage(Img[imageName], xOffset, yOffset, tileSize, tileSize);
        }
      }
    }
  }

  /**
   * Render special tiles that need conditional logic (e.g., gates)
   * @param {string} tileName - Tile name
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} xOffset - X offset
   * @param {number} yOffset - Y offset
   * @param {number} tileSize - Tile size
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {object} Img - Image assets
   * @param {function} getTile - Get tile function
   */
  renderSpecialTile(tileName, c, r, xOffset, yOffset, tileSize, ctx, Img, getTile) {
    const specialConfig = this.specialTiles[tileName];
    if (!specialConfig) return;
    
    // Check adjacent tile condition
    const checkC = c + (specialConfig.checkOffset.c || 0);
    const checkR = r + (specialConfig.checkOffset.r || 0);
    const adjacentTile = getTile(specialConfig.checkLayer || 3, checkC, checkR);
    
    // Determine which image to use based on condition
    const conditionMet = adjacentTile === specialConfig.checkTile;
    const imageName = specialConfig.images[conditionMet];
    
    if (imageName && Img[imageName]) {
      ctx.drawImage(Img[imageName], xOffset, yOffset, tileSize, tileSize);
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.BuildingTopsRenderer = BuildingTopsRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuildingTopsRenderer;
}
