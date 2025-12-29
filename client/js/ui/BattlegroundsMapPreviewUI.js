/**
 * BattlegroundsMapPreviewUI - Manages the map preview display for Battlegrounds
 * Shows map preview for 10 seconds before match starts
 * Reuses WorldMapRenderer for regular maps, CaveMapRenderer for caves, and a custom renderer for dungeons
 */

class BattlegroundsMapPreviewUI {
  constructor() {
    this.isActive = false;
    this.previewData = null;
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.worldMapRenderer = null;
    this.caveMapRenderer = null;
    this.dungeonMapRenderer = null;
    this.timeout = null;
  }

  /**
   * Initialize the UI container and canvas
   */
  init() {
    if (this.container) return; // Already initialized

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'battlegrounds-map-preview-ui';
    this.container.style.position = 'fixed';
    this.container.style.top = '50%';
    this.container.style.left = '50%';
    this.container.style.transform = 'translate(-50%, -50%)';
    this.container.style.width = '800px';
    this.container.style.height = '600px';
    this.container.style.maxWidth = '90vw';
    this.container.style.maxHeight = '80vh';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    this.container.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    this.container.style.borderRadius = '10px';
    this.container.style.padding = '20px';
    this.container.style.zIndex = '2100'; // Below lobby (2000) but above game (1000)
    this.container.style.pointerEvents = 'none';
    this.container.style.display = 'none';
    this.container.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.9)';

    // Create title
    const title = document.createElement('div');
    title.style.textAlign = 'center';
    title.style.fontSize = '24px';
    title.style.fontWeight = 'bold';
    title.style.color = '#ffd700';
    title.style.marginBottom = '10px';
    title.textContent = 'Map Preview';
    title.id = 'bg-preview-title';
    this.container.appendChild(title);

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'bg-map-preview-canvas';
    this.canvas.width = 760;
    this.canvas.height = 500;
    this.canvas.style.width = '100%';
    this.canvas.style.height = 'auto';
    this.canvas.style.display = 'block';
    this.canvas.style.margin = '0 auto';
    this.canvas.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d');

    // Initialize renderers
    if (typeof WorldMapRenderer !== 'undefined') {
      this.worldMapRenderer = new WorldMapRenderer();
      this.worldMapRenderer.init(this.canvas);
    }

    if (typeof CaveMapRenderer !== 'undefined') {
      this.caveMapRenderer = new CaveMapRenderer();
      this.caveMapRenderer.init(this.canvas);
    }

    // Create dungeon renderer (warmer colors than caves)
    this.dungeonMapRenderer = this.createDungeonRenderer();

