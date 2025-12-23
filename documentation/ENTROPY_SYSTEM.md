# Entropy System Documentation

## Executive Summary

The Entropy system is a dynamic ecosystem simulation that runs daily at midnight to manage flora (vegetation) growth and fauna (animal) population balance. It simulates natural processes like tree growth, forest spreading, and animal population control based on biome availability.

**Key Functions:**
- **Flora Management**: Tree growth, forest spreading, and terrain conversion
- **Fauna Management**: Animal population balancing based on heavy forest biome availability
- **Biome Tracking**: Dynamic tracking of heavy forest spawn points that directly affects fauna ratios

**Execution**: Called once per day at midnight (when tempus changes) via `entropy()` function in `lambic.js:2243-2466`

---

## System Architecture

### Overview Diagram

```
Daily Cycle (Midnight)
    ↓
entropy() Function
    ├── FLORA PROCESSING
    │   ├── Tree Growth (world[6] resource layer)
    │   ├── Forest Conversion (Light → Heavy)
    │   ├── Forest Spreading (Brush → Light Forest)
    │   └── Brush Spreading (Empty → Brush)
    │
    ├── BIOME UPDATES
    │   └── Update biomes.hForest and hForestSpawns array
    │
    └── FAUNA PROCESSING
        ├── Calculate Population Ratios (based on biomes.hForest)
        ├── Count Existing Fauna (from Player.list)
        └── Spawn Animals (if population < ratio)
```

### Core Data Structures

- **`biomes.hForest`**: Integer count of heavy forest spawn points (used for ratio calculations)
- **`hForestSpawns`**: Array of `[c, r]` coordinates representing heavy forest tiles
- **`world[6]`**: Resource layer tracking tree growth (0-300, increments 0-2 per day)
- **`toHF`**: Array of coordinates to convert to heavy forest
- **`toF`**: Array of coordinates to convert to light forest  
- **`toB`**: Array of coordinates to convert to brush

---

## Flora System

### Terrain Types

| Terrain | Value | Description |
|---------|-------|-------------|
| HEAVY_FOREST | 1 | Mature forest, can spawn fauna |
| LIGHT_FOREST | 2 | Growing forest, can mature to heavy |
| BRUSH | 3 | Undergrowth, can grow to light forest |
| EMPTY | 7 | Grass/empty land, can grow brush |

### Tree Growth Mechanism

**Heavy Forest Growth** (`lambic.js:2256-2260`)
- Tiles with `TERRAIN.HEAVY_FOREST` (value 1.x) increment resource layer `world[6][r][c]`
- Increment: `Math.floor(Math.random() * 2)` (0 or 1 per day)
- Maximum: 300 (growth stops at this cap)
- Purpose: Tracks tree maturity/health for visual representation

**Light Forest to Heavy Forest** (`lambic.js:2262-2267`)
- Tiles with `TERRAIN.LIGHT_FOREST` (value 2.x) increment resource counter
- When `world[6][r][c] > 100`: Tile converts to heavy forest
- Conversion preserves decimal positioning offset
- **Biome Update**: `biomes.hForest++` and coordinate added to `hForestSpawns` array
- **Impact**: Increases available fauna spawn points, affecting population ratios

### Forest Spreading

**Brush to Light Forest** (`lambic.js:2268-2286`)
- **Condition**: Brush tile (value 3.x) adjacent to heavy/light forest
- **Requirements**:
  - Neighbor must be `TERRAIN.HEAVY_FOREST` or `TERRAIN.LIGHT_FOREST`
  - Neighbor's resource layer `world[6] > 49`
- **Probability**: 5% chance per day (`Math.random() < 0.05`)
- **Result**: Brush converts to light forest with resource value 50
- **Process**: Checks 4 neighbors (N, S, E, W), first match triggers conversion

**Empty to Brush** (`lambic.js:2287-2304`)
- **Condition**: Empty tile (value 7) adjacent to forest/brush
- **Requirements**: Neighbor must be `TERRAIN.HEAVY_FOREST`, `TERRAIN.LIGHT_FOREST`, or `TERRAIN.BRUSH`
- **Probability**: 5% chance per day (`Math.random() < 0.05`)
- **Result**: Empty converts to brush with random decimal offset (0-0.9)
- **Process**: Checks 4 neighbors, first match triggers conversion

