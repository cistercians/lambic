/**
 * MapCoordinateHelper - Helper functions for map coordinates and tile calculations
 * 
 * Extracted from client.js for better organization.
 */

class MapCoordinateHelper {
  constructor() {
    // Dependencies would be injected
  }

  /**
   * Get tile value at coordinates
   * @param {number} l - Layer (z-level)
   * @param {number} c - Column (tile X)
   * @param {number} r - Row (tile Y)
   * @param {object} world - World data
   * @returns {number} Tile value or 0
   */
  getTile(l, c, r, world) {
    if (!world || !world[l] || !world[l][r]) return 0;
    const value = world[l][r][c];
    return value !== undefined ? value : 0;
  }

  /**
   * Get location (tile coordinates) from world coordinates
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @returns {Array} Location [column, row]
   */
  getLoc(x, y, tileSize) {
    return [
      Math.floor(x / tileSize),
      Math.floor(y / tileSize)
    ];
  }

  /**
   * Get tile type from layer and world coordinates
   * @param {number} l - Layer (z-level)
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @param {object} world - World data
   * @returns {number} Tile value or 0
   */
  getLocTile(l, x, y, tileSize, world) {
    const loc = this.getLoc(x, y, tileSize);
    return this.getTile(l, loc[0], loc[1], world);
  }

  /**
   * Get world coordinates from tile location
   * @param {number} c - Column (tile X)
   * @param {number} r - Row (tile Y)
   * @param {number} tileSize - Tile size in pixels
   * @returns {Array} World coordinates [x, y]
   */
  getCoords(c, r, tileSize) {
    return [
      c * tileSize,
      r * tileSize
    ];
  }

  /**
   * Get building ID from world coordinates
   * @param {number} x - World X coordinate
   * @param {number} y - World Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @param {object} BuildingList - Building list
   * @param {boolean} includeWallsAndTopPlot - If true, also check walls and topPlot tiles (for item ownership, rendering)
   * @returns {string|null} Building ID or null
   */
  getBuilding(x, y, tileSize, BuildingList, includeWallsAndTopPlot = false) {
    const loc = this.getLoc(x, y, tileSize);
    if (!loc || loc.length < 2) return null;

    for (const id in BuildingList) {
      const b = BuildingList[id];
      if (!b || !b.plot || !Array.isArray(b.plot)) continue;

      // Check ground floor plot
      // Note: plot refers to tiles that form the foundation during construction,
      // which become the walkable floor space inside the building at z=1.
      for (let n = 0; n < b.plot.length; n++) {
        const plotTile = b.plot[n];
        if (!plotTile || !Array.isArray(plotTile) || plotTile.length < 2) continue;

        if (plotTile[0] === loc[0] && plotTile[1] === loc[1]) {
          return b.id;
        }
      }
      
      // Optionally check walls and topPlot (for item ownership, rendering, etc.)
      // walls and topPlot are visual elements - on z=0 those coordinates are walkable outside areas
      // but items spawned on these tiles still belong to the building
      if (includeWallsAndTopPlot) {
        // Check topPlot
        if (b.topPlot && Array.isArray(b.topPlot)) {
          for (let n = 0; n < b.topPlot.length; n++) {
            const topTile = b.topPlot[n];
            if (!topTile || !Array.isArray(topTile) || topTile.length < 2) continue;

            if (topTile[0] === loc[0] && topTile[1] === loc[1]) {
              return b.id;
            }
          }
        }
        
        // Check walls
        if (b.walls && Array.isArray(b.walls)) {
          for (let n = 0; n < b.walls.length; n++) {
            const wallTile = b.walls[n];
            if (!wallTile || !Array.isArray(wallTile) || wallTile.length < 2) continue;

            if (wallTile[0] === loc[0] && wallTile[1] === loc[1]) {
              return b.id;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if a tile in a building's plot is non-walkable
   * @param {object} building - Building object
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @returns {boolean} Is non-walkable
   */
  isTileNonWalkable(building, tileX, tileY, tileSize) {
    if (!building || !building.plot || !Array.isArray(building.plot)) {
      return true; // Default to solid
    }

    // Get building center location
    const buildingLoc = this.getLoc(building.x, building.y, tileSize);
    const buildingCenterX = buildingLoc[0];
    const buildingCenterY = buildingLoc[1];

    // Calculate relative position from building center
    const relX = tileX - buildingCenterX;
    const relY = tileY - buildingCenterY;

    // Check if tile is in building's plot
    let tileInPlot = false;
    for (let i = 0; i < building.plot.length; i++) {
      const plotTile = building.plot[i];
      if (plotTile && plotTile.length >= 2 && plotTile[0] === tileX && plotTile[1] === tileY) {
        tileInPlot = true;
        break;
      }
    }

    // If tile is not in the plot, it's walkable
    if (!tileInPlot) {
      return false;
    }

    // For docks specifically: only the center tile is non-walkable
    if (building.type === 'dock') {
      return (relX === 0 && relY === 0);
    }

    // For other buildings, all plot tiles are non-walkable
    return true;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.MapCoordinateHelper = MapCoordinateHelper;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapCoordinateHelper;
}
