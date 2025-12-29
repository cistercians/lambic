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
  }

  /**
   * Spawn elite NPCs to balance teams
   * @param {object} match - Match object
   * @returns {Array} Array of spawned NPC IDs
   */
  spawnEliteNPCs(match) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:22',message:'spawnEliteNPCs called',data:{matchId:match?.matchId,gameMode:match?.gameMode,participantCount:match?.participants?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    if (!match) return [];
    
    const { gameMode, participants, teams } = match;
    const spawnedNPCs = [];
    
    // Calculate how many NPCs are needed
    const npcCount = this.calculateNPCCount(match);
    
    if (gameMode === 'deathmatch') {
      // Add NPCs until we have at least 4 total participants
      const needed = Math.max(0, 4 - participants.length);
      for (let i = 0; i < needed; i++) {
        const npc = this.spawnEliteNPC(match, null, i);
        if (npc) {
          spawnedNPCs.push(npc);
        }
      }
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Balance teams
      let team1Count = participants.filter(p => p.team === 'team1').length;
      let team2Count = participants.filter(p => p.team === 'team2').length;
      
      // For Skirmish, ensure minimum 1 player per team
      if (gameMode === 'skirmish') {
        if (team1Count === 0) {
          // Spawn NPC for team1
          const npc = this.spawnEliteNPC(match, 'team1', spawnedNPCs.length);
          if (npc) {
            spawnedNPCs.push(npc);
            team1Count++; // Update count after spawning
          }
        }
        if (team2Count === 0) {
          // Spawn NPC for team2
          const npc = this.spawnEliteNPC(match, 'team2', spawnedNPCs.length);
          if (npc) {
            spawnedNPCs.push(npc);
            team2Count++; // Update count after spawning
          }
        }
      }
      
      // Balance teams (spawn NPCs for smaller team until balanced)
      // Keep checking and spawning until teams are balanced
      while (Math.abs(team1Count - team2Count) > 0) {
        const npcTeam = team1Count < team2Count ? 'team1' : 'team2';
        const npc = this.spawnEliteNPC(match, npcTeam, spawnedNPCs.length);
        if (npc) {
          spawnedNPCs.push(npc);
          if (npcTeam === 'team1') {
            team1Count++;
          } else {
            team2Count++;
          }
        } else {
          // Failed to spawn NPC, break to avoid infinite loop
          console.warn('Failed to spawn NPC for team balancing, stopping');
          break;
        }
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:86',message:'spawnEliteNPCs returning',data:{spawnedCount:spawnedNPCs.length,spawnedIds:spawnedNPCs.map(n=>n?.id),npcCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    this.spawnedNPCs.push(...spawnedNPCs);
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
   */
  spawnEliteNPC(match, team, index) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:115',message:'spawnEliteNPC called',data:{matchId:match?.matchId,team,index},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Select NPC type (only one of each type per match)
    const usedTypes = this.spawnedNPCs.map(npc => npc.type || npc.class);
    const availableTypes = this.eliteNPCTypes.filter(type => !usedTypes.includes(type));
    
    let npcType;
    if (availableTypes.length === 0) {
      // All types used, reuse types
      npcType = this.eliteNPCTypes[index % this.eliteNPCTypes.length];
    } else {
      npcType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }
    
    // Get spawn position
    const spawnPoint = this.getNPCSpawnPoint(match, team, index);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:129',message:'Got spawn point',data:{spawnPoint,hasSpawnPoint:!!spawnPoint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Map elite NPC type names to actual NPC class names
    const npcClass = this.mapNPCTypeToClass(npcType);
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:132',message:'Mapped NPC type to class',data:{npcType,npcClass,hasNPCClass:!!global[npcClass],isFunction:typeof global[npcClass] === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Validate NPC class exists before creating
    if (!global[npcClass] || typeof global[npcClass] !== 'function') {
      console.error(`NPC class '${npcClass}' (mapped from '${npcType}') not found. Skipping NPC spawn.`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:137',message:'NPC class not found - returning null',data:{npcClass},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
      // Use mapContextManager to get tile from battleground map
      const getTile = global.getTile || (() => null);
      
      // Helper function to check if tile is walkable in battleground context
      const isWalkableInBG = (z, col, row) => {
        // Use matchId as entity context (mapContextManager will use it to get the right map)
        const tile = getTile(0, col, row, tempEntityId, match.matchId);
        if (tile === null || tile === undefined) return false;
        
        // Check if tile is water (0) - water is not walkable
        if (tile === 0) return false; // TERRAIN.WATER
        
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
      // Deathmatch: each NPC gets its own hostile house (handled by house manager)
      houseId = null;
    }
    
    const npcId = 'bg_npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const homeLoc = [Math.floor(spawnPoint.x / tileSize), Math.floor(spawnPoint.y / tileSize)];
    
    // Create NPC using the validated class constructor
    let npc = null;
    try {
      npc = global[npcClass]({
        id: npcId,
        name: npcType,
        x: spawnPoint.x,
        y: spawnPoint.y,
        z: spawnPoint.z,
        house: houseId,
        type: 'npc',
        battlegroundMatchId: match.matchId,
        inBattleground: true,
        home: {
          z: spawnPoint.z,
          loc: homeLoc
        },
        wanderRange: tileSize * 10
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:244',message:'NPC created successfully',data:{npcId,npcClass,hasNPC:!!npc},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } catch (e) {
      console.error(`Error creating elite NPC ${npcClass}:`, e);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:247',message:'Error creating NPC - exception',data:{error:e.message,stack:e.stack,npcClass},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return null;
    }
    
    if (!npc) {
      console.warn(`Failed to create elite NPC of type ${npcType} (class: ${npcClass})`);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'BattlegroundsEliteNPCManager.js:251',message:'NPC is null after creation',data:{npcClass},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return null;
    }
    
    // Store NPC info for tracking (include name, class, sex from actual entity)
    // Format name properly: use entity name if available, otherwise format class name
    let displayName = npcType;
    if (npc) {
      if (npc.name && npc.name !== npcType) {
        displayName = npc.name;
      } else if (npc.class) {
        // Format class name: "Oathkeeper" instead of "OATHKEEPER"
        displayName = npc.class.charAt(0).toUpperCase() + npc.class.slice(1).toLowerCase();
      } else {
        // Format npcType: "Oathkeeper" instead of "OATHKEEPER"
        displayName = npcType.charAt(0).toUpperCase() + npcType.slice(1).toLowerCase().replace(/_/g, ' ');
      }
    } else {
      // Format npcType as fallback
      displayName = npcType.charAt(0).toUpperCase() + npcType.slice(1).toLowerCase().replace(/_/g, ' ');
    }
    
    const npcInfo = {
      id: npcId,
      type: npcType,
      class: npc ? (npc.class || npcClass) : npcClass,
      name: displayName,
      sex: npc ? (npc.sex || 'm') : 'm',
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
      'HIGHPRIESTESS': 'Highpriestess',
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
  }
}

module.exports = BattlegroundsEliteNPCManager;