### Tile Change Functions

**`preserveDecimalOnTerrainChange(currentTile, newTerrainType)`** (`lambic.js:2229-2234`)
- Preserves decimal portion of tile value when converting terrain types
- Example: `2.45` → `1.45` (light forest to heavy forest, keeps positioning offset)
- Formula: `newTerrainType + (currentTile % 1)`

**`createBrushTileWithRandomDecimal()`** (`lambic.js:2238-2241`)
- Creates brush tile with random positioning offset
- Formula: `TERRAIN.BRUSH + Number((Math.random() * 0.9).toFixed(2))`
- Result: Value between 3.00 and 3.90

### Flora Processing Flow

1. **Iterate all tiles** (0 to mapSize for both c and r)
2. **Check tile type** and apply growth/spreading logic
3. **Collect changes** in arrays (`toHF`, `toF`, `toB`)
4. **Apply changes** after iteration completes (prevents double-processing)
5. **Update biomes** when heavy forest tiles are created

### Flora Statistics

Returned in entropy result:
- `tilesToHeavyForest`: Count of light forest → heavy forest conversions
- `tilesToLightForest`: Count of brush → light forest conversions
- `tilesToBrush`: Count of empty → brush conversions
- `tilesChanged`: Sum of all conversions

---

## Fauna System

### Population Ratio Calculation

Ratios are calculated based on `biomes.hForest` (count of heavy forest spawn points):

```javascript
const animalRatios = {
  deer: Math.floor(biomes.hForest / 300),   // 1 deer per 300 heavy forest tiles
  boar: Math.floor(biomes.hForest / 600),   // 1 boar per 600 heavy forest tiles
  wolf: Math.floor(biomes.hForest / 500),   // 1 wolf per 500 heavy forest tiles
  falcon: Math.min(Math.floor(biomes.hForest / 800), maxFalcons)  // 1 falcon per 800, capped
};
```

**Falcon Cap Calculation** (`lambic.js:2338-2341`)
- Base: 12 falcons for 200x200 map (40,000 tiles)
- Formula: `maxFalcons = Math.floor(12 * (mapArea / 40000))`
- Scales proportionally with map size

**Example Calculations:**
- If `biomes.hForest = 12,000`:
  - Deer: `Math.floor(12000 / 300) = 40`
  - Boar: `Math.floor(12000 / 600) = 20`
  - Wolf: `Math.floor(12000 / 500) = 24`
  - Falcon: `Math.min(Math.floor(12000 / 800), maxFalcons) = Math.min(15, maxFalcons)`

### Population Counting

**Entity Detection** (`lambic.js:2354-2372`)
- Iterates through `Player.list` (all entities in game)
- Checks `entity.class` property for animal types
- Handles both capitalized (`Deer`, `Boar`, `Wolf`, `Falcon`) and lowercase variants
- Counts stored in `animalPops` object with both variants

**Population Summation** (`lambic.js:2376-2381`)
- Combines lowercase and capitalized counts:
  ```javascript
  totalPops = {
    deer: (animalPops.deer || 0) + (animalPops.Deer || 0),
    boar: (animalPops.boar || 0) + (animalPops.Boar || 0),
    wolf: (animalPops.wolf || 0) + (animalPops.Wolf || 0),
    falcon: (animalPops.falcon || 0) + (animalPops.Falcon || 0)
  };
  ```

### Spawn Logic

**Spawn Condition** (`lambic.js:2386`)
- Only spawns if `pop < ratio` (current population below target)

**Day 1 Spawn** (`lambic.js:2387-2388`)
- Formula: `Math.floor(ratio * 0.618)` (golden ratio, ~61.8% of target)
- Purpose: Initial population seeding on first day
- Example: Ratio 40 → Spawn 24 deer

