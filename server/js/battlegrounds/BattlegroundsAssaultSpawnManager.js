/**
 * BattlegroundsAssaultSpawnManager - Manages attacker and defender NPC spawning for Assault mode
 * Attackers get a steady flow of basic units, defenders get a finite number of units
 */

class BattlegroundsAssaultSpawnManager {
  constructor() {
    this.attackerSpawnInterval = null;
    this.attackerSpawnRate = 30000; // 30 seconds between attacker spawns
    this.attackerNPCs = []; // Track spawned attacker NPCs
    this.defenderNPCs = []; // Track spawned defender NPCs
    this.maxDefenderNPCs = 8; // Finite number of defender NPCs
    // Basic military units spawned by garrisons (not economic units like Serfs)
    // Footsoldier is the standard basic military unit for player factions
    this.basicNPCTypes = ['Footsoldier']; // Basic military NPC types for attackers
    this.defenderNPCTypes = ['Footsoldier']; // Basic military NPC types for defenders
  }

  /**
   * Start attacker spawn system (steady flow of basic units)
   * @param {object} match - Current match object
   */
  startAttackerSpawns(match) {
    if (!match || !match.matchId) return;

    // Stop any existing spawn interval
    this.stopAttackerSpawns();

    // Spawn initial wave
    this.spawnAttackerWave(match);

    // Set up interval for continuous spawning
    this.attackerSpawnInterval = setInterval(() => {
      if (match.status === 'in_progress') {
        this.spawnAttackerWave(match);
      } else {
        this.stopAttackerSpawns();
      }
    }, this.attackerSpawnRate);

    console.log(`Started attacker spawn system for Assault match ${match.matchId}`);
  }

  /**
   * Stop attacker spawn system
   */
  stopAttackerSpawns() {
    if (this.attackerSpawnInterval) {
      clearInterval(this.attackerSpawnInterval);
      this.attackerSpawnInterval = null;
    }
  }

  /**
   * Spawn a wave of attacker NPCs
   * @param {object} match - Current match object
   */
  spawnAttackerWave(match) {
    if (!match || match.status !== 'in_progress') return;

    // Get attacker spawn area (team1)
    const spawnPoints = this.getAttackerSpawnPoints(match);
    if (!spawnPoints || spawnPoints.length === 0) return;

    // Spawn 2-3 basic NPCs per wave
    const npcsPerWave = 2 + Math.floor(Math.random() * 2); // 2-3 NPCs

    for (let i = 0; i < npcsPerWave; i++) {
      const spawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      const npcType = this.basicNPCTypes[Math.floor(Math.random() * this.basicNPCTypes.length)];

      const npc = this.spawnNPC(match, npcType, spawnPoint, 'team1', match.teams.team1.houseId);
      
      if (npc) {
        this.attackerNPCs.push(npc.id);
        
        // Add to match participants if tracking NPCs
        if (match.participants) {
          match.participants.push({
            id: npc.id,
            isNPC: true,
            team: 'team1',
            alive: true,
            x: npc.x,
            y: npc.y,
            z: npc.z
          });
        }
      }
    }
  }

  /**
   * Initialize defender NPCs (finite number)
   * @param {object} match - Current match object
   */
  initializeDefenders(match) {
    if (!match || !match.matchId) return;

    // Get defender spawn area (team2)
    const spawnPoints = this.getDefenderSpawnPoints(match);
    if (!spawnPoints || spawnPoints.length === 0) return;

    // Spawn finite number of defender NPCs
    const npcsToSpawn = Math.min(this.maxDefenderNPCs, spawnPoints.length);

    for (let i = 0; i < npcsToSpawn; i++) {
      const spawnPoint = spawnPoints[i % spawnPoints.length];
      const npcType = this.defenderNPCTypes[Math.floor(Math.random() * this.defenderNPCTypes.length)];

      const npc = this.spawnNPC(match, npcType, spawnPoint, 'team2', match.teams.team2.houseId);
      
      if (npc) {
        this.defenderNPCs.push(npc.id);
        
        // Add to match participants if tracking NPCs
        if (match.participants) {
          match.participants.push({
            id: npc.id,
            isNPC: true,
            team: 'team2',
            alive: true,
            x: npc.x,
            y: npc.y,
            z: npc.z
          });
        }
      }
    }

    console.log(`Initialized ${this.defenderNPCs.length} defender NPCs for Assault match ${match.matchId}`);
  }

