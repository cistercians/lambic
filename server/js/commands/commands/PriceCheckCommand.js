/**
 * PriceCheckCommand - Handles $[resource] price checking
 * 
 * Shows current market prices for resources.
 */

const entityRegistry = require('../../core/EntityRegistry');

class PriceCheckCommand {
  constructor() {
    this.name = '$';
  }

  /**
   * Execute the price check command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    const resource = data.cmd.substring(1).toLowerCase().trim();
    
    if (!resource) {
      this.sendUsage(socket);
      return false;
    }

    // Check if player is in a market building
    if (player.z !== 1 && player.z !== 2) {
      this.sendError(socket, 'You must be inside a market to check prices');
      return false;
    }

    const getBuilding = global.getBuilding || ((x, y) => null);
    const buildingId = getBuilding(player.x, player.y);
    const market = buildingId && global.Building && global.Building.list && global.Building.list[buildingId];
    
    if (!market || market.type !== 'market') {
      this.sendError(socket, 'You must be inside a market to check prices');
      return false;
    }

    if (!market.orderbook || !market.orderbook[resource]) {
      this.sendError(socket, `Invalid resource: ${resource}`);
      return false;
    }

    const book = market.orderbook[resource];
    const emoji = (market.resourceEmoji && market.resourceEmoji[resource]) || '📦';

    // Sort to get best prices
    if (book.asks && Array.isArray(book.asks)) {
      book.asks.sort((a, b) => a.price - b.price);
    }
    if (book.bids && Array.isArray(book.bids)) {
      book.bids.sort((a, b) => b.price - a.price);
    }

    const bestAsk = book.asks && book.asks.length > 0 ? book.asks[0].price : null;
    const bestBid = book.bids && book.bids.length > 0 ? book.bids[0].price : null;

    let message = `<b>${emoji} ${resource.toUpperCase()} PRICES</b><br>`;

    if (bestAsk !== null) {
      message += `<span style="color:#ff6666;">SELL (Ask): ${bestAsk} silver</span>`;
      if (book.asks[0].amount) {
        message += ` (${book.asks[0].amount} available)`;
      }
    } else {
      message += '<span style="color:#888888;">SELL (Ask): No sellers</span>';
    }

    message += '<br>';

    if (bestBid !== null) {
      message += `<span style="color:#66ff66;">BUY (Bid): ${bestBid} silver</span>`;
      if (book.bids[0].amount) {
        message += ` (${book.bids[0].amount} wanted)`;
      }
    } else {
      message += '<span style="color:#888888;">BUY (Bid): No buyers</span>';
    }

    // Show spread if both exist
    if (bestAsk !== null && bestBid !== null) {
      const spread = bestAsk - bestBid;
      message += `<br><i>Spread: ${spread} silver</i>`;
    }

    socket.write(JSON.stringify({ msg: 'addToChat', message }));
    return true;
  }

  sendUsage(socket) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: '<i>Usage: $[item]<br>Example: $ironore<br><br>Items: grain, wood, stone, ironore, silverore, goldore, diamond, iron</i>'
    }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>❌ ${message}</i>` }));
  }
}

module.exports = PriceCheckCommand;
