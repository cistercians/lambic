/**
 * BattlegroundsMatchManager - Handles match lifecycle, game modes, and match state
 */

const DeathmatchMode = require('./game_modes/DeathmatchMode');
const SkirmishMode = require('./game_modes/SkirmishMode');
const AssaultMode = require('./game_modes/AssaultMode');
const BattlegroundsPathfindingManager = require('./BattlegroundsPathfindingManager');
const BattlegroundsMapPostProcessor = require('./BattlegroundsMapPostProcessor');
const BattlegroundsEliteNPCBehavior = require('./BattlegroundsEliteNPCBehavior');
const BattlegroundsLeashManager = require('./BattlegroundsLeashManager');
const BattlegroundsSpectatorSystem = require('./BattlegroundsSpectatorSystem');
const BattlegroundsMapVotingSystem = require('./BattlegroundsMapVotingSystem');
const MapAnalyzer = require('../ai/MapAnalyzer');
const { FACTION_IDS } = require('../bootstrap/constants');

class BattlegroundsMatchManager {
  constructor() {
    this.currentMatch = null;
    this.matchTimer = null;
    this.updateInterval = null;
    this.matchDuration = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.mapPreviewTime = 10 * 1000; // 10 seconds
    this.matchStartDelay = 5 * 1000; // 5 seconds
    this.postGameCooldown = 10 * 1000; // 10 seconds
    this.updateIntervalMs = 1000; // Update every second
    
    // Callbacks
    this.onMatchEndCallback = null;
    this.onMapGeneratedCallback = null;
    
    // Dependencies (will be injected)
    this.mapGenerator = null;
    this.houseManager = null;
    this.eliteNPCManager = null;
    this.scoreManager = null;
    this.mapLibrary = null; // Will be injected
    
    // Current game mode instance
    this.currentGameMode = null;
    
    // Pathfinding manager
    this.pathfindingManager = new BattlegroundsPathfindingManager();
    this.pathfindingManager.init();
    
    // Map post-processor
    this.mapPostProcessor = new BattlegroundsMapPostProcessor();
    
    // Elite NPC behavior manager
    this.eliteNPCBehavior = new BattlegroundsEliteNPCBehavior();
    
    // Leash manager for Cave/Dungeon maps
    this.leashManager = new BattlegroundsLeashManager();
    
    // Spectator system
    this.spectatorSystem = new BattlegroundsSpectatorSystem();
    
    // Weather manager (will be injected)
    this.weatherManager = null;
    
    // Map voting system
    this.mapVotingSystem = new BattlegroundsMapVotingSystem();
  }

  /**
   * Start a new match
   * @param {object} matchConfig - Match configuration from lobby
   */
  async startMatch(matchConfig) {
    if (this.currentMatch) {
      console.warn('Match already in progress, cannot start new match');
      return;
    }

    const { players, gameMode, originalPlayerPositions } = matchConfig;
    let resolvedGameMode = gameMode;
    
    // Determine map size based on participant count
    const participantCount = players.length;
    let mapSize;
    if (participantCount <= 4) {
      mapSize = 64;
    } else if (participantCount <= 7) {
      mapSize = 80;
    } else {
      mapSize = 96;
    }

    // For Skirmish, ensure minimum 2 players (spawn NPCs if needed)
    let finalPlayers = [...players];
    if (resolvedGameMode === 'skirmish') {
      const team1Count = players.filter(p => p.team === 'team1').length;
      const team2Count = players.filter(p => p.team === 'team2').length;
      
      // Ensure at least 1 player per team (spawn NPCs will be added later)
      // For now, just ensure teams are assigned
      if (team1Count === 0 || team2Count === 0) {
        // Auto-assign teams if needed
        players.forEach((player, index) => {
          if (!player.team) {
            player.team = index % 2 === 0 ? 'team1' : 'team2';
          }
        });
        finalPlayers = players;
      }
    }

    // Initialize match state with player class/sex for portraits
    this.currentMatch = {
      matchId: 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      gameMode: resolvedGameMode,
      mapType: null, // Will be set after map generation
      mapSize: mapSize,
      participants: finalPlayers.map(p => {
        const player = global.Player.list[p.id];
        return {
          ...p,
          kills: 0,
          deaths: 0,
          alive: true,
          class: player ? (player.class || 'SerfM') : 'SerfM',
          sex: player ? (player.sex || 'm') : 'm'
        };
      }),
      teams: this.getTeamAssignments(finalPlayers, resolvedGameMode),
      startTime: null,
      endTime: null,
      status: 'generating', // 'generating' | 'map_preview' | 'starting' | 'in_progress' | 'ending' | 'finished'
      mapData: null,
      scores: {},
      eliteNPCs: []
    };

    // Plan elite NPCs BEFORE map generation so they're available for lobby display
    let plannedNPCs = [];
    if (this.eliteNPCManager) {
      plannedNPCs = this.eliteNPCManager.planEliteNPCs(this.currentMatch);
      
      // Add planned NPCs to participants list immediately (for lobby display)
      plannedNPCs.forEach(npcInfo => {
        if (npcInfo && npcInfo.id) {
          const npcParticipant = {
            id: npcInfo.id,
            name: npcInfo.name || 'NPC',
            team: npcInfo.team || null,
            isNPC: true,
            kills: 0,
            deaths: 0,
            alive: true,
            class: npcInfo.class || 'SerfM',
            sex: npcInfo.sex || 'm'
          };
          this.currentMatch.participants.push(npcParticipant);
        }
      });
      
      // Store planned NPCs for later spawning
      this.currentMatch.plannedNPCs = plannedNPCs;
      
      // Notify lobby that NPCs have been planned (for UI display)
      if (global.battlegroundsLobbyManager) {
        global.battlegroundsLobbyManager.broadcastLobbyUpdate();
      }
    }

    // Generate map
    try {
      const mapData = await this.generateMap(resolvedGameMode, mapSize);
      this.currentMatch.mapData = mapData;
      this.currentMatch.mapType = mapData.mapType;
      
      // Register battleground map in map context manager (initial registration, will be updated after post-processing)
      if (global.mapContextManager && mapData.worldData) {
        global.mapContextManager.registerBattlegroundMap(this.currentMatch.matchId, mapData.worldData, mapSize);
      }
      
      // Post-process map for game mode (starting areas, fortifications, spawn points, etc.)
      // Always post-process to calculate spawn points, even for classic maps
      // (spawn points need to be recalculated based on current participant count)
      if (this.mapPostProcessor && mapData.worldData) {
        const processedMapData = this.mapPostProcessor.postProcessMap(mapData, resolvedGameMode, this.currentMatch);
        // Update match with processed map data (includes spawn points)
        this.currentMatch.mapData = processedMapData;
        // Update registered map in context manager with processed data
        if (global.mapContextManager && processedMapData.worldData) {
          global.mapContextManager.registerBattlegroundMap(this.currentMatch.matchId, processedMapData.worldData, mapSize);
        }
      } else if (mapData.worldData) {
        // Fallback: register map even if post-processor not available
        if (global.mapContextManager) {
          global.mapContextManager.registerBattlegroundMap(this.currentMatch.matchId, mapData.worldData, mapSize);
        }
      }

      // Validate post-processed map before continuing
      if (this.mapGenerator && this.mapGenerator.validator && this.currentMatch.mapData) {
        const validation = this.mapGenerator.validator.validateMap(this.currentMatch.mapData, resolvedGameMode);
        if (!validation.valid) {
          throw new Error(`post_process_map_invalid:${validation.reason}`);
        }
      }
      
      // Generate pathfinding grids for the battleground map (after post-processing)
      if (this.pathfindingManager && this.currentMatch.mapData.worldData) {
        const pathfinding = this.pathfindingManager.generatePathfindingGrids(this.currentMatch.mapData.worldData, mapSize);
        if (pathfinding) {
          this.currentMatch.pathfinding = pathfinding;
          console.log(`Generated pathfinding grids for battleground match ${this.currentMatch.matchId}`);
        } else {
          console.warn('Failed to generate pathfinding grids for battleground map');
        }
      }

      // Spawn battleground factions (Outlaws/Mercenaries) using main-world init flow
      this.spawnBattlegroundFactions();
      
      // Initialize game mode (after map data is set)
      this.initGameMode(resolvedGameMode);
      
      // Store original player positions and House assignments
      // Use positions passed from lobby manager (stored when player joined lobby)
      this.storePlayerState(finalPlayers, originalPlayerPositions || null);
      
      // Create temporary Houses
      if (this.houseManager) {
        this.houseManager.createBattlegroundHouses(this.currentMatch);
      }
      
      // Spawn elite NPCs using pre-planned NPCs (they're already in participants list)
      if (this.eliteNPCManager && this.currentMatch.plannedNPCs) {
      const eliteNPCs = this.eliteNPCManager.spawnEliteNPCs(this.currentMatch, this.currentMatch.plannedNPCs);
        this.currentMatch.eliteNPCs = eliteNPCs;
        
        // Update participant entries with actual NPC entity data (class/sex from spawned entity)
        eliteNPCs.forEach(npcInfo => {
          if (npcInfo && npcInfo.id) {
            // Find the participant entry we created during planning
            const participant = this.currentMatch.participants.find(p => p.id === npcInfo.id);
            if (participant) {
            // Get the actual NPC entity to get class/sex/name
            const npcEntity = global.Player.list[npcInfo.id];
              if (npcEntity) {
                // Update with actual entity data
                participant.name = npcInfo.name || (npcEntity.name || npcEntity.class || npcInfo.type || 'NPC');
                participant.class = npcInfo.class || npcEntity.class || 'SerfM';
                participant.sex = npcInfo.sex || npcEntity.sex || 'm';
              } else {
                // Use planned data if entity not available yet
                participant.name = npcInfo.name || 'NPC';
                participant.class = npcInfo.class || 'SerfM';
                participant.sex = npcInfo.sex || 'm';
              }
            }
          }
        });
        
        // Clear planned NPCs after spawning
        delete this.currentMatch.plannedNPCs;
      }
      
      // Notify lobby that NPCs have been spawned (update with actual entity data)
      if (global.battlegroundsLobbyManager) {
        global.battlegroundsLobbyManager.broadcastLobbyUpdate();
      }
      
      // Start map preview phase (NPCs are now in participants list)
      this.startMapPreview();
    } catch (error) {
      console.error('Error generating map:', error);
      if (global.battlegroundsLobbyManager) {
        global.battlegroundsLobbyManager.broadcastLobbyChat(
          'Match cancelled: map generation failed',
          'system'
        );
      }
      this.endMatch({ reason: 'map_generation_failed' });
    }
  }

