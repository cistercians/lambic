// Territory Management System
// Dynamically calculates and manages faction territory boundaries

const NameGenerator = require('../core/NameGenerator');

class TerritoryManager {
  constructor(house) {
    this.house = house;
    this.coreBase = null;
    this.outposts = [];
    this.nameGenerator = new NameGenerator();
    this.townName = null;
    this.lastBuildingCount = 0;
    this.lastBuildingHash = null;
  }
  
  // Recalculate territory based on current buildings (cached until buildings change)
  updateTerritory() {
    const logger = this.house.ai?.logger;
    const buildings = this.getBuildingsByHouse();
    
    // Check if buildings have changed (cache invalidation)
    const buildingHash = this.calculateBuildingHash(buildings);
    if (this.lastBuildingHash === buildingHash && this.coreBase !== null) {
      // Buildings haven't changed, use cached territory
      return;
    }
    
    this.lastBuildingCount = buildings.length;
    this.lastBuildingHash = buildingHash;
    
    if (buildings.length === 0) {
      // No buildings yet - use HQ
      this.coreBase = {
        center: this.house.hq,
        radius: 10,
        buildings: []
      };
      
      if (logger) {
        logger.logDecision('TERRITORY_CALCULATED', 'Territory calculated (no buildings, using HQ)', {
          center: this.house.hq,
          radius: 10,
          buildingCount: 0,
          reasoning: 'No buildings yet, using HQ as center with minimum radius'
        });
      }
      return;
    }
    
    // Calculate center of mass of all buildings
    const centerOfMass = this.calculateCenterOfMass(buildings);
    
    // Calculate average distance from center to buildings
    const avgDistance = this.calculateAverageDistance(centerOfMass, buildings);
    
    // Territory radius is 1.1x average distance (minimum 10 tiles)
    const territoryRadius = Math.max(avgDistance * 1.1, 10);
    
    // Classify buildings as core base or outposts
    this.coreBase = {
      center: centerOfMass,
      radius: territoryRadius,
      buildings: []
    };
    this.outposts = [];
    
    for (const building of buildings) {
      const plot = building.plot[0]; // Base tile
      const dist = this.getDistance(centerOfMass, plot);
      
      if (dist <= territoryRadius) {
        this.coreBase.buildings.push(building);
      } else {
        // This building is outside core base - part of an outpost
        this.addToOutpost(building);
      }
    }
    
  }
  
  calculateCenterOfMass(buildings) {
    let totalX = 0, totalY = 0;
    
    for (const building of buildings) {
      const plot = building.plot[0]; // Base tile
      totalX += plot[0];
      totalY += plot[1];
    }
    
    return [
      Math.floor(totalX / buildings.length),
      Math.floor(totalY / buildings.length)
    ];
  }
  
  calculateAverageDistance(center, buildings) {
    let totalDist = 0;
    
    for (const building of buildings) {
      const plot = building.plot[0];
      const dist = this.getDistance(center, plot);
      totalDist += dist;
    }
    
    return totalDist / buildings.length;
  }
  
  addToOutpost(building) {
    // Find nearest outpost or create new one
    let nearestOutpost = null;
    let minDist = Infinity;
    
    for (const outpost of this.outposts) {
      const dist = this.getDistance(outpost.center, building.plot[0]);
      if (dist < minDist && dist < 10) { // Within 10 tiles = same outpost
        nearestOutpost = outpost;
        minDist = dist;
      }
    }
    
    if (nearestOutpost) {
      nearestOutpost.buildings.push(building);
      // Recalculate outpost center
      nearestOutpost.center = this.calculateCenterOfMass(nearestOutpost.buildings);
    } else {
      // Create new outpost
      this.outposts.push({
        center: building.plot[0],
        buildings: [building],
        established: global.day || 1
      });
    }
  }
  
  // Check if a tile is within core base territory
  isInCoreTerritory(tile) {
    if (!this.coreBase) return false;
    const dist = this.getDistance(this.coreBase.center, tile);
    return dist <= this.coreBase.radius;
  }
  
  // Find best location for building within territory
  findBuildingSpotInTerritory(buildingType, preferredDistance = 5) {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    
    const center = this.coreBase.center;
    const maxRadius = this.coreBase.radius;
    
    // Search outward from preferred distance
    for (let r = preferredDistance; r < maxRadius; r += 2) {
      const candidates = this.getCircumferenceTiles(center, r);
      
      for (const tile of candidates) {
        if (this.canPlaceBuildingAt(tile, buildingType)) {
          return tile;
        }
      }
    }
    
    return null;
  }
  
