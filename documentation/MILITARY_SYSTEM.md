# Military System Breakdown

## Overview

The military system in Lambic is a complex multi-layered system that manages unit creation, behavior states, combat mechanics, patrol routes, scouting parties, and faction-level military coordination. This document provides an in-depth analysis of all components.

## 1. Unit Types and Creation

### 1.1 Unit Classes

All military units are defined in `server/js/Entity.js`. Units inherit from `Character` and are organized as follows:

#### 1.1.1 Generic/Universal Military Units

**Infantry Units:**

- **Footsoldier** - Basic melee infantry
  - Damage: 10
  - Speed: 3.5 base / 6 run
  - Sprite Size: 1.5x
  - Military: true

- **Skirmisher** - Light melee infantry
  - Damage: 15
  - Speed: 3.5 base / 6 run
  - Sprite Size: 1.5x
  - Military: true

- **SwissGuard** - Elite infantry guard
  - Damage: 15
  - Speed: 3 base / 5 run
  - Sprite Size: 2x
  - Military: true

- **Hospitaller** - Support infantry
  - Damage: 20
  - Speed: 3 base / 5 run
  - Sprite Size: 1.5x
  - Military: true

**Cavalry Units:**

- **Cavalier** - Basic mounted unit
  - Damage: 20
  - Speed: 6.5 base / 8 run
  - Sprite Size: 1.5x
  - Mounted: true
  - Military: true

**Elite Command Units (Rank ♞):**

- **General** - Mounted commander
  - Damage: 25
  - Speed: 6.5 base / 8 run
  - Sprite Size: 2x
  - Rank: '♞ '
  - Mounted: true

- **Warden** - Mounted ranged commander
  - Damage: 20
  - Speed: 7 base / 9 run
  - Sprite Size: 2x
  - Rank: '♞ '
  - Mounted: true
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

- **ImperialKnight** - Heavy cavalry elite
  - Damage: 25
  - Speed: 6 base / 8 run
  - Sprite Size: 3x
  - Rank: '♞ '
  - Mounted: true

#### 1.1.2 Faction-Specific Units

**Brotherhood (Underground Faction):**

- **Brother** - Basic unit
  - Damage: 5
  - Speed: 3.5 base
  - Sprite Size: 1.5x

- **Apparition** - Special unit
  - Damage: 1
  - Sprite Size: 1.5x

- **Apollyon** - Boss unit
  - Rank: '♚ '
  - House: 'City of Destruction'

**Goths:**

- **Goth** - Basic infantry
  - Damage: 10
  - Sprite Size: 1.5x
  - Military: true

- **Acolyte** - Support unit
  - Damage: 5
  - Speed: 3.5 base
  - Sprite Size: 1.5x
  - TorchBearer: true

- **Cataphract** - Elite mounted unit
  - Damage: 20
  - Speed: 6 base
  - Sprite Size: 3x
  - Rank: '♞ '
  - Mounted: true
  - Military: true

- **Alaric** - Leader unit
  - Rank: '♜ '

**Norsemen:**

- **NorseSword** - Sword infantry
  - Damage: 15
  - Sprite Size: 1.5x
  - Military: true

- **NorseSpear** - Spear infantry
  - Damage: 15
  - Sprite Size: 1.5x
  - Military: true

- **Huskarl** - Elite infantry
  - Damage: 20
  - Speed: 3 base
  - Sprite Size: 1.5x
  - Rank: '♞ '
  - Military: true

- **Drakkar** - Naval unit
  - Ranged: true
  - Damage: 15
  - TorchBearer: true
  - Arrows: 20-40

**Franks:**

- **FrankSword** - Sword infantry
  - Damage: 10
  - Sprite Size: 1x (64px)
  - Military: true

- **FrankSpear** - Spear infantry
  - Damage: 10
  - Sprite Size: 2x
  - Military: true

- **FrankBow** - Ranged infantry
  - Damage: 5
  - Sprite Size: 1.5x
  - Ranged: true
  - Military: true
  - Arrows: 20-40

- **Carolingian** - Elite mounted unit
  - Damage: 20
  - Speed: 6 base
  - Sprite Size: 3x
  - Rank: '♞ '
  - Mounted: true
  - Military: true

- **Charlemagne** - Leader unit
  - Rank: '♚ '
  - Speed: 6 base
  - Sprite Size: 3x
  - Mounted: true
  - Damage: 25

**Celts:**

- **CeltAxe** - Axe infantry
  - Damage: 10
  - Sprite Size: 1.5x
  - Military: true

- **CeltSpear** - Spear infantry
  - Damage: 10
  - Sprite Size: 2x
  - Military: true