  spawnBattlegroundFactions() {
    const match = this.currentMatch;
    if (!match || !match.mapData || !match.mapData.worldData) return;

    const mapData = match.mapData;
    const mapSize = match.mapSize || mapData.mapSize || 0;
    if (!mapSize) return;

    const tileGetter = (layer, c, r) => {
      if (!mapData.worldData[layer] || !mapData.worldData[layer][r]) return 0;
      const value = mapData.worldData[layer][r][c];
      return typeof value === 'undefined' ? 0 : value;
    };
    const mapAnalyzer = new MapAnalyzer({ mapSize, tileGetter });
    const contextEntity = { inBattleground: true, battlegroundMatchId: match.matchId };

    const excludedHQs = [];

    let outlawCount = 0;
    let maxOutlawAttempts = 50;
    let consecutiveFailures = 0;
    while (consecutiveFailures < 3 && outlawCount < maxOutlawAttempts) {
      const outlawsHQ = mapAnalyzer.findFactionHQ('Outlaws', excludedHQs);
      if (outlawsHQ) {
        excludedHQs.push(outlawsHQ.tile);
        outlawCount++;
        consecutiveFailures = 0;
        Outlaws({
          id: FACTION_IDS.OUTLAWS + outlawCount - 1,
          type: 'npc',
          name: `Outlaws ${outlawCount}`,
          flag: '',
          hq: outlawsHQ.tile,
          hostile: true,
          contextEntity
        });
      } else {
        consecutiveFailures++;
      }
    }

    let mercenariesCount = 0;
    let maxMercenariesAttempts = 50;
    let mercenariesConsecutiveFailures = 0;
    while (mercenariesConsecutiveFailures < 3 && mercenariesCount < maxMercenariesAttempts) {
      const mercenariesHQ = mapAnalyzer.findFactionHQ('Mercenaries', excludedHQs);
      if (mercenariesHQ) {
        excludedHQs.push(mercenariesHQ.tile);
        mercenariesCount++;
        mercenariesConsecutiveFailures = 0;
        Mercenaries({
          id: FACTION_IDS.MERCENARIES + mercenariesCount - 1,
          type: 'npc',
          name: `Mercenaries ${mercenariesCount}`,
          flag: '',
          hq: mercenariesHQ.tile,
          hostile: true,
          contextEntity
        });
      } else {
        mercenariesConsecutiveFailures++;
      }
    }
  }

  /**
   * Get team assignments based on game mode
   */
  getTeamAssignments(players, gameMode) {
    if (gameMode === 'deathmatch') {
      // Each player gets their own team
      const teams = {};
      players.forEach(player => {
        teams[player.id] = { houseId: 'bg_house_' + player.id, team: 'solo' };
      });
      return teams;
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      // Two teams
      let team1 = players.filter(p => p.team === 'team1').map(p => p.id);
      let team2 = players.filter(p => p.team === 'team2').map(p => p.id);
      
      // If teams are unbalanced, auto-balance
      if (Math.abs(team1.length - team2.length) > 1) {
        team1 = [];
        team2 = [];
        players.forEach((player, index) => {
          if (index % 2 === 0) {
            team1.push(player.id);
            // Update player's team property
            player.team = 'team1';
          } else {
            team2.push(player.id);
            // Update player's team property
            player.team = 'team2';
          }
        });
      } else {
        // Ensure all players have team property set
        players.forEach(player => {
          if (team1.includes(player.id) && !player.team) {
            player.team = 'team1';
          } else if (team2.includes(player.id) && !player.team) {
            player.team = 'team2';
          }
        });
      }
      
      return {
        team1: { players: team1, houseId: 'bg_house_team1' },
        team2: { players: team2, houseId: 'bg_house_team2' }
      };
    }
    return {};
  }

  /**
   * Generate map for the match
   * Flow:
   * 1. Check library for maps matching game mode and map size
   * 2. If matches found, 15% chance to use a Classic Map
   * 3. If Classic Map selected, use weighted selection based on positiveVotes counter
   *    (maps with higher positiveVotes are prioritized)
   * 4. Otherwise, generate a new map
   */
  async generateMap(gameMode, mapSize) {
    if (!this.mapGenerator) {
      throw new Error('Map generator not initialized');
    }
    
    // Step 1: Check if there are Classic Maps available for this game mode and map size
    let matchingClassicMaps = [];
    if (this.mapLibrary) {
      matchingClassicMaps = this.mapLibrary.getAllClassicMaps(gameMode, mapSize);
    }
    
    // Step 2: If matches found, decide whether to use a Classic Map (15% chance)
    if (matchingClassicMaps.length > 0 && Math.random() < 0.15) {
      // Step 3: Use weighted selection to choose one from the list of matching maps
      // Maps with higher positiveVotes have higher weight and are more likely to be selected
      // Use the library's getRandomClassicMap method which handles weighted selection
      const classicMap = this.mapLibrary.getRandomClassicMap(gameMode, mapSize);
      
      if (!classicMap) {
        // Fallback (shouldn't happen since we already checked for matches)
        console.warn('Failed to get Classic Map despite matches being found');
        return await this.mapGenerator.generateBattlegroundMap(gameMode, mapSize);
      }
      
      console.log(`Using Classic Map: ${classicMap.mapId} for ${gameMode} (${mapSize}x${mapSize}) from ${matchingClassicMaps.length} available maps`);
      
      // Increment play count
      this.mapLibrary.incrementPlayCount(classicMap.mapId);
      
      // Return the classic map
      // Note: Classic maps are saved with post-processing already applied, so raw = false
      return {
        mapType: classicMap.mapType,
        mapSize: classicMap.mapSize,
        worldData: classicMap.worldData,
        entrances: classicMap.entrances || [],
        startingZ: classicMap.startingZ || 0,
        raw: false, // Classic maps are saved after post-processing, so they're not raw
        classicMapId: classicMap.mapId, // Track that this is a classic map
        postProcessing: classicMap.metadata ? classicMap.metadata.postProcessing : null
      };
    }
    
    // Step 4: No Classic Map selected (either none available or 85% chance to generate new) - create a new map
    console.log(`Generating new map for ${gameMode} (${mapSize}x${mapSize})${matchingClassicMaps.length > 0 ? ' (Classic Map available but not selected)' : ''}`);
    return await this.mapGenerator.generateBattlegroundMap(gameMode, mapSize);
  }

