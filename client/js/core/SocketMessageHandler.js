/**
 * SocketMessageHandler.js
 * Handles all incoming socket messages from the server
 * Extracted from client.js to reduce complexity
 */

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
      if(typeof getBgm !== 'undefined') {
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
    } else if(data.msg == 'caveMapData'){
      this.handleCaveMapData(data);
    } else if(data.msg == 'buildMenuData'){
      this.handleBuildMenuData(data);
    } else if(data.msg == 'resourceScoreboard' || data.msg == 'resourceScoreboardUpdate'){
      this.handleResourceScoreboard(data);
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
    console.log('Preview data received:', {
      worldLayers: data.world ? data.world.length : 0,
      tileSize: data.tileSize,
      mapSize: data.mapSize,
      tempus: data.tempus,
      nightfall: data.nightfall,
      players: data.pack.player ? data.pack.player.length : 0,
      items: data.pack.item ? data.pack.item.length : 0,
      buildings: data.pack.building ? data.pack.building.length : 0
    });
    
    // Store in global scope FIRST so GameLoopManager can access updated values immediately
    if (typeof window !== 'undefined') {
      window.world = data.world;
      window.tileSize = data.tileSize;
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
    }
    
    // Update UI sizing now that tileSize is known
    if(typeof resizeCanvas !== 'undefined') {
      resizeCanvas();
    }
    
    // Load entities for preview
    if(data.pack.player) {
      console.log('Preview: Loading', data.pack.player.length, 'player entities...');
      var previewLoadedCount = 0;
      var previewErrorCount = 0;
      
      for(i in data.pack.player){
        try {
          var playerData = data.pack.player[i];
          new Player(playerData);
          
          // Fix sprite immediately after creation
          var p = Player.list[playerData.id];
          if(p) {
            var sprite = getSpriteForClass(p.class, p.ghost);
            // Set sprite directly (like other NPCs) - falcons will render once sprite loads
            p.sprite = sprite;
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
      console.log('Preview: Loaded', previewLoadedCount, 'players,', previewErrorCount, 'errors, total in list:', Object.keys(Player.list).length);
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
    console.log('Falcons available for camera:', falconCount);
    
    // Start login camera system once data is loaded
    if(typeof loginCameraSystem !== 'undefined' && loginCameraSystem && !loginCameraSystem.isActive) {
      console.log('Starting login camera system');
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
      
      // Stop all audio (login music, ambience) when entering spectate mode
      if(window.AudioCtrl) {
        AudioCtrl.bgm.pause();
        AudioCtrl.bgm.currentTime = 0;
        AudioCtrl.amb.pause();
        AudioCtrl.amb.currentTime = 0;
        AudioCtrl.playlist = null;
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

  handleBuildPreviewData: function(data) {
    // Preview data received - preview is now active and will follow cursor
    if(typeof window !== 'undefined') {
      window.buildPreviewData = data;
    }
  },

  handleBuildValidationData: function(data) {
    // Validation data received
    if(typeof window !== 'undefined') {
      window.buildPreviewData = data;
    }
  },

  handleGearUpdate: function(data) {
    // Update client-side gear, inventory, and class data
    if(typeof selfId !== 'undefined' && Player.list[selfId]){
      if(data.gear){
        Player.list[selfId].gear = data.gear;
      }
      if(data.inventory){
        Player.list[selfId].inventory = data.inventory;
      }
      if(data.class){
        Player.list[selfId].class = data.class;
        // Update sprite based on new class
        if(data.class.toLowerCase() === 'serf'){
          Player.list[selfId].sprite = Player.list[selfId].sex === 'f' ? femaleserf : maleserf;
        } else {
          // Try to load sprite for the new class
          var classLower = data.class.toLowerCase();
          if(typeof Img !== 'undefined' && Img[classLower + 'd']){
            Player.list[selfId].sprite = {
              facedown: Img[classLower + 'd'],
              faceup: Img[classLower + 'u'],
              faceleft: Img[classLower + 'l'],
              faceright: Img[classLower + 'r'],
              walkdown: [Img[classLower + 'd']],
              walkup: [Img[classLower + 'u']],
              walkleft: [Img[classLower + 'l']],
              walkright: [Img[classLower + 'r']],
              attackd: Img[classLower + 'attackd'],
              attacku: Img[classLower + 'attacku'],
              attackl: Img[classLower + 'attackl'],
              attackr: Img[classLower + 'attackr']
            };
          }
        }
      }
      // Refresh both displays when gear changes
      if(typeof updateInventoryDisplay !== 'undefined') {
        updateInventoryDisplay();
      }
      if(typeof characterPopup !== 'undefined' && characterPopup && characterPopup.style.display === 'block'){
        if(typeof updateCharacterDisplay !== 'undefined') {
          updateCharacterDisplay(true); // Force full update including sprite
        }
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
      console.log('Now controlling player:', selfId);
      
      // CRITICAL: Clear isBoarded flag immediately
      var player = Player.list[selfId];
      if(player){
        player.isBoarded = false;
        player.boardedShip = null;
        console.log('🏖️ Player visible again - isBoarded:', player.isBoarded);
      }
      
      // Force audio update (using AudioManager if available, fallback to legacy)
      if(typeof audioManager !== 'undefined' && audioManager.forceUpdate){
        audioManager.forceUpdate();
      } else {
        // Legacy fallback
        if(player){
          var building = getBuilding(player.x, player.y);
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
        console.log('⚓ Now controlling ship:', data.shipId);
        console.log('⚓ Ship exists in Player.list?', !!Player.list[data.shipId]);
        if(Player.list[data.shipId]){
          console.log('⚓ Ship position:', Player.list[data.shipId].x, Player.list[data.shipId].y);
        } else {
          console.log('⚠️ ERROR: Ship entity not found in Player.list! Camera will not follow!');
        }
        
        // Switch BGM to ship playlist and add sea ambience
        if(typeof bgmPlayer !== 'undefined' && typeof ship_bgm !== 'undefined'){
          bgmPlayer(ship_bgm);
        }
        if(typeof ambPlayer !== 'undefined'){
          ambPlayer('/client/audio/amb/sea.mp3');
        }
      } else {
        // Just a passenger - mark as boarded but don't switch control
        var player = Player.list[selfId];
        if(player){
          console.log('🚢 CLIENT: Before boarding - Player z:', player.z);
          player.isBoarded = true;
          player.boardedShip = data.shipId;
          console.log('🚢 CLIENT: After setting isBoarded - Player z:', player.z);
          
          // Check ship z
          var ship = Player.list[data.shipId];
          if(ship){
            console.log('🚢 CLIENT: Ship z:', ship.z);
          }
        }
        
        // Passengers also get ship BGM and sea ambience
        if(typeof bgmPlayer !== 'undefined' && typeof ship_bgm !== 'undefined'){
          bgmPlayer(ship_bgm);
        }
        if(typeof ambPlayer !== 'undefined'){
          ambPlayer('/client/audio/amb/sea.mp3');
        }
        
        console.log('🚢 Boarded as passenger');
      }
    }
  },

  handleTileEdit: function(data) {
    if(world[data.l] && world[data.l][data.r]) {
      world[data.l][data.r][data.c] = data.tile;
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
    console.log('Init received - selfId:', typeof selfId !== 'undefined' ? selfId : 'undefined', 'Players:', data.pack.player ? data.pack.player.length : 0);
    
    // Only clear entities if this is an initial init message (has selfId)
    if(data.selfId !== undefined) {
      Player.list = {};
      Arrow.list = {};
      Item.list = {};
      Light.list = {};
      Building.list = {};
    }
    
    // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
    console.log('Init: Loading', data.pack.player ? data.pack.player.length : 0, 'player entities...');
    var initLoadedCount = 0;
    var initErrorCount = 0;
    
    for(i in data.pack.player){
      try {
        var playerData = data.pack.player[i];
        new Player(playerData);
        
        // Fix sprite immediately after creation (Player constructor defaults to maleserf)
        var p = Player.list[playerData.id];
        if(p) {
          var sprite = getSpriteForClass(p.class, p.ghost);
          // Set sprite directly (like other NPCs)
          p.sprite = sprite;
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
    console.log('Init: Loaded', initLoadedCount, 'players,', initErrorCount, 'errors, total in Player.list:', Object.keys(Player.list).length);
    for(i in data.pack.arrow){
      new Arrow(data.pack.arrow[i]);
      console.log('Client: Arrow created from init pack:', data.pack.arrow[i].id, 'angle:', data.pack.arrow[i].angle);
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
    
    // If spectate mode is active, start camera after entities are loaded
    if(typeof spectateCameraSystem !== 'undefined' && spectateCameraSystem && spectateCameraSystem.isActive) {
      console.log('Init received, starting spectate camera in 500ms...');
      setTimeout(function(){
        console.log('Starting spectate camera now');
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
        
        // Spectators don't have a selfId or player character, music is handled by camera
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
      if(p){
        // Track last non-visual update time for throttling
        if (!p._lastNonVisualUpdate) {
          p._lastNonVisualUpdate = 0;
        }
        
        // OPTIMIZATION: Skip position update if position hasn't changed (common for stationary entities)
        // This reduces unnecessary object mutations and improves cache coherence
        var posChanged = false;
        if(pack.x != undefined && p.x !== pack.x) { p.x = pack.x; posChanged = true; }
        if(pack.y != undefined && p.y !== pack.y) { p.y = pack.y; posChanged = true; }
        if(pack.z != undefined && p.z !== pack.z) { p.z = pack.z; posChanged = true; }
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
              }
            } else if(typeof selectedTarget !== 'undefined' && !selectedTarget){
              // Player is already in combat but has no target selected - auto-select the attacker
              selectedTarget = targetId;
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
        if(pack.class != undefined && p.class !== pack.class) {
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
        var now = Date.now();
        if (now - p._lastNonVisualUpdate > 500) {
          if(pack.name != undefined) p.name = pack.name;
          if(pack.house != undefined) p.house = pack.house;
          if(pack.kingdom != undefined) p.kingdom = pack.kingdom;
          if(pack.rank != undefined) p.rank = pack.rank;
          if(pack.friends != undefined) p.friends = pack.friends;
          if(pack.enemies != undefined) p.enemies = pack.enemies;
          if(pack.gear != undefined) p.gear = pack.gear;
          if(pack.inventory != undefined) p.inventory = pack.inventory;
          if(pack.kills != undefined) p.kills = pack.kills;
          if(pack.skulls != undefined) p.skulls = pack.skulls;
          
          p._lastNonVisualUpdate = now;
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
        if(pack.shipType != undefined) p.shipType = pack.shipType;
        if(pack.isPlayerControlled != undefined) p.isPlayerControlled = pack.isPlayerControlled;
        
        // Handle action updates
        if(pack.action !== undefined) {
          p.action = pack.action;
        }

        // OPTIMIZATION: Only update sprite if class or ghost state changed
        // Uses O(1) lookup table instead of 125+ if-else comparisons
        // Update sprite if class/ghost changed or sprite is missing
        // BUGFIX: Always update sprite for wolves to ensure walk animations work
        if (classChanged || ghostChanged || !p.sprite || p.class === 'Wolf') {
          var newSprite = getSpriteForClass(p.class, p.ghost);
          p.sprite = newSprite; // Set sprite directly (like other NPCs)
        }
      }
    }
    // Ensure Arrow.list exists before accessing it
    if(!Arrow.list) Arrow.list = {};
    for(var i = 0 ; i < data.pack.arrow.length; i++){
      var pack = data.pack.arrow[i];
      var b = Arrow.list[data.pack.arrow[i].id];
      if(b){
        if(pack.angle != undefined)
          b.angle = pack.angle;
        if(pack.x != undefined)
          b.x = pack.x;
        if(pack.y != undefined)
          b.y = pack.y;
        if(pack.z != undefined)
          b.z = pack.z;
      }
    }
    // Ensure Item.list exists before accessing it
    if(!Item.list) Item.list = {};
    for(var i = 0 ; i < data.pack.item.length; i++){
      var pack = data.pack.item[i];
      var itm = Item.list[data.pack.item[i].id];
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
      }
    }
    // Ensure Light.list exists before accessing it
    if(!Light.list) Light.list = {};
    for(var i = 0 ; i < data.pack.light.length; i++){
      var pack = data.pack.light[i];
      var l = Light.list[data.pack.light[i].id];
      if(l){
        if(pack.x != undefined)
          l.x = pack.x;
        if(pack.y != undefined)
          l.y = pack.y;
        if(pack.z != undefined)
          l.z = pack.z;
        if(pack.radius != undefined)
          l.radius = pack.radius;
      } else {
        // Create new light if it doesn't exist (handles lights that come in update packs)
        // This is important for login camera mode where lights might be sent after initial init
        new Light(pack);
      }
    }
    // Ensure Building.list exists before accessing it
    if(!Building.list) Building.list = {};
    for(var i = 0; i < data.pack.building.length; i++){
      var pack = data.pack.building[i];
      var b = Building.list[data.pack.building[i].id];
      if(b){
        if(pack.hp != undefined)
          b.hp = pack.hp;
        if(pack.occ != undefined)
          b.occ = pack.occ;
      }
    }
    
    // Check if we need to update music after exiting god mode
    if(typeof godModeCamera !== 'undefined' && godModeCamera.needsMusicUpdate && typeof selfId !== 'undefined' && Player.list[selfId]){
      godModeCamera.needsMusicUpdate = false;
      var p = Player.list[selfId];
      var b = getBuilding(p.x, p.y);
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
              intensity: pack.intensity
            };
          } else {
            var weather = Weather.list[pack.id];
            weather.x = pack.x;
            weather.y = pack.y;
            weather.weatherType = pack.weatherType;
            weather.intensity = pack.intensity;
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
      var b = (z == 1 || z == 2) ? getBuilding(x, y) : null;
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
      } else if((p.z == 1 || p.z == 2) && (tempus == 'VIII.p' || tempus == 'IV.a')){
        var b = getBuilding(p.x,p.y);
        if(typeof getBgm !== 'undefined') {
          getBgm(p.x,p.y,p.z,b);
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
      var b = (data.cameraZ == 1 || data.cameraZ == 2) ? getBuilding(data.cameraX, data.cameraY) : null;
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
      console.log('Ghost mode activated: playing death music');
      
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
        console.log('Ghost mode deactivated: AudioManager updating to normal audio');
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
        var building = Building.list[getBuilding(p.x, p.y)];
        
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
          if(p.shipType || p.isBoarded){
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
            if(building && building.type == 'stronghold'){
              if(nightfall){
                if(typeof stronghold_night_bgm !== 'undefined') {
                  bgmPlayer(stronghold_night_bgm);
                }
              } else {
                if(typeof stronghold_day_bgm !== 'undefined') {
                  bgmPlayer(stronghold_day_bgm);
                }
              }
            } else if(building && building.type == 'garrison'){
              if(typeof garrison_bgm !== 'undefined') {
                bgmPlayer(garrison_bgm);
              }
            } else if(building && building.type == 'tavern'){
              if(typeof tavern_bgm !== 'undefined') {
                bgmPlayer(tavern_bgm);
              }
            } else if(building && building.type == 'monastery'){
              if(typeof monastery_bgm !== 'undefined') {
                bgmPlayer(monastery_bgm);
              }
            } else {
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
        console.log('Ghost mode deactivated: immediately switched to normal music');
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
  }
};

