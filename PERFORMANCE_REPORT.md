# Performance Optimization Report
## Lambic Game - Server & Client Performance Analysis

**Date:** Generated from documentation analysis  
**Scope:** Performance bottlenecks identification and optimization recommendations  
**Constraint:** No in-game functionality changes - optimization only

---

## Executive Summary

This report identifies potential performance bottlenecks in both server and client systems based on comprehensive documentation analysis. The analysis reveals several optimization opportunities across entity management, rendering, pathfinding, network synchronization, and game loop efficiency.

**Key Findings:**
- **Server:** Entity update loops, pathfinding operations, and network packet generation are primary bottlenecks
- **Client:** Rendering pipeline, entity culling, and update packet processing need optimization
- **Both:** Memory management, caching strategies, and batch processing can be improved

---

## Server-Side Performance Issues

### 1. Entity Update Loop Inefficiencies

**Issue:** `Player.update()` coordinator iterates through ALL entities in `Player.list` every frame, even with throttling.

**Current Implementation:**
- Updates all entities with different frequencies (60 FPS, 30 FPS, 20 FPS, 15 FPS)
- Frame counter-based throttling using modulo operations
- Each entity type checked individually with multiple conditional branches

**Performance Impact:**
- **O(n) complexity** where n = total entities (players, NPCs, fauna, ships)
- Multiple conditional checks per entity every frame
- Frame counter incrementing and modulo operations for all entities

**Optimization Recommendations:**

1. **Pre-sort Entities by Update Frequency**
   ```javascript
   // Separate entities into frequency buckets at initialization/change
   const updateBuckets = {
     everyFrame: [],      // Players, combat NPCs, falcons
     every2nd: [],       // Idle fauna, idle NPCs
     every3rd: [],       // Working NPCs, ranged units
     every4th: []        // Serfs, trappers
   };
   // Update only relevant bucket per frame
   ```

2. **Use Bit Flags for Update Frequency**
   - Replace modulo operations with bit flags
   - Faster than modulo: `if (frameCounter & updateMask)`

3. **Skip Entity Iteration When Empty**
   - Early exit if entity list is empty
   - Track active entity counts per bucket

4. **Batch Entity State Checks**
   - Pre-compute entity states (inCombat, hasPath, working) into flags
   - Reduce property lookups during update loop

**Expected Improvement:** 30-50% reduction in entity update overhead

---

### 2. Aggro System O(n²) Complexity

**Issue:** `checkAggro()` iterates through ALL entities in `Player.list` for EACH NPC checking aggro.

**Current Implementation:**
```javascript
// For each NPC
for (const id in Player.list) {
  // Check distance, alliance, stealth, etc.
  // This is O(n²) - n NPCs × n entities
}
```

**Performance Impact:**
- **O(n²) complexity** - worst case scenario
- Distance calculations for every entity pair
- Alliance checks, stealth detection, innaWoods checks for each pair

**Optimization Recommendations:**

1. **Spatial Partitioning (Grid/Quadtree)**
   - Divide map into spatial grid cells
   - Only check entities in same/adjacent cells
   - Reduces O(n²) to O(n) for typical scenarios

2. **Aggro Range Pre-filtering**
   - Use spatial index to find entities within aggro range first
   - Then apply expensive checks (alliance, stealth) only to nearby entities

3. **Aggro Cooldown**
   - Add cooldown per NPC (e.g., check aggro every 10-30 frames instead of every frame)
   - Stagger checks across frames to distribute load

4. **Cache Alliance Checks**
   - Cache alliance relationships (house/kingdom based)
   - Invalidate cache only when faction relationships change

**Expected Improvement:** 70-90% reduction in aggro check overhead

---

### 3. Pathfinding System Bottlenecks

**Issue:** Pathfinding operations can be expensive, especially with many concurrent requests.

**Current Implementation:**
- A* algorithm with diagonal movement
- Grid generation for each layer/option combination
- Path smoothing with line-of-sight checks
- Frame throttling (10 concurrent operations, 5 per call)