- **Headhunter** - Elite mounted unit
  - Damage: 20
  - Speed: 7 base
  - Sprite Size: 2x
  - Rank: '♞ '
  - Mounted: true
  - TorchBearer: true
  - Military: true

- **Morrigan** - Leader unit
  - Rank: '♜ '
  - Speed: 6 base
  - Sprite Size: 2x
  - Mounted: true
  - TorchBearer: true
  - Damage: 25
  - Sex: 'f'

- **Gwenllian** - Queen unit
  - Rank: '♛ '
  - TorchBearer: true
  - Sex: 'f'

**Teutons:**

- **TeutonPike** - Pike infantry
  - Damage: 15
  - Sprite Size: 2x
  - Military: true

- **TeutonBow** - Ranged infantry
  - Damage: 10
  - Sprite Size: 1.5x
  - Ranged: true
  - Military: true
  - Arrows: 20-40

- **TeutonicKnight** - Elite mounted unit
  - Damage: 25
  - Speed: 6 base / 8 run
  - Sprite Size: 3x
  - Rank: '♞ '
  - Mounted: true
  - Military: true

- **Hochmeister** - Leader unit
  - Rank: '♜ '
  - Speed: 3 base / 5 run
  - Sprite Size: 1.5x
  - TorchBearer: true
  - Damage: 25

**Outlaws:**

- **Trapper** - Stealth unit
  - Damage: 10
  - Speed: 3 base / 5 run
  - Sprite Size: 1.5x
  - Stealthed: true (auto-stealth in woods/night/underground)

- **Outlaw** - Ranged unit
  - Damage: 5
  - Speed: 3 base / 5 run
  - Sprite Size: 1.5x
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

- **Poacher** - Elite mounted ranged
  - Damage: 10
  - Speed: 7 base / 9 run
  - Sprite Size: 2x
  - Rank: '♞ '
  - Mounted: true
  - Ranged: true
  - TorchBearer: true

**Mercenaries:**

- **Cutthroat** - Stealth melee
  - Damage: 10
  - Speed: 3 base / 5 run
  - Sprite Size: 1.5x
  - Stealthed: true (auto-stealth in woods/night/underground)

- **Strongman** - Heavy infantry
  - Damage: 15
  - Speed: 3.5 base
  - Sprite Size: 2x
  - TorchBearer: true

- **Marauder** - Elite mounted
  - Damage: 20
  - Speed: 6 base
  - Sprite Size: 3x
  - Rank: '♞ '
  - Mounted: true
  - TorchBearer: true

- **Condottiere** - Elite mounted ranged commander
  - Damage: 25
  - Speed: 6.5 base
  - Sprite Size: 2x
  - Rank: '♜ '
  - Mounted: true
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

#### 1.1.3 Naval Units

**Military Ships:**

- **ScoutShip** - Light naval unit
  - Damage: 10
  - Ranged: true
  - Military: true
  - TorchBearer: true
  - Arrows: 20-40

- **Longship** - Norse naval unit
  - Damage: 10
  - Ranged: true
  - Military: true
  - TorchBearer: true
  - Arrows: 20-40

- **Galley** - Standard warship
  - Damage: 15
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

- **Caravel** - Exploration ship
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

- **Galleon** - Heavy warship
  - Damage: 150
  - Rank: '♜ '
  - Ranged: true
  - TorchBearer: true
  - Arrows: 20-40

#### 1.1.4 Siege Units

- **Mangonel** - Siege weapon (Franks)
  - Damage: 50
  - Speed: 2 base
  - Sprite Size: 2x
  - Ranged: true
  - Arrows: 20-40

- **Trebuchet** - Heavy siege weapon
  - Damage: 100
  - Sprite Size: 10x
  - Ranged: true
  - Arrows: 20-40

- **BombardCannon** - Artillery
  - Damage: 250
  - Speed: 2 base
  - Ranged: true
  - Arrows: 20-40

- **Malvoisin** - Frank siege tower
  - Damage: 150
  - Sprite Size: 12x
  - Rank: '♜ '
  - Ranged: true
  - Arrows: 20-40

#### 1.1.5 Unit Property Reference

All units have these core properties:

- `military: true/false` - Marks unit as military (affects aggro behavior)
- `damage` - Base damage value (used in combat calculations)
- `baseSpd` / `runSpd` - Movement speeds (walk/run)
- `spriteSize` - Visual size multiplier (tileSize = 64px)
- `mounted: true/false` - Mounted units (faster movement)
- `ranged: true/false` - Ranged units (use arrows, different attack range)
- `rank` - Rank symbol (♞ = elite, ♝ = special, ♜ = commander, ♚ = king, ♛ = queen)
- `torchBearer: true/false` - Can provide light
- `stealthed: true/false` - Stealth capability
- `home` - Spawn/home location `{z: number, loc: [col, row]}`
- `house` - Faction ID
- `inventory.arrows` - Arrow count for ranged units (typically 20-40)

### 1.2 Unit Spawning

**Faction Spawn Function (`House.spawn`):**

Each faction has a custom `spawn` function that creates units based on class parameter:

```javascript
// Example from Brotherhood
self.spawn = function(cl, spawn) {
  var c = getCenter(spawn.loc[0], spawn.loc[1]);
  if(cl == 'Brother') {
    Brother({ x: c[0], y: c[1], z: spawn.z, house: self.id, home: {...} })
  } else if(cl == 'Oathkeeper') {
    Oathkeeper({ x: c[0], y: c[1], z: spawn.z, house: self.id, home: {...} })
  }
}
```

**Respawn System (`House.respawn`):**

Units respawn via `House.respawn(class, spawn)` which schedules delayed spawning:

```javascript
self.respawn = function(cl, spawn) {
  if(self.spawn) {
    var rand = Math.floor(Math.random() * spawnRate);
    setTimeout(function() {
      self.spawn(cl, spawn);
    }, rand)
  }
}
```

**Initial Spawning:**

Factions spawn initial units in their `init()` function. For example, Brotherhood spawns 3 Brothers at initialization, while Goths spawn 4 units (mix of Goths and Acolytes).

### 1.3 Unit Properties

All military units inherit from `Character` and have:

- `military: true` - Marks unit as military
- `damage` - Base damage value
- `baseSpd` / `runSpd` - Movement speeds
- `home` - Spawn/home location `{z: number, loc: [col, row]}`
- `house` - Faction ID
- `rank` - Optional rank symbol (♞ for elite, ♝ for special)
- `mounted` - Boolean for mounted units
- `ranged` - Boolean for ranged units

## 2. Behavior Modes

### 2.1 Action States

Units have an `action` property that determines behavior:

**Primary Actions:**

- `null` / `undefined` - Idle/default behavior
- `'combat'` - Engaged in combat
- `'patrol'` - Patrolling buildings
- `'flee'` - Fleeing from threat
- `'retreat'` - Retreating to base
- `'returning'` - Returning to home location
- `'task'` - Performing assigned task

**Mode Property:**

- `mode: 'patrol'` - Unit is in patrol mode (separate from action)

### 2.2 Patrol System

**Patrol Building List:**

Each faction maintains `patrolBuildings` array updated via `House.updatePatrolList()`:

```javascript
self.updatePatrolList = function() {
  var approvedTypes = ['forge', 'garrison', 'stronghold', 'guardtower', 'gate', 'stable', 'barracks'];
  var patrolBuildings = [];
  
  for(var bid in Building.list) {
    var b = Building.list[bid];
    if(b.house === self.id && b.built && b.plot && b.plot.length > 0) {
      if(approvedTypes.includes(b.type)) {
        patrolBuildings.push(bid);
      }
    }
  }
  
  self.patrolBuildings = patrolBuildings;
}
```

**Patrol Behavior:**

Units in patrol mode cycle through patrol buildings. The system tracks:

- `self.military.patrol` - Array of building IDs to patrol
- Units pathfind between buildings in the patrol list
- When combat ends, units resume patrol if `entity.mode === 'patrol'`

### 2.3 Combat Behavior

**Combat State Management (`SimpleCombat`):**

Combat uses a state object `entity.combatState`:

```javascript
{
  target: targetId,           // Current combat target
  startTime: timestamp,        // When combat started
  lastAttack: timestamp,       // Last attack time (for cooldown)
  pendingTarget: targetId,     // For stealth attacks
  pendingStartTime: timestamp, // For stealth approach
  pathfindingFailures: 0       // Track pathfinding issues
}
```

**Combat Flow:**

1. **Aggro Detection** (`SimpleCombat.checkAggro`):

   - Scans within `aggroRange` (default 512 = 8 tiles)
   - Checks alliance status via `allyCheck()`
   - Validates target (not ghost, same z-level, etc.)
   - Special handling for defending fleeing serfs (military units have extended 1000 range)

2. **Combat Initiation** (`SimpleCombat.startCombat`):

   - Validates target and alliance
   - Handles stealth mechanics
   - Initializes combat state
   - Counter-aggro for NPCs
   - Sets `entity.action = 'combat'`

