/**
 * BattlegroundsMapPostProcessor - Applies game mode-specific modifications to maps
 */

class BattlegroundsMapPostProcessor {
  constructor() {
    this.TERRAIN = global.TERRAIN || {
      WATER: 0,
      HEAVY_FOREST: 1,
      LIGHT_FOREST: 2,
      BRUSH: 3,
      ROCKS: 4,
      MOUNTAIN: 5,
      CAVE_ENTRANCE: 6,
      EMPTY: 7,
      DOOR_OPEN: 14,
      DOOR_OPEN_ALT: 16
    };
  }

  /**
   * Post-process a map for a specific game mode
   * @param {object} mapData - Map data from generator
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @param {object} match - Match object (for spawn points, teams, etc.)
   * @returns {object} Post-processed map data
   */
  postProcessMap(mapData, gameMode, match) {
    if (!mapData || !mapData.worldData) {
      console.error('Invalid map data for post-processing');
      return mapData;
    }

    // Make a deep copy of worldData to avoid modifying the original
    const processedWorldData = this.deepCopyWorldData(mapData.worldData);
    const processedMapData = { ...mapData, worldData: processedWorldData };

    // For dungeon maps, post-process buildings and tunnels first
    if (mapData.mapType === 'dungeons') {
      this.postProcessDungeon(processedWorldData, processedMapData, match);
    }

    // Calculate spawn points for all game modes (including deathmatch)
    let spawnPoints = [];
    if (gameMode === 'deathmatch') {
      const participantCount = match && match.participants ? match.participants.length : 4;
      spawnPoints = this.calculateDeathmatchSpawnPoints(processedWorldData, processedMapData, participantCount);
    } else if (gameMode === 'skirmish') {
      spawnPoints = this.calculateSkirmishSpawnPoints(processedWorldData, processedMapData);
      const processed = this.postProcessSkirmish(processedWorldData, processedMapData, match);
      processed.spawnPoints = spawnPoints;
      return processed;
    } else if (gameMode === 'assault') {
      spawnPoints = this.calculateAssaultSpawnPoints(processedWorldData, processedMapData);
      const processed = this.postProcessAssault(processedWorldData, processedMapData, match);
      processed.spawnPoints = spawnPoints;
      return processed;
    }

    // For deathmatch, return map with spawn points
    return {
      ...processedMapData,
      spawnPoints: spawnPoints,
      postProcessed: true
    };
  }

  /**
   * Post-process map for Skirmish mode
   */
  postProcessSkirmish(worldData, mapData, match) {
    const { mapType, mapSize, startingZ } = mapData;
    // For dungeon maps, z=-2 maps to worldData[9]
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];

    if (!layer) {
      console.error('Invalid layer for post-processing');
      return mapData;
    }

    if (mapType === 'continental' || mapType === 'mainland' || mapType === 'wild') {
      // Overworld maps: add visual clutter and fort enclosures at starting points
      this.addTeamStartingAreas(worldData, mapSize, startingZ, 'skirmish', mapType);
    } else if (mapType === 'caves') {
      // Cave maps: teams start at cave entrances, remove other entrances
      this.processCaveStartingAreas(worldData, mapSize, mapData.entrances || []);
    } else if (mapType === 'dungeons') {
      // Dungeon maps: create two strongholds with dungeon floors as starting points
      this.processDungeonStartingAreas(worldData, mapSize, mapType);
    }

