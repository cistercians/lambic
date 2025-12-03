/**
 * ChatManager - Manages chat display and auto-hide functionality
 * 
 * Extracted from client.js for better organization.
 */

class ChatManager {
  constructor() {
    this.chatMessagesContainer = null;
    this.chatMessages = null;
    this.chatInput = null;
    this.chatHideTimer = null;
    this.hideDelay = 5000; // 5 seconds
    this.transitionDelay = 300; // 300ms for CSS transition
  }

  /**
   * Initialize chat manager
   * @param {HTMLElement} chatMessagesContainer - Chat messages container element
   * @param {HTMLElement} chatMessages - Chat messages element
   * @param {HTMLElement} chatInput - Chat input element
   */
  init(chatMessagesContainer, chatMessages, chatInput) {
    this.chatMessagesContainer = chatMessagesContainer;
    this.chatMessages = chatMessages;
    this.chatInput = chatInput;

    // Set up focus/blur handlers
    if (this.chatInput) {
      this.chatInput.addEventListener('focus', () => {
        this.showChat();
        this.clearHideTimer();
      });

      this.chatInput.addEventListener('blur', () => {
        this.resetHideTimer();
      });
    }
  }

  /**
   * Show chat container
   */
  showChat() {
    if (this.chatMessagesContainer) {
      this.chatMessagesContainer.classList.remove('hidden');
      this.chatMessagesContainer.style.display = 'block';
    }
  }

  /**
   * Hide chat container
   */
  hideChat() {
    if (this.chatMessagesContainer && document.activeElement !== this.chatInput) {
      this.chatMessagesContainer.classList.add('hidden');
      
      // Actually hide after transition
      setTimeout(() => {
        if (this.chatMessagesContainer && this.chatMessagesContainer.classList.contains('hidden')) {
          this.chatMessagesContainer.style.display = 'none';
        }
      }, this.transitionDelay);
    }
  }

  /**
   * Clear hide timer
   */
  clearHideTimer() {
    if (this.chatHideTimer) {
      clearTimeout(this.chatHideTimer);
      this.chatHideTimer = null;
    }
  }

  /**
   * Reset hide timer (show chat and schedule hide)
   */
  resetHideTimer() {
    this.clearHideTimer();
    this.showChat();
    
    // Schedule hide
    this.chatHideTimer = setTimeout(() => {
      this.hideChat();
    }, this.hideDelay);
  }

  /**
   * Add message to chat
   * @param {string} message - Message HTML
   * @param {string} style - Optional style (e.g., 'color: #4CAF50;' for spectator chat)
   */
  addMessage(message, style) {
    if (!this.chatMessages) return;

    const div = document.createElement('div');
    if (style) {
      div.style.cssText = style;
    }
    div.innerHTML = message;
    this.chatMessages.appendChild(div);

    // Force scroll to bottom
    setTimeout(() => {
      if (this.chatMessages) {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
      }
    }, 0);

    // Show chat and reset timer
    this.resetHideTimer();
  }

  /**
   * Clear all messages
   */
  clear() {
    if (this.chatMessages) {
      this.chatMessages.innerHTML = '';
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ChatManager = ChatManager;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatManager;
}
