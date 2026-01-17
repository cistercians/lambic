# Map Context System Documentation

## Overview

The Map Context System is a comprehensive architecture that enables the game to support multiple isolated map instances simultaneously. This allows players to exist in different "contexts" - either the main persistent world or temporary battleground matches - without data from one context leaking into another.

### Why Map Context is Needed

The game originally supported only a single persistent world. With the introduction of battlegrounds (temporary PvP matches), we needed a way to:

1. **Isolate Data**: Prevent entities, items, buildings, and other game objects from one context (e.g., main world) from appearing or interacting with entities in another context (e.g., a battleground match).

2. **Support Multiple Maps**: Allow multiple battleground matches to run simultaneously, each with its own isolated map instance.

3. **Context-Aware Operations**: Ensure that pathfinding, tile access, entity interactions, and rendering all operate on the correct map instance based on the entity's current context.

4. **Prevent Cross-Context Bugs**: Eliminate issues where:
   - Main world NPCs attack players in battlegrounds
   - Main world items appear in battleground inventories
   - Main world buildings are visible in battleground maps
   - Pathfinding uses the wrong map's data

## Core Concepts

### Map Context

A **map context** represents which map instance an entity belongs to. There are two types:

1. **Main World Context**: The persistent game world. Entities have `inBattleground = false` and `battlegroundMatchId = null`.

2. **Battleground Context**: A temporary match instance. Entities have `inBattleground = true` and `battlegroundMatchId = <matchId>`.

### Context Properties

Every entity that can exist in different contexts has these properties:

- `inBattleground` (boolean): Whether the entity is in a battleground
- `battlegroundMatchId` (string|null): The match ID if in a battleground, null otherwise

**Important**: Both properties must be checked together. An entity is only considered "in a battleground" if both `inBattleground === true` AND `battlegroundMatchId !== null`.

### Network Pack Fields

Context fields are included in init/update packs for all context-sensitive entities so the client can preserve context state:

- Players, NPCs, Items, Buildings, Arrows, Lights, Weather
- Fields: `inBattleground`, `battlegroundMatchId`

### Context Isolation Rules

1. **Entities in different contexts cannot interact**: They cannot see each other, attack each other, or interact in any way.

2. **Different battleground matches are isolated**: Entities in match A cannot interact with entities in match B.

3. **Main world and battlegrounds are completely isolated**: No data should leak between them.

4. **All entity types respect context**: Players, NPCs, items, buildings, arrows, lights, and weather all have context properties.

## System Architecture

The Map Context System consists of four main components:

### 1. MapContextManager

**Location**: `server/js/core/MapContextManager.js`

**Purpose**: Manages multiple map instances and provides context-aware tile/map access.

**Key Responsibilities**:
- Stores references to the main world tilemap system
- Registers and unregisters battleground maps
- Provides context-aware tile access (`getTile`, `setTile`)
- Provides context-aware pathfinding (`findPath`, `isWalkable`)
- Maps entity IDs to their appropriate map context

**Legacy Map Format**:
- Battleground maps should be provided as `{ data, mapSize }`.
- Legacy array-only maps still work but emit a warning when detected.

**Key Methods**:
- `registerBattlegroundMap(matchId, worldData, mapSize)`: Register a new battleground map
- `unregisterBattlegroundMap(matchId)`: Remove a battleground map when match ends
- `getMapContext(entityId)`: Get the map context for an entity
- `getTile(layer, x, y, entityId)`: Get tile from the correct map based on entity context
- `setTile(layer, x, y, value, entityId)`: Set tile in the correct map based on entity context
- `findPath(startLoc, endLoc, layer, options, entityId)`: Find path using the correct map's pathfinding data
- `isWalkable(z, c, r, entityId)`: Check if a tile is walkable in the correct map

**Example**:
```javascript
// Get tile from the correct map (main world or battleground)
const tile = global.mapContextManager.getTile(0, 10, 20, playerId);

// Set tile in the correct map
global.mapContextManager.setTile(0, 10, 20, TERRAIN.ROCKS, playerId);

// Check if tile is walkable in the correct map
const walkable = global.mapContextManager.isWalkable(0, 10, 20, playerId);
```

### 2. MapContextHelpers

**Location**: `server/js/core/MapContextHelpers.js`

**Purpose**: Provides utility functions for context-aware entity filtering and context management.

**Key Responsibilities**:
- Check if entities are in the same context
- Filter entity lists by context
- Set entity context properties
- Get entities in the same context as a reference entity
- Validate context isolation in update packets

