// server/js/core/BuildingPreview.js
// Building preview and validation system

class BuildingPreview {
  constructor() {
    this.buildingDefinitions = {
      farm: {
        name: 'Farm',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3 - matches Commands.js
        requiredTiles: [TERRAIN.EMPTY], // Can only build on empty tiles
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST], // Can clear these
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 50, stone: 25 }
      },
      tavern: {
        name: 'Tavern',
        plot: [[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 5x4 irregular shape - matches Commands.js
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH], // Can build on empty or brush
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 125, stone: 0 }
      },
      mill: {
        name: 'Lumbermill',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 75, stone: 40 }
      },
      mine: {
        name: 'Mine',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.ROCKS], // Can build on empty or rocks
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN],
        materials: { wood: 60, stone: 80 }
      },
      hut: {
        name: 'Hut',
        plot: [[0,0]], // 1x1
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 25, stone: 10 }
      },
      cottage: {
        name: 'Cottage',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 40, stone: 20 }
      },
      stronghold: {
        name: 'Stronghold',
        plot: [[2,0],[3,0],[4,0],[5,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[7,-2],[0,-3],[1,-3],[2,-3],[3,-3],[4,-3],[5,-3],[6,-3],[7,-3],[0,-4],[1,-4],[2,-4],[3,-4],[4,-4],[5,-4],[6,-4],[7,-4],[0,-5],[1,-5],[2,-5],[3,-5],[4,-5],[5,-5],[6,-5],[7,-5],[1,-6],[2,-6],[3,-6],[4,-6],[5,-6],[6,-6],[7,-6],[1,-7],[2,-7],[3,-7],[4,-7],[5,-7],[6,-7],[7,-7]], // Large irregular shape
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 200, stone: 300 }
      },
      garrison: {
        name: 'Garrison',
        plot: [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 4x3
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 150, stone: 100 }
      },
      monastery: {
        name: 'Monastery',
        plot: [[0,0],[1,0],[2,0],[3,0],[4,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[0,-3],[1,-3],[2,-3],[3,-3],[4,-3]], // 5x4
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 180, stone: 120 }
      },
      forge: {
        name: 'Forge',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]], // 3x2 - matches Commands.js
        requiredTiles: [TERRAIN.EMPTY, TERRAIN.BRUSH],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 80, stone: 60 }
      },
      villa: {
        name: 'Villa',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 80, stone: 60 }
      },
      tower: {
        name: 'Tower',
        plot: [[0,0]], // 1x1
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 30, stone: 50 }
      },
      forge: {
        name: 'Forge',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 50, stone: 100 }
      },
      fort: {
        name: 'Fort',
        plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 120, stone: 150 }
      },
      outpost: {
        name: 'Outpost',
        plot: [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 60, stone: 80 }
      },
      monastery: {
        name: 'Monastery',
        plot: [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 4x4
        requiredTiles: [TERRAIN.EMPTY],
        clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
        blockedTiles: [TERRAIN.WATER, TERRAIN.HEAVY_FOREST, TERRAIN.MOUNTAIN, TERRAIN.ROCKS],
        materials: { wood: 200, stone: 300 }
      }
    };
  }

  // Get building definition
  getBuildingDefinition(buildingType) {
    return this.buildingDefinitions[buildingType.toLowerCase()];
  }

  // Validate if a building can be placed at a location
  validateBuildingPlacement(buildingType, centerX, centerY, z = 0) {
    const building = this.getBuildingDefinition(buildingType);
    if (!building) {
      return { valid: false, reason: 'Unknown building type' };
    }

    const plot = this.getBuildingPlot(building, centerX, centerY);
    const validation = {
      valid: true,
      canBuild: true,
      tiles: [],
      clearableTiles: [],
      blockedTiles: [],
      missingMaterials: null
    };

    // Check each tile in the building plot
    for (const [relativeX, relativeY] of building.plot) {
      const tileX = centerX + relativeX;
      const tileY = centerY + relativeY;
      const tile = global.getTile(z, tileX, tileY);
      
      const tileInfo = {
        x: tileX,
        y: tileY,
        tile: tile,
        status: 'valid' // valid, clearable, blocked
      };

      // Check if tile is blocked
      if (building.blockedTiles.includes(tile)) {
        tileInfo.status = 'blocked';
        validation.blockedTiles.push(tileInfo);
        validation.canBuild = false;
      }
      // Check if tile is clearable
      else if (building.clearableTiles.includes(tile)) {
        tileInfo.status = 'clearable';
        validation.clearableTiles.push(tileInfo);
      }
      // Check if tile is valid for building
      else if (building.requiredTiles.includes(tile)) {
        tileInfo.status = 'valid';
        validation.tiles.push(tileInfo);
      }
      // Unknown tile type
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

  // Check if player has required materials
  checkMaterials(player, buildingType) {
    const building = this.getBuildingDefinition(buildingType);
    if (!building || !building.materials) return { hasMaterials: true };

    const missing = {};
    let hasAll = true;

    for (const [material, required] of Object.entries(building.materials)) {
      const current = player.inventory[material] || 0;
      if (current < required) {
        missing[material] = required - current;
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
