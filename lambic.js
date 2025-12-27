/////////////////////////////////////////////////////////////////////////
//                                                                     //
//                      ♜ S T R O N G H O D L ♜                       //
//                                                                     //
//      A   S O L I S   O R T V   V S Q V E   A D   O C C A S V M      //
//                                                                     //
//                      A game by Johan Argan                          //
//                                                                     //
/////////////////////////////////////////////////////////////////////////

const fs = require('fs').promises;
const fsSync = require('fs');
const PF = require('pathfinding');
const express = require('express');
const sockjs = require('sockjs');

// Helper function to check if a destination is a doorway (must be defined before Entity.js)
function isDoorwayDestination(x, y, z) {
  if (z !== 0) return false;
  // Use a simple check that doesn't depend on other functions
  if (typeof global.tilemapSystem !== 'undefined') {
    const tile = global.tilemapSystem.getTile(0, x, y);
    return tile === 55 || tile === 56; // TERRAIN.DOOR_OPEN and TERRAIN.DOOR_OPEN_ALT values
  }
  return false;
}

// Make isDoorwayDestination available globally
global.isDoorwayDestination = isDoorwayDestination;

// Import modules
require('./server/js/Database');
require('./server/js/Entity');
require('./server/js/Inventory');
require('./server/js/Commands');
require('./server/js/Equip');
require('./server/js/Houses');
require('./server/js/Dialogue');
require('./server/js/Inspect');
require('./server/js/Build');
require('./server/js/Interact');
require('./server/js/Econ');

// Import blockchain modules
const LambicBlockchain = require('./server/js/blockchain/Blockchain');
const P2PNetwork = require('./server/js/blockchain/P2PNetwork');
const MiningManager = require('./server/js/blockchain/MiningManager');
const WalletManager = require('./server/js/blockchain/WalletManager');
const BalanceSync = require('./server/js/blockchain/BalanceSync');
const BlockchainStorage = require('./server/js/blockchain/BlockchainStorage');
const GoldTradeManager = require('./server/js/blockchain/GoldTradeManager');
const NetworkConfig = require('./server/js/blockchain/NetworkConfig');

// Modular entity loading happens later after all globals are defined
// See line ~1450 for initModularEntities() call

// ============================================================================
// CONSTANTS
// ============================================================================

const TERRAIN = {
  WATER: 0,
  HEAVY_FOREST: 1,
  LIGHT_FOREST: 2,
  BRUSH: 3,
  ROCKS: 4,
  MOUNTAIN: 5,
  CAVE_ENTRANCE: 6,
  EMPTY: 7,
  FARM_SEED: 8,
  FARM_GROWING: 9,
  FARM_READY: 10,
  BUILD_MARKER: 11,
  BUILD_MARKER_ALT: 11.5,
  DOOR_OPEN: 14,
  DOOR_OPEN_ALT: 16,
  ROAD: 18,
  DOOR_LOCKED: 19
};

const Z_LEVELS = {
  UNDERWATER: -3,
  CELLAR: -2,
  UNDERWORLD: -1,
  OVERWORLD: 0,
  BUILDING_1: 1,
  BUILDING_2: 2,
  SHIP: 3
};

// Expose constants globally immediately so they're available to modules
global.TERRAIN = TERRAIN;
global.Z_LEVELS = Z_LEVELS;

// Helper function to check if terrain is a large rock (resource-carrying)
// Large rocks have values > TERRAIN.ROCKS (4) && < TERRAIN.MOUNTAIN (5)
function isLargeRock(terrain) {
  return terrain > TERRAIN.ROCKS && terrain < TERRAIN.MOUNTAIN;
}
global.isLargeRock = isLargeRock;

const TILE_SIZE = 64;
const FACTION_IDS = {
  BROTHERHOOD: 1,
  GOTHS: 2,
  NORSEMEN: 3,
  FRANKS: 4,
  CELTS: 5,
  TEUTONS: 6,
  OUTLAWS: 7,
  MERCENARIES: 8
};

// ============================================================================
// INTERACTABLE SYSTEM CONFIGURATION
// ============================================================================

// Centralized lists of interactable building and object types
// To add new interactables, simply add to these arrays
const INTERACTABLE_BUILDING_TYPES = ['dock', 'mill', 'mine', 'lumbermill', 'stable', 'tavern', 'market', 'monastery'];
const INTERACTABLE_OBJECT_TYPES = ['Goods1', 'Goods2', 'Goods3', 'Goods4', 'Desk', 'Chest', 'LockedChest'];

// Helper functions to check if an entity is interactable
function isInteractableBuilding(building) {
  if (!building) return false;
  // Check for dynamic interactable property first
  if (building.interactable === true) return true;
  // Check if building type is in the interactable list
  return INTERACTABLE_BUILDING_TYPES.indexOf(building.type) !== -1;
}

function isInteractableObject(item) {
  if (!item) return false;
  // Check for dynamic interactable property first
  if (item.interactable === true) return true;
  // Check if item type is in the interactable list
  return INTERACTABLE_OBJECT_TYPES.indexOf(item.type) !== -1;
}

// ============================================================================
// INITIALIZE GAME
// ============================================================================

// Import new modular systems
const { gameState } = require('./server/js/core/GameState.js');
const { CommandHandler } = require('./server/js/commands/CommandHandler.js');
const { itemFactory } = require('./server/js/entities/ItemFactory.js');
const OptimizedGameLoop = require('./server/js/core/OptimizedGameLoop.js');
const SimpleCombat = require('./server/js/core/SimpleCombat.js');
const { TilemapIntegration } = require('./server/js/core/TilemapIntegration.js');
const BuildingConstruction = require('./server/js/core/BuildingConstruction.js');

// Import new registry systems (Phase 1: Foundation)
const systemRegistry = require('./server/js/core/SystemRegistry.js');
const dependencyInjector = require('./server/js/core/DependencyInjector.js');
const entityRegistry = require('./server/js/core/EntityRegistry.js');

// Import CLI for map generation
const MapGenerationCLI = require('./server/js/core/MapGenerationCLI');
const genesis = require('./server/js/genesis');

// Initialize world asynchronously with CLI
let world = null;
let caveEntrances = [];

// Declare io early so it can be checked before initialization
let io = null;

async function initializeWorld() {
  try {
    // Run CLI to get user selections and generate map
    const result = await MapGenerationCLI.run();
    
    world = result.worldMaps;
    caveEntrances = result.entrances || [];
    global.caveEntrances = caveEntrances;
    gameState.initializeWorld(world);
  } catch (error) {
    console.error('Error initializing world:', error);
    process.exit(1);
  }
}

// initializeWorld() call moved to after SockJS setup (see line ~6246)

function continueServerInitialization() {
  // Load and register all commands from individual files (after user input is collected)
  loadCommands();
  
  // Register legacy EvalCmd handler for backward compatibility (if available)
  if (typeof EvalCmd === 'function') {
    registerLegacyHandler(EvalCmd);
  }
  
  // Initialize consolidated tilemap system
  const tilemapIntegration = new TilemapIntegration();
  tilemapIntegration.initializeFromWorldArray(world, gameState.mapSize);
  global.tilemapSystem = tilemapIntegration;

  // Register tilemap system in registry
  systemRegistry.register('tilemap', tilemapIntegration, { 
    dependsOn: ['gameState'], 
    priority: 2 
  });

  // Initialize map analyzer for AI faction placement
  const MapAnalyzer = require('./server/js/ai/MapAnalyzer');
  const ZoneManager = require('./server/js/core/ZoneManager');

  // Expose basic constants/globals needed by other modules (backward compatibility)
  global.TERRAIN = TERRAIN;
  global.Z_LEVELS = Z_LEVELS;
  global.tileSize = gameState.tileSize;
  global.mapSize = gameState.mapSize;
  global.mapPx = gameState.mapPx;
  global.period = gameState.period;

  // NOW initialize MapAnalyzer after globals are set
  const mapAnalyzer = new MapAnalyzer();
  global.mapAnalyzer = mapAnalyzer;

  // Register mapAnalyzer in registry
  systemRegistry.register('mapAnalyzer', mapAnalyzer, { 
    dependsOn: ['tilemap'], 
    priority: 3 
  });

  // Initialize terrain segmentation and zone management
  const geographicFeatures = mapAnalyzer.analyzeGeography(world[0]);

  const zoneManager = new ZoneManager();
  zoneManager.addGeographicFeatures(geographicFeatures);
  global.zoneManager = zoneManager;

  // Register zoneManager in registry
  systemRegistry.register('zoneManager', zoneManager, { 
    dependsOn: ['mapAnalyzer'], 
    priority: 4 
  });

  // ============================================================================
  // INITIALIZE ZONES
  // ============================================================================

  // Zones are now managed by the tilemap system
  // The tilemap system automatically handles spatial partitioning
  zones = global.tilemapSystem.tilemapSystem.zones;
  global.zones = zones;

  // ============================================================================
  // INITIALIZE BIOMES AND SPAWN POINTS
  // ============================================================================

  // Spawn points are now managed by the tilemap system
  // Get them from the consolidated system
  spawnPointsO = global.tilemapSystem.getSpawnPoints('overworld');
  spawnPointsU = global.tilemapSystem.getSpawnPoints('underworld');
  waterSpawns = global.tilemapSystem.getSpawnPoints('water');
  hForestSpawns = global.tilemapSystem.getSpawnPoints('heavyForest');
  mtnSpawns = global.tilemapSystem.getSpawnPoints('mountains');
  caveEntrances = global.tilemapSystem.getSpawnPoints('caveEntrances');

  // Update biome counts
  biomes.hForest = hForestSpawns.length;
  biomes.mtn = mtnSpawns.length;
  biomes.water = waterSpawns.length;
  biomes.forest = 0; // Will be calculated separately if needed
  biomes.brush = 0;  // Will be calculated separately if needed
  biomes.rocks = 0;  // Will be calculated separately if needed

  // Load modular entity definitions NOW (after all globals including zones are available)
  if(typeof global.initModularEntities === 'function'){
    global.initModularEntities();
  }

  // Initialize pathfinding matrices (must be after world is initialized)
  matrixO = pathing(0);
  matrixU = pathing(-1);
  matrixB1 = pathing(1);  // Building floor 1
  matrixB2 = pathing(2);  // Building floor 2
  matrixB3 = pathing(-2); // Cellar
  matrixW = pathing(-3);
  matrixS = pathing(3);
  
  // Make matrices globally available
  global.matrixO = matrixO;
  global.matrixU = matrixU;
  global.matrixB1 = matrixB1;
  global.matrixB2 = matrixB2;
  global.matrixB3 = matrixB3;
  global.matrixW = matrixW;
  global.matrixS = matrixS;

  // Create pathfinding grids (assign to module-level variables)
  gridO = new PF.Grid(matrixO);
  gridU = new PF.Grid(matrixU);
  gridB1 = new PF.Grid(matrixB1);
  gridB2 = new PF.Grid(matrixB2);
  gridB3 = new PF.Grid(matrixB3);
  gridW = new PF.Grid(matrixW);
  gridS = new PF.Grid(matrixS);

  // Make grids globally available
  global.gridO = gridO;
  global.gridU = gridU;
  global.gridB1 = gridB1;
  global.gridB2 = gridB2;
  global.gridB3 = gridB3;
  global.gridW = gridW;
  global.gridS = gridS;

  // Initialize day/night cycle and other game loops
  // Initiate day/night cycle
  setInterval(dayNight, 3600000 / gameState.period);

  // Weather update (every 60 ticks = 1 second at 60 FPS)
  setInterval(function() {
    updateWeather(gameState.tempus);
  }, 1000); // Every second

  // Initialize tempus
  tempus = gameState.tempus;

  // Spawn initial fauna
  entropy();

  // Hide relics
  const rel1 = randomSpawnHF();
  const cr1 = getLoc(rel1[0], rel1[1]);
  Relic({ x: rel1[0], y: rel1[1], z: 0, qty: 1 });

  const rel2 = randomSpawnU();
  const cr2 = getLoc(rel2[0], rel2[1]);
  Relic({ x: rel2[0], y: rel2[1], z: -1, qty: 1 });

  const wsp = waterSpawns[Math.floor(Math.random() * waterSpawns.length)];
  const rel3 = getCoords(wsp[0], wsp[1]);
  Relic({ x: rel3[0], y: rel3[1], z: -3, qty: 1 });

  // Create NPC factions using MapAnalyzer for optimal placement
  const excludedHQs = []; // Track placed HQs to ensure spacing

  // Store faction HQs globally for god mode cycling
  global.factionHQs = [];

  const brotherhoodHQ = global.mapAnalyzer.findFactionHQ('Brotherhood', excludedHQs);
  if (brotherhoodHQ) {
    excludedHQs.push(brotherhoodHQ.tile);
    Brotherhood({ id: FACTION_IDS.BROTHERHOOD, type: 'npc', name: 'Brotherhood', flag: '', hq: brotherhoodHQ.tile, hostile: true });
  }

  const gothsHQ = global.mapAnalyzer.findFactionHQ('Goths', excludedHQs);
  if (gothsHQ) {
    excludedHQs.push(gothsHQ.tile);
    Goths({ id: FACTION_IDS.GOTHS, type: 'npc', name: 'Goths', flag: '', hq: gothsHQ.tile, hostile: true });
  }

  const norsemenHQ = global.mapAnalyzer.findFactionHQ('Norsemen', excludedHQs);
  if (norsemenHQ) {
    excludedHQs.push(norsemenHQ.tile);
    Norsemen({ id: FACTION_IDS.NORSEMEN, type: 'npc', name: 'Norsemen', flag: '', hq: norsemenHQ.tile, hostile: true });
  }

  const franksHQ = global.mapAnalyzer.findFactionHQ('Franks', excludedHQs);
  if (franksHQ) {
    excludedHQs.push(franksHQ.tile);
    Franks({ id: FACTION_IDS.FRANKS, type: 'npc', name: 'Franks', flag: '', hq: franksHQ.tile, hostile: true });
  }

  const celtsHQ = global.mapAnalyzer.findFactionHQ('Celts', excludedHQs);
  if (celtsHQ) {
    excludedHQs.push(celtsHQ.tile);
    Celts({ id: FACTION_IDS.CELTS, type: 'npc', name: 'Celts', flag: '', hq: celtsHQ.tile, hostile: true });
  }

  const teutonsHQ = global.mapAnalyzer.findFactionHQ('Teutons', excludedHQs);
  if (teutonsHQ) {
    excludedHQs.push(teutonsHQ.tile);
    Teutons({ id: FACTION_IDS.TEUTONS, type: 'npc', name: 'Teutons', flag: '', hq: teutonsHQ.tile, hostile: true });
  }

  // Spawn Outlaws - keep spawning until no more valid locations with 50-tile spacing
  let outlawCount = 0;
  let maxOutlawAttempts = 50; // Safety limit to prevent infinite loop
  let consecutiveFailures = 0;

  while (consecutiveFailures < 3 && outlawCount < maxOutlawAttempts) {
    const outlawsHQ = global.mapAnalyzer.findFactionHQ('Outlaws', excludedHQs);
    if (outlawsHQ) {
      excludedHQs.push(outlawsHQ.tile);
      outlawCount++;
      consecutiveFailures = 0; // Reset failure counter on success
      
      Outlaws({ 
        id: FACTION_IDS.OUTLAWS + outlawCount - 1, // Use different IDs for each group
        type: 'npc', 
        name: `Outlaws ${outlawCount}`, // Name them Outlaws 1, Outlaws 2, etc.
        flag: '', 
        hq: outlawsHQ.tile, 
        hostile: true 
      });
      
      // Track for godmode
      const coords = getCenter(outlawsHQ.tile[0], outlawsHQ.tile[1]);
      global.factionHQs.push({ name: `Outlaws ${outlawCount}`, x: coords[0], y: coords[1], z: 0 });
    } else {
      consecutiveFailures++;
    }
  }

  // Spawn Mercenaries - keep spawning until no more valid locations with 50-tile spacing (same as Outlaws)
  let mercenariesCount = 0;
  let maxMercenariesAttempts = 50; // Safety limit to prevent infinite loop
  let mercenariesConsecutiveFailures = 0;

  while (mercenariesConsecutiveFailures < 3 && mercenariesCount < maxMercenariesAttempts) {
    const mercenariesHQ = global.mapAnalyzer.findFactionHQ('Mercenaries', excludedHQs);
    if (mercenariesHQ) {
      excludedHQs.push(mercenariesHQ.tile);
      mercenariesCount++;
      mercenariesConsecutiveFailures = 0; // Reset failure counter on success
      
      Mercenaries({ 
        id: FACTION_IDS.MERCENARIES + mercenariesCount - 1, // Use different IDs for each group
        type: 'npc', 
        name: `Mercenaries ${mercenariesCount}`, // Name them Mercenaries 1, Mercenaries 2, etc.
        flag: '', 
        hq: mercenariesHQ.tile, 
        hostile: true 
      });
      
      // Track for godmode
      const coords = getCenter(mercenariesHQ.tile[0], mercenariesHQ.tile[1]);
      global.factionHQs.push({ name: `Mercenaries ${mercenariesCount}`, x: coords[0], y: coords[1], z: -1 });
    } else {
      mercenariesConsecutiveFailures++;
    }
  }

  Kingdom({ id: 1, name: 'Papal States', flag: '🇻🇦' });

  if(brotherhoodHQ) {
    const coords = getCenter(brotherhoodHQ.tile[0], brotherhoodHQ.tile[1]);
    global.factionHQs.push({ name: 'Brotherhood', x: coords[0], y: coords[1], z: -1 });
  }
  if(gothsHQ) {
    const coords = getCenter(gothsHQ.tile[0], gothsHQ.tile[1]);
    global.factionHQs.push({ name: 'Goths', x: coords[0], y: coords[1], z: 0 });
  }
  if(norsemenHQ) {
    const coords = getCenter(norsemenHQ.tile[0], norsemenHQ.tile[1]);
    global.factionHQs.push({ name: 'Norsemen', x: coords[0], y: coords[1], z: 0 });
  }
  if(franksHQ) {
    const coords = getCenter(franksHQ.tile[0], franksHQ.tile[1]);
    global.factionHQs.push({ name: 'Franks', x: coords[0], y: coords[1], z: 0 });
  }
  if(celtsHQ) {
    const coords = getCenter(celtsHQ.tile[0], celtsHQ.tile[1]);
    global.factionHQs.push({ name: 'Celts', x: coords[0], y: coords[1], z: 0 });
  }
  if(teutonsHQ) {
    const coords = getCenter(teutonsHQ.tile[0], teutonsHQ.tile[1]);
    global.factionHQs.push({ name: 'Teutons', x: coords[0], y: coords[1], z: 0 });
  }
  // Mercenaries HQs are already tracked in the spawn loop above

  dailyTally();

  // Perform system audit after all systems are initialized
  const auditResults = performSystemAudit();

  // Exit if critical issues found
  if (!auditResults.allValid) {
    console.error('\n❌ CRITICAL: System initialization failed due to missing dependencies!');
    console.error('The server will continue, but some systems may not work correctly.\n');
  }

  // Additional startup validation
  const criticalValidation = validateCriticalSystems();
  if (!criticalValidation) {
    console.error('\n❌ CRITICAL: Critical system validation failed!');
    console.error('Server may not function correctly.\n');
  }
}

// Note: isDoorwayDestination is already defined globally at the top of the file
global.day = gameState.day;
global.tick = gameState.tick;
global.tempus = gameState.tempus;
global.nightfall = gameState.nightfall;

// Initialize guest spectator counter for auto-generated guest names
global.guestSpectatorCounter = 0;

// Removed speed multiplier - just use baseSpd directly

// Expose the new modular systems globally
global.gameState = gameState;
global.itemFactory = itemFactory;

// Register gameState in system registry (priority 0 - foundational system)
// Many systems depend on gameState, so it must be registered early
systemRegistry.register('gameState', gameState, { priority: 0 });

// Initialize and register SimpleCombat
const simpleCombat = new SimpleCombat();
global.simpleCombat = simpleCombat;
systemRegistry.register('combat', simpleCombat, { 
  dependsOn: ['gameState'], 
  priority: 5 
});

// Register BuildingConstruction
global.BuildingConstruction = BuildingConstruction;
systemRegistry.register('buildingConstruction', BuildingConstruction, { 
  dependsOn: ['tilemap', 'gameState'], 
  priority: 6 
});

// Initialize and register SimpleFlee system
const SimpleFlee = require('./server/js/core/SimpleFlee');
const simpleFlee = new SimpleFlee();
global.simpleFlee = simpleFlee;
systemRegistry.register('flee', simpleFlee, { 
  dependsOn: ['tilemap'], 
  priority: 7 
});

// Initialize and register Event Manager
const EventManager = require('./server/js/core/EventManager');
const eventManager = new EventManager();
global.eventManager = eventManager;
systemRegistry.register('events', eventManager, { 
  priority: 8 
});

// Initialize and register Social System for NPC conversations
const SocialSystem = require('./server/js/core/SocialSystem');
const socialSystem = new SocialSystem();
global.socialSystem = socialSystem;
systemRegistry.register('social', socialSystem, { 
  dependsOn: ['gameState'], 
  priority: 9 
});

// Register itemFactory
systemRegistry.register('itemFactory', itemFactory, { 
  priority: 10 
});

// Load GlobalWrappers utility functions
const GlobalWrappers = require('./server/js/core/GlobalWrappers');
global.forEachEntity = GlobalWrappers.forEachEntity;
global.filterEntities = GlobalWrappers.filterEntities;
global.findEntity = GlobalWrappers.findEntity;
global.countEntities = GlobalWrappers.countEntities;
global.getPlayerList = GlobalWrappers.getPlayerList;
global.getBuildingList = GlobalWrappers.getBuildingList;
global.getItemList = GlobalWrappers.getItemList;
global.getHouseList = GlobalWrappers.getHouseList;

// Load IterationHelpers for modern iteration patterns
const IterationHelpers = require('./server/js/core/IterationHelpers');
global.forEachPlayer = IterationHelpers.forEachPlayer;
global.forEachBuilding = IterationHelpers.forEachBuilding;
global.forEachItem = IterationHelpers.forEachItem;
global.forEachHouse = IterationHelpers.forEachHouse;
global.filterPlayers = IterationHelpers.filterPlayers;
global.filterBuildings = IterationHelpers.filterBuildings;
global.findPlayer = IterationHelpers.findPlayer;
global.findBuilding = IterationHelpers.findBuilding;
global.getPlayersInRadius = IterationHelpers.getPlayersInRadius;
global.getBuildingsInRadius = IterationHelpers.getBuildingsInRadius;

// Load TimerManager for centralized timer handling
const timerManager = require('./server/js/core/TimerManager');
global.timerManager = timerManager;

// Load RandomUtils for consistent random number generation
const random = require('./server/js/core/RandomUtils');
global.random = random;

// Function to spawn cargo ships for docks with networks
function spawnCargoShips(){
  var cargoShipsSpawned = 0;
  
  for(var buildingId in Building.list){
    var building = Building.list[buildingId];
    
    // Only spawn for docks with networks that don't already have a cargo ship
    if(building.type === 'dock' && building.network && building.network.length > 0 && !building.cargoShip){
      // Find water tile adjacent to dock
      var waterTile = null;
      for(var i in building.plot){
        var dockLoc = building.plot[i];
        var adjacent = [
          [dockLoc[0], dockLoc[1] + 1],
          [dockLoc[0], dockLoc[1] - 1],
          [dockLoc[0] - 1, dockLoc[1]],
          [dockLoc[0] + 1, dockLoc[1]]
        ];
        
        for(var j in adjacent){
          var at = adjacent[j];
          if(at[0] >= 0 && at[0] < mapSize && at[1] >= 0 && at[1] < mapSize){
            if(getTile(0, at[0], at[1]) == 0){ // Water
              waterTile = at;
              break;
            }
          }
        }
        if(waterTile) break;
      }
      
      if(!waterTile){
        continue;
      }
      
      // Create cargo ship at water tile adjacent to dock
      var waterCoords = getCenter(waterTile[0], waterTile[1]);
      var cargoShip = CargoShip({
        x: waterCoords[0],
        y: waterCoords[1],
        z: 0,
        homeDock: buildingId,
        currentDock: buildingId,
        mode: 'waiting'
      });
      
      // Select first destination and start waiting
      if(cargoShip.selectNextDestination()){
        cargoShip.announceDestination();
        cargoShip.startWaiting();
        building.cargoShip = cargoShip.id;
        cargoShipsSpawned++;
      } else {
        // Failed to select destination, remove ship
        cargoShip.toRemove = true;
      }
    }
  }
  
  if(cargoShipsSpawned > 0){
  }
}

// Spawn cargo ships after buildings are loaded
spawnCargoShips();

// Create command handler after globals are set
const commandHandler = new CommandHandler();

// Register CommandRegistry (Phase 3: Commands System)
const commandRegistry = require('./server/js/commands/CommandRegistry.js');
systemRegistry.register('commandRegistry', commandRegistry, { 
  dependsOn: ['gameState'], 
  priority: 13 
});
global.commandRegistry = commandRegistry;

// Load commands from individual files (after Commands.js is required)
// Note: Commands.js is required earlier in the file (line ~35), so EvalCmd is available
// Note: commandRegistry is already defined and registered above (line ~332)
// Note: loadCommands() is called later in continueServerInitialization() to avoid printing during CLI
const { loadCommands, registerLegacyHandler } = require('./server/js/commands/loadCommands.js');

systemRegistry.register('commands', commandHandler, { 
  dependsOn: ['gameState', 'tilemap', 'commandRegistry'], 
  priority: 14 
});

// Create optimized game loop
const optimizedGameLoop = new OptimizedGameLoop();
systemRegistry.register('gameLoop', optimizedGameLoop, { 
  dependsOn: ['gameState'], 
  priority: 15 
});

// Initialize performance monitor
const PerformanceMonitor = require('./server/js/core/PerformanceMonitor');
const performanceMonitor = new PerformanceMonitor();
global.performanceMonitor = performanceMonitor;
systemRegistry.register('performance', performanceMonitor, { priority: 16 });

const SOCKET_LIST = {};
global.SOCKET_LIST = SOCKET_LIST;
// io is declared earlier in the file (before initializeWorld)
// Configure A* pathfinder with better options
let finder = new PF.AStarFinder({
  allowDiagonal: true,
  dontCrossCorners: true,
  heuristic: PF.Heuristic.euclidean,
  weight: 1.2
});

// Expose pathfinder globally for other modules
global.finder = finder;

// Path caching for frequently used routes (LRU implementation)
class PathCache {
  constructor(maxSize = 1000, ttl = 30000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.lastCleanup = Date.now();
    this.cleanupInterval = 60000; // Cleanup every 60 seconds
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // LRU: Move to end by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.path;
  }

  set(key, path) {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      path: path,
      timestamp: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;
    
    this.lastCleanup = now;
    const toDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        toDelete.push(key);
      }
    }
    
    toDelete.forEach(key => this.cache.delete(key));
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

const pathCache = new PathCache(1000, 30000);

// Spawn points
let spawnPointsO = [];
let spawnPointsU = [];
let waterSpawns = [];
let hForestSpawns = [];
let mtnSpawns = [];
// caveEntrances declared and populated after genesis loads (line ~105)

// Biome tracking
const biomes = {
  water: 0,
  forest: 0,
  hForest: 0,
  brush: 0,
  rocks: 0,
  mtn: 0
};

// Names for random generation
const maleNames = [];
const femaleNames = [];
const surnames = [];

// Zones for spatial partitioning
let zones = createArray(64, 64);

// Day/night cycle
const cycle = ['XII.a','I.a','II.a','III.a','IV.a','V.a','VI.a','VII.a','VIII.a','IX.a','X.a',
  'XI.a','XII.p','I.p','II.p','III.p','IV.p','V.p','VI.p','VII.p','VIII.p','IX.p','X.p','XI.p'];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function createArray(length) {
  const arr = new Array(length || 0);
  let i = length;

  if (arguments.length > 1) {
    const args = Array.prototype.slice.call(arguments, 1);
    while (i--) {
      arr[length - 1 - i] = createArray.apply(this, args);
    }
  }
  return arr;
}

function getLoc(x, y) {
  return [Math.floor(x / tileSize), Math.floor(y / tileSize)];
}

function getCoords(c, r) {
  return [c * tileSize, r * tileSize];
}

function getCenter(c, r) {
  return [(c * tileSize) + (tileSize / 2), (r * tileSize) + (tileSize / 2)];
}

function getTile(l, c, r) {
  if (r >= 0 && r < mapSize && c >= 0 && c < mapSize) {
    return global.tilemapSystem.getTile(l, c, r);
  }
  return undefined;
}

function getLocTile(l, x, y) {
  if (x >= 0 && x <= mapPx && y >= 0 && y <= mapPx) {
    const loc = getLoc(x, y);
    return global.tilemapSystem.getTile(l, loc[0], loc[1]);
  }
  return undefined;
}

function getDistance(pt1, pt2) {
  return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2));
}

function tileChange(l, c, r, n, incr = false) {
  // Validate inputs
  if (typeof l !== 'number' || typeof c !== 'number' || typeof r !== 'number') {
    return;
  }
  
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    return;
  }
  
  try {
  global.tilemapSystem.updateTile(l, c, r, n, incr);
  
  // Update the local world array to keep it in sync
  const newTileValue = global.tilemapSystem.getTile(l, c, r);
  
  // Ensure the world array structure exists
  if (!world[l]) {
    world[l] = [];
  }
  if (!world[l][r]) {
    world[l][r] = [];
  }
  world[l][r][c] = newTileValue;
  
  // Automatically emit tile update to all clients
  emit({ msg: 'tileEdit', l, c, r, tile: newTileValue });
  } catch (error) {
  }
}

function mapEdit(l, c, r) {
  if (l !== undefined) {
    if (c !== undefined && r !== undefined) {
      const tile = global.tilemapSystem.getTile(l, c, r);
      // Ensure the world array structure exists
      if (!world[l]) {
        world[l] = [];
      }
      if (!world[l][r]) {
        world[l][r] = [];
      }
      world[l][r][c] = tile || 0;
      emit({ msg: 'tileEdit', l, c, r, tile: tile || 0 });
  } else {
      // For layer editing, we'll need to reconstruct the layer from the tilemap
      const layer = [];
      for (let y = 0; y < mapSize; y++) {
        layer[y] = [];
        for (let x = 0; x < mapSize; x++) {
          layer[y][x] = global.tilemapSystem.getTile(l, x, y);
        }
      }
      // Update the local world array
      world[l] = layer;
      emit({ msg: 'layerEdit', l, layer: layer });
    }
  } else {
    // For full map editing, we'll need to reconstruct the world array
    const worldArray = [];
    for (let layer = 0; layer < 9; layer++) {
      worldArray[layer] = [];
      for (let y = 0; y < mapSize; y++) {
        worldArray[layer][y] = [];
        for (let x = 0; x < mapSize; x++) {
          worldArray[layer][y][x] = global.tilemapSystem.getTile(layer, x, y);
        }
      }
    }
    emit({ msg: 'mapEdit', world: worldArray });
  }
}

function emit(data) {
  if (!data || typeof data !== 'object') {
    return;
  }
  
  const jsonData = JSON.stringify(data);
  const disconnectedSockets = [];
  
  for (const i in SOCKET_LIST) {
    try {
      const socket = SOCKET_LIST[i];
      if (socket && typeof socket.write === 'function') {
        socket.write(jsonData);
      } else {
        disconnectedSockets.push(i);
      }
    } catch (error) {
      disconnectedSockets.push(i);
    }
  }
  
  // Clean up disconnected sockets
  disconnectedSockets.forEach(socketId => {
    delete SOCKET_LIST[socketId];
  });
}
global.emit = emit;
// Expose utility functions for modules that expect globals
global.getTile = getTile;
global.getLoc = getLoc;
global.getLocTile = getLocTile;
global.getCenter = getCenter;
global.getCoords = getCoords;
global.getDistance = getDistance;
global.tileChange = tileChange;
global.mapEdit = mapEdit;
global.getArea = getArea;
global.getBuilding = getBuilding;
global.keyCheck = keyCheck;
global.chestCheck = chestCheck;
global.gateCheck = gateCheck;
global.allyCheck = allyCheck;
global.isAlly = isAlly;

function randomName(gender) {
  if (gender === 'm') {
    return maleNames[Math.floor(Math.random() * maleNames.length)];
  } else if (gender === 'f') {
    return femaleNames[Math.floor(Math.random() * femaleNames.length)];
  } else {
    return surnames[Math.floor(Math.random() * surnames.length)];
  }
}
global.randomName = randomName;

function getArea(loc1, loc2, margin = 0) {
  if (!loc1 || !loc2) {
    return [];
  }
  const c1 = loc1[0];
  const c2 = loc2[0];
  const r1 = loc1[1];
  const r2 = loc2[1];

  let tl, br;

  if (c1 <= c2) {
    if (r1 <= r2) {
      tl = [c1 - margin, r1 - margin];
      br = [c2 + margin, r2 + margin];
    } else {
      tl = [c1 - margin, r2 - margin];
      br = [c2 + margin, r1 + margin];
    }
  } else {
    if (r1 <= r2) {
      tl = [c2 - margin, r1 - margin];
      br = [c1 + margin, r2 + margin];
    } else {
      tl = [c2 - margin, r2 - margin];
      br = [c1 + margin, r1 + margin];
    }
  }

  const grid = [];
  for (let y = tl[1]; y < br[1]; y++) {
    for (let x = tl[0]; x < br[0]; x++) {
      if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
        grid.push([x, y]);
      }
    }
  }
  return grid;
}

// ============================================================================
// PATHFINDING
// ============================================================================

function pathing(z) {
  // Use gameState.mapSize or fallback to global.mapSize
  const size = gameState.mapSize || global.mapSize || 192;
  const grid = createArray(size, size);
  // Matrix values: 0 = walkable, 1 = blocked, 2 = transition tile

  if (z === 0) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const tile = world[0][y][x];
        // Mark transition tiles (water, doors, cave entrances) as 2
        if (tile === TERRAIN.WATER || tile === TERRAIN.DOOR_OPEN || tile === TERRAIN.DOOR_OPEN_ALT || tile === TERRAIN.CAVE_ENTRANCE) {
          grid[y][x] = 2; // Transition tile
        } else {
          grid[y][x] = 0; // Walkable (land tiles, etc.)
        }
      }
    }
  } else if (z === -1) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const tile = world[1][y][x];
        // Matrix: 0 = walkable, 1 = blocked, 2 = transition tile
        // Floor (0), exits (2), and ore (3.x) are walkable (0); walls (1) are blocked (1)
        // Cave exits are transition tiles (value 2)
        if (tile === 1) {
          grid[y][x] = 1; // Blocked (walls)
        } else if (tile === 2) {
          // Check if this is a cave exit (entrance[0], entrance[1]+1)
          let isCaveExit = false;
          if (global.caveEntrances) {
            for (let i = 0; i < global.caveEntrances.length; i++) {
              const entrance = global.caveEntrances[i];
              if (entrance[0] === x && entrance[1] + 1 === y) {
                isCaveExit = true;
                break;
              }
            }
          }
          grid[y][x] = isCaveExit ? 2 : 0; // Transition tile if cave exit, otherwise walkable
        } else {
          grid[y][x] = 0; // Walkable (floor, ore, etc.)
        }
      }
    }
  } else if (z === 3) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = world[0][y][x] === 0 ? 0 : 1;
      }
    }
  } else if (z === -3) {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = 0; // All walkable underwater
      }
    }
  } else if (z === 1) {
    // Building floor 1 (z=1) - start with all tiles blocked
    // matrixChange() will mark walkable tiles when buildings are constructed
    // Stairs and exits will be marked as transition (2) by matrixChange
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = 1; // All blocked initially
      }
    }
  } else if (z === 2) {
    // Building floor 2 (z=2) - start with all tiles blocked
    // matrixChange() will mark walkable tiles when buildings are constructed
    // Stairs will be marked as transition (2) by matrixChange
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = 1; // All blocked initially
      }
    }
  } else if (z === -2) {
    // Cellar (z=-2) - start with all tiles blocked
    // matrixChange() will mark walkable tiles when buildings are constructed
    // Stairs will be marked as transition (2) by matrixChange
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = 1; // All blocked initially
      }
    }
  } else {
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        grid[y][x] = 1;
      }
    }
  }
  return grid;
}

// Pathfinding matrices will be initialized in continueServerInitialization()
// after the world is generated
let matrixO, matrixU, matrixB1, matrixB2, matrixB3, matrixW, matrixS;
let gridO, gridU, gridB1, gridB2, gridB3, gridW, gridS;

// ============================================================================
// INTERACTABILITY SYSTEM
// ============================================================================

// Map to store interactable tiles: key = "layer:c,r", value = building/object ID
const interactableTiles = new Map();

// Set a tile as interactable
function setTileInteractable(layer, c, r, buildingId) {
  if (typeof layer !== 'number' || typeof c !== 'number' || typeof r !== 'number') {
    return;
  }
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    return;
  }
  const key = `${layer}:${c},${r}`;
  interactableTiles.set(key, buildingId);
}

// Check if a tile is interactable and return building/object ID
function isTileInteractable(layer, c, r) {
  if (typeof layer !== 'number' || typeof c !== 'number' || typeof r !== 'number') {
    return undefined;
  }
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    return undefined;
  }
  const key = `${layer}:${c},${r}`;
  return interactableTiles.get(key);
}

// Clear interactability for a specific tile
function clearTileInteractable(layer, c, r) {
  if (typeof layer !== 'number' || typeof c !== 'number' || typeof r !== 'number') {
    return;
  }
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    return;
  }
  const key = `${layer}:${c},${r}`;
  interactableTiles.delete(key);
}

// Clear all interactable tiles for a building/object
function clearBuildingInteractableTiles(buildingId) {
  if (!buildingId) return;
  const keysToDelete = [];
  for (const [key, value] of interactableTiles.entries()) {
    if (value === buildingId) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    interactableTiles.delete(key);
  }
}

// Get interactable building at a location (helper for server-side)
function getInteractableBuilding(layer, c, r) {
  return isTileInteractable(layer, c, r);
}

// Export interactability functions globally
global.setTileInteractable = setTileInteractable;
global.isTileInteractable = isTileInteractable;
global.clearTileInteractable = clearTileInteractable;
global.clearBuildingInteractableTiles = clearBuildingInteractableTiles;
global.getInteractableBuilding = getInteractableBuilding;

// Check if a tile is occupied by another character
function isTileOccupied(tileX, tileY, z, excludeEntityId = null) {
  if (!global.Player || !global.Player.list) return false;
  
  for (const id in global.Player.list) {
    const entity = global.Player.list[id];
    if (!entity || entity.id === excludeEntityId) continue;
    if (entity.z !== z) continue;
    if (entity.toRemove) continue; // Don't count entities being removed
    
    const entityLoc = getLoc(entity.x, entity.y);
    if (entityLoc[0] === tileX && entityLoc[1] === tileY) {
      return true;
    }
  }
  return false;
}

