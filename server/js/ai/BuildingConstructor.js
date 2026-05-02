// Building Constructor for AI
// Handles actual building placement and construction for AI goals

class BuildingConstructor {
  constructor(house) {
    this.house = house;
  }

  getContextEntity() {
    if (this.house && this.house.leader && global.Player && global.Player.list) {
      return global.Player.list[this.house.leader] || null;
    }
    return null;
  }

  getTile(layer, c, r) {
    const contextEntity = this.getContextEntity();
    return global.getTile ? global.getTile(layer, c, r, contextEntity) : 0;
  }

  tileChange(layer, c, r, value, incr = false) {
    const contextEntity = this.getContextEntity();
    if (typeof global.tileChange === 'function') {
      global.tileChange(layer, c, r, value, incr, contextEntity);
    }
  }

  matrixChange(layer, c, r, value) {
    const contextEntity = this.getContextEntity();
    if (typeof global.matrixChange === 'function') {
      global.matrixChange(layer, c, r, value, contextEntity);
    }
  }
  
  // Check if house/faction is Celts
  isCelts() {
    const factionName = this.house?.name || '';
    const baseName = factionName.replace(/\s+\d+$/, '').trim().toLowerCase();
    return baseName === 'celts';
  }

  getCeltDefensiveTerrain() {
    const TERRAIN = global.TERRAIN || {
      HEAVY_FOREST: 1,
      LIGHT_FOREST: 2,
      BRUSH: 3,
      GRASS: 7
    };
    return [TERRAIN.HEAVY_FOREST, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH, TERRAIN.GRASS];
  }
  
  // Check if a building spot is on forest tiles (HEAVY_FOREST or LIGHT_FOREST)
  isSpotOnForest(spot) {
    if (!spot || !spot.plot || !Array.isArray(spot.plot)) {
      return false;
    }
    
    const TERRAIN = global.TERRAIN || {};
    const FOREST_MIN = TERRAIN.HEAVY_FOREST || 1;
    const FOREST_MAX = TERRAIN.BRUSH || 3;
    
    // Check all tiles in the plot
    for (const tile of spot.plot) {
      if (!Array.isArray(tile) || tile.length < 2) continue;
      const terrain = this.getTile(0, tile[0], tile[1]);
      // Check if terrain is HEAVY_FOREST (1) or LIGHT_FOREST (2)
      if (terrain < FOREST_MIN || terrain >= FOREST_MAX) {
        return false; // At least one tile is not forest
      }
    }
    
    return true; // All tiles are forest
  }
  
