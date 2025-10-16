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
// INITIALIZE GAME
// ============================================================================

// Import new modular systems
const { gameState } = require('./server/js/core/GameState.js');
const { CommandHandler } = require('./server/js/commands/CommandHandler.js');
const { itemFactory } = require('./server/js/entities/ItemFactory.js');
const OptimizedGameLoop = require('./server/js/core/OptimizedGameLoop.js');
const SimpleCombat = require('./server/js/core/SimpleCombat.js');
const { TilemapIntegration } = require('./server/js/core/TilemapIntegration.js');

// Initialize game state
const genesis = require('./server/js/genesis');
let world = genesis.map;
let caveEntrances = genesis.entrances || [];
global.caveEntrances = caveEntrances;
gameState.initializeWorld(world);

// Initialize consolidated tilemap system
console.log('Initializing consolidated tilemap system...');
const tilemapIntegration = new TilemapIntegration();
tilemapIntegration.initializeFromWorldArray(world, gameState.mapSize);
global.tilemapSystem = tilemapIntegration;

// Expose basic constants/globals needed by other modules (backward compatibility)
global.TERRAIN = TERRAIN;
global.Z_LEVELS = Z_LEVELS;
global.tileSize = gameState.tileSize;
global.mapSize = gameState.mapSize;
global.mapPx = gameState.mapPx;
global.period = gameState.period;

// Note: isDoorwayDestination is already defined globally at the top of the file
global.day = gameState.day;
global.tick = gameState.tick;
global.tempus = gameState.tempus;
global.nightfall = gameState.nightfall;

// Removed speed multiplier - just use baseSpd directly

// Expose the new modular systems globally
global.gameState = gameState;
global.itemFactory = itemFactory;
global.simpleCombat = new SimpleCombat();

// Initialize SimpleFlee system
const SimpleFlee = require('./server/js/core/SimpleFlee');
global.simpleFlee = new SimpleFlee();

// Create command handler after globals are set
const commandHandler = new CommandHandler();

// Create optimized game loop
const optimizedGameLoop = new OptimizedGameLoop();

const SOCKET_LIST = {};
global.SOCKET_LIST = SOCKET_LIST;
let io = null;
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
    if (toDelete.length > 0) {
      console.log(`PathCache: Cleaned up ${toDelete.length} expired entries`);
    }
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
    console.error('tileChange: Invalid input types', { l, c, r, n });
    return;
  }
  
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    console.warn(`tileChange: Coordinates out of bounds [${l}][${c}][${r}] (mapSize: ${mapSize})`);
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
    console.error('tileChange error:', error, { l, c, r, n, incr });
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
    console.warn('emit: Invalid data', data);
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
      console.error(`emit: Error writing to socket ${i}:`, error.message);
      disconnectedSockets.push(i);
    }
  }
  
  // Clean up disconnected sockets
  disconnectedSockets.forEach(socketId => {
    console.log(`emit: Removing disconnected socket ${socketId}`);
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
  const grid = createArray(mapSize, mapSize);

  if (z === 0) {
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        grid[y][x] = world[0][y][x] === 0 ? 1 : 0;
      }
    }
  } else if (z === -1) {
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        grid[y][x] = world[1][y][x] === 1 ? 1 : 0;
      }
    }
  } else if (z === 3) {
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        grid[y][x] = world[0][y][x] === 0 ? 0 : 1;
      }
    }
  } else if (z === -3) {
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        grid[y][x] = 0;
      }
    }
  } else {
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        grid[y][x] = 1;
      }
    }
  }
  return grid;
}

const matrixO = pathing(0);
const matrixU = pathing(-1);
const matrixB1 = pathing();
const matrixB2 = pathing();
const matrixB3 = pathing();
const matrixW = pathing(-3);
const matrixS = pathing(3);

const gridO = new PF.Grid(matrixO);
const gridU = new PF.Grid(matrixU);
const gridB1 = new PF.Grid(matrixB1);
const gridB2 = new PF.Grid(matrixB2);
const gridB3 = new PF.Grid(matrixB3);
const gridW = new PF.Grid(matrixW);
const gridS = new PF.Grid(matrixS);

