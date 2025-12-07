var WIDTH = window.innerWidth;
var HEIGHT = window.innerHeight;
var world = [];
var tileSize = 0;
var mapSize = 0;

// Make these globally accessible for GameLoopManager
if (typeof window !== 'undefined') {
  window.world = world;
  window.tileSize = tileSize;
  window.mapSize = mapSize;
}

// Initialize entity lists early (before socket handlers that may access them)
// These will be properly initialized when their constructors are defined
var Player = function() {}; // Placeholder - will be replaced by actual constructor
Player.list = {};
var Arrow = function() {}; // Placeholder
Arrow.list = {};
var Item = function() {}; // Placeholder
Item.list = {};
var Light = function() {}; // Placeholder
Light.list = {};
var Building = function() {}; // Placeholder
Building.list = {};
var Weather = function() {}; // Placeholder
Weather.list = {};

// Sprite lookup table for O(1) performance (instead of 125+ if-else comparisons)
var spriteMap = null;

// Sprite helper extracted to SpriteHelper.js
var getSpriteForClass = (entityClass, isGhost) => window.spriteHelper?.getSpriteForClass?.(entityClass, isGhost) || (typeof maleserf !== 'undefined' ? maleserf : null);

// Ship wake system extracted to ShipWakeSystem.js
// ShipWakeSystem is loaded in index.html before this file, so it should be available
var shipWakes = new ShipWakeSystem();

// Tile highlight system extracted to TileHighlightSystem.js
// TileHighlightSystem is loaded in index.html before this file, so it should be available
var tileHighlights = new TileHighlightSystem();
// Expose to window for GameRenderer access
if (typeof window !== 'undefined') {
  window.tileHighlights = tileHighlights;
}

// Initialize CanvasManager - loaded before this file in index.html
if (!window.canvasManager) {
  window.canvasManager = new CanvasManager();
}

// Canvas resizing extracted to CanvasManager.js
function resizeCanvas() {
  if (window.canvasManager) {
    window.canvasManager.resizeCanvas({ viewport: viewport, tileSize: tileSize });
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
  } else {
    // Fallback: just update WIDTH and HEIGHT
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
  }
  // Update viewportManager screen size
  if (viewportManager) {
    viewportManager.setScreenSize(WIDTH, HEIGHT);
  }
  // Update viewport fallback screen size
  if (viewport && !viewportManager) {
    viewport.screen = [WIDTH, HEIGHT];
  }
}

// Canvas resize listeners extracted to CanvasManager.js
// Initialize canvas size on load and handle resize events
if (window.canvasManager) {
  window.canvasManager.initResizeListeners(resizeCanvas);
  // Call resize immediately (don't wait for load event)
  resizeCanvas();
} else {
  window.addEventListener('load', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);
  // Call resize immediately if DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    resizeCanvas();
  }
}

var socket = null;
// Make socket globally accessible for SocketManager
if (typeof window !== 'undefined') {
  window.socket = socket;
}

// Socket management extracted to SocketManager.js
// Use SocketManager.init() and SocketManager.cleanup() instead
var socketCleanup = function() {
  return SocketManager.cleanup();
};

var initSocket = function(){
  var newSocket = SocketManager.init();
  // Update local socket variable
  socket = newSocket;
  if (typeof window !== 'undefined') {
    window.socket = socket;
  }
  return newSocket;
};

// Initialize socket on page load
initSocket();

// SIGN IN
// UI elements extracted to UIInitializer.js
// Helper function to get UI elements
function getUIElement(id) {
  // UIInitializer stores elements by property name, not ID, so we use document.getElementById directly
  // If uiInitializer exists, we could map IDs to property names, but for now direct lookup is simpler
  return document.getElementById(id);
}

var enterButton = getUIElement('enter');
var enterOverlay = getUIElement('enterOverlay');
var loginOverlay = getUIElement('loginOverlay');
var signDivUsername = getUIElement('signDiv-username');
var signDivPassword = getUIElement('signDiv-password');
var signDivSignIn = getUIElement('signDiv-signIn');
var signDivSignUp = getUIElement('signDiv-signUp');
var signDivSpectate = getUIElement('signDiv-spectate');
var gameDiv = getUIElement('gameDiv');
var UI = getUIElement('UI');

// Login handlers extracted to LoginHandler.js
// LoginHandler is loaded before this file in index.html
var loginHandler = new LoginHandler({
    enterButton: enterButton,
    enterOverlay: enterOverlay,
    loginOverlay: loginOverlay,
    signDivUsername: signDivUsername,
    signDivPassword: signDivPassword,
    signDivSignIn: signDivSignIn,
    signDivSignUp: signDivSignUp,
    signDivSpectate: signDivSpectate,
    socket: socket,
    ambPlayer: typeof ambPlayer !== 'undefined' ? ambPlayer : null,
    bgmPlayer: typeof bgmPlayer !== 'undefined' ? bgmPlayer : null,
    title_bgm: typeof title_bgm !== 'undefined' ? title_bgm : null
  });

// LOGIN CAMERA SYSTEM
// Login camera system extracted to LoginCameraSystem.js
// LoginCameraSystem is loaded before this file in index.html
var loginCameraSystem = new LoginCameraSystem();
window.loginCameraSystem = loginCameraSystem;

// SPECTATE CAMERA SYSTEM
// Spectate camera system extracted to SpectateCameraSystem.js
// SpectateCameraSystem is loaded before this file in index.html
var spectateCameraSystem = new SpectateCameraSystem();
window.spectateCameraSystem = spectateCameraSystem;

// God Mode Camera System
// God mode camera system extracted to GodModeCameraSystem.js
// GodModeCameraSystem is loaded before this file in index.html
var godModeCamera = new GodModeCameraSystem();
window.godModeCamera = godModeCamera;

// Login camera will be started automatically when preview data is received

// CHAT & COMMANDS
// UI elements extracted to UIInitializer.js
var chatMessagesContainer = getUIElement('chat-messages-container');
var chatMessages = getUIElement('chat-messages');
var chatInputWrapper = getUIElement('chat-input-wrapper');
var chatInput = getUIElement('chat-input');
var chatForm = getUIElement('chat-form');
var chatHideTimer = null;

// INVENTORY UI
var inventoryButton = getUIElement('inventory-button');
var inventoryPopup = getUIElement('inventory-popup');
var inventoryGrid = getUIElement('inventory-grid');
var inventoryClose = getUIElement('inventory-close');
var characterButton = getUIElement('character-button');
var buildMenuButton = getUIElement('build-menu-button');

// CHARACTER UI
var characterPopup = getUIElement('character-popup');
var characterClose = getUIElement('character-close');

// CONTEXT MENU UI
var itemContextMenu = getUIElement('item-context-menu');
var dropQuantityModal = getUIElement('drop-quantity-modal');
var dropQuantityInput = getUIElement('drop-quantity-input');
var dropConfirmBtn = getUIElement('drop-confirm-btn');
var dropCancelBtn = getUIElement('drop-cancel-btn');

// Store current context for item actions
var currentContextItem = null;

// Character sheet update interval
var characterSheetUpdateInterval = null;

// Prevent multiple rapid clicks on same item
var lastClickedItem = null;
var lastClickTime = 0;

