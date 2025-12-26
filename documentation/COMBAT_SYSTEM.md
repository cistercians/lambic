# Combat System Documentation

This document provides an in-depth analysis of the combat system architecture in the game, covering all major components and their interactions. This documentation serves as a reference for future modularization and refactoring efforts.

## Table of Contents

1. [Aggro/Engagements](#1-aggroengagements)
2. [Combat Pathing/Movement](#2-combat-pathingmovement)
3. [Default Combat Behaviors](#3-default-combat-behaviors)
4. [Escape Behaviors](#4-escape-behaviors)
5. [Death Handling](#5-death-handling)
6. [Future Addition of Skills](#6-future-addition-of-skills)

## Combat State Management

The combat system uses a unified `combatState` object to manage all combat-related state, eliminating edge cases and simplifying validation.

**Unified State Structure**:
- `entity.combatState.target` - Current combat target ID
- `entity.combatState.startTime` - Combat start timestamp (for priority determination)
- `entity.combatState.lastAttack` - Last attack timestamp
- `entity.combatState.pendingTarget` - Pending stealth attack target ID
- `entity.combatState.pendingStartTime` - Pending stealth start timestamp
- `entity.combatState.pathfindingFailures` - Pathfinding failure counter

**Helper Methods**:
- `ensureCombatState(entity)` - Initializes and returns combat state object
- `clearCombatState(entity)` - Clears all combat state in one call

**Game Loop Integration**: The game loop checks for `combatState` existence rather than `action === 'combat'`, ensuring combat updates are always called when combat state exists. The `update()` method defensively ensures `action` is set when `combatState` exists, maintaining state consistency.

**Single Validation Point**: Target validation happens once at the start of `update()` (line 744), and the cached target is used throughout the update cycle. `handleAttack()` and `handleChase()` trust this validation and do not perform redundant checks, eliminating inconsistencies.

This unified approach prevents state inconsistencies, simplifies debugging, and ensures reliable combat updates.

---

## 1. AGGRO/ENGAGEMENTS

### Overview

The aggro system determines when and how combat is initiated between entities. It handles detection, target selection, alliance checks, stealth mechanics, and counter-aggro responses.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `checkAggro()` (lines 1083-1209)
  - `startCombat()` (lines 1247-1355)
  - `handlePendingStealthAggro()` (lines 1212-1244)

### Aggro Detection Flow

```
Entity Update Loop (NPCs only)
    ↓
checkAggro(entity)
    ↓
[Skip if: player, returning, already in combat, non-combat class]
    ↓
[Check pending stealth aggro first]
    ↓
[Priority: Defend fleeing allied serfs (military units)]
    ↓
[Iterate through all entities in Player.list]
    ↓
For each potential target:
    ├─ Validate target (ghost, spectator, same z-level)
    ├─ Check alliance (skip if ally)
    ├─ Check stealth detection (128px range)
    ├─ Check peaceful unit rules
    ├─ Check innaWoods compatibility
    └─ startCombat(entity, target)
```

**Note**: Players do not have an aggro system. The `checkAggro()` method explicitly skips players (`entity.type === 'player'`). Players choose targets explicitly via attack commands or receive combat targets through counter-aggro when NPCs attack them.

### Key Components

#### Player Aggro System

**Players do not have an aggro system**. The `checkAggro()` method explicitly skips players with a defensive check:

**Code Reference**: `SimpleCombat.js:934-937`

```javascript
checkAggro(entity) {
  // Skip players - they don't use aggro system (they choose targets explicitly)
  if (entity.type === 'player') return;
  // ... rest of aggro logic for NPCs only
}
```

Players only get combat targets through:
1. **Explicit attack intent**: Player right-clicks or uses attack commands (sets `combatState.pendingTarget` via `setAttackIntent()`)
2. **Counter-aggro**: When an NPC attacks a player, counter-aggro logic sets the player's combat target

Players have an `aggroRange` property, but it's only used for attack-move detection (detecting enemies while pathfinding with attack-move command), not for automatic aggro.

#### Aggro Range Detection

- **Default Range**: 512px (8 tiles)
- **Configurable**: Per-entity via `entity.aggroRange`
- **Defense Range**: 1000px (10 tiles) for military units defending fleeing serfs
- **Detection Range**: 128px (2 tiles) for stealth detection

**Code Reference**: `SimpleCombat.js:1111-1112`

```javascript
const aggroRange = entity.aggroRange || 512;
const defenseRange = 1000; // Military units respond to fleeing serfs
```

#### Target Finding

The system iterates through all entities in `global.Player.list` to find potential aggro targets within range. Each entity is validated for combat eligibility before aggro is initiated.

**Code Reference**: `SimpleCombat.js:1143-1208`

```javascript
// Iterate through all entities to find aggro targets
for (const id in global.Player.list) {
    const target = global.Player.list[id];
    
    // Skip invalid targets (ghost, spectator, same z-level, etc.)
    // Check distance, alliance, stealth detection
    // Start combat if valid
}
```

#### Alliance Checking

Allies never aggro each other. The check happens early in the aggro process.

**Code Reference**: `SimpleCombat.js:1177-1180`

```javascript
// Check alliance FIRST - allies should never aggro each other
if (global.isAlly && global.isAlly(entity.id, target.id)) {
  continue; // Skip allies
}
```

The alliance system (`global.isAlly()`) is defined in `lambic.js:1656-1743` and handles:
- Same faction/house membership
- Neutral entity rules
- Wild animal exceptions (Wolves, Boars)
- Deer-specific rules

#### Stealth Detection

Stealthed units can only be detected within 128px (2 tiles).

**Code Reference**: `SimpleCombat.js:396-402`

```javascript
checkStealthDetection(stealthedEntity, detector) {
  if (!stealthedEntity.stealthed) return false;
  if (stealthedEntity.revealed) return true; // Already revealed
  const distance = this.getDistance(stealthedEntity, detector);
  return distance <= this.DETECTION_RANGE; // 128px
}
```

**Stealth States**:
- `entity.stealthed = true`: Unit is in stealth mode
- `entity.revealed = true`: Unit has been detected but still partially stealthed
- Detection automatically reveals the unit

#### Peaceful Unit Behavior

Peaceful units (Serfs, Deer, Sheep) trigger flee behavior instead of combat when aggro'd.

**Code Reference**: `SimpleCombat.js:1288-1303`

```javascript
const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
if (peaceful.includes(entity.class)) {
  entity.action = 'flee';
  const state = this.ensureCombatState(entity);
  state.target = target.id;
  state.pathfindingFailures = 0;
  // Maintain backward compatibility
  if (!entity.combat) entity.combat = {};
  entity.combat.target = target.id;
  return;
}
```

**Special Rules**:
- Serfs don't flee from prey animals (deer)
- Deer don't flee from other deer
- Peaceful units can detect threats while fleeing (allows switching to closer threats)

#### Counter-Aggro Mechanics

When an entity is attacked, it automatically counter-aggros if it's a military NPC or player.

**Code Reference**: `SimpleCombat.js:1322-1354`

```javascript
// Counter-aggro
if (target.type === 'npc' && target.military && target.action !== 'combat') {
  this.startCombat(target, entity);
} else if (target.type === 'player') {
  // Use initCombatState to properly initialize player combat state
  if (this.initCombatState(target, entity.id)) {
    // Handle attack intent conversion if player had attack intent on this entity
    if (target.combatState && target.combatState.pendingTarget === entity.id) {
      target.combatState.pendingTarget = null;
      target.combatState.pendingStartTime = null;
    }
    // Send attack notification to player
  }
}
```

**Player Combat Validation**: Players have validation in their combat update loop to ensure target exists. For player-initiated attacks, the system allows attacks even if the target hasn't aggro'd yet. However, for NPCs that should have aggro'd (military NPCs within aggro range), the system validates that the target is actually engaging.

**Code Reference**: `SimpleCombat.js:562-588`

```javascript
// For players, validate target exists (but don't require target to be in combat yet)
// This allows players to initiate attacks even if target hasn't aggro'd
if (entity.type === 'player') {
  const target = global.Player.list[state.target];
  if (!target) {
    // Target doesn't exist - end combat
    this.endCombat(entity, target);
    return;
  }
  
  // Only validate target is in combat if target is an NPC that should have aggro'd
  // Allow player-initiated attacks even if target hasn't aggro'd yet
  // This prevents clearing combat when player initiates attack from range
  if (target.type === 'npc' && target.military) {
    // For NPCs, check if they should have aggro'd but haven't
    // Only clear if target is dead, removed, or clearly invalid
    if (target.hp !== null && target.hp <= 0) {
    this.endCombat(entity, target);
    return;
    }
  }
}
```

**Key Points**:
- Players can initiate attacks even if target hasn't aggro'd yet (allows ranged attacks from outside aggro range)
- System only validates NPCs that should have aggro'd but haven't
- Prevents premature combat clearing when player initiates attack from range

#### Military Unit Defensive Aggro

Military units have extended range (1000px) to defend fleeing allied serfs.

**Code Reference**: `SimpleCombat.js:1114-1141`

```javascript
if (entity.military && entity.house) {
  const serfClasses = ['Serf', 'SerfM', 'SerfF'];
  for (const id in global.Player.list) {
    const serf = global.Player.list[id];
    if (serfClasses.includes(serf.class) && 
        serf.action === 'flee' && 
        serf.house === entity.house &&
        serf.combatState && serf.combatState.target) {
      const attacker = global.Player.list[serf.combatState.target];
      if (attacker && distance <= defenseRange) {
        this.startCombat(entity, attacker);
        return;
      }
    }
  }
}
```

#### Pending Stealth Attack System

Stealthed units can approach targets before revealing themselves. The system uses the attack intent system (see [Attack Intent System](#attack-intent-system)) to handle stealth approaches. Combat doesn't start until:
1. The stealthed unit attacks (first strike)
2. The target detects the stealthed unit (within 128px)

**Code Reference**: `SimpleCombat.js:1258-1274` (in `startCombat()`), `SimpleCombat.js:1212-1244` (in `checkAggro()`)

```javascript
// In startCombat() - when stealthed unit aggro's
if (entity.stealthed && !entity.revealed) {
  if (this.checkStealthDetection(entity, target)) {
    // Detected - reveal and start combat
    this.removeStealth(entity);
  } else {
    // Still stealthed - set pending combat
    const state = this.ensureCombatState(entity);
    state.pendingTarget = target.id;
    state.pendingStartTime = Date.now();
    return; // Don't start combat yet
  }
}

// In checkAggro() - handlePendingStealthAggro()
handlePendingStealthAggro(entity) {
  // Check if stealthed unit is approaching target
  // Returns true if still approaching, false if ready to attack
}
```

**Pending Stealth Attack Flow**:
```
Stealthed Unit Aggro (checkAggro)
    ↓
[Target not detected yet]
    ↓
Set combatState.pendingTarget
    ↓
handlePendingStealthAggro() checks approach status
    ↓
[In combat update loop]
handlePendingStealthAttack() moves unit closer
    ↓
[Check detection each frame]
    ↓
[If detected OR in attack range] → Start combat
[If timeout (5s)] → Cancel pending attack
```

**Note**: The pending stealth attack system uses the same attack intent infrastructure as regular attack intent, but with additional stealth detection checks.

#### InnaWoods Compatibility

NPCs can only aggro players if both are in the same "woods" state OR the target is in woods.

**Code Reference**: `SimpleCombat.js:1198-1203`

```javascript
if (entity.type === 'npc' && target.type === 'player') {
  if (!(entity.innaWoods === target.innaWoods || (!entity.innaWoods && target.innaWoods))) {
    continue; // Can't aggro due to woods state
  }
}
```

### Combat State Initialization

When combat starts, the system initializes combat state using a unified `combatState` object that consolidates all combat-related state.

**Code Reference**: `SimpleCombat.js:196-241`

```javascript
initCombatState(entity, targetId) {
  const state = this.ensureCombatState(entity);
  entity.action = 'combat';
  state.target = targetId;
  state.startTime = Date.now();
  state.lastAttack = 0;
  state.pendingTarget = null;
  state.pendingStartTime = null;
  state.pathfindingFailures = 0;
  // Maintain backward compatibility
  entity.combat.target = targetId;
  if (entity.type === 'player') {
    entity.autoAttackPaused = false;
  }
}
```

**Unified Combat State Structure**:

All combat state is consolidated into `entity.combatState`:

```javascript
entity.combatState = {
  target: null,              // Current combat target ID
  startTime: null,           // When combat started (for priority)
  lastAttack: 0,             // Last attack timestamp
  pendingTarget: null,       // Pending stealth attack target ID
  pendingStartTime: null,    // When pending stealth started
  pathfindingFailures: 0     // Pathfinding failure counter
}
```

**Helper Methods**:

- `ensureCombatState(entity)` - Initializes and returns combat state object
- `clearCombatState(entity)` - Clears all combat state in one call

**Benefits**:
- Single source of truth for all combat state
- Easier validation (one object to check)
- Prevents edge cases (state is always consistent)
- Simpler debugging (all state visible in one place)

### Attack Intent System

The attack intent system allows entities (players and NPCs) to set a target for attack before entering full combat range. This enables pathfinding toward targets and automatic conversion to full combat when in range.

**Code Reference**: `SimpleCombat.js:243-272, 693-872`

**Key Methods**:
- `setAttackIntent(entity, targetId)` - Sets pending target for attack
- `clearAttackIntent(entity)` - Clears pending attack intent
- `handlePendingStealthAttack(entity)` - Handles pathfinding and range checking for attack intent (called in combat update loop)
- `handlePendingStealthAggro(entity)` - Handles pending stealth aggro during aggro checks (called in checkAggro)

**Attack Intent Flow**:
```
Entity sets attack intent (setAttackIntent)
    ↓
combatState.pendingTarget = targetId
entity.action = 'combat' (enables update loop)
    ↓
handlePendingStealthAttack() called each frame
    ↓
[Check if in attack range]
    ├─ In range → Convert to full combat (initCombatState)
    └─ Out of range → Pathfind toward target
    ↓
[Pathfinding]
    ├─ Melee → Pathfind to adjacent tile
    └─ Ranged → Pathfind to optimal position at 90% of attack range
    ↓
[Reach range during pathfinding]
    ↓
Convert to full combat immediately and attack
```

**Features**:
1. **Range Checking with Tolerance**: Uses 1px tolerance to account for floating point precision and pathfinding stopping slightly short
2. **Automatic Conversion**: When entity reaches attack range, automatically converts from attack intent to full combat state
3. **Immediate Attack**: When converting to combat, immediately attempts attack if in range (doesn't wait for next frame)
4. **Pathfinding Support**: 
   - Melee units pathfind to adjacent tile
   - Ranged units pathfind to optimal position at 90% of attack range from target
5. **Stealth Support**: Works for both stealthed and non-stealthed entities
6. **Timeout Protection**: Cancels attack intent after 5 seconds if target not reached

**Code Example**:
```javascript
// Set attack intent
setAttackIntent(entity, targetId) {
  const state = this.ensureCombatState(entity);
  state.pendingTarget = targetId;
  state.pendingStartTime = Date.now();
  entity.action = 'combat'; // Enable update loop
  // Do NOT set state.target yet (only set when in range)
}

// Handle attack intent (called in update loop)
handlePendingStealthAttack(entity) {
  const state = entity.combatState;
  if (!state || !state.pendingTarget) return false;
  
  const pendingTarget = global.Player.list[state.pendingTarget];
  const distance = this.getDistance(entity, pendingTarget);
  const attackRange = this.getAttackRange(entity);
  const rangeTolerance = 1;
  
  // Check if in range
  if (distance <= attackRange + rangeTolerance) {
    // Convert to full combat
    this.initCombatState(entity, pendingTarget.id);
    this.clearAttackIntent(entity);
    // Immediately attack if in range
    this.handleAttack(entity, pendingTarget);
    return false; // Continue to normal combat
  }
  
  // Not in range - pathfind toward target
  // ... pathfinding logic ...
  return true; // Still handling attack intent
}
```

**Use Cases**:
- **Player Attack-Move**: Player right-clicks enemy, entity pathfinds and attacks when in range
- **Stealth Approach**: Stealthed unit approaches target before revealing
- **Ranged Kiting**: Ranged unit approaches to optimal distance before engaging

### Non-Combat Classes

These classes never participate in combat:
- `Falcon`
- `FishingShip`
- Ship types: `fishingship`, `cargoship`

**Code Reference**: `SimpleCombat.js:1087-1093`

Additionally, **players are excluded from the aggro system** - they do not automatically detect and engage enemies based on proximity. Players must explicitly choose targets or receive combat targets through counter-aggro when attacked.

---

## 2. COMBAT PATHING/MOVEMENT

### Overview

Combat pathing determines how entities move during combat, handling melee positioning, ranged kiting, pathfinding failures, and leash range enforcement.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `handleChase()` (lines 1009-1076)
  - `ensureMeleePositioning()` (lines 504-536)
  - `getPositioningPriority()` (lines 124-152)
  - `moveAwayFromTarget()` (lines 439-502)
  - `findAdjacentTile()` (lines 94-122)

### Movement Flow

```
Combat Update Loop
    ↓
[Target out of attack range?]
    ↓
handleChase(entity, target)
    ↓
[Melee?] → Pathfind to adjacent tile
[Ranged?] → Pathfind directly to target
    ↓
[Too close for ranged?] → moveAwayFromTarget() (kiting)
    ↓
[Melee on same tile?] → ensureMeleePositioning()
    ↓
[Pathfinding failed 3 times?] → endCombat()
```

### Key Components

#### Melee Positioning

Melee units must be on adjacent tiles, never the same tile as their target. The system uses a priority-based approach to prevent position swapping.

**Code Reference**: `SimpleCombat.js:504-536`

**Key Logic**:
1. Check if entity and target are on same tile
2. Determine priority: Attacker (initiated combat) > Higher HP > Entity ID
3. Lower priority unit waits (allows attack anyway)
4. Higher priority unit attempts repositioning to adjacent tile
5. If no adjacent tile found, allow attack anyway

```javascript
ensureMeleePositioning(entity, target) {
  if (entity.ranged) return false; // Only for melee
  
  const entityLoc = global.getLoc(entity.x, entity.y);
  const targetLoc = global.getLoc(target.x, target.y);
  
  // Check if on same tile
  if (entityLoc[0] === targetLoc[0] && entityLoc[1] === targetLoc[1]) {
    // Determine priority
    const priority = this.getPositioningPriority(entity, target);
    
    if (priority === 'target') {
      // Target has priority - this entity waits
      // Allow attack anyway (temporary same-tile is OK)
      return false;
    }
    
    // Entity has priority - attempt repositioning
    const adjacentTile = this.findAdjacentTile(entity, target);
    if (adjacentTile && entity.moveTo) {
      entity.moveTo(entity.z, adjacentTile[0], adjacentTile[1]);
      return true; // Repositioning
    }
    
    // No adjacent tile found - allow attack anyway
    return false;
  }
  
  return false; // Not on same tile
}
```

**Priority Determination** (`getPositioningPriority()`):
- **Primary**: Attacker (unit that initiated combat first, tracked via `combatState.startTime`)
- **Tiebreaker 1**: Higher HP
- **Tiebreaker 2**: Entity ID (deterministic)

**Benefits of Simplified System**:
- No complex state tracking (removed `_isRepositioning`, `_repositionAttempts`, `_repositionStartTime`, `_repositionLastPos`)
- No timeout/attempt tracking
- Clearer logic flow
- Fewer edge cases
- Better performance (less state checking per frame)

#### Ranged Kiting

Ranged units maintain distance from targets. If too close (<96px), they back away.

**Code Reference**: `SimpleCombat.js:649-652, 887-898`

```javascript
// Ranged unit kiting
if (entity.ranged && distance < this.RANGED_KITE_DISTANCE) {
  this.handleRangedKiting(entity, target);
}

handleRangedKiting(entity, target) {
  // Check every 2 seconds for kiting
  if (now - entity._lastKiteCheck > this.KITE_CHECK_INTERVAL) {
    entity._lastKiteCheck = now;
    this.moveAwayFromTarget(entity, target);
  }
}
```

**Kite Distance**: 96px (1.5 tiles)
**Kite Check Interval**: 2000ms (2 seconds)

#### Move Away From Target

Calculates direction away from target and moves 2 tiles in that direction.

**Code Reference**: `SimpleCombat.js:439-502`

```javascript
moveAwayFromTarget(entity, target) {
  // Calculate direction away from target
  const dx = entityLoc[0] - targetLoc[0];
  const dy = entityLoc[1] - targetLoc[1];
  
  // Normalize and move 2 tiles away
  const retreatDistance = 2;
  const newX = Math.round(entityLoc[0] + normalizedDx * retreatDistance);
  const newY = Math.round(entityLoc[1] + normalizedDy * retreatDistance);
  
  // Clamp to map bounds and check walkability
  // If blocked, try adjacent tiles
}
```

#### Pathfinding to Adjacent Tiles

Melee units pathfind to the closest walkable adjacent tile to their target.

**Code Reference**: `SimpleCombat.js:94-122`

```javascript
findAdjacentTile(entity, target) {
  const targetLoc = global.getLoc(target.x, target.y);
  const adjacentTiles = [
    [targetLoc[0] + 1, targetLoc[1]], // Right
    [targetLoc[0] - 1, targetLoc[1]], // Left
    [targetLoc[0], targetLoc[1] + 1], // Down
    [targetLoc[0], targetLoc[1] - 1]  // Up
  ];
  
  // Find closest walkable adjacent tile
  let bestTile = null;
  let bestDist = Infinity;
  // ... find best tile
}
```

#### Pathfinding Failure Handling

If pathfinding fails 3 times consecutively, combat is dropped.

**Code Reference**: `SimpleCombat.js:1161-1179`

**Note**: `handleChase()` no longer performs redundant target validation - the target is already validated in `update()` before `handleChase()` is called.

```javascript
entity._pathfindTimeout = setTimeout(() => {
  const state = entity.combatState;
  if (entity && state && state.target === target.id) {
    // Check if still at same position and have no path
    if (entity.x === oldX && entity.y === oldY && !entity.path) {
      state.pathfindingFailures++;
      
      if (state.pathfindingFailures >= 3) {
        this.endCombat(entity, target);
        state.pathfindingFailures = 0;
      }
    } else {
      entity._pathfindingFailures = 0; // Reset on success
    }
  }
}, 1000); // Check after 1 second
```

#### Running Speed Activation

NPCs run (faster speed) when chasing in combat.

**Code Reference**: `SimpleCombat.js:1024-1032`

```javascript
// NPCs run when chasing in combat
if (entity.type === 'npc' && !entity.running) {
  entity.running = true;
  if (!entity._originalBaseSpd) {
    entity._originalBaseSpd = entity.baseSpd;
  }
  entity.baseSpd = entity.runSpd || 6;
  entity.maxSpd = entity.runSpd || 6;
}
```

**Speed Restoration**: When combat ends, original speed is restored (see `endCombat()` lines 1100-1104).

#### Leash Range Enforcement

Entities return home if they chase too far from their spawn/home location.

**Code Reference**: `SimpleCombat.js:874-885, 641-647`

```javascript
checkLeashRange(entity) {
  if (!entity.home || !entity.home.loc) return false;
  
  const homeX = entity.home.loc[0] * 64;
  const homeY = entity.home.loc[1] * 64;
  const homeDist = Math.sqrt(Math.pow(entity.x - homeX, 2) + Math.pow(entity.y - homeY, 2));
  // Use 2x aggro range as default (matching boar implementation: 256 = 2x 128)
  const leashRange = entity.wanderRange || ((entity.aggroRange || 512) * 2);
  
  return homeDist > leashRange;
}
```

**Leash Range Calculation**:
- Default: `2x aggroRange` (e.g., 512px aggro = 1024px leash)
- Can be overridden via `entity.wanderRange` property
- Example: Default aggro of 512px results in 1024px leash range

If leash range exceeded:
1. End combat
2. Set action to 'returning'
3. Call `entity.return()` if available

### Attack Range Constants

**Code Reference**: `SimpleCombat.js:7-18`

```javascript
this.MELEE_RANGE = 96;           // 1.5 tiles - actual attack range for melee
this.MELEE_ATTACK_RANGE = 96;    // Max range to start attacking
this.RANGED_ATTACK_RANGE = 640; // 10 tiles - greater than default NPC aggro range of 512 (8 tiles) so players can attack from outside aggro
this.RANGED_KITE_DISTANCE = 96; // Too close - back away
this.BOAR_ATTACK_RANGE = 64;    // 1 tile - boars have shorter range
this.DETECTION_RANGE = 128;     // 2 tiles for stealth detection
this.MELEE_COOLDOWN = 1000;     // 1 second
this.RANGED_COOLDOWN = 1500;    // 1.5 seconds
this.KITE_CHECK_INTERVAL = 2000; // 2 seconds
this.PENDING_COMBAT_TIMEOUT = 5000; // 5 seconds
this.AUTO_ATTACK_RESUME_TIMEOUT = 3000; // 3 seconds - auto-resume after navigation
```

**Note**: The `RANGED_ATTACK_RANGE` is intentionally larger (640px) than the default NPC aggro range (512px) to allow players to attack NPCs from outside their aggro range, providing a tactical advantage for ranged combat.

**Range Methods**:
- `getAttackRange(entity)`: Returns attack range based on entity type
- `getMeleeRange(entity)`: Returns melee range (for positioning checks)

---

## 3. DEFAULT COMBAT BEHAVIORS

### Overview

Default combat behaviors handle auto-attacking, damage calculation, defense application, and attack animations for both melee and ranged combatants.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `handleAttack()` (lines 900-1007)
  - `calculateDamage()` (lines 299-341)
  - `applyDamage()` (lines 343-379)
  - `updateFacingToTarget()` (lines 286-297)

### Combat Update Flow

```
Game Loop (lambic.js)
    ↓
[Check if combatState exists]
    ├─ Player: if (combatState && (!autoAttackPaused || pendingTarget))
    └─ NPC: if (combatState)
    ↓
SimpleCombat.update(entity)
    ↓
[Handle attack intent (pendingTarget) if present]
    ├─ If handling attack intent → pathfind and check range
    └─ If in range → convert to full combat and attack
    ↓
[Ensure action is set when combatState exists (defensive)]
    ↓
[Validate combat state and target - SINGLE VALIDATION POINT]
    ├─ If invalid → endCombat() and return
    └─ If valid → cache target reference
    ↓
[For players: Validate target exists]
    ├─ If target doesn't exist → endCombat() and return
    └─ If target exists → continue (allow player-initiated attacks)
    ↓
[Validate combat state consistency]
    ↓
[Check auto-attack pause (players only)]
    ├─ If paused and target in range → resume auto-attack
    └─ If paused and target out of range → wait for timeout or range
    ↓
[Check leash range]
    ├─ If exceeded → endCombat() and return
    └─ If within range → continue
    ↓
[Cache distance and attack range calculations]
    ↓
[Handle ranged kiting if needed]
    ↓
[Handle melee positioning if needed]
    ↓
[In attack range?]
    ├─ Yes → handleAttack() (no redundant validation)
    └─ No → handleChase() (no redundant validation)
```

**Player Combat Validation**: Players have validation to ensure target exists. The system allows player-initiated attacks even if the target hasn't aggro'd yet, which enables ranged attacks from outside aggro range. See the [Player Aggro System](#player-aggro-system) section for details.

**Code Reference**: `SimpleCombat.js:703-727`

```javascript
// For players, validate target exists (but don't require target to be in combat yet)
// This allows players to initiate attacks even if target hasn't aggro'd
if (entity.type === 'player') {
  const target = this.getEntityById(state.target);
  if (!target) {
    // Target doesn't exist - end combat
    this.endCombat(entity, target);
    return;
  }
  
  // Only validate target is in combat if target is an NPC that should have aggro'd
  // Allow player-initiated attacks even if target hasn't aggro'd yet
  // This prevents clearing combat when player initiates attack from range
  if (target.type === 'npc' && target.military) {
    // For NPCs, check if they should have aggro'd but haven't
    // Only clear if target is dead, removed, or clearly invalid
    if (target.hp !== null && target.hp <= 0) {
      this.endCombat(entity, target);
      return;
    }
  }
}
```

**Single Validation Point**: Target validation happens once at the start of `update()` (line 744). The cached target is then used throughout the update cycle. `handleAttack()` and `handleChase()` no longer perform redundant validations, trusting the validation from `update()`.

### Key Components

#### Auto-Attack System

Entities automatically attack when in range, respecting cooldown timers.

**Code Reference**: `SimpleCombat.js:1006-1112`

**Cooldown Constants**:
- **Melee**: 1000ms (1 second)
- **Ranged**: 1500ms (1.5 seconds)

```javascript
handleAttack(entity, target) {
  const state = this.ensureCombatState(entity);
  const now = Date.now();
  const cooldownMs = entity.ranged ? this.RANGED_COOLDOWN : this.MELEE_COOLDOWN;
  const timeSince = now - state.lastAttack;
  
  if (timeSince < cooldownMs) {
    return; // Still on cooldown
  }
  
  // Perform attack...
  // Note: Target validation is NOT performed here - it's already validated in update()
  state.lastAttack = now;
}
```

**Validation**: Target validation is performed once in `update()` at the start of the update cycle. `handleAttack()` and `handleChase()` trust this validation and do not re-validate, eliminating redundant checks and potential inconsistencies.

**Auto-Attack Pause**: Players can pause auto-attack with navigation commands (`autoAttackPaused` flag). The system automatically resumes auto-attack when:
- Target enters attack range
- Auto-resume timeout expires (3 seconds)

**Code Reference**: `SimpleCombat.js:753-776`

**Game Loop Integration**: The game loop checks `combatState` existence rather than `action === 'combat'`, ensuring combat updates are called whenever combat state exists. This prevents entities from getting stuck when state exists but `action` isn't set.

**Code Reference**: `lambic.js:3618-3628` (players), `lambic.js:5284-5288` (NPCs)

```javascript
// Player update loop
if (self.combatState && (!self.autoAttackPaused || self.combatState.pendingTarget)) {
  global.simpleCombat.update(self);
}

// NPC update loop
if (player.type === 'npc' && global.simpleCombat && player.combatState) {
  global.simpleCombat.update(player);
}
```

```javascript
// Check if auto-attacking is paused (player issued navigation command)
if (entity.autoAttackPaused) {
  const distance = this.getDistance(entity, target);
  const attackRange = this.getAttackRange(entity);
  
  // Clear pause if target is in attack range
  if (distance <= attackRange) {
    entity.autoAttackPaused = false;
  } else {
    // Set timeout to auto-resume if navigation takes too long
    if (!entity._autoAttackResumeTimeout) {
      entity._autoAttackResumeTimeout = setTimeout(() => {
        if (entity && entity.autoAttackPaused) {
          entity.autoAttackPaused = false;
        }
      }, this.AUTO_ATTACK_RESUME_TIMEOUT);
    }
    return; // Skip combat updates but keep combat status
  }
}
```

#### Damage Calculation

Damage is calculated as: `weaponDamage - armorDefense` with a minimum of 1 damage.

**Code Reference**: `SimpleCombat.js:299-341`

```javascript
calculateDamage(attacker, target) {
  // Get attacker's weapon damage
  let weaponDamage = attacker.damage || 10; // Base damage for NPCs
  
  // For players, check weapon stats
  if (attacker.type === 'player' && attacker.gear && attacker.gear.weapon) {
    const equip = global.equip || {};
    const weapon = equip[attacker.gear.weapon];
    if (weapon && weapon.dmg) {
      weaponDamage = weapon.dmg;
    }
  }
  
  // Get defender's armor defense
  let armorDefense = target.defense || target.fortitude || 0;
  
  // For players, check armor stats
  if (target.type === 'player' && target.gear) {
    const equip = global.equip || {};
    if (target.gear.armor) {
      const armor = equip[target.gear.armor];
      if (armor && armor.defense) {
        armorDefense += armor.defense;
      }
    }
    if (target.gear.head) {
      const head = equip[target.gear.head];
      if (head && head.defense) {
        armorDefense += head.defense;
      }
    }
  }
  
  // Calculate net damage (minimum 1)
  const netDamage = Math.max(1, weaponDamage - armorDefense);
  
  return {
    weaponDamage,
    armorDefense,
    netDamage
  };
}
```

**Damage Sources**:
- **NPCs**: Use `entity.damage` property (default 10)
- **Players**: Use equipped weapon's `dmg` stat from `global.equip`
- **Defense**: NPCs use `defense` or `fortitude`, players use armor + head defense

#### Damage Application

Damage is applied to target HP and triggers combat events.

**Code Reference**: `SimpleCombat.js:343-379`

```javascript
applyDamage(attacker, target, damageType = 'melee') {
  const damageInfo = this.calculateDamage(attacker, target);
  const netDamage = damageInfo.netDamage;
  
  // Apply damage
  if (target.hp !== null) {
    target.hp -= netDamage;
  }
  
  // Create combat attack event
  if (global.eventManager) {
    global.eventManager.combatAttack(attacker, target, netDamage, { 
      x: target.x, 
      y: target.y, 
      z: target.z,
      weaponDamage: damageInfo.weaponDamage,
      armorDefense: damageInfo.armorDefense
    });
  }
  
  // Trigger attack animation
  if (attacker.pressingAttack !== undefined) {
    attacker.pressingAttack = true;
    setTimeout(() => {
      if (attacker) attacker.pressingAttack = false;
    }, 200); // 200ms attack animation
  }
  
  // Check for death
  if (target.hp !== null && target.hp <= 0) {
    this.handleTargetDeath(attacker, target, damageType);
  }
  
  return netDamage;
}
```

#### Melee Attacks

Melee attacks apply damage directly using `applyDamage()`.

**Code Reference**: `SimpleCombat.js:1104`

```javascript
// Melee attack - use standardized damage calculation
this.applyDamage(entity, target, 'melee');
state.lastAttack = now;
```

**Note**: Target validation is not performed in `handleAttack()` - the target is already validated in `update()` before `handleAttack()` is called.

#### Ranged Attacks

Ranged attacks use the `shootArrow()` method which creates an Arrow entity.

**Code Reference**: `SimpleCombat.js:1068-1093`

```javascript
if (entity.ranged && entity.shootArrow) {
  // For players, check if they have arrows before shooting
  if (entity.type === 'player') {
    if (!entity.inventory.arrows || entity.inventory.arrows <= 0) {
      return; // Cannot shoot without arrows
    }
  }
  
  // Ranged units shoot arrows
  entity.shootArrow(target.id);
  state.lastAttack = now;
  
  // Check if target died (arrow might have hit instantly)
  if (!this.isTargetValid(target, entity)) {
    this.endCombat(entity, target);
    return;
  }
}
```

**Note**: The target validation check after shooting is necessary because the arrow might have killed the target instantly. However, the initial target validation happens in `update()` before `handleAttack()` is called.

**Arrow System**:
- Arrows are entities that travel to target
- Players consume arrows from inventory
- NPCs have unlimited arrows
- Arrow damage is applied on hit (see `server/js/Entity.js:11757-11910`)

**Arrow Consumption** (for players):
```javascript
// From Entity.js:2514-2516
if (self.type === 'player' && self.inventory.arrows > 0) {
  self.inventory.arrows--;
}
```

#### Facing Direction Updates

Entities face their target before attacking.

**Code Reference**: `SimpleCombat.js:286-297`

```javascript
updateFacingToTarget(entity, target) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  
  // Determine primary direction based on larger axis
  if (Math.abs(dx) > Math.abs(dy)) {
    entity.facing = dx > 0 ? 'right' : 'left';
  } else {
    entity.facing = dy > 0 ? 'down' : 'up';
  }
}
```

#### Attack Animation

Attack animations are triggered via the `pressingAttack` flag.

**Code Reference**: `SimpleCombat.js:365-371`

```javascript
if (attacker.pressingAttack !== undefined) {
  attacker.pressingAttack = true;
  setTimeout(() => {
    if (attacker) attacker.pressingAttack = false;
  }, 200); // 200ms attack animation
}
```

The client-side rendering system uses this flag to display attack sprites (see `client/js/entities/PlayerEntity.js:390-459`).

#### Stealth Attack Handling

First attack from stealth removes stealth from both attacker and target.

**Code Reference**: `SimpleCombat.js:944-957`

```javascript
// STEALTH COMBAT: Handle first stealth attack
const state = entity.combatState;
if (entity.stealthed && (!state || !state.target || state.pendingTarget)) {
  this.handleStealthAttack(entity, target);
}

// Remove stealth when attacking (if still stealthed)
this.removeStealth(entity);
this.removeStealth(target); // Attack reveals target
```

---

## 4. ESCAPE BEHAVIORS

### Overview

Escape behaviors handle when and how entities disengage from combat. Currently, only peaceful units have automatic flee behavior. There is **no HP-based escape system** for combatants - this is a gap for future enhancement.

### Core Files

- **Primary**: `server/js/core/SimpleFlee.js` (flee behavior)
- **Secondary**: `server/js/core/SimpleCombat.js` (combat escape detection)

### Escape Flow

```
Peaceful Unit Aggro'd
    ↓
startCombat() → Sets action='flee'
    ↓
SimpleFlee.update()
    ↓
[Calculate direction away from threat]
    ↓
[Move in best available direction]
    ↓
[Distance > 512px?] → Stop fleeing
```

### Key Components

#### Peaceful Unit Flee

Peaceful units (Serfs, Deer, Sheep) automatically flee when aggro'd instead of fighting.

**Code Reference**: `SimpleCombat.js:1288-1303`

```javascript
const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
if (peaceful.includes(entity.class)) {
  // Serfs should not flee from prey animals (deer)
  if (target.isPrey && entity.class === 'Serf') {
    return; // Don't start combat or flee
  }
  entity.action = 'flee';
  entity.combat.target = target.id;
  entity._pathfindingFailures = 0;
  return;
}
```

#### SimpleFlee System

The SimpleFlee system handles flee movement logic.

**Code Reference**: `server/js/core/SimpleFlee.js:17-191`

**Flee Distance Threshold**: 512px (8 tiles)

```javascript
update(entity) {
  // Validate flee state
  const state = entity.combatState;
  if (!state || !state.target) {
    this.restoreSpeed(entity);
    entity.action = null;
    return;
  }
  
  const target = global.Player.list[state.target];
  
  // Target gone or is a ghost? Stop fleeing
  if (!target || target.ghost) {
    this.restoreSpeed(entity);
    entity.combat.target = null;
    entity.action = null;
    return;
  }
  
  // Calculate distance from threat
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Far enough? Stop fleeing
  if (distance > 512) {
    this.restoreSpeed(entity);
    entity.combat.target = null;
    entity.action = null;
    return;
  }
  
  // Calculate direction AWAY from threat
  // Choose best cardinal direction
  // Create path and move
}
```

#### Flee Speed

Fleeing entities use their run speed.

**Code Reference**: `SimpleFlee.js:45-50`

```javascript
// Set flee speed - use character's run speed
if (!entity._originalBaseSpd) {
  entity._originalBaseSpd = entity.baseSpd;
}
entity.baseSpd = entity.runSpd || 6;
```

**Speed Restoration**: When fleeing ends, original speed is restored.

#### Deer Special Behavior

Deer blend flee direction with forest direction (90% flee, 10% forest) when very close to forest.

**Code Reference**: `SimpleFlee.js:87-112`

```javascript
// For deer, try to flee toward forest if very close
if (entity.class === 'Deer' && entity.findNearestForest) {
  var forestLoc = entity.findNearestForest();
  if (forestLoc) {
    var forestDist = Math.sqrt(forestDx * forestDx + forestDy * forestDy);
    
    // Only blend if forest is very close (within 3 tiles)
    if (forestDist <= 3 && forestDist > 0) {
      // Blend flee direction with forest direction (90% flee, 10% forest)
      var blendedX = (dirX * 0.9) + (forestDirX * 0.1);
      var blendedY = (dirY * 0.9) + (forestDirY * 0.1);
      // ... normalize and use blended direction
    }
  }
}
```

#### Flee Direction Calculation

The system calculates the best cardinal direction away from the threat.

**Code Reference**: `SimpleFlee.js:114-182`

```javascript
// Calculate direction AWAY from threat
const awayX = entity.x - target.x;
const awayY = entity.y - target.y;

// Normalize
const magnitude = Math.sqrt(awayX * awayX + awayY * awayY);
let dirX = magnitude > 0 ? awayX / magnitude : 0;
let dirY = magnitude > 0 ? awayY / magnitude : 0;

// Choose the strongest direction (cardinal only)
const directions = [
  {name: 'right', dx: 1, dy: 0},
  {name: 'left', dx: -1, dy: 0},
  {name: 'down', dx: 0, dy: 1},
  {name: 'up', dx: 0, dy: -1}
];

// Score each direction based on alignment with flee direction
// Choose best walkable direction
```

#### Escape Cooldown

A cooldown prevents rapid direction oscillation.

**Code Reference**: `SimpleFlee.js:36-43, 189`

```javascript
if (!entity.fleeCooldown) {
  entity.fleeCooldown = 0;
}

if (entity.fleeCooldown > 0) {
  entity.fleeCooldown--;
}

// Set cooldown when creating new path
entity.fleeCooldown = 30; // 30 frames = 0.5 seconds at 60fps
```

#### Combat Escape Detection

When combat ends due to distance, escape messages are sent.

**Code Reference**: `SimpleCombat.js:1457-1472`

```javascript
// Send escape message to player (when player escapes)
if (entity.type === 'player' && target) {
  const distance = this.getDistance(entity, target);
  const escapeRange = 768; // 12 tiles
  if (distance > escapeRange) {
    // Create combat escape event
    if (global.eventManager) {
      global.eventManager.combatEscape(entity, target, { x: entity.x, y: entity.y, z: entity.z });
    }
    
    const playerSocket = global.SOCKET_LIST[entity.id];
    if (playerSocket) {
      playerSocket.write(JSON.stringify({ msg: 'addToChat', message: '<i>You escaped from combat.</i>' }));
    }
  }
}
```

**Escape Range**: 768px (12 tiles)

#### Enemy Give-Up Message

When an enemy gives up the chase, a message is sent to the player.

**Code Reference**: `SimpleCombat.js:1444-1454`

```javascript
// Send escape message to player (when enemy gives up)
if (target.type === 'player') {
  const escapedFrom = entity.name || entity.class;
  const socket = global.SOCKET_LIST[target.id];
  if (socket) {
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: `<span style="color:yellow;">🏃 ${escapedFrom} has given up the chase...</span>` 
    }));
  }
}
```

### Known Gap: HP-Based Escape

**Currently Missing**: There is no system that triggers escape when an entity's HP drops below a certain threshold. This would be a valuable addition for:

- NPCs that should retreat when low on health
- Players who might want automatic escape at low HP
- More dynamic combat where units try to survive

**Future Implementation Suggestion**:
```javascript
// In SimpleCombat.update() or handleAttack()
const LOW_HP_THRESHOLD = 0.25; // 25% HP
if (entity.hp / entity.hpMax < LOW_HP_THRESHOLD && entity.action === 'combat') {
  // Trigger escape attempt
  this.attemptEscape(entity, target);
}
```

---

## 5. DEATH HANDLING

### Overview

Death handling manages what happens when entities die, including kill tracking, item dropping, skeleton spawning, respawn systems, and event broadcasting.

### Core Files

- **Primary**: 
  - `server/js/Entity.js` - `die()` method (lines 1951-2133)
  - `lambic.js` - Player `die()` method (lines 2318-2571)
  - `server/js/core/SimpleCombat.js` - `handleTargetDeath()` (lines 276-283)
  - `server/js/core/EventManager.js` - `death()` method (lines 470-485)

### Death Flow

```
Entity HP <= 0
    ↓
handleTargetDeath() or direct die() call
    ↓
[Kill Tracking]
    ├─ Increment killer.kills
    ├─ Update skulls display
    ├─ Check miniboss growth (fauna)
    └─ Check military upgrades
    ↓
[End Combat for both entities]
    ↓
[Create Death Event]
    ↓
[Drop Items]
    ├─ Inventory items
    └─ Store resources
    ↓
[Spawn Skeleton] (if applicable)
    ↓
[Respawn Logic]
    ├─ Players → Ghost mode
    └─ NPCs → Immediate respawn
```

### Key Components

#### Kill Tracking

When an entity kills another, the killer's kill count is incremented and tracked.

**Code Reference**: `Entity.js:1961-2011, lambic.js:2328-2360`

```javascript
// Track kill and award skulls
killer.kills = (killer.kills || 0) + 1;

// Update skull display based on kill count
if (killer.kills >= 10) {
  killer.skulls = '☠️'; // Skull and crossbones
} else if (killer.kills >= 3) {
  killer.skulls = '💀'; // Single skull
}
```

**Skull Display Thresholds**:
- 3 kills: 💀 (single skull)
- 10 kills: ☠️ (skull and crossbones)

#### Military Unit Upgrades

Military units upgrade based on kill count.

**Code Reference**: `SimpleCombat.js:1154-1212`

```javascript
checkMilitaryUpgrade(unit, house) {
  const progression = global.FACTION_UNIT_PROGRESSION[house.name];
  if (!progression) return;
  
  // 3rd kill: upgrade to elite (if exists)
  if (unit.kills === 3 && progression.elite) {
    this.upgradeMilitaryUnit(unit, progression.elite, house);
  }
  
  // 10th kill: upgrade to mounted (if exists AND stable built)
  if (unit.kills === 10 && progression.mounted && house.hasStable) {
    this.upgradeMilitaryUnit(unit, progression.mounted, house);
  }
}
```

**Upgrade Thresholds**:
- 3 kills: Upgrade to elite unit class
- 10 kills: Upgrade to mounted unit class (requires stable)

#### Fauna Miniboss Growth

Wolves and Boars grow larger as they accumulate kills.

**Code Reference**: `Entity.js:1981-2003`

```javascript
// Phase 6: Fauna Miniboss Growth
if (killer.class === 'Boar' || killer.class === 'Wolf') {
  let newScale = killer.spriteScale;
  let shouldUpgrade = false;
  
  if (killer.kills === 3 && killer.spriteScale < 1.3) {
    newScale = 1.3; // 30% larger at 3 kills
    shouldUpgrade = true;
  } else if (killer.kills === 10 && killer.spriteScale < 1.6) {
    newScale = 1.6; // 60% larger at 10 kills
    shouldUpgrade = true;
  }
  
  if (shouldUpgrade) {
    killer.spriteScale = newScale;
    // Create miniboss upgrade event
  }
}
```

**Growth Thresholds**:
- 3 kills: 1.3x scale (30% larger)
- 10 kills: 1.6x scale (60% larger)

#### Death Messages

All death messages are centralized through the EventManager system to prevent duplicate messages.

**Code Reference**: `EventManager.js:470-485, Entity.js:2027-2031`

**Centralized Death Message System**:
All death messages are sent through `EventManager.death()`, which broadcasts to nearby players in the area. The `SimpleCombat.handleTargetDeath()` method no longer sends direct socket messages to avoid duplicates.

```javascript
// From Entity.js:2027-2031
// Create death event
if (global.eventManager) {
  const killer = report.id ? Player.list[report.id] : null;
  global.eventManager.death(self, killer, { x: self.x, y: self.y, z: deathZ });
}

// From EventManager.death()
message: killer 
  ? `<span style="color:#ff0000;">💀 ${victim.name || victim.class} was slain by ${killer.name || killer.class}!</span>`
  : `<span style="color:#ff0000;">💀 ${victim.name || victim.class} has died!</span>`
```

**Message Format**:
- **With Killer**: `💀 [Victim] was slain by [Killer]!` (red text)
- **No Killer**: `💀 [Victim] has died!` (red text)

**Communication Modes**:
- `AREA`: Broadcast to nearby players within event range
- `SPECTATOR`: Visible to spectator camera system

**Escape Messages**:
- "You escaped from combat" (player escapes)
- "[Enemy] has given up the chase..." (enemy gives up)

#### Item Dropping

All inventory items and store resources are dropped at death location.

**Code Reference**: `Entity.js:2071-2113, lambic.js:2388-2439`

```javascript
// DROP INVENTORY AND EQUIPPED ITEMS
var droppedItems = [];

// Drop inventory items
if (self.inventory) {
  for (var item in self.inventory) {
    if (item === 'keyRing' || item === 'mapData') continue; // Skip special items
    var qty = self.inventory[item];
    if (qty > 0) {
      droppedItems.push({item: item, qty: qty});
      self.inventory[item] = 0;
    }
  }
}

// Drop store resources
if (self.stores) {
  for (var resource in self.stores) {
    var qty = self.stores[resource];
    if (qty > 0) {
      droppedItems.push({item: resource, qty: qty});
      self.stores[resource] = 0;
    }
  }
}

// Scatter items around death location
if (droppedItems.length > 0 && global.itemFactory) {
  var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
  for (var i in droppedItems) {
    var drop = droppedItems[i];
    var offsetX = (Math.random() - 0.5) * tileSize * 2;
    var offsetY = (Math.random() - 0.5) * tileSize * 2;
    
    global.itemFactory.createItem(drop.item, {
      x: deathCoords[0] + offsetX,
      y: deathCoords[1] + offsetY,
      z: deathZ,
      qty: drop.qty,
      innaWoods: self.innaWoods || false
    });
  }
}
```

**Item Scattering**:
- Items are scattered randomly within 2 tiles of death location
- Uses `itemFactory.createItem()` for proper item system integration
- Special items (`keyRing`, `mapData`) are not dropped

#### Skeleton Spawning

Skeletons are spawned at death locations for visual representation.

**Code Reference**: `Entity.js:2036-2050, lambic.js:2374-2384`

```javascript
// SPAWN SKELETON AT DEATH LOCATION
var animalClasses = ['Wolf', 'Deer', 'Boar', 'Sheep', 'Falcon'];
var isAnimal = animalClasses.includes(self.class);

if (!isAnimal && global.Skeleton) {
  var deathCoords = getCenter(deathLocation[0], deathLocation[1]);
  global.Skeleton({
    id: Math.random(),
    x: deathCoords[0],
    y: deathCoords[1],
    z: deathZ,
    innaWoods: self.innaWoods || false
  });
}
```

**Skeleton Rules**:
- **Players**: Always spawn skeleton
- **NPCs**: Only humanoids (excludes animals: Wolf, Deer, Boar, Sheep, Falcon)

#### Player Respawn System

Players enter ghost mode upon death and can respawn after a timer or manually.

**Code Reference**: `lambic.js:2443-2571`

**Ghost Mode**:
```javascript
// GHOST MODE FOR PLAYERS (NPCs respawn immediately)
if (self.type === 'player') {
  self.ghost = true;
  self.hp = self.hpMax; // Restore HP for ghost
  self.spirit = self.spiritMax; // Restore spirit
  
  // If underwater when dying, immediately move to surface
  if (self.z === -3) {
    // Move to surface logic...
  }
  
  // Send death message with ghost instructions
  var deathMsg = '<span style="color:#ff0000;"><b>☠️ YOU DIED</b></span>';
  if (killer) {
    deathMsg += '<br>Killed by: ' + (killer.name || killer.class);
  }
  if (report.cause) {
    deathMsg += '<br>Cause: ' + report.cause;
  }
  deathMsg += '<br><i>Your items have been dropped at the death location</i>';
  deathMsg += '<br><br><span style="color:#aaaaff;">👻 You are now a ghost. Move to where you want to respawn.</span>';
  deathMsg += '<br><i>Auto-respawn in 1:30, or type /respawn to respawn at home</i>';
}
```

**Auto-Respawn Timer**: 1:30 (90 seconds)

**Manual Respawn**: `/respawn` command respawns at home or random location

**Respawn Method**:
```javascript
respawnFromGhost(location, isManualRespawn) {
  // Respawn at specified location
  self.x = location.x;
  self.y = location.y;
  self.z = location.z;
  
  // Brief immunity after respawn
  self.respawnImmunity = true;
  setTimeout(() => {
    self.respawnImmunity = false;
  }, 3000); // 3 seconds immunity
}
```

**Respawn Immunity**: 3 seconds of invulnerability after respawn

#### NPC Respawn System

NPCs respawn immediately via the House respawn system.

**Code Reference**: `Entity.js:2115-2131, Houses.js:127`

```javascript
// NPC respawning logic
if (self.house && self.house.type == 'npc') {
  var units = House.list[self.house].military.scout.units;
  if (units.length > 0) {
    if (units.includes(self.id)) {
      House.list[self.house].military.scout.units.remove(units.indexOf(self.id), 1);
      // Remove banner items...
    }
  }
  House.list[self.house].respawn(self.class, self.home);
}
self.toRemove = true;
```

**NPC Respawn**: Immediate respawn at home location via `House.respawn()`

#### Event System Integration

Death events are created and broadcast through the event system.

**Code Reference**: `EventManager.js:470-485`

```javascript
death(victim, killer, position) {
  return this.createEvent({
    category: this.categories.DEATH,
    subject: victim.id,
    subjectName: victim.name || victim.class,
    action: 'died',
    target: killer ? killer.id : null,
    targetName: killer ? (killer.name || killer.class) : 'unknown',
    communication: [this.commModes.AREA, this.commModes.SPECTATOR],
    message: killer 
      ? `<span style="color:#ff0000;">💀 ${victim.name || victim.class} was slain by ${killer.name || killer.class}!</span>`
      : `<span style="color:#ff0000;">💀 ${victim.name || victim.class} has died!</span>`,
    log: `[DEATH] ${victim.name || victim.class} ${killer ? `killed by ${killer.name || killer.class}` : 'died'} at [${Math.floor(position.x)},${Math.floor(position.y)}] z=${position.z}`,
    position
  });
}
```

**Event Communication Modes**:
- `AREA`: Broadcast to nearby players
- `SPECTATOR`: Visible to spectator camera system

#### Social System Integration

The social system records death witnesses for NPC memory.

**Code Reference**: `Entity.js:1955-1959, SocialSystem.js:578-600`

```javascript
// Notify social system of death for witness recording
if (global.socialSystem) {
  global.socialSystem.recordDeathWitnessed(self.id, deathLocation, 1280);
  global.socialSystem.removeNPC(self.id);
}
```

**Witness Radius**: 1280px (20 tiles)

---

## 6. FUTURE ADDITION OF "SKILLS"

### Overview

The current stealth implementation provides a foundation for a future skills system. This section documents the existing stealth mechanics and outlines how a comprehensive skills framework could be built.

### Current Stealth Implementation

Stealth is currently hardcoded for specific classes (Rogues, Hunters) and provides a working example of how skills could function.

### Core Files

- **Primary**: 
  - `server/js/core/SimpleCombat.js` - Stealth detection and handling
  - `server/js/Entity.js` - Stealth state management (lines 1851-1852, 2802-2847, 6129-6132)
  - `client/js/utils/VisibilityHelper.js` - Stealth rendering

### Stealth State Management

**Code Reference**: `Entity.js:1851-1852`

```javascript
self.stealthed = false;
self.revealed = false;
```

**Stealth States**:
- `stealthed = true`: Unit is in stealth mode (invisible to enemies beyond detection range)
- `revealed = true`: Unit has been detected but still partially stealthed (70% opacity)
- Both false: Unit is fully visible

### Stealth Conditions

Stealth can only be activated under certain conditions.

**Code Reference**: `Entity.js:11641-11651` (Rogue), `Entity.js:11698-11708` (Hunter)

```javascript
if (!self.stealthed) {
  if (((self.z == 0 && (nightfall || self.innaWoods)) || self.z == -1 || self.z == -2) && !self.stealthTimer && !self.action) {
    self.stealthTimer = true;
    setTimeout(() => {
      self.stealthed = true;
      self.stealthTimer = false;
    }, 2000); // 2 second activation delay
  }
}
```

**Stealth Activation Conditions**:
- Ground level (z=0): Must be night OR in woods
- Underground (z=-1, -2): Always available
- Cannot be in action (combat, working, etc.)
- 2 second activation delay

### Stealth Detection

Stealthed units can be detected within 128px (2 tiles).

**Code Reference**: `SimpleCombat.js:249-255`

```javascript
checkStealthDetection(stealthedEntity, detector) {
  if (!stealthedEntity.stealthed) return false;
  if (stealthedEntity.revealed) return true; // Already revealed
  const distance = this.getDistance(stealthedEntity, detector);
  return distance <= this.DETECTION_RANGE; // 128px
}
```

**Detection Range**: 128px (2 tiles)

### Stealth Reveal Triggers

Stealth is removed (revealed) when:
1. **Attacking**: Attacker loses stealth
2. **Being Attacked**: Target loses stealth
3. **Detection**: Within 128px of an enemy
4. **Daytime in open**: If on ground level during day and not in woods

**Code Reference**: `SimpleCombat.js:87-92, 671-673`

```javascript
removeStealth(entity) {
  if (entity.stealthed) {
    entity.stealthed = false;
    entity.revealed = false;
  }
}

// Remove stealth when attacking
this.removeStealth(entity);
this.removeStealth(target); // Attack reveals target
```

### Stealth Movement

Stealthed units move slower (reduced drag).

**Code Reference**: `Entity.js:6129-6132`

```javascript
Character.prototype.updateStealthMechanics = function() {
  if (this.stealthed) {
    this.drag = 0.5; // Reduced speed while stealthed
    this.revealCheck(); // Check if stealth should be broken
  }
}
```

**Movement Penalty**: 0.5x drag (50% speed reduction)

### Stealth Rendering

Stealthed units have reduced opacity on the client.

**Code Reference**: `client/js/utils/VisibilityHelper.js:100-125, PlayerRenderer.js:170-176`

```javascript
stealthCheck(id, config) {
  const p = Player.list[id];
  if (!p) return 0;
  
  if (p.stealthed) {
    if (selfId === id) {
      return 1; // Self-view: 70% visible
    } else if (allyCheck(id) === 2) {
      return 1; // Ally view: 70% visible
    } else if (p.revealed) {
      return 1.5; // Revealed: 70% visible
    } else {
      return 2; // Fully stealthed: 30% visible
    }
  } else {
    return 0; // Not stealthed: 100% visible
  }
}
```

**Opacity Levels**:
- Fully stealthed (enemy view): 30% opacity
- Revealed (enemy view): 70% opacity
- Ally/self view: 70% opacity
- Not stealthed: 100% opacity

### Pending Stealth Attacks

Stealthed units can approach targets before revealing themselves.

**Code Reference**: `SimpleCombat.js:693-872`

**Note**: The `handlePendingStealthAttack()` method handles both stealthed and non-stealthed attack intent, making it a general-purpose attack intent handler. The method name is a legacy from when it was stealth-specific. There is also a separate `handlePendingStealthAggro()` method (lines 1212-1244) that handles pending stealth aggro during aggro checks.

```javascript
handlePendingStealthAttack(entity) {
  const state = entity.combatState;
  if (!entity.stealthed || entity.revealed || !state || !state.pendingTarget) {
    return false;
  }
  
  const pendingTarget = global.Player.list[state.pendingTarget];
  
  // Check if target detected the stealthed attacker
  if (this.checkStealthDetection(entity, pendingTarget)) {
    // Detected! Reveal and start combat
    this.removeStealth(entity);
    this.initCombatState(entity, pendingTarget.id);
    return false; // Continue to normal combat
  }
  
  // Still stealthed - move towards target to attack
  // Combat will start on first attack
}
```

**Pending Stealth Attack Flow**:
1. Stealthed unit sets `combatState.pendingTarget`
2. Unit approaches target while stealthed
3. If detected OR in attack range → Start combat
4. If timeout (5s) → Cancel pending attack

### Skills Framework Opportunities

The current stealth implementation demonstrates how skills could work, but a comprehensive skills system would need:

#### 1. Skill Definitions

```javascript
// Proposed structure
const SKILL_DEFINITIONS = {
  stealth: {
    name: 'Stealth',
    cooldown: 0, // Passive when conditions met
    duration: null, // Until broken
    requirements: {
      conditions: ['night', 'woods', 'underground'],
      class: ['Rogue', 'Hunter'], // Or learnable by all
    },
    effects: {
      detectionRange: 128,
      movementPenalty: 0.5,
      opacity: 0.3
    }
  },
  charge: {
    name: 'Charge',
    cooldown: 10000, // 10 seconds
    duration: 500, // 0.5 seconds
    requirements: {
      class: ['Knight', 'Paladin'],
      weapon: 'lance'
    },
    effects: {
      speedBoost: 2.0,
      damageMultiplier: 1.5
    }
  }
  // ... more skills
};
```

#### 2. Skill Learning/Unlocking

- Skills could be learned through:
  - Level progression
  - Quest completion
  - Item acquisition
  - Class selection
  - Training with NPCs

#### 3. Skill Usage in Combat

Skills would need:
- Trigger conditions (on attack, on defense, on low HP, etc.)
- Activation methods (keybind, auto-trigger, etc.)
- Effect application (damage, movement, status effects)
- Cooldown management
- Resource costs (if applicable)

#### 4. NPC Skill Integration

NPCs could have different skill sets:
- Different skills per unit type
- Skill usage based on AI state
- Skill combinations for advanced tactics

#### 5. Potential Skills

Based on the game's combat system, potential skills could include:

- **Stealth**: Already implemented (needs to be learnable)
- **Charge**: Rush attack with increased damage
- **Shield Bash**: Stun/interrupt ability
- **Poison**: Damage over time effect
- **Berserker Rage**: Increased damage when low HP
- **Retreat**: Enhanced escape ability
- **Precise Shot**: Increased ranged damage/crit chance
- **Counter Attack**: Automatic counter on block/parry
- **Regeneration**: HP regeneration over time
- **Aura Effects**: Area buffs/debuffs

### Implementation Recommendations

1. **Create SkillManager System**: Centralized skill management
2. **Skill Registry**: Register all available skills
3. **Skill Slots**: Allow players to equip/activate skills
4. **Skill UI**: Interface for viewing/using skills
5. **Skill Events**: Integration with event system for skill usage tracking
6. **NPC Skill AI**: AI system for NPC skill usage decisions

---

## System Dependencies

The combat system relies on several other systems:

1. **Pathfinding System**: Movement during combat (via `entity.moveTo()`)
2. **Pathfinding System** (`server/js/core/PathfindingManager.js`): Movement during combat
3. **Event System** (`server/js/core/EventManager.js`): Combat event tracking
4. **Social System** (`server/js/core/SocialSystem.js`): Death witness recording
5. **Item Factory** (`server/js/entities/ItemFactory.js`): Death item drops
6. **House System** (`server/js/Houses.js`): NPC respawn management
7. **Alliance System** (`lambic.js:1656-1743`): Friendly fire prevention

---

## Constants and Configuration

### Combat Constants

**File**: `server/js/core/SimpleCombat.js:7-18`

```javascript
MELEE_RANGE = 96;           // 1.5 tiles - actual attack range
MELEE_ATTACK_RANGE = 96;   // Max range to start attacking
RANGED_ATTACK_RANGE = 640; // 10 tiles - greater than default NPC aggro range of 512 (8 tiles) so players can attack from outside aggro
RANGED_KITE_DISTANCE = 96; // Too close - back away
BOAR_ATTACK_RANGE = 64;    // 1 tile
DETECTION_RANGE = 128;     // 2 tiles for stealth
MELEE_COOLDOWN = 1000;     // 1 second
RANGED_COOLDOWN = 1500;    // 1.5 seconds
KITE_CHECK_INTERVAL = 2000; // 2 seconds
PENDING_COMBAT_TIMEOUT = 5000; // 5 seconds
AUTO_ATTACK_RESUME_TIMEOUT = 3000; // 3 seconds - auto-resume after navigation
```

### Flee Constants

**File**: `server/js/core/SimpleFlee.js`

```javascript
FLEE_DISTANCE = 512;       // 8 tiles
FLEE_COOLDOWN = 30;        // 30 frames = 0.5 seconds
```

### Escape Constants

**File**: `server/js/core/SimpleCombat.js:1134`

```javascript
ESCAPE_RANGE = 768;        // 12 tiles
```

### Aggro Constants

**File**: `server/js/core/SimpleCombat.js:789-790`

```javascript
DEFAULT_AGGRO_RANGE = 512; // 8 tiles
DEFENSE_RANGE = 1000;      // 10 tiles (military units)
```

---

## Known Issues and Gaps

### 1. Player Auto-Targeting Issue

**Status**: RESOLVED

**Previous Issue**: Players automatically received combat targets and pathfound toward enemies when enemies came into range, even though the enemy hadn't engaged them. This created a timing gap where players would pathfind before NPCs actually initiated combat.

**Solution Implemented**: 
1. Added explicit check in `checkAggro()` to skip players (defensive safeguard at `SimpleCombat.js:1084-1085`)
2. Updated player combat validation (`SimpleCombat.js:562-588`) to allow player-initiated attacks even if target hasn't aggro'd yet
3. Players can now initiate attacks via attack intent system, which handles pathfinding and automatic conversion to combat when in range

**Result**: Players can initiate attacks via attack intent (right-click or attack commands), which pathfinds toward target and automatically converts to full combat when in range. Players also receive combat targets through counter-aggro when NPCs attack them.

### 2. No HP-Based Escape

**Issue**: Combatants don't automatically attempt escape when HP drops low.

**Impact**: Units fight to the death even when escape would be beneficial.

**Future Enhancement**: Implement HP threshold-based escape system.

### 3. Skills System Not Implemented

**Issue**: Stealth exists but is hardcoded, not a learnable skill.

**Impact**: Cannot expand combat with new abilities easily.

**Future Enhancement**: Create comprehensive skills framework.

### 4. Combat State Management Edge Cases

**Status**: RESOLVED

**Previous Issue**: Combat state was scattered across multiple properties (`entity.combat.target`, `_pendingCombatTarget`, `_pendingCombatStartTime`, `_combatStartTime`, `_lastCombatAttack`, `_pathfindingFailures`), creating edge cases where state could be inconsistent. Additionally, the game loop only called `update()` when `action === 'combat'`, which could cause entities to get stuck if `combatState` existed but `action` wasn't set.

**Solution Implemented**: 
1. Unified combat state object (`entity.combatState`) that consolidates all combat-related state into a single structured object. Added helper methods `ensureCombatState()` and `clearCombatState()` for consistent state management.
2. Updated game loop to check `combatState` existence instead of `action === 'combat'`, ensuring combat always updates when state exists.
3. Added defensive state cleanup in `update()` to ensure `action` is set when `combatState` exists.
4. Removed redundant target validations from `handleAttack()` and `handleChase()`, establishing a single validation point in `update()`.

**Result**: Eliminated state inconsistencies, simplified validation (single object check, single validation point), improved maintainability, prevented edge cases through unified state management, and ensured combat always updates when state exists.

### 5. Position Swapping Complexity

**Status**: RESOLVED

**Previous Issue**: Complex logic to prevent melee units occupying same tile with multiple state variables and timeout tracking.

**Solution Implemented**: Simplified to priority-based system where attacker or higher HP unit gets priority. Lower priority unit waits while higher priority unit repositions. Removed complex state tracking (`_isRepositioning`, `_repositionAttempts`, `_repositionStartTime`, `_repositionLastPos`).

**Result**: Reduced code complexity from ~100 lines to ~30 lines, eliminated timeout/attempt tracking, improved maintainability and performance.

### 6. No Damage Types

**Issue**: All damage is treated the same (no physical/magic/elemental types).

**Impact**: Limited combat variety.

**Future Enhancement**: Add damage type system with resistances.

---

## Future Enhancement Opportunities

1. **HP-Based Escape System**: Automatic escape at low HP thresholds
2. **Skills Framework**: Comprehensive learnable skills system
3. **Damage Types**: Physical, magic, elemental damage with resistances
4. **Status Effects**: Poison, stun, slow, etc.
5. **Combat Formations**: Group combat positioning
6. **Combat AI Improvements**: Smarter NPC combat decisions
7. **Combat Logging**: Detailed combat statistics and replays
8. **Combat Balance System**: Configurable damage/defense scaling

---

## Conclusion

This documentation provides a comprehensive overview of the combat system architecture. The system is well-structured with centralized combat logic in `SimpleCombat.js`, but there are opportunities for enhancement, particularly around HP-based escape and a skills framework. This document should serve as a reference for future modularization and refactoring efforts.
