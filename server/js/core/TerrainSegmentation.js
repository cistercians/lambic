// Terrain Segmentation System
// Intelligent terrain feature detection and classification

class TerrainSegmentation {
  constructor(mapData) {
    this.mapData = mapData;
    this.mapSize = mapData.length;
    this.features = new Map();
    this.visited = new Set();
    this.nameGenerator = null; // Will be set by MapAnalyzer
  }

  // Main method to identify all terrain features
  identifyAllFeatures() {
    this.features.clear();
    this.visited.clear();
    
    let featureId = 1;
    
    // Scan entire map for unvisited tiles
    for (let c = 0; c < this.mapSize; c++) {
      for (let r = 0; r < this.mapSize; r++) {
        const key = `${c},${r}`;
        
        if (this.visited.has(key)) continue;
        
        const rawTerrainType = this.getTile(c, r);
        const terrainType = Math.floor(rawTerrainType);
        
        const tiles = this.identifyFeature([c, r], rawTerrainType);
        
        if (tiles.length > 0) {
          // Check if this feature is completely surrounded by water (island detection)
          if (this.isCompletelySurroundedByWater(tiles)) {
            const feature = this.convertToIsland({ tileArray: tiles, id: `temp_${featureId++}` });
            if (feature) {
              feature.id = `feature_${featureId++}`;
              feature.tiles = new Set(tiles.map(tile => `${tile[0]},${tile[1]}`));
              feature.tileArray = tiles;
              feature.center = this.calculateCenter(tiles);
              feature.bounds = this.calculateBounds(tiles);
              feature.size = tiles.length;
              
              this.features.set(feature.id, feature);
              
              // Mark all tiles as visited
              tiles.forEach(tile => {
                this.visited.add(`${tile[0]},${tile[1]}`);
              });
            }
          } else {
            // Normal terrain classification
            const feature = this.classifyFeature(tiles, terrainType);
            
            if (feature) {
              feature.id = `feature_${featureId++}`;
              feature.tiles = new Set(tiles.map(tile => `${tile[0]},${tile[1]}`));
              feature.tileArray = tiles; // Keep array for calculations
              feature.center = this.calculateCenter(tiles);
              feature.bounds = this.calculateBounds(tiles);
              feature.size = tiles.length;
              
              this.features.set(feature.id, feature);
              
              // Mark all tiles as visited
              tiles.forEach(tile => {
                this.visited.add(`${tile[0]},${tile[1]}`);
              });
            } else {
              // Feature is too small - mark tiles as visited but don't create a zone
              // These will be filled in later by fillDeadZones()
              tiles.forEach(tile => {
                this.visited.add(`${tile[0]},${tile[1]}`);
              });
            }
          }
        }
      }
    }
    
    // Detect adjacent features for compound naming
    this.detectAdjacentFeatures();
    
    // Fill dead zones by assigning small features to surrounding zones
    this.fillDeadZones();
    
    // Post-process mountains and rocks into mountain ranges (after all features are created)
    this.processMountainRanges();
    
    // Split very large features that span across the map
    this.splitLargeFeatures();
    
    return Array.from(this.features.values());
  }