// MARKET UI
var marketPopup = getUIElement('market-popup');
var marketClose = getUIElement('market-close');
var marketOrderbook = getUIElement('market-orderbook');
var marketPlayerOrdersList = getUIElement('market-player-orders-list');
var marketItemSelect = getUIElement('market-item-select');
var marketAmount = getUIElement('market-amount');
var marketPrice = getUIElement('market-price');
var marketBuyBtn = getUIElement('market-buy-btn');
var marketSellBtn = getUIElement('market-sell-btn');
var currentMarketData = null;

// DEPOSIT UI
var depositPopup = getUIElement('deposit-popup');
var depositClose = getUIElement('deposit-close');
var depositSliders = getUIElement('deposit-sliders');
var depositConfirmBtn = getUIElement('deposit-confirm-btn');
var depositCancelBtn = getUIElement('deposit-cancel-btn');
var depositTitle = getUIElement('deposit-title');
var currentDepositData = null;

// WORLDMAP UI
var worldmapPopup = getUIElement('worldmap-popup');
var worldmapClose = getUIElement('worldmap-close');
var worldmapCanvas = getUIElement('worldmap-canvas');
var worldmapCtx = worldmapCanvas ? worldmapCanvas.getContext('2d') : null;

// CAVEMAP UI
var cavemapPopup = getUIElement('cavemap-popup');
var cavemapClose = getUIElement('cavemap-close');
var cavemapCanvas = getUIElement('cavemap-canvas');
var cavemapCtx = cavemapCanvas ? cavemapCanvas.getContext('2d') : null;

// Build Menu variables
var buildMenuPopup = getUIElement('build-menu-popup');
var buildMenuClose = getUIElement('build-menu-close');
var buildMenuContent = getUIElement('build-menu-content');
var buildPreviewMode = false;
var buildPreviewType = null;
var buildPreviewData = null;
var buildPreviewValidation = null;

// Mouse position tracking
var mousePos = { x: 0, y: 0 };

// DOCK UI
var dockPopup = getUIElement('dock-popup');
var dockClose = getUIElement('dock-close');
var dockShipList = getUIElement('dock-ship-list');
var dockOwnedShipsList = getUIElement('dock-owned-ships-list');
var dockCargoShipsList = getUIElement('dock-cargo-ships-list');
var currentDockData = null;

// Chat auto-hide functionality - now handled by ChatManager
// Wrapper function for backward compatibility (delegates to ChatManager)
function resetChatHideTimer(){
  if (window.chatManagerInstance) {
    window.chatManagerInstance.resetHideTimer();
  }
}

// Chat focus/blur handlers extracted to ChatManager.js
// ChatManager is loaded before this file in index.html
if (chatMessagesContainer && chatMessages && chatInput) {
  if (!window.chatManagerInstance) {
    window.chatManagerInstance = new ChatManager();
  }
  window.chatManagerInstance.init(chatMessagesContainer, chatMessages, chatInput);
}

// UI event handlers extracted to UIEventHandlers.js
// UIEventHandlers is loaded before this file in index.html
if (typeof UIEventHandlers !== 'undefined') {
  var uiEventHandlers = new UIEventHandlers({
    chatForm: chatForm,
    chatInput: chatInput,
    socket: socket,
    spectateCameraSystem: spectateCameraSystem,
    selfId: selfId,
    world: world,
    getPlayerIdForUI: getPlayerIdForUI,
    Player: Player,
    depositClose: depositClose,
    depositPopup: depositPopup,
    depositCancelBtn: depositCancelBtn,
    depositConfirmBtn: depositConfirmBtn,
    depositSliders: depositSliders,
    currentDepositData: { value: currentDepositData },
    inventoryButton: inventoryButton,
    inventoryPopup: inventoryPopup,
    inventoryClose: inventoryClose,
    updateInventoryDisplay: updateInventoryDisplay,
    characterButton: characterButton,
    characterPopup: characterPopup,
    characterClose: characterClose,
    updateCharacterDisplay: updateCharacterDisplay,
    characterSheetUpdateInterval: { value: characterSheetUpdateInterval },
    buildMenuButton: buildMenuButton,
    buildMenuPopup: buildMenuPopup,
    buildMenuClose: buildMenuClose,
    buildPreviewMode: { value: buildPreviewMode },
    buildPreviewType: { value: buildPreviewType },
    buildPreviewData: { value: buildPreviewData },
    marketClose: marketClose,
    marketPopup: marketPopup,
    marketBuyBtn: marketBuyBtn,
    marketSellBtn: marketSellBtn,
    marketItemSelect: marketItemSelect,
    marketAmount: marketAmount,
    marketPrice: marketPrice,
    worldmapClose: worldmapClose,
    worldmapPopup: worldmapPopup,
    cavemapClose: cavemapClose,
    cavemapPopup: cavemapPopup,
    itemContextMenu: itemContextMenu,
    dropCancelBtn: dropCancelBtn,
    dropQuantityModal: dropQuantityModal,
    currentContextItem: { value: currentContextItem }
  });
} else {
  // Legacy fallback - minimal implementations will be added as needed
  console.warn('UIEventHandlers not available, using legacy event handlers');
}

// WorldMap mouse hover functionality extracted to WorldMapHoverHandler.js
if (typeof WorldMapHoverHandler !== 'undefined' && worldmapCanvas) {
  window.worldMapHoverHandler = new WorldMapHoverHandler(worldmapCanvas, renderWorldMapWithHighlight);
}

// Helper functions extracted to respective modules
// Initialize InventoryItemImageHelper instance with Img
if (typeof InventoryItemImageHelper !== 'undefined' && !window.inventoryItemImageHelperInstance) {
  window.inventoryItemImageHelperInstance = new InventoryItemImageHelper();
  if (typeof Img !== 'undefined') {
    window.inventoryItemImageHelperInstance.setImageAssets(Img);
  }
}
var getInventoryItemImage = (itemType, qty) => window.inventoryItemImageHelperInstance?.getInventoryItemImage?.(itemType, qty) || null;
var getItemRank = (itemType) => ItemRarityHelper?.getItemRank?.(itemType) || 0;
var getRarityName = (rank) => ItemRarityHelper?.getRarityName?.(rank) || 'Common';
var getRarityColor = (rank) => ItemRarityHelper?.getRarityColor?.(rank) || '#ffffff';
var getRarityBorderColor = (rank) => ItemRarityHelper?.getRarityBorderColor?.(rank) || '#808080';
var updateInventoryDisplay = () => InventoryHandler?.updateDisplay?.();
var handleItemLeftClick = (itemType, itemName) => InventoryHandler?.handleLeftClick?.(itemType, itemName);
var showItemContextMenu = (e, itemType, itemName, count) => InventoryHandler?.showContextMenu?.(e, itemType, itemName, count);

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

// Portrait helper extracted to PortraitHelper.js
// Initialize PortraitHelper instance with Img
if (typeof PortraitHelper !== 'undefined' && !window.portraitHelperInstance) {
  window.portraitHelperInstance = new PortraitHelper();
  if (typeof Img !== 'undefined') {
    window.portraitHelperInstance.setImageAssets(Img);
  }
}
var getPortraitImage = (entityClass, entitySex) => window.portraitHelperInstance?.getPortraitImage?.(entityClass, entitySex) || (typeof Img !== 'undefined' ? Img.portraitSerfM : null);

