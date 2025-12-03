// server/js/core/BuildingPreview.js
// Building preview and validation system

class BuildingPreview {
  constructor() {
    this.buildingDefinitions = {
      // Tier I Buildings
      farm: {
        name: 'Farm',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
        walls: null,
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 50, stone: 25 }
      },
      lumbermill: {
        name: 'Lumbermill',
        plot: [[0,0],[1,0]], // 2x1 (horizontal)
        walls: null,
        topPlot: [[0,-1],[1,-1]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 75, stone: 40 }
      },
      mine: {
        name: 'Mine',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        walls: null,
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.ROCKS, TERRAIN.MOUNTAIN], // Mines can be built on rocks and mountains
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST],
        materials: { wood: 60, stone: 80 }
      },
      hut: {
        name: 'Hut',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        walls: [[0,-2],[1,-2]],
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 25, stone: 10 }
      },
      cottage: {
        name: 'Cottage',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
        walls: [[0,-3],[1,-3],[2,-3]],
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 40, stone: 20 }
      },
      tavern: {
        name: 'Tavern',
        plot: [[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 5x4 irregular
        walls: [[0,-4],[1,-4],[2,-4],[3,-4],[4,-3]],
        topPlot: [[1,-4],[2,-4],[3,-4]],
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 125, stone: 0 }
      },
      tower: {
        name: 'Tower',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
        walls: [[0,-3],[1,-3],[2,-3]],
        topPlot: [[0,-3],[1,-3],[2,-3],[0,-4],[1,-4],[2,-4]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 30, stone: 50 }
      },
      forge: {
        name: 'Forge',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]], // 3x2
        walls: [[0,-2],[1,-2],[2,-2]],
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 50, stone: 100 }
      },
      fort: {
        name: 'Fort',
        plot: [[0,0]], // 1x1
        walls: null,
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 120, stone: 150 }
      },
      outpost: {
        name: 'Outpost',
        plot: [[0,0]], // 1x1
        walls: null,
        topPlot: [[0,-1]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 60, stone: 80 }
      },
      monastery: {
        name: 'Monastery',
        plot: [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2],[0,-3],[1,-3]], // 4x4 (14 tiles)
        walls: [[2,-3],[3,-3],[0,-4],[1,-4]],
        topPlot: [[2,-3],[0,-4],[1,-4]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 200, stone: 300 }
      },
      
      // Tier II Buildings (require prerequisites)
      mill: {
        name: 'Mill',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        walls: null,
        topPlot: [[0,-2],[1,-2]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 60, stone: 30 }
      },
      dock: {
        name: 'Dock',
        // Dock is direction-dependent, store all 4 variations
        // up: [[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]]
        // left: [[-2,0],[-1,0],[0,0],[-2,-1],[-1,-1],[0,-1]]
        // right: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]]
        // down: [[-1,1],[0,1],[1,1],[-1,0],[0,0],[1,0]]
        // Default to 'right' for preview
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]], // 3x2 (right-facing default)
        plotUp: [[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]],
        plotLeft: [[-2,0],[-1,0],[0,0],[-2,-1],[-1,-1],[0,-1]],
        plotRight: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]],
        plotDown: [[-1,1],[0,1],[1,1],[-1,0],[0,0],[1,0]],
        topPlotUp: [[-1,-2],[0,-2],[1,-2]],
        topPlotLeft: [[-2,-2],[-1,-2],[0,-2]],
        topPlotRight: [[0,-2],[1,-2],[2,-2]],
        topPlotDown: [[-1,-1],[0,-1],[1,-1]],
        walls: null,
        topPlot: [[0,-2],[1,-2],[2,-2]], // Default to right-facing
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.WATER],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 80, stone: 40 }
      },
      stable: {
        name: 'Stable',
        plot: [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 4x3 (12 tiles)
        walls: null,
        topPlot: [[1,-3],[2,-3],[3,-3]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 100, stone: 50 }
      },
      market: {
        name: 'Market',
        plot: [[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 5x3 (12 tiles)
        walls: [[4,-2],[0,-3],[1,-3],[2,-3],[3,-3]],
        topPlot: null, // Market uses walls as topPlot (special case)
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 150, stone: 75 }
      },
      garrison: {
        name: 'Garrison',
        plot: [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 4x3
        walls: [[0,-3],[1,-3],[2,-3],[3,-3]],
        topPlot: [[1,-3],[2,-3],[3,-3]],
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 150, stone: 100 }
      },
      
      // Tier III Buildings (require Garrison)
      stronghold: {
        name: 'Stronghold',
        plot: [[2,0],[3,0],[4,0],[5,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[7,-2],[0,-3],[1,-3],[2,-3],[3,-3],[4,-3],[5,-3],[6,-3],[7,-3],[0,-4],[1,-4],[2,-4],[3,-4],[4,-4],[5,-4],[6,-4],[7,-4],[0,-5],[1,-5],[2,-5],[3,-5],[4,-5],[5,-5],[6,-5],[7,-5],[1,-6],[2,-6],[3,-6],[4,-6],[5,-6],[6,-6],[7,-6],[1,-7],[2,-7],[3,-7],[4,-7],[5,-7],[6,-7],[7,-7]], // Large irregular (58 tiles)
        walls: [[0,-6],[1,-8],[2,-8],[3,-8],[4,-8],[5,-8],[6,-8],[7,-8]],
        topPlot: [[1,-8],[2,-8],[3,-8],[4,-8],[6,-8],[7,-8],[2,-9],[3,-9],[4,-9]],
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 200, stone: 300 }
      },
      wall: {
        name: 'Wall',
        plot: [[0,0]], // 1x1
        walls: null,
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 30, stone: 40 }
      },
      guardtower: {
        name: 'Guard Tower',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        walls: null,
        topPlot: [[0,-2],[1,-2]],
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 100, stone: 120 }
      },
      gate: {
        name: 'Gate',
        plot: [[0,0],[1,0]], // 2x1
        walls: null,
        topPlot: null,
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 50, stone: 60 }
      }
    };
  }

  // Get building definition
  getBuildingDefinition(buildingType) {
    return this.buildingDefinitions[buildingType.toLowerCase()];
  }

  // Validate if a building can be placed at a location
  validateBuildingPlacement(buildingType, centerX, centerY, z = 0, facing = 'right') {
    const building = this.getBuildingDefinition(buildingType);
    if (!building) {
      return { valid: false, reason: 'Unknown building type' };
    }

    // For docks, select the correct plot based on facing direction
    let plotTemplate = building.plot;
    let topPlotTemplate = building.topPlot;
    
    if (buildingType === 'dock') {
      if (facing === 'up' && building.plotUp) {
        plotTemplate = building.plotUp;
        topPlotTemplate = building.topPlotUp;
      } else if (facing === 'left' && building.plotLeft) {
        plotTemplate = building.plotLeft;
        topPlotTemplate = building.topPlotLeft;
      } else if (facing === 'right' && building.plotRight) {
        plotTemplate = building.plotRight;
        topPlotTemplate = building.topPlotRight;
      } else if (facing === 'down' && building.plotDown) {
        plotTemplate = building.plotDown;
        topPlotTemplate = building.topPlotDown;
      }
      // If no matching direction, fall back to default plot
    }

    const plot = this.getBuildingPlot({ plot: plotTemplate }, centerX, centerY);
    
    // Calculate walls and topPlot from relative templates
    let walls = null;
    if (building.walls && Array.isArray(building.walls)) {
      walls = building.walls.map(([relX, relY]) => [centerX + relX, centerY + relY]);
    }
    
    let topPlot = null;
    if (buildingType === 'market' && walls) {
      // Market uses walls as topPlot (special case)
      topPlot = walls;
    } else if (topPlotTemplate && Array.isArray(topPlotTemplate)) {
      topPlot = topPlotTemplate.map(([relX, relY]) => [centerX + relX, centerY + relY]);
    }
    
    const validation = {
      valid: true,
      canBuild: true,
      tiles: [],
      clearableTiles: [],
      blockedTiles: [],
      missingMaterials: null,
      walls: walls,
      topPlot: topPlot
    };

    // Check each tile in the building plot
    for (const [relativeX, relativeY] of plotTemplate) {
      const tileX = centerX + relativeX;
      const tileY = centerY + relativeY;
      const tile = global.getTile(z, tileX, tileY);
      
      const tileInfo = {
        x: tileX,
        y: tileY,
        tile: tile,
        status: 'valid' // valid, clearable, blocked
      };

      // Check priority order: requiredTiles first (highest priority), then blockedTiles, then clearableTiles
      // This allows buildings to be placed on their required terrain types even if they're also clearable
      
      // Check if tile is in requiredTiles (highest priority - always valid)
      if (building.requiredTiles.includes(tile)) {
        tileInfo.status = 'valid';
        validation.tiles.push(tileInfo);
      }
      // Check if tile is blocked
      else if (building.blockedTiles.includes(tile)) {
        tileInfo.status = 'blocked';
        validation.blockedTiles.push(tileInfo);
        validation.canBuild = false;
      }
      // Check if tile is clearable
      else if (building.clearableTiles.includes(tile)) {
        tileInfo.status = 'clearable';
        validation.clearableTiles.push(tileInfo);
      }
      // Unknown tile type - not in any category
      else {
        tileInfo.status = 'blocked';
        validation.blockedTiles.push(tileInfo);
        validation.canBuild = false;
      }
    }

    // Check if player has required materials (this would need player data)
    // For now, we'll skip material checking in preview

    return validation;
  }

  // Get the actual world coordinates for a building plot
  getBuildingPlot(building, centerX, centerY) {
    return building.plot.map(([relativeX, relativeY]) => [
      centerX + relativeX,
      centerY + relativeY
    ]);
  }

  // Check if player has required materials (checks inventory first, then stores)
  checkMaterials(player, buildingType) {
    const building = this.getBuildingDefinition(buildingType);
    if (!building || !building.materials) return { hasMaterials: true };

    const missing = {};
    let hasAll = true;

    for (const [material, required] of Object.entries(building.materials)) {
      // Check BOTH inventory and stores (inventory is prioritized when deducting)
      const inInventory = player.inventory[material] || 0;
      const inStores = player.stores[material] || 0;
      const total = inInventory + inStores;
      
      if (total < required) {
        missing[material] = required - total;
        hasAll = false;
      }
    }

    return {
      hasMaterials: hasAll,
      missing: missing
    };
  }

  // Get all available building types
  getAvailableBuildings() {
    return Object.keys(this.buildingDefinitions);
  }

  // Get building requirements as text
  getBuildingRequirements(buildingType) {
    const building = this.getBuildingDefinition(buildingType);
    if (!building) return 'Unknown building';

    let requirements = `Building: ${building.name}\n`;
    requirements += `Size: ${this.getPlotSize(building.plot)}\n`;
    
    if (building.materials) {
      requirements += 'Materials needed:\n';
      for (const [material, amount] of Object.entries(building.materials)) {
        requirements += `- ${material}: ${amount}\n`;
      }
    }

    requirements += '\nTile requirements:\n';
    requirements += `- Can build on: ${building.requiredTiles.map(t => this.getTileName(t)).join(', ')}\n`;
    requirements += `- Can clear: ${building.clearableTiles.map(t => this.getTileName(t)).join(', ')}\n`;
    requirements += `- Blocked by: ${building.blockedTiles.map(t => this.getTileName(t)).join(', ')}\n`;

    return requirements;
  }

  // Get plot size description
  getPlotSize(plot) {
    const minX = Math.min(...plot.map(([x]) => x));
    const maxX = Math.max(...plot.map(([x]) => x));
    const minY = Math.min(...plot.map(([, y]) => y));
    const maxY = Math.max(...plot.map(([, y]) => y));
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    return `${width}x${height} tiles`;
  }

  // Get tile name from terrain constant
  getTileName(tileType) {
    const terrainNames = {
      [TERRAIN.WATER]: 'Water',
      [TERRAIN.HEAVY_FOREST]: 'Heavy Forest',
      [TERRAIN.LIGHT_FOREST]: 'Light Forest',
      [TERRAIN.BRUSH]: 'Brush',
      [TERRAIN.ROCKS]: 'Rocks',
      [TERRAIN.MOUNTAIN]: 'Mountain',
      [TERRAIN.EMPTY]: 'Empty/Grass'
    };
    return terrainNames[tileType] || `Tile ${tileType}`;
  }
}

module.exports = BuildingPreview;
