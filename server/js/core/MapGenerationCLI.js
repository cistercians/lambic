// Map Generation CLI Interface
// Provides interactive command-line interface for world generation

const readline = require('readline');
const genesis = require('../genesis');

class MapGenerationCLI {
  constructor() {
    this.rl = null;
    this.terrainEmojis = {
      0: '🟦',  // WATER
      1: '🌲',  // HEAVY_FOREST
      2: '🌿',  // LIGHT_FOREST
      3: '🌿',  // BRUSH
      4: '🪨',  // ROCKS
      5: '🏔️',  // MOUNTAIN
      6: '🕳️'   // CAVE_ENTRANCE
    };
  }

  // Initialize readline interface
  initReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Close readline interface
  closeReadline() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  // Clear screen
  clearScreen() {
    process.stdout.write('\x1B[2J\x1B[0f');
  }

  // Prompt user for input
  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  // Display biome selection menu
  async promptBiomeSelection() {
    this.clearScreen();
    console.log('╔════════════════════════════════════════╗');
    console.log('║     WORLD GENERATION - BIOME TYPE      ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Select a biome type:');
    console.log('  1. Continental (default)');
    console.log('  2. Islands');
    console.log('  3. Mainland');
    console.log('  4. Wild');
    console.log('');

    while (true) {
      const answer = await this.question('Enter your choice (1-4): ');
      const choice = parseInt(answer.trim());
      
      if (choice >= 1 && choice <= 4) {
        const biomeMap = {
          1: 'continental',
          2: 'islands',
          3: 'mainland',
          4: 'wild'
        };
        return biomeMap[choice];
      }
      
      console.log('Invalid choice. Please enter a number between 1 and 4.');
    }
  }

  // Display map size selection menu
  async promptMapSizeSelection() {
    this.clearScreen();
    console.log('╔════════════════════════════════════════╗');
    console.log('║     WORLD GENERATION - MAP SIZE        ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Select a map size:');
    console.log('  1. Base (128×128)');
    console.log('  2. Small (192×192) - 1.5× [default]');
    console.log('  3. Medium (256×256) - 2×');
    console.log('  4. Large (320×320) - 2.5×');
    console.log('  5. Massive (384×384) - 3×');
    console.log('');

    while (true) {
      const answer = await this.question('Enter your choice (1-5, or press Enter for default): ');
      const trimmed = answer.trim();
      
      // If empty, use default (Small, 192×192)
      if (trimmed === '') {
        return 192;
      }
      
      const choice = parseInt(trimmed);
      
      if (choice >= 1 && choice <= 5) {
        const sizeMap = {
          1: 128,
          2: 192,
          3: 256,
          4: 320,
          5: 384
        };
        return sizeMap[choice];
      }
      
      console.log('Invalid choice. Please enter a number between 1 and 5, or press Enter for default.');
    }
  }

