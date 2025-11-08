# Progressive Lag Fix Summary

## Issues Addressed

### 1. **Pathfinding O(n) Bottleneck** ✅ FIXED
**File**: `lambic.js` lines 603-606

**Problem**: `isLineWalkable()` looped through all 450+ entities for every pathfinding tile
- 450 entities × 50 tiles per path = **22,500 checks per pathfinding call**
- Multiple serfs pathfinding = **O(n²) complexity**

**Solution**: Removed entity collision checks from pathfinding
```javascript
// OPTIMIZED: Skip entity collision checks during pathfinding
// Entities can pathfind through each other - actual collision handled during movement
// This prevents O(n) loops (450 entities × 50 tiles = 22,500 checks per path!)
```

**Impact**: Eliminated the single biggest performance bottleneck

---

### 2. **Serf Cave Entrance Loops** ✅ FIXED
**File**: `server/js/Entity.js`

**Problem**: Ore mining serfs infinitely entering/exiting caves

**Solution**: Added `mineExitCooldown` (120 frames = 2 seconds)
- Prevents re-entry immediately after exiting
- Breaks the loop cycle
- Allows deposit action to complete

**Impact**: Reduces wasted CPU on stuck serfs

---

### 3. **Serf Resource Deposits Not Working** ✅ FIXED
**File**: `server/js/Entity.js`

**Problem**: Serf deposits checked `House.list[b.owner]` instead of `House.list[b.house]`
- Owner = player ID (not in House.list)
- House = faction ID (correct)
- Deposits failed silently

**Solution**: Changed all 7 resource deposits to use `b.house` first
- Grain, Wood, Stone, Iron Ore, Silver Ore, Gold Ore, Diamonds

**Impact**: Serfs now productively contribute resources

---

### 4. **Unused OptimizedEntityManager** ✅ FIXED
**File**: `server/js/core/OptimizedGameLoop.js` line 86

**Problem**: Called `entityManager.updateEntities()` on empty entity list every frame

**Solution**: Commented out the redundant call

**Impact**: Minor CPU savings (low priority)

---

## Performance Monitoring Added

### Active Profiling (Every 5 Seconds)

**Player.update() Timing** (`lambic.js` lines 3358-3507):
```
⏱️  Player.update() Performance (last 5s):
   450 entities, avg=8.45ms, min=6.23ms, max=18.91ms
   Slow frames: 12/300 (>16.67ms)
```

**sendUpdates() Breakdown** (`OptimizedGameLoop.js` lines 110-194):
```
⏱️  sendUpdates() Performance (last 5s):
   Player: avg=8.45ms, max=18.91ms
   Arrow: avg=0.15ms, max=1.23ms
   Item: avg=0.82ms, max=3.45ms
   Building: avg=0.34ms, max=2.10ms
   TOTAL: avg=9.76ms, max=22.15ms
```

### Memory Monitoring (Every 30 Seconds)

**Entity Counts** (`lambic.js` lines 5085-5141):
```
📊 Entity counts: Players=450, Items=89, Arrows=12, Buildings=67
🦌 Fauna: Deer=45, Boar=12, Wolf=18, Falcon=8, Serfs=320, Other=47

💾 Memory State:
   PathCache: 847/1000 entries
   EventManager: 1000/1000 events, 4 subscribers
   ZoneManager: 45 zones, 2 tracked players
   SpatialSystem: 450 entities, 128 cells
💾 Memory: RSS=256.45MB, Heap=189.32MB / 256.00MB
```

---

## What To Monitor

### Watch for Progressive Degradation

**Good signs**:
- ✅ Player.update() avg stays under 16.67ms
- ✅ Memory RSS/Heap relatively stable
- ✅ PathCache not hitting 1000/1000
- ✅ Fauna counts stable (not growing unbounded)

**Bad signs (investigate further)**:
- ⚠️ Player.update() avg increasing over time (8ms → 12ms → 18ms)
- ⚠️ Memory RSS steadily climbing
- ⚠️ Entity count growing without player action
- ⚠️ PathCache constantly at max capacity

### Known Remaining Issues

1. **EventManager Ring Buffer**: Always at 1000/1000 (expected, not a leak)
2. **Fauna Population**: Currently no hard caps (could grow unbounded)
3. **Serf Spawning**: No cap per tavern (could accumulate)

---

## Next Steps If Lag Persists

### If Player.update() is slow:
1. Check the profiling logs - which entities are consuming time?
2. Look for stuck serfs (infinite loops in work logic)
3. Check for combat entities with expensive aggro checks

### If memory grows:
1. Check PathCache size - if always at 1000, reduce TTL
2. Check entity count - are fauna spawning faster than dying?
3. Check for timer leaks - intervals not being cleared

### If specific system is slow:
1. Arrow.update() slow → too many arrows, check cleanup
2. Item.update() slow → items not despawning
3. Building.update() slow → building production logic too expensive

---

## Expected Performance

With all fixes applied:
- **Target**: 60 FPS stable (16.67ms per frame)
- **Acceptable**: 30-60 FPS (16-33ms per frame)
- **Problem**: <30 FPS (>33ms per frame)

The pathfinding fix alone should provide **2-5x performance improvement** with high entity counts.