**Performance Impact:**
- Grid generation: 10-100ms depending on map size
- Pathfinding: 5-50ms depending on distance
- Grid cache: 10 grids max, 50 grids in TilemapSystem
- Path cache: 2000 entries max

**Optimization Recommendations:**

1. **Optimize Grid Cache Strategy**
   - Current: Dual cache system (TilemapSystem + PathfindingSystem)
   - **Consolidate to single cache** to reduce memory and lookup overhead
   - Increase grid cache size if memory allows (currently 10 grids)

2. **Incremental Grid Updates**
   - Instead of regenerating entire grid on tile change
   - Update only affected tiles in cached grid
   - Mark grid as "dirty" and update incrementally

3. **Pathfinding Request Batching**
   - Batch multiple pathfinding requests for same destination
   - Share path results between entities going to same location
   - Use path waypoints for long-distance paths (hierarchical pathfinding)

4. **Optimize Path Smoothing**
   - Cache line-of-sight results for common paths
   - Skip smoothing for very short paths (< 3 waypoints)
   - Use approximate line-of-sight (sampling instead of full traversal)

5. **Pre-compute Common Paths**
   - Pre-calculate paths between common locations (building entrances, spawn points)
   - Use waypoint navigation for long distances

**Expected Improvement:** 40-60% reduction in pathfinding time

---

### 4. Network Packet Generation Overhead

**Issue:** `sendUpdates()` processes all entities every frame with multiple optimization passes.

**Current Implementation:**
- Collects update packs from all entity types
- Spatial filtering (1500px radius check per entity)
- Delta compression (state comparison per entity)
- Update frequency optimization (critical vs non-critical)
- Packet splitting for large packets (20KB limit)

**Performance Impact:**
- Spatial filtering: Distance calculations for each entity to all players
- Delta compression: Deep object comparison using JSON.stringify
- Multiple passes through entity arrays

**Optimization Recommendations:**

1. **Optimize Spatial Filtering**
   - Use spatial grid to find entities near players
   - Pre-filter entities by Z-level before distance checks
   - Cache player positions (only recalculate when players move)

2. **Optimize Delta Compression**
   - Replace JSON.stringify comparison with shallow comparison first
   - Use property-level change tracking instead of full object comparison
   - Implement fast-path for common property changes (position, facing)

3. **Batch Entity Pack Collection**
   - Collect entity updates in single pass instead of multiple loops
   - Use array pre-allocation with known sizes

4. **Reduce Packet Splitting Overhead**
   - Pre-calculate packet sizes during collection
   - Use streaming compression (gzip) instead of splitting
   - Consider binary protocol instead of JSON for update packets

**Expected Improvement:** 20-40% reduction in packet generation time

---

### 5. Entity State Management Overhead

**Issue:** Multiple property lookups and state checks scattered throughout update loops.

**Current Implementation:**
- Properties accessed multiple times per frame
- State checks (inCombat, hasPath, working) repeated
- No centralized state caching

**Optimization Recommendations:**

1. **Entity State Caching**
   - Cache frequently accessed properties (combatState, path, working flags)
   - Invalidate cache only when state actually changes
   - Use flags instead of property lookups

2. **Reduce Property Access**
   - Store frequently used values in local variables
   - Batch property reads at start of update loop

3. **Use WeakMap for Entity Metadata**
   - Store computed state (e.g., "needs update this frame") in WeakMap
   - Avoid adding properties to entity objects

**Expected Improvement:** 10-20% reduction in property access overhead

---

### 6. Social System Update Frequency

**Issue:** Social system updates called conditionally but may still be expensive.

**Current Implementation:**
- Updates called if frame budget allows (20% of frame time)
- No details on what social system update does

**Optimization Recommendations:**

1. **Profile Social System Update**
   - Measure actual time spent in social system update
   - Identify expensive operations within social system

