/**
 * BattlegroundsMapLibrary - Stores, retrieves, and manages Classic Maps for battlegrounds
 * Classic Maps are saved maps that can be reused across matches
 */

const fs = require('fs');
const path = require('path');

class BattlegroundsMapLibrary {
  constructor() {
    this.mapsDirectory = path.join(__dirname, '../../data/battlegrounds_maps');
    this.classicMaps = {}; // In-memory cache: {mapId: mapData}
    this.ensureMapsDirectory();
    this.loadClassicMaps();
  }

  /**
   * Ensure the maps directory exists
   */
  ensureMapsDirectory() {
    try {
      if (!fs.existsSync(this.mapsDirectory)) {
        fs.mkdirSync(this.mapsDirectory, { recursive: true });
        console.log(`Created battlegrounds maps directory: ${this.mapsDirectory}`);
      }
    } catch (error) {
      console.error('Error creating maps directory:', error);
    }
  }

  /**
   * Load all classic maps from disk into memory
   */
  loadClassicMaps() {
    try {
      if (!fs.existsSync(this.mapsDirectory)) {
        console.log('Maps directory does not exist, skipping load');
        return;
      }

      const files = fs.readdirSync(this.mapsDirectory);
      let loadedCount = 0;

      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.mapsDirectory, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const mapData = JSON.parse(fileContent);
            
            // Extract map ID from filename (remove .json extension)
            const mapId = file.replace('.json', '');
            this.classicMaps[mapId] = mapData;
            loadedCount++;
          } catch (error) {
            console.error(`Error loading map file ${file}:`, error);
          }
        }
      });

    } catch (error) {
      console.error('Error loading classic maps:', error);
    }
  }

  /**
   * Save a map as a Classic Map
   * @param {string} mapId - Unique map ID
   * @param {object} mapData - Map data to save (worldData, mapType, mapSize, etc.)
   * @param {object} metadata - Additional metadata (gameMode, postProcessing, etc.)
   * @returns {boolean} Success
   */
  saveClassicMap(mapId, mapData, metadata = {}) {
    try {
      const mapToSave = {
        mapId: mapId,
        worldData: mapData.worldData,
        mapType: mapData.mapType,
        mapSize: mapData.mapSize,
        entrances: mapData.entrances || [],
        startingZ: mapData.startingZ || 0,
        metadata: {
          createdAt: Date.now(),
          createdBy: metadata.createdBy || 'system',
          gameMode: metadata.gameMode || null,
          postProcessing: metadata.postProcessing || null, // Store game mode-specific post-processing info
          votes: metadata.votes || 0, // Track popularity (legacy, for backward compatibility)
          positiveVotes: metadata.positiveVotes || 0, // Counter for positive votes (incremented when 100% of players vote positively)
          timesPlayed: metadata.timesPlayed || 0,
          ...metadata
        }
      };

      // Save to disk
      const filePath = path.join(this.mapsDirectory, `${mapId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(mapToSave, null, 2), 'utf8');

      // Update in-memory cache
      this.classicMaps[mapId] = mapToSave;

      console.log(`Saved classic map: ${mapId}`);
      return true;
    } catch (error) {
      console.error(`Error saving classic map ${mapId}:`, error);
      return false;
    }
  }

  /**
   * Get a classic map by ID
   * @param {string} mapId - Map ID
   * @returns {object|null} Map data or null if not found
   */
  getClassicMap(mapId) {
    return this.classicMaps[mapId] || null;
  }

  /**
   * Check if a map type is compatible with a game mode
   * @param {string} mapType - Map type ('continental', 'islands', etc.)
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @returns {boolean} True if compatible
   */
  isMapTypeCompatible(mapType, gameMode) {
    // Deathmatch and Skirmish: All map types except Islands
    if (gameMode === 'deathmatch' || gameMode === 'skirmish') {
      return mapType !== 'islands';
    }
    // Assault: Continental, Mainland, Islands only
    if (gameMode === 'assault') {
      return ['continental', 'mainland', 'islands'].includes(mapType);
    }
    // Unknown game mode: assume all types are compatible
    return true;
  }

  /**
   * Get all classic maps
   * @param {string} gameMode - Optional filter by game mode
   * @param {number} mapSize - Optional filter by map size (64, 80, or 96)
   * @returns {Array} Array of map data objects
   */
  getAllClassicMaps(gameMode = null, mapSize = null) {
    let maps = Object.values(this.classicMaps);

    if (gameMode) {
      maps = maps.filter(map => {
        // Check map type compatibility with game mode
        if (!this.isMapTypeCompatible(map.mapType, gameMode)) {
          return false;
        }
        
        // Map can be used for a game mode if:
        // 1. It was created for that game mode, OR
        // 2. It has no game mode specified (can be used for any compatible mode)
        return !map.metadata.gameMode || map.metadata.gameMode === gameMode;
      });
    }

    if (mapSize !== null && mapSize !== undefined) {
      maps = maps.filter(map => {
        // Map must match the required size
        return map.mapSize === mapSize;
      });
    }

    return maps;
  }

  /**
   * Get a random classic map for a game mode and map size using weighted selection
   * Weight is based on positiveVotes counter - maps with higher ratings are prioritized
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @param {number} mapSize - Map size (64, 80, or 96)
   * @returns {object|null} Random map data or null if none available
   */
  getRandomClassicMap(gameMode, mapSize) {
    const availableMaps = this.getAllClassicMaps(gameMode, mapSize);
    
    if (availableMaps.length === 0) {
      return null;
    }

    // Weighted random selection based on positiveVotes counter
    // Higher rated maps (more positiveVotes) have higher weight and are more likely to be selected
    // Base weight is 1, and we add the positiveVotes count to prioritize highly rated maps
    const weightedMaps = availableMaps.map(map => {
      const positiveVotes = (map.metadata.positiveVotes || 0);
      const weight = 1 + positiveVotes; // Base weight of 1, plus positiveVotes (so a map with 5 positive votes has weight 6)
      return { map, weight };
    });

    const totalWeight = weightedMaps.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weightedMaps) {
      random -= item.weight;
      if (random <= 0) {
        return item.map;
      }
    }

    // Fallback to first map (shouldn't happen, but safety)
    return availableMaps[0];
  }

  /**
   * Check if a classic map is available for the given game mode and map size
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @param {number} mapSize - Map size (64, 80, or 96)
   * @returns {boolean} True if at least one matching map exists
   */
  hasClassicMap(gameMode, mapSize) {
    const availableMaps = this.getAllClassicMaps(gameMode, mapSize);
    return availableMaps.length > 0;
  }

  /**
   * Increment play count for a classic map
   * @param {string} mapId - Map ID
   */
  incrementPlayCount(mapId) {
    const map = this.classicMaps[mapId];
    if (map) {
      map.metadata.timesPlayed = (map.metadata.timesPlayed || 0) + 1;
      this.saveClassicMap(mapId, map, map.metadata); // Re-save to disk
    }
  }

  /**
   * Increment vote count for a classic map (legacy method, for backward compatibility)
   * @param {string} mapId - Map ID
   */
  incrementVoteCount(mapId) {
    const map = this.classicMaps[mapId];
    if (map) {
      map.metadata.votes = (map.metadata.votes || 0) + 1;
      this.saveClassicMap(mapId, map, map.metadata); // Re-save to disk
    }
  }

  /**
   * Increment positive vote counter for a classic map
   * Called when 100% of human players vote positively on a Classic Map
   * @param {string} mapId - Map ID
   */
  incrementPositiveVotes(mapId) {
    const map = this.classicMaps[mapId];
    if (map) {
      map.metadata.positiveVotes = (map.metadata.positiveVotes || 0) + 1;
      this.saveClassicMap(mapId, map, map.metadata); // Re-save to disk
      console.log(`Incremented positive votes for Classic Map ${mapId} (now: ${map.metadata.positiveVotes})`);
    }
  }

  /**
   * Delete a classic map
   * @param {string} mapId - Map ID
   * @returns {boolean} Success
   */
  deleteClassicMap(mapId) {
    try {
      // Remove from disk
      const filePath = path.join(this.mapsDirectory, `${mapId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from memory
      delete this.classicMaps[mapId];

      console.log(`Deleted classic map: ${mapId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting classic map ${mapId}:`, error);
      return false;
    }
  }

  /**
   * Generate a unique map ID
   * @param {string} gameMode - Game mode
   * @param {string} mapType - Map type
   * @returns {string} Unique map ID
   */
  generateMapId(gameMode, mapType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `classic_${gameMode}_${mapType}_${timestamp}_${random}`;
  }

  /**
   * Get map statistics
   * @returns {object} Statistics about the map library
   */
  getStatistics() {
    const maps = Object.values(this.classicMaps);
    return {
      totalMaps: maps.length,
      byGameMode: {
        deathmatch: maps.filter(m => m.metadata.gameMode === 'deathmatch').length,
        skirmish: maps.filter(m => m.metadata.gameMode === 'skirmish').length,
        assault: maps.filter(m => m.metadata.gameMode === 'assault').length,
        any: maps.filter(m => !m.metadata.gameMode).length
      },
      byMapType: {
        continental: maps.filter(m => m.mapType === 'continental').length,
        islands: maps.filter(m => m.mapType === 'islands').length,
        mainland: maps.filter(m => m.mapType === 'mainland').length,
        wild: maps.filter(m => m.mapType === 'wild').length,
        caves: maps.filter(m => m.mapType === 'caves').length,
        dungeons: maps.filter(m => m.mapType === 'dungeons').length
      },
      totalPlays: maps.reduce((sum, m) => sum + (m.metadata.timesPlayed || 0), 0),
      totalVotes: maps.reduce((sum, m) => sum + (m.metadata.votes || 0), 0),
      totalPositiveVotes: maps.reduce((sum, m) => sum + (m.metadata.positiveVotes || 0), 0)
    };
  }
}

module.exports = BattlegroundsMapLibrary;

