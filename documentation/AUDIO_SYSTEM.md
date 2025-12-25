# Audio System Documentation

## Overview

The game features a sophisticated audio system that dynamically determines background music (BGM) and ambient sounds based on multiple factors including player location, time of day, weather conditions, and special game states (ghost mode, ship boarding). The system consists of multiple components working together to provide contextual audio that enhances the immersive experience.

## Architecture

The audio system is composed of two main approaches:

1. **Legacy System (`AudioSystem.js`)**: Event-driven audio updates triggered by server messages
2. **Modern System (`AudioManager.js`)**: Automated audio manager that polls player state every second

Both systems use the same underlying audio playback functions and playlist definitions from `audioloader.js`.

## Core Components

### AudioSystem.js

**Location**: `client/js/core/AudioSystem.js`

The legacy audio decision system that handles BGM and ambient sound selection based on player location and state. This system is called when the server sends `bgm` socket messages.

**Key Features**:
- Tracks current building ID to prevent music changes when moving between floors of the same building
- Determines audio based on Z-level, building type, time of day, and special states
- Separate methods for BGM (`getBgm()`) and ambient sound (`soundscape()`)

**Key Methods**:
- `getBgm(x, y, z, b)`: Determines and plays appropriate background music
- `soundscape(x, y, z, b)`: Determines and plays appropriate ambient sound

### AudioManager.js

**Location**: `client/js/audio/AudioManager.js`

A modern automated audio manager that continuously monitors player state and updates audio accordingly. Runs an update loop every 1 second to check for context changes.

**Key Features**:
- Automatic audio updates based on player context changes
- Context caching to avoid unnecessary audio changes
- Manual override system for special events
- Separate tracking of BGM and ambience to prevent duplicate playback

**Key Methods**:
- `start()`: Begins monitoring player state (updates every 1 second)
- `stop()`: Stops the monitoring interval
- `update()`: Main update loop that checks for context changes
- `getAudioContext()`: Gathers all factors that influence audio selection
- `hasContextChanged(newContext)`: Determines if audio should change
- `selectBGM(context)`: Selects appropriate BGM playlist
- `selectAmbience(context)`: Selects appropriate ambient sound
- `forceUpdate()`: Forces immediate audio update
- `pauseAutoUpdates(durationMs)`: Pauses automatic updates for a period

### audioloader.js

**Location**: `client/js/audioloader.js`

Defines all audio file paths, playlist arrays, and playback functions.

**Key Components**:
- `Bgm` object: Contains all BGM file paths
- `Amb` object: Contains all ambient sound file paths
- Playlist arrays: Organized by location/time (e.g., `overworld_day_bgm`, `cave_bgm`)
- `bgmPlayer(playlist, next, loop)`: Function to play BGM from a playlist
- `ambPlayer(src)`: Function to play ambient sounds
- `AudioCtrl`: Global audio controller object managing playback state

### Supporting Systems

#### WeatherHelper.js

**Location**: `client/js/utils/WeatherHelper.js`

Calculates weather effects at player position, specifically storm detection for ambient sound selection.

**Key Method**:
- `getWeatherEffects(playerX, playerY, playerZ, config)`: Returns weather effects object with storm/fog information

**Storm Detection**:
- Storm outer radius: ~27% of map diagonal (~20% map coverage)
- Storm inner radius: ~8% of map diagonal (full intensity center)
- Storm intensity > 0.3 triggers storm ambience
- Weather only affects Z-level 0 (overworld)

#### SocketMessageHandler.js

**Location**: `client/js/core/SocketMessageHandler.js`

Handles server-driven audio triggers via socket messages.

**Key Handler**:
- Handles `'bgm'` socket messages from server, calling `AudioSystem.getBgm()` with player coordinates and building information

## BGM Selection Logic

Background music selection follows a strict priority system:

### Priority Order

1. **Ghost Mode** (Highest Priority)
   - Plays: `defeat_bgm` (single track: `Defeat.mp3`)
   - Loop: `false` (plays once, does not loop)
   - Overrides all other music

2. **Ship Boarding**
   - Plays: `ship_bgm` playlist
   - Triggered when: `player.shipType`, `player.isBoarded`, or `player.boardedShip` is truthy
   - Overrides all location-based music

