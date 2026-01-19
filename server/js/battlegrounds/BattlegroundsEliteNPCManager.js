/**
 * BattlegroundsEliteNPCManager - Handles elite NPC spawning and AI behavior
 */

class BattlegroundsEliteNPCManager {
  constructor() {
    this.eliteNPCTypes = [
      'OATHKEEPER', 'HIGHPRIESTESS', 'CATAPHRACT', 'SEIDR', 'HUSKARL',
      'CAROLINGIAN', 'CHARLEMAGNE', 'HEADHUNTER', 'DRUID', 'MORRIGAN',
      'GWENLLIAN', 'TEUTONIC KNIGHT', 'ARCHBISHOP', 'HOCHMEISTER',
      'POACHER', 'MARAUDER', 'CONDOTTIERE', 'IMPERIAL KNIGHT'
    ];
    
    this.spawnedNPCs = []; // Track spawned NPCs for cleanup
    this.plannedNPCs = []; // Track planned NPCs (before spawning)
  }

  /**
   * Plan elite NPCs before spawning (draft system - no duplicates)
   * @param {object} match - Match object
   * @returns {Array} Array of planned NPC info objects (not yet spawned)
   */
  planEliteNPCs(match) {
    if (!match) return [];
    
    const { gameMode, participants } = match;
    const plannedNPCs = [];
    const usedTypes = new Set(); // Track used NPC types (draft system)
    
    // Get current team counts (excluding NPCs that haven't been planned yet)
    let team1Count = participants.filter(p => p.team === 'team1' && !p.isNPC).length;
    let team2Count = participants.filter(p => p.team === 'team2' && !p.isNPC).length;
    
    if (gameMode === 'deathmatch') {
      // Deathmatch: add NPCs until minimum 4 participants
      const needed = Math.max(0, 4 - participants.filter(p => !p.isNPC).length);
      for (let i = 0; i < needed; i++) {
        const npcInfo = this.generateNPCInfo(match, null, i, usedTypes);
        if (npcInfo) {
          plannedNPCs.push(npcInfo);
          usedTypes.add(npcInfo.type);
        }
      }
    } else if (gameMode === 'skirmish') {
      // Skirmish: ensure minimum 6 total players (3 per team minimum)
      // Strategy: Balance iteratively, ensuring minimums are met
      // First, ensure both teams have at least 1 player (if one team is empty, add NPC to it)
      if (team1Count === 0 && team2Count > 0) {
        const npcInfo = this.generateNPCInfo(match, 'team1', plannedNPCs.length, usedTypes);
        if (npcInfo) {
          plannedNPCs.push(npcInfo);
          usedTypes.add(npcInfo.type);
          team1Count++;
        }
      }
      if (team2Count === 0 && team1Count > 0) {
        const npcInfo = this.generateNPCInfo(match, 'team2', plannedNPCs.length, usedTypes);
        if (npcInfo) {
          plannedNPCs.push(npcInfo);
          usedTypes.add(npcInfo.type);
          team2Count++;
        }
      }
      
      // Then balance iteratively: always add to smaller team
      // Continue until both teams have at least 3 players AND are balanced
      while (team1Count < 3 || team2Count < 3 || Math.abs(team1Count - team2Count) > 0) {
        // Determine which team needs NPCs (smaller team, or team below minimum)
        let npcTeam;
        if (team1Count < 3 && team2Count < 3) {
          // Both below minimum - add to smaller team
          npcTeam = team1Count < team2Count ? 'team1' : 'team2';
        } else if (team1Count < 3) {
          npcTeam = 'team1';
        } else if (team2Count < 3) {
          npcTeam = 'team2';
        } else {
          // Both at minimum, balance by adding to smaller team
          npcTeam = team1Count < team2Count ? 'team1' : 'team2';
        }
        
        const npcInfo = this.generateNPCInfo(match, npcTeam, plannedNPCs.length, usedTypes);
        if (npcInfo) {
          plannedNPCs.push(npcInfo);
          usedTypes.add(npcInfo.type);
          if (npcTeam === 'team1') {
            team1Count++;
          } else {
            team2Count++;
          }
        } else {
          // Failed to generate NPC, break to avoid infinite loop
          console.warn('Failed to plan NPC for team balancing, stopping');
          break;
        }
      }
    } else if (gameMode === 'assault') {
      // Assault: always ensure exactly 5 vs 5 (10 total players)
      const totalHumanPlayers = participants.filter(p => !p.isNPC).length;
      const targetTotal = 10;
      const needed = Math.max(0, targetTotal - totalHumanPlayers);
      
      // Add NPCs to smaller team until both teams have 5 players
      while (team1Count < 5 || team2Count < 5) {
        // Determine which team needs NPCs
        let npcTeam;
        if (team1Count < 5 && team2Count < 5) {
          // Both teams need NPCs, add to smaller team
          npcTeam = team1Count < team2Count ? 'team1' : 'team2';
        } else if (team1Count < 5) {
          npcTeam = 'team1';
        } else {
          npcTeam = 'team2';
        }
        
        const npcInfo = this.generateNPCInfo(match, npcTeam, plannedNPCs.length, usedTypes);
        if (npcInfo) {
          plannedNPCs.push(npcInfo);
          usedTypes.add(npcInfo.type);
          if (npcTeam === 'team1') {
            team1Count++;
          } else {
            team2Count++;
          }
        } else {
          // Failed to generate NPC, break to avoid infinite loop
          console.warn('Failed to plan NPC for Assault mode, stopping');
          break;
        }
      }
    }
    
    this.plannedNPCs = plannedNPCs;
    return plannedNPCs;
  }

