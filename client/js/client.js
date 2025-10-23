var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;
var world = [];
var tileSize = 0;
var mapSize = 0;

// Dynamic canvas sizing
function resizeCanvas() {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  var ctx_canvas = document.getElementById('ctx');
  var lighting_canvas = document.getElementById('lighting');
  if (ctx_canvas) {
    ctx_canvas.width = WIDTH;
    ctx_canvas.height = HEIGHT;
  }
  if (lighting_canvas) {
    lighting_canvas.width = WIDTH;
    lighting_canvas.height = HEIGHT;
  }
  if (viewport) {
    viewport.screen = [WIDTH, HEIGHT];
  }
  
  // Update UI sizes based on tileSize
  if(tileSize > 0){
    var skillsBar = document.getElementById('skills-bar');
    var chatMessagesContainer = document.getElementById('chat-messages-container');
    var chatInputWrapper = document.getElementById('chat-input-wrapper');
    
    var skillsBarHeight = tileSize * 1.1; // Reduced from 1.2
    var chatInputHeight = 50; // Fixed height for input
    
    if(skillsBar){
      skillsBar.style.height = skillsBarHeight + 'px';
    }
    if(chatInputWrapper){
      chatInputWrapper.style.height = chatInputHeight + 'px';
      chatInputWrapper.style.bottom = skillsBarHeight + 'px';
    }
    if(chatMessagesContainer){
      chatMessagesContainer.style.height = (tileSize * 3) + 'px';
      chatMessagesContainer.style.bottom = (skillsBarHeight + chatInputHeight) + 'px';
    }
  }
}

// Initialize canvas size on load
window.addEventListener('load', function() {
  resizeCanvas();
});

// Update canvas size on window resize
window.addEventListener('resize', function() {
  resizeCanvas();
});

