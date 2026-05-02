// Faction Knowledge Database
// Tracks what each faction knows about the world (fog of war for AI)

const { RESOURCE_THRESHOLDS } = require('./AIConstants');

class FactionKnowledge {
  constructor(house) {
    this.house = house;
    this.exploredTiles = new Set(); // Tiles we've seen (stored as "x,y" strings)
    this.knownResources = new Map(); // Resource locations we've discovered
    this.knownEnemies = new Map(); // Enemy units/bases we've seen
    this.conflictZones = new Map(); // Conflict zones where scouting parties were attacked (stored as "x,y" -> conflict info)
    this.lastUpdated = new Map(); // When we last saw each location
    this.knownZones = new Set(); // Zone IDs that intersect HQ/base radius (don't require scouting)
    this.zoneResourceInfo = new Map(); // Zone ID -> resource information from getZoneResourceTypes()
    this.scoutedZones = new Map(); // Durable scout discoveries: zone ID -> { zone, resources, scoutedAt, scoutedDay }
    this.clearedZones = new Set(); // Zone IDs successfully cleared by scouting parties
    
    // Perform initial territory scan on construction
    this.performInitialTerritoryScan();
    
    // Scan for known zones (zones intersecting HQ/base radius)
    this.scanKnownZones();
  }
  