function cloneGrid(g, options = {}) {
  // Use the new consolidated pathfinding system
  const grid = global.tilemapSystem.pathfindingSystem.tilemapSystem.generatePathfindingGrid(g, options);
  const pfGrid = new PF.Grid(grid);
  
  // Mark occupied tiles as unwalkable to prevent character stacking
  // Only check tiles in a reasonable area around pathfinding start/end to optimize performance
  if (options && options.excludeEntityId !== undefined && options.z !== undefined) {
    const z = options.z;
    const excludeEntityId = options.excludeEntityId;
    const mapSize = global.mapSize || 200;
    
    // If start/end points are provided, only check tiles in that area
    let checkArea = null;
    if (options.startLoc && options.endLoc) {
      const startX = options.startLoc[0];
      const startY = options.startLoc[1];
      const endX = options.endLoc[0];
      const endY = options.endLoc[1];
      
      // Create bounding box with some padding
      const minX = Math.max(0, Math.min(startX, endX) - 5);
      const maxX = Math.min(mapSize - 1, Math.max(startX, endX) + 5);
      const minY = Math.max(0, Math.min(startY, endY) - 5);
      const maxY = Math.min(mapSize - 1, Math.max(startY, endY) + 5);
      
      checkArea = { minX, maxX, minY, maxY };
    }
    
    if (checkArea) {
      // Only check tiles in the pathfinding area
      for (let y = checkArea.minY; y <= checkArea.maxY; y++) {
        for (let x = checkArea.minX; x <= checkArea.maxX; x++) {
          if (isTileOccupied(x, y, z, excludeEntityId)) {
            // Mark tile as unwalkable
            pfGrid.setWalkableAt(x, y, false);
          }
        }
      }
    } else {
      // Fallback: check all tiles (less efficient but works)
      for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
          if (isTileOccupied(x, y, z, excludeEntityId)) {
            // Mark tile as unwalkable
            pfGrid.setWalkableAt(x, y, false);
          }
        }
      }
    }
  }
  
  return pfGrid;
}

// Path smoothing to reduce zigzag movement
function smoothPath(path, z = 0) {
  if (!path || path.length <= 2) return path;
  
  const smoothed = [path[0]];
  let i = 0;
  
  while (i < path.length - 1) {
    let j = i + 2;
    
    // Find the furthest point we can reach in a straight line
    while (j < path.length && canMoveDirectly(path[i], path[j], z)) {
      j++;
    }
    
    // Add the furthest reachable point
    smoothed.push(path[j - 1]);
    i = j - 1;
  }
  
  return smoothed;
}

// Check if we can move directly between two points without hitting obstacles
function canMoveDirectly(start, end, z = 0) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  
  if (steps === 0) return true;
  
  const stepX = dx / steps;
  const stepY = dy / steps;
  
  for (let i = 1; i <= steps; i++) {
    const x = Math.round(start[0] + stepX * i);
    const y = Math.round(start[1] + stepY * i);
    
    // Check if this point is walkable
    if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) return false;
    if (!isWalkable(z, x, y)) return false;
    
    // OPTIMIZED: Skip entity collision checks during pathfinding
    // Entities can pathfind through each other - actual collision handled during movement
    // This prevents O(n) loops (450 entities × 50 tiles = 22,500 checks per path!)
    // Minor entity overlap is acceptable and much better than massive lag
  }
  
  return true;
}

// Get cached path or compute new one
function getCachedPath(start, end, z) {
  const key = `${start[0]},${start[1]},${end[0]},${end[1]},${z}`;
  return pathCache.get(key);
}

// Cache a computed path
function cachePath(start, end, z, path) {
  const key = `${start[0]},${start[1]},${end[0]},${end[1]},${z}`;
  pathCache.set(key, path);
}

// Multi-z pathfinding system for complex journeys
function createMultiZPath(startZ, startLoc, targetZ, targetLoc, entity) {
  const path = [];
  const waypoints = [];
  
  // Define z-level hierarchy and transitions
  const zLevels = {
    '-3': 'underwater',
    '-2': 'cellar', 
    '-1': 'cave',
    '0': 'overworld',
    '1': 'ground_floor',
    '2': 'second_floor'
  };
  
  // Find the optimal route through z-levels
  const route = findOptimalZRoute(startZ, targetZ);
  if (route.length === 0) {
    // Route logging handled via event system
    return null;
  }
  
  // Create waypoints for each transition
  let currentZ = startZ;
  let currentLoc = startLoc;
  
  for (let i = 0; i < route.length - 1; i++) {
    const fromZ = route[i];
    const toZ = route[i + 1];
    
    // Find transition point between these z-levels
    const transition = findZTransition(fromZ, toZ, currentLoc, targetLoc, entity);
    if (!transition) {
      // Transition logging handled via event system
      return null;
    }
    
    waypoints.push({
      z: fromZ,
      loc: transition.from,
      action: transition.action,
      nextZ: toZ,
      nextLoc: transition.to
    });
    
    currentZ = toZ;
    currentLoc = transition.to;
  }
  
  // Add final destination
  waypoints.push({
    z: targetZ,
    loc: targetLoc,
    action: 'arrive',
    nextZ: null,
    nextLoc: null
  });
  
  return waypoints;
}

// Find optimal route through z-levels
function findOptimalZRoute(startZ, targetZ) {
  const routes = {
    // Cave to second floor: cave -> overworld -> building entrance -> stairs -> second floor
    '-1->2': [-1, 0, 1, 2],
    // Cave to cellar: cave -> overworld -> building entrance -> cellar
    '-1->-2': [-1, 0, 1, -2],
    // Second floor to cave: second floor -> stairs -> ground floor -> exit -> overworld -> cave entrance -> cave
    '2->-1': [2, 1, 0, -1],
    // Cellar to cave: cellar -> stairs -> ground floor -> exit -> overworld -> cave entrance -> cave
    '-2->-1': [-2, 1, 0, -1],
    // Underwater to anywhere: underwater -> overworld -> [continue normal route]
    '-3->0': [-3, 0],
    '-3->1': [-3, 0, 1],
    '-3->2': [-3, 0, 1, 2],
    '-3->-1': [-3, 0, -1],
    '-3->-2': [-3, 0, 1, -2]
  };
  
  const key = `${startZ}->${targetZ}`;
  if (routes[key]) {
    return routes[key];
  }
  
  // Default: direct transition if possible
  if (Math.abs(startZ - targetZ) <= 1) {
    return [startZ, targetZ];
  }
  
  // Fallback: go through overworld
  if (startZ !== 0) {
    return [startZ, 0, targetZ];
  }
  
  return [startZ, targetZ];
}

// Find transition points between z-levels
function findZTransition(fromZ, toZ, fromLoc, targetLoc, entity) {
  if (fromZ === -1 && toZ === 0) {
    // Cave to overworld: use stored caveEntrance if available (matches special-case handler)
    let bestEntrance = null;
    
    // Priority 1: Use stored caveEntrance from entity (the entrance they used to enter)
    // This matches the working special-case handler behavior
    if (entity && entity.caveEntrance && Array.isArray(entity.caveEntrance) && entity.caveEntrance.length >= 2) {
      // Validate it still exists in caveEntrances array
      for (const entrance of global.caveEntrances || []) {
        if (entrance[0] === entity.caveEntrance[0] && entrance[1] === entity.caveEntrance[1]) {
          bestEntrance = entity.caveEntrance;
          break;
        }
      }
    }
    
    // Priority 2: Find nearest to current location (not target) if no stored entrance
    // This matches the special-case handler fallback behavior
    if (!bestEntrance) {
      let bestDistance = Infinity;
      for (const entrance of global.caveEntrances || []) {
        const distance = getDistance(
          {x: fromLoc[0], y: fromLoc[1]},  // Use fromLoc (current location), not targetLoc
          {x: entrance[0], y: entrance[1]}
        );
        if (distance < bestDistance) {
          bestDistance = distance;
          bestEntrance = entrance;
        }
      }
    }
    
    if (bestEntrance) {
      return {
        from: [bestEntrance[0], bestEntrance[1] + 1], // Cave exit (layer 1)
        to: bestEntrance, // Overworld entrance
        action: 'exit_cave'
      };
    }
  }
  
  if (fromZ === 0 && toZ === -1) {
    // Overworld to cave: find nearest cave entrance to target
    let bestEntrance = null;
    let bestDistance = Infinity;
    
    for (const entrance of global.caveEntrances || []) {
      const distance = getDistance(
        {x: targetLoc[0], y: targetLoc[1]}, 
        {x: entrance[0], y: entrance[1]}
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEntrance = entrance;
      }
    }
    
    if (bestEntrance) {
      return {
        from: bestEntrance,
        to: [bestEntrance[0], bestEntrance[1] + 1],
        action: 'enter_cave'
      };
    }
  }
  
  if (fromZ === 0 && toZ === 1) {
    // Overworld to building: find building entrance
    const center = getCenter(targetLoc[0], targetLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building]) {
      return {
        from: Building.list[building].entrance,
        to: [Building.list[building].entrance[0], Building.list[building].entrance[1] + 1],
        action: 'enter_building'
      };
    }
  }
  
  if (fromZ === 1 && toZ === 0) {
    // Building to overworld: find building exit
    const center = getCenter(fromLoc[0], fromLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building]) {
      return {
        from: [Building.list[building].entrance[0], Building.list[building].entrance[1] + 1],
        to: Building.list[building].entrance,
        action: 'exit_building'
      };
    }
  }
  
  if (fromZ === 1 && toZ === 2) {
    // Ground floor to second floor: find stairs
    const center = getCenter(fromLoc[0], fromLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building] && Building.list[building].ustairs) {
      return {
        from: Building.list[building].ustairs,
        to: Building.list[building].ustairs,
        action: 'go_upstairs'
      };
    }
  }
  
  if (fromZ === 2 && toZ === 1) {
    // Second floor to ground floor: find stairs
    const center = getCenter(fromLoc[0], fromLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building] && Building.list[building].ustairs) {
      return {
        from: Building.list[building].ustairs,
        to: Building.list[building].ustairs,
        action: 'go_downstairs'
      };
    }
  }
  
  if (fromZ === 1 && toZ === -2) {
    // Ground floor to cellar: find stairs
    const center = getCenter(fromLoc[0], fromLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building] && Building.list[building].dstairs) {
      return {
        from: Building.list[building].dstairs,
        to: Building.list[building].dstairs,
        action: 'go_to_cellar'
      };
    }
  }
  
  if (fromZ === -2 && toZ === 1) {
    // Cellar to ground floor: find stairs
    const center = getCenter(fromLoc[0], fromLoc[1]);
    const building = getBuilding(center[0], center[1]);
    
    if (building && Building.list[building] && Building.list[building].dstairs) {
      return {
        from: Building.list[building].dstairs,
        to: Building.list[building].dstairs,
        action: 'go_from_cellar'
      };
    }
  }
  
  return null;
}

function matrixChange(l, c, r, n) {
  const matrices = {
    0: { matrix: matrixO, grid: gridO },
    '-1': { matrix: matrixU, grid: gridU },
    1: { matrix: matrixB1, grid: gridB1 },
    2: { matrix: matrixB2, grid: gridB2 },
    '-2': { matrix: matrixB3, grid: gridB3 },
    '-3': { matrix: matrixW, grid: gridW },
    3: { matrix: matrixS, grid: gridS }
  };

  // Bounds check
  const currentMapSize = gameState.mapSize || global.mapSize || 192;
  if (c < 0 || c >= currentMapSize || r < 0 || r >= currentMapSize) {
    return;
  }

  const target = matrices[l];
  if (target && target.matrix && target.matrix[r]) {
    target.matrix[r][c] = n;
    // Set walkable if value is 0 (walkable) or 2 (transition tile)
    // Transition tiles are considered walkable by default, pathfinding options control whether to use them
    // Only update grid if it exists (grids are created in continueServerInitialization)
    if (target.grid && typeof target.grid.setWalkableAt === 'function') {
      target.grid.setWalkableAt(c, r, n === 0 || n === 2);
    }
  } else if (target) {
  }
}