  // Generate map with selected configuration
  generateMap(biome, mapSize) {
    const preset = genesis.presets[biome];
    if (!preset) {
      throw new Error(`Invalid biome: ${biome}`);
    }

    const config = {
      ...preset,
      mapSize: mapSize
    };

    console.log('');
    console.log('Generating world...');
    const startTime = Date.now();
    
    const result = genesis.generate(config);
    
    const endTime = Date.now();
    console.log(`World generated in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    console.log('');

    return result;
  }

  // Display map preview
  displayMapPreview(worldMaps) {
    const overworld = worldMaps[0];
    if (!overworld || !overworld[0]) {
      throw new Error('Invalid world map data');
    }

    const mapHeight = overworld.length;
    const mapWidth = overworld[0].length;

    // Get terminal dimensions
    const terminalWidth = process.stdout.columns || 80;
    const terminalHeight = process.stdout.rows || 24;

    // Reserve space for borders, legend, and prompts
    const reservedWidth = 4; // borders
    const reservedHeight = 15; // borders, legend, prompts
    
    const availableWidth = terminalWidth - reservedWidth;
    const availableHeight = terminalHeight - reservedHeight;

    // Calculate scale factor (emojis are typically 2 chars wide, but we'll use 1 for calculation)
    const scaleX = Math.max(1, Math.ceil(mapWidth / availableWidth));
    const scaleY = Math.max(1, Math.ceil(mapHeight / availableHeight));
    const scale = Math.max(scaleX, scaleY);

    // Calculate preview dimensions
    const previewWidth = Math.floor(mapWidth / scale);
    const previewHeight = Math.floor(mapHeight / scale);

    this.clearScreen();
    
    // Calculate actual box width: emojis are typically 2 characters wide in terminals
    // Each emoji takes approximately 2 character positions, so content width is previewWidth * 2
    // Add 2 for the border characters (║ on left and right), then subtract 2 to fine-tune
    const estimatedEmojiWidth = 2; // Emojis typically render as 2 character widths
    const actualContentWidth = previewWidth * estimatedEmojiWidth;
    const boxWidth = Math.min(terminalWidth - 2, actualContentWidth + 2 - 2);
    
    // Header
    console.log('╔' + '═'.repeat(boxWidth) + '╗');
    const titleText = '    WORLD PREVIEW    '; // 4 spaces before and after
    const titleWidth = titleText.length;
    console.log('║' + ' '.repeat(Math.floor((boxWidth - titleWidth) / 2)) + titleText + ' '.repeat(Math.ceil((boxWidth - titleWidth) / 2)) + '║');
    console.log('╠' + '═'.repeat(boxWidth) + '╣');

    // Map preview - print emojis directly next to each other
    for (let py = 0; py < previewHeight; py++) {
      let line = '║';
      for (let px = 0; px < previewWidth; px++) {
        const x = Math.floor(px * scale);
        const y = Math.floor(py * scale);
        
        if (x < mapWidth && y < mapHeight) {
          const tileValue = overworld[y][x];
          // Get base terrain type (remove random variation)
          let terrainType = Math.floor(tileValue);
          // Display cave entrances as mountains
          if (terrainType === 6) { // CAVE_ENTRANCE
            terrainType = 5; // Display as MOUNTAIN
          }
          const emoji = this.terrainEmojis[terrainType] || '🟦';
          line += emoji;
          // Add space after mountain emoji only
          if (terrainType === 5) { // MOUNTAIN
            line += ' ';
          }
        }
      }
      line += '║';
      console.log(line);
    }

    // Footer (use same boxWidth as header)
    console.log('╚' + '═'.repeat(boxWidth) + '╝');
    console.log('');

    // Legend
    console.log('Legend:');
    console.log('  🟦 Water  🌲 Heavy Forest  🌿 Brush  🪨 Rocks  🏔️ Mountain');
    console.log('');
    console.log(`Map Size: ${mapWidth}×${mapHeight} tiles | Preview: ${previewWidth}×${previewHeight} (scale: ${scale}x)`);
    console.log('');
  }

  // Prompt user to accept or reject map
  async promptAcceptReject() {
    while (true) {
      const answer = await this.question('Accept this map? (y/n): ');
      const choice = answer.trim().toLowerCase();
      
      if (choice === 'y' || choice === 'yes') {
        return true;
      } else if (choice === 'n' || choice === 'no') {
        return false;
      }
      
      console.log('Please enter "y" for yes or "n" for no.');
    }
  }

  // Prompt user to retry or restart
  async promptRetryOrRestart() {
    while (true) {
      const answer = await this.question('Retry with same options (r) or restart selection (s)? (r/s): ');
      const choice = answer.trim().toLowerCase();
      
      if (choice === 'r' || choice === 'retry') {
        return 'retry';
      } else if (choice === 's' || choice === 'restart') {
        return 'restart';
      }
      
      console.log('Please enter "r" for retry or "s" for restart.');
    }
  }

  // Prompt user to use defaults or customize
  async promptUseDefaults() {
    this.clearScreen();
    const boxWidth = 38; // Width of the box (number of ═ characters)
    // Title with spacing to match other titles (5 spaces left, 6 spaces right)
    const titleText = '     WORLD GENERATION - SETUP MODE      ';
    
    console.log('╔════════════════════════════════════════╗');
    console.log('║' + titleText + '║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log('Choose setup mode:');
    console.log('  1. Use defaults (Continental, Small 192×192)');
    console.log('  2. Customize settings');
    console.log('  3. Test Map (Continental, 64×64, no preview)');
    console.log('');

    while (true) {
      const answer = await this.question('Enter your choice (1-3): ');
      const choice = parseInt(answer.trim());
      
      if (choice === 1) {
        return 'defaults';
      } else if (choice === 2) {
        return 'customize';
      } else if (choice === 3) {
        return 'test';
      }
      
      console.log('Invalid choice. Please enter 1, 2, or 3.');
    }
  }

  // Main CLI flow
  async run() {
    // Check if CLI should be skipped
    if (process.env.GENESIS_SKIP_CLI === 'true') {
      // Use defaults for automated deployments
      const defaultConfig = {
        ...genesis.presets.continental,
        mapSize: 192
      };
      const result = genesis.generate(defaultConfig);
      return {
        biome: 'continental',
        mapSize: 192,
        worldMaps: result.worldMaps,
        entrances: result.entrances
      };
    }

    this.initReadline();

    try {
      let biome = null;
      let mapSize = null;
      let worldMaps = null;
      let entrances = null;

      // Ask if user wants to use defaults, customize, or test map
      const setupMode = await this.promptUseDefaults();

      // Handle test map option - generate map, show preview, then return without asking for acceptance
      if (setupMode === 'test') {
        console.log('');
        console.log('Generating test map (Continental, 64×64)...');
        const startTime = Date.now();
        
        // Get continental preset
        const preset = genesis.presets.continental;
        if (!preset) {
          throw new Error('Continental preset not found');
        }
        
        // Calculate scale factor for reverse-scaling frequencies
        // This ensures 64×64 maps use the same frequencies as 128×128 maps
        const BASE_MAP_SIZE = 128;
        const testMapSize = 64;
        const scaleFactor = testMapSize / BASE_MAP_SIZE;
        
        // Create config with reverse-scaled frequencies (same approach as Battlegrounds)
        const config = {
          ...preset,
          mapSize: testMapSize,
          // Reverse-scale frequencies so they match base 128×128 values after genesis applies its scaling
          redFrequencyX: preset.redFrequencyX / scaleFactor,
          redFrequencyY: preset.redFrequencyY / scaleFactor,
          greenFrequencyX: preset.greenFrequencyX / scaleFactor,
          greenFrequencyY: preset.greenFrequencyY / scaleFactor,
          blueFrequencyX: preset.blueFrequencyX / scaleFactor,
          blueFrequencyY: preset.blueFrequencyY / scaleFactor
          // Note: Amplitudes and offsets are NOT scaled by genesis, so we keep them as-is
        };
        
        const result = genesis.generate(config);
        const endTime = Date.now();
        console.log(`Test map generated in ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
        console.log('');
        
        // Display preview
        try {
          this.displayMapPreview(result.worldMaps);
        } catch (error) {
          console.error('Error displaying preview:', error.message);
          // Continue anyway - preview is not critical
        }
        
        this.closeReadline();
        
        return {
          biome: 'continental',
          mapSize: testMapSize,
          worldMaps: result.worldMaps,
          entrances: result.entrances
        };
      }

      if (setupMode === 'defaults') {
        // Use default values: Continental biome, Small (192×192) size
        biome = 'continental';
        mapSize = 192;
      }

      while (true) {
        // Get biome selection (if not already selected or restarting)
        if (!biome) {
          biome = await this.promptBiomeSelection();
        }

        // Get map size selection (if not already selected or restarting)
        if (!mapSize) {
          mapSize = await this.promptMapSizeSelection();
        }

        // Generate map
        try {
          const result = this.generateMap(biome, mapSize);
          worldMaps = result.worldMaps;
          entrances = result.entrances;
        } catch (error) {
          console.error('Error generating map:', error.message);
          const retryChoice = await this.promptRetryOrRestart();
          if (retryChoice === 'restart') {
            biome = null;
            mapSize = null;
          }
          continue;
        }

        // Display preview
        try {
          this.displayMapPreview(worldMaps);
        } catch (error) {
          console.error('Error displaying preview:', error.message);
          // Continue anyway - preview is not critical
        }

        // Prompt for acceptance
        const accepted = await this.promptAcceptReject();

        if (accepted) {
          break;
        }

        // User rejected - ask to retry or restart
        const retryChoice = await this.promptRetryOrRestart();
        if (retryChoice === 'restart') {
          biome = null;
          mapSize = null;
        }
        // If retry, keep biome and mapSize and regenerate
      }

      this.closeReadline();

      return {
        biome: biome,
        mapSize: mapSize,
        worldMaps: worldMaps,
        entrances: entrances
      };

    } catch (error) {
      this.closeReadline();
      throw error;
    }
  }
}

module.exports = new MapGenerationCLI();
