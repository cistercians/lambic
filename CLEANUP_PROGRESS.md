# Cleanup Progress Report

## Completed Actions ✅

### Phase 1: Analysis & Documentation
- ✅ Created GAME_STATE_AUDIT.md - Comprehensive game overview
- ✅ Created CLEANUP_FINDINGS.md - Identified deprecated systems
- ✅ Created PATHFINDING_ANALYSIS.md - Deep dive into movement systems

### Phase 2: File Deletions (1,917 lines removed)
- ✅ Deleted `CombatSystem.js` (462 lines) - Replaced by SimpleCombat.js
- ✅ Deleted `SerfBehaviorSystem.js` (784 lines) - Replaced by Entity.js logic
- ✅ Deleted `SimpleSerfBehavior.js` (168 lines) - Disabled, moved to Entity.js
- ✅ Deleted `CommandHandler.js` (503 lines) - Unused import

### Phase 3: Code Consolidation
- ✅ Removed deprecated imports from lambic.js
- ✅ Created `applyTerrainSpeed()` helper method
- ✅ Updated `updateSpd()` to use consolidated logic
- ✅ Updated `handleOverworldTerrain()` to use consolidated logic

**Lines Saved So Far:** ~2,000 lines (~3.7% reduction)

---

## Key Findings

### ✅ Systems Working Well

**1. Pathfinding (PathfindingSystem.js)**
- Grid caching implemented
- Path caching implemented (1000 paths, 30s TTL)
- Timeout protection working
- **No major changes needed**

**2. Combat (SimpleCombat.js)**
- Clean, simple design
- Good integration with ghost/god mode
- **No major changes needed**

**3. Rendering (client.js)**
- Viewport culling working
- Multiple camera modes successful
- getCurrentZ() consolidation completed
- **Minor optimizations possible**

### ⚠️ Areas Needing Attention

**1. Commands.js (14,517 lines) - BLOATED**

**Debug commands that could be removed:**
- `test` - Spawns test items around player
- `caves` - Lists all cave entrances  
- `loc`/`coords` - Shows player position (debug info)

**Estimation:** 500-1,000 lines of debug commands could be removed

**Action:** Mark debug commands with feature flag or remove entirely

**2. Entity.js (11,210 lines) - VERY LARGE**

**Contains:**
- ~100 entity type definitions (characters, items, buildings)
- Serf behavior logic (~2,000 lines)
- Character base class
- Item definitions mixed with character logic

**Potential Extractions:**
- Building entity definitions → separate file (~1,500 lines)
- Item entity definitions → expand ItemFactory (~2,000 lines)
- Keep character classes in Entity.js

**Estimation:** Could reduce to ~7,500 lines (33% reduction)

**3. Movement Validation - INEFFICIENT**

**Current:** Every entity checks terrain every frame
- 100 entities × 25 FPS = 2,500 getTile() calls/second

**Optimization:**
```javascript
// Only revalidate when moved > half a tile
self.lastValidatedPos = {x: 0, y: 0};

if(getDistance(self, self.lastValidatedPos) > tileSize/2) {
  updateTerrainSpeed();
  self.lastValidatedPos = {x: self.x, y: self.y};
}
```

**Expected Gain:** 70-80% reduction in tile lookups

---

## Remaining Work

### High Priority

**1. Optimize Movement Validation**
- Add distance-based terrain check
- Cache current terrain type
- **Impact:** Major performance improvement
- **Risk:** Low
- **Time:** 1 hour

**2. Remove Debug Commands**
- Flag or remove test/debug commands from Commands.js
- **Impact:** Code clarity
- **Risk:** None (preserve player commands)
- **Time:** 2 hours

### Medium Priority

**3. Extract Building Definitions from Entity.js**
- Move to server/js/entities/Buildings.js
- Keep references working
- **Impact:** File organization
- **Risk:** Medium (many references)
- **Time:** 4 hours

**4. Consolidate TERRAIN Constants**
- Ensure single source of truth (lambic.js)
- Remove duplicate definitions
- **Impact:** Maintainability
- **Risk:** Low
- **Time:** 1 hour

**5. Spatial Aggro Optimization**
- Use spatial system for aggro checks
- Remove entity-by-entity iteration
- **Impact:** Performance
- **Risk:** Medium (behavior change)
- **Time:** 3 hours

### Low Priority

**6. Delta Update Packs**
- Only send changed properties
- **Impact:** Network optimization
- **Risk:** Medium (protocol change)
- **Time:** 6 hours

**7. Path Cache Improvements**
- Normalize options for better cache hits
- Add cache metrics
- **Impact:** Minor performance gain
- **Risk:** Low
- **Time:** 2 hours

---

## Testing Status

### Current Server State
- ✅ Builds and runs without errors
- ✅ All factions initialize correctly
- ✅ Pathfinding working
- ✅ Combat working
- ✅ God mode working (after fixes)

### Tests Needed After Further Cleanup

**Critical Path:**
- Player movement on all terrain types
- NPC pathfinding to caves/buildings
- Serf resource gathering
- Combat and death
- Building construction

**Secondary:**
- Market system
- Stealth mechanics
- Ghost respawn
- Faction HQ cycling in god mode

---

## Recommendations for Next Steps

### Option A: Continue Aggressive Cleanup
- Proceed with all optimizations
- Extract entities, remove debug code
- Implement movement validation optimization
- **Time:** 2-3 days
- **Risk:** Medium (lots of changes)

### Option B: Conservative Approach
- Stop here (1,917 lines saved)
- Only do high-priority optimizations
- Leave Entity.js as-is for now
- **Time:** 1 day
- **Risk:** Low

### Option C: Hybrid Approach (RECOMMENDED)
- Do movement validation optimization (high impact, low risk)
- Remove debug commands (easy win)
- Leave Entity.js extraction for later
- **Time:** 1 day
- **Risk:** Low
- **Benefit:** ~70% of the gains, ~30% of the risk

**Recommendation:** Option C - Get the major performance wins without risking stability

