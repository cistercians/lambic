# Serf System Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Serf Behavior Cycle Phases](#serf-behavior-cycle-phases)
4. [Integration Points](#integration-points)
5. [State Machine Flow](#state-machine-flow)
6. [Resource Flow](#resource-flow)
7. [Key Data Structures](#key-data-structures)
8. [Special Features](#special-features)
9. [File Structure](#file-structure)
10. [Code Reference](#code-reference)

---

## Overview

The serf system is a complex economic unit management system that handles worker NPCs (serfs) who gather resources, build structures, and contribute to house economies. The system uses an action-based behavior model similar to military units, with a centralized behavior handler (`SimpleSerfBehavior`) that manages all serf activities.

### Key Characteristics

- **Action-based behavior**: Serfs operate on discrete actions (`null`, `'deposit'`, `'build'`, `'clockout'`)
- **Pre-assigned work**: Work buildings are assigned at spawn time, no dynamic reassignment
- **Gender-based restrictions**: Female serfs can only work mills/farms; males can work all building types
- **Wage system**: Serfs keep 15% of common resources as personal wage
- **Spot management**: Buildings track which serfs are assigned to which work spots to prevent conflicts

---

## Core Components

### 1. Serf Entity Creation

**File:** `server/js/Entity.js` (lines 8147-8645)

#### Serf Constructor

```javascript
Serf = function(param) {
  var self = Character(param);
  // ... initialization
}
```

**Key Properties:**
- `self.work = {hq: null, spot: null, assignedSpot: null}` - Work assignment tracking
- `self.inventory = {}` - Resources being carried
- `self.stores = {}` - Personal wage storage
- `self.mode = 'idle'` or `'work'` - Current behavior mode
- `self.action = null` - Current action (`'deposit'`, `'build'`, `'clockout'`, or `null`)
- `self.hut` - Reference to hut building (if assigned)
- `self.home = {z, loc}` - Home location [col, row]
- `self.torchBearer = false` - For miners in caves
- `self.sex = 'm'` or `'f'` - Gender
- `self.class = 'SerfM'` or `'SerfF'` - Visual distinction

#### Gender Variants

```javascript
SerfM = function(param) {
  param.sex = 'm';
  return Serf(param);
};

SerfF = function(param) {
  param.sex = 'f';
  return Serf(param);
};
```

#### Work Assignment Methods

**`assignWorkHQ()`** (lines 8168-8228)
- Finds nearest valid work building based on gender
- **Female serfs**: Only `mill` and `farm`
- **Male serfs**: `mill`, `farm`, `lumbermill`, `mine`, `dock`
- Can search allied houses if no work in own house
- Sets `torchBearer = true` for miners in caves

**`assignDailyWorkSpot()`** (lines 8285-8341)
- Assigns a specific work spot from building's resource list
- Reuses existing spot if still valid
- Updates building resources before assigning
- Filters available spots using `building.isSpotAvailable()`

**`findTavern()`** (lines 8261-8282)
- Locates nearest tavern within 1280 units
- Sets `self.tavern` property

**`initializeSerf()`** (lines 8231-8258)
- Sets up work assignment, torch bearer status, and mode
- Calls `assignWorkHQ()` if no work assigned
- Sets initial `mode = 'idle'` or `'work'`

### 2. Behavior System

**File:** `server/js/core/SimpleSerfBehavior.js`

#### Main Update Loop

```javascript
update(serf) {
  // Ensure required properties exist
  if (!serf.work) serf.work = { hq: null, spot: null, assignedSpot: null };
  if (!serf.inventory) serf.inventory = {};
  if (!serf.stores) serf.stores = {};

  // Route to action handlers
  if (!serf.action) {
    this.handleDefaultWork(serf);
  } else if (serf.action === 'deposit') {
    this.handleDeposit(serf);
  } else if (serf.action === 'build') {
    this.handleBuild(serf);
  } else if (serf.action === 'clockout') {
    this.handleClockout(serf);
  } else if (serf.mode !== 'work') {
    this.handleWandering(serf);
  }
}
```

**Called from:** `Entity.js` lines 8365-8367, 8831-8833

```javascript
if (global.simpleSerfBehavior) {
  global.simpleSerfBehavior.update(self);
}
```

#### Configuration

```javascript
this.BUILDING_SHARE = 0.85; // 85% to building
this.SERF_WAGE = 0.15; // 15% wage for serf
```

### 3. Building Spot Management

**File:** `server/js/Entity.js` (lines 260-278)

Buildings maintain work spot assignments:

```javascript
self.assignedSpots = {}; // Maps serf IDs to their assigned spots

self.assignSpot = function(serfId, spot) {
  self.assignedSpots[serfId] = spot;
};

self.releaseSpot = function(serfId) {
  delete self.assignedSpots[serfId];
};

self.isSpotAvailable = function(spot) {
  for(var id in self.assignedSpots) {
    var assigned = self.assignedSpots[id];
    if(assigned[0] === spot[0] && assigned[1] === spot[1]) {
      return false;
    }
  }
  return true;
};
```

---

## Serf Behavior Cycle Phases

### Phase 1: Initialization & Work Assignment

**Location:** `Entity.js` lines 8231-8258, `SimpleSerfBehavior.js` lines 58-99

**Process:**
1. Serf spawns via `newSerfs()` in `Houses.js` (called when buildings are created)
2. `initializeSerf()` is called:
   - If `work.hq` not provided, calls `assignWorkHQ()` to find nearest valid building
   - Sets `torchBearer = true` for miners in caves
   - Sets initial `mode = 'idle'` or `'work'`
3. Work building is pre-assigned at spawn - no dynamic reassignment needed

**Serf Spawning Example** (`Houses.js` lines 356-531):
```javascript
self.newSerfs = function(b, hq) {
  var building = Building.list[b];
  // ... find hut spot ...
  
  // Create serfs
  SerfM({
    x: coords[0],
    y: coords[1],
    z: 0,
    house: self.id,
    work: { hq: b, spot: null },
    hut: hutId,
    home: { z: 0, loc: select }
  });
}
```

### Phase 2: Work Spot Assignment

**Location:** `SimpleSerfBehavior.js` lines 320-387

**Process:**
1. `assignWorkSpot(serf, building)` is called when serf needs a spot
2. Releases any previously assigned spot via `building.releaseSpot(serf.id)`
3. Updates building resources via `building.updateResources()`
4. Finds available spots from `building.resources` array
5. Filters using `building.isSpotAvailable(spot)` to check if already assigned
6. Randomly selects from available spots
7. Calls `building.assignSpot(serf.id, selected)` to mark as taken
8. Sets `serf.work.spot = selected` and `serf.work.assignedSpot = selected`

**Code:**
```javascript
assignWorkSpot(serf, building) {
  // Release previous spot
  if (serf.work.assignedSpot && building.releaseSpot) {
    building.releaseSpot(serf.id);
  }
  
  // Update building resources
  if (building.updateResources) {
    building.updateResources();
  }
  
  // Find available spots
  const availableSpots = [];
  for (const res of building.resources) {
    if (building.isSpotAvailable && building.isSpotAvailable(res)) {
      availableSpots.push(res);
    }
  }
  
  // Assign random available spot
  const selected = availableSpots[Math.floor(Math.random() * availableSpots.length)];
  serf.work.assignedSpot = selected;
  serf.work.spot = selected;
  building.assignSpot(serf.id, selected);
  
  return selected;
}
```

### Phase 3: Pathfinding to Work Spot

**Location:** `SimpleSerfBehavior.js` lines 444-484

**Process:**
1. `executeWork(serf, building, spot)` checks if serf is at work spot
2. If not at spot, calls `serf.moveTo(targetZ, spot[0], spot[1])`
   - For mines with caves: `targetZ = -1` (underground)
   - For surface work: `targetZ = 0`
3. Pathfinding handled by Entity's `moveTo()` method
4. Serf continues pathfinding until at spot

**Code:**
```javascript
executeWork(serf, building, spot) {
  const loc = global.getLoc(serf.x, serf.y);
  
  // Check if at work spot
  if (spot && loc.toString() === spot.toString()) {
    // At spot - start work based on building type
    switch (building.type) {
      case 'mill':
      case 'farm':
        this.startFarmingWork(serf, building, spot);
        break;
      case 'lumbermill':
        this.startLumberingWork(serf, building, spot);
        break;
      case 'mine':
        if (building.cave) {
          this.startMiningWork(serf, building, spot);
        } else {
          this.startStoneMiningWork(serf, building, spot);
        }
        break;
    }
  } else if (!serf.path || serf.path.length === 0) {
    // Path to work spot
    const targetZ = (building.type === 'mine' && building.cave) ? -1 : 0;
    serf.moveTo(targetZ, spot[0], spot[1]);
  }
}
```

### Phase 4: Resource Gathering

**Location:** `SimpleSerfBehavior.js` lines 520-899

Work execution depends on building type. All work types use timers with delay: `10000 / serf.strength` milliseconds.

#### Farming (Mill/Farm) - lines 520-675

**Process:**
- Checks tile state on layer 6:
  - `8` (seeded) → Progress to growing via `tileChange(6, ...)`
  - `9` (growing) → Progress to ready
  - `10` (ready) → Harvest grain → `serf.inventory.grain += 10`
- When all 9 plot tiles reach ready state, all tiles become harvestable
- Work delay: `10000 / serf.strength` milliseconds

**Tile Progression:**
```
Seeded (8) → Growing (9) → Ready (10) → Harvest → Seeded (8)
```

**Code Flow:**
```javascript
startFarmingWork(serf, building, spot) {
  const tile = global.getTile(0, spot[0], spot[1]);
  
  if (tile === 8) {
    // Seed tile - progress to growing
    global.tileChange(6, spot[0], spot[1], 1, true);
    // Check if all tiles ready...
  } else if (tile === 9) {
    // Growing tile - progress to ready
    global.tileChange(6, spot[0], spot[1], 1, true);
    // Check if all tiles ready...
  } else {
    // Ready tile - harvest grain
    global.tileChange(6, spot[0], spot[1], -1, true);
    serf.inventory.grain = (serf.inventory.grain || 0) + 10;
  }
}
```

#### Lumbering (Lumbermill) - lines 680-747

**Process:**
- Chops wood from trees on layer 6
- `tileChange(6, spot[0], spot[1], -1)` - Depletes tree resource
- `serf.inventory.wood += 10` per chop
- When tree depleted (`res <= 0`), removes from `building.resources` array
- Converts tile to grass when depleted

**Code:**
```javascript
startLumberingWork(serf, building, spot) {
  const workCallback = () => {
    // Chop wood
    global.tileChange(6, spot[0], spot[1], -1, true);
    serf.inventory.wood = (serf.inventory.wood || 0) + 10;
    
    const res = global.getTile(6, spot[0], spot[1]);
    if (res <= 0) {
      // Tree depleted
      global.tileChange(0, spot[0], spot[1], 1, true);
      
      // Remove from building resources
      for (let i = building.resources.length - 1; i >= 0; i--) {
        if (building.resources[i].toString() === spot.toString()) {
          building.resources.splice(i, 1);
        }
      }
      serf.work.spot = null;
    }
  };
  
  const workDelay = 10000 / (serf.strength || 1);
  // Set timer...
}
```

#### Mining (Mine) - lines 752-899

**Two Types:**

**A. Cave Mining (Ore)** - lines 752-828
- Uses layer 7 for ore resources
- Random ore drops:
  - Diamond: 0.1% chance
  - Gold ore: 1% chance
  - Silver ore: 10% chance
  - Iron ore: 50% chance
- `tileChange(7, spot[0], spot[1], -1)` - Depletes ore
- When depleted, discovers adjacent rocks via `discoverAdjacentRocks()`

**B. Stone Mining** - lines 833-899
- Uses layer 6 for stone
- `serf.inventory.stone += 10` per mine
- `tileChange(6, spot[0], spot[1], -1)` - Depletes stone
- Converts to cave tile when depleted

**Code:**
```javascript
startMiningWork(serf, building, spot) {
  const workCallback = () => {
    // Mine ore - random chance
    const roll = Math.random();
    if (roll < 0.001) {
      serf.inventory.diamond = (serf.inventory.diamond || 0) + 1;
    } else if (roll < 0.01) {
      serf.inventory.goldore = (serf.inventory.goldore || 0) + 1;
    } else if (roll < 0.1) {
      serf.inventory.silverore = (serf.inventory.silverore || 0) + 1;
    } else if (roll < 0.5) {
      serf.inventory.ironore = (serf.inventory.ironore || 0) + 1;
    }
    
    // Deplete resource
    global.tileChange(7, spot[0], spot[1], -1, true);
    const res = global.getTile(7, spot[0], spot[1]);
    
    if (res <= 0) {
      // Rock depleted - discover adjacent rocks
      this.discoverAdjacentRocks(spot, building);
      serf.work.spot = null;
    }
  };
}
```

**Work Timer Management:**
- `workTimerId` - Active work timer reference
- `clearWorkTimers()` - Cancels active timers
- Flags: `working`, `farming`, `chopping`, `mining` track current activity
- Uses `timerManager` when available, falls back to `setTimeout`

### Phase 5: Resource Deposition

**Location:** `SimpleSerfBehavior.js` lines 104-139, 968-1107

#### Trigger Conditions

`hasResourcesToDeposit()` returns true when:
- `wood >= 10`, `stone >= 10`, `ironore >= 10`, `grain >= 10`
- OR `silverore >= 1`, `goldore >= 1`, `diamond >= 1`

#### Deposit Process

1. `handleDeposit()` sets `serf.action = 'deposit'`
2. Gets dropoff location via `getDropoffLocation(building)` - typically `[plot[0][0], plot[0][1] + 1]`
3. Pathfinds to dropoff using `serf.moveTo(0, dropoff[0], dropoff[1])`
4. When at dropoff (`isAtDropoff()`), calls `depositAllResources()`

**Code:**
```javascript
handleDeposit(serf) {
  const building = this.getWorkBuilding(serf);
  if (!building || !building.built) {
    serf.action = null;
    return;
  }
  
  const dropoff = this.getDropoffLocation(building);
  const loc = global.getLoc(serf.x, serf.y);
  
  if (this.isAtDropoff(serf, building)) {
    // At dropoff - deposit all resources
    serf.facing = 'up';
    this.depositAllResources(serf, building);
    serf.action = null; // Resume work
  } else if (!serf.path || serf.path.length === 0) {
    // Path to dropoff
    serf.moveTo(0, dropoff[0], dropoff[1]);
  }
}
```

#### Resource Distribution

**`depositResource()`** (lines 1014-1107):

**Common resources** (grain, wood, stone, ironore):
- Building gets 85%: `buildingShare = Math.floor(amount * 0.85)`
- Serf gets 15% wage: `serfWage = amount - buildingShare`
- Minimum 1 unit to building if amount >= 1

**Rare ores** (silverore, goldore, diamond):
- Building gets 100% (no wage for rare resources)
- Deposited one at a time

**Process:**
1. Deposits to `house.stores[resourceType]`
2. Creates economic event via `eventManager.createEvent()`
3. Clears inventory
4. Adds wage to `serf.stores[resourceType]`
5. Special: Mills convert grain → flour during deposit

**Code:**
```javascript
depositResource(serf, resourceType, building, amount = null) {
  const singleItemResources = ['silverore', 'goldore', 'diamond'];
  const isSingleItem = singleItemResources.includes(resourceType);
  
  if (amount === null) {
    amount = serf.inventory[resourceType] || 0;
  }
  
  // Calculate shares
  let buildingShare, serfWage;
  if (isSingleItem) {
    buildingShare = amount;
    serfWage = 0;
  } else {
    buildingShare = Math.floor(amount * this.BUILDING_SHARE);
    if (amount >= 1 && buildingShare === 0) {
      buildingShare = 1;
    }
    serfWage = amount - buildingShare;
  }
  
  // Deposit to building's house
  const house = global.House.list[building.house];
  if (house && house.stores) {
    house.stores[resourceType] = (house.stores[resourceType] || 0) + buildingShare;
    
    // Create deposit event
    if (global.eventManager) {
      global.eventManager.createEvent({
        category: global.eventManager.categories?.ECONOMIC,
        subject: serf.id,
        action: `deposited ${resourceType}`,
        target: building.house,
        quantity: buildingShare,
        // ...
      });
    }
  }
  
  // Clear inventory
  serf.inventory[resourceType] = Math.max(0, (serf.inventory[resourceType] || 0) - amount);
  
  // Give serf wage
  if (serfWage > 0) {
    serf.stores[resourceType] = (serf.stores[resourceType] || 0) + serfWage;
  }
  
  // Grain -> flour conversion (mills only)
  if (resourceType === 'grain' && building.type === 'mill') {
    serf.inventory.flour = (serf.inventory.flour || 0) + Math.floor(buildingShare / 3);
  }
}
```

### Phase 6: Building Construction (Male Serfs Only)

**Location:** `SimpleSerfBehavior.js` lines 144-206

#### Trigger

- Serf has `hut` property pointing to unbuilt hut
- `serf.hut` is set when hut foundation is placed

#### Build Process

1. `handleBuild()` sets `serf.action = 'build'`
2. Finds foundation tiles (tile type `11`) from `hut.plot`
3. Randomly selects a foundation tile as work spot
4. Pathfinds to foundation tile
5. When at tile, calls `global.Build(serf.id)` to construct
6. After building, clears `serf.work.spot` and resumes normal work

**Code:**
```javascript
handleBuild(serf) {
  const hut = global.Building.list[serf.hut];
  if (!hut || hut.built) {
    serf.action = null;
    return;
  }
  
  // Find foundation tile if no spot
  if (!serf.work.spot) {
    const buildableTiles = [];
    for (const p of hut.plot) {
      const t = global.getTile(0, p[0], p[1]);
      if (t === 11) { // Foundation tile
        buildableTiles.push(p);
      }
    }
    
    if (buildableTiles.length > 0) {
      serf.work.spot = buildableTiles[Math.floor(Math.random() * buildableTiles.length)];
    }
  }
  
  const loc = global.getLoc(serf.x, serf.y);
  if (loc.toString() === serf.work.spot.toString()) {
    // At building spot
    const gt = global.getTile(0, serf.work.spot[0], serf.work.spot[1]);
    if (gt === 11) {
      if (!serf.building && typeof global.Build === 'function') {
        global.Build(serf.id);
      }
    } else {
      // Tile already built, find new one
      serf.work.spot = null;
    }
  } else if (!serf.path || serf.path.length === 0) {
    // Path to building spot
    serf.moveTo(0, serf.work.spot[0], serf.work.spot[1]);
  }
}
```

### Phase 7: Clockout (End of Day)

**Location:** `SimpleSerfBehavior.js` lines 211-264

#### Process

1. First deposits any remaining resources
2. Then pathfinds to `serf.home` location
3. When at home, sets `serf.action = null` and `serf.mode = 'idle'`
4. Serf enters idle/wandering state

**Code:**
```javascript
handleClockout(serf) {
  // First deposit resources if any
  if (this.hasResourcesToDeposit(serf)) {
    const building = this.getWorkBuilding(serf);
    if (building && building.built) {
      const dropoff = this.getDropoffLocation(building);
      // ... deposit logic ...
      return; // Wait for deposit to complete
    }
  }
  
  // No resources or done depositing - go home
  if (serf.home) {
    const loc = global.getLoc(serf.x, serf.y);
    if (serf.z !== serf.home.z || loc.toString() !== serf.home.loc.toString()) {
      if (!serf.path || serf.path.length === 0) {
        serf.moveTo(serf.home.z, serf.home.loc[0], serf.home.loc[1]);
      }
    } else {
      // Arrived home
      serf.action = null;
      serf.mode = 'idle';
    }
  } else {
    // No home - just become idle
    serf.action = null;
    serf.mode = 'idle';
  }
}
```

### Phase 8: Wandering/Idle

**Location:** `SimpleSerfBehavior.js` lines 269-311

#### Process

When `serf.mode !== 'work'`:
1. `handleWandering()` picks random adjacent tile
2. Checks if walkable (not water, not transition tiles)
3. Moves to tile using `serf.move(target)`
4. Sets `serf.idleTime` to random value (30-1000 frames)
5. Waits before next wander

**Code:**
```javascript
handleWandering(serf) {
  if (serf.z !== 0) return;
  if (serf.path || serf.idleTime > 0) return;
  
  const loc = global.getLoc(serf.x, serf.y);
  const col = loc[0];
  const row = loc[1];
  
  // Pick random adjacent tile
  const directions = [
    [col, row - 1], // North
    [col, row + 1], // South
    [col - 1, row], // West
    [col + 1, row]  // East
  ];
  
  const target = directions[Math.floor(Math.random() * directions.length)];
  const isWalkable = global.isWalkable(0, target[0], target[1]);
  const targetTile = global.getTile(0, target[0], target[1]);
  const isWater = (targetTile === 0);
  const isTransitionTile = (targetTile === 6 || targetTile === 14 || targetTile === 16 || targetTile === 19);
  
  if (isWalkable && !isWater && !isTransitionTile) {
    serf.move(target);
    serf.idleTime = Math.floor(Math.random() * (serf.idleRange || 1000));
  } else {
    serf.idleTime = Math.floor(Math.random() * 60) + 30;
  }
}
```

---

## Integration Points

### Entity Update Integration

**File:** `server/js/Entity.js` lines 8365-8367, 8831-8833

Called every frame in serf's `update()` method, after zone checks and torch logic:

```javascript
self.update = function() {
  var loc = getLoc(self.x, self.y);
  self.zoneCheck();
  
  // Torch bearer logic
  if (self.torchBearer) {
    // ... torch lighting ...
  }
  
  // Use simple behavior system for serf behavior
  if (global.simpleSerfBehavior) {
    global.simpleSerfBehavior.update(self);
  }
  
  // Z-level transitions and day/night logic
  // ...
}
```

### Global Initialization

**File:** `lambic.js` lines 8802-8803

```javascript
const SimpleSerfBehavior = require('./server/js/core/SimpleSerfBehavior.js');
global.simpleSerfBehavior = new SimpleSerfBehavior();
```

Creates singleton instance available globally.

### Serf Spawning

**File:** `server/js/Houses.js` (multiple locations: lines 356-531, 1060-1230, 1704-1865, 2154-2315)

**Method:** `newSerfs(buildingId, hq)`

**Process:**
1. Finds hut spot using `tilemapSystem.findBuildingSpot('gothhut', ...)`
2. Creates hut building with foundation
3. Creates serfs with work assignment:
   ```javascript
   SerfM({
     x: coords[0],
     y: coords[1],
     z: 0,
     house: self.id,
     work: { hq: buildingId, spot: null },
     hut: hutId,
     home: { z: 0, loc: [col, row] }
   });
   ```

**Gender Assignment Rules:**
- **Lumbermill/mine**: First serf always male, second can be either (but only males get work assigned)
- **Mill/farm**: Can be either gender, both can work

**Example:**
```javascript
self.newSerfs = function(b, hq) {
  var building = Building.list[b];
  var loc = getLoc(building.x, building.y);
  
  // Find hut spot
  var hutSpot = global.tilemapSystem.findBuildingSpot('gothhut', loc, searchRadius);
  
  if (hutSpot) {
    // Create hut...
    
    // Create serfs
    if (building.type === 'mill' || building.type === 'farm') {
      // First serf can be either
      var s1 = Math.random() < 0.5 ? SerfM(...) : SerfF(...);
      // Second serf can be either
      var s2 = Math.random() < 0.5 ? SerfM(...) : SerfF(...);
    } else {
      // Lumbermill or mine - first serf must be male
      var s1 = SerfM(...);
      // Second serf can be either, but only males get work
      var s2 = Math.random() < 0.5 ? SerfM(...) : SerfF(...);
      if (s2.sex === 'f') {
        // Female doesn't get work assignment
      }
    }
  }
}
```

### Building Resource Management

Buildings maintain workable resource lists:

```javascript
building.resources = [
  [col1, row1],  // Workable tile coordinates
  [col2, row2],
  // ...
]
```

**Methods:**
- `building.updateResources()` - Refreshes resource list based on terrain
- Resources are consumed as serfs work them
- Depleted resources removed from array
- New resources discovered (e.g., adjacent rocks in mines)

---

## State Machine Flow

```
[SPAWN]
  ↓
[INITIALIZE] → assignWorkHQ() → set mode='work'
  ↓
[NO ACTION] → handleDefaultWork()
  ↓
[CHECK HUT] → if hut && !built → action='build'
  ↓
[CHECK RESOURCES] → if hasResources → action='deposit'
  ↓
[ASSIGN SPOT] → if !work.spot → assignWorkSpot()
  ↓
[PATHFIND] → if !at spot → moveTo(spot)
  ↓
[AT SPOT] → executeWork() → start work timer
  ↓
[WORKING] → timer callback → gather resource → clear timer
  ↓
[LOOP] → back to [NO ACTION]
```

### Action States

- **`action = null`** → Default work cycle
  - Check hut building
  - Check resources to deposit
  - Assign work spot if needed
  - Execute work

- **`action = 'deposit'`** → Pathfind to building, deposit, return to work
  - Get dropoff location
  - Pathfind to dropoff
  - Deposit all resources
  - Clear action, resume work

- **`action = 'build'`** → Pathfind to foundation, build, return to work
  - Find foundation tile
  - Pathfind to foundation
  - Call `global.Build(serf.id)`
  - Clear action, resume work

- **`action = 'clockout'`** → Deposit, go home, set mode='idle'
  - Deposit remaining resources
  - Pathfind to home
  - Set mode='idle', clear action

### Mode States

- **`mode = 'work'`** → Serf is actively working
  - Assigned to work building
  - Has work spot
  - Gathering resources

- **`mode = 'idle'`** → Serf is not working
  - No work assignment
  - Wandering behavior
  - At home or exploring

---

## Resource Flow

```
Terrain/Resources
  ↓ (serf works spot)
Serf Inventory
  ↓ (serf deposits)
Building → House Stores (85%)
  ↓
Serf Stores (15% wage)
```

### Resource Types

**Common Resources** (10+ units per deposit):
- `grain` - From farms/mills
- `wood` - From lumbermills
- `stone` - From stone mines
- `ironore` - From ore mines

**Rare Resources** (1 unit per deposit):
- `silverore` - From ore mines (10% chance)
- `goldore` - From ore mines (1% chance)
- `diamond` - From ore mines (0.1% chance)

**Processed Resources**:
- `flour` - Generated at mills from grain (1 flour per 3 grain)

### Wage Calculation

**Common Resources:**
```javascript
buildingShare = Math.floor(amount * 0.85);
serfWage = amount - buildingShare;
// Minimum 1 to building if amount >= 1
```

**Rare Resources:**
```javascript
buildingShare = amount; // 100%
serfWage = 0; // No wage
```

---

## Key Data Structures

### Serf Work Object

```javascript
serf.work = {
  hq: buildingId,        // Work building ID (pre-assigned at spawn)
  spot: [col, row],      // Current work spot (assigned dynamically)
  assignedSpot: [col, row] // Assigned spot (for spot management)
}
```

### Serf Inventory

```javascript
serf.inventory = {
  wood: 0,        // Common resource
  stone: 0,       // Common resource
  grain: 0,       // Common resource
  ironore: 0,     // Common resource
  silverore: 0,   // Rare resource
  goldore: 0,     // Rare resource
  diamond: 0,     // Rare resource
  flour: 0,       // Processed resource (generated at mills)
  torch: 0        // For torch bearers (infinite, doesn't consume)
}
```

### Serf Stores (Wages)

```javascript
serf.stores = {
  wood: 0,
  stone: 0,
  grain: 0,
  ironore: 0
  // Rare ores not stored (no wage)
}
```

### Building Resources

```javascript
building.resources = [
  [col1, row1],  // Workable tile coordinates
  [col2, row2],
  // ...
]

building.assignedSpots = {
  serfId1: [col, row],  // Maps serf IDs to their assigned spots
  serfId2: [col, row],
  // ...
}
```

### Home Location

```javascript
serf.home = {
  z: 0,           // Z-level (0 = surface, -1 = underground)
  loc: [col, row]  // Tile coordinates
}
```

### Hut Reference

```javascript
serf.hut = hutBuildingId  // Reference to hut building (if assigned)
```

---

## Special Features

### Torch Bearers

**Location:** `Entity.js` lines 8356-8362, 8163, 8219-8224

**Process:**
- Miners in caves get `torchBearer = true` during `assignWorkHQ()`
- Auto-lights torch in caves or at night
- `inventory.torch = 3` (infinite, doesn't consume)
- Torch provides light in dark areas

**Code:**
```javascript
// During assignWorkHQ()
if (buildingType === 'mine' && Building.list[bestHQ].cave) {
  self.torchBearer = true;
  self.inventory.torch = 3; // Free light, don't consume
}

// During update()
if (self.torchBearer) {
  if (!self.hasTorch) {
    if ((self.z == 0 && nightfall) || self.z == -1 || self.z == -2) {
      self.lightTorch(Math.random());
    }
  }
}
```

### Z-Level Transitions

**Location:** `Entity.js` lines 8370-8444

**Surface to Cave:**
- Surface (z=0) → Cave entrance (tile 6) → Underground (z=-1)
- Triggered when serf steps on cave entrance tile
- Clears path to prevent navigation issues

**Cave to Surface:**
- Cave exit (tile 2 on layer 1) → Surface (z=0)
- Mine exit cooldown prevents immediate re-entry (~2 seconds)
- `mineExitCooldown` decrements each frame

**Code:**
```javascript
// Surface to cave
if (self.z == 0) {
  if (getTile(0, loc[0], loc[1]) == 6) {
    // Cave entrance - enter only if no active path AND cooldown expired
    if ((!self.path || self.path.length === 0) && self.mineExitCooldown === 0) {
      self.caveEntrance = loc;
      self.z = -1;
      self.path = null;
      self.pathCount = 0;
    }
  }
}

// Cave to surface
else if (self.z == -1) {
  var tileValue = getTile(1, loc[0], loc[1]);
  if (tileValue == 2) {
    // At cave exit
    self.z = 0;
    self.mineExitCooldown = 120; // ~2 seconds at 60 FPS
  }
}
```

### Gender Restrictions

**Location:** `Entity.js` lines 8174-8182

**Female Serfs:**
- Can only work: `mill`, `farm`
- Can build huts
- Cannot work: `lumbermill`, `mine`, `dock`

**Male Serfs:**
- Can work: `mill`, `farm`, `lumbermill`, `mine`, `dock`
- Can build huts
- Only males get work assigned at lumbermills/mines

**Code:**
```javascript
self.assignWorkHQ = function() {
  var validBuildingTypes = [];
  if (self.sex === 'f') {
    // Females: only mills and farms
    validBuildingTypes = ['mill', 'farm'];
  } else {
    // Males: all economic buildings
    validBuildingTypes = ['mill', 'farm', 'lumbermill', 'mine', 'dock'];
  }
  // ... find nearest valid building ...
}
```

### Wage System

**Location:** `SimpleSerfBehavior.js` lines 1014-1107

**Common Resources:**
- Building gets 85% of resources
- Serf gets 15% as personal wage
- Minimum 1 unit to building if amount >= 1

**Rare Resources:**
- Building gets 100% (no wage for rare resources)
- Deposited one at a time

**Storage:**
- Building share → `house.stores[resourceType]`
- Serf wage → `serf.stores[resourceType]`

**Code:**
```javascript
// Common resources
buildingShare = Math.floor(amount * this.BUILDING_SHARE); // 85%
if (amount >= 1 && buildingShare === 0) {
  buildingShare = 1; // Minimum 1
}
serfWage = amount - buildingShare; // 15%

// Rare ores
buildingShare = amount; // 100%
serfWage = 0; // No wage
```

### Resource Discovery

**Location:** `SimpleSerfBehavior.js` lines 904-940

**Mining Discovery:**
- When a rock is depleted in a mine, adjacent rocks are discovered
- Checks 4 adjacent tiles for rock tiles (tile type 1 on layer 1)
- Converts discovered rocks to mineable resources
- Adds to `building.resources` array

**Code:**
```javascript
discoverAdjacentRocks(spot, building) {
  const adj = [
    [spot[0] - 1, spot[1]],
    [spot[0], spot[1] - 1],
    [spot[0] + 1, spot[1]],
    [spot[0], spot[1] + 1]
  ];
  
  for (const t of adj) {
    const gt = global.getTile(1, t[0], t[1]);
    if (gt === 1) {
      // Discover rock
      const num = 3 + Number((Math.random() * 0.9).toFixed(2));
      global.tileChange(1, t[0], t[1], num);
      global.matrixChange(1, t[0], t[1], 0);
      building.resources.push(t);
    }
  }
}
```

### Grain to Flour Conversion

**Location:** `SimpleSerfBehavior.js` lines 1094-1100

**Process:**
- When grain is deposited at a mill, flour is generated
- Conversion rate: 1 flour per 3 grain (from building share)
- Flour added to serf inventory (not deposited)

**Code:**
```javascript
// Grain -> flour conversion (mills only)
if (resourceType === 'grain' && building.type === 'mill' && serf.inventory) {
  serf.inventory.flour = (serf.inventory.flour || 0) + Math.floor(buildingShare / 3);
}
```

---

## File Structure

### Core Files

- **`server/js/Entity.js`** (lines 8147-8645)
  - Serf entity definition
  - `Serf()`, `SerfM()`, `SerfF()` constructors
  - Work assignment methods
  - Entity update integration

- **`server/js/core/SimpleSerfBehavior.js`** (all 1165 lines)
  - Main behavior system
  - All behavior cycle phases
  - Resource gathering logic
  - Resource deposition logic
  - Building construction logic

- **`server/js/core/SerfLogger.js`** (207 lines)
  - Logging utility (optional, for debugging)
  - Structured logging with levels
  - Performance-aware operation

- **`server/js/Houses.js`** (multiple locations)
  - Serf spawning via `newSerfs()` methods
  - Gender assignment logic
  - Hut creation

- **`lambic.js`** (line 8802)
  - Global initialization
  - Creates `global.simpleSerfBehavior` singleton

### Supporting Files

- **`client/js/utils/PortraitHelper.js`**
  - Portrait rendering for serfs (male/female distinction)

- **`client/js/rendering/PlayerRenderer.js`**
  - Serf rendering logic
  - Flag display (serfs don't show flags)

- **`server/js/core/ChatEngine.js`**
  - Serf dialogue responses
  - Gender-specific dialogue

---

## Code Reference

### Key Function Locations

| Function | File | Lines |
|----------|------|-------|
| `Serf()` constructor | `server/js/Entity.js` | 8147-8344 |
| `SerfM()` / `SerfF()` | `server/js/Entity.js` | 8637-8645 |
| `assignWorkHQ()` | `server/js/Entity.js` | 8168-8228 |
| `assignDailyWorkSpot()` | `server/js/Entity.js` | 8285-8341 |
| `initializeSerf()` | `server/js/Entity.js` | 8231-8258 |
| `SimpleSerfBehavior.update()` | `server/js/core/SimpleSerfBehavior.js` | 17-52 |
| `handleDefaultWork()` | `server/js/core/SimpleSerfBehavior.js` | 58-99 |
| `handleDeposit()` | `server/js/core/SimpleSerfBehavior.js` | 104-139 |
| `handleBuild()` | `server/js/core/SimpleSerfBehavior.js` | 144-206 |
| `handleClockout()` | `server/js/core/SimpleSerfBehavior.js` | 211-264 |
| `handleWandering()` | `server/js/core/SimpleSerfBehavior.js` | 269-311 |
| `assignWorkSpot()` | `server/js/core/SimpleSerfBehavior.js` | 320-387 |
| `executeWork()` | `server/js/core/SimpleSerfBehavior.js` | 444-484 |
| `startFarmingWork()` | `server/js/core/SimpleSerfBehavior.js` | 520-675 |
| `startLumberingWork()` | `server/js/core/SimpleSerfBehavior.js` | 680-747 |
| `startMiningWork()` | `server/js/core/SimpleSerfBehavior.js` | 752-828 |
| `startStoneMiningWork()` | `server/js/core/SimpleSerfBehavior.js` | 833-899 |
| `depositAllResources()` | `server/js/core/SimpleSerfBehavior.js` | 968-1009 |
| `depositResource()` | `server/js/core/SimpleSerfBehavior.js` | 1014-1107 |
| `newSerfs()` | `server/js/Houses.js` | 356-531, 1060-1230, etc. |
| `assignSpot()` | `server/js/Entity.js` | 260-262 |
| `releaseSpot()` | `server/js/Entity.js` | 265-267 |
| `isSpotAvailable()` | `server/js/Entity.js` | 270-278 |

### Global Variables

- `global.simpleSerfBehavior` - Singleton behavior system instance
- `global.Building.list` - All buildings in the game
- `global.House.list` - All houses/factions
- `global.Player.list` - All entities (including serfs)
- `global.timerManager` - Centralized timer system (optional)
- `global.eventManager` - Event system for economic events
- `global.tilemapSystem` - Building placement system

### Tile Types Reference

**Layer 0 (Surface):**
- `0` - Water
- `1` - Heavy forest
- `2` - Light forest
- `3-4` - Grass/fields
- `5` - Mountain
- `6` - Cave entrance
- `7` - Stone/rock
- `8` - Seeded field
- `9` - Growing field
- `10` - Ready field
- `11` - Foundation
- `13` - Building floor
- `14`, `16`, `19` - Transition tiles

**Layer 1 (Underground):**
- `1` - Rock (mineable)
- `2` - Cave exit

**Layer 6 (Resource layer):**
- Tree resources (lumbermill)
- Stone resources (stone mine)
- Field growth state (farm/mill)

**Layer 7 (Ore layer):**
- Ore resources (cave mine)

---

## Performance Considerations

### Optimization Strategies

1. **Work Timers:**
   - Uses `timerManager` when available (centralized timer system)
   - Falls back to `setTimeout` if timer manager not available
   - Timers cleared when serf changes state

2. **Spot Assignment:**
   - Prevents multiple serfs working same tile
   - Spots released when depleted or serf changes work
   - Building resources updated only when needed

3. **Pathfinding:**
   - Pathfinding only triggered when no active path exists
   - Paths preserved through z-level transitions
   - Cooldown prevents rapid z-level transitions

4. **Error Handling:**
   - Try-catch blocks around critical operations
   - Serf reset to safe state on failures
   - Graceful degradation if systems unavailable

5. **Resource Management:**
   - Resource arrays updated only when needed
   - Depleted resources removed immediately
   - New resources discovered incrementally

### Debugging

**SerfLogger** (`server/js/core/SerfLogger.js`):
- Configurable log levels: `DEBUG`, `INFO`, `WARN`, `ERROR`, `NONE`
- Set via `global.SERF_DEBUG_LEVEL`
- Provides structured logging with serf context
- Performance-aware (disabled if level is NONE)

**Usage:**
```javascript
const serfLogger = require('./server/js/core/SerfLogger.js');

serfLogger.debug('Serf starting work', serf);
serfLogger.info('Resource deposited', serf, { resourceType: 'wood', amount: 10 });
serfLogger.warn('Serf stuck', serf, { stuckTime: 60 });
serfLogger.error('Work assignment failed', error, serf);
```

---

## Summary

The serf system is a comprehensive economic unit management system that handles:

1. **Entity Creation**: Serfs spawn with pre-assigned work buildings
2. **Work Assignment**: Dynamic spot assignment from building resource lists
3. **Resource Gathering**: Type-specific work (farming, lumbering, mining)
4. **Resource Deposition**: Wage system (85/15 split for common resources)
5. **Building Construction**: Male serfs build huts
6. **State Management**: Action-based behavior with clear state transitions
7. **Integration**: Seamless integration with Entity system, Houses, and global systems

The system is designed for performance, with centralized behavior handling, efficient spot management, and graceful error handling. Gender restrictions and special features (torch bearers, z-level transitions) add depth to the economic simulation.

