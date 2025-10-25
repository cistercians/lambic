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
          }
        }
      }
    }
    
    // Detect adjacent features for compound naming
    this.detectAdjacentFeatures();
    
    // Post-process mountains and rocks into mountain ranges
    this.processMountainRanges();
    
    // Split very large features that span across the map
    this.splitLargeFeatures();
    
    // Detect islands (features completely surrounded by water)
    this.detectIslands();
    
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
        if (this.isSurroundedByLand(tiles)) {
          return { type: 'lake', baseName: 'Lake' };
        }
        return { type: 'water', baseName: 'Water' };
        
      case 1: // HEAVY_FOREST
        if (size < 20) return null; // Reduced from 80
        return { type: 'woods', baseName: 'Woods' };
        
      case 2: // LIGHT_FOREST
        if (size < 15) return null; // Reduced from 50
        return { type: 'forest', baseName: 'Forest' };
        
      case 3: // BRUSH
        if (size < 30) return null; // Reduced from 100
        return { type: 'plains', baseName: 'Plains' };
        
      case 4: // ROCKS
        // Rocks are now used for mountain range detection
        if (size < 10) return null; // Too small to be significant
        return { type: 'rock_base', baseName: 'Rocks' };
        
      case 5: // MOUNTAIN
        if (size < 3) return null; // Too small
        if (size < 8) {
          // Small mountain groups become hills
          return { type: 'hill_peak', baseName: 'Hill' };
        }
        // Larger mountain groups become mountain peaks
        return { type: 'mountain_peak', baseName: 'Mount' };
        
      case 7: // EMPTY/GRASS
        if (size < 20) return null; // Reduced from 50
        return { type: 'meadow', baseName: 'Meadow' };
        
      default:
        return null;
    }
  }

  // Check if water feature is surrounded by land
  isSurroundedByLand(tiles) {
    const bounds = this.calculateBounds(tiles);
    const margin = 2;
    
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
    
    // Consider it a lake if >70% of surrounding tiles are land
    return landCount / totalCount > 0.7;
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
    const bounds1 = feature1.bounds;
    const bounds2 = feature2.bounds;
    
    // Check if bounding boxes are close
    const distance = Math.max(
      Math.max(bounds1.minC - bounds2.maxC, bounds2.minC - bounds1.maxC),
      Math.max(bounds1.minR - bounds2.maxR, bounds2.minR - bounds1.maxR)
    );
    
    return distance <= 2;
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
    
    const mountainPeaks = Array.from(this.features.values()).filter(f => f.type === 'mountain_peak');
    const hillPeaks = Array.from(this.features.values()).filter(f => f.type === 'hill_peak');
    const rockBases = Array.from(this.features.values()).filter(f => f.type === 'rock_base');
    
    // Group mountains that are surrounded by the same rock base
    const mountainRanges = new Map();
    const processedPeaks = new Set();
    const processedRocks = new Set();
    
    for (const peak of mountainPeaks) {
      if (processedPeaks.has(peak.id)) continue;
      
      // Find rock bases that are adjacent to this mountain peak
      const adjacentRocks = rockBases.filter(rock => 
        !processedRocks.has(rock.id) && this.areAdjacent(peak, rock)
      );
      
      if (adjacentRocks.length > 0) {
        // Create a mountain range that includes the peak and all adjacent rocks
        const rangeId = `mountain_range_${peak.id}`;
        const rangeTiles = new Set();
        const rangeTileArray = [];
        
        // Add mountain peak tiles
        peak.tileArray.forEach(tile => {
          rangeTiles.add(`${tile[0]},${tile[1]}`);
          rangeTileArray.push(tile);
        });
        
        // Add rock base tiles
        adjacentRocks.forEach(rock => {
          rock.tileArray.forEach(tile => {
            rangeTiles.add(`${tile[0]},${tile[1]}`);
            rangeTileArray.push(tile);
          });
          processedRocks.add(rock.id);
        });
        
        // Count how many mountain peaks are in this range
        const peaksInRange = mountainPeaks.filter(p => 
          !processedPeaks.has(p.id) && 
          adjacentRocks.some(rock => this.areAdjacent(p, rock))
        );
        
        // Mark all peaks in this range as processed
        peaksInRange.forEach(p => processedPeaks.add(p.id));
        
        // Add additional peaks to the range
        peaksInRange.forEach(peak => {
          peak.tileArray.forEach(tile => {
            rangeTiles.add(`${tile[0]},${tile[1]}`);
            rangeTileArray.push(tile);
          });
        });
        
        // Determine if this is a single mountain or a mountain range
        const isRange = peaksInRange.length > 1;
        const rangeType = isRange ? 'mountain_range' : 'mountain';
        const baseName = isRange ? 'Mountains' : 'Mount';
        
        const mountainRange = {
          id: rangeId,
          type: rangeType,
          baseName: baseName,
          tiles: rangeTiles,
          tileArray: rangeTileArray,
          center: this.calculateCenter(rangeTileArray),
          bounds: this.calculateBounds(rangeTileArray),
          size: rangeTileArray.length,
          peakCount: peaksInRange.length
        };
        
        mountainRanges.set(rangeId, mountainRange);
        
      } else {
        // Single mountain not surrounded by rocks
        peak.type = 'mountain';
        peak.baseName = 'Mount';
        processedPeaks.add(peak.id);
      }
    }
    
    // Remove original mountain peaks and rock bases that were processed
    for (const peakId of processedPeaks) {
      this.features.delete(peakId);
    }
    for (const rockId of processedRocks) {
      this.features.delete(rockId);
    }
    
    // Add the new mountain ranges
    mountainRanges.forEach((range, rangeId) => {
      this.features.set(rangeId, range);
    });
    
    // Now process hills (similar logic to mountains)
    const hillGroups = new Map();
    const processedHills = new Set();
    const processedHillsRocks = new Set();
    
    for (const hill of hillPeaks) {
      if (processedHills.has(hill.id)) continue;
      
      // Find rock bases that are adjacent to this hill peak
      const adjacentRocks = rockBases.filter(rock => 
        !processedHillsRocks.has(rock.id) && this.areAdjacent(hill, rock)
      );
      
      if (adjacentRocks.length > 0) {
        // Create a hill group that includes the hill and all adjacent rocks
        const groupId = `hill_group_${hill.id}`;
        const groupTiles = new Set();
        const groupTileArray = [];
        
        // Add hill peak tiles
        hill.tileArray.forEach(tile => {
          groupTiles.add(`${tile[0]},${tile[1]}`);
          groupTileArray.push(tile);
        });
        
        // Add rock base tiles
        adjacentRocks.forEach(rock => {
          rock.tileArray.forEach(tile => {
            groupTiles.add(`${tile[0]},${tile[1]}`);
            groupTileArray.push(tile);
          });
          processedHillsRocks.add(rock.id);
        });
        
        // Count how many hills are in this group
        const hillsInGroup = hillPeaks.filter(h => 
          !processedHills.has(h.id) && 
          adjacentRocks.some(rock => this.areAdjacent(h, rock))
        );
        
        // Mark all hills in this group as processed
        hillsInGroup.forEach(h => processedHills.add(h.id));
        
        // Add additional hills to the group
        hillsInGroup.forEach(hill => {
          hill.tileArray.forEach(tile => {
            groupTiles.add(`${tile[0]},${tile[1]}`);
            groupTileArray.push(tile);
          });
        });
        
        // Determine if this is a single hill or hill group
        const isGroup = hillsInGroup.length > 1;
        const groupType = isGroup ? 'hill_group' : 'hill';
        const baseName = isGroup ? 'Hills' : 'Hill';
        
        const hillGroup = {
          id: groupId,
          type: groupType,
          baseName: baseName,
          tiles: groupTiles,
          tileArray: groupTileArray,
          center: this.calculateCenter(groupTileArray),
          bounds: this.calculateBounds(groupTileArray),
          size: groupTileArray.length,
          hillCount: hillsInGroup.length
        };
        
        hillGroups.set(groupId, hillGroup);
        
      } else {
        // Single hill not surrounded by rocks
        hill.type = 'hill';
        hill.baseName = 'Hill';
        processedHills.add(hill.id);
      }
    }
    
    // Remove original hill peaks and rock bases that were processed for hills
    for (const hillId of processedHills) {
      this.features.delete(hillId);
    }
    for (const rockId of processedHillsRocks) {
      this.features.delete(rockId);
    }
    
    // Add the new hill groups
    hillGroups.forEach((group, groupId) => {
      this.features.set(groupId, group);
    });
  }

  // Split very large features that span across the map
  splitLargeFeatures() {
    
    const featuresToSplit = Array.from(this.features.values()).filter(feature => {
      // Only split certain types of features
      const splittableTypes = ['sea', 'woods', 'forest', 'mountain_range'];
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
    const mapCenter = this.mapSize / 2;
    
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
      // Split into East and West
      const westTiles = feature.tileArray.filter(tile => tile[0] < mapCenter);
      const eastTiles = feature.tileArray.filter(tile => tile[0] >= mapCenter);
      
      // Only split if BOTH parts meet the minimum threshold
      const westValid = this.isValidSplit(westTiles, feature.type);
      const eastValid = this.isValidSplit(eastTiles, feature.type);
      
      if (westValid && eastValid) {
        const westFeature = this.createSplitFeature(feature, westTiles, 'West', sharedBaseName);
        const eastFeature = this.createSplitFeature(feature, eastTiles, 'East', sharedBaseName);
        splitFeatures.push(westFeature, eastFeature);
      }
    } else {
      // Split into North and South
      const northTiles = feature.tileArray.filter(tile => tile[1] < mapCenter);
      const southTiles = feature.tileArray.filter(tile => tile[1] >= mapCenter);
      
      // Only split if BOTH parts meet the minimum threshold
      const northValid = this.isValidSplit(northTiles, feature.type);
      const southValid = this.isValidSplit(southTiles, feature.type);
      
      if (northValid && southValid) {
        const northFeature = this.createSplitFeature(feature, northTiles, 'North', sharedBaseName);
        const southFeature = this.createSplitFeature(feature, southTiles, 'South', sharedBaseName);
        splitFeatures.push(northFeature, southFeature);
      }
    }
    
    return splitFeatures;
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
        return tiles.length >= 15;
      case 'mountain_range':
        return tiles.length >= 20; // Reasonable minimum for mountain ranges
      default:
        return tiles.length >= 10;
    }
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
    const suffixes = [' Sea', ' Woods', ' Forest', ' Mountains', ' Hills', ' Lake', ' Waters', ' Island'];
    let baseName = feature.name;
    
    for (const suffix of suffixes) {
      if (baseName.endsWith(suffix)) {
        baseName = baseName.slice(0, -suffix.length);
        break;
      }
    }
    
    return baseName;
  }

  // Detect islands (features completely surrounded by water)
  detectIslands() {
    
    const featuresToCheck = Array.from(this.features.values()).filter(feature => {
      // Only check non-water features that could be islands
      return feature.type !== 'sea' && feature.type !== 'water' && 
             feature.size >= 3; // Minimum size for an island
    });
    
    const islands = [];
    const featuresToRemove = [];
    
    for (const feature of featuresToCheck) {
      if (this.isCompletelySurroundedByWater(feature)) {
        // Convert this feature to an island
        const island = this.convertToIsland(feature);
        islands.push(island);
        featuresToRemove.push(feature.id);
      }
    }
    
    // Remove original features and add islands
    featuresToRemove.forEach(featureId => {
      this.features.delete(featureId);
    });
    
    islands.forEach(island => {
      this.features.set(island.id, island);
    });
  }

  // Check if a feature is completely surrounded by water
  isCompletelySurroundedByWater(feature) {
    const bounds = feature.bounds;
    
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
        if (feature.tiles.has(`${c},${r}`)) {
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
