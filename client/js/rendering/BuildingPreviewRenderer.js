/**
 * BuildingPreviewRenderer - Manages building placement preview
 * 
 * Extracted from client.js for better organization.
 */

class BuildingPreviewRenderer {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Render building preview at mouse position
   * @param {object} config - Preview configuration
   * @param {boolean} config.buildPreviewMode - Is preview mode active?
   * @param {string} config.buildPreviewType - Building type to preview
   * @param {string} config.selfId - Player ID
   * @param {object} config.mousePos - Mouse position {x, y}
   * @param {object} config.viewport - Viewport object
   * @param {number} config.tileSize - Tile size in pixels
   * @param {object} config.ctx - Canvas context
   * @param {object} config.world - World terrain data
   * @returns {object|null} Preview data {tileX, tileY, valid}
   */
  render(config) {
    const {
      buildPreviewMode,
      buildPreviewType,
      selfId,
      mousePos,
      viewport,
      tileSize,
      ctx,
      world
    } = config;

    if (!buildPreviewMode || !buildPreviewType || !selfId) {
      return null;
    }

    // Get mouse position relative to canvas
    const canvas = document.getElementById('ctx');
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = mousePos.x - rect.left;
    const mouseY = mousePos.y - rect.top;

    // Convert to world coordinates using viewport offset
    const worldX = mouseX - viewport.offset[0];
    const worldY = mouseY - viewport.offset[1];

    // Snap to tile grid - this will be the player's standing position (plot origin [0,0])
    const playerTileX = Math.floor(worldX / tileSize);
    const playerTileY = Math.floor(worldY / tileSize);

    // Get building definition for plot
    const buildingDef = this.getBuildingDefinition(buildPreviewType);
    if (!buildingDef) return null;

    // Check if all tiles are valid
    let allValid = true;
    let hasAnyInvalid = false;

    // Draw preview tiles
    ctx.save();
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < buildingDef.plot.length; i++) {
      const plotTile = buildingDef.plot[i];
      // Add offset from player position (which is the origin [0,0] of the building plot)
      const previewTileX = playerTileX + plotTile[0];
      const previewTileY = playerTileY + plotTile[1];

      // Convert to screen coordinates using viewport offset
      const screenX = previewTileX * tileSize + viewport.offset[0];
      const screenY = previewTileY * tileSize + viewport.offset[1];

      // Determine tile color based on validation
      let tileColor = '#ff6666'; // Default red for blocked
      const isValid = this.isValidTileForBuilding(previewTileX, previewTileY, world);
      const isClearable = this.isClearableTile(previewTileX, previewTileY, world);

      if (isValid || isClearable) {
        tileColor = '#66ff66'; // Green for valid/clearable
      } else {
        tileColor = '#ff6666'; // Red for blocked
        hasAnyInvalid = true;
        allValid = false;
      }

      // Draw preview tile
      ctx.fillStyle = tileColor;
      ctx.fillRect(screenX, screenY, tileSize, tileSize);
    }

    ctx.restore();

    // Return preview data
    return {
      tileX: playerTileX,
      tileY: playerTileY,
      valid: allValid
    };
  }

  /**
   * Check if tile is valid for building
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {object} world - World terrain data
   * @returns {boolean} Is valid
   */
  isValidTileForBuilding(tileX, tileY, world) {
    // Simplified validation - check if tile is empty or grass
    if (world && world[0] && world[0][tileY] && world[0][tileY][tileX] !== undefined) {
      const terrainValue = world[0][tileY][tileX];
      const terrainType = Math.floor(terrainValue);
      return terrainType === 7; // Empty/Grass
    }
    return false;
  }

  /**
   * Check if tile can be cleared
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {object} world - World terrain data
   * @returns {boolean} Is clearable
   */
  isClearableTile(tileX, tileY, world) {
    // Check if tile can be cleared (brush, light forest)
    if (world && world[0] && world[0][tileY] && world[0][tileY][tileX] !== undefined) {
      const terrainValue = world[0][tileY][tileX];
      const terrainType = Math.floor(terrainValue);
      return terrainType === 3 || terrainType === 2; // Brush or Light Forest
    }
    return false;
  }

  /**
   * Get building definition including plot
   * @param {string} buildingType - Building type
   * @returns {object|null} Building definition with plot array
   */
  getBuildingDefinition(buildingType) {
    // Building plot definitions
    const buildingPlots = {
      'farm': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
      'hut': [[0,0]], // 1x1
      'cottage': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
      'tavern': [[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 5x4 irregular
      'tower': [[0,0]], // 1x1
      'forge': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]], // 3x2
      'fort': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
      'outpost': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
      'monastery': [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 4x4
      'lumbermill': [[0,0],[1,0]], // 2x1
      'mine': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
      'dock': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2],[0,-3],[1,-3],[2,-3]], // 3x4
      'stable': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
      'market': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
      'garrison': [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 4x3
      'stronghold': [[2,0],[3,0],[4,0],[5,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[7,-2],[0,-3],[1,-3],[2,-3],[3,-3],[4,-3],[5,-3],[6,-3],[7,-3],[0,-4],[1,-4],[2,-4],[3,-4],[4,-4],[5,-4],[6,-4],[7,-4],[0,-5],[1,-5],[2,-5],[3,-5],[4,-5],[5,-5],[6,-5],[7,-5],[1,-6],[2,-6],[3,-6],[4,-6],[5,-6],[6,-6],[7,-6],[1,-7],[2,-7],[3,-7],[4,-7],[5,-7],[6,-7],[7,-7]], // Large irregular
      'wall': [[0,0]], // 1x1
      'gate': [[0,0]], // 1x1
      'guardtower': [[0,0],[1,0],[0,-1],[1,-1]] // 2x2
    };

    const plot = buildingPlots[buildingType];
    if (!plot) return null;

    return {
      plot: plot
    };
  }

  /**
   * Check if building placement is valid
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {string} buildingType - Building type
   * @param {object} world - World terrain data
   * @returns {boolean} Is valid placement
   */
  isValidBuildingPlacement(tileX, tileY, buildingType, world) {
    if (!buildingType) return false;

    const buildingDef = this.getBuildingDefinition(buildingType);
    if (!buildingDef) return false;

    // Check all tiles in the building plot
    for (let i = 0; i < buildingDef.plot.length; i++) {
      const plotTile = buildingDef.plot[i];
      const checkTileX = tileX + plotTile[0];
      const checkTileY = tileY + plotTile[1];

      // Check if tile is valid or clearable
      if (!this.isValidTileForBuilding(checkTileX, checkTileY, world) && 
          !this.isClearableTile(checkTileX, checkTileY, world)) {
        return false;
      }
    }

    return true;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.BuildingPreviewRenderer = BuildingPreviewRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuildingPreviewRenderer;
}
