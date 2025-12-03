/**
 * SocketManager.js
 * Handles WebSocket connection initialization and cleanup
 * Extracted from client.js to reduce complexity
 */

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
      console.log('Client connection opened');
      // Request initial world data for login screen preview
      newSocket.send(JSON.stringify({msg:'requestPreviewData'}));
    };
    
    newSocket.onmessage = function(event){
      var data = JSON.parse(event.data);
      
      // Delegate to SocketMessageHandler
      if(typeof SocketMessageHandler !== 'undefined' && SocketMessageHandler.handle) {
        SocketMessageHandler.handle(data);
      } else {
        console.error('SocketMessageHandler not loaded!');
      }
    };

    newSocket.onerror = function(event){
      console.log('Client error: ' + event);
    };
    
    newSocket.onclose = function(event){
      console.log('Client connection closed: ' + event.code);
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

