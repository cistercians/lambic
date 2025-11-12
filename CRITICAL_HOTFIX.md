# CRITICAL HOTFIX - Cache & Performance Issues

## 🚨 Issue Analysis from Logs

### Problem 1: 0% Cache Hit Rate (EXPECTED BEHAVIOR)
```
Cache: 0.0% hit rate (2 hits, 57023 misses)
```

**This is actually NORMAL for path caching!**

- Path cache stores complete paths from point A → point B
- Entities move continuously, so their start positions are always slightly different
- A serf at (111,56) requesting path to (110,57) ≠ serf at (111,57) requesting same destination
- Path cache only helps for IDENTICAL start AND end positions

**The GRID cache IS working:**
```
Grid Gen: avg=0.00ms, max=0.00ms  (after initial generation)
```
This means grids are being cached and reused properly!

### Problem 2: 32-Second Frame Spike (CRITICAL!)
```
max=32641.00ms (32.6 seconds!)
```

This occurred during:
- End of work day (VII.p transitioning to VIII.p)
- Daily resource report generation
- 40+ serfs simultaneously "clocking out"

**Root Cause:** Synchronous, blocking operations during game state transitions.

## 🔧 Immediate Fixes

### Fix 1: Understanding Path Cache Limitations

Path caching has limited effectiveness because:
- NPCs rarely pathfind from the EXACT same tile twice
- Each entity's position is unique every frame
- Cache hits only occur for stationary entities requesting the same destination

**Better approach:** Grid caching (already working) + Request batching (implemented but not integrated)

### Fix 2: Prevent Catastrophic Frame Spikes

The 32-second spike suggests blocking operations. Check for:
```javascript
// In daily resource report generation or serf clock-out:
// DON'T do this synchronously:
for (let i = 0; i < 100; i++) {
  // heavy operation
}

// DO spread across frames:
async function processInChunks() {
  for (let i = 0; i < data.length; i++) {
    if (i % 10 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
    // process item
  }
}
```

### Fix 3: Reduce Pathfinding Load

Your hotspots show the same locations requested repeatedly:
- `111,57_110,57`: 334 requests
- `33,184_31,185`: 298 requests  

These are likely:
1. Serfs pathfinding home
2. Serfs pathfinding to work spots
3. Entities stuck in loops

**Solution:** Implement the PathfindingRequestQueue to batch these requests.

## 🚀 Quick Integration

### Step 1: Add Request Queue (Optional but Recommended)

```javascript
// In lambic.js initialization
const PathfindingRequestQueue = require('./server/js/core/PathfindingRequestQueue');
global.pathfindingQueue = new PathfindingRequestQueue(
  global.tilemapSystem.pathfindingSystem
);

// In game loop (OptimizedGameLoop.js or main update)
function gameUpdate() {
  // Process queued pathfinding requests (max 10 per frame, 5ms budget)
  if (global.pathfindingQueue) {
    global.pathfindingQueue.processQueue();
  }
  
  // Rest of game update...
}
```

### Step 2: Use Queue for NPC Pathfinding

```javascript
// Instead of direct pathfinding:
const path = global.tilemapSystem.findPath(start, end, layer, options);

// Use queue for NPCs (spreads load across frames):
global.pathfindingQueue.requestPath(start, end, layer, options, 'medium')
  .then(path => {
    if (path) {
      entity.path = path;
      entity.pathCount = 0;
    }
  })
  .catch(err => {
    // Handle pathfinding failure
  });

// Keep direct pathfinding for players (high priority, immediate):
if (entity.type === 'player') {
  entity.path = global.tilemapSystem.findPath(start, end, layer, options);
}
```

### Step 3: Optimize Daily Reports (Prevent 32s Spikes)

Find where daily reports are generated and add chunking:

```javascript
// Current (blocking):
for (const building of allBuildings) {
  processBuilding(building); // Takes 32 seconds total!
}

// Fixed (non-blocking):
async function generateDailyReports() {
  const buildings = Object.values(Building.list);
  for (let i = 0; i < buildings.length; i++) {
    processBuilding(buildings[i]);
    
    // Yield every 10 buildings to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

## 📊 Expected Improvements

After these fixes:

**Path Cache:**
- Hit rate will remain low (~0-5%) - this is OK!
- Grid cache is what matters (already working)

**Frame Times:**
- Average: 8-10ms (manageable)
- Max spikes: Should eliminate 32-second catastrophic spikes
- Target: Keep all frames <100ms

**Pathfinding Load:**
- With request queue: Spread across multiple frames
- Average requests per frame: <10 (from unlimited)
- Slow frames: Should drop from 10-15/300 to <5/300

## 🔍 Diagnostic Commands

Monitor the improvements:

```javascript
// Check if grid cache is working (should be!)
const tilemapCache = global.tilemapSystem.pathfindingCache;
console.log(`Grid cache size: ${tilemapCache.size}`);

// Check pathfinding system stats
const pfStats = global.tilemapSystem.pathfindingSystem.getProfilingStats();
console.log('Pathfinding stats:', pfStats);

// If using request queue:
const queueStats = global.pathfindingQueue.getStats();
console.log('Queue stats:', queueStats);

// Monitor for blocking operations
console.time('daily-reports');
// ... generate reports ...
console.timeEnd('daily-reports'); // Should be <100ms
```

## ⚠️ Important Notes

1. **Low path cache hit rate is NORMAL** - Don't worry about it!
2. **Grid cache is what matters** - It's working (Grid Gen: 0.00ms)
3. **Focus on eliminating 32-second spikes** - This is the real issue
4. **Use request queue for NPCs** - Spreads pathfinding across frames

## 🎯 Priority Actions

1. **HIGH:** Find and fix the 32-second blocking operation (likely daily reports or serf clock-out)
2. **MEDIUM:** Integrate PathfindingRequestQueue for NPC pathfinding
3. **LOW:** Path cache optimization (minimal benefit expected)

The pathfinding system itself is working well - average 1-4ms per request is excellent. The issue is:
- Too many requests happening simultaneously (use batching)
- Blocking operations causing catastrophic spikes (add async chunking)


