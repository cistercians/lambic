# Spatial System Migration Plan

## Overview
Replace the current zone-based spatial partitioning with an intelligent spatial indexing system that provides better performance and eliminates edge-case issues.

## Problems with Current Zone System
1. **Edge Issues**: Entities near zone boundaries miss interactions
2. **Fixed Grid**: 8x8 tile zones don't adapt to entity density
3. **Redundant Checks**: Still need distance calculations within zones
4. **Memory Overhead**: Maintaining zone membership for every entity
5. **Poor Cache Locality**: Entities scattered across many zones

## New Spatial Index System Benefits
1. **Adaptive Cell Size**: Automatically optimizes based on entity density
2. **Overlapping Cells**: Entities can exist in multiple cells based on their radius
3. **Intelligent Caching**: Query results cached with TTL
4. **Range-Based Queries**: Direct radius-based searches instead of zone iteration
5. **Better Performance**: O(1) cell lookup, reduced redundant distance calculations

## Migration Steps

### Phase 1: Integration Setup
- [x] Create `SpatialIndex.js` - Core spatial partitioning logic
- [x] Create `SpatialIntegration.js` - Integration layer
- [ ] Initialize spatial system in `lambic.js`
- [ ] Add entity tracking to player creation/removal

### Phase 2: Replace Zone-Based Queries
- [ ] Update `CombatSystem.js` to use spatial queries
- [ ] Update `Entity.js` aggro checks to use spatial system
- [ ] Update work assignment logic to use spatial queries
- [ ] Update social interaction logic (taverns, trading)

### Phase 3: Performance Optimization
- [ ] Add batch update system for entity movements
- [ ] Implement periodic cleanup of dead entities
- [ ] Add performance monitoring and optimization
- [ ] Remove old zone system code

### Phase 4: Testing & Validation
- [ ] Verify all interactions work correctly
- [ ] Performance testing with large entity counts
- [ ] Memory usage validation
- [ ] Edge case testing

## API Changes

### Old Zone System
```javascript
// Old way - zone iteration
for (const n in zones[zr][zc]) {
  const target = Player.list[zones[zr][zc][n]];
  // Check distance, aggro, etc.
}
```

### New Spatial System
```javascript
// New way - direct spatial queries
const targets = global.spatialSystem.findAggroTargets(entity, aggroRange);
for (const target of targets) {
  // Process target
}
```

## Performance Expectations
- **Memory**: 20-30% reduction in spatial overhead
- **CPU**: 40-60% reduction in entity iteration time
- **Accuracy**: 100% accurate interactions (no edge cases)
- **Scalability**: Better performance with high entity counts

## Configuration Options
- `cellSize`: Base cell size (default: 64 pixels)
- `cacheTimeout`: Query cache TTL (default: 1000ms)
- `optimizationInterval`: Auto-optimization frequency (default: 30s)
- `maxCacheSize`: Maximum cached queries (default: 1000)

## Backward Compatibility
The new system maintains the same external API, so existing game logic doesn't need to change. The spatial system is a drop-in replacement for zone-based queries.

