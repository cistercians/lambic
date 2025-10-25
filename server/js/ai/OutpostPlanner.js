// Outpost Planning System
// Handles intelligent placement of resource-gathering buildings and guard towers

class OutpostPlanner {
  constructor() {
    this.buildingTypes = {
      stone: 'quarry',
      wood: 'sawmill', 
      grain: 'farm',
      iron: 'mine'
    };
  }

  // Plan outpost location and building layout
  planOutpost(targetZone, resourceType, house) {
    const candidates = this.findCandidateLocations(targetZone);
    
    if (candidates.length === 0) {
      console.log(`No suitable locations found in ${targetZone.name} for outpost`);
      return null;
    }

    // Score each candidate location
    const scoredCandidates = candidates.map(location => ({
      location,
      score: this.scoreOutpostLocation(location, targetZone, resourceType, house)
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);
    
    const bestLocation = scoredCandidates[0];
    const buildingLayout = this.planBuildingLayout(bestLocation.location, resourceType);
    
    console.log(`Planned outpost in ${targetZone.name} at [${bestLocation.location}] with score ${bestLocation.score}`);
    
    return {
      zone: targetZone,
      resourceType: resourceType,
      centerLocation: bestLocation.location,
      buildings: buildingLayout,
      score: bestLocation.score
    };
  }

  // Find candidate locations within the zone
  findCandidateLocations(targetZone) {
    const candidates = [];
    
    // Sample locations within the zone (every 5th tile to avoid too many candidates)
    for (let i = 0; i < targetZone.tileArray.length; i += 5) {
      const [c, r] = targetZone.tileArray[i];
      
      // Check if location is suitable for building
      if (this.isSuitableForBuilding(c, r)) {
        candidates.push([c, r]);
      }
    }
    
    return candidates;
  }

  // Check if a location is suitable for building
  isSuitableForBuilding(c, r) {
    const terrain = global.getTile ? global.getTile(0, c, r) : 7;
    
    // Suitable terrain types: empty (7), brush (3)
    if (terrain !== 7 && terrain !== 3) return false;
    
    // Check if there's already a building here
    if (global.getBuilding && global.getBuilding(c, r)) return false;
    
    // Check if location is not in water
    if (terrain === 0) return false;
    
    return true;
  }

  // Score a location for outpost suitability
  scoreOutpostLocation(location, targetZone, resourceType, house) {
    const [c, r] = location;
    let score = 0;
    
    // Base score for being in the target zone
    score += 50;
    
    // Distance from zone center (closer is better)
    const zoneCenter = targetZone.center;
    const distanceFromCenter = Math.sqrt(
      Math.pow(c - zoneCenter[0], 2) + Math.pow(r - zoneCenter[1], 2)
    );
    score += Math.max(0, 20 - distanceFromCenter);
    
    // Distance from HQ (not too far, not too close)
    const hqPos = house.hq;
    const distanceFromHQ = Math.sqrt(
      Math.pow(c - hqPos[0], 2) + Math.pow(r - hqPos[1], 2)
    );
    
    // Prefer locations 20-50 tiles from HQ
    if (distanceFromHQ >= 20 && distanceFromHQ <= 50) {
      score += 30;
    } else if (distanceFromHQ < 20) {
      score += Math.max(0, 20 - distanceFromHQ); // Too close
    } else {
      score += Math.max(0, 30 - (distanceFromHQ - 50)); // Too far
    }
    
    // Resource proximity bonus
    const resourceProximity = this.calculateResourceProximity(c, r, resourceType);
    score += resourceProximity * 2;
    
    // Terrain bonus
    const terrain = global.getTile ? global.getTile(0, c, r) : 7;
    if (terrain === 7) score += 10; // Empty terrain preferred
    if (terrain === 3) score += 5;  // Brush terrain acceptable
    
    // Check for nearby buildings (avoid clustering)
    const nearbyBuildings = this.countNearbyBuildings(c, r, 10);
    score -= nearbyBuildings * 5;
    
    return score;
  }

  // Calculate proximity to target resource
  calculateResourceProximity(c, r, resourceType) {
    let proximity = 0;
    const searchRadius = 10;
    
    for (let dc = -searchRadius; dc <= searchRadius; dc++) {
      for (let dr = -searchRadius; dr <= searchRadius; dr++) {
        const checkC = c + dc;
        const checkR = r + dr;
        const terrain = global.getTile ? global.getTile(0, checkC, checkR) : 7;
        
        // Check for resource-specific terrain
        switch (resourceType) {
          case 'stone':
            if (terrain === 4) proximity += 3; // Rocks
            if (terrain === 6) proximity += 5; // Caves
            break;
          case 'wood':
            if (terrain === 1 || terrain === 2) proximity += 2; // Forest
            break;
          case 'grain':
            if (terrain === 7 || terrain === 3) proximity += 1; // Farmland
            break;
          case 'iron':
            if (terrain === 6) proximity += 10; // Caves
            break;
        }
      }
    }
    
    return proximity;
  }

  // Count nearby buildings
  countNearbyBuildings(c, r, radius) {
    let count = 0;
    
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        const checkC = c + dc;
        const checkR = r + dr;
        
        if (global.getBuilding && global.getBuilding(checkC, checkR)) {
          count++;
        }
      }
    }
    
    return count;
  }

  // Plan building layout for the outpost
  planBuildingLayout(centerLocation, resourceType) {
    const [centerC, centerR] = centerLocation;
    const buildings = [];
    
    // Resource building
    const resourceBuilding = {
      type: this.buildingTypes[resourceType] || 'workshop',
      position: [centerC, centerR],
      purpose: 'resource_gathering'
    };
    buildings.push(resourceBuilding);
    
    // Guard tower (offset by 3-5 tiles)
    const towerOffset = this.calculateTowerPosition(centerC, centerR);
    const guardTower = {
      type: 'guard_tower',
      position: towerOffset,
      purpose: 'defense'
    };
    buildings.push(guardTower);
    
    return buildings;
  }

  // Calculate guard tower position
  calculateTowerPosition(centerC, centerR) {
    // Try positions around the center building
    const offsets = [
      [3, 0], [0, 3], [-3, 0], [0, -3], // Cardinal directions
      [2, 2], [-2, 2], [-2, -2], [2, -2] // Diagonal directions
    ];
    
    for (const [dc, dr] of offsets) {
      const towerC = centerC + dc;
      const towerR = centerR + dr;
      
      if (this.isSuitableForBuilding(towerC, towerR)) {
        return [towerC, towerR];
      }
    }
    
    // Fallback: place 2 tiles away
    return [centerC + 2, centerR];
  }

  // Get building requirements for outpost
  getBuildingRequirements(resourceType) {
    const requirements = {
      stone: { wood: 50, stone: 20 },
      wood: { wood: 30, stone: 10 },
      grain: { wood: 40, stone: 15 },
      iron: { wood: 60, stone: 25 }
    };
    
    return requirements[resourceType] || { wood: 50, stone: 20 };
  }

  // Estimate construction time for outpost
  estimateConstructionTime(resourceType, serfCount = 2) {
    const baseTime = {
      stone: 300, // 5 minutes
      wood: 240, // 4 minutes  
      grain: 180, // 3 minutes
      iron: 360  // 6 minutes
    };
    
    const time = baseTime[resourceType] || 300;
    return Math.ceil(time / serfCount);
  }
}

module.exports = OutpostPlanner;
