// Building Constructor for AI
// Handles actual building placement and construction for AI goals

class BuildingConstructor {
  constructor(house) {
    this.house = house;
  }
  
  // Get buildings by type (delegates to BuildingService if available)
  getBuildingsByType(buildingType) {
    if (this.house.ai && this.house.ai.buildingService) {
      return this.house.ai.buildingService.getBuildingsByType(buildingType);
    }
    
    // Fallback: calculate directly
    const buildings = [];
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.type === buildingType && building.built) {
          buildings.push(building);
        }
      }
    }
    return buildings;
  }
  
  // Get faction-specific tower type (returns null for factions without towers)
  getFactionTowerType() {
    const factionName = this.house?.name || '';
    const baseName = factionName.replace(/\s+\d+$/, '').trim().toLowerCase();
    
    const towerTypeMap = {
      'goths': 'gothtower',
      'franks': 'franktower',
      'celts': 'celttower',
      'teutons': 'teutower'
    };
    
    return towerTypeMap[baseName] || null; // No fallback - return null for unknown factions
  }
  
  // Construct a mill
  buildMill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10, 15] : [10, 15, 20, 25];
    let spot = null;
    
    for (const radius of radii) {
      spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
        excludeTiles: this.getOccupiedTiles()
      });
      if (spot) {
        break; // Found a spot, use it
      }
    }
    
    // Fallback: if no spot found near HQ, try searching near existing buildings
    if (!spot) {
      const existingBuildings = this.getBuildingsByType('mill');
      if (existingBuildings && existingBuildings.length > 0) {
        // Try searching near existing mills
        for (const existingMill of existingBuildings) {
          if (!existingMill.plot || !existingMill.plot[0]) continue;
          const millLoc = existingMill.plot[0];
          for (const radius of [5, 10, 15]) {
            spot = global.tilemapSystem.findBuildingSpot('mill', millLoc, radius, {
              excludeTiles: this.getOccupiedTiles()
            });
            if (spot) break;
          }
          if (spot) break;
        }
      }
      
      // If still no spot, try near farms or other buildings
      if (!spot) {
        const farms = this.getBuildingsByType('farm');
        if (farms && farms.length > 0) {
          for (const farm of farms) {
            if (!farm.plot || !farm.plot[0]) continue;
            const farmLoc = farm.plot[0];
            for (const radius of [5, 10, 15]) {
              spot = global.tilemapSystem.findBuildingSpot('mill', farmLoc, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
              if (spot) break;
            }
            if (spot) break;
          }
        }
      }
    }
    
    if (!spot) {
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles
    const baseTerrain = [];
    for (const tile of plot) {
      baseTerrain.push(global.getTile(0, tile[0], tile[1]));
    }
    
    // Update terrain tiles
    for (const tile of plot) {
      global.tileChange(0, tile[0], tile[1], 13); // BUILD marker
      global.tileChange(3, tile[0], tile[1], `mill${plot.indexOf(tile)}`);
      global.matrixChange(0, tile[0], tile[1], 1); // Block pathfinding
    }
    global.tileChange(5, topPlot[0][0], topPlot[0][1], 'mill4');
    global.tileChange(5, topPlot[1][0], topPlot[1][1], 'mill5');
    
    // Create mill building
    const millId = Math.random();
    Mill({
      id: millId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'mill',
      built: true,
      plot: plot,
      topPlot: topPlot,
      baseTerrain: baseTerrain,
      mats: { wood: 40, stone: 0 },
      req: 5,
      hp: 150
    });
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[millId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return millId;
  }
  
  // Construct a farm
  buildFarm(location = null) {
    // Configurable search radius (default: 6, can expand up to 15 for location blocking fallback)
    const FARM_SEARCH_RADIUS = 6;
    const MAX_SEARCH_RADIUS = 15;
    
    // Find all mills if no location specified
    const mills = this.getBuildingsByType('mill');
    if (mills.length === 0) {
      return null;
    }
    
    // Try each mill with increasing radius if needed
    for (const mill of mills) {
      const searchCenter = mill.plot[0];
      let radius = FARM_SEARCH_RADIUS;
      
      // Try with increasing radius if initial search fails
      while (radius <= MAX_SEARCH_RADIUS) {
        const spot = global.tilemapSystem.findBuildingSpot('farm', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        
        if (spot) {
          const plot = spot.plot;
          const center = global.getCenter(plot[4][0], plot[4][1]);
          
          // Update terrain
          for (const tile of plot) {
            global.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
            global.tileChange(6, tile[0], tile[1], 0);
          }
          
          // Create farm
          const farm = Farm({
            house: this.house.id,
            owner: this.house.id,
            x: center[0],
            y: center[1],
            z: 0,
            type: 'farm',
            built: true,
            plot: plot
          });
          
          // Note: Farms cannot be marked as colonies because the Farm constructor doesn't return an ID
          // This is a limitation of the current Farm implementation
          
          return true;
        }
        
        // Try next radius increment
        radius += 2;
      }
    }
    
    // Fallback: if no spot found near mills, try searching near HQ
    const hq = this.house.hq;
    if (hq) {
      let radius = FARM_SEARCH_RADIUS;
      while (radius <= MAX_SEARCH_RADIUS) {
        const spot = global.tilemapSystem.findBuildingSpot('farm', hq, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot) {
          const plot = spot.plot;
          const center = global.getCenter(plot[4][0], plot[4][1]);
          
          // Update terrain
          for (const tile of plot) {
            global.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
            global.tileChange(6, tile[0], tile[1], 0);
          }
          
          // Create farm
          const farm = Farm({
            house: this.house.id,
            owner: this.house.id,
            x: center[0],
            y: center[1],
            z: 0,
            type: 'farm',
            built: true,
            plot: plot
          });
          
          return true;
        }
        radius += 2;
      }
    }
    
    // Fallback: try searching near any existing building
    const allBuildings = this.house.ai && this.house.ai.buildingService 
      ? this.house.ai.buildingService.getBuildings() 
      : [];
    if (allBuildings && allBuildings.length > 0) {
      for (const building of allBuildings) {
        if (!building.plot || !building.plot[0] || !building.built) continue;
        const buildingLoc = building.plot[0];
        let radius = FARM_SEARCH_RADIUS;
        while (radius <= MAX_SEARCH_RADIUS) {
          const spot = global.tilemapSystem.findBuildingSpot('farm', buildingLoc, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot) {
            const plot = spot.plot;
            const center = global.getCenter(plot[4][0], plot[4][1]);
            
            // Update terrain
            for (const tile of plot) {
              global.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
              global.tileChange(6, tile[0], tile[1], 0);
            }
            
            // Create farm
            const farm = Farm({
              house: this.house.id,
              owner: this.house.id,
              x: center[0],
              y: center[1],
              z: 0,
              type: 'farm',
              built: true,
              plot: plot
            });
            
            return true;
          }
          radius += 2;
        }
      }
    }
    
    // No suitable location found
    return null;
  }
  
  // Check if a farm can be placed (validation-only, doesn't build)
  canPlaceFarm(location = null) {
    const FARM_SEARCH_RADIUS = 6;
    const MAX_SEARCH_RADIUS = 15; // Expanded for location blocking fallback
    
    const mills = this.getBuildingsByType('mill');
    if (mills.length === 0) {
      return false;
    }
    
    // Check each mill with increasing radius
    for (const mill of mills) {
      const searchCenter = mill.plot[0];
      let radius = FARM_SEARCH_RADIUS;
      
      while (radius <= MAX_SEARCH_RADIUS) {
        const spot = global.tilemapSystem.findBuildingSpot('farm', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        
        if (spot) {
          return true; // Found a valid location
        }
        
        radius += 2;
      }
    }
    
    // Fallback: if no spot found near mills, try searching near HQ
    const hq = this.house.hq;
    if (hq) {
      let radius = FARM_SEARCH_RADIUS;
      while (radius <= MAX_SEARCH_RADIUS) {
        const spot = global.tilemapSystem.findBuildingSpot('farm', hq, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot) {
          return true;
        }
        radius += 2;
      }
    }
    
    // Fallback: try searching near any existing building
    const allBuildings = this.house.ai && this.house.ai.buildingService 
      ? this.house.ai.buildingService.getBuildings() 
      : [];
    if (allBuildings && allBuildings.length > 0) {
      for (const building of allBuildings) {
        if (!building.plot || !building.plot[0] || !building.built) continue;
        const buildingLoc = building.plot[0];
        let radius = FARM_SEARCH_RADIUS;
        while (radius <= MAX_SEARCH_RADIUS) {
          const spot = global.tilemapSystem.findBuildingSpot('farm', buildingLoc, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot) {
            return true;
          }
          radius += 2;
        }
      }
    }
    
    return false; // No valid location found
  }
  
  // Check if a mill can be placed (validation-only)
  canPlaceMill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    
    for (const radius of radii) {
    const spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
      if (spot && spot.plot && spot.plot[0]) {
        return true;
      }
    }
    
    return false;
  }
  
  // Check if a mine can be placed (validation-only)
  canPlaceMine(location = null, mineType = 'any') {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    
    // Use same logic as buildMine but just check for spot
    let spot = null;
    if (mineType === 'stone') {
      // Try each radius until we find a valid stone mine location (away from caves)
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          const nearCave = this.isNearCaveEntrance(spot.plot[0]);
          if (!nearCave) {
            return true; // Found valid stone mine location (not near cave)
          }
          // Near cave, reject this spot and try next radius
          spot = null;
        }
      }
      // No valid stone mine location found (all spots were near caves)
      return false;
    } else if (mineType === 'cave') {
      if (global.caveEntrances && global.caveEntrances.length > 0) {
        for (const cave of global.caveEntrances) {
          const caveLoc = cave.loc || cave;
          if (!caveLoc || !Array.isArray(caveLoc)) continue;
          const caveSearchRadius = 6;
          spot = global.tilemapSystem.findBuildingSpot('mine', caveLoc, caveSearchRadius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot) break;
        }
      }
      if (!spot) {
        // Try each radius until we find a spot
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot) break;
        }
      }
    } else {
      // Try each radius until we find a spot
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot) break;
      }
    }
    
    return spot !== null && spot.plot && spot.plot[0];
  }
  
  // Check if a lumbermill can be placed (validation-only)
  canPlaceLumbermill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    
    for (const radius of radii) {
    const spot = global.tilemapSystem.findBuildingSpot('lumbermill', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
      if (spot && spot.plot && spot.plot[0]) {
        return true;
      }
    }
    
    return false;
  }
  
  // Check if a forge can be placed (validation-only)
  canPlaceForge(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    const radius = location ? 3 : 10;
    
    const spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    return spot !== null && spot.plot && spot.plot[0];
  }
  
  // Check if a garrison can be placed (validation-only)
  canPlaceGarrison(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10, 15] : [10, 15, 20, 25];
    
    for (const radius of radii) {
    const spot = global.tilemapSystem.findBuildingSpot('garrison', searchCenter, radius, {
        excludeTiles: this.getOccupiedTiles()
      });
      
      if (spot && spot.plot && spot.plot[0]) {
        return true; // Found valid location
      }
    }
    
    return false; // No valid location found
  }
  
  // Check if a guardtower can be placed (validation-only)
  canPlaceGuardtower(location = null) {
    if (!location || !Array.isArray(location) || location.length < 2) {
      return false;
    }
    
    // Check if faction has a tower type (Norsemen and others don't have towers)
    const towerType = this.getFactionTowerType();
    if (!towerType) {
      return false; // Faction doesn't have tower type
    }
    
    const searchCenter = location;
    const radius = 5; // Search within 5 tiles of target location
    
    const spot = global.tilemapSystem.findBuildingSpot(towerType, searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
    
    return spot !== null && spot.plot && spot.plot[0];
  }
  
  // Check if location is near a cave entrance (within 384 pixels / ~6 tiles)
  isNearCaveEntrance(location) {
    if (!location || !Array.isArray(location) || location.length < 2) {
      return null;
    }
    
    const TERRAIN = global.TERRAIN || {};
    const CAVE_ENTRANCE = TERRAIN.CAVE_ENTRANCE || 6;
    const CAVE_PROXIMITY_DISTANCE = 384; // pixels (6 tiles * 64 pixels)
    
    // Check global.caveEntrances array if available
    if (global.caveEntrances && Array.isArray(global.caveEntrances)) {
      const locCoords = global.getCenter ? global.getCenter(location[0], location[1]) : [location[0] * 64, location[1] * 64];
      
      for (const cave of global.caveEntrances) {
        const caveLoc = cave.loc || cave;
        if (!caveLoc || !Array.isArray(caveLoc) || caveLoc.length < 2) continue;
        
        const caveCoords = global.getCenter ? global.getCenter(caveLoc[0], caveLoc[1]) : [caveLoc[0] * 64, caveLoc[1] * 64];
        const distance = Math.sqrt(
          Math.pow(caveCoords[0] - locCoords[0], 2) + 
          Math.pow(caveCoords[1] - locCoords[1], 2)
        );
        
        if (distance <= CAVE_PROXIMITY_DISTANCE) {
          return caveLoc; // Return cave location for mine.cave property
        }
      }
    }
    
    // Fallback: check nearby tiles for CAVE_ENTRANCE terrain
    const searchRadius = 6; // tiles
    for (let dr = -searchRadius; dr <= searchRadius; dr++) {
      for (let dc = -searchRadius; dc <= searchRadius; dc++) {
        const checkTile = [location[0] + dc, location[1] + dr];
        const terrain = global.getTile ? global.getTile(0, checkTile[0], checkTile[1]) : null;
        
        if (terrain === CAVE_ENTRANCE) {
          // Found cave entrance nearby
          return checkTile;
        }
      }
    }
    
    return null; // No cave entrance nearby
  }
  
  // Construct a mine
  buildMine(location = null, mineType = 'any') {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10, 15] : [10, 15, 20, 25];
    
    // If mineType is specified, adjust search behavior
    let spot = null;
    if (mineType === 'stone') {
      // Prefer locations NOT near caves (stone mines)
      // Try each radius until we find a valid stone mine location
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        
        // Verify it's not near a cave
        if (spot && spot.plot && spot.plot[0]) {
          const nearCave = this.isNearCaveEntrance(spot.plot[0]);
          if (!nearCave) {
            break; // Found valid stone mine location (not near cave)
          }
          // Near cave, reject this spot and try next radius
          spot = null;
        }
      }
    } else if (mineType === 'cave') {
      // Prefer locations near caves (ore mines)
      // First try to find a spot near a cave
      if (global.caveEntrances && global.caveEntrances.length > 0) {
        for (const cave of global.caveEntrances) {
          const caveLoc = cave.loc || cave;
          if (!caveLoc || !Array.isArray(caveLoc)) continue;
          
          const caveSearchRadius = 6; // tiles
          spot = global.tilemapSystem.findBuildingSpot('mine', caveLoc, caveSearchRadius, {
            excludeTiles: this.getOccupiedTiles()
          });
          
          if (spot) break;
        }
      }
      
      // Fallback to normal search with multiple radii if no cave spot found
      if (!spot) {
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot) break;
        }
      }
    } else {
      // 'any' - use normal search with multiple radii
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot) break;
      }
    }
    
    // Fallback: if no spot found near HQ, try searching near existing mines or outposts
    if (!spot || !spot.plot || !spot.plot[0]) {
      const existingBuildings = this.getBuildingsByType('mine');
      if (existingBuildings && existingBuildings.length > 0) {
        // Try searching near existing mines
        for (const existingMine of existingBuildings) {
          if (!existingMine.plot || !existingMine.plot[0]) continue;
          const mineLoc = existingMine.plot[0];
          for (const radius of [5, 10, 15]) {
            spot = global.tilemapSystem.findBuildingSpot('mine', mineLoc, radius, {
              excludeTiles: this.getOccupiedTiles()
            });
            if (spot) break;
          }
          if (spot) break;
        }
      }
      
      // If still no spot, try near outposts
      if (!spot || !spot.plot || !spot.plot[0]) {
        const outposts = this.getBuildingsByType('outpost');
        if (outposts && outposts.length > 0) {
          for (const outpost of outposts) {
            if (!outpost.plot || !outpost.plot[0]) continue;
            const outpostLoc = outpost.plot[0];
            for (const radius of [5, 10, 15]) {
              spot = global.tilemapSystem.findBuildingSpot('mine', outpostLoc, radius, {
        excludeTiles: this.getOccupiedTiles()
      });
              if (spot) break;
            }
            if (spot) break;
          }
        }
      }
    }
    
    if (!spot || !spot.plot || !spot.plot[0]) {
      // Log terrain types checked when placement fails for debugging
      if (this.house.ai && this.house.ai.logger) {
        const TERRAIN = global.TERRAIN || {};
        const checkedTerrains = [];
        // Check a sample of tiles around search center
        for (let r = -5; r <= 5; r++) {
          for (let c = -5; c <= 5; c++) {
            const checkLoc = [searchCenter[0] + c, searchCenter[1] + r];
            const terrain = global.getTile ? global.getTile(0, checkLoc[0], checkLoc[1]) : null;
            if (terrain !== null && !checkedTerrains.includes(terrain)) {
              checkedTerrains.push(terrain);
            }
          }
        }
        this.house.ai.logger.collectInfo(`Mine placement failed: checked terrains [${checkedTerrains.join(', ')}] around [${searchCenter[0]}, ${searchCenter[1]}]`);
      }
      return null;
    }
    
    const plot = spot.plot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Check if this location is near a cave entrance
    const nearCave = this.isNearCaveEntrance(plot[0]);
    
    // Diagnostic logging: Verify mine placement matches mineType
    if (mineType === 'stone' && nearCave) {
      // Stone mine placed near cave - this shouldn't happen if placement logic worked correctly
      const houseName = this.house.name || 'Unknown';
      console.warn(`[MINE PLACEMENT WARNING] ${houseName}: Stone mine placed near cave entrance at [${plot[0][0]}, ${plot[0][1]}] - cave: [${nearCave[0]}, ${nearCave[1]}]. This mine will be classified as a cave mine and won't find stone resources.`);
      if (this.house.ai && this.house.ai.logger) {
        this.house.ai.logger.collectInfo(`Stone mine incorrectly placed near cave at [${plot[0][0]}, ${plot[0][1]}]`);
      }
    } else if (mineType === 'cave' && !nearCave) {
      // Cave mine placed far from cave - this can happen as fallback, but log it
      const houseName = this.house.name || 'Unknown';
      console.log(`[MINE PLACEMENT INFO] ${houseName}: Cave mine placed far from cave entrance at [${plot[0][0]}, ${plot[0][1]}] (fallback placement). This mine will be classified as a stone mine.`);
      if (this.house.ai && this.house.ai.logger) {
        this.house.ai.logger.collectInfo(`Cave mine placed far from cave at [${plot[0][0]}, ${plot[0][1]}] (fallback)`);
      }
    }
    
    // Store original terrain before changing tiles
    const baseTerrain = [];
    for (let i = 0; i < plot.length; i++) {
      baseTerrain.push(global.getTile(0, plot[i][0], plot[i][1]));
    }
    
    // Update terrain (mines are just a base plot, no topPlot)
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(0, plot[i][0], plot[i][1], 13);
      global.tileChange(3, plot[i][0], plot[i][1], `mine${i}`);
      global.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    
    // Create mine (no topPlot property needed)
    const mineId = Math.random();
    const mineParams = {
      id: mineId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'mine',
      built: true,
      plot: plot,
      baseTerrain: baseTerrain,
      mats: { wood: 40, stone: 0 },
      req: 5,
      hp: 150
    };
    
    // Set cave property if near cave entrance (this determines if it's an ore mine)
    // But only if mineType is 'cave' or 'any' - if mineType is 'stone', don't set cave even if near one
    if (mineType === 'stone') {
      // Stone mine - don't set cave property even if near cave entrance
      // (We should have avoided building near caves in the first place)
      // However, if placement failed and we're near a cave, the mine will still be classified as cave mine by getRes()
      // This is a placement failure that should be logged above
    } else if (mineType === 'cave' || mineType === 'any') {
      // Cave mine or any - set cave property if near cave entrance
      if (nearCave) {
        mineParams.cave = nearCave;
      } else if (mineType === 'cave') {
        // For cave mines, we should be near a cave - log warning if not
        if (this.house.ai && this.house.ai.logger) {
          this.house.ai.logger.collectInfo(`Warning: Cave mine built but not near cave entrance at [${plot[0][0]}, ${plot[0][1]}]`);
        }
      }
    }
    
    Mine(mineParams);
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[mineId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return mineId;
  }
  
  // Construct a lumbermill
  buildLumbermill(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    let spot = null;
    
    for (const radius of radii) {
      spot = global.tilemapSystem.findBuildingSpot('lumbermill', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
      if (spot) {
        break; // Found a spot, use it
      }
    }
    
    if (!spot) {
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles
    const baseTerrain = [];
    for (let i = 0; i < plot.length; i++) {
      baseTerrain.push(global.getTile(0, plot[i][0], plot[i][1]));
    }
    
    // Update terrain
    for (let i = 0; i < plot.length; i++) {
      global.tileChange(0, plot[i][0], plot[i][1], 13);
      global.tileChange(3, plot[i][0], plot[i][1], `lumbermill${i}`);
      global.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    global.tileChange(5, topPlot[0][0], topPlot[0][1], 'lumbermill2');
    global.tileChange(5, topPlot[1][0], topPlot[1][1], 'lumbermill3');
    
    // Create lumbermill
    const lumbermillId = Math.random();
    Lumbermill({
      id: lumbermillId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'lumbermill',
      built: true,
      plot: plot,
      topPlot: topPlot,
      baseTerrain: baseTerrain,
      mats: { wood: 35, stone: 0 },
      req: 5,
      hp: 150
    });
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[lumbermillId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return lumbermillId;
  }
  
  // Construct a forge
  buildForge(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    let spot = null;
    
    for (const radius of radii) {
      spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
      if (spot) {
        break; // Found a spot, use it
      }
    }
    
    if (!spot) {
      return null;
    }
    
    const plot = spot.plot;
    const walls = spot.walls;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles (constructForge will change them)
    const baseTerrain = [];
    for (const tile of plot) {
      baseTerrain.push(global.getTile(0, tile[0], tile[1]));
    }
    
    // Create forge building
    const forgeId = Math.random();
    Forge({
      id: forgeId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'forge',
      built: true,
      plot: plot,
      walls: walls,
      topPlot: null,
      baseTerrain: baseTerrain,
      mats: { wood: 50, stone: 100 },
      req: 5,
      hp: 200
    });
    
    // Use unified construction system (same as player builds)
    global.BuildingConstruction.constructForge(forgeId, plot, walls);
    
    // Update faction patrol list
    this.house.updatePatrolList();
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[forgeId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return forgeId;
  }
  
  // Construct a garrison
  buildGarrison(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    let spot = null;
    
    for (const radius of radii) {
      spot = global.tilemapSystem.findBuildingSpot('garrison', searchCenter, radius, {
      excludeTiles: this.getOccupiedTiles()
    });
      if (spot) {
        break; // Found a spot, use it
      }
    }
    
    if (!spot) {
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const walls = spot.walls;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles (constructGarrison will change them)
    const baseTerrain = [];
    for (const tile of plot) {
      baseTerrain.push(global.getTile(0, tile[0], tile[1]));
    }
    
    // Create garrison
    const garrisonId = Math.random();
    const entrance = [plot[0][0], plot[0][1]];
    const ustairs = walls.length > 0 ? [walls[0][0], walls[0][1]] : null;
    
    Garrison({
      id: garrisonId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: 'garrison',
      built: true,
      plot: plot,
      topPlot: topPlot,
      walls: walls,
      entrance: entrance,
      ustairs: ustairs,
      baseTerrain: baseTerrain,
      mats: { wood: 50, stone: 30 },
      req: 5,
      hp: 200
    });
    
    // Use unified construction system (same as player builds)
    global.BuildingConstruction.constructGarrison(garrisonId, plot, topPlot, walls);
    
    // Update faction patrol list
    this.house.updatePatrolList();
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[garrisonId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return garrisonId;
  }
  
  buildGuardtower(location = null) {
    if (!location || !Array.isArray(location) || location.length < 2) {
      return null;
    }
    
    // Check if faction has a tower type (Norsemen and others don't have towers)
    const towerType = this.getFactionTowerType();
    if (!towerType) {
      return null; // Faction doesn't have tower type
    }
    
    const searchCenter = location;
    
    // Try multiple radii if initial search fails
    const radii = [3, 5, 8, 10];
    let spot = null;
    
    for (const radius of radii) {
      spot = global.tilemapSystem.findBuildingSpot(towerType, searchCenter, radius, {
        excludeTiles: this.getOccupiedTiles()
      });
      if (spot) {
        break; // Found a spot, use it
      }
    }
    
    if (!spot) {
      return null;
    }
    
    const plot = spot.plot;
    const topPlot = spot.topPlot;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles
    const baseTerrain = [];
    for (const tile of plot) {
      baseTerrain.push(global.getTile(0, tile[0], tile[1]));
    }
    
    // Create guardtower
    const guardtowerId = Math.random();
    
    Guardtower({
      id: guardtowerId,
      house: this.house.id,
      owner: this.house.id,
      x: center[0],
      y: center[1],
      z: 0,
      type: towerType,
      built: true,
      plot: plot,
      topPlot: topPlot,
      baseTerrain: baseTerrain,
      mats: { stone: 120 },
      req: 5,
      hp: 150
    });
    
    // Update faction patrol list
    this.house.updatePatrolList();
    
    // Check if building is outside base territory (mark as colony)
    const building = global.Building.list[guardtowerId];
    if (building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)) {
      building.isColony = true;
    }
    
    return guardtowerId;
  }
  
  // Helper: get all occupied tiles (buildings + HQ)
  getOccupiedTiles() {
    const occupied = [this.house.hq];
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.plot) {
          occupied.push(...building.plot);
        }
      }
    }
    
    return occupied;
  }
  
  // Helper: get buildings by type
  getBuildingsByType(type) {
    const buildings = [];
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.type === type) {
          buildings.push(building);
        }
      }
    }
    
    return buildings;
  }
}

module.exports = BuildingConstructor;

