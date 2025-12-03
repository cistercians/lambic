/**
 * DropCommand - Handles /drop command
 * 
 * Consolidated drop command that handles all item types.
 * Replaces thousands of lines of repetitive code in Commands.js.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class DropCommand {
  constructor() {
    this.name = 'drop';
  }

  /**
   * Execute the drop command
   * @param {object} data - Command data { cmd, id, world }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Handle /drop (show usage)
    if (data.cmd === 'drop') {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<p>/drop Quantity ItemName</p>' 
      }));
      return true;
    }

    // Handle /drop key (special case)
    if (data.cmd === 'drop key') {
      return this.listKeys(player, socket);
    }

    // Handle /drop key [number]
    if (data.cmd.startsWith('drop key ')) {
      return this.dropKey(data, player, socket);
    }

    // Handle /drop [quantity] [item]
    const parts = data.cmd.substring(5).trim().split(' ');
    if (parts.length < 2) {
      this.sendError(socket, 'Usage: /drop <quantity> <item>');
      return false;
    }

    const quantity = parseInt(parts[0], 10);
    const itemType = parts.slice(1).join(' ').toLowerCase();

    // Validate quantity
    if (isNaN(quantity) || quantity < 1) {
      this.sendError(socket, 'Quantity must be a number greater than 0.');
      return false;
    }

    // Check if player has the item
    if (!player.inventory[itemType] || player.inventory[itemType] < quantity) {
      this.sendError(socket, 'You do not have that many.');
      return false;
    }

    // Get item factory
    const itemFactory = systemRegistry.get('itemFactory') || global.itemFactory;
    if (!itemFactory) {
      this.sendError(socket, 'Item system not available.');
      return false;
    }

    // Drop the item
    return this.dropItem(player, itemType, quantity, data, socket);
  }

  /**
   * List keys in keyring
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  listKeys(player, socket) {
    socket.write(JSON.stringify({ 
      msg: 'addToChat', 
      message: '<p>/drop key Number</p>' 
    }));

    if (!player.inventory.keyRing || player.inventory.keyRing.length === 0) {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<i>You have no keys.</i>' 
      }));
      return true;
    }

    player.inventory.keyRing.forEach((key, index) => {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: `<p>${index + 1}: ${key.name}</p>` 
      }));
    });

    return true;
  }

  /**
   * Drop a key
   * @param {object} data - Command data
   * @param {object} player - Player entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  dropKey(data, player, socket) {
    const num = parseInt(data.cmd.substring(9).trim(), 10) - 1;

    if (isNaN(num) || num < 0 || !player.inventory.keyRing || !player.inventory.keyRing[num]) {
      this.sendError(socket, 'Invalid key number.');
      return false;
    }

    const key = player.inventory.keyRing[num];
    const z = player.z;
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y);
    const c = loc[0];
    const r = loc[1];

    // Get position based on facing
    const pos = this.getDropPosition(player.facing, c, r);
    if (!pos) {
      this.sendError(socket, 'Cannot drop item in that direction.');
      return false;
    }

    // Check for chest
    const chest = this.checkChest(z, pos[0], pos[1], player.id);
    if (chest) {
      if (chest.id === key.id) {
        this.sendError(socket, 'You cannot lock the chest without the key.');
        return false;
      }
      // Put key in chest
      const chestEntity = entityRegistry.getEntity('items', chest.id) || 
                         (global.Item && global.Item.list && global.Item.list[chest.id]);
      if (chestEntity && chestEntity.inventory) {
        player.inventory.key--;
        player.inventory.keyRing.splice(num, 1);
        if (!chestEntity.inventory.key) chestEntity.inventory.key = 0;
        if (!chestEntity.inventory.keyRing) chestEntity.inventory.keyRing = [];
        chestEntity.inventory.key++;
        chestEntity.inventory.keyRing.push(key);
        this.sendMessage(socket, `Placed key in chest.`);
        return true;
      }
    }

    // Drop key on ground or underwater
    const dropZ = this.getDropZ(z, pos[0], pos[1]);
    if (dropZ === null) {
      this.sendError(socket, 'You cannot drop that there.');
      return false;
    }

    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    const coords = getCoords(pos[0], pos[1]);

    if (typeof global.Key === 'function') {
      global.Key({
        z: dropZ,
        x: coords[0],
        y: coords[1],
        id: key.id,
        name: key.name,
        qty: 1,
        parent: player.id
      });
      player.inventory.key--;
      player.inventory.keyRing.splice(num, 1);
      return true;
    }

    return false;
  }

  /**
   * Drop an item
   * @param {object} player - Player entity
   * @param {string} itemType - Item type
   * @param {number} quantity - Quantity to drop
   * @param {object} data - Command data
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  dropItem(player, itemType, quantity, data, socket) {
    const z = player.z;
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y);
    const c = loc[0];
    const r = loc[1];

    // Get position based on facing
    const pos = this.getDropPosition(player.facing, c, r);
    if (!pos) {
      this.sendError(socket, 'Cannot drop item in that direction.');
      return false;
    }

    // Check for chest
    const chest = this.checkChest(z, pos[0], pos[1], player.id);
    if (chest) {
      return this.dropItemInChest(player, itemType, quantity, chest, socket);
    }

    // Drop item on ground or underwater
    const dropZ = this.getDropZ(z, pos[0], pos[1]);
    if (dropZ === null) {
      this.sendError(socket, 'You cannot drop that there.');
      return false;
    }

    // Create item using itemFactory
    const itemFactory = systemRegistry.get('itemFactory') || global.itemFactory;
    const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
    const coords = getCoords(pos[0], pos[1]);

    // Get item constructor name (capitalize first letter)
    const itemConstructorName = itemType.charAt(0).toUpperCase() + itemType.slice(1);
    
    // Check if global constructor exists (e.g., global.Wood, global.Stone)
    if (typeof global[itemConstructorName] === 'function') {
      const itemParams = {
        z: dropZ,
        x: coords[0],
        y: coords[1],
        qty: quantity,
        parent: player.id
      };

      // Special case for wood (innaWoods)
      if (itemType === 'wood' && player.innaWoods !== undefined) {
        itemParams.innaWoods = player.innaWoods || false;
      }

      global[itemConstructorName](itemParams);
      player.inventory[itemType] -= quantity;
      if (player.inventory[itemType] <= 0) {
        player.inventory[itemType] = 0;
      }
      return true;
    } else if (itemFactory && typeof itemFactory.createItem === 'function') {
      // Use itemFactory as fallback
      itemFactory.createItem(itemType, {
        z: dropZ,
        x: coords[0],
        y: coords[1],
        qty: quantity,
        parent: player.id
      });
      player.inventory[itemType] -= quantity;
      if (player.inventory[itemType] <= 0) {
        player.inventory[itemType] = 0;
      }
      return true;
    }

    this.sendError(socket, `Unknown item type: ${itemType}`);
    return false;
  }

  /**
   * Drop item in chest
   * @param {object} player - Player entity
   * @param {string} itemType - Item type
   * @param {number} quantity - Quantity
   * @param {object} chest - Chest entity
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  dropItemInChest(player, itemType, quantity, chest, socket) {
    const chestEntity = entityRegistry.getEntity('items', chest.id) || 
                       (global.Item && global.Item.list && global.Item.list[chest.id]);
    
    if (!chestEntity || !chestEntity.inventory) {
      this.sendError(socket, 'You do not have the key to this chest.');
      return false;
    }

    player.inventory[itemType] -= quantity;
    if (!chestEntity.inventory[itemType]) {
      chestEntity.inventory[itemType] = 0;
    }
    chestEntity.inventory[itemType] += quantity;
    
    if (player.inventory[itemType] <= 0) {
      player.inventory[itemType] = 0;
    }

    this.sendMessage(socket, `Placed ${quantity} ${itemType} in chest.`);
    return true;
  }

  /**
   * Get drop position based on facing direction
   * @param {string} facing - Facing direction
   * @param {number} c - Column
   * @param {number} r - Row
   * @returns {Array|null} [c, r] or null
   */
  getDropPosition(facing, c, r) {
    switch (facing) {
      case 'up':
        return [c, r - 1];
      case 'down':
        return [c, r + 1];
      case 'left':
        return [c - 1, r];
      case 'right':
        return [c + 1, r];
      default:
        return null;
    }
  }

  /**
   * Check if there's a chest at position
   * @param {number} z - Z level
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {string} playerId - Player ID
   * @returns {object|null} Chest entity or null
   */
  checkChest(z, c, r, playerId) {
    const getItem = global.getItem || ((z, c, r) => {
      // Check for items at position
      const items = entityRegistry.getEntities('items') || 
                   (global.Item && global.Item.list ? Object.values(global.Item.list) : []);
      
      for (const item of items) {
        if (item.z === z && item.x !== undefined && item.y !== undefined) {
          const itemLoc = global.getLoc ? global.getLoc(item.x, item.y) : 
                         [Math.floor(item.x / 64), Math.floor(item.y / 64)];
          if (itemLoc[0] === c && itemLoc[1] === r) {
            if (item.type === 'Chest' || item.type === 'LockedChest') {
              return item;
            }
          }
        }
      }
      return null;
    });

    const itemType = getItem(z, c, r);
    if (itemType === 'LockedChest' || itemType === 'Chest') {
      const chestCheck = global.chestCheck || ((z, x, y, playerId) => {
        const items = entityRegistry.getEntities('items') || [];
        for (const item of items) {
          if (item.type === 'Chest' || item.type === 'LockedChest') {
            const itemCoords = global.getCoords ? global.getCoords(c, r) : [c * 64, r * 64];
            if (Math.abs(item.x - itemCoords[0]) < 32 && Math.abs(item.y - itemCoords[1]) < 32) {
              return item.id;
            }
          }
        }
        return null;
      });

      const getCoords = global.getCoords || ((c, r) => [c * 64, r * 64]);
      const coords = getCoords(c, r);
      const chestId = chestCheck(z, coords[0], coords[1], playerId);
      
      if (chestId) {
        return { id: chestId, type: itemType };
      }
    }

    return null;
  }

  /**
   * Get drop Z level (handles underwater drops)
   * @param {number} z - Current Z level
   * @param {number} c - Column
   * @param {number} r - Row
   * @returns {number|null} Drop Z level or null if invalid
   */
  getDropZ(z, c, r) {
    const isWalkable = global.isWalkable || ((z, c, r) => {
      const getTile = global.getTile || ((layer, c, r) => {
        const tilemap = systemRegistry.get('tilemap') || global.tilemapSystem;
        return tilemap ? tilemap.getTile(layer, c, r) : null;
      });
      
      // Check if tile is walkable
      const tile = getTile(0, c, r);
      const matrix = getTile(1, c, r);
      return matrix === 0 && tile !== 0 && tile !== 1;
    });

    const getTile = global.getTile || ((layer, c, r) => {
      const tilemap = systemRegistry.get('tilemap') || global.tilemapSystem;
      return tilemap ? tilemap.getTile(layer, c, r) : null;
    });

    // Check if walkable
    if (isWalkable(z, c, r)) {
      return z;
    }

    // Check if underwater (z=0 and tile is water)
    if (z === 0 && getTile(0, c, r) === 0) {
      return -3; // Underwater Z level
    }

    return null; // Cannot drop here
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

module.exports = DropCommand;
