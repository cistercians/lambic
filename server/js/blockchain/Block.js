const crypto = require('crypto');

class Block {
  constructor(timestamp, transactions, previousHash = '') {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = '';
    this.nonce = 0;
    this.miner = null; // Server that mined this block
  }
  
  calculateHash() {
    // SHA-256 hash of block data
    return crypto.createHash('sha256')
      .update(this.previousHash + this.timestamp + 
              JSON.stringify(this.transactions) + this.nonce)
      .digest('hex');
  }
  
  mineBlock(difficulty) {
    // Proof of work - find hash with N leading zeros
    const target = Array(difficulty + 1).join('0');
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
  }
}

module.exports = Block;

