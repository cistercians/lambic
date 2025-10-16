// Optimized Client-Side Rendering System
class OptimizedRenderer {
  constructor(canvas, lightingCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lightingCanvas = lightingCanvas;
    this.lightingCtx = lightingCanvas.getContext('2d');
    
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Viewport management
    this.viewport = {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height
    };
    
    // Rendering optimization
    this.dirtyRegions = [];
    this.lastRenderTime = 0;
    this.targetFPS = 60;
    this.frameTime = 1000 / this.targetFPS;
    
    // Entity tracking
    this.visibleEntities = new Map();
    this.lastEntityPositions = new Map();
    
    // Performance monitoring
    this.renderStats = {
      framesRendered: 0,
      entitiesRendered: 0,
      averageFrameTime: 0,
      skippedFrames: 0
    };
  }
  
  // Update viewport position
  updateViewport(x, y) {
    const oldX = this.viewport.x;
    const oldY = this.viewport.y;
    
    this.viewport.x = x - this.viewport.width / 2;
    this.viewport.y = y - this.viewport.height / 2;
    
    // Mark viewport change as dirty region
    this.markDirtyRegion(oldX, oldY, this.viewport.width, this.viewport.height);
    this.markDirtyRegion(this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height);
  }
  
  // Mark a region as needing redraw
  markDirtyRegion(x, y, width, height) {
    this.dirtyRegions.push({
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(this.width, width),
      height: Math.min(this.height, height)
    });
  }
  
  // Check if entity is in viewport
  isEntityVisible(entity) {
    const margin = 100; // Extra margin for smooth scrolling
    return entity.x >= this.viewport.x - margin &&
           entity.x <= this.viewport.x + this.viewport.width + margin &&
           entity.y >= this.viewport.y - margin &&
           entity.y <= this.viewport.y + this.viewport.height + margin;
  }
  
  // Optimized render function
  render(world, entities) {
    const startTime = performance.now();
    
    // Skip frame if not enough time has passed
    if (startTime - this.lastRenderTime < this.frameTime) {
      this.renderStats.skippedFrames++;
      return;
    }
    
    // Clear only dirty regions
    this.clearDirtyRegions();
    
    // Render world tiles in viewport
    this.renderWorldTiles(world);
    
    // Render visible entities
    this.renderVisibleEntities(entities);
    
    // Render lighting
    this.renderLighting();
    
    // Update stats
    this.updateRenderStats(startTime);
    
    // Clear dirty regions
    this.dirtyRegions = [];
    this.lastRenderTime = startTime;
  }
  
  // Clear only dirty regions instead of entire canvas
  clearDirtyRegions() {
    for (const region of this.dirtyRegions) {
      this.ctx.clearRect(region.x, region.y, region.width, region.height);
    }
  }
  
  // Render world tiles in viewport
  renderWorldTiles(world) {
    const tileSize = 64; // Assuming 64px tiles
    const startX = Math.floor(this.viewport.x / tileSize);
    const startY = Math.floor(this.viewport.y / tileSize);
    const endX = Math.ceil((this.viewport.x + this.viewport.width) / tileSize);
    const endY = Math.ceil((this.viewport.y + this.viewport.height) / tileSize);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (world[y] && world[y][x] !== undefined) {
          const tileX = x * tileSize - this.viewport.x;
          const tileY = y * tileSize - this.viewport.y;
          
          // Only render if tile is in dirty region
          if (this.isInDirtyRegion(tileX, tileY, tileSize, tileSize)) {
            this.renderTile(world[y][x], tileX, tileY);
          }
        }
      }
    }
  }
  
  // Render visible entities
  renderVisibleEntities(entities) {
    for (const entity of entities) {
      if (this.isEntityVisible(entity)) {
        const entityX = entity.x - this.viewport.x;
        const entityY = entity.y - this.viewport.y;
        
        // Check if entity moved (needs redraw)
        const lastPos = this.lastEntityPositions.get(entity.id);
        if (!lastPos || 
            Math.abs(lastPos.x - entityX) > 1 || 
            Math.abs(lastPos.y - entityY) > 1) {
          
          // Clear old position
          if (lastPos) {
            this.markDirtyRegion(lastPos.x - 32, lastPos.y - 32, 64, 64);
          }
          
          // Render entity at new position
          this.renderEntity(entity, entityX, entityY);
          
          // Update position tracking
          this.lastEntityPositions.set(entity.id, { x: entityX, y: entityY });
          
          this.renderStats.entitiesRendered++;
        }
      }
    }
  }
  
  // Check if region intersects with any dirty region
  isInDirtyRegion(x, y, width, height) {
    for (const region of this.dirtyRegions) {
      if (x < region.x + region.width &&
          x + width > region.x &&
          y < region.y + region.height &&
          y + height > region.y) {
        return true;
      }
    }
    return false;
  }
  
  // Render individual tile (placeholder - implement based on your tile system)
  renderTile(tileType, x, y) {
    // This would be implemented based on your specific tile rendering system
    // For now, just a placeholder
    this.ctx.fillStyle = '#8B4513'; // Brown for dirt
    this.ctx.fillRect(x, y, 64, 64);
  }
  
  // Render individual entity (placeholder - implement based on your entity system)
  renderEntity(entity, x, y) {
    // This would be implemented based on your specific entity rendering system
    // For now, just a placeholder
    this.ctx.fillStyle = '#FF0000'; // Red for entities
    this.ctx.fillRect(x - 16, y - 16, 32, 32);
  }
  
  // Render lighting effects
  renderLighting() {
    // Implement lighting rendering
    // This would handle day/night cycle, torches, etc.
  }
  
  // Update rendering statistics
  updateRenderStats(startTime) {
    const frameTime = performance.now() - startTime;
    this.renderStats.framesRendered++;
    this.renderStats.averageFrameTime = 
      (this.renderStats.averageFrameTime + frameTime) / 2;
  }
  
  // Get rendering statistics
  getStats() {
    return {
      ...this.renderStats,
      visibleEntities: this.visibleEntities.size,
      dirtyRegions: this.dirtyRegions.length
    };
  }
  
  // Force full redraw (for debugging)
  forceFullRedraw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.markDirtyRegion(0, 0, this.width, this.height);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedRenderer;
} else {
  window.OptimizedRenderer = OptimizedRenderer;
}

