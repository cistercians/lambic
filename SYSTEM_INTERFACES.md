# System Interfaces & Contracts

## Overview

This document defines the clear interfaces and contracts for all major game systems. This enables safe modifications and clear understanding of system boundaries.

## Core Systems

### SystemRegistry

**Purpose**: Central registry for all game systems

**Interface**:
```javascript
register(name, system, options)  // Register a system
get(name)                        // Get a system by name
has(name)                        // Check if system is registered
getSystemNames()                 // Get all registered system names
verifyDependencies(name)         // Verify system dependencies
```

**Contract**:
- All systems must be registered before use
- System names must be unique
- Dependencies must be registered before dependent systems

### EntityRegistry

**Purpose**: Single source of truth for entity collections

**Interface**:
```javascript
registerCollection(name, listObject, options)  // Register entity collection
getEntities(type, filter)                      // Get entities by type
getEntity(type, id)                            // Get single entity
addEntity(type, id, entity)                     // Add entity
removeEntity(type, id)                          // Remove entity
hasEntity(type, id)                             // Check if entity exists
getCount(type)                                  // Get entity count
```

**Contract**:
- Entity collections must be registered before use
- Entity IDs must be unique within a collection
- All entity access should go through EntityRegistry

### DependencyContainer

**Purpose**: Advanced dependency injection container

**Interface**:
```javascript
singleton(name, instance)       // Register singleton
factory(name, factory)           // Register factory
resolve(name)                    // Resolve dependency
registerSystem(systemName)       // Register system as dependency
autoRegisterSystems()            // Auto-register all systems
```

**Contract**:
- Dependencies resolved in order: singleton → factory → injector → global
- Singletons are cached after first resolution
- Factories are called each time (unless cached as singleton)

### EntityStateManager

**Purpose**: Entity lifecycle management

**Interface**:
```javascript
createEntity(type, id, entity)   // Create and register entity
removeEntity(type, id)            // Remove entity
updateAll()                       // Update all entities
updateType(type)                  // Update entities of specific type
onCreate(type, hook)              // Register creation hook
onUpdate(type, hook)              // Register update hook
onRemove(type, hook)              // Register removal hook
```

**Contract**:
- Entities must be created through EntityStateManager
- Update order is: players → buildings → items → arrows → lights → weather
- Hooks are called synchronously during lifecycle events

## Game Systems

### TilemapSystem

**Purpose**: World tilemap and pathfinding

**Interface**:
```javascript
getTile(layer, x, y)             // Get tile at position
updateTile(layer, x, y, value)   // Update tile
findPath(start, end, layer, opts)  // Find path between points
```

**Dependencies**: gameState

### CombatSystem (SimpleCombat)

**Purpose**: Combat logic and damage calculation

**Interface**:
```javascript
startCombat(entity, target)      // Start combat
updateCombat(entity)              // Update combat state
endCombat(entity)                 // End combat
calculateDamage(attacker, target) // Calculate damage
```

**Dependencies**: gameState, tilemap

### MovementSystem

**Purpose**: Entity movement and pathfinding

**Interface**:
```javascript
moveTowardTarget(entity, target)  // Move entity toward target
handleStuckDetection(entity)      // Detect and handle stuck entities
findPath(start, end, z, opts)     // Find path
```

**Dependencies**: tilemap, pathfinding

## Command System

### CommandRegistry

**Purpose**: Command registration and routing

**Interface**:
```javascript
register(name, handler, options)  // Register command
execute(commandString, context)   // Execute command
has(name)                          // Check if command exists
getAllCommands(category)           // Get all commands
```

**Contract**:
- Commands must be registered before use
- Command names are case-insensitive
- Commands can have aliases
- Legacy EvalCmd is fallback for unregistered commands

### Command Handlers

**Purpose**: Individual command implementations

**Interface**:
```javascript
execute(data)  // Execute command (data contains cmd, id, socket, etc.)
```

**Contract**:
- Commands receive execution context (player, socket, etc.)
- Commands should validate inputs
- Commands should send responses via socket

## Client Systems

### GameStateSync

**Purpose**: Server communication

**Interface**:
```javascript
connect(url)                      // Connect to server
disconnect()                      // Disconnect
send(data)                        // Send message
on(messageType, handler)          // Register message handler
off(messageType, handler)        // Remove handler
isConnected()                     // Check connection status
```

**Contract**:
- Must be connected before sending messages
- Message handlers are called in registration order
- Automatic reconnection on disconnect

### SpriteManager

**Purpose**: Sprite lookup and management

**Interface**:
```javascript
init()                            // Initialize (build sprite map)
getSpriteForClass(class, isGhost) // Get sprite for entity class
getPlayerSprite(class, sex)       // Get sprite for player
isSpriteLoaded(class)             // Check if sprite available
```

**Contract**:
- Must be initialized after sprites are loaded
- Returns null if sprite not available
- Falls back to maleserf for unknown classes

### InventoryUI

**Purpose**: Inventory display

**Interface**:
```javascript
init(container)                   // Initialize with container
update(inventory, onClick, onRightClick)  // Update display
clear()                           // Clear display
```

**Contract**:
- Must be initialized before use
- Inventory object contains item counts
- Event handlers are optional

## Dependency Graph

```
gameState (no dependencies)
  └─> tilemap
      └─> mapAnalyzer
          └─> zoneManager
  └─> combat
  └─> buildingConstruction
  └─> flee
  └─> social
  └─> itemFactory
  └─> entities (EntityRegistry)
      └─> entityState (EntityStateManager)
      └─> spatial
  └─> buildingPreview
  └─> commandRegistry
      └─> commands
  └─> gameLoop
  └─> performance
  └─> dependencies (DependencyContainer)
```

## Migration Guidelines

### Replacing Global Access

**Before:**
```javascript
const player = Player.list[playerId];
const tilemap = global.tilemapSystem;
```

**After:**
```javascript
const { getPlayer, getTilemapSystem } = require('./core/GlobalWrappers');
const player = getPlayer(playerId);
const tilemap = getTilemapSystem();
```

### Using Dependency Injection

**Before:**
```javascript
class MySystem {
  constructor() {
    this.tilemap = global.tilemapSystem;
    this.gameState = global.gameState;
  }
}
```

**After:**
```javascript
class MySystem {
  constructor(tilemapSystem, gameState) {
    this.tilemap = tilemapSystem;
    this.gameState = gameState;
  }
}

// Register with DI
const mySystem = dependencyInjector.inject(MySystem, ['tilemap', 'gameState']);
```

### Accessing Entities

**Before:**
```javascript
for (const id in Player.list) {
  const player = Player.list[id];
}
```

**After:**
```javascript
const players = entityRegistry.getEntities('players');
for (const player of players) {
}
```

## Testing Contracts

All systems should be:
- **Testable in isolation** - Can be instantiated without globals
- **Mockable** - Dependencies can be replaced with mocks
- **Documented** - Clear interface and contract
- **Validated** - Input validation and error handling

## Notes

- Interfaces may evolve as systems are refactored
- Backward compatibility maintained during transition
- New code should use new interfaces
- Legacy code can gradually migrate