// Find the closest adjacent walkable tile to an entity (building or object)
// Returns [tileX, tileY] or null if no walkable adjacent tile found
// Helper function to check if player is already at an adjacent tile to an entity
function isPlayerAdjacentToEntity(entity, entityType, playerLoc) {
  if (!entity || !playerLoc) return false;
  
  var entityTiles = [];
  
  // Get all tiles that are part of the entity
  if (entityType === 'building') {
    // For buildings, use the plot array
    if (entity.plot && Array.isArray(entity.plot)) {
      // For docks: only check adjacency to the interactable tile (plot[4])
      if (entity.type === 'dock' && entity.plot[4]) {
        entityTiles = [entity.plot[4]];
      } else {
        // For other buildings: check all plot tiles (all are interactable)
        entityTiles = entity.plot;
      }
    } else {
      // Fallback: use building's center tile
      var buildingLoc = getLoc(entity.x, entity.y);
      entityTiles = [buildingLoc];
    }
  } else if (entityType === 'item') {
    // For objects, convert x, y to tile coordinates
    var tileX = Math.floor(entity.x / TILE_SIZE);
    var tileY = Math.floor(entity.y / TILE_SIZE);
    entityTiles = [[tileX, tileY]];
  } else if (entityType === 'ship') {
    // Ships occupy a single tile at their position
    var shipLoc = getLoc(entity.x, entity.y);
    entityTiles = [shipLoc];
  } else {
    return false;
  }
  
  // Check all 8 adjacent directions for each entity tile
  var directions = [
    [-1, -1], [0, -1], [1, -1],  // top-left, top, top-right
    [-1, 0],           [1, 0],   // left, right
    [-1, 1],  [0, 1],  [1, 1]    // bottom-left, bottom, bottom-right
  ];
  
  for (var i = 0; i < entityTiles.length; i++) {
    var entityTile = entityTiles[i];
    var tileX = entityTile[0];
    var tileY = entityTile[1];
    
    for (var j = 0; j < directions.length; j++) {
      var dir = directions[j];
      var adjX = tileX + dir[0];
      var adjY = tileY + dir[1];
      
      // Check if player is at this adjacent tile
      if (playerLoc[0] === adjX && playerLoc[1] === adjY) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate the facing direction a player should have to face a target location
 * @param {Array} playerLoc - Player's tile location [x, y]
 * @param {Array} targetLoc - Target's tile location [x, y]
 * @returns {string} Facing direction: 'up', 'down', 'left', or 'right'
 */
function calculateFacingDirection(playerLoc, targetLoc) {
  if (!playerLoc || !targetLoc || playerLoc.length < 2 || targetLoc.length < 2) {
    return 'down'; // Default facing
  }
  
  var diffX = targetLoc[0] - playerLoc[0];
  var diffY = targetLoc[1] - playerLoc[1];
  
  // Prioritize horizontal movement if horizontal distance is greater
  if (Math.abs(diffX) > Math.abs(diffY)) {
    return diffX > 0 ? 'right' : 'left';
  } else {
    // Vertical distance is greater or equal - face up or down
    return diffY > 0 ? 'down' : 'up';
  }
}

function findClosestAdjacentWalkableTile(entity, entityType, playerZ, playerLoc) {
  if (!entity || !playerLoc) return null;
  
  var adjacentTiles = [];
  var entityTiles = [];
  
  // Get all tiles that are part of the entity
  if (entityType === 'building') {
    // For buildings, use the plot array
    if (entity.plot && Array.isArray(entity.plot)) {
      // For docks: only find adjacent tiles to the interactable tile (plot[4])
      if (entity.type === 'dock' && entity.plot[4]) {
        entityTiles = [entity.plot[4]];
      } else {
        // For other buildings: use all plot tiles (all are interactable)
        entityTiles = entity.plot;
      }
    } else {
      // Fallback: use building's center tile
      var buildingLoc = getLoc(entity.x, entity.y);
      entityTiles = [buildingLoc];
    }
  } else if (entityType === 'item') {
    // For objects, convert x, y to tile coordinates
    var tileX = Math.floor(entity.x / TILE_SIZE);
    var tileY = Math.floor(entity.y / TILE_SIZE);
    entityTiles = [[tileX, tileY]];
  } else if (entityType === 'ship') {
    // Ships occupy a single tile at their position
    var shipLoc = getLoc(entity.x, entity.y);
    entityTiles = [shipLoc];
  } else {
    return null;
  }
  
  // For each entity tile, check all 8 adjacent directions
  var directions = [
    [-1, -1], [0, -1], [1, -1],  // top-left, top, top-right
    [-1, 0],           [1, 0],   // left, right
    [-1, 1],  [0, 1],  [1, 1]    // bottom-left, bottom, bottom-right
  ];
  
  for (var i = 0; i < entityTiles.length; i++) {
    var entityTile = entityTiles[i];
    var tileX = entityTile[0];
    var tileY = entityTile[1];
    
    for (var j = 0; j < directions.length; j++) {
      var dir = directions[j];
      var adjX = tileX + dir[0];
      var adjY = tileY + dir[1];
      
      // Check bounds
      if (adjX < 0 || adjX >= mapSize || adjY < 0 || adjY >= mapSize) continue;
      
      // Check if tile is walkable
      if (isWalkable(playerZ, adjX, adjY)) {
        // Verify we can pathfind to this tile
        var options = {
          avoidDoors: true,
          avoidCaveExits: false
        };
        
        // Determine layer based on z-level
        var layer = playerZ === 0 ? 0 : (playerZ === -1 ? 1 : (playerZ === -2 ? 8 : (playerZ === 1 ? 3 : 5)));
        
        var testPath = global.tilemapSystem.findPath(playerLoc, [adjX, adjY], layer, options);
        if (testPath && testPath.length > 0) {
          adjacentTiles.push([adjX, adjY]);
        }
      }
    }
  }
  
  if (adjacentTiles.length === 0) return null;
  
  // Find closest tile to player's current position
  var closestTile = null;
  var closestDistance = Infinity;
  
  for (var k = 0; k < adjacentTiles.length; k++) {
    var tile = adjacentTiles[k];
    var dx = tile[0] - playerLoc[0];
    var dy = tile[1] - playerLoc[1];
    var distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestTile = tile;
    }
  }
  
  return closestTile;
}

function isWalkable(z, c, r) {
  if (c < 0 || c > mapSize - 1 || r < 0 || r > mapSize - 1) {
    return false;
  }

  const matrices = {
    0: matrixO,
    '-1': matrixU,
    1: matrixB1,
    2: matrixB2,
    '-2': matrixB3,
    '-3': matrixW  // Underwater - all tiles walkable
  };

  const matrix = matrices[z];
  if (!matrix) return false;
  
  const matrixValue = matrix[r][c];
  
  // Water tiles (transition value 2 on overworld) are NOT walkable for basic movement
  // They should only be allowed in pathfinding when explicitly targeted
  if (z === 0 && matrixValue === 2) {
    // Check if this is actually a water tile (not a door or cave entrance)
    const tile = world[0][r][c];
    if (tile === TERRAIN.WATER) {
      return false; // Water is not walkable
    }
    // Doors and cave entrances (also value 2) can be walkable for basic movement checks
    // They're transition tiles but NPCs can walk through them when needed
    return true;
  }
  
  // Return true if tile is walkable (0) OR transition tile (2) that's not water
  return matrixValue === 0 || matrixValue === 2;
}

function getItem(z, c, r) {
  const matrices = {
    0: matrixO,
    '-1': matrixU,
    1: matrixB1,
    2: matrixB2,
    '-2': matrixB3,
    '-3': matrixW
  };
  return matrices[z]?.[r]?.[c];
}
// Pathfinding helpers for modules that expect globals
global.isWalkable = isWalkable;
global.matrixChange = matrixChange;
global.cloneGrid = cloneGrid;
global.getItem = getItem;
global.smoothPath = smoothPath;
global.getCachedPath = getCachedPath;
global.cachePath = cachePath;
global.createMultiZPath = createMultiZPath;
global.findOptimalZRoute = findOptimalZRoute;
global.findZTransition = findZTransition;

// ============================================================================
// BUILDING HELPERS
// ============================================================================

function getBuilding(x, y, includeWallsAndTopPlot = false) {
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
    return null;
  }
  
  const loc = getLoc(x, y);
  if (!loc || loc[0] < 0 || loc[0] >= mapSize || loc[1] < 0 || loc[1] >= mapSize) {
    return null;
  }
  
  for (const i in Building.list) {
    const b = Building.list[i];
    if (!b || !b.plot || !Array.isArray(b.plot)) continue;
    
    // Check ground floor plot
    // Note: plot refers to tiles that form the foundation during construction,
    // which become the walkable floor space inside the building at z=1.
    for (let n = 0; n < b.plot.length; n++) {
      if (b.plot[n] && b.plot[n][0] === loc[0] && b.plot[n][1] === loc[1]) {
        return b.id;
      }
    }
    
    // Optionally check walls and topPlot (for item ownership, rendering, etc.)
    // walls and topPlot are visual elements - on z=0 those coordinates are walkable outside areas
    // but items spawned on these tiles still belong to the building
    if (includeWallsAndTopPlot) {
      // Check topPlot
      if (b.topPlot && Array.isArray(b.topPlot)) {
        for (let n = 0; n < b.topPlot.length; n++) {
          if (b.topPlot[n] && b.topPlot[n][0] === loc[0] && b.topPlot[n][1] === loc[1]) {
            return b.id;
          }
        }
      }
      
      // Check walls
      if (b.walls && Array.isArray(b.walls)) {
        for (let n = 0; n < b.walls.length; n++) {
          if (b.walls[n] && b.walls[n][0] === loc[0] && b.walls[n][1] === loc[1]) {
            return b.id;
          }
        }
      }
    }
  }
  return null;
}

function keyCheck(x, y, playerId) {
  const key = getBuilding(x, y);
  const pKeys = Player.list[playerId]?.inventory.keyRing || [];

  for (const i in pKeys) {
    if (pKeys[i].id === key) {
      return true;
    }
  }
  return false;
}

function chestCheck(z, x, y, playerId) {
  const player = Player.list[playerId];
  if (!player) return false;

  for (const i in Item.list) {
    const itm = Item.list[i];
    if (itm.z === z && itm.x === x && itm.y === y) {
      if (itm.type === 'LockedChest') {
        for (const k in player.inventory.keyRing) {
          const key = player.inventory.keyRing[k];
          if (itm.id === key) {
            return itm.id;
          }
        }
      } else if (itm.type === 'Chest') {
        return itm.id;
      }
    }
  }
  return false;
}

function gateCheck(x, y, house, kingdom) {
  const buildingId = getBuilding(x, y);
  if (!buildingId) return false;

  const building = Building.list[buildingId];
  const gateH = building.house;
  const gateK = building.kingdom;

  return (kingdom && kingdom === gateK) || (house && house === gateH);
}

// ============================================================================
// FISHING HELPERS
// ============================================================================

// Process fish catch - called when player presses F
// NOTE: Socket handler should call this when receiving {msg: 'processFishCatch'}
// Example: if(data.msg === 'processFishCatch'){ global.processFishCatch(socket.id); }
function processFishCatch(playerId) {
  var player = Player.list[playerId];
  if(!player) return;
  
  if(player.processFishCatch){
    player.processFishCatch();
  }
}
global.processFishCatch = processFishCatch;

// ============================================================================
// FACTION HELPERS
// ============================================================================

// Comprehensive ally check function that handles all faction/class rules
function isAlly(entity1Id, entity2Id) {
  if (entity1Id === entity2Id) return true; // Same entity
  
  const entity1 = Player.list[entity1Id];
  const entity2 = Player.list[entity2Id];
  if (!entity1 || !entity2) return false;

  const class1 = entity1.class;
  const class2 = entity2.class;
  const isSerf = (cls) => cls === 'Serf' || cls === 'SerfM' || cls === 'SerfF';
  const isDeer = (cls) => cls === 'Deer';

  // Neutral entities (no house) are allies with each other (except special cases handled below)
  if (!entity1.house && !entity2.house) {
    // Check for wild animals - they're never allies
    if (class1 === 'Wolf' || class1 === 'Boar' || class2 === 'Wolf' || class2 === 'Boar') {
      return false;
    }
    // Deer only ally with other deer
    if (isDeer(class1) || isDeer(class2)) {
      return isDeer(class1) && isDeer(class2);
    }
    // All other neutral entities are allies with each other
    return true;
  }

  // Same house = always allies (covers military+serfs, military+military, serfs+serfs from same faction)
  if (entity1.house && entity2.house && entity1.house === entity2.house) {
    return true;
  }

  // Deer: allies ONLY with other Deer (they run from everything else)
  if (isDeer(class1) || isDeer(class2)) {
    return isDeer(class1) && isDeer(class2);
  }

  // Serfs: only allies with other Serfs from the SAME faction
  // (Serfs from different factions don't fight each other, but they're not "allies")
  if (isSerf(class1) && isSerf(class2)) {
    if (entity1.house && entity2.house && entity1.house === entity2.house) {
      return true; // Same faction serfs are allies
    }
    // Different faction serfs are not allies (but they don't fight - handled in aggro logic)
    return false;
  }

  // Wolves and Boars: no allies (always hostile)
  if (class1 === 'Wolf' || class1 === 'Boar' || class2 === 'Wolf' || class2 === 'Boar') {
    return false;
  }

  // Check faction relationships (allies, enemies, hostile status)
  const house1 = entity1.house ? House.list[entity1.house] : null;
  const house2 = entity2.house ? House.list[entity2.house] : null;

  if (house1 && house2) {
    // Check explicit allies
    if (house1.allies) {
      for (const i in house1.allies) {
        if (house1.allies[i] === entity2.house) return true;
      }
    }
    // Check explicit enemies
    if (house1.enemies) {
      for (const i in house1.enemies) {
        if (house1.enemies[i] === entity2.house) return false;
      }
    }
    // Hostile factions are enemies (unless already checked as allies)
    if (house1.hostile || house2.hostile) {
      return false;
    }
  }

  // Check individual friend/enemy lists for units without houses
  if (!house1 && entity1.friends) {
    for (const i in entity1.friends) {
      if (entity1.friends[i] === entity2Id) return true;
    }
  }
  if (!house1 && entity1.enemies) {
    for (const i in entity1.enemies) {
      if (entity1.enemies[i] === entity2Id) return false;
    }
  }

  return false; // Default: not allies
}

// Backward compatibility: keep allyCheck function but have it use isAlly
function allyCheck(playerId, otherId) {
  if (playerId === otherId) return 2; // Same entity
  
  // Early check: if both entities are neutral (no house), they are neutral to each other
  const player = Player.list[playerId];
  const other = Player.list[otherId];
  if (!player || !other) return 0;
  
  // If both have no house property (are neutral), return neutral
  if (!player.house && !other.house) {
    return 0; // Neutral
  }
  
  const isAllyResult = isAlly(playerId, otherId);
  if (isAllyResult) {
    // Check if same faction (return 2) or just allies (return 1)
    if (player && other && player.house && other.house && player.house === other.house) {
      return 2; // Same faction
    }
    return 1; // Allies
  }
  
  // Check if enemies
  
  const pHouse = House.list[player.house];
  const oHouse = House.list[other.house];
  
  // Check if explicitly enemies
  if (pHouse && pHouse.enemies) {
    for (const i in pHouse.enemies) {
      if (oHouse && pHouse.enemies[i] === other.house) return -1;
      if (pHouse.enemies[i] === otherId) return -1;
    }
  }
  if (oHouse && oHouse.enemies) {
    for (const i in oHouse.enemies) {
      if (pHouse && oHouse.enemies[i] === player.house) return -1;
      if (oHouse.enemies[i] === playerId) return -1;
    }
  }
  
  // Check if hostile factions
  if (pHouse && pHouse.hostile && oHouse && player.house !== other.house) {
    return -1;
  }
  if (oHouse && oHouse.hostile && pHouse && player.house !== other.house) {
    return -1;
  }
  
  // Wild animals are hostile
  const wildAnimals = ['Wolf', 'Boar'];
  if (wildAnimals.includes(player.class) || wildAnimals.includes(other.class)) {
    return -1;
  }
  
  return 0; // Neutral
}

// ============================================================================
// SPAWN HELPERS
// ============================================================================

function randomSpawnO() {
  if (!spawnPointsO || spawnPointsO.length === 0) {
    return getCenter(Math.floor(mapSize / 2), Math.floor(mapSize / 2));
  }
  const rand = Math.floor(Math.random() * spawnPointsO.length);
  const point = spawnPointsO[rand];
  if (!point || !Array.isArray(point) || point.length < 2) {
    return getCenter(Math.floor(mapSize / 2), Math.floor(mapSize / 2));
  }
  return getCenter(point[0], point[1]);
}
global.randomSpawnO = randomSpawnO;

function randomSpawnHF() {
  if (!hForestSpawns || hForestSpawns.length === 0) {
    // No heavy forest spawns available - fallback to overworld spawns
    return randomSpawnO();
  }
  
  // Filter spawn points to only include tiles in named geographic zones
  let validSpawns = hForestSpawns;
  
  if (global.zoneManager) {
    validSpawns = hForestSpawns.filter(point => {
      if (!point || !Array.isArray(point) || point.length < 2) {
        return false;
      }
      const zone = global.zoneManager.getZoneAt([point[0], point[1]]);
      // Only allow spawns in named geographic zones
      return zone && zone.type === 'geographic' && zone.name;
    });
  }
  
  // If no valid zone-based spawns exist, fall back to overworld spawns
  if (!validSpawns || validSpawns.length === 0) {
    return randomSpawnO();
  }
  
  const rand = Math.floor(Math.random() * validSpawns.length);
  const point = validSpawns[rand];
  if (!point || !Array.isArray(point) || point.length < 2) {
    return randomSpawnO();
  }
  return getCenter(point[0], point[1]);
}
global.randomSpawnHF = randomSpawnHF;

function randomSpawnU() {
  if (!spawnPointsU || spawnPointsU.length === 0) {
    // No underground spawns - use overworld instead
    return randomSpawnO();
  }
  const rand = Math.floor(Math.random() * spawnPointsU.length);
  const point = spawnPointsU[rand];
  return getCenter(point[0], point[1]);
}
global.randomSpawnU = randomSpawnU;

function factionSpawn(id) {
  const configs = {
    [FACTION_IDS.BROTHERHOOD]: { points: spawnPointsU, size: 4, terrainCheck: (t) => t === 0 },
    [FACTION_IDS.GOTHS]: { points: spawnPointsO, size: 5, terrainCheck: (t) => t >= TERRAIN.BRUSH && t < TERRAIN.ROCKS },
    [FACTION_IDS.NORSEMEN]: { points: waterSpawns, size: 5, terrainCheck: (t) => t === TERRAIN.WATER },
    [FACTION_IDS.FRANKS]: { points: spawnPointsO, size: 5, terrainCheck: (t) => t >= TERRAIN.BRUSH && t < TERRAIN.ROCKS },
    [FACTION_IDS.CELTS]: { points: hForestSpawns, size: 5, terrainCheck: (t) => t >= TERRAIN.HEAVY_FOREST && t < TERRAIN.LIGHT_FOREST, findClosest: true },
    [FACTION_IDS.TEUTONS]: { points: mtnSpawns, size: 5, terrainCheck: (t) => t >= TERRAIN.ROCKS && t < TERRAIN.EMPTY },
    [FACTION_IDS.OUTLAWS]: { points: hForestSpawns, size: 5, terrainCheck: (t) => t >= TERRAIN.HEAVY_FOREST && t < TERRAIN.LIGHT_FOREST },
    [FACTION_IDS.MERCENARIES]: { points: spawnPointsU, size: 5, terrainCheck: (t) => t === 0 || t === 3 }
  };

  const config = configs[id];
  if (!config) return null;

  const select = [];

  for (const i in config.points) {
    let count = 0;
    const c = config.points[i][0];
    const r = config.points[i][1];

    if (c >= mapSize - config.size || r >= mapSize - config.size) continue;

    const grid = [];
    for (let dy = 0; dy < config.size; dy++) {
      for (let dx = 0; dx < config.size; dx++) {
        grid.push([c + dx, r + dy]);
      }
    }

    for (const n in grid) {
      const tile = grid[n];
      const terrain = getTile(id === FACTION_IDS.BROTHERHOOD || id === FACTION_IDS.MERCENARIES ? 1 : 0, tile[0], tile[1]);
      if (config.terrainCheck(terrain)) {
        count++;
      }
    }

    if (count === grid.length) {
      const centerIdx = Math.floor(grid.length / 2);
      select.push(grid[centerIdx]);
    }
  }

  if (config.findClosest && select.length > 0) {
    let best = null;
    let bestSpawn = null;

    for (const spawn of select) {
      const center = getCenter(spawn[0], spawn[1]);
      for (const ent of caveEntrances) {
        const cent = getCenter(ent[0], ent[1]);
        const dist = getDistance({ x: center[0], y: center[1] }, { x: cent[0], y: cent[1] });

        if (!best || dist < best) {
          best = dist;
          bestSpawn = spawn;
        }
      }
    }
    return bestSpawn;
  }

  return select[Math.floor(Math.random() * select.length)];
}

// ============================================================================
// ENTROPY (ECOSYSTEM SIMULATION)
// ============================================================================

// Track last tempus when entropy was called to prevent multiple calls
let lastEntropyTempus = null;

// Track military unit counts at the start of each day (for daily recap)
let militaryUnitsAtDayStart = {};

// Helper function to preserve decimal values when changing vegetation tile types
// This ensures trees maintain their positioning offset when transforming between types
function preserveDecimalOnTerrainChange(currentTile, newTerrainType) {
  // Extract decimal portion from current tile (e.g., 1.33 -> 0.33, 2.45 -> 0.45)
  const decimalPart = currentTile % 1;
  // Return new terrain type with preserved decimal
  return newTerrainType + decimalPart;
}

// Helper function to create a brush tile with random decimal for positioning
// This ensures brush tiles have randomized positioning offsets
function createBrushTileWithRandomDecimal() {
  // Generate random decimal between 0 and 0.9 for positioning offset
  return TERRAIN.BRUSH + Number((Math.random() * 0.9).toFixed(2));
}

function entropy() {
  // FLORA
  const toHF = [];
  const toF = [];
  const toB = [];

  for (let c = 0; c < mapSize; c++) {
    for (let r = 0; r < mapSize; r++) {
      const tile = getTile(0, c, r);

      // Fish spawning removed - using chance-based fishing system instead
      
      // Tree growth
      if (tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.LIGHT_FOREST && day > 0) {
        if (world[6][r][c] < 300) {
          world[6][r][c] += Math.floor(Math.random() * 2);
        }
      }
      // Forest to heavy forest
      else if (tile >= TERRAIN.LIGHT_FOREST && tile < TERRAIN.BRUSH && day > 0) {
        world[6][r][c] += Math.floor(Math.random() * 2);
        if (world[6][r][c] > 100) {
          toHF.push([c, r]);
        }
      }
      // Brush spreading
      else if (tile >= TERRAIN.BRUSH && tile < TERRAIN.ROCKS &&
               c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0) {
        const neighbors = [
          [getTile(0, c, r - 1), getTile(6, c, r - 1)],
          [getTile(0, c, r + 1), getTile(6, c, r + 1)],
          [getTile(0, c - 1, r), getTile(6, c - 1, r)],
          [getTile(0, c + 1, r), getTile(6, c + 1, r)]
        ];

        for (const [nTile, nRes] of neighbors) {
          if (nTile >= TERRAIN.HEAVY_FOREST && nTile < TERRAIN.BRUSH && nRes > 49) {
            if (Math.random() < 0.05) {
              toF.push([c, r]);
              break;
            }
          }
        }
      }
      // Empty land to brush
      else if (tile === TERRAIN.EMPTY && c > 0 && c < mapSize && r > 0 && r < mapSize && day > 0) {
        const neighbors = [
          getTile(0, c, r - 1),
          getTile(0, c, r + 1),
          getTile(0, c - 1, r),
          getTile(0, c + 1, r)
        ];

        for (const nTile of neighbors) {
          if (nTile >= TERRAIN.HEAVY_FOREST && nTile < TERRAIN.ROCKS) {
            if (Math.random() < 0.05) {
              toB.push([c, r]);
              break;
            }
          }
        }
      }
    }
  }

  // Apply flora changes
  for (const i in toHF) {
    // Convert light forest (2) to heavy forest (1) - preserve decimal for positioning
    const currentTile = getTile(0, toHF[i][0], toHF[i][1]);
    if (currentTile >= TERRAIN.LIGHT_FOREST && currentTile < TERRAIN.BRUSH) {
      const newTileValue = preserveDecimalOnTerrainChange(currentTile, TERRAIN.HEAVY_FOREST);
      tileChange(0, toHF[i][0], toHF[i][1], newTileValue);
    biomes.hForest++;
    hForestSpawns.push(toHF[i]);
    }
  }
  for (const i in toF) {
    // Convert brush (3) to light forest (2) - preserve decimal for positioning
    const currentTile = getTile(0, toF[i][0], toF[i][1]);
    if (currentTile >= TERRAIN.BRUSH && currentTile < TERRAIN.ROCKS) {
      const newTileValue = preserveDecimalOnTerrainChange(currentTile, TERRAIN.LIGHT_FOREST);
      tileChange(0, toF[i][0], toF[i][1], newTileValue);
      tileChange(6, toF[i][0], toF[i][1], 50);
    }
  }
  for (const i in toB) {
    // Convert empty/grass (7) to brush (3 + random decimal) - ensure random positioning
    const currentTile = getTile(0, toB[i][0], toB[i][1]);
    if (currentTile === TERRAIN.EMPTY) {
      const brushValue = createBrushTileWithRandomDecimal();
      tileChange(0, toB[i][0], toB[i][1], brushValue);
    }
  }

  // FAUNA - Balanced spawn rates
  // Calculate map-size-scaled falcon cap (base: 12 falcons for 200x200 map)
  const mapArea = mapSize * mapSize;
  const baseMapArea = 200 * 200; // 40,000 tiles
  const maxFalcons = Math.floor(12 * (mapArea / baseMapArea));
  
  const animalRatios = {
    deer: Math.floor(biomes.hForest / 300),   // Good population for hunting
    boar: Math.floor(biomes.hForest / 600),   // Moderate population
    wolf: Math.floor(biomes.hForest / 500),   // Threat level balanced
    falcon: Math.min(Math.floor(biomes.hForest / 800), maxFalcons)  // Majestic but not rare, capped by map size
  };

  // CRITICAL: Use capitalized class names to match entity constructors (Deer, Boar, Wolf, Falcon)
  // Also support lowercase for backwards compatibility
  const animalPops = { deer: 0, boar: 0, wolf: 0, falcon: 0, Deer: 0, Boar: 0, Wolf: 0, Falcon: 0 };

  // Count existing fauna - handle case where Player.list might not exist yet
  if (global.Player && global.Player.list) {
    for (const i in Player.list) {
      const entity = Player.list[i];
      if (!entity) continue;
      const cl = entity.class;
      // Check both lowercase and capitalized versions
      const clLower = cl ? cl.toLowerCase() : '';
      if (animalPops[cl] !== undefined) {
        animalPops[cl]++;
      } else if (animalPops[clLower] !== undefined) {
        animalPops[clLower]++;
        // Also update capitalized version for consistency
        if (cl && cl !== clLower) {
          animalPops[cl] = (animalPops[cl] || 0) + 1;
        }
      }
    }
  }
  
  // Sum lowercase and capitalized counts for each animal type
  // Always define totalPops even if Player.list doesn't exist
  const totalPops = {
    deer: (animalPops.deer || 0) + (animalPops.Deer || 0),
    boar: (animalPops.boar || 0) + (animalPops.Boar || 0),
    wolf: (animalPops.wolf || 0) + (animalPops.Wolf || 0),
    falcon: (animalPops.falcon || 0) + (animalPops.Falcon || 0)
  };

  let faunaSpawned = 0;
  
  const spawnAnimal = (type, ratio, pop, AnimalConstructor) => {
    let num = 0;
    
    if (pop < ratio) {
      if (global.day === 1) {
        num = Math.floor(ratio * 0.618); // Initial spawn on day 1
      } else {
        const deficit = ratio - pop;
        // Use 33% recovery rate for all fauna types
        const recoveryRate = 0.33;
        const baseSpawn = Math.floor(deficit * recoveryRate);
        // Guarantee at least 1 spawn if population is below ratio
        num = Math.max(1, baseSpawn);
      }

      // Spawn logging handled via event system
      faunaSpawned += num;

      for (let i = 0; i < num; i++) {
        const sp = randomSpawnHF();
        const sLoc = getLoc(sp[0], sp[1]);
        
        // Log each fauna entity creation
        const faunaEntity = AnimalConstructor({
          x: sp[0],
          y: sp[1],
          z: 0,
          home: { z: 0, loc: [sLoc[0], sLoc[1]] },
          falconry: type === 'falcon' ? false : undefined
        });
        
        // Fauna entity creation verified silently (no logging)
      }
    }
    
    return num;
  };

  spawnAnimal('deer', animalRatios.deer, totalPops.deer, Deer);
  spawnAnimal('boar', animalRatios.boar, totalPops.boar, Boar);
  spawnAnimal('wolf', animalRatios.wolf, totalPops.wolf, Wolf);
  spawnAnimal('falcon', animalRatios.falcon, totalPops.falcon, Falcon);

  // Individual tile updates are handled by tileChange function
  
  // Return statistics about what changed
  const tilesChanged = toHF.length + toF.length + toB.length;
  return {
    tilesChanged: tilesChanged,
    faunaAdded: faunaSpawned,
    tilesToHeavyForest: toHF.length,
    tilesToLightForest: toF.length,
    tilesToBrush: toB.length
  };
}

// WEATHER SYSTEM
const weatherSpawnChance = {
  fog: 0.005,  // 0.5% chance per tick (fairly common in mornings)
  storm: 0.0008 // 0.08% chance per tick (fairly frequent - approximately every 20 minutes)
};

function spawnWeather(type) {
  const mapBounds = mapSize * tileSize;
  const x = Math.random() * mapBounds;
  const y = Math.random() * mapBounds;
  
  // Scale movement speed based on map size
  // Base map (200 tiles) uses 0.05 for fog, 0.15 for storm
  const baseMapSize = 200;
  const sizeScale = mapSize / baseMapSize;
  const baseFogSpeed = 0.05;
  const baseStormSpeed = 0.15;
  
  const weather = Weather({
    x: x,
    y: y,
    weatherType: type,
    intensity: 0.5 + Math.random() * 0.5, // Random intensity 0.5-1.0
    lifetime: type === 'fog' 
      ? 99999999 // Fog uses tempus-based despawn (auto-removes by noon)
      : 60 * 60 * 3, // 3 hours for storms
    moveSpeed: type === 'fog' 
      ? baseFogSpeed * sizeScale 
      : baseStormSpeed * sizeScale // Scales with map size
  });
  
}

function updateWeather(tempus) {
  // Ensure Weather entity is defined
  if(typeof Weather === 'undefined' || !Weather.list) {
    return;
  }
  
  // Scale max counts based on map size (for consistent density)
  // Base is 200x200 map; scale proportionally
  const mapArea = mapSize * mapSize;
  const baseMapArea = 200 * 200; // 40,000 tiles
  const scaleFactor = mapArea / baseMapArea;
  
  const maxFog = Math.max(3, Math.ceil(3 * scaleFactor)); // Min 3, scales up
  const maxStorms = Math.max(3, Math.ceil(3 * scaleFactor)); // Min 3, scales up
  
  // Fog spawning (only during early morning hours)
  if(['IV.a', 'V.a', 'VI.a', 'VII.a', 'VIII.a', 'IX.a'].includes(tempus)) {
    if(Math.random() < weatherSpawnChance.fog) {
      // Check if we don't have too many fog patches already
      const fogCount = Object.values(Weather.list).filter(w => w.weatherType === 'fog').length;
      if(fogCount < maxFog) {
        spawnWeather('fog');
      }
    }
  }
  
  // Storm spawning (any time)
  if(Math.random() < weatherSpawnChance.storm) {
    const stormCount = Object.values(Weather.list).filter(w => w.weatherType === 'storm').length;
    if(stormCount < maxStorms) {
      spawnWeather('storm');
    }
  }
  
  // Update all weather entities
  Weather.update();
}

function dailyTally() {
  for (const i in Building.list) {
    const b = Building.list[i];
    if (b.built && (b.type === 'mill' || b.type === 'lumbermill' || b.type === 'mine' || b.type === 'dock')) {
      Building.list[i].tally();
    }
  }
}

// Load modular entity definitions NOW (after all globals including zones are available)
// This will be called from continueServerInitialization after zones are set up

// ============================================================================
// LOAD NAME FILES
// ============================================================================

try {
  const maleData = fsSync.readFileSync('./malenames.txt', 'utf8');
  maleNames.push(...maleData.split('\n').filter(Boolean));

  const femaleData = fsSync.readFileSync('./femalenames.txt', 'utf8');
  femaleNames.push(...femaleData.split('\n').filter(Boolean));

  const surnameData = fsSync.readFileSync('./surnames.txt', 'utf8');
  surnames.push(...surnameData.split('\n').filter(Boolean));
} catch (err) {
}

// ============================================================================
// PLAYER CLASS
// ============================================================================

// Helper function to capitalize first letter of names
function capitalizeName(name) {
  if (!name || typeof name !== 'string') return name;
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
global.capitalizeName = capitalizeName;

const Player = function(param) {
  const self = Character(param);
  self.type = param.type || 'player';
  self.name = capitalizeName(param.name);
  self.hasHorse = false;
  
  // Players MUST have a class - Character constructor sets it to null, so we override it
  // Use param.class if provided, otherwise default to SerfM
  self.class = param.class || 'SerfM';
  self.spriteSize = tileSize * 1.5;
  self.knighted = false;
  self.crowned = false;
  self.title = '';
  self.friendlyfire = false;
  
  // Spectators are no longer Player entities - they're just camera viewers

  // Input state
  self.pressingE = false;
  self.pressingT = false;
  self.pressingI = false;
  self.pressingP = false;
  self.pressingF = false;
  self.pressingH = false;
  self.pressingK = false;
  self.pressingL = false;
  self.pressingX = false;
  self.pressingC = false;
  self.pressingN = false;
  self.pressingM = false;
  self.workTargetTile = null; // Work target tile for auto-work system
  self.pendingInteraction = null; // Pending interaction target for interact mode
  self.pressing1 = false;
  self.boardCooldown = 0; // Cooldown for boarding ships
  self.isBoarded = false; // True when player is on a ship
  self.boardedShip = null; // ID of ship player is on
  self.pressing2 = false;
  self.pressing3 = false;
  self.pressing4 = false;
  self.pressing5 = false;
  self.pressing6 = false;
  self.pressing7 = false;
  self.pressing8 = false;
  self.pressing9 = false;
  self.pressing0 = false;

  self.mouseAngle = 0;
  self.mountCooldown = 0;
  self.switchCooldown = 0;
  self.hpNat = 100;
  self.spiritNat = 100;
  self.spirit = 100;
  self.spiritMax = 100;
  self.breath = 100;
  self.breathMax = 100;
  self.strength = 10;
  self.dexterity = 1;
  self.ghost = false;
  self.running = false; // Walk/run toggle
  
  // Players start with 3 torches
  self.inventory.torch = 3;
  
  // God mode (spectator camera)
  self.godMode = false;
  self.godModeReturnPos = null;
  
  // Phase 5: Kill tracking
  self.kills = 0;
  self.skulls = '';
  
  // Blockchain wallet initialization
  if (!param.wallet && self.type === 'player') {
    // Create wallet for new players
    const wallet = WalletManager.createWallet(param.id || self.id);
    self.wallet = wallet;
    
    // Initialize Gold in inventory
    self.inventory.gold = 0;
  } else if (param.wallet) {
    // Load existing wallet
    self.wallet = param.wallet;
  }

  // Player aggro interval removed - players don't need aggro checks (they choose when to fight)

  self.die = function(report) {
    var deathLocation = getLoc(self.x, self.y);
    var deathZ = self.z;
    
    // Phase 5: Kill Tracking
    var killerName = 'Unknown';
    if (report.id) {
      const killer = Player.list[report.id];
      if (killer) {
        killerName = killer.name || killer.class;
        // Kill tracking logged via death event
        
        // Track kill and award skulls
        killer.kills = (killer.kills || 0) + 1;
        
        // Update skull display based on kill count (simplified)
        if(killer.kills >= 10){
          killer.skulls = '☠️'; // Skull and crossbones
        } else if(killer.kills >= 3){
          killer.skulls = '💀'; // Single skull
        }
        
        // Kill count tracking logged via death event
        
        // Phase 6: Fauna Miniboss Growth
        if(killer.class === 'Boar' || killer.class === 'Wolf'){
          // Increase sprite size at key thresholds
          if(killer.kills >= 10){
            killer.spriteScale = 1.6; // 60% larger at 10 kills
          } else if(killer.kills >= 3){
            killer.spriteScale = 1.3; // 30% larger at 3 kills
          }
          
          // Miniboss growth logged via death event
        }
        
        // End combat for killer using simple combat system (DON'T clear combat.target before this!)
        if (global.simpleCombat) {
          global.simpleCombat.endCombat(killer);
        }
      }
    } else {
      // Death cause logged via death event
    }

    // End combat for killed player using simple combat system (DON'T clear combat.target before this!)
    if (global.simpleCombat) {
      global.simpleCombat.endCombat(self);
    }
    
    // Create death event
    if (global.eventManager) {
      const killer = report.id ? Player.list[report.id] : null;
      global.eventManager.death(self, killer, { x: self.x, y: self.y, z: deathZ });
    }
    
    // SPAWN SKELETON AT DEATH LOCATION
    var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
    Skeleton({
      id: Math.random(),
      x: deathCoords[0],
      y: deathCoords[1],
      z: deathZ,
      innaWoods: self.innaWoods || false
      // variation will be randomly generated by constructor
    });
    // Skeleton spawn logged via death event
    
    // Death broadcasts are now handled by eventManager.death() above
    
    // DROP AND SCATTER INVENTORY AND RESOURCES
    var droppedItems = [];
    
    // Drop inventory items
    if(self.inventory){
      for(var item in self.inventory){
        // Skip special inventory properties that aren't droppable items
        if(item === 'keyRing' || item === 'mapData') continue;
        
        var qty = self.inventory[item];
        if(qty > 0){
          droppedItems.push({item: item, qty: qty, type: 'inventory'});
          self.inventory[item] = 0;
        }
      }
    }
    
    // Drop store resources (grain, wood, stone, ores, etc)
    if(self.stores){
      for(var resource in self.stores){
        var qty = self.stores[resource];
        if(qty > 0){
          droppedItems.push({item: resource, qty: qty, type: 'stores'});
          self.stores[resource] = 0;
        }
      }
    }
    
    // Scatter items in random pattern around skeleton
    if(droppedItems.length > 0){
      // Item drops logged via death event
      
      for(var i in droppedItems){
        var drop = droppedItems[i];
        
        // Random offset from death location (within 2 tiles)
        var offsetX = (Math.random() - 0.5) * tileSize * 2;
        var offsetY = (Math.random() - 0.5) * tileSize * 2;
        
        // Use itemFactory to create all items (now properly compatible with Item system)
        if(global.itemFactory){
          global.itemFactory.createItem(drop.item, {
            id: Math.random(),
            x: deathCoords[0] + offsetX,
            y: deathCoords[1] + offsetY,
            z: deathZ,
            qty: drop.qty,
            innaWoods: self.innaWoods || false
          });
        }
      }
    }
    
    // Death broadcasts are now handled by eventManager.death() above
    
    // GHOST MODE FOR PLAYERS (NPCs respawn immediately)
    if(self.type === 'player'){
      // Enter ghost mode
      self.ghost = true;
      self.ghostTimer = 5400; // 5400 frames = 1 minute 30 seconds at 60fps
      self.hp = 1; // Ghost has minimal HP (can't die again)
      self.baseSpd = 4; // Fixed ghost speed (run speed)
      self.maxSpd = 4;
      self.drag = 1; // No terrain modifiers affect ghosts
      self.running = false; // Disable run toggle
      
      // Clear all work flags that might block movement
      self.working = false;
      self.chopping = false;
      self.mining = false;
      self.farming = false;
      self.building = false;
      self.fishing = false;
      
      // If underwater when dying, immediately move to surface to prevent death loop
      if(self.z === Z_LEVELS.UNDERWATER){
        self.z = Z_LEVELS.OVERWORLD;
        self.breath = self.breathMax; // Restore breath
      }
      
      // Player aggro interval removed - players don't need aggro checks
      
      // Clear combat state
      self.combat.target = null;
      self.action = null;
      self.path = null;
      self.pathCount = 0;
      
      // Send death message with ghost instructions
      var socket = SOCKET_LIST[self.id];
      if(socket){
        var deathMsg = '<span style="color:#ff0000;"><b>☠️ YOU DIED</b></span>';
        if(report.id){
          var killer = Player.list[report.id];
          if(killer){
            deathMsg += '<br>Killed by: ' + (killer.name || killer.class);
          }
        } else if(report.cause){
          deathMsg += '<br>Cause: ' + report.cause;
        }
        if(droppedItems.length > 0){
          deathMsg += '<br><i>Your items have been dropped at the death location</i>';
        }
        deathMsg += '<br><br><span style="color:#aaaaff;">👻 You are now a ghost. Move to where you want to respawn.</span>';
        deathMsg += '<br><i>Auto-respawn in 1:30, or type /respawn to respawn at home</i>';
        socket.write(JSON.stringify({msg:'addToChat',message: deathMsg}));
        // Trigger ghost mode audio/visual
        socket.write(JSON.stringify({msg:'ghostMode', active: true}));
      }
      
      // Ghost mode entry logged via death event
    } else {
      // NPC - immediate respawn
      self.hp = self.hpMax;
      const spawn = randomSpawnO();
      self.x = spawn[0];
      self.y = spawn[1];
      self.z = 0;
      
      self.combat.target = null;
      self.action = null;
      self.innaWoods = false;
      self.onMtn = false;
      self.path = null;
      self.pathCount = 0;
      
      // NPC respawn logged via death event
    }
  };

  // Ghost respawn handler
  self.respawnFromGhost = function(location, isManualRespawn){
    if(!self.ghost) return;
    
    self.ghost = false;
    self.ghostTimer = 0;
    self.hp = self.hpMax;
    
    if(location){
      // Respawn at specified location
      self.x = location.x;
      self.y = location.y;
      self.z = location.z || 0;
    }
    // else respawn at current ghost location
    
    // Only face up if manually respawning via command (toward fireplace at home)
    if(isManualRespawn){
      self.facing = 'up';
    }
    
    // Clear ghost state
    self.innaWoods = false;
    self.onMtn = false;
    self.revealed = false; // Clear stealth revealed state
    
      // Player aggro interval removed - players don't need aggro checks
    
    // Brief immunity after respawn
    self.respawnImmunity = true;
    setTimeout(() => {
      self.respawnImmunity = false;
    }, 3000);
    
    var socket = SOCKET_LIST[self.id];
    if(socket){
      // Respawn message handled via event system
      if(global.eventManager){
        global.eventManager.createEvent({
          category: global.eventManager.categories.DEATH,
          subject: self.id,
          subjectName: self.name,
          action: 'respawned from ghost',
          communication: global.eventManager.commModes.PLAYER,
          message: '<span style="color:#66ff66;">✨ You have respawned!</span>',
          log: `[RESPAWN] ${self.name} respawned from ghost at [${getLoc(self.x, self.y)}] z=${self.z}`,
          position: { x: self.x, y: self.y, z: self.z }
        });
      }
      // Restore normal audio/visual
      socket.write(JSON.stringify({msg:'ghostMode', active: false}));
    }
    
    // Respawn logged via event system
  };
  
  // checkAggro() removed - NPCs now use SimpleCombat.checkAggro() directly
  // Players don't need aggro checks (they choose when to engage)

  self.lightTorch = function(torchId) {
    const socket = SOCKET_LIST[self.id];

    if (self.hasTorch) {
      Item.list[self.hasTorch].toRemove = true;
      self.hasTorch = false;
    } else if (self.inventory.torch > 0) {
      if (self.z !== Z_LEVELS.UNDERWATER) {
        LitTorch({
          id: torchId,
          parent: self.id,
          x: self.x,
          y: self.y,
          z: self.z,
          qty: 1,
          innaWoods: self.innaWoods
        });
        self.inventory.torch--;
        self.hasTorch = torchId;
      } else {
        // Torch message handled via event system
        if(global.eventManager){
          global.eventManager.createEvent({
            category: global.eventManager.categories.SOCIAL,
            subject: self.id,
            subjectName: self.name,
            action: 'cannot light torch here',
            communication: global.eventManager.commModes.PLAYER,
            message: '<i>You cannot do that here.</i>',
            log: `[SOCIAL] ${self.name} cannot light torch at [${Math.floor(self.x)},${Math.floor(self.y)}] z=${self.z}`,
            position: { x: self.x, y: self.y, z: self.z }
          });
        }
      }
    } else {
      // No torch message handled via event system
      if(global.eventManager){
        global.eventManager.createEvent({
          category: global.eventManager.categories.SOCIAL,
          subject: self.id,
          subjectName: self.name,
          action: 'has no torches',
          communication: global.eventManager.commModes.PLAYER,
          message: '<i>You have no torches.</i>',
          log: `[SOCIAL] ${self.name} has no torches`,
          position: { x: self.x, y: self.y, z: self.z }
        });
      }
    }
  };

  self.updateSpd = function() {
    let loc = getLoc(self.x, self.y);
    const currentTile = getTile(0, loc[0], loc[1]);
    
    // Apply terrain modifiers BEFORE movement
    const socket = SOCKET_LIST[self.id];
    
    // Ghosts have fixed speed and ignore terrain modifiers
    if (self.ghost) {
      self.baseSpd = 4;
      self.maxSpd = 4;
      self.onMtn = false;
      
      // Set innaWoods for rendering (trees around ghost)
      if (self.z === Z_LEVELS.OVERWORLD) {
        self.innaWoods = (currentTile >= TERRAIN.HEAVY_FOREST && currentTile < TERRAIN.LIGHT_FOREST);
      } else {
        self.innaWoods = false;
      }
      
      // Don't return early - need to reach movement logic below!
    }
    // Set base speed (walk vs run) - non-ghosts only
    else if (self.running) {
      self.baseSpd = 4;
    } else {
      self.baseSpd = 2;
    }
    
    // Set maxSpd based on terrain - non-ghosts only
    if (!self.ghost && self.z === Z_LEVELS.OVERWORLD) {
      if (currentTile >= TERRAIN.HEAVY_FOREST && currentTile < TERRAIN.LIGHT_FOREST) {
        self.innaWoods = true;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.3) * self.drag;
      } else if (currentTile >= TERRAIN.LIGHT_FOREST && currentTile < TERRAIN.ROCKS) {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.5) * self.drag;
      } else if (currentTile >= TERRAIN.ROCKS && currentTile < TERRAIN.MOUNTAIN) {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.6) * self.drag;
      } else if (currentTile >= TERRAIN.MOUNTAIN && currentTile < TERRAIN.CAVE_ENTRANCE) {
        self.innaWoods = false;
        self.maxSpd = (self.baseSpd * (self.onMtn ? 0.5 : 0.2)) * self.drag;
        if (!self.onMtn) {
          setTimeout(() => {
            // Check CURRENT location, not stale loc from 2 seconds ago
            const currentLoc = getLoc(self.x, self.y);
            const checkTile = getTile(0, currentLoc[0], currentLoc[1]);
            if (checkTile >= TERRAIN.MOUNTAIN && checkTile < TERRAIN.CAVE_ENTRANCE) {
              self.onMtn = true;
            }
          }, 2000);
        }
      } else if (currentTile === TERRAIN.ROAD) {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 1.1) * self.drag;
      } else {
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = self.baseSpd * self.drag;
      }
    } else if (!self.ghost && self.z === Z_LEVELS.UNDERWATER) {
      // Underwater is VERY slow - disable running and apply heavy penalty
      self.running = false; // Force walking underwater
      self.baseSpd = 2; // Reset to walk speed
      self.maxSpd = (self.baseSpd * 0.1) * self.drag; // 90% speed reduction
      self.innaWoods = false;
      self.onMtn = false;
    } else if (!self.ghost) {
      // Other z-levels: use base speed
      self.maxSpd = self.baseSpd * self.drag;
    }
    const offsets = {
      right: [tileSize / 8, 0],
      left: [-tileSize / 8, 0],
      up: [0, -tileSize / 8],
      down: [0, tileSize / 2]
    };

    const checkLocs = {
      right: getLoc(self.x + offsets.right[0], self.y),
      left: getLoc(self.x + offsets.left[0], self.y),
      up: getLoc(self.x, self.y + offsets.up[1]),
      down: getLoc(self.x, self.y + offsets.down[1])
    };

    const blocked = {
      right: false,
      left: false,
      up: false,
      down: false
    };

    const b = getBuilding(self.x, self.y);
    const exit = getBuilding(self.x, self.y - tileSize);
    const b2 = getBuilding(self.x, self.y + tileSize);

    // Ghosts ignore all terrain collision, only blocked by map bounds
    if (self.ghost) {
      // Block map bounds for all z-levels
        for (const dir in checkLocs) {
        const outOfBounds = (dir === 'right' && self.x + 10 > mapPx - tileSize) ||
                           (dir === 'left' && self.x - 10 < 0) ||
                           (dir === 'up' && self.y - 10 < 0) ||
                           (dir === 'down' && self.y + 10 > mapPx - tileSize);
        if (outOfBounds) {
            blocked[dir] = true;
        }
      }
    } else {
      if (self.z === Z_LEVELS.OVERWORLD) {
        for (const dir in checkLocs) {
          const [c, r] = checkLocs[dir];
          const tile = getTile(0, c, r);
          const doorLocked = tile === TERRAIN.DOOR_LOCKED && !keyCheck(self.x + offsets[dir][0], self.y + offsets[dir][1], self.id);
          // Allow stepping onto cave entrance tile (6) to trigger descent
          const isBlocked = (!isWalkable(0, c, r) && tile !== TERRAIN.WATER && tile !== 6);
          const gateBlocked = getTile(5, c, r) === 'gatec' && !gateCheck(self.x + offsets[dir][0], self.y + offsets[dir][1], self.house, self.kingdom);
          const outOfBounds = (dir === 'right' && self.x + 10 > mapPx - tileSize) ||
                             (dir === 'left' && self.x - 10 < 0) ||
                             (dir === 'up' && self.y - 10 < 0) ||
                             (dir === 'down' && self.y + 10 > mapPx - tileSize);

          if ((doorLocked || isBlocked || gateBlocked || outOfBounds) && isWalkable(0, loc[0], loc[1])) {
            blocked[dir] = true;
          }
        }
      } else if (self.z === Z_LEVELS.UNDERWORLD) {
        for (const dir in checkLocs) {
          const [c, r] = checkLocs[dir];
          const tile = getTile(1, c, r);
          const walkable = isWalkable(-1, c, r);
          // Cave: Floor (0), Exit (2), and Ore (3.x) are walkable; Walls (1) are not
          const isBlocked = (tile === 1); // Simple: only walls block movement
          const outOfBounds = (dir === 'right' && self.x + 10 > mapPx - tileSize) ||
                             (dir === 'left' && self.x - 10 < 0) ||
                             (dir === 'up' && self.y - 10 < 0) ||
                             (dir === 'down' && self.y + 10 > mapPx - tileSize);

          if (isBlocked || outOfBounds) {
            blocked[dir] = true;
          }
        }
      } else if (self.z === Z_LEVELS.BUILDING_1) {
        for (const dir in checkLocs) {
          const [c, r] = checkLocs[dir];
          const isBlocked = !isWalkable(1, c, r);
          const stairsBlocked = dir === 'up' && getTile(4, c, r) === 7 && !self.rank &&
                               (Building.list[b]?.house === self.house || Building.list[b]?.kingdom === self.kingdom);

          if (isBlocked || stairsBlocked) {
            blocked[dir] = true;
          }
        }
      } else if (self.z === Z_LEVELS.BUILDING_2) {
        for (const dir in checkLocs) {
          const [c, r] = checkLocs[dir];
          if (!isWalkable(2, c, r)) {
            blocked[dir] = true;
          }
        }
      } else if (self.z === Z_LEVELS.CELLAR) {
        for (const dir in checkLocs) {
          const [c, r] = checkLocs[dir];
          if (!isWalkable(-2, c, r)) {
            blocked[dir] = true;
          }
        }
      }
    } // End of ghost collision check

    // PATH-BASED MOVEMENT - Follow pathfinding waypoints (using NPC approach)
    // CRITICAL: Skip path following if zTransitionHalt is active
    // This prevents infinite loops when stairs move the player back toward the stair tile
    if(self.zTransitionHalt){
      // Clear movement flags and skip path following entirely
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingDown = false;
      self.pressingUp = false;
      // Decrement cooldown if active
      if(self.zTransitionCooldown > 0){
        self.zTransitionCooldown--;
      }
      // Skip all path-based movement
    } else if(self.path && self.path.length > 0){
      if(self.pathCount < self.path.length){
        var next = self.path[self.pathCount];
        var dest = getCenter(next[0], next[1]);
        var dx = dest[0];
        var dy = dest[1];
        var diffX = dx - self.x;
        var diffY = dy - self.y;
        
        // Clear movement flags at start
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingDown = false;
        self.pressingUp = false;
        
        // Move toward waypoint (same as NPCs)
        if(diffX >= self.maxSpd){
          if(!blocked.right) self.x += self.maxSpd;
          self.pressingRight = true;
	    self.facing = 'right';
        } else if(diffX <= (0-self.maxSpd)){
          if(!blocked.left) self.x -= self.maxSpd;
          self.pressingLeft = true;
	    self.facing = 'left';
        }
        if(diffY >= self.maxSpd){
          if(!blocked.down) self.y += self.maxSpd;
          self.pressingDown = true;
          if(Math.abs(diffX) <= Math.abs(diffY)) self.facing = 'down';
        } else if(diffY <= (0-self.maxSpd)){
          if(!blocked.up) self.y -= self.maxSpd;
          self.pressingUp = true;
          if(Math.abs(diffX) <= Math.abs(diffY)) self.facing = 'up';
        }
        
        // Check if reached waypoint (both X and Y within maxSpd range)
        // Only snap if we've actually moved toward the waypoint (prevent immediate snap on new path)
        var distanceToWaypoint = Math.sqrt(diffX*diffX + diffY*diffY);
        if((diffX < self.maxSpd && diffX > (0-self.maxSpd)) && (diffY < self.maxSpd && diffY > (0-self.maxSpd)) && distanceToWaypoint < tileSize){
          // Snap to exact waypoint position for precise tile alignment
          self.x = dx;
          self.y = dy;
          // Clear movement flags immediately when waypoint reached
          self.pressingRight = false;
          self.pressingLeft = false;
          self.pressingDown = false;
          self.pressingUp = false;
          self.pathCount++;
        }
      } else {
        // Path complete (pathCount >= path.length or path is null/empty)
        // Check if we have a pending interaction to trigger
        if(self.pendingInteraction && !self.ghost){
          // Verify player is actually adjacent before triggering interaction
          var playerLoc = getLoc(self.x, self.y);
          var entity = null;
          if(self.pendingInteraction.type === 'building'){
            entity = Building.list[self.pendingInteraction.id];
          } else if(self.pendingInteraction.type === 'item'){
            entity = Item.list[self.pendingInteraction.id];
          } else if(self.pendingInteraction.type === 'ship'){
            entity = Player.list[self.pendingInteraction.id];
          }
          
          // Only trigger if player is adjacent (safety check)
          if(entity && isPlayerAdjacentToEntity(entity, self.pendingInteraction.type, playerLoc)){
            // Use the building/item location from pendingInteraction, not player's current location
            var interactionLoc = null;
            if(self.pendingInteraction.type === 'building'){
              var building = Building.list[self.pendingInteraction.id];
              if(building){
                // For buildings, use the interactable tile location
                // For docks: use plot[4] (the non-walkable tile)
                // For mills/lumbermills/mines: use any plot tile (all are interactable)
                if(building.plot && Array.isArray(building.plot)){
                  if(building.type === 'dock' && building.plot[4]){
                    // Dock: use plot[4] (the non-walkable interactable tile)
                    interactionLoc = building.plot[4];
                  } else if(building.plot.length > 0){
                    // Other buildings: use first plot tile (all are interactable)
                    interactionLoc = building.plot[0];
                  }
                }
                // Fallback to building center if plot not available
                if(!interactionLoc){
                  interactionLoc = getLoc(building.x, building.y);
                }
                
                // Face the building
                if(interactionLoc){
                  self.facing = calculateFacingDirection(playerLoc, interactionLoc);
                }
              }
            } else if(self.pendingInteraction.type === 'item'){
              var item = Item.list[self.pendingInteraction.id];
              if(item){
                // Use item's location
                interactionLoc = getLoc(item.x, item.y);
                
                // Face the chest/item
                var itemLoc = interactionLoc;
                var diffX = itemLoc[0] - playerLoc[0];
                var diffY = itemLoc[1] - playerLoc[1];
                
                if(Math.abs(diffX) > Math.abs(diffY)){
                  if(diffX > 0) self.facing = 'right';
                  else self.facing = 'left';
                } else {
                  if(diffY > 0) self.facing = 'down';
                  else self.facing = 'up';
                }
              }
            } else if(self.pendingInteraction.type === 'ship'){
              // Ship boarding - validate ownership/dock status before boarding
              var ship = Player.list[self.pendingInteraction.id];
              if(ship){
                // Cargo ships are always boardable (public transport)
                if(ship.shipType !== 'cargoship'){
                  var isAtDock = ship.mode === 'docked';
                  if(isAtDock && (!ship.owner || ship.owner !== socket.id)){
                    // Ship is at dock and player doesn't own it - reject
                    socket.write(JSON.stringify({
                      msg: 'addToChat',
                      message: '<i>This is not your ship.</i>'
                    }));
                    // Clear pending interaction and return
                    self.pendingInteraction = null;
                    return;
                  }
                  // If not at dock, allow boarding (ship is abandoned/available)
                }
                
                // Board the ship
                if(typeof ship.boardPassenger === 'function'){
                  ship.boardPassenger(socket.id);
                }
              }
              // Clear pending interaction and return early (don't call Interact)
              self.pendingInteraction = null;
              return;
            }
            
            // Fallback to player's current location if we couldn't get entity location
            if(!interactionLoc){
              interactionLoc = getLoc(self.x, self.y);
            }
            
            // Trigger interaction
            Interact(socket.id, interactionLoc);
          }
          // Clear pending interaction (whether interaction triggered or not)
          self.pendingInteraction = null;
        }
        
        // Check if player has a work target and is at the target location
        if(self.workTargetTile && !self.working && !self.ghost){
          var currentLoc = getLoc(self.x, self.y);
          var atTarget = (currentLoc[0] === self.workTargetTile.tileX && 
                         currentLoc[1] === self.workTargetTile.tileY && 
                         self.z === self.workTargetTile.z);
          
          // For fishing, check if player is at a land tile adjacent to the water tile
          if(self.workTargetTile.workType === 'fishing' && self.workTargetTile.fishingWaterTile){
            var waterTile = self.workTargetTile.fishingWaterTile;
            var adjacent = (
              (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y) ||
              (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y) ||
              (currentLoc[0] === waterTile.x && currentLoc[1] === waterTile.y - 1) ||
              (currentLoc[0] === waterTile.x && currentLoc[1] === waterTile.y + 1) ||
              (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y - 1) ||
              (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y - 1) ||
              (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y + 1) ||
              (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y + 1)
            );
            if(adjacent){
              atTarget = true;
            }
          }
          
          if(atTarget){
            // Start work on the target tile
            self.handleWorkAction();
          }
        }
        
        self.path = null;
        self.pathCount = 0;
        self.pressingRight = false;
        self.pressingLeft = false;
        self.pressingUp = false;
        self.pressingDown = false;
      }
    } else {
      // No path - clear movement flags
      self.pressingRight = false;
      self.pressingLeft = false;
      self.pressingUp = false;
      self.pressingDown = false;
    }

    // Terrain effects and Z-level transitions
    // Recalculate loc after movement (path-following may have updated position)
    loc = getLoc(self.x, self.y);
    const tile = getTile(0, loc[0], loc[1]);

    if (self.z === Z_LEVELS.OVERWORLD) {
      self.handleOverworldTerrain(tile, loc, b, exit, socket);
    } else if (self.z === Z_LEVELS.UNDERWORLD) {
      if (getTile(1, loc[0], loc[1]) === 2) {
        self.z = Z_LEVELS.OVERWORLD;
        self.innaWoods = false;
        self.onMtn = false;
        self.maxSpd = (self.baseSpd * 0.9) * self.drag;
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
      }
    } else if (self.z === Z_LEVELS.CELLAR) {
      // Only transition if player doesn't already have a path (prevents re-triggering)
      if (!self.path || self.path.length === 0) {
        if (getTile(8, loc[0], loc[1]) === 5) {
          // Going upstairs from cellar to z=1
          self.z = Z_LEVELS.BUILDING_1;
          socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
          
          // Path to tile below stairs instead of teleporting
          var targetTile = [loc[0], loc[1] + 1];
          var path = global.tilemapSystem.findPath(loc, targetTile, 3); // Layer 3 for z=1
          self.path = path;
          self.pathCount = 0;
        }
      }
    } else if (self.z === Z_LEVELS.UNDERWATER) {
      self.handleUnderwater(tile, socket);
    } else if (self.z === Z_LEVELS.BUILDING_1) {
      self.handleBuilding1(loc, exit, b2, socket);
    } else if (self.z === Z_LEVELS.BUILDING_2) {
      // Only transition if player doesn't already have a path (prevents re-triggering)
      if (!self.path || self.path.length === 0) {
        if (getTile(4, loc[0], loc[1]) === 3 || getTile(4, loc[0], loc[1]) === 4) {
          // Going downstairs to z=1
          self.z = Z_LEVELS.BUILDING_1;
          socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
          
          // Path to tile below stairs instead of teleporting
          var targetTile = [loc[0], loc[1] + 1];
          var path = global.tilemapSystem.findPath(loc, targetTile, 3); // Layer 3 for z=1
          self.path = path;
          self.pathCount = 0;
        }
      }
    }
  };

  self.stopWorking = function() {
    self.working = false;
    self.chopping = false;
    self.mining = false;
    self.farming = false;
    self.building = false;
    self.fishing = false;
  };

  self.handleOverworldTerrain = function(tile, loc, b, exit, socket) {
    // Ghosts skip terrain handling (handled in updateSpd already)
    if (self.ghost) {
      // Allow cave entrance transition for ghosts
      if (tile === TERRAIN.CAVE_ENTRANCE) {
        self.z = Z_LEVELS.UNDERWORLD;
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
      }
      // Allow building door transitions for ghosts
      else if (tile === TERRAIN.DOOR_OPEN || tile === TERRAIN.DOOR_OPEN_ALT || tile === TERRAIN.DOOR_LOCKED) {
        if(b && Building.list[b]){
          Building.list[b].occ++;
        }
        self.z = Z_LEVELS.BUILDING_1;
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b }));
      }
      // Don't modify speed or other properties - already set in updateSpd
      return;
    }
    
    // Non-ghost terrain handling
    if (tile === TERRAIN.CAVE_ENTRANCE) {
      self.z = Z_LEVELS.UNDERWORLD;
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
      socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
    } else if (tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.LIGHT_FOREST) {
      self.innaWoods = true;
      self.onMtn = false;
      self.maxSpd = (self.baseSpd * 0.3) * self.drag;
    } else if (tile >= TERRAIN.LIGHT_FOREST && tile < TERRAIN.ROCKS) {
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = (self.baseSpd * 0.5) * self.drag;
    } else if (tile >= TERRAIN.ROCKS && tile < TERRAIN.MOUNTAIN) {
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = (self.baseSpd * 0.6) * self.drag;
    } else if (tile >= TERRAIN.MOUNTAIN && tile < TERRAIN.CAVE_ENTRANCE) {
      self.innaWoods = false;
      self.maxSpd = (self.baseSpd * (self.onMtn ? 0.5 : 0.2)) * self.drag;

      if (!self.onMtn) {
        setTimeout(() => {
          const currentTile = getTile(0, loc[0], loc[1]);
          if (currentTile >= TERRAIN.MOUNTAIN && currentTile < TERRAIN.CAVE_ENTRANCE) {
            self.onMtn = true;
          }
        }, 2000);
      }
    } else if (tile === TERRAIN.ROAD) {
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = (self.baseSpd * 1.1) * self.drag;
    } else if (tile === TERRAIN.DOOR_OPEN || tile === TERRAIN.DOOR_OPEN_ALT) {
      // Safety check: only increment occupancy if building exists
      if(b && Building.list[b]){
        Building.list[b].occ++;
      }
      self.z = Z_LEVELS.BUILDING_1;
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
      setTimeout(() => {
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b }));
      }, 100);
    } else if (tile === TERRAIN.DOOR_LOCKED) {
      // Safety check: only increment occupancy if building exists
      if(b && Building.list[b]){
        Building.list[b].occ++;
      }
      self.z = Z_LEVELS.BUILDING_1;
        // Door unlock message handled via event system
        if(global.eventManager){
          global.eventManager.createEvent({
            category: global.eventManager.categories.SOCIAL,
            subject: self.id,
            subjectName: self.name,
            action: 'unlocked door',
            communication: global.eventManager.commModes.PLAYER,
            message: '<i>🗝 You unlock the door.</i>',
            log: `[SOCIAL] ${self.name} unlocked door at [${Math.floor(self.x)},${Math.floor(self.y)}] z=${self.z}`,
            position: { x: self.x, y: self.y, z: self.z }
          });
        }
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
      setTimeout(() => {
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b }));
      }, 100);
    } else if (tile === TERRAIN.WATER && !self.ghost) {
      // Ghosts can walk over water without going underwater
      self.z = Z_LEVELS.UNDERWATER;
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = (self.baseSpd * 0.2) * self.drag;
      socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
    } else {
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
    }
  };

  self.handleUnderwater = function(tile, socket) {
    // Skip drowning damage in god mode
    if(self.godMode){
      return;
    }
    
    // Ensure underwater speed penalty is applied (handled in updateSpd now)
    if (self.breath > 0) {
      self.breath -= 0.25;
    } else {
      self.hp -= 0.5;
    }

    if (self.hp !== null && self.hp <= 0) {
      self.die({ cause: 'drowned' });
    }

    const loc = getLoc(self.x, self.y);
    if (getTile(0, loc[0], loc[1]) !== TERRAIN.WATER) {
      // Surfaced from water
      self.z = Z_LEVELS.OVERWORLD;
      self.breath = self.breathMax;
      self.innaWoods = false;
      self.onMtn = false;
      socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
    }
  };

  self.handleBuilding1 = function(loc, exit, b2, socket) {
    const exitTile = getTile(0, loc[0], loc[1] - 1);
    if (exitTile === TERRAIN.DOOR_OPEN || exitTile === TERRAIN.DOOR_OPEN_ALT || exitTile === TERRAIN.DOOR_LOCKED) {
      // Safety check: only decrement occupancy if building exists
      if(exit && Building.list[exit]){
        Building.list[exit].occ--;
      }
      self.z = Z_LEVELS.OVERWORLD;
      socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
    } else if (!self.path || self.path.length === 0) {
      // Only transition if player doesn't already have a path (prevents re-triggering)
      const stairs = getTile(4, loc[0], loc[1]);
      if (stairs === 3 || stairs === 4 || stairs === 7) {
        // Going upstairs to z=2
        self.z = Z_LEVELS.BUILDING_2;
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
        
        // Path to tile below stairs instead of teleporting
        var targetTile = [loc[0], loc[1] + 1];
        var path = global.tilemapSystem.findPath(loc, targetTile, 5); // Layer 5 for z=2
        self.path = path;
        self.pathCount = 0;
      } else if (stairs === 5 || stairs === 6) {
        // Going to cellar z=-2
        self.z = Z_LEVELS.CELLAR;
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
        
        // Path to tile below stairs instead of teleporting
        var targetTile = [loc[0], loc[1] + 1];
        var path = global.tilemapSystem.findPath(loc, targetTile, 8); // Layer 8 for z=-2
        self.path = path;
        self.pathCount = 0;
      }
    }
  };

  self.update = function() {
    // Boarded players should not run normal update logic - position is controlled by the ship
    if (self.isBoarded) {
      return;
    }
    
    // ===== NEW: Using prototype methods =====
    Character.prototype.updateCooldowns.call(this); // Handles all cooldown timers
    Character.prototype.updateRegeneration.call(this); // Handles HP/Spirit regen
    
    self.updateSpd();
    self.zoneCheck();

    if (self.stealthed) {
      self.revealCheck();
    }

    // OLD: if (self.actionCooldown > 0) self.actionCooldown--;
    // OLD: if (self.attackCooldown > 0) self.attackCooldown--;
    // OLD: if (self.mountCooldown > 0) self.mountCooldown--;
    // OLD: if (self.switchCooldown > 0) self.switchCooldown--;
    // OLD: if (self.pathCooldown > 0) self.pathCooldown--;
    // OLD: if (self.boardCooldown > 0) self.boardCooldown--;
    // OLD: 
    // OLD: // Passive HP/Spirit Regeneration (also implemented in Character for NPCs)
    // OLD: if(!self.ghost && self.hp < self.hpMax){
    // OLD:   // Regenerate HP at ~0.0042 per frame = 0.25 HP/second at 60fps
    // OLD:   self.hp = Math.min(self.hp + 0.0042, self.hpMax);
    // OLD: }
    // OLD: 
    // OLD: if(!self.ghost && self.spirit < self.spiritMax){
    // OLD:   // Regenerate Spirit at ~0.0017 per frame = 0.1 Spirit/second at 60fps
    // OLD:   self.spirit = Math.min(self.spirit + 0.0017, self.spiritMax);
    // OLD: }

    // PLAYER AUTO-COMBAT - Auto-follow and auto-attack when in combat mode or attack intent
    // SimpleCombat.update() handles all validation internally, no need for duplicate checks
    // Always update if combatState exists - update() method handles validation and cleanup
    if (self.combatState && (!self.autoAttackPaused || self.combatState.pendingTarget)) {
      // Use SimpleCombat system for player auto-combat (same as NPCs)
      // This handles both normal combat and attack intent, including all validation
      if (global.simpleCombat) {
        if (global.debugCombat && self.combatState && self.combatState.pendingTarget) {
          console.log(`[PlayerUpdate] Attack intent detected ${self.id} -> ${self.combatState.pendingTarget}`);
        }
        global.simpleCombat.update(self);
      }
    }

    // COMBAT ESCAPE - SimpleCombat.endCombat() handles escape logic internally
    // Escape is handled when distance exceeds maxChaseRange in SimpleCombat.update()
    // This section removed to eliminate duplicate escape logic

    // TORCH - disabled for ghosts
    if (self.pressingT && self.actionCooldown === 0 && !self.ghost) {
      self.lightTorch(Math.random());
      self.actionCooldown = 10;
    }

    // PICKUP - disabled for ghosts
    if (self.pressingP && self.actionCooldown === 0 && !self.working && !self.ghost) {
      const socket = SOCKET_LIST[self.id];
      self.actionCooldown = 10;

      for (const i in Item.list) {
        const item = Item.list[i];
        const dist = item.getDistance({ x: self.x, y: self.y });

        if (dist < tileSize && item.canPickup) {
          Item.list[i].toUpdate = true;
          Item.list[i].pickup(self.id);
          return;
        }
      }
      // Nothing to pickup message handled via event system
      if(global.eventManager){
        global.eventManager.createEvent({
          category: global.eventManager.categories.ITEM,
          subject: self.id,
          subjectName: self.name,
          action: 'nothing to pick up',
          communication: global.eventManager.commModes.PLAYER,
          message: '<i>There is nothing to pick up.</i>',
          log: `[ITEM] ${self.name} found nothing to pick up at [${Math.floor(self.x)},${Math.floor(self.y)}] z=${self.z}`,
          position: { x: self.x, y: self.y, z: self.z }
        });
      }
    }

    // HORSE - disabled for ghosts
    if (self.pressingH && self.actionCooldown === 0 && !self.working && !self.ghost) {
      const socket = SOCKET_LIST[self.id];

      if (self.mounted) {
        self.actionCooldown = 10;
        self.mounted = false;
        self.baseSpd -= 3;
        self.mountCooldown = 200;
      } else {
        if (self.hasHorse) {
          if (self.gear.armor && self.gear.armor.type !== 'cloth') {
            if (self.mountCooldown === 0) {
              self.actionCooldown = 10;
              self.mounted = true;
              self.baseSpd += 3;
            } else {
              // Try again message handled via event system
              if(global.eventManager){
                global.eventManager.createEvent({
                  category: global.eventManager.categories.SOCIAL,
                  subject: self.id,
                  subjectName: self.name,
                  action: 'try again shortly',
                  communication: global.eventManager.commModes.PLAYER,
                  message: '<i>Try again shortly.</i>',
                  log: `[SOCIAL] ${self.name} tried horse action too soon`,
                  position: { x: self.x, y: self.y, z: self.z }
                });
              }
            }
          } else {
            // No riding gear message handled via event system
            if(global.eventManager){
              global.eventManager.createEvent({
                category: global.eventManager.categories.SOCIAL,
                subject: self.id,
                subjectName: self.name,
                action: 'not wearing riding gear',
                communication: global.eventManager.commModes.PLAYER,
                message: '<i>You are not wearing any riding gear.</i>',
                log: `[SOCIAL] ${self.name} not wearing riding gear`,
                position: { x: self.x, y: self.y, z: self.z }
              });
            }
          }
        } else {
          // No horse message handled via event system
          if(global.eventManager){
            global.eventManager.createEvent({
              category: global.eventManager.categories.SOCIAL,
              subject: self.id,
              subjectName: self.name,
              action: 'does not own horse',
              communication: global.eventManager.commModes.PLAYER,
              message: '<i>You do not own a horse.</i>',
              log: `[SOCIAL] ${self.name} does not own horse`,
              position: { x: self.x, y: self.y, z: self.z }
            });
          }
        }
      }
    }

    // SWITCH WEAPONS
    if (self.pressingX && self.actionCooldown === 0) {
      const socket = SOCKET_LIST[self.id];

      if (self.switchCooldown === 0) {
        if (self.gear.weapon) {
          if (self.gear.weapon2) {
            const switchwep = self.gear.weapon2;
            self.gear.weapon2 = self.gear.weapon;
            self.gear.weapon = switchwep;
            self.actionCooldown = 10;
            // Weapon switch message handled via event system
            if(global.eventManager){
              global.eventManager.createEvent({
                category: global.eventManager.categories.SOCIAL,
                subject: self.id,
                subjectName: self.name,
                action: 'switched weapons',
                communication: global.eventManager.commModes.PLAYER,
                message: `<i>You switch weapons to </i><b>${self.gear.weapon.name}</b>.`,
                log: `[SOCIAL] ${self.name} switched weapons to ${self.gear.weapon.name}`,
                position: { x: self.x, y: self.y, z: self.z }
              });
            }
          } else {
            // No secondary weapon message handled via event system
            if(global.eventManager){
              global.eventManager.createEvent({
                category: global.eventManager.categories.SOCIAL,
                subject: self.id,
                subjectName: self.name,
                action: 'no secondary weapon',
                communication: global.eventManager.commModes.PLAYER,
                message: '<i>You have no secondary weapon equipped.</i>',
                log: `[SOCIAL] ${self.name} has no secondary weapon`,
                position: { x: self.x, y: self.y, z: self.z }
              });
            }
          }
        } else {
          // No weapons message handled via event system
          if(global.eventManager){
            global.eventManager.createEvent({
              category: global.eventManager.categories.SOCIAL,
              subject: self.id,
              subjectName: self.name,
              action: 'no weapons equipped',
              communication: global.eventManager.commModes.PLAYER,
              message: '<i>You have no weapons equipped.</i>',
              log: `[SOCIAL] ${self.name} has no weapons equipped`,
              position: { x: self.x, y: self.y, z: self.z }
            });
          }
        }
      } else {
        // Try again message handled via event system
        if(global.eventManager){
          global.eventManager.createEvent({
            category: global.eventManager.categories.SOCIAL,
            subject: self.id,
            subjectName: self.name,
            action: 'try again shortly',
            communication: global.eventManager.commModes.PLAYER,
            message: '<i>Try again shortly.</i>',
            log: `[SOCIAL] ${self.name} tried weapon switch too soon`,
            position: { x: self.x, y: self.y, z: self.z }
          });
        }
      }
    }

    // INTERACTIONS (disabled for ghosts)
    if (self.pressingAttack && self.actionCooldown === 0 && !self.working && !self.ghost) {
      const loc = getLoc(self.x, self.y);
      
      // Dock and ship boarding is now handled via dock menu or automatic proximity
      // (no spacebar boarding)
      
      const dirOffsets = {
        down: [0, 1],
        up: [0, -1],
        left: [-1, 0],
        right: [1, 0]
      };

      const offset = dirOffsets[self.facing];
      const dir = [loc[0] + offset[0], loc[1] + offset[1]];

      if (!isWalkable(self.z, dir[0], dir[1])) {
        // Check the wall tile for items (e.g., Goods on market walls)
        Interact(self.id, dir);
      } else if (self.gear.weapon && self.attackCooldown === 0 && self.z !== Z_LEVELS.UNDERWATER) {
        if (self.gear.weapon.type === 'bow' && self.inventory.arrows > 0) {
          self.shootArrow(self.mouseAngle);
          self.attackCooldown += self.gear.weapon.attackrate / self.dexterity;
        } else {
          self.attack(self.facing);
          self.attackCooldown += self.gear.weapon.attackrate / self.dexterity;
        }
      }
    }

    // WORK ACTIONS - Now handled via workAtTile command system
    // Only trigger work if we have a work target tile (no longer uses pressingF)
    if (self.workTargetTile && self.actionCooldown === 0 && !self.working && !self.ghost) {
      // Check if player is at the target location
      var currentLoc = getLoc(self.x, self.y);
      var atTarget = false;
      
      if(self.workTargetTile.workType === 'fishing' && self.workTargetTile.fishingWaterTile){
        // For fishing, check if player is adjacent to water tile
        var waterTile = self.workTargetTile.fishingWaterTile;
        atTarget = (
          (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y) ||
          (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y) ||
          (currentLoc[0] === waterTile.x && currentLoc[1] === waterTile.y - 1) ||
          (currentLoc[0] === waterTile.x && currentLoc[1] === waterTile.y + 1) ||
          (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y - 1) ||
          (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y - 1) ||
          (currentLoc[0] === waterTile.x - 1 && currentLoc[1] === waterTile.y + 1) ||
          (currentLoc[0] === waterTile.x + 1 && currentLoc[1] === waterTile.y + 1)
        );
      } else {
        atTarget = (currentLoc[0] === self.workTargetTile.tileX && 
                   currentLoc[1] === self.workTargetTile.tileY && 
                   self.z === self.workTargetTile.z);
      }
      
      if(atTarget){
        self.handleWorkAction();
      }
    }

    // Update class based on gear
    self.updateClass();
  };

  self.handleWorkAction = function() {
    const socket = SOCKET_LIST[self.id];
    const loc = getLoc(self.x, self.y);
    
    // Check if we have a work target tile
    var targetTile = null;
    var targetLoc = null;
    var workTile = null;
    
    if(self.workTargetTile){
      targetLoc = [self.workTargetTile.tileX, self.workTargetTile.tileY];
      workTile = getTile(self.workTargetTile.z === 0 ? 0 : (self.workTargetTile.z === -1 ? 1 : (self.workTargetTile.z === -2 ? 8 : (self.workTargetTile.z === 1 ? 3 : 5))), targetLoc[0], targetLoc[1]);
      targetTile = workTile;
    } else {
      targetLoc = loc;
      workTile = getTile(0, loc[0], loc[1]);
      targetTile = workTile;
    }
    
    const tile = targetTile;

    const adjacentLocs = {
      up: getLoc(self.x, self.y - tileSize),
      down: getLoc(self.x, self.y + tileSize),
      left: getLoc(self.x - tileSize, self.y),
      right: getLoc(self.x + tileSize, self.y)
    };

    // Ship Fishing - player is controlling a fishing ship
    if (self.shipType === 'fishingship' && tile === TERRAIN.WATER) {
      self.actionCooldown = 10;
      const fishCount = getTile(6, loc[0], loc[1]);

      if (fishCount > 0 && self.fishingCooldown == 0) {
        self.fishingCooldown = 300; // 5 second cooldown
        self.inventory.fish = (self.inventory.fish || 0) + 1;
        tileChange(6, loc[0], loc[1], -1, true);
        
        // Notify player
        if(global.eventManager){
          global.eventManager.createEvent({
            category: global.eventManager.categories.ECONOMIC,
            subject: self.id,
            subjectName: self.name || 'Fishing Ship',
            action: 'caught fish from ship',
            quantity: 1,
            communication: global.eventManager.commModes.PLAYER,
            message: '<i>🎣 Caught a Fish! (' + self.inventory.fish + '/' + (self.maxFish || 20) + ')</i>',
            log: `[ECONOMIC] Fishing ship caught fish`,
            position: { x: self.x, y: self.y, z: self.z }
          });
        }
        
        // Check if inventory full
        if(self.inventory.fish >= (self.maxFish || 20)){
          if(socket){
            socket.send(JSON.stringify({msg:'addToChat',message:'<i>🚢 Ship inventory full! Return to dock.</i>'}));
          }
        }
      } else if(fishCount == 0) {
        if(socket){
          socket.send(JSON.stringify({msg:'addToChat',message:'<i>No fish in this area.</i>'}));
        }
      }
      return;
    }

    // Fishing (regular player) - only when explicitly targeting a water tile
    var fishingWaterLoc = null;
    if(self.workTargetTile && self.workTargetTile.workType === 'fishing' && self.workTargetTile.fishingWaterTile){
      // Use target water tile for fishing (set when right-clicking on water tile)
      fishingWaterLoc = self.workTargetTile.fishingWaterTile;
    }
    
    if(fishingWaterLoc){
      self.actionCooldown = 10;
      const fishCount = getTile(6, fishingWaterLoc.x, fishingWaterLoc.y);

      if (fishCount > 0) {
        const rand = Math.floor(Math.random() * 6000);
        self.working = true;
        self.fishing = true;
        
        // Initialize actionTimeouts array if needed
        if (!self.actionTimeouts) {
          self.actionTimeouts = [];
        }
        
        const timeoutId = setTimeout(() => {
          // Guard: check if player still exists and is fishing
          if (!Player.list[self.id] || !self.fishing) return;
          
          self.working = false;
          self.fishing = false;
          self.inventory.fish++;
          tileChange(6, fishingWaterLoc.x, fishingWaterLoc.y, -1, true);
          // Fish caught message handled via event system
          if(global.eventManager){
            global.eventManager.createEvent({
              category: global.eventManager.categories.ECONOMIC,
              subject: self.id,
              subjectName: self.name,
              action: 'caught fish',
              quantity: 1,
              communication: global.eventManager.commModes.PLAYER,
              message: '<i>You caught a Fish.</i>',
              log: `[ECONOMIC] ${self.name} caught fish`,
              position: { x: self.x, y: self.y, z: self.z }
            });
          }
          
          // Auto-work: Check if water tile still has fish and continue fishing
          if(self.workTargetTile && self.workTargetTile.workType === 'fishing'){
            const remainingFish = getTile(6, fishingWaterLoc.x, fishingWaterLoc.y);
            if(remainingFish > 0){
              // Still fish available - continue fishing
              setTimeout(() => {
                if(Player.list[self.id] && self.workTargetTile && !self.working){
                  self.handleWorkAction();
                }
              }, 100); // Small delay before restarting
            } else {
              // No more fish - clear work target
              self.workTargetTile = null;
            }
          }
          
          // Remove timeout ID from tracking array
          if (self.actionTimeouts) {
            const index = self.actionTimeouts.indexOf(timeoutId);
            if (index > -1) {
              self.actionTimeouts.splice(index, 1);
            }
          }
        }, rand);
        
        // Track timeout ID
        self.actionTimeouts.push(timeoutId);
      } else {
        self.working = true;
        self.fishing = true;
        // No fish - clear work target
        if(self.workTargetTile && self.workTargetTile.workType === 'fishing'){
          self.workTargetTile = null;
        }
      }
      return;
    }

    // Clear brush - check target tile or current tile
    var brushLoc = self.workTargetTile && self.workTargetTile.workType === 'clearing' ? targetLoc : loc;
    var brushTile = getTile(0, brushLoc[0], brushLoc[1]);
    
    if (self.z === Z_LEVELS.OVERWORLD && brushTile >= TERRAIN.BRUSH && brushTile < TERRAIN.ROCKS) {
      self.actionCooldown = 10;
      self.working = true;
      
      // Initialize actionTimeouts array if needed
      if (!self.actionTimeouts) {
        self.actionTimeouts = [];
      }

      const timeoutId = setTimeout(() => {
        // Guard: check if player still exists and is working
        if (!Player.list[self.id] || !self.working) return;
        
        tileChange(0, brushLoc[0], brushLoc[1], TERRAIN.EMPTY);
        
        // Check for sunk items at z=-3 and retrieve them
        let itemsRetrieved = 0;
        for (const itemId in Item.list) {
          const item = Item.list[itemId];
          if (item && item.z === -3 && item.sunk) {
            const itemLoc = getLoc(item.x, item.y);
            if (itemLoc[0] === brushLoc[0] && itemLoc[1] === brushLoc[1]) {
              // Move item back to surface
              item.z = 0;
              item.sunk = false;
              itemsRetrieved++;
              
              // Notify player
              if (SOCKET_LIST[self.id]) {
                SOCKET_LIST[self.id].send(JSON.stringify({
                  msg: 'notify',
                  data: `<i>You found ${item.type} in the brush.</i>`
                }));
              }
            }
          }
        }
        
        // Tile update automatically handled by tileChange function
        self.working = false;
        
        // Auto-work: Check if tile still needs clearing
        if(self.workTargetTile && self.workTargetTile.workType === 'clearing'){
          const currentTile = getTile(0, brushLoc[0], brushLoc[1]);
          if(currentTile >= TERRAIN.BRUSH && currentTile < TERRAIN.ROCKS){
            // Still brush - continue clearing
            setTimeout(() => {
              if(Player.list[self.id] && self.workTargetTile && !self.working){
                self.handleWorkAction();
              }
            }, 100);
          } else {
            // Brush cleared - clear work target
            self.workTargetTile = null;
          }
        }
        
        // Remove timeout ID from tracking array
        if (self.actionTimeouts) {
          const index = self.actionTimeouts.indexOf(timeoutId);
          if (index > -1) {
            self.actionTimeouts.splice(index, 1);
          }
        }
      }, 3000 / self.strength);
      
      // Track timeout ID
      self.actionTimeouts.push(timeoutId);
      return;
    }

    // Gather wood - check target tile or current tile
    var woodLoc = self.workTargetTile && self.workTargetTile.workType === 'chopping' ? targetLoc : loc;
    var woodTile = getTile(0, woodLoc[0], woodLoc[1]);
    
    if (self.z === Z_LEVELS.OVERWORLD && woodTile >= TERRAIN.HEAVY_FOREST && woodTile < TERRAIN.BRUSH) {
      self.actionCooldown = 10;
      self.working = true;
      if (self.inventory.stoneaxe > 0 || self.inventory.ironaxe > 0) {
        self.chopping = true;
      }
      
      // Initialize actionTimeouts array if needed
      if (!self.actionTimeouts) {
        self.actionTimeouts = [];
      }

      const timeoutId = setTimeout(() => {
        // Guard: check if player still exists and is working
        if (!Player.list[self.id] || !self.working) return;
        
        tileChange(6, woodLoc[0], woodLoc[1], -50, true);
        self.inventory.wood += 50;
        // Wood chopping message handled via event system
        
        // Create economic event for wood gathering
        if (global.eventManager) {
          global.eventManager.resourceGathered(self, 'wood', 50, { x: self.x, y: self.y, z: self.z });
        }
        
        self.working = false;
        self.chopping = false;

        const currentTile = getTile(0, woodLoc[0], woodLoc[1]);
        const res = getTile(6, woodLoc[0], woodLoc[1]);

        if (currentTile >= TERRAIN.HEAVY_FOREST && currentTile < TERRAIN.LIGHT_FOREST && res <= 100) {
          // Convert heavy forest (1.x) to light forest (2.x) - preserve decimal for positioning
          const newTileValue = preserveDecimalOnTerrainChange(currentTile, TERRAIN.LIGHT_FOREST);
          tileChange(0, woodLoc[0], woodLoc[1], newTileValue);

          for (const i in hForestSpawns) {
            if (hForestSpawns[i].toString() === woodLoc.toString()) {
              biomes.hForest--;
              hForestSpawns.splice(i, 1);
              break;
            }
          }
          // Tile update automatically handled by tileChange function
        } else if (currentTile >= TERRAIN.LIGHT_FOREST && currentTile < TERRAIN.BRUSH && res <= 0) {
          tileChange(0, woodLoc[0], woodLoc[1], TERRAIN.EMPTY);
          // Tile update automatically handled by tileChange function
        }
        
        // Auto-work: Check if tile still has wood resources
        if(self.workTargetTile && self.workTargetTile.workType === 'chopping'){
          const checkTile = getTile(0, woodLoc[0], woodLoc[1]);
          const checkRes = getTile(6, woodLoc[0], woodLoc[1]);
          
          // Check if still choppable (has forest type AND resources > 0)
          // Tile must be forest type (HEAVY_FOREST to BRUSH) and have resources
          const isForestType = checkTile >= TERRAIN.HEAVY_FOREST && checkTile < TERRAIN.BRUSH;
          const hasResources = checkRes > 0;
          
          if(isForestType && hasResources){
            // Still has resources - continue chopping
            setTimeout(() => {
              if(Player.list[self.id] && self.workTargetTile && !self.working){
                self.handleWorkAction();
              }
            }, 100);
          } else {
            // Depleted or tile converted to non-workable (e.g., EMPTY) - clear work target
            self.workTargetTile = null;
          }
        }
        
        // Remove timeout ID from tracking array
        if (self.actionTimeouts) {
          const index = self.actionTimeouts.indexOf(timeoutId);
          if (index > -1) {
            self.actionTimeouts.splice(index, 1);
          }
        }
      }, 6000 / self.strength);
      
      // Track timeout ID
      self.actionTimeouts.push(timeoutId);
      return;
    }

    // Gather stone - check target tile or current tile
    var stoneLoc = self.workTargetTile && self.workTargetTile.workType === 'mining' ? targetLoc : loc;
    var stoneTile = getTile(0, stoneLoc[0], stoneLoc[1]);
    
    if (self.z === Z_LEVELS.OVERWORLD && stoneTile >= TERRAIN.ROCKS && stoneTile < TERRAIN.CAVE_ENTRANCE) {
      self.actionCooldown = 10;
      self.working = true;
      const mult = self.inventory.pickaxe > 0 ? 1 : 3;

      if (self.inventory.pickaxe > 0) {
        self.mining = true;
      }
      
      // Initialize actionTimeouts array if needed
      if (!self.actionTimeouts) {
        self.actionTimeouts = [];
      }

      const timeoutId = setTimeout(() => {
        // Guard: check if player still exists and is working
        if (!Player.list[self.id] || !self.working) return;
        
        tileChange(6, stoneLoc[0], stoneLoc[1], -50, true);
        self.inventory.stone += 50;
        // Stone quarrying message handled via event system
        if(global.eventManager){
          global.eventManager.resourceGathered(self, 'stone', 50, { x: self.x, y: self.y, z: self.z });
        }
        self.working = false;
        self.mining = false;

        const currentTile = getTile(0, stoneLoc[0], stoneLoc[1]);
        if (currentTile >= TERRAIN.ROCKS && currentTile < TERRAIN.MOUNTAIN && getTile(6, stoneLoc[0], stoneLoc[1]) <= 0) {
          tileChange(0, stoneLoc[0], stoneLoc[1], TERRAIN.EMPTY);
          // Tile update automatically handled by tileChange function
        }
        
        // Auto-work: Check if tile still has stone resources
        if(self.workTargetTile && self.workTargetTile.workType === 'mining'){
          const checkTile = getTile(0, stoneLoc[0], stoneLoc[1]);
          const checkRes = getTile(6, stoneLoc[0], stoneLoc[1]);
          
          // Check if still minable (has rocks/mountain type AND resources > 0)
          // Tile must be rocks/mountain type (ROCKS to CAVE_ENTRANCE) and have resources
          const isStoneType = checkTile >= TERRAIN.ROCKS && checkTile < TERRAIN.CAVE_ENTRANCE;
          const hasResources = checkRes > 0;
          
          if(isStoneType && hasResources){
            // Still has resources - continue mining
            setTimeout(() => {
              if(Player.list[self.id] && self.workTargetTile && !self.working){
                self.handleWorkAction();
              }
            }, 100);
          } else {
            // Depleted or tile converted to non-workable (e.g., EMPTY) - clear work target
            self.workTargetTile = null;
          }
        }
        
        // Remove timeout ID from tracking array
          if (self.actionTimeouts) {
            const index = self.actionTimeouts.indexOf(timeoutId);
            if (index > -1) {
              self.actionTimeouts.splice(index, 1);
            }
          }
      }, (10000 * mult) / self.strength);
      
      // Track timeout ID
      self.actionTimeouts.push(timeoutId);
      return;
    }

    // Mine metal (underworld/cave at z=-1)
    if (self.z === Z_LEVELS.UNDERWORLD && getTile(1, loc[0], loc[1]) >= 3 && getTile(1, loc[0], loc[1]) <= 5) {
      self.actionCooldown = 10;
      self.working = true;
      const mult = self.inventory.pickaxe > 0 ? 1 : 3;

      if (self.inventory.pickaxe > 0) {
        self.mining = true;
      }
      
      // Initialize actionTimeouts array if needed
      if (!self.actionTimeouts) {
        self.actionTimeouts = [];
      }

      const timeoutId = setTimeout(() => {
        // Guard: check if player still exists and is working/mining
        if (!Player.list[self.id] || !self.working || !self.mining) return;
        
        // Roll for ore type
        var roll = Math.random();
        if(roll < 0.001){
          self.inventory.diamond++;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You mined 1 💎 Diamond!</i>' }));
        } else if(roll < 0.01){
          self.inventory.goldore++;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You mined 1 🟡 Gold Ore!</i>' }));
        } else if(roll < 0.1){
          self.inventory.silverore++;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You mined 1 ⚪ Silver Ore!</i>' }));
        } else if(roll < 0.5){
          self.inventory.ironore++;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You mined 1 ⛏️ Iron Ore!</i>' }));
        } else {
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>Nothing valuable found...</i>' }));
        }
        
        // Deplete resource
        tileChange(7, loc[0], loc[1], -1, true);
        var res = getTile(7, loc[0], loc[1]);
        
        if(res <= 0){
          // Rock depleted - change to cave floor
          tileChange(1, loc[0], loc[1], 1);
          
          // Check for adjacent cave walls to spawn new rocks
          var adj = [[loc[0]-1,loc[1]],[loc[0],loc[1]-1],[loc[0]+1,loc[1]],[loc[0],loc[1]+1]];
          for(var i = 0; i < adj.length; i++){
            var t = adj[i];
            var gt = getTile(1, t[0], t[1]);
            if(gt == 1){ // Cave floor
              var num = 3 + Number((Math.random()*0.9).toFixed(2));
              tileChange(1, t[0], t[1], num); // Spawn new rock
            }
          }
        }
        
        self.working = false;
        self.mining = false;
        
        // Remove timeout ID from tracking array
        if (self.actionTimeouts) {
          const index = self.actionTimeouts.indexOf(timeoutId);
          if (index > -1) {
            self.actionTimeouts.splice(index, 1);
          }
        }
      }, (10000 * mult) / self.strength);
      
      // Track timeout ID
      self.actionTimeouts.push(timeoutId);
      return;
    }

    // Farming actions - check target tile or current tile
    var farmLoc = self.workTargetTile && self.workTargetTile.workType === 'farming' ? targetLoc : loc;
    var farmTile = getTile(0, farmLoc[0], farmLoc[1]);
    
    if (self.z === Z_LEVELS.OVERWORLD) {
      if (farmTile === TERRAIN.FARM_SEED) {
        self.handleFarmSeeding(farmLoc, socket);
      } else if (farmTile === TERRAIN.FARM_GROWING) {
        self.handleFarmGrowing(farmLoc, socket);
      } else if (farmTile === TERRAIN.FARM_READY) {
        self.handleFarmHarvest(farmLoc, socket);
      } else if (farmTile === TERRAIN.BUILD_MARKER || farmTile === TERRAIN.BUILD_MARKER_ALT || 
                 farmTile === 12 || farmTile === 12.5 || farmTile === 13 || farmTile === 15 || farmTile === 17) {
        // Building construction
        Build(self.id);
        
        // Auto-work: Check if building is still under construction
        if(self.workTargetTile && self.workTargetTile.workType === 'building'){
          var building = getBuilding(self.x, self.y);
          if(building && Building.list[building] && !Building.list[building].built){
            // Wait for Build() to complete, then check if current tile is finished
            // Build() uses setTimeout with 10000/p.strength, so wait a bit longer
            setTimeout(() => {
              if(!Player.list[self.id] || !self.workTargetTile) return;
              
              var currentLoc = getLoc(self.x, self.y);
              var building = getBuilding(self.x, self.y);
              if(!building || !Building.list[building]) return;
              
              var b = Building.list[building];
              var currentTileProgress = getTile(6, currentLoc[0], currentLoc[1]);
              
              // Check if current tile is complete
              if(currentTileProgress >= b.req){
                // Current tile is complete - find next unfinished tile on plot
                var unfinishedTiles = [];
                for(var i = 0; i < b.plot.length; i++){
                  var plotTile = b.plot[i];
                  var plotTileProgress = getTile(6, plotTile[0], plotTile[1]);
                  var plotTileType = getTile(0, plotTile[0], plotTile[1]);
                  
                  // Check if tile is unfinished and still a construction tile
                  if(plotTileProgress < b.req && 
                     (plotTileType === TERRAIN.BUILD_MARKER || plotTileType === TERRAIN.BUILD_MARKER_ALT ||
                      plotTileType === 12 || plotTileType === 12.5 || plotTileType === 13 || 
                      plotTileType === 15 || plotTileType === 17)){
                    unfinishedTiles.push(plotTile);
                  }
                }
                
                if(unfinishedTiles.length > 0){
                  // Find closest unfinished tile
                  var playerLoc = getLoc(self.x, self.y);
                  var closestTile = null;
                  var closestDistance = Infinity;
                  
                  for(var i = 0; i < unfinishedTiles.length; i++){
                    var tile = unfinishedTiles[i];
                    var tileCenter = getCenter(tile[0], tile[1]);
                    var distance = getDistance(
                      {x: self.x, y: self.y},
                      {x: tileCenter[0], y: tileCenter[1]}
                    );
                    
                    if(distance < closestDistance){
                      closestDistance = distance;
                      closestTile = tile;
                    }
                  }
                  
                  if(closestTile){
                    // Path to closest unfinished tile
                    var startLoc = getLoc(self.x, self.y);
                    var layer = self.z === 0 ? 0 : (self.z === -1 ? 1 : (self.z === -2 ? 8 : (self.z === 1 ? 3 : 5)));
                    var options = {
                      avoidDoors: true,
                      avoidCaveExits: false,
                      allowSpecificDoor: true,
                      targetDoor: [closestTile[0], closestTile[1]]
                    };
                    
                    var path = global.tilemapSystem.findPath(startLoc, [closestTile[0], closestTile[1]], layer, options);
                    if(path && path.length > 0){
                      if(self.z !== -1 && typeof smoothPath === 'function'){
                        path = smoothPath(path, self.z);
                      }
                      var firstWaypoint = path[0];
                      if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
                        self.pathCount = 1;
                      } else {
                        self.pathCount = 0;
                      }
                      self.path = path;
                      
                      // Update work target to new tile
                      self.workTargetTile = {
                        tileX: closestTile[0],
                        tileY: closestTile[1],
                        z: self.z,
                        workType: 'building'
                      };
                    } else {
                      // Can't path to tile - clear work target
                      self.workTargetTile = null;
                    }
                  } else {
                    // No closest tile found - clear work target
                    self.workTargetTile = null;
                  }
                } else {
                  // No unfinished tiles - building will be complete soon, clear work target
                  self.workTargetTile = null;
                }
              } else {
                // Current tile not complete - continue working on it
                if(!self.working){
                  self.handleWorkAction();
                }
              }
            }, (10000 / self.strength) + 100);
          } else {
            // Building complete - clear work target
            self.workTargetTile = null;
          }
        }
      }
    }
  };

  self.handleFarmSeeding = function(loc, socket) {
    if (nightfall) {
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>It is too dark out for farmwork.</i>' }));
      return;
    }

    self.actionCooldown = 10;
    const f = Building.list[getBuilding(self.x, self.y)];
    let count = 0;

    for (const i in f.plot) {
      if (getTile(0, f.plot[i][0], f.plot[i][1]) === TERRAIN.FARM_SEED) {
        count++;
      }
    }

    if (count === 9 && getTile(6, loc[0], loc[1]) < 25) {
      self.working = true;
      self.farming = true;
      
      // Initialize actionTimeouts array if needed
      if (!self.actionTimeouts) {
        self.actionTimeouts = [];
      }

      const timeoutId = setTimeout(() => {
        // Guard: check if player still exists and is working/farming
        if (!Player.list[self.id] || !self.working || !self.farming) return;
        
        tileChange(6, loc[0], loc[1], 25, true);
        self.working = false;
        self.farming = false;

        let readyCount = 0;
        for (const i in f.plot) {
          const n = f.plot[i];
          if (getTile(6, n[0], n[1]) >= 25) {
            readyCount++;
          }
        }

        if (readyCount === 9) {
          for (const i in f.plot) {
            const n = f.plot[i];
            tileChange(0, n[0], n[1], TERRAIN.FARM_GROWING);
          }
          // Tile update automatically handled by tileChange function
        }
        
        // Auto-work: Check if farm tile still needs seeding
        if(self.workTargetTile && self.workTargetTile.workType === 'farming'){
          var checkTile = getTile(0, loc[0], loc[1]);
          if(checkTile === TERRAIN.FARM_SEED && getTile(6, loc[0], loc[1]) < 25){
            // Still needs seeding - continue farming
            setTimeout(() => {
              if(Player.list[self.id] && self.workTargetTile && !self.working){
                self.handleWorkAction();
              }
            }, 100);
          } else if(checkTile !== TERRAIN.FARM_SEED && checkTile !== TERRAIN.FARM_GROWING && checkTile !== TERRAIN.FARM_READY){
            // Farm tile changed - clear work target
            self.workTargetTile = null;
          }
        }
        
        // Remove timeout ID from tracking array
        if (self.actionTimeouts) {
          const index = self.actionTimeouts.indexOf(timeoutId);
          if (index > -1) {
            self.actionTimeouts.splice(index, 1);
          }
        }
      }, 10000);
      
      // Track timeout ID
      self.actionTimeouts.push(timeoutId);
    } else {
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>There is no more work to be done here.</i>' }));
    }
  };

  self.handleFarmGrowing = function(loc, socket) {
    if (nightfall) {
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>It is too dark out for farmwork.</i>' }));
      return;
    }

    if (getTile(6, loc[0], loc[1]) >= 50) {
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>There is no more work to be done here.</i>' }));
      return;
    }

    self.actionCooldown = 10;
    const f = Building.list[getBuilding(self.x, self.y)];
    self.working = true;
    self.farming = true;
    
    // Initialize actionTimeouts array if needed
    if (!self.actionTimeouts) {
      self.actionTimeouts = [];
    }

    const timeoutId = setTimeout(() => {
      // Guard: check if player still exists and is working
      if (!Player.list[self.id] || !self.working || getTile(6, loc[0], loc[1]) >= 50) return;
      
      tileChange(6, loc[0], loc[1], 25, true);
      self.working = false;
      self.farming = false;

      let readyCount = 0;
      for (const i in f.plot) {
        if (getTile(6, f.plot[i][0], f.plot[i][1]) >= 50) {
          readyCount++;
        }
      }

      if (readyCount === 9) {
        for (const i in f.plot) {
          tileChange(0, f.plot[i][0], f.plot[i][1], TERRAIN.FARM_READY);
        }
        // Tile update automatically handled by tileChange function
      }
      
      // Auto-work: Check if farm tile still needs growing
      if(self.workTargetTile && self.workTargetTile.workType === 'farming'){
        var checkTile = getTile(0, loc[0], loc[1]);
        var checkRes = getTile(6, loc[0], loc[1]);
        if(checkTile === TERRAIN.FARM_GROWING && checkRes < 50){
          // Still needs growing - continue farming
          setTimeout(() => {
            if(Player.list[self.id] && self.workTargetTile && !self.working){
              self.handleWorkAction();
            }
          }, 100);
        } else if(checkTile === TERRAIN.FARM_READY || (checkTile !== TERRAIN.FARM_SEED && checkTile !== TERRAIN.FARM_GROWING && checkTile !== TERRAIN.FARM_READY)){
          // Farm ready or changed - clear work target
          self.workTargetTile = null;
        }
      }
      
      // Remove timeout ID from tracking array
      if (self.actionTimeouts) {
        const index = self.actionTimeouts.indexOf(timeoutId);
        if (index > -1) {
          self.actionTimeouts.splice(index, 1);
        }
      }
    }
    , 10000);
    
    // Track timeout ID
    self.actionTimeouts.push(timeoutId);
  };

  self.handleFarmHarvest = function(loc, socket) {
    self.actionCooldown = 10;
    self.working = true;
    self.farming = true;
    
    // Initialize actionTimeouts array if needed
    if (!self.actionTimeouts) {
      self.actionTimeouts = [];
    }

    const timeoutId = setTimeout(() => {
      // Guard: check if player still exists and is working
      if (!Player.list[self.id] || !self.working) return;
      
      tileChange(6, loc[0], loc[1], -1, true);
      self.inventory.grain += 1;
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You harvested Grain.</i>' }));
      self.working = false;
      self.farming = false;

      if (getTile(6, loc[0], loc[1]) <= 0) {
        tileChange(0, loc[0], loc[1], TERRAIN.FARM_SEED);
        // Tile update automatically handled by tileChange function
      }
      
      // Auto-work: Check if farm tile still needs harvesting
      if(self.workTargetTile && self.workTargetTile.workType === 'farming'){
        var checkTile = getTile(0, loc[0], loc[1]);
        var checkRes = getTile(6, loc[0], loc[1]);
        if(checkTile === TERRAIN.FARM_READY && checkRes > 0){
          // Still has grain - continue harvesting
          setTimeout(() => {
            if(Player.list[self.id] && self.workTargetTile && !self.working){
              self.handleWorkAction();
            }
          }, 100);
        } else if(checkTile === TERRAIN.FARM_SEED){
          // Farm needs seeding - continue farming
          setTimeout(() => {
            if(Player.list[self.id] && self.workTargetTile && !self.working){
              self.handleWorkAction();
            }
          }, 100);
        } else {
          // Farm tile changed - clear work target
          self.workTargetTile = null;
        }
      }
      
      // Remove timeout ID from tracking array
        if (self.actionTimeouts) {
          const index = self.actionTimeouts.indexOf(timeoutId);
          if (index > -1) {
            self.actionTimeouts.splice(index, 1);
          }
        }
    }, 10000);
    
    // Track timeout ID
    self.actionTimeouts.push(timeoutId);
  };

  self.updateClass = function() {
    if (self.gear.head?.name === 'crown' && self.crowned) {
      self.class = 'King';
      self.spriteSize = tileSize;
    } else if (self.gear.armor) {
      const armorType = self.gear.armor.type;
      const weaponType = self.gear.weapon?.type;

      if (armorType === 'leather') {
        if (self.mounted) {
          self.class = weaponType === 'bow' ? 'Ranger' : 'Scout';
          self.spriteSize = tileSize * 2;
        } else {
          self.class = weaponType === 'bow' ? 'Hunter' : 'Rogue';
          self.spriteSize = tileSize * 1.5;
        }
      } else if (armorType === 'chainmail') {
        if (self.mounted) {
          self.class = weaponType === 'bow' ? 'MountedArcher' : 'Horseman';
          self.spriteSize = tileSize * 2;
        } else {
          self.class = weaponType === 'bow' ? 'Archer' : 'Swordsman';
          self.spriteSize = tileSize * 1.5;
        }
      } else if (armorType === 'plate') {
        if (self.knighted) {
          if (self.mounted) {
            self.class = weaponType === 'lance' ? 'Crusader' : 'Knight';
            self.spriteSize = weaponType === 'lance' ? tileSize * 3 : tileSize * 2;
          } else {
            self.class = 'Templar';
            self.spriteSize = tileSize * 1.5;
          }
        } else {
          if (self.mounted) {
            self.class = weaponType === 'lance' ? 'Lancer' : 'Cavalry';
            self.spriteSize = weaponType === 'lance' ? tileSize * 3 : tileSize * 2;
          } else {
            self.class = 'Hero';
            self.spriteSize = tileSize * 1.5;
          }
        }
      } else if (armorType === 'cloth') {
        const clothClasses = {
          'MonkCowl': 'Mage',
          'BlackCloak': 'Warlock'
        };
        self.class = clothClasses[self.gear.armor.name] || 'Priest';
        self.spriteSize = self.class === 'Priest' ? tileSize : tileSize * 1.5;
      }
    } else {
      self.class = 'Serf';
      self.spriteSize = tileSize * 1.5;
    }
  };

  self.getInitPack = function() {
    return {
      type: self.type,
      name: self.name,
      id: self.id,
      house: self.house,
      kingdom: self.kingdom,
      x: self.x,
      y: self.y,
      z: self.z,
      class: self.class,
      rank: self.rank,
      friends: self.friends,
      enemies: self.enemies,
      gear: self.gear,
      inventory: self.inventory,
      spriteSize: self.spriteSize,
      innaWoods: self.innaWoods,
      facing: self.facing,
      stealthed: self.stealthed,
      revealed: self.revealed,
      hp: self.hp,
      hpMax: self.hpMax,
      spirit: self.spirit,
      spiritMax: self.spiritMax,
      breath: self.breath,
      breathMax: self.breathMax,
      action: self.action,
      ghost: self.ghost,
      kills: self.kills,
      skulls: self.skulls,
      spriteScale: self.spriteScale
    };
  };

  self.getUpdatePack = function() {
    return {
      id: self.id,
      house: self.house,
      kingdom: self.kingdom,
      x: self.x,
      y: self.y,
      z: self.z,
      class: self.class,
      rank: self.rank,
      friends: self.friends,
      enemies: self.enemies,
      gear: self.gear,
      inventory: self.inventory,
      spriteSize: self.spriteSize,
      innaWoods: self.innaWoods,
      onMtn: self.onMtn,
      facing: self.facing,
      stealthed: self.stealthed,
      revealed: self.revealed,
      pressingUp: self.pressingUp,
      pressingDown: self.pressingDown,
      pressingLeft: self.pressingLeft,
      pressingRight: self.pressingRight,
      pressingAttack: self.pressingAttack,
      angle: self.mouseAngle,
      chopping: self.chopping,
      mining: self.mining,
      farming: self.farming,
      building: self.building,
      fishing: self.fishing,
      hp: self.hp,
      hpMax: self.hpMax,
      spirit: self.spirit,
      spiritMax: self.spiritMax,
      breath: self.breath,
      breathMax: self.breathMax,
      action: self.action,
      ghost: self.ghost,
      kills: self.kills,
      skulls: self.skulls,
      spriteScale: self.spriteScale,
      working: self.working ? true : false, // For spectate camera priority
      combat: (self.combat && self.combat.target) ? { target: self.combat.target } : null, // Send full combat object with target for client
      fleeing: self.fleeing ? true : false // For spectate camera priority
    };
  };

  // ALPHA HAX - Testing defaults
  self.hasHorse = true;
  self.knighted = true;

  Player.list[self.id] = self;
  
  initPack.player.push(self.getInitPack());

  return self;
};

