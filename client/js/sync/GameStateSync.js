/**
 * GameStateSync - Handles synchronization with server
 * 
 * Manages socket communication, entity updates, and world state sync.
 * Separates network logic from rendering and UI.
 */

class GameStateSync {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // Callbacks for different message types
    this.messageHandlers = new Map();
    
    // Entity update tracking
    this.lastUpdateTime = 0;
    this.updateQueue = [];
  }

  /**
   * Initialize socket connection
   * @param {string} url - Server URL
   * @returns {Promise} Connection promise
   */
  connect(url = 'http://localhost:2000/io') {
    return new Promise((resolve, reject) => {
      if (typeof SockJS === 'undefined') {
        reject(new Error('SockJS not loaded'));
        return;
      }

      this.socket = new SockJS(url);
      
      this.socket.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[GameStateSync] Connected to server');
        this.emit('connected');
        resolve();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[GameStateSync] Error parsing message:', error);
        }
      };

      this.socket.onclose = () => {
        this.connected = false;
        console.log('[GameStateSync] Disconnected from server');
        this.emit('disconnected');
        this.attemptReconnect(url);
      };

      this.socket.onerror = (error) => {
        console.error('[GameStateSync] Socket error:', error);
        this.emit('error', error);
        reject(error);
      };
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Send message to server
   * @param {object} data - Message data
   */
  send(data) {
    if (!this.socket || !this.connected) {
      console.warn('[GameStateSync] Cannot send message: not connected');
      return;
    }

    try {
      this.socket.send(JSON.stringify(data));
    } catch (error) {
      console.error('[GameStateSync] Error sending message:', error);
    }
  }

  /**
   * Register a message handler
   * @param {string} messageType - Message type (e.g., 'update', 'signInResponse')
   * @param {Function} handler - Handler function
   */
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  /**
   * Remove a message handler
   * @param {string} messageType - Message type
   * @param {Function} handler - Handler function to remove
   */
  off(messageType, handler) {
    if (this.messageHandlers.has(messageType)) {
      const handlers = this.messageHandlers.get(messageType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Handle incoming message
   * @param {object} data - Message data
   */
  handleMessage(data) {
    if (!data || !data.msg) {
      return;
    }

    const messageType = data.msg;
    
    // Call registered handlers
    if (this.messageHandlers.has(messageType)) {
      this.messageHandlers.get(messageType).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[GameStateSync] Error in handler for ${messageType}:`, error);
        }
      });
    }

    // Emit generic message event
    this.emit('message', { type: messageType, data });
  }

  /**
   * Attempt to reconnect to server
   * @param {string} url - Server URL
   */
  attemptReconnect(url) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[GameStateSync] Max reconnect attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`[GameStateSync] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connect(url).catch(error => {
        console.error('[GameStateSync] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Emit event to registered listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    // Simple event emitter pattern
    if (this.messageHandlers.has(`$${event}`)) {
      this.messageHandlers.get(`$${event}`).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[GameStateSync] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected && this.socket && this.socket.readyState === 1;
  }

  /**
   * Get connection statistics
   * @returns {object} Connection stats
   */
  getStats() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      lastUpdateTime: this.lastUpdateTime,
      queuedUpdates: this.updateQueue.length
    };
  }
}

// Export singleton instance
const gameStateSync = new GameStateSync();
module.exports = gameStateSync;