**Key Functions**:

#### Context Checking
- `areInSameContext(entity1, entity2)`: Check if two entities are in the same context
- `isInBattleground(entity)`: Check if an entity is in a battleground
- `areInSameMatch(entity1, entity2)`: Check if two entities are in the same battleground match

#### Context Filtering
- `getEntitiesInSameContext(entity, options)`: Get all Player.list entities in same context
- `getBuildingsInSameContext(entity)`: Get all Building.list entities in same context
- `getItemsInSameContext(entity)`: Get all Item.list entities in same context
- `getArrowsInSameContext(entity)`: Get all Arrow.list entities in same context
- `getLightsInSameContext(entity)`: Get all Light.list entities in same context
- `filterEntitiesByContext(entities, contextEntity)`: Filter an array of entities by context

#### Context Management
- `setEntityContext(entity, matchId)`: Set an entity's context (null for main world, matchId for battleground)
- `getContextForEntity(entityId)`: Get context information for an entity

#### Validation
- `validateContextIsolation(updatePack, matchId)`: Validate that an update pack only contains entities from the specified context

#### Enforcement Flags

Server-side validation can be toggled at startup:

- `CONTEXT_VALIDATION_ENABLED` (default: `true`): enable context validation
- `CONTEXT_VALIDATION_ENFORCE` (default: `true`): disconnect/kick on violations

**Example**:
```javascript
// Check if two entities can interact
if (global.mapContextHelpers.areInSameContext(player1, player2)) {
  // They're in the same context - can interact
}

// Get all NPCs in the same context as a player
const npcsInContext = global.mapContextHelpers.getEntitiesInSameContext(player, { type: 'npc' });

// Set an entity's context to a battleground
global.mapContextHelpers.setEntityContext(npc, matchId);

// Set an entity's context back to main world
global.mapContextHelpers.setEntityContext(npc, null);
```

### 3. ContextTransitionManager

**Location**: `server/js/core/ContextTransitionManager.js`

**Purpose**: Provides a unified system for transitioning players between map contexts.

**Key Responsibilities**:
- Manages player transitions from main world to battlegrounds and vice versa
- Provides hooks for systems to react to context transitions
- Ensures all data flows are properly updated during transitions
- Prevents race conditions during transitions

**Key Methods**:
- `transitionPlayer(playerId, toContext, options)`: Transition a player to a new context
- `registerHook(phase, callback)`: Register a hook to be called during transitions
- `isTransitioning(playerId)`: Check if a player is currently transitioning
- `cancelTransition(playerId)`: Cancel an in-progress transition

**Transition Phases**:
1. **beforeTransition**: Systems prepare for the transition (e.g., store player state)
2. **duringTransition**: Core transition logic executes (e.g., update entity context, position)
3. **afterTransition**: Systems react to the transition (e.g., send init packs, update UI)

**Example**:
```javascript
// Transition a player to a battleground
await global.contextTransitionManager.transitionPlayer(playerId, {
  matchId: match.matchId,
  position: { x: spawnX, y: spawnY, z: spawnZ },
  worldData: match.worldData
});

// Register a hook to react to transitions
global.contextTransitionManager.registerHook('afterTransition', async (playerId, fromContext, toContext, transitionData) => {
  if (toContext.inBattleground) {
    // Player entered a battleground - send battleground-specific init data
    sendBattlegroundInitPack(playerId);
  }
});
```

### 4. ContextAwareIterators

**Location**: `server/js/core/ContextAwareIterators.js`

**Purpose**: Provides standardized iteration functions that automatically filter by context.

**Key Responsibilities**:
- Provide consistent iteration patterns for all entity types
- Automatically filter entities by context
- Reduce code duplication across the codebase

**Key Functions**:

#### Iteration Functions
- `forEachPlayer(contextEntity, callback)`: Iterate over players in same context
- `forEachNPC(contextEntity, callback)`: Iterate over NPCs in same context
- `forEachBuilding(contextEntity, callback)`: Iterate over buildings in same context
- `forEachItem(contextEntity, callback)`: Iterate over items in same context
- `forEachArrow(contextEntity, callback)`: Iterate over arrows in same context
- `forEachLight(contextEntity, callback)`: Iterate over lights in same context

