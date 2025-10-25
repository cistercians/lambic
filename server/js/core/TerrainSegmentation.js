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
            }
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
        if (size < 8) {
          // Small mountain groups become hills
          return { type: 'hill_peak', baseName: 'Hill' };
        }
        // Larger mountain groups become mountain peaks
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
    const mountainPeaks = Array.from(this.features.values()).filter(f => f.type === 'mountain_peak');
    const hillPeaks = Array.from(this.features.values()).filter(f => f.type === 'hill_peak');
    
    const processedPeaks = new Set();
    
    // Process mountain peaks
    for (const peak of mountainPeaks) {
      if (processedPeaks.has(peak.id)) continue;
      
      // Find adjacent rock tiles around this mountain peak
      const adjacentRockTiles = this.findAdjacentRockTiles(peak);
      
      if (adjacentRockTiles.length > 0) {
        // Find other mountain peaks that share the same rock base
        const connectedPeaks = mountainPeaks.filter(p => 
          !processedPeaks.has(p.id) && 
          this.peaksShareRockBase(p, peak, adjacentRockTiles)
        );
        
        // Create mountain range or single mountain
        if (connectedPeaks.length > 1) {
          this.createMountainRange([peak, ...connectedPeaks], adjacentRockTiles);
        } else {
          this.createSingleMountain(peak, adjacentRockTiles);
        }
        
        // Mark all connected peaks as processed
        connectedPeaks.forEach(p => processedPeaks.add(p.id));
        processedPeaks.add(peak.id);
      } else {
        // No adjacent rocks - create standalone mountain
        this.createSingleMountain(peak, []);
      }
    }
    
    // Process hill peaks
    for (const peak of hillPeaks) {
      if (processedPeaks.has(peak.id)) continue;
      
      // Find adjacent rock tiles around this hill peak
      const adjacentRockTiles = this.findAdjacentRockTiles(peak);
      
      if (adjacentRockTiles.length > 0) {
        // Find other hill peaks that share the same rock base
        const connectedPeaks = hillPeaks.filter(p => 
          !processedPeaks.has(p.id) && 
          this.peaksShareRockBase(p, peak, adjacentRockTiles)
        );
        
        // Create hill group or single hill
        if (connectedPeaks.length > 1) {
          this.createHillGroup([peak, ...connectedPeaks], adjacentRockTiles);
        } else {
          this.createSingleHill(peak, adjacentRockTiles);
        }
        
        // Mark all connected peaks as processed
        connectedPeaks.forEach(p => processedPeaks.add(p.id));
        processedPeaks.add(peak.id);
      } else {
        // No adjacent rocks - create standalone hill
        this.createSingleHill(peak, []);
      }
    }
    
    // Remove original mountain_peak and hill_peak features
    mountainPeaks.forEach(peak => this.features.delete(peak.id));
    hillPeaks.forEach(peak => this.features.delete(peak.id));
  }

  // Find rock tiles adjacent to a peak feature using flood-fill
  findAdjacentRockTiles(peak) {
    const rockTiles = [];
    const visited = new Set();
    const queue = [];
    
    // Start flood-fill from each peak tile
    for (const [c, r] of peak.tileArray) {
      // Check all 8 directions around each peak tile
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;
          
          const checkC = c + dc;
          const checkR = r + dr;
          const tileKey = `${checkC},${checkR}`;
          
          if (visited.has(tileKey)) continue;
          visited.add(tileKey);
          
          // Check if this tile is rock terrain
          const terrain = this.getTile(checkC, checkR);
          if (terrain === 4) { // ROCKS
            rockTiles.push([checkC, checkR]);
            queue.push([checkC, checkR]); // Add to queue for further expansion
          }
        }
      }
    }
    
    // Continue flood-fill from discovered rock tiles
    while (queue.length > 0) {
      const [currentC, currentR] = queue.shift();
      
      // Check all 8 directions around current rock tile
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (dc === 0 && dr === 0) continue;
          
          const checkC = currentC + dc;
          const checkR = currentR + dr;
          const tileKey = `${checkC},${checkR}`;
          
          if (visited.has(tileKey)) continue;
          visited.add(tileKey);
          
          // Check if this tile is rock terrain
          const terrain = this.getTile(checkC, checkR);
          if (terrain === 4) { // ROCKS
            rockTiles.push([checkC, checkR]);
            queue.push([checkC, checkR]); // Continue expanding
          }
        }
      }
    }
    
    return rockTiles;
  }

  // Check if two peaks share the same rock base
  peaksShareRockBase(peak1, peak2, rockTiles) {
    // Check if peak2 is within reasonable distance of peak1
    const maxDistance = 15; // Maximum distance between peaks sharing rock base
    
    for (const [c1, r1] of peak1.tileArray) {
      for (const [c2, r2] of peak2.tileArray) {
        const distance = Math.sqrt(Math.pow(c1 - c2, 2) + Math.pow(r1 - r2, 2));
        if (distance <= maxDistance) {
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