  /**
   * Store original player state (position, house, etc.)
   * @param {Array} players - Array of player objects {id, name, team}
   * @param {Object} originalPositions - Optional object with pre-stored positions {playerId: {x, y, z, house}}
   */
  storePlayerState(players, originalPositions = null) {
    if (!this.currentMatch) return;
    
    this.currentMatch.originalPlayerState = {};
    players.forEach(player => {
      // Get current player object to access inventory
      const p = global.Player.list[player.id];
      if (!p) return;
      
      // Use pre-stored positions if provided (from lobby join time), otherwise use current position
      if (originalPositions && originalPositions[player.id]) {
        const storedPos = originalPositions[player.id];
        console.log(`Using pre-stored position for player ${player.id} (from lobby join): x=${storedPos.x}, y=${storedPos.y}, z=${storedPos.z}, house=${storedPos.house}`);
        this.currentMatch.originalPlayerState[player.id] = {
          x: storedPos.x,
          y: storedPos.y,
          z: storedPos.z,
          house: storedPos.house,
          inBattleground: false,
          inventory: p.inventory ? JSON.parse(JSON.stringify(p.inventory)) : null
        };
      } else {
        // Fallback: use current position (shouldn't happen if lobby manager stores positions)
          console.log(`Storing current state for player ${player.id} (fallback): x=${p.x}, y=${p.y}, z=${p.z}, house=${p.house}`);
          this.currentMatch.originalPlayerState[player.id] = {
            x: p.x,
            y: p.y,
            z: p.z,
            house: p.house,
          inBattleground: p.inBattleground || false,
          inventory: p.inventory ? JSON.parse(JSON.stringify(p.inventory)) : null
          };
      }
    });
  }

  /**
   * Start map preview phase (10 seconds)
   */
  startMapPreview() {
    if (!this.currentMatch) return;
    
    this.currentMatch.status = 'map_preview';
    this.currentMatch.countdownTimer = 10; // 10 second preview
    this.broadcastMatchUpdate();
    
    // Send map preview to all participants
    this.broadcastMapPreview();
    
    // Countdown timer for preview
    const previewInterval = setInterval(() => {
      if (!this.currentMatch) {
        clearInterval(previewInterval);
        return;
      }
      
      this.currentMatch.countdownTimer--;
      this.broadcastMatchUpdate();
      
      if (this.currentMatch.countdownTimer <= 0) {
        clearInterval(previewInterval);
        // After preview time, start match countdown
        this.startMatchCountdown();
      }
    }, 1000);
    
    // Update lobby with map type
    if (global.battlegroundsLobbyManager) {
      global.battlegroundsLobbyManager.broadcastLobbyUpdate();
    }
  }

  /**
   * Start match countdown (5 seconds) - only after all players are spawned
   */
  async startMatchCountdown() {
    if (!this.currentMatch) return;
    
    // Check if any human players remain before starting countdown
    const humanPlayers = this.currentMatch.participants.filter(p => !p.isNPC);
    if (humanPlayers.length === 0) {
      console.log('No human players in match, ending match early');
      this.endMatch({ 
        reason: 'no_human_players',
        winner: null,
        winnerType: null,
        message: 'Match cancelled: No human players'
      });
      return;
    }
    
    // First, spawn all players and NPCs
    await this.spawnParticipants();
    
    // Wait a moment for spawn messages to be sent and clients to load, then start countdown
    setTimeout(() => {
      if (!this.currentMatch) return;
      
      this.currentMatch.status = 'starting';
      this.currentMatch.countdownTimer = 5; // 5 second countdown
      this.broadcastMatchUpdate(); // Broadcast initial countdown state
      
      // Countdown timer - visible countdown that updates every second
      const countdownInterval = setInterval(() => {
        if (!this.currentMatch) {
          clearInterval(countdownInterval);
          return;
        }
        
        this.currentMatch.countdownTimer--;
        this.broadcastMatchUpdate(); // Broadcast countdown update so lobby UI shows it
        
        if (this.currentMatch.countdownTimer <= 0) {
          clearInterval(countdownInterval);
          // Start match immediately after countdown reaches 0
          this.beginMatch();
        }
      }, 1000);
    }, 1000); // Wait 1 second to ensure all spawn messages are sent and clients have loaded
  }