2. **Defer Non-Critical Updates**
   - Only update social system every N frames (e.g., every 10 frames)
   - Batch social events instead of processing immediately

3. **Spatial Culling for Social Events**
   - Only process social events for nearby entities
   - Skip social calculations for entities far from players

**Expected Improvement:** Depends on social system complexity

---

### 7. Combat System Aggro Range Checks

**Issue:** Combat system performs distance calculations for all entity pairs during aggro checks.

**Performance Impact:**
- Similar to aggro system O(n²) issue
- Additional combat-specific checks (stealth detection, innaWoods)

**Optimization Recommendations:**
- Same as aggro system optimization (spatial partitioning)
- Cache combat-related calculations (distance, stealth state)

**Expected Improvement:** 70-90% reduction (combined with aggro optimization)

---

### 8. Memory Management

**Issue:** Potential memory leaks from cached states, entity references, and event listeners.

**Current Implementation:**
- Path cache: 2000 entries with TTL
- Grid cache: 10 grids in PathfindingSystem, 50 in TilemapSystem
- Previous entity states for delta compression
- Event listeners and callbacks

**Optimization Recommendations:**

1. **Explicit Memory Cleanup**
   - Clear caches when entities are removed
   - Remove event listeners when entities are destroyed
   - Use WeakMap/WeakSet for entity references

2. **Periodic Memory Cleanup**
   - Run garbage collection more frequently (if available)
   - Clear expired cache entries more aggressively
   - Limit history arrays (frameTimeHistory, packetSizeHistory)

3. **Memory Pooling**
   - Reuse arrays and objects instead of creating new ones
   - Object pooling for pathfinding vectors and paths (already partially implemented)

**Expected Improvement:** Reduced memory usage, fewer GC pauses

---

## Client-Side Performance Issues

### 1. Rendering Pipeline Overhead

**Issue:** Multiple rendering passes and canvas operations per frame.

**Current Implementation:**
- Three canvas layers (main, lighting, cursor overlay)
- Multiple rendering passes (map, entities, lighting, effects)
- Entity culling per entity type
- Viewport updates every frame

**Performance Impact:**
- Canvas operations are expensive
- Multiple drawImage calls per entity
- Lighting calculations every frame
- Viewport calculations every frame

**Optimization Recommendations:**

1. **Optimize Canvas Operations**
   - Batch drawImage calls where possible
   - Use sprite sheets/atlases to reduce texture switches
   - Minimize canvas state changes (save/restore operations)

2. **Improve Viewport Culling**
   - Cache viewport bounds (already implemented, but verify efficiency)
   - Use spatial index for entity culling (grid/quadtree)
   - Only update viewport when camera actually moves

3. **Reduce Redundant Render Calls**
   - Track which entities actually changed (dirty flags)
   - Skip rendering unchanged entities
   - Use dirty rectangles for partial canvas updates (if possible)

4. **Optimize Lighting Canvas**
   - Only update lighting canvas when lighting actually changes
   - Cache lighting overlay and only redraw changed regions
   - Use offscreen canvas for lighting calculations

**Expected Improvement:** 30-50% reduction in rendering time

---

### 2. Entity Rendering Inefficiencies

**Issue:** Entity rendering iterates through all entities and performs visibility checks for each.

**Current Implementation:**
- Caches entity arrays once per frame
- Visibility checks per entity (Z-level, viewport, innaWoods, building filtering)
- Multiple property lookups per entity (x, y, z, facing, sprite, etc.)

**Performance Impact:**
- O(n) iteration where n = all entities
- Multiple conditional checks per entity
- Property lookups for each entity

**Optimization Recommendations:**

1. **Spatial Index for Entity Culling**
   - Use grid/quadtree to find visible entities quickly
   - Pre-filter entities by Z-level and viewport bounds
   - Reduce visibility checks to only potentially visible entities

2. **Entity Dirty Flags**
   - Track which entities actually changed (position, sprite, state)
   - Skip rendering unchanged entities
   - Only update sprite positions when they actually move

