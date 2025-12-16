const WebSocket = require('ws');
const Block = require('./Block');
const Transaction = require('./Transaction');

class P2PNetwork {
  constructor(port, peers = [], myAddress = null) {
    this.port = port;
    this.peers = new Map(); // Connected peer nodes: Map<peerUrl, WebSocket>
    this.peerAddresses = new Map(); // Map<WebSocket, peerUrl> for reverse lookup
    this.knownPeers = new Set(peers); // All known peer addresses (connected + not yet connected)
    this.pendingConnections = new Set(); // Peers we're currently trying to connect to
    this.myAddress = myAddress || process.env.BLOCKCHAIN_ADDRESS || null; // Our own address
    this.server = null;
    
    // Connection limits to prevent network flooding
    this.maxPeers = parseInt(process.env.MAX_PEERS) || 10; // Maximum connected peers
    this.maxKnownPeers = parseInt(process.env.MAX_KNOWN_PEERS) || 50; // Maximum known peers to track
    this.peerExchangeLimit = 5; // Max new peers to try connecting to per exchange
  }
  
  start() {
    // Create WebSocket server for peer connections
    this.server = new WebSocket.Server({ port: this.port });
    
    this.server.on('connection', (ws, req) => {
      this.handleIncomingConnection(ws, req);
    });
    
    this.server.on('error', (error) => {
      console.error('[P2P] Server error:', error.message);
    });
    
    console.log(`[P2P] Server listening on port ${this.port}`);
    
    // Connect to bootstrap peers
    this.connectToBootstrapPeers();
  }
  
  connectToBootstrapPeers() {
    // Connect to initial bootstrap peers
    for (const peerUrl of this.knownPeers) {
      if (!this.peers.has(peerUrl) && !this.pendingConnections.has(peerUrl)) {
        this.connectToPeer(peerUrl);
      }
    }
  }
  
  connectToPeer(peerUrl) {
    // Skip if already connected or trying to connect
    if (this.peers.has(peerUrl) || this.pendingConnections.has(peerUrl)) {
      return;
    }
    
    // Skip if we're at max connections
    if (this.peers.size >= this.maxPeers) {
      return;
    }
    
    // Skip ourselves
    if (peerUrl === this.myAddress) {
      return;
    }
    
    // Validate URL format
    if (!peerUrl.startsWith('ws://') && !peerUrl.startsWith('wss://')) {
      return;
    }
    
    this.pendingConnections.add(peerUrl);
    
    try {
      const ws = new WebSocket(peerUrl);
      
      ws.on('open', () => {
        this.pendingConnections.delete(peerUrl);
        this.peers.set(peerUrl, ws);
        this.peerAddresses.set(ws, peerUrl);
        this.knownPeers.add(peerUrl);
        
        console.log(`[P2P] Connected to peer: ${peerUrl}`);
        
        // Send handshake with our address and peer list
        this.sendHandshake(ws);
      });
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });
      
      ws.on('close', () => {
        const url = this.peerAddresses.get(ws);
        if (url) {
          this.peers.delete(url);
          this.peerAddresses.delete(ws);
          console.log(`[P2P] Disconnected from peer: ${url}`);
        }
        this.pendingConnections.delete(peerUrl);
      });
      
