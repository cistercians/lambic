// Migration utility to convert existing world array to new TilemapSystem

const { TilemapSystem } = require('./TilemapSystem.js');

class TilemapMigration {
  constructor() {
    this.migrationComplete = false;
  }

  // Migrate from old world array to new TilemapSystem
  migrateFromWorldArray(worldArray, mapSize) {
    console.log('Starting tilemap migration...');
    const startTime = Date.now();
    
    const tilemapSystem = new TilemapSystem(mapSize);
    
    // Migrate all layers
    for (let layer = 0; layer < worldArray.length; layer++) {
      console.log(`Migrating layer ${layer}...`);
      
      if (worldArray[layer]) {
        for (let y = 0; y < mapSize; y++) {
          if (worldArray[layer][y]) {
            for (let x = 0; x < mapSize; x++) {
              const tileValue = worldArray[layer][y][x];
              if (tileValue !== undefined && tileValue !== 0) {
                tilemapSystem.setTile(layer, x, y, tileValue);
              }
            }
          }
        }
      }
    }
    
    // Migrate spawn points and biomes
    this.migrateSpawnPoints(tilemapSystem, worldArray, mapSize);
    
    const endTime = Date.now();
    console.log(`Migration completed in ${endTime - startTime}ms`);
    console.log(`Memory usage:`, tilemapSystem.getMemoryUsage());
    
    this.migrationComplete = true;
    return tilemapSystem;
  }

  // Migrate spawn points and biome data
  migrateSpawnPoints(tilemapSystem, worldArray, mapSize) {
    console.log('Migrating spawn points...');
    
    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        const tile = worldArray[0] && worldArray[0][y] ? worldArray[0][y][x] : 0;
        const uTile = worldArray[1] && worldArray[1][y] ? worldArray[1][y][x] : 0;
        
        // Overworld spawn points
        if (tile !== 0) { // Not water
          tilemapSystem.addSpawnPoint('overworld', x, y);
          
          // Biome-specific spawn points
          if (tile >= 1 && tile < 2) { // Heavy forest
            tilemapSystem.addSpawnPoint('heavyForest', x, y);
          } else if (tile >= 5 && tile < 6) { // Mountain
            tilemapSystem.addSpawnPoint('mountains', x, y);
          } else if (tile === 6) { // Cave entrance
            tilemapSystem.addSpawnPoint('caveEntrances', x, y);
          }
        } else {
          // Water spawn points
          tilemapSystem.addSpawnPoint('water', x, y);
        }
        
        // Underworld spawn points
        if (uTile === 0) {
          tilemapSystem.addSpawnPoint('underworld', x, y);
        }
      }
    }
    
    console.log('Spawn points migrated:', {
      overworld: tilemapSystem.getSpawnPoints('overworld').length,
      underworld: tilemapSystem.getSpawnPoints('underworld').length,
      water: tilemapSystem.getSpawnPoints('water').length,
      heavyForest: tilemapSystem.getSpawnPoints('heavyForest').length,
      mountains: tilemapSystem.getSpawnPoints('mountains').length,
      caveEntrances: tilemapSystem.getSpawnPoints('caveEntrances').length
    });
  }

  // Create backward compatibility functions
  createCompatibilityLayer(tilemapSystem) {
    return {
      // Replace world[layer][row][col] access
      getTile: (layer, x, y) => tilemapSystem.getTile(layer, x, y),
      setTile: (layer, x, y, value) => tilemapSystem.setTile(layer, x, y, value),
      updateTile: (layer, x, y, value, increment) => tilemapSystem.updateTile(layer, x, y, value, increment),
      
      // Replace pathfinding grid generation
      generatePathfindingGrid: (layer, options) => tilemapSystem.generatePathfindingGrid(layer, options),
      
      // Replace spawn point access
      getSpawnPoints: (biome) => tilemapSystem.getSpawnPoints(biome),
      
      // Replace zone access
      getEntitiesInZone: (zoneX, zoneY) => tilemapSystem.getEntitiesInZone(zoneX, zoneY),
      
      // Memory and performance monitoring
      getMemoryUsage: () => tilemapSystem.getMemoryUsage(),
      invalidateCache: (layer) => tilemapSystem.invalidatePathfindingCache(layer)
    };
  }

  // Performance comparison
  comparePerformance(oldWorld, newTilemapSystem, iterations = 1000) {
    console.log('Running performance comparison...');
    
    const testCoords = [];
    for (let i = 0; i < iterations; i++) {
      testCoords.push({
        layer: Math.floor(Math.random() * 9),
        x: Math.floor(Math.random() * 512),
        y: Math.floor(Math.random() * 512)
      });
    }
    
    // Test old system
    const oldStart = Date.now();
    for (const coord of testCoords) {
      if (oldWorld[coord.layer] && oldWorld[coord.layer][coord.y]) {
        const value = oldWorld[coord.layer][coord.y][coord.x] || 0;
      }
    }
    const oldTime = Date.now() - oldStart;
    
    // Test new system
    const newStart = Date.now();
    for (const coord of testCoords) {
      const value = newTilemapSystem.getTile(coord.layer, coord.x, coord.y);
    }
    const newTime = Date.now() - newStart;
    
    console.log(`Performance comparison (${iterations} operations):`);
    console.log(`Old system: ${oldTime}ms`);
    console.log(`New system: ${newTime}ms`);
    console.log(`Improvement: ${((oldTime - newTime) / oldTime * 100).toFixed(1)}%`);
    
    return {
      oldTime,
      newTime,
      improvement: (oldTime - newTime) / oldTime * 100
    };
  }
}

module.exports = { TilemapMigration };

