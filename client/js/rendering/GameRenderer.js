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
    
    // Pre-allocated render stats to avoid object creation each frame
    this._renderStats = {
      entitiesIterated: { players: 0, items: 0, arrows: 0, buildings: 0 },
      entitiesRendered: { players: 0, items: 0, arrows: 0, buildings: 0 },
      frameTimes: [],
      lastLog: Date.now()
    };
    
    // Cached entity arrays - updated once per frame
    this._cachedItems = [];
    this._cachedPlayers = [];
    this._cachedArrows = [];
    this._cachedBuildings = [];
    
    // Cached viewport bounds - computed once per frame
    this._viewBounds = { top: 0, left: 0, right: 0, bottom: 0 };
    this._cachedPlayerBuilding = null;
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
    
    // Initialize global render stats if not already done (for PerformanceHUD)
    if (!window._renderStats) {
      window._renderStats = this._renderStats;
    }
    
    // Reset render stats for this frame (reuse existing object to avoid allocation)
    const stats = this._renderStats;
    stats.entitiesIterated.players = 0;
    stats.entitiesIterated.items = 0;
    stats.entitiesIterated.arrows = 0;
    stats.entitiesIterated.buildings = 0;
    stats.entitiesRendered.players = 0;
    stats.entitiesRendered.items = 0;
    stats.entitiesRendered.arrows = 0;
    stats.entitiesRendered.buildings = 0;
    
    // Cache entity arrays once per frame using Object.values (faster than for...in)
    this._cachedItems = (Item && Item.list) ? Object.values(Item.list) : [];
    this._cachedPlayers = (Player && Player.list) ? Object.values(Player.list) : [];
    this._cachedArrows = (Arrow && Arrow.list) ? Object.values(Arrow.list) : [];
    this._cachedBuildings = (Building && Building.list) ? Object.values(Building.list) : [];
    
    // Cache viewport bounds once per frame
    if (viewport && config.tileSize) {
      this._viewBounds.top = (viewport.startTile[1] - 1) * config.tileSize;
      this._viewBounds.left = (viewport.startTile[0] - 1) * config.tileSize;
      this._viewBounds.right = (viewport.endTile[0] + 2) * config.tileSize;
      this._viewBounds.bottom = (viewport.endTile[1] + 2) * config.tileSize;
    }
    
    // Cache player building once per frame (for indoor rendering)
    // Use includeWallsAndTopPlot=true so stairs (on wall tiles) still resolve to the building
    if ((currentZ === 1 || currentZ === 2) && typeof selfId !== 'undefined' && Player.list && Player.list[selfId]) {
      this._cachedPlayerBuilding = getBuilding(Player.list[selfId].x, Player.list[selfId].y, true);
    } else {
      this._cachedPlayerBuilding = null;
    }
    
    // Note: renderMap() is called in GameLoopManager BEFORE renderUnified()
    // so we don't need to call it here again. The zoom transform is also
    // already applied in GameLoopManager, so we work within that transform.
    // ctx.restore() is also called in GameLoopManager after renderUnified().
    
    // Render entities based on mode
    this.renderEntities(config);
    
    // Render lighting and effects
    this.renderLightingAndEffects(config);
    
    // Note: ctx.restore() is called in GameLoopManager after renderUnified()
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
      if (typeof window !== 'undefined' && typeof window.renderForest === 'function') {
        window.renderForest();
      }
    }
    renderTops();
    
    // FALCONS (render above forest)
    this.renderPlayers(config, visibilityCheck, true);
    
    // BUILDINGS
    this.renderBuildings(config, visibilityCheck);
    
    // TILE HIGHLIGHTS (render on top of everything)
    this.renderTileHighlights(config);
    
    // ENTITY BORDERS (render on top of entities, shows hover/selection borders)
    if(typeof drawEntityBorders === 'function') {
      drawEntityBorders(this.ctx);
    }
  }
  
  /**
   * Render tile highlights for navigation clicks
   */
  renderTileHighlights(config) {
    const { viewport, tileSize } = config;
    if (!viewport || !tileSize) return;
    
    // Get highlights from TileHighlightSystem
    const highlightSystem = typeof window !== 'undefined' && window.tileHighlights 
      ? window.tileHighlights 
      : null;
    
    if (!highlightSystem || typeof highlightSystem.getHighlights !== 'function') return;
    
    const highlights = highlightSystem.getHighlights();
    if (!highlights || highlights.length === 0) return;
    
    const ctx = this.ctx;
    if (!ctx) return;
    
    ctx.save();
    ctx.globalAlpha = 1.0; // Will be set per highlight
    
    for (const highlight of highlights) {
      const { tileX, tileY, z, alpha } = highlight;
      
      // Only render highlights on current Z level
      const currentZ = config.currentZ;
      if (z !== currentZ) continue;
      
      // Convert tile coordinates to screen coordinates
      const screenX = tileX * tileSize + viewport.offset[0];
      const screenY = tileY * tileSize + viewport.offset[1];
      
      // Check if highlight is visible on screen
      if (screenX < -tileSize || screenX > this.ctx.canvas.width + tileSize ||
          screenY < -tileSize || screenY > this.ctx.canvas.height + tileSize) {
        continue;
      }
      
      // Draw highlight with fade
      ctx.globalAlpha = alpha || 0.5;
      ctx.fillStyle = 'rgba(255, 255, 0, 0.6)'; // Yellow highlight
      ctx.fillRect(screenX, screenY, tileSize, tileSize);
    }
    
    ctx.restore();
  }
  
  /**
   * Get appropriate visibility check function for current mode
   * Uses cached viewport bounds to avoid recalculation per entity
   */
  getVisibilityCheck(config) {
    const { mode, currentZ, viewport, tileSize } = config;
    const bounds = this._viewBounds;
    const playerBuilding = this._cachedPlayerBuilding;
    
    if (mode === 'spectate' || mode === 'godmode') {
      // Spectate/God mode: simple inView check using cached bounds
      return (entity) => {
        if (entity.z !== currentZ) return false;
        // Use global inView function if available
        // For falcons, pass false for innaWoods since they should always be visible
        if (typeof inView === 'function') {
          const entityInnaWoods = entity.class === 'Falcon' ? false : entity.innaWoods;
          return inView(entity.z, entity.x, entity.y, entityInnaWoods);
        }
        // Fallback: cached bounds check
        return entity.x > bounds.left && entity.x < bounds.right && 
               entity.y > bounds.top && entity.y < bounds.bottom;
      };
    } else if (mode === 'login') {
      // Login camera: inViewLogin check using cached bounds
      return (entity) => {
        if (entity.z !== 0) return false;
        // Use global inViewLogin function if available
        if (typeof inViewLogin === 'function') {
          return inViewLogin(entity.x, entity.y);
        }
        // Fallback: cached bounds check
        return entity.x > bounds.left && entity.x < bounds.right && 
               entity.y > bounds.top && entity.y < bounds.bottom;
      };
    } else {
      // Normal mode: optimized checkInView with building filtering
      if (!viewport || !tileSize) return () => false;
      const playerInnaWoods = typeof selfId !== 'undefined' && Player.list && Player.list[selfId] 
        ? Player.list[selfId].innaWoods 
        : false;
      const isIndoor = (currentZ === 1 || currentZ === 2);
      const checkBuilding = isIndoor && playerBuilding !== null;
      
      return (entity) => {
        // Z-level check
        if (entity.z !== currentZ) return false;
        // Bounds check using cached bounds
        if (entity.x <= bounds.left || entity.x >= bounds.right || 
            entity.y <= bounds.top || entity.y >= bounds.bottom) return false;
        // InnaWoods check (exclude falcons - they fly above and should always be visible)
        if (currentZ === 0 && entity.class !== 'Falcon' && entity.innaWoods && !playerInnaWoods) return false;
        // Building check for z=1 or z=2 using cached player building
        if (checkBuilding) {
          // Use includeWallsAndTopPlot=true since entities can be on wall tiles
          const entityBuilding = getBuilding(entity.x, entity.y, true);
          if (playerBuilding !== entityBuilding) return false;
        }
        return true;
      };
    }
  }
  
  /**
   * Render items
   */
  renderItems(config, visibilityCheck) {
    const { mode, currentZ, tileSize } = config;
    const items = this._cachedItems;
    const stats = this._renderStats;
    const playerBuilding = this._cachedPlayerBuilding;
    const isIndoor = (currentZ === 1 || currentZ === 2);
    const normalIndoor = mode === 'normal' && isIndoor && playerBuilding !== null;
    
    for (let i = 0, len = items.length; i < len; i++) {
      const item = items[i];
      if (!item) continue;
      
      stats.entitiesIterated.items++;
      
      if (visibilityCheck(item)) {
        stats.entitiesRendered.items++;
        // Special handling for buildings (z=1, z=2) in normal mode
        if (normalIndoor) {
          // Use includeWallsAndTopPlot=true to find items on wall tiles (like Furnace, WallTorch, etc.)
          const itemBuilding = getBuilding(item.x, item.y, true);
          const itemBuildingAdjusted = getBuilding(item.x, item.y + (tileSize * 1.1), true);
          
          if (itemBuilding === playerBuilding || itemBuildingAdjusted === playerBuilding) {
            item.draw();
          }
        } else {
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
    const players = this._cachedPlayers;
    const stats = this._renderStats;
    const playerBuilding = this._cachedPlayerBuilding;
    const isIndoor = (currentZ === 1 || currentZ === 2);
    const checkBuilding = mode === 'normal' && !falconsOnly && isIndoor && playerBuilding !== null;
    
    for (let i = 0, len = players.length; i < len; i++) {
      const player = players[i];
      if (!player) continue;
      
      const isFalcon = player.class === 'Falcon';
      if (isFalcon !== falconsOnly) continue;
      
      stats.entitiesIterated.players++;
      
      if (visibilityCheck(player)) {
        stats.entitiesRendered.players++;
        // Additional building check for normal mode (skip for falcons)
        if (checkBuilding) {
          const entityBuilding = getBuilding(player.x, player.y, true);
          if (playerBuilding !== entityBuilding) continue;
        }
        
        player.draw();
      }
    }
  }
  
  /**
   * Render arrows
   */
  renderArrows(config, visibilityCheck) {
    const arrows = this._cachedArrows;
    const stats = this._renderStats;
    
    for (let i = 0, len = arrows.length; i < len; i++) {
      const arrow = arrows[i];
      if (!arrow) continue;
      
      stats.entitiesIterated.arrows++;
      
      if (visibilityCheck(arrow)) {
        stats.entitiesRendered.arrows++;
        arrow.draw();
      }
    }
  }
  
  /**
   * Render buildings
   */
  renderBuildings(config, visibilityCheck) {
    const buildings = this._cachedBuildings;
    const stats = this._renderStats;
    
    for (let i = 0, len = buildings.length; i < len; i++) {
      const building = buildings[i];
      if (!building) continue;
      
      stats.entitiesIterated.buildings++;
      
      if (visibilityCheck(building)) {
        stats.entitiesRendered.buildings++;
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
    
    // Render rain only when outdoors (z=0) - indoors should not show weather
    if (currentZ === 0) {
      renderRain();
    }
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

