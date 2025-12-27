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
8. **FactionAILogger** (`server/js/ai/FactionAILogger.js`) - Daily reports and scouting statistics tracking
9. **Goals** (`server/js/ai/Goals.js`) - Goal type definitions and execution
10. **FactionStrategy** (`server/js/ai/strategies/`) - Faction-specific strategic evaluation

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
  
  // Goal failure tracking for adaptive learning
  this.goalFailureHistory = new Map(); // Map<goalType, {failureCount, lastFailureDay, consecutiveFailures, locationBlockCount, lastLocationBlockDay}>
  this.chainFailureHistory = new Map(); // Map<goalType, {failureReason, lastFailureDay, blockingFactors}>
  this.goalConsiderationHistory = new Map(); // Map<goalType, {considerationCount, lastConsiderationDay}>
  
  // Fallback goal suggestions (from location blocking)
  this.suggestedFallbackGoals = new Set(); // Set of goal suggestions like "SCOUT_FOR_RESOURCE:stone"
  
  // Resource production monitoring (tracking and recovery)
  this._lastResourceLevels = null; // Previous day's resource levels
  this._productionRates = {}; // Production rate tracking
  this._productionIssueDays = {}; // Track days with production issues per resource
  this._pendingRecoveryGoals = []; // Recovery goals generated from production monitoring
  
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
- `performInitialTerritoryScan()` called in constructor (line 16)
- `scanKnownZones()` called in constructor (line 19) to scan for zones intersecting HQ/base radius
- Scans 15-tile radius around HQ
- Counts resources: forest, rocks, caves, farmland
- Only counts large rocks (resource-carrying), not visual rocks
- Registers significant resource locations in knowledge base:
  - All cave locations registered (high priority, density 20)
  - Best forest cluster location registered
  - Best rock cluster location registered
- Marks all tiles in scan radius as explored
- This is knowledge gathering, so it belongs in FactionKnowledge

#### Daily Evaluation Cycle (`evaluateAndAct()`)

**Called once per in-game day** (line 118):

1. **Duplicate Prevention** (lines 123-127)
   - Checks `lastEvaluatedDay` to prevent multiple evaluations on same day
   - Early return if already evaluated today

2. **Resource Production Monitoring** (line 132)
   - Calls `monitorResourceProduction()` to track production issues
   - Only for economic factions (non-economic factions skip this)
   - Triggers recovery goals if production broken for 2+ days

3. **Cache Invalidation** (lines 138-140)
   - Invalidates military units cache for new day
   - BuildingService handles its own cache invalidation

4. **Territory Update** (lines 146-157)
   - Updates patrol building list
   - Recalculates base territory boundaries (cached)
   - Updates known zones in territory
   - Cleans stale enemy information

5. **Goal Chain Continuation** (lines 160-167)
   - If active goal chain exists and incomplete, continue execution
   - Updates logger with current chain state
   - Generates report and returns early

6. **Chain Failure Handling** (lines 173-195)
   - If chain failed, records failure and analyzes for recovery goal
   - If recovery goal found, creates new chain and executes
   - Clears failed chains

7. **New Goal Evaluation** (line 199)
   - Calls `evaluateNewGoals()` to generate and select new goals
   - Includes recovery goals and fallback goals from location blocking

8. **Ongoing Operations** (lines 202-204)
   - Updates scouting parties
   - Updates attack forces

9. **Report Generation** (lines 206-211)
   - Updates goal chain info in logger
   - Generates daily report
   - Clears report data

#### Goal Evaluation Process (`evaluateNewGoals()`)

**Process Overview** (lines 215-541):

1. **Non-Economic Faction Check** (line 217)
   - Determines if faction should skip economic goals

2. **Goal Generation** (lines 221-225)
   - Economic goals: skipped for non-economic factions
   - Military, expansion, defense goals: always generated
   - Resource scouting goals: if strategy supports it
   - Recovery goals: from production monitoring (economic factions only)
   - Fallback scout goals: from location blocking suggestions

3. **Resource Balance Analysis** (line 264)
   - Calculates resource ratios and identifies imbalances

4. **Goal Consideration Tracking** (lines 267-271)
   - Records all goals with utility > 0 for stagnation prevention

5. **Resource Balance Boosts** (lines 274-301)
   - **Before filtering** (affects selection priority)
   - BUILD_MINE: 1.5x boost when stone < 50 or stone scarce
   - BUILD_MINE: Additional 1.3x boost when stone < 20
   - Sets mineType to 'stone' when stone needed
   - BUILD_LUMBERMILL: 1.3x boost when wood scarce