3. **Combat Update Loop** (`SimpleCombat.update`):

   - Validates combat state and target
   - Checks distance and attack range
   - Handles melee positioning (prevents same-tile stacking)
   - Ranged unit kiting (moves away if too close)
   - Attack cooldown management (1000ms melee, 1500ms ranged)
   - Pathfinding to target if out of range

4. **Attack Execution** (`SimpleCombat.handleAttack`):

   - Melee: Direct damage via `applyDamage()`
   - Ranged: Shoots arrow via `entity.shootArrow(target.id)`
   - Updates facing direction
   - Removes stealth on attack

5. **Combat End** (`SimpleCombat.endCombat`):

   - Clears combat state
   - Resumes patrol if applicable
   - Stops running (restores base speed)
   - Handles escape messages

**Combat Ranges:**

- Melee attack range: 96 (1.5 tiles)
- Ranged attack range: 256 (4 tiles)
- Ranged kite distance: 96 (too close, back away)
- Detection range: 128 (2 tiles for stealth)
- Max chase range: `aggroRange * 2` (default 1024 = 16 tiles)

### 2.4 Scouting Behavior

**Scouting Party System (`ScoutingParty`):**

Scouting parties are groups of 1-3 units exploring zones:

**Party Structure:**

- `leader` - Primary unit (prefer mounted)
- `backupUnits` - Array of 0-2 backup units
- `targetZone` - Zone being scouted
- `purpose` - 'resource_scout' or 'establish_outpost'
- `status` - 'traveling', 'scouting', 'retreating', 'guarding'

**Scouting States:**

1. **Traveling** - Moving to target zone

   - Checks if within 10 tiles of zone center
   - Transitions to 'scouting' when reached

2. **Scouting** - Actively exploring zone

   - Scans for enemies every 10 seconds
   - Idle timer counts up (5 minutes = 300 seconds)
   - If enemies found → triggers retreat
   - If zone clear after duration → transitions to 'guarding'

3. **Retreating** - Returning to HQ

   - All units set to `action: 'retreat'`
   - Checks if within 5 tiles of HQ
   - Notifies faction AI on success/failure

4. **Guarding** - Protecting outpost location

   - Units stay at zone center
   - Moves back if >15 tiles from center

**Scout Behavior (`ScoutBehavior`):**

Individual scouts use `ScoutBehavior` class:

- `scanRadius: 3` - How far scout can see
- Continuously scans for resources and enemies
- Reports discoveries to faction AI via `house.ai.knowledge.reportDiscovery()`
- Returns to base when mission complete or enemies detected

### 2.5 Follow Behavior

**Follow Behavior (`FollowBehavior`):**

Backup units in scouting parties use follow behavior:

- `maxDistance: 5` - Maximum distance from leader
- `followDistance: 3` - Preferred follow distance
- Mirrors leader's actions (combat, retreat, idle)
- Moves toward leader if too far
- Attacks same target as leader in combat

## 3. Faction-Level Military Management

### 3.1 Military Tracking (`House.military`)

Each faction tracks military status:

```javascript
self.military = {
  units: {
    i: 0,   // Basic units (no rank)
    ii: 0   // Elite units (rank ♞)
  },
  territory: [self.hq],      // Territory tiles
  patrol: [self.hq],          // Patrol building IDs
  scout: {
    units: [],                // Scout unit IDs
    points: []                // Scout waypoints
  },
  alarm: null,                // Alarm state
  campaign: {
    rally: null               // Rally point
  }
}
```

**Unit Counting (`House.update`):**

Factions count military units each update:

```javascript
self.update = function() {
  for(var i in Player.list) {
    var unit = Player.list[i];
    if(unit.house == self.id && unit.military) {
      if(unit.rank == '♞ ') {
        self.military.units.ii++;
      } else if(!unit.rank) {
        self.military.units.i++;
      }
    }
  }
}
```

### 3.2 Faction AI Integration

**FactionAI System (`FactionAI`):**

The AI system coordinates military operations:

- **Active Scouting Parties** - Tracks deployed scouting parties
- **Active Attack Forces** - Tracks military expeditions
- **Knowledge System** - Stores discovered resources and enemies
- **Goal System** - Manages military goals (TrainMilitaryGoal, DeployScoutGoal, DefendTerritoryGoal, AttackEnemyGoal)

**Military Goals:**

1. **TrainMilitaryGoal** - Trains units (requires garrison; basic units cost 20 total food from grain + fish)
2. **DeployScoutGoal** - Deploys scout to destination
3. **DefendTerritoryGoal** - Rallies units to defensive positions
4. **AttackEnemyGoal** - Coordinates attack on enemy (requires garrison)