Player.list = {};
global.Player = Player;

// ============================================================================
// REGISTER ENTITY COLLECTIONS IN ENTITY REGISTRY (Phase 1: Foundation)
// ============================================================================

// Register all entity collections in EntityRegistry for centralized access
// This replaces direct access to Player.list, Building.list, etc.
// Note: Building.list, Item.list, Arrow.list, Light.list, Weather.list are defined in Entity.js
// which is required earlier in this file, so they're available here

if (typeof Building !== 'undefined' && Building.list) {
  entityRegistry.registerCollection('buildings', Building.list);
}
if (typeof Item !== 'undefined' && Item.list) {
  entityRegistry.registerCollection('items', Item.list);
}
if (typeof Arrow !== 'undefined' && Arrow.list) {
  entityRegistry.registerCollection('arrows', Arrow.list);
}
if (typeof Light !== 'undefined' && Light.list) {
  entityRegistry.registerCollection('lights', Light.list);
}
if (typeof Weather !== 'undefined' && Weather.list) {
  entityRegistry.registerCollection('weather', Weather.list);
}
entityRegistry.registerCollection('players', Player.list);

// Also register House and Kingdom if they exist (from Houses.js)
if (typeof House !== 'undefined' && House.list) {
  entityRegistry.registerCollection('houses', House.list);
}
if (typeof Kingdom !== 'undefined' && Kingdom.list) {
  entityRegistry.registerCollection('kingdoms', Kingdom.list);
}