#### Get Functions
- `getPlayersInContext(contextEntity)`: Get all players in same context
- `getNPCsInContext(contextEntity)`: Get all NPCs in same context
- `getBuildingsInContext(contextEntity)`: Get all buildings in same context
- `getItemsInContext(contextEntity)`: Get all items in same context
- `getArrowsInContext(contextEntity)`: Get all arrows in same context
- `getLightsInContext(contextEntity)`: Get all lights in same context

**Example**:
```javascript
// Iterate over all NPCs in the same context as a player
global.contextAwareIterators.forEachNPC(player, (npc) => {
  // This NPC is guaranteed to be in the same context as the player
  checkAggro(npc, player);
});

// Get all buildings in the same context
const buildings = global.contextAwareIterators.getBuildingsInContext(player);
```

## Entity Context Assignment

### Setting Entity Context

When an entity is created or moved to a different context, its context properties must be set:

```javascript
// Set entity to battleground context
global.mapContextHelpers.setEntityContext(entity, matchId);

// Set entity to main world context
global.mapContextHelpers.setEntityContext(entity, null);
```

### Context Inheritance

Some entities inherit context from their parent:

- **Arrows**: Inherit context from the entity that shot them
- **Lights**: Inherit context from their parent entity (e.g., torch lights from players)
- **Items**: Can be created with explicit context or inherit from creator

**Example** (Arrow constructor):
```javascript
Arrow = function(param) {
  // ... arrow creation code ...
  
  // Inherit context from parent
  if (param.parent && global.Player.list[param.parent]) {
    const parent = global.Player.list[param.parent];
    this.inBattleground = parent.inBattleground;
    this.battlegroundMatchId = parent.battlegroundMatchId;
  }
};
```

## Context-Aware Filtering

### Spatial Filtering

The `OptimizedGameLoop` uses context-aware spatial filtering to ensure only entities in the same context are sent to clients:

**Location**: `server/js/core/OptimizedGameLoop.js`

**Key Methods**:
- `spatialFilterEntities(entityPack)`: Filter player/NPC entities by context and distance
- `spatialFilterItems(itemPack)`: Filter items by context and distance
- `spatialFilterBuildings(buildingPack)`: Filter buildings by context and distance
- `spatialFilterArrows(arrowPack)`: Filter arrows by context and distance
- `spatialFilterLights(lightPack)`: Filter lights by context and distance

**How It Works**:
1. For each entity in the update pack, check its context
2. For each player receiving updates, check their context
3. Only include entities that:
   - Are in the same context as at least one receiving player
   - Are within the spatial filter radius of that player
   - Are on the same z-level

**Example**:
```javascript
// In spatialFilterEntities
for (const entity of entityPack) {
  const entityPlayer = Player.list[entity.id];
  if (!entityPlayer) continue;
  
  // Check if entity is in same context as any player
  let hasMatchingMapContext = false;
  for (const playerPos of playerPositions) {
    const playerEntity = Player.list[playerPos.playerId];
    if (playerEntity && mapContextHelpers.areInSameContext(entityPlayer, playerEntity)) {
      hasMatchingMapContext = true;
      break;
    }
  }
  
  if (!hasMatchingMapContext) {
    continue; // Skip - different context
  }
  
  // ... check distance and include if near player ...
}
```

### Combat System Filtering

The combat system uses context-aware filtering to prevent cross-context combat:

**Location**: `server/js/core/SimpleCombat.js`

**Key Methods**:
- `isTargetValid(attacker, target)`: Checks if target is in same context
- `canAggroTarget(entity, target)`: Checks context before aggro
- `findAggroTargets(entity)`: Only finds targets in same context

**Example**:
```javascript
function isTargetValid(attacker, target) {
  if (!attacker || !target) return false;
  
  // CRITICAL: Check map context - entities in different contexts cannot interact
  if (!global.mapContextHelpers.areInSameContext(attacker, target)) {
    return false;
  }
  
  // ... other validation ...
}
```

### AI Behavior Filtering

AI systems use context-aware filtering to find nearby entities:

**Location**: `server/js/core/SimpleSerfBehavior.js`, `server/js/core/SimpleFlee.js`

**Example**:
```javascript
function findNearestThreat(serf) {
  // Only find threats in the same context
  const entitiesInContext = global.mapContextHelpers.getEntitiesInSameContext(serf);
  
  let nearestThreat = null;
  let nearestDistance = Infinity;
  
  for (const entity of entitiesInContext) {
    if (isEnemy(serf, entity)) {
      const dist = getDistance(serf, entity);
      if (dist < nearestDistance) {
        nearestThreat = entity;
        nearestDistance = dist;
      }
    }
  }
  
  return nearestThreat;
}
```

