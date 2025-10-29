// Map Analysis System
// Unified system for all location analysis: HQ placement, building sites, expansion, geography

const TerrainSegmentation = require('../core/TerrainSegmentation');
const NameGenerator = require('../core/NameGenerator');

class MapAnalyzer {
  constructor() {
    this.mapSize = global.mapSize || 100;
    this.analysisCache = null;
    this.factionRequirements = this.getFactionRequirements();
    this.nameGenerator = new NameGenerator();
    this.geographicFeatures = null;
  }
  
  // Get faction-specific requirements (consolidated from TilemapSystem)
  getFactionRequirements() {
    return {
      Brotherhood: {
        searchLayer: 1, // Underworld (world array index 1 = z:-1)
        requiredTerrain: [0], // Cave floor (empty in underworld)
        minTerrainPercentage: 0.25, // Lowered - immediate vicinity check is more reliable
        evaluationRadius: 10, // Moderate chamber size
        priorities: { openSpace: 60, uniformCaveTerrain: 30, isolation: 10 }
      },
      
      Goths: {
        searchLayer: 0, // Overworld
        requiredTerrain: [1, 2, 3, 4, 7], // Heavy forest, light forest, brush, rocks, grass - very flexible
        minTerrainPercentage: 0.01, // Extremely flexible to allow spawn locations
        evaluationRadius: 25,
        priorities: { farmingPotential: 40, mixedResources: 25, buildingSpace: 20 }
      },
      
      Franks: {
        searchLayer: 0,
        requiredTerrain: [3], // BRUSH only - target brush fields specifically
        minTerrainPercentage: 0.15, // Require decent brush coverage
        evaluationRadius: 25,
        priorities: { openSpace: 70, brushDensity: 30 } // Prioritize open brush fields
      },
      
      Celts: {
        searchLayer: 0,
        requiredTerrain: [1, 2], // HEAVY_FOREST, LIGHT_FOREST
        minTerrainPercentage: 0.10, // Lowered to allow more forest locations
        evaluationRadius: 20,
        priorities: { denseForest: 30, caveProximity: 50, rockAccess: 10 },
        preferCaves: true // Try caves first, fallback to forest
      },
      
      Teutons: {
        searchLayer: 0,
        requiredTerrain: [1, 2, 3, 4, 5, 7], // Accept most terrain, score by mining potential
        minTerrainPercentage: 0.05, // Extremely flexible - accepts almost anywhere
        evaluationRadius: 25,
        priorities: { miningPotential: 45, lumberAccess: 35, terrainDiversity: 20 },
        preferredFeatures: ['rocks', 'forest'] // Not required, just preferred
      },
      
      Norsemen: {
        searchLayer: 0,
        requiredTerrain: [0, 7], // WATER, GRASS (coastal)
        minTerrainPercentage: 0.05, // Very flexible to allow more coastal locations
        evaluationRadius: 20,
        priorities: { waterAccess: 60, coastalMix: 30, harbors: 10 }
      },
      
      Outlaws: {
        searchLayer: 0,
        requiredTerrain: [1], // Heavy forest only
        minTerrainPercentage: 0.10, // Lowered to allow more forest locations
        evaluationRadius: 15,
        priorities: { maximumConcealment: 50, rockAccess: 20, isolation: 30 },
        minSpacing: 50 // Outlaws need large spacing between camps
      },
      
      Mercenaries: {
        searchLayer: 1, // Underworld (world array index 1 = z:-1)
        requiredTerrain: [0], // Cave floor
        minTerrainPercentage: 0.30, // Lowered - immediate vicinity check is more reliable
        evaluationRadius: 8, // Need decent chamber for objects + movement
        priorities: { openSpace: 70, centralLocation: 20, uniformCaveTerrain: 10 }
      }
    };
  }
  
  // Analyze entire map and score all potential HQ locations
  analyzeMap() {
    const candidates = [];
    
    // Scan map in a grid pattern (every 5 tiles to reduce computation)
    for (let c = 10; c < this.mapSize - 10; c += 5) {
      for (let r = 10; r < this.mapSize - 10; r += 5) {
        const score = this.scoreLocation([c, r]);
        if (score.total > 50) {
          candidates.push({ tile: [c, r], score });
        }
      }
    }
    
    // Sort by total score (best locations first)
    const sorted = candidates.sort((a, b) => b.score.total - a.score.total);
    this.analysisCache = sorted;
    
    return sorted;
  }
  
