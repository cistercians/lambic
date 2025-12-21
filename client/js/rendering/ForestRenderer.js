/**
 * ForestRenderer - Handles rendering of forest overlays on overworld
 * 
 * Extracted from client.js - consolidates forest rendering with distance-based visibility
 */

class ForestRenderer {
  constructor() {
    // Forest tile configurations - maps tile ranges to forest overlay configs
    this.forestConfigs = [
      {
        tileRange: { min: 1, max: 1.3 },
        offsets: { x: -(1/4), y: -(1/1.75) },
        height: 1.5
      },
      {
        tileRange: { min: 1, max: 1.6 },
        offsets: { x: 0, y: -(1/1.25) },
        height: 1.5
      },
      {
        tileRange: { min: 1, max: 2 },
        offsets: { x: 0, y: -(1/2) },
        height: 1.5
      }
    ];
    
  }

  /**
   * Calculate distance-based forest opacity (Chebyshev distance)
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} pc - Player column
   * @param {number} pr - Player row
   * @returns {number|null} Distance value (40, 60, 80) or null for beyond range
   */
  calculateDistance(c, r, pc, pr) {
    const dc = Math.abs(c - pc);
    const dr = Math.abs(r - pr);
    const maxDist = Math.max(dc, dr);
    
    // Ring 1 (distance 40): immediate 3x3 grid (distance <= 1)
    if (maxDist <= 1) return 40;
    // Ring 2 (distance 60): next ring out (distance == 2)
    if (maxDist === 2) return 60;
    // Ring 3 (distance 80): outer ring (distance == 3)
    if (maxDist === 3) return 80;
    
    return null; // Beyond ring 3
  }

  /**
   * Convert distance to alpha value for forest transparency
   * @param {number|null} distance - Distance value or null
   * @returns {number} Alpha value (0.4, 0.6, 0.8, or 1.0)
   */
  getForestAlpha(distance) {
    if (distance === 40) return 0.4;
    if (distance === 60) return 0.6;
    if (distance === 80) return 0.8;
    return 1.0; // Default: fully opaque for null (beyond ring 3) or any other value
  }

  /**
   * Render forest overlay for a tile
   * @param {number} tile - Tile value
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} pc - Player column
   * @param {number} pr - Player row
   * @param {number} xOffset - X screen offset
   * @param {number} yOffset - Y screen offset
   * @param {number} tileSize - Tile size
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {object} Img - Image assets
   */
  renderForestTile(tile, c, r, pc, pr, xOffset, yOffset, tileSize, ctx, Img) {
    // Find matching config for this tile value
    let config = null;
    for (const cfg of this.forestConfigs) {
      if (tile >= cfg.tileRange.min && tile < cfg.tileRange.max) {
        config = cfg;
        break;
      }
    }
    
    if (!config) return;
    
    // Calculate distance
    const distance = this.calculateDistance(c, r, pc, pr);
    
    // Calculate alpha based on distance
    const alpha = this.getForestAlpha(distance);
    
    // Calculate offsets
    const x = xOffset + (config.offsets.x * tileSize);
    const y = yOffset + (config.offsets.y * tileSize);
    const width = tileSize;
    const height = tileSize * config.height;
    
    // Draw forest overlay with runtime alpha
    ctx.globalAlpha = alpha;
    ctx.drawImage(Img.hforest, x, y, width, height);
    ctx.globalAlpha = 1.0; // Reset alpha
  }

  /**
   * Main render method - renders forest overlays for overworld
   * @param {object} ctx - Canvas context
   * @param {object} config - Configuration
   */
  render(ctx, config) {
    const {
      viewport,
      tileSize,
      Img,
      getTile,
      getCurrentZ,
      getCameraPosition,
      getLoc
    } = config;
    
    // Only render forest on overworld (z=0)
    const z = getCurrentZ();
    if (z !== 0) return;
    
    // Get camera position and player location
    const cameraPos = getCameraPosition();
    const pLoc = getLoc(cameraPos.x, cameraPos.y);
    const pc = pLoc[0];
    const pr = pLoc[1];
    
    // Render forest for each tile in viewport
    for (let c = viewport.startTile[0]; c < viewport.endTile[0]; c++) {
      for (let r = viewport.startTile[1]; r < viewport.endTile[1]; r++) {
        const xOffset = viewport.offset[0] + (c * tileSize);
        const yOffset = viewport.offset[1] + (r * tileSize);
        const tile = getTile(0, c, r);
        
        // Render forest overlay if tile is in forest range
        if (tile >= 1 && tile < 2) {
          this.renderForestTile(
            tile, c, r, pc, pr,
            xOffset, yOffset, tileSize,
            ctx, Img
          );
        }
      }
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ForestRenderer = ForestRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ForestRenderer;
}
