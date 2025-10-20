# Pathfinding & Movement System Analysis

## Current Architecture

### System 1: PathfindingSystem.js (229 lines) ✓ ACTIVE

**Purpose:** A* pathfinding for NPCs

**Features:**
- A* algorithm with diagonal movement
- Path caching (1000 paths, 30s TTL)
- Path smoothing to reduce zigzag
- Timeout protection (100ms max)
- Line-of-sight optimization

**Usage:**
```javascript
global.tilemapSystem.pathfindingSystem.findPath(start, end, layer, options)
```

**Performance:**
- ✅ Grid caching implemented (TilemapSystem line 85-89)
- ✅ Path caching implemented (PathfindingSystem line 14-45)
- ✅ Timeout protection prevents blocking
- ⚠️ Grid cache key includes options (may reduce hit rate)

### System 2: SimpleSerfBehavior.js (168 lines) ❌ DISABLED

**Status:** Imported but disabled in lambic.js line 4056  
**Purpose:** Serf-specific pathfinding with stuck detection  
**Current:** Serf logic moved to Entity.js  
**Action:** DELETE FILE (no longer needed)

### System 3: SerfBehaviorSystem.js (784 lines) ❌ DEPRECATED

**Status:** File exists but never imported or used  
**Purpose:** Attempted serf state machine (replaced by Entity.js logic)  
**Action:** DELETE FILE (completely unused)

### System 4: Player Movement (lambic.js ~500 lines) ✓ ACTIVE

**Purpose:** Direct WASD control for players

**Methods:**
- `updateSpd()` - Apply terrain speed modifiers
- `handleOverworldTerrain()` - Z-layer transitions
- `handleUnderwater()` - Drowning mechanics
- `moveTo()` - Position updates with validation

**No pathfinding** - Direct input control

### System 5: Serf Movement (Entity.js ~2,000 lines) ✓ ACTIVE

**Classes:** SerfM, SerfF

**Features:**
- Work mode state machine (idle, task, build, market)
- Uses PathfindingSystem for navigation
- Resource gathering/depositing
- Hut construction
- Market visits

**Issues:**
- Very long update() method (~1,000 lines?)
- Complex state logic
- Potential for simplification

---

## Performance Analysis

### Grid Generation

**Current Implementation:**
```javascript
// TilemapSystem.js line 84-89
generatePathfindingGrid(layer, options = {}) {
  const cacheKey = `${layer}_${JSON.stringify(options)}`;
  
  if (this.pathfindingCache.has(cacheKey)) {
    return this.pathfindingCache.get(cacheKey); // ✓ CACHED!
  }
  
  // Generate 256x256 grid...
}
```

**Status:** ✅ ALREADY OPTIMIZED  
**Cache Hit Rate:** Unknown (needs metrics)  
**Issue:** `JSON.stringify(options)` in cache key may cause many unique keys

**Options passed:**
- `{ canPathAcrossDoors: true }`
- `{ avoidDoors: true }`
- `{ allowSpecificDoor: true, targetDoor: [x,y] }`
- `{ avoidAreas: [...] }`

**Optimization Opportunity:**
- Normalize options object for better cache hits
- Or maintain separate grids for common option combinations

### Path Caching

**Current Implementation:**
- 1000 path limit
- 30 second TTL
- LRU eviction (oldest first)

**Status:** ✅ WELL DESIGNED  
**Cache Metrics Needed:**
- Hit rate %
- Average path reuse
- Eviction frequency

**Potential Issue:**
- Cache key includes full options JSON (reduces hit rate)
- Entities with similar but not identical paths miss cache

### Pathfinding Frequency

**Who calls findPath()?**
1. **Serfs** - When mode changes or destination changes
2. **NPCs** - When target changes or path blocked
3. **Combat** - When chasing enemies

**Frequency Estimate:**
- 20 serfs × path every 5-10 seconds = 2-4 calls/second
- 50 NPCs × occasional pathing = 2-5 calls/second
- **Total:** ~5-10 findPath() calls/second

**With Caching:** Most calls should hit cache (same work sites, patrol routes)

**Performance:** ✅ ACCEPTABLE (grid cache makes this cheap)

---

## Movement Validation

###Current Approach

**Every Frame per Entity:**
```javascript
// lambic.js - Player.update()
const loc = getLoc(self.x, self.y);
const currentTile = getTile(0, loc[0], loc[1]);

// Then check terrain type and apply speed...
if (currentTile >= TERRAIN.HEAVY_FOREST && currentTile < TERRAIN.LIGHT_FOREST) {
  self.maxSpd = (self.baseSpd * 0.3) * self.drag;
  // etc...
}
```

**Cost:**
- `getLoc()` - 2 divisions
- `getTile()` - Array lookup
- Terrain checks - Multiple comparisons
- **Per entity per frame** - ~100 entities × 25 FPS = 2,500 validations/second

**Optimization Opportunity:**
- Cache current terrain in entity (only update when position changes significantly)
- Only recalculate speed when terrain actually changes
- **Expected gain:** 50-70% reduction in tile lookups

