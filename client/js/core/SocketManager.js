/**
 * SocketManager.js
 * Handles WebSocket connection initialization and cleanup
 * Extracted from client.js to reduce complexity
 * 
 * Note: If you see "ERR_BLOCKED_BY_CLIENT" errors in the console when connecting,
 * this is typically caused by browser extensions (ad blockers, privacy tools) blocking
 * the initial SockJS /io/info request. SockJS automatically falls back to other
 * transport methods, so the connection should still work. If the connection fails
 * completely, try disabling browser extensions or adding localhost to their whitelist.
 */

// Message queue for messages received before SocketMessageHandler is ready
var pendingMessages = [];

// Process pending messages once SocketMessageHandler is available
function processPendingMessages() {
  if (typeof SocketMessageHandler !== 'undefined' && SocketMessageHandler && SocketMessageHandler.handle) {
    while (pendingMessages.length > 0) {
      var msg = pendingMessages.shift();
      SocketMessageHandler.handle(msg);
    }
  }
}

// Check periodically if SocketMessageHandler is ready (max 5 seconds)
var checkAttempts = 0;
var maxCheckAttempts = 100; // 100 * 50ms = 5 seconds max wait
var checkInterval = setInterval(function() {
  checkAttempts++;
  if (typeof SocketMessageHandler !== 'undefined' && SocketMessageHandler && SocketMessageHandler.handle) {
    processPendingMessages();
    clearInterval(checkInterval);
  } else if (checkAttempts >= maxCheckAttempts) {
    console.error('SocketMessageHandler not available after 5 seconds - giving up');
    clearInterval(checkInterval);
    // Clear pending messages to prevent memory leak
    pendingMessages = [];
  }
}, 50);

