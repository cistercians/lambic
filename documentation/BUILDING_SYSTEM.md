# Building System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Building Foundation Placement](#building-foundation-placement)
3. [Building Costs & Materials](#building-costs--materials)
4. [Building Construction Process](#building-construction-process)
5. [Building Entity Management](#building-entity-management)
6. [Building Types & Tiers](#building-types--tiers)
7. [Building Validation & Preview](#building-validation--preview)
8. [Building Completion & Effects](#building-completion--effects)
9. [Building Interactions](#building-interactions)
10. [Faction AI Building System](#faction-ai-building-system)
11. [Technical Details](#technical-details)

---

## Overview

The building system in Lambic is a comprehensive construction framework that allows both players and faction AI to place, construct, and manage buildings. Buildings progress through multiple phases: foundation placement, construction work, and completion. The system includes validation, material management, terrain requirements, and building-specific mechanics.

### Key Components

- **BuildingPreview** (`server/js/core/BuildingPreview.js`): Central validation and building definition system
- **BuildingCommand** (`server/js/commands/commands/BuildingCommand.js`): Player building command handler
- **BuildingConstruction** (`server/js/core/BuildingConstruction.js`): Unified construction system for complex buildings
- **Build** (`server/js/Build.js`): Foundation work and completion system
- **TilemapSystem** (`server/js/core/TilemapSystem.js`): Building spot finding and validation for AI
- **BuildingConstructor** (`server/js/ai/BuildingConstructor.js`): AI building construction methods

---

## Building Foundation Placement

### Player Placement

Players place building foundations using the `/build [building type]` command. The process follows this flow:

#### Command Flow

1. **Command Parsing** (`BuildingCommand.execute()`)
   - Parses building type from command
   - Validates player is on ground level (z=0)
   - Retrieves building definition from BuildingPreview

2. **Location Determination**
   - Uses player's current position: `getLoc(player.x, player.y)`
   - Supports override coordinates via `overrideC` and `overrideR` parameters
   - For dock buildings, uses player's facing direction to determine plot orientation

3. **Validation** (`BuildingPreview.validateBuildingPlacement()`)
   - Checks terrain requirements (strict rules for players)
   - Validates plot tiles are walkable and not blocked
   - Special validation for docks (50% water requirement)
   - Returns validation result with tile status (valid/clearable/blocked)

4. **Material Check** (`BuildingPreview.checkMaterials()`)
   - Checks both player inventory and stores
   - Returns missing materials if insufficient

5. **Material Deduction** (`BuildingCommand.deductMaterials()`)
   - Prioritizes inventory first, then stores
   - Deducts required materials from both sources

6. **Foundation Placement**
   - Stores original terrain values for each plot tile before changing tiles
   - Updates terrain tiles to foundation markers:
     - Land tiles: `BUILD_MARKER` (11)
     - Water tiles: `BUILD_MARKER_ALT` (11.5)
   - Clears layer 6 (construction progress layer)
   - Updates pathfinding matrix (marks foundation tiles as walkable)

7. **Building Entity Creation**
   - Creates Building entity with `built: false`
   - Stores plot, walls, topPlot coordinates
   - Stores `baseTerrain` array containing original terrain values for each plot tile
   - Sets materials, req (default 5), hp (default 150)

#### Special Cases

- **Farm**: Instant construction, no foundation phase
- **Dock**: Direction-dependent plot selection based on player facing

### Faction AI Placement

Faction AI places buildings during initialization and expansion phases:

#### Initialization Flow

1. **Spot Finding** (`TilemapSystem.findBuildingSpot()`)
   - Searches within radius from HQ or specified location
   - Uses building-specific requirements
   - Scores spots based on terrain, proximity, and requirements

2. **Validation** (`TilemapSystem.canPlaceBuilding()`)
   - Checks terrain requirements (more lenient than players - can use clearable tiles)
   - Validates plot tiles are walkable
   - Checks for building overlaps
   - Validates clearance radius if required

3. **Construction** (`BuildingConstructor.build[Type]()`)
   - Stores original terrain values for each plot tile before changing tiles
   - Updates terrain tiles immediately
   - Creates building entity with `built: true` (instant completion for AI)
   - Passes `baseTerrain` array to building constructor for adaptive base layer rendering
   - Places building-specific tiles and items

#### Building Spot Scoring

The TilemapSystem scores potential building locations based on:
- Terrain preference (grass > light forest > brush)
- Proximity to required buildings (e.g., farms near mills)
- Resource availability (forest for lumbermills, rocks for mines)
- Open space for expansion

### Validation Rules

#### Terrain Requirements

Buildings have two sets of terrain requirements:

1. **requiredTiles**: Base terrain types the building can be placed on
2. **clearableTiles**: Terrain that can be cleared (brush, light forest)
3. **playerRequiredTiles**: Stricter rules for players (must be exact terrain, no clearable tiles)

#### Player vs AI Rules

- **Players**: Must use `playerRequiredTiles` - strict terrain matching, no clearable tiles allowed
- **AI**: Can use `requiredTiles` OR `clearableTiles` - more flexible placement

#### Special Terrain Rules

- **Dock**: Players require ≥50% water tiles in plot
- **Mine**: Can be built on EMPTY, ROCKS, or MOUNTAIN terrain
- **Tower/Garrison/Stronghold**: Can be built on EMPTY, ROCKS, or MOUNTAIN terrain

### Foundation Tiles

Foundation tiles are placed on layer 0 (terrain layer):
- **BUILD_MARKER (11)**: Standard foundation for land buildings
- **BUILD_MARKER_ALT (11.5)**: Foundation for water-based buildings (docks)

Layer 6 (construction progress) is cleared to 0 when foundation is placed.

---

## Building Costs & Materials

### Material System

Buildings require materials (wood and/or stone) that are deducted from:
1. **Player Inventory** (checked first, prioritized for deduction)
2. **Player Stores** (checked second, used if inventory insufficient)

### Building Cost Table

#### Tier I Buildings

| Building | Wood | Stone | Special Notes |
|----------|------|-------|---------------|
| Farm | 0 | 0 | No materials, instant construction |
| Lumbermill | 75 | 0 | - |
| Mine | 60 | 0 | - |
| Hut | 25 | 0 | - |
| Cottage | 40 | 20 | Requires both wood AND stone |
| Tavern | 125 | 0 | - |
| Tower | 0 | 50 | Stone only |
| Forge | 50 | 0 | - |
| Fort | 120 | 0 | - |
| Outpost | 60 | 0 | - |
| Monastery | 0 | 300 | Stone only |

#### Tier II Buildings (Require Prerequisites)

| Building | Wood | Stone | Prerequisites |
|----------|------|-------|---------------|
| Mill | 60 | 0 | Requires Farm |
| Dock | 80 | 0 | Requires Tavern |
| Stable | 100 | 0 | Requires Tavern |
| Market | 150 | 0 | Requires Tavern |
| Garrison | 0 | 100 | Requires Forge |

#### Tier III Buildings (Require Garrison)

| Building | Wood | Stone | Prerequisites |
|----------|------|-------|---------------|
| Stronghold | 0 | 300 | Requires Garrison |
| Wall | 0 | 40 | Requires Garrison |
| Gate | 0 | 60 | Requires Garrison |
| Guardtower | 0 | 120 | Requires Garrison |

#### Tier IV Buildings

| Building | Wood | Stone | Prerequisites |
|----------|------|-------|---------------|
| Cathedral | - | - | Requires Monastery + Stronghold |

### Material Deduction Logic

```javascript
// From BuildingCommand.deductMaterials()
for (const material in materials) {
  let remaining = materials[material];
  
  // First, try to deduct from inventory
  const inInventory = player.inventory[material] || 0;
  if (inInventory > 0) {
    const fromInventory = Math.min(inInventory, remaining);
    player.inventory[material] = inInventory - fromInventory;
    remaining -= fromInventory;
  }
  
  // Then, if needed, deduct remainder from stores
  if (remaining > 0 && player.stores) {
    const inStores = player.stores[material] || 0;
    if (inStores > 0) {
      const fromStores = Math.min(inStores, remaining);
      player.stores[material] = inStores - fromStores;
      remaining -= fromStores;
    }
  }
}
```

### Prerequisites

Buildings have tier-based prerequisites:
- **Tier I**: No prerequisites
- **Tier II**: Requires at least one Tier I building (Farm, Tavern, or Forge)
- **Tier III**: Requires Garrison (Tier II)
- **Tier IV**: Requires Monastery + Stronghold

The `/build` command lists available buildings based on what the player has constructed.

---

## Building Construction Process

### Construction Phases

Buildings progress through three main phases:

1. **Foundation Phase**: Foundation tiles placed, building entity created
2. **Work Phase**: Players/NPCs work on foundation tiles to complete construction
3. **Completion Phase**: Building becomes functional, tiles updated, interior items spawned

### Foundation Phase

When a foundation is placed:

1. **Terrain Updates**
   - Layer 0: Foundation markers (11 or 11.5)
   - Layer 6: Cleared to 0 (construction progress tracking)

2. **Pathfinding Matrix Updates**
   - Foundation tiles marked as walkable (matrix value 0)
   - Critical for water foundation tiles (previously had matrix value 2)

3. **Building Entity Creation**
   - Created with `built: false`
   - Stores plot, walls, topPlot coordinates
   - Initializes materials, req (default 5), hp (default 150)

### Work Phase

Players and NPCs work on foundation tiles using the `Build()` function:

#### Work Mechanics

1. **Work Trigger**
   - Player/NPC stands on foundation tile
   - Calls `Build(id)` function
   - Sets `working: true` and `building: true`

2. **Work Timer**
   - Base time: `10000 / player.strength` milliseconds
   - Minimum 10 seconds for NPCs
   - Player strength affects work speed

3. **Progress Tracking**
   - Layer 6 tile value increments: `tileChange(6, x, y, value)`
   - Each work action increments the tile value
   - Foundation tile appearance changes at certain thresholds

4. **Foundation Tile Updates**
   - When layer 6 value reaches `req` (default 5):
     - BUILD_MARKER (11) → 12
     - BUILD_MARKER_ALT (11.5) → 12.5

#### Completion Check

After each work action, the system checks if all plot tiles have reached the `req` value:

```javascript
var count = 0;
for(var i in plot){
  if(getTile(6, plot[i][0], plot[i][1]) >= Building.list[b].req){
    count++;
  }
}
if(count == plot.length && !Building.list[b].built){
  // Building is complete!
  Building.list[b].built = true;
  // ... completion logic
}
```

### Completion Phase

When all plot tiles reach the `req` value, the building is marked as complete:

1. **Building Status**: `built = true`

2. **Tile Updates**: Building-specific tile changes
   - Layer 0: Terrain tiles updated to building-specific values
   - Layer 3: Building ground markers (e.g., 'mill0', 'mill1')
   - Layer 4: Wall tiles (if applicable)
   - Layer 5: Upper floor tiles (if applicable)

3. **Matrix Updates**: Pathfinding matrix changes
   - Building tiles marked as non-walkable (matrix value 1)
   - Doorways marked as transitions (matrix value 2)
   - Stairs marked as transitions

4. **Interior Items**: Building-specific items spawned
   - Fireplaces, furniture, NPCs
   - Varies by building type

5. **Faction Updates**:
   - Patrol lists updated
   - Building flags set (hasStable, hasStronghold)
   - Auto-upgrade units if stable completed

### Special Construction Cases

#### Farm (Instant Construction)

Farms are built instantly without a foundation phase:

```javascript
// From BuildingCommand.buildFarm()
setTimeout(() => {
  // Update tiles to farm tiles (8 = FARM_SEED)
  for (const tile of plot) {
    tileChange(0, tile[0], tile[1], 8);
    tileChange(6, tile[0], tile[1], 0);
  }
  
  // Create farm building (built: true immediately)
  Farm({
    owner: player.id,
    type: 'farm',
    built: true,
    plot: plot
  });
}, buildTime);
```

#### Forge & Garrison (Unified Construction)

Forge and Garrison use the unified `BuildingConstruction` class:

```javascript
// Forge completion
BuildingConstruction.constructForge(buildingId, plot, walls);

// Garrison completion
BuildingConstruction.constructGarrison(buildingId, plot, topPlot, walls);
```

These methods handle:
- Tile updates (layers 0, 3, 4, 5)
- Matrix updates
- Interior item placement
- Wall tile configuration

---

## Building Entity Management

### Building Entity Structure

Buildings are created using the `Building()` constructor in `server/js/Entity.js`:

```javascript
Building = function(param){
  var self = Entity(param);
  self.owner = param.owner;        // Player ID who owns the building
  self.house = param.house;        // Faction/House ID
  self.kingdom = param.kingdom;    // Kingdom ID
  self.type = param.type;          // Building type string
  self.built = param.built;        // Boolean: construction complete
  self.loc = param.loc;            // Location (legacy)
  self.plot = param.plot;          // Array of [col, row] coordinates
  self.walls = param.walls;        // Array of wall tile coordinates
  self.topPlot = param.topPlot;    // Array of upper floor tile coordinates
  self.baseTerrain = param.baseTerrain || []; // Original terrain values for each plot tile
  self.mats = param.mats;          // Materials object {wood: X, stone: Y}
  self.req = param.req;            // Required work value (default 5)
  self.hp = param.hp;              // Building health points
  self.occ = 0;                    // Occupancy count
  
  // Spot tracking for work assignments
  self.assignedSpots = {};         // {serfId: [col,row]}
  self.availableResources = [];    // Resource tracking
  
  // Building-specific properties
  // (entrance, ustairs, dstairs, serfs, etc.)
  
  Building.list[self.id] = self;
  return self;
}
```

### Building Properties

#### Core Properties

- **id**: Unique building identifier
- **owner**: Player ID who owns the building
- **house**: Faction/House ID
- **kingdom**: Kingdom ID
- **type**: Building type string (e.g., 'mill', 'tavern', 'forge')
- **built**: Boolean indicating if construction is complete
- **x, y, z**: World coordinates (center of building)

#### Plot Properties

- **plot**: Array of `[col, row]` coordinates defining building footprint
- **walls**: Array of `[col, row]` coordinates for wall tiles (one row above top plot row)
- **topPlot**: Array of `[col, row]` coordinates for upper floor tiles (layer 5)
- **baseTerrain**: Array of original terrain values for each plot tile (used for adaptive base layer rendering)

#### Construction Properties

- **mats**: Materials object `{wood: X, stone: Y}` (stored for reference)
- **req**: Required work value for completion (default 5)
- **hp**: Building health points (default 150)

#### Functional Properties

- **occ**: Occupancy count (players/NPCs inside)
- **entrance**: `[col, row]` coordinates of building entrance
- **ustairs**: `[col, row]` coordinates of upstairs transition
- **dstairs**: `[col, row]` coordinates of downstairs transition
- **serfs**: Array of serf IDs assigned to building
- **assignedSpots**: Object tracking work spot assignments `{serfId: [col,row]}`

#### Building-Specific Properties

- **Dock**: `network` (array of connected dock IDs), `cargoShip` (cargo ship ID)
- **Mill**: `farms` (object of linked farm IDs)
- **Tavern**: `newSerfs()` function for serf spawning
- **Market**: Market-specific properties

### Building List Storage

All buildings are stored in the global `Building.list` object:

```javascript
Building.list = {};  // {buildingId: BuildingEntity}
```

### Building Entity Methods

#### Spot Management

```javascript
// Assign a work spot to a serf
self.assignSpot = function(serfId, spot){
  self.assignedSpots[serfId] = spot;
};

// Release a work spot
self.releaseSpot = function(serfId){
  delete self.assignedSpots[serfId];
};

// Check if spot is available
self.isSpotAvailable = function(spot){
  for(var id in self.assignedSpots){
    var assigned = self.assignedSpots[id];
    if(assigned[0] === spot[0] && assigned[1] === spot[1]){
      return false;
    }
  }
  return true;
};
```

#### Resource Management

```javascript
// Update available resources (for resource buildings)
self.updateResources = function(){
  if(self.type === 'lumbermill'){
    // Filter out depleted forest tiles
    self.resources = self.resources.filter(r => {
      var tile = getTile(0, r[0], r[1]);
      return tile >= 1 && tile < 2; // Has trees
    });
  } else if(self.type === 'mine'){
    // Filter out depleted ore tiles
    self.resources = self.resources.filter(r => {
      var tile = getTile(1, r[0], r[1]);
      return tile >= 2 && tile < 5; // Has ore/stone
    });
  }
};
```

#### Dock-Specific Methods

```javascript
// Create bidirectional dock association
self.createDockAssociation = function(otherDockId){
  // Adds dock to network, spawns cargo ships if needed
};

// Spawn cargo ship for dock
self.spawnCargoShip = function(){
  // Finds water tile adjacent to dock and spawns cargo ship
};
```

### Building Entity Lifecycle

1. **Creation**: Building entity created with `built: false`
2. **Construction**: Players/NPCs work on foundation tiles
3. **Completion**: `built: true`, tiles updated, interior items spawned
4. **Active**: Building functional, can be entered, used for work
5. **Destruction**: Building removed from `Building.list` (if implemented)

---

## Building Types & Tiers

### Tier I Buildings (No Prerequisites)

#### Farm
- **Size**: 3x3 (9 tiles)
- **Cost**: Free (no materials)
- **Construction**: Instant (no foundation phase)
- **Terrain**: EMPTY (grass) only
- **Special**: Links to nearby mills automatically

#### Lumbermill
- **Size**: 2x1 (2 tiles) + 2 topPlot tiles
- **Cost**: 75 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Requires nearby forest for operation

#### Mine
- **Size**: 2x2 (4 tiles)
- **Cost**: 60 wood
- **Terrain**: EMPTY, ROCKS, or MOUNTAIN
- **Special**: Can be built on rocky/mountain terrain

#### Hut
- **Size**: 2x2 (4 tiles) + 2 wall tiles
- **Cost**: 25 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Houses 2 serfs, spawns fireplace

#### Cottage
- **Size**: 3x3 (9 tiles) + 3 wall tiles
- **Cost**: 40 wood, 20 stone (both required)
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Player residence, provides key, locked door

#### Tavern
- **Size**: 5x4 irregular (17 tiles) + 5 wall tiles + 3 topPlot tiles
- **Cost**: 125 wood
- **Terrain**: EMPTY, BRUSH (can clear BRUSH, LIGHT_FOREST)
- **Special**: Multi-floor building, spawns innkeeper, serf spawning point

#### Tower
- **Size**: 3x3 (9 tiles) + 3 wall tiles + 6 topPlot tiles
- **Cost**: 50 stone
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Player residence, provides key, multiple floors

#### Forge
- **Size**: 3x2 (6 tiles) + 3 wall tiles
- **Cost**: 50 wood
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Spawns blacksmith, unified construction system

#### Fort
- **Size**: 1x1 (1 tile)
- **Cost**: 120 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Simple defensive structure

#### Outpost
- **Size**: 1x1 (1 tile) + 1 topPlot tile
- **Cost**: 60 wood
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Watchtower structure

#### Monastery
- **Size**: 4x4 (14 tiles) + 4 wall tiles + 3 topPlot tiles
- **Cost**: 300 stone
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Spawns bishop and 2 monks, multi-floor

### Tier II Buildings (Require Prerequisites)

#### Mill
- **Prerequisite**: Farm
- **Size**: 2x2 (4 tiles) + 2 topPlot tiles
- **Cost**: 60 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Links to nearby farms, processes farm output

#### Dock
- **Prerequisite**: Tavern
- **Size**: 3x2 (6 tiles) + 3 topPlot tiles (direction-dependent)
- **Cost**: 80 wood
- **Terrain**: EMPTY, WATER (players require ≥50% water)
- **Special**: Direction-dependent plots, cargo ship network, spawns shipwright

#### Stable
- **Prerequisite**: Tavern
- **Size**: 4x3 (12 tiles) + 3 topPlot tiles
- **Cost**: 100 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Enables unit upgrades, sets hasStable flag

#### Market
- **Prerequisite**: Tavern
- **Size**: 5x3 (12 tiles) + 5 wall tiles (walls used as topPlot)
- **Cost**: 150 wood
- **Terrain**: EMPTY (can clear BRUSH, LIGHT_FOREST)
- **Special**: Uses walls as topPlot (special case), trading hub

#### Garrison
- **Prerequisite**: Forge
- **Size**: 4x3 (12 tiles) + 4 wall tiles + 3 topPlot tiles
- **Cost**: 100 stone
- **Terrain**: EMPTY, BRUSH, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Military training building, unified construction system, sets hasGarrison flag

### Tier III Buildings (Require Garrison)

#### Stronghold
- **Prerequisite**: Garrison
- **Size**: Large irregular (58 tiles) + 8 wall tiles + 9 topPlot tiles
- **Cost**: 300 stone
- **Terrain**: EMPTY, BRUSH, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Massive multi-floor building, player residence, sets hasStronghold flag

#### Wall
- **Prerequisite**: Garrison
- **Size**: 1x1 (1 tile)
- **Cost**: 40 stone
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Defensive structure

#### Gate
- **Prerequisite**: Garrison
- **Size**: 2x1 (2 tiles)
- **Cost**: 60 stone
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Defensive structure with passage

#### Guardtower
- **Prerequisite**: Garrison
- **Size**: 2x2 (4 tiles) + 2 topPlot tiles
- **Cost**: 120 stone
- **Terrain**: EMPTY, ROCKS, MOUNTAIN (can clear BRUSH, LIGHT_FOREST)
- **Special**: Defensive watchtower

### Tier IV Buildings

#### Cathedral
- **Prerequisite**: Monastery + Stronghold
- **Size**: (Not yet implemented)
- **Cost**: (Not yet implemented)
- **Special**: Highest tier building

### Building Size Reference

| Building | Plot Size | Walls | TopPlot | Total Tiles |
|----------|-----------|-------|---------|-------------|
| Farm | 3x3 | 0 | 0 | 9 |
| Lumbermill | 2x1 | 0 | 2 | 4 |
| Mine | 2x2 | 0 | 0 | 4 |
| Hut | 2x2 | 2 | 0 | 6 |
| Cottage | 3x3 | 3 | 0 | 12 |
| Tavern | 5x4 | 5 | 3 | 25 |
| Tower | 3x3 | 3 | 6 | 18 |
| Forge | 3x2 | 3 | 0 | 9 |
| Fort | 1x1 | 0 | 0 | 1 |
| Outpost | 1x1 | 0 | 1 | 2 |
| Monastery | 4x4 | 4 | 3 | 21 |
| Mill | 2x2 | 0 | 2 | 6 |
| Dock | 3x2 | 0 | 3 | 9 |
| Stable | 4x3 | 0 | 3 | 15 |
| Market | 5x3 | 5 | 0* | 17 |
| Garrison | 4x3 | 4 | 3 | 19 |
| Stronghold | Irregular | 8 | 9 | 75 |
| Wall | 1x1 | 0 | 0 | 1 |
| Gate | 2x1 | 0 | 0 | 2 |
| Guardtower | 2x2 | 0 | 2 | 6 |

*Market uses walls as topPlot (special case)

---

## Building Validation & Preview

### BuildingPreview System

The `BuildingPreview` class (`server/js/core/BuildingPreview.js`) is the central validation system for building placement.

#### Building Definitions

Each building type has a definition object:

```javascript
{
  name: 'Building Name',
  plot: [[0,0],[1,0],...],           // Relative plot coordinates
  walls: [[0,-2],[1,-2],...],        // Relative wall coordinates (or null)
  topPlot: [[0,-1],[1,-1],...],      // Relative upper floor coordinates (or null)
  requiredTiles: [TERRAIN.EMPTY],     // Base terrain requirements
  clearableTiles: [TERRAIN.BRUSH],   // Terrain that can be cleared
  materials: {wood: 50},             // Material costs
  playerRequiredTiles: [TERRAIN.EMPTY] // Stricter player requirements
}
```

#### Validation Process

`validateBuildingPlacement(buildingType, centerX, centerY, z, facing, isPlayer)`:

1. **Get Building Definition**: Retrieves building definition from `buildingDefinitions`

2. **Calculate Plot Coordinates**: Converts relative plot coordinates to absolute world coordinates

3. **Calculate Walls and TopPlot**: Converts relative wall/topPlot coordinates to absolute

4. **Terrain Validation**:
   - For each tile in plot, checks terrain type
   - Players: Must match `playerRequiredTiles` exactly (strict)
   - AI: Can match `requiredTiles` OR `clearableTiles` (flexible)

5. **Special Validations**:
   - Dock: Players require ≥50% water tiles
   - Walkability: All plot tiles must be walkable
   - Blocking: Checks for existing buildings, items, or blocking objects

6. **Returns Validation Object**:
```javascript
{
  valid: true/false,
  canBuild: true/false,
  tiles: [...],              // Valid tiles
  clearableTiles: [...],     // Clearable tiles
  blockedTiles: [...],       // Blocked tiles
  reason: "Error message",   // If canBuild is false
  walls: [...],             // Calculated wall coordinates
  topPlot: [...]            // Calculated topPlot coordinates
}
```

### Material Checking

`checkMaterials(player, buildingType)`:

1. Gets building definition and materials requirements
2. Checks both player inventory and stores
3. Returns:
```javascript
{
  hasMaterials: true/false,
  missing: {wood: 10, stone: 5}  // Missing amounts
}
```

### Preview System

#### Server-Side Preview

The `/preview [building]` command uses `BuildingPreview` to show where a building can be placed:

1. Gets building definition
2. Validates placement at player's current location
3. Returns validation result with tile status

#### Client-Side Preview

The `BuildingPreviewRenderer` class (`client/js/BuildingPreview.js`) displays a visual overlay:

1. **Overlay Canvas**: Creates overlay canvas above game canvas
2. **Tile Highlighting**:
   - Green: Valid tiles
   - Yellow/Orange: Clearable tiles
   - Red: Blocked tiles
3. **Building Info**: Displays building name, status, and tile counts
4. **Auto-Update**: Updates when player moves or camera changes

### Terrain Validation Rules

#### Terrain Types

- **TERRAIN.WATER (0)**: Water tiles
- **TERRAIN.HEAVY_FOREST (1)**: Dense forest
- **TERRAIN.LIGHT_FOREST (2)**: Light forest
- **TERRAIN.BRUSH (3)**: Brush/scrubland
- **TERRAIN.ROCKS (4)**: Rocky terrain
- **TERRAIN.MOUNTAIN (5)**: Mountain terrain
- **TERRAIN.CAVE_ENTRANCE (6)**: Cave entrance
- **TERRAIN.EMPTY (7)**: Grass/open terrain

#### Clearable Tiles

Most buildings can clear:
- **BRUSH (3)**: Can be cleared
- **LIGHT_FOREST (2)**: Can be cleared

#### Player vs AI Rules

- **Players**: Must use exact terrain from `playerRequiredTiles` (no clearable tiles)
- **AI**: Can use `requiredTiles` OR `clearableTiles` (more flexible)

### Special Validation Cases

#### Dock Water Requirement

For players building docks:
- Must have ≥50% water tiles in plot
- Calculated as: `(waterTileCount / totalTiles) * 100 >= 50`
- Error message: "Dock requires at least 50% water tiles (currently X%)"

#### Walkability Check

All plot tiles must be walkable:
- Checks pathfinding matrix (value 0 = walkable)
- Blocks placement on non-walkable tiles (buildings, blocking objects)

#### Building Overlap Check

- Checks layer 3 (building ground markers)
- Checks layer 5 (upper floors)
- Checks for items/objects at location
- Blocks placement if overlap detected

---

## Building Completion & Effects

### Completion Triggers

A building is marked as complete when:

1. **All Plot Tiles Reach Required Value**:
   - Each plot tile's layer 6 value must be >= `building.req` (default 5)
   - Checked after each work action on foundation tiles

2. **Building Status Update**:
   - `building.built = true`
   - Triggers completion logic

### Tile Updates on Completion

Buildings update multiple tile layers when completed:

#### Layer 0 (Terrain)
- Foundation markers (11, 11.5) → Building-specific terrain (12, 12.5, 13, 14, 15, 16, 17, 19, 20, 20.5)
- Door tiles: 14 (DOOR_OPEN), 16 (DOOR_OPEN_ALT), 19 (DOOR_LOCKED)

#### Layer 3 (Building Ground Markers)
- Building-specific tile names: 'mill0', 'mill1', 'tavern0', 'forge0', etc.
- Used for building identification and rendering

#### Layer 4 (Walls)
- Wall tile values: 1, 2, 3, 4, 5, 6, 7
- Stairs: 3 (upstairs), 4 (upstairs), 5 (downstairs), 6 (downstairs/cellar), 7 (special)

#### Layer 5 (Upper Floors)
- Upper floor tile names: 'mill4', 'mill5', 'tavern17', 'garrison12', etc.
- Only for buildings with topPlot

### Matrix Updates

Pathfinding matrix updates on completion:

- **Building Tiles**: Matrix value 1 (blocked, non-walkable)
- **Doorways**: Matrix value 0 (walkable, allows entry)
- **Stairs**: Matrix value 0 (walkable, allows transition)
- **Walls**: Matrix value 0 (walkable, but visual barrier)

### Interior Items Spawned

Buildings spawn interior items on completion:

#### Hut/Cottage
- Fireplace (z=1)
- Door (entrance tile)
- Serf homes assigned

#### Tavern
- Fireplace (z=1, z=2)
- StagHead decorations
- Firepits (z=0)
- Barrels (multiple locations, multiple z-levels)
- Bed (z=2)
- Chest (z=2)
- WallTorch (z=-2)
- Innkeeper NPC

#### Monastery
- WallTorch (z=1)
- Cross (z=1)
- Bookshelves (z=2)
- Bishop NPC
- 2 Monk NPCs

#### Market
- WallTorch (multiple locations)
- Goods decorations (walls)
- Firepits (z=0)
- Crates (z=2)
- Desks (z=2)
- Stash containers (z=2)

#### Forge
- Furnace (z=1)
- Firepit (z=0)
- Barrel (z=1)
- Anvil (z=1)
- Blacksmith NPC

#### Garrison
- SuitArmor (z=1)
- Banner (z=1)
- Throne (z=1)
- Swordrack (multiple locations, z=1, z=2)
- Firepits (multiple locations, z=0, z=1)
- Dummy training targets (z=1, z=2)
- Desk (z=2)
- WallTorch (z=2)

#### Stronghold
- SuitArmor (z=1)
- Banner (z=1)
- Throne (z=1)
- Swordrack (multiple locations, z=1)
- Firepits (multiple locations, z=0, z=1, z=-2)
- Bed (z=2)
- WallTorch (z=2, z=-2)
- Chains (z=-2)
- Jail cells (z=-2)
- JailDoor (z=-2)

#### Dock
- WallTorch (z=0)
- Shipwright NPC
- Cargo ship (if network connection exists)

### Faction Updates

When buildings complete, faction systems are updated:

#### Patrol Lists
```javascript
if(building.house && building.patrol){
  House.list[building.house].military.patrol.push(building.id);
}
```

#### Building Flags
```javascript
if(building.type === 'stable'){
  House.list[building.house].hasStable = true;
  // Auto-upgrade units with 10+ kills to mounted
  if(global.autoUpgradeUnitsOnStable){
    global.autoUpgradeUnitsOnStable(building.house);
  }
}

if(building.type === 'stronghold'){
  House.list[building.house].hasStronghold = true;
}
```

### Home Assignment

Residential buildings auto-set as player home on first build:

```javascript
var residentialBuildings = ['hut', 'cottage', 'tavern', 'tower', 'stronghold'];
var isResidential = residentialBuildings.indexOf(building.type) >= 0;

if(isResidential && !owner.home){
  // Auto-set home to this residential building
  var fireplaceWall = building.type === 'tower' ? walls[2] : walls[1];
  var fireplaceTile = fireplaceWall;
  var homeTile = [fireplaceTile[0], fireplaceTile[1] + 1]; // One tile south of fireplace
  
  var homeZ = building.type === 'tavern' ? 2 : 1;
  owner.home = {z: homeZ, loc: homeTile};
}
```

### Event System Integration

Building completion triggers events:

```javascript
if(global.eventManager){
  global.eventManager.buildingCompleted(building, owner, { x: building.x, y: building.y, z: building.z });
}
```

### Building-Specific Completion Logic

Each building type has specific completion logic in `Build.js`:

- **Hut**: Creates fireplace, assigns serf homes, updates tiles
- **Mill**: Updates tiles, marks as interactable
- **Cottage**: Creates fireplace, provides key, sets entrance
- **Tavern**: Complex multi-floor setup with multiple items and NPCs
- **Monastery**: Spawns religious NPCs and decorations
- **Market**: Sets up trading area with goods and containers
- **Forge**: Uses unified construction system
- **Garrison**: Uses unified construction system
- **Stronghold**: Massive setup with multiple floors, jails, and decorations

---

## Building Interactions

### Enter/Exit System

Buildings track occupancy and handle player/NPC entry/exit:

#### Entering Buildings

```javascript
self.enterBuilding = function(buildingId) {
  if(Building.list[buildingId]){
    Building.list[buildingId].occ++;
    // Transition logic to building interior
  }
}
```

#### Exiting Buildings

```javascript
self.exitBuilding = function(buildingId) {
  if(Building.list[buildingId]){
    Building.list[buildingId].occ--;
    // Transition logic back to overworld
  }
}
```

#### Transition Logic

- **Doorways**: Players walk through door tiles (matrix value 0)
- **Stairs**: Players walk on stair tiles to change z-level
- **Cave Entrances**: Special transition to underworld

### Work Assignments

Resource buildings (mills, mines, lumbermills) use spot tracking:

#### Spot Assignment

```javascript
// Assign work spot to serf
building.assignSpot(serfId, [col, row]);

// Check if spot available
if(building.isSpotAvailable([col, row])){
  // Assign serf to this spot
}

// Release spot when serf leaves
building.releaseSpot(serfId);
```

#### Resource Tracking

Buildings track available resources:

- **Lumbermill**: Tracks nearby forest tiles
- **Mine**: Tracks nearby ore/stone tiles
- **Mill**: Tracks linked farm plots

### Dock Networks

Docks form networks for cargo ship transportation:

#### Network Creation

```javascript
// Create bidirectional association
dock.createDockAssociation(otherDockId);

// Adds both docks to each other's network
dock.network.push(otherDockId);
otherDock.network.push(dock.id);
```

#### Cargo Ship Spawning

When a dock gets its first network connection:

```javascript
if(dock.network.length === 1 && !dock.cargoShip){
  dock.spawnCargoShip();
}
```

Cargo ships transport goods between connected docks.

### Building Links

Buildings form relationships with other buildings:

#### Farm-Mill Links

Farms automatically link to nearby mills:

```javascript
// Mill finds nearby farms
for(var farmId in Farm.list){
  var farm = Farm.list[farmId];
  var dist = getDistance(millCenter, farmCenter);
  if(dist <= maxDistance){
    Building.list[millId].farms[farmId] = farm.plot;
  }
}
```

#### Serf-Hut Links

Serfs are assigned to huts:

```javascript
// Serf creation
SerfM({
  hut: buildingId,
  home: {z: 1, loc: [col, row]}
});

// Building tracks serfs
building.serfs = [serf1Id, serf2Id];
```

#### Tavern Serf Spawning

Taverns can spawn new serfs:

```javascript
building.newSerfs = function(houseId){
  // Spawns new serfs for the house
};
```

### Building Interactivity

Buildings can be interacted with:

#### Interactable Tiles

Some building tiles are marked as interactable:

```javascript
// Mark tile as interactable
global.setTileInteractable(z, col, row, buildingId);

// Examples:
// - Mill tiles (all plot tiles)
// - Lumbermill tiles (all plot tiles)
// - Mine tiles (all plot tiles)
// - Dock center tile (plot[4])
```

#### Building-Specific Interactions

- **Mill**: Process farm output
- **Lumbermill**: Process wood
- **Mine**: Extract ore/stone
- **Dock**: Board cargo ships, manage network
- **Market**: Trading interface
- **Forge**: Crafting interface
- **Tavern**: Serf spawning, rest
- **Cottage/Tower/Stronghold**: Player residence, storage

---

## Faction AI Building System

### Building Service

The `BuildingService` class (`server/js/ai/BuildingService.js`) provides cached building queries:

#### Caching System

```javascript
// Buildings cached per day
getBuildings() {
  // Returns all buildings owned by house
  // Cached for performance
}

// Building counts cached
getBuildingCount(buildingType) {
  // Returns count of specific building type
  // Cached for O(1) lookup
}
```

#### Building Queries

```javascript
// Check if house has building type
hasBuildingType(buildingType)

// Get buildings by type
getBuildingsByType(buildingType)

// Get first building of type
getFirstBuildingOfType(buildingType)
```

### Building Constructor

The `BuildingConstructor` class (`server/js/ai/BuildingConstructor.js`) handles AI building construction:

#### Construction Methods

- `buildMill(location)`: Constructs mill
- `buildFarm(location)`: Constructs farm near mill
- `buildMine(location)`: Constructs mine
- `buildLumbermill(location)`: Constructs lumbermill
- `buildForge(location)`: Constructs forge
- `buildGarrison(location)`: Constructs garrison

#### Construction Flow

1. **Find Building Spot**: Uses `TilemapSystem.findBuildingSpot()`
2. **Store Base Terrain**: Captures original terrain values for each plot tile before changing tiles
3. **Update Tiles**: Immediately updates terrain tiles
4. **Create Entity**: Creates building with `built: true` (instant completion)
   - Passes `baseTerrain` array to building constructor for adaptive base layer rendering
5. **Territory Check**: Marks building as colony if outside base territory

### TilemapSystem Integration

The `TilemapSystem` provides building placement utilities:

#### Spot Finding

```javascript
findBuildingSpot(buildingType, centerTile, searchRadius, customRequirements)
```

- Searches within radius for valid placement
- Scores spots based on terrain, proximity, resources
- Returns best spot with plot, walls, topPlot coordinates

#### Validation

```javascript
canPlaceBuilding(tile, requirements, buildingType)
```

- Checks terrain requirements
- Validates walkability
- Checks for building overlaps
- Validates clearance radius

#### Multiple Spot Finding

```javascript
findMultipleBuildingSpots(buildingType, centerTile, searchRadius, count, customRequirements)
```

- Finds multiple non-overlapping spots
- Used for placing multiple farms around a mill

### Faction Initialization

Factions place buildings during initialization (`Houses.js`):

#### Building Priorities

1. **Primary Buildings**: Mill, Farm, Lumbermill, Mine (based on faction strategy)
2. **Secondary Buildings**: Additional mills, farms, resource buildings
3. **Tertiary Buildings**: Advanced buildings (forge, garrison, etc.)

#### Resource Assessment

```javascript
assessBaseResources(hq, radius, z)
```

- Counts terrain types within base radius
- Identifies available resources
- Finds cave entrances
- Calculates buildable space

#### Building Placement Logic

```javascript
// Example: Place mill
var millSpot = global.tilemapSystem.findBuildingSpot('mill', self.hq, 5, {
  excludeTiles: excludedTiles
});

if(millSpot){
  // Store original terrain before changing tiles
  var baseTerrain = [];
  for(var i in millSpot.plot){
    baseTerrain.push(getTile(0, millSpot.plot[i][0], millSpot.plot[i][1]));
  }
  
  // Update tiles
  for(var i in millSpot.plot){
    tileChange(0, plot[i][0], plot[i][1], 13);
    tileChange(3, plot[i][0], plot[i][1], 'mill' + i);
    matrixChange(0, plot[i][0], plot[i][1], 1);
  }
  
  // Create building (built: true)
  Mill({
    house: self.id,
    built: true,
    plot: millSpot.plot,
    topPlot: millSpot.topPlot,
    baseTerrain: baseTerrain  // For adaptive base layer rendering
  });
}
```

### Faction-Specific Building Strategies

Different factions have different building priorities:

#### Goths
- Focus on farming: 2 mills, multiple farms
- Market for trading
- Balanced resource gathering

#### Franks
- Maximum farming: 2 mills, many farms
- Open grassland preference
- Agricultural focus

#### Celts
- Mining specialists: 2 mines near cave entrance
- Forest access for lumber
- Cave proximity critical

#### Teutons
- Mining + Lumber: 2 mines, 2 lumbermills
- Rock/mountain terrain preference
- Balanced resource gathering

#### Norsemen
- Coastal focus: Dock placement
- Water access critical
- Naval capabilities

### Colony System

Buildings outside base territory are marked as colonies:

```javascript
if(building && this.house.isInBaseTerritory && !this.house.isInBaseTerritory(building.x, building.y)){
  building.isColony = true;
}
```

Colonies are remote outposts that extend faction influence.

---

## Technical Details

### Coordinate Systems

#### Plot Coordinates

Building plots use relative coordinates from center tile:

```javascript
// Example: 3x2 forge
plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]]
// Center at [c, r] becomes:
// [c+0, r+0], [c+1, r+0], [c+2, r+0]
// [c+0, r-1], [c+1, r-1], [c+2, r-1]
```

#### Wall Coordinates

Walls are one row above the top plot row:

```javascript
// For 3x2 forge, top row is at r-1
// Walls are at r-2
walls: [[0,-2],[1,-2],[2,-2]]
// Becomes: [c+0, r-2], [c+1, r-2], [c+2, r-2]
```

#### TopPlot Coordinates

Upper floor tiles (layer 5):

```javascript
// For garrison, topPlot is subset of walls
topPlot: [[1,-3],[2,-3],[3,-3]]
// Becomes: [c+1, r-3], [c+2, r-3], [c+3, r-3]
```

### Tile Layers

The game uses multiple tile layers:

- **Layer 0**: Terrain (grass, water, forest, etc.)
- **Layer 3**: Building ground markers (building identification)
- **Layer 4**: Walls (visual and functional)
- **Layer 5**: Upper floors (second floor tiles)
- **Layer 6**: Construction progress (work value tracking)

### Matrix System

Pathfinding uses matrix values:

- **0**: Walkable (open terrain, doorways, stairs)
- **1**: Blocked (buildings, walls, obstacles)
- **2**: Transition (doors, stairs, cave entrances)

### Building Plot Generation

The TilemapSystem generates plots:

```javascript
generatePlot(centerTile, size) {
  // Generates rectangular plot
  // Pattern: BOTTOM row first, then top rows
  // This matches visual rendering order
}
```

### Direction-Dependent Buildings

Docks have direction-dependent plots:

```javascript
// Right-facing (default)
plot: [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1]]

// Up-facing
plotUp: [[-1,0],[0,0],[1,0],[-1,-1],[0,-1],[1,-1]]

// Left-facing
plotLeft: [[-2,0],[-1,0],[0,0],[-2,-1],[-1,-1],[0,-1]]

// Down-facing
plotDown: [[-1,1],[0,1],[1,1],[-1,0],[0,0],[1,0]]
```

### Work Value System

Construction progress tracked on layer 6:

- **Initial**: 0 (foundation placed)
- **Work**: Increments with each work action
- **Required**: `building.req` (default 5)
- **Completion**: All plot tiles >= req value

### Building Entity Storage

All buildings stored in global object:

```javascript
Building.list = {
  buildingId1: BuildingEntity1,
  buildingId2: BuildingEntity2,
  // ...
}
```

### Client-Side Building Entities

Client receives building data via `getInitPack()`:

```javascript
{
  id: building.id,
  type: building.type,
  occ: building.occ,
  plot: building.plot,
  walls: building.walls,
  topPlot: building.topPlot,
  baseTerrain: building.baseTerrain || []  // Original terrain values for adaptive rendering
}
```

### Adaptive Base Layer Rendering

Buildings use an adaptive base layer system that preserves the original terrain appearance:

#### Base Terrain Storage
- **When**: Original terrain values are captured before any tile changes during foundation placement
- **Where**: Stored in `building.baseTerrain` array, one value per plot tile
- **Purpose**: Allows client-side rendering to show appropriate base layer (grass or rocks) based on original terrain

#### Rendering Logic
- **Grass Base**: Used for buildings on grass, brush, light forest, or heavy forest (terrain values 1-3, 7)
- **Rocks Base**: Used for buildings on rocks or mountains (terrain values 4-5)
- **Implementation**: Client-side `MapRenderer` uses `baseTerrain` to determine which base image to draw under building tiles

#### Terrain Value Handling
- Terrain values are stored as floats (e.g., 4.0-4.9 for rocks, 5.0-5.9 for mountains)
- Rendering uses `Math.floor(terrain)` for terrain type comparison
- Defaults to grass base if `baseTerrain` is missing or empty (backward compatibility)

### Performance Considerations

- **Building Service Caching**: Buildings cached per day for AI queries
- **TilemapSystem Caching**: Pathfinding grids cached with versioning
- **Spot Scoring**: Efficient scoring algorithm for AI placement
- **Batch Updates**: Multiple buildings placed during faction initialization

---

## Summary

The building system in Lambic is a comprehensive framework that handles:

1. **Foundation Placement**: Validation, material checking, terrain requirements
2. **Construction**: Work-based progress system with completion triggers
3. **Entity Management**: Building entities with properties and methods
4. **Building Types**: 20+ building types across 4 tiers
5. **Validation**: Centralized preview and validation system
6. **Completion**: Complex tile updates, interior items, faction updates
7. **Interactions**: Enter/exit, work assignments, building links
8. **AI Integration**: Faction building placement and management

The system supports both player and AI building placement with different validation rules, unified construction systems for complex buildings, and extensive building-specific mechanics.

