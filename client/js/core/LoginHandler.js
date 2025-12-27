/**
 * LoginHandler - Handles login screen interactions
 * 
 * Extracted from client.js for better organization.
 */

class LoginHandler {
  constructor(config) {
    this.enterButton = config.enterButton;
    this.enterOverlay = config.enterOverlay;
    this.loginOverlay = config.loginOverlay;
    this.signDivUsername = config.signDivUsername;
    this.signDivPassword = config.signDivPassword;
    this.signDivSignIn = config.signDivSignIn;
    this.signDivSignUp = config.signDivSignUp;
    this.signDivSpectate = config.signDivSpectate;
    this.socket = config.socket;
    this.ambPlayer = config.ambPlayer;
    this.bgmPlayer = config.bgmPlayer;
    this.title_bgm = config.title_bgm;
    
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    if (this.enterButton) {
      this.enterButton.onclick = () => {
        // Start audio (browser requires user interaction)
        if (this.ambPlayer && this.title_bgm) {
          this.ambPlayer(this.ambPlayer.Amb ? this.ambPlayer.Amb.empty : null);
          this.bgmPlayer(this.title_bgm);
        }
        
        // Hide enter screen and show login form
        if (this.enterOverlay) this.enterOverlay.style.display = 'none';
        if (this.loginOverlay) this.loginOverlay.style.display = 'block';
      };
    }
    
    if (this.signDivSignIn) {
      this.signDivSignIn.onclick = () => {
        // Get socket dynamically from window (may be initialized after LoginHandler creation)
        var socket = (typeof window !== 'undefined' && window.socket) || this.socket;
        if (socket && this.signDivUsername && this.signDivPassword) {
          socket.send(JSON.stringify({
            msg: 'signIn',
            name: this.signDivUsername.value,
            pass: this.signDivPassword.value
          }));
        } else if (!socket) {
          console.warn('Cannot sign in: socket not initialized yet. Please wait for assets to load.');
        }
      };
    }
    
    if (this.signDivSignUp) {
      this.signDivSignUp.onclick = () => {
        // Get socket dynamically from window (may be initialized after LoginHandler creation)
        var socket = (typeof window !== 'undefined' && window.socket) || this.socket;
        if (socket && this.signDivUsername && this.signDivPassword) {
          socket.send(JSON.stringify({
            msg: 'signUp',
            name: this.signDivUsername.value,
            pass: this.signDivPassword.value
          }));
        } else if (!socket) {
          console.warn('Cannot sign up: socket not initialized yet. Please wait for assets to load.');
        }
      };
    }
    
    if (this.signDivSpectate) {
      this.signDivSpectate.onclick = () => {
        // Get socket dynamically from window (may be initialized after LoginHandler creation)
        var socket = (typeof window !== 'undefined' && window.socket) || this.socket;
        if (socket) {
          // Get values, default to empty string if not filled
          // This allows guest spectating when fields are blank
          const name = (this.signDivUsername && this.signDivUsername.value) || '';
          const pass = (this.signDivPassword && this.signDivPassword.value) || '';
          
          socket.send(JSON.stringify({
            msg: 'spectate',
            name: name,
            pass: pass
          }));
        } else {
          console.warn('Cannot spectate: socket not initialized yet. Please wait for assets to load.');
        }
      };
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.LoginHandler = LoginHandler;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoginHandler;
}