  /**
   * Get attacker spawn points (team1, left side)
   * @param {object} match - Current match object
   * @returns {Array} Array of spawn point objects {x, y, z}
   */
  getAttackerSpawnPoints(match) {
    if (!match || !match.mapData) return [];

    const mapSize = match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    const centerY = mapBounds / 2;
    const leftSpawnX = mapBounds * 0.15; // 15% from left edge

    // Generate multiple spawn points in attacker area
    const spawnPoints = [];
    const spawnCount = 5; // 5 spawn points for attackers

    for (let i = 0; i < spawnCount; i++) {
      const yOffset = (i - spawnCount / 2) * (mapBounds * 0.15 / spawnCount);
      spawnPoints.push({
        x: leftSpawnX,
        y: centerY + yOffset,
        z: match.mapData.startingZ || 0
      });
    }

    return spawnPoints;
  }

  /**
   * Get defender spawn points (team2, near capture point)
   * @param {object} match - Current match object
   * @returns {Array} Array of spawn point objects {x, y, z}
   */
  getDefenderSpawnPoints(match) {
    if (!match || !match.mapData) return [];

    const mapSize = match.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    const centerY = mapBounds / 2;
    const defenderBaseX = mapBounds * 0.75; // 75% from left (defender side)

    // Get capture point from match manager's game mode
    let capturePoint = null;
    if (global.battlegroundsMatchManager && global.battlegroundsMatchManager.currentGameMode) {
      const gameMode = global.battlegroundsMatchManager.currentGameMode;
      if (gameMode.capturePoint) {
        capturePoint = gameMode.capturePoint;
      }
    }

    // Generate spawn points around defender stronghold/capture point
    const spawnPoints = [];
    const spawnCount = this.maxDefenderNPCs;
    const startingZ = capturePoint ? capturePoint.z : (match.mapData.startingZ || 0);
    
    // Helper to check if a tile is walkable (not water)
    const isWalkable = global.isWalkable || ((z, col, row) => {
      const tile = global.getTile ? global.getTile(0, col, row, null, match.matchId) : null;
      return tile !== null && tile !== 0; // 0 is TERRAIN.WATER
    });

    for (let i = 0; i < spawnCount; i++) {
      const angle = (i / spawnCount) * Math.PI * 2;
      const radius = tileSize * 3; // 3 tiles radius
      const spawnX = capturePoint ? capturePoint.x + Math.cos(angle) * radius : defenderBaseX;
      const spawnY = capturePoint ? capturePoint.y + Math.sin(angle) * radius : centerY + (i - spawnCount / 2) * (tileSize * 2);
      
      // Convert to tile coordinates
      const tileCol = Math.floor(spawnX / tileSize);
      const tileRow = Math.floor(spawnY / tileSize);
      
      // Check if spawn point is on walkable terrain (not water)
      if (isWalkable(startingZ, tileCol, tileRow)) {
        spawnPoints.push({
          x: spawnX,
          y: spawnY,
          z: startingZ
        });
      } else {
        // Try nearby tiles if spawn point is in water
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
        let found = false;
        for (const [dx, dy] of offsets) {
          const checkCol = tileCol + dx;
          const checkRow = tileRow + dy;
          if (isWalkable(startingZ, checkCol, checkRow)) {
            spawnPoints.push({
              x: checkCol * tileSize + tileSize / 2,
              y: checkRow * tileSize + tileSize / 2,
              z: startingZ
            });
            found = true;
            break;
          }
        }
        // If still not found, use original position anyway (will be handled by game logic)
        if (!found) {
          spawnPoints.push({
            x: spawnX,
            y: spawnY,
            z: startingZ
          });
        }
      }
    }

    return spawnPoints;
  }

