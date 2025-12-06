/**
 * GameLoopManager - Manages the main game loop and rendering cycle
 * 
 * Extracted from client.js for better organization.
 */

class GameLoopManager {
  constructor() {
    this.lastFrameTime = performance.now();
    this.renderStats = null;
    this.initRenderStats();
  }

  /**
   * Initialize rendering performance tracking
   */
  initRenderStats() {
    if (!window._renderStats) {
      window._renderStats = {
        frameTimes: [],
        entitiesIterated: { players: 0, items: 0, arrows: 0, buildings: 0 },
        entitiesRendered: { players: 0, items: 0, arrows: 0, buildings: 0 },
        lastLog: Date.now()
      };
    }
    this.renderStats = window._renderStats;
  }

  /**
   * Main game loop
   * @param {object} config - Configuration object with all dependencies
   */
  gameLoop(currentTime, config) {
    // Read values from config, but also check global scope for updated values
    // This allows world, tileSize, mapSize, and selfId to be updated after game loop starts
    // Always prefer window.selfId if it exists (it gets updated by SocketMessageHandler)
    const selfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null) 
      ? window.selfId 
      : (config.selfId !== undefined ? config.selfId : null);
    const loginCameraSystem = config.loginCameraSystem;
    const spectateCameraSystem = config.spectateCameraSystem;
    const godModeCamera = config.godModeCamera;
    
    // Read world, tileSize, mapSize from global scope if available (they get updated by SocketMessageHandler)
    // Always prefer window.* values if they exist and are valid, as they're updated by SocketMessageHandler
    let world, tileSize, mapSize;
    
    if (typeof window !== 'undefined') {
      // Always read from window if available (SocketMessageHandler sets these)
      // Check if window values exist AND are valid (not empty/zero)
      if (window.world !== undefined && window.world && window.world.length > 0) {
        world = window.world;
      } else {
        world = config.world;
      }
      
      if (window.tileSize !== undefined && window.tileSize > 0) {
        tileSize = window.tileSize;
      } else {
        tileSize = config.tileSize;
      }
      
      if (window.mapSize !== undefined && window.mapSize > 0) {
        mapSize = window.mapSize;
      } else {
        mapSize = config.mapSize;
      }
    } else {
      // Fallback to config if window is not available
      world = config.world;
      tileSize = config.tileSize;
      mapSize = config.mapSize;
    }
    
    // Update config with latest values
    config.world = world;
    config.tileSize = tileSize;
    config.mapSize = mapSize;
    
    const getTargetZoom = config.getTargetZoom;
    let currentZoom = config.currentZoom;
    const zoomTransitionSpeed = config.zoomTransitionSpeed;
    let targetZoom = config.targetZoom;
    const ctx = config.ctx;
    const WIDTH = config.WIDTH;
    const HEIGHT = config.HEIGHT;
    const renderMap = config.renderMap;
    const renderUnified = config.renderUnified;
    const getCurrentZ = config.getCurrentZ;
    let nightfall = config.nightfall;
    
    // Check global scope for updated nightfall
    if (typeof window !== 'undefined' && window.nightfall !== undefined) {
      nightfall = window.nightfall;
      config.nightfall = nightfall;
    }
    
    const getCameraPosition = config.getCameraPosition;
    const getWeatherEffects = config.getWeatherEffects;
    const updateRain = config.updateRain;
    const renderRain = config.renderRain;
    const updatePlayerPortraitHUD = config.updatePlayerPortraitHUD;
    const updateTargetPortraitHUD = config.updateTargetPortraitHUD;
    const renderCursor = config.renderCursor;
    let buildPreviewMode = config.buildPreviewMode;
    const buildPreviewType = config.buildPreviewType;
    const renderBuildingPreview = config.renderBuildingPreview;
    const updateAnimations = config.updateAnimations;
    const Player = config.Player;

    // Calculate delta time since last frame
    let deltaTime = currentTime - this.lastFrameTime;
    
    // Cap deltaTime to prevent fast-forward animations when tab becomes visible again
    // Maximum of 100ms (about 6 frames at 60fps) prevents catch-up effects
    if (deltaTime > 100) {
      deltaTime = 100;
    }
    
    this.lastFrameTime = currentTime;
    
    // Track frame time
    const renderStart = performance.now();
    
    // Update animations based on delta time
    if (updateAnimations) {
      updateAnimations(deltaTime);
    }
    
