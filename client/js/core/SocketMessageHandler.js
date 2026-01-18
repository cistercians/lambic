/**
 * SocketMessageHandler.js
 * Handles all incoming socket messages from the server
 * Extracted from client.js to reduce complexity
 */

var _missingEntityUpdateStats = {
  lastWarn: 0,
  counts: {
    player: 0,
    item: 0,
    arrow: 0,
    light: 0,
    building: 0
  }
};

function warnMissingEntityUpdate(type, id) {
  if (!_missingEntityUpdateStats.counts[type]) {
    _missingEntityUpdateStats.counts[type] = 0;
  }
  _missingEntityUpdateStats.counts[type] += 1;
  const now = Date.now();
  if (now - _missingEntityUpdateStats.lastWarn > 2000) {
    _missingEntityUpdateStats.lastWarn = now;
    console.warn('[SocketMessageHandler] Update pack missing entity', {
      type,
      id,
      counts: _missingEntityUpdateStats.counts
    });
  }
}

function createPlayerFromUpdatePack(pack) {
  const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
  const isFaunaUpdate = pack.type === 'fauna' || faunaClasses.includes(pack.class);
  if (!pack || !pack.id || !pack.class) return null;
  const type = pack.type || (isFaunaUpdate ? 'fauna' : undefined);
  if (!type) return null;
  try {
    return new Player({
      id: pack.id,
      type: type,
      class: pack.class,
      name: pack.name,
      x: pack.x,
      y: pack.y,
      z: pack.z,
      hp: pack.hp,
      hpMax: pack.hpMax,
      spriteSize: pack.spriteSize,
      inBattleground: pack.inBattleground,
      battlegroundMatchId: pack.battlegroundMatchId,
      house: pack.house,
      kingdom: pack.kingdom,
      rank: pack.rank,
      gear: pack.gear,
      friends: pack.friends,
      enemies: pack.enemies,
      innaWoods: pack.innaWoods,
      onMtn: pack.onMtn,
      facing: pack.facing,
      stealthed: pack.stealthed,
      revealed: pack.revealed,
      spirit: pack.spirit,
      spiritMax: pack.spiritMax,
      action: pack.action,
      ghost: pack.ghost,
      kills: pack.kills,
      skulls: pack.skulls,
      spriteScale: pack.spriteScale
    });
  } catch (e) {
    console.error('Failed to create player from update pack:', e, pack);
    return null;
  }
}

function getOrCreateEntity(list, pack, ctor, type) {
  if (!pack || !pack.id) return null;
  let entity = list ? list[pack.id] : null;
  if (!entity) {
    try {
      entity = new ctor(pack);
      warnMissingEntityUpdate(type, pack.id);
    } catch (e) {
      console.error(`Failed to create ${type} from update pack:`, e, pack);
      return null;
    }
  }
  return entity;
}

