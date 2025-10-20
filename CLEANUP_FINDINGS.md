# Cleanup Findings & Action Plan

## Deprecated Systems (Can Be Removed)

### 1. CombatSystem.js (462 lines) - DEPRECATED ✓
**Status:** Completely unused  
**Replacement:** SimpleCombat.js (304 lines) is active  
**Action:** DELETE FILE  
**Risk:** None - not referenced anywhere

### 2. SerfBehaviorSystem.js (784 lines) - DEPRECATED ✓
**Status:** Completely unused  
**Replacement:** Logic moved to Entity.js  
**Action:** DELETE FILE  
**Risk:** None - not referenced anywhere

### 3. SimpleSerfBehavior.js (168 lines) - DISABLED ✓
**Status:** Imported but explicitly disabled in lambic.js line 4056  
**Current:** Serf logic in Entity.js (SerfM/SerfF classes)  
**Action:** DELETE FILE (after confirming Entity.js serf logic is complete)  
**Risk:** Low - already disabled

### 4. CommandHandler.js (503 lines) - IMPORTED BUT UNUSED ✓
**Status:** Imported but never instantiated or used  
**Current:** All commands in Commands.js (14,517 lines)  
**Action:** Either implement OR delete  
**Recommendation:** DELETE (Commands.js works fine)

**Total Lines to Remove:** 1,917 lines (~3.5% of codebase)

---

## File Size Analysis

### Bloated Files Needing Cleanup

#### 1. Commands.js (14,517 lines) ⚠️
**Issues:**
- ALL chat commands in one massive file
- Many test/debug commands that could be removed
- Opportunity for 50%+ reduction

**Cleanup Actions:**
- Remove debug commands (test, caves, loc, etc.)
- Keep only player-facing commands
- Consider extracting to modules (but not using CommandHandler)

#### 2. Entity.js (11,210 lines) ⚠️  
**Issues:**
- Contains ALL entity definitions (100+ entity types)
- Serf behavior embedded (~2,000 lines?)
- Weapon/item definitions (~3,000 lines?)
- Building definitions (~2,000 lines?)

**Cleanup Actions:**
- Extract building definitions to separate file
- Extract weapon/item definitions to ItemFactory or separate file
- Keep character classes together
- **Estimated reduction:** 3,000-5,000 lines

#### 3. Houses.js (2,582 lines)
**Issues:**
- Some factions still use old building placement
- Redundant manual plot generation code

**Cleanup Actions:**
- Teutons now uses new system (just fixed)
- Check other factions for old code
- **Estimated reduction:** 500-1,000 lines

#### 4. client.js (7,846 lines)
**Issues:**
- Large but mostly necessary
- Some redundant rendering code

**Cleanup Actions:**
- Consolidate god mode/login camera/normal rendering
- Remove duplicate inView checks
- **Estimated reduction:** 200-500 lines

---

## Duplicate Code Patterns

### TERRAIN Constants (3 definitions found)

**Locations:**
1. `lambic.js` lines 48-66 (complete)
2. `TilemapSystem.js` lines ~275-280 (subset)
3. `BuildingPreview.js` (unknown)

**Action:** Keep lambic.js as source of truth, reference globally

### Distance Calculations

**Pattern:**
```javascript
Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2))
```

**Found in:** 50+ locations across files

**Action:** Already have `getDistance()` in lambic.js - ensure it's used everywhere

### Tile/Coordinate Conversions

**Functions:** `getLoc()`, `getCenter()`, `getCoords()`

**Status:** Centralized in lambic.js ✓  
**Action:** Verify all code uses these, not custom implementations

---

## Movement & Pathfinding Analysis

### Current Systems

**1. PathfindingSystem.js (229 lines)**
- A* implementation using pathfinding.js library
- Grid generation from tilemap
- Path caching
- Used by NPCs

**2. SimpleSerfBehavior.js (168 lines) - DISABLED**
- Serf-specific pathfinding logic
- Custom stuck detection
- Building/work site navigation

**3. Entity.js Serf Logic (~2,000 lines)**
- SerfM and SerfF classes
- Work mode state machine
- Resource gathering, depositing, building

**4. Player Movement (lambic.js)**
- Direct WASD control (no pathfinding)
- updateSpd() for terrain modifiers
- handleOverworldTerrain() for z-layer transitions