3. **Batch Sprite Updates**
   - Collect all sprite updates in single pass
   - Use transform matrix for sprite positioning instead of individual calculations

4. **Reduce Property Lookups**
   - Cache entity properties in local variables during rendering
   - Use object destructuring for frequently accessed properties

**Expected Improvement:** 40-60% reduction in entity rendering time

---

### 3. Update Packet Processing Overhead

**Issue:** Update packets processed synchronously, potentially blocking render loop.

**Current Implementation:**
- `handleUpdate()` processes all entity updates
- Position updates even when unchanged
- Sprite updates on class/ghost changes
- Non-visual update throttling (500ms interval)

**Performance Impact:**
- Large update packets can cause frame drops
- Processing happens in same thread as rendering
- Multiple property assignments per entity

**Optimization Recommendations:**

1. **Process Updates Asynchronously**
   - Use requestIdleCallback or setTimeout(0) for non-critical updates
   - Prioritize visual updates (position, facing) over non-visual (name, house)

2. **Batch Property Updates**
   - Collect all property updates in single pass
   - Apply updates in single operation to reduce DOM/style recalculations

3. **Optimize Position Updates**
   - Skip position updates if position hasn't changed (already implemented, verify efficiency)
   - Use transform matrix for sprite positioning instead of style updates

4. **Defer Non-Visual Updates**
   - Increase throttling interval for non-visual updates (currently 500ms)
   - Process non-visual updates in separate batch

**Expected Improvement:** 20-30% reduction in update processing time

---

### 4. Animation System Overhead

**Issue:** Animation timers updated every frame with multiple calculations.

**Current Implementation:**
- Multiple animation timers (water, clouds, flicker, fly, walk, working)
- Frame calculations every frame
- Timer updates for all animations regardless of visibility

**Performance Impact:**
- Timer calculations every frame
- Frame index calculations
- Multiple array lookups

**Optimization Recommendations:**

1. **Lazy Animation Updates**
   - Only update animations for visible entities
   - Skip animation updates for off-screen entities

2. **Optimize Timer Calculations**
   - Use integer frame counters instead of floating point timers
   - Pre-calculate animation frame indices
   - Cache animation frame arrays

3. **Batch Animation Updates**
   - Update all animations in single pass
   - Use lookup tables for animation frame indices

**Expected Improvement:** 10-20% reduction in animation overhead

---

### 5. Viewport Calculations

**Issue:** Viewport bounds calculated every frame even when camera doesn't move.

**Current Implementation:**
- Viewport updated every frame
- Zoom-aware calculations
- Tile bounds calculations

**Performance Impact:**
- Viewport calculations every frame
- Multiple calculations per viewport update

**Optimization Recommendations:**

1. **Cache Viewport Bounds**
   - Only recalculate when camera position or zoom changes
   - Track camera position and zoom to detect changes
   - Cache viewport bounds until camera moves

2. **Optimize Viewport Calculations**
   - Pre-calculate constants (tileSize, mapSize divisions)
   - Use integer math where possible
   - Minimize floating point calculations

**Expected Improvement:** 5-10% reduction (viewport already cached, but verify change detection)

---

### 6. Lighting System Calculations

**Issue:** Lighting calculations performed every frame with color interpolations.

**Current Implementation:**
- Day/night cycle lighting calculations
- Weather color calculations
- Color interpolation for transitions
- RGBA parsing and string formatting

**Performance Impact:**
- Color calculations every frame
- String operations for RGBA colors
- Interpolation calculations

**Optimization Recommendations:**

1. **Cache Lighting Colors**
   - Pre-calculate lighting colors for each tempus/hour
   - Only recalculate when tempus or weather changes
   - Cache interpolated colors during transitions

2. **Optimize Color Operations**
   - Use integer RGBA values instead of strings
   - Pre-calculate color lookup tables
   - Minimize string operations

