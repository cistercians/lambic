# Genesis System Guide

## Overview

The Genesis system is the procedural world generation system that creates the game's tilemap using Simplex Noise. It generates a 192×192 tile map (36,864 tiles total) with multiple layers for terrain, buildings, resources, and underground caves.

## File Locations

- **Main implementation**: `server/js/genesis.js`
- **Browser version**: `mapmodeler/js/genesis.js` (adapted for client-side use)
- **Integration point**: `lambic.js` (lines 148-152)

## System Architecture

### Output Structure

Genesis returns an array of 9 tilemap layers:

- **Layer 0**: Overworld (terrain tiles)
- **Layer 1**: Underworld/Caves (initially all solid, then carved out)
- **Layer 2**: Underwater (water tiles below surface)
- **Layer 3**: Build I (building layer 1)
- **Layer 4**: Build II (building layer 2)
- **Layer 5**: Build III (building layer 3)
- **Layer 6**: Res I (overworld resources - wood/stone)
- **Layer 7**: Res II (underworld resources - ore)
- **Layer 8**: Build IV (building layer 4)

### Data Format

Each layer is a 2D array: `worldMaps[layer][y][x]` where:

- `x`, `y` are tile coordinates (0-191)
- Values are terrain type numbers (0-6 for terrain, resource amounts for resource layers)

**Note**: The array structure is `[y][x]` (row-major order), so `worldMaps[0][y][x]` accesses the overworld layer at coordinates (x, y).

## Step-by-Step Generation Process

### Phase 1: Noise Generation

1. **Initialize SimplexNoise instance**
   - Uses the `simplex-noise` npm package
   - No seed is explicitly set, so each generation is unique

2. **Create canvas** (192×192 pixels, 1 pixel = 1 tile)
   - Uses Node.js `canvas` package
   - Creates ImageData buffer for pixel manipulation

3. **Generate RGB noise values** for each pixel using three channels:
   - **Red channel**: Large-scale features (continents/oceans)
     - Formula: `simplex.noise2D(x / redFrequencyX, y / redFrequencyY) * redAmplitude + redOffset`
     - Stored as: `r * 125` in red channel
   - **Green channel**: Medium-scale features (biomes)
     - Formula: `simplex.noise2D(x / greenFrequencyX, y / greenFrequencyY) * greenAmplitude + greenOffset`
     - Combined with others: `(r + g + b) * 160` in green channel
   - **Blue channel**: Fine details (local variation)
     - Formula: `simplex.noise2D(x / blueFrequencyX, y / blueFrequencyY) * blueAmplitude + blueOffset`
     - Fixed value: `70` in blue channel

4. **Convert RGB to HSV** (Hue, Saturation, Value)
   - The `rgbToHsv()` function extracts Hue (H) and Value (V)
   - Only H and V are used for terrain classification (Saturation is discarded)

5. **Apply mosaic effect**
   - The `mosaic()` function expands 1-pixel samples to full tiles
   - Since tile size is 1, this effectively does nothing but ensures consistency

6. **Extract HSV data**
   - The `getHv()` function converts the canvas back to an array of [H, V] pairs
   - This array is passed to the terraform function

### Phase 2: Terrain Classification

The `terraform()` function converts HSV values to terrain types:

1. **Iterate through each tile position** (x, y)
   - Processes tiles in row-major order (x outer loop, y inner loop)

2. **Extract Hue (H) and Value (V)** from HSV data
   - Index `i` tracks position in the linear HSV array
   - `source[i][0]` = Hue
   - `source[i][1]` = Value

3. **Apply classification rules** in priority order:
   - **Water**: `H > waterThreshold` (0.39)
     - Overworld: 0 (WATER)
     - Underwater: 1 (solid underwater)
   - **Mountain**: `V > mountainThreshold` (0.99)
     - Value: `5 + random(0.0-0.9)` (MOUNTAIN with variation)
   - **Rocks**: `V > rocksThreshold` (0.85)
     - Split into two types based on HSV value range:
       - **Regular rocks** (lower 2/3 of rock range): Value `4` (integer, no decimals)
       - **Large rocks** (upper 1/3 of rock range): Value `4.01-4.99` (decimals used for overlay offset)
     - Upper third boundary: `rocksThreshold + (0.99 - rocksThreshold) * (2/3)`
   - **Brush**: `H <= brushThreshold` (0.3)
     - Value: `3 + random(0.0-0.9)` (BRUSH with variation)
   - **Heavy Forest**: Default (everything else)
     - Value: `1 + random(0.0-0.9)` (HEAVY_FOREST with variation)
     - **Note**: Light forest is not generated initially. It only appears when heavy forest resources are depleted below 100 units through gameplay.