**Subsequent Days** (`lambic.js:2418-2423`)
- Formula: `Math.max(1, Math.floor((ratio - pop) * 0.33))`
- Recovery rate: `0.33` (33% of deficit per day) for ALL fauna types
- Minimum spawn guarantee: At least 1 animal spawns if population is below ratio
- Purpose: Rapid population recovery toward target with guaranteed minimum
- Example: Ratio 40, Pop 21 → Spawn `Math.max(1, Math.floor((40-21) * 0.33)) = Math.max(1, 6) = 6`

**Spawn Location** (`lambic.js:2400`)
- Uses `randomSpawnHF()` function
- Selects random coordinate from `hForestSpawns` array
- Falls back to overworld spawns if no heavy forest available
- Filters to named geographic zones if `zoneManager` exists

**Entity Creation** (`lambic.js:2434-2440`)
- Creates entity via `AnimalConstructor({...})` with options object
- Animal constructors: `Deer()`, `Boar()`, `Wolf()`, `Falcon()`
- Parameters:
  - `x, y`: Spawn coordinates (pixel position from `randomSpawnHF()`)
  - `z: 0` (overworld)
  - `home`: Home location object with `{ z: 0, loc: [tileX, tileY] }` in tile coordinates
  - `falconry: false` (for falcons only, undefined for other animals)

### Fauna Statistics

- `faunaAdded`: Total count of animals spawned in this entropy cycle
- Logged per animal type with ratio and current population

---

## Integration Points

### Daily Cycle Integration

**Call Site** (`lambic.js:6195-6200`)
- Called at midnight when tempus changes
- Uses `lastEntropyTempus` to prevent multiple calls per day
- Returns statistics for daily recap system

```javascript
if (lastEntropyTempus !== newTempus) {
  entropyStats = entropy() || { tilesChanged: 0, faunaAdded: 0 };
  lastEntropyTempus = newTempus;
}
```

### Tilemap System Integration

**Spawn Point Management**
- `hForestSpawns` array managed by entropy system
- Initialized from `global.tilemapSystem.getSpawnPoints('heavyForest')` (`lambic.js:252`)
- Updated when:
  - Light forest converts to heavy forest: `hForestSpawns.push([c, r])` (`lambic.js:2316`)
  - Heavy forest cleared by lumbermill: `hForestSpawns.splice(i, 1)` (`lambic.js:4142`)

**Biome Tracking**
- `biomes.hForest` initialized from spawn point count (`lambic.js:257`)
- Incremented when heavy forest created (`lambic.js:2315`)
- Decremented when heavy forest cleared (`lambic.js:4141`)

### Entity System Integration

**Fauna Entities**
- Fauna entities stored in `Player.list` (shared entity registry)
- Identified by `entity.class` property (`Deer`, `Boar`, `Wolf`, `Falcon`)
- Counted during entropy to determine current population

**Entity Creation**
- Uses global constructors: `Deer()`, `Boar()`, `Wolf()`, `Falcon()`
- Entities created via `AnimalConstructor({...})` with options object containing `x`, `y`, `z`, `home`, and `falconry` properties
- Entities automatically registered in `Player.list` upon creation
- Entities have `type: 'fauna'` and appropriate `class` property

### Resource Layer Integration

**World Layer 6** (`world[6]`)
- Tracks tree growth/maturity (0-300)
- Heavy forest: Increments 0-1 per day, max 300
- Light forest: Increments 0-1 per day, converts at > 100
- Cleared when trees are chopped (lumbermill operations)

### Building System Integration

**Lumbermill Operations** (`lambic.js:4130-4149`)
- When heavy forest is cleared:
  - Tile converts to light forest (if resource > 0) or empty (if resource = 0)
  - `biomes.hForest--`
  - Coordinate removed from `hForestSpawns` array
- Impact: Reduces available fauna spawn points, lowering population ratios

---

## Mathematical Models

### Flora Growth Model

**Tree Maturity:**
- Heavy forest: `world[6][r][c] += random(0, 1)` per day, capped at 300
- Light forest: `world[6][r][c] += random(0, 1)` per day, converts at > 100
- Expected conversion time: ~100-200 days (assuming 0.5 average increment)

**Spreading Probability:**
- Brush → Light Forest: 5% per day per eligible neighbor
- Empty → Brush: 5% per day per eligible neighbor
- Expected spread rate: Depends on forest density and adjacency

