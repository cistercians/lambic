/**
 * BuildingCommand - Handles /build [building] commands
 * 
 * Consolidated building command that handles ALL building types.
 * Uses BuildingPreview for validation and BuildingConstruction for construction.
 * Replaces thousands of lines of repetitive building code in Commands.js.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class BuildingCommand {
  constructor() {
    this.name = 'build';
  }

  /**
   * Execute the build command
   * @param {object} data - Command data { cmd, id, world, overrideC, overrideR }
   * @returns {boolean} Success
   */
  execute(data) {
    try {
      // Try entityRegistry first, fall back to legacy Player.list
      let player = null;
      try {
        player = entityRegistry.getEntity('players', data.id);
      } catch (e) {
        // Fall back to legacy system if entityRegistry fails
        if (global.Player && global.Player.list) {
          player = global.Player.list[data.id];
        }
      }
      
      // If still no player, try legacy system directly
      if (!player && global.Player && global.Player.list) {
        player = global.Player.list[data.id];
      }
      
      if (!player) {
        return false;
      }

      const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
      if (!socket) {
        return false;
      }

    // Handle /build (list buildings)
    const parts = data.cmd.split(' ');
    if (parts.length < 2 || data.cmd === 'build') {
      return this.listBuildings(player, socket);
    }

    // Handle /build [building type]

    const buildingType = parts.slice(1).join(' ').toLowerCase();
    const z = player.z;

    // Must be on ground level for most buildings
    if (z !== 0) {
      this.sendError(socket, 'You can only build on the ground level.');
      return true; // Command was handled, just failed validation
    }

    // Get building preview system
    const buildingPreview = systemRegistry.get('buildingPreview') || global.buildingPreview;
    if (!buildingPreview) {
      this.sendError(socket, 'Building system not available.');
      return true; // Command was handled, just failed validation
    }

    // Get building definition
    let buildingDef;
    try {
      buildingDef = buildingPreview.getBuildingDefinition(buildingType);
    } catch (error) {
      this.sendError(socket, `Error: Unable to get building definition for ${buildingType}`);
      return true; // Command was handled, just failed validation
    }
    
    if (!buildingDef) {
      this.sendError(socket, `Unknown building type: ${buildingType}`);
      return true; // Command was handled, just failed validation
    }

    // Get location
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y);
    const c = data.overrideC !== undefined ? data.overrideC : loc[0];
    const r = data.overrideR !== undefined ? data.overrideR : loc[1];

    // Validate placement (players use strict terrain rules)
    let validation;
    try {
      const facing = player.facing || 'right';
      validation = buildingPreview.validateBuildingPlacement(buildingType, c, r, z, facing, true); // isPlayer = true
    } catch (error) {
      this.sendError(socket, 'Error: Unable to validate building placement');
      return true; // Command was handled, just failed validation
    }
    
    if (!validation || !validation.canBuild) {
      // Provide specific error message if available (e.g., Dock 50% water requirement)
      const errorMsg = validation.reason || 'You cannot build that there.';
      this.sendError(socket, errorMsg);
      return true; // Command was handled, just failed validation
    }

    // Check materials
    let materialCheck;
    try {
      materialCheck = buildingPreview.checkMaterials(player, buildingType);
    } catch (error) {
      this.sendError(socket, 'Error: Unable to check materials');
      return true; // Command was handled, just failed validation
    }
    
    if (!materialCheck || !materialCheck.hasMaterials) {
      const missing = materialCheck?.missing || {};
      // Convert missing object to array of strings (e.g., {wood: 10, stone: 5} -> ["wood: 10", "stone: 5"])
      const missingList = Object.entries(missing).map(([material, amount]) => `${material}: ${amount}`);
      this.sendError(socket, `Missing materials: ${missingList.join(', ')}`);
      return true; // Command was handled, just failed validation
    }

    // Deduct materials from player (prioritizes inventory first, then stores)
    this.deductMaterials(player, buildingDef.materials);

    // Build the building
    return this.constructBuilding(player, buildingType, c, r, z, buildingDef, validation, socket);
    } catch (error) {
      // Catch any unexpected errors
      // Try to send error to socket if available
      if (data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id])) {
        const socket = data.socket || global.SOCKET_LIST[data.id];
        try {
          this.sendError(socket, `Build command error: ${error.message || 'Unknown error'}`);
        } catch (e) {
          // Socket might not be available
        }
      }
      
      // Return true to indicate command was handled (even if it failed)
      return true;
    }
  }

  /**
   * Construct a building
   * @param {object} player - Player entity
   * @param {string} buildingType - Building type
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} z - Z level
   * @param {object} buildingDef - Building definition
   * @param {object} validation - Validation result
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  constructBuilding(player, buildingType, c, r, z, buildingDef, validation, socket) {
    // Special handling for dock (direction-dependent)
    let plot, topPlot;
    if (buildingType === 'dock') {
      const facing = player.facing || 'right';
      if (facing === 'up' && buildingDef.plotUp) {
        plot = this.calculatePlot(buildingDef.plotUp, c, r);
        topPlot = buildingDef.topPlotUp ? this.calculatePlot(buildingDef.topPlotUp, c, r) : null;
      } else if (facing === 'left' && buildingDef.plotLeft) {
        plot = this.calculatePlot(buildingDef.plotLeft, c, r);
        topPlot = buildingDef.topPlotLeft ? this.calculatePlot(buildingDef.topPlotLeft, c, r) : null;
      } else if (facing === 'right' && buildingDef.plotRight) {
        plot = this.calculatePlot(buildingDef.plotRight, c, r);
        topPlot = buildingDef.topPlotRight ? this.calculatePlot(buildingDef.topPlotRight, c, r) : null;
      } else if (facing === 'down' && buildingDef.plotDown) {
        plot = this.calculatePlot(buildingDef.plotDown, c, r);
        topPlot = buildingDef.topPlotDown ? this.calculatePlot(buildingDef.topPlotDown, c, r) : null;
      } else {
        // Fallback to default (right)
        plot = this.calculatePlot(buildingDef.plot, c, r);
        topPlot = buildingDef.topPlot ? this.calculatePlot(buildingDef.topPlot, c, r) : null;
      }
    } else {
      // Calculate plot based on building definition
      plot = this.calculatePlot(buildingDef.plot, c, r);
    }
    
    // Special handling for different building types
    if (buildingType === 'farm') {
      return this.buildFarm(player, plot, socket);
    }

    // Lay foundation tiles immediately (tile 11 = BUILD_MARKER) for ALL tiles in the plot
    if (!plot || plot.length === 0) {
      this.sendError(socket, 'Error: Invalid building plot');
      return false;
    }
    
    this.updateTilesForBuilding(buildingType, plot, validation);
    
    // Create building entity with built: false
    // Pass validation.walls and validation.topPlot which are already calculated correctly
    const building = buildingType === 'dock' && topPlot
      ? this.createBuildingEntityWithTopPlot(player, buildingType, plot, c, r, z, buildingDef, topPlot)
      : this.createBuildingEntity(player, buildingType, plot, c, r, z, buildingDef, validation.walls, validation.topPlot);
    
    if (building) {
      // Update map
      if (typeof global.mapEdit === 'function') {
        global.mapEdit();
      }
      
      // Materials have been deducted from player (inventory first, then stores)
      // Work on foundation tiles to complete construction
      this.sendMessage(socket, `${buildingDef.name} foundation laid. Work on the foundation tiles to complete construction.`);
    }

    return true;
  }

  /**
   * Build a farm (special case - instant construction)
   * @param {object} player - Player entity
   * @param {Array} plot - Plot tiles
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  buildFarm(player, plot, socket) {
    // Farm is built instantly
    player.working = true;
    
    const buildTime = Math.max(1000, 10000 / (player.strength || 1));
    
    setTimeout(() => {
      if (player.working) {
        player.working = false;
        
        // Update tiles
        for (const tile of plot) {
          if (typeof global.tileChange === 'function') {
            global.tileChange(0, tile[0], tile[1], 8); // Farm tile
            global.tileChange(6, tile[0], tile[1], 0); // Clear layer 6
          }
        }
        
        // Create farm building
        const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
        const center = getCenter(plot[4][0], plot[4][1]);
        
        if (typeof global.Farm === 'function') {
          global.Farm({
            owner: player.id,
            house: player.house,
            kingdom: player.kingdom,
            x: center[0],
            y: center[1],
            z: 0,
            type: 'farm',
            built: true,
            plot: plot
          });
        }
        
        // Update map
        if (typeof global.mapEdit === 'function') {
          global.mapEdit();
        }
        
        this.sendMessage(socket, 'Farm built.');
      }
    }, buildTime);
    
    return true;
  }

  /**
   * Calculate plot coordinates
   * @param {Array} plotTemplate - Plot template from building definition
   * @param {number} c - Center column
   * @param {number} r - Center row
   * @returns {Array} Plot coordinates
   */
  calculatePlot(plotTemplate, c, r) {
    return plotTemplate.map(tile => [c + tile[0], r + tile[1]]);
  }

  /**
   * Create building entity with pre-calculated topPlot (for dock)
   * @param {object} player - Player entity
   * @param {string} buildingType - Building type
   * @param {Array} plot - Plot tiles
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} z - Z level
   * @param {object} buildingDef - Building definition
   * @param {Array} topPlot - Pre-calculated topPlot
   * @returns {object|null} Building entity
   */
  createBuildingEntityWithTopPlot(player, buildingType, plot, c, r, z, buildingDef, topPlot) {
    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
    
    const centerTile = plot[Math.floor(plot.length / 2)];
    const center = getCenter(centerTile[0], centerTile[1]);
    
    const buildingParams = {
      owner: player.id,
      house: player.house,
      kingdom: player.kingdom,
      x: center[0],
      y: center[1],
      z: z,
      type: buildingType,
      built: false,
      plot: plot,
      walls: null,
      topPlot: topPlot,
      mats: buildingDef.materials || {},
      req: 5,
      hp: 150
    };
    
    const constructorName = this.getBuildingConstructorName(buildingType);
    if (typeof global[constructorName] === 'function') {
      return global[constructorName](buildingParams);
    } else if (typeof global.Building === 'function') {
      return global.Building(buildingParams);
    }
    return null;
  }

  /**
   * Create building entity
   * @param {object} player - Player entity
   * @param {string} buildingType - Building type
   * @param {Array} plot - Plot tiles
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {number} z - Z level
   * @param {object} buildingDef - Building definition
   * @param {Array|null} validationWalls - Pre-calculated walls from validation (optional)
   * @param {Array|null} validationTopPlot - Pre-calculated topPlot from validation (optional)
   * @returns {object|null} Building entity
   */
  createBuildingEntity(player, buildingType, plot, c, r, z, buildingDef, validationWalls, validationTopPlot) {
    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
    
    // Get center coordinates
    const centerTile = plot[Math.floor(plot.length / 2)];
    const center = getCenter(centerTile[0], centerTile[1]);
    
    // Use pre-calculated walls from validation if provided, otherwise calculate from buildingDef
    let walls = validationWalls;
    if (!walls && buildingDef.walls && Array.isArray(buildingDef.walls)) {
      walls = buildingDef.walls.map(([relX, relY]) => [c + relX, r + relY]);
    }
    
    // Use pre-calculated topPlot from validation if provided, otherwise calculate
    let topPlot = validationTopPlot;
    if (!topPlot) {
      if (buildingType === 'market' && walls) {
        // Market uses walls as topPlot (special case from original code)
        topPlot = walls;
      } else if (buildingDef.topPlot && Array.isArray(buildingDef.topPlot)) {
        topPlot = buildingDef.topPlot.map(([relX, relY]) => [c + relX, r + relY]);
      }
    }
    
    // Building parameters
    const buildingParams = {
      owner: player.id,
      house: player.house,
      kingdom: player.kingdom,
      x: center[0],
      y: center[1],
      z: z,
      type: buildingType,
      built: false, // Most buildings need materials to complete
      plot: plot,
      walls: walls,
      topPlot: topPlot,
      mats: buildingDef.materials || {},
      req: 5, // Default requirement
      hp: 150 // Default HP
    };

    // Get building constructor name
    const constructorName = this.getBuildingConstructorName(buildingType);
    
    // Create building using appropriate constructor
    if (typeof global[constructorName] === 'function') {
      return global[constructorName](buildingParams);
    } else if (typeof global.Building === 'function') {
      return global.Building(buildingParams);
    }

    return null;
  }

  /**
   * Get building constructor name
   * @param {string} buildingType - Building type
   * @returns {string} Constructor name
   */
  getBuildingConstructorName(buildingType) {
    // Capitalize first letter
    return buildingType.charAt(0).toUpperCase() + buildingType.slice(1);
  }

  /**
   * Update tiles for building
   * @param {string} buildingType - Building type
   * @param {Array} plot - Plot tiles
   * @param {object} validation - Validation result
   */
  updateTilesForBuilding(buildingType, plot, validation) {
    // Match NPC code pattern exactly - use for...in loop like Houses.js
    if (!plot || !Array.isArray(plot)) {
      return;
    }
    
    // Lay foundation tiles for all tiles in the plot (matching NPC code pattern from Houses.js)
    // Use global.tileChange to match how farm code accesses it
    if (typeof global.tileChange !== 'function') {
      return;
    }
    
    // Get getTile function
    const getTile = global.getTile || (typeof global.tilemapSystem !== 'undefined' ? 
      (z, c, r) => global.tilemapSystem.getTile(z, c, r) : null);
    
    if (!getTile) {
      return;
    }
    
    for (var i in plot) {
      var n = plot[i];
      if (!Array.isArray(n) || n.length < 2) {
        continue;
      }
      
      // Check if current tile is water (TERRAIN.WATER = 0)
      const currentTile = getTile(0, n[0], n[1]);
      const isWater = currentTile === 0;
      
      // Use 11.5 for water tiles, 11 for land tiles
      const foundationTile = isWater ? 11.5 : 11;
      global.tileChange(0, n[0], n[1], foundationTile);
      global.tileChange(6, n[0], n[1], 0); // Clear layer 6
      
      // Update pathfinding matrix to mark foundation tiles as walkable (0)
      // This is critical for water foundation tiles which previously had matrix value 2 (transition)
      // Without this, pathfinding would treat them as blocked transition tiles
      if (typeof global.matrixChange === 'function') {
        global.matrixChange(0, n[0], n[1], 0); // Mark as walkable in pathfinding matrix
      }
    }
  }

  /**
   * Calculate build time
   * @param {object} player - Player entity
   * @param {string} buildingType - Building type
   * @returns {number} Build time in milliseconds
   */
  calculateBuildTime(player, buildingType) {
    // Base time depends on building complexity
    const baseTime = 5000; // 5 seconds base
    const strength = player.strength || 1;
    
    // Farm has special calculation
    if (buildingType === 'farm') {
      return Math.max(1000, 10000 / strength);
    }
    
    return Math.max(2000, baseTime / strength);
  }

  /**
   * Deduct materials from player (prioritizes inventory first, then stores)
   * @param {object} player - Player entity
   * @param {object} materials - Materials required
   */
  deductMaterials(player, materials) {
    if (!materials) return;
    
    for (const material in materials) {
      let remaining = materials[material];
      
      // First, try to deduct from inventory
      const inInventory = player.inventory[material] || 0;
      if (inInventory > 0) {
        const fromInventory = Math.min(inInventory, remaining);
        player.inventory[material] = inInventory - fromInventory;
        remaining -= fromInventory;
      }
      
      // Then, if needed, deduct remainder from stores
      if (remaining > 0 && player.stores) {
        const inStores = player.stores[material] || 0;
        if (inStores > 0) {
          const fromStores = Math.min(inStores, remaining);
          player.stores[material] = inStores - fromStores;
          remaining -= fromStores;
        }
      }
    }
  }

  /**
   * Send message to socket
   * @param {object} socket - Socket
   * @param {string} message - Message
   */
  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  /**
   * List available buildings
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  listBuildings(player, socket) {
    // Count player's buildings
    let buildings = [];
    try {
      buildings = entityRegistry.getEntities('buildings', b => 
        b.owner === player.id && b.built
      );
    } catch (e) {
      // Fall back to legacy system if entityRegistry fails
      if (global.Building && global.Building.list) {
        buildings = Object.values(global.Building.list).filter(b => 
          b.owner === player.id && b.built
        );
      }
    }
    
    // If still no buildings, try legacy system directly
    if (buildings.length === 0 && global.Building && global.Building.list) {
      buildings = Object.values(global.Building.list).filter(b => 
        b.owner === player.id && b.built
      );
    }

    let farm = 0, tavern = 0, forge = 0, monastery = 0, garrison = 0, stronghold = 0;

    for (const b of buildings) {
      if (b.type === 'farm') farm++;
      else if (b.type === 'tavern') tavern++;
      else if (b.type === 'forge') forge++;
      else if (b.type === 'monastery') monastery++;
      else if (b.type === 'garrison') garrison++;
      else if (b.type === 'stronghold') stronghold++;
    }

    // Build help message
    let all = '<b><u>TIER I</u><br>[Farm]</b>: /build farm<br><b>Lumbermill</b>: /build lumbermill<br><b>Mine</b>: /build mine<br><b>Hut</b>: /build hut<br><b>Cottage</b>: /build cottage<br><b>Villa</b>: /build villa<br><b>[Tavern]</b>: /build tavern<br><b>Tower</b>: /build tower<br><b>[Forge]</b>: /build forge<br><b>Fort</b>: /build fort<br><b>Outpost</b>: /build outpost<br><b>[Monastery]</b>: /build monastery<br><b>Road</b>: /build road<br><br><b>Building Preview:</b><br>Use <b>/preview [building]</b> to see where you can build<br>Example: <b>/preview tavern</b><br>';

    // Tier II buildings (require Tier I)
    if (farm > 0 || tavern > 0 || forge > 0) {
      all += '<br><b><u>TIER II</u></b><br>';
      if (farm > 0) {
        all += '<b>Mill</b>: /build mill<br>';
      }
      if (tavern > 0) {
        all += '<b>Dock</b>: /build dock<br><b>Stable</b>: /build stable<br><b>Market</b>: /build market<br>';
      }
      if (forge > 0) {
        all += '<b>[Garrison]</b>: /build garrison<br>';
      }
    }

    // Tier III buildings (require Garrison)
    if (garrison > 0) {
      all += '<b><u>TIER III</u><br>[Stronghold]</b>: /build stronghold<br><b>Wall</b>: /build wall<br><b>Gate</b>: /build gate<br><b>Guardtower</b> /build guardtower<br>';
    }

    // Tier IV buildings (require Monastery + Stronghold)
    if (monastery > 0 && stronghold > 0) {
      all += '<b><u>TIER IV</u><br>Cathedral</b>: /build cathedral<br>';
    }

    socket.write(JSON.stringify({ msg: 'addToChat', message: '<p>' + all + '</p>' }));
    return true;
  }

  /**
   * Send error message to socket
   * @param {object} socket - Socket
   * @param {string} message - Error message
   */
  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }
}

module.exports = BuildingCommand;