  // Get tiles in a circle at specific radius
  getCircumferenceTiles(center, radius) {
    const tiles = [];
    const steps = Math.ceil(radius * 2 * Math.PI); // Rough circumference
    
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const x = Math.floor(center[0] + radius * Math.cos(angle));
      const y = Math.floor(center[1] + radius * Math.sin(angle));
      tiles.push([x, y]);
    }
    
    return tiles;
  }
  
  // Check if building can be placed at tile (uses existing game logic)
  canPlaceBuildingAt(tile, buildingType) {
    // Use global tilemap system if available
    if (global.tilemapSystem) {
      return global.tilemapSystem.canPlaceBuilding(buildingType, tile);
    }
    
    // Fallback: basic walkability check
    return global.isWalkable && global.isWalkable(0, tile[0], tile[1]);
  }
  
  // Check if territory is "full" (should expand to outpost)
  isTerritoryFull() {
    if (!this.coreBase) return false;
    
    const buildingCount = this.coreBase.buildings.length;
    const territoryArea = Math.PI * Math.pow(this.coreBase.radius, 2);
    const density = buildingCount / territoryArea;
    
    // If density exceeds threshold, territory is full
    return density > 0.05; // ~1 building per 20 tiles
  }
  
  // Find location for new outpost
  findOutpostLocation() {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    
    const center = this.coreBase.center;
    const minDistance = this.coreBase.radius + 10; // Beyond core territory
    const maxDistance = this.coreBase.radius + 30;
    
    // Search in expanding rings
    for (let r = minDistance; r < maxDistance; r += 5) {
      const candidates = this.getCircumferenceTiles(center, r);
      
      for (const tile of candidates) {
        // Check if location is suitable for outpost
        const score = this.scoreOutpostLocation(tile);
        if (score > 50) {
          return tile;
        }
      }
    }
    
    return null;
  }
  
  scoreOutpostLocation(tile) {
    // Similar to MapAnalyzer but for outposts
    const radius = 8;
    const area = global.getArea ? global.getArea(tile, tile, radius) : [];
    
    let score = 0;
    for (const t of area) {
      const terrain = global.getTile ? global.getTile(0, t[0], t[1]) : 0;
      // TERRAIN constants from lambic.js
      if (terrain === 7 || terrain === 3) score += 2; // EMPTY or BRUSH
      if (terrain === 1 || terrain === 2) score += 3; // HEAVY_FOREST or LIGHT_FOREST
      const TERRAIN = global.TERRAIN;
      if (terrain === TERRAIN.ROCKS) score += 2; // Visual rocks (placement only)
      if (global.isLargeRock && global.isLargeRock(terrain)) score += 5; // Large rocks (actual resources)
      if (terrain === 6) score += 10; // CAVE_ENTRANCE
    }
    
    return score;
  }
  
  // Helper: get buildings owned by this house (uses BuildingService - fails fast if unavailable)
  getBuildingsByHouse() {
    if (!this.house.ai || !this.house.ai.buildingService) {
      throw new Error(`BuildingService not available for ${this.house.name || 'unknown'} - check FactionAI initialization`);
    }
    return this.house.ai.buildingService.getBuildings();
  }
  
  // Helper: calculate distance between two points
  getDistance(point1, point2) {
    if (global.getDistance) {
      return global.getDistance({x: point1[0], y: point1[1]}, {x: point2[0], y: point2[1]});
    }
    
    // Fallback: simple euclidean distance
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Calculate hash of building list for cache invalidation
  // Uses sum of building IDs + count for robust hash that detects changes
  // More robust than count:lastId (handles edge cases like remove+re-add)
  calculateBuildingHash(buildings) {
    if (buildings.length === 0) return '0:0';
    
    // Calculate sum of all building IDs (more robust than just last ID)
    let idSum = 0;
    let validIds = 0;
    
    for (const building of buildings) {
      if (building && building.id !== undefined && building.id !== null) {
        idSum += building.id;
        validIds++;
      }
    }
    
    // Hash: count + sum of IDs + number of valid IDs
    // This combination ensures we detect:
    // - Count changes (buildings added/removed)
    // - ID changes (different buildings)
    // - Edge cases (same count, different buildings)
    return `${buildings.length}:${idSum}:${validIds}`;
  }
  
  // Check if coordinates are within base territory (for compatibility with Houses.js)
  isInBaseTerritory(x, y) {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    
    if (!this.coreBase) return false;
    
    const center = this.coreBase.center;
    const centerCoords = global.getCenter ? global.getCenter(center[0], center[1]) : [center[0] * 64, center[1] * 64];
    const dist = Math.sqrt(Math.pow(x - centerCoords[0], 2) + Math.pow(y - centerCoords[1], 2));
    const radiusInPixels = this.coreBase.radius * (global.tileSize || 64);
    
    return dist <= radiusInPixels;
  }
  
  // Get base center coordinates (for compatibility with Houses.js)
  getBaseCenter() {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    return this.coreBase ? this.coreBase.center : this.house.hq;
  }
  
  // Get base center coordinates in pixels (for compatibility with Houses.js)
  getBaseCenterCoords() {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    if (!this.coreBase) {
      const hq = this.house.hq;
      return global.getCenter ? global.getCenter(hq[0], hq[1]) : [hq[0] * 64, hq[1] * 64];
    }
    const center = this.coreBase.center;
    return global.getCenter ? global.getCenter(center[0], center[1]) : [center[0] * 64, center[1] * 64];
  }
  
  // Get base radius in pixels (for compatibility with Houses.js)
  getBaseRadius() {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    const radius = this.coreBase ? this.coreBase.radius : 10;
    return radius * (global.tileSize || 64);
  }
  
  // Handle colony absorption (moved from Houses.js)
  absorbColonies() {
    if (!this.coreBase) {
      this.updateTerritory();
    }
    if (!this.coreBase) return;
    
    const buildings = this.getBuildingsByHouse();
    const center = this.coreBase.center;
    const centerCoords = this.getBaseCenterCoords();
    const radiusInPixels = this.getBaseRadius();
    
    for (const building of buildings) {
      if (building.isColony && building.built) {
        const dx = building.x - centerCoords[0];
        const dy = building.y - centerCoords[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= radiusInPixels) {
          // Colony absorbed into base
          building.isColony = false;
        }
      }
    }
  }

  // Generate town name for this faction
  generateTownName() {
    if (!this.townName) {
      this.townName = this.nameGenerator.generateTownName();
    }
    return this.townName;
  }

  // Create territory zones for core base and outposts
  createTerritoryZones() {
    if (!this.coreBase) {
      this.updateTerritory();
    }

    const zones = [];

    // Create core base zone
    if (this.coreBase) {
      const baseZone = {
        id: `faction_${this.house.id}_base`,
        type: 'faction_territory',
        name: `${this.house.name} Territory (${this.generateTownName()})`,
        faction: this.house.name,
        tiles: this.calculateTerritoryTiles(),
        tileArray: this.calculateTerritoryTiles(),
        center: this.coreBase.center,
        bounds: this.calculateTerritoryBounds(),
        size: this.coreBase.buildings.length,
        isOutpost: false
      };
      zones.push(baseZone);
    }

    // Create outpost zones
    this.outposts.forEach((outpost, index) => {
      const outpostZone = {
        id: `faction_${this.house.id}_outpost_${index}`,
        type: 'faction_outpost',
        name: `${this.house.name} Outpost`,
        faction: this.house.name,
        tiles: this.calculateOutpostTiles(outpost),
        tileArray: this.calculateOutpostTiles(outpost),
        center: outpost.center,
        bounds: this.calculateOutpostBounds(outpost),
        size: outpost.buildings.length,
        isOutpost: true
      };
      zones.push(outpostZone);
    });

    return zones;
  }

  // Calculate all tiles within core territory
  calculateTerritoryTiles() {
    if (!this.coreBase) return [];

    const tiles = [];
    const center = this.coreBase.center;
    const radius = this.coreBase.radius;

    // Create circular territory
    for (let c = center[0] - radius; c <= center[0] + radius; c++) {
      for (let r = center[1] - radius; r <= center[1] + radius; r++) {
        const dist = this.getDistance(center, [c, r]);
        if (dist <= radius) {
          tiles.push([c, r]);
        }
      }
    }

    return tiles;
  }

  // Calculate tiles for an outpost
  calculateOutpostTiles(outpost) {
    const tiles = [];
    const center = outpost.center;
    const radius = 8; // Smaller radius for outposts

    // Create circular outpost area
    for (let c = center[0] - radius; c <= center[0] + radius; c++) {
      for (let r = center[1] - radius; r <= center[1] + radius; r++) {
        const dist = this.getDistance(center, [c, r]);
        if (dist <= radius) {
          tiles.push([c, r]);
        }
      }
    }

    return tiles;
  }

  // Calculate bounding box for core territory
  calculateTerritoryBounds() {
    if (!this.coreBase) return null;

    const center = this.coreBase.center;
    const radius = this.coreBase.radius;

    return {
      minC: center[0] - radius,
      maxC: center[0] + radius,
      minR: center[1] - radius,
      maxR: center[1] + radius
    };
  }

  // Calculate bounding box for an outpost
  calculateOutpostBounds(outpost) {
    const center = outpost.center;
    const radius = 8;

    return {
      minC: center[0] - radius,
      maxC: center[0] + radius,
      minR: center[1] - radius,
      maxR: center[1] + radius
    };
  }
}

module.exports = TerritoryManager;

