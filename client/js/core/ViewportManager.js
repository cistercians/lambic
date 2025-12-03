/**
 * ViewportManager - Manages viewport calculations and screen-to-world coordinate conversion
 * 
 * Extracted from client.js for better organization.
 */

class ViewportManager {
  constructor() {
    this.screen = [0, 0]; // [width, height]
    this.startTile = [0, 0]; // [startColumn, startRow]
    this.endTile = [0, 0]; // [endColumn, endRow]
    this.offset = [0, 0]; // [xOffset, yOffset]
  }

  /**
   * Update viewport based on camera position and zoom
   * @param {number} cameraX - Camera X coordinate
   * @param {number} cameraY - Camera Y coordinate
   * @param {number} zoom - Zoom level
   * @param {number} tileSize - Tile size in pixels
   * @param {number} mapSize - Map size in tiles
   */
  update(cameraX, cameraY, zoom, tileSize, mapSize) {
    zoom = zoom || 1.0;
    
    // Calculate viewport - account for zoom if canvas transform is active
    // When zoom transform is enabled via ctx.scale(zoom, zoom):
    // - When zoomed in (zoom > 1), tiles appear bigger, so fewer tiles fit on screen
    // - When zoomed out (zoom < 1), tiles appear smaller, so more tiles fit on screen
    // The canvas is scaled, so the effective screen size in world space is screenSize / zoom
    // We need to render enough tiles to cover this expanded/reduced world space
    const worldSpaceWidth = this.screen[0] / zoom;
    const worldSpaceHeight = this.screen[1] / zoom;
    
    // Add buffer tiles to avoid seeing edges when zoomed out
    // Buffer needs to be larger when zoomed out to prevent edge artifacts
    const baseBufferTiles = 2;
    const bufferTiles = Math.max(baseBufferTiles, Math.ceil(baseBufferTiles / zoom));
    const tilesWide = Math.ceil(worldSpaceWidth / tileSize) + (bufferTiles * 2);
    const tilesHigh = Math.ceil(worldSpaceHeight / tileSize) + (bufferTiles * 2);

    // Offset calculation for canvas with zoom transform
    // The canvas transform is: translate(WIDTH/2, HEIGHT/2) -> scale(zoom) -> translate(-WIDTH/2, -HEIGHT/2)
    // This means world coordinates are transformed to screen coordinates
    // The offset positions tiles so the camera appears at screen center
    // Since the transform handles scaling, offset just needs to center the camera
    this.offset[0] = this.screen[0] / 2 - cameraX;
    this.offset[1] = this.screen[1] / 2 - cameraY;

    // Camera position in tile coordinates
    const cameraTileX = cameraX / tileSize;
    const cameraTileY = cameraY / tileSize;

    // Start tile is camera position minus half the visible tiles
    this.startTile[0] = Math.floor(cameraTileX - tilesWide / 2);
    this.startTile[1] = Math.floor(cameraTileY - tilesHigh / 2);

    // Clamp to map boundaries
    if (this.startTile[0] < 0) {
      this.startTile[0] = 0;
    }
    if (this.startTile[1] < 0) {
      this.startTile[1] = 0;
    }

    this.endTile[0] = this.startTile[0] + tilesWide;
    this.endTile[1] = this.startTile[1] + tilesHigh;

    if (this.endTile[0] >= mapSize) {
      this.endTile[0] = mapSize;
    }
    if (this.endTile[1] >= mapSize) {
      this.endTile[1] = mapSize;
    }
  }

  /**
   * Set screen dimensions
   * @param {number} width - Screen width
   * @param {number} height - Screen height
   */
  setScreenSize(width, height) {
    this.screen = [width, height];
  }

  /**
   * Get screen dimensions
   * @returns {Array} [width, height]
   */
  getScreenSize() {
    return this.screen;
  }

  /**
   * Get viewport bounds
   * @returns {object} Viewport bounds { startTile, endTile, offset }
   */
  getBounds() {
    return {
      startTile: [...this.startTile],
      endTile: [...this.endTile],
      offset: [...this.offset]
    };
  }
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.ViewportManager = ViewportManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ViewportManager;
}
