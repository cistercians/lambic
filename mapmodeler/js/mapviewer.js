// MapModeler Map Viewer
// Handles canvas-based map rendering similar to the game's WorldMap feature

class MapViewer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.currentMap = null;
    this.mapSize = 192;
    this.tileSize = 64;
    
    // Terrain color mapping (based on game's terrain constants from client.js)
    this.terrainColors = {
      0: '#4466ff',      // Water - blue
      1: '#114411',      // Heavy Forest - dark green
      2: '#1a661a',      // Light Forest - medium-dark green
      3: '#228822',      // Brush/Grass - medium green
      4: '#555555',      // Rocks - dark gray
      5: '#999999',      // Mountain - light grey
      6: '#000000',      // Cave Entrance - black
      7: '#449944'       // Empty - darker green/grass
    };
    
    this.setupCanvas();
  }
  
  setupCanvas() {
    // Set canvas size to fit container
    const container = this.canvas.parentElement;
    const maxSize = Math.min(container.clientWidth - 20, container.clientHeight - 100);
    this.canvas.width = maxSize;
    this.canvas.height = maxSize;
    
    // Update canvas size display
    const canvasSizeElement = document.getElementById('canvas-size');
    if (canvasSizeElement) {
      canvasSizeElement.textContent = `${this.canvas.width}x${this.canvas.height}`;
    }
  }
  
  renderMap(mapData) {
    if (!mapData || !mapData.terrain) {
      console.error('Invalid map data provided');
      return;
    }
    
    this.currentMap = mapData;
    this.mapSize = mapData.mapSize;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate pixel size per tile
    const pixelSize = Math.min(this.canvas.width, this.canvas.height) / this.mapSize;
    
    // Render each tile
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tileValue = mapData.terrain[y][x];
        const color = this.getTerrainColor(tileValue);
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(
          x * pixelSize,
          y * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
    
    // Update generation stats
    this.updateGenerationStats(mapData);
  }
  
  getTerrainColor(tileValue) {
    // Handle fractional tile values and ranges exactly like the game
    // From genesis.js terraform function:
    // 0 = Water
    // 1.0-1.9 = Heavy Forest (with random 0.0-0.9)
    // 2.0-2.9 = Light Forest
    // 3.0-3.9 = Brush
    // 4.0-4.9 = Rocks
    // 5.0-5.9 = Mountain
    // 6.0 = Cave Entrance
    
    const intValue = Math.floor(tileValue);
    
    if (intValue === 0) return this.terrainColors[0]; // Water - #4466ff
    if (tileValue >= 1 && tileValue < 2) return this.terrainColors[1]; // Heavy Forest - #114411
    if (tileValue >= 2 && tileValue < 3) return this.terrainColors[2]; // Light Forest - #1a661a
    if (tileValue >= 3 && tileValue < 4) return this.terrainColors[3]; // Brush - #228822
    if (tileValue >= 4 && tileValue < 5) return this.terrainColors[4]; // Rocks - #555555
    if (tileValue >= 5 && tileValue < 6) return this.terrainColors[5]; // Mountain - #999999
    if (intValue === 6) return this.terrainColors[6]; // Cave Entrance - #000000
    
    // Default fallback
    return this.terrainColors[7]; // Empty - #449944
  }
  
  updateGenerationStats(mapData) {
    const lastGeneratedElement = document.getElementById('last-generated');
    const genTimeElement = document.getElementById('gen-time');
    
    if (lastGeneratedElement) {
      const now = new Date();
      lastGeneratedElement.textContent = now.toLocaleTimeString();
    }
    
    if (genTimeElement && mapData.generationTime) {
      const genTime = Date.now() - mapData.generationTime;
      genTimeElement.textContent = `${genTime}ms`;
    }
    
    // Calculate terrain distribution
    this.calculateTerrainDistribution(mapData.terrain);
  }
  
  calculateTerrainDistribution(terrain) {
    const distribution = {
      water: 0,
      heavyForest: 0,
      lightForest: 0,
      brush: 0,
      rocks: 0,
      mountain: 0,
      caveEntrance: 0
    };
    
    for (let y = 0; y < this.mapSize; y++) {
      for (let x = 0; x < this.mapSize; x++) {
        const tileValue = terrain[y][x];
        
        // Match exact ranges from genesis.js
        if (tileValue === 0) distribution.water++;
        else if (tileValue >= 1 && tileValue < 2) distribution.heavyForest++;
        else if (tileValue >= 2 && tileValue < 3) distribution.lightForest++;
        else if (tileValue >= 3 && tileValue < 4) distribution.brush++;
        else if (tileValue >= 4 && tileValue < 5) distribution.rocks++;
        else if (tileValue >= 5 && tileValue < 6) distribution.mountain++;
        else if (tileValue === 6) distribution.caveEntrance++;
      }
    }
    
    // Store distribution for export
    this.currentDistribution = distribution;
  }
  
  // Get current map data for export
  getCurrentMapData() {
    return {
      map: this.currentMap,
      distribution: this.currentDistribution,
      canvasSize: { width: this.canvas.width, height: this.canvas.height },
      mapSize: this.mapSize
    };
  }
  
  // Handle window resize
  handleResize() {
    this.setupCanvas();
    if (this.currentMap) {
      this.renderMap(this.currentMap);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapViewer;
} else {
  window.MapViewer = MapViewer;
}

