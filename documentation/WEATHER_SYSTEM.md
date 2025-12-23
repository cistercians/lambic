# Weather System Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Initialization](#system-initialization)
3. [Weather Types](#weather-types)
4. [Weather Entity Structure](#weather-entity-structure)
5. [Lifecycle Management](#lifecycle-management)
6. [Spawn System](#spawn-system)
7. [Client-Side Rendering](#client-side-rendering)
8. [Network Synchronization](#network-synchronization)
9. [Technical Details](#technical-details)
10. [File Structure](#file-structure)
11. [Code Reference](#code-reference)

---

## Overview

The weather system is a dynamic environmental system that creates atmospheric effects (fog and storms) that move across the game world. Weather entities spawn randomly based on time-of-day conditions and player proximity, affecting visual rendering, lighting, and audio ambience.

### Key Characteristics

- **Two weather types**: Fog (morning-only) and Storms (any time)
- **Dynamic movement**: Weather entities drift slowly across the map with random direction changes
- **Distance-based effects**: Visual and audio effects scale based on player proximity to weather centers
- **Time-based lifecycle**: Fog disappears by noon; storms have fixed 3-hour lifetimes
- **Map-scaled**: All weather parameters (spawn counts, movement speeds, radii) scale with map size
- **Z-layer restriction**: Weather only affects the overworld (z=0)

---

## System Initialization

### Server-Side Setup

**File:** [`lambic.js`](lambic.js) (lines 2467-2536, 309-312)

The weather system is initialized during server startup and runs continuously throughout the game session.

#### Configuration Constants

```javascript
const weatherSpawnChance = {
  fog: 0.005,      // 0.5% chance per tick (fairly common in mornings)
  storm: 0.0008    // 0.08% chance per tick (approximately every 20 minutes)
};
```

#### Update Loop

Weather updates are scheduled to run every second (1000ms):

```javascript
// Weather update (every 60 ticks = 1 second at 60 FPS)
setInterval(function() {
  updateWeather(gameState.tempus);
}, 1000); // Every second
```

The `updateWeather()` function is called with the current `tempus` (time period) to determine spawn conditions and manage existing weather entities.

#### Weather Entity Definition

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13302-13416)

Weather entities are defined as a special entity type that inherits from the base `Entity` class:

```javascript
Weather = function(param) {
  var self = Entity({
    x: param.x || 0,
    y: param.y || 0,
    z: 0, // Always on overworld
    id: param.id || Math.random()
  });
  
  self.class = 'Weather';
  self.weatherType = param.weatherType; // 'fog' or 'storm'
  self.intensity = param.intensity || 1.0; // 0-1 intensity
  self.lifetime = param.lifetime || 0; // Remaining time in ticks
  self.moveSpeed = param.moveSpeed || 0.1; // Very slow movement
  self.moveDirection = Math.random() * 2 * Math.PI;
  self.moveTimer = 0;
  self.toRemove = false;
  self.type = 'weather';
  
  // ... update logic, pack methods
}
```

---

## Weather Types

### Fog

**Spawn Conditions:**
- Only spawns during early morning hours: `IV.a`, `V.a`, `VI.a`, `VII.a`, `VIII.a`, `IX.a`
- Spawn chance: 0.5% per update tick (every second)
- Maximum concurrent fog patches scale with map size (minimum 3, scales proportionally)

**Characteristics:**
- **Radius**: ~4% of map diagonal (outer), ~1.5% (inner core)
- **Intensity**: Random 0.5-1.0 on spawn
- **Movement Speed**: Base 0.05 (scales with map size)
- **Lifecycle**: Tempus-based (see Lifecycle Management section)

**Visual Effect:**
- Creates a fog overlay that reduces visibility
- Intensity falls off with distance from center
- Affects lighting rendering (see Client-Side Rendering)

### Storm

**Spawn Conditions:**
- Can spawn at any time of day
- Spawn chance: 0.08% per update tick (approximately every 20 minutes)
- Maximum concurrent storms scale with map size (minimum 3, scales proportionally)

**Characteristics:**
- **Radius**: ~27% of map diagonal (outer), ~8% (inner core with full intensity)
- **Intensity**: Random 0.5-1.0 on spawn
- **Movement Speed**: Base 0.15 (scales with map size, 3x faster than fog)
- **Lifetime**: 3 hours = 10,800 ticks (60 ticks/second × 60 seconds × 3 hours)

**Visual Effects:**
- Rain particle system (up to 500 particles scaled by intensity)
- Lightning flashes (when intensity > 0.7, random 3-5 second intervals)
- Darkened lighting overlay
- Audio ambience: rain sounds (or seastorm if player is on a ship)

---

## Weather Entity Structure

### Core Properties

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13303-13320)

```javascript
{
  id: number,                    // Unique entity ID
  x: number,                     // World X coordinate
  y: number,                     // World Y coordinate
  z: 0,                          // Always overworld (z=0)
  class: 'Weather',              // Entity class identifier
  type: 'weather',               // Entity type
  weatherType: string,            // 'fog' or 'storm'
  intensity: number,             // 0.0-1.0 intensity value
  lifetime: number,              // Remaining ticks (storms only)
  moveSpeed: number,             // Movement speed per tick
  moveDirection: number,         // Current movement angle (radians)
  moveTimer: number,             // Ticks until next direction change
  toRemove: boolean              // Flag for entity cleanup
}
```

### Entity Registry

Weather entities are stored in a global list:

```javascript
Weather.list = {}; // Object keyed by entity ID
```

### Update Method

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13322-13368)

Each weather entity's `update()` method handles:

1. **Fog lifecycle**: Tempus-based fading and removal
2. **Storm lifecycle**: Lifetime countdown
3. **Movement**: Slow drift with periodic direction changes
4. **Boundary constraints**: Keeps weather within map bounds

```javascript
self.update = function() {
  // FOG: Auto-despawn based on time of day
  if(self.weatherType === 'fog') {
    // Start fading at X.a, gone by XII.p
    if(['X.a', 'XI.a'].includes(tempus)) {
      self.intensity = Math.max(0, self.intensity - 0.01);
      if(self.intensity <= 0) {
        self.toRemove = true;
        return;
      }
    } else if(tempus === 'XII.p' || tempus === 'I.p' || tempus === 'II.p' || tempus === 'III.p') {
      self.toRemove = true;
      return;
    }
  }
  
  // STORM: Use lifetime (decreases with each tick)
  if(self.weatherType === 'storm') {
    if(self.lifetime > 0) {
      self.lifetime--;
      if(self.lifetime <= 0) {
        self.toRemove = true;
        return;
      }
    }
  }
  
  // Random slow movement
  self.moveTimer++;
  if(self.moveTimer > 60) { // Change direction every 60 ticks
    self.moveDirection += (Math.random() - 0.5) * Math.PI / 2;
    self.moveTimer = 0;
  }
  
  // Move in current direction
  self.x += Math.cos(self.moveDirection) * self.moveSpeed;
  self.y += Math.sin(self.moveDirection) * self.moveSpeed;
  
  // Keep within map bounds
  var mapBounds = mapSize * tileSize;
  if(self.x < 0) self.x = 0;
  if(self.y < 0) self.y = 0;
  if(self.x > mapBounds) self.x = mapBounds;
  if(self.y > mapBounds) self.y = mapBounds;
};
```

### Pack Methods

Weather entities implement standard entity pack methods for network synchronization:

**Init Pack** (lines 13370-13378):
```javascript
self.getInitPack = function() {
  return {
    id: self.id,
    x: self.x,
    y: self.y,
    weatherType: self.weatherType,
    intensity: self.intensity
  };
};
```

**Update Pack** (lines 13380-13388):
```javascript
self.getUpdatePack = function() {
  return {
    id: self.id,
    x: self.x,
    y: self.y,
    weatherType: self.weatherType,
    intensity: self.intensity
  };
};
```

---

## Lifecycle Management

### Fog Lifecycle

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13324-13337)

Fog uses a **tempus-based lifecycle** that aligns with the day/night cycle:

1. **Spawn Window**: Only during early morning hours (`IV.a` through `IX.a`)
2. **Active Phase**: Remains at full intensity during morning hours
3. **Fade Phase**: Begins fading at `X.a` (10 AM), continues through `XI.a` (11 AM)
   - Intensity decreases by 0.01 per tick
   - Removed when intensity reaches 0
4. **Removal Phase**: Force-removed at `XII.p` (noon) or later afternoon hours (`I.p`, `II.p`, `III.p`)

**Tempus Reference:**
- `IV.a` - `IX.a`: Early morning (fog spawn window)
- `X.a` - `XI.a`: Late morning (fade phase)
- `XII.p` - `III.p`: Afternoon/evening (removal phase)

### Storm Lifecycle

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13341-13349)

Storms use a **lifetime-based lifecycle**:

1. **Spawn**: Can occur at any time of day
2. **Lifetime**: Fixed duration of 3 hours (10,800 ticks)
   - Lifetime decrements by 1 each tick
   - When lifetime reaches 0, entity is marked for removal
3. **Removal**: Automatically removed when `toRemove` flag is set

### Movement Behavior

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13351-13368)

All weather entities exhibit slow drift movement:

- **Direction Changes**: Every 60 ticks (1 second), direction changes by random amount up to ±90°
- **Movement Speed**: 
  - Fog: Base 0.05 (scales with map size)
  - Storm: Base 0.15 (scales with map size, 3x faster)
- **Boundary Constraints**: Weather cannot move outside map boundaries
  - Map bounds = `mapSize * tileSize`
  - Position clamped to [0, mapBounds] for both X and Y

### Global Update Method

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13404-13416)

The `Weather.update()` static method processes all weather entities:

```javascript
Weather.update = function() {
  var pack = [];
  for(var i in Weather.list) {
    var weather = Weather.list[i];
    weather.update();
    if(weather.toRemove) {
      delete Weather.list[i];
    } else {
      pack.push(weather.getUpdatePack());
    }
  }
  return pack;
};
```

This method:
1. Calls `update()` on each weather entity
2. Removes entities marked with `toRemove = true`
3. Collects update packs from remaining entities
4. Returns the pack array for network transmission

---

## Spawn System

### Spawn Function

**File:** [`lambic.js`](lambic.js) (lines 2473-2498)

The `spawnWeather()` function creates new weather entities:

```javascript
function spawnWeather(type) {
  const mapBounds = mapSize * tileSize;
  const x = Math.random() * mapBounds;
  const y = Math.random() * mapBounds;
  
  // Scale movement speed based on map size
  const baseMapSize = 200;
  const sizeScale = mapSize / baseMapSize;
  const baseFogSpeed = 0.05;
  const baseStormSpeed = 0.15;
  
  const weather = Weather({
    x: x,
    y: y,
    weatherType: type,
    intensity: 0.5 + Math.random() * 0.5, // Random 0.5-1.0
    lifetime: type === 'fog' 
      ? 99999999 // Fog uses tempus-based despawn
      : 60 * 60 * 3, // 3 hours for storms
    moveSpeed: type === 'fog' 
      ? baseFogSpeed * sizeScale 
      : baseStormSpeed * sizeScale
  });
}
```

**Key Features:**
- Random spawn position anywhere on the map
- Intensity randomized between 0.5 and 1.0
- Movement speed scales with map size (base map = 200 tiles)
- Fog uses large lifetime value (relies on tempus-based removal)
- Storm uses fixed 3-hour lifetime

### Update Weather Function

**File:** [`lambic.js`](lambic.js) (lines 2500-2536)

The `updateWeather()` function manages spawn logic and entity updates:

```javascript
function updateWeather(tempus) {
  // Ensure Weather entity is defined
  if(typeof Weather === 'undefined' || !Weather.list) {
    return;
  }
  
  // Scale max counts based on map size
  const mapArea = mapSize * mapSize;
  const baseMapArea = 200 * 200; // 40,000 tiles
  const scaleFactor = mapArea / baseMapArea;
  
  const maxFog = Math.max(3, Math.ceil(3 * scaleFactor));
  const maxStorms = Math.max(3, Math.ceil(3 * scaleFactor));
  
  // Fog spawning (only during early morning hours)
  if(['IV.a', 'V.a', 'VI.a', 'VII.a', 'VIII.a', 'IX.a'].includes(tempus)) {
    if(Math.random() < weatherSpawnChance.fog) {
      const fogCount = Object.values(Weather.list)
        .filter(w => w.weatherType === 'fog').length;
      if(fogCount < maxFog) {
        spawnWeather('fog');
      }
    }
  }
  
  // Storm spawning (any time)
  if(Math.random() < weatherSpawnChance.storm) {
    const stormCount = Object.values(Weather.list)
      .filter(w => w.weatherType === 'storm').length;
    if(stormCount < maxStorms) {
      spawnWeather('storm');
    }
  }
  
  // Update all weather entities
  Weather.update();
}
```

**Spawn Logic:**
1. **Map Scaling**: Maximum weather counts scale with map area (base: 200×200 map)
2. **Fog Spawn Check**: Only during specified morning hours, checks current fog count
3. **Storm Spawn Check**: Any time, checks current storm count
4. **Entity Updates**: Calls `Weather.update()` to process all entities

---

## Client-Side Rendering

### Weather Effect Calculation

**File:** [`client/js/utils/WeatherHelper.js`](client/js/utils/WeatherHelper.js)

The `WeatherHelper` class calculates weather effects based on player position:

```javascript
getWeatherEffects(playerX, playerY, playerZ, config) {
  const { WeatherList, mapSize, tileSize } = config;
  
  if (playerZ !== 0) {
    return null; // Weather only affects z=0
  }
  
  const effects = {
    fog: { active: false, intensity: 0 },
    storm: { active: false, intensity: 0, distance: Infinity }
  };
  
  const mapDiagonal = mapSize * tileSize;
  
  // Check all weather systems
  for (const id in WeatherList) {
    const weather = WeatherList[id];
    const dx = weather.x - playerX;
    const dy = weather.y - playerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (weather.weatherType === 'fog') {
      const fogOuterRadius = mapDiagonal * 0.04;  // 4% of map diagonal
      const fogInnerRadius = mapDiagonal * 0.015;  // 1.5% of map diagonal
      
      if (distance < fogOuterRadius) {
        let fogIntensity = 1.0 - (distance - fogInnerRadius) / 
                          (fogOuterRadius - fogInnerRadius);
        fogIntensity = Math.max(0, Math.min(1, fogIntensity));
        fogIntensity *= weather.intensity;
        effects.fog.intensity = Math.max(effects.fog.intensity, fogIntensity);
        effects.fog.active = true;
      }
    } else if (weather.weatherType === 'storm') {
      const stormOuterRadius = mapDiagonal * 0.27;  // 27% of map diagonal
      const stormInnerRadius = mapDiagonal * 0.08;  // 8% of map diagonal
      
      if (distance < stormOuterRadius) {
        let stormIntensity = 1.0 - (distance - stormInnerRadius) / 
                            (stormOuterRadius - stormInnerRadius);
        stormIntensity = Math.max(0, Math.min(1, stormIntensity));
        stormIntensity *= weather.intensity;
        
        if (stormIntensity > effects.storm.intensity) {
          effects.storm.intensity = stormIntensity;
          effects.storm.distance = distance;
          effects.storm.active = true;
        }
      }
    }
  }
  
  return effects;
}
```

**Key Calculations:**
- **Fog Radius**: Outer 4% of map diagonal, inner 1.5% (full intensity core)
- **Storm Radius**: Outer 27% of map diagonal, inner 8% (full intensity core)
- **Intensity Falloff**: Linear interpolation between inner and outer radius
- **Multiple Weather**: If multiple weather systems affect player, highest intensity is used

### Rain Particle System

**File:** [`client/js/rendering/WeatherRenderer.js`](client/js/rendering/WeatherRenderer.js)

The `WeatherRenderer` class manages rain particles and lightning:

```javascript
class WeatherRenderer {
  constructor() {
    this.rainParticles = [];
    this.maxRainParticles = 500;
    this.lightningTimer = 0;
    this.lightningFlash = false;
  }
  
  updateRain(weatherEffects, WIDTH) {
    if (!weatherEffects || !weatherEffects.storm || !weatherEffects.storm.active) {
      this.rainParticles = [];
      return;
    }
    
    const targetParticleCount = Math.floor(
      weatherEffects.storm.intensity * this.maxRainParticles
    );
    
    // Spawn particles across entire screen
    while (this.rainParticles.length < targetParticleCount) {
      this.rainParticles.push({
        x: Math.random() * WIDTH,
        y: -10,
        speed: 15 + Math.random() * 10,
        length: 20 + Math.random() * 10
      });
    }
    
    // Update particle positions
    for (let i = this.rainParticles.length - 1; i >= 0; i--) {
      const particle = this.rainParticles[i];
      particle.y += particle.speed;
      
      // Remove if off screen
      if (particle.y > HEIGHT) {
        this.rainParticles.splice(i, 1);
      }
    }
    
    // Lightning logic (only when close to storm center)
    if (weatherEffects.storm.intensity > 0.7) {
      this.lightningTimer++;
      if (this.lightningTimer > 180 + Math.random() * 120) { // 3-5 seconds
        this.lightningFlash = true;
        this.lightningTimer = 0;
        setTimeout(() => {
          this.lightningFlash = false;
        }, 100); // 100ms flash
      }
    }
  }
  
  renderRain(ctx) {
    if (this.rainParticles.length === 0) return;
    
    ctx.strokeStyle = 'rgba(180, 180, 220, 0.8)';
    ctx.lineWidth = 2;
    
    for (const particle of this.rainParticles) {
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(particle.x, particle.y + particle.length);
      ctx.stroke();
    }
  }
}
```

**Rain Particle Properties:**
- **Max Particles**: 500 (scaled by storm intensity)
- **Spawn**: Random X position, Y = -10 (above screen)
- **Speed**: 15-25 pixels per frame
- **Length**: 20-30 pixels per drop
- **Removal**: When particle Y > screen height

**Lightning System:**
- **Trigger**: Only when storm intensity > 0.7
- **Frequency**: Random 3-5 second intervals (180-300 frames at 60 FPS)
- **Duration**: 100ms flash
- **Effect**: White screen flash (handled by lighting renderer)

### Lighting Integration

**File:** [`client/js/rendering/LightingRenderer.js`](client/js/rendering/LightingRenderer.js)

Weather affects the lighting overlay:

- **Fog**: Reduces overall lighting visibility
- **Storm**: Darkens the scene, lightning flashes create bright white overlays
- **Lightning Flash**: When `weatherRenderer.shouldFlash()` returns true, a white overlay is rendered

### Audio Integration

**File:** [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) (lines 1412-1424)

Weather triggers ambient audio:

```javascript
if(typeof getWeatherEffects !== 'undefined') {
  var weatherEffects = getWeatherEffects(p.x, p.y, p.z);
  if(weatherEffects && weatherEffects.storm.active && weatherEffects.storm.intensity > 0.3) {
    // If on a ship during storm, play seastorm ambience
    if(p.shipType || p.isBoarded) {
      ambPlayer(Amb.seastorm);
    } else {
      ambPlayer(Amb.rain);
    }
  }
}
```

**Audio Triggers:**
- **Storm Audio**: Plays when storm intensity > 0.3
- **Rain Ambience**: Standard rain sounds for land-based players
- **Seastorm Ambience**: Special storm sounds for players on ships

---

## Network Synchronization

### Server-Side Update Pack Generation

**File:** [`server/js/core/OptimizedGameLoop.js`](server/js/core/OptimizedGameLoop.js) (lines 206, 261)

Weather updates are included in every game loop update:

```javascript
const weatherPack = Weather.getAllUpdatePack();

const pack = {
  player: compressedPlayerPack,
  arrow: arrowPack,
  item: itemPack,
  light: lightPack,
  building: buildingPack,
  weather: weatherPack
};
```

**Update Frequency:**
- Weather pack generated every game loop tick
- Included in update packet sent to all connected clients
- No spatial filtering (all weather entities sent to all clients)

### Weather Update Pack Structure

**File:** [`server/js/Entity.js`](server/js/Entity.js) (lines 13396-13402)

```javascript
Weather.getAllUpdatePack = function() {
  var pack = [];
  for(var i in Weather.list) {
    pack.push(Weather.list[i].getUpdatePack());
  }
  return pack;
};
```

**Pack Format:**
```javascript
[
  {
    id: number,           // Entity ID
    x: number,            // X coordinate
    y: number,            // Y coordinate
    weatherType: string,  // 'fog' or 'storm'
    intensity: number     // 0.0-1.0
  },
  // ... more weather entities
]
```

### Client-Side Update Processing

**File:** [`client/js/core/SocketMessageHandler.js`](client/js/core/SocketMessageHandler.js) (lines 1250-1272)

Clients receive weather updates in the `UPDATE` message handler:

```javascript
// Weather updates (in UPDATE block, not REMOVE block!)
if(data.pack.weather) {
  for(var i = 0; i < data.pack.weather.length; i++) {
    var pack = data.pack.weather[i];
    if(typeof Weather !== 'undefined' && Weather.list) {
      if(!Weather.list[pack.id]) {
        // Create new weather entity
        Weather.list[pack.id] = {
          id: pack.id,
          x: pack.x,
          y: pack.y,
          weatherType: pack.weatherType,
          intensity: pack.intensity
        };
      } else {
        // Update existing weather entity
        var weather = Weather.list[pack.id];
        weather.x = pack.x;
        weather.y = pack.y;
        weather.weatherType = pack.weatherType;
        weather.intensity = pack.intensity;
      }
    }
  }
}
```

**Client-Side Weather List:**
- Maintained separately from server state
- Updated on every server update packet
- Used by `WeatherHelper` for effect calculations
- Synchronized with server state but not authoritative (server is source of truth)

---

## Technical Details

### Map Size Scaling

All weather parameters scale with map size to maintain consistent density and behavior across different map sizes.

**Base Map Size:** 200×200 tiles (40,000 tiles total)

**Scaling Formulas:**

1. **Maximum Weather Counts:**
   ```javascript
   const mapArea = mapSize * mapSize;
   const baseMapArea = 200 * 200;
   const scaleFactor = mapArea / baseMapArea;
   const maxFog = Math.max(3, Math.ceil(3 * scaleFactor));
   const maxStorms = Math.max(3, Math.ceil(3 * scaleFactor));
   ```
   - Minimum 3 weather entities regardless of map size
   - Scales proportionally with map area

2. **Movement Speed:**
   ```javascript
   const baseMapSize = 200;
   const sizeScale = mapSize / baseMapSize;
   const baseFogSpeed = 0.05;
   const baseStormSpeed = 0.15;
   const moveSpeed = (type === 'fog' ? baseFogSpeed : baseStormSpeed) * sizeScale;
   ```
   - Scales linearly with map size (not area)
   - Ensures weather moves at consistent visual speed

3. **Effect Radii:**
   ```javascript
   const mapDiagonal = mapSize * tileSize;
   const fogOuterRadius = mapDiagonal * 0.04;      // 4% of diagonal
   const fogInnerRadius = mapDiagonal * 0.015;     // 1.5% of diagonal
   const stormOuterRadius = mapDiagonal * 0.27;    // 27% of diagonal
   const stormInnerRadius = mapDiagonal * 0.08;    // 8% of diagonal
   ```
   - Radii scale with map diagonal (accounts for both dimensions)
   - Maintains consistent coverage percentage

### Intensity Falloff Calculation

Weather effects use linear interpolation for distance-based intensity:

```javascript
// Calculate distance from weather center
const distance = Math.sqrt(dx * dx + dy * dy);

// Linear interpolation between inner and outer radius
let intensity = 1.0 - (distance - innerRadius) / (outerRadius - innerRadius);
intensity = Math.max(0, Math.min(1, intensity)); // Clamp to [0, 1]
intensity *= weather.intensity; // Apply base weather intensity
```

**Falloff Behavior:**
- **Inner Radius**: Full intensity (1.0)
- **Outer Radius**: Zero intensity (0.0)
- **Between**: Linear interpolation
- **Beyond Outer**: No effect

### Performance Considerations

1. **Update Frequency**: Weather updates run every 1 second (not every game tick)
2. **Entity Count Limits**: Maximum weather entities capped based on map size
3. **Client-Side Optimization**: Weather effects only calculated when player is on z=0
4. **Particle System**: Rain particles limited to 500 maximum, scaled by intensity
5. **Network Efficiency**: All weather entities sent to all clients (no spatial filtering)

### Z-Layer Restriction

Weather only affects the overworld layer (z=0):

```javascript
if (playerZ !== 0) {
  return null; // Weather only affects z=0
}
```

This means:
- Weather has no effect in buildings (z=1, z=2)
- Weather has no effect in cellars (z=-2)
- Weather has no effect in caves/underworld (z=-1)
- Weather has no effect on ships (z=3)

---

## File Structure

### Server-Side Files

- **`lambic.js`** (lines 2467-2536, 309-312)
  - Weather spawn configuration
  - `spawnWeather()` function
  - `updateWeather()` function
  - Update interval setup

- **`server/js/Entity.js`** (lines 13302-13416)
  - `Weather` entity constructor
  - Entity update logic
  - Pack methods (init/update)
  - Global `Weather.update()` method
  - `Weather.getAllUpdatePack()` method

### Client-Side Files

- **`client/js/utils/WeatherHelper.js`**
  - `WeatherHelper` class
  - `getWeatherEffects()` method
  - Distance-based effect calculations

- **`client/js/rendering/WeatherRenderer.js`**
  - `WeatherRenderer` class
  - Rain particle system
  - Lightning flash system
  - `updateRain()` and `renderRain()` methods

- **`client/js/rendering/LightingRenderer.js`**
  - Weather lighting integration
  - Lightning flash rendering

- **`client/js/core/SocketMessageHandler.js`** (lines 1250-1272, 1412-1424)
  - Weather update packet handling
  - Audio trigger logic

- **`client/js/client.js`** (lines 1180-1218, 1274-1278)
  - Weather helper initialization
  - Weather renderer initialization
  - Integration with game loop

- **`client/js/core/GameLoopManager.js`**
  - Weather rendering integration
  - Rain particle updates

### Game Loop Integration

- **`server/js/core/OptimizedGameLoop.js`** (lines 206, 261)
  - Weather pack generation
  - Update packet assembly

---

## Code Reference

### Server-Side Key Functions

#### `spawnWeather(type)`
**Location:** [`lambic.js`](lambic.js) lines 2473-2498

Creates a new weather entity with random position and intensity.

**Parameters:**
- `type`: `'fog'` or `'storm'`

**Returns:** `undefined` (entity added to `Weather.list`)

#### `updateWeather(tempus)`
**Location:** [`lambic.js`](lambic.js) lines 2500-2536

Main weather system update function called every second.

**Parameters:**
- `tempus`: Current time period string (e.g., `'VI.a'`)

**Returns:** `undefined`

**Process:**
1. Calculates map-scaled maximum weather counts
2. Checks fog spawn conditions (morning hours only)
3. Checks storm spawn conditions (any time)
4. Calls `Weather.update()` to process all entities

#### `Weather.update()`
**Location:** [`server/js/Entity.js`](server/js/Entity.js) lines 13404-13416

Static method that updates all weather entities and returns update packs.

**Returns:** `Array` of update pack objects

#### `Weather.getAllUpdatePack()`
**Location:** [`server/js/Entity.js`](server/js/Entity.js) lines 13396-13402

Static method that collects update packs from all weather entities.

**Returns:** `Array` of update pack objects

### Client-Side Key Functions

#### `WeatherHelper.getWeatherEffects(x, y, z, config)`
**Location:** [`client/js/utils/WeatherHelper.js`](client/js/utils/WeatherHelper.js) lines 20-74

Calculates weather effects at a specific position.

**Parameters:**
- `x`: Player X coordinate
- `y`: Player Y coordinate
- `z`: Player Z coordinate
- `config`: `{ WeatherList, mapSize, tileSize }`

**Returns:** `Object` with fog and storm effect data, or `null` if z≠0

#### `WeatherRenderer.updateRain(weatherEffects, WIDTH)`
**Location:** [`client/js/rendering/WeatherRenderer.js`](client/js/rendering/WeatherRenderer.js) lines 20-65

Updates rain particle system based on storm effects.

**Parameters:**
- `weatherEffects`: Weather effects object from `WeatherHelper`
- `WIDTH`: Canvas width

**Returns:** `undefined` (updates internal particle array)

#### `WeatherRenderer.renderRain(ctx)`
**Location:** [`client/js/rendering/WeatherRenderer.js`](client/js/rendering/WeatherRenderer.js) lines 71-85

Renders rain particles to canvas.

**Parameters:**
- `ctx`: Canvas 2D rendering context

**Returns:** `undefined`

### Configuration Constants

#### `weatherSpawnChance`
**Location:** [`lambic.js`](lambic.js) lines 2468-2471

```javascript
const weatherSpawnChance = {
  fog: 0.005,      // 0.5% per tick
  storm: 0.0008    // 0.08% per tick
};
```

#### Base Movement Speeds
**Location:** [`lambic.js`](lambic.js) lines 2482-2483

```javascript
const baseFogSpeed = 0.05;      // Fog movement speed
const baseStormSpeed = 0.15;    // Storm movement speed (3x faster)
```

#### Radius Percentages
**Location:** [`client/js/utils/WeatherHelper.js`](client/js/utils/WeatherHelper.js) lines 44-45, 56-57

```javascript
// Fog
const fogOuterRadius = mapDiagonal * 0.04;   // 4% of map diagonal
const fogInnerRadius = mapDiagonal * 0.015;  // 1.5% of map diagonal

// Storm
const stormOuterRadius = mapDiagonal * 0.27;  // 27% of map diagonal
const stormInnerRadius = mapDiagonal * 0.08;  // 8% of map diagonal
```

---

## Summary

The weather system is a dynamic environmental feature that adds atmospheric depth to the game world. It operates on a server-authoritative model where weather entities spawn, move, and despawn based on time-of-day conditions and fixed lifetimes. Clients receive weather updates and render visual/audio effects based on player proximity to weather centers.

Key design principles:
- **Map-scaled**: All parameters scale with map size for consistency
- **Time-based**: Fog tied to day/night cycle, storms use fixed lifetimes
- **Distance-based effects**: Visual and audio intensity based on proximity
- **Performance-conscious**: Update frequency and entity limits prevent performance issues
- **Z-layer restricted**: Only affects overworld for gameplay clarity

