/**
 * BattlegroundsMapGenerator - Generates and validates battleground maps
 */

const genesis = require('../genesis');
const BattlegroundsMapValidator = require('./BattlegroundsMapValidator');

class BattlegroundsMapGenerator {
  constructor() {
    this.mapTypes = ['continental', 'islands', 'mainland', 'wild', 'caves', 'dungeons'];
    this.validator = new BattlegroundsMapValidator();
    this.maxGenerationAttempts = 10; // Maximum attempts to generate a valid map
  }

  /**
   * Generate a battleground map
   * @param {string} gameMode - Game mode ('deathmatch', 'skirmish', 'assault')
   * @param {number} mapSize - Map size (64, 80, or 96)
   * @returns {Promise<object>} Map data
   */
  async generateBattlegroundMap(gameMode, mapSize) {
    // Select random map type (excluding Islands for Deathmatch/Skirmish)
    const availableTypes = this.getAvailableMapTypes(gameMode);
    
    // Try to generate a valid map (up to maxGenerationAttempts)
    for (let attempt = 0; attempt < this.maxGenerationAttempts; attempt++) {
      const mapType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      
      // Generate map using genesis - this uses the FULL genesis process:
      // 1. SimplexNoise generation with configurable parameters
      // 2. Noise converted to HSV color space
      // 3. Terraform function converts noise to overworld terrain tiles
      // 4. Underworld initialized (all walls/blocked)
      // 5. Cave entrances identified
      // 6. Random walk cave generation (geoform) from each entrance
      // 7. Entrance/exit tiles added
      // 8. Resources added to overworld and underworld
      const config = this.getMapConfig(mapType, mapSize);
      const result = genesis.generate(config);
      
      // Genesis returns {worldMaps: [...], entrances: [...]}
      // worldMaps is the array structure [layer][row][col] where:
      // [0] = Overworld, [1] = Underworld, [2] = Underwater, [3-8] = Building/Resource layers
      const worldData = result.worldMaps || result;
      const entrances = result.entrances || [];
      
      // For dungeon maps, initialize z=-2 (cellar layer) as all walls instead of using cave generation
      // Buildings will be placed first, then tunnels will be generated from building cellars
      if (mapType === 'dungeons') {
        // Initialize cellar layer as all walls (value 1)
        // We'll store it at index 9 in the worldData array
        const cellarLayer = this.initializeDungeonCellarLayer(mapSize);
        worldData[9] = cellarLayer;
      }
      
      // Determine starting z-level based on map type
      let startingZ = 0;
      if (mapType === 'caves') {
        startingZ = -1; // Start in caves/underworld
      } else if (mapType === 'dungeons') {
        startingZ = -2; // Start in dungeons/cellar
      }
      
      const mapData = {
        mapType: mapType,
        mapSize: mapSize,
        worldData: worldData,
        entrances: entrances, // Store cave entrances for potential use in post-processing
        startingZ: startingZ,
        raw: true // Indicates this needs post-processing (starting areas, lighting, etc.)
      };
      
      // Validate the map
      const validation = this.validator.validateMap(mapData, gameMode);
      if (validation.valid) {
        console.log(`Generated valid battleground map (attempt ${attempt + 1}): ${mapType} for ${gameMode}`);
        return mapData;
      } else {
        console.warn(`Generated invalid map (attempt ${attempt + 1}): ${validation.reason}`);
      }
    }
    
    // If we've exhausted all attempts, generate one anyway (better than failing completely)
    // In practice, most maps should be valid, so this is a fallback
    console.warn(`Failed to generate valid map after ${this.maxGenerationAttempts} attempts, using last generated map`);
    const mapType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const config = this.getMapConfig(mapType, mapSize);
    const result = genesis.generate(config);
    const worldData = result.worldMaps || result;
    const entrances = result.entrances || [];
    
    // For dungeon maps, initialize z=-2 (cellar layer) as all walls
    if (mapType === 'dungeons') {
      const cellarLayer = this.initializeDungeonCellarLayer(mapSize);
      worldData[9] = cellarLayer;
    }
    
    let startingZ = 0;
    if (mapType === 'caves') {
      startingZ = -1; // Start in caves/underworld
    } else if (mapType === 'dungeons') {
      startingZ = -2; // Start in dungeons/cellar
    }
    
    return {
      mapType: mapType,
      mapSize: mapSize,
      worldData: worldData,
      entrances: entrances,
      startingZ: startingZ,
      raw: true
    };
  }

