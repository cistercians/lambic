// Territory Management System
// Dynamically calculates and manages faction territory boundaries

class TerritoryManager {
  constructor(house) {
    this.house = house;
    this.coreBase = null;
    this.outposts = [];
  }
  
  // Recalculate territory based on current buildings
  updateTerritory() {
    const buildings = this.getBuildingsByHouse();
    
    if (buildings.length === 0) {
      // No buildings yet - use HQ
      this.coreBase = {
        center: this.house.hq,
        radius: 15,
        buildings: []
      };
      return;
    }
    
    // Calculate center of mass of all buildings
    const centerOfMass = this.calculateCenterOfMass(buildings);
    
    // Calculate average distance from center to buildings
    const avgDistance = this.calculateAverageDistance(centerOfMass, buildings);
    
    // Territory radius is 2x average distance (minimum 15 tiles)
    const territoryRadius = Math.max(avgDistance * 2, 15);
    
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
      if (terrain === 4) score += 2; // ROCKS
      if (terrain === 6) score += 10; // CAVE_ENTRANCE
    }
    
    return score;
  }
  
  // Helper: get buildings owned by this house
  getBuildingsByHouse() {
    const buildings = [];
    
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id) {
          buildings.push(building);
        }
      }
    }
    
    return buildings;
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
}

module.exports = TerritoryManager;