// Register EntityRegistry itself in SystemRegistry
systemRegistry.register('entities', entityRegistry, { priority: 0 });

// Initialize and register EntityStateManager (Phase 2: Entity Responsibilities)
const EntityStateManager = require('./server/js/core/EntityStateManager.js');
const entityStateManager = EntityStateManager;
systemRegistry.register('entityState', entityStateManager, { 
  dependsOn: ['entities'], 
  priority: 17 
});
global.entityStateManager = entityStateManager;

// Initialize DependencyContainer (Phase 5: Eliminate Global State)
const DependencyContainer = require('./server/js/core/DependencyContainer.js');
const dependencyContainer = DependencyContainer;
dependencyContainer.autoRegisterSystems(); // Auto-register all systems
systemRegistry.register('dependencies', dependencyContainer, { priority: 18 });
global.dependencyContainer = dependencyContainer;

if (process.env.DEBUG) {
  console.log('[lambic.js] EntityRegistry initialized:', entityRegistry.getStats());
}

// ============================================================================
// Initialize building preview system
const BuildingPreview = require('./server/js/core/BuildingPreview');
const buildingPreview = new BuildingPreview();
global.buildingPreview = buildingPreview;

// Register building preview system
systemRegistry.register('buildingPreview', buildingPreview, { 
  dependsOn: ['tilemap'], 
  priority: 12 
});

// Helper function to find neutral taverns for player spawning
function findNeutralTaverns() {
  const neutralTaverns = [];
  
  for (const id in Building.list) {
    const building = Building.list[id];
    
    // Check if it's a tavern
    if (building.type === 'tavern' && building.built) {
      // Check if owner exists
      if (building.owner) {
        // Check if owner is a House (faction)
        if (House.list[building.owner]) {
          const house = House.list[building.owner];
          // House is acceptable if it's not hostile (hostile means it attacks neutral players)
          if (!house.hostile) {
            neutralTaverns.push(building);
          }
        } else {
          // Owner is not a House, so it's player-owned
          // If the player doesn't exist in Player.list (disconnected), treat as friendly
          neutralTaverns.push(building);
        }
      }
    }
  }
  
  return neutralTaverns;
}

Player.onConnect = function(socket, name, playerType) {
  playerType = playerType || 'player'; // Default to normal player
  
  // Capitalize player name
  const capitalizeName = global.capitalizeName || function(n) {
    if (!n || typeof n !== 'string') return n;
    if (n.length === 0) return n;
    return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
  };
  name = capitalizeName(name);
  
  socket.write(JSON.stringify({
    msg: 'tempus',
    tempus,
    nightfall
  }));

  // Try to find neutral taverns first
  const neutralTaverns = findNeutralTaverns();
  let spawnX, spawnY, spawnZ, homeZ, homeLoc;

  if (neutralTaverns.length > 0) {
    // Randomly select a neutral tavern
    const randomIndex = Math.floor(Math.random() * neutralTaverns.length);
    const tavern = neutralTaverns[randomIndex];
    
    // Calculate spawn point: upstairs (z=2), one tile below fireplace
    // Fireplace is at walls[1] for taverns
    if (tavern.walls && tavern.walls[1]) {
      const fireplaceWall = tavern.walls[1];
      homeLoc = [fireplaceWall[0], fireplaceWall[1] + 1]; // One tile south
      const homeCoords = getCoords(homeLoc[0], homeLoc[1]);
      
      spawnX = homeCoords[0];
      spawnY = homeCoords[1];
      spawnZ = 2; // Upstairs
      homeZ = 2;
      
      // Tavern spawn logging handled via event system
    } else {
      // Fallback if tavern doesn't have walls defined
      const spawn = randomSpawnO();
      spawnX = spawn[0];
      spawnY = spawn[1];
      spawnZ = 0;
      homeZ = 0;
      homeLoc = getLoc(spawnX, spawnY);
      
      // Random spawn logging handled via event system
    }
  } else {
    // No neutral taverns found - use default spawn
    const spawn = randomSpawnO();
    spawnX = spawn[0];
    spawnY = spawn[1];
    spawnZ = 0;
    homeZ = 0;
    homeLoc = getLoc(spawnX, spawnY);
    
  }

  const player = Player({
    name,
    id: socket.id,
    z: spawnZ,
    x: spawnX,
    y: spawnY,
    home: { z: homeZ, loc: homeLoc }
  });
  
  // CRITICAL: Set player class (defaults to SerfM, matching NPC behavior)
  // Character constructor sets class to null, but players need a class for sprites
  if (!player.class) {
    player.class = 'SerfM'; // Default to male serf (can be changed via gear/equipment)
  }

  
  // ALPHA Testing: Give player starting items
  player.inventory.worldmap = 1;
  player.inventory.cavemap = 1;
  player.inventory.dague = 1;
  player.inventory.longsword = 1;
  player.inventory.bow = 1;
  player.inventory.arrows = 50;
  player.inventory.brigandine = 1;
  player.inventory.maille = 1;
  player.inventory.steelplate = 1;
  player.inventory.bread = 2;
  player.inventory.saison = 1;

  // REMOVED: Duplicate socket.on('data') listener - all game messages are now handled in the main connection handler
  // This prevents memory leaks from multiple listeners accumulating on the same socket

  socket.write(JSON.stringify({
    msg: 'newFaction',
    houseList: House.list,
    kingdomList: Kingdom.list
  }));

  socket.write(JSON.stringify({
    msg: 'init',
    selfId: player.id,
    pack: {
      player: Player.getAllInitPack(),
      arrow: Arrow.getAllInitPack(),
      item: Item.getAllInitPack(),
      light: Light.getAllInitPack(),
      building: Building.getAllInitPack()
    }
  }));

  // Send welcome message
  const welcomeMessage = `
    <div style="text-align: center; padding: 10px; color: #FFFFFF;">
      <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
      <p style="margin: 5px 0; color: #FFD700; font-size: 18px; font-weight: bold;">♜ STRONGHODL ♜</p>
      <p style="margin: 3px 0; color: #CCCCCC; font-size: 12px;">A SOLIS ORTV VSQVE AD OCCASVM</p>
      <p style="margin: 5px 0; color: #FFFFFF;">Server: <span style="color: #4CAF50; font-weight: bold;">${global.serverName}</span></p>
      <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
      <p style="margin: 2px 0; color: #CCCCCC;"><span style="color: #FFD700; font-weight: bold;">Hotkeys:</span> <b>B</b> Inventory • <b>C</b> Character • <b>U</b> Build • <b>M</b> Map</p>
      <p style="margin: 2px 0; color: #CCCCCC;"><span style="color: #FFD700; font-weight: bold;">Commands:</span> <b>/help</b> • <b>/build</b> • <b>/craft</b></p>
      <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
    </div>
  `;
  
  socket.write(JSON.stringify({
    msg: 'addToChat',
    message: welcomeMessage
  }));

};

Player.getAllInitPack = function() {
  // Return all players (spectators are no longer Player entities)
  return Object.values(Player.list)
    .map(p => p.getInitPack());
};

Player.onDisconnect = function(socket) {
  // Ensure socket is removed from SOCKET_LIST
  if (SOCKET_LIST[socket.id]) {
    delete SOCKET_LIST[socket.id];
  }
  
  const player = Player.list[socket.id];

  if (player) {
    // Clear all pending action timeouts
    if (player.actionTimeouts && Array.isArray(player.actionTimeouts)) {
      player.actionTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      player.actionTimeouts = [];
    }
    
    // Clean up aggro interval
    if (player.aggroInterval) {
      clearInterval(player.aggroInterval);
    }

    // Remove from zones (using Map-based system)
    if (player.zone) {
      const zoneKey = `${player.zone[0]},${player.zone[1]}`;
      const zoneSet = zones.get(zoneKey);
      if (zoneSet) {
        zoneSet.delete(player.id);
      }
    }
    
    // Clear any combat state
    if (player.combat && player.combat.target) {
      const target = Player.list[player.combat.target];
      if (target && target.combat && target.combat.target === player.id) {
        target.combat.target = null;
        target.action = null;
      }
    }
  }

  // Clear player's zone tracking
  if (global.zoneManager) {
    global.zoneManager.clearPlayerZone(socket.id);
  }

  delete Player.list[socket.id];
  removePack.player.push(socket.id);
};

// ============================================================================
// PLAYER.UPDATE - COORDINATOR FUNCTION (lines 3656-3824)
// ============================================================================
// This is NOT a Character-level update function - it's the game loop coordinator
// that iterates through ALL entities (players, NPCs, ships) in Player.list and:
// - Manages ghost timers and auto-respawn
// - Implements performance optimization (update throttling for NPCs)
// - Calls player.update() for each entity (which triggers Character.update)
// - Handles ship docking checks
// - Manages zone transitions for players
// - Cleans up entities marked for removal
// - Collects and returns update packs for network synchronization
// - Tracks performance metrics
// Dependencies: Called once per game tick (60fps) from main game loop
// ============================================================================

Player.update = function() {
  const pack = [];
  
  // ===== PERFORMANCE PROFILING SETUP (lines 3660-3671) =====
  // Track timing for optimization
  if(!Player._perfData) {
    Player._perfData = {
      updateTimes: [],
      slowFrames: 0,
      lastLog: Date.now(),
      entityTypeCounts: {},
      entityUpdateTimes: {} // Track per-entity-type update times
    };
  }
  const startTime = Date.now();
  
  // Track entity counts by type
  const entityCounts = {
    player: 0,
    npc: 0,
    ship: 0,
    total: 0
  };
  
  const entityTypeBreakdown = {};
  
  // Frame counter for update throttling
  if(!Player._updateFrame) Player._updateFrame = 0;
  Player._updateFrame++;

  // ===== ENTITY UPDATE LOOP (lines 3673-3790) =====
  // Iterate through all entities and call their individual update functions
  for (const i in Player.list) {
    const player = Player.list[i];
    
    // Handle ghost timer countdown
    if(player.ghost && player.ghostTimer > 0){
      player.ghostTimer--;
      
      // First message: announce total time (only once at start)
      if(player.ghostTimer === 5399){ // First frame
        var socket = SOCKET_LIST[i];
        if(socket){
          socket.write(JSON.stringify({msg:'addToChat',message:'<span style="color:#aaaaff;">👻 You are dead. Respawning in 1:30...</span>'}));
        }
      }
      
      // Countdown last 10 seconds only
      if(player.ghostTimer <= 600 && player.ghostTimer % 60 === 0 && player.ghostTimer > 0){
        var socket = SOCKET_LIST[i];
        if(socket){
          var seconds = Math.ceil(player.ghostTimer / 60);
          socket.write(JSON.stringify({msg:'addToChat',message:'<span style="color:#aaaaff;">👻 Respawning in ' + seconds + ' second' + (seconds > 1 ? 's' : '') + '...</span>'}));
        }
      }
      
      // Auto-respawn when timer expires
      if(player.ghostTimer <= 0){
        player.respawnFromGhost();
      }
    }
    
    // ===== UPDATE THROTTLING (lines 3721-3745) =====
    // Performance optimization: reduce update frequency for idle NPCs
    // PERFORMANCE OPTIMIZATION: Skip updates for idle/low-priority NPCs
    var shouldUpdate = true;
    if(player.type === 'npc'){
      // Always update if in combat or has a path
      if(player.action === 'combat' || player.path){
        shouldUpdate = true;
      }
      // Update working NPCs every 3rd frame (they're mostly stationary)
      else if(player.working){
        shouldUpdate = (Player._updateFrame % 3 === 0);
      }
      // Update peaceful NPCs and wolves (Deer, Sheep, Boar, Wolf)
      // FIXED: Update every frame when active (path/action), every 2nd frame when idle
      // Changed from every 6th frame to prevent slow motion movement
      else if(player.class === 'Deer' || player.class === 'Sheep' || player.class === 'Boar' || player.class === 'Wolf'){
        // Check if fauna has a path or action (flee/combat) - update every frame when active
        if(player.path || player.action === 'flee' || player.action === 'combat'){
          shouldUpdate = true;
        } else {
          // Idle fauna update every 2nd frame
          shouldUpdate = (Player._updateFrame % 2 === 0);
        }
      }
      // Update serfs/trappers every 4th frame when idle
      else if(player.class === 'Serf' || player.class === 'SerfM' || player.class === 'SerfF' || player.class === 'Trapper'){
        shouldUpdate = (Player._updateFrame % 4 === 0);
      }
      // Update ranged units (TeutonBow, etc.) every 3rd frame when idle (they do more calculations)
      else if(player.ranged && (player.class === 'TeutonBow' || player.class === 'FrankBow' || player.class === 'Poacher')){
        shouldUpdate = (Player._updateFrame % 3 === 0);
      }
      // Update other NPCs (faction units) every 2nd frame when idle
      else {
        shouldUpdate = (Player._updateFrame % 2 === 0);
      }
    } else if(player.type === 'fauna'){
      // Falcons should always update every frame for smooth flight animation
      if(player.class === 'Falcon'){
        shouldUpdate = true; // Always update falcons for smooth flight
      } else {
        // FIXED: Fauna should update every frame when they have a path or action (moving/fleeing/combat)
        // This prevents slow motion movement when fauna are actively moving
        if(player.action === 'combat' || player.action === 'flee' || player.path){
          shouldUpdate = true; // Always update when active
        } else {
          // Update idle fauna every 2nd frame (reduced from every 6th frame)
          shouldUpdate = (Player._updateFrame % 2 === 0);
        }
      }
    } else {
      // Always update human players every frame
      shouldUpdate = true;
    }
    
    if(shouldUpdate){
    // Track entity type for profiling
    entityCounts.total++;
    if(player.type === 'player') entityCounts.player++;
    else if(player.type === 'npc') entityCounts.npc++;
    else if(player.type === 'ship') entityCounts.ship++;
    
    // Track entity class breakdown
    const entityClass = player.class || 'Unknown';
    if(!entityTypeBreakdown[entityClass]) {
      entityTypeBreakdown[entityClass] = 0;
    }
    entityTypeBreakdown[entityClass]++;
    
    // Check if ship should dock (before update to prevent movement after docking)
    if(player.type === 'ship' && player.checkDockContact){
      if(player.checkDockContact()){
        continue; // Ship is now stored, skip remaining updates
      }
    }
    
    // Track per-entity update time (only for slow entities to avoid overhead)
    const entityUpdateStart = Date.now();
    player.update();
    const entityUpdateTime = Date.now() - entityUpdateStart;
    
    // Track slow entity updates (>1ms) by type
    if(entityUpdateTime > 1 && !Player._perfData.entityUpdateTimes[entityClass]) {
      Player._perfData.entityUpdateTimes[entityClass] = [];
    }
    if(entityUpdateTime > 1 && Player._perfData.entityUpdateTimes[entityClass]) {
      Player._perfData.entityUpdateTimes[entityClass].push(entityUpdateTime);
      // Keep only last 100 samples per entity type
      if(Player._perfData.entityUpdateTimes[entityClass].length > 100) {
        Player._perfData.entityUpdateTimes[entityClass].shift();
      }
    }
    
    // NPC COMBAT UPDATE - Handle combat for NPCs (including attack intent)
    // Always update if combatState exists - update() method handles validation and cleanup
    if (player.type === 'npc' && global.simpleCombat && player.combatState) {
      global.simpleCombat.update(player);
    }
    
    // Update fishing if player is fishing
    if(player.fishing && player.updateFishing){
      player.updateFishing();
    }
    
    // Attack-move: check for enemies while pathing
    // Only check if we have a path and are not already in combat
    // Check both old combat.target and new combatState.target
    var hasCombatTarget = (player.combat && player.combat.target) || (player.combatState && player.combatState.target);
    
    // #region agent log
    if (player.attackMoveTarget) {
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5299',message:'Attack-move check',data:{playerId:player.id,hasAttackMoveTarget:!!player.attackMoveTarget,hasPath:!!player.path,pathLength:player.path ? player.path.length : 0,hasCombatTarget:hasCombatTarget,combatTarget:player.combat ? player.combat.target : null,combatStateTarget:player.combatState ? player.combatState.target : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'CC'})}).catch(()=>{});
    }
    // #endregion
    
    if(player.attackMoveTarget && player.path && player.path.length > 0 && !hasCombatTarget){
      // Determine detection range based on weapon type
      // For ranged weapons: use max ranged attack range (640 pixels)
      // For melee weapons: use aggro range (256 pixels)
      var detectionRange = 256; // Default to aggro range for melee
      if (global.simpleCombat && player.ranged) {
        detectionRange = global.simpleCombat.getAttackRange(player);
      } else {
        detectionRange = player.aggroRange || 256;
      }
      var detectionRangeSquared = detectionRange * detectionRange; // Use squared distance to avoid sqrt
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5309',message:'Attack-move detection range',data:{playerId:player.id,isRanged:player.ranged,detectionRange:detectionRange,aggroRange:player.aggroRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'DD'})}).catch(()=>{});
      // #endregion
      
      // Iterate through all entities to find nearby enemies
      // Check both Player.list and Character.list (NPCs)
      var enemiesToCheck = Object.values(Player.list);
      if (global.Character && global.Character.list) {
        enemiesToCheck = enemiesToCheck.concat(Object.values(global.Character.list));
      }
      
      for(var j = 0; j < enemiesToCheck.length; j++){
        var enemy = enemiesToCheck[j];
        if(enemy.id === player.id) continue;
        if(enemy.z !== player.z) continue;
        
        // STEALTH: Skip stealthed enemies that haven't been detected
        if (enemy.stealthed && !enemy.revealed) {
          if (global.simpleCombat && !global.simpleCombat.checkStealthDetection(enemy, player)) {
            continue; // Can't see stealthed enemy
          }
          // Enemy was detected - will be revealed in startCombat
        }
        
        // Check if enemy
        if(global.allyCheck && global.allyCheck(player.id, enemy.id) === -1){
          var dx = enemy.x - player.x;
          var dy = enemy.y - player.y;
          var distanceSquared = dx*dx + dy*dy; // Use squared distance to avoid sqrt
          
          if(distanceSquared <= detectionRangeSquared){
            // Enemy in range - interrupt path and set attack intent
            // Combat will start naturally when in range or when damage is dealt
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5337',message:'Attack-move enemy detected',data:{playerId:player.id,enemyId:enemy.id,enemyType:enemy.type,distance:Math.sqrt(distanceSquared),detectionRange:detectionRange,inRange:distanceSquared <= detectionRangeSquared},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'EE'})}).catch(()=>{});
            // #endregion
            if (global.simpleCombat) {
              if (global.debugCombat) {
                console.log(`[attack-move] Enemy detected, setting attack intent ${player.id} -> ${enemy.id} (range: ${Math.sqrt(distanceSquared).toFixed(1)}, detection: ${detectionRange})`);
              }
              global.simpleCombat.setAttackIntent(player, enemy.id);
            } else {
              player.combat.target = enemy.id;
              player.action = 'combat';
            }
            // Don't clear path here - let combat system handle it
            // The path will continue if combat ends and attackMoveTarget is still set
            break;
          }
        }
      }
    }
    
    // Clear attack-move when destination reached (path completed)
    if(player.attackMoveTarget && (!player.path || player.path.length === 0) && player.action !== 'combat'){
      player.attackMoveTarget = null;
    }
    
    // Resume attack-move pathing if combat ended but attackMoveTarget still exists
    if(player.attackMoveTarget && !player.path && !player.combat.target && player.action !== 'combat'){
      // Resume pathing to attack-move destination
      var dest = player.attackMoveTarget;
      var startLoc = getLoc(player.x, player.y);
      var layer = dest.z === 0 ? 0 : (dest.z === -1 ? 1 : (dest.z === -2 ? 8 : (dest.z === 1 ? 3 : 5)));
      var options = {
        avoidDoors: true,
        avoidCaveExits: false
      };
      var path = global.tilemapSystem.findPath(startLoc, [dest.col, dest.row], layer, options);
      if(path && path.length > 0){
        if(dest.z !== -1 && typeof smoothPath === 'function'){
          path = smoothPath(path, dest.z);
        }
        var firstWaypoint = path[0];
        if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
          player.pathCount = 1;
        } else {
          player.pathCount = 0;
        }
        player.path = path;
      }
    }
    }

    // ===== ZONE TRANSITIONS (lines 3765-3789) =====
    // Track when players enter new zones and send notifications
    // Check for zone transitions (only for actual players, not NPCs)
    if (global.zoneManager && !player.toRemove && player.type === 'player') {
      const currentTile = getLoc(player.x, player.y);
      const zoneTransition = global.zoneManager.checkPlayerZoneTransition(player.id, currentTile);
      
      if (zoneTransition && zoneTransition.entered) {
        const newZone = zoneTransition.entered;
        
        // Only send zone entry notifications when player is on overworld (z=0)
        if (player.z === 0 && global.eventManager) {
          global.eventManager.createEvent({
            category: global.eventManager.categories.ENVIRONMENT,
            subject: player.id,
            subjectName: player.name,
            action: 'entered zone',
            target: newZone.id,
            targetName: newZone.name,
            communication: global.eventManager.commModes.PLAYER,
            message: `<i>You have entered <b>${newZone.name}</b></i>`,
            log: `${player.name} entered ${newZone.name}`,
            position: { x: player.x, y: player.y, z: player.z }
          });
        }
      }
    }

    // ===== ENTITY CLEANUP & UPDATE PACKS (lines 3795-3811) =====
    // Remove destroyed entities or collect update packs for network sync
    if (player.toRemove) {
      // Use comprehensive cleanup method
      if (player.cleanup) {
        player.cleanup();
      }
      
      delete Player.list[i];
      removePack.player.push(player.id);
    } else {
      // Send all players in update packs (spectators are no longer Player entities)
      // Boarded players still need updates (position syncs to ship), they just don't render
      pack.push(player.getUpdatePack());
    }
  }

  // ===== PERFORMANCE PROFILING & LOGGING (lines 3814-3843) =====
  // Track and log update timing for optimization
  // PERFORMANCE PROFILING: Log timing
  const updateTime = Date.now() - startTime;
  Player._perfData.updateTimes.push(updateTime);
  if(updateTime > 16.67) Player._perfData.slowFrames++;
  
  // Keep last 300 samples (5 seconds at 60fps)
  if(Player._perfData.updateTimes.length > 300) {
    Player._perfData.updateTimes.shift();
  }
  

  return pack;
};
// ===== END PLAYER.UPDATE COORDINATOR =====

// ============================================================================
// EQUIPMENT STAT BONUSES
// ============================================================================

