const fs = require('fs').promises;
const path = require('path');

class BlockchainStorage {
  static async saveChain() {
    try {
      if (!global.blockchain) {
        return;
      }
      
      const dataDir = path.join(__dirname, '../../../data');
      
      // Ensure data directory exists
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (err) {
        // Directory already exists
      }
      
      const chainData = JSON.stringify(global.blockchain.chain, null, 2);
      const filepath = path.join(dataDir, 'blockchain.json');
      
      await fs.writeFile(filepath, chainData);
      console.log(`Blockchain saved to disk (${global.blockchain.chain.length} blocks)`);
    } catch (err) {
      console.error('Error saving blockchain:', err);
    }
  }
  
  static async loadChain() {
    try {
      const filepath = path.join(__dirname, '../../../data/blockchain.json');
      const data = await fs.readFile(filepath, 'utf8');
      const chain = JSON.parse(data);
      
      // Reconstruct blockchain blocks
      const Block = require('./Block');
      global.blockchain.chain = chain.map(blockData => {
        const block = new Block(
          blockData.timestamp,
          blockData.transactions,
          blockData.previousHash
        );
        block.hash = blockData.hash;
        block.nonce = blockData.nonce;
        block.miner = blockData.miner;
        return block;
      });
      
      console.log(`Loaded blockchain with ${global.blockchain.chain.length} blocks`);
      
      // Validate loaded chain
      if (!global.blockchain.isChainValid()) {
        console.error('WARNING: Loaded blockchain is invalid!');
        return false;
      }
      
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No existing blockchain found, starting fresh');
      } else {
        console.error('Error loading blockchain:', err);
      }
      return false;
    }
  }
  
  static startAutosave() {
    // Auto-save every 5 minutes
    setInterval(() => {
      this.saveChain();
    }, 300000);
    
    console.log('Blockchain autosave enabled (every 5 minutes)');
  }
}

module.exports = BlockchainStorage;