3. **Location-Based Music**

   **Z-Level -1 (Caves)**:
   - Plays: `cave_bgm` playlist (8 tracks)

   **Z-Level 0 (Overworld)**:
   - Time-based selection:
     - **Morning**: `overworld_morning_bgm` (if `tempus` is 'IV.a', 'V.a', 'VI.a', 'VII.a', 'VIII.a', or 'IX.a')
     - **Night**: `overworld_night_bgm` (if `nightfall === true` AND `tempus !== 'IV.a'`)
     - **Day**: `overworld_day_bgm` (otherwise)

   **Z-Level 1 or 2 (Indoors)**:
   - Building type determines music:
     - **Stronghold**: 
       - Day: `stronghold_day_bgm`
       - Night: `stronghold_night_bgm`
     - **Garrison**: `garrison_bgm`
     - **Tavern**: `tavern_bgm`
     - **Monastery**: `monastery_bgm` (Note: AudioManager returns `null` for monasteries)
     - **Other buildings**: `indoors_bgm`

   **Z-Level -2 (Cellar/Basement)**:
   - **Tavern basement**: No BGM (returns early)
   - **Other basements**: `dungeons_bgm`

### Building Transition Logic

`AudioSystem.js` includes special logic to prevent music changes when moving between floors of the same building:

- Tracks `_currentBuildingId` and `_currentIndoorZ`
- If player is in the same building but different floor, music does not change
- Only updates ambience when moving between floors

**Code Reference**: `AudioSystem.js` lines 117-143

## Ambience Selection Logic

Ambient sound selection follows a strict priority system:

### Priority Order

1. **Storms** (Highest Priority)
   - **On Ship**: `Amb.seastorm` (`/client/audio/amb/seastorm.mp3`)
   - **On Land**: `Amb.rain` (`/client/audio/amb/rain.mp3`)
   - Triggered when: `storm.active === true` AND `storm.intensity > 0.3`
   - Weather only affects Z-level 0 (overworld)

2. **Ship Boarding** (No Storm)
   - Plays: `Amb.sea` (`/client/audio/amb/sea.mp3`)
   - Triggered when: `player.shipType`, `player.isBoarded`, or `player.boardedShip` is truthy

3. **Ghost Mode**
   - Plays: `Amb.spirits` (`/client/audio/amb/spirits.mp3`)
   - Triggered when: `player.ghost === true`

4. **Location-Based Ambience**

   **Z-Level 0 (Overworld)**:
   - **Night**: `Amb.forest` (`/client/audio/amb/forest.mp3`)
   - **Day**: `Amb.nature` (`/client/audio/amb/nature.mp3`)

   **Z-Level -1 (Caves)**:
   - Plays: `Amb.cave` (`/client/audio/amb/cave.mp3`)

   **Z-Level 1 or 2 (Indoors)**:
   - **Monastery**: `Amb.empty` (`/client/audio/amb/empty.mp3`)
   - **Buildings with fire** (determined by `hasFire()` function):
     - `building.occ < 4`: `Amb.fire` (`/client/audio/amb/fire.mp3`)
     - `building.occ < 6`: `Amb.hush` (`/client/audio/amb/hush.mp3`)
     - `building.occ >= 6`: `Amb.chatter` (`/client/audio/amb/chatter.mp3`)
   - **Buildings without fire**: No ambience (null)

   **Z-Level -2 (Cellar/Basement)**:
   - **Tavern basement**: `Amb.empty`
   - **Other basements**: `Amb.evil` (`/client/audio/amb/evil.mp3`)

   **Z-Level -3 (Underwater)**:
   - Plays: `Amb.underwater` (`/client/audio/amb/underwater.mp3`)

### Fire Detection

The `hasFire()` function (defined in `client/js/utils/GameHelper.js`) determines if a building has fire for ambience selection:

- Checks `Light.list` for light sources in the same building
- Returns `true` if:
  - A light with `radius > 1` is found in the building, OR
  - At least 2 lights are found in the building
- Fire ambience varies based on building occupancy (number of NPCs/players present)

## Time System

The game uses two variables to determine time of day:

- **`tempus`**: String representing the hour (e.g., 'IV.a' = 4am, 'V.a' = 5am)
- **`nightfall`**: Boolean indicating nighttime

### Time-Based BGM Selection

**Morning Hours**: 'IV.a' through 'IX.a' (4am-9am)
- Plays: `overworld_morning_bgm`

**Night Hours**: `nightfall === true` AND `tempus !== 'IV.a'`
- Plays: `overworld_night_bgm`

**Day Hours**: All other times
- Plays: `overworld_day_bgm`

### Time-Based Ambience Selection

