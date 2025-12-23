// Building Service
// Single place for building queries with cached lists and consistent checks

class BuildingService {
  constructor(house) {
    this.house = house;
    this._cachedBuildings = null;
    this._cachedBuildingCounts = {};
    this._cacheDay = 0;
    this._debug = false; // Set to true for cache operation logging
  }
  
  // Enable/disable debug logging for cache operations
  setDebug(enabled) {
    this._debug = enabled;
  }
  
  // Get all buildings owned by this house (cached per day)
  getBuildings() {
    const day = global.day || 1;
    
    if (this._cachedBuildings !== null && this._cacheDay === day) {
      if (this._debug) {
        console.log(`[BuildingService] Cache HIT for buildings list (${this._cachedBuildings.length} buildings)`);
      }
      return this._cachedBuildings;
    }
    
    if (this._debug) {
      console.log(`[BuildingService] Cache MISS for buildings list - fetching...`);
    }
    
    const buildings = [];
    if (typeof Building !== 'undefined' && Building.list) {
      for (const id in Building.list) {
        const building = Building.list[id];
        if (building.owner === this.house.id && building.built) {
          buildings.push(building);
        }
      }
    }
    
    this._cachedBuildings = buildings;
    this._cacheDay = day;
    
    if (this._debug) {
      console.log(`[BuildingService] Cached ${buildings.length} buildings for day ${day}`);
    }
    
    return buildings;
  }
  
  // Get count of buildings by type (cached per day)
  // Optimized: checks count cache first before fetching all buildings
  getBuildingCount(buildingType) {
    const day = global.day || 1;
    const cacheKey = buildingType;
    
    // Check count cache first (O(1) when cached)
    if (this._cachedBuildingCounts[cacheKey] !== undefined && this._cacheDay === day) {
      if (this._debug) {
        console.log(`[BuildingService] Cache HIT for ${buildingType} count: ${this._cachedBuildingCounts[cacheKey]}`);
      }
      return this._cachedBuildingCounts[cacheKey];
    }
    
    // Cache miss - need to calculate (O(n) only on cache miss)
    if (this._debug) {
      console.log(`[BuildingService] Cache MISS for ${buildingType} - calculating...`);
    }
    
    const buildings = this.getBuildings();
    let count = 0;
    for (const building of buildings) {
      if (building.type === buildingType) {
        count++;
      }
    }
    
    // Update count cache
    this._cachedBuildingCounts[cacheKey] = count;
    if (this._cacheDay !== day) {
      this._cacheDay = day;
      this._cachedBuildingCounts = { [cacheKey]: count }; // Reset cache for new day
    }
    
    return count;
  }
  
  // Check if house has a building type
  hasBuildingType(buildingType) {
    return this.getBuildingCount(buildingType) > 0;
  }
  
  // Get buildings by type
  getBuildingsByType(buildingType) {
    const buildings = this.getBuildings();
    return buildings.filter(b => b.type === buildingType);
  }
  
  // Get first building of a type
  getFirstBuildingOfType(buildingType) {
    const buildings = this.getBuildingsByType(buildingType);
    return buildings.length > 0 ? buildings[0] : null;
  }
  
  // Invalidate cache (call when buildings are added/removed)
  invalidateCache() {
    this._cachedBuildings = null;
    this._cachedBuildingCounts = {};
    this._cacheDay = 0;
  }
}

module.exports = BuildingService;


