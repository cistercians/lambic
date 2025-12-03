/**
 * UIInitializer - Centralizes DOM element references and UI initialization
 * 
 * Extracted from client.js for better organization.
 */

class UIInitializer {
  constructor() {
    this.elements = {
      // Sign In
      enterButton: null,
      enterOverlay: null,
      loginOverlay: null,
      signDivUsername: null,
      signDivPassword: null,
      signDivSignIn: null,
      signDivSignUp: null,
      signDivSpectate: null,
      gameDiv: null,
      UI: null,
      
      // Chat
      chatMessagesContainer: null,
      chatMessages: null,
      chatInputWrapper: null,
      chatInput: null,
      chatForm: null,
      
      // Inventory
      inventoryButton: null,
      inventoryPopup: null,
      inventoryGrid: null,
      inventoryClose: null,
      characterButton: null,
      buildMenuButton: null,
      
      // Character
      characterPopup: null,
      characterClose: null,
      
      // Context Menu
      itemContextMenu: null,
      dropQuantityModal: null,
      dropQuantityInput: null,
      dropConfirmBtn: null,
      dropCancelBtn: null,
      
      // Market
      marketPopup: null,
      marketClose: null,
      marketOrderbook: null,
      marketPlayerOrdersList: null,
      marketItemSelect: null,
      marketAmount: null,
      marketPrice: null,
      marketBuyBtn: null,
      marketSellBtn: null,
      
      // Deposit
      depositPopup: null,
      depositClose: null,
      depositSliders: null,
      depositConfirmBtn: null,
      depositCancelBtn: null,
      depositTitle: null,
      
      // WorldMap
      worldmapPopup: null,
      worldmapClose: null,
      worldmapCanvas: null,
      worldmapCtx: null,
      
      // CaveMap
      cavemapPopup: null,
      cavemapClose: null,
      cavemapCanvas: null,
      cavemapCtx: null,
      
      // Build Menu
      buildMenuPopup: null,
      buildMenuClose: null,
      buildMenuContent: null,
      
      // Dock
      dockPopup: null,
      dockClose: null,
      dockShipList: null,
      dockOwnedShipsList: null,
      dockCargoShipsList: null
    };
    
    this.initialize();
  }
  
  initialize() {
    // Sign In
    this.elements.enterButton = document.getElementById('enter');
    this.elements.enterOverlay = document.getElementById('enterOverlay');
    this.elements.loginOverlay = document.getElementById('loginOverlay');
    this.elements.signDivUsername = document.getElementById('signDiv-username');
    this.elements.signDivPassword = document.getElementById('signDiv-password');
    this.elements.signDivSignIn = document.getElementById('signDiv-signIn');
    this.elements.signDivSignUp = document.getElementById('signDiv-signUp');
    this.elements.signDivSpectate = document.getElementById('signDiv-spectate');
    this.elements.gameDiv = document.getElementById('gameDiv');
    this.elements.UI = document.getElementById('UI');
    
    // Chat
    this.elements.chatMessagesContainer = document.getElementById('chat-messages-container');
    this.elements.chatMessages = document.getElementById('chat-messages');
    this.elements.chatInputWrapper = document.getElementById('chat-input-wrapper');
    this.elements.chatInput = document.getElementById('chat-input');
    this.elements.chatForm = document.getElementById('chat-form');
    
    // Inventory
    this.elements.inventoryButton = document.getElementById('inventory-button');
    this.elements.inventoryPopup = document.getElementById('inventory-popup');
    this.elements.inventoryGrid = document.getElementById('inventory-grid');
    this.elements.inventoryClose = document.getElementById('inventory-close');
    this.elements.characterButton = document.getElementById('character-button');
    this.elements.buildMenuButton = document.getElementById('build-menu-button');
    
    // Character
    this.elements.characterPopup = document.getElementById('character-popup');
    this.elements.characterClose = document.getElementById('character-close');
    
    // Context Menu
    this.elements.itemContextMenu = document.getElementById('item-context-menu');
    this.elements.dropQuantityModal = document.getElementById('drop-quantity-modal');
    this.elements.dropQuantityInput = document.getElementById('drop-quantity-input');
    this.elements.dropConfirmBtn = document.getElementById('drop-confirm-btn');
    this.elements.dropCancelBtn = document.getElementById('drop-cancel-btn');
    
    // Market
    this.elements.marketPopup = document.getElementById('market-popup');
    this.elements.marketClose = document.getElementById('market-close');
    this.elements.marketOrderbook = document.getElementById('market-orderbook');
    this.elements.marketPlayerOrdersList = document.getElementById('market-player-orders-list');
    this.elements.marketItemSelect = document.getElementById('market-item-select');
    this.elements.marketAmount = document.getElementById('market-amount');
    this.elements.marketPrice = document.getElementById('market-price');
    this.elements.marketBuyBtn = document.getElementById('market-buy-btn');
    this.elements.marketSellBtn = document.getElementById('market-sell-btn');
    
    // Deposit
    this.elements.depositPopup = document.getElementById('deposit-popup');
    this.elements.depositClose = document.getElementById('deposit-close');
    this.elements.depositSliders = document.getElementById('deposit-sliders');
    this.elements.depositConfirmBtn = document.getElementById('deposit-confirm-btn');
    this.elements.depositCancelBtn = document.getElementById('deposit-cancel-btn');
    this.elements.depositTitle = document.getElementById('deposit-title');
    
    // WorldMap
    this.elements.worldmapPopup = document.getElementById('worldmap-popup');
    this.elements.worldmapClose = document.getElementById('worldmap-close');
    this.elements.worldmapCanvas = document.getElementById('worldmap-canvas');
    if (this.elements.worldmapCanvas) {
      this.elements.worldmapCtx = this.elements.worldmapCanvas.getContext('2d');
    }
    
    // CaveMap
    this.elements.cavemapPopup = document.getElementById('cavemap-popup');
    this.elements.cavemapClose = document.getElementById('cavemap-close');
    this.elements.cavemapCanvas = document.getElementById('cavemap-canvas');
    if (this.elements.cavemapCanvas) {
      this.elements.cavemapCtx = this.elements.cavemapCanvas.getContext('2d');
    }
    
    // Build Menu
    this.elements.buildMenuPopup = document.getElementById('build-menu-popup');
    this.elements.buildMenuClose = document.getElementById('build-menu-close');
    this.elements.buildMenuContent = document.getElementById('build-menu-content');
    
    // Dock
    this.elements.dockPopup = document.getElementById('dock-popup');
    this.elements.dockClose = document.getElementById('dock-close');
    this.elements.dockShipList = document.getElementById('dock-ship-list');
    this.elements.dockOwnedShipsList = document.getElementById('dock-owned-ships-list');
    this.elements.dockCargoShipsList = document.getElementById('dock-cargo-ships-list');
  }
  
  get(name) {
    return this.elements[name] || null;
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.UIInitializer = UIInitializer;
  // Create singleton instance
  window.uiElements = new UIInitializer();
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIInitializer;
}