### Issues Found

**Problem 1: Grid Generation Frequency**
```javascript
// In PathfindingSystem.js - generates grid on EVERY pathfinding call
const grid = tilemapSystem.generatePathfindingGrid(z, options);
```
**Impact:** Expensive operation repeated frequently  
**Solution:** Cache grids per z-layer, only regenerate when tiles change

**Problem 2: Duplicate Movement Validation**
- updateSpd() checks terrain
- moveTo() validates destination  
- handleOverworldTerrain() checks again
**Solution:** Single validation point

**Problem 3: Z-Layer Logic Scattered**
- handleOverworldTerrain() in lambic.js
- Transition checks in multiple places
- Cave/building/water logic duplicated
**Solution:** Centralize in one method

---

## Performance Opportunities

### Server-Side

**1. Aggro Checking (High Impact)**
**Current:** Every entity calls checkAggro() every 1 second (setInterval)
```javascript
self.aggroInterval = setInterval(() => {
  self.checkAggro();
}, 1000);
```
**Issue:** With 100+ entities, this is 100+ checks/second  
**Solution:** Spatial-query-based aggro (only check nearby entities)  
**Expected Gain:** 50-70% reduction in aggro overhead

**2. Update Pack Optimization (Medium Impact)**
**Current:** Sends full player state every frame
```javascript
getUpdatePack() {
  return {
    id, house, kingdom, x, y, z, class, rank,
    friends, enemies, gear, inventory, // Full objects every frame!
    ...
  }
}
```
**Issue:** Large network traffic for unchanged data  
**Solution:** Delta updates (only send changed properties)  
**Expected Gain:** 60-80% network traffic reduction

**3. Path Caching (Medium Impact)**
**Current:** Cache exists but may not be effective  
**Issue:** Cache invalidation too aggressive?  
**Solution:** Review cache hit/miss rates, optimize invalidation

### Client-Side

**1. Render Culling (Already Good)**
**Current:** Viewport system works well  
**Action:** Minor optimizations only

**2. Draw Call Reduction**  
**Issue:** May redraw unchanged areas  
**Solution:** Dirty rectangle tracking

---

## Integration Issues

### God Mode
**Status:** Working after fixes  
**Lesson:** Should have used getCurrentZ() from start  
**Action:** Audit all rendering for consistency

### Ghost Mode
**Status:** Working  
**Integration:** SimpleCombat, aggro, movement all respect ghost flag ✓

### Stealth
**Status:** Working  
**Integration:** Transparency, aggro, reveal conditions implemented ✓

### Market System
**Status:** Needs verification  
**Question:** Are serfs actually using markets?  
**Action:** Test and verify serf market behavior

---

## Recommended Deletion List

### Files to Delete (Low Risk)
1. `/server/js/core/CombatSystem.js` - 462 lines
2. `/server/js/core/SerfBehaviorSystem.js` - 784 lines  
3. `/server/js/core/SimpleSerfBehavior.js` - 168 lines (if Entity.js logic is complete)
4. `/server/js/commands/CommandHandler.js` - 503 lines (unused)

**Total Potential Deletion:** 1,917 lines

### Code to Remove from Active Files

**Commands.js (~2,000 lines of debug commands):**
- `test` command and item spawning
- `caves` command (debug)
- `loc`/`coords` command (debug)
- Other admin/test commands not needed for gameplay

**Entity.js (~1,000 lines of commented code):**
- Old combat logic references
- Commented-out functions
- Unused weapon definitions

**Houses.js (~500 lines of old building placement):**
- Manual plot generation code from old system
- Duplicate terrain checks

---

## Next Phase: Deep Dive into Pathfinding

**Questions to Answer:**
1. Is PathfindingSystem.js grid generation efficient?
2. Are serfs using PathfindingSystem or custom logic?
3. Can we consolidate into single movement/pathfinding system?
4. What's the actual cache hit rate?
5. Can we reduce pathfinding calls?

**Files to Analyze:**
- `PathfindingSystem.js` (229 lines)
- `Entity.js` SerfM/SerfF movement (~2,000 lines)
- Player movement in `lambic.js` (~500 lines)

This will be Phase 2 of the audit.

