/**
 * MarketCancelCommand - Handles /cancel command
 * 
 * Cancels active market orders.
 */

const entityRegistry = require('../../core/EntityRegistry');

class MarketCancelCommand {
  constructor() {
    this.name = 'cancel';
  }

  /**
   * Execute the cancel command
   * @param {object} data - Command data { cmd, id }
   * @returns {boolean} Success
   */
  execute(data) {
    const player = entityRegistry.getEntity('players', data.id);
    if (!player) return false;

    const socket = data.socket || (global.SOCKET_LIST && global.SOCKET_LIST[data.id]);
    if (!socket) return false;

    const parts = data.cmd.trim().split(' ');
    if (parts.length < 2) {
      this.sendUsage(socket);
      return false;
    }

    const orderId = parts[1].trim();
    if (!orderId) {
      this.sendUsage(socket);
      return false;
    }

    // Check if player is in a market building
    if (player.z !== 1 && player.z !== 2) {
      this.sendError(socket, 'You must be inside a market to cancel orders');
      return false;
    }

    const getBuilding = global.getBuilding || ((x, y) => null);
    const buildingId = getBuilding(player.x, player.y);
    const market = buildingId && global.Building && global.Building.list && global.Building.list[buildingId];
    
    if (!market || market.type !== 'market') {
      this.sendError(socket, 'You must be inside a market to cancel orders');
      return false;
    }

    let found = false;

    if (market.orderbook) {
      for (const resource in market.orderbook) {
        const book = market.orderbook[resource];
        const emoji = (market.resourceEmoji && market.resourceEmoji[resource]) || '📦';

        // Check buy orders
        if (book.bids && Array.isArray(book.bids)) {
          for (let i = 0; i < book.bids.length; i++) {
            const bid = book.bids[i];
            if (bid.player === data.id && bid.orderId && bid.orderId.indexOf(orderId) === 0) {
              // Cancel this buy order
              player.stores.silver = (player.stores.silver || 0) + (bid.reserved || 0);
              book.bids.splice(i, 1);
              found = true;
              this.sendMessage(socket, `✅ Cancelled BUY order for ${emoji} ${resource.toUpperCase()}<br>Returned ${bid.reserved || 0} silver`);
              break;
            }
          }
        }

        if (found) break;

        // Check sell orders
        if (book.asks && Array.isArray(book.asks)) {
          for (let i = 0; i < book.asks.length; i++) {
            const ask = book.asks[i];
            if (ask.player === data.id && ask.orderId && ask.orderId.indexOf(orderId) === 0) {
              // Cancel this sell order
              player.stores[resource] = (player.stores[resource] || 0) + (ask.reserved || 0);
              book.asks.splice(i, 1);
              found = true;
              this.sendMessage(socket, `✅ Cancelled SELL order for ${emoji} ${resource.toUpperCase()}<br>Returned ${ask.reserved || 0} ${resource}`);
              break;
            }
          }
        }

        if (found) break;
      }
    }

    if (!found) {
      this.sendError(socket, 'Order not found. Use /orders to see your order IDs');
      return false;
    }

    return true;
  }

  sendUsage(socket) {
    socket.write(JSON.stringify({
      msg: 'addToChat',
      message: '<i>❌ Usage: /cancel [orderID]<br>Use /orders to see your order IDs</i>'
    }));
  }

  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>${message}</i>` }));
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>❌ ${message}</i>` }));
  }
}

module.exports = MarketCancelCommand;