    // Add to body
    document.body.appendChild(this.container);
  }

  /**
   * Create a dungeon renderer with warmer colors than caves
   */
  createDungeonRenderer() {
    // Create a custom renderer based on CaveMapRenderer but with warmer colors
    const renderer = {
      canvas: null,
      ctx: null,
      lastMapSize: null,
      lastPixelSize: null,

      init: (canvas) => {
        renderer.canvas = canvas;
        renderer.ctx = canvas.getContext('2d');
      },

      getDungeonTerrainColor: (value, c, r, blockingItems) => {
        if (value == null || value === undefined) return '#664422'; // Default warm dark brown (floor)
        
        const terrainType = Math.floor(value);
        
        // Check for blocking items first (overrides terrain)
        const tileKey = `${c},${r}`;
        if (blockingItems && blockingItems[tileKey]) {
          return '#8b4513'; // Brown for blocked items (crates, barrels, chests)
        }
        
        // Map terrain type to warmer colors (browns/reds/oranges instead of greys)
        if (terrainType === 0) return '#664422';  // Dungeon floor - warm dark brown
        if (terrainType === 1) return '#884422';  // Dungeon wall - warm brown
        if (terrainType === 2) return '#ffaa44';  // Dungeon exit - warm orange/yellow
        if (terrainType >= 3 && terrainType <= 5) return '#aa6644';  // Mineable rocks - warm brown-orange
        
        // Default to warm dark brown (floor)
        return '#664422';
      },

      render: (terrainData, mapSize, playerX, playerY, tileSize, blockingItems) => {
        if (!renderer.ctx || !renderer.canvas) {
          console.warn('[DungeonMapRenderer] Not initialized');
          return;
        }

        // Clear canvas
        renderer.ctx.clearRect(0, 0, renderer.canvas.width, renderer.canvas.height);

        // Calculate scale
        const canvasSize = Math.min(renderer.canvas.width, renderer.canvas.height);
        const pixelSize = canvasSize / mapSize;
        
        // Store mapSize and pixelSize for player position rendering
        renderer.lastMapSize = mapSize;
        renderer.lastPixelSize = pixelSize;

        // Render dungeon terrain (with blocking items check)
        if (terrainData) {
          for (let r = 0; r < mapSize; r++) {
            for (let c = 0; c < mapSize; c++) {
              const terrainValue = (terrainData[r] && terrainData[r][c] !== undefined) ? terrainData[r][c] : 0;
              const color = renderer.getDungeonTerrainColor(terrainValue, c, r, blockingItems);
              
              renderer.ctx.fillStyle = color;
              renderer.ctx.fillRect(
                c * pixelSize,
                r * pixelSize,
                Math.ceil(pixelSize),
                Math.ceil(pixelSize)
              );
            }
          }
        }

        // Spawn points are rendered separately by the main class
      }
    };

    return renderer;
  }

  /**
   * Show the map preview
   * @param {object} previewData - Preview data from server
   * @param {HTMLElement} targetContainer - Optional container to render into (for lobby integration)
   */
  show(previewData, targetContainer = null) {
    this.init();
    this.isActive = true;
    this.previewData = previewData;
    
    // If target container is provided (lobby center), render there instead of separate window
    if (targetContainer) {
      // Don't show the separate container
      if (this.container) {
        this.container.style.display = 'none';
      }
      
      // Render into target container
      this.renderToContainer(targetContainer);
    } else {
      // Show in separate window (legacy behavior)
      this.container.style.display = 'block';
      this.render();
    }

    // Hide after 10 seconds (only if showing in separate window)
    if (!targetContainer) {
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => {
        this.hide();
      }, 10000); // 10 seconds
    }
  }
  
  /**
   * Render map preview into a target container (for lobby integration)
   */
  renderToContainer(targetContainer) {
    if (!this.previewData || !targetContainer) return;
    
    // Clear target container
    targetContainer.innerHTML = '';
    
    // Get container dimensions to fill it better
    // Container is now square (1:1 aspect ratio), so calculate based on width
    const baseSize = 500; // Base square size
    
    // Try to get actual container size, but use defaults if not available
    let canvasSize = baseSize;
    
    try {
      const containerRect = targetContainer.getBoundingClientRect();
      if (containerRect.width > 0) {
        // Account for padding (10px on each side = 20px total)
        const availableSize = Math.min(containerRect.width - 20, containerRect.height - 20);
        canvasSize = Math.max(300, availableSize); // Minimum 300px, use available space
      }
    } catch (e) {
      // Fallback to base dimensions if getBoundingClientRect fails
      console.warn('Could not get container dimensions, using defaults:', e);
    }
    
    // Use square dimensions
    const canvasWidth = canvasSize;
    const canvasHeight = canvasSize;
    
    // Create canvas in target container
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    canvas.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    canvas.style.borderRadius = '5px';
    targetContainer.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // Store original values
    const originalCanvas = this.canvas;
    const originalCtx = this.ctx;
    
    // CRITICAL: Initialize renderers with the new canvas before rendering
    if (this.worldMapRenderer && typeof this.worldMapRenderer.init === 'function') {
      this.worldMapRenderer.init(canvas);
    }
    if (this.caveMapRenderer && typeof this.caveMapRenderer.init === 'function') {
      this.caveMapRenderer.init(canvas);
    }
    if (this.dungeonMapRenderer && this.dungeonMapRenderer.init && typeof this.dungeonMapRenderer.init === 'function') {
      this.dungeonMapRenderer.init(canvas);
    }
    
    // Temporarily swap canvas/ctx to render
    this.canvas = canvas;
    this.ctx = ctx;
    
    // Render
    try {
      this.render();
    } catch (e) {
      console.error('Error rendering map preview to container:', e);
      // Show error message
      targetContainer.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Error rendering map preview: ' + e.message + '</div>';
    }
    
    // Restore original canvas/ctx
    this.canvas = originalCanvas;
    this.ctx = originalCtx;
  }

  /**
   * Hide the map preview
   */
  hide() {
    this.isActive = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.previewData = null;
  }

  /**
   * Render the map preview
   */
  render() {
    if (!this.previewData || !this.canvas || !this.ctx) return;

    const { mapType, mapSize, mapData, gameMode, teams, spawnPoints } = this.previewData;

    // Determine which renderer to use based on map type
    if (mapType === 'caves') {
      this.renderCaveMap(mapData, mapSize, gameMode, teams, spawnPoints);
    } else if (mapType === 'dungeons') {
      this.renderDungeonMap(mapData, mapSize, gameMode, teams, spawnPoints);
    } else {
      // All other map types use WorldMapRenderer
      this.renderWorldMap(mapData, mapSize, gameMode, teams, spawnPoints);
    }
  }

  /**
   * Render world map (for continental, islands, mainland, wild)
   */
  renderWorldMap(mapData, mapSize, gameMode, teams, spawnPoints) {
    if (!this.worldMapRenderer || !mapData || !mapData.worldData) return;

    // Extract terrain data (layer 0 = overworld)
    const terrainData = mapData.worldData[0] || [];

    // Render using WorldMapRenderer
    this.worldMapRenderer.renderTerrain(terrainData, mapSize, 64);

    // Render spawn points
    this.renderSpawnPointsForWorldMap(gameMode, teams, mapSize, spawnPoints);
  }

  /**
   * Render cave map
   */
  renderCaveMap(mapData, mapSize, gameMode, teams, spawnPoints) {
    if (!this.caveMapRenderer || !mapData || !mapData.worldData) return;

    // Extract cave terrain data (layer 1 = underworld/caves)
    const terrainData = mapData.worldData[1] || [];

    // Calculate center point for display
    const centerX = (mapSize * 64) / 2;
    const centerY = (mapSize * 64) / 2;

    // Render using CaveMapRenderer (no blocking items for preview, no player position)
    this.caveMapRenderer.render(terrainData, mapSize, centerX, centerY, 64, null);

    // Render spawn points
    this.renderSpawnPointsForCaveDungeon(gameMode, teams, mapSize, spawnPoints, this.caveMapRenderer);
  }

  /**
   * Render dungeon map
   */
  renderDungeonMap(mapData, mapSize, gameMode, teams, spawnPoints) {
    if (!this.dungeonMapRenderer || !mapData || !mapData.worldData) return;

    // Extract dungeon terrain data (layer 1 = underworld/dungeons)
    const terrainData = mapData.worldData[1] || [];

    // Initialize dungeon renderer if needed
    if (!this.dungeonMapRenderer.ctx) {
      this.dungeonMapRenderer.init(this.canvas);
    }

    // Render using dungeon renderer (warmer colors)
    this.dungeonMapRenderer.render(terrainData, mapSize, 0, 0, 64, null);

    // Render spawn points
    this.renderSpawnPointsForCaveDungeon(gameMode, teams, mapSize, spawnPoints, this.dungeonMapRenderer);
  }

  /**
   * Render spawn points for world map
   */
  renderSpawnPointsForWorldMap(gameMode, teams, mapSize, spawnPoints) {
    if (!this.ctx) return;

    const canvasSize = Math.min(this.canvas.width, this.canvas.height);
    const pixelSize = canvasSize / mapSize;
    const tileSize = 64;

    if (gameMode === 'deathmatch') {
      // Render individual spawn points for deathmatch
      if (spawnPoints && Object.keys(spawnPoints).length > 0) {
        Object.keys(spawnPoints).forEach((playerId, index) => {
          const point = spawnPoints[playerId];
          if (point && point.x !== undefined && point.y !== undefined) {
            const col = Math.floor(point.x / tileSize);
            const row = Math.floor(point.y / tileSize);
            this.renderSpawnMarker(col, row, pixelSize, '#00ff00', index + 1);
          }
        });
      }
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Render team spawn points
      if (spawnPoints && Object.keys(spawnPoints).length > 0) {
        // Group spawn points by team
        const team1Points = [];
        const team2Points = [];
        
        Object.keys(spawnPoints).forEach(playerId => {
          const point = spawnPoints[playerId];
          if (!point || point.x === undefined || point.y === undefined) return;
          
          // Determine team based on player's team assignment
          // For team modes, we can infer from spawn position (left = team1, right = team2)
          const col = Math.floor(point.x / tileSize);
          const isTeam1 = col < mapSize / 2;
          
          if (isTeam1) {
            team1Points.push({ point, playerId });
          } else {
            team2Points.push({ point, playerId });
          }
        });
        
        // Render team 1 spawns (blue)
        team1Points.forEach((item, index) => {
          const col = Math.floor(item.point.x / tileSize);
          const row = Math.floor(item.point.y / tileSize);
          this.renderSpawnMarker(col, row, pixelSize, '#0096ff', 'T1');
        });
        
        // Render team 2 spawns (red)
        team2Points.forEach((item, index) => {
          const col = Math.floor(item.point.x / tileSize);
          const row = Math.floor(item.point.y / tileSize);
          this.renderSpawnMarker(col, row, pixelSize, '#ff0000', 'T2');
        });
      }
    }
  }

  /**
   * Render spawn points for cave/dungeon maps
   */
  renderSpawnPointsForCaveDungeon(gameMode, teams, mapSize, spawnPoints, renderer) {
    if (!this.ctx || !spawnPoints) return;
    
    const canvasSize = Math.min(this.canvas.width, this.canvas.height);
    const pixelSize = canvasSize / mapSize;
    const tileSize = 64;

    if (gameMode === 'deathmatch') {
      // Render individual spawn points for deathmatch
      Object.keys(spawnPoints).forEach((playerId, index) => {
        const point = spawnPoints[playerId];
        if (point && point.x !== undefined && point.y !== undefined) {
          const col = Math.floor(point.x / tileSize);
          const row = Math.floor(point.y / tileSize);
          this.renderSpawnMarker(col, row, pixelSize, '#00ff00', index + 1);
        }
      });
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Render team spawn points
      // Group spawn points by team (infer from spawn position)
      const team1Points = [];
      const team2Points = [];
      
      Object.keys(spawnPoints).forEach(playerId => {
        const point = spawnPoints[playerId];
        if (!point || point.x === undefined || point.y === undefined) return;
        
        const col = Math.floor(point.x / tileSize);
        const isTeam1 = col < mapSize / 2;
        
        if (isTeam1) {
          team1Points.push({ point, playerId });
        } else {
          team2Points.push({ point, playerId });
        }
      });
      
      // Render team 1 spawns (blue)
      team1Points.forEach((item, index) => {
        const col = Math.floor(item.point.x / tileSize);
        const row = Math.floor(item.point.y / tileSize);
        this.renderSpawnMarker(col, row, pixelSize, '#0096ff', 'T1');
      });
      
      // Render team 2 spawns (red)
      team2Points.forEach((item, index) => {
        const col = Math.floor(item.point.x / tileSize);
        const row = Math.floor(item.point.y / tileSize);
        this.renderSpawnMarker(col, row, pixelSize, '#ff0000', 'T2');
      });
    }
  }

  /**
   * Render a spawn marker
   */
  renderSpawnMarker(col, row, pixelSize, color, label) {
    const centerX = (col + 0.5) * pixelSize;
    const centerY = (row + 0.5) * pixelSize;
    const markerSize = pixelSize * 4;

    // Draw circle
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, markerSize, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = Math.max(2, pixelSize * 0.3);
    this.ctx.stroke();

    // Draw label if provided
    if (label) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${Math.max(12, pixelSize * 0.8)}px monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      // Draw text shadow
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillText(label, centerX + 1, centerY + 1);
      // Draw text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(label, centerX, centerY);
    }
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.battlegroundsMapPreviewUI = new BattlegroundsMapPreviewUI();
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattlegroundsMapPreviewUI;
}

