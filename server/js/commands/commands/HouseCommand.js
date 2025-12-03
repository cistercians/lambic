/**
 * HouseCommand - Handles /house command
 * 
 * Handles house creation and management.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class HouseCommand {
  constructor() {
    this.name = 'house';
  }

  /**
   * Execute the house command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Handle /house (show house info)
    if (data.cmd === 'house') {
      return this.showHouseInfo(player, socket);
    }

    // Handle /house [name] or /house [name] [flag]
    const parts = data.cmd.substring(6).trim().split(' ');
    if (parts.length === 0) {
      this.sendError(socket, 'Usage: /house <name> [flag]');
      return false;
    }

    return this.createHouse(player, parts, socket, data);
  }

  /**
   * Show house information
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  showHouseInfo(player, socket) {
    if (!player.house) {
      this.sendError(socket, 'You do not belong to a House.');
      return false;
    }

    // TODO: Show house report
    // For now, just acknowledge
    this.sendMessage(socket, 'House information display not yet implemented.');
    return true;
  }

  /**
   * Create a house
   * @param {object} player - Player entity
   * @param {Array} parts - Command parts
   * @param {object} socket - Socket
   * @param {object} data - Command data
   * @returns {boolean} Success
   */
  createHouse(player, parts, socket, data) {
    // Check prerequisites
    if (!this.checkPrerequisites(player, socket)) {
      return false;
    }

    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y);

    // Get building player is in
    const building = this.getBuildingAtPosition(player.x, player.y);
    if (!building || building.type !== 'garrison') {
      this.sendError(socket, 'Must be at a Garrison.');
      return false;
    }

    if (building.owner !== player.id) {
      this.sendError(socket, 'Must be at your own Garrison.');
      return false;
    }

    if (player.z !== 2) {
      this.sendError(socket, 'Must be at the desk upstairs.');
      return false;
    }

    // Check if at desk
    const getItem = global.getItem || ((z, c, r) => null);
    const item = getItem(player.z, loc[0], loc[1] - 1);
    if (item !== 'Desk') {
      this.sendError(socket, 'Must be at the desk.');
      return false;
    }

    // Check available flags
    const availableFlags = this.getAvailableFlags();
    if (availableFlags.length === 0) {
      this.sendError(socket, 'There are too many Houses.');
      return false;
    }

    // Parse house name and flag
    let houseName;
    let flagNumber = null;

    if (parts.length >= 2) {
      // /house name flag
      houseName = parts[0];
      flagNumber = parseInt(parts[1], 10);
      
      if (isNaN(flagNumber) || flagNumber < 0 || flagNumber > 69) {
        this.sendError(socket, 'Flag must be a number from 0 to 69.');
        return false;
      }
    } else {
      // /house name (auto-assign flag)
      houseName = parts.join(' ');
    }

    // Validate house name
    if (this.isHouseNameTaken(houseName)) {
      this.sendError(socket, 'Name is taken.');
      return false;
    }

    // Assign flag
    let flag;
    if (flagNumber !== null) {
      // Use specified flag
      if (!this.isFlagAvailable(flagNumber)) {
        this.sendError(socket, 'Flag is taken.');
        return false;
      }
      flag = this.getFlagById(flagNumber);
      this.markFlagUsed(flagNumber);
    } else {
      // Auto-assign flag
      flag = availableFlags[Math.floor(Math.random() * availableFlags.length)];
      this.markFlagUsedByFlag(flag);
    }

    // Create house
    const houseId = Math.random();
    const House = global.House || (() => {});
    
    if (typeof House === 'function') {
      House({
        id: houseId,
        type: 'player',
        name: houseName,
        flag: flag,
        hq: loc,
        hostile: false
      });

      player.house = houseId;

      // Convert house (if function exists)
      if (typeof global.convertHouse === 'function') {
        global.convertHouse(player.id);
      }

      // Notify clients
      socket.write(JSON.stringify({
        msg: 'newFaction',
        houseList: global.House && global.House.list ? global.House.list : {}
      }));

      this.sendMessage(socket, `House "${houseName}" created!`);
      return true;
    }

    this.sendError(socket, 'House system not available.');
    return false;
  }

  /**
   * Check prerequisites for creating a house
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Prerequisites met
   */
  checkPrerequisites(player, socket) {
    // Player must be at a garrison they own
    const building = this.getBuildingAtPosition(player.x, player.y);
    
    if (!building || building.type !== 'garrison') {
      this.sendError(socket, 'Must be at a Garrison.');
      return false;
    }

    if (building.owner !== player.id) {
      this.sendError(socket, 'Must be at your own Garrison.');
      return false;
    }

    if (player.z !== 2) {
      this.sendError(socket, 'Must be at the desk upstairs.');
      return false;
    }

    return true;
  }

  /**
   * Get building at position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {object|null} Building entity
   */
  getBuildingAtPosition(x, y) {
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
              return building;
            }
          }
        }
      }
      return null;
    });

    const buildingId = getBuilding(x, y);
    if (buildingId) {
      return entityRegistry.getEntity('buildings', buildingId) ||
             (global.Building && global.Building.list && global.Building.list[buildingId]) ||
             null;
    }
    return null;
  }

  /**
   * Get available flags
   * @returns {Array} Available flags
   */
  getAvailableFlags() {
    const flags = global.flags || [];
    const available = [];

    for (let i = 0; i < flags.length; i++) {
      if (flags[i] && flags[i][1] === 0) {
        available.push(flags[i][0]);
      }
    }

    return available;
  }

  /**
   * Check if flag is available
   * @param {number} flagId - Flag ID
   * @returns {boolean} Is available
   */
  isFlagAvailable(flagId) {
    const flags = global.flags || [];
    if (flags[flagId] && flags[flagId][1] === 0) {
      return true;
    }
    return false;
  }

  /**
   * Get flag by ID
   * @param {number} flagId - Flag ID
   * @returns {*} Flag value
   */
  getFlagById(flagId) {
    const flags = global.flags || [];
    if (flags[flagId]) {
      return flags[flagId][0];
    }
    return null;
  }

  /**
   * Mark flag as used
   * @param {number} flagId - Flag ID
   */
  markFlagUsed(flagId) {
    const flags = global.flags || [];
    if (flags[flagId]) {
      flags[flagId][1] = 1;
    }
  }

  /**
   * Mark flag as used by flag value
   * @param {*} flag - Flag value
   */
  markFlagUsedByFlag(flag) {
    const flags = global.flags || [];
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] && flags[i][0] === flag) {
        flags[i][1] = 1;
        break;
      }
    }
  }

  /**
   * Check if house name is taken
   * @param {string} name - House name
   * @returns {boolean} Is taken
   */
  isHouseNameTaken(name) {
    const houseList = entityRegistry.getCollection('houses') || 
                     (global.House && global.House.list ? global.House.list : {});

    for (const id in houseList) {
      const house = houseList[id];
      if (house.name === name) {
        return true;
      }
    }

    return false;
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

module.exports = HouseCommand;