var socket = SockJS('http://localhost:2000/io');
socket.onopen = function(){
  console.log('Client connection opened');
  // Request initial world data for login screen preview
  socket.send(JSON.stringify({msg:'requestPreviewData'}));
};
socket.onmessage = function(event){
  var data = JSON.parse(event.data);
  
  if(data.msg == 'previewData'){
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
    
    world = data.world;
    tileSize = data.tileSize;
    mapSize = data.mapSize;
    tempus = data.tempus;
    nightfall = data.nightfall;
    
    // Update UI sizing now that tileSize is known
    resizeCanvas();
    
    // Load entities for preview
    if(data.pack.player) {
      for(i in data.pack.player){
        new Player(data.pack.player[i]);
      }
      console.log('Loaded preview players, total in list:', Object.keys(Player.list).length);
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
    if(loginCameraSystem && loginCameraSystem.isActive) {
      console.log('Starting login camera system');
      loginCameraSystem.start();
    }
  } else if(data.msg == 'signInResponse'){
    if(data.success){
      world = data.world;
      tileSize = data.tileSize;
      mapSize = data.mapSize;
      tempus = data.tempus;
      
      // Update UI sizing now that tileSize is known
      resizeCanvas();
      
      // Stop cinematic camera and switch to player
      if(window.loginCameraSystem) {
        window.loginCameraSystem.stop();
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
      resetChatHideTimer();
      
      var b = getBuilding(Player.list[selfId].x,Player.list[selfId].y);
      getBgm(Player.list[selfId].x,Player.list[selfId].y,Player.list[selfId].z,b);
    } else {
      alert('Sign-in failed.')
    }
  } else if(data.msg == 'spectateResponse'){
    console.log('Spectate response received:', data.success);
    if(data.success){
      world = data.world;
      tileSize = data.tileSize;
      mapSize = data.mapSize;
      tempus = data.tempus;
      
      console.log('World data loaded, tileSize:', tileSize, 'mapSize:', mapSize);
      
      // Update UI sizing
      resizeCanvas();
      
      // Stop login camera
      if(window.loginCameraSystem) {
        console.log('Stopping login camera');
        window.loginCameraSystem.stop();
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
      resetChatHideTimer();
      
      console.log('Spectate response complete, waiting for init...');
    } else {
      alert('Spectate failed - invalid credentials.');
    }
  } else if(data.msg == 'signUpResponse'){
    if(data.success){
      alert('Sign-up successful.')
    } else
      alert('Sign-up failed.')
  } else if(data.msg == 'bgm'){
    getBgm(data.x,data.y,data.z,data.b);
  } else if(data.msg == 'addToChat'){
    chatMessages.innerHTML += '<div>' + data.message + '</div>';
    // Force scroll to absolute bottom
    setTimeout(function(){
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 0);
    resetChatHideTimer(); // Show chat and restart hide timer
  } else if(data.msg == 'spectatorChatMessage'){
    // Display spectator chat with distinct styling
    chatMessages.innerHTML += '<div style="color: #4CAF50;">' + data.message + '</div>';
    setTimeout(function(){
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 0);
    resetChatHideTimer();
  } else if(data.msg == 'worldMapData'){
    // Show worldmap popup and render the world map
    if(worldmapPopup){
      worldmapPopup.style.display = 'block';
    }
    renderWorldMap(data.terrain, data.mapSize, data.playerX, data.playerY, data.tileSize);
  } else if(data.msg == 'buildMenuData'){
    // Show build menu and render building tiles
    if(buildMenuPopup){
      buildMenuPopup.style.display = 'block';
    }
    renderBuildMenu(data.buildings, data.playerWood, data.playerStone);
      } else if(data.msg == 'buildPreviewData'){
        // Preview data received - preview is now active and will follow cursor
        buildPreviewData = data;
      } else if(data.msg == 'buildValidationData'){
        // Validation data received
        buildPreviewData = data;
  } else if(data.msg == 'gearUpdate'){
    // Update client-side gear, inventory, and class data
    if(Player.list[selfId]){
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
          if(Img[classLower + 'd']){
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
      updateInventoryDisplay();
      if(characterPopup && characterPopup.style.display === 'block'){
        updateCharacterDisplay(true); // Force full update including sprite
      }
    }
  } else if(data.msg == 'openMarket'){
    // Open market UI with orderbook data
    currentMarketData = data;
    if(marketPopup){
      marketPopup.style.display = 'block';
      updateMarketDisplay();
    }
  } else if(data.msg == 'tileEdit'){
    if(world[data.l] && world[data.l][data.r]) {
      world[data.l][data.r][data.c] = data.tile;
    }
  } else if(data.msg == 'layerEdit'){
    world[data.l] = data.layer;
  } else if(data.msg == 'mapEdit'){
    world = data.world;
  } else if(data.msg == 'buildingPreview'){
    // Handle building preview
    console.log('Client received buildingPreview message:', data);
    if(window.buildingPreviewRenderer){
      window.buildingPreviewRenderer.showPreview(data);
    } else {
      console.log('BuildingPreviewRenderer not found!');
    }
  } else if(data.msg == 'init'){
    if(data.selfId)
      selfId = data.selfId;
    // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
    for(i in data.pack.player){
      new Player(data.pack.player[i]);
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
    
    // If spectate mode is active, start camera after entities are loaded
    if(spectateCameraSystem && spectateCameraSystem.isActive) {
      console.log('Init received, starting spectate camera in 500ms...');
      setTimeout(function(){
        console.log('Starting spectate camera now');
        spectateCameraSystem.start();
        
        // Update BGM for spectate mode
        if(Player.list[selfId]){
          var spectator = Player.list[selfId];
          getBgm(spectator.x, spectator.y, spectator.z, null);
        }
      }, 500);
    }
  } else if(data.msg == 'update'){
    // { player : [{id:123,number:'1',x:0,y:0},{id:1,x:0,y:0}] arrow : []}
    for(var i = 0 ; i < data.pack.player.length; i++){
      var pack = data.pack.player[i];
      var p = Player.list[pack.id];
      if(p){
        if(pack.name != undefined)
          p.name = pack.name;
        if(pack.house != undefined)
          p.house = pack.house;
        if(pack.kingdom != undefined)
          p.kingdom = pack.kingdom;
        if(pack.x != undefined)
          p.x = pack.x;
        if(pack.y != undefined)
          p.y = pack.y;
        if(pack.z != undefined)
          p.z = pack.z;
        if(pack.class != undefined)
          p.class = pack.class;
        if(pack.rank != undefined)
          p.rank = pack.rank;
        if(pack.friends != undefined)
          p.friends = pack.friends;
        if(pack.enemies != undefined)
          p.enemies = pack.enemies;
        if(pack.gear != undefined)
          p.gear = pack.gear;
        if(pack.inventory != undefined)
          p.inventory = pack.inventory;
        if(pack.spriteSize != undefined)
          p.spriteSize = pack.spriteSize;
        if(pack.facing != undefined)
          p.facing = pack.facing;
        if(pack.stealthed != undefined)
          p.stealthed = pack.stealthed;
        if(pack.revealed != undefined)
          p.revealed = pack.revealed;
        if(pack.pressingUp != undefined)
          p.pressingUp = pack.pressingUp;
        if(pack.pressingDown != undefined)
          p.pressingDown = pack.pressingDown;
        if(pack.pressingLeft != undefined)
          p.pressingLeft = pack.pressingLeft;
        if(pack.pressingRight != undefined)
          p.pressingRight = pack.pressingRight;
        if(pack.pressingAttack != undefined)
          p.pressingAttack = pack.pressingAttack;
        if(pack.innaWoods != undefined)
          p.innaWoods = pack.innaWoods;
        if(pack.angle != undefined)
          p.angle = pack.angle;
        if(pack.working != undefined)
          p.working = pack.working;
        if(pack.chopping != undefined)
          p.chopping = pack.chopping;
        if(pack.mining != undefined)
          p.mining = pack.mining;
        if(pack.farming != undefined)
          p.farming = pack.farming;
        if(pack.building != undefined)
          p.building = pack.building;
        if(pack.fishing != undefined)
          p.fishing = pack.fishing;
        if(pack.hp != undefined)
          p.hp = pack.hp;
        if(pack.hpMax != undefined)
          p.hpMax = pack.hpMax;
        if(pack.spirit != undefined)
          p.spirit = pack.spirit;
        if(pack.spiritMax != undefined)
          p.spiritMax = pack.spiritMax;
        if(pack.breath != undefined)
          p.breath = pack.breath;
        if(pack.breathMax != undefined)
          p.breathMax = pack.breathMax;
        if(pack.action !== undefined) {
          if(p.id === selfId && p.action === 'combat') {
            console.log(`Player action update: old=${p.action}, new=${pack.action}, type=${typeof pack.action}`);
          }
          p.action = pack.action;
        } else if(p.id === selfId && p.action === 'combat') {
          console.log(`Combat status: action field not in update pack, keeping old value: ${p.action}`);
        }
        if(pack.ghost != undefined)
          p.ghost = pack.ghost;
        if(pack.kills != undefined)
          p.kills = pack.kills;
        if(pack.skulls != undefined)
          p.skulls = pack.skulls;
        if(pack.spriteScale != undefined)
          p.spriteScale = pack.spriteScale;

        // Ghost mode overrides all sprite assignments
        if(p.ghost){
          p.sprite = ghost;
        } else if(p.class == 'Sheep'){
          p.sprite = sheep;
        } else if(p.class == 'Deer'){
          p.sprite = deer;
        } else if(p.class == 'Boar'){
          p.sprite = boar;
        } else if(p.class == 'Wolf'){
          p.sprite = wolf;
        } else if(p.class == 'Falcon'){
          p.sprite = falcon;
        } else if(p.class == 'Serf' || p.class == 'SerfM'){
          p.sprite = maleserf;
        } else if(p.class == 'Rogue' || p.class == 'Trapper' || p.class == 'Cutthroat'){
          p.sprite = rogue;
        } else if(p.class == 'Hunter' || p.class == 'Outlaw'){
          p.sprite = hunter;
        } else if(p.class == 'Scout'){
          p.sprite = scout;
        } else if(p.class == 'Ranger' || p.class == 'Warden'){
          p.sprite = ranger;
        } else if(p.class == 'Swordsman'){
          p.sprite = swordsman;
        } else if(p.class == 'Archer'){
          p.sprite = archer;
        } else if(p.class == 'Horseman'){
          p.sprite = horseman;
        } else if(p.class == 'MountedArcher'){
          p.sprite = mountedarcher;
        } else if(p.class == 'Hero'){
          p.sprite = hero;
        } else if(p.class == 'Templar' || p.class == 'Hospitaller' || p.class == 'Hochmeister'){
          p.sprite = templar;
        } else if(p.class == 'Cavalry'){
          p.sprite = cavalry;
        } else if(p.class == 'Knight'){
          p.sprite = knight;
        } else if(p.class == 'Lancer' || p.class == 'Charlemagne'){
          p.sprite = lancer;
        } else if(p.class == 'Crusader'){
          p.sprite = crusader;
        } else if(p.class == 'Priest' || p.class == 'Monk' || p.class == 'Prior'){
          p.sprite = monk;
        } else if(p.class == 'Mage' || p.class == 'Acolyte'){
          p.sprite = mage;
        } else if(p.class == 'Warlock' || p.class == 'Brother'){
          p.sprite = warlock;
        } else if(p.class == 'King' || p.class == 'Alaric'){
          p.sprite = king;
        } else if(p.class == 'SerfF'){
          p.sprite = femaleserf;
        } else if(p.class == 'Innkeeper' || p.class == 'Shipwright'){
          p.sprite = innkeeper;
        } else if(p.class == 'Bishop'){
          p.sprite = bishop;
        } else if(p.class == 'Friar'){
          p.sprite = friar;
        } else if(p.class == 'Footsoldier'){
          p.sprite = footsoldier;
        } else if(p.class == 'Skirmisher'){
          p.sprite = skirmisher;
        } else if(p.class == 'Cavalier'){
          p.sprite = cavalier;
        } else if(p.class == 'General'){
          p.sprite = general;
        } else if(p.class == 'ImperialKnight' || p.class == 'TeutonicKnight'){
          p.sprite = teutonicknight;
        } else if(p.class == 'Trebuchet'){
          p.sprite = trebuchet;
        } else if(p.class == 'Oathkeeper' || p.class == 'Archbishop'){
          p.sprite = archbishop;
        } else if(p.class == 'Apparition'){
          p.sprite = apparition;
        } else if(p.class == 'Goth' || p.class == 'NorseSword'){
          p.sprite = goth;
        } else if(p.class == 'HighPriestess'){
          p.sprite = highpriestess;
        } else if(p.class == 'Cataphract' || p.class == 'Carolingian' || p.class == 'Marauder'){
          p.sprite = marauder;
        } else if(p.class == 'NorseSpear'){
          p.sprite = norsespear;
        } else if(p.class == 'seidr'){
          p.sprite = seidr;
        } else if(p.class == 'Huskarl'){
          p.sprite = huskarl;
        } else if(p.class == 'FrankSword'){
          p.sprite = franksword;
        } else if(p.class == 'FrankSpear'){
          p.sprite = frankspear;
        } else if(p.class == 'FrankBow'){
          p.sprite = frankbow;
        } else if(p.class == 'Mangonel'){
          p.sprite = mangonel;
        } else if(p.class == 'Malvoisin'){
          p.sprite = malvoisin;
        } else if(p.class == 'CeltAxe'){
          p.sprite = celtaxe;
        } else if(p.class == 'CeltSpear'){
          p.sprite = celtspear;
        } else if(p.class == 'Headhunter'){
          p.sprite = headhunter;
        } else if(p.class == 'Druid'){
          p.sprite = druid;
        } else if(p.class == 'Morrigan'){
          p.sprite = morrigan;
        } else if(p.class == 'Gwenllian'){
          p.sprite = gwenllian;
        } else if(p.class == 'TeutonPike'){
          p.sprite = teutonpike;
        } else if(p.class == 'TeutonBow'){
          p.sprite = teutonbow;
        } else if(p.class == 'TeutonicKnight'){
          p.sprite = teutonicknight;
        } else if(p.class == 'Poacher'){
          p.sprite = poacher;
        } else if(p.class == 'Strongman'){
          p.sprite = strongman;
        } else if(p.class == 'Condottiere'){
          p.sprite = condottiere;
        }
      }
    }
    for(var i = 0 ; i < data.pack.arrow.length; i++){
      var pack = data.pack.arrow[i];
      var b = Arrow.list[data.pack.arrow[i].id];
      if(b){
        if(pack.x != undefined)
          b.x = pack.x;
        if(pack.y != undefined)
          b.y = pack.y;
        if(pack.z != undefined)
          b.z = pack.z;
      }
    }
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
      }
    }
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
      }
    }
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
    if(godModeCamera.needsMusicUpdate && Player.list[selfId]){
      godModeCamera.needsMusicUpdate = false;
      var p = Player.list[selfId];
      var b = getBuilding(p.x, p.y);
      getBgm(p.x, p.y, p.z, b);
    }
  } else if(data.msg == 'remove'){
    // {player:[12323],arrow:[12323,123123]}
    for(var i = 0 ; i < data.pack.player.length; i++){
      delete Player.list[data.pack.player[i]];
    }
    for(var i = 0 ; i < data.pack.arrow.length; i++){
      delete Arrow.list[data.pack.arrow[i]];
    }
    for(var i = 0 ; i < data.pack.item.length; i++){
      delete Item.list[data.pack.item[i]];
    }
    for(var i = 0 ; i < data.pack.light.length; i++){
      delete Light.list[data.pack.light[i]];
    }
    for(var i = 0 ; i < data.pack.building.length; i++){
      delete Building.list[data.pack.building[i]];
    }
  } else if(data.msg == 'tempus'){
    tempus = data.tempus;
    nightfall = data.nightfall;
    
    // Update music based on god mode camera or player position
    if(godModeCamera.isActive){
      // In god mode - use camera position
      var z = godModeCamera.cameraZ;
      var x = godModeCamera.cameraX;
      var y = godModeCamera.cameraY;
      var b = (z == 1 || z == 2) ? getBuilding(x, y) : null;
      getBgm(x, y, z, b);
    } else if(Player.list[selfId]){
      // Normal mode - use player position
      var p = Player.list[selfId];
      if(p.z == 0 && (tempus == 'IV.a' || tempus == 'V.a' || tempus == 'X.a' || tempus == 'VIII.p')){
        getBgm(p.x,p.y,p.z);
      } else if((p.z == 1 || p.z == 2) && (tempus == 'VIII.p' || tempus == 'IV.a')){
        var b = getBuilding(p.x,p.y);
        getBgm(p.x,p.y,p.z,b);
      }
    }
  } else if(data.msg == 'godMode'){
    // Handle god mode camera
    if(data.active){
      // Start god mode spectator camera
      godModeCamera.start(data.cameraX, data.cameraY, data.cameraZ, data.factionHQs);
      
      // Update music/ambience for initial god mode position
      var b = (data.cameraZ == 1 || data.cameraZ == 2) ? getBuilding(data.cameraX, data.cameraY) : null;
      getBgm(data.cameraX, data.cameraY, data.cameraZ, b);
    } else {
      // Stop god mode camera
      godModeCamera.stop();
      godModeCamera.needsMusicUpdate = true; // Flag for next update cycle
    }
  } else if(data.msg == 'ghostMode'){
    // Handle ghost mode audio/visual changes
    if(data.active && Player.list[selfId]){
      // Player just became ghost - play death music immediately
      AudioCtrl.playlist = null; // Force change
      bgmPlayer(defeat_bgm, false, false); // Play Defeat.mp3 once
      ambPlayer(Amb.spirits); // Play spirits ambience
      console.log('Ghost mode activated: playing death music');
    } else if(!data.active && Player.list[selfId]){
      // Player respawned - immediately switch to normal music and ambience
      // Stop current music and force immediate change
      AudioCtrl.bgm.pause();
      AudioCtrl.bgm.currentTime = 0;
      AudioCtrl.playlist = null; // Force playlist change
      
      // Stop current ambience and force immediate change
      AudioCtrl.amb.pause();
      AudioCtrl.amb.currentTime = 0;
      AudioCtrl.amb.src = null; // Force ambience change
      
      var p = Player.list[selfId];
      // Directly determine and play normal ambience based on location
      var building = Building.list[getBuilding(p.x, p.y)];
      
      // Set ambient sound based on location
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
        } else if(hasFire(p.z, p.x, p.y)){
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
      
      if(p.z == 0){
        if(nightfall && tempus != 'IV.a'){
          bgmPlayer(overworld_night_bgm);
        } else if(tempus == 'IV.a' || tempus == 'V.a' || tempus == 'VI.a' ||
        tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'){
          bgmPlayer(overworld_morning_bgm);
        } else {
          bgmPlayer(overworld_day_bgm);
        }
      } else if(p.z == -1){
        bgmPlayer(cave_bgm);
      } else if(p.z == 1 || p.z == 2){
        if(building && building.type == 'stronghold'){
          if(nightfall){
            bgmPlayer(stronghold_night_bgm);
          } else {
            bgmPlayer(stronghold_day_bgm);
          }
        } else if(building && building.type == 'garrison'){
          bgmPlayer(garrison_bgm);
        } else if(building && building.type == 'tavern'){
          bgmPlayer(tavern_bgm);
        } else if(building && building.type == 'monastery'){
          bgmPlayer(monastery_bgm);
        } else {
          bgmPlayer(indoors_bgm);
        }
      } else if(p.z == -2){
        if(building && building.type == 'tavern'){
          // No music in tavern cellar
        } else {
          bgmPlayer(dungeons_bgm);
        }
      }
      console.log('Ghost mode deactivated: immediately switched to normal music');
    }
  } else if(data.msg == 'newFaction'){
    houseList = data.houseList;
    kingdomList = data.kingdomlist;
  }
};

socket.onerror = function(event){
  console.log('Client error: ' + event);
};
socket.onclose = function(event){
  console.log('Client connection closed: ' + event.code);
};

// SIGN IN
var enterButton = document.getElementById('enter');
var enterOverlay = document.getElementById('enterOverlay');
var loginOverlay = document.getElementById('loginOverlay');
var signDivUsername = document.getElementById('signDiv-username');
var signDivPassword = document.getElementById('signDiv-password');
var signDivSignIn = document.getElementById('signDiv-signIn');
var signDivSignUp = document.getElementById('signDiv-signUp');
var gameDiv = document.getElementById('gameDiv');
var UI = document.getElementById('UI');

enterButton.onclick = function(){
  // Start audio (browser requires user interaction)
  ambPlayer(Amb.empty);
  bgmPlayer(title_bgm);
  
  // Hide enter screen and show login form
  enterOverlay.style.display = 'none';
  loginOverlay.style.display = 'block';
};

signDivSignIn.onclick = function(){
  socket.send(JSON.stringify({msg:'signIn',name:signDivUsername.value,pass:signDivPassword.value}));
};

signDivSignUp.onclick = function(){
  socket.send(JSON.stringify({msg:'signUp',name:signDivUsername.value,pass:signDivPassword.value}));
};

var signDivSpectate = document.getElementById('signDiv-spectate');
signDivSpectate.onclick = function(){
  socket.send(JSON.stringify({msg:'spectate',name:signDivUsername.value,pass:signDivPassword.value}));
};

// LOGIN CAMERA SYSTEM
var loginCameraSystem = {
  isActive: true,
  currentFalconId: null,
  lockDuration: 10000, // 10 seconds locked on falcon
  pauseDuration: 3000, // 3 seconds stationary
  isLocked: false,
  switchTimer: null,
  cameraX: 0,
  cameraY: 0,
  
  pickRandomFalcon: function() {
    var falcons = [];
    for(var i in Player.list) {
      if(Player.list[i].class === 'Falcon') {
        falcons.push(Player.list[i].id);
      }
    }
    if(falcons.length > 0) {
      var randomIndex = Math.floor(Math.random() * falcons.length);
      return falcons[randomIndex];
    }
    return null;
  },
  
  lockToFalcon: function(falconId) {
    if(!falconId) {
      falconId = this.pickRandomFalcon();
    }
    
    if(falconId && Player.list[falconId]) {
      this.currentFalconId = falconId;
      this.isLocked = true;
      this.cameraX = Player.list[falconId].x;
      this.cameraY = Player.list[falconId].y;
      console.log('Login camera: Locked to falcon', falconId);
      
      // Schedule unlock after lockDuration
      var self = this;
      this.switchTimer = setTimeout(function() {
        self.unlock();
      }, this.lockDuration);
    } else {
      // No falcon found, try again after a delay
      var self = this;
      this.switchTimer = setTimeout(function() {
        self.start();
      }, 1000);
    }
  },
  
  unlock: function() {
    if(!this.isActive) return;
    
    console.log('Login camera: Unlocked, pausing');
    this.isLocked = false;
    // Store current position when unlocking
    if(this.currentFalconId && Player.list[this.currentFalconId]) {
      this.cameraX = Player.list[this.currentFalconId].x;
      this.cameraY = Player.list[this.currentFalconId].y;
    }
    
    // Schedule next falcon lock after pauseDuration
    var self = this;
    this.switchTimer = setTimeout(function() {
      if(self.isActive) {
        self.lockToFalcon(null);
      }
    }, this.pauseDuration);
  },
  
  getCameraPosition: function() {
    if(this.isLocked && this.currentFalconId && Player.list[this.currentFalconId]) {
      // Follow the falcon
      var falcon = Player.list[this.currentFalconId];
      this.cameraX = falcon.x;
      this.cameraY = falcon.y;
    }
    // If not locked, return the stored position (stationary)
    // Ensure we always have valid numbers
    return { 
      x: this.cameraX || 0, 
      y: this.cameraY || 0 
    };
  },
  
  start: function() {
    console.log('Login camera: Starting cinematic mode');
    this.isActive = true;
    // Find a random falcon and start following
    this.lockToFalcon(null);
  },
  
  stop: function() {
    console.log('Login camera: Stopping cinematic mode');
    this.isActive = false;
    this.isLocked = false;
    if(this.switchTimer) {
      clearTimeout(this.switchTimer);
      this.switchTimer = null;
    }
  }
};

// Make it globally accessible
window.loginCameraSystem = loginCameraSystem;

// SPECTATE CAMERA SYSTEM
var spectateCameraSystem = {
  isActive: false,
  currentTargetId: null,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  lockDuration: 5000, // 5 seconds minimum lock time
  lastPriorityLevel: 'other', // Start at lowest priority
  lockStartTime: 0,
  lastTargetCheckTime: 0, // Track when we last checked for new targets
  targetCheckInterval: 1000, // Check for new targets every 1 second
  innaWoods: true, // Can see through heavy forest
  isPanning: false, // Whether we're currently panning to a new target
  isTransitioning: false, // Whether we're transitioning to a new target
  panSpeed: 25, // Base panning speed
  lockDistance: 100, // Distance at which we lock onto target
  initialDistance: 0, // Distance when starting to pan to new target
  baseSpeed: 15, // Calculated speed based on initial distance
  
  evaluateCharacterPriority: function(character) {
    if (!character) {
      return null;
    }
    
    // Exclude spectators and Falcons only
    if (character.type === 'spectator' || character.class === 'Falcon') {
      return null;
    }
    
    // Simplified 3-tier priority system
    // Tier 1: COMBAT - Most interesting, highest priority (use action property like the combat icon does)
    if (character.action === 'combat') {
      return 'combat';
    }
    
    // Tier 2: ECONOMIC - Working, fleeing
    if (character.working === true || character.action === 'flee') {
      return 'economic';
    }
    
    // Tier 3: OTHER - Moving, idle, etc.
    return 'other';
  },
  
  selectBestTarget: function() {
    let combatTargets = [];
    let economicTargets = [];
    let otherTargets = [];
    
    for (var id in Player.list) {
      var character = Player.list[id];
      var priority = this.evaluateCharacterPriority(character);
      
      if (priority === 'combat') {
        combatTargets.push(id);
      } else if (priority === 'economic') {
        economicTargets.push(id);
      } else if (priority === 'other') {
        otherTargets.push(id);
      }
    }
    
    // Return best available target by priority tier
    if (combatTargets.length > 0) {
      // Pick random combat target to add variety
      var randomIndex = Math.floor(Math.random() * combatTargets.length);
      return { id: combatTargets[randomIndex], priority: 'combat' };
    } else if (economicTargets.length > 0) {
      var randomIndex = Math.floor(Math.random() * economicTargets.length);
      return { id: economicTargets[randomIndex], priority: 'economic' };
    } else if (otherTargets.length > 0) {
      var randomIndex = Math.floor(Math.random() * otherTargets.length);
      return { id: otherTargets[randomIndex], priority: 'other' };
    }
    
    return { id: null, priority: null };
  },
  
  setNewTarget: function(targetId) {
    if (!targetId || !Player.list[targetId]) {
      return;
    }
    
    var target = Player.list[targetId];
    
    // Calculate initial distance to new target
    var dx = target.x - this.cameraX;
    var dy = target.y - this.cameraY;
    this.initialDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Only recalculate speed if we're not already panning
    // If we're mid-pan, keep the current speed and just redirect
    if (!this.isTransitioning || this.baseSpeed === 0) {
      // Calculate speed based on initial distance
      // Within viewport (~800 units): moderate glide (15-25 speed)
      // Across map (2000+ units): fast pan (40-80 speed)
      if (this.initialDistance < 800) {
        // Close by - moderate glide
        this.baseSpeed = 15 + (this.initialDistance / 800) * 10; // 15-25
      } else if (this.initialDistance < 2000) {
        // Medium distance - fast speed
        this.baseSpeed = 25 + ((this.initialDistance - 800) / 1200) * 15; // 25-40
      } else {
        // Far away - very fast pan
        this.baseSpeed = 40 + ((this.initialDistance - 2000) / 2000) * 40; // 40-80, capped
        this.baseSpeed = Math.min(this.baseSpeed, 80); // Max speed 80
      }
    }
    // If already transitioning, keep current baseSpeed and just change target
    // This creates smooth redirection without jerky speed changes
    
    // Mark that we're transitioning to a new target
    this.isTransitioning = true;
    this.currentTargetId = targetId;
  },
  
  updateCamera: function() {
    if (!this.currentTargetId || !Player.list[this.currentTargetId]) {
      return;
    }
    
    var target = Player.list[this.currentTargetId];
    
    // Calculate distance to target
    var dx = target.x - this.cameraX;
    var dy = target.y - this.cameraY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    
    // Determine movement style based on distance
    if (dist > 300) {
      // Far away - use directional baseSpeed for fast, smooth approach
      var dirX = dx / dist;
      var dirY = dy / dist;
      this.cameraX += dirX * this.baseSpeed;
      this.cameraY += dirY * this.baseSpeed;
      this.isPanning = true;
      this.isTransitioning = true;
    } else if (dist > 100) {
      // Medium distance - blend between baseSpeed and interpolation
      var dirX = dx / dist;
      var dirY = dy / dist;
      var blendFactor = (dist - 100) / 200; // 1.0 at 300, 0.0 at 100
      var speedMultiplier = 0.2 + (blendFactor * 0.8); // 0.2 to 1.0
      this.cameraX += dirX * this.baseSpeed * speedMultiplier;
      this.cameraY += dirY * this.baseSpeed * speedMultiplier;
      this.isPanning = true;
      this.isTransitioning = true;
    } else {
      // Close - use smooth interpolation for stable following
      var followSpeed = 0.18; // 18% interpolation per frame
      this.cameraX += dx * followSpeed;
      this.cameraY += dy * followSpeed;
      this.isPanning = (dist > 2);
      this.isTransitioning = false;
    }
    
    // Smoothly interpolate z-level
    var targetZ = target.z || 0;
    if (Math.abs(this.cameraZ - targetZ) > 0.1) {
      this.cameraZ = this.cameraZ + (targetZ - this.cameraZ) * 0.2;
    } else {
      this.cameraZ = targetZ;
    }
  },
  
  update: function() {
    if (!this.isActive) return;
    
    var currentTime = Date.now();
    var lockElapsed = currentTime - this.lockStartTime;
    var timeSinceLastCheck = currentTime - this.lastTargetCheckTime;
    
    // Get current target's priority
    var currentPriority = null;
    if (this.currentTargetId && Player.list[this.currentTargetId]) {
      currentPriority = this.evaluateCharacterPriority(Player.list[this.currentTargetId]);
    }
    
    // Check if current target is invalid
    if (currentPriority === null) {
      // Current target is invalid, find new one immediately
      this.lastTargetCheckTime = currentTime;
      var newTarget = this.selectBestTarget();
      if (newTarget.id) {
        this.setNewTarget(newTarget.id);
        this.lastPriorityLevel = newTarget.priority;
        this.lockStartTime = currentTime;
      }
      this.updateCamera();
      return;
    }
    
    // Only check for new targets every 1 second to avoid lag
    var shouldCheckTargets = (timeSinceLastCheck >= this.targetCheckInterval);
    
    if (shouldCheckTargets) {
      this.lastTargetCheckTime = currentTime;
      var newTarget = this.selectBestTarget();
      
      // RULE 1: COMBAT is king - always switch to combat immediately from any lower priority
      if (newTarget.priority === 'combat' && this.lastPriorityLevel !== 'combat') {
        this.setNewTarget(newTarget.id);
        this.lastPriorityLevel = 'combat';
        this.lockStartTime = currentTime;
      }
      // RULE 2: If watching combat, stay locked until combat ends
      else if (this.lastPriorityLevel === 'combat') {
        if (currentPriority === 'combat') {
          // Still in combat - only switch to another combat after 30s for variety
          if (newTarget.priority === 'combat' && newTarget.id !== this.currentTargetId && lockElapsed >= 30000) {
            this.setNewTarget(newTarget.id);
            this.lockStartTime = currentTime;
          }
        } else {
          // Combat ended - immediately look for new combat, otherwise start timer
          if (newTarget.priority === 'combat') {
            this.setNewTarget(newTarget.id);
            this.lastPriorityLevel = 'combat';
            this.lockStartTime = currentTime;
          } else {
            // No more combat available - switch to next best after brief delay
            this.lastPriorityLevel = currentPriority;
            this.lockStartTime = currentTime;
          }
        }
      }
      // RULE 3: If watching economic, switch to combat immediately or other economic after 10s
      else if (this.lastPriorityLevel === 'economic') {
        if (lockElapsed >= 10000 && newTarget.id) {
          this.setNewTarget(newTarget.id);
          this.lastPriorityLevel = newTarget.priority;
          this.lockStartTime = currentTime;
        }
      }
      // RULE 4: If watching other, cycle every 5 seconds
      else {
        if (lockElapsed >= this.lockDuration && newTarget.id) {
          this.setNewTarget(newTarget.id);
          this.lastPriorityLevel = newTarget.priority;
          this.lockStartTime = currentTime;
        }
      }
    }
    
    // Always update camera position to follow target (every frame)
    this.updateCamera();
  },
  
  start: function() {
    this.isActive = true;
    var startTime = Date.now();
    
    // Find initial target
    var initialTarget = this.selectBestTarget();
    
    if (initialTarget.id) {
      // Initialize camera at target position first
      var target = Player.list[initialTarget.id];
      if (target) {
        this.cameraX = target.x;
        this.cameraY = target.y;
        this.cameraZ = target.z || 0;
      }
      
      // Now set the target (this will calculate baseSpeed, but since we're already at target, it won't matter)
      this.currentTargetId = initialTarget.id;
      this.lastPriorityLevel = initialTarget.priority;
      this.baseSpeed = 15; // Default speed for initial target
    } else {
      // No valid target - default to map center
      this.cameraX = (mapSize * tileSize) / 2;
      this.cameraY = (mapSize * tileSize) / 2;
      this.cameraZ = 0;
    }
    
    this.lockStartTime = startTime;
    this.lastTargetCheckTime = startTime;
  },
  
  stop: function() {
    this.isActive = false;
    this.currentTargetId = null;
  },
  
  getCameraPosition: function() {
    return {
      x: this.cameraX,
      y: this.cameraY,
      z: this.cameraZ
    };
  }
};

window.spectateCameraSystem = spectateCameraSystem;

// God Mode Camera System (similar to loginCameraSystem)
var godModeCamera = {
  isActive: false,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  speed: 16, // Movement speed (fast spectator mode)
  factionHQs: [],
  currentFactionIndex: -1, // -1 means not viewing a faction
  needsMusicUpdate: false, // Flag to update music after exiting god mode
  
  // Movement flags (like player movement)
  pressingUp: false,
  pressingDown: false,
  pressingLeft: false,
  pressingRight: false,
  
  getCameraPosition: function() {
    return {
      x: this.cameraX,
      y: this.cameraY,
      z: this.cameraZ
    };
  },
  
  start: function(startX, startY, startZ, factionHQs) {
    console.log('God mode camera: Starting spectator mode');
    this.isActive = true;
    this.cameraX = startX;
    this.cameraY = startY;
    this.cameraZ = startZ;
    this.factionHQs = factionHQs || [];
    this.currentFactionIndex = -1;
    this.pressingUp = false;
    this.pressingDown = false;
    this.pressingLeft = false;
    this.pressingRight = false;
    console.log('Loaded', this.factionHQs.length, 'faction HQs');
  },
  
  stop: function() {
    console.log('God mode camera: Stopping spectator mode');
    this.isActive = false;
    this.factionHQs = [];
    this.currentFactionIndex = -1;
    this.pressingUp = false;
    this.pressingDown = false;
    this.pressingLeft = false;
    this.pressingRight = false;
    // needsMusicUpdate flag is set when stopping, will be checked in next update
  },
  
  update: function() {
    if(!this.isActive) return;
    
    // Smooth camera movement based on pressed keys
    if(this.pressingUp) {
      this.cameraY -= this.speed;
    }
    if(this.pressingDown) {
      this.cameraY += this.speed;
    }
    if(this.pressingLeft) {
      this.cameraX -= this.speed;
    }
    if(this.pressingRight) {
      this.cameraX += this.speed;
    }
    
    // Keep within map bounds
    var maxPos = mapSize * tileSize;
    this.cameraX = Math.max(0, Math.min(maxPos, this.cameraX));
    this.cameraY = Math.max(0, Math.min(maxPos, this.cameraY));
  },
  
  changeZ: function(dz) {
    this.cameraZ = Math.max(-3, Math.min(3, this.cameraZ + dz));
    console.log('God mode z-layer:', this.cameraZ);
    
    // Update music/ambience when z-level changes
    var b = (this.cameraZ == 1 || this.cameraZ == 2) ? getBuilding(this.cameraX, this.cameraY) : null;
    getBgm(this.cameraX, this.cameraY, this.cameraZ, b);
  },
  
  cycleFaction: function(direction) {
    console.log('cycleFaction called, direction:', direction, 'HQs available:', this.factionHQs.length);
    
    if(this.factionHQs.length === 0) {
      console.log('No faction HQs available');
      if(chatMessages) {
        chatMessages.innerHTML += '<div>⚠️ No faction HQs available</div>';
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
      return;
    }
    
    // Cycle through factions
    if(direction > 0) {
      // Right arrow - next faction
      this.currentFactionIndex++;
      if(this.currentFactionIndex >= this.factionHQs.length) {
        this.currentFactionIndex = 0;
      }
    } else {
      // Left arrow - previous faction
      this.currentFactionIndex--;
      if(this.currentFactionIndex < 0) {
        this.currentFactionIndex = this.factionHQs.length - 1;
      }
    }
    
    console.log('New faction index:', this.currentFactionIndex);
    
    // Snap to faction HQ
    var faction = this.factionHQs[this.currentFactionIndex];
    if(!faction) {
      console.error('Faction not found at index:', this.currentFactionIndex);
      return;
    }
    
    console.log('Snapping to faction:', faction);
    this.cameraX = faction.x;
    this.cameraY = faction.y;
    this.cameraZ = faction.z;
    
    // Update music/ambience for new faction HQ location and z-level
    var b = (this.cameraZ == 1 || this.cameraZ == 2) ? getBuilding(this.cameraX, this.cameraY) : null;
    getBgm(this.cameraX, this.cameraY, this.cameraZ, b);
    
    // Display faction name in chat
    if(chatMessages) {
      chatMessages.innerHTML += '<div>📍 Viewing: ' + faction.name + ' HQ</div>';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    console.log('Camera now at:', this.cameraX, this.cameraY, 'z=' + this.cameraZ);
  }
};

window.godModeCamera = godModeCamera;

// Login camera will be started automatically when preview data is received

// CHAT & COMMANDS
var chatMessagesContainer = document.getElementById('chat-messages-container');
var chatMessages = document.getElementById('chat-messages');
var chatInputWrapper = document.getElementById('chat-input-wrapper');
var chatInput = document.getElementById('chat-input');
var chatForm = document.getElementById('chat-form');
var chatHideTimer = null;

// INVENTORY UI
var inventoryButton = document.getElementById('inventory-button');
var inventoryPopup = document.getElementById('inventory-popup');
var inventoryGrid = document.getElementById('inventory-grid');
var inventoryClose = document.getElementById('inventory-close');
var characterButton = document.getElementById('character-button');
var buildMenuButton = document.getElementById('build-menu-button');

// CHARACTER UI
var characterPopup = document.getElementById('character-popup');
var characterClose = document.getElementById('character-close');

// CONTEXT MENU UI
var itemContextMenu = document.getElementById('item-context-menu');
var dropQuantityModal = document.getElementById('drop-quantity-modal');
var dropQuantityInput = document.getElementById('drop-quantity-input');
var dropConfirmBtn = document.getElementById('drop-confirm-btn');
var dropCancelBtn = document.getElementById('drop-cancel-btn');

// Store current context for item actions
var currentContextItem = null;

// Character sheet update interval
var characterSheetUpdateInterval = null;

// Prevent multiple rapid clicks on same item
var lastClickedItem = null;
var lastClickTime = 0;

// MARKET UI
var marketPopup = document.getElementById('market-popup');
var marketClose = document.getElementById('market-close');
var marketOrderbook = document.getElementById('market-orderbook');
var marketPlayerOrdersList = document.getElementById('market-player-orders-list');

// WORLDMAP UI
var worldmapPopup = document.getElementById('worldmap-popup');
var worldmapClose = document.getElementById('worldmap-close');
var worldmapCanvas = document.getElementById('worldmap-canvas');
var worldmapCtx = worldmapCanvas ? worldmapCanvas.getContext('2d') : null;

// Build Menu variables
var buildMenuPopup = document.getElementById('build-menu-popup');
var buildMenuClose = document.getElementById('build-menu-close');
var buildMenuContent = document.getElementById('build-menu-content');
var buildPreviewMode = false;
var buildPreviewType = null;
var buildPreviewData = null;
var buildPreviewValidation = null;

// Mouse position tracking
var mousePos = { x: 0, y: 0 };

var marketItemSelect = document.getElementById('market-item-select');
var marketAmount = document.getElementById('market-amount');
var marketPrice = document.getElementById('market-price');
var marketBuyBtn = document.getElementById('market-buy-btn');
var marketSellBtn = document.getElementById('market-sell-btn');
var currentMarketData = null;

// Chat auto-hide functionality
function resetChatHideTimer(){
  // Clear existing timer
  if(chatHideTimer){
    clearTimeout(chatHideTimer);
  }
  
  // Show chat messages container
  if(chatMessagesContainer){
    chatMessagesContainer.classList.remove('hidden');
    chatMessagesContainer.style.display = 'block';
  }
  
  // Set new timer to hide entire messages box after 5 seconds
  chatHideTimer = setTimeout(function(){
    if(chatMessagesContainer && document.activeElement !== chatInput){
      chatMessagesContainer.classList.add('hidden');
      // Actually hide the element after transition
      setTimeout(function(){
        if(chatMessagesContainer.classList.contains('hidden')){
          chatMessagesContainer.style.display = 'none';
        }
      }, 300);
    }
  }, 5000);
}

// Chat focus/blur handlers
chatInput.addEventListener('focus', function(){
  // Show chat messages when focusing input
  if(chatMessagesContainer){
    chatMessagesContainer.classList.remove('hidden');
    chatMessagesContainer.style.display = 'block';
  }
  // Clear hide timer while typing
  if(chatHideTimer){
    clearTimeout(chatHideTimer);
  }
});

chatInput.addEventListener('blur', function(){
  // Restart hide timer when unfocusing
  resetChatHideTimer();
});

chatForm.onsubmit = function(e){
  e.preventDefault();
  
  // If input is empty or only whitespace, just blur
  if(!chatInput.value || chatInput.value.trim() === ''){
    chatInput.blur();
    return;
  }
  
  // If in spectate mode, redirect all messages to spectator chat
  if(spectateCameraSystem && spectateCameraSystem.isActive) {
    console.log('Sending spectator chat:', chatInput.value);
    socket.send(JSON.stringify({
      msg:'spectatorChat',
      message:chatInput.value
    }));
  } else if(chatInput.value[0] == '/'){ // command
    socket.send(JSON.stringify({
      msg:'evalCmd',
      id:selfId,
      cmd:chatInput.value.slice(1),
      world:world
    }));
  } else if(chatInput.value[0] == '@'){ // private message
    socket.send(JSON.stringify({
      msg:'pmToServer',
      recip:chatInput.value.slice(1,chatInput.value.indexOf(' ')),
      message:chatInput.value.slice(chatInput.value.indexOf(' ') + 1)
    }));
  } else { // chat
    socket.send(JSON.stringify({
      msg:'msgToServer',
      name:Player.list[selfId].name,
      message:chatInput.value
    }));
  }
  chatInput.value = '';
  chatInput.blur(); // Auto-deselect after sending
};

// Inventory button click handler
if(inventoryButton){
  inventoryButton.onclick = function(){
    if(inventoryPopup.style.display === 'none' || !inventoryPopup.style.display){
      inventoryPopup.style.display = 'block';
      updateInventoryDisplay();
    } else {
      inventoryPopup.style.display = 'none';
    }
  };
}

if(inventoryClose){
  inventoryClose.onclick = function(){
    inventoryPopup.style.display = 'none';
  };
}

// Character button click handler
if(characterButton){
  characterButton.onclick = function(){
    if(characterPopup.style.display === 'none' || !characterPopup.style.display){
      characterPopup.style.display = 'block';
      updateCharacterDisplay();
      // Start real-time updates
      if(!characterSheetUpdateInterval){
        characterSheetUpdateInterval = setInterval(function(){
          if(characterPopup.style.display === 'block'){
            updateCharacterDisplay();
          }
        }, 1000);
      }
    } else {
      characterPopup.style.display = 'none';
      // Stop real-time updates
      if(characterSheetUpdateInterval){
        clearInterval(characterSheetUpdateInterval);
        characterSheetUpdateInterval = null;
      }
    }
  };
}

// Build menu button click handler
if(buildMenuButton){
  buildMenuButton.onclick = function(){
    if(buildMenuPopup && buildMenuPopup.style.display === 'block'){
      buildMenuPopup.style.display = 'none';
    } else {
      // Request build menu data from server
      socket.send(JSON.stringify({msg:'requestBuildMenu'}));
    }
  };
}

// Character button handler
if(characterClose){
  characterClose.onclick = function(){
    characterPopup.style.display = 'none';
    // Stop real-time updates
    if(characterSheetUpdateInterval){
      clearInterval(characterSheetUpdateInterval);
      characterSheetUpdateInterval = null;
    }
  };
}

// Context menu handlers
if(dropCancelBtn){
  dropCancelBtn.onclick = function(){
    dropQuantityModal.style.display = 'none';
    currentContextItem = null;
  };
}

// Hide context menu when clicking outside
document.addEventListener('click', function(e){
  if(itemContextMenu && itemContextMenu.style.display === 'block'){
    if(!itemContextMenu.contains(e.target)){
      itemContextMenu.style.display = 'none';
    }
  }
});

// WorldMap close button handler
if(worldmapClose){
  worldmapClose.onclick = function(){
    worldmapPopup.style.display = 'none';
  };
}

// Build Menu close button
if(buildMenuClose){
  buildMenuClose.onclick = function(){
    buildMenuPopup.style.display = 'none';
    // Cancel preview mode if active
    if(buildPreviewMode){
      buildPreviewMode = false;
      buildPreviewType = null;
      buildPreviewData = null;
    }
  };
}

// Market UI event handlers
if(marketClose){
  marketClose.onclick = function(){
    marketPopup.style.display = 'none';
  };
}

if(marketBuyBtn){
  marketBuyBtn.onclick = function(){
    var item = marketItemSelect.value;
    var amount = parseInt(marketAmount.value);
    var price = parseInt(marketPrice.value);
    
    if(!item || isNaN(amount) || isNaN(price)){
      alert('Please fill in all fields');
      return;
    }
    
    if(amount <= 0 || price <= 0){
      alert('Amount and price must be greater than 0');
      return;
    }
    
    socket.send(JSON.stringify({msg:'evalCmd',cmd:'/buy ' + amount + ' ' + item + ' ' + price}));
    
    // Clear inputs
    marketAmount.value = '';
    marketPrice.value = '';
    
    // Close market after short delay to see confirmation
    setTimeout(function(){ marketPopup.style.display = 'none'; }, 500);
  };
}

if(marketSellBtn){
  marketSellBtn.onclick = function(){
    var item = marketItemSelect.value;
    var amount = parseInt(marketAmount.value);
    var price = parseInt(marketPrice.value);
    
    if(!item || isNaN(amount) || isNaN(price)){
      alert('Please fill in all fields');
      return;
    }
    
    if(amount <= 0 || price <= 0){
      alert('Amount and price must be greater than 0');
      return;
    }
    
    socket.send(JSON.stringify({msg:'evalCmd',cmd:'/sell ' + amount + ' ' + item + ' ' + price}));
    
    // Clear inputs
    marketAmount.value = '';
    marketPrice.value = '';
    
    // Close market after short delay to see confirmation
    setTimeout(function(){ marketPopup.style.display = 'none'; }, 500);
  };
}

// Helper function to get the appropriate image for an item based on type and quantity
function getInventoryItemImage(itemType, qty){
  // Convert to lowercase for consistent comparison
  var type = itemType.toLowerCase();
  
  if(type === 'worldmap'){
    return Img.map;
  } else if(type === 'dague' || type === 'huntingknife'){
    return qty > 2 ? Img.dagger3 : qty > 1 ? Img.dagger2 : Img.dagger1;
  } else if(type === 'rondel'){
    return Img.dagger2;
  } else if(type === 'misericorde'){
    return Img.dagger3;
  } else if(type === 'bastardsword'){
    return Img.sword1;
  } else if(type === 'longsword' || type === 'zweihander'){
    return Img.sword2;
  } else if(type === 'morallta'){
    return Img.sword3;
  } else if(type === 'bow'){
    return Img.bow;
  } else if(type === 'welshlongbow'){
    return Img.longbow;
  } else if(type === 'knightlance' || type === 'rusticlance'){
    return Img.lance1;
  } else if(type === 'paladinlance'){
    return Img.lance2;
  } else if(type === 'brigandine' || type === 'lamellar'){
    return Img.leathergarb;
  } else if(type === 'maille' || type === 'hauberk' || type === 'brynja'){
    return Img.chainmail;
  } else if(type === 'cuirass' || type === 'steelplate'){
    return Img.plate1;
  } else if(type === 'greenwichplate'){
    return Img.plate2;
  } else if(type === 'gothicplate'){
    return Img.plate3;
  } else if(type === 'clericrobe'){
    return Img.robe1;
  } else if(type === 'monkcowl'){
    return Img.robe2;
  } else if(type === 'blackcloak'){
    return Img.robe3;
  } else if(type === 'tome'){
    return Img.tome;
  } else if(type === 'runicscroll'){
    return Img.scroll;
  } else if(type === 'sacredtext'){
    return Img.sacredtext;
  } else if(type === 'stoneaxe' || type === 'ironaxe'){
    return Img.axe;
  } else if(type === 'pickaxe'){
    return Img.pickaxe;
  } else if(type === 'key'){
    return Img.key;
  } else if(type === 'saison' || type === 'mead' || type === 'beer' || type === 'flanders' || type === 'bieredegarde' || type === 'bordeaux' || type === 'bourgogne' || type === 'chianti'){
    return qty > 2 ? Img.beers : Img.beer;
  } else if(type === 'wood'){
    return qty > 9 ? Img.wood3 : qty > 4 ? Img.wood2 : Img.wood1;
  } else if(type === 'stone'){
    return qty > 9 ? Img.stone2 : Img.stone1;
  } else if(type === 'grain'){
    return qty > 9 ? Img.grain3 : qty > 4 ? Img.grain2 : Img.grain1;
  } else if(type === 'ironore'){
    return qty > 4 ? Img.ore2 : Img.ore1;
  } else if(type === 'iron'){
    return qty > 4 ? Img.ironbars : Img.ironbar;
  } else if(type === 'steel'){
    return qty > 4 ? Img.steelbars : Img.steelbar;
  } else if(type === 'boarhide'){
    return qty > 4 ? Img.boarhides : Img.boarhide;
  } else if(type === 'leather'){
    return qty > 4 ? Img.leathers : Img.leather;
  } else if(type === 'silverore'){
    return Img.ore1;
  } else if(type === 'silver'){
    var silverImg = [Img.silver1,Img.silver2,Img.silver3,Img.silver4,Img.silver5,Img.silver6,Img.silver7,Img.silver8,Img.silver9];
    if(qty > 999) return Img.silver9;
    else if(qty > 499) return Img.silver8;
    else if(qty > 249) return Img.silver7;
    else if(qty > 99) return Img.silver6;
    else if(qty > 49) return Img.silver5;
    else if(qty > 24) return Img.silver4;
    else if(qty > 9) return Img.silver3;
    else if(qty > 4) return Img.silver2;
    else return Img.silver1;
  } else if(type === 'goldore'){
    return Img.ore2;
  } else if(type === 'gold'){
    if(qty > 999) return Img.gold9;
    else if(qty > 499) return Img.gold8;
    else if(qty > 249) return Img.gold7;
    else if(qty > 99) return Img.gold6;
    else if(qty > 49) return Img.gold5;
    else if(qty > 24) return Img.gold4;
    else if(qty > 9) return Img.gold3;
    else if(qty > 4) return Img.gold2;
    else return Img.gold1;
  } else if(type === 'diamond'){
    return qty > 2 ? Img.diamonds : Img.diamond;
  } else if(type === 'arrows'){
    return Img.arrows;
  } else if(type === 'fish'){
    return qty > 4 ? Img.fishes : Img.fish;
  } else if(type === 'bread'){
    return qty > 4 ? Img.breads : Img.bread;
  } else if(type === 'rawmeat' || type === 'venison' || type === 'lamb' || type === 'boarmeat'){
    return qty > 4 ? Img.rawmeats : Img.rawmeat;
  } else if(type === 'cookedmeat' || type === 'lambchop' || type === 'boarshank' || type === 'venisonloin'){
    return qty > 4 ? Img.cookedmeats : Img.cookedmeat;
  } else if(type === 'poachedfish'){
    return qty > 4 ? Img.poachedfishes : Img.poachedfish;
  } else if(type === 'torch'){
    return Img.torch;
  } else if(type === 'crown'){
    return Img.crown;
  } else if(type === 'relic'){
    return Img.relic;
  }
  return null;
}

// Helper functions for item rarity
function getItemRank(itemType){
  // Map item types to their ranks (matching ItemFactory.js)
  var ranks = {
    // rank 0 - Common
    wood: 0, stone: 0, grain: 0, ironore: 0, iron: 0, silverore: 0, silver: 0,
    goldore: 0, gold: 0, boarhide: 0, leather: 0, pickaxe: 0, stoneaxe: 0,
    ironaxe: 0, huntingknife: 0, torch: 0, dague: 0, rondel: 0, misericorde: 0,
    bow: 0, rusticlance: 0, arrows: 0, brigandine: 0, lamellar: 0, tome: 0,
    bread: 0, meat: 0, fish: 0, lamb: 0, boarmeat: 0, venison: 0, poachedfish: 0,
    mead: 0, saison: 0, barrel: 0, chest: 0, lockedchest: 0, key: 0, worldmap: 0,
    // rank 1 - Rare
    steel: 1, bastardsword: 1, longsword: 1, zweihander: 1, morallta: 1,
    welshlongbow: 1, knightlance: 1, maille: 1, hauberk: 1, brynja: 1, cuirass: 1,
    blackcloak: 1, runicscroll: 1, lambchop: 1, boarshank: 1, venisonloin: 1,
    flanders: 1, bieredegarde: 1,
    // rank 2 - Lore
    diamond: 2, paladinlance: 2, steelplate: 2, greenwichplate: 2, gothicplate: 2,
    sacredtext: 2, bordeaux: 2, bourgogne: 2, chianti: 2,
    // rank 3 - Mythic
    crown: 3, relic: 3
  };
  return ranks[itemType] || 0;
}

function getRarityName(rank){
  var rarities = ['Common', 'Rare', 'Lore', 'Mythic'];
  return rarities[rank] || 'Common';
}

function getRarityColor(rank){
  var colors = {
    0: '#ffffff', // Common - white
    1: '#00ff00', // Rare - green
    2: '#0080ff', // Lore - blue
    3: '#a020f0'  // Mythic - purple
  };
  return colors[rank] || '#ffffff';
}

function getRarityBorderColor(rank){
  var colors = {
    0: '#808080', // Common - gray
    1: '#00ff00', // Rare - green
    2: '#0080ff', // Lore - blue
    3: '#a020f0'  // Mythic - purple
  };
  return colors[rank] || '#808080';
}

// Inventory display function - uses same rendering as dropped items
function updateInventoryDisplay(){
  if(!Player.list[selfId]) return;
  
  var player = Player.list[selfId];
  inventoryGrid.innerHTML = '';
  
  // Display all inventory items - comprehensive list
  var inventoryItems = [
    // Special items
    {type: 'worldmap', name: 'WorldMap'},
    {type: 'crown', name: 'Crown'},
    {type: 'relic', name: 'Relic'},
    {type: 'key', name: 'Key'},
    // Weapons
    {type: 'huntingknife', name: 'HuntingKnife'},
    {type: 'dague', name: 'Dague'},
    {type: 'rondel', name: 'Rondel'},
    {type: 'misericorde', name: 'Misericorde'},
    {type: 'bastardsword', name: 'BastardSword'},
    {type: 'longsword', name: 'Longsword'},
    {type: 'zweihander', name: 'Zweihander'},
    {type: 'morallta', name: 'Morallta'},
    {type: 'bow', name: 'Bow'},
    {type: 'welshlongbow', name: 'WelshLongbow'},
    {type: 'rusticlance', name: 'RusticLance'},
    {type: 'knightlance', name: 'KnightLance'},
    {type: 'paladinlance', name: 'PaladinLance'},
    {type: 'arrows', name: 'Arrows'},
    // Armor
    {type: 'brigandine', name: 'Brigandine'},
    {type: 'lamellar', name: 'Lamellar'},
    {type: 'maille', name: 'Maille'},
    {type: 'hauberk', name: 'Hauberk'},
    {type: 'brynja', name: 'Brynja'},
    {type: 'cuirass', name: 'Cuirass'},
    {type: 'steelplate', name: 'SteelPlate'},
    {type: 'greenwichplate', name: 'GreenwichPlate'},
    {type: 'gothicplate', name: 'GothicPlate'},
    {type: 'clericrobe', name: 'ClericRobe'},
    {type: 'monkcowl', name: 'MonkCowl'},
    {type: 'blackcloak', name: 'BlackCloak'},
    // Tools
    {type: 'pickaxe', name: 'Pickaxe'},
    {type: 'stoneaxe', name: 'StoneAxe'},
    {type: 'ironaxe', name: 'IronAxe'},
    {type: 'torch', name: 'Torch'},
    // Resources
    {type: 'wood', name: 'Wood'},
    {type: 'stone', name: 'Stone'},
    {type: 'grain', name: 'Grain'},
    {type: 'ironore', name: 'IronOre'},
    {type: 'iron', name: 'Iron'},
    {type: 'steel', name: 'Steel'},
    {type: 'silverore', name: 'SilverOre'},
    {type: 'silver', name: 'Silver'},
    {type: 'goldore', name: 'GoldOre'},
    {type: 'gold', name: 'Gold'},
    {type: 'diamond', name: 'Diamond'},
    {type: 'boarhide', name: 'BoarHide'},
    {type: 'leather', name: 'Leather'},
    // Food
    {type: 'bread', name: 'Bread'},
    {type: 'meat', name: 'Meat'},
    {type: 'fish', name: 'Fish'},
    {type: 'lamb', name: 'Lamb'},
    {type: 'boarmeat', name: 'BoarMeat'},
    {type: 'venison', name: 'Venison'},
    {type: 'poachedfish', name: 'PoachedFish'},
    {type: 'lambchop', name: 'LambChop'},
    {type: 'boarshank', name: 'BoarShank'},
    {type: 'venisonloin', name: 'VenisonLoin'},
    // Drinks
    {type: 'mead', name: 'Mead'},
    {type: 'saison', name: 'Saison'},
    {type: 'flanders', name: 'Flanders'},
    {type: 'bieredegarde', name: 'BiereDeGarde'},
    {type: 'bordeaux', name: 'Bordeaux'},
    {type: 'bourgogne', name: 'Bourgogne'},
    {type: 'chianti', name: 'Chianti'},
    // Magic items
    {type: 'tome', name: 'Tome'},
    {type: 'runicscroll', name: 'RunicScroll'},
    {type: 'sacredtext', name: 'SacredText'},
    // Containers
    {type: 'chest', name: 'Chest'},
    {type: 'lockedchest', name: 'LockedChest'}
  ];
  
  inventoryItems.forEach(function(item){
    var count = player.inventory[item.type];
    if(count && count > 0){
      var itemDiv = document.createElement('div');
      itemDiv.className = 'inventory-item';
      
      // Get item rank and set border color
      var rank = getItemRank(item.type);
      var borderColor = getRarityBorderColor(rank);
      var rarityColor = getRarityColor(rank);
      itemDiv.style.borderColor = borderColor;
      itemDiv.style.borderWidth = '2px';
      
      // Store item data for click handlers
      itemDiv.dataset.itemType = item.type;
      itemDiv.dataset.itemName = item.name;
      itemDiv.dataset.itemCount = count;
      itemDiv.dataset.itemRank = rank;
      
      // Create tooltip with rarity color
      var tooltip = document.createElement('div');
      tooltip.className = 'inventory-item-tooltip';
      tooltip.innerHTML = '<span style="color:' + rarityColor + '">[' + item.name + ']</span> x' + count;
      itemDiv.appendChild(tooltip);
      
      // Get the appropriate image based on item type and quantity
      var itemImg = getInventoryItemImage(item.type, count);
      if(itemImg){
        var img = document.createElement('img');
        img.src = itemImg.src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.pointerEvents = 'none'; // Allow clicks to pass through to parent
        itemDiv.appendChild(img);
      } else {
        // Fallback: show item name as text if no image exists
        var placeholder = document.createElement('div');
        placeholder.style.fontSize = '12px';
        placeholder.style.color = rarityColor;
        placeholder.style.textAlign = 'center';
        placeholder.style.padding = '10px';
        placeholder.style.pointerEvents = 'none'; // Allow clicks to pass through to parent
        placeholder.textContent = item.name;
        itemDiv.appendChild(placeholder);
      }
      
      // Left click handler - use/equip item
      (function(itemType, itemName){
        itemDiv.onclick = function(e){
          e.stopPropagation();
          handleItemLeftClick(itemType, itemName);
        };
      })(item.type, item.name);
      
      // Right click handler - context menu
      (function(itemType, itemName, itemCount){
        itemDiv.oncontextmenu = function(e){
          e.preventDefault();
          e.stopPropagation();
          showItemContextMenu(e, itemType, itemName, itemCount);
        };
      })(item.type, item.name, count);
      
      inventoryGrid.appendChild(itemDiv);
    }
  });
  
  if(inventoryGrid.innerHTML === ''){
    inventoryGrid.innerHTML = '<p style="color:#888;padding:20px;">Your inventory is empty</p>';
  }
}

// Item click handlers
function handleItemLeftClick(itemType, itemName){
  // Determine action based on item type
  var rank = getItemRank(itemType);
  
  // Check if it's equippable (weapons, armor)
  var weaponTypes = ['dague', 'rondel', 'misericorde', 'bastardsword', 'longsword', 'zweihander', 'morallta', 'bow', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance', 'huntingknife'];
  var armorTypes = ['brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate', 'greenwichplate', 'gothicplate', 'clericrobe', 'monkcowl', 'blackcloak'];
  var headTypes = ['crown'];
  
  if(weaponTypes.indexOf(itemType) !== -1 || armorTypes.indexOf(itemType) !== -1 || headTypes.indexOf(itemType) !== -1){
    // Equip the item (server will send gearUpdate which triggers inventory refresh)
    socket.send(JSON.stringify({msg: 'equipItem', itemType: itemType}));
  } else {
    // For other items (consumables), use them
    socket.send(JSON.stringify({msg: 'useItem', itemType: itemType}));
    // Refresh inventory after consuming (no gearUpdate for consumables)
    setTimeout(function(){
      updateInventoryDisplay();
      if(characterPopup && characterPopup.style.display === 'block'){
        updateCharacterDisplay();
      }
    }, 100);
  }
}

function showItemContextMenu(e, itemType, itemName, count){
  currentContextItem = {type: itemType, name: itemName, count: count};
  
  // Position and show context menu
  itemContextMenu.style.left = e.pageX + 'px';
  itemContextMenu.style.top = e.pageY + 'px';
  itemContextMenu.style.display = 'block';
  
  // Clear and rebuild context menu
  itemContextMenu.innerHTML = '';
  
  var rank = getItemRank(itemType);
  var weaponTypes = ['dague', 'rondel', 'misericorde', 'bastardsword', 'longsword', 'zweihander', 'morallta', 'bow', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance', 'huntingknife'];
  var armorTypes = ['brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate', 'greenwichplate', 'gothicplate', 'clericrobe', 'monkcowl', 'blackcloak'];
  var headTypes = ['crown'];
  var consumableTypes = ['bread', 'meat', 'fish', 'lamb', 'boarmeat', 'venison', 'poachedfish', 'lambchop', 'boarshank', 'venisonloin', 'mead', 'saison', 'flanders', 'bieredegarde', 'bordeaux', 'bourgogne', 'chianti'];
  
  // Add appropriate action option
  if(weaponTypes.indexOf(itemType) !== -1 || armorTypes.indexOf(itemType) !== -1 || headTypes.indexOf(itemType) !== -1){
    var equipOption = document.createElement('div');
    equipOption.className = 'context-menu-item';
    equipOption.textContent = 'Equip';
    equipOption.onclick = function(){
      socket.send(JSON.stringify({msg: 'equipItem', itemType: itemType}));
      itemContextMenu.style.display = 'none';
      // Server will send gearUpdate which triggers refresh
    };
    itemContextMenu.appendChild(equipOption);
  } else if(consumableTypes.indexOf(itemType) !== -1){
    var useOption = document.createElement('div');
    useOption.className = 'context-menu-item';
    useOption.textContent = 'Use';
    useOption.onclick = function(){
      socket.send(JSON.stringify({msg: 'useItem', itemType: itemType}));
      itemContextMenu.style.display = 'none';
      // Refresh inventory after using consumable
      setTimeout(function(){
        updateInventoryDisplay();
      }, 100);
    };
    itemContextMenu.appendChild(useOption);
  }
  
  // Add drop option
  var dropOption = document.createElement('div');
  dropOption.className = 'context-menu-item';
  dropOption.textContent = 'Drop';
  dropOption.onclick = function(){
    itemContextMenu.style.display = 'none';
    if(count > 1){
      // Show quantity modal
      dropQuantityInput.value = 1;
      dropQuantityInput.max = count;
      dropQuantityModal.style.display = 'block';
    } else {
      // Drop single item immediately
      socket.send(JSON.stringify({msg: 'dropItem', itemType: itemType, quantity: 1}));
      // Refresh inventory
      setTimeout(function(){
        updateInventoryDisplay();
      }, 100);
    }
  };
  itemContextMenu.appendChild(dropOption);
  
  // Add cancel option
  var cancelOption = document.createElement('div');
  cancelOption.className = 'context-menu-item';
  cancelOption.textContent = 'Cancel';
  cancelOption.onclick = function(){
    itemContextMenu.style.display = 'none';
  };
  itemContextMenu.appendChild(cancelOption);
}

// Drop quantity confirm handler
if(dropConfirmBtn){
  dropConfirmBtn.onclick = function(){
    if(currentContextItem){
      var quantity = parseInt(dropQuantityInput.value) || 1;
      quantity = Math.max(1, Math.min(quantity, currentContextItem.count));
      socket.send(JSON.stringify({msg: 'dropItem', itemType: currentContextItem.type, quantity: quantity}));
      dropQuantityModal.style.display = 'none';
      currentContextItem = null;
      // Refresh inventory
      setTimeout(function(){
        updateInventoryDisplay();
      }, 100);
    }
  };
}

// Character display function - full update (call when opening sheet or after equipment changes)
function updateCharacterDisplay(fullUpdate){
  if(!Player.list[selfId]) return;
  
  var player = Player.list[selfId];
  
  // Always update HP/Spirit bars (real-time)
  updateCharacterBars(player);
  
  // Only do full update when needed (opening sheet, equipment change)
  if(fullUpdate !== false){
    // Update character name
    var characterNameEl = document.getElementById('character-name');
    if(characterNameEl){
      characterNameEl.textContent = player.name || 'Character';
    }
    
    // Update house affiliation
    var characterHouseEl = document.getElementById('character-house');
    if(characterHouseEl){
      if(player.house && houseList && houseList[player.house]){
        characterHouseEl.textContent = houseList[player.house].name || 'Neutral';
      } else if(player.kingdom && kingdomList && kingdomList[player.kingdom]){
        characterHouseEl.textContent = kingdomList[player.kingdom].name || 'Neutral';
      } else {
        characterHouseEl.textContent = 'Neutral';
      }
    }
    
    // Update sprite display
    updateCharacterSprite(player);
    
    updateCharacterStats(player);
  }
}

// Update just the HP/Spirit bars (called frequently)
function updateCharacterBars(player){
  // Update HP bar
  var hpPercent = Math.max(0, Math.min(100, (player.hp / player.hpMax) * 100));
  var hpBar = document.getElementById('character-hp-bar');
  var hpText = document.getElementById('character-hp-text');
  if(hpBar){
    hpBar.style.width = hpPercent + '%';
  }
  if(hpText){
    hpText.textContent = Math.floor(player.hp) + ' / ' + Math.floor(player.hpMax);
  }
  
  // Update Spirit bar (show only if player has spirit)
  var spiritContainer = document.getElementById('character-spirit-container');
  if(player.spirit !== null && player.spirit !== undefined){
    if(spiritContainer){
      spiritContainer.style.display = 'block';
      var spiritPercent = Math.max(0, Math.min(100, (player.spirit / player.spiritMax) * 100));
      var spiritBar = document.getElementById('character-spirit-bar');
      var spiritText = document.getElementById('character-spirit-text');
      if(spiritBar){
        spiritBar.style.width = spiritPercent + '%';
      }
      if(spiritText){
        spiritText.textContent = Math.floor(player.spirit) + ' / ' + Math.floor(player.spiritMax);
      }
    }
  } else {
    if(spiritContainer){
      spiritContainer.style.display = 'none';
    }
  }
}

// Update character stats and equipment (called less frequently)
function updateCharacterStats(player){
  
  // Calculate attack and defense from gear
  var attack = 0;
  var defense = 0;
  var strBonus = 0;
  var dexBonus = 0;
  var spiritBonus = 0;
  
  if(player.gear){
    if(player.gear.weapon && player.gear.weapon.dmg){
      attack += player.gear.weapon.dmg;
      strBonus += player.gear.weapon.strengthBonus || 0;
      dexBonus += player.gear.weapon.dexterityBonus || 0;
      spiritBonus += player.gear.weapon.spiritBonus || 0;
    }
    if(player.gear.weapon2 && player.gear.weapon2.dmg){
      attack += player.gear.weapon2.dmg;
      strBonus += player.gear.weapon2.strengthBonus || 0;
      dexBonus += player.gear.weapon2.dexterityBonus || 0;
      spiritBonus += player.gear.weapon2.spiritBonus || 0;
    }
    if(player.gear.armor && player.gear.armor.defense){
      defense += player.gear.armor.defense;
      strBonus += player.gear.armor.strengthBonus || 0;
      dexBonus += player.gear.armor.dexterityBonus || 0;
      spiritBonus += player.gear.armor.spiritBonus || 0;
    }
    if(player.gear.head){
      strBonus += player.gear.head.strengthBonus || 0;
      dexBonus += player.gear.head.dexterityBonus || 0;
      spiritBonus += player.gear.head.spiritBonus || 0;
    }
    if(player.gear.accessory){
      strBonus += player.gear.accessory.strengthBonus || 0;
      dexBonus += player.gear.accessory.dexterityBonus || 0;
      spiritBonus += player.gear.accessory.spiritBonus || 0;
    }
  }
  
  document.getElementById('stat-attack').textContent = attack;
  document.getElementById('stat-defense').textContent = defense;
  
  // Update stats
  var baseStr = player.strength || 1;
  var baseDex = player.dexterity || 0;
  var baseSpirit = player.spirit || 0;
  
  document.getElementById('stat-strength').innerHTML = baseStr + (strBonus > 0 ? ' <span class="stat-bonus">(+' + strBonus + ')</span>' : '');
  document.getElementById('stat-dexterity').innerHTML = baseDex + (dexBonus > 0 ? ' <span class="stat-bonus">(+' + dexBonus + ')</span>' : '');
  document.getElementById('stat-spirit').innerHTML = baseSpirit + (spiritBonus > 0 ? ' <span class="stat-bonus">(+' + spiritBonus + ')</span>' : '');
  
  // Update equipment slots
  updateEquipmentSlot('equipment-weapon', player.gear ? player.gear.weapon : null, 'Main Hand');
  updateEquipmentSlot('equipment-weapon2', player.gear ? player.gear.weapon2 : null, 'Off Hand');
  updateEquipmentSlot('equipment-head', player.gear ? player.gear.head : null, 'Head');
  updateEquipmentSlot('equipment-armor', player.gear ? player.gear.armor : null, 'Body');
  updateEquipmentSlot('equipment-accessory', player.gear ? player.gear.accessory : null, 'Accessory');
}

// Update character sprite display
function updateCharacterSprite(player){
  var canvas = document.getElementById('character-sprite-canvas');
  if(!canvas) return;
  
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw player sprite (use standing down sprite from sprite object)
  if(player.sprite && player.sprite.facedown){
    // Draw sprite centered and scaled up 2x (64x64 -> 128x128)
    ctx.drawImage(player.sprite.facedown, 0, 0, 128, 128);
  } else if(player.sprite){
    // Fallback to any available sprite
    var spriteImg = player.sprite.facedown || player.sprite.faceup || player.sprite.faceleft || player.sprite.faceright;
    if(spriteImg){
      ctx.drawImage(spriteImg, 0, 0, 128, 128);
    }
  }
}

function updateEquipmentSlot(slotId, item, slotLabel){
  var slot = document.getElementById(slotId);
  if(!slot) return;
  
  slot.innerHTML = '<div class="equipment-slot-label">' + slotLabel + '</div>';
  
  if(item && item.name){
    var itemType = item.name.toLowerCase().replace(/\s+/g, '');
    var rank = getItemRank(itemType);
    var borderColor = getRarityBorderColor(rank);
    var rarityColor = getRarityColor(rank);
    
    slot.style.borderColor = borderColor;
    
    var itemContainer = document.createElement('div');
    itemContainer.className = 'equipment-slot-item';
    itemContainer.style.position = 'relative';
    
    // Add tooltip
    var tooltip = document.createElement('div');
    tooltip.className = 'inventory-item-tooltip';
    tooltip.style.opacity = 0;
    tooltip.style.position = 'absolute';
    tooltip.style.bottom = '100%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translateX(-50%)';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.innerHTML = '<span style="color:' + rarityColor + '">[' + item.name + ']</span>';
    
    // Show/hide tooltip on hover
    itemContainer.onmouseenter = function(){
      tooltip.style.opacity = 1;
    };
    itemContainer.onmouseleave = function(){
      tooltip.style.opacity = 0;
    };
    
    itemContainer.appendChild(tooltip);
    
    // Try to get item image
    var itemImg = getInventoryItemImage(itemType, 1);
    if(itemImg){
      var img = document.createElement('img');
      img.src = itemImg.src;
      itemContainer.appendChild(img);
    }
    
    var nameSpan = document.createElement('span');
    nameSpan.className = 'equipment-slot-name';
    nameSpan.style.color = rarityColor;
    nameSpan.textContent = item.name;
    itemContainer.appendChild(nameSpan);
    
    slot.appendChild(itemContainer);
    
    // Add click to unequip
    slot.onclick = function(){
      socket.send(JSON.stringify({msg: 'unequipItem', slot: slotId.replace('equipment-', '')}));
      // Refresh displays
      setTimeout(function(){
        updateCharacterDisplay();
        if(inventoryPopup && inventoryPopup.style.display === 'block'){
          updateInventoryDisplay();
        }
      }, 100);
    };
  } else {
    slot.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    var emptySpan = document.createElement('div');
    emptySpan.className = 'equipment-slot-empty';
    emptySpan.textContent = 'Empty';
    slot.appendChild(emptySpan);
    slot.onclick = null;
  }
}

// WorldMap Rendering Function
function renderWorldMap(terrainData, mapSize, playerX, playerY, playerTileSize) {
  if (!worldmapCtx || !terrainData) return;
  
  // Clear the canvas
  worldmapCtx.clearRect(0, 0, worldmapCanvas.width, worldmapCanvas.height);
  
  // Calculate scale to fit the entire map in the canvas
  var canvasSize = Math.min(worldmapCanvas.width, worldmapCanvas.height);
  var pixelSize = canvasSize / mapSize;
  
  // Function to get terrain color based on value range
  function getTerrainColor(value) {
    if (value == null || value === undefined) return '#449944'; // Default grass
    
    var terrainType = Math.floor(value); // Get the integer part for range (1.5 -> 1)
    
    // Map terrain type to color
    if (terrainType === 0) return '#4466ff';  // Water - blue
    if (terrainType === 1) return '#114411';  // Heavy Forest - dark green
    if (terrainType === 2) return '#1a661a';  // Light Forest - medium-dark green (between heavy forest and old light forest)
    if (terrainType === 3) return '#228822';  // Brush/Grass - medium green (was light forest color)
    if (terrainType === 4) return '#555555';  // Rocks - dark gray
    if (terrainType === 5) return '#999999';  // Mountain - light grey
    if (terrainType === 6) return '#000000';  // Cave entrance - black
    if (terrainType === 7) return '#449944';  // Empty - darker green/grass
    
    // Farm tiles (seed, growing, ready) - darker orange
    if (terrainType >= 8 && terrainType <= 10) return '#dd8822';  // Darker orange
    
    // Other building-related tiles (build markers, doors, floors, roads, etc.)
    if (terrainType >= 11 && terrainType <= 19) return '#442211';  // Dark brown
    
    // Any other unknown values
    return '#449944'; // Default darker green/grass
  }
  
  // Draw terrain
  for (var r = 0; r < mapSize; r++) {
    for (var c = 0; c < mapSize; c++) {
      var terrainValue = (terrainData[r] && terrainData[r][c] !== undefined) ? terrainData[r][c] : 7;
      var color = getTerrainColor(terrainValue);
      
      worldmapCtx.fillStyle = color;
      worldmapCtx.fillRect(
        c * pixelSize,
        r * pixelSize,
        Math.ceil(pixelSize),
        Math.ceil(pixelSize)
      );
    }
  }
  
  // Draw player position as red X
  var playerCol = Math.floor(playerX / playerTileSize);
  var playerRow = Math.floor(playerY / playerTileSize);
  
  // Draw X marker - much larger and bolder
  worldmapCtx.strokeStyle = '#ff0000';
  worldmapCtx.lineWidth = Math.max(3, pixelSize * 1.2);
  worldmapCtx.lineCap = 'round';
  
  var markerSize = pixelSize * 5; // Increased from 1.5 to 5
  var centerX = (playerCol + 0.5) * pixelSize;
  var centerY = (playerRow + 0.5) * pixelSize;
  
  // Draw X
  worldmapCtx.beginPath();
  worldmapCtx.moveTo(centerX - markerSize / 2, centerY - markerSize / 2);
  worldmapCtx.lineTo(centerX + markerSize / 2, centerY + markerSize / 2);
  worldmapCtx.moveTo(centerX + markerSize / 2, centerY - markerSize / 2);
  worldmapCtx.lineTo(centerX - markerSize / 2, centerY + markerSize / 2);
  worldmapCtx.stroke();
}

// Build Menu rendering function
function renderBuildMenu(buildings, playerWood, playerStone) {
  if (!buildMenuContent) return;
  
  // Clear existing content
  buildMenuContent.innerHTML = '';
  
  // Organize buildings by tier
  var tier1 = [];
  var tier2 = [];
  var tier3 = [];
  
  for (var i = 0; i < buildings.length; i++) {
    var building = buildings[i];
    if (building.tier === 1) {
      tier1.push(building);
    } else if (building.tier === 2) {
      tier2.push(building);
    } else if (building.tier === 3) {
      tier3.push(building);
    }
  }
  
  // Helper function to create building tile
  function createBuildingTile(building) {
    var tile = document.createElement('div');
    tile.className = 'building-tile';
    
    // Check if player can afford
    var canAfford = (playerWood >= building.wood) && (playerStone >= building.stone);
    
    if (!building.unlocked || !canAfford) {
      tile.classList.add('unaffordable');
    }
    
    // Building name
    var nameDiv = document.createElement('div');
    nameDiv.className = 'building-tile-name';
    nameDiv.textContent = building.name;
    tile.appendChild(nameDiv);
    
    // Building costs
    var costsDiv = document.createElement('div');
    costsDiv.className = 'building-tile-costs';
    
    // Wood cost
    var woodCost = document.createElement('div');
    woodCost.className = 'building-cost-item ' + (playerWood >= building.wood ? 'sufficient' : 'insufficient');
    woodCost.innerHTML = '<span>🪵 Wood:</span><span>' + building.wood + '</span>';
    costsDiv.appendChild(woodCost);
    
    // Stone cost
    var stoneCost = document.createElement('div');
    stoneCost.className = 'building-cost-item ' + (playerStone >= building.stone ? 'sufficient' : 'insufficient');
    stoneCost.innerHTML = '<span>🪨 Stone:</span><span>' + building.stone + '</span>';
    costsDiv.appendChild(stoneCost);
    
    tile.appendChild(costsDiv);
    
    // Command
    var commandDiv = document.createElement('div');
    commandDiv.className = 'building-tile-command';
    commandDiv.textContent = '/build ' + building.type;
    tile.appendChild(commandDiv);
    
    // Click handler - only if unlocked and affordable
    if (building.unlocked && canAfford) {
      tile.onclick = (function(bType) {
        return function() {
          // Enter preview mode
          buildPreviewMode = true;
          buildPreviewType = bType;
          buildMenuPopup.style.display = 'none';
          
          // Request preview data from server
          socket.send(JSON.stringify({
            msg: 'startBuildPreview',
            buildingType: bType
          }));
        };
      })(building.type);
    }
    
    return tile;
  }
  
  // Render Tier I
  if (tier1.length > 0) {
    var tier1Header = document.createElement('div');
    tier1Header.className = 'build-tier-header';
    tier1Header.textContent = 'TIER I';
    buildMenuContent.appendChild(tier1Header);
    
    for (var i = 0; i < tier1.length; i++) {
      buildMenuContent.appendChild(createBuildingTile(tier1[i]));
    }
  }
  
  // Render Tier II
  if (tier2.length > 0) {
    var tier2Header = document.createElement('div');
    tier2Header.className = 'build-tier-header';
    tier2Header.textContent = 'TIER II';
    buildMenuContent.appendChild(tier2Header);
    
    for (var i = 0; i < tier2.length; i++) {
      buildMenuContent.appendChild(createBuildingTile(tier2[i]));
    }
  }
  
  // Render Tier III
  if (tier3.length > 0) {
    var tier3Header = document.createElement('div');
    tier3Header.className = 'build-tier-header';
    tier3Header.textContent = 'TIER III';
    buildMenuContent.appendChild(tier3Header);
    
    for (var i = 0; i < tier3.length; i++) {
      buildMenuContent.appendChild(createBuildingTile(tier3[i]));
    }
  }
}

// Building Preview Rendering Function
function renderBuildingPreview() {
  if (!buildPreviewMode || !buildPreviewType || !selfId || !Player.list[selfId]) {
    return;
  }
  
  // Get mouse position relative to canvas
  var canvas = document.getElementById('ctx');
  if (!canvas) return;
  
  var rect = canvas.getBoundingClientRect();
  var mouseX = mousePos.x - rect.left;
  var mouseY = mousePos.y - rect.top;
  
  // Convert to world coordinates using viewport offset
  var worldX = mouseX - viewport.offset[0];
  var worldY = mouseY - viewport.offset[1];
  
  // Snap to tile grid - this will be the player's standing position (plot origin [0,0])
  var playerTileX = Math.floor(worldX / tileSize);
  var playerTileY = Math.floor(worldY / tileSize);
  
  // Get building definition for plot
  var buildingDef = getBuildingDefinition(buildPreviewType);
  if (!buildingDef) return;
  
  // Check if all tiles are valid
  var allValid = true;
  var hasAnyInvalid = false;
  
  // Draw preview tiles
  ctx.save();
  ctx.globalAlpha = 0.6;
  
  for (var i = 0; i < buildingDef.plot.length; i++) {
    var plotTile = buildingDef.plot[i];
    // Add offset from player position (which is the origin [0,0] of the building plot)
    var previewTileX = playerTileX + plotTile[0];
    var previewTileY = playerTileY + plotTile[1];
    
    // Convert to screen coordinates using viewport offset
    var screenX = previewTileX * tileSize + viewport.offset[0];
    var screenY = previewTileY * tileSize + viewport.offset[1];
    
    // Determine tile color based on validation
    var tileColor = '#ff6666'; // Default red for blocked
    var isValid = isValidTileForBuilding(previewTileX, previewTileY);
    var isClearable = isClearableTile(previewTileX, previewTileY);
    
    if (isValid || isClearable) {
      tileColor = '#66ff66'; // Green for valid/clearable
    } else {
      tileColor = '#ff6666'; // Red for blocked
      hasAnyInvalid = true;
      allValid = false;
    }
    
    // Draw preview tile
    ctx.fillStyle = tileColor;
    ctx.fillRect(screenX, screenY, tileSize, tileSize);
  }
  
  ctx.restore();
  
  // Store current validation state for click handler
  // tileX and tileY represent where the player would stand (the origin of the building plot)
  buildPreviewData = {
    tileX: playerTileX,
    tileY: playerTileY,
    valid: allValid
  };
}

// Helper functions for tile validation
function isValidTileForBuilding(tileX, tileY) {
  // Simplified validation - check if tile is empty or grass
  if (world[0] && world[0][tileY] && world[0][tileY][tileX] !== undefined) {
    var terrainValue = world[0][tileY][tileX];
    var terrainType = Math.floor(terrainValue);
    return terrainType === 7; // Empty/Grass
  }
  return false;
}

function isClearableTile(tileX, tileY) {
  // Check if tile can be cleared (brush, light forest)
  if (world[0] && world[0][tileY] && world[0][tileY][tileX] !== undefined) {
    var terrainValue = world[0][tileY][tileX];
    var terrainType = Math.floor(terrainValue);
    return terrainType === 3 || terrainType === 2; // Brush or Light Forest
  }
  return false;
}

function getBuildingDefinition(buildingType) {
  // Building plot definitions (simplified)
  var buildingPlots = {
    'farm': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
    'hut': [[0,0]], // 1x1
    'cottage': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
    'tavern': [[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 5x4 irregular
    'tower': [[0,0]], // 1x1
    'forge': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
    'fort': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
    'outpost': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
    'monastery': [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2],[0,-3],[1,-3],[2,-3],[3,-3]], // 4x4
    'lumbermill': [[0,0],[1,0]], // 2x1
    'mine': [[0,0],[1,0],[0,-1],[1,-1]], // 2x2
    'dock': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2],[0,-3],[1,-3],[2,-3]], // 3x4
    'stable': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
    'market': [[0,0],[1,0],[2,0],[0,-1],[1,-1],[2,-1],[0,-2],[1,-2],[2,-2]], // 3x3
    'garrison': [[0,0],[1,0],[2,0],[3,0],[0,-1],[1,-1],[2,-1],[3,-1],[0,-2],[1,-2],[2,-2],[3,-2]], // 4x3
    'stronghold': [[2,0],[3,0],[4,0],[5,0],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],[5,-1],[6,-1],[7,-1],[0,-2],[1,-2],[2,-2],[3,-2],[4,-2],[5,-2],[6,-2],[7,-2],[0,-3],[1,-3],[2,-3],[3,-3],[4,-3],[5,-3],[6,-3],[7,-3],[0,-4],[1,-4],[2,-4],[3,-4],[4,-4],[5,-4],[6,-4],[7,-4],[0,-5],[1,-5],[2,-5],[3,-5],[4,-5],[5,-5],[6,-5],[7,-5],[1,-6],[2,-6],[3,-6],[4,-6],[5,-6],[6,-6],[7,-6],[1,-7],[2,-7],[3,-7],[4,-7],[5,-7],[6,-7],[7,-7]], // Large irregular
    'wall': [[0,0]], // 1x1
    'gate': [[0,0]], // 1x1
    'guardtower': [[0,0],[1,0],[0,-1],[1,-1]] // 2x2
  };
  
  return {
    plot: buildingPlots[buildingType] || [[0,0]]
  };
}

function isValidBuildingPlacement(tileX, tileY) {
  if (!buildPreviewType) return false;
  
  var buildingDef = getBuildingDefinition(buildPreviewType);
  if (!buildingDef) return false;
  
  // Check all tiles in the building plot
  for (var i = 0; i < buildingDef.plot.length; i++) {
    var plotTile = buildingDef.plot[i];
    var checkTileX = tileX + plotTile[0];
    var checkTileY = tileY + plotTile[1];
    
    // Check if tile is valid or clearable
    if (!isValidTileForBuilding(checkTileX, checkTileY) && !isClearableTile(checkTileX, checkTileY)) {
      return false;
    }
  }
  
  return true;
}

// Market UI Functions
function getItemEmoji(itemType){
  var emojis = {
    grain: '🌾', wood: '🪵', stone: '🪨', ironore: '⛏️', iron: '🔩',
    silverore: '✨', silver: '💍', goldore: '⭐', gold: '👑', diamond: '💎',
    bread: '🍞', fish: '🐟', torch: '🔦', arrows: '🏹', beer: '🍺'
  };
  return emojis[itemType] || '📦';
}

function updateMarketDisplay(){
  if(!currentMarketData) return;
  
  var orderbook = currentMarketData.orderbook;
  var playerOrders = currentMarketData.playerOrders;
  
  // Clear displays
  marketOrderbook.innerHTML = '';
  marketPlayerOrdersList.innerHTML = '';
  
  // Display orderbook
  var resources = Object.keys(orderbook).sort();
  
  for(var r in resources){
    var resource = resources[r];
    var book = orderbook[resource];
    
    if(book.bids.length > 0 || book.asks.length > 0){
      var resourceBlock = document.createElement('div');
      resourceBlock.className = 'market-resource-block';
      
      var emoji = getItemEmoji(resource);
      var title = document.createElement('h4');
      title.style.margin = '0 0 10px 0';
      title.textContent = emoji + ' ' + resource.toUpperCase();
      resourceBlock.appendChild(title);
      
      // Sort and display sell orders (asks - low to high)
      var sortedAsks = book.asks.slice().sort(function(a, b){ return a.price - b.price; });
      if(sortedAsks.length > 0){
        var sellHeader = document.createElement('div');
        sellHeader.style.color = '#ff6666';
        sellHeader.style.fontWeight = 'bold';
        sellHeader.style.marginBottom = '5px';
        sellHeader.textContent = 'SELL ORDERS';
        resourceBlock.appendChild(sellHeader);
        
        var showAsks = sortedAsks.slice(0, 3);
        for(var i in showAsks){
          var ask = showAsks[i];
          var orderDiv = document.createElement('div');
          orderDiv.className = 'market-order sell';
          orderDiv.textContent = ask.amount + ' @ ' + ask.price + ' silver';
          resourceBlock.appendChild(orderDiv);
        }
        
        if(sortedAsks.length > 3){
          var more = document.createElement('div');
          more.style.fontSize = '12px';
          more.style.color = '#888';
          more.textContent = '... +' + (sortedAsks.length - 3) + ' more';
          resourceBlock.appendChild(more);
        }
      }
      
      // Sort and display buy orders (bids - high to low)
      var sortedBids = book.bids.slice().sort(function(a, b){ return b.price - a.price; });
      if(sortedBids.length > 0){
        var buyHeader = document.createElement('div');
        buyHeader.style.color = '#66ff66';
        buyHeader.style.fontWeight = 'bold';
        buyHeader.style.marginTop = '10px';
        buyHeader.style.marginBottom = '5px';
        buyHeader.textContent = 'BUY ORDERS';
        resourceBlock.appendChild(buyHeader);
        
        var showBids = sortedBids.slice(0, 3);
        for(var i in showBids){
          var bid = showBids[i];
          var orderDiv = document.createElement('div');
          orderDiv.className = 'market-order buy';
          orderDiv.textContent = bid.amount + ' @ ' + bid.price + ' silver';
          resourceBlock.appendChild(orderDiv);
        }
        
        if(sortedBids.length > 3){
          var more = document.createElement('div');
          more.style.fontSize = '12px';
          more.style.color = '#888';
          more.textContent = '... +' + (sortedBids.length - 3) + ' more';
          resourceBlock.appendChild(more);
        }
      }
      
      marketOrderbook.appendChild(resourceBlock);
    }
  }
  
  if(marketOrderbook.innerHTML === ''){
    marketOrderbook.innerHTML = '<p style="color:#888;padding:20px;">No active orders in this market</p>';
  }
  
  // Display player's orders
  if(playerOrders && playerOrders.length > 0){
    for(var i in playerOrders){
      var order = playerOrders[i];
      var orderDiv = document.createElement('div');
      orderDiv.className = 'player-order';
      
      var emoji = getItemEmoji(order.resource);
      var typeColor = order.type === 'buy' ? '#66ff66' : '#ff6666';
      var typeText = order.type.toUpperCase();
      
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'cancel-order-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = function(orderId){
        return function(){
          socket.send(JSON.stringify({msg:'evalCmd',cmd:'/cancel ' + orderId.substr(0,8)}));
          setTimeout(function(){ marketPopup.style.display = 'none'; }, 100);
        };
      }(order.orderId);
      orderDiv.appendChild(cancelBtn);
      
      var orderText = document.createElement('div');
      orderText.innerHTML = '<span style="color:' + typeColor + '">' + typeText + '</span> ' + 
                           emoji + ' ' + order.resource + '<br>' +
                           order.amount + ' @ ' + order.price + ' silver';
      orderDiv.appendChild(orderText);
      
      marketPlayerOrdersList.appendChild(orderDiv);
    }
  } else {
    marketPlayerOrdersList.innerHTML = '<p style="color:#888;padding:10px;font-size:12px;">No active orders</p>';
  }
}

// Auto-focus chat input when Enter is pressed
document.addEventListener('keydown', function(e){
  // In spectate mode, allow Enter for chat and ESC to exit
  if(spectateCameraSystem && spectateCameraSystem.isActive) {
    if(e.key === 'Escape'){
      spectateCameraSystem.stop();
      socket.close();
      location.reload();
      return;
    }
    if(e.key === 'Enter' || e.keyCode === 13){
      if(document.activeElement !== chatInput){
        e.preventDefault();
        chatInput.focus();
      }
    }
    return;
  }
  
  // Block all input during login
  if(loginCameraSystem.isActive) {
    return;
  }
  
  // Close popups on ESC
  if(e.key === 'Escape'){
    if(worldmapPopup && worldmapPopup.style.display === 'block'){
      worldmapPopup.style.display = 'none';
      return;
    }
    if(marketPopup && marketPopup.style.display === 'block'){
      marketPopup.style.display = 'none';
      return;
    }
    if(inventoryPopup && inventoryPopup.style.display === 'block'){
      inventoryPopup.style.display = 'none';
      return;
    }
  }
  
  if(e.key === 'Enter' || e.keyCode === 13){
    // Only focus if not already focused
    if(document.activeElement !== chatInput){
      e.preventDefault();
      chatInput.focus();
    }
  }
});

// GAME

var soundscape = function(x,y,z,b){
  // Check ghost mode first - overrides all other ambience
  if(Player.list[selfId] && Player.list[selfId].ghost){
    ambPlayer(Amb.spirits); // Play spirits.mp3
    return; // Skip other checks
  }
  
  // outdoors
  if(z == 0){
    if(nightfall){
      ambPlayer(Amb.forest);
    } else {
      ambPlayer(Amb.nature);
    }
  } else if(z == -1){
    ambPlayer(Amb.cave);
  } else if(z == 1 || z == 2){
    if(b.type == 'monastery'){
      ambPlayer(Amb.empty);
    } else if(hasFire(z,x,y)){
      if(b.occ < 4){
        ambPlayer(Amb.fire);
      } else if(b.occ < 6){
        ambPlayer(Amb.hush);
      } else {
        ambPlayer(Amb.chatter);
      }
    } else {
      ambPlayer();
    }
  } else if(z == -2){
    if(b.type == 'tavern'){
      ambPlayer(Amb.empty);
    } else {
      ambPlayer(Amb.evil);
    }
  } else if(z == -3){
    ambPlayer(Amb.underwater);
  }
};

var getBgm = function(x,y,z,b){
  // Check ghost mode first - overrides all other music
  if(Player.list[selfId] && Player.list[selfId].ghost){
    // Play Defeat.mp3 once, don't loop
    // Use the global defeat_bgm playlist defined in audioloader.js
    if(AudioCtrl.playlist !== defeat_bgm){
      // Force change to ghost music
      AudioCtrl.playlist = null; // Clear playlist to force change
      bgmPlayer(defeat_bgm, false, false); // Third param = don't loop
    }
    soundscape(x,y,z,{}); // Still handle ghost ambience
    return; // Skip other checks
  }
  
  // If we were in ghost mode, force music change
  if(AudioCtrl.playlist === defeat_bgm){
    AudioCtrl.playlist = null; // Clear playlist to force change on respawn
  }
  
  var building = Building.list[b];
  soundscape(x,y,z,building);
  // outdoors
  if(z == 0){
    if(nightfall && tempus != 'IV.a'){
      bgmPlayer(overworld_night_bgm);
    } else if(tempus == 'IV.a' || tempus == 'V.a' || tempus == 'VI.a' ||
    tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'){
      // morning
      bgmPlayer(overworld_morning_bgm);
    } else {
      // night
      bgmPlayer(overworld_day_bgm);
    }
  } else if(z == -1){
    // cave
    bgmPlayer(cave_bgm);
    // indoor
  } else if(z == 1 || z == 2){
    if(building.type == 'stronghold'){
      if(nightfall){
        bgmPlayer(stronghold_night_bgm);
      } else {
        bgmPlayer(stronghold_day_bgm);
      }
    } else if(building.type == 'garrison'){
      bgmPlayer(garrison_bgm);
    } else if(building.type == 'tavern'){
      bgmPlayer(tavern_bgm);
    } else if(building.type == 'monastery'){
      bgmPlayer(monastery_bgm);
    } else {
      bgmPlayer(indoors_bgm);
    }
  } else if(z == -2){
    if(building.type == 'tavern'){
      return;
    } else {
      bgmPlayer(dungeons_bgm);
    }
  }
};

var stealthCheck = function(id){ // 0: not stealthed, 1: somewhat visible, 1.5: revealed, 2: totally stealthed
  // During login mode, show all entities normally
  if(!selfId) {
    return 0;
  }
  
  var p = Player.list[id];
  if(p.stealthed){
    if(id == selfId){
      return 1;
    } else {
      if(allyCheck(id) <= 0){ // neutral or enemy
        if(p.revealed){
          return 1.5;
        } else {
          return 2;
        }
      } else { // ally
        return 1;
      }
    }
  } else { // not stealthed
    return 0;
  }
}

var fly = 0
setInterval(function(){
  if(fly == 6){
    fly = 0;
  } else {
    fly += 1;
  }
},600);

// walking animation
var wlk = 0;
setInterval(function(){
  if(wlk == 1){
    wlk = 0;
  } else {
    wlk = 1;
  }
},400);

// working
var workingIcon = ['⌛️','⏳'];
var wrk = 0;
setInterval(function(){
  if(wrk == 1){
    wrk = 0;
  } else {
    wrk = 1;
  }
},800);

var ctx = document.getElementById('ctx').getContext('2d');
var lighting = document.getElementById('lighting').getContext('2d');
ctx.font = '30px Arial';

// Helper function to get camera position for rendering
var getCameraPosition = function() {
  // Priority 1: Spectate camera (highest priority)
  if (spectateCameraSystem && spectateCameraSystem.isActive) {
    return spectateCameraSystem.getCameraPosition();
  }
  
  // Priority 2: God mode camera
  if (godModeCamera && godModeCamera.isActive) {
    return godModeCamera.getCameraPosition();
  }
  
  // Priority 3: Login camera system
  if(loginCameraSystem && loginCameraSystem.isActive && !selfId) {
    var cameraPos = loginCameraSystem.getCameraPosition();
    if(cameraPos && cameraPos.x !== undefined && cameraPos.y !== undefined) {
      return { x: cameraPos.x, y: cameraPos.y };
    }
  }
  
  // Priority 4: Follow player
  if(selfId && Player.list[selfId]) {
    return { x: Player.list[selfId].x, y: Player.list[selfId].y };
  }
  
  // Default fallback
  return { x: 0, y: 0 };
};

// Helper function to get current z-layer for rendering
var getCurrentZ = function() {
  // Spectate camera has its own z-layer
  if (spectateCameraSystem && spectateCameraSystem.isActive) {
    return Math.round(spectateCameraSystem.cameraZ);
  }
  
  // God mode has its own z-layer
  if (godModeCamera && godModeCamera.isActive) {
    return godModeCamera.cameraZ;
  }
  
  // Otherwise use player z
  if (selfId && Player.list[selfId]) {
    return Player.list[selfId].z;
  }
  
  // Default to overworld
  return 0;
};

// Zoom system for buildings/caves
var currentZoom = 1.0;
var buildingZoom = 2.0; // 100% zoom in (2x) for buildings and cellars
var caveZoom = 1.5; // 50% zoom in (1.5x) for caves only

// Helper function to get target zoom based on current z-level
var getTargetZoom = function() {
  var z = getCurrentZ();
  
  // Zoom in when inside buildings and cellars (z=1,2,-2)
  if (z === 1 || z === 2 || z === -2) {
    return buildingZoom;
  }
  
  // Zoom in for caves (z=-1)
  if (z === -1) {
    return caveZoom;
  }
  
  // Normal zoom for overworld (z=0)
  return 1.0;
};

// BUILDINGS
var Building = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.type = initPack.type;
  self.hp = initPack.hp;
  self.occ = initPack.occ;
  self.plot = initPack.plot;
  self.walls = initPack.walls;

  Building.list[self.id] = self;
  return self;
}
Building.list = {};

// PLAYER
var Player = function(initPack){
  var self = {};
  self.type = initPack.type;
  self.name = initPack.name;
  self.house = initPack.house;
  self.kingdom = initPack.kingdom;
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.class = initPack.class;
  self.rank = initPack.rank;
  self.friends = initPack.friends,
  self.enemies = initPack.enemies,
  self.gear = initPack.gear;
  self.inventory = initPack.inventory;
  self.facing = 'down';
  self.stealthed = initPack.stealthed;
  self.revealed = initPack.revealed;
  self.angle = 0;
  self.pressingDown = false;
  self.pressingUp = false;
  self.pressingLeft = false;
  self.pressingRight = false;
  self.pressingAttack = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.pressing = false;
  self.innaWoods = initPack.innaWoods;
  self.working = false;
  self.chopping = false;
  self.mining = false;
  self.farming = false;
  self.building = false;
  self.fishing = false;
  self.hp = initPack.hp;
  self.hpMax = initPack.hpMax;
  self.spirit = initPack.spirit;
  self.spiritMax = initPack.spiritMax;
  self.ghost = initPack.ghost || false;
  self.sprite = self.ghost ? ghost : maleserf; // Use ghost sprite if in ghost mode
  self.spriteSize = initPack.spriteSize || 64; // Default to 64 if not provided
  self.ranged = initPack.ranged;
  self.action = initPack.action;
  self.kills = initPack.kills || 0;
  self.skulls = initPack.skulls || '';
  self.spriteScale = initPack.spriteScale || 1.0;

  self.draw = function(){
    // God mode: Hide the player's own character
    if(godModeCamera.isActive && self.id === selfId){
      return;
    }
    
    // Phase 2: Ghost Invisibility - Don't render other players' ghosts
    if(self.ghost && self.id !== selfId){
      return; // Other players' ghosts are invisible
    }
    
    var stealth = stealthCheck(self.id);
    
    // Get camera position (works for both logged in and login mode)
    var cameraPos = getCameraPosition();

    // Phase 6: Apply sprite scaling ONLY for fauna minibosses (Wolf, Boar)
    var shouldScale = (self.class === 'Wolf' || self.class === 'Boar') && self.spriteScale;
    var scaledSpriteSize = shouldScale ? (self.spriteSize * self.spriteScale) : self.spriteSize;
    
    // Center the sprite based on scaled size
    var x = (self.x - (scaledSpriteSize/2)) - cameraPos.x + WIDTH/2;
    var y = (self.y - (scaledSpriteSize/2)) - cameraPos.y + HEIGHT/2;

    // hp and spirit bars (skip for non-combatant creatures and ghosts)
    if(stealth < 1.5 && self.class !== 'Falcon' && !self.ghost){
      var barX = (self.x - (tileSize/2)) - cameraPos.x + WIDTH/2;
      var barY = (self.y - (tileSize/2)) - cameraPos.y + HEIGHT/2;

      var hpWidth = 60 * self.hp / self.hpMax;
      var spiritWidth = null;
      var brWidth = 60 * self.breath / self.breathMax;
      if(self.spirit){
        spiritWidth = 60 * self.spirit / self.spiritMax;
      }

      if(self.hp){
        ctx.fillStyle = 'orangered';
        ctx.fillRect(barX,barY - 30,60,6);
        ctx.fillStyle = 'limegreen';
        ctx.fillRect(barX,barY - 30,hpWidth,6);
      }
      if(self.spirit){
        ctx.fillStyle = 'orangered';
        ctx.fillRect(barX,barY - 20,60,4);
        ctx.fillStyle = 'royalblue';
        ctx.fillRect(barX,barY - 20,spiritWidth,4);
      }
      if(self.z == -3){
        ctx.fillStyle = 'azure';
        ctx.fillRect(barX,barY - 30,brWidth,6);
      }

      // username
      if(self.rank){
        var allied = allyCheck(self.id);
        if(self.kingdom && kingdomList && kingdomList[self.kingdom]){
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + kingdomList[self.kingdom].flag + ' ' + self.rank + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        } else if(self.house && houseList && houseList[self.house]){
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + houseList[self.house].flag + ' ' + self.rank + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        } else {
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + self.rank + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        }
      } else if(self.name){
        var allied = allyCheck(self.id);
        if(self.kingdom && kingdomList && kingdomList[self.kingdom]){
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + kingdomList[self.kingdom].flag + ' ' + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        } else if(self.house && houseList && houseList[self.house]){
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + houseList[self.house].flag + ' ' + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        } else {
          if(allied == 2){
            ctx.fillStyle = 'lightskyblue';
          } else if(allied == 1){
            ctx.fillStyle = 'palegreen';
          } else if(allied == 0){
            ctx.fillStyle = 'white';
          } else if(allied == -1){
            ctx.fillStyle = 'orangered';
          }
          ctx.font = '15px minion web';
          ctx.textAlign = 'center';
          var displayName = (self.skulls || '') + (self.skulls ? ' ' : '') + self.name;
          ctx.fillText(displayName,barX + 30,barY - 40,100);
        }
      }
      
      // Phase 5 & 6: Display skulls for fauna minibosses (above HP bar)
      if(self.skulls && !self.name){
        ctx.font = '20px minion web';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(self.skulls, barX + 30, barY - 45);
      }

      // status
      if(self.working){
        ctx.fillText(workingIcon[wrk], barX + 80, barY - 20);
      } else if(self.revealed){
        ctx.fillText('👁️', barX + 80, barY - 20);
      } else if(self.action == 'combat'){
        ctx.fillText('⚔️', barX + 80, barY - 20)
      }
    }

    // Apply transparency based on stealth level
    if(stealth == 2){ // fully stealthed to enemies
      ctx.globalAlpha = 0.3; // 30% visible (maximum transparency)
    } else if(stealth == 1.5){ // revealed to enemies
      ctx.globalAlpha = 0.7; // 70% visible (minimal transparency)
    } else if(stealth == 1){ // self-view or ally-view
      ctx.globalAlpha = 0.7; // 70% visible (minimal transparency)
    } else { // not stealthed
      ctx.globalAlpha = 1.0; // fully visible
    }
    
    // character sprite (now using regular sprites only)
      // Work animations (chopping, mining, farming, building, fishing) - use normal size for humans
      if(self.chopping && self.sprite.chopping){
            ctx.drawImage(
          self.sprite.chopping[wrk],
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
      } else if(self.mining && self.sprite.mining){
            ctx.drawImage(
          self.sprite.mining[wrk],
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
      } else if(self.farming && self.sprite.farming){
            ctx.drawImage(
          self.sprite.farming[wrk],
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
      } else if(self.building && self.sprite.building){
            ctx.drawImage(
          self.sprite.building[wrk],
              x,
              y,
              self.spriteSize,
              self.spriteSize
            );
      } else if(self.fishing && self.sprite.fishingd){
        // Fishing has directional sprites
        if(self.facing == 'down'){
          ctx.drawImage(self.sprite.fishingd, x, y, self.spriteSize, self.spriteSize);
        } else if(self.facing == 'up'){
          ctx.drawImage(self.sprite.fishingu, x, y, self.spriteSize, self.spriteSize);
        } else if(self.facing == 'left'){
          ctx.drawImage(self.sprite.fishingl, x, y, self.spriteSize, self.spriteSize);
        } else if(self.facing == 'right'){
          ctx.drawImage(self.sprite.fishingr, x, y, self.spriteSize, self.spriteSize);
        }
      } else if(self.pressingAttack){
        if((self.gear.weapon && self.gear.weapon.type == 'bow') || self.ranged){
          if(self.angle > 45 && self.angle <= 115){
            ctx.drawImage(
              self.sprite.attackdb,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.angle > -135 && self.angle <= -15){
            ctx.drawImage(
              self.sprite.attackub,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.angle > 115 || self.angle <= -135){
            ctx.drawImage(
              self.sprite.attacklb,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.angle > -15 || self.angle <= 45){
            ctx.drawImage(
              self.sprite.attackrb,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          }
        } else {
          if(self.facing == 'down'){
            ctx.drawImage(
              self.sprite.attackd,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.facing == 'up'){
            ctx.drawImage(
              self.sprite.attacku,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.facing == 'left'){
            ctx.drawImage(
              self.sprite.attackl,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          } else if(self.facing == 'right'){
            ctx.drawImage(
              self.sprite.attackr,
              x,
              y,
            scaledSpriteSize,
            scaledSpriteSize
            );
          }
        }
      } else if(self.pressingAttack && self.type == 'npc'){
        if(self.facing == 'down'){
          ctx.drawImage(
            self.sprite.attackd,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing == 'up'){
          ctx.drawImage(
            self.sprite.attacku,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing == 'left'){
          ctx.drawImage(
            self.sprite.attackl,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        } else if(self.facing == 'right'){
          ctx.drawImage(
            self.sprite.attackr,
            x,
            y,
            self.spriteSize,
            self.spriteSize
          );
        }
      } else if(self.facing == 'down' && !self.pressingDown){
        ctx.drawImage(
          self.sprite.facedown,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.pressingDown){
        ctx.drawImage(
          self.sprite.walkdown[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.facing == 'up' && !self.pressingUp){
        ctx.drawImage(
          self.sprite.faceup,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.pressingUp){
        ctx.drawImage(
          self.sprite.walkup[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.facing == 'left' && !self.pressingLeft){
        ctx.drawImage(
          self.sprite.faceleft,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.pressingLeft){
        ctx.drawImage(
          self.sprite.walkleft[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.facing == 'right' && !self.pressingRight){
        ctx.drawImage(
          self.sprite.faceright,
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
      } else if(self.pressingRight){
        ctx.drawImage(
          self.sprite.walkright[wlk],
          x,
          y,
          scaledSpriteSize,
          scaledSpriteSize
        );
  }
    
    // Reset transparency
    ctx.globalAlpha = 1.0;
  };

  Player.list[self.id] = self;
  return self;
}
Player.list = {};

// ARROWS
var Arrow = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.angle = initPack.angle;
  self.number = initPack.number;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.innaWoods = initPack.innaWoods;

  self.draw = function(){
    // Get camera position (works for both logged in and login mode)
    var cameraPos = getCameraPosition();
    
    function drawArrow(angle){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;

      if(angle >= -120 && angle < -60){
        ctx.drawImage(Img.arrow1, x, y, tileSize, tileSize);
      } else if(angle >= -60 && angle < -30){
        ctx.drawImage(Img.arrow2, x, y, tileSize, tileSize);
      } else if(angle >= -30 && angle < 30){
        ctx.drawImage(Img.arrow3, x, y, tileSize, tileSize);
      } else if(angle >= 30 && angle < 60){
        ctx.drawImage(Img.arrow4, x, y, tileSize, tileSize);
      } else if(angle >= 60 && angle < 120){
        ctx.drawImage(Img.arrow5, x, y, tileSize, tileSize);
      } else if(angle >= 120 && angle < 150){
        ctx.drawImage(Img.arrow6, x, y, tileSize, tileSize);
      } else if(angle >= 150 && angle > -150){
        ctx.drawImage(Img.arrow7, x, y, tileSize, tileSize);
      } else {
        ctx.drawImage(Img.arrow8, x, y, tileSize, tileSize);
      }
    }
    drawArrow(self.angle);
  }

  Arrow.list[self.id] = self;
  return self;
}
Arrow.list = {};

// ITEMS

var Item = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.type = initPack.type;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.qty = initPack.qty;
  self.innaWoods = initPack.innaWoods;

  self.draw = function(){
    // Get camera position (works for both logged in and login mode)
    var cameraPos = getCameraPosition();
    
    // All items are now spawned with getCoords() at tile top-left [c*tileSize, r*tileSize]
    // Since drawImage draws from top-left and items are tileSize x tileSize, they align perfectly with tiles
    
    if(self.type == 'Wood'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.wood3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.wood2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.wood1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Stone'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.stone2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.stone1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Grain'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.grain3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.grain2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.grain1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'IronOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Iron'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.ironbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.ironbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Steel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.steelbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.steelbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarHide'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.boarhides,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.boarhide,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Leather'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.leathers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.leather,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'SilverOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Silver'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.silver9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.silver8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.silver7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.silver6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.silver5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.silver4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.silver3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.silver2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.silver1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'GoldOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Gold'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.gold9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.gold8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.gold7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.gold6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.gold5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.gold4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.gold3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.gold2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.gold1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Diamond'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.diamonds,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.diamond,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'HuntingKnife'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger1,
      x,
      y,
      tileSize,
      tileSize
      );
    }else if(self.type == 'Dague'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Rondel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Misericorde'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'BastardSword'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Longsword'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Zweihander'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Morallta'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bow'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WelshLongbow'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.longbow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'KnightLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'RusticLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'PaladinLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Brigandine'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Lamellar'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Maille'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Hauberk'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Brynja'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Cuirass'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'SteelPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'GreenwichPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'GothicPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'ClericRobe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'MonkCowl'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'BlackCloak'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Tome'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.tome,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'RunicScroll'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.scroll,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'SacredText'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sacredtext,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Stoneaxe' || self.type == 'IronAxe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.axe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Pickaxe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.pickaxe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Key'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.key,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Torch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
        Img.torch,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.type == 'LitTorch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      torchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WallTorch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      wtorchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Campfire'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      fireFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Firepit'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      firepitFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Fireplace'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      fireplaceFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Furnace'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      forgeFlame[flm],
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Barrel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.barrel,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Crates'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.crates,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bookshelf'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bookshelf,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'SuitArmor'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.suitarmor,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Anvil'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.anvil,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Runestone'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.runestone,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Dummy'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dummy,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Cross'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.cross,
      x,
      y,
      tileSize * 2,
      tileSize * 1.5
      );
    } else if(self.type == 'Skeleton1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Skeleton2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Goods1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods3'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods3,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods4'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods4,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Stash1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.stash1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Stash2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.stash2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Desk'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.desk,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Swordrack'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.swordrack,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Bed'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bed,
      x,
      y,
      tileSize * 2,
      tileSize * 2
      );
    } else if(self.type == 'Jail'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.jail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'JailDoor'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.jaildoor,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Chains'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chains,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Throne'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.throne,
      x + (tileSize/2),
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Banner'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.banner,
      x ,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'StagHead'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.staghead,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Blood'){ // MUST ONLY SEE WITH TRACKER SKILL !!!
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.blood,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Chest'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'LockedChest'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bread'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.breads,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bread,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Fish'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.fishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.fish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Lamb'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarMeat'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Venison'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'PoachedFish'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.poachedfishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.poachedfish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'LambChop'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarShank'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'VenisonLoin'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Mead' || self.type == 'Saison'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.beers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.beer,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Flanders' || self.type == 'BiereDeGarde'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles1,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Bordeaux' || self.type == 'Bourgogne' || self.type == 'Chianti'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle2,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Crown'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.crown,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Arrows'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.arrows,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WorldMap'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.map,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Relic'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.relic,
      x,
      y,
      tileSize,
      tileSize
      );
    }
  }

  Item.list[self.id] = self;
  return self;
}
Item.list = {};

// LIGHTS
var Light = function(initPack){
  var self = {};
  self.id = initPack.id;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.radius = initPack.radius;

  Light.list[self.id] = self;
  return self;
}
Light.list = {
  antilag:{
    id:null,
    x:-100,
    y:-100,
    z:99,
    radius:0
  }
};

// player's id
var selfId = null;

// init


// update

// remove

// DRAW TO SCREEN

//cyclical animation timers
var wtr = 0; // water
var waterTiles = [Img.water1,Img.water2,Img.water3];
setInterval(function(){
  if(wtr == 2){
    wtr = 0;
  } else {
    wtr++;
  }
},1200);

var cld = 0; // clouds
var clouds = [Img.clouds1,Img.clouds2,Img.clouds3];
setInterval(function(){
  if(cld == 2){
    cld = 0;
  } else {
    cld++;
  }
},2000);

var inView = function(z,x,y,innaWoods){
  // During login mode, use selfId if available
  if(!selfId || !Player.list[selfId]) {
    return false; // During login, use inViewLogin instead
  }
  
  var top = (viewport.startTile[1] - 1) * tileSize;
  var left = (viewport.startTile[0] - 1) * tileSize;
  var right = (viewport.endTile[0] + 2) * tileSize;
  var bottom = (viewport.endTile[1] + 2) * tileSize;

  // In spectate or god mode, use camera z-layer instead of player z
  var currentZ;
  if(spectateCameraSystem.isActive){
    currentZ = spectateCameraSystem.cameraZ;
  } else if(godModeCamera.isActive){
    currentZ = godModeCamera.cameraZ;
  } else {
    currentZ = Player.list[selfId].z;
  }
  
  if(z == currentZ && x > left && x < right && y > top && y < bottom){
    // In spectate or god mode, ignore innaWoods check (always show everything)
    if(spectateCameraSystem.isActive || godModeCamera.isActive){
      return true;
    }
    if(z == 0 && innaWoods && !Player.list[selfId].innaWoods){
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

// Simplified inView for login camera (no player-specific logic)
var inViewLogin = function(x,y){
  var top = (viewport.startTile[1] - 1) * tileSize;
  var left = (viewport.startTile[0] - 1) * tileSize;
  var right = (viewport.endTile[0] + 2) * tileSize;
  var bottom = (viewport.endTile[1] + 2) * tileSize;

  if(x > left && x < right && y > top && y < bottom){
    return true;
  } else {
    return false;
  }
}

var hasFire = function(z,x,y){
  var count = 0;
  for(i in Light.list){
    var light = Light.list[i];
    if(light.z == z && (getBuilding(light.x,light.y) == getBuilding(x,y) || getBuilding(light.x,light.y+tileSize) == getBuilding(x,y))){
      if(light.radius > 1){
        return true;
      } else {
        count++;
        if(count == 2){
          return true;
        }
      }
    } else {
      continue;
    }
  }
  return false;
}

setInterval(function(){
  // Update god mode camera position
  godModeCamera.update();
  
  // Check if we should render (either logged in, in login camera mode, or spectating)
  if(!selfId && !loginCameraSystem.isActive && !spectateCameraSystem.isActive) {
    return;
  }
  
  // Don't render until we have world data
  if(!world || !tileSize || !mapSize) {
    return;
  }
  
  // Update zoom based on current z-level (buildings/caves)
  currentZoom = getTargetZoom();
  
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  
  // Apply zoom transform
  ctx.save();
  ctx.translate(WIDTH/2, HEIGHT/2);
  ctx.scale(currentZoom, currentZoom);
  ctx.translate(-WIDTH/2, -HEIGHT/2);
  
  renderMap();
  
  // In spectate mode, render EXACTLY like god mode does (copy-paste from normal rendering)
  if(spectateCameraSystem.isActive) {
    // Update spectate camera (target selection and movement)
    spectateCameraSystem.update();
    
    var currentZ = getCurrentZ();
    
    // ITEMS - exact god mode logic
    for(var i in Item.list){
      if(inView(Item.list[i].z,Item.list[i].x,Item.list[i].y,Item.list[i].innaWoods)){
        if(Item.list[i].z == currentZ){
          Item.list[i].draw();
        }
      } else {
        continue;
      }
    }
    
    // PLAYERS - exact god mode logic
    for(var i in Player.list){
      if(Player.list[i].class != 'Falcon'){
        if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,Player.list[i].innaWoods)){
          if(Player.list[i].z == currentZ){
            Player.list[i].draw();
          }
        } else {
          continue;
        }
      }
    }
    
    // ARROWS - exact god mode logic
    for(var i in Arrow.list){
      if(inView(Arrow.list[i].z,Arrow.list[i].x,Arrow.list[i].y,Arrow.list[i].innaWoods)){
        if(Arrow.list[i].z == currentZ){
          Arrow.list[i].draw();
        }
      } else {
        continue;
      }
    }
    
    // FOREST - only on z=0, exact god mode logic
    if(currentZ == 0){
      renderForest();
    }
    renderTops();
    
    // FALCONS - exact god mode logic
    for(var i in Player.list){
      if(Player.list[i].class == 'Falcon'){
        if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,false)){
          if(Player.list[i].z == currentZ){
            Player.list[i].draw();
          }
        } else {
          continue;
        }
      }
    }
    
    // BUILDINGS - exact god mode logic
    for(var i in Building.list){
      if(inView(Building.list[i].z,Building.list[i].x,Building.list[i].y)){
        if(Building.list[i].z == currentZ){
          Building.list[i].draw();
        }
      } else {
        continue;
      }
    }
    
    renderLighting();
    
    // LIGHT SOURCES - exact god mode logic
    if(currentZ == 0){
      if(nightfall){
        renderLightSources(2);
      } else {
        renderLightSources(1);
      }
    } else if(currentZ == 1 || currentZ == 2){
      renderLightSources(1);
    } else if(currentZ == -1 || currentZ == -2){
      renderLightSources(3);
    }
    
    // Update viewport
    var cameraPos = spectateCameraSystem.getCameraPosition();
    viewport.update(cameraPos.x, cameraPos.y);
  } else if(loginCameraSystem.isActive && !selfId) {
    // Render all items on ground level
    for(var i in Item.list){
      if(Item.list[i].z == 0) {
        var itemInView = inViewLogin(Item.list[i].x, Item.list[i].y);
        if(itemInView) {
          Item.list[i].draw();
        }
      }
    }
    
    // Render all non-falcon players on ground level
    for(var i in Player.list){
      if(Player.list[i].class != 'Falcon' && Player.list[i].z == 0){
        var playerInView = inViewLogin(Player.list[i].x, Player.list[i].y);
        if(playerInView){
          Player.list[i].draw();
        }
      }
    }
    
    // Render forest overlay (trees should cover ground entities)
    renderForest();
    
    renderTops();
    
    // Render falcons (flying above trees)
    for(var i in Player.list){
      if(Player.list[i].class == 'Falcon'){
        var falconInView = inViewLogin(Player.list[i].x, Player.list[i].y);
        if(falconInView){
          Player.list[i].draw();
        }
      }
    }
    
    renderLighting();
    // Render light sources (env: 1=daytime, 2=nighttime)
    if(nightfall){
      renderLightSources(2);
    } else {
      renderLightSources(1);
    }
    
    // Update viewport with falcon camera position
    var cameraPos = loginCameraSystem.getCameraPosition();
    viewport.update(cameraPos.x, cameraPos.y);
  } else if(selfId && Player.list[selfId]) {
    // Normal game rendering when logged in
  var currentZ = getCurrentZ();
  for(var i in Item.list){
    if(inView(Item.list[i].z,Item.list[i].x,Item.list[i].y,Item.list[i].innaWoods)){
      // In god mode, render all items on current z-layer
      if(godModeCamera.isActive){
        if(Item.list[i].z == currentZ){
          Item.list[i].draw();
        }
      } else if((currentZ == 1 || currentZ == 2) && (getBuilding(Item.list[i].x,Item.list[i].y) == getBuilding(Player.list[selfId].x,Player.list[selfId].y) || getBuilding(Item.list[i].x,Item.list[i].y+(tileSize * 1.1)) == getBuilding(Player.list[selfId].x,Player.list[selfId].y))){
        Item.list[i].draw();
      } else if(currentZ != 1 && currentZ != 2){
        Item.list[i].draw();
      } else {
        continue;
      }
    } else {
      continue;
    }
  }
  for(var i in Player.list){
    if(Player.list[i].class != 'Falcon'){
      if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,Player.list[i].innaWoods)){
        // In god mode, render all entities on current z-layer
        if(godModeCamera.isActive){
          if(Player.list[i].z == currentZ){
            Player.list[i].draw();
          }
        } else if((currentZ == 1 || currentZ == 2) && (getBuilding(Player.list[i].x,Player.list[i].y) == getBuilding(Player.list[selfId].x,Player.list[selfId].y))){
          Player.list[i].draw();
        } else if(currentZ != 1 && currentZ != 2){
          Player.list[i].draw();
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
  }
  for(var i in Arrow.list){
    if(inView(Arrow.list[i].z,Arrow.list[i].x,Arrow.list[i].y,Arrow.list[i].innaWoods)){
      // In god mode, render all arrows on current z-layer
      if(godModeCamera.isActive){
        if(Arrow.list[i].z == currentZ){
          Arrow.list[i].draw();
        }
      } else if((currentZ == 1 || currentZ == 2) && (getBuilding(Item.list[i].x,Item.list[i].y) == getBuilding(Arrow.list[selfId].x,Arrow.list[selfId].y))){
        Arrow.list[i].draw();
      } else if(currentZ != 1 && currentZ != 2){
        Arrow.list[i].draw();
      } else {
        continue;
      }
    } else {
      continue;
    }
  }
  // Render forest overlay on z=0
  // - In god mode: always render (full visibility)
  // - Normal play: only when innaWoods (transparent overlay near player)
  if(currentZ == 0){
    if(godModeCamera.isActive){
      renderForest();
    } else if(Player.list[selfId] && Player.list[selfId].innaWoods){
      renderForest();
    }
  }
  renderTops();
  for(var i in Player.list){
    if(Player.list[i].class == 'Falcon'){
      if(inView(Player.list[i].z,Player.list[i].x,Player.list[i].y,false)){
        // In god mode, only render falcons on current z-layer
        if(godModeCamera.isActive){
          if(Player.list[i].z == currentZ){
            Player.list[i].draw();
          }
        } else {
          Player.list[i].draw();
        }
      }
    }
  }
  renderLighting();
  if(currentZ == 0){
    if(nightfall){
      renderLightSources(2);
    } else {
      renderLightSources(1);
    }
  } else if(currentZ == 1 || currentZ == 2){
    renderLightSources(1);
  } else if(currentZ == -1 || currentZ == -2){
    renderLightSources(3);
  }
  
  // Update viewport position
  if(godModeCamera.isActive){
    viewport.update(godModeCamera.cameraX, godModeCamera.cameraY);
  } else {
  viewport.update(Player.list[selfId].x,Player.list[selfId].y);
  }
  
  // Render building preview that follows mouse cursor
  if(buildPreviewMode && buildPreviewType){
    renderBuildingPreview();
  }
  }
  
  // Restore canvas transform after rendering
  ctx.restore();
  
  //console.log(getLoc(Player.list[selfId].x,Player.list[selfId].y));
},40);

// RENDER MAP

// MAP TOOLS
var getTile = function(l,c,r){
  const value = world[l] && world[l][r] && world[l][r][c];
  return value || 0;
};

// get loc from (x,y)
var getLoc = function(x,y){
  var loc = [Math.floor(x/tileSize),Math.floor(y/tileSize)];
  return loc;
};

// get tile type from (l,x,y)
getLocTile = function(l,x,y){
  var loc = getLoc(x,y);
  var tile = getTile(l,loc[0],loc[1])
  return tile;
};

// get (x,y) coords of tile from loc
var getCoords = function(c,r){
  var coords = [c * tileSize, r * tileSize];
  return coords;
};

// get building id from (x,y)
getBuilding = function(x,y){
  var loc = getLoc(x,y);
  for(i in Building.list){
    var b = Building.list[i];
    for(n = 0; n < b.plot.length; n++){
      if(b.plot[n][0] == loc[0] && b.plot[n][1] == loc[1]){
        return b.id;
      } else {
        continue;
      }
    }
  }
}

// check if same faction(2), ally(1), neutral(0), enemy(-1)
var allyCheck = function(id){
  // During login mode, treat everyone as neutral
  if(!selfId || !Player.list[selfId] || !houseList || !kingdomList) {
    return 0;
  }
  
  var player = Player.list[selfId];
  var other = Player.list[id];
  
  // Safety check for houses
  if(!houseList) {
    return 0;
  }
  
  var pHouse = houseList[player.house];
  var oHouse = houseList[other.house];

  if(pHouse){
    if(pHouse.hostile){
      if(oHouse){
        if(player.house == other.house){
          return 2;
        } else {
          for(var i in pHouse.allies){
            if(pHouse.allies[i] == other.house){
              return 1;
            } else {
              continue;
            }
          }
          return -1;
        }
      } else {
        return -1;
      }
    } else {
      if(oHouse){
        if(player.house == other.house){
          return 2;
        } else {
          for(var i in pHouse.allies){
            if(pHouse.allies[i] == other.house){
              return 1;
            } else {
              continue;
            }
          }
          if(oHouse.hostile){
            return -1;
          } else {
            for(var i in pHouse.enemies){
              if(pHouse.enemies[i] == other.house){
                return -1;
              } else {
                continue;
              }
            }
          }
          return 0;
        }
      } else {
        for(var i in pHouse.enemies){
          if(pHouse.enemies[i] == id){
            return -1;
          } else {
            continue;
          }
        }
        return 0;
      }
    }
  } else {
    if(oHouse){
      if(oHouse.hostile){
        return -1;
      } else {
        for(var i in oHouse.enemies){
          if(oHouse.enemies[i] == selfId){
            return -1;
          } else {
            continue;
          }
        }
        return 0;
      }
    } else {
      for(var i in player.friends){
        if(player.friends[i] == id){
          return 1;
        } else {
          continue;
        }
      }
      for(var i in player.enemies){
        if(player.enemies[i] == id){
          return -1;
        } else {
          continue;
        }
      }
      return 0;
    }
  }
}

// update environment
tempus = null;
nightfall = null;

houseList = null;
kingdomList = null;

// viewport
var viewport = {
  screen: [WIDTH,HEIGHT],
  startTile: [0,0],
  endTile: [0,0],
  offset: [0,0],
  update: function(c,r){
    this.offset[0] = Math.floor((this.screen[0]/2) - c);
    this.offset[1] = Math.floor((this.screen[1]/2) - r);

    var tile = [Math.floor(c/tileSize),Math.floor(r/tileSize)];

    this.startTile[0] = tile[0] - 1 - Math.ceil((this.screen[0]/2) / tileSize);
    this.startTile[1] = tile[1] - 1 - Math.ceil((this.screen[1]/2) / tileSize);

    if(this.startTile[0] < 0){
      this.startTile[0] = 0;
    }
    if(this.startTile[1] < 0){
      this.startTile[1] = 0;
    }

    this.endTile[0] = tile[0] + 1 + Math.ceil((this.screen[0]/2) / tileSize);
    this.endTile[1] = tile[1] + 1 + Math.ceil((this.screen[1]/2) / tileSize);

    if(this.endTile[0] >= mapSize){
      this.endTile[0] = mapSize;
    }
    if(this.endTile[1] >= mapSize){
      this.endTile[1] = mapSize;
    }
  }
};

// renderer
var renderMap = function(){
  // Get current z-layer (supports login camera, god mode, and normal play)
  var z = getCurrentZ();

  // overworld
  if(z == 0){
    var cloudscape = ctx.createPattern(clouds[cld], "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = cloudscape;
    ctx.fill();

    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        if(tile == 0){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 1 && tile < 2){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          // In god mode or login mode, always show forest overlay (not innaWoods)
          // Normal play: check player's innaWoods status
          var innaWoods = false;
          if(selfId && Player.list[selfId] && !godModeCamera.isActive) {
            innaWoods = Player.list[selfId].innaWoods;
          }
          
          if(!innaWoods){
            if(tile >= 1 && tile < 1.3){
              ctx.drawImage(
                Img.hforest, // image
                xOffset - (tileSize/4), // target x
                yOffset - (tileSize/1.75), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(tile >= 1 && tile < 1.6){
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/1.25), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else {
              ctx.drawImage(
                Img.hforest, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            }
          }
        } else if(tile >= 2 && tile < 2.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 2.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 2 && tile < 3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.forest, // image
            xOffset, // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize * 1.25 // target height
          );
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.brush, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 4 && tile < 4.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 4 && tile < 4.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 4 && tile < 5){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 5 && tile < 5.3){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 5.6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile >= 5 && tile < 6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.mountain, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );;
        } else if(tile == 6){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavein, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 7){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 8){
          ctx.drawImage(
            Img.farm1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 9){
          ctx.drawImage(
            Img.farm2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 10){
          ctx.drawImage(
            Img.farm3, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 11){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 11.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build1w, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 12){
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 12.5){
          ctx.drawImage(
            waterTiles[wtr], // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.build2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if (tile == 18){
          ctx.drawImage(
            Img.road, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 13 || tile == 14 || tile == 15 || tile == 16 || tile == 17 || tile == 19 || tile == 20 || tile == 20.5){
          var bTile = getTile(3,c,r);
          ctx.drawImage(
            Img.grass, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          if(bTile == 'hut0'){
            ctx.drawImage(
              Img.hut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut1'){
            ctx.drawImage(
              Img.hut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut2'){
            ctx.drawImage(
              Img.hut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'hut3'){
            ctx.drawImage(
              Img.hut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut0'){
            ctx.drawImage(
              Img.gothhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut1'){
            ctx.drawImage(
              Img.gothhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut2'){
            ctx.drawImage(
              Img.gothhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothhut3'){
            ctx.drawImage(
              Img.gothhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut0'){
            ctx.drawImage(
              Img.frankhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut1'){
            ctx.drawImage(
              Img.frankhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut2'){
            ctx.drawImage(
              Img.frankhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankhut3'){
            ctx.drawImage(
              Img.frankhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut0'){
            ctx.drawImage(
              Img.celthut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut1'){
            ctx.drawImage(
              Img.celthut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut2'){
            ctx.drawImage(
              Img.celthut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'celthut3'){
            ctx.drawImage(
              Img.celthut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut0'){
            ctx.drawImage(
              Img.teuthut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut1'){
            ctx.drawImage(
              Img.teuthut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut2'){
            ctx.drawImage(
              Img.teuthut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'teuthut3'){
            ctx.drawImage(
              Img.teuthut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut0'){
            ctx.drawImage(
              Img.outhut0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut1'){
            ctx.drawImage(
              Img.outhut1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut2'){
            ctx.drawImage(
              Img.outhut2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'outhut3'){
            ctx.drawImage(
              Img.outhut3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill0'){
            ctx.drawImage(
              Img.mill0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill1'){
            ctx.drawImage(
              Img.mill1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill2'){
            ctx.drawImage(
              Img.mill2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mill3'){
            ctx.drawImage(
              Img.mill3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'lumbermill0'){
            ctx.drawImage(
              Img.lumbermill0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'lumbermill1'){
            ctx.drawImage(
              Img.lumbermill1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine0'){
            ctx.drawImage(
              Img.mine0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine1'){
            ctx.drawImage(
              Img.mine1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine2'){
            ctx.drawImage(
              Img.mine2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'mine3'){
            ctx.drawImage(
              Img.mine3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage0'){
            ctx.drawImage(
              Img.cottage0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage1'){
            ctx.drawImage(
              Img.cottage1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage2'){
            ctx.drawImage(
              Img.cottage2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }  else if(bTile == 'cottage3'){
            ctx.drawImage(
              Img.cottage3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage4'){
            ctx.drawImage(
              Img.cottage4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage5'){
            ctx.drawImage(
              Img.cottage5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage6'){
            ctx.drawImage(
              Img.cottage6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage7'){
            ctx.drawImage(
              Img.cottage7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'cottage8'){
            ctx.drawImage(
              Img.cottage8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'fort'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l != 'fort' && rr != 'fort' && u != 'fort' && d != 'fort') ||
            (l == 'fort' && rr == 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u != 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u != 'fort' && d != 'fort') ||
            (l != 'fort' && rr != 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr != 'fort' && u != 'fort' && d == 'fort') ||
            (l != 'fort' && rr == 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u == 'fort' && d != 'fort') ||
            (l != 'fort' && rr == 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr == 'fort' && u != 'fort' && d == 'fort') ||
            (l == 'fort' && rr != 'fort' && u == 'fort' && d == 'fort') ||
            (l == 'fort' && rr == 'fort' && u == 'fort' && d != 'fort')){
              ctx.drawImage(
                Img.fortc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l == 'fort' && rr == 'fort' && u != 'fort' && d != 'fort'){
              ctx.drawImage(
                Img.fortlr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l != 'fort' && rr != 'fort' && u == 'fort' && d == 'fort'){
              ctx.drawImage(
                Img.fortud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile == 'wall'){
            var l = getTile(3,c-1,r);
            var rr = getTile(3,c+1,r);
            var u = getTile(3,c,r-1);
            var d = getTile(3,c,r+1);
            ctx.drawImage(
              Img.grass, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
            if((l != 'wall' && rr != 'wall' && u != 'wall' && d != 'wall') ||
            (l == 'wall' && rr == 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u != 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u != 'wall' && d != 'wall') ||
            (l != 'wall' && rr != 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr != 'wall' && u != 'wall' && d == 'wall') ||
            (l != 'wall' && rr == 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u == 'wall' && d != 'wall') ||
            (l != 'wall' && rr == 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr == 'wall' && u != 'wall' && d == 'wall') ||
            (l == 'wall' && rr != 'wall' && u == 'wall' && d == 'wall') ||
            (l == 'wall' && rr == 'wall' && u == 'wall' && d != 'wall')){
              ctx.drawImage(
                Img.wallc, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 1.5 // target height
              );
            } else if(l == 'wall' && rr == 'wall' && u != 'wall' && d != 'wall'){
              ctx.drawImage(
                Img.walllr, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else if(l != 'wall' && rr != 'wall' && u == 'wall' && d == 'wall'){
              ctx.drawImage(
                Img.wallud, // image
                xOffset, // target x
                yOffset - (tileSize/2), // target y
                tileSize, // target width
                tileSize * 2 // target height
              );
            }
          } else if(bTile == 'outpost0'){
            ctx.drawImage(
              Img.outpost0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower0'){
            ctx.drawImage(
              Img.gtower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower1'){
            ctx.drawImage(
              Img.gtower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower2'){
            ctx.drawImage(
              Img.gtower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gtower3'){
            ctx.drawImage(
              Img.gtower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower0'){
            ctx.drawImage(
              Img.gothtower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower1'){
            ctx.drawImage(
              Img.gothtower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower2'){
            ctx.drawImage(
              Img.gothtower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothtower3'){
            ctx.drawImage(
              Img.gothtower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower0'){
            ctx.drawImage(
              Img.franktower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower1'){
            ctx.drawImage(
              Img.franktower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower2'){
            ctx.drawImage(
              Img.franktower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'franktower3'){
            ctx.drawImage(
              Img.franktower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower0'){
            ctx.drawImage(
              Img.tower0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower1'){
            ctx.drawImage(
              Img.tower1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower2'){
            ctx.drawImage(
              Img.tower2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower3'){
            ctx.drawImage(
              Img.tower3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower4'){
            ctx.drawImage(
              Img.tower4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower5'){
            ctx.drawImage(
              Img.tower5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower6'){
            ctx.drawImage(
              Img.tower6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower7'){
            ctx.drawImage(
              Img.tower7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tower8'){
            ctx.drawImage(
              Img.tower8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern0'){
            ctx.drawImage(
              Img.tavern0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern1'){
            ctx.drawImage(
              Img.tavern1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern2'){
            ctx.drawImage(
              Img.tavern2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern3'){
            ctx.drawImage(
              Img.tavern3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern4'){
            ctx.drawImage(
              Img.tavern4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern5'){
            ctx.drawImage(
              Img.tavern5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern6'){
            ctx.drawImage(
              Img.tavern6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern7'){
            ctx.drawImage(
              Img.tavern7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern8'){
            ctx.drawImage(
              Img.tavern8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern9'){
            ctx.drawImage(
              Img.tavern9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern10'){
            ctx.drawImage(
              Img.tavern10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern11'){
            ctx.drawImage(
              Img.tavern11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern12'){
            ctx.drawImage(
              Img.tavern12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern13'){
            ctx.drawImage(
              Img.tavern13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern14'){
            ctx.drawImage(
              Img.tavern14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern15'){
            ctx.drawImage(
              Img.tavern15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'tavern16'){
            ctx.drawImage(
              Img.tavern16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery0'){
            ctx.drawImage(
              Img.monastery0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery1'){
            ctx.drawImage(
              Img.monastery1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery2'){
            ctx.drawImage(
              Img.monastery2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery3'){
            ctx.drawImage(
              Img.monastery3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery4'){
            ctx.drawImage(
              Img.monastery4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery5'){
            ctx.drawImage(
              Img.monastery5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery6'){
            ctx.drawImage(
              Img.monastery6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery7'){
            ctx.drawImage(
              Img.monastery7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery8'){
            ctx.drawImage(
              Img.monastery8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery9'){
            ctx.drawImage(
              Img.monastery9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery10'){
            ctx.drawImage(
              Img.monastery10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery11'){
            ctx.drawImage(
              Img.monastery11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery12'){
            ctx.drawImage(
              Img.monastery12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'monastery13'){
            ctx.drawImage(
              Img.monastery13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market0'){
            ctx.drawImage(
              Img.market0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market1'){
            ctx.drawImage(
              Img.market1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market2'){
            ctx.drawImage(
              Img.market2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market3'){
            ctx.drawImage(
              Img.market3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market4'){
            ctx.drawImage(
              Img.market4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market5'){
            ctx.drawImage(
              Img.market5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market6'){
            ctx.drawImage(
              Img.market6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market7'){
            ctx.drawImage(
              Img.market7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market8'){
            ctx.drawImage(
              Img.market8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market9'){
            ctx.drawImage(
              Img.market9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market10'){
            ctx.drawImage(
              Img.market10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'market11'){
            ctx.drawImage(
              Img.market11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket0'){
            ctx.drawImage(
              Img.gothmarket0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket1'){
            ctx.drawImage(
              Img.gothmarket1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket2'){
            ctx.drawImage(
              Img.gothmarket2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket3'){
            ctx.drawImage(
              Img.gothmarket3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket4'){
            ctx.drawImage(
              Img.gothmarket4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket5'){
            ctx.drawImage(
              Img.gothmarket5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket6'){
            ctx.drawImage(
              Img.gothmarket6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'gothmarket7'){
            ctx.drawImage(
              Img.gothmarket7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket0'){
            ctx.drawImage(
              Img.frankmarket0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket1'){
            ctx.drawImage(
              Img.frankmarket1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket2'){
            ctx.drawImage(
              Img.frankmarket2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket3'){
            ctx.drawImage(
              Img.frankmarket3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket4'){
            ctx.drawImage(
              Img.frankmarket4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket5'){
            ctx.drawImage(
              Img.frankmarket5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket6'){
            ctx.drawImage(
              Img.frankmarket6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket7'){
            ctx.drawImage(
              Img.frankmarket7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket8'){
            ctx.drawImage(
              Img.frankmarket8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket9'){
            ctx.drawImage(
              Img.frankmarket9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket10'){
            ctx.drawImage(
              Img.frankmarket10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'frankmarket11'){
            ctx.drawImage(
              Img.frankmarket11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable0'){
            ctx.drawImage(
              Img.stable0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable1'){
            ctx.drawImage(
              Img.stable1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable2'){
            ctx.drawImage(
              Img.stable2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable3'){
            ctx.drawImage(
              Img.stable3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable4'){
            ctx.drawImage(
              Img.stable4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable5'){
            ctx.drawImage(
              Img.stable5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable6'){
            ctx.drawImage(
              Img.stable6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable7'){
            ctx.drawImage(
              Img.stable7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable8'){
            ctx.drawImage(
              Img.stable8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable9'){
            ctx.drawImage(
              Img.stable9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable10'){
            ctx.drawImage(
              Img.stable10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stable11'){
            ctx.drawImage(
              Img.stable11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock0'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock1'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock2'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock3'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock4'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'dock5'){
            if(tile == 20.5){
              ctx.drawImage(
                waterTiles[wtr], // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            } else {
              ctx.drawImage(
                Img.grass, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
            ctx.drawImage(
              Img.dock5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison0'){
            ctx.drawImage(
              Img.garrison0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison1'){
            ctx.drawImage(
              Img.garrison1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison2'){
            ctx.drawImage(
              Img.garrison2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison3'){
            ctx.drawImage(
              Img.garrison3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison4'){
            ctx.drawImage(
              Img.garrison4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison5'){
            ctx.drawImage(
              Img.garrison5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison6'){
            ctx.drawImage(
              Img.garrison6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison7'){
            ctx.drawImage(
              Img.garrison7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison8'){
            ctx.drawImage(
              Img.garrison8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison9'){
            ctx.drawImage(
              Img.garrison9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison10'){
            ctx.drawImage(
              Img.garrison10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'garrison11'){
            ctx.drawImage(
              Img.garrison11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge0'){
            ctx.drawImage(
              Img.forge0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge1'){
            ctx.drawImage(
              Img.forge1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge2'){
            ctx.drawImage(
              Img.forge2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge3'){
            ctx.drawImage(
              Img.forge3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge4'){
            ctx.drawImage(
              Img.forge4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'forge5'){
            ctx.drawImage(
              Img.forge5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold0'){
            ctx.drawImage(
              Img.stronghold0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold1'){
            ctx.drawImage(
              Img.stronghold1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold2'){
            ctx.drawImage(
              Img.stronghold2, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold3'){
            ctx.drawImage(
              Img.stronghold3, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold4'){
            ctx.drawImage(
              Img.stronghold4, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold5'){
            ctx.drawImage(
              Img.stronghold5, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold6'){
            ctx.drawImage(
              Img.stronghold6, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold7'){
            ctx.drawImage(
              Img.stronghold7, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold8'){
            ctx.drawImage(
              Img.stronghold8, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold9'){
            ctx.drawImage(
              Img.stronghold9, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold10'){
            ctx.drawImage(
              Img.stronghold10, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold11'){
            ctx.drawImage(
              Img.stronghold11, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold12'){
            ctx.drawImage(
              Img.stronghold12, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold13'){
            ctx.drawImage(
              Img.stronghold13, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold14'){
            ctx.drawImage(
              Img.stronghold14, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold15'){
            ctx.drawImage(
              Img.stronghold15, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold16'){
            ctx.drawImage(
              Img.stronghold16, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold17'){
            ctx.drawImage(
              Img.stronghold17, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold18'){
            ctx.drawImage(
              Img.stronghold18, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold19'){
            ctx.drawImage(
              Img.stronghold19, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold20'){
            ctx.drawImage(
              Img.stronghold20, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold21'){
            ctx.drawImage(
              Img.stronghold21, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold22'){
            ctx.drawImage(
              Img.stronghold22, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold23'){
            ctx.drawImage(
              Img.stronghold23, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold24'){
            ctx.drawImage(
              Img.stronghold24, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold25'){
            ctx.drawImage(
              Img.stronghold25, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold26'){
            ctx.drawImage(
              Img.stronghold26, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold27'){
            ctx.drawImage(
              Img.stronghold27, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold28'){
            ctx.drawImage(
              Img.stronghold28, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold29'){
            ctx.drawImage(
              Img.stronghold29, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold30'){
            ctx.drawImage(
              Img.stronghold30, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold31'){
            ctx.drawImage(
              Img.stronghold31, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold32'){
            ctx.drawImage(
              Img.stronghold32, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold33'){
            ctx.drawImage(
              Img.stronghold33, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold34'){
            ctx.drawImage(
              Img.stronghold34, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold35'){
            ctx.drawImage(
              Img.stronghold35, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold36'){
            ctx.drawImage(
              Img.stronghold36, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold37'){
            ctx.drawImage(
              Img.stronghold37, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold38'){
            ctx.drawImage(
              Img.stronghold38, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold39'){
            ctx.drawImage(
              Img.stronghold39, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold40'){
            ctx.drawImage(
              Img.stronghold40, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold41'){
            ctx.drawImage(
              Img.stronghold41, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold42'){
            ctx.drawImage(
              Img.stronghold42, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold43'){
            ctx.drawImage(
              Img.stronghold43, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold44'){
            ctx.drawImage(
              Img.stronghold44, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold45'){
            ctx.drawImage(
              Img.stronghold45, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold46'){
            ctx.drawImage(
              Img.stronghold46, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold47'){
            ctx.drawImage(
              Img.stronghold47, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold48'){
            ctx.drawImage(
              Img.stronghold48, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold49'){
            ctx.drawImage(
              Img.stronghold49, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold50'){
            ctx.drawImage(
              Img.stronghold50, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold51'){
            ctx.drawImage(
              Img.stronghold51, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold52'){
            ctx.drawImage(
              Img.stronghold52, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold53'){
            ctx.drawImage(
              Img.stronghold53, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold54'){
            ctx.drawImage(
              Img.stronghold54, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold55'){
            ctx.drawImage(
              Img.stronghold55, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold56'){
            ctx.drawImage(
              Img.stronghold56, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(bTile == 'stronghold57'){
            ctx.drawImage(
              Img.stronghold57, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z == -1){
    var morecave = ctx.createPattern(Img.cavefloor, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = morecave;
    ctx.fill();
    var evenmorecave = ctx.createPattern(Img.cavewall, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = evenmorecave;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var tile = getTile(1, c, r);
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        if(tile == 0){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 1){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 2){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.caveout, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.3){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/4), // target x
            yOffset - (tileSize/3), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 3.6){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset - (tileSize/3), // target x
            yOffset - (tileSize/4), // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile >= 3 && tile < 4){
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.rocks, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == -2){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(8, c, r);
        var below = getTile(8,c,r+1);
        if(tile == 1){
          ctx.drawImage(
            Img.stonefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 0 && below == 1){
          ctx.drawImage(
            Img.stonewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 5){
          ctx.drawImage(
            Img.sstairsu, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
          ctx.drawImage(
            Img.cavefloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == -3){
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        if(tile == 11.5 || tile == 12.5 || tile == 20 || tile == 20.5){
          ctx.drawImage(
            Img.woodfloor, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 0){
          ctx.drawImage(
            Img.sand, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else {
          ctx.drawImage(
            Img.cavewall, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  } else if(z == 1){
    var pBuilding = getBuilding(Player.list[selfId].x,Player.list[selfId].y);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for(var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for(var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(0, c, r);
        var wtile = getTile(4, c, r);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1]);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1]);
        if(pBuilding == building || pBuilding == bbuilding){
          if(wtile == 1){
            ctx.drawImage(
              Img.woodwall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 2){
            ctx.drawImage(
              Img.stonewall, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 3){
            ctx.drawImage(
              Img.wstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 4){
            ctx.drawImage(
              Img.sstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 5){
            ctx.drawImage(
              Img.wstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 6){
            ctx.drawImage(
              Img.sstairsd, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(wtile == 7){
            ctx.drawImage(
              Img.lstairsu, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 14){
            ctx.drawImage(
              Img.woodexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 16){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 19){
            ctx.drawImage(
              Img.stoneexit, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  } else if(z == 2){
    var pBuilding = getBuilding(Player.list[selfId].x,Player.list[selfId].y);
    var dark = ctx.createPattern(Img.void, "repeat");
    ctx.rect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle = dark;
    ctx.fill();
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        var wtile = getTile(4, c, r);
        var below = getTile(5, c, r+1);
        var bCoords = getCoords(c,r);
        var bbCoords = getCoords(c,r+1);
        var building = getBuilding(bCoords[0],bCoords[1]);
        var bbuilding = getBuilding(bbCoords[0],bbCoords[1]);
        if(pBuilding == building || pBuilding == bbuilding){
          if(wtile == 1){
            if(below != 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 2){
            if(below != 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 3){
            if(below != 0){
              ctx.drawImage(
                Img.wstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 4){
            if(below != 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 5){
            if(below != 0){
              ctx.drawImage(
                Img.woodwall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 6){
            if(below != 0){
              ctx.drawImage(
                Img.stonewall, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(wtile == 7){
            if(below != 0){
              ctx.drawImage(
                Img.sstairsd, // image
                xOffset, // target x
                yOffset, // target y
                tileSize, // target width
                tileSize // target height
              );
            }
          } else if(tile == 13){
            ctx.drawImage(
              Img.woodfloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 17){
            ctx.drawImage(
              Img.carpet, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else if(tile == 15){
            ctx.drawImage(
              Img.stonefloor, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        }
      }
    }
  }
};

var renderTops = function(){
  // Get current z-layer (works for login camera, god mode, and normal play)
  var z = getCurrentZ();
  
  if(z == 0){
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var tile = getTile(5, c, r);
        if(tile == 'mill4'){
          ctx.drawImage(
            Img.mill4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'mill5'){
          ctx.drawImage(
            Img.mill5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'lumbermill2'){
          ctx.drawImage(
            Img.lumbermill2, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'lumbermill3'){
          ctx.drawImage(
            Img.lumbermill3, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'outpost1'){
          ctx.drawImage(
            Img.outpost1, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gtower4'){
          ctx.drawImage(
            Img.gtower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gtower5'){
          ctx.drawImage(
            Img.gtower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothtower4'){
          ctx.drawImage(
            Img.gothtower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothtower5'){
          ctx.drawImage(
            Img.gothtower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'franktower4'){
          ctx.drawImage(
            Img.franktower4, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'franktower5'){
          ctx.drawImage(
            Img.franktower5, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower9'){
          ctx.drawImage(
            Img.tower9, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower10'){
          ctx.drawImage(
            Img.tower10, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower11'){
          ctx.drawImage(
            Img.tower11, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower12'){
          ctx.drawImage(
            Img.tower12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower13'){
          ctx.drawImage(
            Img.tower13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tower14'){
          ctx.drawImage(
            Img.tower14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern17'){
          ctx.drawImage(
            Img.tavern17, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern18'){
          ctx.drawImage(
            Img.tavern18, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'tavern19'){
          ctx.drawImage(
            Img.tavern19, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery14'){
          ctx.drawImage(
            Img.monastery14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery15'){
          ctx.drawImage(
            Img.monastery15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'monastery16'){
          ctx.drawImage(
            Img.monastery16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market12'){
          ctx.drawImage(
            Img.market12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market13'){
          ctx.drawImage(
            Img.market13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market14'){
          ctx.drawImage(
            Img.market14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market15'){
          ctx.drawImage(
            Img.market15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'market16'){
          ctx.drawImage(
            Img.market16, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothmarket8'){
          ctx.drawImage(
            Img.gothmarket8, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gothmarket9'){
          ctx.drawImage(
            Img.gothmarket9, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket12'){
          ctx.drawImage(
            Img.frankmarket12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket13'){
          ctx.drawImage(
            Img.frankmarket13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket14'){
          ctx.drawImage(
            Img.frankmarket14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'frankmarket15'){
          ctx.drawImage(
            Img.frankmarket15, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }  else if(tile == 'stable12'){
          ctx.drawImage(
            Img.stable12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stable13'){
          ctx.drawImage(
            Img.stable13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stable14'){
          ctx.drawImage(
            Img.stable14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock6'){
          ctx.drawImage(
            Img.dock6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock7'){
          ctx.drawImage(
            Img.dock7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'dock8'){
          ctx.drawImage(
            Img.dock8, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison12'){
          ctx.drawImage(
            Img.garrison12, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison13'){
          ctx.drawImage(
            Img.garrison13, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'garrison14'){
          ctx.drawImage(
            Img.garrison14, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'forge6'){
          ctx.drawImage(
            Img.forge6, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'forge7'){
          ctx.drawImage(
            Img.forge7, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'gateo'){
          if(getTile(3,c-1,r) == 'wall'){
            ctx.drawImage(
              Img.gateo0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gateo1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile == 'gatec'){
          if(getTile(3,c-1,r) == 'wall'){
            ctx.drawImage(
              Img.gatec0, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          } else {
            ctx.drawImage(
              Img.gatec1, // image
              xOffset, // target x
              yOffset, // target y
              tileSize, // target width
              tileSize // target height
            );
          }
        } else if(tile == 'stronghold58'){
          ctx.drawImage(
            Img.stronghold58, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold59'){
          ctx.drawImage(
            Img.stronghold59, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold60'){
          ctx.drawImage(
            Img.stronghold60, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold61'){
          ctx.drawImage(
            Img.stronghold61, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold62'){
          ctx.drawImage(
            Img.stronghold62, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold63'){
          ctx.drawImage(
            Img.stronghold63, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold64'){
          ctx.drawImage(
            Img.stronghold64, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold65'){
          ctx.drawImage(
            Img.stronghold65, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        } else if(tile == 'stronghold66'){
          ctx.drawImage(
            Img.stronghold66, // image
            xOffset, // target x
            yOffset, // target y
            tileSize, // target width
            tileSize // target height
          );
        }
      }
    }
  }
};

var renderForest = function(){
  // Get camera position (works for both logged in and login mode)
  var cameraPos = getCameraPosition();
  var pLoc = getLoc(cameraPos.x, cameraPos.y);
  var pc = pLoc[0];
  var pr = pLoc[1];

  // Get current z-layer (supports god mode, login mode, and normal play)
  var z = getCurrentZ();
  if(z != 0){
    return; // Only render forest on overworld
  }

  // Render forest for overworld (z=0)
    for (var c = viewport.startTile[0]; c < viewport.endTile[0]; c++){
      for (var r = viewport.startTile[1]; r < viewport.endTile[1]; r++){
        var xOffset = viewport.offset[0] + (c * tileSize);
        var yOffset = viewport.offset[1] + (r * tileSize);
        var dist =  function(){
          if((c == pc-1 && r == pr-1) ||
          (c == pc && r == pr-1) ||
          (c == pc+1 && r == pr-1) ||
          (c == pc-1 && r == pr) ||
          (c == pc && r == pr) ||
          (c == pc+1 && r == pr) ||
          (c == pc-1 && r == pr+1) ||
          (c == pc && r == pr+1) ||
          (c == pc+1 && r == pr+1)){
            return 40;
          } else if((c == pc-1 && r == pr-2) ||
          (c == pc && r == pr-2) ||
          (c == pc+1 && r == pr-2) ||
          (c == pc-2 && r == pr-1) ||
          (c == pc-2 && r == pr) ||
          (c == pc-2 && r == pr+1) ||
          (c == pc-1 && r == pr+2) ||
          (c == pc && r == pr+2) ||
          (c == pc+1 && r == pr+2) ||
          (c == pc+2 && r == pr-1) ||
          (c == pc+2 && r == pr) ||
          (c == pc+2 && r == pr+1)){
            return 60;
          } else if((c == pc-2 && r == pr-3) ||
          (c == pc-1 && r == pr-3) ||
          (c == pc && r == pr-3) ||
          (c == pc+1 && r == pr-3) ||
          (c == pc+2 && r == pr-3) ||
          (c == pc+2 && r == pr-2) ||
          (c == pc+3 && r == pr-2) ||
          (c == pc+3 && r == pr-1) ||
          (c == pc+3 && r == pr) ||
          (c == pc+3 && r == pr+1) ||
          (c == pc+3 && r == pr+2) ||
          (c == pc+2 && r == pr+2) ||
          (c == pc+2 && r == pr+3) ||
          (c == pc+1 && r == pr+3) ||
          (c == pc && r == pr+3) ||
          (c == pc-1 && r == pr+3) ||
          (c == pc-2 && r == pr+3) ||
          (c == pc-2 && r == pr+2) ||
          (c == pc-3 && r == pr+2) ||
          (c == pc-3 && r == pr+1) ||
          (c == pc-3 && r == pr) ||
          (c == pc-3 && r == pr-1) ||
          (c == pc-3 && r == pr-2) ||
          (c == pc-2 && r == pr-2)){
            return 80;
          } else {
            return;
          }
        }
        var tile = getTile(0, c, r);
        if(tile >= 1 && tile < 1.3){
          if(dist() == 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset - (tileSize/4), // target x
              yOffset - (tileSize/1.75), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          }
        } else if(tile >= 1 && tile < 1.6){
          if(dist() == 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset, // target x
              yOffset - (tileSize/1.25), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          }
        } else if(tile >= 1 && tile < 2){
          if(dist() == 40){
            ctx.drawImage(
              Img.hforest40, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 60){
            ctx.drawImage(
              Img.hforest60, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else if(dist() == 80){
            ctx.drawImage(
              Img.hforest80, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
          } else {
            ctx.drawImage(
              Img.hforest, // image
              xOffset, // target x
              yOffset - (tileSize/2), // target y
              tileSize, // target width
              tileSize * 1.5 // target height
            );
        }
      }
    }
  }
};

//lighting and light sources
// [z,x,y,radius]
var flickerRange = [0.4,0.65,0.7,0.75,0.75,0.8,0.8,0.85,0.9,0.95,1,1.5];
var flicker = 0;
setInterval(function(){
  flicker = flickerRange[Math.floor(Math.random() * flickerRange.length)];
}, 50);

var illuminate = function(x, y, radius, env){
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
  radius = (radius * (1 + rnd));
  var radialGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  radialGradient.addColorStop(0.0, '#BB9');
  radialGradient.addColorStop(0.2 + rnd, '#AA8');
  radialGradient.addColorStop(0.7 + rnd, '#330');
  radialGradient.addColorStop(0.90, '#110');
  radialGradient.addColorStop(1, '#000');
  ctx.fillStyle = radialGradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

var renderLightSources = function(env){
  // Skip lighting effects for ghosts
  if(selfId && Player.list[selfId] && Player.list[selfId].ghost){
    return; // No lighting effects in ghost mode
  }
  
  // Get camera position (works for both logged in and login mode)
  var cameraPos = getCameraPosition();
  
  for(i in Light.list){
    var light = Light.list[i];
    var rnd = (0.05 * Math.sin(1.1 * Date.now() / 200) * flicker);
    var x = light.x - cameraPos.x + WIDTH/2;
    var y = light.y - cameraPos.y + HEIGHT/2;
    
    // Get current z-layer (works for login camera, god mode, and normal play)
    var playerZ = getCurrentZ();
    
    if(light.z == playerZ || light.z == 99){
      illuminate(x,y,(45 * light.radius),env);
      illuminate(x,y,7,env);
      //remove darkness layer
      if((light.z == 0 || light.z == -1 || light.z == -2 || light.z == 99) || ((light.z == 1 || light.z == 2) && !hasFire(playerZ,cameraPos.x,cameraPos.y))){
        lighting.save();
        lighting.globalCompositeOperation = 'destination-out';
        
        // Apply zoom transform for the light cutout arc
        lighting.translate(WIDTH/2, HEIGHT/2);
        lighting.scale(currentZoom, currentZoom);
        lighting.translate(-WIDTH/2, -HEIGHT/2);
        
        lighting.beginPath();
        lighting.arc(x, y, ((45 * light.radius) * (1 + rnd)) * env, 0, 2 * Math.PI, false);
        lighting.fill();
        lighting.restore();
      }
    }
  }
}

var renderLighting = function(){
  // Get current z-layer (works for login camera, god mode, and normal play)
  var z = getCurrentZ();
  
  // Apply zoom transform to lighting canvas (matching main canvas)
  lighting.save();
  lighting.translate(WIDTH/2, HEIGHT/2);
  lighting.scale(currentZoom, currentZoom);
  lighting.translate(-WIDTH/2, -HEIGHT/2);
  
  // Ghost mode overrides all other lighting effects
  if(selfId && Player.list[selfId] && Player.list[selfId].ghost){
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(255, 255, 255, 0.65)"; // Very bright, washed out white
    lighting.fillRect(0,0,WIDTH,HEIGHT);
    lighting.restore(); // Restore transform before returning
    return; // Skip all other lighting effects
  }
  
  if(z == 0){
    if(tempus == 'IX.p' || tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' || tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.9)"; // night
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'IV.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.8)"; // early hours
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'V.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.6)"; // early morning
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VI.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(244, 214, 65, 0.1)"; // sunrise
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'|| tempus == 'X.a' || tempus == 'XI.a' || tempus == 'XII.p' || tempus == 'I.p' || tempus == 'II.p' || tempus == 'III.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT); // morning + daytime
    } else if(tempus == 'IV.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.07)"; // afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'V.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.1)"; // late afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VI.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(232, 112, 0, 0.25)"; // sunset
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VII.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.4)"; // twilight
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VIII.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(5, 5, 30, 0.7)"; // evening
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    }
  } else if(z == 1 || z == 2){
    var player = Player.list[selfId];
    if(tempus == 'IX.p' || tempus == 'X.p' || tempus == 'XI.p' || tempus == 'XII.a' || tempus == 'I.a' || tempus == 'II.a' || tempus == 'III.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.9)"; // night
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus == 'IV.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.8)"; // early hours
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus == 'V.a'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.6)"; // early morning
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus == 'VI.a'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(244, 214, 65, 0.1)"; // sunrise
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VII.a' || tempus == 'VIII.a' || tempus == 'IX.a'|| tempus == 'X.a' || tempus == 'XI.a' || tempus == 'XII.p' || tempus == 'I.p' || tempus == 'II.p' || tempus == 'III.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT); // morning + daytime
    } else if(tempus == 'IV.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.07)"; // afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'V.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(255, 204, 22, 0.1)"; // late afternoon
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VI.p'){
      lighting.clearRect(0,0,WIDTH,HEIGHT);
      lighting.fillStyle = "rgba(232, 112, 0, 0.25)"; // sunset
      lighting.fillRect(0,0,WIDTH,HEIGHT);
    } else if(tempus == 'VII.p'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.4)"; // twilight
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    } else if(tempus == 'VIII.p'){
      if(hasFire(player.z,player.x,player.y)){
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(224, 104, 0, 0.4)"; // fire
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      } else {
        lighting.clearRect(0,0,WIDTH,HEIGHT);
        lighting.fillStyle = "rgba(5, 5, 30, 0.7)"; // evening
        lighting.fillRect(0,0,WIDTH,HEIGHT);
      }
    }
  } else if(z == -1){
    ctx.fillStyle = "rgba(224, 104, 0, 0.3)"; // light layer
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 0, 0, 0.95)"; // darkness
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  } else if(z == -2){
    ctx.fillStyle = "rgba(224, 104, 0, 0.3)"; // light layer
    ctx.fillRect(0,0,WIDTH,HEIGHT);
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 0, 0, 0.85)"; // darkness
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  } else if(z == -3){
    lighting.clearRect(0,0,WIDTH,HEIGHT);
    lighting.fillStyle = "rgba(0, 48, 99, 0.9)"; // underwater
    lighting.fillRect(0,0,WIDTH,HEIGHT);
  }
  
  // Restore lighting canvas transform
  lighting.restore();
}

// CONTROLS
document.onkeydown = function(event){
  // Check if chat is focused (needs to be checked early for godmode)
  var chatFocus = (document.activeElement == chatInput);
  
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
      godModeCamera.changeZ(1);
      event.preventDefault();
      return;
    } else if (event.keyCode === 40) { // Down Arrow - Decrease z
      godModeCamera.changeZ(-1);
      event.preventDefault();
      return;
    } else if (event.keyCode === 37) { // Left Arrow - Previous faction
      godModeCamera.cycleFaction(-1);
      event.preventDefault();
      return;
    } else if (event.keyCode === 39) { // Right Arrow - Next faction
      godModeCamera.cycleFaction(1);
      event.preventDefault();
      return;
    } else if (event.keyCode === 13) { // Enter - Allow chat (for /godmode exit)
      // Focus chat input to allow typing /godmode to exit
      if(document.activeElement !== chatInput){
        event.preventDefault();
        chatInput.focus();
      }
      return;
    } else if (event.keyCode === 77) { // M - Allow worldmap in godmode
      // If worldmap is open, close it. Otherwise request data from server
      if(worldmapPopup && worldmapPopup.style.display === 'block'){
        worldmapPopup.style.display = 'none';
      } else {
        // Request worldmap data from server (only show popup if player has worldmap)
        socket.send(JSON.stringify({msg:'requestWorldMap'}));
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
  if(spectateCameraSystem && spectateCameraSystem.isActive) {
    if(event.keyCode == 27){ // ESC - Exit spectate mode
      spectateCameraSystem.stop();
      // Disconnect and return to login
      socket.close();
      location.reload(); // Reload page to return to login screen
      return;
    } else if(event.keyCode == 13){ // Enter - Allow chat
      // Allow chat input focus
      return;
    }
    // Block all other keys
    return;
  }
  
  // Block all game input during login
  if(loginCameraSystem.isActive) {
    return;
  }
  
  // chatFocus already declared at top of function
  if(!chatFocus){
    if(event.keyCode == 68){ // d
      socket.send(JSON.stringify({msg:'keyPress',inputId:'right',state:true}));
      Player.list[selfId].pressingRight = true;
    } else if(event.keyCode == 83){ // s
      socket.send(JSON.stringify({msg:'keyPress',inputId:'down',state:true}));
      Player.list[selfId].pressingDown = true;
    } else if(event.keyCode == 65){ // a
      socket.send(JSON.stringify({msg:'keyPress',inputId:'left',state:true}));
      Player.list[selfId].pressingLeft = true;
    } else if(event.keyCode == 87){ // w
      socket.send(JSON.stringify({msg:'keyPress',inputId:'up',state:true}));
      Player.list[selfId].pressingUp = true;
    } else if(event.keyCode == 32){ // space
      socket.send(JSON.stringify({msg:'keyPress',inputId:'attack',state:true}));
      Player.list[selfId].pressingAttack = true;
    } else if(event.keyCode == 69){ // e
      socket.send(JSON.stringify({msg:'keyPress',inputId:'e',state:true}));
    } else if(event.keyCode == 84){ // t
      socket.send(JSON.stringify({msg:'keyPress',inputId:'t',state:true}));
    } else if(event.keyCode == 73){ // i
      socket.send(JSON.stringify({msg:'keyPress',inputId:'i',state:true}));
    } else if(event.keyCode == 80){ // p
      socket.send(JSON.stringify({msg:'keyPress',inputId:'p',state:true}));
    } else if(event.keyCode == 70){ // f
      socket.send(JSON.stringify({msg:'keyPress',inputId:'f',state:true}));
    } else if(event.keyCode == 72){ // h
      socket.send(JSON.stringify({msg:'keyPress',inputId:'h',state:true}));
    } else if(event.keyCode == 75){ // k
      socket.send(JSON.stringify({msg:'keyPress',inputId:'k',state:true}));
    } else if(event.keyCode == 76){ // l
      socket.send(JSON.stringify({msg:'keyPress',inputId:'l',state:true}));
    } else if(event.keyCode == 88){ // x
      socket.send(JSON.stringify({msg:'keyPress',inputId:'x',state:true}));
    } else if(event.keyCode == 67){ // c
      // Open character popup
      if(characterPopup && characterPopup.style.display !== 'block'){
        characterPopup.style.display = 'block';
        updateCharacterDisplay();
        // Start real-time updates for HP/Spirit bars
        if(characterSheetUpdateInterval){
          clearInterval(characterSheetUpdateInterval);
        }
        characterSheetUpdateInterval = setInterval(function(){
          if(characterPopup && characterPopup.style.display === 'block' && Player.list[selfId]){
            updateCharacterBars(Player.list[selfId]); // Only update bars, not full sheet
          } else {
            clearInterval(characterSheetUpdateInterval);
            characterSheetUpdateInterval = null;
          }
        }, 100); // Update 10 times per second
      } else if(characterPopup){
        characterPopup.style.display = 'none';
        // Stop updates when closed
        if(characterSheetUpdateInterval){
          clearInterval(characterSheetUpdateInterval);
          characterSheetUpdateInterval = null;
        }
      }
    } else if(event.keyCode == 66){ // b
      // Open inventory popup
      if(inventoryPopup && inventoryPopup.style.display !== 'block'){
        inventoryPopup.style.display = 'block';
        updateInventoryDisplay();
      } else if(inventoryPopup){
        inventoryPopup.style.display = 'none';
      }
    } else if(event.keyCode == 77){ // m
      // If worldmap is open, close it. Otherwise request data from server
      if(worldmapPopup && worldmapPopup.style.display === 'block'){
        worldmapPopup.style.display = 'none';
      } else {
        // Request worldmap data from server (only show popup if player has worldmap)
        socket.send(JSON.stringify({msg:'requestWorldMap'}));
      }
  } else if(event.keyCode == 85){ // u - Build Menu
    // If build menu is open, close it. Otherwise request data from server
    if(buildMenuPopup && buildMenuPopup.style.display === 'block'){
      buildMenuPopup.style.display = 'none';
    } else {
      // Request build menu data from server
      socket.send(JSON.stringify({msg:'requestBuildMenu'}));
    }
  } else if(event.keyCode == 27){ // Escape - Cancel preview mode
    if(buildPreviewMode){
      buildPreviewMode = false;
      buildPreviewType = null;
      buildPreviewData = null;
      }
    } else if(event.keyCode == 78){ // n
      socket.send(JSON.stringify({msg:'keyPress',inputId:'n',state:true}));
    } else if(event.keyCode == 49){ // 1
      socket.send(JSON.stringify({msg:'keyPress',inputId:'1',state:true}));
    } else if(event.keyCode == 50){ // 2
      socket.send(JSON.stringify({msg:'keyPress',inputId:'2',state:true}));
    } else if(event.keyCode == 51){ // 3
      socket.send(JSON.stringify({msg:'keyPress',inputId:'3',state:true}));
    } else if(event.keyCode == 52){ // 4
      socket.send(JSON.stringify({msg:'keyPress',inputId:'4',state:true}));
    } else if(event.keyCode == 53){ // 5
      socket.send(JSON.stringify({msg:'keyPress',inputId:'5',state:true}));
    } else if(event.keyCode == 54){ // 6
      socket.send(JSON.stringify({msg:'keyPress',inputId:'6',state:true}));
    } else if(event.keyCode == 55){ // 7
      socket.send(JSON.stringify({msg:'keyPress',inputId:'7',state:true}));
    } else if(event.keyCode == 56){ // 8
      socket.send(JSON.stringify({msg:'keyPress',inputId:'8',state:true}));
    } else if(event.keyCode == 57){ // 9
      socket.send(JSON.stringify({msg:'keyPress',inputId:'9',state:true}));
    } else if(event.keyCode == 48){ // 0
      socket.send(JSON.stringify({msg:'keyPress',inputId:'0',state:true}));
    } else if(event.keyCode == 16){ // shift
      socket.send(JSON.stringify({msg:'keyPress',inputId:'shift',state:true}));
    }
  }
}

document.onkeyup = function(event){
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
  if(loginCameraSystem.isActive) {
    return;
  }
  
  if(event.keyCode == 68){ // d
    socket.send(JSON.stringify({msg:'keyPress',inputId:'right',state:false}));
    Player.list[selfId].pressingRight = false;
  } else if(event.keyCode == 83){ // s
    socket.send(JSON.stringify({msg:'keyPress',inputId:'down',state:false}));
    Player.list[selfId].pressingDown = false;
  } else if(event.keyCode == 65){ // a
    socket.send(JSON.stringify({msg:'keyPress',inputId:'left',state:false}));
    Player.list[selfId].pressingLeft = false;
  } else if(event.keyCode == 87){ // w
    socket.send(JSON.stringify({msg:'keyPress',inputId:'up',state:false}));
    Player.list[selfId].pressingUp = false;
  } else if(event.keyCode == 32){ // space
    socket.send(JSON.stringify({msg:'keyPress',inputId:'attack',state:false}));
    Player.list[selfId].pressingAttack = false;
  } else if(event.keyCode == 69){ // e
    socket.send(JSON.stringify({msg:'keyPress',inputId:'e',state:false}));
  } else if(event.keyCode == 84){ // t
    socket.send(JSON.stringify({msg:'keyPress',inputId:'t',state:false}));
  } else if(event.keyCode == 73){ // i
    socket.send(JSON.stringify({msg:'keyPress',inputId:'i',state:false}));
  } else if(event.keyCode == 80){ // p
    socket.send(JSON.stringify({msg:'keyPress',inputId:'p',state:false}));
  } else if(event.keyCode == 70){ // f
    socket.send(JSON.stringify({msg:'keyPress',inputId:'f',state:false}));
  } else if(event.keyCode == 72){ // h
    socket.send(JSON.stringify({msg:'keyPress',inputId:'h',state:false}));
  } else if(event.keyCode == 75){ // k
    socket.send(JSON.stringify({msg:'keyPress',inputId:'k',state:false}));
  } else if(event.keyCode == 76){ // l
    socket.send(JSON.stringify({msg:'keyPress',inputId:'l',state:false}));
  } else if(event.keyCode == 88){ // x
    socket.send(JSON.stringify({msg:'keyPress',inputId:'x',state:false}));
  } else if(event.keyCode == 67){ // c
    // C key handled on keydown only
  } else if(event.keyCode == 66){ // b
    // B key handled on keydown only
  } else if(event.keyCode == 78){ // n
    socket.send(JSON.stringify({msg:'keyPress',inputId:'n',state:false}));
  } else if(event.keyCode == 77){ // m
    // M key handled on keydown only
  } else if(event.keyCode == 49){ // 1
    socket.send(JSON.stringify({msg:'keyPress',inputId:'1',state:false}));
  } else if(event.keyCode == 50){ // 2
    socket.send(JSON.stringify({msg:'keyPress',inputId:'2',state:false}));
  } else if(event.keyCode == 51){ // 3
    socket.send(JSON.stringify({msg:'keyPress',inputId:'3',state:false}));
  } else if(event.keyCode == 52){ // 4
    socket.send(JSON.stringify({msg:'keyPress',inputId:'4',state:false}));
  } else if(event.keyCode == 53){ // 5
    socket.send(JSON.stringify({msg:'keyPress',inputId:'5',state:false}));
  } else if(event.keyCode == 54){ // 6
    socket.send(JSON.stringify({msg:'keyPress',inputId:'6',state:false}));
  } else if(event.keyCode == 55){ // 7
    socket.send(JSON.stringify({msg:'keyPress',inputId:'7',state:false}));
  } else if(event.keyCode == 56){ // 8
    socket.send(JSON.stringify({msg:'keyPress',inputId:'8',state:false}));
  } else if(event.keyCode == 57){ // 9
    socket.send(JSON.stringify({msg:'keyPress',inputId:'9',state:false}));
  } else if(event.keyCode == 48){ // 0
    socket.send(JSON.stringify({msg:'keyPress',inputId:'0',state:false}));
  } else if(event.keyCode == 16){ // shift
    socket.send(JSON.stringify({msg:'keyPress',inputId:'shift',state:false}));
  }
}

document.onmousemove = function(event){
  // Track mouse position for building preview
  mousePos.x = event.clientX;
  mousePos.y = event.clientY;
  
  if(selfId){
    var x = -250 + event.clientX - 8;
    var y = -250 + event.clientY - 8;
    var angle = Math.atan2(y,x) / Math.PI * 180;
    socket.send(JSON.stringify({msg:'keyPress',inputId:'mouseAngle',state:angle}));
  }
}

// Mouse click handlers for building placement
document.onclick = function(event) {
  if (buildPreviewMode && buildPreviewType && buildPreviewData) {
    // Check if click is on canvas
    var canvas = document.getElementById('ctx');
    if (canvas) {
      var rect = canvas.getBoundingClientRect();
      var clickX = event.clientX - rect.left;
      var clickY = event.clientY - rect.top;
      
      // Only handle clicks within canvas bounds
      if (clickX >= 0 && clickX <= canvas.width && clickY >= 0 && clickY <= canvas.height) {
        // Check if placement is valid
        if (buildPreviewData.valid) {
          // Execute build command with tile coordinates
          socket.send(JSON.stringify({
            msg: 'buildAt',
            buildingType: buildPreviewType,
            tileX: buildPreviewData.tileX,
            tileY: buildPreviewData.tileY
          }));
          
          // Exit preview mode
          buildPreviewMode = false;
          buildPreviewType = null;
          buildPreviewData = null;
        } else {
          // Invalid placement - exit preview mode
          buildPreviewMode = false;
          buildPreviewType = null;
          buildPreviewData = null;
        }
      }
    }
  }
};

document.oncontextmenu = function(event) {
  if (buildPreviewMode) {
    // Right click cancels preview mode
    event.preventDefault();
    buildPreviewMode = false;
    buildPreviewType = null;
    buildPreviewData = null;
  }
};