      ws.on('error', (error) => {
        this.pendingConnections.delete(peerUrl);
        // Silently fail - peer might not be available
      });
    } catch (err) {
      this.pendingConnections.delete(peerUrl);
    }
  }
  
  handleIncomingConnection(ws, req) {
    // Extract peer address from connection
    // Try to get it from headers or construct from request
    let peerUrl = null;
    
    // Try to extract from Host header or construct from remote address
    const host = req.headers.host || `${req.socket.remoteAddress}:${this.port}`;
    const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
    
    // If we have a proper host header, use it
    if (req.headers.host) {
      peerUrl = `${protocol}://${req.headers.host}`;
    } else {
      // Fallback: construct from remote address
      const remoteAddr = req.socket.remoteAddress;
      // Replace ::1 (IPv6 localhost) with 127.0.0.1
      const addr = remoteAddr === '::1' ? '127.0.0.1' : remoteAddr;
      peerUrl = `ws://${addr}:${req.socket.remotePort}`;
    }
    
    // Store the connection
    this.peers.set(peerUrl, ws);
    this.peerAddresses.set(ws, peerUrl);
    this.knownPeers.add(peerUrl);
    
    console.log(`[P2P] Incoming connection from: ${peerUrl}`);
    
    // Set up message handler
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });
    
    ws.on('close', () => {
      const url = this.peerAddresses.get(ws);
      if (url) {
        this.peers.delete(url);
        this.peerAddresses.delete(ws);
        console.log(`[P2P] Peer disconnected: ${url}`);
      }
    });
    
    ws.on('error', (error) => {
      const url = this.peerAddresses.get(peerUrl);
      if (url) {
        this.peers.delete(url);
        this.peerAddresses.delete(ws);
      }
    });
  }
  
  sendHandshake(ws) {
    // Get our peer list (limited size)
    const ourPeers = this.getPeerListForExchange();
    
    this.send(ws, {
      type: 'HANDSHAKE',
      data: {
        address: this.myAddress,
        port: this.port,
        chainLength: global.blockchain.getChainLength(),
        peers: ourPeers,
        knownPeers: Array.from(this.knownPeers).slice(0, 10) // Limit known peers shared
      }
    });
  }
  
  getPeerListForExchange() {
    // Return list of connected peers (excluding ourselves)
    return Array.from(this.peers.keys())
      .filter(addr => addr !== this.myAddress)
      .slice(0, this.peerExchangeLimit);
  }
  
  broadcast(message) {
    // Send message to all connected peers
    for (const ws of this.peers.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        this.send(ws, message);
      }
    }
  }
  
  send(ws, message) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (err) {
      // Connection might be closed
    }
  }
  
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'HANDSHAKE':
          this.handleHandshake(ws, message.data);
          break;
        case 'PEER_LIST':
          this.handlePeerList(ws, message.data);
          break;
        case 'NEW_TRANSACTION':
          this.handleNewTransaction(message.data);
          break;
        case 'NEW_BLOCK':
          this.handleNewBlock(message.data);
          break;
        case 'REQUEST_CHAIN':
          this.handleChainRequest(ws);
          break;
        case 'RECEIVE_CHAIN':
          this.handleChainReceive(message.data);
          break;
      }
    } catch (err) {
      console.error('[P2P] Error handling message:', err.message);
    }
  }
  
  handleHandshake(ws, data) {
    const peerUrl = this.peerAddresses.get(ws) || data.address;
    
    // Update peer address if we got it from handshake
    if (data.address && !this.peerAddresses.has(ws)) {
      this.peerAddresses.set(ws, data.address);
      if (!this.peers.has(data.address)) {
        this.peers.set(data.address, ws);
        this.peers.delete(peerUrl); // Remove old mapping if different
      }
    }
    
    console.log(`[P2P] Handshake from ${peerUrl || data.address}, chain length: ${data.chainLength}`);
    
    // Compare chain lengths
    if (data.chainLength > global.blockchain.getChainLength()) {
      // Request full chain from peer
      this.send(ws, { type: 'REQUEST_CHAIN' });
    }
    
    // Discover new peers from handshake
    if (data.peers || data.knownPeers) {
      this.discoverNewPeers(data.peers || [], data.knownPeers || []);
    }
    
    // Send our peer list back
    this.sendPeerList(ws);
  }
  
  handlePeerList(ws, data) {
    // Received explicit peer list message
    if (data.peers || data.knownPeers) {
      this.discoverNewPeers(data.peers || [], data.knownPeers || []);
    }
  }
  
  discoverNewPeers(connectedPeers = [], knownPeers = []) {
    // Combine both lists
    const allNewPeers = [...connectedPeers, ...knownPeers];
    
    // Filter out invalid peers
    const validPeers = allNewPeers.filter(peerUrl => {
      return peerUrl &&
             peerUrl !== this.myAddress &&
             !this.peers.has(peerUrl) &&
             !this.pendingConnections.has(peerUrl) &&
             (peerUrl.startsWith('ws://') || peerUrl.startsWith('wss://'));
    });
    
    // Limit how many we try to connect to at once
    const peersToTry = validPeers.slice(0, this.peerExchangeLimit);
    
    // Add to known peers
    peersToTry.forEach(peerUrl => {
      this.knownPeers.add(peerUrl);
      
      // Limit known peers size
      if (this.knownPeers.size > this.maxKnownPeers) {
        const first = Array.from(this.knownPeers)[0];
        this.knownPeers.delete(first);
      }
    });
    
    // Try to connect to new peers (with staggered delays to avoid thundering herd)
    peersToTry.forEach((peerUrl, index) => {
      if (this.peers.size < this.maxPeers) {
        setTimeout(() => {
          this.connectToPeer(peerUrl);
        }, index * 500 + Math.random() * 1000); // Stagger connections
      }
    });
    
    if (peersToTry.length > 0) {
      console.log(`[P2P] Discovered ${peersToTry.length} new peer(s)`);
    }
  }
  
  sendPeerList(ws) {
    const peerList = this.getPeerListForExchange();
    
    this.send(ws, {
      type: 'PEER_LIST',
      data: {
        address: this.myAddress,
        peers: peerList,
        knownPeers: Array.from(this.knownPeers)
          .filter(addr => addr !== this.myAddress && !this.peers.has(addr))
          .slice(0, 10)
      }
    });
  }
  
  handleNewTransaction(transactionData) {
    try {
      // Received new transaction from peer
      const tx = new Transaction(
        transactionData.fromAddress,
        transactionData.toAddress,
        transactionData.amount,
        transactionData.type,
        transactionData.metadata
      );
      tx.signature = transactionData.signature;
      tx.timestamp = transactionData.timestamp;
      
      if (tx.isValid()) {
        global.blockchain.addTransaction(tx);
      }
    } catch (err) {
      console.error('[P2P] Error handling transaction:', err.message);
    }
  }
  
  handleNewBlock(blockData) {
    try {
      // Received new block from peer
      const block = Object.assign(new Block(), blockData);
      
      // Validate and add to chain
      if (this.validateNewBlock(block)) {
        global.blockchain.chain.push(block);
        global.blockchain.pendingTransactions = [];
        
        // Sync player balances
        if (global.BalanceSync) {
          global.BalanceSync.syncPlayerBalances();
        }
      }
    } catch (err) {
      console.error('[P2P] Error handling block:', err.message);
    }
  }
  
  handleChainRequest(ws) {
    // Send our chain to requesting peer
    this.send(ws, {
      type: 'RECEIVE_CHAIN',
      data: global.blockchain.chain
    });
  }
  
  handleChainReceive(chain) {
    try {
      // Received full chain from peer
      if (!Array.isArray(chain) || chain.length === 0) {
        return;
      }
      
      // Reconstruct chain
      const receivedChain = chain.map(blockData => 
        Object.assign(new Block(), blockData)
      );
      
      // Validate chain
      const tempBlockchain = Object.create(global.blockchain);
      tempBlockchain.chain = receivedChain;
      
      // Replace our chain if valid and longer
      if (tempBlockchain.isChainValid() && 
          receivedChain.length > global.blockchain.chain.length) {
        global.blockchain.chain = receivedChain;
        
        console.log(`[P2P] Chain synchronized: ${receivedChain.length} blocks`);
        
        // Sync player balances
        if (global.BalanceSync) {
          global.BalanceSync.syncPlayerBalances();
        }
      }
    } catch (err) {
      console.error('[P2P] Error receiving chain:', err.message);
    }
  }
  
  validateNewBlock(block) {
    const previousBlock = global.blockchain.getLatestBlock();
    
    // Check hash links
    if (block.previousHash !== previousBlock.hash) {
      return false;
    }
    
    // Verify proof of work
    if (block.hash !== block.calculateHash()) {
      return false;
    }
    
    // Check difficulty
    const target = Array(global.blockchain.difficulty + 1).join('0');
    if (block.hash.substring(0, global.blockchain.difficulty) !== target) {
      return false;
    }
    
    return true;
  }
  
  getConnectedPeers() {
    return Array.from(this.peers.keys());
  }
  
  getKnownPeers() {
    return Array.from(this.knownPeers);
  }
  
  stop() {
    if (this.server) {
      this.server.close();
    }
    
    for (const ws of this.peers.values()) {
      ws.close();
    }
    
    this.peers.clear();
    this.peerAddresses.clear();
    this.pendingConnections.clear();
  }
}

module.exports = P2PNetwork;
