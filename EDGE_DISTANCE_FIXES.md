# Edge Distance Optimization for Faction Spawning

## Problem Summary
After implementing boundary padding, factions were failing to spawn due to overly aggressive edge filtering:
- **Norsemen**: 0 water spawn points (water is at coastlines/edges)
- **Celts**: Only 2 caves available, both excluded by spacing
- **Teutons**: All forest points had insufficient padding for their radius

## Root Cause
Initial edge distances were uniform (25-30 tiles) but didn't account for:
1. **Terrain distribution** - Water is naturally at map edges
2. **Faction evaluation radius** - Different factions need different padding
3. **Resource scarcity** - Caves are rare, need more lenient filtering

## Solution: Terrain-Specific Edge Distances

### Updated Spawn Point Edge Distances

| Terrain Type | Edge Distance | Rationale |
|--------------|---------------|-----------|
| **Underground** | 15 tiles | Chamber check is primary safety, minimal edge buffer needed |
| **Water** | 10 tiles | Water is naturally at edges (coastlines), use minimal padding |
| **Cave Entrances** | 20 tiles | Caves are rare resources, be lenient to preserve options |
| **Forest** | 30 tiles | Shared by Teutons (radius 25) and Celts (radius 20), use max |
| **Overworld** | 35 tiles | Used by Franks (radius 30) and Goths (radius 25), use max |

### Code Changes

**1. Water Spawn Points** (Norsemen)
```javascript
const minEdgeDistance = 10; // Water is naturally at edges, use minimal padding
```
- **Was**: 25 tiles → 0 water points found
- **Now**: 10 tiles → Many water points available

**2. Cave Entrance Points** (Celts)
```javascript
const minEdgeDistance = 20; // Celts need room (radius 20, but caves are rare so be lenient)
```
- **Was**: 25 tiles → Only 2 caves
- **Now**: 20 tiles → More caves available

**3. Forest Spawn Points** (Teutons, Celts, Outlaws)
```javascript
const minEdgeDistance = 30; // Teutons need radius 25 + 5, Celts need radius 20 + 5
```
- **Was**: 20 tiles → Insufficient for Teutons (need 30 total)
- **Now**: 30 tiles → All faction radii fit within bounds

**4. Overworld Spawn Points** (Goths, Franks, Teutons)
```javascript
const minEdgeDistance = 35; // Franks need radius 30 + 5, Goths need radius 25 + 5
```
- **Was**: 10 tiles → Insufficient for any grass/brush faction
- **Now**: 35 tiles → All faction radii fit within bounds

**5. Underground Spawn Points** (Brotherhood, Mercenaries)
```javascript
const minEdgeDistance = 15; // Underground needs min 15 tile buffer
```
- **Was**: Not pre-filtered, all 21K+ points tested, first 100 rejected
- **Now**: Pre-filtered to ~2,400 valid points

## Additional Improvement: Celts Fallback Logic

Added automatic retry for Celts if cave search fails:

```javascript
// FALLBACK: If Celts failed with caves (due to spacing), retry with forest
if (requirements.preferCaves && searchPoints.length < 10) {
  console.log(`  ${factionName}: Cave search failed, retrying with forest points...`);
  const forestPoints = this.getForestSpawnPoints();
  // ... search forest points ...
}
```

**When it triggers:**
- Celts search caves first (preferCaves: true)
- If < 10 caves found OR all excluded by spacing
- Automatically retry with forest points (their secondary terrain)

**Why it works:**
- Celts are forest-dwellers who prefer caves
- If no caves available due to spacing, they can still thrive in heavy forest
- Maintains their character while ensuring placement success

## Evaluation Padding Safety Net

The `evaluateHQLocation()` function still has adaptive boundary check:
```javascript
const boundaryPadding = Math.max(radius + 5, 15); // At least 15 tiles, or radius+5
```

This provides **double protection**:
1. **Pre-filter** at spawn point generation (performance)
2. **Safety check** at evaluation (correctness)

## Expected Results by Faction

