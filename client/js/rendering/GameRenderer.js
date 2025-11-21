/**
 * Unified Game Rendering System
 * Consolidates all rendering paths (normal, spectate, login, god mode) into one system
 */

class GameRenderer {
  constructor(ctx, lighting) {
    this.ctx = ctx;
    this.lighting = lighting;
    this.currentZoom = 1.0;
    this.targetZoom = 1.0;
    this.zoomTransitionSpeed = 0.1;
  }
  
  /**
   * Main unified render function - handles all camera modes
   * @param {Object} config - Rendering configuration
   * @param {string} config.mode - 'normal', 'spectate', 'login', or 'godmode'
   * @param {Object} config.camera - Camera position {x, y, z}
   * @param {Object} config.viewport - Viewport bounds
   * @param {boolean} config.nightfall - Is it nighttime?
   * @param {number} config.currentZ - Current Z level
   */
  render(config) {
    const { mode, camera, viewport, nightfall, currentZ } = config;
    
    // Update and apply zoom
    this.updateZoom(config);
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.ctx.save();
    this.applyZoomTransform();
    
    // Render map terrain
    renderMap();
    
    // Render entities based on mode
    this.renderEntities(config);
    
    // Render lighting and effects
    this.renderLightingAndEffects(config);
    
    this.ctx.restore();
    
    // Update viewport
    viewport.update(camera.x, camera.y, this.currentZoom);
  }
  
