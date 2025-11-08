const WebSocket = require('ws');
const Block = require('./Block');
const Transaction = require('./Transaction');

class P2PNetwork {
  constructor(port, peers = []) {
    this.port = port;
    this.peers = new Map(); // Connected peer nodes
    this.knownPeers = peers; // Bootstrap peer addresses
    this.server = null;
  }
  
  start() {
    // Create WebSocket server for peer connections
    this.server = new WebSocket.Server({ port: this.port });
    
    this.server.on('connection', (ws, req) => {
      const peerAddress = req.socket.remoteAddress + ':' + req.socket.remotePort;
      console.log(`Peer connected: ${peerAddress}`);
      this.handlePeerConnection(ws, peerAddress);
    });
    
    this.server.on('error', (error) => {
      console.error('P2P Server error:', error);
    });
    
    console.log(`P2P Network listening on port ${this.port}`);
    
    // Connect to known peers
    this.connectToPeers();
  }
  
  connectToPeers() {
    for (const peerUrl of this.knownPeers) {
      this.connectToPeer(peerUrl);
    }
  }
  
  connectToPeer(peerUrl) {
    try {
      const ws = new WebSocket(peerUrl);
      
      ws.on('open', () => {
        this.peers.set(peerUrl, ws);
        console.log(`Connected to peer: ${peerUrl}`);
        
        // Send handshake
        this.send(ws, {
          type: 'HANDSHAKE',
          data: {
            port: this.port,
            chainLength: global.blockchain.getChainLength()
          }
        });
      });
      
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });
      
      ws.on('close', () => {
        this.peers.delete(peerUrl);
        console.log(`Disconnected from peer: ${peerUrl}`);
      });
      
      ws.on('error', (error) => {
        console.error(`Error with peer ${peerUrl}:`, error.message);
      });
    } catch (err) {
      console.error(`Failed to connect to peer ${peerUrl}:`, err.message);
    }
  }
  
  handlePeerConnection(ws, peerAddress) {
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });
    
    ws.on('close', () => {
      console.log(`Peer disconnected: ${peerAddress}`);
    });
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
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error('Error sending message to peer:', err);
    }
  }
  
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'HANDSHAKE':
          this.handleHandshake(ws, message.data);
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
      console.error('Error handling peer message:', err);
    }
  }
  
  handleHandshake(ws, data) {
    console.log(`Handshake from peer with chain length ${data.chainLength}`);
    
    // Compare chain lengths
    if (data.chainLength > global.blockchain.getChainLength()) {
      // Request full chain from peer
      this.send(ws, { type: 'REQUEST_CHAIN' });
    }
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
        console.log('Received valid transaction from peer');
      }
    } catch (err) {
      console.error('Error handling new transaction:', err.message);
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
        console.log('Added new block from peer:', block.hash);
        
        // Sync player balances
        if (global.BalanceSync) {
          global.BalanceSync.syncPlayerBalances();
        }
      }
    } catch (err) {
      console.error('Error handling new block:', err.message);
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
        console.log(`Replaced chain with longer valid chain from peer (${receivedChain.length} blocks)`);
        
        // Sync player balances
        if (global.BalanceSync) {
          global.BalanceSync.syncPlayerBalances();
        }
      }
    } catch (err) {
      console.error('Error handling chain receive:', err.message);
    }
  }
  
  validateNewBlock(block) {
    const previousBlock = global.blockchain.getLatestBlock();
    
    // Check hash links
    if (block.previousHash !== previousBlock.hash) {
      console.error('Block has invalid previous hash');
      return false;
    }
    
    // Verify proof of work
    if (block.hash !== block.calculateHash()) {
      console.error('Block has invalid hash');
      return false;
    }
    
    // Check difficulty
    const target = Array(global.blockchain.difficulty + 1).join('0');
    if (block.hash.substring(0, global.blockchain.difficulty) !== target) {
      console.error('Block has insufficient difficulty');
      return false;
    }
    
    return true;
  }
  
  stop() {
    if (this.server) {
      this.server.close();
    }
    
    for (const ws of this.peers.values()) {
      ws.close();
    }
    
    this.peers.clear();
    console.log('P2P Network stopped');
  }
}

module.exports = P2PNetwork;

