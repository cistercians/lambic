const NetworkConfig = require('./NetworkConfig');

class MiningManager {
  constructor(serverId, rewardAddress) {
    this.serverId = serverId;
    this.rewardAddress = rewardAddress; // Server's wallet for mining rewards
    this.isMining = false;
    this.miningInterval = null;
    this.miningTimeout = null;
  }
  
  startMining() {
    if (this.isMining) return;
    this.isMining = true;
    
    console.log(`Server ${this.serverId} started mining blocks...`);
    
    // Start mining loop
    this.scheduleMining();
  }
  
  scheduleMining() {
    if (!this.isMining) return;
    
    // Wait for target block time, then mine if there are pending transactions
    this.miningTimeout = setTimeout(() => {
      this.mineBlock();
      this.scheduleMining(); // Schedule next mining
    }, NetworkConfig.BLOCK_TIME_TARGET);
  }
  
  stopMining() {
    if (!this.isMining) return;
    this.isMining = false;
    
    if (this.miningTimeout) {
      clearTimeout(this.miningTimeout);
      this.miningTimeout = null;
    }
    
    console.log(`Server ${this.serverId} stopped mining`);
  }
  
  async mineBlock() {
    if (global.blockchain.pendingTransactions.length === 0) {
      console.log('No transactions to mine');
      return;
    }
    
    console.log(`Mining block with ${global.blockchain.pendingTransactions.length} transactions...`);
    
    const startTime = Date.now();
    
    try {
      // Mine the block (proof of work)
      const newBlock = global.blockchain.minePendingTransactions(
        this.rewardAddress,
        this.serverId
      );
      
      const miningTime = Date.now() - startTime;
      console.log(`Block mined in ${miningTime}ms: ${newBlock.hash}`);
      console.log(`Block height: ${global.blockchain.getChainLength()}`);
      
      // Broadcast new block to peers
      if (global.p2pNetwork) {
        global.p2pNetwork.broadcast({
          type: 'NEW_BLOCK',
          data: newBlock
        });
      }
      
      // Sync player balances
      if (global.BalanceSync) {
        global.BalanceSync.syncPlayerBalances();
      }
      
      // Save blockchain to disk
      if (global.BlockchainStorage) {
        global.BlockchainStorage.saveChain();
      }
      
      // Adjust difficulty based on mining time
      this.adjustDifficulty(miningTime);
    } catch (err) {
      console.error('Error mining block:', err);
    }
  }
  
  adjustDifficulty(miningTime) {
    // Keep block time near target
    if (miningTime < NetworkConfig.BLOCK_TIME_TARGET * 0.5) {
      global.blockchain.difficulty++;
      console.log(`Difficulty increased to ${global.blockchain.difficulty}`);
    } else if (miningTime > NetworkConfig.BLOCK_TIME_TARGET * 2) {
      global.blockchain.difficulty = Math.max(1, global.blockchain.difficulty - 1);
      console.log(`Difficulty decreased to ${global.blockchain.difficulty}`);
    }
  }
  
  forceMine() {
    // Force mine a block immediately (for testing/admin)
    return this.mineBlock();
  }
}

module.exports = MiningManager;

