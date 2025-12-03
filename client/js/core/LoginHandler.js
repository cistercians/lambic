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
        if (this.socket && this.signDivUsername && this.signDivPassword) {
          this.socket.send(JSON.stringify({
            msg: 'signIn',
            name: this.signDivUsername.value,
            pass: this.signDivPassword.value
          }));
        }
      };
    }
    
    if (this.signDivSignUp) {
      this.signDivSignUp.onclick = () => {
        if (this.socket && this.signDivUsername && this.signDivPassword) {
          this.socket.send(JSON.stringify({
            msg: 'signUp',
            name: this.signDivUsername.value,
            pass: this.signDivPassword.value
          }));
        }
      };
    }
    
    if (this.signDivSpectate) {
      this.signDivSpectate.onclick = () => {
        if (this.socket && this.signDivUsername && this.signDivPassword) {
          this.socket.send(JSON.stringify({
            msg: 'spectate',
            name: this.signDivUsername.value,
            pass: this.signDivPassword.value
          }));
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