  // Score a specific location for HQ suitability
  scoreLocation(tile) {
    const radius = 15;
    const area = this.getAreaAroundTile(tile, radius);
    
    const resources = {
      farmland: 0,
      forest: 0,
      rocks: 0,
      caves: 0,
      water: 0
    };
    
    for (const t of area) {
      const terrain = this.getTerrain(t[0], t[1]);
      
      // Count terrain types (using TERRAIN constants from lambic.js)
      if (terrain === 7 || terrain === 3) resources.farmland++; // EMPTY or BRUSH
      if (terrain === 1 || terrain === 2) resources.forest++; // HEAVY_FOREST or LIGHT_FOREST
      if (terrain === 4) resources.rocks++; // ROCKS
      if (terrain === 6) resources.caves++; // CAVE_ENTRANCE
      if (terrain === 0) resources.water++; // WATER
    }
    
    // Calculate total score (caves are worth more)
    const totalScore = resources.farmland + resources.forest + resources.rocks + (resources.caves * 20) - (resources.water * 2);
    
    return {
      farmland: resources.farmland,
      forest: resources.forest,
      rocks: resources.rocks,
      caves: resources.caves,
      water: resources.water,
      total: totalScore
    };
  }
  
  // Score location specifically for a faction type
  scoreLocationForFaction(tile, factionType, profile) {
    const baseScore = this.scoreLocation(tile);
    let factionScore = 0;
    
    // Apply faction-specific preferences
    if (profile && profile.economicPriorities) {
      for (const priority of profile.economicPriorities) {
        if (priority === 'farmland') factionScore += baseScore.farmland * 2;
        if (priority === 'forest' || priority === 'heavy_forest') factionScore += baseScore.forest * 2;
        if (priority === 'stone' || priority === 'rocks') factionScore += baseScore.rocks * 2;
        if (priority === 'cave_entrance' || priority === 'ore') factionScore += baseScore.caves * 40;
      }
    }
    
    return {
      ...baseScore,
      factionScore: factionScore || baseScore.total
    };
  }
  
  // Find HQ location for a specific faction
  findFactionHQ(factionName, excludedLocations = []) {
    const requirements = this.factionRequirements[factionName];
    if (!requirements) {
      console.error(`MapAnalyzer: Unknown faction ${factionName}`);
      return null;
    }
    
    // Reset debug flag for this faction search
    this._debugLogged = false;
    
    // Get search points based on faction requirements
    const searchPoints = this.getSearchPointsForFaction(factionName, requirements);
    
    // CRITICAL: Randomize search points to prevent clustering in same areas
    // Use proper Fisher-Yates shuffle instead of sort() which has bias
    const shuffledPoints = [...searchPoints];
    for (let i = shuffledPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPoints[i], shuffledPoints[j]] = [shuffledPoints[j], shuffledPoints[i]];
    }
    
    const validLocations = [];
    let testedCount = 0;
    let excludedCount = 0;
    let rejectedReasons = {};
    
    // Use custom minSpacing if specified, otherwise use default of 30 tiles
    const minSpacing = requirements.minSpacing || 30;
    
    for (const point of shuffledPoints) {
      // Check distance from excluded locations
      if (this.isTooCloseToExcluded(point, excludedLocations, minSpacing)) {
        excludedCount++;
        continue;
      }
      
      testedCount++;
      const evaluation = this.evaluateHQLocation(point, requirements);
      
      if (evaluation.isValid) {
        validLocations.push({
          tile: point,
          score: evaluation.score,
          details: evaluation.details
        });
      } else if (evaluation.reason) {
        rejectedReasons[evaluation.reason] = (rejectedReasons[evaluation.reason] || 0) + 1;
      }
      
      // Stop after testing 500 locations to find best spread across map
      if (testedCount >= 500) break;
    }
    
    // Sort by score and return best
    validLocations.sort((a, b) => b.score - a.score);
    
    if (validLocations.length > 0) {
      console.log(`${factionName} HQ: [${validLocations[0].tile}]`);
      return validLocations[0];
    }
    