// Portrait HUD functions extracted to PortraitUI.js
var updatePlayerPortraitHUD = () => {
  if (!window.portraitUIInstance) window.portraitUIInstance = new PortraitUI();
  const player = selfId && Player.list?.[selfId] ? Player.list[selfId] : null;
  if (player) window.portraitUIInstance.updatePlayerPortraitHUD(player);
  else { const hud = document.getElementById('player-portrait-hud'); if(hud) hud.classList.remove('active'); }
}
var updateTargetPortraitHUD = () => {
  if (!window.portraitUIInstance) window.portraitUIInstance = new PortraitUI();
  const target = selectedTarget && Player.list?.[selectedTarget] ? Player.list[selectedTarget] : null;
  window.portraitUIInstance?.updateTargetPortraitHUD(target, selectedTarget);
}

// Character display functions extracted to CharacterDisplayUI.js
var updateCharacterDisplay = (fullUpdate) => { if (!window.characterDisplayUIInstance) window.characterDisplayUIInstance = new CharacterDisplayUI(); window.characterDisplayUIInstance?.updateCharacterDisplay(fullUpdate); }
var updateCharacterBars = (player) => { if (!window.characterDisplayUIInstance) window.characterDisplayUIInstance = new CharacterDisplayUI(); window.characterDisplayUIInstance?.updateCharacterBars(player); }
var updateCharacterStats = (player) => { if (!window.characterDisplayUIInstance) window.characterDisplayUIInstance = new CharacterDisplayUI(); window.characterDisplayUIInstance?.updateCharacterStats(player); }
var updateCharacterSprite = (player) => { if (!window.characterDisplayUIInstance) window.characterDisplayUIInstance = new CharacterDisplayUI(); window.characterDisplayUIInstance?.updateCharacterSprite(player); }
var updateEquipmentSlot = (slotId, item, slotLabel) => { if (!window.characterDisplayUIInstance) window.characterDisplayUIInstance = new CharacterDisplayUI(); window.characterDisplayUIInstance?.updateEquipmentSlot(slotId, item, slotLabel); }

// World map rendering extracted to WorldMapRenderer.js
var renderWorldMap = (terrainData, mapSize, playerX, playerY, playerTileSize, features) => {
  window.lastWorldMapData = { terrain: terrainData, mapSize, playerX, playerY, tileSize: playerTileSize, features };
  renderWorldMapWithHighlight(terrainData, mapSize, playerX, playerY, playerTileSize, features, null);
}
var renderWorldMapWithHighlight = (terrainData, mapSize, playerX, playerY, playerTileSize, features, highlightedFeature) => {
  if (!worldmapCanvas) return;
  if (!window.worldMapRendererInstance) { 
    window.worldMapRendererInstance = new WorldMapRenderer(); 
    window.worldMapRendererInstance.init(worldmapCanvas); 
  }
  window.worldMapRendererInstance?.render(terrainData, mapSize, playerX, playerY, playerTileSize, features, highlightedFeature);
}

// Cave map rendering extracted to CaveMapRenderer.js
var renderCaveMap = (terrainData, mapSize, playerX, playerY, playerTileSize, blockingItems) => {
  if (!cavemapCanvas) return;
  if (!window.caveMapRendererInstance) { 
    window.caveMapRendererInstance = new CaveMapRenderer(); 
    window.caveMapRendererInstance.init(cavemapCanvas); 
  }
  window.caveMapRendererInstance?.render(terrainData, mapSize, playerX, playerY, playerTileSize, blockingItems);
}
// Catch emoji rendering extracted to CatchEmojiRenderer.js
var renderCatchEmojis = (ctx) => CatchEmojiRenderer?.render?.(ctx);

// Build menu rendering extracted to BuildMenuUI.js
var renderBuildMenu = (buildings, playerWood, playerStone) => {
  if (!window.buildMenuUIInstance) { window.buildMenuUIInstance = new BuildMenuUI(); window.buildMenuUIInstance.init(buildMenuContent); }
  return window.buildMenuUIInstance?.render(buildings, playerWood, playerStone, { socket, buildPreviewMode, buildPreviewType, buildMenuPopup });
}

// Send command to server (used by build menu and other UI components)
window.sendCommand = function(cmd) {
  if (typeof socket !== 'undefined' && socket && typeof socket.send === 'function') {
    socket.send(JSON.stringify({ msg: 'evalCmd', cmd: cmd }));
  } else {
    console.error('[sendCommand] Socket not available');
  }
};

// ============================================================================
// RESOURCE SCOREBOARD
// ============================================================================

var toggleResourceScoreboard = () => {
  const sb = document.getElementById('resource-scoreboard');
  if (!sb) return;
  if (sb.style.display === 'none' || sb.style.display === '') { sb.style.display = 'block'; socket.send(JSON.stringify({ msg: 'getResourceScoreboard' })); }
  else { sb.style.display = 'none'; }
}

// Scoreboard UI extracted to ScoreboardUI.js
var updateScoreboardUI = (factionResources) => { if (!window.scoreboardUIInstance) window.scoreboardUIInstance = new ScoreboardUI(); window.scoreboardUIInstance?.updateScoreboardUI(factionResources); }

document.addEventListener('DOMContentLoaded', () => {
  const cb = document.querySelector('.scoreboard-close');
  if (cb) cb.onclick = () => { const sb = document.getElementById('resource-scoreboard'); if(sb) sb.style.display = 'none'; };
});

