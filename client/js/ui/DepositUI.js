/**
 * DepositUI - Manages deposit/withdraw UI display
 * 
 * Extracted from client.js for better organization.
 */

class DepositUI {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Update deposit display
   * @param {object} building - Building entity
   * @param {object} player - Player entity
   */
  updateDepositDisplay(building, player) {
    const depositPopup = document.getElementById('deposit-popup');
    if (!depositPopup) return;

    if (!building || building.type !== 'stronghold') {
      depositPopup.style.display = 'none';
      return;
    }

    // Show popup
    depositPopup.style.display = 'block';

    // Get resources
    const buildingResources = building.stores || {};
    const playerResources = player.stores || {};
    const houseResources = (player.house && typeof houseList !== 'undefined' && houseList && houseList[player.house] && houseList[player.house].stores) || {};

    // Build resource list
    const resources = ['wood', 'stone', 'grain', 'iron', 'silver', 'gold'];
    let html = '<h3>🏰 Stronghold Storage</h3>';
    html += '<div class="deposit-grid">';

    for (const resource of resources) {
      const buildingQty = buildingResources[resource] || 0;
      const playerQty = playerResources[resource] || 0;
      const houseQty = houseResources[resource] || 0;

      html += `<div class="resource-row">`;
      html += `<span class="resource-name">${resource}</span>`;
      html += `<span class="resource-qty building">${buildingQty}</span>`;
      html += `<span class="resource-qty player">${playerQty}</span>`;
      html += `<span class="resource-qty house">${houseQty}</span>`;
      
      // Add deposit/withdraw buttons
      html += `<button onclick="depositResource('${resource}')">Deposit</button>`;
      html += `<button onclick="withdrawResource('${resource}')">Withdraw</button>`;
      
      html += `</div>`;
    }

    html += '</div>';
    
    const depositContent = document.getElementById('deposit-content');
    if (depositContent) {
      depositContent.innerHTML = html;
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.DepositUI = DepositUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DepositUI;
}
