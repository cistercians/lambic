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
10. [Caching & Performance](#caching--performance)
11. [Error Handling & Validation](#error-handling--validation)
12. [Data Flow & Integration](#data-flow--integration)

---

## System Overview

The Faction AI system is a comprehensive, optimized decision-making framework that controls all NPC faction behavior in the game. It operates on a daily evaluation cycle, making strategic decisions about resource gathering, building construction, military training, territory expansion, and defensive actions.

### Key Characteristics
- **Daily Evaluation**: AI decisions are made once per in-game day (prevented from running multiple times per day)
- **Goal-Driven**: All actions are organized as goals with dependencies that are automatically resolved
- **Goal Chain Persistence**: Goal chains persist indefinitely until complete or failed (not recreated daily)
- **Territory-Based**: Dynamic territory calculation based on building positions with intelligent caching
- **Fog of War**: Factions only know about areas they've explored (FactionKnowledge system)
- **Faction-Specific**: Each faction has unique strategic preferences via Strategy pattern
- **Optimized Caching**: Multiple caching layers for performance (buildings, military units, territory)
- **Fail-Fast Validation**: Service initialization validation ensures errors are caught early
- **Structured Error Handling**: All errors include context (faction, goal type, step, timestamp)

### Architecture Components

The system is organized into focused, single-responsibility components:

1. **FactionAI** (`server/js/ai/FactionAI.js`) - Main orchestrator, coordinates all subsystems
2. **GoalChain** (`server/js/ai/GoalChain.js`) - Iterative dependency resolution for goals
3. **GoalExecutor** (`server/js/ai/GoalExecutor.js`) - Handles goal execution logic
4. **BuildingService** (`server/js/ai/BuildingService.js`) - Single source of truth for building queries with caching
5. **TerritoryManager** (`server/js/ai/TerritoryManager.js`) - Dynamic territory calculation and management
6. **MilitaryManager** (`server/js/ai/MilitaryManager.js`) - Scouting parties and attack forces
7. **FactionKnowledge** (`server/js/ai/FactionKnowledge.js`) - Fog of war and exploration tracking
8. **Goals** (`server/js/ai/Goals.js`) - Goal type definitions and execution
9. **FactionStrategy** (`server/js/ai/strategies/`) - Faction-specific strategic evaluation

### Main Entry Point
- **File**: `server/js/Houses.js` (line 239)
- **Function**: `House.evaluateAI()` - Called once per day for all factions
- **Controller**: `server/js/ai/FactionAI.js` - Main AI logic orchestrator

### System Architecture

```
House.evaluateAI() [Houses.js]
    ↓
FactionAI [Orchestrator]
    ├─→ FactionKnowledge [Knowledge & Exploration]
    │     └─→ Initial territory scan (constructor)
    │     └─→ Discovery tracking
    │
    ├─→ TerritoryManager [Territory Calculation]
    │     └─→ Uses BuildingService for building queries
    │     └─→ Hash-based caching
    │
    ├─→ BuildingService [Building Queries]
    │     └─→ Per-day caching (O(1) when cached)
    │     └─→ Single source of truth
    │
    ├─→ MilitaryManager [Military Operations]
    │     └─→ Scouting parties
    │     └─→ Attack forces
    │     └─→ Delegates to FactionAI for military units
    │
    ├─→ GoalExecutor [Goal Execution]
    │     └─→ Structured error handling
    │     └─→ Execution flow control
    │
    ├─→ GoalChain [Dependency Resolution]
    │     └─→ Iterative queue-based resolution
    │     └─→ Blocking factor caching
    │     └─→ Resolution path tracing
    │
    └─→ FactionStrategy [Strategic Evaluation]
          └─→ Faction-specific goal generation
          └─→ Uses BuildingService for building counts
```

**Data Flow**:
- Building queries → BuildingService (cached)
- Military queries → FactionAI.getMilitaryUnits() (cached)
- Territory queries → TerritoryManager (hash-cached)
- Goal execution → GoalExecutor → Goals → BuildingConstructor
- Knowledge updates → FactionKnowledge (persistent)

---

## Core Components

### 1. FactionAI Controller (`server/js/ai/FactionAI.js`)

The central orchestrator that coordinates all faction behavior. Delegates specific responsibilities to specialized services.

#### Initialization
```javascript
constructor(house) {
  this.house = house;
  this.knowledge = new FactionKnowledge(house);        // Knowledge & exploration
  this.territory = new TerritoryManager(house);        // Territory calculation
  this.buildingService = new BuildingService(house);   // Building queries (cached)
  this.militaryManager = new MilitaryManager(house, this); // Military operations
  this.goalExecutor = new GoalExecutor(house, this);    // Goal execution
  this.currentGoalChain = null;                        // Active goal chain (persists)
  this.lastEvaluatedDay = 0;                           // Prevent duplicate evaluations
  
  // Caching for expensive operations
  this._cachedMilitaryUnits = null;
  this._cachedMilitaryUnitsDay = 0;
  
  // Load faction-specific strategy
  this.profile = FactionProfiles[house.name] || FactionProfiles.Goths;
  this.strategy = this.loadStrategy();
  
  // Initial territory scan performed automatically by FactionKnowledge constructor
  
  // Validate all services after creation (fail fast if initialization failed)
  this.validateServices();
}
```

#### Service Validation
All services are validated after initialization to catch errors early:
- Checks that each service instance exists
- Verifies each service is correct type (instanceof check)
- Throws structured error with timestamp and faction name if validation fails
- Prevents silent failures during execution

#### Initial Territory Scan
**Location**: Performed automatically in `FactionKnowledge` constructor (not in FactionAI)
- Scans 15-tile radius around HQ
- Counts resources: forest, rocks, caves, farmland
- Registers significant resource locations in knowledge base
- Marks tiles as explored
- This is knowledge gathering, so it belongs in FactionKnowledge

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
  // Delegate to faction-specific strategy
  const possibleGoals = [
    ...this.strategy.evaluateEconomicGoals(),
    ...this.strategy.evaluateMilitaryGoals(),
    ...this.strategy.evaluateExpansionGoals(),
    ...this.strategy.evaluateDefenseGoals()
  ];
  
  // Filter out goals with 0 utility
  const validGoals = possibleGoals.filter(g => g.utility > 0);
  
  // Sort by utility (highest first)
  validGoals.sort((a, b) => b.utility - a.utility);
  
  if (validGoals.length > 0) {
    const topGoal = validGoals[0];
    
    // Create goal chain to resolve dependencies (iterative queue-based)
    this.currentGoalChain = GoalChain.create(this.house, topGoal);
    
    // Validate chain after creation
    if (this.currentGoalChain.errors && this.currentGoalChain.errors.length > 0) {
      // Log errors but continue (chain may still be usable)
    }
    
    // Check if chain has steps (empty chain means goal is immediately executable)
    if (this.currentGoalChain.steps.length === 0) {
      // Try executing goal directly if it can execute
      if (topGoal.canExecute(this.house)) {
        try {
          topGoal.execute(this.house);
          topGoal.status = 'COMPLETED';
        } catch (error) {
          // Log error and mark as failed
        }
      }
      this.currentGoalChain = null;
      return;
    }
    
    // Execute first goal in chain
    this.executeCurrentGoal();
  }
}
```

#### Goal Execution (`executeCurrentGoal()`)

Delegates to `GoalExecutor` for execution logic:
- Gets current goal from chain
- Delegates execution to `goalExecutor.executeGoal()`
- Handles chain advancement or clearing based on result
- Separates execution logic from chain management

#### Scouting System

**Deploy Scouting Party** (line 258):
- Delegates to `MilitaryManager.deployScoutingParty()`
- See MilitaryManager section for details

**Scouting Party Update**:
- Delegates to `MilitaryManager.updateScoutingParties()`
- See MilitaryManager section for details

#### Military System

All military operations are handled by `MilitaryManager`:
- Scouting party management
- Attack force assembly and deployment
- Unit selection logic
- See MilitaryManager section for details

---

### 2. BuildingService (`server/js/ai/BuildingService.js`)

Single source of truth for all building-related queries with intelligent per-day caching.

#### Purpose
- Centralizes building access to prevent duplication
- Provides consistent building queries across the system
- Implements efficient caching to avoid redundant Building.list iterations
- Fails fast if not properly initialized (no fallback paths)

#### Initialization
```javascript
constructor(house) {
  this.house = house;
  this._cachedBuildings = null;           // Cached building list
  this._cachedBuildingCounts = {};        // Cached counts by type
  this._cacheDay = 0;                     // Day when cache was created
  this._debug = false;                    // Optional debug logging
}
```

#### Caching Strategy

**Per-Day Caching**:
- All caches are invalidated when `global.day` changes
- Building list cached after first access
- Building counts cached individually by type
- O(1) lookups when cached, O(n) only on cache miss

**Cache Optimization**:
- `getBuildingCount()` checks count cache first before fetching all buildings
- Only calls `getBuildings()` if count cache miss
- Prevents unnecessary full building list iteration

#### API Methods

**getBuildings()**:
- Returns all buildings owned by house (built only)
- Cached per day
- Optional debug logging for cache hits/misses

**getBuildingCount(buildingType)**:
- Returns count of buildings by type
- Optimized: checks count cache first (O(1) when cached)
- Only fetches full building list on cache miss (O(n))
- Example: `house.ai.buildingService.getBuildingCount('mill')`

**hasBuildingType(buildingType)**:
- Returns true if house has at least one building of type
- Uses `getBuildingCount()` internally

**getBuildingsByType(buildingType)**:
- Returns array of buildings matching type
- Uses cached `getBuildings()` internally

**getFirstBuildingOfType(buildingType)**:
- Returns first building of type or null
- Uses `getBuildingsByType()` internally

**invalidateCache()**:
- Manually invalidates all caches
- Useful when buildings are added/removed outside normal flow

**setDebug(enabled)**:
- Enables/disables debug logging for cache operations
- Logs cache hits, misses, and cache updates
- Useful for performance debugging

#### Integration

All building access throughout the system goes through BuildingService:
- `Goals.js` - Uses BuildingService for requirement checks
- `TerritoryManager.js` - Uses BuildingService for building queries
- `FactionStrategy.js` - Uses BuildingService for building counts
- `ResourcePlanner.js` - Uses BuildingService for production calculations

**Fail-Fast Approach**:
- No fallback to direct Building.list access
- Throws error if BuildingService unavailable
- Indicates initialization bug, not recoverable error

---

### 3. GoalExecutor (`server/js/ai/GoalExecutor.js`)

Handles goal execution logic, separate from chain management. Provides structured error handling and execution flow control.

#### Purpose
- Separates execution logic from chain management
- Provides consistent error formatting
- Handles blocked goals intelligently
- Returns structured results for chain advancement

#### Initialization
```javascript
constructor(house, factionAI) {
  this.house = house;
  this.factionAI = factionAI;
}
```

#### Execution Flow

**executeGoal(goal, goalChain)**:
1. Validates goal exists
2. Checks if goal can execute
3. Routes to appropriate handler:
   - `executeExecutableGoal()` - Goal can execute
   - `handleBlockedGoal()` - Goal is blocked

**Returns structured result**:
```javascript
{
  success: boolean,           // Whether execution succeeded
  shouldAdvance: boolean,    // Whether to advance to next goal
  shouldClearChain: boolean  // Whether to clear the chain
}
```

#### Executable Goal Execution

**executeExecutableGoal(goal, goalChain)**:
- Executes goal in try-catch block
- Marks goal as COMPLETED on success
- On error: creates structured error object, logs with context, marks goal as FAILED
- Returns success result with shouldAdvance=true

#### Blocked Goal Handling

**handleBlockedGoal(goal, goalChain)**:
- Special handling for GATHER_RESOURCE goals (passive waiting)
- For other goals: logs detailed blocking information
- Creates structured error with:
  - Timestamp
  - Faction name
  - Goal type
  - Step number
  - Blocking details (resources/buildings)
- Marks goal as FAILED (indicates chain resolution issue)
- Returns failure result

#### Error Formatting

**formatError(faction, goalType, step, message, details)**:
- Creates consistent error structure:
```javascript
{
  timestamp: ISO string,
  faction: string,
  goalType: string,
  step: number | null,
  message: string,
  details: object
}
```

All errors logged with format: `[GoalExecutor] [timestamp] [faction] [goalType] [step] message`

---

### 4. MilitaryManager (`server/js/ai/MilitaryManager.js`)

Handles all military operations: scouting parties, attack forces, and unit selection.

#### Purpose
- Encapsulates all military-related AI logic
- Manages active scouting parties and attack forces
- Handles unit selection for missions
- Delegates military unit queries to FactionAI (for caching)

#### Initialization
```javascript
constructor(house, factionAI) {
  this.house = house;
  this.factionAI = factionAI;
  this.activeAttackForces = [];
}
```

#### Scouting Party Management

**deployScoutingParty(targetZone, resourceType)**:
1. Selects scout leader (prefers mounted units)
2. Selects 0-2 backup units
3. Creates `ScoutingParty` instance
4. Assigns follow behavior to backup units
5. Marks leader with 🚩 emoji
6. Returns party instance or null if no units available

**selectScoutLeader()**:
- Prefers mounted units (cavalier, cavalry, horseman, knight, mounted)
- Falls back to any military unit
- Returns null if no military units available

**selectBackupUnits(count, excludeLeader)**:
- Selects up to `count` units (typically 2)
- Excludes leader from selection
- Returns array (may be empty if insufficient units)

**updateScoutingParties()**:
- Updates all active scouting parties each day
- Removes completed/failed parties
- Handles discovery reporting to FactionKnowledge
- Calls completion/failure callbacks

**onScoutingComplete(targetZone, purpose, enemiesFound)**:
- If enemies found: plans attack force
- If clear: plans outpost via `factionAI.planOutpost()`

**onScoutingFailed(targetZone, purpose)**:
- Handles scouting failure (unit died, threat too high, etc.)
- Logs failure for debugging

#### Attack Force Management

**planAttackForce(targetZone)**:
- Determines threat level
- Plans appropriate force size

**assembleAttackForce(targetLocation, threatLevel)**:
- Determines force size based on threat:
  - Low: 3 units
  - Medium: 5 units
  - High: 8 units
- Selects strongest available units
- Minimum 3 units required

**deployAttackForce(force, targetZone)**:
- Sets all units to move to target
- Marks units as combat-ready
- Tracks engagement status

**updateAttackForces()**:
- Updates all active attack forces each day
- Removes completed/failed forces
- Handles engagement status

#### Unit Selection

**getMilitaryUnits()**:
- Always delegates to `FactionAI.getMilitaryUnits()` for caching
- No fallback (fails fast if FactionAI unavailable)
- Single source of truth for military units

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
    this.status = 'PENDING';            // PENDING, IN_PROGRESS, BLOCKED, COMPLETED, FAILED
    this.blockedBy = [];                // What's preventing execution (updated by canExecute)
    this.location = null;               // Where to execute this goal
    this.error = null;                  // Error object if execution failed
  }
}
```

**Note**: The `prerequisites` field was removed - dependencies are handled by GoalChain resolution instead.

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

**Can Execute Check** (`canExecute(house)`):
- Checks building requirements using `BuildingService.hasBuildingType()`
- Checks resource requirements (compares `house.stores` to `resourceCost`)
- Updates `blockedBy` array with blocking factors:
  - `{ type: 'BUILDING', value: 'garrison' }` for missing buildings
  - `{ type: 'RESOURCE', resource: 'wood', have: 10, need: 50 }` for insufficient resources
- Returns true if no blockers
- **Fails fast** if BuildingService unavailable (no fallback)

**Get Blocking Factors** (`getBlockingFactors(house)`):
- Calls `canExecute()` internally to update `blockedBy`
- Returns the `blockedBy` array
- Used by GoalChain for dependency resolution

**Execute Method**:
- Each goal type overrides `execute(house)`
- Deducts resources from `house.stores` (validates first)
- Calls `BuildingConstructor` methods via `getBuildingConstructor(house)`
- Updates goal status to COMPLETED or FAILED
- Throws errors with actionable messages (e.g., "need 40 wood (have 10)")

---

## Goal Chain System

### System: GoalChain (`server/js/ai/GoalChain.js`)

Automatically resolves goal dependencies by creating executable chains of subgoals using an **iterative queue-based approach** (not recursive) for better traceability and debugging.

### Key Features

- **Iterative Resolution**: Queue-based processing instead of recursion
- **Context-Aware Cycle Detection**: Tracks goal type + blocking context to prevent false positives
- **Blocking Factor Caching**: Avoids redundant `canExecute()` calls
- **Resolution Path Tracing**: Full dependency resolution path logged for debugging
- **Goal Chain Persistence**: Chains persist indefinitely until complete or failed (not recreated daily)
- **Maximum Depth**: 5 levels (reduced from 10 for safety)

### Dependency Resolution

**Example Flow**:
```
Goal: Train Military
Blocked by: Need garrison
Chain: [BuildGarrison, GatherGrain, TrainMilitary]

BuildGarrison blocked by resources:
Chain: [GatherWood(50), GatherStone(30), BuildGarrison, GatherGrain(10), TrainMilitary]
```

### Chain Creation Process (Iterative Queue-Based)

```javascript
static create(house, goal) {
  const chain = new GoalChain(goal);
  const errors = [];
  const resolutionPath = []; // Track dependency resolution path
  
  // Queue of goals to process: {goal, parent, depth, reason}
  const queue = [{ goal, parent: null, depth: 0, reason: 'main goal' }];
  
  // Track visited goals with context to prevent cycles
  // Key: goal type + blocking context (e.g., "BUILD_GARRISON:for-TRAIN_MILITARY")
  const visited = new Map();
  
  // Track blocking factors cache to avoid redundant canExecute() calls
  const blockingCache = new Map();
  
  // Process queue iteratively
  while (queue.length > 0) {
    const { goal: g, parent, depth, reason } = queue.shift();
    
    // Prevent infinite loops (max depth 5)
    if (depth > 5) {
      errors.push(`Maximum depth (5) reached resolving ${g.type}`);
      continue;
    }
    
    // Create context key for cycle detection
    const contextKey = parent ? `${g.type}:for-${parent.type}` : g.type;
    
    // Prevent cycles - check if we've seen this goal in this context
    if (visited.has(contextKey)) {
      continue; // Already processed
    }
    visited.set(contextKey, { goal: g, parent, depth, reason });
    
    // Check if goal can execute (cache blocking factors)
    let blocking;
    const cacheKey = `${g.type}:${house.id}`;
    if (blockingCache.has(cacheKey)) {
      blocking = blockingCache.get(cacheKey);
    } else {
      blocking = g.getBlockingFactors(house);
      blockingCache.set(cacheKey, blocking);
    }
    
    if (blocking.length === 0) {
      // Goal can execute - add it directly
      chain.steps.push(g);
      continue;
    }
    
    // Goal is blocked - resolve blocking factors
    for (const block of blocking) {
      if (block.type === 'BUILDING') {
        const buildGoal = createBuildingGoal(block.value);
        if (buildGoal) {
          queue.push({
            goal: buildGoal,
            parent: g,
            depth: depth + 1,
            reason: `needs building: ${block.value}`
          });
        }
      } else if (block.type === 'RESOURCE') {
        const buildingType = chain.getResourceBuildingType(block.resource);
        if (buildingType) {
          const buildGoal = createBuildingGoal(buildingType);
          if (buildGoal) {
            queue.push({
              goal: buildGoal,
              parent: g,
              depth: depth + 1,
              reason: `needs resource: ${block.resource} (requires ${buildingType})`
            });
          }
        }
        
        // Add gather goal to wait for resources
        const deficit = block.need - block.have;
        if (deficit > 0) {
          chain.steps.push(new GatherResourceGoal(block.resource, block.need));
        }
      }
    }
    
    // Finally add the main goal (after its dependencies)
    chain.steps.push(g);
  }
  
  // Remove duplicates (keep last occurrence)
  chain.steps = chain.removeDuplicates(chain.steps);
  
  // Store errors and resolution path for debugging
  if (errors.length > 0) {
    chain.errors = errors;
  }
  chain.resolutionPath = resolutionPath; // Always stored for debugging
  
  return chain;
}
```

### Chain Execution

**Methods**:
- `getCurrentGoal()` - Returns next goal to execute (or null if complete)
- `advance()` - Moves to next goal in chain, returns true if more steps remain
- `isComplete()` - Checks if all goals finished (`currentStep >= steps.length`)
- `isFailed()` - Checks if chain has failed (current goal failed or any prerequisite failed)
- `getProgress()` - Returns 0-1 progress value (`currentStep / steps.length`)
- `getSummary()` - Returns summary object with main goal, steps, progress, remaining

**Duplicate Removal**:
- Single-pass algorithm: tracks last index of each goal type
- Keeps only the last occurrence (later goals may have updated requirements)
- O(n) time complexity

### Goal Chain Persistence

**Key Behavior**: Goal chains persist indefinitely until complete or failed
- Chains are **not** recreated daily
- Only create new chain when:
  - Current chain is complete (`isComplete()` returns true)
  - Current chain has failed (`isFailed()` returns true)
  - No chain exists (first evaluation or after clearing)

**Chain Lifecycle**:
1. Chain created when new goal selected
2. Chain persists across days, executing one goal per day
3. Chain advances after each successful goal execution
4. Chain cleared when complete or failed
5. New chain created only after clearing

This prevents unnecessary re-evaluation and ensures goals are completed even if they take multiple days.

### Resolution Path Tracing

Each chain stores a `resolutionPath` array documenting the dependency resolution process:
```javascript
{
  goal: 'BUILD_GARRISON',
  depth: 0,
  reason: 'main goal',
  parent: null,
  canExecute: false,
  blocking: [
    { type: 'RESOURCE', value: 'wood', need: 50, have: 10 },
    { type: 'BUILDING', value: 'forge' }
  ]
}
```

This enables debugging of complex dependency chains and understanding why certain goals were selected.

### Resource Resolution Strategy

1. **Check Building Type**: Maps resource to required building type
   - stone → quarry
   - wood → lumbermill
   - grain → farm
   - iron → mine

2. **Build Gathering Building**: If building type exists, create build goal
   - Added to queue for resolution
   - Will be built before resource gathering

3. **Add Gather Goal**: Create GatherResourceGoal to wait for resources
   - Passive goal that checks resource levels daily
   - Completes when target amount reached

---

## Territory Management

### System: TerritoryManager (`server/js/ai/TerritoryManager.js`)

Dynamically calculates and manages faction territory boundaries based on building positions with intelligent hash-based caching.

### Territory Calculation

**Cached Until Buildings Change** in `updateTerritory()`:

1. **Get All Buildings**: Uses `BuildingService.getBuildings()` (fails fast if unavailable)
2. **Check Cache**: Calculates building hash, compares to last hash
   - If hash matches and territory exists: use cached territory (early return)
   - If hash differs or no territory: recalculate
3. **Calculate Center of Mass**: Average position of all buildings
4. **Calculate Average Distance**: Average distance from center to buildings
5. **Set Territory Radius**: `max(avgDistance * 1.1, 15 tiles)` (1.1x multiplier, minimum 15)
6. **Classify Buildings**:
   - Within radius: Core base buildings
   - Beyond radius: Outpost buildings

### Building Hash Calculation

**Hash Formula**: `count:sumOfIDs:validIds`

```javascript
calculateBuildingHash(buildings) {
  if (buildings.length === 0) return '0:0';
  
  let idSum = 0;
  let validIds = 0;
  
  for (const building of buildings) {
    if (building && building.id !== undefined && building.id !== null) {
      idSum += building.id;
      validIds++;
    }
  }
  
  return `${buildings.length}:${idSum}:${validIds}`;
}
```

**Why This Hash**:
- Detects count changes (buildings added/removed)
- Detects ID changes (different buildings)
- Handles edge cases (same count, different buildings)
- More robust than simple count:lastId approach

### Caching Strategy

**Cache Invalidation**:
- Territory recalculated only when building hash changes
- Hash calculated from: building count + sum of IDs + valid ID count
- Cached territory stored in `this.coreBase`
- Last hash stored in `this.lastBuildingHash`

**Performance**:
- O(1) when cached (just hash comparison)
- O(n) only when buildings change (full recalculation)
- Prevents unnecessary recalculations on days with no building changes

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

**Location**: Performed automatically in `FactionKnowledge` constructor (not in FactionAI)

**On AI Initialization** (`performInitialTerritoryScan()`):
- Scans 15-tile radius around HQ
- Counts resources: forest, rocks, caves, farmland
- Registers significant locations:
  - Caves: High priority (density 20), all cave locations registered
  - Forests: Best cluster location (first cluster found)
  - Rocks: Best cluster location (first cluster found)
- Marks all tiles in scan radius as explored
- This is knowledge gathering, so it belongs in FactionKnowledge, not FactionAI

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

**Status**: Currently instantiated but not actively used in goal chain resolution. GoalChain handles resource resolution directly.

**Note**: ResourcePlanner exists and can be used for resource planning calculations, but the current goal chain resolution system handles dependencies directly without using ResourcePlanner.

**Integration**: Uses BuildingService for building queries (fails fast if unavailable).

### Planning Methods

#### Plan for Goal (`planForGoal()`)
- Determines if goal can execute
- Creates subgoals for blocking factors
- Currently not used in active goal chain resolution

#### Estimate Gather Time (`estimateGatherTime()`)
- Estimates time to gather required resources
- Uses production rate calculations
- Can be used for planning but not currently integrated

### Production Rate Calculation

**Base Rates**:
- Lumbermill: 5 wood/day
- Mine: 4 stone/day
- Farm: 3 grain/day
- Mine (ore): 2 ironore/day

**Serf Bonus**:
- Each serf adds +0.5 to all resource production rates

**Calculation**:
- Uses BuildingService for building counts (via `getBuildingCount()`)
- Fails fast if BuildingService unavailable

---

## Caching & Performance

### Caching Strategies

The system implements multiple layers of caching to optimize performance:

#### 1. BuildingService Caching

**Per-Day Caching**:
- Building list cached after first access
- Building counts cached individually by type
- Cache key: `buildingType` + `_cacheDay`
- Cache invalidated when `global.day` changes

**Optimization**:
- `getBuildingCount()` checks count cache first (O(1) when cached)
- Only calls `getBuildings()` on cache miss (O(n) only when needed)
- Prevents redundant Building.list iterations

**Cache Structure**:
```javascript
{
  _cachedBuildings: Array | null,      // Full building list
  _cachedBuildingCounts: {},           // { 'mill': 2, 'farm': 5, ... }
  _cacheDay: number                    // Day when cache was created
}
```

**Debug Logging**:
- Optional debug mode via `setDebug(true)`
- Logs cache hits/misses for performance analysis
- Example: `[BuildingService] Cache HIT for mill count: 2`

#### 2. FactionAI Military Units Caching

**Per-Day Caching**:
- Military units list cached after first calculation
- Cache invalidated when day changes
- Prevents redundant Player.list iterations

**Cache Structure**:
```javascript
{
  _cachedMilitaryUnits: Array | null,
  _cachedMilitaryUnitsDay: number
}
```

**Access Pattern**:
- `getMilitaryUnits()` checks cache first
- Calculates and caches on miss
- MilitaryManager always delegates to FactionAI (single source of truth)

#### 3. TerritoryManager Hash-Based Caching

**Hash-Based Invalidation**:
- Territory cached until buildings change
- Hash calculated: `count:sumOfIDs:validIds`
- Compares hash to detect building changes
- Only recalculates when hash differs

**Cache Structure**:
```javascript
{
  coreBase: { center, radius, buildings },
  lastBuildingHash: string,
  lastBuildingCount: number
}
```

**Performance**:
- O(1) hash comparison when cached
- O(n) recalculation only when buildings change
- Prevents unnecessary recalculations on days with no building changes

#### 4. GoalChain Blocking Factor Caching

**Per-Goal Caching**:
- Blocking factors cached during chain resolution
- Cache key: `${goalType}:${house.id}}`
- Prevents redundant `canExecute()` calls
- Only calculated once per goal type per resolution

**Cache Structure**:
```javascript
{
  blockingCache: Map<string, Array>  // goalType:houseId -> blocking factors
}
```

### Performance Optimizations

#### Iterative vs Recursive Resolution

**Before**: Recursive goal chain resolution
- Hard to trace and debug
- Stack depth concerns
- Difficult to show resolution state

**After**: Iterative queue-based resolution
- Easy to trace (queue state visible)
- No stack depth issues
- Can log queue state for debugging
- Better error reporting

#### Blocking Factor Caching

**Optimization**: Cache blocking factors during chain resolution
- Prevents calling `canExecute()` multiple times for same goal
- Reduces redundant BuildingService queries
- Improves resolution performance

#### Building Hash Optimization

**Before**: Full string concatenation of all building IDs
- Expensive for many buildings
- O(n) string operations

**After**: Sum of IDs + count + valid IDs
- O(n) calculation but simpler
- More robust hash (detects more change types)
- Faster comparison

#### Single-Pass Duplicate Removal

**Algorithm**: Track last index, filter in single pass
- O(n) time complexity
- Clear and efficient
- Keeps last occurrence (most up-to-date requirements)

---

## Error Handling & Validation

### Service Initialization Validation

**Location**: `FactionAI.validateServices()`

All services are validated after initialization to catch errors early:

```javascript
validateServices() {
  const services = [
    { name: 'FactionKnowledge', instance: this.knowledge, class: FactionKnowledge },
    { name: 'TerritoryManager', instance: this.territory, class: TerritoryManager },
    { name: 'BuildingService', instance: this.buildingService, class: BuildingService },
    { name: 'MilitaryManager', instance: this.militaryManager, class: MilitaryManager },
    { name: 'GoalExecutor', instance: this.goalExecutor, class: GoalExecutor }
  ];
  
  // Validate each service exists and is correct type
  // Throw structured error if validation fails
}
```

**Validation Checks**:
- Service instance exists (not null/undefined)
- Service is correct type (instanceof check)
- Strategy exists (no base class, so separate check)

**Error Format**:
```
[FactionAI] [timestamp] [faction] Service initialization failed:
- FactionKnowledge not initialized
- BuildingService is not an instance of BuildingService
```

### Structured Error Messages

All errors follow consistent format for easy parsing and debugging:

**Error Structure**:
```javascript
{
  timestamp: "2024-01-15T10:30:45.123Z",
  faction: "Goths",
  goalType: "BUILD_MILL",
  step: 2,
  message: "Error executing goal: Insufficient resources",
  details: {
    resourceBlocks: [{ resource: 'wood', need: 40, have: 10 }],
    buildingBlocks: []
  }
}
```

**Error Logging Format**:
```
[Component] [timestamp] [faction] [goalType] [step] message
```

**Examples**:
- `[GoalExecutor] [2024-01-15T10:30:45.123Z] [Goths] [BUILD_MILL] [step 2] Error executing goal: Insufficient resources`
- `[FactionAI] [2024-01-15T10:30:45.123Z] [Goths] [BUILD_MILL] Goal chain creation errors: [...]`

### Goal Chain Error Tracking

**Chain Errors**:
- Stored in `chain.errors` array
- Collected during resolution (max depth, unknown building types, etc.)
- Exposed in `getStatus()` for debugging
- Logged with resolution path

**Resolution Path**:
- Always stored in `chain.resolutionPath`
- Documents dependency resolution process
- Includes: goal, depth, reason, parent, canExecute, blocking factors
- Useful for debugging complex chains

### Fail-Fast Approach

**No Fallback Paths**:
- BuildingService access fails fast if unavailable
- Indicates initialization bug, not recoverable error
- All building access goes through BuildingService
- Removed all fallback paths to direct Building.list access

**Benefits**:
- Errors caught immediately
- No silent failures
- Clear error messages indicate root cause
- Easier debugging

### Error Handling in Daily Evaluation

**Location**: `server/js/Houses.js` line 239

```javascript
House.evaluateAI = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.ai && house.ai.evaluateAndAct){
      try {
        house.ai.evaluateAndAct();
      // Errors logged with stack traces instead of silently swallowed
      // Prevents one faction from breaking others
      // But errors are now visible for debugging
      console.error(`[FactionAI] Error evaluating AI for faction ${house.name || house.id}:`, error);
        if (error.stack) {
          console.error(error.stack);
        }
      } catch (error) {
        // Error logged but doesn't break other factions
      }
    }
  }
}
```

---

## Data Flow & Integration

### Daily Update Cycle

```
Game Loop (Daily)
  ↓
House.evaluateAI() [Houses.js:239]
  ↓
FactionAI.evaluateAndAct() [FactionAI.js:100]
  ↓
  ├─→ Check lastEvaluatedDay (prevent duplicates)
  ├─→ Invalidate caches for new day
  ├─→ TerritoryManager.updateTerritory()
  │     ├─→ BuildingService.getBuildings() (cached)
  │     ├─→ Calculate hash (count:sumOfIDs:validIds)
  │     ├─→ If hash matches: use cached territory
  │     └─→ If hash differs: recalculate (1.1x multiplier)
  ├─→ house.updatePatrolList()
  ├─→ knowledge.cleanStaleInformation()
  │
  ├─→ IF currentGoalChain exists AND not complete AND not failed:
  │     └─→ executeCurrentGoal()
  │           ├─→ GoalExecutor.executeGoal()
  │           │     ├─→ goal.canExecute() (uses BuildingService)
  │           │     ├─→ goal.execute() (if executable)
  │           │     │     ├─→ BuildingConstructor.buildX()
  │           │     │     │     └─→ tilemapSystem.findBuildingSpot()
  │           │     │     │     └─→ Create building entity
  │           │     │     └─→ Deduct resources
  │           │     └─→ Return { success, shouldAdvance, shouldClearChain }
  │           └─→ If shouldAdvance: goalChain.advance()
  │           └─→ If shouldClearChain: currentGoalChain = null
  │
  └─→ ELSE (no chain OR complete OR failed):
        ├─→ Clear failed chains
        ├─→ strategy.evaluateEconomicGoals()
        ├─→ strategy.evaluateMilitaryGoals()
        ├─→ strategy.evaluateExpansionGoals()
        ├─→ strategy.evaluateDefenseGoals()
        │     └─→ All use BuildingService for building counts
        │
        ├─→ Filter & sort goals by utility
        ├─→ GoalChain.create(topGoal)
        │     ├─→ Iterative queue-based resolution
        │     ├─→ Blocking factor caching
        │     ├─→ Context-aware cycle detection
        │     ├─→ Resolution path tracing
        │     └─→ Duplicate removal
        │
        ├─→ Validate chain (check for errors)
        └─→ executeCurrentGoal()
  │
  └─→ MilitaryManager.updateScoutingParties()
  └─→ MilitaryManager.updateAttackForces()
```

### Integration Points

#### House Integration (`server/js/Houses.js`)
- **Line 239**: `House.evaluateAI()` - Daily evaluation entry point
  - Iterates all houses, calls `house.ai.evaluateAndAct()`
  - Error handling prevents one faction from breaking others
  - Errors logged with stack traces for debugging
- **Line 28**: `calculateBaseTerritory()` - Territory calculation
  - Delegates to `house.ai.territory.updateTerritory()`
  - Delegates to `house.ai.territory.absorbColonies()`
  - Updates `baseCenter`, `baseCenterCoords`, `baseRadius` from TerritoryManager
- **Line 48**: `isInBaseTerritory(x, y)` - Colony detection
  - Delegates to `house.ai.territory.isInBaseTerritory(x, y)`
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
- Iterative queue-based resolution ensures all prerequisites met
- Goal chains persist until complete or failed

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
- Early returns prevent unnecessary work

### Search Optimization
- HQ placement: Tests up to 500 locations (not entire map)
- Building placement: Expanding radius search (stops when found)
- Outpost finding: Samples every 5th tile (not exhaustive)

### Caching (See Caching & Performance Section)
All caching strategies are documented in the [Caching & Performance](#caching--performance) section above.

### Memory Management
- Stale enemy information cleaned (5-minute TTL)
- Completed scouting parties removed (handled by MilitaryManager)
- Completed attack forces removed (handled by MilitaryManager)
- Goal chains cleared when complete or failed

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

The Faction AI system is a sophisticated, optimized, goal-driven architecture that:

1. **Evaluates daily** to make strategic decisions (once per day, prevented from duplicates)
2. **Resolves dependencies** automatically through iterative goal chains (queue-based, not recursive)
3. **Persists goal chains** indefinitely until complete or failed (not recreated daily)
4. **Manages territory** dynamically with hash-based caching (1.1x multiplier, cached until buildings change)
5. **Explores the map** through scouting parties (managed by MilitaryManager)
6. **Expands strategically** through outpost establishment
7. **Adapts per faction** through strategy modules and profiles
8. **Tracks knowledge** with fog of war system (FactionKnowledge with initial territory scan)
9. **Optimizes performance** through multiple caching layers (BuildingService, FactionAI, TerritoryManager)
10. **Validates services** on initialization (fail-fast approach)
11. **Handles errors** with structured logging (timestamp, faction, goal type, step, details)

### Architecture Principles

- **Single Source of Truth**: Each data type has one clear access point (BuildingService for buildings, FactionAI for military units)
- **Fail Fast**: No fallback paths - errors caught immediately with clear messages
- **Separation of Concerns**: Clear responsibilities (FactionAI orchestrates, GoalExecutor executes, MilitaryManager handles military)
- **Performance Optimized**: Multiple caching layers, iterative algorithms, hash-based invalidation
- **Easily Diagnosable**: Structured errors, resolution path tracing, optional debug logging
- **Modular & Extensible**: Clear extension points for new goals, buildings, factions, strategies

The system is modular, extensible, and designed to create believable, strategic NPC faction behavior that adapts to the game state while maintaining faction-specific characteristics. All components are optimized for performance, reliability, and ease of debugging.