---

## Code Duplication Analysis

### Terrain Speed Modifiers (Duplicated 2x)

**Location 1:** lambic.js `Player.updateSpd()` lines ~1865-1898
**Location 2:** lambic.js `Player.handleOverworldTerrain()` lines ~2098-2156

**Both contain:**
```javascript
if (tile >= TERRAIN.HEAVY_FOREST && tile < TERRAIN.LIGHT_FOREST) {
  self.innaWoods = true;
  self.maxSpd = (self.baseSpd * 0.3) * self.drag;
} else if (tile >= TERRAIN.LIGHT_FOREST && tile < TERRAIN.ROCKS) {
  self.innaWoods = false;
  self.maxSpd = (self.baseSpd * 0.5) * self.drag;
}
// ... etc
```

**Action:** Consolidate into single method called from both places

### Distance Calculations

**Pattern found 50+ times:**
```javascript
Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2))
```

**Solution exists:** `getDistance()` in lambic.js  
**Action:** Global find/replace with getDistance() calls

### Z-Layer Transition Logic

**Scattered across:**
- handleOverworldTerrain() - Cave entrance checks
- Door tile checks in multiple places
- Stair tile checks
- Water tile checks

**Action:** Could be consolidated into single transition handler

---

## Recommendations

### Immediate Wins (Low Risk, High Impact)

**1. Delete Deprecated Files**
- `CombatSystem.js` (462 lines)
- `SerfBehaviorSystem.js` (784 lines)
- `SimpleSerfBehavior.js` (168 lines)
- `CommandHandler.js` (503 lines) if truly unused

**Savings:** 1,917 lines, clearer codebase

**2. Optimize Movement Validation**
```javascript
// Add to Player class:
self.currentTerrain = null;
self.lastTerrainCheck = {x: 0, y: 0};

// In update():
const movedDistance = getDistance({x: self.x, y: self.y}, self.lastTerrainCheck);
if(movedDistance > tileSize / 2) { // Only check if moved half a tile
  updateTerrainSpeed();
  self.lastTerrainCheck = {x: self.x, y: self.y};
}
```

**Expected Gain:** 60-80% reduction in getTile() calls

**3. Consolidate Terrain Speed Logic**
```javascript
// Single method:
function applyTerrainSpeed(entity, tile) {
  // All terrain type checks in one place
  // Called from both updateSpd() and handleOverworldTerrain()
}
```

**Expected Gain:** Easier maintenance, no logic drift

### Medium-Term Improvements

**4. Spatial Aggro Queries**
```javascript
// Instead of checking ALL entities every second:
self.aggroInterval = setInterval(() => {
  self.checkAggro(); // Iterates ALL Player.list
}, 1000);

// Use spatial system:
const nearbyEntities = global.spatialSystem.getNearbyEntities(self, aggroRange);
// Only check these few entities
```

**Expected Gain:** 70-90% reduction in aggro checks

**5. Path Cache Optimization**
```javascript
// Normalize options for better cache hits:
const normalizedOptions = {
  doors: options.canPathAcrossDoors || options.avoidDoors ? 'yes' : 'no',
  avoiding: options.avoidAreas ? 'yes' : 'no'
};
```

**Expected Gain:** 20-40% improvement in cache hit rate

**6. Delta Update Packs**
```javascript
// Only send changed properties:
getUpdatePack() {
  const changes = {};
  if(this.x !== this._lastSent.x) changes.x = this.x;
  if(this.y !== this._lastSent.y) changes.y = this.y;
  // etc...
  return changes;
}
```

**Expected Gain:** 60-80% reduction in network traffic

---

## Integration Assessment

### Systems Work Well Together ✓

- **PathfindingSystem ↔ TilemapSystem:** Clean integration via grid generation
- **SimpleCombat ↔ Movement:** Combat properly ends on distance/z-layer change
- **Ghost Mode ↔ All Systems:** Consistently respected after fixes
- **God Mode ↔ Rendering:** Now uses getCurrentZ() consistently

### Minor Integration Issues

**Serf → Market:**
- Serfs have market visit logic
- Need to verify they actually execute market commands
- **Action:** Test and verify

**Building Completion → Serf Spawning:**
- Complex trigger chain (Build.js → Entity.js → Houses.js)
- Works but could be simplified
- **Action:** Document flow, simplify if possible

---

## Conclusion

**Pathfinding System Status:** ✅ GOOD
- Well-designed with caching
- Performance is acceptable
- Main optimization: reduce validation overhead, not pathfinding itself

**Movement System Status:** ⚠️ NEEDS CLEANUP
- Duplicate terrain logic
- Excessive validation frequency
- Can be simplified significantly

**Priority Actions:**
1. Delete deprecated files (immediate)
2. Consolidate terrain speed logic (1 hour)
3. Optimize movement validation (2 hours)
4. Extract entity definitions from Entity.js (4 hours)
5. Modularize Commands.js (6 hours)

**Expected Total Cleanup:** 2-3 days of careful refactoring

