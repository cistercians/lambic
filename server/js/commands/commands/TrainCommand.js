/**
 * TrainCommand - Handles /train command
 * 
 * Handles unit training in garrisons.
 * Requires player to be in a house with garrison buildings.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class TrainCommand {
  constructor() {
    this.name = 'train';
    
    // Unit definitions
    this.units = {
      footsoldier: {
        iron: 3,
        grain: 2,
        requires: { garrison: true }
      },
      skirmisher: {
        iron: 5,
        grain: 3,
        requires: { garrison: true, stronghold: true }
      },
      cavalier: {
        iron: 5,
        grain: 7,
        requires: { garrison: true, stronghold: true, stable: true }
      }
    };
    
    // Valid ranks for training
    this.allowedRanks = ['♞ ', '♜ ', '♚ '];
  }

  /**
   * Execute the train command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Handle /train (list available units)
    if (data.cmd === 'train') {
      return this.listUnits(player, socket);
    }

    // Handle /train [unit] or /train [quantity] [unit]
    const parts = data.cmd.substring(6).trim().split(' ');
    
    // Check if first part is a number (quantity)
    let quantity = 1;
    let unitName;
    
    if (parts.length >= 2 && !isNaN(parseInt(parts[0], 10))) {
      quantity = parseInt(parts[0], 10);
      unitName = parts.slice(1).join(' ').toLowerCase();
    } else {
      unitName = parts.join(' ').toLowerCase();
    }

    // Validate quantity
    if (quantity < 1 || isNaN(quantity)) {
      this.sendError(socket, 'Quantity must be greater than 0.');
      return false;
    }

    return this.trainUnits(player, unitName, quantity, socket);
  }

  /**
   * List available units for training
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  listUnits(player, socket) {
    if (!player.house) {
      this.sendError(socket, 'You must establish a House.');
      return false;
    }

    const buildings = this.getHouseBuildings(player.house);
    
    if (buildings.garrisons.length === 0) {
      this.sendError(socket, 'You have no garrison.');
      return false;
    }

    // Check permissions
    const permit = this.checkPermissions(player, buildings);
    if (!permit) {
      return false; // Error already sent
    }

    // Build unit list
    let all = '<b>Footsoldier</b>: /train <i>Quantity</i> footsoldier<br><b>3 iron, 2 grain</b>';
    
    if (buildings.strongholds > 0) {
      all += '<br><b>Skirmisher</b>: /train <i>Quantity</i> skirmisher<br><b>5 iron, 3 grain</b>';
    }
    
    if (buildings.strongholds > 0 && buildings.stables > 0) {
      all += '<br><b>Cavalier</b>: /train <i>Quantity</i> cavalier<br><b>5 iron, 7 grain</b>';
    }

    socket.write(JSON.stringify({ msg: 'addToChat', message: `<p>${all}</p>` }));
    return true;
  }

  /**
   * Train units
   * @param {object} player - Player entity
   * @param {string} unitName - Unit type name
   * @param {number} quantity - Quantity to train
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  trainUnits(player, unitName, quantity, socket) {
    if (!player.house) {
      this.sendError(socket, 'You must establish a House.');
      return false;
    }

    const unitDef = this.units[unitName];
    if (!unitDef) {
      this.sendError(socket, `Invalid unit: ${unitName}`);
      return false;
    }

    const buildings = this.getHouseBuildings(player.house);
    
    // Check permissions
    const permit = this.checkPermissions(player, buildings);
    if (!permit) {
      return false;
    }

    // Check requirements
    if (!this.checkUnitRequirements(buildings, unitDef, socket)) {
      return false;
    }

    // Check if single unit or multiple (if quantity is 1 and no number was specified)
    if (quantity === 1 && parts.length === 1) {
      // Single unit training (original format: /train footsoldier)
      return this.trainSingleUnit(player, unitName, buildings, socket);
    } else {
      // Multiple unit training (/train 5 footsoldier)
      return this.trainMultipleUnits(player, unitName, quantity, buildings, socket);
    }
  }

  /**
   * Train a single unit
   * @param {object} player - Player entity
   * @param {string} unitName - Unit type
   * @param {object} buildings - Building info
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  trainSingleUnit(player, unitName, buildings, socket) {
    const unitDef = this.units[unitName];
    const house = this.getHouse(player.house);
    
    if (!house) {
      this.sendError(socket, 'House not found.');
      return false;
    }

    // Check resources
    if (house.stores.iron < unitDef.iron) {
      this.sendError(socket, 'Not enough iron.');
      return false;
    }

    if (house.stores.grain < unitDef.grain) {
      this.sendError(socket, 'Not enough grain.');
      return false;
    }

    // Deduct resources
    house.stores.iron -= unitDef.iron;
    house.stores.grain -= unitDef.grain;

    // Add to first garrison queue
    const garrison = this.getBuilding(buildings.garrisons[0]);
    if (garrison) {
      if (!garrison.queue) {
        garrison.queue = [];
      }
      garrison.queue.push(unitName);
      
      this.sendMessage(socket, `Training ${unitName} started.`);
      return true;
    }

    this.sendError(socket, 'Garrison not found.');
    return false;
  }

  /**
   * Train multiple units
   * @param {object} player - Player entity
   * @param {string} unitName - Unit type
   * @param {number} quantity - Quantity
   * @param {object} buildings - Building info
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  trainMultipleUnits(player, unitName, quantity, buildings, socket) {
    const unitDef = this.units[unitName];
    const house = this.getHouse(player.house);
    
    if (!house) {
      this.sendError(socket, 'House not found.');
      return false;
    }

    const totalIron = unitDef.iron * quantity;
    const totalGrain = unitDef.grain * quantity;

    // Check resources
    if (house.stores.iron < totalIron) {
      this.sendError(socket, 'Not enough iron.');
      return false;
    }

    if (house.stores.grain < totalGrain) {
      this.sendError(socket, 'Not enough grain.');
      return false;
    }

    // Deduct resources
    house.stores.iron -= totalIron;
    house.stores.grain -= totalGrain;

    // Distribute across garrisons
    let counter = 0;
    for (let i = 0; i < quantity; i++) {
      const garrisonId = buildings.garrisons[counter];
      const garrison = this.getBuilding(garrisonId);
      
      if (garrison) {
        if (!garrison.queue) {
          garrison.queue = [];
        }
        garrison.queue.push(unitName);
      }
      
      counter++;
      if (counter >= buildings.garrisons.length) {
        counter = 0;
      }
    }

    this.sendMessage(socket, `Training ${quantity} ${unitName}(s) started.`);
    return true;
  }

  /**
   * Get house buildings
   * @param {string} houseId - House ID
   * @returns {object} Building counts
   */
  getHouseBuildings(houseId) {
    const buildings = {
      garrisons: [],
      strongholds: 0,
      stables: 0
    };

    const buildingList = entityRegistry.getCollection('buildings') || 
                        (global.Building && global.Building.list ? global.Building.list : {});

    for (const id in buildingList) {
      const b = buildingList[id];
      if (b.house === houseId) {
        if (b.type === 'garrison') {
          buildings.garrisons.push(id);
        } else if (b.type === 'stronghold') {
          buildings.strongholds++;
        } else if (b.type === 'stable') {
          buildings.stables++;
        }
      }
    }

    return buildings;
  }

  /**
   * Check player permissions
   * @param {object} player - Player entity
   * @param {object} buildings - Building info
   * @param {object} socket - Socket
   * @returns {boolean} Has permission
   */
  checkPermissions(player, buildings, socket = null) {
    if (!player.house) {
      if (socket) this.sendError(socket, 'You must establish a House.');
      return false;
    }

    if (buildings.garrisons.length === 0) {
      if (socket) this.sendError(socket, 'You have no garrison.');
      return false;
    }

    // Check rank
    if (!this.allowedRanks.includes(player.rank)) {
      if (socket) this.sendError(socket, 'You cannot give this order.');
      return false;
    }

    const house = this.getHouse(player.house);
    
    // Check if general (can train from anywhere)
    if (house && house.general === player.id) {
      return true;
    }

    // Check if in garrison
    if (player.z === 1 || player.z === 2) {
      const building = this.getBuildingAtPosition(player.x, player.y, player.z);
      if (building && building.type === 'garrison' && building.house === player.house) {
        return true;
      }
    }

    if (socket) this.sendError(socket, 'You must be in a garrison.');
    return false;
  }

  /**
   * Check unit requirements
   * @param {object} buildings - Building info
   * @param {object} unitDef - Unit definition
   * @param {object} socket - Socket
   * @returns {boolean} Requirements met
   */
  checkUnitRequirements(buildings, unitDef, socket) {
    const req = unitDef.requires;

    if (req.stronghold && buildings.strongholds === 0) {
      this.sendError(socket, 'You have no stronghold.');
      return false;
    }

    if (req.stable && buildings.stables === 0) {
      this.sendError(socket, 'You have no stable.');
      return false;
    }

    return true;
  }

  /**
   * Get house entity
   * @param {string} houseId - House ID
   * @returns {object|null} House entity
   */
  getHouse(houseId) {
    const houseList = entityRegistry.getCollection('houses') || 
                     (global.House && global.House.list ? global.House.list : {});
    return houseList[houseId] || null;
  }

  /**
   * Get building entity
   * @param {string} buildingId - Building ID
   * @returns {object|null} Building entity
   */
  getBuilding(buildingId) {
    return entityRegistry.getEntity('buildings', buildingId) ||
           (global.Building && global.Building.list && global.Building.list[buildingId]) ||
           null;
  }

  /**
   * Get building at position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} z - Z level
   * @returns {object|null} Building entity
   */
  getBuildingAtPosition(x, y, z) {
    const getBuilding = global.getBuilding || ((x, y) => {
      const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
      const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
      const loc = getLoc(x, y);
      const center = getCenter(loc[0], loc[1]);
      
      const buildings = entityRegistry.getEntities('buildings') || [];
      for (const building of buildings) {
        if (building.plot) {
          for (const plotTile of building.plot) {
            if (plotTile[0] === loc[0] && plotTile[1] === loc[1]) {
              return building.id;
            }
          }
        }
      }
      return null;
    });

    const buildingId = getBuilding(x, y);
    return buildingId ? this.getBuilding(buildingId) : null;
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
   * Send error message to socket
   * @param {object} socket - Socket
   * @param {string} message - Error message
   */
  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }
}

module.exports = TrainCommand;