  /**
   * Spawn all participants (players and NPCs)
   */
  async spawnParticipants() {
    if (!this.currentMatch) return;
    
    const { gameMode, mapData, participants, teams } = this.currentMatch;
    
    console.log(`[BattlegroundsMatchManager] spawnParticipants called for match ${this.currentMatch.matchId}`);
    console.log(`[BattlegroundsMatchManager] Map data: mapSize=${this.currentMatch.mapSize}, mapType=${this.currentMatch.mapType}, startingZ=${mapData.startingZ || 0}`);
    console.log(`[BattlegroundsMatchManager] World data structure:`, {
      hasWorldData: !!mapData.worldData,
      worldDataType: typeof mapData.worldData,
      isArray: Array.isArray(mapData.worldData),
      arrayLength: Array.isArray(mapData.worldData) ? mapData.worldData.length : 'N/A',
      layer0Length: (Array.isArray(mapData.worldData) && mapData.worldData[0]) ? (Array.isArray(mapData.worldData[0]) ? mapData.worldData[0].length : 'not array') : 'N/A'
    });
    
    // Get spawn points based on game mode
    let spawnPoints = this.calculateSpawnPoints(gameMode, mapData);
    
    if (!spawnPoints || Object.keys(spawnPoints).length === 0) {
      console.warn('[BattlegroundsMatchManager] No spawn points calculated, using emergency fallback');
      spawnPoints = this.getEmergencySpawnPoints(participants, mapData);
    }
    
    if (!spawnPoints || Object.keys(spawnPoints).length === 0) {
      console.error('[BattlegroundsMatchManager] No spawn points available after fallback, ending match');
      this.endMatch({
        reason: 'spawn_points_missing',
        winner: null,
        winnerType: null,
        message: 'Match cancelled: No spawn points available'
      });
      return;
    }
    
    console.log(`[BattlegroundsMatchManager] Got ${Object.keys(spawnPoints).length} spawn points from game mode`);
    
    // Store player IDs for position verification
    const spawnedPlayerIds = [];
    
    // Spawn players and NPCs
    for (const participant of participants) {
      // Skip NPCs - they are spawned separately by their respective managers
      if (participant.isNPC) {
        continue;
      }
      
      const player = global.Player.list[participant.id];
      if (!player) {
        console.warn(`[BattlegroundsMatchManager] Player ${participant.id} not found in Player.list`);
        continue;
      }

      // Reset battleground death state and restore health before spawning
      player.inBattlegroundDead = false;
      player.alive = true;
      if (player.hp !== null && player.hp !== undefined) {
        player.hp = player.hpMax || 100;
      }
      
      const spawnPoint = spawnPoints[participant.id];
      if (!spawnPoint) {
        console.warn(`[BattlegroundsMatchManager] No spawn point found for participant ${participant.id}`);
        continue;
      }
      
      // Set player position and battleground flags
      // Ensure z is valid (not -3 underwater unless map is underwater)
      const startingZ = mapData.startingZ || 0;
      const validZ = (spawnPoint.z !== undefined && spawnPoint.z !== -3) ? spawnPoint.z : startingZ;
      
      console.log(`[BattlegroundsMatchManager] Spawning player ${participant.id} (${player.name || 'unknown'}) at spawn point:`, {
        spawnX: spawnPoint.x,
        spawnY: spawnPoint.y,
        spawnZ: spawnPoint.z,
        validZ: validZ,
        previousX: player.x,
        previousY: player.y,
        previousZ: player.z
      });
      
      // CRITICAL: Use unified context transition system
      if (global.contextTransitionManager) {
        await global.contextTransitionManager.transitionPlayer(participant.id, {
          matchId: this.currentMatch.matchId,
          position: { x: spawnPoint.x, y: spawnPoint.y, z: validZ },
          worldData: mapData.worldData
        });
      } else {
        // Fallback if transition manager not available
      player.x = spawnPoint.x;
      player.y = spawnPoint.y;
      player.z = validZ;
        if (global.mapContextHelpers) {
          global.mapContextHelpers.setEntityContext(player, this.currentMatch.matchId);
        } else {
      player.inBattleground = true;
      player.battlegroundMatchId = this.currentMatch.matchId;
        }
      }
      
      console.log(`[BattlegroundsMatchManager] Player ${participant.id} position after setting: x=${player.x}, y=${player.y}, z=${player.z}, inBattleground=${player.inBattleground}, battlegroundMatchId=${player.battlegroundMatchId}`);
      
      // Set temporary House
      if (gameMode === 'deathmatch') {
        player.house = teams[participant.id]?.houseId || null;
      } else {
        // Skirmish/Assault - assign team house
        if (participant.team === 'team1' && teams.team1) {
          player.house = teams.team1.houseId;
        } else if (participant.team === 'team2' && teams.team2) {
          player.house = teams.team2.houseId;
        }
      }
      
      // Send battleground world data and spawn update to client
      const socket = global.SOCKET_LIST[participant.id];
      if (socket) {
        try {
          // First, send battleground world data so client can switch context
          if (mapData && mapData.worldData) {
            const worldDataMsg = {
              msg: 'battlegroundWorld',
              matchId: this.currentMatch.matchId,
              world: mapData.worldData,
              tileSize: global.tileSize || 64,
              mapSize: this.currentMatch.mapSize,
              startingZ: mapData.startingZ || 0
            };
            
            console.log(`[BattlegroundsMatchManager] Sending battlegroundWorld message to player ${participant.id}:`, {
              matchId: worldDataMsg.matchId,
              mapSize: worldDataMsg.mapSize,
              tileSize: worldDataMsg.tileSize,
              startingZ: worldDataMsg.startingZ,
              worldDataType: typeof worldDataMsg.world,
              worldIsArray: Array.isArray(worldDataMsg.world),
              worldArrayLength: Array.isArray(worldDataMsg.world) ? worldDataMsg.world.length : 'N/A'
            });
            
            socket.write(JSON.stringify(worldDataMsg));
          } else {
            console.error(`[BattlegroundsMatchManager] Cannot send battlegroundWorld: mapData=${!!mapData}, worldData=${!!(mapData && mapData.worldData)}`);
          }
          
          // Collect NPC entities for init pack
          const npcPlayers = [];
          let npcsChecked = 0;
          let npcsInContext = 0;
          let npcsOutOfContext = 0;
          this.currentMatch.participants.forEach(p => {
            if (p.isNPC) {
              npcsChecked++;
              const npc = global.Player.list[p.id];
              if (npc) {
                // CRITICAL: Verify NPC is in same context as match
                const npcInBG = !!(npc.inBattleground && npc.battlegroundMatchId);
                const matchId = this.currentMatch.matchId;
                const sameContext = npcInBG && npc.battlegroundMatchId === matchId;
                
                if (!sameContext) {
                  npcsOutOfContext++;
                  return; // Skip NPCs from different context
                }
                npcsInContext++;
                
                // Use getInitPack() to ensure all properties are correctly serialized
                const npcInitPack = npc.getInitPack();
                // Ensure context properties are set (getInitPack might not include these)
                npcInitPack.inBattleground = true;
                npcInitPack.battlegroundMatchId = this.currentMatch.matchId;
                npcPlayers.push(npcInitPack);
              }
            }
          });
          
          // Then send init pack update to switch to battleground context
          // Include world data in init message as fallback if battlegroundWorld message was missed
          const initMsg = {
            msg: 'init',
            id: participant.id,
            selfId: participant.id, // Include selfId for proper initialization
            x: player.x,
            y: player.y,
            z: player.z,
            inBattleground: true,
            battlegroundMatchId: this.currentMatch.matchId,
            mapContext: this.currentMatch.matchId,
            // Include world data as fallback
            world: mapData.worldData,
            tileSize: global.tileSize || 64,
            mapSize: this.currentMatch.mapSize,
            startingZ: mapData.startingZ || 0,
            pack: {
              player: [
                {
                id: participant.id,
                x: player.x,
                y: player.y,
                z: player.z,
                class: player.class || 'SerfM',
                sex: player.sex || 'm',
                name: player.name || participant.name,
                hp: player.hp || player.hpMax || 100,
                hpMax: player.hpMax || 100,
                inBattleground: true,
                battlegroundMatchId: this.currentMatch.matchId
                },
                ...npcPlayers // Include all NPCs in init pack
              ],
              arrow: [],
              item: [],
              light: [],
              building: []
            }
          };
          
          console.log(`[BattlegroundsMatchManager] Sending init message to player ${participant.id}:`, {
            x: initMsg.x,
            y: initMsg.y,
            z: initMsg.z,
            inBattleground: initMsg.inBattleground,
            battlegroundMatchId: initMsg.battlegroundMatchId,
            mapSize: initMsg.mapSize,
            tileSize: initMsg.tileSize,
            worldDataType: typeof initMsg.world,
            worldIsArray: Array.isArray(initMsg.world)
          });
          
          
          socket.write(JSON.stringify(initMsg));
          
          // Also send playerUpdate for position sync
          const playerUpdateMsg = {
            msg: 'playerUpdate',
            id: participant.id,
            x: player.x,
            y: player.y,
            z: player.z,
            inBattleground: true,
            battlegroundMatchId: this.currentMatch.matchId
          };
          
          console.log(`[BattlegroundsMatchManager] Sending playerUpdate to player ${participant.id}:`, playerUpdateMsg);
          
          socket.write(JSON.stringify(playerUpdateMsg));
          
          // Store player ID for position verification
          spawnedPlayerIds.push(participant.id);
        } catch (e) {
          console.error(`[BattlegroundsMatchManager] Error sending spawn update to player ${participant.id}:`, e);
        }
      } else {
        console.error(`[BattlegroundsMatchManager] No socket found for player ${participant.id}`);
      }
    }
    
    // Verify player positions after a short delay (to catch any position changes)
    setTimeout(() => {
      spawnedPlayerIds.forEach(playerId => {
        const player = global.Player.list[playerId];
        if (player) {
          console.log(`[BattlegroundsMatchManager] Position verification for player ${playerId} (${player.name || 'unknown'}):`, {
            x: player.x,
            y: player.y,
            z: player.z,
            inBattleground: player.inBattleground,
            battlegroundMatchId: player.battlegroundMatchId,
            matchId: this.currentMatch.matchId
          });
        } else {
          console.warn(`[BattlegroundsMatchManager] Player ${playerId} not found in Player.list during verification`);
        }
      });
    }, 2000); // Check after 2 seconds
    
    // Send spawn updates for NPCs to clients
    // NPCs are already spawned and in participants list
    this.currentMatch.participants.forEach((participant) => {
      if (participant.isNPC) {
        const npc = global.Player.list[participant.id];
        if (npc) {
          // Send init pack update for NPC to all participants
          const participants = this.currentMatch.participants.map(p => p.id);
          participants.forEach(playerId => {
            const socket = global.SOCKET_LIST[playerId];
            if (socket) {
              // Send player update with NPC data
              socket.write(JSON.stringify({
                msg: 'playerUpdate',
                id: participant.id,
                x: npc.x,
                y: npc.y,
                z: npc.z,
                class: npc.class || participant.class || 'SerfM',
                sex: npc.sex || participant.sex || 'm',
                name: npc.name || participant.name || 'NPC',
                inBattleground: true,
                battlegroundMatchId: this.currentMatch.matchId
              }));
            }
          });
        }
      }
    });
    
    // Send spawn updates to clients
    this.broadcastSpawnUpdate();
  }

  /**
   * Initialize game mode instance
   */
  initGameMode(gameMode) {
    if (!this.currentMatch) {
      console.error('Cannot initialize game mode: no current match');
      return;
    }
    
    // Create game mode instance (pass matchManager reference)
    if (gameMode === 'deathmatch') {
      this.currentGameMode = new DeathmatchMode(this);
    } else if (gameMode === 'skirmish') {
      this.currentGameMode = new SkirmishMode(this);
    } else if (gameMode === 'assault') {
      this.currentGameMode = new AssaultMode(this);
    } else {
      console.error('Unknown game mode:', gameMode);
      this.currentGameMode = new DeathmatchMode(this); // Fallback
    }
    
    // Initialize game mode with match data
    if (this.currentGameMode && this.currentGameMode.init) {
      this.currentGameMode.init(this.currentMatch);
    }
  }

