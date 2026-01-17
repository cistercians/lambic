/**
 * TestItemCommand - Handles testitem command
 * 
 * Spawns test items around player for testing pickup mechanics.
 */

const entityRegistry = require('../../core/EntityRegistry');

class TestItemCommand {
  constructor() {
    this.name = 'testitem';
  }

  /**
   * Execute the testitem command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    
    const loc = getLoc(player.x, player.y, player);
    const coords = getCoords(loc[0], loc[1]);

    // Spawn wood item
    if (typeof global.Wood === 'function') {
      global.Wood({
        z: player.z,
        x: coords[0] + 50,
        y: coords[1],
        qty: 5,
        parent: player.id
      });
    }

    // Spawn stone item
    if (typeof global.Stone === 'function') {
      global.Stone({
        z: player.z,
        x: coords[0] - 50,
        y: coords[1],
        qty: 3,
        parent: player.id
      });
    }

    // Spawn iron item
    if (typeof global.Iron === 'function') {
      global.Iron({
        z: player.z,
        x: coords[0],
        y: coords[1] + 50,
        qty: 2,
        parent: player.id
      });
    }

    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: '<i>Test items spawned around you. Press P to pick them up!</i>'
    }));

    return true;
  }
}

module.exports = TestItemCommand;