    return {
      ...mapData,
      worldData: worldData,
      postProcessed: true
    };
  }

  /**
   * Post-process map for Assault mode
   */
  postProcessAssault(worldData, mapData, match) {
    const { mapType, mapSize, startingZ } = mapData;
    // For dungeon maps, z=-2 maps to worldData[9]
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];

    if (!layer) {
      console.error('Invalid layer for post-processing');
      return mapData;
    }

    if (mapType === 'continental' || mapType === 'mainland' || mapType === 'islands') {
      // Overworld maps: attackers on left, defenders on right with fortification
      this.addAssaultStartingAreas(worldData, mapSize, startingZ, mapType);
    } else if (mapType === 'dungeons') {
      // Dungeon maps: create strongholds for attackers and defenders
      this.processDungeonStartingAreas(worldData, mapSize, mapType);
      // Note: Capture point placement will be handled by AssaultMode game logic
    }

    return {
      ...mapData,
      worldData: worldData,
      postProcessed: true
    };
  }

  /**
   * Add team starting areas for Skirmish (overworld maps)
   */
  addTeamStartingAreas(worldData, mapSize, startingZ, gameMode, mapType) {
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];
    if (!layer) return;

    // Team 1: Left side (25% from left edge)
    const team1X = Math.floor(mapSize * 0.25);
    const team1Y = Math.floor(mapSize * 0.5);
    this.addStartingAreaDecoration(layer, mapSize, team1X, team1Y, startingZ);

    // Team 2: Right side (25% from right edge)
    const team2X = Math.floor(mapSize * 0.75);
    const team2Y = Math.floor(mapSize * 0.5);
    this.addStartingAreaDecoration(layer, mapSize, team2X, team2Y, startingZ);
  }

  /**
   * Add visual clutter and fort enclosure at starting area
   */
  addStartingAreaDecoration(layer, mapSize, centerX, centerY, startingZ) {
    // Create a small fort enclosure (5x5 area with walls/barriers)
    const radius = 3;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) continue;
        
        // Create border walls (simplified - using rocks/mountains as barriers)
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          if (startingZ === 0 && layer[y] && this.isWalkable(layer[y][x], 0)) {
            // Place rocks as visual barriers (not actual blocking, just visual)
            // In a full implementation, you'd add actual building/fence tiles
            layer[y][x] = this.TERRAIN.ROCKS;
          }
        } else {
          // Clear interior area for spawns
          if (startingZ === 0 && layer[y]) {
            layer[y][x] = this.TERRAIN.EMPTY;
          }
        }
      }
    }
  }

  /**
   * Process cave starting areas (remove unused entrances)
   */
  processCaveStartingAreas(worldData, mapSize, entrances) {
    if (!entrances || entrances.length < 2) {
      console.warn('Not enough cave entrances for team starting areas');
      return;
    }

    // Use first two entrances for team starting areas
    const team1Entrance = entrances[0];
    const team2Entrance = entrances[1];

    // Remove other entrances (convert to regular terrain)
    const overworldLayer = worldData[0];
    const caveLayer = worldData[1];

    if (overworldLayer && caveLayer) {
      for (let i = 2; i < entrances.length; i++) {
        const entrance = entrances[i];
        if (entrance && entrance[0] !== undefined && entrance[1] !== undefined) {
          const x = entrance[0];
          const y = entrance[1];
          
          // Convert cave entrance to regular terrain
          if (overworldLayer[y] && overworldLayer[y][x] === this.TERRAIN.CAVE_ENTRANCE) {
            // Convert to nearby terrain type (e.g., empty or forest)
            overworldLayer[y][x] = this.TERRAIN.EMPTY;
          }
          
          // Remove cave exit below
          if (caveLayer[y + 1] && caveLayer[y + 1][x] === 2) {
            caveLayer[y + 1][x] = 1; // Convert to wall
          }
        }
      }
    }

    // TODO: Add lighting to starting areas (fire pits, wall torches)
    this.addCaveLighting(caveLayer, mapSize, team1Entrance, team2Entrance);
  }

  /**
   * Post-process dungeon map: place buildings, generate tunnels from auto-created cellars
   */
  postProcessDungeon(worldData, mapData, match) {
    const { mapSize, startingZ } = mapData;
    const cellarLayer = worldData[9];
    if (!cellarLayer) return mapData;
    
    // 1. Place buildings (they automatically create their cellars at z=-2)
    const BattlegroundsDungeonBuildingPlacer = require('./BattlegroundsDungeonBuildingPlacer');
    const buildingPlacer = new BattlegroundsDungeonBuildingPlacer();
    const buildings = buildingPlacer.placeDungeonBuildings(
      worldData, 
      mapSize, 
      match.gameMode
    );
    
    // 2. Get cellar plot coordinates from building objects
    const buildingCellarPlots = buildings.map(building => building.cellarPlot);
    
    // 3. Generate tunnels from building cellars
    this.generateDungeonTunnels(cellarLayer, mapSize, buildingCellarPlots, buildings);
    
    // 4. Store building info for spawn point calculation
    mapData.dungeonBuildings = buildings;
    
    return mapData;
  }

  /**
   * Process dungeon starting areas (legacy method - now calls postProcessDungeon)
   */
  processDungeonStartingAreas(worldData, mapSize, mapType) {
    // This method is called from postProcessSkirmish/postProcessAssault
    // For now, we'll handle dungeon processing in postProcessMap instead
    // This is kept for backward compatibility
  }

  /**
   * Generate tunnels in dungeon starting from building cellar plots
   * IMPORTANT: Only converts wall tiles (1) to floor tiles (0)
   * Never modifies existing floor tiles (0) or other values
   * Cannot modify tiles adjacent to stairs tiles
   * @param {Array} cellarLayer - z=-2 layer (worldData[9])
   * @param {number} mapSize - Map size
   * @param {Array} buildingCellarPlots - Array of cellar plot coordinates [[[x,y], ...], ...]
   * @param {Array} buildings - Array of building objects with dstairs property
   */
  generateDungeonTunnels(cellarLayer, mapSize, buildingCellarPlots, buildings) {
    if (!cellarLayer) return;

    // 1. Identify stair tiles and mark protected tiles (adjacent to stairs)
    const protectedTiles = new Set();
    for (const building of buildings) {
      if (building.dstairs) {
        const [stairsX, stairsY] = building.dstairs;
        // Mark all 4 adjacent tiles as protected
        const adjacent = [
          [stairsX, stairsY - 1], // North
          [stairsX, stairsY + 1], // South
          [stairsX - 1, stairsY], // West
          [stairsX + 1, stairsY]  // East
        ];
        for (const [x, y] of adjacent) {
          if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
            protectedTiles.add(`${x},${y}`);
          }
        }
      }
    }

    // 2. For each building's cellar plot, find starting points for tunnels
    const startingPoints = [];
    for (let i = 0; i < buildingCellarPlots.length; i++) {
      const cellarPlot = buildingCellarPlots[i];
      const building = buildings[i];
      
      // Find all walkable plot tiles in cellar (value 0)
      const walkablePlotTiles = [];
      for (const [x, y] of cellarPlot) {
        if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
          if (cellarLayer[y] && cellarLayer[y][x] === 0) {
            walkablePlotTiles.push([x, y]);
          }
        }
      }

      // Find adjacent wall tiles (value 1) to walkable plot tiles
      const adjacentWalls = [];
      for (const [x, y] of walkablePlotTiles) {
        const adjacent = [
          [x, y - 1], // North
          [x, y + 1], // South
          [x - 1, y], // West
          [x + 1, y]  // East
        ];
        for (const [adjX, adjY] of adjacent) {
          if (adjX >= 0 && adjX < mapSize && adjY >= 0 && adjY < mapSize) {
            const key = `${adjX},${adjY}`;
            // Check if it's a wall, not protected, and not already in list
            if (!protectedTiles.has(key) && 
                cellarLayer[adjY] && 
                cellarLayer[adjY][adjX] === 1) {
              adjacentWalls.push([adjX, adjY]);
            }
          }
        }
      }

      // Randomly select one adjacent wall tile as starting point per building
      if (adjacentWalls.length > 0) {
        const randomIndex = Math.floor(Math.random() * adjacentWalls.length);
        startingPoints.push(adjacentWalls[randomIndex]);
      }
    }

    // 3. Run modified geoform algorithm from each starting point
    for (const [startX, startY] of startingPoints) {
      this.generateTunnelFromPoint(cellarLayer, mapSize, startX, startY, protectedTiles);
    }
  }

  /**
   * Generate a tunnel from a starting point using modified geoform algorithm
   * Only converts walls (1) to floors (0), skips protected tiles
   * @param {Array} cellarLayer - z=-2 layer
   * @param {number} mapSize - Map size
   * @param {number} startX - Starting X coordinate
   * @param {number} startY - Starting Y coordinate
   * @param {Set} protectedTiles - Set of protected tile keys (format: "x,y")
   */
  generateTunnelFromPoint(cellarLayer, mapSize, startX, startY, protectedTiles) {
    const maxTunnels = 200;
    const maxLength = 10;
    const minLength = 1;
    const roomChance = 0.15;
    const roomSize = 3;
    const continueDirectionChance = 0.4;
    const branchChance = 0.3;
    const randomWalkChance = 0.3;

    let currentRow = startY;
    let currentColumn = startX;
    let maxTunnelsRemaining = maxTunnels;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]]; // left, right, up, down
    let lastDirection = [];

    // Helper to check if tile is protected
    const isProtected = (x, y) => {
      return protectedTiles.has(`${x},${y}`);
    };

    // Helper to safely set tile (only if it's a wall and not protected)
    const setTile = (row, col) => {
      if (row < 0 || row >= mapSize || col < 0 || col >= mapSize) return false;
      if (!cellarLayer[row] || cellarLayer[row][col] === undefined) return false;
      if (isProtected(col, row)) return false;
      // Only convert walls (1) to floors (0)
      if (cellarLayer[row][col] === 1) {
        cellarLayer[row][col] = 0;
        return true;
      }
      return false;
    };

    // Helper to create a room
    const createRoom = (row, col, size) => {
      const roomSize = Math.floor(Math.random() * (size - 1)) + size;
      const startRow = Math.max(1, row - Math.floor(roomSize / 2));
      const startCol = Math.max(1, col - Math.floor(roomSize / 2));
      const endRow = Math.min(mapSize - 2, row + Math.floor(roomSize / 2));
      const endCol = Math.min(mapSize - 2, col + Math.floor(roomSize / 2));
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          setTile(r, c);
        }
      }
    };

    // Initialize starting point
    setTile(currentRow, currentColumn);

    while (maxTunnelsRemaining > 0) {
      // Decide: continue tunnel or create room?
      if (lastDirection.length > 0 && Math.random() < roomChance) {
        createRoom(currentRow, currentColumn, roomSize);
        maxTunnelsRemaining--;
        continue;
      }

      // Choose direction
      let randomDirection;
      if (lastDirection.length > 0 && Math.random() < randomWalkChance) {
        randomDirection = directions[Math.floor(Math.random() * directions.length)];
      } else if (lastDirection.length > 0 && Math.random() < continueDirectionChance) {
        randomDirection = lastDirection;
      } else {
        do {
          randomDirection = directions[Math.floor(Math.random() * directions.length)];
        } while (lastDirection.length > 0 && 
                 randomDirection[0] === -lastDirection[0] && 
                 randomDirection[1] === -lastDirection[1]);
      }

      // Create tunnel with random length
      const randomLength = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
      let tunnelLength = 0;

      while (tunnelLength < randomLength) {
        // Check bounds
        if (((currentRow <= 1) && (randomDirection[0] === -1)) ||
            ((currentColumn <= 1) && (randomDirection[1] === -1)) ||
            ((currentRow >= mapSize - 2) && (randomDirection[0] === 1)) ||
            ((currentColumn >= mapSize - 2) && (randomDirection[1] === 1))) {
          break;
        }

        // Clear the tile (only if it's a wall and not protected)
        if (setTile(currentRow, currentColumn)) {
          // Create branches occasionally
          if (tunnelLength > 0 && Math.random() < branchChance && maxTunnelsRemaining > 5) {
            let branchDirection = directions[Math.floor(Math.random() * directions.length)];
            if (!(branchDirection[0] === -randomDirection[0] && branchDirection[1] === -randomDirection[1]) &&
                !(branchDirection[0] === randomDirection[0] && branchDirection[1] === randomDirection[1])) {
              let branchRow = currentRow;
              let branchCol = currentColumn;
              let branchLength = Math.floor(Math.random() * 8) + 1;
              
              for (let b = 0; b < branchLength; b++) {
                if (((branchRow <= 1) && (branchDirection[0] === -1)) ||
                    ((branchCol <= 1) && (branchDirection[1] === -1)) ||
                    ((branchRow >= mapSize - 2) && (branchDirection[0] === 1)) ||
                    ((branchCol >= mapSize - 2) && (branchDirection[1] === 1))) {
                  break;
                }
                setTile(branchRow, branchCol);
                branchRow += branchDirection[0];
                branchCol += branchDirection[1];
              }
              maxTunnelsRemaining--;
            }
          }
        }

        // Move forward
        currentRow += randomDirection[0];
        currentColumn += randomDirection[1];
        tunnelLength++;
      }

      if (tunnelLength > 0) {
        lastDirection = randomDirection;
        maxTunnelsRemaining--;
      } else {
        // If we can't move, try a different direction
        let attempts = 0;
        while (attempts < 4) {
          randomDirection = directions[Math.floor(Math.random() * directions.length)];
          if (!((currentRow <= 1 && randomDirection[0] === -1) ||
                (currentColumn <= 1 && randomDirection[1] === -1) ||
                (currentRow >= mapSize - 2 && randomDirection[0] === 1) ||
                (currentColumn >= mapSize - 2 && randomDirection[1] === 1))) {
            lastDirection = randomDirection;
            break;
          }
          attempts++;
        }
        if (attempts >= 4) {
          break; // Stuck, stop generating
        }
      }
    }
  }

  /**
   * Create a stronghold at specified location
   */
  createStronghold(worldData, mapSize, centerX, centerY, mapType) {
    // For dungeon maps, z=-2 maps to worldData[9]
    const layerIndex = mapType === 'dungeons' ? 9 : 1;
    const caveLayer = worldData[layerIndex];
    if (!caveLayer) return;

    // Create a small room (5x5) as starting area
    const radius = 2;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) continue;
        
        if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
          // Walls
          if (caveLayer[y]) {
            caveLayer[y][x] = 1; // Wall
          }
        } else {
          // Floor
          if (caveLayer[y]) {
            caveLayer[y][x] = 0; // Floor
          }
        }
      }
    }
  }

  /**
   * Add lighting to cave areas
   */
  addCaveLighting(caveLayer, mapSize, team1Entrance, team2Entrance) {
    // TODO: Add fire pits and wall torches near starting areas
    // This would require integration with the Item/Entity system
    // For now, this is a placeholder
    console.log('Cave lighting would be added here');
  }

  /**
   * Add assault starting areas (attackers left, defenders right with fortification)
   */
  addAssaultStartingAreas(worldData, mapSize, startingZ, mapType) {
    // Similar to skirmish but with different fortification for defenders
    this.addTeamStartingAreas(worldData, mapSize, startingZ, 'assault', mapType);
    
    // Defenders get a more fortified area (will be enhanced in future)
    // For now, same as skirmish team 2 area
  }

  /**
   * Map z-level to worldData array index for battlegrounds
   * For dungeon maps, z=-2 maps to worldData[9] (cellar layer)
   * @param {number} startingZ - Z-level
   * @param {string} mapType - Map type
   * @returns {number} Array index in worldData
   */
  getLayerIndex(startingZ, mapType) {
    if (mapType === 'dungeons' && startingZ === -2) {
      // For dungeon maps, z=-2 (cellar) is stored at index 9
      return 9;
    }
    // Standard mapping: z=0 -> 0, z=-1 -> 1
    return startingZ === 0 ? 0 : 1;
  }

  /**
   * Deep copy world data to avoid modifying original
   */
  deepCopyWorldData(worldData) {
    const copy = [];
    for (let layer = 0; layer < worldData.length; layer++) {
      if (!worldData[layer]) {
        copy[layer] = null;
        continue;
      }
      copy[layer] = [];
      for (let y = 0; y < worldData[layer].length; y++) {
        if (!worldData[layer][y]) {
          copy[layer][y] = null;
          continue;
        }
        copy[layer][y] = [...worldData[layer][y]];
      }
    }
    return copy;
  }

  /**
   * Check if a tile is walkable
   */
  isWalkable(tile, startingZ) {
    if (startingZ === 0) {
      return tile !== this.TERRAIN.WATER && tile !== this.TERRAIN.MOUNTAIN && tile < 6;
    } else if (startingZ === -1 || startingZ === -2) {
      // Caves (z=-1) and dungeons (z=-2) both use 0 for floor, 2 for exit
      return tile === 0 || tile === 2;
    }
    return false;
  }

  /**
   * Get spawn points from dungeon building cellars
   * @param {Array} buildings - Array of building objects
   * @param {string} gameMode - 'deathmatch' or 'skirmish'
   * @param {Array} participants - Array of participant objects
   * @returns {Array} Spawn points with z=-2
   */
  getDungeonSpawnPoints(buildings, gameMode, participants) {
    const tileSize = global.tileSize || 64;
    const spawnPoints = [];

    if (gameMode === 'deathmatch') {
      // Deathmatch: Distribute players across all building cellars
      const allCellarTiles = [];
      for (const building of buildings) {
        if (building.cellarPlot) {
          allCellarTiles.push(...building.cellarPlot);
        }
      }

      // Shuffle and assign to participants
      const shuffled = [...allCellarTiles].sort(() => Math.random() - 0.5);
      for (let i = 0; i < participants.length && i < shuffled.length; i++) {
        const [x, y] = shuffled[i];
        spawnPoints.push({
          x: x * tileSize + tileSize / 2,
          y: y * tileSize + tileSize / 2,
          z: -2
        });
      }
    } else if (gameMode === 'skirmish') {
      // Skirmish: Team 1 on first stronghold, Team 2 on second stronghold
      const strongholds = buildings.filter(b => b.type === 'stronghold');
      if (strongholds.length >= 2) {
        // Team 1 spawns on first stronghold cellar
        const team1Stronghold = strongholds[0];
        if (team1Stronghold.cellarPlot && team1Stronghold.cellarPlot.length > 0) {
          const team1Tiles = [...team1Stronghold.cellarPlot].sort(() => Math.random() - 0.5);
          const team1Participants = participants.filter(p => p.team === 'team1' || !p.team);
          for (let i = 0; i < team1Participants.length && i < team1Tiles.length; i++) {
            const [x, y] = team1Tiles[i];
            spawnPoints.push({
              x: x * tileSize + tileSize / 2,
              y: y * tileSize + tileSize / 2,
              z: -2,
              team: 'team1'
            });
          }
        }

        // Team 2 spawns on second stronghold cellar
        const team2Stronghold = strongholds[1];
        if (team2Stronghold.cellarPlot && team2Stronghold.cellarPlot.length > 0) {
          const team2Tiles = [...team2Stronghold.cellarPlot].sort(() => Math.random() - 0.5);
          const team2Participants = participants.filter(p => p.team === 'team2');
          for (let i = 0; i < team2Participants.length && i < team2Tiles.length; i++) {
            const [x, y] = team2Tiles[i];
            spawnPoints.push({
              x: x * tileSize + tileSize / 2,
              y: y * tileSize + tileSize / 2,
              z: -2,
              team: 'team2'
            });
          }
        }
      }
    }

    return spawnPoints;
  }

  /**
   * Calculate spawn points for Deathmatch mode
   * Divides map into sections based on participant count, finds one walkable tile per section
   */
  calculateDeathmatchSpawnPoints(worldData, mapData, participantCount) {
    const { mapSize, startingZ, mapType } = mapData;
    
    // For dungeon maps, use building cellars if available
    if (mapType === 'dungeons' && mapData.dungeonBuildings) {
      // This will be called with match object in postProcessMap, but we don't have participants here
      // So we'll fall back to regular calculation for now
      // In practice, spawn points should be calculated after buildings are placed
    }
    
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];
    if (!layer) return [];

    const tileSize = global.tileSize || 64;
    const spawnPoints = [];

    // Calculate grid dimensions to divide map into sections
    const gridCols = Math.ceil(Math.sqrt(participantCount));
    const gridRows = Math.ceil(participantCount / gridCols);
    const sectionWidth = mapSize / gridCols;
    const sectionHeight = mapSize / gridRows;

    for (let i = 0; i < participantCount; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      
      // Calculate section bounds
      const minX = Math.floor(col * sectionWidth);
      const maxX = Math.floor((col + 1) * sectionWidth);
      const minY = Math.floor(row * sectionHeight);
      const maxY = Math.floor((row + 1) * sectionHeight);

      // Find a walkable tile in this section
      let found = false;
      for (let attempts = 0; attempts < 50 && !found; attempts++) {
        const x = minX + Math.floor(Math.random() * (maxX - minX));
        const y = minY + Math.floor(Math.random() * (maxY - minY));
        
        if (x >= 0 && x < mapSize && y >= 0 && y < mapSize && layer[y] && layer[y][x] !== undefined) {
          const tile = layer[y][x];
          if (this.isWalkable(tile, startingZ)) {
            const centerX = x * tileSize + tileSize / 2;
            const centerY = y * tileSize + tileSize / 2;
            spawnPoints.push({
              x: centerX,
              y: centerY,
              z: startingZ
            });
            found = true;
          }
        }
      }

      // If no walkable tile found in section, try nearby tiles
      if (!found) {
        const centerX = Math.floor((minX + maxX) / 2);
        const centerY = Math.floor((minY + maxY) / 2);
        const offsets = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
        for (const [dx, dy] of offsets) {
          const x = centerX + dx;
          const y = centerY + dy;
          if (x >= 0 && x < mapSize && y >= 0 && y < mapSize && layer[y] && layer[y][x] !== undefined) {
            const tile = layer[y][x];
            if (this.isWalkable(tile, startingZ)) {
              const centerXCoord = x * tileSize + tileSize / 2;
              const centerYCoord = y * tileSize + tileSize / 2;
              spawnPoints.push({
                x: centerXCoord,
                y: centerYCoord,
                z: startingZ
              });
              found = true;
              break;
            }
          }
        }
      }
    }

    return spawnPoints;
  }

  /**
   * Calculate spawn points for Skirmish mode
   * Two starting areas on diagonal quadrants, each area must be mostly walkable
   * For dungeon maps, uses building stronghold cellars
   */
  calculateSkirmishSpawnPoints(worldData, mapData) {
    const { mapSize, startingZ, mapType } = mapData;
    
    // For dungeon maps, use building stronghold cellars if available
    if (mapType === 'dungeons' && mapData.dungeonBuildings) {
      const strongholds = mapData.dungeonBuildings.filter(b => b.type === 'stronghold');
      if (strongholds.length >= 2) {
        const tileSize = global.tileSize || 64;
        const spawnPoints = [];
        
        // Team 1 on first stronghold cellar
        const team1Stronghold = strongholds[0];
        if (team1Stronghold.cellarPlot && team1Stronghold.cellarPlot.length > 0) {
          const team1Tiles = [...team1Stronghold.cellarPlot].sort(() => Math.random() - 0.5);
          // Generate multiple spawn points from cellar plot
          const numSpawns = Math.min(5, team1Tiles.length);
          for (let i = 0; i < numSpawns; i++) {
            const [x, y] = team1Tiles[i];
            spawnPoints.push({
              team: 'team1',
              x: x * tileSize + tileSize / 2,
              y: y * tileSize + tileSize / 2,
              z: -2
            });
          }
        }
        
        // Team 2 on second stronghold cellar
        const team2Stronghold = strongholds[1];
        if (team2Stronghold.cellarPlot && team2Stronghold.cellarPlot.length > 0) {
          const team2Tiles = [...team2Stronghold.cellarPlot].sort(() => Math.random() - 0.5);
          const numSpawns = Math.min(5, team2Tiles.length);
          for (let i = 0; i < numSpawns; i++) {
            const [x, y] = team2Tiles[i];
            spawnPoints.push({
              team: 'team2',
              x: x * tileSize + tileSize / 2,
              y: y * tileSize + tileSize / 2,
              z: -2
            });
          }
        }
        
        return spawnPoints;
      }
    }
    
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];
    if (!layer) return [];

    const tileSize = global.tileSize || 64;
    const spawnPoints = [];

    // Divide map into 4 quadrants
    const quadrantSize = mapSize / 2;
    const quadrants = [
      { name: 'top-left', minX: 0, maxX: quadrantSize, minY: 0, maxY: quadrantSize },
      { name: 'top-right', minX: quadrantSize, maxX: mapSize, minY: 0, maxY: quadrantSize },
      { name: 'bottom-left', minX: 0, maxX: quadrantSize, minY: quadrantSize, maxY: mapSize },
      { name: 'bottom-right', minX: quadrantSize, maxX: mapSize, minY: quadrantSize, maxY: mapSize }
    ];

    // Choose diagonal quadrants (e.g., top-right and bottom-left)
    const diagonalPairs = [
      [quadrants[1], quadrants[2]], // top-right, bottom-left
      [quadrants[0], quadrants[3]]  // top-left, bottom-right
    ];
    const selectedPair = diagonalPairs[Math.floor(Math.random() * diagonalPairs.length)];
    const team1Quadrant = selectedPair[0];
    const team2Quadrant = selectedPair[1];

    // Find walkable area for Team 1
    const team1Area = this.findWalkableArea(layer, mapSize, startingZ, team1Quadrant, 5);
    if (team1Area && team1Area.points.length > 0) {
      spawnPoints.push({
        team: 'team1',
        center: team1Area.center,
        points: team1Area.points,
        area: team1Area
      });
    }

    // Find walkable area for Team 2
    const team2Area = this.findWalkableArea(layer, mapSize, startingZ, team2Quadrant, 5);
    if (team2Area && team2Area.points.length > 0) {
      spawnPoints.push({
        team: 'team2',
        center: team2Area.center,
        points: team2Area.points,
        area: team2Area
      });
    }

    return spawnPoints;
  }

  /**
   * Calculate spawn points for Assault mode
   * Defender: stronghold placement (prefer mountain tiles), Attacker: opposite quadrant
   */
  calculateAssaultSpawnPoints(worldData, mapData) {
    const { mapSize, startingZ, mapType } = mapData;
    const layerIndex = this.getLayerIndex(startingZ, mapType);
    const layer = worldData[layerIndex];
    if (!layer) return [];

    const tileSize = global.tileSize || 64;
    const spawnPoints = [];

    // Step 1: Place defender stronghold (prefer majority mountain tiles)
    const defenderStronghold = this.findStrongholdLocation(layer, mapSize, startingZ);
    if (defenderStronghold) {
      spawnPoints.push({
        team: 'team2',
        center: defenderStronghold.center,
        points: defenderStronghold.points,
        area: defenderStronghold,
        stronghold: true
      });
    }

    // Step 2: Find attacker spawn area in opposite quadrant
    if (defenderStronghold) {
      const defenderQuadrant = this.getQuadrant(defenderStronghold.center.x / tileSize, defenderStronghold.center.y / tileSize, mapSize);
      const attackerQuadrant = this.getOppositeQuadrant(defenderQuadrant, mapSize);
      
      const attackerArea = this.findWalkableArea(layer, mapSize, startingZ, attackerQuadrant, 5);
      if (attackerArea && attackerArea.points.length > 0) {
        spawnPoints.push({
          team: 'team1',
          center: attackerArea.center,
          points: attackerArea.points,
          area: attackerArea
        });
      }
    }

    return spawnPoints;
  }

  /**
   * Find a walkable area within a quadrant
   * Returns area with center point and multiple spawn points
   */
  findWalkableArea(layer, mapSize, startingZ, quadrant, minPoints) {
    const tileSize = global.tileSize || 64;
    const areaRadius = 3; // 3 tile radius for spawn area
    const walkableTiles = [];

    // Scan quadrant for walkable tiles
    for (let y = quadrant.minY; y < quadrant.maxY; y++) {
      for (let x = quadrant.minX; x < quadrant.maxX; x++) {
        if (x >= 0 && x < mapSize && y >= 0 && y < mapSize && layer[y] && layer[y][x] !== undefined) {
          const tile = layer[y][x];
          if (this.isWalkable(tile, startingZ)) {
            walkableTiles.push({ x, y, tile });
          }
        }
      }
    }

    if (walkableTiles.length < minPoints) {
      return null; // Not enough walkable tiles
    }

    // Find a cluster of walkable tiles (area with at least minPoints walkable tiles)
    for (let attempts = 0; attempts < 20; attempts++) {
      const centerTile = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
      const nearbyWalkable = [];

      for (let dy = -areaRadius; dy <= areaRadius; dy++) {
        for (let dx = -areaRadius; dx <= areaRadius; dx++) {
          const checkX = centerTile.x + dx;
          const checkY = centerTile.y + dy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist <= areaRadius && checkX >= 0 && checkX < mapSize && checkY >= 0 && checkY < mapSize) {
            if (layer[checkY] && layer[checkY][checkX] !== undefined) {
              const tile = layer[checkY][checkX];
              if (this.isWalkable(tile, startingZ)) {
                nearbyWalkable.push({ x: checkX, y: checkY });
              }
            }
          }
        }
      }

      if (nearbyWalkable.length >= minPoints) {
        // Found a good area, generate spawn points
        const spawnPoints = [];
        const usedIndices = new Set();
        const pointsToGenerate = Math.min(minPoints, nearbyWalkable.length);
        
        for (let i = 0; i < pointsToGenerate; i++) {
          let idx;
          do {
            idx = Math.floor(Math.random() * nearbyWalkable.length);
          } while (usedIndices.has(idx) && usedIndices.size < nearbyWalkable.length);
          usedIndices.add(idx);
          
          const point = nearbyWalkable[idx];
          spawnPoints.push({
            x: point.x * tileSize + tileSize / 2,
            y: point.y * tileSize + tileSize / 2,
            z: startingZ
          });
        }

        return {
          center: {
            x: centerTile.x * tileSize + tileSize / 2,
            y: centerTile.y * tileSize + tileSize / 2,
            z: startingZ
          },
          points: spawnPoints
        };
      }
    }

    return null;
  }

  /**
   * Find location for defender stronghold (prefer majority mountain tiles)
   */
  findStrongholdLocation(layer, mapSize, startingZ) {
    const tileSize = global.tileSize || 64;
    const strongholdSize = 5; // 5x5 area for stronghold
    const candidates = [];

    // First pass: look for areas with majority mountain tiles
    for (let y = 0; y < mapSize - strongholdSize; y += 5) {
      for (let x = 0; x < mapSize - strongholdSize; x += 5) {
        let mountainCount = 0;
        let walkableCount = 0;
        
        for (let dy = 0; dy < strongholdSize; dy++) {
          for (let dx = 0; dx < strongholdSize; dx++) {
            const checkX = x + dx;
            const checkY = y + dy;
            if (checkX < mapSize && checkY < mapSize && layer[checkY] && layer[checkY][checkX] !== undefined) {
              const tile = layer[checkY][checkX];
              if (tile === this.TERRAIN.MOUNTAIN) {
                mountainCount++;
              }
              if (this.isWalkable(tile, startingZ) || tile === this.TERRAIN.MOUNTAIN) {
                walkableCount++;
              }
            }
          }
        }

        // Prefer areas with at least 40% mountain tiles and mostly walkable
        if (mountainCount >= (strongholdSize * strongholdSize * 0.4) && walkableCount >= (strongholdSize * strongholdSize * 0.6)) {
          candidates.push({ x, y, mountainCount, score: mountainCount + walkableCount });
        }
      }
    }

    // If no mountain areas found, look for any walkable area
    if (candidates.length === 0) {
      for (let y = 0; y < mapSize - strongholdSize; y += 5) {
        for (let x = 0; x < mapSize - strongholdSize; x += 5) {
          let walkableCount = 0;
          for (let dy = 0; dy < strongholdSize; dy++) {
            for (let dx = 0; dx < strongholdSize; dx++) {
              const checkX = x + dx;
              const checkY = y + dy;
              if (checkX < mapSize && checkY < mapSize && layer[checkY] && layer[checkY][checkX] !== undefined) {
                const tile = layer[checkY][checkX];
                if (this.isWalkable(tile, startingZ)) {
                  walkableCount++;
                }
              }
            }
          }
          if (walkableCount >= (strongholdSize * strongholdSize * 0.6)) {
            candidates.push({ x, y, mountainCount: 0, score: walkableCount });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Sort by score and pick best
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    // Generate spawn points within stronghold area
    const spawnPoints = [];
    for (let i = 0; i < 5; i++) {
      const dx = Math.floor(Math.random() * strongholdSize);
      const dy = Math.floor(Math.random() * strongholdSize);
      const x = best.x + dx;
      const y = best.y + dy;
      if (x < mapSize && y < mapSize && layer[y] && layer[y][x] !== undefined) {
        const tile = layer[y][x];
        if (this.isWalkable(tile, startingZ) || tile === this.TERRAIN.MOUNTAIN) {
          spawnPoints.push({
            x: x * tileSize + tileSize / 2,
            y: y * tileSize + tileSize / 2,
            z: startingZ
          });
        }
      }
    }

    return {
      center: {
        x: (best.x + strongholdSize / 2) * tileSize,
        y: (best.y + strongholdSize / 2) * tileSize,
        z: startingZ
      },
      points: spawnPoints.length > 0 ? spawnPoints : [{
        x: (best.x + strongholdSize / 2) * tileSize,
        y: (best.y + strongholdSize / 2) * tileSize,
        z: startingZ
      }]
    };
  }

  /**
   * Get quadrant for a given coordinate
   */
  getQuadrant(x, y, mapSize) {
    const halfSize = mapSize / 2;
    if (x < halfSize && y < halfSize) return { name: 'top-left', minX: 0, maxX: halfSize, minY: 0, maxY: halfSize };
    if (x >= halfSize && y < halfSize) return { name: 'top-right', minX: halfSize, maxX: mapSize, minY: 0, maxY: halfSize };
    if (x < halfSize && y >= halfSize) return { name: 'bottom-left', minX: 0, maxX: halfSize, minY: halfSize, maxY: mapSize };
    return { name: 'bottom-right', minX: halfSize, maxX: mapSize, minY: halfSize, maxY: mapSize };
  }

  /**
   * Get opposite quadrant
   */
  getOppositeQuadrant(quadrant, mapSize) {
    const halfSize = mapSize / 2;
    if (quadrant.name === 'top-left') return { name: 'bottom-right', minX: halfSize, maxX: mapSize, minY: halfSize, maxY: mapSize };
    if (quadrant.name === 'top-right') return { name: 'bottom-left', minX: 0, maxX: halfSize, minY: halfSize, maxY: mapSize };
    if (quadrant.name === 'bottom-left') return { name: 'top-right', minX: halfSize, maxX: mapSize, minY: 0, maxY: halfSize };
    return { name: 'top-left', minX: 0, maxX: halfSize, minY: 0, maxY: halfSize };
  }
}

module.exports = BattlegroundsMapPostProcessor;

