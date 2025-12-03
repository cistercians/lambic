/**
 * WorldMapHoverHandler - Handles mouse hover interactions on the world map
 * 
 * Extracted from client.js for better organization.
 */

class WorldMapHoverHandler {
  constructor(canvas, renderWorldMapWithHighlightFn) {
    this.canvas = canvas;
    this.renderWorldMapWithHighlight = renderWorldMapWithHighlightFn;
    this.hoveredFeature = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (event) => {
      if (!window.worldMapFeatures || window.worldMapFeatures.length === 0) {
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const mapX = mouseX / window.worldMapPixelSize;
      const mapY = mouseY / window.worldMapPixelSize;

      // Find feature under mouse
      let featureUnderMouse = null;
      for (let i = 0; i < window.worldMapFeatures.length; i++) {
        const feature = window.worldMapFeatures[i];
        if (feature.tileArray && feature.bounds) {
          if (mapX >= feature.bounds.minC && mapX <= feature.bounds.maxC &&
              mapY >= feature.bounds.minR && mapY <= feature.bounds.maxR) {
            const tileCol = Math.floor(mapX);
            const tileRow = Math.floor(mapY);
            if (feature.tileArray) {
              for (let j = 0; j < feature.tileArray.length; j++) {
                const tile = feature.tileArray[j];
                if (tile[0] === tileCol && tile[1] === tileRow) {
                  featureUnderMouse = feature;
                  break;
                }
              }
            }
            if (featureUnderMouse) break;
          }
        }
      }

      // If we found a different feature, redraw the map with highlighting
      if (featureUnderMouse !== this.hoveredFeature) {
        this.hoveredFeature = featureUnderMouse;
        if (window.lastWorldMapData && this.renderWorldMapWithHighlight) {
          this.renderWorldMapWithHighlight(
            window.lastWorldMapData.terrain,
            window.lastWorldMapData.mapSize,
            window.lastWorldMapData.playerX,
            window.lastWorldMapData.playerY,
            window.lastWorldMapData.tileSize,
            window.lastWorldMapData.features,
            this.hoveredFeature
          );
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoveredFeature) {
        this.hoveredFeature = null;
        if (window.lastWorldMapData && this.renderWorldMapWithHighlight) {
          this.renderWorldMapWithHighlight(
            window.lastWorldMapData.terrain,
            window.lastWorldMapData.mapSize,
            window.lastWorldMapData.playerX,
            window.lastWorldMapData.playerY,
            window.lastWorldMapData.tileSize,
            window.lastWorldMapData.features,
            null
          );
        }
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.WorldMapHoverHandler = WorldMapHoverHandler;
}