4. **Add random variation** (0.0-0.9) to terrain values for visual variety
   - Applied via: `Number((Math.random()*0.9).toFixed(2))`
   - This creates visual diversity within each terrain type

5. **Initialize all other layers** to default values:
   - Underworld: All set to 1 (solid rock)
   - Build layers (3, 4, 5, 8): All set to 0 (empty)
   - Resource layers (6, 7): All set to 0 (no resources yet)

### Phase 3: Cave Entrance Identification

The `idEntrances()` function finds potential cave entrance locations:

1. **Divide map into 4×4 grid** (48×48 tile subsections)
   - `subsection = Math.floor(mapTiles / 4)` = 48

2. **For each subsection**:
   - Search for mountain tiles (value 5-6) with non-mountain tile below
   - Condition: `tile >= 5 && tile < 6 && tileBelow < 5`
   - Collect all valid candidates in `select` array
   - **75% chance to place an entrance** (`Math.random() > 0.25`)
   - Randomly select one candidate from subsection if placing entrance

3. **Result**: Array of entrance coordinates `[[x, y], ...]`

### Phase 4: Cave Generation

The `geoform()` function generates cave systems using a random walk algorithm:

1. **For each identified entrance**:
   - Start one tile south of entrance: `currentColumn--`
   - Initialize tunnel parameters:
     - `maxTunnels`: 250 (total tunnel segments to create)
     - `maxLength`: 12 tiles (maximum tunnel segment length)
     - `minLength`: 1 tile (minimum tunnel segment length)
     - `roomChance`: 0.18 (18% chance to create a room)
     - `roomSize`: 3 (base room size, creates 3×3 to 5×5 rooms)
     - `continueDirectionChance`: 0.35 (35% chance to continue same direction)
     - `branchChance`: 0.45 (45% chance to create a branch)
     - `randomWalkChance`: 0.35 (35% chance for completely random direction)

2. **Generate tunnels** using random walk:
   - **Direction selection**:
     - 35% chance: Continue in same direction (maintains structure)
     - 35% chance: Completely random direction (adds chaos)
     - 30% chance: Change direction (avoiding backwards)
   - **Tunnel creation**:
     - Random length between `minLength` and `maxLength`
     - Clear tiles by setting to 0 (empty space)
     - Check bounds to prevent going outside map
   - **Branching**:
     - 45% chance to create side branch during tunnel creation
     - Branch length: 1-10 tiles
     - Branches can create sub-branches (25% chance, 1-6 tiles)
     - Sub-branches can create sub-sub-branches (12% chance, 1-4 tiles)
   - **Room creation**:
     - 18% chance to create a room instead of continuing tunnel
     - Room size: 3×3 to 5×5 tiles (random)
     - Rooms are cleared (set to 0)

3. **Mark entrance/exit tiles**:
   - Overworld: Set entrance tile to `6` (CAVE_ENTRANCE)
   - Underworld: Set exit tile (one south of entrance) to `2`

### Phase 5: Resource Placement

#### Overworld Resources (Layer 6)

Resources are placed based on terrain type:

- **Heavy Forest (1-2) or Mountain (5-6)**: 100 units
  - Condition: `worldMaps[0][y][x] >= 1 && worldMaps[0][y][x] < 2` OR `worldMaps[0][y][x] >= 5 && worldMaps[0][y][x] < 6`
  - Sets: `worldMaps[6][y][x] = 100`
  - **Note**: All forest areas are initially generated as heavy forest with 100 resource units. Light forest only appears when heavy forest resources are depleted to ≤100 units through gameplay.

#### Underworld Resources (Layer 7)

Ore is placed in cave walls:

- **20% chance** on solid cave walls adjacent to open space
  - Condition: `worldMaps[1][y][x] == 1` (solid rock)
  - Must be adjacent to open space: `worldMaps[1][y+1][x] == 0` OR `worldMaps[1][y-1][x] == 0` OR `worldMaps[1][y][x+1] == 0` OR `worldMaps[1][y][x-1] == 0`
  - Sets tile to: `3 + random(0.0-0.9)` (ROCKS)
  - Sets resource: `worldMaps[7][y][x] = 150` (ore)

## Noise Parameters

### Red Channel (Continents/Oceans)

Controls large-scale landmass distribution:

- **redFrequencyX**: 90 (horizontal scale)
  - Lower = larger landmasses
  - Higher = more islands/fractured coastlines
- **redFrequencyY**: 78 (vertical scale)
  - Lower = larger landmasses
  - Higher = more islands/fractured coastlines
- **redAmplitude**: 0.7 (contrast)
  - Higher = more dramatic land/water contrast
- **redOffset**: 0.33 (baseline shift)
  - Higher = more land, lower = more water

**Effect**: Determines overall continent shapes and ocean distribution.

### Green Channel (Biomes)

Controls medium-scale biome regions:

- **greenFrequencyX**: 16 (horizontal scale)
  - Lower = larger biome regions
  - Higher = more varied/mixed terrain
- **greenFrequencyY**: 22 (vertical scale)
  - Lower = larger biome regions
  - Higher = more varied/mixed terrain
- **greenAmplitude**: 0.74 (contrast)
  - Higher = more distinct biome boundaries
- **greenOffset**: 0.42 (baseline shift)
  - Affects biome distribution balance

**Effect**: Creates terrain patches and biome regions.

### Blue Channel (Fine Details)

Adds local variation and detail:

- **blueFrequencyX**: 6 (horizontal scale)
  - Lower = smoother terrain
  - Higher = more detailed/noisy terrain
- **blueFrequencyY**: 6 (vertical scale)
  - Lower = smoother terrain
  - Higher = more detailed/noisy terrain
- **blueAmplitude**: 0.35 (intensity)
  - Higher = more local variation
- **blueOffset**: 0.15 (baseline shift)
  - Minimal effect on final output

**Effect**: Adds fine-grained detail and natural variation.

### Terrain Thresholds

These thresholds convert HSV values into terrain types:

- **waterThreshold**: 0.39
  - Hue threshold for water
  - Higher = more land, lower = more water
- **mountainThreshold**: 0.99
  - Value threshold for mountains
  - Very high elevation (0.99 = 99th percentile)
- **rocksThreshold**: 0.85
  - Value threshold for rocks
  - High elevation (0.85 = 85th percentile)
- **brushThreshold**: 0.3
  - Hue threshold for brush
  - Dry/arid regions

## Terrain Type Values

Based on TERRAIN constants defined in `lambic.js`:

- **0**: WATER
- **1**: HEAVY_FOREST (with random 0.0-0.9 variation) - **Only forest type generated initially**
- **2**: LIGHT_FOREST (with random 0.0-0.9 variation) - **Not generated initially; only appears when heavy forest resources drop to ≤100 units**
- **3**: BRUSH (with random 0.0-0.9 variation)
- **4**: ROCKS (regular rocks - integer value)
- **4.x**: LARGE_ROCKS (large rocks - decimal values 4.01-4.99, decimals used for overlay offset)
  - Regular rocks: Value `4` (no decimals)
  - Large rocks: Value `4.01-4.99` (decimals used for offsetting rocks.png overlay)
  - Large rocks occupy the upper third of the rock HSV value range
- **5**: MOUNTAIN (with random 0.0-0.9 variation)
- **6**: CAVE_ENTRANCE (placed during cave generation)

**Note**: Most terrain types have random variation (0.0-0.9) added to base terrain values for visual diversity. For example, a mountain tile might have value `5.47` instead of exactly `5`. However, regular rocks use the integer value `4` (no decimals), while large rocks use `4.01-4.99` (decimals used for overlay offset rendering).

**Important**: Light forest is no longer generated during initial map creation. All forest areas start as heavy forest. Light forest only appears dynamically when heavy forest resources are depleted below the threshold (100 units) through gameplay actions like tree chopping.

## Integration with Game Systems

### Initialization (lambic.js)

```javascript
const genesis = require('./server/js/genesis');
let world = genesis.map;
let caveEntrances = genesis.entrances || [];
gameState.initializeWorld(world);
tilemapIntegration.initializeFromWorldArray(world, gameState.mapSize);
```

The Genesis module is executed immediately when required (line 522), generating the world at server startup.

### Tilemap Migration

The `TilemapMigration` class converts the old world array format to the new `TilemapSystem`:

- Migrates all 9 layers
- Preserves spawn points and biome data
- Creates compatibility layer for legacy code
- Uses sparse storage (Map-based) for efficiency

### Access Patterns

There are three ways to access tile data:

1. **Direct access**: `world[layer][y][x]`
   - Legacy format, still used in some places
   - Note: Array is `[y][x]` (row-major)

2. **Through TilemapSystem**: `tilemapSystem.getTile(layer, x, y)`
   - New optimized system
   - Uses sparse storage
   - Note: Parameters are `(layer, x, y)` not `(layer, y, x)`

3. **Through TilemapIntegration**: `tilemapIntegration.getTile(layer, x, y)`
   - Wrapper around TilemapSystem
   - Provides compatibility layer
   - Note: Parameters are `(layer, x, y)`

**Important**: The coordinate order differs between direct access (`[y][x]`) and the new system (`(x, y)`).

## Key Functions

### `genesis()`

Main entry point. Executes the entire generation process and returns:

```javascript
{
  worldMaps: [/* 9 layers */],
  entrances: [[x, y], ...]
}
```

**Execution flow**:
1. Generate noise
2. Convert to terrain
3. Identify cave entrances
4. Generate caves
5. Place resources
6. Return result

