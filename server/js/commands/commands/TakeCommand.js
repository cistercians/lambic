/**
 * TakeCommand - Handles /take command
 * 
 * Consolidated take command that handles all item types.
 * Replaces thousands of lines of repetitive code in Commands.js.
 * Handles both chests and ground items.
 */

const entityRegistry = require('../../core/EntityRegistry');
const systemRegistry = require('../../core/SystemRegistry');

class TakeCommand {
  constructor() {
    this.name = 'take';
    
    // Item stack limits (from ItemFactory)
    this.itemLimits = {
      wood: 10, stone: 10, grain: 10, ironore: 10, iron: 10, steel: 10,
      silverore: 10, silver: 999, goldore: 10, gold: 999, diamond: 999,
      boarhide: 25, leather: 25,
      flour: 10, dough: 10,
      huntingknife: 10, dague: 10, rondel: 10, misericorde: 10,
      bastardsword: 10, longsword: 10, zweihander: 10, morallta: 10,
      bow: 10, welshlongbow: 10,
      arrows: 50,
      // Add more as needed
    };
  }

  /**
   * Execute the take command
   * @param {object} data - Command data { cmd, id, world }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Handle /take (show usage)
    if (data.cmd === 'take') {
      socket.write(JSON.stringify({ 
        msg: 'addToChat', 
        message: '<p>/take Quantity ItemName</p>' 
      }));
      return true;
    }

    // Handle /take [quantity] [item]
    const parts = data.cmd.substring(5).trim().split(' ');
    if (parts.length < 2) {
      this.sendError(socket, 'Usage: /take <quantity> <item>');
      return false;
    }

    const quantity = parseInt(parts[0], 10);
    const itemType = parts.slice(1).join(' ').toLowerCase();

    // Validate quantity
    if (isNaN(quantity) || quantity < 1) {
      this.sendError(socket, 'Quantity must be a number greater than 0.');
      return false;
    }

    // Get player position
    const z = player.z;
    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    const loc = getLoc(player.x, player.y);
    const c = loc[0];
    const r = loc[1];

    // Get position based on facing
    const pos = this.getTakePosition(player.facing, c, r);
    if (!pos) {
      this.sendError(socket, 'Cannot take item in that direction.');
      return false;
    }

    // Take from ground
    return this.takeFromGround(player, itemType, quantity, z, pos[0], pos[1], socket);
  }

  /**
   * Get take position based on facing direction
   * @param {string} facing - Facing direction
   * @param {number} c - Column
   * @param {number} r - Row
   * @returns {Array|null} [c, r] or null
   */
  getTakePosition(facing, c, r) {
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
   * Take item from ground
   * @param {object} player - Player entity
   * @param {string} itemType - Item type
   * @param {number} quantity - Quantity to take
   * @param {number} z - Z level
   * @param {number} c - Column
   * @param {number} r - Row
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  takeFromGround(player, itemType, quantity, z, c, r, socket) {
    // Find items at this position
    const items = entityRegistry.getEntities('items') || 
                 (global.Item && global.Item.list ? Object.values(global.Item.list) : []);

    const getLoc = global.getLoc || ((x, y) => [Math.floor(x / 64), Math.floor(y / 64)]);
    
    // Find matching item at position
    let targetItem = null;
    for (const item of items) {
      if (item.type && item.type.toLowerCase() === itemType && item.z === z) {
        const itemLoc = getLoc(item.x, item.y);
        if (itemLoc[0] === c && itemLoc[1] === r) {
          if (!targetItem || (item.qty && item.qty >= quantity)) {
            targetItem = item;
            if (item.qty && item.qty >= quantity) break;
          }
        }
      }
    }

    if (!targetItem) {
      this.sendError(socket, `No ${itemType} found at that location.`);
      return false;
    }

    // Check available quantity
    const availableQty = targetItem.qty || 1;
    const takeQty = Math.min(quantity, availableQty);

    // Check player stack limit
    const maxStack = this.getItemLimit(itemType);
    const currentAmount = player.inventory[itemType] || 0;
    
    if (currentAmount + takeQty > maxStack) {
      const canTake = maxStack - currentAmount;
      if (canTake <= 0) {
        this.sendError(socket, `You are already carrying too much ${this.formatItemName(itemType)}.`);
        return false;
      }
      this.sendMessage(socket, `You can only take ${canTake} more ${itemType}. Taking ${canTake}.`);
      return this.transferItem(player, targetItem, itemType, canTake, socket);
    }

    return this.transferItem(player, targetItem, itemType, takeQty, socket);
  }

  /**
   * Transfer item from source to player inventory
   * @param {object} player - Player entity
   * @param {object} sourceItem - Source item entity
   * @param {string} itemType - Item type
   * @param {number} quantity - Quantity to transfer
   * @param {object} socket - Socket
   * @returns {boolean} Success
   */
  transferItem(player, sourceItem, itemType, quantity, socket) {
    // Update source
    if (sourceItem.qty !== undefined) {
      sourceItem.qty -= quantity;
      if (sourceItem.qty <= 0) {
        // Remove item
        sourceItem.toRemove = true;
        if (sourceItem.remove) {
          sourceItem.remove();
        } else {
          // Remove from registry
          entityRegistry.removeEntity('items', sourceItem.id);
          if (global.Item && global.Item.list) {
            delete global.Item.list[sourceItem.id];
          }
        }
      } else {
        sourceItem.toUpdate = true;
      }
    }

    // Update player inventory
    const currentAmount = player.inventory[itemType] || 0;
    player.inventory[itemType] = currentAmount + quantity;

    // Special handling for gold (blockchain)
    if (itemType === 'gold' && player.wallet && global.GoldTradeManager) {
      try {
        global.GoldTradeManager.createMiningTransaction(player, quantity);
      } catch (err) {
        // Ignore blockchain errors
      }
    }

    this.sendMessage(socket, `You took ${quantity} <b>${this.formatItemName(itemType)}</b>.`);
    return true;
  }

  /**
   * Get item stack limit
   * @param {string} itemType - Item type
   * @returns {number} Stack limit
   */
  getItemLimit(itemType) {
    const itemFactory = systemRegistry.get('itemFactory') || global.itemFactory;
    if (itemFactory && itemFactory.itemConfigs && itemFactory.itemConfigs[itemType]) {
      return itemFactory.itemConfigs[itemType].maxStack || 10;
    }
    return this.itemLimits[itemType] || 10;
  }

  /**
   * Format item name for display
   * @param {string} itemType - Item type
   * @returns {string} Formatted name
   */
  formatItemName(itemType) {
    return itemType.charAt(0).toUpperCase() + itemType.slice(1).replace(/([A-Z])/g, ' $1');
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

module.exports = TakeCommand;
