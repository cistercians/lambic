const crypto = require('crypto');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

class Transaction {
  constructor(fromAddress, toAddress, amount, type, metadata = {}) {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.type = type; // 'mining', 'transfer', 'reward'
    this.metadata = metadata; // Game context (player names, etc.)
    this.timestamp = Date.now();
    this.signature = null;
  }
  
  calculateHash() {
    return crypto.createHash('sha256')
      .update(this.fromAddress + this.toAddress + 
              this.amount + this.timestamp)
      .digest('hex');
  }
  
  signTransaction(signingKey) {
    // Mining rewards (from null) don't need to be signed
    if (this.fromAddress === null) {
      return;
    }
    
    // Verify the signing key matches the from address
    if (signingKey.getPublic('hex') !== this.fromAddress) {
      throw new Error('You cannot sign transactions for other wallets!');
    }
    
    // Sign transaction with private key
    const hashTx = this.calculateHash();
    const sig = signingKey.sign(hashTx, 'base64');
    this.signature = sig.toDER('hex');
  }
  
  isValid() {
    // Validate signature
    if (this.fromAddress === null) return true; // Mining reward
    if (!this.signature || this.signature.length === 0) {
      throw new Error('No signature in this transaction');
    }
    
    try {
      const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
      return publicKey.verify(this.calculateHash(), this.signature);
    } catch (err) {
      return false;
    }
  }
}

module.exports = Transaction;