// Recalculate player stats based on equipped gear
global.recalculatePlayerStats = function(playerId){
  var player = Player.list[playerId];
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5442',message:'recalculatePlayerStats called',data:{playerId:playerId,hasPlayer:!!player,hasGear:!!(player && player.gear),gearWeapon:player && player.gear ? (typeof player.gear.weapon === 'object' ? JSON.stringify(player.gear.weapon) : player.gear.weapon) : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion
  if(!player || !player.gear) return;
  
  // Reset bonuses to base values
  player.strength = 10; // Base strength
  player.dexterity = 1; // Base dexterity
  player.hpMax = player.hpNat || 100; // Base HP
  player.spiritMax = player.spiritNat || 100; // Base spirit
  player.defense = 0; // Base defense
  
  // Apply weapon bonuses
  var weapon = null;
  const equip = global.equip || {};
  if(player.gear.weapon){
    // Check if player.gear.weapon is already the weapon object or a key string
    if(typeof player.gear.weapon === 'object' && player.gear.weapon.type){
      weapon = player.gear.weapon;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5458',message:'Weapon found as object',data:{weaponType:weapon.type,weaponName:weapon.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } else if(equip[player.gear.weapon]){
      weapon = equip[player.gear.weapon];
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5460',message:'Weapon found via equip lookup',data:{gearWeaponKey:player.gear.weapon,weaponType:weapon.type,weaponName:weapon.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5461',message:'Weapon lookup failed',data:{gearWeapon:typeof player.gear.weapon === 'object' ? JSON.stringify(player.gear.weapon) : player.gear.weapon,isObject:typeof player.gear.weapon === 'object',hasType:player.gear.weapon && player.gear.weapon.type,hasEquip:!!global.equip,equipKeys:global.equip ? Object.keys(global.equip).slice(0,5) : []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    }
  }
  
  if(weapon){
    player.damage = weapon.dmg || player.damage;
    player.attackRate = weapon.attackrate || player.attackRate;
    player.strength += weapon.strengthBonus || 0;
    player.dexterity += weapon.dexterityBonus || 0;
    player.hpMax += weapon.hpBonus || 0;
    
    // Set ranged flag based on weapon type
    var wasRanged = player.ranged;
    player.ranged = (weapon.type === 'bow');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5472',message:'Setting ranged flag',data:{weaponType:weapon.type,isBow:weapon.type === 'bow',wasRanged:wasRanged,nowRanged:player.ranged},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
    // #endregion
  } else {
    // No weapon equipped - not ranged
    player.ranged = false;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:5475',message:'No weapon - setting ranged to false',data:{playerId:playerId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
  }
  
  // Apply armor bonuses
  if(player.gear.armor && equip[player.gear.armor]){
    var armor = equip[player.gear.armor];
    player.defense += armor.defense || 0;
    player.hpMax += armor.hpBonus || 0;
    player.spiritMax += armor.spiritBonus || 0;
  }
  
  // Apply head gear bonuses
  if(player.gear.head && equip[player.gear.head]){
    var head = equip[player.gear.head];
    player.defense += head.defense || 0;
    player.hpMax += head.hpBonus || 0;
    player.spiritMax += head.spiritBonus || 0;
  }
  
  // Ensure current HP/spirit don't exceed new max
  if(player.hp > player.hpMax){
    player.hp = player.hpMax;
  }
  if(player.spirit > player.spiritMax){
    player.spirit = player.spiritMax;
  }
  
};

// ============================================================================
// MARKET ORDERBOOK SYSTEM
// ============================================================================

// Generate unique order ID
function generateOrderId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Find nearest market building for a player
global.findNearestMarket = function(playerId) {
  var player = Player.list[playerId];
  if(!player) return null;
  
  var nearestMarket = null;
  var nearestDist = Infinity;
  
  for(var id in Building.list){
    var building = Building.list[id];
    if(building.type === 'market'){
      var dist = getDistance({x: player.x, y: player.y}, {x: building.x, y: building.y});
      if(dist < nearestDist){
        nearestDist = dist;
        nearestMarket = building;
      }
    }
  }
  
  return nearestMarket;
}

// Broadcast message to all players inside a market building
function broadcastToMarket(marketId, message) {
  var market = Building.list[marketId];
  if(!market) return;
  
  for(var id in Player.list){
    var player = Player.list[id];
    if(!player) continue;
    
    // Check if player is inside this market (z=1 or z=2)
    if((player.z === 1 || player.z === 2)){
      var playerBuilding = getBuilding(player.x, player.y);
      if(playerBuilding === marketId){
        var socket = SOCKET_LIST[id];
        if(socket){
          socket.write(JSON.stringify({msg:'addToChat', message: message}));
        }
      }
    }
  }
}

// Get competitive price for selling (NPCs undercut market to sell quickly)
global.getCompetitiveAskPrice = function(marketId, resource) {
  var market = Building.list[marketId];
  if(!market) return null;
  
  // Get orderbook (supports dynamic creation)
  var book = market.getOrderbook ? market.getOrderbook(resource) : market.orderbook[resource];
  if(!book) return null;
  
  // If there are buy orders, price slightly above best bid (competitive but still profitable)
  if(book.bids && book.bids.length > 0){
    book.bids.sort(function(a, b){ return b.price - a.price; });
    var bestBid = book.bids[0].price;
    return Math.max(1, Math.floor(bestBid * 0.95)); // 5% below best bid
  }
  
  // If there are sell orders, undercut the cheapest ask
  if(book.asks && book.asks.length > 0){
    book.asks.sort(function(a, b){ return a.price - b.price; });
    var cheapestAsk = book.asks[0].price;
    return Math.max(1, Math.floor(cheapestAsk * 0.95)); // Undercut by 5%
  }
  
  // FALLBACK: No market history - use fixed base prices
  var basePrices = {
    // Resources
    grain: 3, wood: 8, stone: 10,
    ironore: 15, silverore: 40, goldore: 80,
    diamond: 200, iron: 25, steel: 50, leather: 12,
    // Weapons
    sword: 100, bow: 80, arrows: 2,
    // Armor
    ironarmor: 150, steelarmor: 300,
    // Tools
    torch: 5, pickaxe: 30,
    // Consumables
    bread: 4, fish: 6, flour: 3
  };
  return basePrices[resource] || 10; // Always returns a valid price
};

// Get competitive price for buying (NPCs bid competitively to acquire goods)
global.getCompetitiveBidPrice = function(marketId, resource) {
  var market = Building.list[marketId];
  if(!market) return null;
  
  // Get orderbook (supports dynamic creation)
  var book = market.getOrderbook ? market.getOrderbook(resource) : market.orderbook[resource];
  if(!book) return null;
  
  // If there are sell orders, price slightly above best ask (willing to pay a bit more)
  if(book.asks && book.asks.length > 0){
    book.asks.sort(function(a, b){ return a.price - b.price; });
    var bestAsk = book.asks[0].price;
    return Math.ceil(bestAsk * 1.05); // 5% above best ask
  }
  
  // If there are buy orders, outbid the highest bid
  if(book.bids && book.bids.length > 0){
    book.bids.sort(function(a, b){ return b.price - a.price; });
    var bestBid = book.bids[0].price;
    return Math.ceil(bestBid * 1.05); // Outbid by 5%
  }
  
  // FALLBACK: No market history - use fixed base prices
  var basePrices = {
    // Resources
    grain: 3, wood: 8, stone: 10,
    ironore: 15, silverore: 40, goldore: 80,
    diamond: 200, iron: 25, steel: 50, leather: 12,
    // Weapons
    sword: 100, bow: 80, arrows: 2,
    // Armor
    ironarmor: 150, steelarmor: 300,
    // Tools
    torch: 5, pickaxe: 30,
    // Consumables
    bread: 4, fish: 6, flour: 3
  };
  return basePrices[resource] || 10; // Always returns a valid price
};

// Process buy limit order
global.processBuyOrder = function(playerId, market, resource, amount, price){
  var player = Player.list[playerId];
  var socket = SOCKET_LIST[playerId];
  if(!player || !socket || !market) return;
  
  // Validate amount and price
  if(amount <= 0 || price <= 0){
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>❌ Amount and price must be greater than 0</i>'}));
    return;
  }
  
  // Get orderbook for this resource (creates if doesn't exist - supports all items)
  var book = market.getOrderbook ? market.getOrderbook(resource) : market.orderbook[resource];
  if(!book){
    // Fallback for old markets without getOrderbook
    market.orderbook[resource] = {bids: [], asks: []};
    book = market.orderbook[resource];
  }
  
  var emoji = market.getItemEmoji ? market.getItemEmoji(resource) : (market.resourceEmoji[resource] || '📦');
  var remaining = amount;
  var totalCost = 0;
  var filled = [];
  
  // Sort asks (sell orders) by price (low to high)
  book.asks.sort(function(a, b){ return a.price - b.price; });
  
  // Try to fill against existing sell orders
  for(var i = 0; i < book.asks.length && remaining > 0; i++){
    var ask = book.asks[i];
    if(ask.price <= price){
      // Can fill against this sell order
      var fillAmount = Math.min(remaining, ask.amount);
      var fillCost = fillAmount * ask.price;
      
      // Check if player has enough silver
      var silver = player.stores.silver || 0;
      if(silver < fillCost){
        socket.write(JSON.stringify({msg:'addToChat',message:'<i>❌ Not enough silver. Need ' + fillCost + ', have ' + silver + '</i>'}));
        return;
      }
      
      // Execute fill
      player.stores.silver -= fillCost;
      player.stores[resource] = (player.stores[resource] || 0) + fillAmount;
      
      // Pay seller
      var seller = Player.list[ask.player];
      if(seller){
        seller.stores.silver = (seller.stores.silver || 0) + fillCost;
        var sellerSocket = SOCKET_LIST[ask.player];
        if(sellerSocket){
          sellerSocket.write(JSON.stringify({msg:'addToChat',message:'<span style="color:#66ff66;">✅ Sold ' + fillAmount + ' ' + emoji + ' ' + resource + ' @ ' + ask.price + ' silver = ' + fillCost + ' silver</span>'}));
        }
      }
      
      // Broadcast fill to market (Phase 6: Enhanced with buyer/seller names)
      var buyerName = player.name || player.class || 'Trader';
      var sellerName = seller ? (seller.name || seller.class || 'Seller') : 'Seller';
      broadcastToMarket(market.id, '<span style="color:#88ff88;">📊 ' + buyerName + ' bought ' + fillAmount + ' ' + emoji + ' ' + resource + ' @ ' + ask.price + ' silver from ' + sellerName + '</span>');
      
      remaining -= fillAmount;
      totalCost += fillCost;
      filled.push({amount: fillAmount, price: ask.price});
      
      // Update or remove sell order
      ask.amount -= fillAmount;
      if(ask.amount <= 0){
        book.asks.splice(i, 1);
        i--;
      }
    } else {
      break; // No more fills possible at this price
    }
  }
  
  // Queue remainder as buy order (bid)
  if(remaining > 0){
    var totalRemainingCost = remaining * price;
    var silver = player.stores.silver || 0;
    if(silver < totalRemainingCost){
      socket.write(JSON.stringify({msg:'addToChat',message:'<i>❌ Not enough silver for full order. Need ' + totalRemainingCost + ' more, have ' + silver + '</i>'}));
      return;
    }
    
    // Reserve silver for the order
    player.stores.silver -= totalRemainingCost;
    
    book.bids.push({
      orderId: generateOrderId(),
      player: playerId,
      amount: remaining,
      price: price,
      reserved: totalRemainingCost
    });
    
    // Sort bids (high to low)
    book.bids.sort(function(a, b){ return b.price - a.price; });
    
    // Broadcast new bid to market
    var buyerName = player.name || player.class || 'Trader';
    broadcastToMarket(market.id, '<span style="color:#66ff66;">📊 New BID: ' + buyerName + ' wants ' + remaining + ' ' + emoji + ' ' + resource + ' @ ' + price + ' silver</span>');
  }
  
  // Send feedback
  var message = '<span style="color:#66ff66;">✅ BUY ORDER: ' + emoji + ' ' + resource.toUpperCase() + '</span>';
  if(filled.length > 0){
    message += '<br><b>Filled ' + (amount - remaining) + '/' + amount + '</b>';
    for(var i in filled){
      var f = filled[i];
      message += '<br>&nbsp;&nbsp;' + f.amount + ' @ ' + f.price + ' silver';
    }
    message += '<br><b>Total cost: ' + totalCost + ' silver</b>';
  }
  if(remaining > 0){
    message += '<br><b>Queued ' + remaining + ' @ ' + price + ' silver</b>';
    message += '<br><i>(Reserved ' + (remaining * price) + ' silver)</i>';
  }
  socket.write(JSON.stringify({msg:'addToChat',message: message}));
};

// Process sell limit order
global.processSellOrder = function(playerId, market, resource, amount, price){
  var player = Player.list[playerId];
  var socket = SOCKET_LIST[playerId];
  if(!player || !socket || !market) return;
  
  // Validate amount and price
  if(amount <= 0 || price <= 0){
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>❌ Amount and price must be greater than 0</i>'}));
    return;
  }
  
  // Check if player has the resource
  var playerAmount = player.stores[resource] || 0;
  if(playerAmount < amount){
    socket.write(JSON.stringify({msg:'addToChat',message:'<i>❌ Not enough ' + resource + '. Have ' + playerAmount + ', need ' + amount + '</i>'}));
    return;
  }
  
  // Get orderbook for this resource (creates if doesn't exist - supports all items)
  var book = market.getOrderbook ? market.getOrderbook(resource) : market.orderbook[resource];
  if(!book){
    // Fallback for old markets without getOrderbook
    market.orderbook[resource] = {bids: [], asks: []};
    book = market.orderbook[resource];
  }
  
  var emoji = market.getItemEmoji ? market.getItemEmoji(resource) : (market.resourceEmoji[resource] || '📦');
  var remaining = amount;
  var totalEarned = 0;
  var filled = [];
  
  // Sort bids (buy orders) by price (high to low)
  book.bids.sort(function(a, b){ return b.price - a.price; });
  
  // Try to fill against existing buy orders
  for(var i = 0; i < book.bids.length && remaining > 0; i++){
    var bid = book.bids[i];
    if(bid.price >= price){
      // Can fill against this buy order
      var fillAmount = Math.min(remaining, bid.amount);
      var fillEarned = fillAmount * bid.price;
      
      // Execute fill
      player.stores[resource] -= fillAmount;
      player.stores.silver = (player.stores.silver || 0) + fillEarned;
      
      // Give buyer the resource
      var buyer = Player.list[bid.player];
      if(buyer){
        buyer.stores[resource] = (buyer.stores[resource] || 0) + fillAmount;
        // Return unused reserved silver
        var unusedSilver = (bid.amount - fillAmount) * bid.price;
        buyer.stores.silver = (buyer.stores.silver || 0) + unusedSilver;
        
        var buyerSocket = SOCKET_LIST[bid.player];
        if(buyerSocket){
          buyerSocket.write(JSON.stringify({msg:'addToChat',message:'<span style="color:#ff6666;">✅ Bought ' + fillAmount + ' ' + emoji + ' ' + resource + ' @ ' + bid.price + ' silver = ' + fillEarned + ' silver</span>'}));
        }
      }
      
      // Broadcast fill to market (Phase 6: Enhanced with buyer/seller names)
      var sellerName = player.name || player.class || 'Trader';
      var buyerName = buyer ? (buyer.name || buyer.class || 'Buyer') : 'Buyer';
      broadcastToMarket(market.id, '<span style="color:#ff8888;">📊 ' + sellerName + ' sold ' + fillAmount + ' ' + emoji + ' ' + resource + ' @ ' + bid.price + ' silver to ' + buyerName + '</span>');
      
      remaining -= fillAmount;
      totalEarned += fillEarned;
      filled.push({amount: fillAmount, price: bid.price});
      
      // Update or remove buy order
      bid.amount -= fillAmount;
      bid.reserved -= fillAmount * bid.price;
      if(bid.amount <= 0){
        book.bids.splice(i, 1);
        i--;
      }
    } else {
      break; // No more fills possible at this price
    }
  }
  
  // Queue remainder as sell order (ask)
  if(remaining > 0){
    // Reserve the resource
    player.stores[resource] -= remaining;
    
    book.asks.push({
      orderId: generateOrderId(),
      player: playerId,
      amount: remaining,
      price: price,
      reserved: remaining
    });
    
    // Sort asks (low to high)
    book.asks.sort(function(a, b){ return a.price - b.price; });
    
    // Broadcast new ask to market
    var sellerName = player.name || player.class || 'Trader';
    broadcastToMarket(market.id, '<span style="color:#ff6666;">📊 New ASK: ' + sellerName + ' selling ' + remaining + ' ' + emoji + ' ' + resource + ' @ ' + price + ' silver</span>');
  }
  
  // Send feedback
  var message = '<span style="color:#ff6666;">✅ SELL ORDER: ' + emoji + ' ' + resource.toUpperCase() + '</span>';
  if(filled.length > 0){
    message += '<br><b>Filled ' + (amount - remaining) + '/' + amount + '</b>';
    for(var i in filled){
      var f = filled[i];
      message += '<br>&nbsp;&nbsp;' + f.amount + ' @ ' + f.price + ' silver';
    }
    message += '<br><b>Total earned: ' + totalEarned + ' silver</b>';
  }
  if(remaining > 0){
    message += '<br><b>Queued ' + remaining + ' @ ' + price + ' silver</b>';
    message += '<br><i>(Reserved ' + remaining + ' ' + resource + ')</i>';
  }
  socket.write(JSON.stringify({msg:'addToChat',message: message}));
};

// ============================================================================
// RESOURCE REPORTING
// ============================================================================

// OPTIMIZED: Async version to prevent 32-second blocking spike
function sendDailyResourceReport() {
  
  // Collect all player data first (fast pass)
  const players = [];
  for(var id in Player.list){
    var player = Player.list[id];
    if(!player || player.type !== 'player') continue;
    var socket = SOCKET_LIST[id];
    if(!socket) continue;
    players.push({id, player, socket});
  }
  
  if(players.length === 0){
    return;
  }
  
  // Process players asynchronously to prevent blocking
  let playerIndex = 0;
  let reportsSent = 0;
  
  function processNextPlayer() {
    if(playerIndex >= players.length){
      return;
    }
    
    const {id, player, socket} = players[playerIndex++];
    
    var reportData = {
      grain: {daily: 0, buildings: []},
      wood: {daily: 0, buildings: []},
      stone: {daily: 0, buildings: []},
      ironore: {daily: 0, buildings: []},
      silverore: {daily: 0, buildings: []},
      goldore: {daily: 0, buildings: []},
      diamond: {daily: 0, buildings: []}
    };
    
    var buildingsOwned = 0;
    
    // OPTIMIZED: Scan all buildings - removed excessive logging
    for(var bid in Building.list){
      var building = Building.list[bid];
      
      // Check if player owns this building directly OR through their House
      var isOwned = (building.owner === player.id) || (player.house && building.house === player.house);
      if(!isOwned) continue;
      
      buildingsOwned++;
      
      // Skip if no daily tracking
      if(!building.dailyStores) continue;
      
      // Process building resources (no logging per building)
      if(building.type === 'mill'){
        if(building.dailyStores.grain > 0){
          reportData.grain.daily += building.dailyStores.grain;
          reportData.grain.buildings.push({type: 'Mill', amount: building.dailyStores.grain, id: bid});
        }
      } else if(building.type === 'lumbermill'){
        if(building.dailyStores.wood > 0){
          reportData.wood.daily += building.dailyStores.wood;
          reportData.wood.buildings.push({type: 'Lumbermill', amount: building.dailyStores.wood, id: bid});
        }
      } else if(building.type === 'mine'){
        if(building.dailyStores.stone > 0){
          reportData.stone.daily += building.dailyStores.stone;
          reportData.stone.buildings.push({type: 'Mine', amount: building.dailyStores.stone, id: bid});
        }
        if(building.dailyStores.ironore > 0){
          reportData.ironore.daily += building.dailyStores.ironore;
          reportData.ironore.buildings.push({type: 'Mine', amount: building.dailyStores.ironore, id: bid});
        }
        if(building.dailyStores.silverore > 0){
          reportData.silverore.daily += building.dailyStores.silverore;
          reportData.silverore.buildings.push({type: 'Mine', amount: building.dailyStores.silverore, id: bid});
        }
        if(building.dailyStores.goldore > 0){
          reportData.goldore.daily += building.dailyStores.goldore;
          reportData.goldore.buildings.push({type: 'Mine', amount: building.dailyStores.goldore, id: bid});
        }
        if(building.dailyStores.diamond > 0){
          reportData.diamond.daily += building.dailyStores.diamond;
          reportData.diamond.buildings.push({type: 'Mine', amount: building.dailyStores.diamond, id: bid});
        }
      }
    }
    
    // Get total accumulated resources from House stores
    var houseStores = {grain: 0, wood: 0, stone: 0, ironore: 0, silverore: 0, goldore: 0, diamond: 0, iron: 0};
    if(player.house && House.list[player.house]){
      var house = House.list[player.house];
      houseStores.grain = house.stores.grain || 0;
      houseStores.wood = house.stores.wood || 0;
      houseStores.stone = house.stores.stone || 0;
      houseStores.ironore = house.stores.ironore || 0;
      houseStores.silverore = house.stores.silverore || 0;
      houseStores.goldore = house.stores.goldore || 0;
      houseStores.diamond = house.stores.diamond || 0;
      houseStores.iron = house.stores.iron || 0;
    } else if(House.list[player.id]){
      // Player IS a house
      var house = House.list[player.id];
      houseStores.grain = house.stores.grain || 0;
      houseStores.wood = house.stores.wood || 0;
      houseStores.stone = house.stores.stone || 0;
      houseStores.ironore = house.stores.ironore || 0;
      houseStores.silverore = house.stores.silverore || 0;
      houseStores.goldore = house.stores.goldore || 0;
      houseStores.diamond = house.stores.diamond || 0;
      houseStores.iron = house.stores.iron || 0;
    } else {
      // Player without house - use player stores
      houseStores.grain = player.stores.grain || 0;
      houseStores.wood = player.stores.wood || 0;
      houseStores.stone = player.stores.stone || 0;
      houseStores.ironore = player.stores.ironore || 0;
      houseStores.silverore = player.stores.silverore || 0;
      houseStores.goldore = player.stores.goldore || 0;
      houseStores.diamond = player.stores.diamond || 0;
      houseStores.iron = player.stores.iron || 0;
    }
    
    // Build polished report message with styled sections
    var message = '<span style="color:#ffdd88;"><b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b></span><br>';
    message += '<span style="color:#ffdd88;"><b>📊 Daily Resource Report</b></span><br>';
    message += '<span style="color:#ffdd88;"><b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b></span><br>';
    var hasResources = false;
    
    // Helper function to format resource lines
    var formatResource = function(name, icon, total, dailyAmount, buildings, color) {
      if(dailyAmount > 0 || total > 0){
      hasResources = true;
        var line = '<br><span style="color:' + color + ';"><b>' + icon + ' ' + name + ':</b> ' + total + ' total';
        if(dailyAmount > 0){
          line += ' <span style="color:#88ff88;">(+' + dailyAmount + ' today)</span>';
        }
        line += '</span>';
        
        // Show breakdown by building if multiple sources
        if(buildings.length > 1){
          for(var i in buildings){
            var b = buildings[i];
            line += '<br><span style="color:#aaaaaa;">  └─ ' + b.type + ': +' + b.amount + '</span>';
          }
        }
        return line;
      }
      return '';
    };
    
    // Resources in organized order with icons and colors
    message += formatResource('Grain', '🌾', houseStores.grain, reportData.grain.daily, reportData.grain.buildings, '#ffdd44');
    message += formatResource('Lumber', '🪵', houseStores.wood, reportData.wood.daily, reportData.wood.buildings, '#cc8844');
    message += formatResource('Stone', '🪨', houseStores.stone, reportData.stone.daily, reportData.stone.buildings, '#888888');
    message += formatResource('Iron Ore', '⛏️', houseStores.ironore, reportData.ironore.daily, reportData.ironore.buildings, '#ff8844');
    message += formatResource('Silver Ore', '⚒️', houseStores.silverore, reportData.silverore.daily, reportData.silverore.buildings, '#ccccdd');
    message += formatResource('Gold Ore', '⛏️', houseStores.goldore, reportData.goldore.daily, reportData.goldore.buildings, '#ffdd00');
    message += formatResource('Diamonds', '💎', houseStores.diamond, reportData.diamond.daily, reportData.diamond.buildings, '#88ddff');
    
    // Show processed materials if any
    if(houseStores.iron > 0){
      hasResources = true;
      message += '<br><span style="color:#ff6644;"><b>🔥 Iron Bars:</b> ' + houseStores.iron + '</span>';
    }
    
    // OPTIMIZED: Removed excessive logging
    if(hasResources){
      // Add closing line for polished look
      message += '<br><span style="color:#ffdd88;"><b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b></span>';
      
      socket.write(JSON.stringify({msg:'addToChat',message: message}));
      reportsSent++;
    }
    
    // Process next player asynchronously to prevent blocking
    setImmediate(processNextPlayer);
  }
  
  // Start processing first player
  processNextPlayer();
}

function resetDailyResourceTracking() {
  // Reset daily stores for all buildings at start of work day
  for(var id in Building.list){
    var building = Building.list[id];
    if(building.dailyStores){
      if(building.type === 'mill'){
        building.dailyStores.grain = 0;
      } else if(building.type === 'lumbermill'){
        building.dailyStores.wood = 0;
      } else if(building.type === 'mine'){
        building.dailyStores.stone = 0;
        building.dailyStores.ironore = 0;
        building.dailyStores.silverore = 0;
        building.dailyStores.goldore = 0;
        building.dailyStores.diamond = 0;
      }
    }
  }
}

// ============================================================================
// DAY/NIGHT CYCLE
// ============================================================================

// dayNight() increments hour every 10 seconds and updates gameState
// Simple hour counter - increments each time the function is called (every 10 seconds)
let hourTick = 0; // Tracks which hour we're in (0-23, where 0 = XII.a)

function dayNight() {
  // Increment hour counter (0-23, cycles through all 24 hours)
  hourTick = (hourTick + 1) % 24;
  const newTempus = cycle[hourTick];
  
  // When we cycle back to XII.a (hourTick = 0), increment the day
  if (hourTick === 0) {
    gameState.day++;
    global.day = gameState.day;  // Sync global.day with gameState.day
  }
  
  // Update tempus in gameState and sync local/global variables
  const previousTempus = gameState.tempus;
  gameState.tempus = newTempus;
  gameState.previousTempus = previousTempus;
  tempus = newTempus;
  global.tempus = newTempus;
  
  // Calculate nightfall
  nightfall = ['VIII.p', 'IX.p', 'X.p', 'XI.p', 'XII.a', 'I.a', 'II.a', 'III.a', 'IV.a'].includes(newTempus);
  gameState.nightfall = nightfall;
  global.nightfall = nightfall;
  
  // Fire hour change event
  if (global.eventManager) {
    global.eventManager.hourChange(newTempus, gameState.day);
  }
  
  // Check if we just transitioned TO XII.a (midnight)
  if (hourTick === 0) {
    // Track population BEFORE midnight updates
    let populationBefore = {
      players: 0,
      npcs: 0,
      fauna: 0
    };
    
    // Count serfs by house BEFORE midnight updates
    const serfsBeforeByHouse = {};
    
    // Count military units by house at the END of the day (before day increments)
    // This will be compared to the counts stored at the START of this day
    const militaryUnitsAtDayEnd = {};
    
    if (global.Player && global.Player.list) {
      for (const id in Player.list) {
        const entity = Player.list[id];
        if (entity.type === 'player') {
          populationBefore.players++;
        } else if (entity.type === 'fauna' || ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep', 'deer', 'boar', 'wolf', 'falcon', 'sheep'].includes(entity.class)) {
          // CRITICAL: Check type === 'fauna' first, then check class (case-insensitive)
          // Fauna entities should have type === 'fauna' but check class as fallback
          populationBefore.fauna++;
        } else if (entity.type === 'npc' || entity.class === 'serf' || entity.class === 'maleserf' || entity.class === 'femaleserf') {
          populationBefore.npcs++;
          // Count serfs by house
          if (entity.house && House.list[entity.house]) {
            const houseName = House.list[entity.house].name || entity.house;
            serfsBeforeByHouse[houseName] = (serfsBeforeByHouse[houseName] || 0) + 1;
          }
        } else if (entity.military && entity.house && House.list[entity.house]) {
          // Count military units by house
          const houseName = House.list[entity.house].name || entity.house;
          militaryUnitsAtDayEnd[houseName] = (militaryUnitsAtDayEnd[houseName] || 0) + 1;
        }
      }
    }
    
    // Calculate military units added during the day (if we have data from day start)
    const militaryUnitsAdded = {};
    if (Object.keys(militaryUnitsAtDayStart).length > 0) {
      for (const houseName in militaryUnitsAtDayEnd) {
        const before = militaryUnitsAtDayStart[houseName] || 0;
        const after = militaryUnitsAtDayEnd[houseName] || 0;
        const added = after - before;
        if (added > 0) {
          militaryUnitsAdded[houseName] = added;
        }
      }
      // Also check for houses that had units at start but none at end (shouldn't happen, but be safe)
      for (const houseName in militaryUnitsAtDayStart) {
        if (!militaryUnitsAdded[houseName] && militaryUnitsAtDayEnd[houseName]) {
          const before = militaryUnitsAtDayStart[houseName] || 0;
          const after = militaryUnitsAtDayEnd[houseName] || 0;
          const added = after - before;
          if (added > 0) {
            militaryUnitsAdded[houseName] = added;
          }
        }
      }
    }
    
    dailyTally();
    resetDailyResourceTracking(); // Reset daily resource counters for new day

    const playerCount = Object.keys(Player.list).length;
    
    // Trigger daily faction AI evaluation (includes territory recalculation)
    // This may spawn serfs, so we need to track that
    for (var houseId in House.list) {
      var house = House.list[houseId];
      if (house.ai && house.ai.evaluateAndAct) {
        house.ai.evaluateAndAct();
      }
    }

    // Optional: Save map
    const saveMap = false;
    if (saveMap) {
      fs.writeFile(`./maps/map${gameState.day}.txt`, JSON.stringify(world))
        .catch(err => {});
    }
    
    // Run entropy at midnight and get statistics
    let entropyStats = { tilesChanged: 0, faunaAdded: 0 };
    if (lastEntropyTempus !== newTempus) {
      entropyStats = entropy() || { tilesChanged: 0, faunaAdded: 0 };
      lastEntropyTempus = newTempus;
    }
    
    // Count serfs by house AFTER midnight updates
    const serfsAfterByHouse = {};
    if (global.Player && global.Player.list) {
      for (const id in Player.list) {
        const entity = Player.list[id];
        if (entity.type === 'npc' || entity.class === 'serf' || entity.class === 'maleserf' || entity.class === 'femaleserf') {
          if (entity.house && House.list[entity.house]) {
            const houseName = House.list[entity.house].name || entity.house;
            serfsAfterByHouse[houseName] = (serfsAfterByHouse[houseName] || 0) + 1;
          }
        }
      }
    }
    
    // Calculate serfs added per house
    const serfsAdded = {};
    for (const houseName in serfsAfterByHouse) {
      const before = serfsBeforeByHouse[houseName] || 0;
      const after = serfsAfterByHouse[houseName] || 0;
      const added = after - before;
      if (added > 0) {
        serfsAdded[houseName] = added;
      }
    }
    
    // Store military unit counts at the START of the new day (for next day's recap)
    militaryUnitsAtDayStart = {};
    if (global.Player && global.Player.list) {
      for (const id in Player.list) {
        const entity = Player.list[id];
        if (entity.military && entity.house && House.list[entity.house]) {
          const houseName = House.list[entity.house].name || entity.house;
          militaryUnitsAtDayStart[houseName] = (militaryUnitsAtDayStart[houseName] || 0) + 1;
        }
      }
    }
    
    // Create daily recap event (for the day that just ended, before day was incremented)
    const dayForRecap = gameState.day - 1;
    if (global.eventManager) {
      global.eventManager.dailyRecap(dayForRecap, populationBefore, {
        tilesChanged: entropyStats.tilesChanged || 0,
        faunaAdded: entropyStats.faunaAdded || 0,
        serfsAdded: serfsAdded,
        militaryUnitsAdded: militaryUnitsAdded
      });
    }
  }

  if (newTempus === 'VII.p') {
    // Work day ends (after serfs clock out) - send resource reports
    sendDailyResourceReport();
  }

  // Reset entropy guard when tempus moves away from XII.a
  if (newTempus !== 'XII.a' && lastEntropyTempus === 'XII.a') {
    // Reset guard when tempus moves away from XII.a so entropy can run again next midnight
    lastEntropyTempus = null;
  }

  // Track day/night transitions for events
  if (global.eventManager) {
    const wasNight = global.lastNightfall;
    if (nightfall !== wasNight) {
      // Transition occurred
      if (nightfall) {
        global.eventManager.dayNightTransition('Nightfall', true);
      } else {
        global.eventManager.dayNightTransition('Dawn', false);
      }
    }
    global.lastNightfall = nightfall;
  }

  // Emit tempus update to clients
  emit({ msg: 'tempus', tempus: newTempus, nightfall: nightfall });

  House.update;
  Kingdom.update;

  // Sync global tick with gameState (tick is updated by gameState.updateTime() every frame)
  tick = gameState.tick;
  global.tick = tick;
}

// ============================================================================
// NETWORKING
// ============================================================================

const app = express();
const serv = require('http').Server(app);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/client/index.html');
});

// Serve static files
app.use('/client', express.static(__dirname + '/client'));

// Generate and store server name
function generateServerName() {
  try {
    const surnames = fsSync.readFileSync('./surnames.txt', 'utf-8').split('\n').filter(name => name.trim());
    // Filter names between 4-5 letters
    const validNames = surnames.filter(name => {
      const trimmed = name.trim();
      return trimmed.length >= 4 && trimmed.length <= 5;
    });
    
    if (validNames.length > 0) {
      const randomName = validNames[Math.floor(Math.random() * validNames.length)].trim();
      return randomName;
    }
    return 'Lambic'; // Fallback name
  } catch (error) {
    return 'Lambic';
  }
}

// Initialize server name (generates fresh on each startup)
let serverName = generateServerName();
gameState.serverName = serverName;
global.serverName = serverName;

// Initialize SockJS server BEFORE CLI runs (so message appears before user input)
// This must happen before initializeWorld() to ensure message prints before CLI prompt
if (!io) {
  io = sockjs.createServer();
  io.installHandlers(serv, { prefix: '/io' });
  serv.listen(2000);
  // Print SockJS message explicitly before CLI starts (library may print it asynchronously)
  console.log('SockJS v0.3.24 bound to "/io"');
  
  // Suppress any duplicate messages from the library
  const originalLog = console.log;
  let sockjsMessageSuppressed = false;
  console.log = function(...args) {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes('SockJS') && msg.includes('bound to')) {
      if (!sockjsMessageSuppressed) {
        sockjsMessageSuppressed = true;
        return; // Suppress - we already printed it
      }
    }
    originalLog.apply(console, args);
  };
  
  // Restore after a brief moment to catch any async library messages
  setTimeout(() => {
    console.log = originalLog;
  }, 50);
}

// Now start world initialization (SockJS message already printed)
initializeWorld().then(() => {
  continueServerInitialization();
}).catch((error) => {
  console.error('Fatal error during world initialization:', error);
  process.exit(1);
});

// ============================================================================
// INITIALIZE BLOCKCHAIN
// ============================================================================


// Initialize blockchain
global.blockchain = new LambicBlockchain();
global.blockchain.difficulty = NetworkConfig.MINING_DIFFICULTY;
global.blockchain.miningReward = NetworkConfig.MINING_REWARD;

// Load existing blockchain from disk
BlockchainStorage.loadChain().then(() => {
  
  // Validate loaded chain
  if (global.blockchain.isChainValid()) {
  } else {
  }
});

// Make blockchain managers available globally
global.WalletManager = WalletManager;
global.BalanceSync = BalanceSync;
global.BlockchainStorage = BlockchainStorage;
global.GoldTradeManager = GoldTradeManager;

// Initialize P2P network
global.p2pNetwork = new P2PNetwork(
  NetworkConfig.BLOCKCHAIN_PORT,
  NetworkConfig.BOOTSTRAP_PEERS
);

// Create server wallet for mining rewards
const serverWallet = WalletManager.createWallet('server_' + serverName);
global.serverWallet = serverWallet;


// Initialize mining manager
global.miningManager = new MiningManager(serverName, serverWallet.address);

// Start P2P server (after main game server starts)
setTimeout(() => {
  try {
    global.p2pNetwork.start();
  } catch (err) {
  }
}, 1000);

// Start mining blocks
setTimeout(() => {
  global.miningManager.startMining();
}, 2000);

// Start balance sync loop
setTimeout(() => {
  BalanceSync.startSyncLoop();
}, 3000);

// Start autosave
BlockchainStorage.startAutosave();

// ============================================================================
// EXPOSE REGISTRIES GLOBALLY (Phase 1: Foundation - Backward Compatibility)
// ============================================================================

// Expose registries globally for backward compatibility during transition
// New code should use dependency injection, but existing code can still access via globals
global.systemRegistry = systemRegistry;
global.entityRegistry = entityRegistry;
global.dependencyInjector = dependencyInjector;

  // Perform comprehensive system audit - logs only in DEBUG mode
  function performSystemAudit() {
  const DEBUG = process.env.DEBUG;
  const stats = systemRegistry.getStats();
  const dependencyCheck = systemRegistry.verifyAllDependencies();
  
  // Check for systems that might not be initialized
  const systemsNeedingInit = [];
  const systemNames = systemRegistry.getSystemNames();
  
  for (const name of systemNames) {
    const system = systemRegistry.get(name);
    if (system && typeof system.initialize === 'function') {
      systemsNeedingInit.push(name);
    }
  }
  
  // Log only in DEBUG mode
  if (DEBUG) {
    console.log('\n========================================');
    console.log('System Registry Audit');
    console.log('========================================');
    console.log('Registered systems:', stats.totalSystems);
    console.log('Systems:', stats.systems.join(', '));
    console.log('Initialization order:', stats.initializationOrder.join(' -> '));
    
    if (!dependencyCheck.allValid) {
      console.error('Dependency issues found:');
      dependencyCheck.issues.forEach(issue => {
        console.error(`  - ${issue.system} is missing dependencies: ${issue.missing.join(', ')}`);
      });
    } else {
      console.log('All system dependencies satisfied');
    }
    
    if (systemsNeedingInit.length > 0) {
      console.log('Systems with initialize() methods:', systemsNeedingInit.join(', '));
    }
    
    if (entityRegistry) {
      console.log('EntityRegistry Stats:', JSON.stringify(entityRegistry.getStats(), null, 2));
    }
    console.log('========================================\n');
  }
  
  // Always log critical errors regardless of DEBUG
  if (!dependencyCheck.allValid) {
    console.error('[SystemAudit] Dependency issues:', dependencyCheck.issues.map(i => i.system).join(', '));
  }
  
  // Return audit results for programmatic checks
  return {
    allValid: dependencyCheck.allValid,
    dependencyIssues: dependencyCheck.issues,
    systemsNeedingInit,
    totalSystems: stats.totalSystems
  };
}

// System audit will be performed in continueServerInitialization() after all systems are set up
// Additional startup validation
  function validateCriticalSystems() {
  const criticalSystems = [
    'gameState',
    'tilemap',
    'entities',
    'gameLoop'
  ];
  
  const missingSystems = [];
  const uninitializedSystems = [];
  
  for (const systemName of criticalSystems) {
    const system = systemRegistry.get(systemName);
    if (!system) {
      missingSystems.push(systemName);
    } else if (typeof system.initialize === 'function') {
      // Check if system needs initialization
      // Note: Some systems initialize lazily, which is fine
    }
  }
  
  if (missingSystems.length > 0) {
    console.error(`❌ CRITICAL: Missing required systems: ${missingSystems.join(', ')}`);
    return false;
  }
  
  // Verify entity collections are registered
  if (entityRegistry) {
    const entityStats = entityRegistry.getStats();
    const requiredCollections = ['players', 'buildings', 'items'];
    const missingCollections = requiredCollections.filter(
      col => !entityStats.collections || !entityStats.collections.includes(col)
    );
    
    if (missingCollections.length > 0) {
      console.warn(`⚠️  Warning: Missing entity collections: ${missingCollections.join(', ')}`);
    }
  }
  
  return true;
}

// Critical systems validation moved to continueServerInitialization() 
// after systems are initialized

// ============================================================================

// serv.listen() moved to before initializeWorld() to ensure SockJS message prints before CLI

