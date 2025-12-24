/**
 * UIEventHandlers - Centralizes all popup and UI event handler setup
 * 
 * Extracted from client.js for better organization.
 */

class UIEventHandlers {
  constructor(config) {
    this.config = config || {};
    this.setupHandlers();
  }

  setupHandlers() {
    this.setupChatHandlers();
    this.setupDepositHandlers();
    this.setupInventoryHandlers();
    this.setupCharacterHandlers();
    this.setupBuildMenuHandlers();
    this.setupMarketHandlers();
    this.setupMapHandlers();
    this.setupContextMenuHandlers();
    this.setupHouseCreationHandlers();
  }

  setupChatHandlers() {
    const { chatForm, chatInput, socket, spectateCameraSystem, selfId, world, getPlayerIdForUI, Player } = this.config;
    
    // Try to get elements from config, or directly from DOM if not available
    let form = chatForm;
    let input = chatInput;
    
    // If elements aren't in config, try to get them from DOM
    if (!form) {
      form = document.getElementById('chat-form');
    }
    if (!input) {
      input = document.getElementById('chat-input');
    }
    
    // If still not available, set up retry mechanism
    if (!form || !input) {
      // Retry up to 5 times with increasing delays
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = setInterval(() => {
        retryCount++;
        const retryForm = document.getElementById('chat-form');
        const retryInput = document.getElementById('chat-input');
        
        if (retryForm && retryInput) {
          clearInterval(retryInterval);
          this.attachChatHandlers(retryForm, retryInput);
        } else if (retryCount >= maxRetries) {
          clearInterval(retryInterval);
          console.warn('Chat handlers: Could not find chat form or input after', maxRetries, 'retries');
        }
      }, 100); // Check every 100ms
      
      return;
    }
    
    // Elements are available, attach handlers immediately
    this.attachChatHandlers(form, input);
  }
  
  attachChatHandlers(chatForm, chatInput) {
    // Prevent duplicate handlers by checking if already attached
    if (chatForm._chatHandlerAttached || chatInput._chatHandlerAttached) {
      console.log('Chat handlers already attached, skipping');
      return;
    }
    
    // Handle form submission
    chatForm.onsubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Chat form submitted');
      this.submitChatMessage();
      return false;
    };
    chatForm._chatHandlerAttached = true;