## Context Transitions

### Player Transitions

When a player enters or exits a battleground, the `ContextTransitionManager` handles the transition:

**Entering Battleground**:
1. Store player's main world state (position, inventory, etc.)
2. Set player's context to battleground (`inBattleground = true`, `battlegroundMatchId = matchId`)
3. Teleport player to battleground spawn position
4. Send battleground world data to client
5. Send init pack with battleground entities

**Exiting Battleground**:
1. Restore player's main world state
2. Set player's context back to main world (`inBattleground = false`, `battlegroundMatchId = null`)
3. Teleport player back to stored position
4. Send main world init pack
5. Clear battleground-specific data

**Example** (from `BattlegroundsMatchManager.spawnParticipants`):
```javascript
// Transition player to battleground
await global.contextTransitionManager.transitionPlayer(participant.id, {
  matchId: this.currentMatch.matchId,
  position: { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z },
  worldData: mapData.worldData
});
```

### Entity Context Clearing

When a match ends, all entities associated with that match must have their context cleared:

**Example** (from `BattlegroundsMatchManager.endMatch`):
```javascript
// Clear context for all participants
for (const participant of this.currentMatch.participants) {
  const player = global.Player.list[participant.id];
  if (player) {
    global.mapContextHelpers.setEntityContext(player, null);
  }
}

// Remove battleground NPCs
// ... remove NPCs ...

// Unregister battleground map
global.mapContextManager.unregisterBattlegroundMap(this.currentMatch.matchId);
```

## Context Validation

### Update Packet Validation

The system validates update packets to catch context isolation violations:

**Location**: `server/js/core/OptimizedGameLoop.js`

**How It Works**:
- Before sending update packets, validate that all entities in the pack are in the correct context
- Log violations for debugging
- This helps catch bugs where cross-context entities leak into update packets

**Example**:
```javascript
// Validate context isolation before sending
for (const id in Player.list) {
  const player = Player.list[id];
  if (player && player.type === 'player') {
    const playerMatchId = player.battlegroundMatchId || null;
    const validation = mapContextHelpers.validateContextIsolation(finalPack, playerMatchId);
    if (!validation.valid) {
      console.warn(`Context isolation violation for player ${id}:`, validation.issues);
    }
  }
}
```

## Best Practices

### 1. Always Use MapContextHelpers

**Don't**:
```javascript
// Direct context check - error-prone
if (entity1.inBattleground === entity2.inBattleground) {
  // This doesn't check matchId!
}
```

**Do**:
```javascript
// Use MapContextHelpers
if (global.mapContextHelpers.areInSameContext(entity1, entity2)) {
  // Safe - checks both inBattleground and matchId
}
```

### 2. Use ContextAwareIterators for Entity Iteration

**Don't**:
```javascript
// Direct iteration - includes entities from all contexts
for (const id in Player.list) {
  const player = Player.list[id];
  // This includes players from all contexts!
}
```

**Do**:
```javascript
// Use ContextAwareIterators
global.contextAwareIterators.forEachPlayer(contextEntity, (player) => {
  // Only players in same context
});
```

### 3. Always Set Context When Creating Entities

**Don't**:
```javascript
// Create entity without setting context
const npc = new NPC({ x: 100, y: 100, z: 0 });
// Context is undefined!
```

**Do**:
```javascript
// Set context immediately after creation
const npc = new NPC({ x: 100, y: 100, z: 0 });
global.mapContextHelpers.setEntityContext(npc, matchId);
```

### 4. Use MapContextManager for Tile/Pathfinding Operations

**Don't**:
```javascript
// Direct tile access - uses wrong map
const tile = global.world[0][y][x];
```

**Do**:
```javascript
// Use MapContextManager
const tile = global.mapContextManager.getTile(0, x, y, entityId);
```

### 5. Filter Update Packs by Context

**Don't**:
```javascript
// Send all entities to all players
socket.write(JSON.stringify({ msg: 'update', pack: allEntities }));
```

**Do**:
```javascript
// Filter by context before sending
const filteredPack = {
  player: spatialFilterEntities(playerPack),
  item: spatialFilterItems(itemPack),
  building: spatialFilterBuildings(buildingPack),
  // ...
};
socket.write(JSON.stringify({ msg: 'update', pack: filteredPack }));
```

## Common Pitfalls

### 1. Not Checking Both Context Properties