### `terraform(source, width, height, tileWidth, tileHeight)`

Converts HSV data to terrain tilemap.

**Parameters**:
- `source`: Array of [H, V] pairs from noise generation
- `width`, `height`: Canvas dimensions (192)
- `tileWidth`, `tileHeight`: Tile size (1)

**Returns**: Array of 9 layers (allTileMaps)

### `idEntrances()`

Identifies cave entrance locations from overworld terrain.

**Process**:
- Divides map into 4×4 grid
- Searches each subsection for mountain edges
- 75% chance to place entrance per subsection
- Stores coordinates in `entrances` array

**Note**: This function modifies the `entrances` array in the closure scope.

### `geoform(map, c, r)`

Generates cave system using random walk algorithm.

**Parameters**:
- `map`: Underworld layer array (Layer 1)
- `c`: Column (x coordinate) of entrance
- `r`: Row (y coordinate) of entrance

**Process**:
- Starts one tile south of entrance
- Creates up to 250 tunnel segments
- Generates branches and rooms
- Clears tiles by setting to 0

**Note**: The function modifies the map array in place.

## Performance Considerations

- **Map size**: 192×192 = 36,864 tiles
- **Generation happens once** at server startup
- **All layers initialized** even if mostly empty (sparse storage in TilemapSystem)
- **Cave generation is most computationally expensive** (250 tunnels × multiple branches per entrance)
- **Noise generation**: O(n²) where n = map size (192² = 36,864 iterations)
- **Resource placement**: O(n²) for overworld, O(n²) for underworld

## Customization Points

To modify world generation, adjust these parameters in `server/js/genesis.js`:

1. **Noise parameters** (lines 69-86)
   - Adjust frequencies, amplitudes, and offsets
   - See comments for experimentation guide

2. **Terrain thresholds** (lines 167-170)
   - Modify terrain distribution
   - Lower thresholds = more of that terrain type
   - Note: lightForestThreshold has been removed - all forest areas are now generated as heavy forest

3. **Cave generation parameters** (lines 270-277)
   - `maxTunnels`: Total tunnel segments (default: 250)
   - `maxLength`: Maximum tunnel length (default: 12)
   - `roomChance`: Room creation probability (default: 0.18)
   - `branchChance`: Branch creation probability (default: 0.45)

4. **Resource placement logic** (lines 506-517)
   - Overworld resource amounts: Heavy forest and mountains get 100 units
   - Underworld ore probability (0.2 = 20%)
   - Underworld ore amount (150)
   - Note: Light forest resource placement has been removed - all forest starts as heavy forest with 100 units

5. **Entrance placement probability** (line 277)
   - Currently: `Math.random() > 0.25` (75% chance)
   - Change threshold to adjust entrance density

6. **Map size** (line 60)
   - Currently: `canvasSize = 192`
   - Must be a factor of canvas width/height if using different tile sizes

## Notes

- The system uses **Simplex Noise** (not Perlin) for smoother, more natural-looking terrain
- **Random variation** (0.0-0.9) is added to terrain values for visual diversity
- **Cave entrances** are placed at mountain edges (elevation transitions)
- **Underworld starts as completely solid** (value 1), then carved out by cave generation
- **Resource layers use numeric values** (100, 150) rather than terrain type codes
- The **blue channel** in noise generation is set to a fixed value (70) and doesn't contribute to terrain classification
- **Coordinate system**: Be aware of the `[y][x]` vs `(x, y)` difference between old and new systems
- **Generation is deterministic** only if SimplexNoise is seeded (currently not seeded, so each run is unique)
- **Forest generation**: Only heavy forest is generated initially. Light forest only appears when heavy forest resources are depleted to ≤100 units through gameplay

## Example: Modifying Terrain Distribution

To create a world with more water and fewer mountains:

```javascript
// In server/js/genesis.js

// Increase water (more water = lower threshold)
var waterThreshold = 0.35; // Changed from 0.39

// Decrease mountains (fewer mountains = higher threshold)
var mountainThreshold = 0.995; // Changed from 0.99
```

To create larger, more connected landmasses:

```javascript
// Lower frequencies = larger features
var redFrequencyX = 70; // Changed from 90
var redFrequencyY = 60; // Changed from 78
```

**Note**: The `lightForestThreshold` parameter has been removed. All forest areas are now generated as heavy forest. To affect forest distribution, adjust other thresholds (waterThreshold, brushThreshold, etc.) which control how much land becomes forest vs other terrain types.

## Related Systems

- **TilemapSystem**: New optimized tile storage system
- **TilemapIntegration**: Compatibility layer between old and new systems
- **TilemapMigration**: Converts old world array to new format
- **MapAnalyzer**: Analyzes generated geography for AI faction placement
- **ZoneManager**: Manages geographic zones and features
