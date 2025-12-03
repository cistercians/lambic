/**
 * MarketUI - Manages market display and UI
 * 
 * Extracted from client.js for better organization.
 */

class MarketUI {
  constructor() {
    this.getItemEmoji = this.getItemEmoji.bind(this);
  }

  /**
   * Get emoji for item type
   * @param {string} itemType - Item type
   * @returns {string} Emoji
   */
  getItemEmoji(itemType) {
    const emojis = {
      grain: '🌾', wood: '🪵', stone: '🪨', ironore: '⛏️', iron: '🔩',
      silverore: '✨', silver: '💍', goldore: '⭐', gold: '👑', diamond: '💎',
      bread: '🍞', fish: '🐟', torch: '🔦', arrows: '🏹', beer: '🍺'
    };
    return emojis[itemType] || '📦';
  }

  /**
   * Update market display
   * @param {object} marketData - Market data { orderbook, playerOrders }
   */
  updateMarketDisplay(marketData) {
    if (!marketData) return;

    const orderbook = marketData.orderbook || {};
    const playerOrders = marketData.playerOrders || [];

    // Get DOM elements (would be injected in real implementation)
    const marketOrderbook = document.getElementById('market-orderbook');
    const marketPlayerOrdersList = document.getElementById('market-player-orders-list');
    
    if (!marketOrderbook || !marketPlayerOrdersList) return;

    // Clear displays
    marketOrderbook.innerHTML = '';
    marketPlayerOrdersList.innerHTML = '';

    // Display orderbook
    const resources = Object.keys(orderbook).sort();

    for (const resource of resources) {
      const book = orderbook[resource];

      if ((book.bids && book.bids.length > 0) || (book.asks && book.asks.length > 0)) {
        const resourceBlock = document.createElement('div');
        resourceBlock.className = 'market-resource-block';

        const emoji = this.getItemEmoji(resource);
        const title = document.createElement('h4');
        title.style.margin = '0 0 10px 0';
        title.textContent = `${emoji} ${resource.toUpperCase()}`;
        resourceBlock.appendChild(title);

        // Sort and display sell orders (asks - low to high)
        if (book.asks && Array.isArray(book.asks)) {
          const sortedAsks = book.asks.slice().sort((a, b) => a.price - b.price);
          if (sortedAsks.length > 0) {
            const sellHeader = document.createElement('div');
            sellHeader.style.color = '#ff6666';
            sellHeader.style.fontWeight = 'bold';
            sellHeader.style.marginBottom = '5px';
            sellHeader.textContent = 'SELL ORDERS';
            resourceBlock.appendChild(sellHeader);

            const showAsks = sortedAsks.slice(0, 3);
            for (const ask of showAsks) {
              const orderDiv = document.createElement('div');
              orderDiv.className = 'market-order sell';
              orderDiv.textContent = `${ask.amount} @ ${ask.price} silver`;
              resourceBlock.appendChild(orderDiv);
            }

            if (sortedAsks.length > 3) {
              const more = document.createElement('div');
              more.style.fontSize = '12px';
              more.style.color = '#888';
              more.textContent = `... +${sortedAsks.length - 3} more`;
              resourceBlock.appendChild(more);
            }
          }
        }

        // Sort and display buy orders (bids - high to low)
        if (book.bids && Array.isArray(book.bids)) {
          const sortedBids = book.bids.slice().sort((a, b) => b.price - a.price);
          if (sortedBids.length > 0) {
            const buyHeader = document.createElement('div');
            buyHeader.style.color = '#66ff66';
            buyHeader.style.fontWeight = 'bold';
            buyHeader.style.marginTop = '10px';
            buyHeader.style.marginBottom = '5px';
            buyHeader.textContent = 'BUY ORDERS';
            resourceBlock.appendChild(buyHeader);

            const showBids = sortedBids.slice(0, 3);
            for (const bid of showBids) {
              const orderDiv = document.createElement('div');
              orderDiv.className = 'market-order buy';
              orderDiv.textContent = `${bid.amount} @ ${bid.price} silver`;
              resourceBlock.appendChild(orderDiv);
            }

            if (sortedBids.length > 3) {
              const more = document.createElement('div');
              more.style.fontSize = '12px';
              more.style.color = '#888';
              more.textContent = `... +${sortedBids.length - 3} more`;
              resourceBlock.appendChild(more);
            }
          }
        }

        marketOrderbook.appendChild(resourceBlock);
      }
    }

    if (marketOrderbook.innerHTML === '') {
      marketOrderbook.innerHTML = '<p style="color:#888;padding:20px;">No active orders in this market</p>';
    }

    // Display player's orders
    if (playerOrders && playerOrders.length > 0) {
      for (const order of playerOrders) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'player-order';

        const emoji = this.getItemEmoji(order.resource);
        const typeColor = order.type === 'buy' ? '#66ff66' : '#ff6666';
        const typeText = order.type.toUpperCase();

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-order-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = (() => {
          const orderId = order.orderId;
          return () => {
            if (typeof socket !== 'undefined' && typeof selfId !== 'undefined') {
              socket.send(JSON.stringify({
                msg: 'evalCmd',
                cmd: `/cancel ${orderId.substr(0, 8)}`
              }));
            }
            const marketPopup = document.getElementById('market-popup');
            if (marketPopup) {
              setTimeout(() => {
                marketPopup.style.display = 'none';
              }, 100);
            }
          };
        })();
        orderDiv.appendChild(cancelBtn);

        const orderText = document.createElement('div');
        orderText.innerHTML = `<span style="color:${typeColor}">${typeText}</span> ${emoji} ${order.resource}<br>${order.amount} @ ${order.price} silver`;
        orderDiv.appendChild(orderText);

        marketPlayerOrdersList.appendChild(orderDiv);
      }
    } else {
      marketPlayerOrdersList.innerHTML = '<p style="color:#888;padding:10px;font-size:12px;">No active orders</p>';
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.MarketUI = MarketUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarketUI;
}
