# Battlegrounds System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Game Modes](#game-modes)
5. [Map System](#map-system)
6. [UI System](#ui-system)
7. [Integration](#integration)
8. [Data Structures](#data-structures)
9. [API Reference](#api-reference)
10. [Configuration](#configuration)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The Battlegrounds system is a comprehensive PvP (Player vs Player) matchmaking and gameplay system integrated into the Lambic game. It provides:

- **Lobby System**: Player queuing, team selection, and match preparation
- **Match Management**: Full lifecycle management of Battlegrounds matches
- **Game Modes**: Deathmatch, Skirmish, and Assault modes with unique rules
- **Map Generation**: Procedural map generation with validation and post-processing
- **Classic Maps**: Player-voted map library with weighted selection
- **Statistics**: Comprehensive tracking of player performance
- **UI System**: Complete client-side interface for lobby, match, and post-game

### Key Features

- **Three Game Modes**: Deathmatch (FFA), Skirmish (Team vs Team), Assault (Attack/Defend)
- **Dynamic Maps**: Procedural generation with 6 map types (Continental, Islands, Mainland, Wild, Caves, Dungeons)
- **Team Balancing**: Automatic elite NPC spawning for unbalanced teams
- **Spectator Mode**: Dead players can spectate ongoing matches
- **Map Voting**: Players vote to save maps as "Classic Maps" or rate existing ones
- **Statistics Tracking**: Wins, losses, kills, deaths, K/D ratio, win rate
- **Leaderboard**: Global rankings with multiple sorting options

---

## Architecture

### System Overview

The Battlegrounds system follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
├─────────────────────────────────────────────────────────────┤
│  LobbyUI │ MatchUI │ PostGameUI │ MapPreviewUI │ Scoreboard │
└──────────────┬──────────────────────────────────────────────┘
               │ Socket Messages
┌──────────────▼──────────────────────────────────────────────┐
│                   Server (Node.js)                           │
├─────────────────────────────────────────────────────────────┤
│  LobbyManager ──► MatchManager ──► GameMode (Active)        │
│       │                │                    │                │
│       │                ├──► MapGenerator                     │
│       │                ├──► MapValidator                     │
│       │                ├──► MapPostProcessor                 │
│       │                ├──► HouseManager                     │
│       │                ├──► EliteNPCManager                  │
│       │                ├──► ScoreManager                     │
│       │                ├──► SpectatorSystem                  │
│       │                ├──► LeashManager                     │
│       │                ├──► WeatherManager                   │
│       │                ├──► MapLibrary                       │
│       │                └──► MapVotingSystem                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Match Lifecycle Flow:**

```
1. Player joins lobby (LobbyManager)
   ↓
2. Lobby reaches capacity → Countdown starts
   ↓
3. Match starts (MatchManager.startMatch)
   ↓
4. Map generation (MapGenerator)
   ↓
5. Map validation (MapValidator)
   ↓
6. Post-processing (MapPostProcessor)
   ↓
7. Map preview broadcast (10 seconds)
   ↓
8. Player spawning (MatchManager.spawnParticipants)
   ↓
9. Match begins (GameMode.init)
   ↓
10. Match updates (every 1 second)
    ↓
11. Win condition check (GameMode.checkWinCondition)
    ↓
12. Match ends (MatchManager.endMatch)
    ↓
13. Statistics saved (ScoreManager)
    ↓
14. Map voting (MapVotingSystem)
    ↓
15. Post-game cooldown (10 seconds)
    ↓
16. Match cleanup (MatchManager.finishMatch)
```

### Manager Dependencies

```
BattlegroundsMatchManager (Core)
├── Requires:
│   ├── MapGenerator (injected)
│   ├── HouseManager (injected)
│   ├── EliteNPCManager (injected)
│   ├── ScoreManager (injected)
│   ├── MapLibrary (injected)
│   ├── WeatherManager (injected)
│   └── MapContextManager (global)
│
├── Creates:
│   ├── PathfindingManager
│   ├── MapPostProcessor
│   ├── EliteNPCBehavior
│   ├── LeashManager
│   ├── SpectatorSystem
│   └── MapVotingSystem
│
└── Coordinates:
    └── GameMode instances (Deathmatch/Skirmish/Assault)

BattlegroundsLobbyManager
└── Requires:
    └── MatchManager (injected)

BattlegroundsScoreManager
└── Uses:
    └── Player.list (global)

BattlegroundsMapLibrary
└── Uses:
    └── File system (fs module)
```

---

## Components

### BattlegroundsMatchManager

**Location**: `server/js/battlegrounds/BattlegroundsMatchManager.js`

**Purpose**: Core orchestrator for Battlegrounds matches. Manages match lifecycle, coordinates game modes, and integrates all subsystems.

**Key Responsibilities**:
- Match initialization and state management
- Map generation coordination
- Player spawning and teleportation
- Match timer and update loop
- Game mode lifecycle management
- Cleanup and resource management

**Key Methods**:

```javascript
// Start a new match
async startMatch(matchConfig) → Promise<void>

// End match and calculate results
endMatch(endReason) → void

// Spawn all participants
spawnParticipants() → void

// Calculate spawn points
calculateSpawnPoints(gameMode, mapData) → Object<string, {x, y, z}>

// Generate map for match
async generateMap(gameMode, mapSize) → Promise<Object>

// Update match state (called every second)
update() → void

// Cleanup after match
finishMatch() → void
```

**State Management**:
- `currentMatch`: Active match object (null when no match)
- `matchTimer`: Reference to match duration timer
- `updateInterval`: Reference to update loop interval

**Dependencies** (injected via setter methods):
- `mapGenerator`: BattlegroundsMapGenerator instance
- `houseManager`: BattlegroundsHouseManager instance
- `eliteNPCManager`: BattlegroundsEliteNPCManager instance
- `scoreManager`: BattlegroundsScoreManager instance
- `mapLibrary`: BattlegroundsMapLibrary instance
- `weatherManager`: BattlegroundsWeatherManager instance

**Lifecycle**:
1. `startMatch()` - Initialize match state
2. `generateMap()` - Create map
3. `broadcastMapPreview()` - Show preview (10s)
4. `spawnParticipants()` - Place players
5. `beginMatch()` - Start gameplay
6. `update()` - Periodic updates (1s interval)
7. `endMatch()` - Calculate results
8. `finishMatch()` - Cleanup

---

### BattlegroundsLobbyManager

**Location**: `server/js/battlegrounds/BattlegroundsLobbyManager.js`

**Purpose**: Manages player lobby, queuing, team selection, and matchmaking.

**Key Responsibilities**:
- Player join/leave handling
- Lobby state management
- Team assignment (for team modes)
- Game mode selection
- Countdown timer management
- Lobby chat

**Key Methods**:

```javascript
// Join lobby
joinLobby(playerId, playerName) → {success, message, ...}

// Leave lobby
leaveLobby(playerId) → void

// Select team (for Skirmish/Assault)
selectTeam(playerId, team) → {success, message}

// Send lobby chat message
sendLobbyChat(playerId, message) → {success}

// Get lobby state for player
getLobbyState(playerId) → Object
```

**State Structure**:
```javascript
lobbyState = {
  players: Array<{id, name, team}>,
  waitingList: Array<playerId>,
  gameMode: 'deathmatch' | 'skirmish' | 'assault',
  countdownTimer: number,
  status: 'waiting' | 'countdown' | 'map_selection' | 'in_match',
  chatMessages: Array<Object>
}
```

**Configuration**:
- `MAX_PLAYERS`: 10 (maximum players in active lobby)
- `COUNTDOWN_TIME`: 15 seconds (countdown before match start)

---

### BattlegroundsScoreManager

**Location**: `server/js/battlegrounds/BattlegroundsScoreManager.js`

**Purpose**: Tracks and manages player statistics and match scores.

**Key Responsibilities**:
- Calculate final match scores
- Track player statistics (wins, losses, kills, deaths)
- Update player records after matches
- Generate leaderboards

**Key Methods**:

```javascript
// Calculate final scores for match
calculateFinalScores(match, endReason) → void

// Save match statistics to player records
saveMatchStatistics(match) → void

// Initialize player stats
initializePlayerStats(playerId) → void

// Get player statistics
getPlayerStatistics(playerId) → Object

// Get leaderboard
getLeaderboard(sortBy) → Array<Object>
```

**Player Statistics Structure**:
```javascript
player.battlegroundsStats = {
  matchesPlayed: number,
  wins: number,
  losses: number,
  kills: number,
  deaths: number,
  favoriteGameMode: Object<string, number>,
  favoriteMap: Object<string, number>
}
```

**Leaderboard Sorting Options**:
- `'wins'` - Sort by total wins (default)
- `'kills'` - Sort by total kills
- `'kdr'` - Sort by kill/death ratio
- `'winRate'` - Sort by win rate percentage
- `'matchesPlayed'` - Sort by total matches

---

### BattlegroundsMapGenerator

**Location**: `server/js/battlegrounds/BattlegroundsMapGenerator.js`

**Purpose**: Generates procedurally generated maps for Battlegrounds matches.

**Map Types**:
- `continental` - Large landmasses with varied terrain
- `islands` - Multiple islands separated by water
- `mainland` - Single large landmass
- `wild` - Dense forests and wilderness
- `caves` - Underground cave systems (z=-1)
- `dungeons` - Underground dungeon systems (z=-1)

**Key Methods**:

```javascript
// Generate battleground map
async generateBattlegroundMap(gameMode, mapSize) → Promise<Object>
```

**Map Size Calculation**:
- 1-4 players: 64x64 tiles
- 5-7 players: 80x80 tiles
- 8-10 players: 96x96 tiles

**Return Structure**:
```javascript
{
  mapType: string,
  mapSize: number,
  worldData: Array<Array<number>>, // Terrain data [z][row][col]
  entrances: Array<{x, y, z}>,
  startingZ: number,
  raw: boolean,
  metadata: Object
}
```

---

### BattlegroundsMapValidator

**Location**: `server/js/battlegrounds/BattlegroundsMapValidator.js`

**Purpose**: Validates generated maps to ensure playability.

**Validation Checks**:
- Sufficient walkable terrain
- Proper entrance placement (for cave/dungeon maps)
- Minimum space requirements for game mode
- Connectivity checks (all areas reachable)

**Key Methods**:

```javascript
// Validate map for game mode
validateMap(mapData, gameMode) → {valid: boolean, issues: Array<string>}
```

---

### BattlegroundsMapPostProcessor

**Location**: `server/js/battlegrounds/BattlegroundsMapPostProcessor.js`

**Purpose**: Applies game mode-specific modifications to generated maps.

**Post-Processing Steps**:
- Starting area creation (safe zones)
- Capture point placement (Assault mode)
- Stronghold construction (Assault mode)
- Lighting adjustments
- Path clearing for spawn areas

**Key Methods**:

```javascript
// Post-process map for game mode
postProcessMap(mapData, gameMode, participants) → Object
```

---

### BattlegroundsMapLibrary

**Location**: `server/js/battlegrounds/BattlegroundsMapLibrary.js`

**Purpose**: Manages "Classic Maps" - player-voted maps saved for reuse.

**Features**:
- Map storage and retrieval
- Filtering by game mode and map size
- Weighted random selection based on positive votes
- Play count tracking
- Positive vote tracking

**Key Methods**:

```javascript
// Save map as Classic Map
saveClassicMap(mapId, mapData, metadata) → void

// Get random Classic Map (weighted)
getRandomClassicMap(gameMode, mapSize) → Object | null

// Get all Classic Maps matching criteria
getAllClassicMaps(gameMode, mapSize) → Array<Object>

// Increment play count
incrementPlayCount(mapId) → void

// Increment positive votes
incrementPositiveVotes(mapId) → void

// Delete Classic Map
deleteClassicMap(mapId) → void
```

**Map Selection Logic**:
- 15% chance to use Classic Map (if available)
- Weighted selection: Maps with more positive votes have higher chance
- Weight formula: `1 + positiveVotes` (base weight of 1)

---

### BattlegroundsMapVotingSystem

**Location**: `server/js/battlegrounds/BattlegroundsMapVotingSystem.js`

**Purpose**: Manages map voting at the end of matches.

**Voting Rules**:
- **New Maps**: If majority (>50%) vote "yes", map is saved as Classic Map
- **Classic Maps**: If 100% of human players vote "yes", `positiveVotes` counter increments
- Voting duration: 10 seconds (during post-game cooldown)
- Only human players can vote (NPCs excluded)

**Key Methods**:

```javascript
// Start voting session
startVoting(matchId, match) → void

// Record player vote
recordVote(playerId, vote) → void

// Process votes and determine outcome
processVotes(matchId) → void

// Cleanup voting session
cleanupVoting(matchId) → void
```

**Vote Structure**:
```javascript
activeVotes[matchId] = {
  mapId: string | null,
  isClassicMap: boolean,
  mapData: Object,
  metadata: Object,
  votes: Object<string, 'yes' | 'no'>,
  humanPlayers: Array<playerId>,
  votingDuration: number,
  startTime: number,
  votingTimer: Timeout
}
```

---

### BattlegroundsHouseManager

**Location**: `server/js/battlegrounds/BattlegroundsHouseManager.js`

**Purpose**: Creates temporary "Houses" (factions) for Battlegrounds matches to override global faction rules.

**Features**:
- Creates temporary House objects per player/team
- Overrides global `isAlly()` and `allyCheck()` functions
- Houses marked with `isBattlegroundHouse: true`
- Automatic cleanup after match ends

**Key Methods**:

```javascript
// Create temporary house for player/team
createTemporaryHouse(houseId, houseName, team) → string

// Check if house is temporary
isTemporaryHouse(houseId) → boolean

// Cleanup all temporary houses
cleanupAllTemporaryHouses() → void
```

---

### BattlegroundsEliteNPCManager

**Location**: `server/js/battlegrounds/BattlegroundsEliteNPCManager.js`

**Purpose**: Spawns and manages elite NPCs to balance teams.

**Spawn Logic**:
- Spawns when team size difference ≥ 2
- Spawns difference / 2 NPCs (rounded down)
- NPCs assigned to smaller team
- Elite NPCs use enhanced AI behaviors

**Walkability Validation**:
- Uses context-aware `getTile()` with battleground map context
- Validates spawn points using pathfinding grids when available
- Searches nearby tiles (up to 2-tile radius) if initial spawn point is not walkable
- Falls back to terrain-based validation if pathfinding grid unavailable
- Checks for water tiles (non-walkable) and uses pathfinding grid values

**Key Methods**:

```javascript
// Spawn elite NPCs for match
spawnEliteNPCs(match) → Array<npcId>

// Clear all elite NPCs
clearAll() → void

// Get spawn point for NPC (validates walkability)
getNPCSpawnPoint(match, team, index) → {x, y, z} | null
```

---

### BattlegroundsEliteNPCBehavior

**Location**: `server/js/battlegrounds/BattlegroundsEliteNPCBehavior.js`

**Purpose**: Implements enhanced AI behaviors for elite NPCs in Battlegrounds.

**Behaviors**:
- Attack-move towards nearest enemy
- Guard objectives (for Assault mode)
- Team coordination
- Aggressive pursuit within range

**Key Methods**:

```javascript
// Update NPC behaviors
updateNPCBehaviors(match) → void

// Find nearby enemy
findNearbyEnemy(npc, match) → Player | null
```

---

### BattlegroundsSpectatorSystem

**Location**: `server/js/battlegrounds/BattlegroundsSpectatorSystem.js`

**Purpose**: Allows dead players to spectate ongoing matches.

**Features**:
- Filters to battleground participants only
- Spectator targeting (cycle through alive players)
- Camera following
- Event subscription for match updates

**Key Methods**:

```javascript
// Start spectating for player
startSpectating(playerId, matchId) → void

// Stop spectating
stopSpectating(playerId) → void

// Switch spectator target
switchSpectatorTarget(playerId, targetPlayerId) → void

// Get previous spectator target
getPreviousSpectatorTarget(playerId) → string | null
```

---

### BattlegroundsLeashManager

**Location**: `server/js/battlegrounds/BattlegroundsLeashManager.js`

**Purpose**: Prevents players from leaving designated combat zones (especially for cave/dungeon maps).

**Leash Logic**:
- Defines valid combat area bounds
- Teleports players back if they leave bounds
- Applies damage warning before teleport
- Configurable leash radius

**Key Methods**:

```javascript
// Initialize leash for match
initializeLeash(match) → void

// Check and enforce leash
checkLeash(playerId, match) → void

// Cleanup leash
cleanupLeash(matchId) → void
```

---

### BattlegroundsWeatherManager

**Location**: `server/js/battlegrounds/BattlegroundsWeatherManager.js`

**Purpose**: Manages randomized weather for Battlegrounds matches (independent of main world weather).

**Weather Types**:
- Clear
- Rain
- Snow
- Fog

**Key Methods**:

```javascript
// Set random weather for match
setRandomWeather(matchId) → void

// Get current weather
getWeather(matchId) → string | null

// Cleanup weather
cleanupWeather(matchId) → void
```

---

### BattlegroundsAssaultSpawnManager

**Location**: `server/js/battlegrounds/BattlegroundsAssaultSpawnManager.js`

**Purpose**: Manages attacker and defender NPC spawning for Assault mode.

**Spawn Patterns**:
- **Attackers (Team 1)**: Steady flow from spawn points
- **Defenders (Team 2)**: Finite initial spawns, no respawns

**Key Methods**:

```javascript
// Start attacker spawns
startAttackerSpawns(match) → void

// Initialize defenders
initializeDefenders(match) → void

// Cleanup spawns
cleanup() → void
```

---

### BattlegroundsPathfindingManager

**Location**: `server/js/battlegrounds/BattlegroundsPathfindingManager.js`

**Purpose**: Generates and manages pathfinding grids for battleground maps.

**Integration**:
- Uses `PF` (Pathfinding.js) library
- Generates walkable grids from terrain data
- Stores grids in MapContextManager for context-aware pathfinding

**Key Methods**:

```javascript
// Generate pathfinding grid for map
generatePathfindingGrid(mapData, matchId) → Grid

// Get pathfinding grid
getPathfindingGrid(matchId) → Grid | null
```

---

## Game Modes

### Deathmatch Mode

**File**: `server/js/battlegrounds/game_modes/DeathmatchMode.js`

**Rules**:
- Free-for-all (no teams)
- Last player alive wins
- Players spawn in a circle around map center
- No respawns

**Spawn Pattern**:
- Evenly spaced in circle (radius = 35% of map size)
- Angle step: `2π / playerCount`

**Win Condition**:
- Only one player remains alive

**Statistics**:
- Tracks individual kills/deaths
- Winner determined by survival

---

### Skirmish Mode

**File**: `server/js/battlegrounds/game_modes/SkirmishMode.js`

**Rules**:
- Team vs Team (2 teams)
- Eliminate all enemy team members
- Players spawn on opposite sides of map
- Team balancing via elite NPCs

**Spawn Pattern**:
- **Team 1**: Left side (20% from left edge)
- **Team 2**: Right side (80% from left edge)
- Players spaced vertically along center line

**Win Condition**:
- All members of one team eliminated

**Statistics**:
- Team-based scoring
- Individual K/D tracked per player

---

### Assault Mode

**File**: `server/js/battlegrounds/game_modes/AssaultMode.js`

**Rules**:
- Attackers (Team 1) vs Defenders (Team 2)
- Attackers must capture central point
- Defenders must prevent capture
- Capture point at map center
- Capture timer: 10 seconds (must hold continuously)

**Spawn Pattern**:
- **Attackers**: Left side (15% from left edge)
- **Defenders**: Around capture point/stronghold

**Capture Mechanics**:
- Radius: 3 tiles from capture point center
- Only attackers can capture
- Timer resets if defenders enter radius
- Timer decays if no attackers present

**NPC Spawning**:
- **Attackers**: Continuous spawns from spawn points
- **Defenders**: Finite initial spawns (no respawns)

**Win Condition**:
- **Attackers**: Capture point held for 10 seconds
- **Defenders**: Prevent capture until time limit

**Integration**:
- Uses `BattlegroundsAssaultSpawnManager` for NPC management

---

## Map System

### Map Generation Pipeline

```
1. MatchManager requests map generation
   ↓
2. MapGenerator.generateBattlegroundMap()
   ├── Select map type (random)
   ├── Calculate map size (based on player count)
   ├── Call genesis.generate() with presets
   └── Extract terrain data
   ↓
3. MapValidator.validateMap()
   ├── Check walkable terrain percentage
   ├── Verify entrance placement (caves/dungeons)
   ├── Check connectivity
   └── Return validation result
   ↓
4. If valid → MapPostProcessor.postProcessMap()
   ├── Create starting areas
   ├── Place capture points (Assault)
   ├── Build strongholds (Assault)
   ├── Adjust lighting
   └── Clear spawn paths
   ↓
5. Map registered with MapContextManager
   ↓
6. Pathfinding grid generated
   ↓
7. Map ready for match
```

### Map Types

#### Continental
- Large landmasses with varied terrain
- Suitable for all game modes
- Terrain: Forests, grass, water, mountains

#### Islands
- Multiple islands separated by water
- Good for Skirmish and Assault
- Terrain: Islands with water barriers

#### Mainland
- Single large landmass
- Best for Deathmatch and Skirmish
- Terrain: Varied, mostly land

#### Wild
- Dense forests and wilderness
- Good for all modes
- Terrain: Heavy forest, brush, obstacles

#### Caves
- Underground cave systems (z=-1)
- Walkable vs non-walkable tiles
- Dark, requires torches
- Good for close-quarters combat

#### Dungeons
- Underground dungeon systems (z=-1)
- Similar to caves but warmer color scheme
- More structured layout
- Good for tactical gameplay

### Classic Maps

**Storage**: File-based in `server/data/battlegrounds_maps/`

**Metadata Structure**:
```javascript
{
  mapId: string,
  mapType: string,
  mapSize: number,
  worldData: Array,
  entrances: Array,
  startingZ: number,
  metadata: {
    gameMode: string,
    timesPlayed: number,
    positiveVotes: number,
    createdAt: timestamp,
    postProcessing: Object
  }
}
```

**Selection Algorithm**:
1. Filter maps by game mode and map size
2. 15% chance to select Classic Map (if available)
3. Weighted random selection: `weight = 1 + positiveVotes`
4. Return selected map or generate new one

---

## UI System

### BattlegroundsLobbyUI

**File**: `client/js/ui/BattlegroundsLobbyUI.js`

**Features**:
- Player list with team assignments
- Team selection buttons (Skirmish/Assault)
- Lobby chat
- Countdown timer display
- Waiting list display
- Leave lobby button
- Map preview integration (renders in center column)

**UI Dimensions**:
- Width: 1000px (max 80vw)
- Max Height: 75vh
- Position: Centered on screen
- Z-index: 2000 (above game UI, below modals)

**State Management**:
- Smart merge of lobby state to preserve existing data
- Only replaces `players`/`participants` arrays when new non-empty arrays provided
- Preserves game mode when hiding UI

**Methods**:
```javascript
show(lobbyState) → void
hide() → void
updateLobbyState(lobbyState) → void
addChatMessage(message, sender, senderId) → void
selectTeam(team) → void
sendChatMessage(message) → void
leaveLobby() → void
createPlayerDiv(player) → HTMLElement  // Helper for player display
```

**Socket Messages**:
- `selectBattlegroundsTeam` (client → server)
- `battlegroundsLobbyChat` (client → server)
- `leaveBattlegroundsLobby` (client → server)
- `battlegroundsLobbyUpdate` (server → client)
- `battlegroundsLobbyChat` (server → client)

---

### BattlegroundsMatchUI

**File**: `client/js/ui/BattlegroundsMatchUI.js`

**Features**:
- Match status display
- Countdown timer (with color coding)
- Game mode and map info
- Player score display (K/D)

**Methods**:
```javascript
show() → void
hide() → void
updateMatchData(matchData) → void
updateTimer() → void
updateScores(scores, gameMode) → void
```

**Socket Messages**:
- `battlegroundsMatchUpdate` (server → client)

**Timer Color Coding**:
- Normal: Green
- Warning (≤2 min): Orange
- Critical (≤1 min): Red

---

### BattlegroundsPostGameUI

**File**: `client/js/ui/BattlegroundsPostGameUI.js`

**Features**:
- Winner announcement
- Scoreboard (ranked by placement)
- Statistics display
- Map voting interface
- Voting results display

**Methods**:
```javascript
show(endData) → void
hide() → void
updateScoreboard(scores, gameMode, winner) → void
startVoting(votingData) → void
updateVoting(voteData) → void
showVotingResults(resultsData) → void
sendVote(vote) → void
```

**Socket Messages**:
- `battlegroundsMatchEnd` (server → client)
- `battlegroundsVotingStart` (server → client)
- `battlegroundsVotingUpdate` (server → client)
- `battlegroundsVotingResults` (server → client)
- `battlegroundsMapVote` (client → server)

**Scoreboard Highlighting**:
- Top 3: Gold, Silver, Bronze backgrounds
- Winner row: Green background

---

### BattlegroundsMapPreviewUI

**File**: `client/js/ui/BattlegroundsMapPreviewUI.js`

**Features**:
- Map terrain preview
- Spawn point markers
- Team indicators (for team modes)
- 10-second display duration
- Dynamic scaling to fit container

**Map Rendering**:
- **Regular maps**: Uses `WorldMapRenderer`
- **Caves**: Uses `CaveMapRenderer` (greyscale)
- **Dungeons**: Custom renderer (warmer colors: browns/oranges)

**Scaling**:
- Calculates available container dimensions dynamically
- Maintains 1:1 aspect ratio (square maps)
- Fills container while preserving aspect ratio
- Base dimensions: 700x550px (fallback if container size unavailable)
- Canvas uses `object-fit: contain` for proper scaling

**Methods**:
```javascript
show(previewData) → void
hide() → void
render() → void
renderToContainer(targetContainer) → void  // Renders into specific container (for lobby)
renderWorldMap(mapData, mapSize, gameMode, teams, spawnPoints) → void
renderCaveMap(mapData, mapSize, gameMode, teams, spawnPoints) → void
renderDungeonMap(mapData, mapSize, gameMode, teams, spawnPoints) → void
```

**Socket Messages**:
- `battlegroundsMapPreview` (server → client)

**Spawn Marker Colors**:
- Deathmatch: Green with numbers
- Team modes: Blue (Team 1) / Red (Team 2) with "T1"/"T2" labels

---

### ScoreboardUI (Battlegrounds Tab)

**File**: `client/js/ui/ScoreboardUI.js`

**Features**:
- Tab system (Resources / Battlegrounds)
- Sortable leaderboard
- Player statistics display

**Methods**:
```javascript
switchTab(tabName) → void
updateBattlegroundsLeaderboard(leaderboardData, sortBy) → void
requestBattlegroundsLeaderboard(sortBy) → void
```

**Sort Options**:
- Wins
- Kills
- K/D Ratio
- Win Rate
- Matches Played

**Socket Messages**:
- `getBattlegroundsLeaderboard` (client → server)
- `battlegroundsLeaderboard` (server → client)

---

## Integration

### Server Initialization

**File**: `lambic.js`

**Initialization Order**:
```javascript
1. MapContextManager (global)
2. BattlegroundsMatchManager
3. BattlegroundsLobbyManager
4. BattlegroundsScoreManager
5. BattlegroundsMapLibrary
6. BattlegroundsMapGenerator
7. BattlegroundsWeatherManager
8. BattlegroundsHouseManager
9. BattlegroundsEliteNPCManager

// Dependency Injection
lobbyManager.setMatchManager(matchManager)
matchManager.setMapGenerator(mapGenerator)
matchManager.setHouseManager(houseManager)
matchManager.setEliteNPCManager(eliteNPCManager)
matchManager.setScoreManager(scoreManager)
matchManager.setMapLibrary(mapLibrary)
matchManager.setWeatherManager(weatherManager)
```

**Global Access**:
```javascript
global.battlegroundsMatchManager
global.battlegroundsLobbyManager
global.battlegroundsScoreManager
global.battlegroundsMapLibrary
global.battlegroundsMapGenerator
global.battlegroundsWeatherManager
global.battlegroundsHouseManager
global.battlegroundsEliteNPCManager
```

### Socket Message Handlers

#### Server → Client Messages

| Message | Purpose | Data Structure |
|---------|---------|----------------|
| `battlegroundsLobbyUpdate` | Lobby state change | `{lobby: Object}` |
| `battlegroundsLobbyChat` | Chat message | `{message: string, sender: string, senderId: string}` |
| `battlegroundsMapPreview` | Map preview data | `{preview: Object}` |
| `battlegroundWorld` | Battleground world data | `{matchId, mapSize, tileSize, startingZ, worldData}` |
| `init` | Player initialization | `{x, y, z, inBattleground, battlegroundMatchId, mapSize, tileSize, worldData}` |
| `battlegroundsMatchUpdate` | Match state update | `{match: Object}` |
| `battlegroundsMatchEnd` | Match ended | `{endData: Object}` |
| `battlegroundsVotingStart` | Voting started | `{matchId, isClassicMap, mapId, ...}` |
| `battlegroundsVotingUpdate` | Voting progress | `{yesVotes, noVotes, ...}` |
| `battlegroundsVotingResults` | Voting results | `{results: Object}` |
| `battlegroundsLeaderboard` | Leaderboard data | `{data: Array, sortBy: string}` |
| `openBattlegroundsLobby` | Open lobby UI | `{lobbyState: Object}` |

#### Client → Server Messages

| Message | Purpose | Data Structure |
|---------|---------|----------------|
| `joinBattlegroundsLobby` | Join lobby | (no data) |
| `leaveBattlegroundsLobby` | Leave lobby | (no data) |
| `selectBattlegroundsTeam` | Select team | `{team: 'team1' | 'team2'}` |
| `battlegroundsLobbyChat` | Send chat | `{message: string}` |
| `battlegroundsMapVote` | Vote on map | `{vote: 'yes' | 'no'}` |
| `getBattlegroundsLeaderboard` | Request leaderboard | `{sortBy: string}` |
| `prevBattlegroundsSpectator` | Previous spectator target | (no data) |

### Client-Side Message Routing

**File**: `client/js/core/SocketMessageHandler.js`

**Handlers**:
```javascript
handleOpenBattlegroundsLobby(data)
handleBattlegroundsLobbyUpdate(data)
handleBattlegroundsLobbyChat(data)
handleBattlegroundsMapPreview(data)
handleBattlegroundWorld(data)  // Sets window.battlegroundWorld and window.inBattleground
handleInit(data)  // Handles init with inBattleground flag
handleBattlegroundsMatchUpdate(data)
handleBattlegroundsMatchEnd(data)
handleBattlegroundsVotingStart(data)
handleBattlegroundsVotingUpdate(data)
handleBattlegroundsVotingResults(data)
handleBattlegroundsLeaderboard(data)
```

**Client-Side World Context Switching**:

The client uses global window variables to track battleground state:

```javascript
window.inBattleground = boolean  // True when player is in a battleground
window.battlegroundWorld = Array  // Battleground world data [z][row][col]
window.battlegroundMapSize = number  // Battleground map size
window.battlegroundTileSize = number  // Battleground tile size (usually 64)
window.currentBattlegroundMatchId = string  // Current match ID
```

**GameLoopManager** checks `window.inBattleground` to determine which world to render:
- If `true`: Uses `window.battlegroundWorld`, `window.battlegroundMapSize`, `window.battlegroundTileSize`
- If `false`: Uses main world (`window.world`, `window.mapSize`, `window.tileSize`)

**Critical Functions**:
- `getTile()` in `client.js` checks `window.inBattleground` and uses `window.battlegroundWorld` when in battleground, ensuring tile lookups use the correct map data
- `spatialFilterEntities()` in `OptimizedGameLoop.js` filters entities by map context (battleground matchId) to prevent cross-map entity visibility

**Message Flow for Entering Battleground**:
1. Server sends `battlegroundWorld` message → Sets `window.battlegroundWorld` and `window.inBattleground = true`
2. Server sends `init` message with `inBattleground: true` → Confirms context switch
3. Server sends `playerUpdate` with battleground coordinates
4. Client renders battleground world in `GameLoopManager.gameLoop()`
5. `getTile()` function uses `window.battlegroundWorld` for tile lookups
6. Server filters entities by map context in `spatialFilterEntities()` to prevent cross-map entities

**Message Flow for Exiting Battleground**:
1. Server sends `init` message with `inBattleground: false` and main world data
2. Client sets `window.inBattleground = false` and restores main world context
3. Client renders main world in `GameLoopManager.gameLoop()`
4. `getTile()` function switches back to using `window.world`

### Entry Point

**File**: `server/js/Interact.js`

**Desk Interaction**:
- Players interact with "Desk" object in "garrison" building
- If garrison is friendly/neutral and has house → Option to join Battlegrounds
- Sends `joinBattlegroundsLobby` message
- Server responds with `openBattlegroundsLobby`

---

## Data Structures

### Match Object

```javascript
{
  matchId: string,
  gameMode: 'deathmatch' | 'skirmish' | 'assault',
  mapType: string,
  mapSize: number,
  participants: Array<{
    id: string,
    name: string,
    team: string | null,
    kills: number,
    deaths: number,
    alive: boolean,
    isNPC: boolean
  }>,
  teams: {
    team1?: {houseId: string, spawnPoints: Array},
    team2?: {houseId: string, spawnPoints: Array},
    [playerId]: {houseId: string} // For deathmatch
  },
  startTime: number | null,
  endTime: number | null,
  status: 'generating' | 'map_preview' | 'starting' | 'in_progress' | 'ending' | 'finished',
  mapData: Object,
  scores: Object<string, {kills, deaths, alive, placement}>,
  winner: string | 'team1' | 'team2' | null,
  eliteNPCs: Array<npcId>,
  mapContextId: string
}
```

### Participant Object

```javascript
{
  id: string,
  name: string,
  team: 'team1' | 'team2' | null,
  kills: number,
  deaths: number,
  alive: boolean,
  isNPC: boolean
}
```

### Lobby State

```javascript
{
  players: Array<{
    id: string,
    name: string,
    team: 'team1' | 'team2' | null
  }>,
  waitingList: Array<playerId>,
  gameMode: 'deathmatch' | 'skirmish' | 'assault' | null,
  countdownTimer: number,
  status: 'waiting' | 'countdown' | 'map_selection' | 'in_match',
  chatMessages: Array<Object>
}
```

### Player Statistics

```javascript
player.battlegroundsStats = {
  matchesPlayed: number,
  wins: number,
  losses: number,
  kills: number,
  deaths: number,
  favoriteGameMode: {
    [gameMode]: count
  },
  favoriteMap: {
    [mapType]: count
  }
}
```

### Map Data Structure

```javascript
{
  mapType: string,
  mapSize: number,
  worldData: Array<Array<number>>, // [z][row][col]
  entrances: Array<{x, y, z}>,
  startingZ: number,
  raw: boolean,
  classicMapId: string | null,
  postProcessing: Object | null,
  metadata: Object
}
```

---

## API Reference

### BattlegroundsMatchManager

#### `async startMatch(matchConfig)`
Start a new match.

**Parameters**:
- `matchConfig`: `{players: Array, gameMode: string}`

**Returns**: `Promise<void>`

**Throws**: Error if match already in progress or dependencies missing

---

#### `endMatch(endReason)`
End the current match and calculate results.

**Parameters**:
- `endReason`: `{winner, winnerType, reason, message}`

**Returns**: `void`

---

#### `spawnParticipants()`
Spawn all participants in the match.

**Returns**: `void`

---

#### `async generateMap(gameMode, mapSize)`
Generate or retrieve a map for the match.

**Parameters**:
- `gameMode`: `'deathmatch' | 'skirmish' | 'assault'`
- `mapSize`: `number`

**Returns**: `Promise<Object>` (map data)

---

#### `update()`
Update match state (called every second).

**Returns**: `void`

---

#### `finishMatch()`
Cleanup after match ends.

**Returns**: `void`

---

### BattlegroundsLobbyManager

#### `joinLobby(playerId, playerName)`
Join the lobby.

**Parameters**:
- `playerId`: `string`
- `playerName`: `string`

**Returns**: `{success: boolean, message: string, ...}`

---

#### `leaveLobby(playerId)`
Leave the lobby.

**Parameters**:
- `playerId`: `string`

**Returns**: `void`

---

#### `selectTeam(playerId, team)`
Select team for team-based modes.

**Parameters**:
- `playerId`: `string`
- `team`: `'team1' | 'team2'`

**Returns**: `{success: boolean, message: string}`

---

#### `sendLobbyChat(playerId, message)`
Send lobby chat message.

**Parameters**:
- `playerId`: `string`
- `message`: `string`

**Returns**: `{success: boolean}`

---

### BattlegroundsScoreManager

#### `calculateFinalScores(match, endReason)`
Calculate final scores for a match.

**Parameters**:
- `match`: Match object
- `endReason`: End reason object

**Returns**: `void`

---

#### `saveMatchStatistics(match)`
Save match statistics to player records.

**Parameters**:
- `match`: Match object

**Returns**: `void`

---

#### `getPlayerStatistics(playerId)`
Get player statistics.

**Parameters**:
- `playerId`: `string`

**Returns**: `Object` (stats with calculated winRate and kdr)

---

#### `getLeaderboard(sortBy)`
Get leaderboard sorted by specified field.

**Parameters**:
- `sortBy`: `'wins' | 'kills' | 'kdr' | 'winRate' | 'matchesPlayed'`

**Returns**: `Array<Object>` (sorted player stats)

---

### BattlegroundsMapLibrary

#### `saveClassicMap(mapId, mapData, metadata)`
Save a map as a Classic Map.

**Parameters**:
- `mapId`: `string`
- `mapData`: Map data object
- `metadata`: Metadata object

**Returns**: `void`

---

#### `getRandomClassicMap(gameMode, mapSize)`
Get a random Classic Map (weighted selection).

**Parameters**:
- `gameMode`: `string`
- `mapSize`: `number`

**Returns**: `Object | null`

---

#### `incrementPositiveVotes(mapId)`
Increment positive vote count for a Classic Map.

**Parameters**:
- `mapId`: `string`

**Returns**: `void`

---

## Configuration

### Match Timings

```javascript
matchDuration: 5 * 60 * 1000,        // 5 minutes
mapPreviewTime: 10 * 1000,            // 10 seconds
matchStartDelay: 5 * 1000,            // 5 seconds
postGameCooldown: 10 * 1000,          // 10 seconds
updateIntervalMs: 1000,               // 1 second
```

### Lobby Configuration

```javascript
MAX_PLAYERS: 10,
COUNTDOWN_TIME: 15,  // seconds
```

### Map Size Calculation

```javascript
participantCount <= 4  → 64x64 tiles
participantCount <= 7  → 80x80 tiles
participantCount <= 10 → 96x96 tiles
```

### Classic Map Selection

```javascript
classicMapChance: 0.15,  // 15% chance to use Classic Map
weightFormula: 1 + positiveVotes  // Weighted selection
```

### Voting Thresholds

```javascript
newMapThreshold: 0.5,      // >50% yes votes to save
classicMapThreshold: 1.0,  // 100% yes votes to increment rating
votingDuration: 10 * 1000  // 10 seconds
```

### Spawn Patterns

**Deathmatch**:
- Circle radius: 35% of map size
- Even spacing: `2π / playerCount`

**Skirmish/Assault**:
- Team 1: Left side (20% from left for Skirmish, 15% for Assault)
- Team 2: Right side (80% from left)
- Vertical spacing along center line

### Capture Point (Assault)

```javascript
captureRadius: 3,              // tiles
captureTime: 10 * 1000,        // 10 seconds (must hold continuously)
decayRate: per second if no attackers
```

### Elite NPC Spawning

```javascript
spawnThreshold: 2,  // Team difference ≥ 2 triggers spawns
spawnCount: Math.floor(difference / 2)  // Spawn difference/2 NPCs
```

---

## Troubleshooting

### Common Issues

#### Match Not Starting

**Symptoms**: Players stuck in lobby, countdown completes but match doesn't start.

**Possible Causes**:
1. `BattlegroundsMatchManager` not initialized
2. Map generation failing
3. Dependencies not injected

**Debug Steps**:
1. Check server console for errors
2. Verify `global.battlegroundsMatchManager` exists
3. Check if `lobbyManager.matchManager` is set
4. Verify map generator is injected

---

#### Players Not Spawning

**Symptoms**: Match starts but players remain at original location.

**Possible Causes**:
1. Spawn points not calculated
2. Map context not registered
3. Player position update not sent
4. Client not switching to battleground world context
5. Player's own entity filtered out (FIXED in v1.2)

**Debug Steps**:
1. Check `currentMatch.mapData` exists
2. Verify `calculateSpawnPoints()` returns valid points
3. Check `MapContextManager` has registered map
4. Verify socket `playerUpdate` message sent
5. Check client console for `window.inBattleground` and `window.battlegroundWorld`
6. Verify `battlegroundWorld` message received before `init` message
7. Check `GameLoopManager` is using `window.battlegroundWorld` when `window.inBattleground === true`
8. Verify player's own entity is included in entity updates (required for movement)

**Resolution**:
Player's own entity is now always included in `spatialFilterEntities()` output regardless of map context, ensuring movement updates are always sent to the client.

---

#### Map Preview Not Showing

**Symptoms**: Match starts without map preview.

**Possible Causes**:
1. `battlegroundsMapPreview` message not sent
2. Client UI not initialized
3. Canvas not initialized

**Debug Steps**:
1. Check `broadcastMapPreview()` called
2. Verify client receives message
3. Check `BattlegroundsMapPreviewUI` initialized
4. Verify canvas element exists

---

#### Voting Not Working

**Symptoms**: Post-game voting doesn't appear or votes not recorded.

**Possible Causes**:
1. `MapVotingSystem` not initialized
2. Voting session not started
3. Player not in human players list

**Debug Steps**:
1. Verify `mapVotingSystem.startVoting()` called
2. Check `activeVotes[matchId]` exists
3. Verify player not marked as NPC
4. Check socket message received on server

---

#### Statistics Not Saving

**Symptoms**: Player stats not updated after match.

**Possible Causes**:
1. `ScoreManager` not initialized
2. `saveMatchStatistics()` not called
3. Player object not found

**Debug Steps**:
1. Verify `battlegroundsScoreManager` exists
2. Check `saveMatchStatistics()` called in `endMatch()`
3. Verify `Player.list[playerId]` exists
4. Check `player.battlegroundsStats` initialized

---

#### Classic Maps Not Loading

**Symptoms**: Always generating new maps, never using Classic Maps.

**Possible Causes**:
1. Map library not initialized
2. No Classic Maps saved
3. Filter criteria too strict

**Debug Steps**:
1. Check `mapLibrary` injected in MatchManager
2. Verify Classic Maps exist in file system
3. Check `getAllClassicMaps()` returns results
4. Verify game mode and map size matching

---

#### Client Rendering Main World Instead of Battleground

**Symptoms**: Player spawns at battleground coordinates but sees main world terrain/buildings.

**Possible Causes**:
1. `window.inBattleground` not set to `true`
2. `window.battlegroundWorld` not set or empty
3. `battlegroundWorld` message not received
4. `GameLoopManager` not checking `window.inBattleground` flag
5. `getTile()` function not checking battleground context (FIXED in v1.2)

**Debug Steps**:
1. Check browser console for `window.inBattleground` value
2. Verify `window.battlegroundWorld` exists and has data
3. Check `SocketMessageHandler.handleBattlegroundWorld()` called
4. Verify `GameLoopManager.gameLoop()` checks `window.inBattleground` before selecting world
5. Check server logs for `battlegroundWorld` message being sent
6. Verify `init` message includes `inBattleground: true` flag
7. Verify `getTile()` function in `client.js` checks `window.inBattleground` and uses `window.battlegroundWorld` when appropriate

**Resolution**:
The `getTile()` function in `client/js/client.js` now checks `window.inBattleground` and uses `window.battlegroundWorld` when the player is in a battleground, ensuring tile rendering uses the correct map data.

---

#### Main World Entities Appearing in Battleground

**Symptoms**: Players in battleground see NPCs and items from the main world at battleground coordinates.

**Possible Causes**:
1. `spatialFilterEntities()` not checking map context (FIXED in v1.2)
2. Entities from main world and battleground sharing same coordinate space
3. Entity filtering only checking distance, not map context

**Debug Steps**:
1. Check server logs for entity filtering
2. Verify `spatialFilterEntities()` in `OptimizedGameLoop.js` checks `player.inBattleground` and `player.battlegroundMatchId`
3. Check if entities have correct `inBattleground` and `battlegroundMatchId` flags
4. Verify player's own entity is always included (required for movement updates)

**Resolution**:
The `spatialFilterEntities()` function in `server/js/core/OptimizedGameLoop.js` now filters entities by map context:
- Only includes entities from the same battleground match (matching `battlegroundMatchId`)
- Only includes entities from main world when player is in main world
- Always includes player's own entity regardless of context (required for movement)
- Checks map context before distance calculations

---

#### Elite NPCs Not Spawning

**Symptoms**: Team balancing NPCs fail to spawn with "No walkable tile found" warnings.

**Possible Causes**:
1. Spawn points not walkable (water or obstacles)
2. Pathfinding grid not generated
3. Map context not registered when NPCs spawn
4. Walkability check failing

**Debug Steps**:
1. Check server logs for walkability warnings
2. Verify `MapContextManager` has registered battleground map before NPC spawning
3. Check pathfinding grid exists: `global.battlegroundsPathfindingManager.getGrid(matchId, z)`
4. Verify spawn point coordinates are within map bounds
5. Check if nearby tile search (2-tile radius) finds walkable tiles
6. Check server logs for spawn point validation details

---

### Debug Logging

**Key Log Points**:

```javascript
// Match lifecycle
console.log('Starting match:', matchId)
console.log('Match ended:', matchId, endReason)
console.log('Match cleanup:', matchId)

// Map generation
console.log('Generating map for:', gameMode, mapSize)
console.log('Using Classic Map:', mapId)
console.log('Map validation:', valid, issues)

// Voting
console.log('Starting voting for match:', matchId)
console.log('Vote recorded:', playerId, vote)
console.log('Voting results:', results)

// Spawning
console.log('Spawning participants:', participants.length)
console.log('Spawn points calculated:', Object.keys(spawnPoints).length)

// Statistics
console.log('Saving match statistics for:', playerId)
console.log('Statistics updated:', stats)
```

### State Inspection

**Check Match State**:
```javascript
global.battlegroundsMatchManager.currentMatch
```

**Check Lobby State**:
```javascript
global.battlegroundsLobbyManager.lobbyState
```

**Check Active Votes**:
```javascript
global.battlegroundsMatchManager.mapVotingSystem.activeVotes
```

**Check Player Stats**:
```javascript
Player.list[playerId].battlegroundsStats
```

**Check Map Context**:
```javascript
global.mapContextManager.getMapContext(matchId)
```

**Check Client Battleground State**:
```javascript
window.inBattleground  // Should be true in battleground
window.battlegroundWorld  // Should contain world data array
window.battlegroundMapSize  // Should match match.mapSize
window.currentBattlegroundMatchId  // Should match current match ID
```

**Check Server Battleground State**:
```javascript
global.battlegroundsMatchManager.currentMatch
global.mapContextManager.battlegroundMaps[matchId]
global.battlegroundsPathfindingManager.getGrid(matchId, z)
```

---

## File Locations

### Server Files

```
server/js/battlegrounds/
├── BattlegroundsMatchManager.js
├── BattlegroundsLobbyManager.js
├── BattlegroundsScoreManager.js
├── BattlegroundsMapGenerator.js
├── BattlegroundsMapValidator.js
├── BattlegroundsMapPostProcessor.js
├── BattlegroundsMapLibrary.js
├── BattlegroundsMapVotingSystem.js
├── BattlegroundsHouseManager.js
├── BattlegroundsEliteNPCManager.js
├── BattlegroundsEliteNPCBehavior.js
├── BattlegroundsSpectatorSystem.js
├── BattlegroundsLeashManager.js
├── BattlegroundsWeatherManager.js
├── BattlegroundsAssaultSpawnManager.js
├── BattlegroundsPathfindingManager.js
└── game_modes/
    ├── BaseGameMode.js
    ├── DeathmatchMode.js
    ├── SkirmishMode.js
    └── AssaultMode.js
```

### Client Files

```
client/js/ui/
├── BattlegroundsLobbyUI.js
├── BattlegroundsMatchUI.js
├── BattlegroundsPostGameUI.js
├── BattlegroundsMapPreviewUI.js
└── ScoreboardUI.js (Battlegrounds tab)
```

### Integration Files

```
lambic.js (server initialization)
client/js/core/SocketMessageHandler.js (message routing, world context switching)
client/js/core/GameLoopManager.js (rendering, world selection)
client/js/client.js (getTile function - battleground world selection)
server/js/core/OptimizedGameLoop.js (spatialFilterEntities - map context filtering)
client/index.html (UI elements)
server/js/Interact.js (desk interaction)
```

---

## Version History

- **v1.2** (Current): Critical rendering and entity filtering fixes
  - Fixed `getTile()` function to use `window.battlegroundWorld` when `window.inBattleground` is true
  - Fixed `spatialFilterEntities()` to filter entities by map context (battleground vs main world)
  - Fixed player's own entity always being included in spatial filter for movement updates
  - Prevents main world entities from appearing in battleground matches

- **v1.1**: Bug fixes and improvements
  - Fixed NPC spawn walkability validation using pathfinding grids
  - Improved map preview scaling to fill container properly
  - Reduced lobby UI size (1000px width, 75vh max height) to avoid blocking chat
  - Enhanced client-side world context switching documentation
  - Improved spawn point validation with expanded search radius

- **v1.0**: Initial implementation
  - Lobby system
  - Three game modes (Deathmatch, Skirmish, Assault)
  - Map generation and Classic Maps
  - Statistics tracking
  - Full UI system
  - Map voting

---

## Future Enhancements

Potential areas for future development:

- Ranked matchmaking
- Seasonal rankings and rewards
- Custom game mode configuration
- Map editor for creating Classic Maps
- Replay system
- Advanced statistics and analytics
- Tournament mode
- Spectator mode improvements (multiple cameras, free cam)
- Map rotation schedules
- Dynamic weather effects on gameplay

---

*Last Updated: January 2025 (v1.2 - Critical rendering and entity filtering fixes)*