    // Also handle Enter key directly on input (in case form submission doesn't work)
    // Use capture phase to ensure we handle it before document-level handlers
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.keyCode === 13) {
        console.log('Enter key pressed in chat input');
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling to document handlers
        e.stopImmediatePropagation(); // Also stop other handlers on same element
        // Small delay to ensure input value is captured
        setTimeout(() => {
          this.submitChatMessage();
        }, 0);
      }
    }, true); // Use capture phase
    chatInput._chatHandlerAttached = true;
  }

  submitChatMessage() {
    // Get current values from global scope, not static config (config is set at init time, before login)
    const input = document.getElementById('chat-input');
    if (!input) {
      console.error('Cannot submit chat: input element not found');
      return;
    }
    
    // Get current socket from window (updated after connection)
    const activeSocket = (typeof window !== 'undefined' && window.socket) ? window.socket : (this.config.socket || null);
    if (!activeSocket || typeof activeSocket.send !== 'function') {
      console.error('Cannot send chat: socket not available');
      input.value = '';
      input.blur();
      return;
    }
    
    // Get current values from global scope (these are updated after login/init)
    // Since these are global variables, access them via window or use Function to access global scope
    const getGlobal = (varName) => {
      if (typeof window !== 'undefined' && window[varName] !== undefined) {
        return window[varName];
      }
      try {
        return new Function('return typeof ' + varName + ' !== "undefined" ? ' + varName + ' : null')();
      } catch (e) {
        return null;
      }
    };
    
    const selfId = (typeof window !== 'undefined' && window.selfId !== undefined) ? window.selfId : (this.config.selfId || null);
    const world = (typeof window !== 'undefined' && window.world) ? window.world : (this.config.world || null);
    const spectateCameraSystem = (typeof window !== 'undefined' && window.spectateCameraSystem) ? window.spectateCameraSystem : (this.config.spectateCameraSystem || null);
    
    // Player is a global variable - try to get it from global scope
    let Player = getGlobal('Player') || this.config.Player || null;
    
    // getPlayerIdForUI is a global function
    let getPlayerIdForUI = getGlobal('getPlayerIdForUI') || this.config.getPlayerIdForUI || null;
    
    // If input is empty or only whitespace, just blur
    if (!input.value || input.value.trim() === '') {
      input.blur();
      return;
    }
    
    const messageValue = input.value;
    
    // Clear input immediately to prevent double submission
    input.value = '';
    
    // If in spectate mode, redirect all messages to spectator chat
    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      activeSocket.send(JSON.stringify({
        msg: 'spectatorChat',
        message: messageValue
      }));
    } else if (messageValue[0] === '/') { // command
      // Commands can work even without a valid player (server will handle it)
      activeSocket.send(JSON.stringify({
        msg: 'evalCmd',
        id: selfId || null,
        cmd: messageValue.slice(1),
        world: world || null
      }));
    } else if (messageValue[0] === '@') { // private message
      const spaceIndex = messageValue.indexOf(' ');
      if (spaceIndex === -1) {
        console.error('Invalid private message format. Use: @username message');
        input.blur();
        return;
      }
      activeSocket.send(JSON.stringify({
        msg: 'pmToServer',
        recip: messageValue.slice(1, spaceIndex),
        message: messageValue.slice(spaceIndex + 1)
      }));
    } else { // chat
      // Use player character for chat, even if controlling ship
      let playerId = null;
      let playerName = null;
      
      // Try to get player ID using getPlayerIdForUI if available
      if (getPlayerIdForUI && typeof getPlayerIdForUI === 'function') {
        try {
          playerId = getPlayerIdForUI();
        } catch (e) {
          console.warn('Error calling getPlayerIdForUI:', e);
        }
      }
      
      // Fallback to selfId if getPlayerIdForUI didn't work
      if (!playerId) {
        playerId = selfId;
      }
      
      // Try to get player name from Player.list
      if (playerId && Player && Player.list && Player.list[playerId]) {
        playerName = Player.list[playerId].name;
      }
      
      // If we still don't have a name, try to get it from window or use a fallback
      if (!playerName) {
        // Try to get from window.originalPlayerData if available
        if (typeof window !== 'undefined' && window.originalPlayerData && window.originalPlayerData.name) {
          playerName = window.originalPlayerData.name;
        } else if (playerId) {
          // Use playerId as fallback name (server might handle it)
          playerName = playerId.toString();
        } else {
          // Last resort: send without name (server should handle it)
          console.warn('No player name found, sending chat without name');
          playerName = 'Unknown';
        }
      }
      
      activeSocket.send(JSON.stringify({
        msg: 'msgToServer',
        name: playerName,
        message: messageValue
      }));
    }
    input.blur(); // Auto-deselect after sending
  }

  setupDepositHandlers() {
    const { depositClose, depositPopup, depositCancelBtn, depositConfirmBtn, depositSliders, socket, currentDepositData } = this.config;
    
    if (depositClose) {
      depositClose.onclick = () => {
        if (depositPopup) depositPopup.style.display = 'none';
        if (currentDepositData) currentDepositData.value = null;
      };
    }
    
    if (depositCancelBtn) {
      depositCancelBtn.onclick = () => {
        if (depositPopup) depositPopup.style.display = 'none';
        if (currentDepositData) currentDepositData.value = null;
      };
    }
    
    if (depositConfirmBtn && depositSliders) {
      depositConfirmBtn.onclick = () => {
        // Use window.currentDepositData (set by socket handler) instead of config's currentDepositData
        const depositData = (typeof window !== 'undefined' && window.currentDepositData) ? window.currentDepositData : currentDepositData;
        if (!depositData || !depositData.value) return;
        
        // Collect values from all sliders
        const sliders = depositSliders.querySelectorAll('.deposit-slider');
        const resourcesToDeposit = {};
        let hasAnyDeposit = false;
        
        sliders.forEach((slider) => {
          const resourceType = slider.dataset.resourceType;
          const amount = parseInt(slider.value);
          if (amount > 0) {
            resourcesToDeposit[resourceType] = amount;
            hasAnyDeposit = true;
          }
        });
        
        if (!hasAnyDeposit) {
          return;
        }
        
        // Send depositResources message to server
        const activeSocket = socket || (typeof window !== 'undefined' ? window.socket : null);
        if (activeSocket && typeof activeSocket.send === 'function') {
          activeSocket.send(JSON.stringify({
            msg: 'depositResources',
            buildingId: depositData.value.buildingId,
            resources: resourcesToDeposit
          }));
        }
        
        // Close popup
        if (depositPopup) depositPopup.style.display = 'none';
        if (depositData) depositData.value = null;
      };
    }
  }

  setupInventoryHandlers() {
    const { inventoryButton, inventoryPopup, inventoryClose, updateInventoryDisplay } = this.config;
    
    if (inventoryButton && inventoryPopup) {
      inventoryButton.onclick = () => {
        if (inventoryPopup.style.display === 'none' || !inventoryPopup.style.display) {
          inventoryPopup.style.display = 'block';
          if (updateInventoryDisplay) updateInventoryDisplay();
        } else {
          inventoryPopup.style.display = 'none';
        }
      };
    }
    
    if (inventoryClose && inventoryPopup) {
      inventoryClose.onclick = () => {
        inventoryPopup.style.display = 'none';
      };
    }
  }

  setupCharacterHandlers() {
    const { characterButton, characterPopup, characterClose, updateCharacterDisplay, characterSheetUpdateInterval } = this.config;
    
    if (characterButton && characterPopup) {
      characterButton.onclick = () => {
        if (characterPopup.style.display === 'none' || !characterPopup.style.display) {
          characterPopup.style.display = 'block';
          if (updateCharacterDisplay) updateCharacterDisplay();
          
          // Start real-time updates
          if (characterSheetUpdateInterval && !characterSheetUpdateInterval.value) {
            characterSheetUpdateInterval.value = setInterval(() => {
              if (characterPopup && characterPopup.style.display === 'block') {
                if (updateCharacterDisplay) updateCharacterDisplay();
              }
            }, 1000);
          }
        } else {
          characterPopup.style.display = 'none';
          // Stop real-time updates
          if (characterSheetUpdateInterval && characterSheetUpdateInterval.value) {
            clearInterval(characterSheetUpdateInterval.value);
            characterSheetUpdateInterval.value = null;
          }
        }
      };
    }
    
    if (characterClose && characterPopup) {
      characterClose.onclick = () => {
        characterPopup.style.display = 'none';
        // Stop real-time updates
        if (characterSheetUpdateInterval && characterSheetUpdateInterval.value) {
          clearInterval(characterSheetUpdateInterval.value);
          characterSheetUpdateInterval.value = null;
        }
      };
    }
  }

  setupBuildMenuHandlers() {
    const { buildMenuButton, buildMenuPopup, buildMenuClose, socket, buildPreviewMode, buildPreviewType, buildPreviewData } = this.config;
    
    if (buildMenuButton && buildMenuPopup) {
      buildMenuButton.onclick = () => {
        if (buildMenuPopup.style.display === 'block') {
          buildMenuPopup.style.display = 'none';
        } else {
          // Request build menu data from server
          const activeSocket = socket || (typeof window !== 'undefined' ? window.socket : null);
          if (activeSocket && typeof activeSocket.send === 'function') {
            activeSocket.send(JSON.stringify({ msg: 'requestBuildMenu' }));
          }
        }
      };
    }
    
    if (buildMenuClose && buildMenuPopup) {
      buildMenuClose.onclick = () => {
        buildMenuPopup.style.display = 'none';
        // Cancel preview mode if active
        if (buildPreviewMode) {
          buildPreviewMode.value = false;
          if (buildPreviewType) buildPreviewType.value = null;
          if (buildPreviewData) buildPreviewData.value = null;
        }
      };
    }
  }

  setupMarketHandlers() {
    const { marketClose, marketPopup, marketBuyBtn, marketSellBtn, marketItemSelect, marketAmount, marketPrice, socket } = this.config;
    
    if (marketClose && marketPopup) {
      marketClose.onclick = () => {
        marketPopup.style.display = 'none';
      };
    }
    
    if (marketBuyBtn && marketItemSelect && marketAmount && marketPrice) {
      marketBuyBtn.onclick = () => {
        const item = marketItemSelect.value;
        const amount = parseInt(marketAmount.value);
        const price = parseInt(marketPrice.value);
        
        if (!item || isNaN(amount) || isNaN(price)) {
          alert('Please fill in all fields');
          return;
        }
        
        if (amount <= 0 || price <= 0) {
          alert('Amount and price must be greater than 0');
          return;
        }
        
        const activeSocket = socket || (typeof window !== 'undefined' ? window.socket : null);
        if (activeSocket && typeof activeSocket.send === 'function') {
          activeSocket.send(JSON.stringify({ msg: 'evalCmd', cmd: `/buy ${amount} ${item} ${price}` }));
        }
        
        // Clear inputs
        marketAmount.value = '';
        marketPrice.value = '';
        
        // Close market after short delay to see confirmation
        setTimeout(() => { if (marketPopup) marketPopup.style.display = 'none'; }, 500);
      };
    }
    
    if (marketSellBtn && marketItemSelect && marketAmount && marketPrice) {
      marketSellBtn.onclick = () => {
        const item = marketItemSelect.value;
        const amount = parseInt(marketAmount.value);
        const price = parseInt(marketPrice.value);
        
        if (!item || isNaN(amount) || isNaN(price)) {
          alert('Please fill in all fields');
          return;
        }
        
        if (amount <= 0 || price <= 0) {
          alert('Amount and price must be greater than 0');
          return;
        }
        
        const activeSocket = socket || (typeof window !== 'undefined' ? window.socket : null);
        if (activeSocket && typeof activeSocket.send === 'function') {
          activeSocket.send(JSON.stringify({ msg: 'evalCmd', cmd: `/sell ${amount} ${item} ${price}` }));
        }
        
        // Clear inputs
        marketAmount.value = '';
        marketPrice.value = '';
        
        // Close market after short delay to see confirmation
        setTimeout(() => { if (marketPopup) marketPopup.style.display = 'none'; }, 500);
      };
    }
  }

  setupMapHandlers() {
    const { worldmapClose, worldmapPopup, cavemapClose, cavemapPopup } = this.config;
    
    if (worldmapClose && worldmapPopup) {
      worldmapClose.onclick = () => {
        worldmapPopup.style.display = 'none';
      };
    }
    
    if (cavemapClose && cavemapPopup) {
      cavemapClose.onclick = () => {
        cavemapPopup.style.display = 'none';
      };
    }
    
    // WorldMap hover handlers are complex - keeping them in client.js for now
    // Can be extracted later if needed
  }

  setupContextMenuHandlers() {
    const { itemContextMenu, dropCancelBtn, dropQuantityModal, currentContextItem } = this.config;
    
    if (dropCancelBtn && dropQuantityModal) {
      dropCancelBtn.onclick = () => {
        dropQuantityModal.style.display = 'none';
        if (currentContextItem) currentContextItem.value = null;
      };
    }
    
    // Hide context menu when clicking outside
    document.addEventListener('click', (e) => {
      if (itemContextMenu && itemContextMenu.style.display === 'block') {
        if (!itemContextMenu.contains(e.target)) {
          itemContextMenu.style.display = 'none';
        }
      }
    });
  }

  setupHouseCreationHandlers() {
    // Get elements
    const closeBtn = document.getElementById('house-creation-close');
    const cancelBtn = document.getElementById('house-creation-cancel-btn');
    const createBtn = document.getElementById('house-creation-create-btn');
    const flagLeftBtn = document.getElementById('house-flag-left');
    const flagRightBtn = document.getElementById('house-flag-right');
    const nameInput = document.getElementById('house-name-input');
    
    // Close button
    if (closeBtn) {
      closeBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.HouseCreationUI) {
          window.HouseCreationUI.closeHouseCreation();
        }
      };
    }
    
    // Cancel button
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.HouseCreationUI) {
          window.HouseCreationUI.closeHouseCreation();
        }
      };
    }
    
    // Create button
    if (createBtn) {
      createBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.HouseCreationUI) {
          window.HouseCreationUI.submitHouseCreation();
        }
      };
    }
    
    // Flag navigation buttons
    if (flagLeftBtn) {
      flagLeftBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.HouseCreationUI) {
          window.HouseCreationUI.navigateFlag('left');
        }
      };
    }
    
    if (flagRightBtn) {
      flagRightBtn.onclick = () => {
        if (typeof window !== 'undefined' && window.HouseCreationUI) {
          window.HouseCreationUI.navigateFlag('right');
        }
      };
    }
    
    // Keyboard handlers
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.HouseCreationUI) {
            window.HouseCreationUI.submitHouseCreation();
          }
        } else if (e.key === 'Escape' || e.keyCode === 27) {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.HouseCreationUI) {
            window.HouseCreationUI.closeHouseCreation();
          }
        } else if (e.key === 'ArrowLeft' || e.keyCode === 37) {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.HouseCreationUI) {
            window.HouseCreationUI.navigateFlag('left');
          }
        } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.HouseCreationUI) {
            window.HouseCreationUI.navigateFlag('right');
          }
        }
      });
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.UIEventHandlers = UIEventHandlers;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIEventHandlers;
}