  /**
   * Generate NPC info without spawning (for planning phase)
   * @param {object} match - Match object
   * @param {string} team - Team assignment ('team1', 'team2', or null for deathmatch)
   * @param {number} index - Index for ID generation
   * @param {Set} usedTypes - Set of already used NPC types (draft system)
   * @returns {Object} NPC info object or null if failed
   */
  generateNPCInfo(match, team, index, usedTypes) {
    // Select NPC type from available types (draft system - no duplicates)
    const availableTypes = this.eliteNPCTypes.filter(type => !usedTypes.has(type));
    
    let npcType;
    if (availableTypes.length === 0) {
      // All types used, log warning but allow reuse (shouldn't happen with current limits)
      console.warn(`All elite NPC types have been used in match ${match.matchId}, reusing types`);
      npcType = this.eliteNPCTypes[index % this.eliteNPCTypes.length];
    } else {
      npcType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }
    
    // Map elite NPC type names to actual NPC class names
    const npcClass = this.mapNPCTypeToClass(npcType);
    
    // Validate NPC class exists
    if (!global[npcClass] || typeof global[npcClass] !== 'function') {
      console.error(`NPC class '${npcClass}' (mapped from '${npcType}') not found. Skipping NPC planning.`);
      return null;
    }
    
    // Generate ID for planning (will be used when spawning)
    const npcId = 'bg_npc_' + match.matchId + '_' + index + '_' + Math.random().toString(36).substr(2, 9);
    
    // Format display name
    let displayName = npcType.charAt(0).toUpperCase() + npcType.slice(1).toLowerCase().replace(/_/g, ' ');
    
    // Try to determine sex from NPC class/type (some NPCs have gender)
    // Default to 'm' if not determinable
    let sex = 'm';
    const femaleNPCs = ['HIGHPRIESTESS', 'SEIDR', 'MORRIGAN', 'GWENLLIAN'];
    if (femaleNPCs.includes(npcType)) {
      sex = 'f';
    }
    
    const npcInfo = {
      id: npcId,
      type: npcType,
      class: npcClass,
      name: displayName,
      sex: sex,
      team: team,
      isNPC: true,
      matchId: match.matchId
    };
    
    return npcInfo;
  }

  /**
   * Spawn elite NPCs to balance teams (uses pre-planned NPCs if available)
   * @param {object} match - Match object
   * @param {Array} plannedNPCs - Optional array of pre-planned NPCs
   * @returns {Array} Array of spawned NPC info objects
   */
  spawnEliteNPCs(match, plannedNPCs = null) {
    // #region agent log
    // #endregion
    
    if (!match) return [];
    
    // Use planned NPCs if provided, otherwise plan them now
    const npcsToSpawn = plannedNPCs || this.plannedNPCs || [];
    const spawnedNPCs = [];
    
    // Spawn each planned NPC
    for (let i = 0; i < npcsToSpawn.length; i++) {
      const plannedNPC = npcsToSpawn[i];
      const npc = this.spawnEliteNPC(match, plannedNPC.team, i, plannedNPC);
      if (npc) {
        spawnedNPCs.push(npc);
      }
    }
    
    // #region agent log
    // #endregion
    
    this.spawnedNPCs.push(...spawnedNPCs);
    // Clear planned NPCs after spawning
    this.plannedNPCs = [];
    return spawnedNPCs;
  }