// Building preview rendering
var renderBuildingPreview = () => {
  if (!buildPreviewMode || !buildPreviewType || !selfId || !Player.list[selfId]) {
    return;
  }
  
  // Get mouse position relative to canvas
  var canvas = document.getElementById('ctx');
  if (!canvas) return;
  
  var rect = canvas.getBoundingClientRect();
  var mouseX = mousePos.x - rect.left;
  var mouseY = mousePos.y - rect.top;
  
  // Convert screen coordinates to world coordinates
  // Reverse the zoom transform, then subtract viewport offset
  // Use window.currentZoom which is updated by GameLoopManager
  var zoom = (typeof window !== 'undefined' && window.currentZoom) || currentZoom || 1.0;
  var worldX = (mouseX - WIDTH / 2) / zoom + WIDTH / 2 - viewport.offset[0];
  var worldY = (mouseY - HEIGHT / 2) / zoom + HEIGHT / 2 - viewport.offset[1];
  
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
    var w = (window.world && window.world.length > 0) ? window.world : world;
    var isValid = isValidTileForBuilding(previewTileX, previewTileY, w);
    var isClearable = isClearableTile(previewTileX, previewTileY, w);
    
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
// Building preview helpers extracted to BuildingPreviewRenderer.js
// Initialize BuildingPreviewRenderer instance for helper methods
if (typeof BuildingPreviewRenderer !== 'undefined' && !window.buildingPreviewRendererHelper) {
  window.buildingPreviewRendererHelper = new BuildingPreviewRenderer();
}
var isValidTileForBuilding = (tileX, tileY, worldParam) => {
  var w = worldParam || (window.world && window.world.length > 0 ? window.world : world);
  return window.buildingPreviewRendererHelper?.isValidTileForBuilding?.(tileX, tileY, w) || false;
};
var isClearableTile = (tileX, tileY, worldParam) => {
  var w = worldParam || (window.world && window.world.length > 0 ? window.world : world);
  return window.buildingPreviewRendererHelper?.isClearableTile?.(tileX, tileY, w) || false;
};
var getBuildingDefinition = (buildingType) => window.buildingPreviewRendererHelper?.getBuildingDefinition?.(buildingType) || { plot: [[0,0]] };
var isValidBuildingPlacement = (tileX, tileY, buildingType, worldParam) => {
  var w = worldParam || (window.world && window.world.length > 0 ? window.world : world);
  return window.buildingPreviewRendererHelper?.isValidBuildingPlacement?.(tileX, tileY, buildingType, w) || false;
};

// Item emoji helper extracted to ItemEmojiHelper.js
var getItemEmoji = (itemType) => ItemEmojiHelper?.getItemEmoji?.(itemType) || '📦';
// Deposit UI extracted to DepositUI.js
var updateDepositDisplay = () => {
  if (!currentDepositData) return;
  if (!window.depositUIInstance) window.depositUIInstance = new DepositUI();
  var building = currentDepositData.building; var player = Player.list[getPlayerIdForUI()];
  if (building && player) window.depositUIInstance.updateDepositDisplay(building, player);
}
// Market UI extracted to MarketUI.js
var updateMarketDisplay = () => {
  if (!currentMarketData) return;
  if (!window.marketUIInstance) window.marketUIInstance = new MarketUI();
  window.marketUIInstance?.updateMarketDisplay(currentMarketData);
}
// Dock UI extracted to DockUI.js
var updateDockDisplay = () => {
  if (!currentDockData) return;
  if (!window.dockUIInstance) window.dockUIInstance = new DockUI();
  window.dockUIInstance?.updateDockDisplay(currentDockData);
}

// Dock close button handler
if(dockClose){
  dockClose.onclick = function(){
    dockPopup.style.display = 'none';
  };
}

// Auto-focus chat input when Enter is pressed
document.addEventListener('keydown', function(e){
  // Get chatInput reference at the start
  var chatInput = document.getElementById('chat-input');
  var isChatFocused = chatInput && document.activeElement === chatInput;
  
  // In spectate mode, allow Enter for chat and ESC to exit
  if(spectateCameraSystem && spectateCameraSystem.isActive) {
    if(e.key === 'Escape'){
      spectateCameraSystem.stop();
      socket.close();
      location.reload();
      return;
    }
    if(e.key === 'Enter' || e.keyCode === 13){
      if(!isChatFocused && chatInput){
        e.preventDefault();
        chatInput.focus();
        // Show chat messages container
        resetChatHideTimer();
      }
      // If chat is already focused, let Enter work normally (to submit messages)
      return;
    }
    return;
  }
  
  // Block all input during login
  if(loginCameraSystem && loginCameraSystem.isActive) {
    return;
  }
  
  // Toggle scoreboard on Tab
  if(e.key === 'Tab'){
    e.preventDefault();
    toggleResourceScoreboard();
    return;
  }
  
  // F key - Activate work command mode
  // Handle F key here, but don't stop propagation so document.onkeydown can also handle it if needed
  if((e.key === 'f' || e.key === 'F' || e.keyCode === 70) && !isChatFocused){
    // Only if not typing in chat
    workCommandMode = !workCommandMode;
    // Sync with InputHandler config
    if (inputHandler && inputHandler.config) {
      inputHandler.config.workCommandMode = workCommandMode;
    }
    // Also sync to window for renderCursor
    if (typeof window !== 'undefined') {
      window.workCommandMode = workCommandMode;
    }
    console.log('Work command mode toggled (addEventListener):', workCommandMode);
    e.preventDefault();
    // Don't stop propagation - let document.onkeydown handle it too for consistency
  }
  
  // Close popups on ESC
  if(e.key === 'Escape'){
    // Close scoreboard
    const scoreboard = document.getElementById('resource-scoreboard');
    if(scoreboard && scoreboard.style.display !== 'none'){
      scoreboard.style.display = 'none';
      return;
    }
    
    if(worldmapPopup && worldmapPopup.style.display === 'block'){
      worldmapPopup.style.display = 'none';
      return;
    }
    if(cavemapPopup && cavemapPopup.style.display === 'block'){
      cavemapPopup.style.display = 'none';
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
  
  // Enter key - focus chat if not focused, otherwise let it work normally (submit message)
  if(e.key === 'Enter' || e.keyCode === 13){
    if(!isChatFocused && chatInput){
      // Chat not focused - focus it and show chat messages
      e.preventDefault();
      chatInput.focus();
      // Show chat messages container
      resetChatHideTimer();
    }
    // If chat is already focused, don't prevent default - let Enter submit the message via form onsubmit
    // Don't return here, let the event continue to document.onkeydown if needed
  }
});

// GAME

// Audio system extracted to AudioSystem.js
// Use AudioSystem.soundscape() and AudioSystem.getBgm() instead
// Audio and stealth helpers extracted to respective modules
var soundscape = (x,y,z,b) => AudioSystem?.soundscape?.(x,y,z,b);
var getBgm = (x,y,z,b) => AudioSystem?.getBgm?.(x,y,z,b);
var stealthCheck = (id) => StealthSystem?.stealthCheck?.(id);

// Weather helper extracted to WeatherHelper.js
// Initialize singleton instance
if (typeof WeatherHelper !== 'undefined' && !window.weatherHelper) {
  window.weatherHelper = new WeatherHelper();
}
var getWeatherEffects = (x, y, z) => {
  if (typeof WeatherHelper === 'undefined' || !Weather.list) return null;
  return window.weatherHelper?.getWeatherEffects?.(x, y, z, { WeatherList: Weather.list, mapSize, tileSize }) || null;
}

// Rain particle system
var rainParticles = [];
var maxRainParticles = 500;
var lightningTimer = 0;

// Rain functions extracted to WeatherRenderer.js
var updateRain = (weatherEffects) => {
  if (!weatherRenderer || typeof weatherRenderer.updateRain !== 'function') {
    // Fallback: clear rain if no storm
    if (!weatherEffects?.storm?.active) rainParticles = [];
    return;
  }
  // WeatherRenderer.updateRain updates internal particles and doesn't return them
  weatherRenderer.updateRain(weatherEffects, WIDTH);
  // Update global rainParticles for backward compatibility if needed
  if (weatherRenderer.rainParticles) {
    rainParticles = weatherRenderer.rainParticles;
  }
  if (weatherRenderer.lightningFlash !== undefined) {
    lightningFlash = weatherRenderer.lightningFlash;
  }
}
var renderRain = () => { 
  if (!weatherRenderer || typeof weatherRenderer.renderRain !== 'function') return;
  var canvasCtx = ctx || (typeof window !== 'undefined' && window.canvasInitializer ? window.canvasInitializer.getCtx() : null);
  if (!canvasCtx) return;
  // WeatherRenderer.renderRain uses its own internal particles
  weatherRenderer.renderRain(canvasCtx);
}

var fly = 0;

// walking animation
var wlk = 0;

// working
var workingIcon = ['⌛️','⏳'];
var wrk = 0;

// Audio is now managed by AudioManager (see client/js/audio/AudioManager.js)
// Start AudioManager when player logs in
// AudioManager.start() is called after successful login

// Canvas initialization extracted to CanvasInitializer.js
// Initialize all canvas contexts and renderers
if (typeof CanvasInitializer !== 'undefined') {
  window.canvasInitializer = new CanvasInitializer();
  window.canvasInitializer.init({});
  // Ensure canvas is properly sized after initialization
  if (typeof resizeCanvas === 'function') {
    resizeCanvas();
  }
  // Get contexts from initializer for backward compatibility
  var ctx = window.canvasInitializer.getCtx();
  var lighting = window.canvasInitializer.getLighting();
  var cursorOverlayCanvas = window.canvasInitializer.getCursorOverlayCanvas();
  var cursorOverlayCtx = window.canvasInitializer.getCursorOverlayCtx();
  var lightingRenderer = window.canvasInitializer.getLightingRenderer();
  var lightSourceRenderer = window.canvasInitializer.getLightSourceRenderer();
  var mapRenderer = window.canvasInitializer.getMapRenderer();
} else {
  // Legacy fallback
  var ctx = document.getElementById('ctx').getContext('2d');
  var lighting = document.getElementById('lighting').getContext('2d');
  var cursorOverlayCanvas = document.getElementById('cursor-overlay');
  var cursorOverlayCtx = cursorOverlayCanvas ? cursorOverlayCanvas.getContext('2d') : null;
  if (ctx) ctx.font = '30px Arial';
  var lightingRenderer = typeof LightingRenderer !== 'undefined' ? new LightingRenderer() : null;
  var lightSourceRenderer = typeof LightSourceRenderer !== 'undefined' ? new LightSourceRenderer(lightingRenderer) : null;
  var mapRenderer = typeof MapRenderer !== 'undefined' ? new MapRenderer() : null;
  if (typeof window !== 'undefined' && mapRenderer) {
    window.mapRenderer = mapRenderer;
  }
}

// Initialize AnimationManager
var animationManager = typeof AnimationManager !== 'undefined' ? new AnimationManager() : null;

// Initialize ViewportManager
var viewportManager = typeof ViewportManager !== 'undefined' ? new ViewportManager() : null;
if (viewportManager) {
  viewportManager.setScreenSize(WIDTH, HEIGHT);
}

// Initialize WeatherRenderer instance
var weatherRenderer = typeof WeatherRenderer !== 'undefined' ? new WeatherRenderer() : null;
if (viewportManager) {
  viewportManager.screen = [WIDTH, HEIGHT];
}
// Create viewport fallback object for backward compatibility
var viewport = viewportManager || {
  screen: [WIDTH, HEIGHT], startTile: [0,0], endTile: [0,0], offset: [0,0],
  update: function(c, r, zoom, tileSizeParam, mapSizeParam){
    var ts = tileSizeParam || tileSize || 64;
    var ms = mapSizeParam || mapSize || 192;
    if (viewportManager && viewportManager.update) {
      viewportManager.screen = [WIDTH, HEIGHT];
      viewportManager.update(c, r, zoom, ts, ms);
      this.screen = viewportManager.screen;
      this.startTile = viewportManager.startTile;
      this.endTile = viewportManager.endTile;
      this.offset = viewportManager.offset;
    } else {
      // Fallback viewport calculation
      // Canvas is scaled by zoom, so tiles appear larger - we need fewer tiles
      var zoomFactor = zoom || 1.0;
      // When zoomed in (zoom > 1), tiles appear bigger, so we need fewer tiles
      // When zoomed out (zoom < 1), tiles appear smaller, so we need more tiles
      // But canvas scale makes everything bigger/smaller, so we divide by zoom
      var effectiveTileSize = ts * zoomFactor;
      var tilesWide = Math.ceil(WIDTH / effectiveTileSize);
      var tilesHigh = Math.ceil(HEIGHT / effectiveTileSize);
      
      // Camera position in tile coordinates
      var cameraTileX = c / ts;
      var cameraTileY = r / ts;
      
      // Start tile is camera position minus half the visible tiles
      var startCol = Math.floor(cameraTileX - tilesWide / 2);
      var startRow = Math.floor(cameraTileY - tilesHigh / 2);
      
      this.startTile = [startCol, startRow];
      this.endTile = [startCol + tilesWide, startRow + tilesHigh];
      
      // Offset calculation: center camera on screen
      // Canvas transform scales around center, so we offset to position camera at screen center
      this.offset = [WIDTH / 2 - c, HEIGHT / 2 - r];
      
      // Debug: Log viewport calculation (only once per second)
      if (!window._viewportDebugLog || Date.now() - window._viewportDebugLog > 1000) {
        var tileCount = (this.endTile[0] - this.startTile[0]) * (this.endTile[1] - this.startTile[1]);
        var expectedCount = Math.ceil(WIDTH / effectiveTileSize) * Math.ceil(HEIGHT / effectiveTileSize);
        console.log('Viewport calculation', {
          camera: { x: c, y: r },
          cameraTile: { x: cameraTileX, y: cameraTileY },
          tileSize: ts,
          zoom: zoom,
          zoomFactor: zoomFactor,
          effectiveTileSize: effectiveTileSize,
          tilesWide,
          tilesHigh,
          tileCount: tileCount,
          expectedCount: expectedCount,
          startTile: this.startTile,
          endTile: this.endTile,
          offset: this.offset,
          WIDTH,
          HEIGHT
        });
        window._viewportDebugLog = Date.now();
      }
    }
  }
};

// Expose viewport to window for InputHandler access
if (typeof window !== 'undefined') {
  window.viewport = viewport;
}

// Initialize MapCoordinateHelper (singleton)
var mapCoordinateHelper = typeof MapCoordinateHelper !== 'undefined' ? new MapCoordinateHelper() : null;

// Map coordinate helper functions extracted to MapCoordinateHelper.js
var getTile = (l, c, r) => {
  var w = (window.world && window.world.length > 0) ? window.world : world;
  return mapCoordinateHelper?.getTile?.(l, c, r, w) || (w[l]?.[r]?.[c]) || 0;
}
var getLoc = (x, y) => mapCoordinateHelper?.getLoc?.(x, y, tileSize) || [Math.floor(x/tileSize), Math.floor(y/tileSize)];
var getLocTile = (l, x, y) => {
  var loc = getLoc(x, y);
  return getTile(l, loc[0], loc[1]);
}
var getCoords = (c, r) => mapCoordinateHelper?.getCoords?.(c, r, tileSize) || [c * tileSize, r * tileSize];
var getBuilding = (x, y, includeWallsAndTopPlot = false) => mapCoordinateHelper?.getBuilding?.(x, y, tileSize, Building.list, includeWallsAndTopPlot) || null;

// Ally check helper extracted to AllyCheckHelper.js
// Initialize singleton instance
if (typeof AllyCheckHelper !== 'undefined' && !window.allyCheckHelper) {
  window.allyCheckHelper = new AllyCheckHelper();
}
var houseList = null;
var kingdomList = null;
var allyCheck = (id) => {
  if (typeof AllyCheckHelper !== 'undefined' && window.allyCheckHelper) {
    // Use window.selfId if available (updated by SocketMessageHandler), otherwise use local selfId
    var currentSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null) 
      ? window.selfId 
      : selfId;
    return window.allyCheckHelper.check(id, { selfId: currentSelfId, PlayerList: Player.list, houseList, kingdomList });
  }
  // Fallback: simple check
  var currentSelfId = (typeof window !== 'undefined' && window.selfId !== undefined && window.selfId !== null) 
    ? window.selfId 
    : selfId;
  return (!currentSelfId || !Player.list[currentSelfId]) ? 0 : (currentSelfId === id ? 2 : 0);
}
// Expose on window for access by other modules
if(typeof window !== 'undefined') {
  window.allyCheck = allyCheck;
}

// GameHelper extracted to GameHelper.js
var getPlayerIdForUI = () => window.gameHelper?.getPlayerIdForUI?.(selfId, Player.list) || (window.originalPlayerId && Player.list[window.originalPlayerId] ? window.originalPlayerId : selfId);

// Camera helpers extracted to CameraHelper.js
// Initialize singleton instance
if (typeof CameraHelper !== 'undefined' && !window.cameraHelper) {
  window.cameraHelper = new CameraHelper();
}
var getCameraPosition = () => {
  if (typeof CameraHelper !== 'undefined' && window.cameraHelper) {
    return window.cameraHelper.getCameraPosition({ spectateCameraSystem, godModeCamera, loginCameraSystem, selfId, PlayerList: Player.list });
  }
  return (selfId && Player.list[selfId]) ? { x: Player.list[selfId].x, y: Player.list[selfId].y } : { x: 0, y: 0 };
}
var getCurrentZ = () => {
  if (typeof CameraHelper !== 'undefined' && window.cameraHelper) {
    return window.cameraHelper.getCurrentZ({ spectateCameraSystem, godModeCamera, selfId, PlayerList: Player.list });
  }
  return (selfId && Player.list[selfId]) ? Player.list[selfId].z : 0;
}

// Zoom system extracted to ZoomHelper.js
// Use window.zoomHelper instead
// Initialize zoom to 1.0 (no zoom) - will be updated by GameLoopManager
var currentZoom = 1.0;
var targetZoom = 1.0;
var zoomTransitionSpeed = 0.05; // How fast zoom transitions (higher = faster)

// Zoom helper extracted to ZoomHelper.js
var getTargetZoom = () => window.zoomHelper?.getTargetZoom?.({ getCurrentZ, selfId, PlayerList: Player.list, loginCameraSystem, getTile, getLoc }) || 1.0;

// Entity constructors extracted to EntityInitializer.js
if (typeof EntityInitializer !== 'undefined' && window.entityInitializer) {
  // Ensure PlayerEntity is available (from PlayerEntity.js script)
  const PlayerEntityConstructor = typeof PlayerEntity !== 'undefined' ? PlayerEntity : (typeof window !== 'undefined' && window.PlayerEntity ? window.PlayerEntity : null);
  if (PlayerEntityConstructor) {
    window.entityInitializer.initPlayer(PlayerEntityConstructor, getSpriteForClass);
    window.entityInitializer.initArrow(typeof ArrowEntity !== 'undefined' ? ArrowEntity : (typeof window !== 'undefined' && window.ArrowEntity ? window.ArrowEntity : null));
    window.entityInitializer.initItem(typeof ItemEntity !== 'undefined' ? ItemEntity : (typeof window !== 'undefined' && window.ItemEntity ? window.ItemEntity : null));
    window.entityInitializer.initLight(typeof LightEntity !== 'undefined' ? LightEntity : (typeof window !== 'undefined' && window.LightEntity ? window.LightEntity : null));
    window.entityInitializer.initBuilding(typeof BuildingEntity !== 'undefined' ? BuildingEntity : (typeof window !== 'undefined' && window.BuildingEntity ? window.BuildingEntity : null));
    Player = window.Player;
    Arrow = window.Arrow;
    Item = window.Item;
    Light = window.Light;
    Building = window.Building;
  } else {
    console.warn('PlayerEntity not available for initialization');
  }
} else {
  // Fallback: use EntityInitializer pattern directly
  Building = typeof BuildingEntity !== 'undefined' ? BuildingEntity : (initPack) => { if(!Building.list) Building.list = {}; var s = { id: initPack.id, type: initPack.type, hp: initPack.hp, occ: initPack.occ, plot: initPack.plot, walls: initPack.walls, topPlot: initPack.topPlot }; Building.list[s.id] = s; return s; };
  Player = typeof PlayerEntity !== 'undefined' ? PlayerEntity : (initPack) => { if(!Player.list) Player.list = {}; var s = { type: initPack.type, name: initPack.name, id: initPack.id, x: initPack.x, y: initPack.y, z: initPack.z, class: initPack.class, hp: initPack.hp, hpMax: initPack.hpMax, sprite: null, spriteSize: initPack.spriteSize || 64, draw: () => {} }; Player.list[s.id] = s; return s; };
  Arrow = typeof ArrowEntity !== 'undefined' ? ArrowEntity : (initPack) => { if(!Arrow.list) Arrow.list = {}; var s = { id: initPack.id, angle: initPack.angle, number: initPack.number, x: initPack.x, y: initPack.y, z: initPack.z, innaWoods: initPack.innaWoods, draw: () => {} }; Arrow.list[s.id] = s; return s; };
  Item = typeof ItemEntity !== 'undefined' ? ItemEntity : (initPack) => { if(!Item.list) Item.list = {}; var s = { id: initPack.id, type: initPack.type, x: initPack.x, y: initPack.y, z: initPack.z, qty: initPack.qty, innaWoods: initPack.innaWoods, sunk: initPack.sunk || false, draw: () => {} }; Item.list[s.id] = s; return s; };
  Light = typeof LightEntity !== 'undefined' ? LightEntity : (initPack) => { if(!Light.list) Light.list = {}; var s = { id: initPack.id, x: initPack.x, y: initPack.y, z: initPack.z, radius: initPack.radius }; Light.list[s.id] = s; return s; };
  if(!Light.list) Light.list = {};
  if(!Light.list.antilag) Light.list.antilag = { id: null, x: -100, y: -100, z: 99, radius: 0 };
}

// player's id
var selfId = null;
// Expose on window for access by other modules (also used by SocketManager)
if(typeof window !== 'undefined') {
  window.selfId = selfId;
}

// Game state variables
var tempus = null;
var nightfall = null;
var lightningFlash = false;

// Mouse-based interaction system
var attackCommandMode = false; // A key toggles attack command mode
var workCommandMode = false; // F key activates work command mode
var selectedTarget = null; // Currently selected entity ID
var hoveredTarget = null; // Entity ID under mouse cursor
// Expose on window for access by other modules
if(typeof window !== 'undefined') {
  window.selectedTarget = selectedTarget;
  window.hoveredTarget = hoveredTarget;
}
var hoveredInteractable = null; // Interactable building or object under mouse cursor
var currentMouseX = 0; // Current mouse X position (screen coordinates)
var currentMouseY = 0; // Current mouse Y position (screen coordinates)
var currentCursor = 'default'; // Current cursor type: 'default', 'attack', 'interact', 'work', 'rally'

// Animation timers
var wtr = 0; // water
var waterTiles = [Img.water1,Img.water2,Img.water3];

var cld = 0; // clouds
var clouds = [Img.clouds1,Img.clouds2,Img.clouds3];

// Visibility helpers extracted to VisibilityHelper.js
// Initialize singleton instance
if (typeof VisibilityHelper !== 'undefined' && !window.visibilityHelper) {
  window.visibilityHelper = new VisibilityHelper();
}
var inView = (z,x,y,innaWoods) => {
  if (typeof VisibilityHelper !== 'undefined' && window.visibilityHelper) {
    return window.visibilityHelper.inView(z, x, y, innaWoods, { spectateCameraSystem, godModeCamera, selfId, PlayerList: Player.list, viewport, tileSize });
  }
  if(!selfId || !Player.list[selfId]) return false;
  var t = (viewport.startTile[1] - 1) * tileSize; var l = (viewport.startTile[0] - 1) * tileSize;
  var r = (viewport.endTile[0] + 2) * tileSize; var b = (viewport.endTile[1] + 2) * tileSize;
  return (z == Player.list[selfId].z && x > l && x < r && y > t && y < b && !(z == 0 && innaWoods && !Player.list[selfId].innaWoods));
}
var inViewLogin = (x,y) => {
  if (typeof VisibilityHelper !== 'undefined' && window.visibilityHelper) {
    return window.visibilityHelper.inViewLogin(x, y, { viewport, tileSize });
  }
  var t = (viewport.startTile[1] - 1) * tileSize; var l = (viewport.startTile[0] - 1) * tileSize;
  var r = (viewport.endTile[0] + 2) * tileSize; var b = (viewport.endTile[1] + 2) * tileSize;
  return (x > l && x < r && y > t && y < b);
}

// Fire detection helper extracted to GameHelper.js
var hasFire = function(z,x,y){
  return window.gameHelper?.hasFire?.(z, x, y, Light.list, tileSize, getBuilding) || false;
}

// Unified rendering extracted to GameRenderer.js
var renderUnified = (mode, currentZ, nightfall) => {
  if (!window.gameRendererInstance) window.gameRendererInstance = new GameRenderer(ctx, lighting);
  if (!window._renderStats) window._renderStats = { entitiesIterated: { players: 0, items: 0, arrows: 0, buildings: 0 }, entitiesRendered: { players: 0, items: 0, arrows: 0, buildings: 0 } };
  window.gameRendererInstance?.render({ mode, currentZ, nightfall, camera: getCameraPosition(), viewport, tileSize, mapSize });
}

// ============================================================================
// MAIN GAME LOOP - requestAnimationFrame (60 FPS)
// ============================================================================

// Delta time tracking for smooth animations
var lastFrameTime = performance.now();

// AnimationManager extracted to AnimationManager.js
var updateAnimations = (deltaTime) => {
  if (animationManager?.update) {
    // checkInView function - checks if entity is in viewport
    var checkInView = (entity) => {
      if (!entity || !viewport) return false;
      var screenX = entity.x + viewport.offset[0];
      var screenY = entity.y + viewport.offset[1];
      return screenX >= -tileSize && screenX <= WIDTH + tileSize && 
             screenY >= -tileSize && screenY <= HEIGHT + tileSize;
    };
    animationManager.update(deltaTime, { 
      shipWakes, 
      tileHighlights, 
      tileSize, 
      PlayerList: Player.list,
      checkInView 
    });
    var f = animationManager.getFrames();
    wtr = f.water; cld = f.clouds; flicker = f.flicker; fly = f.fly; wlk = f.walk; wrk = f.working;
  }
}

// Game loop extracted to GameLoopManager.js
// Use gameLoopManager.start() instead
var gameLoopManager = typeof GameLoopManager !== 'undefined' ? new GameLoopManager() : null;

// Main game loop using requestAnimationFrame
// Wrapper function that delegates to GameLoopManager
function gameLoop(currentTime) {
  if (gameLoopManager && gameLoopManager.gameLoop) {
    gameLoopManager.gameLoop(currentTime, {
      selfId: selfId,
      loginCameraSystem: loginCameraSystem,
      spectateCameraSystem: spectateCameraSystem,
      godModeCamera: godModeCamera,
      world: world,
      tileSize: tileSize,
      mapSize: mapSize,
      getTargetZoom: getTargetZoom,
      currentZoom: currentZoom,
      zoomTransitionSpeed: zoomTransitionSpeed,
      targetZoom: targetZoom,
      ctx: ctx,
      WIDTH: WIDTH,
      HEIGHT: HEIGHT,
      renderMap: renderMap,
      renderUnified: renderUnified,
      getCurrentZ: getCurrentZ,
      nightfall: nightfall,
      getCameraPosition: getCameraPosition,
      getWeatherEffects: getWeatherEffects,
      updateRain: updateRain,
      renderRain: renderRain,
      updatePlayerPortraitHUD: updatePlayerPortraitHUD,
      updateTargetPortraitHUD: updateTargetPortraitHUD,
      renderCursor: renderCursor,
      buildPreviewMode: buildPreviewMode,
      buildPreviewType: buildPreviewType,
      renderBuildingPreview: renderBuildingPreview,
      updateAnimations: updateAnimations,
      Player: Player,
      viewport: viewport
    });
    return;
  }
  
  // Legacy fallback (should not be reached if GameLoopManager is loaded)
  console.warn('GameLoopManager not available, using legacy game loop');
  requestAnimationFrame(gameLoop);
}

// Map rendering extracted to MapRenderer.js
var renderMap = () => {
  var r = window.mapRenderer || mapRenderer || null;
  if (r?.render) {
    var w = window.world || world || null;
    r.render({ ctx, WIDTH, HEIGHT, currentZoom, tileSize, viewport, getCurrentZ, Building, Player, world: w, getTile, getBuilding, clouds, cld, waterTiles, wtr, Img, shipWakes, selfId, godModeCamera, BuildingPreviewRenderer: window.BuildingPreviewRenderer || null });
  }
}

// Cursor rendering extracted to CursorRenderer.js
if (!window.cursorRendererInstance && typeof window.CursorRenderer !== 'undefined') window.cursorRendererInstance = new window.CursorRenderer();
var renderCursor = () => {
  // Get current mouse position from window (updated by InputHandler) or fallback to global
  const mouseX = (typeof window !== 'undefined' && window.currentMouseX !== undefined) ? window.currentMouseX : currentMouseX;
  const mouseY = (typeof window !== 'undefined' && window.currentMouseY !== undefined) ? window.currentMouseY : currentMouseY;
  window.cursorRendererInstance?.render?.({ Img, workCommandMode, attackCommandMode, hoveredTarget, hoveredInteractable, allyCheck, currentMouseX: mouseX, currentMouseY: mouseY, WIDTH, HEIGHT, Building, cursorOverlayCtx, cursorOverlayCanvas });
};

// Start the game loop
if (gameLoopManager?.start) {
  gameLoopManager.start({ selfId, loginCameraSystem, spectateCameraSystem, godModeCamera, world, tileSize, mapSize, getTargetZoom, currentZoom, zoomTransitionSpeed, targetZoom, ctx, WIDTH, HEIGHT, renderMap, renderUnified, getCurrentZ, nightfall, getCameraPosition, getWeatherEffects, updateRain, renderRain, updatePlayerPortraitHUD, updateTargetPortraitHUD, renderCursor, buildPreviewMode, buildPreviewType, renderBuildingPreview, updateAnimations, Player, viewport });
} else {
  console.warn('GameLoopManager not available, using legacy game loop');
  requestAnimationFrame(gameLoop);
}

//lighting and light sources
// [z,x,y,radius]
var flickerRange = [0.4,0.65,0.7,0.75,0.75,0.8,0.8,0.85,0.9,0.95,1,1.5];
var flicker = 0;

// Dark layer canvas for caves/cellars (shared between LightingRenderer and LightSourceRenderer)
var darkLayerCanvas = null;
var darkLayerCtx = null;

// Light source functions extracted to LightSourceRenderer.js
var illuminate = (x, y, radius, env) => lightSourceRenderer?.illuminate?.(x, y, radius, env, ctx, flicker);
var renderLightSources = (env) => lightSourceRenderer?.render?.(env, { selfId, PlayerList: Player.list, Light, lighting, flicker, getCameraPosition, getCurrentZ, hasFire, WIDTH, HEIGHT, currentZoom, ctx, darkLayerCanvas, darkLayerCtx });

var renderWeatherOverlay = () => {}; // Deprecated

// Lighting extracted to LightingRenderer.js
var renderLighting = () => {
  if (lightingRenderer) {
    lightingRenderer.render({ lighting, getCurrentZ, getCameraPosition, getWeatherEffects, hasFire, tempus, nightfall, lightningFlash, currentZoom, WIDTH, HEIGHT, selfId, PlayerList: Player.list });
    // Retrieve dark layer canvas/context AFTER rendering (it's created/filled during render)
    darkLayerCanvas = lightingRenderer.getDarkLayerCanvas();
    darkLayerCtx = lightingRenderer.getDarkLayerCtx();
  }
}

// Input handlers extracted to InputHandler.js
var inputHandler = null;

function initializeInputHandler() {
  if (typeof InputHandlerInitializer !== 'undefined') {
    var initializer = new InputHandlerInitializer();
    inputHandler = initializer.init({
      // Game state
      selfId: selfId, Player: Player, Building: Building, Item: Item, socket: socket,
      // Camera systems
      godModeCamera: godModeCamera, spectateCameraSystem: spectateCameraSystem, loginCameraSystem: loginCameraSystem,
      // UI elements
      worldmapPopup: worldmapPopup, cavemapPopup: cavemapPopup, buildMenuPopup: buildMenuPopup,
      inventoryPopup: inventoryPopup, characterPopup: characterPopup,
      // Game state variables (mutable)
      attackCommandMode: attackCommandMode, workCommandMode: workCommandMode,
      buildPreviewMode: buildPreviewMode, buildPreviewType: buildPreviewType, buildPreviewData: buildPreviewData,
      selectedTarget: selectedTarget, hoveredTarget: hoveredTarget, hoveredInteractable: hoveredInteractable,
      mousePos: mousePos, currentMouseX: currentMouseX, currentMouseY: currentMouseY,
      characterSheetUpdateInterval: characterSheetUpdateInterval,
      // Helper functions
      getLoc: getLoc, getBuilding: getBuilding, getTile: getTile, allyCheck: allyCheck, getBgm: getBgm,
      getCameraPosition: getCameraPosition,
      updateCharacterDisplay: updateCharacterDisplay, updateCharacterBars: updateCharacterBars,
      updateInventoryDisplay: updateInventoryDisplay,
      // Constants
      WIDTH: WIDTH, HEIGHT: HEIGHT, currentZoom: currentZoom, tileSize: tileSize, tileHighlights: tileHighlights,
      viewport: viewport,
      // Update config function
      updateConfig: function() {
        return {
          selfId: selfId, attackCommandMode: attackCommandMode, workCommandMode: workCommandMode,
          buildPreviewMode: buildPreviewMode, buildPreviewType: buildPreviewType, buildPreviewData: buildPreviewData,
          selectedTarget: selectedTarget, hoveredTarget: hoveredTarget, hoveredInteractable: hoveredInteractable,
          currentMouseX: currentMouseX, currentMouseY: currentMouseY, characterSheetUpdateInterval: characterSheetUpdateInterval
        };
      }
    });
    window.inputHandlerInitializer = initializer;
    // Expose inputHandler on window for access by other modules
    if (inputHandler) {
      window.inputHandler = inputHandler;
    }
  } else if (typeof InputHandler !== 'undefined') {
    // Fallback: create InputHandler directly
    inputHandler = new InputHandler({
      selfId: selfId, Player: Player, Building: Building, Item: Item, socket: socket,
      godModeCamera: godModeCamera, spectateCameraSystem: spectateCameraSystem, loginCameraSystem: loginCameraSystem,
      worldmapPopup: worldmapPopup, cavemapPopup: cavemapPopup, buildMenuPopup: buildMenuPopup,
      inventoryPopup: inventoryPopup, characterPopup: characterPopup,
      attackCommandMode: attackCommandMode, workCommandMode: workCommandMode,
      buildPreviewMode: buildPreviewMode, buildPreviewType: buildPreviewType, buildPreviewData: buildPreviewData,
      selectedTarget: selectedTarget, hoveredTarget: hoveredTarget, hoveredInteractable: hoveredInteractable,
      mousePos: mousePos, currentMouseX: currentMouseX, currentMouseY: currentMouseY,
      characterSheetUpdateInterval: characterSheetUpdateInterval,
      getLoc: getLoc, getBuilding: getBuilding, getTile: getTile, allyCheck: allyCheck, getBgm: getBgm,
      getCameraPosition: getCameraPosition,
      updateCharacterDisplay: updateCharacterDisplay, updateCharacterBars: updateCharacterBars,
      updateInventoryDisplay: updateInventoryDisplay,
      WIDTH: WIDTH, HEIGHT: HEIGHT, currentZoom: currentZoom, tileSize: tileSize, tileHighlights: tileHighlights,
      viewport: viewport
    });
    // Expose inputHandler on window for access by other modules
    if (inputHandler) {
      window.inputHandler = inputHandler;
    }
    setInterval(() => {
      if (inputHandler) {
        inputHandler.updateConfig({
          selfId: selfId, attackCommandMode: attackCommandMode, workCommandMode: workCommandMode,
          buildPreviewMode: buildPreviewMode, buildPreviewType: buildPreviewType, buildPreviewData: buildPreviewData,
          selectedTarget: selectedTarget, hoveredTarget: hoveredTarget, hoveredInteractable: hoveredInteractable,
          currentMouseX: currentMouseX, currentMouseY: currentMouseY, characterSheetUpdateInterval: characterSheetUpdateInterval,
          WIDTH: WIDTH, HEIGHT: HEIGHT, currentZoom: currentZoom, tileSize: tileSize, viewport: viewport
        });
      }
    }, 100);
  }
}

// Initialize InputHandler after all dependencies are loaded
if (typeof InputHandler !== 'undefined') {
  initializeInputHandler();
}