**Problem**: Only checking `inBattleground` without checking `battlegroundMatchId`:
```javascript
if (entity.inBattleground) {
  // This is true even if battlegroundMatchId is null!
}
```

**Solution**: Always use `MapContextHelpers.areInSameContext()` or check both properties:
```javascript
const inBG = !!(entity.inBattleground && entity.battlegroundMatchId);
```

### 2. Forgetting to Set Context on New Entities

**Problem**: Creating entities in battlegrounds without setting their context:
```javascript
const item = new Item({ x: 100, y: 100, z: 0 });
// Context is not set - item appears in main world!
```

**Solution**: Always set context immediately after creation:
```javascript
const item = new Item({ x: 100, y: 100, z: 0 });
global.mapContextHelpers.setEntityContext(item, matchId);
```

### 3. Not Filtering Entity Lists

**Problem**: Iterating over global entity lists without context filtering:
```javascript
for (const id in Building.list) {
  const building = Building.list[id];
  // This includes buildings from all contexts!
}
```

**Solution**: Use context-aware iteration:
```javascript
global.contextAwareIterators.forEachBuilding(contextEntity, (building) => {
  // Only buildings in same context
});
```

### 4. Using Wrong Map for Pathfinding

**Problem**: Using global pathfinding grids without checking context:
```javascript
const path = findPath(start, end, 0);
// Uses main world pathfinding even if entity is in battleground!
```

**Solution**: Use MapContextManager:
```javascript
const path = global.mapContextManager.findPath(start, end, 0, {}, entityId);
```

## Integration Points

### Where Context is Set

1. **BattlegroundsMatchManager.spawnParticipants()**: Sets context when players enter battlegrounds
2. **BattlegroundsMatchManager.restorePlayerStates()**: Clears context when players exit battlegrounds
3. **BattlegroundsEliteNPCManager.spawnEliteNPC()**: Sets context when spawning battleground NPCs
4. **Entity constructors**: Some entities inherit context from parents (arrows, lights)

### Where Context is Checked

1. **OptimizedGameLoop.spatialFilter*()**: Filters update packets by context
2. **SimpleCombat.isTargetValid()**: Prevents cross-context combat
3. **SimpleSerfBehavior.findNearestThreat()**: Only finds threats in same context
4. **isAlly()**: Checks context before checking alliances
5. **isTileOccupied()**: Only checks entities in same context
6. **BaseItem.pickup()**: Prevents picking up items from different contexts
7. **Interact.js**: Prevents interacting with buildings from different contexts

### Where Context is Used for Map Access

1. **tileChange()**: Uses MapContextManager to change tiles in correct map
2. **getTile()**: Uses MapContextManager to get tiles from correct map
3. **isWalkable()**: Uses MapContextManager to check walkability in correct map
4. **findPath()**: Uses MapContextManager to find paths in correct map
5. **findPathContextAware()**: Wrapper that uses MapContextManager

## Testing Context Isolation

### Validation Checks

The system includes validation to catch context isolation violations:

1. **Update Packet Validation**: Checks that update packets only contain entities from the correct context
2. **Stale Context Detection**: Detects players with battleground context but no active match
3. **Cross-Context Entity Detection**: Logs when entities from different contexts are found together

### Manual Testing

To test context isolation:

1. **Enter a battleground**: Verify no main world entities are visible
2. **Check combat**: Verify main world NPCs cannot attack battleground players
3. **Check items**: Verify main world items cannot be picked up in battlegrounds
4. **Check pathfinding**: Verify pathfinding uses the correct map
5. **Exit battleground**: Verify battleground entities are not visible in main world

## Future Enhancements

Potential improvements to the system:

1. **Context-Aware Caching**: Cache context-filtered entity lists for performance
2. **Context Transition Hooks**: More granular hooks for specific transition events
3. **Context Validation Tools**: Automated tests to verify context isolation
4. **Context Debugging Tools**: Visual indicators for entity contexts in debug mode
5. **Context Metrics**: Track context isolation violations and performance

## Summary

The Map Context System provides a robust foundation for supporting multiple isolated map instances. By consistently using the provided utilities (`MapContextHelpers`, `MapContextManager`, `ContextTransitionManager`, `ContextAwareIterators`), developers can ensure that:

- Entities are properly assigned to contexts
- Context filtering is applied consistently
- Cross-context data leaks are prevented
- Map operations use the correct map instance
- Transitions between contexts are handled safely

Following the best practices and avoiding common pitfalls will ensure the system continues to work correctly as new features are added.