io.on('connection', function(socket) {
  socket.id = Math.random();
  
  // Prevent duplicate socket entries - check if socket already exists
  for (const existingId in SOCKET_LIST) {
    if (SOCKET_LIST[existingId] === socket) {
      console.warn('[Socket] Socket already in SOCKET_LIST with ID:', existingId, '- removing old entry');
      delete SOCKET_LIST[existingId];
      break;
    }
  }
  
  SOCKET_LIST[socket.id] = socket;

  socket.on('data', function(string) {
    try {
      const data = JSON.parse(string);

      if (data.msg === 'requestPreviewData') {
        // Send world data for login screen preview (no authentication required)
        
        // Use existing world array (already in sync with tilemap system)
        // No need to reconstruct - this was causing severe lag
        
        // Get all NPCs, falcons, and other entities for preview
        const previewPack = {
          player: [],
          item: [],
          building: []
        };
        
        // Add all players/NPCs (especially falcons) to preview
        for (const i in Player.list) {
          const p = Player.list[i];
          if (p.type === 'npc' || p.class === 'Falcon') {
            previewPack.player.push({
              id: p.id,
              type: p.type,
              name: p.name,
              house: p.house,
              kingdom: p.kingdom,
              x: p.x,
              y: p.y,
              z: p.z,
              class: p.class,
              rank: p.rank,
              friends: p.friends,
              enemies: p.enemies,
              gear: p.gear,
              inventory: p.inventory,
              facing: p.facing,
              stealthed: p.stealthed,
              revealed: p.revealed,
              innaWoods: p.innaWoods,
              hp: p.hp,
              hpMax: p.hpMax,
              spirit: p.spirit,
              spiritMax: p.spiritMax,
              ghost: p.ghost,
              spriteSize: p.spriteSize,
              ranged: p.ranged,
              action: p.action
            });
          }
        }
        
        // Add items to preview
        for (const i in Item.list) {
          const item = Item.list[i];
          previewPack.item.push({
            id: item.id,
            type: item.type,
            x: item.x,
            y: item.y,
            z: item.z,
            qty: item.qty,
            innaWoods: item.innaWoods
          });
        }
        
        // Add buildings to preview - use getInitPack() to ensure all properties including baseTerrain are included
        for (const i in Building.list) {
          const b = Building.list[i];
          previewPack.building.push(b.getInitPack());
        }
        
        socket.write(JSON.stringify({
          msg: 'previewData',
          world: world, // Use existing world array
          tileSize,
          mapSize,
          tempus: gameState.tempus,
          nightfall: gameState.nightfall,
          pack: previewPack
        }));
      } else if (data.msg === 'signIn') {
        isValidPassword(data, function(res) {
          if (res) {
            Player.onConnect(socket, data.name);
            
            // Use existing world array (already in sync with tilemap system)
            // Reconstructing was causing severe connection lag
            
            socket.write(JSON.stringify({
              msg: 'signInResponse',
              success: true,
              world: world, // Use existing world array
              tileSize,
              mapSize,
              tempus: gameState.tempus,
              nightfall: gameState.nightfall
            }));
          } else {
            socket.write(JSON.stringify({ msg: 'signInResponse', success: false }));
          }
        });
      } else if (data.msg === 'signUp') {
        if (data.name.length > 0) {
          isUsernameTaken(data.name, function(res) {
            if (res) {
              socket.write(JSON.stringify({ msg: 'signUpResponse', success: false }));
            } else {
              addUser(data, function() {
                socket.write(JSON.stringify({ msg: 'signUpResponse', success: true }));
              });
            }
          });
        } else {
          socket.write(JSON.stringify({ msg: 'signUpResponse', success: false }));
        }
      } else if (data.msg === 'spectate') {
        // Spectate mode - supports both authenticated and guest spectators
        // Helper function to create spectator (used by both authenticated and guest paths)
        const createSpectator = function(spectatorName) {
          socket.write(JSON.stringify({
            msg: 'tempus',
            tempus,
            nightfall
          }));
          
          // Track spectator without creating a Player entity
          // Spectators are just camera viewers, no game entity needed
          global.spectators = global.spectators || {};
          global.spectators[socket.id] = {
            name: spectatorName,
            id: socket.id,
            type: 'spectator'
          };
          
          // Use existing world array (already in sync with tilemap system)
          // Reconstructing was causing severe connection lag
          
          socket.write(JSON.stringify({
            msg: 'spectateResponse',
            success: true,
            world: world, // Use existing world array
            tileSize,
            mapSize,
            tempus
          }));
          
          // Send faction data
          socket.write(JSON.stringify({
            msg: 'newFaction',
            houseList: House.list,
            kingdomList: Kingdom.list
          }));
          
          // Send init pack with all entities - NO selfId for spectators
          socket.write(JSON.stringify({
            msg: 'init',
            selfId: null, // Spectators don't have a player character
            pack: {
              player: Player.getAllInitPack(),
              arrow: Arrow.getAllInitPack(),
              item: Item.getAllInitPack(),
              light: Light.getAllInitPack(),
              building: Building.getAllInitPack()
            }
          }));
          
          // Send spectator welcome message
          const spectatorWelcome = `
            <div style="text-align: center; padding: 10px; color: #FFFFFF;">
              <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
              <p style="margin: 5px 0; color: #4CAF50; font-size: 18px; font-weight: bold;">👁️ SPECTATE MODE 👁️</p>
              <p style="margin: 5px 0; color: #FFFFFF;">Server: <span style="color: #4CAF50; font-weight: bold;">${global.serverName}</span></p>
              <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
              <p style="margin: 2px 0; color: #CCCCCC;"><span style="color: #FFD700; font-weight: bold;">Controls:</span> <b>ESC</b> Exit Spectate • <b>Enter</b> Chat</p>
              <p style="margin: 3px 0; color: #888888;">════════════════════════════════</p>
            </div>
          `;
          
          socket.write(JSON.stringify({
            msg: 'addToChat',
            message: spectatorWelcome
          }));
        };
        
        // Check if credentials are provided (non-empty strings after trimming)
        const hasCredentials = data.name && data.name.trim() && data.pass && data.pass.trim();
        
        if (hasCredentials) {
          // Try authentication
          isValidPassword(data, function(res) {
            if (res) {
              // Authentication successful - create authenticated spectator
              createSpectator(data.name);
            } else {
              // Authentication failed - create guest spectator
              global.guestSpectatorCounter++;
              const guestName = `Guest(${global.guestSpectatorCounter})`;
              createSpectator(guestName);
            }
          });
        } else {
          // No credentials provided - create guest spectator
          global.guestSpectatorCounter++;
          const guestName = `Guest(${global.guestSpectatorCounter})`;
          createSpectator(guestName);
        }
      } else if (data.msg === 'spectatorChat') {
        const spectator = global.spectators && global.spectators[socket.id];
        if(spectator){
          // Broadcast to all spectators only
          const spectatorMessage = `<b>[SPECTATING] ${spectator.name}:</b> ${data.message}`;
          for(var i in global.spectators){
            var spectatorSocket = SOCKET_LIST[i];
            if(spectatorSocket){
              spectatorSocket.write(JSON.stringify({
                msg: 'spectatorChatMessage',
                message: spectatorMessage
              }));
            }
          }
        }
      } else if (data.msg === 'evalCmd') {
        // Use original command system
        EvalCmd(data);
      } else {
        // Handle all game messages (requires player to be logged in)
        const player = Player.list[socket.id];
        if (!player) {
          // Ignore messages from non-logged-in connections
          return;
        }
        
        // All the game message handlers that were previously in Player.onConnect
        if(data.msg == 'keyPress'){
          // Special handling for ship sail controls
          // Check if player is currently aboard a ship
          if(player.boardedShip){
            var ship = Player.list[player.boardedShip];
            if(ship && ship.shipType === 'fishingship' && ship.isPlayerControlled){
              // Verify this player is actually the navigator (not just a passenger)
              var navigator = ship.passengers.find(function(p){ return p.isNavigator; });
              if(navigator && navigator.playerId === socket.id){
                // Handle sail point adjustments for WASD keys (only on key press, not release)
                // Original system: pressing a key adds a sail point, ship moves with momentum
                if(data.state === true && (data.inputId == 'left' || data.inputId == 'right' || data.inputId == 'up' || data.inputId == 'down')){
                  // Key pressed - adjust sail points (original momentum-based system)
                  ship.adjustSailPoints(data.inputId);
                } else if(data.inputId == 'f'){
                  ship.pressingF = data.state;
                }
                // Ignore other keys for ships (navigator can't use other keys while navigating)
                return;
              }
              // If player is a passenger (not navigator), allow normal key handling (A key for attack command)
            }
          }
          
          // Normal character controls (movement removed - now using click-based)
          if(data.inputId == 'e'){
            player.pressingE = data.state;
          } else if(data.inputId == 't'){
            player.pressingT = data.state;
          } else if(data.inputId == 'i'){
            player.pressingI = data.state;
          } else if(data.inputId == 'p'){
            player.pressingP = data.state;
          } else if(data.inputId == 'f'){
            player.pressingF = data.state;
          } else if(data.inputId == 'h'){
            player.pressingH = data.state;
          } else if(data.inputId == 'k'){
            player.pressingK = data.state;
          } else if(data.inputId == 'l'){
            player.pressingL = data.state;
          } else if(data.inputId == 'x'){
            player.pressingX = data.state;
          } else if(data.inputId == 'c'){
            player.pressingC = data.state;
          } else if(data.inputId == 'n'){
            player.pressingN = data.state;
          } else if(data.inputId == 'm'){
            player.pressingM = data.state;
          } else if(data.inputId == '1'){
            player.pressing1 = data.state;
          } else if(data.inputId == '2'){
            player.pressing2 = data.state;
          } else if(data.inputId == '3'){
            player.pressing3 = data.state;
          } else if(data.inputId == '4'){
            player.pressing4 = data.state;
          } else if(data.inputId == '5'){
            player.pressing5 = data.state;
          } else if(data.inputId == '6'){
            player.pressing6 = data.state;
          } else if(data.inputId == '7'){
            player.pressing7 = data.state;
          } else if(data.inputId == '8'){
            player.pressing8 = data.state;
          } else if(data.inputId == '9'){
            player.pressing9 = data.state;
          } else if(data.inputId == '0'){
            player.pressing0 = data.state;
          } else if(data.inputId == 'shift'){
            // Toggle running on keydown only (not keyup)
            if(data.state){
              // Ghosts have fixed speed, can't toggle running
              if(player.ghost){
                socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Ghosts cannot toggle running</i>` }));
              } else if(player.z === Z_LEVELS.UNDERWATER){
                socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>You can't run underwater!</i>` }));
              } else {
                player.running = !player.running;
                // No message - user doesn't need running/walking notification
              }
            }
          } else if(data.inputId == 'mouseAngle'){
            player.mouseAngle = data.state;
          }
        } else if (data.msg === 'clickNavigate') {
          // Right-click navigation to tile
          if(player && data.tileX !== undefined && data.tileY !== undefined && data.z !== undefined){
            // DISABLE click navigation if player is aboard a ship (navigator or passenger)
            if(player.boardedShip){
              // Clear any existing path to prevent queued pathfinding from executing after disembark
              player.path = null;
              player.pathCount = 0;
              return; // Ignore click navigation while aboard ship
            }
            
            var tileX = data.tileX;
            var tileY = data.tileY;
            var z = data.z;
            
            // For indoor navigation (z=1 or z=2), ensure player's current z-level matches
            // Use player's current z-level if they're indoors to ensure consistency
            if((z === 1 || z === 2) && player.z !== z){
              z = player.z; // Use player's current z-level for indoor navigation
            }
            
            // Get the tile type at the clicked location
            // Map z-level to correct data layer: z=-3 (underwater) uses layer 0 (overworld) for tile data
            var tileLayer = z === 0 ? 0 : (z === -1 ? 1 : (z === -2 ? 8 : (z === -3 ? 0 : (z === 1 ? 3 : 5))));
            var tile = getTile(tileLayer, tileX, tileY);
            
            // Check if the clicked tile is a transition tile (cave entrance, building door, water)
            var isTransitionTile = false;
            var isWaterTile = false;
            var isCaveEntranceTile = false;
            var isBuildingDoorTile = false;
            
            // Check if the clicked tile is a foundation/construction tile
            var foundationConstructionTiles = [
              TERRAIN.BUILD_MARKER,      // 11 - foundation tiles
              TERRAIN.BUILD_MARKER_ALT,  // 11.5 - foundation tiles alt
              12,    // Building construction tiles
              12.5,  // Building construction tiles alt
              13,    // Dock/water construction tiles
              15,    // Building construction tiles
              17     // Building construction tiles
            ];
            var isFoundationConstructionTile = z === 0 && foundationConstructionTiles.indexOf(tile) !== -1;
            
            if(z === 0){
              // Overworld - check for transition tiles
              isWaterTile = (tile === TERRAIN.WATER); // 0
              isCaveEntranceTile = (tile === TERRAIN.CAVE_ENTRANCE); // 6
              isBuildingDoorTile = (tile === TERRAIN.DOOR_OPEN || tile === TERRAIN.DOOR_OPEN_ALT); // 14 or 16
              isTransitionTile = isWaterTile || isCaveEntranceTile || isBuildingDoorTile;
            }
            
            // Check if tile is walkable based on z-level
            var isWalkableTile = false;
            if(z === 0){
              // Overworld - check specific tile types
              if(player.shipType){
                // On ship - only water tiles are walkable
                isWalkableTile = tile === TERRAIN.WATER;
              } else if(player.z === -3){
                // Player is underwater - can path to land tiles (non-water tiles)
                // Land tiles are walkable, not transition tiles, so they can always be reached
                isWalkableTile = tile !== TERRAIN.WATER;
              } else {
                // On foot (on land) - allow water tiles if clicked (for underwater), transition tiles if clicked, or normal walkable tiles
                if(isTransitionTile){
                  // Player clicked on a transition tile - allow it
                  isWalkableTile = true;
                } else {
                  // Check if this is a foundation/construction tile that should be walkable for building
                  var isFoundationTile = isFoundationConstructionTile;
                  
                  if(isFoundationTile){
                    // Foundation/construction tiles should be walkable so players can path onto them to build
                    isWalkableTile = true;
                  } else {
                    // Normal tile - allow clicking on any tile as destination
                    // Let the pathfinding system determine if a path is possible
                    // The pathfinding matrices already handle walkability correctly
                    isWalkableTile = true;
                  }
                }
              }
            } else if(z === -1 || z === -2){
              // Caves - use isWalkable function to check pathfinding matrix (same as buildings)
              isWalkableTile = isWalkable(z, tileX, tileY);
            } else if(z === 1 || z === 2){
              // Inside buildings - skip manual walkability check and let pathfinding handle it
              // The tilemap system's pathfinding will determine if the tile is reachable
              // This ensures consistency with the actual pathfinding used
              isWalkableTile = true;
            } else if(z === -3){
              // Underwater - all tiles are walkable
              isWalkableTile = true;
            }
            
            
            if(isWalkableTile){
              // Clear z-transition halt flag - player is explicitly requesting new navigation
              player.zTransitionHalt = false;
              
              // Clear attack-move command (navigation overrides it)
              player.attackMoveTarget = null;
              
              // Clear work target when navigating (interrupts auto-work)
              if(player.workTargetTile){
                player.workTargetTile = null;
              }
              
              // Pause auto-attacking but keep combat status
              // Combat itself will only end when enemy dies or escapes (handled by SimpleCombat)
              player.autoAttackPaused = true;
              
              // Navigate to the tile using pathfinding
              // Always use direct pathfinding for players to ensure full path is returned
              var startLoc = getLoc(player.x, player.y);
              
              // Determine the correct layer for pathfinding based on z-level
              var layer = 0;
              var options = {};
              
              // GHOST MODE: Allow ghosts to pathfind through water tiles
              if(player.ghost){
                options.ghost = true;
                // If ghost is on water, allow the start tile
                var isOnWater = getLocTile(0, player.x, player.y) == 0;
                if(isOnWater){
                  options.allowStartTile = startLoc;
                }
              }
              
              if(z === 0){
                layer = 0; // Overworld
                
                // Check if player clicked on a transition tile
                if(isTransitionTile){
                  // Player clicked on a transition tile - allow it explicitly
                  if(isBuildingDoorTile){
                    // Allow this specific door
                    options.allowSpecificDoor = true;
                    options.targetDoor = [tileX, tileY];
                  } else if(isCaveEntranceTile){
                    // Allow this specific cave entrance
                    options.targetCaveEntrance = [tileX, tileY];
                  } else if(isWaterTile){
                    // Water tile clicked - explicitly allow this water tile as target
                    options.targetWaterTile = [tileX, tileY];
                  }
                } else if(isFoundationConstructionTile){
                  // Player clicked on a foundation/construction tile - allow it explicitly as target
                  // This allows pathfinding to reach foundation tiles even if they're not marked as walkable in the matrix
                  options.allowSpecificDoor = true;
                  options.targetDoor = [tileX, tileY];
                  // Also avoid doors/caves/water since we're specifically targeting construction tiles
                  // EXCEPT for ghosts - ghosts can walk through water
                  if(!player.ghost){
                    options.avoidDoors = true;
                    options.avoidCaveEntrances = true;
                    options.avoidWater = true;
                  }
                  options.avoidCaveExits = false;
                } else {
                  // Player did NOT click on a transition tile - avoid transition tiles in pathfinding
                  // EXCEPT for ghosts - ghosts can walk through water to reach land
                  options.avoidDoors = true; // Ignore building entrances
                  options.avoidCaveEntrances = true; // Ignore cave entrances
                  if(!player.ghost){
                    options.avoidWater = true; // Ignore water tiles (non-ghosts only)
                  }
                  options.avoidCaveExits = false; // Cave exits only matter in caves, not overworld
                }
              } else if(z === -1){
                layer = 1; // Cave (underworld)
                
                // Check if target is a cave exit
                var isTargetCaveExit = false;
                var isStartCaveExit = false;
                
                if(global.caveEntrances){
                  for(var i in global.caveEntrances){
                    var ce = global.caveEntrances[i];
                    if(ce[0] === tileX && ce[1] + 1 === tileY){
                      isTargetCaveExit = true;
                    }
                    if(ce[0] === startLoc[0] && ce[1] + 1 === startLoc[1]){
                      isStartCaveExit = true;
                    }
                  }
                }
                
                if(isTargetCaveExit){
                  // Player clicked on cave exit - allow it
                  options.allowSpecificDoor = true;
                  options.targetDoor = [tileX, tileY];
                } else {
                  // Player did NOT click on cave exit - ignore cave exits in pathfinding
                  options.avoidCaveExits = true;
                }
                
                if(isStartCaveExit){
                  options.allowStartTile = startLoc;
                }
              } else if(z === -2){
                layer = 8; // Cellar
              } else if(z === -3){
                layer = 2; // Underwater
                // Underwater pathfinding - no need to avoid water (player is already underwater)
                // Land tiles are walkable, not transition tiles, so they can be reached
              } else if(z === 1){
                layer = 3; // Building floor 1
              } else if(z === 2){
                layer = 5; // Building floor 2
              }
              
              var path = global.tilemapSystem.findPath(startLoc, [tileX, tileY], layer, options);
              
              if(path && path.length > 0){
                // Apply smoothing for non-cave paths
                if(z !== -1 && typeof smoothPath === 'function'){
                  path = smoothPath(path, z);
                }
                
                // Skip the first waypoint if it's the starting tile (pathfinding often includes start)
                var firstWaypoint = path[0];
                if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
                  player.pathCount = 1; // Start at second waypoint
                } else {
                  player.pathCount = 0;
                }
                player.path = path;
              } else {
                player.path = null;
                player.pathCount = 0;
              }
              } else {
              }
          }
        } else if (data.msg === 'workAtTile') {
          // Work command - F key + right-click on workable tile
          if(player && data.tileX !== undefined && data.tileY !== undefined && data.z !== undefined){
            var tileX = data.tileX;
            var tileY = data.tileY;
            var z = data.z;
            
            // For indoor navigation (z=1 or z=2), ensure player's current z-level matches
            if((z === 1 || z === 2) && player.z !== z){
              z = player.z;
            }
            
            // Get the tile type at the clicked location
            // Map z-level to correct data layer: z=-3 (underwater) uses layer 0 (overworld) for tile data
            var tileLayer = z === 0 ? 0 : (z === -1 ? 1 : (z === -2 ? 8 : (z === -3 ? 0 : (z === 1 ? 3 : 5))));
            var tile = getTile(tileLayer, tileX, tileY);
            
            // Check if tile is workable
            var isWorkable = false;
            var workType = null;
            
            if(z === 0){
              // Overworld workable tiles
              if(tile === TERRAIN.WATER){
                // Water tile - fishing (special handling)
                isWorkable = true;
                workType = 'fishing';
              } else if(tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.BRUSH){
                // Heavy forest or light forest - chopping
                isWorkable = true;
                workType = 'chopping';
              } else if(tile >= TERRAIN.BRUSH && tile < TERRAIN.ROCKS){
                // Brush - clearing
                isWorkable = true;
                workType = 'clearing';
              } else if(tile >= TERRAIN.ROCKS && tile < TERRAIN.MOUNTAIN){
                // Rocks - mining
                isWorkable = true;
                workType = 'mining';
              } else if(tile >= TERRAIN.MOUNTAIN && tile < TERRAIN.CAVE_ENTRANCE){
                // Mountain - mining
                isWorkable = true;
                workType = 'mining';
              } else if(tile === TERRAIN.BUILD_MARKER || tile === TERRAIN.BUILD_MARKER_ALT || 
                        tile === 12 || tile === 12.5 || tile === 13 || tile === 15 || tile === 17){
                // Foundation/construction tiles - building
                isWorkable = true;
                workType = 'building';
              } else if(tile >= TERRAIN.FARM_SEED && tile <= TERRAIN.FARM_READY){
                // Farm tiles - farming
                isWorkable = true;
                workType = 'farming';
              }
            }
            
            if(isWorkable && workType){
              // Check if player is already at the target tile
              var playerLoc = getLoc(player.x, player.y);
              var atTarget = (playerLoc[0] === tileX && playerLoc[1] === tileY && player.z === z);
              
              if(workType === 'fishing'){
                // For fishing, find closest reachable land tile adjacent to water tile
                var adjacentTiles = [
                  [tileX - 1, tileY],     // left
                  [tileX + 1, tileY],     // right
                  [tileX, tileY - 1],     // up
                  [tileX, tileY + 1],     // down
                  [tileX - 1, tileY - 1], // top-left
                  [tileX + 1, tileY - 1], // top-right
                  [tileX - 1, tileY + 1], // bottom-left
                  [tileX + 1, tileY + 1]  // bottom-right
                ];
                
                var closestLandTile = null;
                var closestDistance = Infinity;
                var startLoc = getLoc(player.x, player.y);
                
                // Find closest land tile adjacent to water
                for(var i = 0; i < adjacentTiles.length; i++){
                  var adjTile = adjacentTiles[i];
                  var adjTileType = getTile(0, adjTile[0], adjTile[1]);
                  
                  // Check if this is a land tile (not water, not heavy forest, not mountain)
                  if(adjTileType !== TERRAIN.WATER && 
                     adjTileType < TERRAIN.HEAVY_FOREST && 
                     adjTileType !== TERRAIN.MOUNTAIN){
                    
                    // Try to pathfind to this tile
                    var options = {
                      avoidDoors: true,
                      avoidCaveExits: false
                    };
                    var testPath = global.tilemapSystem.findPath(startLoc, adjTile, 0, options);
                    
                    if(testPath && testPath.length > 0){
                      var dist = Math.abs(adjTile[0] - startLoc[0]) + Math.abs(adjTile[1] - startLoc[1]);
                      if(dist < closestDistance){
                        closestDistance = dist;
                        closestLandTile = adjTile;
                      }
                    }
                  }
                }
                
                if(closestLandTile){
                  // Pathfind to closest land tile
                  var options = {
                    avoidDoors: true,
                    avoidCaveEntrances: true,
                    avoidWater: true,
                    avoidCaveExits: false
                  };
                  var path = global.tilemapSystem.findPath(startLoc, closestLandTile, 0, options);
                  if(path && path.length > 0){
                    if(typeof smoothPath === 'function'){
                      path = smoothPath(path, z);
                    }
                    var firstWaypoint = path[0];
                    if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
                      player.pathCount = 1;
                    } else {
                      player.pathCount = 0;
                    }
                    player.path = path;
                    
                    // Store work target (water tile for fishing)
                    player.workTargetTile = {
                      tileX: tileX,
                      tileY: tileY,
                      z: z,
                      workType: workType,
                      fishingWaterTile: {x: tileX, y: tileY} // Store water tile for fishing
                    };
                  }
                }
              } else {
                  // For other work types, pathfind directly to tile
                  if(!atTarget){
                    var startLoc = getLoc(player.x, player.y);
                    var layer = z === 0 ? 0 : (z === -1 ? 1 : (z === -2 ? 8 : (z === 1 ? 3 : (z === 2 ? 5 : (z === -3 ? 2 : 0)))));
                    var options = {
                      avoidDoors: true,
                      avoidCaveEntrances: true,
                      avoidWater: true,
                      avoidCaveExits: false
                    };
                    
                    // Allow foundation/construction tiles as targets
                    if(workType === 'building'){
                      options.allowSpecificDoor = true;
                      options.targetDoor = [tileX, tileY];
                    }
                    
                    var path = global.tilemapSystem.findPath(startLoc, [tileX, tileY], layer, options);
                  if(path && path.length > 0){
                    if(z !== -1 && typeof smoothPath === 'function'){
                      path = smoothPath(path, z);
                    }
                    var firstWaypoint = path[0];
                    if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
                      player.pathCount = 1;
                    } else {
                      player.pathCount = 0;
                    }
                    player.path = path;
                  }
                }
                
                // Store work target
                player.workTargetTile = {
                  tileX: tileX,
                  tileY: tileY,
                  z: z,
                  workType: workType
                };
                
                // If already at tile, start work immediately
                if(atTarget){
                  player.handleWorkAction();
                }
              }
            }
          }
        } else if (data.msg === 'selectTarget') {
          // Left-click target selection
          if(player && data.targetId){
            player.target = data.targetId;
          }
        } else if (data.msg === 'engageCombat') {
          // Right-click combat engagement or A+left-click on enemy
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:7319',message:'engageCombat message received',data:{playerId:player ? player.id : null,hasPlayer:!!player,targetId:data.targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
          // #endregion
          if(player && data.targetId){
            // Check both Player.list and Character.list (NPCs might be in either)
            var target = Player.list[data.targetId];
            if(!target && Character && Character.list && Character.list[data.targetId]){
              target = Character.list[data.targetId];
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:7323',message:'Looking up target in Player.list and Character.list',data:{targetId:data.targetId,foundInPlayerList:!!Player.list[data.targetId],foundInCharacterList:!!(Character && Character.list && Character.list[data.targetId]),targetFound:!!target,hasSimpleCombat:!!global.simpleCombat},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            // #endregion
            if(target){
              // Clear previous commands (combat overrides everything)
              player.attackMoveTarget = null;
              
              // Re-enable auto-attacking (player explicitly commanded attack)
              player.autoAttackPaused = false;
              
              // Set attack intent using simpleCombat system (pathfinds to target, combat starts when in range)
              if (global.simpleCombat) {
                if (global.debugCombat) {
                  console.log(`[engageCombat] Player setting attack intent ${player.id} -> ${data.targetId}`);
                }
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:7335',message:'Calling setAttackIntent',data:{playerId:player.id,targetId:data.targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
                const result = global.simpleCombat.setAttackIntent(player, data.targetId);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:7337',message:'setAttackIntent returned',data:{playerId:player.id,targetId:data.targetId,result:result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
              } else {
                // Fallback for systems without simpleCombat
                player.combat.target = data.targetId;
                player.action = 'combat';
                player._lastCombatAttack = 0; // Reset attack timer
              }
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/034ac346-9df5-4826-808c-9170d31a6b3f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lambic.js:7342',message:'Target not found in Player.list',data:{targetId:data.targetId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
              // #endregion
            }
          }
        } else if (data.msg === 'interact') {
          // Right-click building interaction
          if(player && data.buildingId){
            var building = Building.list[data.buildingId];
            if(building){
              // Use existing Interact function
              // Use building's location instead of player's location
              var loc = getLoc(building.x, building.y);
              Interact(socket.id, loc);
            }
          }
        } else if (data.msg === 'interactWithPath') {
          // Right-click interactable with pathfinding to adjacent tile
          if(player && data.entityType && data.entityId !== undefined){
            var entity = null;
            var isInteractable = false;
            
            // Get entity and verify it's interactable
            if(data.entityType === 'building'){
              entity = Building.list[data.entityId];
              if(entity){
                isInteractable = isInteractableBuilding(entity);
              }
            } else if(data.entityType === 'item'){
              entity = Item.list[data.entityId];
              if(entity){
                isInteractable = isInteractableObject(entity);
              }
            } else if(data.entityType === 'ship'){
              entity = Player.list[data.entityId];
              if(entity && entity.shipType){
                // Always allow ship interaction - validation happens before boardPassenger call
                // This allows pathfinding to work even if ownership check would fail
                isInteractable = true;
              }
            }
            
            if(entity && isInteractable){
              var playerLoc = getLoc(player.x, player.y);
              
              // Check if player is already adjacent to the entity
              if(isPlayerAdjacentToEntity(entity, data.entityType, playerLoc)){
                // Player is already adjacent - trigger interaction directly
                var interactionLoc = null;
                if(data.entityType === 'building'){
                  // For buildings, use the interactable tile location
                  // For docks: use plot[4] (the non-walkable tile)
                  // For mills/lumbermills/mines: use any plot tile (all are interactable)
                  if(entity.plot && Array.isArray(entity.plot)){
                    if(entity.type === 'dock' && entity.plot[4]){
                      // Dock: use plot[4] (the non-walkable interactable tile)
                      interactionLoc = entity.plot[4];
                    } else if(entity.plot.length > 0){
                      // Other buildings: use first plot tile (all are interactable)
                      interactionLoc = entity.plot[0];
                    }
                  }
                  // Fallback to building center if plot not available
                  if(!interactionLoc){
                    interactionLoc = getLoc(entity.x, entity.y);
                  }
                } else if(data.entityType === 'item'){
                  // Use item's location
                  interactionLoc = getLoc(entity.x, entity.y);
                } else if(data.entityType === 'ship'){
                  // For ships, validate ownership/dock status before boarding
                  // Cargo ships are always boardable (public transport)
                  if(entity.shipType !== 'cargoship'){
                    var isAtDock = entity.mode === 'docked';
                    if(isAtDock && (!entity.owner || entity.owner !== socket.id)){
                      // Ship is at dock and player doesn't own it - reject
                      socket.write(JSON.stringify({
                        msg: 'addToChat',
                        message: '<i>This is not your ship.</i>'
                      }));
                      return; // Don't board
                    }
                    // If not at dock, allow boarding (ship is abandoned/available)
                  }
                  
                  // Board the ship
                  if(typeof entity.boardPassenger === 'function'){
                    entity.boardPassenger(socket.id);
                  }
                  return; // Ship boarding handled, no need for Interact
                }
                
                // Fallback to player's current location if we couldn't get entity location
                if(!interactionLoc){
                  interactionLoc = playerLoc;
                }
                
                // Set player facing to face the target before interacting
                if(interactionLoc && (data.entityType === 'building' || data.entityType === 'item')){
                  player.facing = calculateFacingDirection(playerLoc, interactionLoc);
                }
                
                // Trigger interaction immediately
                Interact(socket.id, interactionLoc);
              } else {
                // Player is not adjacent - find closest adjacent walkable tile and pathfind
                var adjacentTile = findClosestAdjacentWalkableTile(entity, data.entityType, player.z, playerLoc);
                
                if(adjacentTile){
                  // Store interaction target for when player reaches destination
                  player.pendingInteraction = {
                    type: data.entityType,
                    id: data.entityId,
                    z: player.z
                  };
                  
                  // Pathfind to adjacent tile
                  var tileX = adjacentTile[0];
                  var tileY = adjacentTile[1];
                  var z = player.z;
                  
                  // Determine the correct layer for pathfinding based on z-level
                  var layer = 0;
                  var options = {};
                  
                  if(z === 0){
                    layer = 0; // Overworld
                    options.avoidDoors = true;
                    options.avoidCaveExits = false;
                  } else if(z === -1){
                    layer = 1; // Cave (underworld)
                    options.avoidCaveExits = true;
                  } else if(z === -2){
                    layer = -2; // Cellar
                  } else if(z === 1){
                    layer = 3; // Building floor 1
                  } else if(z === 2){
                    layer = 5; // Building floor 2
                  }
                  
                  var path = global.tilemapSystem.findPath(playerLoc, [tileX, tileY], layer, options);
                  
                  if(path && path.length > 0){
                    // Apply smoothing for non-cave paths
                    if(z !== -1 && typeof smoothPath === 'function'){
                      path = smoothPath(path, z);
                    }
                    
                    // Skip the first waypoint if it's the starting tile
                    var firstWaypoint = path[0];
                    if(firstWaypoint && firstWaypoint[0] === playerLoc[0] && firstWaypoint[1] === playerLoc[1]){
                      player.pathCount = 1; // Start at second waypoint
                    } else {
                      player.pathCount = 0;
                    }
                    player.path = path;
                  } else {
                    // No path found - clear pending interaction
                    player.pendingInteraction = null;
                  }
                } else {
                  // No adjacent walkable tile found - clear pending interaction
                  player.pendingInteraction = null;
                }
              }
            }
          }
        } else if (data.msg === 'attackMove') {
          // A+left-click on terrain - attack-move command
          if(player && data.tileX !== undefined && data.tileY !== undefined && data.z !== undefined){
            // DISABLE attack-move if player is aboard a ship (navigator or passenger)
            if(player.boardedShip){
              // Clear any existing path to prevent queued pathfinding from executing after disembark
              player.path = null;
              player.pathCount = 0;
              player.attackMoveTarget = null;
              return; // Ignore attack-move while aboard ship
            }
            
            // Clear z-transition halt flag - player is explicitly requesting new navigation
            player.zTransitionHalt = false;
            
            // Re-enable auto-attacking (player explicitly used attack command)
            player.autoAttackPaused = false;
            
            // Set attack-move flag and destination
            player.attackMoveTarget = {z: data.z, col: data.tileX, row: data.tileY};
            
            // Use the same pathfinding logic as clickNavigate
            var tileX = data.tileX;
            var tileY = data.tileY;
            var z = data.z;
            
            // For indoor navigation, ensure player's current z-level matches
            if((z === 1 || z === 2) && player.z !== z){
              z = player.z;
            }
            
            // Determine the correct layer for pathfinding based on z-level
            var layer = 0;
            var options = {};
            
            if(z === 0){
              layer = 0; // Overworld
              options.avoidDoors = true;
              options.avoidCaveExits = false;
            } else if(z === -1){
              layer = 1; // Cave (underworld)
              options.avoidCaveExits = true;
            } else if(z === -2){
              layer = -2; // Cellar
            } else if(z === 1){
              layer = 3; // Building floor 1
            } else if(z === 2){
              layer = 5; // Building floor 2
            }
            
            var startLoc = getLoc(player.x, player.y);
            var path = global.tilemapSystem.findPath(startLoc, [tileX, tileY], layer, options);
            
            if(path && path.length > 0){
              // Apply smoothing for non-cave paths
              if(z !== -1 && typeof smoothPath === 'function'){
                path = smoothPath(path, z);
              }
              
              // Skip the first waypoint if it's the starting tile
              var firstWaypoint = path[0];
              if(firstWaypoint && firstWaypoint[0] === startLoc[0] && firstWaypoint[1] === startLoc[1]){
                player.pathCount = 1; // Start at second waypoint
              } else {
                player.pathCount = 0;
              }
              player.path = path;
            } else {
              player.path = null;
              player.pathCount = 0;
            }
          }
        } else if (data.msg === 'getResourceScoreboard') {
          // Send faction resource data to client
          const resources = calculateFactionResources();
          // Debug: Log first faction's data
          const firstFaction = Object.values(resources)[0];
          if(firstFaction){
          }
          socket.write(JSON.stringify({
            msg: 'resourceScoreboard',
            data: resources
          }));
        } else if (data.msg === 'msgToServer') {
          if(player && player.ghost){
            socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Ghosts cannot speak</i>` }));
          } else {
            // Help command for NPC chat
            if (data.message === '/npcs') {
              const nearbyNPCs = [];
              for (const id in Player.list) {
                const npc = Player.list[id];
                if (npc.type !== 'npc') continue;
                if (npc.z !== player.z) continue;
                
                const distance = Math.sqrt(
                  Math.pow(npc.x - player.x, 2) + 
                  Math.pow(npc.y - player.y, 2)
                );
                
                if (distance <= 768) { // Within 12 tiles
                  nearbyNPCs.push({ 
                    name: npc.name || npc.class, 
                    class: npc.class,
                    distance: Math.floor(distance / 64) 
                  });
                }
              }
              
              if (nearbyNPCs.length > 0) {
                nearbyNPCs.sort((a, b) => a.distance - b.distance);
                const npcList = nearbyNPCs.slice(0, 5).map(n => 
                  `${n.class} (${n.distance} tiles)`
                ).join(', ');
                socket.write(JSON.stringify({ 
                  msg: 'addToChat', 
                  message: `<b>NPCs nearby:</b> ${npcList}<br><i>NPCs will respond to your chat if they're close enough!</i>` 
                }));
              } else {
                socket.write(JSON.stringify({ 
                  msg: 'addToChat', 
                  message: `<i>No NPCs nearby. NPCs will hear and respond to your messages when you're close to them.</i>` 
                }));
              }
              return;
            }
            
            // NPCs listen to all nearby chat and may respond
            if (global.socialSystem && data.message && !data.message.startsWith('/')) {
              // Check if player is already in a conversation
              if (global.socialSystem.isInConversation(player.id)) {
                // Continue conversation with current NPC
                const session = global.socialSystem.getConversationSession(player.id);
                if (session) {
                  const otherParticipantId = session.participants.find(id => id !== player.id);
                  if (otherParticipantId && Player.list[otherParticipantId]) {
                    // Determine the display name
                    var displayName = data.name;
                    if(player && player.type === 'ship' && player.controller){
                      if(player.passengers && player.passengers.length > 0){
                        var navigator = player.passengers.find(function(p){ return p.isNavigator; });
                        if(navigator && navigator.storedData){
                          displayName = navigator.storedData.originalName;
                        }
                      }
                    }
                    
                    // Create event in EventManager (handles console logging and broadcasting to nearby players)
                    if (global.eventManager) {
                      global.eventManager.createEvent({
                        category: global.eventManager.categories.SOCIAL,
                        subject: player.id,
                        subjectName: displayName,
                        action: 'said',
                        message: `<b>${displayName}:</b> ${data.message}`,
                        communication: global.eventManager.commModes.AREA,
                        log: `[SOCIAL] ${displayName} said: "${data.message}" at [${Math.floor(player.x)},${Math.floor(player.y)}] z=${player.z}`,
                        position: { x: player.x, y: player.y, z: player.z }
                      });
                    }
                    
                    // Direct message to conversation partner
                    setTimeout(() => {
                      if (Player.list[otherParticipantId]) {
                        global.socialSystem.handlePlayerToNPC(player.id, otherParticipantId, data.message);
                      }
                    }, 500 + Math.random() * 1500);
                  }
                }
                // Skip normal global broadcast for conversation messages (EventManager handles area broadcast)
                return;
              } else {
                // Check if player mentioned a specific NPC name in their message
                let targetedNPC = null;
                
                for (const id in Player.list) {
                  const npc = Player.list[id];
                  if (npc.type !== 'npc') continue;
                  if (npc.z !== player.z) continue;
                  if (!global.socialSystem.isHumanoidNPC(npc)) continue;
                  if (global.socialSystem.isInConversation(npc.id)) continue;
                  
                  // Check if NPC has a name and it's mentioned in the message
                  if (npc.name) {
                    const namePattern = new RegExp('\\b' + npc.name + '\\b', 'i');
                    if (namePattern.test(data.message)) {
                      // Check proximity
                      const distance = Math.sqrt(
                        Math.pow(npc.x - player.x, 2) + 
                        Math.pow(npc.y - player.y, 2)
                      );
                      
                      if (distance <= 128) {
                        targetedNPC = npc;
                        break; // Found targeted NPC
                      }
                    }
                  }
                }
                
                if (targetedNPC) {
                  // Player specifically targeted an NPC by name
                  setTimeout(() => {
                    if (Player.list[targetedNPC.id]) {
                      global.socialSystem.handlePlayerToNPC(player.id, targetedNPC.id, data.message);
                    }
                  }, 500 + Math.random() * 1500);
                } else {
                  // No specific target - find nearby NPCs that might respond
                  const nearbyNPCs = [];
                  const nearbyBusyNPCs = [];
                  
                  for (const id in Player.list) {
                    const npc = Player.list[id];
                    if (npc.type !== 'npc') continue;
                    if (npc.z !== player.z) continue;
                    if (!global.socialSystem.isHumanoidNPC(npc)) continue;
                    if (global.socialSystem.isInConversation(npc.id)) continue;
                    
                    const distance = Math.sqrt(
                      Math.pow(npc.x - player.x, 2) + 
                      Math.pow(npc.y - player.y, 2)
                    );
                    
                    // NPCs within 2 tiles can hear
                    if (distance <= 128) {
                      // Check if NPC is busy
                      const isBusy = npc.working || npc.chopping || npc.mining || 
                                     npc.farming || npc.building || npc.fishing ||
                                     npc.action === 'combat' || npc.action === 'flee';
                      
                      if (isBusy) {
                        nearbyBusyNPCs.push({ npc, distance });
                      } else {
                        nearbyNPCs.push({ npc, distance });
                      }
                    }
                  }
                  
                  // Prioritize idle NPCs for full conversations
                  let respondingNPC = null;
                  
                  if (nearbyNPCs.length > 0 && Math.random() < 0.8) {
                    // Idle NPC available for full conversation
                    nearbyNPCs.sort((a, b) => a.distance - b.distance);
                    respondingNPC = nearbyNPCs[0].npc;
                  } else if (nearbyBusyNPCs.length > 0 && Math.random() < 0.3) {
                    // Only busy NPCs nearby - might give brief response (30% chance)
                    nearbyBusyNPCs.sort((a, b) => a.distance - b.distance);
                    respondingNPC = nearbyBusyNPCs[0].npc;
                  }
                  
                  if (respondingNPC) {
                    // Let the NPC respond after a short delay (feels more natural)
                    setTimeout(() => {
                      if (Player.list[respondingNPC.id]) {
                        global.socialSystem.handlePlayerToNPC(player.id, respondingNPC.id, data.message);
                      }
                    }, 500 + Math.random() * 1500);
                  }
                }
              }
            }
            
            // Normal broadcast message
            // Determine the display name - if player is ship with navigator, use navigator's name
            var displayName = data.name;
            if(player && player.type === 'ship' && player.controller){
              // Check if there's a navigator (first passenger)
              if(player.passengers && player.passengers.length > 0){
                var navigator = player.passengers.find(function(p){ return p.isNavigator; });
                if(navigator && navigator.storedData){
                  displayName = navigator.storedData.originalName;
                }
              }
            }
            emit({ msg: 'addToChat', message: `<b>${displayName}:</b> ${data.message}` });
          }
        } else if (data.msg === 'pmToServer') {
          if(player && player.ghost){
            socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Ghosts cannot speak</i>` }));
          } else {
            let recipient = null;

            for (const i in Player.list) {
              if (Player.list[i].name === data.recip) {
                recipient = SOCKET_LIST[i];
                break;
              }
            }

            if (!recipient) {
              socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${data.recip} is not online.</i>` }));
            } else {
              // Determine the display name - if player is ship with navigator, use navigator's name
              var senderName = player.name;
              if(player && player.type === 'ship' && player.controller){
                if(player.passengers && player.passengers.length > 0){
                  var navigator = player.passengers.find(function(p){ return p.isNavigator; });
                  if(navigator && navigator.storedData){
                    senderName = navigator.storedData.originalName;
                  }
                }
              }
              recipient.write(JSON.stringify({ msg: 'addToChat', message: `<b>@${senderName}</b> whispers: <i>${data.message}</i>` }));
              socket.write(JSON.stringify({ msg: 'addToChat', message: `To ${data.recip}: <i>${data.message}</i>` }));
            }
          }
        } else if (data.msg === 'requestBuildMenu') {
          if (player && player.type === 'player') {
            // Get BuildingPreview instance
            const buildingPreview = global.buildingPreview;
            if (!buildingPreview) {
              console.error('[BUILD MENU] BuildingPreview not available');
              return;
            }

            // Get all available buildings from BuildingPreview
            const allBuildingTypes = buildingPreview.getAvailableBuildings();
            
            // Define tier mapping based on prerequisites
            // Tier I: Buildings available from start
            const tier1Buildings = ['farm', 'mill', 'lumbermill', 'mine', 'hut', 'cottage', 'tavern', 'tower', 'forge', 'fort', 'outpost', 'monastery'];
            
            // Tier II: Requires specific Tier I buildings
            const tier2Requirements = {
              'dock': 'tavern',
              'stable': 'tavern',
              'market': 'tavern',
              'garrison': 'forge'
            };
            
            // Tier III: Requires Garrison
            const tier3Buildings = ['stronghold', 'wall', 'gate', 'guardtower'];
            
            // Check player's built buildings for prerequisites
            const playerBuildings = {};
            for (const id in Building.list) {
              const building = Building.list[id];
              if (building.owner === player.id && building.built) {
                playerBuildings[building.type] = true;
              }
            }
            
            // Helper function to determine tier for a building
            const getBuildingTier = (buildingType) => {
              if (tier1Buildings.includes(buildingType)) {
                return 1;
              }
              if (tier2Requirements[buildingType]) {
                return 2;
              }
              if (tier3Buildings.includes(buildingType)) {
                return 3;
              }
              // Default to Tier I if not found in mappings
              console.warn(`[BUILD MENU] Building ${buildingType} not found in tier mapping, defaulting to Tier I`);
              return 1;
            };
            
            // Helper function to check if building is unlocked
            const isBuildingUnlocked = (buildingType, tier) => {
              if (tier === 1) {
                return true; // All Tier I buildings are always available
              }
              if (tier === 2 && tier2Requirements[buildingType]) {
                const required = tier2Requirements[buildingType];
                return playerBuildings[required] === true;
              }
              if (tier === 3) {
                return playerBuildings['garrison'] === true;
              }
              return false;
            };
            
            // Build building data array dynamically from BuildingPreview
            const buildingsData = [];
            
            for (const buildingType of allBuildingTypes) {
              const buildingDef = buildingPreview.getBuildingDefinition(buildingType);
              if (!buildingDef) {
                console.warn(`[BUILD MENU] Building definition not found for: ${buildingType}`);
                continue;
              }
              
              const tier = getBuildingTier(buildingType);
              const unlocked = isBuildingUnlocked(buildingType, tier);
              
              // Extract costs from materials property
              const wood = buildingDef.materials?.wood || 0;
              const stone = buildingDef.materials?.stone || 0;
              
              buildingsData.push({
                type: buildingType,
                name: buildingDef.name,
                wood: wood,
                stone: stone,
                tier: tier,
                unlocked: unlocked
              });
            }
            
            // Only include unlocked buildings
            const availableBuildings = buildingsData.filter(b => b.unlocked);
            
            // Get player resources from BOTH inventory and stores (inventory is checked first when building)
            const playerWood = (player.inventory.wood || 0) + (player.stores.wood || 0);
            const playerStone = (player.inventory.stone || 0) + (player.stores.stone || 0);
            
            // Send response
            socket.write(JSON.stringify({
              msg: 'buildMenuData',
              buildings: availableBuildings,
              playerWood: playerWood,
              playerStone: playerStone
            }));
          }
        } else if (data.msg === 'startBuildPreview') {
          if (player && player.type === 'player' && data.buildingType) {
            const loc = getLoc(player.x, player.y);
            const z = player.z;
            const c = loc[0];
            const r = loc[1];
            
            // Use BuildingPreview if available (players use strict terrain rules)
            if (global.buildingPreview) {
              const facing = player.facing || 'right';
              const validation = global.buildingPreview.validateBuildingPlacement(data.buildingType, c, r, z, facing, true); // isPlayer = true
              
              socket.write(JSON.stringify({
                msg: 'buildPreviewData',
                buildingType: data.buildingType,
                valid: validation.tiles || [],
                clearable: validation.clearableTiles || [],
                blocked: validation.blockedTiles || []
              }));
            }
          }
        } else if (data.msg === 'requestBuildValidation') {
          if (player && player.type === 'player' && data.buildingType && data.tileX !== undefined && data.tileY !== undefined) {
            const z = player.z;
            
            if (global.buildingPreview) {
              // Players use strict terrain rules
              const facing = player.facing || 'right';
              const validation = global.buildingPreview.validateBuildingPlacement(data.buildingType, data.tileX, data.tileY, z, facing, true); // isPlayer = true
              
              // Build plot array with tile statuses
              const plot = [];
              
              // Add valid tiles
              if (validation.tiles) {
                for (const tile of validation.tiles) {
                  plot.push({ x: tile.x, y: tile.y, status: 'valid' });
                }
              }
              
              // Add blocked tiles
              if (validation.blockedTiles) {
                for (const tile of validation.blockedTiles) {
                  plot.push({ x: tile.x, y: tile.y, status: 'blocked' });
                }
              }
              
              socket.write(JSON.stringify({
                msg: 'buildValidationData',
                buildingType: data.buildingType,
                tileX: data.tileX,
                tileY: data.tileY,
                plot: plot,
                canBuild: validation.canBuild || false
              }));
            }
          }
        } else if (data.msg === 'buildAt') {
          // Build at specific tile coordinates
          if (player && player.type === 'player' && data.buildingType && data.tileX !== undefined && data.tileY !== undefined) {
            // Execute build command at the specified tile coordinates
            const buildCmd = 'build ' + data.buildingType;
            EvalCmd({
              id: socket.id,
              cmd: buildCmd,
              world: world,
              overrideC: data.tileX,
              overrideR: data.tileY
            });
          }
        } else if (data.msg === 'requestWorldMap') {
          if (player) {
            // Check if player has a worldmap item OR is in godmode
            if (player.inventory.worldmap > 0 || player.godMode) {
              // Determine player position - if player is a ship, use ship's position
              let playerX = player.x || gameState.mapSize * gameState.tileSize / 2;
              let playerY = player.y || gameState.mapSize * gameState.tileSize / 2;
              let playerZ = player.z || 0;
              
              // If player is aboard a ship (ship entity has controller), show ship's position
              if(player.type === 'ship' && player.controller){
                // Use ship's current position
                playerX = player.x;
                playerY = player.y;
                playerZ = player.z;
              }
              
              // Send the terrain data (layer 0 is the overworld terrain)
              socket.write(JSON.stringify({
                msg: 'worldMapData',
                terrain: world[0],
                mapSize: gameState.mapSize,
                playerX: playerX,
                playerY: playerY,
                playerZ: playerZ,
                tileSize: gameState.tileSize,
                features: global.mapAnalyzer ? global.mapAnalyzer.geographicFeatures : []
              }));
            } else {
              // Player doesn't have a worldmap
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<span style="color:#ff6666;">You need a WorldMap item to use this feature.</span>'
              }));
            }
          }
        } else if (data.msg === 'requestCaveMap') {
          if (player) {
            // Check if player has a cavemap item OR is in godmode
            if (player.inventory.cavemap > 0 || player.godMode) {
              // For godmode players, use center of map as position if no valid position
              let playerX = player.x || gameState.mapSize * gameState.tileSize / 2;
              let playerY = player.y || gameState.mapSize * gameState.tileSize / 2;
              let playerZ = player.z || -1;
              
              // Build a map of items at each tile (crates, barrels, chests)
              const blockingItems = {};
              for (const itemId in Item.list) {
                const item = Item.list[itemId];
                if (item.z === -1 && (item.type === 'Crates' || item.type === 'Barrel' || item.type === 'Chest' || item.type === 'LockedChest')) {
                  const tile = getLoc(item.x, item.y);
                  const key = `${tile[0]},${tile[1]}`;
                  if (!blockingItems[key]) {
                    blockingItems[key] = true;
                  }
                }
              }
              
              // Send the terrain data (layer 1 is the cave layer, z=-1)
              socket.write(JSON.stringify({
                msg: 'caveMapData',
                terrain: world[1], // Layer 1 = z=-1 (caves)
                blockingItems: blockingItems,
                mapSize: gameState.mapSize,
                playerX: playerX,
                playerY: playerY,
                playerZ: playerZ,
                tileSize: gameState.tileSize
              }));
            } else {
              // Player doesn't have a cavemap
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<span style="color:#ff6666;">You need a CaveMap item to use this feature.</span>'
              }));
            }
          }
        } else if (data.msg === 'equipItem') {
          if (player && data.itemType) {
            const itemType = data.itemType;
            
            // Check if player has the item
            if (player.inventory[itemType] && player.inventory[itemType] > 0) {
              const item = equip[itemType];
              if (item) {
                // Determine which slot to equip to
                // Get item rarity color
                const { ItemFactory, itemFactory } = require('./server/js/entities/ItemFactory');
                const itemConfig = itemFactory.itemConfigs[itemType];
                const rank = itemConfig ? itemConfig.rank : 0;
                const rarityColor = ItemFactory.getRarityColor(rank);
                
                if (item.type === 'dagger' || item.type === 'sword' || item.type === 'bow' || item.type === 'lance') {
                  // Unequip current weapon if exists (Main Hand)
                  if (player.gear.weapon) {
                    player.gear.weapon.unequip(player.id);
                  }
                  player.gear.weapon = item;
                  player.inventory[itemType]--;
                  // Recalculate player stats after equipping weapon
                  if (typeof recalculatePlayerStats === 'function') {
                    recalculatePlayerStats(player.id);
                  }
                  socket.write(JSON.stringify({
                    msg: 'addToChat',
                    message: `<i>You equipped</i> <b style="color:${rarityColor}">[${item.name}]</b>.`
                  }));
                  // Send gear, inventory, and class update to client
                  socket.write(JSON.stringify({
                    msg: 'gearUpdate',
                    gear: player.gear,
                    inventory: player.inventory,
                    class: player.class
                  }));
                } else if (item.type === 'leather' || item.type === 'chainmail' || item.type === 'plate' || item.type === 'cloth') {
                  // Unequip current armor if exists
                  if (player.gear.armor) {
                    player.gear.armor.unequip(player.id);
                  }
                  player.gear.armor = item;
                  player.inventory[itemType]--;
                  // Recalculate player stats after equipping armor
                  if (typeof recalculatePlayerStats === 'function') {
                    recalculatePlayerStats(player.id);
                  }
                  socket.write(JSON.stringify({
                    msg: 'addToChat',
                    message: `<i>You equipped</i> <b style="color:${rarityColor}">[${item.name}]</b>.`
                  }));
                  // Send gear, inventory, and class update to client
                  socket.write(JSON.stringify({
                    msg: 'gearUpdate',
                    gear: player.gear,
                    inventory: player.inventory,
                    class: player.class
                  }));
                } else if (item.type === 'head') {
                  // Unequip current head if exists
                  if (player.gear.head) {
                    player.gear.head.unequip(player.id);
                  }
                  player.gear.head = item;
                  player.inventory[itemType]--;
                  // Recalculate player stats after equipping head gear
                  if (typeof recalculatePlayerStats === 'function') {
                    recalculatePlayerStats(player.id);
                  }
                  socket.write(JSON.stringify({
                    msg: 'addToChat',
                    message: `<i>You equipped</i> <b style="color:${rarityColor}">[${item.name}]</b>.`
                  }));
                  // Send gear, inventory, and class update to client
                  socket.write(JSON.stringify({
                    msg: 'gearUpdate',
                    gear: player.gear,
                    inventory: player.inventory,
                    class: player.class
                  }));
                }
              } else {
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: '<i>That item cannot be equipped.</i>'
                }));
              }
            } else {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>You do not have that item.</i>'
              }));
            }
          }
        } else if (data.msg === 'unequipItem') {
          if (player && data.slot) {
            const slot = data.slot;
            if (player.gear[slot]) {
              const itemName = player.gear[slot].name;
              const itemType = itemName.toLowerCase().replace(/\s+/g, '');
              
              // Get item rarity color
              const { ItemFactory, itemFactory } = require('./server/js/entities/ItemFactory');
              const itemConfig = itemFactory.itemConfigs[itemType];
              const rank = itemConfig ? itemConfig.rank : 0;
              const rarityColor = ItemFactory.getRarityColor(rank);
              
              player.gear[slot].unequip(player.id);
              player.gear[slot] = null;
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: `<i>You unequipped</i> <b style="color:${rarityColor}">[${itemName}]</b>.`
              }));
              // Send gear, inventory, and class update to client
              socket.write(JSON.stringify({
                msg: 'gearUpdate',
                gear: player.gear,
                inventory: player.inventory,
                class: player.class
              }));
            }
          }
        } else if (data.msg === 'dropItem') {
          if (player && data.itemType && data.quantity) {
            const itemType = data.itemType;
            const quantity = Math.min(parseInt(data.quantity), player.inventory[itemType] || 0);
            
            if (quantity > 0) {
              // Get item info for colored message
              const { ItemFactory, itemFactory } = require('./server/js/entities/ItemFactory');
              const itemConfig = itemFactory.itemConfigs[itemType];
              const rank = itemConfig ? itemConfig.rank : 0;
              const rarityColor = ItemFactory.getRarityColor(rank);
              const itemName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
              
              // Remove from inventory
              player.inventory[itemType] -= quantity;
              
              // Create dropped item in world
              const droppedItem = itemFactory.createItem(itemType, {
                x: player.x,
                y: player.y,
                z: player.z,
                qty: quantity
              });
              
              if (droppedItem) {
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: `<i>You dropped</i> ${quantity} <b style="color:${rarityColor}">[${itemName}]</b>.`
                }));
              }
            }
          }
        } else if (data.msg === 'takeFromChest') {
          // Take item from chest to player inventory
          if (player && data.chestId && data.itemType && data.quantity) {
            const chest = Item.list[data.chestId];
            if (!chest || (chest.type !== 'Chest' && chest.type !== 'LockedChest')) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Chest not found.</i>'
              }));
              return;
            }
            
            // Check if locked chest and player has key
            if (chest.type === 'LockedChest') {
              var hasKey = false;
              if (player.inventory && player.inventory.keyRing) {
                for (var k in player.inventory.keyRing) {
                  var key = player.inventory.keyRing[k];
                  if (key && (key.id === chest.id || key === chest.id)) {
                    hasKey = true;
                    break;
                  }
                }
              }
              if (!hasKey) {
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: '<i>This chest is locked. You need a key to open it.</i>'
                }));
                return;
              }
            }
            
            // Ensure chest has inventory
            if (!chest.inventory) {
              chest.inventory = Inventory();
            }
            
            const itemType = data.itemType;
            
            // Validate quantity is a positive integer
            const requestedQuantity = parseInt(data.quantity);
            if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Invalid quantity.</i>'
              }));
              return;
            }
            
            // Get ACTUAL chest inventory value (not client-provided)
            const chestAmount = chest.inventory[itemType] || 0;
            
            // Validate chest actually has the item
            if (chestAmount <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>The chest does not contain that item.</i>'
              }));
              return;
            }
            
            // Get player stack limit
            const { itemFactory } = require('./server/js/entities/ItemFactory');
            const itemConfig = itemFactory.itemConfigs[itemType];
            const maxStack = itemConfig ? itemConfig.maxStack : 10;
            const playerAmount = player.inventory[itemType] || 0;
            
            // Calculate how much can actually be taken (limited by chest amount and player capacity)
            const availableInChest = chestAmount;
            const playerCapacity = maxStack - playerAmount;
            
            if (playerCapacity <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>You are already carrying too much of that item.</i>'
              }));
              return;
            }
            
            // Determine actual transfer quantity (min of requested, available, and capacity)
            const transferQuantity = Math.min(requestedQuantity, availableInChest, playerCapacity);
            
            if (transferQuantity <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Cannot transfer that quantity.</i>'
              }));
              return;
            }
            
            // Perform atomic transfer
            chest.inventory[itemType] = chestAmount - transferQuantity;
            if (chest.inventory[itemType] <= 0) {
              chest.inventory[itemType] = 0;
            }
            player.inventory[itemType] = playerAmount + transferQuantity;
            
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: `<i>You took ${transferQuantity} ${itemType} from the chest.</i>`
            }));
            
            // Update chest window with new inventory
            socket.write(JSON.stringify({
              msg: 'openChest',
              chestId: chest.id,
              chestType: chest.type,
              inventory: chest.inventory,
              playerInventory: player.inventory
            }));
          }
        } else if (data.msg === 'storeInChest') {
          // Store item from player inventory to chest
          if (player && data.chestId && data.itemType && data.quantity) {
            const chest = Item.list[data.chestId];
            if (!chest || (chest.type !== 'Chest' && chest.type !== 'LockedChest')) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Chest not found.</i>'
              }));
              return;
            }
            
            // Check if locked chest and player has key
            if (chest.type === 'LockedChest') {
              var hasKey = false;
              if (player.inventory && player.inventory.keyRing) {
                for (var k in player.inventory.keyRing) {
                  var key = player.inventory.keyRing[k];
                  if (key && (key.id === chest.id || key === chest.id)) {
                    hasKey = true;
                    break;
                  }
                }
              }
              if (!hasKey) {
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: '<i>This chest is locked. You need a key to open it.</i>'
                }));
                return;
              }
            }
            
            // Ensure chest has inventory
            if (!chest.inventory) {
              chest.inventory = Inventory();
            }
            
            const itemType = data.itemType;
            
            // Validate quantity is a positive integer
            const requestedQuantity = parseInt(data.quantity);
            if (isNaN(requestedQuantity) || requestedQuantity <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Invalid quantity.</i>'
              }));
              return;
            }
            
            // Get ACTUAL player inventory value (not client-provided)
            const playerAmount = player.inventory[itemType] || 0;
            
            // Validate player actually has the item
            if (playerAmount <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>You do not have that item.</i>'
              }));
              return;
            }
            
            // Calculate how much can actually be stored (limited by player amount)
            const availableFromPlayer = playerAmount;
            const transferQuantity = Math.min(requestedQuantity, availableFromPlayer);
            
            if (transferQuantity <= 0) {
              socket.write(JSON.stringify({
                msg: 'addToChat',
                message: '<i>Cannot transfer that quantity.</i>'
              }));
              return;
            }
            
            // Perform atomic transfer
            const chestAmount = chest.inventory[itemType] || 0;
            chest.inventory[itemType] = chestAmount + transferQuantity;
            player.inventory[itemType] = playerAmount - transferQuantity;
            if (player.inventory[itemType] <= 0) {
              player.inventory[itemType] = 0;
            }
            
            socket.write(JSON.stringify({
              msg: 'addToChat',
              message: `<i>You stored ${transferQuantity} ${itemType} in the chest.</i>`
            }));
            
            // Update chest window with new inventory
            socket.write(JSON.stringify({
              msg: 'openChest',
              chestId: chest.id,
              chestType: chest.type,
              inventory: chest.inventory,
              playerInventory: player.inventory
            }));
          }
        } else if (data.msg === 'depositResources') {
          // Handle resource deposits from deposit UI
          if(!data.buildingId || !data.resources){
            return;
          }
          
          var building = Building.list[data.buildingId];
          if(!building){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Building not found.</i>'}));
            return;
          }
          
          // Validate player is still in range of building
          var buildingDistance = Math.sqrt(Math.pow(player.x - building.x, 2) + Math.pow(player.y - building.y, 2));
          if(buildingDistance > 128){ // ~2 tiles
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>You are too far from the building.</i>'}));
            return;
          }
          
          var inv = player.inventory;
          var isOwner = building.owner === socket.id;
          var totalDeposited = {};
          var conversionResults = {};
          
          // Process each resource type
          for(var resourceType in data.resources){
            var amountToDeposit = parseInt(data.resources[resourceType]);
            if(amountToDeposit <= 0) continue;
            
            // Validate player has this amount
            if(!inv[resourceType] || inv[resourceType] < amountToDeposit){
              socket.write(JSON.stringify({msg:'addToChat', message: '<i>You do not have ' + amountToDeposit + ' ' + resourceType + '.</i>'}));
              continue;
            }
            
            // Calculate deposit ratio (owners get 1:1, non-owners get 2:3 or 3:2 depending on building)
            var deposited = 0;
            if(building.type === 'mill'){
              // Mill converts grain to flour
              var flourProduced = Math.floor(amountToDeposit / 3);
              var grainUsed = flourProduced * 3;
              
              if(grainUsed > 0){
                deposited = Math.floor(grainUsed * 2 / 3); // 3 grain -> 2 deposited
                
                // Verify deposit target exists before decrementing inventory
                var depositTargetExists = false;
                if(Player.list[building.owner]){
                  if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                    depositTargetExists = true;
                  } else if(Player.list[building.owner].stores){
                    depositTargetExists = true;
                  }
                } else if(building.house && House.list[building.house]){
                  depositTargetExists = true;
                }
                
                // Only proceed if deposit target exists
                if(depositTargetExists){
                  inv.grain -= grainUsed;
                  
                  // Add to owner's stores
                  if(Player.list[building.owner]){
                    if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                      House.list[Player.list[building.owner].house].stores.grain = (House.list[Player.list[building.owner].house].stores.grain || 0) + deposited;
                    } else if(Player.list[building.owner].stores){
                      Player.list[building.owner].stores.grain = (Player.list[building.owner].stores.grain || 0) + deposited;
                    }
                  } else if(building.house && House.list[building.house]){
                    House.list[building.house].stores.grain = (House.list[building.house].stores.grain || 0) + deposited;
                  }
                  
                  // Track daily deposits
                  if(!building.dailyStores) building.dailyStores = {};
                  building.dailyStores.grain = (building.dailyStores.grain || 0) + deposited;
                  
                  // Give flour to player
                  inv.flour = (inv.flour || 0) + flourProduced;
                  conversionResults.flour = flourProduced;
                  totalDeposited.grain = deposited;
                } else {
                  // Deposit target doesn't exist - don't decrement inventory
                  deposited = 0;
                }
              }
            } else if(building.type === 'lumbermill'){
              // Lumbermill: owners get 1:1, non-owners get 2 deposited per 3 given
              if(isOwner){
                deposited = amountToDeposit;
                
                // Verify deposit target exists before decrementing inventory
                var depositTargetExists = (player.house && House.list[player.house]) || player.stores;
                
                if(depositTargetExists){
                  inv.wood -= amountToDeposit;
                  if(player.house && House.list[player.house]){
                    House.list[player.house].stores.wood = (House.list[player.house].stores.wood || 0) + deposited;
                  } else if(player.stores){
                    player.stores.wood = (player.stores.wood || 0) + deposited;
                  }
                  
                  if(!building.dailyStores) building.dailyStores = {};
                  building.dailyStores.wood = (building.dailyStores.wood || 0) + deposited;
                  totalDeposited.wood = deposited;
                } else {
                  deposited = 0;
                }
              } else {
                var chunks = Math.floor(amountToDeposit / 3);
                var woodUsed = chunks * 3;
                deposited = chunks * 2;
                
                if(woodUsed > 0){
                  // Verify deposit target exists before decrementing inventory
                  var depositTargetExists = false;
                  if(Player.list[building.owner]){
                    if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                      depositTargetExists = true;
                    } else if(Player.list[building.owner].stores){
                      depositTargetExists = true;
                    }
                  } else if(building.house && House.list[building.house]){
                    depositTargetExists = true;
                  }
                  
                  if(depositTargetExists){
                    inv.wood -= woodUsed;
                    if(Player.list[building.owner]){
                      if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                        House.list[Player.list[building.owner].house].stores.wood = (House.list[Player.list[building.owner].house].stores.wood || 0) + deposited;
                      } else if(Player.list[building.owner].stores){
                        Player.list[building.owner].stores.wood = (Player.list[building.owner].stores.wood || 0) + deposited;
                      }
                    } else if(building.house && House.list[building.house]){
                      House.list[building.house].stores.wood = (House.list[building.house].stores.wood || 0) + deposited;
                    }
                    
                    if(!building.dailyStores) building.dailyStores = {};
                    building.dailyStores.wood = (building.dailyStores.wood || 0) + deposited;
                    totalDeposited.wood = deposited;
                  } else {
                    deposited = 0;
                  }
                }
              }
            } else if(building.type === 'mine'){
              // Mine: owners get 1:1, non-owners get 2 deposited per 3 given
              if(isOwner){
                deposited = amountToDeposit;
                
                // Verify deposit target exists before decrementing inventory
                var depositTargetExists = (player.house && House.list[player.house]) || player.stores;
                
                if(depositTargetExists){
                  inv[resourceType] -= amountToDeposit;
                  if(player.house && House.list[player.house]){
                    House.list[player.house].stores[resourceType] = (House.list[player.house].stores[resourceType] || 0) + deposited;
                  } else if(player.stores){
                    player.stores[resourceType] = (player.stores[resourceType] || 0) + deposited;
                  }
                  
                  if(!building.dailyStores) building.dailyStores = {};
                  building.dailyStores[resourceType] = (building.dailyStores[resourceType] || 0) + deposited;
                  totalDeposited[resourceType] = deposited;
                } else {
                  deposited = 0;
                }
              } else {
                var chunks = Math.floor(amountToDeposit / 3);
                var resourceUsed = chunks * 3;
                deposited = chunks * 2;
                
                if(resourceUsed > 0){
                  // Verify deposit target exists before decrementing inventory
                  var depositTargetExists = false;
                  if(Player.list[building.owner]){
                    if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                      depositTargetExists = true;
                    } else if(Player.list[building.owner].stores){
                      depositTargetExists = true;
                    }
                  } else if(building.house && House.list[building.house]){
                    depositTargetExists = true;
                  }
                  
                  if(depositTargetExists){
                    inv[resourceType] -= resourceUsed;
                    if(Player.list[building.owner]){
                      if(Player.list[building.owner].house && House.list[Player.list[building.owner].house]){
                        House.list[Player.list[building.owner].house].stores[resourceType] = (House.list[Player.list[building.owner].house].stores[resourceType] || 0) + deposited;
                      } else if(Player.list[building.owner].stores){
                        Player.list[building.owner].stores[resourceType] = (Player.list[building.owner].stores[resourceType] || 0) + deposited;
                      }
                    } else if(building.house && House.list[building.house]){
                      House.list[building.house].stores[resourceType] = (House.list[building.house].stores[resourceType] || 0) + deposited;
                    }
                    
                    if(!building.dailyStores) building.dailyStores = {};
                    building.dailyStores[resourceType] = (building.dailyStores[resourceType] || 0) + deposited;
                    totalDeposited[resourceType] = deposited;
                  } else {
                    deposited = 0;
                  }
                }
              }
            }
          }
          
          // Send confirmation message
          if(Object.keys(totalDeposited).length > 0){
            var message = '<i>Deposited: ';
            var depositParts = [];
            for(var res in totalDeposited){
              var displayName = res.charAt(0).toUpperCase() + res.slice(1);
              depositParts.push('<b>' + totalDeposited[res] + ' ' + displayName + '</b>');
            }
            message += depositParts.join(', ');
            
            // Show conversion results
            if(conversionResults.flour){
              message += '. Received <b>' + conversionResults.flour + ' Flour</b>';
            }
            
            // Show building totals if owner
            if(isOwner){
              message += '. Building totals: ';
              var totalParts = [];
              for(var res in totalDeposited){
                var total = 0;
                if(player.house && House.list[player.house]){
                  total = House.list[player.house].stores[res] || 0;
                } else {
                  total = player.stores[res] || 0;
                }
                var displayName = res.charAt(0).toUpperCase() + res.slice(1);
                totalParts.push('<b>' + total + ' ' + displayName + '</b>');
              }
              message += totalParts.join(', ');
            }
            
            message += '</i>';
            socket.write(JSON.stringify({msg:'addToChat', message: message}));
          } else {
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>No resources deposited.</i>'}));
          }
        } else if (data.msg === 'createHouse') {
          // Handle house creation from UI
          if(!data.houseName || !data.buildingId){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Invalid house creation request.</i>'}));
            return;
          }
          
          var building = Building.list[data.buildingId];
          if(!building){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Building not found.</i>'}));
            return;
          }
          
          // Validate player is at garrison desk (z=2, own building)
          if(building.type !== 'garrison'){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Must be at a Garrison.</i>'}));
            return;
          }
          
          if(building.owner !== socket.id){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Must be at your own Garrison.</i>'}));
            return;
          }
          
          if(player.z !== 2){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Must be at the desk upstairs.</i>'}));
            return;
          }
          
          // Validate house name: single word, only a-z characters
          var houseName = data.houseName.trim().toLowerCase();
          if(!houseName || houseName.length === 0 || houseName.length > 20){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>House name must be 1-20 characters.</i>'}));
            return;
          }
          
          if(!/^[a-z]+$/.test(houseName)){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>House name must be a single word with only lowercase letters (a-z).</i>'}));
            return;
          }
          
          // Check if name is taken
          var nameTaken = false;
          for(var i in House.list){
            if(House.list[i].name.toLowerCase() === houseName){
              nameTaken = true;
              break;
            }
          }
          
          if(nameTaken){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>Name is taken.</i>'}));
            return;
          }
          
          // Check available flags
          var availableFlags = typeof getAvailableFlagsForUI === 'function' ? getAvailableFlagsForUI() : [];
          if(availableFlags.length === 0){
            socket.write(JSON.stringify({msg:'addToChat', message: '<i>There are too many Houses.</i>'}));
            return;
          }
          
          // Assign flag
          var flag = null;
          var flagIndex = null;
          
          if(data.flagIndex !== null && data.flagIndex !== undefined){
            // Use specified flag
            flagIndex = parseInt(data.flagIndex, 10);
            if(isNaN(flagIndex) || flagIndex < 0 || flagIndex > 69){
              socket.write(JSON.stringify({msg:'addToChat', message: '<i>Invalid flag selection.</i>'}));
              return;
            }
            
            // Verify flag is still available
            var flagAvailable = false;
            for(var i = 0; i < availableFlags.length; i++){
              if(availableFlags[i].index === flagIndex){
                flagAvailable = true;
                flag = availableFlags[i].emoji;
                break;
              }
            }
            
            if(!flagAvailable){
              socket.write(JSON.stringify({msg:'addToChat', message: '<i>Flag is no longer available.</i>'}));
              return;
            }
            
            // Mark flag as used
            if(flags[flagIndex]){
              flags[flagIndex][1] = 1;
            }
          } else {
            // Random flag
            var randomFlag = availableFlags[Math.floor(Math.random() * availableFlags.length)];
            flag = randomFlag.emoji;
            flagIndex = randomFlag.index;
            
            // Mark flag as used
            if(flags[flagIndex]){
              flags[flagIndex][1] = 1;
            }
          }
          
          // Create house
          var loc = getLoc(player.x, player.y);
          var houseId = Math.random();
          
          House({
            id: houseId,
            type: 'player',
            name: houseName,
            flag: flag,
            hq: loc,
            hostile: false
          });
          
          player.house = houseId;
          
          // Convert house (if function exists)
          if(typeof convertHouse === 'function'){
            convertHouse(player.id);
          }
          
          // Notify clients
          socket.write(JSON.stringify({
            msg: 'newFaction',
            houseList: House.list,
            kingdomList: Kingdom.list
          }));
          
          socket.write(JSON.stringify({msg:'addToChat', message: '<i>House "' + houseName + '" created!</i>'}));
        } else if (data.msg === 'useItem') {
          if (player && data.itemType) {
            const itemType = data.itemType;
            
            // Check if player has the item
            if (player.inventory[itemType] && player.inventory[itemType] > 0) {
              // Get item info for colored message
              const { ItemFactory, itemFactory } = require('./server/js/entities/ItemFactory');
              const itemConfig = itemFactory.itemConfigs[itemType];
              const rank = itemConfig ? itemConfig.rank : 0;
              const rarityColor = ItemFactory.getRarityColor(rank);
              const itemName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
              
              // Handle consumables
              const consumables = ['bread', 'meat', 'fish', 'lamb', 'boarmeat', 'venison', 'poachedfish', 'lambchop', 'boarshank', 'venisonloin'];
              const drinks = ['mead', 'saison', 'flanders', 'bieredegarde', 'bordeaux', 'bourgogne', 'chianti'];
              
              if (consumables.indexOf(itemType) !== -1) {
                // Restore HP based on food quality
                let hpRestore = 20; // Basic food
                if (['lambchop', 'boarshank', 'venisonloin'].indexOf(itemType) !== -1) {
                  hpRestore = 40; // Cooked food
                }
                if (['poachedfish'].indexOf(itemType) !== -1) {
                  hpRestore = 30; // Prepared fish
                }
                
                player.hp = Math.min(player.hp + hpRestore, player.hpMax);
                player.inventory[itemType]--;
                
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: `<i>You consumed</i> <b style="color:${rarityColor}">[${itemName}]</b> <i>and restored</i> <span style="color:#00ff00;">${hpRestore} HP</span>.`
                }));
              } else if (drinks.indexOf(itemType) !== -1) {
                // Restore HP based on drink quality
                let hpRestore = 10; // Basic drinks
                if (['flanders', 'bieredegarde'].indexOf(itemType) !== -1) {
                  hpRestore = 20; // Quality beer
                }
                if (['bordeaux', 'bourgogne', 'chianti'].indexOf(itemType) !== -1) {
                  hpRestore = 30; // Fine wine
                }
                
                player.hp = Math.min(player.hp + hpRestore, player.hpMax);
                player.inventory[itemType]--;
                
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: `<i>You drank</i> <b style="color:${rarityColor}">[${itemName}]</b> <i>and restored</i> <span style="color:#00ff00;">${hpRestore} HP</span>.`
                }));
              } else {
                socket.write(JSON.stringify({
                  msg: 'addToChat',
                  message: '<i>You cannot use that item.</i>'
                }));
              }
            }
          }
        }
      }
    } catch (e) {
    }
  });

  socket.on('close', function() {
    // Remove socket from SOCKET_LIST immediately on disconnect
    if (SOCKET_LIST[socket.id]) {
      delete SOCKET_LIST[socket.id];
    }
    
    // Clean up spectators
    if(global.spectators && global.spectators[socket.id]){
      delete global.spectators[socket.id];
    }
    
    Player.onDisconnect(socket);
  });

  socket.onclose = function() {
    // Remove socket from SOCKET_LIST immediately on disconnect
    if (SOCKET_LIST[socket.id]) {
      delete SOCKET_LIST[socket.id];
    }
    
    // Clean up spectators
    if(global.spectators && global.spectators[socket.id]){
      delete global.spectators[socket.id];
    }
    
    Player.onDisconnect(socket);
  };
});