  // Scan immediate area around HQ for initial knowledge
  performInitialTerritoryScan() {
    const scanRadius = 15;
    const hq = this.house.hq;
    if (!hq) return;
    
    const area = global.getArea ? global.getArea(hq, hq, scanRadius) : [];
    
    let forestCount = 0;
    let rockCount = 0;
    let caveCount = 0;
    let farmlandCount = 0;
    
    const caveLocations = [];
    const forestClusters = [];
    const rockClusters = [];
    
    for (const tile of area) {
      const terrain = global.getTile ? global.getTile(0, tile[0], tile[1]) : 0;
      
      if (terrain === 1 || terrain === 2) { // HEAVY_FOREST or LIGHT_FOREST
        forestCount++;
        if (forestCount % 5 === 0) forestClusters.push(tile);
      }
      // Only count large rocks (resource-carrying), not visual rocks
      if (global.isLargeRock && global.isLargeRock(terrain)) {
        rockCount++;
        if (rockCount % 5 === 0) rockClusters.push(tile);
      }
      if (terrain === 6) { // CAVE_ENTRANCE
        caveCount++;
        caveLocations.push(tile);
      }
      if (terrain === 7 || terrain === 3) { // EMPTY or BRUSH
        farmlandCount++;
      }
      
      // Mark as explored
      const tileKey = `${tile[0]},${tile[1]}`;
      this.exploredTiles.add(tileKey);
    }
    
    // Register significant resource locations
    if (caveLocations.length > 0) {
      caveLocations.forEach(cave => {
        this.knownResources.set(`cave:${cave[0]},${cave[1]}`, {
          type: 'RESOURCE',
          location: cave,
          resourceType: 'cave',
          density: 20,
          discoveredAt: Date.now()
        });
      });
    }
    
    if (forestClusters.length > 0) {
      const bestForest = forestClusters[0];
      this.knownResources.set(`forest:${bestForest[0]},${bestForest[1]}`, {
        type: 'RESOURCE',
        location: bestForest,
        resourceType: 'forest',
        density: forestCount,
        discoveredAt: Date.now()
      });
    }
    
    if (rockClusters.length > 0) {
      const bestRocks = rockClusters[0];
      this.knownResources.set(`rocks:${bestRocks[0]},${bestRocks[1]}`, {
        type: 'RESOURCE',
        location: bestRocks,
        resourceType: 'rocks',
        density: rockCount,
        discoveredAt: Date.now()
      });
    }
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
    } else if (discovery.type === 'ENEMY') {
      const key = `${discovery.location[0]},${discovery.location[1]}`;
      this.knownEnemies.set(key, {
        ...discovery,
        discoveredBy: scout.id,
        discoveredAt: now
      });
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
    
    // First check known zones (zones intersecting HQ radius) - these don't require scouting
    const knownZonesWithResource = this.getKnownZoneResources(resourceType);
    if (knownZonesWithResource.length > 0) {
      return false; // Resource available in known zones (no gap, can access without scouting)
    }
    
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
    // This would ideally check current goals, but for now use simple thresholds from constants
    const thresholds = {
      stone: RESOURCE_THRESHOLDS.STONE_SCARCE,
      wood: RESOURCE_THRESHOLDS.WOOD_NEEDED * 2, // Wood needed * 2 for threshold
      grain: RESOURCE_THRESHOLDS.GRAIN_NEEDED - 20, // Slightly less than grain needed
      iron: 20 // Iron threshold not in constants, keeping original value
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
  
  // Report a conflict zone (where scouting party was attacked by enemy faction)
  reportConflictZone(location, enemyHouseId, enemyHouseName) {
    const locationKey = `${location[0]},${location[1]}`;
    this.conflictZones.set(locationKey, {
      location: location,
      enemyHouseId: enemyHouseId,
      enemyHouseName: enemyHouseName || 'Unknown',
      reportedAt: Date.now(),
      reportedDay: global.day || 1
    });
  }
  
  // Get all conflict zones
  getConflictZones() {
    return Array.from(this.conflictZones.values());
  }
  
  // Check if a location is a known conflict zone
  isConflictZone(location) {
    const locationKey = `${location[0]},${location[1]}`;
    return this.conflictZones.has(locationKey);
  }
  
  // Scan for zones that intersect HQ/base radius and mark them as known
  scanKnownZones() {
    if (!global.zoneManager) return;
    
    const hq = this.house.hq;
    if (!hq || !Array.isArray(hq) || hq.length < 2) return;
    
    // Get base radius (minimum 10 tiles)
    let baseRadius = 10; // Default radius in tiles
    if (this.house.ai && this.house.ai.territory) {
      this.house.ai.territory.updateTerritory();
      const coreBase = this.house.ai.territory.coreBase;
      if (coreBase && coreBase.radius) {
        baseRadius = Math.max(10, coreBase.radius); // Ensure minimum 10 tiles
      }
    } else if (this.house.baseRadius) {
      // baseRadius is in pixels, convert to tiles (assuming tileSize = 64)
      const tileSize = global.tileSize || 64;
      baseRadius = Math.max(10, Math.ceil(this.house.baseRadius / tileSize)); // Ensure minimum 10 tiles
    }
    
    const hqTileX = hq[0];
    const hqTileY = hq[1];
    
    // Sample tiles within radius (every 2 tiles for performance, or all tiles for small radius)
    const sampleInterval = baseRadius > 20 ? 2 : 1; // Sample every 2 tiles if radius > 20, otherwise every tile
    
    const zoneSet = new Set(); // Track unique zone IDs
    
    // Iterate through tiles in a square grid around HQ
    for (let dy = -baseRadius; dy <= baseRadius; dy += sampleInterval) {
      for (let dx = -baseRadius; dx <= baseRadius; dx += sampleInterval) {
        // Check if tile is within circular radius
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > baseRadius * baseRadius) continue;
        
        const tileX = hqTileX + dx;
        const tileY = hqTileY + dy;
        
        // Get zone at this tile position
        let zone = null;
        if (global.zoneManager.getZoneAt) {
          zone = global.zoneManager.getZoneAt([tileX, tileY]);
        } else if (global.zoneManager.getZonesAt) {
          // Fallback: getZonesAt returns array, take first
          const zonesAt = global.zoneManager.getZonesAt([tileX, tileY]);
          zone = zonesAt && zonesAt.length > 0 ? zonesAt[0] : null;
        }
        
        if (zone && zone.id) {
          zoneSet.add(zone.id);
        }
      }
    }
    
    // Process all unique zones found
    for (const zoneId of zoneSet) {
      // Get zone object (try different ways zoneManager might store zones)
      let zone = null;
      if (global.zoneManager.zones && global.zoneManager.zones.get) {
        zone = global.zoneManager.zones.get(zoneId);
      } else if (global.zoneManager.zones && global.zoneManager.zones[zoneId]) {
        zone = global.zoneManager.zones[zoneId];
      } else if (global.zoneManager.getZoneById) {
        zone = global.zoneManager.getZoneById(zoneId);
      }
      
      if (zone && zone.id) {
        // Mark zone as known
        this.knownZones.add(zone.id);
        
        // Store zone resource information
        if (global.zoneManager.getZoneResourceTypes) {
          const resources = global.zoneManager.getZoneResourceTypes(zone);
          this.zoneResourceInfo.set(zone.id, resources);
        }
      }
    }
  }
  
  // Check if a zone is known (intersects base radius, no scouting needed)
  isZoneKnown(zoneId) {
    return this.knownZones.has(zoneId) || this.scoutedZones.has(zoneId);
  }
  
  // Get resource information for a known zone
  getZoneResources(zoneId) {
    const scoutedInfo = this.scoutedZones.get(zoneId);
    return this.zoneResourceInfo.get(zoneId) || (scoutedInfo ? scoutedInfo.resources : null) || null;
  }
  
  // Get all known zones that contain a specific resource type
  getKnownZoneResources(resourceType) {
    const zonesWithResource = [];
    
    const knownZoneIds = new Set([
      ...this.knownZones,
      ...this.scoutedZones.keys()
    ]);

    for (const zoneId of knownZoneIds) {
      const resources = this.getZoneResources(zoneId);
      if (resources && this.hasResourceType(resources, resourceType)) {
        // Get zone object
        let zone = this.scoutedZones.get(zoneId)?.zone || null;
        if (global.zoneManager) {
          if (global.zoneManager.zones && global.zoneManager.zones.get) {
            zone = zone || global.zoneManager.zones.get(zoneId);
          } else if (global.zoneManager.zones && global.zoneManager.zones[zoneId]) {
            zone = zone || global.zoneManager.zones[zoneId];
          } else if (global.zoneManager.getZoneById) {
            zone = zone || global.zoneManager.getZoneById(zoneId);
          }
        }
        
        if (zone) {
          zonesWithResource.push(zone);
        }
      }
    }
    
    return zonesWithResource;
  }
  
  // Mark a zone as known after successful scouting (call when scouting party returns successfully)
  markZoneAsKnown(zone) {
    if (!zone || !zone.id) return;
    
    const existing = this.scoutedZones.get(zone.id);
    const resources = global.zoneManager && global.zoneManager.getZoneResourceTypes
      ? global.zoneManager.getZoneResourceTypes(zone)
      : (existing ? existing.resources : null);

    this.knownZones.add(zone.id);
    this.clearedZones.add(zone.id);
    this.scoutedZones.set(zone.id, {
      zone,
      resources,
      scoutedAt: existing ? existing.scoutedAt : Date.now(),
      clearedAt: Date.now(),
      scoutedDay: existing ? existing.scoutedDay : (global.day || 1),
      clearedDay: global.day || 1
    });

    if (resources) {
      this.zoneResourceInfo.set(zone.id, resources);
    }
  }
  
  // Update known zones (call when territory expands)
  updateKnownZones() {
    // Clear territory-derived knowledge and rescan. Durable scout discoveries stay in scoutedZones.
    this.knownZones.clear();
    this.zoneResourceInfo.clear();
    this.scanKnownZones();

    for (const [zoneId, info] of this.scoutedZones.entries()) {
      this.knownZones.add(zoneId);
      if (info.resources) {
        this.zoneResourceInfo.set(zoneId, info.resources);
      }
    }
  }
}

module.exports = FactionKnowledge;