3. **Reduce Lighting Updates**
   - Only update lighting canvas when lighting actually changes
   - Use dirty flags to track lighting changes
   - Cache lighting overlay until lighting changes

**Expected Improvement:** 20-30% reduction in lighting calculations

---

### 7. Audio System Polling

**Issue:** AudioManager polls player state every second, potentially causing frame drops.

**Current Implementation:**
- Updates every 1000ms via setInterval
- Context change detection
- Audio selection logic

**Performance Impact:**
- Audio updates may coincide with other operations
- Context checking involves multiple property lookups

**Optimization Recommendations:**

1. **Optimize Context Checking**
   - Cache context values and only check changed properties
   - Use bit flags for context state
   - Minimize property lookups

2. **Schedule Audio Updates**
   - Use requestIdleCallback for audio updates
   - Defer audio updates to avoid frame drops

**Expected Improvement:** Minimal (audio updates are already infrequent)

---

## Shared Performance Issues

### 1. Memory Allocations

**Issue:** Frequent object and array allocations during game loop.

**Performance Impact:**
- Garbage collection pauses
- Memory fragmentation
- Increased memory usage

**Optimization Recommendations:**

1. **Object Pooling**
   - Reuse arrays and objects instead of creating new ones
   - Pool frequently allocated objects (vectors, paths, update packs)
   - Pre-allocate arrays with known sizes

2. **Reduce Temporary Allocations**
   - Avoid creating temporary objects in hot paths
   - Use object reuse for frequently created objects
   - Minimize array operations (push, pop, splice)

**Expected Improvement:** Reduced GC pauses, lower memory usage

---

### 2. Property Access Patterns

**Issue:** Deep property lookups and repeated property access.

**Performance Impact:**
- Property lookups are relatively expensive
- Repeated lookups for same properties

**Optimization Recommendations:**

1. **Cache Property Values**
   - Store frequently accessed properties in local variables
   - Use object destructuring for multiple properties
   - Minimize deep property access chains

2. **Use Direct References**
   - Store direct references instead of looking up by ID
   - Cache entity references in update loops

**Expected Improvement:** 5-15% reduction in property access overhead

---

## Optimization Implementation Plan

### Phase 1: High-Impact, Low-Risk Optimizations

1. **Entity Update Bucket System**
   - Pre-sort entities by update frequency
   - Update only relevant buckets per frame
   - **Estimated Effort:** 2-3 days
   - **Expected Impact:** 30-50% reduction in entity update overhead

2. **Spatial Partitioning for Aggro System**
   - Implement grid-based spatial index
   - Filter entities by spatial proximity before distance checks
   - **Estimated Effort:** 3-5 days
   - **Expected Impact:** 70-90% reduction in aggro check overhead

3. **Optimize Delta Compression**
   - Replace JSON.stringify with shallow comparison
   - Implement property-level change tracking
   - **Estimated Effort:** 2-3 days
   - **Expected Impact:** 20-30% reduction in packet generation time

4. **Improve Entity Rendering Culling**
   - Use spatial index for entity visibility
   - Implement dirty flags for entity rendering
   - **Estimated Effort:** 3-4 days
   - **Expected Impact:** 40-60% reduction in entity rendering time

### Phase 2: Medium-Impact Optimizations

5. **Pathfinding Grid Cache Optimization**
   - Consolidate dual cache system
   - Implement incremental grid updates
   - **Estimated Effort:** 3-4 days
   - **Expected Impact:** 40-60% reduction in pathfinding time

6. **Viewport Caching Improvements**
   - Only recalculate when camera moves
   - Optimize viewport calculations
   - **Estimated Effort:** 1-2 days
   - **Expected Impact:** 5-10% reduction

7. **Lighting System Caching**
   - Cache lighting colors per tempus
   - Only update when lighting changes
   - **Estimated Effort:** 2-3 days
   - **Expected Impact:** 20-30% reduction

