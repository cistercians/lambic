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
  /**
   * Clean up existing socket connection
   */
  cleanup: function() {
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
  },

  /**
   * Initialize WebSocket connection
   * @returns {Object} The socket instance
   */
  init: function() {
    this.cleanup(); // Clean up any existing socket
    
    var newSocket = SockJS('http://localhost:2000/io');
    
    // Store socket in global scope (window.socket) so it's accessible from client.js
    if (typeof window !== 'undefined') {
      window.socket = newSocket;
    }
    // Also set in local scope for backward compatibility
    if (typeof socket !== 'undefined') {
      socket = newSocket;
    }
    
    // Track socket listeners
    newSocket.onopen = function(){
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
      // Check if this was an abnormal closure (not a clean disconnect)
      if (event.code !== 1000 && event.code !== 1001) {
        console.warn('Socket connection closed abnormally. Code:', event.code, 'Reason:', event.reason || 'Unknown');
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

