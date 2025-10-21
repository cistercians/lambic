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