8. **Memory Management Improvements**
   - Implement object pooling
   - Reduce temporary allocations
   - **Estimated Effort:** 2-3 days
   - **Expected Impact:** Reduced GC pauses

### Phase 3: Advanced Optimizations

9. **Hierarchical Pathfinding**
   - Pre-compute waypoints for long distances
   - Use waypoint navigation
   - **Estimated Effort:** 5-7 days
   - **Expected Impact:** 50-70% reduction for long-distance paths

10. **Batch Network Packet Processing**
    - Batch entity pack collection
    - Stream compression for large packets
    - **Estimated Effort:** 3-4 days
    - **Expected Impact:** 20-40% reduction

11. **Async Update Processing**
    - Process non-critical updates asynchronously
    - Defer non-visual updates
    - **Estimated Effort:** 2-3 days
    - **Expected Impact:** Smoother frame times

---

## Performance Metrics to Track

### Server Metrics

1. **Frame Time**
   - Average frame time (target: <16.67ms for 60 FPS)
   - Max frame time (target: <33ms)
   - Frame time spikes

2. **Entity Update Times**
   - Time per entity type (Player, NPC, fauna)
   - Total entity update time
   - Entities updated per frame

3. **Pathfinding Performance**
   - Average pathfinding time
   - Cache hit rate (target: >70%)
   - Grid generation time
   - Requests per second

4. **Network Performance**
   - Packet generation time
   - Average packet size
   - Bytes sent per second
   - Packet splitting frequency

5. **Memory Usage**
   - Heap size
   - RSS (Resident Set Size)
   - GC frequency and duration

### Client Metrics

1. **Rendering Performance**
   - Frame render time (target: <16.67ms)
   - Entities rendered per frame
   - Canvas operations per frame

2. **Update Processing**
   - Update packet processing time
   - Entities updated per packet
   - Property updates per frame

3. **Memory Usage**
   - Heap size
   - Canvas memory usage
   - Texture memory usage

4. **Animation Performance**
   - Animation update time
   - Active animations count

---

## Risk Assessment

### Low Risk Optimizations
- Entity update bucket system
- Property access caching
- Viewport caching improvements
- Lighting system caching

### Medium Risk Optimizations
- Spatial partitioning (requires careful testing)
- Delta compression optimization (must maintain correctness)
- Pathfinding cache consolidation

### Higher Risk Optimizations
- Hierarchical pathfinding (complex implementation)
- Async update processing (timing issues)
- Batch network packet processing (packet ordering)

---

## Conclusion

The analysis reveals significant optimization opportunities across both server and client systems. The highest impact optimizations are:

1. **Spatial partitioning for aggro/combat systems** (70-90% improvement)
2. **Entity update bucket system** (30-50% improvement)
3. **Entity rendering culling improvements** (40-60% improvement)
4. **Pathfinding optimizations** (40-60% improvement)

Implementing Phase 1 optimizations alone should provide substantial performance improvements with relatively low risk. The optimization plan prioritizes high-impact changes that don't affect game functionality, focusing purely on performance improvements.

---

## Appendix: Performance Profiling Recommendations

### Tools to Use

1. **Server-side:**
   - Node.js built-in profiler (`--prof`)
   - Clinic.js for performance analysis
   - `process.memoryUsage()` tracking
   - Custom performance timers (already implemented)

2. **Client-side:**
   - Chrome DevTools Performance tab
   - Performance API (`performance.now()`)
   - Memory profiler
   - Frame rate monitoring

### Profiling Strategy

1. **Baseline Measurements**
   - Measure current performance with realistic entity counts
   - Identify actual bottlenecks (not assumed)
   - Track metrics over extended play sessions

2. **Incremental Profiling**
   - Profile after each optimization
   - Verify improvements match expectations
   - Ensure no regressions

3. **Stress Testing**
   - Test with maximum entity counts
   - Test with many concurrent pathfinding requests
   - Test with large update packets

---

*Report generated from comprehensive documentation analysis*  
*Last updated: Based on current documentation*