  // Find a building spot on forest terrain (for Celts)
  // Searches for spots where all plot tiles are on HEAVY_FOREST or LIGHT_FOREST
  findBuildingSpotOnForest(buildingType, searchCenter, maxRadius, options = {}) {
    const TERRAIN = global.TERRAIN || {};
    const FOREST_MIN = TERRAIN.HEAVY_FOREST || 1;
    const FOREST_MAX = TERRAIN.BRUSH || 3;
    const getBuilding = global.getBuilding || (() => null);
    const excludeTilesArray = options.excludeTiles || [];
    const contextEntity = this.getContextEntity();
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(contextEntity)
      : (global.mapSize || 192);
    
    // Diagnostic logging - get faction name for context
    const factionName = this.house?.name || 'Unknown';
    const logKey = `celts-forest-search-${factionName}-${buildingType}`;
    const now = Date.now();
    
    // Throttle logging (only log every 30 seconds per building type per faction)
    if (!this._forestSearchLogThrottle) {
      this._forestSearchLogThrottle = {};
    }
    const lastLog = this._forestSearchLogThrottle[logKey] || 0;
    const LOG_THROTTLE_MS = 30000; // 30 seconds
    const shouldLog = (now - lastLog) > LOG_THROTTLE_MS;
    
    if (shouldLog) {
      console.log(`[CELTS FOREST SEARCH] ${factionName}: Searching for ${buildingType} on forest terrain - center: [${searchCenter[0]}, ${searchCenter[1]}], maxRadius: ${maxRadius}`);
      this._forestSearchLogThrottle[logKey] = now;
    }
    
    // Convert exclude tiles array to Set for efficient lookup
    const excludeTilesSet = new Set();
    for (const tile of excludeTilesArray) {
      if (Array.isArray(tile) && tile.length >= 2) {
        excludeTilesSet.add(`${tile[0]},${tile[1]}`);
      }
    }
    
    // Get building definition to know the plot shape
    let buildingDef = null;
    if (global.buildingPreview && global.buildingPreview.buildingDefinitions) {
      buildingDef = global.buildingPreview.buildingDefinitions[buildingType];
      
      // Debug: if lookup fails, log available keys
      if (!buildingDef && shouldLog) {
        const availableKeys = Object.keys(global.buildingPreview.buildingDefinitions || {});
        console.log(`[CELTS FOREST SEARCH] ${factionName}: Building type '${buildingType}' not found in buildingDefinitions. Available keys: ${availableKeys.join(', ')}`);
      }
    } else {
      if (shouldLog) {
        console.log(`[CELTS FOREST SEARCH] ${factionName}: global.buildingPreview is not available or missing buildingDefinitions`);
      }
    }
    
    if (!buildingDef || !buildingDef.plot) {
      // Fallback: try to use findBuildingSpot anyway and check if it's on forest
      if (shouldLog) {
        console.log(`[CELTS FOREST SEARCH] ${factionName}: No building definition found for ${buildingType}, using fallback search`);
      }
      const spot = global.tilemapSystem.findBuildingSpot(buildingType, searchCenter, maxRadius, options);
      if (spot && this.isSpotOnForest(spot)) {
        if (shouldLog) {
          console.log(`[CELTS FOREST SEARCH] ${factionName}: Found valid forest spot via fallback search`);
        }
        return spot;
      }
      if (shouldLog) {
        console.log(`[CELTS FOREST SEARCH] ${factionName}: Fallback search did not find valid forest spot`);
      }
      return null;
    }
    
    const plot = buildingDef.plot; // Relative plot coordinates
    const walls = buildingDef.walls || [];
    
    // Track statistics for logging
    let totalForestTilesChecked = 0;
    let totalSamplePointsChecked = 0;
    let forestTilesFound = 0;
    let rejectedNotForest = 0;
    let rejectedOccupied = 0;
    let rejectedBounds = 0;
    
    // Search in expanding radius from center
    for (let radius = 5; radius <= maxRadius; radius += 5) {
      // Sample points in a spiral pattern for efficiency (more samples at larger radii)
      const samplePoints = [];
      const numSamples = Math.min(8 + Math.floor(radius / 5), 16); // 8-16 samples depending on radius
      for (let i = 0; i < numSamples; i++) {
        const angle = (i / numSamples) * Math.PI * 2;
        const x = Math.floor(searchCenter[0] + Math.cos(angle) * radius);
        const y = Math.floor(searchCenter[1] + Math.sin(angle) * radius);
        
        // Clamp to map bounds
        const col = Math.max(0, Math.min(mapSize - 1, x));
        const row = Math.max(0, Math.min(mapSize - 1, y));
        samplePoints.push([col, row]);
      }
      
      // Try each sample point as the center of the building plot
      for (const centerTile of samplePoints) {
        const [centerCol, centerRow] = centerTile;
        totalSamplePointsChecked++;
        
        // Check if center tile is on forest
        const centerTerrain = this.getTile(0, centerCol, centerRow);
        if (centerTerrain < FOREST_MIN || centerTerrain >= FOREST_MAX) {
          rejectedNotForest++;
          continue; // Center not on forest, skip
        }
        
        forestTilesFound++; // Found a forest tile at center
        
        // Build the actual plot coordinates from relative plot
        const actualPlot = [];
        let allOnForest = true;
        let anyOccupied = false;
        
        for (const relativeTile of plot) {
          const [relX, relY] = relativeTile;
          const absCol = centerCol + relX;
          const absRow = centerRow + relY;
          
          // Bounds check
          if (absCol < 0 || absCol >= mapSize || absRow < 0 || absRow >= mapSize) {
            allOnForest = false;
            rejectedBounds++;
            break;
          }
          
          totalForestTilesChecked++;
          
          // Check if tile is on forest
          const terrain = this.getTile(0, absCol, absRow);
          if (terrain < FOREST_MIN || terrain >= FOREST_MAX) {
            allOnForest = false;
            rejectedNotForest++;
            break;
          }
          
          // Check if tile is occupied (in exclude list)
          const tileKey = `${absCol},${absRow}`;
          if (excludeTilesSet.has(tileKey)) {
            anyOccupied = true;
            rejectedOccupied++;
            break;
          }
          
          // Check if there's already a building here (more thorough check)
          const centerCoords = global.getCenter ? global.getCenter(absCol, absRow) : [absCol * 64, absRow * 64];
          const buildingAtTile = getBuilding(centerCoords[0], centerCoords[1]);
          if (buildingAtTile) {
            anyOccupied = true;
            rejectedOccupied++;
            break;
          }
          
          actualPlot.push([absCol, absRow]);
        }
        
        // If all tiles are on forest and not occupied, we found a valid spot
        if (allOnForest && !anyOccupied && actualPlot.length === plot.length) {
          // Build walls coordinates if needed
          const actualWalls = [];
          if (walls && walls.length > 0) {
            for (const relativeWall of walls) {
              const [relX, relY] = relativeWall;
              actualWalls.push([centerCol + relX, centerRow + relY]);
            }
          }
          
          if (shouldLog) {
            console.log(`[CELTS FOREST SEARCH] ${factionName}: Found valid forest spot for ${buildingType} at radius ${radius} - center: [${centerCol}, ${centerRow}]`);
          }
          
          return {
            plot: actualPlot,
            walls: actualWalls.length > 0 ? actualWalls : null
          };
        }
      }
    }
    
    // Log diagnostic summary if no spot found
    if (shouldLog) {
      console.log(`[CELTS FOREST SEARCH] ${factionName}: No valid forest spot found for ${buildingType} after searching radius up to ${maxRadius}`);
      console.log(`[CELTS FOREST SEARCH] ${factionName}: Diagnostic stats - Sample points checked: ${totalSamplePointsChecked}, Forest tiles found: ${forestTilesFound}, Tiles checked: ${totalForestTilesChecked}`);
      console.log(`[CELTS FOREST SEARCH] ${factionName}: Rejection reasons - Not forest: ${rejectedNotForest}, Occupied: ${rejectedOccupied}, Bounds: ${rejectedBounds}`);
      if (forestTilesFound === 0) {
        console.log(`[CELTS FOREST SEARCH] ${factionName}: WARNING - No forest tiles found in search radius. HQ may not be near forest terrain.`);
      }
    }
    
    return null; // No valid forest spot found
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
    let spot = null;
    
    // For Celts: must search specifically for forest terrain
    if (this.isCelts()) {
      const maxRadius = location ? 20 : 30; // Expanded from 15/25 to 20/30
      spot = this.findBuildingSpotOnForest('mill', searchCenter, maxRadius, {
        excludeTiles: this.getOccupiedTiles()
      });
      // Fallback: if no forest spot found, allow non-forest terrain as last resort
      if (!spot) {
        const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30];
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot && spot.plot && spot.plot[0]) {
            break; // Found a spot, use it
          }
        }
      }
    } else {
      // For other factions: use standard search (grass)
      const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30]; // Expanded radii
      
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          break; // Found a spot, use it
        }
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
          
          if (this.isCelts()) {
            spot = this.findBuildingSpotOnForest('mill', millLoc, 15, {
              excludeTiles: this.getOccupiedTiles()
            });
          } else {
            for (const radius of [5, 10, 15]) {
              spot = global.tilemapSystem.findBuildingSpot('mill', millLoc, radius, {
                excludeTiles: this.getOccupiedTiles()
              });
              if (spot && spot.plot && spot.plot[0]) {
                break;
              }
            }
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
            
            if (this.isCelts()) {
              spot = this.findBuildingSpotOnForest('mill', farmLoc, 15, {
                excludeTiles: this.getOccupiedTiles()
              });
            } else {
              for (const radius of [5, 10, 15]) {
                spot = global.tilemapSystem.findBuildingSpot('mill', farmLoc, radius, {
                  excludeTiles: this.getOccupiedTiles()
                });
                if (spot && spot.plot && spot.plot[0]) {
                  break;
                }
              }
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
      baseTerrain.push(this.getTile(0, tile[0], tile[1]));
    }
    
    // Update terrain tiles
    for (const tile of plot) {
      this.tileChange(0, tile[0], tile[1], 13); // BUILD marker
      this.tileChange(3, tile[0], tile[1], `mill${plot.indexOf(tile)}`);
      this.matrixChange(0, tile[0], tile[1], 1); // Block pathfinding
    }
    // Only set topPlot tiles if topPlot exists and has sufficient elements
    if (topPlot && Array.isArray(topPlot) && topPlot.length >= 2) {
      if (topPlot[0] && Array.isArray(topPlot[0]) && topPlot[0].length >= 2) {
        this.tileChange(5, topPlot[0][0], topPlot[0][1], 'mill4');
      }
      if (topPlot[1] && Array.isArray(topPlot[1]) && topPlot[1].length >= 2) {
        this.tileChange(5, topPlot[1][0], topPlot[1][1], 'mill5');
      }
    }
    
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
    // Configurable search radius (default: 6, can expand up to 20 for location blocking fallback)
    const FARM_SEARCH_RADIUS = 6;
    const MAX_SEARCH_RADIUS = 20; // Expanded from 15 to 20
    
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
            this.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
            this.tileChange(6, tile[0], tile[1], 0);
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
            this.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
            this.tileChange(6, tile[0], tile[1], 0);
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
              this.tileChange(0, tile[0], tile[1], 8); // FARM_SEED
              this.tileChange(6, tile[0], tile[1], 0);
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
    const MAX_SEARCH_RADIUS = 20; // Expanded from 15 to 20 for location blocking fallback
    
    const factionName = this.house?.name || 'Unknown';
    const mills = this.getBuildingsByType('mill');
    
    if (mills.length === 0) {
      console.log(`[FARM PLACEMENT] ${factionName}: No mills found - cannot place farm`);
      return false;
    }
    
    console.log(`[FARM PLACEMENT] ${factionName}: Checking farm placement near ${mills.length} mill(s)`);
    
    // Check each mill with increasing radius
    for (let i = 0; i < mills.length; i++) {
      const mill = mills[i];
      const searchCenter = mill.plot && mill.plot[0] ? mill.plot[0] : null;
      
      if (!searchCenter) {
        console.log(`[FARM PLACEMENT] ${factionName}: Mill ${i} has no valid plot center`);
        continue;
      }
      
      console.log(`[FARM PLACEMENT] ${factionName}: Checking mill ${i} at [${searchCenter[0]}, ${searchCenter[1]}]`);
      
      let radius = FARM_SEARCH_RADIUS;
      let candidateCount = 0;
      
      while (radius <= MAX_SEARCH_RADIUS) {
        const occupiedTiles = this.getOccupiedTiles();
        const spot = global.tilemapSystem.findBuildingSpot('farm', searchCenter, radius, {
          excludeTiles: occupiedTiles
        });
        
        candidateCount++;
        
        if (spot) {
          console.log(`[FARM PLACEMENT] ${factionName}: Found valid farm location at radius ${radius} near mill ${i}`);
          return true; // Found a valid location
        }
        
        radius += 2;
      }
      
      console.log(`[FARM PLACEMENT] ${factionName}: No valid location found near mill ${i} (checked ${candidateCount} radii up to ${MAX_SEARCH_RADIUS})`);
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
    
    // For Celts: must search specifically for forest terrain
    if (this.isCelts()) {
      const maxRadius = location ? 20 : 30; // Expanded from 15/25 to 20/30
      let spot = this.findBuildingSpotOnForest('mill', searchCenter, maxRadius, {
        excludeTiles: this.getOccupiedTiles()
      });
      // Fallback: if no forest spot found, allow non-forest terrain as last resort
      if (!spot || !spot.plot || !spot.plot[0]) {
        const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30];
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot && spot.plot && spot.plot[0]) {
            return true;
          }
        }
      }
      return spot !== null && spot.plot && spot.plot[0];
    }
    
    // For other factions: use standard search (grass)
    const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30]; // Expanded radii
    
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
  // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
  canPlaceMine(location = null, mineType = 'any') {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // Try multiple radii if initial search fails (location blocking fallback) - expanded radii
    const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30];
    
    // Use same logic as buildMine but just check for spot
    let spot = null;
    if (mineType === 'stone') {
      const attempts = [];
      let bestSpot = null; // Track best available spot even if near cave
      // Try each radius until we find a valid stone mine location (away from caves)
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          const nearCave = this.isNearCaveEntrance(spot.plot[0]);
          const hasStoneResources = this.hasStoneResourcesNearby(spot.plot[0]);
          attempts.push({
            radius,
            foundSpot: true,
            nearCave: !!nearCave,
            hasStoneResources,
            resourceScan: this._scanStoneResources(spot.plot[0])
          });
          if (!nearCave && hasStoneResources) {
            return true; // Found valid stone mine location (not near cave)
          }
          // Track best spot even if near cave (fallback if no other options)
          if (hasStoneResources && !bestSpot) {
            bestSpot = spot;
          }
          // Near cave, reject this spot and try next radius
          spot = null;
        } else {
          attempts.push({
            radius,
            foundSpot: false
          });
        }
      }
      // If no ideal spot found but we have a spot with stone resources (even if near cave), allow it
      if (bestSpot) {
        const factionName = this.house?.name || 'Unknown';
        console.log(`[MINE PLACEMENT] ${factionName}: Using stone mine location near cave as fallback (no other options available)`);
        return true;
      }
      // No valid stone mine location found (all spots were near caves)
      this._logStoneMineDiagnostics({
        phase: 'canPlaceMine',
        mineType,
        searchCenter,
        radii,
        attempts
      });
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
          if (spot && spot.plot && spot.plot[0]) {
            const resolvedCaveLoc = this.isNearCaveEntrance(spot.plot[0]) || caveLoc;
            if (this.hasCaveResourcesNearby(resolvedCaveLoc)) {
              break;
            }
            spot = null;
          }
        }
      }
      if (!spot) {
        // Try each radius until we find a spot
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot && spot.plot && spot.plot[0]) {
            const caveLoc = this.isNearCaveEntrance(spot.plot[0]);
            if (this.hasCaveResourcesNearby(caveLoc || spot.plot[0])) {
              break;
            }
            spot = null;
          }
        }
      }
    } else {
      // Try each radius until we find a spot
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          const caveLoc = this.isNearCaveEntrance(spot.plot[0]);
          if (caveLoc && this.hasCaveResourcesNearby(caveLoc)) {
            break;
          }
          if (!caveLoc && this.hasStoneResourcesNearby(spot.plot[0])) {
            break;
          }
          spot = null;
        }
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
        // For Celts: lumbermills require wood, so must be on forest tiles (though Celts don't build them)
        if (this.isCelts() && !this.isSpotOnForest(spot)) {
          continue; // Try next radius
        }
        return true;
      }
    }
    
    return false;
  }
  
  // Check if a forge can be placed (validation-only)
  canPlaceForge(location = null) {
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    // For Celts: must search specifically for forest terrain
    if (this.isCelts()) {
      const maxRadius = location ? 10 : 20;
      const spot = this.findBuildingSpotOnForest('forge', searchCenter, maxRadius, {
        excludeTiles: this.getOccupiedTiles()
      });
      return spot !== null && spot.plot && spot.plot[0];
    }
    
    // For other factions: use standard search (grass/rock/mountain)
    const radii = location ? [3, 6, 10] : [10, 15, 20];
    
    for (const radius of radii) {
      const spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
        excludeTiles: this.getOccupiedTiles()
      });
      
      if (spot && spot.plot && spot.plot[0]) {
        return true;
      }
    }
    
    return false;
  }
  
  // Check if a garrison can be placed (validation-only)
  canPlaceGarrison(location = null) {
    const factionName = this.house?.name || 'Unknown';
    const hq = this.house.hq;
    const searchCenter = location || hq;
    
    if (!searchCenter) {
      console.log(`[GARRISON PLACEMENT] ${factionName}: No HQ or location provided`);
      return false;
    }
    
    console.log(`[GARRISON PLACEMENT] ${factionName}: Checking garrison placement at [${searchCenter[0]}, ${searchCenter[1]}]`);
    
    // Try multiple radii if initial search fails (location blocking fallback)
    const radii = location ? [3, 6, 10, 15, 20] : [10, 15, 20, 25, 30];
    const occupiedTiles = this.getOccupiedTiles();
    
    console.log(`[GARRISON PLACEMENT] ${factionName}: Checking ${radii.length} radii, ${occupiedTiles.length} occupied tiles to exclude`);
    
    const tryFindGarrisonSpot = (center) => {
      for (const radius of radii) {
        const placementOptions = { excludeTiles: occupiedTiles };
        if (this.isCelts()) {
          placementOptions.validTerrain = this.getCeltDefensiveTerrain();
        }
        const spot = global.tilemapSystem.findBuildingSpot('garrison', center, radius, placementOptions);
        if (spot && spot.plot && spot.plot[0]) {
          console.log(`[GARRISON PLACEMENT] ${factionName}: Found valid garrison location at radius ${radius}`);
          return true;
        }
      }
      return false;
    };
    
    if (tryFindGarrisonSpot(searchCenter)) {
      return true;
    }
    
    // Fallback: try near outposts if HQ is blocked
    if (global.Building && global.Building.list) {
      for (const id in global.Building.list) {
        const b = global.Building.list[id];
        if (!b || b.type !== 'outpost' || b.house !== this.house.id || !b.built) continue;
        if (global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(this.getContextEntity(), b)) {
          continue;
        }
        const outpostLoc = Array.isArray(b.plot) && b.plot[0] ? b.plot[0] : global.getLoc(b.x, b.y, b);
        if (outpostLoc && tryFindGarrisonSpot(outpostLoc)) {
          return true;
        }
      }
    }
    
    console.log(`[GARRISON PLACEMENT] ${factionName}: No valid garrison location found after checking all radii`);
    return false; // No valid location found
  }
  
  // Check if a guardtower can be placed (validation-only)
  canPlaceGuardtower(location = null) {
    const factionName = this.house?.name || 'Unknown';
    
    if (!location || !Array.isArray(location) || location.length < 2) {
      console.log(`[GUARDTOWER PLACEMENT] ${factionName}: No valid location provided`);
      return false;
    }
    
    // Check if faction has a tower type (Norsemen and others don't have towers)
    const towerType = this.getFactionTowerType();
    if (!towerType) {
      console.log(`[GUARDTOWER PLACEMENT] ${factionName}: Faction does not have tower type`);
      return false; // Faction doesn't have tower type
    }
    
    const searchCenter = location;
    const radius = 5; // Search within 5 tiles of target location
    const occupiedTiles = this.getOccupiedTiles();
    
    console.log(`[GUARDTOWER PLACEMENT] ${factionName}: Checking guardtower placement at [${searchCenter[0]}, ${searchCenter[1]}] with tower type ${towerType}, radius ${radius}`);
    
    let spot = null;
    if (this.isCelts()) {
      spot = this.findBuildingSpotOnForest(towerType, searchCenter, radius + 5, {
        excludeTiles: occupiedTiles
      });
    }

    if (!spot) {
      spot = global.tilemapSystem.findBuildingSpot(towerType, searchCenter, radius, {
        excludeTiles: occupiedTiles
      });
    }
    
    if (spot !== null && spot.plot && spot.plot[0]) {
      console.log(`[GUARDTOWER PLACEMENT] ${factionName}: Found valid guardtower location`);
      return true;
    }
    
    console.log(`[GUARDTOWER PLACEMENT] ${factionName}: No valid guardtower location found at outpost`);
    return false;
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
        const terrain = this.getTile(0, checkTile[0], checkTile[1]);
        
        if (terrain === CAVE_ENTRANCE) {
          // Found cave entrance nearby
          return checkTile;
        }
      }
    }
    
    return null; // No cave entrance nearby
  }

  // Check for stone resources near a location (stone mines)
  hasStoneResourcesNearby(location, radius = 6) {
    if (!location || !Array.isArray(location) || location.length < 2) return false;
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(this.getContextEntity())
      : (global.mapSize || 192);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = location[0] + dx;
        const row = location[1] + dy;
        if (col < 0 || row < 0 || col >= mapSize || row >= mapSize) continue;
        const terrain = this.getTile(0, col, row);
        const layer6Res = this.getTile(6, col, row);
        const isStoneResource = (terrain === 4) ||
          (terrain > 4 && terrain < 5) ||
          (terrain >= 5 && terrain < 6);
        const isLargeRock = (global.isLargeRock && global.isLargeRock(terrain)) || (!global.isLargeRock && isStoneResource);
        if (isLargeRock && layer6Res > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Check for cave ore resources near a cave entrance (ore mines)
  hasCaveResourcesNearby(location, radius = 10) {
    if (!location || !Array.isArray(location) || location.length < 2) return false;
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(this.getContextEntity())
      : (global.mapSize || 192);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = location[0] + dx;
        const row = location[1] + dy;
        if (col < 0 || row < 0 || col >= mapSize || row >= mapSize) continue;
        const tile = this.getTile(1, col, row);
        if (tile >= 3 && tile <= 5) {
          return true;
        }
      }
    }
    return false;
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
      const attempts = [];
      // Prefer locations NOT near caves (stone mines)
      // Try each radius until we find a valid stone mine location
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        
        // Verify it's not near a cave
        if (spot && spot.plot && spot.plot[0]) {
          const nearCave = this.isNearCaveEntrance(spot.plot[0]);
          const hasStoneResources = this.hasStoneResourcesNearby(spot.plot[0]);
          attempts.push({
            centerType: 'hq',
            radius,
            foundSpot: true,
            nearCave: !!nearCave,
            hasStoneResources,
            resourceScan: this._scanStoneResources(spot.plot[0])
          });
          if (!nearCave && hasStoneResources) {
            break; // Found valid stone mine location (not near cave)
            // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
          }
          // Near cave, reject this spot and try next radius
          spot = null;
        } else {
          attempts.push({
            centerType: 'hq',
            radius,
            foundSpot: false
          });
        }
      }
      this._pendingStoneMineAttempts = attempts;
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
          
          if (spot && spot.plot && spot.plot[0]) {
            const resolvedCaveLoc = this.isNearCaveEntrance(spot.plot[0]) || caveLoc;
            if (this.hasCaveResourcesNearby(resolvedCaveLoc)) {
              break;
            }
            spot = null;
          }
          // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
        }
      }
      
      // Fallback to normal search with multiple radii if no cave spot found
      if (!spot) {
        for (const radius of radii) {
          spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
            excludeTiles: this.getOccupiedTiles()
          });
          if (spot && spot.plot && spot.plot[0]) {
            const caveLoc = this.isNearCaveEntrance(spot.plot[0]);
            if (this.hasCaveResourcesNearby(caveLoc || spot.plot[0])) {
              break;
            }
            spot = null;
          }
          // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
        }
      }
    } else {
      // 'any' - use normal search with multiple radii
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('mine', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          const caveLoc = this.isNearCaveEntrance(spot.plot[0]);
          if (caveLoc && this.hasCaveResourcesNearby(caveLoc)) {
            break;
          }
          if (!caveLoc && this.hasStoneResourcesNearby(spot.plot[0])) {
            break;
          }
          spot = null;
        }
        // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
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
            if (spot && spot.plot && spot.plot[0]) {
              const candidateLoc = spot.plot[0];
              const caveLoc = this.isNearCaveEntrance(candidateLoc);
              const hasStoneResources = this.hasStoneResourcesNearby(candidateLoc);
              if (caveLoc && this.hasCaveResourcesNearby(caveLoc)) {
                break;
              }
              if (!caveLoc && hasStoneResources) {
                break;
              }
              spot = null;
              if (mineType === 'stone') {
                this._pendingStoneMineAttempts = this._pendingStoneMineAttempts || [];
                this._pendingStoneMineAttempts.push({
                  centerType: 'existing_mine',
                  radius,
                  foundSpot: true,
                  nearCave: !!caveLoc,
                  hasStoneResources,
                  resourceScan: this._scanStoneResources(candidateLoc)
                });
              }
            }
            // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
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
              if (spot && spot.plot && spot.plot[0]) {
                const candidateLoc = spot.plot[0];
                const caveLoc = this.isNearCaveEntrance(candidateLoc);
                const hasStoneResources = this.hasStoneResourcesNearby(candidateLoc);
                if (caveLoc && this.hasCaveResourcesNearby(caveLoc)) {
                  break;
                }
                if (!caveLoc && hasStoneResources) {
                  break;
                }
                spot = null;
                if (mineType === 'stone') {
                  this._pendingStoneMineAttempts = this._pendingStoneMineAttempts || [];
                  this._pendingStoneMineAttempts.push({
                    centerType: 'outpost',
                    radius,
                    foundSpot: true,
                    nearCave: !!caveLoc,
                    hasStoneResources,
                    resourceScan: this._scanStoneResources(candidateLoc)
                  });
                }
              }
              // Note: Mines are exempt from forest tile requirement for Celts (they need to be near cave entrances)
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
            const terrain = this.getTile(0, checkLoc[0], checkLoc[1]);
            if (terrain !== null && !checkedTerrains.includes(terrain)) {
              checkedTerrains.push(terrain);
            }
          }
        }
        this.house.ai.logger.collectInfo(`Mine placement failed: checked terrains [${checkedTerrains.join(', ')}] around [${searchCenter[0]}, ${searchCenter[1]}]`);
        if (mineType === 'stone') {
          this._logStoneMineDiagnostics({
            phase: 'buildMine',
            mineType,
            searchCenter,
            radii,
            attempts: this._pendingStoneMineAttempts || []
          });
        }
      }
      this._pendingStoneMineAttempts = null;
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
      baseTerrain.push(this.getTile(0, plot[i][0], plot[i][1]));
    }
    
    // Update terrain (mines are just a base plot, no topPlot)
    for (let i = 0; i < plot.length; i++) {
      this.tileChange(0, plot[i][0], plot[i][1], 13);
      this.tileChange(3, plot[i][0], plot[i][1], `mine${i}`);
      this.matrixChange(0, plot[i][0], plot[i][1], 1);
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
    this._pendingStoneMineAttempts = null;
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
      baseTerrain.push(this.getTile(0, plot[i][0], plot[i][1]));
    }
    
    // Update terrain
    for (let i = 0; i < plot.length; i++) {
      this.tileChange(0, plot[i][0], plot[i][1], 13);
      this.tileChange(3, plot[i][0], plot[i][1], `lumbermill${i}`);
      this.matrixChange(0, plot[i][0], plot[i][1], 1);
    }
    this.tileChange(5, topPlot[0][0], topPlot[0][1], 'lumbermill2');
    this.tileChange(5, topPlot[1][0], topPlot[1][1], 'lumbermill3');
    
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
    let spot = null;
    
    // For Celts: must search specifically for forest terrain
    if (this.isCelts()) {
      const maxRadius = location ? 10 : 20;
      spot = this.findBuildingSpotOnForest('forge', searchCenter, maxRadius, {
        excludeTiles: this.getOccupiedTiles()
      });
    } else {
      // For other factions: use standard search (grass/rock/mountain)
      const radii = location ? [3, 6, 10] : [10, 15, 20];
      
      for (const radius of radii) {
        spot = global.tilemapSystem.findBuildingSpot('forge', searchCenter, radius, {
          excludeTiles: this.getOccupiedTiles()
        });
        if (spot && spot.plot && spot.plot[0]) {
          break; // Found a spot, use it
        }
      }
    }
    
    if (!spot || !spot.plot || !spot.plot[0]) {
      return null;
    }
    
    const plot = spot.plot;
    const walls = spot.walls;
    const center = global.getCenter(plot[0][0], plot[0][1]);
    
    // Store original terrain before changing tiles (constructForge will change them)
    const baseTerrain = [];
    for (const tile of plot) {
      baseTerrain.push(this.getTile(0, tile[0], tile[1]));
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
    const radii = location ? [3, 6, 10, 15] : [10, 15, 20, 25];
    let spot = null;
    const occupiedTiles = this.getOccupiedTiles();
    
    const tryFindGarrisonSpot = (center) => {
      for (const radius of radii) {
        const placementOptions = { excludeTiles: occupiedTiles };
        if (this.isCelts()) {
          placementOptions.validTerrain = this.getCeltDefensiveTerrain();
        }
        spot = global.tilemapSystem.findBuildingSpot('garrison', center, radius, placementOptions);
        if (spot) {
          return true;
        }
      }
      return false;
    };
    
    if (!tryFindGarrisonSpot(searchCenter)) {
      if (global.Building && global.Building.list) {
        for (const id in global.Building.list) {
          const b = global.Building.list[id];
          if (!b || b.type !== 'outpost' || b.house !== this.house.id || !b.built) continue;
          if (global.mapContextHelpers && !global.mapContextHelpers.areInSameContext(this.getContextEntity(), b)) {
            continue;
          }
          const outpostLoc = Array.isArray(b.plot) && b.plot[0] ? b.plot[0] : global.getLoc(b.x, b.y, b);
          if (outpostLoc && tryFindGarrisonSpot(outpostLoc)) {
            break;
          }
        }
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
      baseTerrain.push(this.getTile(0, tile[0], tile[1]));
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
      const occupiedTiles = this.getOccupiedTiles();
      if (this.isCelts()) {
        spot = this.findBuildingSpotOnForest(towerType, searchCenter, radius + 5, {
          excludeTiles: occupiedTiles
        });
      }

      if (!spot) {
        spot = global.tilemapSystem.findBuildingSpot(towerType, searchCenter, radius, {
          excludeTiles: occupiedTiles
        });
      }
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
      baseTerrain.push(this.getTile(0, tile[0], tile[1]));
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

  // Diagnostic: throttle stone mine failure logs
  _shouldLogStoneMineDiagnostics() {
    const factionName = this.house?.name || 'Unknown';
    const day = global.day || 1;
    const key = `${factionName}-day${day}`;
    const now = Date.now();
    if (!this._stoneMineLogThrottle) {
      this._stoneMineLogThrottle = {};
    }
    const lastLog = this._stoneMineLogThrottle[key] || 0;
    const LOG_THROTTLE_MS = 30000;
    if (now - lastLog < LOG_THROTTLE_MS) {
      return false;
    }
    this._stoneMineLogThrottle[key] = now;
    return true;
  }

  _scanStoneResources(location, radius = 6) {
    if (!location || !Array.isArray(location) || location.length < 2) return null;
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(this.getContextEntity())
      : (global.mapSize || 192);
    let tilesChecked = 0;
    let stoneTerrainCount = 0;
    let largeRockCount = 0;
    let layer6ResCount = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = location[0] + dx;
        const row = location[1] + dy;
        if (col < 0 || row < 0 || col >= mapSize || row >= mapSize) continue;
        tilesChecked++;
        const terrain = this.getTile(0, col, row);
        const layer6Res = this.getTile(6, col, row);
        const isStoneResource = (terrain === 4) ||
          (terrain > 4 && terrain < 5) ||
          (terrain >= 5 && terrain < 6);
        const isLargeRock = (global.isLargeRock && global.isLargeRock(terrain)) || (!global.isLargeRock && isStoneResource);
        if (isStoneResource) stoneTerrainCount++;
        if (isLargeRock) largeRockCount++;
        if (layer6Res > 0) layer6ResCount++;
      }
    }
    return {
      radius,
      tilesChecked,
      stoneTerrainCount,
      largeRockCount,
      layer6ResCount
    };
  }

  _logStoneMineDiagnostics({ phase, mineType, searchCenter, radii, attempts }) {
    if (!this.house?.ai?.logger) return;
    if (!this._shouldLogStoneMineDiagnostics()) return;
    const occupiedTilesCount = this.getOccupiedTiles().length;
    const caveEntrancesCount = Array.isArray(global.caveEntrances) ? global.caveEntrances.length : 0;
    const diagnostics = {
      phase,
      mineType,
      searchCenter,
      radii,
      occupiedTilesCount,
      caveEntrancesCount,
      attempts: attempts || []
    };
    this.house.ai.logger.collectInfo('Stone mine placement diagnostics (failure)', diagnostics);
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