- **Overworld (Z=0)**:
  - Night (`nightfall === true`): `Amb.forest`
  - Day: `Amb.nature`

## Location System (Z-Levels)

The game uses Z-levels to represent different vertical layers of the world:

- **`0`**: Overworld (main world surface)
- **`1`**: Building ground floor
- **`2`**: Building second floor
- **`-1`**: Cave (underground)
- **`-2`**: Cellar/Basement (dungeon level)
- **`-3`**: Underwater

Each Z-level has associated BGM and ambience playlists.

## Weather System

### Storm Detection

Storms are detected via `getWeatherEffects()` function which:

1. Only checks weather when `playerZ === 0` (overworld)
2. Calculates distance from player to storm center
3. Determines intensity based on distance:
   - Outer radius: ~27% of map diagonal
   - Inner radius: ~8% of map diagonal
   - Intensity interpolates between 1.0 (center) and 0.0 (edge)
4. Returns storm as active if intensity > 0.3

### Storm Effects

**BGM**: Storms do not change BGM (music continues playing)

**Ambience**: Storms override all other ambience:
- On ship: `seastorm.mp3`
- On land: `rain.mp3`

**Code Reference**: `client/js/utils/WeatherHelper.js` lines 54-69

## Special States

### Ghost Mode

When player is in ghost mode (`player.ghost === true`):

**BGM**:
- Plays: `defeat_bgm` (Defeat.mp3)
- Loop: `false` (plays once, does not repeat)
- Overrides all other music

**Ambience**:
- Plays: `spirits.mp3`
- Overrides all other ambience

**Code Reference**: `AudioSystem.js` lines 99-110

### Ship Boarding

When player is on a ship (checked via `player.shipType`, `player.isBoarded`, or `player.boardedShip`):

**BGM**:
- Plays: `ship_bgm` playlist (10 tracks)
- Overrides all location-based music

**Ambience**:
- During storm: `seastorm.mp3`
- Otherwise: `sea.mp3`
- Overrides all location-based ambience

**Code Reference**: `AudioSystem.js` lines 90-97

## Audio Update Mechanism

### Server-Driven Updates (Legacy)

The server sends `'bgm'` socket messages when:

- Player moves between Z-levels
- Player enters/exits buildings
- Player location changes significantly

**Server Code Location**: `lambic.js` (multiple locations, e.g., lines 3363, 3371, 3390)

**Client Handler**: `SocketMessageHandler.js` line 21-24
- Receives message and calls `AudioSystem.getBgm(x, y, z, b)`

### Automated Updates (Modern)

`AudioManager` provides automated audio updates:

- Updates every **1 second** via `setInterval`
- Checks for context changes via `hasContextChanged()`
- Only updates audio if context has significantly changed
- Can be paused via `pauseAutoUpdates(durationMs)` for manual control

**Context Change Detection**:
- Ghost mode changes
- Ship boarding state changes
- Z-level changes
- Storm state changes (entering/leaving storm)
- Time changes (nightfall, tempus)
- Building type changes

**Code Reference**: `AudioManager.js` lines 88-108

### Building Transition Tracking

`AudioSystem.js` includes logic to prevent music changes when moving between floors:

- Tracks current building ID in `_currentBuildingId`
- If same building ID but different Z-level, skips music change
- Only updates ambience when moving between floors
- Clears tracking when exiting building

**Code Reference**: `AudioSystem.js` lines 117-143

## Playlist Definitions

All playlists are defined in `audioloader.js`:

### Overworld Playlists

**overworld_morning_bgm** (15 tracks):
- Beaute, Tout_par2, Brawle, Untitled, Par_maintes, Riches2, Se_zephirus3, Sera, Tout_par2, Tousjours, Revenez, Helas_pitie, Questamor, Musica, Veder, Ce_jour

**overworld_day_bgm** (15 tracks):
- Corps_femenin, Aventure, Gedeon, Gentil_cuer, Jatendray, La_verdelete, Se_zephirus, Non_ara_may, Tout_par3, Qui, Quant_joyne, Tandernaken, Collinetto, Coloribus, Fortuna, Playsant

**overworld_night_bgm** (18 tracks):
- Chanconeta, Falla2, La_verdelete2, Liement, Mephisto, Riches, Se_zephirus2, Gentil_cuer2, La_fiamma, Chantar, Triste, Conditor, Deathe, Tousjours, Constantia, Bonne, Falla, Gedeon2, Specchio

### Location-Based Playlists

