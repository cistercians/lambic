/**
 * DockUI - Manages dock display and ship UI
 * 
 * Extracted from client.js for better organization.
 */

class DockUI {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Update dock display
   * @param {object} dockData - Dock data { availableShips, ownedShips, cargoShips, playerResources, dockName }
   */
  updateDockDisplay(dockData) {
    if (!dockData) return;

    const availableShips = dockData.availableShips || [];
    const ownedShips = dockData.ownedShips || [];
    const cargoShips = dockData.cargoShips || [];
    const playerResources = dockData.playerResources || {};
    const dockName = dockData.dockName || 'Dock';
    const dockId = dockData.dockId;

    // Update dock title with dock's zone name
    const dockHeader = document.getElementById('dock-header');
    if (dockHeader) {
      const titleElement = dockHeader.querySelector('h3');
      if (titleElement) {
        titleElement.textContent = `⚓ ${dockName} - Ship Management`;
      }
    }

    // Get DOM elements (would be injected)
    const dockShipList = document.getElementById('dock-ship-list');
    const dockOwnedShipsList = document.getElementById('dock-owned-ships-list');
    const dockCargoShipsList = document.getElementById('dock-cargo-ships-list');

    if (!dockShipList || !dockOwnedShipsList || !dockCargoShipsList) return;

    // Clear displays
    dockShipList.innerHTML = '';
    dockOwnedShipsList.innerHTML = '';
    dockCargoShipsList.innerHTML = '';

    // Display cargo ships
    this.renderCargoShips(cargoShips, dockCargoShipsList);

    // Display available ships to build
    this.renderAvailableShips(availableShips, playerResources, dockShipList, dockId);

    // Display owned ships
    this.renderOwnedShips(ownedShips, dockOwnedShipsList);
  }

  /**
   * Render cargo ships
   * @param {Array} cargoShips - Array of cargo ship data
   * @param {HTMLElement} container - Container element
   */
  renderCargoShips(cargoShips, container) {
    if (cargoShips.length === 0) {
      container.innerHTML = '<p style="color:#888;padding:15px;font-size:13px;">No cargo ships at this dock</p>';
      return;
    }

    for (const cargo of cargoShips) {
      const cargoDiv = document.createElement('div');
      cargoDiv.className = 'dock-cargo-ship';
      cargoDiv.style.backgroundColor = 'rgba(50, 100, 150, 0.3)';
      cargoDiv.style.border = '2px solid rgba(100, 150, 200, 0.5)';
      cargoDiv.style.borderRadius = '5px';
      cargoDiv.style.padding = '15px';
      cargoDiv.style.marginBottom = '10px';
      cargoDiv.style.cursor = 'pointer';

      const destDiv = document.createElement('div');
      destDiv.style.fontSize = '16px';
      destDiv.style.fontWeight = 'bold';
      destDiv.style.color = '#aaddff';
      destDiv.style.marginBottom = '8px';
      destDiv.textContent = `→ ${cargo.destination}`;
      cargoDiv.appendChild(destDiv);

      const infoDiv = document.createElement('div');
      infoDiv.style.fontSize = '13px';
      infoDiv.style.color = '#ccc';
      infoDiv.style.marginBottom = '8px';
      infoDiv.textContent = `Passengers: ${cargo.passengerCount || 0}/${cargo.maxPassengers || 0} | Departs in ${cargo.departureTime || 0}s`;
      cargoDiv.appendChild(infoDiv);

      const actionDiv = document.createElement('div');
      actionDiv.style.fontSize = '14px';
      actionDiv.style.fontWeight = 'bold';
      actionDiv.style.color = '#66ff66';
      actionDiv.textContent = '⚓ Click to board';
      cargoDiv.appendChild(actionDiv);

      cargoDiv.onclick = (() => {
        const cargoId = cargo.id;
        return () => {
          if (typeof socket !== 'undefined' && typeof selfId !== 'undefined' && typeof world !== 'undefined') {
            socket.send(JSON.stringify({
              msg: 'evalCmd',
              id: selfId,
              cmd: `boardship ${cargoId}`,
              world: world
            }));
          }
          const dockPopup = document.getElementById('dock-popup');
          if (dockPopup) {
            dockPopup.style.display = 'none';
          }
        };
      })();

      container.appendChild(cargoDiv);
    }
  }