var SocketManager = {
  // Connection retry state
  retryCount: 0,
  maxRetries: 5,
  retryDelay: 1000, // Start with 1 second
  retryTimeout: null,
  isConnecting: false,
  
  /**
   * Get the server URL, auto-detecting from current page location
   * Falls back to localhost:2000 if not accessible
   */
  getServerUrl: function() {
    // Check if a custom server URL is configured
    if (typeof window !== 'undefined' && window.SERVER_URL) {
      return window.SERVER_URL;
    }
    
    // Auto-detect from current page location
    if (typeof window !== 'undefined' && window.location) {
      var protocol = window.location.protocol; // "http:" or "https:"
      var hostname = window.location.hostname;
      var currentPort = window.location.port;
      
      // Use the same hostname as the current page
      // Server always runs on port 2000, regardless of client port
      var serverPort = '2000';
      
      // Build URL: protocol + "//" + hostname + ":" + port
      return protocol + '//' + hostname + ':' + serverPort;
    }
    
    // Default fallback
    return 'http://localhost:2000';
  },

  /**
   * Clean up existing socket connection
   */
  cleanup: function() {
    // Clear any pending retry
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    
    // Access global socket variable (declared in client.js)
    if (typeof window !== 'undefined' && window.socket) {
      var socket = window.socket;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.close) socket.close();
      window.socket = null;
    } else if (typeof socket !== 'undefined' && socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.close) socket.close();
      socket = null;
    }
    
    this.isConnecting = false;
  },

  /**
   * Initialize WebSocket connection with retry logic
   * @param {boolean} isRetry - Whether this is a retry attempt
   * @returns {Object} The socket instance
   */
  init: function(isRetry) {
    if (this.isConnecting && !isRetry) {
      console.warn('Socket connection already in progress');
      return window.socket || socket;
    }
    
    this.cleanup(); // Clean up any existing socket
    this.isConnecting = true;
    
    var serverUrl = this.getServerUrl();
    var socketUrl = serverUrl + '/io';
    
    if (!isRetry) {
      this.retryCount = 0;
      console.log('Connecting to server at:', socketUrl);
    } else {
      console.log('Retrying connection to server (attempt ' + this.retryCount + '/' + this.maxRetries + ')...');
    }
    
    var newSocket = SockJS(socketUrl);
    
    // Store socket in global scope (window.socket) so it's accessible from client.js
    if (typeof window !== 'undefined') {
      window.socket = newSocket;
    }
    // Also set in local scope for backward compatibility
    if (typeof socket !== 'undefined') {
      socket = newSocket;
    }
    
    // Track socket listeners
    var self = this;
    newSocket.onopen = function(){
      // Connection successful - reset retry state
      self.retryCount = 0;
      self.isConnecting = false;
      console.log('Socket connected successfully to:', socketUrl);
      
      // Request initial world data for login screen preview
      newSocket.send(JSON.stringify({msg:'requestPreviewData'}));
    };
    
    newSocket.onmessage = function(event){
      var data = JSON.parse(event.data);
      
      // Delegate to SocketMessageHandler
      // Handle case where SocketMessageHandler might not be loaded yet
      if(typeof SocketMessageHandler !== 'undefined' && SocketMessageHandler && typeof SocketMessageHandler.handle === 'function') {
        SocketMessageHandler.handle(data);
        // Process any pending messages that were queued
        processPendingMessages();
      } else {
        // SocketMessageHandler not loaded yet - queue message
        // This can happen if socket connects before all scripts finish loading
        console.warn('SocketMessageHandler not loaded yet, queuing message:', data.msg || 'unknown');
        pendingMessages.push(data);
      }
    };

    newSocket.onerror = function(event){
      // Note: ERR_BLOCKED_BY_CLIENT errors are common when browser extensions
      // (ad blockers, privacy tools) block the initial /io/info request.
      // SockJS automatically falls back to other transport methods, so this
      // error can usually be ignored if the connection eventually succeeds.
      var errorMsg = event && event.target ? event.target.toString() : String(event);
      
      // Only log if it's not a blocked-by-client error (those are expected)
      if (errorMsg.indexOf('ERR_BLOCKED_BY_CLIENT') === -1 && 
          errorMsg.indexOf('blocked') === -1) {
        console.warn('Socket connection error:', errorMsg);
      } else {
        // Silently handle blocked-by-client errors - SockJS will retry with other transports
        console.debug('Connection attempt blocked by browser extension (this is usually harmless)');
      }
    };
    
    newSocket.onclose = function(event){
      self.isConnecting = false;
      
      // Check if this was an abnormal closure (not a clean disconnect)
      if (event.code !== 1000 && event.code !== 1001) {
        var reason = event.reason || 'Unknown';
        console.warn('Socket connection closed abnormally. Code:', event.code, 'Reason:', reason);
        
        // Retry connection if it failed due to blocking or connection issues
        // Code 1002 = abnormal closure, 1006 = abnormal closure (no close frame)
        if ((event.code === 1002 || event.code === 1006) && 
            (reason.indexOf('Cannot connect') !== -1 || reason.indexOf('blocked') !== -1)) {
          
          if (self.retryCount < self.maxRetries) {
            self.retryCount++;
            // Exponential backoff: 1s, 2s, 4s, 8s, 16s
            var delay = self.retryDelay * Math.pow(2, self.retryCount - 1);
            console.log('Will retry connection in', delay / 1000, 'seconds...');
            
            self.retryTimeout = setTimeout(function() {
              self.init(true); // Retry
            }, delay);
          } else {
            console.error('Failed to connect after', self.maxRetries, 'attempts.');
            console.error('Possible causes:');
            console.error('1. Browser extension is blocking the connection (try disabling ad blockers)');
            console.error('2. Server is not running on', serverUrl);
            console.error('3. Firewall or network issues');
            console.error('You can manually retry by calling SocketManager.init()');
          }
        }
      } else {
        console.log('Socket connection closed normally');
      }
      
      // Cleanup on disconnect (performance tools handle their own cleanup)
      // Reset selfId on disconnect (access global selfId)
      if (typeof window !== 'undefined' && window.selfId !== undefined) {
        window.selfId = null;
      } else if (typeof selfId !== 'undefined') {
        selfId = null;
      }
    };
    
    return newSocket;
  }
};

