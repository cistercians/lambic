# Combat System Documentation

This document provides an in-depth analysis of the combat system architecture in the game, covering all major components and their interactions. This documentation serves as a reference for future modularization and refactoring efforts.

## Table of Contents

1. [Aggro/Engagements](#1-aggroengagements)
2. [Combat Pathing/Movement](#2-combat-pathingmovement)
3. [Default Combat Behaviors](#3-default-combat-behaviors)
4. [Escape Behaviors](#4-escape-behaviors)
5. [Death Handling](#5-death-handling)
6. [Future Addition of Skills](#6-future-addition-of-skills)

---

## 1. AGGRO/ENGAGEMENTS

### Overview

The aggro system determines when and how combat is initiated between entities. It handles detection, target selection, alliance checks, stealth mechanics, and counter-aggro responses.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `checkAggro()` (lines 768-937)
  - `startCombat()` (lines 972-1058)
  - `handlePendingStealthAggro()` (lines 940-969)

### Aggro Detection Flow

```
Entity Update Loop
    ↓
checkAggro(entity)
    ↓
[Skip if: returning, already in combat, non-combat class]
    ↓
[Check pending stealth aggro first]
    ↓
[Priority: Defend fleeing allied serfs (military units)]
    ↓
[Spatial System: Find nearby targets within aggroRange]
    ↓
For each potential target:
    ├─ Validate target (ghost, spectator, same z-level)
    ├─ Check alliance (skip if ally)
    ├─ Check stealth detection (128px range)
    ├─ Check peaceful unit rules
    ├─ Check innaWoods compatibility
    └─ startCombat(entity, target)
```

### Key Components

#### Aggro Range Detection

- **Default Range**: 512px (8 tiles)
- **Configurable**: Per-entity via `entity.aggroRange`
- **Defense Range**: 1000px (10 tiles) for military units defending fleeing serfs
- **Detection Range**: 128px (2 tiles) for stealth detection

**Code Reference**: `SimpleCombat.js:789`

```javascript
const aggroRange = entity.aggroRange || 512;
const defenseRange = 1000; // Military units respond to fleeing serfs
```

#### Spatial System Optimization

The system uses `global.spatialSystem.findAggroTargets()` for efficient target finding instead of iterating all entities.

**Code Reference**: `SimpleCombat.js:822-876`

```javascript
if (global.spatialSystem && global.spatialSystem.findAggroTargets) {
  const nearbyTargets = global.spatialSystem.findAggroTargets(entity, aggroRange);
  // Process targets...
}
```

#### Alliance Checking

Allies never aggro each other. The check happens early in the aggro process.

**Code Reference**: `SimpleCombat.js:846-848, 904-907`

```javascript
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

**Code Reference**: `SimpleCombat.js:249-255, 838-843`

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

**Code Reference**: `SimpleCombat.js:1012-1023`

```javascript
const peaceful = ['Serf', 'SerfM', 'SerfF', 'Deer', 'Sheep'];
if (peaceful.includes(entity.class)) {
  entity.action = 'flee';
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

**Code Reference**: `SimpleCombat.js:1038-1057`

```javascript
// Counter-aggro
if (target.type === 'npc' && target.military && target.action !== 'combat') {
  this.startCombat(target, entity);
} else if (target.type === 'player') {
  this.initCombatState(target, entity.id);
  target.autoAttackPaused = false;
  // Send attack notification to player
}
```

#### Military Unit Defensive Aggro

Military units have extended range (1000px) to defend fleeing allied serfs.

**Code Reference**: `SimpleCombat.js:793-819`

```javascript
if (entity.military && entity.house) {
  const serfClasses = ['Serf', 'SerfM', 'SerfF'];
  for (const id in global.Player.list) {
    const serf = global.Player.list[id];
    if (serfClasses.includes(serf.class) && 
        serf.action === 'flee' && 
        serf.house === entity.house &&
        serf.combat && serf.combat.target) {
      const attacker = global.Player.list[serf.combat.target];
      if (attacker && distance <= defenseRange) {
        this.startCombat(entity, attacker);
        return;
      }
    }
  }
}
```

#### Pending Stealth Attack System

Stealthed units can approach targets before revealing themselves. Combat doesn't start until:
1. The stealthed unit attacks (first strike)
2. The target detects the stealthed unit (within 128px)

**Code Reference**: `SimpleCombat.js:983-1010`

```javascript
if (entity.stealthed && !entity.revealed) {
  if (this.checkStealthDetection(entity, target)) {
    // Detected - reveal and start combat
    this.removeStealth(entity);
  } else {
    // Still stealthed - set pending combat
    entity._pendingCombatTarget = target.id;
    entity._pendingCombatStartTime = Date.now();
    return; // Don't start combat yet
  }
}
```

**Pending Stealth Attack Flow**:
```
Stealthed Unit Aggro
    ↓
[Target not detected yet]
    ↓
Set _pendingCombatTarget
    ↓
handlePendingStealthAttack() moves unit closer
    ↓
[Check detection each frame]
    ↓
[If detected OR in attack range] → Start combat
[If timeout (5s)] → Cancel pending attack
```

#### InnaWoods Compatibility

NPCs can only aggro players if both are in the same "woods" state OR the target is in woods.

**Code Reference**: `SimpleCombat.js:867-871, 926-930`

```javascript
if (entity.type === 'npc' && target.type === 'player') {
  if (!(entity.innaWoods === target.innaWoods || (!entity.innaWoods && target.innaWoods))) {
    continue; // Can't aggro due to woods state
  }
}
```

### Combat State Initialization

When combat starts, the system initializes combat state:

**Code Reference**: `SimpleCombat.js:95-112`

```javascript
initCombatState(entity, targetId) {
  if (!entity.combat) entity.combat = {};
  entity.action = 'combat';
  entity.combat.target = targetId;
  entity._lastCombatAttack = 0;
  entity._pathfindingFailures = 0;
  entity._pendingCombatTarget = null;
  entity._pendingCombatStartTime = null;
  entity._isRepositioning = false;
  // ... reposition tracking state
  if (entity.type === 'player') {
    entity.autoAttackPaused = false;
  }
}
```

### Non-Combat Classes

These classes never participate in combat:
- `Falcon`
- `FishingShip`
- Ship types: `fishingship`, `cargoship`

**Code Reference**: `SimpleCombat.js:770-775`

---

## 2. COMBAT PATHING/MOVEMENT

### Overview

Combat pathing determines how entities move during combat, handling melee positioning, ranged kiting, pathfinding failures, and leash range enforcement.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `handleChase()` (lines 697-761)
  - `ensureMeleePositioning()` (lines 349-456)
  - `moveAwayFromTarget()` (lines 283-346)
  - `findAdjacentTile()` (lines 56-84)

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

Melee units must be on adjacent tiles, never the same tile as their target.

**Code Reference**: `SimpleCombat.js:349-456`

**Key Logic**:
1. Check if entity and target are on same tile
2. Prevent position swapping: Only one unit repositions at a time
3. Find best adjacent walkable tile
4. Pathfind to that tile
5. Timeout after 2 seconds or 10 attempts → allow attack anyway

```javascript
ensureMeleePositioning(entity, target) {
  if (entity.ranged) return false; // Only for melee
  
  const entityLoc = global.getLoc(entity.x, entity.y);
  const targetLoc = global.getLoc(target.x, target.y);
  
  // Check if on same tile
  if (entityLoc[0] === targetLoc[0] && entityLoc[1] === targetLoc[1]) {
    // PREVENT POSITION SWAPPING: Only one unit should reposition
    if (target._isRepositioning && target._repositionStartTime) {
      return false; // Target is repositioning - wait
    }
    // ... reposition logic
  }
}
```

**Repositioning State Tracking**:
- `_isRepositioning`: Flag indicating reposition in progress
- `_repositionAttempts`: Counter for attempts
- `_repositionStartTime`: Timestamp when reposition started
- `_repositionLastPos`: Last position to detect movement

#### Ranged Kiting

Ranged units maintain distance from targets. If too close (<96px), they back away.

**Code Reference**: `SimpleCombat.js:515-517, 623-633`

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

**Code Reference**: `SimpleCombat.js:283-346`

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

**Code Reference**: `SimpleCombat.js:56-84`

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

**Code Reference**: `SimpleCombat.js:737-759`

```javascript
entity._pathfindTimeout = setTimeout(() => {
  if (entity && entity.combat && entity.combat.target === target.id) {
    // Check if still at same position and have no path
    if (entity.x === oldX && entity.y === oldY && !entity.path) {
      entity._pathfindingFailures++;
      
      if (entity._pathfindingFailures >= 3) {
        this.endCombat(entity, target);
        entity._pathfindingFailures = 0;
      }
    } else {
      entity._pathfindingFailures = 0; // Reset on success
    }
  }
}, 1000); // Check after 1 second
```

#### Running Speed Activation

NPCs run (faster speed) when chasing in combat.

**Code Reference**: `SimpleCombat.js:711-718`

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

**Code Reference**: `SimpleCombat.js:506-512, 611-620`

```javascript
checkLeashRange(entity) {
  if (!entity.home || !entity.home.loc) return false;
  
  const homeX = entity.home.loc[0] * 64;
  const homeY = entity.home.loc[1] * 64;
  const homeDist = Math.sqrt(Math.pow(entity.x - homeX, 2) + Math.pow(entity.y - homeY, 2));
  const leashRange = entity.wanderRange || 2048;
  
  return homeDist > leashRange;
}
```

If leash range exceeded:
1. End combat
2. Set action to 'returning'
3. Call `entity.return()` if available

### Attack Range Constants

**Code Reference**: `SimpleCombat.js:7-12`

```javascript
this.MELEE_RANGE = 96;           // 1.5 tiles - actual attack range for melee
this.MELEE_ATTACK_RANGE = 96;    // Max range to start attacking
this.RANGED_ATTACK_RANGE = 256; // 4 tiles
this.RANGED_KITE_DISTANCE = 96; // Too close - back away
this.BOAR_ATTACK_RANGE = 64;    // 1 tile - boars have shorter range
this.DETECTION_RANGE = 128;     // 2 tiles for stealth detection
```

**Range Methods**:
- `getAttackRange(entity)`: Returns attack range based on entity type
- `getMeleeRange(entity)`: Returns melee range (for positioning checks)

---

## 3. DEFAULT COMBAT BEHAVIORS

### Overview

Default combat behaviors handle auto-attacking, damage calculation, defense application, and attack animations for both melee and ranged combatants.

### Core Files

- **Primary**: `server/js/core/SimpleCombat.js`
  - `handleAttack()` (lines 636-694)
  - `calculateDamage()` (lines 132-173)
  - `applyDamage()` (lines 176-211)
  - `updateFacingToTarget()` (lines 119-129)

### Combat Update Flow

```
Combat Update Loop (update())
    ↓
[Validate combat state and target]
    ↓
[Check distance and ranges]
    ↓
[Handle ranged kiting if needed]
    ↓
[Handle melee positioning if needed]
    ↓
[In attack range?]
    ├─ Yes → handleAttack()
    └─ No → handleChase()
```

### Key Components

#### Auto-Attack System

Entities automatically attack when in range, respecting cooldown timers.

**Code Reference**: `SimpleCombat.js:636-694`

**Cooldown Constants**:
- **Melee**: 1000ms (1 second)
- **Ranged**: 1500ms (1.5 seconds)

```javascript
handleAttack(entity, target) {
  const now = Date.now();
  const cooldownMs = entity.ranged ? this.RANGED_COOLDOWN : this.MELEE_COOLDOWN;
  const timeSince = now - entity._lastCombatAttack;
  
  if (timeSince < cooldownMs) {
    return; // Still on cooldown
  }
  
  // Perform attack...
  entity._lastCombatAttack = now;
}
```

**Auto-Attack Pause**: Players can pause auto-attack with navigation commands (`autoAttackPaused` flag).

#### Damage Calculation

Damage is calculated as: `weaponDamage - armorDefense` with a minimum of 1 damage.

**Code Reference**: `SimpleCombat.js:132-173`

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

**Code Reference**: `SimpleCombat.js:176-211`

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

**Code Reference**: `SimpleCombat.js:689-693`

```javascript
// Melee attack - use standardized damage calculation
this.applyDamage(entity, target, 'melee');
entity._lastCombatAttack = now;
```

#### Ranged Attacks

Ranged attacks use the `shootArrow()` method which creates an Arrow entity.

**Code Reference**: `SimpleCombat.js:679-688`

```javascript
if (entity.ranged && entity.shootArrow) {
  // Ranged units shoot arrows
  entity.shootArrow(target.id);
  entity._lastCombatAttack = now;
  
  // Check if target died (arrow might have hit instantly)
  if (!this.isTargetValid(target, entity)) {
    this.endCombat(entity, target);
    return;
  }
}
```

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

**Code Reference**: `SimpleCombat.js:119-129`

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

**Code Reference**: `SimpleCombat.js:198-203`

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

**Code Reference**: `SimpleCombat.js:660-663, 671-673`

```javascript
// STEALTH COMBAT: Handle first stealth attack
if (entity.stealthed && (!entity.combat.target || entity._pendingCombatTarget)) {
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

**Code Reference**: `SimpleCombat.js:1012-1023`

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
  if (!entity.combat || !entity.combat.target) {
    this.restoreSpeed(entity);
    entity.action = null;
    return;
  }
  
  const target = global.Player.list[entity.combat.target];
  
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

**Code Reference**: `SimpleCombat.js:1164-1179`

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

**Code Reference**: `SimpleCombat.js:1151-1161`

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
  - `server/js/core/SimpleCombat.js` - `handleTargetDeath()` (lines 214-242)
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

**Code Reference**: `SimpleCombat.js:1186-1245`

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

Different death messages are sent based on who died and who killed them.

**Code Reference**: `SimpleCombat.js:214-242, EventManager.js:470-485`

**Player Death** (to victim):
```javascript
socket.write(JSON.stringify({ 
  msg: 'addToChat', 
  message: `<span style="color:red;">💀 You were killed by ${killerName}!</span>` 
}));
```

**NPC Death** (to killer):
```javascript
socket.write(JSON.stringify({ 
  msg: 'addToChat', 
  message: `<span style="color:green;">⚔️ You killed ${victimName}!</span>` 
}));
```

**Area Broadcast**:
```javascript
// From EventManager.death()
message: killer 
  ? `<span style="color:#ff0000;">💀 ${victim.name || victim.class} was slain by ${killer.name || killer.class}!</span>`
  : `<span style="color:#ff0000;">💀 ${victim.name || victim.class} has died!</span>`
```

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

**Code Reference**: `SimpleCombat.js:546-608, 940-969`

```javascript
handlePendingStealthAttack(entity) {
  if (!entity.stealthed || entity.revealed || !entity._pendingCombatTarget) {
    return false;
  }
  
  const pendingTarget = global.Player.list[entity._pendingCombatTarget];
  
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
1. Stealthed unit sets `_pendingCombatTarget`
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

1. **Spatial System** (`server/js/core/SpatialIntegration.js`): Efficient aggro target finding
2. **Pathfinding System** (`server/js/core/PathfindingManager.js`): Movement during combat
3. **Event System** (`server/js/core/EventManager.js`): Combat event tracking
4. **Social System** (`server/js/core/SocialSystem.js`): Death witness recording
5. **Item Factory** (`server/js/entities/ItemFactory.js`): Death item drops
6. **House System** (`server/js/Houses.js`): NPC respawn management
7. **Alliance System** (`lambic.js:1656-1743`): Friendly fire prevention

---

## Constants and Configuration

### Combat Constants

**File**: `server/js/core/SimpleCombat.js:7-16`

```javascript
MELEE_RANGE = 96;           // 1.5 tiles - actual attack range
MELEE_ATTACK_RANGE = 96;   // Max range to start attacking
RANGED_ATTACK_RANGE = 256; // 4 tiles
RANGED_KITE_DISTANCE = 96; // Too close - back away
BOAR_ATTACK_RANGE = 64;    // 1 tile
DETECTION_RANGE = 128;     // 2 tiles for stealth
MELEE_COOLDOWN = 1000;     // 1 second
RANGED_COOLDOWN = 1500;    // 1.5 seconds
KITE_CHECK_INTERVAL = 2000; // 2 seconds
PENDING_COMBAT_TIMEOUT = 5000; // 5 seconds
```

### Flee Constants

**File**: `server/js/core/SimpleFlee.js`

```javascript
FLEE_DISTANCE = 512;       // 8 tiles
FLEE_COOLDOWN = 30;        // 30 frames = 0.5 seconds
```

### Escape Constants

**File**: `server/js/core/SimpleCombat.js:1167`

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

### 1. No HP-Based Escape

**Issue**: Combatants don't automatically attempt escape when HP drops low.

**Impact**: Units fight to the death even when escape would be beneficial.

**Future Enhancement**: Implement HP threshold-based escape system.

### 2. Skills System Not Implemented

**Issue**: Stealth exists but is hardcoded, not a learnable skill.

**Impact**: Cannot expand combat with new abilities easily.

**Future Enhancement**: Create comprehensive skills framework.

### 3. Combat State Management Edge Cases

**Issue**: Some edge cases with pending stealth attacks and state transitions.

**Impact**: Occasional combat state inconsistencies.

**Future Enhancement**: Improve state machine for combat states.

### 4. Position Swapping Complexity

**Issue**: Complex logic to prevent melee units occupying same tile.

**Impact**: Code complexity and potential edge cases.

**Future Enhancement**: Consider alternative positioning systems.

### 5. No Damage Types

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