  /**
   * Calculate spawn points for players based on game mode
   */
  calculateSpawnPoints(gameMode, mapData) {
    // Delegate to game mode instance
    if (this.currentGameMode && this.currentGameMode.getSpawnPoints) {
      try {
        return this.currentGameMode.getSpawnPoints();
      } catch (e) {
        console.error('Error getting spawn points from game mode:', e);
        // Fall through to fallback logic
      }
    }
    
    // Fallback to old logic if game mode not initialized
    console.warn('Game mode not initialized, using fallback spawn logic');
    const spawnPoints = {};
    const { participants, teams } = this.currentMatch;
    const mapSize = this.currentMatch.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    
    if (gameMode === 'deathmatch') {
      const count = participants.length;
      const angleStep = (2 * Math.PI) / count;
      
      participants.forEach((participant, index) => {
        const angle = index * angleStep;
        const radius = mapBounds * 0.35;
        const x = mapBounds / 2 + Math.cos(angle) * radius;
        const y = mapBounds / 2 + Math.sin(angle) * radius;
        
        spawnPoints[participant.id] = {
          x: x,
          y: y,
          z: mapData.startingZ || 0
        };
      });
    } else if (gameMode === 'skirmish' || gameMode === 'assault') {
      const team1Players = participants.filter(p => p.team === 'team1');
      const team2Players = participants.filter(p => p.team === 'team2');
      
      team1Players.forEach((participant, index) => {
        const spacing = mapBounds / (team1Players.length + 1);
        spawnPoints[participant.id] = {
          x: spacing * (index + 1),
          y: mapBounds / 2,
          z: mapData.startingZ || 0
        };
      });
      
      team2Players.forEach((participant, index) => {
        const spacing = mapBounds / (team2Players.length + 1);
        spawnPoints[participant.id] = {
          x: mapBounds - (spacing * (index + 1)),
          y: mapBounds / 2,
          z: mapData.startingZ || 0
        };
      });
    }
    
    return spawnPoints;
  }

  /**
   * Emergency fallback spawn points for human participants
   */
  getEmergencySpawnPoints(participants, mapData) {
    if (!this.currentMatch || !mapData) return {};
    const spawnPoints = {};
    const humanParticipants = (participants || []).filter(p => !p.isNPC);
    if (humanParticipants.length === 0) return {};

    const mapSize = this.currentMatch.mapSize;
    const tileSize = global.tileSize || 64;
    const mapBounds = mapSize * tileSize;
    const centerX = mapBounds / 2;
    const centerY = mapBounds / 2;
    const count = humanParticipants.length;
    const angleStep = (2 * Math.PI) / Math.max(1, count);
    const radius = mapBounds * 0.2;

    humanParticipants.forEach((participant, index) => {
      const angle = index * angleStep;
      spawnPoints[participant.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        z: mapData.startingZ || 0
      };
    });

    return spawnPoints;
  }

  /**
   * Begin the match
   */
  beginMatch() {
    if (!this.currentMatch) return;
    
    this.currentMatch.status = 'in_progress';
    this.currentMatch.startTime = Date.now();
    this.broadcastMatchUpdate();
    
    // Start match timer
    this.matchTimer = setTimeout(() => {
      this.endMatch({ reason: 'timeout' });
    }, this.matchDuration);
    
    // Start update interval for game mode logic
    this.startUpdateInterval();
    
    // Start elite NPC behavior updates
    if (this.eliteNPCBehavior) {
      console.log('[BG][Elite] beginMatch', {
        matchId: this.currentMatch.matchId,
        eliteNPCCount: Array.isArray(this.currentMatch.eliteNPCs) ? this.currentMatch.eliteNPCs.length : 0
      });
      this.eliteNPCBehavior.startBehaviorUpdates(this.currentMatch);
    }
    
    // Start leash monitoring for Cave/Dungeon maps
    if (this.leashManager) {
      this.leashManager.startLeashMonitoring(this.currentMatch);
    }
    
    // Start spectator system updates
    if (this.spectatorSystem) {
      this.spectatorSystem.startSpectatorUpdates(this.currentMatch.matchId);
    }
    
    // Initialize and start weather system
    if (this.weatherManager) {
      this.weatherManager.initMatchWeather(this.currentMatch.matchId);
    }
    
    // Start Assault mode spawn systems
    if (this.currentGameMode && this.currentGameMode.name === 'assault') {
      if (this.currentGameMode.startAttackerSpawns) {
        this.currentGameMode.startAttackerSpawns();
      }
    }
  }
  
