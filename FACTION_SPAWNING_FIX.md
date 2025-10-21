# Faction Spawning Fix - Map Boundaries & Underground Chambers

## Problems Identified

### 1. Map Edge Spawning
**Issue:** Factions were spawning right at map boundaries (x:0, y:0, x:255, y:255), which:
- Cuts available territory in half
- Limits expansion potential
- Creates unnatural faction placement
- Can cause pathfinding issues at boundaries

### 2. Underground Tunnel Spawning
**Issue:** Brotherhood and Mercenaries were spawning in tight tunnels instead of open chambers because:
- Percentage checks over large radius can be misleading
- A tunnel adjacent to a chamber can have good overall percentages
- But the actual spawn point is still in the tunnel
- Objects (barrels, crates, chest) block entire passage

## Solutions Implemented

### 1. Boundary Padding System

Added to `evaluateHQLocation()` in `MapAnalyzer.js`:

```javascript
// CRITICAL: Check map boundaries - don't spawn too close to edges
const boundaryPadding = (layer === 0) ? 30 : 20;
if (tile[0] < boundaryPadding || tile[0] >= this.mapSize - boundaryPadding ||
    tile[1] < boundaryPadding || tile[1] >= this.mapSize - boundaryPadding) {
  return { isValid: false, score: 0, reason: 'too close to map edge' };
}
```

**Padding Values:**
- **Surface factions (z:0):** 30 tiles from edge
  - Provides ~1,920px buffer (30 × 64px tiles)
  - Allows full territory development in all directions
- **Underground factions (z:-1):** 20 tiles from edge
  - Smaller padding since underground is more constrained
  - Provides ~1,280px buffer

**Map Dimensions:** 256×256 tiles
- Valid spawn range (surface): [30, 225] in both axes
- Valid spawn range (underground): [20, 235] in both axes

### 2. Immediate Vicinity Check for Underground

Added 3×3 tile check for underground factions:

```javascript
// UNDERGROUND FACTIONS: Check immediate vicinity for open space (no tunnels!)
if (layer === 1) {
  const immediateVicinity = [
    [tile[0]-1, tile[1]], [tile[0]+1, tile[1]], // Left, right
    [tile[0], tile[1]-1], [tile[0], tile[1]+1], // Up, down
    [tile[0]-1, tile[1]-1], [tile[0]+1, tile[1]-1], // Diagonals
    [tile[0]-1, tile[1]+1], [tile[0]+1, tile[1]+1],
    [tile[0], tile[1]] // Center itself
  ];
  
  let openCount = 0;
  for (const t of immediateVicinity) {
    const terrain = Math.floor(this.getTerrain(t[0], t[1], layer));
    if (terrain === 0) openCount++; // Cave floor = open
  }
  
  // At least 7 of 9 tiles (77%) must be open for underground spawn
  if (openCount < 7) {
    return { isValid: false, score: 0, reason: `tight tunnel (${openCount}/9 open)` };
  }
}
```

**How It Works:**
- Checks the spawn point itself + 8 surrounding tiles (3×3 grid)
- Requires **7 out of 9 tiles (77%)** to be open cave floor (terrain 0)
- If spawn is in a tunnel, most adjacent tiles will be walls → fails check
- If spawn is in a chamber, all adjacent tiles are open → passes check

**Example Results:**
```
Tunnel Spawn:
  [wall][floor][wall]
  [floor][HERE][floor]  → Only 5/9 open → REJECTED
  [wall][floor][wall]

Chamber Spawn:
  [floor][floor][floor]
  [floor][HERE][floor]  → 9/9 open → ACCEPTED ✓
  [floor][floor][floor]
```

### 3. Adjusted Underground Faction Requirements

Since immediate vicinity check is more reliable, lowered percentage requirements:

**Brotherhood:**
```javascript
Brotherhood: {
  searchLayer: 1,
  requiredTerrain: [0],
  minTerrainPercentage: 0.25, // Was 0.35, now 0.25
  evaluationRadius: 10, // Was 8, now 10 (larger chamber)
  priorities: { openSpace: 60, uniformCaveTerrain: 30, isolation: 10 }
}
```