### Fauna Population Model

**Target Population:**
```
target = biomes.hForest / divisor
```

Where divisors are:
- Deer: 300
- Boar: 600
- Wolf: 500
- Falcon: 800 (capped by map size)

**Spawn Rate:**
```
Day 1: spawn = floor(target * 0.618)
Day N: spawn = max(1, floor((target - current) * 0.33))
```

Recovery rate: `0.33` (33% of deficit per day) for ALL fauna types, with a minimum guarantee of 1 spawn if population is below target.

**Population Recovery:**
- With 33% recovery rate, population reaches 90% of target in ~3-4 days
- Minimum spawn guarantee ensures at least 1 animal spawns per day when below target ratio

---

## Recommendations

### System Improvements

1. **Population Capping**
   - Consider adding maximum spawn limit to prevent overshooting ratios
   - Potential implementation: `Math.min(spawn, ratio - pop)` to cap at deficit

2. **Recovery Rate Tuning**
   - Current 33% recovery rate for all animals with minimum spawn guarantee
   - May need adjustment based on gameplay balance testing
   - Recovery is quite rapid (90% of target in ~3-4 days), consider reducing if populations recover too quickly

3. **Logging Enhancements**
   - Add more detailed logging for spawn calculations
   - Include biome counts and ratio calculations in logs
   - Track population trends over time

4. **Testing**
   - Add unit tests for spawn calculations
   - Test edge cases (ratio = 0, pop > ratio, etc.)
   - Verify spawn behavior across multiple days

---

## Code References

### Primary Functions
- `entropy()` - `lambic.js:2243-2466` - Main entropy function
- `randomSpawnHF()` - `lambic.js:2105-2137` - Heavy forest spawn point selection
- `preserveDecimalOnTerrainChange()` - `lambic.js:2229-2234` - Terrain conversion helper
- `createBrushTileWithRandomDecimal()` - `lambic.js:2238-2241` - Brush tile creation

### Integration Points
- Entropy call site - `lambic.js:6195-6200`
- Biome initialization - `lambic.js:252-257`
- Biome updates - `lambic.js:2315-2316` (increment), `lambic.js:4141-4142` (decrement)
- Global day variable - `lambic.js:481`

### Constants
- `TERRAIN` - `lambic.js:61-79` - Terrain type definitions
- `TILE_SIZE` - `lambic.js:95` - Tile size constant (64 pixels)

---

## Appendix: Example Calculations

### Scenario: 12,000 Heavy Forest Tiles

**Ratios:**
- Deer: `12000 / 300 = 40`
- Boar: `12000 / 600 = 20`
- Wolf: `12000 / 500 = 24`
- Falcon: `12000 / 800 = 15` (capped by map size if applicable)

**Day 1 Spawns:**
- Deer: `40 * 0.618 = 24.72 → 24`
- Boar: `20 * 0.618 = 12.36 → 12`
- Wolf: `24 * 0.618 = 14.83 → 14`
- Falcon: `15 * 0.618 = 9.27 → 9`

**Day 2 Recovery (if pop = 20 deer):**
- Expected: `Math.max(1, Math.floor((40 - 20) * 0.33)) = Math.max(1, 6) = 6`
- Spawns 6 animals (33% of 20 deficit)

**Day 2 Recovery (if pop = 10 deer):**
- Expected: `Math.max(1, Math.floor((40 - 10) * 0.33)) = Math.max(1, 9) = 9`
- Spawns 9 animals (33% of 30 deficit)

**Day 2 Recovery (if pop = 0 deer):**
- Expected: `Math.max(1, Math.floor((40 - 0) * 0.33)) = Math.max(1, 13) = 13`
- Spawns 13 animals (33% of 40 deficit)

**Note**: With 33% recovery rate and minimum spawn guarantee, at least 1 animal spawns whenever population is below target. The recovery rate ensures rapid population growth toward target ratios. For example, if ratio is 40 and pop is 0, the deficit is 40, which yields `Math.max(1, Math.floor(40 * 0.33)) = Math.max(1, 13) = 13` spawns.
