// client/js/BuildingPreview.js
// Client-side building preview and tile overlay system

class BuildingPreviewRenderer {
  constructor() {
    this.isActive = false;
    this.currentPreview = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
    this.previewTimeout = null;
    this.tileSize = 64; // Should match server TILE_SIZE
    
    // Initialize overlay after a short delay to ensure game canvas is ready
    setTimeout(() => {
      this.initializeOverlay();
    }, 1000);
  }

  // Initialize the overlay canvas
  initializeOverlay() {
    // Create overlay canvas
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.id = 'building-preview-overlay';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '1000';
    this.overlayCanvas.style.opacity = '0.7';
    
    // Add to gameDiv (same container as game canvas)
    const gameDiv = document.getElementById('gameDiv');
    if (gameDiv) {
      gameDiv.appendChild(this.overlayCanvas);
    } else {
      // Fallback to body if gameDiv not found
      document.body.appendChild(this.overlayCanvas);
    }
    
    // Get context
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    
    // Set canvas size to match game canvas
    this.resizeOverlay();
    
    // Listen for window resize
    window.addEventListener('resize', () => this.resizeOverlay());
  }

  // Resize overlay canvas to match game canvas
  resizeOverlay() {
    const gameCanvas = document.getElementById('ctx');
    if (gameCanvas) {
      this.overlayCanvas.width = gameCanvas.width;
      this.overlayCanvas.height = gameCanvas.height;
      this.overlayCanvas.style.width = gameCanvas.style.width;
      this.overlayCanvas.style.height = gameCanvas.style.height;
      this.overlayCanvas.style.left = gameCanvas.style.left;
      this.overlayCanvas.style.top = gameCanvas.style.top;
      
      console.log('BuildingPreview: Overlay canvas resized to match game canvas');
      console.log('Game canvas position:', gameCanvas.style.left, gameCanvas.style.top);
      console.log('Overlay canvas position:', this.overlayCanvas.style.left, this.overlayCanvas.style.top);
    } else {
      console.log('BuildingPreview: Game canvas not found for resizing');
    }
  }

  // Show building preview
  showPreview(previewData) {
    console.log('BuildingPreview: showPreview called with data:', previewData);
    
    this.isActive = true;
    this.currentPreview = previewData;
    
    // Clear any existing timeout
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
    }
    
    // Clear overlay
    this.clearOverlay();
    
    // Draw preview
    this.drawPreview(previewData);
    
    // Auto-hide after 10 seconds
    this.previewTimeout = setTimeout(() => {
      this.hidePreview();
    }, 10000);
  }

  // Hide building preview
  hidePreview() {
    this.isActive = false;
    this.currentPreview = null;
    this.clearOverlay();
    
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }

  // Clear the overlay
  clearOverlay() {
    if (this.overlayCtx) {
      this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }

  // Draw the building preview
  drawPreview(previewData) {
    if (!this.overlayCtx || !previewData) return;

    const { buildingType, tiles, clearableTiles, blockedTiles, canBuild } = previewData;
    
    // Draw valid tiles (green)
    this.drawTileOverlays(tiles, 'rgba(0, 255, 0, 0.3)', 'Valid');
    
    // Draw clearable tiles (yellow/orange)
    this.drawTileOverlays(clearableTiles, 'rgba(255, 165, 0, 0.3)', 'Clearable');
    
    // Draw blocked tiles (red)
    this.drawTileOverlays(blockedTiles, 'rgba(255, 0, 0, 0.3)', 'Blocked');
    
    // Draw building name and status
    this.drawBuildingInfo(buildingType, canBuild, tiles.length, clearableTiles.length, blockedTiles.length);
  }

  // Draw tile overlays
  drawTileOverlays(tiles, color, label) {
    if (!tiles || tiles.length === 0) return;

    this.overlayCtx.fillStyle = color;

    for (const tile of tiles) {
      const screenPos = this.worldToScreen(tile.x, tile.y);
      if (screenPos) {
        // Draw filled rectangle (no outline) - just the highlighted body
        this.overlayCtx.fillRect(
          screenPos.x, 
          screenPos.y, 
          this.tileSize, 
          this.tileSize
        );
      }
    }
  }

  // Draw building information
  drawBuildingInfo(buildingType, canBuild, validCount, clearableCount, blockedCount) {
    const gameCanvas = document.getElementById('ctx');
    if (!gameCanvas) return;

    const infoX = 10;
    const infoY = 10;
    const lineHeight = 20;
    
    this.overlayCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.overlayCtx.fillRect(infoX - 5, infoY - 5, 300, 120);
    
    this.overlayCtx.fillStyle = 'white';
    this.overlayCtx.font = '16px Arial';
    this.overlayCtx.fillText(`Building: ${buildingType}`, infoX, infoY);
    
    this.overlayCtx.font = '14px Arial';
    this.overlayCtx.fillText(`Status: ${canBuild ? 'Can Build' : 'Cannot Build'}`, infoX, infoY + lineHeight);
    
    this.overlayCtx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    this.overlayCtx.fillText(`Valid tiles: ${validCount}`, infoX, infoY + lineHeight * 2);
    
    this.overlayCtx.fillStyle = 'rgba(255, 165, 0, 0.8)';
    this.overlayCtx.fillText(`Clearable tiles: ${clearableCount}`, infoX, infoY + lineHeight * 3);
    
    this.overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    this.overlayCtx.fillText(`Blocked tiles: ${blockedCount}`, infoX, infoY + lineHeight * 4);
    
    this.overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.overlayCtx.font = '12px Arial';
    this.overlayCtx.fillText('Press ESC to close preview', infoX, infoY + lineHeight * 5);
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX, worldY) {
    // This needs to match the client's coordinate system
    if (typeof selfId === 'undefined' || !Player.list[selfId]) {
      return null;
    }

    const player = Player.list[selfId];
    
    // Use the client's viewport system
    if (typeof viewport === 'undefined') {
      return null;
    }
    
    // Convert tile coordinates to pixel coordinates
    const tilePixelX = worldX * this.tileSize;
    const tilePixelY = worldY * this.tileSize;
    
    // Apply viewport offset (this matches the client's rendering system)
    const screenX = tilePixelX + viewport.offset[0];
    const screenY = tilePixelY + viewport.offset[1];
    
    // Check if tile is visible on screen
    if (screenX < -this.tileSize || screenX > WIDTH + this.tileSize ||
        screenY < -this.tileSize || screenY > HEIGHT + this.tileSize) {
      return null;
    }
    
    return { x: screenX, y: screenY };
  }

  // Handle keyboard input
  handleKeyPress(keyCode) {
    if (keyCode === 27) { // ESC key
      this.hidePreview();
      return true;
    }
    return false;
  }

  // Update preview (called when player moves)
  updatePreview() {
    if (this.isActive && this.currentPreview) {
      // Redraw the preview with new camera position
      this.clearOverlay();
      this.drawPreview(this.currentPreview);
    }
  }
}

// Global instance
window.buildingPreviewRenderer = new BuildingPreviewRenderer();

// Handle keyboard events
document.addEventListener('keydown', (event) => {
  if (window.buildingPreviewRenderer.handleKeyPress(event.keyCode)) {
    event.preventDefault();
  }
});

// Update preview when game renders
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (window.buildingPreviewRenderer) {
      window.buildingPreviewRenderer.updatePreview();
    }
  }, 100); // Update 10 times per second
}