  // Flood-fill algorithm to identify contiguous terrain
  identifyFeature(startTile, terrainType) {
    const visited = new Set();
    const tiles = [];
    const queue = [startTile];
    
    // Normalize terrain type to integer for comparison
    const normalizedTerrainType = Math.floor(terrainType);
    
    while (queue.length > 0) {
      const [c, r] = queue.shift();
      const key = `${c},${r}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      // Use Math.floor() to normalize terrain values for comparison
      if (Math.floor(this.getTile(c, r)) === normalizedTerrainType) {
        tiles.push([c, r]);
        
        // Add adjacent tiles (4-directional)
        const adjacent = [
          [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]
        ];
        
        adjacent.forEach(([nc, nr]) => {
          if (nc >= 0 && nc < this.mapSize && nr >= 0 && nr < this.mapSize) {
            queue.push([nc, nr]);
          }
        });
      }
    }
    
    return tiles;
  }

  // Classify feature based on terrain type and size
  classifyFeature(tiles, terrainType) {
    const size = tiles.length;
    
    // Skip very small features
    if (size < 5) return null;
    
    switch (terrainType) {
      case 0: // WATER
        if (size < 10) return null; // Too small
        if (size > this.mapSize * this.mapSize * 0.05) { // Reduced from 0.2 to 0.05 (5% of map)
          return { type: 'sea', baseName: 'Sea' };
        }
        // Lakes: medium to large water bodies (50+ tiles) OR surrounded by land
        if (size >= 50 || this.isSurroundedByLand(tiles)) {
          return { type: 'lake', baseName: 'Lake' };
        }
        // Waters: smaller water bodies (25-49 tiles)
        if (size >= 25) {
          return { type: 'water', baseName: 'Water' };
        }
        // Waters: very small water bodies (10-24 tiles)
        return { type: 'waters', baseName: 'Waters' };
        
      case 1: // HEAVY_FOREST
        if (size < 20) return null; // Reduced from 80
        return { type: 'woods', baseName: 'Woods' };
        
      case 2: // LIGHT_FOREST
        if (size < 15) return null; // Reduced from 50
        return { type: 'forest', baseName: 'Forest' };
        
      case 3: // BRUSH
        if (size < 50) return null; // Increased from 30 to reduce small patches
        return { type: 'plains', baseName: 'Plains' };
        
      case 4: // ROCKS
        // Rocks are only valid when part of mountain/hill systems
        // Standalone rock patches should be ignored
        return null; // Don't create standalone rock features
        
      case 5: // MOUNTAIN
        if (size < 3) return null; // Too small
        // All mountain groups become mountain_peak initially
        // Hills will be determined later during mountain processing
        return { type: 'mountain_peak', baseName: 'Mount' };
        
      case 7: // EMPTY/GRASS
        if (size < 20) return null; // Reduced from 50
        return null; // Remove meadows entirely
        
      default:
        return null;
    }
  }

  // Check if water feature is surrounded by land
  isSurroundedByLand(tiles) {
    const bounds = this.calculateBounds(tiles);
    const margin = 1; // Reduced from 2 to allow lakes closer to edges
    
    // Check if feature is near map edges (likely not a lake)
    if (bounds.minC < margin || bounds.maxC >= this.mapSize - margin ||
        bounds.minR < margin || bounds.maxR >= this.mapSize - margin) {
      return false;
    }
    
    // Check surrounding tiles for land
    let landCount = 0;
    let totalCount = 0;
    
    for (let c = bounds.minC - 1; c <= bounds.maxC + 1; c++) {
      for (let r = bounds.minR - 1; r <= bounds.maxR + 1; r++) {
        if (c < 0 || c >= this.mapSize || r < 0 || r >= this.mapSize) continue;
        
        const tileType = this.getTile(c, r);
        totalCount++;
        
        // Check if this tile is not part of our water feature
        const isPartOfFeature = tiles.some(tile => tile[0] === c && tile[1] === r);
        if (!isPartOfFeature && tileType !== 0) {
          landCount++;
        }
      }
    }
    
    // Consider it a lake if >50% of surrounding tiles are land (reduced from 70%)
    return landCount / totalCount > 0.5;
  }

  // Calculate center point of feature
  calculateCenter(tiles) {
    let totalX = 0, totalY = 0;
    
    tiles.forEach(([c, r]) => {
      totalX += c;
      totalY += r;
    });
    
    return [
      Math.floor(totalX / tiles.length),
      Math.floor(totalY / tiles.length)
    ];
  }

  // Calculate bounding box of feature
  calculateBounds(tiles) {
    let minC = Infinity, maxC = -Infinity;
    let minR = Infinity, maxR = -Infinity;
    
    tiles.forEach(([c, r]) => {
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    });
    
    return { minC, maxC, minR, maxR };
  }

  // Calculate both center and bounds for a feature
  calculateCentroidAndBounds(tiles) {
    const centroid = this.calculateCenter(tiles);
    const bounds = this.calculateBounds(tiles);
    
    return {
      centroid: centroid,
      bounds: bounds
    };
  }

  // Detect features that are adjacent to each other
  detectAdjacentFeatures() {
    const features = Array.from(this.features.values());
    
    for (let i = 0; i < features.length; i++) {
      for (let j = i + 1; j < features.length; j++) {
        const feature1 = features[i];
        const feature2 = features[j];
        
        if (this.areAdjacent(feature1, feature2)) {
          if (!feature1.adjacentFeatures) feature1.adjacentFeatures = [];
          if (!feature2.adjacentFeatures) feature2.adjacentFeatures = [];
          
          feature1.adjacentFeatures.push(feature2.id);
          feature2.adjacentFeatures.push(feature1.id);
        }
      }
    }
  }

  // Check if two features are adjacent (within 2 tiles)
  areAdjacent(feature1, feature2) {
    // Check if features actually share border tiles (more precise than bounding box)
    for (const tile1 of feature1.tileArray) {
      for (const tile2 of feature2.tileArray) {
        const [c1, r1] = tile1;
        const [c2, r2] = tile2;
        
        // Check if tiles are adjacent (including diagonally)
        const deltaC = Math.abs(c1 - c2);
        const deltaR = Math.abs(r1 - r2);
        
        if (deltaC <= 1 && deltaR <= 1 && (deltaC + deltaR) > 0) {
          return true; // Found adjacent tiles
        }
      }
    }
    
    return false;
  }

  // Get tile type at coordinates
  getTile(c, r) {
    if (c < 0 || c >= this.mapSize || r < 0 || r >= this.mapSize) {
      return -1; // Out of bounds
    }
    // Use global getTile function if available, otherwise fallback to mapData
    if (global.getTile) {
      const terrain = global.getTile(0, c, r); // Layer 0 = overworld
      return terrain;
    }
    return this.mapData[r][c];
  }

  // Get all features of a specific type
  getFeaturesByType(type) {
    return Array.from(this.features.values()).filter(f => f.type === type);
  }

  // Process mountains, hills, and rocks into mountain ranges and hill groups
  processMountainRanges() {
    // First, find all rock formations on the map
    const rockFormations = this.findRockFormations();
    
    // Get all existing mountain_peak features
    const mountainPeaks = Array.from(this.features.values()).filter(f => f.type === 'mountain_peak');
    
    // Separate mountains into proper mountains and hills based on size
    const properMountains = mountainPeaks.filter(peak => peak.size >= 8);
    const hills = mountainPeaks.filter(peak => peak.size < 8);
    
    // Track which peaks have been processed
    const processedPeaks = new Set();
    
    // Process each rock formation
    for (const rockFormation of rockFormations) {
      // Find proper mountains that are within or adjacent to this rock formation
      const properMountainsInFormation = properMountains.filter(peak => 
        !processedPeaks.has(peak.id) && 
        this.isMountainPeakInRockFormation(peak, rockFormation)
      );
      
      // Find hills that are within or adjacent to this rock formation
      const hillsInFormation = hills.filter(peak => 
        !processedPeaks.has(peak.id) && 
        this.isMountainPeakInRockFormation(peak, rockFormation)
      );
      
      const allPeaksInFormation = [...properMountainsInFormation, ...hillsInFormation];
      
      if (allPeaksInFormation.length === 0) {
        // No mountains or hills in this rock formation - leave these tiles unzoned for dead zone filling
        // Don't delete from visited - let dead zone filler handle them
        continue;
      } else if (allPeaksInFormation.length === 1) {
        // Single peak - create mountain or hill based on size
        const peak = allPeaksInFormation[0];
        if (peak.size >= 8) {
          this.createMountainFromPeak(peak, rockFormation);
        } else {
          this.createHillFromPeak(peak, rockFormation);
        }
        processedPeaks.add(peak.id);
      } else {
        // Multiple peaks - check if we have mountains, hills, or mixed
        const hasMountains = properMountainsInFormation.length > 0;
        const hasHills = hillsInFormation.length > 0;
        
        if (hasMountains && hasHills) {
          // Mixed mountains and hills - create mountain range (mountains take precedence)
          this.createMountainRangeFromPeaks(allPeaksInFormation, rockFormation);
        } else if (hasMountains) {
          // Only mountains - create mountain range
          this.createMountainRangeFromPeaks(properMountainsInFormation, rockFormation);
        } else {
          // Only hills - create hill cluster
          this.createHillClusterFromPeaks(hillsInFormation, rockFormation);
        }
        
        allPeaksInFormation.forEach(peak => processedPeaks.add(peak.id));
      }
    }
    
    // Handle any peaks that weren't matched to rock formations
    const unmatchedPeaks = mountainPeaks.filter(peak => !processedPeaks.has(peak.id));
    
    for (const peak of unmatchedPeaks) {
      // Create standalone mountain or hill without rock base based on size
      if (peak.size >= 8) {
        this.createMountainFromPeak(peak, []);
      } else {
        this.createHillFromPeak(peak, []);
      }
    }
    
    // Remove original mountain_peak features
    const mountainPeaksToRemove = Array.from(this.features.values()).filter(f => f.type === 'mountain_peak');
    
    mountainPeaksToRemove.forEach(peak => this.features.delete(peak.id));
  }

  // Find all rock formations on the map
  findRockFormations() {
    const rockFormations = [];
    const visited = new Set();
    
    // Scan the map for rock tiles
    for (let r = 0; r < this.mapSize; r++) {
      for (let c = 0; c < this.mapSize; c++) {
        const tileKey = `${c},${r}`;
        
        if (visited.has(tileKey)) continue;
        
        const terrain = Math.floor(this.getTile(c, r));
        if (terrain === 4) { // ROCKS
          // Found a rock tile - flood-fill to find the entire rock formation
          const rockFormation = this.floodFillRockFormation([c, r], visited);
          if (rockFormation.length > 0) {
            rockFormations.push(rockFormation);
          }
        }
      }
    }
    
    return rockFormations;
  }

  // Flood-fill to find a complete rock formation
  floodFillRockFormation(startTile, visited) {
    const rockFormation = [];
    const queue = [startTile];
    
    while (queue.length > 0) {
      const [c, r] = queue.shift();
      const tileKey = `${c},${r}`;
      
      if (visited.has(tileKey)) continue;
      visited.add(tileKey);
      
      const terrain = Math.floor(this.getTile(c, r));
      if (terrain === 4) { // ROCKS
        rockFormation.push([c, r]);
        
        // Check all 8 directions for more rock tiles
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (dc === 0 && dr === 0) continue;
            
            const checkC = c + dc;
            const checkR = r + dr;
            const checkKey = `${checkC},${checkR}`;
            
            if (checkC >= 0 && checkC < this.mapSize && 
                checkR >= 0 && checkR < this.mapSize && 
                !visited.has(checkKey)) {
              queue.push([checkC, checkR]);
            }
          }
        }
      }
    }
    
    return rockFormation;
  }

  // Check if a mountain peak is within or adjacent to a rock formation
  isMountainPeakInRockFormation(peak, rockFormation) {
    const rockSet = new Set(rockFormation.map(tile => `${tile[0]},${tile[1]}`));
    
    for (const [c, r] of peak.tileArray) {
      // Check if mountain tile is within rock formation
      if (rockSet.has(`${c},${r}`)) {
        return true;
      }
      
      // Check if mountain tile is adjacent to rock formation
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;
          
          const checkC = c + dc;
          const checkR = r + dr;
          if (rockSet.has(`${checkC},${checkR}`)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  // Create a hill from a peak and its rock base
  createHillFromPeak(peak, rockFormation) {
    const hillId = `hill_${Date.now()}_${Math.random()}`;
    const allTiles = [...peak.tileArray, ...rockFormation];
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const hill = {
      id: hillId,
      type: 'hill',
      baseName: 'Hill',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(hillId, hill);
    
    // Ensure all tiles are marked as visited to prevent double-assignment
    allTiles.forEach(tile => {
      const tileKey = `${tile[0]},${tile[1]}`;
      this.visited.add(tileKey);
    });
  }

  // Create a hill cluster from multiple hill peaks and their shared rock base
  createHillClusterFromPeaks(peaks, rockFormation) {
    const clusterId = `hill_cluster_${Date.now()}_${Math.random()}`;
    const allTiles = [...rockFormation];
    
    // Add all hill peaks
    peaks.forEach(peak => {
      allTiles.push(...peak.tileArray);
    });
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const hillCluster = {
      id: clusterId,
      type: 'hill_cluster',
      baseName: 'Hills',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(clusterId, hillCluster);
    
    // Ensure all tiles are marked as visited to prevent double-assignment
    allTiles.forEach(tile => {
      const tileKey = `${tile[0]},${tile[1]}`;
      this.visited.add(tileKey);
    });
  }

  // Create a mountain range from multiple peaks and their shared rock base
  createMountainRangeFromPeaks(peaks, rockFormation) {
    const rangeId = `mountain_range_${Date.now()}_${Math.random()}`;
    const allTiles = [...rockFormation];
    
    // Add all mountain peaks
    peaks.forEach(peak => {
      allTiles.push(...peak.tileArray);
    });
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountainRange = {
      id: rangeId,
      type: 'mountain_range',
      baseName: 'Mountains',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(rangeId, mountainRange);
    
    // Ensure all tiles are marked as visited to prevent double-assignment
    allTiles.forEach(tile => {
      const tileKey = `${tile[0]},${tile[1]}`;
      this.visited.add(tileKey);
    });
  }

  // Find adjacent rock tiles using flood-fill
  findAdjacentRockTiles(mountainTiles) {
    const rockTiles = [];
    const visited = new Set();
    
    // Start flood-fill from each mountain tile
    for (const [c, r] of mountainTiles) {
      const queue = [[c, r]];
      
      while (queue.length > 0) {
        const [currentC, currentR] = queue.shift();
        const tileKey = `${currentC},${currentR}`;
        
        if (visited.has(tileKey)) continue;
        visited.add(tileKey);
        
        const terrain = Math.floor(this.getTile(currentC, currentR));
        if (terrain === 4) { // ROCKS
          rockTiles.push([currentC, currentR]);
          
          // Check all 8 directions for more rock tiles
          for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              if (dc === 0 && dr === 0) continue;
              
              const checkC = currentC + dc;
              const checkR = currentR + dr;
              const checkKey = `${checkC},${checkR}`;
              
              if (checkC >= 0 && checkC < this.mapSize && 
                  checkR >= 0 && checkR < this.mapSize && 
                  !visited.has(checkKey)) {
                queue.push([checkC, checkR]);
              }
            }
          }
        }
      }
    }
    
    return rockTiles;
  }

  // Create a mountain from a peak and its rock base
  createMountainFromPeak(peak, rockTiles) {
    const mountainId = `mountain_${Date.now()}_${Math.random()}`;
    const allTiles = [...peak.tileArray, ...rockTiles];
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountain = {
      id: mountainId,
      type: 'mountain',
      baseName: 'Mount',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(mountainId, mountain);
    
    // Ensure all tiles are marked as visited to prevent double-assignment
    allTiles.forEach(tile => {
      const tileKey = `${tile[0]},${tile[1]}`;
      this.visited.add(tileKey);
    });
  }

  // Create a mountain from a rock formation and mountain group
  createMountainFromRockFormation(rockFormation, mountainGroup) {
    const mountainId = `mountain_${Date.now()}_${Math.random()}`;
    const allTiles = [...rockFormation, ...mountainGroup];
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountain = {
      id: mountainId,
      type: 'mountain',
      baseName: 'Mount',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(mountainId, mountain);
  }

  // Create a mountain range from a rock formation and multiple mountain groups
  createMountainRangeFromRockFormation(rockFormation, mountainGroups) {
    const rangeId = `mountain_range_${Date.now()}_${Math.random()}`;
    const allTiles = [...rockFormation];
    
    // Add all mountain groups
    mountainGroups.forEach(group => {
      allTiles.push(...group);
    });
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountainRange = {
      id: rangeId,
      type: 'mountain_range',
      baseName: 'Mountains',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(rangeId, mountainRange);
  }

  // Check if two peaks share the same rock base
  peaksShareRockBase(peak1, peak2, rockTiles) {
    // Check if peak2 is within reasonable distance of peak1
    const maxDistance = 20; // Increased from 15
    
    // First check if peaks are close enough
    let peaksClose = false;
    for (const [c1, r1] of peak1.tileArray) {
      for (const [c2, r2] of peak2.tileArray) {
        const distance = Math.sqrt(Math.pow(c1 - c2, 2) + Math.pow(r1 - r2, 2));
        if (distance <= maxDistance) {
          peaksClose = true;
          break;
        }
      }
      if (peaksClose) break;
    }
    
    if (!peaksClose) return false;
    
    // Check if peak2 is adjacent to any of the rock tiles around peak1
    for (const [c2, r2] of peak2.tileArray) {
      for (const [rockC, rockR] of rockTiles) {
        const distance = Math.sqrt(Math.pow(c2 - rockC, 2) + Math.pow(r2 - rockR, 2));
        if (distance <= 3) { // Peak2 is close to rock base of peak1
          return true;
        }
      }
    }
    
    return false;
  }

  // Create a mountain range (multiple peaks with shared rock base)
  createMountainRange(peaks, rockTiles) {
    const rangeId = `mountain_range_${peaks[0].id}`;
    const allTiles = [];
    
    // Add all peak tiles
    peaks.forEach(peak => {
      allTiles.push(...peak.tileArray);
    });
    
    // Add rock tiles
    allTiles.push(...rockTiles);
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountainRange = {
      id: rangeId,
      type: 'mountain_range',
      baseName: 'Mountains',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(rangeId, mountainRange);
  }

  // Create a single mountain (one peak with rock base)
  createSingleMountain(peak, rockTiles) {
    const mountainId = `mountain_${peak.id}`;
    const allTiles = [...peak.tileArray, ...rockTiles];
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const mountain = {
      id: mountainId,
      type: 'mountain',
      baseName: 'Mount',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(mountainId, mountain);
  }

  // Create a hill group (multiple hill peaks with shared rock base)
  createHillGroup(peaks, rockTiles) {
    const groupId = `hill_group_${peaks[0].id}`;
    const allTiles = [];
    
    // Add all peak tiles
    peaks.forEach(peak => {
      allTiles.push(...peak.tileArray);
    });
    
    // Add rock tiles
    allTiles.push(...rockTiles);
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const hillGroup = {
      id: groupId,
      type: 'hill_group',
      baseName: 'Hills',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(groupId, hillGroup);
  }

  // Create a single hill (one peak with rock base)
  createSingleHill(peak, rockTiles) {
    const hillId = `hill_${peak.id}`;
    const allTiles = [...peak.tileArray, ...rockTiles];
    
    const bounds = this.calculateCentroidAndBounds(allTiles);
    
    const hill = {
      id: hillId,
      type: 'hill',
      baseName: 'Hill',
      tileArray: allTiles,
      tiles: new Set(allTiles.map(tile => `${tile[0]},${tile[1]}`)),
      size: allTiles.length,
      center: bounds.centroid,
      bounds: bounds.bounds,
      name: null // Will be set by name generator
    };
    
    this.features.set(hillId, hill);
  }

  // Split very large features that span across the map
  splitLargeFeatures() {
    
    const featuresToSplit = Array.from(this.features.values()).filter(feature => {
      // Only split certain types of features
      const splittableTypes = ['sea', 'woods', 'forest', 'mountain_range', 'plains'];
      return splittableTypes.includes(feature.type) && this.shouldSplitFeature(feature);
    });
    
    for (const feature of featuresToSplit) {
      const splitFeatures = this.splitFeature(feature);
      if (splitFeatures.length > 1) {
        // Remove original feature
        this.features.delete(feature.id);
        
        // Add split features
        splitFeatures.forEach(splitFeature => {
          this.features.set(splitFeature.id, splitFeature);
        });
      }
    }
  }

  // Fill dead zones by assigning unzoned tiles to surrounding zones
  fillDeadZones() {
    const unzonedTiles = [];
    
    // Find all tiles that aren't part of any zone
    for (let r = 0; r < this.mapSize; r++) {
      for (let c = 0; c < this.mapSize; c++) {
        const tileKey = `${c},${r}`;
        
        // Check if this tile is part of any existing zone
        let isPartOfZone = false;
        for (const [zoneId, zone] of this.features) {
          if (zone.tiles && zone.tiles.has(tileKey)) {
            isPartOfZone = true;
            break;
          }
        }
        
        if (!isPartOfZone) {
          unzonedTiles.push([c, r]);
        }
      }
    }
    
    // Group unzoned tiles into contiguous patches
    const unzonedPatches = this.groupUnzonedTiles(unzonedTiles);
    
    // Assign each patch to the nearest zone
    for (const patch of unzonedPatches) {
      this.assignPatchToNearestZone(patch);
    }
  }

  // Group unzoned tiles into contiguous patches
  groupUnzonedTiles(unzonedTiles) {
    const patches = [];
    const visited = new Set();
    
    for (const tile of unzonedTiles) {
      const tileKey = `${tile[0]},${tile[1]}`;
      if (visited.has(tileKey)) continue;
      
      // Use flood-fill to find contiguous patch
      const patch = this.floodFillPatch(tile, visited);
      if (patch.length > 0) {
        patches.push(patch);
      }
    }
    
    return patches;
  }

  // Flood-fill to find contiguous patch of unzoned tiles
  floodFillPatch(startTile, visited) {
    const patch = [];
    const queue = [startTile];
    
    while (queue.length > 0) {
      const [c, r] = queue.shift();
      const tileKey = `${c},${r}`;
      
      if (visited.has(tileKey)) continue;
      visited.add(tileKey);
      patch.push([c, r]);
      
      // Check 4 directions for adjacent unzoned tiles
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dc, dr] of directions) {
        const newC = c + dc;
        const newR = r + dr;
        const newKey = `${newC},${newR}`;
        
        if (newC >= 0 && newC < this.mapSize && 
            newR >= 0 && newR < this.mapSize && 
            !visited.has(newKey)) {
          
          // Check if this tile is also unzoned
          let isPartOfZone = false;
          for (const [zoneId, zone] of this.features) {
            if (zone.tiles && zone.tiles.has(newKey)) {
              isPartOfZone = true;
              break;
            }
          }
          
          if (!isPartOfZone) {
            queue.push([newC, newR]);
          }
        }
      }
    }
    
    return patch;
  }

  // Assign a patch of unzoned tiles to the nearest zone
  assignPatchToNearestZone(patch) {
    if (patch.length === 0) return;
    
    // First, check if this patch is completely surrounded by a single zone
    const surroundingZone = this.findCompletelySurroundingZone(patch);
    if (surroundingZone) {
      this.assignPatchToZone(patch, surroundingZone);
      return;
    }
    
    // If not completely surrounded, find zones that actually touch this patch
    const touchingZones = this.findTouchingZones(patch);
    
    if (touchingZones.length === 0) {
      // No touching zones found - leave as dead zone
      return;
    }
    
    // Filter out water zones if patch contains non-water tiles
    const patchTerrainType = this.getTile(patch[0][0], patch[0][1]);
    const isWaterPatch = patchTerrainType === 0;
    
    let validZones = touchingZones;
    if (!isWaterPatch) {
      // Non-water patches cannot be assigned to water zones
      validZones = touchingZones.filter(zone => 
        zone.type !== 'sea' && zone.type !== 'lake' && 
        zone.type !== 'water' && zone.type !== 'waters'
      );
    }
    
    if (validZones.length === 0) {
      // No valid zones found - leave as dead zone
      return;
    }
    
    // Assign to the zone with the most touching tiles
    let bestZone = validZones[0];
    let maxTouchingTiles = 0;
    
    for (const zone of validZones) {
      const touchingTiles = this.countTouchingTiles(patch, zone);
      if (touchingTiles > maxTouchingTiles) {
        maxTouchingTiles = touchingTiles;
        bestZone = zone;
      }
    }
    
    this.assignPatchToZone(patch, bestZone);
  }

  // Find zone that completely surrounds the patch
  findCompletelySurroundingZone(patch) {
    const patchBounds = this.calculateBounds(patch);
    
    for (const [zoneId, zone] of this.features) {
      const zoneBounds = zone.bounds;
      
      // Check if patch is completely within zone bounds (with 1-tile margin)
      const isCompletelySurrounded = 
        patchBounds.minC >= zoneBounds.minC - 1 &&
        patchBounds.maxC <= zoneBounds.maxC + 1 &&
        patchBounds.minR >= zoneBounds.minR - 1 &&
        patchBounds.maxR <= zoneBounds.maxR + 1;
      
      if (isCompletelySurrounded) {
        // Double-check that patch is actually surrounded by zone tiles
        let surroundedCount = 0;
        for (const [c, r] of patch) {
          const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
          let hasAdjacentZoneTile = false;
          
          for (const [dc, dr] of directions) {
            const checkC = c + dc;
            const checkR = r + dr;
            const checkKey = `${checkC},${checkR}`;
            
            if (zone.tiles && zone.tiles.has(checkKey)) {
              hasAdjacentZoneTile = true;
              break;
            }
          }
          
          if (hasAdjacentZoneTile) {
            surroundedCount++;
          }
        }
        
        // If most patch tiles are adjacent to this zone, consider it surrounded
        if (surroundedCount >= patch.length * 0.8) {
          return zone;
        }
      }
    }
    
    return null;
  }

  // Find zones that actually touch the patch
  findTouchingZones(patch) {
    const touchingZones = [];
    
    for (const [zoneId, zone] of this.features) {
      let touchesPatch = false;
      
      for (const [c, r] of patch) {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dc, dr] of directions) {
          const checkC = c + dc;
          const checkR = r + dr;
          const checkKey = `${checkC},${checkR}`;
          
          if (zone.tiles && zone.tiles.has(checkKey)) {
            touchesPatch = true;
            break;
          }
        }
        if (touchesPatch) break;
      }
      
      if (touchesPatch) {
        touchingZones.push(zone);
      }
    }
    
    return touchingZones;
  }

  // Count how many patch tiles are touching the zone
  countTouchingTiles(patch, zone) {
    let touchingCount = 0;
    
    for (const [c, r] of patch) {
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dc, dr] of directions) {
        const checkC = c + dc;
        const checkR = r + dr;
        const checkKey = `${checkC},${checkR}`;
        
        if (zone.tiles && zone.tiles.has(checkKey)) {
          touchingCount++;
          break; // Count each patch tile only once
        }
      }
    }
    
    return touchingCount;
  }

  // Assign patch to a specific zone
  assignPatchToZone(patch, zone) {
    // Add patch tiles to the zone
    patch.forEach(tile => {
      const tileKey = `${tile[0]},${tile[1]}`;
      
      // Safety check: don't assign tiles that are already part of another zone
      if (this.visited.has(tileKey)) {
        return;
      }
      
      zone.tiles.add(tileKey);
      zone.tileArray.push(tile);
      // Mark tile as visited to prevent double-assignment
      this.visited.add(tileKey);
    });
    
    // Update zone properties
    zone.size = zone.tileArray.length;
    zone.center = this.calculateCenter(zone.tileArray);
    zone.bounds = this.calculateBounds(zone.tileArray);
  }

  // Check if a feature should be split
  shouldSplitFeature(feature) {
    const bounds = feature.bounds;
    const mapCenter = this.mapSize / 2;
    
    // Check if feature spans across map center (either horizontally or vertically)
    const spansHorizontally = bounds.minC < mapCenter && bounds.maxC > mapCenter;
    const spansVertically = bounds.minR < mapCenter && bounds.maxR > mapCenter;
    
    // Only split if it spans significantly across the map
    const horizontalSpan = bounds.maxC - bounds.minC;
    const verticalSpan = bounds.maxR - bounds.minR;
    const significantSpan = Math.max(horizontalSpan, verticalSpan) > this.mapSize * 0.4; // 40% of map
    
    return (spansHorizontally || spansVertically) && significantSpan;
  }

  // Split a feature into multiple parts
  splitFeature(feature) {
    const bounds = feature.bounds;
    
    // Determine split direction (prefer the direction with larger span)
    const horizontalSpan = bounds.maxC - bounds.minC;
    const verticalSpan = bounds.maxR - bounds.minR;
    
    let splitDirection;
    if (horizontalSpan > verticalSpan) {
      splitDirection = 'horizontal'; // Split into East/West
    } else {
      splitDirection = 'vertical'; // Split into North/South
    }
    
    // Generate a shared base name for all split features
    let sharedBaseName;
    if (feature.name) {
      sharedBaseName = this.extractBaseNameFromFeature(feature);
    } else {
      sharedBaseName = this.generateBaseNameForType(feature.type);
    }
    
    const splitFeatures = [];
    
    if (splitDirection === 'horizontal') {
      // Find optimal split point for horizontal split
      const optimalSplit = this.findOptimalSplitPoint(feature.tileArray, 'horizontal', feature.type);
      
      if (optimalSplit) {
        const westFeature = this.createSplitFeature(feature, optimalSplit.westTiles, 'West', sharedBaseName);
        const eastFeature = this.createSplitFeature(feature, optimalSplit.eastTiles, 'East', sharedBaseName);
        splitFeatures.push(westFeature, eastFeature);
      }
    } else {
      // Find optimal split point for vertical split
      const optimalSplit = this.findOptimalSplitPoint(feature.tileArray, 'vertical', feature.type);
      
      if (optimalSplit) {
        const northFeature = this.createSplitFeature(feature, optimalSplit.northTiles, 'North', sharedBaseName);
        const southFeature = this.createSplitFeature(feature, optimalSplit.southTiles, 'South', sharedBaseName);
        splitFeatures.push(northFeature, southFeature);
      }
    }
    
    return splitFeatures;
  }

  // Find the optimal split point that creates balanced sub-features
  findOptimalSplitPoint(tiles, direction, featureType) {
    const bounds = this.calculateBounds(tiles);
    
    if (direction === 'horizontal') {
      // Try different split points along the horizontal axis
      for (let splitX = bounds.minC + 1; splitX < bounds.maxC; splitX++) {
        const westTiles = tiles.filter(tile => tile[0] < splitX);
        const eastTiles = tiles.filter(tile => tile[0] >= splitX);
        
        // Check if both parts meet minimum requirements
        const westValid = this.isValidSplit(westTiles, featureType);
        const eastValid = this.isValidSplit(eastTiles, featureType);
        
        if (westValid && eastValid) {
          // Check if ratio is acceptable (between 1:1 and 1:1.5)
          const ratioValid = this.isValidSizeRatio(westTiles.length, eastTiles.length);
          
          if (ratioValid) {
            return {
              westTiles: westTiles,
              eastTiles: eastTiles,
              splitPoint: splitX
            };
          }
        }
      }
    } else {
      // Try different split points along the vertical axis
      for (let splitY = bounds.minR + 1; splitY < bounds.maxR; splitY++) {
        const northTiles = tiles.filter(tile => tile[1] < splitY);
        const southTiles = tiles.filter(tile => tile[1] >= splitY);
        
        // Check if both parts meet minimum requirements
        const northValid = this.isValidSplit(northTiles, featureType);
        const southValid = this.isValidSplit(southTiles, featureType);
        
        if (northValid && southValid) {
          // Check if ratio is acceptable (between 1:1 and 1:1.5)
          const ratioValid = this.isValidSizeRatio(northTiles.length, southTiles.length);
          
          if (ratioValid) {
            return {
              northTiles: northTiles,
              southTiles: southTiles,
              splitPoint: splitY
            };
          }
        }
      }
    }
    
    return null; // No valid split point found
  }

  // Check if a split portion is valid (meets minimum size requirements)
  isValidSplit(tiles, featureType) {
    if (tiles.length < 5) return false; // Too small
    
    // Apply same size thresholds as original classification
    switch (featureType) {
      case 'sea':
        return tiles.length > this.mapSize * this.mapSize * 0.05; // 5% of map
      case 'woods':
        return tiles.length >= 20;
      case 'forest':
        return tiles.length >= 25; // Increased from 15 for more meaningful splits
      case 'mountain_range':
        return tiles.length >= 20; // Reasonable minimum for mountain ranges
      case 'plains':
        return tiles.length >= 50; // Match increased classification threshold
      case 'lake':
        return false; // Lakes should not be split
      case 'water':
        return false; // Waters should not be split
      case 'waters':
        return false; // Waters should not be split
      default:
        return tiles.length >= 10;
    }
  }

  // Check if the size ratio between two parts is balanced (between 1:1 and 1:1.5)
  isValidSizeRatio(size1, size2) {
    if (size1 === 0 || size2 === 0) return false;
    
    // Calculate ratio (always put larger number on top)
    const larger = Math.max(size1, size2);
    const smaller = Math.min(size1, size2);
    const ratio = larger / smaller;
    
    // Ratio should be between 1:1 (1.0) and 1:1.5 (1.5)
    return ratio <= 1.5;
  }

  // Create a split feature with directional prefix
  createSplitFeature(originalFeature, tiles, direction, sharedBaseName) {
    const splitId = `${originalFeature.id}_${direction.toLowerCase()}`;
    
    // Use the shared base name passed from splitFeature
    const baseName = sharedBaseName;
    
    // Create the split name with directional prefix
    let splitName = `${direction} ${baseName}`;
    
    // Add the appropriate suffix based on feature type
    switch (originalFeature.type) {
      case 'sea':
        splitName += ' Sea';
        break;
      case 'woods':
        splitName += ' Woods';
        break;
      case 'forest':
        splitName += ' Forest';
        break;
      case 'mountain_range':
        splitName += ' Mountains';
        break;
      case 'plains':
        splitName += ' Plains';
        break;
      default:
        // Keep original suffix if any
        break;
    }
    
    return {
      id: splitId,
      type: originalFeature.type,
      baseName: originalFeature.baseName,
      name: splitName,
      tiles: new Set(tiles.map(tile => `${tile[0]},${tile[1]}`)),
      tileArray: tiles,
      center: this.calculateCenter(tiles),
      bounds: this.calculateBounds(tiles),
      size: tiles.length,
      originalFeature: originalFeature.id
    };
  }

  // Generate a base name for a feature type when no name exists
  generateBaseNameForType(featureType) {
    // Use NameGenerator if available, otherwise fallback
    if (this.nameGenerator) {
      return this.nameGenerator.getRandomName();
    }
    // Fallback to a generic name if NameGenerator not available
    return `Feature${Math.floor(Math.random() * 1000)}`;
  }

  // Extract base name from a feature (helper method)
  extractBaseNameFromFeature(feature) {
    if (!feature.name) return 'Unknown';
    
    // Remove common suffixes to get base name
    const suffixes = [' Sea', ' Woods', ' Forest', ' Mountains', ' Hills', ' Lake', ' Water', ' Waters', ' Island'];
    let baseName = feature.name;
    
    for (const suffix of suffixes) {
      if (baseName.endsWith(suffix)) {
        baseName = baseName.slice(0, -suffix.length);
        break;
      }
    }
    
    return baseName;
  }

  // Check if a feature is completely surrounded by water
  isCompletelySurroundedByWater(tiles) {
    const bounds = this.calculateBounds(tiles);
    
    // Expand bounds by 1 tile in each direction to check surroundings
    const checkBounds = {
      minC: Math.max(0, bounds.minC - 1),
      maxC: Math.min(this.mapSize - 1, bounds.maxC + 1),
      minR: Math.max(0, bounds.minR - 1),
      maxR: Math.min(this.mapSize - 1, bounds.maxR + 1)
    };
    
    // Check all tiles around the feature
    for (let r = checkBounds.minR; r <= checkBounds.maxR; r++) {
      for (let c = checkBounds.minC; c <= checkBounds.maxC; c++) {
        // Skip tiles that are part of the feature itself
        const isPartOfFeature = tiles.some(tile => tile[0] === c && tile[1] === r);
        if (isPartOfFeature) {
          continue;
        }
        
        // Check if this surrounding tile is water
        const terrainType = this.getTile(c, r);
        if (terrainType !== 0) { // 0 = water
          // Found a non-water tile adjacent to the feature
          return false;
        }
      }
    }
    
    return true;
  }

  // Convert a feature to an island
  convertToIsland(feature) {
    const islandId = `island_${feature.id}`;
    
    // Generate island name using NameGenerator
    let islandName;
    if (feature.name) {
      // Extract base name and add "Island" suffix
      const baseName = this.extractBaseNameFromFeature(feature);
      islandName = `${baseName} Island`;
    } else {
      // Generate a proper name using NameGenerator
      if (this.nameGenerator) {
        const baseName = this.nameGenerator.getRandomName();
        islandName = `${baseName} Island`;
      } else {
        // Fallback to generic name if NameGenerator not available
        islandName = `Island${Math.floor(Math.random() * 1000)}`;
      }
    }
    
    return {
      id: islandId,
      type: 'island',
      baseName: 'Island',
      name: islandName,
      tiles: feature.tiles,
      tileArray: feature.tileArray,
      center: feature.center,
      bounds: feature.bounds,
      size: feature.size,
      originalType: feature.type, // Keep track of what it was originally
      originalFeature: feature.id
    };
  }

  // Get feature statistics
  getStats() {
    const stats = {};
    this.features.forEach(feature => {
      if (!stats[feature.type]) {
        stats[feature.type] = { count: 0, totalSize: 0 };
      }
      stats[feature.type].count++;
      stats[feature.type].totalSize += feature.size;
    });
    return stats;
  }
}

module.exports = TerrainSegmentation;