6. **Goal Forcing** (lines 304-311)
   - **Before filtering** (ensures forced goals aren't filtered out)
   - Forces minimum utility of 60 for goals considered 3+ times

7. **Goal Filtering** (lines 315-375)
   - Filters goals with utility <= 0
   - Filters goals that should be avoided (consecutive failures)
   - **Special handling for blocked goals**:
     - High-value goals (BUILD_GARRISON, BUILD_FORGE, ESTABLISH_OUTPOST): kept even if blocked
     - High-utility goals (utility >= 50): kept even if blocked
     - Forced goals: kept even if blocked
     - All other blocked goals: filtered out
   - **Location validation**:
     - Records location blocking for utility adjustment
     - High-value/high-utility/forced goals: kept even if no location
     - Other goals: filtered out if no valid location

8. **Utility Adjustment** (lines 385-402)
   - Applies failure penalties via `getAdjustedUtility()`
   - Maintains forced goal utility (minimum 60) after penalties
   - Logs utility adjustments for debugging

9. **Sorting** (lines 405-408)
   - Sorts by adjusted utility (highest first)

10. **Fallback Goals** (lines 410-421)
    - If no valid goals, generates fallback goals
    - Ensures faction stays active

11. **Goal Selection** (lines 423-485)
    - Selects top goal from sorted list
    - Checks chain failure avoidance (skips if recently failed with same blockers)
    - Selects alternative if primary goal should be avoided

12. **Dependency Chain Forcing** (lines 487-502)
    - For high-value blocked goals, boosts prerequisite utilities
    - BUILD_GARRISON: boosts BUILD_FORGE utility to 60

13. **Chain Creation** (line 505)
    - Creates goal chain with dependency resolution
    - Validates chain after creation

14. **Execution** (line 540)
    - Executes first goal in chain if chain has steps
    - Otherwise executes goal directly or clears chain

**New Methods**:

**checkResourceBalance()** (Phase 8):
- Calculates resource ratios (wood:stone, grain:stone)
- Identifies imbalances (stone scarce, wood excessive, etc.)
- Returns balance analysis with resource counts and imbalance flags

**recordGoalConsideration(goalType)** (Phase 9):
- Tracks how many times each goal has been considered
- Stores consideration count and last consideration day
- Used for stagnation prevention

**shouldForceGoalSelection(goalType)** (Phase 9):
- Returns true if goal has been considered 3+ times
- Used to force selection of repeatedly considered goals
- Prevents infinite consideration loops
- Forces minimum utility of 60 when goal is selected

#### Non-Economic Factions System

**isNonEconomicFaction()** (line 110):
- Checks if faction is excluded from economic goals and production monitoring
- Excluded factions: `['Brotherhood', 'Outlaws', 'Norsemen', 'Mercenaries']`
- Handles faction names with trailing numbers (e.g., "Outlaws 1" → "Outlaws")
- Returns true if faction base name is in excluded list

**Impact on Goal Evaluation**:
- Economic goals are skipped for non-economic factions (line 221)
- Production monitoring is skipped (line 869)
- Recovery goals are not generated for non-economic factions (line 233)
- Logging is reduced (economic goal counts not logged)

**Rationale**:
- Non-economic factions (raiders, outlaws, mercenaries) focus on military/expansion
- Economic building goals don't apply to these factions
- Production monitoring would generate noise for factions that don't gather resources

#### Resource Production Monitoring

**monitorResourceProduction(currentDay)** (line 867):
- Tracks resource production rates daily (wood, stone, grain, ironore)
- Calculates production changes from previous day
- Counts production buildings (stone mines vs cave mines separately)
- Counts serfs working at buildings
- Logs production status for debugging
- Detects production issues (zero or negative production with low resources)
- Tracks days with production issues per resource (`_productionIssueDays`)
- Triggers recovery goals when production broken for 2+ days

**Production Issue Detection**:
- Resource production is zero or negative AND resource level < 50
- Average production rate is <= 0
- Tracks consecutive days with issues

**diagnoseProductionIssue(resource, buildings, currentDay)** (line 966):
- Identifies root cause of production problems
- Checks: building existence, building built status, serf assignment
- Logs detailed diagnostics including which buildings lack serfs
- Root causes:
  - No building exists → need to build
  - Buildings exist but not built → construction incomplete
  - Buildings built but no serfs → serf assignment issue
  - Buildings and serfs exist → deposit logic issue

**triggerProductionRecovery(resource, currentDay)** (line 1050):
- Generates recovery goals when production broken for 2+ days
- Only triggers if building doesn't exist (not serf/deposit issues)
- Creates appropriate building goal (mine, lumbermill, farm)
- Sets mine type for stone mines (`mineType = 'stone'`)
- Sets high utility (70) to ensure selection
- Marks goal as recovery goal (`isRecoveryGoal = true`)
- Stores in `_pendingRecoveryGoals` array for next evaluation

**Recovery Goal Integration**:
- Recovery goals are added to goal evaluation pool (line 233)
- Only included for economic factions
- Cleared after use (prevents duplicate recovery attempts)

#### Fallback Goal Generation

**generateFallbackGoals()** (line 1306):
- Creates fallback goals when no valid goals available after filtering
- Ensures faction stays active even when all goals filtered out
- Creates basic infrastructure goals:
  - BuildMillGoal (utility 30) if no mills exist
  - BuildMineGoal (utility 25) if no mines exist
  - BuildFarmGoal (utility 20) if no farms exist (requires mills)
- Returns array of fallback goals
- Used in `evaluateNewGoals()` when `sortedGoals.length === 0` (line 411)

**When Used**:
- After all goal filtering and adjustment
- When no goals pass utility/execution/location checks
- Prevents faction from becoming inactive

#### Location Blocking System

**recordLocationBlocking(goalType)** (line 610):
- Tracks location blocking separately from general failures
- Updates `goalFailureHistory` with location block count and last block day
- Used for utility adjustment (location-blocked 3+ times reduces utility by 50%)
- Called when `canPlace()` returns false during goal filtering (line 358)

**suggestedFallbackGoals** (line 46):
- Set of goal suggestions from location blocking (e.g., "SCOUT_FOR_RESOURCE:stone")
- Used when BUILD_MINE or BUILD_MILL fails due to location (GoalExecutor line 301)
- Converted to ScoutForResourceGoal during goal evaluation (line 239-246)
- High utility (65) to ensure selection
- Cleared after use (line 250)

**Location Blocking Flow**:
1. Goal filtering checks `canPlace()` (line 355)
2. If fails, `recordLocationBlocking()` called (line 358)
3. For BUILD_MINE/BUILD_MILL, GoalExecutor suggests SCOUT_FOR_RESOURCE (line 297-311)
4. Suggestion added to `suggestedFallbackGoals` Set
5. Next evaluation converts suggestions to goals with high utility

#### Chain Failure Analysis

**analyzeChainFailure(chain)** (line 722):
- Analyzes failed chain to suggest recovery goal
- Extracts blocking factors from current goal
- Prioritizes resource with largest deficit
- Special handling:
  - Stone production deadlock: suggests SCOUT_FOR_RESOURCE if production broken
  - Building blocks: suggests building that building
  - Resource blocks: suggests gathering building if missing, otherwise gather goal
  - Location issues: suggests alternative building goals
- Returns recovery goal or null

**shouldAvoidChainGoal(goalType)** (line 784):
- Checks if goal should be avoided due to recent chain failure
- Avoids if failed within last 2 days with same blocking factors
- Compares current blocking factors with failure history
- Used during goal selection to skip recently failed goals (line 476)

**Chain Failure Flow**:
1. Chain fails (goal execution fails or goal blocked)
2. `recordChainFailure()` stores failure details (line 178, 637)
3. `analyzeChainFailure()` suggests recovery goal (line 181)
4. If recovery goal found, creates new chain immediately (line 184)
5. Otherwise, clears chain and evaluates new goals normally

**getAlternativeGoals(primaryGoal, failureReason)** (line 826):
- Generates alternative goals when primary goal fails
- Delegates to strategy if `getAlternativeGoals()` method exists
- Default alternatives:
  - BUILD_FARM fails → try BUILD_MILL or BUILD_LUMBERMILL
  - BUILD_FORGE/BUILD_GARRISON fails → prioritize resource gathering buildings
- Filters alternatives to only executable ones
- Returns array of alternative goals

#### Goal Execution (`executeCurrentGoal()`)

Delegates to `GoalExecutor` for execution logic:
- Gets current goal from chain
- Delegates execution to `goalExecutor.executeGoal()`
- **Execution Verification** (Phase 6): GoalExecutor verifies buildings were actually created
- Tracks failures for adaptive learning (`recordGoalFailure()`)
- Handles chain advancement or clearing based on result
- Separates execution logic from chain management

#### Resource Production Tracking

**getResourceProductionRate(resourceType)**:
- Returns production rate per building per day
- Stone: 5 per stone mine
- Wood: 8 per lumbermill
- Grain: 10 per farm
- Ores: 3 ironore, 2 silverore, 1 goldore per cave mine

**estimateGatheringTime(resourceType, targetAmount)**:
- Calculates days needed to gather target amount
- Accounts for mine types (stone mines for stone, cave mines for ores)
- Returns Infinity if no production capacity

**canGatherWithinReasonableTime(resourceType, targetAmount, maxDays)**:
- Checks if resources can be gathered within reasonable time (default 10 days)
- Used by GatherResourceGoal to determine if goal is feasible

#### Scouting System

**Deploy Scouting Party** (line 258):
- Delegates to `MilitaryManager.deployScoutingParty()`
- See MilitaryManager section for details
- Scouting activities are integrated with Event Manager (FACTION category events)
- See ScoutingParty section for Event Manager integration details

**Scouting Party Update**:
- Delegates to `MilitaryManager.updateScoutingParties()`
- See MilitaryManager section for details
- Scouting statistics tracked in FactionAILogger for daily reports
- See FactionAILogger section for scouting statistics tracking

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

**getStoneMineCount()**:
- Returns count of stone mines (mines that are NOT near caves)
- Checks for mines where `building.cave` is null or false
- Cached per day like other building counts
- Used for stone resource production calculations

**getCaveMineCount()**:
- Returns count of cave mines (mines that ARE near caves)
- Checks for mines where `building.cave` is truthy
- Cached per day like other building counts
- Used for ore resource production calculations (ironore, silverore, goldore)

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
- Tracks building count before execution (for verification)
- Executes goal in try-catch block
- **Execution Verification** (Phase 6):
  - Invalidates BuildingService cache to ensure fresh counts
  - Verifies building was actually created using `verifyBuildingCreation()`
  - Checks building count increased (before vs after)
  - Marks goal as FAILED if verification fails
  - Throws error to trigger retry or alternative goal selection
- Marks goal as COMPLETED on success
- On error: creates structured error object, logs with context, marks goal as FAILED
- Returns success result with shouldAdvance=true

**verifyBuildingCreation(goal, house)**:
- Checks if goal is a building goal (startsWith 'BUILD_')
- For farms: Checks if any farm exists for the house (simplified check)
- For other buildings: Verifies building exists in Building.list with correct owner, type, and built status
- Returns true if building exists, false otherwise
- Prevents silent execution failures where goals complete but buildings aren't created

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

### 4. FactionAILogger (`server/js/ai/FactionAILogger.js`)

Centralized logging and reporting utility for faction AI. Handles daily report generation, scouting statistics tracking, and structured logging.

#### Purpose
- Provides consistent logging format across faction AI system
- Generates daily reports summarizing faction activity
- Tracks scouting mission statistics for daily reports
- Collects decision, action, and error data for analysis
- **Faction Filtering**: Only enables logging for specific factions (reduces log noise)

#### Initialization

**Faction Filtering** (lines 7-13):
- Only enables logging for: `['Teutons', 'Goths', 'Celts', 'Franks']`
- Case-insensitive matching (handles variations in faction names)
- Handles faction names with trailing numbers (e.g., "Goths 1" → "Goths")
- All other factions have logging disabled by default
- Can be manually enabled via `setEnabled(true)` if needed

**Log Levels**:
- `DEBUG`: Detailed debugging information (currently disabled for reduced verbosity)
- `INFO`: General information messages
- `DECISION`: Goal selection and strategic decisions
- `ACTION`: Actions taken (building construction, etc.)
- `ERROR`: Error messages (always logged regardless of level)

#### Daily Reports

**Report Generation**:
- `startReport()` - Initializes report data collection for new day
- `generateReport()` - Formats and outputs complete daily report
- `formatReport()` - Formats report data as structured text
- Reports include: Current state, goal chain, decisions, actions, errors, and scouting activity

**Report Structure**:
- Header with faction name and day
- Current state (resources, buildings, territory, military)
- **SCOUTING ACTIVITY** section (if any scouting occurred):
  - Parties Deployed
  - Missions Completed
  - Missions Failed (combat encounters)
  - Zones Cleared
  - Conflict Zones Discovered
  - Contested Banners Placed
- Goal chain status and progress
- Decisions made during the day
- Actions taken
- Errors encountered
- Reasoning summary

#### Scouting Statistics Tracking

**Tracking Methods**:
- `recordScoutingDeployment()` - Called when scouting party is deployed
- `recordScoutingCompletion()` - Called when party returns successfully
- `recordScoutingFailure()` - Called when mission fails
- `recordConflictZone()` - Called when conflict zone is discovered
- `recordZoneCleared()` - Called when zone is cleared for expansion
- `recordContestedBanner()` - Called when contested banner is placed

**Statistics Storage**:
- Stored in `reportData.scoutingStats` object
- Initialized in `startReport()` with daily counters
- Reset automatically each day when new report starts
- All statistics default to 0

**Integration**:
- Called from `ScoutingParty` at appropriate points:
  - Deployment: Constructor
  - Zone cleared: `updateCamping()` (when transitioning to returning)
  - Failure/Conflict: `handleFactionAttack()`
  - Completion: `checkReturnComplete()` (when party returns successfully)
  - Contested banner: `placeContestedBanner()`

**Report Display**:
- SCOUTING ACTIVITY section only displayed if any scouting activity occurred
- Shows all tracked metrics with counts
- Includes contextual information (e.g., "Missions Failed: X (combat encounters)")

---

### 5. MilitaryManager (`server/js/ai/MilitaryManager.js`)

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
- ScoutingParty instances handle their own Event Manager event creation
- Scouting statistics tracked in FactionAILogger (called from ScoutingParty)

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

All building types now have corresponding `canPlaceX()` validation methods for pre-placement checks:
- `canPlaceMill(location)` - Validates mill placement
- `canPlaceFarm(location)` - Validates farm placement (checks all mills with incremental radius)
- `canPlaceMine(location, mineType)` - Validates mine placement (with mine type preference)
- `canPlaceLumbermill(location)` - Validates lumbermill placement
- `canPlaceForge(location)` - Validates forge placement
- `canPlaceGarrison(location)` - Validates garrison placement

#### 1. Mill (`buildMill()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 40, stone: 20}
- **Requirements**: None
- **Placement**: Uses `tilemapSystem.findBuildingSpot('mill', ...)`
- **Validation**: Excludes occupied tiles (HQ + existing buildings)
- **canPlaceMill()**: Pre-placement validation method

#### 2. Farm (`buildFarm()`)
- **Search**: 6-10 tiles from ALL mills (incremental radius expansion)
- **Cost**: {wood: 20}
- **Requirements**: Mill must exist
- **Placement**: Iterates through all mills, tries each with expanding radius (6→8→10)
- **Special**: Terrain changed to FARM_SEED (8)
- **canPlaceFarm()**: Pre-placement validation that checks all mills with incremental radius

#### 3. Mine (`buildMine(location, mineType)`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 30, stone: 20}
- **Requirements**: None
- **Placement**: Can be on EMPTY, ROCKS, or MOUNTAIN terrain
- **Mine Types** (Phase 2.4: Mine Type Differentiation):
  - **Stone Mines**: Built away from caves (mineType='stone')
    - Produces stone resources
    - Searches for locations NOT near cave entrances
  - **Cave Mines**: Built near caves (mineType='cave')
    - Produces ores (ironore, silverore, goldore)
    - Searches near cave entrances (within 384 pixels / ~6 tiles)
    - Sets `building.cave` property to cave location
  - **Any**: Normal search (mineType='any')
- **Cave Detection**: `isNearCaveEntrance(location)` checks:
  - Global `caveEntrances` array for proximity
  - Terrain layer for CAVE_ENTRANCE tiles within 6-tile radius
- **Validation**: Checks plot validity and cave proximity
- **canPlaceMine(location, mineType)**: Validation method for pre-placement checks

#### 4. Lumbermill (`buildLumbermill()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 35, stone: 15}
- **Requirements**: None
- **Placement**: Should be near forest
- **Validation**: Verifies nearby forest (5-tile radius, min 10-12 forest tiles)
- **canPlaceLumbermill()**: Pre-placement validation method

#### 5. Forge (`buildForge()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 50, stone: 100}
- **Requirements**: None
- **Placement**: Uses unified construction system
- **Special**: Updates patrol list after construction
- **canPlaceForge()**: Pre-placement validation method

#### 6. Garrison (`buildGarrison()`)
- **Search**: 10 tiles from HQ (or 3 if location specified)
- **Cost**: {wood: 50, stone: 30}
- **Requirements**: Forge must exist
- **Placement**: Uses unified construction system
- **Special**: Updates patrol list after construction
- **canPlaceGarrison()**: Pre-placement validation method

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
| **BuildMineGoal** | 45 | {wood: 30, stone: 20} | None | Can specify location and mineType ('stone', 'cave', or 'any') |
| **BuildLumbermillGoal** | 40 | {wood: 35, stone: 15} | None | Can specify location |
| **BuildForgeGoal** | 40 | {wood: 50, stone: 100} | None | Enables military equipment |
| **BuildGarrisonGoal** | 50 | {wood: 50, stone: 30} | Forge | Military training facility |
| **GatherResourceGoal** | 30 | None | None | Active - checks for gathering buildings, verifies mine types (stone vs cave) |

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
- **Location Validation** (Phase 3): For building goals, also checks `canPlace(house)` if method exists
- Updates `blockedBy` array with blocking factors:
  - `{ type: 'BUILDING', value: 'garrison' }` for missing buildings
  - `{ type: 'RESOURCE', resource: 'wood', have: 10, need: 50 }` for insufficient resources
  - `{ type: 'LOCATION', value: 'no valid location' }` for placement failures
- Returns true if no blockers (resources, buildings, AND location)
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
- **Ancestor Chain Cycle Detection**: Tracks full ancestor chain to detect cycles (e.g., SCOUT_FOR_RESOURCE -> BUILD_LUMBERMILL -> SCOUT_FOR_RESOURCE)
- **Context-Aware Cycle Detection**: Tracks goal type + blocking context to prevent false positives
- **Blocking Factor Caching**: Avoids redundant `canExecute()` calls
- **Deferred Goals System**: Defers gather goals until building dependencies are in chain
- **Production Feasibility Checking**: Validates production capacity before creating gather goals
- **Resource Gap Detection**: Checks for resource gaps and suggests scouting when needed
- **Deadlock Detection**: Prevents stone production deadlocks (BUILD_MINE needs stone but production broken)
- **Resolution Path Tracing**: Full dependency resolution path logged for debugging
- **Goal Chain Persistence**: Chains persist indefinitely until complete or failed (not recreated daily)
- **Maximum Depth**: 5 levels (reduced from 10 for safety)
- **Mine Type Differentiation** (Phase 2.4): Distinguishes stone mines from cave mines in resource resolution
- **Enhanced Resource Resolution**: Checks existing building types before adding new ones, builds multiple if needed
- **Chain Validation**: Validates first step can execute after dependency resolution

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
          // Phase 2.4: Determine mine type preference
          let mineType = 'any';
          if (block.resource === 'stone') {
            mineType = 'stone'; // Need stone mine
          } else if (block.resource === 'ironore' || block.resource === 'silverore' || block.resource === 'goldore' || block.resource === 'iron') {
            mineType = 'cave'; // Need cave mine
          }
          
          // Check if gathering building already exists (with correct type for mines)
          const hasBuilding = GoalChain.hasGatheringBuilding(house, block.resource, mineType);
          
          if (!hasBuilding) {
            let buildGoal = createBuildingGoal(buildingType);
            // Set mine type for mines
            if (buildingType === 'mine' && buildGoal) {
              buildGoal.mineType = mineType;
            }
          if (buildGoal) {
            queue.push({
              goal: buildGoal,
              parent: g,
              depth: depth + 1,
                reason: `needs resource: ${block.resource} (requires ${buildingType}${mineType !== 'any' ? ` - ${mineType} type` : ''})`
              });
            }
            
            // For large deficits (>100), build additional gathering buildings
            const deficit = block.need - block.have;
            if (deficit > 100) {
              let additionalBuildGoal = createBuildingGoal(buildingType);
              if (buildingType === 'mine' && additionalBuildGoal) {
                additionalBuildGoal.mineType = mineType;
              }
              if (additionalBuildGoal) {
                queue.push({
                  goal: additionalBuildGoal,
                  parent: g,
                  depth: depth + 1,
                  reason: `needs resource: ${block.resource} (large deficit, requires additional ${buildingType})`
                });
              }
            }
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
   - stone → mine (stone mine, not cave mine)
   - wood → lumbermill
   - grain → farm
   - iron/ironore/silverore/goldore → mine (cave mine, not stone mine)

2. **Mine Type Differentiation** (Phase 2.4):
   - For stone: Creates BUILD_MINE with `mineType='stone'` (prefers locations away from caves)
   - For ores: Creates BUILD_MINE with `mineType='cave'` (prefers locations near caves)
   - Checks existing mine types using `getStoneMineCount()` and `getCaveMineCount()`
   - Only builds new mines if correct type doesn't exist
   - `hasGatheringBuilding()` method distinguishes stone mines from cave mines

3. **Build Gathering Building**: If building type doesn't exist (with correct type for mines), create build goal
   - Added to queue for resolution
   - Will be built before resource gathering
   - For large deficits (>100), builds additional gathering buildings
   - Mine goals include `mineType` property to ensure correct type is built

4. **Resource Gap Detection** (lines 236-299):
   - Checks if resource gap exists (resource not available in territory)
   - If gap and no building, checks if scouting is feasible (units available)
   - Adds SCOUT_FOR_RESOURCE goal before building goal
   - Prevents cycles: skips scouting if already in ancestor chain
   - Skips scouting if no units available (prevents infinite loops)

5. **Deadlock Detection** (lines 302-324):
   - For BUILD_MINE needing stone: checks if stone production is broken
   - If production broken for 2+ days, suggests SCOUT_FOR_RESOURCE instead
   - Prevents deadlock: need stone to build mine, but stone production broken

6. **Build Gathering Building** (lines 302-394):
   - If building doesn't exist, creates build goal
   - Sets mine type for mines (`mineType = 'stone'` or `'cave'`)
   - Checks for cycles: skips if building type already in ancestor chain with SCOUT_FOR_RESOURCE
   - For large deficits (>100), builds additional gathering buildings

7. **Production Feasibility Checking** (lines 406-441):
   - Before creating GATHER_RESOURCE goal, checks if production is feasible
   - Uses `checkProductionFeasibility()` to estimate days needed
   - Production feasible if can gather within 10 days
   - If not feasible and building exists: builds additional production building
   - Defers gather goal until additional building completes

8. **Deferred Goals System** (lines 448-584):
   - Gather goals are deferred if building needs to be built first
   - Deferred goals map: `goal -> array of dependency building types`
   - After all dependencies processed, deferred goals are added to chain
   - Ensures gather goals execute after building goals complete
   - Gather goal target includes 10% buffer to account for production delays

9. **Add Gather Goal**: Create GatherResourceGoal to wait for resources
   - **Deferred if building needs to be built**: Added after dependencies processed
   - **Added immediately if building exists**: Only if production is feasible
   - **Active goal** (Phase 2.1): Checks for gathering buildings and verifies they're operational
   - Verifies correct mine type exists (stone mines for stone, cave mines for ores)
   - Uses `hasGatheringBuilding()` which checks mine types appropriately
   - Marks as BLOCKED if infrastructure missing or production too slow
   - Estimates gathering time based on production rates
   - Completes when target amount reached

**Production Feasibility Checking** (`checkProductionFeasibility()`, line 810):
- Estimates production rate per day (base rate × building count × 50% efficiency)
- Base rates: stone: 5, wood: 5, grain: 10, ores: 3/2/1 per day
- Calculates days needed to gather deficit
- Returns `{feasible: boolean, daysNeeded: number, productionRate: number}`
- Production feasible if `daysNeeded <= 10 && productionRate > 0`
- If not feasible: triggers additional building construction

**Location and Unit Blocking** (lines 485-504):
- **LOCATION blocking**: Cannot be resolved by dependencies
- Goal may be unachievable, but added anyway to let executor handle retries
- **UNITS blocking**: Goal waits for units to become available (no dependencies created)

**Guardtower Special Handling** (lines 157-196):
- For ESTABLISH_OUTPOST goals needing guardtower:
- Creates BuildGuardtowerGoal with outpost location
- Special exception: BUILD_MINE (stone) can be built before guardtower if stone < 120
- Prevents outpost expansion deadlock

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
5. **Set Territory Radius**: `max(avgDistance * 1.1, 10 tiles)` (1.1x multiplier, minimum 10)
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
  radius: 10,              // Territory radius (minimum 10)
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

### System: ScoutingParty (`server/js/ai/ScoutingParty.js`)

Manages scouting party state and behavior during exploration missions. Implements day-based scouting with overnight camping, campfire management, and faction attack detection.

#### Event Manager Integration

All scouting activities are recorded as FACTION category events using the Event Manager system. Events are created at key points in the scouting lifecycle:

- **Departure**: When party is deployed (constructor)
- **Destination Reached**: When party arrives at target zone (updateTraveling())
- **Campfire Setup**: When campfire is built at nightfall (buildCampfire())
- **Zone Cleared**: When zone is marked as clear for expansion (updateCamping())
- **Returning**: When party begins return journey (updateCamping())
- **Combat Encounter**: When attacked by enemy faction (handleFactionAttack())
- **Mission Failed**: When mission fails due to combat or unit loss (handleFactionAttack(), checkReturnComplete())
- **Contested Banner**: When contested banner is placed after combat (placeContestedBanner())
- **Return Complete**: When party successfully returns to HQ (checkReturnComplete())

See Event Manager System documentation (Section 8: FACTION) for detailed event structures and metadata.

#### Scouting Party Composition

**Leader Selection**:
- Prefers mounted units (cavalier, cavalry, horseman, knight, mounted)
- Falls back to any military unit
- Leader marked with 🚩 emoji

**Backup Units**:
- Selects 0-2 additional units (flexible)
- Units follow leader using `FollowBehavior`
- All units assigned to `ScoutingParty`

#### Mission Flow (Day-Based System)

1. **Deployment** (Constructor):
   - Party created with leader, backup units, target zone, and purpose
   - Status set to 'rallying' (units gather around leader, wait for dawn)
   - Event created: "departed on scouting mission"
   - Logger records deployment for daily report
   - `assignMissionOrders()` called to set units to idle initially

2. **Rallying** (`updateRallying()`):
   - Units gather around leader (waiting for dawn)
   - Checks for dawn transition or timeout
   - Transitions to 'traveling' when ready (at dawn or after timeout)
   - Calls `startTravelingToTarget()` to begin journey

3. **Traveling** (`updateTraveling()`):
   - Party moves to target zone
   - When destination reached:
     - Status transitions to 'waiting_for_nightfall'
     - Arrival day recorded
     - Event created: "reached scouting destination"

4. **Waiting for Nightfall** (`updateWaitingForNightfall()`):
   - Party waits until nightfall
   - When nightfall occurs:
     - Status transitions to 'camping'
     - Campfire built (InfiniteFire)
     - Event created: "set up campfire"

5. **Camping** (`updateCamping()`):
   - Party guards campfire overnight
   - Must be present when midnight hits (presence recorded on both days)
   - Units stay within 15 tiles of campfire
   - When daybreak occurs (day > arrivalDay):
     - Campfire cleaned up (removed)
     - Zone marked as clear
     - Status transitions to 'returning'
     - Events created: "zone cleared for expansion", "returning from scouting mission"
     - Logger records zone cleared for daily report

6. **Returning** (`updateReturning()`):
   - Party moves back to HQ
   - When HQ reached:
     - Status transitions to 'completed'
     - Event created: "returned from scouting mission"
     - Logger records completion for daily report

7. **Combat Detection** (`checkForFactionAttack()`):
   - Monitors unit HP for damage
   - Scans for nearby enemy players (not fauna/neutral)
   - If faction enemy detected:
     - Calls `handleFactionAttack()`

8. **Faction Attack Handling** (`handleFactionAttack()`):
   - Status set to 'failed'
   - Contested banner placed at location
   - Conflict zone reported to FactionKnowledge
   - Campfire cleaned up
   - Events created: "engaged in combat with enemy faction", "scouting mission failed", "placed contested banner"
   - Logger records failure and conflict zone for daily report
   - Party triggers retreat

9. **Contested Banner** (`placeContestedBanner()`):
   - Creates 'contestedbanner' item at leader location
   - Only one banner per mission (flag prevents duplicates)
   - Event created: "placed contested banner"
   - Logger records contested banner for daily report

#### State Machine

States: `rallying` → `traveling` → `waiting_for_nightfall` → `camping` → `returning` → `completed` | `failed`

- **rallying**: Units gather around leader, waiting for dawn before starting journey
- **traveling**: Moving to target zone
- **waiting_for_nightfall**: Reached destination, waiting for night
- **camping**: Guarding campfire overnight
- **returning**: Journey back to HQ
- **completed**: Successfully returned
- **failed**: Mission failed (combat encounter or unit loss)

#### Daily Report Integration

Scouting statistics are tracked in FactionAILogger for inclusion in daily reports:
- Deployment recorded when party created
- Completion recorded when party returns successfully
- Failure recorded when mission fails
- Conflict zone recorded when enemy faction encountered
- Zone cleared recorded when zone marked for expansion
- Contested banner recorded when banner placed

See FactionAILogger section for details on report formatting.

### System: ScoutBehavior (`server/js/ai/ScoutBehavior.js`)

**Note**: This system is superseded by ScoutingParty for faction AI scouting missions. ScoutingParty provides more comprehensive day-based scouting with Event Manager integration.

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

**Location**: `server/js/Houses.js` line 246

```javascript
House.evaluateAI = function(){
  for(var i in House.list){
    var house = House.list[i];
    if(house.ai && house.ai.evaluateAndAct){
      try {
        house.ai.evaluateAndAct();
      } catch (error) {
      // Errors logged with stack traces instead of silently swallowed
      // Prevents one faction from breaking others
      // But errors are now visible for debugging
      console.error(`[FactionAI] Error evaluating AI for faction ${house.name || house.id}:`, error);
        if (error.stack) {
          console.error(error.stack);
        }
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
House.evaluateAI() [Houses.js:246]
  ↓
FactionAI.evaluateAndAct() [FactionAI.js:118]
  ↓
  ├─→ Check lastEvaluatedDay (prevent duplicates) [line 123]
  ├─→ monitorResourceProduction() (economic factions only) [line 132]
  │     ├─→ Track resource levels and production rates
  │     ├─→ Detect production issues
  │     ├─→ diagnoseProductionIssue() if issue detected
  │     └─→ triggerProductionRecovery() if broken 2+ days
  ├─→ logger.startReport() [line 135]
  ├─→ Invalidate caches for new day [line 138]
  ├─→ house.updatePatrolList() [line 146]
  ├─→ territory.updateTerritory() [line 151]
  │     ├─→ BuildingService.getBuildings() (cached)
  │     ├─→ Calculate hash (count:sumOfIDs:validIds)
  │     ├─→ If hash matches: use cached territory
  │     └─→ If hash differs: recalculate (1.1x multiplier)
  ├─→ knowledge.updateKnownZones() [line 154]
  ├─→ knowledge.cleanStaleInformation() [line 157]
  │
  ├─→ IF currentGoalChain exists AND not complete AND not failed:
  │     ├─→ logger.updateGoalChain()
  │     └─→ executeCurrentGoal()
  │           ├─→ GoalExecutor.executeGoal()
  │           ├─→ GoalExecutor.executeGoal()
  │           │     ├─→ goal.canExecute() (uses BuildingService)
  │           │     ├─→ goal.execute() (if executable)
  │           │     │     ├─→ BuildingConstructor.buildX()
  │           │     │     │     └─→ tilemapSystem.findBuildingSpot()
  │           │     │     │     └─→ Create building entity
  │           │     │     └─→ Deduct resources
  │           │     ├─→ verifyBuildingCreation() (Phase 6: Execution Verification)
  │           │     │     ├─→ Invalidate BuildingService cache
  │           │     │     ├─→ Verify building exists in Building.list
  │           │     │     └─→ Check building count increased
  │           │     └─→ Return { success, shouldAdvance, shouldClearChain }
  │           └─→ If shouldAdvance: goalChain.advance()
  │           └─→ If shouldClearChain: currentGoalChain = null
  │
  └─→ ELSE (no chain OR complete OR failed):
        ├─→ IF chain failed:
        │     ├─→ recordChainFailure() [line 178]
        │     ├─→ analyzeChainFailure() [line 181]
        │     └─→ IF recovery goal found: create chain and execute [line 184-189]
        ├─→ Clear failed chains [line 192]
        ├─→ evaluateNewGoals() [line 199]
        │     ├─→ Check isNonEconomicFaction() [line 217]
        │     ├─→ strategy.evaluateEconomicGoals() (skipped for non-economic) [line 221]
        │     ├─→ strategy.evaluateMilitaryGoals() [line 222]
        │     ├─→ strategy.evaluateExpansionGoals() [line 223]
        │     ├─→ strategy.evaluateResourceScoutingGoals() [line 224]
        │     ├─→ strategy.evaluateDefenseGoals() [line 225]
        │     ├─→ Add recovery goals from _pendingRecoveryGoals [line 233]
        │     ├─→ Add fallback scout goals from suggestedFallbackGoals [line 237-251]
        │     ├─→ checkResourceBalance() (Phase 8) [line 264]
        │     ├─→ recordGoalConsideration() for all goals (Phase 9) [line 267]
        │     ├─→ Apply resource balance boosts BEFORE filtering (Phase 8) [line 274]
        │     ├─→ Apply goal forcing BEFORE filtering (Phase 9) [line 304]
        │     ├─→ Filter goals [line 315]
        │     │     ├─→ Filter utility <= 0
        │     │     ├─→ Filter shouldAvoidGoal()
        │     │     ├─→ Keep high-value/high-utility/forced goals even if blocked
        │     │     ├─→ recordLocationBlocking() if canPlace() fails
        │     │     └─→ Keep high-value/high-utility/forced goals even if no location
        │     ├─→ Apply failure penalties (getAdjustedUtility) [line 385]
        │     ├─→ Sort by adjusted utility [line 405]
        │     ├─→ IF no valid goals: generateFallbackGoals() [line 411]
        │     ├─→ Select top goal [line 423]
        │     ├─→ Check shouldAvoidChainGoal() [line 476]
        │     ├─→ Force dependency chain for high-value goals [line 487]
        │     └─→ GoalChain.create(topGoal) [line 505]
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
- **Line 246**: `House.evaluateAI()` - Daily evaluation entry point
  - Iterates all houses, calls `house.ai.evaluateAndAct()`
  - Error handling prevents one faction from breaking others
  - Errors logged with stack traces for debugging
- **Line 30**: `calculateBaseTerritory()` - Territory calculation
  - Delegates to `house.ai.territory.updateTerritory()`
  - Delegates to `house.ai.territory.absorbColonies()`
  - Updates `baseCenter`, `baseCenterCoords`, `baseRadius` from TerritoryManager
- **Line 50**: `isInBaseTerritory(x, y)` - Colony detection
  - Delegates to `house.ai.territory.isInBaseTerritory(x, y)`
- **Line 109**: `updatePatrolList()` - Patrol building tracking

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
12. **Verifies execution** (Phase 6): Confirms buildings are actually created after goal execution
13. **Differentiates mine types** (Phase 2.4): Distinguishes stone mines from cave mines for proper resource production
14. **Monitors resource balance** (Phase 8): Identifies imbalances and boosts gathering building utilities
15. **Prevents stagnation** (Phase 9): Tracks goal considerations and forces selection after multiple attempts
16. **Forces dependency chains** (Phase 7): Ensures high-value goals create prerequisite chains even when blocked
17. **Validates locations** (Phase 3): Pre-checks building placement before goal selection
18. **Adaptive learning**: Tracks failures and adjusts goal utilities to prevent repeated failures
19. **Non-economic faction support**: Excludes certain factions (Brotherhood, Outlaws, Norsemen, Mercenaries) from economic goals and production monitoring
20. **Production monitoring**: Tracks resource production rates, detects issues, and triggers recovery goals when production broken for 2+ days
21. **Production diagnostics**: Identifies root causes of production problems (missing buildings, serf assignment, deposit logic)
22. **Fallback goals**: Generates basic infrastructure goals when no valid goals available to keep factions active
23. **Location blocking tracking**: Tracks location blocking separately from failures and suggests scouting when appropriate
24. **Chain failure analysis**: Analyzes failed chains to suggest recovery goals based on blocking factors
25. **Deferred goals**: Defers gather goals until building dependencies are satisfied in chain
26. **Production feasibility**: Validates production capacity before creating gather goals, builds additional buildings if needed
27. **Resource gap detection**: Detects when resources not available in territory and suggests scouting
28. **Deadlock prevention**: Prevents stone production deadlocks (BUILD_MINE needs stone but production broken)
29. **Logger faction filtering**: Only enables detailed logging for specific factions (Teutons, Goths, Celts, Franks) to reduce log noise

### Architecture Principles

- **Single Source of Truth**: Each data type has one clear access point (BuildingService for buildings, FactionAI for military units)
- **Fail Fast**: No fallback paths - errors caught immediately with clear messages
- **Separation of Concerns**: Clear responsibilities (FactionAI orchestrates, GoalExecutor executes, MilitaryManager handles military)
- **Performance Optimized**: Multiple caching layers, iterative algorithms, hash-based invalidation
- **Easily Diagnosable**: Structured errors, resolution path tracing, optional debug logging
- **Modular & Extensible**: Clear extension points for new goals, buildings, factions, strategies

The system is modular, extensible, and designed to create believable, strategic NPC faction behavior that adapts to the game state while maintaining faction-specific characteristics. All components are optimized for performance, reliability, and ease of debugging.
