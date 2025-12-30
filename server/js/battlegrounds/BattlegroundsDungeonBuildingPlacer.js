/**
 * BattlegroundsDungeonBuildingPlacer - Places buildings for dungeon maps
 * Works with worldData arrays (not the live game world)
 */

class BattlegroundsDungeonBuildingPlacer {
  constructor() {
    this.TERRAIN = global.TERRAIN || {
      EMPTY: 7,
      WATER: 0,
      MOUNTAIN: 5,
      ROCKS: 4
    };
  }

  /**
   * Place buildings for dungeon map based on game mode
   * Buildings automatically create their cellar plots at z=-2 upon construction
   * @param {Array} worldData - World data array
   * @param {number} mapSize - Map size
   * @param {string} gameMode - 'deathmatch' or 'skirmish'
   * @returns {Array} Array of building placement info: [{type, centerX, centerY, plot, walls, topPlot, cellarPlot, dstairs}]
   */
  placeDungeonBuildings(worldData, mapSize, gameMode) {
    const buildings = [];
    const overworldLayer = worldData[0];
    const cellarLayer = worldData[9]; // z=-2 layer
    
    if (!overworldLayer || !cellarLayer) {
      console.error('[BattlegroundsDungeonBuildingPlacer] Missing worldData layers');
      return buildings;
    }

    // Get building definitions
    const buildingPreview = require('../core/BuildingPreview');
    const buildingDefs = new buildingPreview();
    const strongholdDef = buildingDefs.getBuildingDefinition('stronghold');
    const tavernDef = buildingDefs.getBuildingDefinition('tavern');

    if (!strongholdDef || !tavernDef) {
      console.error('[BattlegroundsDungeonBuildingPlacer] Missing building definitions');
      return buildings;
    }

    // Convert worldData to tilemap format for findBuildingSpot
    // We need to create a temporary tilemap context
    const excludedTiles = [];

    if (gameMode === 'deathmatch') {
      // Deathmatch: 1 stronghold + 1 tavern
      const stronghold = this.placeBuilding(
        'stronghold', 
        strongholdDef, 
        overworldLayer, 
        cellarLayer, 
        mapSize, 
        excludedTiles,
        null // Random placement
      );
      if (stronghold) {
        buildings.push(stronghold);
        // Add stronghold plot to excluded tiles
        excludedTiles.push(...stronghold.plot);
      }

      const tavern = this.placeBuilding(
        'tavern', 
        tavernDef, 
        overworldLayer, 
        cellarLayer, 
        mapSize, 
        excludedTiles,
        null // Random placement
      );
      if (tavern) {
        buildings.push(tavern);
      }
    } else if (gameMode === 'skirmish') {
      // Skirmish: 2 strongholds (opposite sides) + 1 tavern
      // Place first stronghold on left side (25% from left)
      const team1X = Math.floor(mapSize * 0.25);
      const team1Y = Math.floor(mapSize * 0.5);
      const stronghold1 = this.placeBuilding(
        'stronghold', 
        strongholdDef, 
        overworldLayer, 
        cellarLayer, 
        mapSize, 
        excludedTiles,
        [team1X, team1Y] // Left side
      );
      if (stronghold1) {
        buildings.push(stronghold1);
        excludedTiles.push(...stronghold1.plot);
      }

      // Place second stronghold on right side (75% from left)
      const team2X = Math.floor(mapSize * 0.75);
      const team2Y = Math.floor(mapSize * 0.5);
      const stronghold2 = this.placeBuilding(
        'stronghold', 
        strongholdDef, 
        overworldLayer, 
        cellarLayer, 
        mapSize, 
        excludedTiles,
        [team2X, team2Y] // Right side
      );
      if (stronghold2) {
        buildings.push(stronghold2);
        excludedTiles.push(...stronghold2.plot);
      }

      // Place tavern
      const tavern = this.placeBuilding(
        'tavern', 
        tavernDef, 
        overworldLayer, 
        cellarLayer, 
        mapSize, 
        excludedTiles,
        null // Random placement
      );
      if (tavern) {
        buildings.push(tavern);
      }
    }

    return buildings;
  }