  /**
   * Calculate how many NPCs are needed
   */
  calculateNPCCount(match) {
    const { gameMode, participants } = match;
    
    if (gameMode === 'deathmatch') {
      return Math.max(0, 4 - participants.length);
    } else {
      const team1Count = participants.filter(p => p.team === 'team1').length;
      const team2Count = participants.filter(p => p.team === 'team2').length;
      return Math.abs(team1Count - team2Count);
    }
  }

  /**
   * Spawn a single elite NPC
   * @param {object} match - Match object
   * @param {string} team - Team assignment
   * @param {number} index - Index for spawn point
   * @param {object} plannedNPC - Optional pre-planned NPC info (for draft system)
   */
  spawnEliteNPC(match, team, index, plannedNPC = null) {
    // #region agent log
    // #endregion
    
    // Use planned NPC info if provided (draft system), otherwise select randomly
    let npcType, npcClass, displayName, sex;
    if (plannedNPC) {
      npcType = plannedNPC.type;
      npcClass = plannedNPC.class;
      displayName = plannedNPC.name;
      sex = plannedNPC.sex;
    } else {
      // Fallback: Select NPC type (only one of each type per match)
    const usedTypes = this.spawnedNPCs.map(npc => npc.type || npc.class);
    const availableTypes = this.eliteNPCTypes.filter(type => !usedTypes.includes(type));
    
    if (availableTypes.length === 0) {
      // All types used, reuse types
      npcType = this.eliteNPCTypes[index % this.eliteNPCTypes.length];
    } else {
      npcType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }
      
      // Map elite NPC type names to actual NPC class names
      npcClass = this.mapNPCTypeToClass(npcType);
      displayName = npcType.charAt(0).toUpperCase() + npcType.slice(1).toLowerCase().replace(/_/g, ' ');
      sex = 'm'; // Default
      const femaleNPCs = ['HIGHPRIESTESS', 'SEIDR', 'MORRIGAN', 'GWENLLIAN'];
      if (femaleNPCs.includes(npcType)) {
        sex = 'f';
      }
    }
    
    // Get spawn position
    const spawnPoint = this.getNPCSpawnPoint(match, team, index);
    
    // #region agent log
    // #endregion
    
    // #region agent log
    // #endregion
    
    // Validate NPC class exists before creating
    if (!global[npcClass] || typeof global[npcClass] !== 'function') {
      console.error(`NPC class '${npcClass}' (mapped from '${npcType}') not found. Skipping NPC spawn.`);
      // #region agent log
      // #endregion
      return null;
    }
    
    // Validate spawn point is walkable using battleground map context
    const tileSize = global.tileSize || 64;
    const tileCol = Math.floor(spawnPoint.x / tileSize);
    const tileRow = Math.floor(spawnPoint.y / tileSize);
    const startingZ = spawnPoint.z || match.mapData.startingZ || 0;
    
    // Check if spawn point is walkable using context-aware getTile for battleground
    // Create a temporary NPC entity ID to use for context lookup
    const tempEntityId = 'temp_npc_' + match.matchId;
    
    // Register temporary context so getTile knows to use battleground map
    // Check if battleground map is registered
    const bgMapRegistered = global.mapContextManager && 
      global.mapContextManager.battlegroundMaps && 
      global.mapContextManager.battlegroundMaps[match.matchId];
    
    if (bgMapRegistered) {
      // Prefer match.mapData.worldData for battleground walkability
      const TERRAIN = global.TERRAIN || {};
      const getWorldTile = (z, col, row) => {
        if (!match.mapData || !match.mapData.worldData) return null;
        const mapType = match.mapData.mapType;
        let layerIndex = 0;
        if (mapType === 'dungeons' && z === -2) {
          layerIndex = 9;
        } else if (z === -1) {
          layerIndex = 1;
        } else if (z === -3) {
          layerIndex = 2;
        } else {
          layerIndex = 0;
        }
        const layer = match.mapData.worldData[layerIndex];
        if (!layer || !layer[row]) return null;
        return layer[row][col];
      };
      const getTile = global.getTile || (() => null);
      
      // Helper function to check if tile is walkable in battleground context
      const isWalkableInBG = (z, col, row) => {
        // Use battleground worldData when available, otherwise fall back to global getTile
        let tile = getWorldTile(z, col, row);
        if (tile === null || tile === undefined) {
          tile = getTile(z, col, row, tempEntityId, match.matchId);
        }
        if (tile === null || tile === undefined) return false;

        if (z === 0) {
          if (tile === TERRAIN.WATER || tile === TERRAIN.MOUNTAIN) return false;
          if (typeof tile === 'number' && tile >= 6) return false;
        } else if (z === -1 || z === -2) {
          if (tile !== 0 && tile !== 2) return false;
        }
        
        // For z=0, check if we can get pathfinding matrix from battleground
        // If pathfinding grid exists, use it to check walkability
        if (global.battlegroundsPathfindingManager && z === startingZ) {
          const pathfindingGrid = global.battlegroundsPathfindingManager.getGrid(match.matchId, z);
          if (pathfindingGrid && pathfindingGrid.grid && pathfindingGrid.grid.length > row && pathfindingGrid.grid[row].length > col) {
            return pathfindingGrid.grid[row][col] !== 0; // 0 = not walkable in pathfinding grid
          }
        }
        
        // Fallback: assume non-water tiles are walkable
        return tile !== 0;
      };
      
      if (!isWalkableInBG(startingZ, tileCol, tileRow)) {
        // Try to find nearby walkable tile (check in expanding radius)
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1],
                         [-2, 0], [2, 0], [0, -2], [0, 2], [-2, -1], [2, -1], [-1, -2], [1, -2],
                         [-2, -2], [2, 2], [-2, 2], [2, -2]];
        let found = false;
        for (const [dx, dy] of offsets) {
          const checkCol = tileCol + dx;
          const checkRow = tileRow + dy;
          // Check bounds
          const mapSize = match.mapSize || 64;
          if (checkCol >= 0 && checkCol < mapSize && checkRow >= 0 && checkRow < mapSize) {
            if (isWalkableInBG(startingZ, checkCol, checkRow)) {
              spawnPoint.x = checkCol * tileSize + tileSize / 2;
              spawnPoint.y = checkRow * tileSize + tileSize / 2;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          console.warn(`No walkable tile found near spawn point for NPC ${npcType} at [${tileCol}, ${tileRow}] in match ${match.matchId}`);
          // Don't fail completely - spawn anyway at the calculated position
          // The game will handle if the position is invalid
        }
      }
    } else {
      console.warn(`Battleground map ${match.matchId} not registered in MapContextManager, skipping walkability check for NPC spawn`);
    }
    
    // Determine house assignment
    let houseId = null;
    if (team) {
      if (match.teams && match.teams[team] && match.teams[team].houseId) {
        houseId = match.teams[team].houseId;
      }
    } else if (match.gameMode === 'deathmatch') {
      // Deathmatch: each participant (including NPCs) should have a temporary house
      const npcTeamEntry = (match.teams && plannedNPC && match.teams[plannedNPC.id])
        ? match.teams[plannedNPC.id]
        : null;
      if (npcTeamEntry && npcTeamEntry.houseId !== undefined) {
        houseId = npcTeamEntry.houseId;
      }
    }
    
    // Use planned NPC ID if available, otherwise generate new one
    const npcId = plannedNPC ? plannedNPC.id : ('bg_npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));
    const homeLoc = [Math.floor(spawnPoint.x / tileSize), Math.floor(spawnPoint.y / tileSize)];
    
    // Create NPC using the validated class constructor
    let npc = null;
    try {
      // Use planned NPC name if available, otherwise use npcType
      const npcName = plannedNPC ? plannedNPC.name : npcType;
      
      const npcParams = {
        id: npcId,
        name: npcName,
        x: spawnPoint.x,
        y: spawnPoint.y,
        z: spawnPoint.z,
        house: houseId,
        type: 'npc',
        class: npcClass, // Ensure class is set on entity
        sex: sex, // Ensure sex is set on entity
        battlegroundMatchId: match.matchId,
        inBattleground: true,
        home: {
          z: spawnPoint.z,
          loc: homeLoc
        },
        wanderRange: tileSize * 10
      };
      
      npc = global[npcClass](npcParams);
      
      // CRITICAL: Force-set class, sex, and name on the entity (constructors may override)
      if (npc) {
        // Force set these properties - don't check if they exist, just overwrite
        // Do this AFTER constructor to ensure it's not overridden
        npc.class = npcClass;
        npc.sex = sex;
        npc.name = displayName;
        
        // CRITICAL: Ensure map context is set on NPC
        if (global.mapContextHelpers) {
          global.mapContextHelpers.setEntityContext(npc, match.matchId);
        } else {
          // Fallback if helpers not available
          npc.inBattleground = true;
          npc.battlegroundMatchId = match.matchId;
        }

        // Set initial mode based on match rules in case behavior updates haven't started yet
        if (match.gameMode === 'assault' && team === 'team2') {
          npc.mode = 'guard';
        } else {
          npc.mode = 'raid';
        }
        
        // CRITICAL: Ensure NPC is marked for updates (needed for movement/combat)
        // Battleground NPCs should always update every frame
        npc.shouldUpdate = true;
      }
      
      // Check if NPC was created even if constructor didn't return it
      const npcFromPlayerList = global.Player && global.Player.list ? global.Player.list[npcId] : null;
      
      // If constructor didn't return NPC but it's in Player.list, use that
      if (!npc && npcFromPlayerList) {
        npc = npcFromPlayerList;
        // CRITICAL: Force-set properties on NPC from Player.list too
        npc.class = npcClass;
        npc.sex = sex;
        npc.name = displayName;
      }
      
      // CRITICAL: Also update the NPC in Player.list if it exists there (defensive check)
      if (npcFromPlayerList && npcFromPlayerList !== npc) {
        npcFromPlayerList.class = npcClass;
        npcFromPlayerList.sex = sex;
        npcFromPlayerList.name = displayName;
      }
    } catch (e) {
      console.error(`Error creating elite NPC ${npcClass}:`, e);
      return null;
    }
    
    if (!npc) {
      console.warn(`Failed to create elite NPC of type ${npcType} (class: ${npcClass})`);
      // #region agent log
      // #endregion
      return null;
    }
    
    // Store NPC info for tracking (include name, class, sex from actual entity)
    // Use planned NPC info if available, otherwise get from spawned entity
    let finalDisplayName = displayName;
    let finalClass = npcClass;
    let finalSex = sex;
    
    if (npc) {
      // CRITICAL: Force-set properties again (in case they were overridden by constructor or update)
      // Don't check if they exist - just force set them to ensure they're correct
      npc.class = npcClass;
      npc.sex = sex;
      npc.name = displayName;
      
      // Update final values from what we just set (not from entity)
      finalDisplayName = displayName;
      finalClass = npcClass;
      finalSex = sex;
      
      // #region agent log
      // #endregion
      
      // #region agent log
      // Hypothesis F: Check if NPC is in Player.list after creation
      const inPlayerList = !!(global.Player && global.Player.list && global.Player.list[npcId]);
      const npcFromList = global.Player && global.Player.list ? global.Player.list[npcId] : null;
      
      // CRITICAL: If NPC is in Player.list, ensure properties are set there too
      if (npcFromList && npcFromList !== npc) {
        npcFromList.class = npcClass;
        npcFromList.sex = sex;
        npcFromList.name = displayName;
      }
      
      // #endregion
    }
    
    const npcInfo = {
      id: npcId,
      type: npcType,
      class: finalClass,
      name: finalDisplayName,
      sex: finalSex,
      team: team,
      house: houseId,
      matchId: match.matchId
    };
    
    return npcInfo;
  }

  /**
   * Map elite NPC type name to actual NPC class name
   * This should match the actual NPC class names in the game
   */
  mapNPCTypeToClass(npcType) {
    // Map elite NPC type names to class names
    // These would need to match actual NPC class definitions
    const typeToClassMap = {
      'OATHKEEPER': 'Oathkeeper',
      'HIGHPRIESTESS': 'HighPriestess',
      'CATAPHRACT': 'Cataphract',
      'SEIDR': 'Seidr',
      'HUSKARL': 'Huskarl',
      'CAROLINGIAN': 'Carolingian', // Carolingian class exists (line 10525 in Entity.js)
      'CHARLEMAGNE': 'Charlemagne',
      'HEADHUNTER': 'Headhunter',
      'DRUID': 'Druid',
      'MORRIGAN': 'Morrigan',
      'GWENLLIAN': 'Gwenllian',
      'TEUTONIC KNIGHT': 'TeutonicKnight',
      'ARCHBISHOP': 'Archbishop',
      'HOCHMEISTER': 'Hochmeister',
      'POACHER': 'Poacher',
      'MARAUDER': 'Marauder',
      'CONDOTTIERE': 'Condottiere',
      'IMPERIAL KNIGHT': 'ImperialKnight'
    };
    
    return typeToClassMap[npcType] || npcType;
  }

  /**
   * Get spawn point for NPC - use spawn points from mapData
   */
  getNPCSpawnPoint(match, team, index) {
    // Use spawn points from mapData (calculated during post-processing)
    const mapSpawnPoints = match.mapData && match.mapData.spawnPoints ? match.mapData.spawnPoints : [];
    
    if (match.gameMode === 'deathmatch' || !team) {
      // Deathmatch: use available spawn points
      if (mapSpawnPoints.length > 0) {
        const spawnPoint = mapSpawnPoints[index % mapSpawnPoints.length];
        if (spawnPoint && spawnPoint.x !== undefined) {
          return {
            x: spawnPoint.x,
            y: spawnPoint.y,
            z: spawnPoint.z
          };
        }
      }
      // Fallback: random spawn
      const mapSize = match.mapSize;
      const tileSize = global.tileSize || 64;
      const mapBounds = mapSize * tileSize;
      return {
        x: Math.random() * mapBounds,
        y: Math.random() * mapBounds,
        z: match.mapData.startingZ || 0
      };
    } else {
      // Team-based modes: use team spawn area
      const teamArea = mapSpawnPoints.find(sp => sp.team === team);
      if (teamArea && teamArea.points && teamArea.points.length > 0) {
        const point = teamArea.points[index % teamArea.points.length];
        if (point) {
          return {
            x: point.x,
            y: point.y,
            z: point.z
          };
        }
      }
      // Fallback: use game mode's getSpawnPoints if available
      if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentGameMode) {
        const gameMode = global.battlegroundsMatchManager.currentGameMode;
        if (gameMode.getSpawnPoints) {
          const allSpawnPoints = gameMode.getSpawnPoints();
          // Find a spawn point for this team (would need participant ID, but we can use index)
          // For now, use fallback
        }
      }
      // Final fallback: simple math
      const mapSize = match.mapSize;
      const tileSize = global.tileSize || 64;
      const mapBounds = mapSize * tileSize;
      if (team === 'team1') {
        return {
          x: (mapBounds / 4) + (index * 100),
          y: mapBounds / 2,
          z: match.mapData.startingZ || 0
        };
      } else {
        return {
          x: (mapBounds * 3 / 4) - (index * 100),
          y: mapBounds / 2,
          z: match.mapData.startingZ || 0
        };
      }
    }
  }