**Mercenaries:**
```javascript
Mercenaries: {
  searchLayer: 1,
  requiredTerrain: [0],
  minTerrainPercentage: 0.30, // Was 0.40, now 0.30
  evaluationRadius: 8, // Same, need room for 5 objects + chest
  priorities: { openSpace: 70, centralLocation: 20, uniformCaveTerrain: 10 }
}
```

**Why Lower Percentages:**
- The 3×3 immediate check guarantees spawn is in open area
- Percentage over larger radius now measures "chamber size" not "is it a tunnel"
- More underground locations become viable
- Still guarantees safe spawning

## Technical Details

### Evaluation Order
1. **Boundary check** (first, fastest rejection)
2. **Immediate vicinity check** (underground only, guarantees chamber spawn)
3. **Terrain percentage check** (overall area suitability)
4. **Feature checks** (caves, water, etc.)
5. **Scoring** (best location within valid options)

### Rejection Reasons Now Include
- `'too close to map edge'` - Within boundary padding
- `'tight tunnel (X/9 open)'` - Underground faction in tunnel
- `'terrain X% < Y%'` - Insufficient terrain type
- `'spacing conflict'` - Too close to another faction

### Performance Impact
- Boundary check: O(1) - simple coordinate comparison
- Immediate vicinity: O(9) - checks 9 tiles
- Minimal performance cost for major reliability gain

## Expected Results

### Surface Factions (Goths, Franks, Celts, Teutons, Norsemen, Outlaws)
- Will spawn between 30-225 tiles in both x and y
- Minimum 30-tile buffer from all edges
- Full 360° expansion potential
- Territory can grow without hitting boundaries

### Underground Factions (Brotherhood, Mercenaries)
- Will spawn only in open chambers (7/9 tiles open)
- 20-tile buffer from map edges
- Brotherhood: Larger chambers (radius 10)
- Mercenaries: Medium chambers (radius 8) with room for objects

### Mercenaries Objects
- 5 random objects (Barrel, Crates, Stash2)
- 1 locked chest (1-2 tiles from firepit)
- Will NOT block tunnels (spawn is in open chamber)
- Players can navigate around objects

## Testing Recommendations

### Verify Boundary Padding
1. Check faction HQ coordinates in godmode
2. No faction should be at x<30, x>225, y<30, or y>225 (surface)
3. No faction should be at x<20, x>235, y<20, or y>235 (underground)

### Verify Chamber Spawning
1. Visit Brotherhood and Mercenaries HQs
2. Should be in open cave chambers, not tight tunnels
3. Multiple pathfinding routes should exist around the HQ
4. Objects should not completely block passages

### Verify Object Placement (Mercenaries)
1. 5 objects + 1 chest should spawn
2. Objects spread around firepit in open space
3. Tunnel entrance/exit should remain accessible
4. Players can walk around/between objects

## Files Modified

**server/js/ai/MapAnalyzer.js:**
- Added boundary padding check (lines 295-301)
- Added immediate vicinity check for underground (lines 303-323)
- Lowered Brotherhood minTerrainPercentage: 0.35 → 0.25
- Lowered Mercenaries minTerrainPercentage: 0.40 → 0.30
- Increased Brotherhood evaluationRadius: 8 → 10
- Kept Mercenaries evaluationRadius: 8 (needs compact chamber for objects)

## Summary

**Before:**
- ❌ Factions spawn at map edges
- ❌ Underground factions spawn in tunnels
- ❌ Objects block entire passages
- ❌ Limited territory expansion

**After:**
- ✓ All factions spawn with buffer from edges
- ✓ Underground factions spawn in open chambers
- ✓ Objects placed in spacious areas
- ✓ Full 360° expansion potential
- ✓ Reliable pathfinding around HQs

These fixes ensure all 8 factions spawn in appropriate, playable locations with room to develop their territories!