  /**
   * Place a single building
   * @param {string} buildingType - 'stronghold' or 'tavern'
   * @param {object} buildingDef - Building definition from BuildingPreview
   * @param {Array} overworldLayer - Overworld layer (worldData[0])
   * @param {Array} cellarLayer - Cellar layer (worldData[9])
   * @param {number} mapSize - Map size
   * @param {Array} excludedTiles - Tiles to exclude from placement
   * @param {Array} preferredCenter - Preferred center [x, y] or null for random
   * @returns {object} Building placement info or null
   */
  placeBuilding(buildingType, buildingDef, overworldLayer, cellarLayer, mapSize, excludedTiles, preferredCenter) {
    // Try to find a valid building spot
    // Since we're working with worldData arrays, we need to simulate findBuildingSpot
    const spot = this.findBuildingSpotInWorldData(
      buildingType,
      buildingDef,
      overworldLayer,
      mapSize,
      excludedTiles,
      preferredCenter
    );

    if (!spot) {
      console.warn(`[BattlegroundsDungeonBuildingPlacer] Could not find spot for ${buildingType}`);
      return null;
    }

    const { plot, walls, topPlot, centerX, centerY } = spot;

    // Create cellar plot (same coordinates as building plot, but at z=-2)
    const cellarPlot = this.getBuildingCellarPlot(plot, centerX, centerY);

    // Create cellar floors in worldData[9]
    this.createCellarFloors(cellarLayer, cellarPlot, mapSize);

    // Find stairs location (first wall tile for stronghold/tavern)
    const dstairs = walls && walls.length > 0 ? walls[0] : null;

    return {
      type: buildingType,
      centerX: centerX,
      centerY: centerY,
      plot: plot,
      walls: walls,
      topPlot: topPlot,
      cellarPlot: cellarPlot,
      dstairs: dstairs
    };
  }

  /**
   * Find a building spot in worldData (simulates findBuildingSpot)
   * @param {string} buildingType - Building type
   * @param {object} buildingDef - Building definition
   * @param {Array} overworldLayer - Overworld layer
   * @param {number} mapSize - Map size
   * @param {Array} excludedTiles - Excluded tiles
   * @param {Array} preferredCenter - Preferred center [x, y] or null
   * @returns {object} Building spot info or null
   */
  findBuildingSpotInWorldData(buildingType, buildingDef, overworldLayer, mapSize, excludedTiles, preferredCenter) {
    const plotTemplate = buildingDef.plot;
    const wallsTemplate = buildingDef.walls;
    const topPlotTemplate = buildingDef.topPlot;

    // Try multiple random locations
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let centerX, centerY;

      if (preferredCenter) {
        // Use preferred center with some random offset
        const offset = 3;
        centerX = preferredCenter[0] + Math.floor(Math.random() * (offset * 2 + 1)) - offset;
        centerY = preferredCenter[1] + Math.floor(Math.random() * (offset * 2 + 1)) - offset;
      } else {
        // Random location
        centerX = Math.floor(Math.random() * mapSize);
        centerY = Math.floor(Math.random() * mapSize);
      }

      // Clamp to map bounds
      centerX = Math.max(0, Math.min(mapSize - 1, centerX));
      centerY = Math.max(0, Math.min(mapSize - 1, centerY));

      // Calculate absolute plot coordinates
      const plot = [];
      for (const [dx, dy] of plotTemplate) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) {
          break; // Out of bounds
        }
        plot.push([x, y]);
      }

      // Check if all plot tiles are valid
      if (plot.length !== plotTemplate.length) {
        continue; // Some tiles out of bounds
      }

      // Check if plot tiles are on valid terrain
      let valid = true;
      for (const [x, y] of plot) {
        if (!overworldLayer[y] || overworldLayer[y][x] === undefined) {
          valid = false;
          break;
        }
        const tile = overworldLayer[y][x];
        // Check if tile is in required tiles list
        if (!buildingDef.requiredTiles.includes(tile)) {
          valid = false;
          break;
        }
        // Check if tile is excluded
        if (excludedTiles.some(ex => ex[0] === x && ex[1] === y)) {
          valid = false;
          break;
        }
      }

      if (!valid) {
        continue;
      }

      // Calculate walls and topPlot
      const walls = wallsTemplate ? wallsTemplate.map(([dx, dy]) => [centerX + dx, centerY + dy]) : null;
      const topPlot = topPlotTemplate ? topPlotTemplate.map(([dx, dy]) => [centerX + dx, centerY + dy]) : null;

      return {
        plot: plot,
        walls: walls,
        topPlot: topPlot,
        centerX: centerX,
        centerY: centerY
      };
    }

    return null; // No valid spot found
  }

  /**
   * Get cellar plot coordinates from building plot
   * Cellar plot is same as building plot but at z=-2
   * @param {Array} buildingPlot - Building plot coordinates [[x,y], ...]
   * @param {number} centerX - Building center X
   * @param {number} centerY - Building center Y
   * @returns {Array} Cellar plot coordinates [[x,y], ...] at z=-2
   */
  getBuildingCellarPlot(buildingPlot, centerX, centerY) {
    // Cellar plot is the same as building plot (same x, y coordinates, different z-level)
    return buildingPlot.map(([x, y]) => [x, y]);
  }

  /**
   * Create walkable floor tiles in cellar for building plot
   * @param {Array} cellarLayer - z=-2 layer (worldData[9])
   * @param {Array} cellarPlot - Cellar plot coordinates
   * @param {number} mapSize - Map size
   */
  createCellarFloors(cellarLayer, cellarPlot, mapSize) {
    // Set all cellar plot tiles to walkable (value 0)
    for (const [x, y] of cellarPlot) {
      if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
        if (!cellarLayer[y]) {
          cellarLayer[y] = [];
        }
        cellarLayer[y][x] = 0; // Walkable floor
      }
    }
  }
}

module.exports = BattlegroundsDungeonBuildingPlacer;