  /**
   * Start update interval for game mode
   */
  startUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      if (this.currentMatch && this.currentMatch.status === 'in_progress') {
        // Check if any human players remain
        if (!this.checkActiveHumanPlayers()) {
          console.log('No active human players in match, ending match early');
          this.endMatch({
            reason: 'no_human_players',
            winner: null,
            winnerType: null,
            message: 'Match ended: No active human players'
          });
          return;
        }
        
        if (this.currentGameMode && this.currentGameMode.update) {
          this.currentGameMode.update();
        }
      }
    }, this.updateIntervalMs);
  }
  
  /**
   * Check if there are any active human players in the match
   * @returns {boolean} True if at least one human player is alive
   */
  checkActiveHumanPlayers() {
    if (!this.currentMatch) return false;
    
    const humanPlayers = this.currentMatch.participants.filter(p => !p.isNPC && p.alive);
    return humanPlayers.length > 0;
  }
  
  /**
   * Exit match for a player
   * @param {string} playerId - Player ID to exit
   */
  exitMatch(playerId) {
    if (!this.currentMatch) {
      return { success: false, message: 'No active match' };
    }
    
    // Find participant
    const participant = this.currentMatch.participants.find(p => p.id === playerId);
    if (!participant) {
      return { success: false, message: 'Player not in match' };
    }
    
    // Skip if NPC
    if (participant.isNPC) {
      return { success: false, message: 'Cannot exit NPC' };
    }
    
    // Mark participant as dead/alive=false (they're leaving)
    participant.alive = false;
    
        // Restore player to original position
        if (this.currentMatch.originalPlayerState && this.currentMatch.originalPlayerState[playerId]) {
          const player = global.Player.list[playerId];
          if (player) {
            const originalState = this.currentMatch.originalPlayerState[playerId];
            
            
            player.x = originalState.x;
            player.y = originalState.y;
            player.z = originalState.z;
            player.house = originalState.house;
            
            // CRITICAL: Clear map context using helper for consistency
            if (global.mapContextHelpers) {
              global.mapContextHelpers.setEntityContext(player, null);
            } else {
              player.inBattleground = false;
              player.battlegroundMatchId = null;
            }
            
            
            // Defensive check: ensure context is definitely cleared
            if (player.inBattleground || player.battlegroundMatchId) {
              console.warn(`[BattlegroundsMatchManager] Context not cleared for player ${playerId} on exit, forcing clear`);
              player.inBattleground = false;
              player.battlegroundMatchId = null;
            }
            
            
            // CRITICAL: Clear pathfinding state to prevent navigation issues
            if (player.path) {
              player.path = [];
            }
            if (player.targetLoc) {
              player.targetLoc = null;
            }
            if (player.target) {
              player.target = null;
            }
            
            
            // Restore inventory if it was stored
            if (originalState.inventory) {
              player.inventory = JSON.parse(JSON.stringify(originalState.inventory));
              console.log(`Restored inventory for player ${playerId} on exit`);
            }

            // Reset battleground death state for returning player
            player.inBattlegroundDead = false;
            player.alive = true;
            if (player.hp !== null && player.hp !== undefined && player.hp <= 0) {
              player.hp = player.hpMax || 100;
            }
        
        // Send position update to client
        const socket = global.SOCKET_LIST[playerId];
        if (socket) {
          // Send playerUpdate first
          socket.write(JSON.stringify({
            msg: 'playerUpdate',
            id: playerId,
            x: originalState.x,
            y: originalState.y,
            z: originalState.z,
            inBattleground: false,
            battlegroundMatchId: null
          }));
          
          // Then send init message to switch back to main world
          socket.write(JSON.stringify({
            msg: 'init',
            id: playerId,
            selfId: playerId,
            x: originalState.x,
            y: originalState.y,
            z: originalState.z,
            inBattleground: false,
            battlegroundMatchId: null,
            world: global.world || null,
            tileSize: global.tileSize || 64,
            mapSize: global.mapSize || 1024,
            pack: {
              player: [{
                id: playerId,
                x: originalState.x,
                y: originalState.y,
                z: originalState.z,
                class: player.class || 'SerfM',
                sex: player.sex || 'm',
                name: player.name || 'Player',
                hp: player.hp || player.hpMax || 100,
                hpMax: player.hpMax || 100,
                inBattleground: false,
                battlegroundMatchId: null
              }],
              arrow: [],
              item: [],
              light: [],
              building: []
            }
          }));
        }
      }
    }
    
    // Broadcast exit to other participants
    this.broadcastParticipantExit(playerId);
    
    // Check if any human players remain
    if (!this.checkActiveHumanPlayers()) {
      console.log('No active human players remaining after exit, ending match');
      this.endMatch({
        reason: 'no_human_players',
        winner: null,
        winnerType: null,
        message: 'Match ended: All human players left'
      });
    } else {
      // Update scores
      this.updateScores();
    }
    
    return { success: true, message: 'Exited match' };
  }
  
  /**
   * Broadcast participant exit to all participants
   */
  broadcastParticipantExit(playerId) {
    if (!this.currentMatch) return;
    
    const participants = this.currentMatch.participants.map(p => p.id);
    const exitedPlayer = global.Player.list[playerId];
    
    participants.forEach(id => {
      const socket = global.SOCKET_LIST[id];
      if (socket) {
        try {
          socket.write(JSON.stringify({
            msg: 'battlegroundsParticipantExit',
            matchId: this.currentMatch.matchId,
            playerId: playerId,
            playerName: exitedPlayer ? (exitedPlayer.name || exitedPlayer.class) : 'Unknown'
          }));
        } catch (e) {
          console.error(`Error broadcasting exit to participant ${id}:`, e);
        }
      }
    });
  }
  
  /**
   * Stop update interval
   */
  stopUpdateInterval() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Stop elite NPC behavior updates
    if (this.eliteNPCBehavior) {
      this.eliteNPCBehavior.stopBehaviorUpdates();
    }
    
    // Stop leash monitoring
    if (this.leashManager) {
      this.leashManager.stopLeashMonitoring();
    }
    
    // Stop spectator system updates
    if (this.spectatorSystem) {
      this.spectatorSystem.stopSpectatorUpdates();
    }
    
    // Cleanup weather for match
    if (this.weatherManager && this.currentMatch) {
      this.weatherManager.cleanupMatchWeather(this.currentMatch.matchId);
    }
  }

  /**
   * End the match
   * @param {object} endReason - Reason for ending (reason, winner, etc.)
   */
  endMatch(endReason) {
    if (!this.currentMatch) return;
    
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
    
    this.stopUpdateInterval();
    
    this.currentMatch.status = 'ending';
    this.currentMatch.endTime = Date.now();
    this.currentMatch.endReason = endReason.reason || endReason;
    this.currentMatch.winner = endReason.winner || null;
    
    // Calculate final scores
    if (this.scoreManager) {
      this.scoreManager.calculateFinalScores(this.currentMatch, endReason);
    }
    
    // Broadcast match end
    this.broadcastMatchEnd();
    
    // Start map voting (runs during post-game cooldown)
    if (this.mapVotingSystem && this.currentMatch) {
      this.mapVotingSystem.startVoting(this.currentMatch.matchId, this.currentMatch);
    }
    
    // Post-game cooldown
    setTimeout(() => {
      this.finishMatch();
    }, this.postGameCooldown);
  }

  /**
   * Finish match and cleanup
   */
  finishMatch() {
    if (!this.currentMatch) return;
    
    const matchId = this.currentMatch.matchId;
    
    // Unregister battleground map from map context manager
    if (global.mapContextManager) {
      global.mapContextManager.unregisterBattlegroundMap(matchId);
    }
    
    // Cleanup game mode
    if (this.currentGameMode && this.currentGameMode.cleanup) {
      this.currentGameMode.cleanup();
    }
    this.currentGameMode = null;
    
    // Stop update interval
    this.stopUpdateInterval();
    
    // IMPORTANT: Remove elite NPCs FIRST, before restoring player states
    // This prevents NPCs from being restored to the main world
    if (this.eliteNPCManager) {
      const eliteNPCs = this.currentMatch.eliteNPCs || [];
      
      // Also ensure all battleground NPCs are removed from Player.list
      // This is a defensive cleanup to catch any NPCs that weren't properly removed
      if (global.Player && global.Player.list) {
        for (const id in global.Player.list) {
          const entity = global.Player.list[id];
          if (entity && entity.type === 'npc' && entity.battlegroundMatchId === matchId) {
            console.log(`[BattlegroundsMatchManager] Removing stray battleground NPC ${id} during match end`);
            entity.toRemove = true;
            delete global.Player.list[id];
          }
        }
      }
      if (eliteNPCs.length > 0) {
        this.eliteNPCManager.removeEliteNPCs(eliteNPCs);
      }
      // Also clear all tracked NPCs as a safety measure
      this.eliteNPCManager.clearAll();
    }
    
    // Restore player states (only players, not NPCs)
    this.restorePlayerStates();
    
    // CRITICAL: Final defensive check - ensure all players have context cleared
    // This catches any players that might have been missed during restoration
    if (this.currentMatch && this.currentMatch.participants) {
      // #region agent log
      // #endregion
      
      this.currentMatch.participants.forEach(participant => {
        if (participant.isNPC) return; // Skip NPCs
        
        const player = global.Player.list[participant.id];
        if (player) {
          // #region agent log
          // #endregion
          
          if (player.inBattleground || player.battlegroundMatchId) {
            console.warn(`[BattlegroundsMatchManager] Player ${participant.id} still has battleground context after match end, forcing clear`);
            // #region agent log
            // #endregion
            
            if (global.mapContextHelpers) {
              global.mapContextHelpers.setEntityContext(player, null);
            } else {
              player.inBattleground = false;
              player.battlegroundMatchId = null;
            }
            
            // #region agent log
            // #endregion
            
            // Send update to client to ensure they're notified
            const socket = global.SOCKET_LIST[participant.id];
            if (socket) {
              socket.write(JSON.stringify({
                msg: 'playerUpdate',
                id: participant.id,
                inBattleground: false,
                battlegroundMatchId: null
              }));
            }
          }
        }
      });
    }
    
    // Cleanup temporary Houses
    if (this.houseManager) {
      this.houseManager.cleanupBattlegroundHouses(this.currentMatch);
    }
    
    // Save statistics
    if (this.scoreManager) {
      this.scoreManager.saveMatchStatistics(this.currentMatch);
    }
    
    // Notify callback
    if (this.onMatchEndCallback) {
      this.onMatchEndCallback(this.currentMatch);
    }
    
    // Store match reference before resetting
    const finishedMatch = { ...this.currentMatch };
    
    // Cleanup voting system (after a delay to allow voting to complete)
    // Voting runs during post-game cooldown, so cleanup happens after that
    setTimeout(() => {
      if (this.mapVotingSystem) {
        this.mapVotingSystem.cleanup(finishedMatch.matchId);
      }
    }, this.postGameCooldown + 1000); // Cleanup 1 second after post-game cooldown
    
    // Reset match
    this.currentMatch = null;
    
    return finishedMatch;
  }

  /**
   * Restore original player states
   */
  restorePlayerStates() {
    if (!this.currentMatch || !this.currentMatch.originalPlayerState) return;
    
    Object.keys(this.currentMatch.originalPlayerState).forEach(playerId => {
      const player = global.Player.list[playerId];
      if (!player) return;
      
      // Skip NPCs - they should have been removed already
      // Check if this is a battleground NPC by looking at participants list
      const participant = this.currentMatch.participants.find(p => p.id === playerId);
      if (participant && participant.isNPC) {
        // This is a battleground NPC - it should have been removed, skip restoration
        console.warn(`Skipping restore for NPC ${playerId} (${player.name || player.class}) - should have been removed`);
        return;
      }
      
      // Also check if player type is NPC (safety check)
      if (player.type === 'npc' && player.battlegroundMatchId === this.currentMatch.matchId) {
        // This is a battleground NPC that wasn't in participants list - remove it
        console.warn(`Removing stray battleground NPC ${playerId} during state restoration`);
        player.toRemove = true;
        delete global.Player.list[playerId];
        return;
      }
      
      const originalState = this.currentMatch.originalPlayerState[playerId];
      if (!originalState) {
        console.warn(`No original state found for player ${playerId}, skipping restoration`);
        return;
      }
      
      console.log(`Restoring player ${playerId} to original position: x=${originalState.x}, y=${originalState.y}, z=${originalState.z}, house=${originalState.house}`);
      
      // #region agent log
      // #endregion
      
      player.x = originalState.x;
      player.y = originalState.y;
      player.z = originalState.z;
      player.house = originalState.house;
      
      // CRITICAL: Clear map context using helper for consistency
      // Also ensure it's definitely cleared (defensive check)
      if (global.mapContextHelpers) {
        global.mapContextHelpers.setEntityContext(player, null);
      } else {
      player.inBattleground = false;
      player.battlegroundMatchId = null;
      }
      
      // #region agent log
      // #endregion
      
      // Defensive check: ensure context is definitely cleared
      if (player.inBattleground || player.battlegroundMatchId) {
        console.warn(`[BattlegroundsMatchManager] Context not cleared for player ${playerId}, forcing clear`);
        // #region agent log
        // #endregion
        player.inBattleground = false;
        player.battlegroundMatchId = null;
      }
      
      // #region agent log
      // #endregion
      
      // CRITICAL: Clear pathfinding state to prevent navigation issues
      if (player.path) {
        player.path = [];
      }
      if (player.targetLoc) {
        player.targetLoc = null;
      }
      if (player.target) {
        player.target = null;
      }
      
      // #region agent log
      // #endregion
      
      // Restore inventory if it was stored
      if (originalState.inventory) {
        player.inventory = JSON.parse(JSON.stringify(originalState.inventory));
        console.log(`Restored inventory for player ${playerId}`);
      }

      // Reset battleground death state when restoring to main world
      player.inBattlegroundDead = false;
      player.alive = true;
      if (player.hp !== null && player.hp !== undefined && player.hp <= 0) {
        player.hp = player.hpMax || 100;
      }
      
      // Send position update to client so they're teleported back correctly
      // Find socket by player ID
      let socket = null;
      if (global.SOCKET_LIST) {
        socket = global.SOCKET_LIST[playerId];
      }
      // Fallback: try to find socket from player object
      if (!socket && player.socket) {
        socket = player.socket;
      }
      
      if (socket) {
        // Send playerUpdate first to update position
        socket.write(JSON.stringify({
          msg: 'playerUpdate',
          id: playerId,
          x: originalState.x,
          y: originalState.y,
          z: originalState.z,
          inBattleground: false,
          battlegroundMatchId: null
        }));
        
        // Collect visible entities around restored position to refresh client view
        // Include entities from all z levels the player might access (z-1 to z+1)
        const viewDistance = 2000; // Same as normal view distance
        const visibleItems = [];
        const visibleBuildings = [];
        const visibleLights = [];
        
        // Collect items from multiple z levels (original z, z-1, z+1)
        const zLevelsToCheck = [originalState.z];
        if (originalState.z > -3) zLevelsToCheck.push(originalState.z - 1);
        if (originalState.z < 3) zLevelsToCheck.push(originalState.z + 1);
        
        if (global.Item && global.Item.list) {
          let itemsChecked = 0;
          let itemsInContext = 0;
          let itemsOutOfContext = 0;
          for (const itemId in global.Item.list) {
            const item = global.Item.list[itemId];
            if (item && !item.toRemove && zLevelsToCheck.includes(item.z)) {
              itemsChecked++;
              // CRITICAL: Check map context - only include items in same context as player
              const itemInBG = !!(item.inBattleground && item.battlegroundMatchId);
              const playerInBG = !!(player.inBattleground && player.battlegroundMatchId);
              const sameContext = (itemInBG && playerInBG && item.battlegroundMatchId === player.battlegroundMatchId) ||
                                  (!itemInBG && !playerInBG);
              
              if (!sameContext) {
                itemsOutOfContext++;
                continue; // Skip items from different map context
              }
              itemsInContext++;
              
              const distance = Math.sqrt(
                Math.pow(item.x - originalState.x, 2) + 
                Math.pow(item.y - originalState.y, 2)
              );
              if (distance <= viewDistance && item.getInitPack) {
                visibleItems.push(item.getInitPack());
              }
            }
          }
          // #region agent log
          // #endregion
        }
        
        // Collect buildings from multiple z levels
        if (global.Building && global.Building.list) {
          let buildingsChecked = 0;
          let buildingsInContext = 0;
          let buildingsOutOfContext = 0;
          for (const buildingId in global.Building.list) {
            const building = global.Building.list[buildingId];
            if (building && !building.toRemove && zLevelsToCheck.includes(building.z)) {
              buildingsChecked++;
              // CRITICAL: Check map context - only include buildings in same context as player
              const buildingInBG = !!(building.inBattleground && building.battlegroundMatchId);
              const playerInBG = !!(player.inBattleground && player.battlegroundMatchId);
              const sameContext = (buildingInBG && playerInBG && building.battlegroundMatchId === player.battlegroundMatchId) ||
                                  (!buildingInBG && !playerInBG);
              
              if (!sameContext) {
                buildingsOutOfContext++;
                continue; // Skip buildings from different map context
              }
              buildingsInContext++;
              
              const distance = Math.sqrt(
                Math.pow(building.x - originalState.x, 2) + 
                Math.pow(building.y - originalState.y, 2)
              );
              if (distance <= viewDistance && building.getInitPack) {
                visibleBuildings.push(building.getInitPack());
              }
            }
          }
          // #region agent log
          // #endregion
        }
        
        // Collect lights from multiple z levels
        if (global.Light && global.Light.list) {
          let lightsChecked = 0;
          let lightsInContext = 0;
          let lightsOutOfContext = 0;
          for (const lightId in global.Light.list) {
            const light = global.Light.list[lightId];
            if (light && !light.toRemove && zLevelsToCheck.includes(light.z)) {
              lightsChecked++;
              // CRITICAL: Check map context - only include lights in same context as player
              const lightInBG = !!(light.inBattleground && light.battlegroundMatchId);
              const playerInBG = !!(player.inBattleground && player.battlegroundMatchId);
              const sameContext = (lightInBG && playerInBG && light.battlegroundMatchId === player.battlegroundMatchId) ||
                                  (!lightInBG && !playerInBG);
              
              if (!sameContext) {
                lightsOutOfContext++;
                continue; // Skip lights from different map context
              }
              lightsInContext++;
              
              const distance = Math.sqrt(
                Math.pow(light.x - originalState.x, 2) + 
                Math.pow(light.y - originalState.y, 2)
              );
              if (distance <= viewDistance && light.getInitPack) {
                visibleLights.push(light.getInitPack());
              }
            }
          }
          // #region agent log
          // #endregion
        }
        
        // CRITICAL: Mark items for update so they're included in subsequent update packets
        // Items without toUpdate=true won't be included in Item.update() packets
        let itemsMarked = 0;
        visibleItems.forEach(itemPack => {
          if (itemPack && itemPack.id && global.Item && global.Item.list) {
            const item = global.Item.list[itemPack.id];
            if (item) {
              item.toUpdate = true;
              itemsMarked++;
            }
          }
        });
        
        // #region agent log
        // #endregion
        
        // #region agent log
        // #endregion
        
        // Then send init message to switch back to main world context
        // Include main world data and visible entities so client can refresh view
        socket.write(JSON.stringify({
          msg: 'init',
          id: playerId,
          selfId: playerId,
          x: originalState.x,
          y: originalState.y,
          z: originalState.z,
          inBattleground: false,
          battlegroundMatchId: null,
          // Include main world data for context switch
          world: global.world || null,
          tileSize: global.tileSize || 64,
          mapSize: global.mapSize || 1024,
          pack: {
            player: [{
              id: playerId,
              x: originalState.x,
              y: originalState.y,
              z: originalState.z,
              class: player.class || 'SerfM',
              sex: player.sex || 'm',
              name: player.name || 'Player',
              hp: player.hp || player.hpMax || 100,
              hpMax: player.hpMax || 100,
              inBattleground: false,
              battlegroundMatchId: null
            }],
            item: visibleItems, // CRITICAL: Include visible items in init pack
            arrow: [],
            light: visibleLights,
            building: visibleBuildings
          }
        }));
      } else {
        console.warn(`Could not find socket for player ${playerId} to send position restoration`);
      }
    });
  }

  /**
   * Broadcast match update to all participants
   */
  broadcastMatchUpdate() {
    if (!this.currentMatch) return;
    
    const participants = this.currentMatch.participants.map(p => p.id);
    const matchData = {
      matchId: this.currentMatch.matchId,
      gameMode: this.currentMatch.gameMode,
      status: this.currentMatch.status,
      mapType: this.currentMatch.mapType,
      mapSize: this.currentMatch.mapSize,
      startTime: this.currentMatch.startTime,
      endTime: this.currentMatch.endTime,
      scores: this.currentMatch.scores,
      participants: this.currentMatch.participants, // Include participants for lobby display
      countdownTimer: this.currentMatch.countdownTimer || 0
    };
    
    participants.forEach(playerId => {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'battlegroundsMatchUpdate',
          match: matchData
        }));
      }
    });
  }

  /**
   * Broadcast map preview
   */
  broadcastMapPreview() {
    if (!this.currentMatch) return;
    
    // Calculate spawn points for preview
    let spawnPoints = {};
    if (this.currentGameMode && this.currentGameMode.getSpawnPoints) {
      try {
        spawnPoints = this.currentGameMode.getSpawnPoints();
      } catch (e) {
        console.error('Error getting spawn points for preview:', e);
      }
    }
    
    const participants = this.currentMatch.participants.map(p => p.id);
    const previewData = {
      mapType: this.currentMatch.mapType,
      mapSize: this.currentMatch.mapSize,
      mapData: this.currentMatch.mapData,
      gameMode: this.currentMatch.gameMode,
      teams: this.currentMatch.teams,
      spawnPoints: spawnPoints // Include spawn points for preview rendering
    };
    
    participants.forEach(playerId => {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'battlegroundsMapPreview',
          preview: previewData
        }));
      }
    });
  }

  /**
   * Broadcast spawn update
   */
  broadcastSpawnUpdate() {
    if (!this.currentMatch) return;
    
    // Send init pack update with new positions
    const participants = this.currentMatch.participants.map(p => p.id);
    
    participants.forEach(playerId => {
      const socket = global.SOCKET_LIST[playerId];
      const player = global.Player.list[playerId];
      if (socket && player) {
        socket.write(JSON.stringify({
          msg: 'playerUpdate',
          id: playerId,
          x: player.x,
          y: player.y,
          z: player.z,
          house: player.house,
          inBattleground: true
        }));
      }
    });
  }

  /**
   * Broadcast match end
   */
  broadcastMatchEnd() {
    if (!this.currentMatch) return;
    
    const participants = this.currentMatch.participants.map(p => p.id);
    const endData = {
      matchId: this.currentMatch.matchId,
      reason: this.currentMatch.endReason,
      scores: this.currentMatch.scores,
      winner: this.currentMatch.winner
    };
    
    participants.forEach(playerId => {
      const socket = global.SOCKET_LIST[playerId];
      if (socket) {
        socket.write(JSON.stringify({
          msg: 'battlegroundsMatchEnd',
          endData: endData
        }));
      }
    });
  }

  /**
   * Check match win condition (delegates to game mode)
   */
  checkWinCondition() {
    if (!this.currentMatch || this.currentMatch.status !== 'in_progress') {
      return null;
    }
    
    if (this.currentGameMode && this.currentGameMode.checkWinCondition) {
      return this.currentGameMode.checkWinCondition();
    }
    
    return null;
  }

  /**
   * Handle player death (delegates to game mode)
   * @deprecated Use handleParticipantDeath instead
   */
  handlePlayerDeath(playerId, killerId) {
    return this.handleParticipantDeath(playerId, killerId);
  }

  /**
   * Update scores
   */
  updateScores() {
    if (!this.currentMatch) return;
    
    this.currentMatch.scores = {};
    this.currentMatch.participants.forEach(participant => {
      this.currentMatch.scores[participant.id] = {
        kills: participant.kills,
        deaths: participant.deaths,
        alive: participant.alive
      };
    });
    
    this.broadcastMatchUpdate();
  }

  /**
   * Get current match state
   */
  getMatchState() {
    return this.currentMatch;
  }

  /**
   * Get match by match ID
   */
  getMatch(matchId) {
    if (this.currentMatch && this.currentMatch.matchId === matchId) {
      return this.currentMatch;
    }
    return null;
  }

  /**
   * Check if player is in a match
   */
  isPlayerInMatch(playerId) {
    if (!this.currentMatch) return false;
    return this.currentMatch.participants.some(p => p.id === playerId);
  }

  /**
   * Handle participant death in battleground
   * Called from lambic.js when a player dies
   */
  handleParticipantDeath(playerId, killerId) {
    if (!this.currentMatch || this.currentMatch.status !== 'in_progress') {
      return;
    }
    
    // Find participant
    const participant = this.currentMatch.participants.find(p => p.id === playerId);
    if (!participant) return; // Not a participant (maybe an NPC)
    
    // Check if already dead
    if (!participant.alive) return;
    
    // Mark as dead
    participant.alive = false;
    participant.deaths = (participant.deaths || 0) + 1;
    
    // Track kill for killer
    if (killerId) {
      const killer = this.currentMatch.participants.find(p => p.id === killerId);
      if (killer && killer.alive) {
        killer.kills = (killer.kills || 0) + 1;
        
        // Update score manager
        if (this.scoreManager) {
          this.scoreManager.recordKill(this.currentMatch.matchId, killerId, playerId);
        }
      }
    }
    
    // Notify game mode of death
    if (this.currentGameMode && this.currentGameMode.onParticipantDeath) {
      this.currentGameMode.onParticipantDeath(playerId, killerId);
    }
    
    // Check win condition (game mode will handle this, but we check here as well)
    if (this.currentGameMode && this.currentGameMode.checkWinCondition) {
      const winCondition = this.currentGameMode.checkWinCondition();
      if (winCondition) {
        this.endMatch(winCondition);
        return; // Match ended, no need to continue
      }
    }
    
    // Update scores
    this.updateScores();
    
    // Broadcast death update to participants
    this.broadcastParticipantDeath(playerId, killerId);
    
    // Enable spectator mode for dead player (only if player, not NPC)
    if (!participant.isNPC) {
      this.enableSpectatingForDeadPlayer(playerId);
    }
  }

  /**
   * Broadcast participant death to all participants
   */
  broadcastParticipantDeath(playerId, killerId) {
    if (!this.currentMatch) return;
    
    const participants = this.currentMatch.participants.map(p => p.id);
    const deadPlayer = global.Player.list[playerId];
    const killer = killerId ? global.Player.list[killerId] : null;
    
    participants.forEach(id => {
      const socket = global.SOCKET_LIST[id];
      if (socket) {
        try {
          socket.write(JSON.stringify({
            msg: 'battlegroundsParticipantDeath',
            matchId: this.currentMatch.matchId,
            playerId: playerId,
            playerName: deadPlayer ? (deadPlayer.name || deadPlayer.class) : 'Unknown',
            killerId: killerId,
            killerName: killer ? (killer.name || killer.class) : null
          }));
        } catch (e) {
          console.error(`Error broadcasting death to participant ${id}:`, e);
        }
      }
    });
  }

  /**
   * Enable spectating for a dead player
   */
  enableSpectatingForDeadPlayer(playerId) {
    if (!this.currentMatch) return false;
    
    const participant = this.currentMatch.participants.find(p => p.id === playerId);
    if (!participant || participant.alive) {
      return false; // Player not in match or still alive
    }
    
    // Use spectator system to enable spectator mode
    if (this.spectatorSystem) {
      return this.spectatorSystem.enableSpectatorMode(playerId, this.currentMatch.matchId);
    }
    
    return false;
  }

  /**
   * Set dependencies
   */
  setMapGenerator(generator) {
    this.mapGenerator = generator;
  }

  setHouseManager(manager) {
    this.houseManager = manager;
  }

  setEliteNPCManager(manager) {
    this.eliteNPCManager = manager;
  }

  setScoreManager(manager) {
    this.scoreManager = manager;
  }

  setWeatherManager(manager) {
    this.weatherManager = manager;
  }

  setMapLibrary(library) {
    this.mapLibrary = library;
  }

  setMatchEndCallback(callback) {
    this.onMatchEndCallback = callback;
  }
}

module.exports = BattlegroundsMatchManager;


