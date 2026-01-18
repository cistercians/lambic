/**
 * FishBoatCommand - Handles /fishboat command
 * 
 * Builds a fishing boat at an owned dock.
 */

const entityRegistry = require('../../core/EntityRegistry');

class FishBoatCommand {
  constructor() {
    this.name = 'fishboat';
  }

  /**
   * Execute the fishboat command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    let player = null;
    try {
      player = entityRegistry.getEntity('players', data.id);
    } catch (e) {
      // Fall back to legacy player list
    }
    if (!player && global.Player && global.Player.list) {
      player = global.Player.list[data.id];
    }
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Optional dock id: /fishboat <dockId>
    const cmdParts = (data.cmd || '').trim().split(/\s+/);
    const dockIdFromCmd = cmdParts.length >= 2 ? cmdParts[1] : null;

    let dockId = null;
    let dock = null;

    if (dockIdFromCmd && global.Building && global.Building.list && global.Building.list[dockIdFromCmd]) {
      dockId = dockIdFromCmd;
      dock = global.Building.list[dockIdFromCmd];
    }

    if (!dock) {
      const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
      const loc = getLoc(player.x, player.y, player);

      // Get the tile player is facing
      const dirOffsets = {
        down: [0, 1],
        up: [0, -1],
        left: [-1, 0],
        right: [1, 0]
      };
      const offset = dirOffsets[player.facing];
      const facingLoc = [loc[0] + offset[0], loc[1] + offset[1]];
      const getCenter = global.getCenter || ((c, r) => [c * 64, r * 64]);
      const facingCoords = getCenter(facingLoc[0], facingLoc[1]);
      const getBuilding = global.getBuilding || ((x, y) => null);
      const facingBuilding = getBuilding(facingCoords[0], facingCoords[1]);

      if (!facingBuilding || !global.Building || !global.Building.list || !global.Building.list[facingBuilding]) {
        this.sendError(socket, 'You must face a Dock to build a fishing boat.');
        return false;
      }

      dockId = facingBuilding;
      dock = global.Building.list[facingBuilding];
    }

    if (dock.type !== 'dock') {
      this.sendError(socket, 'You must face a Dock to build a fishing boat.');
      return false;
    }

    if (dock.owner !== player.id) {
      this.sendError(socket, 'This is not your Dock.');
      return false;
    }

    // Check if player has enough wood (check inventory first, then stores - matching building construction)
    let playerWood = (player.inventory.wood || 0) + (player.stores.wood || 0);
    if (player.house && global.House && global.House.list) {
      playerWood += (global.House.list[player.house].stores.wood || 0);
    }

    if (playerWood < 150) {
      this.sendError(socket, `You need <b>150 Wood</b> to build a Fishing Boat. (You have ${playerWood})`);
      return false;
    }

    // Deduct wood (from inventory first, then stores)
    let woodNeeded = 150;
    if (player.inventory.wood > 0) {
      const woodFromInventory = Math.min(woodNeeded, player.inventory.wood);
      player.inventory.wood -= woodFromInventory;
      woodNeeded -= woodFromInventory;
    }
    if (woodNeeded > 0 && player.stores.wood > 0) {
      const woodFromStores = Math.min(woodNeeded, player.stores.wood);
      player.stores.wood -= woodFromStores;
      woodNeeded -= woodFromStores;
    }
    if (woodNeeded > 0 && player.house && global.House && global.House.list) {
      const houseStores = global.House.list[player.house].stores;
      if (houseStores && houseStores.wood > 0) {
        const woodFromHouse = Math.min(woodNeeded, houseStores.wood);
        houseStores.wood -= woodFromHouse;
        woodNeeded -= woodFromHouse;
      }
    }

    // Find water tile adjacent to dock
    const getTile = global.getTile
      ? (layer, c, r) => global.getTile(layer, c, r, dock)
      : ((layer, c, r) => null);
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

    if (!waterTile) {
      this.sendError(socket, 'No water adjacent to this Dock. Cannot spawn fishing boat.');
      // Refund wood (restore to inventory first, then stores)
      let woodToRefund = 150;
      const originalInventoryWood = (player.inventory.wood || 0) + woodToRefund;
      if (woodToRefund > 0) {
        player.inventory.wood = (player.inventory.wood || 0) + woodToRefund;
        woodToRefund = 0;
      }
      // Note: We don't track exactly where wood came from, so we refund to inventory
      // This is acceptable since the refund happens immediately after deduction
      return false;
    }

    // Create fishing ship on adjacent water tile
    const waterCoords = getCenter(waterTile[0], waterTile[1]);
    const FishingShip = global.FishingShip || (() => {});
    
    if (typeof FishingShip === 'function') {
      const ship = FishingShip({
        x: waterCoords[0],
        y: waterCoords[1],
        z: 0,
        dock: dockId,
        house: dock.house,
        kingdom: dock.kingdom,
        owner: player.id,
        spawned: false,
        mode: 'docked'
      });

      // Track in dock
      if (!dock.ships) dock.ships = [];
      dock.ships.push(ship.id);

      this.sendMessage(socket, '🚢 <b>Fishing Boat built!</b> It will automatically be crewed by dock workers during work hours.');
      return true;
    }

    this.sendError(socket, 'FishingShip system not available.');
    return false;
  }

  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }
}

module.exports = FishBoatCommand;