function cloneGrid(g, options = {}) {
  // Use the new consolidated pathfinding system
  const grid = global.tilemapSystem.pathfindingSystem.tilemapSystem.generatePathfindingGrid(g, options);
  return new PF.Grid(grid);
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
    
    // Check for other units at this position
    const center = getCenter(x, y);
    for (const playerId in Player.list) {
      const player = Player.list[playerId];
      if (player.z === z && Math.abs(player.x - center[0]) < 20 && Math.abs(player.y - center[1]) < 20) {
        return false; // Another unit is blocking this path
      }
    }
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
function createMultiZPath(startZ, startLoc, targetZ, targetLoc) {
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
    console.log('No valid route found between z-levels', startZ, 'and', targetZ);
    return null;
  }
  
  // Create waypoints for each transition
  let currentZ = startZ;
  let currentLoc = startLoc;
  
  for (let i = 0; i < route.length - 1; i++) {
    const fromZ = route[i];
    const toZ = route[i + 1];
    
    // Find transition point between these z-levels
    const transition = findZTransition(fromZ, toZ, currentLoc, targetLoc);
    
    if (!transition) {
      console.log('No transition found from', fromZ, 'to', toZ);
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
function findZTransition(fromZ, toZ, fromLoc, targetLoc) {
  if (fromZ === -1 && toZ === 0) {
    // Cave to overworld: find nearest cave entrance
    let bestEntrance = null;
    let bestDistance = Infinity;
    
    for (const entrance of caveEntrances) {
      const distance = getDistance(
        {x: fromLoc[0], y: fromLoc[1]}, 
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
        action: 'exit_cave'
      };
    }
  }
  
  if (fromZ === 0 && toZ === -1) {
    // Overworld to cave: find nearest cave entrance to target
    let bestEntrance = null;
    let bestDistance = Infinity;
    
    for (const entrance of caveEntrances) {
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
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    console.warn(`matrixChange out of bounds: [${c},${r}] (mapSize: ${mapSize})`);
    return;
  }

  const target = matrices[l];
  if (target && target.matrix[r]) {
    target.matrix[r][c] = n;
    target.grid.setWalkableAt(c, r, n === 0);
  } else if (target) {
    console.warn(`matrixChange: matrix[${r}] undefined for layer ${l}`);
  }
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
    '-2': matrixB3
  };

  const matrix = matrices[z];
  return matrix ? matrix[r][c] === 0 : false;
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

function getBuilding(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) {
    console.warn('getBuilding: Invalid coordinates', { x, y });
    return null;
  }
  
  const loc = getLoc(x, y);
  if (!loc || loc[0] < 0 || loc[0] >= mapSize || loc[1] < 0 || loc[1] >= mapSize) {
    return null;
  }
  
  for (const i in Building.list) {
    const b = Building.list[i];
    if (!b || !b.plot || !Array.isArray(b.plot)) continue;
    
    for (let n = 0; n < b.plot.length; n++) {
      if (b.plot[n] && b.plot[n][0] === loc[0] && b.plot[n][1] === loc[1]) {
        return b.id;
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
// FACTION HELPERS
// ============================================================================

function allyCheck(playerId, otherId) {
  if (playerId === otherId) return 2; // Same entity
  
  const player = Player.list[playerId];
  const other = Player.list[otherId];

  if (!player || !other) return 0;

  const pHouse = House.list[player.house];
  const oHouse = House.list[other.house];

  if (pHouse) {
    if (pHouse.hostile) {
      if (oHouse) {
        if (player.house === other.house) return 2;

        for (const i in pHouse.allies) {
          if (pHouse.allies[i] === other.house) return 1;
        }
        return -1;
      } else {
        return -1;
      }
    } else {
      if (oHouse) {
        if (player.house === other.house) return 2;

        for (const i in pHouse.allies) {
          if (pHouse.allies[i] === other.house) return 1;
        }

        if (oHouse.hostile) return -1;

        for (const i in pHouse.enemies) {
          if (pHouse.enemies[i] === other.house) return -1;
        }
        return 0;
      } else {
        for (const i in pHouse.enemies) {
          if (pHouse.enemies[i] === otherId) return -1;
        }
        return 0;
      }
    }
  } else {
    if (oHouse) {
      if (oHouse.hostile) return -1;

      for (const i in oHouse.enemies) {
        if (oHouse.enemies[i] === playerId) return -1;
      }
      return 0;
    } else {
      // Both have no house - check if either is a wild animal (always hostile)
      const wildAnimals = ['Wolf', 'Boar'];
      if (wildAnimals.includes(player.class) || wildAnimals.includes(other.class)) {
        return -1; // Hostile
      }
      
      for (const i in player.friends) {
        if (player.friends[i] === otherId) return 1;
      }
      for (const i in player.enemies) {
        if (player.enemies[i] === otherId) return -1;
      }
      return 0;
    }
  }
}

// ============================================================================
// SPAWN HELPERS
// ============================================================================

function randomSpawnO() {
  const rand = Math.floor(Math.random() * spawnPointsO.length);
  const point = spawnPointsO[rand];
  return getCenter(point[0], point[1]);
}
global.randomSpawnO = randomSpawnO;

function randomSpawnHF() {
  const rand = Math.floor(Math.random() * hForestSpawns.length);
  const point = hForestSpawns[rand];
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

function entropy() {
  // FLORA
  const toHF = [];
  const toF = [];
  const toB = [];

  for (let c = 0; c < mapSize; c++) {
    for (let r = 0; r < mapSize; r++) {
      const tile = getTile(0, c, r);

      // Fish spawning
      if (tile === TERRAIN.WATER) {
        world[6][r][c] = Math.random() < 0.2 ? Math.ceil(Math.random() * 10) : 0;
      }
      // Tree growth
      else if (tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.LIGHT_FOREST && day > 0) {
        if (world[6][r][c] < 300) {
          world[6][r][c] += Math.floor(Math.random() * 4);
        }
      }
      // Forest to heavy forest
      else if (tile >= TERRAIN.LIGHT_FOREST && tile < TERRAIN.BRUSH && day > 0) {
        world[6][r][c] += Math.floor(Math.random() * 4);
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
            if (Math.random() < 0.1) {
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
            if (Math.random() < 0.15) {
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
    world[0][toHF[i][1]][toHF[i][0]] -= 1;
    biomes.hForest++;
    hForestSpawns.push(toHF[i]);
  }
  for (const i in toF) {
    world[0][toF[i][1]][toF[i][0]] -= 1;
    world[6][toF[i][1]][toF[i][0]] = 50;
  }
  for (const i in toB) {
    world[0][toB[i][1]][toB[i][0]] = TERRAIN.BRUSH + Number((Math.random() * 0.9).toFixed(2));
  }

  // FAUNA (2x spawn rates)
  const animalRatios = {
    deer: Math.floor(biomes.hForest / 200),  // 400/2 = 200
    boar: Math.floor(biomes.hForest / 800),  // 1600/2 = 800
    wolf: Math.floor(biomes.hForest / 400),  // 800/2 = 400
    falcon: Math.floor(biomes.hForest / 1200) // 2400/2 = 1200
  };

  const animalPops = { deer: 0, boar: 0, wolf: 0, falcon: 0 };

  for (const i in Player.list) {
    const cl = Player.list[i].class;
    if (animalPops[cl] !== undefined) {
      animalPops[cl]++;
    }
  }

  const spawnAnimal = (type, ratio, pop, AnimalConstructor) => {
    if (pop < ratio) {
      const num = day === 1
        ? Math.floor(ratio * 0.618) // Initial spawn on day 1
        : Math.floor((ratio - pop) * (type === 'falcon' ? 0.01 : 0.02));

      console.log(`Spawning ${num} ${type}(s) (day: ${day}, ratio: ${ratio}, pop: ${pop}, hForest: ${biomes.hForest})`);

      for (let i = 0; i < num; i++) {
        const sp = randomSpawnHF();
        const sLoc = getLoc(sp[0], sp[1]);
        AnimalConstructor({
          x: sp[0],
          y: sp[1],
          z: 0,
          home: { z: 0, loc: [sLoc[0], sLoc[1]] },
          falconry: type === 'falcon' ? false : undefined
        });
      }
    } else {
      console.log(`Skipping ${type} spawn (pop: ${pop} >= ratio: ${ratio}, hForest: ${biomes.hForest})`);
    }
  };

  spawnAnimal('deer', animalRatios.deer, animalPops.deer, Deer);
  spawnAnimal('boar', animalRatios.boar, animalPops.boar, Boar);
  spawnAnimal('wolf', animalRatios.wolf, animalPops.wolf, Wolf);
  spawnAnimal('falcon', animalRatios.falcon, animalPops.falcon, Falcon);

  // Individual tile updates are handled by tileChange function
}

function dailyTally() {
  for (const i in Building.list) {
    const b = Building.list[i];
    if (b.built && (b.type === 'mill' || b.type === 'lumbermill' || b.type === 'mine')) {
      Building.list[i].tally();
    }
  }
}

// ============================================================================
// INITIALIZE ZONES
// ============================================================================

// Zones are now managed by the tilemap system
// The tilemap system automatically handles spatial partitioning
zones = global.tilemapSystem.tilemapSystem.zones;
global.zones = zones;

// ============================================================================
// SPATIAL SYSTEM (will be initialized after Player object is defined)
// ============================================================================

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
  console.error('Error loading name files:', err);
}

// ============================================================================
// TERRAIN DATA DISPLAY
// ============================================================================

console.log('#############');
console.log('Terrain Data:');
console.log('#############');
console.log('');
console.log(Number((biomes.water / (mapSize * mapSize)) * 100).toFixed() + '% Water');
console.log(Number((biomes.hForest / (mapSize * mapSize)) * 100).toFixed() + '% Heavy Forest');
console.log(Number((biomes.forest / (mapSize * mapSize)) * 100).toFixed() + '% Light Forest');
console.log(Number((biomes.brush / (mapSize * mapSize)) * 100).toFixed() + '% Brush');
console.log(Number((biomes.rocks / (mapSize * mapSize)) * 100).toFixed() + '% Rocks');
console.log(Number((biomes.mtn / (mapSize * mapSize)) * 100).toFixed() + '% Mountains');
console.log('');

// ============================================================================
// PLAYER CLASS
// ============================================================================

const Player = function(param) {
  const self = Character(param);
  self.type = 'player';
  self.name = param.name;
  self.hasHorse = false;
  self.spriteSize = tileSize * 1.5;
  self.knighted = false;
  self.crowned = false;
  self.title = '';
  self.friendlyfire = false;

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
  self.pressingB = false;
  self.pressingN = false;
  self.pressingM = false;
  self.pressing1 = false;
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

  // Aggro check interval (cleaned up on disconnect)
  self.aggroInterval = setInterval(() => {
    self.checkAggro();
  }, 1000);

  self.die = function(report) {
    if (report.id) {
      const killer = Player.list[report.id];
      if (killer) {
        const killerName = killer.name || killer.class;
        console.log(`${killerName} has killed ${self.name}`);
        
        // End combat for killer using simple combat system (DON'T clear combat.target before this!)
        if (global.simpleCombat) {
          global.simpleCombat.endCombat(killer);
        }
      }
    } else {
      console.log(`${self.name} has ${report.cause}`);
    }

    // End combat for killed player using simple combat system (DON'T clear combat.target before this!)
    if (global.simpleCombat) {
      global.simpleCombat.endCombat(self);
    }

    self.hp = self.hpMax;
    const spawn = randomSpawnO();
    self.x = spawn[0];
    self.y = spawn[1];
    self.z = 0; // Ensure respawn on overworld
    
    // Clear any remaining combat state (should already be cleared by endCombat)
    self.combat.target = null;
    self.action = null;
    self.innaWoods = false;
    self.onMtn = false;
    self.path = null;
    self.pathCount = 0;
    
    // Brief immunity after respawn (prevent immediate re-aggro)
    self.respawnImmunity = true;
    setTimeout(() => {
      self.respawnImmunity = false;
    }, 3000); // 3 seconds of immunity
    
    console.log(`${self.name} respawned at ${spawn} with immunity (action: ${self.action}, combat.target: ${self.combat.target})`);
  };

  self.checkAggro = function() {
    // Skip aggro if player has respawn immunity
    if (self.respawnImmunity) {
      return;
    }
    
    if (!self.combat.target) {
      self.action = null;
    }

    for (const i in self.zGrid) {
      const zc = self.zGrid[i][0];
      const zr = self.zGrid[i][1];

      if (zc < 0 || zc >= 64 || zr < 0 || zr >= 64) continue;

      const zoneKey = `${zr},${zc}`;
      const zoneEntities = zones.get(zoneKey) || new Set();
      for (const entityId of zoneEntities) {
        const p = Player.list[entityId];
        if (!p || p.z !== self.z) continue;

        const pDist = self.getDistance({ x: p.x, y: p.y });
        if (pDist > p.aggroRange) continue;

        const ally = allyCheck(self.id, p.id);
        if (ally > 0) continue;

        self.stealthCheck(p);

        if (ally === -1 && p.type === 'npc' &&
            (self.innaWoods === p.innaWoods || (!self.innaWoods && p.innaWoods))) {
          if (!self.stealthed || self.revealed) {
            Player.list[p.id].combat.target = self.id;
            Player.list[p.id].action = 'combat';
            console.log(`${p.class} aggro @ ${self.name}`);
          }
        }
      }
    }
  };

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
        socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You cannot do that here.</i>' }));
      }
    } else {
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You have no torches.</i>' }));
    }
  };

  self.updateSpd = function() {
    // Set base speed (walk vs run)
    if (self.running) {
      self.baseSpd = 4;
    } else {
      self.baseSpd = 2;
    }
    
    // Apply terrain modifiers BEFORE movement
    const socket = SOCKET_LIST[self.id];
    const loc = getLoc(self.x, self.y);
    const currentTile = getTile(0, loc[0], loc[1]);
    
    // Set maxSpd based on terrain
    if (self.z === Z_LEVELS.OVERWORLD) {
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
            const checkTile = getTile(0, loc[0], loc[1]);
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
    } else if (self.z === Z_LEVELS.UNDERWATER) {
      // Underwater is VERY slow - disable running and apply heavy penalty
      self.running = false; // Force walking underwater
      self.baseSpd = 2; // Reset to walk speed
      self.maxSpd = (self.baseSpd * 0.1) * self.drag; // 90% speed reduction
      self.innaWoods = false;
      self.onMtn = false;
    } else {
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

    // Collision detection based on Z level
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
        // Allow stepping onto cave exit tile (2) to trigger ascent
        const isBlocked = (!isWalkable(-1, c, r) && tile !== 2);
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

    // Movement
    if (self.pressingRight) {
      self.facing = 'right';
      self.stopWorking();
      if (!blocked.right) self.x += self.maxSpd;
    } else if (self.pressingLeft) {
      self.facing = 'left';
      self.stopWorking();
      if (!blocked.left) self.x -= self.maxSpd;
    }

    if (self.pressingUp) {
      self.facing = 'up';
      self.stopWorking();
      if (!blocked.up) self.y -= self.maxSpd;
    } else if (self.pressingDown) {
      self.facing = 'down';
      self.stopWorking();
      if (!blocked.down) self.y += self.maxSpd;
    }

    // Terrain effects and Z-level transitions
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
      if (getTile(8, loc[0], loc[1]) === 5) {
        self.z = Z_LEVELS.BUILDING_1;
        self.y += tileSize / 2;
        self.facing = 'down';
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
      }
    } else if (self.z === Z_LEVELS.UNDERWATER) {
      self.handleUnderwater(tile, socket);
    } else if (self.z === Z_LEVELS.BUILDING_1) {
      self.handleBuilding1(loc, exit, b2, socket);
    } else if (self.z === Z_LEVELS.BUILDING_2) {
      if (getTile(4, loc[0], loc[1]) === 3 || getTile(4, loc[0], loc[1]) === 4) {
        self.z = Z_LEVELS.BUILDING_1;
        self.y += tileSize / 2;
        self.facing = 'down';
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
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
      Building.list[b].occ++;
      self.z = Z_LEVELS.BUILDING_1;
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
      setTimeout(() => {
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b }));
      }, 100);
    } else if (tile === TERRAIN.DOOR_LOCKED) {
      Building.list[b].occ++;
      self.z = Z_LEVELS.BUILDING_1;
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>🗝 You unlock the door.</i>' }));
      self.innaWoods = false;
      self.onMtn = false;
      self.maxSpd = self.baseSpd * self.drag;
      setTimeout(() => {
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b }));
      }, 100);
    } else if (tile === TERRAIN.WATER) {
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
    // Ensure underwater speed penalty is applied (handled in updateSpd now)
    if (self.breath > 0) {
      self.breath -= 0.25;
    } else {
      self.hp -= 0.5;
    }

    if (self.hp <= 0) {
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
      Building.list[exit].occ--;
      self.z = Z_LEVELS.OVERWORLD;
      socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z }));
    } else {
      const stairs = getTile(4, loc[0], loc[1]);
      if (stairs === 3 || stairs === 4 || stairs === 7) {
        self.z = Z_LEVELS.BUILDING_2;
        self.y += tileSize / 2;
        self.facing = 'down';
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
      } else if (stairs === 5 || stairs === 6) {
        self.z = Z_LEVELS.CELLAR;
        self.y += tileSize / 2;
        self.facing = 'down';
        socket.write(JSON.stringify({ msg: 'bgm', x: self.x, y: self.y, z: self.z, b: b2 }));
      }
    }
  };

  self.update = function() {
    self.updateSpd();
    self.zoneCheck();

    if (self.stealthed) {
      self.revealCheck();
    }

    if (self.actionCooldown > 0) self.actionCooldown--;
    if (self.attackCooldown > 0) self.attackCooldown--;
    if (self.mountCooldown > 0) self.mountCooldown--;
    if (self.switchCooldown > 0) self.switchCooldown--;

    // COMBAT ESCAPE - Clear combat status if enemy is far away
    if (self.action === 'combat' && self.combat.target) {
      const target = Player.list[self.combat.target];
      if (!target) {
        // Target doesn't exist anymore
        self.combat.target = null;
        self.action = null;
        console.log(self.name + ' combat cleared - target gone');
      } else {
        const distance = self.getDistance({ x: target.x, y: target.y });
        const escapeRange = 768; // 12 tiles (increased from 8)
        if (distance > escapeRange) {
          // Escaped far enough - end combat for BOTH sides
          console.log(self.name + ' escaped from ' + (target.name || target.class));
          
          // Use simple combat system to properly end combat
          if (global.simpleCombat) {
            global.simpleCombat.endCombat(self);
          } else {
            // Fallback: manually clear both sides
            self.combat.target = null;
            self.action = null;
            if (target.combat && target.combat.target === self.id) {
              target.combat.target = null;
              target.action = null;
            }
          }
          
          const playerSocket = SOCKET_LIST[self.id];
          if (playerSocket) {
            playerSocket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You escaped from combat.</i>' }));
          }
        }
      }
    }

    // TORCH
    if (self.pressingT && self.actionCooldown === 0) {
      self.lightTorch(Math.random());
      self.actionCooldown = 10;
    }

    // PICKUP
    if (self.pressingP && self.actionCooldown === 0 && !self.working) {
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
      socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>There is nothing to pick up.</i>' }));
    }

    // HORSE
    if (self.pressingH && self.actionCooldown === 0 && !self.working) {
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
              socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>Try again shortly.</i>' }));
            }
          } else {
            socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You are not wearing any riding gear.</i>' }));
          }
        } else {
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You do not own a horse.</i>' }));
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
            socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>You switch weapons to </i><b>${self.gear.weapon.name}</b>.` }));
          } else {
            socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You have no secondary weapon equipped.</i>' }));
          }
        } else {
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You have no weapons equipped.</i>' }));
        }
      } else {
        socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>Try again shortly.</i>' }));
      }
    }

    // BAG (show inventory)
    if (self.pressingB && self.actionCooldown === 0) {
      self.actionCooldown += 10;
      const socket = SOCKET_LIST[self.id];
      const items = [];

      for (const key in self.inventory) {
        if (self.inventory[key] > 0 && key !== 'keyRing') {
          const displayName = key.charAt(0).toUpperCase() + key.slice(1);
          items.push(`<b>${displayName}</b>: ${self.inventory[key]}`);
        }
      }

      if (items.length === 0) {
        socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You have nothing in your bag.</i>' }));
      } else {
        socket.write(JSON.stringify({ msg: 'addToChat', message: `<p>${items.join('<br>')}</p>` }));
      }
    }

    // INTERACTIONS
    if (self.pressingAttack && self.actionCooldown === 0 && !self.working) {
      const loc = getLoc(self.x, self.y);
      const dirOffsets = {
        down: [0, 1],
        up: [0, -1],
        left: [-1, 0],
        right: [1, 0]
      };

      const offset = dirOffsets[self.facing];
      const dir = [loc[0] + offset[0], loc[1] + offset[1]];

      if (!isWalkable(self.z, dir[0], dir[1])) {
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

    // WORK ACTIONS (F key)
    if (self.pressingF && self.actionCooldown === 0 && !self.working) {
      self.handleWorkAction();
    }

    // Update class based on gear
    self.updateClass();
  };

  self.handleWorkAction = function() {
    const socket = SOCKET_LIST[self.id];
    const loc = getLoc(self.x, self.y);
    const tile = getTile(0, loc[0], loc[1]);

    const adjacentLocs = {
      up: getLoc(self.x, self.y - tileSize),
      down: getLoc(self.x, self.y + tileSize),
      left: getLoc(self.x - tileSize, self.y),
      right: getLoc(self.x + tileSize, self.y)
    };

    // Fishing
    if (self.z === Z_LEVELS.OVERWORLD && getTile(0, adjacentLocs[self.facing][0], adjacentLocs[self.facing][1]) === TERRAIN.WATER) {
      self.actionCooldown = 10;
      const fishCount = getTile(6, adjacentLocs[self.facing][0], adjacentLocs[self.facing][1]);

      if (fishCount > 0) {
        const rand = Math.floor(Math.random() * 6000);
        self.working = true;
        self.fishing = true;

        setTimeout(() => {
          if (self.fishing) {
            self.working = false;
            self.fishing = false;
            self.inventory.fish++;
            tileChange(6, adjacentLocs[self.facing][0], adjacentLocs[self.facing][1], -1, true);
            socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You caught a Fish.</i>' }));
          }
        }, rand);
      } else {
        self.working = true;
        self.fishing = true;
      }
      return;
    }

    // Clear brush
    if (self.z === Z_LEVELS.OVERWORLD && tile >= TERRAIN.BRUSH && tile < TERRAIN.ROCKS) {
      self.actionCooldown = 10;
      self.working = true;

      setTimeout(() => {
        if (self.working) {
          tileChange(0, loc[0], loc[1], TERRAIN.EMPTY);
          // Tile update automatically handled by tileChange function
          self.working = false;
        }
      }, 3000 / self.strength);
      return;
    }

    // Gather wood
    if (self.z === Z_LEVELS.OVERWORLD && tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.BRUSH) {
      self.actionCooldown = 10;
      self.working = true;
      if (self.inventory.stoneaxe > 0 || self.inventory.ironaxe > 0) {
        self.chopping = true;
      }

      setTimeout(() => {
        if (self.working) {
          tileChange(6, loc[0], loc[1], -50, true);
          self.inventory.wood += 50;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You chopped 50 Wood.</i>' }));
          self.working = false;
          self.chopping = false;

          const currentTile = getTile(0, loc[0], loc[1]);
          const res = getTile(6, loc[0], loc[1]);

          if (currentTile >= TERRAIN.HEAVY_FOREST && currentTile < TERRAIN.LIGHT_FOREST && res <= 100) {
            tileChange(0, loc[0], loc[1], 1, true);

            for (const i in hForestSpawns) {
              if (hForestSpawns[i].toString() === loc.toString()) {
                biomes.hForest--;
                hForestSpawns.splice(i, 1);
                break;
              }
            }
            // Tile update automatically handled by tileChange function
          } else if (currentTile >= TERRAIN.LIGHT_FOREST && currentTile < TERRAIN.BRUSH && res <= 0) {
            tileChange(0, loc[0], loc[1], TERRAIN.EMPTY);
            // Tile update automatically handled by tileChange function
          }
        }
      }, 6000 / self.strength);
      return;
    }

    // Gather stone
    if (self.z === Z_LEVELS.OVERWORLD && tile >= TERRAIN.ROCKS && tile < TERRAIN.CAVE_ENTRANCE) {
      self.actionCooldown = 10;
      self.working = true;
      const mult = self.inventory.pickaxe > 0 ? 1 : 3;

      if (self.inventory.pickaxe > 0) {
        self.mining = true;
      }

      setTimeout(() => {
        if (self.working) {
          tileChange(6, loc[0], loc[1], -50, true);
          self.inventory.stone += 50;
          socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You quarried 50 Stone.</i>' }));
          self.working = false;
          self.mining = false;

          const currentTile = getTile(0, loc[0], loc[1]);
          if (currentTile >= TERRAIN.ROCKS && currentTile < TERRAIN.MOUNTAIN && getTile(6, loc[0], loc[1]) <= 0) {
            tileChange(0, loc[0], loc[1], TERRAIN.EMPTY);
            // Tile update automatically handled by tileChange function
          }
        }
      }, (10000 * mult) / self.strength);
      return;
    }

    // Mine metal (underworld)
    if (self.z === Z_LEVELS.UNDERWORLD && getTile(1, loc[0], loc[1]) >= 3 && getTile(1, loc[0], loc[1]) < 4) {
      self.actionCooldown = 10;
      self.working = true;
      const mult = self.inventory.pickaxe > 0 ? 1 : 3;

      if (self.inventory.pickaxe > 0) {
        self.mining = true;
      }

      setTimeout(() => {
        if (self.working && self.mining) {
          tileChange(7, loc[0], loc[1], -1, true);
          self.working = false;
          self.mining = false;
        }
      }, (10000 * mult) / self.strength);
      return;
    }

    // Farming actions
    if (self.z === Z_LEVELS.OVERWORLD) {
      if (tile === TERRAIN.FARM_SEED) {
        self.handleFarmSeeding(loc, socket);
      } else if (tile === TERRAIN.FARM_GROWING) {
        self.handleFarmGrowing(loc, socket);
      } else if (tile === TERRAIN.FARM_READY) {
        self.handleFarmHarvest(loc, socket);
      } else if (tile === TERRAIN.BUILD_MARKER || tile === TERRAIN.BUILD_MARKER_ALT) {
        Build(self.id);
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

      setTimeout(() => {
        if (self.working && self.farming) {
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
        }
      }, 10000);
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

    setTimeout(() => {
      if (self.working && getTile(6, loc[0], loc[1]) < 50) {
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
      }
    }, 10000);
  };

  self.handleFarmHarvest = function(loc, socket) {
    self.actionCooldown = 10;
    self.working = true;
    self.farming = true;

    setTimeout(() => {
      if (self.working) {
        tileChange(6, loc[0], loc[1], -1, true);
        self.inventory.grain += 1;
        socket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You harvested Grain.</i>' }));
        self.working = false;
        self.farming = false;

        if (getTile(6, loc[0], loc[1]) <= 0) {
          tileChange(0, loc[0], loc[1], TERRAIN.FARM_SEED);
          // Tile update automatically handled by tileChange function
        }
      }
    }, 10000);
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
      inventory: { arrows: self.inventory.arrows },
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
      ghost: self.ghost
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
      inventory: { arrows: self.inventory.arrows },
      spriteSize: self.spriteSize,
      innaWoods: self.innaWoods,
      facing: self.facing,
      stealthed: self.stealthed,
      revealed: self.revealed,
      pressingUp: self.pressingUp,
      pressingDown: self.pressingDown,
      pressingLeft: self.pressingLeft,
      pressingRight: self.pressingRight,
      pressingAttack: self.pressingAttack,
      angle: self.mouseAngle,
      working: self.working,
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
      ghost: self.ghost
    };
  };

  // ALPHA HAX - Testing defaults
  self.hasHorse = true;
  self.knighted = true;

  Player.list[self.id] = self;
  
  // Add to spatial system
  if (global.spatialSystem) {
    global.spatialSystem.addEntity(self.id, self);
  }
  
  initPack.player.push(self.getInitPack());

  return self;
};

Player.list = {};
global.Player = Player;

// ============================================================================
// INITIALIZE SPATIAL SYSTEM
// ============================================================================

// Initialize intelligent spatial partitioning system
const SpatialIntegration = require('./server/js/core/SpatialIntegration');
global.spatialSystem = new SpatialIntegration();
global.spatialSystem.initialize();

// Initialize building preview system
const BuildingPreview = require('./server/js/core/BuildingPreview');
global.buildingPreview = new BuildingPreview();

Player.onConnect = function(socket, name) {
  socket.write(JSON.stringify({
    msg: 'tempus',
    tempus,
    nightfall
  }));

  const spawn = randomSpawnO();
  const player = Player({
    name,
    id: socket.id,
    z: 0,
    x: spawn[0],
    y: spawn[1],
    home: { z: 0, x: spawn[0], y: spawn[1] }
  });

  console.log(`${player.name} spawned at: ${spawn} z: 0`);

  socket.on('data', function(string) {
    try {
      const data = JSON.parse(string);

      if(data.msg == 'keyPress'){
        if(data.inputId == 'left'){
          player.pressingLeft = data.state;
        } else if(data.inputId == 'right'){
          player.pressingRight = data.state;
        } else if(data.inputId == 'up'){
          player.pressingUp = data.state;
        } else if(data.inputId == 'down'){
          player.pressingDown = data.state;
        } else if(data.inputId == 'attack'){
          player.pressingAttack = data.state;
        } else if(data.inputId == 'e'){
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
        } else if(data.inputId == 'b'){
          player.pressingB = data.state;
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
            // Can't run underwater
            if(player.z === Z_LEVELS.UNDERWATER){
              socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>You can't run underwater!</i>` }));
            } else {
              player.running = !player.running;
              const mode = player.running ? 'running' : 'walking';
              socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Now ${mode}.</i>` }));
            }
          }
        } else if(data.inputId == 'mouseAngle'){
          player.mouseAngle = data.state;
        }
      } else if (data.msg === 'msgToServer') {
        emit({ msg: 'addToChat', message: `<b>${data.name}:</b> ${data.message}` });
      } else if (data.msg === 'pmToServer') {
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
          recipient.write(JSON.stringify({ msg: 'addToChat', message: `<b>@${player.name}</b> whispers: <i>${data.message}</i>` }));
          socket.write(JSON.stringify({ msg: 'addToChat', message: `To ${data.recip}: <i>${data.message}</i>` }));
        }
      }
    } catch (e) {
      console.error('Error parsing socket data:', e);
    }
  });

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

  console.log(`init player id: ${player.id}`);
};

Player.getAllInitPack = function() {
  return Object.values(Player.list).map(p => p.getInitPack());
};

Player.onDisconnect = function(socket) {
  const player = Player.list[socket.id];

  if (player) {
    console.log(`Player ${player.name} (${socket.id}) disconnecting...`);
    
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
        console.log(`Removed ${player.name} from zone ${zoneKey}`);
      }
    }
    
    // Remove from spatial system
    if (global.spatialSystem) {
      global.spatialSystem.removeEntity(socket.id);
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

  delete Player.list[socket.id];
  removePack.player.push(socket.id);
  console.log(`Player ${socket.id} fully removed from game`);
};

Player.update = function() {
  const pack = [];

  for (const i in Player.list) {
    const player = Player.list[i];
    player.update();

    if (player.toRemove) {
      if (player.aggroInterval) {
        clearInterval(player.aggroInterval);
      }
      if (player.zone) {
        // Remove from zones (using Map-based system)
        var zoneKey = player.zone[1] + ',' + player.zone[0];
        var zoneSet = zones.get(zoneKey);
        if (zoneSet) {
          zoneSet.delete(player.id);
        }
      }
      
      // Remove from spatial system
      if (global.spatialSystem) {
        global.spatialSystem.removeEntity(i);
      }
      
      delete Player.list[i];
      removePack.player.push(player.id);
    } else {
      // Update spatial system if player moved
      if (global.spatialSystem) {
        global.spatialSystem.updateEntity(i, player);
      }
      pack.push(player.getUpdatePack());
    }
  }

  return pack;
};

// ============================================================================
// DAY/NIGHT CYCLE
// ============================================================================

function dayNight() {
  // Use original tick-based system
  tempus = cycle[tick];
  global.tempus = tempus;

  if (tempus === 'XII.a') {
    day++;
    global.day = day;
    dailyTally();
    console.log('');
    console.log(`Day ${day}`);
    console.log('');

    const playerCount = Object.keys(Player.list).length;
    console.log(`Population: ${playerCount}`);

    // Optional: Save map
    const saveMap = false;
    if (saveMap) {
      fs.writeFile(`./maps/map${day}.txt`, JSON.stringify(world))
        .then(() => console.log("Map file saved to '/maps' folder."))
        .catch(err => console.error("Error saving map:", err));
    }
  }

  if (tempus === 'XII.p') {
    entropy();
    console.log('Entropy cycle complete (midnight)');
  }

  nightfall = ['VIII.p', 'IX.p', 'X.p', 'XI.p', 'XII.a', 'I.a', 'II.a', 'III.a', 'IV.a'].includes(tempus);
  global.nightfall = nightfall;

  emit({ msg: 'tempus', tempus, nightfall });
  console.log(tempus);

  House.update;
  Kingdom.update;

  tick = tick < 23 ? tick + 1 : 0;
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

serv.listen(2000);
console.log("###################################");
console.log("");
console.log("     ♜  S T R O N G H O D L ♜");
console.log("");
console.log("   A SOLIS ORTV VSQVE AD OCCASVM");
console.log("");
console.log("###################################");

io = sockjs.createServer();
io.installHandlers(serv, { prefix: '/io' });

io.on('connection', function(socket) {
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  console.log(`New connection: socket ${socket.id}`);
  console.log(`Socket connected: ${socket.id}`);

  socket.on('data', function(string) {
    try {
      const data = JSON.parse(string);

      if (data.msg === 'signIn') {
        console.log('Sign-in attempt:', data.name, data.password);
        console.log('Data received:', JSON.stringify(data));
        isValidPassword(data, function(res) {
          console.log('Password validation result:', res);
          if (res) {
            Player.onConnect(socket, data.name);
            
            // Reconstruct world array from tilemapSystem to ensure it's fully in sync
            const freshWorld = [];
            for (let layer = 0; layer < 9; layer++) {
              freshWorld[layer] = [];
              for (let y = 0; y < mapSize; y++) {
                freshWorld[layer][y] = [];
                for (let x = 0; x < mapSize; x++) {
                  freshWorld[layer][y][x] = global.tilemapSystem.getTile(layer, x, y);
                }
              }
            }
            
            socket.write(JSON.stringify({
              msg: 'signInResponse',
              success: true,
              world: freshWorld, // Send freshly reconstructed world array
              tileSize,
              mapSize,
              tempus
            }));
            console.log(`${data.name} logged in.`);
          } else {
            console.log('Sign-in failed for:', data.name);
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
                console.log(`${data.name} signed up.`);
              });
            }
          });
        } else {
          socket.write(JSON.stringify({ msg: 'signUpResponse', success: false }));
        }
      } else if (data.msg === 'evalCmd') {
        // Use original command system
        EvalCmd(data);
      }
    } catch (e) {
      console.error('Error parsing connection data:', e);
    }
  });

  socket.on('close', function() {
    console.log(`Socket ${socket.id} closed via 'close' event, calling onDisconnect...`);
    Player.onDisconnect(socket);
  });

  socket.onclose = function() {
    console.log(`Socket ${socket.id} closed via 'onclose', calling onDisconnect...`);
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

// Initialize SIMPLIFIED Serf behavior system - TEMPORARILY DISABLED for debugging
const SimpleSerfBehavior = require('./server/js/core/SimpleSerfBehavior.js');
global.simpleSerfBehavior = null; // DISABLED - let Entity.js handle everything
console.log('⚠️ SimpleSerfBehavior DISABLED - using Entity.js logic');

// Initialize optimized game loop
optimizedGameLoop.initialize(gameState, emit);

// Start the optimized game loop (60 FPS)
optimizedGameLoop.start();

// Performance monitoring - log memory usage every 30 seconds
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`Memory usage: RSS=${Math.round(memUsage.rss/1024/1024)}MB, Heap=${Math.round(memUsage.heapUsed/1024/1024)}MB, PathCache=${pathCache.size} entries`);
  
  // Cleanup expired path cache entries
  pathCache.cleanup();
}, 30000);

// Keep old interval for init/remove packs (less frequent)
setInterval(function() {
  emit({ msg: 'init', pack: initPack });
  emit({ msg: 'remove', pack: removePack });

  // Temporarily disable spatial optimization to prevent lag spikes
  // if (global.spatialSystem) {
  //   // Only optimize every 30 seconds instead of every second
  //   if (Date.now() % 30000 < 2000) {
  //     global.spatialSystem.optimize();
  //   }
  //   // Only cleanup every 60 seconds instead of every second
  //   if (Date.now() % 60000 < 2000) {
  //     global.spatialSystem.cleanup();
  //   }
  // }

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

// Initiate day/night cycle
setInterval(dayNight, 3600000 / period);

// Initialize tempus properly before logging
tempus = gameState.tempus;
console.log('');
console.log(`Day ${day} (${period}x)`);
console.log('');
console.log(tempus);

// Spawn initial fauna
entropy();

// Hide relics
const rel1 = randomSpawnHF();
const cr1 = getLoc(rel1[0], rel1[1]);
Relic({ x: rel1[0], y: rel1[1], z: 0, qty: 1 });
console.log(`Relic hidden in the forest @ ${cr1.toString()}`);

const rel2 = randomSpawnU();
const cr2 = getLoc(rel2[0], rel2[1]);
Relic({ x: rel2[0], y: rel2[1], z: -1, qty: 1 });
console.log(`Relic hidden in the caves @ ${cr2.toString()}`);

const wsp = waterSpawns[Math.floor(Math.random() * waterSpawns.length)];
const rel3 = getCoords(wsp[0], wsp[1]);
Relic({ x: rel3[0], y: rel3[1], z: -3, qty: 1 });
console.log(`Relic hidden in the sea @ ${wsp.toString()}`);

// Create NPC factions (only if valid spawn found)
const brotherhoodHQ = factionSpawn(FACTION_IDS.BROTHERHOOD);
if (brotherhoodHQ) {
  Brotherhood({ id: FACTION_IDS.BROTHERHOOD, type: 'npc', name: 'Brotherhood', flag: '', hq: brotherhoodHQ, hostile: true });
}

const gothsHQ = factionSpawn(FACTION_IDS.GOTHS);
if (gothsHQ) {
  Goths({ id: FACTION_IDS.GOTHS, type: 'npc', name: 'Goths', flag: '', hq: gothsHQ, hostile: true });
}

const norsemenHQ = factionSpawn(FACTION_IDS.NORSEMEN);
if (norsemenHQ) {
  Norsemen({ id: FACTION_IDS.NORSEMEN, type: 'npc', name: 'Norsemen', flag: '', hq: norsemenHQ, hostile: true });
}

const franksHQ = factionSpawn(FACTION_IDS.FRANKS);
if (franksHQ) {
  Franks({ id: FACTION_IDS.FRANKS, type: 'npc', name: 'Franks', flag: '', hq: franksHQ, hostile: true });
}

const celtsHQ = factionSpawn(FACTION_IDS.CELTS);
if (celtsHQ) {
  Celts({ id: FACTION_IDS.CELTS, type: 'npc', name: 'Celts', flag: '', hq: celtsHQ, hostile: true });
}

const teutonsHQ = factionSpawn(FACTION_IDS.TEUTONS);
if (teutonsHQ) {
  Teutons({ id: FACTION_IDS.TEUTONS, type: 'npc', name: 'Teutons', flag: '', hq: teutonsHQ, hostile: true });
}

const outlawsHQ = factionSpawn(FACTION_IDS.OUTLAWS);
if (outlawsHQ) {
  Outlaws({ id: FACTION_IDS.OUTLAWS, type: 'npc', name: 'Outlaws', flag: '☠️', hq: outlawsHQ, hostile: true });
}

const mercenariesHQ = factionSpawn(FACTION_IDS.MERCENARIES);
if (mercenariesHQ) {
  Mercenaries({ id: FACTION_IDS.MERCENARIES, type: 'npc', name: 'Mercenaries', flag: '', hq: mercenariesHQ, hostile: true });
}

Kingdom({ id: 1, name: 'Papal States', flag: '🇻🇦' });

dailyTally();

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
  tileSize,
  mapSize
};