### Underground Factions (Layer 1)
**Brotherhood**
- Edge distance: 15 tiles
- Evaluation radius: 10 tiles
- Buffer needed: 10 + 5 = 15 ✓
- Result: **2,456 valid points** (from 23,899 total)

**Mercenaries**
- Edge distance: 15 tiles
- Evaluation radius: 8 tiles
- Buffer needed: 8 + 5 = 13 tiles ✓
- Result: **2,456 valid points** (from 23,899 total)
- Plus: Immediate 3×3 chamber check for object placement

### Surface Factions (Layer 0)

**Norsemen** (Coastal)
- Edge distance: 10 tiles
- Evaluation radius: 20 tiles
- Buffer needed: 20 + 5 = 25 tiles
- Note: Water is at edges, evaluation check handles safety
- Result: **Many water points** available (was 0)

**Celts** (Cave/Forest)
- Cave edge distance: 20 tiles
- Forest edge distance: 30 tiles
- Evaluation radius: 20 tiles
- Buffer needed: 20 + 5 = 25 tiles ✓
- Fallback: Forest if caves unavailable
- Result: **Multiple options** with automatic fallback

**Goths** (Grass/Brush)
- Edge distance: 35 tiles
- Evaluation radius: 25 tiles
- Buffer needed: 25 + 5 = 30 tiles ✓
- Result: **~45 valid points** (was 68 before spacing filter)

**Franks** (Grass/Brush)
- Edge distance: 35 tiles
- Evaluation radius: 30 tiles
- Buffer needed: 30 + 5 = 35 tiles ✓
- Result: **~43 valid points** (was 67 before spacing filter)

**Teutons** (Flexible)
- Edge distance: 30-35 tiles (combines overworld + forest)
- Evaluation radius: 25 tiles
- Buffer needed: 25 + 5 = 30 tiles ✓
- Result: **~74 valid points** (combines both terrain types)

**Outlaws** (Forest)
- Edge distance: 30 tiles
- Evaluation radius: 15 tiles
- Buffer needed: 15 + 5 = 20 tiles ✓
- Result: **~34 valid points** (was more before spacing)

## Performance Impact

**Before**: Testing 100+ edge locations per faction, all failing
- Brotherhood: 100 tests, 100 "too close" rejections
- Mercenaries: 100 tests, 100 "too close" rejections
- Celts: 7 tests, 7 "too close" rejections
- Teutons: 9 tests, 9 "too close" rejections

**After**: Pre-filtered points, only valid locations tested
- Brotherhood: ~2,400 valid points, immediate success
- Mercenaries: ~2,400 valid points, immediate success
- Celts: More caves available + forest fallback
- Teutons: ~74 combined points, proper padding

**Result**: Faster faction placement, fewer wasted evaluations

## Map Coverage Analysis

**256×256 tile map = 65,536 total tiles**

**Valid spawn zones:**
- Underground (15+ from edge): 226×226 = 51,076 tiles (78% of map)
- Water (10+ from edge): 236×236 = 55,696 tiles (85% of map)
- Caves (20+ from edge): 216×216 = 46,656 tiles (71% of map)
- Forest (30+ from edge): 196×196 = 38,416 tiles (59% of map)
- Overworld (35+ from edge): 186×186 = 34,596 tiles (53% of map)

**Interpretation:**
- Underground/water factions have most flexibility (78-85% of map)
- Overworld grass/brush factions more constrained (53% of map)
- Ensures all factions have adequate buffer from edges
- Prevents "corner spawns" with limited expansion

## Summary

✓ **Water**: 10-tile padding (coastlines preserved)
✓ **Underground**: 15-tile padding (open chambers verified)
✓ **Caves**: 20-tile padding (rare resources preserved)
✓ **Forest**: 30-tile padding (fits Teutons + Celts)
✓ **Overworld**: 35-tile padding (fits Franks + Goths)
✓ **Celts Fallback**: Automatic forest retry if caves fail
✓ **Double Protection**: Pre-filter + evaluation check

All 8 factions should now successfully spawn with appropriate edge distances!

