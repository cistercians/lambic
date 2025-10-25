// Faction Knowledge Database
// Tracks what each faction knows about the world (fog of war for AI)

class FactionKnowledge {
  constructor(house) {
    this.house = house;
    this.exploredTiles = new Set(); // Tiles we've seen (stored as "x,y" strings)
    this.knownResources = new Map(); // Resource locations we've discovered
    this.knownEnemies = new Map(); // Enemy units/bases we've seen
    this.lastUpdated = new Map(); // When we last saw each location
  }
  
  // Scout reports new information
  reportDiscovery(scout, discovery) {
    const now = Date.now();
    
    if (discovery.type === 'RESOURCE') {
      const key = `${discovery.location[0]},${discovery.location[1]}`;
      this.knownResources.set(key, {
        ...discovery,
        discoveredBy: scout.id,
        discoveredAt: now
      });
      console.log(`${this.house.name}: Scout discovered ${discovery.resourceType} at [${discovery.location}]`);
    } else if (discovery.type === 'ENEMY') {
      const key = `${discovery.location[0]},${discovery.location[1]}`;
      this.knownEnemies.set(key, {
        ...discovery,
        discoveredBy: scout.id,
        discoveredAt: now
      });
      console.log(`${this.house.name}: Scout discovered enemy at [${discovery.location}] (threat: ${discovery.threatLevel})`);
    }
    
    // Mark tiles as explored
    if (discovery.tiles) {
      discovery.tiles.forEach(tile => {
        const tileKey = `${tile[0]},${tile[1]}`;
        this.exploredTiles.add(tileKey);
        this.lastUpdated.set(tileKey, now);
      });
    }
  }
  
  // Get best known location for a resource type
  getBestResourceLocation(resourceType) {
    const locations = Array.from(this.knownResources.values())
      .filter(r => r.resourceType === resourceType)
      .sort((a, b) => (b.density || 0) - (a.density || 0));
    
    return locations.length > 0 ? locations[0].location : null;
  }
  
  // Get all known locations of a resource type
  getAllResourceLocations(resourceType) {
    return Array.from(this.knownResources.values())
      .filter(r => r.resourceType === resourceType)
      .map(r => r.location);
  }
  
  // Check if a tile has been explored
  hasExplored(tile) {
    const key = `${tile[0]},${tile[1]}`;
    return this.exploredTiles.has(key);
  }
  
  // Get known enemies in an area
  getEnemiesInArea(center, radius) {
    const enemies = [];
    
    for (const [key, enemy] of this.knownEnemies.entries()) {
      const dist = this.getDistance(center, enemy.location);
      if (dist <= radius) {
        enemies.push(enemy);
      }
    }
    
    return enemies;
  }
  
  // Get closest known enemy
  getClosestEnemy(location) {
    let closest = null;
    let minDist = Infinity;
    
    for (const [key, enemy] of this.knownEnemies.entries()) {
      const dist = this.getDistance(location, enemy.location);
      if (dist < minDist) {
        minDist = dist;
        closest = enemy;
      }
    }
    
    return closest;
  }
  
  // Clean up old/stale information
  cleanStaleInformation(maxAge = 300000) { // 5 minutes default
    const now = Date.now();
    
    // Remove old enemy sightings (they may have moved)
    for (const [key, enemy] of this.knownEnemies.entries()) {
      if (now - enemy.discoveredAt > maxAge) {
        this.knownEnemies.delete(key);
      }
    }
  }
  
  // Get exploration progress (0-1)
  getExplorationProgress() {
    const mapSize = global.mapSize || 100;
    const totalTiles = mapSize * mapSize;
    return this.exploredTiles.size / totalTiles;
  }
  
  // Check if faction has a resource gap (needs resource but doesn't have it in territory)
  identifyResourceGap(resourceType) {
    // Check if house needs this resource
    const needed = this.house.stores[resourceType] || 0;
    const required = this.getRequiredAmount(resourceType);
    
    if (needed >= required) return false; // Have enough
    
    // Check if resource exists in faction territory
    if (global.zoneManager && this.house.territory) {
      const hqZone = this.getHQZone();
      if (hqZone) {
        const territoryZones = global.zoneManager.getAdjacentZones(hqZone.id, this.house.territory.coreBase.radius);
        
        // Check if any territory zone has this resource
        for (const zone of territoryZones) {
          if (global.zoneManager.isZoneInTerritory(zone, this.house)) {
            const resources = global.zoneManager.getZoneResourceTypes(zone);
            if (this.hasResourceType(resources, resourceType)) {
              return false; // Resource available in territory
            }
          }
        }
      }
    }
    
    return true; // Resource gap exists
  }

  // Find zones with specific resource from adjacent zones
  findZonesWithResource(resourceType, adjacentZones) {
    const suitableZones = [];
    
    for (const zone of adjacentZones) {
      const resources = global.zoneManager.getZoneResourceTypes(zone);
      
      if (this.hasResourceType(resources, resourceType)) {
        const density = this.calculateResourceDensity(resources, resourceType);
        suitableZones.push({
          zone,
          density,
          resources
        });
      }
    }
    
    // Sort by density (highest first)
    return suitableZones.sort((a, b) => b.density - a.density);
  }

  // Helper: Check if resources object has the required resource type
  hasResourceType(resources, resourceType) {
    switch (resourceType) {
      case 'stone':
        return resources.rocks > 10; // Need significant rock presence
      case 'wood':
        return resources.forest > 10; // Need significant forest presence
      case 'grain':
        return resources.farmland > 15; // Need significant farmland
      case 'iron':
        return resources.caves > 0; // Need cave entrances
      default:
        return false;
    }
  }

  // Helper: Calculate resource density for prioritization
  calculateResourceDensity(resources, resourceType) {
    switch (resourceType) {
      case 'stone':
        return resources.rocks + (resources.caves * 5); // Caves are valuable for stone
      case 'wood':
        return resources.forest;
      case 'grain':
        return resources.farmland;
      case 'iron':
        return resources.caves * 20; // Caves are very valuable for iron
      default:
        return 0;
    }
  }

  // Helper: Get required amount of resource for current goals
  getRequiredAmount(resourceType) {
    // This would ideally check current goals, but for now use simple thresholds
    const thresholds = {
      stone: 50,
      wood: 100,
      grain: 30,
      iron: 20
    };
    return thresholds[resourceType] || 0;
  }

  // Helper: Get HQ zone
  getHQZone() {
    if (!global.zoneManager || !this.house.hq) return null;
    
    const hqTile = this.house.hq;
    const zonesAtHQ = global.zoneManager.getZonesAt(hqTile);
    
    // Find the faction territory zone
    for (const zoneId of zonesAtHQ) {
      const zone = global.zoneManager.zones.get(zoneId);
      if (zone && zone.type === 'faction_territory' && zone.faction === this.house.id) {
        return zone;
      }
    }
    
    return null;
  }

  // Get statistics
  getStats() {
    return {
      exploredTiles: this.exploredTiles.size,
      knownResources: this.knownResources.size,
      knownEnemies: this.knownEnemies.size,
      explorationProgress: (this.getExplorationProgress() * 100).toFixed(1) + '%'
    };
  }
  
  // Helper: calculate distance
  getDistance(point1, point2) {
    if (global.getDistance) {
      return global.getDistance(
        {x: point1[0], y: point1[1]},
        {x: point2[0], y: point2[1]}
      );
    }
    
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
}

module.exports = FactionKnowledge;