// ============================================================================
// GAME LOOP
// ============================================================================

const initPack = { player: [], arrow: [], item: [], light: [], building: [] };
const removePack = { player: [], arrow: [], item: [], light: [], building: [] };
global.initPack = initPack;
global.removePack = removePack;

// Note: global.Item will be set by Entity.js when Item constructor is defined

// Initialize Simple Serf Behavior system
const SimpleSerfBehavior = require('./server/js/core/SimpleSerfBehavior.js');
global.simpleSerfBehavior = new SimpleSerfBehavior();

// Initialize optimized game loop
optimizedGameLoop.initialize(gameState, emit);

// Start the optimized game loop (60 FPS)
optimizedGameLoop.start();

// Performance monitoring and cleanup - every 30 seconds
setInterval(() => {
  // Cleanup expired path cache entries
  pathCache.cleanup();
  
  // Log entity counts for monitoring
  const playerCount = Object.keys(Player.list).length;
  const itemCount = Object.keys(Item.list).length;
  const arrowCount = Object.keys(Arrow.list).length;
  const buildingCount = Object.keys(Building.list).length;
  
  // Break down fauna counts
  const faunaCounts = { deer: 0, boar: 0, wolf: 0, falcon: 0, serf: 0, other: 0 };
  for (const id in Player.list) {
    const entity = Player.list[id];
    // Fixed: Use entity.class directly (it's already lowercase in some cases)
    const entityClass = (entity.class || '').toString();
    if (entityClass === 'Deer' || entityClass === 'deer') faunaCounts.deer++;
    else if (entityClass === 'Boar' || entityClass === 'boar') faunaCounts.boar++;
    else if (entityClass === 'Wolf' || entityClass === 'wolf') faunaCounts.wolf++;
    else if (entityClass === 'Falcon' || entityClass === 'falcon') faunaCounts.falcon++;
    else if (entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' || entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff') faunaCounts.serf++;
    else faunaCounts.other++;
  }
  
}, 30000);

// Periodic cleanup - every 5 minutes
setInterval(() => {
  // Clean up dead entity references from all systems
  for(const id in Player.list){
    const entity = Player.list[id];
    if(entity.toRemove || (entity.hp !== null && entity.hp <= 0)){
      if(entity.cleanup){
        entity.cleanup();
      }
      delete Player.list[id];
    }
  }
  
  // Clean up excessive items (prevent unbounded growth)
  const itemIds = Object.keys(Item.list);
  const itemCount = itemIds.length;
  const maxItems = 5000;
  
  if(itemCount > maxItems){
    // Sort items by creation time (oldest first) - items without timestamp are prioritized for removal
    const itemsWithAge = itemIds.map(id => ({
      id,
      item: Item.list[id],
      age: Item.list[id].timestamp || 0
    })).sort((a, b) => a.age - b.age);
    
    // Remove oldest items until we're under the limit
    const itemsToRemove = itemCount - maxItems;
    for(let i = 0; i < itemsToRemove && i < itemsWithAge.length; i++){
      const itemData = itemsWithAge[i];
      // Don't remove items that belong to players or are player-owned
      if(itemData.item.type !== 'Banner' && !itemData.item.owner){
        itemData.item.toRemove = true;
        delete Item.list[itemData.id];
      }
    }
  }
  
  // Clean up excessive arrows (prevent unbounded growth)
  const arrowIds = Object.keys(Arrow.list);
  const arrowCount = arrowIds.length;
  const maxArrows = 500;
  
  if(arrowCount > maxArrows){
    // Remove oldest arrows
    const arrowsToRemove = arrowCount - maxArrows;
    for(let i = 0; i < arrowsToRemove && i < arrowIds.length; i++){
      const arrowId = arrowIds[i];
      if(Arrow.list[arrowId]){
        Arrow.list[arrowId].toRemove = true;
        delete Arrow.list[arrowId];
      }
    }
  }
}, 300000); // 5 minutes

// Keep old interval for init/remove packs (less frequent)
setInterval(function() {
  // Fauna entities are included in initPack but not logged individually
  
  emit({ msg: 'init', pack: initPack });
  emit({ msg: 'remove', pack: removePack });

  // Clear packs
  initPack.player = [];
  initPack.arrow = [];
  initPack.item = [];
  initPack.light = [];
  initPack.building = [];
  removePack.player = [];
  removePack.arrow = [];
  removePack.item = [];
  removePack.light = [];
  removePack.building = [];
}, 5000); // Much reduced frequency for init/remove packs to reduce lag

// ============================================================================
// INITIALIZE GAME WORLD
// ============================================================================

// Day/night cycle, weather updates, fauna, relics, and factions are now initialized in continueServerInitialization()
// after the world is generated

// Initialize tempus properly before logging (will be set in continueServerInitialization)
let tempus = 'XII.a';

// ============================================================================
// RESOURCE SCOREBOARD - Faction Resource Tracking
// ============================================================================

function calculateFactionResources() {
  const factionResources = {};
  
  // Only these NPC factions gather resources
  const resourceFactions = ['Goths', 'Franks', 'Celts', 'Teutons'];
  
  // For each faction/house
  for (const houseId in House.list) {
    const house = House.list[houseId];
    
    // Include resource-gathering NPC factions OR player-created factions
    const isResourceFaction = resourceFactions.includes(house.name);
    const isPlayerFaction = house.type === 'player';
    
    if (!isResourceFaction && !isPlayerFaction) {
      continue;
    }
    
    // Initialize faction data
    factionResources[houseId] = {
      name: house.name,
      flag: house.flag || '',
      lumber: house.stores.wood || 0,
      stone: house.stores.stone || 0,
      grain: house.stores.grain || 0,
      fish: house.stores.fish || 0,
      ironore: house.stores.ironore || 0,
      iron: house.stores.iron || 0,
      steel: house.stores.steel || 0,
      silver: house.stores.silver || 0,
      gold: house.stores.gold || 0,
      serfs: 0,
      military: 0,
      buildings: 0
    };
    
    
    // Count buildings owned by faction
    for (const buildingId in Building.list) {
      const building = Building.list[buildingId];
      if (building.house == houseId || building.owner == houseId) {
        factionResources[houseId].buildings++;
      }
    }
    
    // Count units (serfs and military)
    for (const playerId in Player.list) {
      const player = Player.list[playerId];
      if (player.house == houseId) {
        const entityClass = (player.class || '').toString();
        // Count serfs
        if (entityClass === 'Serf' || entityClass === 'SerfM' || entityClass === 'SerfF' || 
            entityClass === 'serf' || entityClass === 'serfm' || entityClass === 'serff') {
          factionResources[houseId].serfs++;
        }
        // Count military units
        else if (player.military) {
          factionResources[houseId].military++;
        }
      }
    }
  }
  
  return factionResources;
}

global.calculateFactionResources = calculateFactionResources;

// ============================================================================
// EXPORTS (for modular use)
// ============================================================================

module.exports = {
  Player,
  getTile,
  getLoc,
  getCoords,
  getCenter,
  getDistance,
  isWalkable,
  allyCheck,
  emit,
  TERRAIN,
  Z_LEVELS,
  get tileSize() { return gameState.tileSize || TILE_SIZE; },
  get mapSize() { return gameState.mapSize || 192; }
};
