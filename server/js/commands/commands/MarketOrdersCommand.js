/**
 * MarketOrdersCommand - Handles /orders command
 * 
 * Lists active market orders for a player.
 */

const entityRegistry = require('../../core/EntityRegistry');

class MarketOrdersCommand {
  constructor() {
    this.name = 'orders';
  }

  /**
   * Execute the orders command
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
      this.sendError(socket, 'You must be inside a market to view orders');
      return false;
    }

    const getBuilding = global.getBuilding || ((x, y) => null);
    const buildingId = getBuilding(player.x, player.y);
    const market = buildingId && global.Building && global.Building.list && global.Building.list[buildingId];
    
    if (!market || market.type !== 'market') {
      this.sendError(socket, 'You must be inside a market to view orders');
      return false;
    }

    let message = '<b><u>📋 Your Active Orders</u></b><br>';
    let hasOrders = false;

    if (market.orderbook) {
      for (const resource in market.orderbook) {
        const book = market.orderbook[resource];
        const emoji = (market.resourceEmoji && market.resourceEmoji[resource]) || '📦';

        // Check buy orders
        if (book.bids && Array.isArray(book.bids)) {
          for (const bid of book.bids) {
            if (bid.player === data.id) {
              hasOrders = true;
              message += `<br><span style="color:#66ff66;">BUY ${emoji} ${resource.toUpperCase()}</span>`;
              message += `<br>&nbsp;&nbsp;${bid.amount} @ ${bid.price} silver`;
              if (bid.orderId) {
                message += `<br>&nbsp;&nbsp;<i>ID: ${bid.orderId.substr(0, 8)}</i>`;
              }
            }
          }
        }

        // Check sell orders
        if (book.asks && Array.isArray(book.asks)) {
          for (const ask of book.asks) {
            if (ask.player === data.id) {
              hasOrders = true;
              message += `<br><span style="color:#ff6666;">SELL ${emoji} ${resource.toUpperCase()}</span>`;
              message += `<br>&nbsp;&nbsp;${ask.amount} @ ${ask.price} silver`;
              if (ask.orderId) {
                message += `<br>&nbsp;&nbsp;<i>ID: ${ask.orderId.substr(0, 8)}</i>`;
              }
            }
          }
        }
      }
    }

    if (!hasOrders) {
      message += '<br><i>No active orders</i>';
    } else {
      message += '<br><br><i>Use /cancel [orderID] to cancel an order</i>';
    }

    socket.write(JSON.stringify({ msg: 'addToChat', message }));
    return true;
  }

  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>❌ ${message}</i>` }));
  }
}

module.exports = MarketOrdersCommand;
