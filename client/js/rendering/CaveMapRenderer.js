/**
 * CaveMapRenderer - Handles cave map rendering
 * 
 * Separates cave map rendering logic from client.js
 */

class CaveMapRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Initialize renderer
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Render cave map
   * @param {Array} terrainData - Terrain data array
   * @param {number} mapSize - Map size in tiles
   * @param {number} playerX - Player X coordinate
   * @param {number} playerY - Player Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @param {Array} blockingItems - Blocking items
   */
  render(terrainData, mapSize, playerX, playerY, tileSize, blockingItems) {
    if (!this.ctx || !this.canvas) {
      console.warn('[CaveMapRenderer] Not initialized');
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Calculate scale
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = canvasSize / mapSize;
    
    // Store mapSize and pixelSize for player position rendering
    this.lastMapSize = mapSize;
    this.lastPixelSize = pixelSize;

    // Render cave terrain (with blocking items check)
    if (terrainData) {
      for (var r = 0; r < mapSize; r++) {
        for (var c = 0; c < mapSize; c++) {
          var terrainValue = (terrainData[r] && terrainData[r][c] !== undefined) ? terrainData[r][c] : 0;
          var color = this.getCaveTerrainColor(terrainValue, c, r, blockingItems);
          
          this.ctx.fillStyle = color;
          this.ctx.fillRect(
            c * pixelSize,
            r * pixelSize,
            Math.ceil(pixelSize),
            Math.ceil(pixelSize)
          );
        }
      }
    }

    // Render player position
    this.renderPlayerPosition(playerX, playerY, tileSize);
  }

  /**
   * Get cave terrain color based on value
   * @param {number} value - Terrain value
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {object} blockingItems - Blocking items map
   * @returns {string} Color hex code
   */
  getCaveTerrainColor(value, c, r, blockingItems) {
    if (value == null || value === undefined) return '#444444'; // Default dark grey (floor)
    
    var terrainType = Math.floor(value); // Get the integer part
    
    // Check for blocking items first (overrides terrain)
    var tileKey = `${c},${r}`;
    if (blockingItems && blockingItems[tileKey]) {
      return '#8b4513'; // Brown for blocked items (crates, barrels, chests)
    }
    
    // Map terrain type to color
    if (terrainType === 0) return '#444444';  // Cave floor - dark grey
    if (terrainType === 1) return '#888888';  // Cave wall - grey
    if (terrainType === 2) return '#ffffff';  // Cave exit - white
    if (terrainType >= 3 && terrainType <= 5) return '#aaaaaa';  // Mineable rocks (3, 4, 5) - light grey
    
    // Default to dark grey (floor)
    return '#444444';
  }

  /**
   * Render cave terrain
   * @param {Array} terrainData - Terrain data (2D array: terrainData[r][c])
   * @param {number} mapSize - Map size
   * @param {number} tileSize - Tile size
   */
  renderCaveTerrain(terrainData, mapSize, tileSize) {
    if (!this.ctx || !terrainData) return;
    
    // Calculate scale to fit the entire map in the canvas
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = canvasSize / mapSize;
    
    // Draw terrain
    for (var r = 0; r < mapSize; r++) {
      for (var c = 0; c < mapSize; c++) {
        var terrainValue = (terrainData[r] && terrainData[r][c] !== undefined) ? terrainData[r][c] : 0;
        var color = this.getCaveTerrainColor(terrainValue, c, r, null);
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
          c * pixelSize,
          r * pixelSize,
          Math.ceil(pixelSize),
          Math.ceil(pixelSize)
        );
      }
    }
  }

  /**
   * Render blocking items
   * @param {Array} blockingItems - Blocking items map (key: "c,r", value: item data)
   * @param {number} tileSize - Tile size
   */
  renderBlockingItems(blockingItems, tileSize) {
    if (!this.ctx || !blockingItems) return;
    
    // Calculate scale - use stored values from last render call if available
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = this.lastPixelSize || (this.lastMapSize ? canvasSize / this.lastMapSize : canvasSize / 128);
    var mapSize = this.lastMapSize || 128;
    
    // Draw blocking items
    for (var key in blockingItems) {
      var parts = key.split(',');
      var c = parseInt(parts[0]);
      var r = parseInt(parts[1]);
      
      this.ctx.fillStyle = '#8b4513'; // Brown for blocked items
      this.ctx.fillRect(
        c * pixelSize,
        r * pixelSize,
        Math.ceil(pixelSize),
        Math.ceil(pixelSize)
      );
    }
  }

  /**
   * Render player position marker
   * @param {number} playerX - Player X
   * @param {number} playerY - Player Y
   * @param {number} tileSize - Tile size
   */
  renderPlayerPosition(playerX, playerY, tileSize) {
    if (!this.ctx) return;
    
    // Use stored mapSize and pixelSize from render call
    var mapSize = this.lastMapSize || 128;
    var pixelSize = this.lastPixelSize || (Math.min(this.canvas.width, this.canvas.height) / mapSize);
    
    var playerCol = Math.floor(playerX / tileSize);
    var playerRow = Math.floor(playerY / tileSize);
    
    // Draw player position as red X
    this.ctx.strokeStyle = '#ff0000';
    this.ctx.lineWidth = Math.max(3, pixelSize * 1.2);
    this.ctx.lineCap = 'round';
    
    var markerSize = pixelSize * 5;
    var centerX = (playerCol + 0.5) * pixelSize;
    var centerY = (playerRow + 0.5) * pixelSize;
    
    // Draw X
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - markerSize / 2, centerY - markerSize / 2);
    this.ctx.lineTo(centerX + markerSize / 2, centerY + markerSize / 2);
    this.ctx.moveTo(centerX + markerSize / 2, centerY - markerSize / 2);
    this.ctx.lineTo(centerX - markerSize / 2, centerY + markerSize / 2);
    this.ctx.stroke();
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CaveMapRenderer = CaveMapRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaveMapRenderer;
}
