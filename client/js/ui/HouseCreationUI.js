/**
 * HouseCreationUI.js
 * Manages the house creation UI display and interactions
 */

var HouseCreationUI = {
  popup: null,
  nameInput: null,
  flagEmoji: null,
  flagLabel: null,
  flagLeftBtn: null,
  flagRightBtn: null,
  createBtn: null,
  cancelBtn: null,
  closeBtn: null,
  errorDiv: null,
  
  availableFlags: [],
  currentFlagIndex: null, // null = random, otherwise index in availableFlags array
  buildingId: null,
  
  /**
   * Initialize UI elements
   */
  init: function() {
    this.popup = document.getElementById('house-creation-popup');
    this.nameInput = document.getElementById('house-name-input');
    this.flagEmoji = document.getElementById('house-flag-emoji');
    this.flagLabel = document.getElementById('house-flag-label');
    this.flagLeftBtn = document.getElementById('house-flag-left');
    this.flagRightBtn = document.getElementById('house-flag-right');
    this.createBtn = document.getElementById('house-creation-create-btn');
    this.cancelBtn = document.getElementById('house-creation-cancel-btn');
    this.closeBtn = document.getElementById('house-creation-close');
    this.errorDiv = document.getElementById('house-name-error');
    
    // Setup real-time name validation
    if(this.nameInput){
      var self = this;
      this.nameInput.addEventListener('input', function() {
        self.validateHouseName(self.nameInput.value);
      });
    }
  },
  
  /**
   * Open house creation UI
   * @param {Object} data - {availableFlags: [], buildingId: number}
   */
  openHouseCreation: function(data) {
    if(!this.popup) {
      this.init();
    }
    
    if(!this.popup) {
      console.error('House creation popup not found');
      return;
    }
    
    this.availableFlags = data.availableFlags || [];
    this.buildingId = data.buildingId;
    this.currentFlagIndex = null; // Start with random
    
    // Reset UI
    if(this.nameInput) this.nameInput.value = '';
    if(this.errorDiv) {
      this.errorDiv.style.display = 'none';
      this.errorDiv.textContent = '';
    }
    
    // Update flag display
    this.updateFlagDisplay();
    
    // Show popup
    this.popup.style.display = 'block';
    
    // Focus on name input
    if(this.nameInput) {
      setTimeout(() => {
        this.nameInput.focus();
      }, 100);
    }
  },
  
  /**
   * Close house creation UI
   */
  closeHouseCreation: function() {
    if(this.popup) {
      this.popup.style.display = 'none';
    }
    this.availableFlags = [];
    this.currentFlagIndex = null;
    this.buildingId = null;
  },
  
  /**
   * Navigate flags (left/right)
   * @param {string} direction - 'left' or 'right'
   */
  navigateFlag: function(direction) {
    if(this.availableFlags.length === 0) {
      return;
    }
    
    if(this.currentFlagIndex === null) {
      // Currently on random, go to first flag
      this.currentFlagIndex = 0;
    } else {
      if(direction === 'left') {
        this.currentFlagIndex--;
        if(this.currentFlagIndex < 0) {
          this.currentFlagIndex = this.availableFlags.length - 1; // Wrap around
        }
      } else if(direction === 'right') {
        this.currentFlagIndex++;
        if(this.currentFlagIndex >= this.availableFlags.length) {
          this.currentFlagIndex = 0; // Wrap around
        }
      }
    }
    
    this.updateFlagDisplay();
  },
  
  /**
   * Update flag display
   */
  updateFlagDisplay: function() {
    if(!this.flagEmoji || !this.flagLabel) return;
    
    if(this.currentFlagIndex === null) {
      // Random selection
      this.flagEmoji.textContent = '🎲';
      this.flagLabel.textContent = 'Random';
    } else if(this.availableFlags.length > 0 && this.currentFlagIndex < this.availableFlags.length) {
      var flag = this.availableFlags[this.currentFlagIndex];
      this.flagEmoji.textContent = flag.emoji;
      this.flagLabel.textContent = 'Flag #' + flag.index;
    }
  },
  
  /**
   * Validate house name
   * @param {string} name - House name to validate
   * @returns {boolean} Is valid
   */
  validateHouseName: function(name) {
    if(!this.errorDiv) return false;
    
    name = name.trim().toLowerCase();
    
    // Check length
    if(name.length === 0) {
      this.errorDiv.style.display = 'none';
      return false;
    }
    
    if(name.length > 20) {
      this.errorDiv.style.display = 'block';
      this.errorDiv.textContent = 'Name must be 20 characters or less';
      return false;
    }
    
    // Check format: single word, only a-z
    if(!/^[a-z]+$/.test(name)) {
      this.errorDiv.style.display = 'block';
      this.errorDiv.textContent = 'Name must be a single word with only lowercase letters (a-z)';
      return false;
    }
    
    // Valid
    this.errorDiv.style.display = 'none';
    return true;
  },
  
  /**
   * Submit house creation request
   */
  submitHouseCreation: function() {
    if(!this.nameInput || !this.buildingId) {
      return;
    }
    
    var houseName = this.nameInput.value.trim().toLowerCase();
    
    // Validate name
    if(!this.validateHouseName(houseName)) {
      if(houseName.length === 0) {
        if(this.errorDiv) {
          this.errorDiv.style.display = 'block';
          this.errorDiv.textContent = 'Please enter a house name';
        }
      }
      return;
    }
    
    // Get flag index (null for random)
    var flagIndex = null;
    if(this.currentFlagIndex !== null && this.availableFlags.length > 0) {
      if(this.currentFlagIndex < this.availableFlags.length) {
        flagIndex = this.availableFlags[this.currentFlagIndex].index;
      }
    }
    
    // Send request to server
    var socket = (typeof window !== 'undefined' && window.socket) ? window.socket : null;
    if(socket && typeof socket.send === 'function') {
      socket.send(JSON.stringify({
        msg: 'createHouse',
        houseName: houseName,
        flagIndex: flagIndex,
        buildingId: this.buildingId
      }));
    } else {
      console.error('Socket not available for house creation');
    }
    
    // Close UI
    this.closeHouseCreation();
  }
};

// Expose to global scope
if(typeof window !== 'undefined') {
  window.HouseCreationUI = HouseCreationUI;
}







