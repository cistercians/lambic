/**
 * WorldMapRenderer - Handles world map rendering
 * 
 * Separates world map rendering logic from client.js
 */

class WorldMapRenderer {
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
   * Render world map
   * @param {Array} terrainData - Terrain data array
   * @param {number} mapSize - Map size in tiles
   * @param {number} playerX - Player X coordinate
   * @param {number} playerY - Player Y coordinate
   * @param {number} tileSize - Tile size in pixels
   * @param {Array} features - Map features
   * @param {object} highlightedFeature - Feature to highlight (optional)
   */
  render(terrainData, mapSize, playerX, playerY, tileSize, features, highlightedFeature) {
    if (!this.ctx || !this.canvas) {
      console.warn('[WorldMapRenderer] Not initialized');
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Store data for mouse hover functionality
    if (typeof window !== 'undefined') {
      window.lastWorldMapData = {
        terrain: terrainData,
        mapSize: mapSize,
        playerX: playerX,
        playerY: playerY,
        tileSize: tileSize,
        features: features
      };
    }

    // Render terrain
    this.renderTerrain(terrainData, mapSize, tileSize);

    // Render features (stores for hover detection)
    if (features && features.length > 0) {
      this.renderFeatures(features, tileSize);
    }

    // Render player position
    this.renderPlayerPosition(playerX, playerY, tileSize);
    
    // Render highlight if provided
    if (highlightedFeature) {
      this.highlightFeature(highlightedFeature, tileSize);
    }
  }

  /**
   * Get terrain color based on value
   * @param {number} value - Terrain value
   * @returns {string} Color hex code
   */
  getTerrainColor(value) {
    if (value == null || value === undefined) return '#449944'; // Default grass
    
    var terrainType = Math.floor(value); // Get the integer part for range (1.5 -> 1)
    
    // Map terrain type to color
    if (terrainType === 0) return '#4466ff';  // Water - blue
    if (terrainType === 1) return '#114411';  // Heavy Forest - dark green
    if (terrainType === 2) return '#1a661a';  // Light Forest - medium-dark green
    if (terrainType === 3) return '#228822';  // Brush/Grass - medium green
    if (terrainType === 4) return '#555555';  // Rocks - dark gray
    if (terrainType === 5) return '#999999';  // Mountain - light grey
    if (terrainType === 6) return '#000000';  // Cave entrance - black
    if (terrainType === 7) return '#449944';  // Empty - darker green/grass
    
    // Farm tiles (seed, growing, ready) - darker orange
    if (terrainType >= 8 && terrainType <= 10) return '#dd8822';  // Darker orange
    
    // Other building-related tiles (build markers, doors, floors, roads, etc.)
    if (terrainType >= 11 && terrainType <= 19) return '#442211';  // Dark brown
    
    // Any other unknown values
    return '#449944'; // Default darker green/grass
  }

  /**
   * Render terrain
   * @param {Array} terrainData - Terrain data (2D array: terrainData[r][c])
   * @param {number} mapSize - Map size
   * @param {number} tileSize - Tile size
   */
  renderTerrain(terrainData, mapSize, tileSize) {
    if (!this.ctx || !terrainData) return;
    
    // Calculate scale to fit the entire map in the canvas
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = canvasSize / mapSize;
    
    // Draw terrain
    for (var r = 0; r < mapSize; r++) {
      for (var c = 0; c < mapSize; c++) {
        var terrainValue = (terrainData[r] && terrainData[r][c] !== undefined) ? terrainData[r][c] : 7;
        var color = this.getTerrainColor(terrainValue);
        
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
   * Render features
   * @param {Array} features - Map features
   * @param {number} tileSize - Tile size
   */
  renderFeatures(features, tileSize) {
    if (!features || features.length === 0) return;
    
    // Store features for hover detection
    if (typeof window !== 'undefined') {
      window.worldMapFeatures = features;
      
      // Calculate pixel size for hover detection
      var mapSize = window.lastWorldMapData ? window.lastWorldMapData.mapSize : 128;
      var canvasSize = Math.min(this.canvas.width, this.canvas.height);
      var pixelSize = canvasSize / mapSize;
      window.worldMapPixelSize = pixelSize;
      window.worldMapCanvasSize = canvasSize;
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
    
    // Use stored mapSize from render call
    var mapSize = (typeof window !== 'undefined' && window.lastWorldMapData) 
      ? window.lastWorldMapData.mapSize 
      : 128;
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = canvasSize / mapSize;
    
    var playerCol = Math.floor(playerX / tileSize);
    var playerRow = Math.floor(playerY / tileSize);
    
    // Draw player position as red X (same as cave map)
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

  /**
   * Render world map with highlight
   * @param {Array} terrainData - Terrain data
   * @param {number} mapSize - Map size
   * @param {number} playerX - Player X
   * @param {number} playerY - Player Y
   * @param {number} tileSize - Tile size
   * @param {Array} features - Features
   * @param {object} highlightedFeature - Feature to highlight
   */
  renderWithHighlight(terrainData, mapSize, playerX, playerY, tileSize, features, highlightedFeature) {
    this.render(terrainData, mapSize, playerX, playerY, tileSize, features);
    
    if (highlightedFeature) {
      this.highlightFeature(highlightedFeature, tileSize);
    }
  }

  /**
   * Highlight a feature
   * @param {object} feature - Feature to highlight
   * @param {number} tileSize - Tile size
   */
  highlightFeature(feature, tileSize) {
    if (!this.ctx || !feature || !feature.tileArray) return;
    
    // Calculate scale
    var mapSize = (typeof window !== 'undefined' && window.lastWorldMapData) 
      ? window.lastWorldMapData.mapSize 
      : 128;
    var canvasSize = Math.min(this.canvas.width, this.canvas.height);
    var pixelSize = canvasSize / mapSize;
    
    // Draw highlighted feature overlay
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; // Yellow highlight with transparency
    
    feature.tileArray.forEach((tile) => {
      var c = tile[0];
      var r = tile[1];
      this.ctx.fillRect(
        c * pixelSize,
        r * pixelSize,
        Math.ceil(pixelSize),
        Math.ceil(pixelSize)
      );
    });
    
    // Draw feature border
    var bounds = feature.bounds;
    if (bounds) {
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = Math.max(2, pixelSize * 0.3);
      this.ctx.strokeRect(
        bounds.minC * pixelSize,
        bounds.minR * pixelSize,
        (bounds.maxC - bounds.minC + 1) * pixelSize,
        (bounds.maxR - bounds.minR + 1) * pixelSize
      );
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.WorldMapRenderer = WorldMapRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldMapRenderer;
}