    // FALLBACK: If Celts failed with caves (due to spacing), retry with forest
    if (requirements.preferCaves && searchPoints.length < 10) {
      const forestPoints = this.getForestSpawnPoints();
      
      // Randomize fallback search too - use proper Fisher-Yates shuffle
      const shuffledForestPoints = [...forestPoints];
      for (let i = shuffledForestPoints.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledForestPoints[i], shuffledForestPoints[j]] = [shuffledForestPoints[j], shuffledForestPoints[i]];
      }
      
      const fallbackLocations = [];
      let fallbackTested = 0;
      
      for (const point of shuffledForestPoints) {
        if (this.isTooCloseToExcluded(point, excludedLocations, minSpacing)) {
          continue;
        }
        
        fallbackTested++;
        const evaluation = this.evaluateHQLocation(point, requirements);
        
        if (evaluation.isValid) {
          fallbackLocations.push({
            tile: point,
            score: evaluation.score,
            details: evaluation.details
          });
        }
        
        if (fallbackTested >= 500) break;
      }
      
      if (fallbackLocations.length > 0) {
        fallbackLocations.sort((a, b) => b.score - a.score);
        console.log(`MapAnalyzer: ${factionName} HQ at [${fallbackLocations[0].tile}] (forest fallback, score: ${fallbackLocations[0].score.toFixed(1)})`);
        return fallbackLocations[0];
      }
    }
    
    console.warn(`MapAnalyzer: No valid HQ location found for ${factionName}`);
    return null;
  }
  
  // Get search points based on faction requirements
  getSearchPointsForFaction(factionName, requirements) {
    const layer = requirements.searchLayer;
    
    // Underground factions (layer 1 = world[1] = z:-1)
    if (layer === 1) {
      return this.getUnderworldSpawnPoints();
    }
    
    // CRITICAL: For Celts, try caves first, fallback to forest
    if (requirements.preferCaves) {
      const cavePoints = this.getCaveEntrancePoints();
      if (cavePoints.length > 0) {
        return cavePoints;
      }
    }
    
    // FACTION-SPECIFIC SEARCH STRATEGIES (prevent clustering by using different search areas)
    if (factionName === 'Norsemen') return this.getWaterSpawnPoints();
    if (factionName === 'Franks') return this.getBrushFieldSpawnPoints();
    if (factionName === 'Celts') return this.getForestSpawnPoints();
    if (factionName === 'Outlaws') return this.getHeavyForestSpawnPoints();
    if (factionName === 'Goths') return this.getOverworldSpawnPoints();
    
    if (factionName === 'Teutons') {
      return [
        ...this.getOverworldSpawnPoints(),
        ...this.getForestSpawnPoints(),
        ...this.getMountainSpawnPoints(),
        ...this.getWaterSpawnPoints(),
        ...this.getBrushFieldSpawnPoints()
      ];
    }
    
    if (factionName === 'Brotherhood') {
      return [...this.getOverworldSpawnPoints(), ...this.getMountainSpawnPoints()];
    }
    
    if (factionName === 'Mercenaries') {
      return [...this.getForestSpawnPoints(), ...this.getBrushFieldSpawnPoints()];
    }
    
    // Fallback for unknown factions
    console.warn(`No specific spawn strategy for faction ${factionName}, using overworld`);
    return this.getOverworldSpawnPoints();
  }
  
  // Evaluate if a location is suitable for faction HQ
  evaluateHQLocation(tile, requirements) {
    const layer = requirements.searchLayer;
    const radius = requirements.evaluationRadius;
    
    // CRITICAL: Check map boundaries for surface factions only
    // Underground caves have different coordinate space - 3x3 chamber check is sufficient
    if (layer === 0) {
      const boundaryPadding = 5; // Reduced from 10 to allow cave entrances closer to edges
      if (tile[0] < boundaryPadding || tile[0] >= this.mapSize - boundaryPadding ||
          tile[1] < boundaryPadding || tile[1] >= this.mapSize - boundaryPadding) {
        return { isValid: false, score: 0, reason: 'too close to map edge' };
      }
    }
    
    // UNDERGROUND FACTIONS: Check immediate vicinity for open space (no tunnels!)
    if (layer === 1) {
      const immediateVicinity = [
        [tile[0]-1, tile[1]], [tile[0]+1, tile[1]], // Left, right
        [tile[0], tile[1]-1], [tile[0], tile[1]+1], // Up, down
        [tile[0]-1, tile[1]-1], [tile[0]+1, tile[1]-1], // Diagonals
        [tile[0]-1, tile[1]+1], [tile[0]+1, tile[1]+1],
        [tile[0], tile[1]] // Center itself
      ];
      
      let openCount = 0;
      for (const t of immediateVicinity) {
        const terrain = Math.floor(this.getTerrain(t[0], t[1], layer));
        if (terrain === 0) openCount++; // Cave floor = open
      }
      
      // At least 7 of 9 tiles (77%) must be open for underground spawn
      if (openCount < 7) {
        return { isValid: false, score: 0, reason: `tight tunnel (${openCount}/9 open)` };
      }
    }
    
    const area = this.getAreaAroundTile(tile, radius);
    
    // Count terrain types
    let validTerrainCount = 0;
    const terrainCounts = {};
    
    for (const t of area) {
      const terrain = Math.floor(this.getTerrain(t[0], t[1], layer));
      terrainCounts[terrain] = (terrainCounts[terrain] || 0) + 1;
      
      if (requirements.requiredTerrain.includes(terrain)) {
        validTerrainCount++;
      }
    }
    
    const terrainPercentage = validTerrainCount / area.length;
    
    // DEBUG: Log first evaluation for each faction
    if (!this._debugLogged) {
      this._debugLogged = true;
    }
    
    // Check minimum terrain requirement
    if (terrainPercentage < requirements.minTerrainPercentage) {
      return { isValid: false, score: 0, reason: `terrain ${(terrainPercentage*100).toFixed(1)}% < ${(requirements.minTerrainPercentage*100)}%` };
    }
    
    // Check for required nearby features (critical for Celts!)
    if (requirements.requiresNearby) {
      if (!this.hasNearbyFeature(tile, requirements.requiresNearby, layer)) {
        return { isValid: false, score: 0, reason: `missing ${requirements.requiresNearby.feature}` };
      }
    }
    
    // Score the location
    const score = this.scoreHQLocationForFaction(tile, requirements, terrainCounts, area.length);
    
    return {
      isValid: true,
      score: score,
      details: {
        terrainPercentage: terrainPercentage,
        terrainCounts: terrainCounts
      }
    };
  }
  
  // Score HQ location based on faction priorities
  scoreHQLocationForFaction(tile, requirements, terrainCounts, totalTiles) {
    let score = 0;
    const priorities = requirements.priorities;
    
    // Farming potential (Goths, Franks)
    if (priorities.farmingPotential || priorities.farmDensityPotential || priorities.maximumGrassland) {
      const farmableCount = (terrainCounts[7] || 0) + (terrainCounts[3] || 0); // GRASS + BRUSH
      const farmablePercentage = farmableCount / totalTiles;
      const priority = priorities.farmingPotential || priorities.farmDensityPotential || priorities.maximumGrassland;
      score += priority * farmablePercentage * 100;
    }
    
    // Dense forest (Celts, Outlaws)
    if (priorities.denseForest || priorities.maximumConcealment) {
      const forestCount = (terrainCounts[1] || 0) + (terrainCounts[2] || 0); // HEAVY + LIGHT FOREST
      const forestPercentage = forestCount / totalTiles;
      const priority = priorities.denseForest || priorities.maximumConcealment;
      score += priority * forestPercentage * 100;
    }
    
    // Mining potential (Teutons)
    if (priorities.miningPotential) {
      const miningCount = (terrainCounts[4] || 0) + (terrainCounts[5] || 0); // ROCKS + MOUNTAIN
      const miningPercentage = miningCount / totalTiles;
      score += priorities.miningPotential * miningPercentage * 100;
    }
    
    // Cave proximity (Celts) - critical!
    if (priorities.caveProximity) {
      const nearestCaveDist = this.getNearestCaveDistance(tile);
      if (nearestCaveDist < Infinity) {
        const proximityScore = Math.max(0, 1 - (nearestCaveDist / 24)); // Max 24 tiles
        score += priorities.caveProximity * proximityScore * 100;
      }
    }
    
    // Lumber access (Teutons)
    if (priorities.lumberAccess) {
      const nearestForestDist = this.getNearestForestDistance(tile);
      if (nearestForestDist < Infinity) {
        const proximityScore = Math.max(0, 1 - (nearestForestDist / 12));
        score += priorities.lumberAccess * proximityScore * 100;
      }
    }
    
    return score;
  }
  
  // Check if location has required nearby feature
  hasNearbyFeature(tile, requirement, layer = 0) {
    const maxDist = requirement.maxDistance;
    const feature = requirement.feature;
    
    if (feature === 'cave') {
      const caveDist = this.getNearestCaveDistance(tile, layer);
      return caveDist <= maxDist;
    } else if (feature === 'forest') {
      const forestDist = this.getNearestForestDistance(tile, layer);
      return forestDist <= maxDist;
    }
    
    return true;
  }
  
  // Get nearest cave entrance distance
  getNearestCaveDistance(tile, layer = 0) {
    const searchRadius = 30;
    const area = this.getAreaAroundTile(tile, searchRadius);
    let minDist = Infinity;
    
    for (const t of area) {
      const terrain = this.getTerrain(t[0], t[1], layer);
      if (terrain === 6) { // CAVE_ENTRANCE
        const dist = this.getDistance(tile, t);
        minDist = Math.min(minDist, dist);
      }
    }
    
    return minDist;
  }
  
  // Get nearest forest distance
  getNearestForestDistance(tile, layer = 0) {
    const searchRadius = 20;
    const area = this.getAreaAroundTile(tile, searchRadius);
    let minDist = Infinity;
    
    for (const t of area) {
      const terrain = this.getTerrain(t[0], t[1], layer);
      if (terrain === 1 || terrain === 2) { // HEAVY_FOREST or LIGHT_FOREST
        const dist = this.getDistance(tile, t);
        minDist = Math.min(minDist, dist);
      }
    }
    
    return minDist;
  }
  
  // Check if too close to excluded locations
  isTooCloseToExcluded(tile, excludedLocations, minDistance) {
    for (const excluded of excludedLocations) {
      if (this.getDistance(tile, excluded) < minDistance) {
        return true;
      }
    }
    return false;
  }
  
  // Get spawn points for different terrain types
  getCaveEntrancePoints() {
    const minEdgeDistance = 5; // Match the boundary padding in evaluateHQLocation
    
    // Check if global.caveEntrances exists (caves tracked separately)
    if (global.caveEntrances && global.caveEntrances.length > 0) {
      const allCaves = global.caveEntrances.map(c => c.loc || c);
      // Filter out caves too close to edges
      const filteredCaves = allCaves.filter(cave => 
        cave[0] >= minEdgeDistance && cave[0] < this.mapSize - minEdgeDistance &&
        cave[1] >= minEdgeDistance && cave[1] < this.mapSize - minEdgeDistance
      );
      return filteredCaves;
    }
    
    // Fallback: scan terrain for value 6 (with edge filtering)
    const caves = [];
    const terrainSample = {};
    let sampleCount = 0;
    const scanEdgeDistance = 10; // Same as above
    
    // Use fine grid (every 2 tiles) to find all cave entrances
    for (let c = scanEdgeDistance; c < this.mapSize - scanEdgeDistance; c += 2) {
      for (let r = scanEdgeDistance; r < this.mapSize - scanEdgeDistance; r += 2) {
        const terrain = Math.floor(this.getTerrain(c, r, 0));
        
        // Sample first 100 tiles to see what terrain values exist
        if (sampleCount < 100) {
          terrainSample[terrain] = (terrainSample[terrain] || 0) + 1;
          sampleCount++;
        }
        
        if (terrain === 6) { // CAVE_ENTRANCE
          caves.push([c, r]);
        }
      }
    }
    
    return caves;
  }
  
  getForestSpawnPoints() {
    const forests = [];
    const minEdgeDistance = 5; // Match boundary padding
    // Use fine grid (every 3 tiles) to catch forest areas while avoiding too many points
    for (let c = minEdgeDistance; c < this.mapSize - minEdgeDistance; c += 3) {
      for (let r = minEdgeDistance; r < this.mapSize - minEdgeDistance; r += 3) {
        const terrain = this.getTerrain(c, r, 0);
        if (terrain >= 1.0 && terrain < 2.0) { // HEAVY_FOREST (1.0-1.99)
          forests.push([c, r]);
        } else if (terrain >= 2.0 && terrain < 3.0) { // LIGHT_FOREST (2.0-2.99)
          forests.push([c, r]);
        }
      }
    }
    return forests;
  }
  
  getHeavyForestSpawnPoints() {
    const heavyForests = [];
    const minEdgeDistance = 5; // Match boundary padding
    // Use fine grid (every 3 tiles) to catch heavy forest areas
    for (let c = minEdgeDistance; c < this.mapSize - minEdgeDistance; c += 3) {
      for (let r = minEdgeDistance; r < this.mapSize - minEdgeDistance; r += 3) {
        const terrain = this.getTerrain(c, r, 0);
        if (terrain >= 1.0 && terrain < 2.0) { // HEAVY_FOREST only (1.0-1.99)
          heavyForests.push([c, r]);
        }
      }
    }
    return heavyForests;
  }
  
  getMountainSpawnPoints() {
    const mountains = [];
    for (let c = 5; c < this.mapSize - 5; c += 3) {
      for (let r = 5; r < this.mapSize - 5; r += 3) {
        const terrain = this.getTerrain(c, r, 0);
        if (terrain >= 4.0 && terrain < 5.0) { // ROCKS (4.0-4.99)
          mountains.push([c, r]);
        } else if (terrain >= 5.0 && terrain < 6.0) { // MOUNTAIN (5.0-5.99)
          mountains.push([c, r]);
        }
      }
    }
    return mountains;
  }
  
  getWaterSpawnPoints() {
    const water = [];
    const minEdgeDistance = 5; // Match boundary padding
    // Use fine grid (every 3 tiles) to find water areas while avoiding too many points
    for (let c = minEdgeDistance; c < this.mapSize - minEdgeDistance; c += 3) {
      for (let r = minEdgeDistance; r < this.mapSize - minEdgeDistance; r += 3) {
        const terrain = this.getTerrain(c, r, 0);
        if (terrain >= 0.0 && terrain < 1.0) { // WATER (0.0-0.99)
          water.push([c, r]);
        }
      }
    }
    
    return water;
  }
  
  getOverworldSpawnPoints() {
    const points = [];
    // Match boundary padding (5 tiles) - evaluation check handles faction-specific safety
    
    // Use fine grid (every 3 tiles) to catch buildable terrain while avoiding too many points
    for (let c = 5; c < this.mapSize - 5; c += 3) {
      for (let r = 5; r < this.mapSize - 5; r += 3) {
        const terrain = this.getTerrain(c, r, 0);
        
        // Include ALL buildable terrain: accept any terrain >= 1.0 (not water)
        // This handles continuous terrain values properly
        if (terrain >= 1.0) {
          points.push([c, r]);
        }
      }
    }
    
    return points;
  }
  
  getBrushFieldSpawnPoints() {
    const points = [];
    // Match boundary padding (5 tiles) - evaluation check handles faction-specific safety
    
    // Use fine grid (every 2 tiles) to find brush field areas
    for (let c = 5; c < this.mapSize - 5; c += 2) {
      for (let r = 5; r < this.mapSize - 5; r += 2) {
        const terrain = this.getTerrain(c, r, 0);
        
        // Look specifically for brush fields (terrain 3.0-3.99)
        if (terrain >= 3.0 && terrain < 4.0) {
          points.push([c, r]);
        }
      }
    }
    
    return points;
  }
  
  getUnderworldSpawnPoints() {
    // Always use TilemapSystem for underworld (more reliable)
    if (global.tilemapSystem && global.tilemapSystem.getSpawnPoints) {
      const allPoints = global.tilemapSystem.getSpawnPoints('underworld');
      
      // Don't pre-filter underground points - evaluation check will handle boundaries
      return allPoints;
    }
    
    // Fallback: scan manually (with edge filtering built-in)
    const points = [];
    const terrainSample = {};
    let sampleCount = 0;
    const minEdgeDistance = 10;
    
    for (let c = minEdgeDistance; c < this.mapSize - minEdgeDistance; c += 5) {
      for (let r = minEdgeDistance; r < this.mapSize - minEdgeDistance; r += 5) {
        const terrain = this.getTerrain(c, r, 1); // Layer 1 = underworld
        
        // Sample terrain values
        if (sampleCount < 50) {
          terrainSample[terrain] = (terrainSample[terrain] || 0) + 1;
          sampleCount++;
        }
        
        if (terrain === 0) { // Cave floor (empty in underworld)
          points.push([c, r]);
        }
      }
    }
    
    return points;
  }
  
  // Find optimal HQ locations for all factions with proper spacing
  findOptimalHQLocations(numFactions, factionProfiles = {}) {
    // Use cached analysis or perform new one
    const candidates = this.analysisCache || this.analyzeMap();
    const selected = [];
    const minDistance = 40; // Minimum tiles between faction HQs
    
    for (const candidate of candidates) {
      if (selected.length >= numFactions) break;
      
      // Check distance from already selected locations
      const tooClose = selected.some(s => 
        this.getDistance(candidate.tile, s.tile) < minDistance
      );
      
      if (!tooClose) {
        selected.push(candidate);
      }
    }
    
    if (selected.length < numFactions) {
      console.warn(`MapAnalyzer: Only found ${selected.length} suitable locations (requested ${numFactions})`);
    }
    
    return selected;
  }
  
  // Find best location matching specific criteria
  findLocationWithCriteria(criteria) {
    const candidates = this.analysisCache || this.analyzeMap();
    
    for (const candidate of candidates) {
      let matches = true;
      
      // Check each criterion
      if (criteria.minFarmland && candidate.score.farmland < criteria.minFarmland) matches = false;
      if (criteria.minForest && candidate.score.forest < criteria.minForest) matches = false;
      if (criteria.minRocks && candidate.score.rocks < criteria.minRocks) matches = false;
      if (criteria.minCaves && candidate.score.caves < criteria.minCaves) matches = false;
      if (criteria.maxWater && candidate.score.water > criteria.maxWater) matches = false;
      
      // Check distance from other locations if specified
      if (criteria.minDistanceFrom) {
        const dist = this.getDistance(candidate.tile, criteria.minDistanceFrom);
        if (dist < (criteria.minDistance || 20)) matches = false;
      }
      
      if (matches) {
        return candidate;
      }
    }
    
    return null;
  }
  
  // Helper: get area around a tile
  getAreaAroundTile(tile, radius) {
    if (global.getArea) {
      return global.getArea(tile, tile, radius);
    }
    
    // Fallback: simple square area
    const area = [];
    for (let c = tile[0] - radius; c <= tile[0] + radius; c++) {
      for (let r = tile[1] - radius; r <= tile[1] + radius; r++) {
        if (c >= 0 && c < this.mapSize && r >= 0 && r < this.mapSize) {
          area.push([c, r]);
        }
      }
    }
    return area;
  }
  
  // Helper: get terrain at tile (supports layers)
  getTerrain(c, r, layer = 0) {
    if (global.getTile) {
      return global.getTile(layer, c, r);
    }
    return layer === -1 ? 0 : 7; // Default: cave floor for underworld, empty for overworld
  }
  
  // Helper: calculate distance
  getDistance(point1, point2) {
    if (global.getDistance) {
      return global.getDistance({x: point1[0], y: point1[1]}, {x: point2[0], y: point2[1]});
    }
    
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Analyze geography and identify terrain features
  analyzeGeography(mapData) {
    if (this.geographicFeatures) {
      return this.geographicFeatures;
    }
    
    const segmentation = new TerrainSegmentation(mapData);
    segmentation.nameGenerator = this.nameGenerator; // Pass NameGenerator
    const features = segmentation.identifyAllFeatures();
    const namedFeatures = this.nameGenerator.assignNames(features);
    
    this.geographicFeatures = namedFeatures;
    
    return namedFeatures;
  }

  // Get geographic features by type
  getFeaturesByType(type) {
    if (!this.geographicFeatures) return [];
    return this.geographicFeatures.filter(feature => feature.type === type);
  }

  // Get geographic feature statistics
  getGeographyStats() {
    if (!this.geographicFeatures) return null;
    
    const stats = {};
    this.geographicFeatures.forEach(feature => {
      if (!stats[feature.type]) {
        stats[feature.type] = { count: 0, totalSize: 0 };
      }
      stats[feature.type].count++;
      stats[feature.type].totalSize += feature.size;
    });
    
    return stats;
  }
}

module.exports = MapAnalyzer;

