# Tilemap System Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Z-Levels and Layers](#z-levels-and-layers)
3. [Tile Types by Level](#tile-types-by-level)
4. [Change Tracking System](#change-tracking-system)
5. [Types of Changes](#types-of-changes)
6. [Spawn Point Tracking](#spawn-point-tracking)
7. [Geographic Zone Subdivision](#geographic-zone-subdivision)
8. [Spatial Partitioning](#spatial-partitioning)
9. [Building Placement System](#building-placement-system)
10. [Faction HQ Placement](#faction-hq-placement)

---

## System Architecture

### Core Components

The tilemap system consists of three main components:

#### 1. TilemapSystem (`server/js/core/TilemapSystem.js`)
The core tilemap implementation that manages all tile data, pathfinding grids, spawn points, and spatial partitioning.

**Key Features:**
- **Sparse Storage**: Uses `Map` data structure for efficient storage of non-zero tiles only
- **Pathfinding Cache**: Caches generated pathfinding grids with version-based invalidation
- **Grid Versioning**: Tracks changes per layer to invalidate caches only when necessary
- **Spatial Partitioning**: 64x64 zone grid for efficient entity queries
- **Spawn Point Management**: Biome-based spawn point categorization and storage

**Data Structures:**
```javascript
{
  mapSize: number,                    // Map dimensions (typically 192-512)
  tiles: Map<string, number>,         // Sparse tile storage: "layer,x,y" -> value
  pathfindingCache: Map<string, Array>, // Cached pathfinding grids
  zones: Map<string, Set>,            // Spatial partitioning: "x,y" -> entity IDs
  spawnPoints: {                      // Biome-based spawn points
    overworld: Array<[x, y]>,
    underworld: Array<[x, y]>,
    water: Array<[x, y]>,
    heavyForest: Array<[x, y]>,
    mountains: Array<[x, y]>,
    caveEntrances: Array<[x, y]>
  },
  gridVersions: Map<number, number>,  // Layer -> version number
  currentVersion: number
}
```

#### 2. TilemapIntegration (`server/js/core/TilemapIntegration.js`)
Integration wrapper that provides a unified interface and handles migration from legacy systems.

**Responsibilities:**
- Initializes `TilemapSystem` from legacy world array format
- Integrates with `PathfindingSystem`
- Provides backward-compatible API
- Handles building placement queries
- Manages resource assessment for factions

**Initialization Flow:**
```javascript
// 1. Create integration instance
const tilemapIntegration = new TilemapIntegration();

// 2. Initialize from world array (migrated from genesis)
tilemapIntegration.initializeFromWorldArray(world, gameState.mapSize);

// 3. Register globally
global.tilemapSystem = tilemapIntegration;
```

#### 3. ZoneManager (`server/js/core/ZoneManager.js`)
Manages geographic zones and faction territories, separate from spatial partitioning zones.

**Zone Types:**
- **Geographic**: Named regions (forests, mountains, caves, etc.)
- **Faction Territory**: Core base territories for factions
- **Faction Outpost**: Secondary territories/colonies

**Data Structures:**
```javascript
{
  zones: Map<id, zone>,              // Zone ID -> zone object
  tileIndex: Map<string, Array>,    // "c,r" -> [zoneIds] (fast lookup)
  playerZones: Map<playerId, zoneId> // Player -> current zone
}
```

### Data Storage Architecture

**Legacy System:**
- 9 nested 2D arrays: `world[layer][row][col]`
- Dense storage (all tiles stored, even zeros)
- Memory intensive for large maps

**New System:**
- Sparse `Map` storage: only non-zero tiles stored
- Key format: `"layer,x,y"` → value
- Default value: `0` (returned for missing keys)
- Significant memory savings for sparse maps

**Migration:**
The `TilemapMigration` class handles conversion from legacy arrays to the new system, preserving all tile data and spawn points.

---

## Z-Levels and Layers

### Z-Level Constants

The game uses 7 distinct z-levels (vertical levels):

```javascript
const Z_LEVELS = {
  UNDERWATER: -3,    // Underwater navigation
  CELLAR: -2,        // Building basements
  UNDERWORLD: -1,    // Cave systems
  OVERWORLD: 0,       // Main world surface
  BUILDING_1: 1,     // Building ground floor
  BUILDING_2: 2,     // Building second floor
  SHIP: 3            // Ship decks
};
```

### Layer-to-Z-Level Mapping

The tilemap uses 9 layers that map to z-levels as follows:

| Layer | Z-Level | Purpose | Walkability Matrix |
|-------|---------|---------|-------------------|
| 0 | 0 (OVERWORLD) | Terrain, buildings, doors, roads | `matrixO` |
| 1 | -1 (UNDERWORLD) | Cave floor tiles | `matrixU` |
| 2 | -3 (UNDERWATER) | Underwater navigation | `matrixW` |
| 3 | 1 (BUILDING_1) | Building ground floor markers | `matrixB1` |
| 4 | 1 (BUILDING_1) | Building walls and floor tiles | `matrixB1` |
| 5 | 2 (BUILDING_2) | Building second floor tiles | `matrixB2` |
| 6 | 0 (OVERWORLD) | Overworld resource tracking | `matrixO` |
| 7 | -1 (UNDERWORLD) | Cave resource tracking | `matrixU` |
| 8 | -2 (CELLAR) | Building basement/cellar | `matrixB3` |

**Layer Mapping Code:**
```javascript
const layerToZ = {
  0: 0,    // Overworld
  1: -1,   // Underworld/Cave
  2: -3,   // Underwater
  3: 1,    // Building floor 1 (ground floor markers)
  4: 1,    // Building floor 1 tiles (actual floor tiles)
  5: 2,    // Building floor 2 (second floor tiles)
  6: 0,    // Resource layer 1 (overworld resources)
  7: -1,   // Resource layer 2 (cave resources)
  8: -2    // Cellar/Building basement
};
```

### Layer Purposes

**Layer 0 (Overworld Terrain)**
- Primary terrain layer (water, forest, grass, rocks, mountains)
- Building foundations and markers
- Doors and road tiles
- Farm states
- All overworld entities exist on this layer

**Layer 1 (Underworld/Cave)**
- Cave floor terrain (typically value 0 for walkable cave floor)
- Cave-specific features
- Cave resources tracked on layer 7

**Layer 2 (Underwater)**
- Water navigation layer
- Used for ship pathfinding
- All tiles walkable for underwater entities

**Layer 3 (Building Ground Markers)**
- Building identification markers (e.g., 'mill0', 'mill1', 'forge0')
- Used to identify which building occupies a tile
- String values for building part identification

**Layer 4 (Building Walls/Floor)**
- Building wall tiles (values 1-6 depending on wall type)
- Building floor tiles (value 1 for floor, 2-4 for stairs)
- Stairs: 3-4 (upstairs), 5-6 (downstairs)

**Layer 5 (Building Upper Floors)**
- Second floor tiles for multi-story buildings
- Building identifiers (e.g., 'mill4', 'mill5', 'garrison2')
- Upper floor markers

**Layer 6 (Overworld Resources)**
- Resource tracking for overworld (wood, stone, fish)
- Incremental values (depleted when reaches 0)
- Used for resource gathering mechanics

**Layer 7 (Cave Resources)**
- Resource tracking for caves (ore, gems)
- Incremental values similar to layer 6
- Cave-specific resources

**Layer 8 (Cellar)**
- Building basement/cellar level
- Separate z-level from main building floors
- Uses `matrixB3` for walkability

---

## Tile Types by Level

### Layer 0 (Overworld, z=0) - Terrain Types

**TERRAIN Constants:**
```javascript
const TERRAIN = {
  WATER: 0,
  HEAVY_FOREST: 1,
  LIGHT_FOREST: 2,
  BRUSH: 3,
  ROCKS: 4,
  MOUNTAIN: 5,
  CAVE_ENTRANCE: 6,
  EMPTY: 7,              // Grass/clear terrain
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
```

**Terrain Type Details:**

| Value | Name | Description | Walkable | Buildable |
|-------|------|-------------|----------|-----------|
| 0 | WATER | Water tiles (lakes, rivers) | No (ships only) | No |
| 1 | HEAVY_FOREST | Dense forest | Yes | Limited |
| 2 | LIGHT_FOREST | Light forest | Yes | Yes (with clearing) |
| 3 | BRUSH | Brush/scrubland | Yes | Yes (with clearing) |
| 4 | ROCKS | Rock formations | Yes | Limited |
| 5 | MOUNTAIN | Mountain terrain | Yes | Limited (mines only) |
| 6 | CAVE_ENTRANCE | Cave entrance | Yes | No |
| 7 | EMPTY | Grass/clear terrain | Yes | Yes |
| 8 | FARM_SEED | Farm plot (seeded) | Yes | No |
| 9 | FARM_GROWING | Farm plot (growing) | Yes | No |
| 10 | FARM_READY | Farm plot (ready to harvest) | Yes | No |
| 11 | BUILD_MARKER | Building foundation marker | No | No |
| 11.5 | BUILD_MARKER_ALT | Alternative building marker | No | No |
| 13 | BUILDING_FLOOR | Completed building floor | Yes | No |
| 14 | DOOR_OPEN | Open door | Yes | No |
| 15 | BUILDING_WALL | Building wall tile | No | No |
| 16 | DOOR_OPEN_ALT | Alternative open door | Yes | No |
| 18 | ROAD | Road tile | Yes | No |
| 19 | DOOR_LOCKED | Locked door | No | No |

**Special Tile Ranges:**
- **11-20.5**: Building-related tiles (foundations, walls, doors)
- **8-10**: Farm state progression
- **0**: Water (special handling for ships and pathfinding)

### Layer 1 (Underworld, z=-1) - Cave Tiles

**Cave Floor:**
- Value `0`: Walkable cave floor (most common)
- Other values may represent cave-specific features

**Cave Resources (Layer 7):**
- Ore deposits (incremental values)
- Gem deposits
- Cave-specific resources

### Layer 2 (Underwater, z=-3) - Water Navigation

- All tiles are water (value `0`)
- Used exclusively for underwater/ship navigation
- All tiles walkable for underwater entities
- Uses `matrixW` walkability matrix (all walkable)

### Layer 3 (Building Ground Markers, z=1)

**Building Identification:**
- String values identifying building parts
- Format: `'buildingType' + index` (e.g., 'mill0', 'mill1', 'forge0')
- Used to determine which building occupies a tile
- Examples:
  - `'mill0'`, `'mill1'`, `'mill2'`, `'mill3'` - Mill plot tiles
  - `'forge0'`, `'forge1'`, `'forge2'`, `'forge3'` - Forge plot tiles
  - `'lumbermill0'`, `'lumbermill1'` - Lumbermill plot tiles

### Layer 4 (Building Walls/Floor, z=1)

**Wall Tiles:**
- Value `1`: Standard wall
- Value `2`: Wall variant
- Value `3`: Upstairs stairs (z=1 to z=2)
- Value `4`: Upstairs stairs variant
- Value `5`: Downstairs stairs (z=2 to z=1)
- Value `6`: Cellar stairs (z=1 to z=-2)

**Floor Tiles:**
- Value `1`: Building floor tile
- Values `2-4`: Stair tiles (see above)

### Layer 5 (Building Upper Floors, z=2)

**Second Floor Tiles:**
- Building identifiers for upper floors (e.g., 'mill4', 'mill5')
- Building-specific markers
- Upper floor layout markers

### Layer 6 (Overworld Resources, z=0)

**Resource Tracking:**
- Incremental values representing resource amounts
- **Wood**: Typically values 50-100 (depleted when reaches 0)
- **Stone**: Typically values 50-100
- **Fish**: Water-based resources
- Decremented during resource gathering
- Incremented during resource regeneration

**Resource Depletion:**
```javascript
// Example: Cutting down a tree
tileChange(6, x, y, -50, true); // Decrement by 50
if (resourceValue <= 0) {
  // Convert terrain (e.g., heavy forest to light forest)
  tileChange(0, x, y, TERRAIN.LIGHT_FOREST);
}
```

### Layer 7 (Cave Resources, z=-1)

**Cave Resource Tracking:**
- Similar to layer 6 but for cave resources
- Ore deposits
- Gem deposits
- Cave-specific materials

### Layer 8 (Cellar, z=-2)

**Cellar Tiles:**
- Building basement level
- Separate from main building floors
- Uses `matrixB3` for walkability
- Typically value `0` for walkable cellar floor

---

## Change Tracking System

### Core Change Functions

#### 1. `tileChange(layer, col, row, value, increment = false)`
**Location:** `lambic.js:834`

Primary function for modifying tiles. Handles validation, tilemap updates, world array synchronization, and client notifications.

**Parameters:**
- `layer` (number): Layer index (0-8)
- `col` (number): Column (x coordinate)
- `row` (number): Row (y coordinate)
- `value` (number): New value or increment amount
- `increment` (boolean): If true, adds value to current; if false, sets value

**Implementation:**
```javascript
function tileChange(l, c, r, n, incr = false) {
  // Validate inputs
  if (typeof l !== 'number' || typeof c !== 'number' || typeof r !== 'number') {
    return;
  }
  
  if (c < 0 || c >= mapSize || r < 0 || r >= mapSize) {
    return;
  }
  
  // Update tilemap system
  global.tilemapSystem.updateTile(l, c, r, n, incr);
  
  // Sync with legacy world array
  const newTileValue = global.tilemapSystem.getTile(l, c, r);
  if (!world[l]) world[l] = [];
  if (!world[l][r]) world[l][r] = [];
  world[l][r][c] = newTileValue;
  
  // Emit to all clients
  emit({ msg: 'tileEdit', l, c, r, tile: newTileValue });
}
```

**Features:**
- Input validation (bounds checking)
- Automatic client synchronization via `emit()`
- Legacy world array synchronization
- Error handling

#### 2. `setTile(layer, x, y, data)`
**Location:** `TilemapSystem.js:49`

Core tilemap method for setting tile values. Handles cache invalidation and zone updates.

**Implementation:**
```javascript
setTile(layer, x, y, data) {
  const key = this.getTileKey(layer, x, y);
  const oldData = this.tiles.get(key);
  
  // Only invalidate cache if tile actually changed
  if (oldData !== data) {
    this.tiles.set(key, data);
    
    // Update zones if this is an entity layer
    if (layer === 0) { // Overworld layer
      this.updateZone(x, y, data);
    }
    
    // Increment grid version for this layer
    this.gridVersions.set(layer, (this.gridVersions.get(layer) || 0) + 1);
    
    // Invalidate pathfinding cache for this layer
    this.invalidatePathfindingCache(layer);
  }
}
```

**Features:**
- Change detection (only updates if value changed)
- Automatic zone updates for overworld layer
- Grid versioning for cache management
- Pathfinding cache invalidation

#### 3. `updateTile(layer, x, y, value, increment = false)`
**Location:** `TilemapSystem.js:77`

Wrapper around `setTile` that supports increment operations.

**Implementation:**
```javascript
updateTile(layer, x, y, value, increment = false) {
  const current = this.getTile(layer, x, y);
  const newValue = increment ? current + value : value;
  this.setTile(layer, x, y, newValue);
  return newValue;
}
```

**Usage Examples:**
```javascript
// Set absolute value
tilemapSystem.updateTile(0, 10, 20, 7); // Set to EMPTY (grass)

// Increment value
tilemapSystem.updateTile(6, 10, 20, -50, true); // Decrement resource by 50
```

### Grid Versioning System

**Purpose:** Track changes per layer to invalidate pathfinding caches only when necessary.

**Implementation:**
```javascript
// Grid versioning for cache invalidation
this.gridVersions = new Map(); // layer -> version number
this.currentVersion = 0;

// On tile change:
this.gridVersions.set(layer, (this.gridVersions.get(layer) || 0) + 1);
```

**Cache Key Generation:**
```javascript
generateGridCacheKey(layer, options = {}) {
  let key = `${layer}`;
  // ... add options to key ...
  
  // Add grid version to ensure cache is invalidated when tiles change
  const version = this.gridVersions.get(layer) || 0;
  key += `_v${version}`;
  
  return key;
}
```

**Benefits:**
- Prevents stale cache usage
- Only regenerates grids when tiles actually change
- Version-based cache invalidation (automatic on version mismatch)

### Pathfinding Cache Invalidation

**Automatic Invalidation:**
- Triggered on every `setTile()` call
- Layer-specific invalidation (only affected layer)
- Version-based cache keys ensure stale data isn't used

**Manual Invalidation:**
```javascript
// Invalidate specific layer
tilemapSystem.invalidatePathfindingCache(layer);

// Invalidate all layers
tilemapSystem.invalidatePathfindingCache(null);
```

**Cache Management:**
- Maximum cache size: 50 grids
- LRU eviction (removes oldest when limit reached)
- Pre-generated grids for common layers (0, 1)

### Client Synchronization

**Automatic Updates:**
Every tile change automatically emits to all connected clients:

```javascript
emit({ msg: 'tileEdit', l, c, r, tile: newTileValue });
```

**Full Layer Updates:**
```javascript
// Emit entire layer
emit({ msg: 'layerEdit', l, layer: layer });
```

**Full Map Updates:**
```javascript
// Emit entire world
emit({ msg: 'mapEdit', world: worldArray });
```

---

## Types of Changes

### 1. Terrain Modifications

#### Clearing Terrain
**Purpose:** Remove vegetation/obstacles for building or farming.

**Examples:**
```javascript
// Clear brush to grass
tileChange(0, x, y, TERRAIN.EMPTY);

// Clear light forest to grass
tileChange(0, x, y, TERRAIN.EMPTY);

// Clear heavy forest (requires resource gathering first)
tileChange(0, x, y, TERRAIN.LIGHT_FOREST); // After wood gathered
```

#### Terrain Conversion
**Purpose:** Natural terrain changes (forest growth, erosion, etc.).

**Examples:**
```javascript
// Heavy forest to light forest (after logging)
tileChange(0, x, y, TERRAIN.LIGHT_FOREST);

// Light forest to brush (degradation)
tileChange(0, x, y, TERRAIN.BRUSH);

// Brush to grass (clearing)
tileChange(0, x, y, TERRAIN.EMPTY);
```

### 2. Building Construction

#### Foundation Placement
**Purpose:** Mark building plot before construction.

**Layers Affected:**
- Layer 0: Foundation markers (11 or 11.5)
- Layer 6: Construction progress cleared to 0

**Example:**
```javascript
// Place foundation marker
tileChange(0, plot[i][0], plot[i][1], TERRAIN.BUILD_MARKER);
tileChange(6, plot[i][0], plot[i][1], 0); // Clear construction progress
```

#### Building Completion
**Purpose:** Finalize building construction.

**Layers Affected:**
- Layer 0: Terrain updated to building floor (13) or door (14/16)
- Layer 3: Building ground markers (e.g., 'mill0', 'mill1')
- Layer 4: Wall tiles (if applicable)
- Layer 5: Upper floor tiles (if applicable)

**Example (Mill):**
```javascript
// Plot tiles
tileChange(0, plot[i][0], plot[i][1], 13); // Building floor
tileChange(3, plot[i][0], plot[i][1], 'mill' + i); // Building marker

// Upper floor
tileChange(5, topPlot[0][0], topPlot[0][1], 'mill4');
tileChange(5, topPlot[1][0], topPlot[1][1], 'mill5');
```

#### Door Placement
**Purpose:** Add doors to buildings.

**Types:**
- Open door: 14 or 16
- Locked door: 19

**Example:**
```javascript
// Open door
tileChange(0, entrance[0], entrance[1], TERRAIN.DOOR_OPEN);

// Alternative open door
tileChange(0, entrance[0], entrance[1], TERRAIN.DOOR_OPEN_ALT);

// Locked door
tileChange(0, entrance[0], entrance[1], TERRAIN.DOOR_LOCKED);
```

### 3. Resource Depletion/Increment

#### Resource Gathering
**Purpose:** Track resource amounts and depletion.

**Layer 6 (Overworld Resources):**
```javascript
// Decrement wood resource
tileChange(6, x, y, -50, true); // Decrement by 50

// Check if depleted
const resourceValue = getTile(6, x, y);
if (resourceValue <= 0) {
  // Convert terrain (e.g., heavy forest to light forest)
  tileChange(0, x, y, TERRAIN.LIGHT_FOREST);
}
```

**Layer 7 (Cave Resources):**
```javascript
// Decrement ore resource
tileChange(7, x, y, -1, true); // Decrement by 1
```

#### Resource Regeneration
**Purpose:** Restore resources over time.

**Examples:**
```javascript
// Regenerate wood
tileChange(6, x, y, 25, true); // Increment by 25

// Regenerate stone
tileChange(6, x, y, 50, true); // Increment by 50
```

### 4. Farm State Progression

**Purpose:** Track farm plot growth stages.

**States:**
1. **FARM_SEED (8)**: Plot seeded, waiting to grow
2. **FARM_GROWING (9)**: Crop growing
3. **FARM_READY (10)**: Ready to harvest

**Progression:**
```javascript
// Plant seed
tileChange(0, plot[i][0], plot[i][1], TERRAIN.FARM_SEED);
tileChange(6, plot[i][0], plot[i][1], 0); // Clear resource layer

// Growth stage
tileChange(0, plot[i][0], plot[i][1], TERRAIN.FARM_GROWING);

// Ready to harvest
tileChange(0, plot[i][0], plot[i][1], TERRAIN.FARM_READY);
tileChange(6, plot[i][0], plot[i][1], 25); // Resource value

// After harvest
tileChange(0, plot[i][0], plot[i][1], TERRAIN.FARM_SEED); // Replant
tileChange(6, plot[i][0], plot[i][1], 0); // Clear resource
```

### 5. Road Construction

**Purpose:** Create road networks.

**Example:**
```javascript
tileChange(0, x, y, TERRAIN.ROAD);
```

### 6. Building Destruction

**Purpose:** Remove buildings and restore terrain.

**Process:**
1. Clear building markers (layer 3)
2. Clear walls (layer 4)
3. Clear upper floors (layer 5)
4. Restore terrain (layer 0)

**Example:**
```javascript
// Clear building markers
tileChange(3, plot[i][0], plot[i][1], 0);

// Clear walls
tileChange(4, wall[i][0], wall[i][1], 0);

// Clear upper floor
tileChange(5, topPlot[i][0], topPlot[i][1], 0);

// Restore terrain
tileChange(0, plot[i][0], plot[i][1], TERRAIN.EMPTY);
```

---

## Spawn Point Tracking

### Biome Categories

The spawn point system categorizes spawn locations by biome type:

```javascript
spawnPoints = {
  overworld: [],        // All non-water overworld tiles
  underworld: [],      // All walkable cave tiles
  water: [],           // All water tiles
  heavyForest: [],      // Heavy forest tiles (value 1)
  mountains: [],        // Mountain tiles (value 5)
  caveEntrances: []     // Cave entrance tiles (value 6)
}
```

### Spawn Point Storage

**Location:** `TilemapSystem.spawnPoints`

**Data Structure:**
- Each category is an array of `[x, y]` coordinate pairs
- Populated during world generation/migration
- Used for entity spawning and faction placement

### Spawn Point Population

**During Migration:**
```javascript
migrateSpawnPoints(tilemapSystem, worldArray, mapSize) {
  for (let x = 0; x < mapSize; x++) {
    for (let y = 0; y < mapSize; y++) {
      const tile = worldArray[0] && worldArray[0][y] ? worldArray[0][y][x] : 0;
      const uTile = worldArray[1] && worldArray[1][y] ? worldArray[1][y][x] : 0;
      
      // Overworld spawn points
      if (tile !== 0) { // Not water
        tilemapSystem.addSpawnPoint('overworld', x, y);
        
        // Biome-specific spawn points
        if (tile >= 1 && tile < 2) { // Heavy forest
          tilemapSystem.addSpawnPoint('heavyForest', x, y);
        } else if (tile >= 5 && tile < 6) { // Mountain
          tilemapSystem.addSpawnPoint('mountains', x, y);
        } else if (tile === 6) { // Cave entrance
          tilemapSystem.addSpawnPoint('caveEntrances', x, y);
        }
      } else {
        // Water spawn points
        tilemapSystem.addSpawnPoint('water', x, y);
      }
      
      // Underworld spawn points
      if (uTile === 0) {
        tilemapSystem.addSpawnPoint('underworld', x, y);
      }
    }
  }
}
```

### Spawn Point Access

**Methods:**
```javascript
// Get spawn points for a biome
const spawns = tilemapSystem.getSpawnPoints('overworld');

// Add spawn point
tilemapSystem.addSpawnPoint('heavyForest', x, y);
```

### Zone-Based Spawn Filtering

**Purpose:** Filter spawn points to only include tiles in named geographic zones.

**Implementation:**
```javascript
// Filter spawn points to only include tiles in named geographic zones
if (global.zoneManager) {
  const filteredSpawns = spawnPoints.filter(point => {
    const zone = global.zoneManager.getZoneAt([point[0], point[1]]);
    // Only allow spawns in named geographic zones
    return zone && zone.type === 'geographic' && zone.name;
  });
}
```

**Benefits:**
- Prevents spawning in unnamed/uninteresting areas
- Ensures spawns occur in meaningful locations
- Supports zone-based gameplay mechanics

### Legacy System Integration

**Backward Compatibility:**
```javascript
// Legacy global variables (populated from tilemap system)
spawnPointsO = global.tilemapSystem.getSpawnPoints('overworld');
spawnPointsU = global.tilemapSystem.getSpawnPoints('underworld');
waterSpawns = global.tilemapSystem.getSpawnPoints('water');
hForestSpawns = global.tilemapSystem.getSpawnPoints('heavyForest');
mtnSpawns = global.tilemapSystem.getSpawnPoints('mountains');
caveEntrances = global.tilemapSystem.getSpawnPoints('caveEntrances');
```

---

## Geographic Zone Subdivision

### ZoneManager Architecture

**Location:** `server/js/core/ZoneManager.js`

**Purpose:** Manage named geographic zones and faction territories, separate from spatial partitioning zones.

### Zone Types

#### 1. Geographic Zones
**Purpose:** Named regions of the world (forests, mountains, caves, etc.)

**Properties:**
```javascript
{
  id: string,              // Unique zone identifier
  type: 'geographic',       // Zone type
  subtype: string,          // Feature type (forest, mountain, cave, etc.)
  name: string,             // Display name (e.g., "Darkwood Forest")
  tiles: Set<string>,       // Set of "c,r" tile keys
  tileArray: Array<[c, r]>, // Array of [column, row] coordinates
  center: [c, r],           // Zone center coordinates
  bounds: {minC, maxC, minR, maxR}, // Bounding box
  size: number,             // Number of tiles
  faction: null,            // No faction (geographic only)
  isOutpost: false          // Not an outpost
}
```

#### 2. Faction Territory Zones
**Purpose:** Core base territories for factions.

**Properties:**
```javascript
{
  id: string,
  type: 'faction_territory',
  name: string,             // Faction name + " Territory"
  tiles: Set<string>,
  tileArray: Array<[c, r]>,
  center: [c, r],
  bounds: {...},
  size: number,
  faction: string,          // Faction name
  isOutpost: false
}
```

#### 3. Faction Outpost Zones
**Purpose:** Secondary territories/colonies for factions.

**Properties:**
```javascript
{
  id: string,
  type: 'faction_outpost',
  name: string,             // Faction name + " Outpost"
  tiles: Set<string>,
  tileArray: Array<[c, r]>,
  center: [c, r],
  bounds: {...},
  size: number,
  faction: string,
  isOutpost: true
}
```

### Tile Indexing System

**Purpose:** Fast lookup of zones at specific tile coordinates.

**Data Structure:**
```javascript
tileIndex: Map<string, Array>  // "c,r" -> [zoneIds]
```

**Lookup Process:**
```javascript
getZoneAt(tile) {
  const key = `${tile[0]},${tile[1]}`;
  const zoneIds = this.tileIndex.get(key) || [];
  
  if (zoneIds.length === 0) return null;
  
  // Prioritize: faction territory > faction outpost > geographic feature
  for (const zoneId of zoneIds) {
    const zone = this.zones.get(zoneId);
    if (zone.type === 'faction_territory') return zone;
  }
  
  for (const zoneId of zoneIds) {
    const zone = this.zones.get(zoneId);
    if (zone.type === 'faction_outpost') return zone;
  }
  
  // Return first geographic feature
  return this.zones.get(zoneIds[0]);
}
```

**Benefits:**
- O(1) lookup time for zone at tile
- Supports multiple zones per tile (with priority)
- Efficient spatial queries

### Zone Properties

#### Center
- Calculated as centroid of all tiles in zone
- Used for distance calculations and zone placement

#### Bounds
- Minimum and maximum column/row coordinates
- Used for bounding box checks and zone overlap detection

#### Size
- Number of tiles in zone
- Used for zone importance and resource calculations

#### Tile Array
- Array of `[column, row]` coordinate pairs
- Used for zone rendering and tile iteration
- Also stored as `Set<string>` for fast membership checks

### Player Zone Tracking

**Purpose:** Track which zone each player is currently in.

**Data Structure:**
```javascript
playerZones: Map<playerId, zoneId>
```

**Zone Transition Detection:**
```javascript
checkPlayerZoneTransition(playerId, tile) {
  const newZone = this.getZoneAt(tile);
  const currentZoneId = this.playerZones.get(playerId);
  
  if (newZone && newZone.id !== currentZoneId) {
    // Player entered a new zone
    this.playerZones.set(playerId, newZone.id);
    return {
      entered: newZone,
      exited: currentZoneId ? this.zones.get(currentZoneId) : null
    };
  }
  
  return null;
}
```

**Usage:**
- Triggers zone entry events
- Sends zone notifications to players
- Tracks player location for gameplay mechanics

### Adjacent Zone Detection

**Purpose:** Find zones adjacent to a given zone.

**Implementation:**
```javascript
getAdjacentZones(zoneId, maxDistance = 30) {
  const targetZone = this.zones.get(zoneId);
  if (!targetZone) return [];
  
  const adjacentZones = [];
  const targetCenter = targetZone.center;
  
  for (const [id, zone] of this.zones) {
    if (id === zoneId) continue; // Skip self
    
    const distance = this.getDistance(targetCenter, zone.center);
    if (distance <= maxDistance) {
      adjacentZones.push(zone);
    }
  }
  
  return adjacentZones;
}
```

**Use Cases:**
- Faction expansion planning
- Zone-based AI decisions
- Territory adjacency checks

### Zone Resource Analysis

**Purpose:** Analyze resource types available in a zone.

**Implementation:**
```javascript
getZoneResourceTypes(zone) {
  const resources = {
    forest: 0,
    rocks: 0,
    farmland: 0,
    caves: 0,
    water: 0
  };
  
  for (const [c, r] of zone.tileArray) {
    const terrain = global.getTile(0, c, r);
    
    // Count terrain types
    if (terrain === 1 || terrain === 2) resources.forest++;
    if (terrain === 4) resources.rocks++;
    if (terrain === 7 || terrain === 3) resources.farmland++;
    if (terrain === 6) resources.caves++;
    if (terrain === 0) resources.water++;
  }
  
  return resources;
}
```

**Use Cases:**
- Faction placement decisions
- Resource assessment
- Zone value calculation

---

## Spatial Partitioning

### Zone Grid System

**Purpose:** Efficient entity queries and spatial partitioning, separate from geographic zones.

**Grid Dimensions:**
- Fixed 64x64 grid regardless of map size
- Zone size: `Math.ceil(mapSize / 64)` tiles per zone

**Initialization:**
```javascript
initializeZones() {
  const zoneSize = Math.ceil(this.mapSize / 64);
  for (let x = 0; x < 64; x++) {
    for (let y = 0; y < 64; y++) {
      this.zones.set(`${x},${y}`, new Set());
    }
  }
}
```

### Entity-to-Zone Assignment

**Zone Calculation:**
```javascript
updateZone(x, y, tileData) {
  const zoneX = Math.floor(x / 8);
  const zoneY = Math.floor(y / 8);
  const zoneKey = `${zoneX},${zoneY}`;
  
  if (this.zones.has(zoneKey)) {
    this.zones.get(zoneKey).add(`${x},${y}`);
  }
}
```

**Entity Tracking:**
- Entities track their current zone: `entity.zone = [zoneX, zoneY]`
- Zone changes trigger zone entry/exit checks
- Entities added to zone Set on zone entry

### Zone-Based Queries

**Get Entities in Zone:**
```javascript
getEntitiesInZone(zoneX, zoneY) {
  const zoneKey = `${zoneX},${zoneY}`;
  return this.zones.get(zoneKey) || new Set();
}
```

**Zone Check Function:**
```javascript
entity.zoneCheck = function() {
  const loc = getLoc(this.x, this.y);
  const zc = Math.floor(loc[0] / 8);
  const zr = Math.floor(loc[1] / 8);
  
  if (this.zone === null || this.zone[0] !== zc || this.zone[1] !== zr) {
    // Zone changed
    const oldZoneKey = `${this.zone[0]},${this.zone[1]}`;
    if (zones.has(oldZoneKey)) {
      zones.get(oldZoneKey).delete(this.id);
    }
    
    const newZoneKey = `${zc},${zr}`;
    if (!zones.has(newZoneKey)) {
      zones.set(newZoneKey, new Set());
    }
    zones.get(newZoneKey).add(this.id);
    this.zone = [zc, zr];
  }
};
```

### Performance Optimizations

**Benefits:**
1. **Reduced Iteration**: Only check entities in relevant zones
2. **Spatial Queries**: Fast lookup of nearby entities
3. **Collision Detection**: Efficient entity-entity collision checks
4. **AI Queries**: NPCs can quickly find targets in their zone

**Example Usage:**
```javascript
// Find all entities in a zone
const zoneEntities = getEntitiesInZone(zoneX, zoneY);

// Check collisions only with entities in same/adjacent zones
const nearbyZones = [
  [zoneX - 1, zoneY - 1], [zoneX, zoneY - 1], [zoneX + 1, zoneY - 1],
  [zoneX - 1, zoneY],     [zoneX, zoneY],     [zoneX + 1, zoneY],
  [zoneX - 1, zoneY + 1], [zoneX, zoneY + 1], [zoneX + 1, zoneY + 1]
];

for (const [nx, ny] of nearbyZones) {
  const entities = getEntitiesInZone(nx, ny);
  // Process entities...
}
```

### Zone Update on Tile Changes

**Automatic Updates:**
- Overworld layer (layer 0) changes automatically update zones
- Triggered in `setTile()` method
- Maintains spatial partitioning accuracy

---

## Building Placement System

### Building Requirements

**Location:** `TilemapSystem.getBuildingRequirements()`

**Building Types and Requirements:**

#### Tier I Buildings

**Farm:**
```javascript
{
  plotSize: [3, 3],                    // 3x3 plot
  wallTiles: 0,                         // No walls
  validTerrain: [TERRAIN.EMPTY],       // Grass only
  clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
  clearanceRadius: 0,                  // No clearance needed
  excludeBuildings: true,
  hasUpperFloor: false,
  requiresNearby: { buildingType: 'mill', maxDistance: 384 }
}
```

**Lumbermill:**
```javascript
{
  plotSize: [2, 1],                    // 2x1 horizontal
  wallTiles: 2,
  topPlot: [[0,-1],[1,-1]],           // Upper floor
  validTerrain: [TERRAIN.EMPTY],
  clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
  hasUpperFloor: true,
  nearForest: true                     // Prefer forest proximity
}
```

**Mine:**
```javascript
{
  plotSize: [2, 2],                    // 2x2
  wallTiles: 0,
  validTerrain: [TERRAIN.EMPTY, TERRAIN.ROCKS, TERRAIN.MOUNTAIN],
  clearableTiles: [TERRAIN.BRUSH, TERRAIN.LIGHT_FOREST],
  hasUpperFloor: false
}
```

#### Tier II Buildings

**Market:**
```javascript
{
  plotSize: [4, 3],
  wallTiles: 5,
  validTerrain: [TERRAIN.EMPTY, TERRAIN.ROAD],
  clearanceRadius: 1,
  hasUpperFloor: false
}
```

**Forge:**
```javascript
{
  plotSize: [3, 2],
  wallTiles: 3,
  validTerrain: [TERRAIN.EMPTY, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
  clearanceRadius: 1,
  hasUpperFloor: true
}
```

**Garrison:**
```javascript
{
  plotSize: [4, 3],
  wallTiles: 4,
  validTerrain: [TERRAIN.EMPTY, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
  clearanceRadius: 1,
  hasUpperFloor: true
}
```

### Plot Generation

**Algorithm:**
```javascript
generatePlot(centerTile, size) {
  const [width, height] = size;
  const plot = [];
  const c = centerTile[0];
  const r = centerTile[1];
  
  // Generate rectangular plot
  // Pattern: BOTTOM row first (r), then top rows (r-1, r-2, etc.)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      plot.push([c + col, r - row]);
    }
  }
  
  return plot;
}
```

**Pattern:**
- Bottom row generated first (row 0)
- Subsequent rows generated upward (negative row offset)
- Matches visual rendering order for building tiles

### Wall Generation

**Algorithm:**
```javascript
generateWalls(plot, wallCount) {
  if (wallCount === 0 || plot.length === 0) return [];
  
  // Find top row Y-coordinate
  const minRow = Math.min(...plot.map(t => t[1]));
  const topRowTiles = plot.filter(p => p[1] === minRow);
  
  // Generate walls one row above the top plot row
  const walls = [];
  for (let i = 0; i < Math.min(wallCount, topRowTiles.length); i++) {
    walls.push([topRowTiles[i][0], topRowTiles[i][1] - 1]);
  }
  
  return walls;
}
```

**Special Cases:**
- 2x1 buildings (lumbermill): Walls placed directly above plot
- 2x2 buildings: Walls use top row
- Market (4x3 with 5 walls): Back wall with additional corner wall

### Top Plot Generation

**Algorithm:**
```javascript
generateTopPlot(plot, walls) {
  if (walls.length === 0) return [];
  
  // For mills/lumbermills (2 walls): top plot is wall tiles
  if (walls.length === 2) {
    return walls;
  }
  
  // For garrison (4 walls): topPlot is walls[1,2,3] (skipping first wall)
  if (walls.length === 4) {
    return [walls[1], walls[2], walls[3]];
  }
  
  return [];
}
```

### Building Placement Validation

**Can Place Building Check:**
```javascript
canPlaceBuilding(tile, requirements, buildingType) {
  const plot = this.generatePlot(tile, requirements.plotSize);
  const perimeter = requirements.clearanceRadius > 0 ? 
    this.generatePerimeter(plot, requirements.clearanceRadius) : [];
  
  // 1. Check plot is within map bounds
  for (const plotTile of plot) {
    if (plotTile[0] < 0 || plotTile[0] >= this.mapSize ||
        plotTile[1] < 0 || plotTile[1] >= this.mapSize) {
      return false;
    }
  }
  
  // 2. Check plot tiles are valid terrain AND walkable
  for (const plotTile of plot) {
    const terrain = this.getTile(0, plotTile[0], plotTile[1]);
    const terrainFloor = Math.floor(terrain);
    if (!requirements.validTerrain.includes(terrainFloor)) {
      return false;
    }
    
    if (!global.isWalkable(0, plotTile[0], plotTile[1])) {
      return false;
    }
  }
  
  // 3. Check for building overlaps
  if (requirements.excludeBuildings) {
    for (const checkTile of [...plot, ...perimeter]) {
      const layer3 = this.getTile(3, checkTile[0], checkTile[1]);
      const layer5 = this.getTile(5, checkTile[0], checkTile[1]);
      
      if (layer3 !== 0 || layer5 !== 0) {
        return false;
      }
    }
  }
  
  // 4. Check if building requires nearby structures
  if (requirements.requiresNearby) {
    // Check for required building within maxDistance
    // ...
  }
  
  return true;
}
```

### Building Spot Scoring

**Scoring Factors:**
1. **Base Score**: 100 points
2. **Terrain Preference**: Bonus for preferred terrain types
3. **Open Space**: Bonus for wide open areas (mills)
4. **Forest Proximity**: Bonus for nearby forest (lumbermills)
5. **Required Building Proximity**: Bonus for closeness to required buildings
6. **Random Variation**: Small random factor to prevent clustering

**Example:**
```javascript
scoreBuildingSpot(tile, requirements, buildingType) {
  let score = 100; // Base score
  
  // Terrain preference for huts
  if (buildingType.includes('hut')) {
    const plotTerrain = this.getTile(0, tile[0], tile[1]);
    if (plotTerrain === 7) { // GRASS
      score += 20;
    } else if (plotTerrain === 2) { // LIGHT_FOREST
      score += 10;
    }
  }
  
  // Bonus for wide open grass areas (mills)
  if (requirements.preferOpenGrass) {
    let grassCount = 0;
    const searchArea = global.getArea(tile, tile, 5);
    for (const t of searchArea) {
      const terrain = this.getTile(0, t[0], t[1]);
      if (terrain === 7) { // GRASS
        grassCount++;
      }
    }
    score += grassCount * 2;
  }
  
  // Bonus for being near forest (lumbermills)
  if (requirements.nearForest) {
    let forestCount = 0;
    const searchArea = global.getArea(tile, tile, 2);
    for (const t of searchArea) {
      const terrain = this.getTile(0, t[0], t[1]);
      if (terrain === 1 || terrain === 2) {
        forestCount++;
      }
    }
    score += forestCount * 2;
  }
  
  score += Math.random() * 10; // Random variation
  
  return score;
}
```

### Finding Building Spots

**Single Spot:**
```javascript
findBuildingSpot(buildingType, centerTile, searchRadius, customRequirements = {}) {
  const requirements = this.getBuildingRequirements();
  const baseReqs = requirements[buildingType];
  const reqs = { ...baseReqs, ...customRequirements };
  
  const searchArea = global.getArea(centerTile, centerTile, searchRadius);
  const validSpots = [];
  
  for (const tile of searchArea) {
    if (this.canPlaceBuilding(tile, reqs, buildingType)) {
      const plot = this.generatePlot(tile, reqs.plotSize);
      const walls = reqs.wallTiles > 0 ? this.generateWalls(plot, reqs.wallTiles) : [];
      const topPlot = reqs.hasUpperFloor && walls.length > 0 ? 
        this.generateTopPlot(plot, walls) : [];
      
      validSpots.push({
        tile: tile,
        plot: plot,
        walls: walls,
        topPlot: topPlot,
        score: this.scoreBuildingSpot(tile, reqs, buildingType)
      });
    }
  }
  
  validSpots.sort((a, b) => b.score - a.score);
  return validSpots.length > 0 ? validSpots[0] : null;
}
```

**Multiple Spots:**
```javascript
findMultipleBuildingSpots(buildingType, centerTile, searchRadius, count, customRequirements = {}) {
  // Similar to single spot, but tracks occupied tiles to prevent overlap
  const occupiedTiles = new Set(reqs.excludeTiles || []);
  
  for (const tile of searchArea) {
    const tileKey = `${tile[0]},${tile[1]}`;
    if (occupiedTiles.has(tileKey)) continue;
    
    if (this.canPlaceBuilding(tile, { ...reqs, excludeTiles: Array.from(occupiedTiles) }, buildingType)) {
      // ... add spot ...
      
      // Mark this plot as occupied
      plot.forEach(p => occupiedTiles.add(`${p[0]},${p[1]}`));
      
      if (validSpots.length >= count) break;
    }
  }
  
  return validSpots.slice(0, count);
}
```

---

## Faction HQ Placement

### Faction-Specific Requirements

**Location:** `TilemapSystem.getFactionHQRequirements()`

Each faction has unique requirements for HQ placement:

#### Brotherhood
```javascript
{
  requiredTerrain: [0],              // Cave floor only
  searchLayer: 1,                    // Underworld (z=-1)
  minTerrainPercentage: 0.9,
  searchRadius: 20,
  evaluationRadius: 12,
  areaSize: 4,
  priorities: {
    uniformCaveTerrain: 50,
    isolation: 30,
    safetyFromWater: 20
  }
}
```

#### Goths
```javascript
{
  requiredTerrain: [TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH, TERRAIN.GRASS],
  searchLayer: 0,
  minTerrainPercentage: 0.65,
  searchRadius: 30,
  evaluationRadius: 25,
  areaSize: 5,
  priorities: {
    farmingPotential: 40,
    mixedResources: 25,
    buildingSpace: 20,
    marketLocation: 15
  },
  economicBuildings: ['mill', 'mill', 'farm', 'farm', 'market']
}
```

#### Franks
```javascript
{
  requiredTerrain: [TERRAIN.GRASS, TERRAIN.LIGHT_FOREST, TERRAIN.BRUSH],
  searchLayer: 0,
  minTerrainPercentage: 0.60,
  priorities: {
    maximumGrassland: 60,
    farmDensityPotential: 30,
    millPlacement: 10
  },
  economicBuildings: ['mill', 'mill', 'farm', 'farm', 'farm']
}
```

#### Celts
```javascript
{
  requiredTerrain: [TERRAIN.HEAVY_FOREST, TERRAIN.LIGHT_FOREST],
  searchLayer: 0,
  minTerrainPercentage: 0.50,
  priorities: {
    denseForest: 30,
    caveProximity: 50,        // Critical for mining
    rockAccess: 10,
    forestIsolation: 10
  },
  requiresNearby: {
    feature: 'caveEntrance',
    maxDistance: 1536         // ~24 tiles
  },
  economicBuildings: ['mine', 'mine']
}
```

#### Teutons
```javascript
{
  requiredTerrain: [TERRAIN.ROCKS, TERRAIN.MOUNTAIN],
  searchLayer: 0,
  minTerrainPercentage: 0.55,
  priorities: {
    miningPotential: 45,
    lumberAccess: 35,
    terrainDiversity: 20
  },
  requiresNearby: {
    feature: 'forest',
    maxDistance: 768
  },
  economicBuildings: ['mine', 'mine', 'lumbermill', 'lumbermill']
}
```

#### Norsemen
```javascript
{
  requiredTerrain: [TERRAIN.WATER, TERRAIN.GRASS],
  searchLayer: 0,
  minTerrainPercentage: 0.4,
  priorities: {
    waterAccess: 60,
    coastalMix: 30,
    defensibility: 10
  },
  requiresNearby: {
    feature: 'water',
    maxDistance: 192
  }
}
```

#### Outlaws
```javascript
{
  requiredTerrain: [TERRAIN.HEAVY_FOREST],
  searchLayer: 0,
  minTerrainPercentage: 0.55,
  priorities: {
    maximumConcealment: 70,
    isolation: 25,
    ambushPosition: 5
  },
  economicBuildings: []
}
```

#### Mercenaries
```javascript
{
  requiredTerrain: [TERRAIN.EMPTY, TERRAIN.LIGHT_FOREST],
  searchLayer: 1,                    // Cave system
  minTerrainPercentage: 0.70,
  priorities: {
    uniformCaveTerrain: 40,
    strategicPosition: 35,
    isolation: 25
  },
  requiresNearby: {
    feature: 'caveEntrance',
    maxDistance: 768
  },
  economicBuildings: []
}
```

### HQ Placement Process

**1. Get Search Points:**
```javascript
getSearchPointsForFaction(factionName, requirements) {
  const layer = requirements.searchLayer;
  
  if (layer === 1) {
    return this.spawnPoints.underworld;
  }
  
  // Special case: If faction requires a nearby feature, search from those points
  if (requirements.requiresNearby && requirements.requiresNearby.feature) {
    const feature = requirements.requiresNearby.feature;
    
    if (feature === 'caveEntrance' && this.spawnPoints.caveEntrances) {
      return this.spawnPoints.caveEntrances;
    } else if (feature === 'forest' && this.spawnPoints.heavyForest) {
      return this.spawnPoints.heavyForest;
    }
  }
  
  // Default terrain-based search
  if (requirements.requiredTerrain.includes(2)) {
    return this.spawnPoints.heavyForest;
  } else if (requirements.requiredTerrain.includes(6)) {
    return this.spawnPoints.mountains;
  } else if (requirements.requiredTerrain.includes(1)) {
    return this.spawnPoints.water;
  } else {
    return this.spawnPoints.overworld;
  }
}
```

**2. Evaluate Locations:**
```javascript
evaluateHQLocation(tile, requirements) {
  const layer = requirements.searchLayer;
  const checkRadius = Math.ceil(requirements.areaSize / 2);
  
  const immediateArea = global.getArea(tile, tile, checkRadius);
  let validTerrainCount = 0;
  
  for (const t of immediateArea) {
    const terrain = Math.floor(this.getTile(layer, t[0], t[1]));
    if (requirements.requiredTerrain.includes(terrain)) {
      validTerrainCount++;
    }
  }
  
  const terrainPercentage = validTerrainCount / immediateArea.length;
  
  if (terrainPercentage < requirements.minTerrainPercentage) {
    return { isValid: false, score: 0 };
  }
  
  if (requirements.requiresNearby) {
    if (!this.hasNearbyFeature(tile, requirements.requiresNearby, layer)) {
      return { isValid: false, score: 0 };
    }
  }
  
  const score = this.scoreHQLocation(tile, requirements);
  
  return {
    isValid: true,
    score: score,
    details: {
      terrainPercentage: terrainPercentage,
      tile: tile
    }
  };
}
```

**3. Score Locations:**
```javascript
scoreHQLocation(tile, requirements) {
  let score = 0;
  const evalRadius = requirements.evaluationRadius;
  const layer = requirements.searchLayer;
  const area = global.getArea(tile, tile, evalRadius);
  
  const terrainCounts = {};
  for (const t of area) {
    const terrain = Math.floor(this.getTile(layer, t[0], t[1]));
    terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
  }
  
  const priorities = requirements.priorities;
  
  // Apply priority-based scoring
  if (priorities.maximumGrassland) {
    const grassCount = terrainCounts[7] || 0;
    const grassPercentage = grassCount / area.length;
    score += priorities.maximumGrassland * grassPercentage * 100;
  }
  
  if (priorities.caveProximity) {
    const nearestCaveDist = this.getNearestFeatureDistance(tile, 'caveEntrance', layer);
    if (nearestCaveDist < Infinity) {
      const proximityScore = Math.max(0, 1 - (nearestCaveDist / 768));
      score += priorities.caveProximity * proximityScore * 100;
    }
  }
  
  // ... more priority checks ...
  
  score += Math.random() * 10; // Random variation
  
  return score;
}
```

**4. Find Optimal HQ:**
```javascript
findFactionHQ(factionName, excludedLocations = []) {
  const requirements = this.getFactionHQRequirements()[factionName.toLowerCase()];
  if (!requirements) {
    return null;
  }
  
  const searchPoints = this.getSearchPointsForFaction(factionName, requirements);
  const validLocations = [];
  
  for (const point of searchPoints) {
    if (this.isTooCloseToExcluded(point, excludedLocations, 1536)) {
      continue; // Min 24 tiles between factions
    }
    
    const evaluation = this.evaluateHQLocation(point, requirements);
    
    if (evaluation.isValid) {
      validLocations.push({
        tile: point,
        score: evaluation.score,
        details: evaluation.details
      });
    }
  }
  
  validLocations.sort((a, b) => b.score - a.score);
  
  return validLocations.length > 0 ? validLocations[0] : null;
}
```

### Resource Assessment

**Purpose:** Assess resources available within a faction's base radius.

**Implementation:**
```javascript
assessBaseResources(hq, radius, z = 0) {
  const area = global.getArea(hq, hq, radius);
  const resources = {
    heavyForest: 0,
    lightForest: 0,
    totalForest: 0,
    grass: 0,
    rocks: 0,
    mountains: 0,
    water: 0,
    caveEntrances: [],
    buildableSpace: 0
  };
  
  const hqCenter = global.getCenter(hq[0], hq[1]);
  
  // Count terrain types
  for (const tile of area) {
    const terrain = Math.floor(this.getTile(z, tile[0], tile[1]));
    
    if (terrain === 1) resources.heavyForest++;
    else if (terrain === 2) resources.lightForest++;
    else if (terrain === 7) resources.grass++;
    else if (terrain === 4) resources.rocks++;
    else if (terrain === 5) resources.mountains++;
    else if (terrain === 0) resources.water++;
    
    if (terrain === 7 || terrain === 3) resources.buildableSpace++;
  }
  
  resources.totalForest = resources.heavyForest + resources.lightForest;
  
  // Find cave entrances within radius
  if (global.caveEntrances) {
    for (const cave of global.caveEntrances) {
      const caveCenter = global.getCenter(cave[0], cave[1]);
      const dist = global.getDistance(
        { x: hqCenter[0], y: hqCenter[1] },
        { x: caveCenter[0], y: caveCenter[1] }
      );
      const distInTiles = Math.floor(dist / global.tileSize);
      
      if (distInTiles <= radius) {
        resources.caveEntrances.push({ tile: cave, distance: dist, distInTiles: distInTiles });
      }
    }
  }
  
  return resources;
}
```

**Use Cases:**
- Faction initialization
- Base expansion planning
- Resource availability checks
- Economic building placement decisions

---

## Summary

The tilemap system is a comprehensive, multi-layered architecture that manages:

- **7 z-levels** across **9 layers** with distinct purposes
- **Sparse storage** for memory efficiency
- **Automatic change tracking** with cache invalidation
- **Biome-based spawn points** for entity placement
- **Geographic zone subdivision** for named regions
- **Spatial partitioning** for performance optimization
- **Building placement algorithms** with validation and scoring
- **Faction-specific HQ placement** with resource assessment

The system provides a robust foundation for world management, entity placement, and gameplay mechanics while maintaining backward compatibility with legacy systems.