**cave_bgm** (8 tracks):
- Mater, Mulierum, Virgo, Caida, Coraige, Judici, Aucells, Plainte, Andalusi

**dungeons_bgm** (10 tracks):
- Mundi, Caida, Generosa, Irae, Morte, Leandro, Fuerza, Hedyaz, Bashraf, Andalusi

**indoors_bgm** (19 tracks):
- Saltarello2, Stingo2, Virgen, Tout_par, Blazen, Sub_arturo, Spagnoletta, Recercada, Playne, Feuers, Naroit, Toute_flour, Paradis, Chanconeta2, Ricorditi, Doulse, Coloribus2, Lannoys, Ardente, Miri

### Building-Specific Playlists

**stronghold_day_bgm** (16 tracks):
- Alla_caccia, Danca, Zappay, Bourguignon2, Sybilla, Alta2, Propinan, Trompette, Alla_bataglia, Amor, Collinetto2, Vaguza, Fede, Desiosa, Pavana, Moriar

**stronghold_night_bgm** (14 tracks):
- Zappay3, Villanicco, Mio, Costante, Passamezzo, Romanesca, Folias, Mabellist, Gotxs, Chacona, Morseca, Gugurumbe, Folias2, Gran_fuoco

**garrison_bgm** (3 tracks):
- Bourguignon, Alta, Zappay2

**tavern_bgm** (14 tracks):
- Anello, Madonna_Katerina, Saltarello, Danse_estampie, Ex_agone, Dregz, Par_mantes2, Zappay4, Berdolin, Absalon, Danza, Beliche, Chacona2, Paradiso

**monastery_bgm** (5 tracks):
- Profundis, Spiritus, Domine, Lux, Paradisum

**ship_bgm** (10 tracks):
- Shatakhi, Uitime, Ex_agone2, Naturalmente, Asbahan, Volgra, Danse_estampie, Berdolin, Dregz, Occasus

### Special Playlists

**defeat_bgm** (1 track):
- Defeat (plays once, does not loop)

**title_bgm** (8 tracks):
- Danca (3x), Miri, Miri2, Moriar, Saltarello2, Saltarello3

**cathedral_bgm** (5 tracks) - Currently unused in active code:
- Alium, Alma, Aeternam, Peccata_nostra, Magnificat

## Ambience Files

All ambient sound files are defined in the `Amb` object in `audioloader.js`:

- **`Amb.cave`**: `/client/audio/amb/cave.mp3` - Used in caves (Z=-1)
- **`Amb.chatter`**: `/client/audio/amb/chatter.mp3` - Used in buildings with fire and occupancy >= 6
- **`Amb.empty`**: `/client/audio/amb/empty.mp3` - Used in monasteries and tavern basements
- **`Amb.evil`**: `/client/audio/amb/evil.mp3` - Used in dungeons/cellars (Z=-2, non-tavern)
- **`Amb.fire`**: `/client/audio/amb/fire.mp3` - Used in buildings with fire and occupancy < 4
- **`Amb.forest`**: `/client/audio/amb/forest.mp3` - Used in overworld at night
- **`Amb.hush`**: `/client/audio/amb/hush.mp3` - Used in buildings with fire and occupancy 4-5
- **`Amb.mountains`**: `/client/audio/amb/mountains.mp3` - Defined but currently unused
- **`Amb.nature`**: `/client/audio/amb/nature.mp3` - Used in overworld during day
- **`Amb.rain`**: `/client/audio/amb/rain.mp3` - Used during storms on land
- **`Amb.ritual`**: `/client/audio/amb/cave.mp3` - Alias for cave.mp3, currently unused
- **`Amb.sea`**: `/client/audio/amb/sea.mp3` - Used when on ship (no storm)
- **`Amb.seastorm`**: `/client/audio/amb/seastorm.mp3` - Used when on ship during storm
- **`Amb.sinister`**: `/client/audio/amb/sinister.mp3` - Defined but currently unused
- **`Amb.spirits`**: `/client/audio/amb/spirits.mp3` - Used in ghost mode
- **`Amb.torture`**: `/client/audio/amb/torture.mp3` - Defined but currently unused
- **`Amb.underwater`**: `/client/audio/amb/underwater.mp3` - Used underwater (Z=-3)
- **`Amb.windy`**: `/client/audio/amb/windy.mp3` - Defined but currently unused

## Audio Playback Functions

### bgmPlayer()

**Location**: `audioloader.js` lines 1-21

Plays background music from a playlist array.

