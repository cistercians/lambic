/**
 * SpawnCargoCommand - Handles spawncargo command
 * 
 * Admin command to spawn cargo ship at current dock.
 */

const entityRegistry = require('../../core/EntityRegistry');

class SpawnCargoCommand {
  constructor() {
    this.name = 'spawncargo';
  }

  /**
   * Execute the spawncargo command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    const getBuilding = global.getBuilding || ((x, y) => null);
    const facingBuilding = getBuilding(player.x, player.y);
    
    if (!facingBuilding) {
      this.sendError(socket, 'You must be at a dock.');
      return false;
    }

    const dock = global.Building && global.Building.list && global.Building.list[facingBuilding];
    if (!dock || dock.type !== 'dock') {
      this.sendError(socket, 'You must be at a dock.');
      return false;
    }

    if (!dock.network || dock.network.length === 0) {
      this.sendError(socket, 'This dock has no network. Use /docknetwork add <dockId> first.');
      return false;
    }

    if (dock.cargoShip) {
      this.sendError(socket, 'This dock already has a cargo ship.');
      return false;
    }

    // Find water tile
    const waterTile = this.findWaterTile(dock);
    
    if (!waterTile) {
      this.sendError(socket, 'No water adjacent to this dock.');
      return false;
    }

    const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
    const waterCoords = getCenter(waterTile[0], waterTile[1]);
    const CargoShip = global.CargoShip;
    
    if (typeof CargoShip !== 'function') {
      this.sendError(socket, 'Cargo ship system not available.');
      return false;
    }

    const cargoShip = CargoShip({
      x: waterCoords[0],
      y: waterCoords[1],
      z: 0,
      homeDock: facingBuilding,
      currentDock: facingBuilding,
      mode: 'waiting'
    });

    if (cargoShip.selectNextDestination && cargoShip.selectNextDestination()) {
      if (cargoShip.announceDestination) cargoShip.announceDestination();
      if (cargoShip.startWaiting) cargoShip.startWaiting();
      dock.cargoShip = cargoShip.id;
      this.sendMessage(socket, '✅ Cargo ship spawned!');
      return true;
    } else {
      if (cargoShip.toRemove !== undefined) cargoShip.toRemove = true;
      this.sendError(socket, '❌ Failed to spawn cargo ship.');
      return false;
    }
  }

  /**
   * Find adjacent water tile for cargo ship
   * @param {object} dock - Dock building
   * @returns {Array|null} Water tile coordinates [c, r] or null
   */
  findWaterTile(dock) {
    const getTile = global.getTile
      ? (layer, c, r) => global.getTile(layer, c, r, dock)
      : ((layer, c, r) => null);
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(dock)
      : (global.mapSize || 1000);
    
    for (const dockLoc of dock.plot || []) {
      const adjacent = [
        [dockLoc[0], dockLoc[1] + 1],
        [dockLoc[0], dockLoc[1] - 1],
        [dockLoc[0] - 1, dockLoc[1]],
        [dockLoc[0] + 1, dockLoc[1]]
      ];

      for (const at of adjacent) {
        if (at[0] >= 0 && at[0] < mapSize && at[1] >= 0 && at[1] < mapSize) {
          if (getTile(0, at[0], at[1]) === 0) { // Water
            return at;
          }
        }
      }
    }
    
    return null;
  }

  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }
}

module.exports = SpawnCargoCommand;