  /**
   * Update zoom level with smooth transitions
   */
  updateZoom(config) {
    this.targetZoom = getTargetZoom();
    
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.01) {
      const zoomDiff = this.targetZoom - this.currentZoom;
      this.currentZoom += zoomDiff * this.zoomTransitionSpeed;
    } else {
      this.currentZoom = this.targetZoom;
    }
  }
  
  /**
   * Apply zoom transformation to context
   */
  applyZoomTransform() {
    this.ctx.translate(WIDTH/2, HEIGHT/2);
    this.ctx.scale(this.currentZoom, this.currentZoom);
    this.ctx.translate(-WIDTH/2, -HEIGHT/2);
  }
  
  /**
   * Render all entities (items, players, arrows, buildings, etc.)
   */
  renderEntities(config) {
    const { mode, currentZ } = config;
    
    // Choose visibility check function based on mode
    const visibilityCheck = this.getVisibilityCheck(config);
    
    // ITEMS
    this.renderItems(config, visibilityCheck);
    
    // PLAYERS (non-falcons)
    this.renderPlayers(config, visibilityCheck, false);
    
    // ARROWS
    if(mode !== 'login') {
      this.renderArrows(config, visibilityCheck);
    }
    
    // FOREST OVERLAY (z=0 only)
    if(currentZ === 0) {
      renderForest();
    }
    renderTops();
    
    // FALCONS (render above forest)
    this.renderPlayers(config, visibilityCheck, true);
    
    // BUILDINGS
    this.renderBuildings(config, visibilityCheck);
  }
  
  /**
   * Get appropriate visibility check function for current mode
   */
  getVisibilityCheck(config) {
    const { mode, currentZ, viewport } = config;
    
    if(mode === 'spectate' || mode === 'godmode') {
      // Spectate/God mode: simple inView check
      return (entity) => {
        return inView(entity.z, entity.x, entity.y, entity.innaWoods) && entity.z === currentZ;
      };
    } else if(mode === 'login') {
      // Login camera: inViewLogin check
      return (entity) => {
        return inViewLogin(entity.x, entity.y) && entity.z === 0;
      };
    } else {
      // Normal mode: optimized checkInView with building filtering
      const viewTop = (viewport.startTile[1] - 1) * tileSize;
      const viewLeft = (viewport.startTile[0] - 1) * tileSize;
      const viewRight = (viewport.endTile[0] + 2) * tileSize;
      const viewBottom = (viewport.endTile[1] + 2) * tileSize;
      const playerInnaWoods = Player.list[selfId] ? Player.list[selfId].innaWoods : false;
      
      return (entity) => {
        // Z-level check
        if(entity.z !== currentZ) return false;
        // Bounds check
        if(entity.x <= viewLeft || entity.x >= viewRight || 
           entity.y <= viewTop || entity.y >= viewBottom) return false;
        // InnaWoods check
        if(currentZ === 0 && entity.innaWoods && !playerInnaWoods) return false;
        // Building check for z=1 or z=2
        if((currentZ === 1 || currentZ === 2) && Player.list[selfId]) {
          const playerBuilding = getBuilding(Player.list[selfId].x, Player.list[selfId].y);
          const entityBuilding = getBuilding(entity.x, entity.y);
          if(playerBuilding !== entityBuilding) return false;
        }
        return true;
      };
    }
  }
  
  /**
   * Render items
   */
  renderItems(config, visibilityCheck) {
    const { mode, currentZ } = config;
    
    for(const i in Item.list) {
      const item = Item.list[i];
      if(!item) continue;
      
      if(visibilityCheck(item)) {
        // Special handling for buildings (z=1, z=2) in normal mode
        if(mode === 'normal' && (currentZ === 1 || currentZ === 2) && Player.list[selfId]) {
          const playerBuilding = getBuilding(Player.list[selfId].x, Player.list[selfId].y);
          const itemBuilding = getBuilding(item.x, item.y);
          const itemBuildingAdjusted = getBuilding(item.x, item.y + (tileSize * 1.1));
          
          if(itemBuilding === playerBuilding || itemBuildingAdjusted === playerBuilding) {
            item.draw();
          }
        } else if(mode !== 'normal' || (currentZ !== 1 && currentZ !== 2)) {
          item.draw();
        }
      }
    }
  }
  
  /**
   * Render players
   * @param {boolean} falconsOnly - If true, only render falcons; if false, only non-falcons
   */
  renderPlayers(config, visibilityCheck, falconsOnly) {
    const { mode, currentZ } = config;
    
    for(const i in Player.list) {
      const player = Player.list[i];
      if(!player) continue;
      
      const isFalcon = player.class === 'Falcon';
      if(isFalcon !== falconsOnly) continue;
      
      if(visibilityCheck(player)) {
        // Additional building check for normal mode
        if(mode === 'normal' && !isFalcon && (currentZ === 1 || currentZ === 2) && Player.list[selfId]) {
          const playerBuilding = getBuilding(Player.list[selfId].x, Player.list[selfId].y);
          const entityBuilding = getBuilding(player.x, player.y);
          if(playerBuilding !== entityBuilding) continue;
        }
        
        player.draw();
      }
    }
  }
  
  /**
   * Render arrows
   */
  renderArrows(config, visibilityCheck) {
    for(const i in Arrow.list) {
      const arrow = Arrow.list[i];
      if(!arrow) continue;
      
      if(visibilityCheck(arrow)) {
        arrow.draw();
      }
    }
  }
  
  /**
   * Render buildings
   */
  renderBuildings(config, visibilityCheck) {
    for(const i in Building.list) {
      const building = Building.list[i];
      if(!building) continue;
      
      if(visibilityCheck(building)) {
        building.draw();
      }
    }
  }
  
  /**
   * Render lighting, light sources, and weather effects
   */
  renderLightingAndEffects(config) {
    const { currentZ, nightfall } = config;
    
    // Render lighting overlay
    renderLighting();
    
    // Render light sources based on z-level and time
    if(currentZ === 0) {
      renderLightSources(nightfall ? 2 : 1);
    } else if(currentZ === 1 || currentZ === 2) {
      renderLightSources(1);
    } else if(currentZ === -1 || currentZ === -2) {
      renderLightSources(3);
      
      // For caves/cellars, composite the dark layer canvas on top of lighting canvas
      // (after light sources have cut holes in the dark layer)
      if(darkLayerCanvas && darkLayerCtx) {
        lighting.save();
        lighting.globalCompositeOperation = 'source-over';
        lighting.drawImage(darkLayerCanvas, 0, 0);
        lighting.restore();
      }
    }
    
    // Render rain if active
    renderRain();
  }
}

// Create global instance
const gameRenderer = new GameRenderer(
  document.getElementById('ctx').getContext('2d'),
  document.getElementById('lighting').getContext('2d')
);

// Export for use in other modules
if(typeof module !== 'undefined' && module.exports) {
  module.exports = gameRenderer;
}