  /**
   * Initialize dungeon cellar layer as all walls (value 1)
   * @param {number} mapSize - Map size
   * @returns {Array} Cellar layer initialized to all walls
   */
  initializeDungeonCellarLayer(mapSize) {
    const cellarLayer = [];
    for (let y = 0; y < mapSize; y++) {
      cellarLayer[y] = [];
      for (let x = 0; x < mapSize; x++) {
        cellarLayer[y][x] = 1; // All walls initially
      }
    }
    return cellarLayer;
  }

  /**
   * Map z-level to worldData array index for battlegrounds
   * For dungeon maps, z=-2 maps to worldData[9] (cellar layer)
   * @param {number} z - Z-level
   * @param {string} mapType - Map type
   * @returns {number} Array index in worldData
   */
  static getWorldDataIndex(z, mapType) {
    if (mapType === 'dungeons' && z === -2) {
      // For dungeon maps, z=-2 (cellar) is stored at index 9
      return 9;
    }
    // Standard mapping: z=0 -> 0, z=-1 -> 1, z=-3 -> 2
    if (z === 0) return 0;
    if (z === -1) return 1;
    if (z === -3) return 2;
    // Default to overworld for other z-levels
    return 0;
  }

  /**
   * Get available map types for a game mode
   */
  getAvailableMapTypes(gameMode) {
    if (gameMode === 'deathmatch' || gameMode === 'skirmish') {
      // All except Islands
      return this.mapTypes.filter(t => t !== 'islands');
    } else if (gameMode === 'assault') {
      // Continental, Mainland, Islands
      return ['continental', 'mainland', 'islands'];
    }
    return this.mapTypes;
  }

  /**
   * Get map configuration for genesis
   * Uses the same presets as the main world generation
   * IMPORTANT: For battlegrounds, we use the base 128x128 frequency values
   * without scaling, so that terrain features maintain the same scale/proportions
   * regardless of map size (64x64, 80x80, 96x96)
   */
  getMapConfig(mapType, mapSize) {
    const genesis = require('../genesis');
    const presets = genesis.presets || {};
    
    // Map 'caves' and 'dungeons' to their base presets (they're custom variations)
    // Caves uses mainland preset, Dungeons can use wild or mainland
    const presetMapType = mapType === 'caves' ? 'mainland' : 
                          mapType === 'dungeons' ? 'wild' : mapType;
    
    // Get the preset configuration for the map type (same as main world generation)
    const preset = presets[presetMapType];
    
    if (!preset) {
      console.warn(`No preset found for map type '${mapType}' (mapped to '${presetMapType}'), using default configuration`);
      return {
        mapSize: mapSize
      };
    }
    
    // For battlegrounds, we want to use the base 128x128 frequency values
    // without scaling. Genesis normally scales frequencies by (mapSize / 128),
    // but we want consistent feature sizes across all battleground map sizes.
    // 
    // To achieve this, we need to "reverse-scale" the frequencies:
    // If genesis will multiply by (mapSize/128), we pre-divide by that to cancel it out.
    // This ensures the final frequencies match the base 128x128 values.
    const BASE_MAP_SIZE = 128;
    const scaleFactor = mapSize / BASE_MAP_SIZE;
    
    // Create config with reverse-scaled frequencies (so they end up at base values after genesis scaling)
    const config = {
      ...preset,
      mapSize: mapSize,
      // Reverse-scale frequencies so they match base 128x128 values after genesis applies its scaling
      redFrequencyX: preset.redFrequencyX / scaleFactor,
      redFrequencyY: preset.redFrequencyY / scaleFactor,
      greenFrequencyX: preset.greenFrequencyX / scaleFactor,
      greenFrequencyY: preset.greenFrequencyY / scaleFactor,
      blueFrequencyX: preset.blueFrequencyX / scaleFactor,
      blueFrequencyY: preset.blueFrequencyY / scaleFactor
      // Note: Amplitudes and offsets are NOT scaled by genesis, so we keep them as-is
    };
    
    return config;
  }
}

module.exports = BattlegroundsMapGenerator;


