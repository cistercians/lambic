/**
 * DockNetworkCommand - Handles /docknetwork commands
 * 
 * Manages dock networks for cargo ships.
 */

const entityRegistry = require('../../core/EntityRegistry');

class DockNetworkCommand {
  constructor() {
    this.name = 'docknetwork';
  }

  /**
   * Execute the docknetwork command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    const parts = data.cmd.trim().split(' ');
    const subcommand = parts[1]; // 'add', 'remove', 'list'
    const targetDockId = parts[2];

    // Player must be at a dock they own
    const getBuilding = global.getBuilding || ((x, y) => null);
    const facingBuilding = getBuilding(player.x, player.y);
    
    if (!facingBuilding) {
      this.sendError(socket, 'You must be at a dock to use this command.');
      return false;
    }

    const dock = global.Building && global.Building.list && global.Building.list[facingBuilding];
    if (!dock || dock.type !== 'dock') {
      this.sendError(socket, 'You must be at a dock to use this command.');
      return false;
    }

    if (dock.owner !== player.id) {
      this.sendError(socket, 'You must own this dock to manage its network.');
      return false;
    }

    if (!dock.network) {
      dock.network = [];
    }

    if (subcommand === 'add') {
      return this.handleAdd(dock, targetDockId, facingBuilding, socket);
    } else if (subcommand === 'remove') {
      return this.handleRemove(dock, targetDockId, socket);
    } else if (subcommand === 'list') {
      return this.handleList(dock, socket);
    } else {
      this.sendError(socket, 'Usage: /docknetwork [add|remove|list] <dockId>');
      return false;
    }
  }

  handleAdd(dock, targetDockId, facingBuilding, socket) {
    if (!targetDockId) {
      this.sendError(socket, 'Usage: /docknetwork add <dockId>');
      return false;
    }

    const targetDock = global.Building && global.Building.list && global.Building.list[targetDockId];
    if (!targetDock || targetDock.type !== 'dock') {
      this.sendError(socket, 'Target dock not found.');
      return false;
    }

    if (dock.network.indexOf(targetDockId) !== -1) {
      this.sendError(socket, 'This dock is already in your network.');
      return false;
    }

    dock.network.push(targetDockId);
    this.sendMessage(socket, `✅ Dock <b>${targetDockId}</b> added to network.`);

    // Spawn cargo ship if this is the first dock in network
    if (dock.network.length === 1 && !dock.cargoShip) {
      this.spawnCargoShip(dock, facingBuilding, socket);
    }

    return true;
  }

  handleRemove(dock, targetDockId, socket) {
    if (!targetDockId) {
      this.sendError(socket, 'Usage: /docknetwork remove <dockId>');
      return false;
    }

    const index = dock.network.indexOf(targetDockId);
    if (index === -1) {
      this.sendError(socket, 'This dock is not in your network.');
      return false;
    }

    dock.network.splice(index, 1);
    this.sendMessage(socket, `✅ Dock <b>${targetDockId}</b> removed from network.`);

    // If network becomes empty, remove cargo ship
    if (dock.network.length === 0 && dock.cargoShip) {
      const cargoShip = global.Player && global.Player.list && global.Player.list[dock.cargoShip];
      if (cargoShip) {
        cargoShip.toRemove = true;
        this.sendMessage(socket, '🚢 Cargo ship removed (network is now empty).');
      }
      dock.cargoShip = null;
    }

    return true;
  }

  handleList(dock, socket) {
    if (dock.network.length === 0) {
      this.sendError(socket, 'This dock has no network connections.');
      return false;
    }

    let message = '<b>🚢 Dock Network:</b><br>';
    for (let i = 0; i < dock.network.length; i++) {
      const targetDock = global.Building && global.Building.list && global.Building.list[dock.network[i]];
      let targetName = dock.network[i];
      if (targetDock) {
        targetName = (targetDock.zoneName || targetDock.name || 'Dock') + ' (' + dock.network[i] + ')';
      }
      message += '<br>' + (i + 1) + '. ' + targetName;
    }
    socket.write(JSON.stringify({ msg: 'addToChat', message }));
    return true;
  }

  spawnCargoShip(dock, facingBuilding, socket) {
    this.sendMessage(socket, '🚢 Spawning cargo ship for your dock network...');

    const getTile = global.getTile
      ? (layer, c, r) => global.getTile(layer, c, r, dock)
      : ((layer, c, r) => null);
    const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
    const mapSize = global.mapContextManager
      ? global.mapContextManager.getMapSize(dock)
      : (global.mapSize || 1000);
    let waterTile = null;

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
            waterTile = at;
            break;
          }
        }
      }
      if (waterTile) break;
    }

    if (waterTile) {
      const waterCoords = getCenter(waterTile[0], waterTile[1]);
      const CargoShip = global.CargoShip || (() => {});
      
      if (typeof CargoShip === 'function') {
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
          this.sendMessage(socket, '✅ Cargo ship spawned and ready for passengers!');
        }
      }
    }
  }

  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }
}

module.exports = DockNetworkCommand;