  /**
   * Spawn an NPC for Assault mode
   * @param {object} match - Current match object
   * @param {string} npcType - NPC class name (e.g., 'Serf', 'SerfM', 'SerfF')
   * @param {object} spawnPoint - Spawn point {x, y, z}
   * @param {string} team - Team ('team1' or 'team2')
   * @param {string} houseId - House ID for the team
   * @returns {object|null} Spawned NPC entity
   */
  spawnNPC(match, npcType, spawnPoint, team, houseId) {
    if (!match || !spawnPoint || !houseId) return null;

    // Get NPC constructor from global scope
    const NpcConstructor = global[npcType];
    if (!NpcConstructor) {
      console.warn(`NPC constructor '${npcType}' not found`);
      return null;
    }

    const npcId = 'bg_assault_npc_' + Date.now() + '_' + Math.random().toString(36).substring(7);

    try {
      // Convert spawn point coordinates to tile location for home property
      const tileSize = global.tileSize || 64;
      const homeLoc = [Math.floor(spawnPoint.x / tileSize), Math.floor(spawnPoint.y / tileSize)];
      
      const npc = NpcConstructor({
        id: npcId,
        name: `${team === 'team1' ? 'Attacker' : 'Defender'} ${npcType}`,
        class: npcType,
        x: spawnPoint.x,
        y: spawnPoint.y,
        z: spawnPoint.z,
        house: houseId,
        type: 'npc',
        battlegroundMatchId: match.matchId,
        inBattleground: true,
        dropsItems: false, // Don't drop items in battlegrounds
        canPickup: false,
        interactable: false,
        targetable: true,
        attackable: true,
        home: {
          z: spawnPoint.z,
          loc: homeLoc
        },
        wanderRange: tileSize * 10 // Allow NPCs to wander 10 tiles from spawn point
      });

      if (npc && global.mapContextHelpers) {
        global.mapContextHelpers.setEntityContext(npc, match.matchId);
      } else if (npc) {
        npc.inBattleground = true;
        npc.battlegroundMatchId = match.matchId;
      }

      return npc;
    } catch (e) {
      console.error(`Error spawning Assault NPC of type ${npcType}:`, e);
      return null;
    }
  }

  /**
   * Cleanup all spawned NPCs
   */
  cleanup() {
    // Stop attacker spawns
    this.stopAttackerSpawns();

    // Remove all spawned NPCs
    this.removeNPCs([...this.attackerNPCs, ...this.defenderNPCs]);

    // Clear tracking arrays
    this.attackerNPCs = [];
    this.defenderNPCs = [];

    console.log('Cleaned up Assault spawn manager');
  }

  /**
   * Remove NPCs by ID list
   * @param {Array<string>} npcIds - Array of NPC IDs to remove
   */
  removeNPCs(npcIds) {
    if (!npcIds || npcIds.length === 0) return;

    npcIds.forEach(npcId => {
      const npc = global.Player.list[npcId];
      if (npc) {
        npc.toRemove = true;
        // Trigger cleanup if available
        if (npc.cleanup && typeof npc.cleanup === 'function') {
          npc.cleanup();
        }
        delete global.Player.list[npcId];
      }
    });
  }

  /**
   * Get count of alive attacker NPCs
   */
  getAliveAttackerCount() {
    return this.attackerNPCs.filter(id => {
      const npc = global.Player.list[id];
      return npc && npc.alive && !npc.toRemove;
    }).length;
  }

  /**
   * Get count of alive defender NPCs
   */
  getAliveDefenderCount() {
    return this.defenderNPCs.filter(id => {
      const npc = global.Player.list[id];
      return npc && npc.alive && !npc.toRemove;
    }).length;
  }
}

module.exports = BattlegroundsAssaultSpawnManager;