  /**
   * Remove elite NPCs after match
   * @param {Array} npcIds - Array of NPC IDs or NPC info objects
   */
  removeEliteNPCs(npcIds) {
    if (!npcIds || !Array.isArray(npcIds)) return;
    
    npcIds.forEach(npcIdOrInfo => {
      // Handle both ID strings and info objects
      const npcId = typeof npcIdOrInfo === 'string' ? npcIdOrInfo : npcIdOrInfo.id;
      if (!npcId) return;
      
      // Remove NPC from game
      if (global.Player && global.Player.list) {
        const npc = global.Player.list[npcId];
        if (npc) {
          // Mark for removal
          npc.toRemove = true;
          
          // Clear battleground flags
          if (npc.inBattleground !== undefined) {
            npc.inBattleground = false;
          }
          if (npc.battlegroundMatchId !== undefined) {
            delete npc.battlegroundMatchId;
          }
          
          // IMPORTANT: Immediately delete from Player.list to prevent it from appearing in main world
          // The game loop will handle cleanup, but we need to remove it now
          delete global.Player.list[npcId];
        }
      }
      
      // Remove from tracking
      this.spawnedNPCs = this.spawnedNPCs.filter(n => n.id !== npcId);
    });
    
    console.log(`Removed ${npcIds.length} elite NPCs from battleground match`);
  }

  /**
   * Clear all spawned NPCs (for match cleanup)
   */
  clearAll() {
    const npcIds = this.spawnedNPCs.map(n => n.id);
    this.removeEliteNPCs(npcIds);
    this.spawnedNPCs = [];
    this.plannedNPCs = []; // Also clear planned NPCs
  }
}

module.exports = BattlegroundsEliteNPCManager;


