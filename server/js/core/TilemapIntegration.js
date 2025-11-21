// Integration example showing how to use the new consolidated tilemap system

const { TilemapSystem } = require('./TilemapSystem.js');
const { TilemapMigration } = require('./TilemapMigration.js');
const { PathfindingSystem } = require('./PathfindingSystem.js');

class TilemapIntegration {
  constructor() {
    this.tilemapSystem = null;
    this.pathfindingSystem = null;
    this.migration = new TilemapMigration();
    this.initialized = false;
  }

  // Initialize the new system from existing world array
  initializeFromWorldArray(worldArray, mapSize) {
    
    // Migrate from old system
    this.tilemapSystem = this.migration.migrateFromWorldArray(worldArray, mapSize);
    
    // Initialize pathfinding system
    this.pathfindingSystem = new PathfindingSystem(this.tilemapSystem);
    
    // Create compatibility layer
    this.compatibility = this.migration.createCompatibilityLayer(this.tilemapSystem);
    
    this.initialized = true;
    
    return this;
  }

  // Replace old world array functions
  getTile(layer, x, y) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.getTile(layer, x, y);
  }

  setTile(layer, x, y, value) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    this.tilemapSystem.setTile(layer, x, y, value);
  }

  updateTile(layer, x, y, value, increment = false) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.updateTile(layer, x, y, value, increment);
  }

  // Enhanced pathfinding with doorway awareness
  findPath(start, end, layer, options = {}) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.pathfindingSystem.findPath(start, end, layer, options);
  }

  // Get spawn points
  getSpawnPoints(biome) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.getSpawnPoints(biome);
  }

  // Get entities in zone
  getEntitiesInZone(zoneX, zoneY) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.getEntitiesInZone(zoneX, zoneY);
  }

  // Performance monitoring
  getPerformanceStats() {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    
    return {
      memory: this.tilemapSystem.getMemoryUsage(),
      pathfinding: this.pathfindingSystem.getCacheStats(),
      migration: this.migration.migrationComplete
    };
  }

  // Example usage for entity pathfinding
  findPathForEntity(entity, targetX, targetY, targetZ) {
    const start = [Math.floor(entity.x / 64), Math.floor(entity.y / 64)];
    const end = [targetX, targetY];
    
    // Determine pathfinding options based on target
    const options = {};
    
    // If target is a doorway, allow pathfinding to it
    if (this.tilemapSystem.isDoorway(targetZ, targetX, targetY, 
        this.tilemapSystem.getTile(targetZ, targetX, targetY))) {
      options.allowSpecificDoor = true;
      options.targetDoor = [targetX, targetY];
    } else {
      // Otherwise, avoid all doorways
      options.avoidDoors = true;
    }
    
    return this.findPath(start, end, entity.z, options);
  }

  // Example usage for building construction
  findWorkSpot(building, workType) {
    const buildingCenter = [building.x, building.y];
    const workSpots = building.workSpots || [];
    
    for (const spot of workSpots) {
      const path = this.findPath(buildingCenter, spot, building.z, {
        avoidDoors: true
      });
      
      if (path && path.length > 0) {
        return { spot, path };
      }
    }
    
    return null;
  }

  // Example usage for resource gathering
  findNearestResource(entity, resourceType) {
    const entityPos = [Math.floor(entity.x / 64), Math.floor(entity.y / 64)];
    let nearestResource = null;
    let nearestDistance = Infinity;
    
    // Search in nearby zones for efficiency
    const searchRadius = 10;
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const x = entityPos[0] + dx;
        const y = entityPos[1] + dy;
        
        if (x >= 0 && x < this.tilemapSystem.mapSize && 
            y >= 0 && y < this.tilemapSystem.mapSize) {
          
          const resourceTile = this.tilemapSystem.getTile(6, x, y); // Resource layer
          
          if (this.isResourceType(resourceTile, resourceType)) {
            const distance = Math.abs(dx) + Math.abs(dy);
            if (distance < nearestDistance) {
              nearestResource = { x, y, resourceTile };
              nearestDistance = distance;
            }
          }
        }
      }
    }
    
    return nearestResource;
  }

  // Helper function to check resource type
  isResourceType(tile, resourceType) {
    // This would be implemented based on your resource system
    switch (resourceType) {
      case 'wood':
        return tile >= 50 && tile < 100;
      case 'stone':
        return tile >= 100 && tile < 150;
      default:
        return false;
    }
  }

  // Export system state for persistence
  exportState() {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    
    return {
      tilemap: this.tilemapSystem.exportData(),
      timestamp: Date.now()
    };
  }

  // Import system state from persistence
  importState(state) {
    if (!this.tilemapSystem) {
      this.tilemapSystem = new TilemapSystem(state.tilemap.mapSize);
    }
    
    this.tilemapSystem.importData(state.tilemap);
    this.pathfindingSystem = new PathfindingSystem(this.tilemapSystem);
    this.initialized = true;
  }

  // Building placement proxy methods
  findBuildingSpot(buildingType, centerTile, searchRadius, customRequirements = {}) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.findBuildingSpot(buildingType, centerTile, searchRadius, customRequirements);
  }

  findMultipleBuildingSpots(buildingType, centerTile, searchRadius, count, customRequirements = {}) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.findMultipleBuildingSpots(buildingType, centerTile, searchRadius, count, customRequirements);
  }

  // Faction HQ placement proxy method
  findFactionHQ(factionName, excludedLocations = []) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.findFactionHQ(factionName, excludedLocations);
  }

  // Resource assessment proxy methods (for faction initialization)
  assessBaseResources(hq, radius, z = 0) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.assessBaseResources(hq, radius, z);
  }

  countNearbyTerrain(tile, terrainTypes, radius, z = 0) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.countNearbyTerrain(tile, terrainTypes, radius, z);
  }

  getDistanceToNearestBuilding(tile, buildingType) {
    if (!this.initialized) {
      throw new Error('Tilemap system not initialized');
    }
    return this.tilemapSystem.getDistanceToNearestBuilding(tile, buildingType);
  }
}

module.exports = { TilemapIntegration };