**Garrison Recruitment Economy:**

- Passive Garrison production checks food support capacity every 18,000 building updates. Existing military units reserve 10 food each, and the next passive unit requires 10 surplus food. The passive spawn itself does not consume stores.
- `TrainMilitaryGoal` is an active paid training action. It uses the same faction unit progression, costs 20 food for basic units, adds 10 iron for elite units, and costs 40 food plus 20 iron for mounted units.
- Both paths count fish and grain as food, so fishing economies can support military training without first converting that food into grain.
5. **EstablishOutpostGoal** - Complex goal involving scouting → planning → construction

## 4. Combat Mechanics Details

### 4.1 Damage Calculation

**Damage Formula (`SimpleCombat.calculateDamage`):**

```javascript
weaponDamage = attacker.damage || weapon.dmg
armorDefense = target.defense || target.fortitude || armor.defense
netDamage = Math.max(1, weaponDamage - armorDefense)
```

Minimum damage is always 1 to ensure attacks always do damage.

### 4.2 Positioning System

**Melee Positioning:**

- Units cannot occupy same tile as target
- `ensureMeleePositioning()` finds adjacent tile
- Priority system: attacker > higher HP > entity ID
- If repositioning fails, allows same-tile attack temporarily

**Ranged Kiting:**

- Ranged units move away if target is within 96 pixels (kite distance)
- Kite check happens every 2 seconds
- Moves 2 tiles away from target

### 4.3 Stealth Mechanics

**Stealth Detection:**

- Detection range: 128 pixels (2 tiles)
- `checkStealthDetection()` determines if stealthed unit is visible
- Stealth removed on attack or detection
- Pending stealth attacks use `pendingTarget` in combat state

### 4.4 Leash System

**Leash Range:**

- Units have `wanderRange` (default 2048 = 32 tiles)
- If unit moves beyond leash range from home, combat ends
- Unit returns home via `action: 'returning'`

## 5. Unit Progression

### 5.1 Kill-Based Upgrades

**Upgrade System (`SimpleCombat.checkMilitaryUpgrade`):**

Units can upgrade based on kills:

- **3rd kill** → Upgrade to elite variant (if exists)
- **10th kill** → Upgrade to mounted variant (if exists AND stable built)

**Upgrade Process:**

1. Preserves kill count
2. Changes class and name
3. Applies new unit stats (damage, speed, mounted, ranged)
4. Creates upgrade event
5. Maintains house affiliation

## 6. Special Behaviors

### 6.1 Defending Serfs

Military units have extended defensive range (1000 = 10 tiles) to respond to fleeing allied serfs:

```javascript
if (entity.military && entity.house) {
  // Check for fleeing serfs from same faction
  if (serf.action === 'flee' && serf.house === entity.house) {
    // Find attacker and engage
    this.startCombat(entity, attacker);
  }
}
```

### 6.2 Alliance System

**Alliance Checking (`allyCheck`):**

Returns relationship value:

- `2` - Same faction
- `1` - Allies
- `0` - Neutral
- `-1` - Enemies

**Enemy Determination:**

- Explicit enemy lists (`house.enemies`)
- Hostile factions (`house.hostile = true`)
- Wild animals (Wolf, Boar)
- Different factions (if hostile)

**Combat Prevention:**

- Allies never aggro each other
- `startCombat()` checks alliance before initiating
- Peaceful units (Serfs, Deer, Sheep) flee from non-allies

## 7. File Structure

**Key Files:**

- `server/js/Entity.js` - Unit class definitions
- `server/js/Houses.js` - Faction management and spawning
- `server/js/core/SimpleCombat.js` - Combat system
- `server/js/ai/ScoutingParty.js` - Scouting party management
- `server/js/ai/ScoutBehavior.js` - Individual scout behavior
- `server/js/ai/FollowBehavior.js` - Follow behavior for backup units
- `server/js/ai/FactionAI.js` - High-level AI coordination
- `server/js/ai/Goals.js` - Military goal definitions

## 8. Summary

The military system is a sophisticated multi-layer system:

1. **Unit Layer** - Individual units with stats, behaviors, and combat states
2. **Group Layer** - Scouting parties and attack forces with coordinated behavior
3. **Faction Layer** - Territory management, patrol routes, and military tracking
4. **AI Layer** - Strategic decision-making, goal planning, and resource allocation

Units transition between multiple behavior states (idle, patrol, combat, scouting, retreat) based on faction goals, enemy detection, and territory defense needs. The system supports both individual unit autonomy and coordinated group operations.












