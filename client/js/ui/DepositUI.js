/**
 * DepositUI - Manages deposit/withdraw UI display for economic buildings
 * 
 * Supports: lumbermill (wood), mill (grain), mine (stone/ores)
 */

class DepositUI {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Update deposit display
   * @param {object} building - Building entity
   * @param {object} player - Player entity (optional, not used for economic buildings)
   */
  updateDepositDisplay(building, player) {
    const depositPopup = document.getElementById('deposit-popup');
    const depositSliders = document.getElementById('deposit-sliders');
    const depositTitle = document.getElementById('deposit-title');
    
    if (!depositPopup || !depositSliders) return;

    // Only support economic buildings
    if (!building || (building.type !== 'lumbermill' && building.type !== 'mill' && building.type !== 'mine')) {
      depositPopup.style.display = 'none';
      return;
    }

    // Get resources from currentDepositData (sent by server)
    const currentDepositData = window.currentDepositData;
    if (!currentDepositData || !currentDepositData.resources) {
      depositPopup.style.display = 'none';
      return;
    }

    // Show popup
    depositPopup.style.display = 'block';

    // Set title based on building type
    const buildingNames = {
      'lumbermill': '🪵 Lumbermill',
      'mill': '🌾 Mill',
      'mine': '⛏️ Mine'
    };
    if (depositTitle) {
      depositTitle.textContent = buildingNames[building.type] || 'Deposit Resources';
    }

    // Clear existing sliders
    depositSliders.innerHTML = '';

    // Get resources to display based on building type
    const resources = currentDepositData.resources;
    const resourceList = [];

    if (building.type === 'lumbermill') {
      if (resources.wood > 0) {
        resourceList.push({ type: 'wood', amount: resources.wood, name: 'Wood' });
      }
    } else if (building.type === 'mill') {
      if (resources.grain > 0) {
        resourceList.push({ type: 'grain', amount: resources.grain, name: 'Grain' });
      }
    } else if (building.type === 'mine') {
      const mineResources = [
        { key: 'stone', name: 'Stone' },
        { key: 'ironore', name: 'Iron Ore' },
        { key: 'silverore', name: 'Silver Ore' },
        { key: 'goldore', name: 'Gold Ore' },
        { key: 'diamond', name: 'Diamond' }
      ];
      mineResources.forEach(res => {
        if (resources[res.key] > 0) {
          resourceList.push({ type: res.key, amount: resources[res.key], name: res.name });
        }
      });
    }

    // If no resources available, show message and close
    if (resourceList.length === 0) {
      depositSliders.innerHTML = '<p style="color: white; text-align: center; padding: 20px;">No resources available to deposit.</p>';
      return;
    }

    // Create sliders for each resource
    resourceList.forEach(resource => {
      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'deposit-slider-container';

      const label = document.createElement('div');
      label.className = 'deposit-slider-label';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'deposit-slider-name';
      nameSpan.textContent = resource.name;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'deposit-slider-value';
      valueSpan.id = `deposit-value-${resource.type}`;
      valueSpan.textContent = resource.amount.toString();

      label.appendChild(nameSpan);
      label.appendChild(valueSpan);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = resource.amount.toString();
      slider.value = resource.amount.toString(); // Set to max by default
      slider.className = 'deposit-slider';
      slider.dataset.resourceType = resource.type;

      // Update value display when slider changes
      slider.addEventListener('input', function() {
        valueSpan.textContent = this.value;
      });

      sliderContainer.appendChild(label);
      sliderContainer.appendChild(slider);
      depositSliders.appendChild(sliderContainer);
    });

    // Store building ID in currentDepositData.value for the confirm handler
    if (currentDepositData) {
      currentDepositData.value = {
        buildingId: currentDepositData.buildingId
      };
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