  /**
   * Render available ships to build
   * @param {Array} availableShips - Array of ship definitions
   * @param {object} playerResources - Player resources
   * @param {HTMLElement} container - Container element
   */
  renderAvailableShips(availableShips, playerResources, container, dockId) {
    for (const ship of availableShips) {
      const shipDiv = document.createElement('div');
      shipDiv.className = 'dock-ship-item';

      const shipName = document.createElement('h4');
      shipName.textContent = ship.name || 'Ship';
      shipDiv.appendChild(shipName);

      const costDiv = document.createElement('div');
      costDiv.className = 'dock-ship-cost';
      costDiv.textContent = `Cost: ${ship.cost?.wood || 0} Wood`;
      shipDiv.appendChild(costDiv);

      if (ship.description) {
        const descDiv = document.createElement('div');
        descDiv.className = 'dock-ship-desc';
        descDiv.textContent = ship.description;
        shipDiv.appendChild(descDiv);
      }

      const statusDiv = document.createElement('div');
      if (ship.canAfford) {
        statusDiv.className = 'dock-ship-available';
        statusDiv.textContent = '✓ Click to build';
        shipDiv.style.cursor = 'pointer';
        shipDiv.onclick = (() => {
          const command = dockId ? `/fishboat ${dockId}` : '/fishboat';
          return () => {
            if (typeof socket !== 'undefined') {
              socket.send(JSON.stringify({
                msg: 'msgToServer',
                name: 'system',
                message: command
              }));
            }
            const dockPopup = document.getElementById('dock-popup');
            if (dockPopup) {
              dockPopup.style.display = 'none';
            }
          };
        })();
      } else {
        statusDiv.className = 'dock-ship-unavailable';
        const woodNeeded = (ship.cost?.wood || 0) - (playerResources.wood || 0);
        statusDiv.textContent = `✗ Need ${woodNeeded} more Wood`;
        shipDiv.style.cursor = 'not-allowed';
        shipDiv.style.opacity = '0.6';
      }
      shipDiv.appendChild(statusDiv);

      container.appendChild(shipDiv);
    }
  }

  /**
   * Render owned ships
   * @param {Array} ownedShips - Array of owned ship data
   * @param {HTMLElement} container - Container element
   */
  renderOwnedShips(ownedShips, container) {
    if (ownedShips.length === 0) {
      container.innerHTML = '<p style="color:#888;padding:20px;font-size:14px;">No ships owned yet. Build one!</p>';
      return;
    }

    for (const ship of ownedShips) {
      const shipDiv = document.createElement('div');
      shipDiv.className = 'dock-owned-ship';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'dock-owned-ship-name';
      nameDiv.textContent = ship.name || 'Ship';
      shipDiv.appendChild(nameDiv);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'dock-owned-ship-info';
      let inventoryText = `Fish: ${ship.inventory?.fish || 0}/20`;
      if (ship.storedPlayer) {
        inventoryText += ' | Status: At Sea';
      } else {
        inventoryText += ' | Status: Docked';
      }
      infoDiv.textContent = inventoryText;
      shipDiv.appendChild(infoDiv);

      const actionDiv = document.createElement('div');
      actionDiv.style.marginTop = '8px';
      actionDiv.style.fontSize = '13px';
      actionDiv.style.color = '#aaffaa';
      actionDiv.style.fontWeight = 'bold';
      actionDiv.textContent = '⚓ Click to board ship';
      shipDiv.appendChild(actionDiv);

      shipDiv.onclick = (() => {
        const shipId = ship.id;
        return () => {
          if (typeof socket !== 'undefined' && typeof selfId !== 'undefined' && typeof world !== 'undefined') {
            socket.send(JSON.stringify({
              msg: 'evalCmd',
              id: selfId,
              cmd: `boardship ${shipId}`,
              world: world
            }));
          }
          const dockPopup = document.getElementById('dock-popup');
          if (dockPopup) {
            dockPopup.style.display = 'none';
          }
        };
      })();

      container.appendChild(shipDiv);
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.DockUI = DockUI;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DockUI;
}
