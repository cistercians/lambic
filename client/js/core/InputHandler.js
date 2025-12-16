/**
 * InputHandler - Manages all keyboard and mouse input events
 * 
 * Extracted from client.js for better organization.
 * This is a comprehensive handler that manages all user input.
 */

class InputHandler {
  constructor(config) {
    this.config = config || {};
    this.setupEventHandlers();
  }

  /**
   * Update configuration (for dynamic dependencies)
   * @param {object} config - Configuration object with all dependencies
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Setup all event handlers
   */
  setupEventHandlers() {
    // Keyboard handlers
    document.onkeydown = this.handleKeyDown.bind(this);
    document.onkeyup = this.handleKeyUp.bind(this);
    
    // Mouse handlers
    document.onmousemove = this.handleMouseMove.bind(this);
    document.onclick = this.handleClick.bind(this);
    document.oncontextmenu = this.handleContextMenu.bind(this);
  }

  /**
   * Clear selected target and related state
   * Helper method for reusable deselection logic
   */
  clearTarget() {
    // Clear selected target and attack command mode
    this.config.selectedTarget = null;
    // Also sync to global variable for backward compatibility
    if(typeof window !== 'undefined') {
      window.selectedTarget = null;
    }
    this.config.attackCommandMode = false;
    // Sync attack command mode to window for cursor renderer
    if(typeof window !== 'undefined') {
      window.attackCommandMode = false;
    }
    console.log('Target and attack mode cleared');
    
    // Force hide target HUD immediately
    const targetHud = document.getElementById('target-portrait-hud');
    if (targetHud) {
      targetHud.classList.remove('active');
    }
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    const {
      selfId,
      Player,
      socket,
      godModeCamera,
      spectateCameraSystem,
      loginCameraSystem,
      attackCommandMode,
      workCommandMode,
      buildPreviewMode,
      buildPreviewType,
      buildPreviewData,
      selectedTarget,
      worldmapPopup,
      cavemapPopup,
      buildMenuPopup,
      inventoryPopup,
      characterPopup,
      updateCharacterDisplay,
      updateCharacterBars,
      updateInventoryDisplay,
      characterSheetUpdateInterval,
      getBuilding,
      getBgm
    } = this.config;

    // Check if chat is focused (needs to be checked early for godmode)
    const chatInput = document.getElementById('chat-input');
    const chatFocus = (chatInput && document.activeElement === chatInput);
    
    // Check if player exists before processing game input
    if (!selfId || !Player.list[selfId]) {
      // Only allow chat and god mode controls if no valid player
      if (!chatFocus && !godModeCamera.isActive) {
        return;
      }
    }
    
    // God mode camera controls (handle BEFORE other inputs, but AFTER chat check)
    if (godModeCamera.isActive && !chatFocus) {
      if (event.keyCode === 87) { // W - Move up
        godModeCamera.pressingUp = true;
        event.preventDefault();
        return;
      } else if (event.keyCode === 83) { // S - Move down
        godModeCamera.pressingDown = true;
        event.preventDefault();
        return;
      } else if (event.keyCode === 65) { // A - Move left
        godModeCamera.pressingLeft = true;
        event.preventDefault();
        return;
      } else if (event.keyCode === 68) { // D - Move right
        godModeCamera.pressingRight = true;
        event.preventDefault();
        return;
      } else if (event.keyCode === 38) { // Up Arrow - Increase z
        const addChatMessage = (msg) => window.chatManagerInstance?.addMessage?.(msg);
        godModeCamera.changeZ(1, getBuilding, getBgm);
        event.preventDefault();
        return;
      } else if (event.keyCode === 40) { // Down Arrow - Decrease z
        const addChatMessage = (msg) => window.chatManagerInstance?.addMessage?.(msg);
        godModeCamera.changeZ(-1, getBuilding, getBgm);
        event.preventDefault();
        return;
      } else if (event.keyCode === 37) { // Left Arrow - Previous faction
        const addChatMessage = (msg) => window.chatManagerInstance?.addMessage?.(msg);
        godModeCamera.cycleFaction(-1, getBuilding, getBgm, addChatMessage);
        event.preventDefault();
        return;
      } else if (event.keyCode === 39) { // Right Arrow - Next faction
        const addChatMessage = (msg) => window.chatManagerInstance?.addMessage?.(msg);
        godModeCamera.cycleFaction(1, getBuilding, getBgm, addChatMessage);
        event.preventDefault();
        return;
      } else if (event.keyCode === 13) { // Enter - Allow chat (for /godmode exit)
        // Focus chat input to allow typing /godmode to exit
        if (document.activeElement !== chatInput) {
          event.preventDefault();
          chatInput.focus();
        }
        return;
      } else if (event.keyCode === 77) { // M - Allow worldmap in godmode
        // If worldmap is open, close it. Otherwise request data from server
        if (worldmapPopup && worldmapPopup.style.display === 'block') {
          worldmapPopup.style.display = 'none';
        } else {
          // Request worldmap data from server (only show popup if player has worldmap)
          socket.send(JSON.stringify({ msg: 'requestWorldMap' }));
        }
        event.preventDefault();
        return;
      } else if (event.keyCode === 86) { // V - Allow cavemap in godmode
        // If cavemap is open, close it. Otherwise request data from server
        if (cavemapPopup && cavemapPopup.style.display === 'block') {
          cavemapPopup.style.display = 'none';
        } else {
          // Request cavemap data from server (only show popup if player has cavemap)
          socket.send(JSON.stringify({ msg: 'requestCaveMap' }));
        }
        event.preventDefault();
        return;
      } else {
        // Block all other inputs in god mode
        event.preventDefault();
        return;
      }
    }
    
    // Block all gameplay controls in spectate mode except ESC and Enter
    if (spectateCameraSystem && spectateCameraSystem.isActive) {
      if (event.keyCode === 27) { // ESC - Exit spectate mode
        spectateCameraSystem.stop();
        // Disconnect and return to login
        socket.close();
        location.reload(); // Reload page to return to login screen
        return;
      } else if (event.keyCode === 13) { // Enter - Allow chat
        // Allow chat input focus
        return;
      }
      // Block all other keys
      return;
    }
    
    // Block all game input during login
    if (loginCameraSystem.isActive) {
      return;
    }
    
    // If chat is focused, allow Enter key to work normally (don't interfere)
    // chatFocus already declared at top of function
    if (chatFocus) {
      // Allow Enter key to work for chat submission
      if (event.keyCode === 13 || event.key === 'Enter') {
        return; // Don't prevent default, let chat handler process it
      }
      // For other keys when chat is focused, still allow normal input
      return;
    }
    
    // chatFocus already declared at top of function
    if (!chatFocus) {
      // Check if player is a ship navigator (controlling a ship)
      let isShipNavigator = false;
      if (selfId && Player.list[selfId]) {
        const currentEntity = Player.list[selfId];
        // Navigator: selfId points to ship entity with shipType and isPlayerControlled
        if (currentEntity.shipType === 'fishingship' && currentEntity.isPlayerControlled) {
          isShipNavigator = true;
        }
      }
      
      // WASD keys for ship navigation (navigator only)
      if (isShipNavigator) {
        if (event.keyCode === 87) { // W - up
          socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'up', state: true }));
          event.preventDefault();
          return;
        } else if (event.keyCode === 83) { // S - down
          socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'down', state: true }));
          event.preventDefault();
          return;
        } else if (event.keyCode === 65) { // A - left (navigation, not attack command for navigator)
          socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'left', state: true }));
          event.preventDefault();
          return;
        } else if (event.keyCode === 68) { // D - right
          socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'right', state: true }));
          event.preventDefault();
          return;
        }
      }
      
      if (event.keyCode === 65) { // a - Toggle attack command mode (only for non-navigators)
        // Only toggle attack command if NOT a ship navigator
        if (!isShipNavigator) {
          // Toggle attack command mode
          this.config.attackCommandMode = !this.config.attackCommandMode;
          // Sync to window for cursor renderer
          if (typeof window !== 'undefined') {
            window.attackCommandMode = this.config.attackCommandMode;
          }
          console.log('Attack command mode toggled:', this.config.attackCommandMode);
          event.preventDefault();
          event.stopPropagation();
        }
        return; // Don't send keyPress message for A key in attack mode
      } else if (event.keyCode === 69) { // e
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'e', state: true }));
      } else if (event.keyCode === 84) { // t
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 't', state: true }));
      } else if (event.keyCode === 73) { // i
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'i', state: true }));
      } else if (event.keyCode === 80) { // p
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'p', state: true }));
      } else if (event.keyCode === 70) { // f - Toggle work command mode
        // Toggle work command mode (we're already inside !chatFocus block)
        // Only toggle if default wasn't already prevented (i.e., addEventListener didn't handle it)
        if (!event.defaultPrevented) {
          this.config.workCommandMode = !this.config.workCommandMode;
          // Sync to window for cursor renderer
          if (typeof window !== 'undefined') {
            window.workCommandMode = this.config.workCommandMode;
          }
          console.log('Work command mode toggled (document.onkeydown):', this.config.workCommandMode);
          event.preventDefault();
          event.stopPropagation();
        }
        return; // Don't send keyPress message for F key in work mode
      } else if (event.keyCode === 72) { // h
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'h', state: true }));
      } else if (event.keyCode === 75) { // k
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'k', state: true }));
      } else if (event.keyCode === 76) { // l
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'l', state: true }));
      } else if (event.keyCode === 88) { // x
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'x', state: true }));
      } else if (event.keyCode === 67) { // c
        // Open character popup
        if (characterPopup && characterPopup.style.display !== 'block') {
          characterPopup.style.display = 'block';
          updateCharacterDisplay();
          // Start real-time updates for HP/Spirit bars
          if (this.config.characterSheetUpdateInterval) {
            clearInterval(this.config.characterSheetUpdateInterval);
          }
          this.config.characterSheetUpdateInterval = setInterval(() => {
            if (characterPopup && characterPopup.style.display === 'block' && Player.list[selfId]) {
              updateCharacterBars(Player.list[selfId]); // Only update bars, not full sheet
            } else {
              clearInterval(this.config.characterSheetUpdateInterval);
              this.config.characterSheetUpdateInterval = null;
            }
          }, 100); // Update 10 times per second
        } else if (characterPopup) {
          characterPopup.style.display = 'none';
          // Stop updates when closed
          if (this.config.characterSheetUpdateInterval) {
            clearInterval(this.config.characterSheetUpdateInterval);
            this.config.characterSheetUpdateInterval = null;
          }
        }
      } else if (event.keyCode === 66) { // b
        // Check if chest window is open
        var chestPopup = document.getElementById('chest-popup');
        if (chestPopup && chestPopup.style.display === 'block') {
          // Toggle extended view (player inventory side-by-side)
          var chestExtendedContainer = document.getElementById('chest-extended-container');
          var chestHint = document.getElementById('chest-hint');
          if (chestExtendedContainer) {
            var chestPopup = document.getElementById('chest-popup');
            if (!chestExtendedContainer.classList.contains('active')) {
              // Show extended view
              chestExtendedContainer.classList.add('active');
              if (chestPopup) chestPopup.classList.add('extended');
              if (chestHint) chestHint.style.display = 'none';
              // Update global extended state
              if (typeof window !== 'undefined' && typeof currentChestId !== 'undefined') {
                window.chestExtended = true;
              }
              // Hide regular chest grid, show extended grid
              var chestGrid = document.getElementById('chest-grid');
              var chestGridExtended = document.getElementById('chest-grid-extended');
              if (chestGrid) chestGrid.style.display = 'none';
              if (chestGridExtended) chestGridExtended.style.display = 'grid';
              // Update player inventory display (will be updated by server's openChest message)
              if (typeof updateChestPlayerInventory !== 'undefined') {
                // Get fresh inventory from player
                // Use selfId from window (already declared in handleContextMenu)
                const currentSelfId = (typeof window !== 'undefined' && window.selfId !== undefined) ? window.selfId : null;
                if(currentSelfId && typeof Player !== 'undefined' && Player.list && Player.list[currentSelfId]) {
                  updateChestPlayerInventory(Player.list[currentSelfId].inventory);
                } else {
                  updateChestPlayerInventory();
                }
              }
              // Re-render chest inventory in extended grid
              if (typeof updateChestDisplay !== 'undefined' && typeof window !== 'undefined' && window.currentChestInventory) {
                updateChestDisplay(window.currentChestInventory);
              }
            } else {
              // Hide extended view
              chestExtendedContainer.classList.remove('active');
              if (chestPopup) chestPopup.classList.remove('extended');
              if (chestHint) chestHint.style.display = 'block';
              // Update global extended state
              if (typeof window !== 'undefined') {
                window.chestExtended = false;
              }
              // Show regular chest grid, hide extended grid
              var chestGrid = document.getElementById('chest-grid');
              var chestGridExtended = document.getElementById('chest-grid-extended');
              if (chestGrid) chestGrid.style.display = 'grid';
              if (chestGridExtended) chestGridExtended.style.display = 'none';
              // Re-render chest inventory in regular grid
              if (typeof updateChestDisplay !== 'undefined' && typeof window !== 'undefined' && window.currentChestInventory) {
                updateChestDisplay(window.currentChestInventory);
              }
            }
          }
        } else {
          // Normal inventory popup toggle
          if (inventoryPopup && inventoryPopup.style.display !== 'block') {
            inventoryPopup.style.display = 'block';
            updateInventoryDisplay();
          } else if (inventoryPopup) {
            inventoryPopup.style.display = 'none';
          }
        }
      } else if (event.keyCode === 77) { // m
        // If worldmap is open, close it. Otherwise request data from server
        if (worldmapPopup && worldmapPopup.style.display === 'block') {
          worldmapPopup.style.display = 'none';
        } else {
          // Request worldmap data from server (only show popup if player has worldmap)
          socket.send(JSON.stringify({ msg: 'requestWorldMap' }));
        }
      } else if (event.keyCode === 86) { // v
        // If cavemap is open, close it. Otherwise request data from server
        if (cavemapPopup && cavemapPopup.style.display === 'block') {
          cavemapPopup.style.display = 'none';
        } else {
          // Request cavemap data from server (only show popup if player has cavemap)
          socket.send(JSON.stringify({ msg: 'requestCaveMap' }));
        }
      } else if (event.keyCode === 85) { // u - Build Menu
        // If build menu is open, close it. Otherwise request data from server
        if (buildMenuPopup && buildMenuPopup.style.display === 'block') {
          buildMenuPopup.style.display = 'none';
        } else {
          // Request build menu data from server
          socket.send(JSON.stringify({ msg: 'requestBuildMenu' }));
        }
      } else if (event.keyCode === 27) { // Escape - Cancel preview mode and clear targets
        if (this.config.buildPreviewMode) {
          this.config.buildPreviewMode = false;
          this.config.buildPreviewType = null;
          this.config.buildPreviewData = null;
          
          // Also clear window variables
          if (typeof window !== 'undefined') {
            window.buildPreviewMode = false;
            window.buildPreviewType = null;
            window.buildPreviewData = null;
            window.buildPreviewValidationCache = null;
            window.buildPreviewLastTile = null;
          }
        }
        // Clear selected target using helper method
        this.clearTarget();
      } else if (event.keyCode === 78) { // n
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'n', state: true }));
      } else if (event.keyCode === 49) { // 1
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '1', state: true }));
      } else if (event.keyCode === 50) { // 2
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '2', state: true }));
      } else if (event.keyCode === 51) { // 3
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '3', state: true }));
      } else if (event.keyCode === 52) { // 4
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '4', state: true }));
      } else if (event.keyCode === 53) { // 5
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '5', state: true }));
      } else if (event.keyCode === 54) { // 6
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '6', state: true }));
      } else if (event.keyCode === 55) { // 7
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '7', state: true }));
      } else if (event.keyCode === 56) { // 8
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '8', state: true }));
      } else if (event.keyCode === 57) { // 9
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '9', state: true }));
      } else if (event.keyCode === 48) { // 0
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: '0', state: true }));
      } else if (event.keyCode === 16) { // shift
        socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'shift', state: true }));
      }
    }
  }

  /**
   * Handle keyup events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyUp(event) {
    const {
      selfId,
      Player,
      socket,
      godModeCamera,
      loginCameraSystem
    } = this.config;

    // Check if player exists before processing game input
    if (!selfId || !Player.list[selfId]) {
      // Only allow god mode controls if no valid player
      if (!godModeCamera.isActive) {
        return;
      }
    }
    
    // God mode camera controls - release keys
    if (godModeCamera.isActive) {
      if (event.keyCode === 87) { // W
        godModeCamera.pressingUp = false;
        event.preventDefault();
        return;
      } else if (event.keyCode === 83) { // S
        godModeCamera.pressingDown = false;
        event.preventDefault();
        return;
      } else if (event.keyCode === 65) { // A
        godModeCamera.pressingLeft = false;
        event.preventDefault();
        return;
      } else if (event.keyCode === 68) { // D
        godModeCamera.pressingRight = false;
        event.preventDefault();
        return;
      }
    }
    
    // Block all game input during login
    if (loginCameraSystem.isActive) {
      return;
    }
    
    // Note: WASD key releases are not sent for ships - original momentum-based system
    // Ships maintain sail points until opposite direction is pressed or manually cleared
    
    if (event.keyCode === 69) { // e
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'e', state: false }));
    } else if (event.keyCode === 84) { // t
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 't', state: false }));
    } else if (event.keyCode === 73) { // i
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'i', state: false }));
    } else if (event.keyCode === 80) { // p
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'p', state: false }));
    } else if (event.keyCode === 70) { // f
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'f', state: false }));
    } else if (event.keyCode === 72) { // h
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'h', state: false }));
    } else if (event.keyCode === 75) { // k
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'k', state: false }));
    } else if (event.keyCode === 76) { // l
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'l', state: false }));
    } else if (event.keyCode === 88) { // x
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'x', state: false }));
    } else if (event.keyCode === 67) { // c
      // C key handled on keydown only
    } else if (event.keyCode === 66) { // b
      // B key handled on keydown only
    } else if (event.keyCode === 78) { // n
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'n', state: false }));
    } else if (event.keyCode === 77) { // m
      // M key handled on keydown only
    } else if (event.keyCode === 49) { // 1
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '1', state: false }));
    } else if (event.keyCode === 50) { // 2
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '2', state: false }));
    } else if (event.keyCode === 51) { // 3
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '3', state: false }));
    } else if (event.keyCode === 52) { // 4
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '4', state: false }));
    } else if (event.keyCode === 53) { // 5
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '5', state: false }));
    } else if (event.keyCode === 54) { // 6
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '6', state: false }));
    } else if (event.keyCode === 55) { // 7
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '7', state: false }));
    } else if (event.keyCode === 56) { // 8
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '8', state: false }));
    } else if (event.keyCode === 57) { // 9
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '9', state: false }));
    } else if (event.keyCode === 48) { // 0
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: '0', state: false }));
    } else if (event.keyCode === 16) { // shift
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'shift', state: false }));
    }
  }

  /**
   * Handle mousemove events
   * @param {MouseEvent} event - Mouse event
   */
  handleMouseMove(event) {
    const {
      selfId,
      Player,
      Building,
      Item,
      socket,
      mousePos,
      currentMouseX,
      currentMouseY,
      hoveredTarget,
      hoveredInteractable,
      WIDTH,
      HEIGHT,
      currentZoom,
      tileSize,
      getLoc,
      getBuilding
    } = this.config;

    // Track mouse position for building preview
    if (mousePos) {
      mousePos.x = event.clientX;
      mousePos.y = event.clientY;
    }
    
    // Track mouse position for cursor rendering (screen coordinates)
    const canvas = document.getElementById('ctx');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      // Update both config and global variables
      if (currentMouseX !== undefined) {
        this.config.currentMouseX = mouseX;
        // Also update global variable for CursorRenderer
        if (typeof window !== 'undefined') {
          window.currentMouseX = mouseX;
          window.currentMouseY = mouseY;
        }
      }
      if (currentMouseY !== undefined) {
        this.config.currentMouseY = mouseY;
      }
    }
    
    if (selfId) {
      const x = -250 + event.clientX - 8;
      const y = -250 + event.clientY - 8;
      const angle = Math.atan2(y, x) / Math.PI * 180;
      socket.send(JSON.stringify({ msg: 'keyPress', inputId: 'mouseAngle', state: angle }));
      
      // Hover detection for entities
      const player = Player.list[selfId];
      if (player) {
        const canvas = document.getElementById('ctx');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;
          
          // Convert screen coordinates to world coordinates
          // Use the same coordinate system as entity rendering for consistency
          // Get camera position (same as used in border drawing)
          const getCameraPosition = this.config.getCameraPosition;
          const cameraPos = getCameraPosition ? getCameraPosition() : { x: 0, y: 0 };
          const zoom = (typeof window !== 'undefined' && window.currentZoom) || currentZoom || 1.0;
          
          // Reverse the screen-to-world conversion used in rendering
          // Entity rendering: screenX = (entity.x - spriteSize/2) - cameraPos.x + WIDTH/2
          // Then zoom transform is applied: renderedX = (screenX - WIDTH/2) * zoom + WIDTH/2
          // So: renderedX = ((entity.x - spriteSize/2) - cameraPos.x) * zoom + WIDTH/2
          // Reverse: worldX = ((mouseX - WIDTH/2) / zoom) + cameraPos.x
          // Note: We're checking entity center, so we don't need spriteSize/2 offset
          const worldX = (mouseX - WIDTH / 2) / zoom + cameraPos.x;
          const worldY = (mouseY - HEIGHT / 2) / zoom + cameraPos.y;
          
          // Only update hover detection if mouse position actually changed
          // This prevents unnecessary recalculation when mouse hasn't moved
          const lastMouseX = this._lastHoverMouseX;
          const lastMouseY = this._lastHoverMouseY;
          const mouseMoved = (lastMouseX === undefined || lastMouseY === undefined || 
                             Math.abs(mouseX - lastMouseX) > 0.5 || 
                             Math.abs(mouseY - lastMouseY) > 0.5);
          
          if (mouseMoved) {
            // Store current mouse position
            this._lastHoverMouseX = mouseX;
            this._lastHoverMouseY = mouseY;
            
            // Check all entities for hover
            // Use getCurrentZ() to get the current z level (handles caves)
            const currentZ = this.config.getCurrentZ ? this.config.getCurrentZ() : player.z;
            
            // Get actual selfId for innaWoods check
            let actualSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null)
              ? window.selfId
              : selfId;
            
            // If still a random decimal (0-1), try to find the real player ID from Player.list
            if (typeof actualSelfId === 'number' && actualSelfId > 0 && actualSelfId < 1) {
              for (const pid in Player.list) {
                const p = Player.list[pid];
                if (p && !p.toRemove && p.class && !p.shipType && p.class !== 'FishingShip' && p.class !== 'CargoShip') {
                  actualSelfId = pid;
                  break;
                }
              }
            }
            
            // Get player's innaWoods value for compatibility check
            const playerInnaWoods = (actualSelfId && Player.list[actualSelfId]) 
              ? (Player.list[actualSelfId].innaWoods || false)
              : false;
            
            let foundHover = false;
            
            for (const id in Player.list) {
              const entity = Player.list[id];
              if (entity && entity.z === currentZ) {
                // Skip Falcons - their sprites are massive (include shadows) and shouldn't be hoverable
                if (entity.class === 'Falcon') continue;
                
                // Check innaWoods compatibility (only applies to overworld z=0)
                // Only block if player is NOT in woods and entity IS in woods
                // Players with innaWoods=true can see all units
                if (currentZ === 0) {
                  const entityInnaWoods = entity.innaWoods || false;
                  if (!playerInnaWoods && entityInnaWoods) {
                    continue; // Skip entities in woods when player is not in woods
                  }
                }
                
                const dx = entity.x - worldX;
                const dy = entity.y - worldY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Use actual sprite size for detection (spriteSize is typically 64, so radius is 32)
                let entitySpriteSize = entity.spriteSize || 64;
                let detectionRadius = entitySpriteSize / 2;
                
                // Account for scaled sprites (e.g., minibosses)
                if ((entity.class === 'Wolf' || entity.class === 'Boar') && entity.spriteScale) {
                  detectionRadius = (entitySpriteSize * entity.spriteScale) / 2;
                }
                
                if (distance < detectionRadius) {
                  this.config.hoveredTarget = id;
                  // Sync to window for backward compatibility
                  if (typeof window !== 'undefined') {
                    window.hoveredTarget = id;
                  }
                  foundHover = true;
                  break;
                }
              }
            }
            
            // Only clear hoveredTarget if mouse moved and we didn't find a hover
            if (!foundHover) {
              this.config.hoveredTarget = null;
              if (typeof window !== 'undefined') {
                window.hoveredTarget = null;
              }
            }
          }
          // If mouse hasn't moved, keep the current hoveredTarget (don't recalculate)
          
          // Check for interactable buildings/objects (using generic interactability checks)
          this.config.hoveredInteractable = null;
          // Sync to window for backward compatibility
          if (typeof window !== 'undefined') {
            window.hoveredInteractable = null;
          }
          
          // Get actual selfId - prefer window.selfId (updated by SocketMessageHandler)
          // window.selfId is the most reliable source as it's updated by the server
          let actualSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null)
            ? window.selfId
            : selfId;
          
          // If still a random decimal (0-1), try to find the real player ID from Player.list
          // Look for entities that are not ships, not buildings, and have a class (likely players)
          if (typeof actualSelfId === 'number' && actualSelfId > 0 && actualSelfId < 1) {
            for (const pid in Player.list) {
              const p = Player.list[pid];
              // Player entities typically have a class but are not ships
              if (p && !p.toRemove && p.class && !p.shipType && p.class !== 'FishingShip' && p.class !== 'CargoShip') {
                actualSelfId = pid;
                break;
              }
            }
          }
          
          // Centralized interactable type lists (must match server-side configuration)
          const INTERACTABLE_BUILDING_TYPES = ['dock', 'mill', 'mine', 'lumbermill', 'stable', 'tavern', 'market', 'monastery'];
          const INTERACTABLE_OBJECT_TYPES = ['Goods1', 'Goods2', 'Goods3', 'Goods4', 'Desk', 'Chest', 'LockedChest'];
          
          // Helper function to check if building is interactable
          const isInteractableBuilding = (building) => {
            if (!building) return false;
            if (building.interactable === true) return true;
            return INTERACTABLE_BUILDING_TYPES.indexOf(building.type) !== -1;
          };
          
          // Helper function to check if player can interact with a building
          const canInteractWithBuilding = (building, playerId) => {
            if (!building) return false;
            // playerId can be null/undefined - allow interaction for neutral buildings
            if (playerId === null || playerId === undefined) {
              return (!building.owner && !building.house) || building.type === 'dock';
            }
            
            const player = Player.list[playerId];
            // If player not found, allow interaction for buildings with no owner restrictions
            if (!player) {
              return (!building.owner && !building.house) || building.type === 'dock';
            }
            
            // Docks allow access to neutral/friendly players (special case)
            if (building.type === 'dock') {
              let canAccess = true;
              
              // Check if player is hostile to dock owner
              if (building.owner && building.owner !== playerId) {
                const dockOwner = Player.list[building.owner];
                if (dockOwner) {
                  if (player.enemies && player.enemies.indexOf(building.owner) !== -1) {
                    canAccess = false;
                  }
                  if (dockOwner.enemies && dockOwner.enemies.indexOf(playerId) !== -1) {
                    canAccess = false;
                  }
                }
              }
              
              // Check faction hostility
              if (building.house && player.house && building.house !== player.house) {
                if (player.enemies && player.enemies.indexOf(building.house) !== -1) {
                  canAccess = false;
                }
              }
              
              return canAccess;
            }
            
            // For other buildings (mills, lumbermills, mines, etc.), check ownership/house
            // Player can interact if:
            // 1. They own the building
            // 2. They're in the same house as the building
            // 3. Building has no owner (neutral building)
            if (building.owner === playerId) {
              return true; // Player owns the building
            }
            
            if (building.house && player.house && building.house === player.house) {
              return true; // Same house
            }
            
            if (!building.owner && !building.house) {
              return true; // Neutral building with no owner
            }
            
            return false; // Cannot interact
          };
          
          // Helper function to check if object is interactable
          const isInteractableObject = (item) => {
            if (!item) return false;
            if (item.interactable === true) return true;
            return INTERACTABLE_OBJECT_TYPES.indexOf(item.type) !== -1;
          };
          
          if (player.z === 0) {
            // Only check for buildings when on overworld (z=0)
            // First try the exact tile location
            let buildingId = getBuilding(worldX, worldY);
            
            // Debug: Log building detection attempts (more frequently for testing)
            if (Math.random() < 0.05) {
              let totalBuildings = 0;
              let interactableBuildings = 0;
              for (const bid in Building.list) {
                totalBuildings++;
                const b = Building.list[bid];
                // Check if building is interactable (don't require built property on client)
                if (b && isInteractableBuilding(b)) interactableBuildings++;
              }
              console.log('Building hover check - worldX:', worldX.toFixed(2), 'worldY:', worldY.toFixed(2), 'tile:', getLoc(worldX, worldY), 'found buildingId:', buildingId, 'total buildings:', totalBuildings, 'interactable:', interactableBuildings, 'actual selfId:', selfId);
              if (buildingId && Building.list[buildingId]) {
                const dbgBuilding = Building.list[buildingId];
                console.log('  Building:', dbgBuilding.type, 'built:', dbgBuilding.built, 'owner:', dbgBuilding.owner, 'house:', dbgBuilding.house);
                console.log('  isInteractable:', isInteractableBuilding(dbgBuilding), 'canInteract:', canInteractWithBuilding(dbgBuilding, selfId));
                if (dbgBuilding.plot) console.log('  plot tiles:', dbgBuilding.plot.length);
              } else if (!buildingId) {
                // Try to find any nearby buildings
                const nearbyBuildings = [];
                for (const bid in Building.list) {
                  const b = Building.list[bid];
                  if (b && b.x !== undefined && b.y !== undefined) {
                    const dx = b.x - worldX;
                    const dy = b.y - worldY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < tileSize * 3) {
                      nearbyBuildings.push({ id: bid, type: b.type, dist: dist.toFixed(2) });
                    }
                  }
                }
                if (nearbyBuildings.length > 0) {
                  console.log('  Nearby buildings:', nearbyBuildings);
                }
              }
            }
            
            // If no building found at exact location, check building centers and bounds
            if (!buildingId) {
              // Check all buildings to see if mouse is near their center or within their bounds
              for (const bid in Building.list) {
                const b = Building.list[bid];
                // On client side, building.built might be undefined - assume building exists means it's built
                if (!b || (b.built === false) || !isInteractableBuilding(b)) continue;
                
                // Check if mouse is near building center (within 1.5 tiles)
                if (b.x !== undefined && b.y !== undefined) {
                  const dx = b.x - worldX;
                  const dy = b.y - worldY;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist < tileSize * 1.5) {
                    buildingId = b.id;
                    break;
                  }
                }
                
                // Also check if mouse is within any plot tile (with some tolerance)
                if (b.plot && Array.isArray(b.plot)) {
                  for (let p = 0; p < b.plot.length; p++) {
                    const plotTile = b.plot[p];
                    if (!plotTile || plotTile.length < 2) continue;
                    const plotX = plotTile[0] * tileSize + tileSize / 2;
                    const plotY = plotTile[1] * tileSize + tileSize / 2;
                    const dx = plotX - worldX;
                    const dy = plotY - worldY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < tileSize * 0.8) {
                      buildingId = b.id;
                      break;
                    }
                  }
                  if (buildingId) break;
                }
              }
            }
            
            if (buildingId && Building.list[buildingId]) {
              const building = Building.list[buildingId];
              // Check if building is interactable, built, and player can access it
              // Note: On client side, building.built might be undefined - assume building exists means it's built
              // Only exclude if explicitly false
                const isBuilt = building.built !== false; // Treat undefined/null as true (building exists = built)
                const isInteractable = isInteractableBuilding(building);
                
                // actualSelfId is already defined in outer scope
                let canInteract = true;
              // Check permissions if we have a valid selfId
              if (actualSelfId && actualSelfId !== null && actualSelfId !== undefined) {
                // selfId might be a number or string - both are valid
                canInteract = canInteractWithBuilding(building, actualSelfId);
              } else {
                // No valid selfId - allow interaction for buildings with no owner restrictions
                canInteract = (!building.owner && !building.house) || building.type === 'dock';
              }
              
              // Check if the hovered tile is interactable for this building
              // Use building data to determine interactability (server-side map not available on client)
              const hoveredTile = getLoc(worldX, worldY);
              let isInteractableTile = false;
              
              if (building.plot && Array.isArray(building.plot)) {
                if (building.type === 'dock') {
                  // For docks: only plot[4] (the non-walkable tile) is interactable
                  // Check if hovered tile matches plot[4] - the non-walkable tile
                  if (building.plot[4] && building.plot[4].length >= 2) {
                    if (building.plot[4][0] === hoveredTile[0] && building.plot[4][1] === hoveredTile[1]) {
                      isInteractableTile = true;
                    }
                  }
                } else if (building.type === 'mill' || building.type === 'lumbermill' || building.type === 'mine') {
                  // For mills, lumbermills, mines: all plot tiles are interactable (all are non-walkable)
                  for (let p = 0; p < building.plot.length; p++) {
                    const plotTile = building.plot[p];
                    if (plotTile && plotTile.length >= 2 && plotTile[0] === hoveredTile[0] && plotTile[1] === hoveredTile[1]) {
                      isInteractableTile = true;
                      break;
                    }
                  }
                }
              }
              
              // Set hoveredInteractable if all conditions are met AND the tile is interactable
              if (isBuilt && isInteractable && canInteract && isInteractableTile) {
                this.config.hoveredInteractable = buildingId;
                // Sync to window for backward compatibility
                if (typeof window !== 'undefined') {
                  window.hoveredInteractable = buildingId;
                }
                console.log('✓✓✓ Hover detected on building:', buildingId, building.type, 'hoveredInteractable SET to:', this.config.hoveredInteractable, 'built:', isBuilt, 'interactable:', isInteractable, 'canInteract:', canInteract, 'isInteractableTile:', isInteractableTile, 'tile:', hoveredTile, 'actualSelfId:', actualSelfId);
              } else {
                console.log('✗✗✗ Building found but NOT setting hoveredInteractable:', buildingId, building.type, 'built:', isBuilt, 'interactable:', isInteractable, 'canInteract:', canInteract, 'isInteractableTile:', isInteractableTile, 'tile:', hoveredTile, 'selfId:', selfId, 'actualSelfId:', actualSelfId, 'building.built value:', building.built);
              }
            }
          }
          
          // Check for interactable objects (Goods, Desk, etc.)
          if (!this.config.hoveredInteractable && (player.z === 1 || player.z === 2)) {
            // Check for all interactable object types at the hovered tile location
            const hoveredTile = getLoc(worldX, worldY);
            for (const itemId in Item.list) {
              const item = Item.list[itemId];
              if (item && item.z === player.z && isInteractableObject(item)) {
                // Check if item is at the hovered tile location
                const itemLoc = getLoc(item.x, item.y);
                if (itemLoc[0] === hoveredTile[0] && itemLoc[1] === hoveredTile[1]) {
                  this.config.hoveredInteractable = itemId;
                  // Sync to window for backward compatibility
                  if (typeof window !== 'undefined') {
                    window.hoveredInteractable = itemId;
                  }
                  break;
                }
              }
            }
          }
          
          // Check for chests on all z-levels (Chest, LockedChest)
          if (!this.config.hoveredInteractable) {
            const hoveredTile = getLoc(worldX, worldY);
            for (const itemId in Item.list) {
              const item = Item.list[itemId];
              if (item && item.z === player.z && (item.type === 'Chest' || item.type === 'LockedChest')) {
                // Check if item is at the hovered tile location
                const itemLoc = getLoc(item.x, item.y);
                if (itemLoc[0] === hoveredTile[0] && itemLoc[1] === hoveredTile[1]) {
                  this.config.hoveredInteractable = itemId;
                  // Sync to window for backward compatibility
                  if (typeof window !== 'undefined') {
                    window.hoveredInteractable = itemId;
                  }
                  break;
                }
              }
            }
          }
          
          // Check for interactable ships (entities with shipType that can be boarded)
          // Show interact cursor for all ships - server will validate ownership/dock status
          if (!this.config.hoveredInteractable && player.z === 0 && this.config.hoveredTarget) {
            const hoveredEntity = Player.list[this.config.hoveredTarget];
            if (hoveredEntity && hoveredEntity.shipType) {
              // Show interact cursor for all ships - server validates ownership
              // This is just for UX, not for blocking interaction
              this.config.hoveredInteractable = this.config.hoveredTarget;
              // Sync to window for backward compatibility
              if (typeof window !== 'undefined') {
                window.hoveredInteractable = this.config.hoveredTarget;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Handle click events
   * @param {MouseEvent} event - Mouse event
   */
  handleClick(event) {
    const {
      selfId,
      Player,
      socket,
      buildPreviewMode,
      buildPreviewType,
      buildPreviewData,
      workCommandMode,
      attackCommandMode,
      selectedTarget,
      WIDTH,
      HEIGHT,
      currentZoom,
      tileSize,
      allyCheck
    } = this.config;

    // Handle building preview mode first
    if (buildPreviewMode && buildPreviewType) {
      // Get preview data from config or window scope
      const previewData = buildPreviewData || (typeof window !== 'undefined' && window.buildPreviewData) || null;
      
      if (previewData) {
        // Check if click is on canvas
        const canvas = document.getElementById('ctx');
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const clickX = event.clientX - rect.left;
          const clickY = event.clientY - rect.top;
          
          // Only handle clicks within canvas bounds
          if (clickX >= 0 && clickX <= canvas.width && clickY >= 0 && clickY <= canvas.height) {
            // Check if placement is valid - only build if all tiles are green (valid)
            if (previewData.valid === true) {
              // Execute build command with tile coordinates
              // This places foundation tiles at the cursor position
              socket.send(JSON.stringify({
                msg: 'buildAt',
                buildingType: buildPreviewType,
                tileX: previewData.tileX,
                tileY: previewData.tileY
              }));
              
              // Exit preview mode after sending build command
              // If build fails, it will be canceled via chat message handler
              this.config.buildPreviewMode = false;
              this.config.buildPreviewType = null;
              this.config.buildPreviewData = null;
              
              // Also clear window variables
              if (typeof window !== 'undefined') {
                window.buildPreviewMode = false;
                window.buildPreviewType = null;
                window.buildPreviewData = null;
                window.buildPreviewValidationCache = null;
                window.buildPreviewLastTile = null;
              }
            } else {
              // Invalid placement - cancel preview mode
              this.config.buildPreviewMode = false;
              this.config.buildPreviewType = null;
              this.config.buildPreviewData = null;
              
              // Also clear window variables
              if (typeof window !== 'undefined') {
                window.buildPreviewMode = false;
                window.buildPreviewType = null;
                window.buildPreviewData = null;
                window.buildPreviewValidationCache = null;
                window.buildPreviewLastTile = null;
              }
            }
          }
        }
      }
      return;
    }
    
    // Handle target selection and attack command mode
    if (!selfId || !Player.list[selfId]) return;
    
    const player = Player.list[selfId];
    const canvas = document.getElementById('ctx');
    if (!canvas) return;
    
    // Cancel work command mode on left-click
    if (this.config.workCommandMode) {
      this.config.workCommandMode = false;
      // Sync with global workCommandMode variable
      if (typeof window !== 'undefined') {
        window.workCommandMode = false;
      }
      console.log('Work command mode cancelled by left-click');
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    // Reverse the zoom transform, then subtract viewport offset
    // Use window.currentZoom which is updated by GameLoopManager
    const viewport = this.config.viewport || (typeof window !== 'undefined' && window.viewport);
    const zoom = (typeof window !== 'undefined' && window.currentZoom) || currentZoom || 1.0;
    
    // Validate viewport and offsets
    if (!viewport || !viewport.offset || viewport.offset.length < 2) {
      console.error('Click handler: Invalid viewport', viewport);
      return;
    }
    
    const worldX = (clickX - WIDTH / 2) / zoom + WIDTH / 2 - viewport.offset[0];
    const worldY = (clickY - HEIGHT / 2) / zoom + HEIGHT / 2 - viewport.offset[1];
    
    // Validate world coordinates
    if (isNaN(worldX) || isNaN(worldY)) {
      console.error('Click handler: Invalid world coordinates', { clickX, clickY, WIDTH, HEIGHT, zoom, viewport, worldX, worldY });
      return;
    }
    
    // Check if clicking on an entity
    // Use getCurrentZ() to get the current z level (handles caves)
    const currentZ = this.config.getCurrentZ ? this.config.getCurrentZ() : player.z;
    
    // Get actual selfId for innaWoods check
    let actualSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null)
      ? window.selfId
      : selfId;
    
    // If still a random decimal (0-1), try to find the real player ID from Player.list
    if (typeof actualSelfId === 'number' && actualSelfId > 0 && actualSelfId < 1) {
      for (const pid in Player.list) {
        const p = Player.list[pid];
        if (p && !p.toRemove && p.class && !p.shipType && p.class !== 'FishingShip' && p.class !== 'CargoShip') {
          actualSelfId = pid;
          break;
        }
      }
    }
    
    // Get player's innaWoods value for compatibility check
    const playerInnaWoods = (actualSelfId && Player.list[actualSelfId]) 
      ? (Player.list[actualSelfId].innaWoods || false)
      : false;
    
    let clickedEntity = null;
    let closestEntity = null;
    let closestDistance = Infinity;
    for (const id in Player.list) {
      const entity = Player.list[id];
      if (entity && entity.z === currentZ) {
        // Skip Falcons - their sprites are massive (include shadows) and shouldn't be clickable
        if (entity.class === 'Falcon') continue;
        
        // Check innaWoods compatibility (only applies to overworld z=0)
        // Only block if player is NOT in woods and entity IS in woods
        // Players with innaWoods=true can see all units
        if (currentZ === 0) {
          const entityInnaWoods = entity.innaWoods || false;
          if (!playerInnaWoods && entityInnaWoods) {
            continue; // Skip entities in woods when player is not in woods
          }
        }
        
        const dx = entity.x - worldX;
        const dy = entity.y - worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Use actual sprite size for detection (spriteSize is typically 64, so radius is 32)
        let entitySpriteSize = entity.spriteSize || 64;
        let detectionRadius = entitySpriteSize / 2;
        // Account for scaled sprites (e.g., minibosses)
        if ((entity.class === 'Wolf' || entity.class === 'Boar') && entity.spriteScale) {
          detectionRadius = (entitySpriteSize * entity.spriteScale) / 2;
        }
        // Track closest entity for debugging
        if (distance < closestDistance) {
          closestEntity = id;
          closestDistance = distance;
        }
        if (distance < detectionRadius) {
          clickedEntity = id;
          break;
        }
      }
    }
    
    // Debug logging for click detection
    if (!clickedEntity && closestEntity) {
      console.log('Click detected but no entity hit. Closest entity:', closestEntity, 'distance:', closestDistance.toFixed(2), 'worldX:', worldX.toFixed(2), 'worldY:', worldY.toFixed(2));
    }
    
    if (clickedEntity) {
      // Attack command mode: left-click on entity
      if (this.config.attackCommandMode) {
        // In attack command mode, left-click on ANY unit initiates combat (regardless of ally/enemy status)
        socket.send(JSON.stringify({ msg: 'engageCombat', targetId: clickedEntity }));
        console.log('Attack command: engaging combat with unit:', clickedEntity);
        // Consume attack command mode after issuing command
        this.config.attackCommandMode = false;
        // Sync to window for cursor renderer
        if (typeof window !== 'undefined') {
          window.attackCommandMode = false;
        }
      } else {
        // Normal target selection
        this.config.selectedTarget = clickedEntity;
        // Also sync to global variable for backward compatibility
        if(typeof window !== 'undefined') {
          window.selectedTarget = clickedEntity;
        }
        socket.send(JSON.stringify({ msg: 'selectTarget', targetId: clickedEntity }));
        console.log('Target selected:', clickedEntity, 'config.selectedTarget:', this.config.selectedTarget);
      }
    } else {
      // Clicked on terrain
      if (this.config.attackCommandMode) {
        // DISABLE attack-move if player is aboard a ship
        if (player.boardedShip) {
          return; // Ignore attack-move while aboard ship
        }
        
        // Attack-move command: player moves towards destination while attacking enemies along the way
        // Use the same coordinate calculation as right-click navigation
        // Convert screen coordinates to world coordinates (recalculate to ensure accuracy)
        const viewportForAttack = this.config.viewport || (typeof window !== 'undefined' && window.viewport);
        const zoomForAttack = (typeof window !== 'undefined' && window.currentZoom) || currentZoom || 1.0;
        const worldXForAttack = (clickX - WIDTH / 2) / zoomForAttack + WIDTH / 2 - viewportForAttack.offset[0];
        const worldYForAttack = (clickY - HEIGHT / 2) / zoomForAttack + HEIGHT / 2 - viewportForAttack.offset[1];
        
        // Get tileSize from window if config doesn't have it (updated by SocketMessageHandler)
        const currentTileSize = tileSize || (typeof window !== 'undefined' && window.tileSize) || 64;
        
        // Convert to tile coordinates (same as right-click navigation)
        const tileX = Math.floor(worldXForAttack / currentTileSize);
        const tileY = Math.floor(worldYForAttack / currentTileSize);
        
        // Use getCurrentZ() to get the current z level (handles caves)
        const currentZ = this.config.getCurrentZ ? this.config.getCurrentZ() : player.z;
        
        socket.send(JSON.stringify({ msg: 'attackMove', tileX: tileX, tileY: tileY, z: currentZ }));
        // Consume attack command mode after issuing command
        this.config.attackCommandMode = false;
        // Sync to window for cursor renderer
        if (typeof window !== 'undefined') {
          window.attackCommandMode = false;
        }
      } else {
        // Left-click on terrain (not in attack command mode) - deselect target
        // Only deselect if we have a target selected
        if (this.config.selectedTarget) {
          this.clearTarget();
        }
      }
    }
  }

  /**
   * Handle context menu events
   * @param {MouseEvent} event - Mouse event
   */
  handleContextMenu(event) {
    const {
      Player,
      Building,
      Item,
      socket,
      spectateCameraSystem,
      godModeCamera,
      loginCameraSystem,
      attackCommandMode,
      buildPreviewMode,
      buildPreviewType,
      buildPreviewData,
      workCommandMode,
      hoveredInteractable,
      WIDTH,
      HEIGHT,
      currentZoom,
      tileSize,
      getTile,
      getLoc,
      getBuilding,
      allyCheck,
      tileHighlights
    } = this.config;

    // Always prefer window.selfId if available (updated by SocketMessageHandler)
    let selfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null) 
      ? window.selfId 
      : (this.config.selfId !== undefined ? this.config.selfId : null);
    
    // Get actual selfId - prefer window.selfId (updated by SocketMessageHandler)
    let actualSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null)
      ? window.selfId
      : selfId;
    
    // If still a random decimal (0-1), try to find the real player ID from Player.list
    // Look for entities that are not ships, not buildings, and have a class (likely players)
    if (typeof actualSelfId === 'number' && actualSelfId > 0 && actualSelfId < 1) {
      for (const pid in Player.list) {
        const p = Player.list[pid];
        // Player entities typically have a class but are not ships
        if (p && !p.toRemove && p.class && !p.shipType && p.class !== 'FishingShip' && p.class !== 'CargoShip') {
          actualSelfId = pid;
          break;
        }
      }
    }

    // Always prevent default context menu
    event.preventDefault();
    
    console.log('Right-click detected');
    
    // Cancel attack command mode on right click
    if (this.config.attackCommandMode) {
      this.config.attackCommandMode = false;
      // Sync to window for cursor renderer
      if (typeof window !== 'undefined') {
        window.attackCommandMode = false;
      }
      console.log('Attack command mode cancelled');
      return;
    }
    
    if (this.config.buildPreviewMode) {
      // Right click cancels preview mode immediately
      this.config.buildPreviewMode = false;
      this.config.buildPreviewType = null;
      this.config.buildPreviewData = null;
      
      // Also clear window variables
      if (typeof window !== 'undefined') {
        window.buildPreviewMode = false;
        window.buildPreviewType = null;
        window.buildPreviewData = null;
        window.buildPreviewValidationCache = null;
        window.buildPreviewLastTile = null;
      }
      return;
    }
    
    // Block during spectate/god mode/login
    if (spectateCameraSystem.isActive || godModeCamera.isActive || loginCameraSystem.isActive) {
      console.log('Right-click blocked - spectate/god/login mode active');
      return;
    }
    
    // Handle right-click navigation/combat/interaction
    if (!selfId || !Player.list[selfId]) {
      console.log('Right-click blocked - no selfId or player', { selfId, hasPlayer: !!(selfId && Player.list[selfId]) });
      return;
    }
    
    const player = Player.list[selfId];
    const canvas = document.getElementById('ctx');
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    // Reverse the zoom transform, then subtract viewport offset
    // Use window.currentZoom which is updated by GameLoopManager
    const viewport = this.config.viewport || (typeof window !== 'undefined' && window.viewport);
    const zoom = (typeof window !== 'undefined' && window.currentZoom) || currentZoom || 1.0;
    const worldX = (clickX - WIDTH / 2) / zoom + WIDTH / 2 - viewport.offset[0];
    const worldY = (clickY - HEIGHT / 2) / zoom + HEIGHT / 2 - viewport.offset[1];
    
    // Get tileSize from window if config doesn't have it (updated by SocketMessageHandler)
    const currentTileSize = tileSize || (typeof window !== 'undefined' && window.tileSize) || 64;
    
    // Convert to tile coordinates
    const tileX = Math.floor(worldX / currentTileSize);
    const tileY = Math.floor(worldY / currentTileSize);
    
    // Handle work command mode - check if tile is workable
    if (this.config.workCommandMode) {
      // DISABLE work command mode if player is aboard a ship
      if (player.boardedShip) {
        return; // Ignore work commands while aboard ship
      }
      // Get the clicked tile
      const clickedTile = getTile(player.z === 0 ? 0 : (player.z === -1 ? 1 : (player.z === -2 ? 8 : (player.z === 1 ? 3 : 5))), tileX, tileY);
      
      // Check if tile is workable (water, stone, mountain, forest, brush, foundation, construction)
      let isWorkable = false;
      
      if (player.z === 0) {
        // Overworld workable tiles
        if (clickedTile === 0 || clickedTile >= 1 && clickedTile < 3 || clickedTile >= 3 && clickedTile < 4 || 
            clickedTile >= 4 && clickedTile < 6 || 
            clickedTile === 11 || clickedTile === 11.5 || clickedTile === 12 || clickedTile === 12.5 || 
            clickedTile === 13 || clickedTile === 15 || clickedTile === 17) {
          // Water (0), forest (1-2), brush (3-4), rocks/mountain (3-6), foundation/construction (11, 11.5, 12, 12.5, 13, 15, 17)
          isWorkable = true;
        }
      }
      
      if (isWorkable) {
        // Send work command for this tile
        console.log('Work command sent for tile:', tileX, tileY, 'z:', player.z);
        socket.send(JSON.stringify({ msg: 'workAtTile', tileX: tileX, tileY: tileY, z: player.z }));
        // Add tile highlight at clicked location
        console.log('Adding tile highlight at:', tileX, tileY, player.z);
        const tileHighlights = this.config.tileHighlights || (typeof window !== 'undefined' && window.tileHighlights);
        if (tileHighlights && tileHighlights.addHighlight) {
          tileHighlights.addHighlight(tileX, tileY, player.z);
          const highlightCount = (tileHighlights.highlights && typeof tileHighlights.highlights === 'object') 
            ? Object.keys(tileHighlights.highlights).length 
            : 0;
          console.log('Highlight added, total highlights:', highlightCount);
        } else {
          console.warn('tileHighlights not available');
        }
        this.config.workCommandMode = false; // Cancel work mode after sending command
        // Sync with global workCommandMode variable
        if (typeof window !== 'undefined') {
          window.workCommandMode = false;
        }
        return;
      } else {
        // Not workable - cancel work mode and proceed with normal navigation
        this.config.workCommandMode = false;
        // Sync with global workCommandMode variable
        if (typeof window !== 'undefined') {
          window.workCommandMode = false;
        }
        console.log('Tile not workable, cancelling work mode');
      }
    }
    
    // Check if clicking on an entity
    // Use getCurrentZ() to get the current z level (handles caves)
    const currentZ = this.config.getCurrentZ ? this.config.getCurrentZ() : player.z;
    let clickedEntity = null;
    let closestEntity = null;
    let closestDistance = Infinity;
    for (const id in Player.list) {
      const entity = Player.list[id];
      if (entity && entity.z === currentZ) {
        // Skip Falcons - their sprites are massive (include shadows) and shouldn't be clickable
        if (entity.class === 'Falcon') continue;
        
        const dx = entity.x - worldX;
        const dy = entity.y - worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Use actual sprite size for detection (spriteSize is typically 64, so radius is 32)
        let entitySpriteSize = entity.spriteSize || 64;
        let detectionRadius = entitySpriteSize / 2;
        // Account for scaled sprites (e.g., minibosses)
        if ((entity.class === 'Wolf' || entity.class === 'Boar') && entity.spriteScale) {
          detectionRadius = (entitySpriteSize * entity.spriteScale) / 2;
        }
        if (distance < closestDistance) {
          closestEntity = id;
          closestDistance = distance;
        }
        if (distance < detectionRadius) {
          clickedEntity = id;
          break;
        }
      }
    }
    
    // Debug logging
    if (!clickedEntity && closestEntity) {
      console.log('Right-click: No entity clicked, closest was:', closestEntity, 'at distance:', closestDistance.toFixed(2), 'worldX:', worldX.toFixed(2), 'worldY:', worldY.toFixed(2));
    }
    
    if (clickedEntity) {
      const clickedEntityObj = Player.list[clickedEntity];
      
      // Check if this is a boardable ship
      if (clickedEntityObj && clickedEntityObj.shipType) {
        // Always send boarding request - let server validate ownership/dock status
        // Server has correct player ID and can make the final decision
        // Client-side check is just for UX (cursor), not for blocking requests
        socket.send(JSON.stringify({
          msg: 'interactWithPath',
          entityType: 'ship',
          entityId: clickedEntity
        }));
        return;
      }
      
      // Right-clicked on entity - check if enemy
      const allyStatus = allyCheck(clickedEntity);
      console.log('Right-click on entity:', clickedEntity, 'ally status:', allyStatus, 'entity class:', Player.list[clickedEntity]?.class);
      if (allyStatus === -1) {
        // Enemy - engage combat
        socket.send(JSON.stringify({ msg: 'engageCombat', targetId: clickedEntity }));
        console.log('Right-click combat engagement sent:', clickedEntity);
        return; // Prevent navigation when engaging combat
      } else {
        // Friendly - navigate to them
        // DISABLE navigation if player is aboard a ship
        if (player.boardedShip) {
          return; // Ignore click navigation while aboard ship
        }
        // Add tile highlight for navigation
        const tileHighlights = this.config.tileHighlights || (typeof window !== 'undefined' && window.tileHighlights);
        if (tileHighlights && typeof tileHighlights.addHighlight === 'function') {
          tileHighlights.addHighlight(tileX, tileY, player.z);
        }
        socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: tileX, tileY: tileY, z: player.z }));
        return; // Prevent further processing
      }
    } else {
      // Use getCurrentZ() to get the current z level (handles caves)
      const currentZ = this.config.getCurrentZ ? this.config.getCurrentZ() : player.z;
      
      // BUILDING ENTRANCE NAVIGATION FIX:
      // When clicking on any tile of a building plot (on overworld), redirect to the building's entrance
      // This allows players to path to building entrances by clicking anywhere on the building
      if (currentZ === 0) {
        const clickedBuildingForNav = getBuilding(worldX, worldY);
        if (clickedBuildingForNav && Building.list[clickedBuildingForNav]) {
          const buildingForNav = Building.list[clickedBuildingForNav];
          
          // Skip entrance redirection for interactable buildings (mills, docks, etc.) 
          // as they have their own interaction logic
          const isInteractableBuildingTypeForNav = (buildingForNav.type === 'mill' || buildingForNav.type === 'lumbermill' || 
                                                    buildingForNav.type === 'mine' || buildingForNav.type === 'dock');
          
          if (!isInteractableBuildingTypeForNav) {
            // Find the entrance tile (door tile - 14 or 16) in the building's vicinity
            if (buildingForNav.plot && Array.isArray(buildingForNav.plot)) {
              let entranceTile = null;
              
              // Search the building's plot and adjacent tiles for a door
              for (let p = 0; p < buildingForNav.plot.length; p++) {
                const plotTile = buildingForNav.plot[p];
                if (plotTile && plotTile.length >= 2) {
                  // Check this tile and tiles adjacent (especially below, since entrances are often at bottom)
                  const checkPositions = [
                    [plotTile[0], plotTile[1]],
                    [plotTile[0], plotTile[1] + 1], // Below
                  ];
                  
                  for (const pos of checkPositions) {
                    const tileValue = getTile(0, pos[0], pos[1]);
                    if (tileValue === 14 || tileValue === 16) { // Door tiles
                      entranceTile = pos;
                      break;
                    }
                  }
                  if (entranceTile) break;
                }
              }
              
              // If entrance found, navigate to it immediately and return
              if (entranceTile) {
                const navTileX = entranceTile[0];
                const navTileY = entranceTile[1];
                console.log('Building click redirected to entrance:', navTileX, navTileY, 'from:', tileX, tileY);
                
                // DISABLE navigation if player is aboard a ship
                if (player.boardedShip) {
                  return; // Ignore click navigation while aboard ship
                }
                
                // Add highlight ONLY at entrance tile
                const tileHighlights = this.config.tileHighlights || (typeof window !== 'undefined' && window.tileHighlights);
                if (tileHighlights && typeof tileHighlights.addHighlight === 'function') {
                  tileHighlights.addHighlight(navTileX, navTileY, player.z);
                }
                
                // Send navigation to entrance
                socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: navTileX, tileY: navTileY, z: player.z }));
                return; // IMPORTANT: Early return to prevent any other code from running
              }
            }
          }
        }
      }
      
      // If we get here, either:
      // - Not on overworld
      // - Not clicking on a building
      // - Building doesn't have entrance (or is interactable type)
      // Continue with normal navigation logic
      
      // Check if clicking on a foundation/construction tile first
      // Foundation tiles are part of building plots but should still allow navigation
      const clickedTile = getTile(currentZ === 0 ? 0 : (currentZ === -1 ? 1 : (currentZ === -2 ? 8 : (currentZ === 1 ? 3 : 5))), tileX, tileY);
      const foundationConstructionTiles = [11, 11.5, 12, 12.5, 13, 15, 17]; // BUILD_MARKER, BUILD_MARKER_ALT, and construction tiles
      const isFoundationConstructionTile = currentZ === 0 && foundationConstructionTiles.indexOf(clickedTile) !== -1;
      
      // If player is indoors (z=1 or z=2), always allow navigation (don't check for building interaction)
      // Building interaction only happens when clicking on buildings from outside
      const isIndoors = currentZ === 1 || currentZ === 2;
      
      // Check if clicking on an interactable (building or object) - prioritize this
      // First, check if there's a building at the clicked location and verify it's interactable
      const clickedTileLoc = [tileX, tileY];
      const clickedBuildingId = getBuilding(worldX, worldY);
      const clickedBuilding = clickedBuildingId ? Building.list[clickedBuildingId] : null;
      
      // Verify the clicked tile is actually interactable for this building
      if (clickedBuilding && currentZ === 0) {
        let isInteractableTile = false;
        const isInteractableBuildingType = (clickedBuilding.type === 'mill' || clickedBuilding.type === 'lumbermill' || 
                                           clickedBuilding.type === 'mine' || clickedBuilding.type === 'dock');
        
        // Only check interactability for interactable building types
        if (isInteractableBuildingType && clickedBuilding.plot && Array.isArray(clickedBuilding.plot)) {
          if (clickedBuilding.type === 'dock') {
            // For docks: only plot[4] (the non-walkable tile) is interactable
            if (clickedBuilding.plot[4] && clickedBuilding.plot[4].length >= 2) {
              if (clickedBuilding.plot[4][0] === clickedTileLoc[0] && clickedBuilding.plot[4][1] === clickedTileLoc[1]) {
                isInteractableTile = true;
              }
            }
          } else if (clickedBuilding.type === 'mill' || clickedBuilding.type === 'lumbermill' || clickedBuilding.type === 'mine') {
            // For mills, lumbermills, mines: all plot tiles are interactable
            for (let p = 0; p < clickedBuilding.plot.length; p++) {
              const plotTile = clickedBuilding.plot[p];
              if (plotTile && plotTile.length >= 2 && plotTile[0] === clickedTileLoc[0] && plotTile[1] === clickedTileLoc[1]) {
                isInteractableTile = true;
                break;
              }
            }
          }
        }
        
        // Handle interaction or navigation based on tile interactability
        if (isInteractableTile && clickedBuilding.built !== false) {
          // Clicked on an interactable tile of a built building - use interactWithPath
          console.log('Right-click interaction with building:', clickedBuildingId, 'tile:', clickedTileLoc);
          socket.send(JSON.stringify({
            msg: 'interactWithPath',
            entityType: 'building',
            entityId: clickedBuildingId,
            worldX: worldX,
            worldY: worldY
          }));
          return; // Prevent further processing
        } else if (isInteractableBuildingType) {
          // Clicked on a non-interactable tile of an interactable building (e.g., walkable dock tile)
          // OR clicked on a building that's not built yet
          // Allow normal navigation instead of interaction
          console.log('Right-click on non-interactable tile of building (or building not built) - allowing navigation instead of interaction');
          // Clear hoveredInteractable to prevent it from being used in other code paths
          this.config.hoveredInteractable = null;
          socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: tileX, tileY: tileY, z: player.z }));
          return; // Prevent further processing - don't check hoveredInteractable
        }
        // If building is not an interactable type, fall through to normal navigation
      }
      
      // Fallback: check hoveredInteractable if no building found at clicked location
      if (this.config.hoveredInteractable) {
        // Determine entity type (building vs item)
        let entityType = null;
        const entityId = this.config.hoveredInteractable;
        
        // Check if it's a building (on overworld)
        if (player.z === 0 && Building.list[this.config.hoveredInteractable]) {
          const building = Building.list[this.config.hoveredInteractable];
          
          // Re-check if the clicked tile is interactable for this building
          let isInteractableTile = false;
          
          if (building.plot && Array.isArray(building.plot)) {
            if (building.type === 'dock') {
              // For docks: only plot[4] (the non-walkable tile) is interactable
              if (building.plot[4] && building.plot[4].length >= 2) {
                if (building.plot[4][0] === clickedTileLoc[0] && building.plot[4][1] === clickedTileLoc[1]) {
                  isInteractableTile = true;
                }
              }
            } else if (building.type === 'mill' || building.type === 'lumbermill' || building.type === 'mine') {
              // For mills, lumbermills, mines: all plot tiles are interactable
              for (let p = 0; p < building.plot.length; p++) {
                const plotTile = building.plot[p];
                if (plotTile && plotTile.length >= 2 && plotTile[0] === clickedTileLoc[0] && plotTile[1] === clickedTileLoc[1]) {
                  isInteractableTile = true;
                  break;
                }
              }
            }
          }
          
          if (!isInteractableTile) {
            // Clicked on a non-interactable tile - allow normal navigation instead of interaction
            console.log('Right-click on non-interactable tile of building - allowing navigation instead of interaction');
            socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: tileX, tileY: tileY, z: player.z }));
            return;
          }
          
          // For buildings, use interactWithPath to pathfind to adjacent tile first
          entityType = 'building';
          console.log('Right-click interaction with building:', this.config.hoveredInteractable, 'tile:', clickedTileLoc, 'isInteractableTile:', isInteractableTile);
          socket.send(JSON.stringify({
            msg: 'interactWithPath',
            entityType: entityType,
            entityId: entityId,
            worldX: worldX,
            worldY: worldY
          }));
          return; // Prevent further processing
        } else if (Item.list[this.config.hoveredInteractable]) {
          // For items (including chests on all z-levels), use interactWithPath (requires pathfinding)
          entityType = 'item';
          console.log('Right-click interaction with', entityType + ':', this.config.hoveredInteractable);
          socket.send(JSON.stringify({
            msg: 'interactWithPath',
            entityType: entityType,
            entityId: entityId,
            worldX: worldX,
            worldY: worldY
          }));
          return; // Prevent further processing
        }
      }
      
      // If it's a foundation/construction tile, always allow navigation (don't check for building interaction)
      if (isFoundationConstructionTile || isIndoors) {
        // Right-clicked on foundation/construction tile or indoors - navigate to it
        // Note: For indoors/foundation, don't use entrance redirection - navigate to clicked tile
        console.log('Right-click navigation - world coords:', worldX, worldY, 'tile coords:', tileX, tileY, 'z:', player.z, 'tile:', clickedTile, 'indoors:', isIndoors, 'foundation:', isFoundationConstructionTile);
        // DISABLE navigation if player is aboard a ship
        if (player.boardedShip) {
          return; // Ignore click navigation while aboard ship
        }
        
        socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: tileX, tileY: tileY, z: player.z }));
        // Add tile highlight at clicked location
        console.log('Adding tile highlight at:', tileX, tileY, player.z);
        const tileHighlights = this.config.tileHighlights || (typeof window !== 'undefined' && window.tileHighlights);
        if (tileHighlights && tileHighlights.addHighlight) {
          tileHighlights.addHighlight(tileX, tileY, player.z);
          const highlightCount = (tileHighlights.highlights && typeof tileHighlights.highlights === 'object') 
            ? Object.keys(tileHighlights.highlights).length 
            : 0;
          console.log('Highlight added, total highlights:', highlightCount);
        } else {
          console.warn('tileHighlights not available');
        }
      } else {
        // Right-clicked on terrain or building that wasn't handled above - navigate to clicked tile
        // Note: If a building with entrance was clicked, it would have been handled earlier and returned
        // This fallback is for terrain, buildings without entrances, or buildings not in Building.list
        // DISABLE navigation if player is aboard a ship
        if (player.boardedShip) {
          return; // Ignore click navigation while aboard ship
        }
        
        console.log('Right-click navigation - world coords:', worldX, worldY, 'tile coords:', tileX, tileY, 'z:', player.z);
        socket.send(JSON.stringify({ msg: 'clickNavigate', tileX: tileX, tileY: tileY, z: player.z }));
        // Add tile highlight at navigation destination
        console.log('Adding tile highlight at:', tileX, tileY, player.z);
        const tileHighlights = this.config.tileHighlights || (typeof window !== 'undefined' && window.tileHighlights);
        if (tileHighlights && tileHighlights.addHighlight) {
          tileHighlights.addHighlight(tileX, tileY, player.z);
          const highlightCount = (tileHighlights.highlights && typeof tileHighlights.highlights === 'object') 
            ? Object.keys(tileHighlights.highlights).length 
            : 0;
          console.log('Highlight added, total highlights:', highlightCount);
        } else {
          console.warn('tileHighlights not available');
        }
      }
    }
  }
}

// Export for use in client.js
if (typeof window !== 'undefined') {
  window.InputHandler = InputHandler;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputHandler;
}