**Parameters**:
- `playlist`: Array of audio file paths
- `next`: Boolean, if `true` forces next track even if same playlist (default: `false`)
- `loop`: Boolean, whether to loop the playlist (default: `true`)

**Behavior**:
- Randomly selects a track from the playlist
- Skips if same playlist is already playing (unless `next === true`)
- Sets up `onended` handler to play next track when looping
- Stores current playlist in `AudioCtrl.playlist`
- Logs playback to console

**Special Cases**:
- Ghost mode: Called with `loop = false` to play Defeat.mp3 once

### ambPlayer()

**Location**: `audioloader.js` lines 23-37

Plays ambient sound files.

**Parameters**:
- `src`: String path to ambient sound file, or `null`/undefined to stop

**Behavior**:
- Skips if same ambience is already playing (checks `AudioCtrl.currentAmb`)
- Sets `loop = true` automatically
- Stops ambience if `src` is null/undefined
- Logs playback to console

## Audio Controller (AudioCtrl)

**Location**: `audioloader.js` lines 39-44

Global object managing audio playback state:

```javascript
AudioCtrl = {
  playlist: null,        // Current BGM playlist array
  currentAmb: null,      // Current ambience file path
  bgmLoop: true,         // Whether BGM is looping
  bgm: new Audio(),      // HTML5 Audio element for BGM
  amb: new Audio()       // HTML5 Audio element for ambience
};
```

## Code Flow Diagrams

### AudioSystem.getBgm() Flow

```
Player movement/location change
  ↓
Server sends 'bgm' socket message
  ↓
SocketMessageHandler.handle('bgm')
  ↓
AudioSystem.getBgm(x, y, z, b)
  ↓
Check Priority:
  1. Ghost mode? → defeat_bgm (no loop)
  2. Ship boarding? → ship_bgm
  3. Z-level check:
     - Z = -1 → cave_bgm
     - Z = 0 → time-based overworld BGM
     - Z = 1 or 2 → building type BGM
     - Z = -2 → dungeons_bgm (unless tavern)
  ↓
bgmPlayer(playlist)
  ↓
AudioCtrl.bgm plays selected track
```

### AudioSystem.soundscape() Flow

```
AudioSystem.getBgm() or direct call
  ↓
AudioSystem.soundscape(x, y, z, b)
  ↓
Check Priority:
  1. Storm (intensity > 0.3)?
     - On ship → seastorm.mp3
     - On land → rain.mp3
  2. Ship boarding? → sea.mp3
  3. Ghost mode? → spirits.mp3
  4. Z-level check:
     - Z = 0 → forest (night) or nature (day)
     - Z = -1 → cave.mp3
     - Z = 1 or 2 → fire-based or empty
     - Z = -2 → evil.mp3 or empty
     - Z = -3 → underwater.mp3
  ↓
ambPlayer(ambienceFile)
  ↓
AudioCtrl.amb plays selected ambience
```

### AudioManager Update Loop

```
AudioManager.start()
  ↓
setInterval (every 1000ms)
  ↓
AudioManager.update()
  ↓
Get current audio context (location, state, weather)
  ↓
hasContextChanged()?
  ↓ YES
selectBGM(context) → playlist
selectAmbience(context) → file
  ↓
bgmPlayer(playlist) [if changed]
ambPlayer(file) [if changed]
  ↓
Update lastContext
```

## Differences Between AudioSystem and AudioManager

While both systems use the same playlists and playback functions, there are some implementation differences:

1. **AudioSystem** (Legacy):
   - Event-driven (called via socket messages)
   - Includes building transition tracking to prevent music changes between floors
   - More detailed building type handling (includes stronghold day/night logic)
   - Handles monastery BGM (plays `monastery_bgm`)

2. **AudioManager** (Modern):
   - Polling-based (updates every second)
   - Simplified building type handling
   - Returns `null` for monastery BGM (no music in monasteries)
   - Uses context caching to avoid unnecessary updates

**Note**: Both systems may be active simultaneously, with AudioManager providing continuous updates and AudioSystem handling server-triggered events.

## Summary

The audio system provides a rich, context-aware soundtrack that responds to:

- **Location**: Z-level and building type
- **Time**: Morning, day, and night cycles
- **Weather**: Storms override ambience with rain/seastorm
- **Special States**: Ghost mode and ship boarding take priority
- **Building Activity**: Fire and occupancy affect indoor ambience

The system uses priority-based selection to ensure the most appropriate audio plays at any given moment, creating an immersive audio experience that enhances gameplay atmosphere.

