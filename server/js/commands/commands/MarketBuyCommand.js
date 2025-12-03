/**
 * MarketBuyCommand - Handles /buy command
 * 
 * Places buy orders in markets.
 */

const entityRegistry = require('../../core/EntityRegistry');

class MarketBuyCommand {
  constructor() {
    this.name = 'buy';
  }

  /**
   * Execute the buy command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    // Check if player is in a market building
    if (player.z !== 1 && player.z !== 2) {
      this.sendError(socket, 'You must be inside a market to place orders');
      return false;
    }

    const getBuilding = global.getBuilding || ((x, y) => null);
    const buildingId = getBuilding(player.x, player.y);
    const market = buildingId && global.Building && global.Building.list && global.Building.list[buildingId];
    
    if (!market || market.type !== 'market') {
      this.sendError(socket, 'You must be inside a market to place orders');
      return false;
    }

    const parts = data.cmd.trim().split(' ');
    if (parts.length !== 4) {
      this.sendUsage(socket);
      return false;
    }

    const amount = parseInt(parts[1]);
    const resource = parts[2].toLowerCase();
    const price = parseInt(parts[3]);

    if (isNaN(amount) || isNaN(price)) {
      this.sendUsage(socket);
      return false;
    }

    if (typeof global.processBuyOrder === 'function') {
      global.processBuyOrder(data.id, market, resource, amount, price);
      return true;
    }

    this.sendError(socket, 'Market system not available');
    return false;
  }

  sendUsage(socket) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: '<i>❌ Usage: /buy [amount] [item] [price]<br>Example: /buy 100 grain 5<br><br>Items: grain, wood, stone, ironore, silverore, goldore, diamond, iron</i>'
    }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>❌ ${message}</i>` }));
  }
}

module.exports = MarketBuyCommand;