var SocketMessageHandler = {
  /**
   * Handle incoming socket message
   * @param {Object} data - Parsed JSON message from server
   */
  handle: function(data) {
    if(data.msg == 'previewData'){
      this.handlePreviewData(data);
    } else if(data.msg == 'signInResponse'){
      this.handleSignInResponse(data);
    } else if(data.msg == 'spectateResponse'){
      this.handleSpectateResponse(data);
    } else if(data.msg == 'signUpResponse'){
      this.handleSignUpResponse(data);
    } else if(data.msg == 'bgm'){
      // For spectators, only update ambient sound (not BGM)
      if(typeof spectateCameraSystem !== 'undefined' && spectateCameraSystem && spectateCameraSystem.isActive) {
        // Spectator mode - only update ambient sound, skip BGM
        if(typeof AudioSystem !== 'undefined' && AudioSystem.soundscape) {
          AudioSystem.soundscape(data.x, data.y, data.z, data.b || {});
        }
      } else if(typeof getBgm !== 'undefined') {
        // Normal player - update both BGM and ambient sound
        getBgm(data.x, data.y, data.z, data.b);
      }
    } else if(data.msg == 'addToChat'){
      this.handleAddToChat(data);
    } else if(data.msg == 'npcSpeaking'){
      this.handleNpcSpeaking(data);
    } else if(data.msg == 'spectatorChatMessage'){
      this.handleSpectatorChatMessage(data);
    } else if(data.msg == 'spectatorEvent'){
      this.handleSpectatorEvent(data);
    } else if(data.msg == 'worldMapData'){
      this.handleWorldMapData(data);
    } else if(data.msg == 'battlegroundMapData'){
      this.handleBattlegroundMapData(data);
    } else if(data.msg == 'caveMapData'){
      this.handleCaveMapData(data);
    } else if(data.msg == 'buildMenuData'){
      this.handleBuildMenuData(data);
    } else if(data.msg == 'resourceScoreboard' || data.msg == 'resourceScoreboardUpdate'){
      this.handleResourceScoreboard(data);
    } else if(data.msg == 'battlegroundsLeaderboard'){
      this.handleBattlegroundsLeaderboard(data);
    } else if(data.msg == 'buildPreviewData'){
      this.handleBuildPreviewData(data);
    } else if(data.msg == 'buildValidationData'){
      this.handleBuildValidationData(data);
    } else if(data.msg == 'gearUpdate'){
      this.handleGearUpdate(data);
    } else if(data.msg == 'openMarket'){
      this.handleOpenMarket(data);
    } else if(data.msg == 'openDock'){
      this.handleOpenDock(data);
    } else if(data.msg == 'openDeposit'){
      this.handleOpenDeposit(data);
    } else if(data.msg == 'openChest'){
      this.handleOpenChest(data);
    } else if(data.msg == 'openHouseCreation'){
      this.handleOpenHouseCreation(data);
    } else if(data.msg == 'openBattlegroundsLobby'){
      this.handleOpenBattlegroundsLobby(data);
    } else if(data.msg == 'pokerInvitation'){
      this.handlePokerInvitation(data);
    } else if(data.msg == 'battlegroundsMatchUpdate'){
      this.handleBattlegroundsMatchUpdate(data);
    } else if(data.msg == 'battlegroundsMatchEnd'){
      this.handleBattlegroundsMatchEnd(data);
    } else if(data.msg == 'battlegroundsVotingStart'){
      this.handleBattlegroundsVotingStart(data);
    } else if(data.msg == 'battlegroundsVotingUpdate'){
      this.handleBattlegroundsVotingUpdate(data);
    } else if(data.msg == 'battlegroundsVotingResults'){
      this.handleBattlegroundsVotingResults(data);
    } else if(data.msg == 'battlegroundsLobbyUpdate'){
      this.handleBattlegroundsLobbyUpdate(data);
    } else if(data.msg == 'battlegroundsLobbyChat'){
      this.handleBattlegroundsLobbyChat(data);
    } else if(data.msg == 'disembarkShip'){
      this.handleDisembarkShip(data);
    } else if(data.msg == 'fishCatch'){
      this.handleFishCatch(data);
    } else if(data.msg == 'boardShip'){
      this.handleBoardShip(data);
    } else if(data.msg == 'tileEdit'){
      this.handleTileEdit(data);
    } else if(data.msg == 'layerEdit'){
      this.handleLayerEdit(data);
    } else if(data.msg == 'mapEdit'){
      this.handleMapEdit(data);
    } else if(data.msg == 'buildingPreview'){
      this.handleBuildingPreview(data);
    } else if(data.msg == 'init'){
      this.handleInit(data);
    } else if(data.msg == 'battlegroundWorld'){
      this.handleBattlegroundWorld(data);
    } else if(data.msg == 'battlegroundsMapPreview'){
      if(this.handleBattlegroundsMapPreview) {
        this.handleBattlegroundsMapPreview(data);
      }
    } else if(data.msg == 'update'){
      this.handleUpdate(data);
    } else if(data.msg == 'remove'){
      this.handleRemove(data);
    } else if(data.msg == 'tempus'){
      this.handleTempus(data);
    } else if(data.msg == 'godMode'){
      this.handleGodMode(data);
    } else if(data.msg == 'ghostMode'){
      this.handleGhostMode(data);
    } else if(data.msg == 'newFaction'){
      this.handleNewFaction(data);
    }
  },

  handlePreviewData: function(data) {
    // Load world data for login screen preview (no selfId set)
    
    // Store in global scope FIRST so GameLoopManager can access updated values immediately
    if (typeof window !== 'undefined') {
      window.world = data.world;
      window.tileSize = data.tileSize;
      // Reinitialize SpriteRegistry with actual tileSize from server
      if (typeof window !== 'undefined' && typeof window.reinitializeSpriteRegistry === 'function') {
        window.reinitializeSpriteRegistry(data.tileSize);
      }
      window.mapSize = data.mapSize;
      window.nightfall = data.nightfall;
      window.tempus = data.tempus;
    }
    
    // Also update global variables (for backward compatibility)
    if (typeof window !== 'undefined' && window.world) {
      world = window.world;
      tileSize = window.tileSize;
      mapSize = window.mapSize;
      tempus = window.tempus;
      nightfall = window.nightfall;
    } else {
      world = data.world;
      tileSize = data.tileSize;
      mapSize = data.mapSize;
      tempus = data.tempus;
      nightfall = data.nightfall;
      // Reinitialize SpriteRegistry with actual tileSize from server
      if (typeof window !== 'undefined' && typeof window.reinitializeSpriteRegistry === 'function') {
        window.reinitializeSpriteRegistry(data.tileSize);
      }
    }
    
    // Update UI sizing now that tileSize is known
    if(typeof resizeCanvas !== 'undefined') {
      resizeCanvas();
    }
    
    // Load entities for preview
    if(data.pack.player) {
      var previewLoadedCount = 0;
      var previewErrorCount = 0;
      
      for(i in data.pack.player){
        try {
          var playerData = data.pack.player[i];
          new Player(playerData);
          
          // Fix sprite immediately after creation
          var p = Player.list[playerData.id];
          if(p) {
            // Sprite is assigned in PlayerEntity constructor via assignSpriteToEntity()
            // If sprite assignment failed there, entity is marked _invalidSprite and won't render
            // No need to reassign here - PlayerEntity constructor handles it
            previewLoadedCount++;
          } else {
            console.error('Preview: Failed to create player entity:', playerData.id, playerData.class);
            previewErrorCount++;
          }
          
          // Register ships for wake tracking
          if(typeof shipWakes !== 'undefined' && shipWakes.isShipClass && shipWakes.isShipClass(playerData.class)) {
            shipWakes.addShip(playerData.id);
          }
        } catch(e) {
          console.error('Preview: Error loading entity:', e);
          previewErrorCount++;
        }
      }
    }
    if(data.pack.item) {
      for(i in data.pack.item){
        new Item(data.pack.item[i]);
      }
    }
    if(data.pack.building) {
      for(i in data.pack.building){
        new Building(data.pack.building[i]);
      }
    }
    
    // Count falcons
    var falconCount = 0;
    for(var id in Player.list) {
      if(Player.list[id].class === 'Falcon') {
        falconCount++;
      }
    }
    
    // Start login camera system once data is loaded
    if(typeof loginCameraSystem !== 'undefined' && loginCameraSystem && !loginCameraSystem.isActive) {
      loginCameraSystem.start(Player.list);
    }
  },

  handleSignInResponse: function(data) {
    if(data.success){
      world = data.world;
      tileSize = data.tileSize;
      mapSize = data.mapSize;
      
      // Store in global scope so GameLoopManager can access updated values
      if (typeof window !== 'undefined') {
        window.world = world;
        window.tileSize = tileSize;
        // Reinitialize SpriteRegistry with actual tileSize from server
        if (typeof window.reinitializeSpriteRegistry === 'function') {
          window.reinitializeSpriteRegistry(tileSize);
        }
        window.mapSize = mapSize;
      }
      tempus = data.tempus;
      
      // Update UI sizing now that tileSize is known
      if(typeof resizeCanvas !== 'undefined') {
        resizeCanvas();
      }
      
      // Stop cinematic camera and switch to player
      // Note: Camera position (cameraX/cameraY) is preserved for transition rendering
      if(window.loginCameraSystem) {
        // Capture final position before stopping (pass Player.list to preserve position)
        const finalPos = window.loginCameraSystem.getCameraPosition(Player.list);
        console.log('Sign-in: Stopping login camera, current position:', finalPos.x, finalPos.y);
        window.loginCameraSystem.stop(Player.list); // Pass Player.list to capture final position
        console.log('Sign-in: Login camera stopped, isActive:', window.loginCameraSystem.isActive, 'preserved position:', window.loginCameraSystem.cameraX, window.loginCameraSystem.cameraY);
      }
      
      // Hide login overlay and show UI
      var loginOverlay = document.getElementById('loginOverlay');
      if(loginOverlay) {
        loginOverlay.style.display = 'none';
      }
      
      // Enable canvas interaction
      var gameDiv = document.getElementById('gameDiv');
      if(gameDiv) {
        gameDiv.style.pointerEvents = 'auto';
      }
      
      // Show UI elements
      var skillsBar = document.getElementById('skills-bar');
      var chatMessagesContainer = document.getElementById('chat-messages-container');
      var chatInputWrapper = document.getElementById('chat-input-wrapper');
      if(skillsBar) skillsBar.style.display = 'flex';
      if(chatMessagesContainer) chatMessagesContainer.style.display = 'block';
      if(chatInputWrapper) chatInputWrapper.style.display = 'block';
      
      // Start initial chat hide timer
      if(window.chatManagerInstance) {
        window.chatManagerInstance.resetHideTimer();
      } else if(typeof resetChatHideTimer !== 'undefined') {
        resetChatHideTimer(); // Fallback to global function if ChatManager not initialized
      }
      
      // Don't try to access player entity yet - it's created when 'init' message arrives
      // Music will be set properly in init handler
    } else {
      alert('Sign-in failed.')
    }
  },

  handleSpectateResponse: function(data) {
    console.log('Spectate response received:', data.success);
    if(data.success){
      world = data.world;
      tileSize = data.tileSize;
      mapSize = data.mapSize;
      
      // Store in global scope so GameLoopManager can access updated values
      if (typeof window !== 'undefined') {
        window.world = world;
        window.tileSize = tileSize;
        // Reinitialize SpriteRegistry with actual tileSize from server
        if (typeof window.reinitializeSpriteRegistry === 'function') {
          window.reinitializeSpriteRegistry(tileSize);
        }
        window.mapSize = mapSize;
      }
      tempus = data.tempus;
      
      console.log('World data loaded, tileSize:', tileSize, 'mapSize:', mapSize);
      
      // Update UI sizing
      if(typeof resizeCanvas !== 'undefined') {
        resizeCanvas();
      }
      
      // Stop login camera
      if(window.loginCameraSystem) {
        console.log('Stopping login camera');
        window.loginCameraSystem.stop();
      }
      
      // Stop background music when entering spectate mode (keep ambient sound playing)
      if(window.AudioCtrl) {
        AudioCtrl.bgm.pause();
        AudioCtrl.bgm.currentTime = 0;
        AudioCtrl.playlist = null;
        // Note: Ambient sound (amb) is intentionally NOT stopped - spectators should hear ambient sounds
      }
      
      // Hide login overlay
      var loginOverlay = document.getElementById('loginOverlay');
      if(loginOverlay) {
        loginOverlay.style.display = 'none';
      }
      
      // Show only chat for spectators
      var chatMessagesContainer = document.getElementById('chat-messages-container');
      var chatInputWrapper = document.getElementById('chat-input-wrapper');
      if(chatMessagesContainer) chatMessagesContainer.style.display = 'block';
      if(chatInputWrapper) chatInputWrapper.style.display = 'block';
      
      // Activate spectate camera (will start fully in init handler)
      if(window.spectateCameraSystem) {
        window.spectateCameraSystem.isActive = true;
      }
      
      // Start chat hide timer for spectators
      if(window.chatManagerInstance) {
        window.chatManagerInstance.resetHideTimer();
      } else if(typeof resetChatHideTimer !== 'undefined') {
        resetChatHideTimer(); // Fallback to global function if ChatManager not initialized
      }
      
      console.log('Spectate response complete, waiting for init...');
    } else {
      alert('Spectate failed - invalid credentials.');
    }
  },

  handleSignUpResponse: function(data) {
    if(data.success){
      alert('Sign-up successful.')
    } else {
      alert('Sign-up failed.')
    }
  },

  handleAddToChat: function(data) {
    // Check for build errors and cancel preview mode if building fails
    if (data.message && typeof window !== 'undefined' && window.buildPreviewMode) {
      // Check for build error messages
      const errorPatterns = [
        /You cannot build/i,
        /Missing materials/i,
        /Cannot build/i,
        /Error.*build/i,
        /unable.*build/i
      ];
      
      const messageText = typeof data.message === 'string' ? data.message : 
                         (data.message.textContent || data.message.innerText || 
                          (data.message.nodeType === 1 ? data.message.textContent : String(data.message)));
      
      for (const pattern of errorPatterns) {
        if (pattern.test(messageText)) {
          // Build failed - cancel preview mode
          console.log('[BuildPreview] Build failed, canceling preview:', messageText);
          window.buildPreviewMode = false;
          window.buildPreviewType = null;
          window.buildPreviewData = null;
          window.buildPreviewValidationCache = null;
          window.buildPreviewLastTile = null;
          
          // Also update config if available
          if (this.config && this.config.buildPreviewMode) {
            this.config.buildPreviewMode.value = false;
            if (this.config.buildPreviewType) this.config.buildPreviewType.value = null;
            if (this.config.buildPreviewData) this.config.buildPreviewData.value = null;
          }
          break;
        }
      }
    }
    
    if(typeof chatMessages !== 'undefined') {
      chatMessages.innerHTML += '<div>' + data.message + '</div>';
      // Force scroll to absolute bottom
      setTimeout(function(){
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 0);
      if(window.chatManagerInstance) {
        window.chatManagerInstance.resetHideTimer(); // Show chat and restart hide timer
      } else if(typeof resetChatHideTimer !== 'undefined') {
        resetChatHideTimer(); // Fallback to global function if ChatManager not initialized
      }
    }
  },

  handleNpcSpeaking: function(data) {
    // Handle speech bubble for NPC
    var npc = Player.list[data.id];
    if(npc){
      if(data.show){
        npc.speechBubble = true;
        npc.speechBubbleTime = Date.now();
      } else {
        npc.speechBubble = false;
      }
    }
  },

  handleSpectatorChatMessage: function(data) {
    // Display spectator chat with distinct styling
    if(typeof chatMessages !== 'undefined') {
      chatMessages.innerHTML += '<div style="color: #4CAF50;">' + data.message + '</div>';
      setTimeout(function(){
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 0);
      if(window.chatManagerInstance) {
        window.chatManagerInstance.resetHideTimer();
      } else if(typeof resetChatHideTimer !== 'undefined') {
        resetChatHideTimer(); // Fallback to global function if ChatManager not initialized
      }
    }
  },

  handleSpectatorEvent: function(data) {
    // Process event for intelligent camera director
    if(window.spectatorDirector){
      window.spectatorDirector.processEvent(data.event);
    }
  },

  handleWorldMapData: function(data) {
    // Show worldmap popup and render the world map
    if(typeof worldmapPopup !== 'undefined' && worldmapPopup){
      worldmapPopup.style.display = 'block';
    }
    if(typeof renderWorldMap !== 'undefined') {
      renderWorldMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize, data.features);
    }
  },

  handleBattlegroundMapData: function(data) {
    // Show worldmap popup and render the battleground map
    if(typeof worldmapPopup !== 'undefined' && worldmapPopup){
      worldmapPopup.style.display = 'block';
    }
    
    // Use appropriate renderer based on map type
    if (data.mapType === 'caves') {
      // Use cave map renderer
      if(typeof renderCaveMap !== 'undefined') {
        renderCaveMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize, null);
      }
    } else if (data.mapType === 'dungeons') {
      // Use dungeon renderer (similar to caves but warmer colors)
      // For now, use cave renderer - could be enhanced later
      if(typeof renderCaveMap !== 'undefined') {
        renderCaveMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize, null);
      }
    } else {
      // Use world map renderer for regular maps
      if(typeof renderWorldMap !== 'undefined') {
        renderWorldMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize, null);
      }
    }
  },

  handleCaveMapData: function(data) {
    // Show cavemap popup and render the cave map
    if(typeof cavemapPopup !== 'undefined' && cavemapPopup){
      cavemapPopup.style.display = 'block';
    }
    if(typeof renderCaveMap !== 'undefined') {
      renderCaveMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize, data.blockingItems);
    }
  },

  handleBuildMenuData: function(data) {
    console.log('[BUILD MENU] Received buildMenuData:', {
      buildingsCount: data.buildings ? data.buildings.length : 0,
      playerWood: data.playerWood,
      playerStone: data.playerStone,
      buildings: data.buildings
    });
    
    // Show build menu and render building tiles
    if(typeof buildMenuPopup !== 'undefined' && buildMenuPopup){
      buildMenuPopup.style.display = 'block';
    }
    if(typeof renderBuildMenu !== 'undefined') {
      renderBuildMenu(data.buildings, data.playerWood, data.playerStone);
    }
  },

  handleResourceScoreboard: function(data) {
    // Update scoreboard UI with faction resource data
    console.log('📊 Scoreboard data received, factions:', Object.keys(data.data).length);
    if(typeof updateScoreboardUI !== 'undefined') {
      updateScoreboardUI(data.data);
    }
  },

  handleBattlegroundsLeaderboard: function(data) {
    // Update Battlegrounds leaderboard UI
    if(typeof window !== 'undefined' && window.scoreboardUIInstance) {
      window.scoreboardUIInstance.updateBattlegroundsLeaderboard(data.data || [], data.sortBy || 'wins');
    } else if(typeof updateBattlegroundsLeaderboard !== 'undefined') {
      updateBattlegroundsLeaderboard(data.data || [], data.sortBy || 'wins');
    }
  },

  handleBuildPreviewData: function(data) {
    // Preview data received - preview is now active and will follow cursor
    if(typeof window !== 'undefined') {
      window.buildPreviewData = data;
    }
  },

  handleBuildValidationData: function(data) {
    // Validation data received from server - cache it for renderBuildingPreview
    if(typeof window !== 'undefined') {
      // Store in validation cache
      window.buildPreviewValidationCache = data;
      // Also update buildPreviewData for backward compatibility
      window.buildPreviewData = data;
    }
  },

  handleGearUpdate: function(data) {
    // Update client-side gear, inventory, and class data
    if(typeof selfId !== 'undefined' && Player.list[selfId]){
      var player = Player.list[selfId];
      
      if(data.gear){
        player.gear = data.gear;
      }
      if(data.inventory){
        player.inventory = data.inventory;
      }
      // Update sprite when class changes OR when gear changes (gear affects appearance)
      // Always recalculate sprite if class is provided to ensure visual updates
      if(data.class){
        player.class = data.class;
        // Always recalculate sprite when gear/class updates using single assignment function
        // This ensures sprite reflects current gear/class state with proper validation
        if (typeof window !== 'undefined' && typeof window.assignSpriteToEntity === 'function') {
          const tileSize = typeof window.tileSize !== 'undefined' ? window.tileSize : 64;
          assignSpriteToEntity(player, data.class, player.ghost, tileSize);
        } else {
          console.error('assignSpriteToEntity not available for gear update');
        }
      }
      // Refresh both displays when gear changes
      if(typeof updateInventoryDisplay !== 'undefined') {
        updateInventoryDisplay();
      }
      // Always update character display when gear changes (even if popup not open)
      // This ensures the sprite canvas is updated immediately - player.sprite is already updated above
      if(typeof updateCharacterDisplay !== 'undefined') {
        updateCharacterDisplay(true); // Force full update including sprite
      }
    }
  },

  handleOpenMarket: function(data) {
    // Open market UI with orderbook data
    if(typeof window !== 'undefined') {
      window.currentMarketData = data;
    }
    if(typeof marketPopup !== 'undefined' && marketPopup){
      marketPopup.style.display = 'block';
      if(typeof updateMarketDisplay !== 'undefined') {
        updateMarketDisplay();
      }
    }
  },

  handleOpenDock: function(data) {
    // Open dock UI with ship data
    if(typeof window !== 'undefined') {
      window.currentDockData = data;
    }
    if(typeof dockPopup !== 'undefined' && dockPopup){
      dockPopup.style.display = 'block';
      if(typeof updateDockDisplay !== 'undefined') {
        updateDockDisplay();
      }
    }
  },

  handleOpenDeposit: function(data) {
    // Open deposit UI with building and resource data
    if(typeof window !== 'undefined') {
      window.currentDepositData = data;
    }
    if(typeof depositPopup !== 'undefined' && depositPopup){
      if(typeof updateDepositDisplay !== 'undefined') {
        updateDepositDisplay();
      }
      depositPopup.style.display = 'block';
    }
  },

  handleOpenChest: function(data) {
    // Update player entity inventory immediately (not throttled like update packets)
    if(typeof window !== 'undefined' && window.selfId && typeof Player !== 'undefined' && Player.list && Player.list[window.selfId]) {
      var player = Player.list[window.selfId];
      if(data.playerInventory) {
        // Update the actual player entity inventory
        player.inventory = data.playerInventory;
      }
    }
    
    // Open chest inventory window
    if(typeof openChestWindow !== 'undefined') {
      openChestWindow(data.chestId, data.chestType, data.inventory, data.playerInventory);
    }
    // Reset transfer flag when inventory is updated
    if(typeof window !== 'undefined') {
      window.chestTransferInProgress = false;
    }
  },

  handleOpenHouseCreation: function(data) {
    // Open house creation UI with available flags
    if(typeof window !== 'undefined' && window.HouseCreationUI) {
      window.HouseCreationUI.openHouseCreation(data);
    } else {
      console.error('HouseCreationUI not available');
    }
  },

  handleOpenBattlegroundsLobby: function(data) {
    // Open Battlegrounds lobby UI
    if(typeof window !== 'undefined' && window.battlegroundsLobbyUI) {
      // Set socket reference
      if(typeof socket !== 'undefined') {
        window.battlegroundsLobbyUI.setSocket(socket);
      } else if(typeof window !== 'undefined' && window.socket) {
        window.battlegroundsLobbyUI.setSocket(window.socket);
      }
      
      if(data.lobbyState) {
        window.battlegroundsLobbyUI.show(data.lobbyState);
      }
    }
  },

  handlePokerInvitation: function(data) {
    // Show poker invitation popup
    let popup = document.getElementById('poker-invitation-popup');
    if (!popup) {
      // Create popup if it doesn't exist
      popup = document.createElement('div');
      popup.id = 'poker-invitation-popup';
      popup.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, 0.9); padding: 30px; border-radius: 10px; z-index: 10000; border: 2px solid rgba(255, 255, 255, 0.3); min-width: 300px; text-align: center; display: none;';
      popup.innerHTML = `
        <h3 style="color: white; margin-top: 0;">Poker Invitation</h3>
        <p id="poker-invitation-text" style="color: white; margin: 20px 0;"></p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="poker-accept-btn" style="background-color: rgba(0, 200, 0, 0.7); color: white; border: 1px solid rgba(255, 255, 255, 0.3); padding: 10px 20px; font-size: 14px; cursor: pointer; border-radius: 5px;">Accept</button>
          <button id="poker-decline-btn" style="background-color: rgba(200, 0, 0, 0.7); color: white; border: 1px solid rgba(255, 255, 255, 0.3); padding: 10px 20px; font-size: 14px; cursor: pointer; border-radius: 5px;">Decline</button>
        </div>
      `;
      document.body.appendChild(popup);
    }
    
    const textElement = document.getElementById('poker-invitation-text');
    const acceptBtn = document.getElementById('poker-accept-btn');
    const declineBtn = document.getElementById('poker-decline-btn');
    
    if (textElement) {
      textElement.textContent = data.inviterName + ' has invited you to play poker. Accept?';
    }
    
    // Get socket
    const currentSocket = (typeof socket !== 'undefined') ? socket : (typeof window !== 'undefined' && window.socket ? window.socket : null);
    
    // Remove old event listeners by cloning buttons
    const newAcceptBtn = acceptBtn.cloneNode(true);
    const newDeclineBtn = declineBtn.cloneNode(true);
    acceptBtn.parentNode.replaceChild(newAcceptBtn, acceptBtn);
    declineBtn.parentNode.replaceChild(newDeclineBtn, declineBtn);
    
    // Add event listeners
    newAcceptBtn.onclick = function() {
      if (currentSocket) {
        currentSocket.send(JSON.stringify({
          msg: 'pokerAcceptInvitation',
          inviterId: data.inviterId,
          sessionId: data.sessionId
        }));
      }
      popup.style.display = 'none';
    };
    
    newDeclineBtn.onclick = function() {
      if (currentSocket) {
        currentSocket.send(JSON.stringify({
          msg: 'pokerDeclineInvitation',
          inviterId: data.inviterId,
          sessionId: data.sessionId
        }));
      }
      popup.style.display = 'none';
    };
    
    popup.style.display = 'block';
  },

  handleDisembarkShip: function(data) {
    // Player is disembarking - switch control back to player character
    if(data.newSelfId){
      if(typeof selfId !== 'undefined') {
        // Update selfId in both global and local scope
        if (typeof window !== 'undefined') {
          window.selfId = data.newSelfId;
        }
        if (typeof selfId !== 'undefined') {
          selfId = data.newSelfId;
        }
      }
      
      // CRITICAL: Clear isBoarded flag immediately
      var player = Player.list[selfId];
      if(player){
        player.isBoarded = false;
        player.boardedShip = null;
      }
      
      // Force audio update (using AudioManager if available, fallback to legacy)
      if(typeof audioManager !== 'undefined' && audioManager.forceUpdate){
        audioManager.forceUpdate();
      } else {
        // Legacy fallback
        if(player){
          // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
          var building = (player.z == 1 || player.z == 2 || player.z == -2) 
            ? getBuilding(player.x, player.y, true) 
            : getBuilding(player.x, player.y);
          if(typeof getBgm !== 'undefined'){
            getBgm(player.x, player.y, player.z, building);
          }
          if(typeof soundscape !== 'undefined'){
            soundscape(player.x, player.y, player.z, building);
          }
        }
      }
    }
  },

  handleFishCatch: function(data) {
    // Fish catch notification - show emoji next to player
    if(typeof selfId !== 'undefined') {
      var player = Player.list[selfId];
      if(player){
        player.catchEmoji = data.emoji;
        player.catchEmojiTime = Date.now();
        
        // Auto-clear after 1 second
        setTimeout(function() {
          if(player && player.catchEmoji === data.emoji) {
            player.catchEmoji = null;
          }
        }, 1000);
      }
    }
  },

  handleBoardShip: function(data) {
    // Player is boarding a ship as navigator or passenger
    if(data.isNavigator){
      // Store original player data before switching control to ship
      if(typeof selfId !== 'undefined') {
        var player = Player.list[selfId];
        if(player){
          if(typeof window !== 'undefined') {
            window.originalPlayerId = selfId; // Keep reference to player character for UI
            window.originalPlayerData = {
              id: selfId,
              name: player.name,
              class: player.class
            };
          }
          
          // Hide the player character sprite (they're on the ship now)
          player.isBoarded = true;
          player.boardedShip = data.shipId;
        }
        
        // Switch selfId to ship for control
        // Update selfId in both global and local scope
        if (typeof window !== 'undefined') {
          window.selfId = data.shipId;
        }
        if (typeof selfId !== 'undefined') {
          selfId = data.shipId;
        }
        
        // Switch BGM to ship playlist and add sea ambience
        if(typeof bgmPlayer !== 'undefined' && typeof ship_bgm !== 'undefined'){
          bgmPlayer(ship_bgm);
        }
        if(typeof ambPlayer !== 'undefined'){
          ambPlayer('/client/audio/amb/sea.mp3');
        }
      }
    } else {
      // Just a passenger - mark as boarded but don't switch control
      if(typeof selfId !== 'undefined') {
        var player = Player.list[selfId];
        if(player){
          player.isBoarded = true;
          player.boardedShip = data.shipId;
        }
        
        // Passengers also get ship BGM and sea ambience
        if(typeof bgmPlayer !== 'undefined' && typeof ship_bgm !== 'undefined'){
          bgmPlayer(ship_bgm);
        }
        if(typeof ambPlayer !== 'undefined'){
          ambPlayer('/client/audio/amb/sea.mp3');
        }
      }
    }
  },

  handleTileEdit: function(data) {
    const targetWorld = window.inBattleground ? window.battlegroundWorld : world;
    if(targetWorld && targetWorld[data.l] && targetWorld[data.l][data.r]) {
      targetWorld[data.l][data.r][data.c] = data.tile;
    }
    if (typeof window !== 'undefined' && window.debugTileEdits && data.ts) {
      const latencyMs = Date.now() - data.ts;
      console.log('[TileEdit] latency', latencyMs, 'ms', {
        l: data.l,
        c: data.c,
        r: data.r,
        inBattleground: !!window.inBattleground
      });
    }
  },

  handleLayerEdit: function(data) {
    world[data.l] = data.layer;
  },

  handleMapEdit: function(data) {
    world = data.world;
  },

  handleBuildingPreview: function(data) {
    // Handle building preview
    console.log('Client received buildingPreview message:', data);
    if(window.buildingPreviewRenderer){
      window.buildingPreviewRenderer.showPreview(data);
    } else {
      console.log('BuildingPreviewRenderer not found!');
    }
  },

  handleInit: function(data) {
    // Handle battleground context switching
    
    if(data.inBattleground && data.battlegroundMatchId) {
      if(typeof window !== 'undefined') {
        // CRITICAL: Check for battleground world data FIRST before setting inBattleground flag
        // This ensures we don't set inBattleground=true without a valid world context
        let bgWorld = null;
        if(window.battlegroundWorlds && window.battlegroundWorlds[data.battlegroundMatchId]) {
          bgWorld = window.battlegroundWorlds[data.battlegroundMatchId];
        } else if(data.world && data.tileSize && data.mapSize && Array.isArray(data.world)) {
          // World data sent directly in init message (fallback)
          // CRITICAL: Only use data.world if it's a valid array
          bgWorld = {
            world: data.world,
            tileSize: data.tileSize,
            mapSize: data.mapSize,
            startingZ: data.startingZ || 0
          };
          // Store it for future reference
          if(!window.battlegroundWorlds) {
            window.battlegroundWorlds = {};
          }
          window.battlegroundWorlds[data.battlegroundMatchId] = bgWorld;
        }
        
        // Only set battleground context if we have valid world data
        if(bgWorld && bgWorld.world && Array.isArray(bgWorld.world)) {
          // CRITICAL: Set battleground context variables
          // GameLoopManager will use battlegroundWorld when inBattleground is true
          window.battlegroundWorld = bgWorld.world;
          window.battlegroundTileSize = bgWorld.tileSize;
          window.battlegroundMapSize = bgWorld.mapSize;
          window.currentBattlegroundMatchId = data.battlegroundMatchId;
          window.inBattleground = true; // Set flag ONLY after world data is ready
          
          // DO NOT update global world/tileSize/mapSize variables here
          // GameLoopManager will read from window.battlegroundWorld when rendering
          
          console.log('[CLIENT] handleInit: Switched to battleground world:', data.battlegroundMatchId);
          console.log('[CLIENT] handleInit: window.inBattleground =', window.inBattleground);
          console.log('[CLIENT] handleInit: window.battlegroundMapSize =', window.battlegroundMapSize);
          console.log('[CLIENT] handleInit: window.battlegroundWorld type =', typeof window.battlegroundWorld, Array.isArray(window.battlegroundWorld) ? `${window.battlegroundWorld.length} layers` : 'not array');
          
          // Debug: Check if world data is valid
          if (Array.isArray(bgWorld.world) && bgWorld.world.length > 0) {
            console.log('[CLIENT] handleInit: Battleground world layer 0 size:', Array.isArray(bgWorld.world[0]) ? `${bgWorld.world[0].length}x${bgWorld.world[0][0] ? bgWorld.world[0][0].length : 0}` : 'invalid');
          } else {
            console.error('[CLIENT] handleInit: Battleground world data is invalid:', bgWorld.world);
          }
        } else {
          // CRITICAL: Don't set inBattleground=true if world data is not available
          // This prevents GameLoopManager from trying to use non-existent battleground world
          console.error('[CLIENT] handleInit: Cannot switch to battleground - world data not available for match:', data.battlegroundMatchId);
          console.error('[CLIENT] handleInit: bgWorld =', bgWorld, 'window.battlegroundWorlds =', window.battlegroundWorlds);
          console.error('[CLIENT] handleInit: data.world =', !!data.world, 'data.mapSize =', data.mapSize, 'data.tileSize =', data.tileSize);
          console.error('[CLIENT] handleInit: data.world isArray =', Array.isArray(data.world));
          
          // Clear any partial battleground state
          if(typeof window !== 'undefined') {
            window.inBattleground = false;
            window.battlegroundWorld = null;
            window.currentBattlegroundMatchId = null;
          }
        }
      }
    } else if(data.inBattleground === false) {
      // Explicitly leaving battleground - clear battleground context and switch back to main world
      if(typeof window !== 'undefined') {
        window.currentBattlegroundMatchId = null;
        window.inBattleground = false;
        window.battlegroundWorld = null;
        
        // Switch back to main world if world data is provided in init message
        if(data.world && data.tileSize && data.mapSize) {
          // Update world variables for rendering (switch back to main world)
          if(typeof world !== 'undefined') {
            world = data.world;
          }
          if(typeof tileSize !== 'undefined') {
            tileSize = data.tileSize;
          }
          if(typeof mapSize !== 'undefined') {
            mapSize = data.mapSize;
          }
          
          // Also update window variables (for GameLoopManager and other systems)
          window.world = data.world;
          window.tileSize = data.tileSize;
          window.mapSize = data.mapSize;
          
          console.log('Switched back to main world, mapSize:', data.mapSize);
        }
      }
    }
    
    // Only update selfId if this is an initial init message (has selfId)
    if(data.selfId !== undefined) {
      if(typeof selfId !== 'undefined') {
        // Update selfId in both global and local scope
        if (typeof window !== 'undefined') {
          window.selfId = data.selfId;
        }
        if (typeof selfId !== 'undefined') {
          selfId = data.selfId;
        }
      }
      
      // Start AudioManager for this player
      if(typeof audioManager !== 'undefined' && audioManager.start){
        audioManager.start();
        console.log('AudioManager started for player');
      }
    }
    
    // Only clear entities if this is an initial init message (has selfId)
    // Don't clear entities for battleground spawns (preserve existing entities)
    // Don't clear entities when switching back from battleground (preserve buildings/items)
    if(data.selfId !== undefined && !data.inBattleground) {
      // Only clear if we're truly initializing (first time connecting), not restoring from battleground
      // Check if we were previously in a battleground to avoid clearing entities on restore
      const wasInBattleground = typeof window !== 'undefined' && window.currentBattlegroundMatchId;
      if (!wasInBattleground) {
        Player.list = {};
        Arrow.list = {};
        Item.list = {};
        Light.list = {};
        Building.list = {};
      } else {
        // We're restoring from battleground - don't clear entities, just update player position
        console.log('Restoring from battleground - preserving entities (buildings, items, etc.)');
      }
    }
    
    // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
    var initLoadedCount = 0;
    var initErrorCount = 0;
    
    // Only process pack if it exists
    if(!data.pack) {
      console.warn('Init message missing pack data');
      return;
    }
    
    for(i in data.pack.player){
      try {
        var playerData = data.pack.player[i];
        
        // CRITICAL: Don't overwrite existing player with null class
        // If player already exists and has a valid class, preserve it
        var existingPlayer = Player.list[playerData.id];
        if (existingPlayer && existingPlayer.class && (!playerData.class || playerData.class === null)) {
          // Preserve existing player - don't recreate with null class
          continue;
        }
        
        // CRITICAL: Fallback check - if type is missing but class indicates fauna, set type to 'fauna'
        const faunaClasses = ['Deer', 'Boar', 'Wolf', 'Falcon', 'Sheep'];
        if (faunaClasses.includes(playerData.class) && playerData.type !== 'fauna') {
          playerData.type = 'fauna';
        }
        
        // CRITICAL: Handle missing class property
        // Fauna entities MUST have a class - don't default to SerfM
        if (!playerData.class || playerData.class === null) {
          // Check if type indicates fauna (fallback if class is missing)
          if (playerData.type === 'fauna' || faunaClasses.includes(playerData.class)) {
            // Fauna entities require a valid class - skip creation if missing
            console.error('Init: Fauna entity missing class property:', playerData.id, playerData.type);
            initErrorCount++;
            continue;
          } else {
            // For non-fauna entities (players/npcs), default to SerfM if missing
            playerData.class = existingPlayer ? existingPlayer.class : 'SerfM';
          }
        }
        
        new Player(playerData);
        
        // Sprite is assigned in PlayerEntity constructor via assignSpriteToEntity()
        // If sprite assignment failed there, entity is marked _invalidSprite and won't render
        // No need to reassign here - PlayerEntity constructor handles it
        var p = Player.list[playerData.id];
        if(p) {
          initLoadedCount++;
        } else {
          console.error('Init: Failed to create player entity:', playerData.id, playerData.class);
          initErrorCount++;
        }
        
        // Register ships for wake tracking
        if(typeof shipWakes !== 'undefined' && shipWakes.isShipClass && shipWakes.isShipClass(playerData.class)) {
          shipWakes.addShip(playerData.id);
        }
      } catch(e) {
        console.error('Init: Error loading entity:', e);
        initErrorCount++;
      }
    }
    for(i in data.pack.arrow){
      new Arrow(data.pack.arrow[i]);
    }
    for(i in data.pack.item){
      new Item(data.pack.item[i]);
    }
    for(i in data.pack.light){
      new Light(data.pack.light[i]);
    }
    for(i in data.pack.building){
      new Building(data.pack.building[i]);
    }
    for(i in data.pack.camera){
      new Camera(data.pack.camera[i]);
    }
    
    // If spectate mode is active, start camera after entities are loaded
    if(typeof spectateCameraSystem !== 'undefined' && spectateCameraSystem && spectateCameraSystem.isActive) {
      setTimeout(function(){
        if(spectateCameraSystem && spectateCameraSystem.start) {
          spectateCameraSystem.start();
        }
        
        // Initialize SpectatorDirector for intelligent camera control
        if(typeof SpectatorDirector !== 'undefined'){
          window.spectatorDirector = new SpectatorDirector();
          if(window.spectatorDirector && window.spectatorDirector.start) {
            window.spectatorDirector.start();
          }
          console.log('SpectatorDirector initialized');
        }
        
        // Initialize ambient sound for spectators based on camera position
        // Spectators don't receive bgm messages from server, so we trigger it manually
        // Only initialize ambient sound (not BGM) for spectators
        if(typeof AudioSystem !== 'undefined' && AudioSystem.soundscape && spectateCameraSystem) {
          const cameraPos = spectateCameraSystem.getCameraPosition();
          if(cameraPos) {
            // Trigger ambient sound initialization based on camera position
            // Use z=0 (overworld) as default if camera hasn't moved yet
            // Pass empty building object since we don't have building info for camera position
            AudioSystem.soundscape(cameraPos.x || 0, cameraPos.y || 0, cameraPos.z || 0, {});
          } else {
            // Fallback: initialize with default overworld position
            AudioSystem.soundscape(0, 0, 0, {});
          }
        }
      }, 500);
    }
  },

  handleUpdate: function(data) {
    // Track update packets for performance HUD
    if (window.performanceHUD && window.performanceHUD.enabled) {
      window.performanceHUD.recordUpdatePacket();
    }
    
    // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
    // Optimize: Cache array length to avoid repeated property access
    var playerPackLength = data.pack.player ? data.pack.player.length : 0;
    // Ensure Player.list exists before accessing it
    if(!Player.list) Player.list = {};
    for(var i = 0 ; i < playerPackLength; i++){
      var pack = data.pack.player[i];
      if(!pack || !pack.id) continue; // Skip invalid entries
      
      var p = Player.list[pack.id];
      if (!p) {
        const created = createPlayerFromUpdatePack(pack);
        if (created) {
          p = Player.list[pack.id];
          warnMissingEntityUpdate('player', pack.id);
        }
      }
      
      if(p){
        // Track last non-visual update time for throttling
        if (!p._lastNonVisualUpdate) {
          p._lastNonVisualUpdate = 0;
        }
        
        // OPTIMIZATION: Skip position update if position hasn't changed (common for stationary entities)
        // This reduces unnecessary object mutations and improves cache coherence
        // EXCEPTION: Always update ship positions immediately (don't skip) - prevents visual artifacts
        var posChanged = false;
        var isShip = p.type === 'ship';
        if(pack.x != undefined && p.x !== pack.x) { 
          p.x = pack.x; 
          posChanged = true; 
        }
        if(pack.y != undefined && p.y !== pack.y) { 
          p.y = pack.y; 
          posChanged = true; 
        }
        if(pack.z != undefined && p.z !== pack.z) { 
          p.z = pack.z; 
          posChanged = true; 
        }
        if(pack.inBattleground != undefined) p.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined) p.battlegroundMatchId = pack.battlegroundMatchId;
        if(pack.facing != undefined) p.facing = pack.facing;
        if(pack.angle != undefined) p.angle = pack.angle;
        
        // Update movement state (visual)
        if(pack.pressingUp != undefined) p.pressingUp = pack.pressingUp;
        if(pack.pressingDown != undefined) p.pressingDown = pack.pressingDown;
        if(pack.pressingLeft != undefined) p.pressingLeft = pack.pressingLeft;
        if(pack.pressingRight != undefined) p.pressingRight = pack.pressingRight;
        if(pack.pressingAttack != undefined) p.pressingAttack = pack.pressingAttack;
        
        // Update activity state (visual)
        if(pack.working != undefined) p.working = pack.working;
        
        // Update player.target and set selectedTarget for HUD (for player's own entity)
        if(typeof selfId !== 'undefined' && p.id === selfId && pack.target !== undefined) {
          p.target = pack.target;
          // Set selectedTarget when player.target is set (for attack intent or combat)
          if(pack.target) {
            const targetEntity = Player.list ? Player.list[pack.target] : null;
            const contextHelper = (typeof window !== 'undefined' && window.contextHelper) ? window.contextHelper : null;
            const currentContext = contextHelper
              ? contextHelper.getCurrentContext({ selfId, PlayerList: Player.list })
              : null;
            if (!contextHelper || !targetEntity || contextHelper.isEntityInContext(targetEntity, currentContext)) {
              if(typeof selectedTarget !== 'undefined') {
                selectedTarget = pack.target;
                // Sync to window for other modules
                if(typeof window !== 'undefined') {
                  window.selectedTarget = pack.target;
                }
              }
            }
          } else {
            // Clear selectedTarget when player.target is cleared
            if(typeof selectedTarget !== 'undefined') {
              selectedTarget = null;
              if(typeof window !== 'undefined') {
                window.selectedTarget = null;
              }
            }
          }
        }
        
        if(pack.combat != undefined) {
          // Check if player was previously in combat
          var wasInCombat = p.combat && p.combat.target;
          var isNowInCombat = pack.combat && pack.combat.target;
          
          p.combat = pack.combat;
          
          // Auto-select enemies that aggro the player
          if(typeof selfId !== 'undefined' && p.id === selfId && isNowInCombat){
            var targetId = pack.combat.target;
            
            // Check if this is a new combat engagement (wasn't in combat before)
            var isNewCombat = !wasInCombat;
            
            if(isNewCombat){
              // Player just entered combat - always auto-select the attacker
              if(typeof selectedTarget !== 'undefined') {
                selectedTarget = targetId;
                // Sync to window for other modules
                if(typeof window !== 'undefined') {
                  window.selectedTarget = targetId;
                }
              }
            } else if(typeof selectedTarget !== 'undefined' && !selectedTarget){
              // Player is already in combat but has no target selected - auto-select the attacker
              selectedTarget = targetId;
              // Sync to window for other modules
              if(typeof window !== 'undefined') {
                window.selectedTarget = targetId;
              }
            }
            // If player is already in combat AND has a target selected, don't override their selection
          }
        }
        if(pack.fleeing != undefined) p.fleeing = pack.fleeing;
        if(pack.chopping != undefined) p.chopping = pack.chopping;
        if(pack.mining != undefined) p.mining = pack.mining;
        if(pack.farming != undefined) p.farming = pack.farming;
        if(pack.building != undefined) p.building = pack.building;
        if(pack.fishing != undefined) p.fishing = pack.fishing;
        
        // Update visibility state (visual)
        if(pack.stealthed != undefined) p.stealthed = pack.stealthed;
        if(pack.revealed != undefined) p.revealed = pack.revealed;
        if(pack.innaWoods != undefined) p.innaWoods = pack.innaWoods;
        if(pack.onMtn != undefined) p.onMtn = pack.onMtn;
        
        // Track class/ghost changes for sprite optimization BEFORE updating them
        var classChanged = false;
        var ghostChanged = false;
        var oldClass = p.class;
        var oldGhost = p.ghost;
        
        // Update class and track for ship wake system
        // CRITICAL: Don't overwrite valid class with null/undefined from server
        if(pack.class != undefined && pack.class != null && p.class !== pack.class) {
          p.class = pack.class;
          classChanged = true;
          
          // Track ships for wake system optimization
          if(typeof shipWakes !== 'undefined' && shipWakes.isShipClass) {
            var wasShip = shipWakes.isShipClass(oldClass);
            var isShip = shipWakes.isShipClass(p.class);
            if(isShip && !wasShip) {
              shipWakes.addShip(p.id);
            } else if(!isShip && wasShip) {
              shipWakes.removeShip(p.id);
            }
          }
        }
        
        // Update ghost state and track changes
        if(pack.ghost != undefined && p.ghost !== pack.ghost) {
          p.ghost = pack.ghost;
          ghostChanged = true;
        }
        
        // Update boarding state (visual)
        if(pack.isBoarded != undefined) p.isBoarded = pack.isBoarded;
        if(pack.boardedShip != undefined) p.boardedShip = pack.boardedShip;
        
        // Throttle non-visual updates to 500ms (2 Hz) instead of every packet (25 Hz)
        // EXCEPTION: Always update inventory immediately (important for chest transfers and other real-time operations)
        if(pack.inventory != undefined) {
          p.inventory = pack.inventory;
        }
        
        var now = Date.now();
        if (now - p._lastNonVisualUpdate > 500) {
          if(pack.name != undefined) {
            p.name = pack.name;
          }
          if(pack.house != undefined) p.house = pack.house;
          if(pack.kingdom != undefined) p.kingdom = pack.kingdom;
          if(pack.rank != undefined) p.rank = pack.rank;
          if(pack.friends != undefined) p.friends = pack.friends;
          if(pack.enemies != undefined) p.enemies = pack.enemies;
          if(pack.gear != undefined) p.gear = pack.gear;
          if(pack.kills != undefined) p.kills = pack.kills;
          if(pack.skulls != undefined) p.skulls = pack.skulls;
          
          p._lastNonVisualUpdate = now;
        } else if(pack.name != undefined && p.type === 'ship') {
          // Always update ship names immediately (don't throttle) - critical for anchor emoji display
          p.name = pack.name;
        }
        
        // Always update health/spirit (important for gameplay)
        if(pack.hp != undefined) p.hp = pack.hp;
        if(pack.hpMax != undefined) p.hpMax = pack.hpMax;
        if(pack.spirit != undefined) p.spirit = pack.spirit;
        if(pack.spiritMax != undefined) p.spiritMax = pack.spiritMax;
        if(pack.breath != undefined) p.breath = pack.breath;
        if(pack.breathMax != undefined) p.breathMax = pack.breathMax;
        
        // Update sprite size and scale (visual)
        if(pack.spriteSize != undefined) p.spriteSize = pack.spriteSize;
        if(pack.spriteScale != undefined) p.spriteScale = pack.spriteScale;
        
        // Update ship-specific properties
        if(pack.sailPoints != undefined) p.sailPoints = pack.sailPoints;
        if(pack.shipMode != undefined) p.shipMode = pack.shipMode;
        // Always update shipType immediately (don't throttle) - critical for audio context
        if(pack.shipType != undefined) {
          p.shipType = pack.shipType;
        }
        if(pack.isPlayerControlled != undefined) p.isPlayerControlled = pack.isPlayerControlled;
        
        // Handle action updates
        if(pack.action !== undefined) {
          p.action = pack.action;
        }

        // Sprite management - use single assignment function
        // Only update sprite if class or ghost state changed
        if (classChanged || ghostChanged) {
          // Class or ghost changed - update sprite using single assignment function
          if (typeof window !== 'undefined' && typeof window.assignSpriteToEntity === 'function') {
            const tileSize = typeof window.tileSize !== 'undefined' ? window.tileSize : 64;
            assignSpriteToEntity(p, p.class, p.ghost, tileSize);
          }
        } else if (typeof selfId !== 'undefined' && p.id === selfId && !p.sprite) {
          // Player sprite is missing but class/ghost didn't change - retry using single assignment function
          if (typeof window !== 'undefined' && typeof window.assignSpriteToEntity === 'function') {
            const tileSize = typeof window.tileSize !== 'undefined' ? window.tileSize : 64;
            assignSpriteToEntity(p, p.class, p.ghost, tileSize);
          }
        }
        // If sprite exists and class/ghost didn't change - never touch it (preserve existing sprite)
      }
    }
    // Ensure Arrow.list exists before accessing it
    if(!Arrow.list) Arrow.list = {};
    for(var i = 0 ; i < data.pack.arrow.length; i++){
      var pack = data.pack.arrow[i];
      var b = getOrCreateEntity(Arrow.list, pack, Arrow, 'arrow');
      if(b){
        // Store previous position for interpolation before updating
        if(pack.x !== undefined || pack.y !== undefined) {
          // Only update interpolation state if position changed
          if(pack.x !== undefined && b.targetX !== pack.x) {
            b.prevX = b.renderX || b.targetX || b.x;
            b.targetX = pack.x;
          }
          if(pack.y !== undefined && b.targetY !== pack.y) {
            b.prevY = b.renderY || b.targetY || b.y;
            b.targetY = pack.y;
          }
          b.lastUpdateTime = Date.now();
        }
        
        // Update actual position (for collision checks, etc.)
        if(pack.angle != undefined)
          b.angle = pack.angle;
        if(pack.x != undefined)
          b.x = pack.x;
        if(pack.y != undefined)
          b.y = pack.y;
        if(pack.z != undefined)
          b.z = pack.z;
        if(pack.innaWoods != undefined)
          b.innaWoods = pack.innaWoods;
        if(pack.inBattleground != undefined)
          b.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined)
          b.battlegroundMatchId = pack.battlegroundMatchId;
        if(pack.inBattleground != undefined)
          b.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined)
          b.battlegroundMatchId = pack.battlegroundMatchId;
      }
    }
    // Ensure Item.list exists before accessing it
    if(!Item.list) Item.list = {};
    for(var i = 0 ; i < data.pack.item.length; i++){
      var pack = data.pack.item[i];
      var itm = getOrCreateEntity(Item.list, pack, Item, 'item');
      if(itm){
        if(pack.x != undefined)
          itm.x = pack.x;
        if(pack.y != undefined)
          itm.y = pack.y;
        if(pack.z != undefined)
          itm.z = pack.z;
        if(pack.innaWoods != undefined)
          itm.innaWoods = pack.innaWoods;
        if(pack.sunk != undefined)
          itm.sunk = pack.sunk;
        if(pack.inBattleground != undefined)
          itm.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined)
          itm.battlegroundMatchId = pack.battlegroundMatchId;
      }
    }
    // Ensure Light.list exists before accessing it
    if(!Light.list) Light.list = {};
    let lightUpdateCount = 0;
    let lightUpdateZNeg = 0;
    for(var i = 0 ; i < data.pack.light.length; i++){
      var pack = data.pack.light[i];
      if (pack && typeof pack.z === 'number') {
        lightUpdateCount++;
        if (pack.z === -1) lightUpdateZNeg++;
      }
      var l = getOrCreateEntity(Light.list, pack, Light, 'light');
      if(l){
        if(pack.x != undefined)
          l.x = pack.x;
        if(pack.y != undefined)
          l.y = pack.y;
        if(pack.z != undefined)
          l.z = pack.z;
        if(pack.radius != undefined)
          l.radius = pack.radius;
        if(pack.inBattleground != undefined)
          l.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined)
          l.battlegroundMatchId = pack.battlegroundMatchId;
      }
    }
    if (lightUpdateCount > 0 && lightUpdateZNeg > 0 && typeof console !== 'undefined') {
      // Keep a minimal warning for unexpected underground light updates during login
      if (!selfId) {
        console.warn('[SocketMessageHandler] Light updates include underground lights before selfId is set.');
      }
    }
    // Ensure Item.list exists before accessing it
    if(!Item.list) Item.list = {};
    // Ensure Building.list exists before accessing it
    if(!Building.list) Building.list = {};
    for(var i = 0; i < data.pack.building.length; i++){
      var pack = data.pack.building[i];
      var b = getOrCreateEntity(Building.list, pack, Building, 'building');
      if(b){
        if(pack.hp != undefined)
          b.hp = pack.hp;
        if(pack.occ != undefined)
          b.occ = pack.occ;
        if(pack.inBattleground != undefined)
          b.inBattleground = pack.inBattleground;
        if(pack.battlegroundMatchId != undefined)
          b.battlegroundMatchId = pack.battlegroundMatchId;
      }
    }

    // Camera updates
    if(data.pack.camera){
      if(!Camera.list) Camera.list = {};
      for(var i = 0; i < data.pack.camera.length; i++){
        var pack = data.pack.camera[i];
        var c = getOrCreateEntity(Camera.list, pack, Camera, 'camera');
        if(c){
          if(pack.x != undefined) c.x = pack.x;
          if(pack.y != undefined) c.y = pack.y;
          if(pack.z != undefined) c.z = pack.z;
          if(pack.mode != undefined) c.mode = pack.mode;
          if(pack.locked != undefined) c.locked = pack.locked;
          if(pack.lockedToEntityId != undefined) c.lockedToEntityId = pack.lockedToEntityId;
          if(pack.ownerPlayerId != undefined) c.ownerPlayerId = pack.ownerPlayerId;
          if(pack.context != undefined) c.context = pack.context;
        }
      }
    }

    // Check if we need to update music after exiting god mode
    if(typeof godModeCamera !== 'undefined' && godModeCamera.needsMusicUpdate && typeof selfId !== 'undefined' && Player.list[selfId]){
      godModeCamera.needsMusicUpdate = false;
      var p = Player.list[selfId];
      // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
      var b = (p.z == 1 || p.z == 2 || p.z == -2) 
        ? getBuilding(p.x, p.y, true) 
        : getBuilding(p.x, p.y);
      if(typeof getBgm !== 'undefined') {
        getBgm(p.x, p.y, p.z, b);
      }
    }
    
    // Weather updates (in UPDATE block, not REMOVE block!)
    if(data.pack.weather){
      for(var i = 0; i < data.pack.weather.length; i++){
        var pack = data.pack.weather[i];
        if(typeof Weather !== 'undefined' && Weather.list) {
          if(!Weather.list[pack.id]){
            Weather.list[pack.id] = {
              id: pack.id,
              x: pack.x,
              y: pack.y,
              weatherType: pack.weatherType,
              intensity: pack.intensity,
              inBattleground: pack.inBattleground,
              battlegroundMatchId: pack.battlegroundMatchId || null
            };
          } else {
            var weather = Weather.list[pack.id];
            weather.x = pack.x;
            weather.y = pack.y;
            weather.weatherType = pack.weatherType;
            weather.intensity = pack.intensity;
            if(pack.inBattleground != undefined)
              weather.inBattleground = pack.inBattleground;
            if(pack.battlegroundMatchId != undefined)
              weather.battlegroundMatchId = pack.battlegroundMatchId;
          }
        }
      }
    }
  },

  handleRemove: function(data) {
    // {player:[12323],arrow:[12323,123123]}
    // Clean up delta tracker when entities are removed
    var deltaTracker = window.entityDeltaTracker;
    
    for(var i = 0 ; i < data.pack.player.length; i++){
      var id = data.pack.player[i];
      delete Player.list[id];
      if(deltaTracker) deltaTracker.removeEntity('player', id);
    }
    for(var i = 0 ; i < data.pack.arrow.length; i++){
      delete Arrow.list[data.pack.arrow[i]];
    }
    for(var i = 0 ; i < data.pack.item.length; i++){
      var id = data.pack.item[i];
      delete Item.list[id];
      if(deltaTracker) deltaTracker.removeEntity('item', id);
    }
    for(var i = 0 ; i < data.pack.light.length; i++){
      delete Light.list[data.pack.light[i]];
    }
    for(var i = 0 ; i < data.pack.building.length; i++){
      var id = data.pack.building[i];
      delete Building.list[id];
      if(deltaTracker) deltaTracker.removeEntity('building', id);
    }
  },

  handleTempus: function(data) {
    tempus = data.tempus;
    nightfall = data.nightfall;
    
    // Update music based on god mode camera or player position
    if(typeof godModeCamera !== 'undefined' && godModeCamera.isActive){
      // In god mode - use camera position
      var z = godModeCamera.cameraZ;
      var x = godModeCamera.cameraX;
      var y = godModeCamera.cameraY;
      // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
      var b = (z == 1 || z == 2 || z == -2) ? getBuilding(x, y, true) : null;
      if(typeof getBgm !== 'undefined') {
        getBgm(x, y, z, b);
      }
    } else if(typeof selfId !== 'undefined' && Player.list[selfId]){
      // Normal mode - use player position
      var p = Player.list[selfId];
      if(p.z == 0 && (tempus == 'IV.a' || tempus == 'V.a' || tempus == 'X.a' || tempus == 'VIII.p')){
        if(typeof getBgm !== 'undefined') {
          getBgm(p.x,p.y,p.z);
        }
      } else if((p.z == 1 || p.z == 2 || p.z == -2) && (tempus == 'VIII.p' || tempus == 'IV.a')){
        // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
        var b = getBuilding(p.x, p.y, true);
        if(typeof getBgm !== 'undefined') {
          getBgm(p.x, p.y, p.z, b);
        }
      }
    }
  },

  handleGodMode: function(data) {
    // Handle god mode camera
    if(data.active){
      // Start god mode spectator camera
      if(typeof godModeCamera !== 'undefined' && godModeCamera.start) {
        godModeCamera.start(data.cameraX, data.cameraY, data.cameraZ, data.factionHQs);
      }
      
      // Update music/ambience for initial god mode position
      // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
      var b = (data.cameraZ == 1 || data.cameraZ == 2 || data.cameraZ == -2) 
        ? getBuilding(data.cameraX, data.cameraY, true) 
        : null;
      if(typeof getBgm !== 'undefined') {
        getBgm(data.cameraX, data.cameraY, data.cameraZ, b);
      }
    } else {
      // Stop god mode camera
      if(typeof godModeCamera !== 'undefined') {
        godModeCamera.stop();
        godModeCamera.needsMusicUpdate = true; // Flag for next update cycle
      }
    }
  },

  handleGhostMode: function(data) {
    // Handle ghost mode audio/visual changes
    if(data.active && typeof selfId !== 'undefined' && Player.list[selfId]){
      // Player just became ghost - play death music immediately
      if(typeof AudioCtrl !== 'undefined') {
        AudioCtrl.playlist = null; // Force change
      }
      if(typeof bgmPlayer !== 'undefined' && typeof defeat_bgm !== 'undefined') {
        bgmPlayer(defeat_bgm, false, false); // Play Defeat.mp3 once
      }
      if(typeof ambPlayer !== 'undefined' && typeof Amb !== 'undefined') {
        ambPlayer(Amb.spirits); // Play spirits ambience
      }
      
      // Pause AudioManager briefly to let manual audio play, then let it take over
      if(typeof audioManager !== 'undefined'){
        audioManager.pauseAutoUpdates(2000); // Pause for 2 seconds
        setTimeout(() => {
          if(audioManager.forceUpdate) {
            audioManager.forceUpdate(); // Then sync with AudioManager
          }
        }, 2100);
      }
    } else if(!data.active && typeof selfId !== 'undefined' && Player.list[selfId]){
      // Player respawned - force audio update via AudioManager
      if(typeof audioManager !== 'undefined' && audioManager.forceUpdate){
        audioManager.forceUpdate();
      } else {
        // Legacy fallback: immediately switch to normal music and ambience
        // Stop current music and force immediate change
        if(typeof AudioCtrl !== 'undefined') {
          AudioCtrl.bgm.pause();
          AudioCtrl.bgm.currentTime = 0;
          AudioCtrl.playlist = null; // Force playlist change
          
          // Stop current ambience and force immediate change
          AudioCtrl.amb.pause();
          AudioCtrl.amb.currentTime = 0;
          AudioCtrl.amb.src = null; // Force ambience change
        }
        
        var p = Player.list[selfId];
        // Directly determine and play normal ambience based on location
        // Improved building lookup to ensure we find the building correctly
        var isIndoor = (p.z == 1 || p.z == 2 || p.z == -2);
        var buildingId = null;
        var building = null;
        
        if (isIndoor && typeof getBuilding !== 'undefined') {
        // Use includeWallsAndTopPlot=true when indoors to handle stairs on walls
          buildingId = getBuilding(p.x, p.y, true);
          if (buildingId) {
            building = Building.list[buildingId];
          }
          
          // If building not found, try with position offsets to handle edge cases
          if (!building) {
            var offsets = [
              [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0],
              [-1, -1], [1, -1], [-1, 1], [1, 1]
            ];
            for (var i = 0; i < offsets.length && !building; i++) {
              var offsetX = p.x + (offsets[i][0] * (typeof tileSize !== 'undefined' ? tileSize : 64));
              var offsetY = p.y + (offsets[i][1] * (typeof tileSize !== 'undefined' ? tileSize : 64));
              var retryId = getBuilding(offsetX, offsetY, true);
              if (retryId && Building.list[retryId]) {
                buildingId = retryId;
                building = Building.list[retryId];
                break;
              }
            }
          }
        } else if (!isIndoor && typeof getBuilding !== 'undefined') {
          buildingId = getBuilding(p.x, p.y);
          if (buildingId) {
            building = Building.list[buildingId];
          }
        }
        
        // Check for weather effects first (storms take priority)
        if(typeof getWeatherEffects !== 'undefined') {
          var weatherEffects = getWeatherEffects(p.x, p.y, p.z);
          if(weatherEffects && weatherEffects.storm.active && weatherEffects.storm.intensity > 0.3){
            // If on a ship during storm, play seastorm ambience
            if(p.shipType || p.isBoarded){
              if(typeof ambPlayer !== 'undefined' && typeof Amb !== 'undefined') {
                ambPlayer(Amb.seastorm);
              }
            } else {
              if(typeof ambPlayer !== 'undefined' && typeof Amb !== 'undefined') {
                ambPlayer(Amb.rain);
              }
            }
            return; // Skip other ambience checks
          }
        }
      
        // Set ambient sound based on location
        if(typeof ambPlayer !== 'undefined' && typeof Amb !== 'undefined') {
          if(p.z == 0){
            if(nightfall){
              ambPlayer(Amb.forest);
            } else {
              ambPlayer(Amb.nature);
            }
          } else if(p.z == -1){
            ambPlayer(Amb.cave);
          } else if(p.z == 1 || p.z == 2){
            if(building && building.type == 'monastery'){
              ambPlayer(Amb.empty);
            } else if(typeof hasFire !== 'undefined' && hasFire(p.z, p.x, p.y)){
              if(building && building.occ < 4){
                ambPlayer(Amb.fire);
              } else if(building && building.occ < 6){
                ambPlayer(Amb.hush);
              } else {
                ambPlayer(Amb.chatter);
              }
            } else {
              ambPlayer();
            }
          } else if(p.z == -2){
            if(building && building.type == 'tavern'){
              ambPlayer(Amb.empty);
            } else {
              ambPlayer(Amb.evil);
            }
          } else if(p.z == -3){
            ambPlayer(Amb.underwater);
          }
        }
        
        // Skip music changes if player is on a ship
        if(typeof bgmPlayer !== 'undefined') {
          if(p.shipType || p.isBoarded || p.boardedShip){
            if(typeof ship_bgm !== 'undefined') {
              bgmPlayer(ship_bgm); // Keep ship music
            }
            // Ship ambience already handled above via soundscape or ship boarding
          } else if(p.z == 0){
            if(nightfall && tempus != 'IV.a'){
              if(typeof overworld_night_bgm !== 'undefined') {
                bgmPlayer(overworld_night_bgm);
              }
            } else if(tempus == 'IV.a' || tempus == 'V.a' || tempus == 'VI.a' ||
            tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'){
              if(typeof overworld_morning_bgm !== 'undefined') {
                bgmPlayer(overworld_morning_bgm);
              }
            } else {
              if(typeof overworld_day_bgm !== 'undefined') {
                bgmPlayer(overworld_day_bgm);
              }
            }
          } else if(p.z == -1){
            if(typeof cave_bgm !== 'undefined') {
              bgmPlayer(cave_bgm);
            }
          } else if(p.z == 1 || p.z == 2){
            // Check building type - ensure building exists and has type property
            if(building && building.type){
              // Use case-insensitive comparison and trim whitespace
              var buildingType = String(building.type).toLowerCase().trim();
              
              if(buildingType == 'stronghold'){
              if(nightfall){
                if(typeof stronghold_night_bgm !== 'undefined') {
                  bgmPlayer(stronghold_night_bgm);
                }
              } else {
                if(typeof stronghold_day_bgm !== 'undefined') {
                  bgmPlayer(stronghold_day_bgm);
                }
              }
              } else if(buildingType == 'garrison'){
              if(typeof garrison_bgm !== 'undefined') {
                bgmPlayer(garrison_bgm);
                } else {
                  // Fallback if garrison_bgm not loaded
                  if(typeof indoors_bgm !== 'undefined') {
                    bgmPlayer(indoors_bgm);
              }
                }
              } else if(buildingType == 'tavern'){
              if(typeof tavern_bgm !== 'undefined') {
                bgmPlayer(tavern_bgm);
              }
              } else if(buildingType == 'monastery'){
              if(typeof monastery_bgm !== 'undefined') {
                bgmPlayer(monastery_bgm);
              }
            } else {
                // Building found but type doesn't match any special cases
                // Debug: log building type for troubleshooting (remove in production)
                if(typeof console !== 'undefined' && console.log) {
                  console.log('SocketHandler: Building type "' + building.type + '" does not match special cases, playing indoor music');
                }
                if(typeof indoors_bgm !== 'undefined') {
                  bgmPlayer(indoors_bgm);
                }
              }
            } else {
              // No building found or building has no type - play default indoor music
              // Debug: log for troubleshooting (remove in production)
              if(typeof console !== 'undefined' && console.log) {
                console.log('SocketHandler: No building found at z=' + p.z + ', x=' + p.x + ', y=' + p.y + ', buildingId=' + buildingId);
              }
              if(typeof indoors_bgm !== 'undefined') {
                bgmPlayer(indoors_bgm);
              }
            }
          } else if(p.z == -2){
            if(building && building.type == 'tavern'){
              // No music in tavern cellar
            } else {
              if(typeof dungeons_bgm !== 'undefined') {
                bgmPlayer(dungeons_bgm);
              }
            }
          }
        }
      }
    }
  },

  handleNewFaction: function(data) {
    if(typeof houseList !== 'undefined') {
      houseList = data.houseList;
    }
    if(typeof kingdomList !== 'undefined') {
      kingdomList = data.kingdomList;
    }
  },

  handleBattlegroundsMatchUpdate: function(data) {
    // Update match UI with match data
    if(typeof window !== 'undefined' && window.battlegroundsMatchUI) {
      if(data.match) {
        const matchStatus = data.match.status;
        
        // Hide lobby UI when players are spawned (after map preview, when status becomes 'starting')
        // Keep lobby visible during map_preview, but hide it when spawning begins
        if((matchStatus === 'starting' || matchStatus === 'in_progress') && window.battlegroundsLobbyUI && window.battlegroundsLobbyUI.isActive) {
          window.battlegroundsLobbyUI.hide();
        }
        
        // Show match UI when match starts (starting or in_progress status)
        if((matchStatus === 'starting' || matchStatus === 'in_progress') && window.battlegroundsMatchUI) {
          window.battlegroundsMatchUI.show(data.match);
        }
        
        // Update lobby UI with match data if it's still visible (map_preview only)
        // Keep lobby visible during map_preview, but hide when spawning begins
        if(matchStatus === 'map_preview' && window.battlegroundsLobbyUI) {
          // Update lobby with match participants (including NPCs)
          if(data.match.participants && data.match.participants.length > 0) {
            const participants = data.match.participants.map(p => {
              // Use class/sex from participant data if available, otherwise try to get from Player.list
              const entityClass = p.class || (typeof global !== 'undefined' && global.Player && global.Player.list[p.id] ? global.Player.list[p.id].class : 'SerfM');
              const entitySex = p.sex || (typeof global !== 'undefined' && global.Player && global.Player.list[p.id] ? global.Player.list[p.id].sex : 'm');
              
              return {
                id: p.id,
                name: p.name || (p.isNPC ? (p.class || 'NPC') : 'Player'),
                team: p.team || null,
                isNPC: p.isNPC || false,
                class: entityClass,
                sex: entitySex
              };
            });
            
            const lobbyState = {
              players: participants, // Keep for backward compatibility
              participants: participants, // New: explicit participants array
              gameMode: data.match.gameMode,
              status: matchStatus,
              countdownTimer: data.match.countdownTimer || 0
            };
            
            // Ensure lobby is visible and update state
            if(!window.battlegroundsLobbyUI.isActive) {
              window.battlegroundsLobbyUI.show(lobbyState);
            } else {
              // Update lobby state (this will re-render with new countdown timer and NPCs)
              window.battlegroundsLobbyUI.updateLobbyState(lobbyState);
            }
          } else {
            // Even without participants, update countdown timer (but don't clear existing players)
            const updateState = {
              gameMode: data.match.gameMode,
              status: matchStatus,
              countdownTimer: data.match.countdownTimer || 0
            };
            if(!window.battlegroundsLobbyUI.isActive) {
              window.battlegroundsLobbyUI.show(updateState);
            } else {
              window.battlegroundsLobbyUI.updateLobbyState(updateState);
            }
          }
        }
        
        // Check if this is the first update (show UI if not already active)
        if(!window.battlegroundsMatchUI.isActive && matchStatus === 'in_progress') {
          window.battlegroundsMatchUI.show(data.match);
        } else if(window.battlegroundsMatchUI.isActive) {
          window.battlegroundsMatchUI.updateMatchData(data.match);
        }
      }
    }
  },

  handleBattlegroundsMatchEnd: function(data) {
    // Hide map preview when match ends
    if(typeof window !== 'undefined' && window.battlegroundsMapPreviewUI) {
      window.battlegroundsMapPreviewUI.hide();
    }
    
    // Hide match UI after match ends
    if(typeof window !== 'undefined' && window.battlegroundsMatchUI) {
      // Keep UI visible briefly to show final results, then hide after a delay
      if(data.endData) {
        // Update UI with end data
        if(window.battlegroundsMatchUI.matchData) {
          window.battlegroundsMatchUI.matchData.status = 'ending';
          window.battlegroundsMatchUI.matchData.endData = data.endData;
          window.battlegroundsMatchUI.update();
        }
      }
      
      // Hide match UI after 2 seconds and show post-game UI
      setTimeout(() => {
        if(window.battlegroundsMatchUI) {
          window.battlegroundsMatchUI.hide();
        }
        
        // Show post-game UI
        if(window.battlegroundsPostGameUI && data.endData) {
          const matchData = window.battlegroundsMatchUI ? window.battlegroundsMatchUI.matchData : null;
          window.battlegroundsPostGameUI.show(data.endData, matchData);
        }
      }, 2000);
    }
  },

  handleBattlegroundsVotingStart: function(data) {
    // Voting has started - update post-game UI with voting interface
    if(typeof window !== 'undefined' && window.battlegroundsPostGameUI) {
      const votingState = {
        matchId: data.matchId,
        isClassicMap: data.isClassicMap,
        mapId: data.mapId,
        votingDuration: data.votingDuration,
        remainingTime: data.votingDuration,
        yesVotes: 0,
        noVotes: 0,
        totalVotes: 0,
        remainingVotes: 0,
        totalHumanPlayers: 0
      };
      window.battlegroundsPostGameUI.updateVotingState(votingState);
    }
  },

  handleBattlegroundsVotingUpdate: function(data) {
    // Update voting status
    if(typeof window !== 'undefined' && window.battlegroundsPostGameUI) {
      const votingState = {
        matchId: data.matchId,
        yesVotes: data.yesVotes || 0,
        noVotes: data.noVotes || 0,
        totalVotes: data.totalVotes || 0,
        remainingVotes: data.remainingVotes || 0,
        totalHumanPlayers: data.totalHumanPlayers || 0
      };
      window.battlegroundsPostGameUI.updateVotingState(votingState);
    }
  },

  handleBattlegroundsVotingResults: function(data) {
    // Voting has ended - show results
    if(typeof window !== 'undefined' && window.battlegroundsPostGameUI && data.results) {
      const results = data.results;
      
      // Update UI with results message
      const container = window.battlegroundsPostGameUI.container;
      if(container) {
        let messageHtml = '<div style="margin-top: 20px; padding: 15px; background-color: rgba(255,255,255,0.1); border-radius: 5px; text-align: center;">';
        
        if(results.saved) {
          messageHtml += '<div style="color: #00ff00; font-size: 16px; margin-bottom: 5px;">✓ Map saved as Classic Map!</div>';
        } else if(results.positiveVotesIncremented) {
          messageHtml += '<div style="color: #00ff00; font-size: 16px; margin-bottom: 5px;">✓ Classic Map rating increased!</div>';
        } else {
          messageHtml += '<div style="color: #ffaa00; font-size: 16px; margin-bottom: 5px;">Map not saved</div>';
        }
        
        messageHtml += `<div style="color: #aaa; font-size: 14px;">Final votes: ${results.yesVotes} Yes / ${results.noVotes} No</div>`;
        messageHtml += '</div>';
        
        // Append to existing content
        container.innerHTML += messageHtml;
      }
      
      // Hide UI after 5 seconds
      setTimeout(() => {
        if(window.battlegroundsPostGameUI) {
          window.battlegroundsPostGameUI.hide();
        }
      }, 5000);
    }
  },

  handleBattlegroundsLobbyUpdate: function(data) {
    // Update lobby UI with new state
    if(typeof window !== 'undefined' && window.battlegroundsLobbyUI && data.lobby) {
      // Clear map preview if lobby status is 'waiting' (match ended, lobby reset)
      if(data.lobby.status === 'waiting' && window.battlegroundsMapPreviewUI) {
        window.battlegroundsMapPreviewUI.hide();
      }
      window.battlegroundsLobbyUI.updateLobbyState(data.lobby);
    }
  },

  handleBattlegroundsLobbyChat: function(data) {
    // Lobby chat is now routed through the main game chat system
    // This handler is kept for backward compatibility but messages
    // are sent directly via addToChat from the server
    // No separate action needed here
  },

  handleBattlegroundsMapPreview: function(data) {
    // Show map preview during map_preview phase
    // The preview should be shown in the lobby center column, not separate window
    if(typeof window !== 'undefined' && window.battlegroundsMapPreviewUI && data.preview) {
      // Get the lobby center column if lobby is active
      let targetContainer = null;
      if(window.battlegroundsLobbyUI && window.battlegroundsLobbyUI.isActive && window.battlegroundsLobbyUI.container) {
        const centerColumn = window.battlegroundsLobbyUI.container.querySelector('#battlegrounds-lobby-map-preview');
        if(centerColumn) {
          targetContainer = centerColumn;
        }
      }
      
      // Show map preview (render into lobby center if available, otherwise separate window)
      window.battlegroundsMapPreviewUI.show(data.preview, targetContainer);
      
      // If lobby is active, trigger a re-render to show the preview
      if(window.battlegroundsLobbyUI && window.battlegroundsLobbyUI.isActive) {
        // Re-render lobby to update center column with map preview
        setTimeout(() => {
          if(window.battlegroundsLobbyUI && window.battlegroundsLobbyUI.lobbyState) {
            window.battlegroundsLobbyUI.render();
          }
        }, 100);
      }
    }
  },

  handleBattlegroundWorld: function(data) {
    // Receive battleground world data and store it
    // This allows the client to switch to battleground map context
    console.log('[CLIENT] handleBattlegroundWorld called:', {
      hasWorld: !!data.world,
      matchId: data.matchId,
      mapSize: data.mapSize,
      tileSize: data.tileSize,
      worldType: typeof data.world,
      worldIsArray: Array.isArray(data.world),
      worldLength: Array.isArray(data.world) ? data.world.length : 'N/A'
    });
    
    if(data.world && data.matchId && Array.isArray(data.world)) {
      // Store battleground world data
      // CRITICAL: Only store if world data is a valid array
      if(typeof window !== 'undefined') {
        if(!window.battlegroundWorlds) {
          window.battlegroundWorlds = {};
        }
        window.battlegroundWorlds[data.matchId] = {
          world: data.world,
          tileSize: data.tileSize || 64,
          mapSize: data.mapSize,
          startingZ: data.startingZ || 0
        };
        
        // Only switch context during init to avoid trusting out-of-order messages
        if (window.currentBattlegroundMatchId === data.matchId && window.inBattleground) {
          window.battlegroundWorld = data.world;
          window.battlegroundTileSize = data.tileSize || 64;
          window.battlegroundMapSize = data.mapSize;
          console.log('[CLIENT] Refreshed battleground world for match:', data.matchId);
        } else {
          console.log('[CLIENT] Stored battleground world for match:', data.matchId);
        }
      }
    } else {
      console.error('[CLIENT] handleBattlegroundWorld: Missing world or matchId', { hasWorld: !!data.world, matchId: data.matchId });
    }
  }
};

