# Performance Investigation - Lag Buildup Analysis

## Summary
Added comprehensive profiling instrumentation to identify the root cause of progressive lag buildup over time.

## Key Finding: Unused OptimizedEntityManager

**CRITICAL DISCOVERY**: The `OptimizedEntityManager` system is instantiated but **never actually used**.

- **File**: `server/js/core/OptimizedGameLoop.js` line 85
- **Issue**: `entityManager.updateEntities()` was being called every frame on an empty entity list
- **Impact**: Wasted CPU cycles every frame
- **Fix**: Commented out the redundant call (line 86)

The game has two parallel entity management systems:
1. **Legacy System**: `Player.list`, `Item.list`, `Arrow.list`, `Building.list` (ACTIVELY USED)
2. **OptimizedEntityManager**: Never populated, calling empty update loop

This is a **minor** performance issue but not the root cause of progressive lag.

---

## Profiling Instrumentation Added

### 1. Player.update() Performance Tracking
**File**: `lambic.js` lines 3358-3507

Tracks:
- Total update time per frame
- Entity count
- Min/Max/Average timing over 5-second windows
- Slow frame detection (>16.67ms)

**Output every 5 seconds**:
```
⏱️  Player.update() Performance (last 5s):
   450 entities, avg=12.45ms, min=8.23ms, max=28.91ms
   Slow frames: 15/300 (>16.67ms)
```

### 2. sendUpdates() System Breakdown
**File**: `server/js/core/OptimizedGameLoop.js` lines 110-194

Tracks individual timing for:
- `Player.update()`
- `Arrow.update()`
- `Item.update()`
- `Light.update()`
- `Building.update()`

**Output every 5 seconds**:
```
⏱️  sendUpdates() Performance (last 5s):
   Player: avg=12.45ms, max=28.91ms
   Arrow: avg=0.15ms, max=1.23ms
   Item: avg=0.82ms, max=3.45ms
   Building: avg=0.34ms, max=2.10ms
   TOTAL: avg=13.76ms, max=32.15ms
```

### 3. Memory State Monitoring
**File**: `lambic.js` lines 5101-5115

Tracks potential memory leaks:
- **PathCache**: Entry count vs max size
- **EventManager**: Event history size, subscriber count
- **ZoneManager**: Zone count, tracked players
- **SpatialSystem**: Tracked entities, cell count

**Output every 30 seconds**:
```
💾 Memory State:
   PathCache: 847/1000 entries
   EventManager: 1000/1000 events, 4 subscribers
   ZoneManager: 45 zones, 2 tracked players
   SpatialSystem: 450 entities, 128 cells
💾 Memory: RSS=256.45MB, Heap=189.32MB / 256.00MB
```

### 4. Entity Count Breakdown
**File**: `lambic.js` lines 5085-5099

Detailed fauna population tracking:
```
📊 Entity counts: Players=450, Items=89, Arrows=12, Buildings=67
🦌 Fauna: Deer=45, Boar=12, Wolf=18, Falcon=8, Serfs=320, Other=47
```

---

## How to Use This Data

### Step 1: Identify the Slowest System
Run the server and monitor the console output. Look for:

**If Player.update() is slow (>16.67ms average)**:
- Problem is in entity update logic
- Check if specific entity types are causing issues (serfs with pathfinding?)
- Look for O(n²) loops in `Entity.js`

**If Arrow.update() is slow**:
- Too many arrows being tracked
- Arrow cleanup not working

**If Item.update() is slow**:
- Items accumulating without cleanup
- Check item despawn logic

**If Building.update() is slow**:
- Building production/consumption logic too expensive
- Check garrison production, mill processing, etc.

### Step 2: Check for Memory Growth
Compare memory stats at Day 2 vs Day 197:

**PathCache growing?**
- Paths being cached faster than cleanup
- Solution: Reduce TTL or increase cleanup frequency

**EventManager at 1000/1000?**
- Ring buffer is full (expected)
- If subscriber count is growing → memory leak

**ZoneManager zones growing?**
- Faction territories being created without cleanup

**SpatialSystem entities/cells growing disproportionately?**
- Dead entities not being removed from spatial index
- Check `entity.cleanup()` is calling `spatialSystem.removeEntity()`

### Step 3: Check Entity Growth
Track fauna counts over time:

**If Deer/Boar/Wolf growing unbounded**:
- Entropy spawn rates exceed death/despawn rates
- Need population caps

**If Falcons growing**:
- No falcon death mechanism (currently invulnerable)
- Need natural despawn

**If Serfs growing**:
- Taverns creating serfs without limits
- Need serf cap per tavern

---

## Likely Root Causes (Ranked by Probability)

### 1. Pathfinding Collision Check (HIGH)
**File**: `lambic.js` line 606-613

**Current code**:
```javascript
for (const playerId in Player.list) {
  const player = Player.list[playerId];
  if (player.z === z && Math.abs(player.x - center[0]) < 20 && Math.abs(player.y - center[1]) < 20) {
    return false;
  }
}
```

**Issue**: O(n) loop for EVERY pathfinding step
- With 450 entities, a path of 50 steps = 22,500 collision checks
- Multiple serfs pathfinding simultaneously = O(n²)

**Solution**: Use spatial system lookup (commented out code was correct!)

### 2. Unbounded Entity Growth (MEDIUM)
**Symptoms**: Fauna counts steadily increasing
**Cause**: Entropy spawn rates > death rates
**Solution**: Population caps proportional to map size

### 3. Spatial System Update Overhead (MEDIUM)
**File**: `lambic.js` line 3470-3472

Every entity updates spatial index every frame:
```javascript
if (global.spatialSystem) {
  global.spatialSystem.updateEntity(i, player);
}
```

**Issue**: If entities aren't moving, this is wasted work
**Solution**: Only update spatial index when entity actually moves

### 4. Zone Manager Checks (LOW)
**File**: `lambic.js` lines 3443-3461

Zone transition checks happen for all players every frame.
Map lookups in `tileIndex` could be expensive with many zones.

### 5. PathCache Growth (LOW)
Currently capped at 1000 entries with 60s cleanup.
Monitor to ensure it's not causing hash collisions.

---

## Next Steps

1. **Run the server with profiling enabled**
2. **Monitor console output at Day 2, Day 50, Day 100, Day 197**
3. **Compare timing metrics across different game stages**
4. **Identify which system's timing is degrading**
5. **Apply targeted optimizations based on data**

The profiling will tell us definitively where the bottleneck is instead of guessing.