    // Update god mode camera position
    if (godModeCamera && godModeCamera.update) {
      godModeCamera.update(mapSize, tileSize);
    }
    
    // Check if we should render (either logged in, in login camera mode, or spectating)
    if (!selfId && !loginCameraSystem.isActive && !spectateCameraSystem.isActive) {
      requestAnimationFrame((time) => this.gameLoop(time, config));
      return;
    }
    
    // Don't render until we have world data
    // Note: world is an array, so check length instead of truthiness
    if (!world || world.length === 0 || !tileSize || !mapSize) {
      requestAnimationFrame((time) => this.gameLoop(time, config));
      return;
    }
    
    // Update zoom based on current z-level (buildings/caves) with smooth transition
    const newTargetZoom = getTargetZoom();
    config.targetZoom = newTargetZoom;
    
    // Smoothly interpolate current zoom towards target zoom
    if (Math.abs(config.currentZoom - newTargetZoom) > 0.01) {
      const zoomDiff = newTargetZoom - config.currentZoom;
      config.currentZoom += zoomDiff * zoomTransitionSpeed;
    } else {
      config.currentZoom = newTargetZoom; // Snap to target when very close
    }
    
    // Sync to global currentZoom so lighting system uses correct zoom
    if (typeof window !== 'undefined') {
      window.currentZoom = config.currentZoom;
    }
    
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    
    // Apply zoom transform
    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT / 2);
    ctx.scale(config.currentZoom, config.currentZoom);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
    
    // SPECTATE MODE - Unified rendering
    if (spectateCameraSystem.isActive) {
      // Update spectate camera (target selection and movement)
      spectateCameraSystem.update(Player.list);
      
      const currentZ = getCurrentZ();
      
      // Update viewport BEFORE rendering
      const cameraPos = spectateCameraSystem.getCameraPosition();
      if (config.viewport && config.viewport.update) {
        config.viewport.update(cameraPos.x, cameraPos.y, config.currentZoom, tileSize, mapSize);
      }
      
      // Render map after viewport is updated
      renderMap();
      
      // Use unified rendering function (after viewport is updated)
      renderUnified('spectate', currentZ, nightfall);
    } else if (!selfId || (selfId && !Player.list[selfId])) {
      // LOGIN CAMERA MODE - Unified rendering
      // Continue rendering with login camera until selfId is set AND player entity exists
      // This handles the transition period when selfId is set but player entity hasn't been created yet
      const currentZ = 0; // Login camera always renders z=0
      
      // Update viewport with falcon camera position BEFORE rendering
      // If login camera was stopped, use last known position (cameraX/cameraY) or default
      let cameraPos;
      if (loginCameraSystem.isActive) {
        cameraPos = loginCameraSystem.getCameraPosition(Player.list);
      } else {
        // Fallback: Use last known position stored in cameraX/cameraY
        // If those are invalid (0, NaN, or undefined), use center of map as safe default
        const centerX = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144; // Default to 6144 if mapSize/tileSize not available
        const centerY = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
        
        // Check if cameraX/cameraY are valid (not 0, not NaN, not undefined)
        const hasValidX = loginCameraSystem.cameraX && loginCameraSystem.cameraX > 0 && !isNaN(loginCameraSystem.cameraX);
        const hasValidY = loginCameraSystem.cameraY && loginCameraSystem.cameraY > 0 && !isNaN(loginCameraSystem.cameraY);
        
        cameraPos = {
          x: hasValidX ? loginCameraSystem.cameraX : centerX,
          y: hasValidY ? loginCameraSystem.cameraY : centerY
        };
      }
      
      // Ensure camera position is valid (not NaN, not 0, and within reasonable bounds)
      // Valid positions should be > 0 and within map bounds (0 to mapSize * tileSize)
      const maxCoord = (mapSize && tileSize) ? (mapSize * tileSize) : 12288;
      if (!cameraPos || 
          !cameraPos.x || !cameraPos.y || 
          isNaN(cameraPos.x) || isNaN(cameraPos.y) ||
          cameraPos.x <= 0 || cameraPos.y <= 0 ||
          cameraPos.x > maxCoord || cameraPos.y > maxCoord) {
        const centerX = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
        const centerY = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
        cameraPos = { x: centerX, y: centerY };
      }
      
      if (config.viewport && config.viewport.update) {
        // Validate inputs before updating viewport
        if (cameraPos.x && cameraPos.y && !isNaN(cameraPos.x) && !isNaN(cameraPos.y) && tileSize && mapSize) {
          config.viewport.update(cameraPos.x, cameraPos.y, config.currentZoom, tileSize, mapSize);
        } else {
          // Use safe defaults
          const safeX = cameraPos.x || 6144;
          const safeY = cameraPos.y || 6144;
          const safeTileSize = tileSize || 64;
          const safeMapSize = mapSize || 192;
          config.viewport.update(safeX, safeY, config.currentZoom, safeTileSize, safeMapSize);
        }
      }
      
      // Render map after viewport is updated
      renderMap();
      
      // Use unified rendering function (after viewport is updated)
      renderUnified('login', currentZ, nightfall);
    } else if (selfId && Player.list[selfId]) {
      // NORMAL + GOD MODE - Unified rendering
      const currentZ = getCurrentZ();
      const mode = godModeCamera.isActive ? 'godmode' : 'normal';
      
      // Update viewport BEFORE rendering
      if (godModeCamera.isActive) {
        if (config.viewport && config.viewport.update) {
          config.viewport.update(godModeCamera.cameraX, godModeCamera.cameraY, config.currentZoom, tileSize, mapSize);
        }
      } else {
        const player = Player.list[selfId];
        if (player && player.x && player.y && !isNaN(player.x) && !isNaN(player.y)) {
          if (config.viewport && config.viewport.update) {
            config.viewport.update(player.x, player.y, config.currentZoom, tileSize, mapSize);
          }
        } else {
          // Fallback to center if player position is invalid
          const centerX = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
          const centerY = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
          if (config.viewport && config.viewport.update) {
            config.viewport.update(centerX, centerY, config.currentZoom, tileSize || 64, mapSize || 192);
          }
        }
      }
      
      // Render map after viewport is updated
      renderMap();
      
      // Use unified rendering function (after viewport is updated)
      renderUnified(mode, currentZ, nightfall);
      
      // Render building preview that follows mouse cursor
      if (buildPreviewMode && buildPreviewType) {
        renderBuildingPreview();
      }
    } else {
      // FALLBACK: If none of the conditions are met, render something to prevent black screen
      // This should rarely happen, but it's a safety net
      
      // Use center of map as safe fallback
      const centerX = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
      const centerY = (mapSize && tileSize) ? (mapSize * tileSize) / 2 : 6144;
      
      if (config.viewport && config.viewport.update) {
        config.viewport.update(centerX, centerY, config.currentZoom, tileSize || 64, mapSize || 192);
      }
      
      // Render map with fallback viewport
      renderMap();
      
      // Render with login mode as fallback
      renderUnified('login', 0, nightfall);
    }
    
    // Restore canvas transform after rendering
    ctx.restore();
    
    // Render rain effects AFTER zoom transform is restored (in screen-space)
    // Works for all camera modes (spectate, login, normal)
    const currentZ = getCurrentZ();
    if (currentZ === 0) {
      const cameraPos = getCameraPosition();
      const weatherEffects = getWeatherEffects(cameraPos.x, cameraPos.y, currentZ);
      updateRain(weatherEffects);
      renderRain();
    } else {
      // Clear rain particles when indoors (z > 0) or underground (z < 0)
      updateRain(null);
    }
    
    // Track rendering performance
    const renderTime = performance.now() - renderStart;
    this.renderStats.frameTimes.push(renderTime);
    if (this.renderStats.frameTimes.length > 300) {
      this.renderStats.frameTimes.shift();
    }
    
    // Update stats timestamp (stats are available in PerformanceHUD when enabled)
    const now = Date.now();
    if (now - this.renderStats.lastLog >= 10000) {
      this.renderStats.lastLog = now;
    }
    
    // Hook performance HUD tracking (if enabled)
    if (window.performanceHUD && window.performanceHUD.enabled) {
      window.performanceHUD.recordFrame(deltaTime);
    }
    
    // Update portrait HUDs (real-time HP/Spirit updates)
    updatePlayerPortraitHUD();
    updateTargetPortraitHUD();
    
    // Render custom cursor (after all game content)
    renderCursor();
    
    // Continue the loop
    requestAnimationFrame((time) => this.gameLoop(time, config));
  }

  /**
   * Start the game loop
   * @param {object} config - Configuration object with all dependencies
   */
  start(config) {
    requestAnimationFrame((time) => this.gameLoop(time, config));
  }
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.GameLoopManager = GameLoopManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameLoopManager;
}

