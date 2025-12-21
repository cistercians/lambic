# Faction AI System - Complete Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [HQ Location Selection](#hq-location-selection)
4. [Building Placement System](#building-placement-system)
5. [Goal System](#goal-system)
6. [Territory Management](#territory-management)
7. [Knowledge & Scouting](#knowledge--scouting)
8. [Expansion & Outposts](#expansion--outposts)
9. [Strategic Decision Making](#strategic-decision-making)
10. [Data Flow & Integration](#data-flow--integration)

---

## System Overview

The Faction AI system is a comprehensive decision-making framework that controls all NPC faction behavior in the game. It operates on a daily evaluation cycle, making strategic decisions about resource gathering, building construction, military training, territory expansion, and defensive actions.

### Key Characteristics
- **Daily Evaluation**: AI decisions are made once per in-game day
- **Goal-Driven**: All actions are organized as goals with dependencies
- **Territory-Based**: Dynamic territory calculation based on building positions
- **Fog of War**: Factions only know about areas they've explored
- **Faction-Specific**: Each faction has unique strategic preferences

### Main Entry Point
- **File**: `server/js/Houses.js` (line 243)
- **Function**: `House.evaluateAI()` - Called once per day for all factions
- **Controller**: `server/js/ai/FactionAI.js` - Main AI logic

---

## Core Components

### 1. FactionAI Controller (`server/js/ai/FactionAI.js`)

The central orchestrator that coordinates all faction behavior.

#### Initialization
```javascript
constructor(house) {
  this.house = house;
  this.knowledge = new FactionKnowledge(house);
  this.territory = new TerritoryManager(house);
  this.resourcePlanner = new ResourcePlanner();
  this.currentGoalChain = null;
  this.activeGoals = [];
  this.lastEvaluatedDay = 0;
  this.activeScoutingParties = [];
  this.activeAttackForces = [];
  
  // Load faction-specific strategy
  this.profile = FactionProfiles[house.name] || FactionProfiles.Goths;
  this.strategy = this.loadStrategy();
  
  // Initial territory scan
  this.initialTerritoryScan();
}
```

#### Initial Territory Scan
Performed on AI initialization:
- Scans 15-tile radius around HQ
- Counts resources: forest, rocks, caves, farmland
- Registers significant resource locations in knowledge base
- Marks tiles as explored

#### Daily Evaluation Cycle (`evaluateAndAct()`)

**Called once per in-game day** (line 138):

1. **Territory Update** (lines 148-155)
   - Recalculate base territory boundaries
   - Update patrol building list
   - Update territory knowledge

2. **Goal Chain Continuation** (lines 164-167)
   - If active goal chain exists and incomplete, continue execution
   - Otherwise, evaluate new goals

3. **New Goal Evaluation** (line 170)
   - Strategy modules generate possible goals
   - Goals filtered (utility > 0) and sorted
   - Top goal selected and converted to goal chain

4. **Ongoing Operations** (lines 173-174)
   - Update scouting parties
   - Update attack forces

#### Goal Evaluation Process (`evaluateNewGoals()`)

```javascript
evaluateNewGoals() {
  const possibleGoals = [
    ...this.strategy.evaluateEconomicGoals(),
    ...this.strategy.evaluateMilitaryGoals(),
    ...this.strategy.evaluateExpansionGoals(),
    ...this.strategy.evaluateDefenseGoals()
  ];
  
  const validGoals = possibleGoals.filter(g => g.utility > 0);
  validGoals.sort((a, b) => b.utility - a.utility);
  
  if (validGoals.length > 0) {
    const topGoal = validGoals[0];
    this.currentGoalChain = GoalChain.create(this.house, topGoal);
    this.executeCurrentGoal();
  }
}
```

#### Scouting System

**Deploy Scouting Party** (line 258):
- Selects mounted leader (preferred) or any military unit
- Selects 0-2 backup units
- Creates `ScoutingParty` instance
- Assigns follow behavior to backup units
- Leader marked with 🚩 emoji

**Scouting Party Update** (line 340):
- Updates all active parties each day
- Removes completed/failed parties
- Handles discovery reporting

#### Military System

**Attack Force Assembly** (line 386):
- Determines force size based on threat level:
  - Low: 3 units
  - Medium: 5 units
  - High: 8 units
- Selects strongest available units
- Minimum 3 units required

**Attack Force Deployment** (line 417):
- Sets all units to move to target
- Marks units as combat-ready
- Tracks engagement status

---

## HQ Location Selection

### System: MapAnalyzer (`server/js/ai/MapAnalyzer.js`)

The HQ placement system analyzes the entire map to find optimal starting locations for each faction.

### Placement Process

#### 1. Faction Requirements (`getFactionRequirements()`)

Each faction has specific terrain and location requirements:

| Faction | Layer | Required Terrain | Min % | Radius | Special |
|---------|-------|------------------|-------|--------|---------|
| **Brotherhood** | Underworld (z:-1) | Cave floor (0) | 25% | 10 | - |
| **Goths** | Overworld | 1,2,3,4,7 (flexible) | 1% | 25 | Very flexible |
| **Franks** | Overworld | BRUSH (3) only | 15% | 25 | Brush fields |
| **Celts** | Overworld | Forest (1,2) | 10% | 20 | Prefers caves nearby |
| **Teutons** | Overworld | 1,2,3,4,5,7 | 5% | 25 | Mining priority |
| **Norsemen** | Overworld | Water/Coast (0,7) | 5% | 20 | Coastal |
| **Outlaws** | Overworld | Heavy forest (1) | 10% | 15 | 50-tile spacing |
| **Mercenaries** | Underworld (z:-1) | Cave floor (0) | 30% | 8 | 35-tile spacing |

#### 2. Search Point Generation (`getSearchPointsForFaction()`)

Different factions use different search strategies:

- **Norsemen**: Water spawn points (coastal areas)
- **Franks**: Brush field spawn points
- **Celts**: Forest spawn points (or cave entrances if preferCaves)
- **Outlaws**: Heavy forest spawn points
- **Teutons**: Mixed (overworld + forest + mountain + water + brush)
- **Brotherhood**: Overworld + mountain spawn points
- **Mercenaries**: Forest + brush spawn points

**Critical**: Search points are randomized using Fisher-Yates shuffle to prevent clustering.

#### 3. Location Evaluation (`evaluateHQLocation()`)

For each candidate location:

1. **Boundary Check** (surface factions only)
   - Must be at least 5 tiles from map edge
   - Underground factions skip this (different coordinate space)

2. **Immediate Vicinity Check** (underground only)
   - Checks 3×3 area (9 tiles) around candidate
   - At least 7 of 9 tiles (77%) must be open (cave floor)
   - Prevents spawning in tight tunnels

3. **Terrain Percentage Check**
   - Counts valid terrain in evaluation radius
   - Must meet minimum percentage requirement
   - Calculates terrain distribution

4. **Nearby Feature Check** (if required)
   - Celts: Must have cave within specified distance
   - Other factions: Feature-specific checks

5. **Scoring** (`scoreHQLocationForFaction()`)
   - Farming potential: farmland percentage × priority weight
   - Dense forest: forest percentage × priority weight
   - Mining potential: rocks/mountains × priority weight
   - Cave proximity: inverse distance (max 24 tiles) × priority weight
   - Lumber access: inverse distance to forest (max 12 tiles) × priority weight

#### 4. Spacing Enforcement

- **Default minimum**: 30 tiles between HQs
- **Faction-specific overrides**:
  - Outlaws: 50 tiles
  - Mercenaries: 35 tiles
- Checks distance from all excluded locations before evaluation
- Prevents factions from spawning too close together

#### 5. Selection Process (`findFactionHQ()`)

1. Get faction requirements
2. Generate search points based on terrain preferences
3. **Randomize search points** (Fisher-Yates shuffle)
4. Test up to 500 candidate locations
5. Filter by spacing requirements
6. Evaluate each location
7. Sort by score (highest first)
8. Return best valid location

**Fallback for Celts**: If cave search fails due to spacing, retry with forest-only search.

### Integration Points

- **TilemapSystem**: `findFactionHQ()` method (line 1142)
- **MapAnalyzer**: Primary implementation (`findFactionHQ()` line 169)
- **Genesis**: Called during faction initialization

---

## Building Placement System

### System: BuildingConstructor (`server/js/ai/BuildingConstructor.js`)

Handles all building construction for AI factions, ensuring proper placement and resource management.

### Building Types & Placement Logic

#### 1. Mill (`buildMill()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 40, stone: 20}
- **Requirements**: None
- **Placement**: Uses `tilemapSystem.findBuildingSpot('mill', ...)`
- **Validation**: Excludes occupied tiles (HQ + existing buildings)

#### 2. Farm (`buildFarm()`)
- **Search**: 4 tiles from nearest mill
- **Cost**: {wood: 20}
- **Requirements**: Mill must exist
- **Placement**: Finds mill, searches nearby
- **Special**: Terrain changed to FARM_SEED (8)

#### 3. Mine (`buildMine()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 30, stone: 20}
- **Requirements**: None
- **Placement**: Can be on EMPTY, ROCKS, or MOUNTAIN terrain
- **Validation**: Checks plot validity

#### 4. Lumbermill (`buildLumbermill()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 35, stone: 15}
- **Requirements**: None
- **Placement**: Should be near forest
- **Validation**: Verifies nearby forest (5-tile radius, min 10-12 forest tiles)

#### 5. Forge (`buildForge()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 50, stone: 100}
- **Requirements**: None
- **Placement**: Uses unified construction system
- **Special**: Updates patrol list after construction

#### 6. Garrison (`buildGarrison()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 50, stone: 30}
- **Requirements**: Forge must exist
- **Placement**: Uses unified construction system
- **Special**: Updates patrol list after construction

### Colony System

**Colony Detection**:
- After building construction, checks if building is outside base territory
- Uses `house.isInBaseTerritory(x, y)` to check
- If outside: `building.isColony = true`

**Colony Behavior**:
- Colonies use smaller search radius for serf huts (5 tiles vs base radius)
- Colonies can be absorbed if base expands to include them
- Colony buildings tracked separately in territory manager

### Placement Algorithm

```javascript
buildMill(location = null) {
  const hq = this.house.hq;
  const searchCenter = location || hq;
  const radius = location ? 3 : 10;
  
  // Find suitable location
  const spot = global.tilemapSystem.findBuildingSpot('mill', searchCenter, radius, {
    excludeTiles: this.getOccupiedTiles()
  });
  
  if (!spot) return null;
  
  // Update terrain tiles
  // Create building entity
  // Check if colony
  // Return building ID
}
```

### Occupied Tiles Tracking

`getOccupiedTiles()` returns:
- HQ location
- All existing building plots (all tiles in each building's plot array)

This prevents buildings from overlapping.

---

## Goal System

### System: Goals (`server/js/ai/Goals.js`)

All faction actions are organized as goals with dependencies, costs, and prerequisites.

### Goal Base Class

```javascript
class Goal {
  constructor(type, utility) {
    this.type = type;                    // Goal type identifier
    this.utility = utility;              // 0-100 priority score
    this.resourceCost = {};              // {wood: 50, stone: 30}
    this.buildingRequirements = [];      // ['garrison', 'mill']
    this.prerequisites = [];             // Other goals that must complete first
    this.status = 'PENDING';            // PENDING, IN_PROGRESS, BLOCKED, COMPLETED, FAILED
    this.blockedBy = [];                // What's preventing execution
    this.location = null;               // Where to execute this goal
  }
}
```

### Goal Types

#### Economic Goals

| Goal | Utility | Cost | Requirements | Notes |
|------|---------|------|--------------|-------|
| **BuildMillGoal** | 45 | {wood: 40, stone: 20} | None | Foundation for food production |
| **BuildFarmGoal** | 40 | {wood: 20} | Mill | Requires mill to process grain |
| **BuildMineGoal** | 45 | {wood: 30, stone: 20} | None | Can specify location |
| **BuildLumbermillGoal** | 40 | {wood: 35, stone: 15} | None | Can specify location |
| **BuildForgeGoal** | 40 | {wood: 50, stone: 100} | None | Enables military equipment |
| **BuildGarrisonGoal** | 50 | {wood: 50, stone: 30} | Forge | Military training facility |
| **GatherResourceGoal** | 30 | None | None | Passive - waits for serfs |

#### Military Goals

| Goal | Utility | Cost | Requirements | Notes |
|------|---------|------|--------------|-------|
| **TrainMilitaryGoal** | 50 | {grain: 10/unit} | Garrison | Trains units at garrison |
| **DeployScoutGoal** | 25 | None | None | Sends scout to explore |
| **DefendTerritoryGoal** | 80 | None | None | Triggered when under attack |

#### Expansion Goals

| Goal | Utility | Cost | Requirements | Notes |
|------|---------|------|--------------|-------|
| **EstablishOutpostGoal** | 70 | Varies | 1+ military unit | Multi-step expansion process |

**EstablishOutpostGoal Process**:
1. Deploy scouting party (1-3 units)
2. Scout explores target zone
3. If enemies found: goal blocked
4. If clear: plan outpost construction
5. Build resource building + guard tower
6. Assign serfs to work at outpost
7. Scouting party becomes guards

#### Warfare Goals

| Goal | Utility | Cost | Requirements | Notes |
|------|---------|------|--------------|-------|
| **AttackEnemyGoal** | 60 | None | Garrison | Coordinates military attack |

### Goal Execution

**Can Execute Check** (`canExecute()`):
- Checks building requirements (has building type?)
- Checks resource requirements (has enough resources?)
- Updates `blockedBy` array with blocking factors
- Returns true if no blockers

**Execute Method**:
- Each goal type overrides `execute()`
- Deducts resources from `house.stores`
- Calls `BuildingConstructor` methods
- Updates goal status
- Returns success/failure

---

## Goal Chain System

### System: GoalChain (`server/js/ai/GoalChain.js`)

Automatically resolves goal dependencies by creating executable chains of subgoals.

### Dependency Resolution

**Example Flow**:
```
Goal: Train Military
Blocked by: Need garrison
Chain: [BuildGarrison, GatherGrain, TrainMilitary]

BuildGarrison blocked by resources:
Chain: [GatherWood(50), GatherStone(30), BuildGarrison, GatherGrain(10), TrainMilitary]
```

### Chain Creation Process

```javascript
static create(house, goal) {
  const chain = new GoalChain(goal);
  
  function resolveGoal(g, depth = 0) {
    // Prevent infinite recursion (max depth 10)
    if (depth > 10) return;
    
    // If goal can execute, add it
    if (g.canExecute(house)) {
      chain.steps.push(g);
      return;
    }
    
    // Resolve blocking factors
    const blocking = g.getBlockingFactors(house);
    
    for (const block of blocking) {
      if (block.type === 'BUILDING') {
        // Need to build something first
        const buildGoal = createBuildingGoal(block.value);
        resolveGoal(buildGoal, depth + 1); // Recursive
      } else if (block.type === 'RESOURCE') {
        // Check if resource in territory
        if (canGatherResourceInTerritory(house, block.resource)) {
          // Build gathering building
          const buildingType = getResourceBuildingType(block.resource);
          const buildGoal = createBuildingGoal(buildingType);
          resolveGoal(buildGoal, depth + 1);
        } else {
          // Check adjacent zones for outpost
          const outpostGoal = findResourceInAdjacentZones(house, block.resource);
          if (outpostGoal) {
            resolveGoal(outpostGoal, depth + 1);
          } else {
            // Gather what we can
            const deficit = block.need - block.have;
            chain.steps.push(new GatherResourceGoal(block.resource, deficit));
          }
        }
      }
    }
    
    // Finally add the main goal
    chain.steps.push(g);
  }
  
  resolveGoal(goal);
  chain.steps = chain.removeDuplicates(chain.steps);
  return chain;
}
```

### Chain Execution

**Methods**:
- `getCurrentGoal()` - Returns next goal to execute
- `advance()` - Moves to next goal in chain
- `isComplete()` - Checks if all goals finished
- `getProgress()` - Returns 0-1 progress value

**Duplicate Removal**:
- Tracks last occurrence of each goal type
- Keeps only the last occurrence (avoids redundant goals)

### Resource Resolution Strategy

1. **Check Territory**: Can resource be gathered in current territory?
   - If yes: Create build gathering building goal
   
2. **Check Adjacent Zones**: Is resource in adjacent zones?
   - If yes: Create EstablishOutpostGoal
   
3. **Otherwise**: Create GatherResourceGoal (passive waiting)

---

## Territory Management

### System: TerritoryManager (`server/js/ai/TerritoryManager.js`)

Dynamically calculates and manages faction territory boundaries based on building positions.

### Territory Calculation

**Recalculated Daily** in `updateTerritory()`:

1. **Get All Buildings**: Finds all buildings owned by faction
2. **Calculate Center of Mass**: Average position of all buildings
3. **Calculate Average Distance**: Average distance from center to buildings
4. **Set Territory Radius**: `max(avgDistance * 2, 15 tiles)`
5. **Classify Buildings**:
   - Within radius: Core base buildings
   - Beyond radius: Outpost buildings

### Core Base Structure

```javascript
this.coreBase = {
  center: [c, r],           // Center of mass
  radius: 15,              // Territory radius (minimum 15)
  buildings: [...]          // Buildings within radius
};
```

### Outpost System

**Outpost Detection**:
- Buildings beyond core radius are grouped into outposts
- Outposts are clusters of buildings (within 10 tiles of each other)
- Each outpost tracks: center, buildings, established date

**Outpost Creation**:
- When building is outside core radius:
  1. Find nearest existing outpost (within 10 tiles)
  2. If found: Add building to that outpost
  3. If not: Create new outpost

### Territory Full Check

**Density Calculation**:
```javascript
isTerritoryFull() {
  const buildingCount = this.coreBase.buildings.length;
  const territoryArea = Math.PI * Math.pow(this.coreBase.radius, 2);
  const density = buildingCount / territoryArea;
  
  return density > 0.05; // ~1 building per 20 tiles
}
```

If territory is full, expansion goals are generated.

### Outpost Location Finding

**Search Strategy** (`findOutpostLocation()`):
- Searches 10-30 tiles beyond core radius
- Expands in rings (5-tile increments)
- Scores each candidate location:
  - Resource proximity
  - Terrain quality
  - Distance from HQ (prefers 20-50 tiles)
  - Nearby building count (avoids clustering)

**Scoring** (`scoreOutpostLocation()`):
- Base score: 50 (in target zone)
- Distance from zone center: +20 (closer is better)
- Distance from HQ: +30 (if 20-50 tiles), penalty if too close/far
- Resource proximity: +2 per resource tile
- Terrain bonus: +10 for empty, +5 for brush
- Nearby buildings: -5 per building (avoids clustering)

### Building Spot Finding

**Within Territory** (`findBuildingSpotInTerritory()`):
- Searches outward from preferred distance
- Uses circumference tiles at each radius
- Validates each location with `canPlaceBuildingAt()`

### Territory Zones

**Zone Creation** (`createTerritoryZones()`):
- Creates zone for core base
- Creates zones for each outpost
- Zones include: ID, type, name, tiles, center, bounds, size

---

## Knowledge & Scouting

### System: FactionKnowledge (`server/js/ai/FactionKnowledge.js`)

Implements "fog of war" for AI factions - they only know about areas they've explored.

### Knowledge Storage

```javascript
this.exploredTiles = new Set();        // "x,y" strings
this.knownResources = new Map();        // Resource locations
this.knownEnemies = new Map();          // Enemy sightings
this.lastUpdated = new Map();           // Timestamps
```

### Initial Territory Scan

**On AI Initialization**:
- Scans 15-tile radius around HQ
- Counts resources: forest, rocks, caves, farmland
- Registers significant locations:
  - Caves: High priority (density 20)
  - Forests: Best cluster location
  - Rocks: Best cluster location
- Marks all tiles as explored

### Discovery Reporting

**Scout Reports** (`reportDiscovery()`):
- Resources: location, type, density, discovered timestamp
- Enemies: location, threat level, unit types, discovered timestamp
- Updates explored tiles set
- Stores timestamp for staleness checking

### Resource Location Queries

**Get Best Resource** (`getBestResourceLocation()`):
- Filters by resource type
- Sorts by density (highest first)
- Returns best location

**Get All Locations** (`getAllResourceLocations()`):
- Returns all known locations of resource type
- Used for planning multiple gathering operations

### Resource Gap Detection

**Identify Resource Gap** (`identifyResourceGap()`):
1. Check if resource needed (current < required)
2. Check if resource in territory:
   - Get HQ zone
   - Get adjacent zones within territory radius
   - Check if any zone has resource type
3. Return true if gap exists (needed but not available)

### Enemy Tracking

**Get Enemies in Area** (`getEnemiesInArea()`):
- Filters known enemies by distance from center
- Returns all enemies within radius

**Get Closest Enemy** (`getClosestEnemy()`):
- Finds nearest known enemy to location
- Used for threat assessment

### Staleness Management

**Clean Stale Information** (`cleanStaleInformation()`):
- Removes enemy sightings older than 5 minutes (default)
- Resources persist (they don't move)
- Prevents outdated threat assessments

---

### System: ScoutBehavior (`server/js/ai/ScoutBehavior.js`)

Controls individual scout unit behavior during exploration missions.

### Scouting Party Composition

**Leader Selection**:
- Prefers mounted units (cavalier, cavalry, horseman, knight, mounted)
- Falls back to any military unit
- Leader marked with 🚩 emoji

**Backup Units**:
- Selects 0-2 additional units (flexible)
- Units follow leader using `FollowBehavior`
- All units assigned to `ScoutingParty`

### Mission Flow

1. **Assign Mission** (`assignMission()`):
   - Sets destination and start time
   - Resets discoveries array
   - Sets returning flag to false

2. **Continuous Scanning** (`update()`):
   - Scans area around scout (3-tile radius)
   - Checks for resources and enemies
   - Updates discoveries

3. **Destination Reached** (`reachedDestination()`):
   - Checks if within 2 tiles of destination
   - Triggers return to base

4. **Return to Base** (`returnToBase()`):
   - Sets returning flag
   - Unit moves back to HQ

5. **At Base** (`isAtBase()`):
   - Checks if within 5 tiles of HQ
   - Triggers report filing

6. **File Report** (`fileReport()`):
   - Reports unique discoveries to faction AI
   - Clears mission
   - Resets state

### Discovery Scanning

**Resource Analysis** (`analyzeResourceDensity()`):
- Scans 3-tile radius around scout
- Counts terrain types:
  - Forest (terrain 1, 2)
  - Rocks (terrain 4)
  - Farmland (terrain 7, 3)
  - Caves (terrain 6)
- Caves worth 20× normal value
- Determines primary resource type
- Returns density score

**Enemy Detection** (`getEnemiesAt()`):
- Checks all players at tile location
- Filters by enemy status (different house, in enemies list)
- Returns array of enemy units

**Threat Calculation** (`calculateThreatLevel()`):
- Knight: +30 threat
- Soldier: +20 threat
- Archer: +15 threat
- Other: +10 threat
- Caps at 100
- If threat > 50: Abort mission and return

### Discovery Reporting

**Unique Discoveries** (`getUniqueDiscoveries()`):
- Removes duplicates by location
- Key format: `"type:x,y"`
- Returns unique discoveries only

**Report Format**:
- Resources: type, location, resourceType, density, tiles
- Enemies: type, location, enemies array, threatLevel, tiles

---

## Expansion & Outposts

### System: OutpostPlanner (`server/js/ai/OutpostPlanner.js`)

Plans intelligent placement of resource-gathering buildings and guard towers at expansion locations.

### Outpost Planning Process

**Plan Outpost** (`planOutpost()`):
1. Find candidate locations in target zone
2. Score each candidate
3. Select best location
4. Plan building layout
5. Return construction plan

### Candidate Location Finding

**Find Candidates** (`findCandidateLocations()`):
- Samples every 5th tile in target zone
- Validates each location:
  - Suitable terrain (empty or brush)
  - No existing building
  - Not water
- Returns array of valid candidates

### Location Scoring

**Score Calculation** (`scoreOutpostLocation()`):
- Base score: 50 (in target zone)
- Distance from zone center: +20 (closer is better, max 20)
- Distance from HQ:
  - 20-50 tiles: +30 (optimal)
  - <20 tiles: +20 - distance (too close penalty)
  - >50 tiles: +30 - (distance - 50) (too far penalty)
- Resource proximity: +2 per resource tile (10-tile radius)
- Terrain bonus: +10 for empty, +5 for brush
- Nearby buildings: -5 per building (10-tile radius, avoids clustering)

**Resource Proximity** (`calculateResourceProximity()`):
- Searches 10-tile radius around location
- Stone: +3 for rocks, +5 for caves
- Wood: +2 for forest tiles
- Grain: +1 for farmland
- Iron: +10 for caves

### Building Layout

**Plan Layout** (`planBuildingLayout()`):
1. Resource building at center location
2. Guard tower offset 3-5 tiles:
   - Tries cardinal directions first
   - Then diagonal directions
   - Validates each position
   - Fallback: 2 tiles away

**Building Types**:
- Stone → Quarry
- Wood → Sawmill
- Grain → Farm
- Iron → Mine

### Construction Requirements

**Resource Costs** (`getBuildingRequirements()`):
- Stone: {wood: 50, stone: 20}
- Wood: {wood: 30, stone: 10}
- Grain: {wood: 40, stone: 15}
- Iron: {wood: 60, stone: 25}

**Time Estimates** (`estimateConstructionTime()`):
- Base time: 3-6 minutes depending on resource type
- Adjusted by serf count (2 serfs default)
- Returns estimated seconds

---

## Strategic Decision Making

### System: FactionProfiles (`server/js/ai/FactionProfiles.js`)

Defines strategic preferences and behavior parameters for each faction type.

### Profile Structure

```javascript
{
  economicPriorities: ['farmland', 'stone', 'forest'],
  buildingPreferences: {
    mill: { utility: 50, maxCount: 3 },
    farm: { utility: 45, farmsPerMill: 4 },
    // ...
  },
  militaryStrategy: 'defensive',
  desiredMilitarySize: 8,
  trainingSplit: { infantry: 0.7, ranged: 0.3 },
  expansionStyle: 'moderate',
  minDistanceFromHQ: 15,
  maxOutposts: 2,
  utilityModifiers: {
    BUILD_FARM: 1.2,
    TRAIN_MILITARY: 0.9,
    // ...
  }
}
```

### Faction Profiles

#### Goths
- **Economic**: Farmland, stone, forest
- **Buildings**: Mill (max 3), Farm (4 per mill), Mine, Lumbermill
- **Military**: Defensive, 8 units, 70% infantry
- **Expansion**: Moderate, 15-tile min, max 2 outposts
- **Modifiers**: BUILD_FARM ×1.2, TRAIN_MILITARY ×0.9

#### Celts
- **Economic**: Cave entrance, heavy forest, ore
- **Buildings**: Mine (prefer ore, near cave), Mill (max 2), Farm (3 per mill), **Lumbermill: 0 utility (NEVER builds)**
- **Military**: Guerrilla, 12 units, 50% infantry
- **Expansion**: Isolationist, 25-tile min, max 1 outpost
- **Modifiers**: BUILD_MINE ×1.5, BUILD_LUMBERMILL ×0, TRAIN_MILITARY ×1.2

#### Teutons
- **Economic**: Ore, stone, forest
- **Buildings**: Mine (prefer ore), Lumbermill, Garrison (high priority), Mill (max 2)
- **Military**: Aggressive, 15 units, 80% infantry
- **Expansion**: Aggressive, 10-tile min, max 3 outposts
- **Modifiers**: BUILD_GARRISON ×1.3, TRAIN_MILITARY ×1.4, ATTACK_ENEMY ×1.5

#### Franks
- **Economic**: Farmland, forest, stone
- **Buildings**: Mill (max 4), Farm (5 per mill - best farmers), Lumbermill
- **Military**: Balanced, 10 units, 60% infantry
- **Expansion**: Balanced, 12-tile min, max 2 outposts
- **Modifiers**: BUILD_FARM ×1.5, BUILD_MILL ×1.3

#### Norsemen
- **Economic**: Forest, stone, farmland
- **Buildings**: Lumbermill (high priority), Mine, Garrison
- **Military**: Raiding, 12 units, 70% infantry
- **Expansion**: Aggressive, 12-tile min, max 3 outposts
- **Modifiers**: BUILD_LUMBERMILL ×1.4, TRAIN_MILITARY ×1.3

#### Brotherhood
- **Economic**: Farmland, stone, forest
- **Buildings**: Mill (max 2), Farm (3 per mill), Mine, Garrison
- **Military**: Defensive, 10 units, 50% infantry
- **Expansion**: Defensive, 20-tile min, max 1 outpost
- **Modifiers**: BUILD_GARRISON ×1.2, DEFEND_TERRITORY ×1.5

#### Outlaws
- **Economic**: Forest, cave entrance, stone
- **Buildings**: Lumbermill, Mine, Garrison, Mill (max 1)
- **Military**: Opportunistic, 8 units, 60% infantry
- **Expansion**: Opportunistic, 15-tile min, max 2 outposts
- **Modifiers**: ATTACK_ENEMY ×1.3, BUILD_LUMBERMILL ×1.2

#### Mercenaries
- **Economic**: Stone, ore, forest
- **Buildings**: Mine (prefer ore), Garrison (high priority), Lumbermill
- **Military**: Mercenary, 15 units, 70% infantry
- **Expansion**: Opportunistic, 10-tile min, max 2 outposts
- **Modifiers**: BUILD_GARRISON ×1.4, TRAIN_MILITARY ×1.5, ATTACK_ENEMY ×1.4

---

### System: FactionStrategy (`server/js/ai/strategies/FactionStrategy.js`)

Base class for faction-specific strategic evaluation. Each faction extends this to customize behavior.

### Evaluation Methods

#### Economic Goals (`evaluateEconomicGoals()`)
```javascript
evaluateEconomicGoals() {
  const goals = [];
  
  // Check mills
  const mills = this.countBuildingType('mill');
  const maxMills = this.profile.buildingPreferences.mill.maxCount || 2;
  if (mills < maxMills && this.shouldBuildBuilding('mill')) {
    goals.push(this.modifyGoalUtility(new BuildMillGoal()));
  }
  
  // Check farms
  const farms = this.countBuildingType('farm');
  const farmsPerMill = this.profile.buildingPreferences.farm.farmsPerMill || 3;
  if (mills > 0 && farms / mills < farmsPerMill && this.shouldBuildBuilding('farm')) {
    goals.push(this.modifyGoalUtility(new BuildFarmGoal()));
  }
  
  return goals;
}
```

#### Military Goals (`evaluateMilitaryGoals()`)
- Checks if garrison needed
- Checks military size vs desired size
- Checks exploration progress (if <100 tiles explored, deploy scout)

#### Expansion Goals (`evaluateExpansionGoals()`)
- Checks if territory is full
- Finds outpost location
- Creates EstablishOutpostGoal if suitable

#### Defense Goals (`evaluateDefenseGoals()`)
- Checks if under attack
- Creates DefendTerritoryGoal if needed

### Utility Modification

**Apply Faction Modifiers** (`modifyGoalUtility()`):
```javascript
modifyGoalUtility(goal) {
  const modifier = this.profile.utilityModifiers[goal.type] || 1.0;
  goal.utility *= modifier;
  return goal;
}
```

This allows factions to prioritize certain goals:
- Celts: BUILD_MINE ×1.5 (prioritizes mining)
- Goths: BUILD_FARM ×1.2 (prioritizes farming)
- Teutons: ATTACK_ENEMY ×1.5 (more aggressive)

### Faction-Specific Strategies

Each faction has its own strategy file that extends `FactionStrategy`:
- `CeltsStrategy.js` - Never builds lumbermills
- `TeutonsStrategy.js` - Prioritizes military
- `FranksStrategy.js` - Optimizes farming
- etc.

---

## Resource Planning

### System: ResourcePlanner (`server/js/ai/ResourcePlanner.js`)

Plans resource acquisition to meet goal requirements and estimates production capabilities.

### Planning Methods

#### Plan for Goal (`planForGoal()`)
```javascript
planForGoal(house, goal) {
  if (goal.canExecute(house)) {
    return { ready: true, subgoals: [] };
  }
  
  const subgoals = [];
  
  for (const block of goal.blockedBy) {
    if (block.type === 'RESOURCE') {
      const deficit = block.need - block.have;
      subgoals.push(new GatherResourceGoal(block.resource, deficit));
    } else if (block.type === 'BUILDING') {
      subgoals.push(createBuildingGoal(block.value));
    }
  }
  
  return { ready: false, subgoals };
}
```

#### Estimate Gather Time (`estimateGatherTime()`)
```javascript
estimateGatherTime(house, resources) {
  const rates = this.calculateProductionRates(house);
  let maxDays = 0;
  
  for (const [resource, amount] of Object.entries(resources)) {
    const rate = rates[resource] || 0;
    if (rate > 0) {
      const time = amount / rate;
      maxDays = Math.max(maxDays, time);
    } else {
      return Infinity; // Can't produce this resource
    }
  }
  
  return Math.ceil(maxDays);
}
```

### Production Rate Calculation

**Base Rates**:
- Lumbermill: 5 wood/day
- Mine: 4 stone/day
- Farm: 3 grain/day
- Mine (ore): 2 ironore/day

**Serf Bonus**:
- Each serf adds +0.5 to all resource production rates

**Calculation**:
```javascript
calculateProductionRates(house) {
  const buildings = this.getBuildingsByHouse(house);
  const serfs = this.getSerfsByHouse(house);
  
  const rates = {
    wood: this.countBuildingType(buildings, 'lumbermill') * 5,
    stone: this.countBuildingType(buildings, 'mine') * 4,
    grain: this.countBuildingType(buildings, 'farm') * 3,
    ironore: this.countBuildingType(buildings, 'mine') * 2
  };
  
  const serfBonus = serfs.length * 0.5;
  rates.wood += serfBonus;
  rates.stone += serfBonus;
  rates.grain += serfBonus;
  
  return rates;
}
```

### Affordability Check

**Can Afford** (`canAfford()`):
- Checks if house has all required resources
- Returns false if any resource is insufficient

**Calculate Deficit** (`calculateDeficit()`):
- Compares current resources to required
- Returns object with only shortfalls (positive values)

---

## Data Flow & Integration

### Daily Update Cycle

```
Game Loop (Daily)
  ↓
House.evaluateAI() [Houses.js:243]
  ↓
FactionAI.evaluateAndAct() [FactionAI.js:138]
  ↓
  ├─→ TerritoryManager.updateTerritory()
  ├─→ house.updatePatrolList()
  ├─→ knowledge.cleanStaleInformation()
  │
  ├─→ IF currentGoalChain exists:
  │     └─→ executeCurrentGoal()
  │
  └─→ ELSE:
        ├─→ strategy.evaluateEconomicGoals()
        ├─→ strategy.evaluateMilitaryGoals()
        ├─→ strategy.evaluateExpansionGoals()
        ├─→ strategy.evaluateDefenseGoals()
        │
        ├─→ Filter & sort goals by utility
        ├─→ GoalChain.create(topGoal)
        │     └─→ Recursively resolve dependencies
        │
        └─→ executeCurrentGoal()
              ├─→ goal.canExecute()
              ├─→ goal.execute()
              │     ├─→ BuildingConstructor.buildX()
              │     │     └─→ tilemapSystem.findBuildingSpot()
              │     │     └─→ Create building entity
              │     │
              │     └─→ Deduct resources
              │
              └─→ goalChain.advance()
```

### Integration Points

#### House Integration (`server/js/Houses.js`)
- **Line 243**: `House.evaluateAI()` - Daily evaluation entry point
- **Line 27**: `calculateBaseTerritory()` - Territory calculation
- **Line 95**: `isInBaseTerritory()` - Colony detection
- **Line 107**: `updatePatrolList()` - Patrol building tracking

#### Tilemap System Integration
- `tilemapSystem.findBuildingSpot()` - Building placement validation
- `tilemapSystem.findFactionHQ()` - Initial HQ placement
- `tilemapSystem.countNearbyTerrain()` - Resource proximity checks

#### Building System Integration
- Building entities created via constructors (Mill, Farm, etc.)
- Buildings track: `house`, `owner`, `plot`, `isColony`
- Building list: `Building.list[id]`

#### Player/Unit Integration
- Military units: `Player.list` filtered by `house` and `military` flag
- Serfs: Filtered by class (`SerfM`, `SerfF`)
- Scout behavior: Units assigned `scoutingParty` property

### Error Handling

**Daily Evaluation**:
```javascript
House.evaluateAI = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.ai && house.ai.evaluateAndAct){
      try {
        house.ai.evaluateAndAct();
      } catch (error) {
        // Silently handle errors to prevent one faction from breaking others
      }
    }
  }
}
```

### State Management

**Non-Enumerable Properties**:
- `house.ai` - FactionAI instance (not serialized)
- `house.buildingConstructor` - BuildingConstructor instance (not serialized)

This prevents AI state from being saved/loaded, ensuring fresh evaluation on game load.

---

## Key Design Patterns

### 1. Strategy Pattern
- Base `FactionStrategy` class defines evaluation structure
- Each faction extends with custom behavior
- Allows different strategic approaches per faction

### 2. Chain of Responsibility
- `GoalChain` resolves dependencies automatically
- Each goal can be blocked, creating subgoals
- Recursive resolution ensures all prerequisites met

### 3. Observer Pattern
- Scouts report discoveries to `FactionKnowledge`
- Knowledge system updates explored tiles and resources
- AI reacts to new information

### 4. Factory Pattern
- `GoalChain.create()` builds dependency chains
- `createBuildingGoal()` creates goal instances
- `BuildingConstructor` creates building entities

### 5. Template Method
- Base strategy defines evaluation structure
- Faction strategies override specific methods
- Consistent interface with customizable behavior

---

## Performance Considerations

### Daily Evaluation Limits
- Only one evaluation per day (tracked by `lastEvaluatedDay`)
- Prevents duplicate evaluations
- Error handling prevents one faction from blocking others

### Search Optimization
- HQ placement: Tests up to 500 locations (not entire map)
- Building placement: Expanding radius search (stops when found)
- Outpost finding: Samples every 5th tile (not exhaustive)

### Caching
- `MapAnalyzer.analysisCache` - Caches map analysis
- `TerritoryManager` - Recalculates only when needed
- `FactionKnowledge` - Persistent knowledge (no recalculation)

### Memory Management
- Stale enemy information cleaned (5-minute TTL)
- Completed scouting parties removed
- Completed attack forces removed

---

## Future Expansion Points

### Potential Enhancements
1. **Diplomacy System**: Faction relationships, alliances, trade
2. **Advanced Military**: Formation tactics, siege warfare
3. **Economic Trading**: Inter-faction resource trading
4. **Technology Tree**: Research and upgrades
5. **Dynamic Difficulty**: AI adapts to player strength
6. **Multi-Objective Planning**: Multiple goals in parallel
7. **Predictive Planning**: Anticipate future resource needs

### Extension Points
- New goal types: Add to `Goals.js`
- New building types: Add to `BuildingConstructor.js`
- New faction types: Add profile to `FactionProfiles.js` and strategy file
- New evaluation criteria: Extend `FactionStrategy` methods

---

## Summary

The Faction AI system is a sophisticated, goal-driven architecture that:

1. **Evaluates daily** to make strategic decisions
2. **Resolves dependencies** automatically through goal chains
3. **Manages territory** dynamically based on building positions
4. **Explores the map** through scouting parties
5. **Expands strategically** through outpost establishment
6. **Adapts per faction** through strategy modules and profiles
7. **Tracks knowledge** with fog of war system
8. **Plans resources** to meet goal requirements

The system is modular, extensible, and designed to create believable, strategic NPC faction behavior that adapts to the game state while maintaining faction-specific characteristics.
