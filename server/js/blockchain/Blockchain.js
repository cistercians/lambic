const Block = require('./Block');
const Transaction = require('./Transaction');

class LambicBlockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 4; // Number of leading zeros required
    this.pendingTransactions = [];
    this.miningReward = 10; // Gold reward for mining block
  }
  
  createGenesisBlock() {
    const genesisBlock = new Block(Date.now(), [], '0');
    genesisBlock.hash = genesisBlock.calculateHash();
    return genesisBlock;
  }
  
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }
  
  minePendingTransactions(miningRewardAddress, serverId) {
    // Create reward transaction
    const rewardTx = new Transaction(
      null, 
      miningRewardAddress, 
      this.miningReward,
      'reward',
      { serverId: serverId }
    );
    this.pendingTransactions.push(rewardTx);
    
    // Create new block
    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );
    block.miner = serverId;
    
    // Mine block (proof of work)
    block.mineBlock(this.difficulty);
    
    // Add to chain
    this.chain.push(block);
    
    // Clear pending transactions
    this.pendingTransactions = [];
    
    return block;
  }
  
  addTransaction(transaction) {
    if (!transaction.fromAddress && transaction.type !== 'mining') {
      throw new Error('Transaction must include from address');
    }
    
    if (!transaction.toAddress) {
      throw new Error('Transaction must include to address');
    }
    
    if (transaction.amount <= 0) {
      throw new Error('Transaction amount must be positive');
    }
    
    // Validate signature for non-mining transactions
    if (transaction.fromAddress !== null && !transaction.isValid()) {
      throw new Error('Cannot add invalid transaction to chain');
    }
    
    // Check if sender has sufficient balance (except for mining transactions)
    if (transaction.fromAddress !== null) {
      const balance = this.getBalanceOfAddress(transaction.fromAddress);
      if (balance < transaction.amount) {
        throw new Error('Not enough balance');
      }
    }
    
    this.pendingTransactions.push(transaction);
  }
  
  getBalanceOfAddress(address) {
    let balance = 0;
    
    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount;
        }
        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }
    
    return balance;
  }
  
  getAllTransactionsForWallet(address) {
    const txs = [];
    
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          txs.push(tx);
        }
      }
    }
    
    return txs;
  }
  
  isChainValid() {
    // Check genesis block
    const realGenesis = JSON.stringify(this.createGenesisBlock());
    const currentGenesis = JSON.stringify(this.chain[0]);
    
    if (realGenesis !== currentGenesis) {
      return false;
    }
    
    // Validate rest of chain
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      
      // Validate transactions in block
      for (const trans of currentBlock.transactions) {
        if (!trans.isValid()) {
          return false;
        }
      }
      
      // Validate block hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }
      
      // Validate chain link
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
      
      // Validate proof of work
      const target = Array(this.difficulty + 1).join('0');
      if (currentBlock.hash.substring(0, this.difficulty) !== target) {
        return false;
      }
    }
    
    return true;
  }
  
  getChainLength() {
    return this.chain.length;
  }
}

module.exports = LambicBlockchain;

