# Pathfinding System - Complete Technical Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Architecture](#core-architecture)
3. [Player Pathfinding](#player-pathfinding)
4. [NPC Pathfinding](#npc-pathfinding)
5. [Multi-Z Level Navigation](#multi-z-level-navigation)
6. [Caching System](#caching-system)
7. [Performance Optimization](#performance-optimization)
8. [Integration Points](#integration-points)
9. [Special Cases](#special-cases)
10. [Data Structures](#data-structures)
11. [API Reference](#api-reference)
12. [File Locations](#file-locations)

---

## System Overview

The pathfinding system is a multi-layered architecture built on the `pathfinding` npm package (v0.4.18) using the A* algorithm. It handles navigation for both players and NPCs across multiple z-levels (overworld, caves, buildings, underwater) with sophisticated caching, throttling, and optimization mechanisms.

### Key Characteristics

- **Algorithm**: A* with diagonal movement, corner avoidance, Euclidean heuristic
- **Caching**: Two-tier system (path cache + grid cache) with LRU eviction
- **Throttling**: Frame-based request limiting (10 concurrent operations per frame)
- **Multi-Z Support**: Handles complex journeys across different z-levels
- **Entity-Specific**: Different behaviors for players vs NPCs
- **Performance**: Profiling, hotspot tracking, and automatic optimization

---

## Core Architecture

### 1. PathfindingSystem

**File**: `server/js/core/PathfindingSystem.js`

The low-level pathfinding engine that interfaces with the A* library.

#### Configuration

```javascript
{
  allowDiagonal: true,
  dontCrossCorners: true,
  heuristic: PF.Heuristic.euclidean,
  weight: 1.2
}
```

#### Key Components

**Path Cache**:
- Size: 2000 entries
- TTL: 60 seconds
- LRU eviction strategy
- Cache key format: `${startX},${startY}_${endX},${endY}_${layer}${optionsKey}`

**Grid Cache**:
- Size: 10 grids
- TTL: 60 seconds
- Delegates key generation to TilemapSystem
- Stores generated pathfinding grids to avoid regeneration

**Request Queue** (Built-in):
- PathfindingSystem has a built-in queue system (not using separate PathfindingRequestQueue.js)
- Max concurrent: 10 operations per frame (`maxConcurrentPathfinding`)
- Frame reset: >16ms since last reset
- Queue processing: Up to 5 requests per call (`maxProcessPerCall`)
- Individual operation timeout: 100ms (`maxPathfindingTime`) - prevents blocking on slow pathfinding
- Note: `PathfindingRequestQueue.js` exists but is not currently integrated into PathfindingSystem

**Object Pool**:
- Vectors: 50 pooled `[x, y]` arrays
- Paths: 50 pooled path arrays
- Reduces memory allocations

#### Main Methods

**`findPath(start, end, layer, options, callback)`**
- Primary pathfinding entry point
- Checks cache first (synchronous)
- Throttles if frame budget exceeded (queues request)
- Generates grid if not cached
- Runs A* algorithm
- Smooths path
- Caches result
- Returns path array or null

**`smoothPath(path, layer)`**
- Reduces waypoints using line-of-sight checks
- Finds furthest reachable point in straight line
- Skips intermediate waypoints when possible
- Not applied to cave paths (narrow tunnels)

**`hasLineOfSight(start, end, layer)`**
- Bresenham-like line traversal
- Checks each tile between start and end
- Returns false if any tile is blocked
- Early exit for adjacent tiles

**`getProfilingStats()`**
- Returns comprehensive performance metrics
- Cache hit rates, timing statistics, hotspots
- Layer usage statistics

### 2. TilemapSystem

**File**: `server/js/core/TilemapSystem.js`

Generates pathfinding grids from tile data and manages z-level to layer mapping.

#### Z-Level to Layer Mapping

| Z-Level | Layer | Description |
|--------|-------|-------------|
| 0 | 0 | Overworld |
| -1 | 1 | Cave/Underworld |
| 1 | 3 | Building floor 1 |
| 2 | 5 | Building floor 2 |
| -2 | 8 | Cellar |
| -3 | 2 | Underwater |

#### Grid Generation Process

**`generatePathfindingGrid(layer, options)`**

1. Check cache with version validation
2. Iterate through all tiles in map
3. For each tile, determine walkability:
   - Check `isWalkable(layer, x, y, tile)`
   - Apply pathfinding options in priority order:
     1. `allowStartTile` - Always walkable (highest priority)
     2. `waterOnly` - Inverted: only water tiles (0) walkable
     3. `ghost` - Ghosts can walk on water
     4. `targetDoor/targetStairs/targetCaveEntrance/targetWaterTile` - Explicit destination
     5. `targetWaterTile` with water - All water walkable when targeting water
     6. Water tiles - Blocked by default (unless ghost or targeting water)
     7. Cave entrances - Blocked unless explicitly targeted
     8. Transition tiles - Blocked unless explicitly targeted
     9. Normal walkability from `isWalkable()` check
4. Convert to binary grid: `0 = walkable, 1 = blocked`
5. Cache grid with version key

#### Walkability Matrix

The system uses global walkability matrices:
- `matrixO` - Overworld (z=0)
- `matrixU` - Underworld/Cave (z=-1)
- `matrixB1` - Building floor 1 (z=1)
- `matrixB2` - Building floor 2 (z=2)
- `matrixB3` - Cellar (z=-2)
- `matrixW` - Underwater (z=-3)

Matrix values:
- `0` = Walkable
- `1` = Blocked
- `2` = Transition tile (door, stairs, cave entrance)

#### Grid Cache Key Generation

**`generateGridCacheKey(layer, options)`**

Format: `${layer}_${options}_v${version}`

Options encoded as suffixes:
- `_water` - Water-only navigation
- `_nodoors` - Avoid doors
- `_noexits` - Avoid cave exits
- `_nocaves` - Avoid cave entrances
- `_nostairs` - Avoid stairs
- `_spdoor` - Allow specific door
- `_ghost` - Ghost mode
- `_start${x},${y}` - Allowed start tile
- `_tdoor${x},${y}` - Target door
- `_tstairs${x},${y}` - Target stairs
- `_tcave${x},${y}` - Target cave entrance
- `_twater${x},${y}` - Target water tile

Version included to invalidate cache when tiles change.

### 3. PathfindingManager

**File**: `server/js/core/PathfindingManager.js`

Unified high-level API for all pathfinding requests. Single entry point ensures consistent behavior.

**Singleton Pattern**: PathfindingManager is exported as a singleton instance. Import using:
```javascript
const pathfindingManager = require('./core/PathfindingManager');
// Use the singleton instance directly
pathfindingManager.requestPath(entity, destination, options);
```

**Note**: While PathfindingManager provides a unified API, many parts of the codebase still call `TilemapSystem.findPath()` or `Entity.getPath()` directly. PathfindingManager is available but not universally adopted.

#### Main Method

**`requestPath(entity, destination, options)`**

**Destination Formats**:
- Array: `[col, row]` - Uses entity's current z-level
- Object: `{z, col, row}` or `{z, loc: [col, row]}` - Explicit z-level

**Process**:
1. Validate inputs
2. Parse destination format
3. Check if already at destination
4. Check pathfinding cooldown
5. Handle multi-z pathfinding (delegates to `createMultiZPath`)
6. Check path cache
7. Resolve layer from z-level
8. Build pathfinding options based on context
9. Request path from TilemapSystem
10. Smooth path (except caves)
11. Cache result
12. Return path

**Option Building** (`_buildPathOptions`):
- Detects doorway destinations
- Detects cave exit destinations
- Handles starting from cave exits
- Context-aware option generation

### 4. TransitionPlanner

**File**: `server/js/core/TransitionPlanner.js`

Provides z-level to layer mapping and transition context helpers.

#### Static Methods

- `getLayerForZ(z)` - Maps z-level to tilemap layer
- `getZForLayer(layer)` - Maps layer to z-level
- `needsCrossBuildingNav(startZ, endZ)` - Checks if building transition needed
- `buildContext(entity, destination)` - Creates navigation context

### 5. MovementSystem

**File**: `server/js/core/MovementSystem.js`

Movement utilities, stuck detection, and recovery mechanisms.

#### Stuck Detection

**Thresholds**:
- Stuck threshold: 150 ticks without movement
- Recovery threshold: 200 ticks
- Max recalculation attempts: 3

**Recovery Strategies**:
1. Skip ahead in path (up to 3 waypoints)
2. Recalculate path to destination
3. Random movement in valid direction

#### Direction Calculation

8-way movement support:
- Cardinal: up, down, left, right
- Diagonal: upLeft, upRight, downLeft, downRight

Direction codes: `'u'`, `'d'`, `'l'`, `'r'`, `'ul'`, `'ur'`, `'dl'`, `'dr'`, `'lu'`, `'ru'`, `'ld'`, `'rd'`, `'c'`

---

## Player Pathfinding

### Click Navigation Flow

**Entry Point**: `clickNavigate` message from client (`lambic.js` line ~6782)

#### Step-by-Step Process

1. **Input Validation**
   - Check if player is aboard ship (disabled if true)
   - Validate `tileX`, `tileY`, `z` parameters
   - Map z-level to tile layer for tile data lookup

2. **Tile Analysis**
   - Detect transition tiles:
     - Water tiles (`TERRAIN.WATER = 0`)
     - Cave entrances (`TERRAIN.CAVE_ENTRANCE = 6`)
     - Building doors (`TERRAIN.DOOR_OPEN = 14`, `TERRAIN.DOOR_OPEN_ALT = 16`)
   - Detect foundation/construction tiles (11, 11.5, 12, 12.5, 13, 15, 17)
   - Check walkability based on player state:
     - On ship: Only water tiles walkable
     - Underwater: Land tiles (non-water) walkable
     - On foot: All walkable tiles + transition tiles if clicked
     - Ghost mode: Special handling

3. **Pathfinding Options Building**

   **Ghost Mode**:
   ```javascript
   {
     ghost: true,
     allowStartTile: startLoc  // If ghost is on water
   }
   ```

   **Transition Tiles** (when clicked):
   - Building door: `{allowSpecificDoor: true, targetDoor: [x, y]}`
   - Cave entrance: `{targetCaveEntrance: [x, y]}`
   - Water tile: `{targetWaterTile: [x, y]}`

   **Non-Transition Tiles** (when not clicked):
   ```javascript
   {
     avoidDoors: true,
     avoidCaveEntrances: true,
     avoidWater: true  // Non-ghosts only
   }
   ```

   **Foundation Tiles**:
   ```javascript
   {
     allowSpecificDoor: true,
     targetDoor: [x, y],
     avoidDoors: true,      // Unless ghost
     avoidCaveEntrances: true, // Unless ghost
     avoidWater: true        // Unless ghost
   }
   ```

   **Cave Navigation**:
   - If targeting cave exit: `{allowSpecificDoor: true, targetDoor: [x, y]}`
   - Otherwise: `{avoidCaveExits: true}`

4. **Layer Selection**

   Based on z-level:
   - z=0 → layer 0 (overworld)
   - z=-1 → layer 1 (cave)
   - z=-2 → layer 8 (cellar)
   - z=-3 → layer 2 (underwater)
   - z=1 → layer 3 (building floor 1)
   - z=2 → layer 5 (building floor 2)

5. **Path Generation**

   ```javascript
   var path = global.tilemapSystem.findPath(startLoc, [tileX, tileY], layer, options);
   ```

   - Smooth path (except caves)
   - Skip first waypoint if it matches start location
   - Store on player: `player.path`, `player.pathCount = 0 or 1`

6. **State Updates**

   - Clear `zTransitionHalt` flag
   - Clear `attackMoveTarget`
   - Clear `workTargetTile`
   - Set `autoAttackPaused = true`

### Player Movement Execution

**File**: `server/js/Entity.js` (line ~3990)

**Path Following**:
- Check if `player.path` exists and has waypoints
- Follow waypoints sequentially using `pathCount` index
- Clear path when destination reached
- Resume combat/attack-move when path completes

**Special Behaviors**:
- Players can navigate during combat (path overrides combat movement)
- Attack-move resumes after path completion
- Work commands interrupted by navigation
- Path cleared when z-level changes

### Work Commands

**Entry Point**: `workAtTile` message from client (`lambic.js` line ~7019)

**Process**:
1. Validate tile is workable (water, forest, brush, rocks, mountain, foundation, farm)
2. Check if player is adjacent to target tile
3. If not adjacent:
   - Find closest adjacent walkable tile
   - Pathfind to adjacent tile
   - Store work target for after path completion
4. If adjacent: Start work immediately

**Work Types**:
- Fishing (water tiles)
- Chopping (heavy/light forest)
- Clearing (brush)
- Mining (rocks, mountain)
- Building (foundation/construction tiles)
- Farming (farm tiles)

---

## NPC Pathfinding

### Entity.getPath()

**File**: `server/js/Entity.js` (line ~5061)

**Entry Point**: `entity.getPath(z, c, r)`

#### Cooldown System

- `pathCooldown` prevents spam (90 ticks = 1.5s at 60fps)
- Applied on pathfinding failure
- Blocks pathfinding requests while active

**Cooldown Bypass**:
- Multi-z transitions bypass cooldown: When `|targetZ - currentZ| >= 1`, cooldown is ignored
- Waypoint processing bypasses cooldown: When processing `multiZWaypoints`, cooldown is ignored
- This ensures critical navigation requests are not blocked by cooldown timers

#### Multi-Z Pathfinding

If `|targetZ - currentZ| > 1`:
1. Call `createMultiZPath(self.z, start, z, [c, r])`
2. Store `multiZWaypoints` array on entity
3. Set `currentWaypoint = 0`
4. Pathfind to first waypoint
5. Continue to subsequent waypoints after transitions

#### Z-Level Specific Handling

**Overworld (z=0)**:
```javascript
var isOnWater = getLocTile(0, self.x, self.y) == 0;
var pathLayer = (self.ghost && isOnWater) ? 0 : (isOnWater ? 3 : 0);
var options = {};
if (isTargetDoorway) {
  options.allowSpecificDoor = true;
  options.targetDoor = [c, r];
}
if (self.ghost) {
  options.ghost = true;
  if (isOnWater) options.allowStartTile = start;
}
var path = global.tilemapSystem.findPath(start, [c, r], pathLayer, options);
// Smooth path
```

**Cave (z=-1)**:
```javascript
// Layer 1 (underworld)
var options = {};
if (isTargetCaveExit) {
  options.allowSpecificDoor = true;
  options.targetDoor = [c, r];
}
if (isStartCaveExit) {
  options.allowStartTile = start;
}
var path = global.tilemapSystem.findPath(start, [c, r], 1, options);
// NO smoothing (caves have narrow tunnels)
```

**Building Floor 1 (z=1)**:
```javascript
// Layer 3
var options = {};
if (targetTile is stairs) {
  options.targetStairs = [c, r];
  options.avoidStairs = true;
}
var path = global.tilemapSystem.findPath(start, [c, r], 3, options);
// Smooth path
// If different building: path to exit first, then re-pathfind
```

**Building Floor 2 (z=2)**:
```javascript
// Layer 5
var options = {};
if (targetTile is upstairs) {
  options.targetStairs = [c, r];
  options.avoidStairs = true;
}
var path = global.tilemapSystem.findPath(start, [c, r], 5, options);
// Smooth path
// If different building: path to stairs first
```

**Cellar (z=-2)**:
```javascript
// Layer 8
if (same building) {
  var path = global.tilemapSystem.findPath(start, [c, r], -2);
  // Smooth path
} else {
  // Move to stairs first
  self.moveTo(Building.list[b].dstairs);
}
```

**Underwater (z=-3)**:
```javascript
// Layer 2
var path = global.tilemapSystem.findPath(start, [c, r], 2, {});
// Smooth path
```

#### Cross-Z Navigation

**Overworld → Cave**:
```javascript
var cave = selectCaveEntrance(self, z, [c, r], preferredEntrance);
var options = {
  targetCaveEntrance: [cave[0], cave[1]],
  avoidCaveEntrances: true
};
var path = global.tilemapSystem.findPath(start, [cave[0], cave[1]], 0, options);
self.caveEntrance = cave; // Store for exit
```

**Cave → Overworld**:
```javascript
var cave = self.caveEntrance || findNearestCaveEntrance();
var options = {
  allowSpecificDoor: true,
  targetDoor: [cave[0], cave[1] + 1] // Exit is one tile south
};
var path = global.tilemapSystem.findPath(start, [cave[0], cave[1] + 1], 1, options);
```

**Overworld → Building**:
```javascript
var ent = Building.list[db].entrance;
var options = {
  allowSpecificDoor: true,
  targetDoor: [ent[0], ent[1]]
};
var path = global.tilemapSystem.findPath(start, [ent[0], ent[1]], 0, options);
```

**Building → Overworld**:
```javascript
var exit = Building.list[b].entrance;
self.moveTo([exit[0], exit[1] + 1]);
```

**Building Floor Transitions** (same building):
- Floor 1 → Floor 2: `self.moveTo(Building.list[b].ustairs)`
- Floor 2 → Floor 1: `self.moveTo(Building.list[b].ustairs)`
- Floor 1 → Cellar: `self.moveTo(Building.list[b].dstairs)`
- Cellar → Floor 1: `self.moveTo(Building.list[b].dstairs)`

### NPC Transition System

#### Transition Intent

**Purpose**: Prevents accidental transitions when NPCs don't actually need to cross z-levels.

**Properties**:
- `transitionIntent`: Target z-level for intended transition
- `transitionState`: Current state (`'none'`, `'entering'`, `'exiting'`)

**Behavior**:
- Set when NPC needs to cross z-levels
- Checked before allowing transition
- Cleared after successful transition

#### Transition Rules

**Serfs**:
- Can transition when at exit tile even if path doesn't match exactly
- Preserve path for multi-floor navigation

**Idle NPCs**:
- Can transition when on stairs regardless of path destination
- May have wandered onto stairs

**Combat NPCs**:
- Standard transition restrictions apply
- Must be at transition tile with matching intent

#### Path Preservation

NPCs preserve paths across transitions for multi-floor navigation:
- Path not cleared on z-level change
- `pathEnd` updated to reflect new destination
- Path continues after transition completes

### NPC Movement Execution

**Path Following**:
- Uses `pathCount` to track current waypoint
- Moves toward next waypoint in `path` array
- Updates `pathCount` when waypoint reached
- Clears path when destination reached

**Stuck Handling**:
- MovementSystem detects stuck entities
- Skips ahead in path (up to 3 waypoints)
- Recalculates path if still stuck
- Random movement as last resort

---

## Multi-Z Level Navigation

### createMultiZPath()

**File**: `lambic.js` (line ~1310)

**Purpose**: Plans complex journeys across multiple z-levels.

#### Process

1. **Determine Optimal Route**
   ```javascript
   var route = findOptimalZRoute(startZ, targetZ);
   // Returns array of z-levels: [startZ, intermediateZ1, intermediateZ2, ..., targetZ]
   ```

2. **Find Transition Points**
   For each z-level transition in route:
   ```javascript
   var transition = findZTransition(fromZ, toZ, fromLoc, targetLoc);
   // Returns: {from: [x, y], to: [x, y], action: 'enter_cave'|'exit_cave'|...}
   ```

3. **Create Waypoints**
   ```javascript
   var waypoint = {
     z: transitionZ,
     loc: [transitionX, transitionY],
     action: 'enter_cave'|'exit_cave'|'enter_building'|'exit_building'|'go_upstairs'|'go_downstairs'|'go_to_cellar'
   };
   ```

4. **Return Waypoint Array**
   ```javascript
   return [waypoint1, waypoint2, ..., finalDestination];
   ```

### findOptimalZRoute()

**File**: `lambic.js` (line ~1374)

**Purpose**: Determines optimal sequence of z-levels to traverse.

#### Predefined Routes

```javascript
{
  '-1->2': [-1, 0, 1, 2],    // Cave → Building floor 2 via overworld and building
  '-1->-2': [-1, 0, 1, -2],  // Cave → Cellar via overworld and building
  '2->-1': [2, 1, 0, -1],    // Building floor 2 → Cave via building, overworld
  '-3->0': [-3, 0],          // Underwater → Overworld
  '-3->1': [-3, 0, 1],       // Underwater → Building via overworld
  '-3->2': [-3, 0, 1, 2],    // Underwater → Building floor 2
  '-3->-1': [-3, 0, -1],     // Underwater → Cave via overworld
  '-3->-2': [-3, 0, 1, -2]   // Underwater → Cellar via overworld and building
}
```

**Note**: Direct movement between -2 (cellar) and -1 (cave) is not possible. Routes like `-2->-1` or `-1->-2` that appear in code are invalid and should not be used. Movement between these z-levels must go through intermediate z-levels (e.g., via overworld and building).

**Fallback Logic**:
- If `|startZ - targetZ| <= 1`: Direct transition `[startZ, targetZ]`
- If `startZ !== 0`: Go through overworld `[startZ, 0, targetZ]`
- Default: `[startZ, targetZ]`

### findZTransition()

**File**: `lambic.js` (line ~1411)

**Purpose**: Finds transition points between z-levels.

#### Transition Types

**Cave ↔ Overworld**:
```javascript
// Cave → Overworld
var bestEntrance = findNearestCaveEntrance(fromLoc);
return {
  from: bestEntrance,
  to: [bestEntrance[0], bestEntrance[1] + 1],
  action: 'exit_cave'
};

// Overworld → Cave
var bestEntrance = findNearestCaveEntranceToTarget(targetLoc);
return {
  from: bestEntrance,
  to: [bestEntrance[0], bestEntrance[1] + 1],
  action: 'enter_cave'
};
```

**Building ↔ Overworld**:
```javascript
// Overworld → Building
var building = getBuilding(targetLoc);
return {
  from: building.entrance,
  to: [building.entrance[0], building.entrance[1] + 1],
  action: 'enter_building'
};

// Building → Overworld
var building = getBuilding(fromLoc);
return {
  from: [building.entrance[0], building.entrance[1] + 1],
  to: building.entrance,
  action: 'exit_building'
};
```

**Building Floors**:
```javascript
// Floor 1 → Floor 2
return {
  from: building.ustairs,
  to: building.ustairs,
  action: 'go_upstairs'
};

// Floor 2 → Floor 1
return {
  from: building.ustairs,
  to: building.ustairs,
  action: 'go_downstairs'
};

// Floor 1 → Cellar
return {
  from: building.dstairs,
  to: building.dstairs,
  action: 'go_to_cellar'
};

// Cellar → Floor 1
return {
  from: building.dstairs,
  to: building.dstairs,
  action: 'exit_cellar'
};
```

### Multi-Z Execution

**Entity Properties**:
- `multiZWaypoints`: Array of waypoints `[{z, loc, action, nextZ, nextLoc}, ...]`
- `currentWaypoint`: Index of current waypoint

**Execution Flow**:
1. Entity stores `multiZWaypoints` array
2. Pathfind to first waypoint's `loc` on waypoint's `z` level
3. When waypoint reached:
   - Execute transition action (change z-level to `nextZ`, update position to `nextLoc`)
   - Increment `currentWaypoint`
   - If more waypoints exist, pathfind to next waypoint's `loc` on its `z` level
4. Repeat until all waypoints completed (final waypoint has `nextZ: null`)

---

## Caching System

### Path Cache

**Location**: `PathfindingSystem.pathCache`

**Structure**: `Map<cacheKey, {path: Array, timestamp: number}>`

**Cache Key Format**: `${startX},${startY}_${endX},${endY}_${layer}${optionsKey}`

**Options Key Encoding**:
- `_door_${x},${y}` - Allow specific door
- `_water` - Water-only navigation
- `_nodoors` - Avoid doors
- `_nowater` - Avoid water
- `_nocaves` - Avoid cave entrances
- `_ghost` - Ghost mode
- `_${JSON.stringify(options)}` - Complex options fallback

**LRU Implementation**:
- `cacheAccessOrder`: Map tracking access order
- `cacheAccessCounter`: Increments on each access
- Eviction: Remove entry with lowest access counter when at capacity

**Configuration**:
- Max size: 2000 entries
- TTL: 60 seconds (60000ms)
- Cleanup: Every 100 cache operations

### Grid Cache

**Dual Cache System**: Both TilemapSystem and PathfindingSystem maintain separate grid caches.

**TilemapSystem Grid Cache**:
- **Location**: `TilemapSystem.pathfindingCache`
- **Structure**: `Map<cacheKey, grid>` (grids stored directly, no timestamp wrapper)
- **Size**: 50 grids max
- **TTL**: N/A (version-based invalidation only)
- **Purpose**: Primary cache for generated pathfinding grids
- **Invalidation**: Version-based (cache keys include version number)

**PathfindingSystem Grid Cache**:
- **Location**: `PathfindingSystem.gridCache`
- **Structure**: `Map<cacheKey, {grid: Array, timestamp: number}>`
- **Size**: 10 grids max
- **TTL**: 60 seconds
- **Purpose**: Secondary cache layer with TTL-based expiration
- **Invalidation**: Both version-based (via cache key) and TTL-based

**Cache Key Format**: `${layer}_${options}_v${version}`

**Options Encoding**: See [Grid Cache Key Generation](#grid-cache-key-generation)

**Versioning**:
- `gridVersions`: Map tracking version per layer (in TilemapSystem)
- Incremented when tiles change via `TilemapSystem.setTile()`
- Cache keys include version, causing automatic misses on stale data
- Both caches use the same version-based key generation

**Cache Flow**:
1. PathfindingSystem checks its own grid cache first
2. If miss, requests grid from TilemapSystem
3. TilemapSystem checks its cache, generates if needed
4. PathfindingSystem caches the result in its own cache

### Cache Invalidation

**Automatic**:
- Tile changes: `TilemapSystem.setTile()` increments grid version
- Version mismatch: Cache keys include version, stale entries automatically miss

**Manual**:
- `PathfindingSystem.clearCache()` - Clears all path cache
- `TilemapSystem.invalidatePathfindingCache(layer)` - Invalidates grid cache for layer
- `TilemapSystem.invalidatePathfindingCache()` - Invalidates all grid caches

**Periodic Cleanup**:
- Expired entries removed every 100 cache operations
- `cleanupExpiredCache()` removes entries older than TTL

---

## Performance Optimization

### Throttling

**Frame Concurrency**:
- Max 10 concurrent pathfinding operations per frame (`maxConcurrentPathfinding`)
- Frame reset: >16ms since last reset
- Queue overflow: Requests queued for next frame when limit reached

**Queue Processing**:
- `processPathfindingQueue()` handles up to 5 queued requests per call (`maxProcessPerCall`)
- Processes requests when frame budget allows (up to 10 concurrent operations per frame)
- No explicit time budget per frame - throttling is based on concurrent operation count

**Operation Timeout**:
- Individual pathfinding operations have a 100ms timeout (`maxPathfindingTime`)
- Prevents blocking on slow pathfinding operations
- This is a safety timeout, not a frame budget

**Priority Levels**:
- Note: Priority-based processing is not currently implemented in the built-in queue
- All requests are processed in FIFO order when frame capacity is available

### Path Smoothing

**Algorithm**: Line-of-sight based waypoint reduction

**Process**:
1. Start with first waypoint
2. Find furthest waypoint with line-of-sight
3. Add that waypoint, skip intermediate ones
4. Repeat from new waypoint

**Line-of-Sight Check**:
- Bresenham-like line traversal
- Check each tile between start and end
- Early exit on blocked tile
- Returns false if any tile is blocked

**Exceptions**:
- Caves: No smoothing (narrow tunnels)
- Paths with ≤2 waypoints: No smoothing needed

### Object Pooling

**Reused Objects**:
- Vectors: `[x, y]` arrays (pool size: 50)
- Paths: Path arrays (pool size: 50)

**Benefits**:
- Reduces memory allocations
- Improves garbage collection performance
- Faster pathfinding operations

### Profiling

**Metrics Tracked**:
- Request counts (frame, second, total)
- Cache hit/miss rates
- Pathfinding times (avg, max, min)
- Grid generation times
- Smoothing times
- Failed paths
- Hotspots (frequent pathfinding locations)
- Layer usage statistics

**Logging**: Every 10 seconds if enabled

**Access**: `PathfindingSystem.getProfilingStats()`

### PathfindingDiagnostics

**File**: `server/js/core/PathfindingDiagnostics.js`

Aggregates performance data from multiple pathfinding-related systems to provide comprehensive diagnostics.

#### Purpose

- Collects stats from PathfindingSystem, stuck entity analytics, and memory usage
- Monitors performance thresholds and generates warnings
- Provides performance scoring and issue identification

#### Key Features

**Performance Thresholds**:
- Max average pathfinding time: 5ms
- Max pathfinding time: 50ms
- Max requests per second: 100
- Min cache hit rate: 30%
- Max stuck events per minute: 20

**Metrics Collected**:
- Pathfinding system stats (from `PathfindingSystem.getProfilingStats()`)
- Stuck entity statistics (from `stuckEntityAnalytics`)
- Memory usage (heap, RSS)
- Performance warnings based on thresholds

**Methods**:
- `collectStats()` - Gathers all performance data
- `logDiagnostics()` - Logs comprehensive diagnostics (every 10 seconds)
- `getPerformanceScore()` - Returns performance score (0-100)
- `getTopIssues(limit)` - Identifies top performance issues
- `resetMetrics()` - Resets all collected metrics

**Usage**:
```javascript
const diagnostics = require('./core/PathfindingDiagnostics');
const stats = diagnostics.collectStats();
const score = diagnostics.getPerformanceScore();
const issues = diagnostics.getTopIssues(5);
```

**Note**: PathfindingDiagnostics is a separate diagnostic tool and does not affect pathfinding performance. It aggregates data for monitoring purposes only.

---

## Integration Points

### Combat System

**File**: `server/js/core/SimpleCombat.js`

**Pathfinding During Combat**:
- Melee units: Pathfind to adjacent tile
- Ranged units: Pathfind directly to target
- `pathfindingFailures` counter (max 3 failures → end combat)
- Timeout-based failure detection (`_pathfindTimeout`)

**Attack-Move**:
- Players: Use pathfinding system for movement
- Resume attack when path completes

### Building System

**Pathfinding Integration**:
- Building entrances: Special handling with `allowSpecificDoor`, `targetDoor`
- Foundation tiles: Walkable during construction
- Building floors: Separate layers (3, 5, 8)
- Stairs: Transition points between floors

**Matrix Updates**:
- `matrixChange(z, x, y, value)` updates walkability
- Foundation tiles: Marked as walkable (value 0) during construction
- Invalidates pathfinding cache for affected layer

### Tilemap Integration

**TilemapSystem.findPath()**:
- Delegates to PathfindingSystem
- Handles layer resolution
- Applies grid caching
- Returns smoothed path

### Entity System

**Entity Properties**:
- `path`: Array of waypoints `[col, row]`
- `pathCount`: Current waypoint index
- `pathEnd`: `{z, loc: [col, row]}` destination
- `pathCooldown`: Cooldown timer
- `pathLocked`: Prevents path modification
- `multiZWaypoints`: Multi-z navigation waypoints
- `currentWaypoint`: Multi-z waypoint index
- `transitionIntent`: Z-level transition intent
- `transitionState`: Transition state machine state

**Entity Methods**:
- `getPath(z, c, r)`: Request pathfinding
- `moveTo(tz, tc, tr)`: Move to destination (triggers pathfinding)
- `navigateToTarget()`: Follow path waypoints

### Game Loop Integration

**File**: `server/js/core/OptimizedGameLoop.js`

**Processing**:
- Processes entities with paths
- Calls pathfinding queue processing
- Updates stuck detection
- Handles movement execution

---

## Special Cases

### Ghost Mode

**Pathfinding Behavior**:
- `ghost: true` option passed to pathfinding
- Can walk on water tiles
- `allowStartTile` if starting on water
- Uses overworld layer (0) even when on water

**Implementation**:
```javascript
if (entity.ghost) {
  options.ghost = true;
  if (isOnWater) {
    options.allowStartTile = startLoc;
  }
}
```

### Ships (Cargo Ships)

**Water-Only Navigation**:
- `waterOnly: true` option
- Only water tiles (tile value 0) are walkable
- Uses overworld layer (0)
- Pathfinding to adjacent water tiles near docks

**Implementation**:
```javascript
var path = global.tilemapSystem.findPath(currentLoc, closestWaterTile, 0, {
  waterOnly: true
});
```

### Underwater Navigation

**Layer**: 2 (underwater layer)

**Behavior**:
- All tiles walkable
- Direct pathfinding (no special options)
- Path smoothing applied

### Foundation/Construction Tiles

**Special Handling**:
- Treated as walkable targets
- `allowSpecificDoor: true`, `targetDoor: [x, y]`
- Avoid other transitions unless ghost
- Allows pathfinding to construction sites

**Tile Types**:
- `TERRAIN.BUILD_MARKER` (11)
- `TERRAIN.BUILD_MARKER_ALT` (11.5)
- Construction tiles (12, 12.5, 13, 15, 17)

### Cave Exits

**Special Handling**:
- Cave exits on layer 1 are at `[entrance[0], entrance[1] + 1]` (one tile south of overworld entrance)
- Must be explicitly targeted to allow pathfinding
- `allowSpecificDoor: true`, `targetDoor: [x, y]` when targeting
- `avoidCaveExits: true` when not targeting

### Transition Tiles

**Default Behavior**:
- Blocked by default in pathfinding grids
- Only allowed when explicitly targeted
- Prevents paths from accidentally routing through doors/caves/stairs

**Explicit Targeting**:
- `targetDoor: [x, y]` - Allow specific door
- `targetStairs: [x, y]` - Allow specific stairs
- `targetCaveEntrance: [x, y]` - Allow specific cave entrance
- `targetWaterTile: [x, y]` - Allow specific water tile

---

## Data Structures

### Path Format

**Structure**: `Array<[col, row]>`

**Example**:
```javascript
[
  [10, 20],  // Start (often skipped)
  [11, 20],
  [12, 21],
  [13, 22],
  [14, 23]   // Destination
]
```

### Path End Format

**Structure**: `{z: number, loc: [col, row]}`

**Example**:
```javascript
{
  z: 0,
  loc: [14, 23]
}
```

### Multi-Z Waypoint Format

**Structure**: `Array<{z: number, loc: [col, row], action: string, nextZ: number|null, nextLoc: [col, row]|null}>`

**Fields**:
- `z`: Current z-level for this waypoint
- `loc`: Location `[col, row]` for this waypoint
- `action`: Transition action string (e.g., `'enter_cave'`, `'exit_cave'`, `'go_upstairs'`, etc.)
- `nextZ`: Next z-level after transition (null for final destination)
- `nextLoc`: Next location after transition (null for final destination)

**Example**:
```javascript
[
  {
    z: 0,
    loc: [10, 20],
    action: 'enter_cave',
    nextZ: -1,
    nextLoc: [10, 21]
  },
  {
    z: -1,
    loc: [10, 21],
    action: 'exit_cave',
    nextZ: 0,
    nextLoc: [10, 20]
  },
  {
    z: 0,
    loc: [15, 25],
    action: 'arrive',
    nextZ: null,
    nextLoc: null
  }
]
```

### Pathfinding Options

**Structure**: `Object`

**Common Options**:
```javascript
{
  // Transition targeting
  allowSpecificDoor: boolean,
  targetDoor: [x, y],
  targetStairs: [x, y],
  targetCaveEntrance: [x, y],
  targetWaterTile: [x, y],
  
  // Avoidance
  avoidDoors: boolean,
  avoidCaveEntrances: boolean,
  avoidCaveExits: boolean,
  avoidWater: boolean,
  avoidStairs: boolean,
  
  // Special modes
  ghost: boolean,
  waterOnly: boolean,
  
  // Start tile exception
  allowStartTile: [x, y],
  
  // Layer override
  layer: number
}
```

### Grid Format

**Structure**: `Array<Array<number>>`

**Values**:
- `0` = Walkable
- `1` = Blocked

**Example**:
```javascript
[
  [0, 0, 0, 1, 1],
  [0, 0, 0, 1, 1],
  [0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0],
  [1, 1, 0, 0, 0]
]
```

---

## API Reference

### PathfindingSystem

#### `findPath(start, end, layer, options, callback)`

Find a path between two points.

**Parameters**:
- `start`: `[col, row]` - Start position
- `end`: `[col, row]` - End position
- `layer`: `number` - Tilemap layer
- `options`: `Object` - Pathfinding options (optional)
- `callback`: `Function` - Callback for async mode (optional)

**Returns**: `Array<[col, row]>|null` - Path waypoints or null if no path

**Example**:
```javascript
var path = pathfindingSystem.findPath([10, 20], [15, 25], 0, {
  avoidDoors: true
});
```

#### `smoothPath(path, layer)`

Reduce waypoints using line-of-sight checks.

**Parameters**:
- `path`: `Array<[col, row]>` - Original path
- `layer`: `number` - Tilemap layer

**Returns**: `Array<[col, row]>` - Smoothed path

#### `getProfilingStats()`

Get performance statistics.

**Returns**: `Object` - Statistics object

**Example**:
```javascript
{
  requests: {
    total: 1000,
    thisFrame: 5,
    thisSecond: 50
  },
  cache: {
    hits: 800,
    misses: 200,
    hitRate: "80.0%",
    size: 1500,
    maxSize: 2000
  },
  timing: {
    pathfinding: {
      avg: "5.23",
      max: "45.67",
      min: "0.12"
    }
  },
  paths: {
    successful: 950,
    failed: 50,
    successRate: "95.0%"
  },
  hotspots: [...],
  layerUsage: [...]
}
```

### TilemapSystem

#### `findPath(start, end, layer, options)`

Find a path using the tilemap system.

**Parameters**:
- `start`: `[col, row]` - Start position
- `end`: `[col, row]` - End position
- `layer`: `number` - Tilemap layer
- `options`: `Object` - Pathfinding options (optional)

**Returns**: `Array<[col, row]>|null` - Path waypoints or null if no path

#### `generatePathfindingGrid(layer, options)`

Generate a pathfinding grid for a layer.

**Parameters**:
- `layer`: `number` - Tilemap layer
- `options`: `Object` - Pathfinding options (optional)

**Returns**: `Array<Array<number>>` - Binary grid (0=walkable, 1=blocked)

#### `invalidatePathfindingCache(layer)`

Invalidate pathfinding cache for a layer.

**Parameters**:
- `layer`: `number|null` - Layer to invalidate (null = all layers)

### PathfindingManager

**Singleton Instance**: PathfindingManager is exported as a singleton. Use the default export:

```javascript
const pathfindingManager = require('./core/PathfindingManager');
// pathfindingManager is already an instance, use directly
```

#### `requestPath(entity, destination, options)`

Request a path for an entity (unified API).

**Parameters**:
- `entity`: `Object` - Entity requesting path
- `destination`: `[col, row]|{z, col, row}|{z, loc: [col, row]}` - Destination
- `options`: `Object` - Pathfinding options (optional)

**Returns**: `Array<[col, row]>|null` - Path waypoints or null if no path

**Example**:
```javascript
const pathfindingManager = require('./core/PathfindingManager');
var path = pathfindingManager.requestPath(player, [15, 25], {
  avoidDoors: true
});
```

**Usage Note**: While PathfindingManager provides a unified API, many parts of the codebase still use `TilemapSystem.findPath()` or `Entity.getPath()` directly. PathfindingManager is available for new code or refactoring efforts.

### Entity

#### `getPath(z, c, r)`

Request pathfinding to a destination.

**Parameters**:
- `z`: `number` - Target z-level
- `c`: `number` - Target column
- `r`: `number` - Target row

**Behavior**:
- Checks cooldown
- Handles multi-z pathfinding
- Checks cache
- Generates path
- Stores on entity: `entity.path`, `entity.pathCount`, `entity.pathEnd`

#### `moveTo(tz, tc, tr)`

Move entity to destination (triggers pathfinding).

**Parameters**:
- `tz`: `number` - Target z-level
- `tc`: `number` - Target column
- `tr`: `number` - Target row

---

## File Locations

### Core Systems

- `server/js/core/PathfindingSystem.js` - Low-level pathfinding engine
- `server/js/core/TilemapSystem.js` - Grid generation and tilemap management
- `server/js/core/PathfindingManager.js` - Unified pathfinding API
- `server/js/core/TransitionPlanner.js` - Z-level to layer mapping
- `server/js/core/MovementSystem.js` - Movement utilities and stuck detection
- `server/js/core/PathfindingRequestQueue.js` - Request queue with priority
- `server/js/core/PathfindingDiagnostics.js` - Performance diagnostics

### Integration Points

- `lambic.js` - Player click navigation, multi-z pathfinding functions
- `server/js/Entity.js` - Entity pathfinding methods (`getPath`, `moveTo`)
- `server/js/core/SimpleCombat.js` - Combat pathfinding integration
- `server/js/core/OptimizedGameLoop.js` - Game loop pathfinding processing

### Client

- `client/js/core/InputHandler.js` - Click navigation input handling

---

## Performance Characteristics

### Typical Performance

- **Path cache hit**: <1ms
- **Grid cache hit**: <2ms
- **Pathfinding (cache miss)**: 5-50ms (depends on distance, obstacles)
- **Grid generation**: 10-100ms (depends on map size, options)

### Optimization Strategies

1. **Aggressive Caching**: Path cache + grid cache with LRU eviction
2. **Frame Throttling**: Prevents lag spikes from too many simultaneous requests
3. **Path Smoothing**: Reduces waypoints, improving movement performance
4. **Object Pooling**: Reduces memory allocations
5. **Version-Based Invalidation**: No manual cache clearing needed
6. **Priority Queue**: Players get priority over NPCs

### Bottlenecks

1. **Large Map Sizes**: Increase grid generation time
2. **Complex Multi-Z Paths**: Require multiple pathfinding calls
3. **Many Simultaneous Requests**: Can queue up if frame budget exceeded
4. **Cave Pathfinding**: No smoothing produces more waypoints

### Monitoring

Use `PathfindingSystem.getProfilingStats()` to monitor:
- Cache hit rates (target: >70%)
- Average pathfinding time (target: <10ms)
- Hotspots (frequent pathfinding locations)
- Layer usage (identify problematic layers)

---

## Debugging

### Enable Debug Logging

```javascript
global.debugPathfinding = true;
```

This enables detailed logging in:
- PathfindingSystem
- MovementSystem
- BehaviorSystem
- GameContext

### Common Issues

**Paths Not Found**:
- Check if start/end tiles are walkable
- Verify pathfinding options (may be blocking valid paths)
- Check if entity is on correct z-level/layer
- Verify grid cache is not stale

**Slow Pathfinding**:
- Check cache hit rates (low hit rate = performance issue)
- Monitor hotspots (frequent pathfinding to same locations)
- Check frame throttling (too many requests queued)
- Verify grid generation time (should be <50ms)

**NPCs Getting Stuck**:
- Check stuck detection thresholds
- Verify path recalculation is working
- Check if path is being cleared prematurely
- Verify transition intent system

**Multi-Z Navigation Failing**:
- Check `createMultiZPath()` route planning
- Verify transition points are found correctly
- Check if waypoints are being executed in order
- Verify path is preserved across transitions

---

## Future Improvements

### Potential Enhancements

1. **Hierarchical Pathfinding**: Use waypoints for long-distance paths
2. **Dynamic Obstacle Avoidance**: Real-time obstacle detection during movement
3. **Path Prediction**: Pre-compute common paths
4. **Adaptive Smoothing**: Adjust smoothing based on terrain type
5. **Parallel Pathfinding**: Use Web Workers for off-main-thread pathfinding
6. **Path Sharing**: Share paths between entities going to same destination
7. **Incremental Pathfinding**: Update paths as obstacles appear/disappear

---

## Conclusion

The pathfinding system is a sophisticated, multi-layered architecture that handles complex navigation scenarios across multiple z-levels. It uses aggressive caching, intelligent throttling, and entity-specific behaviors to provide responsive pathfinding for both players and NPCs while maintaining good performance characteristics.

Key strengths:
- Comprehensive caching system
- Frame-based throttling prevents lag
- Multi-z navigation support
- Entity-specific behaviors
- Performance monitoring and profiling

Areas for potential improvement:
- Hierarchical pathfinding for long distances
- Dynamic obstacle avoidance
- Parallel processing for heavy loads
